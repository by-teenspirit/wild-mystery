// ════════════════════════════════════════════════════════════════════
//  src/navigateur/confort.ts
//
//  Les trois réglages d'accessibilité, et ce que l'encart de
//  notifications a le droit d'afficher. Pur — aucun DOM, aucun réseau.
//
//  ── CINQ RÉGLAGES, ET CHACUN A ÉTÉ DISCUTÉ ──────────────────────────
//
//  Réduire les animations · grossir le texte · aérer le texte ·
//  souligner tous les liens · police pour la dyslexie. Chacun répond à
//  un besoin nommé, chacun se vérifie à l'œil, et chacun tient en une
//  classe sur `body`. La règle d'avant tenait à trois et disait qu'un
//  quatrième se discuterait ; les deux qui arrivent le 8 octobre ont
//  été discutés, et le reste de la règle vaut toujours — un panneau de
//  douze cases que personne ne lit est une case cochée dans un cahier
//  des charges, pas une aide.
//
//  CE QUI N'A PAS ÉTÉ RETENU, et c'est la moitié du travail : les
//  surcouches d'accessibilité qu'on colle en une ligne de script
//  (UserWay, AccessiBe, FACIL'iti). Elles réécrivent le balisage par
//  au-dessus, les associations de personnes aveugles s'y opposent —
//  la NFB a voté une résolution contre l'une d'elles —, et elles
//  cassent régulièrement les lecteurs d'écran qu'elles prétendent
//  servir. Ce qui est ici est fait à la main, se mesure, et se
//  décoche.
//
//  **Ils ne remplacent pas les réglages du système.** `prefers-reduced-
//  motion` continue de valoir ; celui-ci s'ajoute, pour qui n'a pas la
//  main sur son navigateur — un poste partagé, un ordinateur de travail.
//
//  ── ET L'ENCART NE DIT QUE CE QU'IL SAIT ────────────────────────────
//
//  Il n'y a pas de maquette : le plus simple qui ne mente sur rien. Une
//  ligne ne s'affiche que si elle a un nombre à montrer, et l'encart ne
//  s'affiche pas du tout si aucune n'en a. Un bloc flottant « rien de
//  neuf » coûte un coin d'écran pour n'apprendre rien.
// ════════════════════════════════════════════════════════════════════

export const CONFORTS = [
  "animations",
  "texte",
  "espacement",
  "liens",
  "dyslexie",
] as const;

export type Confort = typeof CONFORTS[number];

/** La classe que chaque réglage pose sur `body`. */
export const CLASSE_DE_CONFORT: Readonly<Record<Confort, string>> = {
  animations: "wm-sans-animation",
  texte: "wm-texte-large",
  espacement: "wm-texte-aere",
  liens: "wm-liens-soulignes",
  dyslexie: "wm-police-dyslexie",
};

/** Ce que le bouton annonce. Au présent, et à la première personne du
 *  joueur : il décrit l'état, pas l'action. */
export const LIBELLE_DE_CONFORT: Readonly<Record<Confort, string>> = {
  animations: "Réduire les animations",
  texte: "Grossir le texte",
  //  « Aérer » et pas « augmenter l'interlignage » : le réglage touche
  //  trois espacements à la fois, et c'est le résultat qu'on nomme.
  espacement: "Aérer le texte",
  liens: "Souligner tous les liens",
  dyslexie: "Police pour la dyslexie",
};

export function estUnConfort(v: unknown): v is Confort {
  return typeof v === "string" && (CONFORTS as readonly string[]).includes(v);
}

/** Les réglages actifs, lus d'une chaîne retenue dans le navigateur.
 *
 *  Tolérante : une chaîne vide, un nom inconnu, un doublon, un espace en
 *  trop ne font rien perdre. Le pire cas est un réglage oublié, jamais
 *  une page cassée. */
