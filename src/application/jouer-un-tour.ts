// ════════════════════════════════════════════════════════════════════
//  src/application/jouer-un-tour.ts
//
//  Un joueur a demandé quelque chose dans un combat. On résout.
//
//  ── CE FICHIER NE CALCULE RIEN ──────────────────────────────────────
//
//  Les dégâts, l'efficacité des types, le dé, la fin du tour : tout est
//  dans `domaine/combat.ts`, pur et testé sans base ni navigateur. Ici
//  on ORCHESTRE — on lit l'état, on appelle le domaine, on écrit le
//  résultat — et on refuse ce qui n'a pas de sens.
//
//  ── CE QU'ON REFUSE, ET POURQUOI CHAQUE REFUS COMPTE ────────────────
//
//  « Taper le bloc à la main ne donne aucun avantage » est écrit en
//  tête de `domaine/action.ts` depuis le 2 octobre. C'est une promesse,
//  et elle se tient ICI : le bloc est du texte dans un message, donc
//  n'importe qui peut écrire `[[WM-ACTION:attaquer:999]]`.
//
//  · pas de combat ouvert sur ce sujet → rien à jouer
//  · le combat n'est pas le sien → planche 99 §5.4, il appartient à
//    celui qui a fait apparaître le Pokémon
//  · la capacité n'est pas une des quatre → refusée, nommément
//  · la case d'équipe est vide, à terre, ou c'est déjà le combattant
//  · un combat sans combattant → on ne frappe pas sans Pokémon
//
//  Chacun de ces refus est DIT dans les erreurs du passage, pas avalé :
//  un joueur dont l'action n'a pas été jouée doit pouvoir l'apprendre
//  autrement qu'en ne voyant rien se passer.
//
//  ── L'EXPÉRIENCE PASSE PAR LE REGISTRE, PAS PAR LE COMBAT ───────────
//
//  Les dégâts donnent de l'expérience (« jamais aux mots », 1er
//  octobre), et elle se verse à la CLÔTURE comme tout le reste. Le tour
//  écrit donc une ligne `xp` au registre et ne touche pas au niveau du
//  Pokémon : un combat gagné dans un sujet qui ne se clôt jamais ne
//  doit pas faire monter un Pokémon en douce.
// ════════════════════════════════════════════════════════════════════

import type { Action } from "../domaine/action.ts";
import type { Evenement } from "../domaine/cloture.ts";
import {
  type Capacite,
  type Combattant,
  degatsAuSauvage,
  resoudreUnTour,
  type Tour,
  TOURS_MAX,
} from "../domaine/combat.ts";
import { experienceGagnee } from "../domaine/experience.ts";
import type { ActionLue, CombatEnCours, Combats, TableDesTypesEnJeu } from "./ports.ts";

/** Les trois demandes que ce service honore aujourd'hui.
 *
 *  `ball` et `objet` touchent au sac et viennent après — et comme la
 *  barre ne les propose pas, un bloc qui les porte ne peut venir que
 *  d'une main. On le DIT et on ne joue rien, plutôt que de deviner. */
export const DEMANDES = ["attaquer", "fuir", "changer"] as const;

export type Demande = (typeof DEMANDES)[number];

export function estUneDemandeDeCombat(action: Action): action is Extract<
  Action,
  { readonly type: Demande | "ball" | "objet" }
> {
  return ["attaquer", "fuir", "changer", "ball", "objet"].includes(action.type);
}

/** Le combattant du domaine, depuis l'état lu en base. */
function combattantDe(c: {
  readonly nom: string;
  readonly niveau: number;
  readonly types: readonly string[];
  readonly pv: number;
  readonly pvMax: number;
  readonly attaque: number;
  readonly defense: number;
}): Combattant {
  return {
    nom: c.nom,
    niveau: c.niveau,
    types: c.types,
    pv: c.pv,
    pvMax: c.pvMax,
    attaque: c.attaque,
    defense: c.defense,
  };
}

/** La capacité du domaine, depuis celle lue en base. */
function capaciteDe(c: {
  readonly id: number;
  readonly nom: string;
  readonly type: string;
  readonly puissance: number;
  readonly precision: number;
}): Capacite {
  return {
    id: c.id,
    nom: c.nom,
    type: c.type,
    puissance: c.puissance,
    precision: c.precision,
  };
}

