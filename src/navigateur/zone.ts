// ════════════════════════════════════════════════════════════════════
//  src/navigateur/zone.ts
//
//  Où sommes-nous, et qu'est-ce qu'on peut y faire ?
//
//  LA RÈGLE 4 DE LA PLANCHE 45 : « il n'existe que dans les zones
//  sauvages ». Le module de bilan, et avec lui la barre d'actions, ne se
//  chargent que dans les dix-sept zones. Partout ailleurs — villes,
//  arènes, colosseums, flood, archives — il ne se passe rien.
//
//  CE N'EST PAS UNE COQUETTERIE. « Fouiller la zone » dans le forum de
//  flood écrirait un bloc que la relève ne lira jamais, puisqu'elle ne
//  parcourt que les zones sauvages. Le joueur cliquerait, rien ne se
//  produirait, et il n'aurait aucun moyen de comprendre pourquoi.
//
//  Que des règles ici : le fil d'Ariane et le réseau sont dans
//  `adaptateurs/navigateur/`.
// ════════════════════════════════════════════════════════════════════

import { cleDeLieu } from "../domaine/lieu.ts";

/** Une zone sauvage, telle que `data/zones.json` la décrit. On ne reprend
 *  que ce dont le navigateur se sert : le reste du fichier est pour le
 *  serveur. */
export type ZoneDuNavigateur = {
  readonly forumId: number;
  readonly nom: string;
  readonly palier: 1 | 2 | 3;
};

/** Un lieu, prêt pour un menu : son nom tel qu'on l'écrit, et la clé que
 *  le bloc d'action portera. */
export type LieuChoisissable = {
  readonly nom: string;
  readonly cle: string;
};

function estUnPalier(v: unknown): v is 1 | 2 | 3 {
  return v === 1 || v === 2 || v === 3;
}

/**
 * Lit `data/zones.json` **sans rien croire**.
 *
 * Le fichier est servi par un CDN et traverse une branche git : une
 * version abîmée ne doit pas faire disparaître la barre partout, ni la
 * faire apparaître là où elle n'a rien à faire. Une entrée mal formée est
 * donc ignorée, pas devinée, et les autres passent.
 */
export function zonesDepuis(donnees: unknown): readonly ZoneDuNavigateur[] {
  if (typeof donnees !== "object" || donnees === null) return [];
  const brut = (donnees as Record<string, unknown>).zones;
  if (!Array.isArray(brut)) return [];

  const zones: ZoneDuNavigateur[] = [];
  for (const entree of brut) {
    if (typeof entree !== "object" || entree === null) continue;
    const z = entree as Record<string, unknown>;
    if (typeof z.forumId !== "number" || !Number.isInteger(z.forumId)) continue;
    if (typeof z.nom !== "string" || z.nom === "") continue;
    if (!estUnPalier(z.palier)) continue;
    zones.push({ forumId: z.forumId, nom: z.nom, palier: z.palier });
  }
  return zones;
}

/** La zone d'un forum, ou null si ce forum n'est pas une zone sauvage.
 *  `null` est la réponse NORMALE : il y a bien plus de forums que de
 *  zones. */
export function zoneDe(
  forumId: number | null,
  zones: readonly ZoneDuNavigateur[],
): ZoneDuNavigateur | null {
  if (forumId === null) return null;
  return zones.find((z) => z.forumId === forumId) ?? null;
}

/**
 * Les lieux d'une zone, lus dans `data/faune/<forumId>.json`, triés et
 * prêts pour un menu.
 *
 * **Triés par nom, et pas dans l'ordre du fichier.** L'ordre du fichier
 * est celui des annexes, qui suit la géographie ; un joueur qui cherche
 * « Berge Est » dans une liste de quinze entrées la trouve plus vite par
 * ordre alphabétique. On trie avec `localeCompare` : sans lui, « Étang »
 * passe après « Zone ».
 *
 * Deux lieux de la même zone n'ont jamais la même clé — vérifié sur les
 * 145 lieux le 2 octobre. Si ça arrivait quand même, on garde le premier
 * plutôt que d'offrir deux entrées indistinguables.
 */
export function lieuxDepuis(donnees: unknown): readonly LieuChoisissable[] {
  if (typeof donnees !== "object" || donnees === null) return [];
  const lieux = (donnees as Record<string, unknown>).lieux;
  if (typeof lieux !== "object" || lieux === null || Array.isArray(lieux)) return [];

  const vus = new Set<string>();
  const sortie: LieuChoisissable[] = [];
  for (const nom of Object.keys(lieux)) {
    if (nom === "") continue;
    const cle = cleDeLieu(nom);
    if (cle === "" || vus.has(cle)) continue;
    vus.add(cle);
    sortie.push({ nom, cle });
  }
  return sortie.sort((a, b) => a.nom.localeCompare(b.nom, "fr"));
}
