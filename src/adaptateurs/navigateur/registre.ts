/// <reference lib="dom" />
// ════════════════════════════════════════════════════════════════════
//  src/adaptateurs/navigateur/registre.ts
//
//  La lecture du registre d'un sujet, et le nom des objets qu'il cite.
//  Deux requêtes PostgREST, pas une de plus.
//
//  ── CE QUE LE NAVIGATEUR A LE DROIT DE LIRE ──────────────────────────
//
//  La clé publiable, et elle seule. Elle est faite pour être servie aux
//  navigateurs : ce ne sont pas elle qui protège quoi que ce soit, ce
//  sont les politiques RLS. Le registre est `grant select … to anon`
//  avec une politique `using (true)` — il est public par décision
//  (`45-…` §3 : c'est un journal, et il est lu par tous les
//  participants d'un sujet).
//
//  **La clé de service ne sort jamais de Supabase**, et le garde-fou
//  n° 10 refuse qu'elle entre dans le dépôt.
//
//  ── UNE PANNE DE RÉSEAU N'EST PAS UNE PANNE DE PAGE ──────────────────
//
//  Comme le catalogue : tout rend une valeur vide plutôt que de lever.
//  Sans le registre il manque un module ; avec une exception, c'est le
//  thème et le masquage des marqueurs qui tombent avec lui.
// ════════════════════════════════════════════════════════════════════

export type ConfigSupabase = {
  readonly url: string;
  readonly clePubliable: string;
};

/** La configuration, relue plutôt que supposée.
 *
 *  Une URL vide ou une clé absente donnerait des requêtes vers
 *  `undefined/rest/v1/…` et une pluie d'erreurs réseau dans la console
 *  d'un joueur. Mieux vaut ne rien faire. */
export function configDepuis(donnees: unknown): ConfigSupabase | null {
  if (typeof donnees !== "object" || donnees === null) return null;
  const d = donnees as Record<string, unknown>;
  const url = typeof d.url === "string" ? d.url.replace(/\/+$/, "") : "";
  const cle = typeof d.clePubliable === "string" ? d.clePubliable : "";
  if (!url.startsWith("https://") || cle === "") return null;
  return { url, clePubliable: cle };
}

type Recuperateur = (url: string, entetes: Record<string, string>) => Promise<unknown>;

async function parDefaut(url: string, entetes: Record<string, string>): Promise<unknown> {
  const reponse = await fetch(url, { headers: entetes, credentials: "omit" });
  if (!reponse.ok) return null;
  return await reponse.json();
}

/** Ce que le module de bilan demande à la base. */
export interface LectureDuRegistre {
  /** Les lignes brutes d'un sujet. Le tri et la lecture sont au domaine. */
  lignesDuSujet(sujetId: number): Promise<unknown>;
  nomsDObjets(ids: readonly number[]): Promise<ReadonlyMap<number, string>>;
}

export class RegistreDistant implements LectureDuRegistre {
  readonly #config: ConfigSupabase;
  readonly #recuperer: Recuperateur;

  constructor(config: ConfigSupabase, recuperer: Recuperateur = parDefaut) {
    this.#config = config;
    this.#recuperer = recuperer;
  }

  get #entetes(): Record<string, string> {
    return {
      apikey: this.#config.clePubliable,
      Authorization: `Bearer ${this.#config.clePubliable}`,
    };
  }

  async #lire(chemin: string): Promise<unknown> {
    try {
      return await this.#recuperer(`${this.#config.url}/rest/v1/${chemin}`, this.#entetes);
    } catch {
      return null;
    }
  }

  lignesDuSujet(sujetId: number): Promise<unknown> {
    //  `order` sur le serveur : le domaine retrie de toute façon, mais
    //  une réponse déjà dans l'ordre se lit quand on la regarde à la
    //  main pour comprendre un litige.
    return this.#lire(
      `registre?sujet_id=eq.${sujetId}` +
        `&select=joueur_id,message_id,type,charge&order=message_id.asc`,
    );
  }

  async nomsDObjets(ids: readonly number[]): Promise<ReadonlyMap<number, string>> {
    const index = new Map<number, string>();
    if (ids.length === 0) return index;
    //  Une seule requête pour tous les objets d'un bilan. `in.(…)` sur
    //  une liste vide est une erreur côté PostgREST, d'où le retour
    //  au-dessus.
    const brut = await this.#lire(`objet?id=in.(${ids.join(",")})&select=id,nom`);
    if (!Array.isArray(brut)) return index;
    for (const o of brut) {
      if (typeof o !== "object" || o === null) continue;
      const r = o as Record<string, unknown>;
      if (typeof r.id === "number" && typeof r.nom === "string" && r.nom !== "") {
        index.set(r.id, r.nom);
      }
    }
    return index;
  }
}
