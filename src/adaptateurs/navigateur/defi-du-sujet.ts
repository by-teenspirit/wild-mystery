/// <reference lib="dom" />
// ════════════════════════════════════════════════════════════════════
//  src/adaptateurs/navigateur/defi-du-sujet.ts
//
//  COUVERT PAR : defi-du-sujet.test.ts pour la lecture, et
//  outils/barre.mjs pour ce que la barre en fait.
//
//  « Y a-t-il un défi ouvert dans ce sujet, et est-il de moi ? »
//
//  ── POURQUOI AVEC LE LAISSEZ-PASSER, ALORS QUE LE DÉFI EST PUBLIC ───
//
//  `defi_du_sujet` est accordée à `anon` — un défi est fait pour être
//  vu par l'autre, et son commentaire le dit. MAIS ELLE REND `aMoi`,
//  et `aMoi` demande de savoir qui demande : sans identité,
//  `joueur_id = joueur_courant()` vaut `null`, pas `false`.
//
//  Or `aMoi` est ce qui décide du bouton : un défi de soi n'offre rien
//  (on n'accepte pas son propre défi), un défi d'un autre offre
//  « Accepter ». Lire sans identité donnerait « Accepter » au défieur
//  lui-même, et la base refuserait — `combat_pas_contre_soi`.
//
//  On passe donc par `avecLeLaissez`, comme `mon_combat`. Même refus,
//  même silence.
//
//  ── TROIS RÉPONSES, PAS DEUX ────────────────────────────────────────
//
//  C'est tout l'objet de ce fichier, et c'est `EtatDuDefi` :
//
//    · `{ ouvert: false }` — on a lu, il n'y a pas de défi → la barre
//                            offre « Défier » ;
//    · `{ ouvert: true, … }` — on a lu, il y en a un ;
//    · `null`              — ON N'A PAS PU LIRE.
//
//  LE TROISIÈME N'EST PAS LE PREMIER, et les confondre serait un bug
//  qui se voit mal : sans laissez-passer, la barre offrirait « Défier »
//  sur un sujet portant déjà un défi, et la relève refuserait — un
//  seul défi ouvert par sujet (0060). On échoue donc FERMÉ : pas de
//  réponse, pas de bouton.
// ════════════════════════════════════════════════════════════════════

import { type ConfigSupabase } from "./registre.ts";
import { avecLeLaissez, type Rouages } from "./laissez-utilisable.ts";
import type { EtatDuDefi } from "./barre-d-actions.ts";

export type { Rouages };

/** Relit la réponse de `defi_du_sujet`.
 *
 *  `undefined` DIT « JE N'AI PAS LU », et c'est ce que `avecLeLaissez`
 *  rend sur un refus. `null`, lui, est la réponse de la fonction SQL
 *  quand aucun défi n'est ouvert — une vraie information.
 *
 *  LE `defiId` EST EXIGÉ pour un défi ouvert : une réponse abîmée
 *  pourrait être un objet sans identifiant, et un défi sans
 *  identifiant n'est pas un défi. On préfère ne rien offrir. */
export function lireLeDefiDuSujet(brut: unknown): EtatDuDefi | null {
  //  AUCUN DÉFI : la fonction rend `null`, et c'est une réponse.
  if (brut === null) return { ouvert: false };
  if (typeof brut !== "object") return null;
  const o = brut as Record<string, unknown>;
  const id = o.defiId;
  if (typeof id !== "string" || id.trim() === "") return null;
  //  `aMoi` DOIT ÊTRE UN BOOLÉEN. Sans identité la base rend `null`,
  //  et on ne devine pas : un `aMoi` qu'on lirait comme `false`
  //  offrirait « Accepter » au défieur lui-même.
  if (typeof o.aMoi !== "boolean") return null;
  return { ouvert: true, aMoi: o.aMoi };
}

/** Le défi ouvert du sujet, ou `null` si on n'a pas pu lire.
 *
 *  `avecLeLaissez` rend `undefined` sur tout refus — pas de
 *  laissez-passer, réseau en panne, base qui refuse. On le traduit en
 *  `null`, l'absence de réponse. */
export async function defiDuSujet(
  sujetId: number,
  acces: ConfigSupabase,
  r: Rouages = {},
): Promise<EtatDuDefi | null> {
  const brut = await avecLeLaissez(acces, "defi_du_sujet", { sujetId }, r);
  return brut === undefined ? null : lireLeDefiDuSujet(brut);
}
