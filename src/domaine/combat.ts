// ════════════════════════════════════════════════════════════════════
//  src/domaine/combat.ts
//  La résolution d'un tour de combat sauvage.
//
//  COUCHE DOMAINE : aucun import hors du domaine, aucune horloge,
//  aucun réseau. On donne deux combattants, une capacité et une
//  graine, on rend un tour. Même graine, même tour, pour toujours.
//
//  ── POURQUOI LE HASARD EST ICI, ET POURQUOI IL EST REPRODUCTIBLE ────
//
//  Un combat se joue en public, dans un sujet, et une contestation se
//  tranche en recalculant. La graine est le numéro du message et le
//  numéro du tour — fixés à la seconde où le joueur poste, impossibles
//  à rejouer, refaisables à l'identique des années plus tard. C'est la
//  règle que la fouille et la rencontre suivent déjà.
//
//  ── CE QUE CE MODULE NE SAIT PAS ────────────────────────────────────
//
//  Il ne sait pas lire la base, il ne sait pas poster, il ne sait pas
//  qui a le droit de jouer. Il reçoit des chiffres et il rend des
//  chiffres. Tout le reste — le combat appartient à celui qui a fait
//  apparaître le Pokémon, un seul combat par sujet — est tenu par la
//  base (0046) et par la relève.
// ════════════════════════════════════════════════════════════════════

import { graineDepuis, suiteAleatoire } from "./alea.ts";

/** Le multiplicateur d'une attaque contre un ou deux types.
 *
 *  La table est `data/types.json`, dérivée des CSV de PokéAPI par
 *  `outils/types-efficacite.py` et chargée par un adaptateur. Elle
 *  n'est PAS recopiée ici : deux tables finissent par ne plus dire la
 *  même chose, et le jour où ça arrive, l'annexe 12 affiche une
 *  maîtrise des types que le combat ne respecte pas.
 *
 *  Une paire absente vaut 1. C'est ce que le fichier dit de lui-même,
 *  et c'est pour ça qu'il ne range que les 120 paires non neutres. */
export type TableDesTypes = Readonly<Record<string, Readonly<Record<string, number>>>>;

export type Capacite = {
  readonly id: number;
  readonly nom: string;
  readonly type: string;
  readonly puissance: number;
  /** De 0 à 100. Une capacité peut manquer sa cible, et c'est ce qui
   *  fait qu'un combat n'est pas une soustraction. */
  readonly precision: number;
};

export type Combattant = {
  readonly nom: string;
  readonly niveau: number;
  readonly types: readonly string[];
  readonly pv: number;
  readonly pvMax: number;
  readonly attaque: number;
  readonly defense: number;
};

export class CombatInvalide extends Error {
  constructor(raison: string) {
    super(`Combat invalide : ${raison}`);
    this.name = "CombatInvalide";
  }
}

// ── LES TROIS CHIFFRES, COMME LE FORUM LES CALCULE ────────────────────
//
//  Formule de la 3e génération, IV 0, EV 0, nature neutre. Elle est
//  relevée contre le sujet des champions (t1002) : 60 des 65 Pokémon
//  nommés la reproduisent au chiffre près. Elle existe aussi en SQL
//  (`pv_au_niveau`, `stat_au_niveau`, migration 0045) et en Python
//  (`outils/equipes-de-champions.py`) — trois fois, parce que trois
//  endroits en ont besoin sans pouvoir s'appeler. Les trois sont
//  tenues d'accord par la suite pgTAP et par les tests d'ici, sur les
//  MÊMES chiffres de la page.

export function pvAuNiveau(base: number, niveau: number): number {
  exigeBase(base, niveau);
  return Math.floor((2 * base * niveau) / 100) + niveau + 10;
}

export function statAuNiveau(base: number, niveau: number): number {
  exigeBase(base, niveau);
  return Math.floor((2 * base * niveau) / 100) + 5;
}

