// ════════════════════════════════════════════════════════════════════
//  outils/statistiques.mjs — la page `/statistics`, dans un vrai
//  navigateur.
//
//  COUVRE : css/28-statistiques.css
//
//      deno run -A outils/statistiques.mjs
//      deno run -A outils/statistiques.mjs --photo
//
//  ── POURQUOI UN FAC-SIMILÉ, ET CE QUE ÇA VAUT ─────────────────────
//
//  La page est derrière la connexion : le bac à sable ne peut pas
//  l'ouvrir, et on ne se connecte pas au forum depuis ici. Le balisage
//  ci-dessous est donc REPRODUIT à partir d'un relevé fait le
//  13 novembre dans le navigateur de Callista, sur la vraie page —
//  classes, imbrication, attributs, et jusqu'aux trois images des
//  barres avec leurs largeurs en pourcentage.
//
//  CE QUE ÇA NE PROUVE PAS : que Forumactif n'écrit pas autre chose
//  ailleurs sur la page. Ce qui est relevé est relevé ; ce qui ne
//  l'est pas est marqué comme tel plutôt que deviné. Les onze
//  tableaux de la vraie page se ramènent à trois familles — `values`,
//  `statistical`, `bars` — et les trois sont ici.
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

//  LE BLEU QUE MODERNBB DONNE À `forumline` quand personne ne le
//  reprend. C'est ce qu'on voyait sur la vraie page, et le harnais le
//  pose comme la feuille de ModernBB le poserait — sinon on
//  vérifierait une page qui n'a jamais eu le défaut.
const MODERNBB = `
  table.forumline { background-color: rgb(55, 147, 255); }
  .catHead, .row1, .row2 { padding: 18px; }
  .row1 { background-color: #fff; }
  .row2 { background-color: #f3f3f3; }
  .cattitle { font-family: Roboto, sans-serif; font-size: 13px; text-transform: uppercase; }
`;

const ligneBarre = (rang, qui, n, pct) => `
  <tr>
    <td class="row1"><span class="gen">${rang}</span></td>
    <td class="row1"><span class="gen"><a href="/u1">${qui}</a></span></td>
    <td class="row1"><span class="gen">${n}</span></td>
    <td class="row1"><span class="gen">${pct}%</span></td>
    <td class="row1 stat-bar"><div style="white-space:nowrap;"><img
      src="/i/fa/modernbb/vote_lcap.png" width="4" height="12" alt=""><img
      src="/i/fa/modernbb/voting_bar.png" width="${pct}%" height="12" alt=""><img
      src="/i/fa/modernbb/vote_rcap.png" width="4" height="12" alt=""></div></td>
  </tr>`;

const PAGE = `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8">
<title>Statistiques du forum</title>
<style>${MODERNBB}</style>
<link rel="stylesheet" href="/jetons.css"><link rel="stylesheet" href="/wild-mystery.css">
</head><body><div id="modernbb"><div class="wrap">

<table class="forumline values" width="100%" cellspacing="1" cellpadding="0">
  <tr><th class="thCornerL">&nbsp;</th><th class="thCornerR">&nbsp;</th></tr>
  <tr><td class="catHead" colspan="2"><span class="cattitle">Survol des statistiques</span></td></tr>
  <tr><td class="row1"><span class="gen">Nombre total de messages</span></td>
      <td class="row2"><span class="gen">5 209</span></td></tr>
  <tr><td class="row1"><span class="gen">Nombre total de membres</span></td>
      <td class="row2"><span class="gen">5</span></td></tr>
  <tr><td class="row1"><span class="gen">Messages par jour</span></td>
      <td class="row2"><span class="gen">2,28</span></td></tr>
</table>

<table class="forumline statistical" width="100%" cellspacing="1" cellpadding="0">
  <tr><th class="thCornerL">&nbsp;</th><th class="thTop">&nbsp;</th><th class="thCornerR">&nbsp;</th></tr>
  <tr><td class="catHead" colspan="3"><span class="cattitle">Sujets les plus actifs</span></td></tr>
  <tr><td class="row1"><span class="gen">1</span></td>
      <td class="row1"><span class="gen"><a href="/t1-x">Un sujet au titre assez long pour tenir deux lignes</a></span></td>
      <td class="row1"><span class="gen">184</span></td></tr>
  <tr><td class="row2"><span class="gen">2</span></td>
      <td class="row2"><span class="gen"><a href="/t2-x">Un autre sujet</a></span></td>
      <td class="row2"><span class="gen">92</span></td></tr>
</table>

<table class="forumline bars" width="100%" cellspacing="1" cellpadding="0">
  <tr><th class="thCornerL">&nbsp;</th><th class="thTop">&nbsp;</th><th class="thCornerR">&nbsp;</th></tr>
  <tr><td class="catHead" colspan="5"><span class="cattitle">Meilleurs posteurs</span></td></tr>
  ${ligneBarre(1, "Maître du Jeu", 43, 91)}
  ${ligneBarre(2, "Compte de test", 8, 17)}
  ${ligneBarre(3, "Arceus", 2, 4)}
</table>

</div></div></body></html>`;

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
const p = await nav.newPage({ viewport: { width: 1280, height: 1000 } });
await p.route("**/*", (r) => {
  const u = r.request().url();
  if (/\/stats$/.test(u)) {
    return r.fulfill({ contentType: "text/html; charset=utf-8", body: PAGE });
  }
  if (/jetons\.css$/.test(u)) {
    return r.fulfill({ contentType: "text/css", body: lire("panneau-admin/jetons.css") });
  }
  if (/wild-mystery\.css$/.test(u)) {
    return r.fulfill({ contentType: "text/css", body: lire("css/wild-mystery.css") });
  }
  //  Les images de 2007 : on rend un pixel, comme le ferait le forum.
  if (/\.(png|gif|jpe?g)/.test(u)) {
    return r.fulfill({
      contentType: "image/png",
      body: Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
        "base64",
      ),
    });
  }
  return r.fulfill({ status: 404, body: "" });
});
await p.goto("https://exemple.test/stats", { waitUntil: "load" });
await p.waitForTimeout(150);

