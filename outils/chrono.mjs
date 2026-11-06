// ════════════════════════════════════════════════════════════════════
//  outils/chrono.mjs — la brique `wm-chrono`, mesurée
//
//      deno task chrono
//
//  CE QUE `contraste.mjs` NE PEUT PAS VOIR. Il mesure les couleurs et
//  les débordements de la page, et il les mesure bien : 64 textes, zéro
//  défaut dans les deux thèmes. Mais le point et le trait de cette
//  brique sont des PSEUDO-ÉLÉMENTS posés à une distance calculée, et
//  rien ne dit qu'ils tombent au bon endroit — un `calc` faux laisse la
//  page parfaitement lisible avec les points de travers.
//
//  Ce qu'on mesure ici, c'est donc la géométrie, et une seule chose
//  compte vraiment : QUE LE TRAIT RELIE LES POINTS. Un trait qui
//  s'arrête avant le point suivant fait huit traits séparés au lieu
//  d'une suite, et ça ne se voit qu'à l'œil ou ici.
// ════════════════════════════════════════════════════════════════════
import { readFileSync } from "node:fs";
import { chromium } from "npm:playwright@1.56.0";

const R = new URL("..", import.meta.url).pathname;
const lire = (c) => readFileSync(R + c, "utf8");
const PAGE = lire("pages/annexe-02-contexte.html");

let fautes = 0;
function ok(quoi, vrai, detail) {
  if (vrai) console.log(`  ok   ${quoi}`);
  else {
    fautes++;
    console.log(`  DÉFAUT ${quoi} — ${JSON.stringify(detail)}`);
  }
}

async function ouvrir(nav, { largeur = 1440, theme } = {}) {
  const p = await nav.newPage({
    viewport: { width: largeur, height: 1200 },
    ...(theme === undefined ? {} : { colorScheme: theme }),
  });
  await p.route("**/*", (q) => {
    const u = q.request().url();
    const f = (t, b) => q.fulfill({ contentType: t, body: b });
    if (/annexe-02/.test(u)) return f("text/html; charset=utf-8", PAGE);
    if (/jetons\.css$/.test(u)) return f("text/css", lire("panneau-admin/jetons.css"));
    if (/wild-mystery\.css$/.test(u)) return f("text/css", lire("css/wild-mystery.css"));
    if (/\/js\/annexes\.js$/.test(u)) return f("text/javascript", lire("js/annexes.js"));
    if (/\/data\/([a-z-]+)\.json$/.test(u)) {
      try {
        return f("application/json", lire(`data/${/\/data\/([a-z-]+)\.json$/.exec(u)[1]}.json`));
      } catch {
        return q.fulfill({ status: 404, body: "" });
      }
    }
    return q.fulfill({ status: 404, body: "" });
  });
  await p.goto("https://exemple.test/annexe-02", { waitUntil: "domcontentloaded" });
  await p.waitForSelector(".wm-chrono__moment", { timeout: 15000 });
  await new Promise((x) => setTimeout(x, 300));
  return p;
}

