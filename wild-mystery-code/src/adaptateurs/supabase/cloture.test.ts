// ════════════════════════════════════════════════════════════════════
//  src/adaptateurs/supabase/cloture.test.ts
//
//  Le piège que ces tests gardent : une `Map` passée à JSON.stringify
//  devient `{}`. Sans sérialisation explicite, un bilan entier
//  disparaîtrait sans une seule erreur — la clôture « réussirait » et ne
//  verserait rien.
// ════════════════════════════════════════════════════════════════════

import { assert, assertEquals, assertRejects } from "@std/assert";
import { type Effets, evaluerCloture, type LigneRegistre } from "../../domaine/cloture.ts";
import { AppelEchoue, type AppelSql } from "./appel.ts";
import { chargeDeCloture, ClotureSupabase, versJson } from "./cloture.ts";

const ANNA = "11111111-1111-1111-1111-111111111111";
const BORIS = "22222222-2222-2222-2222-222222222222";
const BALL = 1;
const POTION = 2;

function espionne(valeurs: Record<string, unknown> = {}): {
  appel: AppelSql;
  vus: { fonction: string; argument: unknown }[];
} {
  const vus: { fonction: string; argument: unknown }[] = [];
  const appel: AppelSql = (fonction, argument) => {
    vus.push({ fonction, argument });
    return Promise.resolve(valeurs[fonction] ?? null);
  };
  return { appel, vus };
}

/** Un verdict calculé par le VRAI domaine : les tests ne fabriquent pas
 *  des `Effets` à la main, sinon ils ne diraient rien de ce que le domaine
 *  produit réellement. */
function effetsReels(lignes: readonly LigneRegistre[]): Effets {
  const v = evaluerCloture(lignes, {
    sac: new Map([[BALL, 5], [POTION, 5]]),
    placesEnBoite: 30,
    pokedollars: 1000,
  });
  assert(v.possible, "le décor du test devrait donner une clôture possible");
  return v.effets;
}

// ── la sérialisation ────────────────────────────────────────────────

Deno.test("versJson · les Map deviennent des tableaux, pas des objets vides", () => {
  const effets = effetsReels([
    { messageId: 8001, evenement: { type: "objet_trouve", objetId: POTION, quantite: 2 } },
    { messageId: 8002, evenement: { type: "objet_utilise", objetId: BALL, quantite: 1 } },
    { messageId: 8003, evenement: { type: "xp", pokemonId: "galopa", gain: 180 } },
  ]);

  const json = versJson(effets);
  assertEquals(json.objetsAjoutes, [{ objetId: POTION, quantite: 2 }]);
  assertEquals(json.objetsConsommes, [{ objetId: BALL, quantite: 1 }]);
  assertEquals(json.xpParPokemon, [{ pokemonId: "galopa", gain: 180 }]);
});

Deno.test("versJson · ce qui est vide reste un tableau vide, jamais absent", () => {
  const json = versJson(effetsReels([]));
  assertEquals(json.objetsConsommes, []);
  assertEquals(json.objetsAjoutes, []);
  assertEquals(json.captures, []);
  assertEquals(json.xpParPokemon, []);
  assertEquals(json.especesCroisees, []);
  assertEquals(json.pokedollars, 0);
});

Deno.test("versJson · survit à JSON.stringify sans rien perdre", () => {
  // Le vrai trajet : la charge part en JSON. Un oubli de sérialisation
  // donnerait ici « {} » au lieu d'un tableau, sans lever.
  const effets = effetsReels([
    { messageId: 8001, evenement: { type: "objet_trouve", objetId: BALL, quantite: 3 } },
    { messageId: 8002, evenement: { type: "capture", especeId: 215, niveau: 19 } },
    { messageId: 8003, evenement: { type: "croise", especeId: 37 } },
    { messageId: 8004, evenement: { type: "pokedollars", montant: -250 } },
  ]);

  const apres = JSON.parse(JSON.stringify(versJson(effets)));
  assertEquals(apres.objetsAjoutes, [{ objetId: BALL, quantite: 3 }]);
  assertEquals(apres.captures, [{ especeId: 215, niveau: 19 }]);
  // Seulement 37 : le domaine ne range dans `especesCroisees` que les
  // événements « croise ». Une capture sans croisement préalable n'y est
  // pas — c'est `appliquer_cloture` qui range aussi les captures au
  // pokédex, et une assertion pgTAP le vérifie.
  assertEquals(apres.especesCroisees, [37]);
  assertEquals(apres.pokedollars, -250);
});

