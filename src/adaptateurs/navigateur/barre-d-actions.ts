/// <reference lib="dom" />
/// <reference lib="dom.iterable" />
// ════════════════════════════════════════════════════════════════════
//  src/adaptateurs/navigateur/barre-d-actions.ts
//
//  COUVERT PAR : outils/barre.mjs — les quatre choix, la place dans le
//  formulaire, l'écriture à l'envoi, l'écart visible entre choisi et pas
//  choisi, et le fait qu'aucun contrôle ne soit muet.
//  (Garde-fou n° 22 : un module d'interface sans test unitaire doit dire
//   quel harnais le monte, et ce harnais doit tourner dans le CI.)
//
//  Le bloc d'actions de la réponse. Dessiné dans Figma, page Composants,
//  « Barre d'actions ».
//
//  QUE DU DOM. Ce qu'un clic fait au texte est décidé dans
//  `src/navigateur/redaction.ts`, où c'est testé sans navigateur.
//
//  ── QUATRE CHOIX QUI S'EXCLUENT, DEPUIS LE 17 NOVEMBRE ──────────────
//
//  Callista, sur `t996` : « j'aimerai que dans la réponse rapide on ait
//  la possibilité de "ne rien faire, faire apparaître, fouiller ou
//  cloturer". On doit bien voir que "ne rien faire" est sélectionné.
//  Clôturer doit apparaître de manière un peu secondaire. Aussi, les
//  boutons, on doit bien faire la différence qu'on l'a sélectionné ou
//  non. Aujourd'hui, c'est pas le cas. En dessous, prévisualiser ou
//  envoyer. »
//
//  Trois choses changent, et chacune se mesure :
//
//  1. « NE RIEN FAIRE » EST UN BOUTON. C'était déjà un état — celui de
//     départ —, mais il n'avait pas de contrôle : on le reconnaissait à
//     ce qu'aucun bouton n'était enfoncé. Un état qu'on lit à l'absence
//     des autres ne se voit pas ; maintenant il est coché.
//
//  2. LES QUATRE S'EXCLUENT. La clôture était un bouton à part qui
//     pouvait coexister avec une action — « une dernière fouille et on
//     clôture ». Elle est demandée dans le même groupe, donc ce
//     cumul-là n'est plus possible. **C'est une perte, et elle est
//     volontaire** : c'est le « ou » de sa phrase. Si elle revient
//     dessus, la clôture redevient une bascule à côté du groupe — tout
//     ce qu'il faut pour ça est déjà écrit en deux fonctions dans
//     `redaction.ts` (`avecLaCloture`, `sansLaCloture`).
//
//  3. LA BARRE SE POSE AVANT LA RANGÉE D'ENVOI, dans le formulaire, et
//     plus après lui. « En dessous, prévisualiser ou envoyer. »
//
//  ── L'ÉCART ENTRE CHOISI ET PAS CHOISI ──────────────────────────────
//
//  « Aujourd'hui, c'est pas le cas » : l'état posé ajoutait une couleur
//  de bord et une ombre intérieure d'un pixel sur un bouton qui avait
//  déjà un bord. Deux états séparés par un pixel ne sont pas deux états.
//  Le bouton choisi est maintenant **rempli**, et il porte une pastille
//  pleine que le bouton libre porte vide — la couleur seule ne suffit
//  pas à qui la distingue mal. `outils/barre.mjs` mesure l'écart entre
//  les deux fonds et exige un rapport d'au moins 3.
//
//  ── LE CLIC N'ÉCRIT TOUJOURS RIEN DANS LE MESSAGE ───────────────────
//
//  Callista, le 15 octobre : « je n'aime pas le fait que ça ajoute une
//  balise dans mon texte, je veux que ce soit automatique quand je
//  clique. » Le bloc est donc écrit au dernier moment, à l'envoi, dans
//  le champ du formulaire. Le joueur ne voit jamais notre syntaxe ; il
//  voit un bouton coché et une phrase qui dit ce qui va partir.
//
//  ET LE BLOC EST ENCORE LU S'IL EST LÀ. Un message en cours d'édition
//  peut en porter un. La barre s'ouvre donc sur l'état du texte, et à
//  l'envoi elle réécrit un bloc unique et canonique (`avecAction`
//  remplace, il n'empile pas).
//
//  LA CLÔTURE, ELLE, RESTE VISIBLE DANS LE TEXTE : elle écrit
//  `[cloture]`, le mot que les joueurs tapent déjà aujourd'hui. Ce n'est
//  pas notre syntaxe, c'est la leur ; la cacher serait leur retirer
//  quelque chose qu'ils savent lire et corriger. La barre suit donc le
//  texte : effacer le mot à la main décoche le bouton.
//
//  ── LE MENU « OÙ » EST PARTI, LE 15 OCTOBRE ─────────────────────────
//
//  Il y avait une rangée de plus : une étiquette « Où », un menu des
//  quinze lieux de la zone. Callista : « on est déjà dans une zone
//  sauvage, avec un palier, donc y'a pas d'autres zones à rajouter. »
//
//  ET C'ÉTAIT AUSSI UN PIÈGE : changer de lieu dans le menu ne touchait
//  pas au message. Un contrôle qui a l'air d'agir et qui n'agit pas est
//  un défaut, quelle que soit la bonne raison derrière. **`outils/barre.mjs`
//  exige que CHAQUE contrôle que la barre pose change quelque chose** :
//  c'est la règle générale dont ce défaut était un cas.
//
//  Le lieu n'a pas disparu : les tables de rencontre vivent par lieu, et
//  c'est le SERVEUR qui en tire un, avec la graine du message — voir
//  `tirerUnLieu` dans `domaine/rencontre.ts`.
//
//  **La barre ne se pose que dans les dix-sept zones sauvages**, règle 4
//  de la planche 45. Ailleurs, la relève ne lit rien. C'est
//  `js/wild-mystery.ts` qui tranche, avant de construire quoi que ce
//  soit.
// ════════════════════════════════════════════════════════════════════

