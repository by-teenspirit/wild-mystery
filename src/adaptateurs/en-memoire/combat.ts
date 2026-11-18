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

import type {
  CombatEnCours,
  Combats,
  OuvertureDeCombat,
  TourJoue,
} from "../../application/ports.ts";

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
  /** Les tours écrits, pour qu'un test les relise. */
  readonly joues: Parameters<Combats["jouer"]>[0][] = [];
  /** Ce que `jouer` répondra. Par défaut : joué.
   *
   *  C'est un champ et pas un paramètre parce que les refus qui
   *  comptent — `DEJA_JOUE`, `COMBAT_CLOS`, `TOUR_DEPASSE` — viennent
   *  de l'état de la base et pas de l'appel, et qu'un test doit pouvoir
   *  les poser sans reconstruire une base. */
  reponseDeJouer: TourJoue = { tourId: "t-memoire", joue: true, raison: null };
  #etat: CombatEnCours | null = null;
  private suivant = 1;

  /** Pose l'état que `pourJouer` rendra.
   *
   *  LE DOUBLE NE FABRIQUE PAS CET ÉTAT TOUT SEUL, et c'est un choix :
   *  il faudrait qu'il connaisse les trois chiffres au niveau, les
   *  quatre capacités et la formule — c'est-à-dire qu'il refasse la
   *  base. Un double qui calcule finit par calculer autrement, et le
   *  test dirait le contraire de la production. Le test pose donc
   *  l'état qu'il veut jouer. */
  poserLEtat(e: CombatEnCours | null): this {
    this.#etat = e;
    return this;
  }

  pourJouer(): Promise<CombatEnCours | null> {
    return Promise.resolve(this.#etat);
  }

  jouer(t: Parameters<Combats["jouer"]>[0]): Promise<TourJoue> {
    this.joues.push(t);
    return Promise.resolve(this.reponseDeJouer);
  }

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

  /** Les sujets dont la carte a été redemandée, dans l'ordre.
   *
   *  UN TABLEAU ET PAS UN BOOLÉEN : un test doit pouvoir vérifier
   *  qu'on ne rappelle pas deux fois la même carte, et un drapeau ne
   *  le dirait pas. */
  readonly rappels: number[] = [];

  rappelerLaCarte(sujetId: number): Promise<boolean> {
    //  LA MÊME RÈGLE QUE LA BASE : seulement un combat ouvert. Un faux
    //  qui dirait oui sans combat laisserait passer un appel que
    //  PostgreSQL refuse.
    const ouvert = this.ouverts.some((c) => c.sujetId === sujetId && c.etat === "ouvert");
    if (ouvert) this.rappels.push(sujetId);
    return Promise.resolve(ouvert);
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

  pourJouer(): Promise<CombatEnCours | null> {
    return Promise.reject(new Error(this.motif));
  }

  jouer(): Promise<TourJoue> {
    return Promise.reject(new Error(this.motif));
  }

  rappelerLaCarte(): Promise<boolean> {
    return Promise.reject(new Error(this.motif));
  }
}
