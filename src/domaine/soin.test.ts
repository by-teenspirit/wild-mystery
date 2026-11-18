import { assertEquals, assertThrows } from "@std/assert";
import { estUnSoin, soigner, SoinInvalide, SOINS } from "./soin.ts";

Deno.test("les quatre potions du catalogue sont connues", () => {
  //  `data/objets.json`, famille « soin ». Une de plus au catalogue
  //  sans une de plus ici ferait lever en pleine utilisation.
  for (const slug of ["potion", "super-potion", "hyper-potion", "max-potion"]) {
    assertEquals(estUnSoin(slug), true, slug);
  }
  assertEquals(Object.keys(SOINS).length, 4);
});

Deno.test("une Potion remet à neuf un Pokémon de début", () => {
  //  18 PV au niveau 5 : les 20 d'une Potion suffisent. C'est voulu —
  //  300 PD sur une bourse de départ de 1 000, et un débutant qui s'en
  //  sort continue de jouer.
  assertEquals(soigner("potion", 4, 18), { pv: 18, rendus: 14 });
});

Deno.test("et ne rend qu'un dixième d'un Drattak", () => {
  //  213 PV au niveau 70 : c'est là que la Potion Max justifie ses
  //  2 500 PD. Les chiffres des jeux font le travail tout seuls.
  assertEquals(soigner("potion", 100, 213), { pv: 120, rendus: 20 });
  assertEquals(soigner("max-potion", 100, 213), { pv: 213, rendus: 113 });
});

Deno.test("ON NE REND QUE CE QUI MANQUE, et on le dit", () => {
  //  Une Potion de 20 sur un Pokémon à 14/18 rend 4. Le message du
  //  Maître du Jeu doit dire 4 — pas 20, sinon le joueur croit qu'on
  //  lui en a volé seize.
  assertEquals(soigner("potion", 14, 18), { pv: 18, rendus: 4 });
  assertEquals(soigner("hyper-potion", 17, 18), { pv: 18, rendus: 1 });
});

Deno.test("les montants montent avec les prix", () => {
  //  300, 700, 1 200, 2 500 au catalogue : les soins doivent suivre,
  //  sinon le catalogue mentirait.
  const sur = (slug: string) => soigner(slug, 1, 500).rendus;
  assertEquals(sur("potion") < sur("super-potion"), true);
  assertEquals(sur("super-potion") < sur("hyper-potion"), true);
  assertEquals(sur("hyper-potion") < sur("max-potion"), true);
});

Deno.test("ON NE SOIGNE PAS UN POKÉMON À TERRE", () => {
  //  Zéro PV n'est pas « très blessé », c'est hors combat. Sans ce
  //  refus, le joueur dépense une Potion pour rien et ne comprend pas
  //  pourquoi il a toujours perdu.
  assertThrows(() => soigner("potion", 0, 18), SoinInvalide, "Rappel");
});

Deno.test("un objet inconnu lève, il ne rend pas zéro", () => {
  //  Rendre zéro ferait qu'une Hyper Potion mal nommée se consommerait
  //  sans rien soigner, à 1 200 PD.
  assertThrows(() => soigner("eau-fraiche", 5, 18), SoinInvalide, "inconnu");
  assertEquals(estUnSoin("eau-fraiche"), false);
});

Deno.test("un état impossible lève", () => {
  assertThrows(() => soigner("potion", 19, 18), SoinInvalide);
  assertThrows(() => soigner("potion", -1, 18), SoinInvalide);
  assertThrows(() => soigner("potion", 5, 0), SoinInvalide);
});
