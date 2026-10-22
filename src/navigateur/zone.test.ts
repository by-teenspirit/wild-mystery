import { assertEquals } from "@std/assert";
import { legendeDeZone, zoneDe, type ZoneDuNavigateur, zonesDepuis } from "./zone.ts";

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

// ── le bandeau de la page d'une zone (22 octobre) ───────────────────

Deno.test("LES TROIS CHAMPS DU BANDEAU SONT LUS QUAND ILS SONT LÀ", () => {
  const brut = {
    zones: [{
      forumId: 34,
      nom: "Montagnes Embrumées",
      palier: 1,
      niveau: "Niveaux 1 à 20",
      description: "Des crêtes qui disparaissent dans le brouillard.",
      image: "https://exemple/montagnes-embrumees.jpg",
    }],
  };
  assertEquals(zonesDepuis(brut), [{
    forumId: 34,
    nom: "Montagnes Embrumées",
    palier: 1,
    niveau: "Niveaux 1 à 20",
    description: "Des crêtes qui disparaissent dans le brouillard.",
    image: "https://exemple/montagnes-embrumees.jpg",
  }]);
});

Deno.test("UNE ZONE SANS BANDEAU RESTE UNE ZONE", () => {
  //  C'est ce qui compte : savoir que ce forum est une zone décide de
  //  la barre d'actions et du module de bilan. Le bandeau n'est qu'un
  //  décor, et une zone neuve, pas encore sur la carte, doit pouvoir
  //  se fouiller.
  const brut = { zones: [{ forumId: 9, nom: "Forêt Marécageuse", palier: 1, niveau: "  " }] };
  assertEquals(zonesDepuis(brut), [FORET]);
});

Deno.test("un champ de bandeau qui n'est pas du texte est ignoré, pas converti", () => {
  const brut = { zones: [{ forumId: 9, nom: "Forêt Marécageuse", palier: 1, image: 404 }] };
  assertEquals(zonesDepuis(brut), [FORET]);
});

Deno.test("la légende dit le palier, et les niveaux s'il y en a", () => {
  assertEquals(
    legendeDeZone({ ...FORET, niveau: "Niveaux 1 à 20" }),
    "PALIER 1 · NIVEAUX 1 À 20",
  );
  //  Sans niveau, on écrit ce qu'on sait plutôt qu'un séparateur qui
  //  pend dans le vide.
  assertEquals(legendeDeZone(FORET), "PALIER 1");
});
