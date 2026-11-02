/// <reference lib="dom" />
/// <reference lib="dom.iterable" />
// ════════════════════════════════════════════════════════════════════
//  src/adaptateurs/navigateur/module-annexes.ts
//
//  COUVERT PAR : outils/contraste.mjs — le sommaire posé sur chaque page collée, dans les deux thèmes.
//  (Garde-fou n° 22 : un module d'interface sans test unitaire doit dire
//   quel harnais le monte, et ce harnais doit tourner dans le CI.)
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

  //  « 01 · PAR OÙ COMMENCER » en UN SEUL texte, comme la maquette :
  //  numéro et titre séparés d'un point médian, pas deux colonnes. Avec
  //  deux colonnes, les titres longs se décalaient d'une ligne à l'autre
  //  et le sommaire perdait sa régularité.
  corps.appendChild(
    doc.createTextNode(e.numero === "" ? e.titre : `${e.numero} · ${e.titre}`),
  );
  //  « À VENIR » NE S'ÉCRIT PLUS, retiré le 1er novembre à la demande
  //  de Callista. J'avais défendu l'inverse — un gris ne se lit pas à
  //  haute voix, et il ne dit pas pourquoi l'entrée ne répond pas —
  //  mais le sommaire portait quatorze fois le même mot, et ce mot
  //  est plus long que la moitié des titres. L'entrée reste
  //  reconnaissable : elle est pâlie, et ce n'est PAS un lien, donc
  //  elle ne reçoit ni le focus ni le curseur de la main.

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
  //  Le cercle de 84 px en pointillés de la maquette : un repère de
  //  calage, en attendant le logo (planche 46). `aria-hidden` parce
  //  qu'un rond vide n'a rien à annoncer.
  const logo = element(doc, "div", "wm-annexe__logo");
  logo.setAttribute("aria-hidden", "true");
  entete.appendChild(logo);
  entete.appendChild(element(doc, "p", "wm-annexe__enseigne", "Les annexes"));
  trou.appendChild(entete);

  sections.forEach((s, i) => trou.appendChild(sectionEnDOM(doc, s, i === 0)));
  return true;
}

/**
 * Rebranche le bouton « Annexe suivante » sur une page qui existe.
 *
 * LE GÉNÉRATEUR L'ÉCRIT AU MOMENT DE LA CONSTRUCTION, donc avec les
 * adresses connues CE JOUR-LÀ. Tant qu'une page n'était pas créée, son
 * voisin pointait sur `#` — un bouton mort, et il fallait recoller la
 * page pour le réveiller. Relevé le 2 novembre : treize boutons sur
 * quatorze ne menaient nulle part.
 *
 * ON LE REFAIT DONC À L'AFFICHAGE, depuis le même fichier que le
 * sommaire. Remplir une adresse dans `data/annexes.json` et pousser
 * suffit alors : le sommaire ET le bouton se réveillent sur les
 * quatorze pages, sans en recoller une seule.
 *
 * IL SAUTE LES PAGES QUI N'EXISTENT PAS. Avec deux annexes en ligne,
 * « suivante » depuis la première doit mener à la seule autre, pas à la
 * deuxième du sommaire qui n'est pas encore née. Et s'il n'y en a
 * aucune, le bouton disparaît : un bouton qu'on ne peut pas suivre ment
 * sur l'état du forum.
 */
export function poserLaSuivante({ doc, donnees }: Dependances): boolean {
  const bouton = doc.querySelector("a.wm-suivante__bouton");
  if (bouton === null) return false;

  const sections = sommaireAffiche(
    sommaireDepuis(donnees),
    slugDepuisAdresse(doc.location?.pathname ?? ""),
  );
  const toutes = sections.flatMap((s) => s.entrees);
  const ici = toutes.findIndex((e) => e.active);
  if (ici === -1) return false;

  //  On tourne : la dernière annexe renvoie à la première.
  const suite = toutes
    .slice(ici + 1)
    .concat(toutes.slice(0, ici))
    .find((e) => e.adresse !== null && !e.aVenir);

  if (suite === undefined || suite.adresse === null) {
    bouton.remove();
    return false;
  }

  bouton.setAttribute("href", suite.adresse);
  //  L'étiquette reste, le titre change : la page suivante n'est plus
  //  forcément celle que le générateur avait écrite.
  const etiquette = bouton.querySelector(".wm-suivante__etiquette");
  bouton.textContent = "";
  if (etiquette !== null) bouton.appendChild(etiquette);
  bouton.appendChild(doc.createTextNode(` ${suite.titre} →`));
  return true;
}
