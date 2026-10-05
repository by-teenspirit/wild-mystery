/// <reference lib="dom" />
// ════════════════════════════════════════════════════════════════════
//  src/adaptateurs/navigateur/module-bilan.ts
//
//  Le module posé au-dessus du premier message d'un sujet de zone.
//  Il montre ce que le registre contient — des faits —, pas un verdict.
//
//  ── IL NE DEMANDE AUCUN CHANGEMENT DE TEMPLATE ───────────────────────
//
//  La règle 3 du `45-…` dit qu'il s'insère en JavaScript, à
//  l'affichage. On a longtemps écrit qu'il lui fallait un point
//  d'ancrage dans `viewtopic_body` : c'était faux, et ça a retardé le
//  module pour rien. Le premier message est trouvable (`post--<id>`),
//  et un nœud s'insère avant lui.
//
//  ── SANS JAVASCRIPT, LA PAGE NE PERD RIEN ────────────────────────────
//
//  Le module ne s'affiche pas, et c'est tout : le bilan de clôture est
//  un vrai message posté, donc il reste lisible dans dix ans sans une
//  ligne de script (`45-…` §6).
// ════════════════════════════════════════════════════════════════════

import { rubriquesEnAttente } from "../../application/bilan.ts";
import {
  aNommer,
  colonnesDuBilan,
  etatDuBoutonDeCloture,
  lignesDepuis,
  parJoueur,
  pseudoParJoueur,
} from "../../navigateur/bilan.ts";
import { basculerLaCloture, clotureDemandee } from "../../navigateur/redaction.ts";
import { cumuler } from "../../domaine/cloture.ts";
import type { Catalogue } from "./catalogue.ts";
import type { Brouillon } from "./editeur.ts";
import type { LectureDuRegistre } from "./registre.ts";

/** L'identifiant du sujet, lu dans l'adresse.
 *
 *  `/t976-test2` → 976. C'est le même nombre que `registre.sujet_id` :
 *  la relève écrit l'identifiant que Forumactif donne au sujet. */
export function sujetDepuisAdresse(chemin: string): number | null {
  const trouve = /^\/t(\d+)-/.exec(chemin);
  return trouve === null ? null : Number(trouve[1]);
}

/** Le pseudo de l'auteur d'un message, pris dans la page.
 *
 *  Chaque message porte `post--<messageId>` et le pseudo de son auteur ;
 *  le registre porte le même `messageId`. On relie les deux là où ils se
 *  rencontrent déjà, plutôt que d'ouvrir la table des joueurs. */
export function lecteurDePseudos(doc: Document): (messageId: number) => string | null {
  const pseudos = new Map<number, string>();
  for (const post of doc.querySelectorAll<HTMLElement>('[class*="post--"]')) {
    const trouve = /post--(\d+)/.exec(post.className);
    if (trouve === null) continue;
    const nom = post.querySelector(".postprofile-name");
    const texte = nom?.textContent?.replace(/\s+/g, " ").trim() ?? "";
    if (texte !== "") pseudos.set(Number(trouve[1]), texte);
  }
  return (messageId) => pseudos.get(messageId) ?? null;
}

function element(doc: Document, balise: string, classe: string, texte?: string): HTMLElement {
  const e = doc.createElement(balise);
  e.className = classe;
  if (texte !== undefined) e.textContent = texte;
  return e;
}

/** Le premier message du sujet, devant lequel le module se pose. */
function premierMessage(doc: Document): Element | null {
  return doc.querySelector('[class*="post--"]');
}

export type Dependances = {
  readonly doc: Document;
  readonly registre: LectureDuRegistre;
  readonly catalogue: Catalogue;
  /** Le brouillon de la réponse rapide, quand la page en a un.
   *
   *  **Absent est un cas normal et fréquent** : un visiteur déconnecté,
   *  un sujet verrouillé, un forum en lecture seule. Le module s'affiche
   *  quand même — il se lit —, simplement sans bouton de clôture. */
  readonly brouillon?: Brouillon | null;
};

/** Le bouton de clôture du module (règle 6 de la planche 45).
 *
 *  ── IL N'EST JAMAIS GRISÉ ────────────────────────────────────────────
 *
 *  Le `45-…` §7 l'interdit : « pas de bouton grisé quand il manque
 *  quelque chose : on explique ». Et le navigateur ne SAIT pas ce qui
 *  manque — il faudrait le sac, la place en boîte et le solde, que seul
 *  le joueur lui-même peut lire. C'est le serveur qui vérifie, et qui
 *  poste un refus en nommant ce qui manque (règle 7). Un bouton grisé
 *  mentirait deux fois : sur ce qu'il sait, et sur ce qui est possible.
 *
 *  ── IL NE POSTE RIEN ─────────────────────────────────────────────────
 *
 *  Il écrit `[cloture]` dans la réponse rapide et amène le joueur
 *  dessus. C'est le joueur qui envoie. La même fonction que le bouton de
 *  la barre, pour qu'ils ne puissent pas se contredire. */
