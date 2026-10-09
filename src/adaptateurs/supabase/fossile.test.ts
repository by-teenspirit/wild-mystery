// ════════════════════════════════════════════════════════════════════
//  src/adaptateurs/supabase/fossile.test.ts
//
//  Ce fichier teste UNE SEULE CHOSE : qu'un verdict ou une ligne de file
//  mal formés ne traversent pas l'adaptateur.
//
//  Ce qui les traverserait finirait en message posté dans un sujet, et
//  un message posté ne se retire pas : « → , niveau 15 » reste là, et le
//  joueur vient demander ce qu'il a obtenu. Pire, un `analyseId` vide
//  ferait marquer annoncée une analyse qui n'est pas la bonne.
// ════════════════════════════════════════════════════════════════════

import { assertEquals, assertRejects, assertThrows } from "@std/assert";
import { AppelEchoue, type AppelSql } from "./appel.ts";
import { analyseDepuis, FossilesSupabase, verdictDepuis } from "./fossile.ts";

/** Les formes que `rendre_fossile` rend vraiment, lues dans `0017`. */
const RENDUE = {
  etat: "rendue",
  analyseId: "6f0b3b7e-1e4a-4a0e-9a2a-4b7c0d6e1f22",
  especeId: 139,
  espece: "Amonistar",
  deja: false,
};

const REFUSEE = {
  etat: "refusee",
  analyseId: "6f0b3b7e-1e4a-4a0e-9a2a-4b7c0d6e1f22",
  motif: "FOSSILE_ABSENT",
  detail: "Ce fossile n'est plus dans ton sac.",
  deja: false,
};

const IMPOSSIBLE = {
  etat: "impossible",
  analyseId: "6f0b3b7e-1e4a-4a0e-9a2a-4b7c0d6e1f22",
  motif: "FOSSILE_SANS_ESPECE",
  detail: "Aucune espèce n'est encore rattachée à ce fossile.",
};

const EN_FILE = {
  analyseId: "6f0b3b7e-1e4a-4a0e-9a2a-4b7c0d6e1f22",
  sujetId: 1200,
  messageId: 20410,
  pseudo: "Anna",
  fossile: "Fossile Nautile",
  code: "WM-ACDE-FGH",
  essais: 0,
  creeLe: "2026-10-09T11:04:00+00",
};

// ── le verdict ──────────────────────────────────────────────────────

Deno.test("une analyse rendue se relit entière", () => {
  const v = verdictDepuis(RENDUE);
  assertEquals(v.etat, "rendue");
  if (v.etat !== "rendue") return;
  assertEquals(v.especeId, 139);
  assertEquals(v.espece, "Amonistar");
  assertEquals(v.deja, false);
});

Deno.test("un refus garde son motif ET son détail", () => {
  //  Le détail est recopié tel quel dans le message. Le perdre laisserait
  //  « analyse refusée » tout seul, et personne ne saurait pourquoi.
  const v = verdictDepuis(REFUSEE);
  if (v.etat !== "refusee") throw new Error("refus attendu");
  assertEquals(v.motif, "FOSSILE_ABSENT");
  assertEquals(v.detail, "Ce fossile n'est plus dans ton sac.");
});

Deno.test("`impossible` reste `impossible` et ne devient pas un refus", () => {
  //  LA DISTINCTION DE `0013`. Les confondre coûterait un pokémon à un
  //  joueur qui n'a rien fait de mal : un refus est définitif, un
  //  impossible repart tout seul.
  assertEquals(verdictDepuis(IMPOSSIBLE).etat, "impossible");
});

Deno.test("`deja` absent vaut faux", () => {
  const { deja: _, ...sans } = RENDUE;
  const v = verdictDepuis(sans);
  if (v.etat !== "rendue") throw new Error("rendue attendue");
  assertEquals(v.deja, false);
});

Deno.test("`deja: true` traverse : c'est un rejeu, pas une réanimation", () => {
  const v = verdictDepuis({ ...RENDUE, deja: true });
  if (v.etat !== "rendue") throw new Error("rendue attendue");
  assertEquals(v.deja, true);
});

Deno.test("une espèce sans nom ne traverse pas", () => {
  //  Sinon le message annonce « → , niveau 15 ».
  assertThrows(() => verdictDepuis({ ...RENDUE, espece: "" }), AppelEchoue);
  assertThrows(() => verdictDepuis({ ...RENDUE, espece: null }), AppelEchoue);
});

Deno.test("une analyse rendue sans espèce du tout ne traverse pas", () => {
  const { especeId: _, ...sans } = RENDUE;
  assertThrows(() => verdictDepuis(sans), AppelEchoue);
});

