/// <reference lib="dom" />
/// <reference lib="dom.iterable" />
// ════════════════════════════════════════════════════════════════════
//  src/adaptateurs/navigateur/barre-d-actions.ts
//
//  COUVERT PAR : outils/barre.mjs — les quatre choix, la place dans le
//  formulaire, l'écriture à l'envoi, l'écart visible entre choisi et pas
//  choisi, et le fait qu'aucun contrôle ne soit muet.
//  (Garde-fou n° 22 : un module d'interface sans test unitaire doit dire
//   quel harnais le monte, et ce harnais doit tourner dans le CI.)
//
//  Le bloc d'actions de la réponse. Dessiné dans Figma, page Composants,
//  « Barre d'actions ».
//
//  QUE DU DOM. Ce qu'un clic fait au texte est décidé dans
//  `src/navigateur/redaction.ts`, où c'est testé sans navigateur.
//
//  ── QUATRE CHOIX QUI S'EXCLUENT, DEPUIS LE 17 NOVEMBRE ──────────────
//
//  Callista, sur `t996` : « j'aimerai que dans la réponse rapide on ait
//  la possibilité de "ne rien faire, faire apparaître, fouiller ou
//  cloturer". On doit bien voir que "ne rien faire" est sélectionné.
//  Clôturer doit apparaître de manière un peu secondaire. Aussi, les
//  boutons, on doit bien faire la différence qu'on l'a sélectionné ou
//  non. Aujourd'hui, c'est pas le cas. En dessous, prévisualiser ou
//  envoyer. »
//
//  Trois choses changent, et chacune se mesure :
//
//  1. « NE RIEN FAIRE » EST UN BOUTON. C'était déjà un état — celui de
//     départ —, mais il n'avait pas de contrôle : on le reconnaissait à
//     ce qu'aucun bouton n'était enfoncé. Un état qu'on lit à l'absence
//     des autres ne se voit pas ; maintenant il est coché.
//
//  2. LES QUATRE S'EXCLUENT. La clôture était un bouton à part qui
//     pouvait coexister avec une action — « une dernière fouille et on
//     clôture ». Elle est demandée dans le même groupe, donc ce
//     cumul-là n'est plus possible. **C'est une perte, et elle est
//     volontaire** : c'est le « ou » de sa phrase. Si elle revient
//     dessus, la clôture redevient une bascule à côté du groupe — tout
//     ce qu'il faut pour ça est déjà écrit en deux fonctions dans
//     `redaction.ts` (`avecLaCloture`, `sansLaCloture`).
//
//  3. LA BARRE SE POSE AVANT LA RANGÉE D'ENVOI, dans le formulaire, et
//     plus après lui. « En dessous, prévisualiser ou envoyer. »
//
//  ── L'ÉCART ENTRE CHOISI ET PAS CHOISI ──────────────────────────────
//
//  « Aujourd'hui, c'est pas le cas » : l'état posé ajoutait une couleur
//  de bord et une ombre intérieure d'un pixel sur un bouton qui avait
//  déjà un bord. Deux états séparés par un pixel ne sont pas deux états.
//  Le bouton choisi est maintenant **rempli**, et il porte une pastille
//  pleine que le bouton libre porte vide — la couleur seule ne suffit
//  pas à qui la distingue mal. `outils/barre.mjs` mesure l'écart entre
//  les deux fonds et exige un rapport d'au moins 3.
//
//  ── LE CLIC N'ÉCRIT TOUJOURS RIEN DANS LE MESSAGE ───────────────────
//
//  Callista, le 15 octobre : « je n'aime pas le fait que ça ajoute une
//  balise dans mon texte, je veux que ce soit automatique quand je
//  clique. » Le bloc est donc écrit au dernier moment, à l'envoi, dans
//  le champ du formulaire. Le joueur ne voit jamais notre syntaxe ; il
//  voit un bouton coché et une phrase qui dit ce qui va partir.
//
//  ET LE BLOC EST ENCORE LU S'IL EST LÀ. Un message en cours d'édition
//  peut en porter un. La barre s'ouvre donc sur l'état du texte, et à
//  l'envoi elle réécrit un bloc unique et canonique (`avecAction`
//  remplace, il n'empile pas).
//
//  LA CLÔTURE, ELLE, RESTE VISIBLE DANS LE TEXTE : elle écrit
//  `[cloture]`, le mot que les joueurs tapent déjà aujourd'hui. Ce n'est
//  pas notre syntaxe, c'est la leur ; la cacher serait leur retirer
//  quelque chose qu'ils savent lire et corriger. La barre suit donc le
//  texte : effacer le mot à la main décoche le bouton.
//
//  ── LE MENU « OÙ » EST PARTI, LE 15 OCTOBRE ─────────────────────────
//
//  Il y avait une rangée de plus : une étiquette « Où », un menu des
//  quinze lieux de la zone. Callista : « on est déjà dans une zone
//  sauvage, avec un palier, donc y'a pas d'autres zones à rajouter. »
//
//  ET C'ÉTAIT AUSSI UN PIÈGE : changer de lieu dans le menu ne touchait
//  pas au message. Un contrôle qui a l'air d'agir et qui n'agit pas est
//  un défaut, quelle que soit la bonne raison derrière. **`outils/barre.mjs`
//  exige que CHAQUE contrôle que la barre pose change quelque chose** :
//  c'est la règle générale dont ce défaut était un cas.
//
//  Le lieu n'a pas disparu : les tables de rencontre vivent par lieu, et
//  c'est le SERVEUR qui en tire un, avec la graine du message — voir
//  `tirerUnLieu` dans `domaine/rencontre.ts`.
//
//  **La barre ne se pose que dans les dix-sept zones sauvages**, règle 4
//  de la planche 45. Ailleurs, la relève ne lit rien. C'est
//  `js/wild-mystery.ts` qui tranche, avant de construire quoi que ce
//  soit.
//
//  ── DEUX JEUX DE CHOIX, DEPUIS LE 18 NOVEMBRE ───────────────────────
//
//  Callista, le 17 : « ensuite, on a les propositions qui changent : je
//  peux attaquer le pokémon, lancer une pokeball, utiliser quelque chose
//  de mon sac ou fuir, ou changer de pokémon. »
//
//  MÊME GROUPE DE RADIOS, MÊMES RÈGLES. La barre sert l'un ou l'autre
//  jeu selon qu'un combat est ouvert dans le sujet, et c'est
//  `mon_combat` (migration 0051) qui le dit. Rien d'autre ne change :
//  un seul choix à la fois, les flèches qui déplacent, le bloc écrit au
//  dernier moment.
//
//  ── LES BOUTONS N'ARRIVENT QU'APRÈS LE SERVEUR ──────────────────────
//
//  La règle écrite en tête de `domaine/action.ts` depuis le 2 octobre :
//  **une action que le serveur ne sait pas honorer n'a rien à faire dans
//  un bouton.** Les cinq actions de combat ont été résolues côté relève
//  avant que cette barre ne les propose — d'abord le vocabulaire
//  (0048), puis la résolution, puis la Poké Ball et les objets (0050).
//
//  ── ET QUATRE D'ENTRE ELLES DEMANDENT « LAQUELLE » ──────────────────
//
//  Attaquer avec quoi, lancer quelle ball, utiliser quel objet, envoyer
//  qui. Un menu déroulant par bouton, et pas une liste à nous : un
//  `<select>` est un seul élément, il se navigue au clavier sans qu'on
//  écrive une ligne pour ça, et il n'y en a jamais plus de huit options.
//  Un faux menu construit à la main serait du travail en plus pour un
//  résultat moins bon.
//
//  LE MENU NE PARAÎT QUE SOUS LE BOUTON CHOISI. Quatre menus ouverts en
//  permanence feraient une barre illisible, et trois d'entre eux
//  parleraient d'une action qu'on n'a pas demandée.
// ════════════════════════════════════════════════════════════════════

import {
  avecAction,
  avecLaCloture,
  clotureDemandee,
  sansAction,
  sansLaCloture,
} from "../../navigateur/redaction.ts";
import { type Action, actionDe } from "../../domaine/action.ts";
import type { Brouillon } from "./editeur.ts";

/** Les quatre choix. `rien` en est un à part entière — c'est celui de
 *  départ, et il a son bouton.
 *
 *  LE VOCABULAIRE DU DOMAINE EST PLUS LARGE QUE CELUI-LÀ depuis le
 *  18 novembre : `attaquer`, `ball`, `objet`, `changer`, `fuir` existent
 *  dans `domaine/action.ts`, parce que le serveur apprend à les honorer.
 *  La barre ne les offre PAS encore, et c'est la règle écrite dans
 *  `action.ts` : une action que le serveur ne sait pas honorer n'a rien
 *  à faire dans un bouton.
 *
 *  Conséquence à tenir, et c'est `offerte()` plus bas : un brouillon
 *  repris peut porter un bloc que cette barre n'offre pas. Elle ne doit
 *  ni l'afficher comme un choix, ni le laisser partir en silence. */
