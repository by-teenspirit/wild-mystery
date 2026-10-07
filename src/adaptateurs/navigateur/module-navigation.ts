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

  if (nav.utiles.length > 0) {
    panneau.appendChild(element(doc, "p", "wm-panneau__titre-section", "Mes liens utiles"));
    const liste = element(doc, "ul", "wm-panneau__liste");
    for (const u of nav.utiles) liste.appendChild(lienUtileEnDOM(doc, u));
    panneau.appendChild(liste);
  }

  //  La section des personnages est posée VIDE et remplie à chaque
  //  ouverture : le switcheroo arrive après nous, et sa liste se
  //  redessine quand il se recharge. Lue une fois au chargement, elle
  //  serait vide sur toutes les pages.
  panneau.appendChild(element(doc, "div", "wm-panneau__personnages"));
  return panneau;
}

/** Le bouton « Associer un personnage », ou `null` si le switcheroo n'est
 *  pas là.
 *
 *  ── POURQUOI IL EXISTE, ET POURQUOI IL MANQUAIT ─────────────────────
 *
 *  **Le switcheroo démarre VIDE.** Lu dans son code : il garde sa liste
 *  dans `localStorage`, et sur un navigateur qui ne l'a jamais vu il
 *  l'initialise à `[]`. Il ne dessine alors qu'une seule pastille — le
 *  « + » qui ouvre son formulaire de connexion. Même le compte déjà
 *  connecté n'y est pas tant qu'on ne l'a pas associé.
 *
 *  Or ce « + » vit dans son conteneur, que nous cachons. Résultat :
 *  **aucun personnage ne pouvait jamais être ajouté**, et « Mes
 *  personnages » restait vide pour l'éternité. C'est exactement ce que
 *  Callista a vu le 6 octobre.
 *
 *  On relaie donc son bouton, comme on relaie ses pastilles. Le
 *  formulaire qu'il ouvre est posé sur `body` par `monomer`, donc en
 *  dehors de notre conteneur caché : il s'affiche. */
function boutonAssocier(doc: Document): HTMLElement | null {
  if (doc.querySelector('[data-action="open-login"]') === null) return null;

  const li = element(doc, "li", "wm-panneau__personnage wm-panneau__personnage--ajout");
  const b = doc.createElement("button");
  b.type = "button";
  b.className = "wm-panneau__carte wm-panneau__carte--ajout";
  b.addEventListener("click", () => {
    //  Relu au clic, comme les pastilles : le switcheroo redessine sa
    //  liste à chaque bascule, et le bouton d'alors n'est plus dans la
    //  page.
    doc.querySelector<HTMLElement>('[data-action="open-login"]')?.click();
  });

  const vignette = element(doc, "span", "wm-panneau__vignette wm-panneau__vignette--plus", "+");
  vignette.setAttribute("aria-hidden", "true");
  b.appendChild(vignette);

  const texte = element(doc, "span", "wm-panneau__infos");
  texte.appendChild(element(doc, "span", "wm-panneau__nom", "Associer un personnage"));
  b.appendChild(texte);

  li.appendChild(b);
  return li;
}

/** Remplit « Mes personnages » depuis le switcheroo, maintenant.
 *
 *  Appelée à chaque ouverture du panneau — le switcheroo se charge après
 *  nous et redessine sa liste.
 *
 *  **La section s'affiche dès que le switcheroo est là**, même sans aucun
 *  personnage : c'est elle qui porte « Associer un personnage », et sans
 *  elle il n'y a aucun moyen d'en ajouter un. Elle ne disparaît que
 *  lorsqu'il n'y a rien du tout à montrer — switcheroo absent, donc ni
 *  liste ni bouton.
 *
 *  Rend le nombre de personnages lus, le bouton non compris. */
