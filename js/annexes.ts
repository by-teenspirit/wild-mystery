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
poserLeTheme(document, new Preferences(new StockageLocal()));

//  LES SOUS-ONGLETS NE DÉPENDENT D'AUCUN FICHIER non plus : les
//  sections sont dans la page. On les pose tout de suite, avant la
//  requête du sommaire, pour que la page ne s'affiche pas dépliée une
//  seconde avant de se replier sous les yeux du lecteur.
poserLesSousOnglets(document);

//  LA PAGE RESTE LISIBLE SANS CE SCRIPT. Le texte est dans la page, en
//  vrai HTML ; sans sommaire il manque une navigation, pas le contenu.
//  C'est pour ça qu'on n'attend rien et qu'on n'affiche aucune erreur.
poser().catch(() => {});
