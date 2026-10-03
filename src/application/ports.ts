// ════════════════════════════════════════════════════════════════════
//  src/application/ports.ts
//  Les interfaces, et rien d'autre.
//
//  Aucune implémentation ici, aucun import d'adaptateur. Un cas d'usage
//  reçoit ces ports par son constructeur et ne sait jamais s'il parle à
//  Postgres, à Forumactif ou à un tableau en mémoire.
//
//  Ils sont volontairement FINS et séparés : la relève lit ET poste,
//  mais un futur outil de vérification ne fera que lire, et il n'aura
//  pas à feindre de savoir poster.
// ════════════════════════════════════════════════════════════════════

import type { Effets, Evenement, LigneRegistre } from "../domaine/cloture.ts";
import type { EntreeDeTable } from "../domaine/rencontre.ts";
import type { Action } from "../domaine/action.ts";

// ── le temps et le hasard, pour qu'un test puisse les figer ─────────

export interface Horloge {
  maintenant(): Date;
}

export interface Signataire {
  /** Empreinte d'un message, avec le secret du serveur. C'est elle qui
   *  rend un code de vérification infalsifiable par un joueur. */
  empreinte(message: string): Promise<Uint8Array>;
}

// ── le forum ────────────────────────────────────────────────────────

/** Ce qu'on sait d'un message en le lisant sur le forum.
 *
 *  Pas de date : Forumactif affiche « Lun 6 Sep - 10:21 », sans année.
 *  Rien de fiable n'en sort. Pas de forumId non plus : il n'est pas dans
 *  le message, et on le connaît déjà puisque c'est nous qui avons
 *  demandé la page. On ne remplit pas de champ qu'on ne sait pas lire. */
export type MessageDuForum = {
  readonly id: number;
  readonly sujetId: number;
  readonly auteurId: number;
  readonly auteurPseudo: string;
};

export type SujetRemue = {
  readonly sujetId: number;
  readonly dernierMessageId: number;
};

export interface LecteurDeForum {
  /** Les messages d'un sujet parus après un identifiant donné.
   *  `depuisMessageId` à 0 veut dire : tout le sujet. */
  messagesDuSujet(sujetId: number, depuisMessageId: number): Promise<readonly MessageDuForum[]>;

  /** Ce qui a bougé dans les forums suivis, repéré par identifiant de
   *  message et non par date : les identifiants ne reculent jamais. */
  sujetsRemues(forums: readonly number[]): Promise<readonly SujetRemue[]>;
}

/** Une demande de clôture, telle qu'un joueur l'a posée. */
export type DemandeDeClotureLue = {
  readonly sujetId: number;
  readonly messageId: number;
  readonly auteurId: number;
  readonly auteurPseudo: string;
};

/** Lire ce que les joueurs DEMANDENT. Port séparé de `LecteurDeForum` à
 *  dessein : la relève en a besoin, un futur outil de vérification qui ne
 *  fait que relire des pages n'aurait pas à feindre de savoir reconnaître
 *  une demande. */
export interface LecteurDeDemandes {
  demandesDeCloture(
    sujetId: number,
    depuisMessageId: number,
  ): Promise<readonly DemandeDeClotureLue[]>;
}

/** Une action demandée, telle qu'un joueur l'a posée en cliquant.
 *
 *  `messageId` n'est pas décoratif : c'est **la graine du tirage**. Il est
 *  fixé à la seconde où le joueur envoie, il ne recule jamais, et il rend
 *  le résultat rejouable à l'identique des années plus tard. Éditer son
 *  message ne rejoue donc rien (planche 45, règle 2). */
export type ActionLue = {
  readonly sujetId: number;
  readonly messageId: number;
  readonly auteurId: number;
  readonly auteurPseudo: string;
  readonly action: Action;
};

/** Lire ce que les joueurs FONT. Séparé de `LecteurDeDemandes` pour la
 *  même raison que celui-ci l'est de `LecteurDeForum` : une clôture et une
 *  fouille ne se lisent pas au même moment de la relève, et un outil qui
 *  rejoue un tirage contesté n'a aucune raison de savoir reconnaître une
 *  demande de clôture. */
export interface LecteurDActions {
  actionsDuSujet(
    sujetId: number,
    depuisMessageId: number,
  ): Promise<readonly ActionLue[]>;
}

export interface PosteurSurForum {
  /**
   * Publie une réponse dans un sujet, et rend l'identifiant du message.
   *
   * `code` n'est pas décoratif : l'adaptateur s'en sert pour poser son
   * marqueur dans le message. C'est ce marqueur qui lui permet, si l'envoi
   * échoue sans réponse, de relire le sujet et de savoir si le message est
   * passé malgré tout. Sans lui, une coupure réseau devient une
   * incertitude qu'un humain doit lever à la main.
   */
  repondre(
    sujetId: number,
    mentionne: string,
    corps: string,
    code: string,
  ): Promise<number>;
}

// ── le registre et l'état du jeu ────────────────────────────────────

export interface Registre {
  lignesDuSujet(sujetId: number, joueurId: string): Promise<readonly LigneRegistre[]>;
  /** Écrit une ligne. L'unicité `(messageId, type)` est garantie par la
   *  base : une seconde écriture du même événement ne lève pas, elle
   *  n'a simplement aucun effet. */
  inscrire(
    sujetId: number,
    joueurId: string,
    messageId: number,
    evenement: Evenement,
    code: string,
  ): Promise<void>;
  /** Les joueurs qui ont au moins une ligne dans ce sujet. */
  joueursDuSujet(sujetId: number): Promise<readonly string[]>;
  /** Le ménage des sujets abandonnés. Rend le nombre de lignes effacées. */
  oublier(sujetId: number): Promise<number>;
}

