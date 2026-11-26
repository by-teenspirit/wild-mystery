// ════════════════════════════════════════════════════════════════════
//  L'arbre des paliers — neuf objectifs par palier, en trois couches.
//
//  « On voulait entre 8 et 10 objectifs par paliers. » — 26 novembre.
//
//  ── POURQUOI TROIS COUCHES ET PAS UNE LISTE ─────────────────────────
//
//  Neuf objectifs × deux paliers × six maisons font CENT HUIT, et la V1
//  en a laissé douze. La seule question qui compte n'est donc pas « que
//  demande-t-on ? » mais « QUI L'ÉCRIT ? ». Les trois couches la
//  tranchent :
//
//   · `commun` — les six mêmes pour tout le monde. Un fait de jeu que
//     la base compte. Zéro prose, zéro relecture ;
//   · `maison` — deux par maison, même mécanique qu'un commun avec un
//     filtre différent. C'est là que la maison se sent, et ça ne coûte
//     pas une ligne d'écriture ;
//   · `mission` — une seule, et c'est la seule qui soit écrite.
//
//  Douze missions pour douze cases. Il en manque trois.
//
//  ── UN PALIER SE PREND EN ENTIER ────────────────────────────────────
//
//  Les neuf objectifs d'un étage ouvrent sa porte. Pas sept sur neuf :
//  un seuil partiel se négocie, et ce qui se négocie finit par
//  s'arbitrer au cas par cas.
//
//  ── CE QUI EST FAIT RESTE FAIT ──────────────────────────────────────
//
//  Une équipe de six types revendue le lendemain ne reprend pas
//  l'objectif. Côté base, une ligne de `jalon` ne s'efface pas ; côté
//  lecture, `faits` l'emporte sur toute mesure redescendue.
// ════════════════════════════════════════════════════════════════════

/** Qui est capable de remplir un objectif. */
export type Genre = "commun" | "maison" | "mission" | "a-ecrire";

export type Objectif = {
  readonly clef: string;
  readonly titre: string;
  readonly genre: Genre;
  /** Le nom de la mesure que la base devra savoir compter. */
  readonly mesure?: string;
  readonly seuil?: number;
};

export type Branche = {
  readonly clef: string;
  readonly nom: string;
  readonly embleme: string;
  readonly paliers: { readonly "2": readonly Objectif[]; readonly "3": readonly Objectif[] };
};

export type Arbre = {
  readonly parPalier: number;
  readonly communs: { readonly "2": readonly Objectif[]; readonly "3": readonly Objectif[] };
  readonly branches: readonly Branche[];
};

/** Ce qu'on sait d'une joueuse. */
export type Progres = {
  /** Sa maison. `null` avant validation. */
  readonly maison: string | null;
  /** Les objectifs déjà remplis, par clef. Ils ne se défont jamais. */
  readonly faits: ReadonlySet<string>;
};

export type ObjectifVu = { readonly objectif: Objectif; readonly fait: boolean };

export type Etage = {
  readonly palier: 2 | 3;
  readonly objectifs: readonly ObjectifVu[];
  readonly faits: number;
  readonly total: number;
  readonly ouverte: boolean;
};

function brancheDe(a: Arbre, maison: string | null): Branche | null {
  return a.branches.find((b) => b.clef === maison) ?? null;
}

/** Les neuf objectifs d'un étage pour une maison donnée : les six
 *  communs, puis les trois qui n'appartiennent qu'à elle. */
export function objectifsDe(
  a: Arbre,
  maison: string | null,
  palier: "2" | "3",
): Objectif[] {
  const b = brancheDe(a, maison);
  return [...a.communs[palier], ...(b === null ? [] : b.paliers[palier])];
}

