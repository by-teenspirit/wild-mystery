// ════════════════════════════════════════════════════════════════════
//  « Quand on édite son message, ce serait super que ça reste comme
//  ça. »
//
//  Une seule propriété compte ici, et tout le reste en découle :
//
//      lireUneFiche(publier(f)) === f
//
//  Si elle tient, le joueur rouvre sa fiche et la retrouve. Si elle
//  casse, il la retrouve amputée — et il ne le verra qu'après avoir
//  renvoyé le message.
// ════════════════════════════════════════════════════════════════════

import { assertEquals } from "@std/assert";
import {
  type Fiche,
  ficheVide,
  IDENTITE,
  JOUEUR,
  lireUneFiche,
  OMBRE,
  publier,
  ressembleAUneFiche,
} from "./fiche.ts";

function remplir(
  champs: readonly { clef: string }[],
  suffixe: string,
): Record<string, string> {
  return Object.fromEntries(champs.map((c, i) => [c.clef, `${c.clef} ${suffixe} ${i}`]));
}

const COMPLETE: Fiche = {
  nom: "Jak A. Fering",
  tw: "violence, deuil",
  avatar: "https://exemple.test/avatar.png",
  identite: remplir(IDENTITE, "du personnage"),
  histoire: { mode: "pave", texte: "Un <b>pavé</b> avec des balises, et\ndeux lignes." },
  starter: {
    especeId: 25,
    espece: "Pikachu",
    surnom: "Spark",
    talent: "Statik",
    rencontre: "On s'est rencontrés un soir de pluie.",
  },
  ancienneEquipe: "Un Onix, un Roucool, et un troisième dont il ne parle pas.",
  ombre: remplir(OMBRE, "réponse"),
  joueur: remplir(JOUEUR, "du joueur"),
};

Deno.test("UNE FICHE COMPLÈTE SE RELIT À L'IDENTIQUE", () => {
  //  C'est LA propriété. Tout ce fichier est là pour elle.
  assertEquals(lireUneFiche(publier(COMPLETE)), COMPLETE);
});

Deno.test("une chronologie se relit à l'identique, moments compris", () => {
  const f: Fiche = {
    ...COMPLETE,
    histoire: {
      mode: "chronologie",
      moments: [
        { date: "2004", texte: "Naissance à Port-Amarée." },
        { date: "2015", texte: "Le départ.\nEt ce qui a suivi." },
        { date: "aujourd'hui", texte: "Il revient." },
      ],
    },
  };
  assertEquals(lireUneFiche(publier(f)), f);
});

Deno.test("UNE CHRONOLOGIE VIDE RESTE UNE CHRONOLOGIE", () => {
  //  Sans le mode écrit dans la fiche, une chronologie sans moment et
  //  un pavé vide produiraient le même corps, et rouvrir sa fiche en
  //  changerait la forme sous les doigts.
  const f: Fiche = { ...ficheVide(), nom: "X", histoire: { mode: "chronologie", moments: [] } };
  assertEquals(lireUneFiche(publier(f)).histoire, { mode: "chronologie", moments: [] });
});

Deno.test("la fiche vide se relit vide, sans rien inventer", () => {
  const f = { ...ficheVide(), nom: "Sans rien d'autre" };
  assertEquals(lireUneFiche(publier(f)), f);
});

Deno.test("SANS GROUPE OMBRE, LE BLOC N'EXISTE PAS — et il ne revient pas", () => {
  const f: Fiche = { ...COMPLETE, ombre: null };
  const html = publier(f);
  assertEquals(/wmf__ombre/.test(html), false);
  assertEquals(lireUneFiche(html).ombre, null);
});

Deno.test("UNE CASE COCHÉE SANS RÉPONSE RESTE COCHÉE", () => {
  //  C'est la boîte qui dit l'appartenance, pas les réponses : un
  //  joueur du Groupe Ombre qui n'a encore rien rempli doit retrouver
  //  sa case, pas la recocher à chaque visite.
  const vides = Object.fromEntries(OMBRE.map((c) => [c.clef, ""]));
  const f: Fiche = { ...COMPLETE, ombre: vides };
  assertEquals(lireUneFiche(publier(f)).ombre, vides);
});

