// ════════════════════════════════════════════════════════════════════
//  src/application/fiche-de-combat.ts
//
//  Les briques HTML des messages de combat : la fiche d'un combattant,
//  les pastilles de type, l'enveloppe.
//
//  « Ce serait bien d'avoir une petite card, l'image des pokémons, avec
//  les infos » — 18 novembre, en regardant la carte du Debugant.
//
//  ── CE QUI A CHANGÉ, ET POURQUOI C'ÉTAIT DÉFENDABLE AVANT ───────────
//
//  La carte était du TEXTE NU, et l'en-tête de `carte-de-rencontre.ts`
//  disait pourquoi : « le forum les affiche partout pareil, la mise en
//  forme ne casse pas ». C'était vrai, et ce n'est plus la bonne
//  réponse — pour une raison qu'on a MESURÉE le 18 novembre sur le
//  sujet t1000 : le message du Maître du Jeu porte déjà du HTML qui
//  survit, `<span class="wm-marqueur" hidden>`. Le filtre du forum
//  garde donc `class`, et toute la charte du forum est faite de
//  composants collés en HTML dans des messages.
//
//  L'argument « ça cassera le jour où la charte change » tombe aussi :
//  une fiche en texte nu ne suit JAMAIS la charte, une fiche en
//  `wm-` la suit toujours.
//
//  ── TOUT SUR UNE LIGNE, ET C'EST UNE CONTRAINTE DU FORUM ────────────
//
//  Forumactif transforme chaque retour à la ligne en `<br>`. Un HTML
//  indenté donnerait un `<br>` entre chaque balise — et le défaut est
//  connu, il est écrit dans le suivi des collages du 10 novembre :
//  « un `<br>` de l'éditeur traînait entre chaque poste ». D'où
//  `joindre()`, qui colle sans séparateur, et aucun gabarit sur
//  plusieurs lignes dans ce fichier.
//
//  ── LE SURNOM VIENT DU JOUEUR ───────────────────────────────────────
//
//  Donc il s'échappe. C'est la seule donnée de ces messages qu'un
//  joueur écrit lui-même, et un surnom valant `<script>` passerait du
//  carnet au message du Maître du Jeu sans jamais croiser un filtre :
//  la base ne filtre pas, le forum fait confiance au compte qui poste,
//  et ce compte est le nôtre.
// ════════════════════════════════════════════════════════════════════

import { adresseDuSpriteFige } from "./sprite.ts";

/** Les quatre caractères qui comptent, dans l'ordre où il faut les
 *  traiter — `&` d'abord, sinon on échappe ses propres échappements.
 *
 *  ── L'APOSTROPHE N'EN FAIT PAS PARTIE, ET C'EST MESURÉ ──────────────
 *
 *  Elle y était au premier jet, et le test du tour l'a dit tout de
 *  suite : « Ça n&#39;a aucun effet. » Le navigateur l'affiche bien,
 *  mais la source du message devient illisible — et en français il y a
 *  une apostrophe par phrase.
 *
 *  Elle ne sert qu'à sortir d'un attribut écrit entre apostrophes.
 *  CE FICHIER N'EN ÉCRIT AUCUN : tous ses attributs sont entre
 *  guillemets, et `"` est échappé. La règle à tenir est donc celle-là,
 *  et non la liste de caractères — si un jour un attribut s'écrit
 *  entre apostrophes ici, c'est l'attribut qu'il faut corriger.
 *
 *  La seule donnée de joueur de ces messages — le surnom — va dans du
 *  TEXTE, jamais dans un attribut. */
