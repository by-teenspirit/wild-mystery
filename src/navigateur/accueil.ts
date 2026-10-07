// ════════════════════════════════════════════════════════════════════
//  src/navigateur/accueil.ts
//
//  Ce que le bloc d'accueil affiche, lu dans `data/accueil.json`.
//
//  AUCUN DOM ICI. Ce fichier décide ce qui s'affiche et ce qui est
//  écarté ; `module-accueil.ts` le dessine. La séparation n'est pas une
//  politesse d'architecture : c'est ce qui permet de tester les sept
//  blocs sans navigateur, et ils ont chacun une règle d'écart.
//
//  ── LA RÈGLE, UNE FOIS POUR TOUTES : ON N'INVENTE RIEN ──────────────
//
//  Une entrée incomplète n'est jamais complétée. Elle est soit écartée,
//  soit affichée dans l'état, selon ce que son absence coûte :
//
//  · **une URL vide ne devient pas un lien.** Un `<a>` sans adresse
//    recharge la page et ne dit pas pourquoi. Le texte reste, en gris :
//    Callista VOIT ce qui lui manque, et un visiteur ne clique pas dans
//    le vide ;
//  · **une entrée sans texte disparaît.** Un partenaire sans nom, une
//    actualité sans titre : il n'y a rien à montrer, et une puce vide
//    dans une liste ressemble à un défaut d'affichage ;
//  · **une image absente n'est pas remplacée.** Pas de silhouette grise,
//    pas d'image par défaut : l'avatar manquant laisse un rond vide, qui
//    se remarque.
//
//  Le fichier entier illisible rend un accueil VIDE, et le module ne
//  dessine alors rien du tout — le bloc de repli collé dans le panneau
//  reste à l'écran. C'est le bon comportement : mieux vaut la version
//  sans JavaScript qu'une moitié de page.
// ════════════════════════════════════════════════════════════════════

/** Un lien : un texte, et une adresse qui peut manquer. */
export type Lien = {
  readonly texte: string;
  /** Vide quand elle n'est pas encore renseignée. Le module n'en fait
   *  alors pas un `<a>`. */
  readonly url: string;
};

export type Contexte = {
  readonly titre: string;
  readonly chapo: string;
  readonly paragraphes: readonly string[];
  readonly lien: Lien | null;
};

export type Partenaire = {
  readonly nom: string;
  readonly url: string;
  /** Une image propre au partenaire. Sans elle, c'est l'étoile de la
   *  maquette qui sert — elle est dessinée, pas téléchargée. */
  readonly image: string;
};

export type Vote = {
  readonly nom: string;
  readonly url: string;
  readonly image: string;
};

export type MembreDuStaff = {
  readonly pseudo: string;
  readonly role: string;
  readonly profil: string;
  readonly avatar: string;
  readonly personnages: readonly string[];
  /** « Présente », « Absente jusqu'au 3 », … Texte libre : c'est une
   *  phrase que le staff écrit, pas un état que le code connaît. */
  readonly presence: string;
};

export type Actualite = {
  readonly date: string;
  readonly titre: string;
  /** ÉVÉNEMENT, MISE À JOUR, ZONE, ANNONCE — en petites capitales dans
   *  la maquette, et c'est la feuille qui s'en charge. */
  readonly categorie: string;
  readonly url: string;
};

/** Une bulle de pré-lien. L'infobulle dit les trois choses que Callista
 *  a demandées le 7 octobre : le lien attendu, l'adresse du sujet, et
 *  qui l'attend. */
export type Prelien = {
  readonly personnage: string;
  readonly avatar: string;
  readonly lienAttendu: string;
  readonly auteur: string;
  readonly url: string;
};

export type Accueil = {
  readonly contexte: Contexte | null;
  readonly liens: readonly Lien[];
  readonly partenaires: {
    readonly titre: string;
    readonly lien: Lien | null;
    readonly liste: readonly Partenaire[];
  };
  readonly votes: { readonly titre: string; readonly liste: readonly Vote[] };
  readonly staff: readonly MembreDuStaff[];
  readonly actualites: {
    readonly titre: string;
    readonly lien: Lien | null;
    readonly liste: readonly Actualite[];
  };
  readonly preliens: { readonly titre: string; readonly liste: readonly Prelien[] };
  readonly images: {
    readonly mascotte: string;
    /** Le dégradé derrière l'étiquette « Staff », 99 × 318 dans la
     *  maquette. Décoratif : sans lui, l'étiquette reste lisible. */
    readonly bandeauStaff: string;
    readonly fond: string;
  };
};

