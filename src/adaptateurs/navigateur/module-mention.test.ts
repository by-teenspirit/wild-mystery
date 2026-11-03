import { assert, assertEquals } from "@std/assert";
import { estUnePageDeMention, mentionDe } from "./module-mention.ts";

//  ════════════════════════════════════════════════════════════════════
//  OÙ LE « @ » A LE DROIT D'EXISTER
//
//  « Le @ tu l'as mis partout sur le forum, moi je le veux que dans
//  l'affichage d'un sujet », 3 novembre. Les adresses ci-dessous sont
//  celles du forum, relevées le même jour : les refuser ou les accepter
//  par erreur, c'est reposer le bouton là où il n'a rien à faire.
//  ════════════════════════════════════════════════════════════════════

Deno.test("un sujet, dans ses trois formes d'adresse", () => {
  assert(estUnePageDeMention("/t1002-compte-de-test-0001"));
  //  La deuxième page d'un sujet long.
  assert(estUnePageDeMention("/t1002p25-compte-de-test-0001"));
  //  Le lien nu, sans titre : il circule dans les anciens messages.
  assert(estUnePageDeMention("/t1002"));
  assert(estUnePageDeMention("/viewtopic.php"));
});

Deno.test("ET LA PAGE DE RÉPONSE COMPLÈTE, parce qu'elle montre le message cité", () => {
  //  Rouverte le 3 novembre : relevé sur le forum, `/post` porte
  //  l'éditeur, le bouton « Mentionner un membre » et le message auquel
  //  on répond dans un `.post`. L'auteur cité y reçoit donc son « @ ».
  assert(estUnePageDeMention("/post"));
});

Deno.test("LES PAGES QUI PORTENT DES NOMS DE MEMBRES SANS ÊTRE DES SUJETS", () => {
  //  Celle-ci est le bug : deux « @ » posés sur l'index, à côté des
  //  auteurs de la colonne « dernier message ».
  assertEquals(estUnePageDeMention("/"), false);
  assertEquals(estUnePageDeMention("/forum"), false);
  //  Une liste de sujets : même balisage qu'un sujet par endroits,
  //  c'est pour ça que l'adresse est le seul juge.
  assertEquals(estUnePageDeMention("/f45-cartes-dresseur"), false);
  assertEquals(estUnePageDeMention("/u4"), false);
  assertEquals(estUnePageDeMention("/memberlist"), false);
  assertEquals(estUnePageDeMention("/c2-zones-sauvages"), false);
  //  Le carnet est une page HTML, et son adresse commence par un « h »
  //  suivi d'un nombre : la même forme qu'un sujet à une lettre près.
  assertEquals(estUnePageDeMention("/h15-mon-carnet"), false);
});

Deno.test("la mention garde la forme que Forumactif relit", () => {
  assertEquals(mentionDe("Arceus"), "@Arceus");
  //  Guillemets droits dès qu'il y a une espace : c'est cette forme-là
  //  qui déclenche la notification.
  assertEquals(mentionDe("Maître du Jeu"), '@"Maître du Jeu"');
  assertEquals(mentionDe("  Noa  "), "@Noa");
  assertEquals(mentionDe("   "), "");
});
