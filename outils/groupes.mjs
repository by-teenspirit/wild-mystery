// ════════════════════════════════════════════════════════════════════
//  outils/groupes.mjs — les six cartes de l'annexe 07, au rendu.
//
//  POURQUOI CE HARNAIS EXISTE depuis le 18 novembre : jusque-là les
//  six cartes portaient du lorem, et personne ne pouvait savoir si
//  elles tenaient le vrai texte. Elles ne le tenaient pas : à 340 px
//  de haut, on ne voyait plus que la légende.
//
//  CE QU'IL REGARDE :
//
//    · les six cartes font la même hauteur, trois par ligne ;
//    · les descriptions sont MOT POUR MOT celles de
//      `data/groupes.json` — c'est le texte de Callista, et un rendu
//      qui l'abrège sans le dire serait pire qu'un rendu cassé ;
//    · le nom anglais n'apparaît QUE là où il diffère : une seule
//      carte sur six, et jamais « Keldeo · Keldeo » ;
//    · l'avantage reste visible sans dérouler la carte, parce que
//      c'est la seule chose qui change quelque chose au jeu ;
//    · les quatre lignes de caractère sont là, et aucune ne porte de
//      bordure — « ne mets pas un border à gauche, ne mets ça nulle
//      part » ;
//    · rien ne déborde en largeur, à 1 440 comme à 390, dans les deux
//      thèmes.
//
//  IL SERT LA VRAIE PAGE, pas un décor : `pages/annexe-groupes.html`
//  tel qu'il sera collé sur le forum. Un décor recopié aurait vieilli
//  à la première génération.
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
const GROUPES = JSON.parse(readFileSync(R + "data/groupes.json", "utf8")).groupes;
//  LE NOMBRE DE QUESTIONS VIENT DU FICHIER, jamais d'un littéral :
//  il est passé de huit à neuf le 18 novembre, puis à douze le 19, et
//  un harnais qui compte à la main se tait exactement le jour où il
//  devrait parler.
const QUESTIONS = JSON.parse(readFileSync(R + "data/groupes.json", "utf8")).questionnaire;
const ANNEXE = readFileSync(R + "pages/annexe-groupes.html", "utf8");

const soucis = [];
const dire = (nom, ok, detail = "") => {
  console.log(`${ok ? "  ok  " : "DÉFAUT"} ${nom}${detail ? " — " + detail : ""}`);
  if (!ok) soucis.push(nom + (detail ? " — " + detail : ""));
};

const page = (theme) =>
  `<!doctype html><html lang="fr" data-wm-theme="${theme}"><head><meta charset="utf-8">
<style>${readFileSync(R + "panneau-admin/jetons.css", "utf8")}</style>
<style>${readFileSync(R + "css/wild-mystery.css", "utf8")}</style>
<style>body{margin:0;font-size:10px;background:var(--wm-fond-page)}#page-body{padding:24px}</style>
</head><body id="modernbb" class="${theme === "sombre" ? "wm-sombre" : ""}">
<div id="page-body">${ANNEXE}</div></body></html>`;

const nav = await chromium.launch(CHROME === undefined ? {} : { executablePath: CHROME });

/** Ouvre la page à la largeur voulue, dans le thème voulu.
 *
 *  LES IMAGES SONT SERVIES VIDES : l'illustration officielle vient de
 *  raw.githubusercontent, et un harnais qui dépend du réseau ne dit
 *  plus rien le jour où le réseau tombe. Le filigrane est un décor —
 *  ce qu'on mesure ici, c'est le texte. */
