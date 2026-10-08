// ════════════════════════════════════════════════════════════════════
//  src/adaptateurs/navigateur/module-categories.ts
//
//  Les deux nombres de la bande de titre d'une catégorie.
//
//  ── POURQUOI UN MODULE POUR SI PEU ──────────────────────────────────
//
//  La maquette `390:3317` dessine la bande ainsi :
//
//      02 │ ──────── AVANT DE PARTIR ──────── │ 4 FORUMS
//
//  Les filets, le centrage et les séparateurs sont de la feuille 03 :
//  ils ne dépendent de rien. Les DEUX NOMBRES, eux, n'existent nulle
//  part dans le balisage de ModernBB, qui ne sert qu'un titre. Il n'y a
//  pas de `counter()` CSS qui sache compter des LIGNES DE FORUM à
//  l'intérieur d'un bloc voisin, et pas de sélecteur qui sache écrire
//  « 4 FORUMS » — `::after { content: counter(…) }` compte ce qu'on
//  incrémente, pas ce qu'on trouve ailleurs.
//
//  Donc deux attributs posés une fois, et la feuille les affiche :
//
//      data-wm-rang="02"        data-wm-forums="4 FORUMS"
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

/** Le mot, accordé. Un forum seul n'est pas « 1 FORUMS ». */
export function compterLesForums(n: number): string {
  return `${n} ${n > 1 ? "FORUMS" : "FORUM"}`;
}

/** Le rang, sur deux chiffres jusqu'à 99.
 *
 *  La maquette écrit « 02 » et pas « 2 » : le zéro tient la colonne, et
 *  sans lui les bandes se décalent d'un caractère entre la neuvième et
 *  la dixième catégorie. Au-delà de 99 on laisse le nombre tel quel —
 *  un forum à cent catégories a d'autres soucis. */
export function rangEnDeuxChiffres(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

/** Pose les deux nombres sur chaque bande de titre de l'index.
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
    const bande = bloc.querySelector<HTMLElement>("li.header");
    if (bande === null) return;
    //  LES LIGNES DE LA CATÉGORIE, ET PAS TOUTES CELLES DE LA PAGE :
    //  on compte dans le bloc. Et `li.row` seulement — `li.header` est
    //  une ligne elle aussi pour ModernBB.
    const forums = bloc.querySelectorAll("ul.topiclist li.row").length;
    bande.dataset.wmRang = rangEnDeuxChiffres(i + 1);
    bande.dataset.wmForums = compterLesForums(forums);
    faits += 1;
  });
  return faits;
}
