// ════════════════════════════════════════════════════════════════════
//  src/adaptateurs/supabase/releve.ts
//
//  Le verrou, le journal, et la mémoire du dernier message lu.
//
//  Une précaution qui mérite d'être lue : **prendre le verrou est un seul
//  ordre SQL.** Un `select` suivi d'un `insert` laisserait une fenêtre où
//  deux passages se croisent, et deux passages qui se croisent clôturent
//  deux fois le même sujet. Tout est donc dans `releve_prendre_le_verrou`,
//  et cet adaptateur ne fait que l'appeler.
// ════════════════════════════════════════════════════════════════════

import type { JournalDeReleve, SuiviDesForums, Verrou } from "../../application/ports.ts";
import { AppelEchoue, type AppelSql } from "./appel.ts";

export class VerrouSupabase implements Verrou {
  constructor(private readonly appeler: AppelSql) {}

  async prendre(nom: string, secondes: number): Promise<boolean> {
    const pris = await this.appeler("releve_prendre_le_verrou", { nom, secondes });
    if (typeof pris !== "boolean") {
      throw new AppelEchoue("releve_prendre_le_verrou", `booléen attendu, reçu ${pris}`);
    }
    return pris;
  }

  async rendre(nom: string): Promise<void> {
    await this.appeler("releve_rendre_le_verrou", { nom });
  }
}

export class JournalSupabase implements JournalDeReleve {
  constructor(private readonly appeler: AppelSql) {}

  async dernierPassage(tache?: string): Promise<Date | null> {
    const nom = "releve_dernier_passage";
    const recu = await this.appeler(nom, { tache: tache ?? null });
    if (typeof recu !== "object" || recu === null || Array.isArray(recu)) {
      throw new AppelEchoue(nom, `objet attendu, reçu ${JSON.stringify(recu)}`);
    }
    const quand = (recu as Record<string, unknown>).passeLe;
    if (quand === null || quand === undefined) return null;
    if (typeof quand !== "string") {
      throw new AppelEchoue(
        nom,
        `passeLe : texte ou null attendu, reçu ${JSON.stringify(quand)}`,
      );
    }
    const date = new Date(quand);
    if (Number.isNaN(date.getTime())) {
      throw new AppelEchoue(nom, `date illisible : ${quand}`);
    }
    return date;
  }

  async noter(tache: string, traites: number, erreurs: readonly string[]): Promise<void> {
    await this.appeler("releve_noter", {
      tache,
      traites,
      // `null` et pas `[]` : une ligne sans erreur doit se lire d'un coup
      // d'œil dans la table, et `[]` ressemble à « on n'a pas regardé ».
      erreurs: erreurs.length === 0 ? null : erreurs,
    });
  }
}

export class SuiviSupabase implements SuiviDesForums {
  constructor(private readonly appeler: AppelSql) {}

  async dernierMessageLu(forumId: number): Promise<number> {
    const nom = "releve_suivi";
    const recu = await this.appeler(nom, { forumId });
    if (typeof recu !== "object" || recu === null) {
      throw new AppelEchoue(nom, `objet attendu, reçu ${JSON.stringify(recu)}`);
    }
    const dernier = (recu as Record<string, unknown>).dernierMessage;
    if (typeof dernier !== "number" || !Number.isInteger(dernier) || dernier < 0) {
      throw new AppelEchoue(nom, `dernierMessage illisible : ${JSON.stringify(dernier)}`);
    }
    return dernier;
  }

  async avancer(forumId: number, messageId: number): Promise<void> {
    await this.appeler("releve_avancer", { forumId, dernierMessage: messageId });
  }
}
