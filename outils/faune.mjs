// ════════════════════════════════════════════════════════════════════
//  outils/faune.mjs — l'annexe de la carte, dans un vrai
//  navigateur.
//
//  CE QU'IL REGARDE, et qu'aucun test sans navigateur ne verrait :
//
//    · SANS LE SCRIPT, la page dit encore quelque chose — les
//      dix-sept zones, leurs niveaux, et les 933 noms. C'est le seul
//      contrôle qui vaille sur un repli : on le mesure script coupé,
//      pas en lisant le HTML ;
//    · avec le script, la carte se pose ET le repli disparaît. Les
//      deux, parce qu'un repli qui reste donnerait la liste deux
//      fois ;
//    · un clic sur une zone montre SA faune, et les chiffres affichés
//      sont ceux du fichier — relus ici, pas recopiés ;
//    · les tranches de rareté font exactement cent ;
//    · une ville n'a pas de faune, et le dit au lieu de garder celle
//      de la zone d'avant ;
//    · LES SPRITES POINTENT SUR `assets/sprites-figes/`. C'est le
//      contrôle qui a motivé ce harnais : le carnet, lui, pointait
//      sur `assets/pokemon/`, un dossier vide, et ses 933 images
//      étaient en 404 sans que rien ne le dise ;
//    · rien ne déborde, à 1 440 comme à 390.
//
//  LE DÉCOR SERT LA VRAIE PAGE ET LES VRAIES DONNÉES. Pas un gabarit
//  qui lui ressemble : `pages/annexe-06-…html` tel qu'il sera collé,
//  `js/carte.js` tel qu'il sera servi, et les dix-sept fichiers de
//  faune du dépôt. Un décor qui ne reproduit pas ce que l'hôte sert ne
//  teste que lui-même — payé quatre fois sur ce projet.
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

const PAGE = lire("pages/annexe-06-la-region-et-ses-zones.html");
const CARTE = json("data/carte.json");
const BUTIN = json("data/butin.json");

//  UN PNG DE 1×1, TRANSPARENT. Les 1 838 sprites ne sont pas dans ce
//  bac à sable ; ce qu'on vérifie n'est pas l'image mais l'ADRESSE,
//  qui est précisément ce qui était faux dans le carnet.
const PIXEL = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

const ZONES = CARTE.lieux.filter((l) => l.type === "zone");
const VILLE = CARTE.lieux.find((l) => l.type === "ville");

const soucis = [];
let passes = 0;
function ok(quoi, vrai, detail) {
  if (vrai) {
    passes += 1;
    console.log(`  ok   ${quoi}${detail === undefined ? "" : ` — ${JSON.stringify(detail)}`}`);
  } else {
    soucis.push(quoi);
    console.log(`  NON  ${quoi}${detail === undefined ? "" : ` — ${JSON.stringify(detail)}`}`);
  }
}

/** La page, servie telle quelle, avec ou sans ses scripts. */
async function ouvrir(nav, { avecScript = true, largeur = 1440 } = {}) {
  const p = await nav.newPage({ viewport: { width: largeur, height: 900 } });
  p.on("pageerror", (e) => soucis.push("erreur JS : " + e.message));

  await p.route("**/*", (r) => {
    const u = r.request().url();
    const rendre = (type, corps) => r.fulfill({ contentType: type, body: corps });

    if (u.endsWith("/annexe-06")) {
      return rendre("text/html; charset=utf-8", PAGE);
    }
    if (/jetons\.css$/.test(u)) return rendre("text/css", lire("panneau-admin/jetons.css"));
    if (/wild-mystery\.css$/.test(u)) return rendre("text/css", lire("css/wild-mystery.css"));
    if (/\/js\/(carte|annexes)\.js$/.test(u)) {
      if (!avecScript) return rendre("text/javascript", "");
      const quel = /carte\.js$/.test(u) ? "js/carte.js" : "js/annexes.js";
      return rendre("text/javascript", lire(quel));
    }
    if (/\/data\/faune\/(\d+)\.json$/.test(u)) {
      const id = /\/data\/faune\/(\d+)\.json$/.exec(u)[1];
      try {
        return rendre("application/json", lire(`data/faune/${id}.json`));
      } catch {
        //  Une ville n'a pas de fichier : le 404 est le cas réel.
        return r.fulfill({ status: 404, body: "" });
      }
    }
    if (/\/data\/([a-z-]+)\.json$/.test(u)) {
      const nom = /\/data\/([a-z-]+)\.json$/.exec(u)[1];
      try {
        return rendre("application/json", lire(`data/${nom}.json`));
      } catch {
        return r.fulfill({ status: 404, body: "" });
      }
    }
    if (/\.(png|jpe?g|gif)$/.test(u)) {
      return r.fulfill({ contentType: "image/png", body: PIXEL });
    }
    if (/fonts\.(googleapis|gstatic)/.test(u)) return rendre("text/css", "");
    return r.fulfill({ status: 404, body: "" });
  });

  await p.goto("https://exemple.test/annexe-06", { waitUntil: "domcontentloaded" });
  return p;
}

