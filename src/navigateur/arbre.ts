// ════════════════════════════════════════════════════════════════════
//  L'arbre des paliers — où en est une joueuse sur sa branche.
//
//  « On n'est pas sur des succès, on est vraiment sur des choses à
//  faire pour atteindre le palier 2 puis le palier 3 et obtenir
//  l'accès aux nouvelles zones. » — 26 novembre.
//
//  ── CE QUE LA PREMIÈRE VERSION AVAIT COMPRIS DE TRAVERS ─────────────
//
//  Elle lisait soixante-seize médailles — « posséder 5 pokémon »,
//  « avoir posté 20 RP » — rangées en familles, avec des mesures que la
//  base devait apprendre à compter. C'était un mur de SUCCÈS : ce
//  qu'on a fait, constaté après coup. Une joueuse qui demande « que
//  dois-je faire pour entrer dans les zones de palier 2 ? » n'y
//  trouvait aucune réponse.
//
//  Une branche est maintenant un CHEMIN : des étapes dans l'ordre, et
//  deux portes dessus. Les médailles restent ce qu'elles sont, des
//  récompenses, et elles ne sont plus ici.
//
//  ── UN CHEMIN SE PARCOURT DANS L'ORDRE ──────────────────────────────
//
//  L'avancement d'une joueuse est UN NOMBRE : combien d'étapes de sa
//  branche elle a franchies. Pas un ensemble de cases cochées dans le
//  désordre — c'est ce qui permet de répondre « il t'en reste deux »
//  sans rien calculer, et ce qui empêche de sauter la troisième pour
//  faire la sixième.
//
//  ── LES PORTES NE SONT PAS DES ÉTAPES ───────────────────────────────
//
//  Elles sont posées SUR le chemin, aux mêmes rangs pour les six
//  maisons, et elles ne se franchissent pas : elles s'ouvrent quand
//  l'étape d'avant est faite. Une porte comptée comme une étape
//  décalerait la numérotation de tout ce qui suit, et le dessin
//  dirait autre chose que la liste.
// ════════════════════════════════════════════════════════════════════

/** Ce qui peut remplir une étape. */
export type Genre = "mission" | "palier" | "a-ecrire";

export type Etape = {
  readonly clef: string;
  readonly titre: string;
  readonly texte: string;
  readonly genre: Genre;
  /** Le palier que cette porte ouvre. Les portes seules en ont un. */
  readonly palier?: 2 | 3;
};

export type Branche = {
  readonly clef: string;
  readonly nom: string;
  readonly embleme: string;
  readonly etapes: readonly Etape[];
};

export type Arbre = {
  readonly avantLaPorte: { readonly "2": number; readonly "3": number };
  readonly branches: readonly Branche[];
};

/** L'état d'une étape pour une joueuse. */
export type Etat = "faite" | "en-cours" | "a-venir" | "ouverte" | "fermee";

export type EtapeVue = {
  readonly etape: Etape;
  /** Son rang dans la suite, portes exclues. `null` pour une porte. */
  readonly numero: number | null;
  readonly etat: Etat;
};

/** Les étapes d'une branche, numérotées, portes exclues. */
export function numeroter(b: Branche): { etape: Etape; numero: number | null }[] {
  let n = 0;
  return b.etapes.map((etape) => {
    if (etape.genre === "palier") return { etape, numero: null };
    n += 1;
    return { etape, numero: n };
  });
}

/** Combien d'étapes compte une branche, portes exclues. */
export function combienDEtapes(b: Branche): number {
  return b.etapes.filter((e) => e.genre !== "palier").length;
}

function brancheDe(a: Arbre, clef: string | null): Branche | null {
  return a.branches.find((b) => b.clef === clef) ?? null;
}

/** Le chemin d'une joueuse, étape par étape.
 *
 *  `faites` est le NOMBRE d'étapes franchies, pas une liste : on ne
 *  saute pas une étape, donc un nombre dit tout, et il ne peut pas se
 *  contredire lui-même. */
