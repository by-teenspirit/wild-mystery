// ════════════════════════════════════════════════════════════════════
//  outils/theme.mjs — L'ÉCLAIR CLAIR AVANT LE THÈME SOMBRE
//
//  « Quand je suis en mode sombre, j'ai toujours le glitch du mode
//  clair même s'il est léger. » — 18 novembre, après une première
//  réparation le 9 qui n'avait traité qu'une moitié.
//
//  ── CE QUI SE MESURE ICI, ET POURQUOI C'EST DUR ───────────────────
//
//  Un éclair ne se photographie pas : il dure le temps d'un rendu, et
//  une capture d'écran arrive toujours après. Ce qui se mesure, c'est
//  le MOMENT où la classe est posée.
//
//  Le forum sert notre script dans le `<head>`, sans `defer` (relevé
//  sur le forum le 18 novembre). À cet instant `document.body` vaut
//  null : la pose du thème attendait donc `DOMContentLoaded`, soit la
//  fin de l'analyse de toute la page, alors que le navigateur peint
//  bien avant.
//
//  LE DÉCOR POSE DONC UN MOUCHARD EN PREMIÈRE LIGNE DU CORPS. Il note
//  ce que `html` porte À CE MOMENT-LÀ — c'est-à-dire avant que le
//  reste de la page soit analysé, et donc avant tout rendu de contenu.
//  Si la classe y est, il n'y a pas d'éclair. Si elle n'y est pas,
//  il y en a un, et sa durée est celle de la page.
//
//  Usage : deno task theme
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
const soucis = [];
const dire = (nom, ok, detail = "") => {
  console.log(`  ${ok ? "ok  " : "DÉFAUT"} ${nom}${detail === "" ? "" : " — " + detail}`);
  if (!ok) soucis.push(nom + (detail === "" ? "" : " — " + detail));
};

//  LE SCRIPT EST DANS LA TÊTE, COMME SUR LE FORUM. Le mettre en bas du
//  corps ferait disparaître le défaut du décor sans le corriger nulle
//  part — c'est la faute que ce fichier existe pour ne plus commettre.
const page = `<!doctype html><html><head>
<meta charset="utf-8">
<link rel="stylesheet" href="/css/wild-mystery.css">
<script>
  /*  LE PREMIER MOUCHARD, AVANT LE PAQUET. Il note la condition dans
      laquelle notre script va tourner : dans la tête, le corps n'est
      pas encore analysé. C'est la PRÉMISSE de toute la réparation du
      18 novembre, et une prémisse se vérifie. */
  globalThis.wmAvantLePaquet = { corpsExiste: document.body !== null };
</script>
<script src="/js/wild-mystery.js"></script>
</head>
<body>
<script>
  /*  LE MOUCHARD, EN PREMIÈRE LIGNE DU CORPS. */
  globalThis.wmAuDebutDuCorps = {
    html: document.documentElement.className,
    fond: getComputedStyle(document.documentElement).backgroundColor,
    schema: getComputedStyle(document.documentElement).colorScheme,
    corpsExiste: document.body !== null,
  };
</script>
<div id="modernbb"><div class="wm-annexe"><p>Un peu de contenu.</p></div></div>
</body></html>`;

const nav = await chromium.launch(CHROME === undefined ? {} : { executablePath: CHROME });

/** Monte la page avec un choix de thème déjà rangé, et le système
 *  réglé comme on veut. */
async function monter({ choix = null, systeme = "light" } = {}) {
  const p = await nav.newPage({ viewport: { width: 1200, height: 800 }, colorScheme: systeme });
  p.on("pageerror", (e) => soucis.push("erreur JS : " + e.message));
  //  LE CHOIX EST RANGÉ AVANT QUE LE SCRIPT TOURNE : c'est la
  //  situation d'un joueur qui revient, la seule où l'éclair se voit.
  if (choix !== null) {
    await p.addInitScript((c) => {
      try {
        localStorage.setItem("wm.theme", c);
      } catch { /* une fenêtre privée n'empêche pas la page de vivre */ }
    }, choix);
  }
  await p.route("**/*", (r) => {
    const u = new URL(r.request().url()).pathname;
    if (u === "/js/wild-mystery.js") {
      return r.fulfill({
        contentType: "text/javascript",
        body: readFileSync(R + "js/wild-mystery.js", "utf8"),
      });
    }
    //  TOUT LE RESTE EST ABSENT, ET LE DIT. Sans ça, le serveur du
    //  harnais rendait la page HTML en réponse aux `data/*.json` et
    //  aux scripts du forum, et le navigateur essayait de l'exécuter :
    //  « Unexpected token < », huit fois par page.
    if (u === "/css/wild-mystery.css") {
      return r.fulfill({
        contentType: "text/css",
        body: readFileSync(R + "css/wild-mystery.css", "utf8") +
          readFileSync(R + "panneau-admin/jetons.css", "utf8"),
      });
    }
    if (u.startsWith("/data/") || /\.(js|json|png|jpg|gif|css)$/.test(u)) {
      return r.fulfill({ status: 404, body: "" });
    }
    return r.fulfill({ contentType: "text/html; charset=utf-8", body: page });
  });
  await p.goto("http://wild-mystery.test/t1-un-sujet");
  return p;
}

