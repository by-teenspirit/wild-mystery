// ════════════════════════════════════════════════════════════════════
//  outils/combat.mjs — les messages du Maître du Jeu, mesurés
//
//  LA CARTE DE RENCONTRE, LE TOUR, ET LE BILAN DE CLÔTURE. Le fichier
//  s'appelle « combat » parce qu'il est né avec la fiche de combat, et
//  il garde ce nom : le renommer coûterait une ligne de CI à changer à
//  la main pour rien. Ce qu'il couvre est écrit ici, c'est ce qui
//  compte.
//
//  Les messages du Maître du Jeu sont les SEULS de la charte que nous
//  écrivons côté serveur : personne ne les relit avant qu'ils partent
//  sur le forum, et un défaut s'y multiplie par cinq tours et par
//  sujet. D'où ce harnais.
//
//  ── POURQUOI LES MESURES PLUTÔT QUE LE BALISAGE ────────────────────
//
//  Le balisage est déjà tenu par `fiche-de-combat.test.ts`, au
//  caractère près. Ce qu'un test Deno ne peut PAS dire, c'est ce que
//  le navigateur en fait : un sprite étiré, deux colonnes de largeurs
//  différentes, un débordement au téléphone. Les trois se sont
//  produits le 18 novembre, au premier rendu.
//
//  ── LA FICHE EST MONTÉE DANS UN VRAI CORPS DE MESSAGE ──────────────
//
//  `.postbody .content`, comme sur le forum. C'est la leçon du
//  8 novembre : « mes aperçus précédents posaient la fiche hors de
//  `.content` et ne pouvaient pas voir » la règle de `05-sujet.css`
//  qui écrasait la nôtre. Une fiche montée dans le vide ne prouve
//  rien.
// ════════════════════════════════════════════════════════════════════

import { chromium } from "npm:playwright@1.56.0";
import { readFileSync } from "node:fs";
import { redigerLaCarte } from "../src/application/carte-de-rencontre.ts";
import { redigerLeTour } from "../src/application/message-de-tour.ts";
import { redigerLeBilan } from "../src/application/bilan.ts";

const R = new URL("../", import.meta.url).pathname;
const CHROME = Deno.env.get("CHROME");

//  LES SPRITES VIENNENT DU DÉPÔT, par `raw.githubusercontent`. On ne
//  les sert pas depuis le disque : ce qu'on veut mesurer, c'est la
//  taille RÉELLE des fichiers livrés, et c'est elle qui a montré que
//  `width: 88px` les étirait.
const RACINE = Deno.env.get("WM_RACINE_ESSAI") ??
  "https://raw.githubusercontent.com/by-teenspirit/wild-mystery/socle-v2/";

const CARTE = redigerLaCarte({
  combatId: "c",
  sujetId: 996,
  messageId: 15601,
  essais: 0,
  mentionne: "Jake Dalziel",
  sauvage: {
    especeId: 77,
    nom: "Ponyta",
    niveau: 10,
    types: ["feu"],
    pv: 30,
    attaque: 22,
    defense: 16,
  },
  combattant: {
    especeId: 4,
    nom: "Salamèche",
    surnom: null,
    niveau: 5,
    types: ["feu"],
    pv: 18,
    pvMax: 18,
    attaque: 10,
    defense: 9,
  },
}, RACINE);

const TOUR = redigerLeTour({
  tourId: "t",
  combatId: "c",
  sujetId: 996,
  messageId: 15602,
  numero: 2,
  demande: "attaquer",
  detail: { nom: "Flammèche" },
  recit: {
    frappes: [
      {
        qui: "joueur",
        capacite: { nom: "Flammèche" },
        touche: true,
        degats: { points: 12, efficacite: 1, de: 93 },
      },
      {
        qui: "sauvage",
        capacite: { nom: "Flammèche" },
        touche: true,
        degats: { points: 7, efficacite: 1, de: 88 },
      },
    ],
  },
  fin: null,
  essais: 0,
  mentionne: "Jake Dalziel",
  sauvage: { especeId: 77, nom: "Ponyta", pv: 18, pvMax: 30 },
  //  UN SURNOM LONG, EXPRÈS : c'est lui qui poussait sa colonne quand
  //  les camps étaient en `flex: 1 1 auto`.
  combattant: { especeId: 4, nom: "Salamèche", surnom: "Biscotte", pv: 11, pvMax: 18 },
}, RACINE);

