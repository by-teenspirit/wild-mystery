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
//  **Et que l'ESPÈCE soit indépendante de la tranche tirée.** C'est
//  `fouille.ts` qui décide s'il y a un fossile, depuis le 15 octobre ;
//  ici on ne choisit plus que lequel des onze. Les deux partent du
//  numéro du message : si elles partageaient la suite, les fossiles
//  entiers et les morceaux ne seraient jamais les mêmes espèces.
// ════════════════════════════════════════════════════════════════════

import { assert, assertEquals } from "@std/assert";
import {
  assembler,
  fossilesDepuis,
  quelFossile,
  REGLES_PAR_DEFAUT,
  reglesDepuis,
} from "./fossile.ts";

const TABLE = {
  morceauxParFossile: 3,
  fossiles: [
    {
      clef: "racine",
      objet: "Fossile Racine",
      id: 991001,
      morceauId: 991101,
      especeId: 345,
      espece: "Lilia",
    },
    {
      clef: "dome",
      objet: "Fossile Dôme",
      id: 991004,
      morceauId: 991104,
      especeId: 140,
      espece: "Kabuto",
    },
    {
      clef: "ambre",
      objet: "Vieil Ambre",
      id: 991005,
      morceauId: 991105,
      especeId: 142,
      espece: "Ptéra",
    },
  ],
};

const TROIS = fossilesDepuis(TABLE);

// ── la lecture de la table ──────────────────────────────────────────

Deno.test("la table se lit entière", () => {
  assertEquals(TROIS.length, 3);
  assertEquals(TROIS[0], {
    clef: "racine",
    objet: "Fossile Racine",
    id: 991001,
    morceauId: 991101,
    especeId: 345,
    espece: "Lilia",
  });
});

