// ════════════════════════════════════════════════════════════════════
//  Le choix de la globale jQuery.
//
//  CE TEST EXISTE PARCE QUE LE BOUTON EST RESTÉ MUET UNE SOIRÉE. Sur le
//  forum, `window.$` est un objet écrasé par un script du thème, pendant
//  que `window.jQuery` est resté la vraie fonction. Partir de `$` faisait
//  tomber dans le repli en silence.
// ════════════════════════════════════════════════════════════════════

import { assertEquals } from "@std/assert";
import { jQueryDe } from "./editeur.ts";

const vraiJQuery = (): Record<string, never> => ({});

Deno.test("sans jQuery nulle part, on rend null plutôt que de deviner", () => {
  assertEquals(jQueryDe({}), null);
});

Deno.test("`jQuery` est pris avant `$`", () => {
  const autre = (): Record<string, never> => ({});
  assertEquals(jQueryDe({ jQuery: vraiJQuery, $: autre }), vraiJQuery);
});

Deno.test("un `$` écrasé en objet est ignoré, pas appelé", () => {
  // Le cas réel du 2 octobre : `$` existe, il est même truthy, mais
  // l'appeler lève. Le relevé du forum, à la lettre.
  const ecrase = { fn: { sceditor: false } };
  assertEquals(jQueryDe({ jQuery: vraiJQuery, $: ecrase }), vraiJQuery);
});

Deno.test("si seul `$` est utilisable, on s'en sert quand même", () => {
  // Un thème peut très bien n'exposer que `$`. On ne refuse pas par
  // principe : on refuse ce qui n'est pas appelable.
  assertEquals(jQueryDe({ $: vraiJQuery }), vraiJQuery);
});

Deno.test("une globale truthy mais pas appelable ne passe pas", () => {
  for (const faux of [{}, "jQuery", 1, [], true]) {
    assertEquals(jQueryDe({ jQuery: faux, $: faux }), null, String(faux));
  }
});
