import { assertEquals } from "@std/assert";
import {
  type EspeceDeZone,
  filtresDeFaune,
  fourchetteDeNiveaux,
  memeTable,
  motDeLaChance,
  motDeLaFrequence,
  motDesConditions,
  motDuCompteDeFaune,
  type ObjetDeZone,
  parFrequence,
  parRarete,
  partCommune,
  partsDuSol,
  pourCent,
  RARETES,
  typesDe,
  uneFoisSur,
  visibleDansLaFaune,
} from "./faune.ts";

function e(dessus: Partial<EspeceDeZone> = {}): EspeceDeZone {
  return { espece: 1, nom: "Bulbizarre", pct: 2, min: 3, max: 8, rarete: "commun", ...dessus };
}

function o(dessus: Partial<ObjetDeZone> = {}): ObjetDeZone {
  return { objet: 990001, nom: "Poké Ball", famille: "ball", prix: 200, pct: 4, ...dessus };
}

// ── les nombres ─────────────────────────────────────────────────────

Deno.test("ON N'ARRONDIT PAS UN POURCENTAGE À L'ENTIER", () => {
  //  Les parts vont de 0,34 % à 6,12 %. Arrondies, un tiers des espèces
  //  afficheraient « 0 % » — et dire zéro à côté d'une espèce qu'on peut
  //  croiser est un mensonge.
  assertEquals(pourCent(2.0202), "2,02 %");
  assertEquals(pourCent(0.3367), "0,34 %");
  assertEquals(pourCent(0), "0,00 %");
});

Deno.test("et un pourcentage absurde ne s'écrit pas", () => {
  assertEquals(pourCent(-1), "—");
  assertEquals(pourCent(Number.NaN), "—");
});

Deno.test("L'ARRONDI DE « UNE FOIS SUR » MONTE AVEC LE NOMBRE", () => {
  //  Au-delà d'une cinquantaine, l'écart entre 47 et 50 n'apprend rien
  //  et donne à un ordre de grandeur l'air d'une mesure.
  assertEquals(uneFoisSur(50), 2);
  assertEquals(uneFoisSur(6.12), 16);
  assertEquals(uneFoisSur(2.0202), 50);
  assertEquals(uneFoisSur(0.3367), 300);
  assertEquals(uneFoisSur(0.2), 500);
  assertEquals(uneFoisSur(0.05), 2000);
});

Deno.test("et une chance nulle n'écrit pas « une fois sur l'infini »", () => {
  assertEquals(uneFoisSur(0), null);
  assertEquals(uneFoisSur(-3), null);
  assertEquals(uneFoisSur(101), null);
  assertEquals(motDeLaChance(0, "rencontre"), "");
});

Deno.test("le mot compté change avec la table", () => {
  assertEquals(motDeLaChance(2.0202, "rencontre"), "environ 1 rencontre sur 50");
  assertEquals(motDeLaChance(10, "fouille"), "environ 1 fouille sur 10");
});

// ── les espèces ─────────────────────────────────────────────────────

Deno.test("IL Y A TROIS RARETÉS, PAS QUATRE", () => {
  //  La maquette 359:915 en dessine quatre. La donnée en porte trois,
  //  écrites à la main dans les tables.
  assertEquals(RARETES, ["commun", "peu commun", "rare"]);
});

Deno.test("DANS UNE TRANCHE, LA PLUS PROBABLE PASSE DEVANT", () => {
  //  L'ordre du fichier est celui du Pokédex de Rhode, pas celui de la
  //  chance : il mettrait une espèce à 0,34 % avant une à 6,12 % dans la
  //  même tranche, sans rien qui l'explique.
  const t = parRarete([
    e({ espece: 1, pct: 0.5 }),
    e({ espece: 2, pct: 6 }),
    e({ espece: 3, pct: 2, rarete: "rare" }),
    e({ espece: 4, pct: 3 }),
  ]);
  assertEquals(t.map((x) => x.rarete), ["commun", "rare"]);
  assertEquals(t[0].especes.map((x) => x.espece), [2, 4, 1]);
});

Deno.test("et à part égale, le numéro départage — l'ordre ne bouge pas", () => {
  const t = parRarete([e({ espece: 9, pct: 2 }), e({ espece: 4, pct: 2 })]);
  assertEquals(t[0].especes.map((x) => x.espece), [4, 9]);
});