/** Le point, le trait, la date et le texte de chaque moment. */
const regarder = () =>
  Array.from(document.querySelectorAll(".wm-chrono__moment")).map((m) => {
    const b = m.getBoundingClientRect();
    const nombre = (v) => Math.round(parseFloat(v) * 100) / 100;
    const point = getComputedStyle(m, "::before");
    const trait = getComputedStyle(m, "::after");
    const quand = m.querySelector(".wm-chrono__quand").getBoundingClientRect();
    const quoi = m.querySelector(".wm-chrono__quoi").getBoundingClientRect();
    //  Les pseudo-éléments sont posés en absolu par rapport au moment :
    //  leur `left` et leur `top` se lisent donc depuis son coin.
    const px = b.left + nombre(point.left);
    const py = b.top + nombre(point.top);
    return {
      //  LE POINT, en coordonnées de page.
      point: {
        x: Math.round(px),
        y: Math.round(py),
        taille: nombre(point.width),
        hauteur: nombre(point.height),
        centre: Math.round(px + nombre(point.width) / 2),
        bas: Math.round(py + nombre(point.height)),
        couleur: point.backgroundColor,
      },
      //  LE TRAIT. `display: none` sur le dernier : on le dit.
      trait: trait.display === "none" ? null : {
        centre: Math.round(b.left + nombre(trait.left)),
        haut: Math.round(b.top + nombre(trait.top)),
        bas: Math.round(b.top + nombre(trait.top) + nombre(trait.height)),
        epaisseur: nombre(trait.width),
        couleur: trait.backgroundColor,
      },
      quand: {
        gauche: Math.round(quand.left),
        droite: Math.round(quand.right),
        large: Math.round(quand.width),
        mot: m.querySelector(".wm-chrono__quand").textContent.trim(),
        aligne: getComputedStyle(m.querySelector(".wm-chrono__quand")).textAlign,
        //  Combien de lignes la date occupe : sa hauteur divisée par
        //  son interligne. Deux, et elle se coupe.
        lignes: Math.round(
          quand.height / parseFloat(getComputedStyle(m.querySelector(".wm-chrono__quand")).lineHeight),
        ),
      },
      quoi: { gauche: Math.round(quoi.left), large: Math.round(quoi.width) },
      duree: m.classList.contains("wm-chrono__moment--duree"),
      debord: m.scrollWidth > Math.ceil(b.width) + 1,
    };
  });

const nav = await chromium.launch();

console.log("── la chronologie, à 1440 ──");
{
  const p = await ouvrir(nav);
  const vu = await p.evaluate(regarder);

  ok("la brique est rendue, avec ses moments", vu.length >= 3, vu.length);

  //  ── UN SEUL AXE ────────────────────────────────────────────────
  const axes = [...new Set(vu.map((m) => m.point.centre))];
  ok("tous les points tombent sur le même axe vertical", axes.length === 1, axes);

  //  ── LE POINT EST ENTRE LA DATE ET LE TEXTE ─────────────────────
  //  Ni sur l'une ni sur l'autre : c'est tout le dessin demandé —
  //  « à gauche la date, entre les deux un point ».
  ok(
    "et chacun tient dans l'écart, sans mordre la date ni le texte",
    vu.every((m) => m.point.x >= m.quand.droite && m.point.x + m.point.taille <= m.quoi.gauche),
    vu.slice(0, 2).map((m) => ({
      dateFinit: m.quand.droite, point: [m.point.x, m.point.x + m.point.taille],
      texteCommence: m.quoi.gauche,
    })),
  );

  //  ── LE TRAIT RELIE LES POINTS ──────────────────────────────────
  //
  //  LA MESURE QUI COMPTE. Le trait part sous son point et doit
  //  atteindre le suivant. Sans le `+ saut` dans sa hauteur il
  //  s'arrête à chaque fois, et huit moments font huit traits.
  const relies = vu.slice(0, -1).map((m, i) => ({
    i,
    partSousSonPoint: m.trait !== null && m.trait.haut >= m.point.bas - 1,
    atteintLeSuivant: m.trait !== null && m.trait.bas >= vu[i + 1].point.y - 1,
    manque: m.trait === null ? null : vu[i + 1].point.y - m.trait.bas,
  }));
  ok(
    "chaque trait part sous son point",
    relies.every((r) => r.partSousSonPoint),
    relies.filter((r) => !r.partSousSonPoint),
  );
  ok(
    "et descend jusqu'au point suivant, sans rupture",
    relies.every((r) => r.atteintLeSuivant),
    relies.filter((r) => !r.atteintLeSuivant),
  );
  ok(
    "le trait est sur l'axe des points",
    vu.slice(0, -1).every((m) => Math.abs(m.trait.centre - m.point.centre) <= 1),
    vu.slice(0, -1).map((m) => ({ trait: m.trait.centre, point: m.point.centre })),
  );
  //  ── ET IL S'ARRÊTE AU DERNIER ──────────────────────────────────
  //  Un trait qui dépasse le dernier point pend dans le vide.
  ok("le dernier moment n'a pas de trait", vu.at(-1).trait === null, vu.at(-1).trait);

  //  ── UNE PÉRIODE N'EST PAS UN INSTANT ───────────────────────────
  //
  //  « 2011 – 2020 » et « Juin 2026 » portaient le même rond. Le
  //  repère d'une période s'étire ; la classe est posée par le
  //  générateur, qui voit le tiret.
  const durees = vu.filter((m) => m.duree);
  const instants = vu.filter((m) => !m.duree);
  ok(
    "la page porte les deux sortes de moments",
    durees.length > 0 && instants.length > 0,
    { durees: durees.length, instants: instants.length },
  );
  ok(
    "le repère d'une période est plus haut que celui d'un instant",
    durees.every((d) => instants.every((i) => d.point.hauteur > i.point.hauteur)),
    { duree: durees[0]?.point.hauteur, instant: instants[0]?.point.hauteur },
  );
  //  MAIS IL GARDE LA MÊME LARGEUR, sinon l'axe se décale.
  ok(
    "et exactement la même largeur, pour ne pas sortir de l'axe",
    new Set(vu.map((m) => m.point.taille)).size === 1,
    vu.map((m) => m.point.taille),
  );

  //  ── LE PRÉSENT EST ALLUMÉ ──────────────────────────────────────
  //  Une liste d'annonces allume la plus fraîche, qui est en tête ;
  //  une chronologie finit par le présent.
  const couleurs = vu.map((m) => m.point.couleur);
  ok(
    "le dernier point porte l'accent, les autres non",
    new Set(couleurs.slice(0, -1)).size === 1 && couleurs.at(-1) !== couleurs[0],
    { avant: couleurs[0], dernier: couleurs.at(-1) },
  );

  //  ── LES DATES AU CORDEAU ───────────────────────────────────────
  ok(
    "les dates ont toutes la même colonne, alignée à droite",
    new Set(vu.map((m) => m.quand.large)).size === 1 &&
      new Set(vu.map((m) => m.quand.droite)).size === 1 &&
      vu.every((m) => m.quand.aligne === "right"),
    vu.map((m) => ({ large: m.quand.large, droite: m.quand.droite, aligne: m.quand.aligne })),
  );
  //  AUCUNE DATE NE SE COUPE EN DEUX. Une date sur deux lignes décale
  //  son texte sans décaler son point : la rangée part de travers, et
  //  c'est arrivé en passant la date de 11,5 à 13,5 px.
  ok(
    "aucune date ne se coupe en deux",
    vu.every((m) => m.quand.lignes === 1),
    vu.filter((m) => m.quand.lignes !== 1).map((m) => ({ date: m.quand.mot, lignes: m.quand.lignes })),
  );
  ok(
    "et les textes commencent tous au même endroit",
    new Set(vu.map((m) => m.quoi.gauche)).size === 1,
    vu.map((m) => m.quoi.gauche),
  );
  await p.close();
}

