// ════════════════════════════════════════════════════════════════════
//  src/navigateur/zone.ts
//
//  Où sommes-nous, et qu'est-ce qu'on peut y faire ?
//
//  LA RÈGLE 4 DE LA PLANCHE 45 : « il n'existe que dans les zones
//  sauvages ». Le module de bilan, et avec lui la barre d'actions, ne se
//  chargent que dans les dix-sept zones. Partout ailleurs — villes,
//  arènes, colosseums, flood, archives — il ne se passe rien.
//
//  CE N'EST PAS UNE COQUETTERIE. « Fouiller la zone » dans le forum de
//  flood écrirait un bloc que la relève ne lira jamais, puisqu'elle ne
//  parcourt que les zones sauvages. Le joueur cliquerait, rien ne se
//  produirait, et il n'aurait aucun moyen de comprendre pourquoi.
//
//  Que des règles ici : le fil d'Ariane et le réseau sont dans
//  `adaptateurs/navigateur/`.
// ════════════════════════════════════════════════════════════════════

/** Une zone sauvage, telle que `data/zones.json` la décrit. On ne reprend
 *  que ce dont le navigateur se sert : le reste du fichier est pour le
 *  serveur.
 *
 *  ── LES TROIS CHAMPS DU BANDEAU SONT FACULTATIFS ────────────────────
 *
 *  `niveau`, `description` et `image` sont recopiés de `data/carte.json`
 *  par `outils/zones.py`. Ils servent AU BANDEAU de la page d'une zone,
 *  et à rien d'autre : la barre d'actions et le module de bilan n'en
 *  ont jamais besoin.
 *
 *  Ils sont donc facultatifs, et c'est une décision, pas un oubli. Le
 *  jour où une zone nouvelle arrive dans `zones.json` sans être encore
 *  sur la carte, ce qui compte — savoir que ce forum EST une zone —
 *  doit continuer de marcher. On perd le bandeau, pas la fouille. */
export type ZoneDuNavigateur = {
  readonly forumId: number;
  readonly nom: string;
  readonly palier: 1 | 2 | 3;
  /** « Niveaux 1 à 20 ». La légende du bandeau. */
  readonly niveau?: string;
  /** La phrase d'ambiance, sous le titre. */
  readonly description?: string;
  /** L'adresse absolue de la photo, servie à côté du dépôt. */
  readonly image?: string;
};

/** Une chaîne non vide, ou `undefined`. Les trois champs du bandeau sont
 *  du texte affiché tel quel : une valeur d'un autre type est ignorée
 *  comme le reste du fichier, pas convertie. */
function texte(valeur: unknown): string | undefined {
  return typeof valeur === "string" && valeur.trim() !== "" ? valeur.trim() : undefined;
}

/** La légende du bandeau : « PALIER 1 · NIVEAUX 1 À 20 ».
 *
 *  La maquette `301:26` écrit « MONTAGNES EMBRUMÉES · NIVEAUX 14 À 28 »
 *  parce qu'elle dessinait la page d'un LIEU, dont la zone était le
 *  parent. Sur la page d'une zone, le nom est déjà le titre juste en
 *  dessous : le répéter en surtitre ne dirait rien. Le palier, lui, ne
 *  se lit nulle part ailleurs sur la page.
 *
 *  Les capitales sont faites ici et pas en CSS : `text-transform` ne
 *  change pas le texte copié, et un joueur qui copie la légende doit
 *  obtenir ce qu'il voit. */
export function legendeDeZone(zone: ZoneDuNavigateur): string {
  const palier = `PALIER ${zone.palier}`;
  return zone.niveau === undefined
    ? palier
    : `${palier} · ${zone.niveau.toLocaleUpperCase("fr")}`;
}

function estUnPalier(v: unknown): v is 1 | 2 | 3 {
  return v === 1 || v === 2 || v === 3;
}

/**
 * Lit `data/zones.json` **sans rien croire**.
 *
 * Le fichier est servi par un CDN et traverse une branche git : une
 * version abîmée ne doit pas faire disparaître la barre partout, ni la
 * faire apparaître là où elle n'a rien à faire. Une entrée mal formée est
 * donc ignorée, pas devinée, et les autres passent.
 */
export function zonesDepuis(donnees: unknown): readonly ZoneDuNavigateur[] {
  if (typeof donnees !== "object" || donnees === null) return [];
  const brut = (donnees as Record<string, unknown>).zones;
  if (!Array.isArray(brut)) return [];

  const zones: ZoneDuNavigateur[] = [];
  for (const entree of brut) {
    if (typeof entree !== "object" || entree === null) continue;
    const z = entree as Record<string, unknown>;
    if (typeof z.forumId !== "number" || !Number.isInteger(z.forumId)) continue;
    if (typeof z.nom !== "string" || z.nom === "") continue;
    if (!estUnPalier(z.palier)) continue;
    //  LES TROIS CHAMPS FACULTATIFS NE SONT POSÉS QUE S'ILS EXISTENT,
    //  au lieu d'être posés à `undefined` : une zone sans bandeau rend
    //  alors exactement l'objet qu'elle rendait avant le 22 octobre.
    //  C'est ce qui permet de comparer une zone à une autre, et c'est ce
    //  que font les tests de ce fichier.
    const bandeau: Record<string, string> = {};
    for (const champ of ["niveau", "description", "image"] as const) {
      const valeur = texte(z[champ]);
      if (valeur !== undefined) bandeau[champ] = valeur;
    }
    zones.push({ forumId: z.forumId, nom: z.nom, palier: z.palier, ...bandeau });
  }
  return zones;
}

/** La zone d'un forum, ou null si ce forum n'est pas une zone sauvage.
 *  `null` est la réponse NORMALE : il y a bien plus de forums que de
 *  zones. */
export function zoneDe(
  forumId: number | null,
  zones: readonly ZoneDuNavigateur[],
): ZoneDuNavigateur | null {
  if (forumId === null) return null;
  return zones.find((z) => z.forumId === forumId) ?? null;
}

//  ── IL Y AVAIT `lieuxDepuis` ICI ────────────────────────────────────
//
//  Elle lisait les quinze lieux d'une zone dans son fichier de faune,
//  triés par nom, pour le menu « Où » de la barre d'actions. Le menu est
//  parti le 15 octobre au matin ; les lieux eux-mêmes l'après-midi :
//  « enlève tous les petits lieux. On a 3 paliers, 17 zones sauvages, et
//  tu répartis le pokédex comme ça. »
//
//  Une zone a maintenant une table par condition, et aucun nom de lieu.
//  `LieuChoisissable` et `domaine/lieu.ts` sont partis avec.
