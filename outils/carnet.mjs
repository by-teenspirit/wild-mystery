// ════════════════════════════════════════════════════════════════════
//  outils/carnet.mjs — le harnais du carnet de bord
//
//  Ce qu'il monte : la page `pages/carnet.html` SERVIE À SON ADRESSE
//  RÉELLE, `https://mysteryinrhode.forumactif.com/h15-mon-carnet`, avec
//  le vrai paquet `js/carnet.js`, les vraies feuilles et les vraies
//  données du dépôt. Seul l'appel à Supabase est joué par le décor —
//  c'est la seule chose qu'on ne peut pas servir depuis des fichiers.
//
//  POURQUOI L'ADRESSE RÉELLE. `contraste.mjs` l'a appris le 2 novembre
//  sur les annexes : servir la page sur `about:blank` cachait deux
//  vrais défauts de thème sombre, parce que les règles qui dépendent de
//  l'origine ne s'appliquaient pas. Une page servie ailleurs qu'où elle
//  vit ne teste qu'elle-même.
//
//  ── CE QUE CE HARNAIS GARDE, ET QUI NE SE VOIT PAS AUTREMENT ────────
//
//  1. **Un seul appel, et aucun en changeant d'onglet.** C'est LA
//     contrainte de la note 371:707, et elle est invisible à l'œil :
//     une page qui refait une requête par onglet marche très bien et
//     coûte six fois plus.
//  2. **Sans clé, aucune requête.** Une page qui appellerait quand
//     même enverrait une clé vide à chaque ouverture.
//  3. **Un refus parle français.** `CLE_INVALIDE` dans une page de jeu
//     ne veut rien dire pour la joueuse qui vient de coller sa clé.
//  4. **La clé n'est gardée qu'après avoir servi.** Sinon une clé
//     fausse s'installe et la page rouvre sur la même erreur.
//  5. **Rien ne se clique qui modifie les données.** Le carnet montre.
// ════════════════════════════════════════════════════════════════════

import { readFileSync } from "node:fs";
import { chromium } from "npm:playwright@1.49.1";

const R = new URL("..", import.meta.url).pathname;
const ADRESSE = "https://mysteryinrhode.forumactif.com/h15-mon-carnet";
const BASE = "https://by-teenspirit.github.io/wild-mystery/";

const CHEMINS = [
  "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
  "/opt/pw-browsers/chromium/chrome-linux64/chrome",
];
let CHROME;
for (const c of CHEMINS) {
  try {
    Deno.statSync(c);
    CHROME = c;
    break;
  } catch { /* suivant */ }
}
if (CHROME === undefined) {
  for (const base of ["/root/.cache/ms-playwright", "/opt/pw-browsers"]) {
    try {
      for (const e of Deno.readDirSync(base)) {
        if (!e.name.startsWith("chromium")) continue;
        for (const n of ["chrome-linux/chrome", "chrome-linux64/chrome"]) {
          const c = `${base}/${e.name}/${n}`;
          try {
            Deno.statSync(c);
            CHROME = c;
          } catch { /* suivant */ }
        }
      }
    } catch { /* suivant */ }
  }
}
if (CHROME === undefined) {
  console.error("Aucun Chromium trouvé. `deno task test:navigateur` en installe un.");
  Deno.exit(1);
}

const CLE = "a1b2c3d4e5f60718293a4b5c6d7e8f90";

/*  LA RÉPONSE DE `carnet()`, dans la forme exacte que la migration
    0019 rend. Les identifiants d'espèce sont réels — Onix, Pikachu,
    Carapuce — parce que la page va chercher leurs noms dans le vrai
    `especes.json` : avec des numéros inventés, la colonne des noms
    serait vide et le harnais ne le verrait pas.

    UN POKÉMON EN PENSION QUI GARDE SA PLACE, et un en boîte : les deux
    cas que `equipeAffichee` doit traiter différemment, et qui se
    ressemblent assez pour qu'une inversion passe inaperçue. */
