// ════════════════════════════════════════════════════════════════════
//  Ce que ces tests protègent.
//
//  **Qu'une entrée bancale n'emporte pas le sommaire.** Douze pages le
//  portent : s'il tombait, ce sont douze pages qui perdent leur
//  navigation d'un coup.
//
//  **Qu'une page pas encore créée ne devienne jamais un lien.** Neuf des
//  douze n'existent pas. Un lien mort dans un sommaire est la première
//  chose qu'un visiteur clique.
//
//  **Que l'adresse soit lue par son SLUG, pas par son numéro.** `h20`
//  dépend de l'ordre de création des pages chez Forumactif ; le slug est
//  celui qu'on a choisi. Déplacer une annexe ne doit pas décrocher le
//  surlignage.
// ════════════════════════════════════════════════════════════════════

import { assertEquals } from "@std/assert";
import {
  slugDepuisAdresse,
  type Sommaire,
  sommaireAffiche,
  sommaireDepuis,
} from "./annexes.ts";

const DEUX_SECTIONS = {
  sections: [
    {
      titre: "Les annexes",
      entrees: [
        { numero: "01", slug: "par-ou-commencer", titre: "Par où commencer", adresse: null },
        {
          numero: "03",
          slug: "le-reglement",
          titre: "Le règlement",
          adresse: "/h20-le-reglement",
        },
      ],
    },
    {
      titre: "Les pages de la région",
      entrees: [
        { numero: "11", slug: "la-pension", titre: "La pension", adresse: null },
      ],
    },
  ],
  pied: {
    titre: "Pour aller plus loin",
    liens: [{ titre: "La boutique", adresse: "/t977-x" }],
  },
};

// ── la lecture ──────────────────────────────────────────────────────

Deno.test("un sommaire complet se lit entier", () => {
  const s = sommaireDepuis(DEUX_SECTIONS);
  assertEquals(s.sections.length, 2);
  assertEquals(s.sections[0].titre, "Les annexes");
  assertEquals(s.sections[0].entrees.map((e) => e.titre), [
    "Par où commencer",
    "Le règlement",
  ]);
  assertEquals(s.sections[0].entrees[0].adresse, null);
  assertEquals(s.sections[0].entrees[1].adresse, "/h20-le-reglement");
});

Deno.test("un fichier illisible rend un sommaire vide, il ne lève pas", () => {
  //  Sans sommaire, la page reste lisible : c'est du texte dans une
  //  colonne. Une exception emporterait le thème avec elle.
  for (const brut of [null, undefined, 3, "non", [], {}, { sections: "deux" }]) {
    const s = sommaireDepuis(brut);
    assertEquals(s.sections.length, 0, JSON.stringify(brut ?? null));
  }
});

Deno.test("UNE ENTRÉE BANCALE N'EMPORTE PAS LE SOMMAIRE", () => {
  const s = sommaireDepuis({
    sections: [{
      titre: "Les annexes",
      entrees: [
        { numero: "01", slug: "bon", titre: "Bon", adresse: null },
        { numero: "02", slug: "", titre: "Sans slug", adresse: null },
        { numero: "03", slug: "sans-titre", titre: "", adresse: null },
        { numero: "04", slug: "blanc", titre: "   ", adresse: null },
        null,
        "une chaîne",
        { numero: "05", slug: "autre", titre: "Autre", adresse: null },
      ],
    }],
  });
  assertEquals(s.sections[0].entrees.map((e) => e.titre), ["Bon", "Autre"]);
});

Deno.test("une section sans entrée lisible disparaît", () => {
  //  Un intertitre orphelin au milieu du sommaire ne dit rien.
  const s = sommaireDepuis({
    sections: [
      { titre: "Vide", entrees: [] },
      { titre: "Tordue", entrees: [{ titre: "sans slug" }] },
      { titre: "Bonne", entrees: [{ slug: "x", titre: "X" }] },
    ],
  });
  assertEquals(s.sections.map((x) => x.titre), ["Bonne"]);
});

