/// <reference lib="dom" />
/// <reference lib="dom.iterable" />
// ════════════════════════════════════════════════════════════════════
//  src/adaptateurs/navigateur/module-zone.ts
//
//  COUVERT PAR : outils/zone.mjs — la vraie page d'une zone montée dans
//  un navigateur, avec les cinq lignes de sujet de la maquette.
//  (Garde-fou n° 22 : un module d'interface sans test unitaire doit dire
//   quel harnais le monte, et ce harnais doit tourner dans le CI.)
//
//  Le bandeau d'une zone, et ce qui manque à sa liste de sujets.
//  Maquettes `301:13` (l'écran) et `301:26` (le bandeau).
//
//  ── LA MAQUETTE DESSINAIT UN LIEU, ON CODE UNE ZONE ─────────────────
//
//  `301:13` s'appelle « La page d'un lieu » et montre Le Col de Braise.
//  Les lieux ne sont pas des forums — planche 44, mesuré le 1er octobre
//  et revérifié le 6 — et ils ont quitté la donnée le 15. Callista a
//  tranché le 22 : **c'est la page d'une zone**, et le Col de Braise
//  n'était qu'un nom d'exemple. La planche 77 tient le relevé complet.
//
//  Ce qui change par rapport au dessin, et rien d'autre : le surtitre
//  dit le palier au lieu de la zone — le nom de la zone est déjà le
//  titre juste en dessous — et il n'y a pas de section « LES ARCHIVES »,
//  parce qu'aucune zone n'a de sous-forum.
//
//  ── TROIS CHOSES, ET AUCUNE N'EST NÉCESSAIRE À LA LECTURE ───────────
//
//  1. **le bandeau**, posé en haut, à la place de la bannière du site ;
//  2. **l'état d'un sujet**, lu dans l'adresse de son icône de dossier,
//     parce qu'aucun sélecteur n'atteint un style en ligne ;
//  3. **les étiquettes de tête**, sorties du titre et faites pastilles.
//
//  Sans ce fichier, la page reste la liste de sujets de ModernBB : la
//  bannière du site en haut, les icônes de dossier à leur place, et
//  « [LIBRE] La descente par le versant nord » écrit en toutes lettres.
//  On perd l'allure, pas la page.
// ════════════════════════════════════════════════════════════════════

import { etatDuSujet, titreEtPastilles } from "../../navigateur/sujets.ts";
import { legendeDeZone, type ZoneDuNavigateur } from "../../navigateur/zone.ts";

/** Posée sur le corps de page — `#modernbb` — quand le bandeau est là.
 *
 *  Sur le corps et pas sur `<html>` : le garde-fou n° 16 demande que
 *  chaque règle de nos feuilles commence par `#modernbb`, et une classe
 *  sur la racine obligerait à écrire `.wm-zone-posee #modernbb …`, que
 *  n'importe quel sélecteur plus précis de ModernBB battrait. C'est elle qui retire la
 *  bannière du site et le titre en double — deux gestes de CSS qui ne
 *  doivent PAS se produire quand le bandeau, lui, n'a pas pu se poser.
 *  Une page sans bannière et sans titre serait pire que la page nue. */
export const CLASSE_PAGE = "wm-zone-posee";

function element(doc: Document, balise: string, classe: string, texte?: string): HTMLElement {
  const e = doc.createElement(balise);
  e.className = classe;
  if (texte !== undefined) e.textContent = texte;
  return e;
}

/** Où le bandeau s'accroche, dans l'ordre de préférence.
 *
 *  On vise d'abord la place de la bannière du site : c'est exactement
 *  là que la maquette le met, et c'est le seul endroit de la page qui
 *  soit déjà pleine largeur. Les replis servent si ModernBB change ses
 *  identifiants — on se rabat alors au-dessus du fil d'Ariane, ce qui
 *  est moins beau mais pas cassé.
 *
 *  Rend `null` plutôt que de poser le bandeau n'importe où : un
 *  bandeau de 300 px au milieu d'une liste de sujets serait plus
 *  déroutant que pas de bandeau du tout. */
function accrocher(doc: Document, bandeau: HTMLElement): boolean {
  const apres = doc.querySelector("#headerbar-top") ?? doc.querySelector(".headerbar");
  if (apres !== null && apres.parentNode !== null) {
    apres.parentNode.insertBefore(bandeau, apres.nextSibling);
    return true;
  }
  const avant = doc.querySelector(".sub-header");
  if (avant !== null && avant.parentNode !== null) {
    avant.parentNode.insertBefore(bandeau, avant);
    return true;
  }
  return false;
}

export type DependancesDuBandeau = {
  readonly doc: Document;
  readonly zone: ZoneDuNavigateur;
};

/**
 * Pose le bandeau de la zone. Rend `true` s'il est là.
 *
 * Idempotent : appelé deux fois, il ne pose rien la seconde. Rien n'y
 * oblige aujourd'hui, mais un module qui se double est un module qu'on
 * n'ose plus rappeler.
 */
