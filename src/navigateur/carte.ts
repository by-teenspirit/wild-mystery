// ════════════════════════════════════════════════════════════════════
//  src/navigateur/carte.ts
//
//  La carte de Rhode : les RÈGLES, sans une ligne de DOM.
//
//  ── CE QUE CE FICHIER DÉCIDE ────────────────────────────────────────
//
//  Trois choses, et elles tiennent toutes les trois en une phrase :
//
//  1. ce qu'est un lieu lisible — et ce qu'on fait d'un lieu bancal ;
//  2. où l'on se trouve quand on se déplace dans la carte, et jusqu'où
//     on peut aller ;
//  3. comment un comptage relevé ailleurs vient se poser sur un lieu.
//
//  Le dessin, le panneau, la liste et la souris sont dans
//  `src/adaptateurs/navigateur/module-carte.ts`.
//
//  ── POURQUOI LE DÉPLACEMENT EST ICI ET PAS DANS LE MODULE ───────────
//
//  Parce que c'est de l'arithmétique, et que l'arithmétique d'une carte
//  qu'on traîne à la souris est exactement le genre de code qui se
//  trompe d'un signe et qu'on ne voit qu'en ligne, sur un écran étroit,
//  un jour où on cherchait autre chose. `deplacer` et `borner` se
//  testent en une ligne chacun.
//
//  ── LA COULEUR NE DIT JAMAIS RIEN TOUTE SEULE ───────────────────────
//
//  Callista veut « un code couleur ville, un code couleur pour les
//  zones palier 1, palier 2, palier 3 ». On le fait — et on écrit le
//  palier EN TOUTES LETTRES partout où la couleur le dit : sur la
//  vignette de la liste, dans le panneau, et dans le nom accessible de
//  la forme. Un joueur daltonien ne doit pas avoir à deviner, et il y
//  en a un sur douze.
// ════════════════════════════════════════════════════════════════════

/** Ce qu'un lieu de la carte est, une fois relu. */
export type Lieu = {
  /** L'identifiant Forumactif, qui fait le lien avec la page du forum. */
  readonly forumId: number;
  readonly nom: string;
  /** `zone` se parcourt, `ville` s'habite, `ligue` s'arpente sur
   *  invitation. Les trois se dessinent autrement. */
  readonly type: "zone" | "ville" | "ligue";
  /** 1, 2 ou 3 pour une zone ; absent pour le reste. */
  readonly palier?: 1 | 2 | 3;
  /** Les niveaux recommandés, écrits tels qu'on les affiche. */
  readonly niveau: string;
  readonly description: string;
  /** Le contour, en chemin SVG. Les villes n'en ont pas : ce sont des
   *  épingles, pas des territoires. */
  readonly forme?: string;
  /** Où poser la forme ou l'épingle, dans le repère de la carte. */
  readonly ancre: { readonly x: number; readonly y: number };
  /** Où poser le NOM, qui n'est pas forcément sur le lieu.
   *
   *  VINGT-SIX NOMS SUR 1000 × 640 SE MARCHENT DESSUS : « Mont
   *  Bataille » tombait sur « Suerebe », « Phenacit » sur « Fleuve
   *  Paisible ». Les positions sont écartées une fois pour toutes
   *  dans `data/carte.json`, par relaxation, et pas à l'exécution :
   *  la carte doit être la même à chaque chargement, et mesurer du
   *  texte à chaque redessin coûterait cher pour rien.
   *
   *  Absente, le nom se pose sur l'ancre — c'est le cas d'une carte
   *  écrite à la main. */
  readonly etiquette?: { readonly x: number; readonly y: number };
  /** L'image d'en-tête du panneau, demandée le 8 octobre : « on doit
   *  avoir une image ou un fond pour chaque catégorie ».
   *
   *  ABSENTE, LE PANNEAU NE MET PAS DE TROU : la feuille 16 retombe
   *  sur `--wm-bandeau-categorie`, le même bandeau que les en-têtes
   *  de catégorie. Aucun lieu n'a encore la sienne — il faut
   *  vingt-six images, et elles n'existent pas. */
  readonly image?: string;
};

/** Le repère dans lequel toutes les coordonnées sont écrites. */
export type Repere = { readonly largeur: number; readonly hauteur: number };

