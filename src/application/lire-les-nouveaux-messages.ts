// ════════════════════════════════════════════════════════════════════
//  src/application/lire-les-nouveaux-messages.ts
//
//  La tâche 1 de la relève (planche 45) : lire les messages parus depuis
//  le dernier passage, y reconnaître les blocs d'action, et **écrire les
//  lignes du registre**.
//
//  C'EST LA TÂCHE QUI DONNE UN SENS AUX BOUTONS. Sans elle, « Fouiller la
//  zone » écrit un bloc que personne ne lit. Avec elle, le bloc devient
//  une ligne de registre, et la clôture (tâche 2) la verse.
//
//  ── LE REGISTRE EST UN JOURNAL, PAS UN SOLDE ─────────────────────────
//
//  Rien n'est appliqué ici. Le joueur ne gagne pas ses Pokédollars en
//  fouillant : il gagne une LIGNE, et la ligne est versée à la clôture,
//  ou effacée si le sujet est abandonné. C'est la règle 1 de la planche
//  45, et c'est elle qui permet d'écrire trois RP en parallèle sans
//  réserver trois fois la même Poké Ball.
//
//  ── LE TIRAGE EST FIGÉ AU MESSAGE ────────────────────────────────────
//
//  La graine est l'identifiant du message, et rien d'autre. Deux
//  conséquences qu'on tient pour des garanties :
//
//  · **rejouer le même message donne le même résultat**, donc une
//    contestation se trancher en recalculant au lieu d'en débattre ;
//  · **relire un message déjà lu ne crée rien**, parce que la base refuse
//    un doublon `(message_id, type)`. La relève peut donc repasser sur
//    une zone sans rien abîmer — et elle le fait, chaque fois qu'un
//    incident empêche d'avancer le curseur.
//
//  ── CE QU'ON NE FAIT PAS, ET POURQUOI ────────────────────────────────
//
//  · **On ne touche pas au curseur.** `ParcourirLesZones` le tient déjà,
//    et deux tâches qui avancent le même curseur se voleraient des
//    messages. Cette tâche reçoit l'intervalle à lire, elle ne le décide
//    pas.
//  · **On ne poste rien.** Le bilan en cours est un module, pas un
//    message (planche 45 §5). Un joueur qui fouille ne reçoit pas de
//    réponse automatique dans le fil.
//  · **On ne note rien au journal.** Cette tâche s'exécute SUR UN SUJET,
//    et `releve_journal` tient une ligne par tâche et par PASSAGE. Noter
//    ici écrirait une ligne par sujet lu : le journal deviendrait
//    illisible le jour où il servirait. C'est `ParcourirLesZones`, qui
//    tient le passage, qui note — pour cette tâche comme pour la sienne.
//  · **On n'échoue jamais en bloc.** Un message illisible, un joueur sans
//    fiche, une zone sans faune : chacun est noté et on continue. Une
//    action perdue est un incident ; seize actions perdues parce que la
//    première a échoué serait une panne.
// ════════════════════════════════════════════════════════════════════

import type { Evenement } from "../domaine/cloture.ts";
import { codeDepuisEmpreinte } from "../domaine/code.ts";
import { quelFossile } from "../domaine/fossile.ts";
import { fouiller } from "../domaine/fouille.ts";
import { conditionDeLaZone, estLaNuit, tempsDuJour } from "../domaine/meteo.ts";
import { tirerUneRencontre } from "../domaine/rencontre.ts";
import type {
  ActionLue,
  EtatDuJeu,
  Faune,
  Horloge,
  LecteurDActions,
  Registre,
  Signataire,
  TableDeButin,
  TableDesFossiles,
  ZoneSauvage,
} from "./ports.ts";

export const TACHE = "messages";

/** L'heure locale d'un joueur, pour savoir s'il fait nuit chez lui.
 *
 *  Décidé avec Callista le 2 octobre : **le jour et la nuit suivent
 *  l'heure du JOUEUR, la météo suit le jour du SERVEUR.** Deux joueurs
 *  dans le même sujet peuvent donc croiser l'un un Noctali, l'autre un
 *  Pikachu — et c'est voulu : on ne va pas demander à quelqu'un de jouer
 *  à trois heures du matin pour voir les Pokémon nocturnes. */
export interface HeuresDesJoueurs {
  /** L'heure locale du joueur, de 0 à 23. */
  heureLocaleDe(joueurId: string): Promise<number>;
}

export type LigneEcrite = {
  readonly sujetId: number;
  readonly messageId: number;
  readonly joueurId: string;
  readonly type: Evenement["type"];
};

export type BilanDeLecture = {
  /** Les actions menées à bien, c'est-à-dire devenues une ligne. */
  readonly traitees: number;
  readonly erreurs: readonly string[];
  readonly lignes: readonly LigneEcrite[];
};

