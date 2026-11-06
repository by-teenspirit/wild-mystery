// ════════════════════════════════════════════════════════════════════
//  outils/personnages.mjs — l'annexe des célébrités, dans un vrai
//  navigateur.
//
//  COUVRE : src/adaptateurs/navigateur/module-personnages.ts
//
//  CE QU'IL REGARDE, et qu'aucun test sans navigateur ne verrait :
//
//    · SANS LE SCRIPT, les quatorze fiches sont là, toutes visibles,
//      et la légende dit ce que les trois statuts veulent dire. C'est
//      la règle du projet : un bouton n'a le droit de cacher que ce
//      qu'il peut remontrer, donc aucun filtre n'est écrit dans la
//      page ;
//    · avec le script, la barre se pose, et SES NOMBRES SONT CEUX DU
//      FICHIER — relus ici, pas recopiés. Une barre qui annonce cinq
//      jouables là où il y en a quatre est exactement la faute qu'on
//      ne voit pas ;
//    · un clic ne montre QUE le statut cliqué, et « Tous » remet les
//      quatorze. La vérification porte sur ce qui est visible à
//      l'écran, pas sur un attribut : `hidden` ne suffit pas à cacher
//      une fiche en `display: flex`, et c'est la faute classique ;
//    · LES MOTS DES BOUTONS SONT LES MOTS DE LA PAGE. Les trois
//      libellés existent en deux endroits — `MOT_DU_STATUT` dans
//      `outils/annexe-personnages.py` et `MOTS` dans
//      `src/navigateur/personnages.ts`. Deux listes finissent par
//      diverger ; celle-ci est la seule mesure qui les tient ;
//    · un GIF mort retombe sur la silhouette. Deux des six adresses
//      relevées dans le sujet du forum ne répondaient déjà plus le 4
//      novembre, et une image cassée dans une fiche est pire qu'une
//      silhouette ;
//    · rien ne déborde à 390.
//
//  LE DÉCOR SERT LA VRAIE PAGE. `la page de l'annexe` telle qu'elle
//  sera collée, `js/annexes.js` tel qu'il sera servi, et
//  `data/personnages.json` du dépôt. Un décor qui ne reproduit pas ce
//  que l'hôte sert ne teste que lui-même.
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
const json = (c) => JSON.parse(lire(c));

//  LA PAGE SE TROUVE PAR SON SLUG, pas par son numéro : le numéro
//  est un rang dans le sommaire, et il a reculé d'un cran le 4
//  novembre quand « créer son personnage » s'est repliée dans « par
//  où commencer ». Un chemin écrit à la main aurait fait tomber le
//  harnais sur un fichier absent.
const CHEMIN = (() => {
  const e = json("data/annexes.json").sections
    .flatMap((s) => s.entrees)
    .find((x) => x.slug === "celebrites-de-rhode");
  if (e === undefined) throw new Error("celebrites-de-rhode n'est pas dans data/annexes.json");
  return `pages/annexe-${e.numero}-${e.slug}.html`;
})();
const PAGE = lire(CHEMIN);
const PERSOS = json("data/personnages.json");
const FICHES = PERSOS.celebrites.fiches;

//  LES COMPTES ATTENDUS VIENNENT DU FICHIER, pas d'une constante
//  écrite ici : une constante à la main ne compare que deux fautes
//  possibles.
const ATTENDU = {};
for (const f of FICHES) ATTENDU[f.statut] = (ATTENDU[f.statut] ?? 0) + 1;
const MOT = { jouable: "Jouable", joue: "Joué", pnj: "PNJ" };

//  L'ADRESSE MORTE, celle de Vamper chez narvii. Elle est servie en
//  404 pour voir la silhouette prendre sa place ; les autres GIF sont
//  servis en pixel.
const MORTE = FICHES.find((f) => /narvii/.test(f.avatar ?? ""))?.avatar ?? null;

const PIXEL = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

let passes = 0;
const soucis = [];
function ok(quoi, vrai, detail) {
  if (vrai) {
    passes += 1;
    console.log(`  ok   ${quoi}`);
  } else {
    soucis.push(quoi);
    console.log(`  NON  ${quoi}${detail === undefined ? "" : ` — ${JSON.stringify(detail)}`}`);
  }
}

async function ouvrir(
  nav,
  { avecScript = true, largeur = 1440, fragment = "", page = PAGE, theme = undefined } = {},
) {
  const p = await nav.newPage({
    viewport: { width: largeur, height: 900 },
    ...(theme === undefined ? {} : { colorScheme: theme }),
  });
  p.on("pageerror", (e) => soucis.push("erreur JS : " + e.message));

  await p.route("**/*", (r) => {
    const u = r.request().url();
    const rendre = (type, corps) => r.fulfill({ contentType: type, body: corps });

    if (/\/annexe-11/.test(u)) return rendre("text/html; charset=utf-8", page);
    if (/jetons\.css$/.test(u)) return rendre("text/css", lire("panneau-admin/jetons.css"));
    if (/wild-mystery\.css$/.test(u)) return rendre("text/css", lire("css/wild-mystery.css"));
    if (/\/js\/annexes\.js$/.test(u)) {
      return rendre("text/javascript", avecScript ? lire("js/annexes.js") : "");
    }
    if (/\/data\/([a-z-]+)\.json$/.test(u)) {
      const nom = /\/data\/([a-z-]+)\.json$/.exec(u)[1];
      try {
        return rendre("application/json", lire(`data/${nom}.json`));
      } catch {
        return r.fulfill({ status: 404, body: "" });
      }
    }
    if (MORTE !== null && u === MORTE) return r.fulfill({ status: 404, body: "" });
    if (/\.(png|jpe?g|gif)/.test(u)) return r.fulfill({ contentType: "image/png", body: PIXEL });
    if (/fonts\.(googleapis|gstatic)/.test(u)) return rendre("text/css", "");
    return r.fulfill({ status: 404, body: "" });
  });

  await p.goto(`https://exemple.test/annexe-11${fragment}`, { waitUntil: "domcontentloaded" });
  return p;
}