export type EtatDuJoueur = {
  readonly sac: ReadonlyMap<number, number>;
  readonly placesEnBoite: number;
  readonly pokedollars: number;
};

export interface EtatDuJeu {
  etatDe(joueurId: string): Promise<EtatDuJoueur>;
  /** Le pseudo du joueur. Un bilan doit nommer les gens, pas afficher
   *  leur identifiant : personne ne se reconnaît dans un UUID. */
  pseudoDe(joueurId: string): Promise<string>;
  /** Le joueur lié à un compte Forumactif, ou null s'il n'est pas lié. */
  joueurDuCompte(forumUserId: number): Promise<string | null>;
  estClos(sujetId: number): Promise<boolean>;
}

/** Une zone sauvage, telle que le forum la découpe : un forum par zone,
 *  rangé sous un forum de palier. */
export type ZoneSauvage = {
  readonly forumId: number;
  readonly nom: string;
  readonly palier: 1 | 2 | 3;
  readonly parentId: number;
  /** Faux pour les sept zones qui n'ont encore aucune table. Le dire ici
   *  plutôt que de le découvrir au premier tirage. */
  readonly aUneFaune: boolean;
};

/** La faune, telle que les annexes la décrivent vraiment : une zone n'a
 *  pas UNE table, elle a une quinzaine de lieux, et chaque lieu a ses
 *  tables par condition (jour, nuit, et parfois une météo). */
export interface Faune {
  /** Les dix-sept zones sauvages. Ailleurs, rien ne se joue. */
  zonesSauvages(): Promise<readonly ZoneSauvage[]>;
  /** Les lieux d'une zone. Vide pour une zone sans faune. */
  lieuxDe(forumId: number): Promise<readonly string[]>;
  /** Les conditions disponibles pour un lieu : « jour », « nuit », et
   *  selon les lieux « orage », « blizzard », « tempête de sable »… */
  conditionsDe(forumId: number, lieu: string): Promise<readonly string[]>;
  /** La table d'un lieu, pour une condition. Déjà vérifiée par le domaine. */
  tableDe(
    forumId: number,
    lieu: string,
    condition: string,
  ): Promise<readonly EntreeDeTable[]>;
}

// ── la trace des passages de la relève ──────────────────────────────

/** Le journal, dans la forme que la table `releve_journal` porte vraiment :
 *  une ligne par tâche et par passage, avec ce qui a été traité et ce qui a
 *  échoué. Pas de durée — la table n'en garde pas, et inventer un champ que
 *  personne n'écrit ne sert à rien. */
export interface JournalDeReleve {
  dernierPassage(tache?: string): Promise<Date | null>;
  noter(tache: string, traites: number, erreurs: readonly string[]): Promise<void>;
}

/** Le verrou de la relève. Elle tourne toutes les cinq minutes ; un passage
 *  plus lent que l'intervalle doublerait les clôtures. */
export interface Verrou {
  /** Vrai si on l'a pris. Faux si quelqu'un d'autre l'a déjà. */
  prendre(nom: string, secondes: number): Promise<boolean>;
  rendre(nom: string): Promise<void>;
}

/** Où en est la lecture de chaque forum. Les dates de Forumactif n'ont pas
 *  d'année : ce sont les identifiants de message qui servent d'horloge, et
 *  ils ne reculent jamais. */
export interface SuiviDesForums {
  dernierMessageLu(forumId: number): Promise<number>;
  avancer(forumId: number, messageId: number): Promise<void>;
}

// ── la clôture ──────────────────────────────────────────────────────

export type Versement = {
  readonly joueurId: string;
  readonly effets: Effets;
};

export interface Cloture {
  deja(sujetId: number): Promise<boolean>;
  /**
   * Applique tous les versements d'un sujet **en une seule transaction**,
   * et enregistre la clôture. Si la base refuse quoi que ce soit — un
   * stock négatif, une boîte pleine, un solde sous zéro — rien n'est
   * appliqué et l'erreur remonte.
   *
   * La vérification métier a déjà eu lieu dans le domaine ; les
   * contraintes de la base sont un filet, pas la règle.
   */
  appliquer(
    sujetId: number,
    versements: readonly Versement[],
    code: string,
    bilan: string,
    mentionne: string,
  ): Promise<void>;
}

/** Un bilan calculé, appliqué, et pas encore publié.
 *
 *  Cette file existe parce qu'appliquer et poster ne sont pas atomiques :
 *  entre les deux il y a un forum qui peut être injoignable. Le 2 octobre,
 *  un mot de passe expiré a laissé un sujet clos sans aucun bilan publié,
 *  et plus rien ne réessayait. */
export type BilanEnAttente = {
  readonly sujetId: number;
  readonly code: string;
  readonly bilan: string;
  readonly mentionne: string;
  /** Combien de fois on a déjà essayé. Un bilan qui ne passera jamais doit
   *  finir par se voir plutôt que de tourner en silence. */
  readonly essais: number;
};

export interface BilansEnAttente {
  aPoster(combien: number): Promise<readonly BilanEnAttente[]>;
  poste(sujetId: number, messageId: number): Promise<void>;
  echoue(sujetId: number, erreur: string): Promise<number>;
}

export interface Catalogue {
  /** Le nom lisible d'un objet, pour écrire un refus qu'un joueur
   *  comprend sans aller chercher un identifiant. */
  nomObjet(objetId: number): Promise<string>;
  nomEspece(especeId: number): Promise<string>;
}
