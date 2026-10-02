// ════════════════════════════════════════════════════════════════════
//  src/domaine/code.test.ts
// ════════════════════════════════════════════════════════════════════

import { assert, assertEquals, assertThrows } from "@std/assert";
import {
  ALPHABET,
  codeDepuisEmpreinte,
  codeValide,
  EmpreinteInvalide,
  memeCode,
} from "./code.ts";

function empreinte(...valeurs: number[]): Uint8Array {
  return new Uint8Array(valeurs);
}

Deno.test("l'alphabet n'a aucun symbole qui se confond à la lecture", () => {
  for (const interdit of ["O", "0", "I", "1", "S", "5", "B", "8", "Z", "2"]) {
    assert(!ALPHABET.includes(interdit), `${interdit} ne devrait pas être dans l'alphabet`);
  }
  assertEquals(new Set(ALPHABET).size, ALPHABET.length, "un symbole apparaît deux fois");
});

Deno.test("la forme est WM-XXXX-XXX", () => {
  const c = codeDepuisEmpreinte(empreinte(0, 1, 2, 3, 4, 5, 6));
  assertEquals(c, "WM-ACDE-FGH");
  assert(codeValide(c));
});

Deno.test("le modulo ramène les octets dans l'alphabet", () => {
  // 255 % 26 = 21, et le 22e symbole de l'alphabet est « 3 »
  assertEquals(
    codeDepuisEmpreinte(empreinte(255, 255, 255, 255, 255, 255, 255)),
    "WM-3333-333",
  );
  assertEquals(codeDepuisEmpreinte(empreinte(26, 52, 0, 1, 2, 3, 4)), "WM-AAAC-DEF");
});

Deno.test("deux fois la même empreinte, deux fois le même code", () => {
  const e = empreinte(9, 44, 180, 7, 250, 31, 66, 99);
  assertEquals(codeDepuisEmpreinte(e), codeDepuisEmpreinte(e));
});

Deno.test("les octets au-delà du septième sont ignorés", () => {
  const court = empreinte(1, 2, 3, 4, 5, 6, 7);
  const long = empreinte(1, 2, 3, 4, 5, 6, 7, 200, 201, 202);
  assertEquals(codeDepuisEmpreinte(court), codeDepuisEmpreinte(long));
});

Deno.test("refuse une empreinte trop courte", () => {
  assertThrows(() => codeDepuisEmpreinte(empreinte(1, 2, 3)), EmpreinteInvalide);
  assertThrows(() => codeDepuisEmpreinte(empreinte()), EmpreinteInvalide);
});

Deno.test("codeValide · accepte une vraie forme, refuse le reste", () => {
  assert(codeValide("WM-ACDE-FGH"));
  assert(!codeValide("WM-ACDE-FG"), "trop court");
  assert(!codeValide("WM-ACDEF-GH"), "mal découpé");
  assert(!codeValide("XX-ACDE-FGH"), "mauvais préfixe");
  assert(!codeValide("WM-ACDE-FG0"), "contient un zéro");
  assert(!codeValide("WM-acde-fgh"), "minuscules");
  assert(!codeValide(""), "vide");
  assert(!codeValide(" WM-ACDE-FGH "), "espaces autour");
});

Deno.test("memeCode · pardonne la casse et les espaces recopiés à la main", () => {
  assert(memeCode("WM-ACDE-FGH", " wm-acde-fgh "));
  assert(!memeCode("WM-ACDE-FGH", "WM-ACDE-FGJ"));
});
