// ════════════════════════════════════════════════════════════════════
//  Ce que l'adaptateur fait d'une réponse MAL FORMÉE. Le chemin heureux
//  est couvert par le contrat, contre un vrai PostgreSQL ; ici on ne
//  teste que la méfiance, parce qu'elle est tout ce que ce fichier
//  apporte.
//
//  POURQUOI ÇA MÉRITE DES TESTS. Le jour où une fonction SQL change de
//  forme, c'est cet adaptateur qui décide si on s'en aperçoit ou si on
//  journalise un zéro inventé. Un zéro inventé est pire qu'une erreur :
//  il ressemble à « rien à faire ».
// ════════════════════════════════════════════════════════════════════

import { assertEquals, assertRejects } from "@std/assert";
import { MenageSupabase, PaliersSupabase } from "./services.ts";
import { AppelEchoue, type AppelSql } from "./appel.ts";

function rendant(valeur: unknown): AppelSql {
  return () => Promise.resolve(valeur);
}

const ALIX = {
  joueurId: "aaaa0000-0000-0000-0000-000000000002",
  pseudo: "Alix",
  avant: 1,
  apres: 2,
};

// ── le palier ───────────────────────────────────────────────────────

Deno.test("le palier : une réponse bien formée passe", async () => {
  const lu = await new PaliersSupabase(
    rendant({ nombre: 1, changements: [ALIX] }),
  ).appliquer();
  assertEquals(lu, [ALIX]);
});

Deno.test("le palier : la liste vide est la réponse ordinaire", async () => {
  const lu = await new PaliersSupabase(rendant({ nombre: 0, changements: [] })).appliquer();
  assertEquals(lu, []);
});

Deno.test("LE PALIER : UN COMPTE QUI NE COLLE PAS À LA LISTE EST REFUSÉ", async () => {
  //  Le cas qui compte. Une liste tronquée journalisée, c'est le staff
  //  qui met deux rangs à jour sur trois et croit avoir fini. Mieux vaut
  //  une erreur nommée qu'un travail à moitié annoncé.
  await assertRejects(
    () => new PaliersSupabase(rendant({ nombre: 3, changements: [ALIX] })).appliquer(),
    AppelEchoue,
    "ne s'accordent pas",
  );
});

Deno.test("le palier : une liste qui n'est pas une liste est refusée", async () => {
  await assertRejects(
    () => new PaliersSupabase(rendant({ nombre: 0, changements: null })).appliquer(),
    AppelEchoue,
    "doit être une liste",
  );
});

Deno.test("le palier : un pseudo vide est refusé", async () => {
  //  « passe au palier 2 » sans nom devant ne sert à rien, et c'est
  //  justement ce que cette tâche existe pour rendre lisible.
  await assertRejects(
    () =>
      new PaliersSupabase(
        rendant({ nombre: 1, changements: [{ ...ALIX, pseudo: "" }] }),
      ).appliquer(),
    AppelEchoue,
    "pseudo illisible",
  );
});

Deno.test("le palier : un changement qui ne change rien est refusé", async () => {
  //  Le `where` de la fonction exclut l'égalité. En voir un ici veut
  //  dire que la fonction a changé, pas qu'il y a une ligne de plus à
  //  journaliser.
  await assertRejects(
    () =>
      new PaliersSupabase(
        rendant({ nombre: 1, changements: [{ ...ALIX, avant: 2, apres: 2 }] }),
      ).appliquer(),
    AppelEchoue,
    "palier inchangé",
  );
});

Deno.test("le palier : `null` est refusé, pas pris pour une liste vide", async () => {
  await assertRejects(() => new PaliersSupabase(rendant(null)).appliquer(), AppelEchoue);
});

// ── le ménage ───────────────────────────────────────────────────────

Deno.test("le ménage : une réponse bien formée passe", async () => {
  const fait = await new MenageSupabase(
    rendant({ sujets: 3, lignes: 11, jours: 60 }),
  ).oublierLesAbandons();
  assertEquals(fait, { sujets: 3, lignes: 11, jours: 60 });
});

Deno.test("le ménage : la charge ne porte `jours` que s'il est donné", async () => {
  //  Sans cette distinction, on imposerait 60 depuis le TypeScript alors
  //  que le défaut vit dans la fonction SQL — deux endroits pour une
  //  même valeur, et c'est comme ça qu'ils divergent.
  const vus: unknown[] = [];
  const espion = (_f: string, a: unknown) => {
    vus.push(a);
    return Promise.resolve({ sujets: 0, lignes: 0, jours: 60 });
  };
  const menage = new MenageSupabase(espion);
  await menage.oublierLesAbandons();
  await menage.oublierLesAbandons(30);
  assertEquals(vus, [{}, { jours: 30 }]);
});

Deno.test("LE MÉNAGE : PLUS DE SUJETS QUE DE LIGNES EST IMPOSSIBLE", async () => {
  //  Chaque sujet oublié a au moins une ligne de registre — c'est ce qui
  //  le rend visible à la requête. Cette comparaison attrape un échange
  //  des deux champs, qui autrement passerait pour un chiffre plausible.
  await assertRejects(
    () =>
      new MenageSupabase(rendant({ sujets: 11, lignes: 3, jours: 60 }))
        .oublierLesAbandons(),
    AppelEchoue,
    "impossible",
  );
});

Deno.test("le ménage : un champ manquant est nommé", async () => {
  await assertRejects(
    () => new MenageSupabase(rendant({ sujets: 1, lignes: 2 })).oublierLesAbandons(),
    AppelEchoue,
    "jours",
  );
});

Deno.test("le ménage : un compte négatif ou fractionnaire est refusé", async () => {
  for (
    const mauvais of [{ sujets: -1, lignes: 2, jours: 60 }, {
      sujets: 1.5,
      lignes: 2,
      jours: 60,
    }]
  ) {
    await assertRejects(
      () => new MenageSupabase(rendant(mauvais)).oublierLesAbandons(),
      AppelEchoue,
      "sujets",
    );
  }
});
