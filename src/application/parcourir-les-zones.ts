// ════════════════════════════════════════════════════════════════════
//  src/application/parcourir-les-zones.ts
//
//  La tâche « les clôtures » de la relève (planche 45, tâche 2).
//
//  Elle parcourt les dix-sept zones sauvages, repère les sujets qui ont
//  bougé depuis le dernier passage, y cherche les demandes de clôture, et
//  confie chacune à `CloturerUnSujet`.
//
//  DEUX RÈGLES DE SÛRETÉ, et ce sont elles qui justifient ce fichier.
//
//  1 · **Une tâche qui échoue n'en bloque pas les autres.** Un sujet dont
//      la page est illisible ne doit pas empêcher les quinze autres de se
//      clôturer. Chaque sujet, et chaque zone, est donc isolé.
//
//  2 · **Le curseur n'avance que si la zone s'est passée sans incident.**
//      L'avancer après un échec perdrait la demande pour toujours : le
//      joueur aurait cliqué, et plus rien ne se serait produit. Ne pas
//      l'avancer fait relire des sujets déjà traités au passage suivant —
//      ce qui est sans danger, parce que `CloturerUnSujet` commence par
//      demander si le sujet est déjà clos et répond « déjà close » sans
//      rien poster. **L'idempotence de la clôture est ce qui rend cette
//      prudence gratuite.**
// ════════════════════════════════════════════════════════════════════

import type {
  EtatDuJeu,
  Faune,
  JournalDeReleve,
  LecteurDeDemandes,
  LecteurDeForum,
  SuiviDesForums,
} from "./ports.ts";
import type { CloturerUnSujet, Resultat } from "./cloturer-un-sujet.ts";

export const TACHE = "clotures";

export type BilanDuPassage = {
  /** Les clôtures menées à bien, refusées comprises : dans les deux cas la
   *  demande a été traitée et le joueur a eu une réponse. */
  readonly traitees: number;
  readonly erreurs: readonly string[];
  /** Le détail, pour le journal et pour les tests. */
  readonly issues: readonly { readonly sujetId: number; readonly issue: Resultat["issue"] }[];
};

function raison(e: unknown): string {
  return e instanceof Error ? `${e.name} : ${e.message}` : String(e);
}

export class ParcourirLesZones {
  constructor(
    private readonly faune: Faune,
    private readonly forum: LecteurDeForum,
    private readonly demandes: LecteurDeDemandes,
    private readonly suivi: SuiviDesForums,
    private readonly jeu: EtatDuJeu,
    private readonly cloturer: CloturerUnSujet,
    private readonly journal: JournalDeReleve,
  ) {}

  async executer(): Promise<BilanDuPassage> {
    const erreurs: string[] = [];
    const issues: { sujetId: number; issue: Resultat["issue"] }[] = [];

    for (const zone of await this.faune.zonesSauvages()) {
      try {
        await this.parcourirUneZone(zone.forumId, zone.nom, erreurs, issues);
      } catch (e) {
        // Une zone injoignable ne doit pas emporter les seize autres.
        erreurs.push(`zone ${zone.nom} (f${zone.forumId}) : ${raison(e)}`);
      }
    }

    const bilan: BilanDuPassage = { traitees: issues.length, erreurs, issues };
    await this.journal.noter(TACHE, bilan.traitees, erreurs);
    return bilan;
  }

  private async parcourirUneZone(
    forumId: number,
    nomDeLaZone: string,
    erreurs: string[],
    issues: { sujetId: number; issue: Resultat["issue"] }[],
  ): Promise<void> {
    const curseur = await this.suivi.dernierMessageLu(forumId);
    const remues = await this.forum.sujetsRemues([forumId]);

    // ── LA RELÈVE NE REMONTE PAS LE TEMPS ──────────────────────────
    //  Au tout premier passage, le curseur vaut zéro : « tout est neuf ».
    //  Sans ce cas, la relève irait lire CHAQUE sujet jamais écrit dans
    //  les dix-sept zones — des centaines de pages — et dépasserait la
    //  durée maximale d'une fonction Edge avant d'avoir rien fait. Pire :
    //  elle clôturerait des sujets clos à la main il y a des mois.
    //
    //  Donc au premier passage on ne lit rien : on pose le curseur à
    //  l'instant présent. La relève s'occupe de ce qui arrive APRÈS son
    //  arrivée, et c'est la seule chose qu'elle puisse honnêtement faire.
    if (curseur === 0) {
      const maintenant = remues.reduce((m, s) => Math.max(m, s.dernierMessageId), 0);
      if (maintenant > 0) await this.suivi.avancer(forumId, maintenant);
      return;
    }

    let plusLoin = curseur;
    let incident = false;

    for (const sujet of remues) {
      if (sujet.dernierMessageId <= curseur) continue;
      try {
        await this.traiterUnSujet(sujet.sujetId, curseur, erreurs, issues);
        plusLoin = Math.max(plusLoin, sujet.dernierMessageId);
      } catch (e) {
        incident = true;
        erreurs.push(`sujet ${sujet.sujetId} (${nomDeLaZone}) : ${raison(e)}`);
      }
    }

    // Voir la règle 2 en tête de fichier : en cas d'incident, on préfère
    // relire que perdre.
    if (!incident && plusLoin > curseur) await this.suivi.avancer(forumId, plusLoin);
  }

  private async traiterUnSujet(
    sujetId: number,
    depuisMessageId: number,
    erreurs: string[],
    issues: { sujetId: number; issue: Resultat["issue"] }[],
  ): Promise<void> {
    for (const demande of await this.demandes.demandesDeCloture(sujetId, depuisMessageId)) {
      const joueurId = await this.jeu.joueurDuCompte(demande.auteurId);
      if (joueurId === null) {
        // Cas normal et non bloquant : quelqu'un sans fiche validée a écrit
        // `[cloture]`. On le signale, on ne clôture pas, et on ne compte
        // pas ça comme une panne de la zone.
        erreurs.push(
          `sujet ${sujetId} : ${demande.auteurPseudo} (compte ${demande.auteurId}) ` +
            `n'est lié à aucun joueur, clôture ignorée`,
        );
        continue;
      }

      const resultat = await this.cloturer.executer({
        sujetId,
        demandeurId: joueurId,
        demandeurPseudo: demande.auteurPseudo,
      });
      issues.push({ sujetId, issue: resultat.issue });
    }
  }
}
