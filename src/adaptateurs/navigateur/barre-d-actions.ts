/// <reference lib="dom" />
/// <reference lib="dom.iterable" />
// ════════════════════════════════════════════════════════════════════
//  src/adaptateurs/navigateur/barre-d-actions.ts
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
//  que soit la bonne raison derrière.
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
//  « Clôturer le sujet » n'écrit pas un bloc d'action : il écrit
//  `[cloture]`, le mot que les joueurs tapent déjà aujourd'hui. Le bouton
//  ne fait que leur épargner la frappe — et rien ne part tout seul, c'est
//  toujours le joueur qui envoie.
// ════════════════════════════════════════════════════════════════════

import { basculer, basculerLaCloture, clotureDemandee } from "../../navigateur/redaction.ts";
import { actionDe } from "../../domaine/action.ts";
import type { Brouillon } from "./editeur.ts";

type Choix = {
  readonly libelle: string;
  readonly forme: "pleine" | "cerclee" | "terre";
  readonly pose: (texte: string) => string;
  readonly estPose: (texte: string) => boolean;
};

const CHOIX: readonly Choix[] = [
  {
    //  LES MOTS SONT CEUX DE CALLISTA : « soit je fais rien, soit je
    //  fouille la zone, soit je fais apparaître un pokémon ». Le libellé
    //  disait « Chercher », et elle a demandé ce que ça voulait dire —
    //  un bouton qu'il faut expliquer est mal nommé.
    libelle: "Faire apparaître un Pokémon",
    forme: "cerclee",
    pose: (t) => basculer(t, { type: "chercher" }),
    //  `estPose` accepte les DEUX formes : un message déjà posté peut
    //  porter un lieu écrit à la main, et le bouton doit se montrer
    //  enfoncé pour celui-là aussi.
    estPose: (t) => actionDe(t)?.type === "chercher",
  },
  {
    libelle: "Fouiller la zone",
    forme: "pleine",
    pose: (t) => basculer(t, { type: "fouiller" }),
    estPose: (t) => actionDe(t)?.type === "fouiller",
  },
  {
    libelle: "Clôturer le sujet",
    forme: "terre",
    pose: basculerLaCloture,
    estPose: clotureDemandee,
  },
];

export class BarreDActions {
  readonly #doc: Document;
  readonly #brouillon: Brouillon;
  readonly #boutons = new Map<string, HTMLButtonElement>();

  constructor(doc: Document, brouillon: Brouillon) {
    this.#doc = doc;
    this.#brouillon = brouillon;
  }

  /** Reflète l'état du texte sur les boutons. Appelé après chaque clic ET
   *  à chaque frappe : le joueur peut effacer le bloc à la main, et la
   *  barre doit le suivre plutôt que de mentir. */
  #rafraichir(): void {
    const texte = this.#brouillon.lire();

    for (const choix of CHOIX) {
      const bouton = this.#boutons.get(choix.libelle);
      if (!bouton) continue;
      const pose = choix.estPose(texte);
      bouton.classList.toggle("wm-barre__bouton--pose", pose);
      bouton.setAttribute("aria-pressed", String(pose));
    }
  }

  /** Construit la barre et l'accroche après le formulaire de réponse. */
  poser(apres: Element): HTMLElement {
    const barre = this.#doc.createElement("div");
    barre.className = "wm-barre";

    const entete = this.#doc.createElement("p");
    entete.className = "wm-barre__entete";
    entete.textContent = "Ton tour";
    barre.appendChild(entete);

    const rangee = this.#doc.createElement("div");
    rangee.className = "wm-barre__rangee";
    for (const choix of CHOIX) {
      const bouton = this.#doc.createElement("button");
      bouton.type = "button";
      bouton.className = `wm-barre__bouton wm-barre__bouton--${choix.forme}`;
      bouton.textContent = choix.libelle;
      bouton.setAttribute("aria-pressed", "false");
      bouton.addEventListener("click", () => {
        this.#brouillon.ecrire(choix.pose(this.#brouillon.lire()));
        this.#rafraichir();
      });
      this.#boutons.set(choix.libelle, bouton);
      rangee.appendChild(bouton);
    }
    barre.appendChild(rangee);

    const note = this.#doc.createElement("p");
    note.className = "wm-barre__note";
    note.textContent =
      "Si tu ne cliques sur rien, ton message part comme un message normal. Rien n'est envoyé sans toi.";
    barre.appendChild(note);

    apres.insertAdjacentElement("afterend", barre);
    this.#brouillon.surChangement(() => this.#rafraichir());
    this.#rafraichir();
    return barre;
  }
}
