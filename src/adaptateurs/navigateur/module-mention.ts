/// <reference lib="dom" />
// ════════════════════════════════════════════════════════════════════
//  src/adaptateurs/navigateur/module-mention.ts
//
//  COUVERT PAR : outils/sujet.mjs — le bouton posé sur chaque message,
//  l'écriture par l'instance et le repli sur le textarea nu.
//
//  MENTIONNER QUELQU'UN EN UN CLIC.
//
//  ── CE QUI EXISTE DÉJÀ, ET QU'ON NE REFAIT PAS ──────────────────────
//
//  Forumactif a son propre système de mentions, et il est actif sur ce
//  forum : l'éditeur porte un bouton « Mentionner un membre » qui ouvre
//  un panneau avec la liste des membres et un champ de recherche qui
//  prend le focus tout seul, si bien que les lettres suivantes
//  resserrent la liste sans qu'on ait une ligne à écrire pour ça.
//  Relevé le 2 novembre.
//
//  Ce qu'il insère, mot pour mot : `@"Maître du Jeu"` — le nom entre
//  guillemets droits dès qu'il contient une espace. C'est cette forme
//  qu'on reproduit, parce que c'est elle que le forum sait relire pour
//  envoyer la notification.
//
//  ── LA SURFACE D'ÉCRITURE N'EST PAS CELLE QU'ON CROIT ───────────────
//
//  SCEditor a DEUX surfaces : un iframe `contenteditable` en mode
//  WYSIWYG, et un `<textarea>` nu en mode source. Le réglage est celui
//  du membre, pas du forum — le compte Arceus est en mode source.
//
//  Les deux existent dans le DOM en même temps ; seule l'une est
//  vivante. Écrire dans l'iframe pendant que le mode source est actif
//  remplit une surface que personne ne voit et que l'envoi ignore :
//  c'est le bug du 2 novembre, « quand je clique dessus, ça ne tag pas
//  la personne ». `document.execCommand` rendait `false` et je ne le
//  lisais pas.
//
//  Donc on ne choisit plus la surface : on demande à l'instance
//  SCEditor d'écrire, et c'est elle qui sait laquelle est vivante.
//  Elle n'est atteignable que par le magasin `data` de jQuery — ni
//  propriété sur le textarea, ni variable globale. Relevé le
//  2 novembre.
//
//  ── DANS UN SUJET, ET NULLE PART AILLEURS ───────────────────────────
//
//  « Le @ tu l'as mis partout sur le forum, moi je le veux que dans
//  l'affichage d'un sujet », 3 novembre. Et c'était vrai : relevé sur
//  l'index le même jour, deux boutons posés à côté des auteurs de la
//  colonne « dernier message ». `usr_grp_clr` ne dit pas « auteur d'un
//  message » — il dit « membre coloré par son groupe », et Forumactif
//  s'en sert partout : la liste des sujets, la liste des membres, le
//  panneau des notifications, les profils.
//
//  DEUX BARRIÈRES, ET CHACUNE ARRÊTE AUTRE CHOSE :
//
//  1. L'ADRESSE. Elle seule distingue un sujet d'une liste de sujets,
//     parce que les deux pages portent du balisage identique. C'est le
//     même constat que pour `estLIndex` dans `module-vie.ts`. La page de
//     réponse complète (`/post`) passe avec le sujet : elle a l'éditeur
//     et le message cité, demandé le 3 novembre après coup.
//  2. LE MESSAGE. Sur la page d'un sujet, le panneau des notifications
//     porte lui aussi des `usr_grp_clr` — quatre, relevés le
//     3 novembre. Il arrive après nous, donc aujourd'hui il échappe au
//     passage ; compter sur ce retard serait compter sur une course.
// ════════════════════════════════════════════════════════════════════

const CLASSE = "wm-mentionner";
const SELECTEUR_BOUTON = ".sceditor-button-mention";
const SELECTEUR_PANNEAU = ".sceditor-dropdown.sceditor-mention";

