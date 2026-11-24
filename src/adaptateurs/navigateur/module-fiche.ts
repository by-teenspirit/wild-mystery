// ════════════════════════════════════════════════════════════════════
//  Le formulaire de la fiche de présentation, posé sur la page de
//  réponse du forum des Présentations.
//
//  « Normalement, quand on crée un sujet [dans Présentations] ça
//  remplit un formulaire HTML. Et d'ailleurs quand on édite son
//  message, ce serait super que ça reste comme ça. » — 23 novembre.
//
//  ── IL SE POSE EN JAVASCRIPT, ET RIEN N'EST À RECOLLER ──────────────
//
//  Le gabarit `posting_body` n'est pas touché. Le formulaire est
//  inséré devant `#postingbox`, par script, à l'ouverture de la page.
//
//  C'est un choix de déploiement autant que de code : un gabarit
//  modifié se recolle à la main dans le panneau d'administration, et
//  chaque recollage est une occasion de perdre un bloc. Le paquet, lui,
//  part tout seul avec le `git push`.
//
//  ── L'ÉDITEUR EST LA FICHE, PAS UN FORMULAIRE À CÔTÉ ───────────────
//
//  « En fait, je veux pas juste remplir les champs. Je veux
//  visuellement remplir ma fiche de présentation. » — 23 novembre.
//
//  Il n'y a donc pas de liste d'étiquettes et de cases. `publier` rend
//  la fiche — la VRAIE, celle qui partira, avec la vraie feuille de
//  style — et chacune de ses valeurs devient une zone où l'on écrit,
//  là où elle se trouve dans la mise en page.
//
//  C'EST CE QUI GARANTIT QU'IL N'Y EN A QU'UNE. Une seconde mise en
//  page écrite pour l'écran finirait par ne plus ressembler à ce qui
//  part : un bloc ajouté d'un côté, une colonne déplacée de l'autre,
//  et personne pour s'en apercevoir avant un joueur.
//
//  DEUX CONSÉQUENCES, ÉCRITES PLUTÔT QUE DÉCOUVERTES :
//
//   · LES BALISES S'AFFICHENT COMME DES BALISES pendant qu'on écrit.
//     La mise en page est vivante, le `<b>` tapé dans le pavé ne l'est
//     pas — il le devient dans le message publié. Le rendre vivant
//     demanderait un éditeur de texte riche, et le message cesserait
//     d'être la seule source de la fiche.
//
//     CE N'EST PAS QU'UN CHOIX D'AFFICHAGE : rendu vivant, le `<b>`
//     devient un vrai élément dans la zone, et relire la zone le perd.
//     C'est `pourEcrire` qui l'échappe, et c'est pour ça qu'il existe
//     — voir `echappe` dans `fiche.ts`.
//
//   · L'ÉCRAN MONTRE PLUS QUE LE MESSAGE. `publier` tait les champs
//     vides ; l'éditeur les affiche, sinon il n'y aurait nulle part où
//     cliquer. D'où `publier(f, { pourEcrire: true })` pour l'écran, et
//     `publier(f)` pour ce qui part.
//
//  ── IL ÉCRIT LE MESSAGE, IL NE LE POSTE PAS ─────────────────────────
//
//  C'est la même règle que la fiche de liens du carnet (`33-…`, § 4) :
//  le joueur garde son bouton « Envoyer », il peut relire, retoucher à
//  la main, annuler. **Aucun robot ne poste la fiche de son
//  personnage.**
//
//  ── ET IL S'ARRÊTE DÈS QU'IL NE RECONNAÎT PLUS LE MESSAGE ───────────
//
//  C'est la garde la plus importante du fichier. Le formulaire réécrit
//  le message ENTIER à chaque frappe. Sur un message qu'il n'a pas
//  écrit — une fiche de la V1, un texte retouché à la main — écrire
//  reviendrait à effacer le travail de quelqu'un sans le lui demander.
//
//  Deux moments :
//
//   · À L'OUVERTURE. Message vide → fiche neuve. Message qui est une
//     fiche → on la relit dans ses zones. Message qui n'en est pas
//     une → **on ne se pose pas du tout**, et le joueur garde son
//     bloc d'édition comme sur n'importe quelle autre page.
//
//   · AVANT CHAQUE ÉCRITURE. On relit ce qu'il y a dans l'éditeur. Si
//     ce n'est plus exactement ce qu'on y avait mis, le joueur a écrit
//     à la main entre-temps : on s'arrête, on le dit, et **on lui rend
//     son bloc d'édition** plutôt que d'écraser.
//
//  ── IL N'Y A PLUS DE BOUTON, ET C'EST POURQUOI ──────────────────────
//
//  « Du coup tu peux enlever les deux boutons du haut, non ? » — 23
//  novembre, après que la typo des invites a rendu la fiche lisible
//  d'un coup d'œil.
//
//  Les deux portaient chacune une sortie : « écrire le message à la
//  main » rendait le bloc d'édition, « remplacer le message par cette
//  fiche » reprenait un message inconnu. Les retirer en l'état aurait
//  laissé DEUX IMPASSES — un formulaire qui n'écrit pas et plus rien à
//  cliquer, un bloc d'édition caché qu'on ne peut plus récupérer.
//
//  On a donc retiré les boutons ET les états qui les demandaient : on
//  ne se pose plus sur un message inconnu, et l'arrêt rend le bloc de
//  lui-même. Zéro bouton, zéro impasse.
//
//  COUVERT PAR : outils/poster.mjs
//
//  PAS DE `surChangement` POUR ÇA. Il écoute le formulaire entier, donc
//  les frappes dans NOS champs le déclencheraient aussi, et nos propres
//  écritures émettent un `input`. Comparer avant d'écrire fait le même
//  travail sans boucle à démêler.
// ════════════════════════════════════════════════════════════════════

import {
  type Fiche,
  ficheVide,
  IDENTITE,
  JOUEUR,
  lireUneFiche,
  type Moment,
  OMBRE,
  publier,
  ressembleAUneFiche,
  type Starter,
} from "../../navigateur/fiche.ts";
import type { Brouillon } from "./editeur.ts";

/** Une espèce choisissable, telle que `data/starters.json` la rend. */
export type EspeceDeDepart = {
  readonly id: number;
  readonly nom: string;
  readonly types: readonly string[];
  readonly talents: readonly { readonly nom: string; readonly cache?: boolean }[];
  /** Le chemin de son sprite animé, à recoller derrière la base du
   *  catalogue. `outils/starters.py` les recopie de la couverture. */
  readonly sprite?: string;
};

