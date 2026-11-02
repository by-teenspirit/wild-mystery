import { assertEquals, assertThrows } from "@std/assert";
import { sujetDepuis } from "./sujet-du-carnet.ts";

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
