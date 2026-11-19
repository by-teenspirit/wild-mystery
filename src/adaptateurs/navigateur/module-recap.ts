/// <reference lib="dom" />
// ════════════════════════════════════════════════════════════════════
//  src/adaptateurs/navigateur/module-recap.ts
//
//  COUVERT PAR : outils/sujet.mjs — le récapitulatif se pose dans une
//  zone, montre l'équipe et le combat, et ne se pose pas ailleurs.
//
//  Le récapitulatif latéral : « le bilan du sujet qui nous suit, en
//  petit récap à droite ou à gauche, en vertical, pour savoir où on
//  en est, en tout temps ».
//
//  ── IL EST FIXE, PAS COLLANT ────────────────────────────────────────
//
//  `position: sticky` aurait demandé de mettre les messages et le
//  récapitulatif dans une même rangée — donc de toucher à la
//  structure de la page d'un sujet, qui est posée depuis le
//  30 octobre et que personne n'a demandé de changer.
//
//  `position: fixed` ne touche à rien : le récapitulatif flotte
//  au-dessus, à droite, et la page reste exactement ce qu'elle était.
//
//  ── MAIS IL EST ACCROCHÉ AUX MESSAGES ───────────────────────────────
//
//  « Pas besoin de mesurer l'écran, tu l'accroches à ça » — 18
//  novembre, le code d'un sujet à l'appui. Le panneau est donc placé
//  d'après le bord droit de la colonne des messages, relevé dans la
//  page, et pas d'après la largeur de la fenêtre.
//
//  C'EST LE CSS QUI PERDAIT : une requête de média ne connaît que
//  l'écran, et la largeur du forum y était recopiée en dur. Ici, le
//  placement est mesuré sur la page réelle, et il se reprend à chaque
//  changement de taille. Le CSS ne garde que l'apparence.
//
//  IL NE SE POSE PAS S'IL N'Y A PAS LA PLACE : sur un portable, il
//  couvrirait les messages au lieu de les accompagner.
//
//  ── IL SE REFAIT, IL NE SE MET PAS À JOUR ───────────────────────────
//
//  « À chaque fois qu'une action est faite. » Une action produit un
//  message, donc un rechargement de page : le récapitulatif se refait
//  alors tout seul. Entre deux, il se refait AU RETOUR SUR L'ONGLET —
//  c'est le moment exact où le joueur revient voir si le Maître du Jeu
//  a répondu.
//
//  PAS DE SONDAGE RÉGULIER : une requête toutes les trente secondes
//  sur chaque sujet de zone ouvert, pour une page qui ne change que
//  toutes les cinq minutes au mieux, coûterait cent fois ce qu'elle
//  rapporte.
// ════════════════════════════════════════════════════════════════════

import {
  type BlocDuRecap,
  blocsDuRecap,
  etatDePv,
  etatDuRecap,
  type MembreDuRecap,
  type MonSujet,
  nomDuMembre,
  partDePv,
} from "../../navigateur/recap.ts";
import type { LigneEnAttente } from "../../application/bilan.ts";

export type Decor = {
  /** La racine du dépôt, pour les sprites. `null` quand on ne la
   *  connaît pas : les cases se dessinent sans image, et c'est mieux
   *  qu'une image cassée. */
  readonly depot: string | null;
};

function element(
  doc: Document,
  balise: string,
  classe: string,
  texte?: string,
): HTMLElement {
  const e = doc.createElement(balise);
  e.className = classe;
  if (texte !== undefined) e.textContent = texte;
  return e;
}

/** L'adresse du sprite figé d'une espèce.
 *
 *  LE MÊME CHEMIN QUE LES MESSAGES DU MAÎTRE DU JEU, et c'est voulu :
 *  un Pokémon doit avoir la même image dans le récapitulatif et dans
 *  la fiche de combat qui le montre deux lignes plus bas. */
function adresseDuSprite(depot: string | null, especeId: number): string | null {
  if (depot === null || !Number.isInteger(especeId) || especeId <= 0) return null;
  const base = depot.endsWith("/") ? depot : `${depot}/`;
  return `${base}assets/sprites-figes/forum/${especeId}.png`;
}

function sprite(
  doc: Document,
  decor: Decor,
  especeId: number,
  classe: string,
): HTMLElement {
  const adresse = adresseDuSprite(decor.depot, especeId);
  if (adresse === null) return element(doc, "span", classe);
  const img = doc.createElement("img");
  img.className = classe;
  img.src = adresse;
  img.alt = "";
  img.loading = "lazy";
  return img;
}

