// ════════════════════════════════════════════════════════════════════
//  src/application/rendre-les-fossiles.test.ts
//
//  Les deux tests qui portent ce fichier :
//
//  1 · « une analyse impossible ne bloque pas la file et n'écrit rien au
//      joueur ». C'est la distinction de `0013` prise par le bout du cas
//      d'usage : confondre `impossible` et `refusee` enverrait un
//      message toutes les cinq minutes à un joueur qui n'a rien fait de
//      mal.
//
//  2 · « une annonce qui ne part pas reste en file ». C'est la
//      correction du 2 octobre, troisième table.
// ════════════════════════════════════════════════════════════════════

import { assert, assertEquals } from "@std/assert";
import type { AnalyseAAnnoncer, Fossiles, PosteurSurForum, VerdictDeFossile } from "./ports.ts";
import { JournalEnMemoire } from "../adaptateurs/en-memoire/releve.ts";
import { ESSAIS_AVANT_DE_CRIER, RendreLesFossiles, TACHE } from "./rendre-les-fossiles.ts";

/** La base, en mémoire, avec le verdict qu'elle rendra pour chaque
 *  analyse — et l'idempotence de `0017` : un verdict déjà rendu est
 *  rejoué avec `deja: true`. */
class LaboEnMemoire implements Fossiles {
  readonly file: AnalyseAAnnoncer[] = [];
  readonly annonces: { analyseId: string; messageId: number }[] = [];
  readonly echecs: { analyseId: string; erreur: string }[] = [];
  readonly rendus: string[] = [];
  /** Posé par analyse. `Error` pour une base qui ne répond pas. */
  private readonly verdicts = new Map<string, VerdictDeFossile | Error>();

  ajouter(
    analyseId: string,
    verdict: VerdictDeFossile | Error,
    reste: Partial<AnalyseAAnnoncer> = {},
  ): this {
    this.file.push({
      analyseId,
      sujetId: 1200,
      messageId: 20000,
      pseudo: "Anna",
      fossile: "Fossile Nautile",
      code: "WM-ACDE-FGH",
      essais: 0,
      ...reste,
    });
    this.verdicts.set(analyseId, verdict);
    return this;
  }

  aAnnoncer(limite: number): Promise<readonly AnalyseAAnnoncer[]> {
    return Promise.resolve(this.file.slice(0, limite));
  }

  rendre(analyseId: string): Promise<VerdictDeFossile> {
    this.rendus.push(analyseId);
    const v = this.verdicts.get(analyseId);
    if (v === undefined) return Promise.reject(new Error("analyse inconnue"));
    if (v instanceof Error) return Promise.reject(v);
    //  L'IDEMPOTENCE : le second appel rejoue, il ne retranche pas.
    const deja = this.rendus.filter((a) => a === analyseId).length > 1;
    return Promise.resolve(
      v.etat === "impossible" ? v : { ...v, deja },
    );
  }

  annoncee(analyseId: string, messageId: number): Promise<void> {
    this.annonces.push({ analyseId, messageId });
    const ou = this.file.findIndex((a) => a.analyseId === analyseId);
    if (ou >= 0) this.file.splice(ou, 1);
    return Promise.resolve();
  }

  echouee(analyseId: string, erreur: string): Promise<number> {
    this.echecs.push({ analyseId, erreur });
    const a = this.file.find((x) => x.analyseId === analyseId);
    const essais = (a?.essais ?? 0) + 1;
    if (a) this.file[this.file.indexOf(a)] = { ...a, essais };
    return Promise.resolve(essais);
  }
}

function posteur(
  comportement: (sujetId: number) => number | Error,
): PosteurSurForum & {
  vus: { sujetId: number; mentionne: string; corps: string; code: string }[];
} {
  const vus: { sujetId: number; mentionne: string; corps: string; code: string }[] = [];
  return {
    vus,
    repondre(
      sujetId: number,
      mentionne: string,
      corps: string,
      code: string,
    ): Promise<number> {
      vus.push({ sujetId, mentionne, corps, code });
      const r = comportement(sujetId);
      return r instanceof Error ? Promise.reject(r) : Promise.resolve(r);
    },
  };
}

const RENDUE: VerdictDeFossile = {
  etat: "rendue",
  analyseId: "a1",
  especeId: 139,
  espece: "Amonistar",
  deja: false,
};

const REFUSEE: VerdictDeFossile = {
  etat: "refusee",
  analyseId: "a1",
  motif: "FOSSILE_ABSENT",
  detail: "Ce fossile n'est plus dans ton sac.",
  deja: false,
};

const IMPOSSIBLE: VerdictDeFossile = {
  etat: "impossible",
  analyseId: "a1",
  motif: "FOSSILE_SANS_ESPECE",
  detail: "Aucune espèce n'est encore rattachée à ce fossile.",
};

// ── le cas normal ───────────────────────────────────────────────────

