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
import { ecrireUnPanier, type LignePanier, sansPaniers } from "../domaine/panier.ts";

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

// ── LA CLÔTURE ───────────────────────────────────────────────────────
//
//  `[cloture]` N'EST PAS UNE ACTION, et ne passe donc pas par `basculer`.
//  Une action est écrite par nous en `[[WM-ACTION:…]]` et prouvée par un
//  marqueur ; la clôture est un mot que les joueurs tapent déjà à la main
//  aujourd'hui, et que le bouton ne fait que leur épargner. Les deux
//  peuvent coexister dans un même message — on peut fouiller une dernière
//  fois et clôturer dans la foulée.
//
//  DEUX BOUTONS LA POSENT : celui de la barre, sous l'éditeur, et celui du
//  module, au-dessus du premier message (règle 6 de la planche 45). Ils
//  appellent la même fonction, ici, et lisent le même texte : ils ne
//  peuvent donc pas se contredire. C'est la raison d'être de ce déplacement
//  — la règle vivait en double, écrite deux fois.

/** Le mot que le bouton pose. Lu par la relève comme n'importe quelle
 *  demande tapée à la main : même forme, même effet. */
export const MOT_DE_CLOTURE = "[cloture]";

/** `[cloture]`, avec ou sans accent, avec ou sans espaces, en n'importe
 *  quelle casse. Un joueur tape ce qu'il tape — et l'éditeur de Forumactif
 *  peut glisser des balises autour, mais pas DEDANS, parce que le bloc est
 *  posé d'un coup.
 *
 *  **La même expression que `adaptateurs/forumactif/demandes.ts`**, et ce
 *  n'est pas une coïncidence : ce que le bouton pose doit être exactement
 *  ce que la relève reconnaît. Un test le vérifie. */
const EST_UNE_CLOTURE = /\[\s*cl[oô]ture\s*\]/i;

/** Vrai si ce brouillon demande déjà la clôture. */
export function clotureDemandee(texte: string): boolean {
  return EST_UNE_CLOTURE.test(texte);
}

/** Ce qu'un clic sur « Clôturer » produit : on pose le mot, ou on le
 *  retire s'il est déjà là.
 *
 *  Il va en fin de message, comme un bloc d'action : c'est là qu'on le
 *  cherche en relisant, et ça ne coupe pas une phrase. */
export function basculerLaCloture(texte: string): string {
  if (clotureDemandee(texte)) {
    return texte.replace(EST_UNE_CLOTURE, "").replace(/\s+$/, "");
  }
  const propre = texte.replace(/\s+$/, "");
  return propre === "" ? MOT_DE_CLOTURE : `${propre}\n\n${MOT_DE_CLOTURE}`;
}

// ── LE PANIER ────────────────────────────────────────────────────────
//
//  PAS UNE BASCULE, UN REMPLACEMENT. Les boutons d'action et de clôture
//  basculent parce qu'ils n'ont que deux états. Un panier en a autant
//  qu'il y a de combinaisons : à chaque « + » le bloc change, et le
//  seul geste juste est de réécrire celui qui est là.
//
//  LE JOUEUR GARDE SON TEXTE. On ne touche qu'au bloc : ce qu'il a écrit
//  au-dessus part avec sa commande, c'est la règle de la planche 30 —
//  « le message reste un message de joueur, pas un formulaire ».

/** Le texte avec ce panier, et lui seul. Un panier vide retire le bloc.
 *
 *  Le bloc va en fin de message, séparé par une ligne vide, comme les
 *  autres. */
export function poserLePanier(texte: string, lignes: readonly LignePanier[]): string {
  const propre = sansPaniers(texte).replace(/\s+$/, "");
  if (lignes.length === 0) return propre;
  const bloc = ecrireUnPanier(lignes);
  return propre === "" ? bloc : `${propre}\n\n${bloc}`;
}