/** Ce qui est VISIBLE à l'écran, par statut. */
const regarder = () => ({
  fiches: Array.from(document.querySelectorAll("[data-wm-statut-fiche]")).map((f) => ({
    statut: f.dataset.wmStatutFiche,
    vue: f.getBoundingClientRect().height > 0,
    avatar: f.querySelector("img.wm-perso__avatar") !== null,
    silhouette: f.querySelector(".wm-perso__avatar--vide") !== null,
    nom: f.querySelector(".wm-perso__nom")?.textContent?.trim() ?? "",
  })),
  boutons: Array.from(document.querySelectorAll(".wm-filtre")).map((b) => ({
    cle: b.dataset.wmFiltre,
    mot: b.querySelector(".wm-filtre__mot")?.textContent?.trim() ?? "",
    nombre: Number(b.querySelector(".wm-filtre__nombre")?.textContent ?? "-1"),
    actif: b.classList.contains("wm-filtre--actif"),
    presse: b.getAttribute("aria-pressed"),
  })),
  annonce: document.querySelector(".wm-filtres__compte")?.textContent?.trim() ?? "",
  legende: Array.from(document.querySelectorAll(".wm-statuts-dits .wm-perso__statut")).map((
    s,
  ) => ({ cle: s.dataset.wmStatut, mot: s.textContent?.trim() ?? "" })),
});

const nav = await chromium.launch(CHROME === undefined ? {} : { executablePath: CHROME });

// ════════════════════════════════════════════════════════════════════
//  1 · SANS LE SCRIPT
// ════════════════════════════════════════════════════════════════════
console.log("\n── sans JavaScript : les quatorze fiches, et la légende ──");
{
  const p = await ouvrir(nav, { avecScript: false });
  const vu = await p.evaluate(regarder);
  ok(
    `les ${FICHES.length} fiches sont dans la page`,
    vu.fiches.length === FICHES.length,
    vu.fiches.length,
  );
  ok("et toutes visibles — aucun filtre écrit dans la page", vu.fiches.every((f) => f.vue));
  ok("aucune barre de filtres sans le script", vu.boutons.length === 0, vu.boutons.length);
  ok(
    "la légende dit les trois statuts",
    vu.legende.length === 3 && vu.legende.every((l) => MOT[l.cle] === l.mot),
    vu.legende,
  );
  await p.close();
}

// ════════════════════════════════════════════════════════════════════
//  2 · LA BARRE, ET SES NOMBRES
// ════════════════════════════════════════════════════════════════════
console.log("\n── la barre se pose, et ses nombres sont ceux du fichier ──");
const p = await ouvrir(nav);
await p.waitForFunction(() => document.querySelectorAll(".wm-filtre").length > 0, undefined, {
  timeout: 15000,
});
{
  const vu = await p.evaluate(regarder);
  const parCle = Object.fromEntries(vu.boutons.map((b) => [b.cle, b]));

  //  LES BOUTONS ATTENDUS SE DÉDUISENT DU FICHIER, pas d'une liste
  //  écrite ici : un statut sans fiche n'a pas de bouton, et il y en
  //  avait quatre le matin du 4 novembre et trois le soir — Donozor
  //  est repassé « jouable ». Un compte en dur aurait crié pour une
  //  donnée parfaitement correcte.
  const attendus = ["tous", "jouable", "joue", "pnj"]
    .filter((c) => c === "tous" || (ATTENDU[c] ?? 0) > 0);
  ok(
    `${attendus.length} boutons : tous, puis les statuts tenus`,
    vu.boutons.map((b) => b.cle).join(",") === attendus.join(","),
    { vus: vu.boutons.map((b) => b.cle), attendus },
  );
  ok(
    `« Tous » annonce ${FICHES.length}`,
    parCle.tous?.nombre === FICHES.length,
    parCle.tous?.nombre,
  );
  for (const [cle, n] of Object.entries(ATTENDU)) {
    ok(`« ${MOT[cle]} » annonce ${n}, comme le fichier`, parCle[cle]?.nombre === n, {
      bouton: parCle[cle]?.nombre,
      fichier: n,
    });
  }
  //  LE PONT PYTHON ↔ TYPESCRIPT. Les mots des boutons viennent du
  //  module TypeScript, ceux de la légende du générateur Python.
  //  LA LÉGENDE EXPLIQUE LES TROIS STATUTS, même ceux qu'aucune fiche
  //  ne porte : c'est un lexique, pas un compte. On compare donc dans
  //  ce sens-là — chaque BOUTON dit le mot de la légende — et pas
  //  l'inverse.
  ok(
    "les mots des boutons sont ceux de la légende",
    vu.boutons.filter((b) => b.cle !== "tous").every((b) =>
      vu.legende.some((l) => l.cle === b.cle && l.mot === b.mot)
    ),
    { boutons: vu.boutons.map((b) => b.mot), legende: vu.legende.map((l) => l.mot) },
  );
  ok("« Tous » est actif au chargement", parCle.tous?.actif === true);
  ok("et il le dit au clavier", parCle.tous?.presse === "true", parCle.tous?.presse);
  ok(
    `l'annonce dit « ${FICHES.length} personnages »`,
    vu.annonce === `${FICHES.length} personnages`,
    vu.annonce,
  );
}

// ════════════════════════════════════════════════════════════════════
//  3 · UN CLIC NE MONTRE QUE SON STATUT
// ════════════════════════════════════════════════════════════════════
console.log("\n── un clic ne montre que le statut cliqué ──");
for (const [cle, n] of Object.entries(ATTENDU)) {
  await p.click(`.wm-filtre[data-wm-filtre="${cle}"]`);
  const vu = await p.evaluate(regarder);
  const vues = vu.fiches.filter((f) => f.vue);
  ok(`« ${MOT[cle]} » laisse ${n} fiche(s) à l'écran`, vues.length === n, {
    vues: vues.length,
    attendu: n,
  });
  ok(
    `et aucune d'un autre statut`,
    vues.every((f) => f.statut === cle),
    vues.filter((f) => f.statut !== cle).map((f) => f.nom),
  );
  ok(
    "l'annonce suit le filtre",
    vu.annonce === `${n} personnage${n === 1 ? "" : "s"} — ${MOT[cle].toLowerCase()}`,
    vu.annonce,
  );
}
{
  await p.click('.wm-filtre[data-wm-filtre="tous"]');
  const vu = await p.evaluate(regarder);
  ok(
    `« Tous » remet les ${FICHES.length}`,
    vu.fiches.filter((f) => f.vue).length === FICHES.length,
    vu.fiches.filter((f) => f.vue).length,
  );
}

