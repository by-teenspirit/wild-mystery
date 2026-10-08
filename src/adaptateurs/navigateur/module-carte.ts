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

import {
  type Carte,
  carteDepuis,
  cleDeFamille,
  type Comptage,
  deplacer,
  familleDe,
  forumDeLAdresse,
  type Lieu,
  nombreDans,
  ranger,
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
    const signature = ligne.querySelector(".wm-dernier__signature");

    sortie.set(id, {
      sujets: lire("dd.topics"),
      messages: lire("dd.posts"),
      ...(dernierLien === null ? {} : {
        dernier: {
          titre: (dernierLien.textContent ?? "").replace(/\s+/g, " ").trim(),
          url: dernierLien.getAttribute("href") ?? "",
        },
      }),
      ...(avatar === null ? {} : { avatar: avatar.getAttribute("src") ?? "" }),
      ...(signature === null ? {} : {
        signature: (signature.textContent ?? "").replace(/\s+/g, " ").trim(),
      }),
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
 *  LES DEUX CATÉGORIES RESTENT EN DESSOUS. La carte s'ajoute, elle ne
 *  remplace pas : sans JavaScript on garde la liste complète des
 *  villes et des paliers, et avec, on a les deux — la carte pour
 *  regarder, les lignes pour lire. */
export function ancrerLaCarte(doc: Document, carte: Carte): HTMLElement | null {
  const deja = doc.querySelector<HTMLElement>(`#${ANCRE}`);
  if (deja !== null) return deja;
  const ids = new Set(carte.lieux.map((l) => l.forumId));
  for (const bloc of Array.from(doc.querySelectorAll<HTMLElement>(".forabg, .forumbg"))) {
    const tient = Array.from(bloc.querySelectorAll<HTMLAnchorElement>("a[href]")).some((a) => {
      const f = forumDeLAdresse(a.getAttribute("href") ?? "");
      return f !== null && ids.has(f);
    });
    if (!tient) continue;
    const hote = doc.createElement("div");
    hote.id = ANCRE;
    bloc.parentElement?.insertBefore(hote, bloc);
    return hote;
  }
  return null;
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
  if (carte.terre !== "") {
    dessin.appendChild(svg(doc, "path", { class: "wm-carte__terre", d: carte.terre }));
  }

  const formes = new Map<number, SVGElement>();
  const entrees = new Map<number, HTMLElement>();
  const rangs = ranger(carte.lieux);

  //  LES ZONES D'ABORD, LES VILLES ENSUITE. Dans un SVG, c'est l'ordre
  //  du document qui fait l'empilement : une ville dessinée avant sa
  //  zone passerait dessous et ne se cliquerait pas.
  for (const lieu of [...rangs].reverse()) {
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

  // ── le panneau, posé SUR la carte et translucide ─────────────────
  const panneau = el(doc, "div", "wm-carte__panneau");
  panneau.setAttribute("aria-live", "polite");
  cadre.appendChild(panneau);

  // ── la liste, qui pilote la même sélection ───────────────────────
  const colonne = el(doc, "div", "wm-carte__colonne");
  colonne.appendChild(legende(doc, carte));
  const liste = el(doc, "ul", "wm-carte__liste");
  liste.setAttribute("aria-label", "Tous les lieux de Rhode");
  for (const lieu of rangs) {
    const item = el(doc, "li", "wm-carte__item");
    const bouton = el(doc, "button", "wm-carte__entree");
    bouton.type = "button";
    bouton.dataset.wmForum = String(lieu.forumId);
    bouton.dataset.wmFamille = cleDeFamille(lieu);
    bouton.appendChild(el(doc, "span", "wm-carte__puce"));
    bouton.appendChild(el(doc, "span", "wm-carte__entree-nom", lieu.nom));
    //  Le palier, écrit, sur chaque entrée. C'est redondant avec la
    //  légende, et c'est voulu : on ne doit pas avoir à remonter.
    bouton.appendChild(el(doc, "span", "wm-carte__entree-famille", familleDe(lieu)));
    item.appendChild(bouton);
    liste.appendChild(item);
    entrees.set(lieu.forumId, bouton);
  }
  colonne.appendChild(liste);

  racine.appendChild(cadre);
  racine.appendChild(colonne);
  hote.replaceChildren(racine);

  // ── l'état ───────────────────────────────────────────────────────
  const comptages = new Map<number, Comptage>();
  let vue: Vue = { x: 0, y: 0, largeur: carte.repere.largeur, hauteur: carte.repere.hauteur };
  let choisi: number | null = null;

  const poserLaVue = (): void => {
    dessin.setAttribute("viewBox", `${vue.x} ${vue.y} ${vue.largeur} ${vue.hauteur}`);
  };

  const parId = new Map(carte.lieux.map((l) => [l.forumId, l]));

  const remplirLePanneau = (lieu: Lieu): void => {
    const c = comptages.get(lieu.forumId);
    panneau.replaceChildren();
    panneau.appendChild(el(doc, "p", "wm-carte__panneau-famille", familleDe(lieu)));
    const titre = el(doc, "h3", "wm-carte__panneau-nom");
    const lien = doc.createElement("a");
    lien.href = `/f${lieu.forumId}-`;
    lien.textContent = lieu.nom;
    titre.appendChild(lien);
    panneau.appendChild(titre);
    panneau.appendChild(el(doc, "p", "wm-carte__panneau-niveau", lieu.niveau));
    if (lieu.description !== "") {
      panneau.appendChild(el(doc, "p", "wm-carte__panneau-texte", lieu.description));
    }

    const chiffres = el(doc, "p", "wm-carte__chiffres");
    //  ZÉRO N'EST PAS « JE NE SAIS PAS ». Un forum vide dit « 0 sujets »,
    //  un relevé qui n'est pas arrivé dit qu'il n'est pas arrivé. Les
    //  confondre ferait croire le forum vide pendant une panne réseau.
    const dit = (n: number | null, un: string, plusieurs: string): string =>
      n === null ? `— ${plusieurs}` : `${n} ${n === 1 ? un : plusieurs}`;
    chiffres.appendChild(
      el(doc, "span", "wm-carte__chiffre", dit(c?.sujets ?? null, "sujet", "sujets")),
    );
    chiffres.appendChild(
      el(doc, "span", "wm-carte__chiffre", dit(c?.messages ?? null, "message", "messages")),
    );
    panneau.appendChild(chiffres);

    if (c?.dernier !== undefined && c.dernier.titre !== "") {
      const bloc = el(doc, "p", "wm-carte__dernier");
      if (c.avatar !== undefined && c.avatar !== "") {
        const img = doc.createElement("img");
        img.className = "wm-carte__dernier-avatar";
        img.src = c.avatar;
        img.alt = "";
        img.loading = "lazy";
        bloc.appendChild(img);
      }
      const corps = el(doc, "span", "wm-carte__dernier-corps");
      const a = doc.createElement("a");
      a.className = "wm-carte__dernier-titre";
      a.href = c.dernier.url;
      a.textContent = c.dernier.titre;
      corps.appendChild(a);
      if (c.signature !== undefined && c.signature !== "") {
        corps.appendChild(el(doc, "span", "wm-carte__dernier-signature", c.signature));
      }
      bloc.appendChild(corps);
      panneau.appendChild(bloc);
    }
  };

  const choisir = (forumId: number): void => {
    const lieu = parId.get(forumId);
    if (lieu === undefined) return;
    choisi = forumId;
    for (const [id, g] of formes) g.classList.toggle("wm-carte__lieu--choisi", id === forumId);
    for (const [id, b] of entrees) {
      b.classList.toggle("wm-carte__entree--choisie", id === forumId);
      b.setAttribute("aria-pressed", String(id === forumId));
    }
    remplirLePanneau(lieu);
    panneau.classList.add("wm-carte__panneau--ouvert");
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
  for (const [id, b] of entrees) b.addEventListener("click", () => choisir(id));

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

  const enrichir = (nouveaux: Map<number, Comptage>): void => {
    for (const [id, c] of nouveaux) comptages.set(id, c);
    //  Le panneau ouvert se redessine : sinon il garde ses tirets
    //  alors que les chiffres viennent d'arriver.
    if (choisi !== null) {
      const l = parId.get(choisi);
      if (l !== undefined) remplirLePanneau(l);
    }
  };

  return { racine, choisir, enrichir };
}