const CARNET = {
  dresseur: {
    joueurId: "eeee0000-0000-0000-0000-000000000001",
    forumUserId: 4,
    pseudo: "Eliott Vanner",
    groupe: "hardi",
    palier: 2,
    pokedollars: 1240,
    lieLe: "2026-06-12T09:00:00Z",
  },
  pokemon: [
    {
      id: "p1", especeId: 95, surnom: null, niveau: 26, xp: 7440, sexe: "M",
      obscur: false, etoiles: null, emplacement: "equipe", boite: 0, place: 1,
      captureLe: "2026-06-14T10:00:00Z", captureDans: 34, enPension: false,
    },
    {
      id: "p2", especeId: 25, surnom: "Pika", niveau: 24, xp: 5000, sexe: "F",
      obscur: false, etoiles: null, emplacement: "equipe", boite: 0, place: 2,
      captureLe: "2026-07-01T10:00:00Z", captureDans: 36, enPension: true,
    },
    {
      id: "p3", especeId: 7, surnom: null, niveau: 21, xp: 3000, sexe: "M",
      obscur: true, etoiles: 2, emplacement: "equipe", boite: 0, place: 4,
      captureLe: "2026-08-02T10:00:00Z", captureDans: 32, enPension: false,
    },
    {
      id: "p4", especeId: 562, surnom: "EnBoite", niveau: 9, xp: 100, sexe: null,
      obscur: false, etoiles: null, emplacement: "boite", boite: 2, place: 5,
      captureLe: "2026-08-20T10:00:00Z", captureDans: 36, enPension: false,
    },
  ],
  pension: [{
    id: "s1", pokemonId: "p2", gerantId: null,
    deposeLe: "2026-10-12T10:00:00Z", niveauAuDepot: 22, tarif: 500,
  }],
  badges: [
    { arene: "Arène Feu", obtenuLe: "2026-08-12T10:00:00Z" },
    { arene: "Arène Plante", obtenuLe: "2026-09-03T10:00:00Z" },
    { arene: "Colosseum de Rhode", obtenuLe: "2026-09-20T10:00:00Z" },
  ],
  sac: [
    { objetId: 990001, quantite: 4 },
    { objetId: 990002, quantite: 5 },
    { objetId: 990020, quantite: 3 },
  ],
  pokedex: [
    { especeId: 562, croiseLe: "2026-06-14T10:00:00Z", attrapeLe: "2026-06-20T10:00:00Z", fois: 3 },
    { especeId: 557, croiseLe: "2026-07-01T10:00:00Z", attrapeLe: null, fois: 0 },
    { especeId: 95, croiseLe: "2026-06-14T10:00:00Z", attrapeLe: "2026-06-14T10:00:00Z", fois: 1 },
  ],
  dernierJet: {
    messageId: 15001, sujetId: 976, type: "rencontre",
    charge: { especeId: 562 }, code: "7F3A-9C21-B4E8-05D7",
    creeLe: "2026-09-30T21:14:00Z",
  },
};

const nav = await chromium.launch({ executablePath: CHROME });
const soucis = [];

function dire(nom, ok, detail = "") {
  console.log(`  ${ok ? "ok  " : "DÉFAUT"} ${nom}${detail === "" ? "" : " — " + detail}`);
  if (!ok) soucis.push(nom + (detail === "" ? "" : " — " + detail));
}

console.log("\n── le carnet de bord ──");

/*  LA PAGE EST SERVIE TELLE QU'ELLE SERA COLLÉE, avec ses adresses
    absolues vers GitHub Pages — on les détourne vers les fichiers du
    dépôt, on ne les réécrit pas. Une page dont on aurait corrigé les
    adresses pour le harnais ne serait plus la page qu'on colle. */
