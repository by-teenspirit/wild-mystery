// ════════════════════════════════════════════════════════════════════
//  src/domaine/reclamation.ts
//
//  OUVRIR SON CARNET SANS QUE PERSONNE NE LUI ENVOIE RIEN.
//
//  « Ce serait possible d'avoir un truc moins compliqué où j'ai pas
//  besoin de lui envoyer ? », 2 novembre. Oui : le joueur prouve qu'il
//  possède son compte **en postant**, et c'est Forumactif qui garantit
//  l'auteur du message — pas nous.
//
//  ── POURQUOI CE N'EST PAS LA CLÉ QU'ON POSTE ────────────────────────
//
//  Un sujet se lit par tout le monde. Si le joueur postait sa clé, le
//  premier passant la recopierait et ouvrirait son carnet. Il poste
//  donc une EMPREINTE — l'empreinte SHA-256 d'un secret que seule sa
//  page connaît — et la relève lie cette empreinte à son compte. La
//  page échange ensuite le secret contre la clé.
//
//  Qui lit le sujet voit l'empreinte et ne peut rien en faire : il
//  faudrait inverser SHA-256 pour retrouver le secret. C'est le
//  mécanisme d'une connexion sans mot de passe, et c'est la seule
//  forme qui tienne dans un fil public.
//
//  ── CE QUI RESTE POSSIBLE, ET QU'ON TRAITE À L'AFFICHAGE ────────────
//
//  Quelqu'un peut recopier l'empreinte de quelqu'un d'autre et la
//  poster à son tour. La relève garde alors **la première** — celle du
//  joueur, qui a posté d'abord. Si le copieur postait AVANT l'original,
//  l'original récupérerait une clé liée au compte du copieur : il
//  verrait le carnet de l'autre, pas l'inverse. La page nomme donc le
//  dresseur reconnu et demande confirmation avant de garder la clé.
//  Ça ne se répare pas en base, parce qu'en base les deux messages se
//  ressemblent exactement.
//
//  ── LA FORME DU BLOC ────────────────────────────────────────────────
//
//  `[[WM-CARNET:<48 caractères hexadécimaux>]]`, de la même famille que
//  `[[WM-ACTION:…]]` : Forumactif ne connaît pas ces crochets, donc ils
//  traversent l'éditeur, le BBCode et le nettoyage sans être
//  transformés — et notre CSS les masque déjà aux lecteurs.
//
//  48 caractères, soit 192 bits : c'est la moitié d'une empreinte
//  SHA-256, tronquée pour tenir sur une ligne. Tronquer une empreinte
//  n'affaiblit que la résistance aux collisions, pas la difficulté de
//  l'inverser, et 192 bits de collision est très au-delà de ce qu'un
//  forum de jeu de rôle demande.
// ════════════════════════════════════════════════════════════════════

/** Longueur de l'empreinte postée, en caractères hexadécimaux. */
export const TAILLE_EMPREINTE = 48;

/** Longueur du secret que la page garde, en caractères hexadécimaux. */
export const TAILLE_SECRET = 32;

const BLOC = /\[\[\s*WM-CARNET\s*:\s*([0-9a-f]{48})\s*\]\]/i;

/** L'empreinte réclamée dans un message, ou `null`.
 *
 *  STRICT SUR LA FORME, et c'est voulu : 48 caractères hexadécimaux
 *  exactement. Un bloc à moitié recopié ne doit pas lier un compte à
 *  une empreinte tronquée que personne ne pourra plus réclamer. */
export function empreinteReclamee(corps: string): string | null {
  const m = corps.match(BLOC);
  return m === null ? null : m[1].toLowerCase();
}

/** Le bloc à écrire dans le message, tel que la page le pré-remplit. */
export function blocDeReclamation(empreinte: string): string {
  return `[[WM-CARNET:${empreinte.toLowerCase()}]]`;
}

/** Vrai si ce secret a la forme attendue. La page le vérifie avant de
 *  l'envoyer, la base le revérifie : une validation côté navigateur
 *  n'est jamais une garantie. */
export function secretBienForme(secret: string): boolean {
  return new RegExp(`^[0-9a-f]{${TAILLE_SECRET}}$`).test(secret);
}
