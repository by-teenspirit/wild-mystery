/// <reference lib="dom" />
/// <reference lib="dom.iterable" />
// ════════════════════════════════════════════════════════════════════
//  src/adaptateurs/navigateur/module-accueil.ts
//
//  Le bloc d'accueil, maquette `390:3170` : contexte, liens rapides,
//  partenaires, votes, staff, actualités, pré-liens, et la mascotte.
//
//  QUE DU DOM. Ce qui s'affiche et ce qui est écarté se décide dans
//  `src/navigateur/accueil.ts`, où c'est testé sans navigateur. Ici on
//  dessine, et rien d'autre.
//
//  ── IL REMPLACE UN BLOC DÉJÀ LÀ, IL N'EN CRÉE PAS UN ────────────────
//
//  Callista colle une fois pour toutes, dans le message d'accueil du
//  forum, un bloc court : le texte du contexte et les sept liens, en
//  dur. Ce module le REMPLACE par la version complète.
//
//  L'ordre compte, et c'est tout l'intérêt : **sans JavaScript, la page
//  reste lisible**. C'est la même règle que le sujet de boutique, et
//  c'est la seule raison pour laquelle ce bloc de repli existe.
//
//  Corollaire : quand le fichier de données est illisible ou vide, on
//  ne touche à RIEN. Une page d'accueil blanche est pire qu'une page
//  d'accueil sans JavaScript.
//
//  ── L'INFOBULLE DES PRÉ-LIENS N'EST PAS UN `title` ──────────────────
//
//  Elle contient un LIEN — « voir le pré-lien » —, et une infobulle
//  native ne se clique pas, ne se lit pas au doigt, et disparaît au
//  moindre mouvement. C'est donc un vrai panneau : il s'ouvre au
//  survol ET au clavier, il se ferme à Échap, et il est borné à
//  l'écran comme tout ce qui flotte dans ce projet.
// ════════════════════════════════════════════════════════════════════

import type { Accueil, Lien, Prelien } from "../../navigateur/accueil.ts";
import { estVide, lignesDUnPrelien } from "../../navigateur/accueil.ts";

const SVG = "http://www.w3.org/2000/svg";

function element(doc: Document, balise: string, classe: string, texte?: string): HTMLElement {
  const e = doc.createElement(balise);
  if (classe !== "") e.className = classe;
  if (texte !== undefined) e.textContent = texte;
  return e;
}

/** Un lien, ou un simple texte quand l'adresse manque.
 *
 *  LA DÉCISION EST ICI ET NULLE PART AILLEURS. Un `<a href="">`
 *  recharge la page sans rien dire ; un texte gris se voit. */
function lienOuTexte(doc: Document, lien: Lien, classe: string): HTMLElement {
  if (lien.url === "") {
    const span = element(doc, "span", `${classe} ${classe}--sans-adresse`, lien.texte);
    //  Dit à voix haute ce que le gris dit à l'œil.
    span.title = "Adresse à renseigner";
    return span;
  }
  const a = doc.createElement("a");
  a.className = classe;
  a.href = lien.url;
  a.textContent = lien.texte;
  return a;
}

/** L'étoile des partenaires, en tracé.
 *
 *  Dessinée plutôt que téléchargée : c'est une forme de huit traits,
 *  elle suit la couleur du texte, et elle ne coûte pas une requête de
 *  plus par partenaire. */
function etoile(doc: Document): SVGSVGElement {
  const s = doc.createElementNS(SVG, "svg");
  s.setAttribute("viewBox", "0 0 24 24");
  s.setAttribute("aria-hidden", "true");
  s.setAttribute("focusable", "false");
  const p = doc.createElementNS(SVG, "path");
  //  Quatre branches longues et quatre courtes : c'est ce qui fait
  //  l'éclat plutôt qu'une étoile de mer.
  p.setAttribute(
    "d",
    "M12 2v7M12 15v7M2 12h7M15 12h7M6.3 6.3l3.3 3.3M14.4 14.4l3.3 3.3M17.7 6.3l-3.3 3.3M9.6 14.4l-3.3 3.3",
  );
  p.setAttribute("fill", "none");
  p.setAttribute("stroke", "currentColor");
  p.setAttribute("stroke-width", "1.6");
  p.setAttribute("stroke-linecap", "round");
  s.appendChild(p);
  return s;
}

