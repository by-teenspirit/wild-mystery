// ════════════════════════════════════════════════════════════════════
//  src/adaptateurs/faune/fichiers.test.ts
//
//  Deux séries de tests, et les deux comptent.
//
//  1. Avec un faux lecteur et des fichiers écrits à la main : chaque
//     refus a son test, y compris ceux qu'on espère ne jamais voir.
//  2. Avec les VRAIS fichiers du dépôt : la seule façon de savoir que
//     les 298 tables relevées le 2 octobre passent encore. Un test qui
//     ne lirait que des fixtures ne dirait rien des données livrées.
// ════════════════════════════════════════════════════════════════════

import { assert, assertEquals, assertRejects, assertThrows } from "@std/assert";
import {
  ConditionInconnue,
  DonneesIllisibles,
  FauneEnFichiers,
  lecteurDeno,
  type LecteurDeTexte,
  LieuInconnu,
  reduire,
  ZoneInconnue,
  ZoneSansFaune,
} from "./fichiers.ts";
import { tirerUneRencontre, verifieTable } from "../../domaine/rencontre.ts";

// ── un faux lecteur ─────────────────────────────────────────────────

type Feinte = {
  readonly lire: LecteurDeTexte;
  /** Les chemins demandés, dans l'ordre : c'est ainsi qu'on vérifie
   *  qu'un fichier n'est lu qu'une fois. */
  readonly demandes: string[];
};

function lecteurFeint(fichiers: Record<string, string>): Feinte {
  const demandes: string[] = [];
  const lire = (chemin: string): Promise<string> => {
    demandes.push(chemin);
    const texte = fichiers[chemin];
    if (texte === undefined) return Promise.reject(new Error(`absent : ${chemin}`));
    return Promise.resolve(texte);
  };
  return { lire, demandes };
}

const UNE_ENTREE = { espece: 16, nom: "Roucool", pct: 100, min: 2, max: 5, rarete: "commun" };

function zonesFeintes(...zones: unknown[]): string {
  return JSON.stringify({ zones });
}

const ZONE_SIMPLE = {
  forumId: 9,
  nom: "Forêt Marécageuse",
  palier: 1,
  parentId: 96,
  faune: "data/faune/9.json",
};

const FAUNE_SIMPLE = JSON.stringify({
  forumId: 9,
  zone: "Forêt Marécageuse",
  lieux: {
    "Lisière de Samaragd": { jour: [UNE_ENTREE], nuit: [UNE_ENTREE] },
    "Clairière aux Lucioles": { nuit: [UNE_ENTREE] },
  },
});

function fauneSimple(): FauneEnFichiers {
  const { lire } = lecteurFeint({
    "data/zones.json": zonesFeintes(ZONE_SIMPLE, {
      forumId: 31,
      nom: "Manoir Barjok",
      palier: 2,
      parentId: 97,
      faune: null,
    }),
    "data/faune/9.json": FAUNE_SIMPLE,
  });
  return new FauneEnFichiers(lire);
}

// ── la réduction des noms ───────────────────────────────────────────

Deno.test("reduire · enlève accents, casse et espaces en trop", () => {
  assertEquals(reduire("Lisière de Samaragd"), "lisiere de samaragd");
  assertEquals(reduire("  CLAIRIÈRE   aux Lucioles  "), "clairiere aux lucioles");
  assertEquals(reduire("Tempête de Sable"), "tempete de sable");
});

Deno.test("un lieu se retrouve même sans accents ni casse", async () => {
  const f = fauneSimple();
  const table = await f.tableDe(9, "lisiere de samaragd", "JOUR");
  assertEquals(table.length, 1);
  assertEquals(table[0].especeId, 16);
});

// ── les zones ───────────────────────────────────────────────────────

Deno.test("zonesSauvages · dit laquelle a une faune et laquelle n'en a pas", async () => {
  const zones = await fauneSimple().zonesSauvages();
  assertEquals(zones.length, 2);
  assertEquals(zones[0], {
    forumId: 9,
    nom: "Forêt Marécageuse",
    palier: 1,
    parentId: 96,
    aUneFaune: true,
  });
  assertEquals(zones[1].aUneFaune, false);
});

