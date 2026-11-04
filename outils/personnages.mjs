// ════════════════════════════════════════════════════════════════════
//  outils/personnages.mjs — l'annexe des célébrités, dans un vrai
//  navigateur.
//
//  COUVRE : src/adaptateurs/navigateur/module-personnages.ts
//
//  CE QU'IL REGARDE, et qu'aucun test sans navigateur ne verrait :
//
//    · SANS LE SCRIPT, les quatorze fiches sont là, toutes visibles,
//      et la légende dit ce que les trois statuts veulent dire. C'est
//      la règle du projet : un bouton n'a le droit de cacher que ce
//      qu'il peut remontrer, donc aucun filtre n'est écrit dans la
//      page ;
//    · avec le script, la barre se pose, et SES NOMBRES SONT CEUX DU
//      FICHIER — relus ici, pas recopiés. Une barre qui annonce cinq
//      jouables là où il y en a quatre est exactement la faute qu'on
//      ne voit pas ;
//    · un clic ne montre QUE le statut cliqué, et « Tous » remet les
//      quatorze. La vérification porte sur ce qui est visible à
//      l'écran, pas sur un attribut : `hidden` ne suffit pas à cacher
//      une fiche en `display: flex`, et c'est la faute classique ;
//    · LES MOTS DES BOUTONS SONT LES MOTS DE LA PAGE. Les trois
//      libellés existent en deux endroits — `MOT_DU_STATUT` dans
//      `outils/annexe-personnages.py` et `MOTS` dans
//      `src/navigateur/personnages.ts`. Deux listes finissent par
//      diverger ; celle-ci est la seule mesure qui les tient ;
//    · un GIF mort retombe sur la silhouette. Deux des six adresses
//      relevées dans le sujet du forum ne répondaient déjà plus le 4
//      novembre, et une image cassée dans une fiche est pire qu'une
//      silhouette ;
//    · rien ne déborde à 390.
//
//  LE DÉCOR SERT LA VRAIE PAGE. `pages/annexe-11-…html` telle qu'elle
//  sera collée, `js/annexes.js` tel qu'il sera servi, et
//  `data/personnages.json` du dépôt. Un décor qui ne reproduit pas ce
//  que l'hôte sert ne teste que lui-même.
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
const lire = (c) => readFileSync(R + c, "utf8");
const json = (c) => JSON.parse(lire(c));

const PAGE = lire("pages/annexe-11-celebrites-de-rhode.html");
const PERSOS = json("data/personnages.json");
const FICHES = PERSOS.celebrites.fiches;

//  LES COMPTES ATTENDUS VIENNENT DU FICHIER, pas d'une constante
//  écrite ici : une constante à la main ne compare que deux fautes
//  possibles.
const ATTENDU = {};
for (const f of FICHES) ATTENDU[f.statut] = (ATTENDU[f.statut] ?? 0) + 1;
const MOT = { jouable: "Jouable", joue: "Joué", pnj: "PNJ" };

//  L'ADRESSE MORTE, celle de Vamper chez narvii. Elle est servie en
//  404 pour voir la silhouette prendre sa place ; les autres GIF sont
//  servis en pixel.
const MORTE = FICHES.find((f) => /narvii/.test(f.avatar ?? ""))?.avatar ?? null;

const PIXEL = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

let passes = 0;
const soucis = [];
function ok(quoi, vrai, detail) {
  if (vrai) {
    passes += 1;
    console.log(`  ok   ${quoi}`);
  } else {
    soucis.push(quoi);
    console.log(`  NON  ${quoi}${detail === undefined ? "" : ` — ${JSON.stringify(detail)}`}`);
  }
}

