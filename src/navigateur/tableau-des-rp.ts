// ════════════════════════════════════════════════════════════════════
//  src/navigateur/tableau-des-rp.ts
//
//  Ce que l'onglet « Mes RP » calcule. Pur : aucun DOM, aucun `fetch`.
//
//  ── « À TOI » ET « À MOI » NE SONT PAS RANGÉS, ILS SE CALCULENT ─────
//
//  Le carnet regarde qui a écrit le dernier message. Les ranger dans
//  une colonne ferait deux sources pour une même vérité, et celle du
//  joueur serait fausse dès qu'on lui répond — c'est-à-dire au moment
//  précis où elle compte.
// ════════════════════════════════════════════════════════════════════

/** Une ligne du tableau, telle que la base la rend. */
export type LigneDeRp = {
  readonly sujetId: number;
  readonly titre: string;
  readonly forumId: number;
  readonly forumNom: string;
  readonly reponses: number;
  readonly dernierLe: string | null;
  readonly dernierAuteur: string;
  readonly dernierMessage: number | null;
  readonly extrait: string;
  readonly etat: string;
  readonly ordre: number;
  //  CE QUE LA PERSONNE ÉCRIT SUR SON RP — un pense-bête, où on en
  //  est. La relève n'y touche pas (0059) ; vide tant que personne
  //  n'a rien écrit.
  readonly description: string;
};

/** Ce que l'étiquette dit, une fois le calcul fait. */
export type EtatVu =
  | "a-moi"
  | "a-l-autre"
  | "prevu"
  | "en-pause"
  | "cloture"
  | "solo"
  | "neuf";

export const MOTS: Readonly<Record<EtatVu, string>> = {
  "a-moi": "à moi d'écrire",
  "a-l-autre": "à l'autre",
  "prevu": "prévu",
  "en-pause": "en pause",
  "cloture": "clôturé",
  "solo": "personne à attendre",
  "neuf": "personne n'a écrit",
};

/** ── LA FAMILLE D'UN FORUM ─────────────────────────────────────────
 *
 *  « Peut-être un tag pour les rps en ville, les rps en zones
 *  sauvages, les rps reste du monde et voyage dans le temps » —
 *  20 novembre, suivi de « déduit du forum ».
 *
 *  Et c'est le bon choix : le sujet sait déjà où il est, la relève
 *  range son `forum_id`, et un tag posé à la main se désaccorderait du
 *  jour où quelqu'un déplace un sujet.
 *
 *  LA TABLE N'EST PAS ÉCRITE ICI : elle arrive en argument, depuis
 *  `data/forums.json` et `data/butin.json`. Ce module reste pur, et
 *  surtout les dix-sept zones ne se recopient pas — elles ont déjà un
 *  fichier, et deux listes pour une même vérité en font toujours une
 *  fausse. */
export type TableDesForums = Readonly<Record<number, string>>;

/** Le mot du tag, ou `null` quand le forum n'est pas dans la table.
 *
 *  `null` EST UN RÉSULTAT NORMAL : un forum ajouté sur le forum
 *  n'apparaît pas tout seul dans la table. La carte s'affiche alors
 *  sans tag — un tag absent se remarque et se corrige, un tag faux se
 *  croit. */
export function familleDuForum(forumId: number, table: TableDesForums): string | null {
  return table[forumId] ?? null;
}

/** Le mot que `data/forums.json` donne à la famille du Messenger.
 *
 *  Il est ÉCRIT UNE FOIS ICI et pas recopié à chaque comparaison : la
 *  table vient d'un fichier de données, et un littéral en trois
 *  endroits finirait par ne plus dire la même chose que le fichier. */
export const FAMILLE_SMS = "sms";

/** Et celui de la zone sauvage, pour la même raison.
 *
 *  C'est la seule famille où le registre a quelque chose à verser :
 *  c'est elle qui décide si un RP montre son récap de butin. */
export const FAMILLE_ZONE = "zone sauvage";

