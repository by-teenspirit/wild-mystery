/// <reference lib="dom" />
// ════════════════════════════════════════════════════════════════════
//  src/adaptateurs/navigateur/reclamation.ts
//
//  COUVERT PAR : outils/carnet.mjs — le secret tiré, l'empreinte
//  calculée, et le bloc pré-rempli dans le formulaire du forum.
//
//  LA MOITIÉ NAVIGATEUR DE L'OUVERTURE SANS CLÉ.
//
//  Trois gestes, et ils tiennent en trois fonctions : tirer un secret,
//  en calculer l'empreinte, ouvrir le formulaire du forum avec le bloc
//  déjà écrit. Le reste — qui a posté, quand, et la clé — est au
//  serveur, parce que c'est la seule chose qu'un navigateur ne peut
//  pas prouver sur lui-même.
//
//  LE SECRET EST TIRÉ PAR `crypto.getRandomValues`, jamais par
//  `Math.random`, qui est prévisible et n'a jamais prétendu le
//  contraire. C'est ce secret qui tient toute la sécurité du montage.
// ════════════════════════════════════════════════════════════════════
import { TAILLE_EMPREINTE, TAILLE_SECRET } from "../../domaine/reclamation.ts";

function enHexa(octets: Uint8Array): string {
  return [...octets].map((o) => o.toString(16).padStart(2, "0")).join("");
}

/** Un secret de 128 bits, en hexadécimal. */
export function tirerUnSecret(): string {
  const octets = new Uint8Array(TAILLE_SECRET / 2);
  crypto.getRandomValues(octets);
  return enHexa(octets);
}

/** L'empreinte à poster : SHA-256 du secret, tronquée.
 *
 *  LA MÊME QUE CELLE DE LA BASE, au caractère près — `0023` calcule
 *  `left(encode(digest(secret,'sha256'),'hex'), 48)`. Les deux doivent
 *  s'accorder ou rien ne se lie, et c'est le genre de désaccord qui ne
 *  se voit qu'au premier vrai joueur : le harnais vérifie donc les
 *  deux contre un vecteur connu. */
export async function empreinteDuSecret(secret: string): Promise<string> {
  const brut = new TextEncoder().encode(secret);
  const somme = await crypto.subtle.digest("SHA-256", brut);
  return enHexa(new Uint8Array(somme)).slice(0, TAILLE_EMPREINTE);
}

/** L'adresse du formulaire de réponse de Forumactif, pré-rempli.
 *
 *  ON NE POSTE PAS À LA PLACE DU JOUEUR. C'est la règle de tout le
 *  projet — « rien ne poste à la place du joueur » — et ici elle est
 *  aussi ce qui rend le montage sûr : c'est l'envoi du joueur, depuis
 *  sa session, qui prouve que le compte est le sien. */
export function adresseDeReponse(sujetId: number, bloc: string): string {
  return `/post?t=${sujetId}&mode=reply&message=${encodeURIComponent(bloc)}`;
}
