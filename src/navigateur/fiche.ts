// ════════════════════════════════════════════════════════════════════
//  La fiche de présentation — ce qu'elle contient, ce qu'elle publie,
//  et comment on la relit.
//
//  « Normalement, quand on crée un sujet [dans Présentations] ça
//  remplit un formulaire HTML. Et d'ailleurs quand on édite son
//  message, ce serait super que ça reste comme ça. » — 23 novembre.
//
//  ── LA SECONDE PHRASE COMMANDE TOUT LE FICHIER ──────────────────────
//
//  Un formulaire qui écrit un message, n'importe qui l'écrit. Un
//  formulaire qui SE RELIT dans le message qu'il a écrit demande que le
//  message publié soit lisible par une machine — et ça, ça se décide
//  avant d'écrire la première ligne, pas après.
//
//  **LE MESSAGE PUBLIÉ EST LE SEUL ENTREPÔT.** Rien n'est gardé en
//  base, rien dans `localStorage`. La fiche appartient au joueur : il
//  peut la retoucher à la main, la déplacer, la citer. Si on gardait
//  une copie ailleurs, les deux divergeraient le premier jour où
//  quelqu'un corrige une faute de frappe dans son sujet.
//
//  C'est le même choix que la fiche de liens du carnet (`33-…`, § 4) :
//  « le carnet est l'éditeur, le sujet est la publication ». Ici
//  l'éditeur est la page de réponse elle-même, parce que c'est là
//  qu'elle l'a demandé.
//
//  ── POURQUOI UNE BALISE PAR CHAMP, ET PAS UN ATTRIBUT ───────────────
//
//  Il faut retrouver chaque valeur dans le HTML publié. Trois routes :
//
//   1. `data-champ="surnom"` — le plus propre à lire, et **non
//      vérifié** : je n'ai pas pu ouvrir la page de réponse du forum
//      pour m'assurer que Forumactif laisse passer les attributs
//      `data-`. Parier là-dessus, c'est livrer une fiche qui ne se
//      relit pas.
//   2. Une classe — `class="bk1"` traverse, l'ancienne fiche le prouve.
//      Mais une classe se perd au copier-coller entre deux fiches, et
//      elle se confond avec celles de la mise en page.
//   3. **Une balise par champ** — `<wmf-surnom>…</wmf-surnom>`.
//      L'ancienne fiche emploie déjà `<y>`, `<x>`, `<tw>`, `<ifn>`,
//      `<iat>` : ces balises-là traversent, mesurées dans le sujet t50.
//
//  C'est la troisième. Elle a un second avantage, décisif ici : **elle
//  se lit sans DOM.** Le dépôt n'embarque aucun analyseur HTML — pas de
//  dépendance réseau, c'est la règle — donc une lecture par DOM ne
//  serait testable que dans un navigateur, et l'aller-retour est
//  précisément ce qui doit être prouvé sans en ouvrir un.
//
//  Et le contenu du joueur peut contenir n'importe quoi : du gras, des
//  sauts de ligne, des balises à lui. Une balise unique par champ rend
//  la fermeture non ambiguë — personne n'écrit `</wmf-surnom>` dans son
//  histoire.
//
//  ── L'ALLER-RETOUR EST LA PROPRIÉTÉ, ET ELLE EST TESTÉE ─────────────
//
//      lireUneFiche(publier(f)) === f
//
//  Tout le reste en découle. Un champ qu'on ajoute sans le faire
//  traverser casse ce test, et c'est voulu.
// ════════════════════════════════════════════════════════════════════

/** Un champ de texte de la fiche, tel qu'il se demande et se publie. */
export type Champ = {
  /** La clé technique. Elle nomme la balise publiée : `wmf-<clef>`. */
  readonly clef: string;
  /** Ce que le joueur lit à côté du champ, et ce qui s'imprime dans la
   *  fiche. **C'est le texte de l'ancienne fiche**, mot pour mot. */
  readonly etiquette: string;
  /** Ce qu'on écrit dans le champ vide, pour dire ce qu'on en attend.
   *  Jamais publié : c'est une aide de saisie, pas une valeur. */
  readonly exemple?: string;
  /** Un paragraphe plutôt qu'une ligne. « On doit pouvoir écrire
   *  quelques mots ou un paragraphe pour chaque si on veut. » */
  readonly long?: boolean;
};

/*  ── LES INFORMATIONS DU PERSONNAGE ────────────────────────────────

    L'ORDRE EST CELUI QU'ELLE A DICTÉ, et il n'est pas innocent : la
    date de naissance, l'origine et le métier arrivent AVANT le
    starter, parce que c'est d'eux que le staff déduit son niveau
    (`107-…`). Un formulaire qui demanderait le Pokémon d'abord ferait
    choisir avant de savoir.

    « ALLÉGEANCE » REMPLACE « MEMBRE D'UNE ORGANISATION » de l'ancienne
    fiche : c'est le mot qu'elle emploie maintenant, et c'est celui de
    l'annexe 14. */