async function monter({ reponse = CARNET, cleGardee = null, refus = null } = {}) {
  const q = await nav.newPage({ viewport: { width: 1440, height: 1000 } });
  const appels = [];
  q.on("pageerror", (e) => soucis.push("erreur JS : " + e.message));

  await q.route("**/*", (route) => {
    const u = new URL(route.request().url());

    if (u.pathname.endsWith("/rest/v1/rpc/carnet")) {
      appels.push(JSON.parse(route.request().postData() ?? "{}"));
      if (refus !== null) {
        return route.fulfill({
          status: 400,
          contentType: "application/json",
          body: JSON.stringify({ message: refus }),
        });
      }
      return route.fulfill({
        contentType: "application/json",
        body: JSON.stringify(reponse),
      });
    }

    if (u.href.startsWith(BASE)) {
      const dans = u.href.slice(BASE.length);
      try {
        const octets = readFileSync(R + dans);
        const type = dans.endsWith(".css")
          ? "text/css; charset=utf-8"
          : dans.endsWith(".js")
          ? "text/javascript; charset=utf-8"
          : dans.endsWith(".json")
          ? "application/json"
          : "application/octet-stream";
        return route.fulfill({ contentType: type, body: octets });
      } catch {
        //  LES IMAGES NE SONT PAS DANS LE DÉPÔT ICI — ni les sprites,
        //  ni les photos de zone. Un pixel suffit : ce qui est jugé,
        //  c'est la mise en page, pas l'image.
        return route.fulfill({
          contentType: "image/svg+xml",
          body: '<svg xmlns="http://www.w3.org/2000/svg" width="4" height="4"></svg>',
        });
      }
    }

    //  Les polices de Google : on ne les charge pas, elles ne changent
    //  rien de mesurable ici et elles coûtent une seconde par page.
    if (u.hostname.endsWith("googleapis.com") || u.hostname.endsWith("gstatic.com")) {
      return route.fulfill({ contentType: "text/css", body: "" });
    }

    if (u.href.startsWith(ADRESSE)) {
      return route.fulfill({
        contentType: "text/html; charset=utf-8",
        body: readFileSync(R + "pages/carnet.html", "utf8"),
      });
    }
    return route.fulfill({ status: 404, body: "" });
  });

  if (cleGardee !== null) {
    await q.addInitScript((c) => localStorage.setItem("wm.carnet.cle", c), cleGardee);
  }
  await q.goto(ADRESSE, { waitUntil: "load" });
  await q.waitForTimeout(900);
  return { q, appels };
}

// ── 1 · sans clé ────────────────────────────────────────────────────

{
  const { q, appels } = await monter();
  const vu = await q.evaluate(() => ({
    etat: document.querySelector(".wm-carnet")?.getAttribute("data-wm-etat") ?? null,
    champVisible: document.querySelector("[data-wm-carnet-formulaire] input")?.offsetParent !== null,
    pokedexCache: document.querySelector("[data-wm-carnet-page='mon-pokedex']")?.hidden ?? null,
  }));
  dire(
    "sans clé, la page la demande et n'appelle RIEN",
    vu.etat === "cle" && vu.champVisible === true && appels.length === 0,
    JSON.stringify({ ...vu, appels: appels.length }),
  );
  await q.close();
}

// ── 2 · une clé refusée ─────────────────────────────────────────────

{
  const { q, appels } = await monter({ cleGardee: CLE, refus: "CLE_INVALIDE" });
  const vu = await q.evaluate(() => ({
    etat: document.querySelector(".wm-carnet")?.getAttribute("data-wm-etat") ?? null,
    souci: document.querySelector("[data-wm-carnet-souci]")?.textContent?.trim() ?? "",
  }));
  dire(
    "une clé refusée parle français, et la page revient au formulaire",
    vu.etat === "cle" && vu.souci.length > 20 && !vu.souci.includes("CLE_INVALIDE") &&
      appels.length === 1,
    JSON.stringify({ ...vu, appels: appels.length }),
  );
  await q.close();
}