import {
  avecAction,
  avecLaCloture,
  clotureDemandee,
  sansAction,
  sansLaCloture,
} from "../../navigateur/redaction.ts";
import { type Action, actionDe } from "../../domaine/action.ts";
import type { Brouillon } from "./editeur.ts";

/** Les quatre choix. `rien` en est un à part entière — c'est celui de
 *  départ, et il a son bouton.
 *
 *  LE VOCABULAIRE DU DOMAINE EST PLUS LARGE QUE CELUI-LÀ depuis le
 *  18 novembre : `attaquer`, `ball`, `objet`, `changer`, `fuir` existent
 *  dans `domaine/action.ts`, parce que le serveur apprend à les honorer.
 *  La barre ne les offre PAS encore, et c'est la règle écrite dans
 *  `action.ts` : une action que le serveur ne sait pas honorer n'a rien
 *  à faire dans un bouton.
 *
 *  Conséquence à tenir, et c'est `offerte()` plus bas : un brouillon
 *  repris peut porter un bloc que cette barre n'offre pas. Elle ne doit
 *  ni l'afficher comme un choix, ni le laisser partir en silence. */
type Cle = "rien" | "chercher" | "fouiller" | "cloture";

/** Dit si une action est une de celles que cette barre propose.
 *
 *  POURQUOI CETTE FONCTION EXISTE : le compilateur l'a réclamée le
 *  18 novembre, à la minute où le domaine s'est ouvert au combat.
 *  `this.#action?.type` pouvait soudain valoir « attaquer », que `Cle`
 *  ne connaît pas. La réponse facile aurait été d'élargir `Cle` ; elle
 *  aurait donné une barre qui affiche « Ne rien faire » sur un message
 *  portant `[[WM-ACTION:attaquer:52]]`, et qui l'envoie quand même.
 *  CE QUI EST AFFICHÉ EST CE QUI PART — alors une action non offerte
 *  n'est pas un choix, et son bloc est retiré à l'envoi. */
