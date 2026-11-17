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
//  ── LE BALISAGE EST UN RELEVÉ, PLUS UNE SUPPOSITION ───────────────
//
//  L'édition du profil demande une connexion et on ne s'y connecte pas
//  d'ici. J'avais donc monté DEUX formes imaginées de la ligne de
//  date — menus à la suite, menus séparés par des `<br>` — et écrit
//  la règle dessus. Callista a collé le vrai balisage : ce n'était ni
//  l'une ni l'autre.
//
//      Jour&nbsp;<select …>  Mois&nbsp;<select …>
//      Année&nbsp;<input type="text" style="width:50px" size="5">
//
//  L'ANNÉE EST UN CHAMP DE TEXTE. Une règle qui ne range que les
//  `select` laissait ce champ à `width: 100%` : une barre pleine
//  largeur au milieu de la ligne, pire que le défaut de départ. Et
//  les trois champs portent une étiquette en texte nu avant eux.
//
//  Les deux formes imaginées sont sorties d'ici. Monter ce qu'on
//  n'a pas vu donne un harnais vert sur une page qui n'existe pas.
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

/** La ligne de date, RECOPIÉE du relevé du 17 novembre — étiquettes en
 *  texte nu comprises, `style="width:50px"` compris, et le
 *  `<span class="italic">` vide que Forumactif laisse à la fin. */
const ligneDeDate = (id) =>
  `<dl id="${id}"><dt>Date de naissance : </dt><dd>Jour&nbsp;${
    menu("profile_field_4_-12[]", JOURS)
  } Mois&nbsp;${menu("profile_field_4_-12[]", MOIS)} Année&nbsp;` +
  `<input type="text" class="inputbox" name="profile_field_4_-12[]" ` +
  `style="width:50px" size="5" maxlength="4" value="0">` +
  `<br><span class="italic"></span></dd></dl>`;

/** La ligne « Exporter vos données » du gabarit amont : le bouton est
 *  un `<a class="button1">`, pas un `<input>`. C'est toute la
 *  différence — un `<a>` est `display: inline`, et un rembourrage
 *  vertical sur une boîte en ligne ne pousse rien : il déborde. */
const ligneExport = `<dl id="export"><dt><label>Exporter vos données :</label></dt><dd>` +
  `<a href="#" class="button1">Générer le fichier</a><br /><br />` +
  `Un fichier vous sera envoyé par e-mail.</dd></dl>`;

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

/** La feuille de personnage, dans ses DEUX pages et leurs DEUX états.
 *
 *  Relevé le 17 novembre dans le navigateur de Callista, sa session
 *  ouverte :
 *
 *    · `/u<n>rpgsheet?mode=generate` — `.column1` / `.column2`
 *      flottantes dans un `.panel` qui ne les contenait pas : 18 px de
 *      haut pour 269 de contenu, donc ni fond ni bord. « On dirait que
 *      y'a pas de css » ;
 *    · `/rpg_sheet_edit` — `.panel-left` / `.panel-right`, la gauche
 *      VIDE et la droite portant les sept champs. « Les infos sont à
 *      droite mais ça fait pas vraiment deux colonnes. »
 *
 *  LES DEUX ÉTATS SONT MONTÉS : colonne de gauche vide (le cas de
 *  Callista, où tous les champs sont rangés à droite dans le panneau
 *  d'administration) et colonne de gauche remplie. Une règle qui range
 *  bien le premier et empile le second ne serait pas un correctif. */
const champRpg = (nom, valeur) =>
  `<dl><dt><label><span class="gen">${nom}</span></label></dt><dd>${valeur}</dd></dl>`;

const feuilleGeneree = (id, aGauche) =>
  `<div class="panel" id="${id}"><div class="inner">
<span class="corners-top"><span></span></span>
<div class="column1"><p style="text-align: center;"><ed>en découverte</ed><br></p>
<fieldset>${aGauche ? champRpg("Taille", "1,70 m") : ""}</fieldset></div>
<div class="column2"><fieldset>${
    [["Âge", "22 ans"], ["Alignement", "neutre"], ["Origines", "Rhode"]]
      .map(([n, v]) => champRpg(n, v)).join("")
  }</fieldset></div>
<span class="corners-bottom"><span></span></span></div></div>`;