/** Le catalogue tel qu'il arrive : une base, et des chemins.
 *
 *  LA BASE EST SORTIE DU TABLEAU parce qu'elle fait 151 caractères et
 *  qu'elle est la même pour les 436 : écrite à chaque ligne, elle
 *  pesait 64 Ko sur un fichier de 199, chargés à chaque ouverture de
 *  la page de réponse. */
export type CatalogueDesStarters = {
  readonly base: string;
  readonly especes: readonly EspeceDeDepart[];
};

export type DependancesDeLaFiche = {
  readonly doc: Document;
  readonly brouillon: Brouillon;
  /** Les espèces de départ. Appelée une fois, à l'ouverture. Une
   *  lecture qui échoue ne doit pas empêcher le reste du formulaire :
   *  le bloc du starter se dit indisponible, les autres marchent. */
  readonly starters: () => Promise<CatalogueDesStarters>;
};

const ID = "wm-fiche";

/** Deux fiches portent-elles les mêmes valeurs ?
 *
 *  `JSON.stringify` SUFFIT ET NE MENT PAS ICI : une `Fiche` n'est faite
 *  que de chaînes, de nombres, de tableaux et d'objets littéraux, tous
 *  construits dans le même ordre par `ficheVide` et `lireUneFiche`.
 *  Aucune date, aucune `Map`, aucun `undefined` — les trois choses qui
 *  rendraient la comparaison fausse sans le dire. */
export function memeFiche(a: Fiche, b: Fiche): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function el<T extends HTMLElement>(
  doc: Document,
  balise: string,
  classe: string,
  texte?: string,
): T {
  const e = doc.createElement(balise) as T;
  if (classe !== "") e.className = classe;
  if (texte !== undefined) e.textContent = texte;
  return e;
}

/*  CE QU'ON RETIRE DE L'APERÇU, ET POURQUOI SEULEMENT DE L'APERÇU.

    « Faut voir directement ce que ça va faire, c'est pas juste des
    champs à remplir » — 23 novembre. L'aperçu rend donc le VRAI HTML
    publié, avec la vraie feuille de style : c'est la seule façon
    honnête de montrer le résultat, et toute autre construction
    finirait par diverger de ce qui part vraiment.

    Mais le rendre, c'est l'exécuter. Le texte vient du joueur
    lui-même, dans sa propre page, donc il ne peut atteindre que lui —
    il n'y a personne à protéger de lui. Ce n'est pas une barrière de
    sécurité et ça ne prétend pas l'être.

    C'EST UNE BARRIÈRE CONTRE L'ACCIDENT. Un `<script>` collé depuis un
    tutoriel, une `<iframe>` recopiée d'un générateur de bannières, et
    l'aperçu se met à charger des choses ou à casser la page de
    réponse — au milieu de la rédaction, sans que le joueur comprenne
    ce qui arrive. Ce qui part dans le message, lui, n'est pas touché :
    c'est le filtre de Forumactif qui en décide, comme pour n'importe
    quel message. */
const HORS_APERCU = "script, iframe, object, embed, link, meta, base, form";

export function pourLApercu(doc: Document, html: string): DocumentFragment {
  const lu = new DOMParser().parseFromString(`<div>${html}</div>`, "text/html");
  for (const e of lu.querySelectorAll(HORS_APERCU)) e.remove();
  for (const e of lu.querySelectorAll("*")) {
    for (const a of [...e.attributes]) {
      //  LES GESTIONNAIRES D'ÉVÈNEMENTS ET LES ADRESSES EXÉCUTABLES.
      //  `onerror` sur une image suffit, et il se recopie sans qu'on
      //  le voie dans un collage.
      if (/^on/i.test(a.name)) e.removeAttribute(a.name);
      else if (
        (a.name === "href" || a.name === "src") &&
        /^\s*javascript:/i.test(a.value)
      ) e.removeAttribute(a.name);
    }
  }
  const sortie = doc.createDocumentFragment();
  for (const n of [...(lu.body.firstElementChild?.childNodes ?? [])]) {
    sortie.appendChild(doc.importNode(n, true));
  }
  return sortie;
}

function bouton(
  doc: Document,
  texte: string,
  clic: () => void,
  classe = "button2",
  nomme?: string,
): HTMLButtonElement {
  const b = el<HTMLButtonElement>(doc, "button", classe, texte);
  b.type = "button";
  if (nomme !== undefined) b.setAttribute("aria-label", nomme);
  b.addEventListener("click", clic);
  return b;
}

/*  CE QU'UNE ZONE VIDE AFFICHE, ET POURQUOI IL EN FAUT UN.

    Une zone vide fait zéro pixel de large. L'étiquette est juste à
    côté — « MÉTIER : » — donc la ligne se voit, mais la cible, non.
    Le CSS affiche cette phrase en gris dans la zone vide ; elle n'est
    pas dans le texte, et rien n'en part dans le message.

    LES DEUX MENUS N'Y SONT PAS. L'espèce et le talent ne se tapent
    pas, ils se choisissent : leur zone est remplacée par le menu. */
const INVITES: readonly { readonly clef: string; readonly invite: string }[] = [
  { clef: "nom", invite: "le nom de ton personnage" },
  { clef: "soustitre", invite: "une phrase, une réplique, un titre de chanson" },
  { clef: "tw", invite: "ce que ta fiche contient, et qu'on préfère annoncer" },
  { clef: "avatar", invite: "l'adresse de l'image à afficher à gauche" },
  ...IDENTITE.map((c) => ({ clef: c.clef, invite: c.exemple ?? c.etiquette.toLowerCase() })),
  { clef: "histoire", invite: "son histoire, aussi longue que tu veux" },
  { clef: "m-date", invite: "2015, ou « l'hiver d'après »" },
  { clef: "m-texte", invite: "ce qui s'est passé" },
  { clef: "s-surnom", invite: "son surnom, si tu lui en donnes un" },
  {
    clef: "s-rencontre",
    invite: "comment vous vous êtes rencontrés — c'est ce qui permet au staff de " +
      "fixer son niveau",
  },
  {
    clef: "ancienne",
    invite: "les Pokémon que ton personnage avait déjà, et qu'il récupérera aux paliers",
  },
  ...OMBRE.map((c) => ({ clef: c.clef, invite: "ta réponse" })),
  ...JOUEUR.map((c) => ({ clef: c.clef, invite: c.exemple ?? c.etiquette.toLowerCase() })),
];

