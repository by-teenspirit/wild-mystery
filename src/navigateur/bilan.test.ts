// ════════════════════════════════════════════════════════════════════
//  src/navigateur/bilan.test.ts
//
//  Ces lignes viennent d'une API publique. La moitié de ces essais ne
//  vérifient donc pas ce qui marche, mais ce qui ne doit PAS tomber
//  quand les données sont abîmées : une ligne fausse disparaît, les
//  autres restent, la page tient.
// ════════════════════════════════════════════════════════════════════

import { assertEquals } from "@std/assert";
import { rubriquesEnAttente } from "../application/bilan.ts";
import { aNommer, evenementDepuis, ligneEnAttente, lignesDepuis, parJoueur } from "./bilan.ts";
import { cumuler } from "../domaine/cloture.ts";

const ANNA = "11111111-1111-1111-1111-111111111111";
const BORIS = "22222222-2222-2222-2222-222222222222";

function brut(
  joueur: string,
  messageId: number,
  type: string,
  charge: unknown,
): Record<string, unknown> {
  return { joueur_id: joueur, message_id: messageId, type, charge };
}

// ── lire une charge ─────────────────────────────────────────────────

Deno.test("chaque type de charge se relit", () => {
  assertEquals(evenementDepuis("croise", { especeId: 37 }), {
    type: "croise",
    especeId: 37,
  });
  assertEquals(evenementDepuis("capture", { especeId: 25, niveau: 7 }), {
    type: "capture",
    especeId: 25,
    niveau: 7,
  });
  assertEquals(evenementDepuis("xp", { pokemonId: "lumi", gain: 48 }), {
    type: "xp",
    pokemonId: "lumi",
    gain: 48,
  });
  assertEquals(evenementDepuis("objet_trouve", { objetId: 990001, quantite: 2 }), {
    type: "objet_trouve",
    objetId: 990001,
    quantite: 2,
  });
  assertEquals(evenementDepuis("objet_utilise", { objetId: 990001, quantite: 1 }), {
    type: "objet_utilise",
    objetId: 990001,
    quantite: 1,
  });
  assertEquals(evenementDepuis("pokedollars", { montant: -200 }), {
    type: "pokedollars",
    montant: -200,
  });
});

Deno.test("une clé mal orthographiée fait disparaître la ligne", () => {
  //  Le serpent au lieu du chameau, c'est exactement le bogue que la
  //  migration 0004 a corrigé côté SQL. Ici il ne doit pas se taire
  //  non plus.
  assertEquals(evenementDepuis("croise", { espece_id: 37 }), null);
  assertEquals(evenementDepuis("capture", { especeId: 25 }), null);
  assertEquals(evenementDepuis("objet_utilise", { objetId: 1 }), null);
});

Deno.test("un type inconnu est sauté, pas fatal", () => {
  //  Une version du serveur peut écrire un événement qu'une version du
  //  navigateur ignore encore.
  assertEquals(evenementDepuis("evolution", { especeId: 37 }), null);
  assertEquals(evenementDepuis(null, { especeId: 37 }), null);
});

Deno.test("une charge qui n'est pas un objet ne lève pas", () => {
  for (const charge of [null, undefined, 42, "croise", []]) {
    assertEquals(evenementDepuis("croise", charge), null, String(charge));
  }
});

Deno.test("les identifiants doivent être des entiers strictement positifs", () => {
  for (const especeId of [0, -1, 1.5, "37", null, NaN, Infinity]) {
    assertEquals(evenementDepuis("croise", { especeId }), null, String(especeId));
  }
});

Deno.test("un gain d'XP peut être négatif, un montant aussi", () => {
  //  Ce ne sont pas des identifiants : zéro et le négatif ont un sens.
  assertEquals(evenementDepuis("xp", { pokemonId: "lumi", gain: 0 })?.type, "xp");
  assertEquals(evenementDepuis("pokedollars", { montant: 0 })?.type, "pokedollars");
});

// ── lire une réponse entière ────────────────────────────────────────

Deno.test("une ligne abîmée disparaît, les autres restent", () => {
  const lues = lignesDepuis([
    brut(ANNA, 1, "croise", { especeId: 37 }),
    brut(ANNA, 2, "croise", { espece_id: 16 }), // clé fausse
    { joueur_id: ANNA, message_id: 3 }, // pas de type
    brut("", 4, "croise", { especeId: 25 }), // pas de joueur
    brut(ANNA, 0, "croise", { especeId: 25 }), // pas de message
    brut(BORIS, 5, "capture", { especeId: 25, niveau: 7 }),
  ]);
  assertEquals(lues.length, 2);
  assertEquals(lues[0].joueurId, ANNA);
  assertEquals(lues[1].joueurId, BORIS);
});

