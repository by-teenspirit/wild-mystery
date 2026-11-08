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

/** Le libellé d'un avertissement, ou `null` s'il n'en porte pas. */
function libelleDe(balise: Element): string | null {
  for (const nom of ["data-wm-tw", "data-mot", "title"]) {
    const lu = balise.getAttribute(nom);
    if (lu !== null && lu.trim() !== "") return lu.trim();
  }
  return null;
}

//  ── CE QUI NE PEUT PAS ÊTRE MASQUÉ EN LIGNE ─────────────────────────
//
//  Le mode en ligne met le passage dans un `<button>`. Un bouton ne
//  peut contenir ni lien, ni autre bouton, ni champ — c'est interdit
//  par HTML, et les navigateurs s'en tirent chacun à leur façon. Un
//  bloc entier dans un bouton en ligne ne tient pas non plus.
//
//  Une balise `<tw>` nue qui contient l'un des deux repasse donc en
//  encadré. Elle garde alors son bouton et son libellé par défaut :
//  on perd le mode demandé, jamais le masquage.
const INTERDITS = "a, button, input, select, textarea, iframe, " +
  "p, div, ul, ol, table, blockquote, h1, h2, h3, h4, h5, h6";

function tientEnLigne(balise: Element): boolean {
  return balise.querySelector(INTERDITS) === null;
}

/**
 * Le mode EN LIGNE : un mot, une phrase, floutés dans la phrase qui
 * les porte. Pas d'encadré, pas de « Afficher ce passage » — le
 * survol suffit. Demandé le 8 novembre.
 *
 * ── POURQUOI UN BOUTON QUAND MÊME ──────────────────────────────────
 *
 * Parce que le survol n'existe pas partout. Au doigt il n'y a pas de
 * survol du tout, et au clavier non plus : sans élément focalisable,
 * le passage serait définitivement illisible pour qui n'a pas de
 * souris. Le bouton ne se voit pas — ni cadre, ni fond, ni curseur de
 * texte changé — mais il rend le passage atteignable par Tab et par
 * un doigt.
 *
 * Trois façons de l'ouvrir, donc : le survol (qui se referme quand on
 * s'en va), le focus (idem), et le clic ou la touche, qui ouvre POUR
 * DE BON — sans quoi on ne pourrait pas lire plus de deux lignes sans
 * garder la souris dessus.
 */
function poserEnLigne(doc: Document, balise: Element): HTMLElement {
  const bouton = doc.createElement("button");
  bouton.type = "button";
  bouton.className = "wm-tw-mot";
  bouton.setAttribute("aria-expanded", "false");
  //  Le texte étant caché aux lecteurs d'écran tant qu'il l'est à
  //  l'écran, le bouton aurait un nom vide : on lui en donne un.
  bouton.setAttribute("aria-label", "Passage masqué, afficher");

  const texte = doc.createElement("span");
  texte.className = "wm-tw-mot__texte";
  texte.setAttribute("aria-hidden", "true");
  while (balise.firstChild !== null) texte.appendChild(balise.firstChild);
  bouton.appendChild(texte);

  //  `epingle` : ouvert par un clic, donc il reste ouvert quand la
  //  souris s'en va.
  let epingle = false;
  const montrer = (ouvert: boolean) => {
    bouton.classList.toggle("wm-tw-mot--ouvert", ouvert);
    bouton.setAttribute("aria-expanded", ouvert ? "true" : "false");
    texte.setAttribute("aria-hidden", ouvert ? "false" : "true");
    if (ouvert) bouton.removeAttribute("aria-label");
    else bouton.setAttribute("aria-label", "Passage masqué, afficher");
  };
  bouton.addEventListener("pointerenter", () => montrer(true));
  bouton.addEventListener("pointerleave", () => montrer(epingle));
  bouton.addEventListener("focus", () => montrer(true));
  bouton.addEventListener("blur", () => montrer(epingle));
  //  AU CLIC ON ÉPINGLE, ET ON LAISSE OUVERT : la souris est encore
  //  dessus, ou le focus y est — refermer dans la seconde qui suit
  //  serait absurde. C'est en s'en allant que l'état épinglé décide.
  bouton.addEventListener("click", () => {
    epingle = !epingle;
    montrer(true);
  });
  return bouton;
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

    //  ── DEUX MODES, ET C'EST LE LIBELLÉ QUI TRANCHE ─────────────
    //
    //  « Est-ce que <tw> peut aussi fonctionner avec juste la balise
    //  <tw> et ça fonctionne juste au survol de la souris (ça ne crée
    //  pas un encadré, ni besoin de cliquer sur "afficher ce
    //  passage") ? Il faudrait qu'on ait les 2 » (8 novembre).
    //
    //    · `<tw>un mot</tw>`                       → en ligne, au survol
    //    · `<tw data-wm-tw="violence">…</tw>`      → l'encadré
    //
    //  Le critère n'est pas arbitraire : un encadré a un libellé à
    //  montrer, pas une phrase floutée au milieu d'un paragraphe. Qui
    //  écrit le libellé demande l'encadré ; qui ne l'écrit pas
    //  demande le discret.
    const libelle = libelleDe(balise);
    if (libelle === null && tientEnLigne(balise)) {
      balise.replaceWith(poserEnLigne(doc, balise));
      pose += 1;
      continue;
    }

    const mot = libelle ?? SANS_LIBELLE;
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
