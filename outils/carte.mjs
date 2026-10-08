// ════════════════════════════════════════════════════════════════════
//  outils/carte.mjs — la carte des territoires, dans un vrai
//  navigateur.
//
//  CE QUE CE HARNAIS REGARDE, et qu'aucun test sans navigateur ne
//  pourrait voir :
//
//    · les vingt-six lieux sont dessinés ET listés — les deux, parce
//      que la liste est la version lisible de la carte ;
//    · le palier est ÉCRIT partout où une couleur le dit. C'est
//      l'assertion qui compte le plus : un joueur sur douze ne
//      distingue pas les trois teintes ;
//    · un clic sur une tache remplit le panneau ; un clic dans la
//      liste fait la même chose ;
//    · les chiffres des villes viennent de la PAGE, ceux des zones
//      des TROIS pages de palier, et une page de palier injoignable
//      ne coûte que ses chiffres ;
//    · on traîne la carte et elle s'arrête à ses bords ;
//    · rien ne déborde, à 1 440 comme à 390.
//
//  LE DÉCOR REPRODUIT L'INDEX RÉEL, balisage de ModernBB compris —
//  le `<div>` à style en ligne, les deux `<br>`, le `<dfn>` dans les
//  compteurs. Un harnais ne vaut que ce que son décor reproduit, et
//  c'est une leçon déjà payée deux fois sur ce projet.
// ════════════════════════════════════════════════════════════════════

import { readFileSync } from "node:fs";
import { chromium } from "npm:playwright@1.49.1";

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

/** Une ligne de forum, au balisage de ModernBB. */
const ligne = (f, nom, desc, sujets, messages, sousForums = []) => `
  <li class="row"><dl class="icon">
    <dd class="dterm"><div style="display: block; margin : 0 0px 0 45px;"><h3 class="hierarchy"><a href="/f${f}-${
  nom.toLowerCase().replace(/[^a-z]+/g, "-")
}" class="forumtitle">${nom}</a></h3>${desc}<br><br>${
  sousForums.map((s) => `<a class="gensmall" href="/f${s[0]}-x">${s[1]}</a>`).join(", ")
}<strong></strong></div></dd>
    <dd class="topics">${sujets} <dfn>Sujets</dfn></dd>
    <dd class="posts">${messages} <dfn>Messages</dfn></dd>
    <dd class="lastpost"><span class="lastpost-avatar"><img src="data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20width='35'%20height='56'%3E%3C/svg%3E" alt="avatar"></span><span class="lastpost-infos"><a href="/t1-un-sujet" title="Un sujet">Un sujet de ${nom}</a><br>Mar 2 Avr 2024 - 18:50<br>Maître du Jeu&nbsp;<a href="/t1-un-sujet#1" class="last-post-icon"><img src="data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20width='9'%20height='9'%3E%3C/svg%3E" alt=""></a></span></dd>
  </dl></li>`;

const bloc = (titre, lignes) => `
<div class="forabg"><ul class="topiclist"><li class="header"><dl class="icon">
  <dd class="dterm"><div class="table-title"><h2>${titre}</h2></div></dd>
  <dd class="topics">Sujets</dd><dd class="posts">Messages</dd><dd class="lastpost"><span>Dernier</span></dd>
</dl></li></ul><ul class="topiclist forums">${lignes.join("")}</ul></div>`;

const VILLES = [
  [12, "Pyrite", 11, 42],
  [16, "Tour Titanite", 3, 9],
  [5, "Phenacit", 0, 0],
  [15, "Suerebe", 2, 6],
  [13, "Port-Amaree", 7, 19],
  [17, "Ile Tenebra", 1, 3],
  [14, "Samaragd", 4, 12],
  [18, "Station Service", 5, 31],
];

const index = `<!doctype html><html lang="fr"><head><meta charset="utf-8">
<style>${readFileSync(R + "panneau-admin/jetons.css", "utf8")}</style>
<style>${readFileSync(R + "css/wild-mystery.css", "utf8")}</style>
<style>body{margin:0;font-size:10px;background:var(--wm-fond-page)}#page-body{padding:24px}</style>
</head><body id="modernbb"><div id="page-body">
${
  bloc(
    "Zone staff",
    [ligne(47, "Archives", "Les vieux sujets.", 26, 36)],
  )
}
${
  bloc(
    "Les Villes de Rhode",
    VILLES.map(([f, n, s, m]) =>
      ligne(f, n, `La description de ${n}.`, s, m, [[900 + f, "Arène"], [930 + f, "Colosseum"]])
    ),
  )
}
${
  bloc("Zones Sauvages", [
    ligne(96, "Zones Palier 1", "Les six premières.", 2, 5, [[9, "Forêt Marécageuse"], [
      34,
      "Montagnes Embrumées",
    ]]),
    ligne(97, "Zones Palier 2", "Les six suivantes.", 0, 0, [[37, "Canyon Lekro"]]),
    ligne(98, "Zones Palier 3", "Les cinq dernières.", 0, 0, [[103, "Monts Enneigés"]]),
    ligne(65, "Mont Bataille", "La Ligue.", 0, 0),
  ])
}
</div></body></html>`;

