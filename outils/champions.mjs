// ════════════════════════════════════════════════════════════════════
//  outils/champions.mjs — les deux messages de t1002, mesurés
//
//  Ils étaient écrits à la main, et ça s'est vu : un `<br>` de
//  l'éditeur entre chaque `<li>`, et sur l'Arène Acier l'état collé au
//  palier — « PALIER 2POSTE VACANT ». Ils sont générés maintenant ; ce
//  harnais est ce qui empêche la même chose de revenir autrement.
//
//  IL LES MONTE DANS UN VRAI CORPS DE MESSAGE ModernBB, parce que
//  c'est là qu'ils vivent et que c'est là que les règles du forum
//  disputent les nôtres. Une mesure prise ailleurs ne dirait rien.
//
//  Lancé par `deno task champions`.
// ════════════════════════════════════════════════════════════════════

import { chromium } from "npm:playwright@1.56.0";
import { readFileSync } from "node:fs";

const R = new URL("..", import.meta.url).pathname;
const lire = (f) => readFileSync(R + f, "utf8");

const postes = lire("templates/champions-1-postes.min.html");
const lexique = lire("templates/champions-2-lexique.min.html");
const donnees = JSON.parse(lire("data/champions.json"));
const arenes = JSON.parse(lire("data/arenes.json")).arenes;

//  ── LES RÈGLES DE MODERNBB, RELEVÉES SUR LE FORUM ─────────────────
//
//  Pas inventées : mesurées le 10 novembre 2026 dans un vrai corps de
//  message de mysteryinrhode, en y insérant une balise nue et en
//  lisant son style calculé.
//
//  J'AVAIS ÉCRIT `padding-left: 24px` SUR LES LISTES. C'est faux : le
//  forum met `margin-left: 48px` et `padding: 0`. Un `padding` se
//  retranche du contenu, une `margin` pousse la boîte — et notre
//  `.wm-lexique` remet la marge à zéro mais n'avait rien à dire d'un
//  rembourrage. Le harnais retirait donc 24 px à chaque liste, et le
//  lexique y perdait sa deuxième colonne. UNE MESURE FAUSSE COÛTE PLUS
//  CHER QU'AUCUNE MESURE : celle-ci a failli me faire changer un
//  design qui allait bien.
//  ET LEUR SPÉCIFICITÉ COMPTE AUTANT QUE LEUR VALEUR. Écrites
//  `#modernbb .postbody .content ul`, elles passaient devant nos
//  règles de composant — ce que le forum NE FAIT PAS : sur la vraie
//  page, `.wm-postes` garde sa marge à zéro. Elles sont donc posées
//  au plus faible, `#modernbb ul`, ce qui reproduit l'ordre observé :
//  elles s'appliquent à une balise nue, et cèdent à la première
//  classe. La règle du `p`, elle, n'est pas d'eux — elle est à nous,
//  dans `05-sujet.css`, donc déjà dans la feuille montée.
const MODERNBB = `
#modernbb ul, #modernbb ol { margin: 0 0 16px 48px; padding: 0; }
#modernbb li { margin: 0; padding: 0; }
#modernbb h2 { margin: -3px 0 9px; padding: 0 0 3px; }
#modernbb h3 { margin: 0 0 12px; padding: 0 0 3px; }
`;

const page = `<!doctype html><html lang="fr"><head><meta charset="utf-8">
<style>${lire("panneau-admin/jetons.css")}</style>
<style>${MODERNBB}</style>
<style>${lire("css/wild-mystery.css")}</style>
<style>
  html, body { margin: 0; }
  body { background: var(--wm-fond-page); padding: 24px; }
  /*  586 px : la largeur RÉELLE d'un message sur le forum, relevée le
      10 novembre. C'est à cette largeur que les deux colonnes doivent
      tenir, pas à celle d'un écran de développement. */
  .essai { width: 586px; margin: 0 auto 48px; }
</style></head>
<body id="modernbb"><div id="page-body"><div class="post"><div class="postbody">
<div class="content">
<div class="essai" data-m="postes">${postes}</div>
<div class="essai" data-m="lexique">${lexique}</div>
</div></div></div></div></body></html>`;

