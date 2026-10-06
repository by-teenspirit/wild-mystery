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

import { type LigneAffichee, vieDeRhode } from "../../navigateur/vie.ts";
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

  const qui = element(doc, "b", "wm-vie__qui", l.pseudo);
  li.appendChild(qui);
  li.appendChild(doc.createTextNode(` ${l.phrase} `));

  const quand = doc.createElement("time");
  quand.className = "wm-vie__quand";
  quand.textContent = l.ecart;
  const iso = l.instant.toISOString();
  quand.setAttribute("datetime", iso);
  //  La date lisible, en français, pour l'infobulle. `toLocaleString`
  //  utilise le fuseau du joueur, ce qui est exactement ce qu'il veut
  //  voir ; `datetime` garde l'instant absolu pour les machines.
  quand.setAttribute("title", l.instant.toLocaleString("fr-FR"));
  li.appendChild(quand);

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

  encart.appendChild(element(doc, "h2", "wm-vie__titre", "La vie de Rhode"));

  const liste = element(doc, "ul", "wm-vie__lignes");
  for (const l of lignes) liste.appendChild(ligneEnDOM(doc, l));
  encart.appendChild(liste);

  ancre.parentNode?.insertBefore(encart, ancre.nextSibling);
  return true;
}
