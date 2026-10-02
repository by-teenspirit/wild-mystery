// ════════════════════════════════════════════════════════════════════
//  src/adaptateurs/forumactif/demandes.test.ts
//
//  Deux erreurs possibles, et elles ne coûtent pas la même chose.
//
//  Ne pas reconnaître une demande : le joueur reclique, agacé.
//  Reconnaître une demande qui n'existe pas : un sujet se clôture alors que
//  personne ne l'a voulu, l'inventaire est débité, et c'est irréversible.
//
//  D'où l'asymétrie assumée : tolérant sur la casse, les accents et les
//  espaces ; intransigeant sur tout ce qui n'est pas le mot seul entre
//  crochets.
// ════════════════════════════════════════════════════════════════════

import { assert, assertEquals } from "@std/assert";
import { demandeLaCloture, demandesDeCloture } from "./demandes.ts";

// ── ce qui compte comme une demande ─────────────────────────────────

Deno.test("les formes que le bouton et les doigts produisent", () => {
  for (
    const forme of [
      "[cloture]",
      "[clôture]",
      "[Cloture]",
      "[CLÔTURE]",
      "[ cloture ]",
      '<div class="postbody">Voilà, c\'est fini.<br>[cloture]</div>',
      "[b][cloture][/b]",
    ]
  ) {
    assert(demandeLaCloture(forme), `devrait compter : ${forme}`);
  }
});

// ── ce qui ne compte pas ────────────────────────────────────────────

Deno.test("une phrase qui parle de clôture ne clôture rien", () => {
  for (
    const forme of [
      "J'aimerais bien la cloture de ce sujet",
      "on fera la clôture demain",
      "cloture",
      "[clotures]",
      "[cloture=hier]",
      "[cloturer]",
      "[/cloture]",
      "[clo ture]",
      "",
    ]
  ) {
    assertEquals(demandeLaCloture(forme), false, `ne devrait pas compter : ${forme}`);
  }
});

Deno.test("le marqueur du serveur n'est pas une demande du joueur", () => {
  // `[[WM:…]]` est écrit par la relève. Si elle le prenait pour une
  // demande, chaque bilan posté relancerait une clôture.
  assertEquals(demandeLaCloture("[[WM:eyJhIjoxfQ:WM-7K4P-9QX]]"), false);
});

// ── une seule demande par passage ───────────────────────────────────

type MessageDeTest = {
  readonly id: number;
  readonly auteurId: number;
  readonly auteurPseudo: string;
  readonly corps: string;
};

function message(
  id: number,
  auteurId: number,
  pseudo: string,
  corps: string,
): MessageDeTest {
  return { id, auteurId, auteurPseudo: pseudo, corps };
}

Deno.test("aucune demande dans le sujet : liste vide", () => {
  assertEquals(
    demandesDeCloture([
      message(8001, 3, "Anna", "Elle avance dans les hautes herbes."),
      message(8002, 4, "Boris", "Il la suit."),
    ]),
    [],
  );
});

Deno.test("une demande rend son message, son auteur et son pseudo", () => {
  assertEquals(
    demandesDeCloture([
      message(8001, 3, "Anna", "Elle avance."),
      message(8002, 4, "Boris", "Bon, on arrête là. [cloture]"),
    ]),
    [{ messageId: 8002, auteurId: 4, auteurPseudo: "Boris" }],
  );
});

Deno.test("deux joueurs qui cliquent : seule la PREMIÈRE demande compte", () => {
  // Répondre deux fois produirait deux bilans contradictoires dans le fil.
  assertEquals(
    demandesDeCloture([
      message(8003, 4, "Boris", "[cloture]"),
      message(8002, 3, "Anna", "[cloture]"),
    ]),
    [{ messageId: 8002, auteurId: 3, auteurPseudo: "Anna" }],
  );
});

Deno.test("l'ordre des identifiants prime sur l'ordre de la liste", () => {
  const r = demandesDeCloture([
    message(9000, 5, "Tard", "[cloture]"),
    message(8000, 6, "Tot", "[clôture]"),
    message(8500, 7, "Milieu", "[cloture]"),
  ]);
  assertEquals(r.length, 1);
  assertEquals(r[0].auteurPseudo, "Tot");
});
