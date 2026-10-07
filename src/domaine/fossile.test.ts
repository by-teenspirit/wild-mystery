// ════════════════════════════════════════════════════════════════════
//  Ce que ces tests protègent.
//
//  **Qu'un fossile ne s'invente pas.** Une entrée sans espèce, sans
//  objet ou sans identifiant disparaît : un fossile qui ne ressuscite
//  rien est un objet qu'on ramasse et qu'on ne peut pas rendre.
//
//  **Que la trouvaille soit reproductible.** Même message, même fossile,
//  des années plus tard — c'est ce qui permet de trancher une
//  contestation.
//
//  **Que la VRAIE table du dépôt soit cohérente** — ça, c'est le
//  garde-fou n° 13 qui le vérifie, pas ce fichier : le domaine ne lit
//  aucun fichier, et un test qui demande `--allow-read` ici casserait la
//  règle que la couverture fait respecter.
//
//  **Et qu'elle soit INDÉPENDANTE des Pokédollars.** Les deux partent du
//  numéro du message ; si elles partageaient la suite, les grosses
//  fouilles donneraient toujours des fossiles, ou jamais.
// ════════════════════════════════════════════════════════════════════

import { assert, assertEquals } from "@std/assert";
import {
  assembler,
  fossileDeLaFouille,
  fossilesDepuis,
  REGLES_PAR_DEFAUT,
  reglesDepuis,
} from "./fossile.ts";
import { fouiller } from "./fouille.ts";

const TABLE = {
  morceauxParFossile: 3,
  chanceDeMorceau: 0.06,
  chanceDEntier: 0.008,
  fossiles: [
    { clef: "racine", objet: "Fossile Racine", objetId: 99, especeId: 345, espece: "Lilia" },
    { clef: "dome", objet: "Fossile Dôme", objetId: 102, especeId: 140, espece: "Kabuto" },
    { clef: "ambre", objet: "Vieil Ambre", objetId: 103, especeId: 142, espece: "Ptéra" },
  ],
};

const TROIS = fossilesDepuis(TABLE);

// ── la lecture de la table ──────────────────────────────────────────

Deno.test("la table se lit entière", () => {
  assertEquals(TROIS.length, 3);
  assertEquals(TROIS[0], {
    clef: "racine",
    objet: "Fossile Racine",
    objetId: 99,
    especeId: 345,
    espece: "Lilia",
  });
});

Deno.test("UN FOSSILE QUI NE RESSUSCITE RIEN N'ENTRE PAS", () => {
  const bancals = fossilesDepuis({
    fossiles: [
      { clef: "", objet: "Sans clef", objetId: 1, especeId: 1, espece: "X" },
      { clef: "a", objet: "", objetId: 1, especeId: 1, espece: "X" },
      { clef: "b", objet: "Sans espèce", objetId: 1, especeId: 1, espece: "  " },
      { clef: "c", objet: "Sans id d'objet", objetId: 0, especeId: 1, espece: "X" },
      { clef: "d", objet: "Sans id d'espèce", objetId: 1, especeId: null, espece: "X" },
      //  Un champ qui n'est pas du texte du tout : c'est ce qu'un
      //  fichier écrit à la main finit par contenir.
      { clef: 42, objet: "Clef numérique", objetId: 1, especeId: 1, espece: "X" },
      { clef: "f", objet: ["pas", "du", "texte"], objetId: 1, especeId: 1, espece: "X" },
      { clef: "e", objet: "Bon", objetId: 1, especeId: 1, espece: "X" },
      { clef: "e", objet: "Doublon de clef", objetId: 2, especeId: 2, espece: "Y" },
      "pas un objet",
      null,
    ],
  });
  assertEquals(bancals.map((f) => f.clef), ["e"]);
  assertEquals(bancals[0].objet, "Bon", "c'est le PREMIER qui gagne, pas le dernier");
});

Deno.test("une table illisible rend une liste vide, elle ne lève pas", () => {
  for (const mauvais of [null, undefined, 12, "texte", {}, { fossiles: "pas une liste" }]) {
    assertEquals(fossilesDepuis(mauvais).length, 0, JSON.stringify(mauvais) ?? "undefined");
  }
});

// ── les réglages ────────────────────────────────────────────────────

Deno.test("les réglages se lisent avec la table", () => {
  assertEquals(reglesDepuis(TABLE), {
    morceauxParFossile: 3,
    chanceDeMorceau: 0.06,
    chanceDEntier: 0.008,
  });
});

Deno.test("UNE CHANCE DE 0 OU DE 1 EST REFUSÉE", () => {
  //  Zéro éteindrait la trouvaille en silence, un la rendrait certaine.
  //  Les deux sont plus probablement une faute de frappe qu'une
  //  intention.
  const r = reglesDepuis({ chanceDeMorceau: 0, chanceDEntier: 1, morceauxParFossile: 1 });
  assertEquals(r.chanceDeMorceau, REGLES_PAR_DEFAUT.chanceDeMorceau);
  assertEquals(r.chanceDEntier, REGLES_PAR_DEFAUT.chanceDEntier);
  assertEquals(r.morceauxParFossile, 3, "« un morceau par fossile » n'a pas de sens");
});

