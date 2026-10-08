// ════════════════════════════════════════════════════════════════════
//  src/adaptateurs/navigateur/module-messenger.ts
//
//  Range le bouton du tchat dans le coin d'outils.
//
//  ── POURQUOI DÉPLACER UN NŒUD PLUTÔT QUE LE POSITIONNER ─────────────
//
//  Forumactif Messenger accroche son bouton d'ouverture au corps de la
//  page, en bas à droite, et il y recouvrait le coin d'outils —
//  « CLAIR », les deux flèches, « CONFORT ». Relevé à l'écran le
//  8 octobre, le jour où le tchat s'est allumé.
//
//  On aurait pu le remonter d'une marge. C'est ce qu'on fait quand on
//  n'a pas le choix, et ça se casse au premier bouton ajouté au coin :
//  la marge est un nombre qui dit « la hauteur de ce qu'il y a
//  au-dessus », et personne ne pense à la changer. Cedar Cove, dont
//  Callista veut l'allure, ne fait pas autrement : leur bouton n'est
//  pas flottant, il est DANS leur habillage.
//
//  Le déplacer règle les deux à la fois : la colonne du coin l'empile
//  comme les autres, et le jour où un cinquième outil arrive, il se
//  range tout seul.
//
//  ── POURQUOI UN OBSERVATEUR ET PAS UN DÉLAI ─────────────────────────
//
//  FAM se charge depuis jsDelivr, après nous, et pose son bouton quand
//  il a fini. Un `setTimeout` de deux secondes marche sur une bonne
//  connexion et rate sur une mauvaise — et il tourne pour rien sur les
//  pages où le tchat n'a pas le droit de s'afficher. L'observateur
//  attend le nœud, le range, et S'ARRÊTE : un observateur qui tourne
//  pour rien est une fuite, c'est la leçon de la barre Forumactif.
//
//  Au bout de trente secondes il s'arrête aussi. Si FAM n'est pas là
//  à ce moment, il ne viendra pas : le script est absent, ou le membre
//  n'a pas la permission.
// ════════════════════════════════════════════════════════════════════

/** La classe que le bouton reçoit une fois rangé. La feuille 15 s'en
 *  sert pour lui donner l'allure des autres outils, et le harnais pour
 *  vérifier qu'il a bien été rangé. */
export const CLASSE_RANGE = "wm-messenger-range";

/** Range le bouton s'il est là. Rend `true` s'il l'a fait. */
export function rangerLeBouton(doc: Document): boolean {
  const bouton = doc.querySelector<HTMLElement>("#FAM-button-open");
  const coin = doc.querySelector<HTMLElement>(".wm-coin");
  if (bouton === null || coin === null) return false;
  if (bouton.parentElement === coin) return false;
  //  EN TÊTE DE COLONNE, pas à la fin : le coin se lit de haut en bas
  //  et ses outils vont du plus rare au plus courant — le thème, le
  //  défilement, le confort. Le tchat est ce qu'on ouvre le plus
  //  souvent, il prend la première place.
  coin.insertBefore(bouton, coin.firstChild);
  bouton.classList.add(CLASSE_RANGE);
  return true;
}

/** Guette le bouton de FAM et le range dès qu'il paraît. */
export function rangerLeMessenger(doc: Document, limiteMs = 30_000): void {
  if (rangerLeBouton(doc)) return;
  const corps = doc.body;
  if (corps === null) return;
  const guetteur = new MutationObserver(() => {
    if (rangerLeBouton(doc)) guetteur.disconnect();
  });
  guetteur.observe(corps, { childList: true, subtree: true });
  doc.defaultView?.setTimeout(() => guetteur.disconnect(), limiteMs);
}