Deno.test("une réponse qui n'est pas un tableau rend une liste vide", () => {
  for (const donnees of [null, undefined, {}, "", 0, { message: "JWT expired" }]) {
    assertEquals(lignesDepuis(donnees), [], String(donnees));
  }
});

// ── grouper ─────────────────────────────────────────────────────────

Deno.test("une colonne par joueur, dans l'ordre d'entrée dans le sujet", () => {
  //  L'ordre des colonnes est celui des messages, pas celui des UUID :
  //  un joueur doit se retrouver là où il a parlé.
  const par = parJoueur(lignesDepuis([
    brut(BORIS, 10, "croise", { especeId: 37 }),
    brut(ANNA, 20, "croise", { especeId: 16 }),
    brut(BORIS, 30, "croise", { especeId: 25 }),
  ]));
  assertEquals([...par.keys()], [BORIS, ANNA]);
  assertEquals(par.get(BORIS)?.length, 2);
  assertEquals(par.get(ANNA)?.length, 1);
});

Deno.test("un registre vide ne donne aucune colonne", () => {
  assertEquals(parJoueur([]).size, 0);
});

// ── ce qu'il faut savoir nommer ─────────────────────────────────────

Deno.test("on ne demande chaque nom qu'une fois", () => {
  const e = cumuler(
    lignesDepuis([
      brut(ANNA, 1, "croise", { especeId: 37 }),
      brut(ANNA, 2, "croise", { especeId: 37 }),
      brut(ANNA, 3, "capture", { especeId: 37, niveau: 7 }),
      brut(ANNA, 4, "objet_trouve", { objetId: 990001, quantite: 1 }),
      brut(ANNA, 5, "objet_utilise", { objetId: 990001, quantite: 1 }),
    ]).map((l) => l.ligne),
  );
  const quoi = aNommer(e);
  assertEquals(quoi.especes, [37]);
  assertEquals(quoi.objets, [990001]);
});

// ── la colonne d'un joueur ──────────────────────────────────────────

Deno.test("la colonne reprend les noms, et dit ce qu'elle n'a pas su nommer", () => {
  const lignes = lignesDepuis([
    brut(ANNA, 1, "croise", { especeId: 37 }),
    brut(ANNA, 2, "capture", { especeId: 999, niveau: 7 }),
    brut(ANNA, 3, "objet_utilise", { objetId: 990001, quantite: 1 }),
    brut(ANNA, 4, "pokedollars", { montant: 350 }),
  ]).map((l) => l.ligne);

  const l = ligneEnAttente("Anna", lignes, {
    especes: new Map([[37, "Goupix"]]),
    objets: new Map([[990001, "Poké Ball"]]),
  });

  assertEquals(l.croisees, ["Goupix"]);
  //  999 n'est pas dans l'index : « #999 » dit qu'il manque un nom,
  //  pas que l'espèce s'appelle comme ça.
  assertEquals(l.captures, [{ espece: "#999", niveau: 7 }]);
  assertEquals(l.consommes, [{ objet: "Poké Ball", quantite: 1 }]);
  assertEquals(l.pokedollars, 350);

  assertEquals(rubriquesEnAttente(l), [
    { etiquette: "CAPTURÉ", valeur: "#999 niv. 7" },
    { etiquette: "CROISÉ", valeur: "Goupix" },
    { etiquette: "CONSOMMÉ", valeur: "1 Poké Ball" },
    { etiquette: "POKÉDOLLARS", valeur: "+350" },
  ]);
});

Deno.test("un joueur sans rien à montrer n'a aucune rubrique", () => {
  const l = ligneEnAttente("Anna", [], { especes: new Map(), objets: new Map() });
  assertEquals(rubriquesEnAttente(l), []);
  assertEquals(l.pseudo, "Anna");
});

Deno.test("une ball lancée s'affiche même sans l'avoir trouvée", () => {
  //  C'est `cumuler` qui le garantit ; cet essai tient la promesse au
  //  niveau où le joueur la voit.
  const lignes = lignesDepuis([
    brut(ANNA, 1, "objet_utilise", { objetId: 990001, quantite: 2 }),
  ]).map((l) => l.ligne);
  const l = ligneEnAttente("Anna", lignes, {
    especes: new Map(),
    objets: new Map([[990001, "Poké Ball"]]),
  });
  assertEquals(rubriquesEnAttente(l), [
    { etiquette: "CONSOMMÉ", valeur: "2 Poké Ball" },
  ]);
});