type Cle =
  | "rien"
  | "chercher"
  | "fouiller"
  | "cloture"
  | "attaquer"
  | "ball"
  | "objet"
  | "changer"
  | "fuir"
  | "defier"
  | "accepter";

/** Lequel des deux jeux la barre sert. */
/** Les trois jeux de choix.
 *
 *  `nouveau` est celui du FORMULAIRE DE CRÉATION D'UN SUJET — demandé
 *  le 18 novembre : « quand je crée un sujet, dans les zones sauvages,
 *  il faut pouvoir déjà avoir les options ». C'est `hors` moins la
 *  clôture : on ne clôt pas un sujet qui n'existe pas encore, et un
 *  bouton qui écrirait `[cloture]` dans le premier message ferait
 *  fermer le sujet par la relève à la seconde où il s'ouvre. */
/** Les cinq jeux de choix.
 *
 *  ── ET LE DUEL EN FAIT DEUX, PAS UN ─────────────────────────────────
 *
 *  `duel` est servi à celui qui a la main ; `attente` à l'autre. C'est
 *  la différence avec un combat sauvage, où le joueur a toujours la
 *  main parce que le sauvage ne poste pas.
 *
 *  POURQUOI DEUX JEUX ET PAS DES BOUTONS DÉSACTIVÉS : un bouton gris
 *  qu'on ne peut pas cliquer ne dit pas POURQUOI, et il laisse croire
 *  à une panne. Les choix de `attente` sont ceux qui marchent — poster
 *  son RP, clôturer — et la phrase dit qui doit frapper. Le joueur
 *  n'apprend pas la règle en dépensant un message. */
export type Jeu = "hors" | "nouveau" | "combat" | "duel" | "attente";

/** Dit si une action est une de celles que le jeu courant propose.
 *
 *  POURQUOI CE CONTRÔLE EXISTE : le compilateur l'a réclamé le
 *  18 novembre, à la minute où le domaine s'est ouvert au combat.
 *  `this.#action?.type` pouvait soudain valoir « attaquer », que `Cle`
 *  ne connaissait pas. La réponse facile aurait été d'élargir `Cle` et
 *  de s'arrêter là ; elle aurait donné une barre qui affiche « Ne rien
 *  faire » sur un message portant `[[WM-ACTION:attaquer:52]]`, et qui
 *  l'envoie quand même.
 *
 *  CE QUI EST AFFICHÉ EST CE QUI PART. Une action hors du jeu courant
 *  n'est donc pas un choix, et son bloc est retiré à l'envoi — un
 *  brouillon repris après la fin d'un combat ne doit pas rejouer un
 *  tour qui n'existe plus.
 *
 *  Et ce n'est pas une garde théorique : un combat se termine pendant
 *  qu'on rédige, la barre repasse hors combat, et le texte garde son
 *  `[[WM-ACTION:attaquer:52]]`.
 */
function offerte(action: Action | null, jeu: readonly Choix[]): Action | null {
  if (action === null) return null;
  return jeu.some((c) => c.cle === action.type) ? action : null;
}

//  ── LES QUATRE ICÔNES ────────────────────────────────────────────
//
//  « Ce serait bien d'avoir une icône pour chaque action », 17 novembre.
//
//  MÊME FABRIQUE QUE LE COIN D'OUTILS : viewBox de 16, `currentColor`,
//  `aria-hidden`. Elles suivent donc la couleur du bouton — y compris
//  quand il est coché et que le texte passe en clair — et aucune n'est
//  annoncée deux fois : le libellé reste écrit à côté.
//
//  CHACUNE DIT CE QUE LE JOUEUR FAIT, pas ce que le code fait : une
//  bulle pour un message qui part comme les autres, des herbes hautes
//  pour la rencontre — c'est le signe que tout le monde connaît —, une
//  loupe pour la fouille, un cadenas pour la clôture, qui est le mot
//  des forums pour un sujet verrouillé.
const SVG = "http://www.w3.org/2000/svg";

function dessin(doc: Document, traces: readonly (readonly [string, string])[]): SVGSVGElement {
  const racine = doc.createElementNS(SVG, "svg");
  racine.setAttribute("viewBox", "0 0 16 16");
  racine.setAttribute("class", "wm-barre__icone");
  racine.setAttribute("aria-hidden", "true");
  racine.setAttribute("focusable", "false");
  for (const [d, largeur] of traces) {
    const p = doc.createElementNS(SVG, "path");
    p.setAttribute("d", d);
    p.setAttribute("fill", "none");
    p.setAttribute("stroke", "currentColor");
    p.setAttribute("stroke-width", largeur);
    p.setAttribute("stroke-linecap", "round");
    p.setAttribute("stroke-linejoin", "round");
    racine.appendChild(p);
  }
  return racine;
}

const ICONES: Record<Cle, (doc: Document) => SVGSVGElement> = {
  //  Une bulle de message : ce qui part quand on ne demande rien.
  rien: (d) =>
    dessin(d, [[
      "M2.7 3.4h10.6a1.6 1.6 0 0 1 1.6 1.6v5a1.6 1.6 0 0 1-1.6 1.6H7l-3.1 2.3v-2.3H2.7A1.6 1.6 0 0 1 1.1 10V5a1.6 1.6 0 0 1 1.6-1.6Z",
      "1.5",
    ]]),
  //  Des herbes hautes : trois brins qui s'ouvrent en éventail.
  //
  //  PREMIER JET RATÉ, ET C'EST LE RENDU QUI L'A DIT : les trois brins
  //  montaient tous vers la droite et un trait de sol les fermait en
  //  bas. À 17 px, ça ne faisait pas des herbes, ça faisait une tente.
  //  Un dessin se regarde à sa taille, pas dans son `viewBox`.
  chercher: (d) =>
    dessin(d, [
      ["M4 14.3C4 10.2 3.1 7.7 1.6 5.9", "1.6"],
      ["M8 14.3C8 9.2 7.9 5.3 7.6 2.3", "1.6"],
      ["M12 14.3C12 10.2 12.9 7.7 14.4 5.9", "1.6"],
    ]),
  //  Une loupe : on retourne la zone.
  fouiller: (d) =>
    dessin(d, [
      ["M11.1 7a4.2 4.2 0 1 1-8.4 0 4.2 4.2 0 0 1 8.4 0Z", "1.6"],
      ["M10.2 10.2 14 14", "1.8"],
    ]),
  //  ── LES CINQ DU COMBAT ───────────────────────────────────────────
  //
  //  MÊME RÈGLE QUE LES QUATRE AUTRES : chacune dit ce que le joueur
  //  FAIT, pas ce que le code fait, et chacune se regarde à 17 px —
  //  c'est à cette taille que la première herbe ressemblait à une
  //  tente.
  //
  //  Un éclair : frapper.
  attaquer: (d) => dessin(d, [["M9.6 1.6 3.2 9.2h3.9l-.7 5.2 6.4-7.6H8.9l.7-5.2Z", "1.5"]]),
  //  Un cercle coupé en deux par une bande, avec son bouton : une
  //  Poké Ball, le dessin que tout le monde reconnaît.
  ball: (d) =>
    dessin(d, [
      ["M14.4 8a6.4 6.4 0 1 1-12.8 0 6.4 6.4 0 0 1 12.8 0Z", "1.5"],
      ["M1.6 8h3.9", "1.5"],
      ["M10.5 8h3.9", "1.5"],
      ["M10.1 8a2.1 2.1 0 1 1-4.2 0 2.1 2.1 0 0 1 4.2 0Z", "1.5"],
    ]),
  //  Un flacon : l'objet qu'on sort du sac.
  objet: (d) =>
    dessin(d, [
      ["M6.4 1.8h3.2", "1.6"],
      [
        "M6.9 1.8v3L4.6 8.6a2.4 2.4 0 0 0-.4 1.3v2.4a1.9 1.9 0 0 0 1.9 1.9h3.8a1.9 1.9 0 0 0 1.9-1.9V9.9a2.4 2.4 0 0 0-.4-1.3L9.1 4.8v-3",
        "1.5",
      ],
      ["M4.5 10.4h7", "1.5"],
    ]),
  //  Deux flèches qui s'échangent : on change de Pokémon.
  changer: (d) =>
    dessin(d, [
      ["M2.4 5.4h9.3", "1.6"],
      ["M9.2 2.9l2.5 2.5-2.5 2.5", "1.6"],
      ["M13.6 10.6H4.3", "1.6"],
      ["M6.8 8.1 4.3 10.6l2.5 2.5", "1.6"],
    ]),
  //  Une porte avec une flèche qui sort : fuir. Pas un pied qui court —
  //  à 17 px un bonhomme n'est qu'une tache.
  fuir: (d) =>
    dessin(d, [
      ["M9.6 2.4H4.3a1.3 1.3 0 0 0-1.3 1.3v8.6a1.3 1.3 0 0 0 1.3 1.3h5.3", "1.5"],
      ["M8 8h6", "1.6"],
      ["M11.5 5.5 14 8l-2.5 2.5", "1.6"],
    ]),
  //  ── LES DEUX DU DÉFI ─────────────────────────────────────────────
  //
  //  Deux lames croisées : le signe du « contre », celui que tout le
  //  monde lit sans l'avoir appris. Deux traits qui se croisent et
  //  deux gardes courtes — à 17 px, une poignée dessinée en détail ne
  //  serait qu'un pâté.
  defier: (d) =>
    dessin(d, [
      ["M3.2 2.9 11 12.4", "1.6"],
      ["M12.8 2.9 5 12.4", "1.6"],
      ["M2.2 12 4.6 14.4", "1.5"],
      ["M13.8 12 11.4 14.4", "1.5"],
    ]),
  //  Une coche : accepter, c'est dire oui. Pas une main tendue — deux
  //  mains à cette taille ne se distinguent pas d'un nœud.
  accepter: (d) => dessin(d, [["M2.6 8.4 6.3 12.1 13.4 4.4", "1.9"]]),
  //  Un cadenas : le mot des forums pour un sujet qui se ferme.
  cloture: (d) =>
    dessin(d, [
      [
        "M4.4 7.2h7.2a1.3 1.3 0 0 1 1.3 1.3v4.3a1.3 1.3 0 0 1-1.3 1.3H4.4a1.3 1.3 0 0 1-1.3-1.3V8.5a1.3 1.3 0 0 1 1.3-1.3Z",
        "1.5",
      ],
      ["M5.7 7.2V5.3a2.3 2.3 0 0 1 4.6 0v1.9", "1.5"],
    ]),
};

