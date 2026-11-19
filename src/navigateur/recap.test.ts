// ════════════════════════════════════════════════════════════════════
//  src/navigateur/recap.test.ts
//
//  Ce que ces essais protègent.
//
//  **Qu'un bloc vide ne se dessine pas.** Un récapitulatif collé au
//  bord de l'écran prend de la place en permanence : trois cadres
//  vides sur un sujet neuf seraient une gêne, pas une information.
//
//  **Que la jauge reste dans son cadre.** Une barre à 140 % sortirait
//  du panneau et on chercherait le défaut dans le CSS.
//
//  **Que les seuils soient ceux des jeux.** Un joueur qui a joué à un
//  Pokémon les lit sans les apprendre ; les déplacer d'un point, c'est
//  lui mentir sur l'état de son équipe.
// ════════════════════════════════════════════════════════════════════

import { assertEquals } from "@std/assert";
import {
  blocsDuRecap,
  etatDePv,
  etatDuRecap,
  type MembreDuRecap,
  type MonSujet,
  nomDuMembre,
  partDePv,
  placementDuRecap,
  sacDuRecap,
} from "./recap.ts";
import type { LigneEnAttente } from "../application/bilan.ts";

function membre(dessus: Partial<MembreDuRecap> = {}): MembreDuRecap {
  return {
    position: 1,
    especeId: 4,
    nom: "Salamèche",
    surnom: null,
    niveau: 5,
    pv: 18,
    pvMax: 18,
    combat: false,
    ...dessus,
  };
}

const SUJET: MonSujet = {
  equipe: [membre()],
  combat: {
    tour: 2,
    sauvage: {
      especeId: 77,
      nom: "Ponyta",
      niveau: 10,
      types: ["feu"],
      pv: 18,
      pvMax: 30,
    },
    pvPokemon: 11,
    pvPokemonMax: 18,
  },
};

const GAINS: LigneEnAttente = {
  pseudo: "Jake Dalziel",
  captures: [{ nom: "Roucool", especeId: 16, niveau: 7 }],
  croisees: [],
  experience: [],
  ajoutes: [],
  consommes: [],
  pokedollars: 0,
};

// ── le nom ──────────────────────────────────────────────────────────

Deno.test("le surnom ne fait pas disparaître l'espèce", () => {
  //  La même règle que les messages du Maître du Jeu : un joueur ne
  //  doit pas lire deux noms pour un même Pokémon selon l'endroit où
  //  il regarde.
  assertEquals(nomDuMembre(membre({ surnom: "Biscotte" })), "Biscotte (Salamèche)");
  assertEquals(nomDuMembre(membre({ surnom: null })), "Salamèche");
  assertEquals(nomDuMembre(membre({ surnom: "   " })), "Salamèche");
});

// ── la jauge ────────────────────────────────────────────────────────

Deno.test("la part de PV va de 0 à 100, et pas au-delà", () => {
  assertEquals(partDePv(18, 18), 100);
  assertEquals(partDePv(9, 18), 50);
  assertEquals(partDePv(0, 18), 0);
  //  LES DEUX BORNES COMPTENT : une barre à 140 % sortirait du
  //  panneau, une barre négative disparaîtrait sans qu'on sache
  //  pourquoi.
  assertEquals(partDePv(25, 18), 100);
  assertEquals(partDePv(-3, 18), 0);
});

Deno.test("UN MAXIMUM ABSURDE NE FAIT PAS TOMBER LA PAGE", () => {
  //  Ces valeurs ne devraient pas exister. Si elles arrivent, la
  //  jauge doit rendre zéro — pas `NaN`, qui donnerait
  //  `width: NaN%` et une barre pleine chez certains navigateurs.
  assertEquals(partDePv(5, 0), 0);
  assertEquals(partDePv(5, -1), 0);
  assertEquals(partDePv(Number.NaN, 18), 0);
  assertEquals(partDePv(5, Number.POSITIVE_INFINITY), 0);
});

Deno.test("LES SEUILS SONT CEUX DES JEUX", () => {
  //  Vert jusqu'à la moitié, orange jusqu'au cinquième, rouge en
  //  dessous. On vérifie les BORDS, pas le milieu : c'est là qu'un
  //  déplacement d'un point se voit.
  assertEquals(etatDePv(18, 18), "bien");
  assertEquals(etatDePv(10, 18), "bien");
  assertEquals(etatDePv(9, 18), "entame");
  assertEquals(etatDePv(4, 18), "entame");
  assertEquals(etatDePv(3, 18), "critique");
  assertEquals(etatDePv(1, 18), "critique");
});

Deno.test("ZÉRO PV N'EST PAS « PRESQUE MORT »", () => {
  //  C'est une case qui ne peut plus se battre, et la différence
  //  décide d'un tour : on change de Pokémon ou on utilise un Rappel.
  assertEquals(etatDePv(0, 18), "terre");
  assertEquals(etatDePv(-2, 18), "terre");
});

// ── les blocs ───────────────────────────────────────────────────────