/** LA RIPOSTE DU SAUVAGE : sa capacité la plus forte.
 *
 *  Il n'y a personne pour choisir à sa place, et tirer au sort parmi
 *  les quatre ferait qu'un joueur perdrait ou gagnerait selon un dé de
 *  plus — un dé qu'il ne voit pas et sur lequel il ne peut rien.
 *
 *  La plus forte est le choix LISIBLE : le joueur sait à quoi s'attendre
 *  au deuxième tour, et une mauvaise affiche se perd pour une raison
 *  qu'il peut comprendre. À puissance égale, le plus petit identifiant,
 *  pour que ce soit reproductible. */
export function riposteDe(capacites: readonly Capacite[]): Capacite | null {
  if (capacites.length === 0) return null;
  return [...capacites].sort((a, b) => b.puissance - a.puissance || a.id - b.id)[0];
}

export type Resolution = {
  readonly evenements: readonly Evenement[];
  /** Le tour tel que le domaine l'a rendu, pour qui veut le lire — les
   *  tests, surtout. `null` quand rien n'a été joué. */
  readonly tour: Tour | null;
};

export class JouerUnTour {
  constructor(
    private readonly combats: Combats,
    private readonly types: TableDesTypesEnJeu,
  ) {}

  async executer(
    lue: ActionLue,
    action: Action,
    joueurId: string,
    erreurs: string[],
  ): Promise<Resolution> {
    const rien: Resolution = { evenements: [], tour: null };

    //  LE GARDE QUI SERT AUSSI AU COMPILATEUR. « chercher » et
    //  « fouiller » ne passent jamais par ici — l'appelant les a déjà
    //  traités — mais l'écrire laisse le reste de la méthode parler de
    //  cinq cas au lieu de sept, et c'est le type qui le vérifie.
    if (!estUneDemandeDeCombat(action)) return rien;

    const etat = await this.combats.pourJouer(lue.sujetId);
    if (etat === null) {
      erreurs.push(
        `message ${lue.messageId} : aucun combat ouvert dans ce sujet, ` +
          `« ${action.type} » n'a rien à jouer`,
      );
      return rien;
    }

    //  LE COMBAT APPARTIENT À CELUI QUI A FAIT APPARAÎTRE LE POKÉMON
    //  (planche 99 §5.4). Sans cette règle, dans un sujet à deux, le
    //  second joueur jouerait les tours du premier.
    if (etat.joueurId !== joueurId) {
      erreurs.push(
        `message ${lue.messageId} : ce combat n'est pas le tien, ` +
          `il appartient au joueur qui a fait apparaître le Pokémon`,
      );
      return rien;
    }

    if (action.type === "ball" || action.type === "objet") {
      //  PAS ENCORE HONORÉ, ET DIT COMME TEL. La barre ne propose pas
      //  ce bouton, donc ce bloc vient d'une main — et la promesse de
      //  `action.ts` est que ça ne donne aucun avantage. On ne joue
      //  rien, on ne consomme rien.
      erreurs.push(
        `message ${lue.messageId} : « ${action.type} » n'est pas encore ` +
          `servi par la relève, rien n'a été joué`,
      );
      return rien;
    }

    if (etat.tour >= TOURS_MAX) {
      //  Le cinquième tour a déjà été joué : le sauvage est parti, et
      //  `jouer_un_tour` refuserait de toute façon. On le dit plutôt
      //  que de laisser la base répondre par un code.
      erreurs.push(
        `message ${lue.messageId} : le combat a déjà joué ses ${TOURS_MAX} tours`,
      );
      return rien;
    }

    if (action.type === "fuir") return await this.#fuir(etat, lue);
    if (action.type === "changer") {
      //  CHANGER DE POKÉMON EST UN TOUR, mais il demande l'équipe —
      //  qui n'est pas dans l'état du combat. On le dit en attendant,
      //  pour la même raison que `ball` : rien joué, rien consommé.
      erreurs.push(
        `message ${lue.messageId} : « changer » n'est pas encore servi ` +
          `par la relève, rien n'a été joué`,
      );
      return rien;
    }

    return await this.#attaquer(etat, lue, action.capacite, erreurs);
  }

