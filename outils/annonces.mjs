// ════════════════════════════════════════════════════════════════════
//  outils/annonces.mjs
//
//  POURQUOI CE HARNAIS EXISTE. Les fiches d'annonce ne sont pas du
//  code du dépôt : ce sont dix blocs de HTML qu'on colle à la main
//  dans un message du forum. Rien dans les tests de domaine ne les
//  touche, et pourtant trois choses peuvent casser sans qu'on le voie :
//
//    · LE CONTRASTE DANS LES DEUX THÈMES. Le fond sable est une
//      couleur de la charte, qui change la nuit ; un bloc intérieur
//      posé dessus doit rester lisible des deux côtés. Mon premier
//      aperçu peignait son propre fond en dur et annonçait trois faux
//      défauts — c'est pour ça que celui-ci prend le sien dans
//      `--wm-fond-page`, comme le forum.
//    · LA GÉOMÉTRIE DES RONDS. « Rond » n'est pas une classe qu'on
//      pose, c'est une case carrée plus un rayon : une photo large
//      sans `aspect-ratio` donne une ellipse. On mesure donc la case,
//      pas la règle.
//    · LE DÉGRAISSAGE. Ce qu'on livre, c'est le `.min.html`, pas la
//      source relue. Le harnais monte DONC le fichier dégraissé : si
//      l'outil de dégraissage recolle deux mots ou perd une balise, il
//      le voit ici et pas après la publication.
//
//  Lancé par `deno task annonces`.
// ════════════════════════════════════════════════════════════════════

import { chromium } from "npm:playwright@1.56.0";
import { readFileSync } from "node:fs";

const R = new URL("..", import.meta.url).pathname;
const CHROME = [
  "/opt/pw-browsers/chromium",
  "/opt/pw-browsers/chromium-1140/chrome-linux/chrome",
].find((c) => {
  try {
    readFileSync(c);
    return true;
  } catch {
    return false;
  }
});

//  ── ON MONTE LE FICHIER LIVRÉ ─────────────────────────────────────
//
//  Une ligne d'étiquette, une ligne de modèle. On garde le numéro et
//  le titre pour pouvoir nommer le modèle fautif dans le rapport.
const livre = readFileSync(R + "templates/annonce-du-staff.a-coller.min.html", "utf8");
const modeles = [];
{
  let etiquette = null;
  for (const ligne of livre.split("\n")) {
    const l = ligne.trim();
    if (l === "") continue;
    const m = /^<!--\s*MODÈLE\s+(\d+)\s*·\s*(.*?)\s*-->$/.exec(l);
    if (m !== null) {
      etiquette = { n: Number(m[1]), titre: m[2] };
      continue;
    }
    if (etiquette === null) throw new Error("un modèle sans étiquette : " + l.slice(0, 60));
    modeles.push({ ...etiquette, html: l });
    etiquette = null;
  }
}

//  Une photo large et une photo haute : c'est la LARGE qui révélait
//  l'ellipse, et la HAUTE qui révélait le bandeau écrasé.
const photo = (l, h) =>
  "data:image/svg+xml;base64," +
  Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${l}" height="${h}">` +
      `<rect width="${l}" height="${h}" fill="#8a6a4f"/></svg>`,
  ).toString("base64");

const LARGE = photo(1200, 400);
const HAUTE = photo(400, 1200);

//  ── LE FOND DE L'APERÇU VIENT DE LA CHARTE ────────────────────────
//
//  `--wm-fond-page` et rien d'autre. Écrit en dur, il restait clair en
//  thème sombre et le harnais comptait des défauts qui n'existaient
//  pas : le défaut était dans la mesure.
const page = `<!doctype html><html lang="fr"><head><meta charset="utf-8">
<style>${readFileSync(R + "panneau-admin/jetons.css", "utf8")}</style>
<style>${readFileSync(R + "css/wild-mystery.css", "utf8")}</style>
<style>
  html, body { margin: 0; }
  body { background: var(--wm-fond-page); padding: 24px; }
  .essai { margin: 0 auto; max-width: 820px; }
  .essai > h1 { font: 700 12px/1.3 monospace; color: var(--wm-texte-doux); }
</style></head>
<body id="modernbb"><div id="page-body"><div class="post"><div class="postbody">
<div class="content">
${
  modeles.map((m) =>
    `<div class="essai" data-n="${m.n}"><h1>MODÈLE ${m.n} · ${m.titre}</h1>${
      m.html
        .replace(/src="ADRESSE-DU-BANDEAU\.jpg"/g, `src="${HAUTE}"`)
        .replace(/src="ADRESSE-DE-L-IMAGE\.jpg"/g, `src="${HAUTE}"`)
        .replace(/src="ADRESSE-\d+\.jpg"/g, `src="${LARGE}"`)
    }</div>`
  ).join("\n")
}
</div></div></div></div></body></html>`;