/** La jauge de PV, avec son état en attribut.
 *
 *  L'ÉTAT EST UN ATTRIBUT ET PAS UNE CLASSE DE PLUS : le CSS le lit
 *  par `[data-wm-pv]`, et un relevé peut le vérifier sans connaître le
 *  nom des quatre classes. */
function jauge(doc: Document, pv: number, pvMax: number): HTMLElement {
  const boite = element(doc, "span", "wm-recap__jauge");
  boite.dataset.wmPv = etatDePv(pv, pvMax);
  const barre = element(doc, "span", "wm-recap__barre");
  barre.style.width = `${partDePv(pv, pvMax)}%`;
  boite.appendChild(barre);
  return boite;
}

function ligneDUnMembre(
  doc: Document,
  decor: Decor,
  m: MembreDuRecap,
  seBat: boolean,
): HTMLElement {
  const li = element(doc, "li", "wm-recap__membre");
  if (seBat) {
    li.classList.add("wm-recap__membre--combat");
    //  CELUI QUI SE BAT EST DIT, pas seulement teinté : une couleur
    //  seule ne se lit pas pour tout le monde.
    li.setAttribute("aria-current", "true");
  }
  li.appendChild(sprite(doc, decor, m.especeId, "wm-recap__sprite"));

  const texte = element(doc, "span", "wm-recap__texte");
  texte.appendChild(element(doc, "span", "wm-recap__nom", nomDuMembre(m)));
  texte.appendChild(jauge(doc, m.pv, m.pvMax));
  texte.appendChild(
    element(doc, "span", "wm-recap__pv", `${m.pv}/${m.pvMax} PV`),
  );
  li.appendChild(texte);
  return li;
}

function bloc(doc: Document, titre: string): HTMLElement {
  const section = element(doc, "section", "wm-recap__bloc");
  section.appendChild(element(doc, "h3", "wm-recap__titre", titre));
  return section;
}

function dessinerUnBloc(doc: Document, decor: Decor, b: BlocDuRecap): HTMLElement {
  //  LE CARNET NON RELIÉ, dit ici plutôt que tu par une absence. Même
  //  texte et même sortie que le bloc d'erreur de la barre d'actions :
  //  deux formulations pour un même blocage en feraient deux blocages
  //  dans la tête du joueur.
  if (b.quoi === "carnet") {
    const section = bloc(doc, "Carnet non relié");
    section.classList.add("wm-recap__bloc--alerte");
    section.appendChild(element(
      doc,
      "p",
      "wm-recap__alerte-texte",
      "Ton équipe, ton sac et ton combat se lisent dans ton carnet, et il " +
        "n'est pas relié à ce navigateur. Relie-le pour les voir ici.",
    ));
    const lien = doc.createElement("a");
    lien.className = "wm-recap__alerte-lien";
    lien.href = "/h17-mon-carnet";
    lien.textContent = "Relier mon carnet";
    section.appendChild(lien);
    return section;
  }

  if (b.quoi === "combat") {
    const section = bloc(doc, `Combat · tour ${b.combat.tour}`);
    const liste = element(doc, "ul", "wm-recap__liste");
    const s = b.combat.sauvage;
    liste.appendChild(ligneDUnMembre(doc, decor, {
      position: null,
      especeId: s.especeId,
      nom: s.nom,
      surnom: null,
      niveau: s.niveau,
      pv: s.pv,
      pvMax: s.pvMax,
      combat: false,
    }, false));
    section.appendChild(liste);
    return section;
  }

  if (b.quoi === "equipe") {
    const section = bloc(doc, "Mon équipe");
    const liste = element(doc, "ul", "wm-recap__liste");
    //  QUI SE BAT EST MARQUÉ, et c'est la base qui le dit — on ne le
    //  devine pas depuis les PV, qui peuvent coïncider.
    for (const m of b.equipe) liste.appendChild(ligneDUnMembre(doc, decor, m, m.combat));
    section.appendChild(liste);
    return section;
  }

  //  ── LE SAC, RANGÉ PAR ÉTAGÈRE ──────────────────────────────────
  //
  //  « Afficher le sac de la personne pour savoir ce qu'elle a, à
  //  l'instant T » — 18 novembre.
  //
  //  PAS DE VIGNETTES. Le carnet en pose, parce qu'il a la place et
  //  qu'on y vient pour regarder son sac. Ici le panneau fait 216 px
  //  et le sac est la troisième chose qu'on lit : une colonne
  //  d'images coûterait une requête par objet et pousserait les
  //  gains hors de l'écran.
  //
  //  LES TITRES D'ÉTAGÈRE SONT CEUX DU CARNET — « Pour attraper »,
  //  « Pour soigner » —, et c'est `sacDuRecap` qui les tient : deux
  //  listes de familles finiraient par ne plus dire la même chose.
  if (b.quoi === "sac") {
    const section = bloc(doc, "Mon sac");
    for (const etagere of b.sections) {
      section.appendChild(
        element(doc, "p", "wm-recap__etagere", etagere.titre),
      );
      const liste = element(doc, "ul", "wm-recap__objets");
      for (const ligne of etagere.lignes) {
        const li = element(doc, "li", "wm-recap__objet");
        li.appendChild(element(doc, "span", "wm-recap__objet-nom", ligne.nom));
        //  LA QUANTITÉ EST ÉCRITE « × 4 », comme dans le carnet et
        //  comme dans le bilan posté. Trois façons de dire quatre
        //  objets, c'est trois fois la même chose à relire.
        li.appendChild(
          element(doc, "span", "wm-recap__objet-quantite", `× ${ligne.quantite}`),
        );
        liste.appendChild(li);
      }
      section.appendChild(liste);
    }
    return section;
  }

  const section = bloc(doc, "Ce que ce sujet t'a rapporté");
  const liste = element(doc, "dl", "wm-recap__rubriques");
  for (const { etiquette, valeur } of b.rubriques) {
    liste.appendChild(element(doc, "dt", "wm-recap__etiquette", etiquette));
    liste.appendChild(element(doc, "dd", "wm-recap__valeur", valeur));
  }
  section.appendChild(liste);
  return section;
}

