// ════════════════════════════════════════════════════════════════════
//  src/adaptateurs/en-memoire/releve.ts
//
//  Les faux dont la tâche de relève a besoin. Ils remplacent une BASE ou
//  un RÉSEAU — jamais une décision. Aucune règle ici.
// ════════════════════════════════════════════════════════════════════

import type {
  Faune,
  JournalDeReleve,
  SuiviDesForums,
  Verrou,
  ZoneSauvage,
} from "../../application/ports.ts";
import type { EntreeDeTable } from "../../domaine/rencontre.ts";
import type { HeuresDesJoueurs } from "../../application/lire-les-nouveaux-messages.ts";

export class FauneEnMemoire implements Faune {
  constructor(private readonly zones: readonly ZoneSauvage[]) {}

  zonesSauvages(): Promise<readonly ZoneSauvage[]> {
    return Promise.resolve(this.zones);
  }

  lieuxDe(_forumId: number): Promise<readonly string[]> {
    return Promise.resolve([]);
  }

  conditionsDe(_forumId: number, _lieu: string): Promise<readonly string[]> {
    return Promise.resolve([]);
  }

  tableDe(
    _forumId: number,
    _lieu: string,
    _condition: string,
  ): Promise<readonly EntreeDeTable[]> {
    return Promise.resolve([]);
  }
}

export class SuiviEnMemoire implements SuiviDesForums {
  readonly curseurs = new Map<number, number>();
  /** Les avancements demandés, dans l'ordre : c'est ainsi qu'un test
   *  vérifie que le curseur n'a PAS bougé après un incident. */
  readonly avances: { forumId: number; messageId: number }[] = [];

  constructor(depart: ReadonlyMap<number, number> = new Map()) {
    for (const [f, c] of depart) this.curseurs.set(f, c);
  }

  dernierMessageLu(forumId: number): Promise<number> {
    return Promise.resolve(this.curseurs.get(forumId) ?? 0);
  }

  avancer(forumId: number, messageId: number): Promise<void> {
    this.avances.push({ forumId, messageId });
    // `Math.max`, comme la vraie : un passage en retard ne fait pas reculer.
    this.curseurs.set(forumId, Math.max(this.curseurs.get(forumId) ?? 0, messageId));
    return Promise.resolve();
  }
}

export class JournalEnMemoire implements JournalDeReleve {
  readonly lignes: { tache: string; traites: number; erreurs: readonly string[] }[] = [];
  #dernier: Date | null = null;

  dernierPassage(_tache?: string): Promise<Date | null> {
    return Promise.resolve(this.#dernier === null ? null : new Date(this.#dernier.getTime()));
  }

  noter(tache: string, traites: number, erreurs: readonly string[]): Promise<void> {
    this.lignes.push({ tache, traites, erreurs: [...erreurs] });
    this.#dernier = new Date();
    return Promise.resolve();
  }
}

export class VerrouEnMemoire implements Verrou {
  readonly pris = new Set<string>();

  prendre(nom: string, _secondes: number): Promise<boolean> {
    if (this.pris.has(nom)) return Promise.resolve(false);
    this.pris.add(nom);
    return Promise.resolve(true);
  }

  rendre(nom: string): Promise<void> {
    this.pris.delete(nom);
    return Promise.resolve();
  }
}

/** L'heure locale des joueurs, figée.
 *
 *  Le vrai adaptateur lit `joueur.fuseau` et laisse Postgres convertir
 *  (migration 0009). Ici on pose l'heure directement : ce qu'un test de
 *  cas d'usage veut vérifier, c'est que le jour et la nuit changent la
 *  table de rencontre, pas que `Europe/Paris` existe. */
export class HeuresEnMemoire implements HeuresDesJoueurs {
  constructor(
    private readonly parDefaut = 14,
    private readonly parJoueur = new Map<string, number>(),
  ) {}

  poser(joueurId: string, heure: number): this {
    this.parJoueur.set(joueurId, heure);
    return this;
  }

  heureLocaleDe(joueurId: string): Promise<number> {
    return Promise.resolve(this.parJoueur.get(joueurId) ?? this.parDefaut);
  }
}