async function ouvrir(largeur, theme) {
  const p = await nav.newPage({ viewport: { width: largeur, height: 1200 } });
  p.on("pageerror", (e) => soucis.push("erreur JS : " + e.message));
  //  ── LE THÈME SE DEMANDE PAR LA PRÉFÉRENCE, PAS PAR UNE CLASSE ───
  //
  //  Le paquet pose `poserLeTheme` au chargement : il relit
  //  `wm.theme` dans le stockage et REMET la classe du corps d'après
  //  elle. Une classe écrite dans le gabarit était donc effacée une
  //  milliseconde plus tard, et la page « sombre » s'affichait en
  //  clair — le même piège que l'aperçu du 18 novembre au matin. On
  //  écrit donc la préférence, comme une personne qui clique.
  await p.addInitScript((t) => {
    try {
      localStorage.setItem("wm.theme", t);
    } catch { /* navigation privée : tant pis, on mesurera le clair */ }
  }, theme);
  await p.route("**/*", (r) => {
    const u = r.request().url();
    if (/\.(png|jpg|jpeg|gif|svg|webp)$/.test(u)) return r.fulfill({ status: 404, body: "" });
    //  LE VRAI PAQUET, pas un bouchon : le questionnaire vit dedans, et
    //  un harnais qui servirait un script vide mesurerait une page
    //  morte. Les autres fichiers servis vides restent vides — le
    //  switcheroo et compagnie n'ont rien à faire ici.
    if (/annexes\.js$/.test(u)) {
      return r.fulfill({
        contentType: "text/javascript",
        body: readFileSync(R + "js/annexes.js", "utf8"),
      });
    }
    if (/\.js$/.test(u)) return r.fulfill({ contentType: "text/javascript", body: "" });
    if (/\.json$/.test(u)) return r.fulfill({ status: 404, body: "" });
    return r.fulfill({ contentType: "text/html; charset=utf-8", body: page(theme) });
  });
  await p.goto("http://wild-mystery.test/annexe-07");
  await p.waitForTimeout(300);
  return p;
}

/** Coche une colonne de réponses pour les huit questions.
 *
 *  `colonne` va de 1 à 4. On clique le `label`, pas l'`input` : c'est
 *  ce que fait une personne, et c'est le chemin qui casserait si le
 *  label cessait d'être lié à son bouton. */
async function repondre(p, colonne) {
  for (let n = 1; n <= QUESTIONS.length; n++) {
    await p.click(`label[for="wm-q${n}-${colonne}"]`);
  }
  //  LES BARRES GLISSENT EN 220 ms. Mesurer avant la fin donnerait la
  //  largeur d'un instant quelconque de l'animation — c'est ce qu'un
  //  premier passage a fait, en annonçant 57 % pour une jauge à 67.
  await p.waitForTimeout(400);
}

function lireLesJauges(p) {
  return p.evaluate(() => {
    const racine = document.querySelector("[data-wm-questionnaire]");
    return {
      fini: racine?.dataset.wmFini ?? null,
      verdict: racine?.querySelector("[data-wm-resultat]")?.textContent?.trim() ?? null,
      jauges: [...racine.querySelectorAll("[data-wm-jauge]")].map((j) => ({
        cle: j.dataset.wmJauge,
        part: j.querySelector(".wm-sonde__part").textContent,
        //  LA LARGEUR PEINTE, pas celle écrite : c'est elle qu'on voit,
        //  et c'est elle qui trahirait une barre à 140 %.
        large: Math.round(j.querySelector(".wm-sonde__barre").getBoundingClientRect().width),
        piste: Math.round(j.querySelector(".wm-sonde__piste").getBoundingClientRect().width),
        tete: j.dataset.wmTete === "oui",
        rang: Number(getComputedStyle(j).order),
      })),
    };
  });
}

// ── 1 440 px, THÈME CLAIR ───────────────────────────────────────────

console.log("\n── LES SIX CARTES À 1 440 ──────────────────────────────");
const large = await ouvrir(1440, "clair");

