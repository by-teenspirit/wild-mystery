// ════════════════════════════════════════════════════════════════════
//  src/application/cloturer-un-sujet.test.ts
//
//  Tests de cas d'usage : des adaptateurs en mémoire, aucune base,
//  aucun réseau. Ce qu'on vérifie ici est l'ORCHESTRATION — le calcul,
//  lui, est déjà testé dans src/domaine/cloture.test.ts.
// ════════════════════════════════════════════════════════════════════

import { assert, assertEquals, assertRejects } from "@std/assert";
import {
  CatalogueEnMemoire,
  ClotureEnMemoire,
  EtatDuJeuEnMemoire,
  ForumEnMemoire,
  SignataireDeTest,
} from "../adaptateurs/en-memoire/jeu.ts";
import { RegistreEnMemoire } from "../adaptateurs/en-memoire/registre.ts";
import { ClotureEchouee, CloturerUnSujet } from "./cloturer-un-sujet.ts";
import { codeValide } from "../domaine/code.ts";

const SUJET = 7000;
const ANNA = "11111111-1111-1111-1111-111111111111";
const BORIS = "22222222-2222-2222-2222-222222222222";
const BALL = 1;

function monter(): {
  cas: CloturerUnSujet;
  registre: RegistreEnMemoire;
  jeu: EtatDuJeuEnMemoire;
  cloture: ClotureEnMemoire;
  forum: ForumEnMemoire;
} {
  const registre = new RegistreEnMemoire();
  const jeu = new EtatDuJeuEnMemoire();
  const cloture = new ClotureEnMemoire();
  const forum = new ForumEnMemoire();
  const catalogue = new CatalogueEnMemoire().objet(BALL, "Poké Ball");
  const cas = new CloturerUnSujet(
    registre,
    jeu,
    cloture,
    forum,
    catalogue,
    new SignataireDeTest(),
  );
  return { cas, registre, jeu, cloture, forum };
}

const DEMANDE = { sujetId: SUJET, demandeurId: ANNA, demandeurPseudo: "Anna" };

function sacAvec(balls: number): {
  sac: Map<number, number>;
  placesEnBoite: number;
  pokedollars: number;
} {
  return { sac: new Map([[BALL, balls]]), placesEnBoite: 30, pokedollars: 1000 };
}

// ── le chemin heureux ───────────────────────────────────────────────
Deno.test("un sujet complet se clôt, et ce qui est versé est ce que le domaine a décidé", async () => {
  const { cas, registre, jeu, cloture, forum } = monter();
  jeu.poser(ANNA, sacAvec(2));
  await registre.inscrire(SUJET, ANNA, 8001, {
    type: "objet_utilise",
    objetId: BALL,
    quantite: 1,
  }, "WM-ACDE-FGH");
  await registre.inscrire(SUJET, ANNA, 8002, {
    type: "capture",
    especeId: 215,
    niveau: 19,
  }, "WM-ACDE-FGJ");

  const r = await cas.executer(DEMANDE);

  assertEquals(r.issue, "close");
  assert(r.issue === "close" && codeValide(r.code), "le code publié doit avoir la bonne forme");

  const verse = cloture.verse(SUJET);
  assertEquals(verse?.length, 1);
  assertEquals(verse?.[0].joueurId, ANNA);
  assertEquals(verse?.[0].effets.captures, [{ especeId: 215, niveau: 19 }]);
  assertEquals(verse?.[0].effets.objetsConsommes.get(BALL), 1);

  assertEquals(forum.postes.length, 1);
  assertEquals(forum.postes[0].mentionne, "Anna");
  assert(forum.postes[0].corps.includes("clôturé"));
});

Deno.test("un multi à deux joueurs verse les deux d'un coup", async () => {
  const { cas, registre, jeu, cloture } = monter();
  jeu.poser(ANNA, sacAvec(1)).poser(BORIS, sacAvec(1));
  await registre.inscrire(SUJET, ANNA, 8001, { type: "croise", especeId: 37 }, "WM-ACDE-FGH");
  await registre.inscrire(SUJET, BORIS, 8002, { type: "croise", especeId: 95 }, "WM-ACDE-FGJ");

  const r = await cas.executer(DEMANDE);

  assertEquals(r.issue, "close");
  assertEquals(cloture.verse(SUJET)?.length, 2);
});

