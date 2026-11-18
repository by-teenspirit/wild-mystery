// ════════════════════════════════════════════════════════════════════
//  src/navigateur/reveil.test.ts
//
//  Ce que ces essais protègent.
//
//  **Qu'on ne sonne pas pour rien.** La relève tourne déjà toutes les
//  cinq minutes ; un réveil à chaque ouverture de sujet la ferait
//  tourner des centaines de fois par jour sans rien à faire.
//
//  **Qu'on sonne quand il le faut.** C'est tout l'objet du 18
//  novembre : « la personne ne va pas attendre cinq minutes ».
// ════════════════════════════════════════════════════════════════════

import { assert, assertEquals } from "@std/assert";
import { faut_il_sonner, instantsDuGuet, TROP_VIEUX } from "./reveil.ts";

Deno.test("ON SONNE QUAND MA DERNIÈRE ACTION ATTEND SA RÉPONSE", () => {
  assert(faut_il_sonner({ derniereActionEstLaMienne: true, ageDuMessage: 3 }));
  assert(faut_il_sonner({ derniereActionEstLaMienne: true, ageDuMessage: 0 }));
});

Deno.test("ON NE SONNE PAS QUAND LE MAÎTRE DU JEU A DÉJÀ RÉPONDU", () => {
  //  Sa réponse est le dernier message : il n'y a plus rien à
  //  attendre, et sonner relancerait un passage pour rien.
  assertEquals(
    faut_il_sonner({ derniereActionEstLaMienne: false, ageDuMessage: 3 }),
    false,
  );
});

Deno.test("ON NE SONNE PAS POUR UN SUJET QU'ON RELIT", () => {
  //  Une action vieille de deux heures a déjà eu ses cinq minutes. Si
  //  rien n'a été posté, c'est qu'il n'y avait rien à poster — la
  //  relancer ne changerait rien et ferait tourner la fonction à
  //  chaque ouverture de page.
  assertEquals(
    faut_il_sonner({ derniereActionEstLaMienne: true, ageDuMessage: TROP_VIEUX + 1 }),
    false,
  );
  assert(faut_il_sonner({ derniereActionEstLaMienne: true, ageDuMessage: TROP_VIEUX }));
});

Deno.test("UNE DATE ABSURDE NE FAIT PAS SONNER", () => {
  //  Un message daté du futur veut dire qu'on a mal lu l'horloge du
  //  forum ; dans le doute on ne réveille pas.
  assertEquals(
    faut_il_sonner({ derniereActionEstLaMienne: true, ageDuMessage: -30 }),
    false,
  );
});

Deno.test("SANS DATE, ON SONNE QUAND MÊME", () => {
  //  Ne pas savoir dater est le cas d'un gabarit qu'on n'a pas prévu.
  //  Refuser alors de sonner rendrait la chose muette sans que
  //  personne comprenne pourquoi ; un réveil de trop ne coûte qu'un
  //  passage à vide.
  assert(faut_il_sonner({ derniereActionEstLaMienne: true, ageDuMessage: null }));
});

Deno.test("LE GUET REGARDE CHAQUE SECONDE AU DÉBUT, PUIS S'ESPACE", () => {
  const i = instantsDuGuet();
  //  LE PREMIER REGARD EST À UNE SECONDE, et c'est tout l'objet du
  //  changement du 18 novembre : « c'est encore un peu lent avant
  //  d'avoir une réaction ». Un passage répond en deux à quatre
  //  secondes ; le voir à quatre quand il a fini à deux, c'est
  //  attendre deux fois le travail.
  assertEquals(i[0], 1);
  assertEquals(i.slice(0, 6), [1, 2, 3, 4, 5, 6]);
  //  PUIS ÇA S'ESPACE, parce qu'au-delà il ne reste qu'à patienter.
  assertEquals(i.slice(6, 13), [8, 10, 12, 14, 16, 18, 20]);
  assertEquals(i.slice(13), [24, 28, 32, 36, 40]);
  assertEquals(i.at(-1), 40);
  //  STRICTEMENT CROISSANT : un pas qui repasserait en arrière ferait
  //  deux requêtes au même instant.
  assert(i.every((t, n) => n === 0 || t > i[n - 1]));
});

Deno.test("ON NE PAIE PRESQUE RIEN POUR CES DIX SECONDES DE PLUS", () => {
  //  L'ANCIEN RYTHME : quinze regards sur trente secondes. Le neuf en
  //  fait dix-huit sur quarante. Si un jour quelqu'un ajoute un palier
  //  serré « pour aller plus vite », cette ligne dira ce qu'il coûte —
  //  chaque regard redemande la page du sujet au forum.
  assert(instantsDuGuet().length <= 20, `${instantsDuGuet().length} regards`);
});

Deno.test("UN PALIER ABSURDE NE BOUCLE PAS À L'INFINI", () => {
  //  Un pas à zéro ou négatif ferait une boucle sans fin dans la page
  //  du joueur — le genre de défaut qui fige un onglet.
  assertEquals(instantsDuGuet([{ jusqua: 30, pas: 0 }]), []);
  assertEquals(instantsDuGuet([{ jusqua: 30, pas: -1 }]), []);
  assertEquals(instantsDuGuet([{ jusqua: 0, pas: 2 }]), []);
  assertEquals(instantsDuGuet([{ jusqua: Number.NaN, pas: 2 }]), []);
  assertEquals(instantsDuGuet([]), []);
  //  ET UN PALIER ABÎMÉ AU MILIEU NE MANGE PAS LES AUTRES.
  assertEquals(
    instantsDuGuet([{ jusqua: 3, pas: 1 }, { jusqua: 9, pas: 0 }, { jusqua: 9, pas: 3 }]),
    [1, 2, 3, 6, 9],
  );
});

Deno.test("LES PALIERS SE SUIVENT, ILS NE REPARTENT PAS DE ZÉRO", () => {
  //  Chaque palier reprend là où le précédent s'est arrêté : sans ça,
  //  le second recommencerait à son propre pas et on regarderait deux
  //  fois le même instant.
  assertEquals(
    instantsDuGuet([{ jusqua: 4, pas: 2 }, { jusqua: 10, pas: 3 }]),
    [2, 4, 7, 10],
  );
});
