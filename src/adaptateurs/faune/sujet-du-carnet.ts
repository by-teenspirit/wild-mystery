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

export function sujetDepuis(texte: string, quoi = FICHIER): number | null {
  let lu: unknown;
  try {
    lu = JSON.parse(texte);
  } catch {
    throw new Error(`${quoi} : JSON illisible.`);
  }
  if (typeof lu !== "object" || lu === null) throw new Error(`${quoi} : objet attendu.`);
  const sujet = (lu as { sujet?: unknown }).sujet;
  if (sujet === null || sujet === undefined) return null;
  if (typeof sujet !== "number" || !Number.isInteger(sujet) || sujet <= 0) {
    throw new Error(`${quoi} : « sujet » doit être un entier positif ou null.`);
  }
  return sujet;
}

export class SujetDuCarnetEnFichier {
  #lu: number | null | undefined = undefined;

  constructor(
    private readonly lire: LecteurDeTexte,
    private readonly racine = "",
  ) {}

  async sujet(): Promise<number | null> {
    if (this.#lu === undefined) {
      this.#lu = sujetDepuis(await this.lire(this.racine + FICHIER), FICHIER);
    }
    return this.#lu;
  }
}
