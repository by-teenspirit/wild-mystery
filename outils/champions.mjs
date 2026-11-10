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
    soustitres: [...e.querySelectorAll(".wm-annonce__soustitre")].map((x) => x.textContent.trim()),
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
dire("le premier message porte les onze postes, tous adressés",
  p1.combien === 11 && p1.sansAdresse === 0, JSON.stringify(p1.combien));
dire("ses quatre conditions sont dans quatre cadres",
  p1.cadres === 4, `${p1.cadres} cadres`);
dire("AUCUN ÉTAT N'EST COLLÉ À SON PALIER",
  p1.colles.length === 0, JSON.stringify(p1.colles));
dire("un seul poste est pris, les dix autres sont vacants",
  p1.etats.filter((x) => x === "poste pris").length === 1 &&
    p1.etats.filter((x) => x === "poste vacant").length === 10,
  JSON.stringify([...new Set(p1.etats)]));
//  LES DEUX TITRES COMPTENT EUX-MÊMES. « Sept arènes » et « Quatre
//  colosseums » étaient écrits en toutes lettres et deviendraient faux
//  le jour où une douzième arrive.
const sept = arenes.filter((a) => a.genre === "arene").length;
const quatre = arenes.filter((a) => a.genre === "colosseum").length;
dire("et les titres de section comptent ce qu'ils annoncent",
  p1.soustitres.some((t) => t.startsWith(["", "Une", "Deux", "Trois", "Quatre", "Cinq", "Six", "Sept"][sept])) &&
    p1.soustitres.some((t) => t.startsWith(["", "Une", "Deux", "Trois", "Quatre"][quatre])),
  JSON.stringify(p1.soustitres));
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
    //  La clé doit peser MOINS que sa valeur : c'est toute la
    //  hiérarchie qu'on est venu réparer.
    tailleCle: parseFloat(getComputedStyle(corps.querySelector(".wm-lexique__cle")).fontSize),
    tailleValeur: parseFloat(getComputedStyle(corps.querySelector(".wm-lexique__valeur")).fontSize),
    cleEnCapitales: getComputedStyle(corps.querySelector(".wm-lexique__cle")).textTransform,
    //  Chaque fiche porte sa pastille de type — le pont vers le
    //  premier message, qui nomme la même arène autrement.
    sansPastille: fiches.filter((f) => f.querySelector(".wm-lexique__repere .wm-type") === null).length,
    //  Les deux cadres de relations, alignés au bas de chaque fiche.
    cadres: [...new Set(fiches.map((f) => f.querySelectorAll(".wm-annonce__bloc").length))],
    basDesCadres: Object.entries(hauteursParLigne).length,
    debord: e.scrollWidth > e.clientWidth + 1,
  };
});
dire("le lexique porte les onze champions", p2.combien === 11);
dire("SUR DEUX COLONNES", p2.parLigne.every((n) => n === 2 || n === 1) && p2.parLigne.includes(2),
  JSON.stringify(p2.parLigne));
dire("et les fiches d'une même ligne ont la même hauteur",
  p2.lignesInegales === 0, `${p2.lignesInegales} ligne(s) inégale(s)`);
dire("l'état se lit avant le nom", p2.etatAvantNom);
dire("un seul champion est marqué joué", p2.joues === 1, `${p2.joues}`);
dire("chaque fiche porte sa pastille de type", p2.sansPastille === 0);
dire("LA CLÉ PÈSE MOINS QUE SA VALEUR, et elle est en capitales",
  p2.tailleCle < p2.tailleValeur && p2.cleEnCapitales === "uppercase",
  `${p2.tailleCle}px contre ${p2.tailleValeur}px`);
dire("affinités et rivalités sont deux cadres, sur chaque fiche",
  p2.cadres.length === 1 && p2.cadres[0] === 2, JSON.stringify(p2.cadres));
dire("rien ne déborde du lexique", !p2.debord);

// ── 3 · LES TEXTES SONT CEUX DE CALLISTA ────────────────────────────
//
//  LE SEUL CONTRÔLE QUI COMPTE VRAIMENT ICI. On a relevé ces onze
//  fiches sur le forum pour les mettre en données ; si une tournure
//  s'est perdue dans le passage, c'est son forum qu'on a réécrit.
const rendu = await p.evaluate(() =>
  [...document.querySelectorAll('[data-m="lexique"] .wm-lexique__fiche')].map((f) => ({
    nom: f.querySelector(".wm-lexique__nom").textContent.trim(),
    valeurs: [...f.querySelectorAll(".wm-lexique__valeur, .wm-annonce__bloc .wm-annonce__texte")]
      .map((x) => x.textContent.trim()),
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
  for (const t of [c.age, c.traits, c.affinites, c.rivalites]) {
    if (!f.valeurs.includes(t)) perdus.push(`${c.nomDuPoste} : « ${t} »`);
  }
}
dire("LES QUARANTE-QUATRE TEXTES SONT RENDUS MOT POUR MOT",
  perdus.length === 0, JSON.stringify(perdus.slice(0, 3)));

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
    valeur: rap(getComputedStyle(f0.querySelector(".wm-lexique__valeur")).color, fond),
    niveau: rap(getComputedStyle(f0.querySelector(".wm-lexique__niveau")).color, fond),
    etat: rap(
      getComputedStyle(f0.querySelector(".wm-lexique__etat")).color,
      getComputedStyle(f0.querySelector(".wm-lexique__etat")).backgroundColor,
    ),
  };
});
dire("EN SOMBRE, AUCUNE PLAQUE CLAIRE", sombre.clairs.length === 0, sombre.clairs.join(" · "));
dire("et les quatre textes d'une fiche tiennent les 4,5",
  [sombre.cle, sombre.valeur, sombre.niveau, sombre.etat].every((r) => r >= 4.5),
  JSON.stringify(sombre));

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
