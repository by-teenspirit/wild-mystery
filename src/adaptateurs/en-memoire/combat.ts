// ════════════════════════════════════════════════════════════════════
//  src/adaptateurs/en-memoire/combat.ts
//
//  Les combats, en mémoire, pour les tests.
//
//  IL TIENT LES DEUX RÈGLES DE LA BASE, et ce n'est pas du zèle : un
//  double qui accepterait deux combats dans un sujet laisserait passer
//  un cas d'usage qui échoue en vrai, et le test dirait le contraire de
//  la production.
//
//  · un seul combat par message — la relève relit
//  · un seul combat ouvert par sujet — deux joueurs ne se marchent pas
//    dessus
// ════════════════════════════════════════════════════════════════════

import type { Combats, OuvertureDeCombat } from "../../application/ports.ts";

export type CombatEnMemoire = {
  readonly combatId: string;
  readonly sujetId: number;
  readonly messageId: number;
  readonly joueurId: string;
  readonly especeId: number;
  readonly niveau: number;
  etat: "ouvert" | "capture" | "fuite" | "victoire" | "defaite" | "expire";
};

export class CombatsEnMemoire implements Combats {
  readonly ouverts: CombatEnMemoire[] = [];
  private suivant = 1;

  ouvrir(c: {
    readonly sujetId: number;
    readonly messageId: number;
    readonly joueurId: string;
    readonly especeId: number;
    readonly niveau: number;
  }): Promise<OuvertureDeCombat> {
    const deja = this.ouverts.find((x) => x.messageId === c.messageId);
    if (deja !== undefined) {
      return Promise.resolve({
        combatId: deja.combatId,
        ouvert: false,
        raison: "DEJA_LU",
      });
    }
    const encours = this.ouverts.find(
      (x) => x.sujetId === c.sujetId && x.etat === "ouvert",
    );
    if (encours !== undefined) {
      return Promise.resolve({
        combatId: encours.combatId,
        ouvert: false,
        raison: "COMBAT_EN_COURS",
      });
    }
    const combatId = `combat-${this.suivant++}`;
    this.ouverts.push({ ...c, combatId, etat: "ouvert" });
    return Promise.resolve({ combatId, ouvert: true, raison: null });
  }

  /** Pour poser le décor d'un test : le combat se termine, le sujet est
   *  libre. */
  fermer(messageId: number, etat: CombatEnMemoire["etat"] = "capture"): void {
    const c = this.ouverts.find((x) => x.messageId === messageId);
    if (c !== undefined) c.etat = etat;
  }
}

/** Un ouvreur qui tombe en panne, pour le test qui compte.
 *
 *  Une ouverture qui échoue ne doit pas emporter la ligne du registre ni
 *  les actions suivantes : le joueur d'après n'a rien fait de mal. */
export class CombatsEnPanne implements Combats {
  constructor(private readonly motif = "base injoignable") {}

  ouvrir(): Promise<OuvertureDeCombat> {
    return Promise.reject(new Error(this.motif));
  }
}
