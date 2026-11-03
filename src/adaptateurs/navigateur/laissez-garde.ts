/// <reference lib="dom" />
// ════════════════════════════════════════════════════════════════════
//  src/adaptateurs/navigateur/laissez-garde.ts
//
//  COUVERT PAR : outils/carnet.mjs — le laissez-passer survit à un
//  rechargement, et un stockage refusé ne casse pas la page.
//
//  OÙ VIT LE LAISSEZ-PASSER, ET POURQUOI C'EST ACCEPTABLE.
//
//  Dans `localStorage`, comme la session de n'importe quel site. Ce
//  n'est pas la même chose que les mots de passe du switcheroo, qui
//  ouvrent le compte FORUM de quelqu'un : ici c'est un jeton de jeu,
//  à durée limitée, qui n'ouvre que le carnet de ses personnages.
//
//  UN SEUL LAISSEZ-PASSER À LA FOIS. Une personne qui aurait deux
//  boîtes — donc deux connexions — devrait se reconnecter en changeant
//  de groupe de personnages. Le cas est rare, et la page le DIT au lieu
//  de le cacher : mieux vaut une phrase claire qu'un tiroir de jetons
//  qu'on ne sait plus vider.
// ════════════════════════════════════════════════════════════════════

import type { Laissez } from "../../navigateur/session-de-jeu.ts";

export const CLEF = "wm.carnet.laissez";

export function lireLeLaissez(): Laissez | null {
  try {
    const brut = localStorage.getItem(CLEF);
    if (brut === null) return null;
    const lu = JSON.parse(brut) as Partial<Laissez>;
    if (typeof lu?.jeton !== "string" || lu.jeton === "") return null;
    if (typeof lu?.rafraichir !== "string" || lu.rafraichir === "") return null;
    if (typeof lu?.expireLe !== "number") return null;
    return { jeton: lu.jeton, rafraichir: lu.rafraichir, expireLe: lu.expireLe };
  } catch {
    //  Navigation privée, stockage refusé, JSON abîmé : on repart de
    //  rien. C'est pénible — il faudra se relier — ce n'est pas cassé.
    return null;
  }
}

export function garderLeLaissez(l: Laissez): void {
  try {
    localStorage.setItem(CLEF, JSON.stringify(l));
  } catch { /* voir ci-dessus */ }
}

export function oublierLeLaissez(): void {
  try {
    localStorage.removeItem(CLEF);
  } catch { /* idem */ }
}
