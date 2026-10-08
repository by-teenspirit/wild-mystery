/// <reference lib="dom" />
/// <reference lib="dom.iterable" />
// ════════════════════════════════════════════════════════════════════
//  src/adaptateurs/navigateur/module-vie.ts
//
//  L'encart « La vie de Rhode », posé sur l'index. Huit lignes, l'heure,
//  et rien d'autre (planche 18, règle 6).
//
//  ── IL NE DEMANDE AUCUNE REPRISE DE TEMPLATE ────────────────────────
//
//  La planche 03 disait qu'il fallait réécrire `index_box` pour avoir un
//  point d'ancrage. C'était la même erreur que pour le module de bilan,
//  qui a attendu pour rien : **un nœud s'insère en JavaScript**. Le
//  dernier bloc de catégorie est trouvable, et l'encart se pose après
//  lui, avant le pied statistique.
//
//  On ne touche donc ni `index_body` ni `index_box`. C'est aussi ce qui
//  permet de le déplacer d'une ligne de code le jour où la maquette le
//  veut ailleurs.
//
//  ── POURQUOI SOUS LES FORUMS, ET PAS AU-DESSUS ──────────────────────
//
//  Au-dessus, il repousserait les catégories sous la ligne de flottaison
//  — l'index sert d'abord à entrer dans un forum. Sous la dernière
//  catégorie, il se lit après : « voilà ce qui s'est passé pendant que tu
//  n'étais pas là », au moment où on décide où aller.
//
//  ── SANS JAVASCRIPT, L'INDEX NE PERD RIEN ───────────────────────────
//
//  L'encart n'existe pas, et c'est tout. Aucune information du jeu n'est
//  accessible uniquement par lui : chaque événement qu'il annonce a
//  laissé un vrai message dans un vrai sujet.
//
//  ── ET IL NE SE POSE PAS S'IL EST VIDE ──────────────────────────────
//
//  Un forum neuf n'a rien à raconter. Un cadre « La vie de Rhode » avec
//  trois pointillés dedans dirait que la région est morte ; l'absence de
//  cadre ne dit rien du tout, ce qui est préférable.
// ════════════════════════════════════════════════════════════════════

import {
  etiquetteDeType,
  type LigneAffichee,
  signeDeType,
  vieDeRhode,
} from "../../navigateur/vie.ts";
import type { LectureDuJournal } from "./journal.ts";

/** Les chemins de l'index, et eux seuls.
 *
 *  Forumactif sert l'accueil sur `/` et sur `/forum` ; les deux formes
 *  circulent dans les liens du forum. Une liste de sujets (`/f9-…`) et un
 *  sujet (`/t977-…`) portent des blocs qui ressemblent à ceux de l'index
 *  — c'est pour ça qu'on ne reconnaît pas la page à son balisage. */
export function estLIndex(chemin: string): boolean {
  return /^\/(forum)?$/.test(chemin) || /^\/index\.(htm|php)$/.test(chemin);
}

/** Le point d'insertion : après le dernier bloc de catégorie.
 *
 *  `.forabg` est le bloc d'une catégorie chez ModernBB, `.forumbg` celui
 *  d'un groupe sans catégorie. On prend le dernier des deux, quel qu'il
 *  soit ; s'il n'y en a aucun, il n'y a pas d'index à décorer. */
export function ancreDeLIndex(doc: Document): Element | null {
  const blocs = doc.querySelectorAll(".forabg, .forumbg");
  return blocs.length === 0 ? null : blocs[blocs.length - 1];
}

function element(doc: Document, balise: string, classe: string, texte?: string): HTMLElement {
  const e = doc.createElement(balise);
  e.className = classe;
  if (texte !== undefined) e.textContent = texte;
  return e;
}

/** Une ligne de l'encart.
 *
 *  Le pseudo est un `<b>` et l'écart un `<time>`. Le `<time>` porte
 *  l'instant exact en `datetime` et en `title` : « il y a 2 h » se lit
 *  d'un coup d'œil, et la date précise reste à un survol — c'est ce que
 *  demande « avec l'heure » sans obliger personne à calculer.
 *
 *  **Tout passe par `textContent`.** Un pseudo vient de la base, donc
 *  d'un joueur : il n'entre jamais dans `innerHTML`. */
