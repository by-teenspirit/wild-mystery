/// <reference lib="dom" />
// ════════════════════════════════════════════════════════════════════
//  src/adaptateurs/navigateur/compte-du-forum.ts
//
//  COUVERT PAR : outils/carnet.mjs — la page sert une fausse page de
//  forum sur la même origine et le carnet s'ouvre sans rien demander.
//
//  ── POURQUOI `/memberlist` ──────────────────────────────────────────
//
//  Il faut UNE page du forum, n'importe laquelle, puisqu'elles portent
//  toutes `_userdata`. Quatre ont été mesurées le 3 novembre :
//  `/memberlist` 51 ko, `/privmsg?folder=inbox` 44 ko, `/groups` 60,
//  `/faq` 88.
//
//  La boîte de réception est la plus légère, et c'est justement
//  pourquoi on ne la prend pas : aller lire les messages privés de
//  quelqu'un pour savoir son numéro est une familiarité qu'on n'a pas
//  besoin de prendre, et le jour où Forumactif marquerait quelque chose
//  comme lu en la servant, on l'aurait fait sans le vouloir. La liste
//  des membres ne dit rien de personne en particulier.
//
//  ── ET UNE SEULE FOIS PAR VISITE ────────────────────────────────────
//
//  51 ko pour un numéro, c'est beaucoup. Le résultat est donc gardé
//  pour la durée de la page : la fonction peut être appelée autant de
//  fois qu'on veut, elle ne demande qu'au premier appel.
// ════════════════════════════════════════════════════════════════════

import { compteDansLaPage, type CompteDuForum } from "../../navigateur/compte-du-forum.ts";

export const PAGE_TEMOIN = "/memberlist";

/** Ce qu'on demande au navigateur, et rien de plus : de quoi servir une
 *  page du forum. Le harnais en fournit une autre. */
export type Demandeur = (adresse: string) => Promise<string>;

export function demandeurDuNavigateur(): Demandeur {
  return async (adresse: string) => {
    const r = await fetch(adresse, { credentials: "same-origin" });
    if (!r.ok) throw new Error(`le forum a répondu ${r.status}`);
    return await r.text();
  };
}

let garde: { lu: CompteDuForum | null } | null = null;

/** Le membre qui regarde la page, ou `null` s'il n'est pas connecté.
 *
 *  LÈVE SI LE FORUM NE RÉPOND PAS, et ne rend pas `null` : « tu n'es
 *  pas connecté » et « je n'ai pas pu demander » appellent deux
 *  réponses différentes, et les confondre enverrait se connecter
 *  quelqu'un qui l'est déjà. */
export async function compteQuiRegarde(
  demander: Demandeur,
  adresse: string = PAGE_TEMOIN,
): Promise<CompteDuForum | null> {
  if (garde !== null) return garde.lu;
  const lu = compteDansLaPage(await demander(adresse));
  garde = { lu };
  return lu;
}

/** Pour le harnais, qui monte plusieurs cas dans une seule page. */
export function oublierLeCompte(): void {
  garde = null;
}