{
  //  LA CLÉ N'EST PAS GARDÉE TANT QU'ELLE N'A PAS SERVI : on en colle
  //  une fausse à la main, et le stockage doit rester vide.
  const { q } = await monter({ refus: "CLE_INVALIDE" });
  await q.fill("[data-wm-carnet-formulaire] input", "ffffffffffffffffffffffffffffffff");
  await q.click("[data-wm-carnet-formulaire] button");
  await q.waitForTimeout(500);
  const gardee = await q.evaluate(() => localStorage.getItem("wm.carnet.cle"));
  dire(
    "une clé refusée n'est pas gardée dans le navigateur",
    gardee === null,
    JSON.stringify({ gardee }),
  );
  await q.close();
}

// ── 3 · le carnet ouvert ────────────────────────────────────────────

const { q: p, appels } = await monter({ cleGardee: CLE });

{
  const vu = await p.evaluate(() => ({
    etat: document.querySelector(".wm-carnet")?.getAttribute("data-wm-etat") ?? null,
    nom: document.querySelector("[data-wm-carnet-nom]")?.textContent?.trim() ?? "",
    barre: document.querySelector("[data-wm-carnet-etat]")?.textContent?.trim() ?? "",
    actif: document.querySelector("[aria-current='page']")?.textContent?.trim() ?? null,
  }));
  const vuEmbleme = await p.evaluate(() => {
    const e = document.querySelector("[data-wm-carnet-embleme]");
    return {
      visible: e !== null && e.hidden === false,
      image: e?.querySelector("img")?.getAttribute("src") ?? null,
      mot: e?.querySelector("span")?.textContent?.trim() ?? null,
    };
  });
  dire(
    "la barre porte l'emblème de la nature du joueur, nommé",
    vuEmbleme.visible && /\/assets\/groupes\/hardi\.png$/.test(vuEmbleme.image ?? "") &&
      vuEmbleme.mot === "Hardi",
    JSON.stringify(vuEmbleme),
  );

  dire(
    "une clé gardée ouvre le carnet d'un seul appel, sur « Mon jeu »",
    vu.etat === "pret" && vu.nom === "Eliott Vanner" && vu.actif === "Mon jeu" &&
      vu.barre.includes("1 240") && appels.length === 1 &&
      appels[0]?.p?.cle === CLE,
    JSON.stringify({ ...vu, appels: appels.length }),
  );
}

{
  //  LE CŒUR DE LA NOTE 371:707. On visite les huit onglets et on
  //  recompte les appels : il doit toujours y en avoir UN.
  const avant = appels.length;
  for (const clef of [
    "mon-sac", "mon-pokedex", "mes-rp", "ecrire", "mon-histoire", "mes-liens",
    "mes-boites", "mon-jeu",
  ]) {
    await p.click(`[data-wm-carnet-onglet='${clef}']`);
    await p.waitForTimeout(60);
  }
  const vu = await p.evaluate(() => ({
    visibles: [...document.querySelectorAll("[data-wm-carnet-page]")]
      .filter((s) => !s.hidden).map((s) => s.getAttribute("data-wm-carnet-page")),
    adresse: location.hash,
  }));
  dire(
    "changer d'onglet ne déclenche AUCUNE requête, et un seul onglet est visible",
    appels.length === avant && vu.visibles.length === 1 && vu.visibles[0] === "mon-jeu" &&
      vu.adresse === "#mon-jeu",
    JSON.stringify({ ...vu, appelsEnPlus: appels.length - avant }),
  );
}

