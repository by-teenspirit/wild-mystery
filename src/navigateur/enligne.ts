// ════════════════════════════════════════════════════════════════════
//  src/navigateur/enligne.ts
//
//  « Qui est en ligne ? », maquette `390:3387`. Les RÈGLES, sans DOM.
//
//  ── CE QUE LE BLOC MONTRE, ET D'OÙ ÇA VIENT ─────────────────────────
//
//  Cinq choses, et elles n'ont pas la même source — c'est la seule
//  chose à savoir avant de lire ce fichier :
//
//    · le total de messages, le nombre de membres et le dernier
//      arrivé : ModernBB les écrit dans `.statistics`, en bas de
//      l'index. On les LIT, zéro requête ;
//    · qui est en ligne maintenant, et qui l'était dans les
//      vingt-quatre heures : Forumactif ne les sert QUE si l'option
//      est cochée dans le panneau d'administration. Relevé le
//      8 octobre sur Wild Mystery : elle ne l'est pas, et il n'y a
//      donc aucune liste dans la page ;
//    · le clan du moment, sa description et son avantage : à nous,
//      dans `data/clans.json`.
//
//  ── POURQUOI ON NE LIT PAS LES PHRASES ──────────────────────────────
//
//  ModernBB écrit « Nos membres ont posté un total de 436 messages ».
//  On pourrait y chercher un nombre à l'expression régulière. On ne le
//  fait pas : cette phrase change avec la LANGUE du forum, et avec les
//  réglages du panneau. Le jour où Callista passe le forum en anglais,
//  ou renomme ses libellés, une lecture par le texte rend zéro sans
//  rien dire.
//
//  Ce qui ne change pas, c'est la STRUCTURE : trois `.statistics-item`,
//  dans l'ordre, chacun avec son `<strong>`. On lit les positions.
// ════════════════════════════════════════════════════════════════════

/** Ce que l'index sait déjà dire du forum. */
export type Chiffres = {
  /** Le total de messages, ou `null` si la ligne manque. */
  readonly messages: number | null;
  readonly membres: number | null;
  /** Le dernier inscrit : son pseudo et l'adresse de son profil. */
  readonly dernierArrive: { readonly pseudo: string; readonly url: string } | null;
};

/** Un clan, tel que `data/clans.json` le décrit. */
export type Clan = {
  /** La clé qui donne ses deux jetons de couleur, `--wm-groupe-<clé>-…`. */
  readonly cle: string;
  readonly nom: string;
  readonly description: string;
  readonly avantage: string;
  /** Les numéros du Pokédex national de ses pokémons emblématiques. */
  readonly pokemons: readonly number[];
};

function texte(v: unknown): string {
  return typeof v === "string" ? v.replace(/\s+/g, " ").trim() : "";
}

/** Lit un nombre écrit par Forumactif.
 *
 *  LES ESPACES DES MILLIERS COMPTENT : « 3 214 » porte une espace fine
 *  insécable qu'aucun `parseInt` ne franchit — il rend 3. La maquette
 *  montre justement « 3 214 messages », donc le cas n'est pas théorique.
 *  On les retire avant de lire, et on nomme les caractères plutôt que
 *  de faire confiance à `\s`. */
export function nombreEcrit(brut: string): number | null {
  const net = brut.replace(/[\s  ]/g, "");
  if (!/^\d+$/.test(net)) return null;
  const n = Number(net);
  return Number.isFinite(n) ? n : null;
}

/** Relit un clan. Rend `null` dès qu'il lui manque de quoi s'afficher.
 *
 *  ── UN CLAN SANS DESCRIPTION NE S'AFFICHE PAS ───────────────────────
 *
 *  `data/clans.json` ne contient aujourd'hui qu'un clan rempli — les
 *  cinq autres sont des trous, en attendant leurs textes. Un trou doit
 *  SE VOIR : une carte au nom d'un clan et au corps vide ferait croire
 *  à une panne, et on chercherait le défaut dans le code. */
