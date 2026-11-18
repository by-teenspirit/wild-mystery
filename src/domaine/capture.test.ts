// ════════════════════════════════════════════════════════════════════
//  src/domaine/capture.test.ts
//
//  Ce que ces tests protègent.
//
//  **Qu'un sauvage plein ne soit pas une prise.** C'est ce qui fait
//  qu'on combat avant de lancer. Mon premier jet de la formule laissait
//  un Ponyta plein se prendre à 24,8 % du premier coup et montait à
//  100 % dès l'Hyper Ball — j'avais écrit que les quatre secousses « ne
//  changent pas les chances ». Elles sont une probabilité à la
//  puissance quatre. Un jeu où la première ball suffit n'a pas de
//  combat.
//
//  **Que le taux de l'espèce compte.** C'est la seule chose qui sépare
//  un Chenipan d'un légendaire.
//
//  **Qu'une ball inconnue lève.** Valoir ×1 ferait qu'une Hyper Ball
//  mal nommée se lancerait comme une Poké Ball, et le joueur paierait
//  1 200 PD pour rien sans jamais le savoir.
// ════════════════════════════════════════════════════════════════════

import { assert, assertAlmostEquals, assertEquals, assertThrows } from "@std/assert";
import {
  BALLS,
  CaptureInvalide,
  chanceDePrise,
  type Contexte,
  lancerUneBall,
  type Proie,
} from "./capture.ts";

const JOUR: Contexte = { nuit: false, tour: 2 };

/** Ponyta : taux 190, 30 PV au niveau 10. C'est la rencontre que
 *  Callista a eue le 17 novembre sur t996. */
function ponyta(pv: number): Proie {
  return { pv, pvMax: 30, niveau: 10, types: ["feu"], capture: 190 };
}

/** Lokhlass : taux 45, le genre de prise qui se mérite. */
function lokhlass(pv: number): Proie {
  return { pv, pvMax: 60, niveau: 25, types: ["eau", "glace"], capture: 45 };
}

Deno.test("un sauvage plein n'est pas une prise", () => {
  //  35 % pour un Ponyta, 20 % pour un Lokhlass : c'est jouable, et
  //  c'est loin d'être acquis.
  assert(chanceDePrise(ponyta(30), "poke-ball", JOUR) < 0.4);
  assert(chanceDePrise(lokhlass(60), "ultra-ball", JOUR) < 0.3);
});

Deno.test("descendre les PV améliore vraiment les chances", () => {
  //  La courbe doit MONTER à chaque coup, sinon combattre ne sert à
  //  rien et autant lancer tout de suite.
  let precedente = 0;
  for (const pv of [30, 25, 20, 15, 10, 5, 1]) {
    const chance = chanceDePrise(ponyta(pv), "poke-ball", JOUR);
    assert(
      chance > precedente,
      `à ${pv} PV la chance (${chance}) devrait dépasser ${precedente}`,
    );
    precedente = chance;
  }
});

Deno.test("le taux de l'espèce sépare un Chenipan d'un légendaire", () => {
  const facile = chanceDePrise(
    { pv: 10, pvMax: 30, niveau: 5, types: ["insecte"], capture: 255 },
    "poke-ball",
    JOUR,
  );
  const dur = chanceDePrise(
    { pv: 10, pvMax: 30, niveau: 70, types: ["psy"], capture: 3 },
    "poke-ball",
    JOUR,
  );
  //  83 % contre 3 %, dans le même état et avec la même ball. Et 83 %
  //  N'EST PAS 100 % : même un Chenipan peut s'échapper, ce qui est
  //  exactement ce qu'on veut — une prise certaine demande `a ≥ 255`,
  //  donc une meilleure ball ou moins de PV.
  assert(facile > 0.8, `un Chenipan à ${facile} serait trop dur`);
  assert(facile < 1, "même un Chenipan peut s'échapper");
  assert(dur < 0.05, `un légendaire à ${dur} serait trop facile`);
});

Deno.test("une meilleure ball vaut mieux, dans l'ordre du catalogue", () => {
  //  Les prix montent — 200, 600, 1 200 — donc les chances doivent
  //  monter aussi, sinon le catalogue mentirait.
  const sur = lokhlass(20);
  const poke = chanceDePrise(sur, "poke-ball", JOUR);
  const great = chanceDePrise(sur, "great-ball", JOUR);
  const ultra = chanceDePrise(sur, "ultra-ball", JOUR);
  assert(poke < great, `${poke} < ${great}`);
  assert(great < ultra, `${great} < ${ultra}`);
});