Deno.test("sans starter, rien ne se publie et rien ne se relit", () => {
  const f: Fiche = { ...COMPLETE, starter: null };
  assertEquals(lireUneFiche(publier(f)).starter, null);
});

// ── ce que le joueur écrit dedans ───────────────────────────────────

Deno.test("LES BALISES DU JOUEUR TRAVERSENT INTACTES", () => {
  //  « Pouvoir ajouter des balises de texte comme on veut. » Les
  //  échapper ferait apparaître `&lt;b&gt;` dans sa fiche.
  const f: Fiche = {
    ...ficheVide(),
    nom: "X",
    histoire: {
      mode: "pave",
      texte: "<b>gras</b>, <i>italique</i>, et [quote]une citation[/quote]",
    },
  };
  assertEquals(
    lireUneFiche(publier(f)).histoire,
    { mode: "pave", texte: "<b>gras</b>, <i>italique</i>, et [quote]une citation[/quote]" },
  );
});

Deno.test("ON NE PEUT PAS COUPER SA PROPRE FICHE EN DEUX", () => {
  //  Un joueur qui écrirait la fermeture d'une de nos balises dans son
  //  texte scinderait la fiche à la relecture : tout ce qui suit
  //  tomberait. Le motif est neutralisé à l'écriture et rendu à la
  //  lecture, donc il se relit tel qu'il a été tapé.
  const piege = "il a dit </wmf-histoire> puis <wmf-nom> et il est parti";
  const f: Fiche = {
    ...ficheVide(),
    nom: "X",
    histoire: { mode: "pave", texte: piege },
  };
  const relue = lireUneFiche(publier(f));
  assertEquals(relue.histoire, { mode: "pave", texte: piege });
  //  ET LE RESTE DE LA FICHE TIENT : c'est tout l'objet.
  assertEquals(relue.nom, "X");
});

Deno.test("un champ long garde ses sauts de ligne", () => {
  //  « On doit pouvoir écrire quelques mots ou un paragraphe. » Un
  //  paragraphe qui perd ses retours à la ligne n'est plus un
  //  paragraphe.
  const f: Fiche = {
    ...ficheVide(),
    nom: "X",
    identite: { ...ficheVide().identite, traits: "Patient.\n\nMais pas toujours." },
  };
  assertEquals(lireUneFiche(publier(f)).identite.traits, "Patient.\n\nMais pas toujours.");
});

// ── ce qu'on refuse d'écraser ───────────────────────────────────────

Deno.test("UN MESSAGE QUI N'EST PAS UNE FICHE SE RECONNAÎT", () => {
  //  Le formulaire réécrit le message entier. Sur une fiche de la V1,
  //  ou sur un texte écrit à la main, écrire reviendrait à effacer le
  //  travail de quelqu'un sans le lui demander.
  assertEquals(ressembleAUneFiche(""), false);
  assertEquals(ressembleAUneFiche("<p>Bonjour, voici mon personnage.</p>"), false);
  //  L'ANCIENNE FICHE, telle que le sujet t50 la donne.
  assertEquals(
    ressembleAUneFiche('<center><div class="bk1"><div class="bkt2">Prénom P. Nom</div>'),
    false,
  );
  assertEquals(ressembleAUneFiche(publier(COMPLETE)), true);
});

Deno.test("une fiche méconnue se lit vide plutôt que de deviner", () => {
  assertEquals(lireUneFiche("<p>un texte libre</p>"), ficheVide());
});

// ── la mise en page qu'elle a demandée ──────────────────────────────

Deno.test("LE NOM EST EN TITRE, ET LA FICHE N'EST PAS CENTRÉE", () => {
  //  « Le nom du personnage en haut, en titre, collé à gauche. »
  //  C'est la seule différence de fond avec la mise en page de la V1,
  //  qui enveloppait tout dans un `<center>`.
  const html = publier(COMPLETE);
  assertEquals(
    /<div class="wmf__titre"><wmf-nom>Jak A\. Fering<\/wmf-nom><\/div>/.test(html),
    true,
  );
  assertEquals(/<center>/i.test(html), false);
});

