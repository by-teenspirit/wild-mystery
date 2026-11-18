// ════════════════════════════════════════════════════════════════════
//  src/domaine/capture.ts
//  Les chances d'attraper un Pokémon sauvage.
//
//  COUCHE DOMAINE : aucun import hors du domaine, aucune horloge,
//  aucun réseau. On donne l'état du sauvage, la ball et un tirage, on
//  rend une prise ou un échec. Même tirage, même résultat, pour
//  toujours.
//
//  ── LA FORMULE, ET CE QU'ELLE EMPRUNTE AUX JEUX ─────────────────────
//
//  Trois choses décident, et ce sont celles que tout joueur connaît :
//
//  1. LES PV RESTANTS. Un sauvage entier est presque impossible à
//     prendre ; un sauvage à un PV se prend presque toujours. C'est ce
//     qui fait qu'on combat avant de lancer.
//  2. LE TAUX DE L'ESPÈCE, de 3 à 255 (migration 0050). C'est la seule
//     chose qui sépare un Chenipan d'un légendaire.
//  3. LA BALL. Huit au catalogue, et leurs multiplicateurs sont ceux
//     des jeux — pas des nombres inventés ici.
//
//  La formule est celle de la troisième génération, ENTIÈRE.
//
//  PREMIER JET FAUX, ET MESURÉ : j'avais gardé le calcul de `a` et
//  divisé par 255, en écrivant que « les secousses mettent en scène,
//  elles ne changent pas les chances ». C'est faux. Les quatre
//  secousses sont une probabilité à la PUISSANCE QUATRE, et sans elles
//  un Ponyta plein se prenait à 24,8 % du premier coup — et à 100 %
//  dès qu'on mettait une Hyper Ball. Un jeu où la première ball suffit
//  n'a pas de combat.
//
//  On garde donc `b = 65536 / (255/a)^(3/16)` et `P = (b/65536)^4`. Ce
//  qui ne se garde pas, c'est l'animation : on ne compte pas les
//  secousses à l'écran, on en prend la probabilité d'un coup.
//
//  ── POURQUOI PAS DE STATUT ──────────────────────────────────────────
//
//  Dans les jeux, endormir double les chances. Il n'y a pas de statut
//  dans ce combat-ci — pas de sommeil, pas de paralysie — donc le
//  facteur vaut 1 et n'apparaît pas. Le jour où les statuts arrivent,
//  il s'ajoute ici sans rien défaire.
// ════════════════════════════════════════════════════════════════════

export class CaptureInvalide extends Error {
  constructor(raison: string) {
    super(`Capture invalide : ${raison}`);
    this.name = "CaptureInvalide";
  }
}

/** Ce qu'il faut savoir du sauvage pour le prendre. */
export type Proie = {
  readonly pv: number;
  readonly pvMax: number;
  readonly niveau: number;
  readonly types: readonly string[];
  /** De 3 à 255, de la migration 0050. */
  readonly capture: number;
};

/** Le contexte qui fait varier quatre des huit balls.
 *
 *  CES QUATRE-LÀ SONT CELLES QU'ON PEUT HONORER, et c'est pour ça
 *  qu'elles ont ce contexte : la nuit, le numéro du tour et les types
 *  existent déjà dans ce jeu. Les conditions qu'on ne sait pas
 *  exprimer — pêcher, surfer — n'ont pas de ball ici. */
export type Contexte = {
  /** `estLaNuit` du joueur, pour la Sombre Ball. */
  readonly nuit: boolean;
  /** Le tour en cours, de 1 à 5, pour la Rapide Ball. */
  readonly tour: number;
};

/** Les multiplicateurs des huit balls du catalogue.
 *
 *  LES TROIS PREMIERS SONT CEUX DES JEUX, à la lettre. Les quatre
 *  suivants aussi, avec leur condition traduite dans ce jeu-ci. Le
 *  dernier est NOTRE choix, et il est signalé comme tel — voir plus
 *  bas. */
