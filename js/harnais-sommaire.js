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
      entrees: s.entrees.map((e) => ({
        ...e,
        active: slugCourant !== null && e.slug === slugCourant,
        aVenir: e.adresse === null
      }))
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
    if (e.aVenir) {
      corps.appendChild(element(doc, "span", "wm-annexe__a-venir", "\xE0 venir"));
    }
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

  // js/harnais-sommaire.ts
  globalThis.wmPoserLeSommaire = (donnees) => poserLeSommaire({
    doc: document,
    donnees
  });
})();
