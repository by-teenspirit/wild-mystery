// ════════════════════════════════════════════════════════════════════
//  outils/formulaires.mjs — les formulaires de Forumactif, dans un
//  vrai navigateur.
//
//  COUVRE : css/26-formulaires-fa.css
//
//      deno run -A outils/formulaires.mjs
//
//  ── POURQUOI IL EXISTE ────────────────────────────────────────────
//
//  « Quand j'édite mon profil : tu peux améliorer le choix de la date
//  de naissance ? Au moins mettre les champs côte à côte et pas aussi
//  longs », 17 novembre.
//
//  La feuille `26` était la seule du dépôt à habiller des pages
//  entières SANS AUCUN HARNAIS. Elle a été écrite le 10 novembre à
//  partir d'un relevé fait à la main, et rien ne la tenait depuis.
//  Le défaut qu'elle portait est exactement de la famille que ça
//  laisse passer : sa propre règle `dd select { width: 100%
//  !important }` — juste pour un champ — faisait trois barres pleine
//  largeur d'une ligne qui en porte trois.
//
//  ── CE QU'IL MONTE, ET POURQUOI DEUX FORMES DE LA MÊME LIGNE ──────
//
//  L'édition du profil demande une connexion et on ne s'y connecte pas
//  d'ici : le balisage vient du relevé du 10 novembre
//  (`forumactif/89-les-formulaires-de-forumactif.md`) et du gabarit
//  amont. Comme on ne voit pas la page, on monte LES DEUX écritures
//  possibles de la ligne de date — menus l'un après l'autre, et menus
//  séparés par des `<br>` — plutôt que de parier sur celle qu'on
//  imagine. La leçon de la journée : un harnais qui ne monte qu'un
//  balisage livre les défauts des autres.
//
//  ── ET LE CONTRÔLE QUI COMPTE AUTANT : CE QUI NE DOIT PAS BOUGER ──
//
//  Une ligne à UN SEUL menu garde toute la colonne, et une ligne de
//  `/search` qui porte plusieurs `<dd>` — le cas des boutons radio —
//  n'est pas une ligne de menus. Une règle qui range bien la date et
//  qui dérange le reste n'est pas un correctif.
// ════════════════════════════════════════════════════════════════════

import { readFileSync } from "node:fs";
import { chromium } from "npm:playwright@1.56.0";