/** La mer, calculée par `outils/carte-mer.py` depuis le contour du
 *  continent.
 *
 *  ── POURQUOI ELLE EST DANS LE SVG ET PAS EN IMAGE DE FOND ───────────
 *
 *  Une image posée sur le cadre ne suivrait ni le déplacement ni le
 *  zoom : on traînerait le continent sur une mer immobile. Et elle ne
 *  se calerait pas — le SVG se met à l'échelle en `meet`, un fond CSS
 *  en `cover`, et les deux ne coïncident qu'à un seul rapport de
 *  côtés. Dessinée ici, elle est calée sur la côte par construction.
 *
 *  ELLE EST FACULTATIVE. Une carte sans `mer` se dessine sur l'aplat
 *  du cadre, comme avant : le jour où Callista donne sa vraie carte,
 *  le contour change et la mer se recalcule — mais entre les deux, la
 *  carte marche. */
export type Mer = {
  /** Les rivages parallèles, de la PLUS PROCHE de la côte à la plus
   *  lointaine. Le module les peint dans l'ordre inverse, pour
   *  qu'elles s'emboîtent au lieu de se recouvrir. */
  readonly bandes: readonly string[];
  /** Les ronds dans l'eau. */
  readonly rides: readonly {
    readonly x: number;
    readonly y: number;
    readonly r: number;
  }[];
};

export type Carte = {
  readonly repere: Repere;
  /** Le contour du continent, en chemin SVG. */
  readonly terre: string;
  /** Les îles, séparées du continent. L'Île Ténèbra en est une, et
   *  c'est ce qui justifie le port de la Relique Sacrée : on ne s'y
   *  rend pas à pied. */
  readonly iles: readonly string[];
  readonly lieux: readonly Lieu[];
  readonly mer?: Mer;
};

const TYPES = new Set(["zone", "ville", "ligue"]);

function texte(v: unknown): string {
  return typeof v === "string" ? v.replace(/\s+/g, " ").trim() : "";
}

