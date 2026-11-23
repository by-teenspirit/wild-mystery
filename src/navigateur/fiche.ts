// ════════════════════════════════════════════════════════════════════
//  La fiche de présentation — ce qu'elle contient, ce qu'elle publie,
//  et comment on la relit.
//
//  « Normalement, quand on crée un sujet [dans Présentations] ça
//  remplit un formulaire HTML. Et d'ailleurs quand on édite son
//  message, ce serait super que ça reste comme ça. » — 23 novembre.
//
//  ── LA SECONDE PHRASE COMMANDE TOUT LE FICHIER ──────────────────────
//
//  Un formulaire qui écrit un message, n'importe qui l'écrit. Un
//  formulaire qui SE RELIT dans le message qu'il a écrit demande que le
//  message publié soit lisible par une machine — et ça, ça se décide
//  avant d'écrire la première ligne, pas après.
//
//  **LE MESSAGE PUBLIÉ EST LE SEUL ENTREPÔT.** Rien n'est gardé en
//  base, rien dans `localStorage`. La fiche appartient au joueur : il
//  peut la retoucher à la main, la déplacer, la citer. Si on gardait
//  une copie ailleurs, les deux divergeraient le premier jour où
//  quelqu'un corrige une faute de frappe dans son sujet.
//
//  C'est le même choix que la fiche de liens du carnet (`33-…`, § 4) :
//  « le carnet est l'éditeur, le sujet est la publication ». Ici
//  l'éditeur est la page de réponse elle-même, parce que c'est là
//  qu'elle l'a demandé.
//
//  ── POURQUOI UNE BALISE PAR CHAMP, ET PAS UN ATTRIBUT ───────────────
//
//  Il faut retrouver chaque valeur dans le HTML publié. Trois routes :
//
//   1. `data-champ="surnom"` — le plus propre à lire, et **non
//      vérifié** : je n'ai pas pu ouvrir la page de réponse du forum
//      pour m'assurer que Forumactif laisse passer les attributs
//      `data-`. Parier là-dessus, c'est livrer une fiche qui ne se
//      relit pas.
//   2. Une classe — `class="bk1"` traverse, l'ancienne fiche le prouve.
//      Mais une classe se perd au copier-coller entre deux fiches, et
//      elle se confond avec celles de la mise en page.
//   3. **Une balise par champ** — `<wmf-surnom>…</wmf-surnom>`.
//      L'ancienne fiche emploie déjà `<y>`, `<x>`, `<tw>`, `<ifn>`,
//      `<iat>` : ces balises-là traversent, mesurées dans le sujet t50.
//
//  C'est la troisième. Elle a un second avantage, décisif ici : **elle
//  se lit sans DOM.** Le dépôt n'embarque aucun analyseur HTML — pas de
//  dépendance réseau, c'est la règle — donc une lecture par DOM ne
//  serait testable que dans un navigateur, et l'aller-retour est
//  précisément ce qui doit être prouvé sans en ouvrir un.
//
//  Et le contenu du joueur peut contenir n'importe quoi : du gras, des
//  sauts de ligne, des balises à lui. Une balise unique par champ rend
//  la fermeture non ambiguë — personne n'écrit `</wmf-surnom>` dans son
//  histoire.
//
//  ── L'ALLER-RETOUR EST LA PROPRIÉTÉ, ET ELLE EST TESTÉE ─────────────
//
//      lireUneFiche(publier(f)) === f
//
//  Tout le reste en découle. Un champ qu'on ajoute sans le faire
//  traverser casse ce test, et c'est voulu.
// ════════════════════════════════════════════════════════════════════

/** Un champ de texte de la fiche, tel qu'il se demande et se publie. */
export type Champ = {
  /** La clé technique. Elle nomme la balise publiée : `wmf-<clef>`. */
  readonly clef: string;
  /** Ce que le joueur lit à côté du champ, et ce qui s'imprime dans la
   *  fiche. **C'est le texte de l'ancienne fiche**, mot pour mot. */
  readonly etiquette: string;
  /** Ce qu'on écrit dans le champ vide, pour dire ce qu'on en attend.
   *  Jamais publié : c'est une aide de saisie, pas une valeur. */
  readonly exemple?: string;
  /** Un paragraphe plutôt qu'une ligne. « On doit pouvoir écrire
   *  quelques mots ou un paragraphe pour chaque si on veut. » */
  readonly long?: boolean;
};

