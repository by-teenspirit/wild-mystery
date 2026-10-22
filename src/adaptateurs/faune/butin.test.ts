// ════════════════════════════════════════════════════════════════════
//  src/adaptateurs/faune/butin.test.ts
//
//  Ce que ces tests protègent.
//
//  **Qu'un fichier de butin abîmé soit REFUSÉ**, et pas lu de travers.
//  C'est la différence d'avec les fossiles, qui rendent une table vide :
//  une table de butin cassée ne veut pas dire « pas d'objet cette
//  fois », elle veut dire qu'on ne sait plus ce qu'une fouille rend. La
//  verser quand même, c'est écrire au registre des Pokédollars à la
//  place d'objets — et le registre, ça reste.
//
//  **Que le VRAI fichier du dépôt se lise**, avec ses dix-sept zones.
//  Un test sur des fixtures seules ne dirait rien du fichier livré.
// ════════════════════════════════════════════════════════════════════

import { assert, assertEquals, assertRejects, assertThrows } from "@std/assert";
import { ButinEnFichiers, ButinIllisible, tableDepuis } from "./butin.ts";
import { fouiller } from "../../domaine/fouille.ts";

const TAUX = { bredouille: 20, fossileEntier: 0.2, morceauDeFossile: 10, objet: 25 };

function fichier(zones: unknown, taux: unknown = TAUX): string {
  return JSON.stringify({ fouille: taux, zones });
}

const UNE_ZONE = [
  { forumId: 9, objets: [{ objet: 990040, pct: 16 }, { objet: 990001, pct: 9 }] },
];

// ── la lecture ──────────────────────────────────────────────────────

Deno.test("les taux et les listes se lisent", async () => {
  const t = new ButinEnFichiers(() => Promise.resolve(fichier(UNE_ZONE)));
  assertEquals(await t.taux(), TAUX);
  assertEquals(await t.butinDe(9), [
    { objetId: 990040, pourcentage: 16 },
    { objetId: 990001, pourcentage: 9 },
  ]);
});

Deno.test("le fichier n'est lu qu'une fois, même pour trois questions", async () => {
  let appels = 0;
  const t = new ButinEnFichiers(() => {
    appels++;
    return Promise.resolve(fichier(UNE_ZONE));
  });
  await Promise.all([t.taux(), t.butinDe(9), t.taux()]);
  await t.butinDe(9);
  assertEquals(appels, 1, "une lecture par passage, pas une par fouille");
});

Deno.test("la racine est préfixée au chemin", async () => {
  const demandes: string[] = [];
  const racine = "https://cdn.exemple.fr/wild-mystery@v1/";
  const t = new ButinEnFichiers((c) => {
    demandes.push(c);
    return Promise.resolve(fichier(UNE_ZONE));
  }, racine);
  await t.taux();
  assertEquals(demandes, [racine + "data/butin.json"]);
});

// ── les refus ───────────────────────────────────────────────────────

Deno.test("UNE ZONE SANS TABLE EST UN REFUS, PAS UNE LISTE VIDE", async () => {
  //  Le cas vient d'un `butin.json` en retard sur `zones.json` — une
  //  zone ajoutée et le script pas relancé. Rendre une liste vide
  //  ferait fouiller avec une part « objet » de 25 % et rien à tirer :
  //  le domaine lèverait, mais plus loin et avec un message qui ne
  //  dirait pas ça.
  const t = new ButinEnFichiers(() => Promise.resolve(fichier(UNE_ZONE)));
  await assertRejects(() => t.butinDe(34), ButinIllisible, "n'a pas de table de butin");
});

Deno.test("un réseau coupé REMONTE, il ne se tait pas", async () => {
  //  Même raison : sans la table, on ne sait pas ce qu'une fouille
  //  rend. La relève note la zone en échec et le curseur ne bouge pas,
  //  donc les messages seront relus.
  const t = new ButinEnFichiers(() => Promise.reject(new Error("HTTP 503")));
  await assertRejects(() => t.taux(), Error, "HTTP 503");
});

Deno.test("du JSON cassé est refusé en nommant le fichier", () => {
  const e = assertThrows(() => tableDepuis("{ pas du json"), ButinIllisible);
  assert((e as Error).message.includes("data/butin.json"), (e as Error).message);
});