/** Une page de palier : le MÊME gabarit `index_box`, et c'est pour ça
 *  qu'on peut la lire avec le même analyseur. */
const palier = (lignes) =>
  `<!doctype html><html><body id="modernbb">${bloc("Zones", lignes)}</body></html>`;

const PALIER1 = palier([
  ligne(9, "Foret Marecageuse", "Des racines dans l'eau noire.", 14, 61),
  ligne(34, "Montagnes Embrumees", "Des crêtes dans le brouillard.", 8, 25),
  ligne(38, "Lande Broussailleuse", "Des buissons jusqu'à la taille.", 3, 9),
  ligne(100, "Fleuve Paisible", "Large et lent.", 5, 17),
  ligne(32, "Plage Grain de Sel", "Du sable clair.", 2, 4),
  ligne(36, "Steppes Arides", "De l'herbe sèche.", 1, 2),
]);
const PALIER2 = palier([
  ligne(37, "Canyon Lekro", "Des parois de grès rouge.", 6, 22),
  ligne(39, "Volcan Nuageux", "Un cône de vapeur.", 0, 0),
]);

const nav = await chromium.launch(CHROME === undefined ? {} : { executablePath: CHROME });
const p = await nav.newPage({ viewport: { width: 1440, height: 900 } });
const soucis = [];
p.on("pageerror", (e) => soucis.push("erreur JS : " + e.message));

//  LA TROISIÈME PAGE DE PALIER RÉPOND 503, EXPRÈS. C'est le cas qui
//  compte : une page injoignable ne doit coûter que ses chiffres.
let demandesDePalier = 0;
await p.route("**/*", (r) => {
  const u = r.request().url();
  if (u.endsWith("/data/carte.json")) {
    return r.fulfill({
      contentType: "application/json",
      body: readFileSync(R + "data/carte.json", "utf8"),
    });
  }
  if (u.endsWith("/js/wild-mystery.js")) {
    return r.fulfill({
      contentType: "text/javascript",
      body: readFileSync(R + "js/wild-mystery.js", "utf8"),
    });
  }
  if (/\/f96-/.test(u)) {
    demandesDePalier += 1;
    return r.fulfill({ contentType: "text/html; charset=utf-8", body: PALIER1 });
  }
  if (/\/f97-/.test(u)) {
    demandesDePalier += 1;
    return r.fulfill({ contentType: "text/html; charset=utf-8", body: PALIER2 });
  }
  if (/\/f98-/.test(u)) {
    demandesDePalier += 1;
    return r.fulfill({ status: 503, body: "" });
  }
  if (/\/f\d+-|\/t\d+-|\/u\d/.test(new URL(u).pathname)) {
    return r.fulfill({ contentType: "text/html; charset=utf-8", body: "<html></html>" });
  }
  return r.fulfill({ contentType: "text/html; charset=utf-8", body: index });
});
await p.goto("http://wild-mystery.test/");
await p.addScriptTag({ url: "http://wild-mystery.test/js/wild-mystery.js" });
await p.waitForTimeout(700);

const dire = (nom, ok, detail = "") => {
  console.log(`${ok ? "  ok  " : "DÉFAUT"} ${nom}${detail ? " — " + detail : ""}`);
  if (!ok) soucis.push(nom + (detail ? " — " + detail : ""));
};

// ── 1 · elle est là, elle est complète, et elle a un titre ──────────
const pose = await p.evaluate(() => {
  const c = document.querySelector(".wm-carte");
  if (c === null) return null;
  const avant = document.querySelector("#wm-carte")?.nextElementSibling;
  const vu = (n) => n !== null && n.getClientRects().length > 0;
  return {
    titre: c.querySelector(".wm-carte__titre")?.textContent.trim(),
    formes: document.querySelectorAll(".wm-carte__lieu").length,
    entrees: document.querySelectorAll(".wm-carte__entree").length,
    groupes: [...document.querySelectorAll(".wm-carte__groupe-mot")].map((m) =>
      m.textContent.trim()
    ),
    //  Elle se pose AVANT la première catégorie qui porte un de ses
    //  forums — « Les Villes de Rhode », pas « Zone staff ».
    suivie: (avant?.querySelector("li.header h2")?.textContent ?? "").trim(),
    //  « Les catégories en dessous ne doivent donc plus se voir » :
    //  les deux qui portent des lieux sont cachées, « Zone staff »
    //  reste.
    cachees: document.querySelectorAll(".forabg.wm-carte-remplacee").length,
    visibles: [...document.querySelectorAll(".forabg")].filter(vu).length,
    staffVu: vu(
      [...document.querySelectorAll(".forabg")].find((b) =>
        b.textContent.includes("Zone staff")
      ) ?? null,
    ),
  };
});
dire("LA CARTE EST POSÉE", pose !== null, JSON.stringify(pose));
dire("elle porte un titre", pose?.titre === "La carte de Rhode", pose?.titre);
dire("elle porte les vingt-six lieux", pose?.formes === 26, `${pose?.formes} formes`);
dire("et la liste les reprend tous", pose?.entrees === 26, `${pose?.entrees} entrées`);
dire(
  "elle se pose avant la première catégorie de lieux, pas en tête de page",
  pose?.suivie === "Les Villes de Rhode",
  pose?.suivie,
);
dire(
  "LES DEUX CATÉGORIES QU'ELLE REDIT NE SE VOIENT PLUS",
  pose?.cachees === 2 && pose?.visibles === 1,
  JSON.stringify({ cachees: pose?.cachees, visibles: pose?.visibles }),
);
dire(
  "mais une catégorie qui n'est pas sur la carte reste, elle",
  pose?.staffVu === true,
);

