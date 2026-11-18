// ════════════════════════════════════════════════════════════════════
//  outils/groupes.mjs — les six cartes de l'annexe 07, au rendu.
//
//  POURQUOI CE HARNAIS EXISTE depuis le 18 novembre : jusque-là les
//  six cartes portaient du lorem, et personne ne pouvait savoir si
//  elles tenaient le vrai texte. Elles ne le tenaient pas : à 340 px
//  de haut, on ne voyait plus que la légende.
//
//  CE QU'IL REGARDE :
//
//    · les six cartes font la même hauteur, trois par ligne ;
//    · les descriptions sont MOT POUR MOT celles de
//      `data/groupes.json` — c'est le texte de Callista, et un rendu
//      qui l'abrège sans le dire serait pire qu'un rendu cassé ;
//    · le nom anglais n'apparaît QUE là où il diffère : une seule
//      carte sur six, et jamais « Keldeo · Keldeo » ;
//    · l'avantage reste visible sans dérouler la carte, parce que
//      c'est la seule chose qui change quelque chose au jeu ;
//    · les quatre lignes de caractère sont là, et aucune ne porte de
//      bordure — « ne mets pas un border à gauche, ne mets ça nulle
//      part » ;
//    · rien ne déborde en largeur, à 1 440 comme à 390, dans les deux
//      thèmes.
//
//  IL SERT LA VRAIE PAGE, pas un décor : `pages/annexe-07-groupes.html`
//  tel qu'il sera collé sur le forum. Un décor recopié aurait vieilli
//  à la première génération.
// ════════════════════════════════════════════════════════════════════

import { readFileSync } from "node:fs";
import { chromium } from "npm:playwright@1.56.0";

const CHROME = [
  "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
  "/opt/pw-browsers/chromium/chrome-linux64/chrome",
].find((c) => {
  try {
    readFileSync(c);
    return true;
  } catch {
    return false;
  }
});

const R = new URL("..", import.meta.url).pathname;
const GROUPES = JSON.parse(readFileSync(R + "data/groupes.json", "utf8")).groupes;
const ANNEXE = readFileSync(R + "pages/annexe-07-groupes.html", "utf8");

const soucis = [];
const dire = (nom, ok, detail = "") => {
  console.log(`${ok ? "  ok  " : "DÉFAUT"} ${nom}${detail ? " — " + detail : ""}`);
  if (!ok) soucis.push(nom + (detail ? " — " + detail : ""));
};

const page = (theme) =>
  `<!doctype html><html lang="fr" data-wm-theme="${theme}"><head><meta charset="utf-8">
<style>${readFileSync(R + "panneau-admin/jetons.css", "utf8")}</style>
<style>${readFileSync(R + "css/wild-mystery.css", "utf8")}</style>
<style>body{margin:0;font-size:10px;background:var(--wm-fond-page)}#page-body{padding:24px}</style>
</head><body id="modernbb" class="${theme === "sombre" ? "wm-sombre" : ""}">
<div id="page-body">${ANNEXE}</div></body></html>`;

const nav = await chromium.launch(CHROME === undefined ? {} : { executablePath: CHROME });

/** Ouvre la page à la largeur voulue, dans le thème voulu.
 *
 *  LES IMAGES SONT SERVIES VIDES : l'illustration officielle vient de
 *  raw.githubusercontent, et un harnais qui dépend du réseau ne dit
 *  plus rien le jour où le réseau tombe. Le filigrane est un décor —
 *  ce qu'on mesure ici, c'est le texte. */
async function ouvrir(largeur, theme) {
  const p = await nav.newPage({ viewport: { width: largeur, height: 1200 } });
  p.on("pageerror", (e) => soucis.push("erreur JS : " + e.message));
  await p.route("**/*", (r) => {
    const u = r.request().url();
    if (/\.(png|jpg|jpeg|gif|svg|webp)$/.test(u)) return r.fulfill({ status: 404, body: "" });
    if (/\.js$/.test(u)) return r.fulfill({ contentType: "text/javascript", body: "" });
    if (/\.json$/.test(u)) return r.fulfill({ status: 404, body: "" });
    return r.fulfill({ contentType: "text/html; charset=utf-8", body: page(theme) });
  });
  await p.goto("http://wild-mystery.test/annexe-07");
  await p.waitForTimeout(200);
  return p;
}

// ── 1 440 px, THÈME CLAIR ───────────────────────────────────────────

console.log("\n── LES SIX CARTES À 1 440 ──────────────────────────────");
const large = await ouvrir(1440, "clair");