const SEUL = redigerLaCarte({
  combatId: "c",
  sujetId: 996,
  messageId: 15603,
  essais: 0,
  mentionne: "Erin Kavanagh",
  sauvage: {
    especeId: 133,
    nom: "Évoli",
    niveau: 7,
    types: ["normal"],
    pv: 24,
    attaque: 14,
    defense: 13,
  },
  combattant: null,
}, RACINE);

const BILAN = redigerLeBilan([
  {
    pseudo: "Jake Dalziel",
    captures: [{ nom: "Farfuret", especeId: 215, niveau: 19 }],
    experience: [
      { nom: "Biscotte", especeId: 4, gain: 180 },
      { nom: "Goupix", especeId: 37, gain: 240 },
    ],
    croisees: [{ nom: "Stalgamin", especeId: 220 }, { nom: "Ponyta", especeId: 77 }],
    ajoutes: [{ objet: "Pierre Feu", quantite: 1 }],
    consommes: [{ objet: "Poké Ball", quantite: 2 }],
    pokedollarsAvant: 1240,
    pokedollarsApres: 1590,
  },
  {
    pseudo: "Erin Kavanagh",
    captures: [],
    experience: [],
    croisees: [{ nom: "Évoli", especeId: 133 }],
    ajoutes: [],
    consommes: [],
    pokedollarsAvant: 800,
    pokedollarsApres: 800,
  },
  //  UN JOUEUR SANS RIEN : il doit être nommé quand même, sinon son
  //  nom suivi de rien ressemble à un bogue.
  {
    pseudo: "Nael Ardent",
    captures: [],
    experience: [],
    croisees: [],
    ajoutes: [],
    consommes: [],
    pokedollarsAvant: 500,
    pokedollarsApres: 500,
  },
], RACINE);

const page = `<!doctype html><html lang="fr"><head><meta charset="utf-8">
<style>html,body{margin:0}body{background:var(--wm-fond-page)}
.sujet{max-width:820px;margin:0 auto}</style>
<style>${readFileSync(R + "panneau-admin/jetons.css", "utf8")}</style>
<style>${readFileSync(R + "css/wild-mystery.css", "utf8")}</style>
</head><body id="modernbb">
<div class="sujet"><div class="post"><div class="postbody"><div class="content">
<div class="essai" data-n="1">${CARTE}</div>
<div class="essai" data-n="2">${TOUR}</div>
<div class="essai" data-n="3">${SEUL}</div>
</div></div></div></div></body></html>`;

const pageDuBilan = page.replace(
  '<div class="essai" data-n="1">' + CARTE + "</div>",
  '<div class="essai" data-n="4">' + BILAN + "</div>",
);

const soucis = [];
function dire(nom, ok, detail = "") {
  console.log(`  ${ok ? "ok  " : "DÉFAUT"} ${nom}${detail === "" ? "" : " — " + detail}`);
  if (!ok) soucis.push(nom + (detail === "" ? "" : " — " + detail));
}

const nav = await chromium.launch(CHROME === undefined ? {} : { executablePath: CHROME });

async function monter(largeur) {
  const p = await nav.newPage({ viewport: { width: largeur, height: 1200 } });
  p.on("pageerror", (e) => soucis.push("erreur JS : " + e.message));
  await p.setContent(page);
  //  LES SPRITES VIENNENT DU RÉSEAU : sans attente, `naturalWidth` vaut
  //  zéro et la mesure d'étirement ne dirait rien.
  await p.waitForFunction(
    () => [...document.querySelectorAll(".wm-combat__sprite")].every((i) => i.complete),
    null,
    { timeout: 20000 },
  ).catch(() => soucis.push("les sprites ne se chargent pas"));
  return p;
}

