// ════════════════════════════════════════════════════════════════════
//  src/navigateur/vie.ts
//
//  « La vie de Rhode » : lire les lignes du journal, et en faire des
//  phrases. Pur — aucun DOM, aucun réseau, aucune horloge implicite :
//  `maintenant` entre par l'appelant.
//
//  ── POURQUOI LA PHRASE EST ICI ET PAS EN BASE ───────────────────────
//
//  La migration `0014` stocke un type, un pseudo et un `detail` minimal.
//  Elle ne stocke PAS la phrase, et son en-tête dit pourquoi : changer
//  une tournure ne doit pas demander une migration, et une phrase figée
//  en base vieillirait avec la base. Elle vit donc là, avec le reste de
//  ce qui s'affiche.
//
//  ── CE QU'UNE LIGNE PEUT CONTENIR, ET CE QU'ON EN FAIT ──────────────
//
//  Six types, dont **un seul a un écrivain aujourd'hui** : `achat`, posé
//  par `boutique_servir`. Les cinq autres sont prévus par la planche 18
//  et arriveront avec leurs systèmes. On les formule quand même : le
//  jour où la pension écrira sa ligne, l'encart n'aura pas à changer.
//
//  Un type inconnu — une ligne écrite par une version plus récente que
//  le script servi par le CDN — n'est pas une erreur : on la saute. Le
//  CDN sert parfois du JavaScript de la veille, et un encart vide serait
//  un prix absurde à payer pour ça.
//
//  ── ET LE DÉTAIL EST OPTIONNEL, TOUJOURS ────────────────────────────
//
//  Chaque phrase a une forme qui marche sans son détail. `{}` donne
//  « Anna est passée au comptoir », pas « Anna a acheté undefined
//  objets ». C'est ce qui permet à `journal_ecrire` d'être permissive
//  sans que ça se voie sur l'index.
// ════════════════════════════════════════════════════════════════════

/** Les six types de la planche 18, dans l'ordre de l'énumération SQL. */
export const TYPES_DE_VIE = [
  "achat",
  "pension",
  "fossile",
  "eclosion",
  "capture",
  "badge",
] as const;

export type TypeDeVie = typeof TYPES_DE_VIE[number];

export type LigneDeVie = {
  readonly type: TypeDeVie;
  readonly pseudo: string;
  readonly detail: Readonly<Record<string, unknown>>;
  readonly arriveLe: Date;
};

function estUnType(valeur: unknown): valeur is TypeDeVie {
  return typeof valeur === "string" &&
    (TYPES_DE_VIE as readonly string[]).includes(valeur);
}

/** Les lignes utilisables d'une réponse de `journal_dernieres`.
 *
 *  **Tout ce qui ne tient pas est jeté, ligne par ligne.** Une réponse
 *  qui n'est pas un tableau rend un tableau vide ; une ligne sans pseudo
 *  ou avec une date illisible disparaît sans emporter ses voisines.
 *  L'encart est du décor : il n'a aucune raison de tomber en entier
 *  parce qu'une ligne sur huit est bancale.
 *
 *  L'ordre est CELUI DE LA RÉPONSE. `journal_dernieres` trie déjà du
 *  plus récent au plus ancien ; retrier ici reviendrait à avoir deux
 *  avis sur la question. */
export function lignesDeVie(brut: unknown): readonly LigneDeVie[] {
  if (!Array.isArray(brut)) return [];
  const lignes: LigneDeVie[] = [];
  for (const brute of brut) {
    if (typeof brute !== "object" || brute === null) continue;
    const r = brute as Record<string, unknown>;
    if (!estUnType(r.type)) continue;

    const pseudo = typeof r.pseudo === "string" ? r.pseudo.trim() : "";
    if (pseudo === "") continue;

    //  `arrive_le` est un `timestamptz` rendu en texte ISO par
    //  PostgREST. Une date invalide donnerait « Invalid Date » dans
    //  l'encart : on préfère perdre la ligne.
    const arriveLe = new Date(typeof r.arrive_le === "string" ? r.arrive_le : "");
    if (Number.isNaN(arriveLe.getTime())) continue;

    const detail = typeof r.detail === "object" && r.detail !== null && !Array.isArray(r.detail)
      ? r.detail as Record<string, unknown>
      : {};

    lignes.push({ type: r.type, pseudo, detail, arriveLe });
  }
  return lignes;
}

