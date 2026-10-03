// ════════════════════════════════════════════════════════════════════
//  src/navigateur/preferences.ts
//
//  Ce que le joueur a réglé pour lui : son thème, son style de sprite.
//
//  DEUX RÈGLES, ET ELLES VIENNENT DU MÊME CONSTAT : ce qui sort du
//  stockage n'est PAS une valeur de confiance. Le joueur peut l'écrire à
//  la main depuis sa console, une version précédente a pu y laisser autre
//  chose, et un navigateur privé peut tout refuser.
//
//  1. Toute valeur relue est validée. Ce qu'on ne reconnaît pas devient
//     le défaut, en silence — on ne casse pas une page pour ça.
//  2. Le stockage peut lever. En navigation privée, `localStorage` jette
//     sur l'écriture chez certains navigateurs. Une préférence qui ne
//     s'enregistre pas est un désagrément ; une page blanche est un bogue.
//
//  Rien ici ne touche au DOM : le stockage entre par le constructeur.
// ════════════════════════════════════════════════════════════════════

import { CHOIX_PAR_DEFAUT, type ChoixDeTheme, estUnChoixDeTheme } from "./theme.ts";
import { estUnStyleDeSprite, STYLE_PAR_DEFAUT, type StyleDeSprite } from "./sprites.ts";

/** Le port. `localStorage` le remplit, un `Map` le remplit aussi. */
export interface Stockage {
  lire(cle: string): string | null;
  ecrire(cle: string, valeur: string): void;
}

export const CLE_THEME = "wm.theme";
export const CLE_SPRITES = "wm.sprites";

export class Preferences {
  constructor(private readonly stockage: Stockage) {}

  /** Lit, valide, et rend le défaut plutôt que de faire confiance. */
  private lire<T>(cle: string, estValide: (v: unknown) => v is T, defaut: T): T {
    let brut: string | null;
    try {
      brut = this.stockage.lire(cle);
    } catch {
      return defaut;
    }
    return estValide(brut) ? brut : defaut;
  }

  private ecrire(cle: string, valeur: string): void {
    try {
      this.stockage.ecrire(cle, valeur);
    } catch {
      // Navigation privée, stockage plein, réglage du navigateur : la
      // préférence ne tiendra pas d'une page à l'autre, et c'est tout.
      // Il n'y a rien à dire au joueur et rien à casser.
    }
  }

  theme(): ChoixDeTheme {
    return this.lire(CLE_THEME, estUnChoixDeTheme, CHOIX_PAR_DEFAUT);
  }

  poserTheme(choix: ChoixDeTheme): void {
    this.ecrire(CLE_THEME, choix);
  }

  styleDeSprite(): StyleDeSprite {
    return this.lire(CLE_SPRITES, estUnStyleDeSprite, STYLE_PAR_DEFAUT);
  }

  poserStyleDeSprite(style: StyleDeSprite): void {
    this.ecrire(CLE_SPRITES, style);
  }
}