const vu = await large.evaluate(() => {
  const cartes = [...document.querySelectorAll(".wm-groupe")];
  return {
    combien: cartes.length,
    hauteurs: cartes.map((c) => Math.round(c.getBoundingClientRect().height)),
    //  TROIS PAR LIGNE : on le lit sur les abscisses, pas sur le CSS.
    //  Trois cartes partagent le même haut, trois autres un autre.
    lignes: [...new Set(cartes.map((c) => Math.round(c.getBoundingClientRect().top)))].length,
    cartes: cartes.map((c) => ({
      nom: c.querySelector(".wm-groupe__nom")?.textContent ?? null,
      espece: c.querySelector(".wm-groupe__espece")?.textContent ?? null,
      anglais: c.querySelector(".wm-groupe__espece [lang=en]")?.textContent ?? null,
      dit: c.querySelector(".wm-groupe__dit")?.textContent ?? null,
      question: c.querySelector(".wm-groupe__question")?.textContent ?? null,
      traits: [...c.querySelectorAll(".wm-groupe__traits dt")].map((t) => t.textContent),
      valeurs: [...c.querySelectorAll(".wm-groupe__traits dd")].map((t) => t.textContent),
      //  L'AVANTAGE EST-IL DANS LA CARTE, SANS DÉROULER ? On compare
      //  son rectangle à celui de la carte, pas sa position dans le
      //  DOM : il est hors du défilement, c'est le point à prouver.
      avantageVisible: (() => {
        const a = c.querySelector(".wm-groupe__avantage");
        if (a === null) return false;
        const rc = c.getBoundingClientRect();
        const ra = a.getBoundingClientRect();
        return ra.top >= rc.top && ra.bottom <= rc.bottom + 1;
      })(),
      //  AUCUNE BORDURE SUR LES LIGNES DE CARACTÈRE.
      bordures: [...c.querySelectorAll(".wm-groupe__traits, .wm-groupe__traits dt, .wm-groupe__traits dd")]
        .map((e) => {
          const s = getComputedStyle(e);
          return [s.borderTopWidth, s.borderRightWidth, s.borderBottomWidth, s.borderLeftWidth]
            .map((w) => parseFloat(w) || 0)
            .reduce((a, b) => a + b, 0);
        })
        .reduce((a, b) => a + b, 0),
      debordeEnLargeur: c.scrollWidth > c.clientWidth + 1,
    })),
  };
});

dire("LES SIX CARTES SONT LÀ", vu.combien === 6, `${vu.combien} cartes`);
dire(
  "sur deux lignes de trois",
  vu.lignes === 2,
  `${vu.lignes} ligne(s) de hauts différents`,
);
dire(
  "ET ELLES FONT TOUTES LA MÊME HAUTEUR",
  new Set(vu.hauteurs).size === 1,
  JSON.stringify(vu.hauteurs),
);

//  ── LE TEXTE EST CELUI DE CALLISTA, MOT POUR MOT ──────────────────
//
//  « Les descriptions, on touchent pas. » Le harnais compare donc le
//  rendu à `data/groupes.json` caractère par caractère : c'est la
//  seule façon de prouver qu'aucune génération ne l'a raboté.
const dits = vu.cartes.map((c) => c.dit);
const attendus = GROUPES.map((g) => g.description);
dire(
  "LES SIX DESCRIPTIONS SONT CELLES DU FICHIER, MOT POUR MOT",
  JSON.stringify(dits) === JSON.stringify(attendus),
  dits.map((d, i) => (d === attendus[i] ? "=" : `≠ ${GROUPES[i].cle}`)).join(" "),
);
dire(
  "et chaque carte pose sa question",
  vu.cartes.every((c, i) => c.question === GROUPES[i].question),
  vu.cartes.map((c) => c.question).join(" | "),
);

//  ── LES DEUX NOMS, ET SEULEMENT OÙ IL EN FAUT DEUX ────────────────
const avecAnglais = vu.cartes.filter((c) => c.anglais !== null);
dire(
  "UN SEUL NOM ANGLAIS, SUR LE GROUPE QUI EN A BESOIN",
  avecAnglais.length === 1 && avecAnglais[0].anglais === "Uxie",
  JSON.stringify(avecAnglais.map((c) => c.espece)),
);
dire(
  "ET AUCUNE CARTE NE RÉPÈTE LE MÊME NOM DEUX FOIS",
  vu.cartes.every((c) => {
    const mots = (c.espece ?? "").split("·").map((m) => m.trim());
    return new Set(mots).size === mots.length;
  }),
  vu.cartes.map((c) => c.espece).join(" | "),
);
dire(
  "les six emblèmes sont nommés",
  vu.cartes.every((c, i) => (c.espece ?? "").startsWith(GROUPES[i].espece)),
  vu.cartes.map((c) => c.espece).join(" | "),
);

