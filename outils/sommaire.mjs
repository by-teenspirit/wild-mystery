// ════════════════════════════════════════════════════════════════════
//  outils/sommaire.mjs — LE SOMMAIRE DES ANNEXES DÉFILE CHEZ LUI
//
//  « Le scroll de la barre latérale dans les annexes : c'est
//  contre-intuitif. Je dois être en bas de ma page pour pouvoir
//  scroller. » — 18 novembre.
//
//  LE DÉFAUT ÉTAIT MÉCANIQUE, et c'est pour ça qu'il mérite une mesure
//  et pas un coup d'œil : quinze entrées font plus de mille pixels,
//  donc le sommaire était plus HAUT que la fenêtre. Un bloc `sticky`
//  plus haut que la fenêtre ne colle pas en haut — il suit la page
//  jusqu'à ce que son bas touche le bas de l'écran. Ses dernières
//  entrées n'étaient donc atteignables qu'en descendant toute
//  l'annexe.
//
//  CE QUI SE MESURE ICI, dans cet ordre :
//
//    1 · il tient dans la fenêtre, pied compris ;
//    2 · il a son propre défilement, utilisable PAGE RESTÉE EN HAUT ;
//    3 · sa barre de défilement se voit ;
//    4 · l'entrée active est visible à l'arrivée, même en bas de liste,
//        et la page n'a pas bougé pour ça ;
//    5 · sur petit écran, RIEN n'a changé.
//
//  LE 5 N'EST PAS DÉCORATIF : le plafond et le défilement propres au
//  sommaire collé seraient un défaut sur un téléphone, où il passe
//  au-dessus du texte dans le fil de la page.
//
//  Usage : deno task sommaire
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
//  LA HAUTEUR DE LA BARRE, écrite en clair comme dans la feuille : le
//  plafond du sommaire est `100vh` moins celle-ci, et un harnais qui la
//  devinerait ne vérifierait que son propre calcul.
const BARRE = 56;

const soucis = [];
function dire(nom, ok, detail = "") {
  console.log(`  ${ok ? "ok  " : "DÉFAUT"} ${nom}${detail === "" ? "" : " — " + detail}`);
  if (!ok) soucis.push(nom + (detail === "" ? "" : " — " + detail));
}

//  ── LA PAGE EST SERVIE TELLE QUELLE, FEUILLES DU DÉPÔT ─────────────
//
//  Même montage que `outils/contraste.mjs` : les deux feuilles
//  distantes deviennent le contenu du disque (on mesure la feuille DU
//  DÉPÔT, pas celle qui est déployée), les images deviennent des
//  `data:`, et le script s'en va — le sommaire est posé plus bas par le
//  vrai module.
const enLocal = (f) => {
  const o = readFileSync(R + f);
  return `data:image/${f.endsWith(".jpg") ? "jpeg" : "png"};base64,${o.toString("base64")}`;
};

const document_ = (cible) =>
  readFileSync(R + cible, "utf8")
    .replace(
      /<link rel="stylesheet" href="https:\/\/by-teenspirit\.github\.io\/wild-mystery\/([^"]+)"\s*\/?>/g,
      (tout, f) => {
        try {
          return `<style>${readFileSync(R + f, "utf8")}</style>`;
        } catch {
          return tout;
        }
      },
    )
    .replace(/url\('https:\/\/by-teenspirit\.github\.io\/wild-mystery\/([^']+)'\)/g, (tout, f) => {
      try {
        return `url('${enLocal(f)}')`;
      } catch {
        return tout;
      }
    })
    .replace(
      /<script src="https:\/\/by-teenspirit\.github\.io\/wild-mystery\/[^"]+"><\/script>/g,
      "",
    );

const DONNEES = JSON.parse(readFileSync(R + "data/annexes.json", "utf8"));

const nav = await chromium.launch(CHROME === undefined ? {} : { executablePath: CHROME });

/** L'adresse RÉELLE d'une annexe, prise dans `data/annexes.json`.
 *
 *  LE HARNAIS A ATTRAPÉ ÇA TOUT DE SUITE. Première version : je montais
 *  chaque page sur `/h1-<slug>`, en me disant que le numéro ne comptait
 *  pas. Il compte — depuis aujourd'hui le sommaire reconnaît l'annexe
 *  par son NUMÉRO de page et ne retombe sur le slug qu'à défaut
 *  (`pageDeLAdresse`, `src/navigateur/annexes.ts`). L'essai de l'entrée
 *  active montait donc les crédits et mesurait « 01 · Par où
 *  commencer » : il passait au vert sans rien vérifier. */