// ════════════════════════════════════════════════════════════════════
//  4 · LES AVATARS
// ════════════════════════════════════════════════════════════════════
console.log("\n── les avatars : une image quand le fichier en donne une ──");
{
  const vu = await p.evaluate(regarder);
  const attenduAvecGif = FICHES.filter((f) => f.avatar).map((f) => f.nom);
  const avecImage = vu.fiches.filter((f) => f.avatar).map((f) => f.nom);

  //  C'EST LE FICHIER QUI DÉCIDE, PAS LE STATUT. La règle était
  //  « aucun PNJ n'a d'avatar », et elle était vraie le matin du 4
  //  novembre : il n'y avait de GIF que pour les jouables. Le soir,
  //  Callista en a donné quatre pour des PNJ, et la règle a crié pour
  //  une donnée parfaitement correcte. Ce qui doit tenir, c'est
  //  qu'une fiche SANS adresse montre une silhouette plutôt qu'un
  //  trou, et qu'une fiche qui en a une montre une image.
  const sansAdresse = FICHES.filter((f) => !f.avatar).map((f) => f.nom);
  const manquent = vu.fiches.filter((f) =>
    sansAdresse.includes(f.nom) && !f.silhouette
  );
  ok(
    `les ${sansAdresse.length} fiches sans adresse montrent une silhouette`,
    manquent.length === 0,
    manquent.map((f) => f.nom),
  );
  //  MOINS UNE : l'adresse morte a été remplacée par la silhouette,
  //  et c'est précisément ce qu'on vient voir.
  ok(
    `${attenduAvecGif.length - (MORTE === null ? 0 : 1)} GIF tiennent, l'adresse morte retombe sur la silhouette`,
    avecImage.length === attenduAvecGif.length - (MORTE === null ? 0 : 1),
    { vus: avecImage, attendus: attenduAvecGif },
  );
  const mort = FICHES.find((f) => f.avatar === MORTE);
  if (mort !== undefined) {
    ok(
      `${mort.nom} montre une silhouette et pas une image cassée`,
      vu.fiches.find((f) => f.nom === mort.nom)?.silhouette === true,
      vu.fiches.find((f) => f.nom === mort.nom),
    );
  }
}

// ════════════════════════════════════════════════════════════════════
//  5 · L'ADRESSE PEUT OUVRIR SUR UN FILTRE
// ════════════════════════════════════════════════════════════════════
console.log("\n── un lien peut ouvrir la page déjà filtrée ──");
{
  const q = await ouvrir(nav, { fragment: "#jouable" });
  await q.waitForFunction(() => document.querySelectorAll(".wm-filtre").length > 0, undefined, {
    timeout: 15000,
  });
  const vu = await q.evaluate(regarder);
  ok(
    "#jouable ouvre sur les jouables",
    vu.fiches.filter((f) => f.vue).length === ATTENDU.jouable,
    vu.fiches.filter((f) => f.vue).length,
  );
  await q.close();
}
{
  //  LE FRAGMENT DES SOUS-ONGLETS N'EST PAS UN FILTRE. Les deux
  //  mécanismes lisent le même `#`, et `#les-champions` doit changer
  //  d'onglet sans toucher au tri.
  const q = await ouvrir(nav, { fragment: "#les-champions" });
  await q.waitForFunction(() => document.querySelectorAll(".wm-onglet").length > 0, undefined, {
    timeout: 15000,
  });
  const vu = await q.evaluate(() => ({
    onglet: document.querySelector(".wm-onglet--actif")?.textContent?.trim() ?? "",
    fichesVues: Array.from(document.querySelectorAll("[data-wm-statut-fiche]")).filter((f) =>
      !f.hidden
    ).length,
  }));
  ok("#les-champions ouvre l'onglet des champions", /champions/i.test(vu.onglet), vu.onglet);
  ok(
    "et laisse le tri sur « Tous »",
    vu.fichesVues === FICHES.length,
    vu.fichesVues,
  );
  await q.close();
}

