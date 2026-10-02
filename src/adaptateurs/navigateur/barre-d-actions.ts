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
//  CE QU'ELLE PORTE AUJOURD'HUI : « Fouiller la zone » et « Clôturer le
//  sujet ». **Pas « Chercher un Pokémon »** : ce bouton doit offrir les
//  quinze lieux de la zone, et le choix du lieu n'est pas tranché. Un
//  bouton qui n'aboutit pas est pire que pas de bouton.
//
//  « Clôturer le sujet » n'écrit pas un bloc d'action : il écrit
//  `[cloture]`, le mot que les joueurs tapent déjà aujourd'hui. Le bouton
//  ne fait que leur épargner la frappe — et rien ne part tout seul, c'est
//  toujours le joueur qui envoie.
// ════════════════════════════════════════════════════════════════════

import { basculer } from "../../navigateur/redaction.ts";
import { actionDe } from "../../domaine/action.ts";
import type { Brouillon } from "./editeur.ts";

/** Le mot que le bouton de clôture pose. Il est lu par la relève comme
 *  n'importe quelle demande tapée à la main : même forme, même effet. */
export const MOT_DE_CLOTURE = "[cloture]";

const EST_UNE_CLOTURE = /\[\s*cl[oô]ture\s*\]/i;

type Choix = {
  readonly libelle: string;
  readonly forme: "pleine" | "cerclee" | "terre";
  readonly pose: (texte: string) => string;
  readonly estPose: (texte: string) => boolean;
};

const CHOIX: readonly Choix[] = [
  {
    libelle: "Fouiller la zone",
    forme: "pleine",
    pose: (t) => basculer(t, { type: "fouiller" }),
    estPose: (t) => actionDe(t)?.type === "fouiller",
  },
  {
    libelle: "Clôturer le sujet",
    forme: "terre",
    pose: (t) => {
      if (EST_UNE_CLOTURE.test(t)) return t.replace(EST_UNE_CLOTURE, "").replace(/\s+$/, "");
      const propre = t.replace(/\s+$/, "");
      return propre === "" ? MOT_DE_CLOTURE : `${propre}\n\n${MOT_DE_CLOTURE}`;
    },
    estPose: (t) => EST_UNE_CLOTURE.test(t),
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