{
  const vu = await p.evaluate(() => {
    const cases = [...document.querySelectorAll("[data-wm-carnet-equipe] .wm-carnet__pkmn")];
    return {
      places: cases.length,
      libres: cases.filter((c) => c.classList.contains("wm-carnet__pkmn--libre")).length,
      noms: cases.map((c) => c.querySelector(".wm-carnet__pkmn-nom")?.textContent?.trim() ?? ""),
      niveaux: cases.map((c) => c.querySelector(".wm-carnet__pkmn-niveau")?.textContent?.trim() ?? ""),
      pension: cases.filter((c) => c.classList.contains("wm-carnet__pkmn--pension")).length,
      compte: document.querySelector("[data-wm-carnet-equipe-compte]")?.textContent?.trim() ?? "",
    };
  });
  dire(
    "l'équipe a six places, le pokémon en boîte n'y est pas, celui en pension garde la sienne",
    vu.places === 6 && vu.libres === 3 && vu.noms[0] === "Onix" && vu.noms[1] === "Pika" &&
      vu.noms[3] === "Carapuce" && !vu.noms.includes("EnBoite") && vu.pension === 1 &&
      vu.niveaux[1] === "niv. 24 · en pension" && vu.compte === "3 / 6",
    JSON.stringify(vu),
  );
}

{
  const vu = await p.evaluate(() => ({
    arenes: document.querySelectorAll("[data-wm-carnet-badges='arene'] .wm-carnet__badge").length,
    colos: document.querySelectorAll("[data-wm-carnet-badges='colosseum'] .wm-carnet__badge").length,
    gagnes: document.querySelectorAll(
      "[data-wm-carnet-badges='arene'] .wm-carnet__badge:not(.wm-carnet__badge--agagner)",
    ).length,
    compte: document.querySelector("[data-wm-carnet-badges-compte]")?.textContent?.trim() ?? "",
  }));
  dire(
    "sept arènes, quatre colosseums, et le compteur de la Ligue ne compte que les arènes",
    vu.arenes === 7 && vu.colos === 4 && vu.gagnes === 2 && vu.compte === "2 / 7",
    JSON.stringify(vu),
  );
}

{
  const vu = await p.evaluate(() => {
    const dl = document.querySelector("[data-wm-carnet-jet]");
    return {
      visible: document.querySelector("[data-wm-carnet-jet-bloc]")?.hidden === false,
      code: dl?.querySelector(".wm-carnet__code")?.textContent?.trim() ?? "",
      chasseFixe: dl === null ? "" : getComputedStyle(dl.querySelector(".wm-carnet__code")).fontFamily,
    };
  });
  dire(
    "le dernier jet montre son code de vérification, en chasse fixe",
    vu.visible && vu.code === "7F3A-9C21-B4E8-05D7" && /mono|Menlo|SFMono/i.test(vu.chasseFixe),
    JSON.stringify(vu),
  );
}

{
  await p.click("[data-wm-carnet-onglet='mon-sac']");
  await p.waitForTimeout(80);
  const vu = await p.evaluate(() => ({
    familles: [...document.querySelectorAll("[data-wm-carnet-sac] .wm-carnet__famille")]
      .map((e) => e.textContent.trim()),
    objets: [...document.querySelectorAll("[data-wm-carnet-sac] .wm-carnet__objet")]
      .map((e) => e.querySelector(".wm-carnet__objet-nom")?.textContent?.trim() ?? ""),
    quantites: [...document.querySelectorAll("[data-wm-carnet-sac] .wm-carnet__quantite")]
      .map((e) => e.textContent.trim()),
  }));
  dire(
    "le sac est rangé par famille, et une famille vide ne sort pas",
    vu.familles.length === 2 && vu.familles[0] === "Pour attraper" &&
      vu.familles[1] === "Pour soigner" && vu.objets.length === 3 &&
      vu.objets.includes("Poké Ball") && vu.quantites.includes("× 4"),
    JSON.stringify(vu),
  );
}