export function remplirLesPersonnages(doc: Document, panneau: Element): number {
  const zone = panneau.querySelector(".wm-panneau__personnages");
  if (zone === null) return 0;
  zone.textContent = "";

  const personnages = personnagesDeLaPage(doc);
  const ajout = boutonAssocier(doc);
  if (personnages.length === 0 && ajout === null) return 0;

  zone.appendChild(element(doc, "p", "wm-panneau__titre-section", "Mes personnages"));

  //  Dit pourquoi la liste est vide, plutôt que de laisser un titre seul
  //  au-dessus d'un bouton. « Rien » n'explique rien.
  if (personnages.length === 0) {
    zone.appendChild(element(
      doc,
      "p",
      "wm-panneau__vide",
      "Aucun personnage associé sur ce navigateur.",
    ));
  }

  const liste = element(doc, "ul", "wm-panneau__liste");
  for (const p of personnages) liste.appendChild(personnageEnDOM(doc, p));
  if (ajout !== null) liste.appendChild(ajout);
  zone.appendChild(liste);
  return personnages.length;
}

// ── la barre normale ────────────────────────────────────────────────

/** Pose NOTRE barre en haut du document, et masque celle de ModernBB.
 *
 *  ── POURQUOI ON NE RÉÉCRIT PLUS LA SIENNE ───────────────────────────
 *
 *  C'était la première version, et trois défauts en venaient tous :
 *
 *  · **elle ne prenait pas toute la largeur** — `ul#modernbb-nav-menu`
 *    vit dans un `.wrap` à `max-width: 1400px`, mesuré à 1182 px sur une
 *    fenêtre de 1280 ;
 *  · **elle partait avec la page** — statique dans l'en-tête, donc elle
 *    disparaissait au premier défilement ;
 *  · **sous 760 px, ModernBB la met en `position: fixed` avec une
 *    largeur de 0** : son propre menu repliable prenait la main, et il ne
 *    restait rien à l'écran.
 *
 *  On ne lutte pas contre cette mécanique : on pose la nôtre directement
 *  sur `body`, pleine largeur et collée en haut, et on masque la sienne.
 *  C'est ce que montre la maquette — une barre de 56 px bord à bord, au
 *  tout premier plan de la page.
 *
 *  **L'ancienne est masquée, pas retirée.** ModernBB et d'autres scripts
 *  gardent une référence dessus ; la retirer casserait ce qu'on ne voit
 *  pas. */
function poserLaBarre(
  doc: Document,
  nav: Navigation,
  messages: number,
): HTMLButtonElement | null {
  if (nav.liens.length === 0) return null;
  if (doc.querySelector(".wm-nav") !== null) return null;

  const ancienne = doc.querySelector<HTMLElement>("#modernbb-nav-menu");
  if (ancienne !== null) ancienne.classList.add("wm-nav-remplacee");

  const barre = doc.createElement("nav");
  barre.className = "wm-nav";
  barre.setAttribute("aria-label", "Navigation principale");

  //  Le logo ouvre le panneau, et devient une croix tant qu'il est
  //  ouvert (maquette 390:3676). C'est un `<button>` : il n'ouvre pas une
  //  page, il bascule un état.
  const bouton = doc.createElement("button");
  bouton.type = "button";
  bouton.className = "wm-nav__logo";
  bouton.setAttribute("aria-expanded", "false");
  bouton.setAttribute("aria-controls", "wm-panneau");
  bouton.setAttribute("aria-label", "Ouvrir le panneau");
  bouton.appendChild(element(doc, "span", "wm-nav__losange", "◈"));
  barre.appendChild(bouton);

  const courant = lienCourant(nav.liens, doc.location?.pathname ?? "");
  const liens = element(doc, "div", "wm-nav__liens");
  for (const l of nav.liens) {
    const a = doc.createElement("a");
    a.className = "wm-nav__lien";
    a.href = l.adresse;
    a.textContent = l.titre;
    if (courant !== null && courant.clef === l.clef) {
      a.classList.add("wm-nav__lien--courant");
      a.setAttribute("aria-current", "page");
    }
    //  « Messagerie 3 » : le compteur est DANS le lien, comme la
    //  maquette, et pas une pastille à côté. Il n'est écrit que s'il y a
    //  quelque chose à lire — « Messagerie 0 » n'est pas une
    //  information.
    if (l.clef === "messagerie" && messages > 0) {
      a.appendChild(
        element(doc, "span", "wm-nav__compteur", String(messages)),
      );
      a.setAttribute(
        "aria-label",
        `${l.titre} — ${messages} ${messages > 1 ? "messages non lus" : "message non lu"}`,
      );
    }
    liens.appendChild(a);
  }
  barre.appendChild(liens);

  //  Le groupe de droite, VIDE pour l'instant : il se remplit avec ce
  //  qu'on prend à la barre Forumactif, qui arrive après nous.
  barre.appendChild(element(doc, "div", "wm-nav__droite"));

  //  En PREMIER dans le corps : la barre est le haut de la page, et
  //  l'ordre du DOM doit le dire autant que le CSS — c'est lui que suit
  //  un lecteur d'écran, et la tabulation.
  doc.body?.insertBefore(barre, doc.body.firstChild);
  return bouton;
}

