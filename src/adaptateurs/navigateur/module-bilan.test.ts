// ════════════════════════════════════════════════════════════════════
//  Ce qui se teste sans navigateur : la lecture de l'adresse. Le reste
//  est du DOM, vérifié sur le forum.
// ════════════════════════════════════════════════════════════════════

import { assertEquals } from "@std/assert";
import { sujetDepuisAdresse } from "./module-bilan.ts";

Deno.test("l'identifiant du sujet se lit dans l'adresse", () => {
  assertEquals(sujetDepuisAdresse("/t976-test2"), 976);
  assertEquals(sujetDepuisAdresse("/t1-un-sujet-au-titre-tres-long"), 1);
});

Deno.test("une adresse qui n'est pas celle d'un sujet rend null", () => {
  //  Le module ne doit pas se poser sur un forum, un profil ou l'index
  //  — et surtout pas demander le registre du « sujet » qui n'existe pas.
  for (
    const chemin of [
      "",
      "/",
      "/f9-foret-marecageuse",
      "/u4",
      "/memberlist",
      "/post?t=976&mode=reply",
      "t976-test2", // sans la barre de tête
      "/t-test",
    ]
  ) {
    assertEquals(sujetDepuisAdresse(chemin), null, chemin);
  }
});