const vu = await p.evaluate(() => {
  const cs = (s, k) => {
    const e = document.querySelector(s);
    return e === null ? null : getComputedStyle(e)[k];
  };
  const rect = (s) => {
    const e = document.querySelector(s);
    return e === null ? null : e.getBoundingClientRect();
  };
  const bleu = [...document.querySelectorAll("#modernbb *")]
    .map((e) => getComputedStyle(e).backgroundColor)
    .filter((c) => c === "rgb(55, 147, 255)");
  const barre = document.querySelector('.stat-bar img[src*="voting_bar"]');
  const gouttiere = document.querySelector(".stat-bar > div");
  return {
    //  LE BLEU NE DOIT PLUS ÊTRE PEINT NULLE PART.
    bleus: bleu.length,
    fondTable: cs("table.forumline", "backgroundColor"),
    //  Les coins de 2007 ne prennent plus de ligne.
    coins: [...document.querySelectorAll(".thCornerL, .thCornerR, .thTop")]
      .map((e) => getComputedStyle(e).display),
    enTete: {
      fond: cs(".catHead", "backgroundColor"),
      police: cs(".cattitle", "fontFamily"),
      casse: cs(".cattitle", "textTransform"),
      taille: cs(".cattitle", "fontSize"),
    },
    //  Dix-huit pixels de rembourrage par cellule, c'était le réglage
    //  des cartes du forum appliqué à un tableau de chiffres.
    //  `td.row1`, PAS `td` : Forumactif met son en-tête de section
    //  dans un `td.catHead`, qui est le PREMIER `td` du tableau. La
    //  première version de ce relevé mesurait donc l'en-tête et
    //  annonçait un défaut de rembourrage qui n'existait pas — une
    //  fausse mesure coûte plus cher que pas de mesure.
    rembourrageCellule: cs("table.forumline td.row1", "padding"),
    //  La zébrure 2007 part : c'est le filet qui sépare les lignes.
    //  Les cellules de DONNÉES, l'en-tête exclu pour la même raison.
    fondsDeLigne: [
      ...new Set(
        [...document.querySelectorAll("table.forumline td:not(.catHead)")]
          .map((e) => getComputedStyle(e).backgroundColor),
      ),
    ],
    barre: barre === null ? null : {
      hauteur: Math.round(barre.getBoundingClientRect().height),
      fond: getComputedStyle(barre).backgroundColor,
      //  La largeur porte la VALEUR : 91 % de la gouttière.
      part: gouttiere === null
        ? null
        : Math.round(
          (barre.getBoundingClientRect().width /
            gouttiere.getBoundingClientRect().width) * 100,
        ),
    },
    embouts: [...document.querySelectorAll('.stat-bar img[src*="cap"]')]
      .map((e) => getComputedStyle(e).display),
    gouttiere: gouttiere === null ? null : {
      fond: getComputedStyle(gouttiere).backgroundColor,
      hauteur: Math.round(gouttiere.getBoundingClientRect().height),
    },
    //  Rien ne doit dépasser : un tableau à 100 % dans une page
    //  étroite est le débordement le plus courant.
    deborde: [...document.querySelectorAll("#modernbb *")]
      .filter((e) => e.getBoundingClientRect().right > document.documentElement.clientWidth + 1)
      .length,
    hauteurTable: Math.round(rect("table.forumline").height),
  };
});

