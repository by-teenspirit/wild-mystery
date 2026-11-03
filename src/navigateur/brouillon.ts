// ════════════════════════════════════════════════════════════════════
//  src/navigateur/brouillon.ts
//
//  Ce que l'onglet « Écrire » fait au texte et au temps. Pur : aucun
//  DOM, aucun `fetch`, aucune horloge — l'instant arrive en argument.
//
//  Note de code `385:1005` et ses sections LE COMPTEUR, LA BARRE
//  D'OUTILS, « ENVOYER DANS LE SUJET », LES SESSIONS, LA FIN DE SESSION.
//
//  ── TROIS POINTS DE LA NOTE QUI NE SONT PLUS VRAIS ──────────────────
//
//  1. « Même fonction que côté serveur, recopiée telle quelle. » Il n'y
//     en a pas. La note date d'une époque où l'expérience venait des
//     mots ; la décision du 1er octobre l'a fait venir des dégâts, et
//     `src/domaine/experience.ts` le dit en commentaire : « Jamais aux
//     mots ». Donc rien à recopier, et le chiffre affiché n'est plus
//     « celui qui sert à l'XP » : c'est un compte de mots, utile à qui
//     écrit, et rien d'autre. Il reste présenté comme une estimation.
//
//  2. « SANS JAVASCRIPT : l'onglet affiche les brouillons en lecture. »
//     Impossible — une page HTML de Forumactif n'a aucun rendu côté
//     serveur, donc sans JavaScript il n'y a aucun `fetch`, donc aucun
//     brouillon à afficher. Contradiction B de la planche 72, tranchée :
//     une phrase qui le dit, pas une vue dégradée qui n'affichera jamais
//     rien.
//
//  3. La note se contredit sur le minuteur : `401:1232` dit « pas de
//     minuteur », `404:1215` en décrit un, avec ses durées. La seconde
//     est postérieure, donc le minuteur existe — mais la partie de
//     `401:1232` qui tient toujours est le reste : pas d'objectif de
//     mots, pas de barre de progression.
// ════════════════════════════════════════════════════════════════════

/** Les mots d'un texte en BBCode, tels que l'onglet les compte.
 *
 *  LES CITATIONS NE COMPTENT PAS, et c'est le point entier de cette
 *  fonction : répondre en citant trois paragraphes de quelqu'un d'autre
 *  n'est pas écrire trois paragraphes. Les blocs imbriqués partent avec,
 *  parce qu'une citation dans une citation est encore moins de soi.
 *
 *  Le compte est une ESTIMATION et l'interface le dit : la relève lit le
 *  message publié, pas le brouillon, et un message édité après coup est
 *  recompté. */
export function compterLesMots(texte: string): number {
  return motsDe(texte).length;
}

/** Les mots eux-mêmes — la liste, pour qui veut autre chose que le compte. */
export function motsDe(texte: string): readonly string[] {
  const sansCitations = retirerLesCitations(texte);
  //  LES BALISES PARTENT APRÈS LES CITATIONS : l'inverse effacerait les
  //  `[quote]` et laisserait leur contenu dans le compte.
  const nu = sansCitations
    .replace(/\[\/?[a-z0-9*]+(?:=[^\]]*)?\]/gi, " ")
    .replace(/&[a-z]+;|&#\d+;/gi, " ");
  return nu.split(/\s+/).filter((m) => m !== "");
}

/** Le texte sans ses blocs de citation, imbrications comprises.
 *
 *  UNE EXPRESSION RÉGULIÈRE NE SAIT PAS COMPTER LES IMBRICATIONS, donc
 *  on les retire du plus profond vers le plus large, tant qu'il en
 *  reste. Le nombre de passes est borné : chaque passe retire au moins
 *  un bloc, et il y en a un nombre fini. */
export function retirerLesCitations(texte: string): string {
  const bloc = /\[quote(?:=[^\]]*)?\](?:(?!\[quote)[\s\S])*?\[\/quote\]/gi;
  let avant = texte;
  for (let passe = 0; passe < 32; passe++) {
    const apres = avant.replace(bloc, " ");
    if (apres === avant) return apres;
    avant = apres;
  }
  return avant;
}

// ── LA BARRE D'OUTILS ──────────────────────────────────────────────

/** Un bouton de la barre : ce qu'il écrit autour du texte choisi. */
export type Outil = {
  readonly nom: string;
  readonly mot: string;
  readonly ouvre: string;
  readonly ferme: string;
};

/** Les sept outils, et pas trente.
 *
 *  « L'éditeur complet reste celui du forum » — ce qui est ici est ce
 *  dont on a besoin pour écrire une scène sans quitter la page : les
 *  quatre formes du texte, la citation parce qu'on répond, le centrage
 *  parce que les RP s'en servent pour les en-têtes, et le lien.
 *
 *  DU BBCODE, PAS DU HTML : c'est ce que le formulaire de Forumactif
 *  attend, et il échappe le HTML qu'on lui donne. */
export const OUTILS: readonly Outil[] = [
  { nom: "gras", mot: "G", ouvre: "[b]", ferme: "[/b]" },
  { nom: "italique", mot: "I", ouvre: "[i]", ferme: "[/i]" },
  { nom: "souligne", mot: "S", ouvre: "[u]", ferme: "[/u]" },
  { nom: "barre", mot: "B", ouvre: "[strike]", ferme: "[/strike]" },
  { nom: "citation", mot: "«»", ouvre: "[quote]", ferme: "[/quote]" },
  { nom: "centre", mot: "≡", ouvre: "[center]", ferme: "[/center]" },
  { nom: "lien", mot: "⚯", ouvre: "[url=]", ferme: "[/url]" },
];

