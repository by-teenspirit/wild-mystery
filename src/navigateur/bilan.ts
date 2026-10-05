// ════════════════════════════════════════════════════════════════════
//  src/navigateur/bilan.ts
//
//  Ce que le module au-dessus du premier message a besoin de savoir, et
//  rien de plus. Aucun DOM, aucun réseau : on reçoit ce que la base a
//  rendu, on rend des colonnes prêtes à dessiner.
//
//  ── POURQUOI LA LECTURE EST SI MÉFIANTE ──────────────────────────────
//
//  Ces lignes viennent d'une API publique, lue avec la clé publiable.
//  Une ligne mal formée ne doit pas emporter la page : elle doit
//  disparaître, et les autres rester. Un joueur qui perd une ligne de
//  son bilan le signale ; un joueur devant une page blanche croit que
//  le forum est cassé.
//
//  C'est la même règle que pour le catalogue : **une panne de données
//  n'est pas une panne de page.**
// ════════════════════════════════════════════════════════════════════

import {
  cumuler,
  type Effets,
  type Evenement,
  type LigneRegistre,
} from "../domaine/cloture.ts";
import type { LigneEnAttente } from "../application/bilan.ts";

/** Une ligne du registre et le joueur à qui elle appartient. */
export type LigneDeJoueur = {
  readonly joueurId: string;
  readonly ligne: LigneRegistre;
};

function entier(valeur: unknown): number | null {
  return typeof valeur === "number" && Number.isFinite(valeur) ? valeur : null;
}

function entierPositif(valeur: unknown): number | null {
  const n = entier(valeur);
  return n !== null && Number.isInteger(n) && n > 0 ? n : null;
}

function texte(valeur: unknown): string | null {
  return typeof valeur === "string" && valeur !== "" ? valeur : null;
}

/** Une charge jsonb devient un événement du domaine, ou rien.
 *
 *  Les clés sont celles du domaine, en camelCase — c'est la convention
 *  posée par les fonctions SQL (`0003`), et elle tient d'un bout à
 *  l'autre : une clé mal orthographiée doit disparaître, pas se taire
 *  en rendant `undefined`. */
export function evenementDepuis(type: unknown, charge: unknown): Evenement | null {
  if (typeof charge !== "object" || charge === null) return null;
  const c = charge as Record<string, unknown>;

  switch (type) {
    case "croise": {
      const especeId = entierPositif(c.especeId);
      return especeId === null ? null : { type: "croise", especeId };
    }
    case "capture": {
      const especeId = entierPositif(c.especeId);
      const niveau = entierPositif(c.niveau);
      return especeId === null || niveau === null
        ? null
        : { type: "capture", especeId, niveau };
    }
    case "xp": {
      const pokemonId = texte(c.pokemonId);
      const gain = entier(c.gain);
      return pokemonId === null || gain === null ? null : { type: "xp", pokemonId, gain };
    }
    case "objet_trouve":
    case "objet_utilise": {
      const objetId = entierPositif(c.objetId);
      const quantite = entierPositif(c.quantite);
      return objetId === null || quantite === null ? null : { type, objetId, quantite };
    }
    case "pokedollars": {
      const montant = entier(c.montant);
      return montant === null ? null : { type: "pokedollars", montant };
    }
    default:
      //  Un type qu'on ne connaît pas encore : une version du serveur
      //  peut en écrire un qu'une version du navigateur ignore. On la
      //  saute, on ne tombe pas.
      return null;
  }
}

/** Les lignes exploitables, dans l'ordre où la base les a rendues. */
export function lignesDepuis(donnees: unknown): readonly LigneDeJoueur[] {
  if (!Array.isArray(donnees)) return [];
  const sortie: LigneDeJoueur[] = [];
  for (const brut of donnees) {
    if (typeof brut !== "object" || brut === null) continue;
    const r = brut as Record<string, unknown>;
    const joueurId = texte(r.joueur_id);
    const messageId = entierPositif(r.message_id);
    if (joueurId === null || messageId === null) continue;
    const evenement = evenementDepuis(r.type, r.charge);
    if (evenement === null) continue;
    sortie.push({ joueurId, ligne: { messageId, evenement } });
  }
  return sortie;
}

/** Les lignes regroupées par joueur.
 *
 *  L'ordre des joueurs est celui de leur PREMIÈRE ligne — donc celui
 *  des messages. Une colonne par joueur, dans l'ordre où ils sont
 *  entrés dans le sujet, et pas dans celui d'un identifiant. */
export function parJoueur(
  lignes: readonly LigneDeJoueur[],
): ReadonlyMap<string, readonly LigneRegistre[]> {
  const par = new Map<string, LigneRegistre[]>();
  for (const { joueurId, ligne } of lignes) {
    const sien = par.get(joueurId);
    if (sien === undefined) par.set(joueurId, [ligne]);
    else sien.push(ligne);
  }
  return par;
}

