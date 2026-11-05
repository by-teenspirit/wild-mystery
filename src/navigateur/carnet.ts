// ════════════════════════════════════════════════════════════════════
//  src/navigateur/carnet.ts — ce que le carnet AFFICHE, sans DOM
//
//  Le module d'interface (`module-carnet.ts`) pose des éléments ; ce
//  fichier-ci décide quoi poser. Il ne connaît ni `document`, ni
//  `fetch`, ni Supabase : il prend l'objet que `carnet()` a rendu et
//  rend des vues, qui se testent sans navigateur.
//
//  ── LA RÈGLE QUI TIENT L'ONGLET ─────────────────────────────────────
//
//  « Un seul appel au chargement, changer d'onglet ne déclenche aucune
//  requête » (Figma 371:688). Donc TOUTES les vues se calculent à
//  partir du même objet, et aucune ne peut avoir besoin d'une donnée
//  qui n'y est pas. Quand il en manque une — les huit arènes, par
//  exemple — la vue le dit en rendant moins, jamais en inventant.
// ════════════════════════════════════════════════════════════════════

/** Ce que `carnet()` rend. Les champs qu'on n'affiche pas sont absents
 *  d'ici exprès : une interface qui déclare plus que la page n'utilise
 *  finit par servir de documentation fausse. */
export interface Dresseur {
  joueurId: string;
  forumUserId: number;
  pseudo: string;
  groupe: string | null;
  palier: number | null;
  pokedollars: number;
  lieLe: string | null;
}

export interface PokemonDuCarnet {
  id: string;
  especeId: number;
  surnom: string | null;
  niveau: number;
  xp: number;
  sexe: string | null;
  obscur: boolean;
  etoiles: number | null;
  emplacement: string;
  /** 0 pour l'équipe, 1 à 3 pour les boîtes. */
  boite: number;
  place: number | null;
  captureLe: string | null;
  captureDans: number | null;
  enPension: boolean;
}

export interface LigneDePension {
  id: string;
  pokemonId: string;
  gerantId: number | null;
  deposeLe: string;
  niveauAuDepot: number;
  tarif: number | null;
}

export interface Badge {
  arene: string;
  obtenuLe: string;
}

export interface LigneDeSac {
  objetId: number;
  quantite: number;
}

export interface LignePokedex {
  especeId: number;
  croiseLe: string | null;
  attrapeLe: string | null;
  fois: number;
}

export interface Jet {
  messageId: number;
  sujetId: number;
  type: string;
  charge: unknown;
  code: string;
  creeLe: string;
}

export interface Carnet {
  dresseur: Dresseur | null;
  pokemon: PokemonDuCarnet[];
  pension: LigneDePension[];
  badges: Badge[];
  sac: LigneDeSac[];
  pokedex: LignePokedex[];
  dernierJet: Jet | null;
}

/** Les sept onglets, dans l'ordre de la barre latérale. L'ordre vient
 *  de la maquette et il est le même sur les huit écrans. */
export const ONGLETS = [
  { clef: "mes-rp", titre: "Mes RP" },
  { clef: "ecrire", titre: "Écrire" },
  { clef: "mon-histoire", titre: "Mon histoire" },
  { clef: "mes-liens", titre: "Mes liens" },
  { clef: "mon-jeu", titre: "Mon jeu" },
  { clef: "mes-boites", titre: "Mes boîtes" },
  { clef: "mon-sac", titre: "Mon sac" },
  { clef: "mon-pokedex", titre: "Mon Pokédex" },
] as const;

export type ClefDOnglet = typeof ONGLETS[number]["clef"];

export const ONGLET_PAR_DEFAUT: ClefDOnglet = "mon-jeu";

/** L'onglet que l'adresse demande.
 *
 *  LE FILTRE DU POKÉDEX PARTAGE LE MÊME DIÈSE (`#zone-05`, note
 *  389:1143). Un fragment inconnu n'est donc PAS une erreur : il veut
 *  dire « un autre mécanisme s'en occupe », et on rend l'onglet par
 *  défaut plutôt que de voler le fragment à qui de droit. */