Deno.test("les blocs sortent dans l'ordre de l'urgence", () => {
  //  Le combat attend une réponse, l'équipe et le sac la décident, les
  //  gains se regardent quand il n'y a rien à décider.
  assertEquals(
    blocsDuRecap(SUJET, GAINS).map((b) => b.quoi),
    ["combat", "equipe", "gains"],
  );
  assertEquals(
    blocsDuRecap({ ...SUJET, sac: SAC }, GAINS).map((b) => b.quoi),
    ["combat", "equipe", "sac", "gains"],
  );
});

// ── le sac ──────────────────────────────────────────────────────────
//
//  « Afficher le sac de la personne pour savoir ce qu'elle a, à
//  l'instant T » — 18 novembre.

const SAC = [
  { objetId: 3, nom: "Potion", famille: "soin", quantite: 3 },
  { objetId: 1, nom: "Poké Ball", famille: "ball", quantite: 4 },
  { objetId: 9, nom: "Pierre Feu", famille: "evolution", quantite: 1 },
];

Deno.test("LE SAC SE RANGE PAR ÉTAGÈRE, DANS L'ORDRE DU CARNET", () => {
  //  Les balls d'abord, les cailloux ensuite : c'est l'ordre de
  //  `FAMILLES_DU_SAC`, et un joueur ne doit pas lire deux rangements
  //  pour le même sac.
  const sections = sacDuRecap(SAC);
  assertEquals(sections.map((s) => s.titre), [
    "Pour attraper",
    "Pour soigner",
    "Les cailloux étranges",
  ]);
  assertEquals(sections[0].lignes.map((l) => l.nom), ["Poké Ball"]);
});

Deno.test("UNE FAMILLE INCONNUE N'EST PAS JETÉE", () => {
  //  Un objet qu'on possède et qui ne s'affiche nulle part est pire
  //  qu'un titre approximatif : on le chercherait dans le carnet, où
  //  il serait.
  const sections = sacDuRecap([
    { objetId: 77, nom: "Chose", famille: "machin", quantite: 2 },
  ]);
  assertEquals(sections.map((s) => s.titre), ["Le reste"]);
});

Deno.test("UNE QUANTITÉ NULLE N'EST PAS UNE LIGNE", () => {
  //  La base filtre déjà `quantite > 0`, mais une ligne à zéro qui
  //  passerait afficherait « × 0 » — un objet qu'on n'a pas.
  assertEquals(
    sacDuRecap([{ objetId: 1, nom: "Poké Ball", famille: "ball", quantite: 0 }]),
    [],
  );
});

Deno.test("UN SAC ABSENT N'EST PAS UNE PANNE", () => {
  //  La migration qui ajoute le sac peut ne pas être déployée quand ce
  //  code l'est. Le panneau doit alors montrer l'équipe et le combat,
  //  pas disparaître.
  assertEquals(
    blocsDuRecap(SUJET, null).map((b) => b.quoi),
    ["combat", "equipe"],
  );
  assertEquals(
    blocsDuRecap({ ...SUJET, sac: [] }, null).map((b) => b.quoi),
    ["combat", "equipe"],
  );
});

Deno.test("UN BLOC VIDE NE SE DESSINE PAS", () => {
  //  Le récapitulatif est collé au bord de l'écran en permanence :
  //  trois cadres vides sur un sujet neuf seraient une gêne.
  assertEquals(
    blocsDuRecap({ equipe: SUJET.equipe, combat: null }, null).map((b) => b.quoi),
    ["equipe"],
  );
  assertEquals(
    blocsDuRecap({ equipe: [], combat: null }, GAINS).map((b) => b.quoi),
    ["gains"],
  );
});

Deno.test("UN SUJET LU, MAIS RIEN DEDANS : pas de panneau", () => {
  //  Lecture RÉUSSIE et rien à montrer — équipe vide, pas de combat,
  //  aucun gain en attente. Là, un cadre vide collé au bord de
  //  l'écran serait une gêne : on ne pose rien.
  assertEquals(blocsDuRecap({ equipe: [], combat: null }, null), []);
});

Deno.test("UNE LECTURE QUI ÉCHOUE SE DIT — elle ne disparaît pas", () => {
  //  « Je ne vois toujours pas le récap » — trois fois en deux jours.
  //  Il était là ; `mon_sujet` ne rendait rien, et le panneau se
  //  retirait sans un mot. `null` ne veut pas dire « rien à montrer »,
  //  ça veut dire « on n'a pas pu lire ».
  assertEquals(blocsDuRecap(null, null).map((b) => b.quoi), ["carnet"]);
});

Deno.test("et le bloc du carnet passe avant tout le reste", () => {
  //  Même sans sujet, une ligne de bilan peut exister — elle vient du
  //  registre, qui est public. Le blocage reste la première chose à
  //  dire : les gains seuls, sans équipe ni combat, laisseraient
  //  croire que le panneau fonctionne.
  assertEquals(blocsDuRecap(null, GAINS).map((b) => b.quoi), ["carnet"]);
});

