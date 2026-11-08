(() => {
  // src/navigateur/annexes.ts
  var VIDE = {
    sections: []
  };
  function texte(v) {
    return typeof v === "string" ? v.replace(/\s+/g, " ").trim() : "";
  }
  function adresse(v) {
    const a = texte(v);
    return /^\/(?!\/)[^\s]*$/.test(a) ? a : null;
  }
  function entreeDepuis(brute) {
    if (typeof brute !== "object" || brute === null) return null;
    const r = brute;
    const titre = texte(r.titre);
    const slug2 = texte(r.slug);
    if (titre === "" || slug2 === "") return null;
    return {
      numero: texte(r.numero),
      slug: slug2,
      titre,
      adresse: adresse(r.adresse)
    };
  }
  function sommaireDepuis(donnees) {
    if (typeof donnees !== "object" || donnees === null) return VIDE;
    const d = donnees;
    if (!Array.isArray(d.sections)) return VIDE;
    const sections = [];
    for (const brute of d.sections) {
      if (typeof brute !== "object" || brute === null) continue;
      const s = brute;
      if (!Array.isArray(s.entrees)) continue;
      const entrees = s.entrees.map(entreeDepuis).filter((e) => e !== null);
      if (entrees.length > 0) sections.push({
        titre: texte(s.titre),
        entrees
      });
    }
    return {
      sections
    };
  }
  function slugDepuisAdresse(chemin) {
    const trouve = /^\/h\d+-([a-z0-9-]+)\/?$/.exec(chemin);
    return trouve === null ? null : trouve[1];
  }
  function sommaireAffiche(sommaire, slugCourant) {
    return sommaire.sections.map((s) => ({
      titre: s.titre,
      entrees: s.entrees.map((e) => {
        const active = slugCourant !== null && e.slug === slugCourant;
        return {
          ...e,
          active,
          //  UNE PAGE QU'ON EST EN TRAIN DE LIRE N'EST PAS « À VENIR ».
          //  `adresse` dit seulement si quelqu'un l'a reportée dans
          //  `annexes.json` ; la page, elle, est sous les yeux. Sans
          //  cette ligne, son entrée cumulait le fond d'accent de
          //  l'entrée courante et la pâleur de l'entrée absente, et
          //  tombait à 3,47 de contraste — la seule illisible du
          //  sommaire, sur chacune des pages pas encore reportées.
          aVenir: e.adresse === null && !active
        };
      })
    }));
  }

  // src/adaptateurs/navigateur/module-annexes.ts
  function element(doc, balise, classe, texte2) {
    const e = doc.createElement(balise);
    e.className = classe;
    if (texte2 !== void 0) e.textContent = texte2;
    return e;
  }
  function entreeEnDOM(doc, e) {
    const li = element(doc, "li", "wm-annexe__entree");
    if (e.active) li.classList.add("wm-annexe__entree--active");
    if (e.aVenir) li.classList.add("wm-annexe__entree--a-venir");
    const cliquable = !e.aVenir && !e.active;
    const corps = doc.createElement(cliquable ? "a" : "span");
    corps.className = "wm-annexe__lien";
    if (cliquable && e.adresse !== null) corps.href = e.adresse;
    if (e.active) corps.setAttribute("aria-current", "page");
    corps.appendChild(doc.createTextNode(e.numero === "" ? e.titre : `${e.numero} \xB7 ${e.titre}`));
    li.appendChild(corps);
    return li;
  }
  function sectionEnDOM(doc, s, premiere) {
    const bloc = element(doc, "div", "wm-annexe__section");
    if (s.titre !== "" && !premiere) {
      bloc.appendChild(element(doc, "p", "wm-annexe__intertitre", s.titre));
    }
    const liste = element(doc, "ul", "wm-annexe__liste");
    for (const e of s.entrees) liste.appendChild(entreeEnDOM(doc, e));
    bloc.appendChild(liste);
    return bloc;
  }
  function poserLeSommaire({ doc, donnees }) {
    const trou = doc.querySelector("[data-wm-sommaire]");
    if (trou === null) return false;
    const sections = sommaireAffiche(sommaireDepuis(donnees), slugDepuisAdresse(doc.location?.pathname ?? ""));
    if (sections.length === 0) return false;
    trou.textContent = "";
    const entete = element(doc, "div", "wm-annexe__entete");
    const logo = element(doc, "div", "wm-annexe__logo");
    logo.setAttribute("aria-hidden", "true");
    entete.appendChild(logo);
    entete.appendChild(element(doc, "p", "wm-annexe__enseigne", "Les annexes"));
    trou.appendChild(entete);
    sections.forEach((s, i) => trou.appendChild(sectionEnDOM(doc, s, i === 0)));
    return true;
  }
  function poserLaSuivante({ doc, donnees }) {
    const bouton2 = doc.querySelector("a.wm-suivante__bouton");
    if (bouton2 === null) return false;
    const sections = sommaireAffiche(sommaireDepuis(donnees), slugDepuisAdresse(doc.location?.pathname ?? ""));
    const toutes = sections.flatMap((s) => s.entrees);
    const ici = toutes.findIndex((e) => e.active);
    if (ici === -1) return false;
    const suite = toutes.slice(ici + 1).concat(toutes.slice(0, ici)).find((e) => e.adresse !== null && !e.aVenir);
    if (suite === void 0 || suite.adresse === null) {
      bouton2.remove();
      return false;
    }
    bouton2.setAttribute("href", suite.adresse);
    const etiquette = bouton2.querySelector(".wm-suivante__etiquette");
    bouton2.textContent = "";
    if (etiquette !== null) bouton2.appendChild(etiquette);
    bouton2.appendChild(doc.createTextNode(` ${suite.titre} \u2192`));
    return true;
  }

  // src/navigateur/theme.ts
  var CHOIX_PAR_DEFAUT = "systeme";
  var CLASSE_SOMBRE = "wm-sombre";
  function estUnChoixDeTheme(valeur) {
    return valeur === "clair" || valeur === "sombre" || valeur === "systeme";
  }
  function themeApplique(choix, systemeEstSombre2) {
    if (choix === "systeme") return systemeEstSombre2 ? "sombre" : "clair";
    return choix;
  }
  function destination(applique) {
    return applique === "clair" ? "sombre" : "clair";
  }
  function choixApresClic(choix, systemeEstSombre2) {
    return destination(themeApplique(choix, systemeEstSombre2));
  }

  // src/adaptateurs/navigateur/coin-outils.ts
  var SVG = "http://www.w3.org/2000/svg";
  function svg(enfants, doc) {
    const racine = doc.createElementNS(SVG, "svg");
    racine.setAttribute("viewBox", "0 0 16 16");
    racine.setAttribute("aria-hidden", "true");
    racine.setAttribute("focusable", "false");
    for (const e of enfants(doc)) racine.appendChild(e);
    return racine;
  }
  function lune(doc) {
    return svg((d) => {
      const p = d.createElementNS(SVG, "path");
      p.setAttribute("d", "M13 9.3A5.6 5.6 0 0 1 6.2 2.6a5.8 5.8 0 1 0 6.8 6.7z");
      p.setAttribute("fill", "currentColor");
      return [
        p
      ];
    }, doc);
  }
  function soleil(doc) {
    return svg((d) => {
      const coeur = d.createElementNS(SVG, "circle");
      coeur.setAttribute("cx", "8");
      coeur.setAttribute("cy", "8");
      coeur.setAttribute("r", "3.1");
      coeur.setAttribute("fill", "currentColor");
      const rayons = d.createElementNS(SVG, "circle");
      rayons.setAttribute("cx", "8");
      rayons.setAttribute("cy", "8");
      rayons.setAttribute("r", "6.2");
      rayons.setAttribute("fill", "none");
      rayons.setAttribute("stroke", "currentColor");
      rayons.setAttribute("stroke-width", "1.7");
      rayons.setAttribute("stroke-linecap", "round");
      rayons.setAttribute("stroke-dasharray", "1.2 3.67");
      return [
        coeur,
        rayons
      ];
    }, doc);
  }

  // src/adaptateurs/navigateur/module-theme-annexe.ts
  var CLASSE_BOUTON = "wm-retour__theme";
  function systemeEstSombre() {
    return globalThis.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false;
  }
  function appliquer(doc, theme) {
    doc.body?.classList.toggle(CLASSE_SOMBRE, theme === "sombre");
  }
  function libelle(applique) {
    return destination(applique) === "sombre" ? "Sombre" : "Clair";
  }
  function poserLeTheme(doc, prefs) {
    const barre = doc.querySelector(".wm-retour");
    if (barre === null) return false;
    if (barre.querySelector(`.${CLASSE_BOUTON}`) !== null) return false;
    const rendre = () => {
      const t = themeApplique(prefs.theme(), systemeEstSombre());
      appliquer(doc, t);
      return t;
    };
    const bouton2 = doc.createElement("button");
    bouton2.type = "button";
    bouton2.className = `wm-retour__lien ${CLASSE_BOUTON}`;
    const habiller = () => {
      const t = rendre();
      const mot = libelle(t);
      bouton2.textContent = "";
      bouton2.appendChild(destination(t) === "sombre" ? lune(doc) : soleil(doc));
      bouton2.appendChild(doc.createTextNode(mot));
      bouton2.setAttribute("aria-label", `Passer en th\xE8me ${mot.toLowerCase()}`);
    };
    habiller();
    bouton2.addEventListener("click", () => {
      prefs.poserTheme(choixApresClic(prefs.theme(), systemeEstSombre()));
      habiller();
    });
    barre.appendChild(bouton2);
    return true;
  }

  // src/adaptateurs/navigateur/module-tw.ts
  var SANS_LIBELLE = "contenu sensible";
  function libelleDe(balise) {
    for (const nom of [
      "data-wm-tw",
      "data-mot",
      "title"
    ]) {
      const lu = balise.getAttribute(nom);
      if (lu !== null && lu.trim() !== "") return lu.trim();
    }
    return SANS_LIBELLE;
  }
  function poserLesAvertissements(doc) {
    const balises = doc.querySelectorAll(".postbody .content tw, .postbody .content .wm-tw-source");
    let pose = 0;
    for (const balise of Array.from(balises)) {
      if (balise.closest(".wm-tw") !== null) continue;
      const mot = libelleDe(balise);
      const numero = `wm-tw-${pose + 1}-${Math.random().toString(36).slice(2, 7)}`;
      const bloc = doc.createElement("div");
      bloc.className = "wm-tw";
      const tete = doc.createElement("div");
      tete.className = "wm-tw__tete";
      const bouton2 = doc.createElement("button");
      bouton2.type = "button";
      bouton2.className = "wm-tw__bouton";
      bouton2.textContent = "Afficher ce passage";
      bouton2.setAttribute("aria-expanded", "false");
      bouton2.setAttribute("aria-controls", numero);
      const etiquette = doc.createElement("span");
      etiquette.className = "wm-tw__mot";
      etiquette.textContent = mot;
      const passage = doc.createElement("div");
      passage.className = "wm-tw__passage";
      passage.id = numero;
      passage.setAttribute("aria-hidden", "true");
      while (balise.firstChild !== null) passage.appendChild(balise.firstChild);
      tete.appendChild(bouton2);
      tete.appendChild(etiquette);
      bloc.appendChild(tete);
      bloc.appendChild(passage);
      bouton2.addEventListener("click", () => {
        const ouvert = bloc.classList.toggle("wm-tw--ouvert");
        bouton2.setAttribute("aria-expanded", ouvert ? "true" : "false");
        passage.setAttribute("aria-hidden", ouvert ? "false" : "true");
        bouton2.textContent = ouvert ? "Masquer ce passage" : "Afficher ce passage";
      });
      balise.replaceWith(bloc);
      pose += 1;
    }
    return pose;
  }

  // src/adaptateurs/navigateur/module-profil.ts
  function identifiantDuProfil(adresse2) {
    const trouve = /\/u(\d+)(?:[a-z]*)?(?:[/?#]|$)/.exec(adresse2);
    if (trouve === null) return null;
    const n = Number(trouve[1]);
    return Number.isInteger(n) && n > 0 ? n : null;
  }
  function sansLeLibelle(texte2) {
    return texte2.replace(/^[^:]*:\s*/, "").trim();
  }
  function champ(racine, libelle2) {
    for (const dl of Array.from(racine.querySelectorAll("dl"))) {
      const dt = dl.querySelector("dt");
      if (dt === null) continue;
      const mot = dt.textContent?.replace(/\s*:\s*$/, "").trim().toLowerCase() ?? "";
      if (mot === libelle2.toLowerCase()) return dl.querySelector("dd");
    }
    return null;
  }
  function chiffre(doc, nombre, mot) {
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
  function bouton(doc, adresse2, mot, calme = false) {
    const a = doc.createElement("a");
    a.href = adresse2;
    a.className = "wm-profil-page__bouton" + (calme ? " wm-profil-page__bouton--calme" : "");
    a.textContent = mot;
    return a;
  }
  function poserLeProfil(doc) {
    const gauche = doc.querySelector("#profile-advanced-left");
    const droite = doc.querySelector("#profile-advanced-right");
    if (gauche === null) return false;
    if (doc.querySelector(".wm-profil-page") !== null) return false;
    const identifiant = identifiantDuProfil(doc.location?.pathname ?? "");
    const page = doc.createElement("div");
    page.className = "wm-profil-page";
    const carte = doc.createElement("section");
    carte.className = "wm-profil-page__carte";
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
    const titre = gauche.querySelector("#cp-main h1");
    const nom = doc.createElement("h1");
    nom.className = "wm-profil-page__nom";
    const colore = titre?.querySelector(".usr_grp_clr") ?? droite?.querySelector(".h3 .usr_grp_clr") ?? null;
    if (colore !== null) nom.appendChild(colore);
    else nom.textContent = titre?.textContent?.trim() ?? "";
    tete.appendChild(nom);
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
    const chiffres = doc.createElement("ul");
    chiffres.className = "wm-profil-page__chiffres";
    const messages = champ(gauche, "Messages post\xE9s");
    if (messages !== null) {
      chiffres.appendChild(chiffre(doc, messages.textContent?.trim() ?? "", "messages"));
    }
    const inscription = champ(gauche, "Date d'inscription");
    if (inscription !== null) {
      chiffres.appendChild(chiffre(doc, inscription.textContent?.trim() ?? "", "inscrit\xB7e le"));
    }
    const badges = droite?.querySelectorAll(".awards_module .award") ?? [];
    if (badges.length > 0) {
      chiffres.appendChild(chiffre(doc, String(badges.length), "badges"));
    }
    if (chiffres.children.length > 0) ident.appendChild(chiffres);
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
    const actions = doc.createElement("div");
    actions.className = "wm-profil-page__actions";
    if (identifiant !== null) {
      actions.appendChild(bouton(doc, `/privmsg?mode=post&u=${identifiant}`, "Envoyer un message"));
    }
    const pseudo = colore?.textContent?.trim() ?? "";
    if (pseudo !== "") {
      actions.appendChild(bouton(doc, `/spa/${encodeURIComponent(pseudo)}`, "Voir ses messages", true));
      actions.appendChild(bouton(doc, `/sta/${encodeURIComponent(pseudo)}`, "Ses sujets", true));
    }
    if (actions.children.length > 0) ident.appendChild(actions);
    carte.appendChild(ident);
    page.appendChild(carte);
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
    const panneau = doc.createElement("section");
    panneau.className = "wm-profil-page__panneau";
    const champs = gauche.querySelector("#profile-tab-field-profil");
    if (champs !== null) {
      const liste = doc.createElement("div");
      liste.className = "wm-profil-page__champs";
      for (const dl of Array.from(champs.querySelectorAll("dl"))) liste.appendChild(dl);
      panneau.appendChild(liste);
    }
    const corps = gauche.querySelector("#cp-main");
    if (corps !== null) {
      for (const enfant of Array.from(corps.children)) {
        if (enfant.tagName === "H1") continue;
        panneau.appendChild(enfant);
      }
    }
    page.appendChild(panneau);
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

  // src/navigateur/sprites.ts
  var STYLE_PAR_DEFAUT = "forum";
  function estUnStyleDeSprite(valeur) {
    return valeur === "forum" || valeur === "retro" || valeur === "gba-ds";
  }

  // src/navigateur/confort.ts
  var CONFORTS = [
    "animations",
    "texte",
    "espacement",
    "liens",
    "dyslexie"
  ];
  function estUnConfort(v) {
    return typeof v === "string" && CONFORTS.includes(v);
  }
  function confortsDepuis(brut) {
    if (typeof brut !== "string") return [];
    const vus = /* @__PURE__ */ new Set();
    for (const morceau of brut.split(",")) {
      const m = morceau.trim();
      if (estUnConfort(m)) vus.add(m);
    }
    return CONFORTS.filter((c) => vus.has(c));
  }
  function texteDesConforts(actifs) {
    return CONFORTS.filter((c) => actifs.includes(c)).join(",");
  }

  // src/navigateur/preferences.ts
  var CLE_THEME = "wm.theme";
  var CLE_SPRITES = "wm.sprites";
  var CLE_CONFORT = "wm.confort";
  var Preferences = class {
    stockage;
    constructor(stockage) {
      this.stockage = stockage;
    }
    /** Lit, valide, et rend le défaut plutôt que de faire confiance. */
    lire(cle, estValide, defaut) {
      let brut;
      try {
        brut = this.stockage.lire(cle);
      } catch {
        return defaut;
      }
      return estValide(brut) ? brut : defaut;
    }
    ecrire(cle, valeur) {
      try {
        this.stockage.ecrire(cle, valeur);
      } catch {
      }
    }
    theme() {
      return this.lire(CLE_THEME, estUnChoixDeTheme, CHOIX_PAR_DEFAUT);
    }
    poserTheme(choix) {
      this.ecrire(CLE_THEME, choix);
    }
    styleDeSprite() {
      return this.lire(CLE_SPRITES, estUnStyleDeSprite, STYLE_PAR_DEFAUT);
    }
    poserStyleDeSprite(style) {
      this.ecrire(CLE_SPRITES, style);
    }
    /** Les réglages d'accessibilité cochés.
     *
     *  Ils ne passent pas par `lire` : celui-ci valide une valeur entière
     *  et rend un défaut, alors qu'une liste se nettoie morceau par
     *  morceau. Un nom inconnu coûte un réglage, pas les trois. */
    conforts() {
      try {
        return confortsDepuis(this.stockage.lire(CLE_CONFORT));
      } catch {
        return [];
      }
    }
    poserConforts(actifs) {
      this.ecrire(CLE_CONFORT, texteDesConforts(actifs));
    }
  };

  // src/adaptateurs/navigateur/stockage.ts
  var StockageLocal = class {
    lire(cle) {
      return localStorage.getItem(cle);
    }
    ecrire(cle, valeur) {
      localStorage.setItem(cle, valeur);
    }
  };

  // js/harnais-sommaire.ts
  var g = globalThis;
  g.wmPoserLeSommaire = (donnees) => {
    const pose = poserLeSommaire({
      doc: document,
      donnees
    });
    poserLaSuivante({
      doc: document,
      donnees
    });
    return pose;
  };
  g.wmPoserLeTheme = () => poserLeTheme(document, new Preferences(new StockageLocal()));
  g.wmPoserLesAvertissements = () => poserLesAvertissements(document);
  g.wmPoserLeProfil = () => poserLeProfil(document);
})();