/** Les identifiants qu'il faudra savoir nommer. */
export function aNommer(effets: Effets): {
  readonly especes: readonly number[];
  readonly objets: readonly number[];
} {
  const especes = new Set<number>(effets.especesCroisees);
  for (const c of effets.captures) especes.add(c.especeId);
  const objets = new Set<number>([
    ...effets.objetsAjoutes.keys(),
    ...effets.objetsConsommes.keys(),
  ]);
  return { especes: [...especes], objets: [...objets] };
}

/** Comment on écrit un identifiant qu'on n'a pas su nommer.
 *
 *  Le croisillon n'est pas décoratif : « Espèce 37 » a l'air d'une
 *  donnée, et un joueur le recopierait dans une contestation. « #37 »
 *  dit qu'il manque un nom, pas qu'il s'appelle comme ça. */
function nomme(id: number, noms: ReadonlyMap<number, string>): string {
  return noms.get(id) ?? `#${id}`;
}

export type Noms = {
  readonly especes: ReadonlyMap<number, string>;
  readonly objets: ReadonlyMap<number, string>;
};

/** Ce qu'un joueur a fait dans ce sujet, prêt pour `rubriquesEnAttente`. */
export function ligneEnAttente(
  pseudo: string,
  lignes: readonly LigneRegistre[],
  noms: Noms,
): LigneEnAttente {
  const e = cumuler(lignes);
  return {
    pseudo,
    captures: e.captures.map((c) => ({
      espece: nomme(c.especeId, noms.especes),
      niveau: c.niveau,
    })),
    croisees: e.especesCroisees.map((id) => nomme(id, noms.especes)),
    experience: [...e.xpParPokemon].map(([pokemon, gain]) => ({ pokemon, gain })),
    ajoutes: [...e.objetsAjoutes].map(([id, quantite]) => ({
      objet: nomme(id, noms.objets),
      quantite,
    })),
    consommes: [...e.objetsConsommes].map(([id, quantite]) => ({
      objet: nomme(id, noms.objets),
      quantite,
    })),
    pokedollars: e.pokedollars,
  };
}

/** Le pseudo de chaque joueur, pris dans la page et non dans la base.
 *
 *  ── POURQUOI PAS UNE REQUÊTE DE PLUS ─────────────────────────────────
 *
 *  Le registre ne connaît que des identifiants. La table `joueur`, elle,
 *  n'est lisible que par son propriétaire — c'est la bonne politique, et
 *  on ne va pas l'ouvrir pour afficher un nom.
 *
 *  Or le nom est déjà sous les yeux du lecteur : chaque message de la
 *  page porte `post--<messageId>` et le pseudo de son auteur, et le
 *  registre porte le même `messageId`. On relie les deux là où ils se
 *  rencontrent déjà, sans exposer quoi que ce soit de plus.
 *
 *  Un joueur dont aucun message n'est sur la page — une pagination plus
 *  tard — n'a pas de nom ici. Il n'a pas non plus de colonne à l'écran :
 *  `colonnesDuBilan` l'écarte. Montrer un UUID serait pire que de ne
 *  rien montrer. */
export function pseudoParJoueur(
  lignes: readonly LigneDeJoueur[],
  pseudoDuMessage: (messageId: number) => string | null,
): ReadonlyMap<string, string> {
  const pseudos = new Map<string, string>();
  for (const { joueurId, ligne } of lignes) {
    if (pseudos.has(joueurId)) continue;
    const pseudo = pseudoDuMessage(ligne.messageId);
    if (pseudo !== null && pseudo !== "") pseudos.set(joueurId, pseudo);
  }
  return pseudos;
}

/** Une colonne du module : un joueur, ses rubriques. */
export type Colonne = {
  readonly joueurId: string;
  readonly ligne: LigneEnAttente;
};

/** Les colonnes à dessiner, dans l'ordre d'entrée dans le sujet.
 *
 *  Un joueur qu'on ne sait pas nommer est écarté — voir ci-dessus. Un
 *  joueur nommé mais sans effet garde sa colonne : le module dira qu'il
 *  n'a rien à verser, comme le fait le message posté. */
export function colonnesDuBilan(
  lignes: readonly LigneDeJoueur[],
  pseudos: ReadonlyMap<string, string>,
  noms: Noms,
): readonly Colonne[] {
  const sortie: Colonne[] = [];
  for (const [joueurId, siennes] of parJoueur(lignes)) {
    const pseudo = pseudos.get(joueurId);
    if (pseudo === undefined) continue;
    sortie.push({ joueurId, ligne: ligneEnAttente(pseudo, siennes, noms) });
  }
  return sortie;
}
