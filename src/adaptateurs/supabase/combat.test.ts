// ════════════════════════════════════════════════════════════════════
//  src/adaptateurs/supabase/combat.test.ts
//
//  Ce que ces tests protègent : qu'une carte à moitié lue ne parte
//  JAMAIS dans un sujet.
//
//  Le défaut qu'on refuse : un nom absent donnerait « Un undefined
//  sauvage apparaît », un niveau absent « niveau NaN ». Et ce serait
//  posté, lu par un joueur, puis marqué comme fait — donc jamais
//  réessayé. Lever laisse la carte en file ; la tâche la reprendra au
//  passage suivant, une fois la cause corrigée.
// ════════════════════════════════════════════════════════════════════

import { assertEquals, assertThrows } from "@std/assert";
import { AppelEchoue } from "./appel.ts";
import { CartesDeRencontreSupabase, lireUneCarte } from "./combat.ts";

const CARTE = {
  combatId: "26f32b16-29cf-4d53-b0d9-b1a7596e1853",
  sujetId: 996,
  messageId: 15601,
  mentionne: "Jake Dalziel",
  essais: 0,
  sauvage: {
    especeId: 77,
    nom: "Ponyta",
    niveau: 10,
    types: ["feu"],
    pv: 30,
    attaque: 22,
    defense: 16,
  },
  combattant: {
    especeId: 4,
    nom: "Salamèche",
    surnom: null,
    niveau: 5,
    types: ["feu"],
    pv: 18,
    pvMax: 18,
    attaque: 10,
    defense: 9,
  },
};

Deno.test("une carte complète se lit", () => {
  const r = lireUneCarte(CARTE);
  assertEquals(r.sauvage.nom, "Ponyta");
  assertEquals(r.combattant?.nom, "Salamèche");
  assertEquals(r.messageId, 15601);
});

Deno.test("un champ manquant lève, il ne devient pas undefined", () => {
  for (const clef of ["combatId", "sujetId", "messageId", "mentionne"]) {
    const abime = { ...CARTE } as Record<string, unknown>;
    delete abime[clef];
    assertThrows(() => lireUneCarte(abime), AppelEchoue, clef);
  }
});

Deno.test("un chiffre manquant du sauvage lève", () => {
  //  C'est le pire cas : « PV : NaN » posté dans le sujet et marqué
  //  comme fait.
  for (const clef of ["niveau", "pv", "attaque", "defense"]) {
    const sauvage = { ...CARTE.sauvage } as Record<string, unknown>;
    delete sauvage[clef];
    assertThrows(
      () => lireUneCarte({ ...CARTE, sauvage }),
      AppelEchoue,
      clef,
    );
  }
});

Deno.test("une espèce sans type lève", () => {
  //  Elle n'existe pas — le garde-fou n° 37 le vérifie sur les 955 —
  //  donc si elle arrive ici, c'est la lecture qui est cassée.
  assertThrows(
    () => lireUneCarte({ ...CARTE, sauvage: { ...CARTE.sauvage, types: [] } }),
    AppelEchoue,
    "au moins un type",
  );
});

Deno.test("l'absence de combattant n'est pas une faute", () => {
  //  Planche 99 §5.3 : une équipe vide laisse la rencontre être une
  //  rencontre. `null` comme l'absence du champ : la base rend un
  //  `null` JSON, un tableau en mémoire ne rend souvent rien.
  assertEquals(lireUneCarte({ ...CARTE, combattant: null }).combattant, null);
  const sansChamp = { ...CARTE } as Record<string, unknown>;
  delete sansChamp.combattant;
  assertEquals(lireUneCarte(sansChamp).combattant, null);
});

Deno.test("un combattant à moitié lu lève, lui", () => {
  //  L'absence TOTALE est un cas du jeu ; une moitié est une faute.
  assertThrows(
    () =>
      lireUneCarte({
        ...CARTE,
        combattant: { ...CARTE.combattant, pv: undefined },
      }),
    AppelEchoue,
    "combattant.pv",
  );
});

Deno.test("un surnom vide vaut pas de surnom", () => {
  //  Sinon la carte dirait « (Salamèche) » avec une parenthèse
  //  orpheline devant.
  assertEquals(
    lireUneCarte({ ...CARTE, combattant: { ...CARTE.combattant, surnom: "  " } })
      .combattant?.surnom,
    null,
  );
  assertEquals(
    lireUneCarte({ ...CARTE, combattant: { ...CARTE.combattant, surnom: "Biscotte" } })
      .combattant?.surnom,
    "Biscotte",
  );
});

Deno.test("une réponse qui n'est pas un tableau lève", () => {
  const file = new CartesDeRencontreSupabase(() => Promise.resolve({ oups: 1 }));
  return file.aPoster(10).then(
    () => {
      throw new Error("aurait dû lever");
    },
    (e) => assertEquals(e.name, "AppelEchoue"),
  );
});

Deno.test("les deux issues passent les bons noms à la base", async () => {
  const vus: { fonction: string; argument: unknown }[] = [];
  const file = new CartesDeRencontreSupabase((fonction, argument) => {
    vus.push({ fonction, argument });
    return Promise.resolve(3);
  });

  await file.postee("c1", 90001);
  await file.echouee("c1", "forum injoignable");

  //  LES NOMS DES CLÉS SONT CEUX QUE LA 0047 LIT. Une clé renommée d'un
  //  seul côté ne lèverait pas : `p->>'combat'` rendrait null, le
  //  `update` ne toucherait aucune ligne, et la carte resterait en file
  //  pour toujours sans qu'une seule erreur n'apparaisse.
  assertEquals(vus[0].fonction, "carte_postee");
  assertEquals(vus[0].argument, { combat: "c1", message: 90001 });
  assertEquals(vus[1].fonction, "carte_echouee");
  assertEquals(vus[1].argument, { combat: "c1", erreur: "forum injoignable" });
});
