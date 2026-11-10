// ════════════════════════════════════════════════════════════════════
//  outils/defis.mjs
//
//  POURQUOI CE HARNAIS EXISTE, ET POURQUOI IL ARRIVE TARD.
//
//  Les treize blocs « défier le champion » sont écrits par
//  `outils/defier.py` et collés à la main dans treize sujets. Entre le
//  générateur et le forum, RIEN ne les regardait : `deno task annonces`
//  monte les modèles d'annonce du staff, pas ceux-là, et aucun test de
//  domaine ne touche à du HTML collé.
//
//  Le 9 novembre, ça s'est vu deux fois dans la même journée. D'abord
//  la marge haute d'un `__texte` d'annonce, morte depuis toujours dans
//  un corps de message parce qu'une règle de ModernBB passait devant.
//  Puis la Ligue : « ça manque d'espace entre les équipes, on voit pas
//  que ce sont des équipes différentes, de personnages différents ».
//  Deux défauts de MISE EN PAGE, dans du HTML que personne ne mesurait.
//
//  ── CE QU'IL MONTE ────────────────────────────────────────────────
//
//  Le `.min.html` de chaque sujet, DÉGRAISSÉ, dans un vrai corps de
//  message ModernBB — `.postbody .content`. C'est l'endroit qui compte :
//  c'est là que les règles du forum disputent les nôtres, et une
//  mesure prise hors de ce corps ne dit rien.
//
//  Lancé par `deno task defis`.
// ════════════════════════════════════════════════════════════════════

import { chromium } from "npm:playwright@1.56.0";
import { readdirSync, readFileSync } from "node:fs";

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

const DOSSIER = R + "templates/defier/";
const sujets = readdirSync(DOSSIER)
  .filter((f) => f.endsWith(".min.html"))
  .sort()
  .map((f) => ({ nom: f.replace(".min.html", ""), html: readFileSync(DOSSIER + f, "utf8") }));

if (sujets.length === 0) {
  console.error("aucun bloc dans templates/defier/ — lance « deno task defier »");
  Deno.exit(1);
}

//  ── LE CORPS DE MESSAGE EST CELUI DU FORUM ────────────────────────
//
//  `#modernbb`, `.postbody`, `.content` : les trois que porte un
//  message réel. Sans eux, `#modernbb .postbody .content p { margin:
//  0 0 16px }` ne s'applique pas, et le harnais mesurerait des écarts
//  que personne ne verra jamais sur le forum.
//
//  LES VALEURS SONT RELEVÉES, pas écrites de mémoire : mesurées le
//  10 novembre dans un vrai message de mysteryinrhode, en y insérant
//  une balise nue et en lisant son style calculé. J'avais d'abord
//  écrit `padding-left: 24px` sur les listes — le forum met
//  `margin-left: 48px` et `padding: 0`. Un rembourrage se retranche du
//  contenu, une marge pousse la boîte : la différence a coûté une
//  colonne au lexique des champions avant qu'on la relève.
//  ET LEUR SPÉCIFICITÉ COMPTE AUTANT QUE LEUR VALEUR. Écrites
//  `#modernbb .postbody .content ul`, elles passaient devant nos
//  règles de composant — ce que le forum NE FAIT PAS : sur la vraie
//  page, `.wm-postes` garde sa marge à zéro. Elles sont donc posées
//  au plus faible, `#modernbb ul`, ce qui reproduit l'ordre observé :
//  elles s'appliquent à une balise nue, et cèdent à la première
//  classe. La règle du `p`, elle, n'est pas d'eux — elle est à nous,
//  dans `05-sujet.css`, donc déjà dans la feuille montée.
const MODERNBB = `
#modernbb ul, #modernbb ol { margin: 0 0 16px 48px; padding: 0; }
#modernbb li { margin: 0; padding: 0; }
#modernbb h2 { margin: -3px 0 9px; padding: 0 0 3px; }
#modernbb h3 { margin: 0 0 12px; padding: 0 0 3px; }
`;

