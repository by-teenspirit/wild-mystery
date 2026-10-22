// ════════════════════════════════════════════════════════════════════
//  outils/messenger.mjs
//
//  POURQUOI CE HARNAIS EXISTE. La feuille 15 habille un greffon qu'on
//  n'a pas sous la main : FAM ne se charge que pour un membre, et aucun
//  des six harnais ne le monte. Tout ce qu'elle fait était donc écrit
//  en regardant le forum à l'œil, puis vérifié en le regardant encore.
//
//  LA LEÇON QUI A COÛTÉ UNE SEMAINE. La bande des catégories dessinait
//  une photo de 1 280 en 33 × 33, et aucun test ne le voyait : le
//  coupable était `dl.icon { background-size: 33px 33px !important }`
//  dans le `11-ltr.css` de ModernBB, et les harnais ne servaient que
//  NOTRE feuille. Un test qui ignore ce contre quoi on se bat valide
//  une feuille qui perd en vrai.
//
//  FAM est le même piège en pire : il n'a pas de feuille, il INJECTE un
//  `<style>` au démarrage, donc il arrive APRÈS nous dans la cascade et
//  gagne à spécificité égale. Ce harnais sert donc `data/fam-base.css`
//  — ses déclarations relevées verbatim — APRÈS la nôtre, dans l'ordre
//  réel, et il mesure ce qui sort.
//
//  Le balisage d'un message est celui que Callista a relevé sur son
//  forum le 11 octobre, collé tel quel.
//
//  Lancé par `deno task messenger`.
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

//  LE MESSAGE, RELEVÉ SUR LE FORUM. Arceus (u1) dans le salon, avec son
//  avatar animé, son groupe coloré par Forumactif, et les trois boutons
//  d'action. On ne l'invente pas : un balisage inventé teste une feuille
//  contre une idée du balisage.
const MESSAGE = `
<div class="FAM-msg FAM-msg-online post--15552">
  <div class="FAM-msg-avatar"><a href="/u1"><img src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7" alt="avatar"></a></div>
  <div class="FAM-msg-box">
    <div class="FAM-msg-name"><span class="FAM-name-mention"><a href="/u1"><span class="group-2 usr_grp_clr" style="color:#808080"><strong><strong>Arceus</strong></strong></span></a></span></div>
    <div class="FAM-msg-content">
      <div class="FAM-msg-text">test</div>
      <div class="FAM-msg-actions">
        <span class="FAM-msg-button" title="Citer"><i class="fa fa-quote-left">“</i></span>
        <span class="FAM-msg-button" title="Modifier"><i class="fa fa-pencil">✎</i></span>
        <span class="FAM-msg-button" title="Supprimer"><i class="fa fa-times">✕</i></span>
      </div>
    </div>
    <div class="FAM-msg-date">Jeu 8 Oct 2026 - 15:20</div>
  </div>
</div>`;

//  LE TIROIR, dans l'ordre où FAM l'écrit : barre, bande d'onglets,
//  contenu, barre du bas.
const TIROIR = `
<div id="FAM" data-hidden="false">
  <div id="FAM-toolbar">
    <div id="FAM-toolbar-inner">
      <span id="FAM-back" class="FAM-toolbar-button" title="Retour"><i class="fa fa-arrow-left">←</i></span>
      <h1 class="FAM-maintitle">Salon de Rhode</h1>
      <span id="FAM-menu-toggle" class="FAM-toolbar-button" title="Menu"><i class="fa fa-ellipsis-v">⋮</i></span>
      <div id="FAM-menu" style="visibility:hidden">
        <span class="FAM-menu-option"><i class="fa fa-home">⌂</i></span>
        <span class="FAM-menu-option"><i class="fa fa-search">⌕</i></span>
      </div>
    </div>
  </div>
  <div id="FAM-tab-container">
    <div id="FAM-tabs">
      <div class="FAM-tab FAM-tab-active"><span class="FAM-tab-name">Salon</span></div>
      <div class="FAM-tab"><span class="FAM-tab-name">Hors-jeu</span></div>
    </div>
    <span id="FAM-tab-add"><i class="fa fa-plus">+</i></span>
  </div>
  <div id="FAM-content" class="FAM-viewing-topic">
    ${MESSAGE}
    ${MESSAGE.replace("FAM-msg FAM-msg-online", "FAM-msg FAM-my-msg")}
    <!-- LE SECOND « + », celui qui ouvre une conversation. FAM le pose
         dans le contenu, en position absolue en bas à droite. Il était
         absent de ce harnais, et le contrôle des deux « + » mesurait
         donc un élément inexistant : il passait pour « pas d'accent »
         alors qu'il n'y avait rien à colorer. Un test qui vise un nœud
         absent ne teste rien. (Pas d'accent grave dans ce commentaire :
         il est dans un gabarit de chaîne, qui s'y terminerait.) -->
    <span id="FAM-new-topic"><i class="fa fa-circle">●</i><i class="fa fa-plus">+</i></span>
  </div>
  <div id="FAM-actions">
    <div id="FAM-msg-container"><textarea id="FAM-msg" placeholder="Écrire…"></textarea></div>
    <button id="FAM-attachment" type="button"><i class="fa fa-paperclip">📎</i></button>
    <button id="FAM-emoji" type="button"><i class="fa fa-smile-o">☺</i></button>
    <button id="FAM-send" type="button"><i class="fa fa-paper-plane">➤</i></button>
  </div>
</div>`;

