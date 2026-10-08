// ════════════════════════════════════════════════════════════════════
//  Les règles de la carte. Pas de DOM ici : le dessin, la souris et le
//  panneau sont dans le module, et c'est `outils/carte.mjs` qui les
//  regarde dans un vrai navigateur.
//
//  CE QUI EST TESTÉ EST CE QUI PEUT SE TROMPER EN SILENCE : un lieu
//  bancal qu'on dessinerait quand même, un palier perdu en route, un
//  nombre de sujets lu de travers parce que Forumactif sépare ses
//  milliers avec une espace qu'on ne voit pas.
// ════════════════════════════════════════════════════════════════════

import { assertEquals } from "@std/assert";
import {
  adresseDuForum,
  borner,
  cadrerSur,
  carteDepuis,
  cleDeFamille,
  deplacer,
  familleDe,
  forumDeLAdresse,
  grouper,
  type Lieu,
  lieuDepuis,
  merDepuis,
  nombreDans,
  ordreDeDessin,
  ranger,
  ZOOM_MAX,
} from "./carte.ts";

const ZONE = {
  forumId: 37,
  nom: "Canyon Lekro",
  type: "zone",
  palier: 2,
  niveau: "Niveaux 15 à 40",
  description: "Des parois de grès rouge.",
  forme: "M 0 0 Z",
  ancre: { x: 688, y: 268 },
};

Deno.test("un lieu complet se relit entier", () => {
  const l = lieuDepuis(ZONE);
  assertEquals(l?.forumId, 37);
  assertEquals(l?.palier, 2);
  assertEquals(l?.type, "zone");
  assertEquals(l?.ancre, { x: 688, y: 268 });
});

Deno.test("un lieu sans ancre ne se dessine pas", () => {
  //  Une tache muette au milieu de la carte est pire qu'un trou : on
  //  ne peut ni la cliquer ni comprendre ce qu'elle fait là.
  assertEquals(lieuDepuis({ ...ZONE, ancre: undefined }), null);
  assertEquals(lieuDepuis({ ...ZONE, ancre: { x: 1 } }), null);
});

Deno.test("ni sans nom, ni sans forum, ni avec un type inventé", () => {
  assertEquals(lieuDepuis({ ...ZONE, nom: "  " }), null);
  assertEquals(lieuDepuis({ ...ZONE, forumId: "37" }), null);
  assertEquals(lieuDepuis({ ...ZONE, type: "continent" }), null);
});

Deno.test("un palier hors de 1-2-3 est écarté, le lieu reste", () => {
  //  Le palier décide d'une couleur et d'un rang. Un « palier 7 »
  //  donnerait une couleur par défaut sans qu'on sache pourquoi ; sans
  //  palier du tout, `familleDe` le dit.
  const l = lieuDepuis({ ...ZONE, palier: 7 });
  assertEquals(l?.palier, undefined);
  assertEquals(familleDe(l as Lieu), "Palier ?");
});

Deno.test("une ville n'a pas de palier et le dit", () => {
  const v = lieuDepuis({ ...ZONE, type: "ville", palier: undefined, forme: undefined });
  assertEquals(familleDe(v as Lieu), "Ville");
  assertEquals(cleDeFamille(v as Lieu), "ville");
  assertEquals(v?.forme, undefined);
});

Deno.test("LA FAMILLE S'ÉCRIT, parce que la couleur ne suffit pas", () => {
  //  Un joueur sur douze ne distingue pas les trois paliers à la
  //  teinte. Ce texte part dans l'étiquette, dans le panneau et dans
  //  le nom accessible de la forme.
  assertEquals(familleDe(lieuDepuis(ZONE) as Lieu), "Palier 2");
  assertEquals(familleDe(lieuDepuis({ ...ZONE, type: "ligue" }) as Lieu), "Ligue");
});

Deno.test("la clé de style n'a ni accent ni espace", () => {
  //  Elle devient un sélecteur d'attribut dans la feuille 16.
  for (const l of [ZONE, { ...ZONE, type: "ville" }, { ...ZONE, type: "ligue" }]) {
    const cle = cleDeFamille(lieuDepuis(l) as Lieu);
    assertEquals(/^[a-z0-9]+$/.test(cle), true, cle);
  }
});

