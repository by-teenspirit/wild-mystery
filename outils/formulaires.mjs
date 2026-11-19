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


/*  ── LA PAGE DES NOTIFICATIONS, RELEVÉE LE 19 NOVEMBRE ────────────

    `/profile?mode=editprofile&page_profil=notifications`, lue dans le
    navigateur de Callista, sa session ouverte. On ne monte QUE ce
    qu'on a vu — « monter ce qu'on n'a pas vu donne un harnais vert
    sur une page qui n'existe pas », et cette page-là est exactement
    celle qui l'a appris à ce fichier.

    Ce que le relevé dit, et qui ne se devine pas :

      · une `<table id="checkboxes" class="table1">`, trois colonnes
        — le libellé, « Par email », « Par Push et Toolbar » ;
      · quinze lignes, `row1`/`row2` posées sur les CELLULES et pas
        sur la ligne ;
      · deux cases par ligne, `mail_type[]` et `notif_type[]`,
        chacune avec un `id` mais SANS `<label>` associé ;
      · un seul bouton, `input[type=submit].button1`.

    Les quinze libellés sont recopiés mot pour mot : trois d'entre
    eux sont assez longs pour passer à la ligne, et c'est le cas qui
    fait grandir une rangée. */
const NOTIFICATIONS = [
  "Les demandes d'amitié",
  "La réception d'un message privé",
  "La réception d'un message sur le profil",
  "Un nouveau message dans un sujet suivi",
  "Un nouveau sujet dans un forum suivi",
  "Un nouveau sujet par un membre suivi",
  "Un nouveau message par un membre suivi",
  "Une demande d'adhésion à un groupe",
  "Un abus signalé",
  "Un nouveau rapport",
  "La connexion d'un ami au forum",
  "L'obtention d'une nouvelle récompense",
  "Un nouvel achat participatif d'un membre (don de crédits)",
  "Le tag de son nom d'utilisateur dans un message",
  "Une mention \"J'aime\" sur l'un de vos messages",
];

