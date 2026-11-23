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
  phrasesDuTour,
  redigerLeTour,
} from "./message-de-tour.ts";

const BASE = {
  tourId: "t-1",
  combatId: "c-1",
  sujetId: 996,
  messageId: 15601,
  essais: 0,
  mentionne: "Jake Dalziel",
  sauvage: { especeId: 77, nom: "Ponyta", pv: 18, pvMax: 30 },
  combattant: { especeId: 4, nom: "Salamèche", surnom: null, pv: 11, pvMax: 18 },
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

const RACINE = "https://exemple.test/wm/";

Deno.test("le tour s'ouvre sur son numéro, puis raconte", () => {
  const html = redigerLeTour(attaque(), RACINE);
  assertStringIncludes(html, '<p class="wm-combat__surtitre">Tour 1</p>');
  assertStringIncludes(html, "Salamèche utilise Flammèche");
  //  LE RÉCIT AVANT LES FICHES : on lit ce qui s'est passé, puis on
  //  regarde où en sont les deux.
  assert(
    html.indexOf("utilise Flammèche") < html.indexOf("wm-combat__duel"),
    html,
  );
});

Deno.test("« ATTAQUER » NE S'ANNONCE PAS DEUX FOIS", () => {
  //  Vu au rendu : « Salamèche attaque avec Flammèche. Salamèche
  //  utilise Flammèche : 12 dégâts. » La frappe dit déjà tout.
  const phrases = phrasesDuTour(attaque());
  assertEquals(
    phrases.filter((p) => p.includes("Flammèche")).length,
    1,
    phrases.join(" | "),
  );
  assert(!phrases.some((p) => p.includes("attaque avec")), phrases.join(" | "));
});

Deno.test("les autres demandes, elles, s'annoncent", () => {
  //  « Tu lances une Poké Ball » n'est dit nulle part ailleurs : sans
  //  l'annonce, un lancer raté ne produirait aucune phrase.
  const phrases = phrasesDuTour(
    attaque({ demande: "fuir", detail: null, recit: { frappes: [] } }),
  );
  assertEquals(phrases[0], "Tu prends la fuite.");
});

Deno.test("une attaque qui ne frappe pas garde son annonce", () => {
  //  Le cas du tour refusé : sans frappe, la seule phrase disponible
  //  est l'annonce. La supprimer laisserait un message muet.
  const phrases = phrasesDuTour(attaque({ recit: { frappes: [] } }));
  assertEquals(phrases[0], "Salamèche attaque avec Flammèche.");
});

Deno.test("LE DÉ EST ÉCRIT, et il est le même qu'en base", () => {
  //  Un joueur qui perd d'un point doit pouvoir lire le tirage plutôt
  //  que de soupçonner le serveur.
  assertStringIncludes(redigerLeTour(attaque(), RACINE), "(dé 93)");
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
    RACINE,
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
    RACINE,
  );
  assertStringIncludes(texte, "Ça n'a aucun effet.");
  assert(!texte.includes("0 dégâts"), texte);
});

Deno.test("l'état des deux est toujours là", () => {
  //  Même quand personne n'a frappé : c'est la ligne qu'on relit pour
  //  décider du tour suivant.
  const texte = redigerLeTour(
    attaque({ demande: "fuir", detail: null, recit: { frappes: [] } }),
    RACINE,
  );
  assertStringIncludes(texte, ">11/18 PV<");
  assertStringIncludes(texte, ">18/30 PV<");
});

Deno.test("la chance de prise est écrite, en pourcentage entier", () => {
  //  « 66 % » se lit, « 0,664 » se traduit.
  const t = attaque({
    demande: "ball",
    detail: { objetId: 990001, nom: "Poké Ball", chance: 0.664, de: 0.21 },
    recit: { frappes: [] },
  });
  assertEquals(phraseDeLaChance(t), "Chance de prise : 66 % (tirage 21 %).");
  assertStringIncludes(redigerLeTour(t, RACINE), "66 %");
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
    RACINE,
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
    RACINE,
  );
  assertStringIncludes(texte, "reprend 4 PV");
  assert(!texte.includes("20 PV"), texte);
});

Deno.test("le surnom paraît, sans faire disparaître l'espèce", () => {
  const texte = redigerLeTour(
    attaque({
      combattant: { especeId: 7, nom: "Carapuce", surnom: "Biscotte", pv: 9, pvMax: 20 },
    }),
    RACINE,
  );
  assertStringIncludes(texte, "Biscotte (Carapuce)");
});

Deno.test("sans combattant, le message tient quand même", () => {
  //  Planche 99 §5.3 : une équipe vide laisse la rencontre être une
  //  rencontre, et la ball se lance. Le message ne doit pas écrire
  //  « undefined ».
  const texte = redigerLeTour(
    attaque({ combattant: null, demande: "ball", recit: { frappes: [] } }),
    RACINE,
  );
  assert(!texte.includes("undefined"), texte);
  assertStringIncludes(texte, ">18/30 PV<");
});

Deno.test("LE CODE NE S'AFFICHE PAS", () => {
  //  Règle retournée le 18 novembre : « n'affiche pas le code, le
  //  joueur ne doit pas le voir ». Il reste dans le marqueur que
  //  l'adaptateur pose, donc dans la source de la page pour qui
  //  vérifie — et cette fonction ne le reçoit même plus.
  const html = redigerLeTour(attaque(), RACINE);
  assert(!html.includes("CODE"), html);
  assert(!/WM-[A-Z0-9]{4}-[A-Z0-9]{3}/.test(html), html);
});

Deno.test("TOUT SUR UNE LIGNE — Forumactif fait un <br> de chaque retour", () => {
  assert(!redigerLeTour(attaque(), RACINE).includes("\n"));
});

