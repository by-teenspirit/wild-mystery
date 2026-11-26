import { assert, assertEquals } from "@std/assert";
import {
  type Arbre,
  ilManque,
  lireUnEtage,
  type Objectif,
  objectifsDe,
  ouEnEstElle,
  palierDe,
  plaintes,
  type Progres,
} from "./arbre.ts";

function o(clef: string, p: Partial<Objectif> = {}): Objectif {
  return { clef, titre: clef, genre: "commun", mesure: clef, seuil: 1, ...p };
}

function maison(clef: string, mission: Objectif) {
  return {
    clef,
    nom: clef,
    embleme: "X",
    paliers: {
      "2": [
        o(`${clef}-2a`, { genre: "maison" }),
        o(`${clef}-2b`, { genre: "maison" }),
        mission,
      ],
      "3": [
        o(`${clef}-3a`, { genre: "maison" }),
        o(`${clef}-3b`, { genre: "maison" }),
        o(`${clef}-3m`, { genre: "mission", mesure: undefined, seuil: undefined }),
      ],
    },
  };
}

function arbre(): Arbre {
  return {
    parPalier: 5,
    communs: {
      "2": [o("c2a"), o("c2b")],
      "3": [o("c3a"), o("c3b")],
    },
    branches: [
      maison("doux", o("doux-2m", { genre: "mission", mesure: undefined, seuil: undefined })),
      maison(
        "brave",
        o("brave-2m", { genre: "a-ecrire", titre: "", mesure: undefined, seuil: undefined }),
      ),
    ],
  };
}

const rien: Progres = { maison: "doux", faits: new Set() };
const tout2 = new Set(["c2a", "c2b", "doux-2a", "doux-2b", "doux-2m"]);
const tout3 = new Set([...tout2, "c3a", "c3b", "doux-3a", "doux-3b", "doux-3m"]);

Deno.test("un étage mêle les communs et ceux de la maison", () => {
  const clefs = objectifsDe(arbre(), "doux", "2").map((x) => x.clef);
  assertEquals(clefs, ["c2a", "c2b", "doux-2a", "doux-2b", "doux-2m"]);
});

Deno.test("sans maison, il ne reste que les communs", () => {
  assertEquals(objectifsDe(arbre(), null, "2").map((x) => x.clef), ["c2a", "c2b"]);
});

Deno.test("un étage compte ce qui est fait", () => {
  const e = lireUnEtage(arbre(), { maison: "doux", faits: new Set(["c2a"]) }, "2");
  assertEquals(e.faits, 1);
  assertEquals(e.total, 5);
  assertEquals(e.ouverte, false);
});

Deno.test("la porte s'ouvre quand les neuf sont faits, pas huit", () => {
  //  Un seuil partiel se négocie, et ce qui se négocie finit par
  //  s'arbitrer au cas par cas.
  const presque = new Set([...tout2]);
  presque.delete("doux-2m");
  assertEquals(lireUnEtage(arbre(), { maison: "doux", faits: presque }, "2").ouverte, false);
  assertEquals(lireUnEtage(arbre(), { maison: "doux", faits: tout2 }, "2").ouverte, true);
});

Deno.test("une case à écrire ne bloque pas la porte", () => {
  //  Tant que la mission n'est pas écrite, elle compte comme faite :
  //  une porte fermée par un texte manquant serait un mur que
  //  personne ne comprendrait.
  const faits = new Set(["c2a", "c2b", "brave-2a", "brave-2b"]);
  const e = lireUnEtage(arbre(), { maison: "brave", faits }, "2");
  assertEquals(e.ouverte, true);
});

Deno.test("le palier suit les deux étages", () => {
  const a = arbre();
  assertEquals(palierDe(a, rien), 1);
  assertEquals(palierDe(a, { maison: "doux", faits: tout2 }), 2);
  assertEquals(palierDe(a, { maison: "doux", faits: tout3 }), 3);
});

Deno.test("sans maison, on reste au palier 1 même en ayant tout fait", () => {
  //  Sinon la validation devient une formalité.
  assertEquals(palierDe(arbre(), { maison: null, faits: tout3 }), 1);
  assertEquals(palierDe(arbre(), { maison: "pikachu", faits: tout3 }), 1);
});

Deno.test("il manque dit ce qu'il reste à l'étage en cours", () => {
  const a = arbre();
  assertEquals(ilManque(a, rien), 5);
  assertEquals(ilManque(a, { maison: "doux", faits: new Set(["c2a"]) }), 4);
  assertEquals(ilManque(a, { maison: "doux", faits: tout2 }), 5);
  assertEquals(ilManque(a, { maison: "doux", faits: tout3 }), null);
});

Deno.test("ce qui est fait reste fait", () => {
  //  La mesure peut redescendre — une équipe revendue — l'objectif
  //  non.
  const e = lireUnEtage(arbre(), { maison: "doux", faits: tout2 }, "2");
  assert(e.objectifs.every((x) => x.fait));
});