// ── le cas qui justifie la règle « tout ou rien » ───────────────────
Deno.test("un seul joueur à court, et personne n'est versé", async () => {
  const { cas, registre, jeu, cloture, forum } = monter();
  jeu.poser(ANNA, sacAvec(5)).poser(BORIS, sacAvec(0));
  await registre.inscrire(SUJET, ANNA, 8001, {
    type: "objet_utilise",
    objetId: BALL,
    quantite: 1,
  }, "WM-ACDE-FGH");
  await registre.inscrire(SUJET, BORIS, 8002, {
    type: "objet_utilise",
    objetId: BALL,
    quantite: 1,
  }, "WM-ACDE-FGJ");

  const r = await cas.executer(DEMANDE);

  assertEquals(r.issue, "refusee");
  assertEquals(cloture.verse(SUJET), undefined, "rien ne doit avoir été versé");
  assert(r.issue === "refusee" && r.manques.has(BORIS));
  assert(r.issue === "refusee" && !r.manques.has(ANNA), "Anna était en règle");
  assertEquals(
    forum.postes.length,
    1,
    "le refus doit être posté, pour qu'on sache quoi racheter",
  );
});

Deno.test("le refus nomme l'objet en toutes lettres, pas son numéro", async () => {
  const { cas, registre, jeu, forum } = monter();
  jeu.poser(ANNA, sacAvec(0));
  await registre.inscrire(SUJET, ANNA, 8001, {
    type: "objet_utilise",
    objetId: BALL,
    quantite: 2,
  }, "WM-ACDE-FGH");

  await cas.executer(DEMANDE);

  assertEquals(forum.postes.length, 1);
  const corps = forum.postes[0].corps;
  assert(corps.includes("Poké Ball"), `le nom manque : ${corps}`);
  assert(corps.includes("registre du sujet est intact"), "il faut rassurer sur le registre");
});

Deno.test("le refus nomme aussi les places en boîte et l'argent", async () => {
  const { cas, registre, jeu, forum } = monter();
  jeu.poser(ANNA, { sac: new Map(), placesEnBoite: 1, pokedollars: 100 });
  await registre.inscrire(SUJET, ANNA, 8001, {
    type: "capture",
    especeId: 1,
    niveau: 5,
  }, "WM-ACDE-FGH");
  await registre.inscrire(SUJET, ANNA, 8002, {
    type: "capture",
    especeId: 2,
    niveau: 5,
  }, "WM-ACDE-FGJ");
  await registre.inscrire(
    SUJET,
    ANNA,
    8003,
    { type: "pokedollars", montant: -500 },
    "WM-ACDE-FGK",
  );

  await cas.executer(DEMANDE);

  const corps = forum.postes[0].corps;
  assert(corps.includes("places en boîte"), corps);
  assert(corps.includes("₽"), corps);
});

// ── les cas où il n'y a rien à faire ────────────────────────────────
Deno.test("un sujet déjà clos ne se reclôt pas et ne poste rien", async () => {
  const { cas, registre, jeu, cloture, forum } = monter();
  jeu.poser(ANNA, sacAvec(1));
  await registre.inscrire(SUJET, ANNA, 8001, { type: "croise", especeId: 37 }, "WM-ACDE-FGH");
  await cloture.appliquer(SUJET, [], "WM-ACDE-FGH", "Bilan de test.", "Anna");

  const r = await cas.executer(DEMANDE);

  assertEquals(r.issue, "deja close");
  assertEquals(forum.postes.length, 0);
});

Deno.test("un sujet sans aucune ligne de registre n'est pas clos", async () => {
  const { cas, forum, cloture } = monter();
  const r = await cas.executer(DEMANDE);
  assertEquals(r.issue, "rien a clore");
  assertEquals(forum.postes.length, 0);
  assertEquals(cloture.verse(SUJET), undefined);
});

Deno.test("un registre vide mais présent clôture sans rien verser", async () => {
  const { cas, registre, jeu, cloture } = monter();
  jeu.poser(ANNA, sacAvec(0));
  await registre.inscrire(SUJET, ANNA, 8001, { type: "croise", especeId: 37 }, "WM-ACDE-FGH");

  const r = await cas.executer(DEMANDE);

  assertEquals(r.issue, "close");
  assertEquals(cloture.verse(SUJET)?.[0].effets.especesCroisees, [37]);
  assertEquals(cloture.verse(SUJET)?.[0].effets.pokedollars, 0);
});