// ── 2 · LE PALIER EST ÉCRIT, PAS SEULEMENT COLORÉ ───────────────────
const mots = await p.evaluate(() => ({
  legende: [...document.querySelectorAll(".wm-carte__legende-mot")].map((m) =>
    m.textContent.trim()
  ),
  groupes: [...document.querySelectorAll(".wm-carte__groupe-mot")].map((m) =>
    m.textContent.trim()
  ),
  comptes: [...document.querySelectorAll(".wm-carte__groupe-compte")].map((m) =>
    Number(m.textContent.trim())
  ),
  entrees: [...document.querySelectorAll(".wm-carte__entree")].map((a) =>
    a.getAttribute("aria-label")
  ),
  noms: [...document.querySelectorAll(".wm-carte__lieu")].map((g) =>
    g.getAttribute("aria-label")
  ),
}));
dire(
  "LA LÉGENDE NOMME LES QUATRE FAMILLES",
  ["Ville", "Palier 1", "Palier 2", "Palier 3", "Ligue"].every((m) => mots.legende.includes(m)),
  JSON.stringify(mots.legende),
);
dire(
  "LA LISTE EST GROUPÉE PAR FAMILLE, et chaque groupe est titré",
  JSON.stringify(mots.groupes) ===
    JSON.stringify(["Les villes", "Palier 1", "Palier 2", "Palier 3", "La ligue"]),
  JSON.stringify(mots.groupes),
);
dire(
  "chaque groupe dit combien de lieux il tient, et la somme fait vingt-six",
  mots.comptes.reduce((a, b) => a + b, 0) === 26,
  JSON.stringify(mots.comptes),
);
dire(
  "et chaque entrée garde sa famille dans son nom accessible",
  mots.entrees.length === 26 &&
    mots.entrees.every((n) => /, (ville|ligue|palier [123]) — (voir|entrer)/.test(n ?? "")),
  JSON.stringify(
    mots.entrees.filter((n) => !/, (ville|ligue|palier [123]) — (voir|entrer)/.test(n ?? "")),
  ),
);
dire(
  "ET LE NOM ACCESSIBLE DE CHAQUE FORME AUSSI",
  mots.noms.length === 26 &&
    mots.noms.every((n) => /, (ville|ligue|palier [123])$/.test(n ?? "")),
  JSON.stringify(mots.noms.filter((n) => !/, (ville|ligue|palier [123])$/.test(n ?? ""))),
);

// ── 3 · la liste ENTRE dans le forum ────────────────────────────────
//
//  « Cliquer sur la catégorie à droite nous fait rentrer dans la
//  catégorie. » Donc un lien, et un lien qui mène au bon forum.
const liens = await p.evaluate(() => {
  const a = [...document.querySelectorAll(".wm-carte__entree")];
  return {
    tous: a.every((x) => x.tagName === "A" && /^\/f\d+-$/.test(x.getAttribute("href") ?? "")),
    pyrite: document.querySelector('.wm-carte__entree[data-wm-forum="12"]')?.getAttribute(
      "href",
    ),
    fleches: document.querySelectorAll(".wm-carte__entree-fleche").length,
  };
});
dire("CHAQUE ENTRÉE DE LA LISTE EST UN LIEN VERS SON FORUM", liens.tous === true);
dire("et il mène au bon", liens.pyrite === "/f12-", liens.pyrite);
dire("chacune porte sa flèche", liens.fleches === 26, `${liens.fleches}`);

