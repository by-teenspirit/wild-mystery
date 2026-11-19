// ════════════════════════════════════════════════════════════════════
//  La lecture du numéro d'espèce dans une adresse de sprite.
//
//  LE RESTE DU MODULE EST DU DOM, et c'est `outils/sujet.mjs` qui le
//  mesure, sur de vraies cartes rendues par le vrai paquet. Ici on
//  tient la seule règle qui se raisonne sans navigateur : ce qui est
//  un numéro d'espèce, et ce qui n'en est pas un.
// ════════════════════════════════════════════════════════════════════

import { assertEquals } from "@std/assert";
import { especeDeLAdresse, pvDuTexte } from "./module-combat.ts";

Deno.test("LE NUMÉRO SE LIT DANS NOS DEUX FORMES", () => {
  assertEquals(
    especeDeLAdresse("https://exemple.test/assets/sprites-figes/forum/37.png"),
    37,
  );
  //  L'ANIMÉ VIENT DE CHEZ POKEAPI, et il finit en `.gif`.
  assertEquals(
    especeDeLAdresse(
      "https://raw.githubusercontent.com/PokeAPI/sprites/abc/sprites/pokemon/" +
        "versions/generation-v/black-white/animated/104.gif",
    ),
    104,
  );
});

Deno.test("UNE CARTE DE 2026-10 SE LIT ENCORE — c'est tout l'intérêt", () => {
  //  L'adresse morte d'un message posté avant le 7 octobre : jsDelivr
  //  a figé l'alias de branche sur un commit et ne le réévalue jamais.
  //  Le NUMÉRO, lui, est toujours là.
  assertEquals(
    especeDeLAdresse(
      "https://cdn.jsdelivr.net/gh/by-teenspirit/wild-mystery@socle-v2/" +
        "assets/sprites-figes/forum/21.png",
    ),
    21,
  );
});

Deno.test("UN PARAMÈTRE DE REQUÊTE NE CACHE PAS LE NUMÉRO", () => {
  assertEquals(especeDeLAdresse("/assets/sprites-figes/forum/25.png?v=2"), 25);
  assertEquals(especeDeLAdresse("/assets/sprites-figes/forum/25.png#x"), 25);
});

Deno.test("CE QUI N'EST PAS UNE ESPÈCE N'EN DEVIENT PAS UNE", () => {
  //  Une autre extension : ce n'est pas une de nos adresses.
  assertEquals(especeDeLAdresse("/assets/zones/37.jpg"), null);
  //  Un nombre qui n'est pas le dernier segment.
  assertEquals(especeDeLAdresse("/assets/37/sprite.png"), null);
  //  Zéro n'est pas un numéro d'espèce, et un nom non plus.
  assertEquals(especeDeLAdresse("/assets/sprites-figes/forum/0.png"), null);
  assertEquals(especeDeLAdresse("/assets/sprites-figes/forum/goupix.png"), null);
  assertEquals(especeDeLAdresse(""), null);
});

// ── LES PV LUS DANS UNE CARTE DÉJÀ POSTÉE ───────────────────────────
//
//  La jauge des cartes anciennes se calcule sur le chiffre écrit dans
//  le message : c'est tout ce qu'on a. Ce qu'on ne reconnaît pas ne
//  devient pas une barre approximative.

Deno.test("LES DEUX FORMES DE PV SE LISENT", () => {
  assertEquals(pvDuTexte("18/24 PV"), { pv: 18, max: 24 });
  //  LE SAUVAGE ENTIER N'A PAS DE MAXIMUM : il est à son plein, donc
  //  la barre est pleine. C'est le cas des cartes de rencontre.
  assertEquals(pvDuTexte("30 PV"), { pv: 30, max: 30 });
  //  Les espaces d'un éditeur qui recopie.
  assertEquals(pvDuTexte("  18 / 24 PV  "), { pv: 18, max: 24 });
  //  Zéro PV est un vrai état, pas une lecture ratée.
  assertEquals(pvDuTexte("0/24 PV"), { pv: 0, max: 24 });
});

Deno.test("CE QU'ON NE RECONNAÎT PAS NE DEVIENT PAS UNE JAUGE", () => {
  assertEquals(pvDuTexte("niv. 12"), null);
  assertEquals(pvDuTexte(""), null);
  assertEquals(pvDuTexte("quelques PV"), null);
  //  Un maximum à zéro est une division par zéro, pas une barre vide.
  assertEquals(pvDuTexte("0/0 PV"), null);
});
