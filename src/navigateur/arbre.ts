// ════════════════════════════════════════════════════════════════════
//  L'arbre de compétences — quelles cases sont allumées, et à quel
//  palier ça mène.
//
//  « Est-ce que tu peux proposer un espèce d'arbre de compétences avec
//  les missions et le coder ? » — 25 novembre.
//
//  ── LES NŒUDS NE SONT PAS INVENTÉS ──────────────────────────────────
//
//  Ce sont les médailles du sujet t1012 et les thèmes de missions du
//  sujet t855, recopiés mot pour mot dans `data/arbre.json`. Ce
//  fichier n'apporte que la lecture : qui est allumé, qui est à
//  portée, qui attend autre chose.
//
//  ── UNE CASE S'ALLUME, ELLE NE SE DÉSALLUME JAMAIS ──────────────────
//
//  C'est la différence avec un total de points, et c'est tout
//  l'intérêt. Une équipe de six pokémon de niveau 40 vendue le
//  lendemain ne retire pas « Équipe de choc » : la médaille dit ce
//  qu'on A FAIT, pas ce qu'on possède à l'instant. Côté base, cela
//  veut dire qu'une ligne de `jalon` ne s'efface pas — et côté
//  lecture, que `acquis` l'emporte sur toute mesure plus basse.
//
//  ── TROIS GENRES, ET UN SEUL S'ALLUME TOUT SEUL ─────────────────────
//
//   · `mesure` — la base sait compter, la relève allume ;
//   · `forum`  — la réponse est chez Forumactif (nombre de messages,
//                délai de réponse). Personne ne la lit encore ;
//   · `staff`  — un humain constate (un événement, un légendaire vu) ;
//   · `mission`— le staff valide une mission jouée.
//
//  LES CASES QU'AUCUN SYSTÈME NE SAIT ALLUMER NE COMPTENT PAS DANS LE
//  PALIER. Une condition que le jeu ne peut pas remplir bloquerait une
//  montée sans que personne ne comprenne pourquoi — c'est exactement
//  le cul-de-sac des badges qu'on est en train de défaire.
//
//  ── « À PORTÉE » EST UN ÉTAT, PAS UNE DÉCORATION ────────────────────
//
//  Un nœud dont les prérequis sont allumés se distingue d'un nœud
//  qu'on ne peut pas encore tenter. C'est ce qui fait un arbre plutôt
//  qu'une liste : on voit où aller ensuite.
// ════════════════════════════════════════════════════════════════════

/** Le genre d'un nœud — qui est capable de l'allumer. */
export type Genre = "mesure" | "forum" | "staff" | "mission";

/** Un nœud de l'arbre : une médaille ou une mission. */
export type Noeud = {
  readonly clef: string;
  readonly titre: string;
  readonly condition: string;
  readonly recompense: string;
  readonly genre: Genre;
  /** Le nom de la mesure que la base devra savoir compter. */
  readonly mesure?: string;
  /** Le nombre à atteindre sur cette mesure. */
  readonly seuil?: number;
  /** Les clefs des nœuds à allumer avant celui-ci. */
  readonly apres: readonly string[];
};

export type Famille = {
  readonly clef: string;
  readonly titre: string;
  readonly note?: string;
  readonly noeuds: readonly Noeud[];
};

export type Branche = {
  readonly clef: string;
  readonly nom: string;
  readonly embleme: string;
  readonly noeuds: readonly Noeud[];
};

export type Seuils = { readonly cases: number; readonly deSaBranche: number };

export type Arbre = {
  readonly palier: { readonly "2": Seuils; readonly "3": Seuils };
  readonly familles: readonly Famille[];
  readonly branches: readonly Branche[];
};

/** Ce qu'on sait d'une joueuse au moment de dessiner son arbre. */
export type Progres = {
  /** Sa maison — la branche qui la concerne. `null` avant validation. */
  readonly branche: string | null;
  /** Les cases déjà allumées, par clef. Elles ne s'éteignent jamais. */
  readonly acquis: ReadonlySet<string>;
  /** Ce que la base sait compter aujourd'hui, par nom de mesure. */
  readonly mesures: Readonly<Record<string, number>>;
};

/** L'état d'un nœud pour une joueuse donnée. */
export type Etat = "acquis" | "a-portee" | "verrouille" | "hors-jeu";

export type NoeudVu = {
  readonly noeud: Noeud;
  readonly etat: Etat;
  /** Où elle en est sur la mesure du nœud, quand il y en a une. */
  readonly ou: number | null;
};

/** LES GENRES QUE RIEN NE SAIT ENCORE ALLUMER. Ils s'affichent — la
 *  médaille existe, Callista l'a écrite — mais ils ne comptent pas, et
 *  l'arbre le dit plutôt que de les laisser croire accessibles. */
const SANS_SYSTEME: ReadonlySet<Genre> = new Set<Genre>(["forum", "staff"]);

function atteint(n: Noeud, p: Progres): boolean {
  if (p.acquis.has(n.clef)) return true;
  if (n.genre !== "mesure" || n.mesure === undefined || n.seuil === undefined) return false;
  return (p.mesures[n.mesure] ?? 0) >= n.seuil;
}

