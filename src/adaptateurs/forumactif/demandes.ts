// ════════════════════════════════════════════════════════════════════
//  src/adaptateurs/forumactif/demandes.ts
//
//  Ce que le JOUEUR demande, lu dans son message.
//
//  Une seule demande est reconnue pour l'instant : `[cloture]`, décidée
//  dans la planche 45 (« la clôture est un bouton qui remplit le formulaire
//  natif »). Le bouton du module pré-remplit la réponse rapide avec ce
//  bloc, et le joueur envoie. **Rien ne se clôt tout seul.**
//
//  Pourquoi un mot entre crochets : Forumactif ne connaît pas cette balise,
//  donc elle traverse l'éditeur, le BBCode et le nettoyage de balises sans
//  être transformée, et reste lisible dans l'archive dix ans plus tard.
//  C'est le même raisonnement que pour le marqueur `[[WM:…]]`.
//
//  NE PAS CONFONDRE avec le marqueur : `[cloture]` est écrit par le JOUEUR,
//  `[[WM:…]]` est écrit par le SERVEUR. L'un est une demande, l'autre une
//  preuve.
//
//  LES ACTIONS, elles, sont tranchées depuis le 2 octobre : le joueur ne
//  tape rien, il clique, et notre JavaScript écrit `[[WM-ACTION:<verbe>]]`.
//  Le vocabulaire et la lecture du bloc vivent dans `domaine/action.ts` ;
//  ici on ne fait que rattacher chaque action à son message et à son
//  auteur.
// ════════════════════════════════════════════════════════════════════

import { type Action, actionDe } from "../../domaine/action.ts";

/** `[cloture]`, avec ou sans accent, avec ou sans espaces, en n'importe
 *  quelle casse. Un joueur tape ce qu'il tape, et l'éditeur de Forumactif
 *  peut glisser des balises autour — mais pas DEDANS, parce que le bloc est
 *  posé d'un coup par le bouton. */
const DEMANDE_DE_CLOTURE = /\[\s*cl[oô]ture\s*\]/i;

/** Vrai si ce message demande la clôture du sujet.
 *
 *  Volontairement tolérant sur la forme, et volontairement strict sur une
 *  chose : la demande doit être le mot seul entre crochets. `[clotures]`,
 *  `[cloture=hier]` ou une phrase « j'aimerais la cloture » ne comptent
 *  pas. Un faux positif clôturerait un sujet que personne n'a voulu clore. */
export function demandeLaCloture(corps: string): boolean {
  return DEMANDE_DE_CLOTURE.test(corps);
}

/** Ce qu'on a trouvé dans un message, prêt pour la relève. */
export type DemandeLue = {
  readonly messageId: number;
  readonly auteurId: number;
  readonly auteurPseudo: string;
};

type MessageAvecCorps = {
  readonly id: number;
  readonly auteurId: number;
  readonly auteurPseudo: string;
  readonly corps: string;
};

/**
 * Les demandes de clôture d'une liste de messages.
 *
 * Si un sujet en contient plusieurs — deux joueurs cliquent le même jour —
 * **on ne garde que la première**, dans l'ordre des identifiants de
 * message. Clôturer deux fois est impossible de toute façon (la base le
 * refuse), mais répondre deux fois produirait deux bilans contradictoires
 * dans le fil.
 */
export function demandesDeCloture(
  messages: readonly MessageAvecCorps[],
): readonly DemandeLue[] {
  const parSujet = messages
    .filter((m) => demandeLaCloture(m.corps))
    .sort((a, b) => a.id - b.id);

  if (parSujet.length === 0) return [];
  const premiere = parSujet[0];
  return [{
    messageId: premiere.id,
    auteurId: premiere.auteurId,
    auteurPseudo: premiere.auteurPseudo,
  }];
}

// ── les actions ─────────────────────────────────────────────────────

/** Une action demandée, rattachée à son message et à son auteur.
 *
 *  `messageId` n'est pas décoratif : c'est **la graine du tirage**. Il est
 *  fixé à la seconde où le joueur poste, il ne recule jamais, et il rend
 *  la rencontre rejouable à l'identique des années plus tard. C'est ce qui
 *  permet de trancher une contestation au lieu d'en débattre. */
export type ActionLue = {
  readonly messageId: number;
  readonly auteurId: number;
  readonly auteurPseudo: string;
  readonly action: Action;
};

/**
 * Les actions demandées dans une liste de messages, dans l'ordre où elles
 * ont été postées.
 *
 * **Une par message au plus** — `actionDe` s'en charge, et c'est la règle
 * qui empêche de coller le bloc cinquante fois pour fouiller cinquante
 * fois. Un message qui ne demande rien n'apparaît pas : ne pas cliquer ne
 * doit rien déclencher.
 */
export function actionsDemandees(
  messages: readonly MessageAvecCorps[],
): readonly ActionLue[] {
  return messages
    .map((m) => ({ m, action: actionDe(m.corps) }))
    .filter((x): x is { m: MessageAvecCorps; action: Action } => x.action !== null)
    .sort((a, b) => a.m.id - b.m.id)
    .map(({ m, action }) => ({
      messageId: m.id,
      auteurId: m.auteurId,
      auteurPseudo: m.auteurPseudo,
      action,
    }));
}
