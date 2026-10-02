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
  assertEquals(messages.map((m) => m.id), [12485, 15263]);
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
  assertEquals((await forum.messagesDuSujet(813, 0)).map((m) => m.id), [12485, 15263]);
  assertEquals((await forum.messagesDuSujet(813, 12485)).map((m) => m.id), [15263]);
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