// ── 4 · le panneau, rempli au PREMIER clic sur la liste ─────────────
//
//  « Quand je survole les noms, ça saute et c'est trop rapide, je
//  préfère que ce soit au clic », et « pour entrer dans la catégorie,
//  il faut un 2e clic ». Le premier clic choisit, le second laisse le
//  lien partir.
//
//  ON CLIQUE POUR DE VRAI, à la souris de Playwright. Un événement
//  fabriqué et envoyé au nœud ne prouve rien : c'est exactement ce
//  qui a laissé passer le défaut du clic sur la carte.
const survoler = async (f) => {
  await p.click(`.wm-carte__entree[data-wm-forum="${f}"]`);
  await p.waitForTimeout(90);
};
await survoler(12);
const pyrite = await p.evaluate(() => {
  const pan = document.querySelector(".wm-carte__panneau");
  return {
    vide: pan.classList.contains("wm-carte__panneau--vide"),
    famille: pan.querySelector(".wm-carte__panneau-famille")?.textContent.trim(),
    nom: pan.querySelector(".wm-carte__panneau-mot")?.textContent.trim(),
    lien: pan.querySelector(".wm-carte__panneau-lien")?.getAttribute("href"),
    fleche: pan.querySelector(".wm-carte__panneau-lien .wm-carte__fleche") !== null,
    niveau: pan.querySelector(".wm-carte__panneau-niveau")?.textContent.trim(),
    texte: pan.querySelector(".wm-carte__panneau-texte")?.textContent.trim(),
    sousForums: [...pan.querySelectorAll(".wm-carte__sous-forum a")].map((a) => ({
      t: a.textContent.trim(),
      u: a.getAttribute("href"),
    })),
    chiffres: [...pan.querySelectorAll(".wm-carte__chiffre")].map((c) => c.textContent.trim()),
    dernierTag: pan.querySelector(".wm-carte__dernier")?.tagName,
    dernierLien: pan.querySelector(".wm-carte__dernier")?.getAttribute("href"),
    dernierTitre: pan.querySelector(".wm-carte__dernier-titre")?.textContent.trim(),
    dernierDate: pan.querySelector(".wm-carte__dernier-date")?.textContent.trim(),
    dernierQui: pan.querySelector(".wm-carte__dernier-qui")?.textContent.trim(),
    dernierFleche: pan.querySelector(".wm-carte__dernier .wm-carte__fleche") !== null,
    avatar: pan.querySelector(".wm-carte__dernier-avatar") !== null,
    choisie: document.querySelectorAll(".wm-carte__lieu--choisi").length,
    entreeChoisie: document.querySelector(".wm-carte__entree--choisie")?.dataset.wmForum,
  };
});
dire(
  "UN PREMIER CLIC DANS LA LISTE REMPLIT LE PANNEAU",
  pyrite.vide === false,
  JSON.stringify(pyrite),
);
dire("il nomme le lieu et sa famille", pyrite.nom === "Pyrite" && pyrite.famille === "Ville");
dire(
  "LE NOM EST LA PORTE DU FORUM, et il porte sa flèche",
  pyrite.lien === "/f12-" && pyrite.fleche === true,
  JSON.stringify({ l: pyrite.lien, f: pyrite.fleche }),
);
dire("il donne les niveaux", (pyrite.niveau ?? "") !== "", pyrite.niveau);
dire(
  "LA DESCRIPTION EST CELLE DU FORUM, pas celle de data/carte.json",
  pyrite.texte === "La description de Pyrite.",
  pyrite.texte,
);
dire(
  "ON VOIT LES SOUS-FORUMS, et ils mènent quelque part",
  pyrite.sousForums.length === 2 &&
    pyrite.sousForums[0].t === "Arène" &&
    /^\/f\d+-/.test(pyrite.sousForums[0].u ?? ""),
  JSON.stringify(pyrite.sousForums),
);
dire(
  "LES CHIFFRES DE LA VILLE SONT LUS DANS LA PAGE, sans une requête",
  pyrite.chiffres[0] === "11 sujets" && pyrite.chiffres[1] === "42 messages",
  JSON.stringify(pyrite.chiffres),
);
dire(
  "LE DERNIER MESSAGE EST UN LIEN CLIQUABLE, avec sa flèche",
  pyrite.dernierTag === "A" && /^\/t\d+-/.test(pyrite.dernierLien ?? "") &&
    pyrite.dernierFleche === true,
  JSON.stringify({ t: pyrite.dernierTag, l: pyrite.dernierLien, f: pyrite.dernierFleche }),
);
dire(
  "et il porte son titre, SA DATE, son auteur et son avatar",
  (pyrite.dernierTitre ?? "").includes("Pyrite") &&
    /2024/.test(pyrite.dernierDate ?? "") &&
    (pyrite.dernierQui ?? "").includes("Maître du Jeu") &&
    pyrite.avatar,
  JSON.stringify({
    t: pyrite.dernierTitre,
    d: pyrite.dernierDate,
    q: pyrite.dernierQui,
    a: pyrite.avatar,
  }),
);
dire("la forme correspondante s'allume, une seule", pyrite.choisie === 1);
dire("et l'entrée de la liste aussi", pyrite.entreeChoisie === "12", pyrite.entreeChoisie);

