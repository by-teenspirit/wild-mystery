// ════════════════════════════════════════════════════════════════════
//  src/adaptateurs/supabase/releve.test.ts
//
//  Ces tests ne vérifient pas que la base fonctionne — c'est le travail de
//  pgTAP et du contrat. Ils vérifient ce que l'adaptateur fait quand la
//  base répond de travers, cas qu'aucune base saine ne produit et qu'un
//  test branché sur une vraie base ne peut donc pas provoquer.
//
//  Le pire d'entre eux : un verrou qui répondrait autre chose qu'un
//  booléen. Traité comme vrai, il ferait tourner deux passages en même
//  temps ; traité comme faux, la relève ne tournerait plus jamais. On
//  refuse.
// ════════════════════════════════════════════════════════════════════

import { assert, assertEquals, assertRejects } from "@std/assert";
import { AppelEchoue, type AppelSql } from "./appel.ts";
import { CatalogueSupabase, EtatDuJeuSupabase } from "./jeu.ts";
import { JournalSupabase, SuiviSupabase, VerrouSupabase } from "./releve.ts";

function repond(valeurs: Record<string, unknown>): {
  appel: AppelSql;
  vus: { fonction: string; argument: unknown }[];
} {
  const vus: { fonction: string; argument: unknown }[] = [];
  const appel: AppelSql = (fonction, argument) => {
    vus.push({ fonction, argument });
    return Promise.resolve(valeurs[fonction]);
  };
  return { appel, vus };
}

// ── le verrou ───────────────────────────────────────────────────────

Deno.test("verrou · rend ce que la base répond, et passe le nom et le délai", async () => {
  const { appel, vus } = repond({ releve_prendre_le_verrou: true });
  assertEquals(await new VerrouSupabase(appel).prendre("releve", 240), true);
  assertEquals(vus[0].argument, { nom: "releve", secondes: 240 });
});

Deno.test("verrou · un refus est un refus, pas une erreur", async () => {
  const { appel } = repond({ releve_prendre_le_verrou: false });
  assertEquals(await new VerrouSupabase(appel).prendre("releve", 240), false);
});

Deno.test("verrou · une réponse qui n'est pas un booléen est refusée", async () => {
  // Prise pour vraie, elle ferait tourner deux passages ensemble.
  for (const mauvaise of [null, "true", 1, {}]) {
    const { appel } = repond({ releve_prendre_le_verrou: mauvaise });
    await assertRejects(() => new VerrouSupabase(appel).prendre("releve", 240), AppelEchoue);
  }
});

// ── le journal ──────────────────────────────────────────────────────

Deno.test("journal · lit la date du dernier passage", async () => {
  const { appel } = repond({
    releve_dernier_passage: { passeLe: "2026-10-02T12:39:42+02:00" },
  });
  const quand = await new JournalSupabase(appel).dernierPassage("clotures");
  assert(quand !== null);
  assertEquals(quand.toISOString(), "2026-10-02T10:39:42.000Z");
});

Deno.test("journal · aucun passage encore noté rend null", async () => {
  const { appel } = repond({ releve_dernier_passage: { passeLe: null } });
  assertEquals(await new JournalSupabase(appel).dernierPassage(), null);
});

Deno.test("journal · une date illisible lève au lieu de passer pour 1970", async () => {
  const { appel } = repond({ releve_dernier_passage: { passeLe: "hier soir" } });
  await assertRejects(() => new JournalSupabase(appel).dernierPassage(), AppelEchoue);
});

Deno.test("journal · sans erreur, on écrit null et pas un tableau vide", async () => {
  // Dans la table, `[]` ressemble à « on n'a pas regardé ». `null` se lit
  // d'un coup d'œil comme « rien à signaler ».
  const { appel, vus } = repond({ releve_noter: 1 });
  await new JournalSupabase(appel).noter("clotures", 3, []);
  assertEquals(vus[0].argument, { tache: "clotures", traites: 3, erreurs: null });
});

Deno.test("journal · les erreurs partent telles quelles", async () => {
  const { appel, vus } = repond({ releve_noter: 1 });
  await new JournalSupabase(appel).noter("clotures", 1, ["sujet 813 : page illisible"]);
  assertEquals(vus[0].argument, {
    tache: "clotures",
    traites: 1,
    erreurs: ["sujet 813 : page illisible"],
  });
});

// ── le suivi des forums ─────────────────────────────────────────────

