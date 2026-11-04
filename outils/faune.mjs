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
const REGION = json("data/region.json");
const BUTIN = json("data/butin.json");

//  UN PNG DE 1×1, TRANSPARENT, pour tout ce dont seule l'adresse
//  compte.
const PIXEL = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

//  ── DEUX SPRITES DE TAILLES CONNUES ─────────────────────────────
//
//  Les 1 838 images vivent sur le Mac, pas dans ce bac à sable, et un
//  harnais ne touche pas au réseau. Mais « ne pas agrandir » ne se
//  mesure pas sur un pixel de 1 × 1 : il faut une image PLUS PETITE
//  que sa boîte et une PLUS GRANDE, pour voir que la première garde
//  sa taille et que la seconde se réduit.
//
//  Les deux tailles sont celles des vrais extrêmes du dépôt, relevées
//  le 4 novembre : 44 × 47 pour les plus petits, et jusqu'à 207 × 185
//  pour les plus grands. Le pair prend le petit, l'impair le grand.
const PETIT = {
  octets: Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAACwAAAAvCAYAAACYECivAAAAzklEQVR42u3Z0Q3DIAwEULipMksn6QidpLN0q/a3qlJiJxgf6PybYD9ZJoqgFEVs1F6J7rfXu/X88dxqOvgIGYGvI6E94DUDegWObKw3N7Kx3hpgwHpqgQVrrQkmrKU2ymQBtu4eGcCIbVnmHgmm7v4zrbHpBI4AM87vnk0jIbDAAgtMAu51MhN9DKCRELgFZpzjX9P8I8HU5T0LrC8yYNf6SmR2uVUbZxdmYE0jMRJtqYVeiUZgXZsuEu3JvfYtUi/48Hu6M3jm/23Fd3wAAA1kUIP/qP8AAAAASUVORK5CYII=",
    "base64",
  ),
  l: 44,
  h: 47,
};
const GRAND = {
  octets: Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAKAAAACWCAYAAABZ7IOdAAAC1UlEQVR42u3ZwVHlOhRFUayoGBAYIRDYG5AVTKkCJmDpXOmuHUD3L/f6R7Lf05Mkde3yCH7v/fXl444/5/nt4TkDOBcZnABuAQ7IZgCrg+sO8oIORgCha4vxAg9EAMFrC/ECD0QAwWsL8QIPRADBawvxAg/EZAO+XlV7xsODgbD1EQxe7yN5wGcNWwKED8LIEQyeIzm2gPBZwxhA+CCMAYQPwhhA+CCMAYQPwhhA+CCMAYQPwhhA+CCMAYQPwhhA+CAs9xYsLQFo/axgDCB8EMYAwqf/GnAH1J53QOunOywM+JRE6AjWXkew9dOdNgZ8SiJ0BGuPI9j6aYYVC6j6C2j9NGsFLaBqL6D108wVtICqu4DWT7NX0AKq/luwtByg41crjmELqHoLaP20agUtoLyECECpBkD3P628B1pAOYIFoJQH6P6n1fdACyhHsACUABSAUgagN2Al3oQtoBzBAlACUABKAApACUABKAEoACUABaAEoACU7gX4/Pa4PA6t6Ks1CyhHsACUABSAUg6gN2GtfAO2gHIEC0CpDkD3QK26/1lAOYIFoFQLoHugVtz/LKDqHsFWULPXzwLKS4gA/NN0Sv89fi2g6h/BVlCz1s8Cao+XECuoGetnAbXHAlpBzVg/C6h9FtAKaoaRMfsvEHyOYJ1xBFtB3W1irP4LBZ8jWHsfwVZQdxkY6f8A9cV32xEMIXzugOp3B7SC1q/UAkIIX/wIhhC++B0QQvjiLyEQwhd/C4YQvihACOGLA4QQvjhACOGLA4QQvp+KgXh/ffnwz90XXmQBrSF8ZQBCCF/0CHYk94ZXYgGtoWc9PBj4HMGO5Lb/c5dfHBDPPlW2OfJAPPM6s92dC8Sz7tHbXvpBPOMFbvu3zu4Qd/9ycMxnj24QT/lkdeR3t1Mxnvid9PgPv7tjPP3jfLtfHqqD7PZrUPufvtIgu//86LfXBTj9xi1J+t4nENtlF5P4zigAAAAASUVORK5CYII=",
    "base64",
  ),
  l: 160,
  h: 150,
};

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
/** Ouvre l'onglet qui porte la carte. Depuis le 4 novembre l'annexe en
 *  a deux — « la région de Rhode » d'abord, « la carte » ensuite — et
 *  le second est replié au chargement. */