const nav = await chromium.launch(CHROME === undefined ? {} : { executablePath: CHROME });

// ════════════════════════════════════════════════════════════════════
//  1 · SANS LE SCRIPT
// ════════════════════════════════════════════════════════════════════
console.log("\n── sans JavaScript, la page dit encore quelque chose ──");
{
  const p = await ouvrir(nav, { avecScript: false });
  const vu = await p.evaluate(() => {
    const repli = document.querySelector("[data-wm-faune-repli]");
    return {
      titre: document.querySelector(".wm-annexe__titre")?.textContent?.trim() ?? "",
      repliVisible: repli !== null && getComputedStyle(repli).display !== "none",
      zones: document.querySelectorAll(".wm-faune-repli__zone").length,
      noms: Array.from(document.querySelectorAll(".wm-faune-repli__especes"))
        .reduce((s, n) => s + (n.textContent ?? "").split(",").length, 0),
      carteDessinee: document.querySelector(".wm-carte") !== null,
      debord: document.documentElement.scrollWidth > window.innerWidth + 1,
    };
  });
  ok("le titre est dans la page, pas dans le script", vu.titre.includes("région"), vu.titre);
  ok("LE REPLI EST VISIBLE quand le script ne tourne pas", vu.repliVisible);
  ok("et il porte les dix-sept zones", vu.zones === ZONES.length, vu.zones);

  const attendus = ZONES.reduce((s, z) => {
    try {
      return s + json(`data/faune/${z.forumId}.json`).conditions.jour.length;
    } catch {
      return s;
    }
  }, 0);
  ok(
    "ET LES 933 NOMS, pas seulement leur compte",
    vu.noms === attendus,
    { vus: vu.noms, attendus },
  );
  ok("aucune carte dessinée sans le script", !vu.carteDessinee);
  ok("rien ne déborde", !vu.debord);
  await p.close();
}

// ════════════════════════════════════════════════════════════════════
//  2 · AVEC LE SCRIPT
// ════════════════════════════════════════════════════════════════════
console.log("\n── avec le script : la carte, et le repli qui s'efface ──");
const p = await ouvrir(nav);
await p.waitForSelector(".wm-carte", { timeout: 15000 });
{
  const vu = await p.evaluate(() => {
    const repli = document.querySelector("[data-wm-faune-repli]");
    return {
      carte: document.querySelectorAll(".wm-carte").length,
      formes: document.querySelectorAll(".wm-carte__lieu").length,
      repliCache: repli !== null && getComputedStyle(repli).display === "none",
      //  LA CLASSE, PAS LA RÈGLE : si le repli disparaissait par une
      //  règle visant `.wm-faune-repli` tout court, il disparaîtrait
      //  aussi quand le script tombe.
      parLaClasse: repli?.classList.contains("wm-faune-repli--remplace") === true,
      panneauCache: document.querySelector("[data-wm-faune]")?.hasAttribute("hidden") === true,
    };
  });
  ok("une seule carte, celle de l'index", vu.carte === 1, vu.carte);
  ok("elle dessine ses vingt-six lieux", vu.formes === CARTE.lieux.length, vu.formes);
  ok("LE REPLI S'EFFACE, ET PAR SA CLASSE", vu.repliCache && vu.parLaClasse);
  ok("la faune attend un clic", vu.panneauCache);
}

