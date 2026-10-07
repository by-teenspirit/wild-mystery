// ════════════════════════════════════════════════════════════════════
//  src/domaine/rencontre.ts
//  Le tirage d'une rencontre en zone sauvage.
//
//  COUCHE DOMAINE : fonctions pures. On donne une table et une graine,
//  on rend une rencontre. Même graine, même rencontre, pour toujours.
//
//  La table vient de data/faune.json, lui-même issu de
//  tables_rencontre.csv : 298 tables (zone × sous-lieu × météo), dont
//  les pourcentages font exactement 100 dans les 298 cas.
// ════════════════════════════════════════════════════════════════════

import { entreBornes, graineDepuis, suiteAleatoire } from "./alea.ts";

export type Rarete = "commun" | "peu commun" | "rare";

export type EntreeDeTable = {
  readonly especeId: number;
  readonly pourcentage: number;
  readonly niveauMin: number;
  readonly niveauMax: number;
  readonly rarete: Rarete;
};

export type Rencontre = {
  readonly especeId: number;
  readonly niveau: number;
  readonly rarete: Rarete;
};

export class TableInvalide extends Error {
  constructor(raison: string) {
    super(`Table de rencontre invalide : ${raison}`);
    this.name = "TableInvalide";
  }
}

/** Tolérance sur la somme des pourcentages. Les tables sont écrites à
 *  la main, on accepte un millième d'écart, pas davantage. */
const TOLERANCE = 0.001;

/** Vérifie qu'une table est jouable, et dit pourquoi elle ne l'est pas.
 *
 *  Exportée pour que l'adaptateur qui charge les fichiers de faune puisse
 *  refuser une table dès le chargement, au lieu d'attendre le premier
 *  tirage — et sans réécrire la règle de son côté. C'est le domaine qui
 *  juge, dans les deux cas. */
export function verifieTable(table: readonly EntreeDeTable[]): void {
  if (table.length === 0) throw new TableInvalide("elle est vide");

  let total = 0;
  for (const e of table) {
    if (!(e.pourcentage > 0)) {
      throw new TableInvalide(`espèce ${e.especeId} à ${e.pourcentage} %`);
    }
    if (!Number.isInteger(e.niveauMin) || !Number.isInteger(e.niveauMax)) {
      throw new TableInvalide(`espèce ${e.especeId} : niveaux non entiers`);
    }
    if (e.niveauMin < 1 || e.niveauMax > 100 || e.niveauMin > e.niveauMax) {
      throw new TableInvalide(`espèce ${e.especeId} : niveaux ${e.niveauMin}..${e.niveauMax}`);
    }
    total += e.pourcentage;
  }
  if (Math.abs(total - 100) > TOLERANCE) {
    throw new TableInvalide(`les pourcentages font ${total}, pas 100`);
  }
}

/**
 * Tire une rencontre dans une table.
 *
 * Le tirage se fait en deux temps, dans cet ordre, et l'ordre compte :
 * d'abord l'espèce selon les pourcentages, ensuite le niveau dans
 * l'intervalle de cette espèce. Inverser les deux donnerait des
 * résultats différents pour la même graine.
 *
 * La graine est publique : elle est faite de l'identifiant du message
 * et du lieu. C'est ce qui permet de rejouer un tirage contesté.
 */
export function tirerUneRencontre(
  table: readonly EntreeDeTable[],
  graine: string,
): Rencontre {
  verifieTable(table);

  const tirage = suiteAleatoire(graineDepuis(graine));

  // On avance dans les pourcentages cumulés et on s'arrête dès qu'on
  // dépasse la cible. La dernière entrée est atteinte naturellement en
  // sortie de boucle : pas de cas par défaut, donc pas de branche morte.
  const cible = tirage() * 100;
  let cumul = 0;
  let choisie = table[0];
  for (const e of table) {
    cumul += e.pourcentage;
    choisie = e;
    if (cible < cumul) break;
  }

  return {
    especeId: choisie.especeId,
    niveau: entreBornes(tirage(), choisie.niveauMin, choisie.niveauMax),
    rarete: choisie.rarete,
  };
}

/** Le détail du tirage, pour le journal et pour l'arbitrage du staff.
 *  On garde la graine en clair : elle ne vaut rien à cacher, et elle
 *  vaut beaucoup à pouvoir recopier dans un sujet de litige. */
export type TirageTrace = {
  readonly graine: string;
  readonly rencontre: Rencontre;
};

export function tirerEtTracer(
  table: readonly EntreeDeTable[],
  graine: string,
): TirageTrace {
  return { graine, rencontre: tirerUneRencontre(table, graine) };
}