Deno.test("zones.json n'est lu qu'une fois, même pour trois questions", async () => {
  const { lire, demandes } = lecteurFeint({
    "data/zones.json": zonesFeintes(ZONE_SIMPLE),
    "data/faune/9.json": FAUNE_SIMPLE,
  });
  const f = new FauneEnFichiers(lire);
  await f.zonesSauvages();
  await f.lieuxDe(9);
  await f.tableDe(9, "Lisière de Samaragd", "jour");
  assertEquals(demandes.filter((d) => d === "data/zones.json").length, 1);
  assertEquals(demandes.filter((d) => d === "data/faune/9.json").length, 1);
});

Deno.test("un forum qui n'est pas une zone est refusé, pas deviné", async () => {
  await assertRejects(() => fauneSimple().tableDe(12, "Pyrite", "jour"), ZoneInconnue);
  await assertRejects(() => fauneSimple().lieuxDe(65), ZoneInconnue);
});

Deno.test("une zone sans faune a zéro lieu, et refuse un tirage", async () => {
  const f = fauneSimple();
  assertEquals(await f.lieuxDe(31), []);
  const e = await assertRejects(() => f.tableDe(31, "Grand Hall", "nuit"), ZoneSansFaune);
  assert(e.message.includes("Manoir Barjok"), e.message);
});

// ── les lieux et les conditions ─────────────────────────────────────

Deno.test("lieuxDe · rend les noms affichables, pas les formes réduites", async () => {
  assertEquals(await fauneSimple().lieuxDe(9), [
    "Lisière de Samaragd",
    "Clairière aux Lucioles",
  ]);
});

Deno.test("conditionsDe · rend ce que le lieu a, pas une liste fixe", async () => {
  const f = fauneSimple();
  assertEquals(await f.conditionsDe(9, "Lisière de Samaragd"), ["jour", "nuit"]);
  assertEquals(await f.conditionsDe(9, "Clairière aux Lucioles"), ["nuit"]);
});

Deno.test("un lieu inconnu nomme les lieux connus", async () => {
  const e = await assertRejects(
    () => fauneSimple().tableDe(9, "Caverne Imaginaire", "jour"),
    LieuInconnu,
  );
  assert(e.message.includes("Lisière de Samaragd"), e.message);
});

Deno.test("conditionsDe refuse aussi un lieu inconnu", async () => {
  await assertRejects(() => fauneSimple().conditionsDe(9, "Nulle Part"), LieuInconnu);
});

Deno.test("une condition absente de CE lieu est refusée", async () => {
  const e = await assertRejects(
    () => fauneSimple().tableDe(9, "Clairière aux Lucioles", "jour"),
    ConditionInconnue,
  );
  assert(e.message.includes("nuit"), e.message);
});

// ── les refus de chargement ─────────────────────────────────────────

async function echoue(fichiers: Record<string, string>, extrait: string): Promise<void> {
  const { lire } = lecteurFeint(fichiers);
  const e = await assertRejects(
    () => new FauneEnFichiers(lire).tableDe(9, "Lisière de Samaragd", "jour"),
    DonneesIllisibles,
  );
  assert(e.message.includes(extrait), `attendu « ${extrait} », reçu « ${e.message} »`);
}

Deno.test("du JSON cassé est refusé en nommant le fichier", async () => {
  await echoue({ "data/zones.json": "{ pas du json" }, "data/zones.json");
});

Deno.test("zones.json sans tableau « zones » est refusé", async () => {
  await echoue({ "data/zones.json": JSON.stringify({ zones: "non" }) }, "zones");
});

Deno.test("zones.json vide est refusé plutôt que de rendre une liste vide", async () => {
  await echoue({ "data/zones.json": zonesFeintes() }, "aucune zone");
});

Deno.test("un palier hors de 1–3 est refusé", async () => {
  await echoue(
    { "data/zones.json": zonesFeintes({ ...ZONE_SIMPLE, palier: 4 }) },
    "palier 4",
  );
});

