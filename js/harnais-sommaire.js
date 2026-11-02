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
    const slug = texte(r.slug);
    if (titre === "" || slug === "") return null;
    return {
      numero: texte(r.numero),
      slug,
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
    const bouton = doc.querySelector("a.wm-suivante__bouton");
    if (bouton === null) return false;
    const sections = sommaireAffiche(sommaireDepuis(donnees), slugDepuisAdresse(doc.location?.pathname ?? ""));
    const toutes = sections.flatMap((s) => s.entrees);
    const ici = toutes.findIndex((e) => e.active);
    if (ici === -1) return false;
    const suite = toutes.slice(ici + 1).concat(toutes.slice(0, ici)).find((e) => e.adresse !== null && !e.aVenir);
    if (suite === void 0 || suite.adresse === null) {
      bouton.remove();
      return false;
    }
    bouton.setAttribute("href", suite.adresse);
    const etiquette = bouton.querySelector(".wm-suivante__etiquette");
    bouton.textContent = "";
    if (etiquette !== null) bouton.appendChild(etiquette);
    bouton.appendChild(doc.createTextNode(` ${suite.titre} \u2192`));
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
    const bouton = doc.createElement("button");
    bouton.type = "button";
    bouton.className = `wm-retour__lien ${CLASSE_BOUTON}`;
    bouton.textContent = libelle(rendre());
    bouton.addEventListener("click", () => {
      prefs.poserTheme(choixApresClic(prefs.theme(), systemeEstSombre()));
      bouton.textContent = libelle(rendre());
    });
    barre.appendChild(bouton);
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
})();
