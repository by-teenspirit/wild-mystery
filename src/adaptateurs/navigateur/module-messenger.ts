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

/** L'étiquette qu'on ajoute sous l'icône, comme aux trois autres
 *  outils du coin. */
export const ETIQUETTE = "Tchat";

/** Les identifiants sous lesquels FAM a servi son bouton.
 *
 *  ── POURQUOI DEUX, ET POURQUOI ÇA A RATÉ PENDANT UN JOUR ────────────
 *
 *  Le module cherchait `#FAM-button-open`. Ce nœud N'EXISTE PAS :
 *  relevé sur le forum, FAM sert
 *
 *      <a id="FAM-button" title="Forumactif Messenger"><i class="fa fa-comment"></i></a>
 *
 *  Le rangement ne partait donc jamais, l'observateur tournait ses
 *  trente secondes pour rien, et le bouton restait là où FAM le pose —
 *  en bas à droite, à (1380, 840) sur un écran de 1440, c'est-à-dire
 *  EXACTEMENT par-dessus le bouton « Confort » du coin, qui occupe
 *  jusqu'à (1424, 884). C'est le chevauchement que Callista voyait.
 *
 *  On garde les deux noms : `-open` est celui de la documentation du
 *  greffon, et une version plus récente pourrait y revenir. Chercher
 *  deux sélecteurs ne coûte rien ; se tromper d'un seul coûte une
 *  journée. */
export const SELECTEURS_BOUTON = "#FAM-button, #FAM-button-open";

/** Range le bouton s'il est là. Rend `true` s'il l'a fait. */
export function rangerLeBouton(doc: Document): boolean {
  const bouton = doc.querySelector<HTMLElement>(SELECTEURS_BOUTON);
  const coin = doc.querySelector<HTMLElement>(".wm-coin");
  if (bouton === null || coin === null) return false;
  if (bouton.parentElement === coin) return false;
  //  EN TÊTE DE COLONNE, pas à la fin : le coin se lit de haut en bas
  //  et ses outils vont du plus rare au plus courant — le thème, le
  //  défilement, le confort. Le tchat est ce qu'on ouvre le plus
  //  souvent, il prend la première place.
  coin.insertBefore(bouton, coin.firstChild);
  //  `wm-coin__bouton` AUSSI, et c'est le point : la feuille 10 tient
  //  déjà l'alignement de la colonne — icône de largeur fixe à gauche,
  //  étiquette à sa droite, même rembourrage, même casse. Lui donner
  //  une allure à part dans la feuille 15 aurait voulu dire la tenir
  //  d'accord avec l'autre à chaque changement.
  bouton.classList.add("wm-coin__bouton", CLASSE_RANGE);

  //  L'ÉTIQUETTE MANQUE, et elle manque à deux publics. FAM ne met
  //  qu'une icône et un attribut `title` : à l'œil, le tchat est le
  //  seul outil muet d'une colonne où les trois autres s'annoncent ;
  //  au clavier et au lecteur d'écran, un `title` sur un `<a>` sans
  //  texte est un nom qu'on n'entend qu'en s'arrêtant dessus.
  if (bouton.querySelector(`.${CLASSE_RANGE}__texte`) === null) {
    const mot = doc.createElement("span");
    mot.className = `${CLASSE_RANGE}__texte`;
    mot.textContent = ETIQUETTE;
    bouton.appendChild(mot);
  }
  //  `<a>` sans `href` : il n'est pas atteignable au clavier tant
  //  qu'on ne lui donne pas de rôle et de rang. FAM écoute le clic,
  //  donc le rôle est bien celui d'un bouton.
  bouton.setAttribute("role", "button");
  if (!bouton.hasAttribute("tabindex")) bouton.setAttribute("tabindex", "0");
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
