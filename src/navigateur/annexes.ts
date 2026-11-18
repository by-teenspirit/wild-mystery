// ════════════════════════════════════════════════════════════════════
//  src/navigateur/annexes.ts
//
//  Le sommaire des annexes : le lire, et savoir laquelle on est en train
//  de lire. Pur — aucun DOM, aucun réseau.
//
//  ── POURQUOI UN SOMMAIRE CALCULÉ ET PAS RECOPIÉ ─────────────────────
//
//  Douze pages portent le même sommaire de douze entrées. Recopié dans
//  chacune, changer un titre demande douze collages à la main, et le
//  treizième jour il y a deux versions du sommaire sur le forum. Il vit
//  donc dans `data/annexes.json`, et chaque page n'en porte qu'un trou :
//  `<nav data-wm-sommaire></nav>`.
//
//  **C'est le même raisonnement que les zones et que le catalogue** : la
//  donnée dans `data/`, le balisage réduit à un point d'accroche.
//
//  ── UNE ENTRÉE SANS ADRESSE N'EST PAS UN LIEN ───────────────────────
//
//  Neuf des douze pages n'existent pas encore. Les afficher en lien
//  donnerait neuf liens morts ; les cacher donnerait l'impression que le
//  forum n'a que trois annexes. On les affiche donc **sans lien**, et
//  c'est la vérité : voilà ce qui est prévu, voilà ce qui est écrit.
//
//  ── ET UN FICHIER ILLISIBLE REND UN SOMMAIRE VIDE ───────────────────
//
//  Comme la faune et les zones : rien ne lève. Sans sommaire la page
//  reste lisible — c'est du texte dans une colonne.
// ════════════════════════════════════════════════════════════════════

export type EntreeDAnnexe = {
  readonly numero: string;
  readonly slug: string;
  readonly titre: string;
  /** `null` quand la page n'est pas encore créée sur le forum. */
  readonly adresse: string | null;
};

export type SectionDAnnexes = {
  readonly titre: string;
  readonly entrees: readonly EntreeDAnnexe[];
};

export type Sommaire = {
  readonly sections: readonly SectionDAnnexes[];
};

const VIDE: Sommaire = { sections: [] };

//  PAS DE PIED. J'en avais inventé un — « Pour aller plus loin » et trois
//  liens — en lisant la description du gabarit. La maquette (`245:1772`)
//  n'en a pas : sous les douze entrées, il n'y a que du vide.

function texte(v: unknown): string {
  return typeof v === "string" ? v.replace(/\s+/g, " ").trim() : "";
}

/** Une adresse interne au forum, ou null.
 *
 *  **Seules les adresses relatives commençant par `/` sont acceptées.**
 *  Un `http://autre-site` dans un fichier de données du dépôt n'aurait
 *  aucune raison d'y être, et un sommaire est exactement l'endroit où
 *  personne ne relirait un lien sortant.
 *
 *  **`//ailleurs.example` est refusé aussi**, et c'est un test qui l'a
 *  trouvé : une adresse à double barre est protocole-relative, donc elle
 *  sort du forum tout en commençant par `/`. « Commence par une barre »
 *  ne veut pas dire « interne ». */
function adresse(v: unknown): string | null {
  const a = texte(v);
  return /^\/(?!\/)[^\s]*$/.test(a) ? a : null;
}

function entreeDepuis(brute: unknown): EntreeDAnnexe | null {
  if (typeof brute !== "object" || brute === null) return null;
  const r = brute as Record<string, unknown>;
  const titre = texte(r.titre);
  const slug = texte(r.slug);
  //  Le titre et le slug sont obligatoires : sans titre il n'y a rien à
  //  afficher, sans slug on ne peut pas reconnaître la page courante.
  if (titre === "" || slug === "") return null;
  return { numero: texte(r.numero), slug, titre, adresse: adresse(r.adresse) };
}

/** Le sommaire, relu plutôt que supposé. */
export function sommaireDepuis(donnees: unknown): Sommaire {
  if (typeof donnees !== "object" || donnees === null) return VIDE;
  const d = donnees as Record<string, unknown>;
  if (!Array.isArray(d.sections)) return VIDE;

  const sections: SectionDAnnexes[] = [];
  for (const brute of d.sections) {
    if (typeof brute !== "object" || brute === null) continue;
    const s = brute as Record<string, unknown>;
    if (!Array.isArray(s.entrees)) continue;
    const entrees = s.entrees.map(entreeDepuis).filter((e): e is EntreeDAnnexe => e !== null);
    //  Une section sans entrée lisible n'est qu'un intertitre orphelin.
    if (entrees.length > 0) sections.push({ titre: texte(s.titre), entrees });
  }

  return { sections };
}