export function ongletDeLAdresse(fragment: string): ClefDOnglet {
  const propre = fragment.replace(/^#/, "").trim().toLowerCase();
  const trouve = ONGLETS.find((o) => o.clef === propre);
  return trouve === undefined ? ONGLET_PAR_DEFAUT : trouve.clef;
}

/** Les six places de l'équipe, trous compris.
 *
 *  LES TROUS SONT DES VUES, PAS DES ABSENCES. La maquette dessine
 *  « Place libre » : si on rendait seulement les pokémon présents, la
 *  grille se refermerait sur quatre cases et on ne verrait plus qu'il
 *  reste de la place. */
export const PLACES_DEQUIPE = 6;

export interface PlaceDEquipe {
  place: number;
  pokemon: PokemonDuCarnet | null;
}

export function equipeAffichee(pokemon: PokemonDuCarnet[]): PlaceDEquipe[] {
  const dansLEquipe = pokemon.filter((p) => p.emplacement === "equipe");
  const places: PlaceDEquipe[] = [];
  for (let i = 1; i <= PLACES_DEQUIPE; i += 1) {
    //  `place` peut être nul en base ; ces pokémon-là comblent les
    //  cases restantes dans l'ordre où ils viennent, plutôt que de
    //  disparaître de l'écran.
    places.push({ place: i, pokemon: dansLEquipe.find((p) => p.place === i) ?? null });
  }
  const sansPlace = dansLEquipe.filter((p) => p.place === null);
  for (const p of sansPlace) {
    const libre = places.find((c) => c.pokemon === null);
    if (libre !== undefined) libre.pokemon = p;
  }
  return places;
}

export interface Arene {
  nom: string;
  slug: string;
  type: string;
  ville: string;
  genre: "arene" | "colosseum";
}

export interface CaseDeBadge {
  arene: string;
  slug: string | null;
  type: string | null;
  obtenuLe: string | null;
}

/** Les cases de badges, d'un genre : les sept arènes, ou les quatre
 *  colosseums.
 *
 *  SANS LA LISTE, ON NE DESSINE QUE LES BADGES OBTENUS. Une liste vide
 *  veut dire qu'on ne sait pas ce qui existe ; dessiner des cases « à
 *  gagner » sans savoir lesquelles serait écrire le jeu à la place de
 *  Callista. */
export function badgesAffiches(
  badges: Badge[],
  arenes: Arene[],
  genre: "arene" | "colosseum" = "arene",
): CaseDeBadge[] {
  const liste = arenes.filter((a) => a.genre === genre);
  if (liste.length === 0) {
    const connus = new Set(arenes.map((a) => a.nom));
    return badges
      .filter((b) => arenes.length === 0 || !connus.has(b.arene))
      .map((b) => ({ arene: b.arene, slug: null, type: null, obtenuLe: b.obtenuLe }));
  }
  return liste.map((a) => ({
    arene: a.nom,
    slug: a.slug,
    type: a.type,
    obtenuLe: badges.find((b) => b.arene === a.nom)?.obtenuLe ?? null,
  }));
}

/** « 3 / 7 » — le compteur de la Ligue.
 *
 *  IL NE COMPTE QUE LES ARÈNES. La planche 36 dit qu'il faut les sept
 *  badges d'arène « ainsi que les Colosseums », la maquette de Mon jeu
 *  écrit « les colosseums, eux, ne comptent pas », et `paliers_a_revoir()`
 *  met son seuil à 7. Deux sources sur trois comptent sept : on compte
 *  sept, et on montre les colosseums à part plutôt que de les noyer. */
export function compteDeBadges(badges: Badge[], arenes: Arene[]): string {
  const liste = arenes.filter((a) => a.genre === "arene");
  const noms = new Set(liste.map((a) => a.nom));
  const obtenus = liste.length === 0
    ? badges.length
    : badges.filter((b) => noms.has(b.arene)).length;
  return liste.length === 0 ? `${obtenus}` : `${obtenus} / ${liste.length}`;
}

/** Les familles du sac, dans l'ordre de la maquette, avec le titre
 *  qu'elle leur donne.
 *
 *  LES TITRES NE SONT PAS DANS `objets.json` : ce fichier porte des
 *  descriptions en phrases (« Les balls de capture. Vendues partout. »),
 *  qui ne tiennent pas en tête de section. Les voici, et ils sont ici
 *  plutôt que dans les données parce qu'ils appartiennent à cet écran. */
export const FAMILLES_DU_SAC: { famille: string; titre: string }[] = [
  { famille: "ball", titre: "Pour attraper" },
  { famille: "soin", titre: "Pour soigner" },
  { famille: "statut", titre: "Contre les statuts" },
  { famille: "rappel", titre: "Pour ranimer" },
  { famille: "evolution", titre: "Les cailloux étranges" },
  { famille: "tenu", titre: "À faire tenir" },
  { famille: "fossile", titre: "Les fossiles" },
];

export interface ObjetDuCatalogue {
  id: number;
  slug: string;
  nom: string;
  famille: string;
  /** Facultatif : la maquette montre une phrase à droite de chaque
   *  objet, et `objets.json` ne la porte pas encore. Quand elle est
   *  absente, la ligne se dessine sans — pas avec un texte inventé. */
  aQuoiCaSert?: string;
}

export interface SectionDuSac {
  famille: string;
  titre: string;
  lignes: { objet: ObjetDuCatalogue; quantite: number }[];
}

/** Le sac rangé par famille.
 *
 *  UNE FAMILLE VIDE NE SORT PAS : une section « Les fossiles » sans
 *  fossile dit au joueur qu'il lui en manque, ce qui n'est pas le
 *  propos d'un inventaire.
 *
 *  UN OBJET HORS CATALOGUE NE SE PERD PAS. Il irait dans aucune
 *  famille et disparaîtrait de l'écran alors qu'il est dans le sac :
 *  il tombe dans une dernière section, sous son identifiant. */
export function sacRange(
  sac: LigneDeSac[],
  catalogue: ObjetDuCatalogue[],
): SectionDuSac[] {
  const parId = new Map(catalogue.map((o) => [o.id, o]));
  const sections: SectionDuSac[] = [];

  for (const { famille, titre } of FAMILLES_DU_SAC) {
    const lignes = sac
      .map((l) => ({ objet: parId.get(l.objetId), quantite: l.quantite }))
      .filter((l): l is { objet: ObjetDuCatalogue; quantite: number } =>
        l.objet !== undefined && l.objet.famille === famille
      )
      .sort((a, b) => a.objet.nom.localeCompare(b.objet.nom, "fr"));
    if (lignes.length > 0) sections.push({ famille, titre, lignes });
  }

  const inconnus = sac.filter((l) => !parId.has(l.objetId));
  if (inconnus.length > 0) {
    sections.push({
      famille: "inconnu",
      titre: "Pas encore au catalogue",
      lignes: inconnus.map((l) => ({
        objet: {
          id: l.objetId,
          slug: "",
          nom: `Objet n° ${l.objetId}`,
          famille: "inconnu",
        },
        quantite: l.quantite,
      })),
    });
  }
  return sections;
}

export interface EspeceDeRhode {
  no: number;
  id: number;
  nom: string;
  types: string[];
  zone: number;
  min: number;
  max: number;
  quand: string;
}

export type EtatDEspece = "inconnu" | "croise" | "attrape";

/** L'état que dit UNE ligne de pokédex, ou `inconnu` s'il n'y en a pas.
 *
 *  TROIS ÉTATS, PAS QUATRE, et `attrape_le` l'emporte sur `croise_le` :
 *  on n'attrape pas sans croiser, et montrer les deux ferait une
 *  quatrième case que la note interdit.
 *
 *  LA RÈGLE EST ICI, ET NULLE PART AILLEURS. Elle servait au seul
 *  Pokédex du carnet ; depuis le 5 novembre l'annexe des zones la
 *  demande aussi — « affiche le numéro du pokémon + une icône si on
 *  l'a déjà vu ou si on l'a dans notre pokédex ». Deux pages qui
 *  décident séparément de la même chose finissent par en décider
 *  deux. */
export function etatDeLaLigne(
  l: { croiseLe: string | null; attrapeLe: string | null } | undefined,
): EtatDEspece {
  if (l === undefined || (l.croiseLe === null && l.attrapeLe === null)) return "inconnu";
  return l.attrapeLe !== null ? "attrape" : "croise";
}

/** Les états du joueur, rangés par identifiant d'espèce.
 *
 *  ON NE REND QUE CE QUE LA BASE A DIT. Les espèces absentes du relevé
 *  n'entrent pas dans la table : l'appelant trouvera `undefined`, qui
 *  veut dire « jamais rencontrée » — et une table de 933 entrées dont
 *  900 disent `inconnu` serait la même information en vingt fois plus
 *  gros.
 *
 *  LES LIGNES À ZÉRO SONT ÉCARTÉES AUSSI : une ligne qui existe avec
 *  ses deux dates vides est une ligne qui ne dit rien, et la laisser
 *  entrer ferait porter une marque « inconnu » à une carte. */
export function etatsParEspece(
  lignes: readonly LignePokedex[],
): ReadonlyMap<number, EtatDEspece> {
  const table = new Map<number, EtatDEspece>();
  for (const l of lignes) {
    const etat = etatDeLaLigne(l);
    if (etat === "inconnu") continue;
    //  UNE ESPÈCE DEUX FOIS DANS LE RELEVÉ : la plus avancée gagne.
    //  La base a une clé unique dessus, donc ça ne doit pas arriver —
    //  mais si ça arrive, perdre une capture serait le pire des deux
    //  résultats possibles.
    if (table.get(l.especeId) === "attrape") continue;
    table.set(l.especeId, etat);
  }
  return table;
}

export interface CaseDePokedex {
  espece: EspeceDeRhode;
  etat: EtatDEspece;
  fois: number;
  croiseLe: string | null;
  attrapeLe: string | null;
}

/** Les 933 cases, toutes, dans l'ordre régional.
 *
 *  TOUTES, ET DÈS LE CHARGEMENT : « les filtres cachent et montrent,
 *  ils ne rechargent rien » (note 389:1143). La grille entière est donc
 *  construite une fois, et filtrer n'est plus qu'une affaire de classe
 *  CSS.
 *
 *  TROIS ÉTATS, PAS QUATRE. `attrape_le` l'emporte sur `croise_le` :
 *  on n'attrape pas sans croiser, et afficher les deux ferait une
 *  quatrième case que la note interdit. */
export function pokedexAffiche(
  catalogue: EspeceDeRhode[],
  lignes: LignePokedex[],
): CaseDePokedex[] {
  const parEspece = new Map(lignes.map((l) => [l.especeId, l]));
  return catalogue.map((espece) => {
    const l = parEspece.get(espece.id);
    const etat = etatDeLaLigne(l);
    return {
      espece,
      etat,
      fois: l?.fois ?? 0,
      croiseLe: l?.croiseLe ?? null,
      attrapeLe: l?.attrapeLe ?? null,
    };
  });
}

export interface CompteDuPokedex {
  attrapees: number;
  croisees: number;
  enTout: number;
}

/** Les trois chiffres du bandeau.
 *
 *  `croisees` COMPTE AUSSI LES ATTRAPÉES. La maquette montre 31 / 64 /
 *  120 et dit « la barre pleine, ce sont les captures ; la barre pâle,
 *  ce que tu as seulement croisé » : la seconde barre part de zéro, pas
 *  de la fin de la première. Compter les croisées sans les attrapées
 *  donnerait une barre pâle plus courte que la pleine. */
export function compteDuPokedex(cases: CaseDePokedex[]): CompteDuPokedex {
  return {
    attrapees: cases.filter((c) => c.etat === "attrape").length,
    croisees: cases.filter((c) => c.etat !== "inconnu").length,
    enTout: cases.length,
  };
}

/** Le nom qu'on affiche pour un pokémon : son surnom s'il en a un,
 *  sinon le nom de son espèce. */
export function nomAffiche(
  p: { surnom: string | null; especeId: number },
  especes: ReadonlyMap<number, string>,
): string {
  const surnom = p.surnom?.trim() ?? "";
  if (surnom !== "") return surnom;
  return especes.get(p.especeId) ?? `N° ${p.especeId}`;
}

/** « 7 440 / 12 000 XP » — jamais la barre seule.
 *
 *  « Une barre sans chiffre n'est lisible ni au lecteur d'écran ni à
 *  l'œil qui compare deux jours » (note 371:719). Cette fonction existe
 *  pour qu'aucune jauge de la page ne puisse être dessinée sans son
 *  texte : la barre et le texte sortent du même appel. */
export function jauge(fait: number, total: number): { part: number; texte: string } {
  const sur = total <= 0 ? 0 : Math.max(0, Math.min(1, fait / total));
  return { part: sur, texte: `${chiffre(fait)} / ${chiffre(total)}` };
}

/** Les milliers séparés par une espace fine insécable, le séparateur
 *  français.
 *
 *  PAS `toLocaleString("fr-FR")`, ET ÇA A COÛTÉ UN TEST. Il rend tantôt
 *  une espace insécable, tantôt une fine selon la version d'ICU du
 *  moteur : le même code donne deux chaînes différentes entre le Deno
 *  du CI et le Chromium du harnais. Un séparateur écrit ici est le même
 *  partout, et il est mesurable. */
export function chiffre(n: number): string {
  const signe = n < 0 ? "-" : "";
  const entier = Math.abs(Math.trunc(n)).toString();
  let sortie = "";
  for (let i = 0; i < entier.length; i += 1) {
    if (i > 0 && (entier.length - i) % 3 === 0) sortie += " ";
    sortie += entier[i];
  }
  return signe + sortie;
}
