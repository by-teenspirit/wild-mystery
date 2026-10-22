/// <reference lib="dom" />
/// <reference lib="dom.iterable" />
// ════════════════════════════════════════════════════════════════════
//  src/adaptateurs/navigateur/stockage.ts
//
//  COUVERT PAR : outils/confort.mjs — la clé `wm.confort` relue dans `localStorage` après un clic.
//  (Garde-fou n° 22 : un module d'interface sans test unitaire doit dire
//   quel harnais le monte, et ce harnais doit tourner dans le CI.)
//
//  `localStorage` derrière le port `Stockage`.
//
//  Il ne rattrape rien : c'est `Preferences` qui décide quoi faire d'une
//  panne, et elle le fait déjà, testée. Un adaptateur qui avale les
//  erreurs à la place du cas d'usage rend la règle invisible.
//
//  Pourquoi le stockage du navigateur et pas la base : une préférence
//  d'affichage ne regarde personne d'autre, ne doit pas attendre un
//  aller-retour réseau avant que la page s'affiche, et ne vaut pas une
//  colonne, une migration et une synchronisation.
// ════════════════════════════════════════════════════════════════════

import type { Stockage } from "../../navigateur/preferences.ts";

export class StockageLocal implements Stockage {
  lire(cle: string): string | null {
    return localStorage.getItem(cle);
  }

  ecrire(cle: string, valeur: string): void {
    localStorage.setItem(cle, valeur);
  }
}