/** Un entier positif d'un détail, ou null. */
function compte(detail: Readonly<Record<string, unknown>>, clef: string): number | null {
  const v = detail[clef];
  if (typeof v !== "number" || !Number.isInteger(v) || v < 1) return null;
  return v;
}

/** Un texte court d'un détail, ou null. Borné : l'encart fait une ligne,
 *  et un nom de cent caractères y serait une attaque de mise en page. */
function mot(detail: Readonly<Record<string, unknown>>, clef: string): string | null {
  const v = detail[clef];
  if (typeof v !== "string") return null;
  const propre = v.replace(/\s+/g, " ").trim();
  return propre === "" || propre.length > 40 ? null : propre;
}

function objets(nombre: number): string {
  return nombre === 1 ? "un objet" : `${nombre} objets`;
}

/** La phrase d'une ligne, sans le pseudo ni l'heure.
 *
 *  Au présent composé et à la troisième personne — c'est un journal, il
 *  rapporte. Pas de point final : l'encart met l'heure après, et
 *  « il y a deux heures » après un point se lirait mal. */
export function phraseDeVie(ligne: LigneDeVie): string {
  const d = ligne.detail;
  switch (ligne.type) {
    case "achat": {
      const n = compte(d, "articles");
      return n === null
        ? "est passé au comptoir de Rhode"
        : `a emporté ${objets(n)} du comptoir de Rhode`;
    }
    case "pension": {
      const espece = mot(d, "espece");
      //  Le dépôt et la reprise sont deux événements, et la pension
      //  n'écrit encore rien : la clef est lue, pas supposée.
      const repris = d.repris === true;
      if (espece === null) {
        return repris ? "a repris un pokémon à la pension" : "a confié un pokémon à la pension";
      }
      return repris ? `a repris ${espece} à la pension` : `a confié ${espece} à la pension`;
    }
    case "fossile": {
      const espece = mot(d, "espece");
      return espece === null
        ? "a fait réanimer un fossile"
        : `a fait réanimer un fossile — ${espece} en est sorti`;
    }
    case "eclosion": {
      const espece = mot(d, "espece");
      return espece === null ? "a vu un œuf éclore" : `a vu éclore un œuf : ${espece}`;
    }
    case "capture": {
      const espece = mot(d, "espece");
      const chromatique = d.chromatique === true;
      if (espece === null) {
        return chromatique ? "a capturé un pokémon chromatique" : "a réussi une capture";
      }
      return chromatique ? `a capturé ${espece} chromatique` : `a capturé ${espece}`;
    }
    case "badge": {
      const arene = mot(d, "arene");
      return arene === null ? "a décroché un badge" : `a décroché le badge de ${arene}`;
    }
  }
}

/** « à l'instant », « il y a 3 min », « il y a 2 h », « il y a 4 j ».
 *
 *  ── POURQUOI PAS UNE DATE ───────────────────────────────────────────
 *
 *  La planche 18 demande « une ligne par événement, avec l'heure ». Un
 *  écart se lit d'un coup d'œil — c'est ce qui fait sentir que la région
 *  bouge —, là où « 06/10 à 11:42 » demande de calculer. La date exacte
 *  reste accessible : l'encart la met en `title` et en `datetime`.
 *
 *  **Une ligne dans le futur rend « à l'instant »**, pas « il y a −2 h ».
 *  L'horloge du joueur peut être en avance sur celle du serveur de
 *  quelques secondes, et personne n'a envie de voir ça sur l'accueil. */
