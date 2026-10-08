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

// ── 1 · elle est là, et elle est complète ───────────────────────────
const pose = await p.evaluate(() => {
  const c = document.querySelector(".wm-carte");
  if (c === null) return null;
  const avant = c.closest("#wm-carte")?.nextElementSibling;
  return {
    formes: document.querySelectorAll(".wm-carte__lieu").length,
    entrees: document.querySelectorAll(".wm-carte__entree").length,
    legende: [...document.querySelectorAll(".wm-carte__legende-mot")].map((m) =>
      m.textContent.trim()
    ),
    //  Elle se pose AVANT la première catégorie qui porte un de ses
    //  forums — « Les Villes de Rhode », pas « Zone staff ».
    suivie: (avant?.querySelector("li.header h2")?.textContent ?? "").trim(),
    //  Et les catégories restent : la carte s'ajoute, elle ne
    //  remplace pas.
    categories: document.querySelectorAll(".forabg").length,
  };
});
dire("LA CARTE EST POSÉE", pose !== null, JSON.stringify(pose));
dire("elle porte les vingt-six lieux", pose?.formes === 26, `${pose?.formes} formes`);
dire("et la liste les reprend tous", pose?.entrees === 26, `${pose?.entrees} entrées`);
dire(
  "elle se pose avant la première catégorie de lieux, pas en tête de page",
  pose?.suivie === "Les Villes de Rhode",
  pose?.suivie,
);
dire(
  "les catégories restent sous elle : on ajoute, on ne remplace pas",
  pose?.categories === 3,
  `${pose?.categories} catégories`,
);

