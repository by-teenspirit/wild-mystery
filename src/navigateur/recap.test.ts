// ════════════════════════════════════════════════════════════════════
//  src/navigateur/recap.test.ts
//
//  Ce que ces essais protègent.
//
//  **Qu'un bloc vide ne se dessine pas.** Un récapitulatif collé au
//  bord de l'écran prend de la place en permanence : trois cadres
//  vides sur un sujet neuf seraient une gêne, pas une information.
//
//  **Que la jauge reste dans son cadre.** Une barre à 140 % sortirait
//  du panneau et on chercherait le défaut dans le CSS.
//
//  **Que les seuils soient ceux des jeux.** Un joueur qui a joué à un
//  Pokémon les lit sans les apprendre ; les déplacer d'un point, c'est
//  lui mentir sur l'état de son équipe.
// ════════════════════════════════════════════════════════════════════

import { assertEquals } from "@std/assert";
import {
  blocsDuRecap,
  etatDePv,
  type MembreDuRecap,
  type MonSujet,
  nomDuMembre,
  partDePv,
} from "./recap.ts";
import type { LigneEnAttente } from "../application/bilan.ts";

function membre(dessus: Partial<MembreDuRecap> = {}): MembreDuRecap {
  return {
    position: 1,
    especeId: 4,
    nom: "Salamèche",
    surnom: null,
    niveau: 5,
    pv: 18,
    pvMax: 18,
    combat: false,
    ...dessus,
  };
}

const SUJET: MonSujet = {
  equipe: [membre()],
  combat: {
    tour: 2,
    sauvage: {
      especeId: 77,
      nom: "Ponyta",
      niveau: 10,
      types: ["feu"],
      pv: 18,
      pvMax: 30,
    },
    pvPokemon: 11,
    pvPokemonMax: 18,
  },
};

const GAINS: LigneEnAttente = {
  pseudo: "Jake Dalziel",
  captures: [{ nom: "Roucool", especeId: 16, niveau: 7 }],
  croisees: [],
  experience: [],
  ajoutes: [],
  consommes: [],
  pokedollars: 0,
};

// ── le nom ──────────────────────────────────────────────────────────

Deno.test("le surnom ne fait pas disparaître l'espèce", () => {
  //  La même règle que les messages du Maître du Jeu : un joueur ne
  //  doit pas lire deux noms pour un même Pokémon selon l'endroit où
  //  il regarde.
  assertEquals(nomDuMembre(membre({ surnom: "Biscotte" })), "Biscotte (Salamèche)");
  assertEquals(nomDuMembre(membre({ surnom: null })), "Salamèche");
  assertEquals(nomDuMembre(membre({ surnom: "   " })), "Salamèche");
});

// ── la jauge ────────────────────────────────────────────────────────

Deno.test("la part de PV va de 0 à 100, et pas au-delà", () => {
  assertEquals(partDePv(18, 18), 100);
  assertEquals(partDePv(9, 18), 50);
  assertEquals(partDePv(0, 18), 0);
  //  LES DEUX BORNES COMPTENT : une barre à 140 % sortirait du
  //  panneau, une barre négative disparaîtrait sans qu'on sache
  //  pourquoi.
  assertEquals(partDePv(25, 18), 100);
  assertEquals(partDePv(-3, 18), 0);
});

Deno.test("UN MAXIMUM ABSURDE NE FAIT PAS TOMBER LA PAGE", () => {
  //  Ces valeurs ne devraient pas exister. Si elles arrivent, la
  //  jauge doit rendre zéro — pas `NaN`, qui donnerait
  //  `width: NaN%` et une barre pleine chez certains navigateurs.
  assertEquals(partDePv(5, 0), 0);
  assertEquals(partDePv(5, -1), 0);
  assertEquals(partDePv(Number.NaN, 18), 0);
  assertEquals(partDePv(5, Number.POSITIVE_INFINITY), 0);
});

Deno.test("LES SEUILS SONT CEUX DES JEUX", () => {
  //  Vert jusqu'à la moitié, orange jusqu'au cinquième, rouge en
  //  dessous. On vérifie les BORDS, pas le milieu : c'est là qu'un
  //  déplacement d'un point se voit.
  assertEquals(etatDePv(18, 18), "bien");
  assertEquals(etatDePv(10, 18), "bien");
  assertEquals(etatDePv(9, 18), "entame");
  assertEquals(etatDePv(4, 18), "entame");
  assertEquals(etatDePv(3, 18), "critique");
  assertEquals(etatDePv(1, 18), "critique");
});

Deno.test("ZÉRO PV N'EST PAS « PRESQUE MORT »", () => {
  //  C'est une case qui ne peut plus se battre, et la différence
  //  décide d'un tour : on change de Pokémon ou on utilise un Rappel.
  assertEquals(etatDePv(0, 18), "terre");
  assertEquals(etatDePv(-2, 18), "terre");
});

// ── les blocs ───────────────────────────────────────────────────────

Deno.test("les trois blocs sortent dans l'ordre de l'urgence", () => {
  //  Le combat attend une réponse, l'équipe la décide, les gains se
  //  regardent quand il n'y a rien à décider.
  assertEquals(
    blocsDuRecap(SUJET, GAINS).map((b) => b.quoi),
    ["combat", "equipe", "gains"],
  );
});

Deno.test("UN BLOC VIDE NE SE DESSINE PAS", () => {
  //  Le récapitulatif est collé au bord de l'écran en permanence :
  //  trois cadres vides sur un sujet neuf seraient une gêne.
  assertEquals(
    blocsDuRecap({ equipe: SUJET.equipe, combat: null }, null).map((b) => b.quoi),
    ["equipe"],
  );
  assertEquals(
    blocsDuRecap({ equipe: [], combat: null }, GAINS).map((b) => b.quoi),
    ["gains"],
  );
});

Deno.test("RIEN DU TOUT REND UN TABLEAU VIDE — et le panneau ne se pose pas", () => {
  assertEquals(blocsDuRecap(null, null), []);
  assertEquals(blocsDuRecap({ equipe: [], combat: null }, null), []);
});

Deno.test("une ligne de bilan sans rubrique ne fait pas un bloc", () => {
  //  « Rien à verser » a sa place dans le bilan posté, qui nomme tout
  //  le monde. Ici, un bloc qui dirait « rien » prendrait la place
  //  d'un bloc qui dit quelque chose.
  const vide: LigneEnAttente = { ...GAINS, captures: [] };
  assertEquals(blocsDuRecap({ equipe: [], combat: null }, vide), []);
});

Deno.test("l'équipe passe entière, avec celui qui se bat marqué", () => {
  const equipe = [membre({ position: 1 }), membre({ position: 2, combat: true })];
  const blocs = blocsDuRecap({ equipe, combat: null }, null);
  assertEquals(blocs.length, 1);
  const bloc = blocs[0];
  assertEquals(bloc.quoi, "equipe");
  if (bloc.quoi !== "equipe") return;
  assertEquals(bloc.equipe.map((m) => m.combat), [false, true]);
});
