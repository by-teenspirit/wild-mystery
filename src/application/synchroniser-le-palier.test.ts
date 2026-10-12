// ════════════════════════════════════════════════════════════════════
//  Tâche 6. Ce qui se teste sans base : ce que la tâche fait de ce que
//  la fonction SQL lui rend, et ce qu'elle écrit au journal.
//
//  Le calcul du palier, lui, est en SQL et il est éprouvé contre un vrai
//  PostgreSQL dans `src/contrat/services.supabase.test.ts`. Le doubler
//  ici en TypeScript serait réécrire le barème une troisième fois — et
//  c'est précisément ce que `0018` a supprimé.
// ════════════════════════════════════════════════════════════════════

import { assertEquals, assertRejects } from "@std/assert";
import { SynchroniserLePalier, TACHE } from "./synchroniser-le-palier.ts";
import type { ChangementDePalier, JournalDeReleve, Paliers } from "./ports.ts";

type LigneDeJournal = {
  tache: string;
  traites: number;
  erreurs: readonly string[];
};

function journalDouble(): JournalDeReleve & { lignes: LigneDeJournal[] } {
  const lignes: LigneDeJournal[] = [];
  return {
    lignes,
    dernierPassage: () => Promise.resolve(null),
    noter: (tache, traites, erreurs) => {
      lignes.push({ tache, traites, erreurs });
      return Promise.resolve();
    },
  };
}

const ALIX: ChangementDePalier = {
  joueurId: "aaaa0000-0000-0000-0000-000000000002",
  pseudo: "Alix",
  avant: 1,
  apres: 2,
};
const MINA: ChangementDePalier = {
  joueurId: "aaaa0000-0000-0000-0000-000000000003",
  pseudo: "Mina",
  avant: 1,
  apres: 3,
};

Deno.test("rien à changer : la liste est vide et le journal note zéro", async () => {
  const journal = journalDouble();
  const paliers: Paliers = { appliquer: () => Promise.resolve([]) };

  const passage = await new SynchroniserLePalier(paliers, journal).executer();

  assertEquals(passage.changements, []);
  assertEquals(passage.erreurs, []);
  assertEquals(journal.lignes, [{ tache: TACHE, traites: 0, erreurs: [] }]);
});

Deno.test("les changements sont rendus NOMINATIVEMENT", async () => {
  //  C'est tout l'intérêt de la tâche côté staff : sans les pseudos, il
  //  faudrait aller chercher qui porte quel identifiant pour mettre les
  //  rangs du forum à jour — et la table `joueur` ne se lit pas.
  const journal = journalDouble();
  const paliers: Paliers = { appliquer: () => Promise.resolve([ALIX, MINA]) };

  const passage = await new SynchroniserLePalier(paliers, journal).executer();

  assertEquals(passage.changements, [ALIX, MINA]);
  assertEquals(journal.lignes[0].traites, 2);
});

Deno.test("une panne du recalcul ne fait pas échouer la relève", async () => {
  //  La fonction SQL n'écrit que les lignes qui diffèrent : le prochain
  //  passage rattrape. Faire tomber la relève entière pour ça coûterait
  //  les clôtures et les reçus du même passage.
  const journal = journalDouble();
  const paliers: Paliers = {
    appliquer: () => Promise.reject(new Error("PostgREST : 503")),
  };

  const passage = await new SynchroniserLePalier(paliers, journal).executer();

  assertEquals(passage.changements, []);
  assertEquals(passage.erreurs.length, 1);
  assertEquals(passage.erreurs[0].startsWith("palier : Error : PostgREST"), true);
  //  ET LA LIGNE DE JOURNAL EST ÉCRITE QUAND MÊME, avec son erreur :
  //  un passage dont il ne reste aucune trace est un passage qu'on ne
  //  saura pas avoir manqué.
  assertEquals(journal.lignes[0].tache, TACHE);
  assertEquals(journal.lignes[0].erreurs.length, 1);
});

Deno.test("elle n'écrit rien sur le forum : aucun port de publication", () => {
  //  Le test est structurel et il est volontaire. `SynchroniserLePalier`
  //  prend DEUX dépendances, et aucune ne sait poster. Le jour où
  //  quelqu'un voudra annoncer les montées de palier, il devra ajouter
  //  un port — donc décider OÙ l'annoncer, ce qui est la question
  //  ouverte, et pas un détail d'implémentation.
  assertEquals(SynchroniserLePalier.length, 2);
});

Deno.test("le nom de la tâche est celui que le journal porte", async () => {
  //  Le journal est interrogé par nom de tâche (`dernierPassage`) : un
  //  nom qui change en silence rend les anciennes lignes orphelines.
  assertEquals(TACHE, "palier");
  const journal = journalDouble();
  await new SynchroniserLePalier({ appliquer: () => Promise.resolve([]) }, journal)
    .executer();
  assertEquals(journal.lignes[0].tache, "palier");
});

Deno.test("le port ne promet rien d'autre que d'appliquer", async () => {
  //  Garde contre une dérive qu'on a déjà payée ailleurs : une tâche qui
  //  LIT puis ÉCRIT laisse une fenêtre entre les deux. `appliquer` fait
  //  les deux en un seul ordre SQL, et la tâche ne doit pas la
  //  contourner en appelant autre chose.
  let appels = 0;
  const paliers: Paliers = {
    appliquer: () => {
      appels += 1;
      return Promise.resolve([ALIX]);
    },
  };
  await new SynchroniserLePalier(paliers, journalDouble()).executer();
  assertEquals(appels, 1);
});

Deno.test("un journal en panne, lui, remonte", async () => {
  //  Différence assumée avec l'erreur de recalcul : si le journal ne
  //  s'écrit pas, le passage n'a laissé aucune trace. On le laisse
  //  remonter à la fonction Edge, qui le met dans sa réponse.
  const paliers: Paliers = { appliquer: () => Promise.resolve([ALIX]) };
  const journal: JournalDeReleve = {
    dernierPassage: () => Promise.resolve(null),
    noter: () => Promise.reject(new Error("journal injoignable")),
  };
  await assertRejects(
    () => new SynchroniserLePalier(paliers, journal).executer(),
    Error,
    "journal injoignable",
  );
});
