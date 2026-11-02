import { assertEquals } from "@std/assert";
import {
  blocDeReclamation,
  empreinteReclamee,
  secretBienForme,
  TAILLE_EMPREINTE,
  TAILLE_SECRET,
} from "./reclamation.ts";

const E = "a".repeat(TAILLE_EMPREINTE);

Deno.test("le bloc se reconnaît dans un message, au milieu du reste", () => {
  assertEquals(empreinteReclamee(`Bonjour ! [[WM-CARNET:${E}]] merci`), E);
  assertEquals(empreinteReclamee(`[[ wm-carnet : ${E.toUpperCase()} ]]`), E);
});

Deno.test("un bloc mal formé ne lie rien", () => {
  //  UNE EMPREINTE TRONQUÉE LIERAIT UN COMPTE À QUELQUE CHOSE QUE
  //  PERSONNE NE POURRA RÉCLAMER. Mieux vaut ne rien voir.
  assertEquals(empreinteReclamee(`[[WM-CARNET:${"a".repeat(47)}]]`), null);
  assertEquals(empreinteReclamee(`[[WM-CARNET:${"z".repeat(48)}]]`), null);
  assertEquals(empreinteReclamee("[[WM-CARNET:]]"), null);
  assertEquals(empreinteReclamee("je voudrais ouvrir mon carnet"), null);
  //  ET PAS LE MARQUEUR DU SERVEUR, qui est d'une autre famille.
  assertEquals(empreinteReclamee("[[WM:bilan-pose]]"), null);
});

Deno.test("le bloc écrit est celui qui se relit", () => {
  assertEquals(empreinteReclamee(blocDeReclamation(E.toUpperCase())), E);
});

Deno.test("un secret bien formé fait 32 caractères hexadécimaux", () => {
  assertEquals(secretBienForme("f".repeat(TAILLE_SECRET)), true);
  assertEquals(secretBienForme("f".repeat(TAILLE_SECRET - 1)), false);
  assertEquals(secretBienForme("F".repeat(TAILLE_SECRET)), false);
  assertEquals(secretBienForme(""), false);
});
