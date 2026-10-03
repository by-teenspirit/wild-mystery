// ════════════════════════════════════════════════════════════════════
//  src/domaine/alea.test.ts
//
//  Ce qui compte ici n'est pas que les nombres soient « bien au
//  hasard », c'est qu'ils soient TOUJOURS LES MÊMES. Les valeurs
//  attendues sont donc figées : si elles changent, un tirage rejoué
//  ne donnerait plus le même résultat, et tout l'arbitrage s'écroule.
// ════════════════════════════════════════════════════════════════════

import { assert, assertEquals, assertThrows } from "@std/assert";
import { entreBornes, graineDepuis, GraineInvalide, suiteAleatoire } from "./alea.ts";

Deno.test("graineDepuis · deux fois le même texte, deux fois la même graine", () => {
  assertEquals(
    graineDepuis("sujet:7000|message:8001"),
    graineDepuis("sujet:7000|message:8001"),
  );
});

Deno.test("graineDepuis · un caractère de différence change tout", () => {
  const a = graineDepuis("message:8001");
  const b = graineDepuis("message:8002");
  assert(a !== b, "deux messages voisins ne doivent pas partager leur graine");
});

Deno.test("graineDepuis · reste un entier 32 bits non signé", () => {
  for (const t of ["", "a", "Forêt Marécageuse", "x".repeat(500)]) {
    const g = graineDepuis(t);
    assert(Number.isInteger(g), `${t} : pas un entier`);
    assert(g >= 0 && g <= 0xffffffff, `${t} : hors de 32 bits`);
  }
});

Deno.test("suiteAleatoire · la suite est figée", () => {
  // Valeurs relevées à la première exécution et gelées volontairement.
  // Si ce test casse, c'est que l'algorithme a changé : tous les
  // tirages déjà joués deviendraient irreproductibles.
  const tirage = suiteAleatoire(12345);
  const trois = [tirage(), tirage(), tirage()].map((x) => Math.floor(x * 1e9));
  assertEquals(trois, [979728267, 306752264, 484205421]);
});

Deno.test("suiteAleatoire · même graine, même suite", () => {
  const a = suiteAleatoire(99);
  const b = suiteAleatoire(99);
  for (let i = 0; i < 20; i++) assertEquals(a(), b());
});

Deno.test("suiteAleatoire · graines différentes, suites différentes", () => {
  const a = suiteAleatoire(1)();
  const b = suiteAleatoire(2)();
  assert(a !== b);
});

Deno.test("suiteAleatoire · reste dans [0, 1[", () => {
  const tirage = suiteAleatoire(7);
  for (let i = 0; i < 1000; i++) {
    const x = tirage();
    assert(x >= 0 && x < 1, `sorti des bornes : ${x}`);
  }
});

Deno.test("suiteAleatoire · refuse une graine qui n'est pas un entier positif", () => {
  for (const mauvaise of [-1, 1.5, NaN]) {
    assertThrows(() => suiteAleatoire(mauvaise), GraineInvalide);
  }
});

Deno.test("entreBornes · atteint les deux extrémités et ne les dépasse pas", () => {
  assertEquals(entreBornes(0, 5, 10), 5);
  assertEquals(entreBornes(0.999999, 5, 10), 10);
  assertEquals(entreBornes(0.5, 5, 10), 8); // 5 + floor(0,5 × 6)
});

Deno.test("entreBornes · un intervalle d'un seul niveau rend ce niveau", () => {
  assertEquals(entreBornes(0.42, 12, 12), 12);
});

Deno.test("entreBornes · couvre tout l'intervalle, sans trou ni débordement", () => {
  const vus = new Set<number>();
  const tirage = suiteAleatoire(2024);
  for (let i = 0; i < 2000; i++) vus.add(entreBornes(tirage(), 6, 10));
  assertEquals([...vus].sort((a, b) => a - b), [6, 7, 8, 9, 10]);
});

Deno.test("entreBornes · refuse un intervalle à l'envers ou un tirage hors bornes", () => {
  assertThrows(() => entreBornes(0.5, 10, 5), GraineInvalide);
  assertThrows(() => entreBornes(1, 1, 10), GraineInvalide);
  assertThrows(() => entreBornes(-0.1, 1, 10), GraineInvalide);
  assertThrows(() => entreBornes(0.5, 1.5, 10), GraineInvalide);
});