// ── 1 · LE CHOIX SOMBRE EST POSÉ AVANT QUE LE CORPS SOIT LÀ ────────
console.log("\n── UN JOUEUR QUI A CHOISI LE SOMBRE ───────────────────");
let p = await monter({ choix: "sombre" });
let tot = await p.evaluate(() => globalThis.wmAuDebutDuCorps);
const avant = await p.evaluate(() => globalThis.wmAvantLePaquet);
dire(
  "LE CORPS N'EXISTE PAS QUAND LE PAQUET TOURNE — la prémisse de toute l'affaire",
  avant.corpsExiste === false,
  `document.body ${avant.corpsExiste ? "existait" : "valait null"}`,
);
dire(
  "ET POURTANT `html` PORTE DÉJÀ LA CLASSE SOMBRE",
  tot.html.includes("wm-sombre"),
  `class="${tot.html}"`,
);
dire(
  "la toile est déjà peinte en sombre, pas en crème",
  tot.fond === "rgb(26, 18, 16)",
  tot.fond,
);
dire(
  "et les contrôles du navigateur suivent",
  tot.schema === "dark",
  tot.schema,
);
//  ET LE CORPS L'A AUSSI, UNE FOIS LÀ : toutes nos règles de composant
//  passent par `body`, l'une ne remplace pas l'autre.
const apres = await p.evaluate(() => ({
  html: document.documentElement.className,
  corps: document.body.className,
}));
dire(
  "le corps la reçoit à son tour",
  apres.corps.includes("wm-sombre") && apres.html.includes("wm-sombre"),
  JSON.stringify(apres),
);
await p.close();

// ── 2 · LE CHOIX CLAIR NE POSE RIEN ────────────────────────────────
console.log("\n── UN JOUEUR QUI A CHOISI LE CLAIR ────────────────────");
p = await monter({ choix: "clair", systeme: "dark" });
tot = await p.evaluate(() => globalThis.wmAuDebutDuCorps);
dire(
  "AUCUNE CLASSE, MÊME AVEC UN SYSTÈME SOMBRE — son choix l'emporte",
  !tot.html.includes("wm-sombre"),
  `class="${tot.html}"`,
);
await p.close();

// ── 3 · SANS CHOIX, C'EST LE SYSTÈME QUI DIT ───────────────────────
console.log("\n── SANS CHOIX RANGÉ ───────────────────────────────────");
p = await monter({ systeme: "dark" });
tot = await p.evaluate(() => globalThis.wmAuDebutDuCorps);
dire(
  "SYSTÈME SOMBRE : la classe est là, dès la tête",
  tot.html.includes("wm-sombre"),
  `class="${tot.html}"`,
);
await p.close();

p = await monter({ systeme: "light" });
tot = await p.evaluate(() => globalThis.wmAuDebutDuCorps);
//  EN CLAIR, `html` N'A PAS DE FOND À LUI, et c'est voulu : c'est
//  ModernBB qui peint la toile avec la couleur réglée au panneau
//  d'administration. Nos feuilles ne la touchent QUE pour le sombre —
//  un fond clair écrit ici écraserait son réglage. Le harnais ne sert
//  pas la feuille de ModernBB, d'où le transparent.
dire(
  "SYSTÈME CLAIR : aucune classe, et la toile n'est pas repeinte en sombre",
  !tot.html.includes("wm-sombre") && tot.fond !== "rgb(26, 18, 16)",
  `class="${tot.html}" · ${tot.fond}`,
);
await p.close();

await nav.close();
if (soucis.length > 0) for (const x of soucis) console.log("  · " + x);
console.log(soucis.length === 0 ? "\nTOUT PASSE." : `\n${soucis.length} DÉFAUT(S).`);
if (soucis.length > 0) Deno.exit(1);