const feuilleEditee = (id, aGauche) =>
  `<div id="${id}">
<div class="panel"><div class="inner"><p style="text-align: center;"><ed>en découverte</ed><br></p></div></div>
<div class="panel panel-left"><div class="inner"><fieldset>${
    aGauche ? champRpg("Taille", '<input type="text" class="inputbox" name="field_9">') : ""
  }</fieldset></div></div>
<div class="panel panel-right"><div class="inner">${
    [["Âge", "field_1"], ["Alignement", "field_2"], ["Origines", "field_3"]]
      .map(([n, f]) =>
        `<fieldset>${
          champRpg(n, `<input type="text" class="inputbox" name="${f}">`)
        }</fieldset>`
      ).join("")
  }</div></div>
</div>`;

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
        ${ligneDeDate("date")}
        <div class="separator">&nbsp;</div>
        ${ligneExport}
      </fieldset>
      <fieldset class="submit-buttons">
        <input type="submit" class="button1" value="Enregistrer" />
        <input type="reset" class="button2" value="Annuler" />
      </fieldset>
      <span class="corners-bottom"><span></span></span>
    </div></div>
  </div>
</form>
<div id="cp-main-2" class="ucp-main">
  ${feuilleGeneree("gen-vide", false)}
  ${feuilleGeneree("gen-pleine", true)}
  ${feuilleEditee("edit-vide", false)}
  ${feuilleEditee("edit-pleine", true)}
</div>
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
const m = await p.evaluate(() => {
  const dd = document.querySelector("#date dd");
  const champs = [...dd.querySelectorAll("select, input[type=text]")].map((e) => {
    const r = e.getBoundingClientRect();
    return {
      quoi: e.tagName.toLowerCase(),
      x: Math.round(r.left),
      y: Math.round(r.top),
      l: Math.round(r.width),
      h: Math.round(r.height),
      d: Math.round(r.right),
    };
  });
  const r = dd.getBoundingClientRect();
  return {
    champs,
    dd: { x: Math.round(r.left), l: Math.round(r.width), d: Math.round(r.right) },
    //  « Jour », « Mois », « Année » sont des nœuds de texte nus. En
    //  flex ils deviennent des éléments à part entière ; s'ils
    //  disparaissaient, la ligne ne dirait plus quel menu est lequel.
    etiquettes: dd.textContent.replace(/\s+/g, " ").trim(),
  };
});
dire(
  "LES TROIS CHAMPS SONT SUR UNE SEULE LIGNE",
  m.champs.length === 3 && new Set(m.champs.map((x) => x.y)).size === 1,
  JSON.stringify(m.champs.map((x) => [x.quoi, x.y])),
);
dire(
  "ET PAS AUSSI LONGS — chacun sous la moitié de la colonne",
  m.champs.every((x) => x.l <= m.dd.l / 2),
  `${JSON.stringify(m.champs.map((x) => x.l))} dans ${m.dd.l}`,
);
dire(
  "L'ANNÉE EST UN CHAMP DE TEXTE, et elle ne prend pas toute la ligne",
  m.champs[2]?.quoi === "input" && m.champs[2].l < m.dd.l / 2,
  `${m.champs[2]?.quoi} de ${m.champs[2]?.l} px dans ${m.dd.l}`,
);
dire(
  "les étiquettes « Jour », « Mois » et « Année » sont toujours là",
  /Jour/.test(m.etiquettes) && /Mois/.test(m.etiquettes) && /Ann\u00e9e/.test(m.etiquettes),
  m.etiquettes,
);
dire(
  "rien ne déborde de la colonne, et rien ne se chevauche",
  m.champs.every((x) => x.x >= m.dd.x - 1 && x.d <= m.dd.d + 1) &&
    m.champs.every((x, i) => i === 0 || x.x >= m.champs[i - 1].d),
  JSON.stringify({ dd: [m.dd.x, m.dd.d], champs: m.champs.map((x) => [x.x, x.d]) }),
);
dire(
  "ils restent cliquables — au moins 30 px de haut",
  m.champs.every((x) => x.h >= 30),
  JSON.stringify(m.champs.map((x) => x.h)),
);