// ── la barre Forumactif ─────────────────────────────────────────────

/** Mesure `#fa_toolbar` et pose sa hauteur en jeton.
 *
 *  ── LE DÉFAUT QUE ÇA CORRIGE ────────────────────────────────────────
 *
 *  La toolbar Forumactif est `position: fixed` en haut, avec un
 *  `z-index: 20002` — relevé sur le forum. Notre barre collait à
 *  `top: 0` avec un z-index de 70 : au premier défilement elle passait
 *  DESSOUS, et on perdait les liens et le logo qui ouvre le panneau.
 *
 *  On ne lui dispute pas son plan : passer au-dessus recouvrirait la
 *  messagerie et le compte, qui sont à elle. On se cale juste en
 *  dessous, et le CSS additionne.
 *
 *  Déconnectée, la toolbar ne porte que deux liens et peut faire zéro de
 *  haut : le jeton vaut alors zéro et la barre colle bien au bord. */
function mesurerLaToolbar(doc: Document): void {
  const tb = doc.querySelector<HTMLElement>("#fa_toolbar");
  const h = tb === null ? 0 : Math.round(tb.getBoundingClientRect().height);
  //  Borné : une toolbar mesurée à 400 px (une image qui charge, un
  //  thème tiers) pousserait la barre hors de l'écran. Au-delà, on
  //  préfère ne pas décaler du tout.
  doc.documentElement.style.setProperty("--wm-haut-toolbar", `${h > 0 && h <= 96 ? h : 0}px`);
}

/** Une entrée du menu du compte : la pastille d'icône, puis le libellé.
 *
 *  La maquette `390:3636` en fait une gélule blanche à bord arrondi
 *  complet, avec l'icône dans un rond d'accent à gauche. */
function entreeDeCompteEnDOM(
  doc: Document,
  nomDIcone: string,
  titre: string,
  ou: string | null,
): HTMLElement {
  const li = element(doc, "li", "wm-compte__entree");
  const corps = doc.createElement(ou === null ? "span" : "a");
  corps.className = "wm-compte__lien";
  if (ou !== null) (corps as HTMLAnchorElement).href = ou;
  else li.classList.add("wm-compte__entree--a-venir");

  const pastille = element(doc, "span", "wm-compte__pastille");
  pastille.setAttribute("aria-hidden", "true");
  const ico = icone(doc, nomDIcone);
  if (ico !== null) pastille.appendChild(ico);
  corps.appendChild(pastille);

  corps.appendChild(element(doc, "span", "wm-compte__titre", titre));
  if (ou === null) corps.appendChild(element(doc, "span", "wm-panneau__a-venir", "à venir"));
  li.appendChild(corps);
  return li;
}

