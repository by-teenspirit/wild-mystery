// ════════════════════════════════════════════════════════════════════
//  src/adaptateurs/supabase/evenement.ts
//
//  La traduction entre l'événement du domaine et les deux colonnes de
//  la base (`type` et `charge`).
//
//  C'est le point le plus bête du projet et l'un des plus dangereux :
//  une clé mal orthographiée ici ne casse rien, elle fait juste
//  disparaître une capture. Alors deux précautions, et les tests qui
//  vont avec :
//
//  1. le trajet est vérifié dans les DEUX sens, pour les six variantes ;
//  2. une charge incomplète au retour **lève** au lieu de rendre un
//     événement à moitié rempli. Une ligne de registre illisible est un
//     bogue à voir, pas un zéro à verser.
// ════════════════════════════════════════════════════════════════════

import type { Evenement } from "../../domaine/cloture.ts";

export class LigneIllisible extends Error {
  constructor(type: string, charge: unknown) {
    super(`Ligne de registre illisible — type « ${type} », charge ${JSON.stringify(charge)}.`);
    this.name = "LigneIllisible";
  }
}

export type Colonnes = {
  readonly type: Evenement["type"];
  readonly charge: Record<string, number | string>;
};

/** L'événement, découpé en ses deux colonnes. Le `switch` est exhaustif
 *  sur le type de l'union : ajouter une variante au domaine sans la
 *  traiter ici ne compile pas. */
export function versColonnes(evenement: Evenement): Colonnes {
  switch (evenement.type) {
    case "croise":
      return { type: "croise", charge: { especeId: evenement.especeId } };
    case "capture":
      return {
        type: "capture",
        charge: { especeId: evenement.especeId, niveau: evenement.niveau },
      };
    case "xp":
      return { type: "xp", charge: { pokemonId: evenement.pokemonId, gain: evenement.gain } };
    case "objet_utilise":
      return {
        type: "objet_utilise",
        charge: { objetId: evenement.objetId, quantite: evenement.quantite },
      };
    case "objet_trouve":
      return {
        type: "objet_trouve",
        charge: { objetId: evenement.objetId, quantite: evenement.quantite },
      };
    case "pokedollars":
      return { type: "pokedollars", charge: { montant: evenement.montant } };
  }
}

function nombre(charge: Record<string, unknown>, cle: string, type: string): number {
  const v = charge[cle];
  if (typeof v !== "number" || !Number.isFinite(v)) throw new LigneIllisible(type, charge);
  return v;
}

function texte(charge: Record<string, unknown>, cle: string, type: string): string {
  const v = charge[cle];
  if (typeof v !== "string" || v === "") throw new LigneIllisible(type, charge);
  return v;
}

/** L'événement reconstruit depuis la base. Le type inconnu lève : une
 *  variante ajoutée à l'enum SQL sans l'être au domaine doit se voir. */
export function depuisColonnes(type: string, charge: unknown): Evenement {
  if (typeof charge !== "object" || charge === null || Array.isArray(charge)) {
    throw new LigneIllisible(type, charge);
  }
  const c = charge as Record<string, unknown>;
  switch (type) {
    case "croise":
      return { type, especeId: nombre(c, "especeId", type) };
    case "capture":
      return {
        type,
        especeId: nombre(c, "especeId", type),
        niveau: nombre(c, "niveau", type),
      };
    case "xp":
      return { type, pokemonId: texte(c, "pokemonId", type), gain: nombre(c, "gain", type) };
    case "objet_utilise":
    case "objet_trouve":
      return {
        type,
        objetId: nombre(c, "objetId", type),
        quantite: nombre(c, "quantite", type),
      };
    case "pokedollars":
      return { type, montant: nombre(c, "montant", type) };
    default:
      throw new LigneIllisible(type, charge);
  }
}