// ── 5 · les zones viennent des trois pages de palier ────────────────
dire(
  "TROIS REQUÊTES POUR DIX-SEPT ZONES, pas dix-sept",
  demandesDePalier === 3,
  `${demandesDePalier} requête(s)`,
);
//  LE CLIC SUR LA CARTE, À LA SOURIS. Le cadre capture le pointeur
//  pour pouvoir traîner la carte, et une capture REDIRIGE le `click`
//  vers le capteur : un écouteur posé sur la forme ne se déclenche
//  jamais. Un `MouseEvent` fabriqué, lui, ne passe pas par la capture
//  et réussissait quand même — c'est le trou par lequel le défaut est
//  passé en ligne.
const cliquerLaForme = async (f) => {
  const b = await p.evaluate((f) => {
    const r = document.querySelector(`.wm-carte__lieu[data-wm-forum="${f}"] .wm-carte__forme,
      .wm-carte__lieu[data-wm-forum="${f}"] .wm-carte__epingle`).getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  }, f);
  await p.mouse.move(b.x, b.y);
  await p.mouse.down();
  await p.mouse.up();
  await p.waitForTimeout(90);
};
await cliquerLaForme(9);
const foret = await p.evaluate(() => {
  const pan = document.querySelector(".wm-carte__panneau");
  return {
    nom: pan.querySelector(".wm-carte__panneau-mot")?.textContent.trim(),
    famille: pan.querySelector(".wm-carte__panneau-famille")?.textContent.trim(),
    niveau: pan.querySelector(".wm-carte__panneau-niveau")?.textContent.trim(),
    texte: pan.querySelector(".wm-carte__panneau-texte")?.textContent.trim(),
    chiffres: [...pan.querySelectorAll(".wm-carte__chiffre")].map((c) => c.textContent.trim()),
    //  La liste a suivi : les deux vues disent la même chose.
    listeChoisie: document.querySelector(".wm-carte__entree--choisie")?.dataset.wmForum,
    //  Et le nombre de sujets est passé dans la liste.
    entreeChiffre: document.querySelector(
      '.wm-carte__entree[data-wm-forum="9"] .wm-carte__entree-chiffres',
    )?.textContent.trim(),
  };
});
dire("UN CLIC SUR LA CARTE REMPLIT LE PANNEAU À DROITE", foret.nom === "Forêt Marécageuse");
dire("et la liste suit la carte", foret.listeChoisie === "9", foret.listeChoisie);
dire("le palier et les niveaux sont ceux du forum", foret.famille === "Palier 1", foret.niveau);
dire(
  "LES CHIFFRES DE LA ZONE VIENNENT DE LA PAGE DE SON PALIER",
  foret.chiffres[0] === "14 sujets" && foret.chiffres[1] === "61 messages",
  JSON.stringify(foret.chiffres),
);
dire(
  "la description de la zone vient de sa page de palier, elle aussi",
  foret.texte === "Des racines dans l'eau noire.",
  foret.texte,
);
dire(
  "ET LA LISTE PORTE LES CHIFFRES, c'est elle qui dit où ça joue",
  foret.entreeChiffre === "14 sujets",
  foret.entreeChiffre,
);

// ── 5bis · les deux clics, et le glissement qui ne choisit pas ──────
const deuxClics = await p.evaluate(() => {
  const a = document.querySelector('.wm-carte__entree[data-wm-forum="18"]');
  return { avant: a.getAttribute("aria-label"), href: a.getAttribute("href") };
});
await p.click('.wm-carte__entree[data-wm-forum="18"]');
await p.waitForTimeout(90);
const apresUn = await p.evaluate(() => ({
  url: location.pathname,
  nom: document.querySelector(".wm-carte__panneau-mot")?.textContent.trim(),
  etiquette: document.querySelector('.wm-carte__entree[data-wm-forum="18"]')
    .getAttribute("aria-label"),
}));
dire(
  "LE PREMIER CLIC CHOISIT ET NE NAVIGUE PAS",
  apresUn.url === "/" && apresUn.nom === "Station Service",
  JSON.stringify(apresUn),
);
dire(
  "et l'étiquette dit ce que fera le second",
  /voir le détail/.test(deuxClics.avant ?? "") &&
    /entrer dans le forum/.test(apresUn.etiquette ?? ""),
  JSON.stringify([deuxClics.avant, apresUn.etiquette]),
);
await p.click('.wm-carte__entree[data-wm-forum="18"]');
await p.waitForTimeout(220);
const apresDeux = await p.evaluate(() => location.pathname);
dire(
  "LE SECOND CLIC ENTRE DANS LE FORUM",
  apresDeux === "/f18-",
  apresDeux,
);
//  On est VRAIMENT parti dans le forum : il faut remonter la page
//  entière, pas revenir en arrière. `goBack` rend une page restaurée
//  du cache, sans que le module repasse — et la carte n'y est plus.
await p.goto("http://wild-mystery.test/");
await p.addScriptTag({ url: "http://wild-mystery.test/js/wild-mystery.js" });
await p.waitForTimeout(800);

