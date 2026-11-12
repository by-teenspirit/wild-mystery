// ════════════════════════════════════════════════════════════════════
//  src/navigateur/repertoire.ts — filtrer le répertoire des personnages
//
//  « Il faudrait faire une page sur laquelle on a tous les personnages
//  validés avec quelques infos : leur avatar (en image) & leur avatar
//  (le faceclaim), leur nom, leur métier, leur groupe, leur caractère
//  en quelques mots, leur lieu de vie, leur âge, leur région d'origine,
//  le lien vers la fiche de liens et vers la présentation (ce serait
//  des cards, on en affiche 3 ou 4 par colonne). On pourrait filtrer
//  cette page. » — 10 novembre 2026.
//
//  AUCUN DOM ICI. Ce fichier décide quels menus existent et qui reste
//  visible ; `module-repertoire.ts` pose et montre. La séparation
//  permet d'éprouver les filtres sans navigateur — et c'est là que
//  sont les pièges, pas dans le dessin.
//
//  ── LES CARTES SONT DANS LA PAGE, PAS CONSTRUITES PAR CE SCRIPT ────
//
//  Même règle que la barre de filtres de l'annexe 11 : sans
//  JavaScript, tous les personnages sont là, en vrai HTML, écrits par
//  `outils/repertoire.py` depuis `data/repertoire.json`. Le script
//  n'ajoute QUE la barre, et un bouton n'a le droit de cacher que ce
//  qu'il peut remontrer.
//
//  Une page dont le contenu EST la liste ne peut pas se permettre
//  d'être blanche sans script — c'est ce qui la distingue du bloc
//  d'accueil, qui remplace un repli déjà lisible.
//
//  ── POURQUOI UN FICHIER DU DÉPÔT, ET PAS LE FORUM NI SUPABASE ──────
//
//  1. LES CHAMPS DE PROFIL DU FORUM demandent une session connectée et
//     le panneau d'administration. Ce n'est pas ce que fait ce projet.
//  2. SUPABASE a les tables (`joueur`, `fiche_champ`), mais elles se
//     remplissent une fiche à la fois, par les joueurs, et personne
//     n'en a encore rempli une : la page serait vide longtemps.
//  3. LE FICHIER DU DÉPÔT est l'arbitrage du 7 octobre pour l'accueil
//     — « tout vient d'ici, et pas du forum » — et le seul des trois
//     qui affiche quelque chose le jour où on pousse.
//
//  Le jour où les fiches Supabase se rempliront, c'est le GÉNÉRATEUR
//  qui changera de source ; ni cette logique ni le CSS ne bougeront.
// ════════════════════════════════════════════════════════════════════

/** Ce qu'une carte porte pour être filtrée.
 *
 *  LE GÉNÉRATEUR L'ÉCRIT DANS DES ATTRIBUTS, le module le relit. On ne
 *  refait pas la lecture du fichier de données ici : elle est déjà
 *  faite en Python, et deux lectures de la même source finissent par
 *  ne plus dire la même chose.
 *
 *  `cherche` est le texte aplati — nom, métier, caractère, faceclaim,
 *  lieu, origine — préparé une fois à la génération plutôt qu'à chaque
 *  frappe. */
export type Fiche = {
  readonly groupe: string;
  readonly lieu: string;
  readonly origine: string;
  readonly cherche: string;
};

/** Les trois colonnes filtrables, dans l'ordre des menus.
 *
 *  PAS LE MÉTIER NI L'ÂGE : un métier est un texte libre, et autant de
 *  valeurs que de personnages ne font pas un menu — c'est la recherche
 *  qui s'en charge. */
export const COLONNES = ["groupe", "lieu", "origine"] as const;
export type Colonne = typeof COLONNES[number];

const MOTS: Record<Colonne, string> = {
  groupe: "Groupe",
  lieu: "Lieu de vie",
  origine: "Région d'origine",
};

export function motDeLaColonne(c: Colonne): string {
  return MOTS[c];
}

export function estUneColonne(x: string): x is Colonne {
  return (COLONNES as readonly string[]).includes(x);
}

export function valeur(f: Fiche, c: Colonne): string {
  return c === "groupe" ? f.groupe : c === "lieu" ? f.lieu : f.origine;
}

export type Menu = {
  readonly colonne: Colonne;
  readonly mot: string;
  /** Les valeurs présentes, rangées par ordre alphabétique français. */
  readonly choix: readonly string[];
};

/**
 * Les menus à poser.
 *
 * LES CHOIX VIENNENT DES CARTES, PAS D'UNE LISTE À TENIR. Un menu
 * « Lieu de vie » écrit à la main vieillirait au premier personnage
 * qui habite ailleurs ; dérivé, il ne peut pas mentir.
 *
 * UNE SEULE VALEUR, PAS DE MENU : si tout le monde vit à Lumirandé, le
 * menu ne propose qu'un choix, et un menu à un choix ne filtre rien.
 * Il reviendra tout seul le jour où quelqu'un déménagera.
 */
export function menusAProposer(fiches: readonly Fiche[]): readonly Menu[] {
  return COLONNES.flatMap((colonne) => {
    const choix = [
      ...new Set(fiches.map((f) => valeur(f, colonne)).filter((v) => v !== "")),
    ].sort((a, b) => a.localeCompare(b, "fr"));
    return choix.length < 2 ? [] : [{ colonne, mot: MOTS[colonne], choix }];
  });
}

/** Les accents ne doivent pas faire rater une recherche : « lumirande »
 *  trouve « Lumirandé ». Personne ne tape les accents dans un champ. */
export function sansAccent(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

export type Choix = {
  readonly recherche: string;
  /** Une valeur choisie par colonne. Une colonne absente, ou une
   *  valeur vide, ne filtre rien — c'est l'état « Tous ». */
  readonly menus: ReadonlyMap<Colonne, string>;
};

export const SANS_FILTRE: Choix = { recherche: "", menus: new Map() };

/** Vrai si cette carte reste visible. */
export function retenue(f: Fiche, choix: Choix): boolean {
  for (const [colonne, attendu] of choix.menus) {
    if (attendu !== "" && valeur(f, colonne) !== attendu) return false;
  }
  //  TOUS LES MOTS, PAS N'IMPORTE LEQUEL. « ana fleur » doit trouver
  //  la fleuriste qui s'appelle Ana, et pas tous les fleuristes.
  const mots = sansAccent(choix.recherche).split(/\s+/).filter((m) => m !== "");
  const dans = sansAccent(f.cherche);
  return mots.every((m) => dans.includes(m));
}

export function filtrer(
  fiches: readonly Fiche[],
  choix: Choix,
): readonly boolean[] {
  return fiches.map((f) => retenue(f, choix));
}

/** Ce que la page annonce sous la barre.
 *
 *  LE COMPTE EST UNE RÉPONSE, PAS UNE DÉCORATION : filtrer et ne rien
 *  voir doit se distinguer d'une page qui n'a pas compris la demande.
 *  Et « 1 personnage » ne s'écrit pas comme « 12 personnages ».
 */
export function compte(visibles: number, total: number): string {
  if (visibles === 0) return "Aucun personnage ne correspond";
  const n = visibles === 1 ? "1 personnage" : `${visibles} personnages`;
  return visibles === total ? n : `${n} sur ${total}`;
}
