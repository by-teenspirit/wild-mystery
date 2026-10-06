/// <reference lib="dom" />
/// <reference lib="dom.iterable" />
// ════════════════════════════════════════════════════════════════════
//  src/adaptateurs/navigateur/module-annexes.ts
//
//  Le sommaire des annexes, posé dans le trou que la page lui laisse.
//
//  ── CE QUE LA PAGE COLLÉE CONTIENT ──────────────────────────────────
//
//  Un seul nœud : `<nav class="wm-annexe__sommaire" data-wm-sommaire>`.
//  Rien d'autre. Les douze entrées, les intertitres, le pied et le
//  surlignage de la page courante viennent de `data/annexes.json` —
//  changer un titre est donc une modification d'un fichier, pas de douze
//  pages collées à la main.
//
//  ── UNE PAGE HTML FORUMACTIF NE REÇOIT PAS TOUJOURS NOTRE CODE ──────
//
//  Relevé le 6 octobre : les onze pages `/h1` à `/h12` en ligne sont
//  toutes créées **sans le header du forum**, et aucune ne charge donc ni
//  notre feuille ni notre script. Une annexe doit être créée avec
//  « utiliser le header et footer du forum » = OUI, sinon ce fichier ne
//  tourne jamais sur elle.
//
//  C'est pour ça que la page reste lisible sans lui : le texte est dans
//  la page, en vrai HTML. Sans sommaire, il manque une navigation, pas
//  le contenu.
//
//  ── ET IL NE S'EXÉCUTE QUE LÀ OÙ LE TROU EXISTE ─────────────────────
//
//  Pas de détection d'adresse, pas de liste de pages en dur : la porte
//  d'entrée est la présence du nœud. Callista peut créer une treizième
//  annexe sans qu'on touche au code.
// ════════════════════════════════════════════════════════════════════

import {
  type EntreeAffichee,
  type SectionAffichee,
  slugDepuisAdresse,
  sommaireAffiche,
  sommaireDepuis,
} from "../../navigateur/annexes.ts";

function element(doc: Document, balise: string, classe: string, texte?: string): HTMLElement {
  const e = doc.createElement(balise);
  e.className = classe;
  if (texte !== undefined) e.textContent = texte;
  return e;
}

/** Une entrée du sommaire.
 *
 *  **Trois états, et un seul est un lien.** La page courante n'en est pas
 *  un — un lien vers la page qu'on lit ne mène nulle part ; une page pas
 *  encore créée n'en est pas un non plus — ce serait un lien mort. Les
 *  deux sont rendues en `<span>`, et le style les distingue.
 *
 *  `aria-current="page"` sur l'entrée active : c'est la seule façon qu'un
 *  lecteur d'écran sache où il est dans la liste. */
function entreeEnDOM(doc: Document, e: EntreeAffichee): HTMLElement {
  const li = element(doc, "li", "wm-annexe__entree");
  if (e.active) li.classList.add("wm-annexe__entree--active");
  if (e.aVenir) li.classList.add("wm-annexe__entree--a-venir");

  const cliquable = !e.aVenir && !e.active;
  const corps = doc.createElement(cliquable ? "a" : "span");
  corps.className = "wm-annexe__lien";
  if (cliquable && e.adresse !== null) (corps as HTMLAnchorElement).href = e.adresse;
  if (e.active) corps.setAttribute("aria-current", "page");

  if (e.numero !== "") {
    corps.appendChild(element(doc, "span", "wm-annexe__numero", e.numero));
  }
  corps.appendChild(element(doc, "span", "wm-annexe__titre-entree", e.titre));
  //  « à venir » est écrit, pas seulement grisé : un gris ne se lit pas à
  //  haute voix, et il ne dit pas pourquoi l'entrée ne répond pas.
  if (e.aVenir) {
    corps.appendChild(element(doc, "span", "wm-annexe__a-venir", "à venir"));
  }

  li.appendChild(corps);
  return li;
}

function sectionEnDOM(doc: Document, s: SectionAffichee, premiere: boolean): HTMLElement {
  const bloc = element(doc, "div", "wm-annexe__section");
  //  L'intertitre de la PREMIÈRE section ne s'affiche pas : il doublerait
  //  l'en-tête « LES ANNEXES » du sommaire, juste au-dessus. Les suivants
  //  sont utiles — c'est eux qui séparent les pages de la région.
  if (s.titre !== "" && !premiere) {
    bloc.appendChild(element(doc, "p", "wm-annexe__intertitre", s.titre));
  }
  const liste = element(doc, "ul", "wm-annexe__liste");
  for (const e of s.entrees) liste.appendChild(entreeEnDOM(doc, e));
  bloc.appendChild(liste);
  return bloc;
}

export type Dependances = {
  readonly doc: Document;
  /** Le contenu de `data/annexes.json`, déjà décodé. */
  readonly donnees: unknown;
};

/**
 * Pose le sommaire, et rend `true` s'il a été posé.
 *
 * Les deux « non » sont normaux : une page sans le trou (tout le forum
 * sauf douze pages), et un fichier de données illisible.
 */
export function poserLeSommaire({ doc, donnees }: Dependances): boolean {
  const trou = doc.querySelector("[data-wm-sommaire]");
  if (trou === null) return false;

  const sections = sommaireAffiche(
    sommaireDepuis(donnees),
    slugDepuisAdresse(doc.location?.pathname ?? ""),
  );
  if (sections.length === 0) return false;

  //  On remplace ce que la page contenait : si quelqu'un y a laissé un
  //  sommaire à la main, c'est le fichier de données qui gagne — sinon
  //  il y en aurait deux.
  trou.textContent = "";

  const entete = element(doc, "div", "wm-annexe__entete");
  entete.appendChild(element(doc, "p", "wm-annexe__enseigne", "Les annexes"));
  trou.appendChild(entete);

  sections.forEach((s, i) => trou.appendChild(sectionEnDOM(doc, s, i === 0)));

  const pied = piedEnDOM(doc, donnees);
  if (pied !== null) trou.appendChild(pied);
  return true;
}

/** Le pied « Pour aller plus loin », s'il a au moins un lien.
 *
 *  Sans lien il ne s'affiche pas : un titre suivi de rien a l'air d'un
 *  bogue. Aujourd'hui il n'en porte qu'un — le bottin et les recherches
 *  de RP ne sont pas visibles depuis un compte déconnecté, et je ne
 *  devine pas une adresse que je n'ai pas mesurée. */
function piedEnDOM(doc: Document, donnees: unknown): HTMLElement | null {
  const { piedTitre, piedLiens } = sommaireDepuis(donnees);
  if (piedLiens.length === 0) return null;

  const pied = element(doc, "div", "wm-annexe__pied");
  if (piedTitre !== "") {
    pied.appendChild(element(doc, "p", "wm-annexe__intertitre", piedTitre));
  }
  const liste = element(doc, "ul", "wm-annexe__liste");
  for (const l of piedLiens) {
    const li = element(doc, "li", "wm-annexe__entree");
    const a = doc.createElement("a");
    a.className = "wm-annexe__lien";
    a.href = l.adresse;
    a.appendChild(element(doc, "span", "wm-annexe__titre-entree", l.titre));
    li.appendChild(a);
    liste.appendChild(li);
  }
  pied.appendChild(liste);
  return pied;
}