/*  LES ZONES QUI MÉRITENT UNE BARRE DE BALISES.

    « Permettre aussi de modifier l'histoire et la description du
    compagnon d'une vie comme un bloc d'édition, pour mettre des
    balises si on en a envie. » — 23 novembre, et « oui » pour les
    moments de la chronologie.

    CE SONT LES TROIS ENDROITS OÙ L'ON ÉCRIT DU RÉCIT. Ailleurs — un
    métier, un pseudo, une date — une barre d'outils au-dessus de
    chaque champ ferait trente barres pour rien.

    ELLE N'AJOUTE RIEN QU'ON NE PUISSE TAPER. Le joueur qui connaît
    `<b>` l'écrit directement ; la barre existe pour celui qui ne le
    connaît pas, et elle lui montre ce qu'elle insère. */
const BALISEES = new Set(["histoire", "m-texte", "s-rencontre"]);

//  EN TOUTES LETTRES, PAS EN PICTOGRAMMES : un « G » gras et un « I »
//  penché sont une convention de traitement de texte, pas de forum, et
//  la barre sert justement à ceux qui ne la connaissent pas.
const BALISES: readonly {
  readonly mot: string;
  readonly ouvre: string;
  readonly ferme: string;
  /** Le bouton demande une adresse avant d'insérer. */
  readonly demande?: boolean;
}[] = [
  { mot: "Gras", ouvre: "<b>", ferme: "</b>" },
  { mot: "Italique", ouvre: "<i>", ferme: "</i>" },
  { mot: "Souligné", ouvre: "<u>", ferme: "</u>" },
  { mot: "Centré", ouvre: "<center>", ferme: "</center>" },
  { mot: "Lien", ouvre: `<a href="">`, ferme: "</a>", demande: true },
];

/** L'adresse telle qu'elle peut entrer dans un `href`.
 *
 *  ── DEUX CHOSES, ET PAS UNE DE PLUS ───────────────────────────────
 *
 *  LE GUILLEMET SE NEUTRALISE, sinon il ferme l'attribut et le reste
 *  de l'adresse devient du balisage. Ce n'est pas une protection
 *  contre quelqu'un — le joueur écrit dans sa propre fiche — c'est
 *  une adresse collée depuis une barre d'adresse qui, un jour, en
 *  contiendra un.
 *
 *  ET `javascript:` NE PART PAS. Forumactif filtre les messages, donc
 *  il ne passerait pas ; mais on ne l'écrit pas pour autant, parce
 *  qu'une fiche porte le nom de son auteur et qu'on ne lui met pas ça
 *  dans la bouche. Une adresse sans protocole en reçoit un : c'est ce
 *  qu'on colle neuf fois sur dix.
 *
 *  Rend la chaîne vide si l'adresse n'a pas de sens — l'appelant
 *  n'insère alors rien. */
