/// <reference lib="dom" />
/// <reference lib="dom.iterable" />
// ════════════════════════════════════════════════════════════════════
//  src/adaptateurs/navigateur/coin-outils.ts
//
//  Le bloc fixé en bas à droite : la bascule de thème, et les deux
//  flèches de défilement. Dessiné dans Figma (page Composants,
//  « Bouton de thème » et « Flèches de défilement »).
//
//  QUE DU DOM. Aucune décision ne se prend ici — quel thème s'applique,
//  ce que le bouton annonce, ce qu'on enregistre : tout vient de
//  `src/navigateur/`, où c'est testé sans navigateur.
//
//  LES ICÔNES SONT DES TRACÉS, pas des ligatures Material. Le forum
//  charge bien Material Symbols, mais un bouton qui dépend d'une police
//  distante affiche un carré vide le jour où elle ne charge pas — et ce
//  jour-là, personne ne sait plus comment revenir en thème clair.
// ════════════════════════════════════════════════════════════════════

import {
  choixApresClic,
  CLASSE_SOMBRE,
  destination,
  type Theme,
  themeApplique,
} from "../../navigateur/theme.ts";
import type { Preferences } from "../../navigateur/preferences.ts";

const SVG = "http://www.w3.org/2000/svg";

function svg(enfants: (doc: Document) => SVGElement[], doc: Document): SVGSVGElement {
  const racine = doc.createElementNS(SVG, "svg");
  racine.setAttribute("viewBox", "0 0 16 16");
  racine.setAttribute("aria-hidden", "true");
  racine.setAttribute("focusable", "false");
  for (const e of enfants(doc)) racine.appendChild(e);
  return racine;
}

function lune(doc: Document): SVGSVGElement {
  return svg((d) => {
    const p = d.createElementNS(SVG, "path");
    //  Un disque dont on a mordu un second disque, écrit en une courbe.
    p.setAttribute("d", "M13 9.3A5.6 5.6 0 0 1 6.2 2.6a5.8 5.8 0 1 0 6.8 6.7z");
    p.setAttribute("fill", "currentColor");
    return [p];
  }, doc);
}

function soleil(doc: Document): SVGSVGElement {
  return svg((d) => {
    const coeur = d.createElementNS(SVG, "circle");
    coeur.setAttribute("cx", "8");
    coeur.setAttribute("cy", "8");
    coeur.setAttribute("r", "3.1");
    coeur.setAttribute("fill", "currentColor");

    //  Huit rayons, posés par un pointillé sur un cercle : un seul nœud
    //  au lieu de huit traits à placer à la main.
    const rayons = d.createElementNS(SVG, "circle");
    rayons.setAttribute("cx", "8");
    rayons.setAttribute("cy", "8");
    rayons.setAttribute("r", "6.2");
    rayons.setAttribute("fill", "none");
    rayons.setAttribute("stroke", "currentColor");
    rayons.setAttribute("stroke-width", "1.7");
    rayons.setAttribute("stroke-linecap", "round");
    rayons.setAttribute("stroke-dasharray", "1.2 3.67");
    return [coeur, rayons];
  }, doc);
}

function chevron(versLeHaut: boolean, doc: Document): SVGSVGElement {
  return svg((d) => {
    const p = d.createElementNS(SVG, "path");
    p.setAttribute("d", versLeHaut ? "M3 10l5-5 5 5" : "M3 6l5 5 5-5");
    p.setAttribute("fill", "none");
    p.setAttribute("stroke", "currentColor");
    p.setAttribute("stroke-width", "1.8");
    p.setAttribute("stroke-linecap", "round");
    p.setAttribute("stroke-linejoin", "round");
    return [p];
  }, doc);
}

function bouton(doc: Document, classe: string, libelle: string): HTMLButtonElement {
  const b = doc.createElement("button");
  b.type = "button";
  b.className = classe;
  //  Le libellé est visible ET annoncé : pas d'icône muette.
  const texte = doc.createElement("span");
  texte.className = "wm-coin__texte";
  texte.textContent = libelle;
  b.appendChild(texte);
  return b;
}

export class CoinOutils {
  readonly #doc: Document;
  readonly #prefs: Preferences;
  #boutonTheme?: HTMLButtonElement;

  constructor(doc: Document, prefs: Preferences) {
    this.#doc = doc;
    this.#prefs = prefs;
  }

  /** Vrai si la machine du joueur est réglée en sombre. */
  #systemeEstSombre(): boolean {
    return globalThis.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false;
  }

  #themeCourant(): Theme {
    return themeApplique(this.#prefs.theme(), this.#systemeEstSombre());
  }

  /** Pose ou retire la classe sur `body`. À appeler le plus tôt possible :
   *  tout retard se voit comme un éclair blanc avant le thème sombre. */
  appliquerLeTheme(): Theme {
    const theme = this.#themeCourant();
    this.#doc.body?.classList.toggle(CLASSE_SOMBRE, theme === "sombre");
    return theme;
  }

  #habillerLeBouton(theme: Theme): void {
    const b = this.#boutonTheme;
    if (!b) return;
    const vers = destination(theme);
    const libelle = vers === "sombre" ? "SOMBRE" : "CLAIR";
    b.querySelector(".wm-coin__texte")!.textContent = libelle;
    b.setAttribute(
      "aria-label",
      vers === "sombre" ? "Passer en thème sombre" : "Passer en thème clair",
    );
    const ancienne = b.querySelector("svg");
    const icone = vers === "sombre" ? lune(this.#doc) : soleil(this.#doc);
    if (ancienne) b.replaceChild(icone, ancienne);
    else b.insertBefore(icone, b.firstChild);
  }

  /** Construit le bloc et l'accroche au document. */
  poser(): HTMLElement {
    const coin = this.#doc.createElement("aside");
    coin.className = "wm-coin";
    //  Un bloc d'outils, pas du contenu : il ne doit pas s'intercaler
    //  dans la lecture d'un lecteur d'écran qui parcourt la page.
    coin.setAttribute("aria-label", "Réglages d'affichage et navigation");

    this.#boutonTheme = bouton(this.#doc, "wm-coin__bouton wm-coin__theme", "");
    this.#boutonTheme.addEventListener("click", () => {
      const choix = choixApresClic(this.#prefs.theme(), this.#systemeEstSombre());
      this.#prefs.poserTheme(choix);
      this.#habillerLeBouton(this.appliquerLeTheme());
    });
    this.#habillerLeBouton(this.#themeCourant());
    coin.appendChild(this.#boutonTheme);

    const fleches = this.#doc.createElement("div");
    fleches.className = "wm-coin__fleches";
    for (const [versLeHaut, libelle] of [[true, "HAUT"], [false, "BAS"]] as const) {
      const b = bouton(this.#doc, "wm-coin__bouton", libelle);
      b.insertBefore(chevron(versLeHaut, this.#doc), b.firstChild);
      b.setAttribute("aria-label", versLeHaut ? "Remonter en haut" : "Descendre en bas");
      b.addEventListener("click", () => {
        //  `scrollTo` et pas une ancre : une ancre écrit dans l'adresse
        //  et pollue l'historique à chaque clic.
        globalThis.scrollTo({
          top: versLeHaut ? 0 : this.#doc.documentElement.scrollHeight,
          behavior: this.#mouvementRefuse() ? "auto" : "smooth",
        });
      });
      fleches.appendChild(b);
    }
    coin.appendChild(fleches);

    this.#doc.body.appendChild(coin);
    return coin;
  }

  #mouvementRefuse(): boolean {
    return globalThis.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
  }
}
