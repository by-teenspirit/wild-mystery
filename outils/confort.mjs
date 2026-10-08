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
<div id="page-body">
<div class="post"><div class="postbody"><div class="content">
<p>Un message, parce qu'un réglage de lisibilité se mesure sur du texte
lu et pas sur un bloc vide.</p>
<p>Un second paragraphe, pour l'écart entre deux.</p>
<p><a href="/t1-un-sujet">un lien dans le message</a></p>
</div></div></div>
<div class="forabg" style="height:3000px">des forums</div></div>
</body></html>`;

const nav = await chromium.launch(CHROME === undefined ? {} : { executablePath: CHROME });
const p = await nav.newPage({ viewport: { width: 1280, height: 900 } });
const soucis = [];
p.on("pageerror", (e) => soucis.push("erreur JS : " + e.message));

await p.goto("https://exemple.test/", { waitUntil: "domcontentloaded" }).catch(() => {});
//  ON COMPTE LES REQUÊTES DE POLICE. C'est la promesse du réglage
//  « Police pour la dyslexie » : décochée, elle ne coûte rien, parce
//  qu'un navigateur ne va chercher une police que lorsqu'un élément
//  RENDU s'en sert. Une promesse de ce genre ne se tient pas sur
//  parole — elle se compte.
const requetesDePolice = [];
await p.route("**/*", (r) => {
  const url = r.request().url();
  if (url.includes("opendyslexic")) {
    requetesDePolice.push(url);
    const n = url.includes("bold") ? "bold" : "regular";
    return r.fulfill({
      contentType: "font/woff2",
      body: readFileSync(R + `assets/polices/opendyslexic-${n}.woff2`),
    });
  }
  return r.fulfill({ contentType: "text/html; charset=utf-8", body: page });
});
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
  //  100 depuis le 8 octobre : la colonne s'est élargie de huit pixels
  //  pour que « CONFORT » tienne une fois les icônes alignées à
  //  gauche sur une fente fixe.
  bouton !== null && bouton.l <= 100 && bouton.h <= 60,
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
dire("et il porte bien les cinq réglages", ferme.choix === 5, JSON.stringify(ferme));

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

// ── LES DEUX RÉGLAGES DU 8 OCTOBRE ──────────────────────────────────
await p.setViewportSize({ width: 1280, height: 900 });
await p.evaluate(() => document.body.className = "");
await p.waitForTimeout(80);

//  1 · AÉRER LE TEXTE : les trois chiffres du critère 1.4.12 du WCAG.
//  On mesure sur un paragraphe de MESSAGE, pas sur un de nos blocs :
//  c'est la leçon de « grossir le texte », qui n'aérait que nous.
const aere = await p.evaluate(() => {
  const lire = () => {
    const e = document.querySelector("#page-body p") ?? document.querySelector("#page-body");
    const s = getComputedStyle(e);
    const taille = parseFloat(s.fontSize);
    //  « normal » est la valeur par défaut de `letter-spacing` et de
    //  `word-spacing`, et `parseFloat` en fait un NaN — qui compare
    //  faux avec tout, y compris avec lui-même. Zéro, c'est ce que
    //  « normal » vaut ici.
    const n = (v) => {
      const x = parseFloat(v);
      return Number.isFinite(x) ? x : 0;
    };
    return {
      rapport: Number((n(s.lineHeight) / taille).toFixed(2)),
      lettre: Number((n(s.letterSpacing) / taille).toFixed(3)),
      mot: Number((n(s.wordSpacing) / taille).toFixed(3)),
    };
  };
  const avant = lire();
  document.body.classList.add("wm-texte-aere");
  return { avant, apres: lire() };
});
dire(
  "AÉRER LE TEXTE ATTEINT LES TROIS PLANCHERS DU WCAG 1.4.12",
  aere.apres.rapport >= 1.5 && aere.apres.lettre >= 0.12 && aere.apres.mot >= 0.16,
  JSON.stringify(aere),
);
dire(
  "et il change bien quelque chose",
  aere.apres.rapport > aere.avant.rapport && aere.apres.lettre > aere.avant.lettre,
  JSON.stringify(aere),
);
await p.evaluate(() => document.body.classList.remove("wm-texte-aere"));

//  2 · LA POLICE POUR LA DYSLEXIE, et ce qu'elle coûte décochée.
await p.waitForTimeout(150);
const avantLaPolice = requetesDePolice.length;
dire(
  "DÉCOCHÉE, LA POLICE POUR LA DYSLEXIE NE COÛTE PAS UNE REQUÊTE",
  avantLaPolice === 0,
  `${avantLaPolice} requête(s)`,
);
const police = await p.evaluate(async () => {
  document.body.classList.add("wm-police-dyslexie");
  await document.fonts.ready;
  const s = getComputedStyle(document.querySelector("#page-body"));
  return { famille: s.fontFamily };
});
await p.waitForTimeout(250);
dire(
  "cochée, elle se télécharge et s'applique",
  requetesDePolice.length > 0 && police.famille.includes("OpenDyslexic"),
  JSON.stringify({ requetes: requetesDePolice.length, ...police }),
);
await p.evaluate(() => document.body.classList.remove("wm-police-dyslexie"));

//  3 · LE CONTRASTE RENFORCÉ DU SYSTÈME, qu'on n'écoutait pas.
const contraste = await p.evaluate(() => {
  const r = getComputedStyle(document.documentElement);
  const lire = () => {
    const c = getComputedStyle(document.body);
    return {
      pale: c.getPropertyValue("--wm-texte-pale").trim(),
      corps: c.getPropertyValue("--wm-texte-corps").trim(),
      filet: c.getPropertyValue("--wm-bord-fin").trim(),
      net: c.getPropertyValue("--wm-bord-net").trim(),
    };
  };
  return { r: r.length > 0, lu: lire() };
});
//  PAR CDP ET PAS PAR `emulateMedia` : l'option `contrast` n'est
//  arrivée dans Playwright qu'après la version épinglée ici, et elle y
//  est ignorée EN SILENCE — l'assertion passait au vert sans rien
//  émuler. Le protocole Chrome, lui, le fait depuis longtemps.
const cdp = await p.context().newCDPSession(p);
await cdp.send("Emulation.setEmulatedMedia", {
  features: [{ name: "prefers-contrast", value: "more" }],
});
await p.waitForTimeout(80);
const renforce = await p.evaluate(() => {
  const c = getComputedStyle(document.body);
  const lien = document.querySelector("#page-body a") ?? document.querySelector("a");
  return {
    pale: c.getPropertyValue("--wm-texte-pale").trim(),
    corps: c.getPropertyValue("--wm-texte-corps").trim(),
    filet: c.getPropertyValue("--wm-bord-fin").trim(),
    net: c.getPropertyValue("--wm-bord-net").trim(),
    souligne: lien === null ? null : getComputedStyle(lien).textDecorationLine,
  };
});
//  LES DEUX FILETS FINISSENT À L'ENCRE, et pas l'un à la valeur de
//  l'autre : une propriété personnalisée se résout sur la valeur
//  FINALE de celle qu'elle cite, et les deux changent dans la même
//  règle. `bord-fin` suit donc `bord-net` jusqu'à l'encre. C'est ce
//  qu'on veut en contraste renforcé, et c'est ce qu'on vérifie — pas
//  ce que j'avais d'abord écrit dans le commentaire.
dire(
  "EN CONTRASTE RENFORCÉ, LE PÂLE REJOINT LE CORPS ET LES FILETS PASSENT À L'ENCRE",
  renforce.pale === renforce.corps && renforce.pale !== contraste.lu.pale &&
    renforce.filet === renforce.net && renforce.filet !== contraste.lu.filet,
  JSON.stringify({ avant: contraste.lu, apres: renforce }),
);
dire(
  "et les liens se soulignent",
  renforce.souligne !== null && renforce.souligne.includes("underline"),
  JSON.stringify(renforce.souligne),
);
await cdp.send("Emulation.setEmulatedMedia", { features: [] });

// ── LE BOUTON DU TCHAT SE RANGE DANS LA COLONNE ─────────────────────
//
//  CE QUE CE BLOC AURAIT ÉVITÉ. Le module cherchait `#FAM-button-open`.
//  Ce nœud n'existe pas : FAM sert `#FAM-button`. Le rangement ne
//  partait donc jamais, et le bouton restait en bas à droite de
//  l'écran — c'est-à-dire PAR-DESSUS le coin d'outils, sur « Confort ».
//  Ça a tenu une journée, parce que rien ne regardait.
//
//  FAM n'est pas chargé ici : on pose son bouton à la main, avec SA
//  règle à lui — `position: fixed`, 30 x 30, collé au coin bas droit.
//  C'est tout ce dont le module a besoin pour se tromper.
await p.evaluate(() => {
  const css = document.createElement("style");
  //  Relevé mot pour mot dans le CSS que FAM injecte, le 8 octobre.
  css.textContent =
    "#FAM-button{color:#FFF;background:#39F;position:fixed;width:30px;height:30px;right:3px;bottom:3px;cursor:pointer;z-index:99999}";
  document.head.appendChild(css);
  const a = document.createElement("a");
  a.id = "FAM-button";
  a.title = "Forumactif Messenger";
  a.innerHTML = '<i class="fa fa-comment"></i>';
  document.body.appendChild(a);
});
//  L'observateur du module le prend au vol : on lui laisse un tour.
await p.waitForTimeout(250);