  /** Fuir : le combat se ferme, et il n'y a pas de tour à calculer.
   *
   *  LE TOUR S'ÉCRIT QUAND MÊME, avec un récit qui dit juste ça. Sans
   *  ligne, le message du Maître du Jeu n'aurait rien à annoncer, et un
   *  combat disparaîtrait du sujet sans explication. */
  async #fuir(etat: CombatEnCours, lue: ActionLue): Promise<Resolution> {
    await this.combats.jouer({
      combatId: etat.combatId,
      messageId: lue.messageId,
      numero: etat.tour + 1,
      demande: "fuir",
      detail: null,
      recit: { fuite: "joueur" },
      //  LES PV NE BOUGENT PAS. On s'en va, on ne se fait pas frapper
      //  en partant : c'est la règle des jeux, et c'est aussi la seule
      //  qui rende la fuite utile.
      pvJoueur: etat.combattant?.pv ?? 0,
      pvSauvage: etat.sauvage.pv,
      fin: "fuite",
    });
    return { evenements: [], tour: null };
  }

  async #attaquer(
    etat: CombatEnCours,
    lue: ActionLue,
    capaciteId: number,
    erreurs: string[],
  ): Promise<Resolution> {
    const rien: Resolution = { evenements: [], tour: null };

    if (etat.combattant === null) {
      erreurs.push(
        `message ${lue.messageId} : aucun Pokémon dans ton équipe, ` +
          `impossible d'attaquer`,
      );
      return rien;
    }

    //  LA CAPACITÉ DOIT ÊTRE UNE DES QUATRE, et c'est ici que la
    //  promesse de `action.ts` se tient. Nommer le refus plutôt que de
    //  l'avaler : un joueur dont le bouton a écrit un identifiant
    //  périmé — quatre capacités refaites à un niveau gagné — doit
    //  savoir pourquoi son tour n'a pas été joué.
    const choisie = etat.combattant.capacites.find((c) => c.id === capaciteId);
    if (choisie === undefined) {
      erreurs.push(
        `message ${lue.messageId} : la capacité ${capaciteId} n'est pas ` +
          `une de celles de ${etat.combattant.nom}`,
      );
      return rien;
    }

    const riposte = riposteDe(etat.sauvage.capacites.map(capaciteDe));
    if (riposte === null) {
      //  UNE ESPÈCE SANS AUCUNE CAPACITÉ OFFENSIVE. La 0044 en donne
      //  toujours au moins une — « un Pokémon qui ne peut pas attaquer
      //  ne peut pas jouer » — donc arriver ici veut dire que la donnée
      //  est cassée, pas que le sauvage est pacifique.
      erreurs.push(
        `message ${lue.messageId} : ${etat.sauvage.nom} n'a aucune capacité, ` +
          `le combat ne peut pas se jouer`,
      );
      return rien;
    }

    const numero = etat.tour + 1;
    const tour = resoudreUnTour(
      numero,
      combattantDe(etat.combattant),
      combattantDe(etat.sauvage),
      capaciteDe(choisie),
      riposte,
      await this.types.efficacite(),
      //  LA GRAINE EST LE NUMÉRO DU MESSAGE. Fixée à la seconde où le
      //  joueur poste, impossible à rejouer, refaisable à l'identique.
      //  Le numéro du tour s'y ajoute dans le domaine.
      String(lue.messageId),
    );

    const joue = await this.combats.jouer({
      combatId: etat.combatId,
      messageId: lue.messageId,
      numero,
      demande: "attaquer",
      detail: { capacite: choisie.id, nom: choisie.nom },
      recit: tour,
      pvJoueur: tour.pvJoueur,
      pvSauvage: tour.pvSauvage,
      fin: tour.fin,
    });

    //  LA BASE A REFUSÉ. `DEJA_JOUE` est la relève qui relit — normal,
    //  rien à dire. Les autres raisons méritent une ligne : le sujet
    //  s'est clos entre-temps, ou deux messages du même passage ont
    //  voulu jouer le même tour.
    if (!joue.joue) {
      if (joue.raison !== "DEJA_JOUE") {
        erreurs.push(
          `message ${lue.messageId} : tour refusé (${joue.raison ?? "sans raison"})`,
        );
      }
      return rien;
    }

    //  L'EXPÉRIENCE DES DÉGÂTS DONNÉS, et d'eux seuls : prendre des
    //  coups ne rapporte rien. Elle part au registre et se versera à la
    //  clôture, comme tout le reste — un combat gagné dans un sujet qui
    //  ne se clôt jamais ne fait pas monter un Pokémon en douce.
    const degats = degatsAuSauvage(tour);
    const evenements: Evenement[] = [];
    if (degats > 0) {
      evenements.push({
        type: "xp",
        pokemonId: etat.combattant.pokemonId,
        gain: experienceGagnee(degats, etat.combattant.niveau),
      });
    }

    //  LA CAPTURE N'EST PAS ICI. Un sauvage K.-O. n'est pas attrapé : il
    //  est vaincu. C'est la Poké Ball qui capture, et elle vient avec
    //  le sac.
    return { evenements, tour };
  }
}
