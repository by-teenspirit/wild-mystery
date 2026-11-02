/// <reference lib="dom" />
// ════════════════════════════════════════════════════════════════════
//  src/adaptateurs/navigateur/module-mention.ts
//
//  COUVERT PAR : outils/sujet.mjs — le bouton posé sur chaque message.
//
//  MENTIONNER QUELQU'UN EN UN CLIC.
//
//  ── CE QUI EXISTE DÉJÀ, ET QU'ON NE REFAIT PAS ──────────────────────
//
//  Forumactif a son propre système de mentions, et il est actif sur ce
//  forum : l'éditeur porte un bouton « Mentionner un membre » qui ouvre
//  un champ de recherche et une liste de membres avec leurs avatars,
//  liste qui se resserre à chaque lettre. Relevé le 2 novembre.
//
//  Ce qu'il insère, mot pour mot : `@"Maître du Jeu"` — le nom entre
//  guillemets droits dès qu'il contient une espace. C'est cette forme
//  qu'on reproduit, parce que c'est elle que le forum sait relire pour
//  envoyer la notification.
//
//  ── LES DEUX CHOSES QUI MANQUAIENT ──────────────────────────────────
//
//  1. **Mentionner l'auteur d'un message d'un seul clic.** Le nom est
//     déjà là, en haut de son message ; aller rouvrir un panneau pour
//     y retaper ce nom est un détour. Un `@` discret se pose à côté.
//
//  2. **Taper `@` ouvre la liste.** Le panneau existe, mais il
//     s'ouvre par un bouton de barre d'outils qu'on ne trouve pas si
//     on ne le cherche pas. Frapper `@` est le geste que tout le monde
//     a appris ailleurs ; on le branche sur le MÊME panneau plutôt que
//     d'en écrire un second, qui aurait sa propre liste de membres à
//     tenir à jour et son propre désaccord avec le forum.
// ════════════════════════════════════════════════════════════════════

const CLASSE = "wm-mentionner";

/** La forme que Forumactif relit : guillemets droits dès qu'il y a une
 *  espace. Un nom qui en contient déjà est laissé tel quel — le forum
 *  n'en accepte pas, et en inventer un échappement casserait la
 *  relecture au lieu de la sauver. */
export function mentionDe(nom: string): string {
  const propre = nom.trim();
  if (propre === "") return "";
  return /\s/.test(propre) ? `@"${propre}"` : `@${propre}`;
}

/** L'éditeur de la réponse rapide, dans ses deux états : `sceditor`
 *  monté (un iframe `contenteditable`) ou le `<textarea>` nu, qui est
 *  ce qu'on a tant que le script de Forumactif n'a pas fini. */
function editeur(doc: Document): { ecrire: (texte: string) => void } | null {
  const cadre = doc.querySelector<HTMLIFrameElement>(".sceditor-container iframe");
  const corps = cadre?.contentDocument?.body;
  if (corps !== undefined && corps !== null && corps.isContentEditable) {
    return {
      ecrire: (texte) => {
        corps.focus();
        const d = corps.ownerDocument;
        //  AU POINT D'INSERTION S'IL EST DANS L'ÉDITEUR, à la fin
        //  sinon : on ne déplace pas le curseur de quelqu'un qui
        //  était en train d'écrire au milieu de sa phrase.
        const sel = d.getSelection();
        const dedans = sel !== null && sel.rangeCount > 0 &&
          corps.contains(sel.getRangeAt(0).commonAncestorContainer);
        if (!dedans) {
          const r = d.createRange();
          r.selectNodeContents(corps);
          r.collapse(false);
          sel?.removeAllRanges();
          sel?.addRange(r);
        }
        d.execCommand("insertText", false, texte);
      },
    };
  }
  const zone = doc.querySelector<HTMLTextAreaElement>("#text_editor_textarea");
  if (zone === null) return null;
  return {
    ecrire: (texte) => {
      zone.focus();
      const i = zone.selectionEnd ?? zone.value.length;
      zone.value = zone.value.slice(0, i) + texte + zone.value.slice(i);
      zone.selectionStart = zone.selectionEnd = i + texte.length;
      zone.dispatchEvent(new Event("input", { bubbles: true }));
    },
  };
}