type Choix = {
  readonly cle: Cle;
  readonly libelle: string;
  /** La phrase sous les boutons, en français, qui dit ce qui partira. */
  readonly annonce: string;
  /** « Clôturer doit apparaître de manière un peu secondaire » : il est
   *  dans le même groupe, sur sa propre rangée, en plus calme. */
  readonly secondaire?: true;
  /** Quelle liste ce choix ouvre, quand il en ouvre une. Le menu ne
   *  paraît que sous le bouton choisi. */
  readonly liste?: "capacite" | "ball" | "objet" | "equipe";
  /** Ce que le menu dit quand il est vide — « tu n'as pas de ball » se
   *  lit, un menu vide ne dit rien. */
  readonly vide?: string;
};

/** LA CLÔTURE, SORTIE DE SA LISTE — et pas par goût du rangement.
 *
 *  ELLE SE LIT DANS LE TEXTE, pas dans un champ à nous : le joueur
 *  écrit `[cloture]` et l'efface à la main. `get choix()` la rend donc
 *  COCHÉE même dans un jeu qui ne l'offre pas, et son commentaire le
 *  disait depuis le 18 novembre : « on le dit par la phrase plutôt que
 *  de la cacher ».
 *
 *  SAUF QUE LA PHRASE NE VENAIT PAS. `#rafraichir` cherchait l'annonce
 *  dans le jeu courant, et le jeu de combat n'a pas de clôture : la
 *  note restait VIDE. Un joueur qui tapait le mot pendant un combat
 *  voyait tous les boutons décochés et pas un mot d'explication.
 *
 *  Un seul objet, nommé, retrouvé par `#annonceDe` quel que soit le
 *  jeu — c'est ce qui rend la promesse vraie. */
const CLOTURE: Choix = {
  cle: "cloture",
  libelle: "Clôturer le sujet",
  annonce: "Quand tu enverras ce message, le sujet sera clôturé. " +
    "Le mot « [cloture] » est écrit à la fin de ton texte : tu peux l'effacer à la main.",
  secondaire: true,
};

const HORS_COMBAT: readonly Choix[] = [
  {
    cle: "rien",
    libelle: "Ne rien faire",
    annonce: "Ton message part comme un message normal. Rien n'est envoyé sans toi.",
  },
  {
    //  LES MOTS SONT CEUX DE CALLISTA : « soit je fais rien, soit je
    //  fouille la zone, soit je fais apparaître un pokémon ». Le libellé
    //  disait « Chercher », et elle a demandé ce que ça voulait dire —
    //  un bouton qu'il faut expliquer est mal nommé.
    cle: "chercher",
    libelle: "Faire apparaître un Pokémon",
    annonce: "Quand tu enverras ce message, tu fais apparaître un Pokémon.",
  },
  {
    cle: "fouiller",
    libelle: "Fouiller la zone",
    annonce: "Quand tu enverras ce message, tu fouilles la zone.",
  },
  CLOTURE,
];

/** LES CINQ DU COMBAT, dans l'ordre de la planche 99 §4 : attaquer,
 *  lancer une Poké Ball, utiliser un objet, changer de Pokémon, fuir.
 *
 *  « NE RIEN FAIRE » N'EST PAS DANS CE JEU, et c'est volontaire : en
 *  combat, poster sans agir laisse le tour au sauvage et le joueur
 *  prend des coups pour rien. Le choix de départ est donc « attaquer »,
 *  le plus courant — et fuir reste à un clic. */
const EN_COMBAT: readonly Choix[] = [
  {
    cle: "attaquer",
    libelle: "Attaquer",
    annonce: "Quand tu enverras ce message, ton Pokémon attaquera.",
    liste: "capacite",
    vide: "Ton Pokémon ne connaît aucune capacité.",
  },
  {
    cle: "ball",
    libelle: "Lancer une Poké Ball",
    annonce: "Quand tu enverras ce message, tu lanceras la ball choisie. " +
      "Elle est dépensée, prise ou pas.",
    liste: "ball",
    vide: "Tu n'as aucune Poké Ball dans ton sac.",
  },
  {
    cle: "objet",
    libelle: "Utiliser un objet",
    annonce: "Quand tu enverras ce message, tu utiliseras l'objet choisi. " +
      "Le sauvage attaquera quand même.",
    liste: "objet",
    vide: "Tu n'as aucun objet utilisable en combat.",
  },
  {
    cle: "changer",
    libelle: "Changer de Pokémon",
    annonce: "Quand tu enverras ce message, tu enverras ce Pokémon à la " +
      "place. Ça coûte le tour : le sauvage attaquera.",
    liste: "equipe",
    vide: "Tu n'as aucun autre Pokémon en état de se battre.",
  },
  {
    cle: "fuir",
    libelle: "Fuir",
    annonce: "Quand tu enverras ce message, tu quitteras le combat.",
    secondaire: true,
  },
];

/** ── LE DUEL, POUR CELUI QUI A LA MAIN ───────────────────────────────
 *
 *  DEUX CHOIX, ET L'ABSENCE DES TROIS AUTRES EST LA PARTIE QUI COMPTE.
 *  La `0061` refuse la ball, l'objet et le changement dans un duel, et
 *  chacun pour une raison différente :
 *
 *    · LA BALL n'a pas de sens — on n'attrape pas le Pokémon de
 *      quelqu'un, et ça ne changera pas ;
 *    · L'OBJET attend une règle : l'annexe n'en dit qu'une chose,
 *      « cela compte comme un tour » ;
 *    · CHANGER DE POKÉMON n'est pas tranché. Dans un combat sauvage,
 *      changer coûte le tour parce que le sauvage frappe pendant ce
 *      temps. Dans un duel, personne ne frappe automatiquement : est-ce
 *      que changer passe la main sans plus, ou l'adversaire gagne-t-il
 *      un coup gratuit ? C'est une RÈGLE DE JEU, et Callista ne l'a pas
 *      posée.
 *
 *  LES OFFRIR QUAND MÊME AURAIT ÉTÉ PIRE QUE DE LES TAIRE : la barre
 *  les aurait proposés, la relève les aurait refusés, et le joueur
 *  aurait dépensé un message pour apprendre une règle qu'on pouvait
 *  lire avant de cliquer. C'est la règle de `domaine/action.ts`, dans
 *  l'autre sens : **une action que le serveur refuse n'a rien à faire
 *  dans un bouton.** */
const EN_DUEL: readonly Choix[] = [
  {
    //  MÊME CLÉ, MÊME ACTION, AUTRE MOT. « Attaquer » vise un sauvage ;
    //  ici on frappe le Pokémon d'un dresseur, et c'est le mot de la
    //  0061 — un tour de duel est UNE frappe.
    cle: "attaquer",
    libelle: "Frapper",
    annonce: "Quand tu enverras ce message, ton Pokémon frappera, et ce " +
      "sera à l'autre dresseur de répondre.",
    liste: "capacite",
    vide: "Ton Pokémon ne connaît aucune capacité.",
  },
  {
    //  « FUIR » DANS LE TEXTE, « FORFAIT » À L'ÉCRAN. Le bloc reste
    //  `[[WM-ACTION:fuir]]` — un seul verbe pour « je sors de ce
    //  combat », et la 0061 en tire une défaite dans un duel. Mais
    //  « fuir » devant un dresseur, ce n'est pas s'échapper : c'est
    //  lui donner la victoire, et le bouton doit le dire.
    cle: "fuir",
    libelle: "Déclarer forfait",
    annonce: "Quand tu enverras ce message, tu abandonnes le duel. " +
      "L'autre dresseur gagne.",
    secondaire: true,
  },
];

