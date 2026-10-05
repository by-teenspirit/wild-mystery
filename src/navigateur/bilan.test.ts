// ════════════════════════════════════════════════════════════════════
//  src/navigateur/bilan.test.ts
//
//  Ces lignes viennent d'une API publique. La moitié de ces essais ne
//  vérifient donc pas ce qui marche, mais ce qui ne doit PAS tomber
//  quand les données sont abîmées : une ligne fausse disparaît, les
//  autres restent, la page tient.
// ════════════════════════════════════════════════════════════════════

import { assert, assertEquals } from "@std/assert";
import { rubriquesEnAttente } from "../application/bilan.ts";
import {
  aNommer,
  colonnesDuBilan,
  etatDuBoutonDeCloture,
  evenementDepuis,
  ligneEnAttente,
  lignesDepuis,
  parJoueur,
  pseudoParJoueur,
} from "./bilan.ts";
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

// ── le pseudo vient de la page, pas de la base ──────────────────────

const PAGE = new Map([[10, "Anna"], [20, "Boris"], [30, "Anna"]]);
const dansLaPage = (id: number) => PAGE.get(id) ?? null;

Deno.test("chaque joueur prend le pseudo de son premier message", () => {
  const lues = lignesDepuis([
    brut(ANNA, 10, "croise", { especeId: 37 }),
    brut(BORIS, 20, "croise", { especeId: 16 }),
    brut(ANNA, 30, "croise", { especeId: 25 }),
  ]);
  assertEquals([...pseudoParJoueur(lues, dansLaPage)], [[ANNA, "Anna"], [BORIS, "Boris"]]);
});

Deno.test("un joueur dont le message n'est pas sur la page n'a pas de nom", () => {
  //  Pagination : ses lignes existent, son message est ailleurs.
  const lues = lignesDepuis([brut(ANNA, 999, "croise", { especeId: 37 })]);
  assertEquals(pseudoParJoueur(lues, dansLaPage).size, 0);
});

Deno.test("et il n'a pas de colonne non plus", () => {
  //  Montrer un UUID serait pire que de ne rien montrer.
  const lues = lignesDepuis([
    brut(ANNA, 10, "croise", { especeId: 37 }),
    brut(BORIS, 999, "croise", { especeId: 16 }),
  ]);
  const cols = colonnesDuBilan(lues, pseudoParJoueur(lues, dansLaPage), {
    especes: new Map([[37, "Goupix"]]),
    objets: new Map(),
  });
  assertEquals(cols.length, 1);
  assertEquals(cols[0].ligne.pseudo, "Anna");
});

Deno.test("les colonnes sortent dans l'ordre d'entrée dans le sujet", () => {
  const lues = lignesDepuis([
    brut(BORIS, 20, "croise", { especeId: 16 }),
    brut(ANNA, 10, "croise", { especeId: 37 }),
  ]);
  const cols = colonnesDuBilan(lues, pseudoParJoueur(lues, dansLaPage), {
    especes: new Map(),
    objets: new Map(),
  });
  //  Boris parle en premier dans le tableau reçu : il passe en premier,
  //  quel que soit son identifiant.
  assertEquals(cols.map((c) => c.ligne.pseudo), ["Boris", "Anna"]);
});

Deno.test("un joueur nommé mais sans effet garde sa colonne", () => {
  //  Comme dans le message posté : on le nomme, et on dit qu'il n'a
  //  rien à verser. Une colonne absente ressemblerait à un bogue.
  const lues = lignesDepuis([brut(ANNA, 10, "evolution", { especeId: 37 })]);
  assertEquals(lues.length, 0, "le type inconnu a bien été écarté");

  const avecLigne = lignesDepuis([brut(ANNA, 10, "xp", { pokemonId: "lumi", gain: 0 })]);
  const cols = colonnesDuBilan(avecLigne, pseudoParJoueur(avecLigne, dansLaPage), {
    especes: new Map(),
    objets: new Map(),
  });
  assertEquals(cols.length, 1);
  assertEquals(rubriquesEnAttente(cols[0].ligne), [
    { etiquette: "EXPÉRIENCE", valeur: "lumi +0" },
  ]);
});

// ── le cas réel, relevé sur le forum le 5 octobre ───────────────────

Deno.test("le registre réel du sujet 976, tel que PostgREST le rend", () => {
  //  Copié de la réponse de l'API, pas inventé : c'est la forme exacte
  //  que la base renvoie, serpent compris sur `joueur_id` et
  //  `message_id`, chameau compris dans la charge. Si l'une des deux
  //  conventions change, cet essai tombe avant les joueurs.
  const reponse = [{
    joueur_id: "a7dfc8ad-71b0-49c0-83e0-a7c82038bb05",
    message_id: 15546,
    type: "objet_trouve",
    charge: { objetId: 990001, quantite: 1 },
  }];

  const lignes = lignesDepuis(reponse);
  assertEquals(lignes.length, 1);

  //  Le pseudo vient de la page : le message 15546 y est, signé
  //  « Compte de test ».
  const pseudos = pseudoParJoueur(lignes, (id) => (id === 15546 ? "Compte de test" : null));

  const cols = colonnesDuBilan(lignes, pseudos, {
    especes: new Map(),
    objets: new Map([[990001, "Poké Ball"]]),
  });

  assertEquals(cols.length, 1);
  assertEquals(cols[0].ligne.pseudo, "Compte de test");
  assertEquals(rubriquesEnAttente(cols[0].ligne), [
    { etiquette: "AJOUTÉ AU SAC", valeur: "1 Poké Ball" },
  ]);
});

// ── le bouton de clôture ────────────────────────────────────────────

Deno.test("le bouton annonce ce qu'un second clic ferait", () => {
  //  Le défaut qu'on évite : rester sur « Clôturer le sujet » une fois le
  //  mot posé, ce qui laisse croire qu'on clôturerait deux fois.
  assertEquals(etatDuBoutonDeCloture(false).libelle, "Clôturer le sujet");
  assertEquals(etatDuBoutonDeCloture(true).libelle, "Annuler la clôture");
});

Deno.test("les deux états disent que rien ne part sans le joueur", () => {
  //  C'est la peur à désamorcer ici, et elle ne disparaît pas une fois le
  //  mot posé — au contraire.
  for (const demandee of [false, true]) {
    const etat = etatDuBoutonDeCloture(demandee);
    assertEquals(etat.demandee, demandee);
    assert(etat.note.length > 0, "une note vide laisserait le joueur seul");
    assert(
      /envoyer|sans toi/i.test(etat.note),
      `la note doit parler de l'envoi : ${etat.note}`,
    );
  }
});
