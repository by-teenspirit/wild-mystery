// ════════════════════════════════════════════════════════════════════
//  src/adaptateurs/faune/types.test.ts
//
//  Ce que ces tests protègent : que `data/types.json` soit lu TEL QU'IL
//  EST, et qu'un fichier abîmé casse au CHARGEMENT plutôt qu'au premier
//  tour de combat.
//
//  Le défaut qu'on refuse : une table vide ou mal lue ferait lever
//  `domaine/combat.ts` sur chaque tour, avec un message qui parle d'un
//  « type d'attaque inconnu » — et personne n'irait regarder le
//  fichier. Une erreur doit nommer sa cause.
//
//  LE VRAI FICHIER EST LU ICI, et c'est le test qui compte le plus :
//  le garde-fou n° 37 vérifie la forme de la donnée, celui-ci vérifie
//  qu'on sait s'en servir.
// ════════════════════════════════════════════════════════════════════

import { assert, assertEquals, assertThrows } from "@std/assert";
import { tableDepuis, TableDesTypesEnFichier, TableDesTypesIllisible } from "./types.ts";

const RACINE = new URL("../../../", import.meta.url).pathname;

Deno.test("le vrai fichier du dépôt se lit, et dit ce qu'on attend", async () => {
  const table = new TableDesTypesEnFichier(
    (chemin) => Deno.readTextFile(RACINE + chemin),
  );
  const eff = await table.efficacite();

  //  Les trois lignes que tout joueur connaît, et qui suffisent à dire
  //  si la table est bien la bonne.
  assertEquals(eff.feu?.plante, 2);
  assertEquals(eff.eau?.feu, 2);
  assertEquals(eff.normal?.spectre, 0);
  //  UNE PAIRE NEUTRE EST ABSENTE, et c'est le contrat du fichier :
  //  `domaine/combat.ts` lit l'absence comme un 1.
  assertEquals(eff.normal?.eau, undefined);
});

Deno.test("le fichier n'est lu qu'une fois par passage", async () => {
  //  Le relire à chaque tour ferait un appel réseau par message pour la
  //  même réponse.
  let lectures = 0;
  const table = new TableDesTypesEnFichier((chemin) => {
    lectures++;
    return Deno.readTextFile(RACINE + chemin);
  });
  await table.efficacite();
  await table.efficacite();
  assertEquals(lectures, 1);
});

Deno.test("la racine est posée devant le chemin", () => {
  //  Côté fonction Edge, le fichier vient de jsDelivr : la racine est
  //  une URL, pas un dossier.
  let vu = "";
  const table = new TableDesTypesEnFichier((chemin) => {
    vu = chemin;
    return Promise.resolve('{"efficacite":{"feu":{"plante":2}}}');
  }, "https://exemple/wm@v1/");
  return table.efficacite().then(() => {
    assertEquals(vu, "https://exemple/wm@v1/data/types.json");
  });
});

Deno.test("UNE TABLE VIDE CASSE ICI, pas au premier tour", () => {
  //  Sinon chaque tour lèverait sur un « type d'attaque inconnu », et
  //  personne n'irait regarder le fichier.
  assertThrows(
    () => tableDepuis('{"efficacite":{}}'),
    TableDesTypesIllisible,
    "aucune paire",
  );
});

Deno.test("un fichier abîmé nomme sa cause", () => {
  for (
    const [texte, dedans] of [
      ["pas du json", "JSON invalide"],
      ["[1,2,3]", "pas de clé"],
      ['{"rien":1}', "pas de clé"],
      ['{"efficacite":{"feu":"beaucoup"}}', "n'est pas un objet"],
      ['{"efficacite":{"feu":{"plante":"double"}}}', "facteur illisible"],
      ['{"efficacite":{"feu":{"plante":-1}}}', "facteur illisible"],
    ] as const
  ) {
    const leve = assertThrows(
      () => tableDepuis(texte),
      TableDesTypesIllisible,
    );
    assert(
      (leve as Error).message.includes(dedans),
      `« ${(leve as Error).message} » devrait parler de « ${dedans} »`,
    );
  }
});

Deno.test("le nom du fichier est dans chaque erreur", () => {
  //  Une erreur qui ne dit pas QUEL fichier envoie chercher dans les
  //  quatre que la relève lit.
  const leve = assertThrows(() => tableDepuis("pas du json")) as Error;
  assert(leve.message.includes("data/types.json"), leve.message);
});
