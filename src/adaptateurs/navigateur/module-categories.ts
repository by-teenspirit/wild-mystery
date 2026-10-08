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
