/// <reference lib="dom" />
/// <reference lib="dom.iterable" />
// ════════════════════════════════════════════════════════════════════
//  src/adaptateurs/navigateur/module-navigation.ts
//
//  La barre de navigation, le panneau latéral et le menu du compte.
//  Maquettes `390:3142`, `390:3676` et `390:3636`.
//
//  ── DEUX BARRES, TENUES SÉPARÉMENT ──────────────────────────────────
//
//  C'est la chose à savoir avant de lire ce fichier.
//
//  **La barre normale** est `ul#modernbb-nav-menu`, servie par
//  `overall_header`. Elle porte le logo et les cinq liens. On réécrit son
//  contenu — aucun template n'est touché.
//
//  **La barre Forumactif** est `#fa_toolbar`, injectée par Forumactif
//  lui-même, après nous. Elle porte le compte, les messages privés et les
//  notifications. On ne la reconstruit PAS : on l'habille, et on accroche
//  le menu du compte au lien qu'elle contient déjà.
//
//  **Et on ne fabrique aucune de ses adresses.** La déconnexion porte un
//  jeton de session ; un lien reconstruit mènerait à une erreur sous un
//  libellé qui promet de déconnecter. On réutilise son ancre telle
//  quelle.
//
//  ── ELLE ARRIVE APRÈS NOUS ──────────────────────────────────────────
//
//  `#fa_toolbar` est posée par un script tiers qui s'exécute plus tard.
//  On ne l'attend pas avec un délai au hasard : un `MutationObserver` la
//  prend dès qu'elle paraît, et s'arrête tout seul au bout de dix
//  secondes. Un observateur qui tourne toute la vie de la page pour un
//  nœud déjà trouvé est une fuite.
//
//  ── LES PERSONNAGES NE S'INVENTENT PAS ──────────────────────────────
//
//  « Mes personnages » est le **switcheroo** : les comptes que Forumactif
//  connaît. On les lit dans la page. **Si la page n'en porte aucun, la
//  section ne s'affiche pas** — un personnage inventé serait un bouton
//  qui ne mène nulle part sous un nom qui n'existe pas.
//
//  ── SANS JAVASCRIPT, LE FORUM RESTE ENTIER ──────────────────────────
//
//  La barre d'origine s'affiche, avec ses libellés de ModernBB. Le
//  panneau n'existe pas, le menu du compte non plus : ce sont des
//  raccourcis vers des pages qui restent toutes accessibles autrement.
// ════════════════════════════════════════════════════════════════════

import {
  adresseDeCompte,
  lienCourant,
  type LienUtile,
  type Navigation,
  navigationDepuis,
  type Personnage,
  personnagesDepuis,
} from "../../navigateur/navigation.ts";

function element(doc: Document, balise: string, classe: string, texte?: string): HTMLElement {
  const e = doc.createElement(balise);
  e.className = classe;
  if (texte !== undefined) e.textContent = texte;
  return e;
}

/** Une icône Material Symbols. La police est déjà chargée par le forum ;
 *  on n'en ajoute aucune. `aria-hidden` parce que le libellé est à
 *  côté — annoncer « menu_book » après « Mon Carnet de Bord » ne sert
 *  personne. */
function icone(doc: Document, nom: string): HTMLElement | null {
  if (nom === "") return null;
  const i = element(doc, "span", "wm-nav__icone material-symbols-outlined", nom);
  i.setAttribute("aria-hidden", "true");
  return i;
}

// ── le switcheroo ───────────────────────────────────────────────────

/** Les personnages, lus dans le switcheroo.
 *
 *  ── LE BALISAGE EST CELUI DU VRAI SWITCHEROO ───────────────────────
 *
 *  Lu dans son code (`Lostmindy/switcheroo-fork`, le 6 octobre), pas
 *  deviné :
 *
 *      <nav id="switcheroo" class="switcheroo">
 *        <ul class="switcheroo__squircles">
 *          <li class="switcheroo__squircle active" data-id="12"
 *              data-action="switcheroo">
 *            <div class="switcheroo__avatar"><img …></div>
 *            <div class="switcheroo__popper">
 *              <span class="switcheroo__popper-text">Elijah</span></div>
 *            <div class="switcheroo__delete">…</div>
 *          </li>
 *
 *  **Un compte n'est PAS un lien.** Il n'a pas de `href` : la bascule se
 *  fait au clic, par le script du switcheroo. C'est pour ça qu'on garde
 *  son `data-id` et pas une adresse.
 *
 *  Le bouton « Associer un personnage » (`data-action="open-login"`) et
 *  le logo portent la même classe de pastille mais **pas de `data-id`** :
 *  c'est ce qui les écarte.
 *
 *  La porte `[data-wm-personnages]` reste la première : elle permet de
 *  décrire la liste dans un template sans dépendre d'un script tiers. */
