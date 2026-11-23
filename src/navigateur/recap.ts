// ════════════════════════════════════════════════════════════════════
//  src/navigateur/recap.ts
//
//  Ce que le récapitulatif latéral montre. Pur : aucun DOM, aucun
//  `fetch` — on reçoit ce que la base a rendu, on rend des blocs
//  prêts à dessiner.
//
//  « Ce serait cool d'avoir le bilan du sujet qui nous suit, en petit
//  récap à droite ou à gauche, en vertical, pour savoir où on en est,
//  en tout temps », puis : « à chaque fois qu'une action est faite, en
//  plus d'avoir les pokémons, il faudrait une récap de son équipe et
//  le combat en cours. »
//
//  ── TROIS BLOCS, ET LEUR ORDRE EST CELUI DE L'URGENCE ───────────────
//
//  1. LE COMBAT, s'il y en a un. C'est ce qui attend une réponse.
//  2. L'ÉQUIPE et ses PV. C'est ce qui décide de la réponse.
//  3. CE QUE LE SUJET A RAPPORTÉ. C'est ce qu'on regarde quand il n'y
//     a rien à décider.
//
//  Un bloc vide ne se dessine pas : un récapitulatif qui montrerait
//  trois cadres vides sur un sujet neuf prendrait de la place sans
//  rien dire.
//
//  ── IL NE RECALCULE RIEN ────────────────────────────────────────────
//
//  Les PV viennent de `mon_sujet`, les rubriques de `rubriquesEnAttente`
//  — la même fonction que le module au-dessus du premier message et
//  que le bilan posté. Trois endroits qui compteraient chacun de leur
//  côté finiraient par annoncer trois totaux.
// ════════════════════════════════════════════════════════════════════

import { type LigneEnAttente, rubriquesEnAttente } from "../application/bilan.ts";

/** Un Pokémon de l'équipe, tel que `mon_sujet` le rend. */
export type MembreDuRecap = {
  readonly position: number | null;
  readonly especeId: number;
  readonly nom: string;
  readonly surnom: string | null;
  readonly niveau: number;
  readonly pv: number;
  readonly pvMax: number;
  /** Celui qui se bat en ce moment. La base le dit ; on ne le devine
   *  pas depuis les PV, qui peuvent coïncider. */
  readonly combat: boolean;
};

export type CombatDuRecap = {
  readonly tour: number;
  readonly sauvage: {
    readonly especeId: number;
    readonly nom: string;
    readonly niveau: number;
    readonly types: readonly string[];
    readonly pv: number;
    readonly pvMax: number;
  };
  /** `null` quand l'équipe est vide — planche 99 §5.3 : la rencontre
   *  reste une rencontre, et la ball se lance quand même. */
  readonly pvPokemon: number | null;
  readonly pvPokemonMax: number | null;
};

/** Une ligne du sac, telle que `mon_sujet` la rend.
 *
 *  LE NOM ET LA FAMILLE VIENNENT DE LA BASE, et pas du catalogue : le
 *  carnet, lui, a son catalogue sous la main et s'en sert. Une page de
 *  sujet n'en a pas, et aller le chercher pour trois lignes coûterait
 *  une requête de plus sur chaque sujet du forum. */
export type LigneDuSac = {
  readonly objetId: number;
  readonly nom: string;
  readonly famille: string;
  readonly quantite: number;
};

/** Le dernier combat CLOS de ce sujet, quand il n'y en a pas d'ouvert.
 *
 *  « Il devrait dire [...] qui je viens de capturer » — 23 novembre.
 *
 *  LA CAPTURE FERME LE COMBAT, donc la ligne ouverte disparaît à la
 *  seconde où elle réussit, et le panneau se taisait sur le moment le
 *  plus intéressant du sujet. Celui-ci prend le relais, et il le
 *  prend TOUT DE SUITE : la relève n'a pas encore écrit sa ligne de
 *  registre, mais le combat, lui, est déjà clos. */
export type CombatFini = {
  readonly etat: "capture" | "fuite" | "victoire" | "defaite" | "expire";
  readonly especeId: number;
  readonly nom: string;
  readonly niveau: number;
  readonly types: readonly string[];
};

export type MonSujet = {
  readonly equipe: readonly MembreDuRecap[];
  readonly combat: CombatDuRecap | null;
  /** FACULTATIF, et ce n'est pas une négligence : la migration qui
   *  l'ajoute (0057) peut ne pas être encore déployée quand ce code
   *  l'est. Un récapitulatif qui lèverait là-dessus effacerait aussi
   *  l'équipe et le combat, qui, eux, sont bien là. */
  readonly sac?: readonly LigneDuSac[];
  /** Facultatif pour la même raison, et elle a servi : la 0069
   *  l'ajoute, et le paquet part avant le `supabase db push`. */
  readonly fini?: CombatFini | null;
};