Deno.test("DEUX COLONNES, ET AUCUN TABLEAU", () => {
  //  « 2 colonnes : une pour l'avatar, à droite les informations. »
  //  Et « je veux pas de tableau, que du flexbox ».
  const html = publier(COMPLETE);
  assertEquals(/<div class="wmf__haut">/.test(html), true);
  assertEquals(/<div class="wmf__avatar">/.test(html), true);
  assertEquals(/<div class="wmf__infos">/.test(html), true);
  assertEquals(/<table|<tr|<td/i.test(html), false);
});

Deno.test("l'avatar choisi devient l'image de la colonne de gauche", () => {
  //  « On peut rajouter le lien de l'avatar pour afficher l'avatar
  //  qu'on souhaite dans sa fiche. » L'adresse est donc à la fois une
  //  valeur qu'on relit et une image qu'on voit.
  const html = publier(COMPLETE);
  assertEquals(html.includes('<img src="https://exemple.test/avatar.png" alt="" />'), true);
  assertEquals(lireUneFiche(html).avatar, "https://exemple.test/avatar.png");
});

Deno.test("SANS AVATAR, PAS D'IMAGE CASSÉE", () => {
  //  Un `<img src="">` dessine l'icône d'image manquante du
  //  navigateur, en plein milieu de la fiche de quelqu'un.
  const html = publier({ ...ficheVide(), nom: "X" });
  assertEquals(/<img/.test(html), false);
});

Deno.test("UN CHAMP VIDE NE S'IMPRIME PAS", () => {
  //  « SURNOM » tout seul dans une fiche publiée n'apprend rien, et le
  //  joueur qui n'a pas de surnom n'a pas à en inventer un.
  const f: Fiche = {
    ...ficheVide(),
    nom: "X",
    identite: { ...ficheVide().identite, metier: "Ranger" },
  };
  const html = publier(f);
  assertEquals(html.includes("<y>MÉTIER</y>"), true);
  assertEquals(html.includes("<y>SURNOM</y>"), false);
});

Deno.test("UN CHAMP EST UN BLOC, ÉTIQUETTE AU-DESSUS", () => {
  //  « Les gens ont tendance à développer et à écrire quelques lignes
  //  pour chaque info. » Une étiquette au fil du texte se perd dans le
  //  paragraphe d'avant ; il lui faut son bloc.
  const html = publier(COMPLETE);
  assertEquals(html.includes(`<div class="wmf__champ"><y>MÉTIER</y>`), true);
  //  ET CELLES QUI NE SE RANGENT PAS EN GRILLE SONT MARQUÉES.
  assertEquals(html.includes(`<div class="wmf__champ" data-long="oui"><y>TRAITS`), true);
  assertEquals(html.includes(`data-long="oui"><y>AVIS SUR LE FORUM`), true);
});

Deno.test("LE FACECLAIM MONTE SOUS L'AVATAR, ET N'EST PLUS EN BAS", () => {
  //  « Le mieux, mettre ça sous l'avatar, dans un encadré. » Il doit
  //  donc sortir du bloc « Derrière l'écran » — sinon il s'écrirait
  //  deux fois, et `lireUneFiche` relirait le second.
  const html = publier(COMPLETE);
  const haut = html.slice(0, html.indexOf(`class="wmf__histoire"`));
  assertEquals(haut.includes(`<div class="wmf__fc">`), true);
  assertEquals(haut.includes("<wmf-j-avatar>"), true);
  //  UNE SEULE FOIS DANS TOUTE LA FICHE.
  assertEquals(html.split("<wmf-j-avatar>").length - 1, 1);
});

