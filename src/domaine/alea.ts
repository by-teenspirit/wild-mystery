// ════════════════════════════════════════════════════════════════════
//  src/domaine/alea.ts
//  Le hasard reproductible.
//
//  COUCHE DOMAINE : aucun import, aucun `crypto`, aucune horloge.
//  Deux fois la même graine, deux fois la même suite. C'est ce qui
//  permet au staff de rejouer un tirage contesté des mois plus tard.
// ════════════════════════════════════════════════════════════════════

export class GraineInvalide extends Error {
  constructor(valeur: unknown) {
    super(`Graine invalide : ${String(valeur)}. Attendu un entier non négatif.`);
    this.name = "GraineInvalide";
  }
}

/** Transforme un texte en graine 32 bits. FNV-1a, choisi parce qu'il
 *  tient en six lignes et qu'il n'a pas besoin d'être cryptographique :
 *  la graine est publique, c'est voulu. */
export function graineDepuis(texte: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < texte.length; i++) {
    h ^= texte.charCodeAt(i);
    // h *= 16777619, en arithmétique 32 bits et sans dépasser 2^53
    h = (h + (h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24)) >>> 0;
  }
  return h >>> 0;
}

/** Une suite de nombres dans [0, 1[, reproductible. Mulberry32.
 *  Chaque appel avance d'un cran ; la suite ne boucle pas avant 2^32. */
export function suiteAleatoire(graine: number): () => number {
  if (!Number.isInteger(graine) || graine < 0) throw new GraineInvalide(graine);
  let etat = graine >>> 0;
  return function tirage(): number {
    etat = (etat + 0x6d2b79f5) >>> 0;
    let t = etat;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Un entier entre `min` et `max`, bornes comprises, à partir d'un
 *  tirage dans [0, 1[. */
export function entreBornes(tirage: number, min: number, max: number): number {
  if (!Number.isInteger(min) || !Number.isInteger(max) || min > max) {
    throw new GraineInvalide(`${min}..${max}`);
  }
  if (!(tirage >= 0 && tirage < 1)) throw new GraineInvalide(tirage);
  return min + Math.floor(tirage * (max - min + 1));
}