{
  await p.click("[data-wm-carnet-onglet='mon-pokedex']");
  await p.waitForTimeout(250);
  const vu = await p.evaluate(() => ({
    cases: document.querySelectorAll("[data-wm-carnet-grille] .wm-carnet__case").length,
    attrapees: document.querySelectorAll(".wm-carnet__case--attrape").length,
    croisees: document.querySelectorAll(".wm-carnet__case--croise").length,
    compte: document.querySelector("[data-wm-carnet-dex-compte]")?.textContent?.trim() ?? "",
    total: document.querySelector("[data-wm-carnet-dex-total]")?.textContent?.trim() ?? "",
    //  LA SILHOUETTE EST LE MÊME SPRITE, ÉTEINT PAR UN FILTRE.
    filtre: (() => {
      const c = document.querySelector(".wm-carnet__case--croise img");
      return c === null ? null : getComputedStyle(c).filter;
    })(),
    //  UNE ESPÈCE INCONNUE NE MONTRE PAS SON SPRITE DU TOUT.
    inconnuSansImage: document.querySelector(".wm-carnet__case--inconnu img") === null,
    filtres: document.querySelectorAll("[data-wm-carnet-filtres] button").length,
  }));
  dire(
    "le Pokédex montre les 933 espèces, trois états, la silhouette étant le même sprite éteint",
    vu.cases === 933 && vu.attrapees === 2 && vu.croisees === 1 && vu.compte === "2 / 933" &&
      vu.total === "933" && /brightness\(0\)/.test(vu.filtre ?? "") && vu.inconnuSansImage &&
      vu.filtres === 20,
    JSON.stringify(vu),
  );
}

{
  //  LES FILTRES CACHENT ET MONTRENT, ILS NE RECHARGENT RIEN.
  const avant = appels.length;
  await p.click("[data-wm-filtre='attrape']");
  await p.waitForTimeout(120);
  const vu = await p.evaluate(() => ({
    visibles: [...document.querySelectorAll("[data-wm-carnet-grille] li")]
      .filter((li) => !li.hidden).length,
    toujoursLa: document.querySelectorAll("[data-wm-carnet-grille] li").length,
    adresse: location.hash,
  }));
  dire(
    "un filtre cache sans recharger, et s'écrit dans l'adresse",
    vu.visibles === 2 && vu.toujoursLa === 933 && vu.adresse === "#attrape" &&
      appels.length === avant,
    JSON.stringify({ ...vu, appelsEnPlus: appels.length - avant }),
  );
}

{
  //  ET LE FILTRE NE VOLE PAS L'ONGLET : `#attrape` n'est pas une clef
  //  d'onglet, donc la page reste sur Mon Pokédex.
  const vu = await p.evaluate(() => ({
    visibles: [...document.querySelectorAll("[data-wm-carnet-page]")]
      .filter((s) => !s.hidden).map((s) => s.getAttribute("data-wm-carnet-page")),
  }));
  dire(
    "un fragment de filtre ne renvoie pas sur un autre onglet",
    vu.visibles.length === 1 && vu.visibles[0] === "mon-pokedex",
    JSON.stringify(vu),
  );
}

{
  await p.click("[data-wm-filtre='toutes']");
  await p.waitForTimeout(120);
  await p.click(".wm-carnet__case--attrape");
  await p.waitForTimeout(120);
  const vu = await p.evaluate(() => {
    const f = document.querySelector("[data-wm-carnet-fiche]");
    return {
      ouverte: f?.hidden === false,
      nom: f?.querySelector(".wm-carnet__fiche-nom")?.textContent?.trim() ?? "",
      types: [...(f?.querySelectorAll(".wm-type") ?? [])].map((e) => e.textContent.trim()),
      lignes: [...(f?.querySelectorAll("dt") ?? [])].map((e) => e.textContent.trim()),
      lien: f?.querySelector("a")?.getAttribute("href") ?? null,
    };
  });
  dire(
    "cliquer une espèce attrapée ouvre sa fiche, avec son type nommé et le lien vers la carte",
    vu.ouverte && vu.nom !== "" && vu.types.length >= 1 && vu.types[0] !== "" &&
      vu.lignes.includes("Où") && vu.lignes.includes("Niveaux") &&
      /^\/h9-la-carte-de-rhode#zone-\d+$/.test(vu.lien ?? ""),
    JSON.stringify(vu),
  );
}

