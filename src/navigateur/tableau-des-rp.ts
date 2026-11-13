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
  readonly forumNom: string;
  readonly reponses: number;
  readonly dernierLe: string | null;
  readonly dernierAuteur: string;
  readonly dernierMessage: number | null;
  readonly extrait: string;
  readonly etat: string;
  readonly ordre: number;
};

/** Ce que l'étiquette dit, une fois le calcul fait. */
export type EtatVu = "a-moi" | "a-l-autre" | "prevu" | "en-pause" | "cloture" | "neuf";

export const MOTS: Readonly<Record<EtatVu, string>> = {
  "a-moi": "à moi d'écrire",
  "a-l-autre": "à l'autre",
  "prevu": "prévu",
  "en-pause": "en pause",
  "cloture": "clôturé",
  "neuf": "personne n'a écrit",
};

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
