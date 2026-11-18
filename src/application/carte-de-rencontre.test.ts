// ════════════════════════════════════════════════════════════════════
//  src/application/carte-de-rencontre.test.ts
//
//  Ce que ces tests protègent.
//
//  **Que les chiffres de la carte soient ceux de la base.** La carte
//  ne recalcule rien : elle recopie. Un test qui vérifie une
//  multiplication ici serait un test qui autorise la carte à faire ce
//  calcul — et le jour où la base change de formule, le sujet
//  annoncerait un combat qui n'est pas celui qui se joue.
//
//  **Que l'équipe vide se dise.** Planche 99 §5.3 : la rencontre reste
//  une rencontre. Un message qui s'arrêterait aux stats du sauvage
//  laisserait le joueur attendre un tour qui ne viendra jamais.
//
//  **Que le code soit lisible.** Même raison que dans le bilan : un
//  joueur qui conteste doit pouvoir le recopier.
// ════════════════════════════════════════════════════════════════════

import { assert, assertEquals, assertStringIncludes } from "@std/assert";
import {
  nomDuCombattant,
  redigerLaCarte,
  type RencontreAAnnoncer,
  SANS_COMBATTANT,
  typesLisibles,
} from "./carte-de-rencontre.ts";

const PONYTA: RencontreAAnnoncer = {
  combatId: "11111111-1111-1111-1111-111111111111",
  sujetId: 996,
  messageId: 15601,
  essais: 0,
  mentionne: "Jake Dalziel",
  sauvage: {
    nom: "Ponyta",
    niveau: 10,
    types: ["feu"],
    pv: 30,
    attaque: 22,
    defense: 16,
  },
  combattant: {
    nom: "Salamèche",
    surnom: null,
    niveau: 5,
    types: ["feu"],
    pv: 18,
    pvMax: 18,
    attaque: 10,
    defense: 9,
  },
};

Deno.test("la carte annonce le sauvage avant tout le reste", () => {
  const texte = redigerLaCarte(PONYTA, "WM-ABC123");
  const lignes = texte.split("\n");
  assertEquals(lignes[0], "Un Ponyta sauvage apparaît.");
  //  Le sauvage est l'information neuve : elle vient avant le
  //  combattant, qu'on connaît déjà.
  assert(
    texte.indexOf("PONYTA") < texte.indexOf("SALAMÈCHE"),
    "le sauvage doit passer avant le combattant",
  );
});

Deno.test("les chiffres sont recopiés, pas recalculés", () => {
  //  On donne des PV qui ne correspondent à AUCUNE formule — 30 pour
  //  un Ponyta niveau 10 en vaut 30, mais 777 ne vaut rien. La carte
  //  doit écrire 777.
  const texte = redigerLaCarte(
    { ...PONYTA, sauvage: { ...PONYTA.sauvage, pv: 777 } },
    "WM-ABC123",
  );
  assertStringIncludes(texte, "PV : 777");
});

Deno.test("les PV du joueur se lisent sur leur maximum", () => {
  //  Son Pokémon peut sortir d'un combat précédent, et ça change ce
  //  qu'on décide au premier tour.
  const texte = redigerLaCarte(
    {
      ...PONYTA,
      combattant: { ...PONYTA.combattant!, pv: 7, pvMax: 18 },
    },
    "WM-ABC123",
  );
  assertStringIncludes(texte, "PV : 7/18");
  //  Le sauvage, lui, arrive entier : pas de fraction de son côté.
  assertStringIncludes(texte, "PV : 30\n");
});

Deno.test("les types reprennent leur majuscule", () => {
  //  La base les range à plat et sans accent pour que les jointures
  //  tiennent. Le joueur n'a pas à lire notre convention de clé.
  assertEquals(typesLisibles(["feu"]), "Feu");
  assertEquals(typesLisibles(["eau", "plante"]), "Eau · Plante");
  assertEquals(typesLisibles(["electrik"]), "Electrik");
});

Deno.test("le surnom ne fait pas disparaître l'espèce", () => {
  //  Le joueur doit pouvoir lire l'affiche des types, et « Biscotte »
  //  ne dit pas de quel type elle est.
  assertEquals(nomDuCombattant("Salamèche", "Biscotte"), "Biscotte (Salamèche)");
  assertEquals(nomDuCombattant("Salamèche", null), "Salamèche");
  //  Un surnom qui n'est que des espaces n'est pas un surnom.
  assertEquals(nomDuCombattant("Salamèche", "   "), "Salamèche");
});

Deno.test("une équipe vide est dite, pas tue", () => {
  const texte = redigerLaCarte({ ...PONYTA, combattant: null }, "WM-ABC123");
  assertStringIncludes(texte, SANS_COMBATTANT);
  //  Et on ne propose pas d'attaquer avec un Pokémon qu'on n'a pas.
  assert(!texte.includes("À toi de jouer"), "aucun tour à jouer sans Pokémon");
});

Deno.test("les cinq choix du combat sont nommés", () => {
  //  La planche 99 §4 les liste ; la barre les servira. Les écrire
  //  dans la carte, c'est ce qui rend le premier combat jouable sans
  //  avoir lu l'annexe.
  const texte = redigerLaCarte(PONYTA, "WM-ABC123");
  for (const choix of ["attaquer", "Poké Ball", "objet", "changer", "fuir"]) {
    assertStringIncludes(texte, choix);
  }
});

Deno.test("le code est en toutes lettres, en dernier", () => {
  const texte = redigerLaCarte(PONYTA, "WM-ABC123");
  const lignes = texte.split("\n");
  assertEquals(lignes[lignes.length - 1], "CODE : WM-ABC123");
});

Deno.test("la carte entière, telle qu'un joueur la lit", () => {
  //  UN TEST QUI SE LIT COMME LE MESSAGE. Les assertions au-dessus
  //  vérifient chacune une règle ; celle-ci vérifie que l'ensemble
  //  tient debout — c'est la seule qui dirait si l'ordre des lignes
  //  devenait absurde.
  assertEquals(
    redigerLaCarte(PONYTA, "WM-ABC123"),
    [
      "Un Ponyta sauvage apparaît.",
      "",
      "PONYTA — niveau 10",
      "Types : Feu",
      "PV : 30",
      "Attaque : 22 · Défense : 16",
      "",
      "SALAMÈCHE — niveau 5",
      "Types : Feu",
      "PV : 18/18",
      "Attaque : 10 · Défense : 9",
      "",
      "À toi de jouer : attaquer, lancer une Poké Ball, utiliser un " +
      "objet, changer de Pokémon ou fuir.",
      "",
      "CODE : WM-ABC123",
    ].join("\n"),
  );
});
