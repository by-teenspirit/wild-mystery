// ════════════════════════════════════════════════════════════════════
//  src/application/sprite.ts
//
//  L'adresse du sprite d'une espèce, pour un message que le Maître du
//  Jeu poste sur le forum.
//
//  ── POURQUOI PAS `adresseDuSprite` DU NAVIGATEUR ────────────────────
//
//  Celle-là lit `data/sprites-couverture.json` — 955 entrées, trois
//  styles, et le style VOULU PAR LE LECTEUR, rangé dans son
//  `localStorage`. Rien de tout ça n'existe ici :
//
//    · un message est écrit UNE fois, pour tout le monde. Il n'a pas de
//      lecteur au moment où il part, donc pas de style choisi ;
//    · la relève tourne sur un serveur et n'a pas de `localStorage` ;
//    · charger une carte de couverture de 955 entrées pour en lire deux
//      coûterait un aller-retour réseau par passage de la relève.
//
//  LE STYLE DU MESSAGE EST DONC FIXE, et c'est `forum` — le style que
//  la charte utilise partout ailleurs dans un corps de message. Le
//  navigateur, lui, peut réécrire ce sprite selon le goût du lecteur :
//  `Sprites.especeDe()` existe exactement pour ça, et c'est pour ça
//  que l'adresse porte le numéro en clair à la fin.
//
//  ── POURQUOI L'IMAGE FIGÉE ET PAS L'ANIMÉE ──────────────────────────
//
//  Un combat de cinq tours fait cinq messages, chacun avec deux
//  sprites. Dix GIF animés dans un sujet, qui tournent tant que la
//  page est ouverte : c'est la même mesure que celle du 4 novembre,
//  quand 933 GIF se sont retrouvés dans la grille du carnet. Les PNG
//  figés pèsent trois kilos et ne bougent pas.
// ════════════════════════════════════════════════════════════════════

/** Le style servi dans un message. Fixe, et ce n'est pas un réglage :
 *  voir l'en-tête. */
export const STYLE_DU_FORUM = "forum";

/** Le dossier des sprites figés, dans le dépôt.
 *
 *  LE MÊME CHEMIN QUE DANS `data/sprites-couverture.json`, et il n'est
 *  pas lu depuis ce fichier : la couverture dit QUELLES espèces ont un
 *  sprite, pas où le dossier est. Les 955 espèces du Pokédex en ont
 *  toutes un dans le style `forum` — vérifié par le garde-fou n° 25,
 *  qui refuse une espèce sans sprite. */
const DOSSIER = "assets/sprites-figes";

/** L'adresse du sprite figé d'une espèce, ou `null`.
 *
 *  `null` pour un numéro qui n'est pas un numéro d'espèce — et
 *  l'appelant n'affiche alors pas d'image, plutôt qu'une image cassée.
 *  Le cas arrive : une espèce de test (`Debugant`) vit hors du
 *  Pokédex.
 *
 *  LA RACINE PEUT FINIR PAR UNE BARRE OU PAS, et les deux formes
 *  circulent — `WM_RACINE_DONNEES` est saisie à la main dans les
 *  secrets de Supabase. Deux barres de suite donnent un 404 chez
 *  GitHub Pages, donc on normalise ici une fois pour toutes. */
export function adresseDuSpriteFige(
  racine: string,
  especeId: number,
): string | null {
  if (!Number.isInteger(especeId) || especeId <= 0) return null;
  const propre = racine.trim();
  if (propre === "") return null;
  const base = propre.endsWith("/") ? propre : `${propre}/`;
  return `${base}${DOSSIER}/${STYLE_DU_FORUM}/${especeId}.png`;
}