const page = `<!doctype html><html lang="fr"><head><meta charset="utf-8">
<style>html,body{margin:0;min-height:100%}</style>
<style>${readFileSync(R + "panneau-admin/jetons.css", "utf8")}</style>
<style>${readFileSync(R + "css/wild-mystery.css", "utf8")}</style>
<!-- ET LA FEUILLE DE FAM APRÈS LA NÔTRE : c'est l'ordre réel, puisqu'il
     l'injecte au démarrage. Servie avant, ce harnais ne prouverait
     rien. -->
<style>${readFileSync(R + "data/fam-base.css", "utf8")}</style>
</head>
<body id="modernbb">
<nav class="wm-nav" aria-label="Navigation principale">
  <button type="button" class="wm-nav__logo" aria-expanded="false"><span class="wm-nav__losange">◈</span></button>
  <div class="wm-nav__liens"><a class="wm-nav__lien" href="/">Accueil</a></div>
  <div class="wm-nav__droite"></div>
</nav>
<div id="page-body"><div class="forabg" style="height:2000px">des forums</div></div>
<a id="FAM-button" class="wm-messenger-bulle" title="Tchat" role="button" tabindex="0"><i class="fa fa-comment">●</i></a>
${TIROIR}
</body></html>`;

const nav = await chromium.launch(CHROME === undefined ? {} : { executablePath: CHROME });
const p = await nav.newPage({ viewport: { width: 1280, height: 900 } });
const soucis = [];
p.on("pageerror", (e) => soucis.push("erreur JS : " + e.message));
await p.route(
  "**/*",
  (r) => r.fulfill({ contentType: "text/html; charset=utf-8", body: page }),
);
await p.goto("https://exemple.test/");
await p.waitForTimeout(200);

function dire(nom, ok, detail = "") {
  console.log(`  ${ok ? "ok  " : "DÉFAUT"} ${nom}${detail === "" ? "" : " — " + detail}`);
  if (!ok) soucis.push(nom + (detail === "" ? "" : " — " + detail));
}