//  Traîner la carte ne doit PAS choisir la zone sous le doigt :
//  sinon le panneau change à chaque déplacement.
const avantGlissement = await p.evaluate(() =>
  document.querySelector(".wm-carte__panneau-mot")?.textContent.trim() ?? ""
);
const bb = await p.evaluate(() => {
  const r = document.querySelector('.wm-carte__lieu[data-wm-forum="9"] .wm-carte__forme')
    .getBoundingClientRect();
  return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
});
await p.mouse.move(bb.x, bb.y);
await p.mouse.down();
await p.mouse.move(bb.x + 60, bb.y + 20, { steps: 5 });
await p.mouse.up();
await p.waitForTimeout(90);
const apresGlissement = await p.evaluate(() =>
  document.querySelector(".wm-carte__panneau-mot")?.textContent.trim() ?? ""
);
dire(
  "TRAÎNER LA CARTE NE CHOISIT RIEN",
  avantGlissement === apresGlissement,
  `${avantGlissement} → ${apresGlissement}`,
);

// ── 6 · une page de palier qui tombe ne coûte que ses chiffres ──────
await survoler(103);
const monts = await p.evaluate(() => {
  const pan = document.querySelector(".wm-carte__panneau");
  return {
    nom: pan.querySelector(".wm-carte__panneau-mot")?.textContent.trim(),
    lien: pan.querySelector(".wm-carte__panneau-lien")?.getAttribute("href"),
    texte: pan.querySelector(".wm-carte__panneau-texte")?.textContent.trim(),
    chiffres: [...pan.querySelectorAll(".wm-carte__chiffre")].map((c) => c.textContent.trim()),
    entreeChiffre: document.querySelector(
      '.wm-carte__entree[data-wm-forum="103"] .wm-carte__entree-chiffres',
    )?.textContent.trim(),
  };
});
dire(
  "SANS SA PAGE DE PALIER, LA ZONE GARDE TOUT LE RESTE",
  monts.nom === "Monts Enneigés" && monts.lien === "/f103-" && (monts.texte ?? "").length > 20,
  JSON.stringify(monts),
);
dire(
  "et le chiffre manquant se dit, il ne vaut pas zéro",
  monts.chiffres[0] === "— sujets" && monts.entreeChiffre === "—",
  JSON.stringify([monts.chiffres[0], monts.entreeChiffre]),
);

// ── 7 · on traîne la carte, et elle s'arrête ────────────────────────
const glisse = async (dx, dy) => {
  const b = await p.evaluate(() => {
    const r = document.querySelector(".wm-carte__cadre").getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  });
  await p.mouse.move(b.x, b.y);
  await p.mouse.down();
  await p.mouse.move(b.x + dx, b.y + dy, { steps: 6 });
  await p.mouse.up();
  await p.waitForTimeout(60);
  return await p.evaluate(() =>
    document.querySelector(".wm-carte__dessin").getAttribute("viewBox")
  );
};
//  Au zoom 1 la vue couvre toute la carte : il n'y a rien à déplacer,
//  et c'est le bon comportement. On zoome d'abord.
await p.evaluate(() => document.querySelectorAll(".wm-carte__zoom-bouton")[0].click());
await p.waitForTimeout(60);
const zoome = await p.evaluate(() =>
  document.querySelector(".wm-carte__dessin").getAttribute("viewBox")
);
dire("LE BOUTON ZOOME", zoome !== "0 0 1000 640", zoome);
const apresGauche = await glisse(-250, 0);
dire("ON TRAÎNE LA CARTE ET ELLE SUIT", apresGauche !== zoome, `${zoome} → ${apresGauche}`);
const auBord = await glisse(-2000, -2000);
const [bx, by, bl, bh] = auBord.split(" ").map(Number);
//  LE REPÈRE SE LIT, IL NE SE RÉCITE PAS. Il valait 1000 × 640 tant
//  que la carte était dessinée ; depuis qu'elle est peinte il est
//  carré. Un harnais qui récite les bornes tombe au premier
//  changement de format — et c'est arrivé.
const repere = await p.evaluate(() => {
  const v = document.querySelector(".wm-carte__dessin").dataset.wmRepere ?? "";
  return v.split(" ").map(Number);
});
dire(
  "ET ELLE S'ARRÊTE À SES BORDS",
  bx <= repere[0] - bl + 0.5 && by <= repere[1] - bh + 0.5,
  `${auBord} dans ${repere.join(" × ")}`,
);
const retour = await glisse(4000, 4000);
const [rx, ry] = retour.split(" ").map(Number);
dire("dans l'autre sens aussi", rx >= -0.5 && ry >= -0.5, retour);

