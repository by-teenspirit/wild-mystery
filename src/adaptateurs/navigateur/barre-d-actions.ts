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
//  TROIS CHOIX : « Chercher un Pokémon », « Fouiller la zone » et
//  « Clôturer le sujet ».
//
//  LE PREMIER A UN MENU, et c'est ce qui le distingue : une zone a une
//  quinzaine de lieux, et le serveur refuse un lieu qui n'est pas de la
//  zone (voir `LireLesNouveauxMessages`). Le joueur ne tape donc pas un
//  nom, il le choisit — la clé écrite dans le bloc est forcément valable.
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

import { basculer } from "../../navigateur/redaction.ts";
import { actionDe } from "../../domaine/action.ts";
import type { LieuChoisissable } from "../../navigateur/zone.ts";
import type { Brouillon } from "./editeur.ts";

/** Le mot que le bouton de clôture pose. Il est lu par la relève comme
 *  n'importe quelle demande tapée à la main : même forme, même effet. */
export const MOT_DE_CLOTURE = "[cloture]";

/** La clé interne du bouton de recherche dans la table des boutons. Son
 *  libellé change avec le lieu choisi, donc il ne peut pas servir de clé
 *  comme pour les deux autres. */
const CHERCHER = "chercher";

const EST_UNE_CLOTURE = /\[\s*cl[oô]ture\s*\]/i;

type Choix = {
  readonly libelle: string;
  readonly forme: "pleine" | "cerclee" | "terre";
  readonly pose: (texte: string) => string;
  readonly estPose: (texte: string) => boolean;
};

/** « Chercher un Pokémon », un choix par lieu de la zone.
 *
 *  Un bouton par lieu ferait quinze boutons ; un menu déroulant et un
 *  bouton font deux éléments, et le menu dit lesquels existent. Le
 *  bouton reprend donc le lieu SÉLECTIONNÉ au moment du clic. */
function chercherDans(lieu: LieuChoisissable): Choix {
  const action = { type: "chercher", lieu: lieu.cle } as const;
  return {
    libelle: `Chercher à ${lieu.nom}`,
    forme: "cerclee",
    pose: (t) => basculer(t, action),
    estPose: (t) => {
      const a = actionDe(t);
      return a?.type === "chercher" && a.lieu === lieu.cle;
    },
  };
}

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
  readonly #lieux: readonly LieuChoisissable[];
  readonly #boutons = new Map<string, HTMLButtonElement>();
  #menu: HTMLSelectElement | null = null;

  /** `lieux` peut être vide : sept zones n'ont pas encore de table de
   *  faune, et le fichier peut aussi n'avoir pas été servi. Dans ce cas
   *  la rangée « chercher » ne s'affiche pas — plutôt qu'un menu vide. */
  constructor(doc: Document, brouillon: Brouillon, lieux: readonly LieuChoisissable[] = []) {
    this.#doc = doc;
    this.#brouillon = brouillon;
    this.#lieux = lieux;
  }

  /** Le lieu choisi dans le menu, ou le premier de la liste. */
  #lieuChoisi(): LieuChoisissable | null {
    if (this.#lieux.length === 0) return null;
    const cle = this.#menu?.value;
    return this.#lieux.find((l) => l.cle === cle) ?? this.#lieux[0];
  }

  /** Reflète l'état du texte sur les boutons. Appelé après chaque clic ET
   *  à chaque frappe : le joueur peut effacer le bloc à la main, et la
   *  barre doit le suivre plutôt que de mentir. */
  #rafraichir(): void {
    const texte = this.#brouillon.lire();

    //  « Chercher » se marque sur le lieu DU MENU : si le joueur a posé
    //  « Berge Est » puis déroule vers « Marais », le bouton s'éteint —
    //  il poserait autre chose, il ne doit pas se dire posé.
    const bouton = this.#boutons.get(CHERCHER);
    const lieu = this.#lieuChoisi();
    if (bouton && lieu) {
      const pose = chercherDans(lieu).estPose(texte);
      bouton.classList.toggle("wm-barre__bouton--pose", pose);
      bouton.setAttribute("aria-pressed", String(pose));
      bouton.textContent = `Chercher à ${lieu.nom}`;
    }

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

    if (this.#lieux.length > 0) barre.appendChild(this.#rangeeDeRecherche());

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

  /** Le menu des lieux et son bouton, sur une rangée à eux. */
  #rangeeDeRecherche(): HTMLElement {
    const rangee = this.#doc.createElement("div");
    rangee.className = "wm-barre__rangee wm-barre__rangee--lieu";

    //  Une vraie étiquette, liée au menu : sans elle, un lecteur d'écran
    //  annonce « liste » et rien d'autre.
    const etiquette = this.#doc.createElement("label");
    etiquette.className = "wm-barre__etiquette";
    etiquette.htmlFor = "wm-lieu";
    etiquette.textContent = "Où";
    rangee.appendChild(etiquette);

    const menu = this.#doc.createElement("select");
    menu.id = "wm-lieu";
    menu.className = "wm-barre__menu";
    for (const lieu of this.#lieux) {
      const option = this.#doc.createElement("option");
      option.value = lieu.cle;
      option.textContent = lieu.nom;
      menu.appendChild(option);
    }
    //  Changer de lieu ne touche PAS au message : ça ne fait que changer
    //  ce que le bouton poserait. Le joueur reste maître de ce qu'il
    //  écrit — rien ne part sans un clic.
    menu.addEventListener("change", () => this.#rafraichir());
    this.#menu = menu;
    rangee.appendChild(menu);

    const bouton = this.#doc.createElement("button");
    bouton.type = "button";
    bouton.className = "wm-barre__bouton wm-barre__bouton--cerclee";
    bouton.setAttribute("aria-pressed", "false");
    bouton.textContent = "Chercher";
    bouton.addEventListener("click", () => {
      const lieu = this.#lieuChoisi();
      if (lieu === null) return;
      this.#brouillon.ecrire(chercherDans(lieu).pose(this.#brouillon.lire()));
      this.#rafraichir();
    });
    this.#boutons.set(CHERCHER, bouton);
    rangee.appendChild(bouton);

    return rangee;
  }
}
