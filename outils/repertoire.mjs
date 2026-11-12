// ════════════════════════════════════════════════════════════════════
//  outils/repertoire.mjs — le répertoire des personnages, dans un vrai
//  navigateur.
//
//  COUVRE : src/adaptateurs/navigateur/module-repertoire.ts
//           outils/repertoire.py
//           css/27-repertoire.css
//
//      deno run -A outils/repertoire.mjs
//      deno run -A outils/repertoire.mjs --photo   rend repertoire-<thème>.png
//
//  ── CE QU'IL REGARDE, ET QU'AUCUN TEST SANS NAVIGATEUR NE VERRAIT ──
//
//    · SANS LE SCRIPT, tous les personnages sont là et visibles. C'est
//      la règle du projet et elle compte double ici : le contenu de la
//      page EST la liste. Une page qui dessinerait ses cartes en
//      script serait blanche ;
//    · avec le script, la barre se pose, et SES MENUS SONT CEUX DES
//      CARTES — relus dans la page, pas recopiés. Un menu qui propose
//      une valeur qu'aucune carte ne porte ne retient personne, et ça
//      ne se voit qu'au clic ;
//    · un filtre ne cache QUE ce qu'il doit, et ce qui est mesuré est
//      ce qui est VISIBLE À L'ÉCRAN, pas un attribut : `hidden` ne
//      cache pas un élément en `display: flex`, et c'est la faute
//      classique ;
//    · « Tout afficher » rend la page entière, champ compris ;
//    · LES CARTES D'UNE RANGÉE FONT LA MÊME LARGEUR ET LA MÊME
//      HAUTEUR, et les trois faits tombent à la même ligne quelle que
//      soit la longueur du caractère au-dessus. C'est la demande du
//      10 novembre sur les cases de pokémon, et elle vaut ici ;
//    · LA PASTILLE DE GROUPE EST DANS L'IMAGE. Posée en `absolute`,
//      une pastille sœur du cadre s'accrocherait au premier parent
//      positionné et partirait en haut de la page ;
//    · trois ou quatre cartes par rangée selon la largeur, et rien ne
//      déborde à 390 ;
//    · LE TEXTE CHERCHABLE ÉCRIT PAR PYTHON TROUVE CE QUE LE MODULE
//      CHERCHE. `sans_accent()` en Python et `sansAccent()` en
//      TypeScript sont deux fonctions ; cette mesure est la seule qui
//      les tienne d'accord.
//
//  LE DÉCOR SERT LA VRAIE PAGE : celle qu'écrit `outils/repertoire.py`
//  et `js/annexes.js` tel qu'il sera servi. Le fichier livré est VIDE
//  tant que les personnages ne sont pas écrits, donc la page d'essai
//  est générée par le MÊME outil sur des données d'essai — pas
//  réécrite ici, ce qui reviendrait à mesurer autre chose que ce qu'on
//  colle.
// ════════════════════════════════════════════════════════════════════

import { readFileSync, writeFileSync } from "node:fs";
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

const PIXEL = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

// ── les données d'essai ─────────────────────────────────────────────
//
//  HUIT PERSONNAGES, choisis pour les écarts : deux clans partagés,
//  deux lieux partagés, une origine unique (Unys) qui doit quand même
//  figurer au menu, un caractère long et un court pour éprouver
//  l'alignement des faits, un portrait MORT, une carte sans fiche de
//  liens, une sans présentation, et un clan inconnu que le générateur
//  doit signaler sans poser de pastille.
const MORTE = "https://exemple.test/morte.png";
const GENS = [
  ["Ana Vasquez", "hardi", "Fleuriste", "Franche, têtue, incapable de laisser passer une injustice même quand elle n'est pas la sienne.", "Lumirandé", "24 ans", "Rhode", "Jessica Henwick", "/t1-a", "/t2-a", "https://exemple.test/0.png"],
  ["Bo Ferrand", "serieux", "Pêcheur", "Bourru.", "Port-Varène", "41 ans", "Kanto", "Pedro Pascal", "", "/t3-b", "https://exemple.test/1.png"],
  ["Cy Nakamura", "doux", "Infirmier", "Patient jusqu'à l'épuisement. Dort peu, écoute beaucoup.", "Lumirandé", "29 ans", "Johto", "Steven Yeun", "/t4-c", "", "https://exemple.test/2.png"],
  ["Dalia Okonkwo", "brave", "Rangère", "Ne recule pas. Pose les questions après.", "Steppes arides", "33 ans", "Unys", "Lupita Nyong'o", "/t5-d", "/t6-d", MORTE],
  ["Elio Marchetti", "jovial", "Géologue", "Curieux comme un enfant, ouvre tout ce qui est fermé.", "Samaragd", "26 ans", "Rhode", "Timothée Chalamet", "/t7-e", "/t8-e", "https://exemple.test/4.png"],
  ["Faye Lindqvist", "malin", "Marchande", "Sait ce que vaut chaque chose, et ce que vaut chaque personne.", "Port-Varène", "37 ans", "Sinnoh", "Alicia Vikander", "/t9-f", "/t10-f", "https://exemple.test/5.png"],
  ["Gil Abadie", "hardi", "Mineur", "Monte d'abord, réfléchit plus haut.", "Monts Enneigés", "31 ans", "Rhode", "", "", "/t11-g", "https://exemple.test/6.png"],
  ["Hana Toriyama", "fantaisiste", "Étudiante", "Timide à l'oral, redoutable par écrit.", "Samaragd", "19 ans", "Johto", "Sakura Ando", "/t12-h", "/t13-h", ""],
];

