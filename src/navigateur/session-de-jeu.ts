// ════════════════════════════════════════════════════════════════════
//  src/navigateur/session-de-jeu.ts
//
//  LE LAISSEZ-PASSER, ET RIEN D'AUTRE.
//
//  « On va mettre en place le process de "lier mon compte" » · « la
//  personne ne doit le faire qu'une seule fois », 3 novembre.
//
//  ── POURQUOI CE FICHIER EST PUR ─────────────────────────────────────
//
//  Trois décisions vivent ici, et toutes les trois sont des pièges :
//
//    1. Supabase rend ses jetons dans le FRAGMENT de l'adresse, pas
//       dans sa requête. Un fragment ne part jamais au serveur — c'est
//       exactement ce qu'on veut d'un jeton — mais il faut le lire à la
//       main, et il faut l'EFFACER tout de suite après, sinon il reste
//       dans l'historique du navigateur et dans le lien qu'on copie.
//    2. Un jeton expire. Décider « est-il encore bon ? » demande une
//       marge : un jeton valable trois secondes est déjà mort le temps
//       que la requête parte.
//    3. Il y a un laissez-passer PAR PERSONNAGE à garder, puisqu'une
//       personne en a plusieurs et que la page doit prendre celui du
//       compte forum courant.
//
//  Aucune des trois ne demande un navigateur pour être essayée. Les
//  mettre dans l'adaptateur aurait voulu dire un harnais pour vérifier
//  une soustraction.
// ════════════════════════════════════════════════════════════════════

export type Laissez = {
  readonly jeton: string;
  readonly rafraichir: string;
  /** Instant d'expiration, en millisecondes depuis 1970. */
  readonly expireLe: number;
};

/** LA MARGE AVANT EXPIRATION. Un jeton encore bon pour dix secondes ne
 *  l'est plus quand la requête arrive : on le remplace avant. Soixante
 *  secondes est le choix de Supabase lui-même pour son client. */
export const MARGE_MS = 60_000;

export function encoreBon(l: Laissez, maintenant: number): boolean {
  return l.expireLe - MARGE_MS > maintenant;
}

/** Le laissez-passer que Supabase vient de poser dans le fragment.
 *
 *  La forme est celle du flot implicite :
 *  `#access_token=…&refresh_token=…&expires_in=3600&token_type=bearer`
 *
 *  `null` si le fragment n'en porte pas — le cas de toutes les visites
 *  ordinaires, qui sont la quasi-totalité.
 *
 *  ON EXIGE LES DEUX JETONS. Sans celui de rafraîchissement, la session
 *  meurt au bout d'une heure et la personne devrait se relier : ce
 *  serait rompre la promesse du « une seule fois ». Mieux vaut traiter
 *  un retour incomplet comme un échec et le dire. */
export function laissezDuFragment(fragment: string, maintenant: number): Laissez | null {
  const champs = new URLSearchParams(fragment.replace(/^#/, ""));
  const jeton = champs.get("access_token") ?? "";
  const rafraichir = champs.get("refresh_token") ?? "";
  if (jeton === "" || rafraichir === "") return null;
  //  `expires_in` est en secondes, et Supabase le donne toujours. S'il
  //  manquait, une heure est sa valeur par défaut depuis toujours — et
  //  de toute façon le rafraîchissement rattrape une marge trop large.
  const duree = Number(champs.get("expires_in") ?? "3600");
  const secondes = Number.isFinite(duree) && duree > 0 ? duree : 3600;
  return { jeton, rafraichir, expireLe: maintenant + secondes * 1000 };
}

/** Le message d'erreur que Supabase met dans le fragment quand le lien
 *  est mort : `#error=access_denied&error_description=…`
 *
 *  LE CAS EST FRÉQUENT et il n'a rien d'anormal : un lien de connexion
 *  expire, et on clique souvent celui du mail d'avant. Le dire vaut
 *  mieux que laisser la page tourner comme si rien n'était arrivé. */
export function refusDuFragment(fragment: string): string | null {
  const champs = new URLSearchParams(fragment.replace(/^#/, ""));
  const code = champs.get("error") ?? champs.get("error_code");
  return code === null || code === "" ? null : code;
}

/** L'adresse débarrassée de son fragment, pour remplacer celle de la
 *  barre sans recharger.
 *
 *  ON GARDE L'ONGLET OUVERT s'il y en avait un : revenir du mail ne
 *  doit pas renvoyer sur « Mon jeu » quelqu'un qui lisait son Pokédex.
 *  Mais on ne garde QUE lui — tout le reste du fragment est du jeton. */
export function adresseSansJeton(adresse: string, fragment: string): string {
  const champs = new URLSearchParams(fragment.replace(/^#/, ""));
  const porteUnJeton = champs.has("access_token") || champs.has("error") ||
    champs.has("error_code");
  if (!porteUnJeton) return adresse;
  const sansFragment = adresse.split("#")[0];
  return sansFragment;
}
