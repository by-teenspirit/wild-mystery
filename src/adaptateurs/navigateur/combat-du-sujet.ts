/// <reference lib="dom" />
// ════════════════════════════════════════════════════════════════════
//  src/adaptateurs/navigateur/combat-du-sujet.ts
//
//  COUVERT PAR : combat-du-sujet.test.ts pour la lecture, et
//  outils/barre.mjs pour ce que la barre en fait.
//
//  « Y a-t-il un combat ouvert dans ce sujet ? » — SANS IDENTITÉ.
//
//  ── POURQUOI UNE SECONDE LECTURE À CÔTÉ DE `mon_combat` ─────────────
//
//  `mon_combat` rend l'équipe et le sac, donc il demande le
//  laissez-passer. La barre s'en servait aussi pour SAVOIR s'il y
//  avait un combat — et le jour où le laissez-passer manquait, elle
//  n'affichait pas « Fuir ». Un combat ouvert devenait une impasse :
//  chaque nouvelle demande se faisait refuser, la carte revenait, et
//  rien dans la page ne permettait d'en sortir.
//
//  LES DEUX QUESTIONS SONT DISTINCTES, et une seule est privée :
//
//    · « un combat tourne-t-il ici ? »  — déjà affiché dans le sujet,
//                                         donc public ;
//    · « avec quoi peux-tu agir ? »     — son sac, donc privé.
//
//  `combat_du_sujet` répond à la première, elle est accordée à `anon`
//  depuis la `0047`, et son commentaire disait déjà à quoi elle
//  servait : « sert à la barre d'actions pour choisir ses boutons ».
//  C'est le branchement qui manquait, pas la fonction.
//
//  ── CE QU'ON N'EN GARDE PAS ─────────────────────────────────────────
//
//  La fonction rend aussi l'espèce, les PV et le tour. Rien ici n'en a
//  besoin : la carte du Maître du Jeu les affiche déjà dans le sujet,
//  et les recopier dans la barre ferait deux endroits à tenir
//  d'accord. On ne garde que l'identifiant — la preuve qu'un combat
//  est là.
//
//  ── SILENCE SUR TOUT REFUS ──────────────────────────────────────────
//
//  Même règle que `mon-combat.ts` : réseau en panne, refus de la base,
//  réponse vide — `null`, et la barre garde ses boutons habituels.
// ════════════════════════════════════════════════════════════════════

import { type ConfigSupabase } from "./registre.ts";

/** Ce qu'on retient : un combat est ouvert ici, et voici lequel. */
export type CombatOuvert = { readonly combatId: string };

/** Relit la réponse, et rend `null` au premier doute.
 *
 *  `combatId` EST LA SEULE CHOSE EXIGÉE. La fonction SQL rend `null`
 *  quand aucun combat n'est ouvert — mais une réponse abîmée, elle,
 *  pourrait être un objet sans identifiant, et un combat sans
 *  identifiant n'est pas un combat. */
export function lireLeCombatDuSujet(brut: unknown): CombatOuvert | null {
  if (brut === null || typeof brut !== "object") return null;
  const id = (brut as Record<string, unknown>).combatId;
  if (typeof id !== "string" || id.trim() === "") return null;
  return { combatId: id };
}

type Appel = (url: string, init: RequestInit) => Promise<unknown>;

/** Le combat ouvert du sujet, lu avec la clé publiable et rien
 *  d'autre.
 *
 *  PAS DE `credentials`, PAS DE JETON PERSONNEL. C'est une lecture
 *  publique : l'ajouter ferait croire que la réponse dépend de qui
 *  demande, et elle n'en dépend pas. */
export async function combatDuSujet(
  sujetId: number,
  acces: ConfigSupabase,
  appeler: Appel = (url, init) => fetch(url, init),
): Promise<CombatOuvert | null> {
  try {
    const reponse = await appeler(`${acces.url}/rest/v1/rpc/combat_du_sujet`, {
      method: "POST",
      credentials: "omit",
      headers: {
        "apikey": acces.clePubliable,
        "Authorization": `Bearer ${acces.clePubliable}`,
        "Content-Type": "application/json",
        "Accept": "application/json",
      },
      body: JSON.stringify({ p: { sujetId } }),
    });
    if (!(reponse instanceof Response)) return lireLeCombatDuSujet(reponse);
    if (!reponse.ok) return null;
    return lireLeCombatDuSujet(await reponse.json());
  } catch (e) {
    console.warn("wild-mystery : combat_du_sujet", e);
    return null;
  }
}
