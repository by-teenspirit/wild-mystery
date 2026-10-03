// ════════════════════════════════════════════════════════════════════
//  src/adaptateurs/supabase/jeu.ts
//
//  L'état du jeu et le catalogue, lus dans la base.
//
//  Comme partout dans cette couche : aucune règle, seulement de la
//  traduction — et un refus net quand ce qui revient n'a pas la forme
//  attendue. Un état mal lu ne doit pas devenir un sac vide, parce qu'un
//  sac vide ferait refuser une clôture pourtant valable.
// ════════════════════════════════════════════════════════════════════

import type { EtatDuJoueur } from "../../domaine/cloture.ts";
import type { Catalogue, EtatDuJeu } from "../../application/ports.ts";
import type { HeuresDesJoueurs } from "../../application/lire-les-nouveaux-messages.ts";
import { AppelEchoue, type AppelSql } from "./appel.ts";

function objet(fonction: string, recu: unknown): Record<string, unknown> {
  if (typeof recu !== "object" || recu === null || Array.isArray(recu)) {
    throw new AppelEchoue(fonction, `objet attendu, reçu ${JSON.stringify(recu)}`);
  }
  return recu as Record<string, unknown>;
}

function entier(fonction: string, valeur: unknown, quoi: string): number {
  if (typeof valeur !== "number" || !Number.isInteger(valeur)) {
    throw new AppelEchoue(fonction, `${quoi} : entier attendu, reçu ${JSON.stringify(valeur)}`);
  }
  return valeur;
}

export class EtatDuJeuSupabase implements EtatDuJeu {
  constructor(private readonly appeler: AppelSql) {}

  async etatDe(joueurId: string): Promise<EtatDuJoueur> {
    const nom = "etat_du_joueur";
    const recu = objet(nom, await this.appeler(nom, { joueurId }));

    if (!Array.isArray(recu.sac)) {
      throw new AppelEchoue(nom, `sac : tableau attendu, reçu ${JSON.stringify(recu.sac)}`);
    }
    const sac = new Map<number, number>();
    for (const brut of recu.sac) {
      const ligne = objet(nom, brut);
      sac.set(
        entier(nom, ligne.objetId, "objetId"),
        entier(nom, ligne.quantite, "quantite"),
      );
    }

    return {
      sac,
      placesEnBoite: entier(nom, recu.placesEnBoite, "placesEnBoite"),
      pokedollars: entier(nom, recu.pokedollars, "pokedollars"),
    };
  }

  async pseudoDe(joueurId: string): Promise<string> {
    const nom = "pseudo_du_joueur";
    const recu = objet(nom, await this.appeler(nom, { joueurId }));
    if (typeof recu.pseudo !== "string" || recu.pseudo === "") {
      throw new AppelEchoue(nom, `pseudo introuvable pour ${joueurId}`);
    }
    return recu.pseudo;
  }

  async joueurDuCompte(forumUserId: number): Promise<string | null> {
    const nom = "joueur_du_compte";
    const recu = objet(nom, await this.appeler(nom, { forumUserId }));
    const id = recu.joueurId;
    // null est un cas NORMAL : quelqu'un peut poster dans une zone sauvage
    // sans fiche validée, donc sans être lié.
    if (id === null || id === undefined) return null;
    if (typeof id !== "string" || id === "") {
      throw new AppelEchoue(
        nom,
        `joueurId : texte ou null attendu, reçu ${JSON.stringify(id)}`,
      );
    }
    return id;
  }

  async estClos(sujetId: number): Promise<boolean> {
    const nom = "cloture_deja";
    const recu = await this.appeler(nom, { sujetId });
    if (typeof recu !== "boolean") {
      throw new AppelEchoue(nom, `booléen attendu, reçu ${JSON.stringify(recu)}`);
    }
    return recu;
  }
}

export class CatalogueSupabase implements Catalogue {
  constructor(private readonly appeler: AppelSql) {}

  private async nom(fonction: string, argument: unknown): Promise<string> {
    const recu = objet(fonction, await this.appeler(fonction, argument));
    if (typeof recu.nom !== "string" || recu.nom === "") {
      throw new AppelEchoue(fonction, `nom : texte attendu, reçu ${JSON.stringify(recu.nom)}`);
    }
    return recu.nom;
  }

  nomObjet(objetId: number): Promise<string> {
    return this.nom("catalogue_nom_objet", { objetId });
  }

  nomEspece(especeId: number): Promise<string> {
    return this.nom("catalogue_nom_espece", { especeId });
  }
}

/**
 * L'heure locale d'un joueur.
 *
 * C'est Postgres qui convertit, pas nous : `heure_locale_du_joueur` lit
 * `joueur.fuseau` et applique `now() at time zone`. Refaire ce calcul ici
 * voudrait dire embarquer une base de fuseaux horaires dans une fonction
 * Edge et la tenir à jour — alors que Postgres en a déjà une, à jour, et
 * qu'elle a validé le fuseau à l'écriture (migration 0009).
 *
 * **La fonction rend bien 0 à 23**, et on le vérifie quand même : une
 * heure hors bornes ferait croire au domaine qu'il fait nuit à midi, et
 * le joueur croiserait des Pokémon nocturnes sans comprendre pourquoi.
 */
export class HeuresSupabase implements HeuresDesJoueurs {
  constructor(private readonly appeler: AppelSql) {}

  async heureLocaleDe(joueurId: string): Promise<number> {
    const nom = "heure_locale_du_joueur";
    const recu = await this.appeler(nom, { joueurId });
    const heure = entier(nom, recu, "heure");
    if (heure < 0 || heure > 23) {
      throw new AppelEchoue(nom, `heure hors bornes pour ${joueurId} : ${heure}`);
    }
    return heure;
  }
}
