// ════════════════════════════════════════════════════════════════════
//  src/navigateur/faune.ts
//
//  Ce que l'annexe de la carte calcule pour une zone. Pur : aucun DOM,
//  aucun `fetch`.
//
//  ── UN POURCENTAGE N'EST PAS UNE CHANCE ─────────────────────────────
//
//  « 2,02 % » ne dit rien à personne au milieu d'une liste de soixante
//  lignes. « Environ une rencontre sur cinquante » se compare à vue. La
//  page montre les deux : le pourcentage parce qu'il est exact et qu'on
//  peut le recalculer, la fraction parce qu'elle se lit.
//
//  ── ET ON N'INVENTE PAS DE QUATRIÈME RARETÉ ─────────────────────────
//
//  La maquette `359:915` en dessine quatre — commun, peu commun, rare,
//  très rare. La donnée en porte trois, et c'est Callista qui les a
//  écrites à la main dans les tables. On affiche les trois.
//
//  Les objets du sol, eux, n'ont pas de rareté écrite : leur fréquence
//  se DÉDUIT de leur pourcentage, qui va de 0,13 % à 8,52 % d'une zone à
//  l'autre. Les seuils sont ici, en un seul endroit, parce qu'ils
//  finiront par se discuter.
//
//  ── CE QUE CE FICHIER NE FAIT PAS ───────────────────────────────────
//
//  Il ne tire rien. Le tirage est dans `src/domaine/rencontre.ts` et
//  `fouille.ts`, côté serveur, avec la graine du message. Ici on ne fait
//  que montrer la table dans laquelle le serveur tirera — et il faut que
//  ce soit la MÊME table, donc elle vient du même fichier.
// ════════════════════════════════════════════════════════════════════

import type { Rarete } from "../domaine/rencontre.ts";
import type { TauxDeFouille } from "../domaine/fouille.ts";
import type { EtatDEspece } from "./carnet.ts";

/** Une ligne de la table de rencontre d'une zone, telle que
 *  `data/faune/<forumId>.json` l'écrit. */
export type EspeceDeZone = {
  readonly espece: number;
  readonly nom: string;
  readonly pct: number;
  readonly min: number;
  readonly max: number;
  readonly rarete: Rarete;
};

/** Une ligne de la table de butin d'une zone, telle que
 *  `data/butin.json` l'écrit. */
export type ObjetDeZone = {
  readonly objet: number;
  /** Le slug PokeAPI, recopié de `data/objets.json` par `butin.py` :
   *  c'est lui qui retrouve la vignette. */
  readonly slug?: string;
  readonly nom: string;
  readonly famille: string;
  readonly prix: number;
  readonly pct: number;
};

/** Les dix-huit types, tels que `data/especes-fiches.json` les écrit et
 *  tels que `img/types/<type>.png` les nomme. La liste est ici pour
 *  qu'un type inventé ne devienne pas une image cassée : on n'affiche
 *  que ce qu'on sait dessiner. */
export const TYPES: readonly string[] = [
  "acier",
  "combat",
  "dragon",
  "eau",
  "electrik",
  "fee",
  "feu",
  "glace",
  "insecte",
  "normal",
  "plante",
  "poison",
  "psy",
  "roche",
  "sol",
  "spectre",
  "tenebres",
  "vol",
];

/** Les types d'une espèce, filtrés sur ceux qu'on sait dessiner.
 *
 *  UN POKÉMON EN A UN OU DEUX, jamais trois : on coupe à deux plutôt
 *  que de laisser une donnée inattendue casser la mise en page d'une
 *  grille de soixante-treize cartes. */
export function typesDe(
  fiches: Readonly<Record<string, { readonly types?: readonly string[] } | undefined>>,
  especeId: number,
): string[] {
  const bruts = fiches[String(especeId)]?.types ?? [];
  return bruts.filter((t) => TYPES.includes(t)).slice(0, 2);
}

/** L'ordre d'affichage des raretés : le plus courant d'abord, parce que
 *  c'est ce qu'on croisera le plus et que la liste se lit du haut. */