Deno.test("un fichier de faune qui annonce un autre forum est refusé", async () => {
  await echoue({
    "data/zones.json": zonesFeintes(ZONE_SIMPLE),
    "data/faune/9.json": JSON.stringify({
      forumId: 34,
      lieux: { "Lisière de Samaragd": { jour: [UNE_ENTREE] } },
    }),
  }, "annonce le forum 34");
});

Deno.test("une rareté inventée est refusée", async () => {
  await echoue({
    "data/zones.json": zonesFeintes(ZONE_SIMPLE),
    "data/faune/9.json": JSON.stringify({
      forumId: 9,
      lieux: {
        "Lisière de Samaragd": {
          jour: [{ ...UNE_ENTREE, rarete: "légendaire" }],
        },
      },
    }),
  }, "légendaire");
});

Deno.test("une table dont les pourcentages ne font pas 100 casse AU CHARGEMENT", async () => {
  // C'est le domaine qui juge : verifieTable, pas une règle recopiée ici.
  await echoue({
    "data/zones.json": zonesFeintes(ZONE_SIMPLE),
    "data/faune/9.json": JSON.stringify({
      forumId: 9,
      lieux: {
        "Lisière de Samaragd": {
          jour: [{ ...UNE_ENTREE, pct: 60 }, { ...UNE_ENTREE, espece: 19, pct: 30 }],
        },
      },
    }),
  }, "font 90");
});

Deno.test("un niveau au-delà de 100 casse au chargement", async () => {
  await echoue({
    "data/zones.json": zonesFeintes(ZONE_SIMPLE),
    "data/faune/9.json": JSON.stringify({
      forumId: 9,
      lieux: { "Lisière de Samaragd": { jour: [{ ...UNE_ENTREE, max: 101 }] } },
    }),
  }, "2..101");
});

Deno.test("une entrée amputée est refusée", async () => {
  await echoue({
    "data/zones.json": zonesFeintes(ZONE_SIMPLE),
    "data/faune/9.json": JSON.stringify({
      forumId: 9,
      lieux: { "Lisière de Samaragd": { jour: [{ espece: 16, pct: 100 }] } },
    }),
  }, "incomplète");
});

Deno.test("un lieu sans aucune condition est refusé", async () => {
  await echoue({
    "data/zones.json": zonesFeintes(ZONE_SIMPLE),
    "data/faune/9.json": JSON.stringify({
      forumId: 9,
      lieux: { "Lisière de Samaragd": {} },
    }),
  }, "aucune condition");
});

Deno.test("deux lieux qui se réduisent au même nom sont refusés", async () => {
  // « Berge Est » et « berge  est » tireraient dans la même table sans
  // qu'on sache laquelle : mieux vaut refuser le fichier.
  await echoue({
    "data/zones.json": zonesFeintes(ZONE_SIMPLE),
    "data/faune/9.json": JSON.stringify({
      forumId: 9,
      lieux: {
        "Lisière de Samaragd": { jour: [UNE_ENTREE] },
        "lisiere  de  samaragd": { jour: [UNE_ENTREE] },
      },
    }),
  }, "se réduisent");
});

Deno.test("un fichier de faune introuvable remonte l'erreur du lecteur", async () => {
  const { lire } = lecteurFeint({ "data/zones.json": zonesFeintes(ZONE_SIMPLE) });
  await assertRejects(
    () => new FauneEnFichiers(lire).lieuxDe(9),
    Error,
    "absent : data/faune/9.json",
  );
});

Deno.test("la racine est préfixée à chaque chemin", async () => {
  const racine = "https://cdn.jsdelivr.net/gh/by-teenspirit/wild-mystery@v0.1.0/";
  const { lire, demandes } = lecteurFeint({
    [racine + "data/zones.json"]: zonesFeintes(ZONE_SIMPLE),
    [racine + "data/faune/9.json"]: FAUNE_SIMPLE,
  });
  await new FauneEnFichiers(lire, racine).tableDe(9, "Lisière de Samaragd", "jour");
  assertEquals(demandes, [racine + "data/zones.json", racine + "data/faune/9.json"]);
});