/** Un étage, lu pour une joueuse. */
export function lireUnEtage(a: Arbre, p: Progres, palier: "2" | "3"): Etage {
  const objectifs = objectifsDe(a, p.maison, palier).map((objectif) => ({
    objectif,
    //  UNE CASE « À ÉCRIRE » NE PEUT PAS ÊTRE REMPLIE, et elle ne doit
    //  pas bloquer : tant que Callista n'a pas écrit la mission, elle
    //  compte comme faite. Une porte fermée par un texte manquant
    //  serait un mur que personne ne comprendrait.
    fait: objectif.genre === "a-ecrire" || p.faits.has(objectif.clef),
  }));
  const faits = objectifs.filter((o) => o.fait).length;
  return {
    palier: palier === "2" ? 2 : 3,
    objectifs,
    faits,
    total: objectifs.length,
    ouverte: faits === objectifs.length,
  };
}

/** Le palier atteint. IL NE FAIT PAS FOI : le barème qui compte est en
 *  SQL (migration 0018), et cette fonction est là pour que l'écran dise
 *  la même chose que la base. Deux barèmes qui divergent, c'est une
 *  joueuse à qui l'on promet une zone qui la refuse. */
export function palierDe(a: Arbre, p: Progres): 1 | 2 | 3 {
  //  SANS MAISON, PAS DE MONTÉE. Une joueuse dont le personnage n'est
  //  pas validé n'a pas de branche : lui ouvrir le palier 2 sur les
  //  seuls communs ferait de la validation une formalité.
  if (brancheDe(a, p.maison) === null) return 1;
  if (!lireUnEtage(a, p, "2").ouverte) return 1;
  return lireUnEtage(a, p, "3").ouverte ? 3 : 2;
}

/** Ce qu'il reste avant la porte suivante. `null` au palier 3. */
export function ilManque(a: Arbre, p: Progres): number | null {
  const palier = palierDe(a, p);
  if (palier === 3) return null;
  const etage = lireUnEtage(a, p, palier === 1 ? "2" : "3");
  return etage.total - etage.faits;
}

/** Tout ce dont un écran a besoin, en un appel. */
export function ouEnEstElle(a: Arbre, p: Progres): {
  branche: Branche | null;
  etages: Etage[];
  palier: 1 | 2 | 3;
  reste: number | null;
} {
  const branche = brancheDe(a, p.maison);
  return {
    branche,
    etages: branche === null ? [] : [lireUnEtage(a, p, "2"), lireUnEtage(a, p, "3")],
    palier: palierDe(a, p),
    reste: branche === null ? null : ilManque(a, p),
  };
}

/** Ce que les données ont de cassé. Vide est la réponse attendue :
 *  c'est un contrôle de construction, pas un message de joueuse. */
export function plaintes(a: Arbre): string[] {
  const dits: string[] = [];
  const vues = new Set<string>();
  const tous = [
    ...a.communs["2"],
    ...a.communs["3"],
    ...a.branches.flatMap((b) => [...b.paliers["2"], ...b.paliers["3"]]),
  ];
  for (const o of tous) {
    if (vues.has(o.clef)) dits.push(`deux objectifs portent la clef « ${o.clef} »`);
    vues.add(o.clef);
    if ((o.genre === "commun" || o.genre === "maison") && o.mesure === undefined) {
      dits.push(`« ${o.clef} » est un fait de jeu sans mesure`);
    }
    if (o.genre === "mission" && o.titre.trim() === "") {
      dits.push(`la mission « ${o.clef} » n'a pas de texte`);
    }
    if (o.genre === "a-ecrire" && o.titre !== "") {
      dits.push(`« ${o.clef} » est marquée à écrire mais porte un texte`);
    }
  }
  //  LES SIX MAISONS ONT LE MÊME NOMBRE D'OBJECTIFS, et c'est une
  //  règle de jeu : une maison plus courte serait le chemin rapide.
  for (const b of a.branches) {
    for (const palier of ["2", "3"] as const) {
      const n = a.communs[palier].length + b.paliers[palier].length;
      if (n !== a.parPalier) {
        dits.push(`« ${b.clef} » a ${n} objectifs au palier ${palier}, pas ${a.parPalier}`);
      }
      const missions = b.paliers[palier].filter(
        (o) => o.genre === "mission" || o.genre === "a-ecrire",
      ).length;
      if (missions !== 1) {
        dits.push(`« ${b.clef} » a ${missions} mission(s) au palier ${palier}, pas une`);
      }
    }
  }
  return dits;
}