/** L'œil des liens rapides, en tracé.
 *
 *  IL A ÉTÉ UNE LIGATURE MATERIAL, ET ÇA S'EST VU. Une ligature n'est
 *  pas une icône : c'est le mot `visibility` écrit en clair, que la
 *  police remplace par un dessin SI elle charge. Au premier rendu de
 *  l'accueil, elle n'avait pas chargé, et les sept lignes affichaient le
 *  mot — barré, sur les deux liens sans adresse. Même règle que le coin
 *  d'outils : les icônes sont des tracés. */
function oeil(doc: Document): SVGSVGElement {
  const s = doc.createElementNS(SVG, "svg");
  s.setAttribute("viewBox", "0 0 24 24");
  s.setAttribute("class", "wm-accueil__oeil");
  s.setAttribute("aria-hidden", "true");
  s.setAttribute("focusable", "false");
  //  La paupière en deux arcs, et l'iris au milieu. Deux tracés plutôt
  //  qu'un seul : l'iris est plein, la paupière ne l'est pas.
  const paupiere = doc.createElementNS(SVG, "path");
  paupiere.setAttribute(
    "d",
    "M1.8 12S5.4 5.4 12 5.4 22.2 12 22.2 12 18.6 18.6 12 18.6 1.8 12 1.8 12Z",
  );
  paupiere.setAttribute("fill", "none");
  paupiere.setAttribute("stroke", "currentColor");
  paupiere.setAttribute("stroke-width", "1.7");
  paupiere.setAttribute("stroke-linejoin", "round");
  const iris = doc.createElementNS(SVG, "circle");
  iris.setAttribute("cx", "12");
  iris.setAttribute("cy", "12");
  iris.setAttribute("r", "2.6");
  iris.setAttribute("fill", "currentColor");
  s.appendChild(paupiere);
  s.appendChild(iris);
  return s;
}

function vignette(doc: Document, src: string, classe: string): HTMLElement {
  const cadre = element(doc, "span", classe);
  if (src !== "") {
    const img = doc.createElement("img");
    img.src = src;
    //  Vide : le nom est déjà écrit à côté, et le répéter ferait bégayer
    //  un lecteur d'écran.
    img.alt = "";
    img.loading = "lazy";
    cadre.appendChild(img);
  }
  return cadre;
}

// ── les sept blocs ──────────────────────────────────────────────────

function blocContexte(doc: Document, a: Accueil): HTMLElement | null {
  if (a.contexte === null) return null;
  const bloc = element(doc, "section", "wm-accueil__contexte");
  bloc.appendChild(element(doc, "h2", "wm-accueil__titre", a.contexte.titre));
  if (a.contexte.chapo !== "") {
    bloc.appendChild(element(doc, "p", "wm-accueil__chapo", a.contexte.chapo));
  }
  for (const p of a.contexte.paragraphes) {
    bloc.appendChild(element(doc, "p", "wm-accueil__texte", p));
  }
  if (a.contexte.lien !== null) {
    const pied = element(doc, "p", "wm-accueil__pied");
    pied.appendChild(lienOuTexte(doc, a.contexte.lien, "wm-accueil__lien"));
    bloc.appendChild(pied);
  }
  return bloc;
}

function blocLiens(doc: Document, a: Accueil): HTMLElement | null {
  if (a.liens.length === 0) return null;
  const nav = element(doc, "nav", "wm-accueil__liens");
  nav.setAttribute("aria-label", "Accès rapides");
  const ul = element(doc, "ul", "wm-accueil__liste-liens");
  for (const lien of a.liens) {
    const li = element(doc, "li", "");
    const rangee = lienOuTexte(doc, lien, "wm-accueil__rapide");
    //  L'œil est AVANT le texte, comme la maquette, et il est posé
    //  après coup pour que `lienOuTexte` reste le seul endroit qui
    //  décide du lien.
    rangee.insertBefore(oeil(doc), rangee.firstChild);
    li.appendChild(rangee);
    ul.appendChild(li);
  }
  nav.appendChild(ul);
  return nav;
}

