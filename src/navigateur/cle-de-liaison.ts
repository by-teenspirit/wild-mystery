// ════════════════════════════════════════════════════════════════════
//  src/navigateur/cle-de-liaison.ts
//
//  LA CLÉ DU CARNET, POSÉE DANS LE PROFIL DU MEMBRE PAR LE STAFF.
//
//  « La clé de liaison est la clé qui le lie au Supabase » · « la clé
//  n'est pas censée être visible, l'admin la met au tout début, et une
//  fois mise, quand le joueur est validé, ça fonctionne », 3 novembre.
//
//  ── POURQUOI C'EST UNE PREUVE ───────────────────────────────────────
//
//  Le champ n'est affiché nulle part : ni sur la page de profil, ni
//  dans les messages, ni sur la liste des membres. Vérifié le
//  3 novembre en demandant `/u1` et `/u4` SANS cookies — le forum
//  répond en traitant la demande comme celle d'un invité, et
//  l'étiquette « clé de liaison » n'est dans aucune des deux pages,
//  alors que « Faceclaim » y est.
//
//  Et la page où le champ SE lit, `/profile?mode=editprofile`, n'a
//  aucun paramètre pour demander le profil d'un autre : elle rend
//  toujours celui de la session qui la demande. Donc une clé trouvée
//  là prouve l'identité aussi solidement que la session du forum.
//
//  C'est mieux que le code à poster qu'on avait d'abord écrit : rien à
//  recopier, rien de public, rien qui expire, et le staff voit et
//  remplace la clé d'un joueur depuis son panneau.
//
//  ── POURQUOI ON CHERCHE PAR L'ÉTIQUETTE ─────────────────────────────
//
//  Le champ s'appelle `profile_field_13_2` aujourd'hui. Ce numéro est
//  celui d'une ligne dans la base de Forumactif : supprimer le champ et
//  le recréer en donne un autre, et le carnet de tout le monde
//  tomberait pour une manipulation du panneau d'administration. Son
//  ÉTIQUETTE, elle, est écrite par Callista et ne change que si elle la
//  change.
// ════════════════════════════════════════════════════════════════════

/** Un champ du formulaire de profil : son étiquette et sa valeur. */
export type ChampDeProfil = {
  readonly etiquette: string;
  readonly valeur: string;
};

/** La forme d'une clé de carnet : 32 caractères hexadécimaux. C'est
 *  `carnet_nouvelle_cle` qui les fabrique et `carnet_joueur` qui
 *  refuse tout le reste — on vérifie ici pour ne pas faire un
 *  aller-retour en base avec le contenu d'un champ mal rempli. */
const FORME = /^[0-9a-f]{32}$/;

export const ETIQUETTE = "clé de liaison";

/** Rend la clé trouvée dans les champs du profil, ou `null`.
 *
 *  TROIS CAS DE `null`, ET ILS SE RESSEMBLENT DE L'EXTÉRIEUR :
 *
 *    · le champ n'existe pas — le staff ne l'a pas créé ;
 *    · il existe et il est vide — le staff ne l'a pas encore rempli,
 *      ce qui est l'état normal d'un compte pas encore validé ;
 *    · il porte autre chose qu'une clé — un essai, un reste, une
 *      faute de copie.
 *
 *  La page dit la même chose dans les trois cas, parce que la personne
 *  qui lit n'y peut rien de toute façon : c'est au staff de poser la
 *  clé. Les distinguer ici ne servirait qu'à écrire trois phrases pour
 *  un seul geste. */
export function cleParmiLesChamps(champs: readonly ChampDeProfil[]): string | null {
  for (const c of champs) {
    if (sansFioritures(c.etiquette) !== sansFioritures(ETIQUETTE)) continue;
    const v = c.valeur.trim().toLowerCase();
    return FORME.test(v) ? v : null;
  }
  return null;
}

/** L'étiquette, réduite à ce qui ne bouge pas : Forumactif ajoute un
 *  « : », parfois une étoile de champ obligatoire, et la casse comme
 *  les accents dépendent de ce que le staff a tapé. */
function sansFioritures(mot: string): string {
  return mot
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z]+/g, " ")
    .trim();
}
