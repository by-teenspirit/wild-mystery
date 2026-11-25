// ════════════════════════════════════════════════════════════════════
//  outils/arbre.mjs — l'arbre de compétences, dans un vrai navigateur.
//
//  COUVRE : outils/arbre.py · css/33-arbre.css · data/arbre.json
//
//      deno run -A outils/arbre.mjs
//      deno run -A outils/arbre.mjs --photo   rend arbre-<thème>.png
//
//  ── CE QU'IL REGARDE, ET QU'AUCUN TEST SANS NAVIGATEUR NE VERRAIT ──
//
//    · SANS LE SCRIPT, les soixante-seize cases sont là et lisibles.
//      Le contenu de la page EST l'arbre ; une page qui dessinerait
//      ses cases en script serait blanche ;
//    · UNE CHAÎNE AVANCE EN COLONNES et une case libre n'en a pas.
//      C'est la faute du premier rendu : les sept règles de colonne,
//      écrites sans leur parent, rangeaient AUSSI les cases libres —
//      dix-huit médailles de type en une colonne, et trois quarts de
//      page vides à côté. Mesuré, pas relu ;
//    · LE FILET DE LIAISON EST À GAUCHE D'UNE CASE QUI ATTEND, et
//      nulle part ailleurs. Posé sur toutes, il désignerait le vide ;
//    · LA GRILLE DÉFILE, PAS LA PAGE. Sept colonnes ne tiennent pas
//      dans un forum de 760, et élargir la page pour une famille
//      casserait les autres ;
//    · À 390, une seule colonne et plus aucun filet ;
//    · RIEN NE SE DISTINGUE PAR LA SEULE COULEUR : l'acquis prend un
//      fond ET un mot, le verrouillé perd du contraste ET se dit.
// ════════════════════════════════════════════════════════════════════

import { readFileSync } from "node:fs";
import { chromium } from "npm:playwright@1.56.0";
import { ouvrirChromium } from "./chromium.mjs";

const R = new URL("..", import.meta.url).pathname;
const lire = (c) => readFileSync(R + c, "utf8");

let fautes = 0;
const dire = (quoi, bon, detail = "") => {
  if (!bon) fautes += 1;
  const marque = bon ? "  ok  " : "  ÉCHEC";
  console.log(`${marque} ${quoi}${detail === "" ? "" : ` — ${detail}`}`);
};

//  LA PAGE EST SERVIE AVEC LA VRAIE FEUILLE, celle que `css.sh`
//  assemble. Monter la page avec les feuilles séparées mesurerait un
//  ordre de cascade que le forum ne sert jamais.
const page = lire("pages/arbre-des-competences.html")
  .replace(
    /<link rel="stylesheet" href="[^"]*jetons\.css"[^>]*>/,
    `<style>${lire("panneau-admin/jetons.css")}</style>`,
  )
  .replace(
    /<link rel="stylesheet" href="[^"]*wild-mystery\.css"[^>]*>/,
    `<style>${lire("css/wild-mystery.css")}</style>`,
  )
  .replace(/<script src="[^"]*"><\/script>/, "");

const donnees = JSON.parse(lire("data/arbre.json"));
const attendues = donnees.familles.reduce((n, f) => n + f.noeuds.length, 0) +
  donnees.branches.reduce((n, b) => n + b.noeuds.length, 0);

const nav = await ouvrirChromium(chromium);
const onglet = await nav.newPage({ viewport: { width: 980, height: 1000 } });
await onglet.setContent(page, { waitUntil: "load" });

console.log("\n── la page sans script ──");

const vu = await onglet.evaluate(() => {
  const cases = [...document.querySelectorAll(".wm-arbre__case")];
  const visible = (e) => {
    const r = e.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  };
  return {
    cases: cases.length,
    visibles: cases.filter(visible).length,
    blocs: document.querySelectorAll(".wm-arbre__bloc").length,
    branches: document.querySelectorAll(".wm-arbre__bloc--branche").length,
    sansTitre: cases.filter((c) =>
      (c.querySelector(".wm-arbre__nom")?.textContent ?? "").trim() === ""
    )
      .length,
  };
});

dire("les cases sont toutes dans la page", vu.cases === attendues, `${vu.cases}/${attendues}`);
dire("et toutes visibles sans script", vu.visibles === attendues, `${vu.visibles}`);
dire("chaque case porte un titre", vu.sansTitre === 0, `${vu.sansTitre} sans titre`);
dire(
  "les six branches ont leur bloc",
  vu.branches === donnees.branches.length,
  `${vu.branches}`,
);

console.log("\n── les chaînes et les cases libres ──");

