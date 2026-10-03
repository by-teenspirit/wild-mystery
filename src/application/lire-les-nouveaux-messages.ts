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
//  · **On n'échoue jamais en bloc.** Un message illisible, un joueur sans
//    fiche, une zone sans faune : chacun est noté et on continue. Une
//    action perdue est un incident ; seize actions perdues parce que la
//    première a échoué serait une panne.
// ════════════════════════════════════════════════════════════════════

import type { Action } from "../domaine/action.ts";
import type { Evenement } from "../domaine/cloture.ts";
import { codeDepuisEmpreinte } from "../domaine/code.ts";
import { fouiller } from "../domaine/fouille.ts";
import { lieuDepuisLaCle } from "../domaine/lieu.ts";
import { conditionDuLieu, estLaNuit, tempsDuJour } from "../domaine/meteo.ts";
import { tirerUneRencontre } from "../domaine/rencontre.ts";
import type {
  ActionLue,
  EtatDuJeu,
  Faune,
  Horloge,
  JournalDeReleve,
  LecteurDActions,
  Registre,
  Signataire,
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
    private readonly journal: JournalDeReleve,
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
        const ligne = await this.inscrireUneAction(zone, sujetId, lue, erreurs);
        if (ligne !== null) lignes.push(ligne);
      } catch (e) {
        //  Une action perdue n'emporte pas les suivantes : le joueur
        //  d'après n'a rien fait de mal.
        erreurs.push(`message ${lue.messageId} (sujet ${sujetId}) : ${raison(e)}`);
      }
    }

    const bilan: BilanDeLecture = { traitees: lignes.length, erreurs, lignes };
    await this.journal.noter(TACHE, bilan.traitees, erreurs);
    return bilan;
  }

  /** Rend la ligne écrite, ou null quand l'action n'avait rien à inscrire
   *  — ce qui n'est pas une erreur : une fouille bredouille est un
   *  résultat, pas une panne. */
  private async inscrireUneAction(
    zone: ZoneSauvage,
    sujetId: number,
    lue: ActionLue,
    erreurs: string[],
  ): Promise<LigneEcrite | null> {
    const joueurId = await this.jeu.joueurDuCompte(lue.auteurId);
    if (joueurId === null) {
      //  Cas normal : quelqu'un sans fiche validée a cliqué. On le dit,
      //  on n'inscrit rien, et ce n'est pas une panne de la zone.
      erreurs.push(
        `message ${lue.messageId} : ${lue.auteurPseudo} (compte ${lue.auteurId}) ` +
          `n'est lié à aucun joueur, action ignorée`,
      );
      return null;
    }

    const evenement = await this.resoudre(zone, lue, joueurId, erreurs);
    if (evenement === null) return null;

    const code = codeDepuisEmpreinte(
      await this.signataire.empreinte(
        `${evenement.type}|${sujetId}|${lue.messageId}|${joueurId}`,
      ),
    );
    await this.registre.inscrire(sujetId, joueurId, lue.messageId, evenement, code);
    return { sujetId, messageId: lue.messageId, joueurId, type: evenement.type };
  }

  /** Ce que l'action produit. Tout le hasard est ici, et il est entièrement
   *  déterminé par l'identifiant du message. */
  private async resoudre(
    zone: ZoneSauvage,
    lue: ActionLue,
    joueurId: string,
    erreurs: string[],
  ): Promise<Evenement | null> {
    if (lue.action.type === "fouiller") {
      const { pokedollars } = fouiller(lue.messageId, zone.palier);
      //  Bredouille : on n'inscrit pas une ligne à zéro. Elle ne dirait
      //  rien au joueur et encombrerait le registre et le module.
      if (pokedollars === 0) return null;
      return { type: "pokedollars", montant: pokedollars };
    }

    return await this.resoudreUneRecherche(zone, lue.action, lue, joueurId, erreurs);
  }

  private async resoudreUneRecherche(
    zone: ZoneSauvage,
    action: Extract<Action, { type: "chercher" }>,
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

    //  Le joueur a cliqué sur un lieu ; on vérifie qu'il appartient bien à
    //  CETTE zone. Sans ce contrôle, un bloc recopié d'un autre sujet
    //  ferait tirer dans la table d'ailleurs.
    const lieux = await this.faune.lieuxDe(zone.forumId);
    const lieu = lieuDepuisLaCle(action.lieu, lieux);
    if (lieu === null) {
      erreurs.push(
        `message ${lue.messageId} : « ${action.lieu} » n'est pas un lieu de ${zone.nom}`,
      );
      return null;
    }

    const condition = conditionDuLieu(
      tempsDuJour(jourDe(this.horloge.maintenant())),
      estLaNuit(await this.heures.heureLocaleDe(joueurId)),
      await this.faune.conditionsDe(zone.forumId, lieu),
    );

    const table = await this.faune.tableDe(zone.forumId, lieu, condition);
    if (table.length === 0) {
      erreurs.push(
        `message ${lue.messageId} : ${zone.nom} / ${lieu} n'a pas de table « ${condition} »`,
      );
      return null;
    }

    //  La graine mêle le message et le lieu : deux lieux cherchés dans le
    //  même message donneraient deux tirages différents. Ça n'arrive pas
    //  aujourd'hui — une action par message — mais la graine n'a pas à
    //  dépendre de cette règle-là pour être juste.
    const rencontre = tirerUneRencontre(table, `${lue.messageId}|${action.lieu}`);
    return { type: "croise", especeId: rencontre.especeId };
  }
}

/** `AAAA-MM-JJ` en temps universel. La météo est tirée une fois par jour
 *  et affichée partout : elle doit être la même pour tout le monde, donc
 *  elle ne peut pas dépendre du fuseau de qui la demande. */
export function jourDe(instant: Date): string {
  return instant.toISOString().slice(0, 10);
}