// ── LE BOUTON « EXPORTER VOS DONNÉES » ─────────────────────────────
//
//  « Y'a un gros padding en dessous, dans le bouton », 17 novembre.
//
//  LA CAUSE EST LE TYPE DE LA BALISE. Partout ailleurs `.button1` est
//  un `<input>`, qui est `inline-block` de naissance. Ici le gabarit
//  amont écrit un `<a class="button1">` — une boîte EN LIGNE. Un
//  rembourrage vertical sur une boîte en ligne ne pousse rien : il
//  déborde, et il déborde d'autant plus vers le bas que la ligne du
//  `<dd>` est haute et le texte du bouton petit. D'où un fond qui
//  descend bien plus bas que le texte.
//
//  CE QUI SE MESURE : l'écart au-dessus du texte et l'écart en
//  dessous, dans la boîte du bouton. Ils doivent être les mêmes.
console.log("\n── LE BOUTON « EXPORTER VOS DONNÉES » ─────────────────");
const bouton = await p.evaluate(() => {
  const a = document.querySelector("#export .button1");
  const b = a.getBoundingClientRect();
  const r = document.createRange();
  r.selectNodeContents(a);
  const t = r.getBoundingClientRect();
  return {
    affichage: getComputedStyle(a).display,
    hauteur: Math.round(b.height),
    dessus: Math.round(t.top - b.top),
    dessous: Math.round(b.bottom - t.bottom),
    soulignement: getComputedStyle(a).textDecorationLine,
    envoi: Math.round(
      document.querySelector(".submit-buttons .button1").getBoundingClientRect().height,
    ),
  };
});
dire(
  "LE BOUTON N'EST PAS UNE BOÎTE EN LIGNE — sinon son rembourrage déborde",
  bouton.affichage !== "inline",
  bouton.affichage,
);
//  44, ET PAS 62. La cible tactile est une hauteur TOTALE : 44 de
//  contenu plus 16 de rembourrage plus 2 de bord, c'était 62 — dont 39
//  sous le texte. Le texte est centré dedans, à la rondeur des
//  métriques de la fonte près.
dire(
  "IL FAIT LA CIBLE TACTILE, ET PAS LA CIBLE TACTILE PLUS LE REMBOURRAGE",
  bouton.hauteur >= 44 && bouton.hauteur <= 46 &&
    Math.abs(bouton.dessus - bouton.dessous) <= 3,
  `${bouton.hauteur} px de haut · ${bouton.dessus} au-dessus du texte, ${bouton.dessous} en dessous`,
);
dire(
  "et il reste un bouton, pas un lien souligné",
  bouton.soulignement === "none",
  bouton.soulignement,
);
//  LE MÊME DÉFAUT VIVAIT SUR LES VRAIS BOUTONS, et personne ne l'avait
//  vu : `min-height: 44px` en `content-box`, c'est 62 px de bouton.
//  La cible tactile est une hauteur TOTALE.
dire(
  "ET LES BOUTONS D'ENVOI FONT BIEN 44, pas 44 plus le rembourrage",
  bouton.envoi >= 44 && bouton.envoi <= 46,
  `${bouton.envoi} px`,
);

// ── LA FEUILLE DE PERSONNAGE ───────────────────────────────────────
console.log("\n── LA FEUILLE DE PERSONNAGE ───────────────────────────");
const feuille = await p.evaluate(() => {
  const r = (e) => {
    if (e === null) return null;
    const b = e.getBoundingClientRect();
    const c = getComputedStyle(e);
    return {
      x: Math.round(b.left),
      y: Math.round(b.top),
      l: Math.round(b.width),
      h: Math.round(b.height),
      disp: c.display,
      flt: c.cssFloat,
    };
  };
  const lu = (id) => {
    const n = document.getElementById(id);
    const c1 = n.querySelector(".column1") ?? n.querySelector(".panel-left");
    const c2 = n.querySelector(".column2") ?? n.querySelector(".panel-right");
    const panneau = n.classList.contains("panel") ? n : null;
    return {
      g: r(c1),
      d: r(c2),
      panneau: r(panneau),
      //  LE PANNEAU CONTIENT-IL SES COLONNES ? c'était la question :
      //  un flottant sort de son parent et le vide.
      contient: panneau === null || c2 === null
        ? null
        : Math.round(panneau.getBoundingClientRect().bottom) >=
          Math.round(c2.getBoundingClientRect().bottom) - 1,
      rang: r(n.querySelector("p ed")),
      alignementDuRang: n.querySelector("p:has(> ed)") === null
        ? null
        : getComputedStyle(n.querySelector("p:has(> ed)")).textAlign,
    };
  };
  return {
    genVide: lu("gen-vide"),
    genPleine: lu("gen-pleine"),
    editVide: lu("edit-vide"),
    editPleine: lu("edit-pleine"),
  };
});