const page = `<!doctype html><html lang="fr"><head><meta charset="utf-8">
<style>${readFileSync(R + "panneau-admin/jetons.css", "utf8")}</style>
<style>${MODERNBB}</style>
<style>${readFileSync(R + "css/wild-mystery.css", "utf8")}</style>
<style>
  html, body { margin: 0; }
  body { background: var(--wm-fond-page); padding: 24px; }
  .essai { margin: 0 auto 48px; max-width: 900px; }
</style></head>
<body id="modernbb"><div id="page-body"><div class="post"><div class="postbody">
<div class="content">
${sujets.map((s) => `<div class="essai" data-sujet="${s.nom}">${s.html}</div>`).join("\n")}
</div></div></div></div></body></html>`;

const nav = await chromium.launch(CHROME === undefined ? {} : { executablePath: CHROME });
const p = await nav.newPage({ viewport: { width: 1280, height: 1200 } });
const soucis = [];
p.on("pageerror", (e) => soucis.push("erreur JS : " + e.message));
await p.route(
  "**/*",
  (r) =>
    r.request().resourceType() === "image"
      ? r.fulfill({
        contentType: "image/svg+xml",
        body: '<svg xmlns="http://www.w3.org/2000/svg" width="68" height="56"></svg>',
      })
      : r.fulfill({ contentType: "text/html; charset=utf-8", body: page }),
);
await p.goto("https://exemple.test/");

let fautes = 0;
const rate = (quoi) => {
  fautes += 1;
  console.log("   ✗ " + quoi);
};
const dire = (quoi, ok, detail = "") => {
  if (ok) console.log("  ok   " + quoi + (detail ? " — " + detail : ""));
  else rate(quoi + (detail ? " — " + detail : ""));
};

// ── 1 · CHAQUE BLOC EST ENTIER ──────────────────────────────────────
//
//  Le dégraissage recolle les lignes. S'il mangeait une balise, le
//  bloc s'afficherait quand même — en vrac. On compte donc ce que
//  chaque sujet DOIT porter.
const entiers = await p.evaluate(() =>
  [...document.querySelectorAll(".essai")].map((e) => ({
    nom: e.dataset.sujet,
    carte: e.querySelectorAll(".wm-annonce").length,
    titre: e.querySelector(".wm-annonce__titre")?.textContent.trim() ?? null,
    equipes: e.querySelectorAll("ul.wm-equipe").length,
    cases: e.querySelectorAll(".wm-equipe__pkmn").length,
    bulles: e.querySelectorAll(".wm-infobulle").length,
    duels: e.querySelectorAll(".wm-annonce__duel").length,
    //  Une balise mal refermée se voit là : le navigateur recolle, et
    //  la carte se retrouve avec un enfant qu'elle ne devrait pas
    //  avoir ou un texte orphelin au niveau du conteneur.
    orphelin: [...e.childNodes].some((n) =>
      n.nodeType === 3 && n.textContent.trim() !== ""
    ),
  }))
);
for (const s of entiers) {
  if (s.nom === "t100-ligue-inscription") {
    dire(`${s.nom} : la carte seule, sans équipe`, s.carte === 1 && s.equipes === 0);
    continue;
  }
  const attendu = s.nom.startsWith("t100") ? 5 : 1;
  dire(
    `${s.nom} : ${attendu} équipe(s) de six, chacune avec ses infobulles`,
    s.carte === 1 && s.equipes === attendu && s.cases === attendu * 6 &&
      s.bulles === attendu * 6 && !s.orphelin,
    JSON.stringify(s),
  );
}

