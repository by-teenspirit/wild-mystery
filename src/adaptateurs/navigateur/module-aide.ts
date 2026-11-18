/// <reference lib="dom" />
// ════════════════════════════════════════════════════════════════════
//  src/adaptateurs/navigateur/module-aide.ts
//
//  COUVERT PAR : outils/carnet.mjs — une aide par page, repliée au
//  départ, qui s'ouvre, qui se ferme, et qui porte sa capture.
//
//  L'AIDE DE CHAQUE PAGE DU CARNET.
//
//  « Sur chaque page du carnet de bord, tu vas mettre une petite aide
//  accessible quelque part qui explique l'utilité de chaque page et
//  comment l'utiliser, avec des captures d'écran. » — 18 novembre.
//
//  ── REPLIÉE, ET PAS CACHÉE ──────────────────────────────────────────
//
//  Une aide dépliée d'office pousse le travail vers le bas à chaque
//  visite, et on la referme sans la lire. Une aide dans un coin se
//  cherche. Celle-ci est un bouton dans l'en-tête de la page, à côté
//  du titre : on le voit sans le subir, il est là quand on le veut.
//
//  SON ÉTAT NE SE RETIENT PAS. Un panneau rouvert tout seul à chaque
//  passage redeviendrait la version dépliée d'office, avec un clic en
//  plus pour s'en débarrasser.
//
//  ── UN SEUL BOUTON OUVERT À LA FOIS, ET C'EST GRATUIT ──────────────
//
//  Les huit pages du carnet ne sont jamais affichées ensemble — une
//  seule est visible, les autres portent `hidden`. On n'a donc pas à
//  refermer les autres : elles ne sont pas là.
//
//  ── LA CAPTURE EST UN BONUS, PAS LE CONTENU ─────────────────────────
//
//  Le texte dit tout sans elle. L'image arrive en différé (`lazy`) et
//  si elle manque, l'aide se lit quand même : une aide qui dépend
//  d'une image est une aide qui tombe en panne.
// ════════════════════════════════════════════════════════════════════

export type AideDUnePage = {
  readonly titre: string;
  readonly aQuoi: string;
  readonly gestes: readonly string[];
  readonly capture: string | null;
};

/** Relit `data/aide-carnet.json` et rend une aide par clé de page.
 *
 *  ON REFUSE UNE ENTRÉE INCOMPLÈTE plutôt que d'en afficher la moitié :
 *  un panneau d'aide avec un titre et rien dessous apprend moins que
 *  pas de panneau du tout. */
export function aidesDepuis(brut: unknown): ReadonlyMap<string, AideDUnePage> {
  const aides = new Map<string, AideDUnePage>();
  if (typeof brut !== "object" || brut === null) return aides;
  const pages = (brut as { pages?: unknown }).pages;
  if (typeof pages !== "object" || pages === null) return aides;
  for (const [cle, valeur] of Object.entries(pages as Record<string, unknown>)) {
    if (typeof valeur !== "object" || valeur === null) continue;
    const v = valeur as Record<string, unknown>;
    const gestes = Array.isArray(v.gestes)
      ? v.gestes.filter((g): g is string => typeof g === "string" && g.trim() !== "")
      : [];
    if (typeof v.titre !== "string" || typeof v.aQuoi !== "string") continue;
    if (v.titre.trim() === "" || v.aQuoi.trim() === "" || gestes.length === 0) continue;
    aides.set(cle, {
      titre: v.titre,
      aQuoi: v.aQuoi,
      gestes,
      capture: typeof v.capture === "string" && v.capture.trim() !== "" ? v.capture : null,
    });
  }
  return aides;
}

function element(doc: Document, balise: string, classe: string, texte?: string): HTMLElement {
  const e = doc.createElement(balise);
  e.className = classe;
  if (texte !== undefined) e.textContent = texte;
  return e;
}

/** Le point d'interrogation. Un vrai bouton : il se prend au clavier,
 *  il s'annonce, et `aria-expanded` dit dans quel sens il va. */
function bouton(doc: Document, cle: string, titre: string): HTMLButtonElement {
  const b = doc.createElement("button");
  b.type = "button";
  b.className = "wm-aide__bouton";
  b.setAttribute("aria-expanded", "false");
  b.setAttribute("aria-controls", `wm-aide-${cle}`);
  //  LE LIBELLÉ DIT DE QUOI ON PARLE. « Aide » seul, répété huit fois
  //  dans une page, ne distingue rien pour qui navigue de bouton en
  //  bouton.
  b.setAttribute("aria-label", `Aide : ${titre}`);
  b.appendChild(doc.createTextNode("?"));
  return b;
}

function panneau(
  doc: Document,
  cle: string,
  a: AideDUnePage,
  depot: string | null,
): HTMLElement {
  const p = element(doc, "div", "wm-aide__panneau");
  p.id = `wm-aide-${cle}`;
  p.hidden = true;

  p.appendChild(element(doc, "p", "wm-aide__titre", `À quoi sert cette page`));
  p.appendChild(element(doc, "p", "wm-aide__quoi", a.aQuoi));

  p.appendChild(element(doc, "p", "wm-aide__titre", "Comment s'en servir"));
  const liste = element(doc, "ul", "wm-aide__gestes");
  for (const g of a.gestes) liste.appendChild(element(doc, "li", "", g));
  p.appendChild(liste);

  if (a.capture !== null && depot !== null) {
    const img = doc.createElement("img");
    img.className = "wm-aide__capture";
    img.src = `${depot}${a.capture}`;
    //  L'ALTERNATIVE DIT CE QU'ON VERRAIT, pas « capture d'écran ».
    //  Et elle n'est pas vide : Forumactif remplit les alternatives
    //  vides avec le titre de la page et le nom du fichier.
    img.alt = `La page « ${a.titre} » du carnet`;
    img.loading = "lazy";
    p.appendChild(img);
  }
  return p;
}

export type DependancesDeLAide = {
  readonly doc: Document;
  readonly aides: ReadonlyMap<string, AideDUnePage>;
  /** La racine du dépôt servi, pour les captures. `null` : pas
   *  d'image, et le texte suffit. */
  readonly depot: string | null;
};

/** Pose une aide dans l'en-tête de chaque page qui en a une. Rend le
 *  nombre d'aides posées.
 *
 *  ELLE NE POSE RIEN DEUX FOIS : le carnet redessine ses pages quand
 *  les données arrivent, et deux points d'interrogation côte à côte
 *  seraient le signe le plus clair que quelque chose cloche. */
export function poserLesAides(d: DependancesDeLAide): number {
  let posees = 0;
  for (const section of d.doc.querySelectorAll<HTMLElement>("[data-wm-carnet-page]")) {
    const cle = section.dataset.wmCarnetPage ?? "";
    const aide = d.aides.get(cle);
    if (aide === undefined) continue;
    const entete = section.querySelector(".wm-carnet__entete");
    if (entete === null) continue;
    if (entete.querySelector(".wm-aide") !== null) continue;

    const bloc = element(d.doc, "div", "wm-aide");
    const b = bouton(d.doc, cle, aide.titre);
    const pan = panneau(d.doc, cle, aide, d.depot);
    b.addEventListener("click", () => {
      const ouvert = pan.hidden;
      pan.hidden = !ouvert;
      b.setAttribute("aria-expanded", String(ouvert));
    });
    bloc.append(b, pan);
    entete.appendChild(bloc);
    posees += 1;
  }
  return posees;
}
