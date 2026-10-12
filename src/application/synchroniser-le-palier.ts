// ════════════════════════════════════════════════════════════════════
//  src/application/synchroniser-le-palier.ts
//  Tâche 6 de la relève : le palier suit les badges.
//
//  ── CE QU'ELLE DÉBLOQUE, ET C'EST TOUT L'INTÉRÊT ────────────────────
//
//  Le palier n'est pas un ornement : **c'est lui qui ouvre les zones**.
//  `data/zones.json` donne un palier minimum par zone — palier 2 à trois
//  badges, palier 3 à sept (planche 39) — et c'est `joueur.palier` qui
//  est comparé quand une action est tentée.
//
//  Sans cette tâche, un badge posé en base ne change rien. La joueuse a
//  gagné son troisième badge, elle le voit sur sa fiche, et les zones de
//  palier 2 lui refusent toujours l'entrée. **Et rien, nulle part, ne le
//  dirait** : il n'y a pas de message d'erreur pour « votre palier n'a
//  pas été recalculé », il y a juste une action qui ne marche pas.
//
//  ── LE RANG FORUMACTIF N'EST PAS ICI, ET CE N'EST PAS UN OUBLI ──────
//
//  La planche 50 nomme cette tâche « le rang Forumactif suit le
//  palier ». La moitié forum ne se fait pas d'ici : un rang se change
//  dans le panneau d'administration, dont les adresses portent un jeton
//  de session — la relève n'y entre pas, et personne ne lui donnera le
//  mot de passe d'une administratrice.
//
//  Alors on sépare ce qui est la RÈGLE de ce qui est l'AFFICHAGE. Le
//  palier de la base est la règle, et elle est tenue ici. Le rang
//  affiché est de l'affichage, et il reste une action de staff — à
//  laquelle cette tâche donne ce qu'il faut : la liste nominative de ce
//  qui a changé, dans sa réponse et dans son journal.
//
//  C'est le même arbitrage que pour le reçu de boutique, en sens
//  inverse : là, on poste parce qu'un sujet de comptoir n'a pas de scène
//  à protéger ; ici, on ne poste pas, parce qu'un changement de palier
//  n'est pas un événement de jeu et que personne n'a dit où l'annoncer.
//
//  ── ELLE N'ÉCRIT RIEN SUR LE FORUM ──────────────────────────────────
//
//  Aucun message. Si un jour on veut l'annoncer, il faudra décider où —
//  et ce sera un sujet de staff, pas un sujet de RP.
// ════════════════════════════════════════════════════════════════════

import type { ChangementDePalier, JournalDeReleve, Paliers } from "./ports.ts";

export const TACHE = "palier";

export type PassageDuPalier = {
  /** Ce qui a changé, nominativement. La liste vide est la réponse
   *  ordinaire : les badges ne tombent pas toutes les cinq minutes. */
  readonly changements: readonly ChangementDePalier[];
  readonly erreurs: readonly string[];
};

function raison(e: unknown): string {
  return e instanceof Error ? `${e.name} : ${e.message}` : String(e);
}

export class SynchroniserLePalier {
  constructor(
    private readonly paliers: Paliers,
    private readonly journal: JournalDeReleve,
  ) {}

  async executer(): Promise<PassageDuPalier> {
    let changements: readonly ChangementDePalier[] = [];
    const erreurs: string[] = [];

    try {
      changements = await this.paliers.appliquer();
    } catch (e) {
      //  Une panne ici ne coûte que ce passage : la fonction SQL est
      //  idempotente — elle n'écrit que les lignes qui diffèrent —, donc
      //  le prochain passage rattrape. On ne fait pas échouer la relève
      //  entière pour un recalcul manqué.
      erreurs.push(`palier : ${raison(e)}`);
    }

    await this.journal.noter(TACHE, changements.length, erreurs);
    return { changements, erreurs };
  }
}
