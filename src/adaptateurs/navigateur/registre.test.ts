// ════════════════════════════════════════════════════════════════════
//  Ce qui se teste sans réseau : la configuration, les adresses
//  construites, et le fait qu'une panne ne lève pas.
// ════════════════════════════════════════════════════════════════════

import { assertEquals } from "@std/assert";
import { configDepuis, RegistreDistant } from "./registre.ts";

const CONFIG = { url: "https://exemple.supabase.co", clePubliable: "sb_publishable_xyz" };

Deno.test("une configuration complète se relit", () => {
  assertEquals(configDepuis({ url: CONFIG.url, clePubliable: CONFIG.clePubliable }), CONFIG);
});

Deno.test("la barre finale est retirée, pour ne pas doubler le séparateur", () => {
  assertEquals(
    configDepuis({ url: "https://exemple.supabase.co///", clePubliable: "k" })?.url,
    "https://exemple.supabase.co",
  );
});

Deno.test("une configuration douteuse rend null plutôt que des requêtes fausses", () => {
  //  Sans ça : des appels vers `undefined/rest/v1/…` et une pluie
  //  d'erreurs dans la console d'un joueur.
  for (
    const donnees of [
      null,
      42,
      {},
      { url: "https://x.co" },
      { clePubliable: "k" },
      { url: "http://x.co", clePubliable: "k" }, // pas de https
      { url: "https://x.co", clePubliable: "" },
      { url: "", clePubliable: "k" },
    ]
  ) {
    assertEquals(configDepuis(donnees), null, JSON.stringify(donnees) ?? "undefined");
  }
});

Deno.test("l'adresse du registre et la clé sont celles attendues", async () => {
  let vue = "";
  let entetes: Record<string, string> = {};
  const r = new RegistreDistant(CONFIG, (url, e) => {
    vue = url;
    entetes = e;
    return Promise.resolve([]);
  });
  await r.lignesDuSujet(976);
  assertEquals(
    vue,
    "https://exemple.supabase.co/rest/v1/registre?sujet_id=eq.976" +
      "&select=joueur_id,message_id,type,charge&order=message_id.asc",
  );
  assertEquals(entetes.apikey, "sb_publishable_xyz");
  assertEquals(entetes.Authorization, "Bearer sb_publishable_xyz");
});

Deno.test("les noms d'objets partent en une seule requête", async () => {
  const demandes: string[] = [];
  const r = new RegistreDistant(CONFIG, (url) => {
    demandes.push(url);
    return Promise.resolve([{ id: 1, nom: "Poké Ball" }, { id: 2, nom: "Potion" }]);
  });
  const noms = await r.nomsDObjets([1, 2]);
  assertEquals(demandes.length, 1);
  assertEquals(
    demandes[0],
    "https://exemple.supabase.co/rest/v1/objet?id=in.(1,2)&select=id,nom",
  );
  assertEquals([...noms], [[1, "Poké Ball"], [2, "Potion"]]);
});

Deno.test("aucun objet à nommer : aucune requête", async () => {
  //  `in.()` sur une liste vide est une erreur côté PostgREST.
  let appels = 0;
  const r = new RegistreDistant(CONFIG, () => {
    appels++;
    return Promise.resolve([]);
  });
  assertEquals((await r.nomsDObjets([])).size, 0);
  assertEquals(appels, 0);
});

Deno.test("une ligne d'objet abîmée est écartée, les autres restent", async () => {
  const r = new RegistreDistant(CONFIG, () =>
    Promise.resolve([
      { id: 1, nom: "Poké Ball" },
      { id: "2", nom: "Potion" },
      { id: 3, nom: "" },
      null,
      { id: 4, nom: "Super Ball" },
    ]));
  assertEquals([...await r.nomsDObjets([1, 2, 3, 4])], [[1, "Poké Ball"], [4, "Super Ball"]]);
});

Deno.test("un réseau coupé ne lève pas", async () => {
  const r = new RegistreDistant(CONFIG, () => Promise.reject(new TypeError("Failed to fetch")));
  assertEquals(await r.lignesDuSujet(976), null);
  assertEquals((await r.nomsDObjets([1])).size, 0);
});

Deno.test("une réponse qui n'est pas un tableau ne lève pas non plus", async () => {
  const r = new RegistreDistant(CONFIG, () => Promise.resolve({ message: "JWT expired" }));
  assertEquals((await r.nomsDObjets([1])).size, 0);
});
