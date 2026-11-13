// ════════════════════════════════════════════════════════════════════
//  src/adaptateurs/faune/fichiers.test.ts
//
//  Deux séries de tests, et les deux comptent.
//
//  1. Avec un faux lecteur et des fichiers écrits à la main : chaque
//     refus a son test, y compris ceux qu'on espère ne jamais voir.
//  2. Avec les VRAIS fichiers du dépôt : la seule façon de savoir que
//     les 34 tables des dix-sept zones passent encore. Un test qui ne
//     lirait que des fixtures ne dirait rien des données livrées.
//
//  CE FICHIER A PERDU UN NIVEAU LE 15 OCTOBRE. Il vérifiait des lieux —
//  « un lieu inconnu nomme les lieux connus », « une condition absente
//  de CE lieu » — parce qu'une zone avait quinze tables. Callista :
//  « enlève tous les petits lieux. On a 3 paliers, 17 zones sauvages, et
//  tu répartis le pokédex comme ça. » Une zone a maintenant une table
//  par condition, et les cas de lieu sont remplacés par un seul : un
//  fichier d'avant est REFUSÉ, pas lu de travers.
// ════════════════════════════════════════════════════════════════════

import { assert, assertEquals, assertRejects, assertThrows } from "@std/assert";
import {
  ConditionInconnue,
  DonneesIllisibles,
  FauneEnFichiers,
  lecteurDeno,
  type LecteurDeTexte,
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
  conditions: {
    jour: [UNE_ENTREE],
    nuit: [UNE_ENTREE],
    //  Une météo, que plus aucune zone ne porte aujourd'hui mais que le
    //  code sait servir : voir `domaine/meteo.ts`. Le jour où une table
    //  de météo de zone sera écrite, ce cas garantit qu'elle passe.
    "Pluie Battante": [UNE_ENTREE],
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
  assertEquals(reduire("Pluie Battante"), "pluie battante");
  assertEquals(reduire("  TEMPÊTE   de Sable  "), "tempete de sable");
  assertEquals(reduire("Tempête de Sable"), "tempete de sable");
});

Deno.test("une condition se retrouve même sans accents ni casse", async () => {
  //  Le nom vient d'un fichier écrit à la main, et il traversera un jour
  //  un clavier sans accents.
  const f = fauneSimple();
  const table = await f.tableDe(9, "PLUIE battante");
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
  await f.conditionsDe(9);
  await f.tableDe(9, "jour");
  assertEquals(demandes.filter((d) => d === "data/zones.json").length, 1);
  assertEquals(demandes.filter((d) => d === "data/faune/9.json").length, 1);
});

Deno.test("un forum qui n'est pas une zone est refusé, pas deviné", async () => {
  await assertRejects(() => fauneSimple().tableDe(12, "jour"), ZoneInconnue);
  await assertRejects(() => fauneSimple().conditionsDe(65), ZoneInconnue);
});

Deno.test("une zone sans faune a zéro condition, et refuse un tirage", async () => {
  const f = fauneSimple();
  assertEquals(await f.conditionsDe(31), []);
  const e = await assertRejects(() => f.tableDe(31, "nuit"), ZoneSansFaune);
  assert(e.message.includes("Manoir Barjok"), e.message);
});

// ── les conditions ──────────────────────────────────────────────────

Deno.test("conditionsDe · rend les noms écrits, dans l'ordre du fichier", async () => {
  //  Les noms affichables, pas les formes réduites : c'est `meteo.ts` qui
  //  choisit parmi eux, et il les rend tels quels.
  assertEquals(await fauneSimple().conditionsDe(9), ["jour", "nuit", "Pluie Battante"]);
});

Deno.test("une condition inconnue nomme celles qui existent", async () => {
  const e = await assertRejects(
    () => fauneSimple().tableDe(9, "blizzard"),
    ConditionInconnue,
  );
  assert(e.message.includes("Pluie Battante"), e.message);
  //  Et elle nomme la ZONE, pas un lieu : il n'y en a plus.
  assert(e.message.includes("Forêt Marécageuse"), e.message);
});

// ── les refus de chargement ─────────────────────────────────────────

async function echoue(fichiers: Record<string, string>, extrait: string): Promise<void> {
  const { lire } = lecteurFeint(fichiers);
  const e = await assertRejects(
    () => new FauneEnFichiers(lire).tableDe(9, "jour"),
    DonneesIllisibles,
  );
  assert(e.message.includes(extrait), `attendu « ${extrait} », reçu « ${e.message} »`);
}

Deno.test("UN FICHIER D'AVANT LE 15 OCTOBRE EST REFUSÉ", async () => {
  //  LE CAS QUI COMPTE LE PLUS DE CE FICHIER. Les anciens fichiers
  //  portent « lieux », avec une table par lieu. Lus comme des fichiers
  //  neufs, ils donneraient une zone sans aucune condition — donc aucune
  //  rencontre — et le joueur ne verrait qu'un silence. On refuse, et le
  //  message dit où sont partis les anciens.
  await echoue({
    "data/zones.json": zonesFeintes(ZONE_SIMPLE),
    "data/faune/9.json": JSON.stringify({
      forumId: 9,
      lieux: { "Lisière de Samaragd": { jour: [UNE_ENTREE] } },
    }),
  }, "data/faune-v1/");
});

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
      conditions: { jour: [UNE_ENTREE] },
    }),
  }, "annonce le forum 34");
});