function adresseDe(slug) {
  for (const s of DONNEES.sections) {
    for (const e of s.entrees) {
      if (e.slug === slug && typeof e.adresse === "string") return e.adresse;
    }
  }
  throw new Error(`pas d'adresse pour « ${slug} » dans data/annexes.json`);
}

/** Monte une annexe à SON adresse, sommaire posé par le vrai module. */
async function monter(cible, slug, { largeur = 1440, hauteur = 900 } = {}) {
  const p = await nav.newPage({ viewport: { width: largeur, height: hauteur } });
  p.on("pageerror", (e) => soucis.push("erreur JS : " + e.message));
  const doc = document_(cible);
  //  L'ADRESSE COMPTE : le module y lit QUELLE annexe il habille, donc
  //  quelle entrée est active. Montée ailleurs, la page n'en aurait
  //  aucune — ou, pire, la mauvaise.
  const adresse = `https://mysteryinrhode.forumactif.com${adresseDe(slug)}`;
  await p.route(
    "**/*",
    (r) =>
      r.request().url() === adresse
        ? r.fulfill({ contentType: "text/html; charset=utf-8", body: doc })
        : r.fulfill({ status: 204, body: "" }),
  );
  await p.goto(adresse);
  await p.addScriptTag({ path: R + "js/harnais-sommaire.js" });
  await p.evaluate(() => globalThis.wmPoserLeTheme());
  await p.evaluate((d) => globalThis.wmPoserLeSommaire(d), DONNEES);
  await p.waitForTimeout(150);
  return p;
}

const releve = (p) =>
  p.evaluate((barre) => {
    const s = document.querySelector(".wm-annexe__sommaire");
    if (s === null) return null;
    const liens = [...s.querySelectorAll("a")];
    const boite = s.getBoundingClientRect();
    const style = getComputedStyle(s);
    const dernier = liens[liens.length - 1]?.getBoundingClientRect() ?? null;
    return {
      liens: liens.length,
      haut: Math.round(boite.top),
      bas: Math.round(boite.bottom),
      hauteur: Math.round(boite.height),
      scrollHeight: s.scrollHeight,
      clientHeight: s.clientHeight,
      defile: s.scrollHeight > s.clientHeight,
      overflowY: style.overflowY,
      position: style.position,
      fenetre: innerHeight,
      pageY: Math.round(scrollY),
      place: innerHeight - barre,
      dernierVisibleDansLaListe: dernier !== null &&
        dernier.top >= boite.top - 1 && dernier.bottom <= boite.bottom + 1,
    };
  }, BARRE);

// ── 1 et 2 · IL TIENT DANS LA FENÊTRE, ET IL DÉFILE SEUL ───────────
console.log("\n── LE SOMMAIRE SUR UN ÉCRAN ORDINAIRE ─────────────────");
let p = await monter("pages/annexe-par-ou-commencer.html", "par-ou-commencer");
let m = await releve(p);
dire("LE SOMMAIRE EST LÀ, avec ses entrées", m !== null && m.liens >= 10, `${m?.liens} entrée(s)`);
dire(
  "IL TIENT DANS LA FENÊTRE, PIED COMPRIS — `border-box`, sinon le plafond mentait de ses 24 px",
  m.bas <= m.fenetre,
  `bas ${m.bas} · fenêtre ${m.fenetre}`,
);
dire(
  "LE PLAFOND EST LA PLACE QUI RESTE SOUS LA BARRE",
  m.hauteur <= m.place && m.hauteur > m.place - 40,
  `hauteur ${m.hauteur} · place ${m.place}`,
);
dire(
  "IL A SON PROPRE DÉFILEMENT — c'est ce qui manquait",
  m.defile && m.overflowY === "auto",
  `${m.scrollHeight} de contenu dans ${m.clientHeight} · overflow-y ${m.overflowY}`,
);

//  LE POINT QUI DIT TOUT : page restée en haut, on descend DANS le
//  sommaire, et la dernière entrée vient. Avant, il fallait descendre
//  l'annexe entière.
const chezLui = await p.evaluate(() => {
  const s = document.querySelector(".wm-annexe__sommaire");
  s.scrollTop = s.scrollHeight;
  const liens = s.querySelectorAll("a");
  const d = liens[liens.length - 1].getBoundingClientRect();
  return {
    pageY: Math.round(scrollY),
    descendu: Math.round(s.scrollTop) > 0,
    dernierAuxYeux: d.top >= 0 && d.bottom <= innerHeight,
  };
});
dire(
  "LA DERNIÈRE ENTRÉE S'ATTEINT SANS DESCENDRE LA PAGE",
  chezLui.descendu && chezLui.dernierAuxYeux && chezLui.pageY === 0,
  `page à ${chezLui.pageY}`,
);

