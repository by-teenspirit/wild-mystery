// ════════════════════════════════════════════════════════════════════
//  L'ordre du dex. Les cas qui comptent sont ceux des formes
//  régionales : c'est à cause d'elles qu'un tri par identifiant ne
//  suffit pas, et le Pokédex de Rhode en porte 54.
// ════════════════════════════════════════════════════════════════════

import { assertEquals } from "@std/assert";
import { baseDe, basesDepuis, comparerDansLeDex, rangerDansLeDex } from "./dex.ts";

//  Les vraies valeurs de `data/ordre-du-dex.json`, relevées le 4
//  novembre : Ossatueur d'Alola décline Ossatueur (105), Racaillou
//  d'Alola décline Racaillou (74), Qwilfish de Hisui décline Qwilfish
//  (211).
const BASES = { "10115": 105, "10109": 74, "10234": 211 };

Deno.test("une espèce ordinaire est sa propre base", () => {
  assertEquals(baseDe(1, BASES), 1);
  assertEquals(baseDe(105, BASES), 105);
  //  Et une forme inconnue du fichier aussi : on range au mieux plutôt
  //  que de perdre l'espèce.
  assertEquals(baseDe(10999, BASES), 10999);
});

Deno.test("une forme régionale rend l'espèce qu'elle décline", () => {
  assertEquals(baseDe(10115, BASES), 105);
  assertEquals(baseDe(10109, BASES), 74);
});

Deno.test("LA FORME SUIT SON ESPÈCE, ET PAS LES MILLE AUTRES", () => {
  //  C'est tout l'objet du fichier. Trié par identifiant seul,
  //  Ossatueur d'Alola (10115) finirait après Miraidon (1008) ; ici il
  //  se glisse entre Ossatueur (105) et Hypotrempe (116).
  const dex = [116, 10115, 105, 74, 10109, 1];
  assertEquals(
    rangerDansLeDex(dex, (x) => x, BASES),
    [1, 74, 10109, 105, 10115, 116],
  );
});

Deno.test("deux formes de la même espèce gardent l'ordre de PokéAPI", () => {
  const deux = { "10091": 19, "10092": 19 };
  assertEquals(
    rangerDansLeDex([10092, 19, 10091], (x) => x, deux),
    [19, 10091, 10092],
  );
});

Deno.test("le comparateur rend bien un signe, pas un booléen", () => {
  assertEquals(comparerDansLeDex(1, 2, BASES) < 0, true);
  assertEquals(comparerDansLeDex(2, 1, BASES) > 0, true);
  assertEquals(comparerDansLeDex(105, 105, BASES), 0);
  //  L'espèce avant sa forme, jamais l'inverse.
  assertEquals(comparerDansLeDex(105, 10115, BASES) < 0, true);
  assertEquals(comparerDansLeDex(10115, 116, BASES) < 0, true);
});

Deno.test("ranger ne touche pas à la liste qu'on lui donne", () => {
  const avant = [116, 105, 10115];
  const apres = rangerDansLeDex(avant, (x) => x, BASES);
  assertEquals(avant, [116, 105, 10115]);
  assertEquals(apres, [105, 10115, 116]);
});

Deno.test("on range des objets, pas seulement des nombres", () => {
  const faune = [
    { espece: 10115, nom: "Ossatueur d'Alola" },
    { espece: 105, nom: "Ossatueur" },
    { espece: 1, nom: "Bulbizarre" },
  ];
  assertEquals(
    rangerDansLeDex(faune, (e) => e.espece, BASES).map((e) => e.nom),
    ["Bulbizarre", "Ossatueur", "Ossatueur d'Alola"],
  );
});

Deno.test("la lecture du fichier refuse ce qui ferait boucler le tri", () => {
  assertEquals(basesDepuis({ base: { "10115": 105 } }), { "10115": 105 });
  //  Une base qui est elle-même une forme : écartée.
  assertEquals(basesDepuis({ base: { "10115": 10105 } }), {});
  assertEquals(basesDepuis({ base: { "10115": "105" } }), {});
  assertEquals(basesDepuis({}), {});
  assertEquals(basesDepuis(null), {});
  assertEquals(basesDepuis("rien"), {});
});