const nav = await chromium.launch();
const p = await nav.newPage({ viewport: { width: 1000, height: 1200 } });
const soucis = [];
p.on("pageerror", (e) => soucis.push("erreur JS : " + e.message));
await p.route(
  "**/*",
  (r) =>
    r.request().resourceType() === "image"
      ? r.fulfill({
        contentType: "image/svg+xml",
        body: '<svg xmlns="http://www.w3.org/2000/svg" width="320" height="180"></svg>',
      })
      : r.fulfill({ contentType: "text/html; charset=utf-8", body: page }),
);
await p.goto("https://exemple.test/");

let fautes = 0;
const dire = (quoi, ok, detail = "") => {
  if (ok) console.log("  ok   " + quoi + (detail ? " — " + detail : ""));
  else {
    fautes += 1;
    console.log("   ✗ " + quoi + (detail ? " — " + detail : ""));
  }
};

// ── 1 · LES ONZE POSTES, ET RIEN DE COLLÉ ───────────────────────────
//
//  « PALIER 2POSTE VACANT » : l'état s'était collé au palier dans le
//  message écrit à la main. Ça ne se voit que si on mesure l'écart
//  entre les deux boîtes — le texte, lui, est parfaitement valide.
const p1 = await p.evaluate(() => {
  const e = document.querySelector('[data-m="postes"]');
  const liens = [...e.querySelectorAll("a.wm-poste")];
  return {
    combien: liens.length,
    sansAdresse: liens.filter((a) => !a.getAttribute("href")).length,
    cadres: e.querySelectorAll(".wm-annonce__bloc").length,
    soustitres: [...e.querySelectorAll(".wm-annonce__soustitre")].map((x) =>
      x.textContent.trim()
    ),
    //  L'écart entre les mots du poste et son état, sur chaque ligne.
    colles: liens.filter((a) => {
      const m = a.querySelector(".wm-poste__mots").getBoundingClientRect();
      const s = a.querySelector(".wm-poste__etat").getBoundingClientRect();
      return s.left - m.right < 8;
    }).map((a) => a.querySelector(".wm-poste__nom").textContent.trim()),
    etats: [...e.querySelectorAll(".wm-poste__etat")].map((x) => x.textContent.trim()),
    debord: e.scrollWidth > e.clientWidth + 1,
  };
});
dire(
  "le premier message porte les onze postes, tous adressés",
  p1.combien === 11 && p1.sansAdresse === 0,
  JSON.stringify(p1.combien),
);
dire("ses quatre conditions sont dans quatre cadres", p1.cadres === 4, `${p1.cadres} cadres`);
dire("AUCUN ÉTAT N'EST COLLÉ À SON PALIER", p1.colles.length === 0, JSON.stringify(p1.colles));
dire(
  "un seul poste est pris, les dix autres sont vacants",
  p1.etats.filter((x) => x === "poste pris").length === 1 &&
    p1.etats.filter((x) => x === "poste vacant").length === 10,
  JSON.stringify([...new Set(p1.etats)]),
);
//  LES DEUX TITRES COMPTENT EUX-MÊMES. « Sept arènes » et « Quatre
//  colosseums » étaient écrits en toutes lettres et deviendraient faux
//  le jour où une douzième arrive.
const sept = arenes.filter((a) => a.genre === "arene").length;
const quatre = arenes.filter((a) => a.genre === "colosseum").length;
dire(
  "et les titres de section comptent ce qu'ils annoncent",
  p1.soustitres.some((t) =>
    t.startsWith(["", "Une", "Deux", "Trois", "Quatre", "Cinq", "Six", "Sept"][sept])
  ) &&
    p1.soustitres.some((t) => t.startsWith(["", "Une", "Deux", "Trois", "Quatre"][quatre])),
  JSON.stringify(p1.soustitres),
);
dire("rien ne déborde du premier message", !p1.debord);