/** Le menu du compte, tel que la maquette `390:3636` le montre.
 *
 *  ── CE QU'ELLE MONTRE ───────────────────────────────────────────────
 *
 *  Un cadre de 347 × 240 à fond blanc translucide : à gauche l'avatar
 *  dans son cadre à filet, au format 200/320 comme partout ailleurs ; à
 *  droite une colonne de 181 px, six gélules blanches de 28 px espacées
 *  de 8, chacune avec son rond d'accent et son libellé en capitales.
 *
 *  ── L'AVATAR NE S'INJECTE PAS ───────────────────────────────────────
 *
 *  Forumactif met du HTML dans `_userdata.avatar`. On en tire la source
 *  et on fabrique notre `<img>` ; on n'écrit jamais ce fragment dans la
 *  page. Sans avatar, la colonne de droite prend tout — le menu n'a pas
 *  de trou.
 *
 *  ── LA DÉCONNEXION EST REPRISE, JAMAIS FABRIQUÉE ────────────────────
 *
 *  Son adresse porte un jeton de session. On cherche l'ancre existante et
 *  on recopie son `href` ; si on ne la trouve pas, le menu n'a pas
 *  d'entrée de déconnexion — ce qui vaut mieux qu'une qui ne marche pas. */
function menuDuCompte(
  doc: Document,
  nav: Navigation,
  identifiant: number | null,
  avatar: string | null,
): HTMLElement {
  const menu = element(doc, "div", "wm-compte__menu");
  menu.id = "wm-compte-menu";
  menu.setAttribute("hidden", "");

  if (avatar !== null) {
    const cadre = element(doc, "div", "wm-compte__avatar");
    const img = doc.createElement("img");
    img.src = avatar;
    //  Vide : le nom du compte est juste à côté, dans la barre. Le
    //  répéter ferait entendre deux fois la même chose.
    img.alt = "";
    img.loading = "lazy";
    cadre.appendChild(img);
    menu.appendChild(cadre);
  }

  const liste = element(doc, "ul", "wm-compte__liste");
  for (const e of nav.compte) {
    liste.appendChild(
      entreeDeCompteEnDOM(doc, e.icone, e.titre, adresseDeCompte(e, identifiant)),
    );
  }

  const sortie = doc.querySelector<HTMLAnchorElement>('a[href*="login"][href*="logout"]') ??
    doc.querySelector<HTMLAnchorElement>('a[href*="mode=logout"]');
  if (sortie !== null) {
    //  L'adresse est RECOPIÉE de l'ancre trouvée, jamais reconstruite.
    const li = entreeDeCompteEnDOM(
      doc,
      "logout",
      "Déconnexion",
      sortie.getAttribute("href") as string,
    );
    li.classList.add("wm-compte__entree--sortie");
    liste.appendChild(li);
  }

  menu.appendChild(liste);
  return menu;
}

/** Place le menu sous le lien du compte, en coordonnées d'écran.
 *
 *  ── POURQUOI PAS UN SIMPLE `position: absolute` DANS LA BARRE ───────
 *
 *  Parce que `#fa_toolbar` n'est pas à nous. Elle est posée par
 *  Forumactif avec ses propres `overflow`, ses propres contextes
 *  d'empilement et une hauteur de 2,3 em : un menu de 240 px calé dedans
 *  se fait rogner, et aucun `z-index` ne rattrape un `overflow: hidden`.
 *
 *  Le menu vit donc sur `body`, en `position: fixed`, et on le recale à
 *  chaque ouverture sur la position réelle du lien. */
function placerLeMenu(doc: Document, ancre: HTMLElement, menu: HTMLElement): void {
  const r = ancre.getBoundingClientRect();
  const largeur = doc.defaultView?.innerWidth ?? 0;
  menu.style.top = `${Math.round(r.bottom + 6)}px`;

  //  ── LES DEUX BORDS, PAS UN SEUL ───────────────────────────────────
  //
  //  Aligné à droite sur le lien du compte. Mais un menu de 347 px calé
  //  sur un lien situé à gauche sort par la GAUCHE de l'écran, et la
  //  première version ne bornait que le bord droit : mesuré à x = −272,
  //  l'avatar et la moitié des entrées hors champ.
  //
  //  On mesure donc le menu — il est déjà visible quand on arrive ici,
  //  sans quoi sa largeur vaudrait zéro — et on le borne des deux côtés.
  const sien = menu.offsetWidth;
  const maxi = Math.max(8, largeur - sien - 8);
  menu.style.right = `${Math.min(maxi, Math.max(8, Math.round(largeur - r.right)))}px`;
}

