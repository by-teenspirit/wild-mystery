/// <reference lib="dom" />
// ════════════════════════════════════════════════════════════════════
//  src/adaptateurs/navigateur/module-pagination.ts
//
//  COUVERT PAR : outils/sujet.mjs — « LA PAGINATION DU BAS ».
//
//  UNE SECONDE PAGINATION, SOUS LE DERNIER MESSAGE.
//
//  ── LE CONSTAT ──────────────────────────────────────────────────────
//
//  « J'ai pas de pagination en bas du sujet » — 19 novembre.
//
//  Relevé le jour même sur /t1000p100- : la page ne contient qu'UN
//  SEUL `.topic-actions`, et il est au-dessus du premier message. Le
//  gabarit n'en sert pas de second. Sur un sujet de cinq pages et de
//  cent vingt messages, arrivé en bas, il faut remonter soixante-dix
//  mille pixels pour changer de page.
//
//  ── POURQUOI PAS UNE RETOUCHE DU GABARIT ────────────────────────────
//
//  Parce qu'elle devrait être collée à la main dans le panneau
//  d'administration, et que les collages s'accumulent — le garde-fou
//  n° 34 en suit déjà trente-trois, dont quinze en attente. Ici, le
//  navigateur a tout ce qu'il faut sous la main.
//
//  ── ON RECOPIE LES LIENS, PAS LE BLOC ───────────────────────────────
//
//  Le `.pagination` de Forumactif contient trois choses :
//
//    1. un `<script>` qui définit `createPagination` ;
//    2. un `<a href="javascript:Pagination();" onmousedown="…">`
//       qui ouvre un formulaire « Aller à la page » ;
//    3. un `<span>` avec la flèche « précédent » et les numéros.
//
//  On ne clone que le TROISIÈME. Recopier le second poserait un
//  second ouvreur pour le même panneau, et recopier le script le
//  ferait tourner deux fois. Le `<span>`, lui, n'est que des liens et
//  une image — rien qui s'exécute, rien qui porte d'identifiant.
//
//  ── ET ON NE POSE RIEN QUAND IL N'Y A QU'UNE PAGE ───────────────────
//
//  Sur un sujet d'une seule page, Forumactif sert un `.pagination` qui
//  ne contient aucun lien de page. Une barre vide sous le dernier
//  message annoncerait des pages qui n'existent pas.
// ════════════════════════════════════════════════════════════════════

/** Le bloc de liens de pages servi par Forumactif, ou `null`.
 *
 *  LE `<span>`, PAS LE `.pagination` ENTIER : voir l'en-tête. */
export function liensDesPages(doc: Document): HTMLElement | null {
  const pagination = doc.querySelector(".topic-actions .pagination");
  if (pagination === null) return null;
  for (const span of pagination.querySelectorAll<HTMLElement>(":scope > span")) {
    //  CELUI QUI PORTE DES LIENS DE PAGE. Forumactif en sert un
    //  autre, vide, sur un sujet d'une seule page — et le `<a>` du
    //  formulaire « Aller à la page » n'est pas dans un span.
    if (span.querySelector("a") !== null) return span;
  }
  return null;
}

/** La classe du bloc posé. Exportée parce que le harnais la vérifie,
 *  et qu'il doit vérifier LA valeur du code, pas une chaîne recopiée
 *  à côté. */
export const CLASSE = "wm-sujet__pages";

/**
 * Pose la pagination sous le dernier message. Rend `true` si elle
 * l'a fait.
 *
 * `false` est un résultat normal et fréquent : un sujet d'une seule
 * page, une page qui n'est pas un sujet, ou un bloc déjà posé.
 */
export function poserLaPaginationDuBas(doc: Document): boolean {
  if (doc.querySelector(`.${CLASSE}`) !== null) return false;
  const liens = liensDesPages(doc);
  if (liens === null) return false;

  const messages = doc.querySelectorAll(".post");
  const dernier = messages[messages.length - 1];
  if (dernier === undefined) return false;

  const nav = doc.createElement("nav");
  nav.className = CLASSE;
  //  ELLE SE NOMME, parce qu'il y en a deux dans la page et qu'un
  //  lecteur d'écran qui annonce « navigation » deux fois ne dit pas
  //  laquelle est laquelle.
  nav.setAttribute("aria-label", "Pages du sujet");

  //  LA MÊME CLASSE QUE L'ORIGINALE : toute la feuille `04` habille
  //  `.pagination`, et une seconde grammaire de pastilles pour le
  //  même objet serait deux feuilles à corriger le jour où elle
  //  bouge.
  const dedans = doc.createElement("div");
  dedans.className = "pagination";
  dedans.appendChild(liens.cloneNode(true));
  nav.appendChild(dedans);

  dernier.after(nav);
  return true;
}