const CHROME = [
  "/opt/pw-browsers/chromium",
  "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
  "/opt/pw-browsers/chromium-1140/chrome-linux/chrome",
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

const soucis = [];
function dire(nom, ok, detail = "") {
  console.log(`  ${ok ? "ok  " : "DÉFAUT"} ${nom}${detail === "" ? "" : " — " + detail}`);
  if (!ok) soucis.push(nom + (detail === "" ? "" : " — " + detail));
}

//  LES MOIS EN TOUTES LETTRES : c'est le plus long des trois menus, et
//  c'est lui qui décide si « pas aussi longs » tient.
const MOIS = [
  "Janvier",
  "Février",
  "Mars",
  "Avril",
  "Mai",
  "Juin",
  "Juillet",
  "Août",
  "Septembre",
  "Octobre",
  "Novembre",
  "Décembre",
];

const menu = (nom, options) =>
  `<select name="${nom}" class="gensmall">${
    options.map((o) => `<option value="${o}">${o}</option>`).join("")
  }</select>`;

const JOURS = Array.from({ length: 31 }, (_, i) => String(i + 1));
const ANNEES = Array.from({ length: 60 }, (_, i) => String(2010 - i));

/** La ligne de date, dans ses deux écritures possibles. */
const ligneDeDate = (id, avecDesSauts) =>
  `<dl id="${id}"><dt><label>Date de naissance :</label></dt><dd>${
    [
      menu("day", JOURS),
      menu("month", MOIS),
      //  `style="width:250px"` EN LIGNE : c'est ce que Forumactif écrit
      //  sur les champs de profil, relevé le 10 novembre. Si la règle
      //  ne le bat pas, elle ne bat rien.
      menu("year", ANNEES).replace("<select", '<select style="width:250px"'),
    ].join(avecDesSauts ? "<br />" : "")
  }</dd></dl>`;

/** Une ligne ordinaire : un champ de texte, un menu seul. */
const ligneSimple = (id, champ) =>
  `<dl id="${id}"><dt><label>Rythme de rp :</label></dt><dd>${champ}</dd></dl>`;

/** La ligne de `/search` qui porte PLUSIEURS `<dd>` : un champ, puis un
 *  `<dd>` par bouton radio. Elle n'est pas une ligne de menus, et elle
 *  ne doit pas le devenir. */
const ligneRadios = `<dl id="radios"><dt><label>Rechercher :</label></dt>
<dd><input type="text" class="inputbox" name="q" /></dd>
<dd><label><input type="radio" name="o" checked /> Tous les mots</label></dd>
<dd><label><input type="radio" name="o" /> N'importe quel mot</label></dd></dl>`;

const page = `<!doctype html><html lang="fr"><head><meta charset="utf-8">
<style>html,body{margin:0;min-height:100%}</style>
<style>${lire("panneau-admin/jetons.css")}</style>
<style>${lire("css/wild-mystery.css")}</style>
<style>${lire("data/fam-base.css")}</style>
</head><body id="modernbb">
<div class="conteneur_minwidth_IE modern-resp"><div id="wrap"><div id="main-content">
<form action="/profile" method="post" id="ucp">
  <div id="cp-main" class="ucp-main">
    <h1 class="page-title">Profil</h1>
    <div class="panel row3"><div class="inner">
      <span class="corners-top"><span></span></span>
      <fieldset>
        ${ligneSimple("texte", '<input type="text" class="inputbox" style="width:250px" />')}
        <div class="separator">&nbsp;</div>
        ${ligneSimple("menu-seul", menu("genre", ["Féminin", "Masculin", "Autre"]))}
        <div class="separator">&nbsp;</div>
        ${ligneDeDate("date-suite", false)}
        <div class="separator">&nbsp;</div>
        ${ligneDeDate("date-sauts", true)}
      </fieldset>
      <span class="corners-bottom"><span></span></span>
    </div></div>
  </div>
</form>
<form action="/search" method="post" name="searchform">
  <div class="panel row2"><div class="inner">
    <span class="corners-top"><span></span></span>
    <fieldset>${ligneRadios}</fieldset>
    <span class="corners-bottom"><span></span></span>
  </div></div>
</form>
</div></div></div></body></html>`;

const nav = await chromium.launch(CHROME === undefined ? {} : { executablePath: CHROME });
const p = await nav.newPage({ viewport: { width: 1440, height: 1000 } });
p.on("pageerror", (e) => soucis.push("erreur JS : " + e.message));
await p.setContent(page);
await p.waitForTimeout(150);

const mesure = (id) =>
  p.evaluate((cle) => {
    const dl = document.getElementById(cle);
    const dd = dl.querySelector("dd");
    const menus = [...dd.querySelectorAll("select")].map((s) => {
      const r = s.getBoundingClientRect();
      return {
        x: Math.round(r.left),
        y: Math.round(r.top),
        l: Math.round(r.width),
        h: Math.round(r.height),
        d: Math.round(r.right),
      };
    });
    const r = dd.getBoundingClientRect();
    return {
      menus,
      dd: { x: Math.round(r.left), l: Math.round(r.width), d: Math.round(r.right) },
    };
  }, id);

console.log("\n── LA DATE DE NAISSANCE ───────────────────────────────");
for (const [quoi, id] of [["menus à la suite", "date-suite"], ["menus avec des <br>", "date-sauts"]]) {
  const m = await mesure(id);
  dire(
    `${quoi} : LES TROIS SONT SUR UNE SEULE LIGNE`,
    m.menus.length === 3 && new Set(m.menus.map((x) => x.y)).size === 1,
    JSON.stringify(m.menus.map((x) => x.y)),
  );
  dire(
    `${quoi} : ET PAS AUSSI LONGS — chacun sous la moitié de la colonne`,
    m.menus.every((x) => x.l <= m.dd.l / 2),
    `${JSON.stringify(m.menus.map((x) => x.l))} dans ${m.dd.l}`,
  );
  dire(
    `${quoi} : le style en ligne de 250 px est battu`,
    m.menus.every((x) => x.l !== 250),
    JSON.stringify(m.menus.map((x) => x.l)),
  );
  dire(
    `${quoi} : rien ne déborde de la colonne, et rien ne se chevauche`,
    m.menus.every((x) => x.x >= m.dd.x - 1 && x.d <= m.dd.d + 1) &&
      m.menus.every((x, i) => i === 0 || x.x >= m.menus[i - 1].d),
    JSON.stringify({ dd: [m.dd.x, m.dd.d], menus: m.menus.map((x) => [x.x, x.d]) }),
  );
  dire(
    `${quoi} : ils restent cliquables — au moins 30 px de haut`,
    m.menus.every((x) => x.h >= 30),
    JSON.stringify(m.menus.map((x) => x.h)),
  );
}

console.log("\n── ET CE QUI NE DOIT PAS BOUGER ───────────────────────");
const seul = await mesure("menu-seul");
dire(
  "UN MENU SEUL GARDE TOUTE LA COLONNE — la règle ne déborde pas sur lui",
  seul.menus.length === 1 && seul.menus[0].l >= seul.dd.l - 2,
  `${seul.menus[0]?.l} dans ${seul.dd.l}`,
);

const radios = await p.evaluate(() => {
  const dl = document.getElementById("radios");
  return {
    affichage: getComputedStyle(dl.querySelector("dd")).display,
    dd: dl.querySelectorAll("dd").length,
  };
});
dire(
  "une ligne à plusieurs `dd` n'est pas une ligne de menus",
  radios.dd === 3 && radios.affichage !== "flex",
  JSON.stringify(radios),
);

const texte = await p.evaluate(() => {
  const dd = document.querySelector("#texte dd");
  const champ = dd.querySelector("input");
  return {
    champ: Math.round(champ.getBoundingClientRect().width),
    colonne: Math.round(dd.getBoundingClientRect().width),
  };
});
dire(
  "un champ de texte garde la colonne entière, malgré son style en ligne",
  texte.champ >= texte.colonne - 2 && texte.champ !== 250,
  JSON.stringify(texte),
);

//  ── EN THÈME SOMBRE, et à 390 de large ────────────────────────────
await p.evaluate(() => document.body.classList.add("wm-sombre"));
await p.waitForTimeout(120);
const sombre = await mesure("date-suite");
dire(
  "en thème sombre, la ligne tient toujours",
  new Set(sombre.menus.map((x) => x.y)).size === 1,
  JSON.stringify(sombre.menus.map((x) => x.y)),
);

await p.setViewportSize({ width: 390, height: 1000 });
await p.waitForTimeout(150);
const etroit = await mesure("date-suite");
dire(
  "À 390, ILS S'EMPILENT OU SE SERRENT, mais ne débordent pas",
  etroit.menus.every((x) => x.x >= etroit.dd.x - 1 && x.d <= etroit.dd.d + 1),
  JSON.stringify({ dd: [etroit.dd.x, etroit.dd.d], menus: etroit.menus.map((x) => [x.x, x.d]) }),
);

if (Deno.args.includes("--photo")) {
  await p.setViewportSize({ width: 1000, height: 700 });
  await p.evaluate(() => document.body.classList.remove("wm-sombre"));
  await p.waitForTimeout(200);
  await p.locator("#ucp .panel").screenshot({ path: Deno.args[Deno.args.indexOf("--photo") + 1] });
}

await p.close();
await nav.close();
console.log(soucis.length === 0 ? "\nTOUT PASSE." : `\n${soucis.length} DÉFAUT(S).`);
for (const s of soucis) console.log("  · " + s);
Deno.exit(soucis.length === 0 ? 0 : 1);