const vu = await large.evaluate(() => {
  const cartes = [...document.querySelectorAll(".wm-groupe")];
  return {
    combien: cartes.length,
    hauteurs: cartes.map((c) => Math.round(c.getBoundingClientRect().height)),
    //  TROIS PAR LIGNE : on le lit sur les abscisses, pas sur le CSS.
    //  Trois cartes partagent le même haut, trois autres un autre.
    lignes: [...new Set(cartes.map((c) => Math.round(c.getBoundingClientRect().top)))].length,
    cartes: cartes.map((c) => ({
      nom: c.querySelector(".wm-groupe__nom")?.textContent ?? null,
      espece: c.querySelector(".wm-groupe__espece")?.textContent ?? null,
      anglais: c.querySelector(".wm-groupe__espece [lang=en]")?.textContent ?? null,
      dit: c.querySelector(".wm-groupe__dit")?.textContent ?? null,
      question: c.querySelector(".wm-groupe__question")?.textContent ?? null,
      traits: [...c.querySelectorAll(".wm-groupe__traits dt")].map((t) => t.textContent),
      valeurs: [...c.querySelectorAll(".wm-groupe__traits dd")].map((t) => t.textContent),
      //  L'AVANTAGE EST-IL DANS LA CARTE, SANS DÉROULER ? On compare
      //  son rectangle à celui de la carte, pas sa position dans le
      //  DOM : il est hors du défilement, c'est le point à prouver.
      avantageVisible: (() => {
        const a = c.querySelector(".wm-groupe__avantage");
        if (a === null) return false;
        const rc = c.getBoundingClientRect();
        const ra = a.getBoundingClientRect();
        return ra.top >= rc.top && ra.bottom <= rc.bottom + 1;
      })(),
      //  AUCUNE BORDURE SUR LES LIGNES DE CARACTÈRE.
      bordures: [
        ...c.querySelectorAll(
          ".wm-groupe__traits, .wm-groupe__traits dt, .wm-groupe__traits dd",
        ),
      ]
        .map((e) => {
          const s = getComputedStyle(e);
          return [s.borderTopWidth, s.borderRightWidth, s.borderBottomWidth, s.borderLeftWidth]
            .map((w) => parseFloat(w) || 0)
            .reduce((a, b) => a + b, 0);
        })
        .reduce((a, b) => a + b, 0),
      debordeEnLargeur: c.scrollWidth > c.clientWidth + 1,
    })),
  };
});

dire("LES SIX CARTES SONT LÀ", vu.combien === 6, `${vu.combien} cartes`);
dire(
  "sur deux lignes de trois",
  vu.lignes === 2,
  `${vu.lignes} ligne(s) de hauts différents`,
);
dire(
  "ET ELLES FONT TOUTES LA MÊME HAUTEUR",
  new Set(vu.hauteurs).size === 1,
  JSON.stringify(vu.hauteurs),
);

//  ── LE TEXTE EST CELUI DE CALLISTA, MOT POUR MOT ──────────────────
//
//  « Les descriptions, on touchent pas. » Le harnais compare donc le
//  rendu à `data/groupes.json` caractère par caractère : c'est la
//  seule façon de prouver qu'aucune génération ne l'a raboté.
const dits = vu.cartes.map((c) => c.dit);
const attendus = GROUPES.map((g) => g.description);
dire(
  "LES SIX DESCRIPTIONS SONT CELLES DU FICHIER, MOT POUR MOT",
  JSON.stringify(dits) === JSON.stringify(attendus),
  dits.map((d, i) => (d === attendus[i] ? "=" : `≠ ${GROUPES[i].cle}`)).join(" "),
);
dire(
  "et chaque carte pose sa question",
  vu.cartes.every((c, i) => c.question === GROUPES[i].question),
  vu.cartes.map((c) => c.question).join(" | "),
);

//  ── LES DEUX NOMS, ET SEULEMENT OÙ IL EN FAUT DEUX ────────────────
const avecAnglais = vu.cartes.filter((c) => c.anglais !== null);
dire(
  "UN SEUL NOM ANGLAIS, SUR LE GROUPE QUI EN A BESOIN",
  avecAnglais.length === 1 && avecAnglais[0].anglais === "Uxie",
  JSON.stringify(avecAnglais.map((c) => c.espece)),
);
dire(
  "ET AUCUNE CARTE NE RÉPÈTE LE MÊME NOM DEUX FOIS",
  vu.cartes.every((c) => {
    const mots = (c.espece ?? "").split("·").map((m) => m.trim());
    return new Set(mots).size === mots.length;
  }),
  vu.cartes.map((c) => c.espece).join(" | "),
);
dire(
  "les six emblèmes sont nommés",
  vu.cartes.every((c, i) => (c.espece ?? "").startsWith(GROUPES[i].espece)),
  vu.cartes.map((c) => c.espece).join(" | "),
);

