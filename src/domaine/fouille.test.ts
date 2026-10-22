// ════════════════════════════════════════════════════════════════════
//  src/domaine/fouille.test.ts
//
//  Ce que ces tests protègent.
//
//  **Que les cinq issues fassent 100, et une seule à la fois.** Avant le
//  15 octobre, fouiller rendait des Pokédollars et le fossile se tirait
//  à part : une fouille pouvait donner les deux. Une table dont les
//  parts font 100 se lit d'un coup — et se vérifie.
//
//  **Que les taux viennent de la donnée**, pas d'ici. Ce fichier ne
//  connaît aucun chiffre de jeu : il reçoit les parts et vérifie qu'elles
//  sont honorées. Les vrais chiffres sont dans `data/butin.json`, et
//  c'est le garde-fou n° 23 qui vérifie qu'ils dérivent de leurs sources.
//
//  **Que le montant reste reproductible.** Même message, même trouvaille,
//  des années plus tard : c'est ce qui permet de trancher une
//  contestation au lieu d'en débattre.
// ════════════════════════════════════════════════════════════════════

import { assert, assertEquals, assertFalse, assertThrows } from "@std/assert";
import {
  estUnPalier,
  fouiller,
  type LigneDeButin,
  type Palier,
  PalierInvalide,
  type TauxDeFouille,
  TauxInvalides,
  verifieLesTaux,
} from "./fouille.ts";

const PALIERS: readonly Palier[] = [1, 2, 3];

//  Les parts du dépôt au 15 octobre, recopiées pour que les tests
//  ressemblent à la réalité — mais aucun test ne dépend de ces valeurs :
//  ils dépendent de ce qu'on leur donne.
const TAUX: TauxDeFouille = {
  bredouille: 20,
  fossileEntier: 0.2,
  morceauDeFossile: 10,
  objet: 25,
};

const BUTIN: readonly LigneDeButin[] = [
  { objetId: 990040, pourcentage: 16 },
  { objetId: 990001, pourcentage: 8 },
  { objetId: 990080, pourcentage: 1 },
];

const SANS_OBJET: TauxDeFouille = { ...TAUX, objet: 0 };

function issues(
  n: number,
  taux: TauxDeFouille = TAUX,
  butin: readonly LigneDeButin[] = BUTIN,
  palier: Palier = 2,
): string[] {
  return Array.from({ length: n }, (_, g) => fouiller(g, palier, taux, butin).genre);
}

// ── la reproductibilité, qui porte tout le reste ────────────────────

Deno.test("même message, même trouvaille — pour toujours", () => {
  for (const graine of [15546, 1, 999999]) {
    assertEquals(
      fouiller(graine, 1, TAUX, BUTIN),
      fouiller(graine, 1, TAUX, BUTIN),
      String(graine),
    );
  }
});

Deno.test("deux messages voisins ne donnent pas la même chose", () => {
  //  Sinon fouiller deux fois de suite rapporterait mécaniquement la
  //  même chose, et ça se verrait.
  const vues = new Set(
    Array.from({ length: 50 }, (_, i) => JSON.stringify(fouiller(15000 + i, 2, TAUX, BUTIN))),
  );
  assert(vues.size > 5, `trop peu de résultats distincts : ${vues.size}`);
});

// ── les cinq issues ─────────────────────────────────────────────────

Deno.test("LES CINQ ISSUES SORTENT TOUTES", () => {
  //  Une issue qu'on n'atteint jamais est une issue dont personne ne
  //  saura qu'elle est fausse. L'entier est à 0,2 % : il faut du volume.
  const vues = new Set(issues(20000));
  assertEquals(
    [...vues].sort(),
    ["bredouille", "fossile", "objet", "pokedollars"],
  );
  const entiers = Array.from({ length: 20000 }, (_, g) => fouiller(g, 2, TAUX, BUTIN))
    .filter((t) => t.genre === "fossile" && t.entier);
  assert(entiers.length > 0, "le fossile entier n'est jamais atteint");
});

