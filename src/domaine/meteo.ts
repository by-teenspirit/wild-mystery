// ════════════════════════════════════════════════════════════════════
//  src/domaine/meteo.ts
//
//  Le temps qu'il fait sur Rhode, et l'heure qu'il est pour le joueur.
//  Deux choses qui décident quelle table de rencontres s'applique.
//
//  CE QUE LES DONNÉES IMPOSENT. Les tables de faune ont été relues le
//  2 octobre, et elles disent une chose qu'il faut regarder en face :
//  **la météo n'existe que sur UN SEUL LIEU par zone**, et trois zones
//  n'en ont aucune.
//
//    Forêt Marécageuse   15 lieux, dont 1 avec « pluie »
//    Monts Enneigés      13 lieux, dont 1 avec « blizzard »
//    Volcan Nuageux      14 lieux, dont 1 avec « pluie de cendres »
//    Fleuve Paisible     14 lieux, aucune météo — et il porte bien son nom
//
//  Donc une météo ne peut pas être un état de zone qui remplace jour et
//  nuit partout : il n'y a pas de table pour ça. Elle est **de l'ambiance
//  presque partout, et une raison d'aller quelque part un jour précis**.
//  C'est une bonne mécanique, et elle sort de la donnée, pas d'une idée.
//
//  LE MODÈLE RETENU. Un seul tirage par jour pour tout Rhode : le temps
//  est **calme** ou **agité**. Un jour agité, chaque zone montre la météo
//  que SA donnée connaît — pluie dans le marais, blizzard dans les monts,
//  cendres sur le volcan — et les zones qui n'en ont pas restent au calme.
//  Un état global, une expression locale : ça s'affiche partout en une
//  phrase, et ça colle exactement aux tables.
//
//  POURQUOI AUCUNE TABLE EN BASE. La météo est une fonction pure du jour.
//  Tout le monde calcule la même, le navigateur comme le serveur, sans
//  aller-retour et sans tâche quotidienne qui peut rater. « Générée une
//  fois par jour » est ce que le joueur voit ; une fonction du jour est ce
//  que ça demande d'écrire.
// ════════════════════════════════════════════════════════════════════

import { graineDepuis, suiteAleatoire } from "./alea.ts";

export type TempsDeRhode = "calme" | "agité";

/** La part de jours agités. Un jour sur quatre : assez pour qu'on le
 *  remarque, assez rare pour que ça reste un évènement. */
const PART_AGITEE = 0.25;

export class JourInvalide extends Error {
  constructor(jour: string) {
    super(`Jour attendu au format AAAA-MM-JJ, reçu « ${jour} ».`);
    this.name = "JourInvalide";
  }
}

const FORME_DU_JOUR = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Le temps qu'il fait sur Rhode un jour donné.
 *
 * `jour` est une date au format `AAAA-MM-JJ`, et c'est **la seule entrée**
 * : même jour, même temps, pour tout le monde et pour toujours. Un joueur
 * qui conteste peut refaire le calcul.
 */
export function tempsDuJour(jour: string): TempsDeRhode {
  if (!FORME_DU_JOUR.test(jour)) throw new JourInvalide(jour);
  const suite = suiteAleatoire(graineDepuis(`meteo:${jour}`));
  return suite() < PART_AGITEE ? "agité" : "calme";
}

/** Vrai entre 20 h et 6 h. Les bornes sont ici, en un seul endroit, parce
 *  qu'elles finiront par se discuter. */
export function estLaNuit(heureLocale: number): boolean {
  if (!Number.isInteger(heureLocale) || heureLocale < 0 || heureLocale > 23) {
    throw new JourInvalide(`heure locale ${heureLocale}`);
  }
  return heureLocale >= 20 || heureLocale < 6;
}

/**
 * La condition à employer pour un lieu donné.
 *
 * **La météo prime quand le lieu la connaît, sinon c'est jour ou nuit.**
 * C'est ce que les données permettent : un lieu sur quinze a une table de
 * pluie, les quatorze autres n'en ont pas, et leur en inventer une serait
 * écrire une règle de jeu depuis le code.
 *
 * `conditionsDuLieu` vient du fichier de faune, pas d'une supposition.
 */
export function conditionDuLieu(
  temps: TempsDeRhode,
  nuit: boolean,
  conditionsDuLieu: readonly string[],
): string {
  if (temps === "agité") {
    //  La météo de la zone est celle que sa donnée porte : tout ce qui
    //  n'est ni jour ni nuit. S'il y en a plusieurs — les Steppes Arides
    //  en ont deux — la nuit départage, faute de mieux et de façon stable.
    const meteos = conditionsDuLieu.filter((c) => c !== "jour" && c !== "nuit");
    if (meteos.length > 0) return meteos[nuit ? meteos.length - 1 : 0];
  }
  const voulue = nuit ? "nuit" : "jour";
  //  Un lieu sans table de nuit se joue de jour. Mieux vaut une rencontre
  //  de jour à minuit qu'une page vide.
  return conditionsDuLieu.includes(voulue) ? voulue : (conditionsDuLieu[0] ?? voulue);
}
