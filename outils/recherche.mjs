// ════════════════════════════════════════════════════════════════════
//  outils/recherche.mjs — la page des résultats de recherche, dans un
//  vrai navigateur.
//
//  COUVRE : css/29-recherche.css
//
//      deno run -A outils/recherche.mjs
//      deno run -A outils/recherche.mjs --photo
//
//  ── CE QU'IL ÉPROUVE, ET POURQUOI DEUX LISTES ─────────────────────
//
//  La demande portait autant sur ce qu'il faut corriger que sur ce
//  qu'il ne faut PAS casser : « comment on pourrait faire sans venir
//  toucher aux catégories / liste des forums ? ». La page montée ici
//  porte donc LES DEUX listes côte à côte — celle de la recherche,
//  marquée `.search`, et celle d'un forum ordinaire qui ne l'est pas.
//  Chaque correction est vérifiée d'un côté ET son absence de l'autre.
//
//  Le balisage vient d'un relevé fait le 13 novembre dans le
//  navigateur de Callista, sur la vraie page : la page est derrière la
//  connexion, et on ne s'y connecte pas d'ici. Les mesures d'origine
//  qui ont servi à écrire la feuille sont dans son en-tête.
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

/** Une ligne de liste de sujets, telle que Forumactif l'écrit. */
const ligne = (n, titre, vues, reponses) => `
  <li class="row row${n % 2 === 0 ? 2 : 1}" data-wm-etat="lu">
    <dl class="icon">
      <span class="wm-pastille"></span>
      <dd class="dterm">
        <div class="topic-title-container">
          <a class="topic-title" href="/t${n}-x">${titre}</a>
        </div>
        <span class="topic-author"><a href="/u1">Maître du Jeu</a></span>
      </dd>
      <dd class="posts">${reponses}</dd>
      <dd class="views">${vues}</dd>
      <dd class="lastpost"><span><a href="/t${n}-x">Hier à 17:54</a></span></dd>
    </dl>
  </li>`;

const entete = `
  <ul class="topiclist topics">
    <li class="header">
      <dl class="icon">
        <dt><div class="list-inner">Sujets</div></dt>
        <dd class="posts">Réponses</dd>
        <dd class="views">Vues</dd>
        <dd class="lastpost"><span>Derniers Messages</span></dd>
      </dl>
    </li>
  </ul>`;

