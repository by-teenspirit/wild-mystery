// ════════════════════════════════════════════════════════════════════
//  src/navigateur/vie.test.ts
//
//  Ce que ces tests protègent, et ce qu'ils ne protègent pas.
//
//  **Qu'une mauvaise ligne n'emporte pas les bonnes.** C'est la seule
//  propriété qui compte vraiment ici : l'encart est du décor, et du
//  décor n'a pas le droit de vider l'accueil du forum. Une ligne sur
//  huit mal écrite doit coûter une ligne, pas l'encart.
//
//  **Qu'un détail absent donne quand même une phrase française.** Parce
//  que `journal_ecrire` accepte `{}` exprès — elle avale ses erreurs
//  plutôt que de faire échouer une commande —, l'encart reçoit forcément
//  des détails vides un jour.
//
//  Ce qu'ils ne protègent pas : le rendu. Il est dans
//  `adaptateurs/navigateur/module-vie.ts`, et testé là.
// ════════════════════════════════════════════════════════════════════

import { assertEquals } from "@std/assert";
import {
  etiquetteDeType,
  ilYA,
  type LigneDeVie,
  lignesDeVie,
  phraseDeVie,
  signeDeType,
  TYPES_DE_VIE,
  vieDeRhode,
} from "./vie.ts";

const T = "2026-10-06T10:00:00.000Z";

function ligne(partiel: Partial<LigneDeVie> = {}): LigneDeVie {
  return {
    type: "achat",
    pseudo: "Anna",
    detail: {},
    arriveLe: new Date(T),
    ...partiel,
  };
}

// ── la lecture ──────────────────────────────────────────────────────

Deno.test("lignesDeVie : une réponse qui n'est pas un tableau rend vide", () => {
  for (const brut of [null, undefined, 3, "non", {}, { lignes: [] }]) {
    assertEquals(lignesDeVie(brut).length, 0, JSON.stringify(brut ?? null));
  }
});

Deno.test("lignesDeVie : une ligne valide passe entière", () => {
  const lues = lignesDeVie([
    { type: "achat", pseudo: "Anna", detail: { articles: 3 }, arrive_le: T },
  ]);
  assertEquals(lues.length, 1);
  assertEquals(lues[0].type, "achat");
  assertEquals(lues[0].pseudo, "Anna");
  assertEquals(lues[0].detail, { articles: 3 });
  assertEquals(lues[0].arriveLe.toISOString(), T);
});

Deno.test("lignesDeVie : UNE MAUVAISE LIGNE N'EMPORTE PAS LES BONNES", () => {
  //  LE TEST QUI COMPTE. Six lignes bancales, chacune pour une raison
  //  différente, autour de deux bonnes.
  const lues = lignesDeVie([
    { type: "achat", pseudo: "Anna", detail: {}, arrive_le: T },
    { type: "potion", pseudo: "Bob", detail: {}, arrive_le: T }, //  type inconnu
    { type: "achat", pseudo: "", detail: {}, arrive_le: T }, //  pseudo vide
    { type: "achat", pseudo: "   ", detail: {}, arrive_le: T }, //  pseudo blanc
    { type: "achat", detail: {}, arrive_le: T }, //  pas de pseudo
    { type: "achat", pseudo: "Dee", detail: {}, arrive_le: "hier" }, //  date illisible
    { type: "achat", pseudo: "Eve", detail: {} }, //  pas de date
    null,
    "une chaîne",
    { type: "badge", pseudo: "Zoé", detail: {}, arrive_le: T },
  ]);
  assertEquals(lues.map((l) => l.pseudo), ["Anna", "Zoé"]);
});

Deno.test("lignesDeVie : un détail qui n'est pas un objet devient `{}`", () => {
  for (const detail of [null, "trois", 3, ["a"]]) {
    const lues = lignesDeVie([{ type: "achat", pseudo: "Anna", detail, arrive_le: T }]);
    assertEquals(lues.length, 1, JSON.stringify(detail));
    assertEquals(lues[0].detail, {});
  }
});

Deno.test("lignesDeVie : l'ordre de la réponse est conservé", () => {
  //  `journal_dernieres` trie déjà. Retrier ici ferait deux avis.
  const lues = lignesDeVie([
    { type: "achat", pseudo: "Troisième", detail: {}, arrive_le: "2026-10-01T00:00:00Z" },
    { type: "achat", pseudo: "Premier", detail: {}, arrive_le: "2026-10-06T00:00:00Z" },
    { type: "achat", pseudo: "Deuxième", detail: {}, arrive_le: "2026-10-03T00:00:00Z" },
  ]);
  assertEquals(lues.map((l) => l.pseudo), ["Troisième", "Premier", "Deuxième"]);
});