export const IDENTITE: readonly Champ[] = [
  { clef: "surnom", etiquette: "SURNOM", exemple: "comment on l'appelle" },
  { clef: "pronoms", etiquette: "PRONOMS", exemple: "ceux du personnage" },
  {
    clef: "naissance",
    etiquette: "DATE DE NAISSANCE (ÂGE)",
    exemple: "12 mars 2004 (22 ans)",
  },
  {
    clef: "origine",
    etiquette: "VILLE ET RÉGION D'ORIGINE",
    exemple: "Port-Amarée, Rhode",
  },
  { clef: "orientation", etiquette: "ORIENTATION SEXUELLE" },
  { clef: "statut", etiquette: "STATUT CIVIL" },
  { clef: "metier", etiquette: "MÉTIER" },
  {
    clef: "allegeance",
    etiquette: "ALLÉGEANCE",
    exemple: "un clan, le Groupe Ombre, aucune…",
  },
  { clef: "traits", etiquette: "TRAITS DE CARACTÈRE", long: true },
];

/*  ── DERRIÈRE L'ÉCRAN ──────────────────────────────────────────────

    LES ÉTIQUETTES SONT CELLES DE L'ANCIENNE FICHE, mot pour mot,
    relevées dans le sujet t50. On ne réécrit pas leur texte.

    « IMAGE POUR LA TRAINER CARD » en dernier, comme là-bas. */
export const JOUEUR: readonly Champ[] = [
  { clef: "j-pseudo", etiquette: "PSEUDO/PRÉNOM" },
  { clef: "j-age", etiquette: "ÂGE" },
  { clef: "j-pronoms", etiquette: "PRONOMS", exemple: "les tiens" },
  { clef: "j-region", etiquette: "RÉGION/PAYS" },
  { clef: "j-avatar", etiquette: "AVATAR", exemple: "qui te sert de visage" },
  { clef: "j-groupe", etiquette: "GROUPE CHOISI" },
  {
    clef: "j-type",
    etiquette: "TYPE DE PERSONNAGE",
    exemple: "inventé, pré-lien, pv ?",
  },
  { clef: "j-connaissance", etiquette: "D'OÙ NOUS CONNAIS-TU ?" },
  { clef: "j-avis", etiquette: "AVIS SUR LE FORUM", long: true },
  { clef: "j-credits", etiquette: "AUTRES CRÉDITS", exemple: "le codage, un kit, une typo" },
  { clef: "j-credit-avatar", etiquette: "L'AVATAR", exemple: "qui a fait cette image" },
  { clef: "j-credit-tcard", etiquette: "L'IMAGE CARRÉE", exemple: "qui a fait cette image" },
  { clef: "j-autre", etiquette: "AUTRE", exemple: "une dernière information ?" },
  {
    clef: "j-tcard",
    etiquette: "IMAGE POUR LA TRAINER CARD",
    exemple: "en png et carrée de préférence",
  },
];

/*  ── LE GROUPE OMBRE ───────────────────────────────────────────────

    « On la garde, en option du formulaire » — 23 novembre. Une case à
    cocher ajoute ce bloc ; décochée, il ne s'écrit pas du tout.

    LES CINQ QUESTIONS SONT CELLES DE L'ANCIENNE FICHE, mot pour mot. */
export const OMBRE: readonly Champ[] = [
  { clef: "o-avis", etiquette: "Que pensez-vous de l'organisation ?", long: true },
  { clef: "o-connue", etiquette: "Comment l'avez-vous connue ?", long: true },
  { clef: "o-role", etiquette: "Quel est votre rôle en son sein ?", long: true },
  { clef: "o-pourquoi", etiquette: "Pourquoi avoir rejoint la Team Ombre ?", long: true },
  { clef: "o-obscurs", etiquette: "Que pensez-vous des Pokémons Obscurs ?", long: true },
];

/** Une entrée de chronologie : une date, ce qui s'y est passé. */
export type Moment = {
  readonly date: string;
  readonly texte: string;
};

/** L'histoire, dans la forme que le joueur a choisie.
 *
 *  « Soit de faire un grand pavé et de pouvoir ajouter des balises de
 *  texte comme on veut. Soit faire une chronologie. » — et c'est le
 *  joueur qui choisit, pas nous. */
export type Histoire =
  | { readonly mode: "pave"; readonly texte: string }
  | { readonly mode: "chronologie"; readonly moments: readonly Moment[] };

/** Le premier Pokémon.
 *
 *  NI NIVEAU NI ATTAQUES, et c'est une règle, pas un oubli : « les
 *  niveaux ne sont pas choisis par les joueurs, le staff les attribuera
 *  selon l'âge, le métier et le passé du personnage » (`107-…`).
 *  L'ancienne fiche faisait taper « ATTAQUE 0PP (PUISSANCE) » quatre
 *  fois ; ce n'est plus au joueur de les écrire. */
export type Starter = {
  readonly especeId: number;
  /** Le nom de l'espèce, publié tel quel : la fiche doit rester
   *  lisible sans aller chercher le catalogue. */
  readonly espece: string;
  readonly surnom: string;
  readonly talent: string;
  /** « Compagnon d'une vie » — comment le personnage l'a rencontré.
   *  C'est ce paragraphe qui permet au staff d'évaluer le niveau. */
  readonly rencontre: string;
};