Deno.test("la liste met les villes devant et la Ligue au bout", () => {
  const carte = carteDepuis({
    repere: { largeur: 1000, hauteur: 640 },
    terre: "M 0 0 Z",
    lieux: [
      { ...ZONE, forumId: 1, nom: "Trois", palier: 3 },
      { ...ZONE, forumId: 2, nom: "Ligue", type: "ligue", palier: undefined },
      { ...ZONE, forumId: 3, nom: "Un", palier: 1 },
      { ...ZONE, forumId: 4, nom: "Ville", type: "ville", palier: undefined },
      { ...ZONE, forumId: 5, nom: "Deux", palier: 2 },
    ],
  });
  assertEquals(
    ranger(carte!.lieux).map((l) => l.nom),
    ["Ville", "Un", "Deux", "Trois", "Ligue"],
  );
});

Deno.test("le tri garde l'ordre du fichier dans un même groupe", () => {
  //  C'est l'ordre de la carte. Deux ordres différents entre la liste
  //  et le dessin se paient en allers-retours des yeux.
  const carte = carteDepuis({
    lieux: [
      { ...ZONE, forumId: 1, nom: "B", type: "ville", palier: undefined },
      { ...ZONE, forumId: 2, nom: "A", type: "ville", palier: undefined },
      { ...ZONE, forumId: 3, nom: "C", type: "ville", palier: undefined },
    ],
  });
  assertEquals(ranger(carte!.lieux).map((l) => l.nom), ["B", "A", "C"]);
});

Deno.test("une carte sans aucun lieu lisible ne se pose pas", () => {
  //  Mieux vaut pas de carte qu'un cadre avec un océan dedans.
  assertEquals(carteDepuis({ lieux: [] }), null);
  assertEquals(carteDepuis({ lieux: [{ nom: "sans rien" }] }), null);
  assertEquals(carteDepuis(null), null);
  assertEquals(carteDepuis("une carte"), null);
});

Deno.test("un repère manquant retombe sur celui du fichier", () => {
  const c = carteDepuis({ lieux: [ZONE] });
  assertEquals(c?.repere, { largeur: 1000, hauteur: 640 });
});

Deno.test("LES MILLIERS DE FORUMACTIF SE LISENT", () => {
  //  « 1 240 Sujets » avec une espace fine insécable : `parseInt` s'y
  //  arrête et rend 1. Relevé sur des forums qui ont tourné.
  assertEquals(nombreDans("26 Sujets"), 26);
  assertEquals(nombreDans("1 240 Messages"), 1240);
  assertEquals(nombreDans("1 240"), 1240);
  assertEquals(nombreDans("0 Sujets"), 0);
});

Deno.test("et un libellé sans chiffre ne vaut pas zéro", () => {
  //  Zéro est une information — « ce forum est vide ». L'absence de
  //  relevé en est une autre, et le panneau ne les affiche pas pareil.
  assertEquals(nombreDans("Sujets"), null);
  assertEquals(nombreDans(""), null);
});

Deno.test("l'identifiant se lit dans l'adresse du forum", () => {
  assertEquals(forumDeLAdresse("/f37-canyon-lekro"), 37);
  assertEquals(forumDeLAdresse("https://x.forumactif.com/f100-fleuve-paisible"), 100);
});

Deno.test("et pas dans l'adresse d'un sujet", () => {
  //  `/t977-...` est un sujet, `/u3` un profil. Les confondre
  //  accrocherait un comptage au mauvais lieu.
  assertEquals(forumDeLAdresse("/t977-le-marche"), null);
  assertEquals(forumDeLAdresse("/u3"), null);
  assertEquals(forumDeLAdresse("/f37"), null);
});

// ════════════════════════════════════════════════════════════════════
//  Le déplacement. C'est de l'arithmétique, et c'est exactement le
//  genre de code qui se trompe d'un signe et qu'on ne voit qu'en
//  ligne, sur un écran étroit, un jour où on cherchait autre chose.
// ════════════════════════════════════════════════════════════════════

const R = { largeur: 1000, hauteur: 640 };

Deno.test("on traîne le papier à droite, la fenêtre va à gauche", () => {
  //  Le sens d'une vraie carte. Inversé, le geste est désagréable sans
  //  qu'on sache dire pourquoi.
  const v = { x: 300, y: 200, largeur: 500, hauteur: 320 };
  assertEquals(deplacer(v, 100, 50, R).x, 200);
  assertEquals(deplacer(v, 100, 50, R).y, 150);
});

Deno.test("ET ELLE S'ARRÊTE AUX BORDS", () => {
  //  Sans ça on traîne la carte et on finit sur du vide : le continent
  //  sort par la gauche et il ne reste rien à l'écran, pas même un
  //  bord pour comprendre où l'on est.
  const v = { x: 0, y: 0, largeur: 500, hauteur: 320 };
  assertEquals(deplacer(v, 400, 400, R).x, 0);
  assertEquals(deplacer(v, 400, 400, R).y, 0);
  const w = { x: 500, y: 320, largeur: 500, hauteur: 320 };
  assertEquals(deplacer(w, -400, -400, R).x, 500);
  assertEquals(deplacer(w, -400, -400, R).y, 320);
});