// ── 3 · LE DÉFILEMENT NE DÉBORDE PAS SUR LA PAGE ───────────────────
//
//  CE N'EST PAS LA LARGEUR DE LA BARRE QU'ON MESURE ICI, et c'est une
//  leçon du 18 novembre : la première version de cet essai exigeait
//  les 6 px que la feuille dessine, et trouvait 0. Non parce que la
//  règle manque, mais parce que le Chromium du bac à sable pose des
//  barres FLOTTANTES, qui ne réservent aucune place — un décor
//  réservé à la barre d'un autre que celui qu'on teste. Un essai qui
//  mesure son environnement au lieu du code ne prouve rien, et il
//  faut le retirer plutôt que l'arranger.
//
//  CE QUI SE MESURE, LUI, SE SENT À LA MOLETTE : arrivé au bout du
//  sommaire, le geste ne doit pas se mettre à faire défiler l'annexe
//  derrière.
const tenue = await p.evaluate(() => {
  const s = document.querySelector(".wm-annexe__sommaire");
  return {
    contain: getComputedStyle(s).overscrollBehaviorY,
  };
});
dire(
  "LE DÉFILEMENT RESTE DANS LE SOMMAIRE — arrivé au bout, la molette n'emporte pas l'annexe",
  tenue.contain === "contain",
  `overscroll-behavior-y ${tenue.contain}`,
);
await p.close();

// ── 4 · L'ENTRÉE ACTIVE EST VISIBLE À L'ARRIVÉE ────────────────────
//
//  « 15 · LES CRÉDITS » est la dernière de la liste : sur un sommaire
//  qui défile, elle est hors de sa partie visible au chargement. Le
//  module l'y amène — en écrivant `scrollTop`, pas avec
//  `scrollIntoView`, qui aurait fait défiler la page aussi.
console.log("\n── UNE ANNEXE DU BAS DE LA LISTE ──────────────────────");
p = await monter("pages/annexe-credits.html", "credits");
m = await releve(p);
const active = await p.evaluate(() => {
  const s = document.querySelector(".wm-annexe__sommaire");
  const a = s.querySelector('[aria-current="page"]');
  if (a === null) return null;
  const r = a.getBoundingClientRect();
  const b = s.getBoundingClientRect();
  return {
    mot: a.textContent.trim(),
    dansLaListe: r.top >= b.top - 1 && r.bottom <= b.bottom + 1,
    auxYeux: r.top >= 0 && r.bottom <= innerHeight,
    pageY: Math.round(scrollY),
    descendu: Math.round(s.scrollTop),
  };
});
dire("L'ENTRÉE ACTIVE EXISTE", active !== null, active?.mot ?? "aucune");
dire(
  "ELLE EST VISIBLE À L'ARRIVÉE, sans un geste",
  active.dansLaListe && active.auxYeux,
  `${active.mot} · sommaire descendu de ${active.descendu}`,
);
dire(
  "ET LA PAGE N'A PAS BOUGÉ POUR ÇA — `scrollIntoView` l'aurait emportée",
  active.pageY === 0,
  `page à ${active.pageY}`,
);
await p.close();

// ── 5 · SUR PETIT ÉCRAN, RIEN N'A CHANGÉ ───────────────────────────
console.log("\n── SUR UN TÉLÉPHONE ───────────────────────────────────");
p = await monter("pages/annexe-par-ou-commencer.html", "par-ou-commencer", {
  largeur: 390,
  hauteur: 844,
});
m = await releve(p);
dire(
  "LE SOMMAIRE EST DANS LE FIL DE LA PAGE, décollé",
  m.position === "static",
  `position ${m.position}`,
);
dire(
  "AUCUN PLAFOND, AUCUN DÉFILEMENT PROPRE — un panneau à faire défiler dans un téléphone serait pire que le défaut corrigé",
  !m.defile && m.overflowY === "visible",
  `overflow-y ${m.overflowY} · ${m.scrollHeight} dans ${m.clientHeight}`,
);
await p.close();

await nav.close();
console.log(soucis.length === 0 ? "\nTOUT PASSE." : `\n${soucis.length} DÉFAUT(S).`);
if (soucis.length > 0) process.exit(1);
