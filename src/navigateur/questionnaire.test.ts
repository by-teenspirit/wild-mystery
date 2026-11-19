// ════════════════════════════════════════════════════════════════════
//  src/navigateur/questionnaire.test.ts
//
//  Ce que ces essais protègent.
//
//  **Que les jauges disent la vérité.** Un pourcentage faux est pire
//  qu'un pourcentage absent : on y croit.
//
//  **Que l'ex-æquo soit annoncé.** « Sauf si y'en a deux à ex-æquo » —
//  une nature désignée au hasard entre deux égales serait un mensonge
//  tranquille.
//
//  **Que les douze questions du fichier soient jouables.** Le dernier
//  essai lit `data/groupes.json` et les répond toutes, pour chacune des
//  quatre colonnes : chaque passage doit désigner une nature, et les
//  six clés doivent exister.
// ════════════════════════════════════════════════════════════════════

import { assert, assertEquals } from "@std/assert";
import { type Choix, depouiller } from "./questionnaire.ts";

const SIX = ["hardi", "serieux", "malin", "doux", "brave", "jovial"];

function choix(premier: string, second: string): Choix {
  return { premier, second };
}

Deno.test("SANS RÉPONSE, SIX JAUGES À ZÉRO — et aucune tête", () => {
  //  Les six sont rendues quand même : une jauge qui apparaîtrait à la
  //  première réponse ferait sauter les autres d'une ligne à chaque
  //  clic.
  const d = depouiller([], SIX);
  assertEquals(d.classement.length, 6);
  assertEquals(d.classement.map((r) => r.part), [0, 0, 0, 0, 0, 0]);
  assertEquals(d.tetes, []);
  assertEquals(d.exaequo, false);
});

Deno.test("UNE RÉPONSE DONNE DEUX TIERS ET UN TIERS", () => {
  //  2 points et 1 : c'est toute la mécanique, et c'est ce qui empêche
  //  de sortir avec un score nul partout sauf une.
  const d = depouiller([choix("brave", "doux")], SIX);
  assertEquals(d.classement[0], {
    cle: "brave",
    points: 2,
    part: 67,
    partExacte: (2 / 3) * 100,
    premiers: 1,
  });
  assertEquals(d.classement[1].cle, "doux");
  assertEquals(d.classement[1].part, 33);
  assertEquals(d.tetes, ["brave"]);
});

Deno.test("LES PARTS SE LISENT SUR CE QUI EST DISTRIBUÉ, pas sur le maximum", () => {
  //  À la moitié du questionnaire, la jauge doit déjà être parlante.
  //  Sur un maximum théorique de 24, quatre réponses plafonneraient à
  //  33 % et les six barres resteraient à ras.
  const d = depouiller([choix("doux", "brave"), choix("doux", "malin")], SIX);
  const somme = d.classement.reduce((a, r) => a + r.partExacte, 0);
  assert(Math.abs(somme - 100) < 1e-9, `somme ${somme}`);
  assertEquals(d.classement[0].cle, "doux");
  assertEquals(d.classement[0].part, 67);
});

Deno.test("L'EX-ÆQUO EST ANNONCÉ, PAS TRANCHÉ AU HASARD", () => {
  //  Deux natures, un premier choix chacune, un second chacune : rien
  //  ne les départage, et en désigner une serait inventer.
  const d = depouiller([choix("hardi", "jovial"), choix("jovial", "hardi")], SIX);
  assertEquals(d.exaequo, true);
  assertEquals([...d.tetes].sort(), ["hardi", "jovial"]);
  assertEquals(d.classement[0].points, 3);
  assertEquals(d.classement[1].points, 3);
});

Deno.test("À POINTS ÉGAUX, LES PREMIERS CHOIX TRANCHENT", () => {
  //  Quatre points de part et d'autre, mais l'un les tient de deux
  //  têtes et l'autre de quatre seconds rôles. « Vers quel groupe elle
  //  tend » : c'est celui qu'on a choisi en premier.
  const d = depouiller([
    choix("malin", "doux"),
    choix("malin", "doux"),
    choix("brave", "doux"),
    choix("serieux", "doux"),
  ], SIX);
  assertEquals(d.classement[0].points, 4);
  assertEquals(d.classement[1].points, 4);
  assertEquals(d.tetes, ["malin"]);
  assertEquals(d.exaequo, false);
});

Deno.test("UNE CLÉ INCONNUE NE FAIT PAS UNE SEPTIÈME JAUGE", () => {
  //  La page est écrite depuis le même fichier que la liste : une clé
  //  qui n'y est pas est une faute de frappe. L'afficher la cacherait.
  const d = depouiller([choix("sournois", "doux")], SIX);
  assertEquals(d.classement.length, 6);
  assertEquals(d.classement.find((r) => r.cle === "doux")?.points, 1);
  assertEquals(d.tetes, ["doux"]);
});

