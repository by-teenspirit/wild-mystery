// ════════════════════════════════════════════════════════════════════
//  Ce qui se teste sans navigateur : la déduction de l'adresse et le
//  cache. Le reste du fichier est du DOM et du réseau, vérifiés sur le
//  forum.
// ════════════════════════════════════════════════════════════════════

import { assertEquals } from "@std/assert";
import { CatalogueDistant, racineDesDonnees } from "./catalogue.ts";

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
});