export function echapper(brut: string): string {
  return brut
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Colle les morceaux SANS séparateur. Voir l'en-tête : un espace ou
 *  un retour entre deux balises devient un `<br>` chez Forumactif. */
export function joindre(morceaux: readonly string[]): string {
  return morceaux.join("");
}

/** Un type est une clé à plat de la base — « electrik », « feu ».
 *
 *  ON REFUSE CE QUI N'EN A PAS LA FORME, et on ne l'échappe pas pour
 *  le laisser passer : un type inconnu dans un nom de classe ne
 *  donnerait aucun style, donc une pastille nue au milieu de deux
 *  pastilles colorées. Mieux vaut qu'elle n'y soit pas et que le
 *  garde-fou n° 37 le dise. */
const FORME_DE_TYPE = /^[a-z]+$/;

export function pastillesDeType(types: readonly string[]): string {
  return joindre(
    types.filter((t) => FORME_DE_TYPE.test(t)).map((t) =>
      `<span class="wm-type wm-type--${t}" data-wm-type="${t}">` +
      `${echapper(t.charAt(0).toUpperCase() + t.slice(1))}</span>`
    ),
  );
}

/** Un combattant, tel que la fiche l'affiche.
 *
 *  `pvMax` est `null` pour le sauvage, qui arrive entier : la fiche
 *  écrit « 30 PV » de son côté et « 11/18 PV » de l'autre. Le maximum
 *  d'un sauvage n'apprend rien au joueur, et l'écrire ferait croire
 *  qu'il a déjà pris des coups. */
export type Combattant = {
  readonly especeId: number;
  readonly nom: string;
  readonly surnom?: string | null;
  readonly niveau?: number | null;
  readonly types?: readonly string[];
  readonly pv: number;
  readonly pvMax?: number | null;
  readonly attaque?: number | null;
  readonly defense?: number | null;
};

/** Le nom affiché : le surnom s'il y en a un, l'espèce entre
 *  parenthèses — on ne fait pas disparaître l'espèce, le joueur doit
 *  pouvoir lire l'affiche des types. */
export function nomAffiche(nom: string, surnom?: string | null): string {
  const propre = surnom?.trim();
  return propre ? `${propre} (${nom})` : nom;
}

/** La fiche d'un combattant : sprite, nom, niveau, types, PV, stats.
 *
 *  `camp` vaut `sauvage` ou `mien`, et sert au CSS à retourner le
 *  sprite : les sprites de face regardent tous dans le même sens, et
 *  deux Pokémon qui regardent à droite ne se battent pas, ils
 *  attendent le bus. */
export function fiche(
  c: Combattant,
  camp: "sauvage" | "mien",
  racine: string,
): string {
  const adresse = adresseDuSpriteFige(racine, c.especeId);
  const nom = nomAffiche(c.nom, c.surnom);
  const pv = c.pvMax === null || c.pvMax === undefined ? `${c.pv} PV` : `${c.pv}/${c.pvMax} PV`;

  //  `tabindex="0"` PARCE QU'UNE BULLE AU SURVOL N'EXISTE PAS AU
  //  CLAVIER. La carte de dresseur le fait depuis le 30 octobre, et
  //  `:focus-within` ouvre la bulle comme `:hover`.
  const morceaux: string[] = [
    `<div class="wm-combat__camp wm-combat__camp--${camp}" tabindex="0">`,
  ];

  //  PAS D'IMAGE PLUTÔT QU'UNE IMAGE CASSÉE — l'espèce de test n'a pas
  //  de sprite, et la fiche doit tenir debout sans lui.
  //
  //  ── L'ALTERNATIVE PORTE LE NOM, ET CE N'EST PAS DÉCORATIF ──────
  //
  //  Elle était vide : le nom est juste en dessous, donc l'image ne
  //  dit rien de neuf, et c'est la règle pour une illustration.
  //  SAUF QUE FORUMACTIF REMPLIT LES ALTERNATIVES VIDES tout seul,
  //  avec le titre du sujet et le nom du fichier — relevé le
  //  18 novembre sur /t1000 : `alt="Sujet 2 21"`. Un sprite qui ne
  //  charge pas affichait donc « Sujet 2 21 » en toutes lettres au
  //  milieu de la carte.
  //
  //  On écrit donc le nom nous-mêmes : si l'image manque, la carte dit
  //  « Piafabec » plutôt qu'un numéro de fichier.
  if (adresse !== null) {
    morceaux.push(
      `<img class="wm-combat__sprite" src="${echapper(adresse)}" ` +
        `alt="${echapper(nom)}" loading="lazy">`,
    );
  }

  morceaux.push(`<p class="wm-combat__nom">${echapper(nom)}</p>`);
  if (c.niveau !== null && c.niveau !== undefined) {
    morceaux.push(`<p class="wm-combat__niveau">niv. ${c.niveau}</p>`);
  }
  if (c.types !== undefined && c.types.length > 0) {
    morceaux.push(`<p class="wm-combat__types">${pastillesDeType(c.types)}</p>`);
  }
  morceaux.push(jaugeDesPv(c, pv));

  //  ── LES CHIFFRES PASSENT DANS L'INFOBULLE ───────────────────────
  //
  //  « Je pense que tu peux du coup mettre les stats en infobulle » —
  //  18 novembre, après avoir rapproché la fiche de la carte de
  //  dresseur. C'est la même bulle, `.wm-infobulle` de la planche 39,
  //  celle que la carte de dresseur ouvre déjà au survol de chaque
  //  case.
  //
  //  CE QUI RESTE VISIBLE EST CE QU'ON LIT À CHAQUE TOUR : le nom, le
  //  niveau, les types et les PV. L'attaque et la défense ne changent
  //  pas d'un tour à l'autre — on les consulte une fois, au début.
  //
  //  ELLE S'OUVRE SANS JAVASCRIPT, au survol et au clavier : le
  //  message est du HTML posé dans un sujet, personne ne vient
  //  l'animer après coup.
  const bulle = infobulle(c, nom);
  if (bulle !== null) morceaux.push(bulle);

  morceaux.push("</div>");
  return joindre(morceaux);
}

/**
 * La ligne des PV : le chiffre, et la barre qui le montre.
 *
 * ── POURQUOI UNE BARRE ──────────────────────────────────────────────
 *
 * « Améliore la hiérarchisation des informations entre le nom du
 * pokémon, son niveau, ses pvs. Peut-être faire une jauge ? » —
 * 18 novembre.
 *
 * Les PV sont la seule ligne de la fiche qui change à chaque tour, et
 * c'est une PROPORTION qu'on lit, pas un nombre : « 18 sur 24 »
 * demande une soustraction, une barre aux trois quarts ne demande
 * rien. Le chiffre reste écrit à côté — une barre seule ne dit pas
 * combien de dégâts passent encore.
 *
 * ── LA COULEUR NE PORTE RIEN TOUTE SEULE ────────────────────────────
 *
 * Trois paliers, les jetons du forum : vert, ocre, rouge. Mais le
 * chiffre est là quoi qu'il arrive, et la barre est `aria-hidden` :
 * personne ne dépend de la teinte pour savoir où il en est.
 *
 * ── LE SAUVAGE ENTIER N'A PAS DE MAXIMUM ────────────────────────────
 *
 * `pvMax` manque à la première apparition, et ce n'est pas un trou :
 * la bête arrive intacte, donc la barre est pleine et le chiffre
 * reste « 30 PV » sans fraction. Écrire « 30/30 » ferait croire
 * qu'on connaît un total qu'on ne nous a pas donné.
 */
export function jaugeDesPv(c: Combattant, texte: string): string {
  const connu = c.pvMax !== null && c.pvMax !== undefined && c.pvMax > 0;
  const max = connu ? (c.pvMax as number) : c.pv;
  const part = max > 0 ? Math.max(0, Math.min(100, Math.round((c.pv / max) * 100))) : 0;
  const classe = part <= 20
    ? " wm-combat__jauge--bas"
    : part <= 50
    ? " wm-combat__jauge--moyen"
    : "";
  return joindre([
    //  `data-wm-part` DIT QUE LA FICHE PORTE DÉJÀ SA JAUGE. Le module
    //  du navigateur en pose une sur les cartes plus anciennes, qui
    //  n'en ont pas ; sans cette marque il la poserait deux fois.
    `<p class="wm-combat__pv" data-wm-part="${part}">`,
    `<span class="wm-combat__pv-chiffre">${echapper(texte)}</span>`,
    `<span class="wm-combat__jauge${classe}" aria-hidden="true">` +
    `<span class="wm-combat__jauge-plein" style="width:${part}%"></span></span>`,
    "</p>",
  ]);
}

/** La bulle d'une case, ou `null` quand il n'y a rien de plus à dire.
 *
 *  Le message d'un TOUR ne porte ni niveau, ni types, ni statistiques
 *  — `tours_a_poster` ne les rend pas, parce qu'ils ont été lus au
 *  premier message. Une bulle qui répéterait les PV déjà affichés
 *  serait une bulle qui s'ouvre pour rien. */
function infobulle(c: Combattant, nom: string): string | null {
  const aDesStats = c.attaque !== null && c.attaque !== undefined &&
    c.defense !== null && c.defense !== undefined;
  if (!aDesStats) return null;

  const morceaux: string[] = ['<span class="wm-infobulle" role="tooltip">'];

  morceaux.push('<span class="wm-infobulle__tete">');
  morceaux.push(`<span class="wm-infobulle__nom">${echapper(nom)}</span>`);
  if (c.niveau !== null && c.niveau !== undefined) {
    morceaux.push(`<span class="wm-infobulle__niveau">Niv. ${c.niveau}</span>`);
  }
  morceaux.push("</span>");

  if (c.types !== undefined && c.types.length > 0) {
    morceaux.push('<span class="wm-infobulle__types">');
    for (const type of c.types.filter((x) => FORME_DE_TYPE.test(x))) {
      morceaux.push(
        `<span class="wm-infobulle__type" data-wm-type="${type}">` +
          `${echapper(type.charAt(0).toUpperCase() + type.slice(1))}</span>`,
      );
    }
    morceaux.push("</span>");
  }

  //  LA JAUGE N'EXISTE QUE QUAND LE MAXIMUM EST CONNU. Le sauvage
  //  arrive entier et n'en porte pas : une barre pleine à côté d'un
  //  « 30 PV » sans fraction ferait croire qu'on connaît son total
  //  alors qu'on affiche juste ce qu'il a.
  if (c.pvMax !== null && c.pvMax !== undefined && c.pvMax > 0) {
    const part = Math.max(0, Math.min(100, Math.round((c.pv / c.pvMax) * 100)));
    morceaux.push(
      '<span class="wm-infobulle__pv">',
      `<span class="wm-infobulle__jauge"><span style="width:${part}%"></span></span>`,
      `<span class="wm-infobulle__chiffre">${c.pv}/${c.pvMax} PV</span>`,
      "</span>",
    );
  }

  morceaux.push(
    '<span class="wm-infobulle__surtitre">Statistiques</span>',
    '<span class="wm-infobulle__stats">',
    `<span class="wm-infobulle__stat"><span>Attaque</span><span>${c.attaque}</span></span>`,
    `<span class="wm-infobulle__stat"><span>Défense</span><span>${c.defense}</span></span>`,
    "</span>",
    "</span>",
  );
  return joindre(morceaux);
}

/** Les deux fiches face à face, avec le mot entre elles.
 *
 *  LE MOT EST DANS LE BALISAGE, pas en `::before` : un lecteur d'écran
 *  doit l'entendre, et un contenu CSS ne s'entend pas partout. */
export function duel(gauche: string, droite: string | null): string {
  if (droite === null) return `<div class="wm-combat__duel">${gauche}</div>`;
  return joindre([
    '<div class="wm-combat__duel">',
    gauche,
    '<p class="wm-combat__contre">contre</p>',
    droite,
    "</div>",
  ]);
}

/** L'enveloppe de la fiche. `variante` distingue la rencontre du tour,
 *  pour que l'une puisse se poser autrement que l'autre sans toucher à
 *  l'autre. */
export function enveloppe(
  variante: "rencontre" | "tour",
  dedans: readonly string[],
): string {
  return joindre([
    `<div class="wm-combat wm-combat--${variante}">`,
    ...dedans,
    "</div>",
  ]);
}