// ── 1 · LES DEUX CAMPS FONT LA MÊME LARGEUR ─────────────────────────
//
//  C'est tout l'intérêt de la mise côte à côte : un combat est une
//  comparaison, et deux colonnes inégales se comparent mal. Le défaut
//  venait de `flex: 1 1 auto`, où « Biscotte (Salamèche) » poussait sa
//  colonne et laissait le sauvage à l'étroit — alors que c'est lui
//  l'information neuve.
console.log("\n── LES DEUX CAMPS ─────────────────────────────────────");
let p = await monter(900);
const duels = await p.evaluate(() =>
  [...document.querySelectorAll(".wm-combat__duel")].map((d) => ({
    n: Number(d.closest(".essai").dataset.n),
    camps: [...d.querySelectorAll(".wm-combat__camp")].map((c) =>
      Math.round(c.getBoundingClientRect().width)
    ),
  }))
);
for (const d of duels) {
  if (d.camps.length === 2) {
    dire(
      `modèle ${d.n} : les deux camps ont la même largeur`,
      d.camps[0] === d.camps[1],
      `${d.camps[0]} et ${d.camps[1]}`,
    );
  }
}

//  ET LA FICHE SEULE GARDE SA TAILLE DE FICHE. Sans plafond elle
//  s'étalait sur les 786 px du message et ressemblait à une bannière.
const seule = duels.find((d) => d.camps.length === 1);
dire(
  "UNE FICHE SEULE NE S'ÉTALE PAS — équipe vide, planche 99 §5.3",
  seule !== undefined && seule.camps[0] <= 260,
  seule === undefined ? "aucune fiche seule montée" : `${seule.camps[0]}px`,
);

// ── 2 · AUCUN SPRITE N'EST AGRANDI ──────────────────────────────────
//
//  Les images figées font de 48 à 64 px de large. `width: 88px` les
//  étirait de 1,7 fois, et le flou ne se voyait que sur un rendu.
console.log("\n── LES SPRITES ────────────────────────────────────────");
//  ON MESURE L'IMAGE PEINTE, PAS LA BOÎTE — et c'est la première
//  version de ce contrôle qui l'a appris : avec `object-fit`, la boîte
//  reste à 96 × 76 pendant que l'image est dessinée à sa taille
//  dedans. Comparer la boîte au naturel accusait un défaut qui
//  n'existait pas.
//
//  `scale-down` ne réduit QUE si l'image dépasse la boîte, donc le
//  facteur peint vaut `min(boîte/naturel, 1)`.
const sprites = await p.evaluate(() =>
  [...document.querySelectorAll(".wm-combat__sprite")].map((i) => {
    const r = i.getBoundingClientRect();
    const f = Math.min(r.width / i.naturalWidth, r.height / i.naturalHeight, 1);
    return {
      nat: [i.naturalWidth, i.naturalHeight],
      boite: [Math.round(r.width), Math.round(r.height)],
      peint: [Math.round(i.naturalWidth * f), Math.round(i.naturalHeight * f)],
      ajustement: getComputedStyle(i).objectFit,
    };
  })
);
dire("les sprites se chargent", sprites.length > 0 && sprites.every((s) => s.nat[0] > 0), JSON.stringify(sprites.map((s) => s.nat)));
const mesurables = sprites.filter((s) => s.nat[0] > 0);
dire(
  "CHAQUE SPRITE EST PEINT À SA TAILLE — ni agrandi, ni rapetissé",
  mesurables.length > 0 &&
    mesurables.every((s) => s.peint[0] === s.nat[0] && s.peint[1] === s.nat[1]),
  mesurables.map((s) => `${s.nat.join("×")}→${s.peint.join("×")}`).join(", "),
);
//  ET C'EST `scale-down` QUI LE GARANTIT, pas la chance : avec `fill`
//  ou `cover` la boîte étirerait l'image sans que la mesure
//  ci-dessus change de forme.
dire(
  "et c'est `scale-down` qui le tient",
  mesurables.every((s) => s.ajustement === "scale-down"),
  [...new Set(mesurables.map((s) => s.ajustement))].join(", "),
);

