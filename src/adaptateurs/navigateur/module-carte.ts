/// <reference lib="dom" />
/// <reference lib="dom.iterable" />
// ════════════════════════════════════════════════════════════════════
//  src/adaptateurs/navigateur/module-carte.ts
//
//  La carte interactive des territoires de Rhode.
//
//  Demandée le 8 octobre : « une carte interactive avec toutes les
//  villes et toutes les zones. Je veux faire en sorte que ce soit
//  compréhensible facilement pour chaque personne. »
//
//  ── CE QU'ELLE MONTRE ───────────────────────────────────────────────
//
//  Vingt-six lieux : les huit villes, les dix-sept zones en trois
//  paliers, et le Mont Bataille. Au clic : le nom, le palier, les
//  niveaux recommandés, la description, le nombre de sujets, le nombre
//  de messages, et le dernier sujet avec l'avatar de son auteur.
//
//  ── LA GÉOGRAPHIE EST INVENTÉE, PAS LES DONNÉES ─────────────────────
//
//  « Pour le moment, tu inventes la carte, je t'en ferai une plus
//  tard. » Les contours viennent donc de `data/carte.json`, que j'ai
//  dessiné. Les NOMS, les identifiants de forum, les paliers et les
//  niveaux recommandés, eux, sont ceux du forum. Le jour où la vraie
//  carte arrive, c'est ce fichier de données qui change, pas ce
//  module.
//
//  ── D'OÙ VIENNENT LES COMPTAGES ─────────────────────────────────────
//
//  Deux sources, et c'est la partie à comprendre avant de toucher à
//  quoi que ce soit ici.
//
//  **Les villes sont DANS la page.** Elles sont des forums directs de
//  « Les Villes de Rhode » : leurs lignes sont sur l'index, avec leurs
//  compteurs, leur description et leur dernier message. On les lit,
//  zéro requête.
//
//  **Les zones n'y sont pas.** Ce sont des SOUS-forums de `f96`, `f97`
//  et `f98` : l'index n'en donne que le nom et le lien, dans la liste
//  de sous-forums de la ligne du palier. Pour avoir leurs chiffres il
//  faut les trois pages de palier — TROIS requêtes, pas dix-sept, et
//  c'est tout l'intérêt de passer par les parents.
//
//  Ces trois requêtes partent APRÈS le premier dessin et en parallèle.
//  La carte s'affiche tout de suite avec ce qu'elle a ; les chiffres
//  arrivent dedans. Une page de palier injoignable ne coûte que ses
//  chiffres : le lieu garde son nom, sa description et son lien.
//
//  ── LA COULEUR NE DIT JAMAIS RIEN TOUTE SEULE ───────────────────────
//
//  Un joueur sur douze ne distingue pas les trois paliers à la teinte.
//  Le palier est donc ÉCRIT partout où la couleur le dit : dans la
//  légende, sur chaque entrée de la liste, dans le panneau, et dans le
//  nom accessible de chaque forme. La couleur confirme, elle
//  n'informe pas seule.
// ════════════════════════════════════════════════════════════════════

import { lireLeDernierMessage, morceauxDuDernierMessage } from "./module-categories.ts";
import {
  adresseDuForum,
  type Carte,
  carteDepuis,
  cleDeFamille,
  type Comptage,
  deplacer,
  familleDe,
  forumDeLAdresse,
  grouper,
  type Lieu,
  nombreDans,
  ordreDeDessin,
  type Vue,
  ZOOM_MAX,
  ZOOM_MIN,
} from "../../navigateur/carte.ts";

const SVG = "http://www.w3.org/2000/svg";

/** L'hôte que le module remplace. Posé dans le gabarit, ou par le
 *  module lui-même avant la première catégorie. */
export const ANCRE = "wm-carte";

function el<K extends keyof HTMLElementTagNameMap>(
  doc: Document,
  nom: K,
  classe: string,
  texte?: string,
): HTMLElementTagNameMap[K] {
  const n = doc.createElement(nom);
  n.className = classe;
  if (texte !== undefined) n.textContent = texte;
  return n;
}

function svg(doc: Document, nom: string, attrs: Record<string, string>): SVGElement {
  const n = doc.createElementNS(SVG, nom) as SVGElement;
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
  return n;
}

// ── ce que la page sait déjà ────────────────────────────────────────

/** Relève les comptages de toutes les lignes de forum d'un document.
 *
 *  Marche sur l'index comme sur une page de palier : c'est le même
 *  gabarit `index_box`, donc le même balisage. C'est pour ça qu'on
 *  peut lire les zones dans la page de leur palier sans écrire un
 *  second analyseur.
 *
 *  ON LIT LE DOM, PAS DU TEXTE. `DOMParser` fait le travail, et une
 *  expression régulière sur du HTML est une faute qu'on paie plus
 *  tard. */
