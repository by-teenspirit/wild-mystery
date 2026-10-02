/// <reference lib="dom" />
/// <reference lib="dom.iterable" />
// ════════════════════════════════════════════════════════════════════
//  src/adaptateurs/navigateur/marqueurs.ts
//
//  Le marqueur `[[WM:charge:CODE]]` que l'adaptateur de publication pose
//  au bas de chaque bilan, rendu invisible à l'écran.
//
//  ON LE MASQUE, ON NE LE RETIRE PAS. C'est lui qui permet de reconnaître
//  un bilan déjà publié quand un envoi échoue sans réponse : sans lui,
//  une coupure réseau devient une incertitude qu'un humain doit lever à
//  la main. Il doit donc rester dans le texte du message, pour toujours,
//  et seulement disparaître de la vue.
//
//  D'où un `<span hidden>` et pas une suppression : le texte reste dans
//  la source du message, la relève le relit, et un joueur qui cite le
//  message le recopie sans s'en apercevoir — ce qui est exactement ce
//  qu'on veut.
// ════════════════════════════════════════════════════════════════════

/** Le même motif que `src/adaptateurs/forumactif/marqueur.ts`, appliqué
 *  au texte rendu. Il n'est pas importé de là : ce module-ci tourne dans
 *  le navigateur et n'a pas à tirer l'écriture du marqueur avec lui. */
const MARQUEUR = /\[\[WM:[A-Za-z0-9_-]+:[A-Z0-9-]+\]\]/g;

/** Les blocs de message de ModernBB, et rien d'autre : on ne va pas
 *  réécrire le texte de toute la page. */
const CORPS = ".postbody .content";

function masquerDansUnNoeud(texte: Text, doc: Document): void {
  const contenu = texte.data;
  MARQUEUR.lastIndex = 0;
  if (!MARQUEUR.test(contenu)) return;

  MARQUEUR.lastIndex = 0;
  const morceaux = doc.createDocumentFragment();
  let curseur = 0;
  for (const trouve of contenu.matchAll(MARQUEUR)) {
    const debut = trouve.index ?? 0;
    if (debut > curseur) {
      morceaux.appendChild(doc.createTextNode(contenu.slice(curseur, debut)));
    }
    const cache = doc.createElement("span");
    cache.className = "wm-marqueur";
    cache.hidden = true;
    cache.textContent = trouve[0];
    morceaux.appendChild(cache);
    curseur = debut + trouve[0].length;
  }
  if (curseur < contenu.length) {
    morceaux.appendChild(doc.createTextNode(contenu.slice(curseur)));
  }
  texte.replaceWith(morceaux);
}

/** Masque tous les marqueurs des messages de la page. Rend le nombre de
 *  marqueurs masqués, ce qui rend la fonction vérifiable. */
export function masquerLesMarqueurs(doc: Document): number {
  let masques = 0;
  for (const corps of doc.querySelectorAll(CORPS)) {
    //  On collecte avant de modifier : remplacer un nœud pendant qu'on
    //  parcourt l'arbre fait sauter des nœuds au parcours.
    const parcours = doc.createTreeWalker(corps, NodeFilter.SHOW_TEXT);
    const textes: Text[] = [];
    while (parcours.nextNode()) textes.push(parcours.currentNode as Text);

    for (const texte of textes) {
      MARQUEUR.lastIndex = 0;
      const combien = (texte.data.match(MARQUEUR) ?? []).length;
      if (combien === 0) continue;
      masquerDansUnNoeud(texte, doc);
      masques += combien;
    }
  }
  return masques;
}
