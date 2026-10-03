// ════════════════════════════════════════════════════════════════════
//  src/application/bilan.test.ts
//
//  Ce texte est le seul message que la relève publie pour une clôture, et
//  il restera dans le sujet pour toujours. On le teste donc comme un
//  livrable, pas comme un détail : son contenu, son ordre, et ce qu'il ne
//  dit PAS quand il n'y a rien à dire.
// ════════════════════════════════════════════════════════════════════

import { assert, assertEquals } from "@std/assert";
import { type LigneDeBilan, pokedollars, redigerLeBilan, redigerLeRefus } from "./bilan.ts";

function ligne(partiel: Partial<LigneDeBilan> = {}): LigneDeBilan {
  return {
    pseudo: "Calliste Vanne",
    captures: [],
    experience: [],
    ajoutes: [],
    consommes: [],
    croisees: [],
    pokedollarsAvant: 1000,
    pokedollarsApres: 1000,
    ...partiel,
  };
}

// ── les pokédollars ─────────────────────────────────────────────────

Deno.test("pokedollars · milliers séparés, comme dans la maquette", () => {
  assertEquals(pokedollars(0), "0");
  assertEquals(pokedollars(350), "350");
  assertEquals(pokedollars(1240), "1 240");
  assertEquals(pokedollars(1590), "1 590");
  assertEquals(pokedollars(1234567), "1 234 567");
  assertEquals(pokedollars(-250), "-250");
});

// ── le bilan ────────────────────────────────────────────────────────

Deno.test("le bilan nomme chaque rubrique qui a quelque chose à dire", () => {
  const texte = redigerLeBilan([
    ligne({
      captures: [{ espece: "Farfuret", niveau: 19 }],
      experience: [{ pokemon: "Galopa", gain: 180 }, { pokemon: "Goupix", gain: 240 }],
      ajoutes: [{ objet: "Pierre Feu", quantite: 1 }],
      consommes: [{ objet: "Poké Ball", quantite: 2 }],
      croisees: ["Stalgamin"],
      pokedollarsAvant: 1240,
      pokedollarsApres: 1590,
    }),
  ], "WM-7K4P-9QX");

  assert(texte.includes("CAPTURÉ : Farfuret niv. 19"), texte);
  assert(texte.includes("CROISÉ : Stalgamin"), texte);
  assert(texte.includes("EXPÉRIENCE : Galopa +180 · Goupix +240"), texte);
  assert(texte.includes("AJOUTÉ AU SAC : 1 Pierre Feu"), texte);
  assert(texte.includes("CONSOMMÉ : 2 Poké Ball"), texte);
  assert(texte.includes("POKÉDOLLARS : 1 240 → 1 590"), texte);
  assert(texte.includes("CODE : WM-7K4P-9QX"), texte);
});

Deno.test("une rubrique vide n'est pas écrite", () => {
  // Un bilan ne doit pas être une liste de « aucun » qu'il faut lire en
  // entier pour trouver les deux lignes qui comptent.
  const texte = redigerLeBilan([
    ligne({ experience: [{ pokemon: "Galopa", gain: 180 }] }),
  ], "WM-7K4P-9QX");

  assert(texte.includes("EXPÉRIENCE"), texte);
  assertEquals(texte.includes("CAPTURÉ"), false, texte);
  assertEquals(texte.includes("CONSOMMÉ"), false, texte);
  assertEquals(texte.includes("POKÉDOLLARS"), false, "le solde n'a pas bougé");
});

Deno.test("un joueur sans aucun effet est nommé quand même", () => {
  // Sinon son nom apparaîtrait suivi de rien, ce qui ressemble à un bogue.
  const texte = redigerLeBilan([ligne({ pseudo: "Nael Ardent" })], "WM-7K4P-9QX");
  assert(texte.includes("NAEL ARDENT"), texte);
  assert(texte.includes("Rien à verser pour ce sujet."), texte);
});

Deno.test("un multi donne un bloc par joueur, dans l'ordre reçu", () => {
  const texte = redigerLeBilan([
    ligne({ pseudo: "Calliste Vanne", croisees: ["Farfuret"] }),
    ligne({ pseudo: "Nael Ardent", croisees: ["Stalgamin"] }),
  ], "WM-7K4P-9QX");

  assert(texte.indexOf("CALLISTE VANNE") < texte.indexOf("NAEL ARDENT"), texte);
  assertEquals(texte.split("CROISÉ :").length - 1, 2);
});

Deno.test("le singulier et le pluriel des objets", () => {
  const texte = redigerLeBilan([
    ligne({
      consommes: [{ objet: "Poké Ball", quantite: 1 }, { objet: "Potion", quantite: 3 }],
    }),
  ], "WM-7K4P-9QX");
  assert(texte.includes("CONSOMMÉ : 1 Poké Ball · 3 Potion"), texte);
});

Deno.test("le code est toujours écrit en toutes lettres", () => {
  // Un joueur qui conteste doit pouvoir le recopier dans une réclamation.
  const texte = redigerLeBilan([ligne()], "WM-ACDE-FGH");
  assert(texte.trimEnd().endsWith("CODE : WM-ACDE-FGH"), texte);
});

Deno.test("le bilan ne contient aucune mise en forme porteuse de sens", () => {
  // Il doit rester lisible sans CSS, sans JavaScript, dans dix ans.
  const texte = redigerLeBilan([
    ligne({ captures: [{ espece: "Farfuret", niveau: 19 }] }),
  ], "WM-7K4P-9QX");
  assertEquals(/[<>]|\[\/?[a-z]/.test(texte), false, texte);
});

// ── le refus ────────────────────────────────────────────────────────

Deno.test("le refus nomme ce qui manque, et rassure sur ce qui n'a pas bougé", () => {
  const texte = redigerLeRefus([
    { pseudo: "Calliste Vanne", manques: ["2 × Poké Ball, et il n'en reste 1"] },
  ], "WM-7K4P-9QX");

  assert(texte.includes("CALLISTE VANNE"), texte);
  assert(texte.includes("— 2 × Poké Ball, et il n'en reste 1"), texte);
  assert(texte.includes("Le registre du sujet est intact"), texte);
  assert(texte.includes("rien n'a bougé"), texte);
  assert(texte.includes("CODE : WM-7K4P-9QX"), texte);
});

Deno.test("le refus n'invite pas à recommencer sans dire quoi faire", () => {
  const texte = redigerLeRefus([{ pseudo: "X", manques: ["1 place en boîte"] }], "WM-A");
  assert(texte.includes("Rachetez ce qui manque"), texte);
});

Deno.test("un refus à plusieurs nomme chacun séparément", () => {
  const texte = redigerLeRefus([
    { pseudo: "Anna", manques: ["1 × Poké Ball"] },
    { pseudo: "Boris", manques: ["350 ₽"] },
  ], "WM-A");
  assert(texte.indexOf("ANNA") < texte.indexOf("BORIS"), texte);
});