Deno.test("une vue plus grande que la carte se CENTRE", () => {
  //  Le cas qui se trompe : `Math.min(max, Math.max(0, x))` donne ici
  //  un maximum négatif et colle la carte en haut à gauche. Il n'y a
  //  qu'une chose sensée à faire du mou, c'est le partager.
  const v = borner({ x: 300, y: 300, largeur: 1400, hauteur: 900 }, R);
  assertEquals(v.x, -200);
  assertEquals(v.y, -130);
});

Deno.test("cadrer sur un lieu l'amène au milieu", () => {
  const v = cadrerSur({ x: 500, y: 320 }, 2, R);
  assertEquals([v.x, v.y, v.largeur, v.hauteur], [250, 160, 500, 320]);
});

Deno.test("et un lieu au bord ne sort pas la carte du cadre", () => {
  //  Cliquer « Montagnes Embrumées » dans la liste ne doit pas montrer
  //  la moitié d'un océan vide au-dessus du continent.
  const v = cadrerSur({ x: 10, y: 10 }, 2, R);
  assertEquals([v.x, v.y], [0, 0]);
  const w = cadrerSur({ x: 990, y: 630 }, 2, R);
  assertEquals([w.x, w.y], [500, 320]);
});

Deno.test("le zoom est borné des deux côtés", () => {
  //  Au-delà du maximum on ne voit plus qu'une tache ; en deçà du
  //  minimum la carte flotte et le déplacement n'a plus de sens.
  assertEquals(cadrerSur({ x: 500, y: 320 }, 99, R).largeur, 1000 / ZOOM_MAX);
  assertEquals(cadrerSur({ x: 500, y: 320 }, 0.1, R).largeur, 1000);
});

// ── le groupage de la liste, et la porte du forum ───────────────────

Deno.test("une image se relit, et son absence ne laisse pas de champ vide", () => {
  //  Aucun lieu n'en a encore : la feuille 16 retombe alors sur
  //  `--wm-bandeau-categorie`. Un champ vide posé quand même ferait
  //  `url("")`, que le navigateur essaie de charger — sur la page
  //  courante, ce qui la retélécharge.
  assertEquals(lieuDepuis({ ...ZONE, image: "  " })?.image, undefined);
  assertEquals(lieuDepuis(ZONE)?.image, undefined);
  assertEquals(
    lieuDepuis({ ...ZONE, image: "https://i.postimg.cc/x/z.png" })?.image,
    "https://i.postimg.cc/x/z.png",
  );
});

Deno.test("les lieux se groupent par famille, dans l'ordre de `ranger`", () => {
  const lieux = [
    lieuDepuis({ ...ZONE, forumId: 1, palier: 3 }),
    lieuDepuis({ ...ZONE, forumId: 2, type: "ville", palier: undefined }),
    lieuDepuis({ ...ZONE, forumId: 3, palier: 1 }),
    lieuDepuis({ ...ZONE, forumId: 4, type: "ville", palier: undefined }),
    lieuDepuis({ ...ZONE, forumId: 5, type: "ligue", palier: undefined }),
    lieuDepuis({ ...ZONE, forumId: 6, palier: 1 }),
  ].filter((l): l is Lieu => l !== null);
  const g = grouper(lieux);
  assertEquals(g.map((x) => x.cle), ["ville", "palier1", "palier3", "ligue"]);
  //  L'ordre du fichier survit À L'INTÉRIEUR d'un groupe : la liste et
  //  le dessin doivent se lire dans le même ordre.
  assertEquals(g[0].lieux.map((l) => l.forumId), [2, 4]);
  assertEquals(g[1].lieux.map((l) => l.forumId), [3, 6]);
});

Deno.test("un groupe porte son titre au pluriel, et sa famille au singulier", () => {
  //  « Ville » au-dessus de huit villes se lit mal ; mais le singulier
  //  reste nécessaire pour le panneau et les noms accessibles.
  const villes = [lieuDepuis({ ...ZONE, type: "ville", palier: undefined })].filter(
    (l): l is Lieu => l !== null,
  );
  assertEquals(grouper(villes)[0].titre, "Les villes");
  assertEquals(grouper(villes)[0].famille, "Ville");
  assertEquals(grouper([lieuDepuis(ZONE) as Lieu])[0].titre, "Palier 2");
});

Deno.test("grouper une carte vide ne rend pas un groupe vide", () => {
  assertEquals(grouper([]), []);
});