function exigeBase(base: number, niveau: number): void {
  if (!Number.isInteger(base) || base < 0) {
    throw new CombatInvalide(`base ${base}`);
  }
  if (!Number.isInteger(niveau) || niveau < 1 || niveau > 100) {
    throw new CombatInvalide(`niveau ${niveau}`);
  }
}

// ── L'EFFICACITÉ ──────────────────────────────────────────────────────

/** Le produit des multiplicateurs contre chaque type du défenseur.
 *
 *  UN POKÉMON À DEUX TYPES MULTIPLIE : eau contre roche/sol fait
 *  quatre fois. Et un seul zéro suffit à tout annuler — normal contre
 *  spectre ne fait rien, quel que soit le second type. */
export function efficacite(
  typeAttaque: string,
  typesDefenseur: readonly string[],
  table: TableDesTypes,
): number {
  const ligne = table[typeAttaque];
  if (ligne === undefined) {
    //  UN TYPE QUE LA TABLE NE CONNAÎT PAS N'EST PAS NEUTRE, C'EST UNE
    //  FAUTE. Le traiter comme neutre ferait un combat qui marche à
    //  peu près, et personne ne verrait jamais que la moitié des
    //  résistances ne s'appliquent plus.
    throw new CombatInvalide(`type d'attaque inconnu : ${typeAttaque}`);
  }
  let facteur = 1;
  for (const t of typesDefenseur) facteur *= ligne[t] ?? 1;
  return facteur;
}

/** Le bonus de même type (STAB) : une attaque du type de celui qui la
 *  lance frappe une fois et demie. C'est ce qui fait qu'un Pokémon
 *  joue ses propres types plutôt que les quatre moves les plus forts. */
export const BONUS_MEME_TYPE = 1.5;

/** La fourchette du dé, en centièmes. Celle des jeux : de 0,85 à 1,00.
 *  Elle existe pour qu'un même échange ne donne pas deux fois le même
 *  chiffre — sans elle, un combat se calcule d'avance et plus personne
 *  ne le lit. */
export const DE_MIN = 85;
export const DE_MAX = 100;

export type Degats = {
  readonly points: number;
  readonly efficacite: number;
  readonly memeType: boolean;
  /** Le dé, en centièmes, pour que le Maître du Jeu puisse l'afficher
   *  et qu'une contestation se tranche sans relancer le calcul. */
  readonly de: number;
};

/** Les dégâts d'une capacité, dé compris.
 *
 *  ⌊(⌊2 × niveau / 5⌋ + 2) × puissance × ATT / DÉF / 50⌋ + 2, puis
 *  le même type, l'efficacité et le dé.
 *
 *  AU MOINS UN POINT, SAUF IMMUNITÉ. Un combat où personne n'entame
 *  personne tourne cinq tours pour rien ; une immunité, elle, doit
 *  rester un vrai zéro — c'est l'information que le joueur doit lire
 *  pour changer de Pokémon. */
export function degatsDe(
  attaquant: Combattant,
  defenseur: Combattant,
  capacite: Capacite,
  table: TableDesTypes,
  tirage: number,
): Degats {
  if (!(capacite.puissance > 0)) {
    throw new CombatInvalide(`capacité ${capacite.nom} sans puissance`);
  }
  if (!(defenseur.defense > 0)) {
    throw new CombatInvalide(`défense ${defenseur.defense}`);
  }

  const facteur = efficacite(capacite.type, defenseur.types, table);
  const memeType = attaquant.types.includes(capacite.type);
  const de = DE_MIN + Math.floor(tirage * (DE_MAX - DE_MIN + 1));

  const brut = Math.floor(
    (Math.floor((2 * attaquant.niveau) / 5) + 2) *
      capacite.puissance * attaquant.attaque / defenseur.defense / 50,
  ) + 2;

  if (facteur === 0) {
    return { points: 0, efficacite: 0, memeType, de };
  }

  const points = Math.max(
    1,
    Math.floor(brut * (memeType ? BONUS_MEME_TYPE : 1) * facteur * de / 100),
  );
  return { points, efficacite: facteur, memeType, de };
}

// ── UN TOUR ───────────────────────────────────────────────────────────

