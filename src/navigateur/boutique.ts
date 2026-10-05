// ════════════════════════════════════════════════════════════════════
//  src/navigateur/boutique.ts
//
//  Le panier de la boutique, sans DOM. Ce que le joueur ajoute, ce que
//  ça coûte, et ce que ça écrit dans son message.
//
//  ── LE CATALOGUE EST DANS LE MESSAGE, PAS DANS LE CODE ───────────────
//
//  Planche 30 : « le catalogue est écrit en dur dans le premier
//  message ; le script ne fait qu'ajouter les compteurs et le panier
//  par-dessus une liste qui existe déjà ». Conséquence : **sans
//  JavaScript le sujet reste une boutique lisible**, et Callista change
//  un prix dans son message sans toucher au dépôt.
//
//  On ne lit donc pas `data/objets.json` ici. Ce serait une deuxième
//  source de vérité, et deux sources finissent toujours par diverger.
//
//  ── LE TOTAL AFFICHÉ EST UNE INDICATION, ET IL LE DIT ────────────────
//
//  C'est le serveur qui facture, en relisant les prix dans sa propre
//  table (`servir_commande`). Le total du panier sert à ne pas commander
//  à l'aveugle, pas à faire autorité. Si les deux divergent, c'est le
//  message du forum qui a vieilli — et c'est au serveur d'avoir raison.
//
//  ── POURQUOI UN ÉTAT IMMUABLE ────────────────────────────────────────
//
//  Chaque geste rend un nouveau panier au lieu de modifier celui qu'on
//  a. L'adaptateur peut donc redessiner à partir d'une valeur, sans
//  tenir de compte parallèle de ce qu'il a déjà affiché — c'est ce qui
//  a fait diverger la barre d'actions et le module de bilan tant qu'ils
//  gardaient chacun leur idée de l'état.
// ════════════════════════════════════════════════════════════════════

import { type LignePanier, QUANTITE_MAX } from "../domaine/panier.ts";

/** Un article du catalogue, tel qu'il est écrit dans le message. */
export type Article = {
  readonly objetId: number;
  readonly nom: string;
  /** En pokédollars. Indicatif : voir l'en-tête. */
  readonly prix: number;
};

/** Le panier : combien de chaque article. Jamais de quantité nulle —
 *  retirer le dernier exemplaire retire la ligne. */
export type Panier = ReadonlyMap<number, number>;

export const PANIER_VIDE: Panier = new Map();

/** La quantité d'un article, zéro s'il n'y est pas. */
export function combien(panier: Panier, objetId: number): number {
  return panier.get(objetId) ?? 0;
}

/**
 * Le panier avec `delta` exemplaires de plus (ou de moins).
 *
 * Borné à zéro et à `QUANTITE_MAX` **sans jamais lever** : un bouton qui
 * refuse en silence au bon moment vaut mieux qu'un bouton qui casse la
 * page. La borne haute est celle du domaine, pas une invention d'ici —
 * c'est elle qui protège du débordement côté PostgreSQL.
 */
export function ajuster(panier: Panier, objetId: number, delta: number): Panier {
  const suivant = new Map(panier);
  const voulu = combien(panier, objetId) + delta;
  const borne = Math.max(0, Math.min(QUANTITE_MAX, voulu));
  if (borne === 0) suivant.delete(objetId);
  else suivant.set(objetId, borne);
  return suivant;
}

/** Le panier sans rien. */
export function vider(): Panier {
  return PANIER_VIDE;
}

/** Les lignes à écrire dans le bloc, dans l'ordre du catalogue.
 *
 *  L'ordre vient du catalogue et pas de l'ordre des clics : deux joueurs
 *  qui commandent la même chose écrivent le même bloc, et une
 *  contestation se lit sans se demander qui a cliqué quoi en premier. */
export function lignesDuPanier(
  panier: Panier,
  catalogue: readonly Article[],
): readonly LignePanier[] {
  const sortie: LignePanier[] = [];
  for (const { objetId } of catalogue) {
    const quantite = combien(panier, objetId);
    if (quantite > 0) sortie.push({ objetId, quantite });
  }
  return sortie;
}

/** Le total indicatif, en pokédollars.
 *
 *  Un article du panier qui n'est plus au catalogue vaut zéro plutôt que
 *  de faire échouer le calcul : le message a pu changer sous le joueur
 *  pendant qu'il remplissait son panier. Le serveur tranchera. */
export function total(panier: Panier, catalogue: readonly Article[]): number {
  const prix = new Map(catalogue.map((a) => [a.objetId, a.prix]));
  let somme = 0;
  for (const [objetId, quantite] of panier) {
    somme += (prix.get(objetId) ?? 0) * quantite;
  }
  return somme;
}

/** Le nombre d'articles dans le panier, exemplaires compris. */
export function nombreDArticles(panier: Panier): number {
  let n = 0;
  for (const quantite of panier.values()) n += quantite;
  return n;
}

/** Ce qu'affiche le bouton de validation.
 *
 *  Un panier vide ne cache pas le bouton, il le désactive : un bouton
 *  qui apparaît et disparaît fait sauter la mise en page à chaque clic,
 *  et le joueur perd le repère de l'endroit où valider. */
export type EtatDuBouton = {
  readonly actif: boolean;
  readonly libelle: string;
};

export function etatDuBouton(panier: Panier, catalogue: readonly Article[]): EtatDuBouton {
  const n = nombreDArticles(panier);
  if (n === 0) return { actif: false, libelle: "Panier vide" };
  const articles = n === 1 ? "1 article" : `${n} articles`;
  return {
    actif: true,
    libelle: `Commander — ${articles}, ${pokedollars(total(panier, catalogue))}`,
  };
}

/** `1 240 ₽`, avec l'espace fine insécable des milliers.
 *
 *  **La même mise en forme que `application/bilan.ts`**, et c'est
 *  volontaire : le joueur voit le même format dans la boutique et dans
 *  son bilan. Le séparateur est une espace fine insécable (U+202F), pas
 *  une espace ordinaire — un test l'a déjà payé ailleurs. */
export function pokedollars(montant: number): string {
  return `${montant.toLocaleString("fr-FR")} ₽`;
}