// ════════════════════════════════════════════════════════════════════
//  6 · 390 PIXELS
// ════════════════════════════════════════════════════════════════════
// ════════════════════════════════════════════════════════════════════
//  LES RENVOIS DE FIN DE SECTION
//
//  « Est-ce que tu peux afficher de manière plus jolie ces boutons ? »
//  (5 novembre) — deux liens soulignés sans fond, sans bord et sans
//  rembourrage, qui ne disaient pas non plus où ils menaient.
//
//  CE QU'ON VÉRIFIE N'EST PAS QU'ILS SONT JOLIS, c'est ce qu'on ne
//  pourrait pas voir à l'œil :
//
//    · l'adresse de l'annexe vient du SOMMAIRE, pas du générateur.
//      Forumactif ne route que sur le numéro, et une adresse dont le
//      numéro a glissé mène ailleurs sans tomber en 404 ;
//    · le numéro annoncé est celui d'aujourd'hui ;
//    · ils ont vraiment la forme d'un bouton — un fond, un bord, du
//      rembourrage, une cible tactile.
// ════════════════════════════════════════════════════════════════════
console.log("\n── les renvois de fin de section ──");
{
  const sommaire = json("data/annexes.json");
  const arenes = sommaire.sections.flatMap((x) => x.entrees)
    .find((e) => e.slug === "arenes-colosseums-ligues");

  const vu = await p.evaluate(() =>
    Array.from(document.querySelectorAll("a.wm-renvoi")).map((a) => {
      const c = getComputedStyle(a);
      const r = a.getBoundingClientRect();
      return {
        href: a.getAttribute("href"),
        quoi: a.querySelector(".wm-renvoi__quoi")?.textContent ?? "",
        mot: a.querySelector(".wm-renvoi__mot")?.textContent ?? "",
        fleche: a.querySelector(".wm-renvoi__fleche")?.getAttribute("aria-hidden"),
        //  UN BOUTON A UN FOND, UN BORD ET DU REMBOURRAGE. C'est
        //  précisément ce que les anciens liens n'avaient pas.
        fond: c.backgroundColor,
        bord: Number.parseFloat(c.borderTopWidth),
        padding: Number.parseFloat(c.paddingLeft),
        souligne: c.textDecorationLine,
        haut: Math.round(r.height),
        //  UN RENVOI DANS UN ONGLET FERMÉ N'A PAS DE HAUTEUR. Les
        //  trois vivent dans deux sections différentes, et une seule
        //  est ouverte : mesurer la cible tactile des autres
        //  demanderait 44 pixels à un élément que le navigateur ne
        //  dessine pas. Leur FORME, elle, se mesure quand même — le
        //  fond, le bord et le rembourrage sont calculés qu'on les
        //  voie ou non.
        visible: a.offsetParent !== null,
      };
    })
  );

  ok("il y a des renvois, et ce sont des liens", vu.length >= 2, vu.length);
  ok(
    "chacun dit CE QUE C'EST avant de dire où ça mène",
    vu.every((r) => r.quoi.trim() !== "" && r.mot.trim() !== ""),
    vu.map((r) => `${r.quoi} · ${r.mot}`),
  );
  ok(
    "ILS ONT LA FORME D'UN BOUTON : fond, bord, rembourrage, cible tactile",
    vu.every((r) =>
      r.fond !== "rgba(0, 0, 0, 0)" && r.bord >= 1 && r.padding >= 12 &&
      r.souligne === "none" && (!r.visible || r.haut >= 44)
    ) && vu.some((r) => r.visible),
    vu.map((r) => ({
      fond: r.fond,
      bord: r.bord,
      padding: r.padding,
      haut: r.haut,
      visible: r.visible,
    })),
  );
  //  LA FLÈCHE NE SE LIT PAS À VOIX HAUTE : c'est le mot qui porte le
  //  lien, et « flèche vers la droite » après chaque renvoi fatigue.
  ok(
    "la flèche est décorative",
    vu.every((r) => r.fleche === "true"),
    vu.map((r) => r.fleche),
  );

  //  ── L'ADRESSE VIENT DU SOMMAIRE ──────────────────────────────
  const versArenes = vu.find((r) => (r.href ?? "").startsWith("/h"));
  ok(
    "LE RENVOI VERS UNE ANNEXE PREND SON ADRESSE AU SOMMAIRE",
    versArenes !== undefined && versArenes.href === arenes.adresse,
    { vu: versArenes?.href, sommaire: arenes.adresse },
  );
  ok(
    "et le numéro qu'il annonce est celui d'aujourd'hui",
    versArenes !== undefined && versArenes.quoi.includes(arenes.numero),
    { vu: versArenes?.quoi, sommaire: arenes.numero },
  );
}

// ════════════════════════════════════════════════════════════════════
//  LES FICHES DE PRÉ-LIEN DE CHAMPION
// ════════════════════════════════════════════════════════════════════
//
//  LE FICHIER N'EN PORTE AUCUNE, et c'est voulu : aucun champion n'est
//  écrit. Une mise en page qu'on ne voit jamais remplie est une mise en
//  page qu'on n'a pas vérifiée — alors on en remplit une ici.
//
//  ET ON LA REMPLIT PAR LE VRAI GÉNÉRATEUR. Le harnais écrit un
//  `personnages.json` d'essai, lance `outils/annexe-personnages.py`
//  dessus, et mesure la page qui en sort. Même lecture des arènes,
//  même rendu, même feuille, même pied : d'autres données, c'est tout.
//  Un gabarit HTML écrit à la main ici mesurerait le gabarit.
console.log("\n── les fiches de pré-lien de champion ──");

const ARENES = json("data/arenes.json").arenes;
const PAR_SLUG = Object.fromEntries(ARENES.map((a) => [a.slug, a]));

//  DEUX FICHES, ET LA SECONDE EST DÉPOUILLÉE : pas de portrait, pas de
//  texte, pas de rivalités. C'est l'état qu'on oublie de regarder, et
//  c'est celui où un cadre vide ou une image cassée se voit.
const ESSAI = {
  pleine: {
    arene: "eau",
    nom: "Fiche d'essai du harnais",
    age: "25 – 30 ans",
    image: "https://exemple.test/portrait.png",
    traits: ["premier trait", "deuxième trait", "troisième trait"],
    texte: "Un paragraphe de présentation, écrit par le harnais.",
    affinites: [["Quelqu'un", "ce qui les lie"], ["Quelqu'un d'autre", "et pourquoi"]],
    rivalites: [["Un troisième", "ce qui les oppose"]],
    ditRivalites: "Une note sous le cadre.",
  },
  nue: { arene: "dragon", nom: "Fiche nue du harnais", traits: [], affinites: [] },
};

/** Lance le générateur sur des données d'essai et rend la page. */
function engendrer(fiches) {
  const sous = `${Deno.makeTempDirSync()}/`;
  const d = json("data/personnages.json");
  d.champions.fiches = fiches;
  Deno.writeTextFileSync(`${sous}personnages.json`, JSON.stringify(d));
  const r = new Deno.Command("python3", {
    args: ["outils/annexe-personnages.py", "--sortie", `${sous}page.html`],
    cwd: R,
    env: { WM_PERSONNAGES: `${sous}personnages.json` },
    stdout: "piped",
    stderr: "piped",
  }).outputSync();
  const erreur = new TextDecoder().decode(r.stderr) + new TextDecoder().decode(r.stdout);
  if (!r.success) return { ok: false, erreur };
  return { ok: true, page: Deno.readTextFileSync(`${sous}page.html`) };
}

