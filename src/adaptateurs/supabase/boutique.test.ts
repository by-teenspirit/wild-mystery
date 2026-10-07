// ════════════════════════════════════════════════════════════════════
//  src/adaptateurs/supabase/boutique.test.ts
//
//  Ce fichier teste UNE SEULE CHOSE : qu'un verdict mal formé ne
//  traverse pas l'adaptateur. Parce que ce qui le traverserait finirait
//  en reçu posté à un joueur déjà débité — et un reçu faux est pire
//  qu'un reçu absent.
//
//  Les cas ne sont pas inventés : ce sont les formes que
//  `boutique_servir` rend vraiment, relevées contre un PostgreSQL 16 le
//  5 octobre, plus les déformations qu'un changement de la fonction
//  produirait.
// ════════════════════════════════════════════════════════════════════

import { assert, assertEquals, assertRejects, assertThrows } from "@std/assert";
import { CompteNonLie } from "../../application/servir-une-commande.ts";
import { AppelEchoue, type AppelSql } from "./appel.ts";
import { BoutiqueSupabase, verdictDepuis } from "./boutique.ts";

/** Le verdict exact rendu par la base pour « Pierre Feu ×2 », copié de
 *  la session du 5 octobre. */
const SERVIE = {
  etat: "servie",
  commandeId: "967022ea-a33c-4cec-8eb1-e5112327b5c7",
  total: 6000,
  solde: 4000,
  deja: false,
  lignes: [{
    nom: "Pierre Feu",
    prix: 3000,
    objetId: 990080,
    quantite: 2,
    sousTotal: 6000,
  }],
};

const REFUSEE = {
  etat: "refusee",
  commandeId: "1a9460bc-4388-426d-a4c1-3c5197d43ead",
  motif: "HORS_VENTE",
  detail:
    "Ces objets ne sont pas en vente : Fossile Hélix. Ils se trouvent, ils ne s'achètent pas.",
  total: 0,
  solde: 3700,
  coupables: [1],
  deja: false,
};

Deno.test("une commande servie se relit entière", () => {
  const v = verdictDepuis(SERVIE);
  assert(v.etat === "servie");
  assertEquals(v.total, 6000);
  assertEquals(v.solde, 4000);
  assertEquals(v.deja, false);
  assertEquals(v.lignes, [{
    objetId: 990080,
    nom: "Pierre Feu",
    quantite: 2,
    prix: 3000,
    sousTotal: 6000,
  }]);
});

Deno.test("un refus garde son motif ET son détail séparés", () => {
  const v = verdictDepuis(REFUSEE);
  assert(v.etat === "refusee");
  assertEquals(v.motif, "HORS_VENTE");
  assertEquals(v.detail, REFUSEE.detail);
  assertEquals(v.total, 0);
});

Deno.test("un refus relu au second passage ne laisse pas passer ses coupables en lignes", () => {
  //  RELEVÉ EN VRAI : sur un refus déjà enregistré, `boutique_servir`
  //  rend `lignes: [1]` — la colonne `lignes` de la table sert à ranger
  //  les identifiants fautifs. Ce ne sont PAS des lignes facturées, et la
  //  variante « refusee » ne doit pas en porter.
  const v = verdictDepuis({ ...REFUSEE, deja: true, lignes: [1] });
  assert(v.etat === "refusee");
  assertEquals("lignes" in v, false);
  assert(v.deja);
});

Deno.test("`deja` absent vaut faux", () => {
  const sans = { ...SERVIE } as Record<string, unknown>;
  delete sans.deja;
  const v = verdictDepuis(sans);
  assertEquals(v.deja, false);
});

Deno.test("un état inattendu est refusé, `en_attente` compris", () => {
  //  `en_attente` est le cas qui compte : c'est ce que l'ancien
  //  `servir_commande` laissait derrière lui quand il échouait, et le
  //  laisser passer ferait poster un reçu pour une commande non servie.
  for (const etat of ["en_attente", "servi", "", null, 3]) {
    assertThrows(
      () => verdictDepuis({ ...SERVIE, etat }),
      AppelEchoue,
      "état inattendu",
    );
  }
});

Deno.test("une commande servie sans ligne ne passe pas", () => {
  for (const lignes of [[], null, undefined, "deux"]) {
    assertThrows(
      () => verdictDepuis({ ...SERVIE, lignes }),
      AppelEchoue,
      "sans ligne",
    );
  }
});

