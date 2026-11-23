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
//     fiche → on la relit dans les champs. Message qui n'en est pas
//     une → **on ne touche à rien**, et un bandeau propose de
//     reprendre, ce qui demande un clic explicite.
//
//   · AVANT CHAQUE ÉCRITURE. On relit ce qu'il y a dans l'éditeur. Si
//     ce n'est plus exactement ce qu'on y avait mis, le joueur a écrit
//     à la main entre-temps : on s'arrête et on le dit, plutôt que
//     d'écraser.
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
};

export type DependancesDeLaFiche = {
  readonly doc: Document;
  readonly brouillon: Brouillon;
  /** Les espèces de départ. Appelée une fois, à l'ouverture. Une
   *  lecture qui échoue ne doit pas empêcher le reste du formulaire :
   *  le bloc du starter se dit indisponible, les autres marchent. */
  readonly starters: () => Promise<readonly EspeceDeDepart[]>;
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

/** Pose l'éditeur. Rend `false` si la page ne s'y prête pas. */
export function poserLaFiche(d: DependancesDeLaFiche): boolean {
  const { doc, brouillon } = d;
  const boite = doc.querySelector("#postingbox");
  if (boite === null || doc.getElementById(ID) !== null) return false;

  //  ── CE QU'IL Y A DÉJÀ DANS L'ÉDITEUR ───────────────────────────
  const avant = brouillon.lire().trim();
  const connu = avant === "" || ressembleAUneFiche(avant);
  const lue: Fiche = connu && avant !== "" ? lireUneFiche(avant) : ficheVide();

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
  let arrete = !connu;

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

  //  ── LE BLOC D'ÉDITION S'EFFACE, MAIS IL REVIENT SUR DEMANDE ─────
  //
  //  « Ça remplace tout. » Le `#postingbox` de Forumactif disparaît —
  //  le titre du sujet est repris plus haut, et le bouton d'envoi vit
  //  dans un AUTRE panneau, donc il survit.
  //
  //  LA PORTE DE SORTIE N'EST PAS UNE PRÉCAUTION DE PRINCIPE. Le jour
  //  où un champ manque, où quelqu'un veut coller un bout de code à
  //  lui, ou simplement relire le message tel qu'il part, un éditeur
  //  qui a mangé le bloc d'édition et ne le rend pas est une impasse.
  //  Elle rend le message visible ET rend la main : l'éditeur cesse
  //  d'écrire, plutôt que d'écraser par-dessus.
  const boiteEditeur = boite as HTMLElement;
  const voirLeTexte = bouton(doc, "Écrire le message à la main", () => {
    boiteEditeur.hidden = false;
    arrete = true;
    cadre.dataset.wmArrete = "oui";
    voirLeTexte.hidden = true;
    reprendre.hidden = false;
    dit.textContent = "Le message est en dessous, tel qu'il partira. " +
      "L'éditeur a cessé d'écrire pour ne pas effacer tes retouches.";
  }, "button2 wmf-form__brut");

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
      arrete = true;
      cadre.dataset.wmArrete = "oui";
      dit.textContent = "Tu as modifié le message à la main : l'éditeur s'est " +
        "arrêté pour ne pas l'effacer. Reprends-le quand tu veux.";
      reprendre.hidden = false;
      return;
    }
    const html = publier(pourLeMessage());
    brouillon.ecrire(html);
    dernier = html;
    dit.textContent = "";
  };

  //  ── REPRENDRE LA MAIN, ET SEULEMENT SUR UN CLIC ────────────────
  //
  //  Le seul chemin par lequel l'éditeur écrase un message qu'il n'a
  //  pas écrit. Il est explicite, il est nommé, et il ne se déclenche
  //  jamais tout seul.
  const reprendre = bouton(doc, "Remplacer le message par cette fiche", () => {
    arrete = false;
    dernier = "";
    delete cadre.dataset.wmArrete;
    reprendre.hidden = true;
    //  L'ÉDITEUR REPREND LA PLACE qu'il avait laissée : il écrit de
    //  nouveau, donc laisser le bloc visible montrerait un texte qui
    //  change tout seul sous les doigts.
    boiteEditeur.hidden = true;
    voirLeTexte.hidden = false;
    ecrire();
  }, "button2 wmf-form__reprendre");
  reprendre.hidden = connu;

  if (!connu) {
    dit.textContent = "Ce message n'a pas été écrit avec cet éditeur. " +
      "Le remplir ne le touchera pas tant que tu ne l'auras pas demandé.";
  }

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
    if (clef === "tw") {
      vue = { ...vue, tw: v };
      return;
    }
    if (clef === "avatar") {
      vue = { ...vue, avatar: v };
      majImage(v);
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

  //  ── L'IMAGE SUIT L'ADRESSE SANS TOUT REDESSINER ────────────────
  //
  //  Changer l'adresse de l'avatar change une seule chose : le `src`
  //  de l'image. Redessiner la fiche entière pour ça ferait perdre le
  //  curseur à chaque caractère tapé dans l'adresse.
  const majImage = (adresse: string): void => {
    const colonne = laFiche.querySelector<HTMLElement>(".wmf__avatar");
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
    neuve.src = propre;
    neuve.alt = "";
    colonne.insertBefore(neuve, colonne.firstChild);
  };

  // ── rendre la fiche, puis la rendre modifiable ───────────────────

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
    for (
      const forme of [["pave", "Un grand pavé"], ["chronologie", "Une chronologie"]] as const
    ) {
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
    bloc.querySelector(".wmf__bandeau")?.after(barre);

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
    laFiche.appendChild(pourLApercu(doc, publier(vue, { pourEcrire: true })));
    equiper();
  };

  // ── l'assemblage ─────────────────────────────────────────────────

  const tete = el(doc, "div", "panel wmf-form__tete");
  const dedansTete = el(doc, "div", "inner");
  dedansTete.appendChild(el(doc, "div", "h3", "Ta fiche de présentation"));
  dedansTete.appendChild(
    el(
      doc,
      "p",
      "wmf-form__mot",
      "Écris directement dans la fiche : elle devient le message, " +
        "et tu l'envoies quand tu es prête. Rien n'est posté sans toi.",
    ),
  );
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
  dedansTete.append(dit, reprendre, voirLeTexte);
  tete.appendChild(dedansTete);

  cadre.append(tete, laFiche);
  boite.parentNode?.insertBefore(cadre, boite);

  peindre();
  majImage(vue.avatar);

  //  ── ET LE BLOC D'ÉDITION S'EFFACE ───────────────────────────────
  //
  //  SEULEMENT SI LA FICHE EST À NOUS. Sur un message qu'on ne
  //  reconnaît pas, le masquer priverait le joueur du seul endroit où
  //  son texte existe encore — et l'éditeur, lui, n'écrit pas. Il
  //  réapparaîtra quand il aura cliqué sur « remplacer ».
  boiteEditeur.hidden = connu;
  voirLeTexte.hidden = !connu;

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
    ecrire();
  });
  talentMenu.addEventListener("change", () => {
    poserLeStarter("s-talent", talentMenu.value);
    ecrire();
  });

  void d.starters().then((liste) => {
    catalogue = liste;
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
export function lireLesStarters(brut: unknown): readonly EspeceDeDepart[] {
  const o = brut as { especes?: unknown };
  if (!Array.isArray(o?.especes)) return [];
  const sortie: EspeceDeDepart[] = [];
  for (const e of o.especes) {
    if (typeof e !== "object" || e === null) continue;
    const x = e as Record<string, unknown>;
    const id = typeof x.id === "number" && Number.isInteger(x.id) && x.id > 0 ? x.id : null;
    const nom = typeof x.nom === "string" && x.nom !== "" ? x.nom : null;
    if (id === null || nom === null) continue;
    sortie.push({
      id,
      nom,
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
  return sortie;
}
