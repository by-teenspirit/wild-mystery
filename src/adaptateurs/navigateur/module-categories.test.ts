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
import { lireLeDernierMessage, rangEnDeuxChiffres } from "./module-categories.ts";

Deno.test("le rang tient la colonne sur deux chiffres", () => {
  assertEquals(rangEnDeuxChiffres(1), "01");
  assertEquals(rangEnDeuxChiffres(9), "09");
  assertEquals(rangEnDeuxChiffres(10), "10");
  //  Au-delà de 99, on laisse : un forum à cent catégories a d'autres
  //  soucis que l'alignement de sa bande.
  assertEquals(rangEnDeuxChiffres(100), "100");
});

// ════════════════════════════════════════════════════════════════════
//  La lecture du dernier message. Les morceaux sont ceux que les
//  `<br>` du gabarit découpent, RELEVÉS SUR LE FORUM le 8 octobre :
//
//      <a>test codes</a><br>Mar 2 Avr 2024 - 18:42<br>Invité&nbsp;<a…>
//
//  On ne teste pas le découpage — il est en DOM, c'est le harnais de
//  navigateur qui le couvre. On teste ce qui DÉCIDE : lequel des
//  morceaux est la date, lequel est l'auteur, et ce qui se passe
//  quand il en manque un.
// ════════════════════════════════════════════════════════════════════

Deno.test("la date vient avant l'auteur, comme dans le gabarit", () => {
  assertEquals(
    lireLeDernierMessage(["test codes", "Mar 2 Avr 2024 - 18:42", "Invité "]),
    { qui: "Invité", quand: "Mar 2 Avr 2024 - 18:42" },
  );
});

Deno.test("l'espace insécable que le gabarit colle au nom s'en va", () => {
  //  `&nbsp;` suit le nom dans le balisage réel. Une expression en
  //  `\s` ne l'attrape pas partout : d'où la classe nommée.
  const lu = lireLeDernierMessage(["sujet", "hier", " Maître du Jeu  "]);
  assertEquals(lu?.qui, "Maître du Jeu");
});

Deno.test("une date relative se recopie telle quelle", () => {
  //  « il y a 1 h », « hier » : c'est Forumactif qui les écrit, selon
  //  ses réglages et la langue du forum. On ne les analyse pas.
  assertEquals(lireLeDernierMessage(["sujet", "il y a 1 h", "Aliénor"])?.quand, "il y a 1 h");
});

Deno.test("sans auteur, on ne touche à rien", () => {
  //  Mieux vaut les trois lignes de ModernBB qu'un « par · » troué.
  assertEquals(lireLeDernierMessage(["sujet", "hier"]), null);
  assertEquals(lireLeDernierMessage(["sujet", "hier", "   "]), null);
});

Deno.test("sans date non plus", () => {
  assertEquals(lireLeDernierMessage(["sujet", "", "Invité"]), null);
  assertEquals(lireLeDernierMessage([]), null);
});

Deno.test("les sauts de ligne internes au nom ne cassent pas la ligne", () => {
  //  Un nom dans un `<span class="group-2">` arrive parfois avec des
  //  retours à la ligne du gabarit autour.
  assertEquals(
    lireLeDernierMessage(["sujet", "hier", "\n  Maître\n  du Jeu\n"])?.qui,
    "Maître du Jeu",
  );
});
