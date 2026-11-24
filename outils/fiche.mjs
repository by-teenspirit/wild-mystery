// ════════════════════════════════════════════════════════════════════
//  outils/fiche.mjs — VOIR LA FICHE SANS LA POSTER
//
//      deno task fiche
//
//  « Permets-moi d'éditer les blocs pour que je puisse régler la
//  taille des éléments les uns vis-à-vis des autres plutôt que je te
//  le dise à chaque fois. » — 24 novembre.
//
//  Les réglages sont en haut de `css/32-la-fiche-de-presentation.css`,
//  dans un bloc nommé. Cette commande est l'autre moitié : elle dessine
//  la fiche telle qu'elle sortira, avec la VRAIE feuille et le VRAI
//  rendu de `publier`, dans les quatre cas qui comptent.
//
//      apercu-fiche-remplie.png          une fiche écrite, sur un écran
//      apercu-fiche-vide.png             rien de rempli, sur un écran
//      apercu-fiche-remplie-mobile.png   la même, à 390 px
//      apercu-fiche-vide-mobile.png      et la vide, à 390 px
//
//  ── POURQUOI PAS UNE PAGE DE DÉMONSTRATION ÉCRITE À LA MAIN ─────────
//
//  Parce qu'elle divergerait. Le HTML vient d'ici de `publier`, le
//  même appel que celui qui écrit le message, et le CSS est le fichier
//  construit qui part sur GitHub Pages. Si l'aperçu est juste, le
//  forum l'est ; s'il ment, c'est que la feuille ment aussi.
//
//  ── LE FOND N'EST PAS DÉCORATIF ─────────────────────────────────────
//
//  La fiche est posée dans une fausse surface de message
//  (`fond-surface`), elle-même sur le fond de page (`fond-page`). Ce
//  sont les deux fonds qu'elle rencontre vraiment, et c'est sur eux
//  qu'on juge si une carte se voit ou disparaît.
// ════════════════════════════════════════════════════════════════════

import { chromium } from "npm:playwright@1.56.0";
import { ouvrirChromium } from "./chromium.mjs";
import { ficheVide, publier } from "../src/navigateur/fiche.ts";

const R = new URL("../", import.meta.url).pathname;
const CSS = await Deno.readTextFile(R + "css/wild-mystery.css");

/*  LA LARGEUR D'UN MESSAGE SUR LE FORUM, relevée le 30 octobre :
    1200 de forum, 236 de colonne de profil, 762 de corps. On garde la
    mesure ici plutôt qu'un nombre rond, pour que l'aperçu montre la
    place réelle et pas une place confortable. */
const LARGEUR_MESSAGE = 762;

/*  LE SPRITE D'ÉVOLI, pour que la carte du Pokémon soit complète :
    `--wmf-sprite` est un des réglages, et on ne règle pas une taille
    qu'on ne voit pas. C'est l'adresse que le catalogue donne. */
const SPRITE = "https://raw.githubusercontent.com/PokeAPI/sprites/" +
  "bfb75391935310368065096fa08c51e8970bc43e/sprites/pokemon/" +
  "versions/generation-vii/ultra-sun-ultra-moon/133.gif";

/*  UNE FICHE ÉCRITE. Assez remplie pour que chaque bloc ait quelque
    chose à montrer, pas assez pour qu'on lise un roman. */
const REMPLIE = {
  ...ficheVide(),
  nom: "Erin Kavanagh",
  sousTitre: "elle court encore",
  tw: "incendie, brûlures, deuil",
  avatar: "",
  identite: {
    ...ficheVide().identite,
    surnom: "Rin",
    pronoms: "elle/she/her",
    naissance: "4 juin 2001 (25 ans)",
    origine: "Port-Amarée, Rhode",
    orientation: "Bisexuelle",
    statut: "Célibataire",
    metier: "Infirmière de nuit",
    allegeance: "aucune",
    traits:
      "Calme sous la pression, insupportable au réveil. Elle dit oui trop vite et le regrette lentement.",
  },
  histoire: {
    mode: "pave",
    texte:
      "L'hôpital a brûlé un mardi. Elle a porté dehors onze personnes et n'a jamais su dire combien de fois elle est rentrée.",
  },
  starter: {
    especeId: 133,
    espece: "Évoli",
    surnom: "Noisette",
    talent: "Échauffement",
    rencontre: "Dans une grange, un soir de pluie, pendant qu'elle se cachait de son père.",
  },
  ancienneEquipe: "Un Caninos, laissé chez sa mère.",
  joueur: {
    ...ficheVide().joueur,
    "j-pseudo": "Callista",
    "j-age": "25",
    "j-avatar": "Florence Pugh",
    "j-credit-avatar": "@quelquun",
    "j-credits": "codage maison",
  },
};

function page(fiche, large) {
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400..700;1,9..144,400&family=Nunito+Sans:wght@400;600;700&family=Cormorant+Garamond:ital,wght@0,400;1,400&display=swap">
<style>${CSS}
  body { margin: 0; background: var(--wm-fond-page, #eecfb5); padding: ${large ? 40 : 8}px }
  .faux-message {
    box-sizing: border-box; margin: 0 auto;
    ${large ? `width: ${LARGEUR_MESSAGE}px` : "width: 100%"};
    padding: 24px; border-radius: 10px;
    background: var(--wm-fond-surface, #fffbf7);
  }
</style></head>
<body id="modernbb"><div class="faux-message">${
    publier(fiche, { sprite: SPRITE })
  }</div></body></html>`;
}

const nav = await ouvrirChromium(chromium);
const CAS = [
  ["remplie", REMPLIE, true],
  ["vide", ficheVide(), true],
  ["remplie-mobile", REMPLIE, false],
  ["vide-mobile", ficheVide(), false],
];

for (const [nom, fiche, large] of CAS) {
  const p = await nav.newPage({
    viewport: large ? { width: 900, height: 1200 } : { width: 390, height: 844 },
    deviceScaleFactor: 2,
  });
  await p.setContent(page(fiche, large), { waitUntil: "load" });
  //  LES POLICES ARRIVENT DU RÉSEAU : sans cette attente, l'aperçu
  //  montre la police de secours et toutes les hauteurs sont fausses.
  await p.evaluate(() => document.fonts.ready);
  const chemin = `${R}apercu-fiche-${nom}.png`;
  await p.screenshot({ path: chemin, fullPage: true });
  const taille = (await Deno.stat(chemin)).size;
  console.log(`  apercu-fiche-${nom}.png — ${Math.round(taille / 1024)} Ko`);
  await p.close();
}
await nav.close();

console.log(
  "\n  Les réglages sont en haut de css/32-la-fiche-de-presentation.css.\n" +
    "  Après un changement : bash outils/css.sh, puis deno task fiche.",
);
