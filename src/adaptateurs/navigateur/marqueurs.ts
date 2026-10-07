/// <reference lib="dom" />
/// <reference lib="dom.iterable" />
// ════════════════════════════════════════════════════════════════════
//  src/adaptateurs/navigateur/marqueurs.ts
//
//  Les deux blocs de plomberie qu'un message peut porter, rendus
//  invisibles à l'écran :
//
//    · `[[WM:charge:CODE]]`, que l'adaptateur de publication pose au bas
//      de chaque bilan — écrit par le SERVEUR ;
//    · `[[WM-ACTION:<verbe>]]`, que le bouton de la barre pose dans le
//      message — écrit par le NAVIGATEUR, pour le serveur.
//
//  Le second a été ajouté le 3 octobre, après l'avoir vu en clair dans un
//  message posté sur `t976` : `[[WM-ACTION:chercher:etang-vaseux]]` au
//  milieu d'un texte de RP. Personne n'a envie de lire ça, et personne
//  n'a envie de l'écrire non plus — c'est précisément pour ça que le bloc
//  est posé par un bouton.
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

/** Les deux motifs, en une seule expression.
 *
 *  Le premier est celui de `src/adaptateurs/forumactif/marqueur.ts`, le
 *  second celui de `src/domaine/action.ts`. Ils ne sont pas importés de
 *  là : ce module tourne dans le navigateur et n'a pas à tirer l'ÉCRITURE
 *  des deux blocs avec lui, seulement leur forme.
 *
 *  `WM-ACTION` est écrit en premier dans l'alternative : sans ça,
 *  `\[\[WM:` ne correspondrait pas à `[[WM-ACTION:`, mais une future
 *  expression plus gourmande pourrait les confondre. L'ordre le dit.
 *
 *  Exporté pour être testé seul : c'est la seule chose de ce fichier qui
 *  se vérifie sans navigateur, et c'est aussi la seule qui puisse se
 *  tromper en silence — un motif qui ne reconnaît plus rien ne lève pas,
 *  il laisse juste la plomberie en clair dans les messages. */
export const MARQUEUR =
  /\[\[WM-ACTION:[a-z]+(?::[a-z0-9-]+)?\]\]|\[\[WM:[A-Za-z0-9_-]+:[A-Z0-9-]+\]\]/g;

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
