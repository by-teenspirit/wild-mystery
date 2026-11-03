/// <reference lib="dom" />
// ════════════════════════════════════════════════════════════════════
//  src/adaptateurs/navigateur/auth-supabase.ts
//
//  COUVERT PAR : outils/carnet.mjs — l'envoi du lien, le retour du
//  mail, le rafraîchissement, et le refus d'un lien mort.
//
//  TROIS APPELS À SUPABASE AUTH, ÉCRITS À LA MAIN.
//
//  Le client officiel pèse une centaine de kilo-octets et il faudrait
//  le charger depuis un CDN tiers sur une page du forum. Ce qu'on en
//  utiliserait tient en trois `POST` :
//
//    · `/auth/v1/otp`                      — envoie le lien par mail ;
//    · `/auth/v1/token?grant_type=…`       — rafraîchit le laissez-passer ;
//    · `/auth/v1/logout`                   — pas employé : se délier
//                                            n'est pas prévu, et une
//                                            fonction qu'on n'appelle
//                                            pas est une fonction qui
//                                            ne casse pas.
//
//  ── LE FLOT IMPLICITE, ET POURQUOI ──────────────────────────────────
//
//  Supabase propose PKCE et le flot implicite. PKCE demande de garder
//  un secret entre l'envoi du lien et le retour — donc dans le
//  navigateur, donc dans `localStorage` — et de l'échanger contre le
//  jeton. Le flot implicite met les jetons dans le FRAGMENT de
//  l'adresse de retour, et un fragment ne part jamais au serveur.
//
//  Pour une page qui n'a pas de serveur à elle, l'implicite est plus
//  simple ET ne fait pas voyager un secret de plus. Son défaut connu —
//  le jeton reste dans la barre d'adresse — est traité : on efface le
//  fragment dès qu'il est lu (`adresseSansJeton`).
// ════════════════════════════════════════════════════════════════════

import type { ConfigSupabase } from "./registre.ts";
import { type Laissez, laissezDuFragment } from "../../navigateur/session-de-jeu.ts";

/** Ce que l'envoi du lien peut rendre. */
export type EnvoiDuLien =
  | { readonly etat: "parti" }
  | { readonly etat: "trop-vite" }
  | { readonly etat: "refus"; readonly code: string; readonly statut: number };

/** Demande à Supabase d'envoyer le lien de connexion.
 *
 *  `shouldCreateUser` RESTE VRAI, et c'est délibéré. Le refuser ferait
 *  répondre « cet utilisateur n'existe pas » à qui tape une adresse
 *  inconnue — donc un moyen de savoir quelles adresses sont inscrites
 *  sur le forum. Avec la création, la réponse est la même pour tout le
 *  monde, et un compte sans personnage ne donne accès à rien : c'est
 *  `lier_mon_personnage` qui décide, en comparant à ce que le staff a
 *  certifié.
 *
 *  LE DÉBIT EST BRIDÉ CHEZ SUPABASE — quelques messages par heure sur
 *  le service par défaut — et le refus a son propre état : dire « lien
 *  envoyé » alors que rien ne partira ferait attendre un mail qui ne
 *  viendra pas. */
export async function envoyerLeLien(
  acces: ConfigSupabase,
  courriel: string,
  retour: string,
): Promise<EnvoiDuLien> {
  //  ── L'ADRESSE DE RETOUR VA DANS L'ADRESSE, PAS DANS LE CORPS ──────
  //
  //  Premier envoi branché pour de vrai, 3 novembre : refus. J'avais
  //  écrit `options: { email_redirect_to }` dans le corps — c'est la
  //  forme du client JS `signInWithOtp`, pas celle de l'API. Le `POST
  //  /auth/v1/otp` ne connaît que `email` et `create_user` ; le client
  //  officiel, lui, pose la destination en paramètre `redirect_to` de
  //  l'URL. Un champ inconnu dans le corps est ignoré en silence : le
  //  lien serait parti vers la Site URL du projet, donc ailleurs.
  //
  //  ET LE DÉCOR L'A LAISSÉ PASSER, parce que je l'avais écrit pour
  //  attendre ma propre invention. Troisième fois que ça se paie dans
  //  ce projet : un décor qui ne reproduit pas ce que l'hôte sert ne
  //  mesure que lui-même. Le harnais vérifie maintenant le paramètre
  //  d'URL, et refuse un corps qui porterait `options`.
  const adresse = new URL(`${acces.url}/auth/v1/otp`);
  adresse.searchParams.set("redirect_to", retour);
  const reponse = await fetch(adresse.toString(), {
    method: "POST",
    credentials: "omit",
    headers: {
      "apikey": acces.clePubliable,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email: courriel, create_user: true }),
  });
  if (reponse.ok) return { etat: "parti" };
  if (reponse.status === 429) return { etat: "trop-vite" };
  const corps = await reponse.json().catch(() => null);
  const code = typeof corps === "object" && corps !== null
    ? String((corps as { error_code?: unknown }).error_code ?? reponse.status)
    : String(reponse.status);
  return { etat: "refus", code, statut: reponse.status };
}