/** L'état d'un nœud, prérequis compris. */
export function etatDuNoeud(n: Noeud, p: Progres, tous: ReadonlyMap<string, Noeud>): Etat {
  if (atteint(n, p)) return "acquis";
  if (SANS_SYSTEME.has(n.genre)) return "hors-jeu";
  //  UN PRÉREQUIS ABSENT NE VERROUILLE PAS. Une clef mal écrite dans
  //  les données barrerait une branche entière sans un mot ; le
  //  garde-fou des données est l'endroit pour le dire, pas l'écran
  //  d'une joueuse.
  const ouvert = n.apres.every((clef) => {
    const prec = tous.get(clef);
    return prec === undefined || atteint(prec, p);
  });
  return ouvert ? "a-portee" : "verrouille";
}

function tousLesNoeuds(a: Arbre): Noeud[] {
  return [
    ...a.familles.flatMap((f) => [...f.noeuds]),
    ...a.branches.flatMap((b) => [...b.noeuds]),
  ];
}

/** Tous les nœuds de l'arbre, avec leur état, dans l'ordre des
 *  données. La branche d'une autre maison n'y figure pas : un arbre
 *  qui montre six branches dont cinq inaccessibles n'est plus un
 *  arbre, c'est un catalogue. */
export function lireLArbre(a: Arbre, p: Progres): NoeudVu[] {
  const tous = new Map(tousLesNoeuds(a).map((n) => [n.clef, n]));
  const retenus = [
    ...a.familles.flatMap((f) => [...f.noeuds]),
    ...a.branches.filter((b) => b.clef === p.branche).flatMap((b) => [...b.noeuds]),
  ];
  return retenus.map((noeud) => ({
    noeud,
    etat: etatDuNoeud(noeud, p, tous),
    ou: noeud.mesure === undefined ? null : (p.mesures[noeud.mesure] ?? 0),
  }));
}

/** Combien de cases sont allumées, en tout et dans sa branche. */
export function compter(a: Arbre, p: Progres): { total: number; deSaBranche: number } {
  const vus = lireLArbre(a, p);
  const clefsDeLaBranche = new Set(
    a.branches.filter((b) => b.clef === p.branche).flatMap((b) => b.noeuds.map((n) => n.clef)),
  );
  const allumes = vus.filter((v) => v.etat === "acquis");
  return {
    total: allumes.length,
    deSaBranche: allumes.filter((v) => clefsDeLaBranche.has(v.noeud.clef)).length,
  };
}

/** Le palier que l'arbre donne. IL NE FAIT PAS FOI : le barème qui
 *  compte est en SQL (migration 0018), et cette fonction est là pour
 *  que l'écran dise la même chose que la base. Un contrat doit tenir
 *  les deux d'accord — deux barèmes qui divergent, c'est une joueuse
 *  à qui l'on promet une zone qui la refuse. */
export function palierDe(a: Arbre, p: Progres): 1 | 2 | 3 {
  const { total, deSaBranche } = compter(a, p);
  const tient = (s: Seuils) => total >= s.cases && deSaBranche >= s.deSaBranche;
  if (tient(a.palier["3"])) return 3;
  if (tient(a.palier["2"])) return 2;
  return 1;
}

/** Ce qu'il reste à faire pour le palier suivant. `null` au palier 3,
 *  où il n'y a plus rien à annoncer. */
export function ilManque(
  a: Arbre,
  p: Progres,
): { cases: number; deSaBranche: number } | null {
  const palier = palierDe(a, p);
  if (palier === 3) return null;
  const vise = a.palier[palier === 1 ? "2" : "3"];
  const { total, deSaBranche } = compter(a, p);
  return {
    cases: Math.max(0, vise.cases - total),
    deSaBranche: Math.max(0, vise.deSaBranche - deSaBranche),
  };
}

/** Ce que les données ont de cassé. Vide est la réponse attendue :
 *  c'est un contrôle de construction, pas un message de joueuse. */
export function plaintes(a: Arbre): string[] {
  const dits: string[] = [];
  const vus = new Set<string>();
  const tous = tousLesNoeuds(a);
  for (const n of tous) {
    if (vus.has(n.clef)) dits.push(`deux nœuds portent la clef « ${n.clef} »`);
    vus.add(n.clef);
    if (n.genre === "mesure" && (n.mesure === undefined || n.seuil === undefined)) {
      dits.push(`« ${n.clef} » est une mesure sans mesure ni seuil`);
    }
  }
  for (const n of tous) {
    for (const clef of n.apres) {
      if (!vus.has(clef)) dits.push(`« ${n.clef} » attend « ${clef} », qui n'existe pas`);
    }
  }
  //  UN CYCLE SE VOIT EN DESCENDANT. Deux nœuds qui s'attendent l'un
  //  l'autre resteraient verrouillés pour toujours, et rien à l'écran
  //  ne dirait pourquoi.
  const par = new Map(tous.map((n) => [n.clef, n]));
  for (const depart of tous) {
    const vu = new Set<string>();
    const pile = [...depart.apres];
    while (pile.length > 0) {
      const clef = pile.pop() as string;
      if (clef === depart.clef) {
        dits.push(`« ${depart.clef} » s'attend lui-même`);
        break;
      }
      if (vu.has(clef)) continue;
      vu.add(clef);
      pile.push(...(par.get(clef)?.apres ?? []));
    }
  }
  return dits;
}