Deno.test("LES PARTS QUI NE S'ACCORDENT PAS SONT REFUSÉES AU CHARGEMENT", () => {
  //  C'est le contrôle qui compte : `butin.json` porte les taux ET les
  //  listes. Si la somme d'une zone ne vaut pas la part « objet », une
  //  des deux a été modifiée à la main. Ça casse au chargement, pas au
  //  premier joueur qui fouille.
  const e = assertThrows(
    () => tableDepuis(fichier([{ forumId: 9, objets: [{ objet: 1, pct: 30 }] }])),
    Error,
  );
  assert((e as Error).message.includes("30"), (e as Error).message);
});

Deno.test("chaque forme abîmée a son refus", () => {
  const mauvais: readonly [string, string][] = [
    ["la racine n'est pas un objet", JSON.stringify([1, 2])],
    ["la clé « fouille »", JSON.stringify({ zones: UNE_ZONE })],
    ["fouille.bredouille", fichier(UNE_ZONE, { ...TAUX, bredouille: "vingt" })],
    ["fouille.objet", fichier(UNE_ZONE, { ...TAUX, objet: null })],
    ["la clé « zones »", JSON.stringify({ fouille: TAUX, zones: "non" })],
    ["aucune zone", fichier([])],
    ["une zone n'est pas un objet", fichier(["Forêt"])],
    ["zone.forumId", fichier([{ objets: [] }])],
    ["pas de tableau « objets »", fichier([{ forumId: 9 }])],
    ["une ligne n'est pas un objet", fichier([{ forumId: 9, objets: ["Potion"] }])],
    ["objet", fichier([{ forumId: 9, objets: [{ pct: 25 }] }])],
    ["pct", fichier([{ forumId: 9, objets: [{ objet: 1 }] }])],
    [
      "est là deux fois",
      fichier([
        { forumId: 9, objets: [{ objet: 1, pct: 25 }] },
        { forumId: 9, objets: [{ objet: 1, pct: 25 }] },
      ]),
    ],
  ];
  for (const [extrait, texte] of mauvais) {
    const e = assertThrows(() => tableDepuis(texte), Error, undefined, extrait);
    assert(
      (e as Error).message.includes(extrait),
      `attendu « ${extrait} », reçu « ${(e as Error).message} »`,
    );
  }
});

// ════════════════════════════════════════════════════════════════════
//  Le vrai fichier du dépôt
// ════════════════════════════════════════════════════════════════════

const RACINE = new URL("../../../", import.meta.url).pathname;
const VRAI = await Deno.readTextFile(RACINE + "data/butin.json");

Deno.test("le vrai fichier · dix-sept zones, et des parts qui s'accordent", async () => {
  //  `tableDepuis` vérifie chaque zone par le domaine en la chargeant :
  //  si ce test passe, les dix-sept tables sont jouables.
  const t = new ButinEnFichiers(() => Promise.resolve(VRAI));
  const taux = await t.taux();
  assertEquals(taux.bredouille + taux.fossileEntier + taux.morceauDeFossile + taux.objet, 55.2);

  const zones = (JSON.parse(VRAI) as { zones: { forumId: number }[] }).zones;
  assertEquals(zones.length, 17);
  for (const { forumId } of zones) {
    const lignes = await t.butinDe(forumId);
    assert(lignes.length >= 7, `le forum ${forumId} n'a que ${lignes.length} objets`);
  }
});

Deno.test("le vrai fichier · une fouille réelle rend quelque chose de jouable", async () => {
  //  Le bout à bout : le fichier livré, le domaine, et les cinq issues.
  const t = new ButinEnFichiers(() => Promise.resolve(VRAI));
  const taux = await t.taux();
  const butin = await t.butinDe(9);
  const objets = new Set(butin.map((l) => l.objetId));

  const vues = new Set<string>();
  for (let g = 0; g < 3000; g++) {
    const trouvaille = fouiller(g, 1, taux, butin);
    vues.add(trouvaille.genre);
    if (trouvaille.genre === "objet") {
      assert(objets.has(trouvaille.objetId), `objet ${trouvaille.objetId} hors de la table`);
    }
  }
  assertEquals([...vues].sort(), ["bredouille", "fossile", "objet", "pokedollars"]);
});
