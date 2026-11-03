/// <reference lib="dom" />
// ════════════════════════════════════════════════════════════════════
//  src/adaptateurs/navigateur/compte-du-forum.ts
//
//  COUVERT PAR : outils/carnet.mjs — le décor sert une vraie page
//  d'édition de profil sur la même origine, et le carnet s'ouvre sans
//  rien demander à personne.
//
//  ── UNE SEULE PAGE, ET ELLE DIT LES DEUX CHOSES ─────────────────────
//
//  `/h15-mon-carnet` est servie sans l'en-tête du forum — c'est ce qui
//  lui donne son allure — donc `_userdata` n'existe pas dessus, mesuré
//  le 3 novembre. Mais le navigateur peut demander une page du forum
//  AVEC la session du membre, puisqu'on est sur le même domaine.
//
//  On demande `/profile?mode=editprofile`, et pas la liste des
//  membres, parce qu'elle porte LES DEUX choses dont le carnet a
//  besoin :
//
//    · `_userdata`, donc qui regarde la page ;
//    · la clé de liaison, que le staff y a posée.
//
//  113 ko contre 51 pour la liste des membres, mais une demande au lieu
//  de deux — et surtout cette page-là ne se charge QU'AVEC la session
//  de son propriétaire : il n'y a aucun paramètre pour demander le
//  profil de quelqu'un d'autre. C'est ce qui fait de la clé une preuve.
//
//  ── ET UNE SEULE FOIS PAR VISITE ────────────────────────────────────
//
//  Le résultat est gardé pour la durée de la page : les fonctions
//  peuvent être appelées autant de fois qu'on veut, elles ne demandent
//  qu'au premier appel.
// ════════════════════════════════════════════════════════════════════

import { compteDansLaPage, type CompteDuForum } from "../../navigateur/compte-du-forum.ts";
import { type ChampDeProfil, cleParmiLesChamps } from "../../navigateur/cle-de-liaison.ts";

export const PAGE_DU_PROFIL = "/profile?mode=editprofile";

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

export type ProfilLu = {
  /** `null` pour un invité. */
  readonly compte: CompteDuForum | null;
  /** `null` si le staff n'a pas encore posé la clé. */
  readonly cle: string | null;
};

let garde: ProfilLu | null = null;

/** Qui regarde la page, et la clé que le staff lui a posée.
 *
 *  LÈVE SI LE FORUM NE RÉPOND PAS, et ne rend pas un profil vide :
 *  « tu n'es pas connectée » et « je n'ai pas pu demander » appellent
 *  deux réponses différentes, et les confondre enverrait se connecter
 *  quelqu'un qui l'est déjà. */
export async function profilQuiRegarde(
  demander: Demandeur,
  adresse: string = PAGE_DU_PROFIL,
): Promise<ProfilLu> {
  if (garde !== null) return garde;
  const code = await demander(adresse);
  const compte = compteDansLaPage(code);
  //  LA CLÉ N'EST CHERCHÉE QUE POUR UN MEMBRE CONNECTÉ. La page d'un
  //  invité n'a pas de champs de profil du tout, et chercher dedans
  //  ferait croire que le staff a oublié la clé de quelqu'un.
  const cle = compte === null ? null : cleParmiLesChamps(champsDuProfil(code));
  garde = { compte, cle };
  return garde;
}

/** Les champs du formulaire de profil, étiquette et valeur.
 *
 *  LA FAÇON DE TROUVER L'ÉTIQUETTE EST CELLE QU'ON A MESURÉE, pas
 *  celle qu'on devine : Forumactif met le champ dans une cellule, et
 *  l'étiquette dans celle d'avant. Relevé le 3 novembre sur le vrai
 *  formulaire — les vingt-et-un champs sortent avec la bonne étiquette,
 *  « clé de liaison : » comprise. */
export function champsDuProfil(code: string): ChampDeProfil[] {
  const doc = new DOMParser().parseFromString(code, "text/html");
  const vus = new Set<string>();
  const champs: ChampDeProfil[] = [];
  for (const e of doc.querySelectorAll("[name^='profile_field_']")) {
    const nom = e.getAttribute("name") ?? "";
    //  Un champ à choix multiples sort plusieurs fois sous le même nom.
    if (nom === "" || vus.has(nom)) continue;
    vus.add(nom);
    const bloc = e.closest("dd, td, .field, div");
    const etiquette = (bloc?.previousElementSibling?.textContent ?? "")
      .replace(/\s+/g, " ")
      .trim();
    if (etiquette === "") continue;
    const valeur = e instanceof HTMLInputElement || e instanceof HTMLTextAreaElement
      ? e.value
      : "";
    champs.push({ etiquette, valeur });
  }
  return champs;
}

/** Pour le harnais, qui monte plusieurs cas dans une seule page. */
export function oublierLeProfil(): void {
  garde = null;
}
