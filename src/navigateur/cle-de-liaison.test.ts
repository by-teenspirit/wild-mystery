import { assertEquals } from "@std/assert";
import { type ChampDeProfil, cleParmiLesChamps } from "./cle-de-liaison.ts";

//  LES ÉTIQUETTES SONT CELLES DU FORUM, relevées le 3 novembre sur
//  `/profile?mode=editprofile` : vingt-et-un champs, et Forumactif
//  colle un « : » à la fin de chacun. Deux portent une étoile de champ
//  obligatoire.
const CLE = "a1b2c3d4e5f60718293a4b5c6d7e8f90";

function champs(...p: [string, string][]): ChampDeProfil[] {
  return p.map(([etiquette, valeur]) => ({ etiquette, valeur }));
}

const AUTOUR: [string, string][] = [
  ["Pseudo :", "Callista"],
  ["Discord * :", "callidesign"],
  ["Faceclaim * :", "quelqu'un"],
  ["CARNET DE BORD :", ""],
];

Deno.test("la clé se trouve par son étiquette, le « : » compris", () => {
  assertEquals(
    cleParmiLesChamps(champs(...AUTOUR, ["clé de liaison :", CLE])),
    CLE,
  );
});

Deno.test("L'ÉTIQUETTE EST CHERCHÉE SANS SA CASSE NI SES ACCENTS", () => {
  //  Elle est tapée à la main dans le panneau : « Clé de liaison »,
  //  « CLE DE LIAISON », « Clé de Liaison » doivent toutes marcher.
  //  Sinon un jour elle la retape et le carnet de tout le monde tombe.
  for (
    const mot of ["Clé de liaison :", "CLE DE LIAISON", "Clé de Liaison *:", "cle de liaison"]
  ) {
    assertEquals(cleParmiLesChamps(champs([mot, CLE])), CLE, mot);
  }
});

Deno.test("UN AUTRE CHAMP NE PASSE PAS POUR LA CLÉ", () => {
  //  « CARNET DE BORD » est le champ du lien public vers le sujet du
  //  joueur. Le confondre avec la clé publierait la clé.
  assertEquals(cleParmiLesChamps(champs(["CARNET DE BORD :", CLE])), null);
  assertEquals(cleParmiLesChamps(champs(["Liaison Discord :", CLE])), null);
});

Deno.test("un champ absent, vide ou mal rempli rend null", () => {
  assertEquals(cleParmiLesChamps(champs(...AUTOUR)), null);
  assertEquals(cleParmiLesChamps(champs(["clé de liaison :", ""])), null);
  assertEquals(cleParmiLesChamps(champs(["clé de liaison :", "   "])), null);
  //  Les 12 caractères qui étaient dans le champ d'Arceus le
  //  3 novembre : une clé de carnet en fait 32.
  assertEquals(cleParmiLesChamps(champs(["clé de liaison :", "WM-7K2P-9QX"])), null);
  //  Une clé à qui il manque un caractère, et une avec un « g ».
  assertEquals(cleParmiLesChamps(champs(["clé de liaison :", CLE.slice(1)])), null);
  assertEquals(cleParmiLesChamps(champs(["clé de liaison :", "g" + CLE.slice(1)])), null);
});

Deno.test("les majuscules d'une clé collée à la main sont ramenées en bas", () => {
  //  Le panneau de Supabase rend la clé en minuscules, mais un
  //  copier-coller qui passe par un tableur peut la remonter. La base
  //  n'accepte que les minuscules.
  assertEquals(cleParmiLesChamps(champs(["clé de liaison :", CLE.toUpperCase()])), CLE);
});

Deno.test("une clé entourée d'espaces est acceptée", () => {
  //  Un copier-coller depuis l'éditeur SQL en emporte souvent un.
  assertEquals(cleParmiLesChamps(champs(["clé de liaison :", ` ${CLE}\n`])), CLE);
});
