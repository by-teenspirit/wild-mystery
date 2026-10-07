// ════════════════════════════════════════════════════════════════════
//  Ce que ces tests protègent.
//
//  **Qu'un réglage retenu revienne.** C'est tout l'intérêt : un joueur
//  qui recoche « grossir le texte » à chaque page ne le recochera pas
//  longtemps. L'aller-retour chaîne → réglages → chaîne doit être exact.
//
//  **Qu'un encart vide ne s'affiche pas.** « 0 message non lu » n'est pas
//  une notification, et un bloc flottant qui n'apprend rien coûte un coin
//  d'écran à tout le monde.
//
//  **Et que le pluriel soit juste.** « 1 messages » dans un coin d'écran
//  est le genre de détail qu'on ne corrige jamais.
// ════════════════════════════════════════════════════════════════════

import { assertEquals } from "@std/assert";
import {
  basculerConfort,
  type Confort,
  confortsDepuis,
  encartDepuis,
  phraseDeCompteur,
  texteDesConforts,
} from "./confort.ts";

// ── les réglages ────────────────────────────────────────────────────

Deno.test("UN RÉGLAGE RETENU REVIENT : l'aller-retour est exact", () => {
  const cas: readonly (readonly Confort[])[] = [
    [],
    ["animations"],
    ["texte"],
    ["animations", "liens"],
    ["animations", "texte", "liens"],
  ];
  for (const actifs of cas) {
    assertEquals(confortsDepuis(texteDesConforts(actifs)), actifs, JSON.stringify(actifs));
  }
});

Deno.test("une chaîne abîmée ne fait pas tout perdre", () => {
  //  Le pire cas acceptable est un réglage oublié, jamais une page
  //  cassée.
  assertEquals(confortsDepuis(" texte , inconnu ,, animations "), ["animations", "texte"]);
  assertEquals(confortsDepuis("texte,texte"), ["texte"]);
  for (const brut of ["", "rien", null, undefined, 3, [], {}]) {
    assertEquals(confortsDepuis(brut), [], JSON.stringify(brut ?? null));
  }
});

Deno.test("l'ordre des boutons ne dépend pas de l'ordre où on les a cochés", () => {
  assertEquals(confortsDepuis("liens,animations"), ["animations", "liens"]);
  assertEquals(texteDesConforts(["liens", "animations"]), "animations,liens");
});

Deno.test("basculer coche puis décoche, sans toucher aux autres", () => {
  let actifs: readonly Confort[] = [];
  actifs = basculerConfort(actifs, "texte");
  assertEquals(actifs, ["texte"]);
  actifs = basculerConfort(actifs, "animations");
  assertEquals(actifs, ["animations", "texte"]);
  actifs = basculerConfort(actifs, "texte");
  assertEquals(actifs, ["animations"]);
  actifs = basculerConfort(actifs, "animations");
  assertEquals(actifs, []);
});

// ── l'encart ────────────────────────────────────────────────────────

const RACCOURCIS = [
  { titre: "Nouveaux messages", adresse: "/search?search_id=newposts" },
  { titre: "Sujets sans réponse", adresse: "/search?search_id=unanswered" },
];

Deno.test("un encart sans compteur est VIDE, raccourcis compris", () => {
  //  Les raccourcis accompagnent une nouvelle, ils ne la remplacent pas.
  const e = encartDepuis([], RACCOURCIS);
  assertEquals(e.compteurs.length, 0);
  assertEquals(e.raccourcis.length, 0, "rien à annoncer : rien ne flotte");
});

Deno.test("UN COMPTEUR À ZÉRO N'EST PAS UNE NOTIFICATION", () => {
  const e = encartDepuis(
    [{ titre: "message non lu", pluriel: "messages non lus", nombre: 0, adresse: "/privmsg" }],
    RACCOURCIS,
  );
  assertEquals(e.compteurs.length, 0);
  assertEquals(e.raccourcis.length, 0);
});

Deno.test("un compteur illisible disparaît, les bons restent", () => {
  const e = encartDepuis([
    { titre: "message non lu", pluriel: "messages non lus", nombre: 3, adresse: "/privmsg" },
    { titre: "sans nombre", pluriel: "sans nombres", nombre: "trois", adresse: "/x" },
    { titre: "négatif", pluriel: "négatifs", nombre: -2, adresse: "/x" },
    { titre: "décimal", pluriel: "décimaux", nombre: 1.5, adresse: "/x" },
    { titre: "", pluriel: "vides", nombre: 4, adresse: "/x" },
    { titre: "sans pluriel", pluriel: "", nombre: 4, adresse: "/x" },
    { titre: "sortant", pluriel: "sortants", nombre: 4, adresse: "https://ailleurs.example" },
    {
      titre: "double barre",
      pluriel: "doubles barres",
      nombre: 4,
      adresse: "//ailleurs.example",
    },
  ], RACCOURCIS);
  assertEquals(e.compteurs.map((c) => c.titre), ["message non lu"]);
  assertEquals(e.raccourcis.length, 2, "un compteur suffit à faire exister l'encart");
});

Deno.test("un raccourci bancal ne passe pas", () => {
  const e = encartDepuis(
    [{ titre: "message non lu", pluriel: "messages non lus", nombre: 1, adresse: "/privmsg" }],
    [
      { titre: "Bon", adresse: "/search" },
      { titre: "", adresse: "/x" },
      { titre: "Sortant", adresse: "https://ailleurs.example" },
      { titre: "Sans adresse", adresse: null },
    ],
  );
  assertEquals(e.raccourcis.map((r) => r.titre), ["Bon"]);
});

Deno.test("LE PLURIEL EST JUSTE", () => {
  //  LE PIÈGE : « message non lu » + « s » donne « message non lus ».
  //  Un pluriel français porte DEUX accords, pas un `s` au bout de la
  //  phrase. Les deux formes sont donc données par l'appelant.
  const faire = (n: number): string =>
    phraseDeCompteur({
      titre: "message non lu",
      pluriel: "messages non lus",
      nombre: n,
      adresse: "/privmsg",
    });
  assertEquals(faire(1), "1 message non lu");
  assertEquals(faire(2), "2 messages non lus");
  assertEquals(faire(12), "12 messages non lus");
});