export function personnagesDeLaPage(doc: Document): readonly Personnage[] {
  const aNous = [...doc.querySelectorAll<HTMLElement>("[data-wm-personnages] [data-wm-id]")];
  if (aNous.length > 0) {
    return personnagesDepuis(aNous.map((e) => ({
      nom: e.dataset.wmNom ?? e.textContent?.replace(/\s+/g, " ").trim() ?? "",
      identifiant: e.dataset.wmId ?? null,
      image: e.querySelector("img")?.getAttribute("src") ?? null,
      actif: e.dataset.wmActif === "true",
    })));
  }

  const pastilles = [...doc.querySelectorAll<HTMLElement>(
    '#switcheroo [data-action="switcheroo"][data-id], .switcheroo [data-action="switcheroo"][data-id]',
  )];
  return personnagesDepuis(pastilles.map((li) => ({
    //  Le nom vit dans l'infobulle : c'est le seul endroit où le
    //  switcheroo l'écrit.
    nom:
      (li.querySelector(".switcheroo__popper-text") ?? li.querySelector(".switcheroo__popper"))
        ?.textContent?.replace(/\s+/g, " ").trim() ?? "",
    identifiant: li.dataset.id ?? null,
    image: li.querySelector(".switcheroo__avatar img")?.getAttribute("src") ?? null,
    actif: li.classList.contains("active"),
  })));
}

/** La pastille du switcheroo qui porte cet identifiant, s'il y en a une. */
function pastilleDuSwitcheroo(doc: Document, identifiant: string): HTMLElement | null {
  return doc.querySelector<HTMLElement>(
    `[data-action="switcheroo"][data-id="${CSS.escape(identifiant)}"]`,
  );
}

// ── le panneau latéral ──────────────────────────────────────────────

function lienUtileEnDOM(doc: Document, u: LienUtile): HTMLElement {
  const li = element(doc, "li", "wm-panneau__entree");
  const cliquable = u.adresse !== null;
  if (!cliquable) li.classList.add("wm-panneau__entree--a-venir");

  const corps = doc.createElement(cliquable ? "a" : "span");
  corps.className = "wm-panneau__lien";
  if (cliquable) (corps as HTMLAnchorElement).href = u.adresse as string;

  const ico = icone(doc, u.icone);
  if (ico !== null) corps.appendChild(ico);
  corps.appendChild(element(doc, "span", "wm-panneau__titre", u.titre));
  //  « à venir » est écrit, pas seulement pâli : un gris ne se lit pas à
  //  haute voix et ne dit pas pourquoi l'entrée ne répond pas.
  if (!cliquable) corps.appendChild(element(doc, "span", "wm-panneau__a-venir", "à venir"));

  li.appendChild(corps);
  return li;
}

function personnageEnDOM(doc: Document, p: Personnage): HTMLElement {
  const li = element(doc, "li", "wm-panneau__personnage");
  if (p.actif) li.classList.add("wm-panneau__personnage--actif");

  //  **Un bouton, pas un lien.** Le switcheroo n'a pas d'adresse de
  //  bascule : il bascule au clic. Notre carte relaie donc le clic à sa
  //  pastille, et quand il n'y en a pas — ou quand c'est déjà le
  //  personnage en jeu — ce n'est pas un bouton du tout.
  const relayable = !p.actif && p.identifiant !== null;
  const corps = doc.createElement(relayable ? "button" : "div");
  corps.className = "wm-panneau__carte";
  if (corps instanceof HTMLButtonElement) {
    corps.type = "button";
    corps.addEventListener("click", () => {
      //  On relit la pastille au moment du clic : le switcheroo redessine
      //  sa liste, et une référence gardée depuis l'ouverture du panneau
      //  pointerait sur un nœud retiré de la page.
      pastilleDuSwitcheroo(doc, p.identifiant as string)?.click();
    });
  }

  const vignette = element(doc, "span", "wm-panneau__vignette");
  if (p.image !== null) {
    const img = doc.createElement("img");
    img.src = p.image;
    img.alt = "";
    vignette.appendChild(img);
  }
  corps.appendChild(vignette);

  const texte = element(doc, "span", "wm-panneau__infos");
  texte.appendChild(element(doc, "span", "wm-panneau__nom", p.nom));
  corps.appendChild(texte);

  //  « en jeu » plutôt qu'un simple surlignage : c'est l'information la
  //  plus utile du panneau, et elle doit se lire à haute voix.
  if (p.actif) corps.appendChild(element(doc, "span", "wm-panneau__en-jeu", "en jeu"));

  li.appendChild(corps);
  return li;
}