Deno.test("les quatre balls à condition ne marchent QUE dans leur condition", () => {
  const sur = lokhlass(30);
  //  Filet Ball : Eau et Insecte. Lokhlass est Eau.
  assert(
    chanceDePrise(sur, "net-ball", JOUR) >
      chanceDePrise({ ...sur, types: ["feu"] }, "net-ball", JOUR),
  );
  //  Sombre Ball : la nuit.
  assert(
    chanceDePrise(sur, "dusk-ball", { nuit: true, tour: 2 }) >
      chanceDePrise(sur, "dusk-ball", { nuit: false, tour: 2 }),
  );
  //  Rapide Ball : le premier tour, et lui seul. C'est la seule ball
  //  qui récompense de lancer AVANT de combattre.
  assert(
    chanceDePrise(sur, "quick-ball", { nuit: false, tour: 1 }) >
      chanceDePrise(sur, "quick-ball", { nuit: false, tour: 2 }),
  );
  //  Faiblo Ball : d'autant mieux que le niveau est bas.
  assert(
    chanceDePrise({ ...sur, niveau: 3 }, "nest-ball", JOUR) >
      chanceDePrise({ ...sur, niveau: 40 }, "nest-ball", JOUR),
  );
});

Deno.test("la Faiblo Ball ne descend jamais sous un", () => {
  //  ⌊(41 − 70) / 10⌋ vaut −3 : sans le plancher, elle DIVISERAIT les
  //  chances, et une ball du catalogue serait pire que ne rien lancer.
  const vieux = { pv: 30, pvMax: 60, niveau: 70, types: ["psy"], capture: 45 };
  assertEquals(
    chanceDePrise(vieux, "nest-ball", JOUR),
    chanceDePrise(vieux, "poke-ball", JOUR),
  );
});

Deno.test("les huit balls du catalogue sont toutes connues", () => {
  //  Le catalogue en porte huit (`data/objets.json`, famille « ball »).
  //  Une de plus au catalogue sans une de plus ici ferait lever en
  //  pleine capture.
  for (
    const slug of [
      "poke-ball",
      "great-ball",
      "ultra-ball",
      "net-ball",
      "dive-ball",
      "nest-ball",
      "dusk-ball",
      "quick-ball",
    ]
  ) {
    assert(BALLS[slug] !== undefined, `${slug} manque`);
  }
  assertEquals(Object.keys(BALLS).length, 8);
});

Deno.test("une ball inconnue lève, elle ne vaut pas un", () => {
  assertThrows(
    () => chanceDePrise(ponyta(10), "master-ball", JOUR),
    CaptureInvalide,
    "ball inconnue",
  );
});

Deno.test("un état impossible lève plutôt que de rendre un chiffre", () => {
  assertThrows(() => chanceDePrise({ ...ponyta(31) }, "poke-ball", JOUR), CaptureInvalide);
  assertThrows(() => chanceDePrise({ ...ponyta(-1) }, "poke-ball", JOUR), CaptureInvalide);
  assertThrows(
    () => chanceDePrise({ ...ponyta(10), pvMax: 0 }, "poke-ball", JOUR),
    CaptureInvalide,
  );
  assertThrows(
    () => chanceDePrise({ ...ponyta(10), capture: 0 }, "poke-ball", JOUR),
    CaptureInvalide,
  );
});

Deno.test("le jet rend la chance qu'il y avait, et son dé", () => {
  //  « Un joueur qui rate trois fois doit pouvoir lire qu'il avait
  //  12 % » — sinon il croit que le serveur triche.
  const jet = lancerUneBall(ponyta(10), "poke-ball", JOUR, 0.5);
  assertAlmostEquals(jet.chance, chanceDePrise(ponyta(10), "poke-ball", JOUR));
  assertEquals(jet.de, 0.5);
  assertEquals(jet.prise, 0.5 < jet.chance);
});

Deno.test("un tirage juste sous la chance prend, juste au-dessus rate", () => {
  //  La frontière, parce que c'est là que les contestations arrivent.
  const chance = chanceDePrise(ponyta(10), "poke-ball", JOUR);
  assertEquals(lancerUneBall(ponyta(10), "poke-ball", JOUR, chance - 0.001).prise, true);
  assertEquals(lancerUneBall(ponyta(10), "poke-ball", JOUR, chance).prise, false);
});

Deno.test("une prise certaine se tient même au pire tirage", () => {
  //  Un Chenipan à 10 PV avec une Hyper Ball : `a ≥ 255`, donc prise.
  //  Un tirage à 0,999 ne doit pas la défaire.
  const chenipan = { pv: 5, pvMax: 20, niveau: 3, types: ["insecte"], capture: 255 };
  assertEquals(chanceDePrise(chenipan, "ultra-ball", JOUR), 1);
  assertEquals(lancerUneBall(chenipan, "ultra-ball", JOUR, 0.999).prise, true);
});
