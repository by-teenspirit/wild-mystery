// ════════════════════════════════════════════════════════════════════
//  src/application/ranger-le-pokedex.ts
//  Tâche 7 de la relève : le pokédex.
//
//  ── ZÉRO EST LA BONNE RÉPONSE ───────────────────────────────────────
//
//  Ce n'est pas cette tâche qui remplit le pokédex. `appliquer_cloture`
//  l'écrit dans la transaction de la clôture (migration `0006`), au
//  moment où le sujet se clôt. Donc en régime normal cette tâche ne
//  trouve **rien à corriger**, et c'est le signe que tout va bien.
//
//  Un nombre non nul veut dire qu'une ligne du pokédex est en retard sur
//  le registre. Trois causes possibles, et aucune n'est anodine :
//
//    · une clôture appliquée avant que `appliquer_cloture` n'écrive le
//      pokédex — il y en a, et elles se rattrapent une fois ;
//    · une ligne de registre reprise à la main dans l'éditeur SQL ;
//    · un bogue.
//
//  **On le remonte donc comme un fait notable, pas comme un travail
//  accompli.** Une tâche qui annonce « 312 rangées » à chaque passage
//  n'est pas rassurante, elle est illisible — c'était le cas avant la
//  migration `0012`, qui comptait les lignes touchées plutôt que les
//  lignes changées.
//
//  ── POURQUOI ELLE EXISTE QUAND MÊME ─────────────────────────────────
//
//  Parce que le pokédex est un objectif de complétion, et qu'une
//  incohérence y est invisible : personne ne remarque une espèce
//  manquante dans une liste de 734. La seule façon de la voir est de
//  comparer, et la seule façon de comparer régulièrement est de le faire
//  à chaque passage.
//
//  ── ELLE N'ÉCRIT RIEN SUR LE FORUM ──────────────────────────────────
//
//  Aucun poste, aucun message. Le pokédex se lit sur la page du joueur ;
//  le corriger n'est pas un événement de jeu, c'est de la comptabilité.
// ════════════════════════════════════════════════════════════════════

import type { JournalDeReleve, Pokedex } from "./ports.ts";

export const TACHE = "pokedex";

export type PassageDuPokedex = {
  /** Le nombre de lignes réellement corrigées. **Zéro est attendu.** */
  readonly corrigees: number;
  readonly erreurs: readonly string[];
};

function raison(e: unknown): string {
  return e instanceof Error ? `${e.name} : ${e.message}` : String(e);
}

export class RangerLePokedex {
  constructor(
    private readonly pokedex: Pokedex,
    private readonly journal: JournalDeReleve,
  ) {}

  async executer(): Promise<PassageDuPokedex> {
    let corrigees = 0;
    const erreurs: string[] = [];

    try {
      corrigees = await this.pokedex.ranger();
    } catch (e) {
      //  Une panne ici ne coûte rien d'autre que ce passage : la
      //  fonction est idempotente et le prochain repassera. On ne fait
      //  donc pas échouer la relève entière.
      erreurs.push(`pokédex : ${raison(e)}`);
    }

    await this.journal.noter(TACHE, corrigees, erreurs);
    return { corrigees, erreurs };
  }
}
