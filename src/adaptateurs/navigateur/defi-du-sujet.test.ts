// ════════════════════════════════════════════════════════════════════
//  La lecture du défi ouvert d'un sujet.
//
//  TOUT CE FICHIER TOURNE AUTOUR D'UNE SEULE DISTINCTION : « il n'y a
//  pas de défi » et « je n'ai pas pu lire » ne mènent pas au même
//  bouton. Le premier offre « Défier », le second n'offre rien.
//
//  Les confondre donnerait un défaut discret : un joueur sans
//  laissez-passer se verrait proposer de défier dans un sujet qui porte
//  déjà un défi, et la relève refuserait — un seul défi ouvert par
//  sujet (0060).
// ════════════════════════════════════════════════════════════════════

import { assertEquals } from "@std/assert";
import { defiDuSujet, lireLeDefiDuSujet } from "./defi-du-sujet.ts";

const ACCES = {
  url: "https://exemple.supabase.co",
  clePubliable: "cle-publiable",
} as const;

const LAISSEZ = {
  jeton: "jeton",
  rafraichir: "refr",
  expireLe: Date.now() + 3_600_000,
} as const;

Deno.test("aucun défi : la fonction SQL rend null, et c'est une réponse", () => {
  assertEquals(lireLeDefiDuSujet(null), { ouvert: false });
});

Deno.test("un défi ouvert rend son appartenance, et rien de plus", () => {
  assertEquals(
    lireLeDefiDuSujet({
      defiId: "31aebbe2-ddf5-4239-8677-1db13db9474e",
      lance_le: "2026-11-23T10:00:00Z",
      aMoi: false,
    }),
    { ouvert: true, aMoi: false },
  );
  assertEquals(
    lireLeDefiDuSujet({ defiId: "abc", aMoi: true }),
    { ouvert: true, aMoi: true },
  );
});

Deno.test("un défi sans identifiant n'est pas un défi", () => {
  assertEquals(lireLeDefiDuSujet({ aMoi: false }), null);
  assertEquals(lireLeDefiDuSujet({ defiId: "", aMoi: false }), null);
  assertEquals(lireLeDefiDuSujet({ defiId: "   ", aMoi: false }), null);
  assertEquals(lireLeDefiDuSujet({ defiId: 12, aMoi: false }), null);
  assertEquals(lireLeDefiDuSujet("abc"), null);
});

Deno.test("un `aMoi` qui n'est pas un booléen ne se devine pas", () => {
  //  SANS IDENTITÉ, LA BASE REND `null` POUR `aMoi` — pas `false`. Le
  //  lire comme `false` offrirait « Accepter » au défieur lui-même, et
  //  `combat_pas_contre_soi` le refuserait.
  assertEquals(lireLeDefiDuSujet({ defiId: "abc", aMoi: null }), null);
  assertEquals(lireLeDefiDuSujet({ defiId: "abc" }), null);
  assertEquals(lireLeDefiDuSujet({ defiId: "abc", aMoi: "non" }), null);
  assertEquals(lireLeDefiDuSujet({ defiId: "abc", aMoi: 0 }), null);
});

Deno.test("l'appel part avec le laissez-passer, sur `defi_du_sujet`", async () => {
  let vu: { fonction: string; corps: unknown; jeton: string } | null = null;
  const etat = await defiDuSujet(996, ACCES, {
    lire: () => LAISSEZ,
    appeler: (_acces, jeton, fonction, corps) => {
      vu = { fonction, corps, jeton };
      return Promise.resolve(
        new Response(JSON.stringify({ defiId: "abc", aMoi: false }), { status: 200 }),
      );
    },
  });

  assertEquals(etat, { ouvert: true, aMoi: false });
  const appel = vu as unknown as { fonction: string; corps: unknown; jeton: string };
  assertEquals(appel.fonction, "defi_du_sujet");
  assertEquals(appel.corps, { sujetId: 996 });
  //  LE LAISSEZ-PASSER EST CE QUI REND `aMoi` VRAI OU FAUX. S'il
  //  n'était pas là, la base ne saurait pas qui demande.
  assertEquals(appel.jeton, "jeton");
});

Deno.test("pas de laissez-passer : on n'a pas lu, et on le dit", async () => {
  //  ── LE CŒUR DU FICHIER ────────────────────────────────────────────
  //
  //  `null` ICI N'EST PAS `{ ouvert: false }`. La barre n'offrira donc
  //  pas « Défier », parce qu'on ne sait pas si le sujet en porte déjà
  //  un.
  assertEquals(await defiDuSujet(996, ACCES, { lire: () => null }), null);
});

Deno.test("un refus de la base ne se lit pas comme une absence de défi", async () => {
  assertEquals(
    await defiDuSujet(996, ACCES, {
      lire: () => LAISSEZ,
      appeler: () => Promise.resolve(new Response("non", { status: 401 })),
    }),
    null,
  );
});

Deno.test("un réseau en panne rend null, sans jeter", async () => {
  assertEquals(
    await defiDuSujet(996, ACCES, {
      lire: () => LAISSEZ,
      appeler: () => Promise.reject(new Error("coupé")),
    }),
    null,
  );
});

Deno.test("une absence de défi lue AVEC le laissez-passer donne bien `ouvert: false`", async () => {
  //  L'AUTRE MOITIÉ DE LA DISTINCTION : la fonction a répondu, et elle
  //  a dit qu'il n'y avait rien. Là, « Défier » est le bon bouton.
  assertEquals(
    await defiDuSujet(996, ACCES, {
      lire: () => LAISSEZ,
      appeler: () => Promise.resolve(new Response("null", { status: 200 })),
    }),
    { ouvert: false },
  );
});