// ── 1 bis · UNE CASE PORTE TOUS SES TYPES ───────────────────────────
//
//  « Y'a des pokémons qui ont 2 types et tu les affiches pas. » La
//  case n'en montrait qu'un, et c'était une information FAUSSE : un
//  Roigada annoncé « Eau » quand il est Eau/Psy trompe qui prépare un
//  combat. L'infobulle les montrait bien tous les deux — mais il
//  fallait la survoler, donc savoir qu'il fallait vérifier.
//
//  LA SOURCE DE VÉRITÉ EST L'INFOBULLE DE LA MÊME CASE : elle porte
//  les types depuis toujours. On compare donc les deux listes case par
//  case, plutôt que de recompter depuis les données — ce qui
//  reviendrait à vérifier le générateur avec lui-même.
const doubles = await p.evaluate(() =>
  [...document.querySelectorAll(".wm-equipe__pkmn")].map((c) => ({
    nom: c.querySelector(".wm-equipe__nom")?.textContent.trim() ?? "?",
    surLaCase: [...c.querySelectorAll(".wm-equipe__types .wm-type")]
      .map((t) => t.dataset.wmType),
    dansLaBulle: [...c.querySelectorAll(".wm-infobulle__type")]
      .map((t) => t.dataset.wmType),
  }))
);
const menteuses = doubles.filter((c) =>
  c.surLaCase.join(",") !== c.dansLaBulle.join(",")
);
dire(
  `les ${doubles.length} cases affichent TOUS leurs types, bulle comprise`,
  menteuses.length === 0,
  JSON.stringify(menteuses.slice(0, 4)),
);
const bi = doubles.filter((c) => c.dansLaBulle.length === 2);
dire(
  `et ${bi.length} d'entre elles sont à double type — c'était le défaut`,
  bi.length > 0 && bi.every((c) => c.surLaCase.length === 2),
  JSON.stringify(bi.slice(0, 3)),
);

//  ── ET LA RANGÉE NE SE MET PAS À ONDULER ──────────────────────────
//
//  « Elles doivent toutes faire la même taille » (8 novembre). Deux
//  pastilles empilées rendent une case plus haute ; c'est l'étirement
//  de la rangée flex qui garde les six d'aplomb, et ça ne se voit que
//  si on le mesure.
const rangees = await p.evaluate(() =>
  [...document.querySelectorAll("ul.wm-equipe")].map((u) => {
    const h = [...u.children].map((c) => Math.round(c.getBoundingClientRect().height));
    return {
      hauteurs: [...new Set(h)],
      //  Une pastille plus large que sa case déborderait du cadre.
      deborde: [...u.querySelectorAll(".wm-equipe__types .wm-type")].some((t) =>
        t.getBoundingClientRect().right >
          t.closest(".wm-equipe__pkmn").getBoundingClientRect().right + 0.5
      ),
    };
  })
);
dire(
  "les six cases d'une rangée gardent la même hauteur",
  rangees.every((r) => r.hauteurs.length === 1),
  JSON.stringify(rangees.map((r) => r.hauteurs)),
);
dire(
  "et aucune pastille ne déborde de sa case",
  rangees.every((r) => !r.deborde),
);

