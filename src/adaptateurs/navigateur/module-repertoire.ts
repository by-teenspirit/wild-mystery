/// <reference lib="dom" />
// ════════════════════════════════════════════════════════════════════
//  module-repertoire.ts — la barre de filtres du répertoire
//
//  COUVERT PAR : outils/repertoire.mjs
//
//  Les cartes sont déjà dans la page, écrites par
//  `outils/repertoire.py`. Ce module n'ajoute QUE la barre, et ce qui
//  décide est dans `src/navigateur/repertoire.ts`.
//
//  ── UN BOUTON NE CACHE QUE CE QU'IL PEUT REMONTRER ────────────────
//
//  Même règle que l'annexe 11 : sans JavaScript, tous les personnages
//  sont là, en vrai HTML. Si la barre était écrite dans la page, un
//  filtre posé masquerait des cartes que rien ne pourrait plus
//  rouvrir. Elle est donc posée par le script, et seulement par lui.
//
//  ── POURQUOI DES `select` ET PAS DES BOUTONS ──────────────────────
//
//  L'annexe 11 filtre trois statuts : trois boutons, tout se voit.
//  Ici, chaque menu peut compter dix-sept valeurs — les lieux de vie
//  suivent les zones de Rhode — et trois rangées de dix-sept boutons
//  prendraient plus de place que les cartes. Un `select` natif tient
//  en une ligne, se navigue au clavier sans rien écrire, et sur
//  téléphone ouvre la roue du système.
//
//  ── LES AVATARS MORTS ─────────────────────────────────────────────
//
//  Les images sont hébergées chez des tiers et meurent. Une image
//  cassée dans une grille est pire qu'un cadre vide : on retombe sur
//  le cadre au premier échec, comme l'annexe 11 le fait avec sa
//  silhouette. Le CSS ne peut pas le faire — il ne sait pas qu'une
//  image a échoué.
// ════════════════════════════════════════════════════════════════════
import {
  type Choix,
  type Colonne,
  compte,
  estUneColonne,
  type Fiche,
  menusAProposer,
  retenue,
} from "../../navigateur/repertoire.ts";

const CACHEE = "wm-repertoire__carte--filtree";

/** Ce qu'une carte porte, relu dans ses attributs.
 *
 *  LE TEXTE CHERCHABLE EST PRÉPARÉ À LA GÉNÉRATION, pas recomposé à
 *  chaque frappe : sur cent cartes, refaire cent `textContent` à
 *  chaque touche se sent. */
function ficheDe(el: HTMLElement): Fiche {
  return {
    groupe: el.dataset.wmGroupe ?? "",
    lieu: el.dataset.wmLieu ?? "",
    origine: el.dataset.wmOrigine ?? "",
    statut: el.dataset.wmStatut ?? "",
    cherche: el.dataset.wmCherche ?? "",
  };
}

function elt(doc: Document, balise: string, classe: string, texte?: string): HTMLElement {
  const e = doc.createElement(balise);
  e.className = classe;
  if (texte !== undefined) e.textContent = texte;
  return e;
}

/**
 * Remplace les cartes et les bottins collés par la version servie.
 *
 * ── POURQUOI LA PAGE NE SE RECOLLE PLUS ───────────────────────────
 *
 * « On pourrait avoir plusieurs personnes à valider par semaine »,
 * 13 novembre. Jusque-là, ajouter un personnage demandait de
 * régénérer la page et de la recoller dans le panneau — tenable pour
 * une annexe qu'on écrit une fois, intenable pour une liste qui
 * grandit toutes les semaines.
 *
 * `outils/repertoire.py` écrit donc, en plus de la page, le MÊME
 * contenu dans `data/repertoire-contenu.json`, servi par Pages. Un
 * `git push` suffit.
 *
 * CE N'EST PAS UNE SECONDE SOURCE : les deux sortent du même gabarit,
 * dans la même fonction, au même instant. Ce qui est collé est la
 * photo du jour du collage ; ce qui est servi est la version
 * d'aujourd'hui. Sans script, sans réseau, ou si Pages répond autre
 * chose que ce qu'on attend, on lit la photo — jamais une page
 * blanche, et c'est tout l'intérêt d'avoir gardé les cartes en dur.
 *
 * Rend vrai si quelque chose a été remplacé.
 */
