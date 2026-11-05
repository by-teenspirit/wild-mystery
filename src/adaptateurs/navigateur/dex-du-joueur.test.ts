// ════════════════════════════════════════════════════════════════════
//  src/adaptateurs/navigateur/dex-du-joueur.test.ts
//
//  CE QUI EST ÉPROUVÉ ICI N'EST PAS LA LECTURE, C'EST CE QUI NE DOIT
//  PAS ARRIVER.
//
//  L'annexe des zones est une page PUBLIQUE. Elle montre la marque « vu
//  / attrapé » à qui a lié son carnet, et elle ne doit rien demander à
//  personne d'autre. Les trois décisions qui pourraient se renverser
//  sans qu'un pixel bouge :
//
//    1. un invité ne déclenche AUCUN appel réseau — ni au forum, ni à
//       Supabase ;
//    2. tout refus rend `null`, et `null` ne veut pas dire « rien vu » :
//       l'appelant ne marque alors AUCUNE carte ;
//    3. un laissez-passer périmé se rafraîchit, et s'il ne peut pas, il
//       s'oublie — sinon chaque page retente un appel voué à l'échec.
// ════════════════════════════════════════════════════════════════════

import { assertEquals } from "@std/assert";
import { dexDuJoueur, type Rouages } from "./dex-du-joueur.ts";
import type { Laissez } from "../../navigateur/session-de-jeu.ts";
import type { ConfigSupabase } from "./registre.ts";

const ACCES: ConfigSupabase = {
  url: "https://exemple.supabase.co",
  clePubliable: "sb_publishable_exemple",
};

/** Un laissez-passer encore bon à l'instant qu'on donne. */
function vivant(jeton = "jeton-bon"): Laissez {
  return { jeton, rafraichir: "refr", expireLe: 10_000_000 };
}

function mort(): Laissez {
  return { jeton: "jeton-mort", rafraichir: "refr", expireLe: 1_000 };
}

/** Une réponse de PostgREST, réduite à ce que le code en lit. */
function reponse(corps: unknown, ok = true, status = 200): Response {
  return {
    ok,
    status,
    json: () => Promise.resolve(corps),
  } as unknown as Response;
}

/** Les rouages d'un cas qui marche, qu'on abîme ensuite cas par cas. */
function rouages(dessus: Partial<Rouages> = {}): {
  r: Rouages;
  appels: string[];
} {
  const appels: string[] = [];
  const r: Rouages = {
    acces: ACCES,
    maintenant: () => 5_000_000,
    lire: () => vivant(),
    garder: () => {},
    oublier: () => {
      appels.push("oublie");
    },
    qui: () => {
      appels.push("forum");
      return Promise.resolve({ compte: { id: 4 } });
    },
    appeler: (_a, _j, nom) => {
      appels.push(`base:${nom}`);
      return Promise.resolve(
        reponse({
          pokedex: [
            { especeId: 25, croiseLe: "2026-01-01", attrapeLe: "2026-01-02", fois: 2 },
            { especeId: 1, croiseLe: "2026-01-01", attrapeLe: null, fois: 1 },
          ],
        }),
      );
    },
    ...dessus,
  };
  return { r, appels };
}

Deno.test("le carnet lu devient une table d'états", async () => {
  const { r, appels } = rouages();
  const dex = await dexDuJoueur(r);
  assertEquals(dex?.get(25), "attrape");
  assertEquals(dex?.get(1), "croise");
  //  UNE ESPÈCE ABSENTE DU RELEVÉ N'EST PAS DANS LA TABLE : l'appelant
  //  lit `undefined` et ne marque rien.
  assertEquals(dex?.get(4), undefined);
  assertEquals(appels, ["forum", "base:carnet_de_la_session"]);
});

Deno.test("UN INVITÉ NE DÉCLENCHE AUCUN APPEL", async () => {
  //  C'est la décision la plus importante du fichier, et la plus facile
  //  à perdre : il suffirait de demander au forum qui regarde AVANT de
  //  regarder s'il y a un laissez-passer. La majorité des gens qui
  //  liront l'annexe sont dans ce cas, et ils ne doivent pas payer un
  //  aller-retour pour une pastille qu'ils ne verraient pas.
  const { r, appels } = rouages({ lire: () => null });
  assertEquals(await dexDuJoueur(r), null);
  assertEquals(appels, []);
});

Deno.test("sans accès à Supabase, rien n'est tenté non plus", async () => {
  const { r, appels } = rouages({ acces: null });
  assertEquals(await dexDuJoueur(r), null);
  assertEquals(appels, []);
});

