// ════════════════════════════════════════════════════════════════════
//  messagerie.ts — ce que la page des messages privés dit d'elle-même
//
//  COUVERT PAR : src/navigateur/messagerie.test.ts
//
//  ── POURQUOI UNE LECTURE DE PHRASE ────────────────────────────────
//
//  La maquette `343:538` montre le quota en BARRE : « Ta boîte est
//  remplie à 34 % », avec la jauge sous le texte.
//
//  Forumactif, lui, n'en dit qu'une phrase. Relevé le 13 novembre sur
//  `/privmsg?folder=sentbox`, dans `p.left-box` :
//
//      « Votre boîte des messages envoyés est pleine à 8% »
//
//  Le pourcentage est DANS le texte, et c'est la seule forme où on
//  l'ait : `{INBOX_LIMIT_PERCENT}` n'existe qu'en phpBB2, pas sur
//  ModernBB. Pour dessiner la jauge, il faut donc lire la phrase.
//
//  ── ET NE RIEN EN DÉDUIRE DE PLUS ─────────────────────────────────
//
//  La maquette montre aussi « 17 messages sur 50 » à droite de la
//  barre. Ces deux nombres ne sont nulle part dans la page : on ne les
//  invente pas. La barre dira le pourcentage, et rien d'autre.
// ════════════════════════════════════════════════════════════════════

/**
 * Le pourcentage de remplissage de la boîte, lu dans la phrase que
 * Forumactif écrit. Rend `null` quand il n'y en a pas.
 *
 * ── CE QUI REND `null`, ET POURQUOI ───────────────────────────────
 *
 * · « Votre boîte de réception est vide » — relevé le même jour sur
 *   `?folder=inbox`. Pas de pourcentage, donc pas de jauge : une barre
 *   à zéro sur une boîte vide est du mobilier ;
 * · une phrase sans chiffre, ou dans une autre langue que celle qu'on
 *   a relevée. On préfère ne pas dessiner que dessiner faux.
 *
 * Le nombre est BORNÉ À CENT : Forumactif compte les brouillons dans
 * le quota, et une boîte au-delà de sa limite afficherait un
 * pourcentage supérieur à cent — une barre qui déborde de sa gouttière
 * dirait moins bien « c'est plein » qu'une barre pleine.
 */
export function pourcentageDeQuota(texte: string | null | undefined): number | null {
  if (typeof texte !== "string") return null;
  //  Le `%` est ce qui distingue le pourcentage d'un autre nombre de la
  //  phrase : on ne prend un chiffre que s'il porte son signe.
  const trouve = texte.match(/(\d{1,3})\s*%/);
  if (trouve === null) return null;
  const n = Number(trouve[1]);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.min(n, 100);
}
