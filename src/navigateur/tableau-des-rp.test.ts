import { assertEquals } from "@std/assert";
import {
  etatVu,
  garderLesRp,
  type LigneDeRp,
  rangerLesRp,
  sujetDeLAdresse,
} from "./tableau-des-rp.ts";

const MOI = "Eliott Vanner";

function ligne(dessus: Partial<LigneDeRp> = {}): LigneDeRp {
  return {
    sujetId: 996,
    titre: "La brume ne lève pas",
    forumNom: "Montagnes Embrumées",
    reponses: 3,
    dernierLe: "2026-10-28T13:34:00Z",
    dernierAuteur: "Murphy",
    dernierMessage: 15582,
    extrait: "",
    etat: "en-cours",
    ordre: 0,
    ...dessus,
  };
}

Deno.test("« À MOI » SE CALCULE : c'est qui a écrit le dernier message", () => {
  //  Le ranger dans une colonne ferait deux sources pour une même
  //  vérité, et celle du joueur serait fausse dès qu'on lui répond —
  //  au moment précis où elle compte.
  assertEquals(etatVu(ligne({ dernierAuteur: "Murphy" }), MOI), "a-moi");
  assertEquals(etatVu(ligne({ dernierAuteur: MOI }), MOI), "a-l-autre");
});

Deno.test("un sujet où personne n'a encore écrit se dit autrement", () => {
  assertEquals(etatVu(ligne({ dernierAuteur: "" }), MOI), "neuf");
});

Deno.test("CE QUE LA PERSONNE A POSÉ PASSE AVANT LE CALCUL", () => {
  //  Un RP mis en pause ne doit pas réapparaître dans « à moi
  //  d'écrire » parce que quelqu'un y a répondu : c'est précisément ce
  //  qu'elle voulait éviter en le mettant en pause.
  assertEquals(etatVu(ligne({ etat: "en-pause", dernierAuteur: "Murphy" }), MOI), "en-pause");
  assertEquals(etatVu(ligne({ etat: "cloture", dernierAuteur: "Murphy" }), MOI), "cloture");
  assertEquals(etatVu(ligne({ etat: "prevu", dernierAuteur: "Murphy" }), MOI), "prevu");
});

Deno.test("les espaces de bord ne changent pas à qui c'est d'écrire", () => {
  assertEquals(etatVu(ligne({ dernierAuteur: " Eliott Vanner " }), MOI), "a-l-autre");
});

Deno.test("le filtre « à moi » prend aussi les sujets où personne n'a écrit", () => {
  const lignes = [
    ligne({ sujetId: 1, dernierAuteur: "Murphy" }),
    ligne({ sujetId: 2, dernierAuteur: MOI }),
    ligne({ sujetId: 3, dernierAuteur: "" }),
    ligne({ sujetId: 4, etat: "en-pause", dernierAuteur: "Murphy" }),
  ];
  assertEquals(garderLesRp(lignes, "a-moi", MOI).map((l) => l.sujetId), [1, 3]);
  assertEquals(garderLesRp(lignes, "en-pause", MOI).map((l) => l.sujetId), [4]);
  assertEquals(garderLesRp(lignes, "tous", MOI).length, 4);
});

Deno.test("LE TRI PAR DÉFAUT EST LE TEMPS, ET LA MAIN L'EMPORTE", () => {
  //  `ordre` est à zéro pour tout le monde tant que personne n'a
  //  rangé : la date fait donc le tri par défaut, et la main prend le
  //  dessus dès qu'elle s'en mêle.
  const lignes = [
    ligne({ sujetId: 1, dernierLe: "2026-10-01T10:00:00Z" }),
    ligne({ sujetId: 2, dernierLe: "2026-11-01T10:00:00Z" }),
    ligne({ sujetId: 3, dernierLe: "2026-10-15T10:00:00Z" }),
  ];
  assertEquals(rangerLesRp(lignes).map((l) => l.sujetId), [2, 3, 1]);
  const range = [...lignes];
  range[0] = { ...range[0], ordre: -1 };
  assertEquals(rangerLesRp(range).map((l) => l.sujetId), [1, 2, 3]);
});

Deno.test("et les RP sans date vont à la fin, pas au début", () => {
  //  Un prévu n'a rien à dire sur ce qui vient de bouger. Le tri naïf
  //  des chaînes mettrait `null` n'importe où.
  const lignes = [
    ligne({ sujetId: 1, dernierLe: null, etat: "prevu" }),
    ligne({ sujetId: 2, dernierLe: "2026-11-01T10:00:00Z" }),
  ];
  assertEquals(rangerLesRp(lignes).map((l) => l.sujetId), [2, 1]);
});

Deno.test("ON ACCEPTE CE QUE LES GENS COLLENT VRAIMENT", () => {
  //  Refuser « t996-le-sentier » parce qu'il manque le `https://`
  //  serait une leçon de syntaxe, pas une aide.
  assertEquals(sujetDeLAdresse("https://mysteryinrhode.forumactif.com/t996-le-sentier"), 996);
  assertEquals(sujetDeLAdresse("/t996-le-sentier"), 996);
  assertEquals(sujetDeLAdresse("t996-le-sentier"), 996);
  assertEquals(sujetDeLAdresse("t996"), 996);
  assertEquals(sujetDeLAdresse("https://…/t996p2-le-sentier"), 996);
  assertEquals(sujetDeLAdresse("https://…/t996-le-sentier#15582"), 996);
  assertEquals(sujetDeLAdresse("  996  "), 996);
});

Deno.test("et ce qui n'est pas une adresse de sujet rend null", () => {
  assertEquals(sujetDeLAdresse(""), null);
  assertEquals(sujetDeLAdresse("https://mysteryinrhode.forumactif.com/f36-steppes"), null);
  assertEquals(sujetDeLAdresse("un café, deux silences"), null);
  assertEquals(sujetDeLAdresse("0"), null);
});