export function confortsDepuis(brut: unknown): readonly Confort[] {
  if (typeof brut !== "string") return [];
  const vus = new Set<Confort>();
  for (const morceau of brut.split(",")) {
    const m = morceau.trim();
    if (estUnConfort(m)) vus.add(m);
  }
  //  L'ordre de `CONFORTS` et pas celui de la chaîne : l'ordre des
  //  boutons ne doit pas dépendre de l'ordre où on les a cochés.
  return CONFORTS.filter((c) => vus.has(c));
}

/** La chaîne à retenir. L'inverse exact de `confortsDepuis`. */
export function texteDesConforts(actifs: readonly Confort[]): string {
  return CONFORTS.filter((c) => actifs.includes(c)).join(",");
}

/** Coche ou décoche un réglage. */
export function basculerConfort(
  actifs: readonly Confort[],
  lequel: Confort,
): readonly Confort[] {
  return actifs.includes(lequel)
    ? actifs.filter((c) => c !== lequel)
    : CONFORTS.filter((c) => c === lequel || actifs.includes(c));
}

// ── l'encart de notifications ───────────────────────────────────────

export type Compteur = {
  /** Au singulier : « message non lu ». */
  readonly titre: string;
  /** Au pluriel : « messages non lus ».
   *
   *  **Les deux formes sont données, et c'est voulu.** Un pluriel
   *  français ne s'obtient pas en ajoutant un `s` à la fin de la phrase :
   *  « message non lu » devient « messages non lus », avec deux accords.
   *  Un test l'a payé. */
  readonly pluriel: string;
  readonly nombre: number;
  readonly adresse: string;
};

export type Raccourci = {
  readonly titre: string;
  readonly adresse: string;
};

export type Encart = {
  readonly compteurs: readonly Compteur[];
  readonly raccourcis: readonly Raccourci[];
};

const RIEN: Encart = { compteurs: [], raccourcis: [] };

function adresseInterne(v: unknown): string | null {
  const a = typeof v === "string" ? v.trim() : "";
  return /^\/(?!\/)\S*$/.test(a) ? a : null;
}

/**
 * Ce que l'encart affiche, à partir de ce qui a été lu dans la page.
 *
 * **Rien n'est inventé.** Un compteur sans nombre lisible disparaît ; un
 * compteur à zéro disparaît aussi — « 0 message non lu » n'est pas une
 * notification. Et si aucun compteur ne reste, l'encart entier est vide,
 * raccourcis compris : ils accompagnent une nouvelle, ils ne la
 * remplacent pas.
 */
export function encartDepuis(
  compteurs: readonly {
    titre: string;
    pluriel: string;
    nombre: unknown;
    adresse: unknown;
  }[],
  raccourcis: readonly { titre: string; adresse: unknown }[],
): Encart {
  const gardes: Compteur[] = [];
  for (const c of compteurs) {
    const titre = typeof c.titre === "string" ? c.titre.trim() : "";
    const pluriel = typeof c.pluriel === "string" ? c.pluriel.trim() : "";
    const ou = adresseInterne(c.adresse);
    const n = typeof c.nombre === "number" ? c.nombre : Number.NaN;
    if (titre === "" || pluriel === "" || ou === null) continue;
    if (!Number.isInteger(n) || n <= 0) continue;
    gardes.push({ titre, pluriel, nombre: n, adresse: ou });
  }
  if (gardes.length === 0) return RIEN;

  const liens: Raccourci[] = [];
  for (const r of raccourcis) {
    const titre = typeof r.titre === "string" ? r.titre.trim() : "";
    const ou = adresseInterne(r.adresse);
    if (titre !== "" && ou !== null) liens.push({ titre, adresse: ou });
  }
  return { compteurs: gardes, raccourcis: liens };
}

/** « 3 messages non lus », « 1 message non lu ». */
export function phraseDeCompteur(c: Compteur): string {
  return `${c.nombre} ${c.nombre === 1 ? c.titre : c.pluriel}`;
}