Deno.test("ouEnEstElle rend les deux étages", () => {
  const vu = ouEnEstElle(arbre(), { maison: "doux", faits: tout2 });
  assertEquals(vu.branche?.clef, "doux");
  assertEquals(vu.etages.length, 2);
  assertEquals(vu.palier, 2);
  assertEquals(vu.reste, 5);
});

Deno.test("sans maison, aucun étage à montrer", () => {
  assertEquals(ouEnEstElle(arbre(), { maison: null, faits: new Set() }).etages, []);
});

Deno.test("les plaintes attrapent une clef en double", () => {
  const a = arbre();
  const casse: Arbre = { ...a, communs: { "2": [o("c2a"), o("c2a")], "3": a.communs["3"] } };
  assert(plaintes(casse).some((p) => p.includes("deux objectifs")));
});

Deno.test("les plaintes attrapent un fait de jeu sans mesure", () => {
  const a = arbre();
  const casse: Arbre = {
    ...a,
    communs: { "2": [o("c2a", { mesure: undefined }), o("c2b")], "3": a.communs["3"] },
  };
  assert(plaintes(casse).some((p) => p.includes("sans mesure")));
});

Deno.test("les plaintes attrapent un étage qui n'a pas le bon compte", () => {
  const a = arbre();
  const casse: Arbre = { ...a, parPalier: 9 };
  assert(plaintes(casse).some((p) => p.includes("pas 9")));
});

Deno.test("les plaintes attrapent deux missions dans le même étage", () => {
  const a = arbre();
  const b = a.branches[0];
  const casse: Arbre = {
    ...a,
    branches: [{
      ...b,
      paliers: {
        "2": [...b.paliers["2"], o("doux-2m2", { genre: "mission", mesure: undefined })],
        "3": b.paliers["3"],
      },
    }],
  };
  assert(plaintes(casse).some((p) => p.includes("mission(s) au palier 2")));
});

Deno.test("l'arbre livré ne porte aucune plainte", async () => {
  const a = JSON.parse(
    await Deno.readTextFile(new URL("../../data/arbre.json", import.meta.url)),
  ) as Arbre;
  assertEquals(plaintes(a), []);
});

Deno.test("l'arbre livré a neuf objectifs par palier et par maison", async () => {
  const a = JSON.parse(
    await Deno.readTextFile(new URL("../../data/arbre.json", import.meta.url)),
  ) as Arbre;
  assertEquals(a.parPalier, 9);
  assertEquals(a.branches.length, 6);
  for (const b of a.branches) {
    for (const p of ["2", "3"] as const) {
      assertEquals(objectifsDe(a, b.clef, p).length, 9, `${b.clef} ${p}`);
    }
  }
});

Deno.test("l'arbre livré porte les missions de Callista, mot pour mot", async () => {
  const a = JSON.parse(
    await Deno.readTextFile(new URL("../../data/arbre.json", import.meta.url)),
  ) as Arbre;
  const titres = a.branches.flatMap((b) => [...b.paliers["2"], ...b.paliers["3"]]).map((x) =>
    x.titre
  );
  assert(titres.includes("Capturer un Pokémon Obscur pour le Prof. Syrus"));
  assert(titres.includes("Trouver un pokemon chromatique."));
});

Deno.test("il manque exactement trois missions", async () => {
  //  Sérieux, Malin et Jovial n'en ont qu'une là où il en faut deux.
  //  Ce test est là pour que le nombre descende, pas pour qu'il se
  //  cache.
  const a = JSON.parse(
    await Deno.readTextFile(new URL("../../data/arbre.json", import.meta.url)),
  ) as Arbre;
  const vides = a.branches.flatMap((b) => [...b.paliers["2"], ...b.paliers["3"]]).filter((x) =>
    x.genre === "a-ecrire"
  );
  assertEquals(vides.length, 3);
  assert(vides.every((x) => x.titre === ""));
});

Deno.test("chaque fait de jeu nomme une mesure que la base devra compter", async () => {
  const a = JSON.parse(
    await Deno.readTextFile(new URL("../../data/arbre.json", import.meta.url)),
  ) as Arbre;
  const mesures = new Set(
    [
      ...a.communs["2"],
      ...a.communs["3"],
      ...a.branches.flatMap((b) => [...b.paliers["2"], ...b.paliers["3"]]),
    ].filter((x) => x.genre === "commun" || x.genre === "maison").map((x) => x.mesure),
  );
  //  LE NOMBRE DE MESURES DISTINCTES EST LE COÛT DE LA MIGRATION.
  //  L'écrire ici le rend visible : chaque mesure de plus est une
  //  requête SQL de plus à écrire et à tenir.
  assert(mesures.size <= 20, `${mesures.size} mesures distinctes`);
  assert(!mesures.has(undefined));
});