function blocVotes(doc: Document, a: Accueil): HTMLElement | null {
  if (a.votes.liste.length === 0) return null;
  const bloc = element(doc, "section", "wm-accueil__votes wm-accueil__carte");
  bloc.appendChild(
    element(doc, "h2", "wm-accueil__titre-carte", a.votes.titre || "Votez !"),
  );
  const liste = element(doc, "ul", "wm-accueil__votes-liste");
  for (const v of a.votes.liste) {
    const li = element(doc, "li", "");
    const lien = doc.createElement("a");
    lien.className = "wm-accueil__vote";
    lien.href = v.url;
    //  Un bouton de vote mène ailleurs : on le dit, et on ne lègue pas
    //  notre référent au site de vote.
    lien.rel = "noopener nofollow";
    lien.target = "_blank";
    //  Le nom N'EST PAS visible — la maquette ne montre que les
    //  vignettes —, donc il doit être annoncé.
    lien.setAttribute("aria-label", `Voter sur ${v.nom}`);
    lien.appendChild(vignette(doc, v.image, "wm-accueil__vote-image"));
    li.appendChild(lien);
    liste.appendChild(li);
  }
  bloc.appendChild(liste);
  return bloc;
}

function blocPartenaires(doc: Document, a: Accueil): HTMLElement | null {
  const p = a.partenaires;
  if (p.liste.length === 0 && p.lien === null) return null;
  const bloc = element(doc, "section", "wm-accueil__partenaires wm-accueil__carte");
  bloc.appendChild(
    element(doc, "h2", "wm-accueil__titre-carte", p.titre || "Nos partenaires"),
  );
  if (p.liste.length > 0) {
    const liste = element(doc, "ul", "wm-accueil__partenaires-liste");
    for (const partenaire of p.liste) {
      const li = element(doc, "li", "");
      const enfant = partenaire.url === ""
        ? element(doc, "span", "wm-accueil__partenaire wm-accueil__partenaire--sans-adresse")
        : (() => {
          const lien = doc.createElement("a");
          lien.className = "wm-accueil__partenaire";
          lien.href = partenaire.url;
          lien.rel = "noopener";
          lien.target = "_blank";
          return lien;
        })();
      //  Le nom n'est jamais visible dans la maquette : c'est une
      //  rangée d'étoiles. Il est donc annoncé, toujours.
      enfant.setAttribute("aria-label", partenaire.nom);
      enfant.title = partenaire.nom;
      if (partenaire.image !== "") {
        enfant.appendChild(vignette(doc, partenaire.image, "wm-accueil__partenaire-image"));
      } else {
        enfant.appendChild(etoile(doc));
      }
      li.appendChild(enfant);
      liste.appendChild(li);
    }
    bloc.appendChild(liste);
  }
  if (p.lien !== null) {
    const pied = element(doc, "p", "wm-accueil__pied");
    pied.appendChild(lienOuTexte(doc, p.lien, "wm-accueil__lien"));
    bloc.appendChild(pied);
  }
  return bloc;
}

function blocStaff(doc: Document, a: Accueil): HTMLElement | null {
  if (a.staff.length === 0) return null;
  const bloc = element(doc, "section", "wm-accueil__staff");
  bloc.setAttribute("aria-label", "L'équipe");
  //  LE BANDEAU A ÉTÉ UNE IMAGE, ET UNE IMAGE NE SUIT PAS LE THÈME.
  //  `bandeau-staff.png` est un dégradé plat de 99 × 318, relevé dans
  //  la maquette : bleu poussiéreux en haut, crème en bas. Posé en
  //  thème sombre, il restait clair — un bloc blanc au milieu d'une
  //  page nuit, repéré par Callista le 7 octobre.
  //
  //  Il est maintenant peint par la feuille, en jetons. Mêmes deux
  //  couleurs, mais dérivées : elles se retournent avec le thème, elles
  //  ne coûtent pas une requête, et il n'y a plus de fichier à tenir à
  //  jour quand la charte bouge. Le module n'a donc plus rien à poser
  //  ici — d'où la classe seule.
  const etiquette = element(doc, "h2", "wm-accueil__titre-cote wm-accueil__bandeau", "Staff");
  bloc.appendChild(etiquette);
  const liste = element(doc, "ul", "wm-accueil__staff-liste");
  for (const m of a.staff) {
    const li = element(doc, "li", "wm-accueil__membre");
    li.appendChild(vignette(doc, m.avatar, "wm-accueil__membre-avatar"));

    const corps = element(doc, "div", "wm-accueil__membre-corps");
    const tete = element(doc, "p", "wm-accueil__membre-tete");
    const nom = m.profil === ""
      ? element(doc, "span", "wm-accueil__membre-pseudo", m.pseudo)
      : (() => {
        const lien = doc.createElement("a");
        lien.className = "wm-accueil__membre-pseudo";
        lien.href = m.profil;
        lien.textContent = m.pseudo;
        return lien;
      })();
    tete.appendChild(nom);
    if (m.role !== "") {
      //  Le point de séparation est décoratif : il ne doit pas être lu.
      const point = element(doc, "span", "wm-accueil__point");
      point.setAttribute("aria-hidden", "true");
      tete.append(point, element(doc, "span", "wm-accueil__membre-role", m.role));
    }
    corps.appendChild(tete);

    if (m.personnages.length > 0) {
      const perso = element(doc, "p", "wm-accueil__membre-personnages");
      m.personnages.forEach((nomPerso, i) => {
        if (i > 0) {
          const point = element(doc, "span", "wm-accueil__point");
          point.setAttribute("aria-hidden", "true");
          perso.appendChild(point);
        }
        perso.appendChild(element(doc, "span", "", nomPerso));
      });
      corps.appendChild(perso);
    }

    if (m.presence !== "") {
      //  La pastille de la maquette, qui est le composant « Pastille de
      //  danger » détourné : même forme, autre propos. On reprend sa
      //  classe plutôt que d'en dessiner une seconde.
      //  LE ROND EST UN `::before` DE LA FEUILLE, pas un nœud : on ne
      //  pose donc que le texte. Lui en ajouter un ferait deux points.
      corps.appendChild(element(doc, "p", "wm-danger wm-accueil__presence", m.presence));
    }
    li.appendChild(corps);
    liste.appendChild(li);
  }
  bloc.appendChild(liste);
  return bloc;
}