function panneauEnDOM(doc: Document, nav: Navigation): HTMLElement {
  const panneau = element(doc, "div", "wm-panneau");
  panneau.id = "wm-panneau";
  panneau.setAttribute("hidden", "");

  if (nav.utiles.length > 0) {
    panneau.appendChild(element(doc, "p", "wm-panneau__titre-section", "Mes liens utiles"));
    const liste = element(doc, "ul", "wm-panneau__liste");
    for (const u of nav.utiles) liste.appendChild(lienUtileEnDOM(doc, u));
    panneau.appendChild(liste);
  }

  const personnages = personnagesDeLaPage(doc);
  if (personnages.length > 0) {
    panneau.appendChild(element(doc, "p", "wm-panneau__titre-section", "Mes personnages"));
    const liste = element(doc, "ul", "wm-panneau__liste");
    for (const p of personnages) liste.appendChild(personnageEnDOM(doc, p));
    panneau.appendChild(liste);
  }
  return panneau;
}

// ── la barre normale ────────────────────────────────────────────────

/** Réécrit `ul#modernbb-nav-menu`, et rend le bouton du panneau.
 *
 *  **On remplace le contenu, pas l'élément.** ModernBB et d'autres
 *  scripts gardent une référence sur ce `<ul>` ; le retirer casserait des
 *  choses qu'on ne voit pas. */
function poserLaBarre(doc: Document, nav: Navigation): HTMLButtonElement | null {
  const barre = doc.querySelector<HTMLElement>("#modernbb-nav-menu");
  if (barre === null || nav.liens.length === 0) return null;

  barre.textContent = "";
  barre.classList.add("wm-nav");

  //  Le logo ouvre le panneau, et devient une croix tant qu'il est
  //  ouvert (maquette 390:3676). C'est un `<button>` : il n'ouvre pas une
  //  page, il bascule un état.
  const porte = element(doc, "li", "wm-nav__porte");
  const bouton = doc.createElement("button");
  bouton.type = "button";
  bouton.className = "wm-nav__logo";
  bouton.setAttribute("aria-expanded", "false");
  bouton.setAttribute("aria-controls", "wm-panneau");
  bouton.setAttribute("aria-label", "Ouvrir le panneau");
  bouton.appendChild(element(doc, "span", "wm-nav__losange", "◈"));
  porte.appendChild(bouton);
  barre.appendChild(porte);

  const courant = lienCourant(nav.liens, doc.location?.pathname ?? "");
  const liens = element(doc, "li", "wm-nav__liens");
  for (const l of nav.liens) {
    const a = doc.createElement("a");
    a.className = "wm-nav__lien";
    a.href = l.adresse;
    a.textContent = l.titre;
    if (courant !== null && courant.clef === l.clef) {
      a.classList.add("wm-nav__lien--courant");
      a.setAttribute("aria-current", "page");
    }
    liens.appendChild(a);
  }
  barre.appendChild(liens);
  return bouton;
}

// ── la barre Forumactif ─────────────────────────────────────────────

/** Le menu du compte, accroché au lien que la barre Forumactif porte.
 *
 *  **La déconnexion est reprise, jamais fabriquée** : son adresse porte
 *  un jeton de session. On cherche l'ancre existante et on la déplace
 *  dans le menu ; si on ne la trouve pas, le menu n'a pas d'entrée de
 *  déconnexion — ce qui est préférable à une qui ne marche pas. */
function menuDuCompte(doc: Document, nav: Navigation, identifiant: number | null): HTMLElement {
  const menu = element(doc, "div", "wm-compte__menu");
  menu.id = "wm-compte-menu";
  menu.setAttribute("hidden", "");

  const liste = element(doc, "ul", "wm-compte__liste");
  for (const e of nav.compte) {
    const ou = adresseDeCompte(e, identifiant);
    const li = element(doc, "li", "wm-compte__entree");
    const corps = doc.createElement(ou === null ? "span" : "a");
    corps.className = "wm-compte__lien";
    if (ou !== null) (corps as HTMLAnchorElement).href = ou;
    else li.classList.add("wm-compte__entree--a-venir");
    const ico = icone(doc, e.icone);
    if (ico !== null) corps.appendChild(ico);
    corps.appendChild(element(doc, "span", "wm-compte__titre", e.titre));
    if (ou === null) corps.appendChild(element(doc, "span", "wm-panneau__a-venir", "à venir"));
    li.appendChild(corps);
    liste.appendChild(li);
  }

  const sortie = doc.querySelector<HTMLAnchorElement>('a[href*="login"][href*="logout"]') ??
    doc.querySelector<HTMLAnchorElement>('a[href*="mode=logout"]');
  if (sortie !== null) {
    const li = element(doc, "li", "wm-compte__entree wm-compte__entree--sortie");
    const a = doc.createElement("a");
    a.className = "wm-compte__lien";
    //  L'adresse est RECOPIÉE de l'ancre trouvée, jamais reconstruite.
    a.href = sortie.getAttribute("href") as string;
    const ico = icone(doc, "logout");
    if (ico !== null) a.appendChild(ico);
    a.appendChild(element(doc, "span", "wm-compte__titre", "Déconnexion"));
    li.appendChild(a);
    liste.appendChild(li);
  }

  menu.appendChild(liste);
  return menu;
}

