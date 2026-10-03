// ════════════════════════════════════════════════════════════════════
//  src/contrat/registre.contrat.ts
//
//  LA suite partagée. Elle tourne deux fois :
//    • contre RegistreEnMemoire        (registre.en-memoire.test.ts)
//    • contre RegistreSupabase         (registre.supabase.test.ts)
//
//  C'est ce qui empêche le faux de mentir. Si les deux divergent, le
//  CI casse, et on le sait avant la production plutôt qu'après.
//
//  Ce fichier ne teste QUE ce que le port promet. Tout ce qui tient à
//  Postgres — le refus d'écrire dans un sujet clos, les contraintes de
//  solde — est testé en pgTAP, dans la base, parce que c'est là que ça
//  vit.
// ════════════════════════════════════════════════════════════════════

import { assert, assertEquals } from "@std/assert";
import type { Evenement } from "../domaine/cloture.ts";
import type { Registre } from "../application/ports.ts";

export type Chantier = {
  readonly registre: Registre;
  readonly ranger: () => Promise<void>;
};

const BALL = 1;
const POTION = 2;
const ANNA = "11111111-1111-1111-1111-111111111111";
const BORIS = "22222222-2222-2222-2222-222222222222";

function trouve(evenement: Evenement): Evenement {
  return evenement;
}

/** Compare deux ensembles de lignes sans tenir compte de l'ordre :
 *  le port ne promet aucun ordre, c'est le domaine qui trie. */
function memesLignes(
  recu: readonly { messageId: number; evenement: Evenement }[],
  attendu: readonly { messageId: number; evenement: Evenement }[],
): void {
  const cle = (l: { messageId: number; evenement: Evenement }): string =>
    `${l.messageId}|${JSON.stringify(l.evenement)}`;
  assertEquals([...recu].map(cle).sort(), [...attendu].map(cle).sort());
}

/**
 * @param nom      le nom de l'implémentation, affiché devant chaque test
 * @param monter   fabrique un registre vide et de quoi le ranger après
 */
