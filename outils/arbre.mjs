// ════════════════════════════════════════════════════════════════════
//  outils/arbre.mjs — l'arbre des paliers, dans un vrai navigateur.
//
//  COUVRE : outils/arbre.py · css/33-arbre.css · data/arbre.json
//
//      deno task arbre
//      deno task arbre -- --photo     rend arbre-<thème>.png
//
//  ── CE QU'IL REGARDE, ET QU'AUCUN TEST SANS NAVIGATEUR NE VERRAIT ──
//
//    · C'EST UN ARBRE, pas une liste : un moyeu, six rayons, et des
//      arêtes tracées entre les perles. C'est le reproche du 26
//      novembre, et il se mesure — six branches partant d'un même
//      point, à des angles différents ;
//    · RIEN N'EST COUPÉ PAR LE CADRE. Le `viewBox` était à 1000 au
//      premier jet : la porte du palier 3 et les six noms de maison
//      tombaient dehors. Un SVG ne se plaint pas, il coupe ;
//    · LE MOYEU PASSE AU-DESSUS DES ARÊTES. Dessiné avant, les six
//      rayons qui partent du centre exact le barraient d'une étoile ;
//    · LE DESSIN ET LA LISTE DISENT LA MÊME CHOSE. Deux sources pour
//      une même suite, c'est une occasion de se contredire : les
//      numéros sont comparés un par un ;
//    · UNE PORTE SE VOIT. Plus grosse, pleine, et son chiffre est le
//      palier, pas le rang ;
//    · LE SVG EST DÉCORATIF POUR UN LECTEUR D'ÉCRAN. Sans ça, il lui
//      annonce cent cercles avant la première phrase utile.
// ════════════════════════════════════════════════════════════════════

import { readFileSync } from "node:fs";
import { chromium } from "npm:playwright@1.56.0";
import { ouvrirChromium } from "./chromium.mjs";

const R = new URL("..", import.meta.url).pathname;
const lire = (c) => readFileSync(R + c, "utf8");

let fautes = 0;
const dire = (quoi, bon, detail = "") => {
  if (!bon) fautes += 1;
  console.log(`${bon ? "  ok  " : "  ÉCHEC"} ${quoi}${detail === "" ? "" : ` — ${detail}`}`);
};

//  LA PAGE EST SERVIE AVEC LA VRAIE FEUILLE, celle que `css.sh`
//  assemble. Monter la page avec les feuilles séparées mesurerait un
//  ordre de cascade que le forum ne sert jamais.
const page = lire("pages/arbre-des-paliers.html")
  .replace(
    /<link rel="stylesheet" href="[^"]*jetons\.css"[^>]*>/,
    `<style>${lire("panneau-admin/jetons.css")}</style>`,
  )
  .replace(
    /<link rel="stylesheet" href="[^"]*wild-mystery\.css"[^>]*>/,
    `<style>${lire("css/wild-mystery.css")}</style>`,
  )
  .replace(/<script src="[^"]*"><\/script>/, "");

const donnees = JSON.parse(lire("data/arbre.json"));
//  NEUF PAR PALIER, DEUX PALIERS, SIX MAISONS : le dessin montre les
//  communs UNE FOIS et les objectifs de maison six fois.
const perlesAttendues = donnees.branches.reduce(
  (n, b) => n + b.paliers["2"].length + b.paliers["3"].length,
  donnees.communs["2"].length + donnees.communs["3"].length,
);

const nav = await ouvrirChromium(chromium);
const onglet = await nav.newPage({ viewport: { width: 980, height: 1000 } });
await onglet.setContent(page, { waitUntil: "load" });

console.log("\n── deux étages, sept rayons chacun ──");

