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

export type LienDePied = {
  readonly titre: string;
  readonly adresse: string;
};

export type Sommaire = {
  readonly sections: readonly SectionDAnnexes[];
  readonly piedTitre: string;
  readonly piedLiens: readonly LienDePied[];
};

const VIDE: Sommaire = { sections: [], piedTitre: "", piedLiens: [] };

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

  const pied = typeof d.pied === "object" && d.pied !== null
    ? d.pied as Record<string, unknown>
    : {};
  const liens: LienDePied[] = [];
  if (Array.isArray(pied.liens)) {
    for (const brut of pied.liens) {
      if (typeof brut !== "object" || brut === null) continue;
      const l = brut as Record<string, unknown>;
      const titre = texte(l.titre);
      const ou = adresse(l.adresse);
      if (titre !== "" && ou !== null) liens.push({ titre, adresse: ou });
    }
  }

  return { sections, piedTitre: texte(pied.titre), piedLiens: liens };
}

/** Le slug de la page courante, lu dans l'adresse.
 *
 *  `/h20-le-reglement` → `le-reglement`. On lit le SLUG et pas le numéro
 *  de page : `h20` dépend de l'ordre de création des pages chez
 *  Forumactif, le slug est celui qu'on a choisi. Déplacer une annexe
 *  d'un numéro à l'autre ne doit pas décrocher le sommaire.
 *
 *  Forumactif tolère n'importe quel suffixe après le numéro : `/h20-x`
 *  sert la même page que `/h20-le-reglement`. Le sommaire n'y reconnaît
 *  alors rien, et c'est bien — il ne surligne pas au hasard. */
export function slugDepuisAdresse(chemin: string): string | null {
  const trouve = /^\/h\d+-([a-z0-9-]+)\/?$/.exec(chemin);
  return trouve === null ? null : trouve[1];
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
): readonly SectionAffichee[] {
  return sommaire.sections.map((s) => ({
    titre: s.titre,
    entrees: s.entrees.map((e) => ({
      ...e,
      active: slugCourant !== null && e.slug === slugCourant,
      aVenir: e.adresse === null,
    })),
  }));
}
