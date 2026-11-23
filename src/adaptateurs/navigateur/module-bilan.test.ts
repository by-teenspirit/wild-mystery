// ════════════════════════════════════════════════════════════════════
//  Ce qui se teste sans navigateur : la lecture de l'adresse. Le reste
//  est du DOM, vérifié sur le forum.
// ════════════════════════════════════════════════════════════════════

import { assertEquals } from "@std/assert";
import { pseudoLu, sujetDepuisAdresse } from "./module-bilan.ts";

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

// ── le pseudo, nettoyé de son décor ─────────────────────────────────

Deno.test("L'AROBASE DU THÈME N'EST PAS DANS LE PSEUDO", () => {
  //  C'EST LA PANNE DU 23 NOVEMBRE, et elle tenait à ce caractère.
  //  Le thème écrit « @Jake Dalziel » dans `.postprofile-name` ;
  //  `_userdata.username` rend « Jake Dalziel ». Le récapitulatif
  //  cherchait sa colonne par égalité stricte, et ne la trouvait
  //  jamais : le bloc des gains ne s'affichait POUR PERSONNE.
  assertEquals(pseudoLu("@Jake Dalziel"), "Jake Dalziel");
  assertEquals(pseudoLu("@ Maître du Jeu"), "Maître du Jeu");
});

Deno.test("un libellé sans arobase traverse intact", () => {
  //  Le nettoyage ne doit pas dépendre du thème : un skin qui
  //  n'écrirait pas l'arobase doit rendre le même pseudo.
  assertEquals(pseudoLu("Erin Kavanagh"), "Erin Kavanagh");
  assertEquals(pseudoLu("  Winifred   Sainclair \n"), "Winifred Sainclair");
});

Deno.test("UNE SEULE AROBASE EST RETIRÉE, celle de tête", () => {
  //  Un pseudo peut en contenir une — « jean@rhode » est un pseudo
  //  possible —, et la lui retirer en ferait un autre nom.
  assertEquals(pseudoLu("@jean@rhode"), "jean@rhode");
});

Deno.test("rien à lire rend la chaîne vide, et pas « @ »", () => {
  //  `textContent` peut rendre `null`, et un pseudo vide doit être
  //  écarté par l'appelant — pas enregistré comme un nom d'une lettre.
  assertEquals(pseudoLu(null), "");
  assertEquals(pseudoLu(undefined), "");
  assertEquals(pseudoLu("@"), "");
  assertEquals(pseudoLu("   "), "");
});