/** Le slug de la page courante, lu dans l'adresse.
 *
 *  `/h20-le-reglement` → `le-reglement`.
 *
 *  IL NE SUFFIT PLUS À LUI SEUL depuis le 18 novembre : le titre tapé
 *  dans le panneau décide de ce bout-là, et il ne ressemble pas
 *  toujours à notre slug. « Les groupes » donne `/h5-les-groupes`, et
 *  notre clé interne est `groupes` ; « Arènes, colosseums & Ligue »
 *  donne `ligue` là où nous écrivons `ligues`. Onze pages sur quinze
 *  ne se reconnaissaient plus.
 *
 *  Gardé comme SECOND recours, pour une page dont l'adresse n'a pas
 *  encore été reportée. */
export function slugDepuisAdresse(chemin: string): string | null {
  const trouve = /^\/h\d+-([a-z0-9-]+)\/?$/.exec(chemin);
  return trouve === null ? null : trouve[1];
}

/** Le numéro de page Forumactif d'une adresse : `/h12-x` → 12.
 *
 *  C'EST LA SEULE PARTIE QUI IDENTIFIE VRAIMENT LA PAGE. Forumactif
 *  sert `/h12-n-importe-quoi` pour la page 12 ; le reste est
 *  décoratif, et il change dès qu'on renomme le titre. Comparer les
 *  numéros, c'est comparer ce que le forum garantit.
 *
 *  Marche sur un chemin (`/h12-x`) comme sur une adresse entière
 *  (`https://…/h12-x`), parce que `data/annexes.json` porte les deux
 *  formes selon l'époque où la ligne a été écrite. */
export function pageDeLAdresse(adresse: string | null): number | null {
  if (adresse === null) return null;
  const trouve = /\/h(\d+)(?:-|\/|$)/.exec(adresse);
  if (trouve === null) return null;
  const n = Number(trouve[1]);
  return Number.isInteger(n) && n > 0 ? n : null;
}

export type EntreeAffichee = EntreeDAnnexe & {
  readonly active: boolean;
  /** Vrai quand la page n'existe pas encore : affichée, pas cliquable. */
  readonly aVenir: boolean;
};

export type SectionAffichee = {
  readonly titre: string;
  readonly entrees: readonly EntreeAffichee[];
};

/** Le sommaire prêt à poser, l'entrée courante marquée.
 *
 *  **L'entrée active n'est pas un lien non plus.** Un lien vers la page
 *  qu'on lit déjà ne mène nulle part ; le gabarit la distingue par un
 *  fond et un filet à gauche, ce qui est déjà ce qu'elle doit dire. */
export function sommaireAffiche(
  sommaire: Sommaire,
  slugCourant: string | null,
  /** Le numéro de page Forumactif de la page lue, quand on l'a. C'est
   *  LUI qui désigne l'entrée courante ; le slug ne sert plus que de
   *  second recours. */
  pageCourante: number | null = null,
): readonly SectionAffichee[] {
  return sommaire.sections.map((s) => ({
    titre: s.titre,
    entrees: s.entrees.map((e) => {
      const sienne = pageDeLAdresse(e.adresse);
      //  LE NUMÉRO D'ABORD, LE SLUG ENSUITE.
      //
      //  Quand les deux numéros sont connus, ils TRANCHENT : c'est ce
      //  que Forumactif garantit, et le slug ne peut plus créer ni
      //  faux positif ni faux négatif.
      //
      //  Le slug ne sert que lorsqu'un des deux numéros manque — une
      //  entrée dont l'adresse n'a pas encore été reportée, ou un
      //  appelant qui ne sait pas sur quelle page il est. Sans ce
      //  recours, une page toute neuve ne se surlignerait jamais.
      const active = sienne !== null && pageCourante !== null
        ? sienne === pageCourante
        : slugCourant !== null && e.slug === slugCourant;
      return {
        ...e,
        active,
        //  UNE PAGE QU'ON EST EN TRAIN DE LIRE N'EST PAS « À VENIR ».
        //  `adresse` dit seulement si quelqu'un l'a reportée dans
        //  `annexes.json` ; la page, elle, est sous les yeux. Sans
        //  cette ligne, son entrée cumulait le fond d'accent de
        //  l'entrée courante et la pâleur de l'entrée absente, et
        //  tombait à 3,47 de contraste — la seule illisible du
        //  sommaire, sur chacune des pages pas encore reportées.
        aVenir: e.adresse === null && !active,
      };
    }),
  }));
}
