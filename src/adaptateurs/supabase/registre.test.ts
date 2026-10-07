// ════════════════════════════════════════════════════════════════════
//  src/adaptateurs/supabase/registre.test.ts
//
//  Ce fichier NE teste PAS que le registre fonctionne : c'est le travail
//  de src/contrat/registre.supabase.test.ts, contre un vrai PostgreSQL.
//
//  Il teste ce que le contrat ne peut pas atteindre : ce que fait
//  l'adaptateur quand la base répond n'importe quoi. Une base saine ne
//  produit jamais ces réponses — et c'est justement pour ça qu'aucun test
//  branché sur une vraie base ne peut les provoquer.
// ════════════════════════════════════════════════════════════════════

import { assert, assertEquals, assertRejects } from "@std/assert";
import { AppelEchoue, appelPostgrest, type AppelSql } from "./appel.ts";
import { LigneIllisible } from "./evenement.ts";
import { RegistreSupabase } from "./registre.ts";

function repond(valeurs: Record<string, unknown>): { appel: AppelSql; vus: unknown[][] } {
  const vus: unknown[][] = [];
  const appel: AppelSql = (fonction, argument) => {
    vus.push([fonction, argument]);
    return Promise.resolve(valeurs[fonction]);
  };
  return { appel, vus };
}

// ── ce qui est envoyé ───────────────────────────────────────────────

Deno.test("inscrire · envoie le type et la charge séparés, et le code", async () => {
  const { appel, vus } = repond({ registre_inscrire: 1 });
  await new RegistreSupabase(appel).inscrire(
    7000,
    "11111111-1111-1111-1111-111111111111",
    8001,
    { type: "capture", especeId: 215, niveau: 19 },
    "WM-ACDE-FGH",
  );
  assertEquals(vus.length, 1);
  assertEquals(vus[0][0], "registre_inscrire");
  assertEquals(vus[0][1], {
    sujetId: 7000,
    joueurId: "11111111-1111-1111-1111-111111111111",
    messageId: 8001,
    type: "capture",
    charge: { especeId: 215, niveau: 19 },
    code: "WM-ACDE-FGH",
  });
});

Deno.test("lignesDuSujet · n'envoie que le sujet et le joueur", async () => {
  const { appel, vus } = repond({ registre_lignes: [] });
  await new RegistreSupabase(appel).lignesDuSujet(7000, "anna");
  assertEquals(vus[0][1], { sujetId: 7000, joueurId: "anna" });
});

Deno.test("lignesDuSujet · reconstruit l'événement depuis les deux colonnes", async () => {
  const { appel } = repond({
    registre_lignes: [
      { messageId: 8001, type: "croise", charge: { especeId: 37 } },
      { messageId: 8002, type: "xp", charge: { pokemonId: "galopa", gain: 60 } },
    ],
  });
  assertEquals(await new RegistreSupabase(appel).lignesDuSujet(7000, "anna"), [
    { messageId: 8001, evenement: { type: "croise", especeId: 37 } },
    { messageId: 8002, evenement: { type: "xp", pokemonId: "galopa", gain: 60 } },
  ]);
});

// ── ce qui arrive de travers ────────────────────────────────────────

Deno.test("une réponse qui n'est pas un tableau est refusée, pas lue de force", async () => {
  const { appel } = repond({ registre_lignes: { messageId: 1 } });
  await assertRejects(
    () => new RegistreSupabase(appel).lignesDuSujet(7000, "anna"),
    AppelEchoue,
  );
});

Deno.test("null au lieu d'un tableau est refusé", async () => {
  const { appel } = repond({ registre_lignes: null });
  await assertRejects(() => new RegistreSupabase(appel).joueursDuSujet(7000), AppelEchoue);
});

Deno.test("une ligne sans messageId lève plutôt que de glisser", async () => {
  const { appel } = repond({
    registre_lignes: [{ type: "croise", charge: { especeId: 37 } }],
  });
  await assertRejects(
    () => new RegistreSupabase(appel).lignesDuSujet(7000, "anna"),
    LigneIllisible,
  );
});

Deno.test("un type d'événement inconnu lève : on ne laisse pas tomber la ligne", async () => {
  // Le réflexe tentant serait de filtrer les lignes illisibles. Ce serait
  // perdre une capture en silence.
  const { appel } = repond({
    registre_lignes: [{ messageId: 8001, type: "evolution", charge: {} }],
  });
  await assertRejects(
    () => new RegistreSupabase(appel).lignesDuSujet(7000, "anna"),
    LigneIllisible,
  );
});

Deno.test("un identifiant de joueur qui n'est pas du texte est refusé", async () => {
  const { appel } = repond({ registre_joueurs: [12345] });
  await assertRejects(() => new RegistreSupabase(appel).joueursDuSujet(7000), AppelEchoue);
});

