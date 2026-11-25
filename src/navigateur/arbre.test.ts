import { assert, assertEquals } from "@std/assert";
import {
  type Arbre,
  compter,
  ilManque,
  lireLArbre,
  type Noeud,
  palierDe,
  plaintes,
  type Progres,
} from "./arbre.ts";

function noeud(clef: string, p: Partial<Noeud> = {}): Noeud {
  return {
    clef,
    titre: clef,
    condition: "",
    recompense: "",
    genre: "mesure",
    mesure: clef,
    seuil: 1,
    apres: [],
    ...p,
  };
}

function arbre(p: Partial<Arbre> = {}): Arbre {
  return {
    palier: { "2": { cases: 2, deSaBranche: 1 }, "3": { cases: 4, deSaBranche: 2 } },
    familles: [{ clef: "tronc", titre: "Tronc", noeuds: [noeud("a"), noeud("b"), noeud("c")] }],
    branches: [
      {
        clef: "doux",
        nom: "Doux",
        embleme: "Shaymin",
        noeuds: [noeud("d1", { genre: "mission" }), noeud("d2", { genre: "mission" })],
      },
      {
        clef: "brave",
        nom: "Brave",
        embleme: "Cresselia",
        noeuds: [noeud("b1", { genre: "mission" })],
      },
    ],
    ...p,
  };
}

function progres(p: Partial<Progres> = {}): Progres {
  return { branche: "doux", acquis: new Set(), mesures: {}, ...p };
}

Deno.test("une mesure atteinte allume la case", () => {
  const vu = lireLArbre(arbre(), progres({ mesures: { a: 1 } }));
  assertEquals(vu.find((v) => v.noeud.clef === "a")?.etat, "acquis");
  assertEquals(vu.find((v) => v.noeud.clef === "b")?.etat, "a-portee");
});

Deno.test("une case allumée ne s'éteint jamais", () => {
  //  Une équipe de six niveau 40 revendue le lendemain ne retire pas
  //  « Équipe de choc » : la médaille dit ce qu'on A FAIT.
  const vu = lireLArbre(arbre(), progres({ acquis: new Set(["a"]), mesures: { a: 0 } }));
  assertEquals(vu.find((v) => v.noeud.clef === "a")?.etat, "acquis");
});

Deno.test("un prérequis non atteint verrouille", () => {
  const a = arbre({
    familles: [{ clef: "t", titre: "T", noeuds: [noeud("a"), noeud("b", { apres: ["a"] })] }],
  });
  const froid = lireLArbre(a, progres());
  assertEquals(froid.find((v) => v.noeud.clef === "b")?.etat, "verrouille");
  const chaud = lireLArbre(a, progres({ mesures: { a: 1 } }));
  assertEquals(chaud.find((v) => v.noeud.clef === "b")?.etat, "a-portee");
});

Deno.test("un prérequis qui n'existe pas ne verrouille rien", () => {
  //  Une clef mal écrite barrerait une branche entière sans un mot.
  //  C'est au garde-fou des données de crier, pas à l'écran.
  const a = arbre({
    familles: [{ clef: "t", titre: "T", noeuds: [noeud("b", { apres: ["fantome"] })] }],
  });
  assertEquals(lireLArbre(a, progres())[0].etat, "a-portee");
});

Deno.test("les cases que rien ne sait allumer sont hors-jeu", () => {
  const a = arbre({
    familles: [{
      clef: "t",
      titre: "T",
      noeuds: [noeud("m", { genre: "forum", mesure: undefined, seuil: undefined })],
    }],
  });
  assertEquals(lireLArbre(a, progres())[0].etat, "hors-jeu");
});

Deno.test("une case hors-jeu ne compte pas dans le palier", () => {
  //  Une condition que le jeu ne peut pas remplir bloquerait une
  //  montée sans que personne ne comprenne pourquoi — c'est le
  //  cul-de-sac des badges, qu'on est en train de défaire.
  const a = arbre({
    familles: [{
      clef: "t",
      titre: "T",
      noeuds: [
        noeud("a"),
        noeud("x", { genre: "staff", mesure: undefined, seuil: undefined }),
        noeud("y", { genre: "forum", mesure: undefined, seuil: undefined }),
      ],
    }],
  });
  assertEquals(compter(a, progres({ mesures: { a: 1 } })).total, 1);
});

Deno.test("l'arbre ne montre que la branche de sa maison", () => {
  const clefs = lireLArbre(arbre(), progres()).map((v) => v.noeud.clef);
  assert(clefs.includes("d1"));
  assert(!clefs.includes("b1"));
});

