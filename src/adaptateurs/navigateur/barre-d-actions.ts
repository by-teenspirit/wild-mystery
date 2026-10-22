/// <reference lib="dom" />
/// <reference lib="dom.iterable" />
// ════════════════════════════════════════════════════════════════════
//  src/adaptateurs/navigateur/barre-d-actions.ts
//
//  COUVERT PAR : outils/barre.mjs — les trois états, l'écriture à l'envoi et le fait qu'aucun contrôle ne soit muet.
//  (Garde-fou n° 22 : un module d'interface sans test unitaire doit dire
//   quel harnais le monte, et ce harnais doit tourner dans le CI.)
//
//  La barre sous l'éditeur de réponse. Dessinée dans Figma, page
//  Composants, « Barre d'actions ».
//
//  QUE DU DOM. Ce qu'un clic fait au texte est décidé dans
//  `src/navigateur/redaction.ts`, où c'est testé sans navigateur.
//
//  TROIS CHOIX, ET TROIS BOUTONS : « Faire apparaître un Pokémon »,
//  « Fouiller la zone » et « Clôturer le sujet ».
//
//  ── LE CLIC N'ÉCRIT PLUS DANS LE MESSAGE ────────────────────────────
//
//  Callista, le 15 octobre : « je n'aime pas le fait que ça ajoute une
//  balise dans mon texte, je veux que ce soit automatique quand je
//  clique. soit je fais rien, soit je fouille la zone, soit je fais
//  apparaître un pokémon. »
//
//  Donc : TROIS ÉTATS, portés par la barre, et le bloc écrit au dernier
//  moment — à l'envoi, dans le champ du formulaire. Le joueur ne voit
//  jamais notre syntaxe ; il voit un bouton enfoncé et une phrase qui
//  dit ce qui va partir.
//
//  CE QUE CE CHOIX COÛTE, et pourquoi il reste le bon : le bloc n'est
//  plus relisible avant l'envoi. C'était l'argument d'en face — « le
//  joueur lit ce qu'il demande avant d'envoyer ». Mais il le lisait sous
//  la forme `[[WM-ACTION:chercher]]`, qui ne se lit pas ; la phrase sous
//  les boutons le dit mieux, en français.
//
//  ET LE BLOC EST ENCORE LU S'IL EST LÀ. Un message en cours d'édition
//  peut en porter un — il en est parti comme ça pendant deux semaines.
//  La barre s'ouvre donc sur l'état du texte, et à l'envoi elle réécrit
//  un bloc unique et canonique (`avecAction` remplace, il n'empile pas).
//
//  ── LE MENU « OÙ » EST PARTI, LE 15 OCTOBRE ─────────────────────────
//
//  Il y avait une rangée de plus : une étiquette « Où », un menu des
//  quinze lieux de la zone, et un bouton qui reprenait le lieu
//  sélectionné. Callista, en montrant la barre sur `t996` : « on est
//  déjà dans une zone sauvage, avec un palier (fleuve paisible etc.),
//  donc y'a pas d'autres zones à rajouter. »
//
//  ET C'ÉTAIT AUSSI UN PIÈGE. Changer de lieu dans le menu ne touchait
//  pas au message — c'était écrit en commentaire comme une intention,
//  « le joueur reste maître de ce qu'il écrit ». Mais un menu ressemble
//  à l'action : elle a déroulé, choisi, et rien ne s'est passé. Un
//  contrôle qui a l'air d'agir et qui n'agit pas est un défaut, quelle
//  que soit la bonne raison derrière. **`outils/barre.mjs` monte la
//  barre dans un navigateur et exige que CHAQUE contrôle qu'elle pose
//  change quelque chose** : c'est la règle générale dont ce défaut
//  était un cas, et elle ne dépend pas de se souvenir de celui-là.
//
//  Le lieu n'a pas disparu pour autant : les tables de rencontre vivent
//  par lieu, et c'est le SERVEUR qui en tire un, avec la graine du
//  message — voir `tirerUnLieu` dans `domaine/rencontre.ts`. Le joueur
//  ne le choisit plus ; le bilan lui dira où ça s'est passé.
//
//  **La barre ne se pose que dans les dix-sept zones sauvages**, règle 4
//  de la planche 45. Ailleurs, la relève ne lit rien : un bouton y
//  écrirait un bloc que personne ne traiterait, et le joueur n'aurait
//  aucun moyen de comprendre pourquoi rien ne se passe. C'est
//  `js/wild-mystery.ts` qui tranche, avant de construire quoi que ce
//  soit.
//
//  « Clôturer le sujet » EST À PART, et reste visible dans le texte : il
//  écrit `[cloture]`, le mot que les joueurs tapent déjà aujourd'hui.
//  Ce n'est pas notre syntaxe, c'est la leur ; la cacher serait leur
//  retirer quelque chose qu'ils savent lire et corriger. Et rien ne part
//  tout seul : c'est toujours le joueur qui envoie.
// ════════════════════════════════════════════════════════════════════

import { avecAction, basculerLaCloture, clotureDemandee } from "../../navigateur/redaction.ts";
import { type Action, actionDe } from "../../domaine/action.ts";
import type { Brouillon } from "./editeur.ts";

/** Les trois états de la barre. `null` est un état à part entière : « je
 *  ne fais rien », et c'est celui de départ. */
type Etat = Action | null;

type Choix = {
  readonly libelle: string;
  readonly forme: "pleine" | "cerclee" | "terre";
  /** Ce qui partira à l'envoi, dit en français, pour la phrase sous les
   *  boutons. */
  readonly annonce: string;
  readonly action: Action;
};