export function contratDuRegistre(
  nom: string,
  monter: () => Promise<Chantier>,
): void {
  const essai = (titre: string, corps: (r: Registre) => Promise<void>): void => {
    Deno.test(`${nom} · ${titre}`, async () => {
      const chantier = await monter();
      try {
        await corps(chantier.registre);
      } finally {
        await chantier.ranger();
      }
    });
  };

  essai("un sujet sans ligne rend une liste vide", async (r) => {
    assertEquals(await r.lignesDuSujet(7000, ANNA), []);
    assertEquals(await r.joueursDuSujet(7000), []);
  });

  essai("ce qu'on inscrit se relit à l'identique", async (r) => {
    const e = trouve({ type: "objet_trouve", objetId: BALL, quantite: 2 });
    await r.inscrire(7000, ANNA, 8001, e, "WM-ACDE-FGH");
    memesLignes(await r.lignesDuSujet(7000, ANNA), [{ messageId: 8001, evenement: e }]);
  });

  essai("la charge d'un événement survit au voyage", async (r) => {
    const capture = trouve({ type: "capture", especeId: 215, niveau: 19 });
    const xp = trouve({ type: "xp", pokemonId: "galopa", gain: 180 });
    const argent = trouve({ type: "pokedollars", montant: -350 });
    await r.inscrire(7000, ANNA, 8001, capture, "WM-ACDE-FG3");
    await r.inscrire(7000, ANNA, 8002, xp, "WM-ACDE-FG4");
    await r.inscrire(7000, ANNA, 8003, argent, "WM-ACDE-FG6");
    memesLignes(await r.lignesDuSujet(7000, ANNA), [
      { messageId: 8001, evenement: capture },
      { messageId: 8002, evenement: xp },
      { messageId: 8003, evenement: argent },
    ]);
  });

  essai("le même événement sur le même message ne compte qu'une fois", async (r) => {
    const e = trouve({ type: "croise", especeId: 37 });
    await r.inscrire(7000, ANNA, 8001, e, "WM-ACDE-FGH");
    await r.inscrire(7000, ANNA, 8001, e, "WM-ACDE-FGJ");
    assertEquals((await r.lignesDuSujet(7000, ANNA)).length, 1);
  });

  essai("deux événements de types différents tiennent sur un seul message", async (r) => {
    await r.inscrire(7000, ANNA, 8001, trouve({ type: "croise", especeId: 37 }), "WM-ACDE-FGH");
    await r.inscrire(
      7000,
      ANNA,
      8001,
      trouve({ type: "capture", especeId: 37, niveau: 8 }),
      "WM-ACDE-FGJ",
    );
    assertEquals((await r.lignesDuSujet(7000, ANNA)).length, 2);
  });

  essai("les lignes d'un joueur ne débordent pas sur un autre", async (r) => {
    await r.inscrire(7000, ANNA, 8001, trouve({ type: "croise", especeId: 37 }), "WM-ACDE-FGH");
    await r.inscrire(
      7000,
      BORIS,
      8002,
      trouve({ type: "croise", especeId: 95 }),
      "WM-ACDE-FGJ",
    );
    assertEquals((await r.lignesDuSujet(7000, ANNA)).length, 1);
    assertEquals((await r.lignesDuSujet(7000, BORIS)).length, 1);
    memesLignes(await r.lignesDuSujet(7000, ANNA), [
      { messageId: 8001, evenement: { type: "croise", especeId: 37 } },
    ]);
  });

  essai("les lignes d'un sujet ne débordent pas sur un autre", async (r) => {
    await r.inscrire(7000, ANNA, 8001, trouve({ type: "croise", especeId: 37 }), "WM-ACDE-FGH");
    await r.inscrire(7001, ANNA, 8002, trouve({ type: "croise", especeId: 95 }), "WM-ACDE-FGJ");
    assertEquals((await r.lignesDuSujet(7000, ANNA)).length, 1);
    assertEquals((await r.lignesDuSujet(7001, ANNA)).length, 1);
  });

  essai("joueursDuSujet nomme chacun une seule fois", async (r) => {
    await r.inscrire(7000, ANNA, 8001, trouve({ type: "croise", especeId: 37 }), "WM-ACDE-FGH");
    await r.inscrire(7000, ANNA, 8002, trouve({ type: "croise", especeId: 38 }), "WM-ACDE-FGJ");
    await r.inscrire(
      7000,
      BORIS,
      8003,
      trouve({ type: "croise", especeId: 39 }),
      "WM-ACDE-FGK",
    );
    assertEquals([...(await r.joueursDuSujet(7000))].sort(), [ANNA, BORIS].sort());
  });

  essai("oublier efface tout le sujet, pour tout le monde", async (r) => {
    await r.inscrire(7000, ANNA, 8001, trouve({ type: "croise", especeId: 37 }), "WM-ACDE-FGH");
    await r.inscrire(
      7000,
      BORIS,
      8002,
      trouve({ type: "croise", especeId: 95 }),
      "WM-ACDE-FGJ",
    );
    await r.inscrire(7001, ANNA, 8003, trouve({ type: "croise", especeId: 12 }), "WM-ACDE-FGK");

    assertEquals(await r.oublier(7000), 2);
    assertEquals(await r.lignesDuSujet(7000, ANNA), []);
    assertEquals(await r.lignesDuSujet(7000, BORIS), []);
    assertEquals(await r.joueursDuSujet(7000), []);
    // le sujet voisin n'a pas bougé
    assertEquals((await r.lignesDuSujet(7001, ANNA)).length, 1);
  });

  essai("oublier un sujet vide n'efface rien et ne lève pas", async (r) => {
    assertEquals(await r.oublier(9999), 0);
  });

  essai("après un oubli, le même message peut être réinscrit", async (r) => {
    const e = trouve({ type: "croise", especeId: 37 });
    await r.inscrire(7000, ANNA, 8001, e, "WM-ACDE-FGH");
    await r.oublier(7000);
    await r.inscrire(7000, ANNA, 8001, e, "WM-ACDE-FGH");
    assertEquals((await r.lignesDuSujet(7000, ANNA)).length, 1);
  });

  essai("un sujet à deux joueurs garde bien les deux registres", async (r) => {
    await r.inscrire(
      7000,
      ANNA,
      8001,
      trouve({ type: "objet_utilise", objetId: BALL, quantite: 1 }),
      "WM-ACDE-FGH",
    );
    await r.inscrire(
      7000,
      BORIS,
      8002,
      trouve({ type: "objet_utilise", objetId: POTION, quantite: 1 }),
      "WM-ACDE-FGJ",
    );
    const a = await r.lignesDuSujet(7000, ANNA);
    const b = await r.lignesDuSujet(7000, BORIS);
    assert(a.length === 1 && b.length === 1);
    assertEquals(a[0].evenement, { type: "objet_utilise", objetId: BALL, quantite: 1 });
    assertEquals(b[0].evenement, { type: "objet_utilise", objetId: POTION, quantite: 1 });
  });
}
