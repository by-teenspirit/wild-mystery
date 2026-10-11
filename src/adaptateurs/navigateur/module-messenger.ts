// ════════════════════════════════════════════════════════════════════
//  src/adaptateurs/navigateur/module-messenger.ts
//
//  Habille le bouton du tchat : une bulle ronde en bas à GAUCHE.
//
//  ── CE QUE CE MODULE FAISAIT AVANT, ET POURQUOI IL NE LE FAIT PLUS ──
//
//  Il DÉPLAÇAIT le bouton dans le coin d'outils, et lui collait une
//  étiquette « Tchat » pour qu'il ressemble à ses trois voisins. C'était
//  une réponse au vrai défaut du 8 octobre : FAM pose son bouton en bas
//  à droite, c'est-à-dire PILE sur le coin — relevé à (1380, 840) sur un
//  écran de 1440, par-dessus « CONFORT », qui va jusqu'à (1424, 884).
//
//  « Mets-le plutôt en bas à gauche aussi, tu fais juste une jolie bulle
//  sans le texte, en rond. » Le chevauchement se règle alors par la
//  DISTANCE et non par le rangement : l'autre coin de l'écran est vide,
//  et un lanceur de tchat en bulle ronde est ce que tout le monde
//  reconnaît sans étiquette.
//
//  Il reste quand même du travail pour un module, et c'est le seul qui
//  compte : une bulle sans texte n'a PAS DE NOM. FAM sert
//
//      <a id="FAM-button" title="Forumactif Messenger"><i class="fa fa-comment"></i></a>
//
//  — un `<a>` sans `href`, donc hors du parcours clavier, et dont le
//  seul nom est un `title` qu'il faut survoler pour entendre. Le CSS ne
//  sait ni nommer ni rendre atteignable. Nous, oui.
//
//  ── POURQUOI UN OBSERVATEUR ET PAS UN DÉLAI ─────────────────────────
//
//  FAM se charge depuis jsDelivr, après nous, et pose son bouton quand
//  il a fini. Un `setTimeout` de deux secondes marche sur une bonne
//  connexion et rate sur une mauvaise — et il tourne pour rien sur les
//  pages où le tchat n'a pas le droit de s'afficher. L'observateur
//  attend le nœud, l'habille, et S'ARRÊTE : un observateur qui tourne
//  pour rien est une fuite, c'est la leçon de la barre Forumactif.
//
//  Au bout de trente secondes il s'arrête aussi. Si FAM n'est pas là
//  à ce moment, il ne viendra pas : le script est absent, ou le membre
//  n'a pas la permission.
// ════════════════════════════════════════════════════════════════════

/** La classe que le bouton reçoit une fois habillé. La feuille 15 s'en
 *  sert pour dessiner la bulle, et le harnais pour vérifier qu'elle a
 *  bien été posée.
 *
 *  Elle double le sélecteur d'identifiant de la feuille 15 au lieu de le
 *  remplacer : `#FAM-button` est le nom d'aujourd'hui, la classe est le
 *  nom qu'on maîtrise. Les deux portent les MÊMES déclarations, donc
 *  aucune des deux ne peut battre l'autre — c'est la correction d'un bug
 *  qui a tenu une demi-heure du temps où le bouton avait deux vies, l'une
 *  flottante et l'autre rangée, et où la règle de la première battait
 *  celle de la seconde. Un seul état, une seule allure, plus de duel. */
export const CLASSE_BULLE = "wm-messenger-bulle";

/** Le nom du bouton. Il n'est plus écrit à l'écran — c'est une bulle
 *  ronde et muette —, mais il est ANNONCÉ : `aria-label` le donne au
 *  lecteur d'écran, et `title` l'affiche au survol à la place de
 *  « Forumactif Messenger », qui est le nom du greffon et pas celui de
 *  la chose. */
export const ETIQUETTE = "Tchat";

/** Les identifiants sous lesquels FAM a servi son bouton.
 *
 *  ── POURQUOI DEUX, ET POURQUOI ÇA A RATÉ PENDANT UN JOUR ────────────
 *
 *  Le module cherchait `#FAM-button-open`. Ce nœud N'EXISTE PAS :
 *  relevé sur le forum, FAM sert `#FAM-button`. L'habillage ne partait
 *  donc jamais, l'observateur tournait ses trente secondes pour rien,
 *  et le bouton restait tel quel, en bas à droite, par-dessus le coin
 *  d'outils. C'est le chevauchement que Callista voyait.
 *
 *  On garde les deux noms : `-open` est celui de la documentation du
 *  greffon, et une version plus récente pourrait y revenir. Chercher
 *  deux sélecteurs ne coûte rien ; se tromper d'un seul coûte une
 *  journée. */
export const SELECTEURS_BOUTON = "#FAM-button, #FAM-button-open";

/** Habille le bouton s'il est là. Rend `true` s'il l'a fait. */
export function habillerLeBouton(doc: Document): boolean {
  const bouton = doc.querySelector<HTMLElement>(SELECTEURS_BOUTON);
  if (bouton === null) return false;
  if (bouton.classList.contains(CLASSE_BULLE)) return false;
  bouton.classList.add(CLASSE_BULLE);

  //  ── LE TEXTE S'EN VA, LE NOM RESTE ──────────────────────────────
  //
  //  La version précédente ajoutait un `<span>` « Tchat » dans le
  //  bouton. On l'enlève s'il traîne — un paquet servi en cache peut
  //  très bien être l'ancien pendant dix minutes, c'est la durée de
  //  cache de GitHub Pages — et le nom passe dans `aria-label`.
  //
  //  POURQUOI PAS SE CONTENTER DU `title` DE FAM. Un `title` n'est lu
  //  qu'au survol : au clavier, on tabule sur la bulle et on n'entend
  //  rien. Et il dit « Forumactif Messenger », qui nomme le greffon.
  bouton.querySelector(`.${CLASSE_BULLE}__texte, .wm-messenger-range__texte`)?.remove();
  bouton.setAttribute("aria-label", ETIQUETTE);
  bouton.setAttribute("title", ETIQUETTE);

  //  `<a>` sans `href` : il n'est pas atteignable au clavier tant
  //  qu'on ne lui donne pas de rôle et de rang. FAM écoute le clic,
  //  donc le rôle est bien celui d'un bouton.
  bouton.setAttribute("role", "button");
  if (!bouton.hasAttribute("tabindex")) bouton.setAttribute("tabindex", "0");
  return true;
}

/** Guette le bouton de FAM et l'habille dès qu'il paraît. */
export function habillerLeMessenger(doc: Document, limiteMs = 30_000): void {
  if (habillerLeBouton(doc)) return;
  const corps = doc.body;
  if (corps === null) return;
  const guetteur = new MutationObserver(() => {
    if (habillerLeBouton(doc)) guetteur.disconnect();
  });
  guetteur.observe(corps, { childList: true, subtree: true });
  doc.defaultView?.setTimeout(() => guetteur.disconnect(), limiteMs);
}