// ── quand la base dit non ───────────────────────────────────────────
Deno.test("si la base refuse, on ne poste rien et le registre reste intact", async () => {
  const { cas, registre, jeu, cloture, forum } = monter();
  jeu.poser(ANNA, sacAvec(1));
  await registre.inscrire(SUJET, ANNA, 8001, { type: "croise", especeId: 37 }, "WM-ACDE-FGH");
  cloture.refuseLaProchaine = new Error("contrainte pokemon_equipe_six");

  await assertRejects(() => cas.executer(DEMANDE), ClotureEchouee);

  assertEquals(forum.postes.length, 0, "aucun message ne doit partir");
  assertEquals((await registre.lignesDuSujet(SUJET, ANNA)).length, 1);
});

// ── le code ─────────────────────────────────────────────────────────
Deno.test("deux clôtures du même sujet par les mêmes joueurs donnent le même code", async () => {
  const faire = async (): Promise<string> => {
    const { cas, registre, jeu } = monter();
    jeu.poser(ANNA, sacAvec(1));
    await registre.inscrire(SUJET, ANNA, 8001, { type: "croise", especeId: 37 }, "WM-ACDE-FGH");
    const r = await cas.executer(DEMANDE);
    return r.issue === "close" ? r.code : "";
  };
  assertEquals(await faire(), await faire());
});

// ── la correction du 2 octobre ──────────────────────────────────────

Deno.test("si le forum est injoignable, la clôture tient et le bilan attend", async () => {
  // Le défaut constaté en vrai : un mot de passe expiré a laissé un sujet
  // clos sans aucun bilan publié, et comme il était clos, plus rien ne
  // réessayait. Désormais le bilan est en base avec la clôture.
  const c = monter();
  c.jeu.poser(ANNA, sacAvec(1));
  await c.registre.inscrire(SUJET, ANNA, 8001, {
    type: "objet_trouve",
    objetId: BALL,
    quantite: 1,
  }, "WM-ACDE-FGH");
  c.forum.refuseLaProchaineReponse = new Error("forum injoignable");

  const resultat = await c.cas.executer({
    sujetId: SUJET,
    demandeurId: ANNA,
    demandeurPseudo: "Anna",
  });

  assertEquals(resultat.issue, "close", "la clôture est bien appliquée");
  assert(resultat.issue === "close" && resultat.bilanEnAttente, "le bilan attend");
  assertEquals(c.forum.postes.length, 0, "rien n'a été posté");
  assert(
    (c.cloture.bilan(SUJET) ?? "").includes("Sujet clôturé"),
    "mais le bilan est en base, prêt à être reposté",
  );
});

Deno.test("quand le forum répond, le bilan n'attend pas", async () => {
  const c = monter();
  c.jeu.poser(ANNA, sacAvec(1));
  await c.registre.inscrire(SUJET, ANNA, 8001, {
    type: "objet_trouve",
    objetId: BALL,
    quantite: 1,
  }, "WM-ACDE-FGH");

  const resultat = await c.cas.executer({
    sujetId: SUJET,
    demandeurId: ANNA,
    demandeurPseudo: "Anna",
  });

  assert(resultat.issue === "close" && !resultat.bilanEnAttente);
  assertEquals(c.forum.postes.length, 1);
});

Deno.test("le bilan posté nomme le joueur, pas son identifiant", async () => {
  const c = monter();
  c.jeu.poser(ANNA, sacAvec(1)).pseudo(ANNA, "Calliste Vanne");
  await c.registre.inscrire(SUJET, ANNA, 8001, {
    type: "capture",
    especeId: 215,
    niveau: 19,
  }, "WM-ACDE-FGH");

  await c.cas.executer({ sujetId: SUJET, demandeurId: ANNA, demandeurPseudo: "Anna" });

  const corps = c.forum.postes[0].corps;
  assert(corps.includes("CALLISTE VANNE"), corps);
  assertEquals(corps.includes(ANNA), false, "aucun UUID dans un message de joueur");
});
