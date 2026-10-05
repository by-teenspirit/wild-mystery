// ════════════════════════════════════════════════════════════════════
//  src/domaine/panier.ts
//
//  Ce qu'un joueur COMMANDE dans un message, et la forme que ça prend
//  dans le texte. Le pendant de `action.ts` pour la boutique.
//
//  Même décision qu'au 2 octobre : le joueur ne tape pas de syntaxe, il
//  clique dans le premier message du sujet de boutique, et c'est notre
//  JavaScript qui écrit le bloc. Le format peut donc être strict et laid.
//
//  ── LE BLOC NE PORTE AUCUN PRIX, ET C'EST LA RÈGLE QUI COMPTE ────────
//
//  La planche 30 : « La vérité est côté serveur. Le panier ne débite
//  rien : c'est `commander()` qui relit les prix dans sa propre table,
//  vérifie l'argent, débite et remplit l'inventaire, en une
//  transaction. » Le bloc dit donc QUOI et COMBIEN, jamais À QUEL PRIX.
//
//  Conséquence : un bloc trafiqué à la main ne fait pas gagner d'argent.
//  Au mieux il commande autre chose — ce que n'importe qui peut faire en
//  cliquant —, et le solde est vérifié de toute façon. Il n'y a donc
//  rien à signer ici, contrairement au bilan de clôture.
//
//  ── POURQUOI LES DOUBLONS SONT FUSIONNÉS ICI ─────────────────────────
//
//  `boutique_servir` remplit le sac avec un seul `insert … select …
//  on conflict (joueur_id, objet_id) do update`. **PostgreSQL refuse
//  qu'un même `insert` touche deux fois la même ligne** — « ON CONFLICT
//  DO UPDATE command cannot affect row a second time ». Deux lignes pour
//  le même objet dans un panier feraient donc échouer la transaction
//  entière, et le joueur ne saurait pas pourquoi.
//
//  On additionne donc avant d'écrire, et c'est le bon endroit : la
//  lecture du bloc est la frontière, et une règle appliquée à la
//  frontière ne se contourne pas.
//
//  LA BASE LE FAIT AUSSI, depuis la migration 0011, et ce n'est pas une
//  redondance : un bloc écrit à la main ne passe jamais par ici. Le
//  défaut a été relevé en vrai le 5 octobre contre un PostgreSQL 16, et
//  `src/contrat/boutique.supabase.test.ts` le garde fermé des deux
//  côtés.
//
//  ── UN PANIER ILLISIBLE N'EST PAS UN MESSAGE SANS PANIER ─────────────
//
//  `actionDe` ignore un verbe inconnu : rater une fouille coûte un tour.
//  Rater une commande, c'est un joueur qui attend des objets qui
//  n'arriveront jamais. On distingue donc les trois cas, et la relève
//  peut répondre « je n'ai pas compris, voilà pourquoi » — la table
//  `commande` a un état `refusee` et une colonne `motif` pour ça.
// ════════════════════════════════════════════════════════════════════

/** Une ligne de panier. Pas de prix : voir l'en-tête. */
export type LignePanier = {
  readonly objetId: number;
  readonly quantite: number;
};

export type LecturePanier =
  /** Ce message ne commande rien. Le cas courant. */
  | { readonly type: "aucun" }
  | { readonly type: "panier"; readonly lignes: readonly LignePanier[] }
  /** Un bloc est là, mais on refuse de deviner ce qu'il veut dire. */
  | { readonly type: "illisible"; readonly motif: string };

/** Les bornes. Elles ne protègent pas d'un tricheur — le solde s'en
 *  charge — mais d'un débordement :  `quantite::int * prix` est un
 *  entier 32 bits côté PostgreSQL, et une quantité absurde le ferait
 *  déborder AVANT la vérification du solde. Une erreur de base de
 *  données au lieu d'un refus lisible. */
export const QUANTITE_MAX = 99;
export const LIGNES_MAX = 20;

const FORME = /\[\[WM-PANIER:([^\]]*)\]\]/g;
const LIGNE = /^(\d{1,9})x(\d{1,3})$/;

/** `[[WM-PANIER:990001x3;990002x1]]`, en texte brut.
 *
 *  Les crochets doubles, comme les marqueurs et les actions : Forumactif
 *  ne connaît pas cette balise, donc elle traverse l'éditeur, le BBCode
 *  et le nettoyage sans être transformée. */
export function ecrireUnPanier(lignes: readonly LignePanier[]): string {
  const corps = fusionner(lignes)
    .map(({ objetId, quantite }) => `${objetId}x${quantite}`)
    .join(";");
  return `[[WM-PANIER:${corps}]]`;
}

/**
 * Le panier commandé dans un message.
 *
 * **Le premier bloc l'emporte**, comme la première action et la première
 * demande de clôture. Sans cette règle, coller le bloc cinquante fois
 * commanderait cinquante fois — et la limite de vingt lignes ne servirait
 * à rien.
 */
export function panierDe(texte: string): LecturePanier {
  FORME.lastIndex = 0;
  const trouve = FORME.exec(texte);
  if (trouve === null) return { type: "aucun" };

  const corps = trouve[1].trim();
  if (corps === "") return { type: "illisible", motif: "le panier est vide" };

  const morceaux = corps.split(";").map((m) => m.trim()).filter((m) => m !== "");
  if (morceaux.length > LIGNES_MAX) {
    return { type: "illisible", motif: `plus de ${LIGNES_MAX} articles dans un panier` };
  }

  const lignes: LignePanier[] = [];
  for (const morceau of morceaux) {
    const m = LIGNE.exec(morceau);
    if (m === null) return { type: "illisible", motif: `« ${morceau} » ne se lit pas` };
    const objetId = Number(m[1]);
    const quantite = Number(m[2]);
    if (objetId === 0) return { type: "illisible", motif: "un objet sans identifiant" };
    if (quantite === 0) return { type: "illisible", motif: "une quantité nulle" };
    if (quantite > QUANTITE_MAX) {
      return { type: "illisible", motif: `plus de ${QUANTITE_MAX} fois le même article` };
    }
    lignes.push({ objetId, quantite });
  }

  const fusionnees = fusionner(lignes);
  //  La fusion peut faire dépasser une ligne qui ne dépassait pas :
  //  `12x60;12x60` fait 120. On revérifie APRÈS, sans quoi la borne se
  //  contournerait en dédoublant la ligne.
  for (const { quantite } of fusionnees) {
    if (quantite > QUANTITE_MAX) {
      return { type: "illisible", motif: `plus de ${QUANTITE_MAX} fois le même article` };
    }
  }
  return { type: "panier", lignes: fusionnees };
}

/** Le texte sans aucun bloc de panier. */
export function sansPaniers(texte: string): string {
  FORME.lastIndex = 0;
  return texte.replace(FORME, "");
}

/** Les lignes, doublons additionnés, dans l'ordre de première apparition.
 *
 *  L'ordre est stable exprès : la réponse de la boutique les énumère, et
 *  une liste qui change d'ordre d'un passage à l'autre donne l'impression
 *  que le serveur hésite. */
function fusionner(lignes: readonly LignePanier[]): LignePanier[] {
  const parObjet = new Map<number, number>();
  for (const { objetId, quantite } of lignes) {
    parObjet.set(objetId, (parObjet.get(objetId) ?? 0) + quantite);
  }
  return [...parObjet].map(([objetId, quantite]) => ({ objetId, quantite }));
}
