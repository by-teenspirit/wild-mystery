// ════════════════════════════════════════════════════════════════════
//  src/adaptateurs/forumactif/recherche.ts
//
//  Lire la page de recherche de Forumactif — tâche 9 de la relève.
//
//  « D'où viennent les sujets — de la recherche native.
//    /search?search_author=<pseudo>&show_results=topics renvoie tous les
//    sujets où le joueur a écrit ; l'Edge Function la lit à la relève et
//    garde le résultat dans une table rp. »  (note `383:1049`)
//
//  ── L'ANATOMIE VIENT DE LA VRAIE PAGE, RELEVÉE LE 4 NOVEMBRE ────────
//
//      li.row
//        dl.icon
//          dd.dterm
//            div.topic-title-container > a.topictitle[href="/t996-test"]
//            span.topic-author   « par <a href="/u4">…</a> dans <a href="/f36-…">…</a> »
//          dd.posts   « 3 »     ← les RÉPONSES, pas les messages
//          dd.views   « 46 »
//          dd.lastpost
//            span  <a href="/u1">Arceus</a> … <a href="/t996-test#15582"> … « Mer 28 Oct 2026 - 13:34 »
//
//  Je l'ai mesurée avant d'écrire une ligne, sur le forum, avec un vrai
//  compte. C'est la leçon de cette semaine : un décor qui ne reproduit
//  pas ce que l'hôte sert ne mesure que lui-même.
//
//  ── PAS DE DOMParser ────────────────────────────────────────────────
//
//  La fonction Edge tourne sur Deno, où `DOMParser` n'existe pas sans
//  dépendance. Et une dépendance pour lire quatre champs par ligne, sur
//  une page dont on connaît la forme exacte, c'est un paquet de plus à
//  suivre, à épingler et à mettre à jour. Des expressions régulières
//  bornées à une ligne suffisent — et elles sont mesurées.
//
//  CE N'EST PAS UNE LICENCE À PARSER DU HTML N'IMPORTE COMMENT : on ne
//  cherche pas « un lien quelque part », on découpe d'abord par
//  `li.row`, puis on lit des attributs dont la forme est connue.
// ════════════════════════════════════════════════════════════════════

/** Un sujet, tel que la page de recherche le donne. */
export type SujetTrouve = {
  readonly sujetId: number;
  readonly titre: string;
  readonly forumId: number;
  readonly forumNom: string;
  readonly ouvertParId: number | null;
  readonly reponses: number;
  readonly vues: number;
  readonly dernierAuteurId: number | null;
  readonly dernierAuteurPseudo: string;
  readonly dernierMessageId: number | null;
  /** La date telle que le forum l'écrit. La conversion est à part. */
  readonly dernierLeBrut: string;
};

const LIGNE = /<li[^>]*class="[^"]*\brow\b[^"]*"[^>]*>([\s\S]*?)<\/li>/gi;

/*  LES ENTITÉS SONT DÉCODÉES, ET CE N'EST PAS UN LUXE.
 *
 *  Forumactif sert du français en entités : `&agrave;`, `&eacute;`,
 *  `&icirc;`. En lisant la page dans un navigateur on ne les voit
 *  jamais — le DOM les a déjà décodées — et c'est exactement le piège
 *  où la mesure m'a pris : « Aujourd'hui &agrave; 09:05 » ne
 *  ressemblait plus à une date, donc tous les sujets du jour
 *  perdaient la leur. La relève, elle, lit le HTML brut.
 *
 *  Pas de table complète : les formes numériques couvrent tout le
 *  reste, et les nommées listées ici sont celles qu'un forum français
 *  produit vraiment.  */
const NOMMEES: Readonly<Record<string, string>> = {
  nbsp: " ",
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  rsquo: "\u2019",
  laquo: "\u00ab",
  raquo: "\u00bb",
  hellip: "\u2026",
  agrave: "à",
  acirc: "â",
  ccedil: "ç",
  eacute: "é",
  egrave: "è",
  ecirc: "ê",
  euml: "ë",
  icirc: "î",
  iuml: "ï",
  ocirc: "ô",
  oelig: "œ",
  ugrave: "ù",
  ucirc: "û",
  uuml: "ü",
  Agrave: "À",
  Eacute: "É",
  Egrave: "È",
  Ecirc: "Ê",
  Icirc: "Î",
  Ocirc: "Ô",
  Ccedil: "Ç",
};

export function decoderLesEntites(texte: string): string {
  return texte
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&([a-zA-Z]+);/g, (tout, nom) => NOMMEES[nom] ?? tout);
}