export function lireLaBranche(b: Branche, faites: number): EtapeVue[] {
  return numeroter(b).map(({ etape, numero }) => {
    if (numero === null) {
      //  UNE PORTE S'OUVRE QUAND CE QUI LA PRÉCÈDE EST FAIT. Elle ne
      //  se franchit pas elle-même.
      const avant = b.etapes.indexOf(etape);
      const requis = b.etapes.slice(0, avant).filter((e) => e.genre !== "palier").length;
      return { etape, numero, etat: faites >= requis ? "ouverte" : "fermee" };
    }
    if (numero <= faites) return { etape, numero, etat: "faite" };
    if (numero === faites + 1) return { etape, numero, etat: "en-cours" };
    return { etape, numero, etat: "a-venir" };
  });
}

/** Le palier qu'une avancée donne. IL NE FAIT PAS FOI : le barème qui
 *  compte est en SQL (migration 0018), et cette fonction est là pour
 *  que l'écran dise la même chose que la base. Deux barèmes qui
 *  divergent, c'est une joueuse à qui l'on promet une zone qui la
 *  refuse. */
export function palierDe(a: Arbre, faites: number): 1 | 2 | 3 {
  if (faites >= a.avantLaPorte["2"] + a.avantLaPorte["3"]) return 3;
  if (faites >= a.avantLaPorte["2"]) return 2;
  return 1;
}

/** Combien d'étapes séparent encore de la porte suivante. `null` au
 *  palier 3, où il n'y a plus rien à annoncer. */
export function ilManque(a: Arbre, faites: number): number | null {
  const palier = palierDe(a, faites);
  if (palier === 3) return null;
  const vise = palier === 1 ? a.avantLaPorte["2"] : a.avantLaPorte["2"] + a.avantLaPorte["3"];
  return vise - faites;
}

/** L'étape à faire maintenant, s'il en reste une. */
export function etapeDuJour(b: Branche, faites: number): Etape | null {
  return lireLaBranche(b, faites).find((v) => v.etat === "en-cours")?.etape ?? null;
}

/** Ce que l'arbre d'une joueuse donne, en un appel. */
export function ouEnEstElle(
  a: Arbre,
  maison: string | null,
  faites: number,
): { branche: Branche | null; chemin: EtapeVue[]; palier: 1 | 2 | 3; reste: number | null } {
  const branche = brancheDe(a, maison);
  return {
    branche,
    chemin: branche === null ? [] : lireLaBranche(branche, faites),
    //  SANS MAISON, PAS DE BRANCHE, DONC PAS DE MONTÉE. Une joueuse
    //  dont le personnage n'est pas encore validé n'a pas de chemin :
    //  lui annoncer un palier 2 atteignable serait une promesse que
    //  rien ne tient.
    palier: branche === null ? 1 : palierDe(a, faites),
    reste: branche === null ? null : ilManque(a, faites),
  };
}

/** Ce que les données ont de cassé. Vide est la réponse attendue :
 *  c'est un contrôle de construction, pas un message de joueuse. */
export function plaintes(a: Arbre): string[] {
  const dits: string[] = [];
  const vues = new Set<string>();
  const attendu = combienDEtapes(a.branches[0] ?? { etapes: [] } as unknown as Branche);
  for (const b of a.branches) {
    for (const e of b.etapes) {
      if (vues.has(e.clef)) dits.push(`deux étapes portent la clef « ${e.clef} »`);
      vues.add(e.clef);
      if (e.genre === "palier" && e.palier === undefined) {
        dits.push(`la porte « ${e.clef} » ne dit pas quel palier elle ouvre`);
      }
      if (e.genre === "mission" && e.titre.trim() === "") {
        dits.push(`la mission « ${e.clef} » n'a pas de texte`);
      }
    }
    //  LES SIX BRANCHES ONT LA MÊME LONGUEUR, et c'est une règle de
    //  jeu, pas une coquetterie : une maison plus courte serait le
    //  chemin rapide, et les cinq autres un détour.
    if (combienDEtapes(b) !== attendu) {
      dits.push(
        `« ${b.clef} » a ${combienDEtapes(b)} étapes là où les autres en ont ${attendu}`,
      );
    }
    const portes = b.etapes.filter((e) => e.genre === "palier").map((e) => e.palier);
    if (portes.join(",") !== "2,3") {
      dits.push(`« ${b.clef} » n'a pas ses deux portes dans l'ordre (${portes.join(",")})`);
    }
  }
  return dits;
}
