// ════════════════════════════════════════════════════════════════════
//  Les trois statuts. Ce qui est testé ici est ce qui DÉCIDE : quels
//  boutons existent, et ce qu'ils montrent. Le reste est du DOM, et
//  c'est `outils/personnages.mjs` qui le regarde dans un navigateur.
// ════════════════════════════════════════════════════════════════════

import { assertEquals } from "@std/assert";
import {
  choixDuFragment,
  compter,
  estUnStatut,
  filtresAProposer,
  motDuCompte,
  motDuStatut,
  type Statut,
  STATUTS,
  visible,
} from "./personnages.ts";

const LA_PAGE: Statut[] = [
  "pnj",
  "pnj",
  "pnj",
  "pnj",
  "pnj",
  "jouable",
  "pnj",
  "pnj",
  "jouable",
  "jouable",
  "joue",
  "jouable",
  "jouable",
  "pnj",
];

Deno.test("trois statuts, et l'ordre des boutons est celui de la liste", () => {
  assertEquals([...STATUTS], ["jouable", "joue", "pnj"]);
  assertEquals(STATUTS.map(motDuStatut), ["Jouable", "Joué", "PNJ"]);
});

Deno.test("un mot qui n'est pas un statut est refusé", () => {
  assertEquals(estUnStatut("jouable"), true);
  assertEquals(estUnStatut("joue"), true);
  //  Les mots du sujet d'origine ne sont PAS des clés : s'ils
  //  arrivaient jusqu'ici, c'est que le ramassage de la génération a
  //  sauté, et il faut que ça se voie.
  assertEquals(estUnStatut("Non jouable"), false);
  assertEquals(estUnStatut("joué"), false);
  assertEquals(estUnStatut(""), false);
});

Deno.test("le compte des quatorze fiches de la page", () => {
  assertEquals(compter(LA_PAGE), { jouable: 5, joue: 1, pnj: 8 });
});

Deno.test("les trois clés sont là même à zéro", () => {
  assertEquals(compter([]), { jouable: 0, joue: 0, pnj: 0 });
});

Deno.test("la barre de la page : tous, puis les trois statuts avec leur nombre", () => {
  assertEquals(filtresAProposer(LA_PAGE), [
    { cle: "tous", mot: "Tous", nombre: 14 },
    { cle: "jouable", mot: "Jouable", nombre: 5 },
    { cle: "joue", mot: "Joué", nombre: 1 },
    { cle: "pnj", mot: "PNJ", nombre: 8 },
  ]);
});

Deno.test("un statut sans fiche n'a pas de bouton", () => {
  //  C'est l'état de la page avant que Donozor soit joué : pas de
  //  bouton « Joué », et il revient de lui-même le jour où une fiche
  //  le porte.
  const sansJoue: Statut[] = ["jouable", "jouable", "pnj"];
  assertEquals(filtresAProposer(sansJoue).map((f) => f.cle), ["tous", "jouable", "pnj"]);
});

Deno.test("un seul statut : aucune barre", () => {
  //  Rien à trier. « Tous » et « PNJ » montreraient la même liste.
  assertEquals(filtresAProposer(["pnj", "pnj", "pnj"]), []);
  assertEquals(filtresAProposer([]), []);
});

Deno.test("« tous » montre tout, un statut ne montre que le sien", () => {
  assertEquals(visible("jouable", "tous"), true);
  assertEquals(visible("pnj", "tous"), true);
  assertEquals(visible("jouable", "jouable"), true);
  assertEquals(visible("jouable", "pnj"), false);
  assertEquals(visible("joue", "jouable"), false);
});

Deno.test("l'annonce accorde le pluriel et dit sur quoi on a filtré", () => {
  assertEquals(motDuCompte(14, "tous"), "14 personnages");
  assertEquals(motDuCompte(5, "jouable"), "5 personnages — jouable");
  assertEquals(motDuCompte(1, "joue"), "1 personnage — joué");
  assertEquals(motDuCompte(0, "joue"), "0 personnages — joué");
});

Deno.test("l'adresse peut ouvrir la page sur un filtre", () => {
  const f = filtresAProposer(LA_PAGE);
  assertEquals(choixDuFragment("#jouable", f), "jouable");
  assertEquals(choixDuFragment("tous", f), "tous");
  assertEquals(choixDuFragment("", f), null);
  assertEquals(choixDuFragment("#", f), null);
  //  Un fragment qui ne correspond à aucun bouton ne doit RIEN
  //  changer : l'annexe 11 porte déjà `#les-champions` pour ses
  //  sous-onglets, et ce fragment-là n'est pas un filtre.
  assertEquals(choixDuFragment("#les-champions", f), null);
  assertEquals(choixDuFragment("#joue", filtresAProposer(["jouable", "pnj"])), null);
});