const lu = await p.evaluate(() => {
  const r = (s) => {
    const e = document.querySelector(s);
    if (e === null) return null;
    const b = e.getBoundingClientRect();
    return {
      x: Math.round(b.left),
      y: Math.round(b.top),
      d: Math.round(b.right),
      bas: Math.round(b.bottom),
      l: Math.round(b.width),
      h: Math.round(b.height),
    };
  };
  const c = (s, p) => {
    const e = document.querySelector(s);
    return e === null ? null : getComputedStyle(e)[p];
  };
  const tiroir = r("#FAM");
  const msg = document.querySelector(".FAM-msg");
  const av = r(".FAM-msg .FAM-msg-avatar");
  const bo = r(".FAM-msg .FAM-msg-box");
  return {
    tiroir,
    //  LA LARGEUR : on doit battre `width: 40%` et `min-width: 300px`.
    largeur: tiroir.l,
    //  LA HAUTEUR DU CONTENU : plus aucun `calc(100% - 69px)`. Le
    //  contenu doit remplir entre la bande d'onglets et la barre du bas,
    //  au pixel.
    contenu: r("#FAM-content"),
    barreHaut: r("#FAM-toolbar"),
    bandeOnglets: r("#FAM-tab-container"),
    barreBas: r("#FAM-actions"),
    //  L'ESPACE entre la barre du haut et la bande d'onglets.
    ecartBarreBande: r("#FAM-tab-container").y - r("#FAM-toolbar").bas,
    //  LE TITRE : centré dans la barre, horizontalement ET verticalement.
    titre: r(".FAM-maintitle"),
    //  L'ONGLET ACTIF contre le fond de la bande.
    fondBande: c("#FAM-tabs", "backgroundColor"),
    fondOngletActif: c(".FAM-tab.FAM-tab-active", "backgroundColor"),
    texteOngletActif: c(".FAM-tab.FAM-tab-active", "color"),
    accent: getComputedStyle(document.documentElement)
      .getPropertyValue("--wm-accent-primaire").trim(),
    plusOnglet: c("#FAM-tab-add", "color"),
    plusSujet: c("#FAM-new-topic .fa-circle", "color"),
    //  LE MESSAGE : ni contour ni rembourrage, et les deux blocs sur la
    //  même ligne.
    msgPadding: c(".FAM-msg", "padding"),
    msgBordure: c(".FAM-msg", "borderTopWidth") + " " + c(".FAM-msg", "borderBottomWidth"),
    msgAffichage: c(".FAM-msg", "display"),
    avatar: av,
    boite: bo,
    //  MÊME LIGNE : la boîte commence à droite de l'avatar, et leurs
    //  bandes verticales se croisent. Deux flottants qui se ratent
    //  donnent une boîte SOUS l'avatar — c'est le défaut signalé.
    memeLigne: bo.x >= av.d && bo.y < av.bas && av.y < bo.bas,
    //  La bulle ne doit pas déborder du tiroir.
    bulle: r(".FAM-msg .FAM-msg-content"),
    //  Mes messages se rangent à droite de leur colonne.
    maBulle: r(".FAM-my-msg .FAM-msg-content"),
    maBoite: r(".FAM-my-msg .FAM-msg-box"),
    //  LA BARRE DU BAS : du rembourrage, un écart, des boutons ronds.
    barrePadding: c("#FAM-actions", "padding"),
    barreEcart: c("#FAM-actions", "gap"),
    boutonRayon: c("#FAM-actions > button", "borderTopLeftRadius"),
    champ: r("#FAM-msg-container"),
    envoyer: r("#FAM-send"),
    //  LES ARRONDIS de la bulle.
    rayonBulle: c(".FAM-msg .FAM-msg-content", "borderTopLeftRadius"),
    rayonActions: c(".FAM-msg-actions", "borderTopLeftRadius"),
    msgOnline: msg.classList.contains("FAM-msg-online"),
  };
});

console.log("\n── LE CADRE ────────────────────────────────────────────");
dire("LE TIROIR FAIT 560 DE LARGE", lu.largeur === 560, `${lu.largeur} px`);
dire(
  "il est collé au bord gauche et descend jusqu'en bas",
  lu.tiroir.x === 0 && lu.tiroir.bas === 900,
  JSON.stringify(lu.tiroir),
);

console.log("\n── LA HAUTEUR, SANS LES TROIS `calc()` DE FAM ──────────");
//  C'est le contrôle qui vaut le plus cher : FAM découpe la hauteur en
//  `calc(100% - 69px)`, `- 110px` et `- 39px`. En colonne flex il n'en
//  reste aucune, et le contenu doit tomber AU PIXEL entre la bande
//  d'onglets et la barre du bas.
dire(
  "LE CONTENU REMPLIT EXACTEMENT LE RESTE",
  lu.contenu.y === lu.bandeOnglets.bas && lu.contenu.bas === lu.barreBas.y,
  JSON.stringify({
    contenu: [lu.contenu.y, lu.contenu.bas],
    bande: lu.bandeOnglets.bas,
    barreBas: lu.barreBas.y,
  }),
);
dire(
  "et les quatre bandes se suivent sans trou ni chevauchement",
  lu.barreHaut.bas <= lu.bandeOnglets.y && lu.barreBas.bas === lu.tiroir.bas,
  JSON.stringify({
    haut: lu.barreHaut.bas,
    bande: lu.bandeOnglets.y,
    bas: [lu.barreBas.y, lu.barreBas.bas],
    tiroir: lu.tiroir.bas,
  }),
);

