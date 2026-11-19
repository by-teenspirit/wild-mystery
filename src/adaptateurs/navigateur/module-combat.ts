/// <reference lib="dom" />
// ════════════════════════════════════════════════════════════════════
//  src/adaptateurs/navigateur/module-combat.ts
//
//  COUVERT PAR : outils/sujet.mjs — les sprites d'une carte postée
//  sont rendus au lecteur, animés, dans son style, et une adresse
//  morte est réparée.
//
//  LES SPRITES DES CARTES DÉJÀ POSTÉES, RENDUS AU LECTEUR.
//
//  ── POURQUOI ÇA PEUT MARCHER ────────────────────────────────────────
//
//  `src/application/sprite.ts` l'annonce depuis le premier jour, dans
//  son en-tête : « le navigateur, lui, peut réécrire ce sprite selon
//  le goût du lecteur, et c'est pour ça que l'adresse porte le numéro
//  en clair à la fin ». Le crochet était prévu ; personne ne l'avait
//  accroché.
//
//  ── TROIS CHOSES D'UN SEUL GESTE ────────────────────────────────────
//
//  1 · L'ANIMATION. « Garde l'animation des pokémons. Pourquoi est-ce
//      que les images sont statiques ? » — 18 novembre. Le message est
//      écrit par la relève, qui n'a ni lecteur ni préférence : elle
//      pose donc le PNG figé, et c'est le bon choix pour elle. Ici on
//      a un lecteur. `sprites.ts` range `rencontre` et `fiche` parmi
//      les emplacements qui bougent (`BOUGE`) — on applique sa règle,
//      on ne la réinvente pas.
//
//  2 · LE STYLE DU LECTEUR. Trois jeux existent dans le dépôt, et le
//      carnet respecte déjà le choix. Un sujet qui l'ignorerait ferait
//      deux forums dans le même forum.
//
//  3 · ET LES ADRESSES MORTES. C'est le gain qu'on n'attendait pas :
//      les cartes postées avant le 7 octobre pointent sur
//      `cdn.jsdelivr.net/gh/…@socle-v2`, un alias de branche que
//      jsDelivr a figé sur un commit et ne réévalue jamais. Ces
//      images sont en 404 pour toujours, et un message publié ne se
//      répare pas tout seul (planche 102).
//
//      Mais le NUMÉRO est dans l'adresse. On le lit, on recalcule
//      depuis la racine servie AUJOURD'HUI, et la carte de 2026-10
//      retrouve ses pokémon. Rien n'est réécrit sur le forum : la
//      réparation vit le temps de la page.
//
//  ── CE QU'ON NE TOUCHE PAS ──────────────────────────────────────────
//
//  L'ALTERNATIVE RESTE CELLE DU MESSAGE. Elle porte le nom du Pokémon
//  depuis le 18 novembre, parce que Forumactif remplit les
//  alternatives vides avec le titre du sujet. La réécrire ici la
//  perdrait sur les messages anciens, où elle vaut « Sujet 2 21 » —
//  mais ceux-là, on ne peut rien pour eux, et inventer un nom à la
//  place d'un autre serait pire que de laisser le leur.
//
//  ── SILENCE SUR TOUT REFUS ──────────────────────────────────────────
//
//  Pas de carte de couverture, pas de racine, une espèce absente du
//  jeu choisi : on laisse l'image telle qu'elle est. Elle sera morte
//  si elle l'était — ce n'est pas pire qu'avant, et une image
//  remplacée par du vide, si.
// ════════════════════════════════════════════════════════════════════

import { adresseDuSprite } from "./module-faune.ts";
import type { Sprites, StyleDeSprite } from "../../navigateur/sprites.ts";

/** Les images de sprite d'une carte de combat, où qu'elles soient. */
const SPRITES = "img.wm-combat__sprite";

/** Le numéro d'espèce écrit à la fin d'une adresse de sprite, ou
 *  `null`.
 *
 *  ON N'ACCEPTE QUE NOS DEUX FORMES : `…/<id>.png` et `…/<id>.gif`.
 *  Une adresse qui finirait par un autre nombre — une taille, un
 *  horodatage — ne doit pas être prise pour une espèce. Et la forme
 *  est celle que `adresseDuSpriteFige` écrit, donc elle est connue
 *  exactement.
 *
 *  LE PARAMÈTRE DE REQUÊTE EST TOLÉRÉ (`?v=2`) : Forumactif en ajoute
 *  parfois en recopiant une image. */