type ActionOfferte = Extract<Action, { readonly type: "chercher" | "fouiller" }>;

function offerte(action: Action | null): ActionOfferte | null {
  if (action === null) return null;
  return action.type === "chercher" || action.type === "fouiller" ? action : null;
}

//  ── LES QUATRE ICÔNES ────────────────────────────────────────────
//
//  « Ce serait bien d'avoir une icône pour chaque action », 17 novembre.
//
//  MÊME FABRIQUE QUE LE COIN D'OUTILS : viewBox de 16, `currentColor`,
//  `aria-hidden`. Elles suivent donc la couleur du bouton — y compris
//  quand il est coché et que le texte passe en clair — et aucune n'est
//  annoncée deux fois : le libellé reste écrit à côté.
//
//  CHACUNE DIT CE QUE LE JOUEUR FAIT, pas ce que le code fait : une
//  bulle pour un message qui part comme les autres, des herbes hautes
//  pour la rencontre — c'est le signe que tout le monde connaît —, une
//  loupe pour la fouille, un cadenas pour la clôture, qui est le mot
//  des forums pour un sujet verrouillé.
const SVG = "http://www.w3.org/2000/svg";

function dessin(doc: Document, traces: readonly (readonly [string, string])[]): SVGSVGElement {
  const racine = doc.createElementNS(SVG, "svg");
  racine.setAttribute("viewBox", "0 0 16 16");
  racine.setAttribute("class", "wm-barre__icone");
  racine.setAttribute("aria-hidden", "true");
  racine.setAttribute("focusable", "false");
  for (const [d, largeur] of traces) {
    const p = doc.createElementNS(SVG, "path");
    p.setAttribute("d", d);
    p.setAttribute("fill", "none");
    p.setAttribute("stroke", "currentColor");
    p.setAttribute("stroke-width", largeur);
    p.setAttribute("stroke-linecap", "round");
    p.setAttribute("stroke-linejoin", "round");
    racine.appendChild(p);
  }
  return racine;
}

const ICONES: Record<Cle, (doc: Document) => SVGSVGElement> = {
  //  Une bulle de message : ce qui part quand on ne demande rien.
  rien: (d) =>
    dessin(d, [[
      "M2.7 3.4h10.6a1.6 1.6 0 0 1 1.6 1.6v5a1.6 1.6 0 0 1-1.6 1.6H7l-3.1 2.3v-2.3H2.7A1.6 1.6 0 0 1 1.1 10V5a1.6 1.6 0 0 1 1.6-1.6Z",
      "1.5",
    ]]),
  //  Des herbes hautes : trois brins qui s'ouvrent en éventail.
  //
  //  PREMIER JET RATÉ, ET C'EST LE RENDU QUI L'A DIT : les trois brins
  //  montaient tous vers la droite et un trait de sol les fermait en
  //  bas. À 17 px, ça ne faisait pas des herbes, ça faisait une tente.
  //  Un dessin se regarde à sa taille, pas dans son `viewBox`.
  chercher: (d) =>
    dessin(d, [
      ["M4 14.3C4 10.2 3.1 7.7 1.6 5.9", "1.6"],
      ["M8 14.3C8 9.2 7.9 5.3 7.6 2.3", "1.6"],
      ["M12 14.3C12 10.2 12.9 7.7 14.4 5.9", "1.6"],
    ]),
  //  Une loupe : on retourne la zone.
  fouiller: (d) =>
    dessin(d, [
      ["M11.1 7a4.2 4.2 0 1 1-8.4 0 4.2 4.2 0 0 1 8.4 0Z", "1.6"],
      ["M10.2 10.2 14 14", "1.8"],
    ]),
  //  Un cadenas : le mot des forums pour un sujet qui se ferme.
  cloture: (d) =>
    dessin(d, [
      [
        "M4.4 7.2h7.2a1.3 1.3 0 0 1 1.3 1.3v4.3a1.3 1.3 0 0 1-1.3 1.3H4.4a1.3 1.3 0 0 1-1.3-1.3V8.5a1.3 1.3 0 0 1 1.3-1.3Z",
        "1.5",
      ],
      ["M5.7 7.2V5.3a2.3 2.3 0 0 1 4.6 0v1.9", "1.5"],
    ]),
};