/*  ── LES INFORMATIONS DU PERSONNAGE ────────────────────────────────

    L'ORDRE EST CELUI QU'ELLE A DICTÉ, et il n'est pas innocent : la
    date de naissance, l'origine et le métier arrivent AVANT le
    starter, parce que c'est d'eux que le staff déduit son niveau
    (`107-…`). Un formulaire qui demanderait le Pokémon d'abord ferait
    choisir avant de savoir.

    « ALLÉGEANCE » REMPLACE « MEMBRE D'UNE ORGANISATION » de l'ancienne
    fiche : c'est le mot qu'elle emploie maintenant, et c'est celui de
    l'annexe 14. */
export const IDENTITE: readonly Champ[] = [
  { clef: "surnom", etiquette: "SURNOM", exemple: "comment on l'appelle" },
  { clef: "pronoms", etiquette: "PRONOMS", exemple: "ceux du personnage" },
  {
    clef: "naissance",
    etiquette: "DATE DE NAISSANCE (ÂGE)",
    exemple: "12 mars 2004 (22 ans)",
  },
  {
    clef: "origine",
    etiquette: "VILLE ET RÉGION D'ORIGINE",
    exemple: "Port-Amarée, Rhode",
  },
  { clef: "orientation", etiquette: "ORIENTATION SEXUELLE" },
  { clef: "statut", etiquette: "STATUT CIVIL" },
  { clef: "metier", etiquette: "MÉTIER" },
  {
    clef: "allegeance",
    etiquette: "ALLÉGEANCE",
    exemple: "un clan, le Groupe Ombre, aucune…",
  },
  { clef: "traits", etiquette: "TRAITS DE CARACTÈRE", long: true },
];

/*  ── DERRIÈRE L'ÉCRAN ──────────────────────────────────────────────

    LES ÉTIQUETTES SONT CELLES DE L'ANCIENNE FICHE, mot pour mot,
    relevées dans le sujet t50. On ne réécrit pas leur texte.

    « IMAGE POUR LA TRAINER CARD » en dernier, comme là-bas. */
export const JOUEUR: readonly Champ[] = [
  { clef: "j-pseudo", etiquette: "PSEUDO/PRÉNOM" },
  { clef: "j-age", etiquette: "ÂGE" },
  { clef: "j-pronoms", etiquette: "PRONOMS", exemple: "les tiens" },
  { clef: "j-region", etiquette: "RÉGION/PAYS" },
  { clef: "j-avatar", etiquette: "AVATAR", exemple: "qui te sert de visage" },
  { clef: "j-groupe", etiquette: "GROUPE CHOISI" },
  {
    clef: "j-type",
    etiquette: "TYPE DE PERSONNAGE",
    exemple: "inventé, pré-lien, pv ?",
  },
  { clef: "j-connaissance", etiquette: "D'OÙ NOUS CONNAIS-TU ?" },
  { clef: "j-avis", etiquette: "AVIS SUR LE FORUM", long: true },
  { clef: "j-credits", etiquette: "CRÉDITS" },
  { clef: "j-autre", etiquette: "AUTRE", exemple: "une dernière information ?" },
  {
    clef: "j-tcard",
    etiquette: "IMAGE POUR LA TRAINER CARD",
    exemple: "en png et carrée de préférence",
  },
];

/*  ── LE GROUPE OMBRE ───────────────────────────────────────────────

    « On la garde, en option du formulaire » — 23 novembre. Une case à
    cocher ajoute ce bloc ; décochée, il ne s'écrit pas du tout.

    LES CINQ QUESTIONS SONT CELLES DE L'ANCIENNE FICHE, mot pour mot. */