export function adresseDeLien(brut: string): string {
  const propre = brut.trim();
  if (propre === "") return "";
  if (/^(javascript|data|vbscript):/i.test(propre)) return "";
  const avec = /^(https?:\/\/|\/|#|mailto:)/i.test(propre) ? propre : `https://${propre}`;
  return avec.replace(/"/g, "&quot;");
}

const DES_IDENTITES = new Set(IDENTITE.map((c) => c.clef));
const DES_JOUEURS = new Set(JOUEUR.map((c) => c.clef));
const DE_L_OMBRE = new Set(OMBRE.map((c) => c.clef));

const SANS_STARTER: Starter = {
  especeId: 0,
  espece: "",
  surnom: "",
  talent: "",
  rencontre: "",
};

/** Le texte d'une zone, sauts de ligne compris.
 *
 *  `innerText` ET PAS `textContent` : dans une zone modifiable, un
 *  retour à la ligne est un `<br>`, que `textContent` rend par rien du
 *  tout. Le pavé d'histoire y perdrait tous ses paragraphes — sans que
 *  personne le voie avant de relire le message publié. */
function lu(z: HTMLElement): string {
  return (z.innerText ?? z.textContent ?? "").replace(/ /g, " ");
}

/** Entoure ce qui est sélectionné dans `z` par deux balises.
 *
 *  ── POURQUOI `execCommand` ET PAS UN CALCUL D'INDICES ──────────────
 *
 *  La façon évidente serait de lire le texte, de repérer la sélection
 *  en nombre de caractères, et de recoller la chaîne. Elle est fausse
 *  ici : dans une zone modifiable, un retour à la ligne est un
 *  `<br>`, que `Range.toString()` ne compte pas. Dans un pavé de trois
 *  paragraphes, la balise atterrirait deux ou trois caractères avant
 *  l'endroit visé — d'autant plus loin qu'on écrit long, c'est-à-dire
 *  exactement là où cette barre sert.
 *
 *  `insertText` remplace la sélection sans qu'on ait à la mesurer, il
 *  garde l'annulation du navigateur (Ctrl-Z défait l'insertion) et il
 *  émet lui-même l'évènement `input` que le reste écoute. Il est
 *  déprécié et il n'a pas de remplaçant : `beforeinput` ne s'écrit
 *  pas, et l'API de saisie ne sait pas faire ça.
 *
 *  LE REPLI, S'IL VENAIT À DISPARAÎTRE : on ajoute les deux balises à
 *  la fin du texte. C'est grossier, mais rien n'est perdu et le joueur
 *  voit ce qui s'est passé — plutôt qu'un bouton qui ne fait rien. */
function entourer(doc: Document, z: HTMLElement, ouvre: string, ferme: string): void {
  z.focus();
  const sel = doc.getSelection();
  const dedans = sel !== null && sel.rangeCount > 0 && sel.anchorNode !== null &&
    z.contains(sel.anchorNode);

  if (sel !== null && dedans) {
    const choisi = sel.toString();
    if (doc.execCommand("insertText", false, ouvre + choisi + ferme)) {
      //  RIEN DE SÉLECTIONNÉ : le curseur s'est posé APRÈS la balise
      //  fermante, donc on le ramène entre les deux — sinon il
      //  faudrait cliquer pour écrire au bon endroit.
      if (choisi === "" && sel.rangeCount > 0) {
        const r = sel.getRangeAt(0);
        const ou = r.startOffset - ferme.length;
        if (ou >= 0) {
          r.setStart(r.startContainer, ou);
          r.collapse(true);
          sel.removeAllRanges();
          sel.addRange(r);
        }
      }
      return;
    }
  }

  z.textContent = lu(z) + ouvre + ferme;
  z.dispatchEvent(new InputEvent("input", { bubbles: true }));
}

/** Pose l'éditeur. Rend `false` si la page ne s'y prête pas. */
export function poserLaFiche(d: DependancesDeLaFiche): boolean {
  const { doc, brouillon } = d;
  const boite = doc.querySelector("#postingbox");
  if (boite === null || doc.getElementById(ID) !== null) return false;

  //  ── CE QU'IL Y A DÉJÀ DANS L'ÉDITEUR ───────────────────────────
  //
  //  UN MESSAGE QU'ON NE RECONNAÎT PAS, ON NE S'Y POSE PAS. C'était
  //  avant un bandeau et un bouton « remplacer le message par cette
  //  fiche » ; les boutons sont partis le 23 novembre, et les garder
  //  en silence aurait laissé une impasse : on remplissait trente
  //  champs, rien ne s'écrivait, et il n'y avait plus rien à cliquer
  //  pour demander.
  //
  //  Ne pas se poser du tout est plus honnête — le joueur garde son
  //  bloc d'édition et son texte, exactement comme sur n'importe
  //  quelle autre page du forum. Pour repartir d'une fiche neuve, il
  //  vide son message : c'est explicite, et c'est réversible tant
  //  qu'il n'a pas envoyé.
  const avant = brouillon.lire().trim();
  if (avant !== "" && !ressembleAUneFiche(avant)) return false;
  const lue: Fiche = avant === "" ? ficheVide() : lireUneFiche(avant);

  //  ── L'ÉTAT DE L'ÉCRAN N'EST PAS L'ÉTAT DU MESSAGE ──────────────
  //
  //  Deux blocs se remplissent avant d'être valides :
  //
  //   · LE STARTER. Tant qu'aucune espèce n'est choisie, ce n'en est
  //     pas un — la fiche publiée ne le porte pas, et `lireUneFiche`
  //     ne saurait pas le relire. Mais le surnom déjà tapé et le récit
  //     déjà écrit doivent rester à l'écran.
  //
  //   · L'ORGANISATION. La case peut se décocher, et les cinq
  //     réponses doivent survivre à l'aller-retour.
  //
  //  D'où deux états : `vue`, qui porte tout ce qui est à l'écran, et
  //  `pourLeMessage()`, qui n'en garde que ce qui est bon. Sans cette
  //  séparation, chaque frappe avant le choix de l'espèce serait
  //  perdue au redessin suivant.
  let vue: Fiche = {
    ...lue,
    starter: lue.starter ?? SANS_STARTER,
    ombre: lue.ombre ?? Object.fromEntries(OMBRE.map((c) => [c.clef, ""])),
  };
  let ombreActive = lue.ombre !== null;

  //  LES DEUX FORMES DE L'HISTOIRE SE GARDENT CÔTE À CÔTE : basculer
  //  de la chronologie au pavé et revenir ne doit rien effacer.
  let garde: { pave: string; moments: readonly Moment[] } = {
    pave: lue.histoire.mode === "pave" ? lue.histoire.texte : "",
    moments: lue.histoire.mode === "chronologie" ? lue.histoire.moments : [],
  };

  const pourLeMessage = (): Fiche => ({
    ...vue,
    starter: (vue.starter?.especeId ?? 0) > 0 ? vue.starter : null,
    ombre: ombreActive ? vue.ombre : null,
  });

  //  CE QU'ON A ÉCRIT EN DERNIER, pour reconnaître une retouche à la
  //  main. La chaîne vide veut dire « on n'a encore rien écrit », donc
  //  la première écriture passe toujours.
  let dernier = "";
  let arrete = false;

  const cadre = el(doc, "div", "wmf-form");
  cadre.id = ID;

  const dit = el(doc, "p", "wmf-form__dit");
  dit.setAttribute("role", "status");

  //  ── LA FICHE ELLE-MÊME, ET C'EST TOUT L'ÉDITEUR ─────────────────
  //
  //  « Je veux pas juste remplir les champs. Je veux visuellement
  //  remplir ma fiche de présentation. » — 23 novembre.
  //
  //  Ce bloc reçoit le rendu de `publier`, avec la vraie feuille de
  //  style, et chacune de ses valeurs y devient une zone où l'on
  //  écrit. Il n'y a donc PAS DEUX MISES EN PAGE : celle de l'écran
  //  est celle du message, et rien ne peut diverger.
  const laFiche = el(doc, "div", "wmf-form__fiche");

  //  ── LE BLOC D'ÉDITION S'EFFACE ──────────────────────────────────
  //
  //  « Ça remplace tout. » Le `#postingbox` de Forumactif disparaît —
  //  le titre du sujet est repris plus haut, et le bouton d'envoi vit
  //  dans un AUTRE panneau, donc il survit.
  const boiteEditeur = boite as HTMLElement;

  const ecrire = (): void => {
    if (arrete) return;
    const actuel = brouillon.lire();
    //  ── LA GARDE : ON NE RÉÉCRIT PAS PAR-DESSUS UNE RETOUCHE ─────
    //
    //  ON COMPARE LA FICHE RELUE, PAS LA CHAÎNE. Une comparaison au
    //  caractère près serait la plus simple à écrire et la plus
    //  fragile à l'usage : sceditor est un éditeur WYSIWYG, et rien ne
    //  promet qu'il rende EXACTEMENT le HTML qu'on lui a donné — un
    //  espace déplacé, un attribut réordonné, et la garde se
    //  déclencherait dès la seconde frappe, sur un message que
    //  personne n'a touché. L'éditeur s'arrêterait tout seul, et le
    //  joueur n'aurait aucun moyen de comprendre pourquoi.
    //
    //  La fiche relue, elle, ne bouge que si quelqu'un a changé une
    //  VALEUR. C'est exactement la question qu'on pose.
    //
    //  LA LIMITE, ÉCRITE PLUTÔT QUE TUE : du texte ajouté À CÔTÉ de la
    //  fiche, hors de ses balises, ne se voit pas dans la comparaison
    //  et sera emporté à la prochaine écriture. Reste à mesurer sur le
    //  vrai éditeur si c'est un cas réel.
    if (dernier !== "" && !memeFiche(lireUneFiche(actuel), lireUneFiche(dernier))) {
      //  ET ON REND LE BLOC D'ÉDITION, puisqu'il n'y a plus de bouton
      //  pour le demander. S'arrêter en gardant le message caché
      //  laisserait le joueur devant un formulaire qui n'écrit plus
      //  et un texte qu'il ne peut plus voir.
      arrete = true;
      cadre.dataset.wmArrete = "oui";
      boiteEditeur.hidden = false;
      dit.textContent = "Tu as modifié le message à la main : l'éditeur s'est " +
        "arrêté pour ne pas l'effacer, et il te le rend tel qu'il est, en dessous.";
      return;
    }
    const html = publier(pourLeMessage(), { sprite: spriteCourant() });
    brouillon.ecrire(html);
    dernier = html;
    dit.textContent = "";
  };

  //  ── LE TITRE DU SUJET VIENT ICI ────────────────────────────────
  //
  //  Le champ « Sujet » de Forumactif est DANS `#postingbox`, qu'on
  //  s'apprête à masquer. Sans ce relais, le joueur ne pourrait plus
  //  nommer son sujet du tout — et il s'en apercevrait au moment
  //  d'envoyer, pas avant.
  //
  //  IL SE REMPLIT TOUT SEUL DU NOM DU PERSONNAGE tant que personne
  //  n'y a touché : c'est ce que les fiches s'appellent, et une chose
  //  de moins à taper. Dès qu'on l'édite à la main, il cesse de
  //  suivre.
  const sujetNatif = doc.querySelector<HTMLInputElement>('input[name="subject"]');
  let titreSuitLeNom = (sujetNatif?.value ?? "").trim() === "";
  const titre = el<HTMLInputElement>(doc, "input", "inputbox medium");
  titre.id = "wmf-titre";
  titre.type = "text";
  titre.value = sujetNatif?.value ?? "";
  titre.addEventListener("input", () => {
    titreSuitLeNom = false;
    if (sujetNatif !== null) sujetNatif.value = titre.value;
  });
  const suivreLeTitre = (nom: string): void => {
    if (!titreSuitLeNom) return;
    titre.value = nom;
    if (sujetNatif !== null) sujetNatif.value = nom;
  };

  // ── les deux menus, construits une fois pour toutes ──────────────

  //  ILS VIVENT HORS DU REDESSIN. Le catalogue arrive par le réseau et
  //  le choix du joueur est dedans : les reconstruire à chaque
  //  bascule de forme perdrait l'un et l'autre. `equiper` ne fait que
  //  les remettre à leur place dans la fiche.
  let catalogue: readonly EspeceDeDepart[] = [];
  let base = "";
  const especeMenu = el<HTMLSelectElement>(doc, "select", "inputbox wmf-form__menu");
  especeMenu.id = "wmf-espece";
  especeMenu.setAttribute("aria-label", "L'espèce de son premier Pokémon");
  const talentMenu = el<HTMLSelectElement>(doc, "select", "inputbox wmf-form__menu");
  talentMenu.id = "wmf-talent";
  talentMenu.setAttribute("aria-label", "Son talent");

  const peindreTalents = (): void => {
    const e = catalogue.find((x) => x.id === Number(especeMenu.value));
    const choisi = talentMenu.value;
    talentMenu.textContent = "";
    if (e === undefined || e.talents.length === 0) {
      talentMenu.disabled = true;
      const rien = el<HTMLOptionElement>(doc, "option", "", "—");
      rien.value = "";
      talentMenu.appendChild(rien);
      return;
    }
    talentMenu.disabled = false;
    for (const t of e.talents) {
      const o = el<HTMLOptionElement>(doc, "option", "");
      o.value = t.nom;
      //  LE TALENT CACHÉ EST DIT, pas retiré : le staff tranchera.
      o.textContent = t.cache === true ? `${t.nom} (talent caché)` : t.nom;
      o.selected = t.nom === choisi;
      talentMenu.appendChild(o);
    }
  };

  // ── poser une valeur, d'où qu'elle vienne ────────────────────────

  const poserUnMoment = (clef: string, rang: number, v: string): void => {
    if (vue.histoire.mode !== "chronologie") return;
    const moments: Moment[] = [...vue.histoire.moments];
    //  LE MOMENT PEUT NE PAS EXISTER ENCORE : une chronologie vide
    //  affiche une ligne à remplir, et c'est la première frappe qui la
    //  fait exister.
    while (moments.length <= rang) moments.push({ date: "", texte: "" });
    moments[rang] = clef === "m-date"
      ? { ...moments[rang], date: v }
      : { ...moments[rang], texte: v };
    garde = { ...garde, moments };
    vue = { ...vue, histoire: { mode: "chronologie", moments } };
  };

  const poserLeStarter = (clef: string, v: string): void => {
    const s = vue.starter ?? SANS_STARTER;
    if (clef === "s-espece") {
      const id = Number(v);
      const bon = Number.isInteger(id) && id > 0;
      vue = {
        ...vue,
        starter: {
          ...s,
          especeId: bon ? id : 0,
          espece: bon ? catalogue.find((x) => x.id === id)?.nom ?? "" : "",
        },
      };
      return;
    }
    vue = {
      ...vue,
      starter: clef === "s-surnom"
        ? { ...s, surnom: v }
        : clef === "s-talent"
        ? { ...s, talent: v }
        : { ...s, rencontre: v },
    };
  };

  const poser = (clef: string, rang: number, v: string): void => {
    if (clef === "nom") {
      vue = { ...vue, nom: v };
      suivreLeTitre(v);
      return;
    }
    if (clef === "soustitre") {
      vue = { ...vue, sousTitre: v };
      return;
    }
    if (clef === "tw") {
      vue = { ...vue, tw: v };
      return;
    }
    if (clef === "avatar") {
      vue = { ...vue, avatar: v };
      majImage(".wmf__avatar", v);
      return;
    }
    //  LA TRAINER CARD EST UNE IMAGE, ELLE AUSSI, et elle suit le même
    //  chemin que l'avatar : l'adresse se tape, l'image se montre.
    if (clef === "j-tcard") {
      vue = { ...vue, joueur: { ...vue.joueur, "j-tcard": v } };
      majImage(".wmf__tcard", v);
      return;
    }
    if (clef === "ancienne") {
      vue = { ...vue, ancienneEquipe: v };
      return;
    }
    if (clef === "histoire") {
      garde = { ...garde, pave: v };
      vue = { ...vue, histoire: { mode: "pave", texte: v } };
      return;
    }
    if (clef === "m-date" || clef === "m-texte") return poserUnMoment(clef, rang, v);
    if (clef.startsWith("s-")) return poserLeStarter(clef, v);
    if (DES_IDENTITES.has(clef)) {
      vue = { ...vue, identite: { ...vue.identite, [clef]: v } };
      return;
    }
    if (DES_JOUEURS.has(clef)) {
      vue = { ...vue, joueur: { ...vue.joueur, [clef]: v } };
      return;
    }
    if (DE_L_OMBRE.has(clef)) {
      vue = { ...vue, ombre: { ...(vue.ombre ?? {}), [clef]: v } };
    }
  };

  //  ── UNE IMAGE SUIT SON ADRESSE SANS TOUT REDESSINER ────────────
  //
  //  Deux images se collent par leur adresse : l'avatar du personnage
  //  et la trainer card du joueur. Changer l'adresse change une seule
  //  chose, le `src` ; redessiner la fiche entière pour ça ferait
  //  perdre le curseur à chaque caractère tapé dans l'adresse.
  const majImage = (ou: string, adresse: string, classe = ""): void => {
    const colonne = laFiche.querySelector<HTMLElement>(ou);
    if (colonne === null) return;
    const img = colonne.querySelector("img");
    const propre = adresse.trim();
    if (propre === "") {
      img?.remove();
      return;
    }
    if (img !== null) {
      img.src = propre;
      return;
    }
    const neuve = doc.createElement("img");
    //  LA CLASSE SE POSE ICI AUSSI, et c'est le piège : `publier`
    //  l'écrit, donc on la croit acquise. Mais la première image d'une
    //  fiche neuve n'existe pas encore quand la fiche se dessine — on
    //  n'a pas d'espèce — et c'est CELLE-CI qui la remplace. Sans la
    //  classe, le sprite sortait à sa taille d'origine, un pixel.
    if (classe !== "") neuve.className = classe;
    neuve.src = propre;
    neuve.alt = "";
    colonne.insertBefore(neuve, colonne.firstChild);
  };

  /*  L'ADRESSE VIENT DU CATALOGUE, pas d'un calcul. Elle y est écrite
      par `outils/starters.py`, qui la recopie de la couverture : le
      navigateur n'a donc à savoir ni où vit le dépôt des sprites, ni
      quelle source a cette espèce-là. */
  const spriteCourant = (): string => {
    const id = vue.starter?.especeId ?? 0;
    if (id <= 0 || base === "") return "";
    const chemin = catalogue.find((e) => e.id === id)?.sprite ?? "";
    return chemin === "" ? "" : `${base}/${chemin}`;
  };

  const majLeSprite = (): void => {
    majImage(".wmf__pokemon", spriteCourant(), "wmf__sprite");
  };

  // ── rendre la fiche, puis la rendre modifiable ───────────────────

  //  ── LA BARRE DE BALISES, AU-DESSUS DE SA ZONE ──────────────────
  //
  //  `mousedown` EST ANNULÉ, ET C'EST TOUTE L'ASTUCE. Sans ça, appuyer
  //  sur le bouton sort le curseur de la zone et efface la sélection
  //  avant même que le clic arrive : on mettrait les balises autour de
  //  rien, à un endroit quelconque.
  const laBarre = (z: HTMLElement): HTMLElement => {
    const barre = el(doc, "div", "wmf-form__balises");
    barre.setAttribute("role", "group");
    barre.setAttribute("aria-label", "Mettre en forme le texte");
    for (const b of BALISES) {
      const bouton = el<HTMLButtonElement>(doc, "button", "wmf-form__balise", b.mot);
      bouton.type = "button";
      bouton.title = `${b.ouvre}…${b.ferme}`;
      bouton.addEventListener("mousedown", (e) => e.preventDefault());
      bouton.addEventListener(
        "click",
        b.demande === true
          ? () => ouvrirLeLien(z, barre)
          : () => entourer(doc, z, b.ouvre, b.ferme),
      );
      barre.appendChild(bouton);
    }
    return barre;
  };

  //  ── LE LIEN DEMANDE SON ADRESSE ────────────────────────────────
  //
  //  Insérer `<a href="">` et laisser le joueur viser l'intérieur des
  //  guillemets, c'est lui demander de comprendre ce qu'est un
  //  attribut. Le bouton ouvre donc un champ, et pose le lien complet.
  //
  //  LA SÉLECTION EST GARDÉE AVANT D'OUVRIR LE CHAMP. Dès qu'on y
  //  tape, le curseur a quitté la zone et la sélection n'existe plus :
  //  sans cette copie, le lien se poserait autour de rien.
  const ouvrirLeLien = (z: HTMLElement, barre: HTMLElement): void => {
    const existant = barre.nextElementSibling;
    if (existant !== null && existant.classList.contains("wmf-form__lien")) {
      existant.remove();
      return;
    }
    const sel = doc.getSelection();
    const gardee = sel !== null && sel.rangeCount > 0 && sel.anchorNode !== null &&
        z.contains(sel.anchorNode)
      ? sel.getRangeAt(0).cloneRange()
      : null;

    const boite = el(doc, "div", "wmf-form__lien");
    const champ = el<HTMLInputElement>(doc, "input", "inputbox");
    champ.type = "url";
    champ.placeholder = "https://…";
    champ.setAttribute("aria-label", "L'adresse du lien");

    const fermer = (): void => {
      boite.remove();
      z.focus();
    };
    const poser = (): void => {
      const ou = adresseDeLien(champ.value);
      if (ou === "") {
        champ.focus();
        return;
      }
      boite.remove();
      z.focus();
      //  ON REMET LA SÉLECTION D'AVANT : c'est elle qui décide quel
      //  texte devient cliquable.
      if (gardee !== null && sel !== null) {
        sel.removeAllRanges();
        sel.addRange(gardee);
      }
      entourer(doc, z, `<a href="${ou}">`, "</a>");
    };

    champ.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        poser();
      } else if (e.key === "Escape") {
        e.preventDefault();
        fermer();
      }
    });
    boite.append(
      champ,
      bouton(doc, "Poser le lien", poser, "button2 wmf-form__poser"),
      bouton(doc, "Annuler", fermer, "button2 wmf-form__annuler"),
    );
    barre.after(boite);
    champ.focus();
  };

  const brancher = (z: HTMLElement, clef: string, rang: number, invite: string): void => {
    z.dataset.wmfZone = clef;
    z.dataset.wmfVide = invite;
    //  LES CINQ QUESTIONS DE L'ORGANISATION SE LISENT SANS SE TAPER
    //  tant que la case n'est pas cochée. Les laisser modifiables
    //  donnerait un texte qui ne part pas dans le message, sans que
    //  rien ne le dise.
    const modifiable = !(DE_L_OMBRE.has(clef) && !ombreActive);
    z.contentEditable = modifiable ? "plaintext-only" : "false";
    if (!modifiable) return;
    z.setAttribute("role", "textbox");
    z.setAttribute("aria-label", invite);
    if (BALISEES.has(clef)) z.before(laBarre(z));
    z.addEventListener("input", () => {
      //  UNE ZONE VIDÉE GARDE UN `<br>` dans Chrome, et `:empty` ne la
      //  reconnaît plus : l'invite disparaîtrait pour de bon dès la
      //  première frappe effacée.
      if (lu(z) === "") z.replaceChildren();
      poser(clef, rang, lu(z));
      ecrire();
    });
  };

  const equiperLHistoire = (): void => {
    const bloc = laFiche.querySelector<HTMLElement>(".wmf__histoire");
    if (bloc === null) return;
    const barre = el(doc, "div", "wmf-form__barre");
    //  LES DEUX MOTS DISENT LA FAÇON DE RACONTER, pas le format du
    //  texte. « Un grand pavé » nommait l'objet technique ; « moment
    //  par moment » reprend en plus le mot du bouton qui suit,
    //  « Ajouter un moment ».
    const formes = [
      ["pave", "D'un seul tenant"],
      ["chronologie", "Moment par moment"],
    ] as const;
    for (const forme of formes) {
      const [mode, mot] = forme;
      const b = bouton(doc, mot, () => {
        if (vue.histoire.mode === mode) return;
        vue = {
          ...vue,
          histoire: mode === "pave"
            ? { mode: "pave", texte: garde.pave }
            : { mode: "chronologie", moments: garde.moments },
        };
        peindre();
        ecrire();
      }, "button2 wmf-form__forme");
      b.setAttribute("aria-pressed", String(vue.histoire.mode === mode));
      barre.appendChild(b);
    }
    //  ── ON DIT CE QU'ON PEUT Y METTRE ───────────────────────────
    //
    //  « Préciser aussi dans "raconte-nous ton histoire" que la
    //  personne peut rajouter des balises, des images, ce qu'elle
    //  veut. » — 23 novembre.
    //
    //  La barre de balises ne montre que cinq boutons, et un joueur
    //  qui n'a que ça sous les yeux croit que la liste s'arrête là.
    //  Elle ne s'arrête pas : le message part en HTML, et tout ce que
    //  Forumactif accepte dans un message passe.
    const dit = el(
      doc,
      "p",
      "wmf-form__note",
      "Écris comme tu veux : les cinq boutons ne sont qu'un raccourci. " +
        "Tu peux taper tes propres balises, coller une image, une bannière, " +
        "un tableau — tout ce qui marche dans un message marche ici.",
    );
    bloc.querySelector(".wmf__bandeau")?.after(barre);
    barre.before(dit);

    const chrono = bloc.querySelector<HTMLElement>(".wmf__chrono");
    if (chrono === null) return;
    chrono.querySelectorAll<HTMLElement>(".wmf__moment").forEach((m, i) => {
      //  LA CROIX EST SUR CHAQUE MOMENT, comme sur chaque carte du
      //  carnet : un seul endroit pour retirer, et il est là où on
      //  regarde.
      m.appendChild(bouton(
        doc,
        "×",
        () => {
          const moments = [...garde.moments];
          moments.splice(i, 1);
          garde = { ...garde, moments };
          vue = { ...vue, histoire: { mode: "chronologie", moments } };
          peindre();
          ecrire();
        },
        "wmf-form__croix",
        `Retirer le moment ${i + 1}`,
      ));
    });
    chrono.appendChild(bouton(doc, "Ajouter un moment", () => {
      const moments = [...garde.moments, { date: "", texte: "" }];
      garde = { ...garde, moments };
      vue = { ...vue, histoire: { mode: "chronologie", moments } };
      peindre();
      ecrire();
      laFiche
        .querySelector<HTMLElement>(".wmf__moment:last-of-type [data-wmf-zone]")
        ?.focus();
    }, "button2 wmf-form__plus"));
  };

  const equiperLOmbre = (): void => {
    const bloc = laFiche.querySelector<HTMLElement>(".wmf__ombre");
    if (bloc === null) return;
    bloc.dataset.wmActive = ombreActive ? "oui" : "non";
    const label = el<HTMLLabelElement>(doc, "label", "wmf-form__bascule");
    const case_ = el<HTMLInputElement>(doc, "input", "");
    case_.type = "checkbox";
    case_.id = "wmf-ombre";
    case_.checked = ombreActive;
    case_.addEventListener("change", () => {
      ombreActive = case_.checked;
      peindre();
      ecrire();
    });
    label.append(case_, doc.createTextNode(" Mon personnage rejoint le Groupe Ombre"));
    bloc.querySelector(".wmf__bandeau")?.after(label);
  };

  const equiperLeStarter = (): void => {
    const bloc = laFiche.querySelector<HTMLElement>(".wmf__pokemon");
    if (bloc === null) return;
    bloc.querySelector("wmf-s-espece")?.replaceWith(especeMenu);
    bloc.querySelector("wmf-s-talent")?.replaceWith(talentMenu);
    //  LE NIVEAU N'EST PAS DEMANDÉ, ET ON LE DIT. Sans cette phrase, la
    //  première question du premier joueur sera « où je mets son
    //  niveau ? ».
    laFiche.querySelector(".wmf__starter")?.appendChild(el(
      doc,
      "p",
      "wmf-form__note",
      "Le niveau n'est pas à choisir : le staff l'attribue à la validation, " +
        "d'après l'âge, le métier et le passé de ton personnage.",
    ));
  };

  const equiper = (): void => {
    for (const { clef, invite } of INVITES) {
      laFiche
        .querySelectorAll<HTMLElement>(`wmf-${clef}`)
        .forEach((z, rang) => brancher(z, clef, rang, invite));
    }
    equiperLHistoire();
    equiperLeStarter();
    equiperLOmbre();
  };

  //  ── LE REDESSIN NE SE FAIT QUE SUR UN CHANGEMENT DE STRUCTURE ───
  //
  //  Jamais à la frappe : refaire le DOM sous le curseur le ferait
  //  sauter au début de la zone à chaque caractère. Trois boutons
  //  seulement redessinent — la forme de l'histoire, un moment
  //  ajouté ou retiré, la case de l'organisation — et un clic a déjà
  //  déplacé le curseur.
  const peindre = (): void => {
    laFiche.textContent = "";
    laFiche.appendChild(
      pourLApercu(doc, publier(vue, { pourEcrire: true, sprite: spriteCourant() })),
    );
    equiper();
  };

  // ── l'assemblage ─────────────────────────────────────────────────

  const tete = el(doc, "div", "panel wmf-form__tete");
  const dedansTete = el(doc, "div", "inner");
  dedansTete.appendChild(el(doc, "div", "h3", "Ta fiche de présentation"));
  const dlTitre = el(doc, "dl", "wmf-form__titre");
  const dtTitre = el(doc, "dt", "");
  const labelTitre = el<HTMLLabelElement>(doc, "label", "", "TITRE DU SUJET");
  labelTitre.htmlFor = titre.id;
  dtTitre.appendChild(labelTitre);
  dtTitre.appendChild(
    el(doc, "span", "wmf-form__aide", "ce qui s'affichera dans la liste des sujets"),
  );
  const ddTitre = el(doc, "dd", "");
  ddTitre.appendChild(titre);
  dlTitre.append(dtTitre, ddTitre);
  dedansTete.appendChild(dlTitre);
  dedansTete.appendChild(dit);
  tete.appendChild(dedansTete);

  cadre.append(tete, laFiche);
  boite.parentNode?.insertBefore(cadre, boite);

  peindre();
  majLeSprite();
  majImage(".wmf__avatar", vue.avatar);
  majImage(".wmf__tcard", vue.joueur["j-tcard"] ?? "");

  //  ── ET LE BLOC D'ÉDITION S'EFFACE ───────────────────────────────
  //
  //  ON NE L'ATTEINT QUE SUR UNE FICHE À NOUS : les autres messages
  //  sont partis plus haut, avant que quoi que ce soit ne se pose.
  boiteEditeur.hidden = true;

  //  ── LE DERNIER MOT AVANT L'ENVOI ────────────────────────────────
  //
  //  Une frappe peut arriver après la dernière écriture — on écrit à
  //  chaque `input`, mais rien n'empêche le navigateur de poster entre
  //  les deux. On réécrit donc au moment de l'envoi, où c'est la
  //  dernière chose qui compte.
  boite.closest("form")?.addEventListener("submit", () => {
    ecrire();
  });

  //  ── LE CATALOGUE ARRIVE APRÈS, ET LE RESTE N'ATTEND PAS ─────────
  //
  //  436 espèces. Les attendre pour poser l'éditeur ferait une page
  //  vide le temps de la requête, et une lecture qui échoue
  //  emporterait les trente autres zones avec elle.
  const attente = el<HTMLOptionElement>(doc, "option", "", "Chargement…");
  attente.value = "";
  especeMenu.appendChild(attente);
  especeMenu.disabled = true;
  peindreTalents();
  especeMenu.addEventListener("change", () => {
    poserLeStarter("s-espece", especeMenu.value);
    peindreTalents();
    poserLeStarter("s-talent", talentMenu.value);
    //  LE SPRITE SUIT LE MENU SANS REDESSIN : changer d'espèce ne
    //  change qu'une image, et refaire la fiche entière ferait sauter
    //  le curseur de qui écrivait juste à côté.
    majLeSprite();
    ecrire();
  });
  talentMenu.addEventListener("change", () => {
    poserLeStarter("s-talent", talentMenu.value);
    ecrire();
  });

  void d.starters().then((lu) => {
    catalogue = lu.especes;
    base = lu.base;
    const liste = lu.especes;
    especeMenu.textContent = "";
    const aucun = el<HTMLOptionElement>(doc, "option", "", "— aucune pour l'instant —");
    aucun.value = "";
    especeMenu.appendChild(aucun);
    for (const e of liste) {
      const o = el<HTMLOptionElement>(doc, "option", "", e.nom);
      o.value = String(e.id);
      o.selected = e.id === vue.starter?.especeId;
      especeMenu.appendChild(o);
    }
    especeMenu.disabled = false;
    peindreTalents();
    //  ON REPOSE LE TALENT RELU : le menu vient d'être rempli, et la
    //  valeur d'une fiche rouverte n'y était pas une seconde plus tôt.
    if ((vue.starter?.especeId ?? 0) > 0) talentMenu.value = vue.starter?.talent ?? "";
  }).catch(() => {
    especeMenu.textContent = "";
    const raté = el<HTMLOptionElement>(doc, "option", "", "La liste n'a pas pu être lue");
    raté.value = "";
    especeMenu.appendChild(raté);
  });

  return true;
}