Deno.test("une analyse rendue : le joueur est prévenu et sort de la file", async () => {
  const labo = new LaboEnMemoire().ajouter("a1", RENDUE);
  const forum = posteur(() => 20001);
  const journal = new JournalEnMemoire();

  const passage = await new RendreLesFossiles(labo, forum, journal).executer();

  assertEquals(passage.rendus, [{
    analyseId: "a1",
    pseudo: "Anna",
    espece: "Amonistar",
    deja: false,
  }]);
  assertEquals(passage.erreurs, []);
  assertEquals(labo.file.length, 0);
  assertEquals(labo.annonces, [{ analyseId: "a1", messageId: 20001 }]);
  assertEquals(journal.lignes, [{ tache: TACHE, traites: 1, erreurs: [] }]);
});

Deno.test("la réponse part dans le sujet de la DEMANDE, pas dans un sujet réglé", async () => {
  //  Le `sujetId` vient de la ligne. C'est ce qui permet à cette tâche
  //  de n'avoir aucune configuration, et à un second laboratoire de
  //  n'exiger aucun code.
  const labo = new LaboEnMemoire()
    .ajouter("a1", RENDUE, { sujetId: 1200 })
    .ajouter("a2", { ...RENDUE, analyseId: "a2" }, { sujetId: 1399 });
  const forum = posteur(() => 1);

  await new RendreLesFossiles(labo, forum, new JournalEnMemoire()).executer();

  assertEquals(forum.vus.map((v) => v.sujetId), [1200, 1399]);
});

Deno.test("le message nomme l'espèce, le fossile et le joueur", async () => {
  const labo = new LaboEnMemoire().ajouter("a1", RENDUE);
  const forum = posteur(() => 1);
  await new RendreLesFossiles(labo, forum, new JournalEnMemoire()).executer();

  const { corps, mentionne } = forum.vus[0];
  assert(corps.includes("Amonistar"), corps);
  assert(corps.includes("Fossile Nautile"), corps);
  assertEquals(mentionne, "Anna");
});

Deno.test("le code vient de la BASE et voyage jusqu'au forum", async () => {
  //  Il a été posé par la demande. Le redériver à l'annonce donnerait un
  //  code différent à chaque passage, et le marqueur de l'adaptateur ne
  //  reconnaîtrait plus son propre message.
  const labo = new LaboEnMemoire().ajouter("a1", RENDUE, { code: "WM-J44T-EEE" });
  const forum = posteur(() => 1);
  await new RendreLesFossiles(labo, forum, new JournalEnMemoire()).executer();
  assertEquals(forum.vus[0].code, "WM-J44T-EEE");
});

// ── le refus ────────────────────────────────────────────────────────

Deno.test("un refus est annoncé, avec le détail de la base recopié", async () => {
  const labo = new LaboEnMemoire().ajouter("a1", REFUSEE);
  const forum = posteur(() => 20002);

  const passage = await new RendreLesFossiles(labo, forum, new JournalEnMemoire())
    .executer();

  assertEquals(passage.rendus, []);
  assertEquals(passage.refuses, [{
    analyseId: "a1",
    pseudo: "Anna",
    motif: "FOSSILE_ABSENT",
  }]);
  assert(forum.vus[0].corps.includes("n'est plus dans ton sac"), forum.vus[0].corps);
  //  Un refus sort de la file : il est définitif, et le joueur est
  //  prévenu.
  assertEquals(labo.file.length, 0);
});

// ── le premier test qui porte le fichier ────────────────────────────

Deno.test("une analyse IMPOSSIBLE n'écrit rien au joueur", async () => {
  //  C'est notre donnée qui manque, pas sa faute. Lui répondre
  //  « impossible » toutes les cinq minutes serait une punition pour un
  //  défaut qui n'est pas le sien.
  const labo = new LaboEnMemoire().ajouter("a1", IMPOSSIBLE);
  const forum = posteur(() => 1);

  const passage = await new RendreLesFossiles(labo, forum, new JournalEnMemoire())
    .executer();

  assertEquals(forum.vus, [], "aucun message");
  assertEquals(passage.bloquees, ["a1"]);
  assertEquals(passage.rendus, []);
  assertEquals(passage.refuses, []);
  //  Elle RESTE en file : le jour où la ligne de `fossile_espece`
  //  existera, la demande repartira toute seule.
  assertEquals(labo.file.length, 1);
  assertEquals(labo.annonces, []);
  //  Et elle crie dans le journal, à chaque passage, jusqu'à ce que la
  //  ligne soit écrite.
  assert(passage.erreurs[0].includes("fossile_espece"), passage.erreurs[0]);
  assert(passage.erreurs[0].includes("FOSSILE_SANS_ESPECE"), passage.erreurs[0]);
});

Deno.test("et elle ne bloque pas celles qui suivent", async () => {
  const labo = new LaboEnMemoire()
    .ajouter("a1", IMPOSSIBLE)
    .ajouter("a2", { ...RENDUE, analyseId: "a2" });
  const forum = posteur(() => 20003);

  const passage = await new RendreLesFossiles(labo, forum, new JournalEnMemoire())
    .executer();

  assertEquals(passage.rendus.map((r) => r.analyseId), ["a2"]);
  assertEquals(passage.bloquees, ["a1"]);
  //  Le journal ne compte PAS l'impossible comme traitée : elle ne l'est
  //  pas.
  assertEquals(labo.annonces.map((a) => a.analyseId), ["a2"]);
});