Deno.test("LA TRAINER CARD EST UNE IMAGE, PAS UNE ADRESSE EN TOUTES LETTRES", () => {
  //  « C'est une image carrée. Le mieux, c'est de mettre le lien et de
  //  l'intégrer dans la fiche pour que ça rende bien. »
  const f: Fiche = {
    ...COMPLETE,
    joueur: { ...COMPLETE.joueur, "j-tcard": "https://exemple.test/carte.png" },
  };
  const html = publier(f);
  assertEquals(
    html.includes(`<div class="wmf__tcard"><img src="https://exemple.test/carte.png"`),
    true,
  );
  assertEquals(html.split("<wmf-j-tcard>").length - 1, 1);
  //  SANS ADRESSE, PAS D'IMAGE CASSÉE — comme pour l'avatar.
  const sans: Fiche = { ...COMPLETE, joueur: { ...COMPLETE.joueur, "j-tcard": "" } };
  assertEquals(publier(sans).includes(`<div class="wmf__tcard"><img`), false);
});

Deno.test("LES DEUX IMAGES SE RELISENT, OÙ QU'ELLES SOIENT PASSÉES", () => {
  //  Déplacer un champ dans la mise en page ne doit pas le perdre à la
  //  relecture : c'est le seul risque de ce remaniement.
  const f: Fiche = {
    ...COMPLETE,
    joueur: {
      ...COMPLETE.joueur,
      "j-avatar": "Alex Høgh Andersen",
      "j-tcard": "https://exemple.test/carte.png",
    },
  };
  assertEquals(lireUneFiche(publier(f)), f);
});

Deno.test("LES ÉTIQUETTES SONT CELLES DE L'ANCIENNE FICHE", () => {
  //  Relevées dans le sujet t50. On ne réécrit pas leur texte — sauf
  //  « MEMBRE D'UNE ORGANISATION », devenu « ALLÉGEANCE », qui est le
  //  mot employé maintenant.
  const etiquettes = IDENTITE.map((c) => c.etiquette);
  assertEquals(etiquettes.includes("DATE DE NAISSANCE (ÂGE)"), true);
  assertEquals(etiquettes.includes("TRAITS DE CARACTÈRE"), true);
  assertEquals(etiquettes.includes("ALLÉGEANCE"), true);
  assertEquals(JOUEUR.map((c) => c.etiquette).includes("IMAGE POUR LA TRAINER CARD"), true);
  assertEquals(JOUEUR.map((c) => c.etiquette).includes("D'OÙ NOUS CONNAIS-TU ?"), true);
});

Deno.test("LE STARTER NE DEMANDE NI NIVEAU NI ATTAQUES", () => {
  //  « Les niveaux ne sont pas choisis par les joueurs : le staff les
  //  attribuera selon l'âge, le métier et le passé du personnage. »
  //  L'ancienne fiche faisait taper « ATTAQUE 0PP (PUISSANCE) »
  //  quatre fois.
  const html = publier(COMPLETE);
  assertEquals(/ATTAQUE|niveau|niv\./i.test(html), false);
  //  Mais l'espèce et son identifiant y sont, pour que la fiche se
  //  relie à nos données.
  assertEquals(html.includes("<wmf-s-id>25</wmf-s-id>"), true);
});

Deno.test("CHAQUE CLÉ EST UNIQUE — sinon un champ en écrase un autre", () => {
  //  Deux champs qui porteraient la même clé écriraient la même
  //  balise, et la relecture rendrait le premier aux deux. Ça ne se
  //  voit qu'à l'usage, et tard.
  const clefs = [...IDENTITE, ...JOUEUR, ...OMBRE].map((c) => c.clef);
  assertEquals(new Set(clefs).size, clefs.length);
});

