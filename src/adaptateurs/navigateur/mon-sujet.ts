/// <reference lib="dom" />
// ════════════════════════════════════════════════════════════════════
//  src/adaptateurs/navigateur/mon-sujet.ts
//
//  COUVERT PAR : outils/sujet.mjs — le récapitulatif se pose, montre
//  l'équipe et le combat, et disparaît hors d'une zone sauvage.
//
//  Où en est le joueur dans ce sujet : son équipe avec les PV du
//  sujet, et le combat ouvert s'il y en a un (migration 0054).
//
//  ── POURQUOI PAS `mon_combat` ───────────────────────────────────────
//
//  `mon_combat` rend `null` quand il n'y a pas de combat, et c'est ce
//  qu'il faut à la barre d'actions. Le récapitulatif montre l'équipe
//  dans TOUS les cas — un sujet sans combat est le cas ordinaire, et
//  c'est même là qu'on regarde son équipe avant de faire apparaître
//  quelque chose.
//
//  ── TOUT EST RELU, ET UNE LIGNE ABÎMÉE EST JETÉE ────────────────────
//
//  Pas la réponse entière : un Pokémon dont il manque les PV ne doit
//  pas faire disparaître les cinq autres. C'est la règle de
//  `src/navigateur/bilan.ts` — « un joueur qui perd une ligne le
//  signale ; un joueur devant une page blanche croit que le forum est
//  cassé ».
// ════════════════════════════════════════════════════════════════════

import { type ConfigSupabase } from "./registre.ts";
import { avecLeLaissez, type Rouages } from "./laissez-utilisable.ts";
import type {
  CombatDuRecap,
  CombatFini,
  LigneDuSac,
  MembreDuRecap,
  MonSujet,
} from "../../navigateur/recap.ts";

export type { Rouages };

