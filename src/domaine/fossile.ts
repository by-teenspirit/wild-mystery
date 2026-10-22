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
//  ── CE FICHIER NE DÉCIDE PLUS S'IL Y A UN FOSSILE ───────────────────
//
//  Depuis le 15 octobre, c'est `fouille.ts` qui tranche : une fouille,
//  un tirage, cinq issues qui s'excluent — bredouille, fossile entier,
//  morceau, objet, Pokédollars. Les deux chances ont donc quitté ce
//  fichier et `ReglesDeFossile` : elles sont dans la table de butin,
//  qui porte TOUS les taux d'une fouille, et une part qui vit à deux
//  endroits finit par y valoir deux choses.
//
//  Ici reste la seule question que les fossiles savent trancher :
//  **LEQUEL des onze**. Avec une graine fille, `<graine>:fossile`, parce
//  que réutiliser la suite de la fouille ferait sortir toujours le même
//  fossile au même endroit de la tranche.
// ════════════════════════════════════════════════════════════════════

import { entreBornes, graineDepuis, suiteAleatoire } from "./alea.ts";

/** Un fossile : l'objet qu'on ramasse, son morceau, et l'espèce qu'il
 *  rend.
 *
 *  DEUX JEUX D'IDENTIFIANTS, ET IL NE FAUT PAS LES CONFONDRE. `id` et
 *  `morceauId` sont ceux de la table `objet` — ceux qui s'écrivent dans
 *  un sac et dans une ligne de registre. L'identifiant PokéAPI ne sert
 *  qu'à dire d'où vient la ligne, et il n'entre donc pas ici : le
 *  domaine n'a rien à en faire. */
export type Fossile = {
  /** Identifiant court et stable, celui du dépôt. */
  readonly clef: string;
  /** Le nom de l'objet, en français (PokéAPI). */
  readonly objet: string;
  /** L'objet « fossile entier », dans la table `objet`. */
  readonly id: number;
  /** L'objet « morceau », un par espèce. */
  readonly morceauId: number;
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
  /** L'objet à mettre dans le sac : le fossile ou son morceau, selon le
   *  genre. Il est résolu ICI et pas chez l'appelant — c'est la seule
   *  façon qu'un `genre` et un `objetId` ne puissent pas se
   *  contredire. */
  readonly objetId: number;
};

/** Les réglages, lus avec la table plutôt que figés ici : ce sont des
 *  nombres de jeu, et ils appartiennent à la donnée.
 *
 *  IL Y EN AVAIT TROIS JUSQU'AU 15 OCTOBRE. `chanceDeMorceau` et
 *  `chanceDEntier` sont parties dans la table de butin, avec les trois
 *  autres taux d'une fouille : c'est là qu'elles se lisent les unes
 *  contre les autres. `data/fossiles.json` les porte toujours — c'est
 *  là que Callista les règle — et `outils/butin.py` les y lit pour
 *  écrire la table. Une part, une source. */
export type ReglesDeFossile = {
  readonly morceauxParFossile: number;
};

export const REGLES_PAR_DEFAUT: ReglesDeFossile = {
  morceauxParFossile: 3,
};

function texte(v: unknown): string {
  return typeof v === "string" ? v.replace(/\s+/g, " ").trim() : "";
}

function entier(v: unknown): number | null {
  return typeof v === "number" && Number.isInteger(v) && v > 0 ? v : null;
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
    const id = entier(f.id);
    const morceauId = entier(f.morceauId);
    const especeId = entier(f.especeId);
    if (clef === "" || objet === "" || espece === "") continue;
    if (id === null || morceauId === null || especeId === null) continue;
    //  UN FOSSILE QUI SERAIT SON PROPRE MORCEAU ferait boucler
    //  l'assemblage : trois morceaux retirés pour en rendre un, et ainsi
    //  de suite. La base le refuse aussi (migration 0016) ; on ne compte
    //  pas sur elle pour s'en apercevoir.
    if (id === morceauId) continue;
    //  Deux fossiles de même clef se marcheraient dessus dans le sac.
    if (vues.has(clef)) continue;
    vues.add(clef);
    sortie.push({ clef, objet, id, morceauId, espece, especeId });
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
  };
}

/**
 * LEQUEL des fossiles, une fois que la fouille a décidé qu'il y en a un.
 *
 * `graine` est le numéro du message, comme pour le reste : même message,
 * même fossile, pour toujours. `entier` vient de `fouiller` — c'est elle
 * qui a tiré la tranche.
 *
 * Rend `null` sur une table vide : un fichier de fossiles illisible ne
 * doit pas arrêter la relève, et l'appelant nomme déjà ce cas.
 */
export function quelFossile(
  graine: number,
  fossiles: readonly Fossile[],
  entier: boolean,
): TrouvailleDeFossile | null {
  if (fossiles.length === 0) return null;

  //  LA GRAINE FILLE : `<graine>:fossile`. La fouille a déjà consommé sa
  //  propre suite pour choisir la tranche ; repartir de la même ici
  //  ferait dépendre l'espèce de la position dans la tranche, donc les
  //  fossiles entiers et les morceaux ne seraient pas les mêmes espèces.
  const suite = suiteAleatoire(graineDepuis(`${graine}:fossile`));
  const fossile = fossiles[entreBornes(suite(), 0, fossiles.length - 1)];
  return {
    genre: entier ? "entier" : "morceau",
    fossile,
    objetId: entier ? fossile.id : fossile.morceauId,
  };
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