//  ── LES DEUX TYPES TIENNENT SUR UNE LIGNE ─────────────────────────
//
//  « Fais-les plus petits pour que les doubles types tiennent sur une
//  seule ligne » (9 novembre). Le réglage qui le permet est serré —
//  9 px, point de 8, rembourrage de 4 — et la marge se compte en
//  pixels : la pire paire, Ténèbres + Spectre, laisse quatre pixels
//  dans l'annexe. Un jour quelqu'un remontera la taille du texte ou
//  le rembourrage d'une case, et le repli reviendra sans bruit.
//
//  ON MESURE DONC LA MARGE, pas seulement le repli : savoir qu'il
//  reste quatre pixels vaut mieux qu'apprendre qu'il n'en reste plus.
const uneLigne = await p.evaluate(() => {
  const pires = [];
  for (const c of document.querySelectorAll(".wm-equipe__pkmn")) {
    const ps = [...c.querySelectorAll(".wm-equipe__types .wm-type")];
    if (ps.length < 2) continue;
    const s = getComputedStyle(c);
    const dispo = c.getBoundingClientRect().width -
      parseFloat(s.paddingLeft) - parseFloat(s.paddingRight) -
      parseFloat(s.borderLeftWidth) - parseFloat(s.borderRightWidth);
    const large = ps.reduce((a, t) => a + t.getBoundingClientRect().width, 0) +
      parseFloat(getComputedStyle(ps[0].parentElement).gap || "0");
    pires.push({
      paire: ps.map((t) => t.dataset.wmType).join("+"),
      marge: Math.round(dispo - large),
      lignes: new Set(ps.map((t) => Math.round(t.getBoundingClientRect().top))).size,
    });
  }
  pires.sort((a, b) => a.marge - b.marge);
  return { combien: pires.length, pire: pires[0] ?? null, replies: pires.filter((x) => x.lignes > 1) };
});
dire(
  `les ${uneLigne.combien} doubles types tiennent sur UNE ligne`,
  uneLigne.replies.length === 0,
  JSON.stringify(uneLigne.replies.slice(0, 4)),
);
//  LE SEUIL EST À UN PIXEL ICI, ET C'EST VOULU. Ce harnais monte les
//  blocs dans 900 px, la largeur la plus étroite où ils doivent encore
//  tenir ; le forum est plus large, et la même paire y respire. Ce
//  qu'on garde, c'est le signal : toute taille reprise à la pastille
//  ou au rembourrage d'une carte passe la marge sous zéro, et le
//  contrôle du dessus vire au rouge avant que personne ne le voie.
//  L'annexe, elle, a de la place : `deno task arenes` y exige trois
//  pixels.
dire(
  "et la paire la plus large tient encore dans 900 px",
  uneLigne.pire !== null && uneLigne.pire.marge >= 1,
  JSON.stringify(uneLigne.pire),
);

// ── 2 · LE TITRE ET LE SOUS-TITRE SONT À GAUCHE ─────────────────────
//
//  « Le titre aussi et le sous-titre, colle tout à gauche » — et ça
//  s'est joué sur une CLASSE du HTML, `wm-annonce--centre`, pas sur
//  une règle. Le retirer du générateur ne change rien aux messages
//  déjà collés : ce contrôle est là pour que le fichier livré, lui,
//  ne la reprenne jamais.
const alignement = await p.evaluate(() =>
  [...document.querySelectorAll(".essai")].map((e) => {
    const carte = e.querySelector(".wm-annonce");
    const titre = e.querySelector(".wm-annonce__titre");
    const sous = e.querySelector(".wm-annonce__soustitre");
    //  LE BORD DU CONTENU, et pas le bord de la boîte : la carte a un
    //  trait d'un pixel, et le compter de travers annonçait un décalage
    //  d'un pixel sur les treize sujets. C'était la mesure qui était
    //  fausse, pas la mise en page.
    const sc = getComputedStyle(carte);
    const bordCarte = carte.getBoundingClientRect().left +
      parseFloat(sc.borderLeftWidth) + parseFloat(sc.paddingLeft);
    const bord = (el) => el === null ? null : Math.round(el.getBoundingClientRect().left - bordCarte);
    return {
      nom: e.dataset.sujet,
      centre: carte.classList.contains("wm-annonce--centre"),
      aligne: getComputedStyle(titre).textAlign,
      titre: bord(titre),
      sous: bord(sous),
    };
  })
);
const centres = alignement.filter((a) => a.centre || a.aligne === "center");
dire(
  "aucune carte de défi n'est centrée",
  centres.length === 0,
  centres.map((c) => c.nom).join(", "),
);
const decales = alignement.filter((a) => a.titre !== 0 || (a.sous !== null && a.sous !== 0));
dire(
  "le titre et le sous-titre commencent au bord gauche de la carte",
  decales.length === 0,
  JSON.stringify(decales.slice(0, 3)),
);