Deno.test("UNE TRANCHE VIDE NE S'AFFICHE PAS", () => {
  //  Une zone de palier 3 peut n'avoir aucun commun, et un titre
  //  « COMMUN » suivi de rien ressemble à une panne.
  const t = parRarete([e({ rarete: "rare" })]);
  assertEquals(t.length, 1);
  assertEquals(t[0].rarete, "rare");
});

Deno.test("la part d'une tranche se compare d'une zone à l'autre", () => {
  const t = parRarete([
    e({ espece: 1, pct: 2.5, rarete: "rare" }),
    e({ espece: 2, pct: 2.5, rarete: "rare" }),
  ]);
  assertEquals(t[0].part, 5);
});

Deno.test("la fourchette de niveaux balaie toute la table", () => {
  assertEquals(
    fourchetteDeNiveaux([e({ min: 3, max: 8 }), e({ min: 1, max: 20 }), e({ min: 5, max: 6 })]),
    { min: 1, max: 20 },
  );
});

Deno.test("ET UNE TABLE VIDE N'AFFICHE PAS « DE L'INFINI À MOINS L'INFINI »", () => {
  assertEquals(fourchetteDeNiveaux([]), null);
});

// ── le jour, la nuit, la météo ──────────────────────────────────────

Deno.test("deux tables se comparent sur ce qui compte, pas sur l'ordre", () => {
  //  L'ordre d'écriture n'a aucun effet sur le tirage.
  const a = [e({ espece: 1 }), e({ espece: 2 })];
  const b = [e({ espece: 2 }), e({ espece: 1 })];
  assertEquals(memeTable(a, b), true);
  assertEquals(memeTable(a, [e({ espece: 1 }), e({ espece: 2, pct: 9 })]), false);
  assertEquals(memeTable(a, [e({ espece: 1 })]), false);
});

Deno.test("AUJOURD'HUI, C'EST JOUR COMME NUIT ET PAR TOUS LES TEMPS", () => {
  //  Les dix-sept zones portent `jour` et `nuit` avec la même liste, et
  //  aucune n'a de table de météo.
  const table = [e({ espece: 1 }), e({ espece: 2, rarete: "rare" })];
  const vu = motDesConditions({ jour: table, nuit: [...table] });
  assertEquals(vu.jourEtNuitPareils, true);
  assertEquals(vu.meteos, []);
  assertEquals(vu.phrase, "La même faune le jour et la nuit, par tous les temps.");
});

Deno.test("MAIS LA PAGE LE MESURE, ELLE NE LE SUPPOSE PAS", () => {
  //  Le jour où une table de nuit sera écrite, la page le dira sans
  //  qu'on y touche.
  const vu = motDesConditions({
    jour: [e({ espece: 1 })],
    nuit: [e({ espece: 2 })],
  });
  assertEquals(vu.jourEtNuitPareils, false);
  assertEquals(vu.phrase, "La nuit ne montre pas la même faune que le jour.");
});

Deno.test("et une météo revenue s'annonce toute seule", () => {
  const table = [e()];
  assertEquals(
    motDesConditions({ jour: table, nuit: [...table], "pluie": [e({ espece: 7 })] }).phrase,
    "Et par pluie, la zone change de faune.",
  );
  //  Les Steppes Arides en avaient deux en V1.
  assertEquals(
    motDesConditions({
      jour: table,
      nuit: [...table],
      "soleil écrasant": [e({ espece: 7 })],
      "tempête de sable": [e({ espece: 8 })],
    }).phrase,
    "Et elle change encore par soleil écrasant ou tempête de sable.",
  );
});

// ── le sol ──────────────────────────────────────────────────────────

const TAUX = { bredouille: 20, fossileEntier: 0.2, morceauDeFossile: 10, objet: 25 };

Deno.test("LES POKÉDOLLARS SE CALCULENT, ILS NE SE LISENT PAS", () => {
  //  `butin.json` en porte une copie. La lire laisserait exister deux
  //  vérités : le jour où une part change, le total ne ferait plus cent
  //  et personne ne le verrait.
  const parts = partsDuSol(TAUX);
  assertEquals(parts.map((p) => p.clef), [
    "objet",
    "pokedollars",
    "morceau",
    "entier",
    "bredouille",
  ]);
  assertEquals(Math.round(parts.reduce((s, p) => s + p.pct, 0) * 10) / 10, 100);
  assertEquals(
    Math.round(parts.find((p) => p.clef === "pokedollars")!.pct * 10) / 10,
    44.8,
  );
});