//  ── LES QUATRE LIGNES DE CARACTÈRE ────────────────────────────────
dire(
  "CHAQUE CARTE A SES QUATRE LIGNES DE CARACTÈRE",
  vu.cartes.every((c) => c.traits.length === 4 && c.valeurs.length === 4),
  vu.cartes.map((c) => c.traits.length).join(" "),
);
dire(
  "et aucune ne porte de bordure",
  vu.cartes.every((c) => c.bordures === 0),
  vu.cartes.map((c) => c.bordures).join(" "),
);

//  ── L'AVANTAGE NE DISPARAÎT PAS ───────────────────────────────────
dire(
  "L'AVANTAGE RESTE VISIBLE SANS DÉROULER LA CARTE",
  vu.cartes.every((c) => c.avantageVisible === true),
  vu.cartes.map((c, i) => (c.avantageVisible ? "" : GROUPES[i].cle)).join(" "),
);
dire(
  "et rien ne déborde en largeur",
  vu.cartes.every((c) => c.debordeEnLargeur === false),
  "",
);

await large.close();

// ── 390 px, LE TÉLÉPHONE ────────────────────────────────────────────
//
//  « On touche à rien pour la version mobile » : ce qui est vérifié
//  ici, c'est justement qu'on n'a rien cassé — une colonne, et pas de
//  débordement horizontal de la page.

console.log("\n── À 390 ───────────────────────────────────────────────");
const etroit = await ouvrir(390, "clair");
const vuEtroit = await etroit.evaluate(() => ({
  colonnes: [...new Set(
    [...document.querySelectorAll(".wm-groupe")].map((c) => Math.round(c.getBoundingClientRect().left)),
  )].length,
  pageDeborde: document.documentElement.scrollWidth > globalThis.innerWidth + 1,
  plusLarge: Math.max(
    ...[...document.querySelectorAll(".wm-groupe")].map((c) => Math.round(c.getBoundingClientRect().width)),
  ),
}));
dire("UNE SEULE COLONNE", vuEtroit.colonnes === 1, `${vuEtroit.colonnes}`);
dire(
  "ET LA PAGE NE DÉBORDE PAS",
  vuEtroit.pageDeborde === false,
  `carte la plus large : ${vuEtroit.plusLarge} px`,
);
await etroit.close();

// ── LE THÈME SOMBRE ─────────────────────────────────────────────────
//
//  Les couleurs des six groupes viennent des jetons du panneau
//  d'administration, que le thème sombre redéfinit. Ce qui se vérifie
//  ici, c'est que les NOUVELLES lignes les nomment aussi, au lieu
//  d'une couleur écrite qui resterait claire.

console.log("\n── LE THÈME SOMBRE ─────────────────────────────────────");
const sombre = await ouvrir(1440, "sombre");
const vuSombre = await sombre.evaluate(() => {
  const dedans = (c) => c.split(/[(,)]/).slice(1, 4).map((n) => parseFloat(n));
  const clair = (c) => {
    const [r, v, b] = dedans(c);
    return (0.2126 * r + 0.7152 * v + 0.0722 * b) / 255;
  };
  const carte = document.querySelector(".wm-groupe");
  return {
    fond: getComputedStyle(carte).backgroundColor,
    fondClair: clair(getComputedStyle(carte).backgroundColor),
    espece: getComputedStyle(carte.querySelector(".wm-groupe__espece")).color,
    trait: getComputedStyle(carte.querySelector(".wm-groupe__traits dd")).color,
    traitClair: clair(getComputedStyle(carte.querySelector(".wm-groupe__traits dd")).color),
  };
});
//  LE SENS COMPTE, PAS LA VALEUR : sur un fond sombre, le texte doit
//  être PLUS clair que lui. Un seuil chiffré ici doublerait
//  `outils/contraste.mjs`, qui fait ce calcul pour toute la charte.
dire(
  "SUR FOND SOMBRE, LE TEXTE DES LIGNES EST PLUS CLAIR QUE LE FOND",
  vuSombre.traitClair > vuSombre.fondClair,
  JSON.stringify(vuSombre),
);
await sombre.close();

await nav.close();

console.log("");
if (soucis.length === 0) console.log("TOUT PASSE.");
else {
  console.log(`${soucis.length} défaut(s) :`);
  for (const s of soucis) console.log(`  · ${s}`);
  Deno.exit(1);
}