function sansBalises(bout: string): string {
  return decoderLesEntites(bout.replace(/<[^>]*>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

function nombre(bout: string, quoi: string): number {
  const m = new RegExp(`<dd[^>]*class="[^"]*\\b${quoi}\\b[^"]*"[^>]*>([\\s\\S]*?)</dd>`, "i")
    .exec(bout);
  if (m === null) return 0;
  //  « 1 234 » avec une espace insécable : le forum sépare les milliers.
  const n = Number(sansBalises(m[1]).replace(/[\s ]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

/** Les sujets d'une page de recherche `show_results=topics`. */
export function sujetsDeLaRecherche(code: string): SujetTrouve[] {
  const trouves: SujetTrouve[] = [];
  LIGNE.lastIndex = 0;
  for (const ligne of code.matchAll(LIGNE)) {
    const bout = ligne[1];

    const titre =
      /<a[^>]*class="[^"]*\btopictitle\b[^"]*"[^>]*href="\/t(\d+)[^"]*"[^>]*>([\s\S]*?)<\/a>/i
        .exec(bout);
    if (titre === null) continue;

    const forum = /href="\/f(\d+)-[^"]*"[^>]*>([\s\S]*?)<\/a>/i.exec(bout);

    //  LE PREMIER `/u…` EST CELUI QUI A OUVERT, le second celui du
    //  dernier message : la page les pose dans cet ordre, et c'est ce
    //  que `dd.dterm` et `dd.lastpost` séparent.
    const dterm = /<dd[^>]*class="[^"]*\bdterm\b[^"]*"[^>]*>([\s\S]*?)<\/dd>/i.exec(bout);
    const dernier = /<dd[^>]*class="[^"]*\blastpost\b[^"]*"[^>]*>([\s\S]*?)<\/dd>/i.exec(bout);

    const ouvertPar = dterm === null ? null : /href="\/u(\d+)"/i.exec(dterm[1]);
    const auteurDernier = dernier === null ? null : /href="\/u(\d+)"[^>]*>([\s\S]*?)<\/a>/i
      .exec(dernier[1]);
    const message = dernier === null ? null : /href="\/t\d+[^"]*#(\d+)"/i.exec(dernier[1]);

    trouves.push({
      sujetId: Number(titre[1]),
      titre: sansBalises(titre[2]),
      forumId: forum === null ? 0 : Number(forum[1]),
      forumNom: forum === null ? "" : sansBalises(forum[2]),
      ouvertParId: ouvertPar === null ? null : Number(ouvertPar[1]),
      reponses: nombre(bout, "posts"),
      vues: nombre(bout, "views"),
      dernierAuteurId: auteurDernier === null ? null : Number(auteurDernier[1]),
      dernierAuteurPseudo: auteurDernier === null ? "" : sansBalises(auteurDernier[2]),
      dernierMessageId: message === null ? null : Number(message[1]),
      dernierLeBrut: dernier === null ? "" : derniereDate(sansBalises(dernier[1])),
    });
  }
  return trouves;
}

/** La date au bout de la cellule « dernier message ».
 *
 *  Le texte de la cellule mêle le pseudo, la mention « Derniers
 *  Messages » et la date. On prend ce qui ressemble à une date, à la
 *  fin — pas tout le texte, qui porterait un pseudo dans la colonne. */
function derniereDate(texte: string): string {
  const m = /((?:\p{L}{3,4}\.?\s)?\d{1,2}\s\p{L}{3,4}\.?\s\d{4}\s*-\s*\d{1,2}:\d{2})\s*$/u
    .exec(texte);
  if (m !== null) return m[1].trim();
  const relatif = /((?:Aujourd'hui|Hier)\s+à\s+\d{1,2}:\d{2})\s*$/i.exec(texte);
  return relatif === null ? "" : relatif[1].trim();
}

// ── la date, du français de Forumactif vers l'ISO ──────────────────

const MOIS: Readonly<Record<string, number>> = {
  jan: 1,
  fev: 2,
  mar: 3,
  avr: 4,
  mai: 5,
  juin: 6,
  juil: 7,
  aou: 8,
  sep: 9,
  oct: 10,
  nov: 11,
  dec: 12,
};

function sansAccent(mot: string): string {
  return mot.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

/** « Mer 28 Oct 2026 - 13:34 » → `2026-10-28T13:34:00Z`, ou `null`.
 *
 *  ── L'HEURE EST CELLE DU FORUM, ET ON NE LA DÉPLACE PAS ────────────
 *
 *  Forumactif affiche l'heure du fuseau réglé dans le profil du compte
 *  qui lit. La relève lit avec SON compte, donc toujours le même
 *  fuseau ; mais lequel, la page ne le dit pas. On range donc la date
 *  telle quelle, en UTC, et on l'affiche telle quelle : une date de RP
 *  sert à ordonner et à dater « le 28 octobre », pas à horodater une
 *  transaction. Convertir au jugé serait se tromper d'une heure deux
 *  fois par an, en silence.
 *
 *  « Aujourd'hui » et « Hier » ont besoin de `maintenant` : ce sont les
 *  seules formes où la page ne dit pas le jour. */
export function dateDuForum(brut: string, maintenant: Date): string | null {
  const relatif = /^(Aujourd'hui|Hier)\s+à\s+(\d{1,2}):(\d{2})$/i.exec(brut.trim());
  if (relatif !== null) {
    const jour = new Date(maintenant);
    if (sansAccent(relatif[1]) === "hier") jour.setUTCDate(jour.getUTCDate() - 1);
    return iso(
      jour.getUTCFullYear(),
      jour.getUTCMonth() + 1,
      jour.getUTCDate(),
      Number(relatif[2]),
      Number(relatif[3]),
    );
  }

  const m = /(\d{1,2})\s+(\p{L}{3,4})\.?\s+(\d{4})\s*-\s*(\d{1,2}):(\d{2})/u.exec(brut);
  if (m === null) return null;
  const mois = MOIS[sansAccent(m[2])];
  if (mois === undefined) return null;
  return iso(Number(m[3]), mois, Number(m[1]), Number(m[4]), Number(m[5]));
}

function iso(a: number, m: number, j: number, h: number, mn: number): string | null {
  if (j < 1 || j > 31 || h > 23 || mn > 59) return null;
  const d = (n: number) => String(n).padStart(2, "0");
  return `${a}-${d(m)}-${d(j)}T${d(h)}:${d(mn)}:00Z`;
}
