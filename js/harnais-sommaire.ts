/// <reference lib="dom" />
// ════════════════════════════════════════════════════════════════════
//  js/harnais-sommaire.ts
//
//  Une porte d'entrée pour le harnais de contraste, et rien d'autre.
//  Elle expose `poserLeSommaire` au harnais, qui mesure ainsi le VRAI
//  balisage du module au lieu d'un balisage recopié à la main — une
//  feuille vérifiée contre un faux balisage ne vérifie rien.
//
//  Elle n'est jamais servie au forum : `overall_header` ne charge que
//  `wild-mystery.js`.
// ════════════════════════════════════════════════════════════════════
import { poserLeSommaire } from "../src/adaptateurs/navigateur/module-annexes.ts";

(globalThis as unknown as Record<string, unknown>).wmPoserLeSommaire = (
  donnees: unknown,
): boolean => poserLeSommaire({ doc: document, donnees });