/** Ce que ce module demande à l'éditeur du forum, et rien de plus. */
interface InstanceEditeur {
  focus(): void;
  insertText(texte: string): void;
  val(): string;
  bind(nom: string, fn: (e: Event) => void): void;
}

type MagasinJquery = (cible: Element) => { data(clef: string): unknown };

/** Les deux endroits où l'on mentionne quelqu'un, et eux seuls.
 *
 *  LE SUJET AFFICHÉ. Forumactif le sert sur `/t10-le-titre`, sur
 *  `/t10p25-le-titre` à partir de la deuxième page, et sur
 *  `/viewtopic.php?t=10` quand le lien vient d'un ancien message.
 *
 *  ET LA PAGE DE RÉPONSE COMPLÈTE, `/post` — celle du bouton
 *  « Répondre » plutôt que de la réponse rapide. Rouverte le
 *  3 novembre, et relevée avant de l'être : elle porte le même éditeur,
 *  le même bouton « Mentionner un membre », ET le message auquel on
 *  répond, dans un `.post`. Donc l'auteur cité y reçoit son « @ » comme
 *  dans un sujet, et c'est le geste le plus utile des deux.
 *
 *  Ce qui reste dehors, et qui est tout ce qu'on voulait fermer : une
 *  liste de sujets (`/f45-…`), l'index, un profil (`/u4`), la liste des
 *  membres, une page HTML (`/h15-…`). Toutes portent des noms de
 *  membres, aucune n'a d'éditeur. */
export function estUnePageDeMention(chemin: string): boolean {
  return /^\/t\d+(p\d+)?(-|$)/.test(chemin) ||
    /^\/viewtopic\.(php|forum)$/.test(chemin) ||
    /^\/post(\.(php|forum))?$/.test(chemin);
}

/** La forme que Forumactif relit : guillemets droits dès qu'il y a une
 *  espace. Un nom qui en contient déjà est laissé tel quel — le forum
 *  n'en accepte pas, et en inventer un échappement casserait la
 *  relecture au lieu de la sauver. */
export function mentionDe(nom: string): string {
  const propre = nom.trim();
  if (propre === "") return "";
  return /\s/.test(propre) ? `@"${propre}"` : `@${propre}`;
}

/** L'instance SCEditor, ou `null` tant qu'elle n'est pas montée.
 *
 *  On vérifie les quatre méthodes qu'on utilise plutôt que de faire
 *  confiance au nom de la clef : une version de SCEditor qui ne les
 *  aurait pas doit nous faire tomber sur le repli, pas lancer. */
export function instanceEditeur(doc: Document): InstanceEditeur | null {
  const jq = (globalThis as { jQuery?: MagasinJquery }).jQuery;
  if (typeof jq !== "function") return null;
  const zone = doc.querySelector("#text_editor_textarea");
  if (zone === null) return null;
  let trouve: unknown;
  try {
    trouve = jq(zone).data("sceditor");
  } catch {
    return null;
  }
  if (typeof trouve !== "object" || trouve === null) return null;
  const c = trouve as Partial<InstanceEditeur>;
  const complet = typeof c.focus === "function" && typeof c.insertText === "function" &&
    typeof c.val === "function" && typeof c.bind === "function";
  return complet ? (trouve as InstanceEditeur) : null;
}

/** Écrit dans la réponse rapide. Rend `false` s'il n'y a pas d'éditeur.
 *
 *  LE REPLI N'EST PAS L'IFRAME. L'iframe n'existe que si SCEditor est
 *  monté, et s'il est monté l'instance est atteignable et sait mieux
 *  que nous où écrire. Ce qui reste à couvrir, c'est le moment AVANT
 *  qu'il soit monté : là, le textarea nu est bien la surface. */