export const RARETES: readonly Rarete[] = ["commun", "peu commun", "rare"];

// ════════════════════════════════════════════════════════════════════
//  Les nombres, écrits pour être lus
// ════════════════════════════════════════════════════════════════════

/** Un pourcentage, à deux décimales, virgule française.
 *
 *  **On ne l'arrondit pas à l'entier.** Les parts d'une table vont de
 *  0,34 % à 6,12 % : arrondies, un tiers des espèces afficheraient « 0 % »
 *  et une liste qui dit zéro à côté d'une espèce qu'on peut croiser est
 *  un mensonge. */
export function pourCent(pct: number): string {
  if (!Number.isFinite(pct) || pct < 0) return "—";
  return `${pct.toFixed(2).replace(".", ",")} %`;
}

/**
 * « Une fois sur combien », arrondi pour se lire.
 *
 * L'ARRONDI EST GROSSIER EXPRÈS, et il monte avec le nombre : au-delà
 * d'une cinquantaine, la différence entre 47 et 50 n'apprend rien à
 * personne et donne à un ordre de grandeur l'air d'une mesure. En
 * dessous de vingt, chaque unité compte encore.
 *
 * Rend `null` pour un pourcentage nul ou absurde : la page n'écrit alors
 * rien, plutôt qu'« une fois sur l'infini ».
 */
export function uneFoisSur(pct: number): number | null {
  if (!Number.isFinite(pct) || pct <= 0 || pct > 100) return null;
  const brut = 100 / pct;
  if (brut < 20) return Math.round(brut);
  if (brut < 100) return Math.round(brut / 5) * 5;
  if (brut < 1000) return Math.round(brut / 10) * 10;
  return Math.round(brut / 100) * 100;
}

/** La phrase qui va sous le pourcentage. `quoi` est le mot compté —
 *  « rencontre », « fouille » — parce que les deux tables n'ont pas la
 *  même unité et qu'écrire « une fois sur » partout perdrait ça. */
export function motDeLaChance(pct: number, quoi: string): string {
  const n = uneFoisSur(pct);
  return n === null ? "" : `environ 1 ${quoi} sur ${n}`;
}

// ════════════════════════════════════════════════════════════════════
//  Les espèces d'une zone
// ════════════════════════════════════════════════════════════════════

export type TrancheDeRarete = {
  readonly rarete: Rarete;
  readonly especes: readonly EspeceDeZone[];
  /** La somme des parts de la tranche, en pour cent. C'est le chiffre
   *  qui dit vraiment quelque chose : « 5 % de rare » se compare d'une
   *  zone à l'autre, une liste de trente lignes non. */
  readonly part: number;
  /** La part que TOUTES les espèces de la tranche partagent, ou `null`
   *  si elles diffèrent. */
  readonly commune: number | null;
};

/**
 * La part commune à toute une tranche, ou `null`.
 *
 * **ELLE EST PRESQUE TOUJOURS LA MÊME**, et c'est une conséquence de la
 * donnée : `outils/faune-par-zone.py` répartit les espèces d'une zone à
 * poids égal dans chaque rareté. Les trente-six communs de la Forêt
 * Marécageuse sont donc tous à 2,02 %.
 *
 * Écrire « 2,02 % · environ 1 rencontre sur 50 » trente-six fois de
 * suite n'apprend rien à la trente-sixième ligne, et noie le seul
 * chiffre qui distingue les cartes : le niveau. Quand la tranche est
 * uniforme, la page le dit une fois dans son titre.
 *
 * On le MESURE plutôt que de le supposer : le jour où une table sera
 * écrite à la main, avec des parts inégales, chaque carte reprendra la
 * sienne sans qu'on touche à rien.
 */
export function partCommune(especes: readonly EspeceDeZone[]): number | null {
  if (especes.length === 0) return null;
  const premiere = especes[0].pct;
  return especes.every((e) => e.pct === premiere) ? premiere : null;
}

