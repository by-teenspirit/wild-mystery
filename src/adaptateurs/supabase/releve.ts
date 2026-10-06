// ════════════════════════════════════════════════════════════════════
//  src/adaptateurs/supabase/releve.ts
//
//  Le verrou, le journal, la mémoire du dernier message lu, et le
//  rangement du pokédex — tout ce qui sert à la relève elle-même plutôt
//  qu'au jeu.
//
//  Une précaution qui mérite d'être lue : **prendre le verrou est un seul
//  ordre SQL.** Un `select` suivi d'un `insert` laisserait une fenêtre où
//  deux passages se croisent, et deux passages qui se croisent clôturent
//  deux fois le même sujet. Tout est donc dans `releve_prendre_le_verrou`,
//  et cet adaptateur ne fait que l'appeler.
// ════════════════════════════════════════════════════════════════════

import type {
  JournalDeReleve,
  Pokedex,
  SuiviDesForums,
  Verrou,
} from "../../application/ports.ts";
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

// ── le pokédex ──────────────────────────────────────────────────────

/** `pokedex_ranger` (migration `0012`).
 *
 *  LE COMPTE EST RELU, pas tenu pour acquis : il ne sert qu'à être
 *  journalisé, mais un `undefined` journalisé donnerait une ligne de
 *  journal muette au moment où on viendrait justement y chercher un
 *  chiffre. Même raison que dans `supabase/boutique.ts`.
 *
 *  **Avant la migration `0012`, cette fonction comptait les lignes
 *  TOUCHÉES**, donc elle rendait toujours le nombre de paires
 *  (joueur, espèce) du registre — un chiffre qui ne voulait rien dire.
 *  Elle compte maintenant les lignes CHANGÉES, et zéro est la réponse
 *  attendue. */
export class PokedexSupabase implements Pokedex {
  constructor(private readonly appeler: AppelSql) {}

  async ranger(): Promise<number> {
    const nom = "pokedex_ranger";
    const recu = await this.appeler(nom, {});
    const corrigees = (recu as { corrigees?: unknown } | null)?.corrigees;
    if (typeof corrigees !== "number" || !Number.isInteger(corrigees) || corrigees < 0) {
      throw new AppelEchoue(
        nom,
        `entier positif ou nul attendu, reçu ${JSON.stringify(recu)}`,
      );
    }
    return corrigees;
  }
}