const forme = await onglet.evaluate(() => {
  const svg = document.querySelector(".wm-paliers__dessin");
  const traits = [...svg.querySelectorAll(".wm-paliers__trait")];
  //  UN ÉTAGE EST UNE LENTILLE : tous ses rayons partent du même point
  //  et arrivent au même point. On le vérifie en regroupant les
  //  chemins par leur couple (départ, arrivée) : deux groupes de sept.
  const bouts = new Map();
  for (const t of traits) {
    //  LE DÉPART ET L'ARRIVÉE D'UNE BÉZIER QUADRATIQUE. Première
    //  écriture : une destructuration à trous sur un tableau de cinq
    //  éléments, qui rendait `undefined` pour l'arrivée — les rayons
    //  se regroupaient alors par leur seul départ, et le contrôle
    //  passait au vert en ne vérifiant rien de ce qu'il annonçait.
    //  LE POINT DE CONTRÔLE PEUT ÊTRE NÉGATIF — la maison la plus à
    //  gauche de chaque étage a un contrôle à −240, hors du cadre, et
    //  c'est normal : une Bézier ne passe qu'à la moitié du sien.
    //  Sans le signe, ces deux chemins-là tombaient dans un troisième
    //  groupe « illisible », et le contrôle annonçait [6,2,6].
    const m = t.getAttribute("d").match(
      /M (-?[\d.]+) (-?[\d.]+) Q -?[\d.]+ -?[\d.]+ (-?[\d.]+) (-?[\d.]+)/,
    );
    const clef = m === null ? "illisible" : [
      Math.round(+m[1]),
      Math.round(+m[2]),
      Math.round(+m[3]),
      Math.round(+m[4]),
    ].join(",");
    bouts.set(clef, (bouts.get(clef) ?? 0) + 1);
  }
  const ventres = traits.map((t) => {
    const b = t.getBoundingClientRect();
    return Math.round(b.width);
  });
  return {
    traits: traits.length,
    etages: [...bouts.values()],
    communs: svg.querySelectorAll(".wm-paliers__trait--commun").length,
    perles: svg.querySelectorAll(".wm-paliers__perle").length,
    portes: svg.querySelectorAll('.wm-paliers__perle[data-wm-genre="palier"]').length,
    maisons: svg.querySelectorAll(".wm-paliers__maison").length,
    //  LE RAYON DES COMMUNS EST LE PLUS ÉTROIT : c'est le tronc, il
    //  monte droit. Si un rayon de maison était plus étroit que lui,
    //  l'éventail serait à l'envers.
    communLePlusEtroit: Math.min(...ventres) ===
      Math.round(svg.querySelector(".wm-paliers__trait--commun").getBoundingClientRect().width),
  };
});

dire("quatorze rayons, sept par étage", forme.traits === 14, `${forme.traits}`);
dire(
  "   et chaque étage est une lentille",
  forme.etages.length === 2 && forme.etages.every((n) => n === 7),
  JSON.stringify(forme.etages),
);
dire("deux rayons de communs", forme.communs === 2, `${forme.communs}`);
dire("le tronc est le rayon le plus droit", forme.communLePlusEtroit);
dire("deux portes", forme.portes === 2, `${forme.portes}`);
dire(
  "toutes les perles sont là",
  forme.perles === perlesAttendues + 2,
  `${forme.perles} contre ${perlesAttendues} + 2 portes`,
);
dire("chaque maison est nommée deux fois", forme.maisons === donnees.branches.length * 2);

console.log("\n── rien n'est coupé ──");

const cadre = await onglet.evaluate(() => {
  const svg = document.querySelector(".wm-paliers__dessin");
  const [, , l, h] = svg.getAttribute("viewBox").split(/\s+/).map(Number);
  //  `getBBox` donne la boîte réelle, étiquettes de texte comprises.
  //  C'est tout l'intérêt : un nom de maison déborde de sa
  //  demi-largeur, que la géométrie des rayons ne dit pas.
  const b = svg.getBBox();
  return { l, h, x: b.x, y: b.y, droite: b.x + b.width, bas: b.y + b.height };
});

dire(
  "rien ne sort par la gauche ni par le haut",
  cadre.x >= 0 && cadre.y >= 0,
  `x=${cadre.x.toFixed(0)} y=${cadre.y.toFixed(0)}`,
);
dire(
  "rien ne sort par la droite ni par le bas",
  cadre.droite <= cadre.l && cadre.bas <= cadre.h,
  `droite=${cadre.droite.toFixed(0)}/${cadre.l}`,
);
//  LE DESSIN REMPLIT SON CADRE. Réglé au jugé, il occupait la moitié
//  de sa largeur : une Bézier ne passe qu'à la MOITIÉ de son point de
//  contrôle, et les écarts étaient ceux du point de contrôle.
dire(
  "   et il le remplit",
  (cadre.droite - cadre.x) / cadre.l > 0.75,
  `${Math.round((cadre.droite - cadre.x) / cadre.l * 100)}% de la largeur`,
);

console.log("\n── l'empilement ──");