// ── 3 · LES ÉCARTS QU'ON A DÛ RÉPARER À LA MAIN ─────────────────────
//
//  Les trois que ModernBB reprenait, ou qui manquaient. Mesurés dans
//  le corps de message, pas sur la règle : c'est la mesure qui avait
//  trouvé la faute, et c'est elle qui la retrouvera.
const ecarts = await p.evaluate(() => {
  const haut = (el) => parseFloat(getComputedStyle(el).marginTop);
  const carte = document.querySelector('[data-sujet="t63-eau"] .wm-annonce');
  const texte = carte.querySelector(".wm-annonce__texte");
  const sousApresBlocs = carte.querySelector(".wm-annonce__blocs + .wm-annonce__soustitre");
  const titre = carte.querySelector(".wm-annonce__titre");
  const filet = getComputedStyle(titre, "::after").content;
  return {
    margeTexte: haut(texte),
    sousApresBlocs: sousApresBlocs === null ? null : haut(sousApresBlocs),
    //  `--sans-filet` retire le trait sous le titre ET rend au titre
    //  le bas de marge que le trait portait.
    filet,
    basDuTitre: parseFloat(getComputedStyle(titre).paddingBottom),
  };
});
dire(
  "la marge haute d'un texte d'annonce vaut 16 px dans un message",
  ecarts.margeTexte === 16,
  `${ecarts.margeTexte}px — une règle de ModernBB est repassée devant`,
);
dire(
  "et un sous-titre qui suit les cadres de types a ses 24 px",
  ecarts.sousApresBlocs === 24,
  `${ecarts.sousApresBlocs}px`,
);
dire("le filet sous le titre est bien retiré", ecarts.filet === "none", ecarts.filet);