function blocActualites(doc: Document, a: Accueil): HTMLElement | null {
  if (a.actualites.liste.length === 0) return null;
  const bloc = element(doc, "section", "wm-accueil__actus");
  bloc.appendChild(
    element(doc, "h2", "wm-accueil__titre-carte wm-accueil__titre-actus", a.actualites.titre),
  );
  const carte = element(doc, "div", "wm-accueil__carte");
  //  `.wm-news` est le composant de la bibliothèque (`13-composants`),
  //  dessiné d'après « Entrée de nouvelle » : on le réutilise, on n'en
  //  refait pas un.
  //
  //  ET IL FAUT LE NOMMER AU BON ÉTAGE. `.wm-news` est la PILE, qui
  //  empile en colonne avec 18 px d'écart ; `.wm-news__entree` est la
  //  RANGÉE, qui pose le point, la date et le texte côte à côte. La
  //  première version mettait `.wm-news` sur chaque `<li>` : chaque
  //  entrée devenait donc une colonne, et la date se retrouvait seule
  //  au-dessus d'un trou de 18 px. Ça se voyait à l'écran, et aucun
  //  test ne le voyait — d'où celui qui mesure maintenant la hauteur
  //  d'une entrée.
  const liste = element(doc, "ol", "wm-accueil__actus-liste wm-news");
  for (const n of a.actualites.liste) {
    //  Le point est le `::before` de la rangée : pas de nœud pour lui.
    const li = element(doc, "li", "wm-news__entree");
    if (n.date !== "") li.appendChild(element(doc, "span", "wm-news__date", n.date));
    const texte = element(doc, "span", "wm-news__texte");
    texte.appendChild(
      n.url === "" ? element(doc, "span", "wm-news__titre", n.titre) : (() => {
        const lien = doc.createElement("a");
        lien.className = "wm-news__titre";
        lien.href = n.url;
        lien.textContent = n.titre;
        return lien;
      })(),
    );
    if (n.categorie !== "") {
      texte.appendChild(element(doc, "span", "wm-news__categorie", n.categorie));
    }
    li.appendChild(texte);
    liste.appendChild(li);
  }
  carte.appendChild(liste);
  if (a.actualites.lien !== null) {
    const pied = element(doc, "p", "wm-accueil__pied");
    pied.appendChild(lienOuTexte(doc, a.actualites.lien, "wm-accueil__lien"));
    carte.appendChild(pied);
  }
  bloc.appendChild(carte);
  return bloc;
}