/** ── ET POUR CELUI QUI ATTEND SON TOUR ───────────────────────────────
 *
 *  « Ne rien faire » et la clôture. Pas « Frapper » : la base le
 *  refuserait avec `PAS_TON_TOUR` (0061), et le refus arriverait APRÈS
 *  le message posté.
 *
 *  LA CLÔTURE RESTE, ET C'EST LA SEULE SORTIE D'UN DUEL QUI S'ARRÊTE.
 *  Renoncer demande la main — donc un joueur dont l'adversaire ne
 *  reposte jamais ne peut pas déclarer forfait. Il peut clôturer le
 *  sujet, et le duel se ferme avec lui. Retirer la clôture d'ici aurait
 *  fait un fil sans issue. */
const EN_ATTENTE: readonly Choix[] = [
  {
    cle: "rien",
    libelle: "Ne rien faire",
    annonce: "Ton message part comme un message normal. Rien n'est envoyé sans toi.",
  },
  {
    cle: "cloture",
    libelle: "Clôturer le sujet",
    annonce: "Quand tu enverras ce message, le sujet sera clôturé, et le " +
      "duel avec lui. Le mot « [cloture] » est écrit à la fin de ton " +
      "texte : tu peux l'effacer à la main.",
    secondaire: true,
  },
];

/** ── LE DÉFI, AJOUTÉ AUX CHOIX HORS COMBAT ───────────────────────────
 *
 *  PAS UN SIXIÈME JEU : défier, c'est une action de plus sur un sujet
 *  ordinaire, à côté de « faire apparaître » et « fouiller ». Un jeu à
 *  part aurait voulu dire que le reste disparaît, et il n'y a aucune
 *  raison qu'il disparaisse.
 *
 *  LES DEUX NE PARAISSENT JAMAIS ENSEMBLE. `defi_du_sujet` dit s'il y
 *  en a un d'ouvert et s'il est de celui qui regarde :
 *
 *    · aucun défi        → « Défier » ;
 *    · un défi, le sien  → ni l'un ni l'autre, et la phrase dit qu'il
 *                          attend ;
 *    · un défi, d'un autre → « Accepter le défi ».
 *
 *  ON N'ACCEPTE PAS SON PROPRE DÉFI, et la base le refuse déjà
 *  (`combat_pas_contre_soi`). Le bouton ne doit pas l'offrir : un
 *  contrôle qui existe pour être refusé est un piège. */
const DEFIER: Choix = {
  cle: "defier",
  libelle: "Défier un dresseur",
  annonce: "Quand tu enverras ce message, tu lances un défi. " +
    "Le premier dresseur qui l'accepte dans ce sujet devient ton adversaire.",
};

const ACCEPTER: Choix = {
  cle: "accepter",
  libelle: "Accepter le défi",
  annonce: "Quand tu enverras ce message, le duel s'ouvre. " +
    "C'est le dresseur qui a défié qui frappe le premier.",
};

/** La phrase servie à celui qui a lancé un défi et attend preneur.
 *
 *  ELLE REMPLACE UN BOUTON ABSENT, et c'est pour ça qu'elle existe :
 *  sans elle, un joueur qui a défié voit son bouton « Défier »
 *  disparaître sans explication et croit que son message n'est pas
 *  passé. */
export const DEFI_LANCE = "Ton défi est lancé. Il attend qu'un dresseur l'accepte dans ce " +
  "sujet — tant que personne ne l'a pris, tu peux poster normalement.";

/** Ce que lit celui dont ce n'est pas le tour, dans un duel.
 *
 *  LE PSEUDO QUAND ON L'A, parce que « ce n'est pas ton tour » laisse
 *  chercher qui on attend — et dans un sujet à plusieurs, ce n'est pas
 *  évident. */
export function attenteDuDuel(adverse: string | null): string {
  return adverse === null
    ? "C'est à l'autre dresseur de frapper. Tu pourras répondre après son coup."
    : `C'est à ${adverse} de frapper. Tu pourras répondre après son coup.`;
}

/** LES MÊMES CHOIX, MOINS LA CLÔTURE — dérivés, pas recopiés.
 *
 *  Une seconde liste écrite à la main divergerait à la première
 *  retouche d'un libellé, et c'est justement le libellé que Callista
 *  reprend le plus souvent. */
const NOUVEAU_SUJET: readonly Choix[] = HORS_COMBAT.filter(
  (c) => c.cle !== "cloture",
);

/** La phrase d'attente, sous les choix.
 *
 *  CINQ MINUTES EST LE PAS DE LA RELÈVE, et on ne l'écrit pas : une
 *  minute de retard sur une promesse chiffrée se lit comme une panne.
 *  « Quelques minutes » est vrai même quand le passage a pris du
 *  retard, et c'est ce qu'il faut dire. */
export const ATTENTE = "Le Maître du Jeu répond dans les minutes qui suivent, pas tout de " +
  "suite. Inutile de reposter : un message ne joue qu'un tour.";

/** Ce que disent les quatre choix à menu quand la lecture privée n'a
 *  rien rendu : un combat est bien ouvert, mais on ne sait pas avec
 *  quoi le joueur peut agir.
 *
 *  ON NE REPREND PAS LE `vide` DU CHOIX. « Tu n'as aucune Poké Ball »
 *  serait un mensonge : on n'a pas lu son sac, on ne sait pas ce qu'il
 *  y a dedans. Dire « pas pu être lus » est la seule phrase vraie, et
 *  elle dit aussi où regarder. */
export const SOURD = "Le Maître du Jeu ne peut pas lire ton équipe, ton sac ni tes " +
  "capacités : attaquer, lancer une ball, utiliser un objet et changer de Pokémon " +
  "sont hors de portée tant que le carnet n'est pas relié. Fuir, lui, ne demande " +
  "rien et reste possible.";

/** Où l'on relie son carnet. La même adresse que la barre latérale et
 *  que le menu du compte — elle est dans `data/navigation.json`, mais
 *  la barre d'actions ne lit aucun fichier et n'en lira pas un pour
 *  une ligne. Si elle change, le garde-fou n° 31 le dira. */
export const ADRESSE_DU_CARNET = "/h17-mon-carnet";

export const JEUX: Record<Jeu, readonly Choix[]> = {
  hors: HORS_COMBAT,
  nouveau: NOUVEAU_SUJET,
  combat: EN_COMBAT,
  duel: EN_DUEL,
  attente: EN_ATTENTE,
};

/** L'action que porte un choix, ou `null` pour ceux qui n'en demandent
 *  aucune.
 *
 *  `argument` est l'identifiant choisi dans le menu — la capacité,
 *  l'objet, la case d'équipe. SANS LUI, LES QUATRE CHOIX À MENU NE
 *  RENDENT RIEN : « attaque avec n'importe laquelle » serait une
 *  décision prise à la place du joueur, et `domaine/action.ts` refuse
 *  déjà un bloc sans argument. Autant ne pas l'écrire. */
function actionDuChoix(cle: Cle, argument: number | null): Action | null {
  if (cle === "chercher" || cle === "fouiller") return { type: cle };
  //  LES TROIS SANS ARGUMENT. `defier` et `accepter` ne nomment
  //  personne — c'est l'acceptation qui désigne l'adversaire, et il n'y
  //  a qu'un défi ouvert par sujet.
  if (cle === "fuir" || cle === "defier" || cle === "accepter") return { type: cle };
  if (argument === null) return null;
  if (cle === "attaquer") return { type: "attaquer", capacite: argument };
  if (cle === "ball") return { type: "ball", objetId: argument };
  if (cle === "objet") return { type: "objet", objetId: argument };
  if (cle === "changer") return { type: "changer", position: argument };
  return null;
}

/** Ce que `mon_combat` rend, réduit à ce que la barre affiche.
 *
 *  LA BARRE NE CALCULE RIEN : les PV, les capacités, qui se bat déjà —
 *  tout vient de la base. Elle choisit seulement quoi montrer. */
export type DonneesDeCombat = {
  /** `sauvage` ou `duel` — la `0062` le rend. Absent pour une réponse
   *  d'avant cette migration, et la barre le lit comme un sauvage :
   *  c'est le cas qui marchait, et le plus courant de loin. */
  readonly genre?: "sauvage" | "duel";
  /** Est-ce à moi de frapper ? Toujours vrai contre un sauvage — il ne
   *  poste pas, il n'attend rien. */
  readonly aMoi?: boolean;
  /** Le pseudo de l'autre dresseur, dans un duel. */
  readonly adverse?: string | null;
  readonly capacites: readonly {
    readonly id: number;
    readonly nom: string;
    readonly type: string;
    readonly puissance: number;
  }[];
  readonly equipe: readonly {
    readonly position: number | null;
    readonly nom: string;
    readonly surnom: string | null;
    readonly pv: number;
    readonly pvMax: number;
    /** Celui qui se bat déjà. Il paraît dans le menu, DÉSACTIVÉ et dit
     *  comme tel : le retirer ferait croire qu'on l'a perdu. */
    readonly combat: boolean;
  }[];
  readonly sac: readonly {
    readonly objetId: number;
    readonly nom: string;
    readonly famille: string;
    readonly quantite: number;
  }[];
};

