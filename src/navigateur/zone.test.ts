import { assertEquals } from "@std/assert";
import { lieuxDepuis, zoneDe, type ZoneDuNavigateur, zonesDepuis } from "./zone.ts";

const FORET: ZoneDuNavigateur = { forumId: 9, nom: "Forêt Marécageuse", palier: 1 };

// ── lire zones.json ─────────────────────────────────────────────────

Deno.test("les zones sont lues avec ce dont le navigateur se sert", () => {
  const brut = {
    _: "un commentaire, que le fichier porte vraiment",
    montBataille: { forumId: 65, nom: "Mont Bataille" },
    zones: [
      { forumId: 9, nom: "Forêt Marécageuse", palier: 1, parentId: 96, lieux: 15 },
      { forumId: 34, nom: "Montagnes Embrumées", palier: 1, parentId: 96, lieux: 16 },
    ],
  };
  assertEquals(zonesDepuis(brut), [
    FORET,
    { forumId: 34, nom: "Montagnes Embrumées", palier: 1 },
  ]);
});

Deno.test("le Mont Bataille n'est pas une zone, et il n'est pas dans la liste", () => {
  //  Il est à côté de `zones` dans le fichier, pas dedans : la Ligue n'a
  //  pas de rencontres. Le lire comme une zone y poserait la barre.
  const zones = zonesDepuis({ montBataille: { forumId: 65, nom: "Mont Bataille" }, zones: [] });
  assertEquals(zones, []);
});

Deno.test("une entrée abîmée est ignorée, les autres passent", () => {
  //  Le fichier traverse un CDN et une branche git. Une version mal
  //  formée ne doit ni faire disparaître la barre partout, ni la faire
  //  apparaître là où elle n'a rien à faire.
  const zones = zonesDepuis({
    zones: [
      { forumId: "neuf", nom: "Sans identifiant", palier: 1 },
      { forumId: 9, nom: "", palier: 1 },
      { forumId: 9, nom: "Forêt Marécageuse", palier: 4 },
      { forumId: 9.5, nom: "Pas entier", palier: 1 },
      null,
      "une chaîne",
      { forumId: 9, nom: "Forêt Marécageuse", palier: 1 },
    ],
  });
  assertEquals(zones, [FORET]);
});

Deno.test("un fichier illisible rend une liste vide, il ne lève pas", () => {
  //  Lever ici casserait tout le script, donc le thème et le masquage des
  //  marqueurs avec. Une liste vide ne fait que priver de la barre.
  for (const rien of [null, undefined, 42, "texte", [], {}, { zones: "pas un tableau" }]) {
    assertEquals(zonesDepuis(rien), [], JSON.stringify(rien));
  }
});

// ── trouver la zone de la page ──────────────────────────────────────

Deno.test("un forum de zone rend sa zone", () => {
  assertEquals(zoneDe(9, [FORET]), FORET);
});

Deno.test("un forum qui n'est pas une zone rend null, et c'est le cas normal", () => {
  //  Il y a bien plus de forums que de zones : villes, arènes, flood,
  //  archives. `null` n'est pas une erreur, c'est la réponse habituelle.
  assertEquals(zoneDe(104, [FORET]), null);
  assertEquals(zoneDe(null, [FORET]), null);
});

// ── lire les lieux d'une zone ───────────────────────────────────────

Deno.test("les lieux sortent triés par nom, avec leur clé", () => {
  const lieux = lieuxDepuis({
    forumId: 9,
    lieux: {
      "Marais aux Brumes": { jour: [] },
      "Berge Est": { jour: [], nuit: [] },
      "Lisière de Samaragd": { jour: [] },
    },
  });
  assertEquals(lieux, [
    { nom: "Berge Est", cle: "berge-est" },
    { nom: "Lisière de Samaragd", cle: "lisiere-de-samaragd" },
    { nom: "Marais aux Brumes", cle: "marais-aux-brumes" },
  ]);
});

Deno.test("le tri respecte les accents", () => {
  //  Sans `localeCompare`, « Étang » passerait après « Zone » : le code
  //  des caractères accentués est au-dessus de celui de « Z ».
  const lieux = lieuxDepuis({ lieux: { "Zone Humide": {}, "Étang Clair": {}, "Allée": {} } });
  assertEquals(lieux.map((l) => l.nom), ["Allée", "Étang Clair", "Zone Humide"]);
});

Deno.test("deux lieux de même clé ne donnent qu'une entrée", () => {
  //  Vérifié sur les 145 lieux le 2 octobre : ça n'arrive pas. Mais deux
  //  entrées de menu indistinguables seraient pires qu'une seule.
  const lieux = lieuxDepuis({ lieux: { "Berge Est": {}, "berge  est": {} } });
  assertEquals(lieux.length, 1);
});

Deno.test("un fichier de faune illisible rend une liste vide", () => {
  for (const rien of [null, undefined, 42, { lieux: [] }, { lieux: null }, {}]) {
    assertEquals(lieuxDepuis(rien), [], JSON.stringify(rien));
  }
});