//  LES DEUX SPRITES D'UN DUEL SE REGARDENT. Les images de face
//  regardent toutes du même côté : sans retournement, les deux Pokémon
//  ont l'air d'attendre le bus.
const sens = await p.evaluate(() =>
  [...document.querySelectorAll(".wm-combat__duel")]
    .filter((d) => d.querySelectorAll(".wm-combat__camp").length === 2)
    .map((d) =>
      [...d.querySelectorAll(".wm-combat__sprite")].map((i) =>
        getComputedStyle(i).transform === "none" ? "droit" : "retourné"
      )
    )
);
dire(
  "DANS UN DUEL, UN SEUL DES DEUX SPRITES EST RETOURNÉ",
  sens.length > 0 && sens.every((d) => d.filter((x) => x === "retourné").length === 1),
  JSON.stringify(sens),
);
await p.close();

// ── 3 · AU TÉLÉPHONE, RIEN NE DÉBORDE ───────────────────────────────
//
//  « On touche à rien pour la version mobile » : c'est donc à la fiche
//  de tenir dans la largeur, pas au forum de s'adapter à elle.
console.log("\n── AU TÉLÉPHONE (390 px) ──────────────────────────────");
p = await monter(390);
const etroit = await p.evaluate(() => ({
  debord: document.documentElement.scrollWidth > window.innerWidth,
  scroll: document.documentElement.scrollWidth,
  vue: window.innerWidth,
  colonne: getComputedStyle(document.querySelector(".wm-combat__duel")).flexDirection,
}));
dire(
  "AUCUN DÉBORDEMENT HORIZONTAL",
  !etroit.debord,
  `${etroit.scroll}px pour ${etroit.vue}px de vue`,
);
dire("et les camps passent en colonne", etroit.colonne === "column", etroit.colonne);
await p.close();

// ── 4 · LES PV SE LISENT DANS LES DEUX THÈMES ───────────────────────
//
//  C'est le seul chiffre de la fiche qui change à chaque tour, donc le
//  seul qu'on cherche des yeux. Un accent trop clair sur fond sombre
//  le rendrait illisible exactement là où il compte.
console.log("\n── LE CONTRASTE DES PV ────────────────────────────────");
p = await monter(900);
for (const theme of ["clair", "sombre"]) {
  const mesure = await p.evaluate((t) => {
    document.body.classList.toggle("wm-sombre", t === "sombre");
    const pv = document.querySelector(".wm-combat__pv");
    const fond = pv.closest(".wm-combat__camp");
    const lire = (c) => {
      const m = getComputedStyle(c).color.match(/[\d.]+/g).slice(0, 3).map(Number);
      return m;
    };
    const lireFond = (c) =>
      getComputedStyle(c).backgroundColor.match(/[\d.]+/g).slice(0, 3).map(Number);
    const lum = ([r, v, b]) => {
      const f = (x) => {
        const c = x / 255;
        return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
      };
      return 0.2126 * f(r) + 0.7152 * f(v) + 0.0722 * f(b);
    };
    const a = lum(lire(pv));
    const b = lum(lireFond(fond));
    const [haut, bas] = a > b ? [a, b] : [b, a];
    return Math.round(((haut + 0.05) / (bas + 0.05)) * 100) / 100;
  }, theme);
  //  4,5 : le seuil AA pour du texte normal. Les PV sont en gras à
  //  13,5 px, donc on ne s'autorise pas le seuil « grand texte ».
  dire(`${theme} : les PV passent AA`, mesure >= 4.5, `${mesure}:1`);
}
await p.close();

// ── 5 · LE BILAN DE CLÔTURE ─────────────────────────────────────────
//
//  « Habiller plus proprement le bilan du sujet avec un sprite », et
//  les trois listes : les captures, ceux qui ont gagné de
//  l'expérience, les espèces croisées.
//
//  CE QUI SE MESURE ICI ET NULLE PART AILLEURS : qu'il reste LISIBLE
//  SANS FEUILLE DE STYLE. C'est la règle d'origine du bilan — « dans
//  dix ans » — et elle survit au passage en fiche à une condition :
//  que le sens soit dans le texte, pas dans la mise en page. On coupe
//  donc la feuille et on relit.
console.log("\n── LE BILAN DE CLÔTURE ────────────────────────────────");
p = await nav.newPage({ viewport: { width: 900, height: 1200 } });
p.on("pageerror", (e) => soucis.push("erreur JS : " + e.message));
await p.setContent(pageDuBilan);
await p.waitForFunction(
  () => [...document.querySelectorAll(".wm-bilanp__sprite")].every((i) => i.complete),
  null,
  { timeout: 20000 },
).catch(() => soucis.push("les sprites du bilan ne se chargent pas"));