const PAGE = `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8">
<title>- Rechercher</title>
<link rel="stylesheet" href="/jetons.css"><link rel="stylesheet" href="/wild-mystery.css">
</head><body><div id="modernbb"><div class="wrap">

<!-- LA PAGE DE RECHERCHE : un en-tête seul, puis la liste marquée -->
<div class="forabg" id="recherche">
  ${entete}
  <ul class="topiclist topics search">
    ${ligne(1, "Un sujet sans réponse au titre un peu long", 8, 0)}
    ${ligne(2, "Un autre", 142, 1)}
  </ul>
</div>

<!-- UNE LISTE DE FORUM ORDINAIRE : rien ne doit lui arriver -->
<div class="forabg" id="forum">
  ${entete}
  <ul class="topiclist topics">
    ${ligne(3, "Un sujet de forum", 51, 12)}
  </ul>
</div>

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
  if (/\/recherche$/.test(u)) {
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
await p.goto("https://exemple.test/recherche", { waitUntil: "load" });
await p.waitForTimeout(150);

const vu = await p.evaluate(() => {
  const g = (s) => document.querySelector(s);
  const bord = (e) => {
    const b = e.getBoundingClientRect();
    return { g: Math.round(b.left), d: Math.round(b.right), h: Math.round(b.height) };
  };
  const mesurer = (ou) => {
    const dl = g(`${ou} li.row dl.icon`);
    //  L'icône d'état est un `::before` posé en absolu : on la situe
    //  par rapport à son `dl`, comme le navigateur le fait.
    const av = getComputedStyle(dl, "::before");
    const gauche = bord(dl).g + parseFloat(av.left);
    const titre = g(`${ou} li.row .topic-title`);
    const posts = g(`${ou} li.row dd.posts`);
    const views = g(`${ou} li.row dd.views`);
    const tete = g(`${ou} li.header`);
    return {
      //  L'ÉCART QU'ELLE A VU : de la fin de l'icône au début du titre.
      ecartIconeTitre: Math.round(bord(titre).g - (gauche + parseFloat(av.width))),
      //  De quoi lire un échec sans relancer : où est chaque pièce.
      ou: {
        dl: bord(dl).g,
        icone: [Math.round(gauche), Math.round(gauche + parseFloat(av.width))],
        titre: bord(titre).g,
        rembourrage: getComputedStyle(dl).paddingLeft,
        gouttiere: getComputedStyle(dl).columnGap,
        colonne1: getComputedStyle(dl).gridTemplateColumns.split(" ")[0],
      },
      enTeteVisible: tete !== null && tete.getBoundingClientRect().height > 0,
      etiquettes: [
        getComputedStyle(posts, "::before").content,
        getComputedStyle(views, "::before").content,
      ],
      //  Le mot doit être AVANT le chiffre, et sur la même ligne.
      memeLigne: Math.abs(bord(posts).h - bord(views).h) < 40,
      //  L'icône ne doit pas non plus être collée au bord de la ligne :
      //  48 px lui sont réservés, elle se pose au milieu.
      ecartIconeBord: Math.round(gauche - bord(dl).g),
      //  Un chiffre avec son étiquette dans une colonne de 104 px se
      //  fait rogner sans rien dire : on compare les deux largeurs.
      rognes: [posts, views].filter((d) => d.scrollWidth > d.clientWidth + 1).length,
      policeTitre: getComputedStyle(titre).fontFamily,
      hauteurLigne: bord(g(`${ou} li.row`)).h,
      colonnes: getComputedStyle(dl).gridTemplateColumns,
      //  Les deux chiffres restent lisibles et à leur place.
      chiffres: [posts.textContent.trim(), views.textContent.trim()],
    };
  };
  return {
    recherche: mesurer("#recherche"),
    forum: mesurer("#forum"),
    deborde: [...document.querySelectorAll("#modernbb *")]
      .filter((e) =>
        e.getBoundingClientRect().right > document.documentElement.clientWidth + 1
      ).length,
  };
});

console.log("\n── la page des résultats ──");
//  « L'icône à gauche est très loin du titre » : cent pixels mesurés
//  sur la vraie page, le 13 novembre.
ok(
  "l'icône n'est plus loin du titre",
  vu.recherche.ecartIconeTitre < 30,
  { ecart: vu.recherche.ecartIconeTitre, ...vu.recherche.ou },
);
ok(
  "et elle n'est pas collée au bord de la ligne",
  vu.recherche.ecartIconeBord >= 14,
  { ecart: vu.recherche.ecartIconeBord, ...vu.recherche.ou },
);
//  « Des colonnes sujets et vues tout en haut mais ça ne correspond à
//  rien » : l'en-tête vit dans une seconde liste et ne tombe en face
//  de rien.
ok(
  "l'en-tête qui n'annonçait rien a disparu",
  !vu.recherche.enTeteVisible,
  vu.recherche,
);
//  « On a le chiffre tout seul, sans le mot à côté. »
ok(
  "les deux chiffres portent leur mot",
  vu.recherche.etiquettes[0] === '"Réponses"' &&
    vu.recherche.etiquettes[1] === '"Vues"',
  vu.recherche.etiquettes,
);
ok(
  "et les chiffres eux-mêmes sont toujours là",
  JSON.stringify(vu.recherche.chiffres) === JSON.stringify(["0", "8"]),
  vu.recherche.chiffres,
);
ok(
  "et ni le mot ni le chiffre ne sont rognés",
  vu.recherche.rognes === 0,
  vu.recherche.rognes,
);
ok(
  "le titre porte la police du forum, plus celle de ModernBB",
  vu.recherche.policeTitre.includes("Fraunces"),
  vu.recherche.policeTitre,
);

console.log("\n── et la liste d'un forum ne bouge pas ──");
//  C'EST LA MOITIÉ DE LA DEMANDE : « sans venir toucher aux
//  catégories / liste des forums ». Chaque correction est vérifiée ici
//  EN NÉGATIF — si l'une d'elles débordait, ce bloc le dirait.
ok(
  "son en-tête est toujours là",
  vu.forum.enTeteVisible,
  vu.forum,
);
ok(
  "ses chiffres n'ont pas reçu d'étiquette",
  vu.forum.etiquettes.every((c) => c === "none" || c === "normal"),
  vu.forum.etiquettes,
);
ok(
  "et sa grille garde sa première colonne",
  vu.forum.colonnes !== vu.recherche.colonnes &&
    !vu.forum.colonnes.startsWith("0px"),
  { forum: vu.forum.colonnes, recherche: vu.recherche.colonnes },
);

console.log("\n── la page tient ──");
ok("rien ne déborde à 1280", vu.deborde === 0, vu.deborde);
for (const largeur of [900, 760, 390]) {
  await p.setViewportSize({ width: largeur, height: 1000 });
  await p.waitForTimeout(80);
  const trop = await p.evaluate(() =>
    [...document.querySelectorAll("#modernbb *")]
      .filter((e) =>
        e.getBoundingClientRect().right > document.documentElement.clientWidth + 1
      ).map((e) => e.className).slice(0, 3)
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
    await p.screenshot({ path: `${R}recherche-${theme}.png` });
  }
  console.log("photos : recherche-<thème>.png");
}

await p.close();
await nav.close();
console.log(soucis.length === 0 ? `\nTOUT PASSE (${passes}).` : `\n${soucis.length} DÉFAUT(S).`);
for (const s of soucis) console.log("  · " + s);
if (soucis.length > 0) Deno.exit(1);