export type Frappe = {
  /** Qui a frappé.
   *
   *  `joueur` et `sauvage` sont ceux du combat sauvage. `adverse` est
   *  arrivé avec le duel (23 novembre) : c'est le camp de l'autre
   *  joueur, celui que `combat.adverse_joueur_id` désigne.
   *
   *  TROIS MOTS ET PAS DEUX, parce que `sauvage` dit ce que le
   *  combattant EST et pas seulement de quel côté il se tient. Un
   *  Pokémon de joueur marqué « sauvage » dans un récit stocké en base
   *  resterait faux pour toujours — un récit ne se réécrit pas. */
  readonly qui: "joueur" | "sauvage" | "adverse";
  readonly capacite: Capacite;
  /** Faux quand la capacité a manqué : aucun dégât, et le tour
   *  continue — rater n'est pas passer son tour. */
  readonly touche: boolean;
  readonly degats: Degats | null;
  /** Les PV du défenseur APRÈS la frappe. */
  readonly pvRestants: number;
};

export type Tour = {
  readonly numero: number;
  /** Ce que le joueur a fait au lieu de frapper — « changer », « ball »,
   *  « objet ». Absent quand il a attaqué. */
  readonly aLaPlace?: string;
  readonly frappes: readonly Frappe[];
  readonly pvJoueur: number;
  readonly pvSauvage: number;
  /** `null` tant que le combat continue.
   *
   *  `nul` N'EXISTE QUE POUR UN DUEL : trente tours sans que personne
   *  ne tombe. Un sauvage, lui, s'en va au cinquième — c'est `fuite`.
   *  Inventer un vainqueur au compte des PV serait une règle que
   *  personne n'a écrite. */
  readonly fin: "victoire" | "defaite" | "fuite" | "nul" | null;
};

/** Le nombre de tours au-delà duquel le sauvage s'en va.
 *
 *  Planche 99 §5.2 : « Cinq tours au maximum, puis le Pokémon
 *  s'enfuit. » Ça borne le bruit dans le sujet — dix tours feraient
 *  vingt messages — et ça rend la Poké Ball précieuse : on n'a pas le
 *  temps d'user le sauvage jusqu'à un PV. */
export const TOURS_MAX = 5;

/** Et celui d'un duel entre joueurs.
 *
 *  TRENTE, LÀ OÙ LE SAUVAGE EN A CINQ, et pour deux raisons qui
 *  s'ajoutent. Un sauvage s'en va au bout de cinq tours ; un dresseur
 *  reste. Et surtout UN TOUR DE DUEL EST UNE SEULE FRAPPE : cinq tours
 *  ne feraient que deux coups et demi chacun, moins qu'un seul échange
 *  de combat sauvage.
 *
 *  C'est un plafond contre le fil qui ne finit jamais, pas une règle
 *  de jeu — d'où sa largeur. Quinze coups par joueur sans que personne
 *  ne tombe, c'est que les deux Pokémon ne peuvent pas se blesser. */
export const TOURS_MAX_DUEL = 30;

/** Résout un échange complet : le joueur frappe, puis le sauvage
 *  riposte s'il tient encore debout.
 *
 *  ── POURQUOI LE JOUEUR FRAPPE EN PREMIER, TOUJOURS ──────────────────
 *
 *  Il n'y a pas de vitesse dans ce jeu : le forum affiche trois
 *  chiffres — PV, attaque, défense — et la carte des champions aussi.
 *  Tirer l'initiative sur un quatrième chiffre que personne ne voit
 *  ferait perdre des joueurs sans qu'ils puissent comprendre pourquoi.
 *  Le joueur poste, donc le joueur agit : c'est l'ordre du forum, et
 *  il se lit tout seul.
 *
 *  ── ET POURQUOI LE SAUVAGE NE RIPOSTE PAS S'IL TOMBE ────────────────
 *
 *  Un Pokémon à zéro PV ne frappe pas. Ça paraît aller de soi ; ça ne
 *  va de soi que si on l'écrit, et c'est exactement le genre d'oubli
 *  qui fait perdre un joueur contre un Pokémon déjà K.O. */