console.log("\n── à 390 ──");
{
  const p = await ouvrir(nav, { largeur: 390 });
  const vu = await p.evaluate(regarder);
  const debordPage = await p.evaluate(() =>
    document.documentElement.scrollWidth > window.innerWidth + 1
  );
  //  LA DATE NE PASSE PAS AU-DESSUS. L'alignement des points est tout
  //  l'intérêt du dessin : empiler la date le détruirait.
  ok(
    "la date reste à gauche du texte",
    vu.every((m) => m.quand.droite <= m.quoi.gauche),
    vu.map((m) => ({ date: m.quand.droite, texte: m.quoi.gauche })),
  );
  ok(
    "les points restent sur un seul axe",
    new Set(vu.map((m) => m.point.centre)).size === 1,
    vu.map((m) => m.point.centre),
  );
  ok(
    "et le trait relie toujours",
    vu.slice(0, -1).every((m, i) => m.trait !== null && m.trait.bas >= vu[i + 1].point.y - 1),
    vu.slice(0, -1).map((m, i) => (m.trait === null ? null : vu[i + 1].point.y - m.trait.bas)),
  );
  ok("rien ne déborde", !debordPage && vu.every((m) => !m.debord));
  await p.close();
}

await nav.close();
console.log(fautes === 0 ? "\nTOUT PASSE." : `\n${fautes} DÉFAUT(S).`);
Deno.exit(fautes === 0 ? 0 : 1);
