// ════════════════════════════════════════════════════════════════════
//  src/adaptateurs/navigateur/module-categories.ts
//
//  Le rang de la bande de titre d'une catégorie.
//
//  ── POURQUOI UN MODULE POUR SI PEU ──────────────────────────────────
//
//  La maquette `390:3317` dessine la bande ainsi :
//
//      02 │ ──────── AVANT DE PARTIR ──────── │
//
//  Les filets, le centrage et les séparateurs sont de la feuille 03 :
//  ils ne dépendent de rien. LE RANG, lui, n'existe nulle part dans le
//  balisage de ModernBB, qui ne sert qu'un titre — et il n'y a pas de
//  `counter()` CSS qui sache numéroter des blocs frères à travers un
//  pseudo-élément.
//
//  Donc un attribut posé une fois, et la feuille l'affiche :
//
//      data-wm-rang="02"
//
//  LE COMPTE DE FORUMS A EXISTÉ UNE HEURE, à droite, comme dans la
//  maquette. Callista n'en veut pas : « ne mets rien ». Il est parti
//  avec sa fonction d'accord — un compteur qu'on n'affiche pas est du
//  code mort, et du code mort finit par être réactivé par erreur.
//
//  ── POURQUOI PAS DANS LE TEMPLATE ───────────────────────────────────
//
//  Parce qu'`index_box` est le MÊME template pour l'index et pour les
//  sous-forums d'une page de zone (28-…, § 2.2). Y écrire un numéro de
//  catégorie numéroterait aussi les blocs de sous-forums, où ça n'a
//  aucun sens. Ici, on ne numérote que l'index, et `estLIndex` le dit.
//
//  ── CE QU'IL NE FAIT PAS ────────────────────────────────────────────
//
//  Il ne touche à rien d'autre : pas au titre, pas aux lignes, pas au
//  bouton de repli. Si les attributs manquent — JavaScript coupé, page
//  qui n'est pas l'index —, la bande reste une bande avec son titre
//  centré entre ses filets. Rien ne dépend de lui pour être lisible.
// ════════════════════════════════════════════════════════════════════

import { estLIndex } from "./module-vie.ts";

/** Le rang, sur deux chiffres jusqu'à 99.
 *
 *  La maquette écrit « 02 » et pas « 2 » : le zéro tient la colonne, et
 *  sans lui les bandes se décalent d'un caractère entre la neuvième et
 *  la dixième catégorie. Au-delà de 99 on laisse le nombre tel quel —
 *  un forum à cent catégories a d'autres soucis. */
