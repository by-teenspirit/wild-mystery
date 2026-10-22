// ════════════════════════════════════════════════════════════════════
//  src/adaptateurs/navigateur/module-messenger.ts
//
//  COUVERT PAR : outils/messenger.mjs — le tiroir du greffon FAM, servi dans l'ordre réel de la cascade.
//  (Garde-fou n° 22 : un module d'interface sans test unitaire doit dire
//   quel harnais le monte, et ce harnais doit tourner dans le CI.)
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

// ════════════════════════════════════════════════════════════════════
//  DEUX PANNEAUX SUR LE MÊME BORD, JAMAIS LES DEUX À LA FOIS
//
//  « Si on ouvre la barre latérale de la barre de navigation, messenger
//  se ferme, et inversement. »
//
//  Le tchat et le panneau latéral sortent tous les deux du bord gauche,
//  sous la barre, au même rang. Ouverts ensemble, le plus large recouvre
//  l'autre et on ne sait plus lequel on lit.
//
//  ── POURQUOI ON CLIQUE SUR LEUR BOUTON AU LIEU DE FERMER NOUS-MÊMES ─
//
//  Chacun des deux a DÉJÀ un propriétaire de son état, et ce
//  propriétaire fait plus que poser une classe :
//
//    · le panneau latéral vit dans `module-navigation.ts`. L'ouvrir ou
//      le fermer bascule la classe, met `aria-expanded`, change
//      `aria-label`, et remplace le losange par une croix. Quatre
//      choses, et une cinquième le jour où la maquette en demande une ;
//    · le tiroir du tchat vit dans FAM. `FAM.toggle()` bascule
//      `data-hidden`, restaure l'historique à l'ouverture et rend le
//      défilement du corps en plein écran.
//
//  Réécrire une fermeture ici, c'est reprendre ces listes — et les
//  laisser diverger au premier changement de l'un des deux. On déclenche
//  donc LEUR propre commande, celle que la personne aurait cliquée.
//
//  ── ET POURQUOI ÇA NE BOUCLE PAS ────────────────────────────────────
//
//  C'est la seule vraie difficulté. Fermer A en cliquant le bouton de A
//  rejoue l'écouteur ci-dessous, qui pourrait fermer B, qui est en train
//  de s'ouvrir.
//
//  La garde n'est pas un drapeau, c'est la CONDITION ELLE-MÊME : on ne
//  ferme l'autre que si celui qu'on vient de cliquer était FERMÉ, donc
//  s'il est en train de s'ouvrir. Le clic qu'on déclenche, lui, porte
//  toujours sur un panneau OUVERT — il ne remplit donc jamais la
//  condition, et la chaîne s'arrête d'elle-même, sans état à tenir.
//
//  ── POURQUOI EN CAPTURE SUR LE DOCUMENT ─────────────────────────────
//
//  Il faut lire l'état AVANT que le propriétaire ne le change. Sur
//  l'élément lui-même, l'ordre entre deux écouteurs de la phase cible
//  est l'ordre d'inscription — et FAM s'inscrit quand il veut, puisqu'il
//  se charge après nous. En capture sur le document, on passe avant
//  tout écouteur posé sur les boutons, quel qu'il soit et quand qu'il
//  soit venu.
// ════════════════════════════════════════════════════════════════════

/** Le bouton qui ouvre et ferme le panneau latéral de la barre. */
export const SELECTEUR_LOGO = ".wm-nav__logo";

/** Vrai si le tiroir du tchat est ouvert. L'état est `data-hidden` sur
 *  `#FAM`, relevé dans le `fam.js` du fork : `"false"` veut dire
 *  ouvert. Absent — pas de tiroir sur la page —, c'est fermé. */
export function messengerOuvert(doc: Document): boolean {
  return doc.querySelector("#FAM")?.getAttribute("data-hidden") === "false";
}

/** Vrai si le panneau latéral est ouvert. On lit `aria-expanded` sur son
 *  bouton plutôt que la classe du panneau : c'est l'état que
 *  `module-navigation.ts` publie, et celui qu'un lecteur d'écran lit. */
export function panneauOuvert(doc: Document): boolean {
  return doc.querySelector(SELECTEUR_LOGO)?.getAttribute("aria-expanded") === "true";
}

/** Rend les deux panneaux exclusifs. À appeler une fois par page. */
export function exclureLesDeuxPanneaux(doc: Document): void {
  doc.addEventListener("click", (e) => {
    const cible = e.target;
    if (!(cible instanceof Element)) return;
    //  On clique le bouton du tchat, et le tchat est FERMÉ : il s'ouvre.
    if (cible.closest(SELECTEURS_BOUTON) !== null && !messengerOuvert(doc)) {
      if (panneauOuvert(doc)) doc.querySelector<HTMLElement>(SELECTEUR_LOGO)?.click();
      return;
    }
    //  On clique le logo, et le panneau est FERMÉ : il s'ouvre.
    if (cible.closest(SELECTEUR_LOGO) !== null && !panneauOuvert(doc)) {
      if (messengerOuvert(doc)) {
        doc.querySelector<HTMLElement>(SELECTEURS_BOUTON)?.click();
      }
    }
  }, true);
}

/** Guette le bouton de FAM et l'habille dès qu'il paraît. */
export function habillerLeMessenger(doc: Document, limiteMs = 30_000): void {
  //  L'EXCLUSION SE POSE TOUT DE SUITE, et pas quand le bouton paraît :
  //  l'écouteur est sur le document, il n'a besoin d'aucun des deux
  //  panneaux pour exister, et le panneau latéral, lui, est déjà là. Un
  //  seul écouteur, posé une fois, qui ne cherche rien tant qu'on ne
  //  clique pas.
  exclureLesDeuxPanneaux(doc);
  if (habillerLeBouton(doc)) return;
  const corps = doc.body;
  if (corps === null) return;
  const guetteur = new MutationObserver(() => {
    if (habillerLeBouton(doc)) guetteur.disconnect();
  });
  guetteur.observe(corps, { childList: true, subtree: true });
  doc.defaultView?.setTimeout(() => guetteur.disconnect(), limiteMs);
}