async function ouvrirLOngletDeLaCarte(p) {
  await p.waitForSelector(".wm-sous-onglets__barre .wm-onglet", { timeout: 15000 });
  const boutons = await p.$$(".wm-sous-onglets__barre .wm-onglet");
  for (const b of boutons) {
    const mot = (await b.textContent()) ?? "";
    if (/carte/i.test(mot)) {
      await b.click();
      return;
    }
  }
  throw new Error("aucun onglet de carte dans la barre");
}

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
    const sprite = /\/assets\/sprites-figes\/[^/]+\/(\d+)\.png$/.exec(u);
    if (sprite !== null) {
      const quel = Number(sprite[1]) % 2 === 0 ? PETIT : GRAND;
      return r.fulfill({ contentType: "image/png", body: quel.octets });
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
      sections: document.querySelectorAll("[data-wm-sous-onglet]").length,
      sectionsVisibles: Array.from(document.querySelectorAll("[data-wm-sous-onglet]"))
        .filter((n) => !n.hidden).length,
      titresVisibles: Array.from(document.querySelectorAll("[data-wm-sous-onglet] > h2"))
        .filter((n) => getComputedStyle(n).position !== "absolute").length,
      barre: document.querySelectorAll(".wm-sous-onglets__barre").length,
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
  //  LES SOUS-ONGLETS NE CACHENT RIEN SANS LE SCRIPT : les sections
  //  sont là, avec leurs titres, l'une sous l'autre. Le compte n'est
  //  pas écrit ici — il était à trois, il est passé à quatre le jour
  //  où la région a eu son onglet, et un chiffre à la main aurait
  //  fait croire à une faute.
  ok(
    `LES ${vu.sections} EXPLICATIONS SONT VISIBLES, DÉPLIÉES`,
    vu.sections >= 2 && vu.sectionsVisibles === vu.sections && vu.barre === 0,
    vu,
  );
  ok("et leurs titres aussi", vu.titresVisibles === vu.sections, {
    titres: vu.titresVisibles,
    sections: vu.sections,
  });
  ok("rien ne déborde", !vu.debord);
  await p.close();
}

