// ════════════════════════════════════════════════════════════════════
//  outils/confort.mjs
//
//  POURQUOI CE HARNAIS EXISTE. Le panneau de confort est du DOM, des
//  écouteurs et de la position : aucune des trois ne se vérifie dans un
//  test de domaine. Et les trois défauts qu'on veut interdire sont des
//  défauts de GÉOMÉTRIE et de CLAVIER :
//
//    · il DÉPASSE — c'est le défaut que Callista a signalé le 7
//      octobre, et le harnais le mesure à quatre largeurs d'écran, dont
//      320 px ;
//    · il ne se ferme pas au clavier — un menu qu'on ouvre sans pouvoir
//      le fermer est un piège pour qui n'a pas de souris, et sur un
//      panneau d'accessibilité ce serait une faute particulière ;
//    · il reste lisible par un lecteur d'écran alors qu'il est fermé.
//
//  Lancé par `deno task confort`. Il monte le vrai paquet du navigateur
//  — `js/wild-mystery.js`, celui qui est servi — et pas une copie.
// ════════════════════════════════════════════════════════════════════

import { chromium } from "npm:playwright@1.49.1";
import { readFileSync } from "node:fs";

const R = new URL("..", import.meta.url).pathname;
const CHROME = [
  "/opt/pw-browsers/chromium",
  "/opt/pw-browsers/chromium-1140/chrome-linux/chrome",
].find((c) => {
  try {
    readFileSync(c);
    return true;
  } catch {
    return false;
  }
});

const page = `<!doctype html><html lang="fr" id="min-width"><head><meta charset="utf-8">
<style>html,body{margin:0;height:100%}body{display:flex;flex-direction:column}</style>
<style>${readFileSync(R + "panneau-admin/jetons.css", "utf8")}</style>
<style>${readFileSync(R + "css/wild-mystery.css", "utf8")}</style></head>
<body id="modernbb">
<div id="page-body"><div class="forabg" style="height:3000px">des forums</div></div>
</body></html>`;

const nav = await chromium.launch(CHROME === undefined ? {} : { executablePath: CHROME });
const p = await nav.newPage({ viewport: { width: 1280, height: 900 } });
const soucis = [];
p.on("pageerror", (e) => soucis.push("erreur JS : " + e.message));

await p.goto("https://exemple.test/", { waitUntil: "domcontentloaded" }).catch(() => {});
await p.route("**/*", (r) => r.fulfill({ contentType: "text/html; charset=utf-8", body: page }));
await p.goto("https://exemple.test/");
await p.addScriptTag({ content: readFileSync(R + "js/wild-mystery.js", "utf8") });
await p.waitForTimeout(250);

function dire(nom, ok, detail = "") {
  if (!ok) soucis.push(nom + (detail ? " — " + detail : ""));
  console.log(`${ok ? "  ok  " : "DÉFAUT"} ${nom}${detail ? " — " + detail : ""}`);
}

// ── le bouton est là, et il est petit ───────────────────────────────
const bouton = await p.evaluate(() => {
  const b = document.querySelector(".wm-confort__bouton");
  if (b === null) return null;
  const r = b.getBoundingClientRect();
  return {
    l: Math.round(r.width),
    h: Math.round(r.height),
    deplie: b.getAttribute("aria-expanded"),
    commande: b.getAttribute("aria-controls"),
    libelle: b.getAttribute("aria-label"),
    texte: b.textContent.trim(),
    picto: b.querySelector("svg") !== null,
    dansLeCoin: b.closest(".wm-coin") !== null,
  };
});
dire("le bouton de confort existe", bouton !== null);
dire("il est dans le coin d'outils, pas dans un second coin", bouton?.dansLeCoin === true);
dire(
  "IL EST PETIT : il tient dans la largeur du coin",
  bouton !== null && bouton.l <= 92 && bouton.h <= 60,
  JSON.stringify(bouton),
);
dire("il a son pictogramme en tracé, pas une ligature", bouton?.picto === true);
dire("il dit qu'il est replié", bouton?.deplie === "false");
dire("et il dit ce qu'il commande", bouton?.commande === "wm-confort-panneau");

// ── fermé, il n'existe pas pour un lecteur d'écran ──────────────────
const ferme = await p.evaluate(() => {
  const pan = document.querySelector("#wm-confort-panneau");
  return {
    cache: pan.hidden,
    visible: pan.getBoundingClientRect().height > 0,
    choix: pan.querySelectorAll(".wm-confort__choix").length,
  };
});
dire("le panneau est caché au départ", ferme.cache === true && ferme.visible === false);
dire("et il porte bien les trois réglages", ferme.choix === 3, JSON.stringify(ferme));