const dessus = await onglet.evaluate(() => {
  const enfants = [...document.querySelector(".wm-paliers__dessin").children];
  return {
    dernierTrait: enfants.map((e) => e.matches(".wm-paliers__trait")).lastIndexOf(true),
    moyeu: enfants.findIndex((e) => e.matches(".wm-paliers__moyeu")),
    premierePerle: enfants.findIndex((e) => e.matches(".wm-paliers__perle")),
  };
});

dire("le moyeu passe après les arêtes", dessus.moyeu > dessus.dernierTrait);
dire("et les perles après le moyeu", dessus.premierePerle > dessus.moyeu);
//  AUCUNE PERLE NE CHEVAUCHE LE MOYEU. Les rayons partaient du centre
//  du disque, donc leur première perle tombait dessus à moitié.
const chevauche = await onglet.evaluate(() => {
  const m = document.querySelector(".wm-paliers__moyeu");
  const cx = +m.getAttribute("cx"), cy = +m.getAttribute("cy"), r = +m.getAttribute("r");
  return [...document.querySelectorAll(".wm-paliers__perle circle")].filter((c) =>
    Math.hypot(+c.getAttribute("cx") - cx, +c.getAttribute("cy") - cy) <
      r + +c.getAttribute("r")
  ).length;
});
dire("aucune perle ne chevauche le moyeu", chevauche === 0, `${chevauche}`);

console.log("\n── les trois couches se distinguent ──");

const couches = await onglet.evaluate(() => {
  const trait = (g) => {
    const c = document.querySelector(`.wm-paliers__perle[data-wm-genre="${g}"] circle`);
    const s = getComputedStyle(c);
    return `${s.fill}|${s.stroke}|${s.strokeDasharray}`;
  };
  return {
    commun: trait("commun"),
    maison: trait("maison"),
    mission: trait("mission"),
    aEcrire: trait("a-ecrire"),
  };
});
const vues = new Set(Object.values(couches));
dire("les quatre genres ont quatre aspects", vues.size === 4, JSON.stringify(couches));

console.log("\n── la liste dit la même chose ──");

const liste = await onglet.evaluate(() => {
  const sections = [...document.querySelectorAll(".wm-paliers__branche")];
  return {
    sections: sections.length,
    portes: document.querySelectorAll(".wm-paliers__porte").length,
    lignes: document.querySelectorAll(".wm-paliers__etape").length,
    //  LES COMMUNS SONT RÉPÉTÉS DANS CHAQUE LISTE, exprès : une
    //  joueuse lit la sienne et doit y voir ses neuf, pas trois.
    premiere: sections[0].querySelectorAll(".wm-paliers__etape").length,
  };
});
dire("une section par maison", liste.sections === donnees.branches.length);
dire("deux portes annoncées par maison", liste.portes === donnees.branches.length * 2);
dire(
  "neuf objectifs par palier dans chaque liste",
  liste.premiere === donnees.parPalier * 2,
  `${liste.premiere} pour ${donnees.parPalier * 2}`,
);

console.log("\n── ce qu'un lecteur d'écran entend ──");

const lu = await onglet.evaluate(() => ({
  cache: document.querySelector(".wm-paliers__dessin").getAttribute("aria-hidden") === "true",
  titres: document.querySelectorAll(".wm-paliers__titre").length,
}));
dire("le dessin est marqué décoratif", lu.cache);
dire("les six listes ont leur titre", lu.titres === donnees.branches.length);

console.log("\n── à 390 px ──");

await onglet.setViewportSize({ width: 390, height: 900 });
const petit = await onglet.evaluate(() => ({
  deborde: document.documentElement.scrollWidth > document.documentElement.clientWidth,
  largeur: Math.round(
    document.querySelector(".wm-paliers__dessin").getBoundingClientRect().width,
  ),
}));
dire("rien ne déborde", !petit.deborde);
dire("le dessin suit la colonne", petit.largeur <= 390, `${petit.largeur}px`);

if (Deno.args.includes("--photo")) {
  for (const [nom, sombre] of [["clair", false], ["sombre", true]]) {
    await onglet.setViewportSize({ width: 1100, height: 1400 });
    await onglet.emulateMedia({ colorScheme: sombre ? "dark" : "light" });
    await onglet.screenshot({ path: `arbre-${nom}.png`, fullPage: true });
    console.log(`  arbre-${nom}.png`);
  }
}

await nav.close();

console.log(fautes === 0 ? "\nTOUT PASSE." : `\n${fautes} ÉCHEC(S).`);
if (fautes > 0) Deno.exit(1);
