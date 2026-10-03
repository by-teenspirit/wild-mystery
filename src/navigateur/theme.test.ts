import { assert, assertEquals, assertFalse } from "@std/assert";
import {
  CHOIX_PAR_DEFAUT,
  choixApresClic,
  destination,
  estUnChoixDeTheme,
  themeApplique,
} from "./theme.ts";

Deno.test("sans choix, le forum suit la machine du joueur", () => {
  assertEquals(themeApplique("systeme", true), "sombre");
  assertEquals(themeApplique("systeme", false), "clair");
  assertEquals(CHOIX_PAR_DEFAUT, "systeme");
});

Deno.test("un choix explicite gagne contre la machine", () => {
  // C'est tout l'intérêt des trois états : un joueur qui a dit « clair »
  // le reste quand son système bascule en sombre à la tombée du jour.
  assertEquals(themeApplique("clair", true), "clair");
  assertEquals(themeApplique("sombre", false), "sombre");
});

Deno.test("le bouton annonce où l'on va, pas où l'on est", () => {
  assertEquals(destination("clair"), "sombre");
  assertEquals(destination("sombre"), "clair");
});

Deno.test("cliquer depuis « système » décide, et n'y retourne pas", () => {
  // Le piège serait d'enregistrer « système » après un clic : le thème
  // rebasculerait tout seul au prochain changement de la machine.
  assertEquals(choixApresClic("systeme", true), "clair");
  assertEquals(choixApresClic("systeme", false), "sombre");
});

Deno.test("cliquer deux fois ramène au point de départ", () => {
  const premier = choixApresClic("systeme", false);
  assertEquals(choixApresClic(premier, false), "clair");
  assertEquals(premier, "sombre");
});

Deno.test("une valeur venue du stockage est validée avant d'être crue", () => {
  // localStorage est modifiable par le joueur depuis sa console : ce qui
  // en sort est une entrée extérieure, pas une valeur de confiance.
  for (const bon of ["clair", "sombre", "systeme"]) assert(estUnChoixDeTheme(bon));
  for (const mauvais of ["", "SOMBRE", "dark", null, undefined, 1, {}]) {
    assertFalse(estUnChoixDeTheme(mauvais), String(mauvais));
  }
});