function boutonDeCloture(doc: Document, brouillon: Brouillon): HTMLElement {
  const zone = element(doc, "div", "wm-bilan__cloture");
  const bouton = doc.createElement("button");
  bouton.type = "button";
  bouton.className = "wm-bilan__bouton";

  const note = element(doc, "p", "wm-bilan__cloture-note");

  const rafraichir = () => {
    const { demandee, libelle, note: texte } = etatDuBoutonDeCloture(
      clotureDemandee(brouillon.lire()),
    );
    bouton.textContent = libelle;
    bouton.setAttribute("aria-pressed", String(demandee));
    bouton.classList.toggle("wm-bilan__bouton--pose", demandee);
    note.textContent = texte;
  };

  bouton.addEventListener("click", () => {
    brouillon.ecrire(basculerLaCloture(brouillon.lire()));
    rafraichir();
    //  On amène le joueur à sa réponse : le module est en haut du sujet,
    //  le formulaire tout en bas. Sans ça, il clique et il ne voit rien
    //  se passer — ce serait le bouton le plus déroutant du forum.
    amenerAlaReponse(doc);
  });

  //  Le joueur peut effacer le mot à la main, ou cliquer sur le bouton de
  //  la barre : le nôtre doit suivre plutôt que de mentir.
  brouillon.surChangement(rafraichir);
  rafraichir();

  zone.appendChild(bouton);
  zone.appendChild(note);
  return zone;
}

/** Fait défiler jusqu'au formulaire de réponse, et y met le curseur.
 *
 *  Tout est enveloppé : `scrollIntoView` et `focus` n'existent pas dans
 *  tous les environnements de test, et un bouton qui lève après avoir
 *  correctement écrit le mot serait un comble. */
function amenerAlaReponse(doc: Document): void {
  const cible = doc.querySelector("#quick_reply") ??
    doc.querySelector("form[name=post]") ??
    doc.querySelector("#text_editor_textarea");
  try {
    (cible as HTMLElement | null)?.scrollIntoView?.({ block: "center" });
    doc.querySelector<HTMLTextAreaElement>("#text_editor_textarea")?.focus?.();
  } catch {
    //  Rien à faire : le mot est écrit, c'est l'essentiel.
  }
}

/**
 * Pose le module, et rend `true` s'il a été posé.
 *
 * Il ne se pose pas quand il n'y a rien à montrer : un sujet sans
 * registre n'a pas besoin d'un cadre vide au-dessus de son premier
 * message. Le joueur verra le module apparaître à sa première action,
 * ce qui est le bon moment pour le découvrir.
 */
export async function poserLeBilan(
  { doc, registre, catalogue, brouillon = null }: Dependances,
): Promise<boolean> {
  const sujetId = sujetDepuisAdresse(doc.location?.pathname ?? "");
  if (sujetId === null) return false;

  const ancre = premierMessage(doc);
  if (ancre === null) return false;

  const lignes = lignesDepuis(await registre.lignesDuSujet(sujetId));
  if (lignes.length === 0) return false;

  //  On ne demande que les noms qu'on va écrire. `aNommer` travaille sur
  //  le cumul de TOUS les joueurs : une seule requête d'objets pour le
  //  sujet entier, pas une par colonne.
  const tout = cumuler([...parJoueur(lignes).values()].flat());
  const quoi = aNommer(tout);
  const especes = new Map<number, string>();
  for (const id of quoi.especes) {
    const nom = await catalogue.nomEspece(id);
    if (nom !== null) especes.set(id, nom);
  }
  const objets = await registre.nomsDObjets(quoi.objets);

  const colonnes = colonnesDuBilan(lignes, pseudoParJoueur(lignes, lecteurDePseudos(doc)), {
    especes,
    objets,
  });
  if (colonnes.length === 0) return false;

  const module = element(doc, "section", "wm-bilan");
  module.setAttribute("aria-label", "Bilan du sujet");
  module.appendChild(element(doc, "h2", "wm-bilan__titre", "Bilan du sujet"));

  const grille = element(doc, "div", "wm-bilan__colonnes");
  for (const { ligne } of colonnes) {
    const colonne = element(doc, "article", "wm-bilan__colonne");
    colonne.appendChild(element(doc, "h3", "wm-bilan__pseudo", ligne.pseudo));

    const rubriques = rubriquesEnAttente(ligne);
    if (rubriques.length === 0) {
      //  Nommé mais rien à verser : on le dit, comme le fait le message
      //  posté. Une colonne vide ressemblerait à un bogue.
      colonne.appendChild(
        element(doc, "p", "wm-bilan__rien", "Rien à verser pour l'instant."),
      );
    } else {
      const liste = element(doc, "dl", "wm-bilan__rubriques");
      for (const { etiquette, valeur } of rubriques) {
        liste.appendChild(element(doc, "dt", "wm-bilan__etiquette", etiquette));
        liste.appendChild(element(doc, "dd", "wm-bilan__valeur", valeur));
      }
      colonne.appendChild(liste);
    }
    grille.appendChild(colonne);
  }
  module.appendChild(grille);

  //  La phrase qui empêche le malentendu le plus coûteux du projet.
  module.appendChild(element(
    doc,
    "p",
    "wm-bilan__note",
    "Rien n'est acquis tant que le sujet n'est pas clôturé.",
  ));

  //  Le bouton ferme le module : c'est la dernière chose qu'on lit, et
  //  c'est la seule qu'on puisse faire depuis ici.
  if (brouillon !== null) module.appendChild(boutonDeCloture(doc, brouillon));

  ancre.parentNode?.insertBefore(module, ancre);
  return true;
}