const grilles = await onglet.evaluate(() => {
  const gauche = (e) => Math.round(e.getBoundingClientRect().left);
  const chaine = document.querySelector(".wm-arbre__cases");
  const libres = document.querySelector(".wm-arbre__libres");
  const colonnes = (ul) => {
    if (ul === null) return 0;
    const xs = new Set([...ul.children].map(gauche));
    return xs.size;
  };
  const avecFilet = [...document.querySelectorAll(".wm-arbre__case")].filter(
    (c) => {
      //  UN FILET SE DESSINE QUAND IL A UN CONTENU **ET** QU'IL EST
      //  AFFICHÉ. Lire `content` seul comptait les vingt-cinq filets
      //  d'une page mobile qui n'en montre aucun ; lire `display`
      //  seul comptait les cinquante et une cases dont le ::before
      //  n'existe pas. Les deux ensemble disent ce qu'on voit.
      const s = getComputedStyle(c, "::before");
      return s.content !== "none" && s.display !== "none";
    },
  );
  const attendent = [...document.querySelectorAll(".wm-arbre__case[data-wm-apres]")];
  return {
    colonnesDeLaChaine: colonnes(chaine),
    colonnesDesLibres: colonnes(libres),
    filets: avecFilet.length,
    attendent: attendent.length,
    chaineDeborde: chaine === null ? false : chaine.scrollWidth > chaine.clientWidth,
    pageDeborde: document.documentElement.scrollWidth > document.documentElement.clientWidth,
  };
});

dire(
  "une chaîne avance en colonnes",
  grilles.colonnesDeLaChaine >= 4,
  `${grilles.colonnesDeLaChaine} colonne(s)`,
);
dire(
  "   et les cases libres se rangent sur plusieurs colonnes aussi",
  grilles.colonnesDesLibres >= 3,
  `${grilles.colonnesDesLibres} colonne(s)`,
);
dire(
  "le filet ne touche que les cases qui attendent",
  grilles.filets === grilles.attendent,
  `${grilles.filets} filet(s) pour ${grilles.attendent} case(s) qui attendent`,
);
dire("c'est la grille qui déborde, pas la page", !grilles.pageDeborde);

console.log("\n── les états, posés à la main ──");

const etats = await onglet.evaluate(() => {
  const c = document.querySelector('.wm-arbre__case[data-wm-case="capture-5"]');
  const lu = () => {
    const s = getComputedStyle(c);
    return {
      fond: s.backgroundColor,
      bordure: s.borderTopColor,
      apres: getComputedStyle(c.querySelector(".wm-arbre__genre"), "::after").content,
    };
  };
  const neutre = lu();
  c.setAttribute("data-wm-etat", "acquis");
  const acquis = lu();
  c.setAttribute("data-wm-etat", "verrouille");
  const verrouille = {
    ...lu(),
    couleur: getComputedStyle(c.querySelector(".wm-arbre__nom")).color,
  };
  c.removeAttribute("data-wm-etat");
  const sansEtat = {
    couleur: getComputedStyle(c.querySelector(".wm-arbre__nom")).color,
  };
  return { neutre, acquis, verrouille, sansEtat };
});

dire(
  "acquis change le fond ET ajoute un mot",
  etats.acquis.fond !== etats.neutre.fond && etats.acquis.apres.includes("acquis"),
  JSON.stringify(etats.acquis),
);
dire(
  "verrouillé baisse le contraste du titre",
  etats.verrouille.couleur !== etats.sansEtat.couleur,
  `${etats.verrouille.couleur} contre ${etats.sansEtat.couleur}`,
);
dire(
  "sans état posé, une case reste lisible comme les autres",
  etats.neutre.apres === "none",
  etats.neutre.apres,
);

console.log("\n── à 390 px ──");

await onglet.setViewportSize({ width: 390, height: 900 });
const petit = await onglet.evaluate(() => {
  const chaine = document.querySelector(".wm-arbre__cases");
  const xs = new Set(
    [...chaine.children].map((e) => Math.round(e.getBoundingClientRect().left)),
  );
  return {
    colonnes: xs.size,
    //  C'EST `display` QU'ON MESURE, PAS `content`. La règle mobile
    //  cache le filet avec `display: none` ; son `content` reste là,
    //  et un contrôle qui le lisait aurait annoncé vingt-cinq filets
    //  sur une page qui n'en montre aucun.
    filets: [...document.querySelectorAll(".wm-arbre__case")].filter(
      (c) => {
        //  UN FILET SE DESSINE QUAND IL A UN CONTENU **ET** QU'IL EST
        //  AFFICHÉ. Lire `content` seul comptait les vingt-cinq filets
        //  d'une page mobile qui n'en montre aucun ; lire `display`
        //  seul comptait les cinquante et une cases dont le ::before
        //  n'existe pas. Les deux ensemble disent ce qu'on voit.
        const s = getComputedStyle(c, "::before");
        return s.content !== "none" && s.display !== "none";
      },
    ).length,
    deborde: document.documentElement.scrollWidth > document.documentElement.clientWidth,
  };
});

dire("une seule colonne", petit.colonnes === 1, `${petit.colonnes}`);
dire("plus aucun filet", petit.filets === 0, `${petit.filets}`);
dire("rien ne déborde", !petit.deborde);

if (Deno.args.includes("--photo")) {
  for (const [nom, sombre] of [["clair", false], ["sombre", true]]) {
    await onglet.setViewportSize({ width: 1100, height: 1400 });
    await onglet.emulateMedia({ colorScheme: sombre ? "dark" : "light" });
    await onglet.screenshot({ path: `arbre-${nom}.png`, fullPage: true });
    console.log(`  arbre-${nom}.png`);
  }
}

await nav.close();

console.log(fautes === 0 ? "\nTOUT PASSE." : `\n${fautes} ÉCHEC(S).`);
if (fautes > 0) Deno.exit(1);