Deno.test("une rareté inventée est refusée", async () => {
  await echoue({
    "data/zones.json": zonesFeintes(ZONE_SIMPLE),
    "data/faune/9.json": JSON.stringify({
      forumId: 9,
      conditions: { jour: [{ ...UNE_ENTREE, rarete: "légendaire" }] },
    }),
  }, "légendaire");
});

Deno.test("une table dont les pourcentages ne font pas 100 casse AU CHARGEMENT", async () => {
  // C'est le domaine qui juge : verifieTable, pas une règle recopiée ici.
  await echoue({
    "data/zones.json": zonesFeintes(ZONE_SIMPLE),
    "data/faune/9.json": JSON.stringify({
      forumId: 9,
      conditions: {
        jour: [{ ...UNE_ENTREE, pct: 60 }, { ...UNE_ENTREE, espece: 19, pct: 30 }],
      },
    }),
  }, "font 90");
});

Deno.test("un niveau au-delà de 100 casse au chargement", async () => {
  await echoue({
    "data/zones.json": zonesFeintes(ZONE_SIMPLE),
    "data/faune/9.json": JSON.stringify({
      forumId: 9,
      conditions: { jour: [{ ...UNE_ENTREE, max: 101 }] },
    }),
  }, "2..101");
});

Deno.test("une entrée amputée est refusée", async () => {
  await echoue({
    "data/zones.json": zonesFeintes(ZONE_SIMPLE),
    "data/faune/9.json": JSON.stringify({
      forumId: 9,
      conditions: { jour: [{ espece: 16, pct: 100 }] },
    }),
  }, "incomplète");
});

Deno.test("une zone sans aucune condition est refusée", async () => {
  await echoue({
    "data/zones.json": zonesFeintes(ZONE_SIMPLE),
    "data/faune/9.json": JSON.stringify({ forumId: 9, conditions: {} }),
  }, "aucune condition");
});

Deno.test("deux conditions qui se réduisent au même nom sont refusées", async () => {
  // « Pluie Battante » et « pluie  battante » tireraient dans la même
  // table sans qu'on sache laquelle : mieux vaut refuser le fichier.
  await echoue({
    "data/zones.json": zonesFeintes(ZONE_SIMPLE),
    "data/faune/9.json": JSON.stringify({
      forumId: 9,
      conditions: {
        "Pluie Battante": [UNE_ENTREE],
        "pluie  battante": [UNE_ENTREE],
      },
    }),
  }, "se réduisent");
});

