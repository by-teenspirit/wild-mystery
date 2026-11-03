import { assert, assertEquals } from "@std/assert";
import { estLAffichageDUnSujet, mentionDe } from "./module-mention.ts";

//  ════════════════════════════════════════════════════════════════════
//  OÙ LE « @ » A LE DROIT D'EXISTER
//
//  « Le @ tu l'as mis partout sur le forum, moi je le veux que dans
//  l'affichage d'un sujet », 3 novembre. Les adresses ci-dessous sont
//  celles du forum, relevées le même jour : les refuser ou les accepter
//  par erreur, c'est reposer le bouton là où il n'a rien à faire.
//  ════════════════════════════════════════════════════════════════════

Deno.test("un sujet, dans ses trois formes d'adresse", () => {
  assert(estLAffichageDUnSujet("/t1002-compte-de-test-0001"));
  //  La deuxième page d'un sujet long.
  assert(estLAffichageDUnSujet("/t1002p25-compte-de-test-0001"));
  //  Le lien nu, sans titre : il circule dans les anciens messages.
  assert(estLAffichageDUnSujet("/t1002"));
  assert(estLAffichageDUnSujet("/viewtopic.php"));
});

Deno.test("LES PAGES QUI PORTENT DES NOMS DE MEMBRES SANS ÊTRE DES SUJETS", () => {
  //  Celle-ci est le bug : deux « @ » posés sur l'index, à côté des
  //  auteurs de la colonne « dernier message ».
  assertEquals(estLAffichageDUnSujet("/"), false);
  assertEquals(estLAffichageDUnSujet("/forum"), false);
  //  Une liste de sujets : même balisage qu'un sujet par endroits,
  //  c'est pour ça que l'adresse est le seul juge.
  assertEquals(estLAffichageDUnSujet("/f45-cartes-dresseur"), false);
  assertEquals(estLAffichageDUnSujet("/u4"), false);
  assertEquals(estLAffichageDUnSujet("/memberlist"), false);
  assertEquals(estLAffichageDUnSujet("/c2-zones-sauvages"), false);
  //  Le carnet est une page HTML, et son adresse commence par un « h »
  //  suivi d'un nombre : la même forme qu'un sujet à une lettre près.
  assertEquals(estLAffichageDUnSujet("/h15-mon-carnet"), false);
  //  LA PAGE DE RÉPONSE COMPLÈTE. Elle montre les messages du sujet,
  //  donc elle ressemble à un sujet — et ce n'en est pas un.
  assertEquals(estLAffichageDUnSujet("/post"), false);
});

Deno.test("la mention garde la forme que Forumactif relit", () => {
  assertEquals(mentionDe("Arceus"), "@Arceus");
  //  Guillemets droits dès qu'il y a une espace : c'est cette forme-là
  //  qui déclenche la notification.
  assertEquals(mentionDe("Maître du Jeu"), '@"Maître du Jeu"');
  assertEquals(mentionDe("  Noa  "), "@Noa");
  assertEquals(mentionDe("   "), "");
});
