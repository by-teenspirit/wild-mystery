// ════════════════════════════════════════════════════════════════════
//  src/domaine/fouille.ts
//
//  Ce qu'on trouve en fouillant une zone.
//
//  CE QUE J'AI CHOISI, ET POURQUOI. La question était : une table
//  d'objets par zone, une table unique pondérée par palier, ou des
//  Pokédollars. **Des Pokédollars**, et le motif n'est pas le goût :
//
//  Il n'existe aujourd'hui **aucun catalogue d'objets dans le dépôt** —
//  `data/objets.json` reste à écrire — et aucune annexe ne dit ce qu'on
//  ramasse où. Écrire une table de butin ici, ce serait inventer dix
//  listes d'objets, une courbe de rareté et une couleur locale pour
//  chaque zone : **des règles de jeu décidées depuis le code**, que
//  quelqu'un devrait ensuite relire ou subir.
//
//  Les Pokédollars n'inventent rien :
//    · `pokedollars` est déjà un événement du registre, écrit et testé ;
//    · le montant suit le PALIER de la zone, qui est dans la donnée ;
//    · le jour où l'annexe de butin existe, fouiller rendra des objets EN
//      PLUS, et rien de ce qui a été versé ne devient faux.
//
//  BREDOUILLE EXISTE, et c'est voulu. Une fouille qui donne toujours
//  quelque chose est un distributeur, pas une fouille. Un échec de temps
//  en temps rend les autres fois intéressantes.
//
//  TOUT VIENT DE LA GRAINE, c'est-à-dire du numéro du message. Fixé à la
//  seconde où le joueur poste, impossible à rejouer, refaisable à
//  l'identique des années plus tard pour trancher une contestation.
// ════════════════════════════════════════════════════════════════════

import { entreBornes, suiteAleatoire } from "./alea.ts";

export type Palier = 1 | 2 | 3;

/** Ce qu'une fouille rapporte. Zéro veut dire bredouille, et c'est un
 *  résultat comme un autre — pas une erreur. */
export type Trouvaille = {
  readonly pokedollars: number;
};

/** Une fouille sur cinq ne donne rien. */
const PART_BREDOUILLE = 0.2;

/** Les bornes par palier. Elles montent franchement : un joueur de
 *  palier 3 fouille des endroits où personne d'autre ne peut aller, ça
 *  doit se voir. */
const BORNES: Readonly<Record<Palier, readonly [number, number]>> = {
  1: [20, 60],
  2: [50, 120],
  3: [100, 240],
};

export class PalierInvalide extends Error {
  constructor(palier: number) {
    super(`Palier attendu entre 1 et 3, reçu ${palier}.`);
    this.name = "PalierInvalide";
  }
}

export function estUnPalier(valeur: number): valeur is Palier {
  return valeur === 1 || valeur === 2 || valeur === 3;
}

/**
 * Le résultat d'une fouille.
 *
 * `graine` est le numéro du message : même message, même trouvaille, pour
 * toujours.
 */
export function fouiller(graine: number, palier: number): Trouvaille {
  if (!estUnPalier(palier)) throw new PalierInvalide(palier);

  const suite = suiteAleatoire(graine);
  if (suite() < PART_BREDOUILLE) return { pokedollars: 0 };

  const [bas, haut] = BORNES[palier];
  //  Arrondi à la dizaine : « 47 Pokédollars » sonne comme une sortie de
  //  tableur, « 50 » sonne comme une trouvaille.
  const brut = entreBornes(suite(), bas, haut);
  return { pokedollars: Math.round(brut / 10) * 10 };
}