/** La forme attendue d'une entrée de `data/starters.json`, vérifiée.
 *
 *  Le fichier est dérivé et contrôlé par le garde-fou 40, mais il
 *  arrive par le réseau : une réponse tronquée ou une page d'erreur
 *  déguisée ne doit pas peupler le menu de `undefined`. */
export function lireLesStarters(brut: unknown): CatalogueDesStarters {
  const o = brut as { especes?: unknown; spriteBase?: unknown };
  const base = typeof o?.spriteBase === "string" && /^https?:\/\//.test(o.spriteBase)
    ? o.spriteBase.replace(/\/+$/, "")
    : "";
  if (!Array.isArray(o?.especes)) return { base, especes: [] };
  const sortie: EspeceDeDepart[] = [];
  for (const e of o.especes) {
    if (typeof e !== "object" || e === null) continue;
    const x = e as Record<string, unknown>;
    const id = typeof x.id === "number" && Number.isInteger(x.id) && x.id > 0 ? x.id : null;
    const nom = typeof x.nom === "string" && x.nom !== "" ? x.nom : null;
    if (id === null || nom === null) continue;
    //  UN CHEMIN QUI N'EN EST PAS UN NE DEVIENT PAS UN `src`. Ni
    //  absolu, ni remontant : il se recolle derrière NOTRE base, et
    //  `..` l'en ferait sortir.
    const sprite = typeof x.sprite === "string" && /^[\w./-]+\.(?:gif|png)$/.test(x.sprite) &&
        !x.sprite.includes("..") && !x.sprite.startsWith("/")
      ? x.sprite
      : null;
    sortie.push({
      id,
      nom,
      ...(sprite === null ? {} : { sprite }),
      types: Array.isArray(x.types) ? x.types.filter((t) => typeof t === "string") : [],
      talents: Array.isArray(x.talents)
        ? x.talents.flatMap((t) => {
          const n = (t as Record<string, unknown>)?.nom;
          if (typeof n !== "string" || n === "") return [];
          return [{
            nom: n,
            ...((t as Record<string, unknown>).cache === true ? { cache: true } : {}),
          }];
        })
        : [],
    });
  }
  return { base, especes: sortie };
}
