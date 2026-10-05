// ════════════════════════════════════════════════════════════════════
//  Le panier d'un message.
//
//  La moitié de ces essais ne vérifient pas ce qui marche, mais ce qui
//  ne doit PAS passer : le bloc arrive d'un message public, et tout ce
//  qui le lit tourne ensuite en `security definer`.
// ════════════════════════════════════════════════════════════════════

import { assertEquals } from "@std/assert";
import { ecrireUnPanier, LIGNES_MAX, panierDe, QUANTITE_MAX, sansPaniers } from "./panier.ts";

const lignes = (lu: ReturnType<typeof panierDe>) => lu.type === "panier" ? lu.lignes : lu;

// ── la forme ────────────────────────────────────────────────────────

Deno.test("le bloc s'écrit et se relit à l'identique", () => {
  const panier = [{ objetId: 990001, quantite: 3 }, { objetId: 990002, quantite: 1 }];
  assertEquals(ecrireUnPanier(panier), "[[WM-PANIER:990001x3;990002x1]]");
  assertEquals(lignes(panierDe(ecrireUnPanier(panier))), panier);
});

Deno.test("le bloc se lit au milieu d'un message de joueur", () => {
  const texte =
    "Elle pousse la porte de la boutique.\n\n[[WM-PANIER:990001x5]]\n\nBonne journée !";
  assertEquals(lignes(panierDe(texte)), [{ objetId: 990001, quantite: 5 }]);
});

Deno.test("un message ordinaire ne commande rien", () => {
  for (const texte of ["", "Bonjour.", "[[WM-ACTION:fouiller]]", "[[WM:eyJ0IjoieHAifQ]]"]) {
    assertEquals(panierDe(texte).type, "aucun", texte);
  }
});

Deno.test("le texte du joueur survit au retrait du bloc", () => {
  assertEquals(sansPaniers("Avant [[WM-PANIER:1x2]] après"), "Avant  après");
  assertEquals(sansPaniers("Rien à retirer."), "Rien à retirer.");
});

// ── la règle du premier bloc ────────────────────────────────────────

Deno.test("LE PREMIER BLOC L'EMPORTE", () => {
  //  Sans cette règle, coller le bloc cinquante fois commanderait
  //  cinquante fois, et la limite de vingt lignes ne servirait à rien.
  const texte = "[[WM-PANIER:990001x1]] et puis [[WM-PANIER:990002x99]]";
  assertEquals(lignes(panierDe(texte)), [{ objetId: 990001, quantite: 1 }]);
});

// ── les doublons ────────────────────────────────────────────────────

Deno.test("DEUX LIGNES DU MÊME OBJET SONT ADDITIONNÉES", () => {
  //  `servir_commande` remplit le sac avec un seul `insert … on conflict
  //  do update`. PostgreSQL refuse qu'un même `insert` touche deux fois
  //  la même ligne : deux lignes pour le même objet feraient échouer la
  //  transaction entière.
  assertEquals(
    lignes(panierDe("[[WM-PANIER:7x2;7x3;9x1]]")),
    [{ objetId: 7, quantite: 5 }, { objetId: 9, quantite: 1 }],
  );
});

Deno.test("l'ordre de première apparition est conservé", () => {
  //  La réponse de la boutique les énumère : un ordre qui change d'un
  //  passage à l'autre donne l'impression que le serveur hésite.
  assertEquals(
    lignes(panierDe("[[WM-PANIER:9x1;7x1;9x1]]")),
    [{ objetId: 9, quantite: 2 }, { objetId: 7, quantite: 1 }],
  );
});

Deno.test("l'écriture fusionne aussi, pour ne jamais produire un bloc qu'on refuserait", () => {
  assertEquals(
    ecrireUnPanier([{ objetId: 7, quantite: 2 }, { objetId: 7, quantite: 3 }]),
    "[[WM-PANIER:7x5]]",
  );
});

// ── ce qu'on refuse, et pourquoi on le dit ──────────────────────────

Deno.test("un bloc illisible n'est PAS un message sans panier", () => {
  //  La différence coûte un joueur qui attend des objets qui
  //  n'arriveront jamais. La relève doit pouvoir répondre.
  const lu = panierDe("[[WM-PANIER:nimporte quoi]]");
  assertEquals(lu.type, "illisible");
  if (lu.type === "illisible") assertEquals(lu.motif.length > 0, true);
});

