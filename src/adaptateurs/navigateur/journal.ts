/// <reference lib="dom" />
// ════════════════════════════════════════════════════════════════════
//  src/adaptateurs/navigateur/journal.ts
//
//  La lecture de « La vie de Rhode » : un appel, et un seul.
//
//  ── POURQUOI LA FONCTION, ET PAS LA TABLE ───────────────────────────
//
//  `journal` est `grant select … to anon` : le navigateur pourrait la
//  lire directement, avec `order=` et `limit=`. On passe quand même par
//  `journal_dernieres`, parce que le tri et le plafond sont des décisions
//  — « huit, les plus récentes » — et qu'une décision ne se range pas à
//  deux endroits. La migration `0014` les porte ; ici on demande.
//
//  C'est le même raisonnement que `0012` sur la date du pokédex : deux
//  écrivains d'une même règle finissent par ne plus être d'accord, et le
//  désaccord ne se voit nulle part avant le jour où il compte.
//
//  ── UN APPEL QUI RATE EST UN ENCART QUI N'EXISTE PAS ────────────────
//
//  Tout rend `null` plutôt que de lever, comme le registre et le
//  catalogue. Sans l'encart l'index est entier ; avec une exception, le
//  thème tomberait avec lui.
// ════════════════════════════════════════════════════════════════════

import type { ConfigSupabase } from "./registre.ts";

/** Ce que le module de vie demande à la base. */
export interface LectureDuJournal {
  /** Les lignes brutes, dans l'ordre du serveur. La lecture est au
   *  domaine (`navigateur/vie.ts`), pas ici. */
  dernieres(combien: number): Promise<unknown>;
}

type Appel = (
  url: string,
  entetes: Record<string, string>,
  corps: string,
) => Promise<unknown>;

async function parDefaut(
  url: string,
  entetes: Record<string, string>,
  corps: string,
): Promise<unknown> {
  //  `credentials: "omit"` comme partout : la clé publiable suffit, et
  //  envoyer les cookies du forum à Supabase n'aurait aucun sens.
  const reponse = await fetch(url, {
    method: "POST",
    headers: entetes,
    body: corps,
    credentials: "omit",
  });
  if (!reponse.ok) return null;
  return await reponse.json();
}

export class JournalDistant implements LectureDuJournal {
  readonly #config: ConfigSupabase;
  readonly #appeler: Appel;

  constructor(config: ConfigSupabase, appeler: Appel = parDefaut) {
    this.#config = config;
    this.#appeler = appeler;
  }

  async dernieres(combien: number): Promise<unknown> {
    //  `combien` est reborné côté serveur de toute façon (1 à 20). On
    //  l'assainit quand même : un `NaN` dans le corps JSON deviendrait
    //  `null`, et la fonction retomberait sur son défaut de huit — ce
    //  qui marche, mais par accident.
    const n = Number.isInteger(combien) && combien > 0 ? Math.min(combien, 20) : 8;
    try {
      return await this.#appeler(
        `${this.#config.url}/rest/v1/rpc/journal_dernieres`,
        {
          apikey: this.#config.clePubliable,
          Authorization: `Bearer ${this.#config.clePubliable}`,
          "Content-Type": "application/json",
        },
        JSON.stringify({ p: { combien: n } }),
      );
    } catch {
      return null;
    }
  }
}
