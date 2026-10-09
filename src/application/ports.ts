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
import type { Fossile, ReglesDeFossile } from "../domaine/fossile.ts";
import type { Action } from "../domaine/action.ts";
import type { LecturePanier, LignePanier } from "../domaine/panier.ts";

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
/** Ce que la relève a besoin de savoir des fossiles.
 *
 *  La table vit dans `data/fossiles.json`, comme les zones et les
 *  comptoirs : c'est de la donnée de jeu, elle change par un `git push`
 *  et pas par un déploiement. L'adaptateur est
 *  `src/adaptateurs/faune/fossiles.ts`.
 *
 *  UNE TABLE VIDE EST UNE RÉPONSE VALIDE, pas une panne : le domaine
 *  rend alors `null` à chaque fouille, ce qui est le cas normal et de
 *  très loin le plus fréquent. */
export interface TableDesFossiles {
  fossiles(): Promise<readonly Fossile[]>;
  regles(): Promise<ReglesDeFossile>;
}

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

// ── la boutique ─────────────────────────────────────────────────────

/** Un panier posé par un joueur, tel qu'on le lit dans son message.
 *
 *  `panier` est le type du domaine, moins le cas « aucun » : un message
 *  sans bloc n'est pas une commande et n'apparaît jamais ici. Un bloc
 *  ILLISIBLE, lui, apparaît — c'est une commande qu'il faut refuser avec
 *  un motif, pas un message à ignorer (voir l'en-tête de `panier.ts`). */
export type CommandeLue = {
  readonly sujetId: number;
  readonly messageId: number;
  readonly auteurId: number;
  readonly auteurPseudo: string;
  readonly panier: Exclude<LecturePanier, { readonly type: "aucun" }>;
};

export interface LecteurDeCommandes {
  commandesDuSujet(
    sujetId: number,
    depuisMessageId: number,
  ): Promise<readonly CommandeLue[]>;
}

/** Ce que la base répond quand on lui soumet un panier.
 *
 *  UN REFUS EST UNE VALEUR, PAS UNE EXCEPTION. C'est la forme de
 *  `boutique_servir` (migration 0011) et elle n'est pas gratuite : un
 *  `raise` annule la transaction, donc le `etat='refusee'` avec lui, et
 *  un refus qui s'efface est un refus que la relève repasse à chaque
 *  passage pour l'éternité. Seul l'impossible lève.
 *
 *  `deja` dit que ce message avait déjà été traité. La relève ne tient
 *  aucun état pour le savoir : `commande.message_id` est unique, et un
 *  identifiant de message ne recule jamais. */
export type VerdictDeCommande =
  | {
    readonly etat: "servie";
    readonly commandeId: string;
    readonly total: number;
    readonly solde: number;
    readonly deja: boolean;
    readonly lignes: readonly LigneFacturee[];
  }
  | {
    readonly etat: "refusee";
    readonly commandeId: string;
    readonly motif: string;
    /** Écrit pour être recopié tel quel dans la réponse au joueur. */
    readonly detail: string;
    readonly total: number;
    readonly solde: number;
    readonly deja: boolean;
  };

/** Une ligne telle que la BASE l'a chiffrée. Le prix vient de la table
 *  `objet`, jamais du bloc : c'est toute la raison d'être de la planche
 *  30 — « la vérité est côté serveur ». */
export type LigneFacturee = {
  readonly objetId: number;
  readonly nom: string;
  readonly quantite: number;
  readonly prix: number;
  readonly sousTotal: number;
};

/** `CompteNonLie` vit dans `servir-une-commande.ts` : ce fichier ne
 *  porte que des interfaces et des types, et une classe y serait du code
 *  exécutable dans un fichier qui promet de n'en avoir aucun. */

export interface Boutique {
  /** Soumet un panier. Idempotent par `messageId`. */
  servir(demande: {
    readonly messageId: number;
    readonly forumUserId: number;
    readonly lignes: readonly LignePanier[];
    readonly code: string;
  }): Promise<VerdictDeCommande>;
}

// ── les fossiles ────────────────────────────────────────────────────

/** Une demande de résurrection qui attend sa réponse.
 *
 *  `sujetId` VIENT DE LA LIGNE, pas d'une configuration : la réponse
 *  part là où la demande a été faite. C'est ce qui permet à cette tâche
 *  de n'avoir aucun réglage — pas de `data/laboratoires.json`, pas de
 *  curseur partagé, et un second laboratoire ne demande aucun code.
 *
 *  `messageId` est celui du message où le joueur a demandé. C'est la clé
 *  d'unicité de la table : un identifiant de message ne recule jamais,
 *  donc deux passages ne peuvent pas créer deux analyses pour la même
 *  demande.
 *
 *  `code` est déjà en base — il a été posé par la demande. On ne le
 *  redérive pas ici : un code recalculé à l'annonce ne serait plus celui
 *  qu'un repassage retrouverait, et le marqueur de l'adaptateur de
 *  publication ne reconnaîtrait pas son propre message. */
