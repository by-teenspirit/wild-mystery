import { assertEquals } from "@std/assert";
import { ongletActif, slug, voisin } from "./sous-onglets.ts";

Deno.test("le slug d'un titre tient dans une adresse", () => {
  assertEquals(slug("Comment le serveur tire"), "comment-le-serveur-tire");
  assertEquals(
    slug("  Le jour, la nuit, et le temps qu'il fait  "),
    "le-jour-la-nuit-et-le-temps-qu-il-fait",
  );
  assertEquals(slug("Ce qu'on trouve au sol"), "ce-qu-on-trouve-au-sol");
});

Deno.test("LES LIGATURES D'ABORD, NFD ENSUITE", () => {
  //  `œ` et `æ` ne se décomposent pas : sans la première passe,
  //  « Cœur » sortait en `c-ur`. Leçon de `src/domaine/lieu.ts`.
  assertEquals(slug("Cœur de la forêt"), "coeur-de-la-foret");
  assertEquals(slug("Æthel"), "aethel");
});

Deno.test("UNE ADRESSE PÉRIMÉE MONTRE LA PAGE, PAS UNE PAGE VIDE", () => {
  const clefs = ["les-tirages", "la-meteo", "le-sol"];
  assertEquals(ongletActif("la-meteo", clefs), "la-meteo");
  assertEquals(ongletActif("#la-meteo", clefs), "la-meteo");
  assertEquals(ongletActif("  LA-METEO ", clefs), "la-meteo");
  assertEquals(ongletActif("une-section-disparue", clefs), "les-tirages");
  assertEquals(ongletActif("", clefs), "les-tirages");
});

Deno.test("et un groupe sans onglet n'ouvre rien", () => {
  assertEquals(ongletActif("x", []), null);
});

Deno.test("LA FLÈCHE TOURNE", () => {
  //  Une rangée qui s'arrête au bout oblige à revenir touche par
  //  touche — ce qu'on ne remarque qu'au clavier.
  const clefs = ["a", "b", "c"];
  assertEquals(voisin(clefs, "a", 1), "b");
  assertEquals(voisin(clefs, "c", 1), "a");
  assertEquals(voisin(clefs, "a", -1), "c");
  assertEquals(voisin(clefs, "b", -1), "a");
});

Deno.test("et une clef inconnue retombe sur la première", () => {
  assertEquals(voisin(["a", "b"], "z", 1), "a");
});