export function comptagesDe(doc: Document | DocumentFragment): Map<number, Comptage> {
  const sortie = new Map<number, Comptage>();
  for (const ligne of Array.from(doc.querySelectorAll("li.row"))) {
    const titre = ligne.querySelector<HTMLAnchorElement>("a.forumtitle");
    const id = titre === null ? null : forumDeLAdresse(titre.getAttribute("href") ?? "");
    if (id === null) continue;

    const lire = (sel: string): number | null => {
      const n = ligne.querySelector(sel);
      return n === null ? null : nombreDans(n.textContent ?? "");
    };
    const dernierLien = ligne.querySelector<HTMLAnchorElement>(
      "dd.lastpost a:not(.last-post-icon)",
    );
    const avatar = ligne.querySelector<HTMLImageElement>("dd.lastpost img");

    //  ── LE DERNIER MESSAGE SE LIT DANS LES DEUX FORMES ──────────────
    //
    //  Sur l'index, `module-categories.ts` est déjà passé : la date et
    //  l'auteur sont dans `.wm-dernier__date` et `.wm-dernier__qui`.
    //  Sur une page de palier, qu'on va chercher et qu'on analyse hors
    //  de la page, il n'est PAS passé : les deux sont encore des nœuds
    //  de texte nus entre deux `<br>`.
    //
    //  On essaie les classes, puis le découpage brut. Ne lire qu'une
    //  des deux formes voudrait dire faire tourner le module sur un
    //  document détaché — plus cher, et pour rien.
    const infos = ligne.querySelector("dd.lastpost .lastpost-infos");
    const net = (n: Element | null) => (n?.textContent ?? "").replace(/\s+/g, " ").trim();
    let quand = net(ligne.querySelector(".wm-dernier__date"));
    let qui = net(ligne.querySelector(".wm-dernier__qui"));
    if ((quand === "" || qui === "") && infos !== null) {
      const lu = lireLeDernierMessage(morceauxDuDernierMessage(infos));
      if (lu !== null) {
        quand = lu.quand;
        qui = lu.qui;
      }
    }

    //  ── LA DESCRIPTION ET LES SOUS-FORUMS ───────────────────────────
    //
    //  Le gabarit de ModernBB met la description en texte NU dans le
    //  même `<div>` que le titre et les liens de sous-forum. On prend
    //  donc le texte du conteneur et on en retire celui de ses
    //  enfants : ce qui reste est la description, et elle seule.
    const corps = ligne.querySelector("dd.dterm > div");
    let description = "";
    const sousForums: { titre: string; url: string }[] = [];
    if (corps !== null) {
      for (const a of Array.from(corps.querySelectorAll<HTMLAnchorElement>("a.gensmall"))) {
        const u = a.getAttribute("href") ?? "";
        const t = net(a);
        if (u !== "" && t !== "") sousForums.push({ titre: t, url: u });
      }
      const morceaux: string[] = [];
      for (const n of Array.from(corps.childNodes)) {
        if (n.nodeType === 3) morceaux.push(n.textContent ?? "");
      }
      description = morceaux.join(" ").replace(/\s+/g, " ").trim();
    }

    sortie.set(id, {
      sujets: lire("dd.topics"),
      messages: lire("dd.posts"),
      ...(dernierLien === null ? {} : {
        dernier: {
          titre: net(dernierLien),
          url: dernierLien.getAttribute("href") ?? "",
        },
      }),
      ...(avatar === null ? {} : { avatar: avatar.getAttribute("src") ?? "" }),
      ...(qui === "" ? {} : { qui }),
      ...(quand === "" ? {} : { quand }),
      ...(description === "" ? {} : { description }),
      ...(sousForums.length === 0 ? {} : { sousForums }),
    });
  }
  return sortie;
}

/** Les trois pages de palier, lues en parallèle.
 *
 *  `credentials: "same-origin"` et pas `omit` : une zone peut être
 *  réservée à un groupe, et un visiteur déconnecté ne doit pas voir
 *  des chiffres qu'un membre connecté verrait différents. On demande
 *  la page AVEC la session, comme le navigateur le ferait.
 *
 *  Chaque page qui tombe ne coûte que ses chiffres. On ne retente
 *  pas : si `f97` répond mal, elle répondra mal au rechargement
 *  aussi, et une seconde requête ne fait que doubler l'attente. */
