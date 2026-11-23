/// <reference lib="dom" />
// ════════════════════════════════════════════════════════════════════
//  src/adaptateurs/navigateur/laissez-utilisable.ts
//
//  COUVERT PAR : outils/barre.mjs — la barre bascule en combat par ce
//  chemin, avec un vrai laissez-passer dans `localStorage` et le vrai
//  paquet livré. Et par outils/sujet.mjs, pour le récapitulatif.
//
//  Le laissez-passer du joueur, rafraîchi si besoin, ou `null`.
//
//  ── POURQUOI IL EST SORTI DE `mon-combat.ts` LE 18 NOVEMBRE ─────────
//
//  Il y était écrit en double avec `dex-du-joueur.ts`, et le
//  commentaire de `mon-combat.ts` défendait ce doublon :
//
//      « Les mêmes gestes que dans `dex-du-joueur.ts`, et pas
//      partagés pour la même raison qu'eux : là-bas un refus n'a
//      aucune suite, ici non plus, mais dans `js/carnet.ts` il ouvre
//      le formulaire de liaison. Une fonction commune devrait rendre
//      la RAISON du refus, que ces deux-là jetteraient. »
//
//  L'argument tenait à deux. À TROIS, il ne tient plus : le
//  récapitulatif latéral fait exactement les mêmes gestes, et une
//  troisième copie voudrait dire trois endroits où corriger le jour
//  où le rafraîchissement change.
//
//  ET LA RAISON DU REFUS N'EST TOUJOURS PAS RENDUE, volontairement :
//  les trois appelants la jetteraient. `js/carnet.ts` garde sa propre
//  version, celle qui distingue « pas de laissez-passer » de
//  « rafraîchissement refusé », parce que lui en fait quelque chose.
//
//  ── SILENCE SUR TOUT REFUS ──────────────────────────────────────────
//
//  Ces lectures sont des BONUS sur une page publique. Pas de
//  laissez-passer, pas de réseau, pas de bonus — et personne ne lit
//  un message d'erreur pour une chose qu'il n'avait pas demandée.
// ════════════════════════════════════════════════════════════════════

import { type ConfigSupabase } from "./registre.ts";
import type { Laissez } from "../../navigateur/session-de-jeu.ts";
import { appelerAvecLeJeton, rafraichir } from "./auth-supabase.ts";
import { garderLeLaissez, lireLeLaissez, oublierLeLaissez } from "./laissez-garde.ts";
import { encoreBon } from "../../navigateur/session-de-jeu.ts";

export type Rouages = {
  readonly lire?: () => Laissez | null;
  readonly garder?: (l: Laissez) => void;
  readonly oublier?: () => void;
  readonly maintenant?: () => number;
  readonly rafraichirLe?: typeof rafraichir;
  readonly appeler?: typeof appelerAvecLeJeton;
};

export async function laissezUtilisable(
  r: Rouages,
  acces: ConfigSupabase,
): Promise<Laissez | null> {
  const garde = (r.lire ?? lireLeLaissez)();
  if (garde === null) return null;
  const quand = (r.maintenant ?? Date.now)();
  if (encoreBon(garde, quand)) return garde;
  const neuf = await (r.rafraichirLe ?? rafraichir)(acces, garde.rafraichir, quand)
    .catch(() => null);
  if (neuf === null) {
    (r.oublier ?? oublierLeLaissez)();
    return null;
  }
  (r.garder ?? garderLeLaissez)(neuf);
  return neuf;
}

/** Appelle une fonction SQL avec le laissez-passer, et rend
 *  `undefined` à la moindre difficulté.
 *
 *  L'`undefined` COUVRE TOUT CE QUI A ÉCHOUÉ : pas de laissez-passer,
 *  réseau en panne, refus de la base, réponse illisible. L'appelant ne
 *  pose simplement pas son bonus.
 *
 *  ── POURQUOI `undefined` ET PLUS `null`, DEPUIS LE 23 NOVEMBRE ──────
 *
 *  `null` est une RÉPONSE que plusieurs de ces fonctions donnent
 *  vraiment : `mon_combat` le rend quand aucun combat ne concerne le
 *  joueur, `defi_du_sujet` quand aucun défi n'est ouvert. Le rendre
 *  aussi pour un refus mettait les deux dans le même mot.
 *
 *  Ça ne gênait personne tant que les appelants traitaient les deux
 *  pareil — et c'était le cas de `mon_sujet` et `mon_combat`, qui ne
 *  posent rien dans les deux cas. `defi_du_sujet` est le premier à
 *  devoir les séparer : « il n'y a pas de défi » offre le bouton
 *  « Défier », « je n'ai pas pu lire » ne doit rien offrir. Sans la
 *  distinction, un joueur sans laissez-passer se voyait proposer de
 *  défier dans un sujet portant déjà un défi, et la relève refusait.
 *
 *  LES DEUX AUTRES APPELANTS NE CHANGENT PAS : ils passent le résultat
 *  à un `lire…` qui refuse tout ce qui n'est pas un objet, et
 *  `undefined` n'en est pas plus un que `null`. */
export async function avecLeLaissez(
  acces: ConfigSupabase,
  fonction: string,
  corps: Record<string, unknown>,
  r: Rouages = {},
): Promise<unknown> {
  const laissez = await laissezUtilisable(r, acces);
  if (laissez === null) return undefined;
  try {
    const reponse = await (r.appeler ?? appelerAvecLeJeton)(
      acces,
      laissez.jeton,
      fonction,
      corps,
    );
    if (!reponse.ok) return undefined;
    return await reponse.json();
  } catch (e) {
    console.warn(`wild-mystery : ${fonction}`, e);
    return undefined;
  }
}