Deno.test("l'adresse d'un forum est l'inverse exact de sa lecture", () => {
  //  Les deux fonctions sont côte à côte pour que ce test les tienne
  //  ensemble : si l'une change de forme, l'autre tombe ici.
  for (const id of [1, 37, 96, 1234]) {
    assertEquals(forumDeLAdresse(adresseDuForum(id)), id);
  }
  assertEquals(adresseDuForum(37), "/f37-");
});

Deno.test("LES ÉPINGLES SE DESSINENT APRÈS LES TERRITOIRES", () => {
  //  Le défaut qu'on a payé : la Ligue a le rang 9, donc à l'envers du
  //  rang elle passait EN PREMIER, et la tache de la zone voisine
  //  recouvrait le nom « Mont Bataille ». Ce n'est pas le rang qui
  //  décide de l'empilement, c'est d'avoir un contour ou non.
  const lieux = [
    lieuDepuis({ ...ZONE, forumId: 65, type: "ligue", palier: undefined, forme: undefined }),
    lieuDepuis({ ...ZONE, forumId: 38, palier: 1 }),
    lieuDepuis({ ...ZONE, forumId: 12, type: "ville", palier: undefined, forme: undefined }),
    lieuDepuis({ ...ZONE, forumId: 103, palier: 3 }),
  ].filter((l): l is Lieu => l !== null);
  const o = ordreDeDessin(lieux);
  //  Les deux territoires d'abord, du plus foncé au plus clair ; les
  //  deux épingles ensuite, et peu importe laquelle des deux d'abord —
  //  deux points de 9 px ne se recouvrent pas.
  assertEquals(o.slice(0, 2).map((l) => l.forumId), [103, 38]);
  assertEquals(new Set(o.slice(2).map((l) => l.forumId)), new Set([12, 65]));
  //  Et tout le monde est encore là : on ordonne, on ne filtre pas.
  assertEquals(o.length, lieux.length);
});

// ── la mer ──────────────────────────────────────────────────────────

const MER = {
  bandes: ["M 0 0 C 1 1 2 2 3 3 Z", "M 0 0 C 4 4 5 5 6 6 Z"],
  rides: [{ x: 120, y: 80, r: 14 }, { x: 300, y: 500, r: 9.5 }],
};

Deno.test("une mer complète se relit entière", () => {
  const m = merDepuis(MER);
  assertEquals(m?.bandes.length, 2);
  assertEquals(m?.rides.length, 2);
  assertEquals(m?.rides[0], { x: 120, y: 80, r: 14 });
});

Deno.test("UNE MER À MOITIÉ ÉCRITE EST REFUSÉE EN ENTIER", () => {
  //  Une bande vide au milieu laisserait un TROU en forme de rivage
  //  au milieu de l'eau — les bandes sont emboîtées, celle qui manque
  //  découvre le large jusqu'à la côte. Mieux vaut l'aplat, qui est
  //  une mer honnête.
  assertEquals(merDepuis({ ...MER, bandes: ["M 0 0 Z", "  "] }), null);
  assertEquals(merDepuis({ ...MER, bandes: [] }), null);
  assertEquals(merDepuis({ ...MER, bandes: "M 0 0 Z" }), null);
  assertEquals(merDepuis(null), null);
  assertEquals(merDepuis(undefined), null);
});

Deno.test("une ride bancale tombe, la mer reste", () => {
  //  Une ride est une décoration : son absence ne se voit pas, alors
  //  qu'un rayon nul ou négatif fait un cercle invisible ici et une
  //  erreur de rendu là.
  const m = merDepuis({
    ...MER,
    rides: [{ x: 1, y: 2, r: 3 }, { x: 4, y: 5, r: 0 }, { x: 6, y: 7, r: -2 }, { x: 8 }],
  });
  assertEquals(m?.rides, [{ x: 1, y: 2, r: 3 }]);
  assertEquals(m?.bandes.length, 2);
});

Deno.test("une carte sans mer reste une carte", () => {
  //  Le jour où Callista donne sa vraie carte, le contour change et la
  //  mer se recalcule — mais entre les deux, la carte doit marcher.
  const c = carteDepuis({
    repere: { largeur: 1000, hauteur: 640 },
    terre: "M 0 0 Z",
    lieux: [ZONE],
  });
  assertEquals(c?.mer, undefined);
  assertEquals(c?.lieux.length, 1);
  const avec = carteDepuis({
    repere: { largeur: 1000, hauteur: 640 },
    terre: "M 0 0 Z",
    lieux: [ZONE],
    mer: MER,
  });
  assertEquals(avec?.mer?.bandes.length, 2);
});