function raison(e: unknown): string {
  return e instanceof Error ? `${e.name} : ${e.message}` : String(e);
}

export class LireLesNouveauxMessages {
  constructor(
    private readonly faune: Faune,
    private readonly actions: LecteurDActions,
    private readonly jeu: EtatDuJeu,
    private readonly heures: HeuresDesJoueurs,
    private readonly registre: Registre,
    private readonly horloge: Horloge,
    private readonly signataire: Signataire,
    private readonly fossiles: TableDesFossiles,
    private readonly butin: TableDeButin,
  ) {}

  /**
   * Lit un sujet et inscrit ce qu'il contient.
   *
   * `depuisMessageId` vient du curseur tenu par `ParcourirLesZones` : on
   * lit ce qui est arrivé après, et rien d'autre.
   */
  async executerSur(
    zone: ZoneSauvage,
    sujetId: number,
    depuisMessageId: number,
  ): Promise<BilanDeLecture> {
    const erreurs: string[] = [];
    const lignes: LigneEcrite[] = [];

    for (const lue of await this.actions.actionsDuSujet(sujetId, depuisMessageId)) {
      try {
        lignes.push(...await this.inscrireUneAction(zone, sujetId, lue, erreurs));
      } catch (e) {
        //  Une action perdue n'emporte pas les suivantes : le joueur
        //  d'après n'a rien fait de mal.
        erreurs.push(`message ${lue.messageId} (sujet ${sujetId}) : ${raison(e)}`);
      }
    }

    return { traitees: lignes.length, erreurs, lignes };
  }

  /** Rend les lignes écrites — souvent une, parfois zéro, parfois deux.
   *
   *  ZÉRO N'EST PAS UNE ERREUR : une fouille bredouille est un résultat.
   *  DEUX NON PLUS, et c'est la règle du 7 octobre : une même fouille
   *  donne des Pokédollars ET, rarement, un fossile. L'index unique
   *  `(message_id, type)` de la base l'autorise justement parce que les
   *  deux lignes ne sont pas du même type. */
  private async inscrireUneAction(
    zone: ZoneSauvage,
    sujetId: number,
    lue: ActionLue,
    erreurs: string[],
  ): Promise<readonly LigneEcrite[]> {
    const joueurId = await this.jeu.joueurDuCompte(lue.auteurId);
    if (joueurId === null) {
      //  Cas normal : quelqu'un sans fiche validée a cliqué. On le dit,
      //  on n'inscrit rien, et ce n'est pas une panne de la zone.
      erreurs.push(
        `message ${lue.messageId} : ${lue.auteurPseudo} (compte ${lue.auteurId}) ` +
          `n'est lié à aucun joueur, action ignorée`,
      );
      return [];
    }

    const ecrites: LigneEcrite[] = [];
    for (const evenement of await this.resoudre(zone, lue, joueurId, erreurs)) {
      //  LE CODE EST PROPRE À L'ÉVÉNEMENT, pas au message : deux lignes
      //  d'une même fouille portent deux codes, sinon le code du fossile
      //  vérifierait les Pokédollars et réciproquement.
      const code = codeDepuisEmpreinte(
        await this.signataire.empreinte(
          `${evenement.type}|${sujetId}|${lue.messageId}|${joueurId}`,
        ),
      );
      await this.registre.inscrire(sujetId, joueurId, lue.messageId, evenement, code);
      ecrites.push({ sujetId, messageId: lue.messageId, joueurId, type: evenement.type });
    }
    return ecrites;
  }

  /** Ce que l'action produit. Tout le hasard est ici, et il est entièrement
   *  déterminé par l'identifiant du message. */
  private async resoudre(
    zone: ZoneSauvage,
    lue: ActionLue,
    joueurId: string,
    erreurs: string[],
  ): Promise<readonly Evenement[]> {
    if (lue.action.type === "fouiller") return await this.resoudreUneFouille(lue, zone);

    //  `lue.action` n'est plus passée : une recherche n'a plus d'argument
    //  à lire. Le type suffit, et il est déjà testé juste au-dessus.
    const un = await this.resoudreUneRecherche(zone, lue, joueurId, erreurs);
    return un === null ? [] : [un];
  }

