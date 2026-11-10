/// <reference lib="dom" />
// ════════════════════════════════════════════════════════════════════
//  src/adaptateurs/navigateur/module-equipe.ts
//
//  COUVERT PAR : outils/arenes.mjs — l'infobulle des cases d'équipe,
//  ouverte au survol des six cases d'un défi, dans la page réelle.
//
//  L'INFOBULLE D'UNE CASE D'ÉQUIPE, CONSTRUITE À L'AFFICHAGE.
//
//  ── POURQUOI ELLE N'EST PLUS DANS LA PAGE ──────────────────────────
//
//  Elle y était, écrite par `outils/annexe-arenes.py`. MESURÉ le
//  9 novembre : une case avec sa bulle pèse 1 021 caractères, sans
//  elle 413. L'annexe 06 en porte soixante-douze, et la page faisait
//  120 622 caractères sur les 128 000 que l'éditeur de Forumactif
//  accepte — AVANT d'ajouter les vingt-quatre pokémon du Conseil 4,
//  qui demandaient dix-neuf mille de plus. Le mur était atteint.
//
//  La page ne porte donc plus que CE QU'ELLE SEULE SAIT : les trois
//  chiffres du combat et les types, dans un attribut. Le reste — le
//  nom, le niveau — est déjà écrit en clair dans la case, et la
//  balise se reconstruit ici, identique à celle d'avant.
//
//  ── CE QUE ÇA COÛTE, ET POURQUOI ON L'ACCEPTE ──────────────────────
//
//  Sans JavaScript, plus d'infobulle. C'était le vrai argument contre,
//  et il tombe sur CETTE page-ci : les équipes vivent dans des
//  sous-onglets que `module-annexes.ts` ouvre, donc sans script on ne
//  les atteint déjà pas. On ne perd rien qu'on avait encore.
//
//  LES CARTES DE DRESSEUR COLLÉES DANS LES SUJETS NE CHANGENT PAS.
//  Elles portent leur infobulle en clair dans le message, et c'est la
//  bonne décision pour elles : un message est écrit une fois et doit
//  survivre à tout, y compris à un script qui ne se charge pas. Ce
//  module ne touche QUE les cases qui portent `data-wm-bulle`.
// ════════════════════════════════════════════════════════════════════

/** Les trois chiffres, dans l'ordre où la page les écrit. */
const CHIFFRES = ["PV", "Attaque", "Défense"] as const;

/** `eau:Eau;vol:Vol|34,23,14` → les types et les chiffres.
 *
 *  LE LIBELLÉ EST DANS L'ATTRIBUT, PAS DANS UNE TABLE ICI. Les dix-huit
 *  noms de type vivent déjà dans `outils/`, côté générateur ; les
 *  recopier ici ferait deux listes à garder d'accord, et le jour où
 *  l'une bouge sans l'autre, c'est une pastille qui ment. Quarante
 *  caractères par case suffisent à les porter.
 */
function lire(brut: string): { types: [string, string][]; chiffres: string[] } | null {
  const [gauche, droite] = brut.split("|");
  if (gauche === undefined || droite === undefined) return null;
  const types = gauche
    .split(";")
    .filter((t) => t.length > 0)
    .map((t) => {
      const [cle, nom] = t.split(":");
      return [cle ?? "", nom ?? cle ?? ""] as [string, string];
    });
  const chiffres = droite.split(",");
  if (chiffres.length !== CHIFFRES.length) return null;
  return { types, chiffres };
}

function elt(doc: Document, balise: string, classe: string, texte?: string): HTMLElement {
  const e = doc.createElement(balise);
  e.className = classe;
  if (texte !== undefined) e.textContent = texte;
  return e;
}

/** La bulle d'une case, à partir de ce que la case porte déjà. */
function construire(doc: Document, li: Element, brut: string): HTMLElement | null {
  const lu = lire(brut);
  if (lu === null) return null;
  const nom = li.querySelector(".wm-equipe__nom")?.textContent?.trim() ?? "";
  //  « niv. 9 » dans la case, « Niv. 9 » dans la bulle : c'est la
  //  casse de la planche 39, et la case est la seule source du
  //  niveau — on ne le réécrit pas dans l'attribut pour ça.
  const niveau = (li.querySelector(".wm-equipe__niveau")?.textContent ?? "")
    .trim()
    .replace(/^niv\./i, "Niv.");

  //  LA BULLE SUIT LA CASE. Un pokémon obscur se marque sur le `<li>`
  //  par le générateur ; la bulle n'a donc rien à lire de plus dans
  //  `data-wm-bulle`, dont le format ne bouge pas. Elle passe du vert
  //  au violet parce que la case le dit déjà.
  const obscur = li.classList.contains("wm-equipe__pkmn--obscur");
  const bulle = elt(
    doc,
    "div",
    obscur ? "wm-infobulle wm-infobulle--obscur" : "wm-infobulle",
  );
  bulle.setAttribute("role", "tooltip");

  const tete = elt(doc, "div", "wm-infobulle__tete");
  tete.append(
    elt(doc, "p", "wm-infobulle__nom", nom),
    elt(doc, "span", "wm-infobulle__niveau", niveau),
  );
  bulle.append(tete);

  if (lu.types.length > 0) {
    const liste = elt(doc, "ul", "wm-infobulle__types");
    for (const [cle, libelle] of lu.types) {
      //  `<li>` ET PAS `<span>` : la page écrivait des `span` dans un
      //  `ul`, ce qui n'est pas du HTML valide. La feuille vise la
      //  classe, pas la balise — on en profite pour la remettre
      //  droite au passage.
      const t = elt(doc, "li", "wm-infobulle__type", libelle);
      if (cle !== "") t.setAttribute("data-wm-type", cle);
      liste.append(t);
    }
    bulle.append(liste);
  }

  bulle.append(elt(doc, "p", "wm-infobulle__surtitre", "Statistiques"));
  const stats = elt(doc, "ul", "wm-infobulle__stats");
  for (const [i, mot] of CHIFFRES.entries()) {
    const ligne = elt(doc, "li", "wm-infobulle__stat");
    const g = doc.createElement("span");
    g.textContent = mot;
    const d = doc.createElement("span");
    d.textContent = lu.chiffres[i] ?? "";
    ligne.append(g, d);
    stats.append(ligne);
  }
  bulle.append(stats);
  return bulle;
}

/** Pose l'infobulle de chaque case qui porte ses données.
 *
 *  Renvoie le nombre de bulles posées — le harnais s'en sert, et un
 *  zéro inattendu se voit tout de suite.
 */
export function poserLesInfobulles(doc: Document): number {
  let posees = 0;
  for (const li of Array.from(doc.querySelectorAll("[data-wm-bulle]"))) {
    //  DEUX FOIS NE DOIT RIEN FAIRE. Le module peut être appelé après
    //  un ajout de contenu, et une seconde bulle dans la même case se
    //  superposerait à la première.
    if (li.querySelector(".wm-infobulle") !== null) continue;
    const bulle = construire(doc, li, li.getAttribute("data-wm-bulle") ?? "");
    if (bulle === null) continue;
    li.append(bulle);
    posees += 1;
  }
  return posees;
}