const ESSAI = {
  titre: "Répertoire des personnages",
  surtitre: "Les habitants de Rhode",
  intro: "Tous les personnages validés du forum.",
  personnages: GENS.map(
    ([nom, groupe, metier, caractere, lieu, age, origine, faceclaim, liens, presentation, avatar]) => ({
      nom,
      groupe,
      metier,
      caractere,
      lieu,
      age,
      origine,
      faceclaim,
      liens,
      presentation,
      avatar,
    }),
  ),
};

//  LA PAGE EST ÉCRITE PAR L'OUTIL, pas par ce fichier.
const DOSSIER = `${R}.essai-repertoire`;
await Deno.mkdir(DOSSIER, { recursive: true });
writeFileSync(`${DOSSIER}/donnees.json`, JSON.stringify(ESSAI), "utf8");
const gen = new Deno.Command("python3", {
  args: [
    `${R}outils/repertoire.py`,
    "--donnees",
    `${DOSSIER}/donnees.json`,
    "--sortie",
    `${DOSSIER}/page.html`,
  ],
  stdout: "piped",
  stderr: "piped",
});
const sortieGen = await gen.output();
const DIT = new TextDecoder().decode(sortieGen.stdout);
if (!sortieGen.success) {
  console.error(new TextDecoder().decode(sortieGen.stderr));
  Deno.exit(1);
}
const PAGE = readFileSync(`${DOSSIER}/page.html`, "utf8");

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

async function ouvrir(nav, { avecScript = true, largeur = 1440, theme = undefined } = {}) {
  const p = await nav.newPage({
    viewport: { width: largeur, height: 1000 },
    ...(theme === undefined ? {} : { colorScheme: theme }),
  });
  p.on("pageerror", (e) => soucis.push("erreur JS : " + e.message));

  await p.route("**/*", (r) => {
    const u = r.request().url();
    const rendre = (type, corps) => r.fulfill({ contentType: type, body: corps });
    if (/\/repertoire$/.test(u)) return rendre("text/html; charset=utf-8", PAGE);
    if (/jetons\.css$/.test(u)) return rendre("text/css", lire("panneau-admin/jetons.css"));
    if (/wild-mystery\.css$/.test(u)) return rendre("text/css", lire("css/wild-mystery.css"));
    if (/\/js\/annexes\.js$/.test(u)) {
      return rendre("text/javascript", avecScript ? lire("js/annexes.js") : "");
    }
    //  Le fichier du sommaire : la page n'a pas de `[data-wm-sommaire]`,
    //  donc le paquet ne devrait même pas le demander. S'il le
    //  demande, c'est une requête de trop sur chaque visite.
    if (/\/data\/annexes\.json$/.test(u)) {
      soucis.push("le paquet demande annexes.json sur une page sans sommaire");
      return r.fulfill({ status: 404, body: "" });
    }
    if (u === MORTE) return r.fulfill({ status: 404, body: "" });
    if (/\.(png|jpe?g|gif)/.test(u)) return r.fulfill({ contentType: "image/png", body: PIXEL });
    if (/fonts\.(googleapis|gstatic)/.test(u)) return rendre("text/css", "");
    return r.fulfill({ status: 404, body: "" });
  });

  await p.goto("https://exemple.test/repertoire", { waitUntil: "domcontentloaded" });
  return p;
}