Deno.test("et un Jovial le verrait tout de suite", () => {
  //  Ses deux chances de fossile sont doublées, et la part de
  //  pokédollars doit descendre d'autant — sans qu'on l'écrive.
  const parts = partsDuSol({ ...TAUX, fossileEntier: 0.4, morceauDeFossile: 20 });
  assertEquals(Math.round(parts.find((p) => p.clef === "pokedollars")!.pct * 10) / 10, 34.6);
  assertEquals(Math.round(parts.reduce((s, p) => s + p.pct, 0) * 10) / 10, 100);
});

Deno.test("LA FRÉQUENCE D'UN OBJET SE DÉDUIT, ELLE N'EST PAS ÉCRITE", () => {
  //  La donnée n'écrit aucune rareté d'objet. Lui en inventer une à la
  //  main ferait un second endroit à tenir d'accord avec le premier.
  assertEquals(motDeLaFrequence(8.5227), "fréquent");
  assertEquals(motDeLaFrequence(4.0323), "fréquent");
  assertEquals(motDeLaFrequence(2.6882), "peu fréquent");
  assertEquals(motDeLaFrequence(0.8065), "rare");
  assertEquals(motDeLaFrequence(0.2688), "très rare");
  assertEquals(motDeLaFrequence(0.1328), "très rare");
});

Deno.test("les seuils sont des bornes ouvertes, et zéro reste très rare", () => {
  assertEquals(motDeLaFrequence(3), "peu fréquent");
  assertEquals(motDeLaFrequence(1), "rare");
  assertEquals(motDeLaFrequence(0.3), "très rare");
  assertEquals(motDeLaFrequence(0), "très rare");
});

Deno.test("les objets vont du plus fréquent au plus rare", () => {
  const rangés = parFrequence([
    o({ nom: "Pierre Plante", pct: 0.2688 }),
    o({ nom: "Antidote", pct: 8.0645 }),
    o({ nom: "Potion", pct: 2.6882 }),
  ]);
  assertEquals(rangés.map((x) => x.nom), ["Antidote", "Potion", "Pierre Plante"]);
});

Deno.test("ET LES EX ÆQUO NE CHANGENT PAS D'ORDRE D'UN CHARGEMENT À L'AUTRE", () => {
  const rangés = parFrequence([
    o({ nom: "Sombre Ball", pct: 0.8065 }),
    o({ nom: "Faiblo Ball", pct: 0.8065 }),
    o({ nom: "Rapide Ball", pct: 0.8065 }),
  ]);
  assertEquals(rangés.map((x) => x.nom), ["Faiblo Ball", "Rapide Ball", "Sombre Ball"]);
});

Deno.test("UNE TRANCHE UNIFORME LE DIT UNE FOIS, PAS TRENTE-SIX", () => {
  //  `outils/faune-par-zone.py` répartit à poids égal dans chaque
  //  rareté : les trente-six communs d'une zone sont tous à la même
  //  part. L'écrire sur chaque carte noierait le seul chiffre qui les
  //  distingue, qui est le niveau.
  const t = parRarete([e({ espece: 1, pct: 2.0202 }), e({ espece: 2, pct: 2.0202 })]);
  assertEquals(t[0].commune, 2.0202);
});

Deno.test("et dès qu'une part diffère, chaque carte reprend la sienne", () => {
  //  Le jour où une table sera écrite à la main, avec des parts
  //  inégales, la page le dira sans qu'on y touche.
  const t = parRarete([e({ espece: 1, pct: 2 }), e({ espece: 2, pct: 3 })]);
  assertEquals(t[0].commune, null);
});

Deno.test("une tranche d'une seule espèce est uniforme, et c'est juste", () => {
  assertEquals(parRarete([e({ pct: 5 })])[0].commune, 5);
  assertEquals(partCommune([]), null);
});