const nav = await chromium.launch(CHROME === undefined ? {} : { executablePath: CHROME });
const p = await nav.newPage({ viewport: { width: 1280, height: 1200 } });
const soucis = [];
p.on("pageerror", (e) => soucis.push("erreur JS : " + e.message));
await p.route(
  "**/*",
  (r) => r.fulfill({ contentType: "text/html; charset=utf-8", body: page }),
);
await p.goto("https://exemple.test/");

//  ── LE MODULE POSE LES PASSAGES MASQUÉS, PAS LE HARNAIS ───────────
//
//  `<tw>` n'est qu'une balise tant que le script n'a pas tourné. On
//  monte donc le vrai module, comme le forum le fera, et tout ce qui
//  suit mesure le DOM qui sortira vraiment.
await p.addScriptTag({ path: R + "js/harnais-sommaire.js" });
const passagesPoses = await p.evaluate(() => globalThis.wmPoserLesAvertissements());

let fautes = 0;
const rate = (quoi) => {
  fautes += 1;
  console.log("   ✗ " + quoi);
};

//  ── 1. LES MODÈLES SONT LÀ, ET ENTIERS ────────────────────────────
//
//  TOUS LES MODÈLES NE SONT PAS DES CARTES. Le dernier est le bandeau
//  d'avertissement seul, à coller en tête d'un message de RP : il n'a
//  ni carte ni titre, et exiger les deux le déclarait cassé alors
//  qu'il allait bien. On vérifie donc ce que CHAQUE modèle prétend
//  être, pas une forme unique.
const compte = await p.evaluate(() =>
  [...document.querySelectorAll(".essai")].map((e) => ({
    n: Number(e.dataset.n),
    cartes: e.querySelectorAll(".wm-annonce").length,
    titres: e.querySelectorAll(".wm-annonce__titre").length,
    textes: e.querySelectorAll(".wm-annonce__texte").length,
    briques: e.querySelectorAll(":scope > *:not(h1)").length,
    //  Un modèle dégraissé qui aurait perdu une balise fermante
    //  avalerait le suivant : on compte donc aussi ce qui dépasse.
    hauteur: Math.round(e.getBoundingClientRect().height),
  }))
);
console.log(`modèles montés : ${compte.length}`);
if (compte.length < 10) rate(`au moins 10 modèles attendus, ${compte.length} montés`);
for (const c of compte) {
  if (c.briques !== 1) rate(`modèle ${c.n} : ${c.briques} bloc(s) de premier niveau`);
  if (c.cartes > 1) rate(`modèle ${c.n} : ${c.cartes} cartes dans un seul modèle`);
  if (c.cartes === 1) {
    if (c.titres !== 1) rate(`modèle ${c.n} : ${c.titres} titre(s) au lieu d'un`);
    if (c.textes < 1) rate(`modèle ${c.n} : aucun paragraphe`);
    if (c.hauteur < 80) rate(`modèle ${c.n} : ${c.hauteur}px de haut, il ne rend rien`);
  } else if (c.hauteur < 24) {
    rate(`modèle ${c.n} : ${c.hauteur}px de haut, il ne rend rien`);
  }
}