export async function comptagesDesPaliers(
  doc: Document,
  adresses: readonly string[],
): Promise<Map<number, Comptage>> {
  const tout = new Map<number, Comptage>();
  const pages = await Promise.all(
    adresses.map((u) =>
      fetch(u, { credentials: "same-origin" })
        .then((r) => (r.ok ? r.text() : null))
        .catch(() => null)
    ),
  );
  for (const html of pages) {
    if (html === null) continue;
    const lu = new DOMParser().parseFromString(html, "text/html");
    for (const [id, c] of comptagesDe(lu)) tout.set(id, c);
  }
  void doc;
  return tout;
}

// ── le dessin ───────────────────────────────────────────────────────

/** Ce que le module rend, pour que le harnais puisse le piloter. */
export type Pose = {
  readonly racine: HTMLElement;
  /** Montre un lieu : la forme s'allume, la liste suit, le panneau se
   *  remplit, et la vue vient dessus. */
  readonly choisir: (forumId: number) => void;
  /** Pose les comptages arrivés après coup. */
  readonly enrichir: (comptages: Map<number, Comptage>) => void;
};

function legende(doc: Document, carte: Carte): HTMLElement {
  //  LA LÉGENDE N'EST PAS DÉCORATIVE. C'est elle qui apprend le code
  //  couleur ; sans elle, les quatre teintes sont quatre teintes.
  const bloc = el(doc, "ul", "wm-carte__legende");
  const vues = new Map<string, Lieu>();
  for (const l of carte.lieux) if (!vues.has(cleDeFamille(l))) vues.set(cleDeFamille(l), l);
  for (const [cle, lieu] of vues) {
    const item = el(doc, "li", "wm-carte__legende-item");
    item.dataset.wmFamille = cle;
    item.appendChild(el(doc, "span", "wm-carte__pastille"));
    item.appendChild(el(doc, "span", "wm-carte__legende-mot", familleDe(lieu)));
    bloc.appendChild(item);
  }
  return bloc;
}

/** Pose l'hôte de la carte au bon endroit de l'index, s'il n'y est pas.
 *
 *  ── POURQUOI ON NE LE MET PAS DANS LE GABARIT ───────────────────────
 *
 *  `index_body` est partagé par l'index et par les pages de forum. Un
 *  conteneur écrit dedans apparaîtrait aussi sur les secondes, où la
 *  carte n'a rien à faire.
 *
 *  ── COMMENT ON TROUVE LA PLACE ──────────────────────────────────────
 *
 *  Pas par le titre — « Les Villes de Rhode » peut être renommé demain
 *  et le code tomberait en silence. On cherche le PREMIER bloc de
 *  catégorie qui contient un lien vers un forum de la carte, et on se
 *  pose juste avant. La règle suit les données : ajouter un lieu à
 *  `data/carte.json` suffit, et renommer une catégorie ne casse rien.
 *
 *  ── LES DEUX CATÉGORIES DISPARAISSENT, MAIS PAS DU HTML ─────────────
 *
 *  Demandé le 8 octobre : « les catégories en dessous ne doivent donc
 *  plus se voir en toute logique ». Elles portent exactement ce que la
 *  carte montre, en double.
 *
 *  ON LES CACHE EN JAVASCRIPT, PAS DANS LA FEUILLE. Une règle écrite
 *  dans la feuille les ferait disparaître même quand le module tombe —
 *  et on se retrouverait avec une page sans carte ET sans liste, c'est
 *  à dire sans territoires du tout. En posant la classe ici, la
 *  disparition est la CONSÉQUENCE de la carte posée : pas de carte,
 *  pas de classe, les lignes restent. */
export const CLASSE_REMPLACE = "wm-carte-remplacee";

export function ancrerLaCarte(doc: Document, carte: Carte): HTMLElement | null {
  const ids = new Set(carte.lieux.map((l) => l.forumId));
  const porte = (bloc: HTMLElement): boolean =>
    Array.from(bloc.querySelectorAll<HTMLAnchorElement>("a[href]")).some((a) => {
      const f = forumDeLAdresse(a.getAttribute("href") ?? "");
      return f !== null && ids.has(f);
    });

  const blocs = Array.from(doc.querySelectorAll<HTMLElement>(".forabg, .forumbg"))
    .filter(porte);
  //  Chaque bloc qui porte un lieu de la carte est maintenant redit par
  //  elle. Un bloc imbriqué dans un autre ne compte qu'une fois — la
  //  classe est idempotente.
  for (const bloc of blocs) bloc.classList.add(CLASSE_REMPLACE);

  const deja = doc.querySelector<HTMLElement>(`#${ANCRE}`);
  if (deja !== null) return deja;
  const premier = blocs[0];
  if (premier === undefined) return null;
  const hote = doc.createElement("div");
  hote.id = ANCRE;
  premier.parentElement?.insertBefore(hote, premier);
  return hote;
}