const CHOIX: readonly Choix[] = [
  {
    //  LES MOTS SONT CEUX DE CALLISTA : « soit je fais rien, soit je
    //  fouille la zone, soit je fais apparaître un pokémon ». Le libellé
    //  disait « Chercher », et elle a demandé ce que ça voulait dire —
    //  un bouton qu'il faut expliquer est mal nommé.
    libelle: "Faire apparaître un Pokémon",
    forme: "cerclee",
    annonce: "tu fais apparaître un Pokémon",
    action: { type: "chercher" },
  },
  {
    libelle: "Fouiller la zone",
    forme: "pleine",
    annonce: "tu fouilles la zone",
    action: { type: "fouiller" },
  },
];

const RIEN = "Si tu ne cliques sur rien, ton message part comme un message normal. " +
  "Rien n'est envoyé sans toi.";

const CLOTURE = "Clôturer le sujet";

export class BarreDActions {
  readonly #doc: Document;
  readonly #brouillon: Brouillon;
  readonly #boutons = new Map<string, HTMLButtonElement>();
  #note: HTMLParagraphElement | null = null;
  #etat: Etat = null;

  constructor(doc: Document, brouillon: Brouillon) {
    this.#doc = doc;
    this.#brouillon = brouillon;
  }

  /** L'état demandé, pour qui veut l'envoyer lui-même (l'essai, le
   *  module de bilan plus tard). */
  get etat(): Etat {
    return this.#etat;
  }

  /** Reflète l'état sur les boutons et sur la phrase.
   *
   *  La clôture, elle, se lit dans le TEXTE : c'est le joueur qui l'écrit
   *  ou l'efface, et la barre doit le suivre plutôt que de mentir. */
  #rafraichir(): void {
    for (const choix of CHOIX) {
      const bouton = this.#boutons.get(choix.libelle);
      if (!bouton) continue;
      const pose = this.#etat?.type === choix.action.type;
      bouton.classList.toggle("wm-barre__bouton--pose", pose);
      bouton.setAttribute("aria-pressed", String(pose));
    }

    const cloture = this.#boutons.get(CLOTURE);
    if (cloture) {
      const pose = clotureDemandee(this.#brouillon.lire());
      cloture.classList.toggle("wm-barre__bouton--pose", pose);
      cloture.setAttribute("aria-pressed", String(pose));
    }

    if (this.#note === null) return;
    const choisi = CHOIX.find((c) => c.action.type === this.#etat?.type);
    this.#note.textContent = choisi === undefined
      ? RIEN
      : `Quand tu enverras ce message, ${choisi.annonce}. Reclique pour annuler.`;
  }

  /** Ce qu'un clic sur un bouton d'action fait : il change l'état, et
   *  RIEN D'AUTRE. Le même bouton deux fois revient à « je ne fais
   *  rien » ; un autre bouton remplace, puisque les trois états
   *  s'excluent. */
  #choisir(action: Action): void {
    this.#etat = this.#etat?.type === action.type ? null : action;
    this.#rafraichir();
  }

  /** Le bloc, écrit dans le champ du formulaire au dernier moment.
   *
   *  Appelé par l'écouteur d'envoi — et aussi par la prévisualisation,
   *  qui passe par le même formulaire. Sans action demandée, on ne
   *  touche à rien : un message de RP pur doit pouvoir partir sans que
   *  nous l'ayons réécrit. */
  ecrireAvantEnvoi(): void {
    if (this.#etat === null) return;
    this.#brouillon.ecrire(avecAction(this.#brouillon.lire(), this.#etat));
  }

  /** Construit la barre et l'accroche après le formulaire de réponse. */
  poser(apres: Element): HTMLElement {
    //  L'ÉTAT DE DÉPART VIENT DU TEXTE. Un brouillon repris, une
    //  modification, un retour de prévisualisation : le bloc peut déjà
    //  être là, et la barre doit s'ouvrir dessus.
    this.#etat = actionDe(this.#brouillon.lire());

    const barre = this.#doc.createElement("div");
    barre.className = "wm-barre";

    const entete = this.#doc.createElement("p");
    entete.className = "wm-barre__entete";
    entete.textContent = "Ton tour";
    barre.appendChild(entete);

    const rangee = this.#doc.createElement("div");
    rangee.className = "wm-barre__rangee";
    for (const choix of CHOIX) {
      rangee.appendChild(
        this.#bouton(choix.libelle, choix.forme, () => this.#choisir(choix.action)),
      );
    }
    //  LA CLÔTURE ÉCRIT DANS LE TEXTE, elle : voir l'en-tête.
    rangee.appendChild(this.#bouton(CLOTURE, "terre", () => {
      this.#brouillon.ecrire(basculerLaCloture(this.#brouillon.lire()));
      this.#rafraichir();
    }));
    barre.appendChild(rangee);

    const note = this.#doc.createElement("p");
    note.className = "wm-barre__note";
    this.#note = note;
    barre.appendChild(note);

    apres.insertAdjacentElement("afterend", barre);

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
    const formulaire = apres.closest("form") ?? apres;
    formulaire.addEventListener("submit", () => this.ecrireAvantEnvoi(), { capture: true });
    for (const envoi of formulaire.querySelectorAll('[type="submit"]')) {
      envoi.addEventListener("click", () => this.ecrireAvantEnvoi(), { capture: true });
    }

    this.#brouillon.surChangement(() => this.#rafraichir());
    this.#rafraichir();
    return barre;
  }

  #bouton(libelle: string, forme: string, fait: () => void): HTMLButtonElement {
    const bouton = this.#doc.createElement("button");
    bouton.type = "button";
    bouton.className = `wm-barre__bouton wm-barre__bouton--${forme}`;
    bouton.textContent = libelle;
    bouton.setAttribute("aria-pressed", "false");
    bouton.addEventListener("click", fait);
    this.#boutons.set(libelle, bouton);
    return bouton;
  }
}
