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
import {
  poserLaSuivante,
  poserLeSommaire,
} from "../src/adaptateurs/navigateur/module-annexes.ts";
import { poserLeTheme } from "../src/adaptateurs/navigateur/module-theme-annexe.ts";
import { poserLesAvertissements } from "../src/adaptateurs/navigateur/module-tw.ts";
import { poserLeProfil } from "../src/adaptateurs/navigateur/module-profil.ts";
import { poserSonJeu } from "../src/adaptateurs/navigateur/module-profil-jeu.ts";
import { Preferences } from "../src/navigateur/preferences.ts";
import { StockageLocal } from "../src/adaptateurs/navigateur/stockage.ts";

const g = globalThis as unknown as Record<string, unknown>;

g.wmPoserLeSommaire = (donnees: unknown): boolean => {
  const pose = poserLeSommaire({ doc: document, donnees });
  poserLaSuivante({ doc: document, donnees });
  return pose;
};

//  LE BOUTON DE THÈME EST MONTÉ PAR LE HARNAIS AUSSI. Mesurer une page
//  sans lui, c'est mesurer une page que personne ne verra : il ajoute
//  un bouton dans la barre, et le thème sombre passe par lui.
g.wmPoserLeTheme = (): boolean => poserLeTheme(document, new Preferences(new StockageLocal()));

//  LES PASSAGES MASQUÉS, pour `outils/annonces.mjs`. Même raison que
//  le sommaire : le harnais mesure le bouton POSÉ PAR LE MODULE, pas
//  un bouton que j'aurais recopié dans la page d'essai — et qui serait
//  resté juste même après que le module ait cessé de l'être.
g.wmPoserLesAvertissements = (): number => poserLesAvertissements(document);

//  LE PROFIL, pour `outils/profil.mjs` : même raison que les deux
//  au-dessus — le harnais mesure le balisage du module, pas une copie.
g.wmPoserLeProfil = (): boolean => poserLeProfil(document);

//  « SON JEU », pour `outils/profil.mjs`. Le harnais sert lui-même la
//  réponse de `carte_dresseur` et les deux fichiers de données : ce
//  qu'on mesure est le rendu, pas le réseau.
g.wmPoserSonJeu = (url: string, cle: string): Promise<boolean> =>
  poserSonJeu(document, { url, clePubliable: cle }, "/data/", "/img/");
