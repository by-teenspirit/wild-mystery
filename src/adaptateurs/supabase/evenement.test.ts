// ════════════════════════════════════════════════════════════════════
//  src/adaptateurs/supabase/evenement.test.ts
//
//  Le trajet aller-retour, pour les six variantes. Si une clé se perd,
//  ce n'est pas une erreur bruyante : c'est une capture qui disparaît.
//  D'où le test exhaustif plutôt qu'un échantillon.
// ════════════════════════════════════════════════════════════════════

import { assertEquals, assertThrows } from "@std/assert";
import type { Evenement } from "../../domaine/cloture.ts";
import { depuisColonnes, LigneIllisible, versColonnes } from "./evenement.ts";

/** Les six variantes, écrites à la main. Le test échoue si le domaine en
 *  gagne une sans que ce tableau la suive. */
const TOUTES: readonly Evenement[] = [
  { type: "croise", especeId: 215 },
  { type: "capture", especeId: 220, niveau: 17 },
  { type: "xp", pokemonId: "galopa", gain: 180 },
  { type: "objet_utilise", objetId: 1, quantite: 2 },
  { type: "objet_trouve", objetId: 2, quantite: 1 },
  { type: "pokedollars", montant: -350 },
];

Deno.test("le tableau des variantes couvre bien l'union du domaine", () => {
  const vues = new Set(TOUTES.map((e) => e.type));
  // Un type ajouté au domaine fait échouer versColonnes à la compilation,
  // mais rien n'obligerait à l'ajouter ICI : cette assertion s'en charge.
  assertEquals(vues.size, 6);
  assertEquals(TOUTES.length, 6, "une variante en double dans le tableau");
});

Deno.test("aller-retour · chaque variante revient identique", () => {
  for (const original of TOUTES) {
    const { type, charge } = versColonnes(original);
    assertEquals(depuisColonnes(type, charge), original, `variante ${original.type}`);
  }
});

Deno.test("aller-retour · la charge passe par JSON sans s'abîmer", () => {
  // Le vrai trajet passe par jsonb : on le refait pour de bon.
  for (const original of TOUTES) {
    const { type, charge } = versColonnes(original);
    const apresJson = JSON.parse(JSON.stringify(charge));
    assertEquals(depuisColonnes(type, apresJson), original, `variante ${original.type}`);
  }
});

Deno.test("versColonnes · la charge ne contient QUE ce qui sert", () => {
  // Pas de `type` dupliqué dans la charge : la colonne le porte déjà.
  for (const e of TOUTES) {
    const { charge } = versColonnes(e);
    assertEquals(Object.hasOwn(charge, "type"), false, `variante ${e.type}`);
  }
  assertEquals(versColonnes({ type: "croise", especeId: 7 }).charge, { especeId: 7 });
});

Deno.test("un montant négatif n'est pas confondu avec une absence", () => {
  const { type, charge } = versColonnes({ type: "pokedollars", montant: -1 });
  assertEquals(depuisColonnes(type, charge), { type: "pokedollars", montant: -1 });
  // Et zéro non plus : c'est un nombre, pas un vide.
  assertEquals(depuisColonnes("pokedollars", { montant: 0 }), {
    type: "pokedollars",
    montant: 0,
  });
});

Deno.test("depuisColonnes · un type inconnu lève", () => {
  assertThrows(() => depuisColonnes("evolution", { especeId: 1 }), LigneIllisible);
});

Deno.test("depuisColonnes · une charge amputée lève au lieu de verser du vide", () => {
  assertThrows(() => depuisColonnes("capture", { especeId: 215 }), LigneIllisible);
  assertThrows(() => depuisColonnes("xp", { gain: 10 }), LigneIllisible);
  assertThrows(() => depuisColonnes("objet_trouve", { objetId: 1 }), LigneIllisible);
  assertThrows(() => depuisColonnes("pokedollars", {}), LigneIllisible);
});

Deno.test("depuisColonnes · un nombre arrivé en texte lève", () => {
  // jsonb garde les types, mais une migration bâclée peut tout passer en
  // texte. Mieux vaut le voir que de verser « NaN » d'expérience.
  assertThrows(() => depuisColonnes("croise", { especeId: "215" }), LigneIllisible);
  assertThrows(
    () => depuisColonnes("xp", { pokemonId: "galopa", gain: "180" }),
    LigneIllisible,
  );
});

Deno.test("depuisColonnes · un pokemonId vide lève", () => {
  assertThrows(() => depuisColonnes("xp", { pokemonId: "", gain: 180 }), LigneIllisible);
});

Deno.test("depuisColonnes · une charge qui n'est pas un objet lève", () => {
  for (const mauvaise of [null, [], "croise", 42]) {
    assertThrows(() => depuisColonnes("croise", mauvaise), LigneIllisible);
  }
});

Deno.test("le message d'erreur nomme le type et la charge", () => {
  const e = assertThrows(() => depuisColonnes("capture", { especeId: 215 }), LigneIllisible);
  assertEquals(e.message.includes("capture"), true, e.message);
  assertEquals(e.message.includes("215"), true, e.message);
});