Deno.test("LE QUESTIONNAIRE COMPLET DONNE TRENTE-SIX POINTS", () => {
  const douze = Array.from({ length: 12 }, () => choix("hardi", "doux"));
  const d = depouiller(douze, SIX);
  assertEquals(d.repondues, 12);
  assertEquals(d.classement.reduce((a, r) => a + r.points, 0), 36);
  assertEquals(d.classement[0], {
    cle: "hardi",
    points: 24,
    part: 67,
    partExacte: (24 / 36) * 100,
    premiers: 12,
  });
});

// ── les vraies questions ────────────────────────────────────────────

Deno.test("LES DOUZE QUESTIONS DU FICHIER SONT JOUABLES", async () => {
  //  Pas un décor : les questions de `data/groupes.json`, celles que la
  //  page sert. On répond toute la colonne 1, puis la 2, la 3 et la
  //  4 — quatre passages complets, qui touchent les quarante-huit
  //  réponses.
  const brut = JSON.parse(await Deno.readTextFile("data/groupes.json"));
  const cles: string[] = brut.groupes.map((g: { cle: string }) => g.cle);
  const questions = brut.questionnaire as {
    reponses: { premier: string; second: string }[];
  }[];

  assertEquals(questions.length, 12);
  for (const q of questions) assertEquals(q.reponses.length, 4);

  for (const colonne of [0, 1, 2, 3]) {
    const d = depouiller(questions.map((q) => q.reponses[colonne]), cles);
    assertEquals(d.repondues, 12);
    assertEquals(d.classement.reduce((a, r) => a + r.points, 0), 36);
    //  CHAQUE PASSAGE DÉSIGNE QUELQUE CHOSE : un questionnaire qui
    //  rendrait six natures à égalité n'aurait servi à rien.
    assert(d.tetes.length >= 1 && d.tetes.length <= 2, JSON.stringify(d.tetes));
  }
});

Deno.test("LES SIX NATURES SONT ÉGALEMENT ACCESSIBLES", () => {
  //  « Les groupes : équilibre-les. » Une nature qui sort moins souvent
  //  en premier choix est plus dure à obtenir, et personne ne peut le
  //  voir en lisant les questions — il faut compter.
  //
  //  DOUZE QUESTIONS : 12 × 4 = 48 réponses, donc exactement 8 premiers
  //  et 8 seconds par nature. Le total doit se diviser par 6 pour que
  //  l'égalité soit seulement possible — c'est pour ça qu'on n'a PAS
  //  ajouté une cinquième réponse aux neuf questions, qui aurait fait
  //  45. Voir la planche 105.
  const brut = JSON.parse(Deno.readTextFileSync("data/groupes.json"));
  const cles: string[] = brut.groupes.map((g: { cle: string }) => g.cle);
  const premiers = new Map(cles.map((c) => [c, 0]));
  const seconds = new Map(cles.map((c) => [c, 0]));
  for (const q of brut.questionnaire) {
    for (const r of q.reponses) {
      premiers.set(r.premier, (premiers.get(r.premier) ?? 0) + 1);
      seconds.set(r.second, (seconds.get(r.second) ?? 0) + 1);
    }
  }
  //  ON COMPARE À UNE VALEUR UNIQUE, pas à un écart toléré : « au plus
  //  un de différence » laisserait repasser exactement le défaut qu'on
  //  vient de corriger.
  assertEquals([...new Set(premiers.values())], [8], JSON.stringify([...premiers]));
  assertEquals([...new Set(seconds.values())], [8], JSON.stringify([...seconds]));
  //  ET LES POINTS ATTEIGNABLES SONT LES MÊMES : 2 × 8 + 8 = 24 pour
  //  chacune. C'est ça, « également accessibles ».
  for (const c of cles) {
    assertEquals((premiers.get(c) ?? 0) * 2 + (seconds.get(c) ?? 0), 24, c);
  }
});

Deno.test("LES QUARANTE-HUIT RÉPONSES NOMMENT DES NATURES QUI EXISTENT", () => {
  //  Une clé mal tapée serait silencieuse : la réponse compterait pour
  //  rien, et le joueur ne verrait qu'une jauge un peu basse.
  const brut = JSON.parse(Deno.readTextFileSync("data/groupes.json"));
  const cles = new Set<string>(brut.groupes.map((g: { cle: string }) => g.cle));
  for (const q of brut.questionnaire) {
    for (const r of q.reponses) {
      assert(cles.has(r.premier), `premier inconnu : ${r.premier}`);
      assert(cles.has(r.second), `second inconnu : ${r.second}`);
      //  ET LES DEUX DIFFÈRENT : une réponse qui donnerait 3 points à
      //  la même nature pèserait le double des autres sans le dire.
      assert(r.premier !== r.second, `deux fois ${r.premier}`);
    }
  }
});