export function clanDepuis(brut: unknown): Clan | null {
  if (brut === null || typeof brut !== "object") return null;
  const o = brut as Record<string, unknown>;
  const cle = texte(o.cle);
  const nom = texte(o.nom);
  const description = texte(o.description);
  if (cle === "" || nom === "" || description === "") return null;
  const pokemons = Array.isArray(o.pokemons)
    ? o.pokemons.filter((n): n is number =>
      typeof n === "number" && Number.isInteger(n) && n > 0
    )
    : [];
  return { cle, nom, description, avantage: texte(o.avantage), pokemons };
}

/** Un onglet de la bande des clans.
 *
 *  ── POURQUOI IL N'EST PAS UN `Clan` ─────────────────────────────────
 *
 *  La maquette `390:3387` dessine SIX icônes à gauche de la carte,
 *  une par clan, et c'est la bande d'onglets. Elle en montre six même
 *  si un seul clan a son texte — c'est la carte des clans du forum,
 *  pas la liste de ceux qui sont prêts.
 *
 *  Or `clanDepuis` refuse un clan sans description, et il a raison :
 *  une carte vide ne vaut rien. Les deux besoins ne sont pas le même,
 *  donc l'onglet porte TOUJOURS sa clé et son nom, et son `clan` vaut
 *  `null` tant que le texte n'est pas écrit. Le module affiche alors
 *  l'icône sans la rendre cliquable : la bande est complète, et rien
 *  d'ouvrable n'est vide.
 *
 *  Cinq des six le sont au 9 octobre, et ça se voit — c'est voulu. */
export type Onglet = {
  readonly cle: string;
  readonly nom: string;
  /** `null` tant que la description n'est pas écrite. */
  readonly clan: Clan | null;
};

/** La bande des clans, dans l'ordre de `data/clans.json`.
 *
 *  L'ORDRE EST CELUI DU FICHIER, et pas un tri : la maquette met
 *  Ho-Oh en haut, et c'est à Callista de décider de l'ordre en
 *  déplaçant les lignes. */
export function ongletsDesClans(brut: unknown): readonly Onglet[] {
  if (brut === null || typeof brut !== "object") return [];
  const liste = Array.isArray((brut as Record<string, unknown>).clans)
    ? (brut as Record<string, unknown>).clans as unknown[]
    : [];
  const sortie: Onglet[] = [];
  for (const c of liste) {
    if (c === null || typeof c !== "object") continue;
    const o = c as Record<string, unknown>;
    const cle = texte(o.cle);
    const nom = texte(o.nom);
    if (cle === "" || nom === "") continue;
    sortie.push({ cle, nom, clan: clanDepuis(c) });
  }
  return sortie;
}

/** Le clan à montrer, d'après `data/clans.json`.
 *
 *  `duMoment` nomme une clé ; changer de clan, c'est changer ce mot.
 *  Si la clé ne désigne rien — un nom mal tapé, un clan encore vide —
 *  on ne RETOMBE PAS sur le premier venu : afficher silencieusement un
 *  autre clan que celui demandé est pire que de n'en afficher aucun,
 *  parce que personne ne s'aperçoit de l'erreur. */
export function clanDuMoment(brut: unknown): Clan | null {
  if (brut === null || typeof brut !== "object") return null;
  const o = brut as Record<string, unknown>;
  const voulu = texte(o.duMoment);
  if (voulu === "") return null;
  const liste = Array.isArray(o.clans) ? o.clans : [];
  for (const c of liste) {
    const lu = clanDepuis(c);
    if (lu !== null && lu.cle === voulu) return lu;
  }
  return null;
}

/** Vrai quand il n'y a rien du tout à montrer.
 *
 *  Le module s'arrête là : mieux vaut pas de bloc qu'un cadre avec
 *  trois tirets dedans. */
export function rienAMontrer(c: Chiffres, clan: Clan | null): boolean {
  return c.messages === null && c.membres === null && c.dernierArrive === null && clan === null;
}
