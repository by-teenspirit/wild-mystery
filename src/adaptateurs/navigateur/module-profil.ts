/// <reference lib="dom" />
// ════════════════════════════════════════════════════════════════════
//  src/adaptateurs/navigateur/module-profil.ts
//
//  COUVERT PAR : outils/profil.mjs
//
//  LE PROFIL D'UN MEMBRE — `/uN`, et ses quatre autres onglets.
//
//  ── CE MODULE DÉPLACE, IL N'INVENTE PAS ─────────────────────────────
//
//  Tout ce qu'il pose vient de la page : l'avatar, le nom coloré, le
//  rang, les chiffres, les récompenses. Il ne va rien chercher, il ne
//  fabrique aucune valeur, et il ne fait pas une requête.
//
//  C'est une règle, pas une économie. Un profil est la page qu'on
//  regarde pour savoir à qui on parle : si le module tombe, la page
//  doit rester juste. Elle sera moins belle, elle ne mentira pas.
//
//  Et c'est pour ça que les NŒUDS sont déplacés plutôt que recopiés :
//  le pseudo garde le `style="color:…"` que Forumactif pose dessus, et
//  reste d'accord avec le panneau d'administration sans qu'on ait une
//  couleur à tenir de notre côté. Une copie du TEXTE aurait perdu la
//  couleur du groupe au premier changement.
//
//  ── POURQUOI IL FAUT UN MODULE DU TOUT ──────────────────────────────
//
//  Parce que le gabarit ne donne pas cette page. Mesuré le 8 novembre
//  sur `/u1`, déconnectée : `#profile-advanced-layout`, `#tabs`, la
//  colonne de droite et ses modules sont posés par Forumactif en mode
//  « profil avancé », sans variable ni bloc. Seuls les champs de
//  profil et la feuille de personnage sortent de `profile_view_body`.
//
//  On ne peut donc pas écrire ce balisage : on le remet en ordre.
//
//  ── CE QU'IL NE FAIT PAS ────────────────────────────────────────────
//
//  Il ne touche ni au niveau, ni à l'expérience, ni à l'équipe, ni à
//  l'argent — la section « son jeu » de la maquette. Ces quatre-là
//  viennent de Supabase et se lisent par identifiant de membre ; c'est
//  une requête, donc un autre module, qui pourra se brancher sur la
//  place que celui-ci laisse (`wm-profil-page__jeu`).
// ════════════════════════════════════════════════════════════════════