export const OMBRE: readonly Champ[] = [
  { clef: "o-avis", etiquette: "Que pensez-vous de l'organisation ?", long: true },
  { clef: "o-connue", etiquette: "Comment l'avez-vous connue ?", long: true },
  { clef: "o-role", etiquette: "Quel est votre rôle en son sein ?", long: true },
  { clef: "o-pourquoi", etiquette: "Pourquoi avoir rejoint la Team Ombre ?", long: true },
  { clef: "o-obscurs", etiquette: "Que pensez-vous des Pokémons Obscurs ?", long: true },
];

/** Une entrée de chronologie : une date, ce qui s'y est passé. */
export type Moment = {
  readonly date: string;
  readonly texte: string;
};

/** L'histoire, dans la forme que le joueur a choisie.
 *
 *  « Soit de faire un grand pavé et de pouvoir ajouter des balises de
 *  texte comme on veut. Soit faire une chronologie. » — et c'est le
 *  joueur qui choisit, pas nous. */
export type Histoire =
  | { readonly mode: "pave"; readonly texte: string }
  | { readonly mode: "chronologie"; readonly moments: readonly Moment[] };

/** Le premier Pokémon.
 *
 *  NI NIVEAU NI ATTAQUES, et c'est une règle, pas un oubli : « les
 *  niveaux ne sont pas choisis par les joueurs, le staff les attribuera
 *  selon l'âge, le métier et le passé du personnage » (`107-…`).
 *  L'ancienne fiche faisait taper « ATTAQUE 0PP (PUISSANCE) » quatre
 *  fois ; ce n'est plus au joueur de les écrire. */
export type Starter = {
  readonly especeId: number;
  /** Le nom de l'espèce, publié tel quel : la fiche doit rester
   *  lisible sans aller chercher le catalogue. */
  readonly espece: string;
  readonly surnom: string;
  readonly talent: string;
  /** « Compagnon d'une vie » — comment le personnage l'a rencontré.
   *  C'est ce paragraphe qui permet au staff d'évaluer le niveau. */
  readonly rencontre: string;
};

export type Fiche = {
  /** Le nom du personnage, en titre, collé à gauche. */
  readonly nom: string;
  /** Les trigger warnings, en tête, comme dans l'ancienne fiche. */
  readonly tw: string;
  /** L'adresse de l'image de la colonne de gauche. « On peut rajouter
   *  le lien de l'avatar pour afficher l'avatar qu'on souhaite dans sa
   *  fiche. » */
  readonly avatar: string;
  readonly identite: Readonly<Record<string, string>>;
  readonly histoire: Histoire;
  readonly starter: Starter | null;
  /** L'ancienne équipe, en texte libre — « le starter, et un champ
   *  libre pour le reste », 23 novembre. Quatre emplacements
   *  mécaniques auraient demandé une mécanique de récupération que
   *  personne n'a encore décrite. */
  readonly ancienneEquipe: string;
  readonly ombre: Readonly<Record<string, string>> | null;
  readonly joueur: Readonly<Record<string, string>>;
};

/** La fiche vide, celle qu'un sujet neuf présente. */
export function ficheVide(): Fiche {
  const vides = (champs: readonly Champ[]) =>
    Object.fromEntries(champs.map((c) => [c.clef, ""]));
  return {
    nom: "",
    tw: "",
    avatar: "",
    identite: vides(IDENTITE),
    histoire: { mode: "pave", texte: "" },
    starter: null,
    ancienneEquipe: "",
    ombre: null,
    joueur: vides(JOUEUR),
  };
}

// ── publier ─────────────────────────────────────────────────────────

/*  CE QU'ON N'ÉCHAPPE PAS, ET POURQUOI.

    Le texte du joueur part TEL QUEL dans le message. C'est voulu :
    « pouvoir ajouter des balises de texte comme on veut » — du gras,
    de l'italique, une citation. L'échapper ferait apparaître
    `&lt;b&gt;` dans sa fiche.

    LE SEUL ENDROIT QU'ON PROTÈGE EST LA FERMETURE DE NOS PROPRES
    BALISES : un joueur qui écrirait `</wmf-surnom>` dans son histoire
    couperait la fiche en deux à la relecture. On remplace ce motif-là,
    et rien d'autre. Il ne peut pas apparaître par accident.

    CE N'EST PAS UNE PROTECTION DE SÉCURITÉ. Forumactif autorise déjà
    le HTML dans les messages, et c'est le joueur qui écrit son propre
    message : il ne peut atteindre que sa propre fiche. La protection
    du forum, c'est le filtre de Forumactif, pas celui-ci. */