Deno.test("la preuve du piège : stringifier les Effets bruts perd tout", () => {
  // Ce test n'existe pas pour vérifier notre code, mais pour documenter
  // pourquoi versJson existe. Si un jour quelqu'un « simplifie » en
  // envoyant les Effets directement, il verra ceci.
  const effets = effetsReels([
    { messageId: 8001, evenement: { type: "objet_trouve", objetId: BALL, quantite: 3 } },
  ]);
  const brut = JSON.parse(JSON.stringify(effets));
  assertEquals(brut.objetsAjoutes, {}, "une Map stringifiée devient un objet vide");
});

Deno.test("chargeDeCloture · un versement par joueur, le code au-dessus", () => {
  const charge = chargeDeCloture(7000, [
    { joueurId: ANNA, effets: effetsReels([]) },
    { joueurId: BORIS, effets: effetsReels([]) },
  ], "WM-ACDE-FGH");

  assertEquals(charge.sujetId, 7000);
  assertEquals(charge.code, "WM-ACDE-FGH");
  assertEquals(charge.versements.map((v) => v.joueurId), [ANNA, BORIS]);
});

// ── l'adaptateur ────────────────────────────────────────────────────

Deno.test("deja · rend ce que la base répond", async () => {
  assertEquals(
    await new ClotureSupabase(espionne({ cloture_deja: true }).appel).deja(7000),
    true,
  );
  assertEquals(
    await new ClotureSupabase(espionne({ cloture_deja: false }).appel).deja(7000),
    false,
  );
});

Deno.test("deja · refuse une réponse qui n'est pas un booléen", async () => {
  // « null » serait le plus dangereux : traité comme faux, il ferait
  // reclôturer un sujet déjà clos.
  for (const mauvaise of [null, "true", 1]) {
    await assertRejects(
      () => new ClotureSupabase(espionne({ cloture_deja: mauvaise }).appel).deja(7000),
      AppelEchoue,
    );
  }
});

Deno.test("appliquer · envoie la charge attendue par appliquer_cloture", async () => {
  const { appel, vus } = espionne();
  await new ClotureSupabase(appel).appliquer(
    7000,
    [{
      joueurId: ANNA,
      effets: effetsReels([
        { messageId: 8001, evenement: { type: "capture", especeId: 215, niveau: 19 } },
      ]),
    }],
    "WM-ACDE-FGH",
  );

  assertEquals(vus.length, 1);
  assertEquals(vus[0].fonction, "appliquer_cloture");
  assertEquals(vus[0].argument, {
    sujetId: 7000,
    code: "WM-ACDE-FGH",
    versements: [{
      joueurId: ANNA,
      effets: {
        objetsConsommes: [],
        objetsAjoutes: [],
        captures: [{ especeId: 215, niveau: 19 }],
        xpParPokemon: [],
        especesCroisees: [],
        pokedollars: 0,
      },
    }],
  });
});

Deno.test("appliquer · une clôture sans versement est refusée ici, avec le sujet", async () => {
  const { appel, vus } = espionne();
  const e = await assertRejects(
    () => new ClotureSupabase(appel).appliquer(7000, [], "WM-ACDE-FGH"),
    AppelEchoue,
  );
  assert(e.message.includes("7000"), e.message);
  assertEquals(vus.length, 0, "rien ne doit partir vers la base");
});

Deno.test("appliquer · un refus de la base remonte tel quel", async () => {
  const appel: AppelSql = () => Promise.reject(new AppelEchoue("appliquer_cloture", "23514"));
  await assertRejects(
    () =>
      new ClotureSupabase(appel).appliquer(
        7000,
        [{ joueurId: ANNA, effets: effetsReels([]) }],
        "WM-ACDE-FGH",
      ),
    AppelEchoue,
  );
});