// ── 4 · LA LIGUE : CINQ ADVERSAIRES, ET ON LE VOIT ──────────────────
//
//  « Ça manque d'espace ici, entre les équipes. On voit pas que ce
//  sont des équipes différentes, de personnages différents. »
//
//  Trois choses à tenir, et une seule se verrait sur une capture :
//
//    1. L'ÉCART. Il doit exister, et valoir plus qu'un interligne.
//    2. LA CARTE SE DÉTACHE. Un cadre sur une surface de même couleur
//       ne groupe rien. On compare donc les deux fonds peints.
//    3. LES CADRES INTÉRIEURS SE DÉTACHENT ENCORE. C'est l'effet de
//       bord de 2 : en passant la carte d'adversaire en surface
//       claire, les deux cadres de types — clairs eux aussi partout
//       ailleurs — disparaissaient dedans. Ils basculent au sable, et
//       c'est exactement le genre d'inversion qu'on casse six mois
//       plus tard sans s'en apercevoir.
const ligue = await p.evaluate(() => {
  const lin = (c) => (c /= 255, c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const lum = ([r, g, b]) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  const rgb = (t) => (t.match(/[\d.]+/g) || []).slice(0, 3).map(Number);
  const rapport = (a, b) => {
    const [hi, lo] = [lum(rgb(a)), lum(rgb(b))].sort((x, y) => y - x);
    return Math.round(((hi + 0.05) / (lo + 0.05)) * 100) / 100;
  };
  const e = document.querySelector('[data-sujet="t100-ligue-les-equipes"]');
  const carte = e.querySelector(".wm-annonce");
  const duels = [...e.querySelectorAll(".wm-annonce__duel")];
  const bas = (el) => el.getBoundingClientRect().bottom;
  const haut = (el) => el.getBoundingClientRect().top;
  return {
    combien: duels.length,
    //  L'écart RÉEL entre deux cartes, pas la marge déclarée.
    ecarts: duels.slice(1).map((d, i) => Math.round(haut(d) - bas(duels[i]))),
    rangs: duels.map((d) => d.querySelector(".wm-annonce__duel-rang")?.textContent.trim() ?? null),
    //  Le rang est muet pour un lecteur d'écran, et le mot le dit.
    muets: duels.every((d) =>
      d.querySelector(".wm-annonce__duel-rang")?.getAttribute("aria-hidden") === "true"
    ),
    rappels: duels.map((d) =>
      d.querySelector(".wm-annonce__duel-rappel")?.textContent.trim() ?? null
    ),
    titres: duels.map((d) =>
      d.querySelector(".wm-annonce__duel-titre")?.textContent.trim() ?? null
    ),
    //  ── LE TYPE SE REPÈRE AVANT DE SE LIRE ──────────────────────
    //
    //  Le titre porte la pastille du type, pas son nom en serif. On
    //  vérifie qu'elle est là, qu'elle annonce LE MÊME type que
    //  l'équipe en dessous, et qu'elle n'ouvre pas la ligne du titre
    //  — une pastille à son remplissage normal fait 27 px contre un
    //  interligne de 17,6, et le titre se décalerait de dix pixels.
    pastilles: duels.map((d) => {
      const t = d.querySelector(".wm-annonce__duel-titre .wm-type");
      if (t === null) return null;
      return {
        type: t.dataset.wmType ?? null,
        mot: t.textContent.trim(),
        hauteur: Math.round(t.getBoundingClientRect().height),
        //  Le premier type de la première case de SON équipe.
        premierDeLEquipe: d.querySelector(".wm-equipe__pkmn .wm-type")?.dataset.wmType ?? null,
      };
    }),
    hauteurTitres: duels.map((d) =>
      Math.round(d.querySelector(".wm-annonce__duel-titre").getBoundingClientRect().height)
    ),
    //  Chaque adversaire garde ses deux repères : son équipe, et de
    //  quoi la combattre.
    chacunSonEquipe: duels.every((d) => d.querySelectorAll("ul.wm-equipe").length === 1),
    chacunSesCadres: duels.every((d) => d.querySelectorAll(".wm-annonce__bloc").length >= 1),
    carteSurFond: rapport(
      getComputedStyle(duels[0]).backgroundColor,
      getComputedStyle(carte).backgroundColor,
    ),
    cadreSurCarte: rapport(
      getComputedStyle(duels[0].querySelector(".wm-annonce__bloc")).backgroundColor,
      getComputedStyle(duels[0]).backgroundColor,
    ),
    //  Le titre d'un adversaire doit peser PLUS qu'une étiquette de
    //  section : c'est lui qui dit « nouvelle personne ».
    tailleTitre: parseFloat(getComputedStyle(
      duels[0].querySelector(".wm-annonce__duel-titre"),
    ).fontSize),
    tailleRappel: parseFloat(getComputedStyle(
      duels[0].querySelector(".wm-annonce__duel-rappel"),
    ).fontSize),
    debord: document.documentElement.scrollWidth > innerWidth,
  };
});
dire("la Ligue porte cinq adversaires", ligue.combien === 5, JSON.stringify(ligue.rangs));
dire(
  "numérotés dans l'ordre du combat, et muets pour un lecteur d'écran",
  ligue.rangs.join("") === "12345" && ligue.muets,
  JSON.stringify({ rangs: ligue.rangs, muets: ligue.muets }),
);
dire(
  "chacun a son rappel de rang, son titre, son équipe et ses cadres",
  ligue.rappels.every((r) => r !== null && /adversaire/i.test(r)) &&
    ligue.titres.every((t) => t !== null && t !== "") &&
    ligue.chacunSonEquipe && ligue.chacunSesCadres,
  JSON.stringify({ rappels: ligue.rappels, titres: ligue.titres }),
);
dire(
  "et leurs titres sont tous différents : cinq personnes, pas cinq rangées",
  new Set(ligue.titres).size === 5,
  JSON.stringify(ligue.titres),
);
//  LES QUATRE DU CONSEIL PORTENT LEUR PASTILLE ; MICHAEL N'EN A PAS,
//  et c'est juste : son équipe mélange six types, aucune pastille ne
//  le résumerait.
const quatre = ligue.pastilles.slice(0, 4);
dire(
  "les quatre du Conseil annoncent leur type en pastille, pas en mot",
  quatre.every((p) => p !== null && p.type !== null && p.mot !== "") &&
    ligue.pastilles[4] === null,
  JSON.stringify(ligue.pastilles),
);
dire(
  "et la pastille dit le MÊME type que l'équipe en dessous",
  quatre.every((p) => p !== null && p.type === p.premierDeLEquipe),
  JSON.stringify(quatre.map((p) => p && [p.type, p.premierDeLEquipe])),
);
dire(
  "elle n'ouvre pas la ligne du titre",
  quatre.every((p) => p !== null && p.hauteur <= 22),
  JSON.stringify({
    pastilles: quatre.map((p) => p?.hauteur),
    titres: ligue.hauteurTitres,
  }),
);
dire(
  "ils sont séparés d'au moins 24 px",
  ligue.ecarts.every((x) => x >= 24),
  JSON.stringify(ligue.ecarts),
);
dire(
  "LA CARTE D'UN ADVERSAIRE SE DÉTACHE DE L'ANNONCE",
  ligue.carteSurFond >= 1.08,
  `rapport ${ligue.carteSurFond}`,
);
dire(
  "ET SES CADRES DE TYPES SE DÉTACHENT ENCORE DE LA CARTE",
  ligue.cadreSurCarte >= 1.08,
  `rapport ${ligue.cadreSurCarte}`,
);
dire(
  "le titre d'un adversaire pèse plus que son rappel de rang",
  ligue.tailleTitre > ligue.tailleRappel + 3,
  `${ligue.tailleTitre}px contre ${ligue.tailleRappel}px`,
);
dire("et rien ne déborde en largeur", !ligue.debord);

// ── 5 · EN SOMBRE, AUCUNE PLAQUE CLAIRE ─────────────────────────────
//
//  La même règle que partout depuis le 30 octobre : une carte peinte
//  avec un jeton qui s'éclaircit la nuit devient la seule tache
//  blanche d'une page noire.
await p.evaluate(() => document.body.classList.add("wm-sombre"));
await p.waitForTimeout(150);
const sombre = await p.evaluate(() => {
  const lin = (c) => (c /= 255, c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const lum = (t) => {
    const [r, g, b] = (t.match(/[\d.]+/g) || []).slice(0, 3).map(Number);
    return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  };
  const clairs = [];
  for (
    const el of document.querySelectorAll(
      ".wm-annonce, .wm-annonce__duel, .wm-annonce__bloc, .wm-annonce__duel-rang",
    )
  ) {
    const f = getComputedStyle(el).backgroundColor;
    if (!/rgba\(0, 0, 0, 0\)/.test(f) && lum(f) > 0.35) {
      clairs.push(el.className + " → " + f);
    }
  }
  const d = document.querySelector(".wm-annonce__duel");
  const rgb = (t) => (t.match(/[\d.]+/g) || []).slice(0, 3).map(Number);
  const rap = (a, b) => {
    const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
    return Math.round(((hi + 0.05) / (lo + 0.05)) * 100) / 100;
  };
  return {
    clairs,
    titreSurCarte: rap(
      getComputedStyle(d.querySelector(".wm-annonce__duel-titre")).color,
      getComputedStyle(d).backgroundColor,
    ),
    rappelSurCarte: rap(
      getComputedStyle(d.querySelector(".wm-annonce__duel-rappel")).color,
      getComputedStyle(d).backgroundColor,
    ),
    rangSurPastille: rap(
      getComputedStyle(d.querySelector(".wm-annonce__duel-rang")).color,
      getComputedStyle(d.querySelector(".wm-annonce__duel-rang")).backgroundColor,
    ),
    rgbVide: rgb("rgb(0,0,0)").length,
  };
});
dire("EN SOMBRE, AUCUNE PLAQUE CLAIRE", sombre.clairs.length === 0, sombre.clairs.join(" · "));
dire(
  "et les trois textes d'une carte d'adversaire tiennent les 4,5",
  [sombre.titreSurCarte, sombre.rappelSurCarte, sombre.rangSurPastille].every((r) => r >= 4.5),
  JSON.stringify(sombre),
);

for (const s of soucis) rate(s);

console.log(
  "\n" + (fautes === 0 ? "TOUT PASSE." : `${fautes} défaut(s).`) +
    `  ${sujets.length} blocs montés dans un corps de message.`,
);
await nav.close();
Deno.exit(fautes === 0 ? 0 : 1);