/**
 * Les espèces d'une zone, rangées par rareté.
 *
 * **À l'intérieur d'une tranche, on trie par part décroissante puis par
 * numéro.** Les tables sont écrites à la main et leur ordre d'écriture
 * est celui du Pokédex de Rhode, pas celui de la chance : afficher dans
 * l'ordre du fichier mettrait une espèce à 0,34 % avant une à 6,12 %
 * dans la même tranche, sans rien qui l'explique.
 *
 * Une tranche vide n'est pas rendue : une zone de palier 3 peut n'avoir
 * aucun commun, et un titre « COMMUN » suivi de rien ressemble à une
 * panne.
 */
export function parRarete(table: readonly EspeceDeZone[]): TrancheDeRarete[] {
  const tranches: TrancheDeRarete[] = [];
  for (const rarete of RARETES) {
    const especes = table
      .filter((e) => e.rarete === rarete)
      .sort((a, b) => (b.pct - a.pct) || (a.espece - b.espece));
    if (especes.length === 0) continue;
    tranches.push({
      rarete,
      especes,
      part: especes.reduce((s, e) => s + e.pct, 0),
      commune: partCommune(especes),
    });
  }
  return tranches;
}

/** La fourchette de niveaux d'une zone, telle que sa table la donne.
 *  Rend `null` pour une table vide — une zone sans faune existe, et elle
 *  ne doit pas afficher « niveaux Infinity à -Infinity ». */
export function fourchetteDeNiveaux(
  table: readonly EspeceDeZone[],
): { readonly min: number; readonly max: number } | null {
  if (table.length === 0) return null;
  return {
    min: Math.min(...table.map((e) => e.min)),
    max: Math.max(...table.map((e) => e.max)),
  };
}

// ════════════════════════════════════════════════════════════════════
//  Le jour, la nuit, et le temps qu'il fait
// ════════════════════════════════════════════════════════════════════

/** Deux tables portent-elles exactement la même chose ?
 *
 *  On compare l'espèce, sa part et ses niveaux — pas l'ordre, qui n'a
 *  aucun effet sur le tirage. */
export function memeTable(a: readonly EspeceDeZone[], b: readonly EspeceDeZone[]): boolean {
  if (a.length !== b.length) return false;
  const clef = (e: EspeceDeZone) => `${e.espece}·${e.pct}·${e.min}·${e.max}·${e.rarete}`;
  const gauche = a.map(clef).sort();
  const droite = b.map(clef).sort();
  return gauche.every((c, i) => c === droite[i]);
}

/**
 * Ce que la page dit des conditions d'une zone.
 *
 * **AUJOURD'HUI LA RÉPONSE EST TOUJOURS « JOUR COMME NUIT ».** Les
 * dix-sept zones portent `jour` et `nuit` avec exactement la même liste,
 * et aucune n'a de table de météo : la météo vivait par lieu, et les
 * lieux sont partis le 15 octobre (`src/domaine/meteo.ts`).
 *
 * La fonction ne le suppose pas pour autant — elle le MESURE. Le jour où
 * une table de nuit ou de météo sera écrite, la page le dira sans qu'on
 * y touche, et si elle ne le disait pas on le verrait au harnais.
 */
export function motDesConditions(
  conditions: Readonly<Record<string, readonly EspeceDeZone[]>>,
): {
  readonly phrase: string;
  readonly meteos: readonly string[];
  readonly jourEtNuitPareils: boolean;
} {
  const noms = Object.keys(conditions);
  const meteos = noms.filter((n) => n !== "jour" && n !== "nuit");
  const jour = conditions["jour"];
  const nuit = conditions["nuit"];
  const pareils = jour !== undefined && nuit !== undefined && memeTable(jour, nuit);

  if (meteos.length === 0 && pareils) {
    return {
      phrase: "La même faune le jour et la nuit, par tous les temps.",
      meteos,
      jourEtNuitPareils: true,
    };
  }
  const bouts: string[] = [];
  if (!pareils && jour !== undefined && nuit !== undefined) {
    bouts.push("La nuit ne montre pas la même faune que le jour.");
  }
  if (meteos.length > 0) {
    bouts.push(
      meteos.length === 1
        ? `Et par ${meteos[0]}, la zone change de faune.`
        : `Et elle change encore par ${meteos.slice(0, -1).join(", ")} ou ${
          meteos[meteos.length - 1]
        }.`,
    );
  }
  return { phrase: bouts.join(" "), meteos, jourEtNuitPareils: pareils };
}