/** Ce qui est VISIBLE à l'écran. Une carte en `hidden` dont la feuille
 *  dirait `display: flex` resterait à l'écran : on mesure la boîte. */
const regarder = () => {
  const r = (e) => e.getBoundingClientRect();
  return {
    cartes: Array.from(document.querySelectorAll(".wm-repertoire__carte")).map((c) => ({
      nom: c.querySelector(".wm-repertoire__nom")?.textContent?.trim() ?? "",
      vue: r(c).height > 0,
      largeur: Math.round(r(c).width),
      hauteur: Math.round(r(c).height),
      haut: Math.round(r(c).top),
      groupe: c.dataset.wmGroupe,
      //  Le haut du bloc des faits, pour vérifier qu'il tombe à la
      //  même ligne sur toute une rangée.
      faits: c.querySelector(".wm-repertoire__faits") === null
        ? null
        : Math.round(r(c.querySelector(".wm-repertoire__faits")).top),
      pastille: (() => {
        const el = c.querySelector(".wm-repertoire__groupe");
        if (el === null) return null;
        const cadre = r(c.querySelector(".wm-repertoire__cadre"));
        const b = r(el);
        return {
          mot: el.textContent.trim(),
          //  Dans l'image, en haut à droite : les deux écarts se
          //  mesurent, un mot ne suffit pas.
          dedans: b.top >= cadre.top && b.bottom <= cadre.bottom &&
            b.right <= cadre.right + 0.5,
          haut: Math.round(b.top - cadre.top),
          droite: Math.round(cadre.right - b.right),
        };
      })(),
      //  LE FILET DU PIED : il doit être là même quand le faceclaim
      //  manque, sinon les boutons se collent aux trois faits.
      filet: (() => {
        const el = c.querySelector(".wm-repertoire__pied");
        return el === null ? null : {
          sur: el.className.includes("__fc") ? "fc" : "liens",
          epais: getComputedStyle(el).borderTopWidth,
        };
      })(),
      portrait: c.querySelector("img.wm-repertoire__portrait") !== null,
      vide: c.querySelector(".wm-repertoire__portrait--vide") !== null,
      liens: Array.from(c.querySelectorAll(".wm-repertoire__lien")).map((a) =>
        a.textContent.trim()
      ),
    })),
    menus: Array.from(document.querySelectorAll(".wm-repertoire__menu")).map((s) => ({
      colonne: s.dataset.wmColonne,
      choix: Array.from(s.options).map((o) => o.value),
    })),
    champ: document.querySelector(".wm-repertoire__saisie") !== null,
    vider: document.querySelector(".wm-repertoire__vider") !== null,
    annonce: document.querySelector(".wm-repertoire__compte")?.textContent?.trim() ?? "",
  };
};

const nav = await chromium.launch(CHROME === undefined ? {} : { executablePath: CHROME });

// ════════════════════════════════════════════════════════════════════
//  0 · CE QUE LE GÉNÉRATEUR DIT
// ════════════════════════════════════════════════════════════════════
console.log("\n── le générateur ──");
ok(
  "il signale le clan inconnu au lieu de poser une pastille muette",
  /groupe « fantaisiste » inconnu/.test(DIT),
  DIT.trim(),
);
ok("et il annonce les huit personnages", /8 personnage\(s\)/.test(DIT), DIT.trim());

// ════════════════════════════════════════════════════════════════════
//  1 · SANS LE SCRIPT
// ════════════════════════════════════════════════════════════════════
console.log("\n── sans JavaScript : tout le monde est là ──");
{
  const p = await ouvrir(nav, { avecScript: false });
  const vu = await p.evaluate(regarder);
  ok(
    `les ${GENS.length} cartes sont dans la page et visibles`,
    vu.cartes.length === GENS.length && vu.cartes.every((c) => c.vue),
    vu.cartes.map((c) => [c.nom, c.vue]),
  );
  //  LA BARRE EST POSÉE PAR LE SCRIPT, JAMAIS ÉCRITE DANS LA PAGE.
  //  Écrite, un filtre cacherait des personnages que rien ne pourrait
  //  plus rouvrir.
  ok("et il n'y a ni champ ni menu", !vu.champ && vu.menus.length === 0, vu.menus);
  await p.close();
}