//  ── LES QUATRE LIGNES DE CARACTÈRE ────────────────────────────────
dire(
  "CHAQUE CARTE A SES QUATRE LIGNES DE CARACTÈRE",
  vu.cartes.every((c) => c.traits.length === 4 && c.valeurs.length === 4),
  vu.cartes.map((c) => c.traits.length).join(" "),
);
dire(
  "et aucune ne porte de bordure",
  vu.cartes.every((c) => c.bordures === 0),
  vu.cartes.map((c) => c.bordures).join(" "),
);

//  ── L'AVANTAGE NE DISPARAÎT PAS ───────────────────────────────────
dire(
  "L'AVANTAGE RESTE VISIBLE SANS DÉROULER LA CARTE",
  vu.cartes.every((c) => c.avantageVisible === true),
  vu.cartes.map((c, i) => (c.avantageVisible ? "" : GROUPES[i].cle)).join(" "),
);
dire(
  "et rien ne déborde en largeur",
  vu.cartes.every((c) => c.debordeEnLargeur === false),
  "",
);

// ── LE QUESTIONNAIRE ────────────────────────────────────────────────
//
//  « Le petit questionnaire que la personne peut remplir facilement, et
//  lui donner le résultat vers quel groupe elle tend le plus, avec des
//  jauges. » On le remplit vraiment, en cliquant, et on lit ce qui
//  s'affiche.

console.log("\n── LE QUESTIONNAIRE ────────────────────────────────────");

const avant = await lireLesJauges(large);
dire(
  "AVANT DE RÉPONDRE, SIX JAUGES À ZÉRO",
  avant.jauges.length === 6 && avant.jauges.every((j) => j.large === 0),
  JSON.stringify(avant.jauges.map((j) => j.part)),
);
dire(
  "et la phrase compte ce qui reste, sans désigner personne",
  avant.fini === "non" &&
    new RegExp(`${QUESTIONS.length} questions`).test(avant.verdict ?? ""),
  String(avant.verdict),
);

//  UNE SEULE RÉPONSE : deux tiers / un tiers, c'est toute la mécanique,
//  et c'est le moment où une erreur de poids se verrait le mieux.
await large.click('label[for="wm-q1-1"]');
await large.waitForTimeout(400);
const une = await lireLesJauges(large);
//  LES DEUX NATURES VIENNENT DE LA PREMIÈRE RÉPONSE DU FICHIER, pas
//  de deux noms recopiés ici : c'est le couple que la page doit
//  remplir, et il change quand le texte change.
const CLE2 = QUESTIONS[0].reponses[0].premier;
const CLE1 = QUESTIONS[0].reponses[0].second;
const brave = une.jauges.find((j) => j.cle === CLE2);
const doux = une.jauges.find((j) => j.cle === CLE1);
dire(
  "UNE RÉPONSE REMPLIT DEUX JAUGES, PAS UNE",
  brave?.part === "67 %" && doux?.part === "33 %",
  JSON.stringify({ [CLE2]: brave?.part, [CLE1]: doux?.part }),
);
dire(
  "et le trait suit le pourcentage, au pixel",
  //  ON COMPARE À DEUX TIERS, PAS À 0,67 : la barre prend la part
  //  EXACTE, le texte la part arrondie. Comparer le trait au nombre
  //  affiché faisait rater de deux pixels et demi une jauge juste —
  //  c'est le harnais qui arrondissait, pas la page.
  brave !== undefined && Math.abs(brave.large - brave.piste * (2 / 3)) <= 2,
  `${brave?.large} px sur une piste de ${brave?.piste}`,
);
dire(
  "LA TÊTE EST MARQUÉE, ET ELLE EST SEULE",
  une.jauges.filter((j) => j.tete).length === 1 &&
    une.jauges.find((j) => j.tete)?.cle === CLE2,
  une.jauges.filter((j) => j.tete).map((j) => j.cle).join(" · "),
);
dire(
  "elle est remontée en tête de liste",
  une.jauges.find((j) => j.cle === CLE2)?.rang === 0,
  JSON.stringify(une.jauges.map((j) => [j.cle, j.rang])),
);
dire(
  "MAIS LE VERDICT ATTEND TOUTES LES AUTRES",
  une.fini === "non" &&
    new RegExp(`${QUESTIONS.length - 1} questions`).test(une.verdict ?? ""),
  String(une.verdict),
);

