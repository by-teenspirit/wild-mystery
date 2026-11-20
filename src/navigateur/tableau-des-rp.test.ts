import { assertEquals } from "@std/assert";
import {
  adresseDuSujet,
  etatVu,
  familleDuForum,
  forumDeLAdresse,
  garderLesRp,
  type LigneDeRp,
  MOTS,
  rangerLesRp,
  sujetDeLAdresse,
} from "./tableau-des-rp.ts";

const MOI = "Eliott Vanner";

function ligne(dessus: Partial<LigneDeRp> = {}): LigneDeRp {
  return {
    sujetId: 996,
    titre: "La brume ne lève pas",
    forumId: 34,
    forumNom: "Montagnes Embrumées",
    reponses: 3,
    dernierLe: "2026-10-28T13:34:00Z",
    dernierAuteur: "Murphy",
    dernierMessage: 15582,
    extrait: "",
    etat: "en-cours",
    ordre: 0,
    description: "",
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

Deno.test("LE TIRET N'EST PAS DÉCORATIF — sans lui, le forum rend 404", () => {
  //  Mesuré sur le forum le 13 novembre : `/t996` rend « 404 - Page
  //  not found », `/t996-` rend le sujet et redirige vers
  //  `/t996-test`. C'est ce tiret qui manquait aux quatre endroits qui
  //  fabriquaient l'adresse à la main.
  assertEquals(adresseDuSujet(996), "/t996-");
  assertEquals(adresseDuSujet(996).endsWith("-"), true);
});

Deno.test("et l'ancre d'un message est un nombre nu, comme celles du forum", () => {
  //  Un message porte DEUX ancres, `15582` et `p15582` ; le forum lie
  //  vers la première (`/t996-test#15570`), et le fragment traverse la
  //  redirection.
  assertEquals(adresseDuSujet(996, 15582), "/t996-#15582");
  //  Sans dernier message connu — un RP prévu — on va en tête de sujet,
  //  et surtout pas sur `#null`.
  assertEquals(adresseDuSujet(996, null), "/t996-");
  assertEquals(adresseDuSujet(996, undefined), "/t996-");
});

// ── LE FORUM LU DANS L'ADRESSE ───────────────────────────────────────
//
//  Il sert au formulaire de création, où le fil d'Ariane n'existe pas.

Deno.test("le forum se lit dans l'adresse, dans les deux ordres", () => {
  assertEquals(forumDeLAdresse("/post?f=9&mode=newtopic"), 9);
  assertEquals(forumDeLAdresse("/post?mode=newtopic&f=9"), 9);
  assertEquals(forumDeLAdresse("?f=117"), 117);
});

Deno.test("un `f` qui n'est pas un forum ne passe pas", () => {
  //  `f=0` N'EXISTE PAS, et `fid`, `ref` ou `f=9x` ne sont pas `f`.
  assertEquals(forumDeLAdresse("/post?f=0&mode=newtopic"), null);
  assertEquals(forumDeLAdresse("/post?f=9x"), null);
  assertEquals(forumDeLAdresse("/post?fid=9"), null);
  assertEquals(forumDeLAdresse("/post?ref=9"), null);
  assertEquals(forumDeLAdresse("/post?mode=newtopic"), null);
  assertEquals(forumDeLAdresse(""), null);
});

Deno.test("l'adresse d'un sujet ne porte pas de forum", () => {
  //  CE QUI SÉPARE LES DEUX FONCTIONS : sur `/t996-test` il n'y a pas
  //  de forum à lire, et c'est ce qui fait choisir le fil d'Ariane.
  assertEquals(forumDeLAdresse("/t996-test"), null);
  assertEquals(sujetDeLAdresse("/post?f=9&mode=newtopic"), null);
});

// ── LA COLONNE SOLO ET LE TAG DE LIEU, 20 novembre ─────────────────

Deno.test("UN SOLO N'ATTEND PERSONNE, MÊME QUAND LE JEU Y A ÉCRIT", () => {
  //  LE CAS RÉEL : le sujet « test » de Jake a onze messages, dont un
  //  d'Arceus — le jeu poste le résultat des fouilles. Sans l'état
  //  solo, l'étiquette disait « à moi d'écrire » pour un RP où
  //  personne ne doit répondre.
  const seul = ligne({ etat: "solo", dernierAuteur: "Arceus" });
  assertEquals(etatVu(seul, MOI), "solo");
  assertEquals(MOTS[etatVu(seul, MOI)], "personne à attendre");
});

Deno.test("ET IL PASSE AVANT LE CALCUL, comme les autres états posés", () => {
  //  Le dernier message est de moi : le calcul dirait « à l'autre ».
  //  Ce que la personne a posé l'emporte.
  assertEquals(etatVu(ligne({ etat: "solo", dernierAuteur: MOI }), MOI), "solo");
});

Deno.test("LE TAG SE DÉDUIT DU FORUM", () => {
  const table = { 36: "zone sauvage", 5: "ville", 72: "voyage dans le temps" };
  assertEquals(familleDuForum(36, table), "zone sauvage");
  assertEquals(familleDuForum(5, table), "ville");
  assertEquals(familleDuForum(72, table), "voyage dans le temps");
});

Deno.test("UN FORUM INCONNU N'A PAS DE TAG, et ce n'est pas une panne", () => {
  //  Un forum ajouté sur le forum n'entre pas tout seul dans la table.
  //  La carte s'affiche sans tag : un tag absent se remarque et se
  //  corrige, un tag faux se croit.
  assertEquals(familleDuForum(999, { 36: "zone sauvage" }), null);
  assertEquals(familleDuForum(0, {}), null);
});