/** Ce que `defi_du_sujet` dit, réduit à ce que la barre en fait.
 *
 *  TROIS ÉTATS ET PAS DEUX, et c'est la raison de ce type : « aucun
 *  défi ouvert » et « je n'ai pas pu lire » ne mènent pas au même
 *  bouton. Le premier donne « Défier » ; le second ne donne rien, parce
 *  qu'offrir « Défier » sur un sujet qui porte déjà un défi serait
 *  offrir un bouton que la base refuse (un seul défi ouvert par sujet,
 *  0060). `null` est donc l'absence de réponse, pas l'absence de défi. */
export type EtatDuDefi =
  | { readonly ouvert: false }
  | { readonly ouvert: true; readonly aMoi: boolean };

/** Quel jeu de choix un combat appelle.
 *
 *  UN SAUVAGE N'ATTEND PERSONNE : `aMoi` n'a pas de sens contre lui, et
 *  une réponse d'avant la `0062` n'a pas de `genre` du tout. Les deux
 *  tombent sur `combat`, qui est le cas qui marchait. */
function jeuDuCombat(donnees: DonneesDeCombat | null): Jeu {
  if (donnees === null || donnees.genre !== "duel") return "combat";
  return donnees.aMoi === false ? "attente" : "duel";
}

export class BarreDActions {
  readonly #doc: Document;
  readonly #brouillon: Brouillon;
  readonly #boutons = new Map<Cle, HTMLButtonElement>();
  readonly #menus = new Map<Cle, HTMLSelectElement>();
  #note: HTMLParagraphElement | null = null;
  #attente: HTMLParagraphElement | null = null;
  #action: Action | null = null;
  #jeu: Jeu;
  readonly #depart: "hors" | "nouveau";
  #combat: DonneesDeCombat | null = null;
  #groupe: HTMLElement | null = null;
  #alerte: HTMLElement | null = null;
  /** `null` tant que `defi_du_sujet` n'a pas répondu — voir
   *  `EtatDuDefi` : l'absence de réponse n'est pas l'absence de défi. */
  #defi: EtatDuDefi | null = null;
  /** Le pseudo d'en face, dans un duel. */
  #adverse: string | null = null;
  /** « Un combat tourne dans ce sujet », dit par la lecture PUBLIQUE —
   *  même quand la barre n'y bascule pas. Voir `poserLeDefi`. */
  #combatDansLeSujet = false;

  /** `jeu` est celui des choix SERVIS AU DÉPART, et il n'y en a que
   *  deux de possibles ici : `hors` dans un sujet, `nouveau` sur le
   *  formulaire de création. Le combat, lui, n'arrive jamais au
   *  départ — il demande un aller-retour réseau, et la barre se pose
   *  avant de l'attendre. */
  constructor(doc: Document, brouillon: Brouillon, jeu: "hors" | "nouveau" = "hors") {
    this.#doc = doc;
    this.#brouillon = brouillon;
    this.#jeu = jeu;
    this.#depart = jeu;
  }

  /** Le choix en cours, pour qui veut l'envoyer lui-même (l'essai, le
   *  module de bilan plus tard).
   *
   *  LA CLÔTURE SE LIT DANS LE TEXTE, pas dans un champ à nous : le
   *  joueur l'écrit et l'efface à la main, et le module au-dessus du
   *  premier message la pose aussi. Deux mémoires se contrediraient ;
   *  une seule, non. */
  /** Le jeu de choix servi en ce moment. */
  get jeu(): Jeu {
    return this.#jeu;
  }