// ════════════════════════════════════════════════════════════════════
//  Les vrais fichiers du dépôt
// ════════════════════════════════════════════════════════════════════

/** La racine du dépôt, déduite de l'emplacement de ce fichier : le test
 *  passe quel que soit le dossier d'où `deno test` est lancé. */
const RACINE = new URL("../../../", import.meta.url).pathname;

function vraieFaune(): FauneEnFichiers {
  return new FauneEnFichiers(lecteurDeno(), RACINE);
}

Deno.test("les vrais fichiers · dix-sept zones, TOUTES avec une faune", async () => {
  //  Il y en avait dix le 4 octobre. Les sept dernières — Manoir Barjok,
  //  Usine Désaffectée, Libra Échoué, Oasis Perdue, Planque Snatch,
  //  Relique Sacrée, Volcan Sombre — sont arrivées le 5, générées par
  //  `outils/zones-neuves.py` depuis la planche 39.
  //
  //  **Elles n'ont qu'UN lieu chacune**, et c'est assumé : la V1 ne les
  //  avait pas, elles n'ont donc aucun lieu d'origine. Ce test le fige
  //  pour qu'un découpage futur se voie.
  const zones = await vraieFaune().zonesSauvages();
  assertEquals(zones.length, 17);
  assertEquals(zones.filter((z) => z.aUneFaune).length, 17);
  assertEquals(zones.filter((z) => !z.aUneFaune).map((z) => z.forumId), []);
});

Deno.test("les vrais fichiers · les sept zones neuves n'ont qu'un lieu", async () => {
  const f = vraieFaune();
  for (const forumId of [31, 35, 33, 101, 102, 46, 105]) {
    const lieux = await f.lieuxDe(forumId);
    assertEquals(lieux.length, 1, `le forum ${forumId} n'a plus un seul lieu`);
  }
});

Deno.test("les vrais fichiers · les 312 tables se chargent et sont jouables", async () => {
  const f = vraieFaune();
  let lieux = 0;
  let tables = 0;
  for (const zone of await f.zonesSauvages()) {
    if (!zone.aUneFaune) continue;
    const nomsDeLieux = await f.lieuxDe(zone.forumId);
    assert(nomsDeLieux.length > 0, `${zone.nom} annonce une faune mais n'a aucun lieu`);
    lieux += nomsDeLieux.length;
    for (const lieu of nomsDeLieux) {
      const conditions = await f.conditionsDe(zone.forumId, lieu);
      assert(conditions.length > 0, `${zone.nom} / ${lieu} : aucune condition`);
      for (const condition of conditions) {
        const table = await f.tableDe(zone.forumId, lieu, condition);
        verifieTable(table);
        tables++;
      }
    }
  }
  assertEquals(lieux, 152);
  assertEquals(tables, 312);
});

Deno.test("les vrais fichiers · jour et nuit existent partout", async () => {
  const f = vraieFaune();
  for (const zone of await f.zonesSauvages()) {
    if (!zone.aUneFaune) continue;
    for (const lieu of await f.lieuxDe(zone.forumId)) {
      const c = await f.conditionsDe(zone.forumId, lieu);
      assert(c.includes("jour"), `${zone.nom} / ${lieu} : pas de jour`);
      assert(c.includes("nuit"), `${zone.nom} / ${lieu} : pas de nuit`);
    }
  }
});

Deno.test("les vrais fichiers · un tirage réel est reproductible", async () => {
  // Valeur figée volontairement : si elle change, le tirage a changé de
  // comportement et tous les anciens codes de vérification deviennent faux.
  const table = await vraieFaune().tableDe(9, "Lisière de Samaragd", "jour");
  const premier = tirerUneRencontre(table, "message:8001|Lisière de Samaragd");
  const second = tirerUneRencontre(table, "message:8001|Lisière de Samaragd");
  assertEquals(premier, second);
  assertThrows(() => verifieTable([]));
});
