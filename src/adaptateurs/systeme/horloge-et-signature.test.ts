// ════════════════════════════════════════════════════════════════════
//  src/adaptateurs/systeme/horloge-et-signature.test.ts
//
//  Ce qui compte ici : le code de vérification doit être **reproductible
//  et infalsifiable**. Reproductible, pour qu'un litige se rejoue des mois
//  plus tard et redonne le même code. Infalsifiable, pour qu'un joueur ne
//  puisse pas écrire « WM-… » au hasard dans son message et se faire
//  créditer d'une capture.
// ════════════════════════════════════════════════════════════════════

import { assert, assertEquals, assertNotEquals, assertThrows } from "@std/assert";
import { codeDepuisEmpreinte, codeValide } from "../../domaine/code.ts";
import {
  HorlogeFigee,
  HorlogeSysteme,
  SecretManquant,
  SignataireHmac,
} from "./horloge-et-signature.ts";

const SECRET = "ceci-est-un-faux-secret-de-test";

// ── l'horloge ───────────────────────────────────────────────────────

Deno.test("l'horloge système avance", async () => {
  const h = new HorlogeSysteme();
  const avant = h.maintenant().getTime();
  await new Promise((r) => setTimeout(r, 5));
  assert(h.maintenant().getTime() >= avant);
});

Deno.test("l'horloge figée ne bouge pas, et ne se laisse pas modifier", () => {
  const instant = new Date("2026-10-02T12:00:00Z");
  const h = new HorlogeFigee(instant);
  assertEquals(h.maintenant().toISOString(), "2026-10-02T12:00:00.000Z");

  // Elle rend une COPIE : sinon l'appelant pourrait décaler l'horloge de
  // tout le monde en modifiant la date qu'il a reçue.
  h.maintenant().setFullYear(1999);
  assertEquals(h.maintenant().toISOString(), "2026-10-02T12:00:00.000Z");
  instant.setFullYear(1999);
  assertEquals(h.maintenant().getFullYear(), 2026, "la date passée au constructeur non plus");
});

// ── la signature ────────────────────────────────────────────────────

Deno.test("un secret vide est refusé à la construction", () => {
  for (const vide of ["", "   ", "\n"]) {
    assertThrows(() => new SignataireHmac(vide), SecretManquant);
  }
});

Deno.test("la même entrée donne la même empreinte, toujours", async () => {
  const s = new SignataireHmac(SECRET);
  const a = await s.empreinte("message:8001|Lisière de Samaragd");
  const b = await s.empreinte("message:8001|Lisière de Samaragd");
  assertEquals([...a], [...b]);
  assertEquals(a.length, 32, "HMAC-SHA-256 fait 32 octets");
});

Deno.test("deux signataires avec le même secret s'accordent", async () => {
  // Autrement, rejouer un litige après un redémarrage donnerait un autre
  // code, et la vérification deviendrait inutilisable.
  const a = await new SignataireHmac(SECRET).empreinte("message:8001");
  const b = await new SignataireHmac(SECRET).empreinte("message:8001");
  assertEquals([...a], [...b]);
});

Deno.test("un message différent donne une empreinte différente", async () => {
  const s = new SignataireHmac(SECRET);
  const a = await s.empreinte("message:8001");
  const b = await s.empreinte("message:8002");
  assertNotEquals([...a], [...b]);
});

Deno.test("un AUTRE secret donne une autre empreinte — c'est tout l'intérêt", async () => {
  const vrai = await new SignataireHmac(SECRET).empreinte("message:8001");
  const faux = await new SignataireHmac("secret-devine-par-un-joueur").empreinte(
    "message:8001",
  );
  assertNotEquals([...vrai], [...faux]);
});

Deno.test("l'empreinte donne un code valide au sens du domaine", async () => {
  const s = new SignataireHmac(SECRET);
  for (const message of ["message:8001", "message:9999|Berge Est", "cloture:7000"]) {
    const code = codeDepuisEmpreinte(await s.empreinte(message));
    assert(codeValide(code), `${message} → ${code}`);
  }
});

Deno.test("le code reste le même d'un appel à l'autre", async () => {
  const s = new SignataireHmac(SECRET);
  const un = codeDepuisEmpreinte(await s.empreinte("cloture:7000"));
  const deux = codeDepuisEmpreinte(await s.empreinte("cloture:7000"));
  assertEquals(un, deux);
});

Deno.test("deux sujets ne tombent pas sur le même code", async () => {
  const s = new SignataireHmac(SECRET);
  const codes = new Set<string>();
  for (let sujet = 7000; sujet < 7100; sujet++) {
    codes.add(codeDepuisEmpreinte(await s.empreinte(`cloture:${sujet}`)));
  }
  // 26^7 possibilités : cent codes distincts, sans collision, est attendu.
  assertEquals(codes.size, 100);
});