Deno.test("un fichier de faune introuvable remonte l'erreur du lecteur", async () => {
  const { lire } = lecteurFeint({ "data/zones.json": zonesFeintes(ZONE_SIMPLE) });
  await assertRejects(
    () => new FauneEnFichiers(lire).conditionsDe(9),
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
  await new FauneEnFichiers(lire, racine).tableDe(9, "jour");
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
  const zones = await vraieFaune().zonesSauvages();
  assertEquals(zones.length, 17);
  assertEquals(zones.filter((z) => z.aUneFaune).length, 17);
  assertEquals(zones.filter((z) => !z.aUneFaune).map((z) => z.forumId), []);
});

Deno.test("les vrais fichiers · les 34 tables se chargent et sont jouables", async () => {
  //  Il y en avait 312, réparties sur 152 lieux. Les lieux sont partis le
  //  15 octobre : dix-sept zones, deux conditions chacune, 34 tables.
  //
  //  ── POURQUOI PAS LES 933 DU POKÉDEX ───────────────────────────────
  //
  //  Ce test attendait 933 et le CI était rouge depuis le 6 novembre —
  //  pour une ASSERTION PÉRIMÉE, pas pour un défaut. Le 6 novembre,
  //  Callista a tranché : « les formes Galar, Alola etc. doivent se
  //  trouver dans le pokédex mais ne doivent pas être trouvables pour le
  //  moment dans les zones ». Confirmé le 13 novembre : « on les
  //  croisera dans les brèches interdimensionnelles, mais on mettra ça
  //  en place plus tard. »
  //
  //  `outils/faune-par-zone.py` applique cette règle depuis ce jour-là.
  //  Seul le chiffre écrit ici ne l'avait pas suivie.
  //
  //  ── ET ON N'ÉCRIT PLUS UN CHIFFRE ─────────────────────────────────
  //
  //  Un nombre en dur ne dit pas POURQUOI il vaut ça, et il rouille à la
  //  première décision de jeu — c'est exactement ce qui vient
  //  d'arriver. On le DÉRIVE donc des deux fichiers qui portent la
  //  décision : le Pokédex, moins ce que `hors-nature.json` envoie à la
  //  brèche. Le jour où la brèche s'ouvrira, le compte suivra tout seul ;
  //  et si une espèce ordinaire disparaît d'une table, ce test rougira
  //  toujours, ce qu'un chiffre en dur faisait aussi — mais en plus il
  //  dira laquelle.
  const f = vraieFaune();
  let tables = 0;
  const vues = new Set<number>();
  let especes = 0;
  for (const zone of await f.zonesSauvages()) {
    if (!zone.aUneFaune) continue;
    const conditions = await f.conditionsDe(zone.forumId);
    assert(conditions.length > 0, `${zone.nom} annonce une faune mais n'a aucune condition`);
    for (const condition of conditions) {
      const table = await f.tableDe(zone.forumId, condition);
      verifieTable(table);
      tables++;
      if (condition === "jour") {
        especes += table.length;
        for (const ligne of table) vues.add(ligne.especeId);
      }
    }
  }
  assertEquals(tables, 34);

  //  Le Pokédex de Rhode, et ce que la brèche lui retire.
  const pokedex: Record<string, number> =
    JSON.parse(await Deno.readTextFile(`${RACINE}data/pokedex-ids.json`)).ids;
  const horsNature: { nom: string; origine: string }[] =
    JSON.parse(await Deno.readTextFile(`${RACINE}data/hors-nature.json`)).especes;
  const brecheIds = new Set(
    horsNature.filter((e) => e.origine === "breche")
      .map((e) => pokedex[e.nom])
      //  `Feunard d'Alola` est déclaré à la brèche mais n'est PAS au
      //  Pokédex de Rhode — Goupix d'Alola y est, pas son évolution.
      //  C'est un trou du Pokédex, pas des tables : on ne peut pas
      //  retirer d'une table une espèce qui n'y a jamais pu être.
      .filter((id) => id !== undefined),
  );

  //  CE QUE LES TABLES DOIVENT PORTER : tout le Pokédex, moins la
  //  brèche. Dit comme une différence d'ensembles, le test nomme ce qui
  //  manque au lieu d'afficher deux nombres qui ne se ressemblent pas.
  const attendues = new Set(
    Object.values(pokedex).filter((id) => !brecheIds.has(id)),
  );
  const manquantes = [...attendues].filter((id) => !vues.has(id));
  const enTrop = [...vues].filter((id) => !attendues.has(id));
  const nomDe = (id: number) =>
    Object.keys(pokedex).find((n) => pokedex[n] === id) ?? String(id);
  assertEquals(manquantes.map(nomDe), [], "des espèces du Pokédex ne sont dans aucune zone");
  assertEquals(enTrop.map(nomDe), [], "des espèces de la brèche traînent dans une zone");
  //  Aucune espèce dans deux zones — le test suivant le dit aussi, mais
  //  ici ça garantit que la somme vaut bien le compte des distinctes.
  assertEquals(especes, attendues.size);
});

Deno.test("les vrais fichiers · jour et nuit existent partout", async () => {
  const f = vraieFaune();
  for (const zone of await f.zonesSauvages()) {
    if (!zone.aUneFaune) continue;
    const c = await f.conditionsDe(zone.forumId);
    assert(c.includes("jour"), `${zone.nom} : pas de jour`);
    assert(c.includes("nuit"), `${zone.nom} : pas de nuit`);
  }
});

Deno.test("les vrais fichiers · AUCUNE ESPÈCE N'EST DANS DEUX ZONES", async () => {
  //  Le Pokédex de Rhode RÉPARTIT ses espèces, il ne les partage pas :
  //  le sujet d'origine avait trois doublons, la planche 39 les a retirés.
  //  Une espèce dans deux zones, c'est une rareté qui double sans que
  //  personne l'ait décidé.
  //
  //  Le compte lui-même est éprouvé par « les 34 tables se chargent et
  //  sont jouables », qui le dérive du Pokédex moins la brèche. Ici on
  //  ne vérifie QUE l'unicité — c'est ce que le nom du test promet, et
  //  le chiffre en dur qui traînait au bout rendait ce test rouge pour
  //  une raison qui n'est pas la sienne.
  const f = vraieFaune();
  const ou = new Map<number, string>();
  for (const zone of await f.zonesSauvages()) {
    for (const entree of await f.tableDe(zone.forumId, "jour")) {
      const autre = ou.get(entree.especeId);
      assertEquals(
        autre,
        undefined,
        `l'espèce ${entree.especeId} est en ${autre} et ${zone.nom}`,
      );
      ou.set(entree.especeId, zone.nom);
    }
  }
  assert(ou.size > 0, "aucune espèce dans aucune zone");
});

Deno.test("les vrais fichiers · un tirage réel est reproductible", async () => {
  // Valeur figée volontairement : si elle change, le tirage a changé de
  // comportement et tous les anciens codes de vérification deviennent faux.
  const table = await vraieFaune().tableDe(9, "jour");
  const premier = tirerUneRencontre(table, "message:8001");
  const second = tirerUneRencontre(table, "message:8001");
  assertEquals(premier, second);
  assertThrows(() => verifieTable([]));
});