//  TOUTE LA COLONNE 1. C'est un passage complet, celui qu'une
//  personne fera.
await repondre(large, 1);
const plein = await lireLesJauges(large);
const somme = plein.jauges.reduce((a, j) => a + parseInt(j.part, 10), 0);
dire(
  "TOUTES RÉPONDUES, LE VERDICT DÉSIGNE UN GROUPE",
  plein.fini === "oui" && /penches vers|tirent autant/.test(plein.verdict ?? ""),
  String(plein.verdict),
);
dire(
  "et les six pourcentages font cent, à l'arrondi près",
  Math.abs(somme - 100) <= 2,
  `${somme} %`,
);
dire(
  "AUCUNE JAUGE NE DÉBORDE DE SA PISTE",
  plein.jauges.every((j) => j.large <= j.piste + 1),
  JSON.stringify(plein.jauges.map((j) => `${j.large}/${j.piste}`)),
);
dire(
  "et les jauges sont rangées de la plus haute à la plus basse",
  (() => {
    const parts = [...plein.jauges].sort((a, b) => a.rang - b.rang)
      .map((j) => parseInt(j.part, 10));
    return parts.every((n, i) => i === 0 || parts[i - 1] >= n);
  })(),
  JSON.stringify(
    [...plein.jauges].sort((a, b) => a.rang - b.rang).map((j) => `${j.cle} ${j.part}`),
  ),
);

//  ── L'EX-ÆQUO SE DIT ──────────────────────────────────────────────
//
//  « Sauf si y'en a deux à ex-æquo. » On le provoque : quatre fois la
//  réponse qui met Hardi devant Doux, quatre fois celle qui fait
//  l'inverse — à construire depuis le fichier, parce qu'un numéro de
//  colonne écrit ici vieillirait au premier remaniement des questions.
const EXAEQUO = (() => {
  const q = JSON.parse(readFileSync(R + "data/groupes.json", "utf8")).questionnaire;
  //  On cherche deux réponses miroir : A devant B, et B devant A.
  for (let i = 0; i < q.length; i++) {
    for (let j = 0; j < q.length; j++) {
      if (i === j) continue;
      for (let a = 0; a < 4; a++) {
        for (let b = 0; b < 4; b++) {
          const ra = q[i].reponses[a], rb = q[j].reponses[b];
          if (ra.premier === rb.second && ra.second === rb.premier) {
            return {
              a: { q: i + 1, r: a + 1 },
              b: { q: j + 1, r: b + 1 },
              cles: [ra.premier, ra.second],
            };
          }
        }
      }
    }
  }
  return null;
})();

if (EXAEQUO === null) {
  dire("DEUX RÉPONSES MIROIR EXISTENT, pour provoquer l'ex-æquo", false, "aucune trouvée");
} else {
  await large.click("[data-wm-recommencer]");
  await large.waitForTimeout(400);
  await large.click(`label[for="wm-q${EXAEQUO.a.q}-${EXAEQUO.a.r}"]`);
  await large.click(`label[for="wm-q${EXAEQUO.b.q}-${EXAEQUO.b.r}"]`);
  await large.waitForTimeout(400);
  const ex = await lireLesJauges(large);
  const tetes = ex.jauges.filter((j) => j.tete).map((j) => j.cle).sort();
  dire(
    "DEUX RÉPONSES MIROIR METTENT DEUX GROUPES À ÉGALITÉ",
    JSON.stringify(tetes) === JSON.stringify([...EXAEQUO.cles].sort()),
    `${tetes.join(" · ")} (attendu ${[...EXAEQUO.cles].sort().join(" · ")})`,
  );
  //  LE VERDICT NE TRANCHE PAS. Il ne peut pas : rien ne les sépare.
  //  Mais il ne reste pas muet non plus — il le DIT, et il rend la
  //  main. C'est tout l'objet de « sauf si y'en a deux à ex-æquo ».
  await repondre(large, 1);
  await large.click("[data-wm-recommencer]");
  await large.waitForTimeout(400);
  const remis = await lireLesJauges(large);
  dire(
    "« TOUT EFFACER » REMET VRAIMENT TOUT À ZÉRO",
    remis.fini === "non" && remis.jauges.every((j) => j.large === 0 && j.tete === false),
    JSON.stringify({
      fini: remis.fini,
      larges: remis.jauges.map((j) => j.large),
      tetes: remis.jauges.filter((j) => j.tete).map((j) => j.cle),
    }),
  );
}