/** L'accueil vide. Rendu quand le fichier est illisible, et c'est ce qui
 *  laisse le bloc de repli à l'écran. */
export const ACCUEIL_VIDE: Accueil = {
  contexte: null,
  liens: [],
  partenaires: { titre: "", lien: null, liste: [] },
  votes: { titre: "", liste: [] },
  staff: [],
  actualites: { titre: "", lien: null, liste: [] },
  preliens: { titre: "", liste: [] },
  images: { mascotte: "", bandeauStaff: "", fond: "" },
};

function objet(v: unknown): Record<string, unknown> | null {
  return typeof v === "object" && v !== null && !Array.isArray(v)
    ? v as Record<string, unknown>
    : null;
}

function texte(v: unknown): string {
  return typeof v === "string" ? v.replace(/\s+/g, " ").trim() : "";
}

function liste(v: unknown): readonly unknown[] {
  return Array.isArray(v) ? v : [];
}

/**
 * Une adresse, ou la chaîne vide.
 *
 * **CE N'EST PAS DE LA PARANOÏA.** Ce fichier est servi par GitHub
 * Pages et lu par un script qui tourne sur le forum : une adresse
 * `javascript:` y serait du code exécuté au clic, sur la page d'accueil,
 * pour tout le monde. On n'accepte donc que ce qui mène quelque part —
 * une adresse relative, ou `http(s)`.
 *
 * Même règle que `sourceDAvatar` dans `navigation.ts`, et pour la même
 * raison.
 */
