// ════════════════════════════════════════════════════════════════════
//  outils/messagerie.mjs — la boîte de réception, dans un vrai
//  navigateur.
//
//  COUVRE : css/30-messagerie.css
//
//      deno run -A outils/messagerie.mjs
//      deno run -A outils/messagerie.mjs --photo
//
//  ── TROIS ÉTATS, PARCE QUE LE DÉFAUT LE PLUS LAID EST DANS LE VIDE ─
//
//  Un dossier PLEIN, un dossier VIDE et une liste de sujets ordinaire
//  sont montés sur la même page.
//
//  Le dossier vide n'est pas une variante : c'est là que le défaut
//  était le plus visible, parce que sans message il n'y a pas de
//  pastille, et le `dt` du message « Vous n'avez pas de messages dans
//  ce dossier » tombait alors dans la colonne de 48 px — un mot par
//  ligne. Un harnais qui ne monterait que des lignes pleines serait
//  vert sur une page cassée.
//
//  La liste de sujets est là pour l'autre moitié de la demande, celle
//  de la page de recherche : rien de ce qu'on fait ici ne doit
//  l'atteindre.
//
//  Le balisage vient d'un relevé fait le 13 novembre dans le
//  navigateur de Callista, sur `/privmsg?folder=sentbox` et
//  `?folder=inbox` : la page est derrière la connexion, et on ne s'y
//  connecte pas d'ici. Les mesures d'origine sont dans l'en-tête de
//  la feuille.
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

/** L'en-tête, dans sa propre liste — c'est ainsi que Forumactif l'écrit. */
const entete = (mot) => `
  <ul class="topiclist topics">
    <li class="header">
      <dl>
        <dt><div class="list-inner">Sujet</div></dt>
        <dd class="mark">${mot}</dd>
      </dl>
    </li>
  </ul>`;

/*  LES 24 × 20 PX DU `div` VIDE VIENNENT DE LA FEUILLE DE MODERNBB,
    que ce fac-similé ne charge pas : relevés le 13 novembre sur la
    vraie page, ils sont reposés ici en style en ligne. Sans eux le
    défaut n'existerait pas sur cette page, et la règle qui le corrige
    serait gardée par un contrôle vert d'avance. Même principe que le
    bleu de ModernBB reposé dans `outils/statistiques.mjs`. */
const PLACE_DU_DOSSIER = 'style="width: 24px; height: 20px"';

/** Une ligne de message privé. Le `div` vide est celui du relevé. */
const message = (n, sujet, qui, quand) => `
  <li class="row row${n % 2 === 0 ? 2 : 1}">
    <div ${PLACE_DU_DOSSIER}></div>
    <dl class="icon">
      <span class="wm-pastille"></span>
      <dt>
        <a class="topictitle" href="/privmsg?mode=read">${sujet}</a><br>
        <span>${qui} - ${quand}</span>
      </dt>
      <dd class="mark"><input type="checkbox"></dd>
    </dl>
  </li>`;

/*  LA MÊME LIGNE, SANS JAVASCRIPT. La pastille est posée par
    `module-categories` ; sans script elle n'existe pas, et Forumactif
    laisse son image dans un `style` en ligne sur le `dl`. C'est un
    état réel de la page, pas une hypothèse — et c'est celui où la
    case à cocher, si on ne lui nommait pas son aire, retomberait dans
    la première colonne, celle de la pastille absente. */
const sansScript = (sujet, qui) => `
  <li class="row row1">
    <div ${PLACE_DU_DOSSIER}></div>
    <dl class="icon" style="background:url(https://i.servimg.com/u/f11/no-new.png) no-repeat scroll 10px 50%;">
      <dt>
        <a class="topictitle" href="/privmsg?mode=read">${sujet}</a><br>
        <span>${qui} - Hier à 9:02</span>
      </dt>
      <dd class="mark"><input type="checkbox"></dd>
    </dl>
  </li>`;

/*  LE DOSSIER VIDE : pas de pastille, un `strong` dans le `dt`. */
const vide = `
  <li class="row row1">
    <div ${PLACE_DU_DOSSIER}></div>
    <dl class="icon">
      <dt><strong>Vous n'avez pas de messages dans ce dossier</strong></dt>
      <dd class="mark"></dd>
    </dl>
  </li>`;