  /** Les choix servis en ce moment : ceux du jeu, plus le défi quand il
   *  a sa place.
   *
   *  LE DÉFI NE S'AJOUTE QU'AUX SUJETS SANS COMBAT. `combat` porte deux
   *  index uniques — un combat par message, un seul ouvert par sujet
   *  (0060) : un « Défier » pendant un combat serait un bouton qui se
   *  fait refuser. */
  #lesChoix(): readonly Choix[] {
    const base = JEUX[this.#jeu];
    if (this.#jeu !== "hors" && this.#jeu !== "nouveau") return base;
    //  ── ET UN COMBAT OUVERT SUFFIT, MÊME SI LA BARRE N'Y BASCULE PAS ─
    //
    //  LE HARNAIS A ATTRAPÉ ÇA. Un duel entre deux AUTRES joueurs ne
    //  fait pas basculer la barre — c'est voulu, celui qui passe n'a
    //  rien à y faire — mais le jeu reste `hors`, et « Défier » s'y
    //  ajoutait tranquillement.
    //
    //  `ouvrir_un_defi` l'aurait refusé avec `COMBAT_EN_COURS`, et son
    //  propre commentaire dit pourquoi ce refus existe : « cliqué
    //  pendant qu'un combat tournait ». Le bouton n'a donc pas à être
    //  là — c'est la même règle que les trois refus du duel, et elle
    //  vaut aussi pour le combat sauvage d'un autre joueur.
    if (this.#combatDansLeSujet) return base;
    if (this.#defi === null) return base;
    //  UN DÉFI OUVERT : on l'accepte s'il est d'un autre, et on ne fait
    //  rien s'il est de soi — on n'accepte pas son propre défi, et la
    //  base le refuse déjà (`combat_pas_contre_soi`).
    if (this.#defi.ouvert) return this.#defi.aMoi ? base : [...base, ACCEPTER];
    return [...base, DEFIER];
  }

  /** Dit à la barre ce que `defi_du_sujet` a répondu.
   *
   *  APPELABLE APRÈS COUP, comme `basculerEnCombat` : la lecture
   *  demande le réseau, et la barre se pose avant de l'attendre.
   *
   *  `combatDansLeSujet` EST UNE SECONDE QUESTION, et elle vient de la
   *  lecture PUBLIQUE : un combat peut tourner ici sans que la barre y
   *  bascule — le duel de deux autres joueurs. Dans ce cas il n'y a
   *  pas de défi à lancer, et le dire ici évite un bouton que la base
   *  refuserait (`COMBAT_EN_COURS`). */
  poserLeDefi(etat: EtatDuDefi | null, combatDansLeSujet = false): void {
    this.#defi = etat;
    this.#combatDansLeSujet = combatDansLeSujet;
    this.#action = offerte(actionDe(this.#brouillon.lire()), this.#lesChoix());
    this.#remplirLeGroupe();
    this.#rafraichir();
  }

  /** Le choix de départ du jeu courant.
   *
   *  Hors combat c'est « ne rien faire » ; en combat c'est « attaquer »,
   *  parce que poster sans agir laisserait le tour au sauvage. */
  #parDefaut(): Cle {
    return this.#lesChoix()[0].cle;
  }

  get choix(): Cle {
    if (clotureDemandee(this.#brouillon.lire())) {
      //  LA CLÔTURE N'EST PAS DANS LE JEU DE COMBAT. Si le mot est dans
      //  le texte pendant un combat, elle l'emporte quand même : c'est
      //  le joueur qui l'a écrit, et la relève la lira. On le dit par
      //  la phrase plutôt que de la cacher.
      return "cloture";
    }
    const offert = offerte(this.#action, this.#lesChoix());
    return offert === null ? this.#parDefaut() : offert.type as Cle;
  }

  /** L'action demandée, s'il y en a une. */
  get etat(): Action | null {
    return this.choix === "cloture" ? null : this.#action;
  }

  /** Reflète le choix sur les boutons, les menus et la phrase. */
  #rafraichir(): void {
    const choisi = this.choix;
    for (const choix of this.#lesChoix()) {
      const bouton = this.#boutons.get(choix.cle);
      if (bouton === undefined) continue;
      const coche = choix.cle === choisi;
      bouton.classList.toggle("wm-barre__bouton--choisi", coche);
      bouton.setAttribute("aria-checked", String(coche));
      //  TABINDEX TOURNANT : un groupe de radios est UNE étape de
      //  tabulation, et les flèches s'y déplacent. Sans ça, quatre
      //  boutons séparés — et la tabulation au clavier devient quatre
      //  fois plus longue sur chaque réponse.
      bouton.tabIndex = coche ? 0 : -1;
      //  LE MENU NE PARAÎT QUE SOUS LE BOUTON CHOISI. Quatre menus
      //  ouverts en permanence feraient une barre illisible, et trois
      //  d'entre eux parleraient d'une action qu'on n'a pas demandée.
      //  UN MENU VIDE NE PARAÎT PAS, même sous le choix coché : une
      //  liste déroulante sans rien dedans est un contrôle qui ment.
      //  La phrase en dessous dit pourquoi — « tu n'as aucune Poké
      //  Ball », ou le bloc d'erreur du carnet non relié.
      const menu = this.#menus.get(choix.cle);
      if (menu !== undefined) menu.hidden = !coche || menu.options.length === 0;
    }

    if (this.#note !== null) {
      const trouve = this.#annonceDe(choisi);
      const menu = this.#menus.get(choisi);
      //  UN MENU VIDE SE DIT. « Tu n'as aucune Poké Ball » se lit ; un
      //  menu sans option ne dit rien et laisse croire à une panne.
      //  DEUX RAISONS POUR UN MENU VIDE, ET ELLES NE SE DISENT PAS
      //  PAREIL : soit on a lu son sac et il est vide (`vide`), soit on
      //  n'a pas pu le lire du tout (`SOURD`). La seconde ne doit
      //  jamais emprunter la phrase de la première.
      const sansMenu = menu !== undefined && menu.options.length === 0;
      const sourd = this.#combat === null && trouve?.liste !== undefined;
      //  LA SITUATION PASSE DEVANT L'ANNONCE, parce qu'elle explique
      //  pourquoi le bouton attendu n'est pas là — et une annonce qui
      //  décrit un message normal ne l'explique pas.
      const situation = this.#situation(choisi);
      //  EN COMBAT SOURD, LA NOTE SE TAIT et laisse parler l'alerte :
      //  deux textes qui disent la même chose à dix pixels l'un de
      //  l'autre se lisent moins bien qu'un seul.
      this.#note.textContent = situation ??
        (sourd
          ? "Ce choix demande ton carnet."
          : sansMenu
          ? (trouve?.vide ?? "")
          : (trouve?.annonce ?? ""));
    }

    //  L'ALERTE SUIT L'ÉTAT, ELLE N'EST PAS POSÉE UNE FOIS : la
    //  lecture privée peut arriver APRÈS la barre (un aller-retour
    //  réseau), et le jour où elle arrive, l'alerte doit disparaître
    //  sans que personne recharge la page.
    if (this.#alerte !== null) {
      this.#alerte.hidden = !(this.#jeu === "combat" && this.#combat === null);
    }

    //  ELLE NE PARAÎT QUE SI QUELQU'UN DOIT ATTENDRE. « Ne rien faire »
    //  n'appelle aucune réponse du Maître du Jeu : annoncer un délai
    //  pour un message normal ferait croire qu'on en attend un.
    if (this.#attente !== null) this.#attente.hidden = choisi === "rien";
  }

  /** Le choix qui porte l'annonce à lire, même s'il n'est pas dans le
   *  jeu courant.
   *
   *  LE SEUL CAS EST LA CLÔTURE, et c'est le `CLOTURE` nommé plus haut
   *  qui le règle : elle se coche depuis le TEXTE, donc dans n'importe
   *  quel jeu, y compris ceux qui ne l'offrent pas. Sans ce
   *  rattrapage, la note restait vide. */
  #annonceDe(choisi: Cle): Choix | undefined {
    const trouve = this.#lesChoix().find((c) => c.cle === choisi);
    if (trouve !== undefined) return trouve;
    return choisi === "cloture" ? CLOTURE : undefined;
  }

  /** La phrase qui dit la SITUATION plutôt que le choix.
   *
   *  DEUX CAS, ET LES DEUX SONT UN BOUTON ABSENT. Un joueur qui ne
   *  comprend pas pourquoi « Frapper » ou « Défier » a disparu croit à
   *  une panne et reposte — c'est exactement ce que la phrase d'attente
   *  évite depuis le 18 novembre.
   *
   *  ELLE NE PARLE QUE SOUS LE CHOIX PAR DÉFAUT : si le joueur a cliqué
   *  sur « Clôturer », c'est la clôture qu'il veut lire, pas un rappel
   *  de ce qu'il ne peut pas faire. */
  #situation(choisi: Cle): string | null {
    if (choisi !== this.#parDefaut()) return null;
    if (this.#jeu === "attente") return attenteDuDuel(this.#adverse);
    if (
      (this.#jeu === "hors" || this.#jeu === "nouveau") &&
      this.#defi !== null && this.#defi.ouvert && this.#defi.aMoi
    ) {
      return DEFI_LANCE;
    }
    return null;
  }

  /** Ce qu'un clic produit. Les quatre s'excluent, donc poser l'un
   *  défait l'autre — y compris la clôture, qui vit dans le texte. */
  #poser(cle: Cle): void {
    const texte = this.#brouillon.lire();
    if (cle === "cloture") {
      this.#action = null;
      if (!clotureDemandee(texte)) this.#brouillon.ecrire(avecLaCloture(texte));
    } else {
      this.#action = actionDuChoix(cle, this.#argumentDe(cle));
      if (clotureDemandee(texte)) this.#brouillon.ecrire(sansLaCloture(texte));
    }
    this.#rafraichir();
  }

  /** Ce que le menu de ce choix dit, ou `null` s'il n'y a pas de menu
   *  ou rien à choisir. */
  #argumentDe(cle: Cle): number | null {
    const menu = this.#menus.get(cle);
    if (menu === undefined) return null;
    if (menu.value === "") return null;
    const n = Number(menu.value);
    return Number.isInteger(n) && n > 0 ? n : null;
  }

  /** Le bloc, écrit dans le champ du formulaire au dernier moment.
   *
   *  Appelé par l'écouteur d'envoi — et aussi par la prévisualisation,
   *  qui passe par le même formulaire.
   *
   *  CE QUI EST AFFICHÉ EST CE QUI PART. Un texte repris peut porter un
   *  vieux bloc d'action ET le mot de clôture ; la barre montre alors
   *  « Clôturer », et c'est elle qui a raison — le bloc est retiré. */
  ecrireAvantEnvoi(): void {
    const texte = this.#brouillon.lire();
    if (this.choix === "cloture") {
      //  ON REPOSE LE MOT APRÈS COUP, et ce n'est pas un détour :
      //  retirer le bloc laisse les deux lignes vides qui
      //  l'encadraient, et le joueur se retrouvait avec un trou de
      //  quatre retours avant `[cloture]`. `sansLaCloture` rogne la fin,
      //  `avecLaCloture` la repose à la bonne distance — les deux mêmes
      //  fonctions que les clics, donc une seule règle d'espacement.
      const propre = avecLaCloture(sansLaCloture(sansAction(texte)));
      if (propre !== texte) this.#brouillon.ecrire(propre);
      return;
    }
    //  ── ON PART DU CHOIX AFFICHÉ, PAS DE `#action` ──────────────────
    //
    //  LE HARNAIS A ATTRAPÉ ÇA LE 18 NOVEMBRE. En combat, le choix de
    //  départ est « Attaquer » — un choix qui écrit un bloc, contrairement
    //  à « ne rien faire ». La barre l'affichait coché et n'envoyait
    //  RIEN : `#action` restait nul tant que personne n'avait cliqué,
    //  et c'est `#action` qu'on lisait ici.
    //
    //  Hors combat le défaut est « ne rien faire », donc le vide était
    //  la bonne réponse et le défaut ne pouvait pas se voir. C'est le
    //  genre de faute qu'un second jeu de choix révèle, et pas un
    //  test de plus sur le premier.
    //
    //  CE QUI EST AFFICHÉ EST CE QUI PART : on relit donc le choix
    //  coché et le menu qui l'accompagne, les deux seules choses que le
    //  joueur voit.
    const action = actionDuChoix(this.choix, this.#argumentDe(this.choix));
    if (action === null) {
      //  AUCUNE ACTION, ET POURTANT UN BLOC POSSIBLE : « ne rien
      //  faire », ou un choix à menu dont le menu est vide. Un
      //  brouillon repris peut porter `[[WM-ACTION:attaquer:52]]` d'un
      //  combat terminé — le bloc s'en va.
      const propre = sansAction(texte);
      if (propre !== texte) this.#brouillon.ecrire(propre);
      return;
    }
    this.#brouillon.ecrire(avecAction(texte, action));
  }

  /** Construit la barre et l'accroche DANS le formulaire, juste
   *  au-dessus des boutons d'envoi. */
  poser(apres: Element): HTMLElement {
    //  L'ÉTAT DE DÉPART VIENT DU TEXTE. Un brouillon repris, une
    //  modification, un retour de prévisualisation : le bloc peut déjà
    //  être là, et la barre doit s'ouvrir dessus.
    this.#action = offerte(actionDe(this.#brouillon.lire()), this.#lesChoix());

    const barre = this.#doc.createElement("div");
    barre.className = "wm-barre";

    const entete = this.#doc.createElement("p");
    entete.className = "wm-barre__entete";
    entete.textContent = "Ton tour";
    barre.appendChild(entete);

    //  ── L'ALERTE DU CARNET NON RELIÉ ──────────────────────────────
    //
    //  « Quand le compte n'est pas lié, tu ne peux pas afficher juste
    //  ce petit message. Il faut que ce soit plus clair, que ça
    //  apparaisse comme un bloc d'erreur mis en avant. » — 18
    //  novembre.
    //
    //  ELLE A RAISON, ET LA PREMIÈRE VERSION ÉTAIT UN DEMI-GESTE : une
    //  phrase grise sous les boutons, à la place d'une annonce, dans
    //  un endroit où le joueur ne lit que ce qui change. Un blocage
    //  qui demande une action — relier son carnet — n'est pas une
    //  note de bas de page.
    //
    //  ELLE NAÎT CACHÉE et ne paraît qu'en combat sourd : un bloc
    //  d'erreur visible sur un sujet où tout va bien serait pire que
    //  l'absence de message.
    const alerte = this.#doc.createElement("div");
    alerte.className = "wm-barre__alerte";
    alerte.hidden = true;
    alerte.setAttribute("role", "status");
    //  ── UNE PASTILLE AVEC SON ICÔNE, À GAUCHE ─────────────────────
    //
    //  « Enlève la border top. Et ajoute une petite icône à gauche
    //  dans une petite bulle. » — 18 novembre.
    //
    //  LE FILET DU HAUT PARTAIT POUR DIRE « ATTENTION » par la forme.
    //  Une pastille le dit mieux : elle a un centre, donc un endroit
    //  où l'œil se pose, et elle ne coupe pas le bloc en deux.
    //
    //  `aria-hidden` : le titre juste à côté dit déjà de quoi il
    //  s'agit, et un point d'exclamation annoncé deux fois est du
    //  bruit pour qui écoute la page.
    const pastille = this.#doc.createElement("span");
    pastille.className = "wm-barre__alerte-pastille";
    pastille.setAttribute("aria-hidden", "true");
    pastille.appendChild(this.#doc.createTextNode("!"));

    const alerteTitre = this.#doc.createElement("p");
    alerteTitre.className = "wm-barre__alerte-titre";
    alerteTitre.textContent = "Ton carnet n'est pas relié";
    const alerteTexte = this.#doc.createElement("p");
    alerteTexte.className = "wm-barre__alerte-texte";
    alerteTexte.textContent = SOURD;
    const alerteLien = this.#doc.createElement("a");
    alerteLien.className = "wm-barre__alerte-lien";
    alerteLien.href = ADRESSE_DU_CARNET;
    alerteLien.textContent = "Relier mon carnet";
    //  LA PASTILLE ET LE TITRE SUR LA MÊME LIGNE, le reste dessous :
    //  c'est une grille à deux colonnes, et la pastille tient la
    //  première sur toute la hauteur.
    const tete = this.#doc.createElement("div");
    tete.className = "wm-barre__alerte-tete";
    tete.append(pastille, alerteTitre);
    alerte.append(tete, alerteTexte, alerteLien);
    this.#alerte = alerte;
    barre.appendChild(alerte);

    const groupe = this.#doc.createElement("div");
    groupe.className = "wm-barre__choix";
    groupe.setAttribute("role", "radiogroup");
    groupe.setAttribute("aria-label", "Ce que fait ce message");

    this.#groupe = groupe;
    this.#remplirLeGroupe();
    barre.appendChild(groupe);

    const note = this.#doc.createElement("p");
    note.className = "wm-barre__note";
    this.#note = note;
    barre.appendChild(note);

    //  ── L'ATTENTE SE DIT ──────────────────────────────────────────
    //
    //  Demandé le 18 novembre : « il faut mettre un petit message
    //  aussi au joueur pour dire que lorsqu'on effectue une action,
    //  attendre quelques minutes avant que le maître du jeu poste un
    //  message ».
    //
    //  C'EST LE RYTHME DE LA MÉCANIQUE, PAS UNE LENTEUR À EXCUSER :
    //  la relève passe toutes les cinq minutes (planche 99 §1). Sans
    //  cette phrase, un joueur qui poste et ne voit rien croit que son
    //  action n'a pas été prise — et il la repostera, ce qui ne
    //  produira rien de plus : un message ne joue qu'un tour.
    //
    //  UNE SECONDE LIGNE ET PAS UNE PHRASE AJOUTÉE À L'ANNONCE : les
    //  annonces disent ce que FAIT le choix, et il y en a neuf. Les
    //  allonger toutes des mêmes mots aurait répété la même chose neuf
    //  fois dans le fichier, et dit deux choses dans une même phrase à
    //  l'écran.
    const attente = this.#doc.createElement("p");
    attente.className = "wm-barre__attente";
    attente.textContent = ATTENTE;
    this.#attente = attente;
    barre.appendChild(attente);

    const formulaire = apres.closest("form") ?? apres;
    placer(barre, formulaire);

    //  L'ENVOI, PAR DEUX CHEMINS, et ce n'est pas de la ceinture et des
    //  bretelles :
    //
    //    · l'événement `submit`, en phase de CAPTURE — d'autres scripts
    //      du forum écoutent le même, et l'un d'eux peut arrêter la
    //      propagation avant nous ;
    //    · le clic sur les boutons d'envoi et de prévisualisation, parce
    //      qu'un `form.submit()` appelé en JavaScript **n'émet pas
    //      `submit`**. Forumactif en appelle à plusieurs endroits.
    //
    //  Écrire deux fois ne double rien : `avecAction` remplace le bloc
    //  présent au lieu de l'empiler.
    formulaire.addEventListener("submit", () => this.ecrireAvantEnvoi(), { capture: true });
    for (const envoi of formulaire.querySelectorAll('[type="submit"]')) {
      envoi.addEventListener("click", () => this.ecrireAvantEnvoi(), { capture: true });
    }

    this.#brouillon.surChangement(() => this.#rafraichir());
    this.#rafraichir();
    return barre;
  }

  /** Pose les boutons du jeu courant dans le groupe.
   *
   *  APPELÉE À CHAQUE BASCULE, donc elle doit VIDER d'abord. Un premier
   *  jet qui ajoutait sans vider aurait laissé les quatre boutons hors
   *  combat sous les cinq du combat — neuf boutons dans un groupe de
   *  radios, dont quatre que le serveur refuserait. */
  #remplirLeGroupe(): void {
    const groupe = this.#groupe;
    if (groupe === null) return;
    groupe.textContent = "";
    this.#boutons.clear();
    this.#menus.clear();

    const rangee = this.#doc.createElement("div");
    rangee.className = "wm-barre__rangee";
    const fin = this.#doc.createElement("div");
    fin.className = "wm-barre__rangee wm-barre__rangee--fin";
    for (const choix of this.#lesChoix()) {
      const bouton = this.#bouton(choix);
      (choix.secondaire === true ? fin : rangee).appendChild(bouton);
    }
    groupe.appendChild(rangee);
    groupe.appendChild(fin);

    //  LES MENUS SOUS LE GROUPE, pas dans la rangée : un `<select>`
    //  parmi des `role="radio"` serait annoncé comme un cinquième
    //  bouton du groupe, et les flèches l'attraperaient.
    for (const choix of this.#lesChoix()) {
      if (choix.liste === undefined) continue;
      groupe.appendChild(this.#menu(choix));
    }
  }

  /** Le menu d'un choix, rempli depuis les données du combat. */
  #menu(choix: Choix): HTMLSelectElement {
    const menu = this.#doc.createElement("select");
    menu.className = "wm-barre__menu";
    menu.hidden = true;
    //  UN NOM QUI DIT QUOI, parce que « select » tout court ne se lit
    //  pas au lecteur d'écran.
    menu.setAttribute("aria-label", choix.libelle);

    for (const o of this.#optionsDe(choix)) {
      const option = this.#doc.createElement("option");
      option.value = String(o.valeur);
      option.textContent = o.mot;
      //  CELUI QUI SE BAT DÉJÀ RESTE DANS LA LISTE, désactivé. Le
      //  retirer ferait croire qu'on l'a perdu.
      if (o.inerte === true) option.disabled = true;
      menu.appendChild(option);
    }

    //  CHANGER LE MENU CHANGE L'ACTION. C'est la règle du harnais :
    //  « chaque contrôle que la barre pose change quelque chose ». Le
    //  menu « Où » était parti pour avoir manqué à celle-là.
    menu.addEventListener("change", () => this.#poser(choix.cle));
    this.#menus.set(choix.cle, menu);
    return menu;
  }

  #optionsDe(
    choix: Choix,
  ): readonly { valeur: number; mot: string; inerte?: true }[] {
    const c = this.#combat;
    if (c === null) return [];
    switch (choix.liste) {
      case "capacite":
        //  LE TYPE ET LA PUISSANCE DANS LE MOT : c'est ce qui permet de
        //  choisir sans ouvrir l'annexe des types.
        return c.capacites.map((k) => ({
          valeur: k.id,
          mot: `${k.nom} — ${k.type}, ${k.puissance}`,
        }));
      case "ball":
        return c.sac
          .filter((o) => o.famille === "ball")
          .map((o) => ({ valeur: o.objetId, mot: `${o.nom} (${o.quantite})` }));
      case "objet":
        return c.sac
          .filter((o) => o.famille !== "ball")
          .map((o) => ({ valeur: o.objetId, mot: `${o.nom} (${o.quantite})` }));
      case "equipe":
        return c.equipe
          //  SANS CASE, PAS DE CHOIX POSSIBLE : `changer` désigne une
          //  case, et la base autorise un Pokémon d'équipe sans
          //  position. On ne peut pas cliquer sur ce qui n'a pas de
          //  numéro.
          .filter((m) => m.position !== null)
          .map((m) => ({
            valeur: m.position as number,
            mot: `${m.position}. ${m.surnom ?? m.nom} — ${m.pv}/${m.pvMax} PV` +
              (m.combat ? " (se bat)" : m.pv <= 0 ? " (K.O.)" : ""),
            //  À TERRE OU DÉJÀ SUR LE TERRAIN : inerte. Le serveur le
            //  refuserait de toute façon ; le dire ici évite au joueur
            //  de dépenser un message pour l'apprendre.
            inerte: m.combat || m.pv <= 0 ? true as const : undefined,
          }));
      default:
        return [];
    }
  }

  /** Bascule la barre en combat, avec ce que `mon_combat` a rendu —
   *  ou `null` quand cette lecture-là n'a rien donné.
   *
   *  LE CHOIX EN COURS EST OUBLIÉ, et c'est voulu : « fouiller » n'a
   *  aucun sens dans un combat, et le garder coché en servant d'autres
   *  boutons afficherait un état que le serveur refuserait.
   *
   *  ── `null` EST UN CAS NORMAL, ET IL FAUT LES BOUTONS QUAND MÊME ──
   *
   *  « Quand un combat est ouvert, je n'ai pas les boutons pour le
   *  fermer. » — 18 novembre. La bascule ne tenait qu'à `mon_combat`,
   *  qui demande un laissez-passer : sans lui, la barre servait ses
   *  quatre boutons habituels, et « Fuir » n'était nulle part. Un
   *  combat ouvert devenait une impasse définitive.
   *
   *  OR FUIR N'A BESOIN DE RIEN. Pas d'équipe, pas de sac, pas de
   *  capacités : le bloc est `[[WM-ACTION:fuir]]`, sans argument. La
   *  sortie ne peut donc pas dépendre d'une lecture privée — c'est le
   *  combat OUVERT qui décide des boutons, et `combat_du_sujet` le dit
   *  sans identité (son propre commentaire l'annonçait depuis la
   *  `0047` : « sert à la barre d'actions pour choisir ses boutons »).
   *
   *  Les quatre autres restent là, menus vides, et la phrase dit
   *  pourquoi — voir `SOURD`. */
  /**  ── ET DEPUIS LE 23 NOVEMBRE, LE JEU DÉPEND DU GENRE ────────────
   *
   *  Un duel n'offre pas les mêmes boutons qu'une rencontre, et surtout
   *  il n'offre pas les mêmes aux deux joueurs : celui qui n'a pas la
   *  main ne peut pas frapper, et la base le lui dirait APRÈS son
   *  message. `jeuDuCombat` tranche entre les trois. */
  basculerEnCombat(donnees: DonneesDeCombat | null): void {
    this.#combat = donnees;
    this.#adverse = donnees?.adverse ?? null;
    this.#jeu = jeuDuCombat(donnees);
    this.#action = offerte(actionDe(this.#brouillon.lire()), this.#lesChoix());
    this.#remplirLeGroupe();
    this.#rafraichir();
  }

  /** Repasse hors combat — le combat s'est terminé, ou il n'y en a
   *  jamais eu.
   *
   *  ON REVIENT AU JEU DE DÉPART, pas à `hors` : sur le formulaire de
   *  création, « Clôturer le sujet » n'a pas plus de sens après un
   *  combat qu'avant. */
  basculerHorsCombat(): void {
    this.#combat = null;
    this.#adverse = null;
    this.#jeu = this.#depart;
    this.#action = offerte(actionDe(this.#brouillon.lire()), this.#lesChoix());
    this.#remplirLeGroupe();
    this.#rafraichir();
  }

  #bouton(choix: Choix): HTMLButtonElement {
    const bouton = this.#doc.createElement("button");
    bouton.type = "button";
    bouton.className = "wm-barre__bouton" +
      (choix.secondaire === true ? " wm-barre__bouton--secondaire" : "");
    //  L'ICÔNE N'EST PAS LE LIBELLÉ. Elle est `aria-hidden` et le mot
    //  reste écrit : un bouton dont l'icône porte le sens n'est lisible
    //  que par qui l'a déjà appris.
    bouton.appendChild(ICONES[choix.cle](this.#doc));
    const mot = this.#doc.createElement("span");
    mot.className = "wm-barre__mot";
    mot.textContent = choix.libelle;
    bouton.appendChild(mot);
    bouton.setAttribute("role", "radio");
    bouton.setAttribute("aria-checked", "false");
    bouton.tabIndex = -1;
    bouton.addEventListener("click", () => this.#poser(choix.cle));
    bouton.addEventListener("keydown", (e) => this.#auClavier(e as KeyboardEvent, choix.cle));
    this.#boutons.set(choix.cle, bouton);
    return bouton;
  }

  /** Les flèches déplacent le choix, comme dans n'importe quel groupe de
   *  radios. Annoncer `role="radio"` sans ça serait mentir au clavier. */
  #auClavier(e: KeyboardEvent, cle: Cle): void {
    const pas = SUIVANT[e.key];
    if (pas === undefined) return;
    e.preventDefault();
    const choix = this.#lesChoix();
    const i = choix.findIndex((c) => c.cle === cle);
    const vise = pas === "debut"
      ? 0
      : pas === "fin"
      ? choix.length - 1
      : (i + pas + choix.length) % choix.length;
    this.#poser(choix[vise].cle);
    this.#boutons.get(choix[vise].cle)?.focus();
  }
}

const SUIVANT: Record<string, number | "debut" | "fin" | undefined> = {
  ArrowRight: 1,
  ArrowDown: 1,
  ArrowLeft: -1,
  ArrowUp: -1,
  Home: "debut",
  End: "fin",
};

/** Où la barre se glisse : DANS le formulaire, juste avant la rangée
 *  d'envoi. « En dessous, prévisualiser ou envoyer. »
 *
 *  ON REMONTE DEPUIS LE BOUTON D'ENVOI, et pas depuis un sélecteur de
 *  conteneur : la réponse rapide et la page de rédaction complète n'ont
 *  pas le même balisage, et Forumactif sert la première toute faite
 *  (`{QUICK_REPLY_FORM}`) — on ne la choisit pas.
 *
 *  LA GARDE QUI COMPTE : si en remontant on attrape un bloc qui contient
 *  AUSSI le champ de texte, on s'arrête et on se colle au bouton. Sans
 *  elle, la barre passerait au-dessus de l'éditeur sur tout formulaire
 *  qui range les deux ensemble — et ce serait exactement le contraire de
 *  ce qui est demandé. */
function placer(barre: HTMLElement, formulaire: Element): void {
  const envoi = formulaire.querySelector('[type="submit"]');
  if (envoi === null) {
    formulaire.appendChild(barre);
    return;
  }
  const champ = formulaire.querySelector("textarea");
  let noeud: Element = envoi;
  while (noeud.parentElement !== null && noeud.parentElement !== formulaire) {
    noeud = noeud.parentElement;
  }
  if (champ !== null && noeud.contains(champ)) noeud = envoi;
  noeud.insertAdjacentElement("beforebegin", barre);
  centrerLesEnvois(formulaire, champ);
}

/** « Envoyer et prévisualiser, centrer les deux boutons. »
 *
 *  LES DEUX BOUTONS NE SONT PAS À NOUS : Forumactif sert la réponse
 *  rapide toute faite (`{QUICK_REPLY_FORM}`) et on ne connaît pas son
 *  balisage d'avance — ils peuvent être nus dans le formulaire ou déjà
 *  rangés dans un conteneur. Les deux cas existent, et le harnais monte
 *  les deux.
 *
 *  ON NE DÉPLACE QUE SI C'EST NÉCESSAIRE. Si un conteneur ne tient
 *  QU'EUX, on l'habille — c'est le geste le plus léger, et rien ne
 *  bouge dans l'arbre. Sinon on les enveloppe, à leur place, dans l'ordre
 *  où ils étaient : un script du forum qui les retrouve par `name` ou
 *  par `id` s'y retrouve toujours, et aucun n'est perdu en route. */
function centrerLesEnvois(formulaire: Element, champ: Element | null): void {
  const envois = [...formulaire.querySelectorAll('[type="submit"]')];
  if (envois.length === 0) return;

  const parent = envois[0].parentElement;
  if (
    parent !== null && parent !== formulaire &&
    (champ === null || !parent.contains(champ)) &&
    envois.every((e) => e.parentElement === parent) &&
    //  LES CHAMPS CACHÉS NE COMPTENT PAS : Forumactif en pose à côté
    //  des boutons, et exiger un conteneur parfaitement pur ferait
    //  créer une boîte de plus pour rien.
    [...parent.children].every((e) => envois.includes(e) || e.getAttribute("type") === "hidden")
  ) {
    parent.classList.add("wm-envois");
    return;
  }

  //  LA PLAGE, ET PAS SEULEMENT LES BOUTONS : entre « Envoyer » et
  //  « Prévisualisation » Forumactif glisse des champs cachés et du
  //  texte. Les emporter garde l'ordre d'origine ; les laisser
  //  derrière couperait le formulaire en deux.
  const freres = [...(envois[0].parentElement?.childNodes ?? [])];
  const premier = freres.indexOf(envois[0]);
  const dernier = freres.indexOf(envois[envois.length - 1]);
  if (premier < 0 || dernier < premier) return;

  const boite = formulaire.ownerDocument.createElement("div");
  boite.className = "wm-envois";
  envois[0].parentElement?.insertBefore(boite, envois[0]);
  for (const n of freres.slice(premier, dernier + 1)) boite.appendChild(n);
}