Deno.test("AUCUNE CLÉ N'EST LE PRÉFIXE D'UNE AUTRE", () => {
  //  `<wmf-nom>` et `<wmf-nombre>` : le motif de lecture cherche
  //  `</wmf-nom>`, qui n'apparaît pas dans `</wmf-nombre>` — mais
  //  l'ouverture `<wmf-nom>` ne correspond pas non plus à
  //  `<wmf-nombre>`, donc c'est sûr. Ce contrôle est là pour le jour
  //  où quelqu'un passerait à une lecture plus lâche.
  const clefs = [
    "nom",
    "tw",
    "avatar",
    "histoire",
    "ancienne",
    "m-date",
    "m-texte",
    "s-espece",
    "s-surnom",
    "s-talent",
    "s-rencontre",
    ...[...IDENTITE, ...JOUEUR, ...OMBRE].map((c) => c.clef),
  ];
  for (const a of clefs) {
    for (const b of clefs) {
      if (a !== b) assertEquals(b.startsWith(a + "-"), false, `${b} commence par ${a}-`);
    }
  }
});

// ── rendre aussi ce qui est vide, pour l'éditeur ─────────────────────

/*  « Je veux visuellement remplir ma fiche de présentation. »

    L'éditeur EST cette fonction : il rend la fiche, puis rend chacune
    de ses valeurs modifiable sur place. Pour qu'il y ait une zone où
    écrire là où rien n'est encore écrit, `publier` doit savoir rendre
    le vide — sans jamais le faire pour le message publié. */

Deno.test("POUR L'ÉDITEUR, CHAQUE CHAMP A SA ZONE", () => {
  //  C'est la propriété dont dépend tout l'éditeur : un champ sans
  //  balise est un champ sur lequel on ne peut pas cliquer, et le
  //  joueur n'aurait aucun moyen de le remplir.
  const html = publier(ficheVide(), { pourEcrire: true });
  const manquants = [
    "nom",
    "tw",
    "avatar",
    "ancienne",
    ...IDENTITE.map((c) => c.clef),
    ...JOUEUR.map((c) => c.clef),
    ...OMBRE.map((c) => c.clef),
    "s-espece",
    "s-surnom",
    "s-talent",
    "s-rencontre",
  ].filter((clef) => !html.includes(`<wmf-${clef}>`));
  assertEquals(manquants, []);
});

Deno.test("POUR L'ÉDITEUR, LES BLOCS OPTIONNELS SONT LÀ AUSSI", () => {
  //  Le starter et l'organisation ne se publient que remplis. À
  //  l'écran, il faut pouvoir les remplir — donc les voir.
  const html = publier(ficheVide(), { pourEcrire: true });
  assertEquals(html.includes(`class="wmf__starter"`), true);
  assertEquals(html.includes(`class="wmf__ombre"`), true);
  assertEquals(html.includes(`class="wmf__tw"`), true);
  assertEquals(html.includes(`class="wmf__ancienne"`), true);
});

Deno.test("UNE CHRONOLOGIE VIDE OFFRE UN MOMENT À REMPLIR", () => {
  const f: Fiche = { ...ficheVide(), histoire: { mode: "chronologie", moments: [] } };
  assertEquals(publier(f).includes("<wmf-m-date>"), false);
  assertEquals(publier(f, { pourEcrire: true }).includes("<wmf-m-date>"), true);
});

Deno.test("L'OPTION NE CHANGE RIEN AU MESSAGE PUBLIÉ", () => {
  //  La garde qui compte : `pourEcrire` sert l'écran, et rien d'autre.
  //  Si elle fuyait dans le chemin de publication, chaque fiche
  //  partirait avec trente étiquettes suivies de rien — et les balises
  //  du joueur en caractères visibles.
  assertEquals(publier(COMPLETE, {}), publier(COMPLETE));
  assertEquals(publier(COMPLETE, { pourEcrire: false }), publier(COMPLETE));
  assertEquals(publier(ficheVide()).includes("<wmf-metier>"), false);
});

Deno.test("POUR L'ÉDITEUR, LES BALISES DU JOUEUR SONT DU TEXTE", () => {
  //  LE DÉFAUT QUI A FAIT NAÎTRE CE DRAPEAU, mesuré sur le vrai
  //  navigateur le 23 novembre : rendu tel quel, `<b>mardi</b>` devient
  //  un vrai élément dans la zone modifiable, et relire la zone rend
  //  « mardi » tout court. La frappe suivante réécrit le message avec
  //  cette version appauvrie — le gras disparaît sans que rien ne le
  //  dise.
  const ecran = publier(COMPLETE, { pourEcrire: true });
  assertEquals(ecran.includes("&lt;b&gt;pavé&lt;/b&gt;"), true);
  assertEquals(ecran.includes("<b>pavé</b>"), false);
  //  ET LE MESSAGE, LUI, LES GARDE VIVANTES.
  assertEquals(publier(COMPLETE).includes("<b>pavé</b>"), true);
});