export function remplacerLeRepertoire(doc: Document, contenu: unknown): boolean {
  const o = typeof contenu === "object" && contenu !== null
    ? contenu as Record<string, unknown>
    : null;
  if (o === null) return false;
  let change = false;
  //  ON NE REMPLACE QUE CE QU'ON RETROUVE, et seulement par du texte :
  //  un champ absent ou d'un autre type laisse la page tranquille
  //  plutôt que d'effacer une grille contre « undefined ».
  for (
    const [cle, ou] of [
      ["grille", "[data-wm-repertoire]"],
      ["bottins", ".wm-bottins"],
    ] as const
  ) {
    const neuf = o[cle];
    const vieux = doc.querySelector(ou);
    if (typeof neuf !== "string" || neuf === "" || vieux === null) continue;
    //  ── IDENTIQUE, ON NE TOUCHE À RIEN ──────────────────────────
    //
    //  Le cas courant est que la page collée soit déjà à jour, et
    //  remplacer ferait repartir le défilement et perdre le focus
    //  pour rien.
    //
    //  ON COMPARE DES EMPREINTES, PAS DES HTML. Comparer les deux
    //  textes ne marche pas : quand ce code tourne, le script a déjà
    //  travaillé la page — barre d'onglets posée dans la colonne,
    //  sections masquées, attributs `aria` ajoutés — donc son
    //  `outerHTML` ne ressemble plus à ce qui a été collé, et TOUT
    //  était remplacé à chaque chargement. Le générateur écrit la
    //  même empreinte des deux côtés, calculée sur le fragment tel
    //  qu'il sort de lui.
    const avant = vieux.getAttribute("data-wm-empreinte");
    const apres = neuf.match(/data-wm-empreinte="([a-f0-9]+)"/)?.[1] ?? null;
    if (avant !== null && apres !== null && avant === apres) continue;
    vieux.outerHTML = neuf;
    change = true;
  }
  return change;
}

/**
 * Pose la barre sur chaque `[data-wm-repertoire]` de la page. Rend le
 * nombre de barres posées — zéro partout ailleurs sur le forum.
 */