/** Les RP d'un côté, les conversations du Messenger de l'autre.
 *
 *  « Les sms = le messenger. Ça fonctionnera un peu comme les rps du
 *  coup. » — 20 novembre.
 *
 *  POURQUOI UN PARTAGE ET PAS UN FILTRE DE PLUS : une conversation
 *  Messenger n'a pas d'état à poser. « Prévu », « solo », « clôturé »
 *  ne veulent rien dire pour elle, et la laisser dans le tableau
 *  mettrait des cartes dans des colonnes qui ne la concernent pas.
 *
 *  LA TABLE PEUT ÊTRE VIDE — `forums.json` pas encore lu, réseau
 *  coupé. Alors personne n'est reconnu comme SMS, et tout reste du
 *  côté des RP : un tableau complet vaut mieux qu'une page amputée. */
export function partagerLesRp(
  lignes: readonly LigneDeRp[],
  forums: TableDesForums,
): { readonly rp: readonly LigneDeRp[]; readonly sms: readonly LigneDeRp[] } {
  const rp: LigneDeRp[] = [];
  const sms: LigneDeRp[] = [];
  for (const l of lignes) {
    if (familleDuForum(l.forumId, forums) === FAMILLE_SMS) sms.push(l);
    else rp.push(l);
  }
  return { rp, sms };
}

/** L'état visible d'un RP.
 *
 *  L'ORDRE DES TESTS EST LA RÈGLE : ce que la personne a posé —
 *  prévu, en pause, clôturé — passe avant le calcul. Un RP mis en
 *  pause ne doit pas réapparaître dans « à moi d'écrire » parce que
 *  quelqu'un y a répondu : c'est précisément ce qu'elle voulait
 *  éviter en le mettant en pause. */
export function etatVu(l: LigneDeRp, monPseudo: string): EtatVu {
  if (l.etat === "prevu") return "prevu";
  if (l.etat === "en-pause") return "en-pause";
  if (l.etat === "cloture") return "cloture";
  //  UN SOLO N'ATTEND PERSONNE, et c'est tout l'intérêt de la colonne.
  //  Sans ce test, « à l'autre » s'affiche dès que le jeu poste le
  //  résultat d'une fouille — ce qui est exactement ce que Callista a
  //  vu sur le sujet « test », où Arceus avait écrit (0058).
  if (l.etat === "solo") return "solo";
  if (l.dernierAuteur === "") return "neuf";
  //  LA COMPARAISON EST INSENSIBLE AUX ESPACES DE BORD, pas à la
  //  casse : Forumactif ne laisse pas deux pseudos différer par elle,
  //  et une comparaison trop molle ferait dire « à l'autre » pour un
  //  homonyme approximatif.
  return l.dernierAuteur.trim() === monPseudo.trim() ? "a-l-autre" : "a-moi";
}

/** Les filtres de l'écran. `tous` ne cache rien. */
export function garderLesRp(
  lignes: readonly LigneDeRp[],
  filtre: string,
  monPseudo: string,
): LigneDeRp[] {
  if (filtre === "tous") return [...lignes];
  return lignes.filter((l) => {
    const vu = etatVu(l, monPseudo);
    if (filtre === "a-moi") return vu === "a-moi" || vu === "neuf";
    return vu === filtre;
  });
}

/** L'ordre d'affichage : celui du joueur d'abord, le temps ensuite.
 *
 *  `ordre` est à zéro pour tout le monde tant que personne n'a rangé —
 *  donc la date fait le tri par défaut, et la main l'emporte dès
 *  qu'elle s'en mêle. Les RP sans date (les prévus) vont à la fin :
 *  ils n'ont rien à dire sur ce qui vient de bouger. */
export function rangerLesRp(lignes: readonly LigneDeRp[]): LigneDeRp[] {
  return [...lignes].sort((a, b) => {
    if (a.ordre !== b.ordre) return a.ordre - b.ordre;
    if (a.dernierLe === null && b.dernierLe === null) return a.sujetId - b.sujetId;
    if (a.dernierLe === null) return 1;
    if (b.dernierLe === null) return -1;
    return b.dernierLe.localeCompare(a.dernierLe);
  });
}