Deno.test("des réglages absents rendent ceux par défaut", () => {
  assertEquals(reglesDepuis(null), REGLES_PAR_DEFAUT);
  assertEquals(reglesDepuis({}), REGLES_PAR_DEFAUT);
});

// ── le tirage ───────────────────────────────────────────────────────

Deno.test("MÊME MESSAGE, MÊME TROUVAILLE", () => {
  for (const g of [1, 977, 123456]) {
    assertEquals(fossileDeLaFouille(g, TROIS), fossileDeLaFouille(g, TROIS));
  }
});

Deno.test("sans table, on ne trouve rien — et ça ne lève pas", () => {
  assertEquals(fossileDeLaFouille(42, []), null);
});

Deno.test("bredouille est le cas NORMAL", () => {
  let trouves = 0;
  for (let g = 0; g < 2000; g++) if (fossileDeLaFouille(g, TROIS) !== null) trouves++;
  //  6,8 % attendus sur 2000 tirages : on borne large, le test protège
  //  l'ordre de grandeur, pas la décimale.
  assert(trouves > 60 && trouves < 220, `${trouves} trouvailles sur 2000`);
});

Deno.test("l'entier est bien plus rare que le morceau", () => {
  let entiers = 0, morceaux = 0;
  for (let g = 0; g < 20000; g++) {
    const t = fossileDeLaFouille(g, TROIS);
    if (t?.genre === "entier") entiers++;
    if (t?.genre === "morceau") morceaux++;
  }
  assert(entiers > 0, "jamais d'entier : la borne est inatteignable");
  assert(morceaux > entiers * 3, `${morceaux} morceaux pour ${entiers} entiers`);
});

Deno.test("L'ENTIER RESTE ATTEIGNABLE QUAND LE MORCEAU EST PLUS PROBABLE", () => {
  //  C'est le piège de l'ordre des bornes : tirer le morceau d'abord
  //  rendrait l'entier impossible dès que sa chance est la plus petite.
  const regles = { morceauxParFossile: 3, chanceDeMorceau: 0.5, chanceDEntier: 0.1 };
  let entiers = 0;
  for (let g = 0; g < 500; g++) {
    if (fossileDeLaFouille(g, TROIS, regles)?.genre === "entier") entiers++;
  }
  assert(entiers > 20, `${entiers} entiers sur 500`);
});

Deno.test("toutes les espèces de la table sortent", () => {
  const vues = new Set<string>();
  for (let g = 0; g < 20000; g++) {
    const t = fossileDeLaFouille(g, TROIS);
    if (t !== null) vues.add(t.fossile.clef);
  }
  assertEquals([...vues].sort(), ["ambre", "dome", "racine"]);
});

Deno.test("LE FOSSILE NE SUIT PAS LES POKÉDOLLARS", () => {
  //  Les deux partent du numéro du message. S'ils partageaient la
  //  suite, les grosses fouilles donneraient toujours des fossiles — ou
  //  jamais. On vérifie qu'un fossile tombe aussi bien sur une petite
  //  fouille que sur une grosse.
  const avec: number[] = [];
  for (let g = 0; g < 4000; g++) {
    if (fossileDeLaFouille(g, TROIS) !== null) avec.push(fouiller(g, 2).pokedollars);
  }
  assert(avec.length > 100, `trop peu de cas : ${avec.length}`);
  assert(avec.some((p) => p === 0), "jamais sur une bredouille");
  assert(avec.some((p) => p >= 100), "jamais sur une grosse fouille");
});

// ── l'assemblage ────────────────────────────────────────────────────

Deno.test("trois morceaux font un fossile", () => {
  assertEquals(assembler(3), { entiers: 1, reste: 0 });
  assertEquals(assembler(7), { entiers: 2, reste: 1 });
});

Deno.test("LE RESTE NE DISPARAÎT PAS", () => {
  //  Un joueur qui a deux morceaux les garde : sa fouille suivante peut
  //  compléter. Les jeter serait voler deux fouilles.
  assertEquals(assembler(2), { entiers: 0, reste: 2 });
  assertEquals(assembler(5), { entiers: 1, reste: 2 });
});

Deno.test("un compte de morceaux absurde ne lève pas", () => {
  for (const n of [0, -3, 1.5, Number.NaN]) {
    assertEquals(assembler(n), { entiers: 0, reste: 0 }, String(n));
  }
});

Deno.test("le nombre de morceaux par fossile vient des règles", () => {
  assertEquals(assembler(10, { ...REGLES_PAR_DEFAUT, morceauxParFossile: 5 }), {
    entiers: 2,
    reste: 0,
  });
});