// ── 8 · le clavier ──────────────────────────────────────────────────
const clavier = await p.evaluate(() => {
  const g = document.querySelector('.wm-carte__lieu[data-wm-forum="37"]');
  g.focus();
  g.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
  return document.querySelector(".wm-carte__panneau-mot")?.textContent.trim();
});
dire("UNE FORME S'OUVRE AU CLAVIER", clavier === "Canyon Lekro", clavier);
//  AU CLAVIER, LA MÊME RÈGLE QU'À LA SOURIS. Tabuler ne choisit plus
//  rien — c'était le défaut du survol, en pire : on traverse la liste
//  à la tabulation et le panneau se redessine à chaque arrêt. C'est
//  Entrée qui choisit, et Entrée une seconde fois qui entre.
await p.evaluate(() => document.querySelector('.wm-carte__entree[data-wm-forum="15"]').focus());
await p.waitForTimeout(60);
const auFocus = await p.evaluate(() =>
  document.querySelector(".wm-carte__panneau-mot")?.textContent.trim()
);
dire(
  "TABULER NE CHOISIT PAS — c'était ça, le panneau qui clignotait",
  auFocus !== "Suerebe",
  `panneau sur « ${auFocus} »`,
);
await p.keyboard.press("Enter");
await p.waitForTimeout(90);
const auClavier = await p.evaluate(() => ({
  nom: document.querySelector(".wm-carte__panneau-mot")?.textContent.trim(),
  url: location.pathname,
}));
dire(
  "MAIS ENTRÉE CHOISIT, SANS NAVIGUER",
  auClavier.nom === "Suerebe" && auClavier.url === "/",
  JSON.stringify(auClavier),
);

// ── 9 · la colonne de droite prend toute la hauteur ─────────────────
//
//  « Le panneau de droite doit prendre toute la hauteur. » Donc : la
//  colonne monte du bord haut au bord bas du cadre, et c'est la LISTE
//  qui défile — pas le bloc entier qui s'allonge.
await p.setViewportSize({ width: 1440, height: 900 });
await p.waitForTimeout(150);
const hauteurs = await p.evaluate(() => {
  const h = (s) => Math.round(document.querySelector(s).getBoundingClientRect().height);
  const l = document.querySelector(".wm-carte__liste-cadre");
  return {
    cadre: h(".wm-carte__cadre"),
    colonne: h(".wm-carte__colonne"),
    panneau: h(".wm-carte__panneau"),
    liste: h(".wm-carte__liste-cadre"),
    defile: l.scrollHeight > l.clientHeight + 1,
  };
});
dire(
  "LA COLONNE FAIT LA HAUTEUR DU CADRE",
  Math.abs(hauteurs.colonne - hauteurs.cadre) <= 2,
  JSON.stringify(hauteurs),
);
dire(
  "et c'est la liste qui défile, pas le bloc qui s'allonge",
  hauteurs.defile === true && hauteurs.panneau + hauteurs.liste <= hauteurs.cadre + 2,
  JSON.stringify(hauteurs),
);

// ── 10 · l'image d'en-tête du panneau ───────────────────────────────
//
//  AUCUN LIEU N'A LA SIENNE. Ce qu'on vérifie, c'est que le panneau
//  retombe bien sur le bandeau des catégories et qu'il reste LISIBLE :
//  le voile est au-dessus de l'image, donc le texte tient quelle que
//  soit la photo dessous.
const banniere = await p.evaluate(() => {
  const b = document.querySelector(".wm-carte__banniere");
  const s = getComputedStyle(b);
  return {
    la: b !== null,
    haut: Math.round(b.getBoundingClientRect().height),
    image: s.backgroundImage.slice(0, 40),
    couches: s.backgroundImage.split(/,(?![^(]*\))/).length,
    texte: s.color,
  };
});
dire(
  "LE PANNEAU A UN EN-TÊTE IMAGÉ, avec son voile par-dessus",
  banniere.la && banniere.haut >= 70 && banniere.couches >= 2,
  JSON.stringify(banniere),
);

