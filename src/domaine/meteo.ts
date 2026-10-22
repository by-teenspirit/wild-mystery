// ════════════════════════════════════════════════════════════════════
//  src/domaine/meteo.ts
//
//  Le temps qu'il fait sur Rhode, et l'heure qu'il est pour le joueur.
//  Deux choses qui décident quelle table de rencontres s'applique.
//
//  ── CE QUE LES DONNÉES IMPOSENT, ET CE QU'ELLES N'ONT PLUS ──────────
//
//  AUJOURD'HUI, AUCUNE ZONE N'A DE TABLE DE MÉTÉO. Les dix-sept tables
//  écrites le 15 octobre depuis le Pokédex de Rhode portent « jour » et
//  « nuit », et rien d'autre : la météo vivait par LIEU, et les lieux
//  ont disparu (« enlève tous les petits lieux »). On ne lui a pas
//  inventé de table de zone — une condition qui tirerait dans la même
//  liste que « jour » serait une condition qui ne change rien.
//
//  CE QUE LES ANCIENNES DONNÉES DISAIENT, pour le jour où la question
//  reviendra (les tables sont dans `data/faune-v1/`) : la météo
//  n'existait que sur UN SEUL LIEU par zone, et trois zones n'en avaient
//  aucune — Forêt Marécageuse une table de « pluie » sur quinze lieux,
//  Monts Enneigés un « blizzard » sur treize, Volcan Nuageux une « pluie
//  de cendres » sur quatorze, Fleuve Paisible rien du tout. La météo
//  était donc **de l'ambiance presque partout, et une raison d'aller
//  quelque part un jour précis** — une bonne mécanique, et elle sortait
//  de la donnée, pas d'une idée.
//
//  LE CODE RESTE EN PLACE, ET IL LE FAUT : il retombe sur jour ou nuit
//  quand aucune météo n'est servie, ce qui est le cas de toutes les
//  zones. Le jour où une table de météo de zone sera écrite, elle
//  s'appliquera sans qu'on y touche.
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
 * La condition à employer dans une zone.
 *
 * **La météo prime quand la zone la connaît, sinon c'est jour ou nuit.**
 * Aucune ne la connaît aujourd'hui : voir l'en-tête.
 *
 * `conditionsDeLaZone` vient du fichier de faune, pas d'une supposition.
 */
export function conditionDeLaZone(
  temps: TempsDeRhode,
  nuit: boolean,
  conditionsDeLaZone: readonly string[],
): string {
  if (temps === "agité") {
    //  La météo de la zone est celle que sa donnée porte : tout ce qui
    //  n'est ni jour ni nuit. S'il y en a plusieurs — les Steppes Arides
    //  en ont deux — la nuit départage, faute de mieux et de façon stable.
    const meteos = conditionsDeLaZone.filter((c) => c !== "jour" && c !== "nuit");
    if (meteos.length > 0) return meteos[nuit ? meteos.length - 1 : 0];
  }
  const voulue = nuit ? "nuit" : "jour";
  //  Une zone sans table de nuit se joue de jour. Mieux vaut une
  //  rencontre de jour à minuit qu'une page vide.
  return conditionsDeLaZone.includes(voulue) ? voulue : (conditionsDeLaZone[0] ?? voulue);
}