export type AnalyseAAnnoncer = {
  readonly analyseId: string;
  readonly sujetId: number;
  readonly messageId: number;
  readonly pseudo: string;
  /** Le nom de l'objet. Un message nomme les choses ; personne ne
   *  reconnaît son fossile dans un identifiant de catalogue. */
  readonly fossile: string;
  readonly code: string;
  readonly essais: number;
};

/** Ce que `rendre_fossile` (migrations `0016` puis `0017`) répond.
 *
 *  TROIS ÉTATS, ET LE TROISIÈME N'EST PAS UN REFUS. C'est la
 *  distinction que `0013` a introduite et qu'il ne faut pas perdre :
 *
 *  · `rendue` — le pokémon est né, le fossile est consommé ;
 *  · `refusee` — le joueur n'a plus le fossile. **Sa faute, écrite en
 *    base, définitive** : l'analyse ne repassera pas ;
 *  · `impossible` — aucune espèce n'est rattachée à ce fossile. **Notre
 *    donnée qui manque**, pas la sienne. L'analyse reste en attente et
 *    rien n'est consommé : elle repartira toute seule le jour où la
 *    ligne existera.
 *
 *  Confondre les deux derniers coûterait un pokémon à un joueur qui
 *  n'a rien fait de mal. */
export type VerdictDeFossile =
  | {
    readonly etat: "rendue";
    readonly analyseId: string;
    readonly especeId: number;
    readonly espece: string;
    /** Vrai si la base avait déjà rendu ce verdict et vient de le
     *  rejouer : on ne fait que reposter l'annonce. Compté à part,
     *  sinon une coupure réseau gonflerait le compte des réanimations
     *  dans le journal. */
    readonly deja: boolean;
  }
  | {
    readonly etat: "refusee";
    readonly analyseId: string;
    readonly motif: string;
    /** Écrit pour être recopié tel quel dans la réponse au joueur. */
    readonly detail: string;
    readonly deja: boolean;
  }
  | {
    readonly etat: "impossible";
    readonly analyseId: string;
    readonly motif: string;
    readonly detail: string;
  };

export interface Fossiles {
  /** Les analyses qui attendent une réponse, **les plus anciennes
   *  d'abord**. Celles qui ne sont pas encore tranchées comme celles
   *  dont le message n'est pas parti : c'est la même question, et le
   *  cas d'usage n'a donc qu'un chemin.
   *
   *  La limite borne un passage : une file qui a grossi se résorbe sur
   *  plusieurs passages plutôt que de faire expirer celui-ci. */
  aAnnoncer(limite: number): Promise<readonly AnalyseAAnnoncer[]>;
  /** Tranche l'analyse, ou rejoue le verdict déjà rendu. **Idempotente
   *  depuis `0017`** : le verdict est gardé dans la ligne, et un second
   *  appel le rend à l'identique sans rien consommer. C'est ce qui rend
   *  l'annonce repassable. */
  rendre(analyseId: string): Promise<VerdictDeFossile>;
  /** Le joueur est prévenu : l'analyse quitte la file. */
  annoncee(analyseId: string, messageId: number): Promise<void>;
  /** L'annonce n'est pas partie. Rend le nombre d'essais, pour qu'une
   *  file bloquée finisse par se voir. */
  echouee(analyseId: string, erreur: string): Promise<number>;
}

// ── le pokédex ──────────────────────────────────────────────────────

/** Remettre le pokédex d'accord avec le registre des sujets clôturés.
 *
 *  CE N'EST PAS LUI QUI LE REMPLIT. `appliquer_cloture` écrit le pokédex
 *  dans la transaction de la clôture, donc en régime normal il n'y a
 *  **rien à corriger** et le compte rendu est zéro.
 *
 *  Un nombre non nul est donc un SIGNAL, pas un travail accompli : une
 *  clôture d'avant ce comportement, une ligne de registre reprise à la
 *  main, ou un bogue. */
export interface Pokedex {
  /** Rend le nombre de lignes réellement corrigées. Zéro est la réponse
   *  attendue. */
  ranger(): Promise<number>;
}

export interface Catalogue {
  /** Le nom lisible d'un objet, pour écrire un refus qu'un joueur
   *  comprend sans aller chercher un identifiant. */
  nomObjet(objetId: number): Promise<string>;
  nomEspece(especeId: number): Promise<string>;
}
