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
  resoudreUneRiposte,
  resoudreUnTour,
  type Tour,
  TOURS_MAX,
} from "../domaine/combat.ts";
import { type Jet, lancerUneBall } from "../domaine/capture.ts";
import { estLaNuit } from "../domaine/meteo.ts";
import { estUnSoin, soigner } from "../domaine/soin.ts";
import { graineDepuis, suiteAleatoire } from "../domaine/alea.ts";
import { experienceGagnee } from "../domaine/experience.ts";
import type {
  ActionLue,
  CombatEnCours,
  Combats,
  ObjetDuSac,
  TableDesTypesEnJeu,
} from "./ports.ts";
//  `HeuresDesJoueurs` vit dans `lire-les-nouveaux-messages.ts` et pas
//  dans `ports.ts` — c'est là qu'elle a été écrite le 2 octobre, avec
//  la décision qu'elle porte : « le jour et la nuit suivent l'heure du
//  JOUEUR ». On l'importe de là plutôt que d'en déclarer une seconde.
import type { HeuresDesJoueurs } from "./lire-les-nouveaux-messages.ts";

/** Les cinq demandes du combat, toutes honorées depuis le
 *  18 novembre. */
export const DEMANDES = [
  "attaquer",
  "fuir",
  "changer",
  "ball",
  "objet",
] as const;

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
    /** POUR LA SOMBRE BALL, et pour elle seule : elle vaut ×3 la nuit,
     *  et la nuit est celle du JOUEUR — la même heure locale qui
     *  décide des tables de faune. Deux notions de « nuit » dans un
     *  jeu, c'est une de trop. */
    private readonly heures: HeuresDesJoueurs,
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
      return await this.#changer(etat, lue, action.position, erreurs);
    }
    if (action.type === "ball") {
      return await this.#lancerUneBall(etat, lue, action.objetId, joueurId, erreurs);
    }
    if (action.type === "objet") {
      return await this.#utiliserUnObjet(etat, lue, action.objetId, erreurs);
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

  /** L'objet du sac, s'il y en a un.
   *
   *  LA QUANTITÉ EST CELLE DE LA BASE, pas celle du sujet : ce que le
   *  registre a déjà consommé se déduit à la CLÔTURE, comme tout le
   *  reste. Conséquence assumée — un joueur peut lancer six balls avec
   *  cinq dans son sac, et la clôture refusera le tout en disant ce
   *  qui manque (`evaluerCloture`). Ce contrôle-ci sert à refuser le
   *  cas évident tout de suite, pas à tenir la comptabilité. */
  #duSac(etat: CombatEnCours, objetId: number): ObjetDuSac | undefined {
    return etat.sac.find((o) => o.objetId === objetId && o.quantite > 0);
  }

  /** CHANGER DE POKÉMON, et ça coûte le tour.
   *
   *  C'est la règle des jeux, et elle n'est pas décorative : sans elle,
   *  la bonne stratégie serait toujours de faire défiler l'équipe
   *  entière pour trouver la meilleure affiche. Un choix sans coût
   *  n'est pas un choix. */
  async #changer(
    etat: CombatEnCours,
    lue: ActionLue,
    position: number,
    erreurs: string[],
  ): Promise<Resolution> {
    const rien: Resolution = { evenements: [], tour: null };

    const vise = etat.equipe.find((m) => m.position === position);
    if (vise === undefined) {
      erreurs.push(
        `message ${lue.messageId} : aucun Pokémon en case ${position} de ton équipe`,
      );
      return rien;
    }
    //  CELUI-LÀ SE BAT DÉJÀ, et on le NOMME. « Rien ne s'est passé »
    //  serait pris pour une panne ; « Salamèche se bat déjà » se lit.
    if (etat.combattant !== null && vise.pokemonId === etat.combattant.pokemonId) {
      erreurs.push(
        `message ${lue.messageId} : ${vise.nom} se bat déjà`,
      );
      return rien;
    }
    //  À TERRE NE REVIENT PAS. Zéro PV n'est pas « très blessé » : il
    //  faut un Rappel, que le combat ne sert pas encore.
    if (vise.pv <= 0) {
      erreurs.push(
        `message ${lue.messageId} : ${vise.nom} est à terre, il ne peut pas entrer`,
      );
      return rien;
    }

    const riposte = riposteDe(etat.sauvage.capacites.map(capaciteDe));
    if (riposte === null) {
      erreurs.push(
        `message ${lue.messageId} : ${etat.sauvage.nom} n'a aucune capacité, ` +
          `le combat ne peut pas se jouer`,
      );
      return rien;
    }

    const numero = etat.tour + 1;
    //  L'ARRIVANT ENCAISSE, et c'est lui que la riposte vise : il entre
    //  sur le terrain au début du tour, pas à la fin.
    const tour = resoudreUneRiposte(
      numero,
      combattantDe(vise),
      combattantDe(etat.sauvage),
      riposte,
      await this.types.efficacite(),
      String(lue.messageId),
      "changer",
    );

    const joue = await this.combats.jouer({
      combatId: etat.combatId,
      messageId: lue.messageId,
      numero,
      demande: "changer",
      detail: { position, pokemonId: vise.pokemonId, nom: vise.nom },
      recit: tour,
      pvJoueur: tour.pvJoueur,
      pvSauvage: tour.pvSauvage,
      fin: tour.fin,
      //  LES DEUX CHAMPS QUI FONT LE CHANGEMENT. Sans eux, la base
      //  écrirait les PV de l'arrivant sur la ligne de celui qui sort.
      pokemonId: vise.pokemonId,
      pvPokemonMax: vise.pvMax,
    });
    if (!joue.joue) {
      if (joue.raison !== "DEJA_JOUE") {
        erreurs.push(
          `message ${lue.messageId} : tour refusé (${joue.raison ?? "sans raison"})`,
        );
      }
      return rien;
    }
    //  AUCUNE EXPÉRIENCE : personne n'a frappé de ce côté-ci.
    return { evenements: [], tour };
  }

  /** LANCER UNE POKÉ BALL.
   *
   *  ── LA CAPTURE PASSE PAR LE REGISTRE, COMME TOUT LE RESTE ─────────
   *
   *  Une prise n'écrit PAS un Pokémon dans la boîte : elle écrit une
   *  ligne `capture` au registre, qui se versera à la clôture. C'est
   *  la même règle que l'expérience et que les objets trouvés, et elle
   *  a une raison — `evaluerCloture` vérifie qu'il y a la place en
   *  boîte, et un Pokémon versé en plein sujet sauterait ce contrôle.
   *
   *  ── ET LA BALL SE CONSOMME, PRISE OU PAS ──────────────────────────
   *
   *  Une ball lancée est une ball perdue. `objet_utilise` part dans les
   *  deux cas, et c'est ce qui rend le choix de la ball intéressant. */
  async #lancerUneBall(
    etat: CombatEnCours,
    lue: ActionLue,
    objetId: number,
    joueurId: string,
    erreurs: string[],
  ): Promise<Resolution> {
    const rien: Resolution = { evenements: [], tour: null };

    const objet = this.#duSac(etat, objetId);
    if (objet === undefined) {
      erreurs.push(
        `message ${lue.messageId} : tu n'as pas cet objet (${objetId}) dans ton sac`,
      );
      return rien;
    }
    if (objet.famille !== "ball") {
      erreurs.push(
        `message ${lue.messageId} : ${objet.nom} n'est pas une Poké Ball`,
      );
      return rien;
    }

    //  LE TIRAGE DE LA BALL EST UNE SUITE À PART, et le suffixe le dit.
    //  Mélangée aux quatre tirages du tour, elle les décalerait selon
    //  qu'on a lancé ou frappé — et rejouer un combat contesté
    //  dépendrait de ce qu'on a choisi au tour deux.
    const tirer = suiteAleatoire(graineDepuis(`${lue.messageId}|ball`));
    let jet: Jet;
    try {
      jet = lancerUneBall(
        {
          pv: etat.sauvage.pv,
          pvMax: etat.sauvage.pvMax,
          niveau: etat.sauvage.niveau,
          types: etat.sauvage.types,
          capture: etat.sauvage.capture,
        },
        objet.slug,
        {
          nuit: estLaNuit(await this.heures.heureLocaleDe(joueurId)),
          tour: etat.tour + 1,
        },
        tirer(),
      );
    } catch (e) {
      //  UNE BALL QUE LE DOMAINE NE CONNAÎT PAS. Le catalogue en porte
      //  huit et `BALLS` les a toutes — un test le vérifie — donc
      //  arriver ici veut dire qu'une neuvième est entrée au catalogue
      //  sans passer par le domaine. On ne consomme rien.
      erreurs.push(
        `message ${lue.messageId} : ${objet.nom} — ${(e as Error).message}`,
      );
      return rien;
    }

    const numero = etat.tour + 1;
    const evenements: Evenement[] = [
      { type: "objet_utilise", objetId, quantite: 1 },
    ];

    if (jet.prise) {
      const tour: Tour = {
        numero,
        aLaPlace: "ball",
        frappes: [],
        pvJoueur: etat.combattant?.pv ?? 0,
        pvSauvage: etat.sauvage.pv,
        fin: null,
      };
      const joue = await this.combats.jouer({
        combatId: etat.combatId,
        messageId: lue.messageId,
        numero,
        demande: "ball",
        detail: { objetId, nom: objet.nom, chance: jet.chance, de: jet.de },
        recit: { ...tour, jet },
        pvJoueur: tour.pvJoueur,
        pvSauvage: tour.pvSauvage,
        fin: "capture",
      });
      if (!joue.joue) {
        if (joue.raison !== "DEJA_JOUE") {
          erreurs.push(
            `message ${lue.messageId} : tour refusé (${joue.raison ?? "sans raison"})`,
          );
        }
        return rien;
      }
      evenements.push({
        type: "capture",
        especeId: etat.sauvage.especeId,
        niveau: etat.sauvage.niveau,
      });
      return { evenements, tour: { ...tour, fin: null } };
    }

    //  RATÉE : le sauvage frappe. Une ball lancée pour rien coûte le
    //  tour et la ball, comme dans les jeux.
    if (etat.combattant === null) {
      //  Planche 99 §5.3 : sans Pokémon, la rencontre reste une
      //  rencontre et la ball se lance quand même — mais personne ne
      //  peut encaisser la riposte. Le tour passe, sans frappe.
      const tour: Tour = {
        numero,
        aLaPlace: "ball",
        frappes: [],
        pvJoueur: 0,
        pvSauvage: etat.sauvage.pv,
        fin: numero === TOURS_MAX ? "fuite" : null,
      };
      const joue = await this.combats.jouer({
        combatId: etat.combatId,
        messageId: lue.messageId,
        numero,
        demande: "ball",
        detail: { objetId, nom: objet.nom, chance: jet.chance, de: jet.de },
        recit: { ...tour, jet },
        pvJoueur: 0,
        pvSauvage: etat.sauvage.pv,
        fin: tour.fin,
      });
      return joue.joue ? { evenements, tour } : rien;
    }

    const riposte = riposteDe(etat.sauvage.capacites.map(capaciteDe));
    if (riposte === null) {
      erreurs.push(
        `message ${lue.messageId} : ${etat.sauvage.nom} n'a aucune capacité, ` +
          `le combat ne peut pas se jouer`,
      );
      return rien;
    }
    const tour = resoudreUneRiposte(
      numero,
      combattantDe(etat.combattant),
      combattantDe(etat.sauvage),
      riposte,
      await this.types.efficacite(),
      String(lue.messageId),
      "ball",
    );
    const joue = await this.combats.jouer({
      combatId: etat.combatId,
      messageId: lue.messageId,
      numero,
      demande: "ball",
      detail: { objetId, nom: objet.nom, chance: jet.chance, de: jet.de },
      recit: { ...tour, jet },
      pvJoueur: tour.pvJoueur,
      pvSauvage: tour.pvSauvage,
      fin: tour.fin,
    });
    if (!joue.joue) {
      if (joue.raison !== "DEJA_JOUE") {
        erreurs.push(
          `message ${lue.messageId} : tour refusé (${joue.raison ?? "sans raison"})`,
        );
      }
      return rien;
    }
    return { evenements, tour };
  }

  /** UTILISER UN OBJET DU SAC. Une Potion, pour l'instant : c'est la
   *  seule famille que le combat sait appliquer.
   *
   *  Les autres familles du catalogue — statut, rappel, évolution,
   *  tenu — sont refusées NOMMÉMENT. Les accepter en silence
   *  consommerait l'objet sans rien faire. */
  async #utiliserUnObjet(
    etat: CombatEnCours,
    lue: ActionLue,
    objetId: number,
    erreurs: string[],
  ): Promise<Resolution> {
    const rien: Resolution = { evenements: [], tour: null };

    const objet = this.#duSac(etat, objetId);
    if (objet === undefined) {
      erreurs.push(
        `message ${lue.messageId} : tu n'as pas cet objet (${objetId}) dans ton sac`,
      );
      return rien;
    }
    if (!estUnSoin(objet.slug)) {
      erreurs.push(
        `message ${lue.messageId} : ${objet.nom} ne s'utilise pas en combat`,
      );
      return rien;
    }
    if (etat.combattant === null) {
      erreurs.push(
        `message ${lue.messageId} : aucun Pokémon à soigner`,
      );
      return rien;
    }

    let guerison;
    try {
      guerison = soigner(objet.slug, etat.combattant.pv, etat.combattant.pvMax);
    } catch (e) {
      //  « À terre demande un Rappel », « déjà au maximum » : des
      //  refus utiles. Sans eux le joueur dépense une Potion pour rien
      //  et ne comprend pas pourquoi il a toujours perdu.
      erreurs.push(
        `message ${lue.messageId} : ${objet.nom} — ${(e as Error).message}`,
      );
      return rien;
    }
    if (guerison.rendus === 0) {
      erreurs.push(
        `message ${lue.messageId} : ${etat.combattant.nom} est déjà au maximum, ` +
          `${objet.nom} n'a pas été utilisée`,
      );
      return rien;
    }

    const riposte = riposteDe(etat.sauvage.capacites.map(capaciteDe));
    if (riposte === null) {
      erreurs.push(
        `message ${lue.messageId} : ${etat.sauvage.nom} n'a aucune capacité, ` +
          `le combat ne peut pas se jouer`,
      );
      return rien;
    }

    const numero = etat.tour + 1;
    //  ON SOIGNE D'ABORD, LE SAUVAGE FRAPPE ENSUITE. L'ordre compte :
    //  une Potion sur un Pokémon à 2 PV le sauve, et l'inverse le
    //  laisserait tomber avant d'avoir bu.
    const tour = resoudreUneRiposte(
      numero,
      { ...combattantDe(etat.combattant), pv: guerison.pv },
      combattantDe(etat.sauvage),
      riposte,
      await this.types.efficacite(),
      String(lue.messageId),
      "objet",
    );

    const joue = await this.combats.jouer({
      combatId: etat.combatId,
      messageId: lue.messageId,
      numero,
      demande: "objet",
      detail: { objetId, nom: objet.nom, rendus: guerison.rendus },
      recit: tour,
      pvJoueur: tour.pvJoueur,
      pvSauvage: tour.pvSauvage,
      fin: tour.fin,
    });
    if (!joue.joue) {
      if (joue.raison !== "DEJA_JOUE") {
        erreurs.push(
          `message ${lue.messageId} : tour refusé (${joue.raison ?? "sans raison"})`,
        );
      }
      return rien;
    }
    return {
      evenements: [{ type: "objet_utilise", objetId, quantite: 1 }],
      tour,
    };
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
