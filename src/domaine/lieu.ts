// ════════════════════════════════════════════════════════════════════
//  src/domaine/lieu.ts
//
//  Le nom d'un lieu, réduit à une clé qui tient dans un message.
//
//  POURQUOI. Le joueur choisit son lieu dans le bouton — décidé le
//  2 octobre — donc le bloc d'action doit le transporter :
//
//      [[WM-ACTION:chercher:clairiere-aux-lucioles]]
//
//  Or les lieux s'appellent « Clairière aux Lucioles », « Gué des
//  Marchands », « Roselière ». Des accents, des espaces, des majuscules :
//  rien de tout ça ne traverse sereinement l'éditeur de Forumactif, le
//  BBCode et la version mobile. D'où une clé sans accent et sans espace.
//
//  POURQUOI PAS UN NUMÉRO. Un indice dans la liste serait plus court,
//  mais réordonner un fichier de faune changerait le sens des messages
//  déjà postés. **Un message doit vouloir dire la même chose dans dix
//  ans qu'au moment où il a été écrit.** Une clé tirée du nom ne bouge
//  que si le nom bouge, et renommer un lieu est rare et visible.
//
//  VÉRIFIÉ SUR LES DONNÉES RÉELLES, le 2 octobre : 145 lieux, **zéro
//  collision à l'intérieur d'une zone**. Le seul doublon est « Passe du
//  Large », présent dans deux zones — et comme un lieu se résout toujours
//  dans la zone du sujet, il n'y a rien à départager.
// ════════════════════════════════════════════════════════════════════

/** Les ligatures que NFD ne décompose pas.
 *
 *  RELEVÉ SUR LE FORUM LE 3 OCTOBRE, et ce n'était pas prévu : « Cœur de
 *  la Forêt » donnait `c-ur-de-la-foret`. Le `œ` n'est pas une lettre
 *  accentuée mais un caractère à part entière ; NFD ne le sépare pas, et
 *  la règle « tout ce qui n'est pas a-z0-9 devient un tiret » l'avalait.
 *
 *  La clé fonctionnait quand même — les deux côtés emploient CETTE
 *  fonction, donc l'aller-retour tombait juste. Mais elle est écrite dans
 *  le message du joueur, qui la lit. Un trou au milieu d'un nom de lieu
 *  n'inspire pas confiance, et on corrige tant que rien n'est posté. */
const LIGATURES: readonly (readonly [RegExp, string])[] = [
  [/œ/g, "oe"],
  [/æ/g, "ae"],
];

/** La clé d'un lieu : minuscules, sans accent, les groupes de caractères
 *  non alphanumériques réduits à un tiret. */
export function cleDeLieu(nom: string): string {
  let sansLigature = nom.toLowerCase();
  for (const [quoi, par] of LIGATURES) sansLigature = sansLigature.replace(quoi, par);
  return sansLigature
    .normalize("NFD")
    //  On retire les diacritiques, pas les lettres : « Clairière » donne
    //  « clairiere » et non « clairre ».
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Le nom du lieu qui porte cette clé, parmi ceux d'une zone.
 *
 * Rend `null` plutôt que de choisir au hasard : un joueur qui demande un
 * lieu inconnu doit obtenir une erreur lisible, pas une rencontre
 * ailleurs. C'est le cas qui arrive quand un lieu est renommé entre le
 * moment où le message est écrit et celui où la relève le lit.
 */
export function lieuDepuisLaCle(
  cle: string,
  lieuxDeLaZone: readonly string[],
): string | null {
  return lieuxDeLaZone.find((nom) => cleDeLieu(nom) === cle) ?? null;
}
