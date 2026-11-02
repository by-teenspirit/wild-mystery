/// <reference lib="dom" />
// ════════════════════════════════════════════════════════════════════
//  src/adaptateurs/navigateur/supabase.ts
//
//  COUVERT PAR : outils/tcard.mjs — l'appel part, la réponse remplit la
//  carte, et un refus la laisse telle qu'elle a été collée.
//
//  APPELER UNE FONCTION SUPABASE DEPUIS LE NAVIGATEUR.
//
//  C'est le premier appel HTTP du dépôt vers Supabase : jusqu'ici tout
//  passait par `psql` dans les tests de contrat ou par la clé de
//  service dans la relève. Ici c'est un navigateur, donc la clé
//  PUBLIABLE, celle de `data/supabase.json`, et elle seule.
//
//  ── CE QUI PROTÈGE, ET CE QUI NE PROTÈGE PAS ────────────────────────
//
//  La clé publiable ne protège rien : elle est servie à tout le monde,
//  c'est son métier. Ce qui protège, ce sont les droits posés sur
//  chaque fonction. Deux seulement sont ouvertes à `anon` :
//
//    · `carnet(p)`          — protégée par la clé personnelle du
//                             joueur, passée en argument (migration
//                             0019) ;
//    · `carte_dresseur(p)`  — publique, et volontairement étroite :
//                             elle ne rend que ce qui est déjà affiché
//                             dans le message (migration 0020).
//
//  Ce fichier n'ajoute aucun droit. Il appelle ce que la base accepte
//  déjà, et si un jour il appelle autre chose, c'est la base qui
//  refusera.
//
//  ── PAS DE BIBLIOTHÈQUE ─────────────────────────────────────────────
//
//  Le client officiel de Supabase pèse une centaine de kilo-octets pour
//  ce qui est un `POST` avec deux en-têtes. Et il faudrait le charger
//  depuis un CDN tiers sur toutes les pages du forum, ce que la
//  planche 28 interdit pour les sprites et qui vaut encore plus pour du
//  code exécutable.
// ════════════════════════════════════════════════════════════════════

//  LA CONFIGURATION N'EST PAS RELUE ICI. `registre.ts` porte déjà
//  `ConfigSupabase` et son `configDepuis`, qui refuse une URL qui n'est
//  pas en `https://` et une clé vide. Un second validateur serait un
//  second endroit où oublier une vérification.
import type { ConfigSupabase } from "./registre.ts";

export type Acces = ConfigSupabase;

/** Le refus d'une fonction, tel que la base le formule.
 *
 *  ON GARDE LE CODE, PAS LA PHRASE. `CLE_INVALIDE` est fait pour être
 *  reconnu par le code appelant ; le texte de PostgreSQL autour, lui,
 *  change d'une version à l'autre. */
export class RefusSupabase extends Error {
  constructor(public readonly code: string, public readonly statut: number) {
    super(code);
    this.name = "RefusSupabase";
  }
}

/** Le code d'erreur que la base a levé, extrait de sa réponse.
 *
 *  PostgREST range le message de `raise exception` dans `message`, et
 *  nos fonctions y mettent un mot en capitales et rien d'autre. Si la
 *  forme change, on rend le statut HTTP plutôt que d'inventer. */
function codeDuRefus(corps: unknown, statut: number): string {
  if (typeof corps === "object" && corps !== null) {
    const m = (corps as { message?: unknown }).message;
    if (typeof m === "string") {
      const mot = m.match(/[A-Z_]{4,}/);
      if (mot !== null) return mot[0];
    }
  }
  return `HTTP_${statut}`;
}

/** Appelle une fonction SQL et rend ce qu'elle rend.
 *
 *  `credentials: "omit"` est délibéré : la page est servie par
 *  forumactif.com et l'appel part vers supabase.co, donc envoyer les
 *  cookies du forum à un tiers n'a aucune raison d'être. */
export async function appeler(
  acces: Acces,
  fonction: string,
  p: Record<string, unknown>,
): Promise<unknown> {
  const reponse = await fetch(`${acces.url}/rest/v1/rpc/${fonction}`, {
    method: "POST",
    credentials: "omit",
    headers: {
      "apikey": acces.clePubliable,
      "Authorization": `Bearer ${acces.clePubliable}`,
      "Content-Type": "application/json",
      //  La réponse est une valeur, pas une collection : sans ça
      //  PostgREST l'enveloppe dans un tableau d'une ligne.
      "Accept": "application/json",
    },
    body: JSON.stringify({ p }),
  });

  const corps = await reponse.json().catch(() => null);
  if (!reponse.ok) throw new RefusSupabase(codeDuRefus(corps, reponse.status), reponse.status);
  return corps;
}