export function especeDeLAdresse(src: string): number | null {
  const m = /\/(\d+)\.(?:png|gif)(?:[?#].*)?$/.exec(src);
  if (m === null) return null;
  const n = Number(m[1]);
  return Number.isInteger(n) && n > 0 ? n : null;
}

export type DecorDuCombat = {
  readonly depot: string | null;
  readonly sprites: Sprites | null;
  readonly style: StyleDeSprite;
};

/** Rend les sprites des cartes postées au lecteur. Renvoie combien
 *  d'images ont changé d'adresse — zéro est un résultat normal sur un
 *  sujet sans carte. */
export function rendreLesSprites(doc: Document, decor: DecorDuCombat): number {
  if (decor.depot === null || decor.sprites === null) return 0;
  let faites = 0;
  for (const img of doc.querySelectorAll<HTMLImageElement>(SPRITES)) {
    //  L'ATTRIBUT, PAS LA PROPRIÉTÉ. `img.src` rend l'adresse résolue
    //  par le navigateur ; sur une image en 404 elle est résolue quand
    //  même, mais on veut lire ce que le message a écrit.
    const ecrit = img.getAttribute("src") ?? "";
    const espece = especeDeLAdresse(ecrit);
    if (espece === null) continue;
    //  L'EMPLACEMENT DÉCIDE DE L'ANIMATION, et c'est `sprites.ts` qui
    //  tient la liste. Une carte de rencontre et un tour de combat
    //  sont le même endroit pour cette règle-là.
    const neuve = adresseDuSprite(decor.sprites, decor.depot, espece, decor.style, "rencontre");
    if (neuve === null || neuve === ecrit) continue;
    img.src = neuve;
    //  ON LE DIT DANS LE DOM. Sans marque, impossible de distinguer à
    //  l'inspection une carte rendue d'une carte que le module n'a
    //  jamais vue — et le harnais ne saurait pas non plus.
    img.dataset.wmRendu = String(espece);
    faites += 1;
  }
  return faites;
}

/** Les PV lus dans le texte d'une fiche, ou `null`.
 *
 *  DEUX FORMES, celles que `fiche-de-combat.ts` écrit : « 18/24 PV »
 *  quand le maximum est connu, « 30 PV » quand la bête vient
 *  d'arriver entière. Rien d'autre n'est accepté — un texte qu'on ne
 *  reconnaît pas ne devient pas une jauge approximative. */
export function pvDuTexte(texte: string): { pv: number; max: number } | null {
  const m = /(\d+)\s*(?:\/\s*(\d+))?\s*PV/.exec(texte);
  if (m === null) return null;
  const pv = Number(m[1]);
  const max = m[2] === undefined ? pv : Number(m[2]);
  if (!Number.isInteger(pv) || !Number.isInteger(max) || max <= 0) return null;
  return { pv, max };
}

/**
 * Pose la jauge de PV sur les cartes qui n'en ont pas.
 *
 * ── POURQUOI ICI ET PAS SEULEMENT DANS LE GÉNÉRATEUR ────────────────
 *
 * Le générateur écrit la jauge dans les cartes À VENIR. Les vingt
 * déjà postées dans les sujets, elles, ne se réparent pas toutes
 * seules : un message publié sur Forumactif est figé (planche 102).
 *
 * Mais le chiffre est écrit dedans, en toutes lettres. On le lit, on
 * en fait une proportion, et la carte d'octobre reçoit sa barre comme
 * les autres. Rien n'est réécrit sur le forum : la réparation vit le
 * temps de la page.
 *
 * Renvoie combien de fiches ont reçu leur jauge.
 */
export function poserLesJauges(doc: Document): number {
  let faites = 0;
  for (const p of doc.querySelectorAll<HTMLElement>("p.wm-combat__pv")) {
    //  DÉJÀ SERVIE. Le générateur pose `data-wm-part`, et une seconde
    //  barre sous la première serait le genre de défaut qu'on ne voit
    //  qu'en recomptant.
    if (p.dataset.wmPart !== undefined) continue;
    const lu = pvDuTexte(p.textContent ?? "");
    if (lu === null) continue;

    const part = Math.max(0, Math.min(100, Math.round((lu.pv / lu.max) * 100)));
    const texte = p.textContent ?? "";
    p.textContent = "";

    const chiffre = doc.createElement("span");
    chiffre.className = "wm-combat__pv-chiffre";
    chiffre.textContent = texte.trim();

    const jauge = doc.createElement("span");
    jauge.className = "wm-combat__jauge" +
      (part <= 20 ? " wm-combat__jauge--bas" : part <= 50 ? " wm-combat__jauge--moyen" : "");
    jauge.setAttribute("aria-hidden", "true");
    const plein = doc.createElement("span");
    plein.className = "wm-combat__jauge-plein";
    plein.style.width = `${part}%`;
    jauge.appendChild(plein);

    p.appendChild(chiffre);
    p.appendChild(jauge);
    p.dataset.wmPart = String(part);
    faites += 1;
  }
  return faites;
}