Deno.test("un refus sans détail ne traverse pas", () => {
  assertThrows(() => verdictDepuis({ ...REFUSEE, detail: "" }), AppelEchoue);
});

Deno.test("un état inconnu ne traverse pas", () => {
  //  `en_attente` en fait partie : la fonction ne doit jamais rendre une
  //  analyse qu'elle laisse sans verdict.
  for (const etat of ["en_attente", "servie", "", null, 3]) {
    assertThrows(() => verdictDepuis({ ...RENDUE, etat }), AppelEchoue);
  }
});

Deno.test("un verdict qui n'est pas un objet ne traverse pas", () => {
  for (const recu of [null, "rendue", 42, [], undefined]) {
    assertThrows(() => verdictDepuis(recu), AppelEchoue);
  }
});

// ── la file ─────────────────────────────────────────────────────────

Deno.test("une ligne de file se relit entière", () => {
  assertEquals(analyseDepuis(EN_FILE), {
    analyseId: EN_FILE.analyseId,
    sujetId: 1200,
    messageId: 20410,
    pseudo: "Anna",
    fossile: "Fossile Nautile",
    code: "WM-ACDE-FGH",
    essais: 0,
  });
});

Deno.test("une analyse sans sujet ne traverse pas", () => {
  //  `analyses_a_annoncer` les écarte déjà en SQL. On vérifie quand
  //  même : une colonne qui devient nulle se découvrirait sinon par un
  //  message posté nulle part.
  assertThrows(() => analyseDepuis({ ...EN_FILE, sujetId: null }), AppelEchoue);
});

Deno.test("une analyse sans code ne traverse pas", () => {
  //  Le code pose le marqueur, donc permet de reconnaître un message
  //  déjà posté. Sans lui, chaque coupure publierait un doublon.
  assertThrows(() => analyseDepuis({ ...EN_FILE, code: "" }), AppelEchoue);
});

Deno.test("une analyse sans pseudo ne traverse pas", () => {
  //  Un message doit nommer quelqu'un.
  assertThrows(() => analyseDepuis({ ...EN_FILE, pseudo: null }), AppelEchoue);
});

Deno.test("`essais` absent vaut zéro", () => {
  const { essais: _, ...sans } = EN_FILE;
  assertEquals(analyseDepuis(sans).essais, 0);
});

// ── l'adaptateur ────────────────────────────────────────────────────

function appelQuiRend(reponses: Record<string, unknown>): AppelSql & {
  vus: { fonction: string; argument: unknown }[];
} {
  const vus: { fonction: string; argument: unknown }[] = [];
  const appeler = (fonction: string, argument: unknown) => {
    vus.push({ fonction, argument });
    return Promise.resolve(reponses[fonction]);
  };
  return Object.assign(appeler, { vus });
}

Deno.test("la file passe la limite à la fonction SQL", async () => {
  const appeler = appelQuiRend({ analyses_a_annoncer: [EN_FILE] });
  const liste = await new FossilesSupabase(appeler).aAnnoncer(7);
  assertEquals(appeler.vus[0], {
    fonction: "analyses_a_annoncer",
    argument: { combien: 7 },
  });
  assertEquals(liste.length, 1);
});

Deno.test("une file qui n'est pas un tableau ne traverse pas", async () => {
  const appeler = appelQuiRend({ analyses_a_annoncer: { analyses: [] } });
  await assertRejects(() => new FossilesSupabase(appeler).aAnnoncer(10), AppelEchoue);
});

Deno.test("une file vide est une réponse valide", async () => {
  const appeler = appelQuiRend({ analyses_a_annoncer: [] });
  assertEquals(await new FossilesSupabase(appeler).aAnnoncer(10), []);
});

Deno.test("`annoncee` et `echouee` appellent les bonnes fonctions", async () => {
  const appeler = appelQuiRend({
    analyse_annoncee: true,
    analyse_annonce_echouee: 3,
  });
  const labo = new FossilesSupabase(appeler);
  await labo.annoncee("a1", 20411);
  assertEquals(await labo.echouee("a1", "forum injoignable"), 3);
  assertEquals(appeler.vus, [
    { fonction: "analyse_annoncee", argument: { analyseId: "a1", messageId: 20411 } },
    {
      fonction: "analyse_annonce_echouee",
      argument: { analyseId: "a1", erreur: "forum injoignable" },
    },
  ]);
});

Deno.test("un compte d'essais illisible vaut zéro, il n'alarme pas à tort", async () => {
  const appeler = appelQuiRend({ analyse_annonce_echouee: null });
  assertEquals(await new FossilesSupabase(appeler).echouee("a1", "x"), 0);
});