Deno.test("UN FOSSILE QUI NE RESSUSCITE RIEN N'ENTRE PAS", () => {
  const bancals = fossilesDepuis({
    fossiles: [
      { clef: "", objet: "Sans clef", id: 1, morceauId: 2, especeId: 1, espece: "X" },
      { clef: "a", objet: "", id: 1, morceauId: 2, especeId: 1, espece: "X" },
      { clef: "b", objet: "Sans espèce", id: 1, morceauId: 2, especeId: 1, espece: "  " },
      { clef: "c", objet: "Sans id d'objet", id: 0, morceauId: 2, especeId: 1, espece: "X" },
      {
        clef: "g",
        objet: "Sans id de morceau",
        id: 1,
        morceauId: null,
        especeId: 1,
        espece: "X",
      },
      //  UN FOSSILE QUI EST SON PROPRE MORCEAU ferait boucler
      //  l'assemblage : trois morceaux retirés pour en rendre un, et
      //  ainsi de suite jusqu'à ce que quelqu'un regarde la base.
      { clef: "h", objet: "Son propre morceau", id: 7, morceauId: 7, especeId: 1, espece: "X" },
      {
        clef: "d",
        objet: "Sans id d'espèce",
        id: 1,
        morceauId: 2,
        especeId: null,
        espece: "X",
      },
      //  Un champ qui n'est pas du texte du tout : c'est ce qu'un
      //  fichier écrit à la main finit par contenir.
      { clef: 42, objet: "Clef numérique", id: 1, morceauId: 2, especeId: 1, espece: "X" },
      {
        clef: "f",
        objet: ["pas", "du", "texte"],
        id: 1,
        morceauId: 91,
        especeId: 1,
        espece: "X",
      },
      { clef: "e", objet: "Bon", id: 1, morceauId: 91, especeId: 1, espece: "X" },
      { clef: "e", objet: "Doublon de clef", id: 2, morceauId: 92, especeId: 2, espece: "Y" },
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
  //  IL Y EN AVAIT TROIS JUSQU'AU 15 OCTOBRE. `chanceDeMorceau` et
  //  `chanceDEntier` sont parties dans la table de butin, où elles se
  //  lisent contre les autres parts d'une fouille. `data/fossiles.json`
  //  les porte toujours — c'est là qu'on les règle — mais c'est
  //  `outils/butin.py` qui les y lit, pas ce code.
  assertEquals(reglesDepuis(TABLE), { morceauxParFossile: 3 });
});

Deno.test("« UN MORCEAU PAR FOSSILE » N'A PAS DE SENS", () => {
  //  Ça voudrait dire qu'il n'y a pas de morceaux du tout : un morceau
  //  ramassé serait aussitôt un fossile entier, et l'assemblage
  //  n'existerait plus.
  assertEquals(reglesDepuis({ morceauxParFossile: 1 }).morceauxParFossile, 3);
  assertEquals(reglesDepuis({ morceauxParFossile: 0 }).morceauxParFossile, 3);
  assertEquals(reglesDepuis({ morceauxParFossile: 5 }).morceauxParFossile, 5);
});

Deno.test("des réglages absents rendent ceux par défaut", () => {
  assertEquals(reglesDepuis(null), REGLES_PAR_DEFAUT);
  assertEquals(reglesDepuis({}), REGLES_PAR_DEFAUT);
});

// ── le tirage de l'espèce ───────────────────────────────────────────

Deno.test("MÊME MESSAGE, MÊME FOSSILE", () => {
  for (const g of [1, 977, 123456]) {
    assertEquals(quelFossile(g, TROIS, true), quelFossile(g, TROIS, true));
    assertEquals(quelFossile(g, TROIS, false), quelFossile(g, TROIS, false));
  }
});

Deno.test("sans table, on ne trouve rien — et ça ne lève pas", () => {
  //  Le fichier des fossiles peut être injoignable : la fouille a dit
  //  « fossile », il n'y en a aucun à donner, et la relève continue.
  assertEquals(quelFossile(42, [], true), null);
  assertEquals(quelFossile(42, [], false), null);
});

Deno.test("LE GENRE DIT QUEL OBJET ENTRE DANS LE SAC", () => {
  //  C'est la trouvaille qui résout l'objet, pas l'appelant : un `genre`
  //  et un `objetId` qu'on assemble ailleurs peuvent se contredire, et
  //  personne ne s'en apercevrait avant qu'un joueur ait un morceau
  //  dans son sac à la place d'un fossile.
  const entier = quelFossile(7, TROIS, true);
  const morceau = quelFossile(7, TROIS, false);
  assert(entier !== null && morceau !== null);
  assertEquals(entier.genre, "entier");
  assertEquals(morceau.genre, "morceau");
  assertEquals(entier.objetId, entier.fossile.id, "un entier met LE FOSSILE dans le sac");
  assertEquals(
    morceau.objetId,
    morceau.fossile.morceauId,
    "un morceau met LE MORCEAU, qui est un autre objet",
  );
  assert(entier.fossile.id !== entier.fossile.morceauId, "et les deux ne sont jamais le même");
});

Deno.test("l'espèce ne dépend PAS du genre", () => {
  //  Même message, même espèce, qu'on ait tiré un entier ou un morceau.
  //  Sinon les joueurs apprendraient qu'un morceau de Ptéra annonce un
  //  Ptéra entier — une corrélation que personne n'a décidée.
  for (const g of [1, 2, 3, 500, 9999]) {
    assertEquals(
      quelFossile(g, TROIS, true)?.fossile.clef,
      quelFossile(g, TROIS, false)?.fossile.clef,
    );
  }
});

Deno.test("toutes les espèces de la table sortent", () => {
  const vues = new Set<string>();
  for (let g = 0; g < 2000; g++) {
    const t = quelFossile(g, TROIS, false);
    if (t !== null) vues.add(t.fossile.clef);
  }
  assertEquals([...vues].sort(), ["ambre", "dome", "racine"]);
});

//  IL Y AVAIT UN TEST ICI : « LE FOSSILE NE SUIT PAS LES POKÉDOLLARS ».
//  Il vérifiait qu'un fossile tombe aussi bien sur une bredouille que
//  sur une grosse fouille, parce que les deux tirages étaient
//  indépendants. Depuis le 15 octobre ils ne peuvent plus l'être : une
//  fouille rend UNE chose, donc un fossile EXCLUT les Pokédollars. La
//  garantie qu'il protégeait — pas de corrélation cachée — est
//  maintenant celle du test ci-dessus, « l'espèce ne dépend PAS du
//  genre », et celle de `fouille.test.ts`, « une fouille ne rend qu'une
//  chose ».

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
