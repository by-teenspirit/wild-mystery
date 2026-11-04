import { assertEquals, assertThrows } from "@std/assert";
import {
  DOUX_BONUS,
  estUneNature,
  fouillerSelonLaNature,
  graineDeLaRelance,
  graineDuSecondTirage,
  JOVIAL_FOSSILE,
  MALIN_BONUS,
  MASCOTTE,
  multiplicateurDePokedollars,
  multiplicateurDExperience,
  type Nature,
  natureDepuis,
  NatureInconnue,
  NATURES,
  RANG_DE_RARETE,
  tauxSelonLaNature,
  tirerUneRencontreSelonLaNature,
} from "./nature.ts";
import type { EntreeDeTable } from "./rencontre.ts";

//  Les taux de `data/butin.json`, à l'identique. Les recopier plutôt que
//  les inventer : si la donnée bouge, un test qui se trompe de base ne
//  mesure plus ce qu'il croit.
const TAUX = { bredouille: 20, fossileEntier: 0.2, morceauDeFossile: 10, objet: 25 };
const BUTIN = [{ objetId: 990001, pourcentage: 15 }, { objetId: 990020, pourcentage: 10 }];

const TABLE: readonly EntreeDeTable[] = [
  { especeId: 1, pourcentage: 60, niveauMin: 2, niveauMax: 5, rarete: "commun" },
  { especeId: 2, pourcentage: 30, niveauMin: 5, niveauMax: 8, rarete: "peu commun" },
  { especeId: 3, pourcentage: 10, niveauMin: 8, niveauMax: 12, rarete: "rare" },
];

//  Deux espèces de MÊME rareté : c'est la seule forme de table où la
//  règle d'égalité de Sérieux se voit.
const EX_AEQUO: readonly EntreeDeTable[] = [
  { especeId: 1, pourcentage: 40, niveauMin: 2, niveauMax: 5, rarete: "commun" },
  { especeId: 2, pourcentage: 40, niveauMin: 3, niveauMax: 6, rarete: "commun" },
  { especeId: 3, pourcentage: 20, niveauMin: 8, niveauMax: 12, rarete: "rare" },
];

Deno.test("les six natures, et chacune sa mascotte", () => {
  assertEquals(NATURES.length, 6);
  assertEquals(new Set(NATURES).size, 6);
  assertEquals(NATURES.map((n) => MASCOTTE[n]), [
    "Keldeo",
    "Uxie",
    "Hoopa",
    "Shaymin",
    "Cresselia",
    "Celebi",
  ]);
});

Deno.test("on reconnaît une nature, et on refuse le reste", () => {
  assertEquals(estUneNature("doux"), true);
  assertEquals(estUneNature("zorua"), false);
  assertEquals(estUneNature(7), false);
  assertEquals(estUneNature(null), false);
});

Deno.test("LA VALEUR TRAVERSE TROIS COUCHES AVANT D'ARRIVER ICI", () => {
  //  Champ de profil Forumactif, colonne en base, page HTML : aucun des
  //  trois ne dit comment elle a été tapée.
  assertEquals(natureDepuis("Sérieux"), "serieux");
  assertEquals(natureDepuis("  HARDI "), "hardi");
  assertEquals(natureDepuis("serieux"), "serieux");
  assertEquals(natureDepuis("Zorua"), null);
  assertEquals(natureDepuis(""), null);
});

// ── Jovial ──────────────────────────────────────────────────────────

Deno.test("JOVIAL DOUBLE LE FOSSILE, ET LES POKÉDOLLARS DESCENDENT SEULS", () => {
  //  La part « pokédollars » n'existe pas dans `TauxDeFouille` : elle est
  //  le reste de cent. C'est ce qui rend l'avantage impossible à mal
  //  écrire — il n'y a pas de second nombre à tenir d'accord.
  const j = tauxSelonLaNature(TAUX, "jovial");
  assertEquals(j.morceauDeFossile, 20);
  assertEquals(j.fossileEntier, 0.4);
  assertEquals(j.bredouille, TAUX.bredouille);
  assertEquals(j.objet, TAUX.objet);

  const reste = (t: typeof TAUX) =>
    100 - t.bredouille - t.fossileEntier - t.morceauDeFossile - t.objet;
  assertEquals(Math.round(reste(TAUX) * 10) / 10, 44.8);
  assertEquals(Math.round(reste(j) * 10) / 10, 34.6);
  //  Et l'écart est exactement ce que le fossile a gagné.
  assertEquals(Math.round((reste(TAUX) - reste(j)) * 10) / 10, 10.2);
  assertEquals(JOVIAL_FOSSILE, 2);
});

