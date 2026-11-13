// ════════════════════════════════════════════════════════════════════
//  Ce que ces tests protègent.
//
//  **Qu'on ne dessine pas une jauge fausse.** Le pourcentage est lu
//  dans une phrase écrite par Forumactif, pas reçu d'une variable : une
//  phrase qu'on ne reconnaît pas ne doit pas donner un nombre, elle
//  doit ne rien donner du tout.
//
//  **Et qu'une boîte vide n'ait pas de barre.** « Votre boîte de
//  réception est vide » ne porte aucun chiffre, et une jauge à zéro sur
//  une boîte vide est du mobilier.
// ════════════════════════════════════════════════════════════════════

import { assertEquals } from "@std/assert";
import { pourcentageDeQuota } from "./messagerie.ts";

Deno.test("le pourcentage se lit dans la phrase de Forumactif", () => {
  //  Relevé mot pour mot le 13 novembre sur `?folder=sentbox`.
  assertEquals(
    pourcentageDeQuota("Votre boîte des messages envoyés est pleine à 8%"),
    8,
  );
  assertEquals(
    pourcentageDeQuota("Votre boîte de réception est pleine à 100%"),
    100,
  );
  //  L'espace avant le signe existe dans certaines traductions.
  assertEquals(pourcentageDeQuota("… est pleine à 34 %"), 34);
});

Deno.test("et une boîte sans chiffre ne donne pas de jauge", () => {
  //  Relevé le même jour sur `?folder=inbox`.
  assertEquals(pourcentageDeQuota("Votre boîte de réception est vide"), null);
  for (
    const rien of ["", "   ", "pleine", "8 messages sur 50", null, undefined]
  ) {
    assertEquals(pourcentageDeQuota(rien), null, JSON.stringify(rien));
  }
});

Deno.test("au-delà de cent, la barre est pleine et ne déborde pas", () => {
  //  Forumactif compte les brouillons dans le quota : une boîte peut
  //  passer sa limite, et une barre à 140 % sortirait de sa gouttière.
  assertEquals(pourcentageDeQuota("… est pleine à 140%"), 100);
  assertEquals(pourcentageDeQuota("… est pleine à 101%"), 100);
});