/*  LA COLONNE DES MESSAGES, dans l'ordre où on la cherche.
 *
 *  `.post` D'ABORD, parce que c'est littéralement « l'affichage des
 *  messages » : c'est ce bloc-là que le joueur lit, et c'est son bord
 *  droit qu'on longe. Les deux autres sont des filets, pour une page
 *  de sujet vide ou un gabarit qu'on n'a pas encore vu. */
const ANCRES = [".post", ".wm-sujet__section", "#page-body .wrap"];

/** Le bord droit de la colonne des messages, ou `null`.
 *
 *  LE PLUS À DROITE DES MESSAGES, et pas le premier : un message cité
 *  ou un module posé au-dessus peut être plus étroit, et un panneau
 *  aligné sur lui mordrait sur les autres. */
export function bordDesMessages(doc: Document): number | null {
  for (const quoi of ANCRES) {
    const trouves = [...doc.querySelectorAll(quoi)];
    if (trouves.length === 0) continue;
    const droite = Math.max(...trouves.map((e) => e.getBoundingClientRect().right));
    if (Number.isFinite(droite) && droite > 0) return droite;
  }
  return null;
}

const LARGEUR = 216;
const ECART = 16;

/** Place le panneau le long des messages, ou le cache faute de place.
 *
 *  LE `left` EST ÉCRIT EN STYLE DIRECT parce que c'est une mesure, pas
 *  une décision de charte : le CSS ne peut pas connaître le bord d'un
 *  élément. `data-wm-pose` dit l'autre moitié — c'est lui que le CSS
 *  lit pour afficher ou non. */
const CLE_OUVERT = "wm.recap.ouvert";

/** Ce que la personne a choisi la dernière fois, ou `null`.
 *
 *  ENVELOPPÉ, PARCE QUE `localStorage` LÈVE. En navigation privée, ou
 *  quand les données de site sont bloquées, le simple fait de le lire
 *  jette — et une préférence d'affichage ne doit pas empêcher le
 *  panneau d'exister. */
export function choixGarde(): boolean | null {
  try {
    const v = localStorage.getItem(CLE_OUVERT);
    return v === null ? null : v === "oui";
  } catch {
    return null;
  }
}

function garderLeChoix(ouvert: boolean): void {
  try {
    localStorage.setItem(CLE_OUVERT, ouvert ? "oui" : "non");
  } catch { /* tant pis : le choix ne survivra pas au rechargement */ }
}

/** Place le panneau et dit s'il est ouvert.
 *
 *  IL EXISTE TOUJOURS DÉSORMAIS. Avant, faute de place, il ne se
 *  posait pas du tout — sur un forum de 1 200 px, il fallait 1 696 px
 *  de fenêtre, et sur un portable de 1 440 personne ne l'a jamais vu.
 *  Il se replie maintenant contre le bord, languette dehors. */
