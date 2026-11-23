// ════════════════════════════════════════════════════════════════════
//  La lecture publique du combat ouvert : ce qu'elle garde, ce qu'elle
//  refuse, et ce qu'elle envoie.
//
//  CE QU'ELLE ENVOIE COMPTE AUTANT QUE CE QU'ELLE REND. Un jeton
//  personnel glissé dans cet appel-là ferait croire que la réponse
//  dépend de qui demande — et un jour quelqu'un s'appuierait dessus
//  pour décider ce qu'un joueur peut faire. L'essai vérifie donc
//  l'en-tête, pas seulement le résultat.
// ════════════════════════════════════════════════════════════════════

import { assert, assertEquals } from "@std/assert";
import { combatDuSujet, lireLeCombatDuSujet } from "./combat-du-sujet.ts";

const ACCES = {
  url: "https://exemple.supabase.co",
  clePubliable: "cle-publiable",
} as const;

Deno.test("un combat ouvert se réduit à son identifiant", () => {
  assertEquals(
    lireLeCombatDuSujet({
      combatId: "31aebbe2-ddf5-4239-8677-1db13db9474e",
      nom: "Nidoran♀",
      niveau: 5,
      pvSauvage: 19,
      tour: 3,
    }),
    { combatId: "31aebbe2-ddf5-4239-8677-1db13db9474e" },
  );
});

Deno.test("aucun combat : la fonction SQL rend null, et nous aussi", () => {
  assertEquals(lireLeCombatDuSujet(null), null);
});

Deno.test("le genre passe, et un genre inconnu est laissé de côté", () => {
  //  UN DUEL DOIT SE RECONNAÎTRE ICI, parce que c'est cette lecture-là
  //  qui décide si la barre bascule : un duel entre deux autres
  //  joueurs ne doit donner aucun bouton à qui passe.
  assertEquals(
    lireLeCombatDuSujet({ combatId: "abc", genre: "duel" }),
    { combatId: "abc", genre: "duel" },
  );
  assertEquals(
    lireLeCombatDuSujet({ combatId: "abc", genre: "sauvage" }),
    { combatId: "abc", genre: "sauvage" },
  );
  //  ── ET L'ABSENCE SE LIT COMME UN SAUVAGE ──────────────────────────
  //
  //  Pas « comme rien » : une base d'avant la 0062 ne rend pas le
  //  genre, et la barre doit continuer de basculer. C'est le défaut qui
  //  donne les boutons — un combat ouvert sans boutons est une impasse.
  assertEquals(lireLeCombatDuSujet({ combatId: "abc" }), { combatId: "abc" });
  assertEquals(lireLeCombatDuSujet({ combatId: "abc", genre: "tournoi" }), { combatId: "abc" });
  assertEquals(lireLeCombatDuSujet({ combatId: "abc", genre: 2 }), { combatId: "abc" });
});

Deno.test("un combat sans identifiant n'est pas un combat", () => {
  assertEquals(lireLeCombatDuSujet({ nom: "Nidoran♀", tour: 3 }), null);
  assertEquals(lireLeCombatDuSujet({ combatId: "" }), null);
  assertEquals(lireLeCombatDuSujet({ combatId: "   " }), null);
  assertEquals(lireLeCombatDuSujet({ combatId: 12 }), null);
  assertEquals(lireLeCombatDuSujet("31aebbe2"), null);
});

Deno.test("l'appel part avec la clé publiable, et avec rien de personnel", async () => {
  let vu: { url: string; init: RequestInit } | null = null;
  const combat = await combatDuSujet(1000, ACCES, (url, init) => {
    vu = { url, init };
    return Promise.resolve({ combatId: "abc" });
  });

  assertEquals(combat, { combatId: "abc" });
  const appel = vu as unknown as { url: string; init: RequestInit };
  assertEquals(appel.url, "https://exemple.supabase.co/rest/v1/rpc/combat_du_sujet");
  assertEquals(appel.init.method, "POST");
  assertEquals(appel.init.credentials, "omit");
  assertEquals(appel.init.body, '{"p":{"sujetId":1000}}');

  const entetes = appel.init.headers as Record<string, string>;
  assertEquals(entetes.apikey, "cle-publiable");
  //  LA CLÉ PUBLIABLE EST SON PROPRE PORTEUR. Si un jour un jeton de
  //  joueur arrivait ici, cette ligne le dirait.
  assertEquals(entetes.Authorization, "Bearer cle-publiable");
});

Deno.test("un réseau en panne rend null, sans jeter", async () => {
  const combat = await combatDuSujet(1000, ACCES, () => Promise.reject(new Error("coupé")));
  assertEquals(combat, null);
});

Deno.test("un refus de la base rend null", async () => {
  const combat = await combatDuSujet(
    1000,
    ACCES,
    () => Promise.resolve(new Response("non", { status: 401 })),
  );
  assertEquals(combat, null);
});

Deno.test("une vraie Response se lit comme du JSON", async () => {
  const combat = await combatDuSujet(
    1000,
    ACCES,
    () =>
      Promise.resolve(
        new Response(JSON.stringify({ combatId: "def", tour: 1 }), { status: 200 }),
      ),
  );
  assert(combat !== null);
  assertEquals(combat.combatId, "def");
});