export function adresse(brut: unknown): string {
  const u = texte(brut);
  if (u === "") return "";
  if (u.startsWith("/") || u.startsWith("./") || u.startsWith("#")) return u;
  if (/^https?:\/\//i.test(u)) return u;
  //  Tout le reste — `javascript:`, `data:`, `ftp:`, un schéma inventé —
  //  est écarté en silence : l'entrée s'affichera sans lien.
  return "";
}

function lienDepuis(v: unknown): Lien | null {
  const o = objet(v);
  if (o === null) return null;
  const t = texte(o.texte);
  //  Un lien sans texte n'a rien à afficher, même avec une adresse.
  return t === "" ? null : { texte: t, url: adresse(o.url) };
}

function contexteDepuis(v: unknown): Contexte | null {
  const o = objet(v);
  if (o === null) return null;
  const paragraphes = liste(o.paragraphes).map(texte).filter((p) => p !== "");
  const chapo = texte(o.chapo);
  //  Un contexte sans une ligne de texte est un bloc vide : on préfère
  //  ne pas le dessiner du tout.
  if (chapo === "" && paragraphes.length === 0) return null;
  return {
    titre: texte(o.titre) || "Contexte",
    chapo,
    paragraphes,
    lien: lienDepuis(o.lien),
  };
}

function partenairesDepuis(v: unknown): Accueil["partenaires"] {
  const o = objet(v) ?? {};
  return {
    titre: texte(o.titre),
    lien: lienDepuis(o.lien),
    liste: liste(o.liste).flatMap((b) => {
      const p = objet(b);
      if (p === null) return [];
      const nom = texte(p.nom);
      //  Un partenaire sans nom n'est pas affichable : son étoile serait
      //  un lien muet, que personne ne peut annoncer à voix haute.
      if (nom === "") return [];
      return [{ nom, url: adresse(p.url), image: adresse(p.image) }];
    }),
  };
}

function votesDepuis(v: unknown): Accueil["votes"] {
  const o = objet(v) ?? {};
  return {
    titre: texte(o.titre),
    liste: liste(o.liste).flatMap((b) => {
      const t = objet(b);
      if (t === null) return [];
      const nom = texte(t.nom);
      const url = adresse(t.url);
      //  UN BOUTON DE VOTE SANS ADRESSE N'EXISTE PAS. Contrairement au
      //  reste, on l'écarte : son seul contenu est une image, donc
      //  sans lien il ne reste qu'une vignette inerte.
      if (nom === "" || url === "") return [];
      return [{ nom, url, image: adresse(t.image) }];
    }),
  };
}

function staffDepuis(v: unknown): readonly MembreDuStaff[] {
  return liste(v).flatMap((b) => {
    const m = objet(b);
    if (m === null) return [];
    const pseudo = texte(m.pseudo);
    if (pseudo === "") return [];
    return [{
      pseudo,
      role: texte(m.role),
      profil: adresse(m.profil),
      avatar: adresse(m.avatar),
      personnages: liste(m.personnages).map(texte).filter((p) => p !== ""),
      presence: texte(m.presence),
    }];
  });
}

function actualitesDepuis(v: unknown): Accueil["actualites"] {
  const o = objet(v) ?? {};
  return {
    titre: texte(o.titre),
    lien: lienDepuis(o.lien),
    liste: liste(o.liste).flatMap((b) => {
      const a = objet(b);
      if (a === null) return [];
      const titre = texte(a.titre);
      if (titre === "") return [];
      return [{
        date: texte(a.date),
        titre,
        categorie: texte(a.categorie).toLocaleUpperCase("fr"),
        url: adresse(a.url),
      }];
    }),
  };
}

function preliensDepuis(v: unknown): Accueil["preliens"] {
  const o = objet(v) ?? {};
  return {
    titre: texte(o.titre),
    liste: liste(o.liste).flatMap((b) => {
      const p = objet(b);
      if (p === null) return [];
      const personnage = texte(p.personnage);
      //  LE NOM DU PERSONNAGE EST LA SEULE CHOSE INDISPENSABLE : c'est
      //  lui qui nomme la bulle pour qui l'écoute. Le reste de
      //  l'infobulle peut manquer ligne à ligne.
      if (personnage === "") return [];
      return [{
        personnage,
        avatar: adresse(p.avatar),
        lienAttendu: texte(p.lienAttendu),
        auteur: texte(p.auteur),
        url: adresse(p.url),
      }];
    }),
  };
}

/** Tout le bloc d'accueil, lu et nettoyé. Ne lève jamais. */
export function accueilDepuis(brut: unknown): Accueil {
  const o = objet(brut);
  if (o === null) return ACCUEIL_VIDE;
  const images = objet(o.images) ?? {};
  return {
    contexte: contexteDepuis(o.contexte),
    liens: liste(o.liens).flatMap((l) => {
      const lien = lienDepuis(l);
      return lien === null ? [] : [lien];
    }),
    partenaires: partenairesDepuis(o.partenaires),
    votes: votesDepuis(o.votes),
    staff: staffDepuis(o.staff),
    actualites: actualitesDepuis(o.actualites),
    preliens: preliensDepuis(o.preliens),
    images: {
      mascotte: adresse(images.mascotte),
      bandeauStaff: adresse(images.bandeauStaff),
      fond: adresse(images.fond),
    },
  };
}

/** Vrai quand il n'y a RIEN à dessiner.
 *
 *  Le module s'en sert pour ne pas remplacer le bloc de repli par un
 *  panneau vide : une page d'accueil blanche est pire qu'une page
 *  d'accueil sans JavaScript. */
export function estVide(a: Accueil): boolean {
  return a.contexte === null &&
    a.liens.length === 0 &&
    a.partenaires.liste.length === 0 &&
    a.votes.liste.length === 0 &&
    a.staff.length === 0 &&
    a.actualites.liste.length === 0 &&
    a.preliens.liste.length === 0;
}

/** Ce que l'infobulle d'une bulle de pré-lien annonce, ligne à ligne.
 *
 *  Trois choses, demandées par Callista le 7 octobre : le lien attendu
 *  avec l'autre personnage, l'adresse du pré-lien, et qui l'attend. On
 *  rend les lignes PRÉSENTES, pas des cases vides : une infobulle qui
 *  dit « attendu par : » suivi de rien fait douter du reste. */
export function lignesDUnPrelien(p: Prelien): readonly { cle: string; valeur: string }[] {
  const out: { cle: string; valeur: string }[] = [];
  if (p.lienAttendu !== "") out.push({ cle: "Lien attendu", valeur: p.lienAttendu });
  if (p.auteur !== "") out.push({ cle: "Attendu par", valeur: p.auteur });
  return out;
}
