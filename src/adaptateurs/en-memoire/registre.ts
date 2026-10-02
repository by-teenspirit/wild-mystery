// ════════════════════════════════════════════════════════════════════
//  src/adaptateurs/en-memoire/registre.ts
//
//  Le faux registre. Il remplace une BASE DE DONNÉES, jamais une
//  DÉCISION : il ne contient aucune règle de jeu. Son seul travail est
//  de garder des lignes et de refuser le doublon, exactement comme
//  l'index unique `(message_id, type)` de Postgres.
//
//  Il est soumis à la même suite de tests que le vrai : src/contrat/.
// ════════════════════════════════════════════════════════════════════

import type { Evenement, LigneRegistre } from "../../domaine/cloture.ts";
import type { Registre } from "../../application/ports.ts";

type Ligne = {
  sujetId: number;
  joueurId: string;
  messageId: number;
  evenement: Evenement;
  code: string;
};

export class RegistreEnMemoire implements Registre {
  readonly #lignes: Ligne[] = [];

  lignesDuSujet(sujetId: number, joueurId: string): Promise<readonly LigneRegistre[]> {
    return Promise.resolve(
      this.#lignes
        .filter((l) => l.sujetId === sujetId && l.joueurId === joueurId)
        .map((l) => ({ messageId: l.messageId, evenement: l.evenement })),
    );
  }

  inscrire(
    sujetId: number,
    joueurId: string,
    messageId: number,
    evenement: Evenement,
    code: string,
  ): Promise<void> {
    // L'unicité est (messageId, type), comme en base : un même message
    // ne produit jamais deux fois le même type d'événement.
    const deja = this.#lignes.some(
      (l) => l.messageId === messageId && l.evenement.type === evenement.type,
    );
    if (!deja) this.#lignes.push({ sujetId, joueurId, messageId, evenement, code });
    return Promise.resolve();
  }

  joueursDuSujet(sujetId: number): Promise<readonly string[]> {
    const vus = new Set<string>();
    for (const l of this.#lignes) if (l.sujetId === sujetId) vus.add(l.joueurId);
    return Promise.resolve([...vus]);
  }

  oublier(sujetId: number): Promise<number> {
    let effacees = 0;
    for (let i = this.#lignes.length - 1; i >= 0; i--) {
      if (this.#lignes[i].sujetId === sujetId) {
        this.#lignes.splice(i, 1);
        effacees++;
      }
    }
    return Promise.resolve(effacees);
  }

  /** Hors contrat : sert aux tests à inspecter ce qui a été gardé. */
  codeDe(messageId: number, type: Evenement["type"]): string | undefined {
    return this.#lignes.find((l) => l.messageId === messageId && l.evenement.type === type)
      ?.code;
  }
}
