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
  pageDeLAdresse,
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

Deno.test("l'entrée de la page qu'on lit n'est jamais « à venir »", () => {
  //  Relevé le 2 novembre : une page créée sur le forum mais dont
  //  l'adresse n'est pas encore reportée dans `annexes.json` cumulait
  //  le fond de l'entrée courante et la pâleur de l'entrée absente.
  //  Elle tombait à 3,47 de contraste, sur chacune des douze pages pas
  //  encore reportées. L'adresse dit si quelqu'un l'a notée ; elle ne
  //  dit pas si la page existe, et quand on la lit, la question est
  //  tranchée.
  const sections = sommaireAffiche(
    {
      sections: [{
        titre: "Les annexes",
        entrees: [
          { numero: "01", slug: "ici", titre: "Ici", adresse: null },
          { numero: "02", slug: "ailleurs", titre: "Ailleurs", adresse: null },
        ],
      }],
    },
    "ici",
  );
  const [ici, ailleurs] = sections[0].entrees;
  assertEquals([ici.active, ici.aVenir], [true, false]);
  assertEquals([ailleurs.active, ailleurs.aVenir], [false, true]);
});

// ── le surlignage se reconnaît au numéro ────────────────────────────

Deno.test("LE NUMÉRO DE PAGE SE LIT, CHEMIN OU ADRESSE ENTIÈRE", () => {
  //  `data/annexes.json` porte les deux formes selon l'époque où la
  //  ligne a été écrite.
  assertEquals(pageDeLAdresse("/h12-elever-ses-pokemon"), 12);
  assertEquals(pageDeLAdresse("https://exemple.test/h5-les-groupes"), 5);
  assertEquals(pageDeLAdresse("/h7-x/"), 7);
  assertEquals(pageDeLAdresse(null), null);
  assertEquals(pageDeLAdresse("/t1000-un-sujet"), null);
  assertEquals(pageDeLAdresse(""), null);
});

Deno.test("LE SOMMAIRE SE SURLIGNE AU NUMÉRO, PAS AU SLUG", () => {
  //  C'EST LE DÉFAUT DU 18 NOVEMBRE. Le bout d'adresse après le numéro
  //  vient du TITRE tapé dans le panneau : « Les groupes » donne
  //  `/h5-les-groupes` alors que notre clé est `groupes`. Onze pages
  //  sur quinze ne se reconnaissaient plus.
  const sommaire = sommaireDepuis({
    sections: [{
      titre: "Le monde",
      entrees: [
        { numero: "05", slug: "groupes", titre: "Les groupes", adresse: "/h5-les-groupes" },
        {
          numero: "13",
          slug: "arenes-colosseums-ligues",
          titre: "Arènes",
          adresse: "/h13-arenes-colosseums-ligue",
        },
      ],
    }],
  });
  const vu = sommaireAffiche(sommaire, slugDepuisAdresse("/h5-les-groupes"), 5);
  assertEquals(vu[0].entrees.map((e) => e.active), [true, false]);

  //  « ligue » contre « ligues » : un caractère, et le slug ne suffit
  //  plus. Le numéro, lui, ne se trompe pas.
  const treize = sommaireAffiche(
    sommaire,
    slugDepuisAdresse("/h13-arenes-colosseums-ligue"),
    13,
  );
  assertEquals(treize[0].entrees.map((e) => e.active), [false, true]);
});

Deno.test("UNE PAGE SANS ADRESSE NE VOLE PAS LE SURLIGNAGE", () => {
  //  Une annexe pas encore créée n'a pas d'adresse. Elle peut se
  //  reconnaître à son slug — mais seulement elle, et seulement quand
  //  aucune entrée numérotée ne correspond.
  const sommaire = sommaireDepuis({
    sections: [{
      titre: "Jouer",
      entrees: [
        { numero: "11", slug: "trouver-et-capturer", titre: "Trouver", adresse: null },
        { numero: "12", slug: "elever", titre: "Élever", adresse: "/h12-elever" },
      ],
    }],
  });
  //  On lit la page 12 : c'est elle qui est active, pas celle qui n'a
  //  pas d'adresse.
  assertEquals(
    sommaireAffiche(sommaire, "elever", 12)[0].entrees.map((e) => e.active),
    [false, true],
  );
  //  Et la page sans adresse se reconnaît quand même à son slug.
  assertEquals(
    sommaireAffiche(sommaire, "trouver-et-capturer", 99)[0].entrees.map((e) => e.active),
    [true, false],
  );
});

Deno.test("LE NUMÉRO TRANCHE CONTRE UN SLUG QUI DIRAIT L'INVERSE", () => {
  //  Le cas qui décide de la règle : deux entrées, et le slug de la
  //  SECONDE correspond à l'adresse lue alors que le numéro désigne la
  //  PREMIÈRE. Sans priorité claire, les deux seraient surlignées.
  const sommaire = sommaireDepuis({
    sections: [{
      titre: "x",
      entrees: [
        { numero: "05", slug: "groupes", titre: "Les groupes", adresse: "/h5-les-groupes" },
        { numero: "09", slug: "les-groupes", titre: "Un homonyme", adresse: "/h9-autre" },
      ],
    }],
  });
  assertEquals(
    sommaireAffiche(sommaire, "les-groupes", 5)[0].entrees.map((e) => e.active),
    [true, false],
  );
});