export function resoudreUnTour(
  numero: number,
  joueur: Combattant,
  sauvage: Combattant,
  choisie: Capacite,
  riposte: Capacite,
  table: TableDesTypes,
  graine: string,
): Tour {
  if (!Number.isInteger(numero) || numero < 1 || numero > TOURS_MAX) {
    throw new CombatInvalide(`tour ${numero} hors de 1..${TOURS_MAX}`);
  }
  if (joueur.pv <= 0) throw new CombatInvalide("le pokémon du joueur est déjà à terre");
  if (sauvage.pv <= 0) throw new CombatInvalide("le sauvage est déjà à terre");

  //  UNE SEULE SUITE POUR TOUT LE TOUR, et dans un ordre fixe :
  //  précision du joueur, dé du joueur, précision du sauvage, dé du
  //  sauvage. Quatre tirages toujours consommés dans le même ordre —
  //  même quand une frappe rate —, sinon rejouer un tour contesté ne
  //  redonne pas le même résultat.
  const tirer = suiteAleatoire(graineDepuis(`${graine}|${numero}`));
  const des = [tirer(), tirer(), tirer(), tirer()];

  const frappes: Frappe[] = [];

  const toucheJoueur = des[0] * 100 < choisie.precision;
  const degatsJoueur = toucheJoueur ? degatsDe(joueur, sauvage, choisie, table, des[1]) : null;
  const pvSauvage = Math.max(0, sauvage.pv - (degatsJoueur?.points ?? 0));
  frappes.push({
    qui: "joueur",
    capacite: choisie,
    touche: toucheJoueur,
    degats: degatsJoueur,
    pvRestants: pvSauvage,
  });

  let pvJoueur = joueur.pv;
  if (pvSauvage > 0) {
    const toucheSauvage = des[2] * 100 < riposte.precision;
    const degatsSauvage = toucheSauvage
      ? degatsDe(sauvage, joueur, riposte, table, des[3])
      : null;
    pvJoueur = Math.max(0, joueur.pv - (degatsSauvage?.points ?? 0));
    frappes.push({
      qui: "sauvage",
      capacite: riposte,
      touche: toucheSauvage,
      degats: degatsSauvage,
      pvRestants: pvJoueur,
    });
  }

  //  L'ORDRE DES FINS COMPTE. Le sauvage est tombé AVANT de riposter :
  //  la victoire l'emporte, même si le joueur était à un point.
  let fin: Tour["fin"] = null;
  if (pvSauvage === 0) fin = "victoire";
  else if (pvJoueur === 0) fin = "defaite";
  else if (numero === TOURS_MAX) fin = "fuite";

  return { numero, frappes, pvJoueur, pvSauvage, fin };
}

/** Le tour où le joueur NE FRAPPE PAS : il change de Pokémon, il
 *  lance une ball qui rate, il utilise un objet. Le sauvage, lui,
 *  frappe.
 *
 *  ── POURQUOI ÇA COÛTE LE TOUR ───────────────────────────────────────
 *
 *  C'est la règle des jeux, et elle n'est pas décorative : sans elle,
 *  changer de Pokémon serait gratuit, et la bonne stratégie serait
 *  toujours de faire tourner l'équipe entière pour trouver la meilleure
 *  affiche. Un choix sans coût n'est pas un choix.
 *
 *  ── ET POURQUOI LA GRAINE EST LA MÊME ───────────────────────────────
 *
 *  Les quatre tirages du tour sont consommés dans le MÊME ORDRE qu'un
 *  tour d'attaque : précision du joueur, dé du joueur, précision du
 *  sauvage, dé du sauvage. Les deux premiers sont tirés et jetés.
 *
 *  Gaspiller deux tirages a l'air bête, et c'est le point : la suite
 *  doit avancer pareil quoi que le joueur ait fait, sinon rejouer un
 *  combat contesté dépend de ce qu'on a choisi au tour deux. */
