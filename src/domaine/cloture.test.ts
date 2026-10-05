// ════════════════════════════════════════════════════════════════════
//  src/domaine/cloture.test.ts
//
//  Le cas qui justifie tout ce fichier est « trouvé puis utilisé ».
//  S'il casse, le rejeu dans l'ordre a été remplacé par une somme,
//  et le jeu devient faux sans que personne ne s'en aperçoive.
// ════════════════════════════════════════════════════════════════════

import { assert, assertEquals } from "@std/assert";
import { cumuler, type EtatDuJoueur, evaluerCloture, type LigneRegistre } from "./cloture.ts";

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

// ── ce que le registre CONTIENT, sans verdict ───────────────────────

//  `cumuler` sert au module affiché pendant le RP. Il montre des faits :
//  un joueur qui a lancé une ball l'a lancée, que la clôture puisse la
//  lui débiter ou non. C'est la règle 1 du `45-…` — rien n'est acquis
//  avant la clôture, et rien n'est retenu non plus.

Deno.test("cumuler montre une ball utilisée même avec le sac vide", () => {
  //  Le même registre refusé par `evaluerCloture` est affiché par
  //  `cumuler` : c'est toute la différence entre un fait et un verdict.
  const lignes = [ligne(1, { type: "objet_utilise", objetId: POKE_BALL, quantite: 1 })];

  const verdict = evaluerCloture(lignes, etat({ sac: new Map() }));
  assertEquals(verdict.possible, false);

  assertEquals([...cumuler(lignes).objetsConsommes], [[POKE_BALL, 1]]);
});

Deno.test("cumuler ne retient rien : ni place, ni argent", () => {
  const lignes = [
    ligne(1, { type: "capture", especeId: 25, niveau: 7 }),
    ligne(2, { type: "capture", especeId: 16, niveau: 4 }),
    ligne(3, { type: "pokedollars", montant: -5000 }),
  ];
  //  Zéro place en boîte et zéro pokédollar : `evaluerCloture` refuse.
  assertEquals(
    evaluerCloture(lignes, etat({ placesEnBoite: 0, pokedollars: 0 })).possible,
    false,
  );

  const e = cumuler(lignes);
  assertEquals(e.captures.length, 2);
  assertEquals(e.pokedollars, -5000);
});

Deno.test("cumuler garde l'ordre des messages, comme le rejeu", () => {
  //  C'est le même rejeu : si quelqu'un le réécrivait en somme, ce test
  //  et celui du haut du fichier tomberaient ensemble.
  const e = cumuler([
    ligne(7, { type: "objet_utilise", objetId: POKE_BALL, quantite: 1 }),
    ligne(3, { type: "objet_trouve", objetId: POKE_BALL, quantite: 1 }),
  ]);
  assertEquals([...e.objetsAjoutes], [[POKE_BALL, 1]]);
  assertEquals([...e.objetsConsommes], [[POKE_BALL, 1]]);
});

Deno.test("cumuler sur un registre vide ne rend rien du tout", () => {
  const e = cumuler([]);
  assertEquals(e.captures, []);
  assertEquals(e.especesCroisees, []);
  assertEquals(e.pokedollars, 0);
  assertEquals(e.xpParPokemon.size, 0);
  assertEquals(e.objetsAjoutes.size, 0);
  assertEquals(e.objetsConsommes.size, 0);
});

Deno.test("cumuler dédoublonne les croisements et additionne l'XP", () => {
  const e = cumuler([
    ligne(1, { type: "croise", especeId: 37 }),
    ligne(2, { type: "croise", especeId: 37 }),
    ligne(3, { type: "xp", pokemonId: "lumi", gain: 20 }),
    ligne(4, { type: "xp", pokemonId: "lumi", gain: 28 }),
  ]);
  assertEquals(e.especesCroisees, [37]);
  assertEquals([...e.xpParPokemon], [["lumi", 48]]);
});