Deno.test("oublier · exige un entier, pas un texte qui ressemble à un nombre", async () => {
  const { appel } = repond({ registre_oublier: "2" });
  await assertRejects(() => new RegistreSupabase(appel).oublier(7000), AppelEchoue);
});

Deno.test("oublier · rend le compte tel quel, zéro compris", async () => {
  assertEquals(await new RegistreSupabase(repond({ registre_oublier: 0 }).appel).oublier(1), 0);
  assertEquals(await new RegistreSupabase(repond({ registre_oublier: 3 }).appel).oublier(1), 3);
});

// ── l'appel PostgREST ───────────────────────────────────────────────

type Capture = { url: string; options: RequestInit };

function fauxFetch(
  reponse: { statut: number; corps: string },
): { recuperer: typeof fetch; captures: Capture[] } {
  const captures: Capture[] = [];
  const recuperer = ((url: string | URL | Request, options?: RequestInit) => {
    captures.push({ url: String(url), options: options ?? {} });
    return Promise.resolve(
      new Response(reponse.corps, { status: reponse.statut }),
    );
  }) as unknown as typeof fetch;
  return { recuperer, captures };
}

Deno.test("appelPostgrest · poste sur /rest/v1/rpc/<nom> avec la charge sous « p »", async () => {
  const { recuperer, captures } = fauxFetch({ statut: 200, corps: "[]" });
  const appel = appelPostgrest({
    base: "https://exemple.supabase.co",
    cle: "cle-publiable",
    recuperer,
  });

  assertEquals(await appel("registre_lignes", { sujetId: 7000 }), []);
  assertEquals(captures[0].url, "https://exemple.supabase.co/rest/v1/rpc/registre_lignes");
  assertEquals(captures[0].options.method, "POST");
  assertEquals(captures[0].options.body, '{"p":{"sujetId":7000}}');
});

Deno.test("appelPostgrest · une barre finale dans l'URL ne double pas la barre", async () => {
  const { recuperer, captures } = fauxFetch({ statut: 200, corps: "null" });
  await appelPostgrest({ base: "https://exemple.supabase.co//", cle: "k", recuperer })("f", {});
  assertEquals(captures[0].url, "https://exemple.supabase.co/rest/v1/rpc/f");
});

Deno.test("appelPostgrest · sans jeton, la clé sert d'autorisation", async () => {
  const { recuperer, captures } = fauxFetch({ statut: 200, corps: "null" });
  await appelPostgrest({ base: "https://x.supabase.co", cle: "cle-publiable", recuperer })(
    "f",
    {},
  );
  const entetes = captures[0].options.headers as Record<string, string>;
  assertEquals(entetes["apikey"], "cle-publiable");
  assertEquals(entetes["authorization"], "Bearer cle-publiable");
});

Deno.test("appelPostgrest · avec un jeton de joueur, c'est lui qui autorise", async () => {
  const { recuperer, captures } = fauxFetch({ statut: 200, corps: "null" });
  await appelPostgrest({
    base: "https://x.supabase.co",
    cle: "cle-publiable",
    jeton: "jwt-du-joueur",
    recuperer,
  })("f", {});
  const entetes = captures[0].options.headers as Record<string, string>;
  // La clé reste là : PostgREST l'exige en plus du jeton.
  assertEquals(entetes["apikey"], "cle-publiable");
  assertEquals(entetes["authorization"], "Bearer jwt-du-joueur");
});

Deno.test("appelPostgrest · un refus HTTP lève avec le corps de la réponse", async () => {
  const { recuperer } = fauxFetch({
    statut: 403,
    corps: '{"message":"permission denied for table registre"}',
  });
  const e = await assertRejects(
    () => appelPostgrest({ base: "https://x.supabase.co", cle: "k", recuperer })("f", {}),
    AppelEchoue,
  );
  assert(e.message.includes("403"), e.message);
  assert(e.message.includes("permission denied"), e.message);
});

Deno.test("appelPostgrest · une réponse vide vaut null, pas une erreur", async () => {
  // 200 et non 204 : un 204 ne peut pas porter de corps, et c'est le
  // corps vide d'une réponse 200 qu'on veut vérifier ici.
  const { recuperer } = fauxFetch({ statut: 200, corps: "" });
  assertEquals(
    await appelPostgrest({ base: "https://x.supabase.co", cle: "k", recuperer })("f", {}),
    null,
  );
});

Deno.test("appelPostgrest · du HTML à la place du JSON lève clairement", async () => {
  // Ce qui arrive quand l'URL du projet est fausse : une page d'erreur.
  const { recuperer } = fauxFetch({ statut: 200, corps: "<html>Not found</html>" });
  const e = await assertRejects(
    () => appelPostgrest({ base: "https://x.supabase.co", cle: "k", recuperer })("f", {}),
    AppelEchoue,
  );
  assert(e.message.includes("illisible"), e.message);
});