Deno.test("UNE FOUILLE NE REND QU'UNE CHOSE", () => {
  //  La forme du type l'impose déjà, mais c'est la règle qui a changé le
  //  15 octobre et elle méritait son test : on vérifie qu'aucune
  //  trouvaille ne porte à la fois un montant et un objet.
  for (let g = 0; g < 2000; g++) {
    const t = fouiller(g, 3, TAUX, BUTIN);
    const champs = Object.keys(t).filter((c) => c !== "genre");
    assert(champs.length <= 1, `${JSON.stringify(t)} porte ${champs.length} champs`);
  }
});

Deno.test("chaque part est honorée, à peu près", () => {
  //  On borne large : le test protège la mécanique des tranches, pas la
  //  décimale. Une tranche inversée ou oubliée se voit tout de suite.
  const n = 20000;
  const tirees = issues(n);
  const part = (genre: string) => (100 * tirees.filter((t) => t === genre).length) / n;
  assert(Math.abs(part("bredouille") - 20) < 3, `bredouille : ${part("bredouille")} %`);
  assert(Math.abs(part("objet") - 25) < 3, `objet : ${part("objet")} %`);
  assert(Math.abs(part("fossile") - 10.2) < 3, `fossile : ${part("fossile")} %`);
  assert(Math.abs(part("pokedollars") - 44.8) < 3, `pokédollars : ${part("pokedollars")} %`);
});

Deno.test("on rentre parfois bredouille, et c'est un résultat, pas une panne", () => {
  //  Une fouille qui donne toujours quelque chose est un distributeur.
  const bredouilles = issues(400).filter((g) => g === "bredouille").length;
  assert(bredouilles > 400 * 0.10, `trop peu de bredouilles : ${bredouilles}`);
  assert(bredouilles < 400 * 0.32, `trop de bredouilles : ${bredouilles}`);
});

// ── les objets ──────────────────────────────────────────────────────

Deno.test("LE TIRAGE DE L'OBJET EST UN SECOND TIRAGE", () => {
  //  Le piège : réutiliser le nombre qui a choisi la tranche. Il est
  //  déjà borné par elle, donc une seule ligne de la table sortirait —
  //  celle qui tombe au bon endroit de la tranche. On vérifie que les
  //  trois sortent.
  const vus = new Set<number>();
  for (let g = 0; g < 5000; g++) {
    const t = fouiller(g, 1, TAUX, BUTIN);
    if (t.genre === "objet") vus.add(t.objetId);
  }
  assertEquals([...vus].sort(), [990001, 990040, 990080]);
});

Deno.test("un objet rare sort moins souvent qu'un objet commun", () => {
  //  16 contre 1 dans la table : le rapport doit se voir. C'est ce qui
  //  fait que le prix d'un objet veut dire quelque chose.
  const compte = new Map<number, number>();
  for (let g = 0; g < 20000; g++) {
    const t = fouiller(g, 1, TAUX, BUTIN);
    if (t.genre === "objet") compte.set(t.objetId, (compte.get(t.objetId) ?? 0) + 1);
  }
  const commun = compte.get(990040) ?? 0;
  const rare = compte.get(990080) ?? 0;
  assert(commun > rare * 5, `${commun} communs pour ${rare} rares`);
});

Deno.test("une zone sans butin ne tire aucun objet", () => {
  //  Part « objet » à zéro ET table vide : les deux doivent être
  //  d'accord, et la fouille se partage entre les quatre autres issues.
  const vues = new Set(issues(3000, SANS_OBJET, []));
  assertFalse(vues.has("objet"));
  assert(vues.has("pokedollars"));
});

// ── les Pokédollars ─────────────────────────────────────────────────

Deno.test("le montant reste dans les bornes du palier", () => {
  const bornes: Record<Palier, [number, number]> = {
    1: [20, 60],
    2: [50, 120],
    3: [100, 240],
  };
  for (const palier of PALIERS) {
    const [bas, haut] = bornes[palier];
    for (let graine = 1; graine <= 300; graine++) {
      const t = fouiller(graine, palier, TAUX, BUTIN);
      if (t.genre !== "pokedollars") continue;
      // L'arrondi à la dizaine peut déborder d'au plus 5 de chaque côté.
      assert(
        t.montant >= bas - 5 && t.montant <= haut + 5,
        `palier ${palier}, graine ${graine} : ${t.montant}`,
      );
    }
  }
});