/** Une ligne de liste de sujets, pour le témoin. */
const sujet = `
  <li class="row row1">
    <dl class="icon">
      <span class="wm-pastille"></span>
      <dd class="dterm">
        <div class="topic-title-container">
          <a class="topic-title" href="/t9-x">Un sujet de forum</a>
        </div>
      </dd>
      <dd class="posts">12</dd>
      <dd class="views">51</dd>
      <dd class="lastpost"><span><a href="/t9-x">Hier à 17:54</a></span></dd>
    </dl>
  </li>`;

const PAGE = `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8">
<title>Messages privés</title>
<link rel="stylesheet" href="/jetons.css"><link rel="stylesheet" href="/wild-mystery.css">
</head><body><div id="modernbb"><div class="wrap"><div id="main-content">

<ul id="privmsgs-menu">
  <li><i class="ion-archive"></i><div class="active">Boîte de réception</div></li>
  <li><i class="ion-paper-airplane"></i><a href="/privmsg?folder=sentbox">Messages envoyés</a></li>
</ul>
<div class="pm-actions"><a class="ion-ios-compose-outline button-round" href="/privmsg?mode=post"></a></div>

<!-- UN DOSSIER PLEIN -->
<div class="forabg" id="plein">
  <div class="inner">
    ${entete("Sélectionner")}
    <ul class="topiclist pmlist bg_none">
      ${message(1, "C'est Noël sur Wild Mystery !", "Arceus", "Mer 1 Déc 2021 - 0:49")}
      ${message(2, "Nous sommes de retour !", "Arceus", "Dim 5 Sep 2021 - 18:35")}
    </ul>
  </div>
</div>

<!-- LE MÊME DOSSIER, SANS JAVASCRIPT -->
<div class="forabg" id="sans-script">
  <div class="inner">
    ${entete("Sélectionner")}
    <ul class="topiclist pmlist bg_none">
      ${sansScript("Un message reçu sans script", "Arceus")}
    </ul>
  </div>
</div>

<!-- UN DOSSIER VIDE -->
<div class="forabg" id="dossier-vide">
  <div class="inner">
    ${entete("Sélectionner")}
    <ul class="topiclist pmlist bg_none">${vide}</ul>
  </div>
</div>

<!-- ET UNE LISTE DE SUJETS, QUI NE DOIT RIEN RECEVOIR -->
<div class="forabg" id="forum">
  <div class="inner">
    ${entete("Vues")}
    <ul class="topiclist topics">${sujet}</ul>
  </div>
</div>

</div></div></div></body></html>`;

let passes = 0;
const soucis = [];
function ok(quoi, vrai, detail) {
  if (vrai) {
    passes += 1;
    console.log(`  ok   ${quoi}`);
  } else {
    soucis.push(quoi);
    console.log(
      `  NON  ${quoi}${detail === undefined ? "" : ` — ${JSON.stringify(detail)}`}`,
    );
  }
}

const nav = await chromium.launch(CHROME === undefined ? {} : { executablePath: CHROME });
const p = await nav.newPage({ viewport: { width: 1384, height: 1200 } });
await p.route("**/*", (r) => {
  const u = r.request().url();
  if (/\/privmsg$/.test(u)) {
    return r.fulfill({ contentType: "text/html; charset=utf-8", body: PAGE });
  }
  if (/jetons\.css$/.test(u)) {
    return r.fulfill({ contentType: "text/css", body: lire("panneau-admin/jetons.css") });
  }
  if (/wild-mystery\.css$/.test(u)) {
    return r.fulfill({ contentType: "text/css", body: lire("css/wild-mystery.css") });
  }
  return r.fulfill({ status: 404, body: "" });
});
await p.goto("https://exemple.test/privmsg", { waitUntil: "load" });
await p.waitForTimeout(150);

