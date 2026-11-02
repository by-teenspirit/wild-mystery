// ════════════════════════════════════════════════════════════════════
//  src/adaptateurs/faune/sujet-du-carnet.ts
//
//  Où les joueurs ouvrent leur carnet, lu dans `data/carnet.json`.
//
//  MÊME FORME QUE `ComptoirsEnFichiers`, et pour la même raison : un
//  identifiant de sujet est une donnée du jeu, pas une constante de
//  code. Le changer ne doit pas demander un déploiement.
//
//  `null` EST UNE VALEUR VALIDE, et c'est le point. Tant que le sujet
//  n'existe pas, la tâche ne lit rien et le note. Lever ici ferait
//  échouer toute la relève — les clôtures, la boutique, les paliers —
//  pour un sujet que personne n'a encore créé.
// ════════════════════════════════════════════════════════════════════

const FICHIER = "carnet.json";

type LecteurDeTexte = (url: string) => Promise<string>;

/** Un entier positif, ou `null`. Partagé par les deux réglages du
 *  fichier : le sujet d'ouverture et le forum des cartes. */
function entierOuNull(lu: unknown, champ: string, quoi: string): number | null {
  const v = (lu as Record<string, unknown>)[champ];
  if (v === null || v === undefined) return null;
  if (typeof v !== "number" || !Number.isInteger(v) || v <= 0) {
    throw new Error(`${quoi} : « ${champ} » doit être un entier positif ou null.`);
  }
  return v;
}

export function sujetDepuis(texte: string, quoi = FICHIER): number | null {
  let lu: unknown;
  try {
    lu = JSON.parse(texte);
  } catch {
    throw new Error(`${quoi} : JSON illisible.`);
  }
  if (typeof lu !== "object" || lu === null) throw new Error(`${quoi} : objet attendu.`);
  return entierOuNull(lu, "sujet", quoi);
}

export function forumDesCartesDepuis(texte: string, quoi = FICHIER): number | null {
  let lu: unknown;
  try {
    lu = JSON.parse(texte);
  } catch {
    throw new Error(`${quoi} : JSON illisible.`);
  }
  if (typeof lu !== "object" || lu === null) throw new Error(`${quoi} : objet attendu.`);
  return entierOuNull(lu, "forumDesCartes", quoi);
}

export class SujetDuCarnetEnFichier {
  #lu: number | null | undefined = undefined;
  #forum: number | null | undefined = undefined;
  #texte: Promise<string> | null = null;

  constructor(
    private readonly lire: LecteurDeTexte,
    private readonly racine = "",
  ) {}

  //  UNE SEULE LECTURE POUR LES DEUX RÉGLAGES : deux tâches les
  //  demandent au même passage, et le fichier n'a pas à partir deux
  //  fois sur le réseau.
  #contenu(): Promise<string> {
    this.#texte ??= this.lire(this.racine + FICHIER);
    return this.#texte;
  }

  async sujet(): Promise<number | null> {
    if (this.#lu === undefined) this.#lu = sujetDepuis(await this.#contenu(), FICHIER);
    return this.#lu;
  }

  async forumDesCartes(): Promise<number | null> {
    if (this.#forum === undefined) {
      this.#forum = forumDesCartesDepuis(await this.#contenu(), FICHIER);
    }
    return this.#forum;
  }
}