/** Pose un `@` à côté du nom de chaque auteur. Rend le nombre posés. */
export function poserLesMentions(doc: Document): number {
  //  LE NOM DE L'AUTEUR EST DANS `.usr_grp_clr` : c'est la teinte de
  //  son groupe qui est portée là, pas le nom du groupe. Relevé le
  //  2 novembre — j'ai failli brancher le bouton sur un nom de groupe.
  const noms = [...doc.querySelectorAll<HTMLElement>(".usr_grp_clr")];
  let poses = 0;
  for (const n of noms) {
    const nom = n.textContent?.trim() ?? "";
    if (nom === "") continue;
    //  Le bouton se pose à côté du LIEN qui porte le nom, pas dans
    //  lui : dans un `<a>`, un clic suivrait le lien vers le profil.
    const hote = n.closest("a") ?? n;
    const apres = hote.nextElementSibling;
    if (apres !== null && apres.classList.contains(CLASSE)) continue;

    const bouton = doc.createElement("button");
    bouton.type = "button";
    bouton.className = CLASSE;
    bouton.textContent = "@";
    bouton.title = `Mentionner ${nom}`;
    bouton.setAttribute("aria-label", `Mentionner ${nom}`);
    bouton.addEventListener("click", (e) => {
      e.preventDefault();
      const ed = editeur(doc);
      //  SANS ÉDITEUR, ON NE FAIT RIEN ET ON NE DIT RIEN. Un invité
      //  n'a pas de réponse rapide ; lui écrire une erreur serait lui
      //  reprocher de ne pas être connecté.
      if (ed === null) return;
      ed.ecrire(`${mentionDe(nom)} `);
    });
    hote.insertAdjacentElement("afterend", bouton);
    poses += 1;
  }
  return poses;
}

/** Fait de `@` la touche qui ouvre le panneau de Forumactif.
 *
 *  ON N'ÉCRIT PAS DE SECONDE LISTE. Le panneau du forum connaît les
 *  membres, leurs avatars et leurs droits ; une liste à nous aurait sa
 *  propre source à tenir à jour, et le jour où elles divergeraient
 *  c'est la nôtre qui aurait tort. On clique son bouton, c'est tout.
 *
 *  LE `@` RESTE TAPÉ. Le panneau insère la mention complète par-dessus
 *  ce qu'on écrit ; l'effacer d'avance supposerait qu'on va choisir
 *  quelqu'un, et quitter le panneau laisserait un trou.
 */
export function poserLOuvertureAuArobase(doc: Document): boolean {
  const bouton = doc.querySelector<HTMLElement>(".sceditor-button-mention");
  const cadre = doc.querySelector<HTMLIFrameElement>(".sceditor-container iframe");
  const corps = cadre?.contentDocument?.body;
  if (bouton === null || corps === undefined || corps === null) return false;
  if (corps.dataset.wmArobase === "1") return false;
  corps.dataset.wmArobase = "1";

  corps.addEventListener("keyup", (e) => {
    if ((e as KeyboardEvent).key !== "@") return;
    bouton.click();
  });
  return true;
}

/** Attend que `sceditor` soit monté, puis branche la touche `@`.
 *
 *  IL ARRIVE APRÈS NOUS. Le script de Forumactif construit l'éditeur
 *  bien après que le nôtre a fini : brancher tout de suite ne trouve
 *  rien, et attendre un délai au hasard marche sur une machine et pas
 *  sur l'autre. On observe le document, on branche dès que l'iframe
 *  est là, et on s'arrête — y compris si elle n'arrive jamais, parce
 *  qu'un invité n'a pas d'éditeur et qu'un observateur qui tourne pour
 *  rien est une fuite.
 */
export function guetterLEditeur(doc: Document, limiteMs = 15000): void {
  if (poserLOuvertureAuArobase(doc)) return;
  const racine = doc.documentElement;
  if (racine === null) return;
  const obs = new MutationObserver(() => {
    if (poserLOuvertureAuArobase(doc)) obs.disconnect();
  });
  obs.observe(racine, { childList: true, subtree: true });
  globalThis.setTimeout(() => obs.disconnect(), limiteMs);
}