function ligneEnDOM(doc: Document, l: LigneAffichee): HTMLElement {
  const li = element(doc, "li", "wm-vie__ligne");

  //  LE CARRÉ, 22 × 22 dans la maquette, avec son signe dedans. Il est
  //  DÉCORATIF : la catégorie est écrite en toutes lettres juste en
  //  dessous, et faire lire « ◍ » à voix haute n'apprendrait rien.
  const rail = element(doc, "span", "wm-vie__rail", signeDeType(l.type));
  rail.setAttribute("aria-hidden", "true");
  li.appendChild(rail);

  const corps = element(doc, "span", "wm-vie__corps");

  //  ── LA PHRASE, AVEC LE PSEUDO EN GRAS DEDANS ────────────────────
  //
  //  **Tout passe par `textContent`.** Un pseudo vient de la base,
  //  donc d'un joueur : il n'entre jamais dans `innerHTML`.
  const phrase = element(doc, "span", "wm-vie__phrase");
  phrase.appendChild(element(doc, "b", "wm-vie__qui", l.pseudo));
  phrase.appendChild(doc.createTextNode(` ${l.phrase}`));
  corps.appendChild(phrase);

  //  ── « PENSION · IL Y A 2 H » ────────────────────────────────────
  //
  //  Le `<time>` porte l'instant exact en `datetime` et en `title` :
  //  l'écart se lit d'un coup d'œil, la date précise reste à un
  //  survol. C'est ce que demande « avec l'heure » sans obliger
  //  personne à calculer.
  const meta = element(doc, "span", "wm-vie__meta");
  meta.appendChild(element(doc, "span", "wm-vie__categorie", etiquetteDeType(l.type)));
  //  Le point médian est un SÉPARATEUR : il se voit, il ne se lit pas.
  const point = element(doc, "span", "wm-vie__point", "·");
  point.setAttribute("aria-hidden", "true");
  meta.appendChild(point);

  const quand = doc.createElement("time");
  quand.className = "wm-vie__quand";
  quand.textContent = l.ecart.toLocaleUpperCase("fr");
  const iso = l.instant.toISOString();
  quand.setAttribute("datetime", iso);
  //  `toLocaleString` prend le fuseau du joueur, ce qu'il veut voir ;
  //  `datetime` garde l'instant absolu pour les machines.
  quand.setAttribute("title", l.instant.toLocaleString("fr-FR"));
  meta.appendChild(quand);

  corps.appendChild(meta);
  li.appendChild(corps);
  return li;
}

export type Dependances = {
  readonly doc: Document;
  readonly journal: LectureDuJournal;
  /** L'horloge, injectée : un écart de temps se teste mal avec `new
   *  Date()` caché au fond d'une fonction. */
  readonly maintenant?: () => Date;
  readonly combien?: number;
};

/**
 * Pose l'encart, et rend `true` s'il a été posé.
 *
 * Les trois « non » sont tous des cas normaux : une page qui n'est pas
 * l'index, un index sans bloc de catégorie, un journal vide. Aucun n'est
 * signalé — il n'y a rien à signaler.
 */
export async function poserLaVieDeRhode(
  { doc, journal, maintenant = () => new Date(), combien = 8 }: Dependances,
): Promise<boolean> {
  if (!estLIndex(doc.location?.pathname ?? "")) return false;

  const ancre = ancreDeLIndex(doc);
  if (ancre === null) return false;

  const lignes = vieDeRhode(await journal.dernieres(combien), maintenant(), combien);
  if (lignes.length === 0) return false;

  const encart = element(doc, "section", "wm-vie");
  //  Une section nommée : un lecteur d'écran l'annonce et peut la
  //  sauter. Sans nom, elle serait un bloc anonyme de huit phrases au
  //  milieu de la liste des forums.
  encart.setAttribute("aria-label", "La vie de Rhode");

  //  ── L'EN-TÊTE DE `390:3386` ──────────────────────────────────────
  //
  //  Le titre, un point, « EN DIRECT », un ressort, et une note à
  //  droite. Le ressort est un trait qui mange la place : c'est lui
  //  qui pousse la note au bord, et c'est aussi lui qui tient le
  //  rythme de la bande quand le titre change de longueur.
  const tete = element(doc, "div", "wm-vie__tete");
  tete.appendChild(element(doc, "h2", "wm-vie__titre", "La vie de Rhode"));
  const direct = element(doc, "span", "wm-vie__direct");
  const puce = element(doc, "span", "wm-vie__puce");
  puce.setAttribute("aria-hidden", "true");
  direct.appendChild(puce);
  direct.appendChild(element(doc, "span", "wm-vie__direct-mot", "En direct"));
  tete.appendChild(direct);
  const ressort = element(doc, "span", "wm-vie__ressort");
  ressort.setAttribute("aria-hidden", "true");
  tete.appendChild(ressort);
  tete.appendChild(
    element(doc, "p", "wm-vie__sous-titre", "ce que Rhode a vu passer aujourd'hui"),
  );
  encart.appendChild(tete);

  //  ── DEUX COLONNES, ET UNE SEULE LISTE ────────────────────────────
  //
  //  La maquette range les huit entrées en deux colonnes de quatre.
  //  C'est une mise en page, pas une structure : les huit restent une
  //  seule liste, dans l'ordre, et c'est `column-count` qui les
  //  partage. Deux `<ul>` auraient coupé l'ordre de lecture en deux
  //  pour un lecteur d'écran, et obligé à recompter à chaque ligne
  //  ajoutée.
  const liste = element(doc, "ul", "wm-vie__lignes");
  for (const l of lignes) liste.appendChild(ligneEnDOM(doc, l));
  encart.appendChild(liste);

  //  ── LE PIED ──────────────────────────────────────────────────────
  //
  //  La maquette y met « Tout le journal » à gauche et une note à
  //  droite. LE LIEN N'EST PAS POSÉ : la page du journal n'existe pas
  //  encore, et un lien qui ne mène nulle part est exactement ce que
  //  `data/accueil.json` appelle un trou. Il reviendra avec sa page.
  const pied = element(doc, "div", "wm-vie__pied");
  pied.appendChild(
    element(doc, "p", "wm-vie__note", "le journal se lit — rien n'est posté dans les sujets"),
  );
  encart.appendChild(pied);

  ancre.parentNode?.insertBefore(encart, ancre.nextSibling);
  return true;
}