// ════════════════════════════════════════════════════════════════════
//  2 · LA BARRE, ET SES MENUS
// ════════════════════════════════════════════════════════════════════
console.log("\n── avec le script ──");
const p = await ouvrir(nav);
await p.waitForTimeout(300);
{
  const vu = await p.evaluate(regarder);
  ok("la barre se pose : un champ, des menus, un bouton", vu.champ && vu.vider, vu);

  //  LES MENUS VIENNENT DES CARTES. Les attendus sont recalculés ici
  //  depuis les données d'essai : une constante écrite à la main ne
  //  comparerait que deux fautes possibles.
  const attendu = (i) =>
    [...new Set(GENS.map((g) => g[i]).filter((v) => v !== ""))].sort((a, b) =>
      a.localeCompare(b, "fr")
    );
  //  Le clan « fantaisiste » n'existe pas : sa carte n'a pas de
  //  groupe, donc il n'est pas au menu — et elle reste affichée.
  const clans = { hardi: "Hardi", serieux: "Sérieux", malin: "Malin", doux: "Doux", brave: "Brave", jovial: "Jovial" };
  const groupesAttendus = [...new Set(GENS.map((g) => clans[g[1]]).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, "fr"));

  ok(
    "trois menus, dans l'ordre : groupe, lieu, origine",
    vu.menus.map((m) => m.colonne).join(",") === "groupe,lieu,origine",
    vu.menus.map((m) => m.colonne),
  );
  ok(
    "et leurs choix sont ceux des cartes, « Tous » en tête",
    JSON.stringify(vu.menus[0].choix) === JSON.stringify(["", ...groupesAttendus]) &&
      JSON.stringify(vu.menus[1].choix) === JSON.stringify(["", ...attendu(4)]) &&
      JSON.stringify(vu.menus[2].choix) === JSON.stringify(["", ...attendu(6)]),
    vu.menus,
  );
  ok(
    "le clan inconnu n'est pas au menu, mais sa carte reste affichée",
    !vu.menus[0].choix.includes("fantaisiste") &&
      vu.cartes.find((c) => c.nom === "Hana Toriyama")?.vue === true,
    vu.menus[0].choix,
  );
  ok(
    `l'annonce dit les ${GENS.length} personnages`,
    vu.annonce === `${GENS.length} personnages`,
    vu.annonce,
  );
}

// ════════════════════════════════════════════════════════════════════
//  3 · FILTRER
// ════════════════════════════════════════════════════════════════════
console.log("\n── filtrer ──");
const vuesApres = async (quoi) => {
  await p.waitForTimeout(80);
  const vu = await p.evaluate(regarder);
  return { noms: vu.cartes.filter((c) => c.vue).map((c) => c.nom), annonce: vu.annonce, quoi };
};

await p.selectOption(".wm-repertoire__menu[data-wm-colonne='lieu']", "Lumirandé");
{
  const vu = await vuesApres("lieu");
  ok(
    "un menu ne garde que sa valeur — et le compte le dit",
    JSON.stringify(vu.noms) === JSON.stringify(["Ana Vasquez", "Cy Nakamura"]) &&
      vu.annonce === `2 personnages sur ${GENS.length}`,
    vu,
  );
}

await p.selectOption(".wm-repertoire__menu[data-wm-colonne='groupe']", "Doux");
{
  const vu = await vuesApres("deux menus");
  ok(
    "deux menus se cumulent",
    JSON.stringify(vu.noms) === JSON.stringify(["Cy Nakamura"]) &&
      vu.annonce === `1 personnage sur ${GENS.length}`,
    vu,
  );
}

await p.click(".wm-repertoire__vider");
{
  const vu = await vuesApres("vider");
  ok(
    "« Tout afficher » rend la page entière",
    vu.noms.length === GENS.length && vu.annonce === `${GENS.length} personnages`,
    vu,
  );
}

//  LE PONT ENTRE PYTHON ET TYPESCRIPT. « lumirande » sans accent doit
//  trouver « Lumirandé » : `sans_accent()` écrit le texte cherchable,
//  `sansAccent()` le compare, et ce sont deux fonctions.
await p.fill(".wm-repertoire__saisie", "lumirande");
{
  const vu = await vuesApres("recherche sans accent");
  ok(
    "la recherche ignore les accents — Python et TypeScript s'accordent",
    JSON.stringify(vu.noms) === JSON.stringify(["Ana Vasquez", "Cy Nakamura"]),
    vu,
  );
}