/** L'identifiant du membre, lu dans l'adresse : `/u42`, `/u42rpg`. */
export function identifiantDuProfil(adresse: string): number | null {
  const trouve = /\/u(\d+)(?:[a-z]*)?(?:[/?#]|$)/.exec(adresse);
  if (trouve === null) return null;
  const n = Number(trouve[1]);
  return Number.isInteger(n) && n > 0 ? n : null;
}

/** Enlève « Rang : » et les deux-points d'un libellé. */
function sansLeLibelle(texte: string): string {
  return texte.replace(/^[^:]*:\s*/, "").trim();
}

/** Le texte d'un champ de profil, cherché par son libellé. */
function champ(racine: ParentNode, libelle: string): HTMLElement | null {
  for (const dl of Array.from(racine.querySelectorAll("dl"))) {
    const dt = dl.querySelector("dt");
    if (dt === null) continue;
    const mot = dt.textContent?.replace(/\s*:\s*$/, "").trim().toLowerCase() ?? "";
    if (mot === libelle.toLowerCase()) return dl.querySelector("dd");
  }
  return null;
}

/** Un chiffre de la carte : le nombre, puis le mot. */
function chiffre(doc: Document, nombre: string, mot: string): HTMLLIElement {
  const li = doc.createElement("li");
  li.className = "wm-profil-page__chiffre";
  const b = doc.createElement("b");
  b.className = "wm-profil-page__nombre";
  b.textContent = nombre;
  const s = doc.createElement("span");
  s.className = "wm-profil-page__mot";
  s.textContent = mot;
  li.appendChild(b);
  li.appendChild(s);
  return li;
}

function bouton(doc: Document, adresse: string, mot: string, calme = false): HTMLAnchorElement {
  const a = doc.createElement("a");
  a.href = adresse;
  a.className = "wm-profil-page__bouton" +
    (calme ? " wm-profil-page__bouton--calme" : "");
  a.textContent = mot;
  return a;
}

/**
 * Remet en ordre la page de profil. Rend `false` si la page n'en est
 * pas une, ou si le balisage attendu n'est pas là.
 */
export function poserLeProfil(doc: Document): boolean {
  const gauche = doc.querySelector("#profile-advanced-left");
  const droite = doc.querySelector("#profile-advanced-right");
  if (gauche === null) return false;
  //  Déjà posé : on ne construit pas deux cartes.
  if (doc.querySelector(".wm-profil-page") !== null) return false;

  const identifiant = identifiantDuProfil(doc.location?.pathname ?? "");

  const page = doc.createElement("div");
  page.className = "wm-profil-page";

  // ── LA CARTE D'IDENTITÉ ───────────────────────────────────────────
  const carte = doc.createElement("section");
  carte.className = "wm-profil-page__carte";

  //  L'AVATAR. Forumactif lui pose déjà `max-width: 200px;
  //  max-height: 320px` en style inline — la taille réglée dans le
  //  panneau. On retire ce style : la feuille dessine une case de
  //  200 × 320 et l'image la remplit. Laissé en place, il empêcherait
  //  justement l'image de remplir la case.
  const avatar = droite?.querySelector(".mod-login-avatar img") ?? null;
  if (avatar !== null) {
    avatar.removeAttribute("style");
    avatar.classList.add("wm-profil-page__avatar");
    carte.appendChild(avatar);
  }

  const ident = doc.createElement("div");
  ident.className = "wm-profil-page__ident";

  const tete = doc.createElement("div");
  tete.className = "wm-profil-page__tete";

  //  LE NOM, AVEC SON `span.usr_grp_clr` INTACT. Le titre de la page
  //  est « Tout à propos de <span>Arceus</span> » : on garde le span
  //  et on jette le reste, qui est une phrase, pas un nom.
  const titre = gauche.querySelector("#cp-main h1");
  const nom = doc.createElement("h1");
  nom.className = "wm-profil-page__nom";
  const colore = titre?.querySelector(".usr_grp_clr") ??
    droite?.querySelector(".h3 .usr_grp_clr") ?? null;
  if (colore !== null) nom.appendChild(colore);
  else nom.textContent = titre?.textContent?.trim() ?? "";
  tete.appendChild(nom);

  //  LE RANG. Le bloc dit « <br>Rang: <ed>en découverte</ed> » — le
  //  libellé est dans le même nœud que la valeur, d'où le découpage
  //  sur les deux-points. L'image de rang, quand il y en a une, est
  //  gardée telle quelle.
  const bloc = droite?.querySelector(".mod-login-rank") ?? null;
  if (bloc !== null) {
    const mot = sansLeLibelle(bloc.textContent ?? "");
    const image = bloc.querySelector("img");
    if (image !== null) {
      image.classList.add("wm-profil-page__rang-image");
      tete.appendChild(image);
    }
    if (mot !== "") {
      const rang = doc.createElement("span");
      rang.className = "wm-profil-page__rang";
      rang.textContent = mot;
      tete.appendChild(rang);
    }
  }
  ident.appendChild(tete);

  //  LES CHIFFRES, pris dans les champs de profil. On ne garde que
  //  ceux qui sont là : un forum qui n'affiche pas le compteur de
  //  messages ne doit pas montrer « — messages ».
  const chiffres = doc.createElement("ul");
  chiffres.className = "wm-profil-page__chiffres";
  const messages = champ(gauche, "Messages postés");
  if (messages !== null) {
    chiffres.appendChild(chiffre(doc, messages.textContent?.trim() ?? "", "messages"));
  }
  const inscription = champ(gauche, "Date d'inscription");
  if (inscription !== null) {
    chiffres.appendChild(
      chiffre(doc, inscription.textContent?.trim() ?? "", "inscrit·e le"),
    );
  }
  const badges = droite?.querySelectorAll(".awards_module .award") ?? [];
  if (badges.length > 0) {
    chiffres.appendChild(chiffre(doc, String(badges.length), "badges"));
  }
  if (chiffres.children.length > 0) ident.appendChild(chiffres);

  //  LES RÉCOMPENSES, sous les chiffres. Leur image est déjà dans la
  //  page, en variable CSS ; la feuille la peint.
  if (badges.length > 0) {
    const liste = doc.createElement("ul");
    liste.className = "wm-profil-page__badges";
    for (const b of Array.from(badges)) {
      const li = doc.createElement("li");
      li.appendChild(b);
      liste.appendChild(li);
    }
    ident.appendChild(liste);
  }

  //  LES ACTIONS. Trois adresses natives de Forumactif, et aucune
  //  inventée : `/privmsg?mode=post&u=N` est le formulaire d'envoi,
  //  `/spa/<pseudo>` et `/sta/<pseudo>` sont les recherches que le
  //  gabarit par défaut écrit lui-même sous le compteur de messages.
  const actions = doc.createElement("div");
  actions.className = "wm-profil-page__actions";
  if (identifiant !== null) {
    actions.appendChild(
      bouton(doc, `/privmsg?mode=post&u=${identifiant}`, "Envoyer un message"),
    );
  }
  const pseudo = colore?.textContent?.trim() ?? "";
  if (pseudo !== "") {
    actions.appendChild(
      bouton(doc, `/spa/${encodeURIComponent(pseudo)}`, "Voir ses messages", true),
    );
    actions.appendChild(
      bouton(doc, `/sta/${encodeURIComponent(pseudo)}`, "Ses sujets", true),
    );
  }
  if (actions.children.length > 0) ident.appendChild(actions);

  carte.appendChild(ident);
  page.appendChild(carte);

  // ── LES ONGLETS ───────────────────────────────────────────────────
  //
  //  Ce sont cinq pages. On refait des `<a>` propres plutôt que de
  //  styler les `li > a > span` d'origine : l'onglet courant a
  //  `href="#"` chez Forumactif, ce qui en fait un lien qui ne mène
  //  nulle part — mauvais pour tout le monde, et trompeur pour un
  //  lecteur d'écran. Ici il devient un lien vers sa propre page,
  //  marqué `aria-current`.
  const onglets = Array.from(gauche.querySelectorAll("#tabs li"));
  if (onglets.length > 0) {
    const barre = doc.createElement("nav");
    barre.setAttribute("aria-label", "Les pages de ce profil");
    const ul = doc.createElement("ul");
    ul.className = "wm-profil-page__onglets";
    for (const li of onglets) {
      const a = li.querySelector("a");
      if (a === null) continue;
      const courant = li.classList.contains("activetab");
      const lien = doc.createElement("a");
      const vise = a.getAttribute("href") ?? "#";
      lien.href = courant && vise === "#" && identifiant !== null ? `/u${identifiant}` : vise;
      //  LE COMPOSANT DU SITE, PAS UN ONGLET À MOI. `wm-onglet` habille
      //  déjà les annexes, le carnet et la faune ; un sixième dessin
      //  d'onglet serait un sixième à tenir. Le mot va dans un `span`
      //  parce que le composant espace ses enfants.
      lien.className = "wm-onglet" + (courant ? " wm-onglet--actif" : "");
      const mot = doc.createElement("span");
      mot.className = "wm-onglet__mot";
      mot.textContent = a.textContent?.trim() ?? "";
      lien.appendChild(mot);
      if (courant) lien.setAttribute("aria-current", "page");
      const item = doc.createElement("li");
      item.appendChild(lien);
      ul.appendChild(item);
    }
    barre.appendChild(ul);
    page.appendChild(barre);
  }

  // ── LE PANNEAU DE L'ONGLET ────────────────────────────────────────
  const panneau = doc.createElement("section");
  panneau.className = "wm-profil-page__panneau";

  //  LES CHAMPS DE PROFIL deviennent une liste de lignes. On déplace
  //  les `<dl>` tels quels : leur `id` sert au script d'édition en
  //  place de Forumactif, qui tourne après nous.
  const champs = gauche.querySelector("#profile-tab-field-profil");
  if (champs !== null) {
    const liste = doc.createElement("div");
    liste.className = "wm-profil-page__champs";
    for (const dl of Array.from(champs.querySelectorAll("dl"))) liste.appendChild(dl);
    panneau.appendChild(liste);
  }

  //  TOUT LE RESTE DU CONTENU D'ONGLET SUIT, dans l'ordre où il est.
  //  Les quatre autres pages — groupes, récompenses, contact, feuille
  //  de personnage — n'ont pas le même balisage, et les énumérer ici
  //  reviendrait à tenir une liste qui vieillirait à la première page
  //  que Forumactif change. La feuille les habille par leurs classes.
  const corps = gauche.querySelector("#cp-main");
  if (corps !== null) {
    for (const enfant of Array.from(corps.children)) {
      if (enfant.tagName === "H1") continue;
      panneau.appendChild(enfant);
    }
  }
  page.appendChild(panneau);

  //  LA PLACE DE « SON JEU », vide pour l'instant : niveau,
  //  expérience, équipe et argent se lisent dans Supabase par
  //  identifiant de membre. Le jour où ce module existe, il remplit
  //  cette section au lieu d'avoir à refaire la mise en page.
  if (identifiant !== null) {
    const jeu = doc.createElement("section");
    jeu.className = "wm-profil-page__jeu";
    jeu.dataset.wmMembre = String(identifiant);
    jeu.hidden = true;
    page.appendChild(jeu);
  }

  gauche.replaceWith(page);
  return true;
}
