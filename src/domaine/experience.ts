// ════════════════════════════════════════════════════════════════════
//  src/domaine/experience.ts
//  Le barème d'expérience et les niveaux.
//
//  COUCHE DOMAINE : aucun import. Pas de Deno, pas de fetch, pas
//  d'horloge. Des fonctions pures, testables sans un seul bouchon.
//
//  La source de vérité est l'annexe 08 « Les chiffres », pas ce
//  fichier. Si les deux divergent, c'est l'annexe qui a raison.
// ════════════════════════════════════════════════════════════════════

export const NIVEAU_MIN = 1;
export const NIVEAU_MAX = 100;

/** La largeur d'un palier : l'annexe 08 les découpe par dizaines. */
const PALIER = 10;

/** Le barème, tel qu'il est publié dans l'annexe 08.
 *  Une entrée par dizaine de niveaux, dans l'ordre : 1–10, 11–20, … 91–100. */
export const BAREME: readonly number[] = [
  4, // 1–10
  3, // 11–20
  2, // 21–30
  1.5, // 31–40
  1, // 41–50
  1 / 1.5, // 51–60
  1 / 2, // 61–70
  1 / 3, // 71–80
  1 / 4, // 81–90
  1 / 5, // 91–100
];

export class NiveauInvalide extends Error {
  constructor(niveau: number) {
    super(`Niveau ${niveau} hors de ${NIVEAU_MIN}–${NIVEAU_MAX}.`);
    this.name = "NiveauInvalide";
  }
}

export class DegatsInvalides extends Error {
  constructor(degats: number) {
    super(`Dégâts ${degats} : attendus entiers et positifs.`);
    this.name = "DegatsInvalides";
  }
}

function exigeNiveau(niveau: number): void {
  if (!Number.isInteger(niveau) || niveau < NIVEAU_MIN || niveau > NIVEAU_MAX) {
    throw new NiveauInvalide(niveau);
  }
}

/** Le multiplicateur appliqué aux dégâts, selon le niveau du Pokémon.
 *
 *  Le niveau est borné à 1–100 avant d'indexer, et le barème compte
 *  exactement NIVEAU_MAX / PALIER entrées : l'index tombe toujours
 *  dedans. Pas de cas par défaut, donc pas de branche morte. */
export function multiplicateur(niveau: number): number {
  exigeNiveau(niveau);
  return BAREME[Math.ceil(niveau / PALIER) - 1];
}

/** L'expérience gagnée pour des dégâts infligés.
 *  Jamais aux mots : c'est la décision du 1er octobre. */
export function experienceGagnee(degats: number, niveau: number): number {
  if (!Number.isInteger(degats) || degats < 0) throw new DegatsInvalides(degats);
  return Math.round(degats * multiplicateur(niveau));
}

/** L'expérience cumulée nécessaire pour atteindre un niveau.
 *  100 × n × (n + 1) ÷ 2. Au niveau 1, rien n'est exigé. */
export function seuil(niveau: number): number {
  exigeNiveau(niveau);
  if (niveau === NIVEAU_MIN) return 0;
  return (100 * niveau * (niveau + 1)) / 2;
}

export type Montee = {
  readonly niveau: number;
  readonly gagnes: number;
};

/** Combien de niveaux une expérience fait franchir, d'un seul coup.
 *  Un Pokémon peut en prendre plusieurs à la clôture d'un long RP. */
export function monterNiveaux(niveauActuel: number, xpTotale: number): Montee {
  exigeNiveau(niveauActuel);
  if (!Number.isInteger(xpTotale) || xpTotale < 0) throw new DegatsInvalides(xpTotale);

  let niveau = niveauActuel;
  while (niveau < NIVEAU_MAX && xpTotale >= seuil(niveau + 1)) niveau++;
  return { niveau, gagnes: niveau - niveauActuel };
}