async function ouvrir(nav, { avecScript = true, largeur = 1440, fragment = "" } = {}) {
  const p = await nav.newPage({ viewport: { width: largeur, height: 900 } });
  p.on("pageerror", (e) => soucis.push("erreur JS : " + e.message));

  await p.route("**/*", (r) => {
    const u = r.request().url();
    const rendre = (type, corps) => r.fulfill({ contentType: type, body: corps });

    if (/\/annexe-11/.test(u)) return rendre("text/html; charset=utf-8", PAGE);
    if (/jetons\.css$/.test(u)) return rendre("text/css", lire("panneau-admin/jetons.css"));
    if (/wild-mystery\.css$/.test(u)) return rendre("text/css", lire("css/wild-mystery.css"));
    if (/\/js\/annexes\.js$/.test(u)) {
      return rendre("text/javascript", avecScript ? lire("js/annexes.js") : "");
    }
    if (/\/data\/([a-z-]+)\.json$/.test(u)) {
      const nom = /\/data\/([a-z-]+)\.json$/.exec(u)[1];
      try {
        return rendre("application/json", lire(`data/${nom}.json`));
      } catch {
        return r.fulfill({ status: 404, body: "" });
      }
    }
    if (MORTE !== null && u === MORTE) return r.fulfill({ status: 404, body: "" });
    if (/\.(png|jpe?g|gif)/.test(u)) return r.fulfill({ contentType: "image/png", body: PIXEL });
    if (/fonts\.(googleapis|gstatic)/.test(u)) return rendre("text/css", "");
    return r.fulfill({ status: 404, body: "" });
  });

  await p.goto(`https://exemple.test/annexe-11${fragment}`, { waitUntil: "domcontentloaded" });
  return p;
}

/** Ce qui est VISIBLE à l'écran, par statut. */
const regarder = () => ({
  fiches: Array.from(document.querySelectorAll("[data-wm-statut-fiche]")).map((f) => ({
    statut: f.dataset.wmStatutFiche,
    vue: f.getBoundingClientRect().height > 0,
    avatar: f.querySelector("img.wm-perso__avatar") !== null,
    silhouette: f.querySelector(".wm-perso__avatar--vide") !== null,
    nom: f.querySelector(".wm-perso__nom")?.textContent?.trim() ?? "",
  })),
  boutons: Array.from(document.querySelectorAll(".wm-filtre")).map((b) => ({
    cle: b.dataset.wmFiltre,
    mot: b.querySelector(".wm-filtre__mot")?.textContent?.trim() ?? "",
    nombre: Number(b.querySelector(".wm-filtre__nombre")?.textContent ?? "-1"),
    actif: b.classList.contains("wm-filtre--actif"),
    presse: b.getAttribute("aria-pressed"),
  })),
  annonce: document.querySelector(".wm-filtres__compte")?.textContent?.trim() ?? "",
  legende: Array.from(document.querySelectorAll(".wm-statuts-dits .wm-perso__statut")).map((
    s,
  ) => ({ cle: s.dataset.wmStatut, mot: s.textContent?.trim() ?? "" })),
});

const nav = await chromium.launch(CHROME === undefined ? {} : { executablePath: CHROME });

// ════════════════════════════════════════════════════════════════════
//  1 · SANS LE SCRIPT
// ════════════════════════════════════════════════════════════════════
console.log("\n── sans JavaScript : les quatorze fiches, et la légende ──");
{
  const p = await ouvrir(nav, { avecScript: false });
  const vu = await p.evaluate(regarder);
  ok(
    `les ${FICHES.length} fiches sont dans la page`,
    vu.fiches.length === FICHES.length,
    vu.fiches.length,
  );
  ok("et toutes visibles — aucun filtre écrit dans la page", vu.fiches.every((f) => f.vue));
  ok("aucune barre de filtres sans le script", vu.boutons.length === 0, vu.boutons.length);
  ok(
    "la légende dit les trois statuts",
    vu.legende.length === 3 && vu.legende.every((l) => MOT[l.cle] === l.mot),
    vu.legende,
  );
  await p.close();
}