const tableDesNotifications = `<table id="checkboxes" class="table1">
<thead><tr><th>Types de notifications</th><th>Par email</th><th>Par Push et Toolbar</th></tr></thead>
<tbody>${
  NOTIFICATIONS.map((libelle, i) => {
    const r = i % 2 === 0 ? "row1" : "row2";
    //  UNE LIGNE SUR TROIS EST COCHÉE : une page où rien n'est coché
    //  ne montrerait jamais le dessin de l'état coché.
    const coche = i % 3 === 0 ? " checked" : "";
    return `<tr><td class="${r}">${libelle}</td>` +
      `<td class="${r}"><input type="checkbox" id="mail_${i}" name="mail_type[]"${coche}></td>` +
      `<td class="${r}"><input type="checkbox" id="notif_${i}" name="notif_type[]"></td></tr>`;
  }).join("")
}</tbody></table>`;

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
<form action="/profile" method="post" id="ucp-notif">
  <div id="cp-main-notif" class="ucp-main">
    <h1 class="page-title">Options</h1>
    <div class="panel"><div class="inner">
      <span class="corners-top"><span></span></span>
      <fieldset>${tableDesNotifications}</fieldset>
      <fieldset class="submit-buttons"><input type="submit" class="button1" name="submit" value="Enregistrer" /></fieldset>
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
//  L'ÉTIQUETTE EST AU-DESSUS DE SON CHAMP, et c'est tout l'intérêt de
//  la grille : « Mois » était aussi près de la flèche du menu des
//  jours que de son propre menu. On mesure donc l'APPARIEMENT, pas
//  l'écart — un écart plus grand n'aurait rien apparié.
//
//  LES ÉTIQUETTES SONT DES NŒUDS DE TEXTE NUS : aucun sélecteur ne les
//  atteint, on les mesure avec un `Range`.
const etiquettes = await p.evaluate(() => {
  const dd = document.querySelector("#date dd");
  const champs = [...dd.querySelectorAll("select, input[type=text]")];
  const mots = [...dd.childNodes].filter((n) =>
    n.nodeType === 3 && n.textContent.trim() !== ""
  );
  return champs.map((c, i) => {
    const m = mots[i];
    if (m === undefined) return null;
    const r = document.createRange();
    r.selectNodeContents(m);
    const a = r.getBoundingClientRect();
    const b = c.getBoundingClientRect();
    return {
      mot: m.textContent.trim(),
      dessus: Math.round(a.bottom) <= Math.round(b.top) + 1,
      aligne: Math.abs(Math.round(a.left) - Math.round(b.left)) <= 2,
      ecart: Math.round(b.top - a.bottom),
    };
  });
});
dire(
  "CHAQUE ÉTIQUETTE EST AU-DESSUS DE SON CHAMP, et alignée dessus",
  etiquettes.length === 3 && etiquettes.every((e) => e !== null && e.dessus && e.aligne),
  JSON.stringify(etiquettes),
);
dire(
  "et elle n'est pas collée dessus",
  etiquettes.every((e) => e !== null && e.ecart >= 2 && e.ecart <= 12),
  JSON.stringify(etiquettes.map((e) => e?.ecart)),
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


// ── LA PAGE DES NOTIFICATIONS ───────────────────────────────────────
//
//  Les cinq défauts relevés sur la page servie, et ce qu'on en fait.
//  Chacun est une mesure, pas une impression.
console.log("\n── LES NOTIFICATIONS ──────────────────────────────────");
//  ── ON REMET LA FENÊTRE ET LE THÈME AVANT DE MESURER ────────────
//
//  Les blocs précédents laissent la page à 390 px de large et en
//  thème sombre. Sans ces deux lignes, ce qui suit mesure CE DÉCOR-LÀ
//  en croyant mesurer la page : la colonne des libellés tombait à
//  114 px, et l'écart libellé-case passait le seuil pour la pire des
//  raisons — parce qu'il n'y avait plus de place pour rien.
//
//  Une mesure qui mesure son environnement ne prouve rien.
await p.setViewportSize({ width: 1440, height: 1000 });
await p.evaluate(() => document.body.classList.remove("wm-sombre"));
await p.waitForTimeout(80);
const notif = await p.evaluate(() => {
  const t = document.getElementById("checkboxes");
  const lignes = [...t.querySelectorAll("tbody tr")];
  const premiere = lignes[0];
  const libelle = premiere.cells[0].getBoundingClientRect();
  const caseMail = premiere.cells[1].querySelector("input");
  const r = caseMail.getBoundingClientRect();
  const coche = document.getElementById("mail_0");
  const vide = document.getElementById("notif_0");
  const th = t.querySelector("thead th:nth-child(2)");
  return {
    //  1 · LA DISTANCE ENTRE LE LIBELLÉ ET LA CASE QU'IL DÉCIDE.
    //  924 px sur la page servie ; on exige largement moins.
    ecart: Math.round(r.left - libelle.left),
    //  2 · LA CIBLE. 13 × 13 au départ ; le reste du forum vise 44.
    cible: [Math.round(r.width), Math.round(r.height)],
    //  3 · LE ZÉBRAGE, QUI VIT SUR LES CELLULES.
    zebre: [
      getComputedStyle(lignes[0].cells[0]).backgroundColor,
      getComputedStyle(lignes[1].cells[0]).backgroundColor,
    ],
    //  4 · LA HAUTEUR D'UNE RANGÉE.
    rangee: Math.round(premiere.cells[0].getBoundingClientRect().height),
    //  5 · L'EN-TÊTE QUI RESTE EN PLACE.
    enTeteCollant: getComputedStyle(th).position,
    //  LE DESSIN SUIT L'ÉTAT, et il suit un JETON : une case cochée
    //  et une case vide ne peuvent pas avoir la même couleur.
    cocheePeinte: getComputedStyle(coche).backgroundColor,
    videPeinte: getComputedStyle(vide).backgroundColor,
    masqueDifferent:
      getComputedStyle(coche).webkitMaskImage !== getComputedStyle(vide).webkitMaskImage,
    //  ET LA GRILLE : trois colonnes, et les quinze lignes dedans.
    colonnes: getComputedStyle(t).gridTemplateColumns.split(" ").length,
    lignes: lignes.length,
    //  RIEN NE DÉBORDE : la table était à 100 % et le reste tient.
    deborde: document.documentElement.scrollWidth > window.innerWidth,
  };
});

dire(
  "LA CASE EST PRÈS DE CE QU'ELLE DÉCIDE — 924 px sur la page servie",
  notif.ecart < 440,
  `${notif.ecart} px entre le libellé et la case`,
);
dire(
  "LA CIBLE FAIT 44 PX DE HAUT — 13 × 13 au départ",
  notif.cible[1] >= 44 && notif.cible[0] >= 44,
  `${notif.cible[0]} × ${notif.cible[1]}`,
);
dire(
  "UNE RANGÉE SUR DEUX EST PEINTE — row1/row2 étaient transparentes",
  notif.zebre[0] !== notif.zebre[1],
  JSON.stringify(notif.zebre),
);
dire(
  "et une rangée respire — 27 px au départ",
  notif.rangee >= 44,
  `${notif.rangee} px`,
);
dire(
  "L'EN-TÊTE RESTE VISIBLE PENDANT QU'ON DESCEND",
  notif.enTeteCollant === "sticky",
  notif.enTeteCollant,
);
dire(
  "LE DESSIN DIT L'ÉTAT, ET IL SUIT LES JETONS",
  notif.cocheePeinte !== notif.videPeinte && notif.masqueDifferent,
  JSON.stringify({ cochee: notif.cocheePeinte, vide: notif.videPeinte }),
);
if (Deno.args.includes("--photo")) {
  const bloc = await p.$("#cp-main-notif");
  if (bloc !== null) await bloc.screenshot({ path: "/tmp/notif.png" });
  console.log("photo : /tmp/notif.png");
}
//  ── ET EN THÈME SOMBRE ──────────────────────────────────────────
//
//  La case vide est dessinée par un masque et peinte par un jeton :
//  si le jeton sombre tombe près du fond de la rangée, la case
//  disparaît. C'est exactement ce qui était arrivé au panneau des
//  notifications le 13 novembre — du noir pur sur du `#1C1C1C`.
const sombreNotif = await p.evaluate(() => {
  document.body.classList.add("wm-sombre");
  const vide = document.getElementById("notif_0");
  const lum = (c) => {
    const [r, v, b] = c.match(/[\d.]+/g).slice(0, 3).map(Number);
    const f = (x) => {
      const y = x / 255;
      return y <= 0.03928 ? y / 12.92 : Math.pow((y + 0.055) / 1.055, 2.4);
    };
    return 0.2126 * f(r) + 0.7152 * f(v) + 0.0722 * f(b);
  };
  const a = lum(getComputedStyle(vide).backgroundColor);
  const b = lum(getComputedStyle(vide.closest("td")).backgroundColor === "rgba(0, 0, 0, 0)"
    ? getComputedStyle(document.querySelector(".ucp-main .panel .inner")).backgroundColor
    : getComputedStyle(vide.closest("td")).backgroundColor);
  const [haut, bas] = a > b ? [a, b] : [b, a];
  document.body.classList.remove("wm-sombre");
  return Math.round(((haut + 0.05) / (bas + 0.05)) * 100) / 100;
});
//  3:1 — le seuil AA des éléments d'interface non textuels. Le
//  contour d'une case à cocher en est un.
dire(
  "EN THÈME SOMBRE, LA CASE VIDE SE VOIT ENCORE",
  sombreNotif >= 3,
  `${sombreNotif}:1`,
);

dire(
  "TROIS COLONNES, QUINZE LIGNES, ET RIEN NE DÉBORDE",
  notif.colonnes === 3 && notif.lignes === 15 && !notif.deborde,
  JSON.stringify({ colonnes: notif.colonnes, lignes: notif.lignes, deborde: notif.deborde }),
);

await p.close();
await nav.close();
console.log(soucis.length === 0 ? "\nTOUT PASSE." : `\n${soucis.length} DÉFAUT(S).`);
for (const s of soucis) console.log("  · " + s);
Deno.exit(soucis.length === 0 ? 0 : 1);