// ── il s'ouvre, ET IL NE DÉPASSE PAS ────────────────────────────────
async function ouvrirEtMesurer() {
  return await p.evaluate(() => {
    const b = document.querySelector(".wm-confort__bouton");
    if (document.querySelector("#wm-confort-panneau").hidden) b.click();
    const pan = document.querySelector("#wm-confort-panneau");
    const r = pan.getBoundingClientRect();
    const bR = b.getBoundingClientRect();
    return {
      ecran: innerWidth,
      x: Math.round(r.x),
      droite: Math.round(r.right),
      y: Math.round(r.y),
      bas: Math.round(r.bottom),
      l: Math.round(r.width),
      h: Math.round(r.height),
      deplie: b.getAttribute("aria-expanded"),
      //  DANS L'ÉCRAN, des quatre côtés. C'est le défaut signalé.
      dedans: r.x >= 0 && r.right <= innerWidth && r.y >= 0 && r.bottom <= innerHeight,
      //  Et AU-DESSUS du bouton : vers le bas il n'y a que 16 px.
      auDessus: Math.round(r.bottom) <= Math.round(bR.top) + 1,
      debordDuDocument: document.documentElement.scrollWidth > innerWidth,
    };
  });
}

const ouvert = await ouvrirEtMesurer();
dire("il s'ouvre au clic", ouvert.h > 0 && ouvert.deplie === "true", JSON.stringify(ouvert));
dire("IL NE DÉPASSE PAS DE L'ÉCRAN", ouvert.dedans, JSON.stringify(ouvert));
dire("il s'ouvre au-dessus du bouton", ouvert.auDessus, JSON.stringify(ouvert));
dire("et il ne fait rien déborder horizontalement", !ouvert.debordDuDocument);

// ── un réglage se coche, et ça se voit sur la page ──────────────────
const coche = await p.evaluate(() => {
  const choix = [...document.querySelectorAll(".wm-confort__choix")];
  const grossir = choix.find((c) => /Grossir/i.test(c.textContent));
  grossir.click();
  return {
    presse: grossir.getAttribute("aria-pressed"),
    classeSurLeCorps: document.body.classList.contains("wm-texte-large"),
    //  La clé est celle de `src/navigateur/preferences.ts` — `wm.confort` —
    //  et on la lit telle quelle plutôt que de deviner : une clé
    //  devinée ferait passer le test en ne vérifiant rien.
    retenu: localStorage.getItem("wm.confort"),
    //  La coche est une FORME : on vérifie qu'elle existe, pas sa
    //  couleur — un état qui ne se lit qu'à la nuance disparaît pour
    //  une personne sur douze.
    forme: grossir.querySelector(".wm-confort__coche") !== null,
  };
});
dire("un réglage se coche", coche.presse === "true", JSON.stringify(coche));
dire("et il s'applique au corps de la page", coche.classeSurLeCorps);
dire("la coche est une forme, pas une couleur", coche.forme);
dire("et le choix est retenu", coche.retenu !== null, String(coche.retenu));

// ── ÉCHAP FERME, ET REND LE FOCUS ───────────────────────────────────
await p.keyboard.press("Escape");
const apresEchap = await p.evaluate(() => ({
  cache: document.querySelector("#wm-confort-panneau").hidden,
  deplie: document.querySelector(".wm-confort__bouton").getAttribute("aria-expanded"),
  focus: document.activeElement?.className ?? "",
}));
dire("Échap ferme le panneau", apresEchap.cache === true && apresEchap.deplie === "false");
dire(
  "ET LE FOCUS REVIENT AU BOUTON : sinon la tabulation repart du haut de la page",
  apresEchap.focus.includes("wm-confort__bouton"),
  apresEchap.focus,
);

// ── un clic à côté ferme aussi ──────────────────────────────────────
await p.evaluate(() => document.querySelector(".wm-confort__bouton").click());
await p.evaluate(() => document.querySelector("#page-body").click());
dire(
  "un clic à côté ferme le panneau",
  await p.evaluate(() => document.querySelector("#wm-confort-panneau").hidden === true),
);

// ── ET SUR UN PETIT ÉCRAN, c'est là que ça dépassait ────────────────
for (const largeur of [900, 520, 390, 320]) {
  await p.setViewportSize({ width: largeur, height: 740 });
  await p.waitForTimeout(80);
  const m = await ouvrirEtMesurer();
  dire(`à ${largeur} px, il reste dans l'écran`, m.dedans, JSON.stringify(m));
  dire(`à ${largeur} px, rien ne déborde`, !m.debordDuDocument);
  await p.keyboard.press("Escape");
}

await nav.close();
console.log(soucis.length === 0 ? "\nTOUT PASSE." : `\n${soucis.length} DÉFAUT(S).`);
for (const s of soucis) console.log("  · " + s);
if (soucis.length > 0) Deno.exit(1);