console.log("\n── la page des statistiques ──");
//  C'EST LE DÉFAUT QU'ON VOYAIT EN PREMIER : le bleu de ModernBB
//  traversait la page entre les cellules.
ok(
  "le bleu de ModernBB n'est peint nulle part",
  vu.bleus === 0 && vu.fondTable !== "rgb(55, 147, 255)",
  { bleus: vu.bleus, fond: vu.fondTable },
);
ok(
  "les trois cellules de coin de 2007 ne prennent plus de ligne",
  vu.coins.length > 0 && vu.coins.every((d) => d === "none"),
  vu.coins,
);
ok(
  "l'en-tête porte la typographie du forum, pas celle de ModernBB",
  vu.enTete.police.includes("Fraunces") && vu.enTete.casse === "none" &&
    vu.enTete.fond !== "rgba(0, 0, 0, 0)",
  vu.enTete,
);
ok(
  "les cellules ne gardent pas les dix-huit pixels des cartes",
  vu.rembourrageCellule === "10px 16px",
  vu.rembourrageCellule,
);
//  Un damier ET des filets font double emploi, et le damier se voit
//  plus que les chiffres.
ok(
  "la zébrure de 2007 a disparu : toutes les cellules ont le même fond",
  vu.fondsDeLigne.length === 1,
  vu.fondsDeLigne,
);

console.log("\n── les barres ──");
//  LA DONNÉE EST DANS L'IMAGE : `width="91%"` sur celle du milieu. Si
//  on la cachait ou la remplaçait, la mesure disparaîtrait avec elle.
ok(
  "la barre garde sa valeur — 91 % de la gouttière",
  vu.barre !== null && Math.abs(vu.barre.part - 91) <= 1,
  vu.barre,
);
ok(
  "elle est peinte par nous, pas par l'image de 2007",
  vu.barre !== null && vu.barre.fond !== "rgba(0, 0, 0, 0)" && vu.barre.hauteur === 8,
  vu.barre,
);
//  Deux embouts par barre, et trois barres dans le tableau : six.
ok(
  "les embouts de 2007 sont retirés sur toutes les barres",
  vu.embouts.length === 6 && vu.embouts.every((d) => d === "none"),
  vu.embouts,
);
//  Sans gouttière, une valeur de 4 % est un trait perdu au milieu
//  d'une cellule vide : on ne voit pas par rapport à quoi.
ok(
  "et elle court dans une gouttière, pour qu'on voie le reste",
  vu.gouttiere !== null && vu.gouttiere.hauteur === 8 &&
    vu.gouttiere.fond !== "rgba(0, 0, 0, 0)",
  vu.gouttiere,
);

console.log("\n── la page tient ──");
ok("rien ne déborde à 1280", vu.deborde === 0, vu.deborde);

for (const largeur of [900, 620, 390]) {
  await p.setViewportSize({ width: largeur, height: 1000 });
  await p.waitForTimeout(80);
  const trop = await p.evaluate(() =>
    [...document.querySelectorAll("#modernbb *")]
      .filter((e) =>
        e.getBoundingClientRect().right > document.documentElement.clientWidth + 1
      )
      .map((e) => e.className).slice(0, 3)
  );
  ok(`rien ne déborde à ${largeur}`, trop.length === 0, trop);
}
await p.setViewportSize({ width: 1280, height: 1000 });

if (Deno.args.includes("--photo")) {
  for (const theme of ["clair", "sombre"]) {
    await p.evaluate(
      (t) => document.body.classList.toggle("wm-sombre", t === "sombre"),
      theme,
    );
    await p.waitForTimeout(80);
    await p.screenshot({ path: `${R}statistiques-${theme}.png` });
  }
  console.log("photos : statistiques-<thème>.png");
}

await p.close();
await nav.close();
console.log(soucis.length === 0 ? `\nTOUT PASSE (${passes}).` : `\n${soucis.length} DÉFAUT(S).`);
for (const s of soucis) console.log("  · " + s);
if (soucis.length > 0) Deno.exit(1);
