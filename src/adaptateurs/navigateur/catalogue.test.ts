// ════════════════════════════════════════════════════════════════════
//  Ce qui se teste sans navigateur : la déduction de l'adresse et le
//  cache. Le reste du fichier est du DOM et du réseau, vérifiés sur le
//  forum.
// ════════════════════════════════════════════════════════════════════

import { assertEquals } from "@std/assert";
import { CatalogueDistant, especesDepuis, racineDesDonnees } from "./catalogue.ts";

const SERVI =
  "https://cdn.jsdelivr.net/gh/by-teenspirit/wild-mystery@socle-v2/js/wild-mystery.js";

Deno.test("la racine des données se déduit de l'adresse du script", () => {
  assertEquals(
    racineDesDonnees(SERVI),
    "https://cdn.jsdelivr.net/gh/by-teenspirit/wild-mystery@socle-v2/data/",
  );
});

Deno.test("la branche suit toute seule", () => {
  //  C'est tout l'intérêt : changer de branche ou de commit ne demande
  //  aucune modification ici. L'erreur du hash dans le template ne se
  //  refait pas.
  const surUnCommit = SERVI.replace("@socle-v2", "@a1803993cbee");
  assertEquals(
    racineDesDonnees(surUnCommit),
    "https://cdn.jsdelivr.net/gh/by-teenspirit/wild-mystery@a1803993cbee/data/",
  );
});

Deno.test("GITHUB PAGES AUSSI : c'est ce qui sert le forum depuis le 7 octobre", () => {
  //  On a quitté jsDelivr parce qu'un tag par correction ne tient pas.
  //  La déduction ne connaît ni l'un ni l'autre — elle coupe à `/js/` —
  //  et ce test est là pour que ça reste vrai.
  assertEquals(
    racineDesDonnees("https://by-teenspirit.github.io/wild-mystery/js/wild-mystery.js"),
    "https://by-teenspirit.github.io/wild-mystery/data/",
  );
});

Deno.test("une adresse qu'on ne sait pas lire rend null", () => {
  //  Mieux vaut pas de barre qu'une barre qui demande des données à une
  //  adresse inventée.
  for (const adresse of [null, "", "https://exemple.fr/script.js", "/js-ailleurs/x.js"]) {
    assertEquals(racineDesDonnees(adresse), null, String(adresse));
  }
});

Deno.test("les zones ne sont demandées qu'une fois", () => {
  let appels = 0;
  const c = new CatalogueDistant("https://exemple.fr/data/", (url) => {
    appels++;
    assertEquals(url, "https://exemple.fr/data/zones.json");
    return Promise.resolve({ zones: [{ forumId: 9, nom: "Forêt", palier: 1 }] });
  });
  return Promise.all([c.zones(), c.zones()]).then(async ([a, b]) => {
    assertEquals(a, b);
    await c.zones();
    assertEquals(appels, 1, "deux appels simultanés ne font qu'une requête");
  });
});

Deno.test("chaque zone a son fichier de lieux, mis en cache séparément", async () => {
  const demandes: string[] = [];
  const c = new CatalogueDistant("https://exemple.fr/data/", (url) => {
    demandes.push(url);
    return Promise.resolve({ lieux: { "Berge Est": {} } });
  });
  await c.lieuxDe(9);
  await c.lieuxDe(9);
  await c.lieuxDe(34);
  assertEquals(demandes, [
    "https://exemple.fr/data/faune/9.json",
    "https://exemple.fr/data/faune/34.json",
  ]);
});

Deno.test("un réseau coupé rend une liste vide, il ne lève pas", async () => {
  //  Lever ici emporterait le thème et le masquage des marqueurs avec la
  //  barre. Il manque un bouton, c'est tout.
  const c = new CatalogueDistant("https://exemple.fr/data/", () => {
    return Promise.reject(new TypeError("Failed to fetch"));
  });
  assertEquals(await c.zones(), []);
  assertEquals(await c.lieuxDe(9), []);
  assertEquals(await c.nomEspece(16), null);
});

Deno.test("l'index des espèces se lit, et une seule fois", async () => {
  let appels = 0;
  const c = new CatalogueDistant("https://exemple.fr/data/", (url) => {
    appels++;
    assertEquals(url, "https://exemple.fr/data/especes.json");
    return Promise.resolve({ especes: { "16": "Roucool", "928": "Olivini" } });
  });
  assertEquals(await c.nomEspece(16), "Roucool");
  assertEquals(await c.nomEspece(928), "Olivini");
  assertEquals(appels, 1, "un bilan nomme dix espèces, pas dix requêtes");
});

Deno.test("une espèce inconnue rend null, pas un nom inventé", async () => {
  //  « Espèce 42 » dans un bilan a l'air d'une donnée, et le joueur le
  //  recopierait dans une contestation.
  const c = new CatalogueDistant("https://exemple.fr/data/", () => {
    return Promise.resolve({ especes: { "16": "Roucool" } });
  });
  assertEquals(await c.nomEspece(999), null);
});

Deno.test("un index abîmé ne fait pas tomber la page", () => {
  for (const donnees of [null, 42, "", {}, { especes: null }, { especes: [] }]) {
    assertEquals(especesDepuis(donnees).size, 0, JSON.stringify(donnees) ?? "undefined");
  }
});

Deno.test("les entrées qui n'ont pas la bonne forme sont écartées une par une", () => {
  //  Une ligne fausse ne doit pas emporter les 443 autres.
  const index = especesDepuis({
    especes: {
      "16": "Roucool",
      "0": "Rien", // un identifiant n'est jamais 0
      "-3": "Rien", // ni négatif
      "abc": "Rien", // ni une lettre
      "17": "", // un nom vide ne nomme pas
      "18": 12, // ni un nombre
      "928": "Olivini",
    },
  });
  assertEquals([...index.entries()], [[16, "Roucool"], [928, "Olivini"]]);
});