type Choix = {
  readonly cle: Cle;
  readonly libelle: string;
  /** La phrase sous les boutons, en français, qui dit ce qui partira. */
  readonly annonce: string;
  /** « Clôturer doit apparaître de manière un peu secondaire » : il est
   *  dans le même groupe, sur sa propre rangée, en plus calme. */
  readonly secondaire?: true;
};

const CHOIX: readonly Choix[] = [
  {
    cle: "rien",
    libelle: "Ne rien faire",
    annonce: "Ton message part comme un message normal. Rien n'est envoyé sans toi.",
  },
  {
    //  LES MOTS SONT CEUX DE CALLISTA : « soit je fais rien, soit je
    //  fouille la zone, soit je fais apparaître un pokémon ». Le libellé
    //  disait « Chercher », et elle a demandé ce que ça voulait dire —
    //  un bouton qu'il faut expliquer est mal nommé.
    cle: "chercher",
    libelle: "Faire apparaître un Pokémon",
    annonce: "Quand tu enverras ce message, tu fais apparaître un Pokémon.",
  },
  {
    cle: "fouiller",
    libelle: "Fouiller la zone",
    annonce: "Quand tu enverras ce message, tu fouilles la zone.",
  },
  {
    cle: "cloture",
    libelle: "Clôturer le sujet",
    annonce: "Quand tu enverras ce message, le sujet sera clôturé. " +
      "Le mot « [cloture] » est écrit à la fin de ton texte : tu peux l'effacer à la main.",
    secondaire: true,
  },
];

/** L'action que porte un choix, ou `null` pour les deux qui n'en
 *  demandent aucune. */
function actionDuChoix(cle: Cle): Action | null {
  return cle === "chercher" || cle === "fouiller" ? { type: cle } : null;
}

export class BarreDActions {
  readonly #doc: Document;
  readonly #brouillon: Brouillon;
  readonly #boutons = new Map<Cle, HTMLButtonElement>();
  #note: HTMLParagraphElement | null = null;
  #action: Action | null = null;

  constructor(doc: Document, brouillon: Brouillon) {
    this.#doc = doc;
    this.#brouillon = brouillon;
  }

