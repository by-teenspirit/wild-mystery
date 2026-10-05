// ════════════════════════════════════════════════════════════════════
//  src/application/servir-une-commande.ts
//  Tâche 3 de la relève : la boutique.
//
//  Ce cas d'usage ORCHESTRE, comme les autres. Il ne chiffre rien : les
//  prix sont relus par `boutique_servir` dans la table `objet`, et le
//  verdict en revient tout fait. Lui lit les paniers, appelle dans le bon
//  ordre, écrit le reçu, et avance le curseur.
//
//  ── UNE COMMANDE EST LE SEUL POINT DE NON-RETOUR ─────────────────────
//
//  Débiter et poster le reçu ne sont pas atomiques. C'est EXACTEMENT le
//  problème du 2 octobre, celui qui a laissé un sujet clos sans bilan :
//  entre les deux il y a un forum qui peut être injoignable.
//
//  La clôture s'en est sortie avec une file (`bilans_en_attente`). Ici on
//  n'en crée pas, et ce n'est pas de la paresse — **le curseur EST la
//  file**. Il n'avance qu'après un reçu posté. Donc :
//
//    · un reçu qui ne part pas laisse le curseur en arrière ;
//    · la relève suivante relit le même message ;
//    · `boutique_servir` voit `message_id` déjà pris et rend `deja: true`
//      sans rien débiter une seconde fois ;
//    · l'adaptateur de publication reconnaît son marqueur si le message
//      était en fait passé, et ne duplique pas.
//
//  Trois garanties déjà payées ailleurs, remises bout à bout. Une table
//  de plus aurait été une quatrième chose à tenir à jour.
//
//  ── ON S'ARRÊTE AU PREMIER REÇU QUI NE PART PAS ──────────────────────
//
//  Contrairement à `PosterLesBilans`, qui continue sur le bilan suivant.
//  La différence est que les commandes sont ORDONNÉES par le curseur :
//  avancer par-dessus un trou, c'est perdre définitivement le reçu du
//  trou. Un bilan en file, lui, a son propre état et attend son tour.
//
//  Le joueur dont le reçu n'est pas parti n'a rien perdu : il est débité,
//  ses objets sont dans son sac, et son reçu arrivera au passage suivant.
//
//  ── UN PANIER ILLISIBLE N'ATTEINT PAS LA BASE ────────────────────────
//
//  Il n'y a rien à lui soumettre : on ne sait pas ce qu'il demande. On
//  répond, et on avance — parce que relire ce message au prochain passage
//  donnerait le même verdict et republierait le même refus. Il n'y a pas
//  d'idempotence à attendre de la base pour un panier qui ne l'atteint
//  jamais.
// ════════════════════════════════════════════════════════════════════

import { codeDepuisEmpreinte } from "../domaine/code.ts";
import { redigerLePanierIllisible, redigerLeRecu, redigerLeRefusDeCommande } from "./recu.ts";
import {
  type Boutique,
  type CommandeLue,
  type JournalDeReleve,
  type LecteurDeCommandes,
  type PosteurSurForum,
  type Signataire,
  type SuiviDesForums,
} from "./ports.ts";

export const TACHE = "boutique";

/** Levée par l'adaptateur quand le compte Forumactif n'est lié à aucune
 *  fiche de joueur.
 *
 *  ELLE VIT ICI, et pas dans `ports.ts`, parce que ce n'est pas une
 *  interface : c'est la décision de cette tâche. Un compte non lié n'est
 *  ni un refus — il n'y a pas de joueur à qui écrire une commande
 *  refusée — ni une panne : le relancer toutes les cinq minutes ne le
 *  lierait pas davantage. On répond une fois, et on avance. */
export class CompteNonLie extends Error {
  constructor(readonly forumUserId: number) {
    super(`Le compte Forumactif ${forumUserId} n'est lié à aucun joueur.`);
    this.name = "CompteNonLie";
  }
}

/** Un comptoir : le sujet où l'on commande, et le forum qui le porte.
 *
 *  DEUX CHAMPS ET PAS UN, parce que le curseur de `SuiviDesForums` est
 *  tenu par forum. Le sujet dit où lire, le forum dit où se souvenir.
 *
 *  C'est une donnée de configuration, pas une constante : le module de
 *  boutique côté navigateur se reconnaît à `.wm-boutique` et jamais à
 *  `t977` (voir son en-tête), et cette tâche garde la même propriété.
 *  Callista peut ouvrir un second comptoir — une boutique saisonnière, un
 *  stand d'évent — sans qu'on touche au code. */
export type Comptoir = {
  readonly sujetId: number;
  readonly forumId: number;
};

export type CommandeServie = {
  readonly messageId: number;
  readonly pseudo: string;
  readonly commandeId: string;
  readonly total: number;
  /** Vrai si la base avait déjà servi ce message : on n'a reposté que le
   *  reçu. Compté à part, sinon un incident réseau gonflerait les
   *  statistiques de vente du journal. */
  readonly deja: boolean;
};