function nombre(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

/** Relit un lieu. Rend `null` si quoi que ce soit manque.
 *
 *  ON NE RÉPARE RIEN. Un lieu sans nom, sans identifiant de forum ou
 *  sans ancre ne peut ni se dessiner, ni se cliquer, ni mener quelque
 *  part : le poser quand même donnerait une tache muette au milieu de
 *  la carte, et c'est pire qu'un trou. */
export function lieuDepuis(brut: unknown): Lieu | null {
  if (brut === null || typeof brut !== "object") return null;
  const o = brut as Record<string, unknown>;
  const forumId = nombre(o.forumId);
  const nom = texte(o.nom);
  const type = texte(o.type);
  const ancre = o.ancre as Record<string, unknown> | undefined;
  const x = nombre(ancre?.x);
  const y = nombre(ancre?.y);
  if (forumId === null || nom === "" || !TYPES.has(type) || x === null || y === null) {
    return null;
  }
  const p = nombre(o.palier);
  const palier = p === 1 || p === 2 || p === 3 ? (p as 1 | 2 | 3) : undefined;
  const forme = texte(o.forme);
  const image = texte(o.image);
  const e = o.etiquette as Record<string, unknown> | undefined;
  const ex = nombre(e?.x);
  const ey = nombre(e?.y);
  return {
    forumId,
    nom,
    type: type as Lieu["type"],
    ...(palier === undefined ? {} : { palier }),
    niveau: texte(o.niveau),
    description: texte(o.description),
    ...(forme === "" ? {} : { forme }),
    ancre: { x, y },
    ...(ex === null || ey === null ? {} : { etiquette: { x: ex, y: ey } }),
    ...(image === "" ? {} : { image }),
  };
}

/** Relit la carte entière.
 *
 *  Rend `null` s'il ne reste aucun lieu lisible : une carte vide n'est
 *  pas une carte, et le module préfère ne rien poser du tout plutôt
 *  qu'un cadre avec un océan dedans. */
export function carteDepuis(brut: unknown): Carte | null {
  if (brut === null || typeof brut !== "object") return null;
  const o = brut as Record<string, unknown>;
  const r = o.repere as Record<string, unknown> | undefined;
  const largeur = nombre(r?.largeur) ?? 1000;
  const hauteur = nombre(r?.hauteur) ?? 640;
  const bruts = Array.isArray(o.lieux) ? o.lieux : [];
  const lieux = bruts.map(lieuDepuis).filter((l): l is Lieu => l !== null);
  if (lieux.length === 0) return null;
  const mer = merDepuis(o.mer);
  const iles = (Array.isArray(o.iles) ? o.iles : [])
    .map(texte).filter((i) => i !== "");
  return {
    repere: { largeur, hauteur },
    terre: texte(o.terre),
    iles,
    lieux,
    ...(mer === null ? {} : { mer }),
  };
}

/** Relit la mer. Rend `null` dès qu'elle est douteuse.
 *
 *  ON NE GARDE PAS UNE MER À MOITIÉ. Trois bandes sur quatre, ou des
 *  bandes sans rides, c'est un fichier à moitié écrit : on retombe sur
 *  l'aplat, qui est une mer honnête. Une bande manquante, elle,
 *  laisserait un trou en forme de rivage au milieu de l'eau. */
export function merDepuis(brut: unknown): Mer | null {
  if (brut === null || typeof brut !== "object") return null;
  const o = brut as Record<string, unknown>;
  if (!Array.isArray(o.bandes)) return null;
  const bandes = o.bandes.map(texte).filter((b) => b !== "");
  if (bandes.length !== o.bandes.length || bandes.length === 0) return null;
  const brutes = Array.isArray(o.rides) ? o.rides : [];
  const rides: { x: number; y: number; r: number }[] = [];
  for (const b of brutes) {
    const p = b as Record<string, unknown>;
    const x = nombre(p?.x);
    const y = nombre(p?.y);
    const r = nombre(p?.r);
    //  Un rayon nul ou négatif ferait un cercle invisible ou une
    //  erreur de rendu selon le navigateur. On le laisse tomber.
    if (x === null || y === null || r === null || r <= 0) continue;
    rides.push({ x, y, r });
  }
  return { bandes, rides };
}

// ── le classement ───────────────────────────────────────────────────

/** Le nom de la famille d'un lieu, écrit pour être lu.
 *
 *  C'EST CE TEXTE QUI DOUBLE LA COULEUR. Il part dans l'étiquette de la
 *  liste, dans le panneau, et dans le `aria-label` de la forme : les
 *  trois endroits où la couleur, seule, laisserait quelqu'un dehors. */
export function familleDe(lieu: Lieu): string {
  if (lieu.type === "ville") return "Ville";
  if (lieu.type === "ligue") return "Ligue";
  return `Palier ${lieu.palier ?? "?"}`;
}

/** La clé de style que la feuille 16 utilise, en `data-wm-famille`.
 *
 *  Un mot sans accent ni espace, parce qu'il devient un sélecteur
 *  d'attribut et qu'on ne veut pas avoir à le citer. */
export function cleDeFamille(lieu: Lieu): string {
  if (lieu.type === "ville") return "ville";
  if (lieu.type === "ligue") return "ligue";
  return `palier${lieu.palier ?? 0}`;
}

/** L'ordre de la liste de droite.
 *
 *  Les villes d'abord — c'est de là qu'on part —, puis les zones par
 *  palier croissant, puis la Ligue, qui est l'arrivée. À l'intérieur
 *  d'un groupe, l'ordre du fichier est gardé : c'est celui de la carte,
 *  et deux ordres différents entre la liste et le dessin se paient en
 *  allers-retours des yeux. */
export function rang(lieu: Lieu): number {
  if (lieu.type === "ville") return 0;
  if (lieu.type === "ligue") return 9;
  return lieu.palier ?? 8;
}

/** Les lieux, rangés. Le tri est STABLE en JavaScript depuis 2019 :
 *  l'ordre du fichier survit à l'intérieur de chaque groupe. */
export function ranger(lieux: readonly Lieu[]): readonly Lieu[] {
  return [...lieux].sort((a, b) => rang(a) - rang(b));
}

/** Un groupe de la liste de droite : son titre, sa clé de style, ses
 *  lieux. */
export type Groupe = {
  /** Le titre du groupe, au pluriel quand il y a lieu. */
  readonly titre: string;
  /** La famille au singulier, telle que `familleDe` l'écrit : elle
   *  sert encore dans le panneau et les noms accessibles. */
  readonly famille: string;
  readonly cle: string;
  readonly lieux: readonly Lieu[];
};

/** Le titre d'un groupe. « Ville » au singulier au-dessus de huit
 *  villes se lit mal ; les paliers, eux, sont déjà des noms propres. */
export function titreDeFamille(lieu: Lieu): string {
  if (lieu.type === "ville") return "Les villes";
  if (lieu.type === "ligue") return "La ligue";
  return `Palier ${lieu.palier ?? "?"}`;
}

/** Les lieux, rangés PUIS regroupés par famille.
 *
 *  ── POURQUOI ON GROUPE ──────────────────────────────────────────────
 *
 *  Vingt-six entrées plates, chacune portant son palier écrit à droite,
 *  c'est vingt-six fois le même mot à relire. Demandé le 8 octobre :
 *  « pour la liste : améliore la hiérarchie, et l'affichage ». Un titre
 *  par famille dit le palier UNE fois, et les entrées n'ont plus qu'à
 *  porter leur nom.
 *
 *  LE GROUPAGE SUIT `ranger`, IL NE LE REFAIT PAS. On parcourt la liste
 *  déjà triée et on coupe au changement de clé : si `rang` change
 *  demain, les groupes changent avec lui, et il n'y a pas deux ordres à
 *  garder d'accord. */
export function grouper(lieux: readonly Lieu[]): readonly Groupe[] {
  const sortie: { titre: string; famille: string; cle: string; lieux: Lieu[] }[] = [];
  for (const lieu of ranger(lieux)) {
    const cle = cleDeFamille(lieu);
    const dernier = sortie[sortie.length - 1];
    if (dernier !== undefined && dernier.cle === cle) dernier.lieux.push(lieu);
    else {
      sortie.push({
        titre: titreDeFamille(lieu),
        famille: familleDe(lieu),
        cle,
        lieux: [lieu],
      });
    }
  }
  return sortie;
}

/** L'ordre dans lequel les lieux se DESSINENT, qui n'est pas celui
 *  dans lequel ils se lisent.
 *
 *  ── CE QUI SE PASSE QUAND ON L'OUBLIE ───────────────────────────────
 *
 *  Dans un SVG, c'est l'ordre du document qui fait l'empilement. Au
 *  premier jet on dessinait simplement `ranger` à l'envers — les
 *  villes en dernier, donc au-dessus. Mais la Ligue a le rang 9 : à
 *  l'envers, elle passait EN PREMIER, et la tache de « Lande
 *  Broussailleuse » venait recouvrir le nom « Mont Bataille », qu'on
 *  lisait à moitié. Un défaut qu'aucun test ne voyait et qu'il a fallu
 *  regarder pour trouver.
 *
 *  LA RÈGLE N'EST DONC PAS LE RANG, C'EST LA FORME. Ce qui a un
 *  contour est un territoire : ça s'étale, ça va dessous. Ce qui n'en
 *  a pas est une épingle : c'est un point, ça va dessus. Les villes ET
 *  la Ligue sont des épingles, et elles passent ensemble à la fin. */
export function ordreDeDessin(lieux: readonly Lieu[]): readonly Lieu[] {
  //  À l'envers du rang À L'INTÉRIEUR des territoires : le palier 3
  //  est le plus foncé et le plus large, il tient le fond ; le palier
  //  1 se pose dessus.
  const envers = [...ranger(lieux)].reverse();
  return [
    ...envers.filter((l) => l.forme !== undefined),
    ...envers.filter((l) => l.forme === undefined),
  ];
}

/** L'adresse de la page d'un forum.
 *
 *  Forumactif accepte `/fNN-` sans le nom : il redirige vers l'adresse
 *  complète. C'est l'inverse exact de `forumDeLAdresse`, et les deux
 *  sont ici pour qu'un seul test les tienne.
 *
 *  Demandé le 8 octobre : « cliquer sur la catégorie à droite nous fait
 *  rentrer dans la catégorie ». */
export function adresseDuForum(forumId: number): string {
  return `/f${forumId}-`;
}

// ── se déplacer dans la carte ───────────────────────────────────────

/** La fenêtre qu'on regarde, dans le repère de la carte. C'est
 *  exactement un `viewBox` SVG. */
export type Vue = {
  readonly x: number;
  readonly y: number;
  readonly largeur: number;
  readonly hauteur: number;
};

/** Le zoom, borné. Au-delà de 2,6 on ne voit plus qu'une tache ; en
 *  deçà de 1, la carte flotte dans son cadre et le déplacement n'a plus
 *  de sens — c'est la vue d'ensemble, elle est le plancher. */
export const ZOOM_MIN = 1;
export const ZOOM_MAX = 2.6;

/** Ramène une vue à l'intérieur du repère.
 *
 *  ── POURQUOI CETTE FONCTION EXISTE ──────────────────────────────────
 *
 *  Sans elle, on traîne la carte et on finit sur du vide : le continent
 *  sort par la gauche et il n'y a plus rien à l'écran, pas même un
 *  bord pour comprendre où l'on est. Une vraie carte s'arrête à ses
 *  bords.
 *
 *  LE CAS QUI SE TROMPE EST CELUI OÙ LA VUE EST PLUS GRANDE QUE LA
 *  CARTE — au zoom 1 avec un cadre plus large que haut, par exemple.
 *  `Math.min(max, Math.max(0, x))` donnerait alors un maximum négatif
 *  et collerait la carte en haut à gauche. On la CENTRE, ce qui est la
 *  seule chose sensée quand il y a du mou. */
export function borner(vue: Vue, repere: Repere): Vue {
  const bornerAxe = (v: number, taille: number, cadre: number): number => {
    const mou = cadre - taille;
    //  Pas de mou : la vue est plus large que la carte. On centre, et
    //  la position demandée n'a plus voix au chapitre.
    if (mou <= 0) return mou / 2;
    return Math.min(mou, Math.max(0, v));
  };
  return {
    x: bornerAxe(vue.x, vue.largeur, repere.largeur),
    y: bornerAxe(vue.y, vue.hauteur, repere.hauteur),
    largeur: vue.largeur,
    hauteur: vue.hauteur,
  };
}

/** Déplace la vue d'un glissement de souris.
 *
 *  `dx` et `dy` sont en unités de la CARTE, pas en pixels d'écran : la
 *  conversion se fait dans le module, qui seul connaît la taille réelle
 *  du cadre. Le sens est celui d'une carte qu'on traîne — on pousse le
 *  papier vers la droite, la fenêtre va vers la gauche. */
export function deplacer(vue: Vue, dx: number, dy: number, repere: Repere): Vue {
  return borner({ ...vue, x: vue.x - dx, y: vue.y - dy }, repere);
}

/** La vue qui cadre un lieu, au zoom donné, centrée sur son ancre.
 *
 *  Sert quand on clique dans la liste de droite : le lieu doit venir
 *  au milieu, sinon on clique un nom et il ne se passe rien de visible
 *  parce que la tache était déjà hors champ. */
export function cadrerSur(
  ancre: { readonly x: number; readonly y: number },
  zoom: number,
  repere: Repere,
): Vue {
  const z = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, zoom));
  const largeur = repere.largeur / z;
  const hauteur = repere.hauteur / z;
  return borner(
    { x: ancre.x - largeur / 2, y: ancre.y - hauteur / 2, largeur, hauteur },
    repere,
  );
}

