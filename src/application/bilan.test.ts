// ════════════════════════════════════════════════════════════════════
//  src/application/bilan.test.ts
//
//  Ce texte est le seul message que la relève publie pour une clôture, et
//  il restera dans le sujet pour toujours. On le teste donc comme un
//  livrable, pas comme un détail : son contenu, son ordre, et ce qu'il ne
//  dit PAS quand il n'y a rien à dire.
// ════════════════════════════════════════════════════════════════════

import { assert, assertEquals, assertStringIncludes } from "@std/assert";
import {
  type LigneDeBilan,
  type LigneEnAttente,
  pokedollars,
  redigerLeBilan,
  redigerLeRefus,
  RIEN_A_VERSER,
  rubriques,
  rubriquesEnAttente,
} from "./bilan.ts";

const RACINE = "https://exemple.test/wm/";

/** Le bilan tel qu'on le LIT — balises retirées.
 *
 *  ── POURQUOI LES ESSAIS PASSENT PAR LÀ ──────────────────────────────
 *
 *  Le bilan est devenu une fiche le 18 novembre, et les assertions
 *  cherchaient « CAPTURÉ : Farfuret niv. 19 » d'un seul tenant. Dans le
 *  balisage, l'étiquette et la valeur sont dans deux `<span>` : la
 *  chaîne n'existe plus telle quelle, alors que le joueur, lui, la lit
 *  bien ainsi.
 *
 *  Les assertions auraient pu s'adapter au balisage ; elles se seraient
 *  alors cassées à chaque retouche de classe, et elles auraient cessé
 *  de dire ce qui compte. Elles portent donc sur le TEXTE RENDU — ce
 *  qui vérifie au passage que le bilan reste lisible sans feuille de
 *  style. */
function lu(html: string): string {
  return html.replace(/<[^>]+>/g, "");
}

function ligne(partiel: Partial<LigneDeBilan> = {}): LigneDeBilan {
  return {
    pseudo: "Calliste Vanne",
    captures: [],
    experience: [],
    ajoutes: [],
    consommes: [],
    croisees: [],
    pokedollarsAvant: 1000,
    pokedollarsApres: 1000,
    ...partiel,
  };
}

// ── les pokédollars ─────────────────────────────────────────────────

Deno.test("pokedollars · milliers séparés, comme dans la maquette", () => {
  assertEquals(pokedollars(0), "0");
  assertEquals(pokedollars(350), "350");
  assertEquals(pokedollars(1240), "1 240");
  assertEquals(pokedollars(1590), "1 590");
  assertEquals(pokedollars(1234567), "1 234 567");
  assertEquals(pokedollars(-250), "-250");
});

// ── les rubriques, partagées avec le module du navigateur ───────────

//  Le bilan existe à deux endroits : posté dans le sujet à la clôture,
//  et affiché au-dessus du premier message pendant tout le RP. Ces
//  essais tiennent la promesse que les deux disent la même chose — pas
//  le jour où on les écrit, le jour où on en corrige un seul.

Deno.test("chaque rubrique du texte posté vient d'une rubrique affichée", () => {
  const l = ligne({
    captures: [{ nom: "Roucool", especeId: 16, niveau: 7 }],
    croisees: [{ nom: "Olivini", especeId: 191 }, { nom: "Spododo", especeId: 265 }],
    experience: [{ nom: "Lumi", especeId: 25, gain: 48 }],
    ajoutes: [{ objet: "Poké Ball", quantite: 2 }],
    consommes: [{ objet: "Potion", quantite: 1 }],
    pokedollarsApres: 1240,
  });

  const paires = rubriques(l);
  const texte = redigerLeBilan([l], RACINE);

  //  Chaque paire se retrouve telle quelle dans le message, recollée.
  for (const { etiquette, valeur } of paires) {
    assert(
      lu(texte).includes(`${etiquette} : ${valeur}`),
      `« ${etiquette} » manque au message posté`,
    );
  }

  //  ET LE MESSAGE N'EN INVENTE AUCUNE. On relève les `<li>` plutôt
  //  que les lignes : le bilan tient sur une seule depuis qu'il est
  //  une fiche — Forumactif fait un `<br>` de chaque retour.
  const posees = [...texte.matchAll(/<li class="wm-bilanp__ligne">(.*?)<\/li>/g)]
    .map((m) => lu(m[1]));
  assertEquals(posees, paires.map((r) => `${r.etiquette} : ${r.valeur}`));
});

