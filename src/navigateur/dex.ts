// ════════════════════════════════════════════════════════════════════
//  src/navigateur/dex.ts — l'ordre des espèces, partout le même
//
//  « Pourquoi l'ordre et l'id des pokémons n'est pas le même que dans
//  le dépôt que je t'ai donné ou comme dans l'ordre des vrais
//  pokémons ? » (4 novembre)
//
//  Les identifiants étaient justes — Bulbizarre 1, Pikachu 25, et
//  10115 pour Ossatueur d'Alola, qui est la convention de PokéAPI pour
//  les formes régionales. C'est l'ORDRE qui manquait : il y en avait
//  trois selon l'endroit, et aucun n'était l'ordre national.
//
//  ── L'ORDRE RETENU ────────────────────────────────────────────────
//
//  Ordre national, et chaque forme régionale juste après l'espèce
//  qu'elle décline : Ossatueur, Ossatueur d'Alola, Hypotrempe. Trier
//  par identifiant seul rejetterait les 54 formes à la fin, en vrac,
//  à mille numéros de l'espèce dont elles sont une variante.
//
//  La clé est donc un COUPLE : l'espèce de base d'abord, l'identifiant
//  ensuite. L'espèce de base vient de `data/ordre-du-dex.json`, où un
//  identifiant absent est sa propre base.
// ════════════════════════════════════════════════════════════════════

/** `{ "10115": 105 }` — la forme et l'espèce qu'elle décline. */
export type BasesDeForme = Readonly<Record<string, number>>;

/** L'espèce dont `id` est une variante, ou `id` lui-même. */
export function baseDe(id: number, bases: BasesDeForme): number {
  const b = bases[String(id)];
  return typeof b === "number" && Number.isFinite(b) ? b : id;
}

/**
 * Compare deux espèces dans l'ordre du dex.
 *
 * Négatif si `a` passe avant `b`, comme l'attend `Array.sort`.
 */
export function comparerDansLeDex(a: number, b: number, bases: BasesDeForme): number {
  const ba = baseDe(a, bases);
  const bb = baseDe(b, bases);
  //  L'identifiant départage DANS une espèce : la forme d'Alola (10115)
  //  passe après l'espèce ordinaire (105), et deux formes de la même
  //  espèce restent dans l'ordre où PokéAPI les numérote.
  return ba !== bb ? ba - bb : a - b;
}

/**
 * Range une liste quelconque par l'ordre du dex, sans la modifier.
 *
 * `identifiant` dit où lire l'espèce dans un élément : les tables de
 * faune, les fiches du carnet et les lignes du Pokédex ne portent pas
 * le même champ, et c'est le seul point commun qu'on leur demande.
 */
export function rangerDansLeDex<T>(
  elements: readonly T[],
  identifiant: (e: T) => number,
  bases: BasesDeForme,
): T[] {
  return [...elements].sort((x, y) => comparerDansLeDex(identifiant(x), identifiant(y), bases));
}

/** Les bases telles qu'on les lit dans `data/ordre-du-dex.json`. */
export function basesDepuis(donnees: unknown): BasesDeForme {
  if (donnees === null || typeof donnees !== "object") return {};
  const brut = (donnees as Record<string, unknown>).base;
  if (brut === null || typeof brut !== "object") return {};
  const net: Record<string, number> = {};
  for (const [clef, valeur] of Object.entries(brut as Record<string, unknown>)) {
    //  UNE BASE QUI EST ELLE-MÊME UNE FORME FERAIT BOUCLER le tri sur
    //  une donnée abîmée. On la refuse ici plutôt que de la propager.
    if (typeof valeur === "number" && Number.isFinite(valeur) && valeur <= 10000) {
      net[clef] = valeur;
    }
  }
  return net;
}
