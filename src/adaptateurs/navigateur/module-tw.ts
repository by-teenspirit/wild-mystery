/// <reference lib="dom" />
// ════════════════════════════════════════════════════════════════════
//  src/adaptateurs/navigateur/module-tw.ts
//
//  COUVERT PAR : outils/annonces.mjs
//
//  LE PASSAGE MASQUÉ D'UN MESSAGE — la balise `<tw>` de la planche 39.
//
//  ── CE QUE LE JOUEUR ÉCRIT ──────────────────────────────────────────
//
//      <tw data-wm-tw="violence graphique · blessure décrite">
//        Le sang gelait déjà sur la pierre…
//      </tw>
//
//  `tw` n'est pas une balise HTML. C'est voulu : un nom inconnu est
//  analysé comme un élément EN LIGNE ordinaire, ses enfants sont
//  conservés tels quels, et l'éditeur Forumactif le laisse passer
//  parce qu'il ne lui connaît pas de règle. Une balise connue et
//  détournée — `<mark>`, `<aside>` — serait mise en forme par la
//  feuille du forum avant qu'on arrive.
//
//  Le libellé est facultatif. Sans lui, on écrit « contenu sensible » :
//  dire QU'IL Y A quelque chose vaut mieux que ne rien dire, même
//  quand on ne sait pas quoi.
//
//  ── LE FLOU N'EST PAS UNE SÉCURITÉ ──────────────────────────────────
//
//  La note de la planche, mot pour mot : « Le flou n'est pas une
//  sécurité : le texte est dans la page. Il lui faut donc aussi
//  aria-hidden, user-select:none, et un vrai bouton qui dit ce qu'il
//  cache — jamais un simple "cliquez pour afficher". »
//
//  Les trois tiennent ensemble, et chacune couvre un trou des deux
//  autres :
//
//    · LE FLOU ne protège que l'œil qui ne cherche pas. Il ne protège
//      ni le copier-coller, ni la synthèse vocale, ni la recherche de
//      la page.
//    · `aria-hidden` sort le passage de l'arbre d'accessibilité : un
//      lecteur d'écran ne lira pas à voix haute ce que l'écran cache.
//      Sans lui, l'avertissement ne protège personne qui écoute.
//    · `user-select: none` empêche la sélection, donc le texte qu'on
//      révèle sans le vouloir en glissant la souris.
//
//  Et c'est la raison pour laquelle ce module ne RETIRE pas le texte
//  du DOM pour le remettre au clic : retiré, il disparaîtrait aussi de
//  la citation, de l'impression et de la copie du message. Le choix
//  est de le cacher honnêtement, pas de faire semblant qu'il n'est pas
//  là. Qui ouvre le code source le trouve : c'est un avertissement,
//  pas un coffre.
//
//  ── UN VRAI BOUTON ─────────────────────────────────────────────────
//
//  `<button type="button">`, pas un `<div>` avec un écouteur. Il est
//  atteignable au clavier, il répond à Entrée et à Espace sans qu'on
//  écrive une ligne, et il s'annonce comme un bouton. `aria-expanded`
//  et `aria-controls` disent ce qu'il ouvre.
//
//  Le libellé NOMME ce qu'il cache — « Afficher ce passage », et le
//  détail à côté. La planche interdit « cliquez pour afficher » : un
//  avertissement qui n'avertit de rien ne sert qu'à faire cliquer.
// ════════════════════════════════════════════════════════════════════

const SANS_LIBELLE = "contenu sensible";

/** Le libellé d'un avertissement, dans l'ordre où on le cherche. */
function libelleDe(balise: Element): string {
  for (const nom of ["data-wm-tw", "data-mot", "title"]) {
    const lu = balise.getAttribute(nom);
    if (lu !== null && lu.trim() !== "") return lu.trim();
  }
  return SANS_LIBELLE;
}

/**
 * Remplace chaque `<tw>` d'un document par un passage masqué.
 * Rend le nombre de passages posés.
 */
export function poserLesAvertissements(doc: Document): number {
  //  ON NE TRAITE QUE LE CORPS DES MESSAGES. Une balise `<tw>` écrite
  //  ailleurs — un titre de forum, une description — n'a pas de place
  //  où déplier un bloc, et on ne va pas casser la mise en page d'un
  //  endroit pour un avertissement qui s'y lit déjà en clair.
  const balises = doc.querySelectorAll(
    ".postbody .content tw, .postbody .content .wm-tw-source",
  );
  let pose = 0;
  for (const balise of Array.from(balises)) {
    //  Déjà posé : le module peut être rappelé après un chargement de
    //  page partiel, et poser deux boutons sur le même passage.
    if (balise.closest(".wm-tw") !== null) continue;

    const mot = libelleDe(balise);
    const numero = `wm-tw-${pose + 1}-${Math.random().toString(36).slice(2, 7)}`;

    const bloc = doc.createElement("div");
    bloc.className = "wm-tw";

    const tete = doc.createElement("div");
    tete.className = "wm-tw__tete";

    const bouton = doc.createElement("button");
    bouton.type = "button";
    bouton.className = "wm-tw__bouton";
    bouton.textContent = "Afficher ce passage";
    bouton.setAttribute("aria-expanded", "false");
    bouton.setAttribute("aria-controls", numero);

    const etiquette = doc.createElement("span");
    etiquette.className = "wm-tw__mot";
    etiquette.textContent = mot;

    const passage = doc.createElement("div");
    passage.className = "wm-tw__passage";
    passage.id = numero;
    passage.setAttribute("aria-hidden", "true");
    //  LE CONTENU PASSE TEL QUEL, nœud par nœud : un passage peut
    //  porter du gras, un lien, une image. Recopier `innerHTML`
    //  marcherait aussi, et réanalyserait du balisage déjà analysé —
    //  une occasion de le changer sans le vouloir.
    while (balise.firstChild !== null) passage.appendChild(balise.firstChild);

    tete.appendChild(bouton);
    tete.appendChild(etiquette);
    bloc.appendChild(tete);
    bloc.appendChild(passage);

    bouton.addEventListener("click", () => {
      const ouvert = bloc.classList.toggle("wm-tw--ouvert");
      bouton.setAttribute("aria-expanded", ouvert ? "true" : "false");
      //  `aria-hidden` suit l'état visible, sans quoi un lecteur
      //  d'écran continuerait de sauter le passage qu'on vient
      //  d'ouvrir — l'inverse exact du défaut qu'on corrige.
      passage.setAttribute("aria-hidden", ouvert ? "false" : "true");
      bouton.textContent = ouvert ? "Masquer ce passage" : "Afficher ce passage";
    });

    balise.replaceWith(bloc);
    pose += 1;
  }
  return pose;
}