// ── 11 · la mer ─────────────────────────────────────────────────────
//
//  Elle est DANS le SVG, pas en image de fond : c'est la seule façon
//  qu'elle suive le déplacement et le zoom. Ce qu'on vérifie, c'est
//  justement ça — qu'elle bouge avec la carte, qu'elle soit derrière
//  le continent, et que ses paliers soient quatre couleurs distinctes.
await p.setViewportSize({ width: 1440, height: 1100 });
await p.waitForTimeout(200);
const mer = await p.evaluate(() => {
  const g = document.querySelector(".wm-carte__mer");
  if (g === null) return null;
  const bandes = [...document.querySelectorAll(".wm-carte__mer-bande")];
  const terre = document.querySelector(".wm-carte__terre");
  const noeuds = [...document.querySelector(".wm-carte__dessin").children];
  return {
    bandes: bandes.length,
    //  Le taux de mélange va du large (58 %) vers la côte : c'est
    //  l'ordre de peinture, et peint à l'envers on ne verrait que la
    //  bande la plus large.
    melanges: bandes.map((b) =>
      Number((b.style.getPropertyValue("--wm-mer-melange") || "0").replace("%", ""))
    ),
    teintes: [...new Set(bandes.map((b) => getComputedStyle(b).fill))],
    rides: document.querySelectorAll(".wm-carte__ride").length,
    //  Le continent doit venir APRÈS la mer dans le document : c'est
    //  l'ordre du document qui fait l'empilement dans un SVG.
    merAvantTerre: noeuds.indexOf(g) < noeuds.indexOf(terre),
    //  Et la mer ne doit pas être annoncée : elle ne dit rien que la
    //  liste ne dise déjà.
    cachee: g.getAttribute("aria-hidden") === "true",
  };
});
dire("LA MER EST DESSINÉE DANS LE SVG", mer !== null, JSON.stringify(mer));
//  ASSEZ DE PALIERS POUR QUE ÇA NE SE LISE PLUS COMME DES PALIERS.
//  « Tu peux faire un vrai dégradé pour l'océan ? » — le harnais ne
//  sait pas juger un dégradé à l'œil, mais il sait compter les
//  marches et vérifier qu'aucune ne répète la précédente.
dire(
  "elle a assez de paliers pour faire un dégradé",
  (mer?.bandes ?? 0) >= 7,
  `${mer?.bandes} bandes`,
);
dire(
  "peints du large vers la côte, pour qu'ils s'emboîtent",
  (mer?.melanges ?? []).every((v, i, t) => i === 0 || v < t[i - 1]),
  JSON.stringify(mer?.melanges),
);
dire(
  "ET AUCUNE TEINTE NE RÉPÈTE SA VOISINE",
  mer?.teintes.length === mer?.bandes,
  `${mer?.teintes.length} teintes pour ${mer?.bandes} bandes`,
);
dire("elle porte ses rides", (mer?.rides ?? 0) >= 20, `${mer?.rides} cercles`);
dire("elle passe sous le continent", mer?.merAvantTerre === true);
dire("et elle n'est pas annoncée aux lecteurs d'écran", mer?.cachee === true);

//  LE POINT QUI JUSTIFIE TOUT LE RESTE : une image de fond serait
//  restée collée au cadre. Celle-ci se déplace avec la carte.
const avantGlisse = await p.evaluate(() =>
  document.querySelector(".wm-carte__mer-bande").getBoundingClientRect().x
);
await p.evaluate(() => document.querySelectorAll(".wm-carte__zoom-bouton")[0].click());
await p.waitForTimeout(120);
const apresZoom = await p.evaluate(() =>
  document.querySelector(".wm-carte__mer-bande").getBoundingClientRect().x
);
dire(
  "LA MER SUIT LE ZOOM — c'est pour ça qu'elle n'est pas une image",
  Math.abs(apresZoom - avantGlisse) > 1,
  `${Math.round(avantGlisse)} → ${Math.round(apresZoom)}`,
);

// ── 12 · rien ne déborde ────────────────────────────────────────────
for (const [l, h] of [[1440, 900], [900, 800], [390, 844]]) {
  await p.setViewportSize({ width: l, height: h });
  await p.waitForTimeout(150);
  const d = await p.evaluate(() => ({
    debord: document.documentElement.scrollWidth > document.documentElement.clientWidth,
    carte: Math.round(document.querySelector(".wm-carte").getBoundingClientRect().width),
    cadre: Math.round(document.querySelector(".wm-carte__cadre").getBoundingClientRect().width),
    liste: Math.round(
      document.querySelector(".wm-carte__liste-cadre").getBoundingClientRect().width,
    ),
    panneau: Math.round(
      document.querySelector(".wm-carte__panneau").getBoundingClientRect().width,
    ),
  }));
  dire(`à ${l} px, rien ne déborde`, !d.debord, JSON.stringify(d));
  dire(
    `à ${l} px, la carte, le panneau et la liste tiennent tous les trois`,
    d.cadre > 0 && d.liste > 0 && d.panneau > 0,
  );
}

await nav.close();
if (soucis.length > 0) { for (const s of soucis) console.log("  · " + s); }
console.log(soucis.length === 0 ? "\nTOUT PASSE." : `\n${soucis.length} DÉFAUT(S).`);
Deno.exit(soucis.length === 0 ? 0 : 1);
