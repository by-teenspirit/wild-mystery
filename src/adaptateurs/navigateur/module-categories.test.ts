// ════════════════════════════════════════════════════════════════════
//  Le rang de la bande de titre. Ce qui se teste sans navigateur : le
//  zéro de tête. Le reste — la pose sur la page — est du DOM.
//
//  CETTE FONCTION A L'AIR TROP PETITE POUR UN TEST. Elle ne l'est pas :
//  un rang sans zéro décale toute la colonne entre la neuvième et la
//  dixième catégorie, et c'est une faute qu'on ne voit qu'une fois en
//  ligne, sur un forum qui a grandi.
// ════════════════════════════════════════════════════════════════════

import { assertEquals } from "@std/assert";
import { rangEnDeuxChiffres } from "./module-categories.ts";

Deno.test("le rang tient la colonne sur deux chiffres", () => {
  assertEquals(rangEnDeuxChiffres(1), "01");
  assertEquals(rangEnDeuxChiffres(9), "09");
  assertEquals(rangEnDeuxChiffres(10), "10");
  //  Au-delà de 99, on laisse : un forum à cent catégories a d'autres
  //  soucis que l'alignement de sa bande.
  assertEquals(rangEnDeuxChiffres(100), "100");
});