Deno.test("sans maison, il ne reste que le tronc", () => {
  const clefs = lireLArbre(arbre(), progres({ branche: null })).map((v) => v.noeud.clef);
  assertEquals(clefs, ["a", "b", "c"]);
});

Deno.test("le palier demande des cases ET des cases de sa branche", () => {
  const a = arbre();
  //  Trois cases du tronc, aucune de la branche : toujours palier 1.
  assertEquals(palierDe(a, progres({ mesures: { a: 1, b: 1, c: 1 } })), 1);
  //  Deux cases dont une de la branche : palier 2.
  assertEquals(palierDe(a, progres({ mesures: { a: 1 }, acquis: new Set(["d1"]) })), 2);
  //  Quatre dont deux de la branche : palier 3.
  assertEquals(
    palierDe(a, progres({ mesures: { a: 1, b: 1 }, acquis: new Set(["d1", "d2"]) })),
    3,
  );
});

Deno.test("sans maison, on ne dépasse pas le palier 1", () => {
  //  Le « dont » est ce qui fait exister les branches : trois cases
  //  du tronc ne suffisent pas, et c'est voulu.
  const sans = progres({ branche: null, mesures: { a: 1, b: 1, c: 1 } });
  assertEquals(palierDe(arbre(), sans), 1);
});

Deno.test("il manque dit ce qu'il reste, des deux côtés", () => {
  const a = arbre();
  assertEquals(ilManque(a, progres()), { cases: 2, deSaBranche: 1 });
  assertEquals(ilManque(a, progres({ mesures: { a: 1, b: 1, c: 1 } })), {
    cases: 0,
    deSaBranche: 1,
  });
});

Deno.test("au palier 3, il n'y a plus rien à annoncer", () => {
  const p = progres({ mesures: { a: 1, b: 1 }, acquis: new Set(["d1", "d2"]) });
  assertEquals(ilManque(arbre(), p), null);
});

Deno.test("les plaintes attrapent une clef en double", () => {
  const a = arbre({
    familles: [{ clef: "t", titre: "T", noeuds: [noeud("a"), noeud("a")] }],
    branches: [],
  });
  assert(plaintes(a).some((p) => p.includes("deux nœuds")));
});

Deno.test("les plaintes attrapent un prérequis fantôme", () => {
  const a = arbre({
    familles: [{ clef: "t", titre: "T", noeuds: [noeud("a", { apres: ["nulle-part"] })] }],
    branches: [],
  });
  assert(plaintes(a).some((p) => p.includes("nulle-part")));
});

Deno.test("les plaintes attrapent un cycle", () => {
  //  Deux nœuds qui s'attendent resteraient verrouillés pour
  //  toujours, et rien à l'écran ne dirait pourquoi.
  const a = arbre({
    familles: [{
      clef: "t",
      titre: "T",
      noeuds: [noeud("a", { apres: ["b"] }), noeud("b", { apres: ["a"] })],
    }],
    branches: [],
  });
  assert(plaintes(a).some((p) => p.includes("s'attend lui-même")));
});

Deno.test("les plaintes attrapent une mesure sans seuil", () => {
  const a = arbre({
    familles: [{ clef: "t", titre: "T", noeuds: [noeud("a", { mesure: undefined })] }],
    branches: [],
  });
  assert(plaintes(a).some((p) => p.includes("sans mesure ni seuil")));
});

Deno.test("l'arbre livré ne porte aucune plainte", async () => {
  const a = JSON.parse(
    await Deno.readTextFile(new URL("../../data/arbre.json", import.meta.url)),
  ) as Arbre;
  assertEquals(plaintes(a), []);
});

Deno.test("l'arbre livré porte les médailles et les missions de Callista", async () => {
  const a = JSON.parse(
    await Deno.readTextFile(new URL("../../data/arbre.json", import.meta.url)),
  ) as Arbre;
  const tous = [
    ...a.familles.flatMap((f) => f.noeuds),
    ...a.branches.flatMap((b) => b.noeuds),
  ];
  //  Les titres sont ceux de t1012 et t855, recopiés mot pour mot. Si
  //  l'un d'eux change ici sans changer là-bas, l'arbre ment.
  assert(tous.some((n) => n.titre === "Petit collectionneur"));
  assert(tous.some((n) => n.titre === "Champion de Rhode"));
  assert(tous.some((n) => n.titre === "Capturer un Pokémon Obscur pour le Prof. Syrus"));
  assertEquals(a.branches.length, 6);
});