//  ── 2. LE DÉGRAISSAGE N'A PAS RECOLLÉ DEUX MOTS ───────────────────
//
//  La source relue et la version livrée doivent rendre le MÊME texte,
//  espaces compris. C'est le défaut que l'outil de dégraissage a déjà
//  produit une fois, en supprimant l'espace entre deux éléments en
//  ligne : « TON PERSONNAGEDresseur ».
{
  const source = readFileSync(R + "templates/annonce-du-staff.a-coller.html", "utf8");
  const mots = (h) =>
    h.replace(/<!--[\s\S]*?-->/g, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  const a = mots(source);
  const b = mots(livre);
  if (a !== b) {
    rate("le texte de la version livrée ne correspond plus à la source");
    for (let i = 0; i < Math.max(a.length, b.length); i += 1) {
      if (a[i] !== b[i]) {
        console.log(`      source : …${a.slice(Math.max(0, i - 30), i + 30)}…`);
        console.log(`      livrée : …${b.slice(Math.max(0, i - 30), i + 30)}…`);
        break;
      }
    }
  } else {
    console.log(`texte identique à la source : ${a.length} caractères`);
  }
}

//  ── 3. CE QUI EST CENTRÉ L'EST, CE QUI EST JUSTIFIÉ LE RESTE ──────
//
//  Le titre et le sur-titre se centrent ; le TEXTE non. Dix lignes
//  centrées ne se lisent pas, et c'est l'erreur facile quand on pose
//  `text-align: center` sur la carte entière.
{
  const al = await p.evaluate(() =>
    [...document.querySelectorAll(".wm-annonce")].map((c) => ({
      n: Number(c.closest(".essai").dataset.n),
      centre: c.classList.contains("wm-annonce--centre"),
      titre: getComputedStyle(c.querySelector(".wm-annonce__titre")).textAlign,
      textes: [...c.querySelectorAll(".wm-annonce__texte")]
        .map((t) => getComputedStyle(t).textAlign),
      //  Le filet sous le titre : ses marges gauche et droite doivent
      //  être égales dans un modèle centré. C'est `margin-inline: auto`
      //  qui le fait, et il ne se voit nulle part ailleurs.
      filet: (() => {
        const t = c.querySelector(".wm-annonce__titre");
        const s = getComputedStyle(t, "::after");
        return { g: s.marginLeft, d: s.marginRight, l: s.width };
      })(),
    }))
  );
  for (const a of al) {
    //  Hors modèle centré, ModernBB ne déclare rien : le calcul rend
    //  `start`, pas `left`. On accepte les deux — c'est la même chose
    //  dans une page de gauche à droite, et exiger `left` faisait
    //  échouer cinq modèles qui allaient bien.
    const attendu = a.centre ? ["center"] : ["start", "left"];
    if (!attendu.includes(a.titre)) {
      rate(`modèle ${a.n} : titre en ${a.titre}, ${attendu.join(" ou ")} attendu`);
    }
    for (const t of a.textes) {
      if (t !== "justify") rate(`modèle ${a.n} : un paragraphe en ${t} au lieu de justify`);
    }
    if (a.centre && a.filet.g !== a.filet.d) {
      rate(`modèle ${a.n} : filet du titre pas centré (${a.filet.g} / ${a.filet.d})`);
    }
  }
  console.log(
    `alignements : ${al.filter((a) => a.centre).length} modèles centrés sur ${al.length}`,
  );
}

//  ── 4. LES RONDS SONT RONDS ───────────────────────────────────────
{
  const ronds = await p.evaluate(() =>
    [...document.querySelectorAll(".wm-annonce__rondes img")].map((i) => {
      const r = i.getBoundingClientRect();
      return {
        n: Number(i.closest(".essai").dataset.n),
        l: Math.round(r.width),
        h: Math.round(r.height),
        rayon: parseFloat(getComputedStyle(i).borderRadius),
        recadre: getComputedStyle(i).objectFit,
        //  La source est large : si elle sortait à son rapport, la
        //  hauteur serait le tiers de la largeur.
        source: i.naturalWidth + "×" + i.naturalHeight,
      };
    })
  );
  if (ronds.length === 0) rate("aucune image ronde montée");
  for (const r of ronds) {
    if (r.l !== r.h) rate(`modèle ${r.n} : un rond en ${r.l}×${r.h}, ce n'est pas un rond`);
    if (r.rayon < r.l / 2) rate(`modèle ${r.n} : rayon ${r.rayon} < ${r.l / 2}`);
    if (r.recadre !== "cover") rate(`modèle ${r.n} : object-fit ${r.recadre} au lieu de cover`);
  }
  console.log(
    `ronds : ${ronds.length} images, ${ronds[0]?.l}×${ronds[0]?.h} ` +
      `depuis des sources de ${ronds[0]?.source}`,
  );
}

//  ── 5. LE BANDEAU GARDE SA HAUTEUR ────────────────────────────────
//
//  Le défaut du 8 novembre : `height: auto` sur l'image à côté du
//  texte, qui prenait le rapport de la photo et sortait en bande
//  écrasée. Ici la source est HAUTE — sans hauteur imposée, le bandeau
//  mesurerait trois fois sa largeur.
{
  const bandeaux = await p.evaluate(() =>
    [...document.querySelectorAll(".wm-annonce__bandeau, .wm-annonce__cote")].map((i) => {
      const r = i.getBoundingClientRect();
      return {
        n: Number(i.closest(".essai").dataset.n),
        classe: i.className,
        l: Math.round(r.width),
        h: Math.round(r.height),
      };
    })
  );
  for (const b of bandeaux) {
    if (b.h > b.l) rate(`modèle ${b.n} : ${b.classe} en ${b.l}×${b.h}, il suit la photo`);
    if (b.h < 80) rate(`modèle ${b.n} : ${b.classe} haut de ${b.h}px seulement`);
  }
  console.log(
    `images larges : ${bandeaux.map((b) => `${b.l}×${b.h}`).join(", ") || "aucune"}`,
  );
}

//  ── 6. UN BLOC INTÉRIEUR SE DÉTACHE DE SON FOND ───────────────────
//
//  C'est tout l'intérêt du morceau, et c'est aussi là qu'un fond
//  sable sur sable ne se verrait pas. On compare les deux couleurs
//  calculées, dans les deux thèmes.
const couleursDesBlocs = async (theme) => {
  await p.evaluate(
    (t) => document.body.classList.toggle("wm-sombre", t === "sombre"),
    theme,
  );
  return await p.evaluate(() =>
    [...document.querySelectorAll(".wm-annonce__bloc")].map((b) => ({
      n: Number(b.closest(".essai").dataset.n),
      bloc: getComputedStyle(b).backgroundColor,
      carte: getComputedStyle(b.closest(".wm-annonce")).backgroundColor,
    }))
  );
};
for (const theme of ["clair", "sombre"]) {
  const bl = await couleursDesBlocs(theme);
  if (bl.length === 0) rate("aucun bloc intérieur monté");
  for (const b of bl) {
    if (b.bloc === b.carte) {
      rate(`${theme}, modèle ${b.n} : le bloc a le fond de sa carte (${b.bloc})`);
    }
  }
  console.log(`${theme} : ${bl.length} blocs intérieurs, tous distincts de leur carte`);
}

//  ── 7. DEUX BLOCS CÔTE À CÔTE, PUIS L'UN SOUS L'AUTRE ─────────────
const rangees = async (largeur) => {
  await p.setViewportSize({ width: largeur, height: 1200 });
  return await p.evaluate(() =>
    [...document.querySelectorAll(".wm-annonce__blocs")].map((r) => {
      const hauts = [...r.children].map((c) => Math.round(c.getBoundingClientRect().top));
      return {
        n: Number(r.closest(".essai").dataset.n),
        enfants: r.children.length,
        lignes: new Set(hauts).size,
      };
    })
  );
};
{
  const large = await rangees(1280);
  for (const r of large) {
    if (r.enfants >= 2 && r.lignes !== 1) {
      rate(`1280 px, modèle ${r.n} : ${r.enfants} blocs sur ${r.lignes} lignes`);
    }
  }
  const etroit = await rangees(390);
  for (const r of etroit) {
    if (r.enfants >= 2 && r.lignes !== r.enfants) {
      rate(`390 px, modèle ${r.n} : ${r.enfants} blocs sur ${r.lignes} ligne(s)`);
    }
  }
  console.log(
    `rangées de blocs : ${large.length} — une ligne à 1280, ` +
      `${etroit.map((r) => r.lignes).join("/")} à 390`,
  );
}

//  ── 8. RIEN NE DÉPASSE ────────────────────────────────────────────
for (const largeur of [1280, 390]) {
  await p.setViewportSize({ width: largeur, height: 1200 });
  const trop = await p.evaluate(
    (l) =>
      [...document.querySelectorAll(".wm-annonce, .wm-annonce *")]
        .map((e) => ({
          c: e.className || e.tagName,
          d: Math.round(e.getBoundingClientRect().right - l),
        }))
        .filter((x) => x.d > 1),
    largeur,
  );
  if (trop.length > 0) {
    rate(
      `${largeur} px : ${trop.length} élément(s) dépassent — ${trop[0].c} de ${trop[0].d}px`,
    );
  } else {
    console.log(`${largeur} px : rien ne dépasse`);
  }
}
await p.setViewportSize({ width: 1280, height: 1200 });

//  ── 9. L'AVERTISSEMENT CACHE VRAIMENT ─────────────────────────────
//
//  Trois promesses de la planche 39, et aucune ne se vérifie à l'œil :
//  le flou se voit, `aria-hidden` et `user-select` non — et ce sont
//  eux qui protègent qui écoute la page ou qui glisse la souris.
{
  console.log(`passages masqués posés par le module : ${passagesPoses}`);
  if (passagesPoses < 1) rate("le module n'a posé aucun passage masqué");

  const ferme = await p.evaluate(() =>
    [...document.querySelectorAll(".wm-tw")].map((b) => {
      const bouton = b.querySelector(".wm-tw__bouton");
      const passage = b.querySelector(".wm-tw__passage");
      const st = passage === null ? null : getComputedStyle(passage);
      return {
        n: Number(b.closest(".essai").dataset.n),
        //  UN VRAI BOUTON, pas un div avec un écouteur : lui seul
        //  répond à Entrée et à Espace sans qu'on l'écrive.
        bouton: bouton?.tagName ?? null,
        type: bouton?.getAttribute("type") ?? null,
        //  « jamais un simple "cliquez pour afficher" » : le libellé
        //  doit nommer ce qu'il cache, et le détail est à côté.
        libelle: bouton?.textContent.trim() ?? null,
        mot: b.querySelector(".wm-tw__mot")?.textContent.trim() ?? null,
        ouvre: bouton?.getAttribute("aria-expanded") ?? null,
        commande: bouton?.getAttribute("aria-controls") ?? null,
        cible: passage?.id ?? null,
        cache: passage?.getAttribute("aria-hidden") ?? null,
        selection: st?.userSelect ?? null,
        flou: st?.filter ?? null,
        //  Le texte reste dans la page : c'est un avertissement, pas
        //  un coffre. Mais il doit être ENTIER — un passage vidé par
        //  le déplacement des nœuds ne reviendrait pas au clic.
        mots: passage?.textContent.trim().length ?? 0,
      };
    })
  );
  for (const b of ferme) {
    if (b.bouton !== "BUTTON") rate(`modèle ${b.n} : le déclencheur est un ${b.bouton}`);
    if (b.type !== "button") rate(`modèle ${b.n} : bouton de type ${b.type}`);
    if (!/afficher/i.test(b.libelle ?? "")) rate(`modèle ${b.n} : libellé « ${b.libelle} »`);
    if ((b.mot ?? "").length < 4) rate(`modèle ${b.n} : pas de libellé de ce qui est caché`);
    if (b.ouvre !== "false") rate(`modèle ${b.n} : aria-expanded ${b.ouvre} au repos`);
    if (b.commande === null || b.commande !== b.cible) {
      rate(`modèle ${b.n} : aria-controls ${b.commande} ne vise pas ${b.cible}`);
    }
    if (b.cache !== "true") rate(`modèle ${b.n} : aria-hidden ${b.cache} au repos`);
    if (b.selection !== "none") rate(`modèle ${b.n} : user-select ${b.selection} au repos`);
    if (!/blur/.test(b.flou ?? "")) rate(`modèle ${b.n} : pas de flou (${b.flou})`);
    if (b.mots < 40) rate(`modèle ${b.n} : le passage ne contient que ${b.mots} caractères`);
  }
  console.log(
    `au repos : ${ferme.length} passage(s), floutés, aria-hidden, non sélectionnables`,
  );

  //  ── ET AU CLIC, LES TROIS SE LÈVENT ENSEMBLE ────────────────────
  //
  //  C'est le défaut facile : lever le flou en oubliant `aria-hidden`,
  //  ce qui laisse le passage invisible pour un lecteur d'écran APRÈS
  //  qu'on l'a ouvert — l'inverse exact de ce qu'on voulait.
  await p.evaluate(() => {
    for (const b of document.querySelectorAll(".wm-tw__bouton")) b.click();
  });
  //  ── ON ATTEND LA FIN DU FONDU AVANT DE MESURER ──────────────────
  //
  //  `getComputedStyle` pendant une transition rend la valeur EN
  //  COURS, pas celle d'arrivée : lu dans la foulée du clic, le flou
  //  valait encore 3,5 px et le harnais déclarait un défaut qui
  //  n'existait pas. La transition dure 0,18 s ; on lui en laisse le
  //  double.
  await p.waitForTimeout(400);
  const ouvert = await p.evaluate(() => {
    return [...document.querySelectorAll(".wm-tw")].map((b) => {
      const st = getComputedStyle(b.querySelector(".wm-tw__passage"));
      return {
        n: Number(b.closest(".essai").dataset.n),
        libelle: b.querySelector(".wm-tw__bouton").textContent.trim(),
        ouvre: b.querySelector(".wm-tw__bouton").getAttribute("aria-expanded"),
        cache: b.querySelector(".wm-tw__passage").getAttribute("aria-hidden"),
        selection: st.userSelect,
        flou: st.filter,
      };
    });
  });
  for (const b of ouvert) {
    if (!/masquer/i.test(b.libelle)) rate(`modèle ${b.n} ouvert : libellé « ${b.libelle} »`);
    if (b.ouvre !== "true") rate(`modèle ${b.n} ouvert : aria-expanded ${b.ouvre}`);
    if (b.cache !== "false") rate(`modèle ${b.n} ouvert : aria-hidden ${b.cache}`);
    if (b.selection === "none") rate(`modèle ${b.n} ouvert : toujours non sélectionnable`);
    if (b.flou !== "none") rate(`modèle ${b.n} ouvert : toujours flouté (${b.flou})`);
  }
  console.log(`au clic : ${ouvert.length} passage(s) rendus lisibles, et annoncés comme tels`);

  //  ── LE MODE EN LIGNE ────────────────────────────────────────────
  //
  //  La balise `<tw>` NUE : pas d'encadré, pas de bouton visible, le
  //  passage flouté dans la phrase. Deux choses à prouver, et ce sont
  //  les mêmes que pour l'encadré : il cache vraiment, et il s'ouvre
  //  sans souris.
  {
    const enLigne = await p.evaluate(() =>
      [...document.querySelectorAll(".wm-tw-mot")].map((b) => {
        const t = b.querySelector(".wm-tw-mot__texte");
        const st = getComputedStyle(t);
        return {
          n: Number(b.closest(".essai").dataset.n),
          balise: b.tagName,
          type: b.getAttribute("type"),
          //  PAS D'ENCADRÉ : c'est la demande. Le bouton n'a ni fond,
          //  ni cadre, et il reste DANS la phrase.
          dansUnCadre: b.closest(".wm-tw") !== null,
          fond: getComputedStyle(b).backgroundColor,
          bord: getComputedStyle(b).borderTopWidth,
          enLigne: getComputedStyle(b).display,
          flou: st.filter,
          selection: st.userSelect,
          cache: t.getAttribute("aria-hidden"),
          ouvre: b.getAttribute("aria-expanded"),
          //  Sans nom accessible, le bouton serait annoncé « bouton »
          //  et rien d'autre : son seul contenu est masqué.
          nom: b.getAttribute("aria-label"),
          mots: t.textContent.trim().length,
        };
      })
    );
    if (enLigne.length < 2) rate(`${enLigne.length} passage(s) en ligne montés`);
    for (const m of enLigne) {
      if (m.balise !== "BUTTON" || m.type !== "button") {
        rate(`modèle ${m.n} en ligne : ${m.balise} de type ${m.type}`);
      }
      if (m.dansUnCadre) rate(`modèle ${m.n} en ligne : il a fabriqué un encadré`);
      if (m.fond !== "rgba(0, 0, 0, 0)") rate(`modèle ${m.n} en ligne : fond ${m.fond}`);
      if (parseFloat(m.bord) !== 0) rate(`modèle ${m.n} en ligne : bordure ${m.bord}`);
      if (!/^inline/.test(m.enLigne)) {
        rate(`modèle ${m.n} en ligne : display ${m.enLigne}`);
      }
      if (!/blur/.test(m.flou)) rate(`modèle ${m.n} en ligne : pas de flou (${m.flou})`);
      if (m.selection !== "none") rate(`modèle ${m.n} en ligne : user-select ${m.selection}`);
      if (m.cache !== "true") rate(`modèle ${m.n} en ligne : aria-hidden ${m.cache}`);
      if (m.ouvre !== "false") rate(`modèle ${m.n} en ligne : aria-expanded ${m.ouvre}`);
      if ((m.nom ?? "").length < 5) rate(`modèle ${m.n} en ligne : sans nom accessible`);
      if (m.mots < 10) rate(`modèle ${m.n} en ligne : ${m.mots} caractères masqués`);
    }
    console.log(
      `en ligne : ${enLigne.length} passage(s), floutés, sans encadré ni bouton visible`,
    );

    //  AU SURVOL IL S'OUVRE, ET IL SE REFERME QUAND ON S'EN VA.
    const premier = await p.$(".wm-tw-mot");
    await premier.hover();
    await p.waitForTimeout(300);
    const survole = await p.evaluate(() => {
      const b = document.querySelector(".wm-tw-mot");
      return {
        flou: getComputedStyle(b.querySelector(".wm-tw-mot__texte")).filter,
        ouvre: b.getAttribute("aria-expanded"),
        cache: b.querySelector(".wm-tw-mot__texte").getAttribute("aria-hidden"),
      };
    });
    if (survole.flou !== "none") rate(`au survol : toujours flouté (${survole.flou})`);
    if (survole.ouvre !== "true") rate(`au survol : aria-expanded ${survole.ouvre}`);
    if (survole.cache !== "false") rate(`au survol : aria-hidden ${survole.cache}`);

    //  ON S'EN VA : il se referme, parce qu'il n'a pas été cliqué.
    await p.mouse.move(5, 5);
    await p.waitForTimeout(300);
    const parti = await p.evaluate(() =>
      getComputedStyle(document.querySelector(".wm-tw-mot__texte")).filter
    );
    if (!/blur/.test(parti)) rate(`après le survol : il reste ouvert (${parti})`);
    console.log("au survol : il s'ouvre, et il se referme quand on s'en va");

    //  AU CLIC IL RESTE OUVERT — sans quoi on ne pourrait pas lire
    //  deux lignes sans garder la souris dessus.
    await premier.click();
    await p.mouse.move(5, 5);
    await p.evaluate(() => document.activeElement?.blur());
    await p.waitForTimeout(300);
    const epingle = await p.evaluate(() => {
      const b = document.querySelector(".wm-tw-mot");
      return {
        flou: getComputedStyle(b.querySelector(".wm-tw-mot__texte")).filter,
        ouvre: b.getAttribute("aria-expanded"),
      };
    });
    if (epingle.flou !== "none" || epingle.ouvre !== "true") {
      rate(`après le clic : il ne reste pas ouvert (${JSON.stringify(epingle)})`);
    }
    console.log("au clic : il reste ouvert, souris partie et focus rendu");
  }

  //  ── LA PUCE SE DÉTACHE DE SON BANDEAU, DANS LES DEUX THÈMES ─────
  for (const theme of ["clair", "sombre"]) {
    const puces = await p.evaluate((t) => {
      document.body.classList.toggle("wm-sombre", t === "sombre");
      return [...document.querySelectorAll(".wm-tw-puce")].map((pu) => ({
        n: Number(pu.closest(".essai").dataset.n),
        puce: getComputedStyle(pu).backgroundColor,
        autour: getComputedStyle(pu.closest(".wm-tw-bandeau") ?? pu.parentElement)
          .backgroundColor,
      }));
    }, theme);
    if (puces.length === 0) rate("aucune puce de trigger warning montée");
    for (const pu of puces) {
      if (pu.puce === pu.autour) {
        rate(`${theme}, modèle ${pu.n} : la puce a le fond de son bandeau (${pu.puce})`);
      }
    }
    console.log(`${theme} : ${puces.length} puces, toutes distinctes de leur bandeau`);
  }
}

//  ── 10. LE CONTRASTE, DANS LES DEUX THÈMES ────────────────────────
//
//  LES PASSAGES SONT OUVERTS À CE STADE, et c'est voulu : fermé, un
//  passage est délibérément illisible — le mesurer reviendrait à
//  déclarer en défaut la chose même qu'on a demandée.
//
//  Même calcul que `outils/contraste.mjs` : on empile les fonds
//  translucides au lieu de les sauter, et on garde le pire candidat
//  d'un dégradé.
const mesurer = async (theme) => {
  await p.evaluate(
    (t) => document.body.classList.toggle("wm-sombre", t === "sombre"),
    theme,
  );
  return await p.evaluate(() => {
    const canal = (s) => {
      const n = s.match(/-?\d*\.?\d+(?:e-?\d+)?/g)?.map(Number) ?? [];
      if (n.length < 3) return null;
      const srgb = /^color\(/.test(s);
      const alpha = s.includes("/") ? (n[3] ?? 1) : (n.length > 3 ? n[3] : 1);
      return { rgb: srgb ? n.slice(0, 3).map((v) => v * 255) : n.slice(0, 3), alpha };
    };
    const f = (v) => {
      const s = v / 255;
      return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    };
    const lum = (c) => 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]);
    const sur = (dessus, dessous, a) => dessus.map((v, i) => v * a + dessous[i] * (1 - a));
    const fond = (el) => {
      const couches = [];
      for (let n = el; n && n !== document.documentElement; n = n.parentElement) {
        const c = canal(getComputedStyle(n).backgroundColor);
        if (c && c.alpha > 0) couches.push(c);
      }
      let fo = [255, 255, 255];
      for (const { rgb, alpha } of couches.reverse()) {
        fo = alpha >= 1 ? rgb : sur(rgb, fo, alpha);
      }
      return fo;
    };
    const res = [];
    for (const el of document.querySelectorAll(".wm-annonce, .wm-annonce *")) {
      if (![...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim() !== "")) {
        continue;
      }
      if (el.getClientRects().length === 0) continue;
      const st = getComputedStyle(el);
      const t = canal(st.color);
      if (t === null) continue;
      const fo = fond(el);
      const texte = sur(t.rgb, fo, t.alpha);
      const a = lum(texte), b = lum(fo);
      const ratio = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
      const px = parseFloat(st.fontSize), gras = Number(st.fontWeight) >= 700;
      const seuil = (px >= 24 || (px >= 18.66 && gras)) ? 3 : 4.5;
      res.push({
        n: Number(el.closest(".essai").dataset.n),
        classe: el.className || el.tagName,
        px,
        ratio: Math.round(ratio * 100) / 100,
        seuil,
        ok: ratio >= seuil,
        mot: el.textContent.replace(/\s+/g, " ").trim().slice(0, 40),
      });
    }
    return res;
  });
};
for (const theme of ["clair", "sombre"]) {
  const r = await mesurer(theme);
  const rates = r.filter((x) => !x.ok);
  console.log(`${theme} : ${r.length} textes mesurés, ${rates.length} défaut(s) de contraste`);
  for (const x of rates) {
    fautes += 1;
    console.log(
      `   ✗ modèle ${x.n} · ${x.ratio} < ${x.seuil}  ${x.px}px  .${x.classe}  « ${x.mot} »`,
    );
  }
}