export function rangEnDeuxChiffres(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

/** Pose le rang sur chaque bande de titre de l'index.
 *
 *  Rend le nombre de catégories décorées, pour que le harnais puisse
 *  distinguer « rien à faire » de « je n'ai rien trouvé ». */
export function numeroterLesCategories(doc: Document): number {
  if (!estLIndex(doc.location?.pathname ?? "")) return 0;

  //  `.forabg` est une catégorie, `.forumbg` un groupe sans catégorie.
  //  Les deux portent une bande ; les deux se numérotent, dans l'ordre
  //  où ils sont à l'écran.
  const blocs = doc.querySelectorAll<HTMLElement>(".forabg, .forumbg");
  let faits = 0;
  blocs.forEach((bloc, i) => {
    //  SUR LE `dl`, PAS SUR LE `li` : c'est le `dl` que la feuille met
    //  en rangée, et un pseudo-élément appartient à l'élément qui porte
    //  l'attribut. Posé sur le `li`, il serait hors de la rangée.
    const bande = bloc.querySelector<HTMLElement>("li.header dl.icon");
    if (bande === null) return;
    bande.dataset.wmRang = rangEnDeuxChiffres(i + 1);
    faits += 1;
  });
  return faits;
}

// ── la pastille de gauche ───────────────────────────────────────────

/** La classe du rond qui porte l'image du forum. */
export const CLASSE_PASTILLE = "wm-pastille";

/** L'adresse d'image contenue dans un `style` de ModernBB.
 *
 *  Forumactif écrit, EN LIGNE sur le `<dl>` de chaque ligne :
 *
 *      style="background:url(https://…/no-new.png) no-repeat scroll 10px 50%;"
 *
 *  Les guillemets sont facultatifs et de l'un ou l'autre genre selon
 *  les versions ; on les accepte tous les trois cas. */
export function imageDuStyle(style: string): string | null {
  const m = style.match(/url\(\s*(['"]?)([^'")]+)\1\s*\)/);
  const u = m === null ? "" : m[2].trim();
  return u === "" ? null : u;
}

/** Sort l'image du forum de son style en ligne et la pose dans un rond.
 *
 *  ── POURQUOI CE DÉTOUR ──────────────────────────────────────────────
 *
 *  « Les images sont là. » Elles le sont, et je ne les avais pas
 *  trouvées parce que je lisais le style CALCULÉ du premier `<dl>`
 *  venu, qui rendait l'icône par défaut de ModernBB. L'image que
 *  Callista a posée dans le panneau d'administration est écrite EN
 *  LIGNE sur chaque `<dl>`, et un style en ligne ne se voit pas dans
 *  une feuille.
 *
 *  C'est aussi pour ça qu'on ne peut pas s'en contenter : `background`
 *  en ligne porte la POSITION — `10px 50%` — et aucune de nos règles
 *  ne la bat. L'image restait donc collée au bord gauche, à sa taille
 *  d'origine, là où `390:3328` dessine un rond de 40 avec l'image
 *  dedans.
 *
 *  On la SORT donc : on lit l'adresse, on fabrique la pastille que la
 *  grille attend déjà dans sa première colonne, et on efface le fond
 *  en ligne — qui ne sert plus à rien une fois l'image déplacée.
 *
 *  ── LE REPLI EST BON ────────────────────────────────────────────────
 *
 *  Sans JavaScript, rien de tout ça n'arrive : le style en ligne reste,
 *  et l'image s'affiche là où Forumactif la met. On ne perd pas
 *  l'information « nouveaux messages », on perd juste le rond.
 *
 *  Rend le nombre de pastilles posées. */
export function poserLesPastilles(doc: Document): number {
  let faits = 0;
  for (const dl of Array.from(doc.querySelectorAll<HTMLElement>("li.row dl.icon"))) {
    if (dl.querySelector(`.${CLASSE_PASTILLE}`) !== null) continue;
    const url = imageDuStyle(dl.getAttribute("style") ?? "");
    if (url === null) continue;

    const rond = doc.createElement("span");
    rond.className = CLASSE_PASTILLE;
    const img = doc.createElement("img");
    img.src = url;
    //  DÉCORATIVE, et c'est un choix. L'image dit « nouveaux messages
    //  ou pas » — la même information que porte déjà le titre du
    //  forum, en gras ou non, et que Forumactif écrit dans le lien.
    //  Un second nom pour la même chose encombre la lecture à voix
    //  haute d'une page qui en compte vingt-six.
    img.alt = "";
    img.loading = "lazy";
    rond.appendChild(img);
    dl.insertBefore(rond, dl.firstChild);

    //  LE FOND EN LIGNE S'EFFACE, pas le style entier : Forumactif
    //  pourrait y mettre autre chose un jour, et tout jeter serait
    //  jeter ce qu'on n'a pas lu.
    dl.style.removeProperty("background");
    dl.style.removeProperty("background-image");
    if (dl.getAttribute("style") === "") dl.removeAttribute("style");
    faits += 1;
  }
  return faits;
}

// ── les sous-forums ─────────────────────────────────────────────────

/** La classe du rang de pastilles. La feuille 03 l'habille. */
export const CLASSE_SOUS_FORUMS = "wm-sous-forums";

/** Range les sous-forums d'une ligne en un rang de pastilles.
 *
 *  ── CE QUE LA MAQUETTE DEMANDE ──────────────────────────────────────
 *
 *  `390:3328` dessine trois rangées dans la colonne d'identité : le
 *  titre, la description, puis un rang de pastilles — « En cours de
 *  validation », « Validées », « Modèles de fiche », « Archives ». Des
 *  boîtes de 18 de haut, 7 de rembourrage, 5 d'écart.
 *
 *  ── CE QUE MODERNBB SERT ────────────────────────────────────────────
 *
 *      <h3>…</h3>La description<br><br>
 *      <a class="gensmall" href="/f99-missions">MISSIONS</a>,
 *      <a class="gensmall" href="/f44-…">VALIDER UNE FICHE</a><strong></strong>
 *
 *  Des liens séparés par des VIRGULES EN NŒUDS DE TEXTE. Une virgule
 *  entre deux pastilles ne veut plus rien dire — c'est la pastille qui
 *  sépare —, et aucun sélecteur n'atteint un nœud de texte. D'où ce
 *  passage en JavaScript plutôt qu'une règle de plus.
 *
 *  On les regroupe aussi dans un conteneur : sans lui, le rang ne peut
 *  pas s'écarter du texte au-dessus ni se replier proprement, puisque
 *  les liens sont frères de la description.
 *
 *  ── CE QU'ON NE TOUCHE PAS ──────────────────────────────────────────
 *
 *  Les adresses, les libellés, l'ordre. On déplace des nœuds, on ne
 *  fabrique rien : un sous-forum renommé dans le panneau
 *  d'administration suit tout seul.
 *
 *  Rend le nombre de lignes rangées. */
export function rangerLesSousForums(doc: Document): number {
  let faits = 0;
  for (const corps of Array.from(doc.querySelectorAll("li.row dd.dterm > div"))) {
    if (corps.querySelector(`.${CLASSE_SOUS_FORUMS}`) !== null) continue;
    const liens = Array.from(corps.querySelectorAll<HTMLAnchorElement>(":scope > a.gensmall"));
    if (liens.length === 0) continue;

    //  LES SÉPARATEURS D'ABORD, LE DÉPLACEMENT ENSUITE. L'inverse
    //  laisse des virgules orphelines là où les liens étaient.
    const premier = liens[0];
    const dernier = liens[liens.length - 1];
    let n: ChildNode | null = premier;
    while (n !== null) {
      const suivant: ChildNode | null = n.nextSibling;
      //  Entre le premier et le dernier lien, tout ce qui est du texte
      //  est une virgule ou une espace : rien d'autre ne vit là.
      if (n !== premier && n.nodeType === 3) n.remove();
      if (n === dernier) break;
      n = suivant;
    }

    const rang = doc.createElement("span");
    rang.className = CLASSE_SOUS_FORUMS;
    corps.insertBefore(rang, premier);
    for (const a of liens) {
      a.classList.add("wm-sous-forum");
      rang.appendChild(a);
    }
    faits += 1;
  }
  return faits;
}

// ── le dernier message ──────────────────────────────────────────────

/** Ce qu'on a su tirer d'un bloc « dernière réponse ». */
export type DernierMessage = {
  /** Le nom de l'auteur, tel qu'il est écrit dans la page. */
  readonly qui: string;
  /** La date, telle qu'elle est écrite dans la page. */
  readonly quand: string;
};

/** Lit l'auteur et la date dans le contenu d'un `.lastpost-infos`.
 *
 *  ── POURQUOI ÇA SE PASSE SUR DU TEXTE ───────────────────────────────
 *
 *  ModernBB sert ceci, et rien de plus structuré :
 *
 *      <a>titre du sujet</a><br>Mar 2 Avr 2024 - 18:42<br>Invité &nbsp;<a…>
 *
 *  La DATE est un nœud de texte nu entre deux `<br>`. Elle n'a ni
 *  classe, ni balise, ni attribut : il n'y a aucun sélecteur qui
 *  l'atteigne, et c'est pour ça que la maquette ne peut pas se faire en
 *  CSS seul. L'auteur, lui, est tantôt un texte nu (« Invité »), tantôt
 *  un `<a class="gensmall">` dans un `<strong>` avec la couleur de son
 *  groupe.
 *
 *  On découpe donc sur les sauts de ligne, et on prend les deux
 *  morceaux dans l'ordre où le gabarit les écrit : date, puis auteur.
 *
 *  ── CE QU'ON NE FAIT PAS ────────────────────────────────────────────
 *
 *  On ne devine pas, et on ne reformate pas la date : « hier », « il y
 *  a 1 h » et « Mar 2 Avr 2024 - 18:42 » sortent tous les trois de
 *  Forumactif selon ses propres réglages, et les réécrire voudrait
 *  dire les analyser — donc se tromper un jour sur un fuseau ou une
 *  langue. On les recopie.
 *
 *  Rend `null` si l'un des deux manque : mieux vaut laisser le bloc tel
 *  que ModernBB l'a écrit qu'afficher « par · » avec un trou dedans. */
export function lireLeDernierMessage(morceaux: readonly string[]): DernierMessage | null {
  //  L'espace insécable que le gabarit colle après le nom en fait
  //  partie : `\s` ne l'attrape pas dans toutes les implémentations,
  //  on le nomme.
  const propre = (s: string) => s.replace(/[\s ]+/g, " ").trim();
  const quand = propre(morceaux[1] ?? "");
  const qui = propre(morceaux[2] ?? "");
  if (quand === "" || qui === "") return null;
  return { qui, quand };
}

/** Découpe le contenu d'un `.lastpost-infos` sur ses `<br>`.
 *
 *  La moitié DOM de la lecture ci-dessus : elle ne décide de rien, elle
 *  ne fait que rendre les morceaux dans l'ordre du document. C'est le
 *  harnais de navigateur qui la couvre — une fonction qui marche sur
 *  des `childNodes` ne se teste pas sans navigateur, et un faux DOM
 *  monté à la main testerait le faux. */
export function morceauxDuDernierMessage(infos: Element): readonly string[] {
  const morceaux: string[] = [];
  let courant = "";
  for (const n of Array.from(infos.childNodes)) {
    if (n.nodeName === "BR") {
      morceaux.push(courant);
      courant = "";
      continue;
    }
    //  La flèche « voir le dernier message » n'est pas du texte : elle
    //  n'a pas à se retrouver collée au nom de l'auteur.
    if (n.nodeType === 1 && (n as Element).classList.contains("last-post-icon")) continue;
    courant += n.textContent ?? "";
  }
  morceaux.push(courant);
  return morceaux;
}

/** La classe de la ligne « par X · quand » qu'on pose à la place des
 *  deux lignes de ModernBB. La feuille 03 l'habille. */
export const CLASSE_SIGNATURE = "wm-dernier__signature";

/** Recompose les blocs « dernière réponse » de la page.
 *
 *  La maquette `390:3328` écrit DEUX lignes — le sujet, puis « par
 *  Aliénor · il y a 1 h ». ModernBB en écrit trois, dans l'autre
 *  ordre : sujet, date, auteur. Un bloc de 56 px de haut pour trois
 *  lignes de texte, ça ne tient pas, et ce n'est pas le dessin.
 *
 *  LA COULEUR DE GROUPE EST PERDUE, et c'est voulu : le nom de
 *  l'auteur arrive parfois dans un `<span class="group-2">` qui lui
 *  donne la couleur de son groupe. Sur une ligne de huit mots en gris
 *  pâle, un nom en rouge vif attire l'œil vers l'information la moins
 *  utile de la ligne. La maquette met les deux dans le même gris.
 *
 *  Rend le nombre de blocs recomposés. Aucun si le gabarit change de
 *  forme : on ne touche qu'à ce qu'on a su lire en entier. */
export function recomposerLesDerniersMessages(doc: Document): number {
  let faits = 0;
  for (const infos of Array.from(doc.querySelectorAll(".lastpost-infos"))) {
    //  Idempotent : le module peut repasser (un observateur, un
    //  rechargement partiel) sans empiler les signatures.
    if (infos.querySelector(`.${CLASSE_SIGNATURE}`) !== null) continue;
    const lu = lireLeDernierMessage(morceauxDuDernierMessage(infos));
    if (lu === null) continue;

    const titre = infos.querySelector("a:not(.last-post-icon)");
    const fleche = infos.querySelector(".last-post-icon");
    const signature = doc.createElement("span");
    signature.className = CLASSE_SIGNATURE;
    signature.textContent = `par ${lu.qui} · ${lu.quand}`;

    //  On vide et on remonte, plutôt que de retirer les nœuds un par
    //  un : la liste des enfants change pendant qu'on la parcourt, et
    //  c'est la façon classique de perdre un nœud sur deux.
    infos.textContent = "";
    if (titre !== null) infos.appendChild(titre);
    infos.appendChild(signature);
    if (fleche !== null) infos.appendChild(fleche);
    faits += 1;
  }
  return faits;
}