// ── les phrases ─────────────────────────────────────────────────────

Deno.test("phraseDeVie : l'achat dit le nombre d'objets, et rien de plus", () => {
  assertEquals(
    phraseDeVie(ligne({ detail: { articles: 3 } })),
    "a emporté 3 objets du comptoir de Rhode",
  );
  assertEquals(
    phraseDeVie(ligne({ detail: { articles: 1 } })),
    "a emporté un objet du comptoir de Rhode",
  );
});

Deno.test("phraseDeVie : un détail absent ou faux donne quand même du français", () => {
  //  `journal_ecrire` accepte `{}` exprès : l'encart le verra.
  for (
    const detail of [{}, { articles: 0 }, { articles: -2 }, { articles: "trois" }, {
      articles: 1.5,
    }]
  ) {
    assertEquals(
      phraseDeVie(ligne({ detail })),
      "est passé au comptoir de Rhode",
      JSON.stringify(detail),
    );
  }
});

Deno.test("phraseDeVie : les cinq types encore sans écrivain ont tous une phrase", () => {
  //  La planche 18 les prévoit ; leurs systèmes viendront. Le jour où
  //  la pension écrira sa ligne, l'encart n'aura pas à changer.
  const attendu: ReadonlyArray<[LigneDeVie, string]> = [
    [ligne({ type: "pension", detail: {} }), "a confié un pokémon à la pension"],
    [
      ligne({ type: "pension", detail: { espece: "Évoli" } }),
      "a confié Évoli à la pension",
    ],
    [
      ligne({ type: "pension", detail: { espece: "Évoli", repris: true } }),
      "a repris Évoli à la pension",
    ],
    [ligne({ type: "fossile", detail: {} }), "a fait réanimer un fossile"],
    [
      ligne({ type: "fossile", detail: { espece: "Amonita" } }),
      "a fait réanimer un fossile — Amonita en est sorti",
    ],
    [ligne({ type: "eclosion", detail: {} }), "a vu un œuf éclore"],
    [
      ligne({ type: "eclosion", detail: { espece: "Togepi" } }),
      "a vu éclore un œuf : Togepi",
    ],
    [ligne({ type: "capture", detail: {} }), "a réussi une capture"],
    [ligne({ type: "capture", detail: { espece: "Ponyta" } }), "a capturé Ponyta"],
    [
      ligne({ type: "capture", detail: { espece: "Ponyta", chromatique: true } }),
      "a capturé Ponyta chromatique",
    ],
    [ligne({ type: "badge", detail: {} }), "a décroché un badge"],
    [
      ligne({ type: "badge", detail: { arene: "Lekro" } }),
      "a décroché le badge de Lekro",
    ],
  ];
  for (const [l, phrase] of attendu) assertEquals(phraseDeVie(l), phrase);
});

Deno.test("phraseDeVie : un texte de détail trop long est ignoré, pas tronqué", () => {
  //  Une tournure tronquée se lirait comme un bogue. On retombe sur la
  //  forme sans détail, qui est correcte.
  assertEquals(
    phraseDeVie(ligne({ type: "capture", detail: { espece: "x".repeat(41) } })),
    "a réussi une capture",
  );
  assertEquals(
    phraseDeVie(ligne({ type: "capture", detail: { espece: " Ponyta \n" } })),
    "a capturé Ponyta",
  );
});

// ── l'écart de temps ────────────────────────────────────────────────

Deno.test("ilYA : les paliers", () => {
  const maintenant = new Date("2026-10-06T12:00:00Z");
  const il = (iso: string): string => ilYA(new Date(iso), maintenant);
  assertEquals(il("2026-10-06T12:00:00Z"), "à l'instant");
  assertEquals(il("2026-10-06T11:59:30Z"), "à l'instant");
  assertEquals(il("2026-10-06T11:59:00Z"), "il y a 1 min");
  assertEquals(il("2026-10-06T11:17:00Z"), "il y a 43 min");
  assertEquals(il("2026-10-06T11:00:00Z"), "il y a 1 h");
  assertEquals(il("2026-10-05T13:00:00Z"), "il y a 23 h");
  assertEquals(il("2026-10-05T12:00:00Z"), "il y a 1 j");
  assertEquals(il("2026-09-15T12:00:00Z"), "il y a 21 j");
  assertEquals(il("2026-08-06T12:00:00Z"), "il y a 2 mois");
  assertEquals(il("2024-08-06T12:00:00Z"), "il y a plus d'un an");
});