await p.fill(".wm-repertoire__saisie", "pascal");
{
  const vu = await vuesApres("faceclaim");
  ok(
    "elle trouve par faceclaim, ce que le bottin ne dit pas",
    JSON.stringify(vu.noms) === JSON.stringify(["Bo Ferrand"]),
    vu,
  );
}

await p.fill(".wm-repertoire__saisie", "zzzz");
{
  const vu = await vuesApres("rien");
  ok(
    "et quand rien ne correspond, elle le dit",
    vu.noms.length === 0 && vu.annonce === "Aucun personnage ne correspond",
    vu,
  );
}

await p.click(".wm-repertoire__vider");
await p.waitForTimeout(80);
{
  const vu = await p.evaluate(() => ({
    saisie: document.querySelector(".wm-repertoire__saisie").value,
    menus: Array.from(document.querySelectorAll(".wm-repertoire__menu")).map((s) => s.value),
    vues: Array.from(document.querySelectorAll(".wm-repertoire__carte"))
      .filter((c) => c.getBoundingClientRect().height > 0).length,
  }));
  //  LE BOUTON VIDE AUSSI LES CHAMPS. Une barre qui montre « Doux »
  //  dans son menu alors que tout le monde est affiché ment sur l'état
  //  de la page.
  ok(
    "et il remet le champ et les menus à zéro, pas seulement les cartes",
    vu.saisie === "" && vu.menus.every((m) => m === "") && vu.vues === GENS.length,
    vu,
  );
}

// ════════════════════════════════════════════════════════════════════
//  4 · LA CARTE
// ════════════════════════════════════════════════════════════════════
console.log("\n── la carte ──");
{
  const vu = await p.evaluate(regarder);
  const rangee = (haut) => vu.cartes.filter((c) => Math.abs(c.haut - haut) < 2);
  const premiere = rangee(vu.cartes[0].haut);

  ok(
    `${premiere.length} cartes sur la première rangée à 1440 px`,
    premiere.length === 4,
    premiere.map((c) => c.nom),
  );
  //  MÊME LARGEUR ET MÊME HAUTEUR. Des cartes qui ne se ressemblent
  //  pas se lisent une par une au lieu de se comparer.
  ok(
    "elles font toutes la même largeur et la même hauteur",
    new Set(premiere.map((c) => c.largeur)).size === 1 &&
      new Set(premiere.map((c) => c.hauteur)).size === 1,
    premiere.map((c) => [c.nom, c.largeur, c.hauteur]),
  );
  //  LES FAITS SONT COLLÉS EN BAS, l'espace est au-dessus. Le
  //  caractère d'Ana fait trois lignes et celui de Bo un seul mot :
  //  sans `margin-top: auto`, leurs trois faits ne tomberaient pas à
  //  la même ligne.
  ok(
    "et leurs trois faits tombent à la même ligne malgré des textes inégaux",
    new Set(premiere.map((c) => c.faits)).size === 1,
    premiere.map((c) => [c.nom, c.faits]),
  );

  //  Gil n'a pas de faceclaim : son filet doit passer sur les boutons.
  ok(
    "le filet du pied est là même sans faceclaim",
    vu.cartes.every((c) => c.filet !== null && c.filet.epais === "1px") &&
      vu.cartes.find((c) => c.nom === "Gil Abadie").filet.sur === "liens" &&
      vu.cartes.find((c) => c.nom === "Ana Vasquez").filet.sur === "fc",
    vu.cartes.map((c) => [c.nom, c.filet]),
  );

  const ana = vu.cartes.find((c) => c.nom === "Ana Vasquez");
  ok(
    "la pastille de clan est DANS l'image, en haut à droite",
    ana.pastille.dedans && ana.pastille.haut === 8 && ana.pastille.droite === 8,
    ana.pastille,
  );
  ok(
    "le portrait mort laisse un cadre vide, pas une image cassée",
    vu.cartes.find((c) => c.nom === "Dalia Okonkwo").vide === true,
    vu.cartes.map((c) => [c.nom, c.portrait, c.vide]),
  );
  ok(
    "une carte sans avatar n'a pas de balise image du tout",
    vu.cartes.find((c) => c.nom === "Hana Toriyama").portrait === false,
    vu.cartes.map((c) => [c.nom, c.portrait]),
  );
  //  ON NE CLIQUE PAS DANS LE VIDE : un sujet manquant n'a pas de
  //  bouton, il n'a pas un bouton mort.
  ok(
    "un lien manquant n'affiche pas de bouton",
    JSON.stringify(vu.cartes.find((c) => c.nom === "Bo Ferrand").liens) ===
      JSON.stringify(["Présentation"]) &&
      JSON.stringify(vu.cartes.find((c) => c.nom === "Cy Nakamura").liens) ===
        JSON.stringify(["Liens"]),
    vu.cartes.map((c) => [c.nom, c.liens]),
  );
}