Deno.test("LES DEUX FICHES SONT LÀ, avec leurs sprites", () => {
  //  C'est le message qu'on relit cinq fois dans un combat : l'état
  //  des deux doit se voir d'un coup d'œil, pas se lire.
  const html = redigerLeTour(attaque(), RACINE);
  assertStringIncludes(html, "assets/sprites-figes/forum/77.png");
  assertStringIncludes(html, "assets/sprites-figes/forum/4.png");
  assertStringIncludes(html, ">18/30 PV<");
  assertStringIncludes(html, ">11/18 PV<");
});

// ── LE TOUR D'UN DUEL, 23 novembre ──────────────────────────────────

/** Le même tour, mais entre deux dresseurs.
 *
 *  LE DÉCOR NOMME LES DEUX, parce que c'est précisément ce qui manque
 *  à un message de combat sauvage : il n'a qu'un lecteur, donc il dit
 *  « tu ». */
function frappeDeDuel(p: Partial<TourEnAttente> = {}): TourEnAttente {
  return attaque({
    genre: "duel",
    defieur: "Jake Dalziel",
    adverse: "Erin Kavanagh",
    sauvage: { especeId: 7, nom: "Carapuce", surnom: "Bulle", pv: 14, pvMax: 21 },
    ...p,
  });
}

Deno.test("UN TOUR DE DUEL NE DIT JAMAIS « TU »", () => {
  //  Il est lu par les DEUX dresseurs. « Tu attaques » y serait vrai
  //  pour l'un et faux pour l'autre, dans le même message, et celui
  //  qui vient de prendre le coup lirait qu'il l'a donné.
  const texte = phrasesDuTour(frappeDeDuel()).join(" ");
  assert(!/\btu\b/i.test(texte), `« tu » dans : ${texte}`);
  assert(!/\bton\b/i.test(texte), `« ton » dans : ${texte}`);
});

Deno.test("ET IL NOMME LES DEUX POKÉMON, SURNOM COMPRIS", () => {
  //  Le Pokémon d'en face a un dresseur qui l'a nommé. L'appeler par
  //  son espèce quand il a un surnom, c'est ignorer le seul mot que ce
  //  joueur a écrit sur lui.
  const texte = phrasesDuTour(frappeDeDuel()).join(" ");
  assertStringIncludes(texte, "Salamèche");
  assertStringIncludes(texte, "Bulle");
});

Deno.test("LA FRAPPE DE L'ADVERSAIRE SE RACONTE DANS L'AUTRE SENS", () => {
  //  Même repère — `pvJoueur` est toujours le côté du défieur — mais
  //  l'attaquant et la cible s'échangent.
  const texte = phrasesDuTour(frappeDeDuel({
    recit: {
      frappes: [
        {
          qui: "adverse",
          capacite: { nom: "Charge" },
          touche: true,
          degats: { points: 7, efficacite: 1, de: 88 },
        },
      ],
    },
  })).join(" ");
  assertStringIncludes(texte, "Bulle (Carapuce) utilise Charge");
  assertStringIncludes(texte, "7 dégâts");
});

Deno.test("LA FIN D'UN DUEL NOMME LE VAINQUEUR", () => {
  //  « Le combat est terminé » tout court laisserait deux joueurs
  //  compter les PV pour savoir qui a gagné.
  const gagne = phrasesDuTour(frappeDeDuel({ fin: "victoire" })).join(" ");
  assertStringIncludes(gagne, "Jake Dalziel remporte le duel");
  const perd = phrasesDuTour(frappeDeDuel({ fin: "defaite" })).join(" ");
  assertStringIncludes(perd, "Erin Kavanagh remporte le duel");
});

Deno.test("TRENTE TOURS SANS VAINQUEUR SE DIT, ET NE S'INVENTE PAS", () => {
  //  `nul` n'existe que dans un duel. Inventer un vainqueur au compte
  //  des PV serait une règle que personne n'a écrite.
  const texte = phrasesDuTour(frappeDeDuel({ fin: "nul" })).join(" ");
  assertStringIncludes(texte, "sans vainqueur");
  assert(!texte.includes("remporte"), "personne ne remporte un nul");
});

Deno.test("LE FORFAIT NOMME CELUI QUI ABANDONNE", () => {
  //  On ne fuit pas un dresseur : on déclare forfait, et le forfait a
  //  un auteur. La fin dit lequel — `defaite` est le défieur.
  const lui = phrasesDuTour(frappeDeDuel({
    demande: "renoncer",
    fin: "defaite",
    recit: { frappes: [] },
  })).join(" ");
  assertStringIncludes(lui, "Jake Dalziel déclare forfait");
  assertStringIncludes(lui, "Erin Kavanagh remporte le duel");

  const elle = phrasesDuTour(frappeDeDuel({
    demande: "renoncer",
    fin: "victoire",
    recit: { frappes: [] },
  })).join(" ");
  assertStringIncludes(elle, "Erin Kavanagh déclare forfait");
});

Deno.test("UN TOUR SAUVAGE CONTINUE DE PARLER AU JOUEUR", () => {
  //  C'est juste pour lui : un seul lecteur, et « ton Salamèche » est
  //  plus chaleureux qu'un nom répété. Le genre absent vaut `sauvage`,
  //  donc rien ne change pour les combats d'avant le 23 novembre.
  const texte = phrasesDuTour(attaque({ fin: "defaite" })).join(" ");
  assertStringIncludes(texte, "Le combat est terminé");
  assert(!texte.includes("remporte le duel"), "pas de duel dans un combat sauvage");
});