/*  LE SÉPARATEUR EST UN ESPACE DE LARGEUR NULLE, ÉCRIT EN ÉCHAPPEMENT.

    Il se glisse entre le `<` et le reste, donc le motif ne correspond
    plus à une balise à la relecture, et il ne se voit pas dans la
    fiche publiée.

    `"\u200b"` ET PAS LE CARACTÈRE LUI-MÊME : un caractère invisible
    posé en clair dans un fichier source est une ligne que personne ne
    peut relire, ni chercher, ni corriger. */
const SEPARE = "\u200b";

function sur(texte: string): string {
  //  LA BARRE SE GARDE, et c'est tout le piège : écrire « `/` » dans
  //  le remplacement transformait un `<wmf-nom>` OUVRANT en
  //  `</wmf-nom>` FERMANT à la relecture. Le texte du joueur en
  //  ressortait changé, et seul le groupe capturé le rend fidèlement.
  return texte.replace(/<(\/?)wmf-/gi, `<${SEPARE}$1wmf-`);
}

/** Ce que `sur` a mis de côté, rendu tel qu'il a été tapé. */
function rendu(texte: string): string {
  return texte.replace(new RegExp(`<${SEPARE}(/?)wmf-`, "g"), "<$1wmf-");
}

function balise(clef: string, valeur: string): string {
  return `<wmf-${clef}>${sur(valeur)}</wmf-${clef}>`;
}

function bloc(champs: readonly Champ[], valeurs: Readonly<Record<string, string>>): string {
  //  UN CHAMP VIDE NE S'IMPRIME PAS. « SURNOM : » tout seul dans une
  //  fiche publiée n'apprend rien et occupe une ligne ; et le joueur
  //  qui n'a pas de surnom n'a pas à en inventer un.
  return champs
    .filter((c) => (valeurs[c.clef] ?? "").trim() !== "")
    .map((c) => `<y>${c.etiquette} :</y> ${balise(c.clef, valeurs[c.clef])}`)
    .join(" ");
}

/** Le message à publier, tel qu'il entrera dans l'éditeur.
 *
 *  ── LA MISE EN PAGE EST CELLE QU'ELLE A DÉCRITE ───────────────────
 *
 *  « Le nom du personnage en haut, en titre, collé à gauche. En
 *  dessous, 2 colonnes : une pour l'avatar […], à droite les
 *  informations du personnage. »
 *
 *  PAS DE `<center>`, contrairement à l'ancienne fiche : « collé à
 *  gauche » est une consigne, et c'est la seule différence de fond
 *  avec la mise en page de la V1.
 *
 *  LES DEUX COLONNES SONT UN FLEX, pas un tableau — « je veux pas de
 *  tableau, que du flexbox ». Le CSS vit dans la feuille du forum ;
 *  ici on ne pose que la structure et les classes. */