Deno.test("les cinq autres natures fouillent avec les taux qu'on leur donne", () => {
  for (const n of NATURES.filter((n) => n !== "jovial")) {
    assertEquals(tauxSelonLaNature(TAUX, n), TAUX);
  }
});

Deno.test("une nature inconnue est refusée par les taux, pas appliquée", () => {
  assertThrows(
    () => tauxSelonLaNature(TAUX, "zorua" as Nature),
    NatureInconnue,
    "zorua",
  );
});

Deno.test("et le butin d'un Jovial diffère pour de vrai", () => {
  //  Graine 18 : la tranche « objet » du neutre tombe dans la tranche
  //  « morceau de fossile » du Jovial.
  const neutre = fouillerSelonLaNature(18, 1, TAUX, BUTIN, "doux", false);
  const jovial = fouillerSelonLaNature(18, 1, TAUX, BUTIN, "jovial", false);
  assertEquals(neutre.trouvaille.genre, "objet");
  assertEquals(jovial.trouvaille, { genre: "fossile", entier: false });
});

// ── Hardi ───────────────────────────────────────────────────────────

Deno.test("HARDI RELANCE UNE BREDOUILLE, ET LE DIT", () => {
  const r = fouillerSelonLaNature(8, 1, TAUX, BUTIN, "hardi", true);
  assertEquals(r.trouvaille, { genre: "objet", objetId: 990020 });
  //  `relanceUtilisee` remonte parce que le budget du sujet est tenu par
  //  le cas d'usage : sans ce retour, Hardi relancerait à chaque fouille.
  assertEquals(r.relanceUtilisee, true);
});

Deno.test("LA RELANCE EST UNE FOUILLE ORDINAIRE : ELLE PEUT ÉCHOUER", () => {
  //  Lecture littérale de « il peut relancer une fois ». L'autre lecture
  //  — une relance qui ne peut pas être bredouille — ferait tomber la
  //  bredouille d'un Hardi à zéro. Ce test fige celle qu'on a choisie.
  const r = fouillerSelonLaNature(7, 1, TAUX, BUTIN, "hardi", true);
  assertEquals(r.trouvaille, { genre: "bredouille" });
  assertEquals(r.relanceUtilisee, true);
});

Deno.test("la relance dépensée ne se reprend pas", () => {
  const r = fouillerSelonLaNature(8, 1, TAUX, BUTIN, "hardi", false);
  assertEquals(r.trouvaille, { genre: "bredouille" });
  assertEquals(r.relanceUtilisee, false);
});

Deno.test("et on ne relance pas une fouille qui a donné quelque chose", () => {
  const r = fouillerSelonLaNature(1, 1, TAUX, BUTIN, "hardi", true);
  assertEquals(r.trouvaille.genre, "pokedollars");
  assertEquals(r.relanceUtilisee, false);
});

Deno.test("les autres natures ne relancent rien, même bredouilles", () => {
  for (const n of NATURES.filter((n) => n !== "hardi")) {
    const r = fouillerSelonLaNature(8, 1, TAUX, BUTIN, n, true);
    assertEquals(r.relanceUtilisee, false, n);
  }
});

Deno.test("LA GRAINE DE LA RELANCE SE DÉDUIT, ELLE NE SE TIRE PAS", () => {
  //  C'est tout l'intérêt de la graine : le staff doit pouvoir refaire
  //  le tirage des années plus tard pour trancher une contestation.
  assertEquals(graineDeLaRelance(8), graineDeLaRelance(8));
  assertEquals(graineDeLaRelance(8) === graineDeLaRelance(9), false);
});

// ── Sérieux ─────────────────────────────────────────────────────────

Deno.test("l'ordre des raretés sert à comparer, et à rien d'autre", () => {
  assertEquals(RANG_DE_RARETE["commun"] < RANG_DE_RARETE["peu commun"], true);
  assertEquals(RANG_DE_RARETE["peu commun"] < RANG_DE_RARETE["rare"], true);
});

Deno.test("SÉRIEUX TIRE DEUX FOIS ET GARDE LA PLUS RARE", () => {
  //  Graine m4 : commun au premier tirage, rare au second.
  assertEquals(tirerUneRencontreSelonLaNature(TABLE, "m4", "doux").rarete, "commun");
  assertEquals(tirerUneRencontreSelonLaNature(TABLE, "m4", "serieux").rarete, "rare");
});

Deno.test("et il ne perd pas une rareté déjà bonne", () => {
  //  Graine m1 : rare au premier tirage, commun au second. On garde la
  //  première — « la plus rare », pas « la seconde ».
  const seul = tirerUneRencontreSelonLaNature(TABLE, "m1", "doux");
  assertEquals(seul.rarete, "rare");
  assertEquals(tirerUneRencontreSelonLaNature(TABLE, "m1", "serieux"), seul);
});