//  ── LE GÉNÉRATEUR REFUSE CE QU'IL NE PEUT PAS RENDRE ──────────────
//
//  Une arène inconnue ferait un lien mort — et sur Forumactif un lien
//  mort ne tombe pas en 404, il mène ailleurs en silence. Une fiche
//  sans nom ne serait pas un pré-lien : le poste vacant est déjà dans
//  la liste des onze postes.
{
  const sansArene = engendrer([{ ...ESSAI.pleine, arene: "arene-qui-n-existe-pas" }]);
  ok(
    "une arène inconnue arrête la génération",
    !sansArene.ok && /inconnue/.test(sansArene.erreur),
    sansArene.ok ? "la page est sortie quand même" : sansArene.erreur.slice(0, 120),
  );
  const sansNom = engendrer([{ ...ESSAI.pleine, nom: "" }]);
  ok(
    "une fiche sans nom aussi",
    !sansNom.ok && /sans `nom`/.test(sansNom.erreur),
    sansNom.ok ? "la page est sortie quand même" : sansNom.erreur.slice(0, 120),
  );
  //  ET SANS FICHE, PAS DE SECTION : la page ne promet rien qu'elle
  //  n'a pas. C'est l'état du dépôt aujourd'hui.
  const vide = engendrer([]);
  ok(
    "aucune fiche dans le fichier, aucune section dans la page",
    vide.ok && !vide.page.includes("wm-champions") &&
      !vide.page.includes("pré-liens de champion"),
    vide.ok ? "la section est là sans fiche" : vide.erreur.slice(0, 120),
  );
  //  … et les onze postes disent alors tous « poste vacant ».
  //  LE COMPTE PORTE SUR L'ÉTAT DES POSTES, pas sur les mots de la
  //  page : « poste vacant » est aussi dans la phrase de contact
  //  (« la moindre question sur un poste vacant »), et compter les
  //  occurrences donnait douze pour onze postes.
  ok(
    "et les onze postes restent vacants",
    vide.ok &&
      (vide.page.match(/wm-poste__etat">poste vacant/g) ?? []).length === ARENES.length,
    (vide.page?.match(/wm-poste__etat">[^<]*/g) ?? []),
  );
}

const ENGENDREE = engendrer([ESSAI.pleine, ESSAI.nue]);
ok("la page d'essai sort du générateur", ENGENDREE.ok, ENGENDREE.erreur?.slice(0, 200));

/** Ce que porte chaque fiche de champion, à l'écran. */
const regarderLesChampions = () =>
  Array.from(document.querySelectorAll(".wm-champion")).map((f) => {
    const r = f.getBoundingClientRect();
    const cadres = Array.from(f.querySelectorAll(".wm-relation")).map((c) => ({
      variante: c.className.replace(/.*wm-relation--/, "").split(" ")[0],
      etiquette: c.querySelector(".wm-relation__etiquette")?.textContent?.trim() ?? "",
      liens: Array.from(c.querySelectorAll(".wm-relation__ligne")).map((l) => ({
        qui: l.querySelector(".wm-relation__qui")?.textContent?.trim() ?? "",
        quoi: l.querySelector(".wm-relation__quoi")?.textContent?.trim() ?? "",
      })),
      dit: c.querySelector(".wm-relation__dit")?.textContent?.trim() ?? "",
      haut: Math.round(c.getBoundingClientRect().top),
      gauche: Math.round(c.getBoundingClientRect().left),
      large: Math.round(c.getBoundingClientRect().width),
    }));
    const tag = (s) => {
      const n = f.querySelector(s);
      if (n === null) return null;
      const st = getComputedStyle(n);
      return {
        mot: n.textContent?.trim() ?? "",
        gauche: parseFloat(st.paddingLeft),
        haut: parseFloat(st.paddingTop),
        rond: parseFloat(st.borderTopLeftRadius),
        bord: st.borderTopStyle !== "none" && parseFloat(st.borderTopWidth) > 0,
        fond: st.backgroundColor,
      };
    };
    return {
      arene: f.dataset.wmArene,
      ou: f.querySelector(".wm-champion__ou")?.textContent?.trim() ?? "",
      badge: f.querySelector(".wm-champion__badge")?.getAttribute("src") ?? "",
      nom: f.querySelector(".wm-champion__nom")?.textContent?.trim() ?? "",
      type: (() => {
        const n = f.querySelector(".wm-type");
        if (n === null) return null;
        const s = getComputedStyle(n);
        return {
          mot: n.textContent?.trim() ?? "",
          cle: n.dataset.wmType,
          classe: n.className,
          fond: s.backgroundColor,
          encre: s.color,
          //  La pastille est le PREMIER tag : le type et le niveau
          //  sont ce qu'on vient vérifier avant de défier.
          premier: f.querySelector(".wm-champion__tags")?.firstElementChild === n,
        };
      })(),
      age: tag(".wm-champion__age"),
      niveau: tag(".wm-champion__niveau"),
      traits: Array.from(f.querySelectorAll(".wm-champion__trait")).map((t) => {
        const st = getComputedStyle(t);
        return {
          mot: t.textContent?.trim() ?? "",
          gauche: parseFloat(st.paddingLeft),
          bord: parseFloat(st.borderTopWidth),
        };
      }),
      texte: f.querySelector(".wm-champion__texte")?.textContent?.trim() ?? "",
      portrait: f.querySelector("img.wm-champion__portrait") !== null,
      silhouette: f.querySelector(".wm-champion__portrait--vide") !== null,
      portraitCarre: (() => {
        const n = f.querySelector(".wm-champion__portrait");
        if (n === null) return null;
        const b = n.getBoundingClientRect();
        return { large: Math.round(b.width), haut: Math.round(b.height) };
      })(),
      cadres,
      renvois: Array.from(f.querySelectorAll("a.wm-renvoi")).map((a) => ({
        href: a.getAttribute("href"),
        quoi: a.querySelector(".wm-renvoi__quoi")?.textContent?.trim() ?? "",
        mot: a.querySelector(".wm-renvoi__mot")?.textContent?.trim() ?? "",
        haut: Math.round(a.getBoundingClientRect().height),
        fond: getComputedStyle(a).backgroundColor,
      })),
      //  La silhouette est posée en FOND du portrait, image comprise :
      //  une adresse morte doit montrer une silhouette, pas l'icône de
      //  l'image cassée.
      silhouetteSousLImage: (() => {
        const n = f.querySelector("img.wm-champion__portrait");
        if (n === null) return null;
        const s = getComputedStyle(n);
        return s.backgroundImage.includes("radial-gradient") &&
          s.color === "rgba(0, 0, 0, 0)";
      })(),
      large: Math.round(r.width),
      debord: f.scrollWidth > Math.ceil(r.width) + 1,
    };
  });

//  LES FICHES SONT DANS LE SOUS-ONGLET DES CHAMPIONS, qui est fermé à
//  l'arrivée : le premier onglet est celui des célébrités. Mesurer la
//  géométrie sans l'ouvrir donnait ZÉRO PARTOUT — et zéro passe toutes
//  les comparaisons « tient dans l'écran ». Le fragment l'ouvre, comme
//  le ferait un lien, et on attend que l'onglet soit actif.
async function ouvrirLesChampions(options = {}) {
  const p = await ouvrir(nav, { page: ENGENDREE.page, fragment: "#les-champions", ...options });
  await p.waitForFunction(
    () => {
      const s = document.querySelector('[data-wm-sous-onglet="les-champions"]');
      return s !== null && s.getBoundingClientRect().height > 0;
    },
    undefined,
    { timeout: 15000 },
  );
  return p;
}

if (ENGENDREE.ok) {
  const p = await ouvrirLesChampions();
  const vu = await p.evaluate(regarderLesChampions);
  const [pleine, nue] = vu;
  const eau = PAR_SLUG[ESSAI.pleine.arene];
  const dragon = PAR_SLUG[ESSAI.nue.arene];

  ok("les deux fiches sont rendues", vu.length === 2, vu.length);

  //  ── L'ARÈNE À LAQUELLE LE PRÉ-LIEN APPARTIENT ──────────────────
  //
  //  Le nom et la ville sont RELUS DANS `data/arenes.json`, pas
  //  recopiés ici : c'est toute la raison d'avoir un générateur.
  ok(
    "chaque fiche dit son arène et sa ville",
    pleine?.ou === `${eau.nom} · ${eau.ville}` && nue?.ou === `${dragon.nom} · ${dragon.ville}`,
    { pleine: pleine?.ou, nue: nue?.ou },
  );
  ok(
    "et montre le badge à gagner",
    pleine?.badge.endsWith(`/img/badges/${eau.slug}.png`),
    pleine?.badge,
  );
  ok("le nom est celui de la fiche", pleine?.nom === ESSAI.pleine.nom, pleine?.nom);

  //  ── LES TAGS : l'âge, le niveau, le caractère ───────────────────
  ok("la tranche d'âge s'affiche", pleine?.age?.mot === ESSAI.pleine.age, pleine?.age);
  ok(
    "le niveau vient de l'arène, pas de la fiche",
    pleine?.niveau?.mot === `niveau ${eau.niveau}` && nue?.niveau?.mot === `niveau ${dragon.niveau}`,
    { pleine: pleine?.niveau?.mot, nue: nue?.niveau?.mot, attendu: eau.niveau },
  );
  ok(
    "les traits sont là, un par mot du fichier",
    pleine?.traits.length === ESSAI.pleine.traits.length &&
      pleine.traits.every((t, i) => t.mot === ESSAI.pleine.traits[i]),
    pleine?.traits.map((t) => t.mot),
  );
  //  « SOUS FORME DE TAG » : du rembourrage, un coin rond, et un bord
  //  ou un fond. Sans ça, c'est une liste de mots séparés par des
  //  espaces — ce que ces trois mots étaient avant.
  ok(
    "et ils ressemblent à des tags — rembourrés, arrondis, cernés",
    pleine?.traits.every((t) => t.gauche >= 8 && t.bord > 0) &&
      pleine.age.rond >= 6 && pleine.age.haut >= 3 &&
      pleine.niveau.rond >= 6 && pleine.niveau.gauche >= 8,
    { trait: pleine?.traits[0], age: pleine?.age, niveau: pleine?.niveau },
  );
  //  TROIS DESSINS POUR TROIS CHOSES : l'âge, le niveau et un trait ne
  //  doivent pas se confondre. Deux fonds identiques, et « 25 – 30
  //  ans » se relit comme un trait de caractère de plus.
  ok(
    "l'âge, le niveau et un trait ne se confondent pas",
    new Set([pleine?.age?.fond, pleine?.niveau?.fond, "cerné"]).size === 3 &&
      pleine?.traits[0].bord > 0,
    { age: pleine?.age?.fond, niveau: pleine?.niveau?.fond },
  );

  //  ── LA PASTILLE DE TYPE ────────────────────────────────────────
  //
  //  Elle vient de l'ARÈNE, pas de la fiche, et c'est le composant
  //  `wm-type` du reste du forum — pas une pastille de plus. Elle
  //  gagne sa place sur les quatre colosseums, dont le nom ne dit pas
  //  le type : « Colosseum de Titanite » ne se lit pas Dragon.
  ok(
    "chaque fiche porte le type de son arène",
    pleine?.type?.mot === "Eau" && nue?.type?.mot === "Dragon",
    { pleine: pleine?.type?.mot, nue: nue?.type?.mot, attendu: [eau.type, dragon.type] },
  );
  ok(
    "et c'est la pastille wm-type du forum, pas une pastille de plus",
    pleine?.type?.classe.includes("wm-type--" + eau.type) &&
      nue?.type?.classe.includes("wm-type--" + dragon.type),
    [pleine?.type?.classe, nue?.type?.classe],
  );
  ok(
    "elle ouvre la rangée de tags",
    pleine?.type?.premier === true && nue?.type?.premier === true,
    { pleine: pleine?.type?.premier, nue: nue?.type?.premier },
  );
  //  DEUX TYPES, DEUX COULEURS : c'est ce qui distingue onze fiches
  //  d'affilée. Deux arènes de la même teinte, et le repère tombe.
  ok(
    "et deux arènes de types différents ne portent pas la même teinte",
    pleine?.type?.fond !== nue?.type?.fond,
    [pleine?.type?.fond, nue?.type?.fond],
  );

  //  ── LE PORTRAIT, CARRÉ, ET SA PLACE TENUE SANS IMAGE ───────────
  ok("la fiche pleine a son portrait", pleine?.portrait === true, pleine?.portrait);
  ok(
    "la fiche nue montre la silhouette, pas une image cassée",
    nue?.silhouette === true && nue?.portrait === false,
    { silhouette: nue?.silhouette, image: nue?.portrait },
  );
  //  UNE ADRESSE MORTE MONTRE LA SILHOUETTE, pas l'icône de l'image
  //  cassée — et surtout pas le texte que Forumactif colle dans
  //  l'attribut `alt` des images d'un message. Vu le 6 novembre sur
  //  t1003 : « Les Champions (V2) Portrait » en travers de la fiche.
  ok(
    "une image morte retombe sur la silhouette, sans texte de remplacement",
    pleine?.silhouetteSousLImage === true,
    pleine?.silhouetteSousLImage,
  );
  ok(
    "et les deux portraits sont carrés, de la même taille",
    pleine?.portraitCarre?.large === pleine?.portraitCarre?.haut &&
      pleine?.portraitCarre?.large === nue?.portraitCarre?.large,
    { pleine: pleine?.portraitCarre, nue: nue?.portraitCarre },
  );

  //  ── LES DEUX CADRES, FACE À FACE ───────────────────────────────
  ok(
    "la fiche pleine a ses deux cadres",
    pleine?.cadres.length === 2 &&
      pleine.cadres.map((c) => c.variante).join(",") === "affinite,rivalite",
    pleine?.cadres.map((c) => c.variante),
  );
  //  LA COULEUR NE PORTE RIEN : c'est l'étiquette qui dit lequel est
  //  lequel. Un joueur sur douze ne distingue pas le vert du rouge.
  ok(
    "et chacun dit en mots ce qu'il est",
    pleine?.cadres[0].etiquette.toLowerCase().startsWith("affinit") &&
      pleine?.cadres[1].etiquette.toLowerCase().startsWith("rivalit"),
    pleine?.cadres.map((c) => c.etiquette),
  );
  ok(
    "ils sont côte à côte, à la même hauteur et de la même largeur",
    pleine?.cadres.length === 2 &&
      pleine.cadres[0].haut === pleine.cadres[1].haut &&
      pleine.cadres[0].gauche < pleine.cadres[1].gauche &&
      Math.abs(pleine.cadres[0].large - pleine.cadres[1].large) <= 1,
    pleine?.cadres.map((c) => ({ haut: c.haut, gauche: c.gauche, large: c.large })),
  );
  ok(
    "les liens portent qui et pourquoi",
    pleine?.cadres[0].liens.length === ESSAI.pleine.affinites.length &&
      pleine.cadres[0].liens[0].qui === ESSAI.pleine.affinites[0][0] &&
      pleine.cadres[0].liens[0].quoi === ESSAI.pleine.affinites[0][1],
    pleine?.cadres[0].liens,
  );
  ok(
    "la note sous un cadre s'affiche quand il y en a une",
    pleine?.cadres[1].dit === ESSAI.pleine.ditRivalites &&
      pleine?.cadres[0].dit === "",
    { rivalites: pleine?.cadres[1].dit, affinites: pleine?.cadres[0].dit },
  );
  //  UN CADRE VIDE NE S'AFFICHE PAS. « Rivalités : néant » encadré
  //  prend la place d'une information sans en être une.
  ok(
    "une fiche sans relations n'affiche aucun cadre",
    nue?.cadres.length === 0,
    nue?.cadres.map((c) => c.variante),
  );

  //  ── OÙ ÇA MÈNE ────────────────────────────────────────────────
  //
  //  L'adresse du forum vient de `data/arenes.json`, celle de l'annexe
  //  du sommaire — numéro compris. Forumactif ne route que sur le
  //  numéro : une adresse écrite à la main mène ailleurs en silence le
  //  jour où le numéro glisse.
  const sommaire = json("data/annexes.json").sections
    .flatMap((s) => s.entrees)
    .find((x) => x.slug === "arenes-colosseums-ligues");
  ok(
    "chaque fiche mène à son arène, à l'adresse du fichier",
    pleine?.renvois[0]?.href === eau.forum && nue?.renvois[0]?.href === dragon.forum,
    { pleine: pleine?.renvois[0]?.href, attendu: eau.forum },
  );
  ok(
    "et le bouton porte le nom de l'arène",
    pleine?.renvois[0]?.mot === eau.nom,
    pleine?.renvois[0],
  );
  //  ALLÉGÉS, MAIS PAS RÉTRÉCIS. Dans une fiche les deux boutons
  //  perdent leur fond et quatre pixels de hauteur — ils pesaient
  //  plus lourd que le nom du personnage. 44 px reste 44 px : c'est
  //  un minimum de cible tactile, pas une décoration.
  ok(
    "les renvois d'une fiche sont allégés — sans fond",
    [...(pleine?.renvois ?? []), ...(nue?.renvois ?? [])]
      .every((r) => r.fond === "rgba(0, 0, 0, 0)"),
    pleine?.renvois.map((r) => r.fond),
  );
  ok(
    "mais gardent leurs 44 pixels de cible tactile",
    [...(pleine?.renvois ?? []), ...(nue?.renvois ?? [])]
      .every((r) => r.haut >= 44),
    [...(pleine?.renvois ?? []), ...(nue?.renvois ?? [])].map((r) => r.haut),
  );
  ok(
    "puis à l'annexe des arènes, prise au sommaire",
    pleine?.renvois[1]?.href === sommaire?.adresse &&
      pleine?.renvois[1]?.quoi.includes(sommaire?.numero),
    { vu: pleine?.renvois[1], sommaire },
  );

  //  ── LE CONTRASTE, DANS LES DEUX THÈMES ────────────────────────
  //
  //  `outils/contraste.mjs` ne verra JAMAIS ces textes : il mesure la
  //  page du dépôt, où la section n'existe pas. C'est ici ou nulle
  //  part. Et le noir pur est sa propre alerte — il veut dire qu'aucune
  //  couleur n'est déclarée, ce qui se lit très bien en thème clair et
  //  disparaît en sombre. La leçon du 4 novembre, sur ces fiches-là.
  const MOTS = [
    ".wm-champion__ou",
    ".wm-type",
    ".wm-champion__nom",
    ".wm-champion__age",
    ".wm-champion__niveau",
    ".wm-champion__trait",
    ".wm-champion__texte",
    ".wm-relation__etiquette",
    ".wm-relation__qui",
    ".wm-relation__quoi",
    ".wm-relation__dit",
  ];
  for (const theme of ["light", "dark"]) {
    const q = await ouvrirLesChampions({ theme });
    const lu = await q.evaluate((quoi) => {
      //  ── LIRE UNE COULEUR, ET PAS SEULEMENT UN `rgb()` ───────────
      //
      //  CHROMIUM REND UN `color-mix` EN `color(srgb 0.91 0.92 0.89)`,
      //  en fractions de 1 — pas en 0-255. Le lecteur naïf divisait
      //  0,91 par 255 et lisait du noir : les deux cadres, dont le
      //  fond EST un `color-mix`, sortaient à 1,33 contre 1 en thème
      //  clair alors que le texte y est à onze.
      //
      //  La leçon était déjà payée dans `outils/contraste.mjs`, qui
      //  lit les deux formes depuis le début — elle n'avait pas été
      //  reportée ici ni dans `outils/faune.mjs`.
      const canaux = (c) => {
        const n = (c.match(/-?\d*\.?\d+/g) ?? []).map(Number);
        return /^color\(/.test(c) ? n.slice(0, 3).map((v) => v * 255) : n.slice(0, 3);
      };
      const lum = (c) => {
        const [r, g, b] = canaux(c).map((v) => {
          const x = v / 255;
          return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
        });
        return 0.2126 * r + 0.7152 * g + 0.0722 * b;
      };
      const fond = (n) => {
        let e = n;
        while (e !== null) {
          const c = getComputedStyle(e).backgroundColor;
          if (c !== "rgba(0, 0, 0, 0)" && !/, 0\)$/.test(c)) return c;
          e = e.parentElement;
        }
        return "rgb(255, 255, 255)";
      };
      const out = [];
      for (const s of quoi) {
        for (const n of Array.from(document.querySelectorAll(s)).slice(0, 2)) {
          if ((n.textContent ?? "").trim() === "") continue;
          const [x, y] = [lum(getComputedStyle(n).color), lum(fond(n))].sort((a, b) => b - a);
          out.push({
            quoi: s,
            couleur: getComputedStyle(n).color,
            rapport: Math.round(((x + 0.05) / (y + 0.05)) * 100) / 100,
          });
        }
      }
      return out;
    }, MOTS);
    await q.close();
    const nus = [...new Set(lu.filter((m) => m.couleur === "rgb(0, 0, 0)").map((m) => m.quoi))];
    ok(`${theme} · aucun texte sans couleur déclarée`, nus.length === 0, nus);
    const bas = lu.filter((m) => m.rapport < 4.5);
    ok(
      `${theme} · les ${lu.length} textes de la fiche tiennent 4,5:1`,
      bas.length === 0,
      bas.map((m) => `${m.quoi} ${m.rapport}:1`),
    );
  }

  //  ── ET À 390 ─────────────────────────────────────────────────
  {
    const q = await ouvrirLesChampions({ largeur: 390 });
    const etroit = await q.evaluate(regarderLesChampions);
    const debordPage = await q.evaluate(() =>
      document.documentElement.scrollWidth > window.innerWidth + 1
    );
    await q.close();
    ok("à 390, rien ne déborde de la page", !debordPage);
    ok(
      "aucune fiche ne déborde d'elle-même",
      etroit.every((f) => !f.debord && f.large <= 390),
      etroit.map((f) => ({ large: f.large, debord: f.debord })),
    );
    //  LES DEUX CADRES PASSENT L'UN SOUS L'AUTRE. Côte à côte dans 320
    //  pixels, ils tenaient trois mots par ligne.
    ok(
      "et les deux cadres passent l'un sous l'autre",
      etroit[0]?.cadres.length === 2 &&
        etroit[0].cadres[0].haut < etroit[0].cadres[1].haut &&
        etroit[0].cadres[0].gauche === etroit[0].cadres[1].gauche,
      etroit[0]?.cadres.map((c) => ({ haut: c.haut, gauche: c.gauche })),
    );
  }
  await p.close();
}

console.log("\n── à 390 pixels ──");
{
  const q = await ouvrir(nav, { largeur: 390 });
  await q.waitForFunction(() => document.querySelectorAll(".wm-filtre").length > 0, undefined, {
    timeout: 15000,
  });
  const vu = await q.evaluate(() => ({
    debord: document.documentElement.scrollWidth > window.innerWidth + 1,
    large: document.documentElement.scrollWidth,
    fiche: document.querySelector(".wm-perso")?.getBoundingClientRect().width ?? 0,
  }));
  ok("rien ne déborde", !vu.debord, vu);
  ok("et une fiche tient dans l'écran", vu.fiche > 0 && vu.fiche <= 390, vu.fiche);
  await q.close();
}

await p.close();
await nav.close();

console.log(`\n${passes} contrôles passés.`);
if (soucis.length > 0) {
  console.log(`\n${soucis.length} PROBLÈME(S) :`);
  for (const s of soucis) console.log(`  · ${s}`);
  Deno.exit(1);
}
console.log("TOUT PASSE.");