// ════════════════════════════════════════════════════════════════════
//  3 · UN CLIC SUR UNE ZONE
// ════════════════════════════════════════════════════════════════════
const ZONE = ZONES.find((z) => z.nom === "Forêt Marécageuse") ?? ZONES[0];
const TABLE = json(`data/faune/${ZONE.forumId}.json`).conditions.jour;
console.log(`\n── un clic sur ${ZONE.nom} ──`);
{
  await p.evaluate(
    (id) =>
      document.querySelector(`.wm-carte__lieu[data-wm-forum="${id}"]`)?.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
      ),
    ZONE.forumId,
  );
  await p.waitForFunction(
    () => document.querySelectorAll(".wm-faune__espece").length > 0,
    undefined,
    { timeout: 15000 },
  );

  const vu = await p.evaluate(() => {
    const pct = (n) => Number((n ?? "").replace(/[^\d,]/g, "").replace(",", "."));
    const tranches = Array.from(document.querySelectorAll(".wm-faune__tranche")).map((t) => ({
      rarete: t.dataset.wmRarete,
      especes: Array.from(t.querySelectorAll(".wm-faune__espece")).map((e) => ({
        id: Number(e.dataset.wmEspece),
        nom: e.querySelector(".wm-faune__nom")?.textContent ?? "",
        pct: pct(e.querySelector(".wm-faune__pct")?.textContent),
        sprite: e.querySelector(".wm-faune__sprite")?.getAttribute("src") ?? "",
      })),
    }));
    return {
      titre: document.querySelector(".wm-faune__titre")?.textContent ?? "",
      entetes: Array.from(document.querySelectorAll(".wm-faune__tranche-part"))
        .map((n) => n.textContent ?? ""),
      chiffres: Array.from(document.querySelectorAll(".wm-faune__chiffre"))
        .map((n) => n.textContent ?? ""),
      dit: document.querySelector(".wm-faune__dit")?.textContent ?? "",
      tranches,
      total: document.querySelectorAll(".wm-faune__espece").length,
      issues: Array.from(document.querySelectorAll(".wm-faune__issue")).map((n) => ({
        clef: n.dataset.wmIssue,
        pct: pct(n.querySelector(".wm-faune__issue-pct")?.textContent),
      })),
      objets: Array.from(document.querySelectorAll(".wm-faune__objet")).map((n) => ({
        id: Number(n.dataset.wmObjet),
        pct: pct(n.querySelector(".wm-faune__objet-pct")?.textContent),
      })),
    };
  });

  ok("c'est bien la zone cliquée", vu.titre === ZONE.nom, vu.titre);
  ok("toutes ses espèces sont là", vu.total === TABLE.length, {
    vues: vu.total,
    fichier: TABLE.length,
  });
  ok(
    "et le compte affiché dit la même chose",
    vu.chiffres.some((c) => c === `${TABLE.length} espèces`),
    vu.chiffres,
  );

  //  LA PHRASE DES CONDITIONS EST MESURÉE, PAS SUPPOSÉE. Les dix-sept
  //  zones portent aujourd'hui la même table le jour et la nuit ; le
  //  jour où ce ne sera plus vrai, c'est ici qu'on l'apprendra.
  ok(
    "elle dit honnêtement que le jour et la nuit sont pareils",
    vu.dit.includes("le jour et la nuit"),
    vu.dit,
  );

  const ordre = vu.tranches.map((t) => t.rarete);
  ok(
    "les tranches vont du plus courant au plus rare",
    JSON.stringify(ordre) ===
      JSON.stringify(
        ["commun", "peu commun", "rare"].filter((r) => TABLE.some((e) => e.rarete === r)),
      ),
    ordre,
  );

  //  LES PARTS FONT CENT, et on les relit sur les titres de tranche —
  //  « … · 72,73 % en tout » — parce que c'est là qu'elles sont écrites
  //  depuis que la tranche uniforme porte le chiffre pour ses cartes.
  const somme = vu.entetes.reduce((s, t) => {
    const m = /·\s*([\d,]+)\s*%\s*en tout/.exec(t);
    return s + (m === null ? 0 : Number(m[1].replace(",", ".")));
  }, 0);
  ok(
    "et toutes les parts font cent",
    Math.abs(somme - 100) < 0.6,
    Math.round(somme * 100) / 100,
  );

  //  LES CHIFFRES AFFICHÉS SONT CEUX DU FICHIER. On les relit ici au
  //  lieu de les recopier : un harnais qui compare l'affichage à une
  //  constante écrite à la main ne compare que deux fautes possibles.
  const parId = new Map(TABLE.map((e) => [e.espece, e]));
  const faux = vu.tranches.flatMap((t) => t.especes).filter((e) => {
    const vrai = parId.get(e.id);
    //  `pct` vaut zéro quand la tranche porte le chiffre pour tout le
    //  monde : on vérifie alors le nom, et le chiffre au titre.
    return vrai === undefined || vrai.nom !== e.nom ||
      (e.pct !== 0 && Math.abs(vrai.pct - e.pct) > 0.005);
  });
  ok("chaque espèce affichée est celle de la table", faux.length === 0, faux.slice(0, 3));

  const premiere = vu.tranches[0].especes;
  const decroissant = premiere.every((e, i) => i === 0 || premiere[i - 1].pct >= e.pct);
  ok("DANS UNE TRANCHE, LA PLUS PROBABLE PASSE DEVANT", decroissant);

  //  ── LA PART UNIFORME SE DIT UNE FOIS ──────────────────────────
  //
  //  Les tables sont écrites à poids égal par rareté : les 36 communs
  //  d'une zone sont tous à 2,02 %. L'écrire sur chaque carte noierait
  //  le seul chiffre qui les distingue, qui est le niveau.
  const uniforme =
    new Set(TABLE.filter((x) => x.rarete === "commun").map((x) => x.pct)).size === 1;
  ok(
    uniforme
      ? "LA TRANCHE UNIFORME PORTE SON CHIFFRE, ET LES CARTES NON"
      : "une tranche inégale laisse son chiffre à chaque carte",
    uniforme ? premiere.every((e) => e.pct === 0) : premiere.every((e) => e.pct > 0),
  );
  ok(
    "et le titre de la tranche le dit",
    (vu.entetes[0] ?? "").includes(uniforme ? "chacune" : "en tout"),
    vu.entetes[0],
  );

  //  ── LE CONTRÔLE QUI A MOTIVÉ CE HARNAIS ───────────────────────
  const sprites = vu.tranches.flatMap((t) => t.especes).map((e) => e.sprite);
  const poses = sprites.filter((s) => s !== "");
  ok(
    "LES SPRITES POINTENT SUR `assets/sprites-figes/`",
    poses.length > 0 && poses.every((s) => s.includes("/assets/sprites-figes/")),
    poses[0],
  );
  ok(
    "et jamais sur `assets/pokemon/`, qui est vide dans le dépôt",
    sprites.every((s) => !s.includes("/assets/pokemon/")),
  );

  //  ── ET ON COMPTE CE QUI MANQUE, AU LIEU DE LE CACHER ──────────
  //
  //  `data/sprites-couverture.json` a été écrit quand les tables
  //  portaient 734 espèces ; elles en portent 933. Les 210 qui restent
  //  n'ont pas d'image, et la page leur laisse une case vide plutôt
  //  qu'une image cassée. Ce contrôle dit que le nombre de cases vides
  //  est EXACTEMENT celui des espèces absentes de la couverture — si
  //  la page en sautait une de plus, c'est ici qu'on l'apprendrait.
  const couverture = json("data/sprites-couverture.json").styles.forum.especes;
  const attendusVides = TABLE.filter((e) => couverture[String(e.espece)] === undefined).length;
  ok(
    "une espèce sans sprite garde sa case, et on les compte",
    sprites.length - poses.length === attendusVides,
    { vides: sprites.length - poses.length, sansSprite: attendusVides },
  );

  // ── le sol ────────────────────────────────────────────────────
  const f = BUTIN.fouille;
  const reste = 100 - f.bredouille - f.fossileEntier - f.morceauDeFossile - f.objet;
  ok("les cinq issues d'une fouille sont montrées", vu.issues.length === 5, vu.issues.length);
  ok(
    "et elles font cent",
    Math.abs(vu.issues.reduce((s, i) => s + i.pct, 0) - 100) < 0.02,
    vu.issues.reduce((s, i) => s + i.pct, 0),
  );
  ok(
    "LES POKÉDOLLARS SONT LE RESTE, CALCULÉ",
    Math.abs((vu.issues.find((i) => i.clef === "pokedollars")?.pct ?? 0) - reste) < 0.005,
    { vu: vu.issues.find((i) => i.clef === "pokedollars")?.pct, attendu: reste },
  );

  const attendusObjets = BUTIN.zones.find((z) => z.forumId === ZONE.forumId)?.objets ?? [];
  ok(
    "les objets de la zone sont les siens",
    vu.objets.length === attendusObjets.length,
    { vus: vu.objets.length, fichier: attendusObjets.length },
  );
  ok(
    "et leur somme vaut la part « objet »",
    Math.abs(vu.objets.reduce((s, o) => s + o.pct, 0) - f.objet) < 0.05,
    vu.objets.reduce((s, o) => s + o.pct, 0),
  );
}