/** Le texte après un clic sur un outil, et où remettre le curseur.
 *
 *  LA SÉLECTION EST RENDUE AVEC, parce qu'un éditeur qui perd le curseur
 *  à chaque clic de gras fait écrire ailleurs. Sans sélection, les deux
 *  balises sont posées et le curseur va entre elles : c'est ce qu'on
 *  attend quand on clique avant de taper. */
export function poserLOutil(
  texte: string,
  outil: Outil,
  de: number,
  a: number,
): { readonly texte: string; readonly de: number; readonly a: number } {
  const debut = Math.max(0, Math.min(de, texte.length));
  const fin = Math.max(debut, Math.min(a, texte.length));
  const choisi = texte.slice(debut, fin);
  const neuf = texte.slice(0, debut) + outil.ouvre + choisi + outil.ferme +
    texte.slice(fin);
  //  Avec une sélection, on la garde choisie — pour pouvoir enchaîner
  //  gras puis italique sans re-sélectionner.
  const ouvert = debut + outil.ouvre.length;
  return { texte: neuf, de: ouvert, a: ouvert + choisi.length };
}

// ── « ENVOYER DANS LE SUJET » ──────────────────────────────────────

/** L'adresse du formulaire natif, pré-rempli par le navigateur.
 *
 *  LE BOUTON NE POSTE PAS. Il ouvre le formulaire de Forumactif et y
 *  écrit le corps ; le joueur relit et envoie. « Il pourrait poster, il
 *  a les identifiants. Mais la fiche serait signée d'un robot, le joueur
 *  ne pourrait plus l'éditer lui-même, et ce n'est plus sa page. »
 *
 *  Le corps NE VA PAS dans l'adresse : un message de RP dépasse de loin
 *  ce qu'une URL supporte, et il finirait dans les journaux du serveur.
 *  Il est posé dans le champ après l'ouverture. */
export function adresseDuFormulaire(sujetId: number | null): string | null {
  if (sujetId === null) return "/post?mode=newtopic&f=45";
  if (!Number.isInteger(sujetId) || sujetId <= 0) return null;
  return `/post?t=${sujetId}&mode=reply`;
}

// ── LES SESSIONS ───────────────────────────────────────────────────

/** Une session d'écriture, telle qu'elle vit dans le navigateur.
 *
 *  L'HEURE DE FIN, PAS UN COMPTE À REBOURS. Un `setInterval` qui
 *  décrémente s'égare dès que l'onglet passe en arrière-plan — les
 *  navigateurs ralentissent les minuteries des onglets cachés. En
 *  gardant l'instant de fin, l'affichage se recalcule juste, même après
 *  dix minutes dans un autre onglet.
 *
 *  `motsAuDebut` est ce qui rend le bilan honnête : « le bilan compte
 *  les mots écrits pendant la session, pas le total du message ». */
export type Session = {
  readonly finLe: number;
  readonly motsAuDebut: number;
};

/** Les durées proposées, en minutes. Plus une saisie libre, côté page. */
export const DUREES: readonly number[] = [15, 25, 45, 60];

export const DUREE_MIN = 1;
export const DUREE_MAX = 240;

/** Une session qui commence. `null` si la durée n'a pas de sens.
 *
 *  LA BORNE HAUTE N'EST PAS DE LA MÉFIANCE : une saisie libre reçoit un
 *  jour des `99999`, et une session de soixante-neuf jours n'est pas une
 *  session — c'est un minuteur qu'on ne peut plus arrêter autrement
 *  qu'en vidant son navigateur. */
export function commencerUneSession(
  minutes: number,
  mots: number,
  maintenant: number,
): Session | null {
  if (!Number.isFinite(minutes)) return null;
  const m = Math.round(minutes);
  if (m < DUREE_MIN || m > DUREE_MAX) return null;
  return { finLe: maintenant + m * 60_000, motsAuDebut: Math.max(0, mots) };
}

/** Ce qu'il reste, en secondes, jamais négatif. */
export function restantEnSecondes(s: Session, maintenant: number): number {
  return Math.max(0, Math.ceil((s.finLe - maintenant) / 1000));
}

export function sessionFinie(s: Session, maintenant: number): boolean {
  return maintenant >= s.finLe;
}

/** `25:00`, et `1:05:00` au-delà de l'heure.
 *
 *  PAS DE `padStart` SUR LES HEURES : `01:05:00` pour une session d'une
 *  heure se lit comme une horloge, et on cherche une durée. */
export function direLeTemps(secondes: number): string {
  const s = Math.max(0, Math.floor(secondes));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  const deux = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${deux(m)}:${deux(r)}` : `${m}:${deux(r)}`;
}

/** Les mots écrits PENDANT la session. Jamais négatif : effacer un
 *  paragraphe ne doit pas afficher « −80 mots » à quelqu'un qui vient
 *  de retravailler son texte. */
export function motsDeLaSession(s: Session, motsMaintenant: number): number {
  return Math.max(0, motsMaintenant - s.motsAuDebut);
}
