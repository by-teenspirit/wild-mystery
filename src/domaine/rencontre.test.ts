// ════════════════════════════════════════════════════════════════════
//  src/domaine/rencontre.test.ts
//
//  La table d'exemple est recopiée de tables_rencontre.csv, zone
//  « Forêt Marécageuse », sous-lieu « Lisière de Samaragd », table du
//  jour. Elle n'est pas inventée : si le format du CSV change, ce test
//  doit changer avec lui.
// ════════════════════════════════════════════════════════════════════

import { assert, assertEquals, assertThrows } from "@std/assert";
import {
  type EntreeDeTable,
  TableInvalide,
  tirerEtTracer,
  tirerUneRencontre,
} from "./rencontre.ts";

const FORET: readonly EntreeDeTable[] = [
  { especeId: 16, pourcentage: 10, niveauMin: 6, niveauMax: 10, rarete: "commun" },
  { especeId: 928, pourcentage: 10, niveauMin: 3, niveauMax: 5, rarete: "commun" },
  { especeId: 10, pourcentage: 45, niveauMin: 2, niveauMax: 6, rarete: "commun" },
  { especeId: 43, pourcentage: 30, niveauMin: 4, niveauMax: 8, rarete: "peu commun" },
  { especeId: 280, pourcentage: 5, niveauMin: 9, niveauMax: 12, rarete: "rare" },
];

const UNE_SEULE: readonly EntreeDeTable[] = [
  { especeId: 25, pourcentage: 100, niveauMin: 7, niveauMax: 7, rarete: "rare" },
];

// ── le cas qui compte : c'est reproductible ─────────────────────────
Deno.test("deux fois la même graine, deux fois la même rencontre", () => {
  const g = "zone:901|sujet:7000|message:8042";
  assertEquals(tirerUneRencontre(FORET, g), tirerUneRencontre(FORET, g));
});

Deno.test("le tirage est figé dans le temps", () => {
  // Valeur gelée volontairement. Si elle change, les tirages déjà
  // joués ne sont plus rejouables et l'arbitrage du staff tombe.
  assertEquals(tirerUneRencontre(FORET, "message:8001"), {
    especeId: 43,
    niveau: 8,
    rarete: "peu commun",
  });
});

Deno.test("deux messages voisins ne donnent pas la même rencontre", () => {
  const a = tirerUneRencontre(FORET, "message:8001");
  const b = tirerUneRencontre(FORET, "message:8002");
  assert(a.especeId !== b.especeId || a.niveau !== b.niveau);
});

// ── ce qui sort du tirage ───────────────────────────────────────────
Deno.test("une table à une seule espèce rend toujours cette espèce", () => {
  for (let i = 0; i < 50; i++) {
    assertEquals(tirerUneRencontre(UNE_SEULE, `m${i}`), {
      especeId: 25,
      niveau: 7,
      rarete: "rare",
    });
  }
});

Deno.test("le niveau reste dans l'intervalle de l'espèce tirée, pas d'une autre", () => {
  const bornes = new Map(FORET.map((e) => [e.especeId, [e.niveauMin, e.niveauMax]]));
  for (let i = 0; i < 2000; i++) {
    const r = tirerUneRencontre(FORET, `message:${i}`);
    const [min, max] = bornes.get(r.especeId)!;
    assert(
      r.niveau >= min && r.niveau <= max,
      `espèce ${r.especeId} au niveau ${r.niveau}, hors de ${min}..${max}`,
    );
  }
});

Deno.test("la rareté rendue est celle de l'espèce tirée", () => {
  const raretes = new Map(FORET.map((e) => [e.especeId, e.rarete]));
  for (let i = 0; i < 300; i++) {
    const r = tirerUneRencontre(FORET, `m${i}`);
    assertEquals(r.rarete, raretes.get(r.especeId));
  }
});

Deno.test("chaque espèce de la table finit par sortir, la rare comprise", () => {
  const vues = new Set<number>();
  for (let i = 0; i < 3000; i++) vues.add(tirerUneRencontre(FORET, `m${i}`).especeId);
  assertEquals([...vues].sort((a, b) => a - b), [10, 16, 43, 280, 928]);
});

Deno.test("les proportions suivent les pourcentages annoncés", () => {
  const compte = new Map<number, number>();
  const n = 20000;
  for (let i = 0; i < n; i++) {
    const id = tirerUneRencontre(FORET, `tirage:${i}`).especeId;
    compte.set(id, (compte.get(id) ?? 0) + 1);
  }
  for (const e of FORET) {
    const part = ((compte.get(e.especeId) ?? 0) / n) * 100;
    assert(
      Math.abs(part - e.pourcentage) < 2,
      `espèce ${e.especeId} : ${part.toFixed(2)} % au lieu de ${e.pourcentage} %`,
    );
  }
});

// ── ce que la table n'a pas le droit d'être ─────────────────────────
Deno.test("refuse une table vide", () => {
  assertThrows(() => tirerUneRencontre([], "m"), TableInvalide);
});

Deno.test("refuse des pourcentages qui ne font pas 100", () => {
  const trop = [{ ...FORET[0], pourcentage: 99 }];
  assertThrows(() => tirerUneRencontre(trop, "m"), TableInvalide);
});

Deno.test("refuse un pourcentage nul ou négatif", () => {
  assertThrows(
    () =>
      tirerUneRencontre(
        [{ ...FORET[0], pourcentage: 0 }, { ...FORET[1], pourcentage: 100 }],
        "m",
      ),
    TableInvalide,
  );
});

Deno.test("refuse des niveaux à l'envers, hors bornes ou décimaux", () => {
  const mauvaises: EntreeDeTable[][] = [
    [{ ...UNE_SEULE[0], niveauMin: 10, niveauMax: 2 }],
    [{ ...UNE_SEULE[0], niveauMin: 0, niveauMax: 5 }],
    [{ ...UNE_SEULE[0], niveauMin: 5, niveauMax: 101 }],
    [{ ...UNE_SEULE[0], niveauMin: 1.5, niveauMax: 5 }],
    [{ ...UNE_SEULE[0], niveauMin: 1, niveauMax: 5.5 }],
  ];
  for (const t of mauvaises) assertThrows(() => tirerUneRencontre(t, "m"), TableInvalide);
});

Deno.test("une tolérance d'un millième est acceptée, pas davantage", () => {
  const presque = [{ ...UNE_SEULE[0], pourcentage: 100.0005 }];
  tirerUneRencontre(presque, "m"); // ne doit pas lever
  const trop = [{ ...UNE_SEULE[0], pourcentage: 100.002 }];
  assertThrows(() => tirerUneRencontre(trop, "m"), TableInvalide);
});

// ── la trace ────────────────────────────────────────────────────────
Deno.test("tirerEtTracer garde la graine en clair à côté du résultat", () => {
  const t = tirerEtTracer(FORET, "message:8001");
  assertEquals(t.graine, "message:8001");
  assertEquals(t.rencontre, tirerUneRencontre(FORET, "message:8001"));
});