// ════════════════════════════════════════════════════════════════════
//  Ce qu'on trouve au sol
// ════════════════════════════════════════════════════════════════════

/** Les cinq issues d'une fouille, dans l'ordre où `fouiller` les teste —
 *  bredouille, fossile entier, morceau, objet, puis le reste. */
export type IssueDeFouille = {
  readonly clef: string;
  readonly mot: string;
  readonly pct: number;
};

/**
 * Les cinq parts d'une fouille.
 *
 * **LES POKÉDOLLARS SONT LE RESTE, ET ON LES CALCULE ICI** plutôt que de
 * les lire dans le fichier. `data/butin.json` en porte bien une copie,
 * mais la lire laisserait exister deux vérités : le jour où une part
 * change, le total ne ferait plus cent et personne ne le verrait. La
 * soustraction, elle, est toujours d'accord avec les quatre autres.
 */
export function partsDuSol(taux: TauxDeFouille): IssueDeFouille[] {
  const reste = 100 - taux.bredouille - taux.fossileEntier - taux.morceauDeFossile - taux.objet;
  return [
    { clef: "objet", mot: "un objet", pct: taux.objet },
    { clef: "pokedollars", mot: "des pokédollars", pct: reste },
    { clef: "morceau", mot: "un morceau de fossile", pct: taux.morceauDeFossile },
    { clef: "entier", mot: "un fossile entier", pct: taux.fossileEntier },
    { clef: "bredouille", mot: "rien du tout", pct: taux.bredouille },
  ];
}

/** Les seuils de fréquence des objets, en pour cent ABSOLUS — la chance
 *  par fouille, pas une part de la tranche « objet ». Ils sont posés sur
 *  la dispersion réelle des 259 lignes de `butin.json` : médiane 0,85 %,
 *  de 0,13 % à 8,52 %. */
export const SEUILS_DE_FREQUENCE: readonly { readonly a: number; readonly mot: string }[] = [
  { a: 3, mot: "fréquent" },
  { a: 1, mot: "peu fréquent" },
  { a: 0.3, mot: "rare" },
  { a: 0, mot: "très rare" },
];

/** Le mot qui va sous un objet du sol. Il se DÉDUIT du pourcentage : la
 *  donnée n'écrit aucune rareté d'objet, et lui en inventer une à la
 *  main ferait un second endroit à tenir d'accord avec le premier. */
export function motDeLaFrequence(pct: number): string {
  for (const s of SEUILS_DE_FREQUENCE) {
    if (pct > s.a) return s.mot;
  }
  return "très rare";
}

/** Les objets d'une zone, du plus fréquent au plus rare, le nom
 *  départageant les ex æquo pour que l'ordre ne bouge pas d'un
 *  chargement à l'autre. */
export function parFrequence(objets: readonly ObjetDeZone[]): ObjetDeZone[] {
  return [...objets].sort((a, b) => (b.pct - a.pct) || a.nom.localeCompare(b.nom, "fr"));
}

