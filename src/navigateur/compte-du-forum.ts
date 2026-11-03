// ════════════════════════════════════════════════════════════════════
//  src/navigateur/compte-du-forum.ts
//
//  QUI REGARDE LA PAGE, LU DANS UNE PAGE DU FORUM.
//
//  « En principe, ça devrait être automatique. Pas de sujet d'ouverture
//  ou quoi », 3 novembre.
//
//  ── POURQUOI ON VA LE CHERCHER AILLEURS ─────────────────────────────
//
//  `/h15-mon-carnet` est servie SANS l'en-tête du forum — c'est ce qui
//  lui donne son allure, et c'est aussi ce qui fait qu'il n'y a pas de
//  `_userdata` dessus. Mesuré le 3 novembre : `globalThis._userdata`
//  vaut `undefined` sur cette page.
//
//  Mais le navigateur peut demander n'importe quelle page du forum AVEC
//  la session du membre, puisqu'on est sur le même domaine. Et toute
//  page du forum porte son `_userdata` dans son code. Relevé le même
//  jour sur quatre pages ; `/memberlist` est la plus légère des quatre,
//  51 ko.
//
//  ── CE QUE ÇA PROUVE, ET CE QUE ÇA NE PROUVE PAS ────────────────────
//
//  Ça prouve à la PAGE qui la regarde : personne ne peut charger la
//  page d'un autre membre, la session ne suit pas. Ça ne prouve rien à
//  la BASE, qui reçoit un numéro et ne peut pas savoir d'où il vient.
//  C'est le choix du 3 novembre, et il est écrit dans l'en-tête de la
//  migration 0026 avec son prix.
//
//  ── POURQUOI UN ANALYSEUR À PART, ET PUR ────────────────────────────
//
//  Parce que la forme de ce code est la seule chose fragile ici : c'est
//  Forumactif qui l'écrit, et il peut changer. Une fonction pure qu'on
//  nourrit de vrais extraits se corrige en une ligne le jour où la
//  forme bouge ; la même lecture noyée dans un `fetch` demanderait un
//  navigateur pour être essayée.
// ════════════════════════════════════════════════════════════════════

export type CompteDuForum = {
  readonly id: number;
  readonly pseudo: string;
};

/** Le membre connecté, d'après le code d'une page du forum.
 *
 *  `null` pour un invité, et c'est un cas NORMAL : quelqu'un peut
 *  arriver sur le carnet sans être connecté, et la page le lui dit au
 *  lieu de montrer une panne.
 *
 *  LES DEUX CONDITIONS SONT EXIGÉES. Forumactif écrit `user_id = -1`
 *  pour un invité, mais il écrit aussi `session_logged_in = 0` : lire
 *  l'un sans l'autre laisserait passer un numéro négatif, qui partirait
 *  en base comme n'importe quel autre. */
export function compteDansLaPage(code: string): CompteDuForum | null {
  const connecte = valeur(code, "session_logged_in");
  if (connecte !== "1") return null;

  const id = Number(valeur(code, "user_id"));
  if (!Number.isInteger(id) || id <= 0) return null;

  //  LE PSEUDO EST SECONDAIRE : la base a le sien, et c'est celui-là
  //  qu'on affiche. Celui-ci ne sert qu'à dire « connecté en tant
  //  que… » quand le compte n'a pas encore de carnet. Donc on ne
  //  refuse pas une page qui ne le donne pas.
  return { id, pseudo: pseudo(code) };
}

/** `_userdata["clef"] = valeur` — la forme exacte que Forumactif écrit,
 *  relevée le 3 novembre.
 *
 *  ON LIT LA CHAÎNE ENTRE GUILLEMETS D'ABORD, ET PAS « JUSQU'AU
 *  POINT-VIRGULE ». Un pseudo porte des entités HTML — `Jean&#039;s`,
 *  et toutes les lettres accentuées — et une entité CONTIENT un
 *  point-virgule : s'arrêter au premier coupait le pseudo en deux et
 *  laissait une entité à moitié écrite. Trouvé par le test, pas sur le
 *  forum, et c'est exactement ce qu'on lui demandait. */
function valeur(code: string, clef: string): string | null {
  const nom = `_userdata\\[(?:"|')${clef}(?:"|')\\]\\s*=\\s*`;
  //  Une chaîne, guillemets doubles ou simples, avec ses échappements.
  const chaine = new RegExp(
    `${nom}(?:"((?:[^"\\\\]|\\\\.){0,120})"|'((?:[^'\\\\]|\\\\.){0,120})')`,
  );
  const q = chaine.exec(code);
  if (q !== null) return (q[1] ?? q[2] ?? "").trim();
  //  Sinon un nombre ou un mot nu, qui s'arrête bien au point-virgule.
  const nu = new RegExp(`${nom}([^;\\n]{1,80})`).exec(code);
  return nu === null ? null : nu[1].trim();
}

function pseudo(code: string): string {
  const brut = valeur(code, "username") ?? "";
  //  Forumactif échappe les apostrophes dans son JavaScript, et laisse
  //  passer les entités HTML du pseudo. Les deux se voient à l'œil nu
  //  dans la page : « L\'Inconnu » et « Jean&#039;s ».
  return brut
    .replace(/\\(['"\\])/g, "$1")
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .trim();
}