export function poserLeBandeauDeZone({ doc, zone }: DependancesDuBandeau): boolean {
  if (doc.querySelector(".wm-zone") !== null) return true;

  const bandeau = element(doc, "header", "wm-zone");
  bandeau.dataset.wmZone = String(zone.forumId);

  //  LA PHOTO EST UNE `<img>` ET PAS UN FOND, pour deux raisons : le
  //  navigateur la charge en priorité basse si elle est hors écran, et
  //  surtout une image de fond ne se redimensionne pas toute seule sur
  //  un conteneur qui n'a pas de hauteur quand elle manque. `alt` vide
  //  et `aria-hidden` : c'est une décoration, le titre est juste à
  //  côté en texte.
  if (zone.image !== undefined) {
    const photo = doc.createElement("img");
    photo.className = "wm-zone__photo";
    photo.src = zone.image;
    photo.alt = "";
    photo.setAttribute("aria-hidden", "true");
    //  Elle est tout en haut de la page : la charger paresseusement
    //  retarderait la seule image que le joueur voit tout de suite.
    photo.setAttribute("fetchpriority", "high");
    bandeau.appendChild(photo);
  }

  bandeau.appendChild(element(doc, "div", "wm-zone__voile"));
  bandeau.appendChild(element(doc, "div", "wm-zone__fondu"));

  const legende = element(doc, "div", "wm-zone__legende");
  legende.appendChild(element(doc, "p", "wm-zone__surtitre", legendeDeZone(zone)));
  legende.appendChild(element(doc, "h1", "wm-zone__titre", zone.nom));
  if (zone.description !== undefined) {
    legende.appendChild(element(doc, "p", "wm-zone__phrase", zone.description));
  }
  bandeau.appendChild(legende);

  if (!accrocher(doc, bandeau)) return false;
  const corps = doc.querySelector("#modernbb") ?? doc.body ?? doc.documentElement;
  corps.classList.add(CLASSE_PAGE);
  return true;
}

/** Le titre d'un sujet, tel que le gabarit le pose. */
function titreDe(ligne: Element): HTMLAnchorElement | null {
  return ligne.querySelector<HTMLAnchorElement>("a.topictitle");
}

/**
 * Relit les lignes de sujet : l'état en rond, les étiquettes en
 * pastilles. Rend le nombre de lignes traitées.
 *
 * Ne touche à rien d'autre : le lien, son adresse, l'auteur, les
 * compteurs et le dernier message restent ceux de Forumactif.
 */
export function poserLesSujets(doc: Document): number {
  let faites = 0;
  for (const ligne of doc.querySelectorAll<HTMLElement>("ul.topics li.row")) {
    //  Déjà passée : on ne redécoupe pas un titre déjà découpé, ce qui
    //  mangerait une étiquette de plus à chaque appel.
    if (ligne.dataset.wmSujet === "1") continue;

    const icone = ligne.querySelector<HTMLElement>("dl.icon");
    const lien = titreDe(ligne);
    if (icone === null || lien === null) continue;

    //  L'état se lit dans le style EN LIGNE du `<dl>`, que ModernBB
    //  écrit lui-même ; `style.backgroundImage` le rend tel quel,
    //  `url("…")` compris, et `etatDuSujet` n'a besoin que du nom de
    //  fichier.
    //
    //  LE REPLI N'EST PAS DÉCORATIF : `poserLesPastilles`
    //  (`module-categories.ts`) passe sur les MÊMES `li.row dl.icon`,
    //  sort l'image du style en ligne et efface le fond. Si elle est
    //  passée avant nous, il ne reste que son `<img>`. La racine de
    //  composition nous met devant elle — et ce repli fait que
    //  l'inverse ne casse rien non plus.
    const deSonImage = icone.querySelector<HTMLImageElement>("img[src]")?.getAttribute("src");
    const enLigne = icone.style.backgroundImage;
    ligne.dataset.wmEtat = etatDuSujet(enLigne !== "" ? enLigne : deSonImage);

    const { pastilles, titre } = titreEtPastilles(lien.textContent ?? "");
    if (pastilles.length > 0) {
      lien.textContent = titre;
      //  Les pastilles vont AVANT le `<h2>`, dans le conteneur que le
      //  gabarit prévoit, et pas dans le lien : une étiquette n'est pas
      //  cliquable, et la mettre dans le lien allongerait la cible sans
      //  rien lui ajouter.
      const hote = lien.closest(".topic-title-container") ?? lien.parentElement;
      const titreH2 = lien.closest("h2") ?? lien;
      for (const p of pastilles) {
        //  LE COMPOSANT DE LA CHARTE, § 4 de `13-composants.css`. Son
        //  état nu est celui de « libre » : pas de modificateur pour
        //  lui, ni pour une étiquette qu'on ne connaît pas.
        const ton = p.ton === "libre" || p.ton === "neutre" ? "" : ` wm-sujet--${p.ton}`;
        const span = element(doc, "span", `wm-sujet${ton}`, p.libelle);
        hote?.insertBefore(span, titreH2);
      }
    }

    ligne.dataset.wmSujet = "1";
    faites++;
  }
  return faites;
}