{
  //  UNE ESPÈCE INCONNUE NE DIT RIEN D'ELLE. Donner sa zone et ses
  //  niveaux avant de l'avoir croisée, c'est donner la réponse.
  await p.click("[data-wm-filtre='inconnu']");
  await p.waitForTimeout(150);
  await p.evaluate(() => {
    const c = [...document.querySelectorAll("[data-wm-carnet-grille] li")]
      .find((li) => !li.hidden)?.firstElementChild;
    c?.click();
  });
  await p.waitForTimeout(120);
  const vu = await p.evaluate(() => {
    const f = document.querySelector("[data-wm-carnet-fiche]");
    return {
      lignes: [...(f?.querySelectorAll("dt") ?? [])].map((e) => e.textContent.trim()),
      lien: f?.querySelector("a") !== null && f?.querySelector("a") !== undefined,
    };
  });
  dire(
    "une espèce pas encore croisée ne livre ni sa zone ni ses niveaux",
    !vu.lignes.includes("Où") && !vu.lignes.includes("Niveaux") && vu.lien === false,
    JSON.stringify(vu),
  );
}

//  UN JOUEUR QUI N'A PAS ENCORE CHOISI SA NATURE. `groupe` est
//  nullable en base, et c'est un état normal : lié avant d'avoir
//  choisi. Sans garde, la barre posait une image `groupes/.png` —
//  cassée, et visible.
{
  const sansNature = {
    ...CARNET,
    dresseur: { ...CARNET.dresseur, groupe: null },
  };
  const { q } = await monter({ cleGardee: CLE, reponse: sansNature });
  const vu = await q.evaluate(() => {
    const e = document.querySelector("[data-wm-carnet-embleme]");
    return {
      cache: e?.hidden ?? null,
      images: e?.querySelectorAll("img").length ?? null,
      nom: document.querySelector("[data-wm-carnet-nom]")?.textContent?.trim() ?? "",
    };
  });
  dire(
    "sans nature choisie, la barre ne pose pas d'emblème cassé",
    vu.cache === true && vu.images === 0 && vu.nom === "Eliott Vanner",
    JSON.stringify(vu),
  );
  await q.close();
}

// ── 4 · la mise en page ─────────────────────────────────────────────

{
  const vu = await p.evaluate(() => {
    const barre = document.querySelector(".wm-carnet__barre");
    const page = document.querySelector(".wm-carnet");
    const r = barre.getBoundingClientRect();
    const rp = page.getBoundingClientRect();
    return {
      largeur: Math.round(r.width),
      //  LA BARRE PREND TOUTE LA HAUTEUR : « la barre latérale doit
      //  prendre toute la hauteur », 2 novembre, la même remarque que
      //  pour les annexes.
      aussiHauteQueLaPage: Math.abs(r.height - rp.height) <= 1,
      colleAuBordGauche: Math.round(r.left) === 0,
      //  ET LA PAGE SORT DE LA BOÎTE DE 1200 px du forum.
      pleineLargeur: Math.round(rp.width) >= document.documentElement.clientWidth - 1,
    };
  });
  dire(
    "la barre latérale prend toute la hauteur et touche le bord gauche",
    vu.largeur === 236 && vu.aussiHauteQueLaPage && vu.colleAuBordGauche && vu.pleineLargeur,
    JSON.stringify(vu),
  );
}

{
  //  ZÉRO TABLEAU, QUE DU FLEXBOX (planche 49, et « je veux pas de
  //  tableau » du 2 octobre). Un `<table>` ne se replie pas sur
  //  téléphone, et cette page en a trois qui s'y prêteraient.
  const vu = await p.evaluate(() => ({
    tableaux: document.querySelectorAll("table").length,
    //  Et aucun bouton n'écrit : le carnet montre, il ne change pas.
    formulaires: [...document.querySelectorAll("form")]
      .map((f) => f.getAttribute("data-wm-carnet-formulaire") === "" ? "cle" : "AUTRE"),
  }));
  dire(
    "aucun tableau, et le seul formulaire de la page est celui de la clé",
    vu.tableaux === 0 && vu.formulaires.length === 1 && vu.formulaires[0] === "cle",
    JSON.stringify(vu),
  );
}