/** Prend à la barre Forumactif ce qui nous intéresse, le pose à droite
 *  de NOTRE barre, et range la sienne.
 *
 *  ── POURQUOI ON DÉMÉNAGE AU LIEU D'HABILLER ─────────────────────────
 *
 *  La maquette ne montre qu'une seule barre : le logo et les liens à
 *  gauche, l'avatar et le pseudo à droite. `#fa_toolbar` est une
 *  deuxième barre, posée par Forumactif par-dessus, avec son propre
 *  `z-index: 20002` et un `margin-top: 42px` qu'elle écrit **en style
 *  inline sur `body`** — mesuré le 7 octobre. Déconnectée, elle est même
 *  haute de zéro et ne laisse qu'une bande vide de 42 px.
 *
 *  On la range donc : on COPIE ses adresses, on bâtit notre groupe de
 *  droite, et on la masque. Elle reste dans la page et reste activée —
 *  le switcheroo en a besoin pour fonctionner, c'est écrit dans ses
 *  prérequis, et son propre mode d'emploi donne le CSS pour la cacher
 *  sans la désactiver.
 *
 *  ── LES ADRESSES SONT COPIÉES, JAMAIS FABRIQUÉES ────────────────────
 *
 *  Déconnexion comme connexion : ce sont les ancres de la page qu'on
 *  relit. La déconnexion porte un jeton de session ; une adresse
 *  reconstruite mènerait à une erreur sous un libellé qui promet de
 *  déconnecter.
 *
 *  Rend `true` quand elle a trouvé la barre. */