// ════════════════════════════════════════════════════════════════════
//  LE TRI D'UNE ZONE — commun, peu commun, rare
//
//  « Tu mets toutes les espèces ensemble dans l'ordre, tu rajoutes un
//  filtre : commun, peu commun, rare, objet » (4 novembre).
//
//  Avant, la zone était découpée en trois tranches de rareté, et les
//  objets vivaient dans une quatrième liste en bas. Trois listes
//  séparées répondent mal à la seule question qu'on se pose devant une
//  zone — « est-ce que X est ici ? » — parce qu'il faut deviner sa
//  rareté pour savoir où regarder. Une liste dans l'ordre du dex, et
//  quatre boutons pour la réduire.
//
//  ── LE QUATRIÈME BOUTON A VÉCU UN JOUR ──────────────────────────────
//
//  « Il faudrait séparer davantage les objets trouvables et les
//  pokémons » (5 novembre). Les objets sont repartis dans leur bloc, et
//  le bouton « Objet » avec eux.
//
//  LA FONCTION N'A PAS CHANGÉ POUR AUTANT, et c'est voulu : elle
//  n'ajoute le bouton que si on lui donne des objets. L'annexe ne lui
//  en donne plus. Garder le chemin plutôt que l'arracher coûte six
//  lignes et laisse la porte ouverte — une page qui voudrait les deux
//  dans une grille (l'index, un jour) n'a rien à réécrire.
// ════════════════════════════════════════════════════════════════════

/** Ce qu'un bouton de tri peut montrer. */
export type ChoixDeFaune = "tous" | Rarete | "objet";

export type FiltreDeFaune = {
  readonly cle: ChoixDeFaune;
  readonly mot: string;
  readonly nombre: number;
};

const MOT_DU_TRI: Record<string, string> = {
  "tous": "Tous",
  "commun": "Commun",
  "peu commun": "Peu commun",
  "rare": "Rare",
  "objet": "Objet",
};

/**
 * Les boutons à poser pour une zone.
 *
 * UN TRI SANS LIGNE N'A PAS DE BOUTON, comme pour les statuts de
 * l'annexe 11 : une zone sans espèce rare ne doit pas proposer un
 * bouton « Rare » qui vide la liste. Et s'il ne reste qu'un seul tri,
 * aucun bouton : « Tous » et lui montreraient la même chose.
 */
export function filtresDeFaune(
  especes: readonly EspeceDeZone[],
  objets: readonly ObjetDeZone[],
): FiltreDeFaune[] {
  const compte = new Map<string, number>();
  for (const e of especes) compte.set(e.rarete, (compte.get(e.rarete) ?? 0) + 1);
  if (objets.length > 0) compte.set("objet", objets.length);

  const tenus = [...RARETES, "objet"].filter((c) => (compte.get(c) ?? 0) > 0);
  if (tenus.length < 2) return [];

  const total = especes.length + objets.length;
  return [
    { cle: "tous", mot: MOT_DU_TRI["tous"], nombre: total },
    ...tenus.map((c) => ({
      cle: c as ChoixDeFaune,
      mot: MOT_DU_TRI[c] ?? c,
      nombre: compte.get(c) ?? 0,
    })),
  ];
}

/** La clé de tri d'une ligne : sa rareté, ou « objet ». */
export function visibleDansLaFaune(tri: string, choix: ChoixDeFaune): boolean {
  return choix === "tous" || choix === tri;
}

/** Ce que l'annonce au lecteur d'écran dit après un clic.
 *
 *  « ESPÈCES » ET PLUS « LIGNES ». La liste mélangeait les espèces et
 *  les objets du sol, et « lignes » était le seul mot qui valait pour
 *  les deux. Les objets ont leur bloc depuis le 5 novembre : ce qui
 *  reste ici n'est que des espèces, et les compter en « lignes »
 *  donnait une annonce plus vague que ce qu'on sait. */
export function motDuCompteDeFaune(nombre: number, choix: ChoixDeFaune): string {
  const quoi = nombre === 1 ? "espèce" : "espèces";
  if (choix === "tous") return `${nombre} ${quoi}`;
  return `${nombre} ${quoi} — ${(MOT_DU_TRI[choix] ?? choix).toLowerCase()}`;
}