// ════════════════════════════════════════════════════════════════════
//  2 · AVEC LE SCRIPT
// ════════════════════════════════════════════════════════════════════
console.log("\n── avec le script : la carte, et le repli qui s'efface ──");
const p = await ouvrir(nav);
await ouvrirLOngletDeLaCarte(p);
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
//  2 bis · LES SOUS-ONGLETS
// ════════════════════════════════════════════════════════════════════
console.log("\n── les sous-onglets ──");
{
  const vu = await p.evaluate(() => {
    const ouvertes = () =>
      Array.from(document.querySelectorAll("[data-wm-sous-onglet]")).filter((n) => !n.hidden);
    const boutons = Array.from(
      document.querySelectorAll(".wm-sous-onglets__barre .wm-onglet"),
    );
    //  ON PART DU PREMIER ONGLET, pas de celui qui se trouve ouvert :
    //  le harnais a cliqué « la carte » plus haut pour la mesurer, et
    //  cliquer le second depuis le second ne change rien.
    boutons[0]?.click();
    const avant = ouvertes()[0]?.dataset.wmSousOnglet ?? "";
    boutons[1]?.click();
    const apres = ouvertes()[0]?.dataset.wmSousOnglet ?? "";
    return {
      boutons: boutons.map((b) => b.textContent ?? ""),
      sections: document.querySelectorAll("[data-wm-sous-onglet]").length,
      uneSeule: ouvertes().length === 1,
      avant,
      apres,
      //  Un seul onglet dans l'ordre de tabulation : la flèche circule
      //  entre eux, Tab sort du groupe.
      tabindex: boutons.map((b) => b.tabIndex),
      selected: boutons.map((b) => b.getAttribute("aria-selected")),
      titreCache: getComputedStyle(
        document.querySelector("[data-wm-sous-onglet] > h2"),
      ).position === "absolute",
    };
  });
  ok(
    "une barre, un bouton par section",
    vu.boutons.length === vu.sections,
    { boutons: vu.boutons, sections: vu.sections },
  );
  ok("UNE SEULE SECTION OUVERTE À LA FOIS", vu.uneSeule);
  ok("et le clic change bien de section", vu.avant !== vu.apres, [vu.avant, vu.apres]);
  ok(
    "UN SEUL ONGLET DANS L'ORDRE DE TABULATION",
    vu.tabindex.filter((t) => t === 0).length === 1,
    vu.tabindex,
  );
  ok(
    "et `aria-selected` suit",
    vu.selected.filter((s) => s === "true").length === 1,
    vu.selected,
  );
  ok("LE TITRE NE SE DIT PAS DEUX FOIS : il est sur le bouton", vu.titreCache);

  //  ── L'ONGLET QU'ON VIENT DE CLIQUER RESTE LISIBLE ────────────
  //
  //  TROUVÉ LE 4 NOVEMBRE. Le survol posait un fond sable clair sans
  //  toucher la couleur du texte : sur l'onglet ACTIF, dont le texte
  //  est l'inverse, ça donnait du blanc cassé sur du sable — 1,1
  //  contre 1. Et ça arrivait juste après un clic, curseur encore
  //  dessus : l'onglet qu'on venait de choisir était le seul
  //  illisible de la barre.
  //
  //  LE HARNAIS DE CONTRASTE NE POUVAIT PAS LE VOIR : il mesure une
  //  page au repos, sans curseur et sans clic. Celui-ci clique pour de
  //  vrai, puis mesure.
  const lisible = await p.evaluate(() => {
    const lire = (c) => (c.match(/[\d.]+/g) ?? []).slice(0, 3).map(Number);
    const lum = (rgb) => {
      const [r, g, b] = rgb.map((v) => {
        const x = v / 255;
        return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
      });
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };
    const actif = document.querySelector(".wm-onglet--actif");
    if (actif === null) return null;
    const s = getComputedStyle(actif);
    const a = lum(lire(s.color)) + 0.05;
    const b = lum(lire(s.backgroundColor)) + 0.05;
    return {
      rapport: Math.round((Math.max(a, b) / Math.min(a, b)) * 100) / 100,
      texte: s.color,
      fond: s.backgroundColor,
    };
  });
  ok(
    "L'ONGLET ACTIF RESTE LISIBLE SOUS LE CURSEUR",
    lisible !== null && lisible.rapport >= 4.5,
    lisible,
  );

  //  ── LA FLÈCHE TOURNE ──────────────────────────────────────────
  const vuClavier = await p.evaluate(() => {
    const boutons = Array.from(
      document.querySelectorAll(".wm-sous-onglets__barre .wm-onglet"),
    );
    boutons[0].click();
    boutons[0].dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true }));
    const ouverte = Array.from(document.querySelectorAll("[data-wm-sous-onglet]"))
      .find((n) => !n.hidden);
    return ouverte?.dataset.wmSousOnglet ?? "";
  });
  //  LE DERNIER ONGLET SE LIT DE LA PAGE, pas d'une constante : il
  //  était « le-sol » quand il y en avait quatre, il est « la-carte »
  //  depuis qu'il n'y en a plus que deux, et un nom écrit ici aurait
  //  fallu le corriger à la main.
  const dernier = await p.evaluate(() => {
    const tous = Array.from(document.querySelectorAll("[data-wm-sous-onglet]"));
    return tous[tous.length - 1]?.dataset.wmSousOnglet ?? "";
  });
  ok(
    "LA FLÈCHE GAUCHE DEPUIS LE PREMIER VA AU DERNIER",
    vuClavier === dernier,
    { vu: vuClavier, dernier },
  );

  //  On rouvre la météo pour la capture, et on laisse la page propre.
  await p.evaluate(() => {
    const b = Array.from(document.querySelectorAll(".wm-sous-onglets__barre .wm-onglet"));
    b[0]?.click();
  });
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
    () => document.querySelectorAll("[data-wm-espece]").length > 0,
    undefined,
    { timeout: 15000 },
  );

  //  LES IMAGES SONT `lazy` : on les décharge de leur paresse avant de
  //  mesurer, sinon `naturalWidth` vaut zéro et le contrôle de taille
  //  passe sur une liste vide.
  await p.evaluate(() => {
    for (const i of document.querySelectorAll(".wm-faune__sprite")) i.loading = "eager";
  });
  await p.waitForFunction(
    () =>
      Array.from(document.querySelectorAll(".wm-faune__sprite"))
        .every((i) => i.complete && i.naturalWidth > 0),
    undefined,
    { timeout: 15000 },
  );

  const vu = await p.evaluate(() => {
    const pct = (n) => Number((n ?? "").replace(/[^\d,]/g, "").replace(",", "."));
    //  UNE SEULE LISTE DEPUIS LE 4 NOVEMBRE : « tu mets toutes les
    //  espèces ensemble dans l'ordre, tu rajoutes un filtre ».
    const tranches = [{
      rarete: "toutes",
      especes: Array.from(document.querySelectorAll("[data-wm-espece]")).map((e) => ({
        id: Number(e.dataset.wmEspece),
        nom: e.querySelector(".wm-faune__nom")?.textContent ?? "",
        pct: pct(e.querySelector(".wm-faune__pct")?.textContent),
        rarete: e.dataset.wmRarete ?? "",
        types: Array.from(e.querySelectorAll(".wm-faune__type"))
          .map((n) => n.dataset.wmType ?? ""),
        sprite: e.querySelector(".wm-faune__sprite")?.getAttribute("src") ?? "",
        //  L'image NE DOIT PAS ÊTRE AGRANDIE : on compare la taille
        //  rendue à la taille naturelle du fichier.
        rendue: (() => {
          const i = e.querySelector(".wm-faune__sprite");
          return i === null
            ? null
            : { l: i.clientWidth, h: i.clientHeight, nl: i.naturalWidth, nh: i.naturalHeight };
        })(),
      })),
    }];
    return {
      titre: document.querySelector(".wm-faune__titre")?.textContent ?? "",
      filtres: Array.from(document.querySelectorAll(".wm-filtre")).map((b) => ({
        cle: b.dataset.wmFiltre,
        mot: b.querySelector(".wm-filtre__mot")?.textContent ?? "",
        nombre: Number(b.querySelector(".wm-filtre__nombre")?.textContent ?? "-1"),
      })),
      nbObjets: document.querySelectorAll("[data-wm-objet]").length,
      chiffres: Array.from(document.querySelectorAll(".wm-faune__chiffre"))
        .map((n) => n.textContent ?? ""),
      dit: document.querySelector(".wm-faune__dit")?.textContent ?? "",
      tranches,
      total: document.querySelectorAll("[data-wm-espece]").length,
      issues: Array.from(document.querySelectorAll(".wm-faune__issue")).map((n) => ({
        clef: n.dataset.wmIssue,
        pct: pct(n.querySelector(".wm-faune__issue-pct")?.textContent),
      })),
      objets: Array.from(document.querySelectorAll(".wm-faune__objet")).map((n) => ({
        id: Number(n.dataset.wmObjet),
        pct: pct(n.querySelector(".wm-faune__pct")?.textContent),
        image: n.querySelector(".wm-faune__sprite")?.getAttribute("src") ?? "",
        tag: n.querySelector(".wm-faune__rarete")?.textContent ?? "",
        //  L'OBJET REPREND LA CARTE DE L'ESPÈCE : même classe, même
        //  pied, et c'est `data-wm-frequence` qui colore son liseré.
        memeCarte: n.classList.contains("wm-faune__espece"),
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

  //  ── L'ORDRE EST CELUI DU DEX ────────────────────────────────
  //
  //  « Pourquoi l'ordre et l'id des pokémons n'est pas le même que
  //  dans le dépôt que je t'ai donné ou comme dans l'ordre des vrais
  //  pokémons ? » (4 novembre) Les identifiants étaient justes ;
  //  l'ordre, lui, était celui des raretés puis des probabilités.
  //
  //  L'ORDRE ATTENDU SE RECALCULE ICI, depuis la table et
  //  `data/ordre-du-dex.json` : le comparer à une liste écrite à la
  //  main ne comparerait que deux fautes possibles.
  const BASES = json("data/ordre-du-dex.json").base;
  const base = (id) => BASES[String(id)] ?? id;
  const attenduDex = [...TABLE]
    .sort((a, b) => base(a.espece) - base(b.espece) || a.espece - b.espece)
    .map((e) => e.espece);
  const vuDex = vu.tranches[0].especes.map((e) => e.id);
  ok(
    "LES ESPÈCES SONT DANS L'ORDRE DU DEX, formes derrière leur espèce",
    JSON.stringify(vuDex) === JSON.stringify(attenduDex),
    { vu: vuDex.slice(0, 8), attendu: attenduDex.slice(0, 8) },
  );
  //  Et la preuve que ce n'est pas un tri par identifiant : au moins
  //  une forme régionale doit passer AVANT une espèce ordinaire.
  const formeAvantOrdinaire = vuDex.some((id, i) =>
    id > 10000 && vuDex.slice(i + 1).some((j) => j < 10000)
  );
  ok(
    "une forme régionale passe avant l'espèce ordinaire qui la suit",
    formeAvantOrdinaire,
    vuDex.filter((i) => i > 10000).slice(0, 3),
  );

  //  LES PARTS FONT CENT. Elles se relisent maintenant carte par
  //  carte : il n'y a plus de titre de tranche pour porter le total.
  const somme = vu.tranches[0].especes.reduce((s, e) => s + e.pct, 0);
  ok(
    "et toutes les parts font cent",
    Math.abs(somme - 100) < 0.6,
    Math.round(somme * 100) / 100,
  );

  //  ── LA BARRE DE TRI ─────────────────────────────────────────
  const comptes = new Map();
  for (const e of TABLE) comptes.set(e.rarete, (comptes.get(e.rarete) ?? 0) + 1);
  if (vu.nbObjets > 0) comptes.set("objet", vu.nbObjets);
  const attendus = ["tous", "commun", "peu commun", "rare", "objet"]
    .filter((c) => c === "tous" || (comptes.get(c) ?? 0) > 0);
  ok(
    "la barre propose tous, les raretés présentes, et les objets",
    JSON.stringify(vu.filtres.map((f) => f.cle)) === JSON.stringify(attendus),
    vu.filtres.map((f) => f.cle),
  );
  const fauxComptes = vu.filtres.filter((f) =>
    f.cle !== "tous" && f.nombre !== (comptes.get(f.cle) ?? 0)
  );
  ok(
    "et chaque bouton annonce le compte du fichier",
    fauxComptes.length === 0 &&
      vu.filtres[0]?.nombre === TABLE.length + vu.nbObjets,
    { boutons: vu.filtres, faux: fauxComptes },
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

  //  ── CHAQUE CARTE SE SUFFIT ────────────────────────────────────
  //
  //  « Le nom, le pourcentage, la rareté et le type. » Elle doit se
  //  relire seule — et depuis le 4 novembre elle n'a plus le choix :
  //  il n'y a plus de groupe pour porter le chiffre à sa place.
  const cartes = vu.tranches[0].especes;
  ok(
    "CHAQUE CARTE PORTE SON POURCENTAGE",
    cartes.length > 0 && cartes.every((e) => e.pct > 0),
    cartes.slice(0, 3).map((e) => e.pct),
  );
  //  LA RARETÉ EST ÉCRITE SUR CHAQUE CARTE, et c'est celle du fichier.
  //  Elle n'est plus donnée par le groupe : la liste est dans l'ordre
  //  du dex, donc une carte doit se relire seule.
  const rareteFausse = vu.tranches[0].especes.filter((e) =>
    e.rarete !== parId.get(e.id)?.rarete
  );
  ok(
    "ET SA RARETÉ, écrite et pas seulement colorée",
    rareteFausse.length === 0 &&
      vu.tranches[0].especes.every((e) =>
        ["commun", "peu commun", "rare"].includes(e.rarete)
      ),
    rareteFausse.slice(0, 3),
  );
  //  LES TYPES VIENNENT DES FICHES, pas d'une recopie : on relit la
  //  source ici plutôt que d'écrire une constante, sinon le test ne
  //  compare que deux fautes possibles.
  const fichesDuDepot = json("data/especes-fiches.json").fiches;
  const typesFaux = vu.tranches.flatMap((t) => t.especes).filter((e) => {
    const attendus = (fichesDuDepot[String(e.id)]?.types ?? []).slice(0, 2);
    return JSON.stringify(e.types) !== JSON.stringify(attendus);
  });
  ok("ET SES TYPES, ceux de la fiche", typesFaux.length === 0, typesFaux.slice(0, 3));
  //  ── LES SPRITES BOUGENT ─────────────────────────────────────
  //
  //  « Ensuite, les sprites doivent bouger. » (4 novembre) Le style
  //  « forum » a des GIF animés ; l'emplacement décide s'ils sont
  //  servis, et celui de la zone a été ajouté ce jour-là. On compare
  //  donc l'adresse rendue à la colonne `source` de la couverture, pas
  //  à `fige`.
  const styleForum = json("data/sprites-couverture.json").styles.forum;
  const anime = styleForum.anime === true;
  const animesFaux = vu.tranches[0].especes.filter((e) => {
    const entree = styleForum.especes[String(e.id)];
    if (entree === undefined || e.sprite === "") return false;
    const attendu = anime ? entree.source : entree.fige;
    return !e.sprite.endsWith(attendu.replace(/^assets\//, "assets/"));
  });
  ok(
    anime
      ? "LES SPRITES SONT CEUX QUI BOUGENT, pas les figés"
      : "le style forum n'a pas d'animation : les figés sont les bons",
    animesFaux.length === 0,
    animesFaux.slice(0, 3).map((e) => ({ id: e.id, rendu: e.sprite })),
  );

  //  ── LE CONTRÔLE QUI A MOTIVÉ CE HARNAIS ───────────────────────
  const sprites = vu.tranches.flatMap((t) => t.especes).map((e) => e.sprite);
  const poses = sprites.filter((s) => s !== "");
  //  LES SPRITES VIENNENT DE LA COUVERTURE, FIGÉS OU ANIMÉS.
  //
  //  C'était « ils pointent sur `assets/sprites-figes/` », et ça a
  //  cessé d'être vrai le 4 novembre : un sprite qui bouge n'est pas
  //  dans le dépôt, il est chez PokéAPI au commit épinglé — c'est la
  //  colonne `source` de la couverture. Ce qui reste vrai, et c'est ce
  //  qui compte, c'est qu'aucun ne sort de ces deux endroits-là.
  const PINGLE = json("data/sprites-couverture.json").base;
  ok(
    "LES SPRITES VIENNENT DU DÉPÔT OU DU COMMIT ÉPINGLÉ, pas d'ailleurs",
    poses.length > 0 &&
      poses.every((s) => s.includes("/assets/sprites-figes/") || s.startsWith(PINGLE)),
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
  //  ── AUCUN SPRITE AGRANDI ──────────────────────────────────────
  //
  //  `loading="lazy"` : hors de la vue, l'image n'est pas chargée et
  //  `naturalWidth` vaut zéro. On les force à charger avant de
  //  mesurer, sinon le contrôle passerait sur une liste vide — ce
  //  qu'il a fait au premier essai.
  //
  //  Les sprites vont de 41 × 56 à 207 × 185 : imposer 96 × 96
  //  agrandissait les petits et écrasait les grands. On mesure la
  //  taille RENDUE contre la taille naturelle du fichier.
  const rendues = vu.tranches.flatMap((t) => t.especes)
    .map((e) => e.rendue).filter((r) => r !== null && r.nl > 0);
  const agrandis = rendues.filter((r) => r.l > r.nl + 0.5 || r.h > r.nh + 0.5);
  ok(
    "AUCUN SPRITE N'EST AGRANDI",
    rendues.length > 0 && agrandis.length === 0,
    { mesurés: rendues.length, agrandis: agrandis.slice(0, 3) },
  );

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
  //  ── LES VIGNETTES D'OBJET ─────────────────────────────────────
  const vignettes = vu.objets.map((o) => o.image).filter((i) => i !== "");
  ok(
    "LES OBJETS ONT LEUR VIGNETTE, au commit épinglé",
    vignettes.length > 0 && vignettes.every((i) => i.includes("/sprites/items/")),
    vignettes[0],
  );
  const couvertureObjets = json("data/sprites-couverture.json").objets;
  const attendusSans = attendusObjets
    .filter((o) => !couvertureObjets.slugs.includes(o.slug)).length;
  ok(
    "et celui qui n'en a pas garde sa case",
    vu.objets.length - vignettes.length === attendusSans,
    { vides: vu.objets.length - vignettes.length, sansVignette: attendusSans },
  );
  ok(
    "UN OBJET EST LA MÊME CARTE QU'UNE ESPÈCE",
    vu.objets.every((o) => o.memeCarte),
  );
  ok(
    "LA FRÉQUENCE EST ÉCRITE EN PIED, pas seulement colorée",
    vu.objets.every((o) => ["fréquent", "peu fréquent", "rare", "très rare"].includes(o.tag)),
    vu.objets.map((o) => o.tag).slice(0, 4),
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
  const compte = await p.evaluate(() => document.querySelectorAll("[data-wm-espece]").length);
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
    especes: document.querySelectorAll("[data-wm-espece]").length,
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
  //  L'ONGLET DE LA CARTE EST REFERMÉ plus haut, pour la capture. Sans
  //  le rouvrir, la liste est là mais repliée : toutes les largeurs
  //  mesurées valent zéro, et le contrôle passerait pour une raison
  //  qui n'a rien à voir avec 390 pixels.
  await ouvrirLOngletDeLaCarte(p);
  await p.evaluate(
    (id) =>
      document.querySelector(`.wm-carte__lieu[data-wm-forum="${id}"]`)?.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
      ),
    ZONE.forumId,
  );
  await p.waitForFunction(
    () => document.querySelectorAll("[data-wm-espece]").length > 0,
    undefined,
    { timeout: 15000 },
  );
  const vu = await p.evaluate(() => ({
    debord: document.documentElement.scrollWidth > window.innerWidth + 1,
    large: document.documentElement.scrollWidth,
    espece: document.querySelector("[data-wm-espece]")?.getBoundingClientRect().width ?? 0,
  }));
  ok("rien ne déborde", !vu.debord, vu);
  ok("et une carte d'espèce tient dans l'écran", vu.espece > 0 && vu.espece <= 390, vu.espece);
}

// ════════════════════════════════════════════════════════════════════
//  LA RÉGION DE RHODE — l'onglet de présentation
// ════════════════════════════════════════════════════════════════════
console.log("\n── la région de Rhode est présentée, et sans JavaScript ──");
{
  const q = await ouvrir(nav, { avecScript: false });
  const ev = REGION.evenements;
  const gp = ev.blocs.find((b) => Array.isArray(b.ordre));
  const vu = await q.evaluate(() => {
    const sec = document.querySelector('[data-wm-sous-onglet="la-region"]');
    if (sec === null) return null;
    return {
      titre: sec.querySelector(".wm-annexe__carte-titre")?.textContent?.trim() ?? "",
      paras: Array.from(sec.querySelectorAll(".wm-paras p")).map((n) =>
        (n.textContent ?? "").trim()
      ),
      blocs: Array.from(sec.querySelectorAll(".wm-region__nom")).map((n) =>
        (n.textContent ?? "").trim()
      ),
      ordre: Array.from(sec.querySelectorAll(".wm-region__ordre li")).map((n) =>
        (n.textContent ?? "").replace(/^\d+/, "").trim()
      ),
      ecuries: Array.from(sec.querySelectorAll(".wm-ecurie__nom")).map((n) =>
        (n.textContent ?? "").trim()
      ),
      libres: sec.querySelectorAll(".wm-ecurie__libre").length,
      pilotes: Array.from(sec.querySelectorAll("a.wm-ecurie__pilote")).map((a) => ({
        nom: (a.textContent ?? "").trim(),
        href: a.getAttribute("href"),
      })),
      vue: sec.getBoundingClientRect().height > 0,
    };
  });
  ok("l'onglet « La région de Rhode » existe", vu !== null);
  if (vu !== null) {
    ok("et se lit sans le script", vu.vue);
    ok("son titre est celui du fichier", vu.titre === REGION.titre, vu.titre);
    //  LES TROIS PARAGRAPHES DE PRÉSENTATION SONT LÀ, MOT POUR MOT.
    //  C'est le texte de Callista : un résumé à ma main serait une
    //  réécriture silencieuse de l'histoire de la région.
    ok(
      "les trois paragraphes de présentation sont là, mot pour mot",
      REGION.presentation.every((t) => vu.paras.includes(t)),
      REGION.presentation.filter((t) => !vu.paras.includes(t)).map((t) => t.slice(0, 40)),
    );
    ok(
      "les quatre évènements ont chacun leur cartouche",
      vu.blocs.join("|") === ev.blocs.map((b) => b.nom).join("|"),
      vu.blocs,
    );
    ok(
      `les ${gp.ordre.length} Grand Prix sont dans l'ordre du fichier`,
      vu.ordre.join("|") === gp.ordre.join("|"),
      vu.ordre,
    );
    ok(
      "les trois écuries sont là",
      vu.ecuries.join("|") === gp.ecuries.map((e) => e.nom).join("|"),
      vu.ecuries,
    );
    //  LE COMPTE DES PLACES LIBRES EST CELUI DU FICHIER. Cinq
    //  aujourd'hui, quatre le jour où quelqu'un prend un baudrier :
    //  une constante écrite ici mentirait dès ce jour-là.
    const libres = gp.ecuries.flatMap((e) => e.pilotes).filter((x) => x.libre).length;
    ok(`${libres} places libres, comme le fichier`, vu.libres === libres, vu.libres);
    const pris = gp.ecuries.flatMap((e) => e.pilotes).filter((x) => x.lien);
    ok(
      "le pilote en place mène à son profil",
      vu.pilotes.length === pris.length &&
        pris.every((x) => vu.pilotes.some((v) => v.nom === x.nom && v.href === x.lien)),
      vu.pilotes,
    );
  }
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