await large.close();

// ── 390 px, LE TÉLÉPHONE ────────────────────────────────────────────
//
//  « On touche à rien pour la version mobile » : ce qui est vérifié
//  ici, c'est justement qu'on n'a rien cassé — une colonne, et pas de
//  débordement horizontal de la page.

console.log("\n── À 390 ───────────────────────────────────────────────");
const etroit = await ouvrir(390, "clair");
const vuEtroit = await etroit.evaluate(() => ({
  colonnes: [
    ...new Set(
      [...document.querySelectorAll(".wm-groupe")].map((c) =>
        Math.round(c.getBoundingClientRect().left)
      ),
    ),
  ].length,
  pageDeborde: document.documentElement.scrollWidth > globalThis.innerWidth + 1,
  plusLarge: Math.max(
    ...[...document.querySelectorAll(".wm-groupe")].map((c) =>
      Math.round(c.getBoundingClientRect().width)
    ),
  ),
}));
dire("UNE SEULE COLONNE", vuEtroit.colonnes === 1, `${vuEtroit.colonnes}`);
dire(
  "ET LA PAGE NE DÉBORDE PAS",
  vuEtroit.pageDeborde === false,
  `carte la plus large : ${vuEtroit.plusLarge} px`,
);
await etroit.close();

// ── LE THÈME SOMBRE ─────────────────────────────────────────────────
//
//  Les couleurs des six groupes viennent des jetons du panneau
//  d'administration, que le thème sombre redéfinit. Ce qui se vérifie
//  ici, c'est que les NOUVELLES lignes les nomment aussi, au lieu
//  d'une couleur écrite qui resterait claire.

console.log("\n── LE THÈME SOMBRE ─────────────────────────────────────");
const sombre = await ouvrir(1440, "sombre");
const vuSombre = await sombre.evaluate(() => {
  const dedans = (c) => c.split(/[(,)]/).slice(1, 4).map((n) => parseFloat(n));
  const clair = (c) => {
    const [r, v, b] = dedans(c);
    return (0.2126 * r + 0.7152 * v + 0.0722 * b) / 255;
  };
  const carte = document.querySelector(".wm-groupe");
  return {
    fond: getComputedStyle(carte).backgroundColor,
    fondClair: clair(getComputedStyle(carte).backgroundColor),
    espece: getComputedStyle(carte.querySelector(".wm-groupe__espece")).color,
    trait: getComputedStyle(carte.querySelector(".wm-groupe__traits dd")).color,
    traitClair: clair(getComputedStyle(carte.querySelector(".wm-groupe__traits dd")).color),
  };
});
//  LE SENS COMPTE, PAS LA VALEUR : sur un fond sombre, le texte doit
//  être PLUS clair que lui. Un seuil chiffré ici doublerait
//  `outils/contraste.mjs`, qui fait ce calcul pour toute la charte.
dire(
  "SUR FOND SOMBRE, LE TEXTE DES LIGNES EST PLUS CLAIR QUE LE FOND",
  vuSombre.traitClair > vuSombre.fondClair,
  JSON.stringify(vuSombre),
);
await sombre.close();

await nav.close();

console.log("");
if (soucis.length === 0) console.log("TOUT PASSE.");
else {
  console.log(`${soucis.length} défaut(s) :`);
  for (const s of soucis) console.log(`  · ${s}`);
  Deno.exit(1);
}
