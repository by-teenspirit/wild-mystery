// ════════════════════════════════════════════════════════════════════
//  src/navigateur/personnages.ts — les trois statuts et leurs filtres
//
//  L'annexe 11 liste quatorze personnages dans UNE seule liste, et
//  trois boutons la trient : jouable, joué, PNJ. Ce fichier ne touche
//  pas au document : il décide quels boutons existent, ce qu'ils
//  disent, et ce qu'ils montrent. Le DOM est dans
//  `src/adaptateurs/navigateur/module-personnages.ts`.
//
//  ── POURQUOI TROIS, ET PAS LES MOTS DU SUJET D'ORIGINE ────────────
//
//  Le sujet du forum écrit « Non jouable », « Non jouables »,
//  « Célébrité », « Jouable », « Jouables », « (pris) ». Six mots pour
//  trois états, et le lecteur, lui, ne vient chercher qu'une chose :
//  est-ce que je peux le jouer ? D'où trois clés, et un filtre par
//  clé. Le ramassage des six mots vers les trois clés est fait UNE
//  fois, à la génération de la page, par `outils/annexe-personnages.py`.
// ════════════════════════════════════════════════════════════════════

/** Les trois états. `joue` est sans accent : c'est une clé, pas un mot. */
export type Statut = "jouable" | "joue" | "pnj";

//  L'ORDRE COMPTE : c'est celui des boutons. « Jouable » d'abord parce
//  que c'est la seule colonne sur laquelle on peut agir.
export const STATUTS: readonly Statut[] = ["jouable", "joue", "pnj"] as const;

const MOTS: Record<Statut, string> = {
  jouable: "Jouable",
  joue: "Joué",
  pnj: "PNJ",
};

/** Le choix courant : un statut, ou tout. */
export type Choix = Statut | "tous";

export function estUnStatut(x: string): x is Statut {
  return (STATUTS as readonly string[]).includes(x);
}

export function motDuStatut(s: Statut): string {
  return MOTS[s];
}

/**
 * Combien de fiches par statut. Les trois clés sont toujours là, à
 * zéro s'il n'y en a aucune — un compteur absent et un compteur à zéro
 * ne se lisent pas pareil plus loin.
 */
export function compter(statuts: readonly Statut[]): Record<Statut, number> {
  const n: Record<Statut, number> = { jouable: 0, joue: 0, pnj: 0 };
  for (const s of statuts) n[s] += 1;
  return n;
}

export type Filtre = { cle: Choix; mot: string; nombre: number };

/**
 * Les boutons à poser.
 *
 * UN STATUT SANS FICHE N'A PAS DE BOUTON. Un bouton « Joué (0) » ne
 * sert qu'à être cliqué pour ne rien montrer ; le jour où quelqu'un
 * joue un personnage, le bouton apparaît tout seul.
 *
 * S'il ne reste qu'un seul statut, il n'y a rien à filtrer et on ne
 * rend aucun bouton : une barre à deux boutons dont l'un montre tout
 * et l'autre la même chose est du bruit.
 */
export function filtresAProposer(statuts: readonly Statut[]): Filtre[] {
  const n = compter(statuts);
  const tenus = STATUTS.filter((s) => n[s] > 0);
  if (tenus.length < 2) return [];
  return [
    { cle: "tous", mot: "Tous", nombre: statuts.length },
    ...tenus.map((s) => ({ cle: s as Choix, mot: MOTS[s], nombre: n[s] })),
  ];
}

export function visible(statut: Statut, choix: Choix): boolean {
  return choix === "tous" || choix === statut;
}

/** Ce que l'annonce au lecteur d'écran dit après un clic. */
export function motDuCompte(nombre: number, choix: Choix): string {
  const quoi = nombre === 1 ? "personnage" : "personnages";
  if (choix === "tous") return `${nombre} ${quoi}`;
  return `${nombre} ${quoi} — ${MOTS[choix].toLowerCase()}`;
}

/** Le statut demandé par l'adresse (`#jouable`), ou rien. */
export function choixDuFragment(hash: string, proposes: readonly Filtre[]): Choix | null {
  const clef = hash.replace(/^#/, "");
  if (clef === "") return null;
  return proposes.some((f) => f.cle === clef) ? (clef as Choix) : null;
}
