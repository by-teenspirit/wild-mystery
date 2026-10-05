// ════════════════════════════════════════════════════════════════════
//  src/adaptateurs/faune/comptoirs.test.ts
//
//  Un comptoir mal écrit ne doit pas démarrer. Pas par principe : parce
//  qu'un `forumId` manquant ferait avancer le curseur du forum 0, et la
//  relève republierait tous les reçus du sujet à chaque passage, toutes
//  les cinq minutes, sans que rien ne ressemble à une panne.
// ════════════════════════════════════════════════════════════════════

import { assertEquals, assertRejects, assertThrows } from "@std/assert";
import { comptoirsDepuis, ComptoirsEnFichiers } from "./comptoirs.ts";
import { DonneesIllisibles } from "./fichiers.ts";

Deno.test("un comptoir se lit", () => {
  assertEquals(
    comptoirsDepuis('{"comptoirs":[{"sujetId":977,"forumId":3,"nom":"Boutique"}]}'),
    [{ sujetId: 977, forumId: 3 }],
  );
});

Deno.test("le fichier du dépôt est lisible", async () => {
  //  CE TEST-LÀ N'EST PAS DÉCORATIF : il lit le vrai fichier, celui que
  //  la relève lira en production. Une virgule en trop se verrait ici
  //  plutôt qu'à 3 h du matin dans un journal Supabase.
  const comptoirs = await new ComptoirsEnFichiers(
    (chemin) => Deno.readTextFile(chemin),
  ).comptoirs();
  assertEquals(comptoirs, [{ sujetId: 977, forumId: 3 }]);
});

Deno.test("les champs décoratifs sont ignorés", () => {
  //  Les clés `_` portent les explications, et il y en a partout dans
  //  `data/`. Elles ne doivent jamais faire refuser un fichier.
  assertEquals(
    comptoirsDepuis(
      '{"_":"bla","_pourquoi":"bla","comptoirs":[{"sujetId":1,"forumId":2,"_":"bla"}]}',
    ),
    [{ sujetId: 1, forumId: 2 }],
  );
});

Deno.test("un forumId manquant fait refuser", () => {
  assertThrows(
    () => comptoirsDepuis('{"comptoirs":[{"sujetId":977}]}'),
    DonneesIllisibles,
    "comptoirs[0].forumId",
  );
});

Deno.test("un identifiant qui n'est pas un entier positif fait refuser", () => {
  for (const valeur of ["3", 0, -3, 3.5, null, true]) {
    assertThrows(
      () =>
        comptoirsDepuis(`{"comptoirs":[{"sujetId":977,"forumId":${JSON.stringify(valeur)}}]}`),
      DonneesIllisibles,
      "forumId",
    );
  }
});

Deno.test("DEUX COMPTOIRS DANS LE MÊME FORUM SONT REFUSÉS", () => {
  //  Le test qui porte ce fichier. Ils partageraient leur curseur, et le
  //  second le ferait reculer à chaque passage : les reçus du premier
  //  partiraient en boucle.
  assertThrows(
    () =>
      comptoirsDepuis(
        '{"comptoirs":[{"sujetId":977,"forumId":3},{"sujetId":978,"forumId":3}]}',
      ),
    DonneesIllisibles,
    "se voleraient leur curseur",
  );
});

Deno.test("un sujet en double est refusé", () => {
  assertThrows(
    () =>
      comptoirsDepuis(
        '{"comptoirs":[{"sujetId":977,"forumId":3},{"sujetId":977,"forumId":4}]}',
      ),
    DonneesIllisibles,
    "en double",
  );
});

Deno.test("une liste vide est acceptée", () => {
  //  Aucun comptoir n'est pas une faute : la boutique peut être fermée
  //  le temps d'un changement de catalogue, et la relève doit continuer
  //  à faire le reste.
  assertEquals(comptoirsDepuis('{"comptoirs":[]}'), []);
});

Deno.test("un fichier sans « comptoirs » est refusé", () => {
  for (const texte of ["{}", '{"comptoirs":{}}', '{"comptoirs":null}']) {
    assertThrows(() => comptoirsDepuis(texte), DonneesIllisibles, "tableau");
  }
});

Deno.test("un JSON cassé est nommé comme tel", () => {
  assertThrows(
    () => comptoirsDepuis('{"comptoirs":[,]}'),
    DonneesIllisibles,
    "JSON illisible",
  );
});

Deno.test("le fichier n'est lu qu'une fois", async () => {
  let lectures = 0;
  const c = new ComptoirsEnFichiers(() => {
    lectures++;
    return Promise.resolve('{"comptoirs":[{"sujetId":977,"forumId":3}]}');
  });
  await c.comptoirs();
  await c.comptoirs();
  assertEquals(lectures, 1);
});

Deno.test("la racine est préfixée au chemin", async () => {
  const vus: string[] = [];
  await new ComptoirsEnFichiers((chemin) => {
    vus.push(chemin);
    return Promise.resolve('{"comptoirs":[]}');
  }, "https://cdn.jsdelivr.net/gh/x/y@v1/").comptoirs();
  assertEquals(vus, ["https://cdn.jsdelivr.net/gh/x/y@v1/data/comptoirs.json"]);
});

Deno.test("une lecture qui échoue remonte", async () => {
  await assertRejects(
    () =>
      new ComptoirsEnFichiers(() => Promise.reject(new DonneesIllisibles("x", "HTTP 404")))
        .comptoirs(),
    DonneesIllisibles,
  );
});