function ecrire(doc: Document, texte: string): boolean {
  const inst = instanceEditeur(doc);
  if (inst !== null) {
    inst.focus();
    inst.insertText(texte);
    return true;
  }
  const zone = doc.querySelector<HTMLTextAreaElement>("#text_editor_textarea");
  if (zone === null) return false;
  zone.focus();
  const i = zone.selectionEnd ?? zone.value.length;
  zone.value = zone.value.slice(0, i) + texte + zone.value.slice(i);
  zone.selectionStart = zone.selectionEnd = i + texte.length;
  zone.dispatchEvent(new Event("input", { bubbles: true }));
  return true;
}

/** Pose un `@` devant le nom de chaque auteur. Rend le nombre posés. */
export function poserLesMentions(doc: Document): number {
  if (!estUnePageDeMention(doc.location?.pathname ?? "")) return 0;
  //  LE NOM DE L'AUTEUR EST DANS `.usr_grp_clr` : c'est la teinte de
  //  son groupe qui est portée là, pas le nom du groupe. Relevé le
  //  2 novembre — j'ai failli brancher le bouton sur un nom de groupe.
  //
  //  DANS UN MESSAGE. Sans `.post` devant, le même sélecteur ramène
  //  aussi les noms du panneau des notifications, qui est sur la page.
  const noms = [...doc.querySelectorAll<HTMLElement>(".post .usr_grp_clr")];
  let poses = 0;
  for (const n of noms) {
    const nom = n.textContent?.trim() ?? "";
    if (nom === "") continue;
    //  Le bouton se pose à côté du LIEN qui porte le nom, pas dans
    //  lui : dans un `<a>`, un clic suivrait le lien vers le profil.
    const hote = n.closest("a") ?? n;
    //  À GAUCHE DU NOM. « le tag : le placer à gauche par contre ».
    const avant = hote.previousElementSibling;
    if (avant !== null && avant.classList.contains(CLASSE)) continue;

    const bouton = doc.createElement("button");
    bouton.type = "button";
    bouton.className = CLASSE;
    bouton.textContent = "@";
    bouton.title = `Mentionner ${nom}`;
    bouton.setAttribute("aria-label", `Mentionner ${nom}`);
    bouton.addEventListener("click", (e) => {
      e.preventDefault();
      //  SANS ÉDITEUR, ON NE FAIT RIEN ET ON NE DIT RIEN. Un invité
      //  n'a pas de réponse rapide ; lui écrire une erreur serait lui
      //  reprocher de ne pas être connecté.
      ecrire(doc, `${mentionDe(nom)} `);
    });
    hote.insertAdjacentElement("beforebegin", bouton);
    poses += 1;
  }
  return poses;
}

/** Rend la touche avalée si le panneau se ferme sans qu'on ait choisi.
 *
 *  Sinon, frapper `@` puis changer d'avis effacerait un caractère que
 *  la joueuse a bien tapé. Échap ne ferme pas le panneau de Forumactif
 *  (relevé le 2 novembre) : c'est le clic à côté qui le ferme, donc
 *  c'est sa disparition qu'on guette et pas une touche. */
function rendreLArobaseSiRien(doc: Document, inst: InstanceEditeur, avant: string): void {
  //  LE CLIC N'A RIEN OUVERT : on rend le « @ » tout de suite, et
  //  surtout on n'attache pas d'observateur à un panneau qui n'existe
  //  pas — il attendrait une mutation qui peut ne jamais venir.
  //
  //  NON PROUVÉE PAR LE HARNAIS, et je le dis plutôt que de la faire
  //  passer pour mesurée : en retirant cette sortie, le contrôle
  //  « si le panneau ne s'ouvre pas » passe quand même, parce qu'une
  //  mutation sans rapport réveille l'observateur et rend le « @ »
  //  à sa place. Ce qui reste vrai sans elle, c'est la fuite.
  if (doc.querySelector(SELECTEUR_PANNEAU) === null) {
    ecrire(doc, "@");
    return;
  }
  const corps = doc.body;
  if (corps === null) return;
  const obs = new MutationObserver(() => {
    if (doc.querySelector(SELECTEUR_PANNEAU) !== null) return;
    obs.disconnect();
    if (inst.val() === avant) ecrire(doc, "@");
  });
  obs.observe(corps, { childList: true, subtree: true });
}

