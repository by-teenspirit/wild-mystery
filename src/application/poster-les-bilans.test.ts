// ════════════════════════════════════════════════════════════════════
//  src/application/poster-les-bilans.test.ts
//
//  Le test qui porte ce fichier : « un bilan qui ne part pas reste en
//  file ». C'est la correction du défaut constaté en vrai le 2 octobre,
//  où une clôture appliquée dont le bilan n'avait pas été publié devenait
//  un cul-de-sac définitif.
// ════════════════════════════════════════════════════════════════════

import { assert, assertEquals } from "@std/assert";
import type { BilanEnAttente, BilansEnAttente, PosteurSurForum } from "./ports.ts";
import { JournalEnMemoire } from "../adaptateurs/en-memoire/releve.ts";
import { ESSAIS_AVANT_DE_CRIER, PosterLesBilans, TACHE } from "./poster-les-bilans.ts";

class FileEnMemoire implements BilansEnAttente {
  readonly restants: BilanEnAttente[] = [];
  readonly postes: { sujetId: number; messageId: number }[] = [];
  readonly echecs: { sujetId: number; erreur: string }[] = [];

  ajouter(b: Partial<BilanEnAttente> & { sujetId: number }): this {
    this.restants.push({
      code: "WM-ACDE-FGH",
      bilan: "Sujet clôturé.",
      mentionne: "Anna",
      essais: 0,
      ...b,
    });
    return this;
  }

  aPoster(combien: number): Promise<readonly BilanEnAttente[]> {
    return Promise.resolve(this.restants.slice(0, combien));
  }

  poste(sujetId: number, messageId: number): Promise<void> {
    this.postes.push({ sujetId, messageId });
    const ou = this.restants.findIndex((b) => b.sujetId === sujetId);
    if (ou >= 0) this.restants.splice(ou, 1);
    return Promise.resolve();
  }

  echoue(sujetId: number, erreur: string): Promise<number> {
    this.echecs.push({ sujetId, erreur });
    const b = this.restants.find((x) => x.sujetId === sujetId);
    const essais = (b?.essais ?? 0) + 1;
    if (b) {
      this.restants[this.restants.indexOf(b)] = { ...b, essais };
    }
    return Promise.resolve(essais);
  }
}

function posteur(
  comportement: (sujetId: number) => number | Error,
): PosteurSurForum & { vus: { sujetId: number; corps: string; code: string }[] } {
  const vus: { sujetId: number; corps: string; code: string }[] = [];
  return {
    vus,
    repondre(
      sujetId: number,
      _mentionne: string,
      corps: string,
      code: string,
    ): Promise<number> {
      vus.push({ sujetId, corps, code });
      const r = comportement(sujetId);
      return r instanceof Error ? Promise.reject(r) : Promise.resolve(r);
    },
  };
}

// ── le cas normal ───────────────────────────────────────────────────

Deno.test("un bilan en attente est publié et sort de la file", async () => {
  const file = new FileEnMemoire().ajouter({ sujetId: 975 });
  const forum = posteur(() => 15545);
  const journal = new JournalEnMemoire();

  const bilan = await new PosterLesBilans(file, forum, journal).executer();

  assertEquals(bilan.publies, [{ sujetId: 975, messageId: 15545 }]);
  assertEquals(bilan.erreurs, []);
  assertEquals(file.restants.length, 0);
  assertEquals(journal.lignes, [{ tache: TACHE, traites: 1, erreurs: [] }]);
});

Deno.test("le code voyage jusqu'au forum : c'est lui qui pose le marqueur", async () => {
  const file = new FileEnMemoire().ajouter({ sujetId: 975, code: "WM-J44T-EEE" });
  const forum = posteur(() => 1);
  await new PosterLesBilans(file, forum, new JournalEnMemoire()).executer();
  assertEquals(forum.vus[0].code, "WM-J44T-EEE");
});

// ── le test qui porte le fichier ────────────────────────────────────

