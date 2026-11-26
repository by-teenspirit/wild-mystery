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
const etapes = donnees.branches.reduce((n, b) => n + b.etapes.length, 0);

const nav = await ouvrirChromium(chromium);
const onglet = await nav.newPage({ viewport: { width: 980, height: 1000 } });
await onglet.setContent(page, { waitUntil: "load" });

console.log("\n── c'est bien un arbre ──");

const forme = await onglet.evaluate(() => {
  const svg = document.querySelector(".wm-paliers__dessin");
  const moyeu = svg.querySelector(".wm-paliers__moyeu");
  const cx = +moyeu.getAttribute("cx");
  const cy = +moyeu.getAttribute("cy");
  const traits = [...svg.querySelectorAll(".wm-paliers__trait")];
  //  UN RAYON EST UN ANGLE. Six branches qui partent d'un même point
  //  donnent six angles ; une liste n'en donnerait qu'un.
  const partentDuCentre = traits.filter(
    (t) => Math.hypot(+t.getAttribute("x1") - cx, +t.getAttribute("y1") - cy) < 1,
  );
  const angles = new Set(
    partentDuCentre.map((t) =>
      Math.round(
        Math.atan2(+t.getAttribute("y2") - cy, +t.getAttribute("x2") - cx) * 180 / Math.PI,
      )
    ),
  );
  return {
    traits: traits.length,
    rayons: partentDuCentre.length,
    angles: angles.size,
    perles: svg.querySelectorAll(".wm-paliers__perle").length,
    maisons: svg.querySelectorAll(".wm-paliers__maison").length,
  };
});

dire("six rayons partent du moyeu", forme.rayons === 6, `${forme.rayons}`);
dire("   et dans six directions", forme.angles === 6, `${forme.angles} angle(s)`);
dire("chaque étape a son arête", forme.traits === etapes, `${forme.traits}/${etapes}`);
dire("chaque étape a sa perle", forme.perles === etapes, `${forme.perles}/${etapes}`);
dire("chaque maison a son nom", forme.maisons === donnees.branches.length);

console.log("\n── rien n'est coupé ──");

const cadre = await onglet.evaluate(() => {
  const svg = document.querySelector(".wm-paliers__dessin");
  const [, , l, h] = svg.getAttribute("viewBox").split(/\s+/).map(Number);
  //  LA BOÎTE RÉELLE DU CONTENU, en unités du viewBox. `getBBox` la
  //  donne, étiquettes de texte comprises — c'est tout l'intérêt :
  //  un nom de maison déborde de sa demi-largeur, que le rayon ne dit
  //  pas, et c'est exactement ce qui coupait « Sérieux » au premier
  //  jet.
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
  `droite=${cadre.droite.toFixed(0)}/${cadre.l} bas=${cadre.bas.toFixed(0)}/${cadre.h}`,
);

console.log("\n── l'empilement ──");

const dessus = await onglet.evaluate(() => {
  const svg = document.querySelector(".wm-paliers__dessin");
  const enfants = [...svg.children];
  const rang = (sel) => enfants.findIndex((e) => e.matches(sel));
  return {
    dernierTrait: enfants.map((e) => e.matches(".wm-paliers__trait")).lastIndexOf(true),
    moyeu: rang(".wm-paliers__moyeu"),
    premierePerle: rang(".wm-paliers__perle"),
  };
});

dire(
  "le moyeu passe après les arêtes",
  dessus.moyeu > dessus.dernierTrait,
  `moyeu ${dessus.moyeu}, dernier trait ${dessus.dernierTrait}`,
);
dire("et les perles après le moyeu", dessus.premierePerle > dessus.moyeu);

console.log("\n── le dessin et la liste disent la même chose ──");

const accord = await onglet.evaluate(() => {
  const dansLeDessin = [...document.querySelectorAll(".wm-paliers__perle")].map((g) => ({
    genre: g.dataset.wmGenre,
    nombre: g.querySelector("text").textContent.trim(),
  }));
  const dansLaListe = [...document.querySelectorAll(".wm-paliers__etape")].map((li) => ({
    genre: li.dataset.wmGenre,
    nombre: li.querySelector(".wm-paliers__rang").textContent.trim(),
  }));
  const pareil = dansLeDessin.length === dansLaListe.length &&
    dansLeDessin.every((d, i) =>
      d.genre === dansLaListe[i].genre && d.nombre === dansLaListe[i].nombre
    );
  return { pareil, dessin: dansLeDessin.length, liste: dansLaListe.length };
});

dire(
  "même suite, mêmes numéros, même ordre",
  accord.pareil,
  `${accord.dessin} perle(s) contre ${accord.liste} ligne(s)`,
);

console.log("\n── les portes ──");

const portes = await onglet.evaluate(() => {
  const p = document.querySelector('.wm-paliers__perle[data-wm-genre="palier"]');
  const ordinaire = document.querySelector('.wm-paliers__perle[data-wm-genre="mission"]');
  const r = (g) => +g.querySelector("circle").getAttribute("r");
  const plein = (g) => getComputedStyle(g.querySelector("circle")).fill;
  return {
    plusGrosse: r(p) > r(ordinaire),
    pleine: plein(p) !== plein(ordinaire),
    chiffre: p.querySelector("text").textContent.trim(),
    pointilles: getComputedStyle(
      document.querySelector('.wm-paliers__perle[data-wm-genre="a-ecrire"] circle'),
    ).strokeDasharray,
  };
});

dire("une porte est plus grosse qu'une étape", portes.plusGrosse);
dire("   et pleine", portes.pleine);
dire(
  "son chiffre est le palier, pas le rang",
  ["2", "3"].includes(portes.chiffre),
  portes.chiffre,
);
dire("une étape à écrire est en pointillés", portes.pointilles !== "none", portes.pointilles);

console.log("\n── ce qu'un lecteur d'écran entend ──");

const lu = await onglet.evaluate(() => {
  const svg = document.querySelector(".wm-paliers__dessin");
  return {
    cache: svg.getAttribute("aria-hidden") === "true",
    titres: document.querySelectorAll(".wm-paliers__titre").length,
  };
});

dire("le dessin est marqué décoratif", lu.cache);
dire("les six listes ont leur titre", lu.titres === donnees.branches.length);

console.log("\n── à 390 px ──");

await onglet.setViewportSize({ width: 390, height: 900 });
const petit = await onglet.evaluate(() => ({
  deborde: document.documentElement.scrollWidth > document.documentElement.clientWidth,
  largeurDessin: Math.round(
    document.querySelector(".wm-paliers__dessin").getBoundingClientRect().width,
  ),
}));

dire("rien ne déborde", !petit.deborde);
dire("le dessin suit la colonne", petit.largeurDessin <= 390, `${petit.largeurDessin}px`);

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
