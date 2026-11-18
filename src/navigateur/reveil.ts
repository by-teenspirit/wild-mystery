// ════════════════════════════════════════════════════════════════════
//  src/navigateur/reveil.ts
//
//  Faut-il réveiller la relève, et combien de temps guetter sa réponse.
//  Pur : aucun DOM, aucun réseau — on reçoit l'état de la page, on rend
//  une décision.
//
//  « Toutes les cinq minutes, c'est trop long, la personne ne va pas
//  attendre cinq minutes avant d'avoir sa réponse. On peut pas avoir
//  quelque chose d'immédiat ? » — 18 novembre.
//
//  ── POURQUOI ON PEUT SONNER ─────────────────────────────────────────
//
//  La fonction `releve` est déployée sans vérification de jeton, et
//  elle prend un VERROU avant de travailler (migration 0005). Deux
//  conséquences : n'importe qui peut lui dire « passe maintenant », et
//  dire ça dix fois ne fait pas dix passages — le second se heurte au
//  verrou et rend la main tout de suite.
//
//  On ne lui envoie donc rien : pas de clé, pas d'identité, pas de
//  numéro de sujet. Le réveil ne demande pas un traitement
//  particulier, il demande un passage, et le passage lit ce qu'il a
//  toujours lu.
//
//  ── ON NE SONNE QUE SI ON A QUELQUE CHOSE À ATTENDRE ────────────────
//
//  C'est-à-dire : le dernier message du sujet est de moi, et il porte
//  une action. Sans cette garde, chaque ouverture de n'importe quel
//  sujet réveillerait la fonction — et la relève tournerait des
//  centaines de fois par jour pour rien.
//
//  ET PAS « UN MESSAGE DE MOI AVEC UNE ACTION », N'IMPORTE OÙ : le
//  DERNIER. Si le Maître du Jeu a déjà répondu, sa réponse est là,
//  sous les yeux, et il n'y a plus rien à attendre.
// ════════════════════════════════════════════════════════════════════

/** Ce que la page sait d'elle-même au moment de décider. */
export type EtatDeLaPage = {
  /** Le dernier message du sujet porte-t-il une action ? */
  readonly derniereActionEstLaMienne: boolean;
  /** Depuis combien de secondes la page est ouverte sur cet état. Sert
   *  à ne pas sonner pour un vieux message qu'on relit des heures
   *  après. `null` quand on ne sait pas dater. */
  readonly ageDuMessage: number | null;
};

/** Au-delà, ce n'est plus une action qu'on vient de poster : c'est un
 *  sujet qu'on relit. La relève de cinq minutes est passée depuis
 *  longtemps, et si elle n'a rien posté c'est qu'il n'y avait rien à
 *  poster. */
export const TROP_VIEUX = 600;

/** Combien de temps guetter la réponse, et à quel rythme.
 *
 *  ── UN RYTHME QUI SE RELÂCHE ────────────────────────────────────────
 *
 *  « C'est plus rapide, mais c'est encore un peu lent avant d'avoir une
 *  réaction. » — 18 novembre.
 *
 *  LE PAS RÉGULIER DE DEUX SECONDES ÉTAIT LE COUPABLE, et pas le
 *  passage : un passage lit le forum, calcule et poste en deux à
 *  quatre secondes — c'est ce que dit le journal de la relève. Avec un
 *  regard toutes les deux secondes, une réponse arrivée à 2,1 s se
 *  voyait à 4 s. On attendait deux fois le temps du travail.
 *
 *  ON REGARDE DONC CHAQUE SECONDE AU DÉBUT, là où la réponse tombe, et
 *  de plus en plus espacé ensuite, là où il ne reste qu'à patienter.
 *  Dix-huit regards sur quarante secondes, contre quinze sur trente :
 *  presque le même coût, deux fois moins d'attente dans le cas
 *  courant, et dix secondes de marge en plus pour un passage lent.
 *
 *  AU-DELÀ DE QUARANTE SECONDES, CE N'EST PLUS UNE ATTENTE, c'est une
 *  panne — et une panne ne se guette pas, elle se dit. Le cron de cinq
 *  minutes reste derrière de toute façon. */
export type Palier = { readonly jusqua: number; readonly pas: number };

export const GUET: readonly Palier[] = [
  { jusqua: 6, pas: 1 },
  { jusqua: 20, pas: 2 },
  { jusqua: 40, pas: 4 },
];

export function faut_il_sonner(etat: EtatDeLaPage): boolean {
  if (!etat.derniereActionEstLaMienne) return false;
  //  SANS DATE, ON SONNE. Ne pas savoir dater est le cas d'un gabarit
  //  qu'on n'a pas prévu ; refuser alors de sonner rendrait la
  //  fonctionnalité muette sans que personne comprenne pourquoi, alors
  //  qu'un réveil de trop ne coûte qu'un passage à vide.
  if (etat.ageDuMessage === null) return true;
  return etat.ageDuMessage >= 0 && etat.ageDuMessage <= TROP_VIEUX;
}

/** Les instants où regarder si la réponse est arrivée, en secondes
 *  depuis le réveil. */
export function instantsDuGuet(paliers: readonly Palier[] = GUET): readonly number[] {
  const instants: number[] = [];
  let t = 0;
  for (const palier of paliers) {
    const { jusqua, pas } = palier;
    //  UN PALIER ABÎMÉ EST SAUTÉ, PAS DEVINÉ. Un pas nul ou négatif
    //  ferait une boucle sans fin, et une borne qu'on a déjà dépassée
    //  n'a rien à ajouter — dans les deux cas on passe au suivant
    //  plutôt que d'inventer un rythme.
    if (!Number.isFinite(jusqua) || !Number.isFinite(pas) || pas <= 0) continue;
    while (t + pas <= jusqua) {
      t += pas;
      instants.push(t);
    }
  }
  return instants;
}
