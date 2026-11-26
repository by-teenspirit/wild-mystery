import { assert, assertEquals } from "@std/assert";
import {
  type Arbre,
  type Branche,
  combienDEtapes,
  type Etape,
  etapeDuJour,
  ilManque,
  lireLaBranche,
  numeroter,
  ouEnEstElle,
  palierDe,
  plaintes,
} from "./arbre.ts";

function etape(clef: string, p: Partial<Etape> = {}): Etape {
  return { clef, titre: clef, texte: "", genre: "mission", ...p };
}

const PORTE_2 = etape("p2", { genre: "palier", palier: 2, titre: "Palier 2" });
const PORTE_3 = etape("p3", { genre: "palier", palier: 3, titre: "Palier 3" });

function branche(clef = "doux"): Branche {
  return {
    clef,
    nom: "Doux",
    embleme: "Shaymin",
    etapes: [
      etape(`${clef}-1`),
      etape(`${clef}-2`),
      { ...PORTE_2, clef: `${clef}-p2` },
      etape(`${clef}-3`),
      etape(`${clef}-4`),
      { ...PORTE_3, clef: `${clef}-p3` },
    ],
  };
}

function arbre(): Arbre {
  return {
    avantLaPorte: { "2": 2, "3": 2 },
    branches: [branche("doux"), branche("brave")],
  };
}

Deno.test("les portes ne prennent pas de numéro d'étape", () => {
  //  Comptées dans la suite, elles décalaient tout ce qui suit : la
  //  troisième étape s'annonçait quatrième, et le dessin disait autre
  //  chose que la liste.
  assertEquals(numeroter(branche()).map((x) => x.numero), [1, 2, null, 3, 4, null]);
});

Deno.test("combienDEtapes ne compte pas les portes", () => {
  assertEquals(combienDEtapes(branche()), 4);
});

Deno.test("le chemin se parcourt dans l'ordre", () => {
  const vu = lireLaBranche(branche(), 1).filter((v) => v.numero !== null);
  assertEquals(vu.map((v) => v.etat), ["faite", "en-cours", "a-venir", "a-venir"]);
});

Deno.test("rien de fait : la première est en cours", () => {
  const vu = lireLaBranche(branche(), 0).filter((v) => v.numero !== null);
  assertEquals(vu.map((v) => v.etat), ["en-cours", "a-venir", "a-venir", "a-venir"]);
});

Deno.test("tout fait : plus rien n'est en cours", () => {
  const vu = lireLaBranche(branche(), 4);
  assertEquals(vu.filter((v) => v.etat === "en-cours").length, 0);
  assertEquals(etapeDuJour(branche(), 4), null);
});

Deno.test("une porte s'ouvre quand ce qui la précède est fait", () => {
  const porte = (faites: number) =>
    lireLaBranche(branche(), faites).filter((v) => v.numero === null).map((v) => v.etat);
  assertEquals(porte(0), ["fermee", "fermee"]);
  assertEquals(porte(1), ["fermee", "fermee"]);
  assertEquals(porte(2), ["ouverte", "fermee"]);
  assertEquals(porte(4), ["ouverte", "ouverte"]);
});

Deno.test("l'étape du jour est la suivante, et une seule", () => {
  assertEquals(etapeDuJour(branche(), 0)?.clef, "doux-1");
  assertEquals(etapeDuJour(branche(), 2)?.clef, "doux-3");
});

Deno.test("le palier suit l'avancée", () => {
  const a = arbre();
  assertEquals(palierDe(a, 0), 1);
  assertEquals(palierDe(a, 1), 1);
  assertEquals(palierDe(a, 2), 2);
  assertEquals(palierDe(a, 3), 2);
  assertEquals(palierDe(a, 4), 3);
  //  AU-DELÀ DE LA FIN, ON RESTE AU 3. Un compteur en avance — une
  //  étape ajoutée puis retirée — ne doit pas inventer un palier 4.
  assertEquals(palierDe(a, 99), 3);
});

Deno.test("il manque dit combien d'étapes séparent de la porte", () => {
  const a = arbre();
  assertEquals(ilManque(a, 0), 2);
  assertEquals(ilManque(a, 2), 2);
  assertEquals(ilManque(a, 3), 1);
  assertEquals(ilManque(a, 4), null);
});