// ── 2 · LE PALIER EST ÉCRIT, PAS SEULEMENT COLORÉ ───────────────────
const mots = await p.evaluate(() => ({
  legende: [...document.querySelectorAll(".wm-carte__legende-mot")].map((m) =>
    m.textContent.trim()
  ),
  entrees: [...document.querySelectorAll(".wm-carte__entree-famille")].map((m) =>
    m.textContent.trim()
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
  "chaque entrée de la liste porte sa famille écrite",
  mots.entrees.length === 26 && mots.entrees.every((m) => m !== ""),
  `${mots.entrees.length} sur 26`,
);
dire(
  "ET LE NOM ACCESSIBLE DE CHAQUE FORME AUSSI",
  mots.noms.length === 26 &&
    mots.noms.every((n) => /, (ville|ligue|palier [123])$/.test(n ?? "")),
  JSON.stringify(mots.noms.filter((n) => !/, (ville|ligue|palier [123])$/.test(n ?? ""))),
);

// ── 3 · les chiffres des villes viennent de la page ─────────────────
await p.evaluate(() => {
  document.querySelector('.wm-carte__entree[data-wm-forum="12"]').click();
});
await p.waitForTimeout(80);
const pyrite = await p.evaluate(() => {
  const pan = document.querySelector(".wm-carte__panneau");
  return {
    ouvert: pan.classList.contains("wm-carte__panneau--ouvert"),
    famille: pan.querySelector(".wm-carte__panneau-famille")?.textContent.trim(),
    nom: pan.querySelector(".wm-carte__panneau-nom")?.textContent.trim(),
    niveau: pan.querySelector(".wm-carte__panneau-niveau")?.textContent.trim(),
    chiffres: [...pan.querySelectorAll(".wm-carte__chiffre")].map((c) => c.textContent.trim()),
    dernier: pan.querySelector(".wm-carte__dernier-titre")?.textContent.trim(),
    signature: pan.querySelector(".wm-carte__dernier-signature")?.textContent.trim(),
    avatar: pan.querySelector(".wm-carte__dernier-avatar") !== null,
    choisie: document.querySelectorAll(".wm-carte__lieu--choisi").length,
  };
});
dire("UN CLIC DANS LA LISTE OUVRE LE PANNEAU", pyrite.ouvert === true, JSON.stringify(pyrite));
dire("il nomme le lieu et sa famille", pyrite.nom === "Pyrite" && pyrite.famille === "Ville");
dire("il donne les niveaux", (pyrite.niveau ?? "") !== "", pyrite.niveau);
dire(
  "LES CHIFFRES DE LA VILLE SONT LUS DANS LA PAGE, sans une requête",
  pyrite.chiffres[0] === "11 sujets" && pyrite.chiffres[1] === "42 messages",
  JSON.stringify(pyrite.chiffres),
);
dire(
  "avec le dernier sujet, son auteur et son avatar",
  (pyrite.dernier ?? "").includes("Pyrite") &&
    (pyrite.signature ?? "").includes("Maître du Jeu") &&
    pyrite.avatar,
  JSON.stringify({ d: pyrite.dernier, s: pyrite.signature, a: pyrite.avatar }),
);
dire("et la forme correspondante s'allume, une seule", pyrite.choisie === 1);

// ── 4 · les zones viennent des trois pages de palier ────────────────
dire(
  "TROIS REQUÊTES POUR DIX-SEPT ZONES, pas dix-sept",
  demandesDePalier === 3,
  `${demandesDePalier} requête(s)`,
);
await p.evaluate(() => {
  document.querySelector('.wm-carte__lieu[data-wm-forum="9"]').dispatchEvent(
    new MouseEvent("click", { bubbles: true }),
  );
});
await p.waitForTimeout(80);
const foret = await p.evaluate(() => {
  const pan = document.querySelector(".wm-carte__panneau");
  return {
    nom: pan.querySelector(".wm-carte__panneau-nom")?.textContent.trim(),
    famille: pan.querySelector(".wm-carte__panneau-famille")?.textContent.trim(),
    niveau: pan.querySelector(".wm-carte__panneau-niveau")?.textContent.trim(),
    chiffres: [...pan.querySelectorAll(".wm-carte__chiffre")].map((c) => c.textContent.trim()),
    //  La liste a suivi : les deux vues disent la même chose.
    listeChoisie: document.querySelector(".wm-carte__entree--choisie")?.dataset.wmForum,
  };
});
dire("UN CLIC SUR LA CARTE FAIT LA MÊME CHOSE", foret.nom === "Forêt Marécageuse");
dire("et la liste suit la carte", foret.listeChoisie === "9", foret.listeChoisie);
dire("le palier et les niveaux sont ceux du forum", foret.famille === "Palier 1", foret.niveau);
dire(
  "LES CHIFFRES DE LA ZONE VIENNENT DE LA PAGE DE SON PALIER",
  foret.chiffres[0] === "14 sujets" && foret.chiffres[1] === "61 messages",
  JSON.stringify(foret.chiffres),
);

// ── 5 · une page de palier qui tombe ne coûte que ses chiffres ──────
await p.evaluate(() => {
  document.querySelector('.wm-carte__entree[data-wm-forum="103"]').click();
});
await p.waitForTimeout(80);
const monts = await p.evaluate(() => {
  const pan = document.querySelector(".wm-carte__panneau");
  return {
    nom: pan.querySelector(".wm-carte__panneau-nom")?.textContent.trim(),
    lien: pan.querySelector(".wm-carte__panneau-nom a")?.getAttribute("href"),
    texte: pan.querySelector(".wm-carte__panneau-texte")?.textContent.trim(),
    chiffres: [...pan.querySelectorAll(".wm-carte__chiffre")].map((c) => c.textContent.trim()),
  };
});
dire(
  "SANS SA PAGE DE PALIER, LA ZONE GARDE TOUT LE RESTE",
  monts.nom === "Monts Enneigés" && monts.lien === "/f103-" && (monts.texte ?? "").length > 20,
  JSON.stringify(monts),
);
dire(
  "et le chiffre manquant se dit, il ne vaut pas zéro",
  monts.chiffres[0] === "— sujets",
  JSON.stringify(monts.chiffres),
);

// ── 6 · on traîne la carte, et elle s'arrête ────────────────────────
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
const [bx, by] = auBord.split(" ").map(Number);
const [, , bl, bh] = auBord.split(" ").map(Number);
dire(
  "ET ELLE S'ARRÊTE À SES BORDS",
  bx <= 1000 - bl + 0.5 && by <= 640 - bh + 0.5,
  auBord,
);
const retour = await glisse(4000, 4000);
const [rx, ry] = retour.split(" ").map(Number);
dire("dans l'autre sens aussi", rx >= -0.5 && ry >= -0.5, retour);

// ── 7 · le clavier ──────────────────────────────────────────────────
const clavier = await p.evaluate(() => {
  const g = document.querySelector('.wm-carte__lieu[data-wm-forum="37"]');
  g.focus();
  g.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
  return document.querySelector(".wm-carte__panneau-nom")?.textContent.trim();
});
dire("UNE FORME S'OUVRE AU CLAVIER", clavier === "Canyon Lekro", clavier);

// ── 8 · rien ne déborde ─────────────────────────────────────────────
for (const [l, h] of [[1440, 900], [900, 800], [390, 844]]) {
  await p.setViewportSize({ width: l, height: h });
  await p.waitForTimeout(120);
  const d = await p.evaluate(() => ({
    debord: document.documentElement.scrollWidth > document.documentElement.clientWidth,
    carte: Math.round(document.querySelector(".wm-carte").getBoundingClientRect().width),
    cadre: Math.round(document.querySelector(".wm-carte__cadre").getBoundingClientRect().width),
    liste: Math.round(document.querySelector(".wm-carte__liste").getBoundingClientRect().width),
  }));
  dire(`à ${l} px, rien ne déborde`, !d.debord, JSON.stringify(d));
  dire(`à ${l} px, la carte et la liste tiennent toutes les deux`, d.cadre > 0 && d.liste > 0);
}

await nav.close();
if (soucis.length > 0) { for (const s of soucis) console.log("  · " + s); }
console.log(soucis.length === 0 ? "\nTOUT PASSE." : `\n${soucis.length} DÉFAUT(S).`);
Deno.exit(soucis.length === 0 ? 0 : 1);