// ════════════════════════════════════════════════════════════════════
//  5 · LES LARGEURS
// ════════════════════════════════════════════════════════════════════
console.log("\n── les largeurs ──");
for (const [largeur, attendu] of [[1440, 4], [1100, 3], [820, 2], [390, 1]]) {
  await p.setViewportSize({ width: largeur, height: 1000 });
  await p.waitForTimeout(120);
  const vu = await p.evaluate(() => {
    const cartes = Array.from(document.querySelectorAll(".wm-repertoire__carte"));
    const haut = Math.round(cartes[0].getBoundingClientRect().top);
    return {
      rangee: cartes.filter((c) => Math.abs(c.getBoundingClientRect().top - haut) < 2).length,
      //  RIEN NE DÉBORDE : un débordement horizontal fait glisser la
      //  page entière sous le doigt.
      trop: Array.from(document.querySelectorAll("#modernbb *"))
        .filter((e) => e.getBoundingClientRect().right > document.documentElement.clientWidth + 1)
        .map((e) => e.className).slice(0, 3),
    };
  });
  ok(`à ${largeur} px, ${vu.rangee} carte(s) par rangée`, vu.rangee === attendu, vu);
  ok(`à ${largeur} px, rien ne déborde`, vu.trop.length === 0, vu.trop);
}
await p.setViewportSize({ width: 1440, height: 1000 });

// ════════════════════════════════════════════════════════════════════
//  6 · LA PAGE VIDE
// ════════════════════════════════════════════════════════════════════
//  C'est l'état du fichier livré, et il ne doit pas ressembler à une
//  panne : la page dit qu'elle attend des fiches, et la barre ne se
//  pose pas au-dessus de rien.
console.log("\n── la page sans personne ──");
{
  //  ON LA GÉNÈRE, on ne lit pas la page livrée : celle-ci porte depuis
  //  le 12 novembre cinq comptes d'essai, et un contrôle qui dépendrait
  //  de son contenu rougirait le jour où on la remplit pour de bon.
  writeFileSync(`${DOSSIER}/vide.json`, JSON.stringify({ ...ESSAI, personnages: [] }), "utf8");
  const g = await new Deno.Command("python3", {
    args: [`${R}outils/repertoire.py`, "--donnees", `${DOSSIER}/vide.json`, "--sortie",
      `${DOSSIER}/vide.html`],
    stdout: "piped",
    stderr: "piped",
  }).output();
  ok("l'outil accepte une liste vide", g.success);
  const vide = readFileSync(`${DOSSIER}/vide.html`, "utf8");
  ok("elle dit ce qu'elle attend", /wm-repertoire__rien/.test(vide));
  ok("et elle n'a pas de grille à filtrer", !/data-wm-repertoire/.test(vide));
}

// ── photo ───────────────────────────────────────────────────────────
if (Deno.args.includes("--photo")) {
  for (const theme of ["clair", "sombre"]) {
    await p.evaluate(
      (t) => document.body.classList.toggle("wm-sombre", t === "sombre"),
      theme,
    );
    await p.evaluate(() => document.activeElement?.blur());
    await p.waitForTimeout(100);
    await p.screenshot({ path: `${R}repertoire-${theme}.png`, fullPage: false });
  }
  console.log("photos : repertoire-<thème>.png");
}

await p.close();
await nav.close();
await Deno.remove(DOSSIER, { recursive: true });

console.log(soucis.length === 0 ? `\nTOUT PASSE (${passes}).` : `\n${soucis.length} DÉFAUT(S).`);
for (const s of soucis) console.log("  · " + s);
if (soucis.length > 0) Deno.exit(1);