// ════════════════════════════════════════════════════════════════════
//  4 · UNE AUTRE ZONE, PUIS UNE VILLE
// ════════════════════════════════════════════════════════════════════
console.log("\n── on change de zone, puis on clique une ville ──");
{
  const autre = ZONES.find((z) => z.forumId !== ZONE.forumId);
  const sienne = json(`data/faune/${autre.forumId}.json`).conditions.jour;
  await p.evaluate(
    (id) =>
      document.querySelector(`.wm-carte__lieu[data-wm-forum="${id}"]`)?.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
      ),
    autre.forumId,
  );
  await p.waitForFunction(
    (n) => document.querySelector(".wm-faune__titre")?.textContent === n,
    autre.nom,
    { timeout: 15000 },
  );
  const compte = await p.evaluate(() => document.querySelectorAll(".wm-faune__espece").length);
  ok(
    "LA FAUNE EST REMPLACÉE, PAS AJOUTÉE",
    compte === sienne.length,
    { vues: compte, fichier: sienne.length },
  );

  await p.evaluate(
    (id) =>
      document.querySelector(`.wm-carte__lieu[data-wm-forum="${id}"]`)?.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
      ),
    VILLE.forumId,
  );
  await p.waitForFunction(
    () => document.querySelector("[data-wm-faune]")?.dataset.wmFaune === "sans",
    undefined,
    { timeout: 15000 },
  );
  const vu = await p.evaluate(() => ({
    mot: document.querySelector(".wm-faune__vide")?.textContent ?? "",
    especes: document.querySelectorAll(".wm-faune__espece").length,
  }));
  ok("une ville le dit", vu.mot.includes("Aucune faune"), vu.mot);
  ok(
    "ET ELLE NE GARDE PAS LA FAUNE DE LA ZONE D'AVANT",
    vu.especes === 0,
    vu.especes,
  );
}

// ════════════════════════════════════════════════════════════════════
//  5 · LE TÉLÉPHONE
// ════════════════════════════════════════════════════════════════════
console.log("\n── à 390 px ──");
{
  await p.setViewportSize({ width: 390, height: 844 });
  await p.evaluate(
    (id) =>
      document.querySelector(`.wm-carte__lieu[data-wm-forum="${id}"]`)?.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
      ),
    ZONE.forumId,
  );
  await p.waitForFunction(
    () => document.querySelectorAll(".wm-faune__espece").length > 0,
    undefined,
    { timeout: 15000 },
  );
  const vu = await p.evaluate(() => ({
    debord: document.documentElement.scrollWidth > window.innerWidth + 1,
    large: document.documentElement.scrollWidth,
    espece: document.querySelector(".wm-faune__espece")?.getBoundingClientRect().width ?? 0,
  }));
  ok("rien ne déborde", !vu.debord, vu);
  ok("et une carte d'espèce tient dans l'écran", vu.espece > 0 && vu.espece <= 390, vu.espece);
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