Deno.test("un sous-total qui ne tombe pas juste est refusé", () => {
  //  LE TEST QUI JUSTIFIE LA VÉRIFICATION. On ne recalcule pas le prix —
  //  la base facture et elle a raison — mais si son produit ne tombe pas
  //  juste, le reçu mentirait au joueur sur ce qu'il a payé.
  assertThrows(
    () =>
      verdictDepuis({
        ...SERVIE,
        lignes: [{ ...SERVIE.lignes[0], sousTotal: 5999 }],
      }),
    AppelEchoue,
    "2 × 3000 ne fait pas 5999",
  );
});

Deno.test("un champ manquant est nommé dans l'erreur", () => {
  const cas: [string, string][] = [
    ["commandeId", "commandeId"],
    ["total", "total"],
    ["solde", "solde"],
  ];
  for (const [champ, attendu] of cas) {
    const abime = { ...SERVIE } as Record<string, unknown>;
    delete abime[champ];
    assertThrows(() => verdictDepuis(abime), AppelEchoue, attendu);
  }
  const sansMotif = { ...REFUSEE } as Record<string, unknown>;
  delete sansMotif.motif;
  assertThrows(() => verdictDepuis(sansMotif), AppelEchoue, "motif");
});

Deno.test("un prix non entier est refusé", () => {
  //  Un prix en virgule flottante voudrait dire que la colonne a changé
  //  de type, et le reçu afficherait « 3000.5 ₽ ».
  assertThrows(
    () => verdictDepuis({ ...SERVIE, lignes: [{ ...SERVIE.lignes[0], prix: 3000.5 }] }),
    AppelEchoue,
    "lignes[0].prix",
  );
});

// ── l'appel ─────────────────────────────────────────────────────────

function appel(reponse: unknown | Error): AppelSql & { vus: unknown[] } {
  const vus: unknown[] = [];
  const f = (_fonction: string, argument: unknown) => {
    vus.push(argument);
    return reponse instanceof Error ? Promise.reject(reponse) : Promise.resolve(reponse);
  };
  return Object.assign(f, { vus });
}

Deno.test("l'appel passe le panier sans son prix", async () => {
  const a = appel(SERVIE);
  await new BoutiqueSupabase(a).servir({
    messageId: 15551,
    forumUserId: 3,
    lignes: [{ objetId: 990080, quantite: 2 }],
    code: "WM-7K4P-9QX",
  });

  assertEquals(a.vus, [{
    messageId: 15551,
    forumUserId: 3,
    code: "WM-7K4P-9QX",
    lignes: [{ objetId: 990080, quantite: 2 }],
  }]);
});

Deno.test("un panier vide ne part pas sur le réseau", async () => {
  //  La base le refuserait, mais elle écrirait une commande refusée pour
  //  un message qui ne demandait rien.
  const a = appel(SERVIE);
  await assertRejects(
    () =>
      new BoutiqueSupabase(a).servir({
        messageId: 15551,
        forumUserId: 3,
        lignes: [],
        code: "WM-7K4P-9QX",
      }),
    AppelEchoue,
    "panier vide pour le message 15551",
  );
  assertEquals(a.vus, []);
});

Deno.test("`COMPTE_NON_LIE` devient une erreur nommée", async () => {
  //  La relève doit pouvoir le distinguer d'une panne : un compte non
  //  lié se répond, une panne se réessaie.
  const a = appel(new AppelEchoue("boutique_servir", "HTTP 400 — COMPTE_NON_LIE 9001"));
  const e = await assertRejects(
    () =>
      new BoutiqueSupabase(a).servir({
        messageId: 15551,
        forumUserId: 9001,
        lignes: [{ objetId: 990080, quantite: 1 }],
        code: "WM-7K4P-9QX",
      }),
    CompteNonLie,
  );
  assertEquals(e.forumUserId, 9001);
});

Deno.test("une autre panne reste une panne", async () => {
  const a = appel(new AppelEchoue("boutique_servir", "HTTP 500 — rien ne va"));
  await assertRejects(
    () =>
      new BoutiqueSupabase(a).servir({
        messageId: 15551,
        forumUserId: 3,
        lignes: [{ objetId: 990080, quantite: 1 }],
        code: "WM-7K4P-9QX",
      }),
    AppelEchoue,
    "rien ne va",
  );
});