Deno.test("une adresse qui n'est pas interne au forum est refusée", () => {
  //  Un sommaire est exactement l'endroit où personne ne relirait un
  //  lien sortant.
  for (
    const mauvaise of [
      "https://ailleurs.example/x",
      "http://ailleurs.example",
      "//ailleurs.example",
      "javascript:alert(1)",
      "h20-le-reglement",
      "",
      "/avec espace",
      42,
      null,
    ]
  ) {
    const s = sommaireDepuis({
      sections: [{ titre: "x", entrees: [{ slug: "a", titre: "A", adresse: mauvaise }] }],
    });
    assertEquals(s.sections[0].entrees[0].adresse, null, JSON.stringify(mauvaise));
  }
  //  Et une adresse interne passe.
  const bonne = sommaireDepuis({
    sections: [{
      titre: "x",
      entrees: [{ slug: "a", titre: "A", adresse: "/h20-le-reglement" }],
    }],
  });
  assertEquals(bonne.sections[0].entrees[0].adresse, "/h20-le-reglement");
});

// ── la page courante ────────────────────────────────────────────────

Deno.test("le slug se lit dans l'adresse", () => {
  assertEquals(slugDepuisAdresse("/h20-le-reglement"), "le-reglement");
  assertEquals(slugDepuisAdresse("/h3-la-carte-et-les-zones"), "la-carte-et-les-zones");
  assertEquals(slugDepuisAdresse("/h20-le-reglement/"), "le-reglement");
});

Deno.test("une adresse qui n'est pas celle d'une page HTML rend null", () => {
  //  Forumactif sert la même page pour n'importe quel suffixe : `/h20-x`
  //  marche. Le sommaire n'y reconnaît rien, et il ne surligne pas au
  //  hasard.
  for (
    const chemin of [
      "",
      "/",
      "/h20",
      "/h20-",
      "/t977-boutique-de-rhode",
      "/f9-foret-marecageuse",
      "/hh20-le-reglement",
      "h20-le-reglement",
      "/h20-Le-Reglement",
    ]
  ) {
    assertEquals(slugDepuisAdresse(chemin), null, chemin);
  }
  //  `/h20-x` est une adresse valide de page HTML : le slug lu est `x`,
  //  et il ne correspond à aucune entrée — donc rien n'est surligné.
  assertEquals(slugDepuisAdresse("/h20-x"), "x");
});

// ── l'affichage ─────────────────────────────────────────────────────

Deno.test("l'entrée courante est marquée active, une seule", () => {
  const sections = sommaireAffiche(sommaireDepuis(DEUX_SECTIONS), "le-reglement");
  const actives = sections.flatMap((s) => s.entrees).filter((e) => e.active);
  assertEquals(actives.map((e) => e.titre), ["Le règlement"]);
});

Deno.test("un slug inconnu ne marque rien, et ne lève pas", () => {
  for (const slug of [null, "une-page-qui-n-existe-pas", "x"]) {
    const sections = sommaireAffiche(sommaireDepuis(DEUX_SECTIONS), slug);
    assertEquals(sections.flatMap((s) => s.entrees).filter((e) => e.active).length, 0);
  }
});

Deno.test("UNE PAGE PAS ENCORE CRÉÉE EST MARQUÉE « À VENIR »", () => {
  //  Le module s'en sert pour ne pas en faire un lien. Neuf des douze
  //  sont dans ce cas aujourd'hui.
  const sections = sommaireAffiche(sommaireDepuis(DEUX_SECTIONS), null);
  const toutes = sections.flatMap((s) => s.entrees);
  assertEquals(
    toutes.map((e) => `${e.titre} : ${e.aVenir ? "à venir" : "en ligne"}`),
    ["Par où commencer : à venir", "Le règlement : en ligne", "La pension : à venir"],
  );
});

Deno.test("un sommaire vide rend un affichage vide", () => {
  const vide: Sommaire = { sections: [] };
  assertEquals(sommaireAffiche(vide, "le-reglement").length, 0);
});
