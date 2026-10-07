// ════════════════════════════════════════════════════════════════════
//  src/application/recu.ts
//  Le reçu de boutique, et le refus, tels qu'ils sont postés dans le
//  sujet de la boutique.
//
//  MÊME RÈGLE QUE `bilan.ts` : du texte, des lignes nommées, aucune mise
//  en forme qui porterait du sens. Ça doit rester lisible dans dix ans,
//  sans JavaScript, sans CSS, sans Supabase (planche 38).
//
//  Fonctions PURES. Les noms d'objets arrivent déjà résolus — ils
//  viennent de la base, qui les a renvoyés avec les prix qu'elle a
//  appliqués. Donc aucun catalogue à interroger ici, et le texte se
//  teste caractère par caractère.
//
//  ── POURQUOI LE REÇU DÉTAILLE LES PRIX ──────────────────────────────
//
//  Parce que ce sont CEUX DE LA BASE, et pas ceux du message. Le
//  catalogue affiché dans le premier message est indicatif ; la base fait
//  foi (planche 30). Le jour où les deux divergent — et ils divergeront,
//  c'est arrivé trois fois cette semaine sur d'autres fichiers — le reçu
//  est la seule trace qui dit ce qui a réellement été débité.
//
//  Un joueur qui lit « Pierre Feu ×2 · 3 000 ₽ · 6 000 ₽ » peut comparer
//  avec le catalogue et venir se plaindre avec un chiffre. C'est tout ce
//  qu'on lui demande.
// ════════════════════════════════════════════════════════════════════

import { pokedollars } from "./bilan.ts";
import type { LigneFacturee } from "./ports.ts";

export type Recu = {
  readonly pseudo: string;
  readonly lignes: readonly LigneFacturee[];
  readonly total: number;
  /** Le solde APRÈS débit, tel que la base l'a renvoyé. On n'écrit pas
   *  l'avant : il se recalcule, et un chiffre de plus est un chiffre de
   *  plus à vérifier. */
  readonly solde: number;
};

/** Le reçu d'une commande servie.
 *
 *  Le code est écrit en toutes lettres pour la même raison que dans le
 *  bilan : un joueur qui conteste doit pouvoir le recopier. Le marqueur
 *  technique est ajouté par l'adaptateur Forumactif — ce fichier ne
 *  connaît pas le forum. */
export function redigerLeRecu(recu: Recu, code: string): string {
  const texte: string[] = [
    `${recu.pseudo.toUpperCase()}, la commande est servie.`,
    "",
  ];

  for (const l of recu.lignes) {
    //  Le prix unitaire ET le sous-total. Le premier dit ce que la base
    //  applique, le second ce qu'on a payé : avec les deux, un écart se
    //  voit sans calculer.
    texte.push(
      `— ${l.nom} ×${l.quantite} · ${pokedollars(l.prix)} ₽ · ` +
        `${pokedollars(l.sousTotal)} ₽`,
    );
  }

  texte.push(
    "",
    `TOTAL : ${pokedollars(recu.total)} ₽`,
    `SOLDE : ${pokedollars(recu.solde)} ₽`,
    "",
    "Les objets sont dans ton sac.",
    "",
    `CODE : ${code}`,
  );
  return texte.join("\n");
}

/** Le refus.
 *
 *  « On ne grise pas le bouton : on explique » (planche 38). Ici c'est
 *  plus vrai qu'ailleurs : le joueur a cliqué, il a envoyé, et il attend
 *  des objets. Un silence le laisserait croire que ça a marché.
 *
 *  `detail` vient de la base, déjà rédigé pour être recopié tel quel :
 *  c'est elle qui sait quel objet n'est pas en vente et combien il reste
 *  sur le compte. La dupliquer ici créerait deux phrases pour le même
 *  refus, et elles divergeraient. */
export function redigerLeRefusDeCommande(
  pseudo: string,
  detail: string,
  code: string,
): string {
  return [
    `${pseudo.toUpperCase()}, la commande n'a pas pu être servie.`,
    "",
    detail,
    "",
    "Rien n'a été débité et le sac n'a pas bougé. Corrige le panier et " +
    "renvoie-le : il suffit de recliquer dans le catalogue.",
    "",
    `CODE : ${code}`,
  ].join("\n");
}

/** Le refus d'un bloc qu'on n'a pas su lire.
 *
 *  Distinct du précédent, et pas par souci de symétrie : la base n'a
 *  jamais vu ce panier, donc il n'y a ni commande, ni total, ni motif
 *  d'elle. Le joueur, lui, a bien cliqué sur « Valider » — et c'est
 *  presque toujours qu'il a édité son message à la main ensuite.
 *
 *  C'est le cas que l'en-tête de `panier.ts` sépare exprès : « rater une
 *  commande, c'est un joueur qui attend des objets qui n'arriveront
 *  jamais ». */
export function redigerLePanierIllisible(
  pseudo: string,
  motif: string,
  code: string,
): string {
  return [
    `${pseudo.toUpperCase()}, le panier de ce message est illisible.`,
    "",
    motif,
    "",
    "Rien n'a été débité. Le plus simple : reclique dans le catalogue du " +
    "premier message et renvoie, sans retoucher le bloc à la main.",
    "",
    `CODE : ${code}`,
  ].join("\n");
}