// ════════════════════════════════════════════════════════════════════
//  2 · LA BARRE, ET SES NOMBRES
// ════════════════════════════════════════════════════════════════════
console.log("\n── la barre se pose, et ses nombres sont ceux du fichier ──");
const p = await ouvrir(nav);
await p.waitForFunction(() => document.querySelectorAll(".wm-filtre").length > 0, undefined, {
  timeout: 15000,
});
{
  const vu = await p.evaluate(regarder);
  const parCle = Object.fromEntries(vu.boutons.map((b) => [b.cle, b]));

  ok(
    "quatre boutons : tous, puis les trois statuts tenus",
    vu.boutons.map((b) => b.cle).join(",") === "tous,jouable,joue,pnj",
    vu.boutons.map((b) => b.cle),
  );
  ok(
    `« Tous » annonce ${FICHES.length}`,
    parCle.tous?.nombre === FICHES.length,
    parCle.tous?.nombre,
  );
  for (const [cle, n] of Object.entries(ATTENDU)) {
    ok(`« ${MOT[cle]} » annonce ${n}, comme le fichier`, parCle[cle]?.nombre === n, {
      bouton: parCle[cle]?.nombre,
      fichier: n,
    });
  }
  //  LE PONT PYTHON ↔ TYPESCRIPT. Les mots des boutons viennent du
  //  module TypeScript, ceux de la légende du générateur Python.
  ok(
    "les mots des boutons sont ceux de la légende",
    vu.legende.every((l) => parCle[l.cle]?.mot === l.mot),
    { boutons: vu.boutons.map((b) => b.mot), legende: vu.legende.map((l) => l.mot) },
  );
  ok("« Tous » est actif au chargement", parCle.tous?.actif === true);
  ok("et il le dit au clavier", parCle.tous?.presse === "true", parCle.tous?.presse);
  ok(
    `l'annonce dit « ${FICHES.length} personnages »`,
    vu.annonce === `${FICHES.length} personnages`,
    vu.annonce,
  );
}

// ════════════════════════════════════════════════════════════════════
//  3 · UN CLIC NE MONTRE QUE SON STATUT
// ════════════════════════════════════════════════════════════════════
console.log("\n── un clic ne montre que le statut cliqué ──");
for (const [cle, n] of Object.entries(ATTENDU)) {
  await p.click(`.wm-filtre[data-wm-filtre="${cle}"]`);
  const vu = await p.evaluate(regarder);
  const vues = vu.fiches.filter((f) => f.vue);
  ok(`« ${MOT[cle]} » laisse ${n} fiche(s) à l'écran`, vues.length === n, {
    vues: vues.length,
    attendu: n,
  });
  ok(
    `et aucune d'un autre statut`,
    vues.every((f) => f.statut === cle),
    vues.filter((f) => f.statut !== cle).map((f) => f.nom),
  );
  ok(
    "l'annonce suit le filtre",
    vu.annonce === `${n} personnage${n === 1 ? "" : "s"} — ${MOT[cle].toLowerCase()}`,
    vu.annonce,
  );
}
{
  await p.click('.wm-filtre[data-wm-filtre="tous"]');
  const vu = await p.evaluate(regarder);
  ok(
    `« Tous » remet les ${FICHES.length}`,
    vu.fiches.filter((f) => f.vue).length === FICHES.length,
    vu.fiches.filter((f) => f.vue).length,
  );
}