Deno.test("À RARETÉ ÉGALE, ON GARDE LA PREMIÈRE ESPÈCE", () => {
  //  Sans cette règle, le second tirage remplacerait le premier une fois
  //  sur deux à l'intérieur d'une même tranche, et la liste des espèces
  //  qu'un Sérieux croise ne serait plus celle de la zone. L'avantage
  //  porte sur la rareté ; il ne doit rien changer d'autre.
  const seul = tirerUneRencontreSelonLaNature(EX_AEQUO, "e0", "doux");
  const vu = tirerUneRencontreSelonLaNature(EX_AEQUO, "e0", "serieux");
  assertEquals(seul.rarete, "commun");
  assertEquals(vu, seul);
  //  Et le second tirage portait bien une AUTRE espèce de même rareté :
  //  sans ça le test passerait pour la mauvaise raison.
  const seconde = tirerUneRencontreSelonLaNature(EX_AEQUO, graineDuSecondTirage("e0"), "doux");
  assertEquals(seconde.rarete, "commun");
  assertEquals(seconde.especeId === seul.especeId, false);
});

Deno.test("les autres natures ne tirent qu'une fois", () => {
  for (const n of NATURES.filter((n) => n !== "serieux")) {
    assertEquals(
      tirerUneRencontreSelonLaNature(TABLE, "m4", n),
      tirerUneRencontreSelonLaNature(TABLE, "m4", "doux"),
      n,
    );
  }
});

Deno.test("une nature inconnue est refusée par la rencontre aussi", () => {
  assertThrows(
    () => tirerUneRencontreSelonLaNature(TABLE, "m4", "zorua" as Nature),
    NatureInconnue,
  );
});

// ── Malin ───────────────────────────────────────────────────────────

Deno.test("MALIN GAGNE À TOUT MÉLANGER — six types différents, +10 %", () => {
  const six = ["feu", "eau", "plante", "vol", "roche", "spectre"];
  assertEquals(multiplicateurDExperience("malin", six), 1 + MALIN_BONUS);
  assertEquals(multiplicateurDExperience("malin", six.slice(0, 5)), 1);
});

Deno.test("on compte les types DIFFÉRENTS, pas les pokémon", () => {
  //  Une équipe de six Pyrobut ne fait pas six types.
  assertEquals(multiplicateurDExperience("malin", new Array(6).fill("feu")), 1);
  //  Et « Plante », « plante » et « plante » sont le même type : la
  //  valeur vient de `butin.json` d'un côté et d'une colonne en base de
  //  l'autre.
  assertEquals(
    multiplicateurDExperience("malin", [
      "Plante",
      " plante ",
      "POISON",
      "spectre",
      "vol",
      "eau",
      "feu",
    ]),
    1 + MALIN_BONUS,
  );
});

Deno.test("un type vide ne compte pas pour un type", () => {
  assertEquals(
    multiplicateurDExperience("malin", ["feu", "eau", "plante", "vol", "roche", "", "  "]),
    1,
  );
});

Deno.test("les autres natures n'ont pas de bonus d'expérience", () => {
  const six = ["feu", "eau", "plante", "vol", "roche", "spectre"];
  for (const n of NATURES.filter((n) => n !== "malin")) {
    assertEquals(multiplicateurDExperience(n, six), 1, n);
  }
  assertThrows(() => multiplicateurDExperience("zorua" as Nature, six), NatureInconnue);
});

// ── Doux ────────────────────────────────────────────────────────────

Deno.test("DOUX DONNE +15 % À TOUT LE MONDE DANS LE SUJET", () => {
  assertEquals(multiplicateurDePokedollars(["doux", "brave"]), 1 + DOUX_BONUS);
  assertEquals(multiplicateurDePokedollars(["brave", "malin"]), 1);
});

Deno.test("IL NE SE CUMULE PAS : deux Doux font +15 %, pas +32 %", () => {
  //  La planche dit « tout le monde gagne +15 % » : c'est un drapeau, pas
  //  un produit. Le cumul transformerait l'avantage en course au
  //  recrutement de Doux.
  assertEquals(multiplicateurDePokedollars(["doux", "doux", "doux"]), 1 + DOUX_BONUS);
});

Deno.test("ET IL DEMANDE QUELQU'UN À FAIRE PASSER DEVANT", () => {
  //  Un Doux seul se l'appliquerait à lui-même : +15 % permanent sur
  //  toutes ses fouilles, c'est-à-dire le plus fort des six avantages
  //  déguisé en le plus généreux.
  assertEquals(multiplicateurDePokedollars(["doux"]), 1);
  assertEquals(multiplicateurDePokedollars([]), 1);
});