/** Une section du sac : une famille, son titre, ses lignes. */
export type SectionDuSac = {
  readonly famille: string;
  readonly titre: string;
  readonly lignes: readonly LigneDuSac[];
};

/*  LES TITRES SONT CEUX DU CARNET, repris de `FAMILLES_DU_SAC`. Un
    joueur ne doit pas lire « Pour attraper » dans son carnet et
    « Balls » dans le sujet pour la même étagère. L'ordre aussi est le
    sien : les balls d'abord, les fossiles en dernier. */
const FAMILLES: readonly (readonly [string, string])[] = [
  ["ball", "Pour attraper"],
  ["soin", "Pour soigner"],
  ["statut", "Contre les statuts"],
  ["rappel", "Pour ranimer"],
  ["evolution", "Les cailloux étranges"],
  ["tenu", "À faire tenir"],
  ["fossile", "Les fossiles"],
];

/** Le sac rangé par étagère.
 *
 *  UNE FAMILLE QU'ON NE CONNAÎT PAS N'EST PAS JETÉE : elle finit dans
 *  une section à part plutôt que de disparaître du sac. Un objet qu'on
 *  possède et qui ne s'affiche nulle part est pire qu'un titre
 *  approximatif — on le chercherait dans le carnet, où il serait. */
export function sacDuRecap(sac: readonly LigneDuSac[]): readonly SectionDuSac[] {
  const sections: SectionDuSac[] = [];
  const vues = new Set<string>();
  for (const [famille, titre] of FAMILLES) {
    vues.add(famille);
    const lignes = sac.filter((l) => l.famille === famille && l.quantite > 0);
    if (lignes.length > 0) sections.push({ famille, titre, lignes });
  }
  const reste = sac.filter((l) => !vues.has(l.famille) && l.quantite > 0);
  if (reste.length > 0) sections.push({ famille: "inconnu", titre: "Le reste", lignes: reste });
  return sections;
}

/** Le nom affiché d'un Pokémon : son surnom, l'espèce entre
 *  parenthèses. La même règle que les messages du Maître du Jeu — un
 *  joueur ne doit pas lire deux noms pour un même Pokémon selon
 *  l'endroit où il regarde. */
export function nomDuMembre(m: MembreDuRecap): string {
  const propre = m.surnom?.trim();
  return propre ? `${propre} (${m.nom})` : m.nom;
}

/** La part de PV restants, de 0 à 100.
 *
 *  BORNÉE DES DEUX CÔTÉS. Une jauge à 140 % sortirait du cadre et on
 *  chercherait le défaut dans le CSS ; une jauge négative disparaîtrait
 *  sans qu'on sache pourquoi. */
export function partDePv(pv: number, pvMax: number): number {
  if (!Number.isFinite(pv) || !Number.isFinite(pvMax) || pvMax <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((pv / pvMax) * 100)));
}

/** L'état d'un Pokémon, en un mot — pour la couleur de sa jauge.
 *
 *  LES SEUILS SONT CEUX DES JEUX : le vert jusqu'à la moitié, l'orange
 *  jusqu'au cinquième, le rouge en dessous. Un joueur qui a joué à un
 *  Pokémon les lit sans les apprendre.
 *
 *  `terre` est à part : zéro PV n'est pas « presque mort », c'est une
 *  case qui ne peut plus se battre, et la différence décide d'un tour. */
export type EtatDePv = "terre" | "critique" | "entame" | "bien";

export function etatDePv(pv: number, pvMax: number): EtatDePv {
  if (pv <= 0) return "terre";
  const part = partDePv(pv, pvMax);
  if (part <= 20) return "critique";
  if (part <= 50) return "entame";
  return "bien";
}

/** Où poser le panneau, et s'il y a la place de le poser.
 *
 *  ── ON MESURE LES MESSAGES, PAS L'ÉCRAN ────────────────────────────
 *
 *  « Pas besoin de mesurer l'écran, tu l'accroches à ça » — 18
 *  novembre, avec le code de la page d'un sujet. C'est le bord droit de
 *  la colonne des messages qui décide : le panneau se pose à `ecart`
 *  de là, et il ne se pose pas si ce qui reste à droite ne suffit pas.
 *
 *  CE QUI DISPARAÎT AVEC ÇA : le seuil de 1 700 px, qui était un
 *  nombre calculé à la main depuis la largeur du forum et qu'il fallait
 *  recalculer à chaque fois qu'elle changeait. Ici, rien à recalculer —
 *  si le forum rétrécit, le panneau se pose plus tôt, tout seul.
 *
 *  `fenetre` est la largeur de la fenêtre, et c'est la SEULE chose que
 *  l'écran dise encore : il faut bien savoir ce qui reste à droite des
 *  messages. Mais elle ne décide plus de rien seule. */
