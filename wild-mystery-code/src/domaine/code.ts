// ════════════════════════════════════════════════════════════════════
//  src/domaine/code.ts
//  Le code de vérification publié sous chaque événement.
//
//  COUCHE DOMAINE : pas de `crypto` ici. Le domaine décide de la FORME
//  du code et de la façon de le dériver d'une empreinte ; c'est un
//  adaptateur qui calcule l'empreinte (HMAC-SHA-256, Web Crypto), parce
//  qu'elle a besoin d'un secret et que le domaine n'en tient aucun.
//
//  À quoi sert ce code : il est publié dans le module de bilan à côté
//  de chaque ligne. N'importe qui peut le recopier au staff, et le
//  serveur peut recalculer la même valeur depuis la graine. Un joueur
//  ne peut pas en fabriquer un, parce qu'il lui manque le secret.
// ════════════════════════════════════════════════════════════════════

/** Vingt-six symboles, sans ceux qui se confondent à la lecture :
 *  ni O/0, ni I/1, ni S/5, ni B/8, ni Z/2. Le code est fait pour être
 *  recopié à la main dans un message de litige. */
export const ALPHABET = "ACDEFGHJKLMNPQRTUVWXY34679";

export const PREFIXE = "WM";
const LONGUEURS = [4, 3] as const;
const SYMBOLES = LONGUEURS[0] + LONGUEURS[1];

export class EmpreinteInvalide extends Error {
  constructor(taille: number) {
    super(`Empreinte de ${taille} octets : il en faut au moins ${SYMBOLES}.`);
    this.name = "EmpreinteInvalide";
  }
}

/**
 * Transforme une empreinte en code lisible : `WM-7K4P-9QX`.
 *
 * Un octet par symbole, pris modulo la taille de l'alphabet. Le biais
 * introduit par le modulo est négligeable ici : on ne protège pas une
 * clé, on rend un jeton de vérification non devinable.
 */
export function codeDepuisEmpreinte(octets: Uint8Array): string {
  if (octets.length < SYMBOLES) throw new EmpreinteInvalide(octets.length);

  const symboles: string[] = [];
  for (let i = 0; i < SYMBOLES; i++) {
    symboles.push(ALPHABET[octets[i] % ALPHABET.length]);
  }

  return [
    PREFIXE,
    symboles.slice(0, LONGUEURS[0]).join(""),
    symboles.slice(LONGUEURS[0]).join(""),
  ].join("-");
}

const FORME = new RegExp(
  `^${PREFIXE}-[${ALPHABET}]{${LONGUEURS[0]}}-[${ALPHABET}]{${LONGUEURS[1]}}$`,
);

/** Dit si une chaîne a la forme d'un code. Ne dit pas qu'il est
 *  authentique : seul le serveur, qui tient le secret, peut le dire. */
export function codeValide(code: string): boolean {
  return FORME.test(code);
}

/** Compare deux codes sans tenir compte de la casse ni des espaces
 *  autour : un joueur recopie à la main, on ne va pas le punir pour
 *  une majuscule. */
export function memeCode(a: string, b: string): boolean {
  return a.trim().toUpperCase() === b.trim().toUpperCase();
}
