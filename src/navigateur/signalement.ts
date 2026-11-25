// ════════════════════════════════════════════════════════════════════
//  Le message de signalement — « j'ai fini, venez valider ».
//
//  « Est-ce que ça peut déclencher une réponse pré-remplie dans un
//  autre sujet ? » — 25 novembre, avec le lien de t53.
//
//  ── LE FORMULAIRE EXISTE DÉJÀ, ET IL N'EST PAS DE NOUS ──────────────
//
//  t53 « Signaler sa présentation terminée » porte un formulaire écrit
//  par Callista, avec ses balises à elle — `<y>`, `<t>`, `<l>`, `<o>`,
//  `<f>`, `<em>` — et ses mentions `@"Nom"`. ON NE LE RÉÉCRIT PAS :
//  on pose des valeurs dedans. Les intitulés, l'ordre et les tournures
//  sont relevés sur le sujet le 25 novembre et recopiés tels quels.
//
//  Trois questions s'ajoutent, et elles sont d'elle aussi :
//  « demande la région d'origine, le statut marital et le lieu de vie
//  (ces infos permettront de remplir le répertoire) ». Ce sont
//  exactement les trois colonnes que le répertoire ne peut pas lire
//  dans une fiche.
//
//  ── CE QUI EST REMPLI, ET CE QUI NE L'EST PAS ───────────────────────
//
//  « Remplis tout sauf le métier. » Le métier a déjà son bottin dans
//  le formulaire : le demander deux fois ferait deux réponses à
//  recouper.
//
//  Le reste vient de la fiche, qui le sait déjà. Deux dérivations
//  valent d'être dites, parce qu'elles ne se devinent pas :
//
//   · LE GENRE DU PRÉNOM VIENT DES PRONOMS. Le bottin en a deux
//     lignes, une par genre ; les pronoms du personnage sont dans sa
//     fiche, et c'est la seule chose qui s'en approche. « il » range à
//     masculin, « elle » à féminin, et tout le reste ne range nulle
//     part — on laisse alors les deux lignes à la joueuse plutôt que
//     de trancher à sa place.
//
//   · LA FAMILLE LIÉE AU GROUPE OMBRE VIENT DU BLOC OMBRE. Le
//     formulaire sépare les deux cas, et la fiche porte un bloc entier
//     qui n'existe que pour les personnages du groupe. C'est exact, là
//     où lire « ombre » dans un texte d'allégeance serait une
//     supposition.
//
//  ── ET CE QU'IL NE REMPLIT JAMAIS ──────────────────────────────────
//
//  Ce que la fiche ne sait pas reste le texte d'invite de Callista,
//  mot pour mot. Une invite laissée en place se voit et se corrige ;
//  une invite remplacée par une valeur inventée ne se voit plus.
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
  origine: "réponse ici.",
  statut: "réponse ici.",
  lieu: "réponse ici.",
  celebrite: "Votre célébrité",
  prenomF: "Prénom féminin",
  prenomM: "Prénom masculin",
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

/** Le premier mot utile d'un champ, pour les bottins qui attendent une
 *  étiquette et pas un paragraphe. Rend la chaîne entière si elle est
 *  déjà courte. */
function coupeCourt(valeur: string): string {
  const v = repondu(valeur);
  if (v === "") return "";
  const avantLaVirgule = v.split(/[,;.]/)[0].trim();
  return avantLaVirgule.length >= 2 && avantLaVirgule.length <= 40 ? avantLaVirgule : "";
}

/** Le genre que les pronoms annoncent, pour choisir la ligne du bottin
 *  des prénoms. `null` veut dire « je ne sais pas », et on laisse
 *  alors les deux lignes. */
export function genreDesPronoms(pronoms: string): "f" | "m" | null {
  const p = ` ${repondu(pronoms).toLowerCase().replace(/[^a-zà-ÿ ]+/g, " ")} `;
  const elle = / elle | she | her /.test(p);
  const il = / il | he | him /.test(p);
  if (elle === il) return null;
  return elle ? "f" : "m";
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
  const { fiche, compte } = s;
  const id = fiche.identite;
  const j = fiche.joueur;
  const ou = (valeur: string, invite: string) =>
    repondu(valeur) === "" ? invite : repondu(valeur);

  const { prenom, famille } = coupeLeNom(fiche.nom);
  const genre = genreDesPronoms(id["pronoms"] ?? "");
  const moi = mention(compte);
  const celebrite = ou(j["j-avatar"] ?? "", INVITES.celebrite);
  //  La région que le bottin des familles demande est celle du
  //  personnage ; c'est la même réponse que la question ajoutée plus
  //  haut, et la poser deux fois ferait deux endroits à corriger.
  const region = coupeCourt(id["origine"] ?? "") || INVITES.region;

  const prenoms = genre === null
    ? [
      `<x>Prénom féminin</x>`,
      `<t>${INVITES.prenomF}</t>`,
      ``,
      `<x>Prénom masculin</x>`,
      `<l>${INVITES.prenomM}</l>`,
    ]
    : genre === "f"
    ? [`<x>Prénom féminin</x>`, `<t>${prenom || INVITES.prenomF}</t>`]
    : [`<x>Prénom masculin</x>`, `<l>${prenom || INVITES.prenomM}</l>`];

  //  LE BLOC OMBRE DIT L'APPARTENANCE, pas le texte d'allégeance.
  const ombre = fiche.ombre !== null;
  const ligneFamille = famille === ""
    ? `<y>${INVITES.nom}</y> <em>(${INVITES.region})</em>`
    : ombre
    ? `<o>${famille.toUpperCase()}</o> <em>(${region})</em>`
    : `<y>${famille.toUpperCase()}</y> <em>(${region})</em>`;

  return [
    `<y>LIEN DE LA PRÉSENTATION :</y> ${s.presentation}`,
    `<y>ES-TU UN POSTE-VACANT OU SCÉNARIO ?</y> ${ou(j["j-type"] ?? "", INVITES.scenario)}`,
    `<y>AUTRES COMPTES SUR LE FORUM :</y> ${INVITES.comptes}`,
    `<y>RÉGION D'ORIGINE :</y> ${ou(coupeCourt(id["origine"] ?? ""), INVITES.origine)}`,
    `<y>STATUT MARITAL :</y> ${ou(coupeCourt(id["statut"] ?? ""), INVITES.statut)}`,
    `<y>LIEU DE VIE :</y> ${INVITES.lieu}`,
    ``,
    `<l>BOTTIN DES AVATARS</l>`,
    `<t>${celebrite}</t> - ${moi}`,
    ``,
    `<l>BOTTIN DES PRÉNOMS</l>`,
    ...prenoms,
    ``,
    `<l>BOTTIN DES NOMS DE FAMILLE</l>`,
    ligneFamille,
    moi,
    ``,
    `<l>BOTTIN DES MÉTIERS</l>`,
    `<f>${INVITES.metier}</f> <em>${moi}</em>`,
    ``,
    `<l>REGISTRE DES HABITATIONS</l>`,
    `<x>Ville :</x> ${INVITES.lieu}`,
    `${moi} <em>(${INVITES.logement})</em>`,
  ].join("\n");
}
