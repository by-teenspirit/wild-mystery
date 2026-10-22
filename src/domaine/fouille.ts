// ════════════════════════════════════════════════════════════════════
//  src/domaine/fouille.ts
//
//  Ce qu'on trouve en fouillant une zone.
//
//  ── UN SEUL TIRAGE, CINQ ISSUES, DEPUIS LE 15 OCTOBRE ───────────────
//
//  Jusque-là, fouiller rendait des Pokédollars et rien d'autre, et
//  l'en-tête de ce fichier expliquait pourquoi : « il n'existe
//  aujourd'hui AUCUN catalogue d'objets dans le dépôt, et aucune annexe
//  ne dit ce qu'on ramasse où. Écrire une table de butin ici, ce serait
//  inventer dix listes d'objets, une courbe de rareté et une couleur
//  locale pour chaque zone — des règles de jeu décidées depuis le code. »
//
//  Les deux raisons ont sauté le même jour : `data/objets.json` existe,
//  avec ses trente-quatre objets et leurs prix relus par Callista, et
//  c'est Callista qui a demandé la table. Elle est donc dans la DONNÉE
//  (`data/butin.json`, écrit par `outils/butin.py` qui dit ses règles),
//  et ce fichier-ci ne fait que tirer dedans.
//
//  LES CINQ ISSUES S'EXCLUENT, et ce n'est pas qu'une forme : avant, le
//  fossile se tirait à part, donc une fouille pouvait donner de l'argent
//  ET un fossile. Une table dont les parts font 100 se lit d'un coup —
//  c'est la forme des tables de rencontre de la V1, celle que Callista
//  écrit à la main depuis le début.
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

/** Les parts d'une fouille, en POUR CENT. Elles viennent de
 *  `data/butin.json` — donc de la donnée, pas d'ici.
 *
 *  Les Pokédollars n'y sont pas : ils sont le reste. Écrire les cinq
 *  nombres permettrait qu'ils ne fassent pas 100. */
export type TauxDeFouille = {
  readonly bredouille: number;
  readonly fossileEntier: number;
  readonly morceauDeFossile: number;
  readonly objet: number;
};

/** Une ligne de la table d'objets d'une zone. Le pourcentage est ABSOLU
 *  — la chance par fouille, pas une part de la tranche « objet » — et
 *  c'est ce qui permet de vérifier que la table et les taux sont
 *  d'accord. */
export type LigneDeButin = {
  readonly objetId: number;
  readonly pourcentage: number;
};

/** Ce qu'une fouille rend. Un seul des cinq, jamais deux.
 *
 *  Le fossile ne dit QUE son genre : lequel des onze, c'est
 *  `fossile.ts` qui le tire, avec sa propre graine. Ici on décide ce
 *  qu'on trouve, pas de quelle espèce. */
export type Trouvaille =
  | { readonly genre: "bredouille" }
  | { readonly genre: "pokedollars"; readonly montant: number }
  | { readonly genre: "objet"; readonly objetId: number }
  | { readonly genre: "fossile"; readonly entier: boolean };

/** Les bornes par palier. Elles montent franchement : un joueur de
 *  palier 3 fouille des endroits où personne d'autre ne peut aller, ça
 *  doit se voir. */
const BORNES: Readonly<Record<Palier, readonly [number, number]>> = {
  1: [20, 60],
  2: [50, 120],
  3: [100, 240],
};

/** La tolérance sur la somme des pourcentages, la même que
 *  `verifieTable` pour les rencontres : les parts sont arrondies à
 *  quatre décimales dans les fichiers. */
const TOLERANCE = 0.001;

export class PalierInvalide extends Error {
  constructor(palier: number) {
    super(`Palier attendu entre 1 et 3, reçu ${palier}.`);
    this.name = "PalierInvalide";
  }
}

export class TauxInvalides extends Error {
  constructor(raison: string) {
    super(`Taux de fouille inutilisables : ${raison}`);
    this.name = "TauxInvalides";
  }
}

export function estUnPalier(valeur: number): valeur is Palier {
  return valeur === 1 || valeur === 2 || valeur === 3;
}

/**
 * Juge les taux et la table d'objets AVANT de tirer dedans.
 *
 * **Deux fichiers doivent être d'accord** : `butin.json` porte les taux
 * ET les listes, et la somme des lignes d'une zone doit valoir la part
 * « objet ». Si elle ne la vaut pas, une des deux a été modifiée à la
 * main — et la fouille tirerait des objets avec une fréquence que
 * personne n'a écrite. Le garde-fou n° 23 vérifie la même chose hors
 * ligne ; on ne compte pas sur lui pour s'en apercevoir en production.
 */
