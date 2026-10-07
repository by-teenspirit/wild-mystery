// ════════════════════════════════════════════════════════════════════
//  src/navigateur/sprites.ts
//
//  Quelle image sort, pour quelle espèce, dans quel style, à quel
//  endroit. Pure : la carte de couverture entre par le constructeur,
//  rien n'est deviné, rien n'est demandé au réseau.
//
//  POURQUOI UNE CARTE ET PAS UN `onerror`. Aucun jeu de sprites ne couvre
//  les 444 espèces de Rhode — Ultra-Soleil en a 370, Noir/Blanc animé
//  393, la génération III 201. Un repli côté navigateur coûterait une
//  requête ratée par image manquante et un clignotement, chez chaque
//  visiteur, à chaque page. La carte est calculée à la livraison par
//  `outils/sprites.py` ; ici on ne fait que la lire.
//
//  LA RÈGLE D'ANIMATION, décidée le 2 octobre : animé quand il y en a un,
//  figé dès qu'il y en a plusieurs. Et `prefers-reduced-motion` fige
//  partout, rencontre comprise — ce n'est pas une préférence de confort,
//  c'est une demande qu'on honore.
// ════════════════════════════════════════════════════════════════════

export type StyleDeSprite = "forum" | "retro" | "gba-ds";

export const STYLE_PAR_DEFAUT: StyleDeSprite = "forum";

/** Là où un sprite s'affiche. C'est l'endroit qui décide s'il bouge, pas
 *  l'appelant : sinon la règle se perd en trois opinions différentes. */
export type Emplacement =
  | "rencontre"
  | "fiche"
  | "trainer-card"
  | "boite"
  | "pokedex";

const BOUGE: ReadonlySet<Emplacement> = new Set<Emplacement>(["rencontre", "fiche"]);

export function estUnStyleDeSprite(valeur: unknown): valeur is StyleDeSprite {
  return valeur === "forum" || valeur === "retro" || valeur === "gba-ds";
}

export type EntreeDeCouverture = {
  /** L'image d'origine, animée quand le style l'est. */
  readonly source: string;
  /** Sa jumelle fixe. Identique à `source` quand elle l'est déjà. */
  readonly fige: string;
};

export type CarteDeCouverture = {
  readonly base: string;
  readonly commit: string;
  readonly styles: Readonly<
    Record<string, {
      readonly anime: boolean;
      readonly especes: Readonly<Record<string, EntreeDeCouverture>>;
    }>
  >;
};

export class StyleInconnu extends Error {
  constructor(style: string) {
    super(`Style de sprite absent de la carte de couverture : « ${style} ».`);
    this.name = "StyleInconnu";
  }
}

/**
 * Décide l'adresse d'un sprite.
 *
 * `mouvementRefuse` vient de `prefers-reduced-motion`. Il fige TOUT, y
 * compris la rencontre : une personne qui demande moins d'animation ne
 * demande pas « moins sauf là où c'est joli ».
 */
export class Sprites {
  constructor(
    private readonly carte: CarteDeCouverture,
    private readonly mouvementRefuse = false,
  ) {}

  /** Vrai si l'image doit être animée à cet endroit, dans ce style. */
  anime(style: StyleDeSprite, ou: Emplacement): boolean {
    if (this.mouvementRefuse) return false;
    const voulu = this.carte.styles[style];
    if (!voulu) throw new StyleInconnu(style);
    return voulu.anime && BOUGE.has(ou);
  }

  /** L'adresse complète, ou null si l'espèce n'est pas dans la carte —
   *  auquel cas l'appelant n'affiche rien plutôt qu'une image cassée. */
  adresse(especeId: number, style: StyleDeSprite, ou: Emplacement): string | null {
    const voulu = this.carte.styles[style];
    if (!voulu) throw new StyleInconnu(style);
    const entree = voulu.especes[String(especeId)];
    if (!entree) return null;

    const chemin = this.anime(style, ou) ? entree.source : entree.fige;
    //  Les images figées que nous produisons vivent dans NOTRE dépôt ; les
    //  autres chemins sont relatifs au dépôt des sprites. Le préfixe le dit.
    return chemin.startsWith("assets/") ? chemin : `${this.carte.base}/${chemin}`;
  }

  /** Le numéro d'espèce porté par une adresse déjà écrite — c'est ce qui
   *  permet de réécrire le sprite d'une fiche publiée, dont l'adresse est
   *  figée dans le message au moment où le joueur le poste. */
  especeDe(adresse: string): number | null {
    const m = /\/(\d+)\.(?:png|gif)(?:[?#].*)?$/.exec(adresse);
    if (!m) return null;
    const id = Number(m[1]);
    return Number.isSafeInteger(id) && id > 0 ? id : null;
  }
}