// ── 2 · LE LEXIQUE SUR DEUX COLONNES ────────────────────────────────
//
//  « Mets les champions sur 2 colonnes. » Une colonne se mesure : on
//  compte les abscisses distinctes des fiches d'une même ligne.
const p2 = await p.evaluate(() => {
  const e = document.querySelector('[data-m="lexique"]');
  const fiches = [...e.querySelectorAll(".wm-lexique__fiche")];
  const lignes = new Map();
  for (const f of fiches) {
    const r = f.getBoundingClientRect();
    const y = Math.round(r.top);
    lignes.set(y, (lignes.get(y) ?? 0) + 1);
  }
  const hauteursParLigne = {};
  for (const f of fiches) {
    const r = f.getBoundingClientRect();
    const y = Math.round(r.top);
    (hauteursParLigne[y] ??= []).push(Math.round(r.height));
  }
  const corps = fiches[0].querySelector(".wm-lexique__corps");
  return {
    combien: fiches.length,
    parLigne: [...new Set(lignes.values())],
    //  ── TOUTES LES FICHES ONT LA MÊME LARGEUR ─────────────────
    //
    //  « Le dernier bloc prend toute la largeur. » Ils sont onze :
    //  la onzième fiche se retrouve seule sur sa ligne, et en flex
    //  `flex-grow` la faisait s'étaler sur les deux colonnes. On
    //  compte les largeurs distinctes — il doit y en avoir UNE, et
    //  ça ne se vérifie qu'avec un nombre IMPAIR de fiches.
    largeurs: [...new Set(fiches.map((f) => Math.round(f.getBoundingClientRect().width)))],
    //  Les fiches d'une même rangée doivent faire la même hauteur.
    lignesInegales: Object.values(hauteursParLigne)
      .filter((h) => new Set(h).size > 1).length,
    //  L'état vient AVANT le nom : c'est ce qu'on cherche d'abord.
    etatAvantNom: fiches.every((f) => {
      const et = f.querySelector(".wm-lexique__etat");
      const nom = f.querySelector(".wm-lexique__nom");
      return et !== null && nom !== null &&
        (et.compareDocumentPosition(nom) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;
    }),
    joues: fiches.filter((f) => f.querySelector(".wm-lexique__etat--joue")).length,
    //  La clé doit peser MOINS que ce qu'elle annonce : c'est toute la
    //  hiérarchie qu'on est venu réparer.
    tailleCle: parseFloat(getComputedStyle(corps.querySelector(".wm-lexique__cle")).fontSize),
    tailleValeur: parseFloat(
      getComputedStyle(corps.querySelector(".wm-lexique__jeton")).fontSize,
    ),
    cleEnCapitales: getComputedStyle(corps.querySelector(".wm-lexique__cle")).textTransform,
    sansPastille: fiches.filter((f) =>
      f.querySelector(".wm-lexique__repere .wm-type") === null
    ).length,
    //  ── L'AFFICHE EST DEBOUT ──────────────────────────────────
    //
    //  « L'image fournie fonctionne mieux en vertical qu'en
    //  horizontal. » Elle était en 16/9 : d'une illustration debout,
    //  on ne voyait qu'une tranche du milieu. On mesure le rapport de
    //  la BOÎTE, parce que c'est lui qui décide du recadrage.
    affiches: [
      ...new Set(fiches.map((f) => {
        const r = f.querySelector(".wm-lexique__affiche").getBoundingClientRect();
        return Math.round((r.width / r.height) * 100) / 100;
      })),
    ],
    //  ON GARDE LE HAUT DE L'IMAGE : en raccourcissant l'affiche,
    //  `cover` centré ne laissait voir que la bande du milieu.
    //  `top center` se calcule en « 50% 0% » — on lit la verticale.
    ancrage: [
      ...new Set(fiches.map((f) =>
        getComputedStyle(f.querySelector(".wm-lexique__image")).objectPosition
      )),
    ],
    nomSurLImage: fiches.every((f) => {
      const img = f.querySelector(".wm-lexique__image").getBoundingClientRect();
      const nom = f.querySelector(".wm-lexique__nom").getBoundingClientRect();
      return nom.top >= img.top - 1 && nom.bottom <= img.bottom + 1;
    }),
    //  ── LES RELATIONS PORTENT LEUR PASTILLE ───────────────────
    //
    //  C'est ça, « plus visuel » : une affinité désigne une AUTRE
    //  arène, donc un autre type, et la pastille le dit sans qu'on
    //  ait à savoir par cœur que Samaragd est l'arène Plante.
    relations: fiches.map((f) => ({
      pour: f.querySelectorAll(
        ".wm-lexique__relations:not(.wm-lexique__relations--contre) .wm-lexique__relation",
      ).length,
      contre: f.querySelectorAll(".wm-lexique__relations--contre .wm-lexique__relation").length,
      sansPastille: [...f.querySelectorAll(".wm-lexique__relation")]
        .filter((r) => r.querySelector(".wm-type") === null).length,
      //  Creux contre plein : c'est ce qui sépare les deux familles,
      //  et ça ne se lit pas dans le HTML.
      pleines: [...f.querySelectorAll(
        ".wm-lexique__relations:not(.wm-lexique__relations--contre) .wm-lexique__relation",
      )].every((r) => getComputedStyle(r).backgroundColor !== "rgba(0, 0, 0, 0)"),
      creuses: [...f.querySelectorAll(".wm-lexique__relations--contre .wm-lexique__relation")]
        .every((r) => getComputedStyle(r).backgroundColor === "rgba(0, 0, 0, 0)"),
    })),
    jetons: fiches.map((f) => f.querySelectorAll(".wm-lexique__jeton").length),
    debord: e.scrollWidth > e.clientWidth + 1,
  };
});
dire("le lexique porte les onze champions", p2.combien === 11);
dire(
  "SUR DEUX COLONNES",
  p2.parLigne.every((n) => n === 2 || n === 1) && p2.parLigne.includes(2),
  JSON.stringify(p2.parLigne),
);
dire(
  "et les fiches d'une même ligne ont la même hauteur",
  p2.lignesInegales === 0,
  `${p2.lignesInegales} ligne(s) inégale(s)`,
);
dire(
  "et TOUTES font la même largeur, la onzième comprise",
  p2.largeurs.length === 1,
  `${p2.largeurs.length} largeur(s) : ${JSON.stringify(p2.largeurs)}`,
);
dire("l'état se lit avant le nom", p2.etatAvantNom);
dire("un seul champion est marqué joué", p2.joues === 1, `${p2.joues}`);
dire("chaque fiche porte sa pastille de type", p2.sansPastille === 0);
dire(
  "LA CLÉ PÈSE MOINS QUE SA VALEUR, et elle est en capitales",
  p2.tailleCle < p2.tailleValeur && p2.cleEnCapitales === "uppercase",
  `${p2.tailleCle}px contre ${p2.tailleValeur}px`,
);
dire(
  "L'AFFICHE EST CARRÉE, et on en garde le haut",
  p2.affiches.length === 1 && Math.abs(p2.affiches[0] - 1) < 0.02 &&
    p2.ancrage.length === 1 && /\s0%$/.test(p2.ancrage[0]),
  `${JSON.stringify(p2.affiches)} · ${JSON.stringify(p2.ancrage)}`,
);
dire("et le nom se pose SUR l'image", p2.nomSurLImage);
dire(
  "chaque fiche a ses deux affinités et ses deux rivalités",
  p2.relations.every((r) => r.pour === 2 && r.contre === 2),
  JSON.stringify(p2.relations.filter((r) => r.pour !== 2 || r.contre !== 2)),
);
dire(
  "CHAQUE RELATION PORTE LA PASTILLE DE L'ARÈNE QU'ELLE DÉSIGNE",
  p2.relations.every((r) => r.sansPastille === 0),
);
dire(
  "les affinités sont pleines, les rivalités creuses",
  p2.relations.every((r) => r.pleines && r.creuses),
);

// ── LES PASTILLES DE RELATION RESPIRENT ─────────────────────────────
//
//  « Laisse un minimum de padding à droite et à gauche des tags dans
//  les affinités et rivalités, y'en a pas assez. Pareil pour l'écart
//  entre l'icône et le nom. »
//
//  Elles étaient reprises des cases d'équipe, où six pastilles
//  doivent tenir dans cent pixels : un réglage de DISETTE, serré au
//  pixel, sans raison d'être ici. Le contrôle fixe un plancher, et il
//  mesure aussi ce qui reste — ce sont ces pixels disponibles qui
//  permettent de desserrer, et c'est eux qu'un nom d'arène plus long
//  mangerait un jour sans prévenir.
const souffle = await p.evaluate(() => {
  const rs = [...document.querySelectorAll('[data-m="lexique"] .wm-lexique__relation')];
  const s = getComputedStyle(rs[0].querySelector(".wm-type"));
  let pire = null;
  for (const r of rs) {
    const t = r.querySelector(".wm-type");
    const n = r.querySelector(".wm-lexique__lieu");
    const dispo = r.clientWidth - parseFloat(getComputedStyle(r).paddingLeft) * 2;
    const besoin = t.getBoundingClientRect().width + n.scrollWidth +
      parseFloat(getComputedStyle(r).gap);
    const marge = Math.round(dispo - besoin);
    if (pire === null || marge < pire.marge) pire = { mot: n.textContent.trim(), marge };
  }
  return {
    gauche: parseFloat(s.paddingLeft),
    droite: parseFloat(s.paddingRight),
    entre: parseFloat(s.columnGap || s.gap),
    ecartAuNom: parseFloat(getComputedStyle(rs[0]).columnGap || getComputedStyle(rs[0]).gap),
    //  Une relation tient sur UNE ligne : sinon le nom passe sous la
    //  pastille et la paire se désolidarise.
    surUneLigne: rs.every((r) => Math.round(r.getBoundingClientRect().height) <= 30),
    pire,
  };
});
dire(
  "la pastille d'une relation a six pixels à gauche et huit à droite",
  souffle.gauche >= 6 && souffle.droite >= 8,
  JSON.stringify(souffle),
);
dire(
  "et l'icône n'est collée ni à son nom, ni au nom de l'arène",
  souffle.entre >= 4 && souffle.ecartAuNom >= 8,
  JSON.stringify(souffle),
);
dire(
  "chaque relation tient sur une ligne, la plus longue avec de la marge",
  souffle.surUneLigne && souffle.pire.marge >= 8,
  JSON.stringify(souffle.pire),
);
dire(
  "les traits sont des jetons, un par mot",
  p2.jetons.every((n) => n >= 6),
  JSON.stringify([...new Set(p2.jetons)]),
);
dire("rien ne déborde du lexique", !p2.debord);

// ── 2 bis · UNE ÉTIQUETTE APPARTIENT À CE QU'ELLE ANNONCE ───────────
//
//  « Revoir les espacements entre eux, des fois on sent pas que le
//  titre va avec le bloc. » C'est la loi de proximité, et elle se
//  mesure : l'écart SOUS une étiquette doit être nettement plus petit
//  que l'écart AU-DESSUS, sinon l'œil ne sait pas à qui elle est.
//
//  ON MESURE D'ENCRE À ENCRE, pas de boîte à boîte. Une étiquette de
//  10 px dans une ligne de 13 porte trois pixels de vide invisible
//  sous elle, et un paragraphe de 11,5 dans une ligne de 19 en porte
//  presque quatre au-dessus : la marge déclarée ne dit pas ce qu'on
//  voit. C'est d'ailleurs ce qui rendait le défaut difficile à
//  trouver à l'œil nu — les marges avaient l'air justes.
//
//  RELEVÉ AVANT CORRECTION : « Ce qu'on demande » 28,9 contre 21,5,
//  soit 1,34 ; « Quatre colosseums » 7,5 contre 17,5, soit 0,43 —
//  INVERSÉ, le titre collait à la liste du dessus.
const proximite = await p.evaluate(() => {
  const encre = (el) => {
    const r = el.getBoundingClientRect();
    const s = getComputedStyle(el);
    const fs = parseFloat(s.fontSize);
    const lh = parseFloat(s.lineHeight) || fs * 1.2;
    const demi = (lh - fs) / 2;
    return {
      haut: r.top + parseFloat(s.paddingTop) + demi,
      bas: r.bottom - parseFloat(s.paddingBottom) - demi,
    };
  };
  const out = [];
  for (
    const et of document.querySelectorAll(
      ".wm-annonce__soustitre, .wm-lexique__cle",
    )
  ) {
    const suiv = et.nextElementSibling;
    const prec = et.previousElementSibling;
    //  Sans voisin au-dessus, il n'y a pas d'ambiguïté à lever.
    if (suiv === null || prec === null) continue;
    const e = encre(et);
    const dessus = Math.round((e.haut - encre(prec).bas) * 10) / 10;
    const dessous = Math.round((encre(suiv).haut - e.bas) * 10) / 10;
    out.push({
      mot: et.textContent.trim().slice(0, 24),
      dessus,
      dessous,
      ratio: Math.round((dessus / Math.max(dessous, 0.1)) * 100) / 100,
    });
  }
  const vus = new Set();
  return out.filter((x) => {
    if (vus.has(x.mot)) return false;
    vus.add(x.mot);
    return true;
  });
});
dire(
  `les ${proximite.length} étiquettes tiennent à ce qu'elles annoncent`,
  proximite.length >= 6 && proximite.every((x) => x.ratio >= 1.8),
  JSON.stringify(proximite.filter((x) => x.ratio < 1.8)),
);

// ── 3 · LES TEXTES SONT CEUX DE CALLISTA ────────────────────────────
//
//  LE SEUL CONTRÔLE QUI COMPTE VRAIMENT ICI. On a relevé ces onze
//  fiches sur le forum pour les mettre en données ; si une tournure
//  s'est perdue dans le passage, c'est son forum qu'on a réécrit.
const rendu = await p.evaluate(() =>
  [...document.querySelectorAll('[data-m="lexique"] .wm-lexique__fiche')].map((f) => ({
    nom: f.querySelector(".wm-lexique__nom").textContent.trim(),
    jetons: [...f.querySelectorAll(".wm-lexique__jeton")].map((x) => x.textContent.trim()),
    lieux: [...f.querySelectorAll(".wm-lexique__lieu")].map((x) => x.textContent.trim()),
  }))
);
const attendus = Object.values(donnees.champions);
const perdus = [];
for (const c of attendus) {
  const f = rendu.find((x) => x.nom === c.nomDuPoste);
  if (f === undefined) {
    perdus.push(`${c.nomDuPoste} : fiche absente`);
    continue;
  }
  //  ON RECOMPOSE LA PHRASE DE DÉPART à partir de ce qui est affiché,
  //  et on la compare mot pour mot. C'est plus sévère que de chercher
  //  les morceaux un par un : un mot perdu, un ordre changé, une
  //  virgule avalée, tout se voit.
  const recolle = {
    age: f.jetons[0],
    traits: f.jetons.slice(1).join(", "),
    affinites: f.lieux.slice(0, 2).join(" et "),
    rivalites: f.lieux.slice(2).join(" et "),
  };
  for (const champ of ["age", "traits", "affinites", "rivalites"]) {
    //  Le point final tombe à l'affichage — un jeton ne se ponctue
    //  pas — et c'est de la typographie, pas du texte en moins.
    if (recolle[champ] !== c[champ].replace(/\.$/, "")) {
      perdus.push(`${c.nomDuPoste} / ${champ} : « ${recolle[champ]} »`);
    }
  }
}
dire(
  "LES QUARANTE-QUATRE TEXTES SONT RENDUS MOT POUR MOT",
  perdus.length === 0,
  JSON.stringify(perdus.slice(0, 3)),
);

// ── 4 · EN SOMBRE, AUCUNE PLAQUE CLAIRE ─────────────────────────────
await p.evaluate(() => document.body.classList.add("wm-sombre"));
await p.waitForTimeout(150);
const sombre = await p.evaluate(() => {
  const lin = (c) => (c /= 255, c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const lum = (t) => {
    const [r, g, b] = (t.match(/[\d.]+/g) || []).slice(0, 3).map(Number);
    return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  };
  const clairs = [];
  for (
    const el of document.querySelectorAll(
      ".wm-annonce, .wm-lexique__fiche, .wm-annonce__bloc, .wm-lexique__etat, .wm-poste, .wm-encart",
    )
  ) {
    //  L'AFFICHE EST SOMBRE DANS LES DEUX THÈMES — c'est un dégradé
    //  posé sur une illustration, pas une couleur de thème. Une
    //  plaque claire y est donc VOULUE : c'est ainsi que la pastille
    //  « Joué » se détache. La règle qu'on protège ici est « pas de
    //  plaque claire sur une PAGE sombre », et le bandeau n'est pas
    //  la page. Son contraste à lui est mesuré juste en dessous.
    if (el.closest(".wm-lexique__bandeau") !== null) continue;
    const f = getComputedStyle(el).backgroundColor;
    if (!/rgba\(0, 0, 0, 0\)/.test(f) && lum(f) > 0.35) clairs.push(el.className + " → " + f);
  }
  const f0 = document.querySelector(".wm-lexique__fiche");
  const rap = (a, b) => {
    const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
    return Math.round(((hi + 0.05) / (lo + 0.05)) * 100) / 100;
  };
  const fond = getComputedStyle(f0).backgroundColor;
  return {
    clairs: [...new Set(clairs)],
    cle: rap(getComputedStyle(f0.querySelector(".wm-lexique__cle")).color, fond),
    valeur: rap(
      getComputedStyle(f0.querySelector(".wm-lexique__jeton")).color,
      getComputedStyle(f0.querySelector(".wm-lexique__jeton")).backgroundColor,
    ),
    niveau: rap(getComputedStyle(f0.querySelector(".wm-lexique__niveau")).color, fond),
    //  LA PASTILLE « JOUÉ » EST LA SEULE PLEINE, et c'est elle qu'il
    //  faut mesurer : « Libre » n'a qu'un contour, donc son texte se
    //  lit sur le dégradé, pas sur un fond à lui.
    etat: (() => {
      const j = document.querySelector(".wm-lexique__etat--joue");
      const s = getComputedStyle(j);
      return rap(s.color, s.backgroundColor);
    })(),
    etatLibre: (() => {
      const l = document.querySelector(".wm-lexique__etat--libre");
      return rap(
        getComputedStyle(l).color,
        getComputedStyle(l.closest(".wm-lexique__bandeau")).backgroundColor ===
            "rgba(0, 0, 0, 0)"
          ? "rgb(22, 16, 13)"
          : getComputedStyle(l.closest(".wm-lexique__bandeau")).backgroundColor,
      );
    })(),
  };
});
dire("EN SOMBRE, AUCUNE PLAQUE CLAIRE", sombre.clairs.length === 0, sombre.clairs.join(" · "));
dire(
  "et les quatre textes d'une fiche tiennent les 4,5",
  [sombre.cle, sombre.valeur, sombre.niveau, sombre.etat, sombre.etatLibre]
    .every((r) => r >= 4.5),
  JSON.stringify(sombre),
);

for (const s of soucis) {
  fautes += 1;
  console.log("   ✗ " + s);
}

console.log(
  "\n" + (fautes === 0 ? "TOUT PASSE." : `${fautes} défaut(s).`) +
    `  ${postes.length + lexique.length} caractères pour les deux messages.`,
);
await nav.close();
Deno.exit(fautes === 0 ? 0 : 1);