/** Pose la carte dans son hôte. Rend `null` si l'hôte ou la carte
 *  manquent — la page reste alors celle de ModernBB, entière. */
export function poserLaCarte(doc: Document, donnees: unknown): Pose | null {
  const carte = carteDepuis(donnees);
  if (carte === null) return null;
  const hote = ancrerLaCarte(doc, carte);
  if (hote === null) return null;

  const racine = el(doc, "section", "wm-carte");
  racine.setAttribute("aria-label", "La carte de Rhode");

  // ── le titre ─────────────────────────────────────────────────────
  //
  //  « il faut un titre à cette map ». Un `h2` : la carte remplace deux
  //  catégories, qui en portaient chacune un, et un bloc sans titre
  //  dans le plan du document est un bloc qu'un lecteur d'écran ne sait
  //  pas annoncer.
  const tete = el(doc, "header", "wm-carte__tete");
  tete.appendChild(el(doc, "p", "wm-carte__surtitre", "Les territoires"));
  tete.appendChild(el(doc, "h2", "wm-carte__titre", "La carte de Rhode"));
  tete.appendChild(
    el(
      doc,
      "p",
      "wm-carte__chapo",
      "Choisissez un lieu sur la carte pour le détail, ou entrez directement " +
        "depuis la liste.",
    ),
  );
  racine.appendChild(tete);

  const corps = el(doc, "div", "wm-carte__corps");

  // ── le cadre et son dessin ───────────────────────────────────────
  const cadre = el(doc, "div", "wm-carte__cadre");
  const dessin = svg(doc, "svg", {
    class: "wm-carte__dessin",
    viewBox: `0 0 ${carte.repere.largeur} ${carte.repere.hauteur}`,
    //  Le dessin est décoratif en lui-même : tout ce qu'il dit est
    //  repris en texte dans la liste à droite. Le groupe des formes,
    //  lui, est bien exposé — ce sont des boutons.
    role: "application",
    "aria-label": "Carte de Rhode. Les mêmes lieux sont listés à droite.",
  });
  //  ── LA MER, AVANT TOUT LE RESTE ───────────────────────────────────
  //
  //  Elle est DANS le SVG, pas en image de fond sur le cadre : elle se
  //  déplace et se zoome avec la carte, elle est calée sur la côte par
  //  construction, et elle prend ses couleurs des jetons — donc elle a
  //  un thème sombre. Voir `Mer` dans `carte.ts`.
  //
  //  L'ORDRE EST CELUI D'UN EMPILEMENT, PAS D'UNE LISTE. Les bandes
  //  sont emboîtées : la plus lointaine contient toutes les autres. On
  //  les peint donc de la plus lointaine à la plus proche, chacune
  //  recouvrant le centre de la précédente. Peintes dans l'autre sens,
  //  on ne verrait que la plus lointaine.
  if (carte.mer !== undefined) {
    const mer = svg(doc, "g", { class: "wm-carte__mer", "aria-hidden": "true" });
    //  Le fond couvre tout le repère : au zoom maximum la vue reste
    //  dedans (`borner` s'en assure), donc il n'y a jamais de trou.
    mer.appendChild(
      svg(doc, "rect", {
        class: "wm-carte__mer-fond",
        x: "0",
        y: "0",
        width: String(carte.repere.largeur),
        height: String(carte.repere.hauteur),
      }),
    );
    const bandes = [...carte.mer.bandes].reverse();
    for (const [i, d] of bandes.entries()) {
      mer.appendChild(
        svg(doc, "path", {
          class: "wm-carte__mer-bande",
          //  4 au large, 1 contre la côte : la feuille lit ce chiffre
          //  et n'a pas à compter.
          "data-wm-profondeur": String(bandes.length - i),
          d,
        }),
      );
    }
    for (const ride of carte.mer.rides) {
      mer.appendChild(
        svg(doc, "circle", {
          class: "wm-carte__ride",
          cx: String(ride.x),
          cy: String(ride.y),
          r: String(ride.r),
        }),
      );
      mer.appendChild(
        svg(doc, "circle", {
          class: "wm-carte__ride wm-carte__ride--dedans",
          cx: String(ride.x),
          cy: String(ride.y),
          r: String(Math.round(ride.r * 0.55 * 10) / 10),
        }),
      );
    }
    dessin.appendChild(mer);
  }

  //  LA TERRE, PUIS LES ÎLES. Même classe, donc même teinte et même
  //  trait de côte : une île est du continent détaché, pas autre
  //  chose. Sans elles, l'Île Ténèbra serait une épingle posée sur
  //  l'eau.
  for (const d of [carte.terre, ...carte.iles]) {
    if (d !== "") dessin.appendChild(svg(doc, "path", { class: "wm-carte__terre", d }));
  }

  const formes = new Map<number, SVGElement>();
  const entrees = new Map<number, HTMLElement>();

  //  LES TERRITOIRES D'ABORD, LES ÉPINGLES ENSUITE. Dans un SVG, c'est
  //  l'ordre du document qui fait l'empilement, et `ordreDeDessin` est
  //  la seule chose qui empêche une tache de recouvrir le nom d'un
  //  point — c'est arrivé à « Mont Bataille », voir la fonction.
  for (const lieu of ordreDeDessin(carte.lieux)) {
    const g = svg(doc, "g", {
      class: "wm-carte__lieu",
      "data-wm-forum": String(lieu.forumId),
      "data-wm-famille": cleDeFamille(lieu),
      tabindex: "0",
      role: "button",
      //  LE PALIER EST DANS LE NOM ACCESSIBLE, pas seulement dans la
      //  couleur. « Canyon Lekro, palier 2 » se lit ; une tache ocre,
      //  non.
      "aria-label": `${lieu.nom}, ${familleDe(lieu).toLowerCase()}`,
    });
    if (lieu.forme !== undefined) {
      g.appendChild(svg(doc, "path", { class: "wm-carte__forme", d: lieu.forme }));
    } else {
      g.appendChild(
        svg(doc, "circle", {
          class: "wm-carte__epingle",
          cx: String(lieu.ancre.x),
          cy: String(lieu.ancre.y),
          r: "9",
        }),
      );
    }
    //  LE NOM N'EST PAS FORCÉMENT SUR LE LIEU. Vingt-six étiquettes
    //  sur 1000 × 640 se chevauchent ; `data/carte.json` porte une
    //  position écartée pour chacune, calculée une fois. Sans elle,
    //  on retombe sur l'ancre.
    const ou = lieu.etiquette ?? lieu.ancre;
    const mot = svg(doc, "text", {
      class: "wm-carte__nom",
      x: String(ou.x),
      y: String(ou.y + (lieu.forme === undefined ? 26 : 4)),
      "text-anchor": "middle",
    });
    mot.textContent = lieu.nom;
    g.appendChild(mot);
    dessin.appendChild(g);
    formes.set(lieu.forumId, g);
  }
  cadre.appendChild(dessin);

  // ── la colonne de droite, sur toute la hauteur ───────────────────
  //
  //  « le panneau de droite doit prendre toute la hauteur ». Le panneau
  //  ne flotte plus SUR la carte : il tient le haut d'une colonne qui
  //  monte du bord haut au bord bas du cadre, et la liste occupe ce qui
  //  reste en défilant.
  const colonne = el(doc, "div", "wm-carte__colonne");

  const panneau = el(doc, "div", "wm-carte__panneau");
  //  `polite` et pas `assertive` : le panneau se remplit au clic, donc
  //  l'utilisateur sait déjà qu'il vient de se passer quelque chose.
  panneau.setAttribute("aria-live", "polite");
  colonne.appendChild(panneau);

  // ── la liste : groupée, et chaque entrée entre dans le forum ─────
  const bloc = el(doc, "div", "wm-carte__liste-cadre");
  bloc.appendChild(legende(doc, carte));
  const chiffresDesEntrees = new Map<number, HTMLElement>();

  for (const groupe of grouper(carte.lieux)) {
    const section = el(doc, "section", "wm-carte__groupe");
    section.dataset.wmFamille = groupe.cle;
    const titre = el(doc, "h3", "wm-carte__groupe-titre");
    titre.appendChild(el(doc, "span", "wm-carte__puce"));
    titre.appendChild(el(doc, "span", "wm-carte__groupe-mot", groupe.titre));
    titre.appendChild(
      el(doc, "span", "wm-carte__groupe-compte", String(groupe.lieux.length)),
    );
    section.appendChild(titre);

    const liste = el(doc, "ul", "wm-carte__liste");
    for (const lieu of groupe.lieux) {
      const item = el(doc, "li", "wm-carte__item");
      //  UN LIEN, PAS UN BOUTON. « Cliquer sur la catégorie à droite
      //  nous fait rentrer dans la catégorie » : c'est une navigation,
      //  donc un `a[href]` — qui s'ouvre dans un onglet au clic du
      //  milieu, se copie, et s'annonce comme un lien. Le panneau, lui,
      //  se remplit depuis la carte et au survol d'une entrée.
      const entree = doc.createElement("a");
      entree.className = "wm-carte__entree";
      entree.href = adresseDuForum(lieu.forumId);
      entree.dataset.wmForum = String(lieu.forumId);
      entree.dataset.wmFamille = cleDeFamille(lieu);
      const nom = el(doc, "span", "wm-carte__entree-nom", lieu.nom);
      entree.appendChild(nom);
      const chiffres = el(doc, "span", "wm-carte__entree-chiffres", "—");
      entree.appendChild(chiffres);
      const fleche = el(doc, "span", "wm-carte__entree-fleche", "→");
      fleche.setAttribute("aria-hidden", "true");
      entree.appendChild(fleche);
      //  Le palier est déjà dans le titre du groupe juste au-dessus ;
      //  ici il repart dans le nom accessible, parce qu'une entrée
      //  atteinte à la tabulation s'annonce seule.
      entree.setAttribute(
        "aria-label",
        `${lieu.nom}, ${familleDe(lieu).toLowerCase()} — entrer dans le forum`,
      );
      item.appendChild(entree);
      liste.appendChild(item);
      entrees.set(lieu.forumId, entree);
      chiffresDesEntrees.set(lieu.forumId, chiffres);
    }
    section.appendChild(liste);
    bloc.appendChild(section);
  }
  colonne.appendChild(bloc);

  corps.appendChild(cadre);
  corps.appendChild(colonne);
  racine.appendChild(corps);
  hote.replaceChildren(racine);

  // ── l'état ───────────────────────────────────────────────────────
  const comptages = new Map<number, Comptage>();
  let vue: Vue = { x: 0, y: 0, largeur: carte.repere.largeur, hauteur: carte.repere.hauteur };
  let choisi: number | null = null;

  const poserLaVue = (): void => {
    dessin.setAttribute("viewBox", `${vue.x} ${vue.y} ${vue.largeur} ${vue.hauteur}`);
  };

  const parId = new Map(carte.lieux.map((l) => [l.forumId, l]));

  //  ZÉRO N'EST PAS « JE NE SAIS PAS ». Un forum vide dit « 0 sujets »,
  //  un relevé qui n'est pas arrivé dit qu'il n'est pas arrivé. Les
  //  confondre ferait croire le forum vide pendant une panne réseau.
  const dit = (n: number | null, un: string, plusieurs: string): string =>
    n === null ? `— ${plusieurs}` : `${n} ${n === 1 ? un : plusieurs}`;

  /** Ce que le panneau montre avant le premier clic. Il occupe toute la
   *  hauteur de la colonne : le laisser vide ferait un trou, et un trou
   *  ne dit pas quoi faire. */
  const inviterLePanneau = (): void => {
    panneau.replaceChildren();
    panneau.classList.add("wm-carte__panneau--vide");
    panneau.appendChild(
      el(
        doc,
        "p",
        "wm-carte__invite",
        "Cliquez un lieu sur la carte : son palier, ses niveaux, sa description " +
          "et son dernier sujet s'affichent ici.",
      ),
    );
  };

  const remplirLePanneau = (lieu: Lieu): void => {
    const c = comptages.get(lieu.forumId);
    panneau.replaceChildren();
    panneau.classList.remove("wm-carte__panneau--vide");
    panneau.dataset.wmFamille = cleDeFamille(lieu);

    //  ── L'IMAGE D'EN-TÊTE ─────────────────────────────────────────
    //
    //  « on doit avoir une image ou un fond (en se basant sur le
    //  figma) pour chaque catégorie ». Aucun lieu n'a la sienne pour
    //  l'instant : la variable reste vide et la feuille retombe sur
    //  `--wm-bandeau-categorie`, le bandeau des en-têtes de catégorie.
    //  Le jour où les images arrivent, c'est `data/carte.json` qui
    //  change, pas ce module.
    const banniere = el(doc, "div", "wm-carte__banniere");
    if (lieu.image !== undefined && lieu.image !== "") {
      banniere.style.setProperty("--wm-carte-image", `url("${lieu.image}")`);
    }
    banniere.appendChild(el(doc, "p", "wm-carte__panneau-famille", familleDe(lieu)));
    if (lieu.niveau !== "") {
      banniere.appendChild(el(doc, "p", "wm-carte__panneau-niveau", lieu.niveau));
    }
    panneau.appendChild(banniere);

    //  ── LE NOM, QUI EST LA PORTE ──────────────────────────────────
    //
    //  « il faut une flèche dans l'infobulle pour indiquer pour entrer
    //  dans la catégorie ». La flèche est décorative : c'est le nom qui
    //  porte le lien, et le nom est déjà le nom du forum.
    const titre = el(doc, "h3", "wm-carte__panneau-nom");
    const lien = doc.createElement("a");
    lien.className = "wm-carte__panneau-lien";
    lien.href = adresseDuForum(lieu.forumId);
    lien.appendChild(el(doc, "span", "wm-carte__panneau-mot", lieu.nom));
    const fleche = el(doc, "span", "wm-carte__fleche", "→");
    fleche.setAttribute("aria-hidden", "true");
    lien.appendChild(fleche);
    titre.appendChild(lien);
    panneau.appendChild(titre);

    //  ── LA DESCRIPTION ────────────────────────────────────────────
    //
    //  « La description doit s'appuyer sur celle qui est indiquée et
    //  qu'on a écrit dans les catégories » : celle du FORUM d'abord,
    //  relevée sur la ligne ; celle de `data/carte.json` seulement en
    //  dernier recours, parce qu'elle est de moi.
    const texte = c?.description !== undefined && c.description !== ""
      ? c.description
      : lieu.description;
    if (texte !== "") {
      panneau.appendChild(el(doc, "p", "wm-carte__panneau-texte", texte));
    }

    //  ── LES SOUS-FORUMS ───────────────────────────────────────────
    //
    //  « on doit voir les sous-forums ». Une zone de palier en a
    //  rarement ; une ville en a souvent trois ou quatre, et ce sont
    //  eux qu'on cherche quand on clique.
    if (c?.sousForums !== undefined && c.sousForums.length > 0) {
      const liste = el(doc, "ul", "wm-carte__sous-forums");
      liste.setAttribute("aria-label", `Les sous-forums de ${lieu.nom}`);
      for (const sf of c.sousForums) {
        const item = el(doc, "li", "wm-carte__sous-forum");
        const a = doc.createElement("a");
        a.href = sf.url;
        a.textContent = sf.titre;
        item.appendChild(a);
        liste.appendChild(item);
      }
      panneau.appendChild(liste);
    }

    const chiffres = el(doc, "p", "wm-carte__chiffres");
    chiffres.appendChild(
      el(doc, "span", "wm-carte__chiffre", dit(c?.sujets ?? null, "sujet", "sujets")),
    );
    chiffres.appendChild(
      el(doc, "span", "wm-carte__chiffre", dit(c?.messages ?? null, "message", "messages")),
    );
    panneau.appendChild(chiffres);

    //  ── LE DERNIER MESSAGE ────────────────────────────────────────
    //
    //  « on doit pouvoir cliquer sur le dernier message posté », « une
    //  flèche pour voir le dernier post », « ainsi que la date du
    //  post ». Le bloc entier est le lien : une cible de 68 px de haut
    //  se clique, un titre de 11 px sur une ligne, moins bien.
    if (c?.dernier !== undefined && c.dernier.titre !== "") {
      const a = doc.createElement("a");
      a.className = "wm-carte__dernier";
      a.href = c.dernier.url;
      if (c.avatar !== undefined && c.avatar !== "") {
        const img = doc.createElement("img");
        img.className = "wm-carte__dernier-avatar";
        img.src = c.avatar;
        img.alt = "";
        img.loading = "lazy";
        a.appendChild(img);
      }
      const bloc = el(doc, "span", "wm-carte__dernier-corps");
      bloc.appendChild(el(doc, "span", "wm-carte__dernier-sur", "Dernier message"));
      bloc.appendChild(el(doc, "span", "wm-carte__dernier-titre", c.dernier.titre));
      const bas = el(doc, "span", "wm-carte__dernier-bas");
      if (c.quand !== undefined && c.quand !== "") {
        bas.appendChild(el(doc, "span", "wm-carte__dernier-date", c.quand));
      }
      if (c.qui !== undefined && c.qui !== "") {
        bas.appendChild(el(doc, "span", "wm-carte__dernier-qui", c.qui));
      }
      bloc.appendChild(bas);
      a.appendChild(bloc);
      const f = el(doc, "span", "wm-carte__fleche", "→");
      f.setAttribute("aria-hidden", "true");
      a.appendChild(f);
      panneau.appendChild(a);
    }
  };

  const choisir = (forumId: number): void => {
    const lieu = parId.get(forumId);
    if (lieu === undefined) return;
    choisi = forumId;
    for (const [id, g] of formes) g.classList.toggle("wm-carte__lieu--choisi", id === forumId);
    for (const [id, b] of entrees) {
      b.classList.toggle("wm-carte__entree--choisie", id === forumId);
    }
    remplirLePanneau(lieu);
  };

  for (const [id, g] of formes) {
    g.addEventListener("click", () => choisir(id));
    g.addEventListener("keydown", (e) => {
      const k = (e as KeyboardEvent).key;
      if (k === "Enter" || k === " ") {
        e.preventDefault();
        choisir(id);
      }
    });
  }

  //  ── LA LISTE MONTRE, LE CLIC EMMÈNE ───────────────────────────────
  //
  //  L'entrée est un lien : son clic part dans le forum, et on ne
  //  l'intercepte pas. Mais survoler ou tabuler dessus allume la forme
  //  sur la carte et remplit le panneau — on voit où l'on va avant d'y
  //  aller, et c'est la même paire d'yeux qui fait l'aller-retour entre
  //  les deux colonnes.
  for (const [id, b] of entrees) {
    b.addEventListener("pointerenter", () => choisir(id));
    b.addEventListener("focus", () => choisir(id));
  }

  // ── se déplacer à la souris, comme sur une vraie carte ───────────
  //
  //  LE POINTEUR EST CAPTURÉ. Sans `setPointerCapture`, la carte
  //  s'arrête de suivre dès que le curseur sort du cadre — et on sort
  //  du cadre tout le temps, puisqu'on traîne vers les bords. Le
  //  pointeur capturé continue d'envoyer ses événements au nœud qui
  //  l'a pris, où qu'il aille.
  let attrape: { x: number; y: number } | null = null;
  cadre.addEventListener("pointerdown", (e) => {
    const ev = e as PointerEvent;
    //  Seulement le bouton principal, et pas sur un lieu : un clic sur
    //  une tache doit la choisir, pas démarrer un glissement.
    if (ev.button !== 0) return;
    attrape = { x: ev.clientX, y: ev.clientY };
    cadre.setPointerCapture(ev.pointerId);
    cadre.classList.add("wm-carte__cadre--attrape");
  });
  const relacher = (e: Event): void => {
    attrape = null;
    cadre.classList.remove("wm-carte__cadre--attrape");
    const ev = e as PointerEvent;
    if (cadre.hasPointerCapture?.(ev.pointerId)) cadre.releasePointerCapture(ev.pointerId);
  };
  cadre.addEventListener("pointerup", relacher);
  cadre.addEventListener("pointercancel", relacher);
  cadre.addEventListener("pointermove", (e) => {
    if (attrape === null) return;
    const ev = e as PointerEvent;
    const boite = cadre.getBoundingClientRect();
    if (boite.width === 0 || boite.height === 0) return;
    //  DES PIXELS D'ÉCRAN VERS DES UNITÉS DE CARTE. C'est le seul
    //  endroit où la conversion a lieu, et c'est pour ça que
    //  `deplacer` ne connaît que la carte.
    const dx = (ev.clientX - attrape.x) * (vue.largeur / boite.width);
    const dy = (ev.clientY - attrape.y) * (vue.hauteur / boite.height);
    attrape = { x: ev.clientX, y: ev.clientY };
    vue = deplacer(vue, dx, dy, carte.repere);
    poserLaVue();
  });

  //  LE ZOOM À LA MOLETTE EST VOLONTAIREMENT ABSENT. La carte vit au
  //  milieu d'une page qu'on fait défiler : une molette qui zoome au
  //  lieu de faire défiler bloque le lecteur dans un bloc dont il ne
  //  sait plus sortir. Les deux boutons ci-dessous font le travail, et
  //  ils s'atteignent au clavier.
  const barre = el(doc, "div", "wm-carte__zoom");
  const zoomer = (vers: number): void => {
    const z = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, carte.repere.largeur / vue.largeur * vers));
    const cx = vue.x + vue.largeur / 2;
    const cy = vue.y + vue.hauteur / 2;
    const largeur = carte.repere.largeur / z;
    const hauteur = carte.repere.hauteur / z;
    vue = deplacer(
      { x: cx - largeur / 2, y: cy - hauteur / 2, largeur, hauteur },
      0,
      0,
      carte.repere,
    );
    poserLaVue();
  };
  for (
    const [signe, mot, vers] of [["+", "Zoomer", 1.4], ["−", "Dézoomer", 1 / 1.4]] as const
  ) {
    const b = el(doc, "button", "wm-carte__zoom-bouton", signe);
    b.type = "button";
    b.setAttribute("aria-label", mot);
    b.addEventListener("click", () => zoomer(vers));
    barre.appendChild(b);
  }
  cadre.appendChild(barre);

  poserLaVue();
  inviterLePanneau();

  const enrichir = (nouveaux: Map<number, Comptage>): void => {
    for (const [id, c] of nouveaux) comptages.set(id, c);
    //  Les chiffres de la liste, posés au passage : c'est ce qui donne
    //  sa hiérarchie à la colonne. Un lieu sans relevé garde son tiret.
    for (const [id, n] of chiffresDesEntrees) {
      const c = comptages.get(id);
      n.textContent = c === undefined ? "—" : dit(c.sujets, "sujet", "sujets");
    }
    //  Le panneau ouvert se redessine : sinon il garde ses tirets
    //  alors que les chiffres viennent d'arriver.
    if (choisi !== null) {
      const l = parId.get(choisi);
      if (l !== undefined) remplirLePanneau(l);
    }
  };

  return { racine, choisir, enrichir };
}
