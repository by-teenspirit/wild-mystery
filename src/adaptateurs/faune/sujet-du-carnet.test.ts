import { assertEquals, assertThrows } from "@std/assert";
import { forumDesCartesDepuis, sujetDepuis } from "./sujet-du-carnet.ts";

Deno.test("un entier positif est lu tel quel", () => {
  assertEquals(sujetDepuis('{"sujet": 512}'), 512);
});

Deno.test("null veut dire « pas encore de sujet », et ce n'est pas une faute", () => {
  //  La tâche ne lit rien et le note. Lever ici ferait échouer toute
  //  la relève pour un sujet que personne n'a encore créé.
  assertEquals(sujetDepuis('{"sujet": null}'), null);
  assertEquals(sujetDepuis("{}"), null);
});

Deno.test("une valeur qui n'est ni un entier positif ni null est refusée", () => {
  //  Celle-là, en revanche, est une faute de frappe qu'il vaut mieux
  //  voir tout de suite : « 512 » entre guillemets, ou un zéro.
  assertThrows(() => sujetDepuis('{"sujet": "512"}'), Error, "entier positif");
  assertThrows(() => sujetDepuis('{"sujet": 0}'), Error, "entier positif");
  assertThrows(() => sujetDepuis('{"sujet": 1.5}'), Error, "entier positif");
  assertThrows(() => sujetDepuis("pas du json"), Error, "illisible");
});

Deno.test("le forum des cartes se lit dans le même fichier", () => {
  assertEquals(forumDesCartesDepuis('{"sujet": 1002, "forumDesCartes": 45}'), 45);
  assertEquals(forumDesCartesDepuis('{"sujet": 1002}'), null);
  assertThrows(() => forumDesCartesDepuis('{"forumDesCartes": "45"}'), Error, "entier positif");
});

Deno.test("LES DEUX RÉGLAGES SONT INDÉPENDANTS", () => {
  //  L'un peut être configuré sans l'autre, et c'est l'état normal
  //  d'une mise en place en deux temps. Lire l'un ne doit pas faire
  //  échouer l'autre.
  assertEquals(sujetDepuis('{"forumDesCartes": 45}'), null);
  assertEquals(forumDesCartesDepuis('{"sujet": 1002}'), null);
});
