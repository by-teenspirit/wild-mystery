// ════════════════════════════════════════════════════════════════════
//  src/domaine/fossile.ts
//
//  Ce qu'on ramasse de fossile en fouillant, et ce qu'on en fait.
//
//  COUCHE DOMAINE : aucun import hors du domaine, aucune horloge, aucun
//  réseau. Deux fois la même graine, deux fois la même trouvaille.
//
//  ── LA RÈGLE, ET CE QU'ELLE REMPLACE ────────────────────────────────
//
//  Arbitrage de Callista du 7 octobre : **on fouille, et on trouve un
//  fossile entier ou un morceau, n'importe où et n'importe quand.** Trois
//  morceaux d'une même espèce font un fossile entier.
//
//  Ça REMPLACE ce que décrit l'annexe du monde — « trois morceaux de
//  fossile » génériques et un « dé Fossile » qui décidait de l'espèce.
//  C'était le système de la V1. Il n'y a plus de dé : l'espèce est
//  portée par le fossile lui-même, comme dans les jeux, et la
//  correspondance est relevée sur PokéAPI dans `data/fossiles.json`.
//
//  La conséquence est plus grande qu'elle n'en a l'air : un joueur qui
//  ramasse un morceau SAIT ce qu'il prépare. Il peut viser, échanger,
//  raconter. Un dé ne se raconte pas.
//
//  ── LE TIRAGE EST SÉPARÉ DE CELUI DES POKÉDOLLARS ───────────────────
//
//  `fouille.ts` tire déjà sur la graine du message. Rejouer la même
//  suite ici lierait le montant trouvé à la chance d'avoir un fossile :
//  les grosses fouilles donneraient toujours des fossiles, ou jamais.
//
//  On dérive donc une graine fille, `<graine>:fossile`. Elle reste
//  reproductible — c'est tout l'intérêt — mais elle est indépendante.
// ════════════════════════════════════════════════════════════════════

import { entreBornes, graineDepuis, suiteAleatoire } from "./alea.ts";

/** Un fossile : l'objet qu'on ramasse, et l'espèce qu'il rend. */
export type Fossile = {
  /** Identifiant court et stable, celui du dépôt. */
  readonly clef: string;
  /** Le nom de l'objet, en français (PokéAPI). */
  readonly objet: string;
  /** L'identifiant PokéAPI de l'objet. */
  readonly objetId: number;
  /** L'espèce ressuscitée. */
  readonly especeId: number;
  readonly espece: string;
};

/** Ce qu'une fouille rend en plus des Pokédollars.
 *
 *  `null` est le cas NORMAL et de très loin le plus fréquent : l'annexe
 *  du monde dit qu'en zone sauvage « il faudrait être réellement
 *  chanceux ». */
export type TrouvailleDeFossile = {
  readonly genre: "entier" | "morceau";
  readonly fossile: Fossile;
};

/** Les réglages, lus avec la table plutôt que figés ici : ce sont des
 *  nombres de jeu, et ils appartiennent à la donnée. */
export type ReglesDeFossile = {
  readonly morceauxParFossile: number;
  readonly chanceDeMorceau: number;
  readonly chanceDEntier: number;
};

export const REGLES_PAR_DEFAUT: ReglesDeFossile = {
  morceauxParFossile: 3,
  chanceDeMorceau: 0.06,
  chanceDEntier: 0.008,
};

function texte(v: unknown): string {
  return typeof v === "string" ? v.replace(/\s+/g, " ").trim() : "";
}

function entier(v: unknown): number | null {
  return typeof v === "number" && Number.isInteger(v) && v > 0 ? v : null;
}

/** Une part entre 0 et 1, strictement. Une chance de 0 éteindrait la
 *  trouvaille en silence ; une chance de 1 la rendrait certaine. Les deux
 *  sont plus probablement une faute de frappe qu'une intention. */
function part(v: unknown, defaut: number): number {
  return typeof v === "number" && v > 0 && v < 1 ? v : defaut;
}

