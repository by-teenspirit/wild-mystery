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
  degatsPortes,
  resoudreUneFrappe,
  resoudreUneRiposte,
  resoudreUnTour,
  type Tour,
  TOURS_MAX,
  TOURS_MAX_DUEL,
  tourSansFrappe,
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

    //  ── UN DUEL A DEUX AYANTS DROIT, ET UN SEUL À LA FOIS ──────────
    //
    //  Le combat sauvage appartient à celui qui a fait apparaître le
    //  Pokémon (planche 99 §5.4) : dans un sujet à deux, le second
    //  joueur ne joue pas les tours du premier.
    //
    //  Un duel renverse la première moitié de cette règle et garde la
    //  seconde : LES DEUX ont le droit d'agir, mais pas en même temps.
    //  C'est `a_qui` qui tranche — et la base le tranche aussi, dans la
    //  même transaction que le tour. Ce refus-ci est là pour le DIRE,
    //  pas pour le tenir : la relève lit plusieurs messages par
    //  passage, et seule une transaction empêche deux coups d'affilée.
    const duel = etat.genre === "duel";
    if (duel) {
      if (etat.joueurId !== joueurId && etat.adverseJoueurId !== joueurId) {
        erreurs.push(
          `message ${lue.messageId} : ce duel n'est pas le tien, ` +
            `il se joue entre deux autres dresseurs`,
        );
        return rien;
      }
      if (etat.aQui !== joueurId) {
        erreurs.push(
          `message ${lue.messageId} : ce n'est pas ton tour, ` +
            `c'est à l'autre dresseur de frapper`,
        );
        return rien;
      }
    } else if (etat.joueurId !== joueurId) {
      erreurs.push(
        `message ${lue.messageId} : ce combat n'est pas le tien, ` +
          `il appartient au joueur qui a fait apparaître le Pokémon`,
      );
      return rien;
    }

    //  LE PLAFOND N'EST PAS LE MÊME DES DEUX CÔTÉS : cinq pour un
    //  sauvage qui s'en va, trente pour un duel dont chaque tour n'est
    //  qu'une frappe.
    const plafond = duel ? TOURS_MAX_DUEL : TOURS_MAX;
    if (etat.tour >= plafond) {
      //  Le dernier tour a déjà été joué, et `jouer_un_tour` refuserait
      //  de toute façon. On le dit plutôt que de laisser la base
      //  répondre par un code.
      erreurs.push(
        `message ${lue.messageId} : le combat a déjà joué ses ${plafond} tours`,
      );
      return rien;
    }

    //  ── LE SEUL REFUS QUI RESTE DANS UN DUEL ───────────────────────
    //
    //  Pas de Poké Ball : on n'attrape pas le Pokémon de quelqu'un, et
    //  ça ne changera pas. C'est le seul des trois refus du 23 novembre
    //  qui tient — les deux autres ont reçu leur règle le même jour :
    //  « les objets sont autorisés en combat », et « changer de pokémon,
    //  ça permet à l'autre d'attaquer, ça utilise un de tes tours ».
    //
    //  ON NOMME LE REFUS plutôt que de l'avaler : un joueur dont la
    //  barre a écrit un bloc que le serveur ne sert pas doit savoir
    //  pourquoi son tour n'a pas été joué.
    if (duel && action.type === "ball") {
      erreurs.push(
        `message ${lue.messageId} : on n'attrape pas le Pokémon d'un dresseur`,
      );
      return rien;
    }

    if (duel && action.type === "attaquer") {
      return await this.#frapper(etat, lue, action.capacite, joueurId, erreurs);
    }
    if (duel && action.type === "fuir") return await this.#renoncer(etat, lue, joueurId);
    //  ── SOIGNER ET REMPLACER : UN TOUR, PAS UNE FRAPPE ─────────────
    //
    //  SA RÉPONSE ÉTAIT PLUS SIMPLE QUE MES DEUX OPTIONS. Je lui avais
    //  demandé si changer « passe la main sans plus » ou si
    //  « l'adversaire gagne un coup gratuit » : dans un duel, c'est LA
    //  MÊME CHOSE. Personne ne riposte automatiquement, l'autre frappe
    //  parce que c'est son tour.
    //
    //  Les deux chemins sauvages ne pouvaient pas servir : ils
    //  calculent une riposte du sauvage, et ici le « sauvage » est le
    //  Pokémon d'un joueur — le faire riposter tout seul jouerait à sa
    //  place.
    if (duel && action.type === "objet") {
      return await this.#soignerEnDuel(etat, lue, action.objetId, joueurId, erreurs);
    }
    if (duel && action.type === "changer") {
      return await this.#remplacerEnDuel(etat, lue, action.position, joueurId, erreurs);
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
        //  ON NE L'ÉCRIT QUE S'IL EST VRAI : une clé `false` sur
        //  chaque capture alourdirait le registre pour dire
        //  l'ordinaire. Et `vie.ts` attend exactement cette clé pour
        //  écrire « a capturé Vivaldaim chromatique ».
        ...(etat.sauvage.chromatique === true ? { chromatique: true } : {}),
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

  /** Mon Pokémon et celui d'en face, dans un duel.
   *
   *  LE REPÈRE DE LA TABLE NE BOUGE PAS : `etat.combattant` est
   *  TOUJOURS le côté de `joueur_id`, `etat.sauvage` TOUJOURS celui d'en
   *  face. Ce qui change, c'est de quel côté est celui qui joue — et
   *  c'est la seule chose que ces deux lignes calculent.
   *
   *  Trois méthodes en avaient besoin, donc elle existe : la quatrième
   *  copie aurait été celle qui se trompe. */
  #mesCotes(etat: CombatEnCours, joueurId: string): {
    readonly monCote: boolean;
    readonly moi: CombatEnCours["combattant"] | CombatEnCours["sauvage"];
    readonly enFace: CombatEnCours["combattant"] | CombatEnCours["sauvage"];
    readonly monPokemonId: string | null;
  } {
    const monCote = etat.joueurId === joueurId;
    return {
      monCote,
      moi: monCote ? etat.combattant : etat.sauvage,
      enFace: monCote ? etat.sauvage : etat.combattant,
      //  ── L'IDENTIFIANT NE SE LIT PAS AU MÊME ENDROIT ──────────────
      //
      //  LE COMPILATEUR M'A ATTRAPÉ ICI, et il avait raison : le côté
      //  « sauvage » est décrit comme une ESPÈCE — elle n'a pas de
      //  `pokemonId`, parce qu'un Pokémon sauvage n'existe pas en base
      //  avant d'être attrapé. Dans un duel, celui d'en face EST un
      //  Pokémon de joueur, et son identifiant vit dans un champ à
      //  part, `adversePokemonId` (0061).
      //
      //  Sans ça, la garde « celui-là se bat déjà » ne se serait jamais
      //  déclenchée pour l'adversaire : il aurait pu « remplacer » son
      //  combattant par lui-même et dépenser son tour pour rien.
      monPokemonId: monCote
        ? (etat.combattant?.pokemonId ?? null)
        : (etat.adversePokemonId ?? null),
    };
  }

  /** ── SOIGNER DANS UN DUEL ────────────────────────────────────────
   *
   *  « Les objets sont autorisés en combat » — 23 novembre.
   *
   *  CE N'EST PAS `#utiliserUnObjet` AVEC UN DRAPEAU. Ce chemin-là
   *  calcule une riposte du sauvage et la joue dans le même message :
   *  ici, le « sauvage » est le Pokémon d'un joueur, et le faire
   *  riposter tout seul jouerait à sa place. Le tour soigne, et la main
   *  passe. */
  async #soignerEnDuel(
    etat: CombatEnCours,
    lue: ActionLue,
    objetId: number,
    joueurId: string,
    erreurs: string[],
  ): Promise<Resolution> {
    const rien: Resolution = { evenements: [], tour: null };
    const { monCote, moi } = this.#mesCotes(etat, joueurId);

    if (moi === null) {
      erreurs.push(
        `message ${lue.messageId} : tu n'as aucun Pokémon sur le terrain`,
      );
      return rien;
    }

    //  LE SAC EST CELUI DE QUI A LA MAIN (0062) : `combat_pour_jouer`
    //  sert l'équipe et le sac de `a_qui`. On soigne donc avec SES
    //  objets, et pas avec ceux du défieur.
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

    let guerison;
    try {
      guerison = soigner(objet.slug, moi.pv, moi.pvMax);
    } catch (e) {
      erreurs.push(
        `message ${lue.messageId} : ${objet.nom} — ${(e as Error).message}`,
      );
      return rien;
    }
    //  DÉJÀ AU MAXIMUM : on refuse, et on le dit. Sans ce refus, le
    //  joueur dépense une Potion ET son tour pour rien, dans un duel où
    //  l'adversaire va frapper derrière.
    if (guerison.rendus === 0) {
      erreurs.push(
        `message ${lue.messageId} : ${moi.nom} est déjà au maximum, ` +
          `${objet.nom} n'a pas été utilisée`,
      );
      return rien;
    }

    const numero = etat.tour + 1;
    const tour = tourSansFrappe(
      numero,
      //  LES PV S'ÉCRIVENT DANS LE REPÈRE DE LA TABLE, jamais dans celui
      //  de qui joue : `pvJoueur` est le côté de `joueur_id`. Se tromper
      //  ici soignerait l'adversaire.
      monCote ? guerison.pv : (etat.combattant?.pv ?? 0),
      monCote ? etat.sauvage.pv : guerison.pv,
    );

    const joue = await this.combats.jouer({
      combatId: etat.combatId,
      messageId: lue.messageId,
      numero,
      demande: "objet",
      //  `parDefieur` EST LA SEULE TRACE DE QUI A JOUÉ. `combat_tour`
      //  n'a pas de colonne de joueur, et `a_qui` aura déjà basculé
      //  quand le message du Maître du Jeu s'écrira — sans ce champ, la
      //  phrase ne pourrait pas nommer celui qui a soigné.
      detail: {
        objetId,
        nom: objet.nom,
        rendus: guerison.rendus,
        qui: moi.nom,
        parDefieur: monCote,
      },
      recit: tour,
      pvJoueur: tour.pvJoueur,
      pvSauvage: tour.pvSauvage,
      fin: tour.fin,
      joueurId,
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

  /** ── CHANGER DE POKÉMON DANS UN DUEL ─────────────────────────────
   *
   *  « Ça permet à l'autre d'attaquer, ça utilise un de tes tours. »
   *
   *  ET LES DEUX SONT LA MÊME PHRASE ICI : le tour est consommé, la
   *  main passe, et l'autre frappe parce que c'est son tour. Dans un
   *  combat sauvage, `#changer` fait riposter le sauvage dans le même
   *  message — il n'a personne pour écrire sa riposte. Un dresseur, si. */
  async #remplacerEnDuel(
    etat: CombatEnCours,
    lue: ActionLue,
    position: number,
    joueurId: string,
    erreurs: string[],
  ): Promise<Resolution> {
    const rien: Resolution = { evenements: [], tour: null };
    const { monCote, monPokemonId } = this.#mesCotes(etat, joueurId);

    const vise = etat.equipe.find((m) => m.position === position);
    if (vise === undefined) {
      erreurs.push(
        `message ${lue.messageId} : aucun Pokémon en case ${position} de ton équipe`,
      );
      return rien;
    }
    //  CELUI QUI SE BAT DÉJÀ EST LE MIEN, pas celui de `joueur_id`. La
    //  comparaison naïve — `etat.combattant` — aurait laissé
    //  l'adversaire « remplacer » son propre combattant par lui-même, et
    //  dépenser son tour pour rien.
    if (monPokemonId !== null && vise.pokemonId === monPokemonId) {
      erreurs.push(`message ${lue.messageId} : ${vise.nom} se bat déjà`);
      return rien;
    }
    if (vise.pv <= 0) {
      erreurs.push(
        `message ${lue.messageId} : ${vise.nom} est à terre, il ne peut pas entrer`,
      );
      return rien;
    }

    const numero = etat.tour + 1;
    const tour = tourSansFrappe(
      numero,
      monCote ? vise.pv : (etat.combattant?.pv ?? 0),
      monCote ? etat.sauvage.pv : vise.pv,
    );

    const joue = await this.combats.jouer({
      combatId: etat.combatId,
      messageId: lue.messageId,
      numero,
      demande: "changer",
      detail: {
        position,
        pokemonId: vise.pokemonId,
        nom: vise.nom,
        parDefieur: monCote,
      },
      recit: tour,
      pvJoueur: tour.pvJoueur,
      pvSauvage: tour.pvSauvage,
      fin: tour.fin,
      //  ── DEUX CHAMPS, ET PAS LES MÊMES SELON LE CÔTÉ ──────────────
      //
      //  La base écrit `pokemon_id`/`pv_pokemon_max` pour un camp et
      //  `adverse_pokemon_id`/`pv_sauvage_max` pour l'autre (0061). Les
      //  poser du mauvais côté remplacerait le Pokémon de l'adversaire
      //  par le nôtre — et sa jauge afficherait notre Pokémon.
      ...(monCote
        ? { pokemonId: vise.pokemonId, pvPokemonMax: vise.pvMax }
        : { pokemonAdverse: vise.pokemonId, pvAdverseMax: vise.pvMax }),
      joueurId,
    });
    if (!joue.joue) {
      if (joue.raison !== "DEJA_JOUE") {
        erreurs.push(
          `message ${lue.messageId} : tour refusé (${joue.raison ?? "sans raison"})`,
        );
      }
      return rien;
    }
    //  AUCUNE EXPÉRIENCE : personne n'a frappé.
    return { evenements: [], tour };
  }

  /** ── UNE FRAPPE DE DUEL ──────────────────────────────────────────
   *
   *  Un tour est UNE frappe, pas un échange. Dans un combat sauvage, un
   *  message fait l'aller et le retour parce que le sauvage n'a pas
   *  d'auteur : personne n'écrirait sa riposte. Ici, l'adversaire
   *  choisira sa capacité dans son message — lui en choisir une serait
   *  jouer à sa place.
   *
   *  ── LES DEUX RÔLES, ET LE REPÈRE QUI NE BOUGE PAS ────────────────
   *
   *  `etat.combattant` est TOUJOURS le côté de `joueur_id`, et
   *  `etat.sauvage` TOUJOURS celui d'en face — même quand c'est l'autre
   *  dresseur qui frappe. C'est ce que la table dit, et changer de
   *  repère selon le tour donnerait une ligne qu'on ne sait plus lire.
   *
   *  Ce qui change, c'est QUI est l'attaquant des deux. */
  async #frapper(
    etat: CombatEnCours,
    lue: ActionLue,
    capaciteId: number,
    joueurId: string,
    erreurs: string[],
  ): Promise<Resolution> {
    const rien: Resolution = { evenements: [], tour: null };

    if (etat.combattant === null) {
      erreurs.push(
        `message ${lue.messageId} : il n'y a aucun Pokémon de ce côté-ci, ` +
          `le duel ne peut pas se jouer`,
      );
      return rien;
    }

    //  LE DÉFIEUR EST `joueur_id` (0060), donc son camp est « joueur ».
    const monCote = etat.joueurId === joueurId;
    const qui = monCote ? "joueur" as const : "adverse" as const;
    const attaquant = monCote ? etat.combattant : etat.sauvage;
    const defenseur = monCote ? etat.sauvage : etat.combattant;

    //  LA CAPACITÉ DOIT ÊTRE UNE DES QUATRE DE L'ATTAQUANT, et c'est
    //  ici que la promesse de `action.ts` se tient — taper le bloc à la
    //  main ne donne aucun avantage. Celles d'en face sont celles que
    //  SON dresseur a choisies (0061), pas celles de son espèce.
    const choisie = attaquant.capacites.find((c) => c.id === capaciteId);
    if (choisie === undefined) {
      erreurs.push(
        `message ${lue.messageId} : la capacité ${capaciteId} n'est pas ` +
          `une de celles de ${attaquant.nom}`,
      );
      return rien;
    }

    const numero = etat.tour + 1;
    const tour = resoudreUneFrappe(
      numero,
      combattantDe(attaquant),
      combattantDe(defenseur),
      capaciteDe(choisie),
      await this.types.efficacite(),
      //  LA MÊME GRAINE QUE PARTOUT : le numéro du message. Fixée à la
      //  seconde où le joueur poste, impossible à rejouer, refaisable à
      //  l'identique des années plus tard. Un duel a deux joueurs, donc
      //  deux fois plus de raisons d'être contesté.
      String(lue.messageId),
      qui,
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
      //  LA BASE EXIGE DE SAVOIR QUI JOUE, et elle refuse qui n'a pas
      //  la main. C'est elle qui tient l'ordre des coups, pas le test
      //  d'`executer` : la relève lit plusieurs messages par passage.
      joueurId,
    });

    if (!joue.joue) {
      if (joue.raison !== "DEJA_JOUE") {
        erreurs.push(
          `message ${lue.messageId} : tour refusé (${joue.raison ?? "sans raison"})`,
        );
      }
      return rien;
    }

    //  ── L'EXPÉRIENCE VA À CELUI QUI A FRAPPÉ ───────────────────────
    //
    //  `degatsAuSauvage` ne compte que les frappes du « joueur », parce
    //  que la riposte d'un sauvage ne rapporte rien à personne. Dans un
    //  duel les deux côtés gagnent en frappant : c'est la même règle du
    //  1er octobre, lue dans les deux sens.
    //
    //  ET ELLE VA AU POKÉMON DE L'ATTAQUANT, pas à celui de `joueur_id`.
    //  Se tromper ici ferait monter le Pokémon de l'adversaire chaque
    //  fois qu'il se fait frapper.
    const degats = degatsPortes(tour);
    const evenements: Evenement[] = [];
    const pokemonId = monCote ? etat.combattant.pokemonId : etat.adversePokemonId;
    if (degats > 0 && pokemonId !== null && pokemonId !== undefined) {
      evenements.push({
        type: "xp",
        pokemonId,
        gain: experienceGagnee(degats, attaquant.niveau),
      });
    }
    return { evenements, tour };
  }

  /** Renoncer à un duel. Le combat se ferme, et celui qui renonce perd.
   *
   *  ── « FUIR » NE VEUT PAS DIRE LA MÊME CHOSE ICI ──────────────────
   *
   *  On fuit un Pokémon sauvage sans conséquence : il ne poursuit pas,
   *  et c'est ce qui rend la fuite utile. On ne fuit pas un dresseur —
   *  on déclare forfait, et le forfait a un vainqueur. Sinon le verbe
   *  deviendrait le moyen d'annuler un duel qu'on est en train de
   *  perdre.
   *
   *  LA FIN SE DIT DANS LE REPÈRE DE `joueur_id`, comme toujours : le
   *  défieur qui renonce est une `defaite`, l'autre une `victoire`. */
  async #renoncer(
    etat: CombatEnCours,
    lue: ActionLue,
    joueurId: string,
  ): Promise<Resolution> {
    const monCote = etat.joueurId === joueurId;
    await this.combats.jouer({
      combatId: etat.combatId,
      messageId: lue.messageId,
      numero: etat.tour + 1,
      demande: "renoncer",
      detail: null,
      recit: { renonce: monCote ? "joueur" : "adverse" },
      //  LES PV NE BOUGENT PAS : on renonce, on ne se fait pas frapper
      //  en partant.
      pvJoueur: etat.combattant?.pv ?? 0,
      pvSauvage: etat.sauvage.pv,
      fin: monCote ? "defaite" : "victoire",
      joueurId,
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