console.log("\n── LA BARRE DU HAUT ────────────────────────────────────");
dire(
  "DE L'ESPACE ENTRE LA BARRE ET LA BANDE D'ONGLETS",
  lu.ecartBarreBande === 16,
  `${lu.ecartBarreBande} px`,
);
//  ── POURQUOI LE TITRE N'ÉTAIT PAS CENTRÉ ──────────────────────────
//  FAM donne 40 px de haut à la barre ; notre feuille lui donnait 20 de
//  rembourrage ; et notre propre `box-sizing: border-box` les faisait
//  entrer DANS les 40. Boîte de contenu : zéro pixel.
const centreTitre = lu.titre.x + lu.titre.l / 2;
const centreBarre = lu.barreHaut.x + lu.barreHaut.l / 2;
dire(
  "LE TITRE EST CENTRÉ HORIZONTALEMENT",
  Math.abs(centreTitre - centreBarre) <= 1,
  JSON.stringify({ titre: centreTitre, barre: centreBarre }),
);
dire(
  "ET VERTICALEMENT — c'est celui-là qui était faux",
  Math.abs((lu.titre.y + lu.titre.h / 2) - (lu.barreHaut.y + lu.barreHaut.h / 2)) <= 1,
  JSON.stringify({ titre: [lu.titre.y, lu.titre.h], barre: [lu.barreHaut.y, lu.barreHaut.h] }),
);
dire(
  "il tient dans sa barre, il n'en déborde pas",
  lu.titre.y >= lu.barreHaut.y && lu.titre.bas <= lu.barreHaut.bas,
  JSON.stringify({
    titre: [lu.titre.y, lu.titre.bas],
    barre: [lu.barreHaut.y, lu.barreHaut.bas],
  }),
);

console.log("\n── LES ONGLETS ────────────────────────────────────────");
dire(
  "L'ONGLET ACTIF PREND L'ACCENT, LA BANDE RESTE EN BLANC",
  lu.fondOngletActif !== lu.fondBande && lu.fondOngletActif.includes("39, 94, 122"),
  JSON.stringify({ actif: lu.fondOngletActif, bande: lu.fondBande }),
);
dire(
  "et son texte passe en inverse pour rester lisible dessus",
  lu.texteOngletActif.includes("255, 251, 247"),
  lu.texteOngletActif,
);
dire(
  "LES DEUX « + » SONT À L'ACCENT",
  lu.plusOnglet === lu.plusSujet && lu.plusOnglet.includes("39, 94, 122"),
  JSON.stringify({ onglet: lu.plusOnglet, sujet: lu.plusSujet }),
);

console.log("\n── UN MESSAGE ─────────────────────────────────────────");
dire(
  "NI CONTOUR NI REMBOURRAGE",
  lu.msgPadding === "0px" && lu.msgBordure === "0px 0px",
  JSON.stringify({ padding: lu.msgPadding, bordure: lu.msgBordure }),
);
//  ── CE QUI LES FAISAIT TOMBER L'UN SOUS L'AUTRE ───────────────────
//  L'avatar est annoncé à 48 et mesure 56 — deux pixels de rembourrage
//  et deux de bordure de chaque côté, non comptés —, et la boîte prend
//  `calc(100% - 48px)`. 100 % plus huit pixels : elle passait à la
//  ligne. Ce contrôle mesure les deux rectangles, il ne croit pas la
//  déclaration.
dire(
  "L'AVATAR ET LE CORPS SONT SUR LA MÊME LIGNE",
  lu.memeLigne,
  JSON.stringify({ avatar: [lu.avatar.x, lu.avatar.d], boite: [lu.boite.x, lu.boite.d] }),
);
dire(
  "et c'est une rangée flex, pas deux flottants",
  lu.msgAffichage === "flex",
  lu.msgAffichage,
);
dire(
  "la bulle ne déborde pas du tiroir",
  lu.bulle.d <= lu.tiroir.d,
  JSON.stringify({ bulle: lu.bulle.d, tiroir: lu.tiroir.d }),
);
dire(
  "MES messages se rangent à droite de leur colonne",
  Math.abs(lu.maBulle.d - lu.maBoite.d) <= 1,
  JSON.stringify({ bulle: lu.maBulle.d, boite: lu.maBoite.d }),
);
dire(
  "la bulle est arrondie à 10, comme les blocs de la charte",
  lu.rayonBulle === "10px",
  lu.rayonBulle,
);

console.log("\n── LA BARRE DU BAS ────────────────────────────────────");
dire(
  "DU REMBOURRAGE ET UN ÉCART, plus une rangée de cases bord à bord",
  lu.barrePadding !== "0px" && lu.barreEcart !== "normal" && parseFloat(lu.barreEcart) > 0,
  JSON.stringify({ padding: lu.barrePadding, ecart: lu.barreEcart }),
);
dire(
  "les boutons sont des pastilles arrondies",
  parseFloat(lu.boutonRayon) >= 10,
  lu.boutonRayon,
);
dire(
  "le champ prend la largeur qui reste",
  lu.champ.l > lu.envoyer.l * 4,
  JSON.stringify({ champ: lu.champ.l, bouton: lu.envoyer.l }),
);
dire(
  "et tout tient dans le tiroir",
  lu.envoyer.d <= lu.tiroir.d && lu.champ.x >= lu.tiroir.x,
  JSON.stringify({ envoyer: lu.envoyer.d, tiroir: lu.tiroir.d }),
);
dire(
  "les trois boutons d'un message sont une pastille ronde",
  parseFloat(lu.rayonActions) >= 10,
  lu.rayonActions,
);