/**
 * Les fossiles lus dans `data/fossiles.json`, nettoyés.
 *
 * **Rien n'est complété.** Une entrée sans espèce disparaît : un fossile
 * qui ne ressuscite rien est un objet qu'on ramasse et qu'on ne peut pas
 * rendre, donc une promesse en l'air.
 */
export function fossilesDepuis(donnees: unknown): readonly Fossile[] {
  if (typeof donnees !== "object" || donnees === null) return [];
  const liste = (donnees as Record<string, unknown>).fossiles;
  if (!Array.isArray(liste)) return [];

  const vues = new Set<string>();
  const sortie: Fossile[] = [];
  for (const brut of liste) {
    if (typeof brut !== "object" || brut === null) continue;
    const f = brut as Record<string, unknown>;
    const clef = texte(f.clef);
    const objet = texte(f.objet);
    const espece = texte(f.espece);
    const objetId = entier(f.objetId);
    const especeId = entier(f.especeId);
    if (clef === "" || objet === "" || espece === "") continue;
    if (objetId === null || especeId === null) continue;
    //  Deux fossiles de même clef se marcheraient dessus dans le sac.
    if (vues.has(clef)) continue;
    vues.add(clef);
    sortie.push({ clef, objet, objetId, espece, especeId });
  }
  return sortie;
}

/** Les réglages lus avec la table, avec repli sur les valeurs par
 *  défaut. */
export function reglesDepuis(donnees: unknown): ReglesDeFossile {
  if (typeof donnees !== "object" || donnees === null) return REGLES_PAR_DEFAUT;
  const d = donnees as Record<string, unknown>;
  const m = entier(d.morceauxParFossile);
  return {
    //  Au moins deux : « un morceau par fossile » voudrait dire qu'il n'y
    //  a pas de morceaux du tout.
    morceauxParFossile: m !== null && m >= 2 ? m : REGLES_PAR_DEFAUT.morceauxParFossile,
    chanceDeMorceau: part(d.chanceDeMorceau, REGLES_PAR_DEFAUT.chanceDeMorceau),
    chanceDEntier: part(d.chanceDEntier, REGLES_PAR_DEFAUT.chanceDEntier),
  };
}

/**
 * Le fossile — ou le morceau — qu'une fouille donne, ou `null`.
 *
 * `graine` est le numéro du message, comme pour les Pokédollars : même
 * message, même trouvaille, pour toujours.
 *
 * **L'entier est tiré AVANT le morceau**, et c'est l'ordre qui compte :
 * l'inverse rendrait la chance d'un entier inatteignable dès que celle
 * d'un morceau la dépasse.
 */
export function fossileDeLaFouille(
  graine: number,
  fossiles: readonly Fossile[],
  regles: ReglesDeFossile = REGLES_PAR_DEFAUT,
): TrouvailleDeFossile | null {
  if (fossiles.length === 0) return null;

  const suite = suiteAleatoire(graineDepuis(`${graine}:fossile`));
  const sort = suite();
  const genre: "entier" | "morceau" | null = sort < regles.chanceDEntier
    ? "entier"
    : sort < regles.chanceDEntier + regles.chanceDeMorceau
    ? "morceau"
    : null;
  if (genre === null) return null;

  //  Un second tirage pour l'espèce : réutiliser `sort`, qui est déjà
  //  borné par la rareté, donnerait toujours les mêmes fossiles.
  const i = entreBornes(suite(), 0, fossiles.length - 1);
  return { genre, fossile: fossiles[i] };
}

/** Ce que des morceaux donnent : des fossiles entiers, et un reste.
 *
 *  Le reste est rendu, il ne disparaît pas : un joueur qui a deux
 *  morceaux les garde, et sa fouille suivante peut compléter. */
export function assembler(
  morceaux: number,
  regles: ReglesDeFossile = REGLES_PAR_DEFAUT,
): { readonly entiers: number; readonly reste: number } {
  if (!Number.isInteger(morceaux) || morceaux <= 0) return { entiers: 0, reste: 0 };
  const par = regles.morceauxParFossile;
  return { entiers: Math.floor(morceaux / par), reste: morceaux % par };
}