export const BALLS: Readonly<Record<string, (p: Proie, c: Contexte) => number>> = {
  "poke-ball": () => 1,
  "great-ball": () => 1.5,
  "ultra-ball": () => 2,
  //  Filet Ball : ×3,5 sur Eau et Insecte, comme dans les jeux.
  "net-ball": (p) => p.types.includes("eau") || p.types.includes("insecte") ? 3.5 : 1,
  //  Faiblo Ball : d'autant plus efficace que le sauvage est faible.
  //  ⌊(41 − niveau) / 10⌋, jamais moins de 1 — donc ×4 au niveau 1,
  //  ×1 à partir du niveau 31.
  "nest-ball": (p) => Math.max(1, Math.floor((41 - p.niveau) / 10)),
  //  Sombre Ball : ×3 la nuit. Dans les jeux c'est « la nuit ou dans
  //  une grotte » ; il n'y a pas de grotte dans ce jeu, il y a une
  //  nuit — et elle est déjà calculée pour les tables de faune.
  "dusk-ball": (_p, c) => (c.nuit ? 3 : 1),
  //  Rapide Ball : ×5 au premier tour. C'est la seule ball qui
  //  récompense de lancer AVANT de combattre, et c'est ce qui la rend
  //  intéressante dans un jeu où un combat coûte dix messages.
  "quick-ball": (_p, c) => (c.tour <= 1 ? 5 : 1),
  //  ── SCUBA BALL : NOTRE CHOIX, ET IL EST À TRANCHER ───────────────
  //
  //  Dans les jeux elle vaut ×3,5 en pêchant ou en surfant. Il n'y a
  //  ni pêche ni surf ici, et les zones n'ont que deux conditions,
  //  jour et nuit : aucun crochet pour sa vraie règle.
  //
  //  Lui donner ×1 en ferait un piège — 1 000 PD au catalogue pour
  //  rien. On la rend donc EAU UNIQUEMENT, à ×3,5 : une Filet Ball qui
  //  ne prend pas les insectes, ce qui justifie son prix face à la
  //  Super Ball sans la rendre meilleure que la Filet. À changer le
  //  jour où une zone peut être aquatique.
  "dive-ball": (p) => (p.types.includes("eau") ? 3.5 : 1),
};

export type Jet = {
  readonly prise: boolean;
  /** La chance qu'il y avait, de 0 à 1, arrondie au millième. Elle est
   *  rendue pour que le message du Maître du Jeu puisse la dire : un
   *  joueur qui rate trois fois doit pouvoir lire qu'il avait 12 %. */
  readonly chance: number;
  /** Le tirage, de 0 à 1 — la trace, comme le dé d'un tour. */
  readonly de: number;
};

/** La chance de prise, de 0 à 1.
 *
 *  `a = (3·PVmax − 2·PV) × taux × ball / (3·PVmax)`
 *  `b = 65536 / (255/a)^(3/16)` et `P = (b/65536)^4`
 *
 *  `a ≥ 255` est une prise certaine, et c'est la seule façon d'en
 *  obtenir une : avec un taux de 255 il faut encore descendre les PV,
 *  et avec un taux de 45 il faut une Hyper Ball ET un sauvage presque
 *  à terre.
 *
 *  UN SAUVAGE PLEIN N'EST PAS UNE PRISE, et c'est ce qui fait qu'on
 *  combat avant de lancer. */
export function chanceDePrise(
  proie: Proie,
  ball: string,
  contexte: Contexte,
): number {
  if (!Number.isInteger(proie.pvMax) || proie.pvMax <= 0) {
    throw new CaptureInvalide(`pvMax ${proie.pvMax}`);
  }
  if (!Number.isInteger(proie.pv) || proie.pv < 0 || proie.pv > proie.pvMax) {
    throw new CaptureInvalide(`pv ${proie.pv} sur ${proie.pvMax}`);
  }
  if (!Number.isInteger(proie.capture) || proie.capture < 1) {
    throw new CaptureInvalide(`taux de capture ${proie.capture}`);
  }
  const facteur = BALLS[ball];
  if (facteur === undefined) {
    //  UNE BALL INCONNUE LÈVE, elle ne vaut pas ×1. Valoir ×1 ferait
    //  qu'une Hyper Ball mal nommée se lancerait comme une Poké Ball,
    //  et le joueur paierait 1 200 PD pour rien sans jamais le savoir.
    throw new CaptureInvalide(`ball inconnue : ${ball}`);
  }

  const a = ((3 * proie.pvMax - 2 * proie.pv) * proie.capture *
    facteur(proie, contexte)) / (3 * proie.pvMax);
  if (a >= 255) return 1;
  //  `a` ne peut pas être nul : `pv ≤ pvMax` donne `3·PVmax − 2·PV ≥
  //  PVmax > 0`, et le taux comme le facteur sont strictement positifs.
  //  Pas de division par zéro possible, donc pas de garde morte.
  const b = 65536 / Math.pow(255 / a, 3 / 16);
  return Math.round(Math.pow(b / 65536, 4) * 1000) / 1000;
}

/** Le jet complet. `tirage` vient de la suite déterministe du message :
 *  une capture contestée se rejoue à l'identique. */
export function lancerUneBall(
  proie: Proie,
  ball: string,
  contexte: Contexte,
  tirage: number,
): Jet {
  const chance = chanceDePrise(proie, ball, contexte);
  const de = Math.round(tirage * 1000) / 1000;
  return { prise: de < chance, chance, de };
}