export function ilYA(arriveLe: Date, maintenant: Date): string {
  const secondes = Math.floor((maintenant.getTime() - arriveLe.getTime()) / 1000);
  if (secondes < 60) return "à l'instant";
  const minutes = Math.floor(secondes / 60);
  if (minutes < 60) return `il y a ${minutes} min`;
  const heures = Math.floor(minutes / 60);
  if (heures < 24) return `il y a ${heures} h`;
  const jours = Math.floor(heures / 24);
  if (jours < 30) return `il y a ${jours} j`;
  const mois = Math.floor(jours / 30);
  return mois < 12 ? `il y a ${mois} mois` : "il y a plus d'un an";
}

// ── ce que la maquette `390:3386` ajoute ────────────────────────────

/** Le mot qui nomme la catégorie, sous la phrase.
 *
 *  La maquette écrit « PENSION · IL Y A 2 H », « BOUTIQUE · IL Y A 3 H ».
 *  Le mot n'est PAS le nom du type dans la base : « achat » devient
 *  « BOUTIQUE », parce qu'un joueur connaît la boutique et pas la
 *  table qui enregistre ses achats.
 *
 *  Les capitales sont dans le texte et pas seulement en CSS : la
 *  maquette les veut, et un `text-transform` seul laisse un lecteur
 *  d'écran épeler certaines abréviations. Ici le mot est écrit comme
 *  il se lit. */
export function etiquetteDeType(type: TypeDeVie): string {
  switch (type) {
    case "achat":
      return "BOUTIQUE";
    case "pension":
      return "PENSION";
    case "fossile":
      return "FOSSILE";
    case "eclosion":
      return "ÉCLOSION";
    case "capture":
      return "CAPTURE";
    case "badge":
      return "BADGE";
  }
}

/** Le signe posé dans le petit carré, à gauche de la phrase.
 *
 *  ── POURQUOI DES CARACTÈRES ET PAS DES DESSINS ──────────────────────
 *
 *  Six icônes vectorielles, c'est six chemins à dessiner, à garder
 *  d'accord avec le thème et à mesurer au contraste. Ces six signes-là
 *  sont dans toutes les polices depuis trente ans, ils héritent de la
 *  couleur du texte, et ils grossissent avec le réglage « grossir le
 *  texte » sans qu'on s'en occupe.
 *
 *  ILS NE PORTENT AUCUNE INFORMATION À EUX SEULS : la catégorie est
 *  écrite en toutes lettres juste à côté, par `etiquetteDeType`. Le
 *  signe est une ponctuation visuelle, pas un code à apprendre — et
 *  c'est pour ça que le module les marque décoratifs. */
export function signeDeType(type: TypeDeVie): string {
  switch (type) {
    case "achat":
      return "▤";
    case "pension":
      return "◍";
    case "fossile":
      return "◈";
    case "eclosion":
      return "▦";
    case "capture":
      return "◉";
    case "badge":
      return "✦";
  }
}

/** Ce que l'encart affiche : une ligne prête, pseudo compris.
 *
 *  Le pseudo est rendu à part de la phrase parce que l'encart le met en
 *  gras ; les coller ici obligerait le module à les redécouper. */
export type LigneAffichee = {
  readonly pseudo: string;
  readonly phrase: string;
  readonly ecart: string;
  /** Le type, qui donne l'étiquette et le signe du carré. */
  readonly type: TypeDeVie;
  /** L'instant exact, pour `datetime` et l'infobulle. */
  readonly instant: Date;
};

/** Les lignes à afficher, au plus `combien`.
 *
 *  Huit par défaut : c'est le nombre de la planche 18. La fonction SQL
 *  en borne déjà le nombre côté serveur ; on le reborne ici parce que
 *  l'encart est responsable de sa propre hauteur, et qu'une réponse plus
 *  longue que prévu ne doit pas pousser l'index vers le bas. */
export function vieDeRhode(
  brut: unknown,
  maintenant: Date,
  combien = 8,
): readonly LigneAffichee[] {
  return lignesDeVie(brut).slice(0, Math.max(0, combien)).map((l) => ({
    pseudo: l.pseudo,
    phrase: phraseDeVie(l),
    ecart: ilYA(l.arriveLe, maintenant),
    type: l.type,
    instant: l.arriveLe,
  }));
}