function rangerLaBarreForumactif(
  doc: Document,
  nav: Navigation,
  identifiant: number | null,
  avatar: string | null,
  pseudo: string | null,
  secours?: () => void,
): boolean {
  const droite = doc.querySelector<HTMLElement>("#fa_right");
  if (droite === null) return false;
  //  Mesurée AVANT d'être masquée : si elle a une hauteur, c'est
  //  maintenant qu'on peut la lire. Après, elle vaut zéro — ce qui est
  //  justement ce qu'on veut pour la barre collée.
  mesurerLaToolbar(doc);

  const notre = doc.querySelector<HTMLElement>(".wm-nav__droite");
  if (notre === null) return true;
  if (notre.childElementCount > 0) return true;

  if (identifiant === null) {
    //  Déconnectée : on reprend ses deux liens tels quels. Les perdre
    //  serait pire que tout — un visiteur ne pourrait plus se connecter.
    //
    //  **`:scope >` et pas `a[href]` tout court.** La première version
    //  ramassait TOUT ce que la barre contenait, y compris le « Voir
    //  toutes les notifications » d'une liste déroulante — le harnais
    //  l'a attrapé. On ne prend que ses enfants directs, et on écarte
    //  `#fa_hide`, qui est son bouton « masquer la barre » : il n'a rien
    //  à faire chez nous puisqu'on la masque déjà.
    for (const a of droite.querySelectorAll<HTMLAnchorElement>(":scope > a[href]")) {
      if (a.id === "fa_hide") continue;
      const titre = a.textContent?.replace(/\s+/g, " ").trim() ?? "";
      const ou = a.getAttribute("href");
      if (titre === "" || ou === null || ou === "") continue;
      const lien = doc.createElement("a");
      lien.className = "wm-nav__lien wm-nav__lien--compte";
      lien.href = ou;
      lien.textContent = titre;
      notre.appendChild(lien);
    }
    rangerLaToolbar(doc);
    return true;
  }

  //  Les notifications d'abord : la cloche se lit à gauche du compte,
  //  comme partout ailleurs sur le web.
  const cloche = deplacerLaToolbar(doc, notre);

  //  Connectée : l'avatar rond de 24 px et le pseudo, comme la maquette
  //  `141:3646`. C'est un bouton — il ouvre le menu, il ne mène pas au
  //  profil, lequel est la première entrée du menu.
  const b = doc.createElement("button");
  b.type = "button";
  b.className = "wm-nav__compte";
  b.setAttribute("aria-haspopup", "true");
  b.setAttribute("aria-expanded", "false");
  b.setAttribute("aria-controls", "wm-compte-menu");

  const vignette = element(doc, "span", "wm-nav__avatar");
  if (avatar !== null) {
    const img = doc.createElement("img");
    img.src = avatar;
    img.alt = "";
    img.loading = "lazy";
    vignette.appendChild(img);
  }
  b.appendChild(vignette);
  //  Le pseudo vient de `_userdata`, pas d'un libellé de la toolbar :
  //  celui-ci change avec la langue du forum.
  b.appendChild(element(doc, "span", "wm-nav__pseudo", pseudo ?? "Mon compte"));
  notre.appendChild(b);

  const menu = menuDuCompte(doc, nav, identifiant, avatar);
  doc.body?.appendChild(menu);

  const basculer = (ouvrir: boolean): void => {
    //  ON LE MONTRE D'ABORD, ON LE PLACE ENSUITE : un élément `hidden`
    //  est en `display: none`, et sa largeur vaut zéro — la borne de
    //  l'écran serait calculée sur rien.
    menu.toggleAttribute("hidden", !ouvrir);
    if (ouvrir) placerLeMenu(doc, b, menu);
    b.setAttribute("aria-expanded", String(ouvrir));
  };

  b.addEventListener("click", (e) => {
    e.stopPropagation();
    basculer(menu.hasAttribute("hidden"));
  });

  //  Un menu flottant se ferme en cliquant à côté et à Échap. Sans ça il
  //  reste ouvert par-dessus la page qu'on essaie de lire.
  doc.addEventListener("click", (e) => {
    if (menu.hasAttribute("hidden")) return;
    if (e.target instanceof Node && menu.contains(e.target)) return;
    basculer(false);
  });
  doc.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !menu.hasAttribute("hidden")) basculer(false);
  });

  //  Le bloc flottant ne sert QUE de secours : deux endroits où lire ses
  //  notifications, c'est un de trop. Quand la cloche est là, elle gagne
  //  — c'est la vraie, celle que Forumactif met à jour tout seul.
  if (!cloche) secours?.();

  rangerLaToolbar(doc);
  return true;
}