Deno.test("ilYA : une ligne dans le futur rend « à l'instant »", () => {
  //  L'horloge du joueur peut devancer celle du serveur. « il y a −2 h »
  //  sur la page d'accueil serait un bogue visible par tous.
  assertEquals(
    ilYA(new Date("2026-10-06T14:00:00Z"), new Date("2026-10-06T12:00:00Z")),
    "à l'instant",
  );
});

// ── l'assemblage ────────────────────────────────────────────────────

Deno.test("vieDeRhode : huit lignes au plus, même si la réponse en donne vingt", () => {
  const brut = Array.from({ length: 20 }, (_, i) => ({
    type: "achat",
    pseudo: `Témoin ${i}`,
    detail: { articles: 1 },
    arrive_le: T,
  }));
  assertEquals(vieDeRhode(brut, new Date(T)).length, 8);
  assertEquals(vieDeRhode(brut, new Date(T), 3).length, 3);
  assertEquals(vieDeRhode(brut, new Date(T), 0).length, 0);
  assertEquals(vieDeRhode(brut, new Date(T), -5).length, 0);
});

Deno.test("vieDeRhode : une ligne affichée porte le pseudo à part de la phrase", () => {
  //  L'encart met le pseudo en gras : les coller ici l'obligerait à les
  //  redécouper.
  const [l] = vieDeRhode(
    [{ type: "achat", pseudo: "Anna", detail: { articles: 2 }, arrive_le: T }],
    new Date("2026-10-06T10:05:00Z"),
  );
  assertEquals(l.pseudo, "Anna");
  assertEquals(l.phrase, "a emporté 2 objets du comptoir de Rhode");
  assertEquals(l.ecart, "il y a 5 min");
  assertEquals(l.instant.toISOString(), T);
});

// ════════════════════════════════════════════════════════════════════
//  Ce que la maquette `390:3386` ajoute : une étiquette de catégorie
//  et un signe, sous chaque phrase.
// ════════════════════════════════════════════════════════════════════

Deno.test("« achat » s'écrit BOUTIQUE, pas ACHAT", () => {
  //  Le mot de la maquette, pas le nom de la table : un joueur connaît
  //  la boutique, pas l'énumération SQL qui enregistre ses passages.
  assertEquals(etiquetteDeType("achat"), "BOUTIQUE");
});

Deno.test("et les six types ont tous le leur", () => {
  for (const t of TYPES_DE_VIE) {
    const e = etiquetteDeType(t);
    assertEquals(e.length > 0, true, t);
    //  En capitales DANS LE TEXTE, comme la maquette les écrit : un
    //  `text-transform` seul laisse un lecteur d'écran épeler.
    assertEquals(e, e.toLocaleUpperCase("fr"), t);
  }
});

Deno.test("chaque type a son signe, et aucun n'est vide", () => {
  const vus = new Set<string>();
  for (const t of TYPES_DE_VIE) {
    const s = signeDeType(t);
    assertEquals(s.length > 0, true, t);
    vus.add(s);
  }
  //  SIX SIGNES DIFFÉRENTS. Deux catégories au même signe se liraient
  //  comme une seule, et on ne s'en apercevrait qu'en comparant deux
  //  lignes éloignées.
  assertEquals(vus.size, TYPES_DE_VIE.length);
});

Deno.test("LE TYPE ARRIVE JUSQU'À L'AFFICHAGE", () => {
  //  Sans lui, l'encart ne peut écrire ni l'étiquette ni le signe — et
  //  c'est le genre de champ qu'on oublie de faire voyager.
  const lignes = vieDeRhode(
    [{ type: "capture", pseudo: "Orion", detail: {}, arrive_le: "2026-10-08T12:00:00Z" }],
    new Date("2026-10-08T17:00:00Z"),
  );
  assertEquals(lignes[0]?.type, "capture");
  assertEquals(etiquetteDeType(lignes[0].type), "CAPTURE");
});