/** Échange le jeton de rafraîchissement contre un laissez-passer neuf.
 *
 *  `null` SI LE REFUS EST DÉFINITIF : un jeton de rafraîchissement
 *  révoqué ou périmé ne se répare pas, il faut se relier. On ne
 *  distingue pas les causes — elles appellent le même geste. */
export async function rafraichir(
  acces: ConfigSupabase,
  jetonDeRafraichissement: string,
  maintenant: number,
): Promise<Laissez | null> {
  const reponse = await fetch(`${acces.url}/auth/v1/token?grant_type=refresh_token`, {
    method: "POST",
    credentials: "omit",
    headers: {
      "apikey": acces.clePubliable,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ refresh_token: jetonDeRafraichissement }),
  });
  if (!reponse.ok) return null;
  const corps = await reponse.json().catch(() => null);
  if (typeof corps !== "object" || corps === null) return null;
  const c = corps as { access_token?: unknown; refresh_token?: unknown; expires_in?: unknown };
  if (typeof c.access_token !== "string" || typeof c.refresh_token !== "string") return null;
  //  ON RÉUTILISE LA LECTURE DU FRAGMENT plutôt que de refaire le
  //  calcul de l'expiration : une seconde façon de calculer la même
  //  chose est une seconde façon de se tromper.
  const champs = new URLSearchParams({
    access_token: c.access_token,
    refresh_token: c.refresh_token,
    expires_in: String(typeof c.expires_in === "number" ? c.expires_in : 3600),
  });
  return laissezDuFragment(`#${champs.toString()}`, maintenant);
}

/** Appelle une fonction SQL AVEC le laissez-passer du joueur.
 *
 *  La différence avec `appeler` de `supabase.ts` tient à l'en-tête
 *  `Authorization` : la clé publiable y devient le jeton du joueur,
 *  donc PostgreSQL voit `authenticated` et `auth_courant()` rend son
 *  identifiant. `apikey` reste la clé publiable — Supabase exige les
 *  deux, et c'est ce qui route la requête vers le bon projet.
 *
 *  ── `p` EST FACULTATIF, ET CE N'EST PAS UN CONFORT ──────────────────
 *
 *  PostgREST choisit la fonction PAR LE NOM DE SES ARGUMENTS. Un corps
 *  `{"p":{}}` envoyé à une fonction sans argument ne l'appelle pas avec
 *  un `p` vide : il cherche une fonction qui aurait un paramètre `p`,
 *  n'en trouve aucune, et répond `404 PGRST202`.
 *
 *  C'est ce qui est arrivé à `lier_mon_personnage()`, qui ne prend plus
 *  d'argument depuis la `0031` : l'appel n'atteignait jamais la base, et
 *  la page annonçait « aucun personnage rattaché » — un verdict qu'elle
 *  n'avait aucun moyen de rendre. Omettre `p` envoie `{}`, qui est ce
 *  que PostgREST attend d'une fonction sans argument. */
export async function appelerAvecLeJeton(
  acces: ConfigSupabase,
  jeton: string,
  fonction: string,
  p?: Record<string, unknown>,
): Promise<Response> {
  return await fetch(`${acces.url}/rest/v1/rpc/${fonction}`, {
    method: "POST",
    credentials: "omit",
    headers: {
      "apikey": acces.clePubliable,
      "Authorization": `Bearer ${jeton}`,
      "Content-Type": "application/json",
      "Accept": "application/json",
    },
    body: JSON.stringify(p === undefined ? {} : { p }),
  });
}
