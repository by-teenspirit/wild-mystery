// ════════════════════════════════════════════════════════════════════
//  src/adaptateurs/navigateur/dex-du-joueur.ts
//
//  CE QUE LE JOUEUR A DÉJÀ VU ET CE QU'IL A DÉJÀ PRIS, sur une page
//  qui n'est pas son carnet.
//
//  « Affiche le numéro du pokémon + une icône si on l'a déjà vu ou si
//  on l'a dans notre pokedex, c'est possible ça ? » (5 novembre)
//
//  Oui, et sans rien ajouter côté serveur — c'est le fond de ce
//  fichier. Tout ce dont une page d'annexe a besoin existe déjà :
//
//    · le laissez-passer, rangé dans le navigateur quand la personne a
//      lié son compte depuis le carnet. Il vaut pour tout le site ;
//    · `profilQuiRegarde`, qui demande au forum, sur la même origine,
//      QUI regarde — l'annexe est servie sans l'en-tête du forum, donc
//      sans `_userdata`, exactement comme le carnet ;
//    · `carnet_de_la_session`, qui ne rend que les personnages de
//      cette connexion-là, et dont les droits sont déjà écrits.
//
//  AUCUNE NOUVELLE FONCTION SQL, AUCUNE NOUVELLE POLITIQUE. Une
//  fonction « rien que le pokédex » aurait été plus légère sur le
//  réseau et plus lourde partout ailleurs : une migration, une règle
//  de droits de plus à relire, et une seconde définition de « qui a le
//  droit de lire quoi ». Le carnet entier fait quelques kilo-octets.
//
//  ── UN INVITÉ NE DÉCLENCHE RIEN DU TOUT ─────────────────────────────
//
//  Le laissez-passer est lu EN PREMIER, et dans le navigateur. Absent,
//  on rend `null` sans avoir rien demandé à personne : ni au forum, ni
//  à Supabase. C'est le cas de la majorité des gens qui liront
//  l'annexe, et ils ne doivent pas payer une seconde de réseau pour une
//  marque qu'ils ne verraient pas.
//
//  ── ET `null` NE VEUT PAS DIRE « RIEN VU » ──────────────────────────
//
//  Il veut dire « on ne sait pas » : pas de laissez-passer, forum muet,
//  base qui refuse, personnage pas encore validé. Dans tous ces cas la
//  carte ne montre AUCUNE marque — ni « vu », ni « jamais vu ». Une
//  carte muette est honnête ; une carte marquée « jamais vu » sur un
//  pokédex qu'on n'a pas réussi à lire est un mensonge, et c'est celui
//  qui ferait repartir quelqu'un à la chasse d'une espèce qu'il a déjà.
// ════════════════════════════════════════════════════════════════════

import {
  type EtatDEspece,
  etatsParEspece,
  type LignePokedex,
} from "../../navigateur/carnet.ts";
import { encoreBon, type Laissez } from "../../navigateur/session-de-jeu.ts";
import { appelerAvecLeJeton, rafraichir } from "./auth-supabase.ts";
import { garderLeLaissez, lireLeLaissez, oublierLeLaissez } from "./laissez-garde.ts";
import { type ConfigSupabase } from "./registre.ts";
import { demandeurDuNavigateur, profilQuiRegarde } from "./compte-du-forum.ts";

/** Les pièces dont la lecture a besoin. Injectées pour que ça se teste
 *  sans navigateur, sans forum et sans Supabase. */
export type Rouages = {
  /** L'accès à Supabase, ou `null` si `supabase.json` n'est pas venu. */
  readonly acces: ConfigSupabase | null;
  /** Le laissez-passer rangé dans ce navigateur. */
  readonly lire?: () => Laissez | null;
  readonly garder?: (l: Laissez) => void;
  readonly oublier?: () => void;
  readonly rafraichirLe?: typeof rafraichir;
  /** Qui regarde la page, côté forum. */
  readonly qui?: () => Promise<{ readonly compte: { readonly id: number } | null }>;
  readonly appeler?: typeof appelerAvecLeJeton;
  readonly maintenant?: () => number;
};

/** Le relevé tel que `carnet_de_la_session` le rend. On n'en lit qu'un
 *  champ : le reste du carnet ne regarde pas cette page. */
type ReponseDuCarnet = { readonly pokedex?: unknown };

