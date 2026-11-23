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
import { CartesDeRencontreSupabase, DefisSupabase, lireUneCarte } from "./combat.ts";

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
    pvMax: null,
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

// ── LES DÉFIS, 23 novembre ──────────────────────────────────────────

/** Un appel qui rend ce qu'on lui dit, et retient ce qu'on lui a
 *  demandé. Assez pour ces quatre tests : la question est toujours
 *  « qu'est-ce que l'adaptateur fait d'une réponse », jamais « est-ce
 *  que PostgREST répond ». */
function appelQuiRend(reponse: unknown): {
  appeler: (f: string, a: unknown) => Promise<unknown>;
  vus: { f: string; a: unknown }[];
} {
  const vus: { f: string; a: unknown }[] = [];
  return {
    appeler: (f, a) => {
      vus.push({ f, a });
      return Promise.resolve(reponse);
    },
    vus,
  };
}

Deno.test("UN DÉFI REFUSÉ EST UNE RÉPONSE, PAS UNE PANNE", async () => {
  //  Toutes les raisons de la 0060 sont des cas du jeu : un combat
  //  tourne déjà, quelqu'un a défié avant, l'équipe est vide. Lever
  //  ferait passer une règle du jeu pour un incident, et le passage
  //  s'arrêterait sur le sujet.
  const { appeler, vus } = appelQuiRend({ ouvert: false, raison: "COMBAT_EN_COURS" });
  const defis = new DefisSupabase(appeler);
  const fait = await defis.lancer({ sujetId: 996, messageId: 15601, joueurId: "j1" });
  assertEquals(fait, { defiId: null, ouvert: false, raison: "COMBAT_EN_COURS" });
  assertEquals(vus[0].f, "ouvrir_un_defi");
});

Deno.test("`ouvert` ABSENT VAUT FAUX, et jamais l'inverse", async () => {
  //  Annoncer un défi de moins ne fait rien de grave ; annoncer un défi
  //  qui n'existe pas en ferait accepter un vide.
  const { appeler } = appelQuiRend({ defiId: "d1" });
  const fait = await new DefisSupabase(appeler).lancer({
    sujetId: 996,
    messageId: 15601,
    joueurId: "j1",
  });
  assertEquals(fait.ouvert, false);
  assertEquals(fait.defiId, "d1");
});

Deno.test("UN DUEL OUVERT SANS IDENTIFIANT LÈVE", async () => {
  //  C'est le seul cas qui lève, et c'en est bien un : la suite —
  //  poster la carte, jouer les tours — n'aurait rien à quoi se
  //  raccrocher. Mieux vaut que le passage note le sujet.
  const { appeler } = appelQuiRend({ ouvert: true, defieur: "j1", adverse: "j2" });
  const defis = new DefisSupabase(appeler);
  let leve = false;
  await defis.accepter({ sujetId: 996, messageId: 15602, joueurId: "j2" })
    .catch((e) => {
      leve = e instanceof AppelEchoue;
    });
  assertEquals(leve, true);
});

Deno.test("UNE ACCEPTATION LUE DIT QUI FRAPPE EN PREMIER", async () => {
  //  Le défieur. Il a attendu ; l'autre vient d'écrire son
  //  acceptation. C'est la même idée que « le joueur poste, donc le
  //  joueur agit » du combat sauvage, appliquée à deux auteurs.
  const { appeler, vus } = appelQuiRend({
    ouvert: true,
    combatId: "c1",
    defieur: "j1",
    adverse: "j2",
    aQui: "j1",
  });
  const fait = await new DefisSupabase(appeler).accepter({
    sujetId: 996,
    messageId: 15602,
    joueurId: "j2",
  });
  assertEquals(fait, {
    combatId: "c1",
    ouvert: true,
    raison: null,
    defieur: "j1",
    adverse: "j2",
  });
  assertEquals(vus[0].f, "accepter_un_defi");
  assertEquals(vus[0].a, { sujetId: 996, messageId: 15602, joueurId: "j2" });
});

Deno.test("RETIRER REND VRAI SEULEMENT SI LA BASE A FERMÉ", async () => {
  //  `fermer_un_defi` rend faux quand le défi était déjà clos : la
  //  première fin l'emporte, comme pour un combat et comme pour une
  //  demande de clôture.
  const oui = appelQuiRend(true);
  assertEquals(await new DefisSupabase(oui.appeler).retirer("d1"), true);
  assertEquals(oui.vus[0].a, { defiId: "d1", etat: "retire" });
  const non = appelQuiRend(false);
  assertEquals(await new DefisSupabase(non.appeler).retirer("d1"), false);
});
