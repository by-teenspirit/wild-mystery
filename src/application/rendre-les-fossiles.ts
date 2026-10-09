// ════════════════════════════════════════════════════════════════════
//  src/application/rendre-les-fossiles.ts
//  Tâche 5 de la relève : le laboratoire.
//
//  Les analyses qui attendent une réponse sont tranchées par la base,
//  et chacune reçoit son message. Ce fichier ORCHESTRE : il ne décide
//  ni de l'espèce, ni du refus — `rendre_fossile` le fait et le garde.
//
//  ── AUCUN RÉGLAGE, ET C'EST LE POINT ────────────────────────────────
//
//  Pas de `Comptoir`, pas de curseur, pas de `data/laboratoires.json` :
//  chaque analyse porte son `sujetId` depuis `0017`, donc la réponse
//  part là où la demande a été faite. Un second laboratoire — un stand
//  d'évent, un PNJ de passage — ne demande pas une ligne de code.
//
//  C'est `PosterLesBilans` et pas `ServirUneCommande`.
//
//  ── UNE ANNONCE QUI NE PART PAS N'ARRÊTE RIEN ───────────────────────
//
//  Contrairement à la boutique, qui s'arrête au premier reçu manqué.
//  La différence est la même qu'entre `PosterLesBilans` et elle : les
//  commandes sont ORDONNÉES par un curseur, et avancer par-dessus un
//  trou perdrait le reçu du trou pour toujours. Ici chaque analyse a son
//  propre état en base — `annonce_le is null` EST la file —, donc le
//  forum peut refuser un sujet verrouillé et accepter le suivant.
//
//  Et reposter est sans danger : `rendre_fossile` est idempotente depuis
//  `0017`, et l'adaptateur de publication reconnaît son marqueur si le
//  message était en fait passé.
//
//  ── UNE ANALYSE IMPOSSIBLE NE BLOQUE PAS LA FILE ────────────────────
//
//  `impossible` veut dire qu'aucune espèce n'est rattachée à ce fossile :
//  **notre donnée qui manque**, pas la faute du joueur. L'analyse reste
//  donc en attente pour toujours — c'est voulu, elle repartira le jour où
//  la ligne existera.
//
//  Conséquence : on ne lui écrit RIEN. Lui répondre « impossible » à
//  chaque passage lui enverrait un message toutes les cinq minutes pour
//  un défaut qui n'est pas le sien. On passe à la suivante, et on le dit
//  dans le journal — où Callista le verra, à chaque passage, jusqu'à ce
//  que la ligne soit écrite. C'est le signal le plus fort qu'on puisse
//  donner sans réveiller le joueur.
//
//  ELLE OCCUPE SA PLACE DANS LA LIMITE, et c'est le prix assumé : à dix
//  analyses impossibles au même moment, le passage ne ferait plus rien
//  d'autre. Il crierait dix fois par passage, ce qui se remarque
//  nettement plus qu'une file qui avance.
// ════════════════════════════════════════════════════════════════════

import { redigerLaResurrection, redigerLeRefusDeFossile } from "./resurrection.ts";
import type { Fossiles, JournalDeReleve, PosteurSurForum } from "./ports.ts";

export const TACHE = "fossiles";

/** Au-delà, on arrête de réessayer en silence. Même seuil et même raison
 *  que `PosterLesBilans` : une annonce qui a échoué dix fois ne passera
 *  pas à la onzième sans intervention. */
export const ESSAIS_AVANT_DE_CRIER = 10;

export type FossileRendu = {
  readonly analyseId: string;
  readonly pseudo: string;
  readonly espece: string;
  /** Vrai si la base n'a fait que rejouer son verdict : on n'a reposté
   *  que l'annonce. Compté à part, sinon une coupure réseau gonflerait
   *  le nombre de réanimations du journal. */
  readonly deja: boolean;
};

export type FossileRefuse = {
  readonly analyseId: string;
  readonly pseudo: string;
  readonly motif: string;
};

export type PassageDeLaboratoire = {
  readonly rendus: readonly FossileRendu[];
  readonly refuses: readonly FossileRefuse[];
  /** Les analyses qu'on ne peut pas trancher faute de donnée. Rendues à
   *  part des erreurs parce qu'elles ne sont pas une panne : elles
   *  attendent une ligne de `fossile_espece`. */
  readonly bloquees: readonly string[];
  readonly erreurs: readonly string[];
};

function raison(e: unknown): string {
  return e instanceof Error ? `${e.name} : ${e.message}` : String(e);
}

export class RendreLesFossiles {
  constructor(
    private readonly fossiles: Fossiles,
    private readonly forum: PosteurSurForum,
    private readonly journal: JournalDeReleve,
    private readonly combien = 10,
  ) {}

  async executer(): Promise<PassageDeLaboratoire> {
    const rendus: FossileRendu[] = [];
    const refuses: FossileRefuse[] = [];
    const bloquees: string[] = [];
    const erreurs: string[] = [];

    for (const analyse of await this.fossiles.aAnnoncer(this.combien)) {
      const { analyseId, pseudo, fossile, sujetId, code } = analyse;

      let verdict;
      try {
        verdict = await this.fossiles.rendre(analyseId);
      } catch (e) {
        //  La base n'a pas répondu, ou l'analyse a disparu. Rien n'est
        //  perdu — elle reste en file —, et l'analyse suivante n'a
        //  aucune raison d'échouer pour la même cause.
        erreurs.push(`analyse ${analyseId} (${pseudo}) : ${raison(e)}`);
        continue;
      }

      if (verdict.etat === "impossible") {
        //  Voir l'en-tête : on n'écrit rien au joueur, et on le dit ici.
        bloquees.push(analyseId);
        erreurs.push(
          `analyse ${analyseId} (${pseudo}, ${fossile}) : ${verdict.motif} — ` +
            `${verdict.detail} Il manque une ligne dans « fossile_espece ». ` +
            "Le joueur n'a rien perdu et n'est pas prévenu : sa demande " +
            "repartira toute seule.",
        );
        continue;
      }

      const corps = verdict.etat === "rendue"
        ? redigerLaResurrection({ pseudo, fossile, espece: verdict.espece }, code)
        : redigerLeRefusDeFossile(pseudo, fossile, verdict.detail, code);

      try {
        const messageId = await this.forum.repondre(sujetId, pseudo, corps, code);
        //  SI C'EST `annoncee` QUI ÉCHOUE, le message est parti et
        //  l'analyse reste en file. Le passage suivant rejoue le même
        //  verdict, l'adaptateur retrouve son marqueur dans le sujet et
        //  rend l'identifiant du message déjà posté sans en publier un
        //  second, et `annoncee` repasse. Rien à prévoir de plus.
        await this.fossiles.annoncee(analyseId, messageId);
      } catch (e) {
        const essais = await this.fossiles.echouee(analyseId, raison(e));
        const cri = essais >= ESSAIS_AVANT_DE_CRIER
          ? ` — ${essais} essais, ça ne passera pas tout seul, il faut regarder`
          : "";
        erreurs.push(`annonce de l'analyse ${analyseId} : ${raison(e)}${cri}`);
        continue;
      }

      if (verdict.etat === "rendue") {
        rendus.push({ analyseId, pseudo, espece: verdict.espece, deja: verdict.deja });
      } else {
        refuses.push({ analyseId, pseudo, motif: verdict.motif });
      }
    }

    await this.journal.noter(TACHE, rendus.length + refuses.length, erreurs);
    return { rendus, refuses, bloquees, erreurs };
  }
}
