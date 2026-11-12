// ════════════════════════════════════════════════════════════════════
//  src/navigateur/repertoire.test.ts
//
//  CE QU'ON ÉPROUVE ICI : les écarts, et eux seuls. Qu'un menu listant
//  deux valeurs en liste bien deux n'apprend rien ; ce qui coûte, c'est
//  le filtre qui ment — un choix qui ne retient personne, un accent qui
//  fait rater une recherche, un menu qui propose une valeur qu'aucune
//  carte ne porte.
// ════════════════════════════════════════════════════════════════════

import { assertEquals } from "@std/assert";
import {
  compte,
  type Fiche,
  filtrer,
  menusAProposer,
  retenue,
  SANS_FILTRE,
  valeur,
} from "./repertoire.ts";

function fiche(
  groupe: string,
  lieu: string,
  origine: string,
  cherche: string,
): Fiche {
  return { groupe, lieu, origine, cherche };
}

const GENS: readonly Fiche[] = [
  fiche("Hardi", "Lumirandé", "Rhode", "Ana Vasquez Fleuriste douce Lumirandé Rhode"),
  fiche("Hardi", "Port-Varène", "Kanto", "Bo Ferrand Pêcheur bourru Port-Varène Kanto"),
  fiche("Doux", "Lumirandé", "Rhode", "Cy Nakamura Steven Yeun Lumirandé Rhode"),
];

// ── les menus ───────────────────────────────────────────────────────

Deno.test("les menus viennent des cartes, et pas d'une liste écrite", () => {
  const m = menusAProposer(GENS);
  assertEquals(m.map((x) => x.colonne), ["groupe", "lieu", "origine"]);
  //  Rangés alphabétiquement, en français : « Doux » avant « Hardi ».
  assertEquals(m[0].choix, ["Doux", "Hardi"]);
  assertEquals(m[1].choix, ["Lumirandé", "Port-Varène"]);
  assertEquals(m[2].choix, ["Kanto", "Rhode"]);
});

Deno.test("une colonne où tout le monde répond pareil n'a pas de menu", () => {
  //  Un menu à un seul choix ne filtre rien : il ne s'affiche pas, et
  //  il reviendra le jour où quelqu'un déménagera.
  const memeLieu = [
    fiche("Hardi", "Lumirandé", "Rhode", "Ana"),
    fiche("Doux", "Lumirandé", "Rhode", "Bo"),
  ];
  assertEquals(menusAProposer(memeLieu).map((m) => m.colonne), ["groupe"]);
  assertEquals(menusAProposer([]).length, 0);
});

Deno.test("une valeur vide ne se retrouve pas dans un menu", () => {
  //  Un répertoire se remplit peu à peu : une carte sans lieu de vie
  //  ne doit pas poser un choix vide, qu'on cliquerait sans savoir ce
  //  qu'il retient.
  const incomplets = [
    fiche("Hardi", "", "Rhode", "Ana"),
    fiche("Doux", "Lumirandé", "Rhode", "Bo"),
    fiche("Doux", "Port-Varène", "Rhode", "Cy"),
  ];
  assertEquals(menusAProposer(incomplets)[1].choix, ["Lumirandé", "Port-Varène"]);
});

Deno.test("un menu ne propose que des valeurs qu'une carte porte vraiment", () => {
  //  Si `valeur` et les menus divergeaient, un choix du menu ne
  //  retiendrait personne : le défaut ne se verrait qu'au clic.
  for (const m of menusAProposer(GENS)) {
    for (const c of m.choix) {
      assertEquals(
        GENS.some((f) => valeur(f, m.colonne) === c),
        true,
        `${m.colonne} · ${c}`,
      );
    }
  }
});

// ── le filtrage ─────────────────────────────────────────────────────

Deno.test("sans filtre, tout le monde est là", () => {
  assertEquals(filtrer(GENS, SANS_FILTRE), [true, true, true]);
});

Deno.test("un menu choisi ne garde que sa valeur, et deux menus se cumulent", () => {
  assertEquals(
    filtrer(GENS, { recherche: "", menus: new Map([["groupe", "Hardi"]]) }),
    [true, true, false],
  );
  assertEquals(
    filtrer(GENS, {
      recherche: "",
      menus: new Map([["groupe", "Hardi"], ["lieu", "Lumirandé"]]),
    }),
    [true, false, false],
  );
});

Deno.test("une valeur vide dans un menu veut dire « tous »", () => {
  //  C'est l'option « Tous » du `select`, et elle doit rendre la page
  //  entière — pas la vider parce qu'aucune carte n'a un groupe vide.
  assertEquals(
    filtrer(GENS, { recherche: "", menus: new Map([["groupe", ""]]) }),
    [true, true, true],
  );
});

Deno.test("la recherche ignore les accents et la casse", () => {
  //  « lumirande » doit trouver « Lumirandé » : personne ne tape les
  //  accents dans un champ de recherche.
  assertEquals(
    filtrer(GENS, { ...SANS_FILTRE, recherche: "LUMIRANDE" }),
    [true, false, true],
  );
});

Deno.test("la recherche veut TOUS les mots, pas n'importe lequel", () => {
  //  « ana fleur » trouve la fleuriste qui s'appelle Ana, et pas tous
  //  les fleuristes ni toutes les Ana.
  assertEquals(
    filtrer(GENS, { ...SANS_FILTRE, recherche: "ana fleur" }),
    [true, false, false],
  );
  assertEquals(
    filtrer(GENS, { ...SANS_FILTRE, recherche: "ana pecheur" }),
    [false, false, false],
  );
});

Deno.test("la recherche trouve aussi par faceclaim", () => {
  //  C'est ce que le bottin ne dit pas, et c'est une question qu'on
  //  pose souvent : qui joue avec cet avatar ?
  assertEquals(
    filtrer(GENS, { ...SANS_FILTRE, recherche: "yeun" }),
    [false, false, true],
  );
});

Deno.test("des espaces seuls ne filtrent rien", () => {
  //  Un champ vidé à coups de barre d'espace laissait une recherche
  //  d'un mot vide, que `includes` trouve partout — vrai ici, mais
  //  faux le jour où on comparerait autrement.
  assertEquals(retenue(GENS[0], { ...SANS_FILTRE, recherche: "   " }), true);
});

// ── le compte ───────────────────────────────────────────────────────

Deno.test("le compte se lit, singulier compris", () => {
  assertEquals(compte(12, 12), "12 personnages");
  assertEquals(compte(1, 12), "1 personnage sur 12");
  assertEquals(compte(3, 12), "3 personnages sur 12");
  //  Filtrer et ne rien voir doit se distinguer d'une page qui n'a
  //  pas compris la demande.
  assertEquals(compte(0, 12), "Aucun personnage ne correspond");
});