for (const s of soucis) rate(s);

//  ── UNE PHOTO, QUAND ON LA DEMANDE ────────────────────────────────
//
//  `--photo` : les douze modèles dans les deux thèmes, pour les
//  montrer. Le harnais mesure, il ne regarde pas — mais la personne
//  qui choisit un modèle, si.
if (Deno.args.includes("--photo")) {
  //  ON REFERME LES PASSAGES avant de photographier : le harnais les a
  //  tous ouverts pour les mesurer, et une image qui les montre
  //  ouverts ne montre pas ce que fait la brique.
  await p.evaluate(() => {
    for (const b of document.querySelectorAll(".wm-tw--ouvert .wm-tw__bouton")) b.click();
  });
  await p.waitForTimeout(400);
  await p.setViewportSize({ width: 900, height: 1200 });
  for (const theme of ["clair", "sombre"]) {
    await p.evaluate(
      (t) => document.body.classList.toggle("wm-sombre", t === "sombre"),
      theme,
    );
    const chemin = `${R}/annonces-${theme}.png`;
    await p.screenshot({ path: chemin, fullPage: true });
    console.log(`photo : ${chemin}`);
  }
}

await nav.close();
console.log(fautes === 0 ? "\nannonces  TOUT PASSE." : `\nannonces  ${fautes} défaut(s).`);
Deno.exit(fautes === 0 ? 0 : 1);