const bilan = await p.evaluate(() => ({
  prises: [...document.querySelectorAll(".wm-bilanp__prise")].length,
  //  ── ICI ON NE DEMANDE QUE « JAMAIS AGRANDI » ────────────────────
  //
  //  Pas « peint à sa taille », contrairement à la fiche de combat :
  //  la vignette du bilan est PLUS PETITE EXPRÈS — 64 × 56 contre
  //  96 × 76 —, parce qu'un bilan à quatre joueurs peut en aligner
  //  vingt là où un combat en montre deux. Un sprite de 68 px de haut
  //  y est donc réduit, et c'est voulu.
  //
  //  Ce qui reste interdit est l'agrandissement : il rend flou, et
  //  `scale-down` est là pour l'empêcher. On vérifie que le facteur
  //  ne dépasse jamais 1.
  //  ON MESURE L'IMAGE PEINTE, PAS LA BOÎTE — deuxième fois que ce
  //  piège se referme dans ce fichier. La boîte fait 64 × 56 quoi
  //  qu'elle contienne ; `scale-down` dessine l'image dedans, à sa
  //  taille ou plus petit.
  peints: [...document.querySelectorAll(".wm-bilanp__sprite")].map((i) => {
    const r = i.getBoundingClientRect();
    const f = Math.min(r.width / i.naturalWidth, r.height / i.naturalHeight, 1);
    return Math.round(Math.min(i.naturalWidth, i.naturalWidth * f));
  }),
  ajustement: [
    ...new Set(
      [...document.querySelectorAll(".wm-bilanp__sprite")]
        .map((i) => getComputedStyle(i).objectFit),
    ),
  ],
  //  LA FEUILLE COUPÉE : ce qui reste doit se lire.
  sansStyle: (() => {
    for (const s of document.querySelectorAll("style")) s.disabled = true;
    const lu = document.querySelector(".wm-bilanp").innerText;
    for (const s of document.querySelectorAll("style")) s.disabled = false;
    return lu;
  })(),
}));

dire(
  "LES TROIS LISTES ONT LEUR VIGNETTE — captures, expérience, croisées",
  bilan.prises === 6,
  `${bilan.prises} vignettes`,
);
//  ── RÉDUITE OUI, C'EST VOULU ; AGRANDIE NON, C'EST FLOU ───────────
//
//  La vignette du bilan est PLUS PETITE EXPRÈS — 64 × 56 contre
//  96 × 76 pour la fiche de combat —, parce qu'un bilan à quatre
//  joueurs peut en aligner vingt là où un combat en montre deux. Un
//  sprite de 68 px de haut y est donc réduit.
//
//  C'est `scale-down` qui interdit l'agrandissement, et le contrôle
//  d'à côté le vérifie. Ici on garde l'autre bout : qu'une vignette
//  reste assez grande pour qu'on reconnaisse le Pokémon.
dire(
  "LES VIGNETTES RESTENT RECONNAISSABLES — 40 px au moins",
  bilan.peints.length > 0 && bilan.peints.every((l) => l >= 40),
  bilan.peints.join(", ") + " px de large",
);
dire(
  "et c'est `scale-down` qui le tient",
  bilan.ajustement.length === 1 && bilan.ajustement[0] === "scale-down",
  bilan.ajustement.join(", "),
);

//  SANS CSS, CHAQUE VALEUR GARDE SON ÉTIQUETTE. C'est ce qui distingue
//  un balisage qui habille d'un balisage qui porte le sens.
for (const mot of ["CAPTURÉ : Farfuret niv. 19", "EXPÉRIENCE :", "Rien à verser"]) {
  dire(
    `sans feuille de style, « ${mot} » se lit encore`,
    bilan.sansStyle.includes(mot),
    bilan.sansStyle.slice(0, 80).replace(/\n/g, " / "),
  );
}
await p.close();

await nav.close();
console.log(soucis.length === 0 ? "\nTOUT PASSE." : `\n${soucis.length} DÉFAUT(S).`);
for (const s of soucis) console.log("  · " + s);
if (soucis.length > 0) Deno.exit(1);