const vu = await p.evaluate(() => {
  const g = (s) => document.querySelector(s);
  const b = (e) => {
    const x = e.getBoundingClientRect();
    return {
      g: Math.round(x.left),
      d: Math.round(x.right),
      h: Math.round(x.top),
      ht: Math.round(x.height),
    };
  };
  const lignes = (e) => {
    //  COMBIEN DE LIGNES DE TEXTE le navigateur a vraiment tracées.
    //  C'est la mesure du défaut : « Vous n'avez pas de messages dans
    //  ce dossier » en faisait huit, une par mot.
    const r = document.createRange();
    r.selectNodeContents(e);
    return r.getClientRects().length;
  };
  const plein = g("#plein li.row dl.icon");
  const titre = g("#plein li.row a.topictitle");
  const case1 = g("#plein li.row dd.mark");
  const videDl = g("#dossier-vide li.row dl.icon");
  const videTexte = g("#dossier-vide li.row strong");
  const teteP = g("#plein li.header dl");
  const forum = g("#forum li.row dl.icon");
  return {
    plein: {
      hauteurLigne: b(g("#plein li.row")).ht,
      colonnes: getComputedStyle(plein).gridTemplateColumns,
      rangees: getComputedStyle(plein).gridTemplateRows,
      //  La case à cocher doit être à droite, pas au milieu.
      caseDroite: b(plein).d - b(case1).d,
      caseGauche: b(case1).g,
      milieu: Math.round((b(plein).g + b(plein).d) / 2),
      titreGauche: b(titre).g,
      //  Le `div` vide de la place de l'image de dossier.
      divVide: g("#plein li.row > div").getBoundingClientRect().height,
    },
    sansScript: (() => {
      const dl = g("#sans-script li.row dl.icon");
      const m = g("#sans-script li.row dd.mark");
      return {
        caseGauche: b(m).g,
        milieu: Math.round((b(dl).g + b(dl).d) / 2),
        titreGauche: b(g("#sans-script li.row a.topictitle")).g,
      };
    })(),
    vide: {
      lignesDeTexte: lignes(videTexte),
      largeurTexte: b(videTexte).d - b(videTexte).g,
      //  Il débordait de cinquante pixels AU-DESSUS de sa ligne.
      debordeEnHaut: b(videDl).h - b(videTexte).h,
      colonnes: getComputedStyle(videDl).gridTemplateColumns,
    },
    tete: {
      //  Une seule ligne, et chaque mot au-dessus de ce qu'il annonce.
      hauteur: b(teteP).ht,
      sujetGauche: b(g("#plein li.header dt")).g,
      selectionnerDroite: b(teteP).d - b(g("#plein li.header dd.mark")).d,
      affichage: getComputedStyle(teteP).display,
    },
    forum: {
      colonnes: getComputedStyle(forum).gridTemplateColumns,
      teteAffichage: getComputedStyle(g("#forum li.header dl")).display,
      hauteurLigne: b(g("#forum li.row")).ht,
    },
    bouton: getComputedStyle(g(".pm-actions .button-round")).backgroundColor,
    onglet: getComputedStyle(g("#privmsgs-menu .active")).backgroundColor,
    deborde: [...document.querySelectorAll("#modernbb *")]
      .filter((e) =>
        e.getBoundingClientRect().right > document.documentElement.clientWidth + 1
      ).length,
  };
});

console.log("\n── un dossier qui a des messages ──");
//  150 px de ligne pour deux lignes de texte, relevé le 13 novembre.
ok(
  "la ligne a la hauteur de ce qu'elle contient",
  vu.plein.hauteurLigne < 100,
  vu.plein,
);
ok(
  "trois colonnes, pas les quatre d'une liste de sujets",
  vu.plein.colonnes.split(" ").length === 3,
  vu.plein.colonnes,
);
//  Elle était à 864 px sur une ligne qui en fait 1120, soit à peu près
//  au milieu, pendant que son étiquette était tout à droite.
ok(
  "la case à cocher est à droite, sous son étiquette",
  vu.plein.caseGauche > vu.plein.milieu + 200,
  vu.plein,
);
ok(
  "la place vide de l'image de dossier a disparu",
  vu.plein.divVide === 0,
  vu.plein.divVide,
);