export type Ancre = { readonly droite: number };

export function placementDuRecap(
  ancre: Ancre | null,
  fenetre: number,
  largeur: number,
  ecart: number,
): { readonly pose: boolean; readonly gauche: number } {
  if (ancre === null || !Number.isFinite(ancre.droite) || !Number.isFinite(fenetre)) {
    return { pose: false, gauche: 0 };
  }
  const gauche = Math.round(ancre.droite + ecart);
  //  IL FAUT L'ÉCART DES DEUX CÔTÉS : celui entre les messages et le
  //  panneau, et celui entre le panneau et le bord. Sans le second, le
  //  panneau toucherait le bord de l'écran sur les largeurs justes.
  return { pose: gauche + largeur + ecart <= fenetre, gauche };
}

/*  ── ET QUAND IL N'Y A PAS LA PLACE : UN TIROIR ────────────────────
 *
 *  Mesuré le 18 novembre : le forum fait 1 200 px, le panneau en
 *  demande 216 plus 16 de chaque côté, donc il faut 1 696 px de
 *  fenêtre. Sur un portable de 1 440, le panneau ne se posait JAMAIS —
 *  et personne ne pouvait le deviner, puisqu'il s'effaçait en silence.
 *
 *  « Un onglet qui se déplie », 18 novembre. Le panneau existe donc
 *  toujours ; c'est son ÉTAT qui change :
 *
 *    · de la place à droite des messages → ouvert, collé à eux ;
 *    · pas la place → replié contre le bord, une languette dépasse.
 *
 *  LE CHOIX DE LA PERSONNE PASSE AVANT LA MESURE. Qui a replié le
 *  panneau sur un grand écran le retrouve replié ; qui l'a déplié sur
 *  un portable le retrouve déplié. La mesure ne décide que du PREMIER
 *  affichage, quand il n'y a encore rien à respecter. */
export type EtatDuRecap = {
  /** À quoi il s'accroche : au bord des messages, ou au bord de la
   *  fenêtre quand il n'y a pas la place. */
  readonly contre: "messages" | "bord";
  readonly gauche: number;
  readonly ouvert: boolean;
};

export function etatDuRecap(
  ancre: Ancre | null,
  fenetre: number,
  largeur: number,
  ecart: number,
  /** Ce que la personne a choisi la dernière fois, ou `null` si elle
   *  n'a jamais touché à la languette. */
  voulu: boolean | null,
): EtatDuRecap {
  const { pose, gauche } = placementDuRecap(ancre, fenetre, largeur, ecart);
  return {
    contre: pose ? "messages" : "bord",
    gauche,
    //  SANS CHOIX, LA PLACE DÉCIDE : ouvert là où il ne gêne personne,
    //  replié là où il couvrirait le texte.
    ouvert: voulu ?? pose,
  };
}

/** Le titre du bloc en cours.
 *
 *  ── LE TOUR ZÉRO EST UNE RENCONTRE, PAS UN COMBAT ─────────────────
 *
 *  « Il devrait dire si je suis en pleine rencontre, en plein
 *  combat. » La distinction existait déjà en base depuis la 0046 —
 *  « zéro, c'est la carte de rencontre : elle est postée, personne
 *  n'a encore agi » — et personne ne la lisait : le panneau écrivait
 *  « Combat · tour 0 », ce qui décrit mal une bête qu'on vient
 *  d'apercevoir et qu'on peut encore laisser filer. */
export function titreDuCombat(tour: number): string {
  return tour <= 0 ? "Rencontre" : `Combat · tour ${tour}`;
}

/** Le titre du bloc de ce qui vient de se passer.
 *
 *  ON DIT LE RÉSULTAT, PAS « COMBAT TERMINÉ ». Capturé, enfui, battu :
 *  ce sont trois fins différentes, et c'est la seule chose qu'on vient
 *  vérifier dans le panneau. */
export function titreDeLaFin(etat: CombatFini["etat"]): string {
  switch (etat) {
    case "capture":
      return "Capturé";
    case "fuite":
      return "Il s'est enfui";
    case "victoire":
      return "Mis K.O.";
    case "defaite":
      return "Mon Pokémon est K.O.";
    case "expire":
      return "La rencontre a tourné court";
  }
}

