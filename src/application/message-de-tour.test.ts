// ════════════════════════════════════════════════════════════════════
//  src/application/message-de-tour.test.ts
//
//  Ce que ces tests protègent.
//
//  **Que le joueur puisse vérifier.** Le dé est écrit, la chance d'une
//  ball est écrite — « un joueur qui rate trois fois doit pouvoir lire
//  qu'il avait 12 % », sinon il croit que le serveur triche. Et les
//  mêmes nombres sont dans le récit en base, donc les deux se
//  vérifient l'un l'autre.
//
//  **Que « aucun effet » ne ressemble pas à un bogue.** « 0 dégât »
//  ferait croire à une panne ; « ça n'a aucun effet » est
//  l'information dont le joueur a besoin pour changer de Pokémon.
//
//  **Que la capture dise OÙ va le Pokémon.** À la boîte, à la clôture.
//  Sans ça, le joueur le cherche dans son équipe et ne le trouve pas.
//
//  **Que l'état des deux soit toujours là**, même quand personne n'a
//  frappé : c'est la ligne qu'on relit pour décider du tour suivant.
// ════════════════════════════════════════════════════════════════════

import { assert, assertEquals, assertStringIncludes } from "@std/assert";
import type { TourEnAttente } from "./ports.ts";
import {
  efficaciteEnMots,
  phraseDeLaChance,
  phraseDeLaFin,
  redigerLeTour,
} from "./message-de-tour.ts";

const BASE = {
  tourId: "t-1",
  combatId: "c-1",
  sujetId: 996,
  messageId: 15601,
  essais: 0,
  mentionne: "Jake Dalziel",
  sauvage: { nom: "Ponyta", pv: 18, pvMax: 30 },
  combattant: { nom: "Salamèche", surnom: null, pv: 11, pvMax: 18 },
};

function attaque(p: Partial<TourEnAttente> = {}): TourEnAttente {
  return {
    ...BASE,
    numero: 1,
    demande: "attaquer",
    detail: { capacite: 52, nom: "Flammèche" },
    fin: null,
    recit: {
      frappes: [
        {
          qui: "joueur",
          capacite: { nom: "Flammèche" },
          touche: true,
          degats: { points: 12, efficacite: 1, de: 93 },
        },
      ],
    },
    ...p,
  };
}

Deno.test("le tour s'ouvre sur son numéro et ce que le joueur a fait", () => {
  const texte = redigerLeTour(attaque(), "WM-7K4P-9QX");
  assertEquals(
    texte.split("\n")[0],
    "TOUR 1 — Salamèche attaque avec Flammèche.",
  );
});

Deno.test("LE DÉ EST ÉCRIT, et il est le même qu'en base", () => {
  //  Un joueur qui perd d'un point doit pouvoir lire le tirage plutôt
  //  que de soupçonner le serveur.
  assertStringIncludes(redigerLeTour(attaque(), "C"), "(dé 93)");
});

Deno.test("un raté n'affiche pas son dé", () => {
  //  Le dé n'a servi à rien, et l'afficher ferait croire qu'il a décidé
  //  du raté — c'est la précision qui a décidé.
  const texte = redigerLeTour(
    attaque({
      recit: {
        frappes: [{
          qui: "joueur",
          capacite: { nom: "Flammèche" },
          touche: false,
          degats: null,
        }],
      },
    }),
    "C",
  );
  assertStringIncludes(texte, "manque sa cible");
  assert(!texte.includes("dé "), texte);
});

Deno.test("l'efficacité se dit en mots, pas en multiplicateur", () => {
  //  « C'est super efficace » se lit du premier coup ; « ×2 » demande
  //  de savoir contre quoi.
  assertEquals(efficaciteEnMots(2), "C'est super efficace !");
  assertEquals(efficaciteEnMots(4), "C'est super efficace !");
  assertEquals(efficaciteEnMots(0.5), "Ce n'est pas très efficace…");
  assertEquals(efficaciteEnMots(0), "Ça n'a aucun effet.");
  //  NEUTRE NE SE DIT PAS : une ligne « c'est normalement efficace »
  //  sous chaque coup serait du bruit.
  assertEquals(efficaciteEnMots(1), null);
});

Deno.test("« AUCUN EFFET » NE PARLE PAS DE DÉGÂTS", () => {
  //  « 0 dégât » ferait croire à un bogue.
  const texte = redigerLeTour(
    attaque({
      recit: {
        frappes: [{
          qui: "joueur",
          capacite: { nom: "Charge" },
          touche: true,
          degats: { points: 0, efficacite: 0, de: 90 },
        }],
      },
    }),
    "C",
  );
  assertStringIncludes(texte, "Ça n'a aucun effet.");
  assert(!texte.includes("0 dégâts"), texte);
});