  /** Le choix en cours, pour qui veut l'envoyer lui-même (l'essai, le
   *  module de bilan plus tard).
   *
   *  LA CLÔTURE SE LIT DANS LE TEXTE, pas dans un champ à nous : le
   *  joueur l'écrit et l'efface à la main, et le module au-dessus du
   *  premier message la pose aussi. Deux mémoires se contrediraient ;
   *  une seule, non. */
  get choix(): Cle {
    if (clotureDemandee(this.#brouillon.lire())) return "cloture";
    const offert = offerte(this.#action);
    return offert === null ? "rien" : offert.type;
  }

  /** L'action demandée, s'il y en a une. */
  get etat(): Action | null {
    return this.choix === "cloture" ? null : this.#action;
  }

  /** Reflète le choix sur les boutons et sur la phrase. */
  #rafraichir(): void {
    const choisi = this.choix;
    for (const choix of CHOIX) {
      const bouton = this.#boutons.get(choix.cle);
      if (bouton === undefined) continue;
      const coche = choix.cle === choisi;
      bouton.classList.toggle("wm-barre__bouton--choisi", coche);
      bouton.setAttribute("aria-checked", String(coche));
      //  TABINDEX TOURNANT : un groupe de radios est UNE étape de
      //  tabulation, et les flèches s'y déplacent. Sans ça, quatre
      //  boutons séparés — et la tabulation au clavier devient quatre
      //  fois plus longue sur chaque réponse.
      bouton.tabIndex = coche ? 0 : -1;
    }
    if (this.#note !== null) {
      this.#note.textContent = CHOIX.find((c) => c.cle === choisi)?.annonce ?? "";
    }
  }

  /** Ce qu'un clic produit. Les quatre s'excluent, donc poser l'un
   *  défait l'autre — y compris la clôture, qui vit dans le texte. */
  #poser(cle: Cle): void {
    const texte = this.#brouillon.lire();
    if (cle === "cloture") {
      this.#action = null;
      if (!clotureDemandee(texte)) this.#brouillon.ecrire(avecLaCloture(texte));
    } else {
      this.#action = actionDuChoix(cle);
      if (clotureDemandee(texte)) this.#brouillon.ecrire(sansLaCloture(texte));
    }
    this.#rafraichir();
  }

  /** Le bloc, écrit dans le champ du formulaire au dernier moment.
   *
   *  Appelé par l'écouteur d'envoi — et aussi par la prévisualisation,
   *  qui passe par le même formulaire.
   *
   *  CE QUI EST AFFICHÉ EST CE QUI PART. Un texte repris peut porter un
   *  vieux bloc d'action ET le mot de clôture ; la barre montre alors
   *  « Clôturer », et c'est elle qui a raison — le bloc est retiré. */
  ecrireAvantEnvoi(): void {
    const texte = this.#brouillon.lire();
    if (this.choix === "cloture") {
      //  ON REPOSE LE MOT APRÈS COUP, et ce n'est pas un détour :
      //  retirer le bloc laisse les deux lignes vides qui
      //  l'encadraient, et le joueur se retrouvait avec un trou de
      //  quatre retours avant `[cloture]`. `sansLaCloture` rogne la fin,
      //  `avecLaCloture` la repose à la bonne distance — les deux mêmes
      //  fonctions que les clics, donc une seule règle d'espacement.
      const propre = avecLaCloture(sansLaCloture(sansAction(texte)));
      if (propre !== texte) this.#brouillon.ecrire(propre);
      return;
    }
    const offert = offerte(this.#action);
    if (offert === null) {
      //  AUCUNE ACTION OFFERTE, ET POURTANT UN BLOC POSSIBLE. Un
      //  brouillon repris peut porter `[[WM-ACTION:attaquer:52]]` d'un
      //  combat précédent ; la barre montre « Ne rien faire », donc
      //  c'est un message normal qui doit partir. Le bloc s'en va.
      const propre = sansAction(texte);
      if (propre !== texte) this.#brouillon.ecrire(propre);
      return;
    }
    this.#brouillon.ecrire(avecAction(texte, offert));
  }

  /** Construit la barre et l'accroche DANS le formulaire, juste
   *  au-dessus des boutons d'envoi. */
  poser(apres: Element): HTMLElement {
    //  L'ÉTAT DE DÉPART VIENT DU TEXTE. Un brouillon repris, une
    //  modification, un retour de prévisualisation : le bloc peut déjà
    //  être là, et la barre doit s'ouvrir dessus.
    this.#action = offerte(actionDe(this.#brouillon.lire()));

    const barre = this.#doc.createElement("div");
    barre.className = "wm-barre";

    const entete = this.#doc.createElement("p");
    entete.className = "wm-barre__entete";
    entete.textContent = "Ton tour";
    barre.appendChild(entete);

    const groupe = this.#doc.createElement("div");
    groupe.className = "wm-barre__choix";
    groupe.setAttribute("role", "radiogroup");
    groupe.setAttribute("aria-label", "Ce que fait ce message");

    const rangee = this.#doc.createElement("div");
    rangee.className = "wm-barre__rangee";
    const fin = this.#doc.createElement("div");
    fin.className = "wm-barre__rangee wm-barre__rangee--fin";
    for (const choix of CHOIX) {
      const bouton = this.#bouton(choix);
      (choix.secondaire === true ? fin : rangee).appendChild(bouton);
    }
    groupe.appendChild(rangee);
    groupe.appendChild(fin);
    barre.appendChild(groupe);

    const note = this.#doc.createElement("p");
    note.className = "wm-barre__note";
    this.#note = note;
    barre.appendChild(note);

    const formulaire = apres.closest("form") ?? apres;
    placer(barre, formulaire);

    //  L'ENVOI, PAR DEUX CHEMINS, et ce n'est pas de la ceinture et des
    //  bretelles :
    //
    //    · l'événement `submit`, en phase de CAPTURE — d'autres scripts
    //      du forum écoutent le même, et l'un d'eux peut arrêter la
    //      propagation avant nous ;
    //    · le clic sur les boutons d'envoi et de prévisualisation, parce
    //      qu'un `form.submit()` appelé en JavaScript **n'émet pas
    //      `submit`**. Forumactif en appelle à plusieurs endroits.
    //
    //  Écrire deux fois ne double rien : `avecAction` remplace le bloc
    //  présent au lieu de l'empiler.
    formulaire.addEventListener("submit", () => this.ecrireAvantEnvoi(), { capture: true });
    for (const envoi of formulaire.querySelectorAll('[type="submit"]')) {
      envoi.addEventListener("click", () => this.ecrireAvantEnvoi(), { capture: true });
    }

    this.#brouillon.surChangement(() => this.#rafraichir());
    this.#rafraichir();
    return barre;
  }

  #bouton(choix: Choix): HTMLButtonElement {
    const bouton = this.#doc.createElement("button");
    bouton.type = "button";
    bouton.className = "wm-barre__bouton" +
      (choix.secondaire === true ? " wm-barre__bouton--secondaire" : "");
    //  L'ICÔNE N'EST PAS LE LIBELLÉ. Elle est `aria-hidden` et le mot
    //  reste écrit : un bouton dont l'icône porte le sens n'est lisible
    //  que par qui l'a déjà appris.
    bouton.appendChild(ICONES[choix.cle](this.#doc));
    const mot = this.#doc.createElement("span");
    mot.className = "wm-barre__mot";
    mot.textContent = choix.libelle;
    bouton.appendChild(mot);
    bouton.setAttribute("role", "radio");
    bouton.setAttribute("aria-checked", "false");
    bouton.tabIndex = -1;
    bouton.addEventListener("click", () => this.#poser(choix.cle));
    bouton.addEventListener("keydown", (e) => this.#auClavier(e as KeyboardEvent, choix.cle));
    this.#boutons.set(choix.cle, bouton);
    return bouton;
  }

  /** Les flèches déplacent le choix, comme dans n'importe quel groupe de
   *  radios. Annoncer `role="radio"` sans ça serait mentir au clavier. */
  #auClavier(e: KeyboardEvent, cle: Cle): void {
    const pas = SUIVANT[e.key];
    if (pas === undefined) return;
    e.preventDefault();
    const i = CHOIX.findIndex((c) => c.cle === cle);
    const vise = pas === "debut"
      ? 0
      : pas === "fin"
      ? CHOIX.length - 1
      : (i + pas + CHOIX.length) % CHOIX.length;
    this.#poser(CHOIX[vise].cle);
    this.#boutons.get(CHOIX[vise].cle)?.focus();
  }
}

const SUIVANT: Record<string, number | "debut" | "fin" | undefined> = {
  ArrowRight: 1,
  ArrowDown: 1,
  ArrowLeft: -1,
  ArrowUp: -1,
  Home: "debut",
  End: "fin",
};

/** Où la barre se glisse : DANS le formulaire, juste avant la rangée
 *  d'envoi. « En dessous, prévisualiser ou envoyer. »
 *
 *  ON REMONTE DEPUIS LE BOUTON D'ENVOI, et pas depuis un sélecteur de
 *  conteneur : la réponse rapide et la page de rédaction complète n'ont
 *  pas le même balisage, et Forumactif sert la première toute faite
 *  (`{QUICK_REPLY_FORM}`) — on ne la choisit pas.
 *
 *  LA GARDE QUI COMPTE : si en remontant on attrape un bloc qui contient
 *  AUSSI le champ de texte, on s'arrête et on se colle au bouton. Sans
 *  elle, la barre passerait au-dessus de l'éditeur sur tout formulaire
 *  qui range les deux ensemble — et ce serait exactement le contraire de
 *  ce qui est demandé. */
function placer(barre: HTMLElement, formulaire: Element): void {
  const envoi = formulaire.querySelector('[type="submit"]');
  if (envoi === null) {
    formulaire.appendChild(barre);
    return;
  }
  const champ = formulaire.querySelector("textarea");
  let noeud: Element = envoi;
  while (noeud.parentElement !== null && noeud.parentElement !== formulaire) {
    noeud = noeud.parentElement;
  }
  if (champ !== null && noeud.contains(champ)) noeud = envoi;
  noeud.insertAdjacentElement("beforebegin", barre);
  centrerLesEnvois(formulaire, champ);
}

/** « Envoyer et prévisualiser, centrer les deux boutons. »
 *
 *  LES DEUX BOUTONS NE SONT PAS À NOUS : Forumactif sert la réponse
 *  rapide toute faite (`{QUICK_REPLY_FORM}`) et on ne connaît pas son
 *  balisage d'avance — ils peuvent être nus dans le formulaire ou déjà
 *  rangés dans un conteneur. Les deux cas existent, et le harnais monte
 *  les deux.
 *
 *  ON NE DÉPLACE QUE SI C'EST NÉCESSAIRE. Si un conteneur ne tient
 *  QU'EUX, on l'habille — c'est le geste le plus léger, et rien ne
 *  bouge dans l'arbre. Sinon on les enveloppe, à leur place, dans l'ordre
 *  où ils étaient : un script du forum qui les retrouve par `name` ou
 *  par `id` s'y retrouve toujours, et aucun n'est perdu en route. */
function centrerLesEnvois(formulaire: Element, champ: Element | null): void {
  const envois = [...formulaire.querySelectorAll('[type="submit"]')];
  if (envois.length === 0) return;

  const parent = envois[0].parentElement;
  if (
    parent !== null && parent !== formulaire &&
    (champ === null || !parent.contains(champ)) &&
    envois.every((e) => e.parentElement === parent) &&
    //  LES CHAMPS CACHÉS NE COMPTENT PAS : Forumactif en pose à côté
    //  des boutons, et exiger un conteneur parfaitement pur ferait
    //  créer une boîte de plus pour rien.
    [...parent.children].every((e) => envois.includes(e) || e.getAttribute("type") === "hidden")
  ) {
    parent.classList.add("wm-envois");
    return;
  }

  //  LA PLAGE, ET PAS SEULEMENT LES BOUTONS : entre « Envoyer » et
  //  « Prévisualisation » Forumactif glisse des champs cachés et du
  //  texte. Les emporter garde l'ordre d'origine ; les laisser
  //  derrière couperait le formulaire en deux.
  const freres = [...(envois[0].parentElement?.childNodes ?? [])];
  const premier = freres.indexOf(envois[0]);
  const dernier = freres.indexOf(envois[envois.length - 1]);
  if (premier < 0 || dernier < premier) return;

  const boite = formulaire.ownerDocument.createElement("div");
  boite.className = "wm-envois";
  envois[0].parentElement?.insertBefore(boite, envois[0]);
  for (const n of freres.slice(premier, dernier + 1)) boite.appendChild(n);
}
