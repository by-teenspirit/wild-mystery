/// <reference lib="dom" />
// ════════════════════════════════════════════════════════════════════
//  src/adaptateurs/navigateur/mon-combat.ts
//
//  COUVERT PAR : outils/barre.mjs — la barre bascule en combat, sert
//  les cinq boutons, et un sujet sans combat garde les quatre autres.
//
//  Le combat ouvert du sujet, lu avec le laissez-passer du joueur.
//
//  ── POURQUOI LE LAISSEZ-PASSER ET PAS LA CLÉ DE CARNET ──────────────
//
//  `mon_combat` rend l'ÉQUIPE et le SAC. C'est privé, donc il faut une
//  identité — et sur une page de sujet, l'identité du joueur est son
//  laissez-passer : `appelerAvecLeJeton` met son jeton dans
//  `Authorization`, PostgreSQL voit `authenticated`, et
//  `joueur_courant()` rend son identifiant. C'est ce que les neuf
//  politiques de lecture utilisent depuis la `0001`.
//
//  La clé de carnet, elle, sert aux politiques des tables que la relève
//  lit. Deux chemins d'identification pour la même question seraient
//  deux façons de se tromper.
//
//  ── SILENCE SUR TOUT REFUS ──────────────────────────────────────────
//
//  Même règle que `dex-du-joueur.ts` : cette lecture est un BONUS sur
//  une page publique. Pas de laissez-passer, pas de réseau, pas de
//  combat — la barre sert ses quatre boutons habituels et personne ne
//  lit une phrase sur un combat qu'il n'a pas. Les refus partent dans
//  la console et nulle part ailleurs.
// ════════════════════════════════════════════════════════════════════

import { type ConfigSupabase } from "./registre.ts";
import { avecLeLaissez, type Rouages } from "./laissez-utilisable.ts";
import type { DonneesDeCombat } from "./barre-d-actions.ts";

export type { Rouages };

function nombre(o: Record<string, unknown>, clef: string): number | null {
  const v = o[clef];
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

/** Ce que la barre affiche, relu depuis la réponse.
 *
 *  ON RELIT, ET ON REND `null` AU PREMIER MANQUE. Un menu qui
 *  afficherait « undefined — undefined, undefined » est pire qu'un
 *  menu absent : le joueur cliquerait, enverrait un bloc abîmé, et la
 *  relève le refuserait sans qu'il comprenne pourquoi. */
export function lireMonCombat(brut: unknown): DonneesDeCombat | null {
  if (brut === null || typeof brut !== "object") return null;
  const o = brut as Record<string, unknown>;

  const capacites: DonneesDeCombat["capacites"][number][] = [];
  for (const c of Array.isArray(o.capacites) ? o.capacites : []) {
    const k = c as Record<string, unknown>;
    const id = nombre(k, "id");
    const puissance = nombre(k, "puissance");
    if (id === null || puissance === null) return null;
    if (typeof k.nom !== "string" || typeof k.type !== "string") return null;
    capacites.push({ id, nom: k.nom, type: k.type, puissance });
  }

  const equipe: DonneesDeCombat["equipe"][number][] = [];
  for (const m of Array.isArray(o.equipe) ? o.equipe : []) {
    const k = m as Record<string, unknown>;
    const pv = nombre(k, "pv");
    const pvMax = nombre(k, "pvMax");
    if (pv === null || pvMax === null || typeof k.nom !== "string") return null;
    equipe.push({
      //  LA CASE PEUT ÊTRE NULLE : la base l'autorise, et la barre
      //  laisse ces Pokémon hors du menu — on ne clique pas sur une
      //  case qui n'a pas de numéro.
      position: nombre(k, "position"),
      nom: k.nom,
      surnom: typeof k.surnom === "string" && k.surnom.trim() !== "" ? k.surnom : null,
      pv,
      pvMax,
      combat: k.combat === true,
    });
  }

  const sac: DonneesDeCombat["sac"][number][] = [];
  for (const x of Array.isArray(o.sac) ? o.sac : []) {
    const k = x as Record<string, unknown>;
    const objetId = nombre(k, "objetId");
    const quantite = nombre(k, "quantite");
    if (objetId === null || quantite === null) return null;
    if (typeof k.nom !== "string" || typeof k.famille !== "string") return null;
    sac.push({ objetId, nom: k.nom, famille: k.famille, quantite });
  }

  return { capacites, equipe, sac };
}

/** Le combat ouvert du sujet, ou `null`.
 *
 *  `null` couvre tout : pas de laissez-passer, réseau en panne, aucun
 *  combat, ou un combat qui n'est pas le sien — la base rend `null`
 *  dans ce dernier cas, et c'est elle qui tranche, pas nous. */
export async function monCombat(
  sujetId: number,
  acces: ConfigSupabase,
  r: Rouages = {},
): Promise<DonneesDeCombat | null> {
  return lireMonCombat(await avecLeLaissez(acces, "mon_combat", { sujetId }, r));
}