Deno.test("CE QUI EST ÉCHAPPÉ POUR L'ÉCRAN SE RELIT TEL QUEL", () => {
  //  L'aller-retour de l'éditeur : le navigateur ré-analyse ce HTML,
  //  donc `&lt;` redevient `<` dans la zone, et c'est ce `<` qui part
  //  dans le message. Les deux chemins doivent rendre le même texte.
  const piege: Fiche = {
    ...ficheVide(),
    nom: "A & B",
    histoire: { mode: "pave", texte: '<b>gras</b> & "guillemets" <wmf-nom>forgé</wmf-nom>' },
  };
  const ecran = publier(piege, { pourEcrire: true });
  //  RIEN NE S'Y ANALYSE : ni les balises du joueur, ni une balise à
  //  nous qu'il aurait tapée pour se faire passer pour l'éditeur.
  assertEquals(/<b>|<wmf-nom>forgé/.test(ecran), false);
  //  ET LE DÉSÉCHAPPEMENT DU NAVIGATEUR REND LE TEXTE D'ORIGINE.
  const comme = (s: string) =>
    s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"')
      .replace(/&amp;/g, "&");
  assertEquals(
    /<wmf-histoire>([\s\S]*?)<\/wmf-histoire>/.exec(ecran)?.[1] ?? "",
    "&lt;b&gt;gras&lt;/b&gt; &amp; &quot;guillemets&quot; &lt;wmf-nom&gt;forgé&lt;/wmf-nom&gt;",
  );
  assertEquals(
    comme(
      "&lt;b&gt;gras&lt;/b&gt; &amp; &quot;guillemets&quot; &lt;wmf-nom&gt;forgé&lt;/wmf-nom&gt;",
    ),
    piege.histoire.mode === "pave" ? piege.histoire.texte : "",
  );
});

// ── le sprite du starter ────────────────────────────────────────────

Deno.test("LE POKÉMON CHOISI S'AFFICHE", () => {
  //  « Affiche le pokémon qui est sélectionné. » Un message est du
  //  HTML figé : l'adresse part avec la fiche, parce qu'aucun script
  //  ne tournera dedans pour aller la chercher ensuite.
  const html = publier(COMPLETE, { racine: "https://exemple.test/wm/" });
  assertEquals(
    html.includes(
      `<img class="wmf__sprite" src="https://exemple.test/wm/assets/sprites-figes/forum/25.png"`,
    ),
    true,
  );
});

Deno.test("SANS RACINE, PAS D'IMAGE — et pas d'image cassée non plus", () => {
  assertEquals(publier(COMPLETE).includes("wmf__sprite"), false);
});

Deno.test("SANS ESPÈCE CHOISIE, PAS DE SPRITE", () => {
  //  L'éditeur rend le bloc du starter avant qu'on ait choisi, pour
  //  qu'il y ait où écrire. Un sprite « numéro 0 » y serait un 404.
  const html = publier(ficheVide(), {
    pourEcrire: true,
    racine: "https://exemple.test/wm/",
  });
  assertEquals(html.includes(`class="wmf__starter"`), true);
  assertEquals(html.includes("wmf__sprite"), false);
});

Deno.test("L'IMAGE N'EMPÊCHE PAS DE RELIRE LA FICHE", () => {
  //  L'aller-retour qui fait foi, avec le sprite en plus : il n'est
  //  porteur d'aucune valeur, donc il ne doit en changer aucune.
  assertEquals(
    lireUneFiche(publier(COMPLETE, { racine: "https://exemple.test/wm/" })),
    COMPLETE,
  );
});
