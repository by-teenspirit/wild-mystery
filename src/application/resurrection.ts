// ════════════════════════════════════════════════════════════════════
//  src/application/resurrection.ts
//
//  Ce qu'on écrit au joueur quand son fossile revient à la vie — ou
//  quand il ne revient pas.
//
//  ── EN TEXTE PUR, COMME LE REÇU ET LE BILAN ─────────────────────────
//
//  Même raison qu'eux : un message du forum se relit dans dix ans, sans
//  notre CSS et sans notre JavaScript. Ce qui porte l'information est
//  la phrase, pas la mise en forme.
//
//  ── UN REFUS NOMME CE QU'IL REFUSE ──────────────────────────────────
//
//  « Analyse refusée » tout seul envoie le joueur demander pourquoi, et
//  personne ne saura lui répondre sans ouvrir la base. Le `detail` vient
//  de `rendre_fossile`, écrit pour être recopié tel quel : la base sait
//  ce qu'elle a refusé, elle le dit, et on ne le réinvente pas ici.
//
//  ── LE CODE EST ÉCRIT EN TOUTES LETTRES, DES DEUX CÔTÉS ─────────────
//
//  `CODE : WM-…`, comme le reçu et le bilan, et pour la même raison : un
//  joueur qui conteste doit pouvoir le recopier. Sur le refus aussi —
//  c'est même là qu'il sert le plus, puisque c'est la réponse qu'on vient
//  contester.
//
//  **Ce n'est PAS le marqueur technique.** Celui-là est ajouté par
//  l'adaptateur Forumactif, qui seul connaît sa forme `[[WM:…]]` ; ce
//  fichier ne connaît pas le forum. En écrire un ici en poserait un
//  second dans le même message, et l'adaptateur compte les marqueurs
//  pour retrouver son propre message après une coupure.
// ════════════════════════════════════════════════════════════════════

/** Ce qu'il faut savoir pour écrire la réponse. */
export type Resurrection = {
  readonly pseudo: string;
  /** Le nom de l'objet, pas son identifiant : c'est un message, pas
   *  une ligne de journal. */
  readonly fossile: string;
  readonly espece: string;
};

/** Le niveau auquel naît un pokémon réanimé. Il est décidé par
 *  `rendre_fossile`, qui écrit `niveau = 15` ; on le répète ici pour le
 *  message, et le test de contrat vérifie que les deux disent la même
 *  chose. Un message qui annonce un niveau que la base n'a pas donné est
 *  pire qu'un message sans niveau. */
export const NIVEAU_A_LA_NAISSANCE = 15;

export function redigerLaResurrection(r: Resurrection, code: string): string {
  return [
    `${r.pseudo.toUpperCase()}, le laboratoire a terminé.`,
    "",
    `${r.fossile} → ${r.espece}, niveau ${NIVEAU_A_LA_NAISSANCE}.`,
    "",
    "Il t'attend dans ta boîte.",
    "",
    `CODE : ${code}`,
  ].join("\n");
}

export function redigerLeRefusDeFossile(
  pseudo: string,
  fossile: string,
  detail: string,
  code: string,
): string {
  return [
    `${pseudo.toUpperCase()}, le laboratoire n'a pas pu analyser ${fossile}.`,
    "",
    detail,
    "",
    //  ON LE DIT, parce que c'est la première question du joueur : est-ce
    //  que mon fossile est perdu ? Non — `rendre_fossile` ne consomme
    //  rien sur un refus.
    "Rien n'a été consommé. Si tu récupères ce fossile, redemande une " +
    "analyse.",
    "",
    `CODE : ${code}`,
  ].join("\n");
}
