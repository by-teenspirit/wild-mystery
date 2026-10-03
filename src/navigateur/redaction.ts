// ════════════════════════════════════════════════════════════════════
//  src/navigateur/redaction.ts
//
//  Ce que les boutons font au texte du message. Pur : aucun éditeur,
//  aucun DOM — on reçoit un texte, on en rend un autre.
//
//  LE BLOC EST VISIBLE DANS L'ÉDITEUR, et c'est voulu. Il aurait été
//  possible de l'ajouter au dernier moment, à l'envoi ; mais alors le
//  joueur cliquerait sans voir ce qu'il demande, et il découvrirait son
//  action une fois le message parti. Là, il le lit avant d'envoyer, et il
//  peut l'enlever d'un second clic.
//
//  UN BOUTON QUI BASCULE, pas un bouton qui empile. Cliquer « Fouiller »
//  deux fois ne fouille pas deux fois : la seconde fois annule. C'est le
//  pendant, côté interface, de la règle « une seule action par message »
//  du domaine — et il vaut mieux que les deux soient d'accord plutôt que
//  l'une rattrape l'autre.
// ════════════════════════════════════════════════════════════════════

import { type Action, actionDe, ecrireUneAction, sansActions } from "../domaine/action.ts";

/** L'action demandée par un texte en cours de rédaction, s'il y en a une. */
export function actionDuBrouillon(texte: string): Action | null {
  return actionDe(texte);
}

/** Le texte sans aucun bloc d'action, et sans les blancs qu'il laisse. */
export function sansAction(texte: string): string {
  return sansActions(texte).replace(/\s+$/, "");
}

/**
 * Le texte avec cette action, et elle seule.
 *
 * Une action déjà présente est remplacée, jamais doublée. Le bloc va en
 * fin de message, séparé par une ligne vide : c'est là qu'on le cherche
 * quand on relit, et ça ne coupe pas une phrase en deux.
 */
export function avecAction(texte: string, action: Action): string {
  const propre = sansAction(texte);
  const bloc = ecrireUneAction(action);
  return propre === "" ? bloc : `${propre}\n\n${bloc}`;
}

/**
 * Ce qu'un clic produit : on pose l'action, ou on la retire si c'est
 * déjà celle-là.
 *
 * Cliquer « Fouiller » quand « Chercher » est posé REMPLACE, sans
 * demander : les deux ne peuvent pas coexister, et une fenêtre de
 * confirmation pour ça serait du bruit.
 */
export function basculer(texte: string, action: Action): string {
  const presente = actionDuBrouillon(texte);
  return memeAction(presente, action) ? sansAction(texte) : avecAction(texte, action);
}

function memeAction(a: Action | null, b: Action): boolean {
  if (a === null || a.type !== b.type) return false;
  return a.type === "chercher" && b.type === "chercher" ? a.lieu === b.lieu : true;
}