export function publier(f: Fiche): string {
  const morceaux: string[] = [];
  morceaux.push(`<div class="wmf">`);
  morceaux.push(`<div class="wmf__titre">${balise("nom", f.nom)}</div>`);
  if (f.tw.trim() !== "") {
    morceaux.push(`<div class="wmf__tw"><x>${balise("tw", f.tw)}</x></div>`);
  }

  morceaux.push(`<div class="wmf__haut">`);
  morceaux.push(
    `<div class="wmf__avatar">` +
      (f.avatar.trim() === "" ? "" : `<img src="${f.avatar.trim()}" alt="" />`) +
      balise("avatar", f.avatar) +
      `</div>`,
  );
  morceaux.push(`<div class="wmf__infos">${bloc(IDENTITE, f.identite)}</div>`);
  morceaux.push(`</div>`);

  //  ── L'HISTOIRE, DANS LA FORME CHOISIE ──────────────────────────
  //
  //  LE MODE EST ÉCRIT DANS LA FICHE, pas deviné à la relecture. Une
  //  chronologie à un seul moment ressemble à un pavé, et un pavé qui
  //  commence par une date ressemble à une chronologie : deviner
  //  ferait changer de forme une fiche qu'on rouvre.
  morceaux.push(`<div class="wmf__histoire" data-mode="${f.histoire.mode}">`);
  morceaux.push(`<div class="wmf__bandeau">RACONTE-NOUS TON HISTOIRE</div>`);
  if (f.histoire.mode === "pave") {
    morceaux.push(balise("histoire", f.histoire.texte));
  } else {
    morceaux.push(`<div class="wmf__chrono">`);
    for (const m of f.histoire.moments) {
      morceaux.push(
        `<div class="wmf__moment">` +
          `<div class="wmf__moment-date">${balise("m-date", m.date)}</div>` +
          `<div class="wmf__moment-texte">${balise("m-texte", m.texte)}</div>` +
          `</div>`,
      );
    }
    morceaux.push(`</div>`);
  }
  morceaux.push(`</div>`);

  if (f.starter !== null) {
    const s = f.starter;
    morceaux.push(`<div class="wmf__starter">`);
    morceaux.push(
      `<div class="wmf__pokemon">` +
        `<wmf-s-id>${s.especeId}</wmf-s-id>` +
        `<div class="wmf__espece">${balise("s-espece", s.espece)}</div>` +
        `<div class="wmf__surnom"><ifn>${balise("s-surnom", s.surnom)}</ifn></div>` +
        `<div class="wmf__talent"><ifi>${balise("s-talent", s.talent)}</ifi></div>` +
        `</div>`,
    );
    morceaux.push(
      `<div class="wmf__rencontre">` +
        `<div class="wmf__bandeau">COMPAGNON D'UNE VIE</div>` +
        balise("s-rencontre", s.rencontre) +
        `</div>`,
    );
    morceaux.push(`</div>`);
  }
  if (f.ancienneEquipe.trim() !== "") {
    morceaux.push(
      `<div class="wmf__ancienne">` +
        `<div class="wmf__bandeau">L'ÉQUIPE D'AVANT</div>` +
        balise("ancienne", f.ancienneEquipe) +
        `</div>`,
    );
  }

  if (f.ombre !== null) {
    morceaux.push(`<div class="wmf__ombre">`);
    morceaux.push(`<div class="wmf__bandeau">L'ORGANISATION</div>`);
    for (const c of OMBRE) {
      const v = f.ombre[c.clef] ?? "";
      if (v.trim() === "") continue;
      morceaux.push(
        `<div class="wmf__question"><o>${c.etiquette}</o> ${balise(c.clef, v)}</div>`,
      );
    }
    morceaux.push(`</div>`);
  }

  morceaux.push(
    `<div class="wmf__joueur">` +
      `<div class="wmf__bandeau">DERRIÈRE L'ÉCRAN</div>` +
      bloc(JOUEUR, f.joueur) +
      `</div>`,
  );
  morceaux.push(`</div>`);
  return morceaux.join("\n");
}

// ── relire ──────────────────────────────────────────────────────────

/*  UNE LECTURE PAR MOTIF, ET PAS PAR DOM.

    Le dépôt n'embarque aucun analyseur HTML, et l'aller-retour doit se
    prouver sans navigateur. La balise est unique par champ, donc sa
    fermeture n'est pas ambiguë : `[\s\S]*?` jusqu'à `</wmf-clef>` rend
    exactement ce qu'on avait mis, balises du joueur comprises.

    ON NE RÉCLAME RIEN. Un champ absent rend la chaîne vide, un bloc
    absent rend `null`. Une fiche écrite à la main, ou l'ancienne fiche
    de la V1, ne porte aucune de ces balises : on rend alors une fiche
    vide, et c'est à l'appelant de ne pas écraser ce qu'il n'a pas
    compris — voir `ressembleAUneFiche`. */