/** Un bloc du récapitulatif, prêt à dessiner. */
export type BlocDuRecap =
  | { readonly quoi: "combat"; readonly combat: CombatDuRecap }
  | { readonly quoi: "fini"; readonly fini: CombatFini }
  | { readonly quoi: "equipe"; readonly equipe: readonly MembreDuRecap[] }
  | { readonly quoi: "sac"; readonly sections: readonly SectionDuSac[] }
  | {
    readonly quoi: "gains";
    readonly rubriques: readonly { readonly etiquette: string; readonly valeur: string }[];
  }
  /** La lecture privée n'a rien rendu : carnet non relié, jeton
   *  périmé, réseau coupé. Un bloc à part plutôt qu'une absence —
   *  voir `blocsDuRecap`. */
  | { readonly quoi: "carnet" };

/** Les blocs à dessiner, dans l'ordre, pour ce joueur et ce sujet.
 *
 *  `mien` est la ligne de bilan du joueur connecté — celle que le
 *  module au-dessus du premier message calcule déjà. `null` quand il
 *  n'a encore rien fait dans ce sujet, ce qui est le cas de tout le
 *  monde au premier message.
 *
 *  REND UN TABLEAU VIDE QUAND IL N'Y A RIEN À MONTRER, et l'appelant
 *  ne pose alors pas le récapitulatif : un cadre vide collé au bord
 *  de l'écran est une gêne, pas une information. */
export function blocsDuRecap(
  sujet: MonSujet | null,
  mien: LigneEnAttente | null,
): readonly BlocDuRecap[] {
  const blocs: BlocDuRecap[] = [];
  //  ── UN CARNET NON RELIÉ SE DIT, IL NE DISPARAÎT PAS ─────────────
  //
  //  « Je ne vois toujours pas le récap à droite ou à gauche que tu
  //  devais mettre » — trois fois en deux jours, les 17 et 18
  //  novembre. Il était bien là, dans le paquet, mesuré par le
  //  harnais : simplement `mon_sujet` ne rendait rien, et un
  //  récapitulatif sans contenu se retirait. En silence.
  //
  //  C'EST LA MÊME FAUTE QUE LES BOUTONS DE COMBAT, et elle a la même
  //  réponse : `sujet === null` ne veut pas dire « rien à montrer »,
  //  ça veut dire « on n'a pas pu lire ». Un joueur dont l'équipe est
  //  vide reçoit un objet avec des listes vides, pas `null`.
  if (sujet === null) return [{ quoi: "carnet" }];
  //  `?? null` PLUTÔT QU'UN TEST LÂCHE : la clé est facultative, donc
  //  elle peut être absente ou nulle, et le dépôt interdit `!=`. Une
  //  variable règle les deux cas d'un coup et porte le rétrécissement
  //  de type jusqu'à la poussée.
  const fini = sujet.fini ?? null;
  if (sujet !== null && sujet.combat !== null) {
    blocs.push({ quoi: "combat", combat: sujet.combat });
  } else if (fini !== null) {
    //  ── L'UN OU L'AUTRE, JAMAIS LES DEUX ──────────────────────────
    //
    //  La base ne rend `fini` que faute de combat ouvert, et le `else`
    //  le redit ici. Les montrer ensemble ferait lire « tu es en
    //  combat » et « tu viens de capturer » dans la même colonne, pour
    //  deux Pokémon différents.
    blocs.push({ quoi: "fini", fini });
  }
  if (sujet !== null && sujet.equipe.length > 0) {
    blocs.push({ quoi: "equipe", equipe: sujet.equipe });
  }
  //  ── LE SAC VIENT APRÈS L'ÉQUIPE, ET AVANT LES GAINS ─────────────
  //
  //  « Pour savoir ce qu'elle a, à l'instant T » — 18 novembre. C'est
  //  une information qui DÉCIDE, comme l'équipe : on regarde ses
  //  balls avant d'écrire qu'on en lance une. Les gains, eux, se
  //  regardent quand il n'y a plus rien à décider.
  //
  //  UN SAC VIDE NE SE DESSINE PAS, comme les autres blocs. Mais
  //  « vide » veut dire « la base a dit zéro objet », pas « la base
  //  n'a pas répondu » : les deux se ressemblent et ne se disent pas
  //  pareil.
  const sections = sacDuRecap(sujet.sac ?? []);
  if (sections.length > 0) blocs.push({ quoi: "sac", sections });
  const rubriques = mien === null ? [] : rubriquesEnAttente(mien);
  if (rubriques.length > 0) blocs.push({ quoi: "gains", rubriques });
  return blocs;
}