// ── ce que la page sait déjà ────────────────────────────────────────

/** Ce qu'on a pu relever sur un forum, ailleurs dans la page. */
export type Comptage = {
  readonly sujets: number | null;
  readonly messages: number | null;
  /** Le titre du dernier sujet, et où il mène. */
  readonly dernier?: { readonly titre: string; readonly url: string };
  /** L'adresse de l'avatar du dernier posteur. */
  readonly avatar?: string;
  /** Le nom de l'auteur du dernier message. */
  readonly qui?: string;
  /** La date du dernier message, recopiée telle quelle. */
  readonly quand?: string;
  /** LA DESCRIPTION ÉCRITE DANS LE PANNEAU D'ADMINISTRATION.
   *
   *  Demandée le 8 octobre : « la description doit s'appuyer sur celle
   *  qui est indiquée et qu'on a écrit dans les catégories ». Celles
   *  de `data/carte.json` étaient de moi ; celles-ci sont de
   *  Callista, et c'est le forum qui fait foi. */
  readonly description?: string;
  /** Les sous-forums, tels que la ligne les liste. */
  readonly sousForums?: readonly { readonly titre: string; readonly url: string }[];
};

/** Lit un nombre dans un libellé de ModernBB — « 26 Sujets » → 26.
 *
 *  LES ESPACES DES MILLIERS COMPTENT : Forumactif écrit « 1 240 » avec
 *  une espace fine insécable qu'aucun `parseInt` ne franchit. On les
 *  retire avant de lire, et on nomme le caractère plutôt que de faire
 *  confiance à `\s`. */
export function nombreDans(libelle: string): number | null {
  const net = libelle.replace(/[\s  ]/g, "");
  const m = net.match(/-?\d+/);
  if (m === null) return null;
  const n = Number(m[0]);
  return Number.isFinite(n) ? n : null;
}

/** L'identifiant de forum contenu dans une adresse Forumactif.
 *
 *  `/f37-canyon-lekro` → 37. Rend `null` pour tout le reste : un lien
 *  de sujet, une ancre, une page de profil. */
export function forumDeLAdresse(url: string): number | null {
  const m = url.match(/\/f(\d+)-/);
  return m === null ? null : Number(m[1]);
}