export type Fiche = {
  /** Le nom du personnage, en titre, collé à gauche. */
  readonly nom: string;
  /** La phrase sous le nom — une réplique, un titre de chanson, ce
   *  que le joueur veut. C'est un CHAMP À PART des trigger warnings :
   *  « avoir une section différente pour les triggers warnings et
   *  pour le sous-titre », 24 novembre. Les deux se suivaient sous le
   *  nom et se lisaient comme une seule ligne. */
  readonly sousTitre: string;
  /** Les trigger warnings, en tête, comme dans l'ancienne fiche —
   *  mais dans leur propre encadré, étiquette comprise : un
   *  avertissement qui ressemble à un sous-titre n'avertit personne. */
  readonly tw: string;
  /** L'adresse de l'image de la colonne de gauche. « On peut rajouter
   *  le lien de l'avatar pour afficher l'avatar qu'on souhaite dans sa
   *  fiche. » */
  readonly avatar: string;
  readonly identite: Readonly<Record<string, string>>;
  readonly histoire: Histoire;
  readonly starter: Starter | null;
  /** L'ancienne équipe, en texte libre — « le starter, et un champ
   *  libre pour le reste », 23 novembre. Quatre emplacements
   *  mécaniques auraient demandé une mécanique de récupération que
   *  personne n'a encore décrite. */
  readonly ancienneEquipe: string;
  readonly ombre: Readonly<Record<string, string>> | null;
  readonly joueur: Readonly<Record<string, string>>;
};

/** La fiche vide, celle qu'un sujet neuf présente. */
export function ficheVide(): Fiche {
  const vides = (champs: readonly Champ[]) =>
    Object.fromEntries(champs.map((c) => [c.clef, ""]));
  return {
    nom: "",
    sousTitre: "",
    tw: "",
    avatar: "",
    identite: vides(IDENTITE),
    histoire: { mode: "pave", texte: "" },
    starter: null,
    ancienneEquipe: "",
    ombre: null,
    joueur: vides(JOUEUR),
  };
}

// ── publier ─────────────────────────────────────────────────────────

/*  CE QU'ON N'ÉCHAPPE PAS, ET POURQUOI.

    Le texte du joueur part TEL QUEL dans le message. C'est voulu :
    « pouvoir ajouter des balises de texte comme on veut » — du gras,
    de l'italique, une citation. L'échapper ferait apparaître
    `&lt;b&gt;` dans sa fiche.

    LE SEUL ENDROIT QU'ON PROTÈGE EST LA FERMETURE DE NOS PROPRES
    BALISES : un joueur qui écrirait `</wmf-surnom>` dans son histoire
    couperait la fiche en deux à la relecture. On remplace ce motif-là,
    et rien d'autre. Il ne peut pas apparaître par accident.

    CE N'EST PAS UNE PROTECTION DE SÉCURITÉ. Forumactif autorise déjà
    le HTML dans les messages, et c'est le joueur qui écrit son propre
    message : il ne peut atteindre que sa propre fiche. La protection
    du forum, c'est le filtre de Forumactif, pas celui-ci. */
/*  LE SÉPARATEUR EST UN ESPACE DE LARGEUR NULLE, ÉCRIT EN ÉCHAPPEMENT.

    Il se glisse entre le `<` et le reste, donc le motif ne correspond
    plus à une balise à la relecture, et il ne se voit pas dans la
    fiche publiée.

    `"\u200b"` ET PAS LE CARACTÈRE LUI-MÊME : un caractère invisible
    posé en clair dans un fichier source est une ligne que personne ne
    peut relire, ni chercher, ni corriger. */
const SEPARE = "\u200b";

function sur(texte: string): string {
  //  LA BARRE SE GARDE, et c'est tout le piège : écrire « `/` » dans
  //  le remplacement transformait un `<wmf-nom>` OUVRANT en
  //  `</wmf-nom>` FERMANT à la relecture. Le texte du joueur en
  //  ressortait changé, et seul le groupe capturé le rend fidèlement.
  return texte.replace(/<(\/?)wmf-/gi, `<${SEPARE}$1wmf-`);
}

/** Ce que `sur` a mis de côté, rendu tel qu'il a été tapé. */
function rendu(texte: string): string {
  return texte.replace(new RegExp(`<${SEPARE}(/?)wmf-`, "g"), "<$1wmf-");
}

/*  CE QU'IL FAUT ÉCHAPPER POUR L'ÉDITEUR, ET SEULEMENT POUR LUI.

    L'éditeur rend cette fiche puis rend chaque valeur modifiable sur
    place. Or une valeur PORTE LES BALISES DU JOUEUR — « pouvoir
    ajouter des balises de texte comme on veut » — et le navigateur les
    analyse : son `<b>mardi</b>` devient un vrai élément dans la zone.

    LA PERTE EST SILENCIEUSE ET DÉFINITIVE. Relire la zone rend
    « mardi » sans ses balises ; la frappe suivante réécrit le message
    avec cette version appauvrie, et le joueur voit son gras disparaître
    sans savoir ce qui l'a mangé. Mesuré le 23 novembre, sur le vrai
    navigateur.

    Pour l'écran, le texte du joueur est donc du TEXTE : ses balises
    s'affichent telles qu'il les a tapées, et se relisent telles
    quelles. Pour le message, rien n'est échappé — c'est tout l'objet.

    `sur` NE SUFFIRAIT PAS : elle ne protège que `<wmf-`, ce qui
    empêche de forger une balise à nous, pas d'en faire analyser
    d'autres. */