Deno.test("un palier plus haut rapporte plus, en moyenne", () => {
  //  La règle lisible du barème : fouiller là où personne d'autre ne peut
  //  aller doit se voir.
  const moyenne = (palier: Palier) => {
    const montants = Array.from({ length: 800 }, (_, i) => fouiller(i, palier, TAUX, BUTIN))
      .filter((t) => t.genre === "pokedollars")
      .map((t) => (t.genre === "pokedollars" ? t.montant : 0));
    return montants.reduce((s, n) => s + n, 0) / montants.length;
  };
  assert(moyenne(1) < moyenne(2), "palier 2 doit battre palier 1");
  assert(moyenne(2) < moyenne(3), "palier 3 doit battre palier 2");
});

Deno.test("le montant est arrondi à la dizaine", () => {
  for (let g = 0; g < 500; g++) {
    const t = fouiller(g, 3, TAUX, BUTIN);
    if (t.genre === "pokedollars") assertEquals(t.montant % 10, 0, `${t.montant}`);
  }
});

Deno.test("LE PALIER N'EST PAS DEVINÉ", () => {
  //  Un palier 0 ou 4 serait une donnée abîmée. On lève plutôt que de
  //  verser un montant choisi au hasard dans un barème qu'on aurait
  //  complété soi-même.
  for (const faux of [0, 4, -1, 1.5, Number.NaN]) {
    assertThrows(() => fouiller(1, faux, TAUX, BUTIN), PalierInvalide, String(faux));
  }
  assert(estUnPalier(1) && estUnPalier(2) && estUnPalier(3));
  assertFalse(estUnPalier(0));
  assertFalse(estUnPalier(4));
});

// ── les taux, qui viennent de deux fichiers qui doivent s'accorder ──

Deno.test("LA TABLE D'OBJETS DOIT VALOIR LA PART « OBJET »", () => {
  //  C'est le contrôle qui compte le plus de ce fichier. `butin.json`
  //  porte les taux ET les listes : si la somme d'une zone ne vaut pas
  //  la part annoncée, une des deux a été modifiée à la main, et la
  //  fouille tirerait des objets à une fréquence que personne n'a
  //  écrite — en l'inscrivant au registre, où ça reste.
  const trop = [{ objetId: 1, pourcentage: 30 }];
  const e = assertThrows(() => fouiller(1, 1, TAUX, trop), TauxInvalides);
  assert((e as Error).message.includes("30"), (e as Error).message);
  assertThrows(() => verifieLesTaux(TAUX, []), TauxInvalides);
  //  Et l'accord exact passe, à la tolérance d'arrondi près.
  verifieLesTaux(TAUX, [{ objetId: 1, pourcentage: 24.9995 }]);
});

Deno.test("des parts qui dépassent 100 sont refusées", () => {
  //  Il ne resterait rien aux Pokédollars, et la dernière tranche
  //  mangerait les autres en silence.
  assertThrows(
    () => verifieLesTaux({ ...TAUX, bredouille: 70 }, BUTIN),
    TauxInvalides,
    "il ne reste rien",
  );
});

Deno.test("une part absente ou négative est refusée", () => {
  for (const faux of [-1, Number.NaN, Infinity]) {
    assertThrows(
      () => verifieLesTaux({ ...TAUX, bredouille: faux }, BUTIN),
      TauxInvalides,
      undefined,
      String(faux),
    );
  }
});

Deno.test("une ligne d'objet nulle ou négative est refusée", () => {
  //  Zéro pour cent, c'est un objet qu'on écrit dans la table et qu'on
  //  ne trouvera jamais : plus probablement une faute de frappe qu'une
  //  intention.
  assertThrows(
    () =>
      verifieLesTaux({ ...TAUX, objet: 24 }, [
        { objetId: 1, pourcentage: 24 },
        { objetId: 2, pourcentage: 0 },
      ]),
    TauxInvalides,
    "nul ou négatif",
  );
});