export function resoudreUneRiposte(
  numero: number,
  cible: Combattant,
  sauvage: Combattant,
  riposte: Capacite,
  table: TableDesTypes,
  graine: string,
  /** Ce que le joueur a fait à la place de frapper, pour le récit. */
  aLaPlace: string,
): Tour {
  if (!Number.isInteger(numero) || numero < 1 || numero > TOURS_MAX) {
    throw new CombatInvalide(`tour ${numero} hors de 1..${TOURS_MAX}`);
  }
  if (cible.pv <= 0) throw new CombatInvalide("la cible est déjà à terre");
  if (sauvage.pv <= 0) throw new CombatInvalide("le sauvage est déjà à terre");

  const tirer = suiteAleatoire(graineDepuis(`${graine}|${numero}`));
  const des = [tirer(), tirer(), tirer(), tirer()];

  const touche = des[2] * 100 < riposte.precision;
  const degats = touche ? degatsDe(sauvage, cible, riposte, table, des[3]) : null;
  const pvJoueur = Math.max(0, cible.pv - (degats?.points ?? 0));

  return {
    numero,
    aLaPlace,
    frappes: [{
      qui: "sauvage",
      capacite: riposte,
      touche,
      degats,
      pvRestants: pvJoueur,
    }],
    pvJoueur,
    pvSauvage: sauvage.pv,
    //  PAS DE VICTOIRE POSSIBLE ICI : le joueur n'a pas frappé. Seule
    //  la défaite, ou le cinquième tour.
    fin: pvJoueur === 0 ? "defaite" : numero === TOURS_MAX ? "fuite" : null,
  };
}

/** Les dégâts du tour infligés AU SAUVAGE, et eux seuls.
 *
 *  C'est ce que `experienceGagnee` attend : l'expérience se gagne en
 *  frappant, jamais aux mots (décision du 1er octobre). Prendre des
 *  coups n'en donne pas, et la riposte du sauvage ne compte donc
 *  pas. */
export function degatsAuSauvage(tour: Tour): number {
  return tour.frappes
    .filter((f) => f.qui === "joueur")
    .reduce((somme, f) => somme + (f.degats?.points ?? 0), 0);
}

// ── LE DUEL : UNE FRAPPE, ET ON PASSE LA MAIN ────────────────────────
//
//  « Comment on lance un combat entre mon pokémon et le pokémon de
//  l'autre joueur dans un sujet ? » — 23 novembre.
//
//  ── CE QUI CHANGE VRAIMENT, ET CE N'EST PAS LE CALCUL ───────────────
//
//  Les dégâts, l'efficacité des types, le dé, le coup critique : tout
//  est déjà là et ne bouge pas. `degatsDe` ne sait pas qui frappe, et
//  c'est exactement ce qu'il faut.
//
//  CE QUI CHANGE, C'EST QU'UN TOUR N'EST PLUS UN ÉCHANGE. Dans un
//  combat sauvage, un message fait l'aller ET le retour, parce que le
//  sauvage n'a pas d'auteur : personne n'écrirait sa riposte. Dans un
//  duel, chacun écrit son coup — alors un tour est UNE frappe, et la
//  main passe.
//
//  ── POURQUOI PAS « resoudreUnTour » AVEC UNE OPTION ─────────────────
//
//  Parce que `resoudreUnTour` consomme QUATRE tirages dans un ordre
//  fixe, et qu'un combat se conteste en le rejouant des années plus
//  tard. Lui ajouter une branche qui n'en consomme que deux changerait
//  la suite pour tous les combats sauvages à venir — et surtout, rien
//  ne garantirait que les anciens se rejouent pareil. On n'y touche
//  pas. Deux tirages ici, quatre là, et les deux ordres sont écrits.