/** Déménage la barre Forumactif ENTIÈRE dans la nôtre, pour ses
 *  notifications.
 *
 *  ── POURQUOI LA BARRE ENTIÈRE, ET PAS LA CLOCHE ─────────────────────
 *
 *  Première version : on déplaçait les trois nœuds — la cloche,
 *  `#notif_list`, `#live_notif` — et on les recalait à la feuille.
 *  Résultat rapporté par Callista : « c'est censé afficher les
 *  notifications qu'on a reçues, et pas ouvrir la page des notifs ».
 *
 *  La raison est entièrement dans leur code, lu le 7 octobre dans
 *  `FAToolbar.js` et dans la feuille `8-ltr.css` du forum :
 *
 *      case NOTIFICATIONS:
 *        $('#'+RIGHT).toggleClass('notification')…
 *
 *      #fa_toolbar #fa_right #notif_list          { display: none }
 *      #fa_toolbar #fa_right.notification
 *                              #notif_list        { display: block }
 *
 *  Deux choses s'en déduisent, et aucune ne se devinait :
 *
 *  1. **L'état « ouvert » est une classe sur `#fa_right`**, pas sur la
 *     cloche. Et la règle qui montre la liste exige la CHAÎNE
 *     `#fa_toolbar #fa_right …`. Sortir la liste de cette chaîne, c'est
 *     garantir qu'aucun clic ne l'ouvrira jamais — ce qui laissait pour
 *     seul comportement visible le lien « Voir toutes les
 *     notifications » qu'elle contient, d'où la page des notifs.
 *  2. Leur écouteur est posé sur `document` et branche sur
 *     **`e.target.id`**. Donc déplacer ne casse pas l'écouteur — mais un
 *     clic qui atterrit sur un ENFANT de la cloche tombe dans le
 *     `default`, qui referme. C'est pour ça que `#notif_unread` est en
 *     `pointer-events: none` dans la feuille : le clic doit toujours
 *     arriver sur la cloche elle-même.
 *
 *  On emmène donc `#fa_toolbar` tel quel, avec tout ce qu'il contient.
 *  Leur mécanique ne s'aperçoit de rien, et on ne réécrit pas une
 *  logique de notifications qui marche déjà.
 *
 *  ── CE QU'ON FAIT, ALORS ────────────────────────────────────────────
 *
 *  Rien que de l'apparence, et la feuille s'en charge : la barre perd sa
 *  position fixe et son fond, tout ce qu'on remplace nous-mêmes est
 *  masqué, et la cloche devient un lien comme les autres — « affiche
 *  simplement Notifications sans en faire un gros bouton ».
 *
 *  Rend `true` si la cloche est bien là. */
function deplacerLaToolbar(doc: Document, ou: HTMLElement): boolean {
  const toolbar = doc.querySelector<HTMLElement>("#fa_toolbar");
  if (toolbar === null) return false;

  //  LEUR ÉPINGLE, RETIRÉE. `fa_fix` est l'option « barre fixée en
  //  haut » de Forumactif, que leur script pose quand le membre l'a
  //  cochée dans son profil. Sa règle est
  //  `.fa_fix { position: fixed !important }` — un seul nom de classe,
  //  mais un `!important`, et un `!important` ne se bat qu'avec un
  //  autre. Mesuré sur le forum connecté le 7 octobre : la barre était
  //  bien déménagée dans la nôtre, et se peignait quand même en haut de
  //  l'écran, avec ses notifications dedans.
  //
  //  On la retire donc du nœud plutôt que de lui disputer sa règle :
  //  une barre rangée dans la nôtre n'a plus rien à épingler.
  toolbar.classList.remove("fa_fix");
  //  La classe, et pas des styles posés ici : la feuille est relue par
  //  le harnais de contraste, un style inline ne l'est pas.
  toolbar.classList.add("wm-toolbar-chez-nous");
  ou.appendChild(toolbar);

  const cloche = toolbar.querySelector<HTMLElement>("#fa_notifications");
  if (cloche === null) return false;

  //  L'étiquette est un ATTRIBUT, donc elle survit à une réécriture du
  //  contenu par leur script — ce qui arrive à chaque notification.
  cloche.setAttribute("aria-label", "Notifications");
  return true;
}

/** Masque la barre Forumactif et annule la marge qu'elle impose.
 *
 *  **La marge est en STYLE INLINE sur `body`** — `margin-top: 42px`,
 *  écrit par son script, mesuré sur le forum. Une règle CSS ordinaire ne
 *  la bat pas : on pose donc une classe, et la feuille s'en sert avec un
 *  `!important`, le seul du projet et il est justifié ici.
 *
 *  On ne retire RIEN : la barre reste dans la page, vivante. C'est une
 *  exigence du switcheroo, pas une précaution. */
function rangerLaToolbar(doc: Document): void {
  doc.body?.classList.add("wm-toolbar-rangee");
  //  Le jeton repasse à zéro : plus rien ne surplombe la barre, elle
  //  colle au bord.
  doc.documentElement.style.setProperty("--wm-haut-toolbar", "0px");
}

// ── l'assemblage ────────────────────────────────────────────────────

