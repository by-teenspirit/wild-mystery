// ════════════════════════════════════════════════════════════════════
//  src/application/ranger-le-pokedex.test.ts
//
//  Le test qui porte ce fichier : « une panne du pokédex ne fait pas
//  échouer la relève ». Le reste de la relève vaut plus que cette tâche,
//  qui n'est que de la comptabilité.
// ════════════════════════════════════════════════════════════════════

import { assertEquals, assertStringIncludes } from "@std/assert";
import type { Pokedex } from "./ports.ts";
import { JournalEnMemoire } from "../adaptateurs/en-memoire/releve.ts";
import { RangerLePokedex, TACHE } from "./ranger-le-pokedex.ts";

function pokedex(reponse: number | Error): Pokedex & { appels: number } {
  const d = {
    appels: 0,
    ranger(): Promise<number> {
      d.appels++;
      return reponse instanceof Error ? Promise.reject(reponse) : Promise.resolve(reponse);
    },
  };
  return d;
}

Deno.test("rien à corriger : zéro, et c'est la réponse attendue", async () => {
  const journal = new JournalEnMemoire();
  const passage = await new RangerLePokedex(pokedex(0), journal).executer();

  assertEquals(passage, { corrigees: 0, erreurs: [] });
  //  Le passage est noté MÊME à zéro : c'est à ça qu'on voit que la tâche
  //  tourne, plutôt qu'à son silence.
  assertEquals(journal.lignes, [{ tache: TACHE, traites: 0, erreurs: [] }]);
});

Deno.test("des lignes corrigées sont remontées telles quelles", async () => {
  const journal = new JournalEnMemoire();
  const passage = await new RangerLePokedex(pokedex(7), journal).executer();

  assertEquals(passage.corrigees, 7);
  assertEquals(passage.erreurs, []);
  //  SEPT N'EST PAS UNE ERREUR, et on ne le déguise pas en erreur. C'est
  //  un fait notable : le pokédex était en retard sur le registre.
  assertEquals(journal.lignes[0].traites, 7);
  assertEquals(journal.lignes[0].erreurs, []);
});

Deno.test("une panne est notée et n'est pas relancée", async () => {
  const journal = new JournalEnMemoire();
  const d = pokedex(new Error("PostgREST : 500"));
  const passage = await new RangerLePokedex(d, journal).executer();

  assertEquals(passage.corrigees, 0);
  assertEquals(passage.erreurs.length, 1);
  assertStringIncludes(passage.erreurs[0], "pokédex");
  assertStringIncludes(passage.erreurs[0], "PostgREST : 500");
  //  Un seul appel : la fonction est idempotente, le prochain passage
  //  repassera. Réessayer ici ne ferait que doubler la panne.
  assertEquals(d.appels, 1);
  //  Et la panne est au journal, pas seulement dans la réponse HTTP qui,
  //  elle, ne se relit pas.
  assertEquals(journal.lignes[0].erreurs.length, 1);
});

Deno.test("la tâche ne lève jamais", async () => {
  //  La relève appelle ses tâches à la file. Celle-ci est la moins
  //  importante de toutes — elle ne doit pas pouvoir emporter les
  //  autres.
  const passage = await new RangerLePokedex(
    pokedex(new Error("tout casse")),
    new JournalEnMemoire(),
  ).executer();
  assertEquals(passage.corrigees, 0);
});