/** Fait de `@` la touche qui ouvre le panneau de Forumactif.
 *
 *  ON N'ÉCRIT PAS DE SECONDE LISTE. Le panneau du forum connaît les
 *  membres, leurs avatars et leurs droits ; une liste à nous aurait sa
 *  propre source à tenir à jour, et le jour où elles divergeraient
 *  c'est la nôtre qui aurait tort. On clique son bouton, c'est tout.
 *
 *  ON ÉCOUTE L'INSTANCE, PAS UNE SURFACE. `bind` reçoit la frappe dans
 *  les deux modes et survit au basculement de l'un à l'autre ; écouter
 *  l'iframe ne voyait rien de ce qui était tapé en mode source, et
 *  c'est pourquoi « quand je mets @ dans le bloc d'édition, j'ai
 *  personne qui s'affiche ».
 *
 *  ET ON ÉCOUTE `keydown`, PAS `keyup`. Deux raisons mesurées le
 *  2 novembre : `keyup` arrive après que le caractère est écrit, donc
 *  trop tard pour l'empêcher ; et SCEditor appelle l'écouteur de
 *  `keyup` DEUX FOIS pour un seul appui, là où `keydown` n'arrive
 *  qu'une fois.
 */
export function poserLOuvertureAuArobase(doc: Document): boolean {
  const inst = instanceEditeur(doc);
  if (inst === null) return false;
  const marque = inst as InstanceEditeur & { wmArobase?: boolean };
  if (marque.wmArobase === true) return false;
  marque.wmArobase = true;

  inst.bind("keydown", (e: Event) => {
    const touche = e as KeyboardEvent;
    if (touche.key !== "@") return;

    const bouton = doc.querySelector<HTMLElement>(SELECTEUR_BOUTON);
    //  PAS DE PANNEAU, PAS DE DÉTOURNEMENT : on laisse le « @ »
    //  s'écrire normalement plutôt que d'avaler la touche pour rien.
    if (bouton === null) return;

    //  LE « @ » NE S'ÉCRIT PAS. Le panneau insère la mention entière,
    //  `@"Nom"` : en laissant la frappe passer on obtenait
    //  `@ @"Nom"`. Relevé le 2 novembre sur le forum.
    touche.preventDefault();
    const avant = inst.val();
    bouton.click();
    rendreLArobaseSiRien(doc, inst, avant);
  });
  return true;
}

/** Attend que l'instance SCEditor soit montée, puis branche `@`.
 *
 *  ELLE ARRIVE APRÈS NOUS. Le script de Forumactif construit l'éditeur
 *  bien après que le nôtre a fini : brancher tout de suite ne trouve
 *  rien, et attendre un délai au hasard marche sur une machine et pas
 *  sur l'autre. On observe le document, on branche dès qu'elle est là,
 *  et on s'arrête — y compris si elle n'arrive jamais, parce qu'un
 *  invité n'a pas d'éditeur et qu'un observateur qui tourne pour rien
 *  est une fuite.
 */
export function guetterLEditeur(doc: Document, limiteMs = 15000): void {
  //  LA MÊME BARRIÈRE QUE POUR LE BOUTON, et posée AVANT l'observateur
  //  plutôt que dans `poserLOuvertureAuArobase` : ailleurs que dans un
  //  sujet, il n'y a pas seulement rien à brancher, il n'y a rien à
  //  guetter — un observateur qui tourne quinze secondes sur chaque
  //  page pour ne jamais rien trouver est une fuite.
  if (!estUnePageDeMention(doc.location?.pathname ?? "")) return;
  if (poserLOuvertureAuArobase(doc)) return;
  const racine = doc.documentElement;
  if (racine === null) return;
  const obs = new MutationObserver(() => {
    if (poserLOuvertureAuArobase(doc)) obs.disconnect();
  });
  obs.observe(racine, { childList: true, subtree: true });
  globalThis.setTimeout(() => obs.disconnect(), limiteMs);
}