Deno.test("les rubriques sortent dans l'ordre de la maquette", () => {
  //  L'ordre n'est pas cosmétique : le joueur lit d'abord ce qu'il a
  //  gagné, puis ce que ça lui a coûté.
  const l = ligne({
    captures: [{ nom: "Roucool", especeId: 16, niveau: 7 }],
    croisees: [{ nom: "Olivini", especeId: 191 }],
    experience: [{ nom: "Lumi", especeId: 25, gain: 48 }],
    ajoutes: [{ objet: "Poké Ball", quantite: 2 }],
    consommes: [{ objet: "Potion", quantite: 1 }],
    pokedollarsApres: 1240,
  });
  assertEquals(rubriques(l).map((r) => r.etiquette), [
    "CAPTURÉ",
    "CROISÉ",
    "EXPÉRIENCE",
    "AJOUTÉ AU SAC",
    "CONSOMMÉ",
    "POKÉDOLLARS",
  ]);
});

Deno.test("un joueur sans effet n'a aucune rubrique, et le texte le dit", () => {
  assertEquals(rubriques(ligne()), []);
  assert(redigerLeBilan([ligne()], RACINE).includes(RIEN_A_VERSER));
});

// ── le bilan ────────────────────────────────────────────────────────

Deno.test("le bilan nomme chaque rubrique qui a quelque chose à dire", () => {
  const texte = redigerLeBilan([
    ligne({
      captures: [{ nom: "Farfuret", especeId: 215, niveau: 19 }],
      experience: [{ nom: "Galopa", especeId: 78, gain: 180 }, {
        nom: "Goupix",
        especeId: 37,
        gain: 240,
      }],
      ajoutes: [{ objet: "Pierre Feu", quantite: 1 }],
      consommes: [{ objet: "Poké Ball", quantite: 2 }],
      croisees: [{ nom: "Stalgamin", especeId: 220 }],
      pokedollarsAvant: 1240,
      pokedollarsApres: 1590,
    }),
  ], RACINE);

  assert(lu(texte).includes("CAPTURÉ : Farfuret niv. 19"), texte);
  assert(lu(texte).includes("CROISÉ : Stalgamin"), texte);
  assert(lu(texte).includes("EXPÉRIENCE : Galopa +180 · Goupix +240"), texte);
  assert(lu(texte).includes("AJOUTÉ AU SAC : 1 Pierre Feu"), texte);
  assert(lu(texte).includes("CONSOMMÉ : 2 Poké Ball"), texte);
  assert(lu(texte).includes("POKÉDOLLARS : 1 240 → 1 590"), texte);
});

Deno.test("une rubrique vide n'est pas écrite", () => {
  // Un bilan ne doit pas être une liste de « aucun » qu'il faut lire en
  // entier pour trouver les deux lignes qui comptent.
  const texte = redigerLeBilan([
    ligne({ experience: [{ nom: "Galopa", especeId: 78, gain: 180 }] }),
  ], RACINE);

  assert(lu(texte).includes("EXPÉRIENCE"), texte);
  assertEquals(lu(texte).includes("CAPTURÉ"), false, texte);
  assertEquals(lu(texte).includes("CONSOMMÉ"), false, texte);
  assertEquals(lu(texte).includes("POKÉDOLLARS"), false, "le solde n'a pas bougé");
});

Deno.test("un joueur sans aucun effet est nommé quand même", () => {
  // Sinon son nom apparaîtrait suivi de rien, ce qui ressemble à un bogue.
  const texte = redigerLeBilan([ligne({ pseudo: "Nael Ardent" })], RACINE);
  assert(lu(texte).includes("NAEL ARDENT"), texte);
  assert(lu(texte).includes("Rien à verser pour ce sujet."), texte);
});

Deno.test("un multi donne un bloc par joueur, dans l'ordre reçu", () => {
  const texte = redigerLeBilan([
    ligne({ pseudo: "Calliste Vanne", croisees: [{ nom: "Farfuret", especeId: 215 }] }),
    ligne({ pseudo: "Nael Ardent", croisees: [{ nom: "Stalgamin", especeId: 220 }] }),
  ], RACINE);

  assert(texte.indexOf("CALLISTE VANNE") < texte.indexOf("NAEL ARDENT"), texte);
  assertEquals(lu(texte).split("CROISÉ :").length - 1, 2);
});

Deno.test("le singulier et le pluriel des objets", () => {
  const texte = redigerLeBilan([
    ligne({
      consommes: [{ objet: "Poké Ball", quantite: 1 }, { objet: "Potion", quantite: 3 }],
    }),
  ], RACINE);
  assert(lu(texte).includes("CONSOMMÉ : 1 Poké Ball · 3 Potion"), texte);
});