dire(
  "AUCUNE COLONNE NE FLOTTE PLUS — un flottant vide son parent",
  [feuille.genVide, feuille.genPleine, feuille.editVide, feuille.editPleine]
    .flatMap((f) => [f.g, f.d]).filter((c) => c !== null && c.disp !== "none")
    .every((c) => c.flt === "none"),
);
dire(
  "LE PANNEAU DE LA PAGE GÉNÉRÉE CONTIENT SES COLONNES",
  feuille.genVide.contient === true && feuille.genPleine.contient === true,
  JSON.stringify([feuille.genVide.panneau?.h, feuille.genPleine.panneau?.h]),
);
dire(
  "COLONNE DE GAUCHE VIDE : une seule colonne, pleine largeur",
  feuille.genVide.d.l > feuille.genVide.d.x - feuille.genVide.d.x + 600 &&
    feuille.genVide.d.y > feuille.genVide.g.y,
  JSON.stringify({ g: feuille.genVide.g, d: feuille.genVide.d }),
);
dire(
  "COLONNE DE GAUCHE REMPLIE : deux colonnes, côte à côte",
  feuille.genPleine.g.y === feuille.genPleine.d.y &&
    feuille.genPleine.d.x > feuille.genPleine.g.x,
  JSON.stringify({ g: feuille.genPleine.g, d: feuille.genPleine.d }),
);
dire(
  "PAGE D'ÉDITION, GAUCHE VIDE : elle disparaît et la droite prend tout",
  feuille.editVide.g.disp === "none" && feuille.editVide.d.l > 900,
  JSON.stringify({ g: feuille.editVide.g.disp, d: feuille.editVide.d.l }),
);
dire(
  "PAGE D'ÉDITION, GAUCHE REMPLIE : les deux panneaux côte à côte",
  feuille.editPleine.g.disp !== "none" && feuille.editPleine.g.y === feuille.editPleine.d.y &&
    feuille.editPleine.d.x > feuille.editPleine.g.x,
  JSON.stringify({ g: feuille.editPleine.g, d: feuille.editPleine.d }),
);
dire(
  "LE RANG N'EST PLUS CENTRÉ — un `style=` en ligne le centrait",
  [feuille.editVide, feuille.editPleine, feuille.genVide]
    .every((f) => f.alignementDuRang === "left"),
  JSON.stringify([
    feuille.genVide.alignementDuRang,
    feuille.editVide.alignementDuRang,
  ]),
);

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
const sombre = await mesure("date");
dire(
  "en thème sombre, la ligne tient toujours",
  new Set(sombre.menus.map((x) => x.y)).size === 1,
  JSON.stringify(sombre.menus.map((x) => x.y)),
);

await p.setViewportSize({ width: 390, height: 1000 });
await p.waitForTimeout(150);
const etroit = await mesure("date");
dire(
  "À 390, ILS S'EMPILENT OU SE SERRENT, mais ne débordent pas",
  etroit.menus.every((x) => x.x >= etroit.dd.x - 1 && x.d <= etroit.dd.d + 1),
  JSON.stringify({
    dd: [etroit.dd.x, etroit.dd.d],
    menus: etroit.menus.map((x) => [x.x, x.d]),
  }),
);

if (Deno.args.includes("--photo")) {
  await p.setViewportSize({ width: 1000, height: 700 });
  await p.evaluate(() => document.body.classList.remove("wm-sombre"));
  await p.waitForTimeout(200);
  await p.locator("#ucp .panel").screenshot({
    path: Deno.args[Deno.args.indexOf("--photo") + 1],
  });
}

await p.close();
await nav.close();
console.log(soucis.length === 0 ? "\nTOUT PASSE." : `\n${soucis.length} DÉFAUT(S).`);
for (const s of soucis) console.log("  · " + s);
Deno.exit(soucis.length === 0 ? 0 : 1);