/** Recale un panneau flottant pour qu'il tienne dans l'écran.
 *
 *  ── POURQUOI LA FEUILLE N'Y SUFFIT PAS ──────────────────────────────
 *
 *  Le panneau est centré sur sa bulle (`left: 50%` + `translateX(-50%)`)
 *  et borné à `calc(100vw - 32px)`. Ça tient tant que la bulle est au
 *  milieu. Mesuré par le harnais le 7 octobre : à 520, 390 et 320 px de
 *  large, une bulle de la première colonne pousse son panneau de 232 px
 *  HORS de l'écran par la gauche, et aucune borne de largeur ne rattrape
 *  un décalage.
 *
 *  On le décale donc, des DEUX côtés — c'est la même leçon que le menu
 *  du compte, qui sortait par la gauche quand on n'avait borné que la
 *  droite. */
function bornerAuxBords(doc: Document, panneau: HTMLElement): void {
  const vue = doc.defaultView;
  if (vue === null) return;
  //  On repart de zéro avant de mesurer : sans ça, un décalage posé à
  //  l'ouverture précédente fausse la mesure suivante.
  panneau.style.removeProperty("margin-left");
  const r = panneau.getBoundingClientRect();
  const marge = 16;
  let decalage = 0;
  if (r.left < marge) decalage = marge - r.left;
  else if (r.right > vue.innerWidth - marge) decalage = vue.innerWidth - marge - r.right;
  if (decalage !== 0) panneau.style.marginLeft = `${Math.round(decalage)}px`;
}

/** Une bulle de pré-lien, et son panneau.
 *
 *  LE PANNEAU EST DANS LA BULLE, pas posé sur le corps. Il suit donc la
 *  grille quand elle se réorganise, et il n'a pas de coordonnées à
 *  tenir à jour. La feuille le borne à l'écran. */
function bullePrelien(doc: Document, p: Prelien, i: number): HTMLElement {
  const bulle = element(doc, "li", "wm-accueil__prelien");

  const bouton = doc.createElement("button");
  bouton.type = "button";
  bouton.className = "wm-accueil__prelien-bouton";
  bouton.setAttribute("aria-expanded", "false");
  const idPanneau = `wm-prelien-${i}`;
  bouton.setAttribute("aria-controls", idPanneau);
  bouton.setAttribute("aria-label", p.personnage);
  bouton.appendChild(vignette(doc, p.avatar, "wm-accueil__prelien-avatar"));

  const panneau = element(doc, "div", "wm-accueil__prelien-panneau");
  panneau.id = idPanneau;
  panneau.hidden = true;
  panneau.appendChild(element(doc, "p", "wm-accueil__prelien-nom", p.personnage));
  for (const ligne of lignesDUnPrelien(p)) {
    const l = element(doc, "p", "wm-accueil__prelien-ligne");
    l.append(
      element(doc, "span", "wm-accueil__prelien-clef", `${ligne.cle} `),
      element(doc, "span", "", ligne.valeur),
    );
    panneau.appendChild(l);
  }
  if (p.url !== "") {
    const lien = doc.createElement("a");
    lien.className = "wm-accueil__lien wm-accueil__prelien-lien";
    lien.href = p.url;
    lien.textContent = "Voir le pré-lien";
    panneau.appendChild(lien);
  }

  const montrer = (ouvert: boolean): void => {
    //  ON LE MONTRE D'ABORD, ON LE BORNE ENSUITE : un élément `hidden`
    //  est en `display: none` et mesure zéro, donc la borne se
    //  calculerait sur rien. Même ordre que le menu du compte.
    panneau.hidden = !ouvert;
    bouton.setAttribute("aria-expanded", String(ouvert));
    bulle.classList.toggle("wm-accueil__prelien--ouvert", ouvert);
    if (ouvert) bornerAuxBords(doc, panneau);
  };

  bouton.addEventListener("click", (e) => {
    e.stopPropagation();
    montrer(panneau.hidden === true);
  });
  //  AU SURVOL AUSSI, parce que c'est ce qu'on attend d'une infobulle.
  //  Mais le survol n'est qu'un raccourci : le clic et le clavier
  //  restent les chemins qui marchent au doigt.
  bulle.addEventListener("mouseenter", () => montrer(true));
  bulle.addEventListener("mouseleave", () => {
    //  …sauf si le focus est resté dedans : sortir la souris ne doit
    //  pas escamoter le panneau sous le curseur du clavier.
    if (!bulle.contains(doc.activeElement)) montrer(false);
  });
  //  PAS D'OUVERTURE AU FOCUS, et c'est le harnais qui l'a imposé :
  //  Échap refermait, puis `bouton.focus()` relançait l'ouverture, et
  //  le panneau ne se fermait jamais. Au clavier, Entrée sur le bouton
  //  est déjà un clic — rien n'est perdu, et le piège disparaît.
  panneau.addEventListener("click", (e) => e.stopPropagation());
  doc.addEventListener("click", () => montrer(false));
  doc.addEventListener("keydown", (e) => {
    if ((e as KeyboardEvent).key !== "Escape" || panneau.hidden === true) return;
    montrer(false);
    //  Le focus revient à la bulle : sans ça il reste dans un panneau
    //  devenu `hidden`, et la tabulation repart du haut de la page.
    bouton.focus();
  });

  bulle.append(bouton, panneau);
  return bulle;
}

