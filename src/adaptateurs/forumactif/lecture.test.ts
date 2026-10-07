// ════════════════════════════════════════════════════════════════════
//  src/adaptateurs/forumactif/lecture.test.ts
//
//  Les tests tournent sur une page ENREGISTRÉE SUR LE VRAI FORUM, pas
//  sur un gabarit écrit pour l'occasion. C'est la seule façon de savoir
//  que le parseur tient : on ne peut pas se tromper en sa faveur quand
//  l'entrée vient d'ailleurs.
//
//  fixtures/sujet-813.html : relevé le 2 octobre 2026 sur
//  /t813-petites-annonces, en visiteur non connecté.
// ════════════════════════════════════════════════════════════════════

import { assert, assertEquals, assertThrows } from "@std/assert";
import {
  decoder,
  ForumactifEnLecture,
  lireLesMessages,
  lireLesSujetsRemues,
  PageIllisible,
} from "./lecture.ts";

const PAGE = await Deno.readTextFile(
  new URL("./fixtures/sujet-813.html", import.meta.url),
);

Deno.test("lit les messages du sujet et laisse la publicité dehors", () => {
  const messages = lireLesMessages(PAGE, 813);
  // 15543 vient du relevé du 2 octobre sur /t975-test, ajouté à la même
  // fixture : un compte sans couleur de groupe.
  assertEquals(messages.map((m) => m.id), [12485, 15263, 15543]);
});

Deno.test("le bloc « Contenu sponsorisé » n'est pas un message", () => {
  // id p0, data-id -2 : c'est une régie publicitaire glissée au milieu
  // du sujet. L'inscrire au registre serait absurde.
  assert(PAGE.includes('data-id="-2"'), "la fixture doit bien contenir le piège");
  assertEquals(lireLesMessages(PAGE, 813).some((m) => m.id === 0), false);
});

Deno.test("l'auteur vient de l'avatar, pas d'un lien", () => {
  const [premier, second] = lireLesMessages(PAGE, 813);
  assertEquals(premier.auteurId, 3);
  assertEquals(premier.auteurPseudo, "Maître du Jeu");
  assertEquals(second.auteurId, 1);
  assertEquals(second.auteurPseudo, "Arceus");
});

Deno.test("le groupe du membre est lisible sur chaque message", () => {
  // C'est le mur de `_userdata` qui tombe : le groupe n'est pas exposé
  // au navigateur, mais il est écrit dans la page que le serveur lit.
  const [premier, second] = lireLesMessages(PAGE, 813);
  assertEquals(premier.groupeId, 2);
  assertEquals(second.groupeId, 5);
});

Deno.test("le sujet demandé est reporté sur chaque message", () => {
  for (const m of lireLesMessages(PAGE, 813)) assertEquals(m.sujetId, 813);
});

Deno.test("les marqueurs sont relevés, et seulement les nôtres", () => {
  const [sans, avec] = lireLesMessages(PAGE, 813);
  assertEquals(sans.marqueurs, []);
  assertEquals(avec.marqueurs.length, 2);
  assertEquals(avec.marqueurs[0].code, "WM-ACDE-FGH");
  assertEquals(avec.marqueurs[1].code, "WM-RTUV-WXY");
});

Deno.test("une page qui n'est pas un sujet lève au lieu de rendre une liste vide", () => {
  // Une liste vide serait une panne silencieuse : le registre se
  // viderait sans que personne ne s'en aperçoive.
  assertThrows(
    () => lireLesMessages("<html><body>maintenance</body></html>", 813),
    PageIllisible,
  );
  assertThrows(() => lireLesMessages("", 813), PageIllisible);
});

Deno.test("une page qui n'a que de la publicité lève aussi", () => {
  const seulementPub = PAGE.slice(
    PAGE.indexOf('<div id="p0"'),
    PAGE.indexOf('<div id="p15263"'),
  );
  assertThrows(() => lireLesMessages(seulementPub, 813), PageIllisible);
});

Deno.test("decoder · rend les accents que Forumactif encode", () => {
  assertEquals(decoder("Ma&icirc;tre du Jeu"), "Maître du Jeu");
  assertEquals(decoder("EST ARRIV&Eacute; LE"), "EST ARRIVÉ LE");
  assertEquals(decoder("&amp;&lt;&gt;&quot;&#39;"), "&<>\"'");
  assertEquals(decoder("&#233;t&eacute;"), "été");
  assertEquals(decoder("rien à décoder"), "rien à décoder");
  assertEquals(decoder("&inconnue;"), "&inconnue;");
});

Deno.test("lireLesSujetsRemues · garde le plus grand identifiant par sujet", () => {
  const liste = `
    <a href="/t813-petites-annonces">Petites Annonces</a>
    <a href="/t813-petites-annonces#15263">dernier</a>
    <a href="/t916-joyeux-anniversaire#14676">dernier</a>
    <a href="/t906-mise-a-jour#0">pas de message</a>`;
  assertEquals(lireLesSujetsRemues(liste), [
    { sujetId: 813, dernierMessageId: 15263 },
    { sujetId: 916, dernierMessageId: 14676 },
  ]);
});