export function verifieLesTaux(taux: TauxDeFouille, butin: readonly LigneDeButin[]): void {
  const parts = [taux.bredouille, taux.fossileEntier, taux.morceauDeFossile, taux.objet];
  if (parts.some((p) => !Number.isFinite(p) || p < 0)) {
    throw new TauxInvalides(`une part est négative ou absente (${parts.join(", ")})`);
  }
  const total = parts.reduce((s, p) => s + p, 0);
  if (total > 100 + TOLERANCE) {
    throw new TauxInvalides(`elles font ${total}, il ne reste rien aux Pokédollars`);
  }
  if (butin.some((l) => !Number.isFinite(l.pourcentage) || l.pourcentage <= 0)) {
    throw new TauxInvalides("une ligne d'objet a un pourcentage nul ou négatif");
  }
  const somme = butin.reduce((s, l) => s + l.pourcentage, 0);
  //  Une table vide et une part « objet » à zéro sont d'accord : c'est
  //  une zone sans butin, et c'est un cas valide.
  if (Math.abs(somme - taux.objet) > TOLERANCE) {
    throw new TauxInvalides(
      `les objets font ${somme} %, la part « objet » dit ${taux.objet} %`,
    );
  }
}

/**
 * Le résultat d'une fouille.
 *
 * `graine` est le numéro du message : même message, même trouvaille, pour
 * toujours.
 *
 * L'ORDRE DES BRANCHES EST CELUI DE LA RARETÉ CROISSANTE — bredouille,
 * puis le fossile entier, puis le morceau, puis l'objet, puis le reste.
 * Il n'a aucun effet sur les probabilités, qui sont des tranches d'un
 * même nombre, mais il se relit à côté de la table de `butin.json`, qui
 * est écrite dans cet ordre.
 */
export function fouiller(
  graine: number,
  palier: number,
  taux: TauxDeFouille,
  butin: readonly LigneDeButin[],
): Trouvaille {
  if (!estUnPalier(palier)) throw new PalierInvalide(palier);
  verifieLesTaux(taux, butin);

  const suite = suiteAleatoire(graine);
  const sort = suite() * 100;

  let seuil = taux.bredouille;
  if (sort < seuil) return { genre: "bredouille" };

  seuil += taux.fossileEntier;
  if (sort < seuil) return { genre: "fossile", entier: true };

  seuil += taux.morceauDeFossile;
  if (sort < seuil) return { genre: "fossile", entier: false };

  seuil += taux.objet;
  if (sort < seuil) {
    //  QUEL objet : un SECOND tirage. Réutiliser `sort`, déjà borné par
    //  la tranche, donnerait toujours le même objet au même rang dans la
    //  tranche — donc une table d'objets dont une seule ligne sortirait
    //  jamais. Le tirage est pondéré par les pourcentages de la zone.
    //
    //  ON NORMALISE SUR LA SOMME DES LIGNES, pas sur `taux.objet`, et
    //  ce n'est pas un détail : avec `u * taux.objet`, un arrondi des
    //  pourcentages pouvait laisser un cheveu au-delà du dernier cumul,
    //  donc une boucle qui se termine sans rien rendre — et il fallait
    //  un repli qu'aucun test ne pouvait atteindre. En retranchant d'une
    //  somme tirée des lignes elles-mêmes, le reste finit
    //  OBLIGATOIREMENT négatif, donc la dernière ligne répond toujours.
    //  Pas de branche morte, et pas de cas « impossible » à croire sur
    //  parole.
    let reste = suite() * butin.reduce((s, l) => s + l.pourcentage, 0);
    //  LA DERNIÈRE LIGNE EST LE DÉFAUT, et la boucle s'arrête avant
    //  elle. Écrite en `for … if (reste < 0) return`, la fonction
    //  compilait avec un chemin de sortie que le tirage ne peut pas
    //  prendre — et la couverture le signalait, à raison : un chemin
    //  qu'aucun test ne traverse est un chemin dont personne ne sait ce
    //  qu'il fait. Ici il n'y a qu'une sortie, et elle est toujours
    //  atteinte.
    let i = 0;
    while (i < butin.length - 1 && reste >= butin[i].pourcentage) {
      reste -= butin[i].pourcentage;
      i++;
    }
    return { genre: "objet", objetId: butin[i].objetId };
  }

  const [bas, haut] = BORNES[palier];
  //  Arrondi à la dizaine : « 47 Pokédollars » sonne comme une sortie de
  //  tableur, « 50 » sonne comme une trouvaille.
  const brut = entreBornes(suite(), bas, haut);
  return { genre: "pokedollars", montant: Math.round(brut / 10) * 10 };
}