// ════════════════════════════════════════════════════════════════════
//  LE NUMÉRO ET LA MARQUE — « on l'a vu ? on l'a eu ? »
//
//  « Affiche le numéro du pokémon + une icône si on l'a déjà vu ou si
//  on l'a dans notre pokedex, c'est possible ça ? » (5 novembre)
//
//  ── LE NUMÉRO EST CELUI DE RHODE, PAS CELUI DU NATIONAL ─────────────
//
//  Les tables de faune portent l'identifiant national — 757 pour
//  Tritox, 10115 pour Ossatueur d'Alola. Ce n'est pas un numéro de
//  dex : c'est une clé, et les formes régionales sont à dix mille.
//
//  Le numéro qu'on affiche est le rang dans le Pokédex de Rhode, de 1
//  à 933, celui que le carnet du joueur montre déjà sur ses propres
//  cases. Deux pages qui comptent la même collection doivent la
//  numéroter pareil, sinon « j'en ai 312 sur 933 » ne veut plus rien
//  dire. Il vient de `data/dex-numeros.json`.
//
//  ── ET LA MARQUE NE PARLE QUE SI ELLE SAIT ──────────────────────────
//
//  Trois réponses possibles, et la troisième est la plus importante :
//  attrapé, croisé, et « on ne sait pas ». Un invité, ou quelqu'un qui
//  n'a pas lié son carnet, tombe dans le troisième cas — et une carte
//  muette est juste, là où une carte marquée « jamais vu » serait un
//  mensonge sur une collection qu'on n'a pas lue.
// ════════════════════════════════════════════════════════════════════

/** Le numéro de dex écrit pour l'œil : « N° 007 ».
 *
 *  TROIS CHIFFRES, TOUJOURS. Les 933 numéros s'alignent en colonne sur
 *  la grille des cartes, et « N° 7 » à côté de « N° 412 » casse
 *  l'alignement à chaque ligne. */
export function numeroDuDex(no: number): string {
  return `N° ${String(no).padStart(3, "0")}`;
}

/** Ce qu'une marque montre : son signe, et ce qu'elle dit à voix haute.
 *
 *  LE SIGNE N'EST PAS SEUL À PORTER LE SENS. Un point et un disque
 *  plein ne se distinguent pas pour tout le monde, et aucun des deux ne
 *  se lit à voix haute : le `mot` part dans un `title` et dans
 *  l'étiquette accessible. */
export type Marque = {
  readonly etat: Exclude<EtatDEspece, "inconnu">;
  readonly signe: string;
  readonly mot: string;
};

const MARQUES: Readonly<Record<Exclude<EtatDEspece, "inconnu">, Marque>> = {
  //  LA POKÉ BALL POUR LA CAPTURE, L'ŒIL POUR LA RENCONTRE. Les deux
  //  caractères sont dans les polices de système partout où le forum
  //  est lu — testé le 5 novembre — et ils disent la différence sans
  //  qu'on l'explique.
  attrape: { etat: "attrape", signe: "◉", mot: "dans ton Pokédex" },
  croise: { etat: "croise", signe: "◌", mot: "déjà croisé" },
};

/** La marque d'un état, ou `null` pour `inconnu` et pour l'absence de
 *  carnet — les deux cas où la carte ne doit rien montrer. */
export function marqueDuDex(etat: EtatDEspece | undefined): Marque | null {
  if (etat === undefined || etat === "inconnu") return null;
  return MARQUES[etat];
}

/** Les numéros tels qu'on les lit dans `data/dex-numeros.json`.
 *
 *  ON ÉCARTE CE QUI N'EST PAS UN RANG. Un numéro hors de 1..933, ou qui
 *  n'est pas entier, ferait écrire « N° 0 » ou « N° 1200 » sur une
 *  carte — et personne ne saurait d'où ça vient. */
export function numerosDepuis(donnees: unknown): ReadonlyMap<number, number> {
  const table = new Map<number, number>();
  if (donnees === null || typeof donnees !== "object") return table;
  const brut = (donnees as Record<string, unknown>).numeros;
  if (brut === null || typeof brut !== "object") return table;
  for (const [clef, valeur] of Object.entries(brut as Record<string, unknown>)) {
    const id = Number(clef);
    if (!Number.isInteger(id) || id <= 0) continue;
    if (typeof valeur !== "number" || !Number.isInteger(valeur)) continue;
    if (valeur < 1 || valeur > 933) continue;
    table.set(id, valeur);
  }
  return table;
}
