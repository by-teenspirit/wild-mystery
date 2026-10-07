// ════════════════════════════════════════════════════════════════════
//  La lecture du journal : un appel, et ce qu'il envoie.
//
//  Ce qui est protégé ici : **qu'une panne ne lève pas**. L'encart est du
//  décor posé sur l'index ; s'il levait, il emporterait le thème et le
//  masquage des marqueurs, qui sont appelés dans la même foulée. C'est
//  arrivé une fois avec le catalogue, et c'est la raison de ce fichier.
//
//  Et qu'on ne demande ni zéro ni mille lignes : la fonction SQL reborne
//  déjà, mais par un défaut qu'on s'appliquerait par accident.
// ════════════════════════════════════════════════════════════════════

import { assert, assertEquals } from "@std/assert";
import { JournalDistant } from "./journal.ts";
import type { ConfigSupabase } from "./registre.ts";

const CONFIG: ConfigSupabase = {
  url: "https://exemple.supabase.co",
  clePubliable: "sb_publishable_faux",
};

type Vu = { url: string; entetes: Record<string, string>; corps: string };

function espion(
  rendre: (vu: Vu) => unknown = () => [],
): { journal: JournalDistant; appels: Vu[] } {
  const appels: Vu[] = [];
  const journal = new JournalDistant(CONFIG, (url, entetes, corps) => {
    const vu = { url, entetes, corps };
    appels.push(vu);
    return Promise.resolve(rendre(vu));
  });
  return { journal, appels };
}

Deno.test("l'appel va sur la fonction, avec la clé publiable", () => {
  const { journal, appels } = espion();
  return journal.dernieres(8).then(() => {
    assertEquals(appels.length, 1);
    assertEquals(
      appels[0].url,
      "https://exemple.supabase.co/rest/v1/rpc/journal_dernieres",
    );
    assertEquals(appels[0].entetes.apikey, "sb_publishable_faux");
    assertEquals(appels[0].entetes.Authorization, "Bearer sb_publishable_faux");
    assertEquals(appels[0].entetes["Content-Type"], "application/json");
    assertEquals(appels[0].corps, '{"p":{"combien":8}}');
  });
});

Deno.test("un nombre de lignes absurde est assaini avant l'envoi", async () => {
  //  La fonction SQL reborne de toute façon (1 à 20). On n'envoie pas
  //  n'importe quoi quand même : un `NaN` deviendrait `null` dans le
  //  JSON, et la fonction retomberait sur son défaut — ce qui marche,
  //  mais par accident.
  const cas: ReadonlyArray<[number, string]> = [
    [8, '{"p":{"combien":8}}'],
    [1, '{"p":{"combien":1}}'],
    [20, '{"p":{"combien":20}}'],
    [500, '{"p":{"combien":20}}'],
    [0, '{"p":{"combien":8}}'],
    [-3, '{"p":{"combien":8}}'],
    [2.5, '{"p":{"combien":8}}'],
    [Number.NaN, '{"p":{"combien":8}}'],
  ];
  for (const [combien, corps] of cas) {
    const { journal, appels } = espion();
    await journal.dernieres(combien);
    assertEquals(appels[0].corps, corps, String(combien));
  }
});

Deno.test("la réponse est rendue telle quelle : la lecture est au domaine", async () => {
  //  L'adaptateur ne valide rien. `navigateur/vie.ts` le fait, et il est
  //  testé pour ça — deux validations seraient deux avis sur ce qu'est
  //  une bonne ligne.
  const brut = [{ type: "achat", pseudo: "Anna", detail: { articles: 2 } }];
  const { journal } = espion(() => brut);
  assertEquals(await journal.dernieres(8), brut);
});

Deno.test("UN APPEL QUI LÈVE REND NULL", async () => {
  //  Le test qui compte. Sans ce `catch`, une coupure réseau sur l'index
  //  emporterait le thème du joueur.
  const journal = new JournalDistant(CONFIG, () => {
    throw new Error("réseau coupé");
  });
  assertEquals(await journal.dernieres(8), null);
});

Deno.test("une réponse rejetée rend null, pas une promesse rompue", async () => {
  const journal = new JournalDistant(CONFIG, () => Promise.reject(new Error("503")));
  assertEquals(await journal.dernieres(8), null);
});

Deno.test("rien de la clé de service ne peut passer par là", () => {
  //  La configuration ne porte que l'URL et la clé publiable : le type
  //  l'interdit, et ce test le rappelle à qui voudrait l'élargir.
  assert(!("cleDeService" in CONFIG));
  assertEquals(Object.keys(CONFIG).sort(), ["clePubliable", "url"]);
});