/** Habille `#fa_right` et y accroche le menu.
 *
 *  Rend `true` quand elle a trouvé la barre. Elle n'invente pas le nom du
 *  compte : s'il n'est pas déjà là, il n'y a rien à habiller. */
function habillerLaBarreForumactif(
  doc: Document,
  nav: Navigation,
  identifiant: number | null,
): boolean {
  const droite = doc.querySelector<HTMLElement>("#fa_right");
  if (droite === null) return false;
  if (droite.classList.contains("wm-compte")) return true;
  droite.classList.add("wm-compte");

  //  Déconnectée, la barre ne porte que « Connexion » et
  //  « S'enregistrer » : il n'y a pas de compte, donc pas de menu. On
  //  s'arrête là plutôt que d'ouvrir un menu vide.
  if (identifiant === null) return true;

  //  Le lien du compte est celui qui mène au profil. On le prend tel
  //  qu'il est plutôt que de le reconnaître à son libellé, qui change
  //  avec la langue du forum.
  const compte = droite.querySelector<HTMLAnchorElement>(`a[href*="/u${identifiant}"]`) ??
    droite.querySelector<HTMLAnchorElement>('a[href*="/profile"]');
  if (compte === null) return true;

  const menu = menuDuCompte(doc, nav, identifiant);
  droite.appendChild(menu);

  compte.setAttribute("aria-haspopup", "true");
  compte.setAttribute("aria-expanded", "false");
  compte.addEventListener("click", (e) => {
    e.preventDefault();
    const ouvert = menu.hasAttribute("hidden");
    menu.toggleAttribute("hidden", !ouvert);
    compte.setAttribute("aria-expanded", String(ouvert));
  });
  return true;
}

// ── l'assemblage ────────────────────────────────────────────────────

export type Dependances = {
  readonly doc: Document;
  /** Le contenu de `data/navigation.json`, déjà décodé. */
  readonly donnees: unknown;
  /** L'identifiant Forumactif du compte connecté, ou `null`. */
  readonly identifiant?: number | null;
};

/**
 * Pose la barre, le panneau et le menu. Rend `true` si la barre a été
 * trouvée et réécrite.
 */
export function poserLaNavigation(
  { doc, donnees, identifiant = null }: Dependances,
): boolean {
  const nav = navigationDepuis(donnees);
  if (nav.liens.length === 0) return false;

  const bouton = poserLaBarre(doc, nav);
  if (bouton === null) return false;

  const panneau = panneauEnDOM(doc, nav);
  doc.body?.appendChild(panneau);

  const basculer = (ouvrir: boolean): void => {
    panneau.toggleAttribute("hidden", !ouvrir);
    bouton.setAttribute("aria-expanded", String(ouvrir));
    bouton.setAttribute("aria-label", ouvrir ? "Fermer le panneau" : "Ouvrir le panneau");
    bouton.classList.toggle("wm-nav__logo--ouvert", ouvrir);
    //  La maquette met une croix à la place du losange tant que le
    //  panneau est ouvert.
    const marque = bouton.querySelector(".wm-nav__losange");
    if (marque !== null) marque.textContent = ouvrir ? "✕" : "◈";
  };
  bouton.addEventListener("click", () => basculer(panneau.hasAttribute("hidden")));
  //  Échap ferme, comme partout : un panneau qui couvre l'écran sans
  //  issue au clavier est un piège.
  doc.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !panneau.hasAttribute("hidden")) basculer(false);
  });

  //  `#fa_toolbar` est posée par un script tiers, après nous. On la
  //  guette, et on arrête de guetter — un observateur qui tourne pour
  //  rien est une fuite.
  if (!habillerLaBarreForumactif(doc, nav, identifiant)) {
    const guetteur = new MutationObserver(() => {
      if (habillerLaBarreForumactif(doc, nav, identifiant)) guetteur.disconnect();
    });
    guetteur.observe(doc.documentElement, { childList: true, subtree: true });
    setTimeout(() => guetteur.disconnect(), 10_000);
  }
  return true;
}
