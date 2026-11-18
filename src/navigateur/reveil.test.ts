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
import {
  faut_il_sonner,
  GUET_SECONDES,
  instantsDuGuet,
  PAS_SECONDES,
  TROP_VIEUX,
} from "./reveil.ts";

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

Deno.test("LE GUET VA DE DEUX EN DEUX, JUSQU'À TRENTE", () => {
  const i = instantsDuGuet();
  assertEquals(i[0], PAS_SECONDES);
  assertEquals(i.at(-1), GUET_SECONDES);
  assertEquals(i.length, GUET_SECONDES / PAS_SECONDES);
  //  STRICTEMENT CROISSANT : un pas qui repasserait en arrière ferait
  //  deux requêtes au même instant.
  assert(i.every((t, n) => n === 0 || t > i[n - 1]));
});

Deno.test("UN RÉGLAGE ABSURDE NE BOUCLE PAS À L'INFINI", () => {
  //  Un pas à zéro ou négatif ferait une boucle sans fin dans la page
  //  du joueur — le genre de défaut qui fige un onglet.
  assertEquals(instantsDuGuet(30, 0), []);
  assertEquals(instantsDuGuet(30, -1), []);
  assertEquals(instantsDuGuet(0, 2), []);
  assertEquals(instantsDuGuet(Number.NaN, 2), []);
});