function nombre(o: Record<string, unknown>, clef: string): number | null {
  const v = o[clef];
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function texte(o: Record<string, unknown>, clef: string): string | null {
  const v = o[clef];
  return typeof v === "string" && v !== "" ? v : null;
}

function lireUnMembre(brut: unknown): MembreDuRecap | null {
  if (brut === null || typeof brut !== "object") return null;
  const o = brut as Record<string, unknown>;
  const especeId = nombre(o, "especeId");
  const niveau = nombre(o, "niveau");
  const pv = nombre(o, "pv");
  const pvMax = nombre(o, "pvMax");
  const nom = texte(o, "nom");
  if (especeId === null || niveau === null || pv === null || pvMax === null) return null;
  if (nom === null) return null;
  return {
    //  LA CASE PEUT ÊTRE NULLE : la base l'autorise pour un Pokémon
    //  d'équipe sans position, et elle ne sert ici qu'à l'ordre.
    position: nombre(o, "position"),
    especeId,
    nom,
    surnom: texte(o, "surnom"),
    niveau,
    pv,
    pvMax,
    combat: o.combat === true,
  };
}

function lireLeCombat(brut: unknown): CombatDuRecap | null {
  if (brut === null || typeof brut !== "object") return null;
  const o = brut as Record<string, unknown>;
  const tour = nombre(o, "tour");
  const s = o.sauvage;
  if (tour === null || s === null || typeof s !== "object") return null;
  const sv = s as Record<string, unknown>;
  const especeId = nombre(sv, "especeId");
  const niveau = nombre(sv, "niveau");
  const pv = nombre(sv, "pv");
  const pvMax = nombre(sv, "pvMax");
  const nom = texte(sv, "nom");
  if (especeId === null || niveau === null || pv === null || pvMax === null) return null;
  if (nom === null) return null;
  return {
    tour,
    sauvage: {
      especeId,
      nom,
      niveau,
      types: Array.isArray(sv.types) ? sv.types.filter((x) => typeof x === "string") : [],
      pv,
      pvMax,
    },
    //  LES DEUX SONT NULS ENSEMBLE quand l'équipe est vide : la
    //  rencontre reste une rencontre, et la ball se lance quand même.
    pvPokemon: nombre(o, "pvPokemon"),
    pvPokemonMax: nombre(o, "pvPokemonMax"),
  };
}

/*  LES CINQ FINS QUE LA BASE ÉCRIT, et pas une de plus. `combat.etat`
    les borne par une contrainte `check` depuis la 0046 ; une sixième
    arriverait d'une version du serveur plus récente que ce paquet, et
    on la saute plutôt que de dessiner un bloc sans titre. */
const FINS = ["capture", "fuite", "victoire", "defaite", "expire"] as const;

/** Le dernier combat clos, ou `null` si la base n'en rend pas.
 *
 *  ── UN LECTEUR QUI VALIDE DOIT APPRENDRE CHAQUE CLÉ ─────────────────
 *
 *  `lireMonSujet` reconstruit l'objet champ par champ, exprès : une
 *  réponse abîmée doit se réduire à ce qui est lisible, pas traverser
 *  telle quelle. Le revers, c'est qu'une clé neuve en base reste
 *  invisible tant que personne ne l'a lue ici — et c'est exactement ce
 *  que le harnais a attrapé le 23 novembre : la 0069 rendait `fini`,
 *  le domaine savait en faire un bloc, et il n'arrivait jamais. */
function lireLaFin(brut: unknown): CombatFini | null {
  if (brut === null || typeof brut !== "object") return null;
  const o = brut as Record<string, unknown>;
  const etat = FINS.find((f) => f === o.etat);
  const especeId = nombre(o, "especeId");
  const niveau = nombre(o, "niveau");
  const nom = texte(o, "nom");
  if (etat === undefined || especeId === null || niveau === null || nom === null) {
    return null;
  }
  return {
    etat,
    especeId,
    nom,
    niveau,
    types: Array.isArray(o.types) ? o.types.filter((x) => typeof x === "string") : [],
  };
}

/** Une ligne du sac, ou `null` si elle n'est pas lisible.
 *
 *  AUSSI STRICT QUE POUR UN MEMBRE D'ÉQUIPE, et pour la même raison :
 *  une ligne à moitié lue afficherait « undefined × NaN » dans le
 *  panneau. Mieux vaut une ligne de moins qu'une ligne fausse. */
function lireUnObjet(brut: unknown): LigneDuSac | null {
  if (brut === null || typeof brut !== "object") return null;
  const o = brut as Record<string, unknown>;
  const objetId = nombre(o, "objetId");
  const quantite = nombre(o, "quantite");
  const nom = texte(o, "nom");
  const famille = texte(o, "famille");
  if (objetId === null || quantite === null || nom === null || famille === null) return null;
  return { objetId, nom, famille, quantite };
}

export function lireMonSujet(brut: unknown): MonSujet | null {
  if (brut === null || typeof brut !== "object") return null;
  const o = brut as Record<string, unknown>;
  const equipe: MembreDuRecap[] = [];
  for (const m of Array.isArray(o.equipe) ? o.equipe : []) {
    const lu = lireUnMembre(m);
    if (lu !== null) equipe.push(lu);
  }
  //  ── LE SAC EST FACULTATIF, ET C'EST VOULU ───────────────────────
  //
  //  La migration qui l'ajoute (0057) peut ne pas être déployée quand
  //  ce code l'est : `supabase db push` et `git push` sont deux
  //  gestes, et ils ne se font pas à la même seconde. Un lecteur qui
  //  exigerait le sac rendrait `null` — donc effacerait aussi
  //  l'équipe et le combat, qui, eux, sont bien là.
  const sac: LigneDuSac[] = [];
  for (const l of Array.isArray(o.sac) ? o.sac : []) {
    const lu = lireUnObjet(l);
    if (lu !== null) sac.push(lu);
  }
  return { equipe, combat: lireLeCombat(o.combat), sac, fini: lireLaFin(o.fini) };
}

/** Où en est le joueur dans ce sujet, ou `null`.
 *
 *  `null` couvre tout : pas de laissez-passer, réseau en panne,
 *  visiteur déconnecté. Le récapitulatif ne se pose alors pas. */
export async function monSujet(
  sujetId: number,
  acces: ConfigSupabase,
  r: Rouages = {},
): Promise<MonSujet | null> {
  return lireMonSujet(await avecLeLaissez(acces, "mon_sujet", { sujetId }, r));
}
