// ════════════════════════════════════════════════════════════════════
//  src/adaptateurs/faune/types.ts
//
//  La table d'efficacité des dix-huit types, lue dans `data/types.json`.
//
//  ── POURQUOI UN FICHIER ET PAS UNE TABLE SQL ────────────────────────
//
//  Elle ne change jamais. Dix-huit types et cent vingt paires non
//  neutres, dérivées des CSV de PokéAPI une fois pour toutes par
//  `outils/types-efficacite.py`. Une table en base demanderait une
//  migration, un seed, et une jointure à chaque tour de combat — pour
//  une donnée qui n'a pas bougé depuis la sixième génération.
//
//  Elle est lue comme les tables de faune : par le réseau côté fonction
//  Edge, depuis le même dépôt servi par jsDelivr.
//
//  ── CE QU'ON VÉRIFIE AU CHARGEMENT ──────────────────────────────────
//
//  Qu'elle est bien là, et que ses facteurs sont des nombres. Pas
//  davantage : le garde-fou n° 37 vérifie déjà les dix-huit types, les
//  trois valeurs possibles, et qu'aucune espèce ne porte un type absent
//  de la table. Refaire ce travail ici le ferait à chaque passage, et
//  celui qui pourrait le corriger n'en lirait jamais la trace.
//
//  MAIS UNE TABLE VIDE CASSE ICI, et c'est le seul contrôle qui compte
//  à l'exécution : `domaine/combat.ts` lève sur un type inconnu, donc
//  une table vide ferait échouer CHAQUE tour de combat avec un message
//  qui parle du type et pas du fichier. Mieux vaut le dire une fois, au
//  chargement.
// ════════════════════════════════════════════════════════════════════

import type { TableDesTypesEnJeu } from "../../application/ports.ts";
import type { LecteurDeTexte } from "./fichiers.ts";

const FICHIER = "data/types.json";

export class TableDesTypesIllisible extends Error {
  constructor(detail: string) {
    super(`${FICHIER} : ${detail}`);
    this.name = "TableDesTypesIllisible";
  }
}

type Efficacite = Readonly<Record<string, Readonly<Record<string, number>>>>;

export function tableDepuis(texte: string): Efficacite {
  let brut: unknown;
  try {
    brut = JSON.parse(texte);
  } catch (e) {
    throw new TableDesTypesIllisible(`JSON invalide (${(e as Error).message})`);
  }
  if (brut === null || typeof brut !== "object") {
    throw new TableDesTypesIllisible("la racine n'est pas un objet");
  }
  const eff = (brut as Record<string, unknown>).efficacite;
  if (eff === null || typeof eff !== "object") {
    throw new TableDesTypesIllisible("pas de clé « efficacite »");
  }

  const sortie: Record<string, Record<string, number>> = {};
  for (const [attaque, ligne] of Object.entries(eff as Record<string, unknown>)) {
    if (ligne === null || typeof ligne !== "object") {
      throw new TableDesTypesIllisible(`la ligne « ${attaque} » n'est pas un objet`);
    }
    const propre: Record<string, number> = {};
    for (const [defense, facteur] of Object.entries(ligne as Record<string, unknown>)) {
      if (typeof facteur !== "number" || !Number.isFinite(facteur) || facteur < 0) {
        throw new TableDesTypesIllisible(
          `${attaque} → ${defense} : facteur illisible (${JSON.stringify(facteur)})`,
        );
      }
      propre[defense] = facteur;
    }
    sortie[attaque] = propre;
  }

  //  UNE TABLE VIDE FERAIT ÉCHOUER CHAQUE TOUR, avec un message qui
  //  parlerait du type et pas du fichier. On le dit ici, une fois.
  if (Object.keys(sortie).length === 0) {
    throw new TableDesTypesIllisible("aucune paire : le combat ne pourrait rien résoudre");
  }
  return sortie;
}

/** La table, lue une fois et gardée : le fichier ne change pas en cours
 *  de passage, et le relire à chaque tour ferait un appel réseau par
 *  message pour la même réponse. */
export class TableDesTypesEnFichier implements TableDesTypesEnJeu {
  #lue: Promise<Efficacite> | null = null;

  constructor(
    private readonly lire: LecteurDeTexte,
    private readonly racine = "",
  ) {}

  efficacite(): Promise<Efficacite> {
    //  La promesse est gardée, pas son résultat : deux tours dans le
    //  même passage ne lancent qu'une lecture.
    if (this.#lue === null) {
      this.#lue = this.lire(this.racine + FICHIER).then(tableDepuis);
    }
    return this.#lue;
  }
}