{
  //  LA PAGE AUTONOME : la marge de 8 px du navigateur, la police de
  //  base, la barre collante. Les trois défauts payés sur les annexes
  //  le 2 novembre, et le § 0 de `08-annexes.css` les règle pour les
  //  deux pages — encore faut-il que le carnet entre dans son `:has`.
  const vu = await p.evaluate(() => {
    const corps = getComputedStyle(document.body);
    const barre = document.querySelector(".wm-retour");
    return {
      marge: corps.margin,
      police: getComputedStyle(document.querySelector(".wm-carnet")).fontFamily,
      barreCollante: getComputedStyle(barre).position,
      hauteurBarre: Math.round(barre.getBoundingClientRect().height),
    };
  });
  dire(
    "la page autonome n'a ni marge de navigateur ni police par défaut",
    vu.marge === "0px" && /Nunito/.test(vu.police) && vu.barreCollante === "sticky" &&
      vu.hauteurBarre === 56,
    JSON.stringify(vu),
  );
}

{
  //  LE BOUTON DE THÈME EST LÀ, comme sur les annexes : la page n'a
  //  pas le coin d'outils du forum, donc sans lui il n'y a aucun moyen
  //  de passer en sombre.
  const vu = await p.evaluate(() => {
    const b = document.querySelector(".wm-retour__theme");
    if (b === null) return { bouton: false };
    const avant = document.body.classList.contains("wm-sombre");
    b.click();
    const apres = document.body.classList.contains("wm-sombre");
    b.click();
    return { bouton: true, bascule: avant !== apres, revient: document.body.classList.contains("wm-sombre") === avant };
  });
  dire(
    "le bouton de thème est posé et la bascule revient à son point de départ",
    vu.bouton && vu.bascule && vu.revient,
    JSON.stringify(vu),
  );
}

// ── 5 · oublier sa clé ──────────────────────────────────────────────

{
  await p.click("[data-wm-carnet-oublier]");
  await p.waitForTimeout(200);
  const vu = await p.evaluate(() => ({
    gardee: localStorage.getItem("wm.carnet.cle"),
    etat: document.querySelector(".wm-carnet")?.getAttribute("data-wm-etat") ?? null,
  }));
  dire(
    "« oublier ma clé » la retire du navigateur et redemande le formulaire",
    vu.gardee === null && vu.etat === "cle",
    JSON.stringify(vu),
  );
}

await p.close();

// ── 6 · sous 760 px ─────────────────────────────────────────────────

{
  const { q } = await monter({ cleGardee: CLE });
  await q.setViewportSize({ width: 390, height: 844 });
  await q.waitForTimeout(200);
  const vu = await q.evaluate(() => {
    const page = document.querySelector(".wm-carnet");
    const onglets = document.querySelector(".wm-carnet__onglets");
    return {
      empile: getComputedStyle(page).flexDirection === "column",
      ongletsEnRangee: getComputedStyle(onglets).flexDirection === "row",
      //  PAS DE DÉBORDEMENT HORIZONTAL : c'est le défaut qu'on ne voit
      //  pas sur un grand écran et qui rend la page inutilisable au
      //  doigt.
      deborde: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    };
  });
  dire(
    "sous 760 px la barre devient une rangée, et rien ne déborde",
    vu.empile && vu.ongletsEnRangee && vu.deborde <= 0,
    JSON.stringify(vu),
  );
  await q.close();
}

await nav.close();

if (soucis.length > 0) console.log("\n-- ce qui reste --\n" + soucis.join("\n"));
console.log(soucis.length === 0 ? "\nTOUT PASSE." : `\n${soucis.length} DÉFAUT(S).`);
if (soucis.length > 0) Deno.exit(1);