  /** Une fouille rend UNE chose : rien, des Pokédollars, un objet, un
   *  morceau de fossile ou un fossile entier.
   *
   *  LES CINQ PARTS VIENNENT DE LA DONNÉE (`data/butin.json`), et elles
   *  font 100. Avant le 15 octobre, les Pokédollars et le fossile se
   *  tiraient séparément : une fouille pouvait donner les deux, et les
   *  deux chances de fossile vivaient dans `fossiles.json` sans que rien
   *  ne les lise contre les autres parts.
   *
   *  CE QUI RESTE DE LA RÈGLE DU 7 OCTOBRE : « n'importe où et n'importe
   *  quand ». Ni palier ni zone n'entrent dans la chance d'un fossile —
   *  les taux sont les mêmes partout. Le palier décide du montant des
   *  Pokédollars, la zone décide de QUELS objets. */
  private async resoudreUneFouille(
    lue: ActionLue,
    zone: ZoneSauvage,
  ): Promise<readonly Evenement[]> {
    //  UN SEUL TIRAGE, CINQ ISSUES. Avant le 15 octobre, les Pokédollars
    //  et le fossile se tiraient séparément, donc une fouille pouvait
    //  donner les deux. La table de butin porte maintenant les cinq
    //  parts, et elles font 100.
    const trouvaille = fouiller(
      lue.messageId,
      zone.palier,
      await this.butin.taux(),
      await this.butin.butinDe(zone.forumId),
    );

    switch (trouvaille.genre) {
      //  Bredouille : on n'inscrit RIEN. Une ligne à zéro ne dirait rien
      //  au joueur et encombrerait le registre et le module.
      case "bredouille":
        return [];

      case "pokedollars":
        return [{ type: "pokedollars", montant: trouvaille.montant }];

      //  `objet_trouve` et pas un type nouveau : la clôture sait déjà
      //  verser un objet dans un sac, et un objet de fouille n'est pas
      //  d'une autre nature qu'un morceau de fossile.
      case "objet":
        return [{ type: "objet_trouve", objetId: trouvaille.objetId, quantite: 1 }];

      case "fossile": {
        const quel = quelFossile(
          lue.messageId,
          await this.fossiles.fossiles(),
          trouvaille.entier,
        );
        //  TABLE DE FOSSILES VIDE : le tirage a dit « fossile » et il
        //  n'y en a aucun à donner. On ne remplace pas par des
        //  Pokédollars — ce serait inventer une issue que la table n'a
        //  pas tirée — et on ne lève pas : le fichier des fossiles peut
        //  être injoignable sans que la relève s'arrête (voir
        //  `adaptateurs/faune/fossiles.ts`). La fouille est donc
        //  bredouille, et le symptôme se voit : plus personne ne trouve
        //  de fossile.
        if (quel === null) return [];
        //  Le reste — trois morceaux font un fossile — se passe en base,
        //  sur `sac`, et vaut donc aussi pour un cadeau du staff ou un
        //  échange entre joueurs.
        return [{ type: "objet_trouve", objetId: quel.objetId, quantite: 1 }];
      }
    }
  }

  private async resoudreUneRecherche(
    zone: ZoneSauvage,
    lue: ActionLue,
    joueurId: string,
    erreurs: string[],
  ): Promise<Evenement | null> {
    if (!zone.aUneFaune) {
      erreurs.push(
        `message ${lue.messageId} : la zone ${zone.nom} n'a pas encore de table de faune`,
      );
      return null;
    }

    //  ── PLUS DE LIEU DU TOUT, DEPUIS LE 15 OCTOBRE ───────────────────
    //
    //  Il y en avait un, et il a changé de main deux fois le même jour :
    //  choisi par le joueur dans un menu, puis tiré par le serveur, puis
    //  supprimé. Callista : « enlève tous les petits lieux. On a 3
    //  paliers, 17 zones sauvages, et tu répartis le pokédex comme ça. »
    //
    //  La table est donc celle de la ZONE, et un ancien bloc portant un
    //  lieu est lu comme un bloc sans lieu (`domaine/action.ts`).
    const condition = conditionDeLaZone(
      tempsDuJour(jourDe(this.horloge.maintenant())),
      estLaNuit(await this.heures.heureLocaleDe(joueurId)),
      await this.faune.conditionsDe(zone.forumId),
    );

    const table = await this.faune.tableDe(zone.forumId, condition);
    if (table.length === 0) {
      erreurs.push(
        `message ${lue.messageId} : ${zone.nom} n'a pas de table « ${condition} »`,
      );
      return null;
    }

    //  LA GRAINE EST LE NUMÉRO DU MESSAGE, SEUL. Elle portait un suffixe
    //  `|lieu` pour que le lieu et l'espèce ne partagent pas la première
    //  valeur de la suite ; sans second tirage, le suffixe n'a plus
    //  d'objet. **Fixée à la seconde où le joueur poste, elle rend la
    //  rencontre rejouable à l'identique des années plus tard.**
    const rencontre = tirerUneRencontre(table, String(lue.messageId));
    return { type: "croise", especeId: rencontre.especeId };
  }
}

/** `AAAA-MM-JJ` en temps universel. La météo est tirée une fois par jour
 *  et affichée partout : elle doit être la même pour tout le monde, donc
 *  elle ne peut pas dépendre du fuseau de qui la demande. */
export function jourDe(instant: Date): string {
  return instant.toISOString().slice(0, 10);
}