export type Dependances = {
  readonly doc: Document;
  /** Le contenu de `data/navigation.json`, déjà décodé. */
  readonly donnees: unknown;
  /** L'identifiant Forumactif du compte connecté, ou `null`. */
  readonly identifiant?: number | null;
  /** La source de l'avatar du compte, déjà extraite — pas le HTML brut
   *  que Forumactif met dans `_userdata.avatar`. */
  readonly avatar?: string | null;
  /** Le pseudo du compte connecté, lu dans `_userdata`. */
  readonly pseudo?: string | null;
  /** Le nombre de messages non lus, relevé AVANT la réécriture de la
   *  barre — c'est Forumactif qui l'écrit dans le lien « Messagerie ». */
  readonly messages?: number;
  /** Ce qu'on fait si Forumactif n'a PAS de cloche de notifications —
   *  toolbar désactivée, par exemple. Appelé au plus une fois. */
  readonly secoursNotifications?: () => void;
};

/**
 * Pose la barre, le panneau et le menu. Rend `true` si la barre a été
 * trouvée et réécrite.
 */
export function poserLaNavigation(
  {
    doc,
    donnees,
    identifiant = null,
    avatar = null,
    pseudo = null,
    messages = 0,
    secoursNotifications,
  }: Dependances,
): boolean {
  const nav = navigationDepuis(donnees);
  if (nav.liens.length === 0) return false;

  const bouton = poserLaBarre(doc, nav, messages);
  if (bouton === null) return false;

  const panneau = panneauEnDOM(doc, nav);
  doc.body?.appendChild(panneau);

  const basculer = (ouvrir: boolean): void => {
    //  **On ne touche plus à `hidden` pour ouvrir.** Il met l'élément en
    //  `display: none`, et `display` ne s'anime pas : le panneau
    //  apparaissait d'un coup, sans dire d'où il venait. L'état est donc
    //  une classe, et le CSS fait glisser la position.
    //  On relit les personnages À L'OUVERTURE, pas au chargement : le
    //  switcheroo se charge après nous et redessine sa liste.
    if (ouvrir) remplirLesPersonnages(doc, panneau);
    panneau.classList.toggle("wm-panneau--ouvert", ouvrir);
    bouton.setAttribute("aria-expanded", String(ouvrir));
    bouton.setAttribute("aria-label", ouvrir ? "Fermer le panneau" : "Ouvrir le panneau");
    bouton.classList.toggle("wm-nav__logo--ouvert", ouvrir);
    //  La maquette met une croix à la place du losange tant que le
    //  panneau est ouvert.
    const marque = bouton.querySelector(".wm-nav__losange");
    if (marque !== null) marque.textContent = ouvrir ? "✕" : "◈";
  };
  const ouvert = (): boolean => panneau.classList.contains("wm-panneau--ouvert");
  bouton.addEventListener("click", () => basculer(!ouvert()));
  //  Échap ferme, comme partout : un panneau qui couvre l'écran sans
  //  issue au clavier est un piège.
  doc.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && ouvert()) basculer(false);
  });

  //  Elle peut changer de hauteur quand la fenêtre change de largeur :
  //  ses liens passent à la ligne. Une barre calée sur l'ancienne mesure
  //  laisserait un trou ou se ferait recouvrir.
  doc.defaultView?.addEventListener("resize", () => mesurerLaToolbar(doc));

  //  `#fa_toolbar` est posée par un script tiers, après nous. On la
  //  guette, et on arrête de guetter — un observateur qui tourne pour
  //  rien est une fuite.
  if (!rangerLaBarreForumactif(doc, nav, identifiant, avatar, pseudo, secoursNotifications)) {
    const guetteur = new MutationObserver(() => {
      if (
        rangerLaBarreForumactif(doc, nav, identifiant, avatar, pseudo, secoursNotifications)
      ) {
        guetteur.disconnect();
      }
    });
    guetteur.observe(doc.documentElement, { childList: true, subtree: true });
    setTimeout(() => guetteur.disconnect(), 10_000);
  }
  return true;
}