/** Les lignes de pokédex d'une réponse, ou `[]`.
 *
 *  ON NE FAIT PAS CONFIANCE À LA FORME. La réponse traverse PostgREST
 *  et un `JSON.parse`, et une page qui plante sur un champ manquant
 *  perdrait la carte entière pour une marque. */
function lignesDe(brut: unknown): LignePokedex[] {
  if (brut === null || typeof brut !== "object") return [];
  const liste = (brut as ReponseDuCarnet).pokedex;
  if (!Array.isArray(liste)) return [];
  const propres: LignePokedex[] = [];
  for (const l of liste) {
    if (l === null || typeof l !== "object") continue;
    const o = l as Record<string, unknown>;
    if (typeof o.especeId !== "number" || !Number.isInteger(o.especeId)) continue;
    propres.push({
      especeId: o.especeId,
      croiseLe: typeof o.croiseLe === "string" ? o.croiseLe : null,
      attrapeLe: typeof o.attrapeLe === "string" ? o.attrapeLe : null,
      fois: typeof o.fois === "number" ? o.fois : 0,
    });
  }
  return propres;
}

/** Le laissez-passer utilisable, rafraîchi si besoin.
 *
 *  C'EST LA MÊME SUITE DE GESTES QUE DANS `js/carnet.ts`, et elle n'est
 *  pas partagée exprès : là-bas un laissez-passer mort ouvre le
 *  formulaire de liaison et le dit à l'écran ; ici il ne se passe rien
 *  du tout. Mettre les deux dans une fonction commune l'obligerait à
 *  rendre la raison du refus, que l'annexe jetterait. */
async function laissezUtilisable(r: Rouages, acces: ConfigSupabase): Promise<Laissez | null> {
  const lire = r.lire ?? lireLeLaissez;
  const garde = lire();
  if (garde === null) return null;
  const quand = (r.maintenant ?? Date.now)();
  if (encoreBon(garde, quand)) return garde;
  const neuf = await (r.rafraichirLe ?? rafraichir)(acces, garde.rafraichir, quand)
    .catch(() => null);
  if (neuf === null) {
    //  UN LAISSEZ-PASSER MORT S'OUBLIE, même ici : le garder ferait
    //  retenter un rafraîchissement voué à l'échec à chaque page.
    (r.oublier ?? oublierLeLaissez)();
    return null;
  }
  (r.garder ?? garderLeLaissez)(neuf);
  return neuf;
}

/**
 * Ce que le joueur a vu et pris, par identifiant d'espèce.
 *
 * `null` DÈS QUE QUELQUE CHOSE MANQUE, et sans bruit : cette lecture
 * est un bonus sur une page publique, pas une fonction de la page. Les
 * refus partent dans la console et nulle part ailleurs — un invité n'a
 * pas à lire une phrase sur un carnet qu'il n'a pas.
 */
export async function dexDuJoueur(
  r: Rouages,
): Promise<ReadonlyMap<number, EtatDEspece> | null> {
  if (r.acces === null) return null;

  //  LE NAVIGATEUR D'ABORD, LE RÉSEAU ENSUITE. Pas de laissez-passer,
  //  pas d'appel : voir l'en-tête.
  const laissez = await laissezUtilisable(r, r.acces).catch(() => null);
  if (laissez === null) return null;

  let compte;
  try {
    const profil = await (r.qui ?? (() => profilQuiRegarde(demandeurDuNavigateur())))();
    compte = profil.compte;
  } catch {
    //  LE FORUM N'A PAS RÉPONDU. On ne sait pas qui regarde, donc on ne
    //  marque rien.
    return null;
  }
  if (compte === null) return null;

  const reponse = await (r.appeler ?? appelerAvecLeJeton)(
    r.acces,
    laissez.jeton,
    "carnet_de_la_session",
    { forumUserId: compte.id },
  ).catch(() => null);
  if (reponse === null || !reponse.ok) {
    console.error("wm/dex : la base a refusé le carnet —", reponse?.status);
    return null;
  }
  const brut = await reponse.json().catch(() => null);
  //  `null` EST UNE VRAIE RÉPONSE : la base dit « aucun personnage
  //  derrière cette connexion ». Le carnet, lui, propose alors la
  //  liaison ; l'annexe n'a rien à proposer, elle ne marque rien.
  if (brut === null) return null;
  return etatsParEspece(lignesDe(brut));
}