const tchat = await p.evaluate(() => {
  const b = document.querySelector("#FAM-button");
  const coin = document.querySelector(".wm-coin");
  if (b === null || coin === null) return null;
  const r = b.getBoundingClientRect();
  const voisins = [...coin.children].filter((c) => c !== b).map((c) => {
    const x = c.getBoundingClientRect();
    return { l: Math.round(x.left), w: Math.round(x.width) };
  });
  return {
    dansLeCoin: b.parentElement === coin,
    premier: coin.firstElementChild === b,
    classes: b.className,
    role: b.getAttribute("role"),
    tabindex: b.getAttribute("tabindex"),
    etiquette: (b.textContent || "").trim(),
    position: getComputedStyle(b).position,
    l: Math.round(r.width),
    h: Math.round(r.height),
    coin: Math.round(coin.getBoundingClientRect().width),
    voisins,
    //  Le chevauchement, mesuré et pas supposé : aucun outil de la
    //  colonne ne doit recouvrir un autre.
    croise: [...coin.children].some((c, i, t) =>
      t.slice(i + 1).some((d) => {
        const a = c.getBoundingClientRect(), e = d.getBoundingClientRect();
        return a.bottom > e.top + 1 && e.bottom > a.top + 1;
      })
    ),
  };
});
dire(
  "LE BOUTON DU TCHAT EST RANGÉ DANS LE COIN",
  tchat?.dansLeCoin === true,
  JSON.stringify(tchat),
);
dire("et il y prend la première place", tchat?.premier === true);
dire(
  "il rentre dans le flux : plus de `position: fixed`",
  tchat?.position === "static",
  tchat?.position,
);
dire(
  "il prend toute la largeur de la colonne, comme ses voisins",
  tchat !== null && tchat.l === tchat.coin && tchat.voisins.every((v) => v.w === tchat.coin),
  JSON.stringify({ bouton: tchat?.l, coin: tchat?.coin, voisins: tchat?.voisins }),
);
dire("RIEN NE CHEVAUCHE RIEN dans la colonne", tchat?.croise === false);
dire(
  "il porte l'allure des autres outils",
  (tchat?.classes ?? "").includes("wm-coin__bouton") &&
    (tchat?.classes ?? "").includes("wm-messenger-range"),
  tchat?.classes,
);
dire(
  "et une étiquette écrite, pas seulement un `title`",
  (tchat?.etiquette ?? "") !== "",
  tchat?.etiquette,
);
dire(
  "il s'atteint au clavier",
  tchat?.role === "button" && tchat?.tabindex === "0",
  JSON.stringify({ role: tchat?.role, tabindex: tchat?.tabindex }),
);

await nav.close();
console.log(soucis.length === 0 ? "\nTOUT PASSE." : `\n${soucis.length} DÉFAUT(S).`);
for (const s of soucis) console.log("  · " + s);
if (soucis.length > 0) Deno.exit(1);