/** Résout UNE frappe de duel, du point de vue de `joueur_id`.
 *
 *  ── UN SEUL REPÈRE, ET C'EST LA TABLE QUI LE DONNE ──────────────────
 *
 *  `pvJoueur` et `pvSauvage` gardent leur sens de toujours : le côté de
 *  `combat.joueur_id`, et celui d'en face. Ils ne disent PAS « celui
 *  qui frappe » et « celui qui encaisse » — ça change à chaque tour, et
 *  deux repères dans la même table, c'est une table qu'on ne sait plus
 *  lire.
 *
 *  D'où `qui` : il dit de quel côté vient le coup, et c'est tout ce
 *  qu'il faut pour ranger les PV du bon côté.
 *
 *  ── ET IL N'Y A PAS DE RIPOSTE ──────────────────────────────────────
 *
 *  Ce n'est pas un oubli. L'adversaire choisira SA capacité dans SON
 *  message : lui en choisir une ici, ce serait jouer à sa place. */
export function resoudreUneFrappe(
  numero: number,
  attaquant: Combattant,
  defenseur: Combattant,
  choisie: Capacite,
  table: TableDesTypes,
  graine: string,
  qui: "joueur" | "adverse",
): Tour {
  if (!Number.isInteger(numero) || numero < 1 || numero > TOURS_MAX_DUEL) {
    throw new CombatInvalide(`tour ${numero} hors de 1..${TOURS_MAX_DUEL}`);
  }
  if (attaquant.pv <= 0) throw new CombatInvalide("l'attaquant est déjà à terre");
  if (defenseur.pv <= 0) throw new CombatInvalide("le défenseur est déjà à terre");

  //  DEUX TIRAGES, ET DANS CET ORDRE : précision, puis dé des dégâts.
  //  Les deux premiers d'un tour sauvage, exactement — ce qui rend les
  //  deux fonctions lisibles côte à côte sans se demander laquelle
  //  avance la suite autrement.
  const tirer = suiteAleatoire(graineDepuis(`${graine}|${numero}`));
  const des = [tirer(), tirer()];

  const touche = des[0] * 100 < choisie.precision;
  const degats = touche ? degatsDe(attaquant, defenseur, choisie, table, des[1]) : null;
  const pvDefenseur = Math.max(0, defenseur.pv - (degats?.points ?? 0));

  const frappe: Frappe = {
    qui,
    capacite: choisie,
    touche,
    degats,
    pvRestants: pvDefenseur,
  };

  //  LE RANGEMENT DES PV, et c'est la seule ligne qui dépend de `qui`.
  const pvJoueur = qui === "joueur" ? attaquant.pv : pvDefenseur;
  const pvSauvage = qui === "joueur" ? pvDefenseur : attaquant.pv;

  //  ── LA FIN SE DIT AUSSI DANS LE REPÈRE DE `joueur_id` ─────────────
  //
  //  « Victoire » veut dire que le côté de `joueur_id` a gagné, pas que
  //  celui qui vient de frapper a gagné. Sans ça, le même mot voudrait
  //  dire deux choses selon le tour, et les deux joueurs liraient le
  //  résultat à l'envers une fois sur deux.
  //
  //  ET LE PLAFOND NE DONNE PAS DE VAINQUEUR : `nul`. Un sauvage s'en
  //  va au bout de cinq tours — c'est sa fuite. Deux dresseurs qui
  //  n'arrivent pas à se blesser en trente tours n'ont rien gagné, et
  //  inventer un vainqueur au compte des PV serait une règle que
  //  personne n'a écrite.
  let fin: Tour["fin"] = null;
  if (pvDefenseur === 0) fin = qui === "joueur" ? "victoire" : "defaite";
  else if (numero === TOURS_MAX_DUEL) fin = "nul";

  return { numero, frappes: [frappe], pvJoueur, pvSauvage, fin };
}

/** Les dégâts d'une frappe, pour l'expérience de celui qui l'a portée.
 *
 *  `degatsAuSauvage` ne vaut que pour un combat sauvage : il ne compte
 *  que les frappes du joueur, parce que la riposte du sauvage ne
 *  rapporte rien à personne. Dans un duel, LES DEUX CÔTÉS GAGNENT de
 *  l'expérience en frappant — ce qui est la même règle, lue dans les
 *  deux sens. */
export function degatsPortes(tour: Tour): number {
  return tour.frappes.reduce((somme, f) => somme + (f.degats?.points ?? 0), 0);
}
