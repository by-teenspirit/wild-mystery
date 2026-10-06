// ════════════════════════════════════════════════════════════════════
//  src/navigateur/navigation.ts
//
//  Ce que la barre et le panneau latéral affichent. Pur — aucun DOM,
//  aucun réseau.
//
//  ── DEUX BARRES, ET ON NE LES MÉLANGE PAS ───────────────────────────
//
//  La **barre normale** (`ul#modernbb-nav-menu`) porte le logo et les
//  cinq liens. La **barre Forumactif** (`#fa_toolbar`) porte le profil et
//  les notifications. Ce fichier décrit les deux, mais ce qui les
//  distingue tient à une règle :
//
//  **Les adresses de la barre Forumactif ne se fabriquent jamais.** La
//  déconnexion porte un jeton de session ; un lien reconstruit serait
//  faux, et le joueur verrait une page d'erreur au lieu de se
//  déconnecter. On réutilise l'ancre que la page contient déjà.
//
//  Les adresses de la barre normale, elles, sont des routes stables de
//  Forumactif (`/search`, `/groups`, `/privmsg`) : celles-là se posent
//  dans `data/navigation.json`.
//
//  ── ET LES PERSONNAGES NE S'INVENTENT PAS ───────────────────────────
//
//  La liste « Mes personnages » est le **switcheroo** : les comptes que
//  Forumactif connaît. Elle n'est donc pas dans un fichier de données et
//  ne peut pas l'être — elle se lit dans la page, et si la page n'en
//  porte aucun, la section ne s'affiche pas. Un personnage inventé dans
//  un panneau de changement de compte serait un bouton qui ne mène nulle
//  part, sous un nom qui n'existe pas.
// ════════════════════════════════════════════════════════════════════

export type Lien = {
  readonly clef: string;
  readonly titre: string;
  readonly adresse: string;
};

export type LienUtile = {
  readonly icone: string;
  readonly titre: string;
  /** `null` quand la page n'existe pas encore : affichée, pas cliquable. */
  readonly adresse: string | null;
};

export type EntreeDeCompte = {
  readonly icone: string;
  readonly titre: string;
  /** `{id}` y est remplacé par l'identifiant du compte. `null` = pas de page. */
  readonly modele: string | null;
};

export type Navigation = {
  readonly liens: readonly Lien[];
  readonly utiles: readonly LienUtile[];
  readonly compte: readonly EntreeDeCompte[];
};

const VIDE: Navigation = { liens: [], utiles: [], compte: [] };

function texte(v: unknown): string {
  return typeof v === "string" ? v.replace(/\s+/g, " ").trim() : "";
}

/** Une adresse interne au forum, ou null.
 *
 *  `//ailleurs.example` est refusé comme au sommaire des annexes : une
 *  adresse à double barre est protocole-relative, donc elle sort du
 *  forum tout en commençant par une barre. */
function adresse(v: unknown): string | null {
  const a = texte(v);
  return /^\/(?!\/)[^\s]*$/.test(a) ? a : null;
}

/** Un nom d'icône Material Symbols : des minuscules et des soulignés.
 *
 *  Borné parce qu'il entre dans le DOM comme contenu textuel : la police
 *  lit le mot, et un mot inattendu s'afficherait en toutes lettres au
 *  milieu de la barre. */
function icone(v: unknown): string {
  const i = texte(v);
  return /^[a-z][a-z0-9_]{0,31}$/.test(i) ? i : "";
}