export function ancrerLeRecap(doc: Document, aside: HTMLElement): boolean {
  const bord = bordDesMessages(doc);
  const e = etatDuRecap(
    bord === null ? null : { droite: bord },
    doc.documentElement.clientWidth,
    LARGEUR,
    ECART,
    choixGarde(),
  );
  aside.dataset.wmPose = "oui";
  aside.dataset.wmContre = e.contre;
  aside.dataset.wmOuvert = e.ouvert ? "oui" : "non";
  if (e.contre === "messages") aside.style.left = `${e.gauche}px`;
  else aside.style.removeProperty("left");
  const languette = aside.querySelector<HTMLButtonElement>(".wm-recap__languette");
  languette?.setAttribute("aria-expanded", String(e.ouvert));
  return e.ouvert;
}

export type DependancesDuRecap = {
  readonly doc: Document;
  readonly decor: Decor;
  /** Relit la base. Appelée au chargement, puis au retour sur
   *  l'onglet. */
  readonly lire: () => Promise<{ sujet: MonSujet | null; mien: LigneEnAttente | null }>;
};

const ID = "wm-recap";

/** Pose — ou repose — le récapitulatif. Rend `true` s'il est à
 *  l'écran.
 *
 *  IL SE RETIRE QUAND IL N'A PLUS RIEN À DIRE, au lieu de rester en
 *  cadre vide : un sujet dont la clôture a tout versé n'a plus de
 *  récapitulatif à montrer. */
export async function poserLeRecap(d: DependancesDuRecap): Promise<boolean> {
  const { doc, decor } = d;
  const { sujet, mien } = await d.lire();
  const blocs = blocsDuRecap(sujet, mien);

  const ancien = doc.getElementById(ID);
  if (blocs.length === 0) {
    ancien?.remove();
    return false;
  }

  const aside = element(doc, "aside", "wm-recap");
  aside.id = ID;
  aside.setAttribute("aria-label", "Où j'en suis dans ce sujet");

  //  ── LA LANGUETTE ──────────────────────────────────────────────
  //
  //  UN VRAI BOUTON, et pas une étiquette cliquable : il se prend au
  //  clavier, il s'annonce aux lecteurs d'écran, et `aria-expanded`
  //  dit dans quel sens il va.
  const languette = doc.createElement("button");
  languette.type = "button";
  languette.className = "wm-recap__languette";
  languette.textContent = "Où j'en suis";
  languette.setAttribute("aria-expanded", "false");
  languette.setAttribute("aria-controls", `${ID}-panneau`);
  languette.addEventListener("click", () => {
    const ouvert = aside.dataset.wmOuvert !== "oui";
    aside.dataset.wmOuvert = ouvert ? "oui" : "non";
    languette.setAttribute("aria-expanded", String(ouvert));
    garderLeChoix(ouvert);
  });
  aside.appendChild(languette);

  //  LE CONTENU EST DANS SA PROPRE BOÎTE : c'est elle qui glisse, la
  //  languette ne bouge pas avec.
  const panneau = element(doc, "div", "wm-recap__panneau");
  panneau.id = `${ID}-panneau`;
  for (const b of blocs) panneau.appendChild(dessinerUnBloc(doc, decor, b));
  aside.appendChild(panneau);

  if (ancien === null) doc.body.appendChild(aside);
  else ancien.replaceWith(aside);
  //  ON MESURE APRÈS L'AVOIR POSÉ : avant, il n'est pas dans la page
  //  et les messages n'ont pas encore la largeur qu'ils auront.
  ancrerLeRecap(doc, aside);
  return true;
}

/** Pose le récapitulatif, et le repose au retour sur l'onglet.
 *
 *  `visibilitychange` ET PAS UN MINUTEUR : c'est le moment exact où le
 *  joueur revient voir si le Maître du Jeu a répondu, et un onglet en
 *  arrière-plan ne doit rien demander. */
export function suivreLeRecap(d: DependancesDuRecap): void {
  void poserLeRecap(d);
  d.doc.addEventListener("visibilitychange", () => {
    if (d.doc.visibilityState === "visible") void poserLeRecap(d);
  });
  //  ── ET IL SE REPLACE QUAND LA FENÊTRE CHANGE DE TAILLE ──────────
  //
  //  Sans ça, il resterait là où les messages étaient : fenêtre
  //  rétrécie, il leur passerait dessus. ON NE RELIT PAS LA BASE pour
  //  autant — c'est une mesure, pas une nouvelle donnée.
  const fenetre = d.doc.defaultView;
  if (fenetre === null) return;
  fenetre.addEventListener("resize", () => {
    const aside = d.doc.getElementById(ID);
    if (aside !== null) ancrerLeRecap(d.doc, aside);
  });
}