Deno.test("un membre du forum sans personnage lié ne fait rien dire", async () => {
  //  La base répond `null` : « aucun personnage derrière cette
  //  connexion ». Le carnet, lui, propose la liaison ; l'annexe n'a rien
  //  à proposer, donc elle ne marque rien.
  const { r } = rouages({
    appeler: () => Promise.resolve(reponse(null)),
  });
  assertEquals(await dexDuJoueur(r), null);
});

Deno.test("un invité DU FORUM avec un vieux laissez-passer ne marque rien", async () => {
  //  Le cas de quelqu'un qui s'est déconnecté du forum mais dont le
  //  navigateur garde le laissez-passer. On ne sait pas qui regarde, donc
  //  on ne montre pas le pokédex de la dernière personne connectée.
  const { r, appels } = rouages({
    qui: () => Promise.resolve({ compte: null }),
  });
  assertEquals(await dexDuJoueur(r), null);
  assertEquals(appels.includes("base:carnet_de_la_session"), false);
});

Deno.test("le forum muet rend null, il ne lève pas", async () => {
  const { r } = rouages({
    qui: () => Promise.reject(new Error("le forum a répondu 503")),
  });
  assertEquals(await dexDuJoueur(r), null);
});

Deno.test("la base qui refuse rend null, elle ne lève pas", async () => {
  const { r } = rouages({
    appeler: () => Promise.resolve(reponse(null, false, 401)),
  });
  assertEquals(await dexDuJoueur(r), null);
});

Deno.test("la base qui ne répond pas du tout rend null", async () => {
  const { r } = rouages({
    appeler: () => Promise.reject(new Error("réseau")),
  });
  assertEquals(await dexDuJoueur(r), null);
});

Deno.test("UN LAISSEZ-PASSER PÉRIMÉ SE RAFRAÎCHIT, ET LE NEUF SERT", async () => {
  let garde: Laissez | null = null;
  const vus: string[] = [];
  const { r } = rouages({
    lire: () => mort(),
    garder: (l) => {
      garde = l;
    },
    rafraichirLe: () => Promise.resolve(vivant("jeton-neuf")),
    appeler: (_a, jeton) => {
      vus.push(jeton);
      return Promise.resolve(reponse({ pokedex: [] }));
    },
  });
  assertEquals((await dexDuJoueur(r))?.size, 0);
  //  LE JETON NEUF EST CELUI QUI PART, pas celui qu'on avait.
  assertEquals(vus, ["jeton-neuf"]);
  assertEquals(garde !== null, true);
});

Deno.test("un laissez-passer qu'on ne peut pas rafraîchir s'oublie", async () => {
  //  SANS CET OUBLI, CHAQUE PAGE RETENTE un rafraîchissement voué à
  //  l'échec — un aller-retour par annexe, pour rien.
  const { r, appels } = rouages({
    lire: () => mort(),
    rafraichirLe: () => Promise.reject(new Error("révoqué")),
  });
  assertEquals(await dexDuJoueur(r), null);
  assertEquals(appels, ["oublie"]);
});

Deno.test("UNE RÉPONSE ABÎMÉE NE CASSE PAS LA PAGE", async () => {
  //  La réponse traverse PostgREST et un `JSON.parse`. Une page qui
  //  plante sur un champ manquant perdrait la carte entière pour une
  //  marque.
  for (const corps of [{}, { pokedex: 12 }, { pokedex: "rien" }, 42, "texte"]) {
    const { r } = rouages({ appeler: () => Promise.resolve(reponse(corps)) });
    assertEquals((await dexDuJoueur(r))?.size, 0, `corps : ${JSON.stringify(corps)}`);
  }
});

Deno.test("les lignes sans identifiant d'espèce sont écartées", async () => {
  const { r } = rouages({
    appeler: () =>
      Promise.resolve(
        reponse({
          pokedex: [
            null,
            "texte",
            { croiseLe: "2026-01-01" },
            { especeId: "25", croiseLe: "2026-01-01" },
            { especeId: 25.5, croiseLe: "2026-01-01" },
            { especeId: 7, croiseLe: "2026-01-01", attrapeLe: null, fois: 1 },
          ],
        }),
      ),
  });
  const dex = await dexDuJoueur(r);
  assertEquals(dex?.size, 1);
  assertEquals(dex?.get(7), "croise");
});

Deno.test("un JSON illisible rend null", async () => {
  const { r } = rouages({
    appeler: () =>
      Promise.resolve(
        {
          ok: true,
          status: 200,
          json: () => Promise.reject(new Error("pas du JSON")),
        } as unknown as Response,
      ),
  });
  assertEquals(await dexDuJoueur(r), null);
});
