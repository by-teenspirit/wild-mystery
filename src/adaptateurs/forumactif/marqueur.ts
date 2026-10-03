// ════════════════════════════════════════════════════════════════════
//  src/adaptateurs/forumactif/marqueur.ts
//  Le marqueur posé dans un message, et relu par le serveur.
//
//  Forme :  [[WM:<charge>:<CODE>]]
//
//  Du texte brut, pas du HTML. Et c'est voulu : un message passe par
//  l'éditeur de Forumactif, par le BBCode, par le nettoyage des balises
//  et par la version mobile. Une balise `<span data-…>` peut ne pas
//  survivre à tout ça ; une suite de caractères, si.
//
//  Le joueur le voit si le JavaScript est coupé. Ce n'est pas un défaut :
//  c'est la pièce justificative de ce qui lui a été accordé.
// ════════════════════════════════════════════════════════════════════

import { codeValide } from "../../domaine/code.ts";

export type Marqueur = {
  readonly charge: string;
  readonly code: string;
};

/** `[[WM:` … `:` … `]]`, sans rien avaler d'autre que du base64url et
 *  un code. Si quelqu'un écrit `[[WM:` à la main dans son RP, il ne
 *  tombera pas dessus par hasard. */
const FORME = /\[\[WM:([A-Za-z0-9_-]+):(WM-[A-Z0-9]{4}-[A-Z0-9]{3})\]\]/g;

export function marqueursDe(texte: string): readonly Marqueur[] {
  const trouves: Marqueur[] = [];
  for (const m of texte.matchAll(FORME)) {
    if (codeValide(m[2])) trouves.push({ charge: m[1], code: m[2] });
  }
  return trouves;
}

export function ecrireUnMarqueur(charge: string, code: string): string {
  return `[[WM:${charge}:${code}]]`;
}

/** Enlève les marqueurs d'un texte, pour l'afficher proprement quand le
 *  JavaScript est là. */
export function sansMarqueurs(texte: string): string {
  return texte.replace(FORME, "").replace(/[ \t]{2,}/g, " ");
}
