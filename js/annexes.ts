/// <reference lib="dom" />
// ════════════════════════════════════════════════════════════════════
//  js/annexes.ts — le sommaire, et RIEN d'autre
//
//  POURQUOI UN SECOND PAQUET. Les annexes sont devenues des pages
//  autonomes : « j'aimerai ne pas avoir le haut et le bas ». Une page
//  HTML Forumactif créée sans en-tête ne reçoit ni jQuery, ni
//  `_userdata`, ni les scripts de la Gestion des codes JS — donc pas
//  `wild-mystery.js` non plus. Elle charge ce qu'elle veut elle-même.
//
//  ET ELLE NE DOIT PAS CHARGER `wild-mystery.js`. Ce paquet-là réécrit
//  la barre d'outils du forum, remplit « Mes personnages », pose le
//  tchat, les territoires, le qui-est-en-ligne : tout cela suppose un
//  DOM de forum qui n'existe pas ici. Il monte aussi le switcheroo,
//  qui écrit des mots de passe dans le `localStorage` du navigateur —
//  il n'a rien à faire sur une page d'annexe, et le charger « au cas
//  où » serait l'y installer.
//
//  CE PAQUET-CI FAIT UNE SEULE CHOSE : lire `data/annexes.json` et
//  remplir le trou `[data-wm-sommaire]`. C'est ce qui garde le
//  sommaire en UN seul endroit : changer un titre reste une
//  modification de ce fichier, pas de quatorze pages collées.
//
//  LA RACINE SE DÉDUIT DE L'ADRESSE DU SCRIPT, comme dans l'autre
//  paquet : la page est servie par forumactif.com et les données par
//  GitHub Pages, donc une adresse relative chercherait au mauvais
//  endroit, et une adresse écrite en dur ici devrait être corrigée le
//  jour d'un déménagement.
// ════════════════════════════════════════════════════════════════════
import {
  poserLaSuivante,
  poserLeSommaire,
  poserLesSousOnglets,
} from "../src/adaptateurs/navigateur/module-annexes.ts";
import { poserLAccessibilite } from "../src/adaptateurs/navigateur/module-confort.ts";
import { poserLesInfobulles } from "../src/adaptateurs/navigateur/module-equipe.ts";
import { poserLesFiltres } from "../src/adaptateurs/navigateur/module-personnages.ts";
import { poserLeTheme } from "../src/adaptateurs/navigateur/module-theme-annexe.ts";
import { Preferences } from "../src/navigateur/preferences.ts";
import { StockageLocal } from "../src/adaptateurs/navigateur/stockage.ts";
import { adresseDuScript, racineDesDonnees } from "../src/adaptateurs/navigateur/catalogue.ts";

const RACINE = racineDesDonnees(adresseDuScript(document));

async function poser(): Promise<void> {
  if (RACINE === null) return;
  if (document.querySelector("[data-wm-sommaire]") === null) return;
  const donnees = await fetch(`${RACINE}annexes.json`, { credentials: "omit" })
    .then((r) => (r.ok ? r.json() : null))
    .catch(() => null);
  poserLeSommaire({ doc: document, donnees });
  //  LE BOUTON « SUIVANTE » VIENT DU MÊME FICHIER. Écrit à la
  //  construction, il pointait sur `#` tant que la page d'après
  //  n'existait pas ; refait ici, il saute les pages absentes et se
  //  réveille dès qu'une adresse est remplie — sans recoller.
  poserLaSuivante({ doc: document, donnees });
}

//  LE THÈME NE DÉPEND D'AUCUN FICHIER, donc il est posé tout de suite
//  et pas après la requête : attendre le sommaire pour habiller la page
//  la ferait clignoter du clair au sombre sous les yeux du joueur.
const prefs = new Preferences(new StockageLocal());
poserLeTheme(document, prefs);

//  ── LES TROIS RÉGLAGES DE CONFORT, SUR LES ANNEXES AUSSI ────────────
//
//  Demandé le 8 novembre : « ajoute le module d'accessibilité dans les
//  annexes aussi ».
//
//  Il n'y était pas, et ce n'était pas un oubli de configuration : les
//  pages d'annexe sont servies par le système de pages HTML de
//  Forumactif, `overall_header` ne les habille pas, et elles ne
//  chargent que ce fichier-ci. Mesuré sur la page des arènes en ligne : zéro
//  `.wm-coin`, donc zéro réglage — `poserLAccessibilite` cherchait un
//  coin d'outils qui n'existe pas ici.
//
//  Il s'accroche donc à la barre de retour, qui porte déjà le bouton de
//  thème. APRÈS `poserLeTheme`, et c'est une dépendance d'ordre : les
//  deux visent la même barre, et on veut le thème en premier — c'est
//  celui qu'on cherche le plus souvent.
poserLAccessibilite(document, prefs);

//  ── LES INFOBULLES DES ÉQUIPES ──────────────────────────────────────
//
//  AVANT LES SOUS-ONGLETS, et c'est une dépendance d'ordre : les
//  sections se replient juste après, et une bulle construite dans une
//  section déjà cachée coûterait un calcul de mise en page pour rien.
//  La fonction ne fait rien sur les treize autres annexes : elle ne
//  touche que les cases qui portent `data-wm-bulle`.
poserLesInfobulles(document);

//  LES SOUS-ONGLETS NE DÉPENDENT D'AUCUN FICHIER non plus : les
//  sections sont dans la page. On les pose tout de suite, avant la
//  requête du sommaire, pour que la page ne s'affiche pas dépliée une
//  seconde avant de se replier sous les yeux du lecteur.
poserLesSousOnglets(document);

//  LES FILTRES DE L'ANNEXE 11, pour la même raison : les quatorze
//  fiches sont dans la page, la barre qui les trie est posée ici. Sur
//  les treize autres annexes, il n'y a pas de liste et la fonction ne
//  fait rien.
poserLesFiltres(document);

//  LA PAGE RESTE LISIBLE SANS CE SCRIPT. Le texte est dans la page, en
//  vrai HTML ; sans sommaire il manque une navigation, pas le contenu.
//  C'est pour ça qu'on n'attend rien et qu'on n'affiche aucune erreur.
poser().catch(() => {});