/** Le numéro de sujet dans une adresse de Forumactif, ou `null`.
 *
 *  ON ACCEPTE CE QUE LES GENS COLLENT VRAIMENT : l'adresse complète,
 *  le chemin seul, avec une page (`p2`), avec une ancre de message, ou
 *  juste le nombre. Refuser « t996-le-sentier » parce qu'il manque le
 *  `https://` serait une leçon de syntaxe, pas une aide. */
export function sujetDeLAdresse(dit: string): number | null {
  const propre = dit.trim();
  if (propre === "") return null;
  if (/^\d+$/.test(propre)) {
    const n = Number(propre);
    return n > 0 ? n : null;
  }
  const m = /(?:^|\/)t(\d+)(?:p\d+)?(?:[-?#]|$)/i.exec(propre);
  return m === null ? null : Number(m[1]);
}

/** Le forum porté par l'adresse d'un formulaire de création.
 *
 *  `/post?f=9&mode=newtopic` — et l'ordre des paramètres n'est pas
 *  garanti : Forumactif écrit `?f=9&mode=newtopic` depuis le bouton
 *  d'un forum, et `?mode=newtopic&f=9` depuis le nôtre
 *  (`adresseDuFormulaire`). On lit donc le paramètre, pas la place.
 *
 *  ── POURQUOI PAS `forumDeLaPage` ─────────────────────────────────
 *
 *  Celle-là lit le fil d'Ariane, et le fil d'Ariane vit dans
 *  `viewforum_body` et dans notre `viewtopic_body` — PAS dans
 *  `posting_body`. Sur le formulaire de création il n'y a donc rien à
 *  lire dans la page, et la barre ne se posait pas : « quand je crée
 *  un sujet, dans les zones sauvages, il faut pouvoir déjà avoir les
 *  options », 18 novembre.
 *
 *  L'ADRESSE EST LA SOURCE LA PLUS SÛRE DES DEUX, ici : c'est elle
 *  que Forumactif lit lui-même pour savoir dans quel forum il va
 *  écrire. Un fil d'Ariane peut être déplacé par un template ; `f=`
 *  ne peut pas l'être sans casser le forum. */
export function forumDeLAdresse(dit: string): number | null {
  const m = /[?&]f=(\d+)(?:&|$)/.exec(dit.trim());
  if (m === null) return null;
  const n = Number(m[1]);
  return Number.isInteger(n) && n > 0 ? n : null;
}

/** L'adresse d'un sujet sur le forum, éventuellement sur un message.
 *
 *  ── LE TIRET N'EST PAS DÉCORATIF ──────────────────────────────────
 *
 *  « Quand je veux aller sur le sujet en cliquant dessus, je suis sur
 *  une 404 », 13 novembre, sur `/t996`. Mesuré sur le forum le même
 *  jour :
 *
 *      /t996          → 404, « Page not found »
 *      /t996-         → 200, redirigé vers /t996-test
 *      /viewtopic?t=996 → 200, pareil
 *
 *  Forumactif attend le titre après le numéro ; le tiret seul suffit à
 *  le lui faire compléter. Le code serveur l'écrivait depuis toujours
 *  (`lecture.ts`, `publication.ts`), le code du navigateur l'oubliait
 *  aux quatre endroits qui fabriquaient l'adresse à la main. D'où
 *  cette fonction : une seule façon d'écrire une adresse de sujet.
 *
 *  ── ET L'ANCRE EST UN NOMBRE NU ───────────────────────────────────
 *
 *  Mesuré aussi : un message porte DEUX ancres, `15582` et `p15582`.
 *  Le forum lie vers la première — `/t996-test#15570` — et elle
 *  traverse la redirection, que le navigateur suit en gardant le
 *  fragment. On écrit donc le nombre nu, comme le forum. */
export function adresseDuSujet(sujetId: number, messageId?: number | null): string {
  const base = `/t${sujetId}-`;
  return messageId === null || messageId === undefined ? base : `${base}#${messageId}`;
}
