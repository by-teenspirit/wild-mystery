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
 *  départ, et il a son bouton. */
type Cle = "rien" | "chercher" | "fouiller" | "cloture";

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
    return this.#action?.type ?? "rien";
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
    if (this.#action === null) return;
    this.#brouillon.ecrire(avecAction(texte, this.#action));
  }

  /** Construit la barre et l'accroche DANS le formulaire, juste
   *  au-dessus des boutons d'envoi. */
  poser(apres: Element): HTMLElement {
    //  L'ÉTAT DE DÉPART VIENT DU TEXTE. Un brouillon repris, une
    //  modification, un retour de prévisualisation : le bloc peut déjà
    //  être là, et la barre doit s'ouvrir dessus.
    this.#action = actionDe(this.#brouillon.lire());

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
    bouton.textContent = choix.libelle;
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
}