export function navigationDepuis(donnees: unknown): Navigation {
  if (typeof donnees !== "object" || donnees === null) return VIDE;
  const d = donnees as Record<string, unknown>;

  const liens: Lien[] = [];
  if (Array.isArray(d.liens)) {
    for (const brut of d.liens) {
      if (typeof brut !== "object" || brut === null) continue;
      const l = brut as Record<string, unknown>;
      const titre = texte(l.titre);
      const clef = texte(l.clef);
      const ou = adresse(l.adresse);
      //  Un lien de la barre SANS adresse n'a pas de sens : la barre
      //  n'affiche que des destinations. C'est le panneau latéral qui
      //  montre ce qui n'existe pas encore.
      if (titre !== "" && clef !== "" && ou !== null) liens.push({ clef, titre, adresse: ou });
    }
  }

  const utiles: LienUtile[] = [];
  if (Array.isArray(d.utiles)) {
    for (const brut of d.utiles) {
      if (typeof brut !== "object" || brut === null) continue;
      const u = brut as Record<string, unknown>;
      const titre = texte(u.titre);
      if (titre === "") continue;
      utiles.push({ icone: icone(u.icone), titre, adresse: adresse(u.adresse) });
    }
  }

  const compte: EntreeDeCompte[] = [];
  if (Array.isArray(d.compte)) {
    for (const brut of d.compte) {
      if (typeof brut !== "object" || brut === null) continue;
      const c = brut as Record<string, unknown>;
      const titre = texte(c.titre);
      if (titre === "") continue;
      const m = texte(c.modele);
      compte.push({
        icone: icone(c.icone),
        titre,
        //  Le modèle garde son `{id}` : il n'est pas une adresse tant
        //  qu'on n'a pas l'identifiant, donc il ne passe pas par
        //  `adresse()`, qui le refuserait sur le `{`.
        modele: /^\/(?!\/)\S*$/.test(m) ? m : null,
      });
    }
  }

  return { liens, utiles, compte };
}

/** L'adresse d'une entrée de compte, pour un identifiant donné.
 *
 *  Rend `null` quand l'entrée n'a pas de page, ou quand on ne connaît pas
 *  l'identifiant alors que le modèle en demande un — plutôt qu'un lien
 *  vers `/u{id}` écrit en toutes lettres. */
export function adresseDeCompte(
  entree: EntreeDeCompte,
  identifiant: number | null,
): string | null {
  if (entree.modele === null) return null;
  if (!entree.modele.includes("{id}")) return entree.modele;
  if (identifiant === null || !Number.isInteger(identifiant) || identifiant <= 0) return null;
  return entree.modele.replace("{id}", String(identifiant));
}

/** Le lien de la barre qui correspond à la page courante, ou null.
 *
 *  La comparaison est sur le DÉBUT du chemin, et `/` est traité à part :
 *  sans ça, l'accueil serait actif sur toutes les pages du forum. */
export function lienCourant(liens: readonly Lien[], chemin: string): Lien | null {
  const c = chemin === "" ? "/" : chemin;
  //  Le plus long d'abord : `/search` avant `/`, sinon l'accueil gagne.
  const tries = [...liens].sort((a, b) => b.adresse.length - a.adresse.length);
  for (const l of tries) {
    if (l.adresse === "/") {
      if (c === "/" || /^\/(forum)?$/.test(c)) return l;
      continue;
    }
    if (c === l.adresse || c.startsWith(l.adresse + "/") || c.startsWith(l.adresse + "?")) {
      return l;
    }
  }
  return null;
}

export type Personnage = {
  readonly nom: string;
  /** L'adresse qui bascule vers ce compte. Jamais fabriquée. */
  readonly adresse: string | null;
  readonly image: string | null;
  readonly actif: boolean;
};

/**
 * Les personnages lus dans la page, nettoyés.
 *
 * **Rien n'est complété.** Un personnage sans nom disparaît ; un
 * personnage sans adresse reste affiché mais ne bascule pas. On ne
 * devine ni le niveau, ni le groupe, ni l'image : ce que le switcheroo
 * ne donne pas ne s'affiche pas.
 */
export function personnagesDepuis(
  brut: readonly {
    nom: string;
    adresse: string | null;
    image?: string | null;
    actif?: boolean;
  }[],
): readonly Personnage[] {
  const vus = new Set<string>();
  const sortie: Personnage[] = [];
  for (const p of brut) {
    const nom = texte(p.nom);
    if (nom === "" || vus.has(nom)) continue;
    vus.add(nom);
    sortie.push({
      nom,
      adresse: adresse(p.adresse),
      image: typeof p.image === "string" && /^https?:\/\/|^\//.test(p.image) ? p.image : null,
      actif: p.actif === true,
    });
  }
  return sortie;
}
