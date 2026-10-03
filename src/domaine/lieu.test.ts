import { assertEquals } from "@std/assert";
import { cleDeLieu, lieuDepuisLaCle } from "./lieu.ts";

Deno.test("les accents tombent, les lettres restent", () => {
  // Le piège classique : une normalisation trop gourmande donne
  // « clairre » au lieu de « clairiere ».
  assertEquals(cleDeLieu("Clairière aux Lucioles"), "clairiere-aux-lucioles");
  assertEquals(cleDeLieu("Roselière"), "roseliere");
  assertEquals(cleDeLieu("Source Écumante"), "source-ecumante");
  assertEquals(cleDeLieu("Gué des Marchands"), "gue-des-marchands");
});

Deno.test("la ponctuation et les espaces deviennent un seul tiret", () => {
  assertEquals(cleDeLieu("Berge  Est"), "berge-est");
  assertEquals(cleDeLieu("Pic de l'Aube"), "pic-de-l-aube");
  assertEquals(cleDeLieu("  Méandres  "), "meandres");
  assertEquals(cleDeLieu("Grotte n°2"), "grotte-n-2");
});

Deno.test("la même clé sort toujours du même nom", () => {
  // C'est ce qui fait qu'un message garde son sens : la clé n'est pas
  // enregistrée quelque part, elle se recalcule.
  for (const nom of ["Lisière de Samaragd", "Passe du Large", "Méandres"]) {
    assertEquals(cleDeLieu(nom), cleDeLieu(nom), nom);
  }
});

const FORET = [
  "Lisière de Samaragd",
  "Sentier des Fougères",
  "Clairière aux Lucioles",
];

Deno.test("on retrouve le lieu depuis sa clé", () => {
  assertEquals(lieuDepuisLaCle("clairiere-aux-lucioles", FORET), "Clairière aux Lucioles");
  assertEquals(lieuDepuisLaCle("lisiere-de-samaragd", FORET), "Lisière de Samaragd");
});

Deno.test("une clé inconnue rend null, et ne choisit pas un lieu au hasard", () => {
  // Le cas arrive quand un lieu est renommé entre le moment où le message
  // est écrit et celui où la relève le lit. Le joueur doit obtenir une
  // erreur lisible, pas une rencontre ailleurs.
  assertEquals(lieuDepuisLaCle("plage-de-nulle-part", FORET), null);
  assertEquals(lieuDepuisLaCle("", FORET), null);
  assertEquals(lieuDepuisLaCle("clairiere-aux-lucioles", []), null);
});

Deno.test("deux zones peuvent porter le même lieu sans se gêner", () => {
  // « Passe du Large » existe dans l'Océan Mystérieux ET sur la Plage
  // Grain de Sel. Comme on cherche toujours dans la zone du sujet, il n'y
  // a rien à départager.
  const ocean = ["Passe du Large", "Haut-Fond"];
  const plage = ["Passe du Large", "Dune Blanche"];
  assertEquals(lieuDepuisLaCle("passe-du-large", ocean), "Passe du Large");
  assertEquals(lieuDepuisLaCle("passe-du-large", plage), "Passe du Large");
});

Deno.test("les ligatures ne font pas un trou dans la clé", () => {
  //  Relevé sur la Forêt Marécageuse le 3 octobre : « Cœur de la Forêt »
  //  donnait `c-ur-de-la-foret`. NFD ne décompose pas `œ`, qui est une
  //  lettre à part et non un `o` accentué.
  assertEquals(cleDeLieu("Cœur de la Forêt"), "coeur-de-la-foret");
  assertEquals(cleDeLieu("Cœur"), "coeur");
  assertEquals(cleDeLieu("Nævus"), "naevus");
});