Deno.test("l'adaptateur ne garde que ce qui est arrivé après le dernier vu", async () => {
  const forum = new ForumactifEnLecture((_chemin: string) => Promise.resolve(PAGE));
  assertEquals((await forum.messagesDuSujet(813, 0)).map((m) => m.id), [12485, 15263, 15543]);
  assertEquals((await forum.messagesDuSujet(813, 12485)).map((m) => m.id), [15263, 15543]);
  assertEquals(await forum.messagesDuSujet(813, 99999), []);
});

Deno.test("l'adaptateur demande bien la page du sujet", async () => {
  const demandes: string[] = [];
  const forum = new ForumactifEnLecture((chemin: string) => {
    demandes.push(chemin);
    return Promise.resolve(PAGE);
  });
  await forum.messagesDuSujet(813, 0);
  assertEquals(demandes, ["/t813-"]);
});

// ── la forme relevée le 2 octobre sur /t975-test ────────────────────

Deno.test("un pseudo SANS <strong> est lu quand même", async () => {
  // Forumactif sert deux formes selon que le membre a une couleur de
  // groupe ou non. La seconde faisait lever PageIllisible, et la relève
  // s'arrêtait sur tout le sujet.
  const html = await Deno.readTextFile(
    new URL("./fixtures/sujet-813.html", import.meta.url),
  );
  const messages = lireLesMessages(html, 975);
  const sansGroupe = messages.find((m) => m.id === 15543);
  assert(sansGroupe !== undefined, "le message sans groupe doit être lu");
  assertEquals(sansGroupe.auteurPseudo, "Compte de test");
  assertEquals(sansGroupe.auteurId, 4);
  assertEquals(sansGroupe.groupeId, null, "pas de post-group-N : null, pas une erreur");
});

Deno.test("les deux formes de pseudo cohabitent dans la même page", () => {
  const avec =
    `<div id="p1" class="post row1 post--1 post-group-2"><div class="postprofile-avatar" data-id="3"></div><div class="postprofile-name"><span class="group-2"><strong>Ma&icirc;tre du Jeu</strong></span></div></div>`;
  const sans =
    `<div id="p2" class="post row2 post--2 "><div class="postprofile-avatar" data-id="4"></div><div class="postprofile-name">Compte de test</div></div>`;
  const lus = lireLesMessages(avec + sans, 975);
  assertEquals(lus.map((m) => m.auteurPseudo), ["Maître du Jeu", "Compte de test"]);
});

Deno.test("un bloc de pseudo vide lève plutôt que de rendre un pseudo vide", () => {
  const html =
    `<div id="p1" class="post row1 post--1 "><div class="postprofile-avatar" data-id="4"></div><div class="postprofile-name">  </div></div>`;
  assertThrows(() => lireLesMessages(html, 975), PageIllisible);
});

// ── les actions, tâche 1 de la relève ───────────────────────────────

Deno.test("l'adaptateur rend les actions rattachées à leur sujet", async () => {
  //  La page enregistrée ne contient aucun bloc d'action — elle date
  //  d'avant les boutons. On en pose un dans une copie plutôt que de
  //  réenregistrer la page : ce qu'on teste ici, c'est le branchement
  //  entre `lireLesMessages` et `actionsDemandees`, pas la lecture du
  //  HTML, qui a ses propres tests juste au-dessus.
  const avecAction = PAGE.replace(
    /(<div id="p15543"[\s\S]{0,4000}?<div class="content">)/,
    "$1[[WM-ACTION:fouiller]]",
  );

  const forum = new ForumactifEnLecture((_c: string) => Promise.resolve(avecAction));
  const actions = await forum.actionsDuSujet(813, 0);

  assertEquals(actions.length, 1);
  assertEquals(actions[0].sujetId, 813);
  assertEquals(actions[0].messageId, 15543);
  assertEquals(actions[0].action, { type: "fouiller" });
  assertEquals(actions[0].auteurPseudo, "Compte de test");
});

Deno.test("le curseur s'applique aussi aux actions", async () => {
  const avecAction = PAGE.replace(
    /(<div id="p15543"[\s\S]{0,4000}?<div class="content">)/,
    "$1[[WM-ACTION:fouiller]]",
  );
  const forum = new ForumactifEnLecture((_c: string) => Promise.resolve(avecAction));
  assertEquals((await forum.actionsDuSujet(813, 15543)).length, 0);
});

Deno.test("un sujet sans aucun bloc ne rend aucune action", async () => {
  const forum = new ForumactifEnLecture((_c: string) => Promise.resolve(PAGE));
  assertEquals(await forum.actionsDuSujet(813, 0), []);
});
