// ════════════════════════════════════════════════════════════════════
//  Le message de signalement — « j'ai fini, venez valider ».
//
//  « Est-ce que ça peut déclencher une réponse pré-remplie dans un
//  autre sujet ? » — 25 novembre, avec le lien de t53.
//
//  ── LE FORMULAIRE EXISTE DÉJÀ, ET IL N'EST PAS DE NOUS ──────────────
//
//  t53 « Signaler sa présentation terminée » porte un formulaire écrit
//  par Callista, avec ses balises à elle — `<y>`, `<t>`, `<l>`, `<f>`,
//  `<x>`, `<em>` — et ses mentions `@"Nom"`. ON NE LE RÉÉCRIT PAS : on
//  pose des valeurs dedans. Les intitulés, l'ordre et les tournures
//  sont relevés sur le sujet le 25 novembre et recopiés tels quels.
//
//  Trois questions s'ajoutent, et elles sont d'elle aussi :
//  « demande la région d'origine, le statut marital et le lieu de vie
//  (ces infos permettront de remplir le répertoire) ». Ce sont
//  exactement les trois colonnes que le répertoire ne peut pas lire
//  dans une fiche.
//
//  ── ON NE REMPLIT QUE LE NOM ET LE PRÉNOM ───────────────────────────
//
//  « Au clic, ça remplit juste les champs nom et prénom
//  automatiquement, le reste tu peux remplir toi-même. » — 25
//  novembre, après un premier jet qui posait aussi le faceclaim, le
//  type de personnage, la région et le statut.
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
//  ── PAS DE GENRE ────────────────────────────────────────────────────
//
//  « Pas de genre dans les bottins. » Le modèle de t53 avait deux
//  lignes, une par genre ; il n'en reste qu'une.
//
//  ── ET CE QU'IL NE REMPLIT JAMAIS ──────────────────────────────────
//
//  Tout le reste garde le texte d'invite de Callista, mot pour mot.
//  Une invite laissée en place se voit et se corrige ; une invite
//  remplacée par une valeur approximative ne se voit plus.
// ════════════════════════════════════════════════════════════════════

import type { Fiche } from "./fiche.ts";

/** Ce qu'il faut savoir en plus de la fiche pour écrire le message. */
export type Signalement = {
  /** La fiche, relue dans le message de la présentation. */
  readonly fiche: Fiche;
  /** Le nom du compte sur le forum — c'est celui du personnage, et
   *  c'est lui que les mentions `@"…"` du formulaire attendent. */
  readonly compte: string;
  /** L'adresse du sujet de présentation, telle qu'on la lit dans la
   *  barre du navigateur. */
  readonly presentation: string;
};

/** Ce que le formulaire dit quand personne n'a encore répondu. Les
 *  tournures sont celles de t53, relevées le 25 novembre. */
const INVITES = {
  scenario: "mettre le nom du créateur le cas échéant.",
  comptes: '@"Nom du compte"',
  reponse: "réponse ici.",
  celebrite: "Votre célébrité",
  prenom: "Prénom",
  nom: "NOM DE FAMILLE",
  region: "Région d'origine",
  metier: "Nom du métier ici :",
  logement: "type de logement - colocation possible/impossible",
} as const;

/** `uc` est le mot que Callista écrit dans une fiche d'essai là où
 *  elle n'a pas encore répondu. CE N'EST PAS UNE VALEUR, et le
 *  recopier dans un bottin ferait entrer « uc » dans le répertoire. */
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

function mention(compte: string): string {
  const c = compte.trim();
  return c === "" ? INVITES.comptes : `@"${c}"`;
}

/** Le message à poser dans la réponse de t53. */
export function messageDeSignalement(s: Signalement): string {
  const { prenom, famille } = coupeLeNom(s.fiche.nom);
  const moi = mention(s.compte);

  return [
    `<y>LIEN DE LA PRÉSENTATION :</y> ${s.presentation}`,
    `<y>ES-TU UN POSTE-VACANT OU SCÉNARIO ?</y> ${INVITES.scenario}`,
    `<y>AUTRES COMPTES SUR LE FORUM :</y> ${INVITES.comptes}`,
    `<y>RÉGION D'ORIGINE :</y> ${INVITES.reponse}`,
    `<y>STATUT MARITAL :</y> ${INVITES.reponse}`,
    `<y>LIEU DE VIE :</y> ${INVITES.reponse}`,
    ``,
    `<l>BOTTIN DES AVATARS</l>`,
    `<t>${INVITES.celebrite}</t> - ${moi}`,
    ``,
    `<l>BOTTIN DES PRÉNOMS</l>`,
    `<t>${prenom === "" ? INVITES.prenom : prenom}</t>`,
    ``,
    `<l>BOTTIN DES NOMS DE FAMILLE</l>`,
    `<y>${
      famille === "" ? INVITES.nom : famille.toUpperCase()
    }</y> <em>(${INVITES.region})</em>`,
    moi,
    ``,
    `<l>BOTTIN DES MÉTIERS</l>`,
    `<f>${INVITES.metier}</f> <em>${moi}</em>`,
    ``,
    `<l>REGISTRE DES HABITATIONS</l>`,
    `<x>Ville :</x> ${INVITES.reponse}`,
    `${moi} <em>(${INVITES.logement})</em>`,
  ].join("\n");
}
