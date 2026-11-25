// ════════════════════════════════════════════════════════════════════
//  Le message de signalement — « j'ai fini, venez valider ».
//
//  « Est-ce que ça peut déclencher une réponse pré-remplie dans un
//  autre sujet ? » — 25 novembre, avec le lien de t53.
//
//  ── NI BALISES NI BOTTINS ───────────────────────────────────────────
//
//  « Pas besoin d'utiliser les balises vu que ces infos iront dans le
//  répertoire des personnages. À la base, ça servait surtout pour
//  remplir les anciens bottins qu'on avait. » — 25 novembre.
//
//  Le formulaire de t53 est de la V1 : ses `<y>`, `<t>`, `<l>`, `<f>`
//  et ses cinq bottins existaient pour que le staff RECOPIE les
//  lignes dans cinq sujets-annuaires tenus à la main. CES ANNUAIRES
//  N'EXISTENT PLUS : `pages/repertoire-des-personnages.html` dérive
//  ses bottins — prénoms, noms, avatars, métiers — de
//  `data/repertoire.json`, et une ligne recopiée à la main dérive au
//  premier renommage.
//
//  Le message ne porte donc plus que des questions, en texte simple.
//  Ce qu'il récolte sert à remplir le répertoire, pas à être collé
//  quelque part.
//
//  ── ON NE REMPLIT QUE LE NOM ET LE PRÉNOM ───────────────────────────
//
//  « Au clic, ça remplit juste les champs nom et prénom
//  automatiquement, le reste tu peux remplir toi-même. »
//
//  C'EST UN CHOIX, PAS UNE LIMITE TECHNIQUE : la fiche sait plusieurs
//  de ces réponses. Mais un champ pré-rempli se relit mal — on le
//  valide des yeux sans le lire — et le formulaire demande justement
//  ce que la fiche dit en prose, pas en étiquette. « Originaire
//  d'alola, elle est née à malié » n'est pas une région d'origine, et
//  le raccourcir serait réécrire le texte de la joueuse.
//
//  Le nom et le prénom, eux, ne se discutent pas : ils sont déjà en
//  titre de la fiche.
//
//  LE LIEN DE LA PRÉSENTATION EST POSÉ AUSSI, et il n'entre pas dans
//  l'exception : ce n'est pas une réponse, c'est le signalement
//  lui-même. Sans lui, le staff n'a pas de quoi agir.
//
//  ── LES TROIS QUESTIONS AJOUTÉES SONT TROIS COLONNES ────────────────
//
//  « Demande la région d'origine, le statut marital et le lieu de vie
//  (ces infos permettront de remplir le répertoire). » Ce sont
//  exactement les colonnes que le répertoire ne peut pas lire dans une
//  fiche : le lieu de vie n'y est demandé nulle part, et les deux
//  autres y sont de la prose.
// ════════════════════════════════════════════════════════════════════

import type { Fiche } from "./fiche.ts";

/** Ce qu'il faut savoir en plus de la fiche pour écrire le message. */
export type Signalement = {
  /** La fiche, relue dans le message de la présentation. */
  readonly fiche: Fiche;
  /** Le nom du compte sur le forum — c'est celui du personnage. */
  readonly compte: string;
  /** L'adresse du sujet de présentation, telle qu'on la lit dans la
   *  barre du navigateur. */
  readonly presentation: string;
};

/** Ce que le formulaire dit quand personne n'a encore répondu. Les
 *  deux premières tournures sont celles de t53, relevées le 25
 *  novembre ; les suivantes reprennent son « réponse ici. ». */
const INVITES = {
  scenario: "mettre le nom du créateur le cas échéant.",
  comptes: "le nom du compte",
  reponse: "réponse ici.",
  prenom: "prénom",
  famille: "nom de famille",
} as const;

/** `uc` est le mot que Callista écrit dans une fiche d'essai là où
 *  elle n'a pas encore répondu. CE N'EST PAS UNE VALEUR, et le
 *  recopier ferait entrer « uc » dans le répertoire. */
function repondu(valeur: string): string {
  const v = valeur.trim();
  return v === "" || v.toLowerCase() === "uc" ? "" : v;
}

/** Le prénom et le nom de famille, découpés sur le premier espace.
 *  Un nom en un seul mot n'a pas de famille — et c'est courant chez
 *  les personnages de jeu. */
export function coupeLeNom(nom: string): { prenom: string; famille: string } {
  const mots = repondu(nom).split(/\s+/).filter((m) => m !== "");
  if (mots.length === 0) return { prenom: "", famille: "" };
  return { prenom: mots[0], famille: mots.slice(1).join(" ") };
}

/** Le message à poser dans la réponse de t53. */
export function messageDeSignalement(s: Signalement): string {
  const { prenom, famille } = coupeLeNom(s.fiche.nom);
  const ou = (valeur: string, invite: string) => valeur === "" ? invite : valeur;

  return [
    `LIEN DE LA PRÉSENTATION : ${s.presentation}`,
    `PRÉNOM : ${ou(prenom, INVITES.prenom)}`,
    `NOM DE FAMILLE : ${ou(famille, INVITES.famille)}`,
    `RÉGION D'ORIGINE : ${INVITES.reponse}`,
    `STATUT MARITAL : ${INVITES.reponse}`,
    `LIEU DE VIE : ${INVITES.reponse}`,
    `ES-TU UN POSTE-VACANT OU SCÉNARIO ? ${INVITES.scenario}`,
    `AUTRES COMPTES SUR LE FORUM : ${INVITES.comptes}`,
  ].join("\n");
}
