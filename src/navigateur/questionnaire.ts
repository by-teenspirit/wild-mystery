// ════════════════════════════════════════════════════════════════════
//  src/navigateur/questionnaire.ts
//
//  Le dépouillement du questionnaire des six natures. Pur : aucun DOM,
//  aucune requête — on reçoit des choix, on rend un classement.
//
//  « Tu vas aussi préparer le petit questionnaire que la personne peut
//  remplir facilement et lui donner le résultat vers quel groupe elle
//  tend le plus, avec des jauges. Elle peut être un peu de chaque mais
//  en pourcentage, souvent, y'a un groupe qui ressort (sauf si y'en a
//  deux à ex-aequo). »
//
//  ── DEUX NATURES PAR RÉPONSE, 2 POINTS ET 1 ─────────────────────────
//
//  C'est la règle de la planche 79, et elle a deux raisons : on ne peut
//  pas deviner « la bonne réponse », et personne ne sort avec un score
//  nul partout sauf une. C'est aussi ce qui rend les jauges lisibles —
//  six barres dont une seule est pleine ne diraient rien.
//
//  ── « UN PEU DE CHAQUE, MAIS EN POURCENTAGE » ───────────────────────
//
//  La part d'une nature est ses points sur le total distribué, pas sur
//  un maximum théorique. Huit questions pleines distribuent 24 points ;
//  à la quatrième réponse, les parts se lisent déjà sur 12. La jauge
//  avance donc pendant qu'on répond au lieu de rester à plat.
//
//  LES POURCENTAGES ARRONDIS NE FONT PAS TOUJOURS CENT. Six arrondis à
//  l'unité peuvent tomber à 99 ou à 101, et aucun raccommodage ne vaut
//  mieux que ça : on ne corrige donc pas la dernière barre pour faire
//  joli, et `partExacte` reste disponible pour la largeur du trait.
//
//  ── L'EX-ÆQUO EST UN RÉSULTAT, PAS UN DÉFAUT ────────────────────────
//
//  « Sauf si y'en a deux à ex-æquo. » On départage d'abord par le
//  nombre de PREMIERS choix — une nature choisie en tête quatre fois
//  pèse autrement qu'une nature ramassée en second huit fois. Si c'est
//  encore égal, on annonce les deux et on laisse choisir : la planche
//  79 le dit aussi, « le questionnaire ne décide de rien ».
// ════════════════════════════════════════════════════════════════════

/** Une réponse cochée : la nature qui prend 2 points, puis celle qui en
 *  prend 1. */
export type Choix = {
  readonly premier: string;
  readonly second: string;
};

export type Resultat = {
  readonly cle: string;
  readonly points: number;
  /** Le pourcentage affiché, arrondi à l'unité. */
  readonly part: number;
  /** La part non arrondie, pour la largeur du trait. */
  readonly partExacte: number;
  /** Combien de fois cette nature a été le PREMIER poids d'une réponse.
   *  Sert à départager, et à rien d'autre. */
  readonly premiers: number;
};

export type Depouillement = {
  readonly classement: readonly Resultat[];
  /** Combien de questions ont reçu une réponse. */
  readonly repondues: number;
  /** Les natures en tête : une, ou deux quand elles sont vraiment à
   *  égalité. Vide tant que personne n'a répondu. */
  readonly tetes: readonly string[];
  readonly exaequo: boolean;
};

export const POINTS_PREMIER = 2;
export const POINTS_SECOND = 1;

/** Dépouille les choix cochés.
 *
 *  `cles` est la liste des six natures, dans l'ordre où on veut les
 *  lire à égalité de points. TOUTES SONT RENDUES, même à zéro : une
 *  jauge qui disparaîtrait quand elle tombe à zéro ferait sauter les
 *  autres d'une ligne à chaque clic. */
export function depouiller(
  choix: readonly Choix[],
  cles: readonly string[],
): Depouillement {
  const points = new Map<string, number>(cles.map((c) => [c, 0]));
  const premiers = new Map<string, number>(cles.map((c) => [c, 0]));

  for (const c of choix) {
    //  UNE NATURE INCONNUE EST IGNORÉE, pas ajoutée : la page est
    //  écrite depuis le même fichier que la liste, donc une clé qui
    //  n'y est pas est une faute de frappe, et l'afficher en
    //  septième jauge la cacherait au lieu de la montrer.
    if (points.has(c.premier)) {
      points.set(c.premier, (points.get(c.premier) ?? 0) + POINTS_PREMIER);
      premiers.set(c.premier, (premiers.get(c.premier) ?? 0) + 1);
    }
    if (points.has(c.second)) {
      points.set(c.second, (points.get(c.second) ?? 0) + POINTS_SECOND);
    }
  }

  const total = [...points.values()].reduce((a, b) => a + b, 0);
  const classement = cles
    .map((cle) => {
      const p = points.get(cle) ?? 0;
      const exacte = total === 0 ? 0 : (p / total) * 100;
      return {
        cle,
        points: p,
        part: Math.round(exacte),
        partExacte: exacte,
        premiers: premiers.get(cle) ?? 0,
      };
    })
    //  À POINTS ÉGAUX, LES PREMIERS CHOIX PASSENT DEVANT. À égalité
    //  complète, l'ordre de `cles` tranche — il est stable, donc deux
    //  dépouillements des mêmes réponses donnent le même classement.
    .sort((a, b) => b.points - a.points || b.premiers - a.premiers);

  const tete = classement[0];
  const tetes: string[] = [];
  if (total > 0 && tete !== undefined) {
    tetes.push(tete.cle);
    const second = classement[1];
    if (
      second !== undefined && second.points === tete.points &&
      second.premiers === tete.premiers
    ) {
      tetes.push(second.cle);
    }
  }

  return {
    classement,
    repondues: choix.length,
    tetes,
    exaequo: tetes.length > 1,
  };
}