Deno.test("une ligne de bilan sans rubrique ne fait pas un bloc", () => {
  //  « Rien à verser » a sa place dans le bilan posté, qui nomme tout
  //  le monde. Ici, un bloc qui dirait « rien » prendrait la place
  //  d'un bloc qui dit quelque chose.
  const vide: LigneEnAttente = { ...GAINS, captures: [] };
  assertEquals(blocsDuRecap({ equipe: [], combat: null }, vide), []);
});

// ── le placement ────────────────────────────────────────────────────

Deno.test("IL SE POSE À 16 PX DES MESSAGES, OÙ QU'ILS FINISSENT", () => {
  //  « Pas besoin de mesurer l'écran, tu l'accroches à ça. » Le même
  //  panneau, la même fenêtre, deux largeurs de messages : seul le
  //  bord des messages décide.
  assertEquals(placementDuRecap({ droite: 1560 }, 1920, 216, 16).gauche, 1576);
  assertEquals(placementDuRecap({ droite: 1180 }, 1920, 216, 16).gauche, 1196);
});

Deno.test("SUR UN GRAND ÉCRAN, IL NE S'ÉLOIGNE PAS DES MESSAGES", () => {
  //  C'est le défaut qu'on corrige : collé au bord, il partait à
  //  2 328 sur un 2 560 et laissait 448 px de vide entre les messages
  //  et lui.
  const p = placementDuRecap({ droite: 1880 }, 2560, 216, 16);
  assertEquals(p.pose, true);
  assertEquals(p.gauche, 1896);
});

Deno.test("SANS LA PLACE, IL NE SE POSE PAS", () => {
  //  Un portable de 1 440 avec un forum de 1 200 : les messages
  //  finissent à 1 320, il reste 120 px. Le panneau en demande 216,
  //  plus l'écart des deux côtés.
  assertEquals(placementDuRecap({ droite: 1320 }, 1440, 216, 16).pose, false);
  //  LE BORD COMPTE : il faut l'écart aussi entre le panneau et le
  //  bord de la fenêtre. 1 320 + 16 + 216 = 1 552, donc 1 552 ne
  //  suffit pas et 1 568 suffit tout juste.
  assertEquals(placementDuRecap({ droite: 1320 }, 1552, 216, 16).pose, false);
  assertEquals(placementDuRecap({ droite: 1320 }, 1568, 216, 16).pose, true);
});

Deno.test("SANS ANCRE, RIEN — et surtout pas un panneau à zéro", () => {
  //  Une page sans message : le panneau n'a rien à longer. Posé quand
  //  même, il se serait collé à gauche, par-dessus le texte.
  assertEquals(placementDuRecap(null, 1920, 216, 16).pose, false);
  assertEquals(placementDuRecap({ droite: Number.NaN }, 1920, 216, 16).pose, false);
  assertEquals(placementDuRecap({ droite: 1560 }, Number.NaN, 216, 16).pose, false);
});

Deno.test("l'équipe passe entière, avec celui qui se bat marqué", () => {
  const equipe = [membre({ position: 1 }), membre({ position: 2, combat: true })];
  const blocs = blocsDuRecap({ equipe, combat: null }, null);
  assertEquals(blocs.length, 1);
  const bloc = blocs[0];
  assertEquals(bloc.quoi, "equipe");
  if (bloc.quoi !== "equipe") return;
  assertEquals(bloc.equipe.map((m) => m.combat), [false, true]);
});

// ── le tiroir ───────────────────────────────────────────────────────

Deno.test("AVEC LA PLACE, IL EST OUVERT ET COLLÉ AUX MESSAGES", () => {
  const e = etatDuRecap({ droite: 1560 }, 1920, 216, 16, null);
  assertEquals(e, { contre: "messages", gauche: 1576, ouvert: true });
});

Deno.test("SANS LA PLACE, IL SE REPLIE CONTRE LE BORD", () => {
  //  Le cas de Callista : forum de 1 200 px sur un portable de 1 440.
  //  Avant, il ne se posait pas du tout, et rien ne le disait.
  const e = etatDuRecap({ droite: 1320 }, 1440, 216, 16, null);
  assertEquals(e.contre, "bord");
  assertEquals(e.ouvert, false);
});

Deno.test("LE CHOIX DE LA PERSONNE PASSE AVANT LA MESURE", () => {
  //  Repliée sur un grand écran, la languette doit rester repliée au
  //  rechargement ; dépliée sur un portable, rester dépliée. Sinon on
  //  se bat contre la page à chaque visite.
  assertEquals(etatDuRecap({ droite: 1560 }, 1920, 216, 16, false).ouvert, false);
  assertEquals(etatDuRecap({ droite: 1320 }, 1440, 216, 16, true).ouvert, true);
});

Deno.test("MÊME DÉPLIÉ DE FORCE, IL SAIT CONTRE QUOI IL EST", () => {
  //  L'état d'ouverture et le point d'accroche sont deux choses : sur
  //  un portable, déplié, il doit quand même se coller au BORD —
  //  sinon il se poserait à 1 336 px dans une fenêtre de 1 440 et
  //  dépasserait de l'écran.
  const e = etatDuRecap({ droite: 1320 }, 1440, 216, 16, true);
  assertEquals(e.contre, "bord");
  assertEquals(e.ouvert, true);
});