Deno.test("ON N'AFFICHE QUE LES TYPES QU'ON SAIT DESSINER", () => {
  //  Les dix-huit noms sont ceux de `img/types/<type>.png`. Un type
  //  inventé deviendrait une image cassée sur soixante-treize cartes.
  const fiches = { "1": { types: ["plante", "poison"] }, "2": { types: ["lumiere"] } };
  assertEquals(typesDe(fiches, 1), ["plante", "poison"]);
  assertEquals(typesDe(fiches, 2), []);
  assertEquals(typesDe(fiches, 999), []);
});

Deno.test("et jamais plus de deux", () => {
  //  Un Pokémon en a un ou deux. On coupe plutôt que de laisser une
  //  donnée inattendue casser la grille.
  const fiches = { "3": { types: ["feu", "vol", "dragon"] } };
  assertEquals(typesDe(fiches, 3), ["feu", "vol"]);
});

Deno.test("une fiche sans types ne casse rien", () => {
  assertEquals(typesDe({ "4": {} }, 4), []);
  assertEquals(typesDe({}, 4), []);
});

// ════════════════════════════════════════════════════════════════════
//  LE TRI D'UNE ZONE. Même règle que les statuts de l'annexe 11 : un
//  bouton n'existe que s'il a quelque chose à montrer.
// ════════════════════════════════════════════════════════════════════

const ESPECES: EspeceDeZone[] = [
  { espece: 1, nom: "Bulbizarre", pct: 8, min: 2, max: 6, rarete: "commun" },
  { espece: 25, nom: "Pikachu", pct: 8, min: 2, max: 6, rarete: "commun" },
  { espece: 105, nom: "Ossatueur", pct: 3, min: 4, max: 9, rarete: "peu commun" },
  { espece: 149, nom: "Dracolosse", pct: 0.4, min: 8, max: 12, rarete: "rare" },
];

const OBJETS: ObjetDeZone[] = [
  { objet: 1, nom: "Potion", famille: "Pour soigner", pct: 4, prix: 300 },
  { objet: 2, nom: "Antidote", famille: "Pour soigner", pct: 2, prix: 200 },
];

Deno.test("les cinq boutons d'une zone complète, avec leurs comptes", () => {
  assertEquals(filtresDeFaune(ESPECES, OBJETS), [
    { cle: "tous", mot: "Tous", nombre: 6 },
    { cle: "commun", mot: "Commun", nombre: 2 },
    { cle: "peu commun", mot: "Peu commun", nombre: 1 },
    { cle: "rare", mot: "Rare", nombre: 1 },
    { cle: "objet", mot: "Objet", nombre: 2 },
  ]);
});

Deno.test("une rareté absente n'a pas de bouton", () => {
  const sansRare = ESPECES.filter((e) => e.rarete !== "rare");
  assertEquals(
    filtresDeFaune(sansRare, OBJETS).map((f) => f.cle),
    ["tous", "commun", "peu commun", "objet"],
  );
});

Deno.test("une zone sans objet ne propose pas « Objet »", () => {
  assertEquals(
    filtresDeFaune(ESPECES, []).map((f) => f.cle),
    ["tous", "commun", "peu commun", "rare"],
  );
});

Deno.test("un seul tri : aucune barre", () => {
  //  Rien à trier — « Tous » et « Commun » montreraient la même liste.
  assertEquals(filtresDeFaune(ESPECES.filter((e) => e.rarete === "commun"), []), []);
  assertEquals(filtresDeFaune([], []), []);
});

Deno.test("« tous » montre tout, un tri ne montre que le sien", () => {
  assertEquals(visibleDansLaFaune("commun", "tous"), true);
  assertEquals(visibleDansLaFaune("objet", "tous"), true);
  assertEquals(visibleDansLaFaune("commun", "commun"), true);
  assertEquals(visibleDansLaFaune("commun", "rare"), false);
  assertEquals(visibleDansLaFaune("objet", "commun"), false);
});

Deno.test("l'annonce accorde le pluriel et dit sur quoi on a trié", () => {
  assertEquals(motDuCompteDeFaune(6, "tous"), "6 lignes");
  assertEquals(motDuCompteDeFaune(1, "rare"), "1 ligne — rare");
  assertEquals(motDuCompteDeFaune(2, "peu commun"), "2 lignes — peu commun");
  assertEquals(motDuCompteDeFaune(0, "objet"), "0 lignes — objet");
});
