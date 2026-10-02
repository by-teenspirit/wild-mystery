// ════════════════════════════════════════════════════════════════════
//  src/domaine/experience.test.ts
//
//  Les valeurs attendues sont RECOPIÉES À LA MAIN depuis l'annexe 08.
//  Elles ne sont jamais recalculées par le test : un test qui refait
//  le calcul du code ne teste rien.
// ════════════════════════════════════════════════════════════════════

import { assertEquals, assertThrows } from "@std/assert";
import {
  BAREME,
  DegatsInvalides,
  experienceGagnee,
  monterNiveaux,
  multiplicateur,
  NiveauInvalide,
  seuil,
} from "./experience.ts";

// ── le barème, écrit à la main depuis l'annexe ──────────────────────
Deno.test("le barème compte une entrée par dizaine, jusqu'à 100", () => {
  // multiplicateur() indexe le barème sans cas par défaut : si cette
  // taille change sans que le découpage change, il sortirait du tableau.
  assertEquals(BAREME.length, 10);
});

Deno.test("multiplicateur · les dix paliers de l'annexe 08", () => {
  const attendu: ReadonlyArray<[number, number]> = [
    [1, 4],
    [10, 4],
    [11, 3],
    [20, 3],
    [21, 2],
    [30, 2],
    [31, 1.5],
    [40, 1.5],
    [41, 1],
    [50, 1],
    [51, 1 / 1.5],
    [60, 1 / 1.5],
    [61, 0.5],
    [70, 0.5],
    [71, 1 / 3],
    [80, 1 / 3],
    [81, 0.25],
    [90, 0.25],
    [91, 0.2],
    [100, 0.2],
  ];
  for (const [niveau, facteur] of attendu) {
    assertEquals(multiplicateur(niveau), facteur, `niveau ${niveau}`);
  }
});

Deno.test("multiplicateur · les bornes de palier ne se chevauchent pas", () => {
  // Le passage 10 → 11 doit changer de palier, pas 9 → 10.
  assertEquals(multiplicateur(9), multiplicateur(10));
  assertEquals(multiplicateur(10) === multiplicateur(11), false);
});

Deno.test("multiplicateur · refuse ce qui n'est pas un niveau", () => {
  for (const mauvais of [0, 101, -1, 1.5, NaN]) {
    assertThrows(() => multiplicateur(mauvais), NiveauInvalide);
  }
});

// ── l'expérience ────────────────────────────────────────────────────
Deno.test("experienceGagnee · dégâts × multiplicateur, arrondi", () => {
  assertEquals(experienceGagnee(40, 5), 160); // ×4
  assertEquals(experienceGagnee(40, 25), 80); // ×2
  assertEquals(experienceGagnee(40, 45), 40); // inchangé
  assertEquals(experienceGagnee(40, 95), 8); // ÷5
});

Deno.test("experienceGagnee · le tiers et le tiers et demi s'arrondissent", () => {
  // 40 ÷ 1,5 = 26,66… → 27 ; 40 ÷ 3 = 13,33… → 13
  assertEquals(experienceGagnee(40, 55), 27);
  assertEquals(experienceGagnee(40, 75), 13);
});

Deno.test("experienceGagnee · zéro dégât ne rapporte rien", () => {
  assertEquals(experienceGagnee(0, 1), 0);
});

Deno.test("experienceGagnee · refuse les dégâts négatifs ou décimaux", () => {
  assertThrows(() => experienceGagnee(-1, 10), DegatsInvalides);
  assertThrows(() => experienceGagnee(1.5, 10), DegatsInvalides);
});

// ── les seuils ──────────────────────────────────────────────────────
Deno.test("seuil · valeurs calculées à la main", () => {
  assertEquals(seuil(1), 0); // on commence à zéro
  assertEquals(seuil(2), 300); // 100 × 2 × 3 ÷ 2
  assertEquals(seuil(3), 600); // 100 × 3 × 4 ÷ 2
  assertEquals(seuil(10), 5500); // 100 × 10 × 11 ÷ 2
  assertEquals(seuil(100), 505000); // 100 × 100 × 101 ÷ 2
});

Deno.test("seuil · croît strictement", () => {
  for (let n = 2; n <= 100; n++) {
    if (seuil(n) <= seuil(n - 1)) throw new Error(`seuil(${n}) ne croît pas`);
  }
});

// ── les montées de niveau ───────────────────────────────────────────
Deno.test("monterNiveaux · ne monte pas sous le seuil", () => {
  assertEquals(monterNiveaux(1, 299), { niveau: 1, gagnes: 0 });
});

Deno.test("monterNiveaux · monte pile au seuil", () => {
  assertEquals(monterNiveaux(1, 300), { niveau: 2, gagnes: 1 });
});

Deno.test("monterNiveaux · franchit plusieurs niveaux d'un coup", () => {
  // 5500 est le seuil du niveau 10 : d'un seul versement, on y va.
  assertEquals(monterNiveaux(1, 5500), { niveau: 10, gagnes: 9 });
});

Deno.test("monterNiveaux · s'arrête à 100 et n'explose pas", () => {
  assertEquals(monterNiveaux(99, 999_999_999), { niveau: 100, gagnes: 1 });
  assertEquals(monterNiveaux(100, 999_999_999), { niveau: 100, gagnes: 0 });
});

Deno.test("monterNiveaux · refuse une expérience négative", () => {
  assertThrows(() => monterNiveaux(10, -1), DegatsInvalides);
});