Deno.test("un bilan qui ne part pas RESTE en file", async () => {
  // C'est tout l'objet de la correction : avant, il disparaissait avec la
  // clôture et plus rien ne réessayait.
  const file = new FileEnMemoire().ajouter({ sujetId: 975 });
  const forum = posteur(() => new Error("forum injoignable"));

  const bilan = await new PosterLesBilans(file, forum, new JournalEnMemoire()).executer();

  assertEquals(bilan.publies, []);
  assertEquals(bilan.erreurs.length, 1);
  assertEquals(file.restants.length, 1, "il attend le passage suivant");
  assertEquals(file.echecs[0].erreur.includes("forum injoignable"), true);
});

Deno.test("et il part au passage suivant, quand le forum revient", async () => {
  const file = new FileEnMemoire().ajouter({ sujetId: 975 });
  let forumCasse = true;
  const forum = posteur(() => forumCasse ? new Error("injoignable") : 15545);
  const journal = new JournalEnMemoire();

  await new PosterLesBilans(file, forum, journal).executer();
  forumCasse = false;
  const second = await new PosterLesBilans(file, forum, journal).executer();

  assertEquals(second.publies, [{ sujetId: 975, messageId: 15545 }]);
  assertEquals(file.restants.length, 0);
});

Deno.test("un bilan qui échoue n'empêche pas les autres de partir", async () => {
  const file = new FileEnMemoire().ajouter({ sujetId: 975 }).ajouter({ sujetId: 976 });
  const forum = posteur((s) => s === 975 ? new Error("sujet verrouillé") : 16000);

  const bilan = await new PosterLesBilans(file, forum, new JournalEnMemoire()).executer();

  assertEquals(bilan.publies, [{ sujetId: 976, messageId: 16000 }]);
  assertEquals(bilan.erreurs.length, 1);
  assertEquals(file.restants.map((b) => b.sujetId), [975]);
});

Deno.test("au bout de dix essais, l'erreur dit qu'il faut regarder", async () => {
  // Un bilan qui ne passera jamais — sujet supprimé, compte bloqué — ne
  // doit pas tourner en silence pour l'éternité.
  const file = new FileEnMemoire().ajouter({
    sujetId: 975,
    essais: ESSAIS_AVANT_DE_CRIER - 1,
  });
  const forum = posteur(() => new Error("introuvable"));

  const bilan = await new PosterLesBilans(file, forum, new JournalEnMemoire()).executer();

  assert(bilan.erreurs[0].includes("ça ne passera pas tout seul"), bilan.erreurs[0]);
  assert(bilan.erreurs[0].includes(`${ESSAIS_AVANT_DE_CRIER} essais`), bilan.erreurs[0]);
});

Deno.test("avant dix essais, on n'alarme pas", async () => {
  const file = new FileEnMemoire().ajouter({ sujetId: 975, essais: 0 });
  const forum = posteur(() => new Error("injoignable"));
  const bilan = await new PosterLesBilans(file, forum, new JournalEnMemoire()).executer();
  assertEquals(bilan.erreurs[0].includes("ça ne passera pas"), false, bilan.erreurs[0]);
});

Deno.test("une file vide écrit quand même au journal", async () => {
  // Sinon on ne distingue pas « rien à poster » de « la tâche n'a pas
  // tourné ».
  const journal = new JournalEnMemoire();
  const bilan = await new PosterLesBilans(
    new FileEnMemoire(),
    posteur(() => 1),
    journal,
  ).executer();
  assertEquals(bilan.publies, []);
  assertEquals(journal.lignes, [{ tache: TACHE, traites: 0, erreurs: [] }]);
});

Deno.test("on ne vide pas toute la file d'un coup", async () => {
  // Une fonction Edge a une durée maximale ; mieux vaut en poster dix par
  // passage que d'en rater cent.
  const file = new FileEnMemoire();
  for (let s = 900; s < 920; s++) file.ajouter({ sujetId: s });
  const forum = posteur(() => 1);

  await new PosterLesBilans(file, forum, new JournalEnMemoire(), 3).executer();
  assertEquals(forum.vus.length, 3);
});