// ════════════════════════════════════════════════════════════════════
//  4 · LES AVATARS
// ════════════════════════════════════════════════════════════════════
console.log("\n── les avatars : un GIF pour ceux qu'on joue, rien pour les PNJ ──");
{
  const vu = await p.evaluate(regarder);
  const attenduAvecGif = FICHES.filter((f) => f.avatar).map((f) => f.nom);
  const avecImage = vu.fiches.filter((f) => f.avatar).map((f) => f.nom);

  ok(
    "aucun PNJ n'a d'avatar — on ne le joue pas",
    vu.fiches.filter((f) => f.statut === "pnj").every((f) => f.silhouette && !f.avatar),
    vu.fiches.filter((f) => f.statut === "pnj" && f.avatar).map((f) => f.nom),
  );
  //  MOINS UNE : l'adresse morte a été remplacée par la silhouette,
  //  et c'est précisément ce qu'on vient voir.
  ok(
    `${attenduAvecGif.length - (MORTE === null ? 0 : 1)} GIF tiennent, l'adresse morte retombe sur la silhouette`,
    avecImage.length === attenduAvecGif.length - (MORTE === null ? 0 : 1),
    { vus: avecImage, attendus: attenduAvecGif },
  );
  const mort = FICHES.find((f) => f.avatar === MORTE);
  if (mort !== undefined) {
    ok(
      `${mort.nom} montre une silhouette et pas une image cassée`,
      vu.fiches.find((f) => f.nom === mort.nom)?.silhouette === true,
      vu.fiches.find((f) => f.nom === mort.nom),
    );
  }
}

// ════════════════════════════════════════════════════════════════════
//  5 · L'ADRESSE PEUT OUVRIR SUR UN FILTRE
// ════════════════════════════════════════════════════════════════════
console.log("\n── un lien peut ouvrir la page déjà filtrée ──");
{
  const q = await ouvrir(nav, { fragment: "#jouable" });
  await q.waitForFunction(() => document.querySelectorAll(".wm-filtre").length > 0, undefined, {
    timeout: 15000,
  });
  const vu = await q.evaluate(regarder);
  ok(
    "#jouable ouvre sur les jouables",
    vu.fiches.filter((f) => f.vue).length === ATTENDU.jouable,
    vu.fiches.filter((f) => f.vue).length,
  );
  await q.close();
}
{
  //  LE FRAGMENT DES SOUS-ONGLETS N'EST PAS UN FILTRE. Les deux
  //  mécanismes lisent le même `#`, et `#les-champions` doit changer
  //  d'onglet sans toucher au tri.
  const q = await ouvrir(nav, { fragment: "#les-champions" });
  await q.waitForFunction(() => document.querySelectorAll(".wm-onglet").length > 0, undefined, {
    timeout: 15000,
  });
  const vu = await q.evaluate(() => ({
    onglet: document.querySelector(".wm-onglet--actif")?.textContent?.trim() ?? "",
    fichesVues: Array.from(document.querySelectorAll("[data-wm-statut-fiche]")).filter((f) =>
      !f.hidden
    ).length,
  }));
  ok("#les-champions ouvre l'onglet des champions", /champions/i.test(vu.onglet), vu.onglet);
  ok(
    "et laisse le tri sur « Tous »",
    vu.fichesVues === FICHES.length,
    vu.fichesVues,
  );
  await q.close();
}

// ════════════════════════════════════════════════════════════════════
//  6 · 390 PIXELS
// ════════════════════════════════════════════════════════════════════
console.log("\n── à 390 pixels ──");
{
  const q = await ouvrir(nav, { largeur: 390 });
  await q.waitForFunction(() => document.querySelectorAll(".wm-filtre").length > 0, undefined, {
    timeout: 15000,
  });
  const vu = await q.evaluate(() => ({
    debord: document.documentElement.scrollWidth > window.innerWidth + 1,
    large: document.documentElement.scrollWidth,
    fiche: document.querySelector(".wm-perso")?.getBoundingClientRect().width ?? 0,
  }));
  ok("rien ne déborde", !vu.debord, vu);
  ok("et une fiche tient dans l'écran", vu.fiche > 0 && vu.fiche <= 390, vu.fiche);
  await q.close();
}

await p.close();
await nav.close();

console.log(`\n${passes} contrôles passés.`);
if (soucis.length > 0) {
  console.log(`\n${soucis.length} PROBLÈME(S) :`);
  for (const s of soucis) console.log(`  · ${s}`);
  Deno.exit(1);
}
console.log("TOUT PASSE.");