Deno.test("sans maison, pas de chemin et pas de montée", () => {
  //  Une joueuse dont le personnage n'est pas validé n'a pas de
  //  branche : lui annoncer un palier 2 atteignable serait une
  //  promesse que rien ne tient.
  const vu = ouEnEstElle(arbre(), null, 4);
  assertEquals(vu.branche, null);
  assertEquals(vu.chemin, []);
  assertEquals(vu.palier, 1);
  assertEquals(vu.reste, null);
});

Deno.test("une maison inconnue se comporte comme pas de maison", () => {
  assertEquals(ouEnEstElle(arbre(), "pikachu", 4).palier, 1);
});

Deno.test("ouEnEstElle rend le chemin de la bonne branche", () => {
  const vu = ouEnEstElle(arbre(), "brave", 1);
  assertEquals(vu.branche?.clef, "brave");
  assertEquals(vu.palier, 1);
  assertEquals(vu.reste, 1);
});

Deno.test("les plaintes attrapent une clef en double", () => {
  const b = branche();
  const a: Arbre = {
    avantLaPorte: { "2": 2, "3": 2 },
    branches: [b, { ...b, clef: "autre" }],
  };
  assert(plaintes(a).some((p) => p.includes("deux étapes")));
});

Deno.test("les plaintes attrapent une branche plus courte", () => {
  //  Une maison plus courte serait le chemin rapide, et les cinq
  //  autres un détour.
  const courte: Branche = { ...branche("brave"), etapes: [etape("x"), PORTE_2, PORTE_3] };
  const a: Arbre = { avantLaPorte: { "2": 2, "3": 2 }, branches: [branche(), courte] };
  assert(plaintes(a).some((p) => p.includes("étapes là où les autres")));
});

Deno.test("les plaintes attrapent des portes dans le désordre", () => {
  const b: Branche = {
    ...branche(),
    etapes: [etape("a"), PORTE_3, etape("b"), PORTE_2],
  };
  const a: Arbre = { avantLaPorte: { "2": 2, "3": 2 }, branches: [b] };
  assert(plaintes(a).some((p) => p.includes("deux portes dans l'ordre")));
});

Deno.test("les plaintes attrapent une mission sans texte", () => {
  const b: Branche = {
    ...branche(),
    etapes: [etape("a", { titre: "  " }), etape("b"), PORTE_2, etape("c"), etape("d"), PORTE_3],
  };
  const a: Arbre = { avantLaPorte: { "2": 2, "3": 2 }, branches: [b] };
  assert(plaintes(a).some((p) => p.includes("n'a pas de texte")));
});

Deno.test("l'arbre livré ne porte aucune plainte", async () => {
  const a = JSON.parse(
    await Deno.readTextFile(new URL("../../data/arbre.json", import.meta.url)),
  ) as Arbre;
  assertEquals(plaintes(a), []);
});

Deno.test("l'arbre livré a six branches, deux portes chacune", async () => {
  const a = JSON.parse(
    await Deno.readTextFile(new URL("../../data/arbre.json", import.meta.url)),
  ) as Arbre;
  assertEquals(a.branches.length, 6);
  for (const b of a.branches) {
    assertEquals(b.etapes.filter((e) => e.genre === "palier").length, 2, b.clef);
    assertEquals(combienDEtapes(b), 6, b.clef);
  }
});

Deno.test("l'arbre livré porte les missions de Callista, mot pour mot", async () => {
  const a = JSON.parse(
    await Deno.readTextFile(new URL("../../data/arbre.json", import.meta.url)),
  ) as Arbre;
  const titres = a.branches.flatMap((b) => b.etapes.map((e) => e.titre));
  //  Relevées sur t855. Si l'une change ici sans changer là-bas,
  //  l'arbre ment.
  assert(titres.includes("Capturer un Pokémon Obscur pour le Prof. Syrus"));
  assert(titres.includes("Trouver un pokemon chromatique."));
  assert(titres.includes("Aider une petite fille à retrouver son pokemon dans un rp."));
});

Deno.test("les étapes à écrire sont vides, et nombreuses", async () => {
  //  Vingt-quatre des quarante-huit. Les écrire à la place de
  //  Callista serait pire que de montrer le trou — et ce test est là
  //  pour que le nombre descende, pas pour qu'il se cache.
  const a = JSON.parse(
    await Deno.readTextFile(new URL("../../data/arbre.json", import.meta.url)),
  ) as Arbre;
  const vides = a.branches.flatMap((b) => b.etapes).filter((e) => e.genre === "a-ecrire");
  assert(vides.every((e) => e.titre === ""));
  assert(vides.length > 0);
});
