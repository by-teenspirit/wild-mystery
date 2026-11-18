// ════════════════════════════════════════════════════════════════════
//  src/domaine/soin.ts
//  Ce que rend un objet de soin.
//
//  COUCHE DOMAINE : un slug et des PV entrent, des PV sortent.
//
//  ── LES QUATRE POTIONS DU CATALOGUE ─────────────────────────────────
//
//  `data/objets.json`, famille « soin » : Potion 300 PD, Super Potion
//  700, Hyper Potion 1 200, Potion Max 2 500. Les montants sont ceux
//  des jeux — 20, 60, 120, tout — et pas des nombres inventés ici.
//
//  ── CE QUE ÇA VAUT SUR NOTRE ÉCHELLE DE PV ──────────────────────────
//
//  Nos PV sont plus petits que ceux des jeux : un starter au niveau 5
//  a 18 PV, un Drattak au niveau 70 en a 213. Donc une Potion REMET À
//  NEUF un Pokémon de début, et c'est très bien : elle coûte 300 PD sur
//  une bourse de départ de 1 000, et un débutant qui s'en sort avec une
//  Potion est un débutant qui continue de jouer.
//
//  Plus tard, la même Potion ne rendra plus qu'un dixième d'un Drattak,
//  et c'est là que la Potion Max justifie ses 2 500 PD. Les chiffres des
//  jeux font donc le travail tout seuls — on n'a rien à ajuster.
//
//  ── ON NE SOIGNE PAS UN POKÉMON À TERRE ─────────────────────────────
//
//  Zéro PV n'est pas « très blessé », c'est hors combat. Les jeux
//  demandent un Rappel, que le catalogue porte dans une autre famille.
//  Une Potion sur un Pokémon à terre est donc REFUSÉE, et c'est un
//  refus utile : sans lui, le joueur dépense une Potion pour rien et ne
//  comprend pas pourquoi il a toujours perdu.
// ════════════════════════════════════════════════════════════════════

export class SoinInvalide extends Error {
  constructor(raison: string) {
    super(`Soin invalide : ${raison}`);
    this.name = "SoinInvalide";
  }
}

/** Les PV rendus, ou `null` pour « tout ». */
export const SOINS: Readonly<Record<string, number | null>> = {
  "potion": 20,
  "super-potion": 60,
  "hyper-potion": 120,
  //  `null` et pas un grand nombre : « tout » est une règle, pas une
  //  valeur. Un 9999 se mettrait à mentir le jour où un Pokémon a
  //  10 000 PV, et surtout il ne se lit pas.
  "max-potion": null,
};

export type Guerison = {
  readonly pv: number;
  /** Ce qui a vraiment été rendu. Une Potion de 20 sur un Pokémon à
   *  14/18 rend 4, et le message du Maître du Jeu doit dire 4 — pas 20,
   *  sinon le joueur croit qu'on lui en a volé seize. */
  readonly rendus: number;
};

export function estUnSoin(slug: string): boolean {
  return Object.hasOwn(SOINS, slug);
}

/** Applique un objet de soin. */
export function soigner(slug: string, pv: number, pvMax: number): Guerison {
  if (!Number.isInteger(pvMax) || pvMax <= 0) {
    throw new SoinInvalide(`pvMax ${pvMax}`);
  }
  if (!Number.isInteger(pv) || pv < 0 || pv > pvMax) {
    throw new SoinInvalide(`pv ${pv} sur ${pvMax}`);
  }
  if (!estUnSoin(slug)) {
    //  UN OBJET INCONNU LÈVE, il ne rend pas zéro. Rendre zéro ferait
    //  qu'une Hyper Potion mal nommée se consommerait sans rien
    //  soigner, et le joueur perdrait 1 200 PD sans savoir pourquoi.
    throw new SoinInvalide(`objet de soin inconnu : ${slug}`);
  }
  if (pv === 0) {
    throw new SoinInvalide("un Pokémon à terre demande un Rappel, pas une Potion");
  }

  const montant = SOINS[slug];
  const apres = montant === null ? pvMax : Math.min(pvMax, pv + montant);
  return { pv: apres, rendus: apres - pv };
}