function blocPreliens(doc: Document, a: Accueil): HTMLElement | null {
  if (a.preliens.liste.length === 0) return null;
  const bloc = element(doc, "section", "wm-accueil__preliens");
  bloc.setAttribute("aria-label", a.preliens.titre || "Pré-liens");
  const liste = element(doc, "ul", "wm-accueil__preliens-liste");
  a.preliens.liste.forEach((p, i) => liste.appendChild(bullePrelien(doc, p, i)));
  bloc.appendChild(liste);
  bloc.appendChild(
    element(doc, "p", "wm-accueil__titre-cote", a.preliens.titre || "Pré-liens"),
  );
  return bloc;
}

// ── l'assemblage ────────────────────────────────────────────────────

/**
 * Dessine le bloc d'accueil à la place du bloc de repli.
 *
 * Rend `true` s'il a été posé. `false` veut dire « il n'y avait rien à
 * faire » — pas de bloc sur cette page, ou pas de données —, et dans
 * les deux cas on n'a touché à rien.
 */
export function poserLAccueil(doc: Document, a: Accueil): boolean {
  const hote = doc.querySelector<HTMLElement>("#wm-accueil");
  //  Pas de bloc : on n'est pas sur l'accueil. Ce n'est pas une panne.
  if (hote === null) return false;
  //  Rien à dire : on LAISSE le repli. Une page blanche est pire qu'une
  //  page sans JavaScript.
  if (estVide(a)) return false;

  const panneau = element(doc, "div", "wm-accueil__panneau");
  if (a.images.fond !== "") {
    panneau.style.setProperty("--wm-accueil-fond", `url("${CSS.escape(a.images.fond)}")`);
    panneau.classList.add("wm-accueil__panneau--image");
  }

  const colonnes = element(doc, "div", "wm-accueil__colonnes");
  const principale = element(doc, "div", "wm-accueil__principale");
  const haut = element(doc, "div", "wm-accueil__rangee");
  for (const bloc of [blocContexte(doc, a), blocLiens(doc, a)]) {
    if (bloc !== null) haut.appendChild(bloc);
  }
  const bas = element(doc, "div", "wm-accueil__rangee wm-accueil__rangee--bas");
  for (const bloc of [blocPartenaires(doc, a), blocPreliens(doc, a)]) {
    if (bloc !== null) bas.appendChild(bloc);
  }
  if (haut.childElementCount > 0) principale.appendChild(haut);
  if (bas.childElementCount > 0) principale.appendChild(bas);

  const cote = element(doc, "div", "wm-accueil__cote");
  for (const bloc of [blocStaff(doc, a), blocActualites(doc, a)]) {
    if (bloc !== null) cote.appendChild(bloc);
  }

  if (principale.childElementCount > 0) colonnes.appendChild(principale);
  if (cote.childElementCount > 0) colonnes.appendChild(cote);
  panneau.appendChild(colonnes);

  if (a.images.mascotte !== "") {
    const img = doc.createElement("img");
    img.className = "wm-accueil__mascotte";
    img.src = a.images.mascotte;
    //  Décorative : la page ne perd rien à ne pas l'annoncer, et la
    //  décrire ferait lire un nom de Pokémon au milieu du contexte.
    img.alt = "";
    img.loading = "lazy";
    panneau.appendChild(img);
  }

  //  ON VIDE EN DERNIER. Si quelque chose avait levé plus haut, le bloc
  //  de repli serait encore là — et c'est exactement ce qu'on veut.
  hote.textContent = "";
  hote.classList.add("wm-accueil--pose");
  const votes = blocVotes(doc, a);
  if (votes !== null) hote.appendChild(votes);
  hote.appendChild(panneau);
  return true;
}
