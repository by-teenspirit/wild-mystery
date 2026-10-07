// ════════════════════════════════════════════════════════════════════
//  src/adaptateurs/faune/fossiles.ts
//
//  La table des fossiles, lue dans `data/fossiles.json`.
//
//  MÊME DOSSIER, MÊME RAISON QUE `comptoirs.ts` : c'est de la
//  configuration de jeu qui vit dans le dépôt, servie par GitHub Pages,
//  et qui change par un `git push` plutôt que par un déploiement. Le
//  jour où Callista tranche la règle des quatre fossiles de la 8G, elle
//  ajoute quatre lignes au JSON — pas une migration.
//
//  ── POURQUOI PAS LA BASE, QUI A DÉJÀ LA TABLE ───────────────────────
//
//  `fossile_espece` et `fossile_morceau` existent, et elles sont
//  dérivées de ce même fichier par `outils/fossiles.py`. Les lire ici
//  demanderait une requête de plus par passage de relève pour obtenir
//  exactement la même réponse, et surtout ça ne donnerait PAS les trois
//  nombres de rareté, qui ne sont pas en base.
//
//  Le fichier est donc la source, la base en est la copie dont elle a
//  besoin pour ressusciter — et le garde-fou n° 13 vérifie que les deux
//  disent la même chose.
//
//  ── ON REFUSE PLUTÔT QUE DE DEVINER, SAUF ICI ───────────────────────
//
//  Et c'est la différence avec `comptoirs.ts`, qui lève. Le domaine
//  (`fossilesDepuis`) écarte en silence les lignes bancales et rend une
//  liste vide quand le fichier est illisible, parce qu'une fouille sans
//  fossile est un résultat NORMAL — c'est même le cas le plus fréquent.
//
//  Un refus bruyant ici arrêterait la lecture d'un sujet entier pour une
//  virgule dans un fichier de rareté, et un joueur perdrait ses
//  Pokédollars pour un fossile qu'il n'aurait de toute façon pas trouvé.
//
//  MAIS UNE TABLE VIDE EST DITE. `fossiles()` ne masque pas le cas : la
//  liste vide remonte telle quelle, le domaine rend `null`, et le
//  garde-fou refuse de laisser passer un dépôt dont la table est vide.
// ════════════════════════════════════════════════════════════════════

import type { Fossile, ReglesDeFossile } from "../../domaine/fossile.ts";
import { fossilesDepuis, REGLES_PAR_DEFAUT, reglesDepuis } from "../../domaine/fossile.ts";
import type { TableDesFossiles } from "../../application/ports.ts";
import type { LecteurDeTexte } from "./fichiers.ts";

const FICHIER = "data/fossiles.json";

/** Relit le fichier. Exportée pour être testée sans réseau.
 *
 *  LE JSON ILLISIBLE NE LÈVE PAS : il rend la table vide et les règles
 *  par défaut. Voir l'en-tête — c'est un choix, pas un oubli. */
export function tableDepuis(
  texte: string,
): { fossiles: readonly Fossile[]; regles: ReglesDeFossile } {
  let brut: unknown;
  try {
    brut = JSON.parse(texte);
  } catch {
    return { fossiles: [], regles: REGLES_PAR_DEFAUT };
  }
  return { fossiles: fossilesDepuis(brut), regles: reglesDepuis(brut) };
}

/** La table, lue une fois et gardée : le fichier ne change pas en cours
 *  de passage, et le relire à chaque fouille ferait un appel réseau par
 *  message pour la même réponse. */
export class FossilesEnFichiers implements TableDesFossiles {
  #lue: Promise<{ fossiles: readonly Fossile[]; regles: ReglesDeFossile }> | null = null;

  constructor(
    private readonly lire: LecteurDeTexte,
    private readonly racine = "",
  ) {}

  /** La promesse est gardée, pas son résultat : deux fouilles dans le
   *  même message ne lancent qu'une lecture. */
  #table(): Promise<{ fossiles: readonly Fossile[]; regles: ReglesDeFossile }> {
    if (this.#lue === null) this.#lue = this.#charger();
    return this.#lue;
  }

  async #charger(): Promise<{ fossiles: readonly Fossile[]; regles: ReglesDeFossile }> {
    try {
      return tableDepuis(await this.lire(this.racine + FICHIER));
    } catch {
      //  LE RÉSEAU QUI TOMBE N'ARRÊTE PAS LA RELÈVE — ni une erreur de
      //  lecture d'une autre sorte. Même raison que le JSON illisible, et
      //  le cas se voit : plus personne ne trouve de fossile, ce qui est
      //  un symptôme autrement plus lisible qu'un passage entier perdu.
      return { fossiles: [], regles: REGLES_PAR_DEFAUT };
    }
  }

  async fossiles(): Promise<readonly Fossile[]> {
    return (await this.#table()).fossiles;
  }

  async regles(): Promise<ReglesDeFossile> {
    return (await this.#table()).regles;
  }
}
