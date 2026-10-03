// ════════════════════════════════════════════════════════════════════
//  src/application/poster-les-bilans.ts
//
//  Publier les bilans de clôtures déjà appliquées.
//
//  POURQUOI CETTE TÂCHE EXISTE. Appliquer une clôture et publier son bilan
//  ne sont pas atomiques : entre les deux il y a un forum, un réseau, et
//  un compte dont le mot de passe peut expirer. Le 2 octobre 2026, c'est
//  exactement ce qui est arrivé — un sujet s'est retrouvé clos sans aucun
//  bilan publié, et comme il était clos, plus rien ne réessayait.
//
//  La clôture reste donc le seul point de non-retour. La publication, elle,
//  devient une tâche qu'on repasse jusqu'à ce qu'elle réussisse.
//
//  **Reposter est sans danger**, et ce n'est pas une supposition :
//  l'adaptateur de publication pose un marqueur dans chaque message et,
//  quand un envoi échoue sans réponse, il relit le sujet pour voir si son
//  marqueur y est. Un bilan déjà publié est donc reconnu, pas dupliqué.
// ════════════════════════════════════════════════════════════════════

import type { BilansEnAttente, JournalDeReleve, PosteurSurForum } from "./ports.ts";

export const TACHE = "bilans";

/** Au-delà, on arrête de réessayer en silence : un bilan qui a échoué dix
 *  fois ne passera pas à la onzième sans intervention — sujet verrouillé,
 *  supprimé, ou compte de publication bloqué. Il reste en file, mais il est
 *  signalé à chaque passage pour qu'on le voie. */
export const ESSAIS_AVANT_DE_CRIER = 10;

export type BilanPublie = {
  readonly sujetId: number;
  readonly messageId: number;
};

export type BilanDuPassage = {
  readonly publies: readonly BilanPublie[];
  readonly erreurs: readonly string[];
};

function raison(e: unknown): string {
  return e instanceof Error ? `${e.name} : ${e.message}` : String(e);
}

export class PosterLesBilans {
  constructor(
    private readonly file: BilansEnAttente,
    private readonly forum: PosteurSurForum,
    private readonly journal: JournalDeReleve,
    private readonly combien = 10,
  ) {}

  async executer(): Promise<BilanDuPassage> {
    const publies: BilanPublie[] = [];
    const erreurs: string[] = [];

    for (const bilan of await this.file.aPoster(this.combien)) {
      try {
        const messageId = await this.forum.repondre(
          bilan.sujetId,
          bilan.mentionne,
          bilan.bilan,
          bilan.code,
        );
        await this.file.poste(bilan.sujetId, messageId);
        publies.push({ sujetId: bilan.sujetId, messageId });
      } catch (e) {
        // Un bilan qui ne part pas n'empêche pas les autres de partir :
        // le forum peut refuser un sujet verrouillé et accepter le suivant.
        const essais = await this.file.echoue(bilan.sujetId, raison(e));
        const cri = essais >= ESSAIS_AVANT_DE_CRIER
          ? ` — ${essais} essais, ça ne passera pas tout seul, il faut regarder`
          : "";
        erreurs.push(`bilan du sujet ${bilan.sujetId} : ${raison(e)}${cri}`);
      }
    }

    await this.journal.noter(TACHE, publies.length, erreurs);
    return { publies, erreurs };
  }
}