Deno.test("chaque refus nomme ce qu'il refuse", () => {
  const cas: readonly [string, string][] = [
    ["[[WM-PANIER:]]", "vide"],
    ["[[WM-PANIER:   ]]", "vide"],
    ["[[WM-PANIER:7]]", "ne se lit pas"],
    ["[[WM-PANIER:7x]]", "ne se lit pas"],
    ["[[WM-PANIER:x3]]", "ne se lit pas"],
    ["[[WM-PANIER:-7x3]]", "ne se lit pas"],
    ["[[WM-PANIER:7.5x3]]", "ne se lit pas"],
    ["[[WM-PANIER:7x3.5]]", "ne se lit pas"],
    ["[[WM-PANIER:0x3]]", "sans identifiant"],
    ["[[WM-PANIER:7x0]]", "quantité nulle"],
  ];
  for (const [texte, attendu] of cas) {
    const lu = panierDe(texte);
    assertEquals(lu.type, "illisible", texte);
    if (lu.type === "illisible") {
      assertEquals(lu.motif.includes(attendu), true, `${texte} → ${lu.motif}`);
    }
  }
});

Deno.test("UNE QUANTITÉ ABSURDE EST REFUSÉE AVANT LA BASE", () => {
  //  `quantite::int * prix` est un entier 32 bits côté PostgreSQL. Une
  //  quantité énorme le ferait déborder AVANT la vérification du solde :
  //  une erreur de base au lieu d'un refus lisible.
  assertEquals(panierDe(`[[WM-PANIER:7x${QUANTITE_MAX}]]`).type, "panier");
  assertEquals(panierDe(`[[WM-PANIER:7x${QUANTITE_MAX + 1}]]`).type, "illisible");
  assertEquals(panierDe("[[WM-PANIER:7x999]]").type, "illisible");
});

Deno.test("LA BORNE NE SE CONTOURNE PAS EN DÉDOUBLANT LA LIGNE", () => {
  //  `7x60;7x60` fait 120 après fusion. On revérifie donc APRÈS, et pas
  //  seulement à la lecture de chaque morceau — c'est précisément le
  //  genre de trou qu'une borne posée trop tôt laisse ouvert.
  assertEquals(panierDe("[[WM-PANIER:7x60;7x60]]").type, "illisible");
  assertEquals(panierDe("[[WM-PANIER:7x50;7x49]]").type, "panier");
});

Deno.test("un panier trop long est refusé", () => {
  const trop = Array.from({ length: LIGNES_MAX + 1 }, (_, i) => `${i + 1}x1`).join(";");
  assertEquals(panierDe(`[[WM-PANIER:${trop}]]`).type, "illisible");
  const juste = Array.from({ length: LIGNES_MAX }, (_, i) => `${i + 1}x1`).join(";");
  assertEquals(panierDe(`[[WM-PANIER:${juste}]]`).type, "panier");
});

Deno.test("les espaces autour des morceaux sont tolérés", () => {
  //  Un éditeur peut en glisser ; ça ne change pas ce qui est demandé.
  assertEquals(
    lignes(panierDe("[[WM-PANIER: 7x2 ; 9x1 ]]")),
    [{ objetId: 7, quantite: 2 }, { objetId: 9, quantite: 1 }],
  );
});

Deno.test("un morceau vide entre deux points-virgules est ignoré, pas refusé", () => {
  //  `7x2;;9x1` est une faute de frappe de notre propre écriture, pas une
  //  demande incompréhensible.
  assertEquals(
    lignes(panierDe("[[WM-PANIER:7x2;;9x1]]")),
    [{ objetId: 7, quantite: 2 }, { objetId: 9, quantite: 1 }],
  );
});

Deno.test("AUCUN PRIX NE PASSE PAR LE BLOC", () => {
  //  La règle qui tient toute la sécurité de la boutique : le bloc dit
  //  quoi et combien, jamais à quel prix. Un troisième champ ne doit pas
  //  se lire comme un prix — il ne doit pas se lire du tout.
  assertEquals(panierDe("[[WM-PANIER:7x2x1]]").type, "illisible");
  assertEquals(panierDe("[[WM-PANIER:7x2:0]]").type, "illisible");
});