export function poserLeRepertoire(doc: Document): number {
  let poses = 0;

  for (
    const grille of Array.from(
      doc.querySelectorAll<HTMLElement>("[data-wm-repertoire]"),
    )
  ) {
    const cartes = Array.from(
      grille.querySelectorAll<HTMLElement>("[data-wm-cherche]"),
    );
    //  UNE GRILLE VIDE N'A RIEN À FILTRER. Le jour où le fichier est
    //  encore vide, la page dit déjà qu'elle attend des fiches : une
    //  barre au-dessus de rien serait du mobilier.
    if (cartes.length === 0) continue;
    const fiches = cartes.map(ficheDe);

    const barre = elt(doc, "form", "wm-repertoire__barre");
    //  UN `form` POUR LA TOUCHE ÉCHAP ET LE BOUTON « effacer » du
    //  champ `search`, que les navigateurs ne donnent qu'ici. Il ne
    //  part jamais : `submit` est retenu.
    barre.addEventListener("submit", (e) => e.preventDefault());
    barre.setAttribute("aria-label", "Filtrer les personnages");

    const annonce = elt(doc, "p", "wm-repertoire__compte");
    //  L'ANNONCE EST LUE, PAS SEULEMENT VUE : sans elle, filtrer au
    //  lecteur d'écran change la page en silence.
    annonce.setAttribute("role", "status");
    annonce.setAttribute("aria-live", "polite");

    const choix: { recherche: string; menus: Map<Colonne, string> } = {
      recherche: "",
      menus: new Map(),
    };

    const montrer = (): void => {
      let vues = 0;
      for (const [i, carte] of cartes.entries()) {
        const oui = retenue(fiches[i], choix as Choix);
        carte.classList.toggle(CACHEE, !oui);
        //  `hidden` ET LA CLASSE : la classe pour la feuille, et
        //  `hidden` pour que la carte sorte aussi de la tabulation et
        //  de la recherche du navigateur.
        carte.hidden = !oui;
        if (oui) vues += 1;
      }
      annonce.textContent = compte(vues, cartes.length);
      grille.classList.toggle("wm-repertoire__grille--vide", vues === 0);
    };

    // ── le champ de recherche ──────────────────────────────────────
    const champ = doc.createElement("label");
    champ.className = "wm-repertoire__champ";
    const etiquette = elt(doc, "span", "wm-repertoire__etiquette", "Rechercher");
    const saisie = doc.createElement("input");
    //  `type="search"`, pas `text` : la croix d'effacement et la
    //  touche Échap viennent avec, et on n'a rien à dessiner.
    saisie.type = "search";
    saisie.className = "wm-repertoire__saisie";
    saisie.placeholder = "un nom, un métier, un avatar…";
    saisie.autocomplete = "off";
    saisie.addEventListener("input", () => {
      choix.recherche = saisie.value;
      montrer();
    });
    champ.append(etiquette, saisie);
    barre.appendChild(champ);

    // ── les menus ──────────────────────────────────────────────────
    for (const menu of menusAProposer(fiches)) {
      const bloc = doc.createElement("label");
      bloc.className = "wm-repertoire__champ";
      bloc.appendChild(
        elt(doc, "span", "wm-repertoire__etiquette", menu.mot),
      );
      const select = doc.createElement("select");
      select.className = "wm-repertoire__menu";
      select.dataset.wmColonne = menu.colonne;

      //  « TOUS » EST UNE VALEUR VIDE, et c'est ce que `retenue`
      //  attend : un menu rendu à « Tous » ne filtre plus rien, il ne
      //  cherche pas les cartes dont le champ est vide.
      const tous = doc.createElement("option");
      tous.value = "";
      tous.textContent = "Tous";
      select.appendChild(tous);
      for (const c of menu.choix) {
        const o = doc.createElement("option");
        o.value = c;
        o.textContent = c;
        select.appendChild(o);
      }
      select.addEventListener("change", () => {
        const col = select.dataset.wmColonne ?? "";
        if (estUneColonne(col)) choix.menus.set(col, select.value);
        montrer();
      });
      bloc.append(select);
      barre.appendChild(bloc);
    }

    // ── le bouton qui rend la page entière ─────────────────────────
    //
    //  TROIS MENUS ET UN CHAMP SE REMETTENT À ZÉRO EN QUATRE GESTES.
    //  Celui-ci le fait en un, et c'est le geste qu'on cherche quand
    //  un filtre ne rend rien.
    const vider = doc.createElement("button");
    vider.type = "reset";
    vider.className = "wm-repertoire__vider";
    vider.textContent = "Tout afficher";
    vider.addEventListener("click", () => {
      //  Le `reset` natif remet les champs APRÈS cet écouteur : on
      //  remet donc l'état nous-mêmes, et le navigateur remettra les
      //  valeurs visibles dans la foulée.
      choix.recherche = "";
      choix.menus.clear();
      queueMicrotask(montrer);
    });
    barre.appendChild(vider);

    grille.parentElement?.insertBefore(barre, grille);
    grille.parentElement?.insertBefore(annonce, grille);
    grille.classList.add("wm-repertoire__grille--filtrable");
    montrer();
    poses += 1;
  }

  rattraperLesPortraits(doc);
  return poses;
}

/**
 * Remplace par un cadre vide tout portrait qui n'a pas chargé. Rend le
 * nombre d'images surveillées.
 */
export function rattraperLesPortraits(doc: Document): number {
  const images = Array.from(
    doc.querySelectorAll<HTMLImageElement>("img.wm-repertoire__portrait"),
  );
  for (const img of images) {
    const retomber = (): void => {
      const vide = elt(doc, "span", "wm-repertoire__portrait wm-repertoire__portrait--vide");
      vide.setAttribute("aria-hidden", "true");
      img.replaceWith(vide);
    };
    //  DEUX CHEMINS : l'image peut avoir déjà échoué avant que ce
    //  script tourne — `complete` avec une largeur nulle — et aucun
    //  `error` ne viendra plus.
    if (img.complete && img.naturalWidth === 0) retomber();
    else img.addEventListener("error", retomber, { once: true });
  }
  return images.length;
}