// ── le second test qui porte le fichier ─────────────────────────────

Deno.test("une annonce qui ne part pas RESTE en file", async () => {
  const labo = new LaboEnMemoire().ajouter("a1", RENDUE);
  const forum = posteur(() => new Error("forum injoignable"));

  const passage = await new RendreLesFossiles(labo, forum, new JournalEnMemoire())
    .executer();

  assertEquals(passage.rendus, []);
  assertEquals(passage.erreurs.length, 1);
  assertEquals(labo.file.length, 1, "elle attend le passage suivant");
  assert(labo.echecs[0].erreur.includes("forum injoignable"), labo.echecs[0].erreur);
});

Deno.test("et elle part au passage suivant, SANS retrancher le verdict", async () => {
  //  C'est l'idempotence de `0017` : le second `rendre` rejoue le
  //  verdict gardé. Un pokémon de plus serait une faute grave — le
  //  joueur en aurait deux pour un fossile.
  const labo = new LaboEnMemoire().ajouter("a1", RENDUE);
  let casse = true;
  const forum = posteur(() => casse ? new Error("injoignable") : 20004);
  const journal = new JournalEnMemoire();

  await new RendreLesFossiles(labo, forum, journal).executer();
  casse = false;
  const second = await new RendreLesFossiles(labo, forum, journal).executer();

  assertEquals(second.rendus, [{
    analyseId: "a1",
    pseudo: "Anna",
    espece: "Amonistar",
    //  LA MARQUE DU REJEU. Comptée à part, sinon une coupure réseau
    //  gonflerait les réanimations du journal.
    deja: true,
  }]);
  assertEquals(labo.file.length, 0);
  assertEquals(labo.rendus, ["a1", "a1"], "appelée deux fois, exprès");
});

Deno.test("une annonce qui échoue n'empêche pas les autres de partir", async () => {
  const labo = new LaboEnMemoire()
    .ajouter("a1", RENDUE, { sujetId: 1200 })
    .ajouter("a2", { ...RENDUE, analyseId: "a2" }, { sujetId: 1399 });
  const forum = posteur((s) => s === 1200 ? new Error("sujet verrouillé") : 20005);

  const passage = await new RendreLesFossiles(labo, forum, new JournalEnMemoire())
    .executer();

  assertEquals(passage.rendus.map((r) => r.analyseId), ["a2"]);
  assertEquals(passage.erreurs.length, 1);
  assertEquals(labo.file.map((a) => a.analyseId), ["a1"]);
});

Deno.test("au bout de dix essais, l'erreur dit qu'il faut regarder", async () => {
  const labo = new LaboEnMemoire().ajouter("a1", RENDUE, {
    essais: ESSAIS_AVANT_DE_CRIER - 1,
  });
  const forum = posteur(() => new Error("introuvable"));

  const passage = await new RendreLesFossiles(labo, forum, new JournalEnMemoire())
    .executer();

  assert(passage.erreurs[0].includes("ça ne passera pas tout seul"), passage.erreurs[0]);
});

// ── la base qui ne répond pas ───────────────────────────────────────

Deno.test("une base qui ne répond pas sur une analyse n'arrête pas le passage", async () => {
  const labo = new LaboEnMemoire()
    .ajouter("a1", new Error("PostgREST : 503"))
    .ajouter("a2", { ...RENDUE, analyseId: "a2" });
  const forum = posteur(() => 20006);

  const passage = await new RendreLesFossiles(labo, forum, new JournalEnMemoire())
    .executer();

  assertEquals(passage.rendus.map((r) => r.analyseId), ["a2"]);
  assertEquals(passage.erreurs.length, 1);
  assert(passage.erreurs[0].includes("503"), passage.erreurs[0]);
  //  Rien n'a été posté pour `a1`, et elle reste en file.
  assertEquals(labo.file.map((a) => a.analyseId), ["a1"]);
});

// ── le journal et la borne ──────────────────────────────────────────

Deno.test("une file vide écrit quand même au journal", async () => {
  const journal = new JournalEnMemoire();
  const passage = await new RendreLesFossiles(
    new LaboEnMemoire(),
    posteur(() => 1),
    journal,
  ).executer();
  assertEquals(passage.rendus, []);
  assertEquals(journal.lignes, [{ tache: TACHE, traites: 0, erreurs: [] }]);
});

Deno.test("on ne vide pas toute la file d'un coup", async () => {
  //  Une fonction Edge a une durée maximale ; mieux vaut en rendre dix
  //  par passage que d'en rater cent.
  const labo = new LaboEnMemoire();
  for (let i = 0; i < 20; i++) {
    labo.ajouter(`a${i}`, { ...RENDUE, analyseId: `a${i}` });
  }
  const forum = posteur(() => 1);

  await new RendreLesFossiles(labo, forum, new JournalEnMemoire(), 3).executer();
  assertEquals(forum.vus.length, 3);
});