console.log("\n── et le même, sans JavaScript ──");
//  SANS PASTILLE, LA PREMIÈRE COLONNE EST LIBRE : c'est là que la case
//  à cocher irait se placer toute seule si son aire n'était pas nommée.
ok(
  "la case reste à droite même sans pastille",
  vu.sansScript.caseGauche > vu.sansScript.milieu + 200,
  vu.sansScript,
);
ok(
  "et le titre reste dans la colonne de l'identité",
  Math.abs(vu.sansScript.titreGauche - vu.plein.titreGauche) < 14,
  { sansScript: vu.sansScript.titreGauche, plein: vu.plein.titreGauche },
);

console.log("\n── et un dossier vide ──");
//  LE DÉFAUT PRINCIPAL : un mot par ligne dans douze pixels.
ok(
  "le message tient sur une ligne",
  vu.vide.lignesDeTexte === 1,
  vu.vide,
);
ok(
  "il dispose de la largeur de la liste",
  vu.vide.largeurTexte > 200,
  vu.vide,
);
ok(
  "et il ne déborde plus au-dessus de sa ligne",
  vu.vide.debordeEnHaut <= 0,
  vu.vide,
);

console.log("\n── l'en-tête tombe en face de ce qu'il annonce ──");
ok(
  "il tient sur une ligne",
  vu.tete.hauteur < 50,
  vu.tete,
);
ok(
  "« Sujet » est au-dessus des sujets",
  Math.abs(vu.tete.sujetGauche - vu.plein.titreGauche) < 14,
  { tete: vu.tete.sujetGauche, titre: vu.plein.titreGauche },
);
ok(
  "et « Sélectionner » au-dessus des cases",
  Math.abs(vu.tete.selectionnerDroite - vu.plein.caseDroite) < 14,
  { tete: vu.tete.selectionnerDroite, case: vu.plein.caseDroite },
);

console.log("\n── les deux derniers bleus de ModernBB ──");
ok(
  "le bouton rond n'est plus bleu",
  vu.bouton !== "rgb(55, 147, 255)",
  vu.bouton,
);
ok(
  "le dossier courant se voit",
  vu.onglet !== "rgba(0, 0, 0, 0.05)",
  vu.onglet,
);

console.log("\n── et la liste d'un forum ne bouge pas ──");
//  L'AUTRE MOITIÉ DE LA DEMANDE, celle de la page de recherche :
//  « sans venir toucher aux catégories / liste des forums ».
ok(
  "elle garde ses quatre colonnes",
  vu.forum.colonnes.split(" ").length === 4,
  vu.forum.colonnes,
);
ok(
  "son en-tête n'est pas passé en grille",
  vu.forum.teteAffichage !== "grid",
  vu.forum.teteAffichage,
);
ok(
  "et ses lignes gardent leur hauteur",
  vu.forum.hauteurLigne >= 92,
  vu.forum.hauteurLigne,
);

console.log("\n── la page tient ──");
ok("rien ne déborde à 1384", vu.deborde === 0, vu.deborde);
for (const largeur of [1100, 740, 390]) {
  await p.setViewportSize({ width: largeur, height: 1200 });
  await p.waitForTimeout(80);
  const trop = await p.evaluate(() =>
    [...document.querySelectorAll("#modernbb *")]
      .filter((e) =>
        e.getBoundingClientRect().right > document.documentElement.clientWidth + 1
      ).map((e) => e.className).slice(0, 3)
  );
  ok(`rien ne déborde à ${largeur}`, trop.length === 0, trop);
}
await p.setViewportSize({ width: 1384, height: 1200 });

if (Deno.args.includes("--photo")) {
  for (const theme of ["clair", "sombre"]) {
    await p.evaluate(
      (t) => document.body.classList.toggle("wm-sombre", t === "sombre"),
      theme,
    );
    await p.waitForTimeout(80);
    await p.screenshot({ path: `${R}messagerie-${theme}.png` });
  }
  console.log("photos : messagerie-<thème>.png");
}

await p.close();
await nav.close();
console.log(soucis.length === 0 ? `\nTOUT PASSE (${passes}).` : `\n${soucis.length} DÉFAUT(S).`);
for (const s of soucis) console.log("  · " + s);
if (soucis.length > 0) Deno.exit(1);
