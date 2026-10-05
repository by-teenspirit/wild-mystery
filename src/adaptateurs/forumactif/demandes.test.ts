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
import {
  actionsDemandees,
  demandeLaCloture,
  demandesDeCloture,
  paniersPoses,
} from "./demandes.ts";

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

// ── les actions, tranchées le 2 octobre ─────────────────────────────

Deno.test("une action est rattachée à son message et à son auteur", () => {
  // `messageId` est la graine du tirage : s'il se perd ici, la rencontre
  // n'est plus rejouable et une contestation ne se tranche plus.
  const lues = actionsDemandees([
    { id: 15546, auteurId: 4, auteurPseudo: "Compte de test", corps: "Elle avance." },
    {
      id: 15547,
      auteurId: 4,
      auteurPseudo: "Compte de test",
      corps: "Elle fouille les herbes.\n\n[[WM-ACTION:fouiller]]",
    },
  ]);
  assertEquals(lues.length, 1);
  assertEquals(lues[0], {
    messageId: 15547,
    auteurId: 4,
    auteurPseudo: "Compte de test",
    action: { type: "fouiller" },
  });
});

Deno.test("les actions sortent dans l'ordre où elles ont été postées", () => {
  const lues = actionsDemandees([
    { id: 30, auteurId: 7, auteurPseudo: "C", corps: "[[WM-ACTION:fouiller]]" },
    { id: 10, auteurId: 5, auteurPseudo: "A", corps: "[[WM-ACTION:chercher:berge-est]]" },
    { id: 20, auteurId: 6, auteurPseudo: "B", corps: "[[WM-ACTION:fouiller]]" },
  ]);
  assertEquals(lues.map((l) => l.messageId), [10, 20, 30]);
});

Deno.test("un message qui ne demande rien ne déclenche rien", () => {
  assertEquals(
    actionsDemandees([
      { id: 1, auteurId: 4, auteurPseudo: "A", corps: "Le vent se lève." },
    ]),
    [],
  );
});

Deno.test("une demande de clôture n'est pas une action, et réciproquement", () => {
  // Les deux blocs cohabitent dans un sujet. Les confondre ferait
  // clôturer une fouille, ou fouiller une clôture.
  const messages = [
    { id: 1, auteurId: 4, auteurPseudo: "A", corps: "[cloture]" },
    { id: 2, auteurId: 4, auteurPseudo: "A", corps: "[[WM-ACTION:fouiller]]" },
  ];
  assertEquals(actionsDemandees(messages).map((l) => l.messageId), [2]);
  assertEquals(demandesDeCloture(messages).map((d) => d.messageId), [1]);
});

// ── les paniers de boutique ─────────────────────────────────────────

Deno.test("un panier posé est rattaché à son auteur", () => {
  const lus = paniersPoses([
    {
      id: 15551,
      auteurId: 7,
      auteurPseudo: "Anna",
      corps: "Je prends ça. [[WM-PANIER:990080x2;990020x3]]",
    },
  ]);

  assertEquals(lus.length, 1);
  assertEquals(lus[0].messageId, 15551);
  assertEquals(lus[0].auteurId, 7);
  assertEquals(lus[0].auteurPseudo, "Anna");
  assert(lus[0].panier.type === "panier");
  assertEquals(lus[0].panier.lignes, [
    { objetId: 990080, quantite: 2 },
    { objetId: 990020, quantite: 3 },
  ]);
});

Deno.test("un message sans bloc n'est pas une commande", () => {
  assertEquals(
    paniersPoses([
      { id: 1, auteurId: 4, auteurPseudo: "A", corps: "Bonjour la boutique !" },
    ]),
    [],
  );
});

Deno.test("UN PANIER ILLISIBLE REMONTE, lui", () => {
  //  C'est la distinction que l'en-tête de `domaine/panier.ts` pose
  //  exprès : rater une fouille coûte un tour, rater une commande laisse
  //  un joueur attendre des objets qui n'arriveront jamais. Le silence
  //  n'est donc pas une option.
  const lus = paniersPoses([
    { id: 15551, auteurId: 7, auteurPseudo: "Anna", corps: "[[WM-PANIER:990080xdeux]]" },
  ]);

  assertEquals(lus.length, 1);
  assert(lus[0].panier.type === "illisible");
  assert(lus[0].panier.motif.length > 0, "un refus sans motif ne sert à rien");
});

Deno.test("les paniers sortent dans l'ordre des messages", () => {
  //  L'ORDRE EST CONTRACTUEL ICI, pas un confort : la relève avance son
  //  curseur message par message et s'arrête au premier reçu qui ne part
  //  pas. Traiter le 15 552 d'abord perdrait le reçu du 15 551.
  const lus = paniersPoses([
    { id: 15553, auteurId: 7, auteurPseudo: "C", corps: "[[WM-PANIER:990020x1]]" },
    { id: 15551, auteurId: 5, auteurPseudo: "A", corps: "[[WM-PANIER:990080x1]]" },
    { id: 15552, auteurId: 6, auteurPseudo: "B", corps: "[[WM-PANIER:990021x1]]" },
  ]);
  assertEquals(lus.map((l) => l.messageId), [15551, 15552, 15553]);
});

Deno.test("un panier n'est ni une action ni une clôture", () => {
  //  Les trois blocs peuvent cohabiter dans un même sujet de service.
  //  Les confondre ferait facturer une fouille.
  const messages = [
    { id: 1, auteurId: 4, auteurPseudo: "A", corps: "[cloture]" },
    { id: 2, auteurId: 4, auteurPseudo: "A", corps: "[[WM-ACTION:fouiller]]" },
    { id: 3, auteurId: 4, auteurPseudo: "A", corps: "[[WM-PANIER:990020x1]]" },
  ];
  assertEquals(paniersPoses(messages).map((l) => l.messageId), [3]);
  assertEquals(actionsDemandees(messages).map((l) => l.messageId), [2]);
  assertEquals(demandesDeCloture(messages).map((d) => d.messageId), [1]);
});
