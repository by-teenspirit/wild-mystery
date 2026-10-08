// ════════════════════════════════════════════════════════════════════
//  Les deux nombres de la bande de titre. Ce qui se teste sans
//  navigateur : l'accord du mot et le zéro de tête. Le reste — la pose
//  sur la page — est du DOM, et c'est le harnais de l'index qui le
//  verra.
//
//  CES DEUX FONCTIONS ONT L'AIR TROP PETITES POUR UN TEST. Elles ne le
//  sont pas : « 1 FORUMS » se lit sur chaque forum qui n'en a qu'un, et
//  un rang sans zéro décale toute la colonne entre la neuvième et la
//  dixième catégorie. Deux fautes qu'on ne voit qu'une fois en ligne.
// ════════════════════════════════════════════════════════════════════

import { assertEquals } from "@std/assert";
import { compterLesForums, rangEnDeuxChiffres } from "./module-categories.ts";

Deno.test("le compte de forums s'accorde", () => {
  assertEquals(compterLesForums(0), "0 FORUM");
  assertEquals(compterLesForums(1), "1 FORUM");
  assertEquals(compterLesForums(2), "2 FORUMS");
  assertEquals(compterLesForums(14), "14 FORUMS");
});

Deno.test("le rang tient la colonne sur deux chiffres", () => {
  assertEquals(rangEnDeuxChiffres(1), "01");
  assertEquals(rangEnDeuxChiffres(9), "09");
  assertEquals(rangEnDeuxChiffres(10), "10");
  //  Au-delà de 99, on laisse : un forum à cent catégories a d'autres
  //  soucis que l'alignement de sa bande.
  assertEquals(rangEnDeuxChiffres(100), "100");
});
