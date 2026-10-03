// ════════════════════════════════════════════════════════════════════
//  src/domaine/cloture.test.ts
//
//  Le cas qui justifie tout ce fichier est « trouvé puis utilisé ».
//  S'il casse, le rejeu dans l'ordre a été remplacé par une somme,
//  et le jeu devient faux sans que personne ne s'en aperçoive.
// ════════════════════════════════════════════════════════════════════

import { assert, assertEquals } from "@std/assert";
import { type EtatDuJoueur, evaluerCloture, type LigneRegistre } from "./cloture.ts";

const POKE_BALL = 1;
const POTION = 2;

function etat(partiel: Partial<EtatDuJoueur> = {}): EtatDuJoueur {
  return {
    sac: new Map(),
    placesEnBoite: 30,
    pokedollars: 1000,
    ...partiel,
  };
}

function ligne(messageId: number, evenement: LigneRegistre["evenement"]): LigneRegistre {
  return { messageId, evenement };
}

// ── le cas qui compte ───────────────────────────────────────────────
Deno.test("une ball trouvée au message 3 peut être utilisée au message 7", () => {
  const v = evaluerCloture([
    ligne(3, { type: "objet_trouve", objetId: POKE_BALL, quantite: 1 }),
    ligne(7, { type: "objet_utilise", objetId: POKE_BALL, quantite: 1 }),
  ], etat({ sac: new Map() }));

  assert(v.possible, "la clôture devrait passer");
  assertEquals(v.effets.objetsConsommes.get(POKE_BALL), 1);
  assertEquals(v.effets.objetsAjoutes.get(POKE_BALL), 1);
});

Deno.test("la même ball utilisée AVANT d'être trouvée manque", () => {
  const v = evaluerCloture([
    ligne(3, { type: "objet_utilise", objetId: POKE_BALL, quantite: 1 }),
    ligne(7, { type: "objet_trouve", objetId: POKE_BALL, quantite: 1 }),
  ], etat({ sac: new Map() }));

  assert(!v.possible, "la clôture ne devrait pas passer");
  assertEquals(v.manques, [
    { quoi: "objet", objetId: POKE_BALL, demande: 1, disponible: 0 },
  ]);
});

Deno.test("l'ordre des messages prime sur l'ordre du tableau", () => {
  // Les lignes arrivent désordonnées : le rejeu doit les remettre en ordre.
  const v = evaluerCloture([
    ligne(7, { type: "objet_utilise", objetId: POKE_BALL, quantite: 1 }),
    ligne(3, { type: "objet_trouve", objetId: POKE_BALL, quantite: 1 }),
  ], etat({ sac: new Map() }));

  assert(v.possible);
});

Deno.test("deux événements du même message gardent l'ordre d'écriture", () => {
  // Un seul post peut contenir « je trouve une ball » puis « je l'utilise ».
  // À messageId égal, c'est l'ordre du tableau qui tranche.
  const bon = evaluerCloture([
    ligne(4, { type: "objet_trouve", objetId: POKE_BALL, quantite: 1 }),
    ligne(4, { type: "objet_utilise", objetId: POKE_BALL, quantite: 1 }),
  ], etat({ sac: new Map() }));
  assert(bon.possible, "trouvée puis utilisée dans le même message : ça passe");

  const mauvais = evaluerCloture([
    ligne(4, { type: "objet_utilise", objetId: POKE_BALL, quantite: 1 }),
    ligne(4, { type: "objet_trouve", objetId: POKE_BALL, quantite: 1 }),
  ], etat({ sac: new Map() }));
  assert(!mauvais.possible, "utilisée avant d'être trouvée : ça ne passe pas");
});

// ── ce qui manque ───────────────────────────────────────────────────
Deno.test("deux balls demandées, une en sac : le manque est nommé", () => {
  const v = evaluerCloture([
    ligne(1, { type: "objet_utilise", objetId: POKE_BALL, quantite: 1 }),
    ligne(2, { type: "objet_utilise", objetId: POKE_BALL, quantite: 1 }),
  ], etat({ sac: new Map([[POKE_BALL, 1]]) }));

  assert(!v.possible);
  assertEquals(v.manques.length, 1);
  assertEquals(v.manques[0], {
    quoi: "objet",
    objetId: POKE_BALL,
    demande: 1,
    disponible: 0,
  });
});

Deno.test("on rend TOUT ce qui manque, pas seulement le premier", () => {
  const v = evaluerCloture([
    ligne(1, { type: "objet_utilise", objetId: POKE_BALL, quantite: 1 }),
    ligne(2, { type: "objet_utilise", objetId: POTION, quantite: 1 }),
  ], etat({ sac: new Map() }));

  assert(!v.possible);
  assertEquals(v.manques.length, 2);
});

Deno.test("plus de captures que de places en boîte", () => {
  const v = evaluerCloture([
    ligne(1, { type: "capture", especeId: 215, niveau: 19 }),
    ligne(2, { type: "capture", especeId: 220, niveau: 17 }),
  ], etat({ placesEnBoite: 1 }));

  assert(!v.possible);
  assertEquals(v.manques, [{ quoi: "place", demande: 2, disponible: 1 }]);
});

Deno.test("un solde qui passerait sous zéro est refusé", () => {
  const v = evaluerCloture(
    [ligne(1, { type: "pokedollars", montant: -1200 })],
    etat({ pokedollars: 1000 }),
  );

  assert(!v.possible);
  assertEquals(v.manques, [{ quoi: "argent", demande: 1200, disponible: 1000 }]);
});

// ── ce qui est versé ────────────────────────────────────────────────
Deno.test("l'XP s'additionne par pokémon", () => {
  const v = evaluerCloture([
    ligne(1, { type: "xp", pokemonId: "galopa", gain: 180 }),
    ligne(2, { type: "xp", pokemonId: "goupix", gain: 240 }),
    ligne(3, { type: "xp", pokemonId: "galopa", gain: 60 }),
  ], etat());

  assert(v.possible);
  assertEquals(v.effets.xpParPokemon.get("galopa"), 240);
  assertEquals(v.effets.xpParPokemon.get("goupix"), 240);
});

Deno.test("une espèce croisée deux fois n'est comptée qu'une", () => {
  const v = evaluerCloture([
    ligne(1, { type: "croise", especeId: 215 }),
    ligne(2, { type: "croise", especeId: 215 }),
    ligne(3, { type: "croise", especeId: 220 }),
  ], etat());

  assert(v.possible);
  assertEquals(v.effets.especesCroisees, [215, 220]);
});

Deno.test("les pokédollars s'additionnent, gains et dépenses", () => {
  const v = evaluerCloture([
    ligne(1, { type: "pokedollars", montant: 350 }),
    ligne(2, { type: "pokedollars", montant: -200 }),
  ], etat());

  assert(v.possible);
  assertEquals(v.effets.pokedollars, 150);
});

Deno.test("un registre vide clôture sans rien verser", () => {
  const v = evaluerCloture([], etat());
  assert(v.possible);
  assertEquals(v.effets.captures, []);
  assertEquals(v.effets.pokedollars, 0);
  assertEquals(v.effets.objetsConsommes.size, 0);
});

Deno.test("évaluer ne modifie pas l'état qu'on lui donne", () => {
  const sac = new Map([[POKE_BALL, 2]]);
  const e = etat({ sac });
  evaluerCloture(
    [ligne(1, { type: "objet_utilise", objetId: POKE_BALL, quantite: 2 })],
    e,
  );
  assertEquals(sac.get(POKE_BALL), 2, "le sac d'origine doit être intact");
});