function dedans(html: string, clef: string): string {
  const re = new RegExp(`<wmf-${clef}>([\\s\\S]*?)</wmf-${clef}>`, "i");
  const t = re.exec(html);
  return t === null ? "" : rendu(t[1]);
}

function tous(html: string, clef: string): string[] {
  const re = new RegExp(`<wmf-${clef}>([\\s\\S]*?)</wmf-${clef}>`, "gi");
  return [...html.matchAll(re)].map((m) => rendu(m[1]));
}

function lesChamps(html: string, champs: readonly Champ[]): Record<string, string> {
  return Object.fromEntries(champs.map((c) => [c.clef, dedans(html, c.clef)]));
}

/** Est-ce que ce message est une fiche que ce formulaire a écrite ?
 *
 *  ── LA QUESTION QUI ÉVITE D'EFFACER LE TRAVAIL DE QUELQU'UN ────────
 *
 *  Le formulaire écrit le message entier à chaque frappe. Sur un
 *  message qu'il n'a pas écrit — une fiche de la V1, une fiche
 *  retouchée à la main jusqu'à en perdre les balises — écrire
 *  reviendrait à effacer le texte de quelqu'un sans le lui demander.
 *
 *  Il ne suffit pas que le mot `wmf` apparaisse : on exige la balise
 *  du NOM, qui est la seule qu'une fiche publiée porte toujours. */
export function ressembleAUneFiche(html: string): boolean {
  return /<wmf-nom>/i.test(html);
}

/** La fiche que porte ce message, ou la fiche vide.
 *
 *  Elle rend toujours une fiche : l'appelant demande d'abord
 *  `ressembleAUneFiche` s'il a quelque chose à perdre. */
export function lireUneFiche(html: string): Fiche {
  const vide = ficheVide();
  if (!ressembleAUneFiche(html)) return vide;

  //  LE MODE EST LU DANS L'ATTRIBUT, parce qu'il a été écrit là. Une
  //  chronologie vide et un pavé vide produisent le même corps ; sans
  //  l'attribut, rouvrir sa fiche changerait sa forme.
  const mode = /class="wmf__histoire" data-mode="chronologie"/i.test(html)
    ? "chronologie"
    : "pave";
  const dates = tous(html, "m-date");
  const textes = tous(html, "m-texte");
  const histoire: Histoire = mode === "chronologie"
    ? {
      mode,
      //  ON APPARIE PAR RANG, et on s'arrête au plus court : une
      //  moitié de moment, c'est un moment qu'on ne sait pas lire.
      moments: dates.slice(0, Math.min(dates.length, textes.length))
        .map((date, i) => ({ date, texte: textes[i] })),
    }
    : { mode: "pave", texte: dedans(html, "histoire") };

  const especeId = Number(/<wmf-s-id>(\d+)<\/wmf-s-id>/i.exec(html)?.[1] ?? "");
  const starter: Starter | null = Number.isInteger(especeId) && especeId > 0
    ? {
      especeId,
      espece: dedans(html, "s-espece"),
      surnom: dedans(html, "s-surnom"),
      talent: dedans(html, "s-talent"),
      rencontre: dedans(html, "s-rencontre"),
    }
    : null;

  //  LE BLOC OMBRE EXISTE OU N'EXISTE PAS, et c'est sa boîte qui le
  //  dit — pas ses réponses. Un joueur du Groupe Ombre qui n'a encore
  //  rempli aucune des cinq questions doit retrouver sa case cochée.
  const ombre = /class="wmf__ombre"/i.test(html) ? lesChamps(html, OMBRE) : null;

  return {
    ...vide,
    nom: dedans(html, "nom"),
    tw: dedans(html, "tw"),
    avatar: dedans(html, "avatar"),
    identite: lesChamps(html, IDENTITE),
    histoire,
    starter,
    ancienneEquipe: dedans(html, "ancienne"),
    ombre,
    joueur: lesChamps(html, JOUEUR),
  };
}
