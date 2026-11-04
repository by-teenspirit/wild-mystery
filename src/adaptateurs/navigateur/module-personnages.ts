/// <reference lib="dom" />
// ════════════════════════════════════════════════════════════════════
//  module-personnages.ts — la barre de filtres de l'annexe 11
//
//  COUVERT PAR : outils/personnages.mjs
//
//  Quatorze fiches dans une seule liste, et trois boutons qui la
//  trient : jouable, joué, PNJ. Ce qui décide est dans
//  `src/navigateur/personnages.ts` ; ici on ne fait que poser.
//
//  ── LA BARRE EST POSÉE PAR LE SCRIPT, PAS ÉCRITE DANS LA PAGE ─────
//
//  Même règle que les sous-onglets : sans JavaScript, les quatorze
//  fiches sont là, toutes visibles, en vrai HTML. Un filtre écrit dans
//  la page cacherait des fiches que rien ne pourrait plus rouvrir. Un
//  bouton n'a le droit de cacher que ce qu'il peut remontrer.
//
//  ── ET LES GIFS MORTS ─────────────────────────────────────────────
//
//  Les avatars sont des GIF hébergés chez des tiers, relevés dans le
//  sujet du forum : deux des six ne répondaient déjà plus le 4
//  novembre. Une image cassée dans une fiche est pire qu'une
//  silhouette, donc on retombe sur la silhouette au premier échec.
//  C'est fait ici et pas en CSS parce que le CSS ne sait pas qu'une
//  image a échoué.
// ════════════════════════════════════════════════════════════════════
import {
  type Choix,
  choixDuFragment,
  estUnStatut,
  filtresAProposer,
  motDuCompte,
  type Statut,
  visible,
} from "../../navigateur/personnages.ts";

const CLASSE_CACHEE = "wm-perso--filtree";

/**
 * Pose la barre de filtres sur chaque `[data-wm-filtres]` de la page.
 * Rend le nombre de barres posées — zéro sur les treize autres
 * annexes, qui n'ont pas de liste de personnages.
 */
export function poserLesFiltres(doc: Document): number {
  let poses = 0;

  for (const liste of Array.from(doc.querySelectorAll<HTMLElement>("[data-wm-filtres]"))) {
    const fiches = Array.from(
      liste.querySelectorAll<HTMLElement>("[data-wm-statut-fiche]"),
    );
    //  UNE FICHE DONT LE STATUT N'EST PAS UNE DES TROIS CLÉS est
    //  ignorée par le tri mais reste visible. Le contraire — la cacher
    //  — la rendrait introuvable sur une faute de frappe.
    const classees = fiches
      .map((f) => ({ el: f, statut: f.dataset.wmStatutFiche ?? "" }))
      .filter((f): f is { el: HTMLElement; statut: Statut } => estUnStatut(f.statut));

    const proposes = filtresAProposer(classees.map((f) => f.statut));
    if (proposes.length === 0) continue;

    const barre = doc.createElement("div");
    barre.className = "wm-filtres";
    barre.setAttribute("role", "group");
    barre.setAttribute("aria-label", "Filtrer par statut");

    //  L'ANNONCE EST LUE, PAS VUE. Sans elle, cliquer « Joué » au
    //  lecteur d'écran ne dit rien du tout : la liste change sous le
    //  curseur en silence.
    const annonce = doc.createElement("p");
    annonce.className = "wm-filtres__compte";
    annonce.setAttribute("role", "status");
    annonce.setAttribute("aria-live", "polite");

    const boutons = new Map<Choix, HTMLButtonElement>();
    const montrer = (choix: Choix): void => {
      let vues = 0;
      for (const f of classees) {
        const oui = visible(f.statut, choix);
        f.el.classList.toggle(CLASSE_CACHEE, !oui);
        f.el.hidden = !oui;
        if (oui) vues += 1;
      }
      for (const [k, b] of boutons) {
        const sien = k === choix;
        b.classList.toggle("wm-filtre--actif", sien);
        b.setAttribute("aria-pressed", String(sien));
      }
      annonce.textContent = motDuCompte(vues, choix);
    };

    for (const f of proposes) {
      const bouton = doc.createElement("button");
      bouton.type = "button";
      bouton.className = "wm-filtre";
      bouton.setAttribute("aria-pressed", "false");
      bouton.dataset.wmFiltre = f.cle;

      const mot = doc.createElement("span");
      mot.className = "wm-filtre__mot";
      mot.textContent = f.mot;
      const nombre = doc.createElement("span");
      nombre.className = "wm-filtre__nombre";
      nombre.textContent = String(f.nombre);
      bouton.append(mot, nombre);

      bouton.addEventListener("click", () => montrer(f.cle));
      boutons.set(f.cle, bouton);
      barre.appendChild(bouton);
    }

    liste.parentElement?.insertBefore(barre, liste);
    liste.parentElement?.insertBefore(annonce, liste);

    //  L'ADRESSE PEUT OUVRIR SUR UN FILTRE (`…#jouable`), ce qui donne
    //  un lien à coller dans un sujet de recrutement. Les sous-onglets
    //  lisent le même fragment : `choixDuFragment` rend `null` sur un
    //  fragment qui n'est pas un des leurs, donc les deux cohabitent.
    const voulu = choixDuFragment(globalThis.location?.hash ?? "", proposes);
    montrer(voulu ?? "tous");

    liste.classList.add("wm-persos--filtrable");
    poses += 1;
  }

  //  Les avatars morts, une fois la barre posée ou non.
  rattraperLesAvatars(doc);
  return poses;
}

/**
 * Remplace par la silhouette tout avatar qui n'a pas chargé. Rend le
 * nombre d'images surveillées.
 */
export function rattraperLesAvatars(doc: Document): number {
  const images = Array.from(doc.querySelectorAll<HTMLImageElement>("img.wm-perso__avatar"));
  for (const img of images) {
    const retomber = (): void => {
      const vide = doc.createElement("span");
      vide.className = "wm-perso__avatar wm-perso__avatar--vide";
      vide.setAttribute("aria-hidden", "true");
      img.replaceWith(vide);
    };
    //  DEUX CHEMINS, parce que l'image peut avoir déjà échoué avant
    //  que ce script tourne : `complete` avec une largeur nulle, c'est
    //  une image morte, et aucun `error` ne viendra plus.
    if (img.complete && img.naturalWidth === 0) retomber();
    else img.addEventListener("error", retomber, { once: true });
  }
  return images.length;
}