Deno.test("LE BILAN RESTE LISIBLE SANS CSS", () => {
  //  RÈGLE RETOURNÉE LE 18 NOVEMBRE, et c'est la même exigence : « il
  //  doit rester lisible sans CSS, sans JavaScript, dans dix ans ».
  //  Elle interdisait tout balisage ; elle interdit maintenant le
  //  balisage qui PORTE le sens.
  //
  //  La différence tient à ce qui dégrade : un `<p>`, une `<ul>` et
  //  des `<img>` sans feuille de style donnent du texte et des images
  //  empilées — lisible. Un tableau de mise en page, du BBCode ou un
  //  sens porté par une couleur, non. C'est pourquoi chaque valeur
  //  reste précédée de son étiquette EN TOUTES LETTRES : sans CSS, on
  //  lit « CAPTURÉ Farfuret niv. 19 », pas deux colonnes orphelines.
  const html = redigerLeBilan([
    ligne({ captures: [{ nom: "Farfuret", especeId: 215, niveau: 19 }] }),
  ], RACINE);
  assertEquals(/<table|<td|\[\/?[a-z]/.test(html), false, html);
  assertStringIncludes(html, "CAPTURÉ");
  assertStringIncludes(html, "Farfuret niv. 19");
});

Deno.test("TOUT SUR UNE LIGNE — Forumactif fait un <br> de chaque retour", () => {
  assertEquals(redigerLeBilan([ligne()], RACINE).includes("\n"), false);
});

Deno.test("LE CODE N'EST PLUS DANS LE BILAN", () => {
  //  Il y était « parce qu'un joueur qui conteste doit pouvoir le
  //  recopier ». Il reste dans le marqueur que l'adaptateur pose, donc
  //  dans la source de la page — et cette fonction ne le reçoit plus.
  const html = redigerLeBilan([ligne()], RACINE);
  assertEquals(/WM-[A-Z0-9]{4}-[A-Z0-9]{3}/.test(html), false, html);
});

// ── le refus ────────────────────────────────────────────────────────

Deno.test("le refus nomme ce qui manque, et rassure sur ce qui n'a pas bougé", () => {
  const texte = redigerLeRefus([
    { pseudo: "Calliste Vanne", manques: ["2 × Poké Ball, et il n'en reste 1"] },
  ], "WM-7K4P-9QX");

  assert(lu(texte).includes("CALLISTE VANNE"), texte);
  assert(lu(texte).includes("— 2 × Poké Ball, et il n'en reste 1"), texte);
  assert(lu(texte).includes("Le registre du sujet est intact"), texte);
  assert(lu(texte).includes("rien n'a bougé"), texte);
  assert(lu(texte).includes("CODE : WM-7K4P-9QX"), texte);
});

Deno.test("le refus n'invite pas à recommencer sans dire quoi faire", () => {
  const texte = redigerLeRefus([{ pseudo: "X", manques: ["1 place en boîte"] }], "WM-A");
  assert(lu(texte).includes("Rachetez ce qui manque"), texte);
});

Deno.test("un refus à plusieurs nomme chacun séparément", () => {
  const texte = redigerLeRefus([
    { pseudo: "Anna", manques: ["1 × Poké Ball"] },
    { pseudo: "Boris", manques: ["350 ₽"] },
  ], "WM-A");
  assert(texte.indexOf("ANNA") < texte.indexOf("BORIS"), texte);
});

// ── les rubriques en attente, pour le module ────────────────────────

function enAttente(partiel: Partial<LigneEnAttente> = {}): LigneEnAttente {
  return {
    pseudo: "Calliste Vanne",
    captures: [],
    experience: [],
    ajoutes: [],
    consommes: [],
    croisees: [],
    pokedollars: 0,
    ...partiel,
  };
}

Deno.test("le module écrit un écart, jamais un solde", () => {
  //  Rien n'est acquis avant la clôture : afficher « 1 240 → 1 590 »
  //  pendant le RP promettrait un versement qui n'a pas eu lieu.
  assertEquals(
    rubriquesEnAttente(enAttente({ pokedollars: 350 })),
    [{ etiquette: "POKÉDOLLARS", valeur: "+350" }],
  );
  //  Le séparateur de milliers est une espace fine insécable, pas une
  //  espace ordinaire : on le reprend de `pokedollars` au lieu de le
  //  retaper, sinon l'essai passe à l'œil et échoue à l'octet.
  assertEquals(
    rubriquesEnAttente(enAttente({ pokedollars: -1240 })),
    [{ etiquette: "POKÉDOLLARS", valeur: "−" + pokedollars(1240) }],
  );
});

Deno.test("zéro pokédollar ne s'écrit pas du tout", () => {
  assertEquals(rubriquesEnAttente(enAttente()), []);
});

Deno.test("les cinq autres rubriques sont les mêmes des deux côtés", () => {
  //  C'est la promesse du partage : si quelqu'un change une étiquette
  //  d'un côté, ce test tombe.
  const commun = {
    captures: [{ nom: "Roucool", especeId: 16, niveau: 7 }],
    croisees: [{ nom: "Olivini", especeId: 191 }],
    experience: [{ nom: "Lumi", especeId: 25, gain: 48 }],
    ajoutes: [{ objet: "Poké Ball", quantite: 2 }],
    consommes: [{ objet: "Potion", quantite: 1 }],
  };
  assertEquals(
    rubriquesEnAttente(enAttente(commun)),
    rubriques(ligne(commun)),
  );
});