// ── LES DEUX ESCAMOTAGES DE FAM, QU'ON POURRAIT ÉCRASER ─────────────
//
//  FAM cache cette barre dans deux états, chaque fois avec une règle à
//  UN identifiant — que la nôtre, qui en a deux, écraserait sans bruit :
//  `#FAM-actions:empty` et `.FAM-viewing-forum + #FAM-actions`. Les
//  deux sont reposées dans la feuille 15, et c'est ici qu'on le prouve.
console.log("\n── CE QUE FAM ESCAMOTE, ET QU'ON N'A PAS CASSÉ ────────");
const escamote = await p.evaluate(() => {
  const barre = document.querySelector("#FAM-actions");
  const contenu = document.querySelector("#FAM-content");
  const garde = barre.innerHTML;

  contenu.className = "FAM-viewing-forum";
  const surUnForum = {
    h: Math.round(barre.getBoundingClientRect().height),
    padding: getComputedStyle(barre).padding,
  };
  contenu.className = "FAM-viewing-topic";

  barre.innerHTML = "";
  const vide = getComputedStyle(barre).display;
  barre.innerHTML = garde;

  return { surUnForum, vide, apres: getComputedStyle(barre).display };
});
dire(
  "SUR LA LISTE D'UN FORUM, LA BARRE RESTE ESCAMOTÉE",
  escamote.surUnForum.h === 0 && escamote.surUnForum.padding === "0px",
  JSON.stringify(escamote.surUnForum),
);
dire(
  "et vide, elle disparaît toujours",
  escamote.vide === "none",
  escamote.vide,
);
dire("elle revient quand on la remplit", escamote.apres === "flex", escamote.apres);

// ── EN THÈME SOMBRE ────────────────────────────────────────────────
console.log("\n── EN THÈME SOMBRE ────────────────────────────────────");
//  `body.wm-sombre`, ET PAS `data-wm-theme` : cet attribut n'est un
//  sélecteur nulle part dans la charte. Ce harnais a donc mesuré le
//  thème CLAIR pendant deux semaines, en annonçant le sombre — cinq
//  rapports de contraste justes, pour le mauvais thème.
await p.evaluate(() => document.body.classList.add("wm-sombre"));
await p.waitForTimeout(120);
const sombre = await p.evaluate(() => {
  const lire = (s, p) => {
    const e = document.querySelector(s);
    return e === null ? null : getComputedStyle(e)[p];
  };
  //  Le contraste d'un texte sur son fond, calculé et pas supposé.
  const voie = (t) => (t.match(/-?\d*\.?\d+/g) ?? []).map(Number);
  const lum = (c) => {
    const [r, g, b] = voie(c).slice(0, 3).map((v) => {
      const x = v / 255;
      return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const rapport = (a, b) => {
    const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m);
    return Math.round(((x + 0.05) / (y + 0.05)) * 100) / 100;
  };
  return {
    ongletActif: rapport(
      lire(".FAM-tab.FAM-tab-active", "color"),
      lire(".FAM-tab.FAM-tab-active", "backgroundColor"),
    ),
    bulle: rapport(
      lire(".FAM-msg .FAM-msg-content", "color"),
      lire(".FAM-msg .FAM-msg-content", "backgroundColor"),
    ),
    maBulle: rapport(
      lire(".FAM-my-msg .FAM-msg-content", "color"),
      lire(".FAM-my-msg .FAM-msg-content", "backgroundColor"),
    ),
    titre: rapport(lire(".FAM-maintitle", "color"), lire("#FAM", "backgroundColor")),
    champ: rapport(lire("#FAM-msg", "color"), lire("#FAM-msg-container", "backgroundColor")),
  };
});
for (const [quoi, r] of Object.entries(sombre)) {
  dire(`${quoi} : ${r} contre son fond`, r >= 4.5, `${r}`);
}

await nav.close();
console.log(soucis.length === 0 ? "\nTOUT PASSE." : `\n${soucis.length} DÉFAUT(S).`);
for (const s of soucis) console.log("  · " + s);
if (soucis.length > 0) Deno.exit(1);