function echappe(texte: string): string {
  return texte
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/*  CE QU'UN CHAMP VIDE AFFICHE, À L'ÉCRAN COMME DANS LE MESSAGE.
 *
 *  « Si je remplis rien, la fiche doit quand même garder son gabarit,
 *  avoir du texte par défaut » — 24 novembre, devant une fiche de test
 *  qui ne montrait que deux bandeaux.
 *
 *  LA TABLE EST ICI, ET PAS DANS L'ADAPTATEUR, parce que les deux
 *  rendus s'en servent : l'éditeur la pose sur ses zones, le message
 *  l'écrit en attribut. Deux tables auraient divergé au premier mot
 *  changé. */
export const INVITES: Readonly<Record<string, string>> = Object.fromEntries([
  ["nom", "le nom de ton personnage"],
  ["soustitre", "une phrase, une réplique, un titre de chanson"],
  ["tw", "ce que ta fiche contient, et qu'on préfère annoncer"],
  ["avatar", "l'adresse de l'image à afficher à gauche"],
  ["histoire", "son histoire, aussi longue que tu veux"],
  ["m-date", "2015, ou « l'hiver d'après »"],
  ["m-texte", "ce qui s'est passé"],
  ["s-surnom", "son surnom, si tu lui en donnes un"],
  ["s-espece", "l'espèce de ton premier Pokémon"],
  ["s-talent", "son talent"],
  [
    "s-rencontre",
    "comment vous vous êtes rencontrés — c'est ce qui permet au staff de " +
    "fixer son niveau",
  ],
  [
    "ancienne",
    "les Pokémon que ton personnage avait déjà, et qu'il récupérera aux paliers",
  ],
  ...OMBRE.map((c) => [c.clef, "ta réponse"] as const),
  ...IDENTITE.map((c) => [c.clef, c.exemple ?? c.etiquette.toLowerCase()] as const),
  ...JOUEUR.map((c) => [c.clef, c.exemple ?? c.etiquette.toLowerCase()] as const),
]);

/*  LES TROIS BALISES QUI NE SONT PAS DU TEXTE À LIRE : deux adresses
    d'image et un numéro d'espèce. Le message les porte mais ne les
    montre pas, donc un texte par défaut n'y serait lu par personne —
    et s'afficherait si une feuille de style venait à manquer. */
const MUETTES = new Set(["avatar", "j-tcard", "s-id"]);

function balise(clef: string, valeur: string, brut = false): string {
  const dedans = brut ? echappe(valeur) : sur(valeur);
  //  LE TEXTE PAR DÉFAUT NE PART QUE DANS LE MESSAGE. L'éditeur pose
  //  le sien sur la zone, au moment où il la branche.
  const vide = !brut && dedans.trim() === "" && !MUETTES.has(clef)
    ? ` data-vide="${echappe(INVITES[clef] ?? "")}"`
    : "";
  return `<wmf-${clef}${vide}>${dedans}</wmf-${clef}>`;
}

function bloc(
  champs: readonly Champ[],
  valeurs: Readonly<Record<string, string>>,
  ecrire: boolean,
): string {
  //  UN CHAMP VIDE GARDE SON ÉTIQUETTE. « Si les champs ne sont pas
  //  remplis, tu dois quand même afficher le label » — 24 novembre.
  //
  //  C'est l'inverse de ce qu'on faisait, et la raison a changé avec
  //  la forme. Tant qu'un champ était une ligne, « SURNOM » tout seul
  //  n'apprenait rien et occupait une ligne pour rien. Depuis que
  //  chaque champ est un bloc avec son étiquette au-dessus, les
  //  retirer trouait la grille : une fiche à trois champs sur dix
  //  n'avait plus de forme, et deux fiches côte à côte n'avaient plus
  //  la même. L'étiquette dit aussi ce que le joueur a choisi de ne
  //  pas remplir, ce qui est une information pour le staff.
  //
  //  LES SECTIONS ENTIÈRES, ELLES, RESTENT FACULTATIVES : le starter,
  //  l'organisation, les trigger warnings, le sous-titre. Une carte de
  //  Pokémon vide n'est pas un champ vide, c'est une rubrique qui ne
  //  concerne pas ce personnage.
  //
  //  ── UN CHAMP EST UN BLOC, ET L'ÉTIQUETTE EST AU-DESSUS ───────────
  //
  //  « Mets sur une seule [colonne], les gens ont tendance à
  //  développer et à écrire quelques lignes pour chaque info. »
  //  — 23 novembre.
  //
  //  C'est ce qui a décidé la forme. Tant que les valeurs tenaient en
  //  trois mots, « MÉTIER : ranger » sur une ligne suffisait. À quatre
  //  lignes de texte, l'étiquette se perd au milieu du paragraphe
  //  précédent : il faut qu'elle ouvre son champ, pas qu'elle le
  //  coupe.
  //
  //  `data-long` MARQUE CEUX QUI NE SE RANGENT PAS EN GRILLE — l'avis
  //  sur le forum, les traits de caractère. Le CSS leur donne la
  //  largeur entière ; sans cette marque, une colonne de grille
  //  s'étirerait sur la hauteur d'un paragraphe et laisserait un trou
  //  en face.
  return champs
    .map((c) =>
      `<div class="wmf__champ"${c.long === true ? ` data-long="oui"` : ""}>` +
      `<y>${c.etiquette}</y> ${balise(c.clef, valeurs[c.clef] ?? "", ecrire)}` +
      `</div>`
    )
    .join("");
}

/*  CE QUI SORT DU BLOC « DERRIÈRE L'ÉCRAN », ET POURQUOI.

    Deux champs du joueur ne sont pas du texte : ce sont des adresses
    d'image, et les laisser en texte afficherait une URL de deux cents
    caractères au milieu de la fiche.

    L'AVATAR JOUÉ PAR LA PERSONNE monte en tête, dans un encadré sous
    l'image du personnage — « le mieux, mettre ça sous l'avatar, dans
    un encadré », 23 novembre. C'est là qu'on le cherche : à côté du
    visage, pas trente écrans plus bas.

    L'IMAGE DE LA TRAINER CARD est carrée, et elle s'affiche. « C'est
    une image carrée. Le mieux, c'est de mettre le lien et de
    l'intégrer dans la fiche pour que ça rende bien. » */
/*  LES DEUX ADRESSES D'IMAGE NE SONT PAS DU TEXTE : elles montent en
    tête de leur bloc, sous forme d'image. */
const DANS_LA_TETE = new Set(["j-avatar", "j-tcard"]);

/*  LES CRÉDITS SE REMPLISSENT DEVANT LEURS IMAGES. « Pour le champ
    crédits rempli tout en bas, permet de remplir les crédits
    directement avec les deux images : l'avatar et l'image carrée »
    — 24 novembre.

    Écrire « Avatar (@boscaesperanza) » à la main dans un champ libre
    marchait, mais il fallait nommer l'image dont on parlait. En
    posant la vignette à côté de la ligne, la question ne se pose
    plus : on crédite ce qu'on a sous les yeux. */
const CREDITS = new Set(["j-credits", "j-credit-avatar", "j-credit-tcard"]);

const CREDIT_AVATAR = JOUEUR.find((c) => c.clef === "j-credit-avatar") as Champ;
const CREDIT_TCARD = JOUEUR.find((c) => c.clef === "j-credit-tcard") as Champ;
const CREDIT_AUTRES = JOUEUR.find((c) => c.clef === "j-credits") as Champ;

const JOUEUR_EN_BLOC: readonly Champ[] = JOUEUR.filter(
  (c) => !DANS_LA_TETE.has(c.clef) && !CREDITS.has(c.clef),
);

/** Comment rendre la fiche. */
export type Rendu = {
  /** Rendre AUSSI ce qui est vide : chaque champ, le bloc du starter,
   *  le bloc de l'organisation.
   *
   *  ── POURQUOI CETTE OPTION EXISTE ────────────────────────────────
   *
   *  « Je veux pas juste remplir les champs. Je veux visuellement
   *  remplir ma fiche de présentation. » — 23 novembre.
   *
   *  L'éditeur n'est pas un formulaire posé à côté de la fiche : c'est
   *  la fiche, rendue par cette fonction, dont chaque valeur devient
   *  une zone où l'on écrit. Une seule mise en page, donc, pour
   *  l'écran et pour le message — et rien à faire diverger.
   *
   *  Mais la fiche publiée TAIT ce qui est vide, et c'est voulu. Un
   *  champ qu'on ne rend pas n'offre aucune zone où écrire — et c'est
   *  précisément celui qu'il reste à remplir. D'où cette option :
   *  l'écran montre tout, le message ne garde que ce qui est rempli.
   *
   *  ELLE NE CHANGE RIEN PAR DÉFAUT, et l'aller-retour qui fait foi
   *  (`publier` → `lireUneFiche`) est mesuré sans elle. */
  readonly pourEcrire?: boolean;

  /** L'adresse complète du sprite du starter, ou rien.
   *
   *  ── POURQUOI UNE ADRESSE TOUTE FAITE ────────────────────────────
   *
   *  Elle est écrite DANS le message, et c'est la seule façon : un
   *  message est du HTML figé, aucun script n'y tourne pour aller
   *  chercher l'image plus tard.
   *
   *  MAIS ON NE LA CALCULE PLUS ICI. C'était `racine` et un chemin
   *  deviné, qui menait au PNG que nous figions nous-mêmes. « Si tu
   *  les prends pas animé, évite de prendre l'animé et de le figer »
   *  — 23 novembre : on sert maintenant le GIF d'origine, dont
   *  l'adresse dépend de la source qui a l'espèce et que seule la
   *  couverture connaît. `data/starters.json` la porte, déjà chargé
   *  par l'éditeur, et l'appelant la passe telle quelle.
   *
   *  Sans adresse, pas d'image — et pas d'image cassée non plus. */
  readonly sprite?: string;
};

const STARTER_VIDE: Starter = {
  especeId: 0,
  espece: "",
  surnom: "",
  talent: "",
  rencontre: "",
};

/** Le message à publier, tel qu'il entrera dans l'éditeur.
 *
 *  ── LA MISE EN PAGE EST CELLE QU'ELLE A DÉCRITE ───────────────────
 *
 *  « Le nom du personnage en haut, en titre, collé à gauche. En
 *  dessous, 2 colonnes : une pour l'avatar […], à droite les
 *  informations du personnage. »
 *
 *  PAS DE `<center>`, contrairement à l'ancienne fiche : « collé à
 *  gauche » est une consigne, et c'est la seule différence de fond
 *  avec la mise en page de la V1.
 *
 *  LES DEUX COLONNES SONT UN FLEX, pas un tableau — « je veux pas de
 *  tableau, que du flexbox ». Le CSS vit dans la feuille du forum ;
 *  ici on ne pose que la structure et les classes. */
/** Le bloc des crédits : chaque image avec sa ligne, et une ligne
 *  pour le reste.
 *
 *  ── POURQUOI LES VIGNETTES SONT LÀ ─────────────────────────────────
 *
 *  « Permet de remplir les crédits directement avec les deux images :
 *  l'avatar et l'image carrée » — 24 novembre.
 *
 *  Les deux images sont déjà dans la fiche, en haut et en bas. Les
 *  reposer ici en petit ne les répète pas pour décorer : c'est ce qui
 *  dit DE QUELLE image parle la ligne qu'on remplit. Sans elles, il
 *  fallait l'écrire — « Avatar (@quelquun) » — et deviner le mot que
 *  le lecteur suivant emploierait.
 *
 *  UNE VIGNETTE SANS ADRESSE NE LAISSE PAS D'IMAGE CASSÉE : la case
 *  reste, vide, et la ligne de crédit avec elle. Le gabarit tient
 *  même quand rien n'est rempli. */
function credits(f: Fiche, ecrire: boolean): string {
  const b = (c: Champ, v: string): string =>
    `<div class="wmf__champ"><y>${c.etiquette}</y> ${balise(c.clef, v, ecrire)}</div>`;
  const vignette = (classe: string, adresse: string): string => {
    const propre = adresse.trim();
    return `<div class="wmf__credit-vignette ${classe}">` +
      (propre === "" ? "" : `<img src="${ecrire ? echappe(propre) : propre}" alt="" />`) +
      `</div>`;
  };
  const ligne = (classe: string, adresse: string, c: Champ): string =>
    `<div class="wmf__credit">${vignette(classe, adresse)}${
      b(c, f.joueur[c.clef] ?? "")
    }</div>`;
  return `<div class="wmf__credits">` +
    `<div class="wmf__bandeau">CRÉDITS</div>` +
    ligne("wmf__credit-avatar", f.avatar, CREDIT_AVATAR) +
    ligne("wmf__credit-tcard", f.joueur["j-tcard"] ?? "", CREDIT_TCARD) +
    b(CREDIT_AUTRES, f.joueur["j-credits"] ?? "") +
    `</div>`;
}

export function publier(f: Fiche, r: Rendu = {}): string {
  const ecrire = r.pourEcrire === true;
  const b = (clef: string, v: string): string => balise(clef, v, ecrire);
  const morceaux: string[] = [];
  morceaux.push(`<div class="wmf">`);
  //  ── LA TÊTE DU MESSAGE : DEUX SECTIONS, PAS UNE ────────────────
  //
  //  Le nom et sa phrase vont ensemble, collés. Les trigger warnings
  //  sont autre chose : ils ont leur encadré et leur étiquette, en
  //  dessous. « Avoir une section différente pour les triggers
  //  warnings et pour le sous-titre » — 24 novembre.
  morceaux.push(`<div class="wmf__tete">`);
  morceaux.push(`<div class="wmf__titre">${b("nom", f.nom)}</div>`);
  morceaux.push(`<div class="wmf__soustitre">${b("soustitre", f.sousTitre)}</div>`);
  morceaux.push(`</div>`);
  morceaux.push(
    `<div class="wmf__tw"><y>TRIGGER WARNINGS</y> <x>${b("tw", f.tw)}</x></div>`,
  );

  //  ── LA TÊTE : DEUX COLONNES DE MÊME HAUTEUR ────────────────────
  //
  //  « Mets en 2 colonnes l'avatar et les infos à côté, et fais en
  //  sorte que la 2e colonne soit aussi haute que l'avatar. »
  //
  //  La colonne de gauche porte l'image PUIS l'encadré du faceclaim,
  //  donc elle est plus haute que l'image seule : c'est sur ELLE que
  //  la droite s'aligne, sinon l'encadré dépasserait tout seul en bas.
  const fc = f.joueur["j-avatar"] ?? "";
  morceaux.push(`<div class="wmf__haut">`);
  morceaux.push(
    `<div class="wmf__avatar">` +
      (f.avatar.trim() === ""
        ? ""
        : `<img src="${ecrire ? echappe(f.avatar.trim()) : f.avatar.trim()}" alt="" />`) +
      b("avatar", f.avatar) +
      //  L'ENCADRÉ DU FACECLAIM FAIT PARTIE DU GABARIT, rempli ou non.
      //  Il était resté conditionnel quand tout le reste est devenu
      //  permanent, donc il disparaissait des fiches vides : « tu as
      //  enlevé l'avatar utilisé sous l'avatar du coup, remets »,
      //  24 novembre.
      `<div class="wmf__fc"><y>AVATAR JOUÉ PAR</y> ${b("j-avatar", fc)}</div>` +
      `</div>`,
  );
  morceaux.push(`<div class="wmf__infos">${bloc(IDENTITE, f.identite, ecrire)}</div>`);
  morceaux.push(`</div>`);

  //  ── L'HISTOIRE, DANS LA FORME CHOISIE ──────────────────────────
  //
  //  LE MODE EST ÉCRIT DANS LA FICHE, pas deviné à la relecture. Une
  //  chronologie à un seul moment ressemble à un pavé, et un pavé qui
  //  commence par une date ressemble à une chronologie : deviner
  //  ferait changer de forme une fiche qu'on rouvre.
  //  LE CORPS EST UNE SEULE CHAÎNE, et ce n'est pas qu'une question de
  //  style : il porte `white-space: pre-wrap`, pour que les
  //  paragraphes tapés par le joueur restent des paragraphes. Un
  //  retour à la ligne de NOTRE fabrication s'y afficherait comme une
  //  ligne vide au-dessus de son texte.
  //
  //  ET UNE CHRONOLOGIE VIDE OFFRE QUAND MÊME UN MOMENT À REMPLIR :
  //  sinon, choisir la chronologie n'afficherait rien du tout, et le
  //  joueur devrait deviner qu'il y a un bouton à trouver.
  const corps = f.histoire.mode === "pave"
    ? b("histoire", f.histoire.texte)
    : `<div class="wmf__chrono">` +
      (ecrire && f.histoire.moments.length === 0
        ? [{ date: "", texte: "" } as Moment]
        : f.histoire.moments)
        .map((m) =>
          `<div class="wmf__moment">` +
          `<div class="wmf__moment-date">${b("m-date", m.date)}</div>` +
          `<div class="wmf__moment-texte">${b("m-texte", m.texte)}</div>` +
          `</div>`
        )
        .join("") +
      `</div>`;
  morceaux.push(
    `<div class="wmf__histoire" data-mode="${f.histoire.mode}">` +
      `<div class="wmf__bandeau">RACONTE-NOUS TON HISTOIRE</div>` +
      `<div class="wmf__histoire-corps">${corps}</div>` +
      `</div>`,
  );

  //  LE STARTER ET L'ÉQUIPE D'AVANT FONT PARTIE DU GABARIT, remplis ou
  //  non : « la fiche doit quand même garder son gabarit ». Une carte
  //  de Pokémon vide porte son texte par défaut et dit ce qui manque,
  //  là où son absence ne disait rien.
  {
    const s = f.starter ?? STARTER_VIDE;
    //  PAS D'ESPÈCE, PAS DE SPRITE : l'éditeur rend le bloc du starter
    //  avant qu'on ait choisi, pour qu'il y ait où écrire.
    const sprite = s.especeId > 0 && r.sprite !== undefined && r.sprite !== ""
      ? echappe(r.sprite)
      : null;
    morceaux.push(`<div class="wmf__starter">`);
    morceaux.push(
      `<div class="wmf__pokemon">` +
        (sprite === null ? "" : `<img class="wmf__sprite" src="${sprite}" alt="" />`) +
        `<wmf-s-id>${s.especeId}</wmf-s-id>` +
        `<div class="wmf__espece">${b("s-espece", s.espece)}</div>` +
        `<div class="wmf__surnom"><ifn>${b("s-surnom", s.surnom)}</ifn></div>` +
        `<div class="wmf__talent"><ifi>${b("s-talent", s.talent)}</ifi></div>` +
        `</div>`,
    );
    morceaux.push(
      `<div class="wmf__rencontre">` +
        `<div class="wmf__bandeau">COMPAGNON D'UNE VIE</div>` +
        b("s-rencontre", s.rencontre) +
        `</div>`,
    );
    morceaux.push(`</div>`);
  }
  {
    morceaux.push(
      `<div class="wmf__ancienne">` +
        `<div class="wmf__bandeau">L'ÉQUIPE D'AVANT</div>` +
        b("ancienne", f.ancienneEquipe) +
        `</div>`,
    );
  }

  if (f.ombre !== null || ecrire) {
    morceaux.push(`<div class="wmf__ombre">`);
    morceaux.push(`<div class="wmf__bandeau">L'ORGANISATION</div>`);
    for (const c of OMBRE) {
      const v = f.ombre?.[c.clef] ?? "";
      morceaux.push(
        `<div class="wmf__question"><o>${c.etiquette}</o> ${b(c.clef, v)}</div>`,
      );
    }
    morceaux.push(`</div>`);
  }

  //  ── LE PIED REPREND LA GRAMMAIRE DE LA TÊTE ────────────────────
  //
  //  « Derrière l'écran, les informations sont pareilles du coup,
  //  comme tout en haut. » Une image à gauche, les champs à droite,
  //  même hauteur — mais carrée, parce que la trainer card l'est.
  const tcard = f.joueur["j-tcard"] ?? "";
  morceaux.push(
    `<div class="wmf__joueur">` +
      `<div class="wmf__bandeau">DERRIÈRE L'ÉCRAN</div>` +
      `<div class="wmf__joueur-haut">` +
      `<div class="wmf__tcard">` +
      (tcard.trim() === ""
        ? ""
        : `<img src="${ecrire ? echappe(tcard.trim()) : tcard.trim()}" alt="" />`) +
      b("j-tcard", tcard) +
      `</div>` +
      `<div class="wmf__joueur-infos">${bloc(JOUEUR_EN_BLOC, f.joueur, ecrire)}</div>` +
      `</div>` +
      credits(f, ecrire) +
      `</div>`,
  );
  morceaux.push(`</div>`);
  return morceaux.join("\n");
}

// ── relire ──────────────────────────────────────────────────────────

/*  UNE LECTURE PAR MOTIF, ET PAS PAR DOM.

    Le dépôt n'embarque aucun analyseur HTML, et l'aller-retour doit se
    prouver sans navigateur. La balise est unique par champ, donc sa
    fermeture n'est pas ambiguë : `[\s\S]*?` jusqu'à `</wmf-clef>` rend
    exactement ce qu'on avait mis, balises du joueur comprises.

    ON NE RÉCLAME RIEN. Un champ absent rend la chaîne vide, un bloc
    absent rend `null`. Une fiche écrite à la main, ou l'ancienne fiche
    de la V1, ne porte aucune de ces balises : on rend alors une fiche
    vide, et c'est à l'appelant de ne pas écraser ce qu'il n'a pas
    compris — voir `ressembleAUneFiche`. */
function dedans(html: string, clef: string): string {
  const re = new RegExp(`<wmf-${clef}>([\\s\\S]*?)</wmf-${clef}>`, "i");
  const t = re.exec(html);
  return t === null ? "" : rendu(t[1]);
}

function tous(html: string, clef: string): string[] {
  const re = new RegExp(`<wmf-${clef}>([\\s\\S]*?)</wmf-${clef}>`, "gi");
  return [...html.matchAll(re)].map((m) => rendu(m[1]));
}

function lesChamps(html: string, champs: readonly Champ[]): Record<string, string> {
  return Object.fromEntries(champs.map((c) => [c.clef, dedans(html, c.clef)]));
}

/** Est-ce que ce message est une fiche que ce formulaire a écrite ?
 *
 *  ── LA QUESTION QUI ÉVITE D'EFFACER LE TRAVAIL DE QUELQU'UN ────────
 *
 *  Le formulaire écrit le message entier à chaque frappe. Sur un
 *  message qu'il n'a pas écrit — une fiche de la V1, une fiche
 *  retouchée à la main jusqu'à en perdre les balises — écrire
 *  reviendrait à effacer le texte de quelqu'un sans le lui demander.
 *
 *  Il ne suffit pas que le mot `wmf` apparaisse : on exige la balise
 *  du NOM, qui est la seule qu'une fiche publiée porte toujours. */
export function ressembleAUneFiche(html: string): boolean {
  return /<wmf-nom>/i.test(html);
}

/** Ce message EST une fiche, et pas un message qui en contient une.
 *
 *  ── LA QUESTION QUE POSE UNE PAGE SANS NUMÉRO DE FORUM ─────────────
 *
 *  « Quand je fais prévisualiser, ou si je publie et que je modifie,
 *  ça doit rester le formulaire. » — 23 novembre.
 *
 *  Ces deux pages ne disent pas dans quel forum on est : l'édition
 *  s'ouvre sur `/post?p=…&mode=editpost`, sans `f=`, et la
 *  prévisualisation re-poste le formulaire sur `/post` tout court. Le
 *  seul indice qui reste est le message lui-même.
 *
 *  ── ET POURQUOI PAS `ressembleAUneFiche` ───────────────────────────
 *
 *  Parce qu'elle dirait oui à une fiche CITÉE. Quelqu'un qui répond à
 *  une présentation en citant son auteur a `<wmf-nom>` dans son
 *  message, dans un forum qui n'est pas celui des présentations : le
 *  formulaire se poserait, lirait la fiche de l'autre, et la première
 *  frappe remplacerait sa réponse par une fiche.
 *
 *  On exige donc que la fiche OUVRE le message. Une citation la fait
 *  précéder de son propre balisage, et sceditor nous rend notre HTML
 *  au caractère près — mesuré sur la vraie page le 23 novembre. */
export function estUneFicheEntiere(html: string): boolean {
  const propre = html.trim();
  return propre.startsWith(`<div class="wmf">`) && ressembleAUneFiche(propre);
}

/** La fiche que porte ce message, ou la fiche vide.
 *
 *  Elle rend toujours une fiche : l'appelant demande d'abord
 *  `ressembleAUneFiche` s'il a quelque chose à perdre. */
export function lireUneFiche(html: string): Fiche {
  const vide = ficheVide();
  if (!ressembleAUneFiche(html)) return vide;

  //  LE MODE EST LU DANS L'ATTRIBUT, parce qu'il a été écrit là. Une
  //  chronologie vide et un pavé vide produisent le même corps ; sans
  //  l'attribut, rouvrir sa fiche changerait sa forme.
  const mode = /class="wmf__histoire" data-mode="chronologie"/i.test(html)
    ? "chronologie"
    : "pave";
  const dates = tous(html, "m-date");
  const textes = tous(html, "m-texte");
  const histoire: Histoire = mode === "chronologie"
    ? {
      mode,
      //  ON APPARIE PAR RANG, et on s'arrête au plus court : une
      //  moitié de moment, c'est un moment qu'on ne sait pas lire.
      moments: dates.slice(0, Math.min(dates.length, textes.length))
        .map((date, i) => ({ date, texte: textes[i] })),
    }
    : { mode: "pave", texte: dedans(html, "histoire") };

  const especeId = Number(/<wmf-s-id>(\d+)<\/wmf-s-id>/i.exec(html)?.[1] ?? "");
  const starter: Starter | null = Number.isInteger(especeId) && especeId > 0
    ? {
      especeId,
      espece: dedans(html, "s-espece"),
      surnom: dedans(html, "s-surnom"),
      talent: dedans(html, "s-talent"),
      rencontre: dedans(html, "s-rencontre"),
    }
    : null;

  //  LE BLOC OMBRE EXISTE OU N'EXISTE PAS, et c'est sa boîte qui le
  //  dit — pas ses réponses. Un joueur du Groupe Ombre qui n'a encore
  //  rempli aucune des cinq questions doit retrouver sa case cochée.
  const ombre = /class="wmf__ombre"/i.test(html) ? lesChamps(html, OMBRE) : null;

  return {
    ...vide,
    nom: dedans(html, "nom"),
    sousTitre: dedans(html, "soustitre"),
    tw: dedans(html, "tw"),
    avatar: dedans(html, "avatar"),
    identite: lesChamps(html, IDENTITE),
    histoire,
    starter,
    ancienneEquipe: dedans(html, "ancienne"),
    ombre,
    joueur: lesChamps(html, JOUEUR),
  };
}
