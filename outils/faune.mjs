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
//  qui lui ressemble : `la page de l'annexe` tel qu'il sera collé,
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

//  LA PAGE SE TROUVE PAR SON SLUG, pas par son numéro : le numéro
//  est un rang dans le sommaire, et il a reculé d'un cran le 4
//  novembre quand « créer son personnage » s'est repliée dans « par
//  où commencer ». Un chemin écrit à la main aurait fait tomber le
//  harnais sur un fichier absent.
const CHEMIN = (() => {
  const e = json("data/annexes.json").sections
    .flatMap((s) => s.entrees)
    .find((x) => x.slug === "la-region-et-ses-zones");
  if (e === undefined) throw new Error("la-region-et-ses-zones n'est pas dans data/annexes.json");
  return `pages/annexe-${e.numero}-${e.slug}.html`;
})();
const PAGE = lire(CHEMIN);
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

async function ouvrir(nav, { avecScript = true, largeur = 1440, theme } = {}) {
  const p = await nav.newPage({
    viewport: { width: largeur, height: 900 },
    //  LE THÈME EST UN RÉGLAGE DE LA PAGE, et il lui est donné à la
    //  naissance : `prefers-color-scheme` ne se change pas après coup
    //  sans recharger, et une feuille lue en clair ne repasse pas en
    //  sombre toute seule.
    ...(theme === undefined ? {} : { colorScheme: theme }),
  });
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
      //  `h2` OU `h3` : les deux onglets du dessus portent un `h2`, les
      //  quatre évènements imbriqués un `h3` — c'est ce que
      //  `module-annexes.ts` lit pour nommer un onglet, et il accepte
      //  les deux. Ne compter que les `h2` faisait dire au harnais que
      //  quatre titres manquaient alors qu'ils étaient là.
      //  LES SECTIONS QUI ONT UN TITRE VISIBLE, pas le nombre de
      //  titres : la section de la région en porte DEUX — son `h2` et
      //  le `h3` « Les évènements de Rhode » qui ouvre le groupe
      //  imbriqué. Compter les titres donnait sept pour six sections,
      //  ce qui ressemblait à une faute et n'en était pas une.
      titresVisibles: Array.from(document.querySelectorAll("[data-wm-sous-onglet]"))
        .filter((n) => {
          const t = n.querySelector(":scope > h2, :scope > h3");
          return t !== null && getComputedStyle(t).position !== "absolute";
        }).length,
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
  //  ── DEUX GROUPES DEPUIS LE 5 NOVEMBRE, ET IMBRIQUÉS ──────────
  //
  //  « Tu peux rajouter des onglets plutôt pour les différents
  //  évènements » : les quatre évènements de Rhode forment un second
  //  groupe, DANS l'onglet de la région.
  //
  //  Le contrôle d'avant comptait les sections et les boutons de toute
  //  la page, et il passait tant qu'il n'y avait qu'un groupe. Avec
  //  deux, il réclamait une seule section ouverte sur les six — alors
  //  qu'il en faut exactement une PAR GROUPE, donc deux. On mesure
  //  maintenant groupe par groupe, ce qui est ce qu'on voulait dire
  //  depuis le début.
  const groupes = await p.evaluate(() => {
    const lire = () =>
      Array.from(document.querySelectorAll("[data-wm-sous-onglets]")).map((g) => {
        //  LES SECTIONS DU GROUPE, pas de sa descendance : c'est la
        //  règle que `module-annexes.ts` applique, et le harnais doit
        //  l'appliquer aussi, sinon il ne mesure pas la même chose.
        const sections = Array.from(g.querySelectorAll("[data-wm-sous-onglet]"))
          .filter((n) => n.closest("[data-wm-sous-onglets]") === g);
        const barre = g.querySelector(":scope > .wm-sous-onglets__barre");
        const boutons = barre === null
          ? []
          : Array.from(barre.querySelectorAll(":scope > .wm-onglet"));
        return {
          clefs: sections.map((n) => n.dataset.wmSousOnglet ?? ""),
          //  `hidden` SUR UNE SECTION D'UN GROUPE CACHÉ reste `hidden` :
          //  on regarde l'attribut, pas la visibilité réelle, parce que
          //  le groupe imbriqué vit dans un onglet fermé la moitié du
          //  temps.
          ouvertes: sections.filter((n) => !n.hidden).map((n) => n.dataset.wmSousOnglet),
          boutons: boutons.map((b) => b.textContent ?? ""),
          icones: boutons.map((b) => b.querySelector(".wm-onglet__icone") !== null),
          tabindex: boutons.map((b) => b.tabIndex),
          selected: boutons.map((b) => b.getAttribute("aria-selected")),
        };
      });

    //  On ouvre le premier onglet de chaque groupe avant de mesurer :
    //  le harnais a cliqué « la carte » plus haut, et un groupe
    //  imbriqué dans un onglet fermé ne se mesure pas.
    for (const g of document.querySelectorAll("[data-wm-sous-onglets]")) {
      g.querySelector(":scope > .wm-sous-onglets__barre > .wm-onglet")?.click();
    }
    const avant = lire();
    //  Puis le second du premier groupe, pour vérifier que ça bouge.
    const premier = document.querySelector("[data-wm-sous-onglets]");
    premier?.querySelectorAll(":scope > .wm-sous-onglets__barre > .wm-onglet")[1]?.click();
    const apres = lire();
    return {
      avant,
      apres,
      titreCache: getComputedStyle(
        document.querySelector("[data-wm-sous-onglet] > h2"),
      ).position === "absolute",
    };
  });
  const vu = { titreCache: groupes.titreCache };

  ok(
    "DEUX GROUPES D'ONGLETS, et le second est imbriqué dans le premier",
    groupes.avant.length === 2,
    groupes.avant.map((g) => g.clefs),
  );
  for (const [i, g] of groupes.avant.entries()) {
    ok(
      `groupe ${i + 1} : une barre, un bouton par section`,
      g.boutons.length === g.clefs.length && g.clefs.length >= 2,
      { boutons: g.boutons, clefs: g.clefs },
    );
    ok(
      `groupe ${i + 1} : UNE SEULE SECTION OUVERTE À LA FOIS`,
      g.ouvertes.length === 1,
      g.ouvertes,
    );
    ok(
      `groupe ${i + 1} : UN SEUL ONGLET DANS L'ORDRE DE TABULATION`,
      g.tabindex.filter((t) => t === 0).length === 1,
      g.tabindex,
    );
    ok(
      `groupe ${i + 1} : \`aria-selected\` suit`,
      g.selected.filter((x) => x === "true").length === 1,
      g.selected,
    );
  }
  //  ── LES ICÔNES DES ÉVÈNEMENTS ────────────────────────────────
  //
  //  « Rajouter des icônes pour chacune » (5 novembre), sur les
  //  évènements — et sur eux SEULEMENT. Le premier jet cherchait
  //  l'icône dans toute la section : l'onglet « La région de Rhode »,
  //  dont le titre n'en porte pas, allait prendre le drapeau du
  //  premier évènement imbriqué plus bas. Vu au rendu.
  ok(
    "les quatre évènements ont chacun leur icône",
    groupes.avant[1]?.icones.every((x) => x) === true &&
      groupes.avant[1]?.icones.length === 4,
    groupes.avant[1]?.icones,
  );
  ok(
    "ET LES DEUX ONGLETS DU DESSUS N'EN ONT PAS VOLÉ",
    groupes.avant[0]?.icones.every((x) => !x) === true,
    groupes.avant[0]?.icones,
  );
  ok(
    "et le clic change bien de section",
    groupes.avant[0]?.ouvertes[0] !== groupes.apres[0]?.ouvertes[0],
    [groupes.avant[0]?.ouvertes[0], groupes.apres[0]?.ouvertes[0]],
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
    //  L'OUVERTE DU PREMIER GROUPE, et pas la première ouverte du
    //  document. Une section d'un groupe imbriqué garde `hidden =
    //  false` quand l'onglet qui la contient se ferme — c'est le
    //  parent qui est caché, pas elle — donc la première non cachée du
    //  document était un évènement, qui n'appartient pas à cette barre.
    const g = document.querySelector("[data-wm-sous-onglets]");
    const ouverte = Array.from(g?.querySelectorAll("[data-wm-sous-onglet]") ?? [])
      .filter((n) => n.closest("[data-wm-sous-onglets]") === g)
      .find((n) => !n.hidden);
    return ouverte?.dataset.wmSousOnglet ?? "";
  });
  //  LE DERNIER ONGLET SE LIT DE LA PAGE, pas d'une constante : il
  //  était « le-sol » quand il y en avait quatre, il est « la-carte »
  //  depuis qu'il n'y en a plus que deux, et un nom écrit ici aurait
  //  fallu le corriger à la main.
  //
  //  ET IL SE LIT DANS SON GROUPE. Depuis le 5 novembre la page en
  //  porte deux, et le dernier `[data-wm-sous-onglet]` du document est
  //  un ÉVÈNEMENT, qui est dans l'autre groupe : la flèche gauche du
  //  premier groupe ne peut pas y aller, et n'a pas à y aller. Une
  //  flèche circule dans sa barre.
  const dernier = await p.evaluate(() => {
    const g = document.querySelector("[data-wm-sous-onglets]");
    const siennes = Array.from(g?.querySelectorAll("[data-wm-sous-onglet]") ?? [])
      .filter((n) => n.closest("[data-wm-sous-onglets]") === g);
    return siennes[siennes.length - 1]?.dataset.wmSousOnglet ?? "";
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
      //  LE CHIFFRE ET SON MOT SONT DEUX NŒUDS, et `textContent` les
      //  recolle sans espace — « 73espèces ». On les lit séparément : ce
      //  qui compte est que le nombre soit juste et que le mot
      //  s'accorde, pas la façon dont le DOM les concatène.
      chiffres: Array.from(document.querySelectorAll(".wm-faune__chiffre"))
        .map((n) =>
          [
            n.querySelector(".wm-faune__chiffre-nombre")?.textContent ?? "",
            n.querySelector(".wm-faune__chiffre-mot")?.textContent ?? "",
          ].join(" ").trim()
        ),
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
  //  LE COMPTE N'EST PLUS UNE PHRASE, C'EST UN CHIFFRE ET SON MOT. La
  //  carte de visite l'écrit en gros, parce que c'est la réponse qu'on
  //  vient chercher en cliquant une zone.
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
  //
  //  PLUS DE BOUTON « OBJET », ET C'EST LE POINT. « Il faudrait séparer
  //  davantage les objets trouvables et les pokémons » (5 novembre) :
  //  les objets ont leur bloc, donc la barre ne trie que des espèces.
  //  Un bouton « Objet » ici viderait la grille.
  const comptes = new Map();
  for (const e of TABLE) comptes.set(e.rarete, (comptes.get(e.rarete) ?? 0) + 1);
  const attendus = ["tous", "commun", "peu commun", "rare"]
    .filter((c) => c === "tous" || (comptes.get(c) ?? 0) > 0);
  ok(
    "la barre propose tous et les raretés présentes, et rien de plus",
    JSON.stringify(vu.filtres.map((f) => f.cle)) === JSON.stringify(attendus),
    vu.filtres.map((f) => f.cle),
  );
  ok(
    "ET AUCUN BOUTON « OBJET » : les objets ne sont plus dans cette grille",
    !vu.filtres.some((f) => f.cle === "objet"),
    vu.filtres.map((f) => f.cle),
  );
  const fauxComptes = vu.filtres.filter((f) =>
    f.cle !== "tous" && f.nombre !== (comptes.get(f.cle) ?? 0)
  );
  ok(
    "et chaque bouton annonce le compte du fichier",
    fauxComptes.length === 0 && vu.filtres[0]?.nombre === TABLE.length,
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
//  LE 5 NOVEMBRE — la carte de visite, les deux blocs, le numéro
//
//  Quatre demandes, et chacune défait quelque chose de la veille :
//
//    · « au clic, tu n'affiches plus le gros bloc » — le panneau de
//      détail quitte le DOM ;
//    · « en dessous, une image avec le nom de la zone, le nombre
//      d'espèces et une description » — la carte de visite ;
//    · « il faudrait séparer davantage les objets trouvables et les
//      pokémons » — deux blocs titrés au lieu d'un filtre ;
//    · « affiche le numéro du pokémon + une icône si on l'a déjà vu ».
//
//  LA DERNIÈRE SE VÉRIFIE PAR SON ABSENCE ICI. Le harnais n'a pas de
//  laissez-passer, donc pas de carnet : AUCUNE carte ne doit porter de
//  marque. C'est le contrôle qui compte le plus — une marque qui
//  apparaîtrait sans carnet serait un verdict inventé sur le pokédex de
//  quelqu'un.
// ════════════════════════════════════════════════════════════════════
console.log("\n── la carte de visite, et ce qui a remplacé le gros bloc ──");
{
  const visite = await p.evaluate(() => {
    const v = document.querySelector(".wm-faune__visite");
    const img = v?.querySelector(".wm-faune__visite-image");
    return {
      existe: v !== null,
      //  LE PANNEAU DE LA CARTE N'EST PAS CACHÉ : il n'est pas là. Une
      //  règle CSS le laisserait se remplir à chaque clic.
      panneauDansLeDom: document.querySelectorAll(".wm-carte__panneau").length,
      famille: v?.dataset.wmFamille ?? "",
      surtitre: v?.querySelector(".wm-faune__visite-sur")?.textContent ?? "",
      nom: v?.querySelector(".wm-faune__titre")?.textContent ?? "",
      image: img === null ? "" : getComputedStyle(img).backgroundImage,
      description: v?.querySelector(".wm-faune__visite-dit")?.textContent ?? "",
      note: v?.querySelector(".wm-faune__visite-note")?.textContent ?? "",
      lien: v?.querySelector(".wm-faune__visite-lien")?.getAttribute("href") ?? "",
      //  LA CARTE DE VISITE EST AVANT LA GRILLE, pas après : c'est elle
      //  qui dit où on est.
      avantLaGrille: (() => {
        const g = document.querySelector('[data-wm-liste="especes"]');
        return v !== null && g !== null &&
          (v.compareDocumentPosition(g) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;
      })(),
    };
  });

  ok("la carte de visite remplace le gros bloc", visite.existe);
  ok(
    "ET LE PANNEAU DE DÉTAIL N'EST PAS DANS LE DOM, pas seulement caché",
    visite.panneauDansLeDom === 0,
    visite.panneauDansLeDom,
  );
  ok("elle porte le nom de la zone", visite.nom === ZONE.nom, visite.nom);
  ok(
    "et le palier en surtitre, pris à la carte",
    visite.surtitre === `Palier ${ZONE.palier}`,
    visite.surtitre,
  );
  ok(
    "la couleur du palier est posée comme sur la carte",
    visite.famille === `palier${ZONE.palier}`,
    visite.famille,
  );
  //  L'IMAGE EST CELLE DE `data/carte.json`, pas une adresse devinée.
  ok(
    "la photo de la zone est celle du fichier",
    ZONE.image === undefined || visite.image.includes(ZONE.image),
    { vue: visite.image.slice(0, 120), fichier: ZONE.image },
  );
  ok(
    "la description vient de data/carte.json, mot pour mot",
    visite.description === (ZONE.description ?? ""),
    { vue: visite.description, fichier: ZONE.description },
  );
  ok(
    "les niveaux recommandés sont dits, et dits comme une recommandation",
    visite.note.includes(ZONE.niveau) && visite.note.includes("recommandation"),
    visite.note,
  );
  ok(
    "le lien mène au forum de la zone",
    visite.lien === `/f${ZONE.forumId}-`,
    visite.lien,
  );
  ok("et elle est AVANT la grille des espèces", visite.avantLaGrille);
}

console.log("\n── deux blocs titrés, les pokémon puis le sol ──");
{
  const blocs = await p.evaluate(() => {
    const titres = Array.from(document.querySelectorAll(".wm-faune__sol-titre"))
      .map((n) => n.textContent ?? "");
    const especes = document.querySelector('[data-wm-liste="especes"]');
    const objets = document.querySelector('[data-wm-liste="objets"]');
    return {
      titres,
      //  LES DEUX LISTES SONT DEUX LISTES, et pas une liste filtrée.
      deuxListes: especes !== null && objets !== null && especes !== objets,
      //  AUCUN OBJET DANS LA GRILLE DES ESPÈCES : c'est le mélange que
      //  le 5 novembre a défait.
      objetsChezLesEspeces: especes === null
        ? -1
        : especes.querySelectorAll("[data-wm-objet]").length,
      especesChezLesObjets: objets === null
        ? -1
        : objets.querySelectorAll("[data-wm-espece]:not([data-wm-objet])").length,
      //  LE SOL EST SOUS LES ESPÈCES.
      solApres: (() => {
        const sol = document.querySelector(".wm-faune__sol");
        return especes !== null && sol !== null &&
          (especes.compareDocumentPosition(sol) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;
      })(),
      //  ET LE TABLEAU DES CINQ PARTS N'EST PLUS ÉCRIT DEUX FOIS SUR LA
      //  PAGE : « tu peux enlever ça vu que tu le redis en haut ».
      tablesDesParts: document.querySelectorAll(".wm-faune__issues").length,
      titreEnDur: Array.from(document.querySelectorAll(".wm-annexe__carte-titre"))
        .map((n) => n.textContent ?? "")
        .filter((t) => t.includes("Ce qu'on trouve au sol")).length,
    };
  });

  ok(
    "un titre pour les pokémon, un pour le sol",
    blocs.titres.some((t) => t.includes("Pokémon")) &&
      blocs.titres.some((t) => t.includes("au sol")),
    blocs.titres,
  );
  ok("et ce sont deux listes, pas une liste filtrée", blocs.deuxListes);
  ok(
    "AUCUN OBJET DANS LA GRILLE DES ESPÈCES",
    blocs.objetsChezLesEspeces === 0,
    blocs.objetsChezLesEspeces,
  );
  ok(
    "ni l'inverse",
    blocs.especesChezLesObjets === 0,
    blocs.especesChezLesObjets,
  );
  ok("le sol vient après les pokémon", blocs.solApres);
  ok(
    "LES CINQ PARTS NE SONT PLUS ÉCRITES DEUX FOIS SUR LA PAGE",
    blocs.tablesDesParts === 1 && blocs.titreEnDur === 0,
    { listes: blocs.tablesDesParts, sectionEnDur: blocs.titreEnDur },
  );
}

console.log("\n── le numéro du dex, et la marque qui doit se taire ──");
{
  const numeros = json("data/dex-numeros.json").numeros;
  const marques = await p.evaluate(() => ({
    nos: Array.from(document.querySelectorAll('[data-wm-liste="especes"] [data-wm-espece]'))
      .map((e) => ({
        id: Number(e.dataset.wmEspece),
        no: e.querySelector(".wm-faune__no")?.textContent ?? "",
      })),
    //  SANS CARNET, AUCUNE MARQUE. Le harnais ne passe pas
    //  `dexDuJoueur` : il n'y a ni laissez-passer ni Supabase, donc rien
    //  à dire sur le pokédex de personne.
    marquees: document.querySelectorAll(".wm-faune__marque").length,
    etats: document.querySelectorAll("[data-wm-dex]").length,
    //  ET LES OBJETS N'ONT PAS DE NUMÉRO : ils ne sont pas dans le dex.
    nosChezLesObjets: document.querySelectorAll("[data-wm-objet] .wm-faune__no").length,
  }));

  const faux = marques.nos.filter((e) => {
    const attendu = numeros[String(e.id)];
    if (attendu === undefined) return e.no !== "";
    return e.no !== `N° ${String(attendu).padStart(3, "0")}`;
  });
  ok(
    "chaque espèce porte son numéro de Rhode, celui du fichier",
    marques.nos.length === TABLE.length && faux.length === 0,
    { vus: marques.nos.length, faux: faux.slice(0, 4) },
  );
  //  TROIS CHIFFRES, TOUJOURS : c'est ce qui aligne la colonne des noms
  //  d'une carte à l'autre.
  ok(
    "et il est écrit sur trois chiffres",
    marques.nos.every((e) => /^N° \d{3}$/.test(e.no)),
    marques.nos.slice(0, 3).map((e) => e.no),
  );
  ok(
    "SANS CARNET, AUCUNE CARTE NE PORTE DE MARQUE",
    marques.marquees === 0 && marques.etats === 0,
    { marques: marques.marquees, etats: marques.etats },
  );
  ok(
    "et un objet n'a pas de numéro de dex",
    marques.nosChezLesObjets === 0,
    marques.nosChezLesObjets,
  );
}

console.log("\n── les étiquettes de rareté se lisent, « très rare » comprise ──");
{
  //  ── LE DÉFAUT DU 5 NOVEMBRE ───────────────────────────────────
  //
  //  « Pour les objets, en très rare, on ne voit pas le mot "très
  //  rare". » La bande de rareté choisit une paire fond / texte, et le
  //  mot redéclarait `color: var(--wm-texte-doux)` par-dessus : brun
  //  #6e5749 sur le rouge plein du palier 3, soit 1,6:1.
  //
  //  On mesure le contraste rendu, pas la règle : c'est la seule façon
  //  de savoir qui gagne dans la cascade.
  const lu = await p.evaluate(() => {
    //  ── LIRE UNE COULEUR, ET PAS SEULEMENT UN `rgb()` ────────────
    //
    //  CHROMIUM REND UN `color-mix` EN `color(srgb 0.91 0.92 0.89)`, en
    //  fractions de 1 — pas en 0-255. Le lecteur naïf divisait 0,91 par
    //  255 et lisait du noir. Et la pastille du mot de rareté EST un
    //  `color-mix` : `currentColor` à 14 % sur du transparent.
    //
    //  `outils/contraste.mjs` lit les deux formes depuis le début (voir
    //  son en-tête) ; la leçon n'avait pas été reportée ici.
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
    const rapport = (a, b) => {
      const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m);
      return (x + 0.05) / (y + 0.05);
    };
    return Array.from(document.querySelectorAll(".wm-faune__rarete")).map((n) => {
      const bande = n.closest(".wm-faune__tete");
      return {
        mot: n.textContent ?? "",
        //  LE FOND EST CELUI DE LA BANDE : la pastille du mot est
        //  translucide par-dessus, donc c'est la bande qui porte la
        //  couleur de référence.
        contraste: Math.round(
          rapport(getComputedStyle(n).color, getComputedStyle(bande).backgroundColor) * 100,
        ) / 100,
        taille: Number.parseFloat(getComputedStyle(n).fontSize),
        padding: getComputedStyle(n).paddingLeft,
      };
    });
  });

  const mots = [...new Set(lu.map((x) => x.mot))].sort();
  ok("les quatre mots de rareté et de fréquence sont écrits", mots.length >= 2, mots);
  const illisibles = lu.filter((x) => x.contraste < 4.5);
  ok(
    "CHAQUE MOT SE LIT SUR SA BANDE, « TRÈS RARE » COMPRISE",
    illisibles.length === 0,
    illisibles.length === 0
      ? [...new Set(lu.map((x) => `${x.mot} ${x.contraste}:1`))].sort()
      : [...new Set(illisibles.map((x) => `${x.mot} ${x.contraste}:1`))],
  );
  //  ── TOUTES LES CARTES ONT LA MÊME LARGEUR ───────────────────
  //
  //  « Pourquoi en fin de ligne la card est plus grande ? » (5
  //  novembre.) Parce que la liste était une rangée `flex` et que les
  //  cartes avaient le droit de grandir : sur le dernier rang, celles
  //  qui restaient se partageaient toute la place et butaient sur leur
  //  `max-width`. 189,6 px sur un rang plein, 220 sur le dernier.
  //
  //  C'est une grille depuis, et une grille répartit par COLONNE : la
  //  dernière rangée garde la largeur des autres. On le vérifie aux
  //  quatre largeurs, parce que le nombre de colonnes change et que
  //  c'est justement le reste de la division qui faisait le défaut.
  for (const largeur of [1440, 1100, 760, 390]) {
    const q = await ouvrir(nav, { largeur });
    await ouvrirLOngletDeLaCarte(q);
    await q.waitForSelector(".wm-carte__dessin", { timeout: 15000 });
    await q.evaluate(
      (id) =>
        document.querySelector(`.wm-carte__lieu[data-wm-forum="${id}"]`)?.dispatchEvent(
          new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
        ),
      ZONE.forumId,
    );
    await q.waitForFunction(
      () => document.querySelectorAll("[data-wm-espece]").length > 0,
      undefined,
      { timeout: 15000 },
    );
    const vu = await q.evaluate(() => {
      const mesurer = (liste) => {
        if (liste === null) return null;
        const rangs = new Map();
        for (const c of Array.from(liste.children)) {
          const r = c.getBoundingClientRect();
          if (r.width === 0) continue;
          const y = Math.round(r.top);
          if (!rangs.has(y)) rangs.set(y, []);
          rangs.get(y).push(Math.round(r.width * 10) / 10);
        }
        const toutes = [...rangs.values()].flat();
        return {
          rangs: rangs.size,
          largeurs: [...new Set(toutes)],
          dernier: [...rangs.values()].at(-1) ?? [],
          premier: [...rangs.values()][0] ?? [],
        };
      };
      return {
        especes: mesurer(document.querySelector('[data-wm-liste="especes"]')),
        objets: mesurer(document.querySelector('[data-wm-liste="objets"]')),
      };
    });

    for (const [quoi, m] of Object.entries(vu)) {
      if (m === null || m.rangs < 2) continue;
      ok(
        `à ${largeur} px, les cartes « ${quoi} » font toutes la même largeur`,
        m.largeurs.length === 1,
        m.largeurs.length === 1
          ? `${m.rangs} rangs, ${m.largeurs[0]} px`
          : { largeurs: m.largeurs, premier: m.premier, dernier: m.dernier },
      );
    }
    await q.close();
  }

  //  ── LE RUBAN NE DÉBORDE PAS DE SA CARTE ─────────────────────
  //
  //  Il déborde EXPRÈS du rembourrage de la carte — sa largeur est
  //  `100% + 2 × 12` et des marges négatives le recalent — pour toucher
  //  les deux bords. Deux façons de rater ça, et les deux sont
  //  arrivées le 5 novembre :
  //
  //    · `box-sizing` manquait, donc son propre rembourrage s'AJOUTAIT
  //      à cette largeur. Trouvé en le desserrant : le débord est passé
  //      de 11 à 15 pixels. Une largeur calculée qui suit le padding
  //      n'est pas une largeur calculée ;
  //    · les 12 pixels sont ceux de la carte EN BUREAU, et la requête
  //      média la passe à 8 : trois pixels de débord de plus sous 760.
  //
  //  PERSONNE NE VOYAIT NI L'UN NI L'AUTRE : `overflow: hidden` sur la
  //  carte rognait le surplus. Le ruban avait l'air juste, et son
  //  rembourrage de droite ne valait pas ce que la feuille disait.
  //
  //  AUX DEUX LARGEURS, DONC. Le premier contrôle écrit ne tournait
  //  qu'à 390 — la page courante en était restée là — et aurait donc
  //  laissé passer le défaut de `box-sizing`, qui est celui du bureau.
  for (const largeur of [1440, 390]) {
    const q = await ouvrir(nav, { largeur });
    await ouvrirLOngletDeLaCarte(q);
    await q.waitForSelector(".wm-carte__dessin", { timeout: 15000 });
    await q.evaluate(
      (id) =>
        document.querySelector(`.wm-carte__lieu[data-wm-forum="${id}"]`)?.dispatchEvent(
          new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
        ),
      ZONE.forumId,
    );
    await q.waitForFunction(
      () => document.querySelectorAll("[data-wm-espece]").length > 0,
      undefined,
      { timeout: 15000 },
    );
    const vu = await q.evaluate(() => {
      const cartes = Array.from(document.querySelectorAll("[data-wm-espece]")).slice(0, 12);
      const debord = cartes.map((c) => {
        const b = c.querySelector(".wm-faune__tete");
        if (b === null) return 0;
        const rc = c.getBoundingClientRect();
        const rb = b.getBoundingClientRect();
        //  Positif = le ruban sort de la carte. Un pixel de chaque côté
        //  est la bordure de la carte, et c'est juste.
        return Math.round(Math.max(rc.left - rb.left, rb.right - rc.right));
      });
      const carte = cartes[0];
      const bande = carte?.querySelector(".wm-faune__tete");
      return {
        debord,
        //  LES DEUX CÔTÉS DOIVENT ÊTRE SYMÉTRIQUES : un ruban qui
        //  touche à gauche et pas à droite est le signe exact d'une
        //  largeur et d'une marge qui ne parlent plus de la même carte.
        gauche: bande === null
          ? 0
          : Math.round(bande.getBoundingClientRect().left - carte.getBoundingClientRect().left),
        droite: bande === null
          ? 0
          : Math.round(carte.getBoundingClientRect().right - bande.getBoundingClientRect().right),
        rembourrage: carte === undefined ? "" : getComputedStyle(carte).paddingLeft,
      };
    });
    const pires = vu.debord.filter((d) => d > 1);
    ok(
      `à ${largeur} px, LE RUBAN TIENT DANS SA CARTE`,
      pires.length === 0 && vu.gauche === vu.droite,
      pires.length === 0 && vu.gauche === vu.droite
        ? `débord max ${Math.max(...vu.debord)} px, ${vu.gauche} de chaque côté, ` +
          `carte rembourrée à ${vu.rembourrage}`
        : { pires, gauche: vu.gauche, droite: vu.droite },
    );
    await q.close();
  }

  //  « Écris plus petit et ajoute des paddings » : on mesure le rendu.
  ok(
    "l'étiquette est plus petite que le corps du texte",
    lu.every((x) => x.taille <= 11),
    [...new Set(lu.map((x) => x.taille))],
  );
  ok(
    "et elle a du padding, donc elle ressemble à un tag",
    lu.every((x) => Number.parseFloat(x.padding) >= 4),
    [...new Set(lu.map((x) => x.padding))],
  );
}

// ════════════════════════════════════════════════════════════════════
//  LE TEXTE ÉCRIT PAR LE SCRIPT SE LIT — DANS LES DEUX THÈMES
//
//  ── POURQUOI CE CONTRÔLE N'EXISTAIT PAS, ET AURAIT DÛ ────────────────
//
//  `outils/contraste.mjs` mesure 176 textes sur cette annexe et n'en
//  trouve aucun en défaut. Il lit la page SERVIE : le titre, le chapô,
//  les notices, le repli sans JavaScript.
//
//  La grille d'espèces, elle, est construite au clic sur une zone. Elle
//  n'a donc JAMAIS été mesurée — et le 5 novembre, en regardant un
//  rendu en thème sombre, deux textes se sont révélés en `rgb(0, 0, 0)`
//  faute de couleur déclarée : le titre des deux blocs à 1,23:1, et le
//  NOM DE CHAQUE ESPÈCE à 1,35:1. Soixante-sept noms illisibles par
//  zone, aussi vieux que la grille.
//
//  Le défaut n'était pas dans la feuille — il était dans ce qu'on
//  mesurait. On mesure maintenant ce que le script écrit.
// ════════════════════════════════════════════════════════════════════
for (const theme of ["light", "dark"]) {
  console.log(`\n── ce que le script écrit se lit (thème ${theme === "dark" ? "sombre" : "clair"}) ──`);
  const q = await ouvrir(nav, { theme });
  await ouvrirLOngletDeLaCarte(q);
  await q.waitForSelector(".wm-carte__dessin", { timeout: 15000 });
  await q.evaluate(
    (id) =>
      document.querySelector(`.wm-carte__lieu[data-wm-forum="${id}"]`)?.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
      ),
    ZONE.forumId,
  );
  await q.waitForFunction(() => document.querySelectorAll("[data-wm-espece]").length > 0, undefined, {
    timeout: 15000,
  });

  const mesures = await q.evaluate(() => {
    //  ── LIRE UNE COULEUR, ET PAS SEULEMENT UN `rgb()` ────────────
    //
    //  CHROMIUM REND UN `color-mix` EN `color(srgb 0.91 0.92 0.89)`, en
    //  fractions de 1 — pas en 0-255. Le lecteur naïf divisait 0,91 par
    //  255 et lisait du noir. Et la pastille du mot de rareté EST un
    //  `color-mix` : `currentColor` à 14 % sur du transparent.
    //
    //  `outils/contraste.mjs` lit les deux formes depuis le début (voir
    //  son en-tête) ; la leçon n'avait pas été reportée ici.
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
    //  LE FOND EST CELUI QU'ON VOIT, pas celui de l'élément : un texte
    //  sur un conteneur transparent prend le fond de son parent, et
    //  c'est contre CELUI-LÀ qu'il se lit.
    //
    //  ── ET LE VOILE DE LA CARTE DE VISITE SE COMPOSE ──────────────
    //
    //  Première version : elle a crié sur le nom de la zone et son
    //  surtitre, à 1,83:1. C'ÉTAIT LA MESURE QUI AVAIT TORT. Ces deux-là
    //  sont écrits sur une photo recouverte d'un voile sombre — un
    //  `::after` en dégradé — et remonter les parents ne trouve que la
    //  couleur de palier SOUS le voile.
    //
    //  On compose donc le voile sur ce qu'on a trouvé. On prend son
    //  arrêt du bas, 78 % de rgb(26 18 12), parce que le texte est
    //  justement en bas. La photo, elle, reste invisible à la mesure :
    //  c'est le cas SANS photo qu'on vérifie, et c'est le pire des
    //  deux — cinq zones sur dix-neuf sont dans ce cas.
    const VOILE = { r: 26, g: 18, b: 12, a: 0.78 };
    const composer = (c) => {
      const [r, g, b] = canaux(c);
      const m = (sous, dessus) => Math.round(dessus * VOILE.a + sous * (1 - VOILE.a));
      return `rgb(${m(r, VOILE.r)}, ${m(g, VOILE.g)}, ${m(b, VOILE.b)})`;
    };
    const fond = (n) => {
      const sousLeVoile = n.closest(".wm-faune__visite-image") !== null;
      let e = n;
      while (e !== null) {
        const c = getComputedStyle(e).backgroundColor;
        if (c !== "rgba(0, 0, 0, 0)" && !/, 0\)$/.test(c)) {
          return sousLeVoile ? composer(c) : c;
        }
        e = e.parentElement;
      }
      return "rgb(255, 255, 255)";
    };
    const rapport = (n) => {
      const [x, y] = [lum(getComputedStyle(n).color), lum(fond(n))].sort((a, b) => b - a);
      return Math.round(((x + 0.05) / (y + 0.05)) * 100) / 100;
    };
    //  TOUT CE QUE `module-faune.ts` ÉCRIT ET QUI PORTE DU TEXTE. La
    //  liste se tient à la main exprès : un sélecteur générique
    //  attraperait les pastilles de type, qui sont des étiquettes
    //  colorées et se mesurent autrement.
    const quoi = [
      ".wm-faune__sol-titre",
      ".wm-faune__sol-sous",
      ".wm-faune__titre",
      ".wm-faune__no",
      ".wm-faune__nom",
      ".wm-faune__niveaux",
      ".wm-faune__dit",
      ".wm-faune__visite-sur",
      ".wm-faune__visite-dit",
      ".wm-faune__visite-note",
      ".wm-faune__visite-lien",
      ".wm-faune__chiffre-nombre",
      ".wm-faune__chiffre-mot",
      ".wm-faune__issue-pct",
      ".wm-faune__issue-mot",
      ".wm-faune__sur",
      ".wm-filtre__mot",
      ".wm-filtres__compte",
    ];
    const out = [];
    for (const s of quoi) {
      for (const n of Array.from(document.querySelectorAll(s)).slice(0, 3)) {
        if ((n.textContent ?? "").trim() === "") continue;
        out.push({ quoi: s, contraste: rapport(n), couleur: getComputedStyle(n).color });
      }
    }
    return out;
  });

  //  LE NOIR PUR EST SA PROPRE ALERTE. `rgb(0, 0, 0)` sur cette page
  //  ne vient d'aucun jeton : il veut dire qu'aucune couleur n'est
  //  déclarée et que le navigateur est retombé sur sa valeur initiale.
  //  Le dire à part du contraste, parce que c'est une AUTRE faute —
  //  elle passe inaperçue en thème clair, où le noir se lit très bien.
  const nus = [...new Set(mesures.filter((m) => m.couleur === "rgb(0, 0, 0)").map((m) => m.quoi))];
  ok(
    "AUCUN TEXTE SANS COULEUR DÉCLARÉE",
    nus.length === 0,
    nus,
  );
  const sombres = [...new Set(
    mesures.filter((m) => m.contraste < 4.5).map((m) => `${m.quoi} ${m.contraste}:1`),
  )];
  ok(
    `les ${mesures.length} textes du script tiennent 4,5:1`,
    sombres.length === 0,
    sombres.length === 0 ? `le plus faible : ${Math.min(...mesures.map((m) => m.contraste))}:1` : sombres,
  );
  await q.close();
}

// ════════════════════════════════════════════════════════════════════
//  LA CARTE DÉCIDE DE LA HAUTEUR, PAS LA LISTE DES PALIERS
//
//  « La carte est trop petite, augmente sa taille de façon à ce qu'elle
//  soit aussi grande que les paliers — ou alors tu mets un scroll sur
//  les paliers. » (5 novembre)
//
//  Les deux, et structurellement. Le premier essai y arrivait par
//  chance : carte de 712, liste de 710. Deux pixels d'écart, et rien
//  qui l'oblige — un nom de zone plus long et la liste repoussait la
//  rangée en laissant le dessin derrière elle, puisqu'il tient sa
//  hauteur de sa largeur et pas de sa rangée.
//
//  La colonne est sortie du flux depuis. On le vérifie en GONFLANT la
//  liste : le dessin ne doit pas bouger d'un pixel, et la liste doit se
//  mettre à défiler.
// ════════════════════════════════════════════════════════════════════
console.log("\n── la carte et la liste des paliers ──");
{
  const q = await ouvrir(nav);
  await ouvrirLOngletDeLaCarte(q);
  await q.waitForSelector(".wm-carte__dessin", { timeout: 15000 });
  const hauteurs = await q.evaluate(() => {
    const l = (s) => Math.round(document.querySelector(s)?.getBoundingClientRect().width ?? -1);
    const h = (s) => Math.round(document.querySelector(s)?.getBoundingClientRect().height ?? -1);
    const liste = document.querySelector(".wm-carte__liste-cadre");
    if (liste === null) return null;
    const lire = () => ({
      large: l(".wm-carte__cadre"),
      haut: h(".wm-carte__cadre"),
      colonne: h(".wm-carte__colonne"),
      defile: liste.scrollHeight > liste.clientHeight + 1,
    });
    const avant = lire();
    const faux = document.createElement("div");
    faux.style.height = "600px";
    liste.appendChild(faux);
    const apres = lire();
    faux.remove();
    return { avant, apres };
  });

  ok(
    "LA CARTE ET LA LISTE FONT LA MÊME HAUTEUR",
    hauteurs !== null && hauteurs.avant.colonne === hauteurs.avant.haut,
    hauteurs?.avant,
  );
  ok(
    "ET C'EST LA CARTE QUI DÉCIDE : une liste plus longue défile, elle ne la pousse pas",
    hauteurs !== null && hauteurs.avant.haut === hauteurs.apres.haut &&
      hauteurs.avant.large === hauteurs.apres.large && hauteurs.apres.defile,
    hauteurs,
  );
  //  ELLE EST CARRÉE, comme son repère : un cadre qui ne l'est pas
  //  laisse de l'eau sur deux côtés — le défaut du matin.
  ok(
    "et elle est carrée, comme le repère de data/carte.json",
    hauteurs !== null && hauteurs.avant.large === hauteurs.avant.haut,
    hauteurs?.avant,
  );
  //  ET ELLE A GRANDI. 612 le matin, 712 le soir : c'est la demande.
  //  Le nombre n'est pas écrit en dur — on vérifie qu'elle prend bien
  //  ce que la page lui laisse, colonne des paliers déduite.
  const reste = await q.evaluate(() => {
    const corps = document.querySelector(".wm-carte__corps");
    if (corps === null) return -1;
    const c = getComputedStyle(corps);
    return Math.round(
      corps.getBoundingClientRect().width - Number.parseFloat(c.paddingRight),
    );
  });
  ok(
    "et elle prend toute la largeur que la page lui laisse",
    hauteurs !== null && Math.abs(hauteurs.avant.large - reste) <= 1,
    { carte: hauteurs?.avant.large, disponible: reste },
  );
  await q.close();
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
  //  ── LA LARGEUR DE LA COLONNE ────────────────────────────────
  //
  //  Trois tours de vis en deux jours. Le 4, la colonne était sans
  //  borne ; le 5 au matin, on bornait le TEXTE à 880 dedans ; le 5 au
  //  soir, « ça fait bizarre que ce soit centré à gauche avec un gros
  //  vide à droite » — forcément, border le texte dans une colonne
  //  large fabrique le vide.
  //
  //  C'est la COLONNE qui se borne maintenant, et le texte la remplit.
  //  Deux choses à tenir : qu'elle reste un cran au-dessus des 880 des
  //  douze autres annexes (« légèrement plus large à cause de la map
  //  et des lieux gardés à droite »), et qu'il ne reste PLUS de vide —
  //  c'est-à-dire que le texte fasse la largeur de sa boîte.
  {
    const mesures = await q.evaluate(() => {
      const l = (n) => (n === null ? -1 : Math.round(n.getBoundingClientRect().width));
      const region = document.querySelector('[data-wm-sous-onglet="la-region"]');
      return {
        colonne: l(document.querySelector(".wm-annexe__colonne")),
        //  LA LARGEUR DE CONTENU DE LA BOÎTE, rembourrage déduit :
        //  `.wm-annexe__carte` en pose 24 de chaque côté, et c'est
        //  dedans que la section vit. Comparer à sa largeur de bordure
        //  réclamait 48 pixels que la section ne peut pas occuper.
        boite: (() => {
          const n = document.querySelector(".wm-annexe__carte");
          if (n === null) return -1;
          const c = getComputedStyle(n);
          return Math.round(
            n.getBoundingClientRect().width -
              Number.parseFloat(c.paddingLeft) - Number.parseFloat(c.paddingRight),
          );
        })(),
        region: l(region),
        chapo: l(document.querySelector(".wm-annexe__chapo")),
      };
    });
    //  ── LE LAVIS COUVRE-T-IL TOUTE LA COLONNE ? ───────────────
    //
    //  Le décor de l'annexe est une photo de zone floutée, et un lavis
    //  opaque la couvre jusqu'au bord droit de la colonne de lecture.
    //  Ce bord était écrit en dur dans le dégradé — 936 pixels, soit
    //  48 de marge + 880 de colonne + 8 — et personne ne l'avait relié
    //  à la largeur de la colonne : tant qu'elle valait 880, les deux
    //  s'accordaient par hasard.
    //
    //  Le 5 novembre la colonne est passée à 980, et les 92 derniers
    //  pixels de chaque ligne se sont retrouvés sur la photo.
    //
    //  `outils/contraste.mjs` NE PEUT PAS VOIR ÇA : il mesure un texte
    //  sur sa couleur de fond, jamais sur les pixels d'une image. Son
    //  « zéro défaut » ne dit rien d'un texte posé sur un décor. C'est
    //  la géométrie qui tient la promesse, donc c'est la géométrie
    //  qu'on mesure.
    {
      const lavis = await q.evaluate(() => {
        const corps = document.querySelector(".wm-annexe__corps");
        const col = document.querySelector(".wm-annexe__colonne");
        if (corps === null || col === null) return null;
        const apres = getComputedStyle(corps, "::after").backgroundImage;
        //  Le premier arrêt en pixels du dégradé horizontal : c'est là
        //  que le lavis cesse d'être opaque.
        const arrets = (apres.match(/(\d+(?:\.\d+)?)px/g) ?? []).map(Number.parseFloat);
        return {
          bordDuTexte: Math.round(
            col.getBoundingClientRect().right - corps.getBoundingClientRect().left,
          ),
          finDuLavis: arrets.length === 0 ? -1 : Math.round(arrets[0]),
          mesure: getComputedStyle(document.querySelector(".wm-annexe"))
            .getPropertyValue("--annexe-mesure").trim(),
        };
      });
      ok(
        "LE LAVIS COUVRE LA COLONNE ENTIÈRE : aucun texte sur la photo",
        lavis !== null && lavis.finDuLavis >= lavis.bordDuTexte,
        lavis,
      );
    }

    //  ── LA BORNE, ET POURQUOI ELLE A MONTÉ ───────────────────
    //
    //  980 d'abord, puis 1060 le soir même : « la carte est trop
    //  petite » — elle tient sa taille de la largeur qui lui reste,
    //  une fois la colonne des paliers déduite. 1060 lui donne 712 de
    //  côté au lieu de 612.
    //
    //  LA BORNE HAUTE EST LÀ POUR UNE RAISON : au-delà, les lignes de
    //  l'onglet de la région deviennent trop longues pour se lire d'un
    //  trait, et c'est la demande du matin — « que ça ressemble aux
    //  autres maquettes ». Elle se discute ; elle ne se franchit pas
    //  par accident.
    ok(
      "la colonne est bornée, et un cran au-dessus des autres annexes",
      mesures.colonne > 880 && mesures.colonne <= 1100,
      mesures,
    );
    //  LE TEXTE REMPLIT SA BOÎTE : c'est ça, « plus de vide à droite ».
    //  On compare à la boîte blanche des onglets, pas à la colonne, qui
    //  porte en plus le rembourrage de cette boîte.
    ok(
      "ET LE TEXTE DE LA RÉGION REMPLIT SA BOÎTE : plus de vide à droite",
      mesures.region === mesures.boite,
      mesures,
    );
    ok(
      "le chapô aussi remplit la colonne",
      mesures.chapo === mesures.colonne,
      mesures,
    );
  }

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