Deno.test("suivi · un forum jamais lu commence à zéro", async () => {
  const { appel } = repond({ releve_suivi: { forumId: 9, dernierMessage: 0 } });
  assertEquals(await new SuiviSupabase(appel).dernierMessageLu(9), 0);
});

Deno.test("suivi · un curseur négatif ou décimal est refusé", async () => {
  for (const mauvais of [-1, 1.5, "8100", null]) {
    const { appel } = repond({ releve_suivi: { dernierMessage: mauvais } });
    await assertRejects(() => new SuiviSupabase(appel).dernierMessageLu(9), AppelEchoue);
  }
});

Deno.test("suivi · avancer envoie le forum et l'identifiant", async () => {
  const { appel, vus } = repond({ releve_avancer: 8100 });
  await new SuiviSupabase(appel).avancer(9, 8100);
  assertEquals(vus[0].argument, { forumId: 9, dernierMessage: 8100 });
});

// ── l'état du joueur ────────────────────────────────────────────────

Deno.test("état · le sac devient une Map, indexée par objet", async () => {
  const { appel } = repond({
    etat_du_joueur: {
      sac: [{ objetId: 1, quantite: 3 }, { objetId: 2, quantite: 1 }],
      placesEnBoite: 26,
      pokedollars: 500,
    },
  });
  const etat = await new EtatDuJeuSupabase(appel).etatDe("anna");
  assertEquals(etat.sac.get(1), 3);
  assertEquals(etat.sac.get(2), 1);
  assertEquals(etat.placesEnBoite, 26);
  assertEquals(etat.pokedollars, 500);
});

Deno.test("état · un sac manquant lève au lieu de rendre un sac vide", async () => {
  // Un sac vide ferait refuser une clôture pourtant valable, et le joueur
  // ne comprendrait pas pourquoi.
  const { appel } = repond({ etat_du_joueur: { placesEnBoite: 30, pokedollars: 0 } });
  await assertRejects(() => new EtatDuJeuSupabase(appel).etatDe("anna"), AppelEchoue);
});

Deno.test("état · une quantité en texte est refusée", async () => {
  const { appel } = repond({
    etat_du_joueur: { sac: [{ objetId: 1, quantite: "3" }], placesEnBoite: 30, pokedollars: 0 },
  });
  await assertRejects(() => new EtatDuJeuSupabase(appel).etatDe("anna"), AppelEchoue);
});

Deno.test("état · zéro place en boîte est une valeur, pas une absence", async () => {
  const { appel } = repond({
    etat_du_joueur: { sac: [], placesEnBoite: 0, pokedollars: 0 },
  });
  const etat = await new EtatDuJeuSupabase(appel).etatDe("anna");
  assertEquals(etat.placesEnBoite, 0);
});

// ── le lien avec le compte Forumactif ───────────────────────────────

Deno.test("un compte non lié rend null, et c'est normal", async () => {
  const { appel } = repond({ joueur_du_compte: { joueurId: null } });
  assertEquals(await new EtatDuJeuSupabase(appel).joueurDuCompte(999), null);
});

Deno.test("un compte lié rend l'identifiant du joueur", async () => {
  const { appel } = repond({ joueur_du_compte: { joueurId: "anna" } });
  assertEquals(await new EtatDuJeuSupabase(appel).joueurDuCompte(801), "anna");
});

Deno.test("un identifiant vide est refusé plutôt que pris pour un joueur", async () => {
  const { appel } = repond({ joueur_du_compte: { joueurId: "" } });
  await assertRejects(() => new EtatDuJeuSupabase(appel).joueurDuCompte(801), AppelEchoue);
});

// ── le catalogue ────────────────────────────────────────────────────

Deno.test("catalogue · rend les noms, et refuse une réponse vide", async () => {
  const { appel, vus } = repond({
    catalogue_nom_objet: { nom: "Poké Ball" },
    catalogue_nom_espece: { nom: "Goupix" },
  });
  const c = new CatalogueSupabase(appel);
  assertEquals(await c.nomObjet(1), "Poké Ball");
  assertEquals(await c.nomEspece(37), "Goupix");
  assertEquals(vus[0].argument, { objetId: 1 });
  assertEquals(vus[1].argument, { especeId: 37 });

  const vide = repond({ catalogue_nom_objet: { nom: "" } });
  await assertRejects(() => new CatalogueSupabase(vide.appel).nomObjet(1), AppelEchoue);
});