Deno.test("l'état des deux est toujours là", () => {
  //  Même quand personne n'a frappé : c'est la ligne qu'on relit pour
  //  décider du tour suivant.
  const texte = redigerLeTour(
    attaque({ demande: "fuir", detail: null, recit: { frappes: [] } }),
    "C",
  );
  assertStringIncludes(texte, "Salamèche : 11/18 PV");
  assertStringIncludes(texte, "Ponyta : 18/30 PV");
});

Deno.test("la chance de prise est écrite, en pourcentage entier", () => {
  //  « 66 % » se lit, « 0,664 » se traduit.
  const t = attaque({
    demande: "ball",
    detail: { objetId: 990001, nom: "Poké Ball", chance: 0.664, de: 0.21 },
    recit: { frappes: [] },
  });
  assertEquals(phraseDeLaChance(t), "Chance de prise : 66 % (tirage 21 %).");
  assertStringIncludes(redigerLeTour(t, "C"), "66 %");
});

Deno.test("la chance ne s'écrit que pour une ball", () => {
  assertEquals(phraseDeLaChance(attaque()), null);
});

Deno.test("LA CAPTURE DIT OÙ VA LE POKÉMON", () => {
  //  Sans ça, le joueur le cherche dans son équipe et ne le trouve pas.
  const texte = redigerLeTour(
    attaque({
      demande: "ball",
      fin: "capture",
      detail: { nom: "Poké Ball", chance: 0.9, de: 0.1 },
      recit: { frappes: [] },
    }),
    "C",
  );
  assertStringIncludes(texte, "est attrapé");
  assertStringIncludes(texte, "boîte à la clôture");
});

Deno.test("les quatre fins se disent, et du bon point de vue", () => {
  assertStringIncludes(phraseDeLaFin(attaque({ fin: "victoire" }))!, "Ponyta est K.O.");
  assertStringIncludes(phraseDeLaFin(attaque({ fin: "defaite" }))!, "Salamèche est K.O.");
  //  LA FUITE A DEUX SENS, et le message doit dire lequel : le joueur
  //  qui part, ou le sauvage qui s'en va au cinquième tour.
  assertStringIncludes(
    phraseDeLaFin(attaque({ fin: "fuite", demande: "fuir" }))!,
    "Tu t'éloignes",
  );
  assertStringIncludes(
    phraseDeLaFin(attaque({ fin: "fuite", demande: "attaquer" }))!,
    "Ponyta s'enfuit",
  );
  assertEquals(phraseDeLaFin(attaque()), null);
});

Deno.test("une Potion dit les PV RENDUS, pas le montant de l'objet", () => {
  //  Une Potion de 20 sur un Pokémon à 14/18 rend 4. Dire 20 ferait
  //  croire au joueur qu'on lui en a volé seize.
  const texte = redigerLeTour(
    attaque({
      demande: "objet",
      detail: { objetId: 990020, nom: "Potion", rendus: 4 },
      recit: { frappes: [] },
    }),
    "C",
  );
  assertStringIncludes(texte, "reprend 4 PV");
  assert(!texte.includes("20 PV"), texte);
});

Deno.test("le surnom paraît, sans faire disparaître l'espèce", () => {
  const texte = redigerLeTour(
    attaque({
      combattant: { nom: "Carapuce", surnom: "Biscotte", pv: 9, pvMax: 20 },
    }),
    "C",
  );
  assertStringIncludes(texte, "Biscotte (Carapuce)");
});

Deno.test("sans combattant, le message tient quand même", () => {
  //  Planche 99 §5.3 : une équipe vide laisse la rencontre être une
  //  rencontre, et la ball se lance. Le message ne doit pas écrire
  //  « undefined ».
  const texte = redigerLeTour(
    attaque({ combattant: null, demande: "ball", recit: { frappes: [] } }),
    "C",
  );
  assert(!texte.includes("undefined"), texte);
  assertStringIncludes(texte, "Ponyta : 18/30 PV");
});

Deno.test("le code est en toutes lettres, en dernier", () => {
  const lignes = redigerLeTour(attaque(), "WM-7K4P-9QX").split("\n");
  assertEquals(lignes[lignes.length - 1], "CODE : WM-7K4P-9QX");
});
