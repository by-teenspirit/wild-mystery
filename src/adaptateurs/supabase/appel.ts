// ════════════════════════════════════════════════════════════════════
//  src/adaptateurs/supabase/appel.ts
//
//  Comment on appelle une fonction SQL. Un seul argument `jsonb`, pour
//  la raison écrite en tête de supabase/registre.sql : les deux chemins
//  d'appel passent la charge sans la comprendre, et le seul endroit qui
//  connaisse les types reste le fichier SQL.
//
//  Il n'y a PAS de dépendance à supabase-js. PostgREST est une API HTTP,
//  et `fetch` suffit — une vingtaine de lignes contre une bibliothèque
//  entière à recopier dans vendoreur/. Moins de code, rien à mettre à
//  jour, et la requête qui part est visible.
// ════════════════════════════════════════════════════════════════════

/** Appelle la fonction SQL nommée, avec un seul argument JSON, et rend
 *  ce qu'elle retourne. L'implémentation est injectée : c'est ce qui
 *  permet de faire tourner le MÊME adaptateur contre PostgREST en
 *  production et contre psql dans le CI. */
export type AppelSql = (fonction: string, argument: unknown) => Promise<unknown>;

export class AppelEchoue extends Error {
  constructor(fonction: string, detail: string) {
    super(`Appel de ${fonction} échoué : ${detail}`);
    this.name = "AppelEchoue";
  }
}

export type Reglages = {
  /** L'URL du projet, sans barre finale : https://xxxx.supabase.co */
  readonly base: string;
  /** La clé. Côté navigateur, la clé publiable — publique par
   *  construction, bornée par les politiques RLS. Côté fonction Edge, la
   *  clé de service, qui ne sort jamais de Supabase. */
  readonly cle: string;
  /** Le jeton du joueur connecté, s'il y en a un. Sans lui, PostgREST
   *  agit avec les droits de la clé seule. */
  readonly jeton?: string;
  readonly recuperer?: typeof fetch;
};

/** L'appel par PostgREST. `security definer` sur les fonctions SQL fait
 *  que les politiques RLS sont contournées à l'intérieur — c'est voulu,
 *  et c'est pour ça que chaque fonction filtre elle-même sur le joueur
 *  qu'on lui passe. */
export function appelPostgrest(reglages: Reglages): AppelSql {
  const recuperer = reglages.recuperer ?? fetch;
  const base = reglages.base.replace(/\/+$/, "");

  return async (fonction, argument) => {
    const reponse = await recuperer(`${base}/rest/v1/rpc/${fonction}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "apikey": reglages.cle,
        "authorization": `Bearer ${reglages.jeton ?? reglages.cle}`,
      },
      body: JSON.stringify({ p: argument }),
    });

    const texte = await reponse.text();
    if (!reponse.ok) {
      throw new AppelEchoue(fonction, `HTTP ${reponse.status} — ${texte.slice(0, 300)}`);
    }
    if (texte === "") return null;
    try {
      return JSON.parse(texte);
    } catch {
      throw new AppelEchoue(fonction, `réponse illisible : ${texte.slice(0, 120)}`);
    }
  };
}