export type CommandeRefusee = {
  readonly messageId: number;
  readonly pseudo: string;
  readonly motif: string;
};

export type PassageDeBoutique = {
  readonly servies: readonly CommandeServie[];
  readonly refusees: readonly CommandeRefusee[];
  readonly erreurs: readonly string[];
};

function raison(e: unknown): string {
  return e instanceof Error ? `${e.name} : ${e.message}` : String(e);
}

export class ServirUneCommande {
  constructor(
    private readonly lecteur: LecteurDeCommandes,
    private readonly boutique: Boutique,
    private readonly forum: PosteurSurForum,
    private readonly suivi: SuiviDesForums,
    private readonly journal: JournalDeReleve,
    private readonly signataire: Signataire,
  ) {}

  async executer(comptoir: Comptoir): Promise<PassageDeBoutique> {
    const servies: CommandeServie[] = [];
    const refusees: CommandeRefusee[] = [];
    const erreurs: string[] = [];

    const depuis = await this.suivi.dernierMessageLu(comptoir.forumId);
    const commandes = [...await this.lecteur.commandesDuSujet(comptoir.sujetId, depuis)]
      //  L'ORDRE EST LA SEULE CHOSE QUI COMPTE ICI. Le curseur avance
      //  message par message ; traiter le 15 552 avant le 15 551
      //  perdrait le second pour toujours.
      .sort((a, b) => a.messageId - b.messageId);

    for (const commande of commandes) {
      try {
        await this.traiter(comptoir, commande, servies, refusees);
      } catch (e) {
        //  On s'arrête, et le curseur reste où il est : voir l'en-tête.
        erreurs.push(
          `commande du message ${commande.messageId} ` +
            `(${commande.auteurPseudo}) : ${raison(e)}`,
        );
        break;
      }
      await this.suivi.avancer(comptoir.forumId, commande.messageId);
    }

    await this.journal.noter(TACHE, servies.length + refusees.length, erreurs);
    return { servies, refusees, erreurs };
  }

  /** Une commande, de bout en bout. Lève si quoi que ce soit échoue —
   *  c'est `executer` qui décide d'arrêter. */
  private async traiter(
    comptoir: Comptoir,
    commande: CommandeLue,
    servies: CommandeServie[],
    refusees: CommandeRefusee[],
  ): Promise<void> {
    const { messageId, auteurPseudo } = commande;

    //  Le code est dérivé du MESSAGE, donc stable : un reposté après
    //  incident porte le même code que celui qui n'était pas parti. Sans
    //  ça, le marqueur de l'adaptateur ne reconnaîtrait pas son propre
    //  message et on en publierait deux.
    const code = codeDepuisEmpreinte(
      await this.signataire.empreinte(`commande|${messageId}`),
    );

    if (commande.panier.type === "illisible") {
      await this.forum.repondre(
        comptoir.sujetId,
        auteurPseudo,
        redigerLePanierIllisible(auteurPseudo, commande.panier.motif, code),
        code,
      );
      refusees.push({ messageId, pseudo: auteurPseudo, motif: "ILLISIBLE" });
      return;
    }

    let verdict;
    try {
      verdict = await this.boutique.servir({
        messageId,
        forumUserId: commande.auteurId,
        lignes: commande.panier.lignes,
        code,
      });
    } catch (e) {
      //  UN COMPTE NON LIÉ N'EST PAS UNE PANNE. Il n'y a pas de joueur à
      //  qui écrire une commande refusée, mais il y a bien quelqu'un à
      //  qui répondre — et le relancer à chaque passage ne le lierait pas
      //  davantage. On répond, on avance.
      if (e instanceof CompteNonLie) {
        await this.forum.repondre(
          comptoir.sujetId,
          auteurPseudo,
          redigerLeRefusDeCommande(
            auteurPseudo,
            "Ce compte du forum n'est rattaché à aucune fiche de joueur. " +
              "Lie-le d'abord, puis renvoie le panier.",
            code,
          ),
          code,
        );
        refusees.push({ messageId, pseudo: auteurPseudo, motif: "COMPTE_NON_LIE" });
        return;
      }
      throw e;
    }

    if (verdict.etat === "refusee") {
      await this.forum.repondre(
        comptoir.sujetId,
        auteurPseudo,
        redigerLeRefusDeCommande(auteurPseudo, verdict.detail, code),
        code,
      );
      refusees.push({ messageId, pseudo: auteurPseudo, motif: verdict.motif });
      return;
    }

    await this.forum.repondre(
      comptoir.sujetId,
      auteurPseudo,
      redigerLeRecu(
        {
          pseudo: auteurPseudo,
          lignes: verdict.lignes,
          total: verdict.total,
          solde: verdict.solde,
        },
        code,
      ),
      code,
    );
    servies.push({
      messageId,
      pseudo: auteurPseudo,
      commandeId: verdict.commandeId,
      total: verdict.total,
      deja: verdict.deja,
    });
  }
}
