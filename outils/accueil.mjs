// ════════════════════════════════════════════════════════════════════
//  outils/accueil.mjs
//
//  POURQUOI CE HARNAIS EXISTE. Le bloc d'accueil tient en trois choses
//  qu'aucun test de domaine ne peut voir :
//
//    · **il remplace un bloc déjà là.** Si le remplacement part de
//      travers, ce qui reste à l'écran n'est pas une page incomplète,
//      c'est une page VIDE. On vérifie donc les deux sens : qu'il
//      remplace quand il a de quoi, et qu'il ne touche à rien quand il
//      n'a rien ;
//    · **les infobulles des pré-liens flottent.** Elles contiennent un
//      lien, donc elles doivent s'ouvrir au clic ET au clavier, se
//      fermer à Échap, et ne pas sortir de l'écran — la leçon du
//      panneau de confort, le même jour ;
//    · **la mascotte déborde exprès.** Un décor qui déborde ne doit pas
//      faire défiler la page de travers, et c'est une mesure, pas une
//      intention.
//
//  Lancé par `deno task accueil`. Il monte le VRAI bloc de repli
//  (`pages/accueil-repli.html`), le vrai paquet et les vraies données :
//  si l'un des trois change sans les autres, il le dit.
// ════════════════════════════════════════════════════════════════════

import { chromium } from "npm:playwright@1.49.1";
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

const REPLI = readFileSync(R + "pages/accueil-repli.html", "utf8");

//  LES DONNÉES DU HARNAIS, PAS CELLES DU DÉPÔT. Le fichier du dépôt est
//  à moitié vide — Callista n'a pas encore rempli les URL —, et un
//  harnais qui ne verrait jamais une bulle remplie ne vérifierait rien.
//  Le vrai fichier est éprouvé ailleurs, par `accueil.test.ts`.
const DONNEES = {
  contexte: {
    titre: "Contexte",
    chapo: "10 ans après la chute de la Team Ombre.",
    paragraphes: ["Un premier paragraphe.", "Un second."],
    lien: { texte: "Lire le contexte", url: "/t1-contexte" },
  },
  liens: [
    { texte: "Contexte", url: "/t1" },
    { texte: "Règlement", url: "/t2" },
    { texte: "Questions", url: "" },
  ],
  partenaires: {
    titre: "Nos partenaires",
    lien: { texte: "Devenir partenaire", url: "/t9" },
    liste: [
      { nom: "Un forum ami", url: "https://ami.test" },
      { nom: "Un autre", url: "https://autre.test" },
    ],
  },
  votes: {
    titre: "Votez !",
    liste: [
      { nom: "Top site", url: "https://vote.test/1" },
      { nom: "Un autre classement", url: "https://vote.test/2" },
    ],
  },
  staff: [{
    pseudo: "Teenspirit",
    role: "Fondatrice",
    profil: "/u1",
    avatar: "",
    personnages: ["Elijah Springsteen", "Adam Lockhart"],
    presence: "Présente",
  }],
  actualites: {
    titre: "Actualités",
    lien: { texte: "Toutes les annonces", url: "/f1" },
    liste: [
      { date: "18 sept", titre: "Le Festival du Soleil ouvre ses stands", categorie: "événement", url: "/t20" },
      { date: "12 sept", titre: "Le carnet de bord est en ligne", categorie: "mise à jour", url: "" },
    ],
  },
  preliens: {
    titre: "Pré-liens",
    liste: [
      //  LE PREMIER A UN AVATAR, LE SECOND NON, et c'est le vrai jeu de
      //  cas : le panneau en reprend un dans sa bande de tête, et il
      //  doit tenir aussi quand il n'y en a pas.
      {
        personnage: "Elijah Springsteen",
        avatar: "https://exemple.test/img/accueil/avatar-par-defaut.png",
        lienAttendu: "Un rival d'enfance",
        auteur: "Teenspirit",
        url: "/t42-prelien",
      },
      { personnage: "Adam Lockhart", avatar: "", lienAttendu: "", auteur: "", url: "" },
    ],
  },
  //  La mascotte est SERVIE, et à sa vraie taille (306 × 303), parce
  //  que c'est sa taille qui a cassé la rangée du bas. Un carré de
  //  300 px de côté serait un faux témoin dans l'autre sens.
  images: { mascotte: "https://exemple.test/img/accueil/mascotte.png", fond: "" },
};

//  ── LES RÈGLES DE MODERNBB QUI DISPUTENT LES NÔTRES ─────────────────
//
//  RELEVÉES SUR LE FORUM, PAS INVENTÉES : le 7 octobre, en parcourant
//  `10-ltr.css` et en gardant les règles qui collent à un nœud du bloc
//  d'accueil. Dix-sept, recopiées telles quelles.
//
//  POURQUOI ELLES SONT LÀ. Le harnais ne les servait pas, et c'est ce
//  qui a laissé passer le défaut du 7 octobre : la feuille 14 n'avait
//  pas le préfixe `#modernbb`, donc `.content h2` (0-1-1) battait
//  `.wm-accueil__titre` (0-1-0) et TOUS les titres sortaient en Roboto
//  19,2 px au lieu de Kaushan 36. Ici tout passait, puisqu'il n'y avait
//  personne contre qui perdre.
//
//  Elles sont servies AVANT la nôtre, comme sur le forum : à
//  spécificité égale c'est la dernière qui gagne, et l'ordre fait donc
//  partie de ce qu'on éprouve.
const MODERNBB = `
*, ::before, ::after { box-sizing: border-box; margin: 0; padding: 0; }
h2 { color: #3e464c; font-family: Roboto, sans-serif; font-size: 2em; font-weight: 400; margin: 0; }
p { line-height: 1.3846; font-size: 1.3rem; margin-bottom: 18px; }
p:last-child { margin-bottom: 0; }
img { border-width: 0; }
ul { list-style-type: none; }
button { background-color: rgba(255,255,255,0); cursor: pointer; }
a { text-decoration: none; }
a:link { color: #3e464c; }
.panel p, .panel div.mes-txt { font-size: 1.3rem; margin-bottom: 18px; word-break: break-word; }
.panel p:last-child, .panel div.mes-txt:last-child { word-break: break-word; margin-bottom: 18px; }
.content h2, .panel h2 { border-color: #3793ff; color: #3793ff; border-style: solid;
  border-width: 0 0 1px; font-family: Roboto, sans-serif; font-size: 1.6rem;
  font-weight: 400; line-height: 1.526; margin-bottom: 9px; margin-top: -3px; padding-bottom: 3px; }
div.mes-txt ul, div.mes-txt ol { padding-left: 40px; }
div.mes-txt ul { list-style-type: disc; }
#wrap div#page-body h2 { font-weight: 500; border-bottom: 1px solid #ccc; margin-bottom: 1em; }
.modern-resp .panel p { word-break: break-word; }
.modern-resp .panel div.mes-txt img { max-width: 100%; }
/*  ET CELLE-CI ROGNAIT LA MASCOTTE. Relevee le 8 octobre dans le CSS
    principal : ModernBB met "overflow: hidden" sur ".panel", et le
    bloc d'accueil vit dedans. Le Krokorok est fait pour deborder de
    60 px a gauche et de 93 en bas - il etait coupe net au bord du
    panneau. Le harnais ne la servait pas, donc il ne pouvait pas le
    voir.  PAS DE BACKTICK DANS CE COMMENTAIRE : il est dans un
    gabarit JS, et un backtick y ferme la chaine. Quatrieme fois. */
.panel { background-color: #f8f8f8; color: #444; border-radius: 3px;
  box-shadow: 0 1px 6px rgb(0 0 0 / .06); margin-bottom: 24px;
  overflow: hidden; position: relative; }
.row3 { background-color: #f8f8f8; }
`;

//  L'EMPILEMENT RÉEL, relevé le même jour en remontant les parents du
//  bloc sur le forum. `.panel`, `.mes-txt` et `#wrap > #page-body` sont
//  ceux qui portent les règles ci-dessus : sans eux, la moitié d'entre
//  elles ne collerait à rien et le harnais mentirait dans l'autre sens.
const page = `<!doctype html><html lang="fr" id="min-width"><head><meta charset="utf-8">
<style>html,body{margin:0}body{font-size:10px;background:var(--wm-fond-page)}</style>
<style>${MODERNBB}</style>
<style>${readFileSync(R + "panneau-admin/jetons.css", "utf8")}</style>
<style>${readFileSync(R + "css/wild-mystery.css", "utf8")}</style></head>
<body id="modernbb">
<div class="conteneur_minwidth_IE modern-resp"><div id="wrap"><div id="page-body">
<div id="main-content"><div class="panel introduction"><div class="mes-txt">
${REPLI}
</div></div></div>
<div class="forabg" style="height:1200px">la liste des forums, qui reste en dessous</div>
</div></div></div>
</body></html>`;

const nav = await chromium.launch(CHROME === undefined ? {} : { executablePath: CHROME });
const p = await nav.newPage({ viewport: { width: 1280, height: 900 } });
const soucis = [];
p.on("pageerror", (e) => soucis.push("erreur JS : " + e.message));

function dire(nom, ok, detail = "") {
  if (!ok) soucis.push(nom + (detail ? " — " + detail : ""));
  console.log(`${ok ? "  ok  " : "DÉFAUT"} ${nom}${detail ? " — " + detail : ""}`);
}

//  UN SEUL AIGUILLAGE, qui sert trois choses : la page, le paquet, et
//  le fichier de données. Les trois passent par le réseau comme sur le
//  forum — c'est le CHEMIN RÉEL qu'on éprouve, racine des données
//  comprise, et pas un appel direct au poseur.
await p.route("**/*", (route) => {
  const url = route.request().url();
  if (url.endsWith("/accueil.json")) {
    return route.fulfill({ contentType: "application/json", body: JSON.stringify(DONNEES) });
  }
  if (url.endsWith("/wild-mystery.js")) {
    return route.fulfill({
      contentType: "text/javascript; charset=utf-8",
      body: readFileSync(R + "js/wild-mystery.js", "utf8"),
    });
  }
  //  La vraie image du dépôt, à ses vraies dimensions.
  const img = /\/img\/accueil\/([a-z-]+\.png)$/.exec(url);
  if (img !== null) {
    return route.fulfill({
      contentType: "image/png",
      body: readFileSync(R + "img/accueil/" + img[1]),
    });
  }
  return route.fulfill({ contentType: "text/html; charset=utf-8", body: page });
});
await p.goto("https://exemple.test/");

// ── 1 · LE REPLI SEUL EST DÉJÀ LISIBLE ──────────────────────────────
//  Avant tout module : c'est l'état d'un visiteur sans JavaScript, et
//  c'est la seule raison pour laquelle ce bloc existe.
const sansModule = await p.evaluate(() => {
  const hote = document.querySelector("#wm-accueil");
  return {
    la: hote !== null,
    texte: hote.textContent.replace(/\s+/g, " ").trim().slice(0, 60),
    liens: hote.querySelectorAll(".wm-accueil__rapide").length,
    hauteur: Math.round(hote.getBoundingClientRect().height),
  };
});
dire("sans JavaScript, le bloc de repli est déjà là", sansModule.la);
dire(
  "il porte le contexte et les sept liens",
  sansModule.texte.startsWith("Contexte") && sansModule.liens === 7,
  JSON.stringify(sansModule),
);
dire("et il occupe de la place : ce n'est pas un bloc vide", sansModule.hauteur > 200);

// ── 2 · le module le remplace ───────────────────────────────────────
//  Le paquet lit la racine des données dans `currentScript.src` : on le
//  charge donc depuis une vraie adresse, et pas en collant son texte.
await p.evaluate(() => {
  const s = document.createElement("script");
  s.src = "https://exemple.test/js/wild-mystery.js";
  document.body.appendChild(s);
});
await p.waitForTimeout(600);

const pose = await p.evaluate(() => {
  const hote = document.querySelector("#wm-accueil");
  const q = (s) => hote.querySelectorAll(s).length;
  return {
    pose: hote.classList.contains("wm-accueil--pose"),
    contexte: q(".wm-accueil__contexte"),
    liens: q(".wm-accueil__rapide"),
    partenaires: q(".wm-accueil__partenaire"),
    votes: q(".wm-accueil__vote"),
    staff: q(".wm-accueil__membre"),
    actus: q(".wm-news__entree"),
    preliens: q(".wm-accueil__prelien"),
    //  Les sept blocs doivent tenir dans la largeur : c'est la
    //  première chose qui casse quand on traduit des positions
    //  absolues en flexbox.
    debord: document.documentElement.scrollWidth > innerWidth,
  };
});
dire("le module a remplacé le repli", pose.pose, JSON.stringify(pose));
dire(
  "LES SEPT BLOCS SONT LÀ",
  pose.contexte === 1 && pose.liens === 3 && pose.partenaires === 2 &&
    pose.votes === 2 && pose.staff === 1 && pose.actus === 2 && pose.preliens === 2,
  JSON.stringify(pose),
);
dire("et rien ne déborde en largeur", !pose.debord);

// ── 2 bis · LA MASCOTTE EST UN DÉCOR, ET ELLE RESTE DANS SON COIN ──
//  CETTE SECTION A DIT AUTRE CHOSE PENDANT UNE JOURNÉE, ET C'ÉTAIT
//  FAUX. Elle exigeait que le rectangle de la mascotte ne croise aucun
//  texte ni aucun lien. La maquette dit l'inverse : `image 7` fait
//  312 × 312 à x = −60, la carte des partenaires commence à 155, et le
//  Krokorok passe franchement par-dessus son bord gauche. C'est la
//  TRANSPARENCE du PNG qui fait le travail, pas un évitement — ses
//  pixels opaques s'arrêtent bien avant le titre de la carte.
//
//  Un rectangle ne sait pas dire ça. On avait donc écrit un test qui
//  mesurait la bonne chose pour défendre une invention : rapetisser
//  l'image à 190 px pour qu'elle ne morde plus. Le test passait, et le
//  bloc ne ressemblait plus au dessin.
//
//  Ce qui se vérifie vraiment, et qui est ce qui compte :
const decor = await p.evaluate(() => {
  const m = document.querySelector(".wm-accueil__mascotte");
  if (m === null) return { absente: true };
  const r = m.getBoundingClientRect();
  const pan = document.querySelector(".wm-accueil__panneau").getBoundingClientRect();
  const avant = document.documentElement.scrollHeight;
  return {
    absente: false,
    //  Elle ne prend aucune place : enlevée, la page garde sa hauteur.
    horsDuFlux: getComputedStyle(m).position === "absolute",
    hauteurDeLaPage: avant,
    //  Elle n'attrape pas un clic destiné à ce qui passe dessous.
    transparenteAuClic: getComputedStyle(m).pointerEvents === "none",
    //  Et elle est bien dans le coin bas-gauche, débordant des deux
    //  côtés, comme la maquette : x = −60 et 93 px sous le panneau.
    deborde: Math.round(r.left - pan.left) < 0 && Math.round(r.bottom - pan.bottom) > 0,
    aGauche: Math.round(r.left - pan.left),
    sousLePanneau: Math.round(r.bottom - pan.bottom),
  };
});
dire(
  "LA MASCOTTE NE PREND PAS DE PLACE ET N'ATTRAPE PAS LES CLICS",
  !decor.absente && decor.horsDuFlux && decor.transparenteAuClic,
  JSON.stringify(decor),
);
dire(
  "et elle déborde en bas à gauche, comme la maquette",
  decor.deborde,
  JSON.stringify(decor),
);
//  ET RIEN NE LA ROGNE. ModernBB met `overflow: hidden` sur `.panel`,
//  qui est le conteneur du message d'accueil : le Krokorok était coupé
//  net au bord. Un rectangle ne le dit pas — l'image garde sa taille,
//  c'est le PARENT qui la cache. On remonte donc la chaîne.
const rognage = await p.evaluate(() => {
  const coupables = [];
  let n = document.querySelector(".wm-accueil__mascotte")?.parentElement ?? null;
  while (n !== null && n !== document.documentElement) {
    const o = getComputedStyle(n);
    if (o.overflow !== "visible" && o.overflowX !== "visible") {
      coupables.push(
        (n.id ? "#" + n.id : "") + (n.className ? "." + n.className.toString().trim().split(/\s+/)[0] : n.tagName.toLowerCase()) +
          " → " + o.overflow,
      );
    }
    n = n.parentElement;
  }
  return coupables;
});
dire(
  "ET RIEN NE LA ROGNE : aucun parent ne coupe ce qui déborde",
  rognage.length === 0,
  JSON.stringify(rognage),
);

// ── 3 · un lien sans adresse n'est pas un lien ──────────────────────
const sansAdresse = await p.evaluate(() => {
  const rapides = [...document.querySelectorAll(".wm-accueil__rapide")];
  const muet = rapides.find((r) => r.textContent.includes("Questions"));
  const parlant = rapides.find((r) => r.textContent.includes("Contexte"));
  return {
    muetEstUnLien: muet.tagName === "A",
    parlantEstUnLien: parlant.tagName === "A" && parlant.getAttribute("href") === "/t1",
    //  IL NE SE VOIT PLUS, et c'est voulu depuis le 8 octobre : « pas
    //  barré mais en bleu ». Le gris barré était mon idée, pas la
    //  maquette, qui montre ses sept liens identiques. Ce qui reste,
    //  c'est le `title` — et le fait que ce ne soit pas un `<a>`.
    barre: getComputedStyle(muet).textDecorationLine,
    infobulle: muet.getAttribute("title"),
  };
});
dire("UN LIEN SANS ADRESSE N'EST PAS UN LIEN", !sansAdresse.muetEstUnLien);
dire("celui qui en a une l'a gardée", sansAdresse.parlantEstUnLien);
dire(
  "ET IL N'EST NI BARRÉ NI GRIS — le manque se dit, il ne se peint plus",
  sansAdresse.barre === "none" && sansAdresse.infobulle === "Adresse à renseigner",
  JSON.stringify(sansAdresse),
);

// ── 2 ter · C'EST NOUS QUI GAGNONS CONTRE MODERNBB ──────────────────
//  Le harnais sert maintenant les dix-sept règles de `10-ltr.css` qui
//  disputent les nôtres, dans l'ordre réel. Reste à vérifier que la
//  cascade tourne de notre côté — c'est tout l'objet du préfixe
//  `#modernbb`, et c'est ce qui manquait le 7 octobre.
//
//  On mesure ce que ModernBB imposait ce jour-là, pas une propriété au
//  hasard : la police des titres, la taille du corps, la couleur des
//  liens et le retrait des listes.
const cascade = await p.evaluate(() => {
  const g = (s, p) => {
    const e = document.querySelector(s);
    return e === null ? "absent" : getComputedStyle(e).getPropertyValue(p);
  };
  return {
    titre: g(".wm-accueil__titre", "font-family").split(",")[0].replace(/"/g, ""),
    titreCarte: g(".wm-accueil__titre-carte", "font-family").split(",")[0].replace(/"/g, ""),
    tailleDuTitre: g(".wm-accueil__titre", "font-size"),
    corps: g(".wm-accueil__texte", "font-size"),
    //  `a:link { color: #3e464c }` de ModernBB.
    lien: g(".wm-accueil__lien", "color"),
    //  `div.mes-txt ul { padding-left: 40px }`.
    retrait: g(".wm-accueil__liste-liens", "padding-left"),
    //  `.content h2 { border-width: 0 0 1px; border-color: #3793ff;
    //  padding-bottom: 3px }`. On gagnait la police et la taille, donc
    //  on croyait avoir gagné — et le FILET BLEU restait sous chacun
    //  des cinq titres, en plein thème sombre.
    filet: g(".wm-accueil__titre", "border-bottom-width"),
    sousTitre: g(".wm-accueil__titre", "padding-bottom"),
    //  Et la couleur : notre propre `02-socle` la mangeait. Son
    //  `:is(…, .panel, …) :where(…, h2, …) { color: inherit }` pèse
    //  (1,1,1) — `:is()` prend la spécificité de son plus fort
    //  argument — contre les (1,1,0) de nos composants.
    couleurDuTitre: g(".wm-accueil__titre", "color"),
  };
});
dire(
  "LES TITRES SONT EN KAUSHAN, PAS EN ROBOTO",
  cascade.titre === "Kaushan Script" && cascade.titreCarte === "Kaushan Script",
  JSON.stringify(cascade),
);
dire(
  "et le reste aussi est à nous : taille, couleur, retrait",
  cascade.tailleDuTitre === "36px" && cascade.corps === "13.5px" &&
    cascade.lien !== "rgb(62, 70, 76)" && cascade.retrait === "0px",
  JSON.stringify(cascade),
);
dire(
  "PAS DE FILET BLEU SOUS LES TITRES",
  cascade.filet === "0px" && cascade.sousTitre === "0px",
  JSON.stringify(cascade),
);
//  La VALEUR du jeton, pas une couleur recopiée : `accent-terre` a
//  changé le 8 octobre quand le fond de page a foncé, et une couleur
//  en dur dans un test se périme en silence.
const terre = await p.evaluate(() => {
  const d = document.createElement("div");
  d.style.color = "var(--wm-accent-terre)";
  document.body.appendChild(d);
  const c = getComputedStyle(d).color;
  d.remove();
  return c;
});
dire(
  "et le titre a bien sa terre, que notre propre neutraliseur mangeait",
  cascade.couleurDuTitre === terre,
  `${cascade.couleurDuTitre} contre ${terre}`,
);

// ── 3 bis · L'ŒIL EST UN TRACÉ, PAS UN MOT ──────────────────────────
//  Il a été `<span class="material-symbols-outlined">visibility</span>`,
//  et au premier rendu la police n'avait pas chargé : le mot s'affichait
//  en clair sur les sept lignes, barré sur celles sans adresse. Aucun
//  test ne pouvait le voir — ils comptaient des nœuds, pas des pixels.
const loeil = await p.evaluate(() => {
  const yeux = [...document.querySelectorAll(".wm-accueil__oeil")];
  const hote = document.querySelector("#wm-accueil");
  return {
    combien: yeux.length,
    balises: [...new Set(yeux.map((o) => o.tagName.toLowerCase()))],
    //  Le mot ne doit figurer NULLE PART dans le bloc, pas même caché :
    //  un lecteur d'écran le lirait.
    motVisible: /visibility/i.test(hote.textContent),
    //  Et la pastille garde sa taille : 12 px de dessin, 4 px de marge.
    taille: yeux.map((o) => {
      const r = o.getBoundingClientRect();
      return `${Math.round(r.width)}x${Math.round(r.height)}`;
    }),
  };
});
dire(
  "L'ŒIL EST UN SVG, PAS UNE LIGATURE",
  loeil.combien === 3 && loeil.balises.length === 1 && loeil.balises[0] === "svg",
  JSON.stringify(loeil),
);
dire("et le mot « visibility » n'est écrit nulle part", !loeil.motVisible);
dire(
  "la pastille fait toujours 20 px",
  loeil.taille.every((t) => t === "20x20"),
  JSON.stringify(loeil.taille),
);

// ── 3 ter · UNE ACTUALITÉ EST UNE RANGÉE, PAS UNE COLONNE ───────────
//  `.wm-news` est la pile, `.wm-news__entree` la rangée. Les nommer à
//  l'envers — ce que faisait la première version — empilait la date
//  au-dessus du titre avec 18 px de trou entre les deux, et triplait la
//  hauteur du bloc. Même défaut que ci-dessus : visible à l'écran,
//  invisible à un test qui compte des nœuds.
const uneActu = await p.evaluate(() => {
  const e = document.querySelector(".wm-news__entree");
  //  SANS CE GARDE, LE HARNAIS PLANTE AU LIEU DE DIRE CE QUI MANQUE.
  //  Vérifié en remettant le défaut : on obtenait une pile d'appels
  //  Playwright, qui ne nomme pas la classe absente.
  if (e === null) return { absente: true, memeLigne: false, dateAGauche: false, hauteur: 0 };
  const date = e.querySelector(".wm-news__date").getBoundingClientRect();
  const titre = e.querySelector(".wm-news__titre").getBoundingClientRect();
  return {
    absente: false,
    //  Même ligne : leurs hauts sont à moins de 4 px l'un de l'autre.
    memeLigne: Math.abs(date.top - titre.top) <= 4,
    //  Et la date est À GAUCHE du titre, pas au-dessus.
    dateAGauche: date.right <= titre.left + 1,
    hauteur: Math.round(e.getBoundingClientRect().height),
  };
});
dire(
  "LA DATE ET LE TITRE SONT SUR LA MÊME LIGNE",
  uneActu.memeLigne && uneActu.dateAGauche,
  JSON.stringify(uneActu),
);
dire(
  "et une entrée ne dépasse pas 48 px de haut",
  uneActu.hauteur > 0 && uneActu.hauteur <= 48,
  JSON.stringify(uneActu),
);

// ── 4 · L'INFOBULLE D'UN PRÉ-LIEN ───────────────────────────────────
const bulleFermee = await p.evaluate(() => {
  const pan = document.querySelector(".wm-accueil__prelien-panneau");
  return { cache: pan.hidden, hauteur: Math.round(pan.getBoundingClientRect().height) };
});
dire(
  "l'infobulle est fermée au départ",
  bulleFermee.cache === true && bulleFermee.hauteur === 0,
  JSON.stringify(bulleFermee),
);

async function ouvrirLaBulle() {
  return await p.evaluate(() => {
    const b = document.querySelector(".wm-accueil__prelien-bouton");
    if (document.querySelector(".wm-accueil__prelien-panneau").hidden) b.click();
    const pan = document.querySelector(".wm-accueil__prelien-panneau");
    const r = pan.getBoundingClientRect();
    return {
      ecran: innerWidth,
      texte: pan.textContent.replace(/\s+/g, " ").trim(),
      lien: pan.querySelector("a")?.getAttribute("href") ?? null,
      deplie: b.getAttribute("aria-expanded"),
      dedans: r.left >= 0 && r.right <= innerWidth && r.top >= 0,
      debord: document.documentElement.scrollWidth > innerWidth,
      l: Math.round(r.width),
    };
  });
}

const ouverte = await ouvrirLaBulle();
dire("elle s'ouvre au clic", ouverte.deplie === "true" && ouverte.l > 0, JSON.stringify(ouverte));
dire(
  "ELLE DIT LES TROIS CHOSES DEMANDÉES : le lien attendu, qui l'attend, et le sujet",
  ouverte.texte.includes("Un rival d'enfance") &&
    ouverte.texte.includes("Teenspirit") &&
    ouverte.lien === "/t42-prelien",
  JSON.stringify(ouverte),
);
dire("et elle ne sort pas de l'écran", ouverte.dedans && !ouverte.debord, JSON.stringify(ouverte));

//  ── LES TROIS ÉTAGES DU PANNEAU ─────────────────────────────────────
//  Il disait ses trois choses d'une seule voix : nom, clés et valeurs à
//  un demi-point d'écart, les clés collées à leurs valeurs sur la même
//  ligne. On vérifie que la hiérarchie EXISTE, en mesures et pas en
//  intentions : le nom plus grand que les valeurs, la clé plus petite,
//  et la clé AU-DESSUS de sa valeur et non à côté.
const etages = await p.evaluate(() => {
  const pan = document.querySelector(".wm-accueil__prelien-panneau");
  const px = (e, prop) => parseFloat(getComputedStyle(e)[prop]);
  const nom = pan.querySelector(".wm-accueil__prelien-nom");
  const clef = pan.querySelector(".wm-accueil__prelien-clef");
  const valeur = pan.querySelector(".wm-accueil__prelien-valeur");
  return {
    nom: px(nom, "fontSize"),
    clef: px(clef, "fontSize"),
    valeur: px(valeur, "fontSize"),
    capitales: getComputedStyle(clef).textTransform,
    //  Le filet n'est plus SOUS le nom mais sous la bande de tête, qui
    //  le contient : c'est elle qui sépare l'en-tête du corps depuis
    //  que le panneau en a une.
    filet: px(pan.querySelector(".wm-accueil__prelien-tete"), "borderBottomWidth"),
    figure: pan.querySelector(".wm-accueil__prelien-figure img") !== null,
    bouton: (() => {
      const l = pan.querySelector(".wm-accueil__prelien-lien");
      if (l === null) return null;
      const s = getComputedStyle(l);
      return { fond: s.backgroundColor, large: Math.round(l.getBoundingClientRect().width) };
    })(),
    clefAuDessus: Math.round(clef.getBoundingClientRect().bottom) <=
      Math.round(valeur.getBoundingClientRect().top),
    couple: pan.querySelector(".wm-accueil__prelien-liste")?.tagName ?? "aucun",
  };
});
dire(
  "LE NOM, LES CLÉS ET LES VALEURS NE SE LISENT PAS À LA MÊME VOIX",
  etages.nom > etages.valeur && etages.valeur > etages.clef && etages.filet >= 1,
  JSON.stringify(etages),
);
dire(
  "LE PANNEAU A UNE TÊTE AVEC L'AVATAR, ET UN PIED QUI EST UN BOUTON",
  etages.figure && etages.bouton !== null &&
    etages.bouton.fond !== "rgba(0, 0, 0, 0)" && etages.bouton.large > 150,
  JSON.stringify({ figure: etages.figure, bouton: etages.bouton }),
);
dire(
  "chaque clé est en capitales AU-DESSUS de sa valeur, dans une liste de définitions",
  etages.clefAuDessus && etages.capitales === "uppercase" && etages.couple === "DL",
  JSON.stringify(etages),
);

await p.keyboard.press("Escape");
const apresEchap = await p.evaluate(() => ({
  cache: document.querySelector(".wm-accueil__prelien-panneau").hidden,
  focus: document.activeElement?.className ?? "",
}));
dire("Échap la referme", apresEchap.cache === true);
dire(
  "et le focus revient à la bulle",
  apresEchap.focus.includes("wm-accueil__prelien-bouton"),
  apresEchap.focus,
);

//  UNE BULLE SANS DÉTAIL NE MONTRE PAS DE LIGNES VIDES.
const bulleNue = await p.evaluate(() => {
  const bulles = document.querySelectorAll(".wm-accueil__prelien");
  const pan = bulles[1].querySelector(".wm-accueil__prelien-panneau");
  return {
    lignes: pan.querySelectorAll(".wm-accueil__prelien-ligne").length,
    lien: pan.querySelector("a"),
    nom: pan.querySelector(".wm-accueil__prelien-nom")?.textContent,
  };
});
dire(
  "une bulle sans détail ne montre que le nom",
  bulleNue.lignes === 0 && bulleNue.lien === null && bulleNue.nom === "Adam Lockhart",
  JSON.stringify(bulleNue),
);

// ── 5 · petits écrans ───────────────────────────────────────────────
for (const largeur of [900, 520, 390, 320]) {
  await p.setViewportSize({ width: largeur, height: 800 });
  await p.waitForTimeout(100);
  const m = await ouvrirLaBulle();
  dire(`à ${largeur} px, l'infobulle reste dans l'écran`, m.dedans, JSON.stringify(m));
  dire(`à ${largeur} px, rien ne déborde`, !m.debord);
  //  ET LE BEC DÉSIGNE ENCORE SA BULLE. C'est là que ça se joue : sous
  //  520 px le panneau glisse de plus de 200 px pour rentrer dans
  //  l'écran, et un bec resté au milieu pointerait le vide.
  const bec = await p.evaluate(() => {
    const bulle = document.querySelector(".wm-accueil__prelien");
    const pan = bulle.querySelector(".wm-accueil__prelien-panneau");
    const g = getComputedStyle(pan, "::after");
    const x = pan.getBoundingClientRect().left + parseFloat(g.left);
    const b = bulle.getBoundingClientRect();
    //  Le pont, lui, se mesure en hauteur : il doit couvrir l'écart
    //  entre le bas du panneau et le haut de la bulle.
    const pont = parseFloat(getComputedStyle(pan, "::before").height);
    const vide = Math.round(b.top - pan.getBoundingClientRect().bottom);
    return { x: Math.round(x), g: Math.round(b.left), d: Math.round(b.right), pont, vide };
  });
  dire(
    `à ${largeur} px, le bec pointe encore sa bulle`,
    bec.x >= bec.g && bec.x <= bec.d,
    JSON.stringify(bec),
  );
  dire(
    `à ${largeur} px, le pont couvre le vide entre les deux`,
    bec.pont >= bec.vide,
    JSON.stringify(bec),
  );
  await p.keyboard.press("Escape");
}

// ── 5 bis · EN THÈME SOMBRE, RIEN NE RESTE CLAIR ────────────────────
//  Le bandeau du staff était une image — un dégradé bleu pâle de la
//  maquette — et une image ne suit pas le thème. En sombre, c'était le
//  seul bloc clair de la page : « pourquoi y'a un fond blanc ? j'en
//  veux pas ». Le harnais de contraste ne pouvait pas le voir, il
//  mesure du TEXTE sur son fond, pas un aplat au milieu d'une page.
//
//  On regarde donc les deux : la couleur de fond ET l'image de fond.
//  Une image reste un soupçon à elle seule — on ne sait pas la mesurer
//  d'ici, et c'est justement ce qui s'est passé.
await p.setViewportSize({ width: 1280, height: 900 });
await p.evaluate(() => document.body.classList.add("wm-sombre"));
await p.waitForTimeout(150);
const ensombre = await p.evaluate(() => {
  const clair = (c) => {
    const m = /rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/.exec(c);
    if (m === null) return false;
    const a = m[4] === undefined ? 1 : Number(m[4]);
    return a > 0.15 && (Number(m[1]) + Number(m[2]) + Number(m[3])) / 3 > 150;
  };
  const hote = document.querySelector("#wm-accueil");
  const fonds = [], images = [];
  for (const n of [hote, ...hote.querySelectorAll("*")]) {
    const s = getComputedStyle(n), r = n.getBoundingClientRect();
    if (r.width * r.height < 900) continue;
    const nom = (n.className || "").toString().split(" ")[0] || n.tagName.toLowerCase();
    if (clair(s.backgroundColor)) fonds.push(`${nom} ${s.backgroundColor}`);
    if (s.backgroundImage.includes("url(")) images.push(nom);
  }
  return { fonds, images, themeDuCorps: getComputedStyle(document.body).backgroundColor };
});
dire(
  "EN SOMBRE, AUCUN BLOC DU BLOC D'ACCUEIL N'EST CLAIR",
  ensombre.fonds.length === 0,
  JSON.stringify(ensombre),
);
dire(
  "et aucun fond n'est une image, qui ne saurait pas se retourner",
  ensombre.images.length === 0,
  JSON.stringify(ensombre.images),
);
await p.evaluate(() => document.body.classList.remove("wm-sombre"));

// ── 6 · LA MÊME PAGE, AVEC LES VRAIES DONNÉES DU DÉPÔT ──────────────
//  Les cinq sections au-dessus tournent sur un jeu d'essai taillé pour
//  éprouver les cas limites — trois liens, deux partenaires, une bulle
//  vide. C'est le bon outil pour ça, et c'est aussi sa limite : il est
//  PLUS PETIT que la vraie page.
//
//  Les deux défauts du 7 octobre — la mascotte qui mangeait le texte,
//  les actualités empilées en colonne — ne se voyaient qu'avec les sept
//  liens, les sept partenaires et les quatre nouvelles réels. Un aperçu
//  jetable les a trouvés ; cette section le remplace, pour qu'ils ne
//  reviennent pas en silence.
const REEL = JSON.parse(readFileSync(R + "data/accueil.json", "utf8"));
await p.setViewportSize({ width: 1340, height: 1000 });
await p.unrouteAll();
await p.route("**/*", (route) => {
  const url = route.request().url();
  if (url.endsWith("/accueil.json")) {
    return route.fulfill({ contentType: "application/json", body: JSON.stringify(REEL) });
  }
  if (url.endsWith("/wild-mystery.js")) {
    return route.fulfill({
      contentType: "text/javascript; charset=utf-8",
      body: readFileSync(R + "js/wild-mystery.js", "utf8"),
    });
  }
  const img = /\/img\/accueil\/([a-z-]+\.png)$/.exec(url);
  if (img !== null) {
    return route.fulfill({
      contentType: "image/png",
      body: readFileSync(R + "img/accueil/" + img[1]),
    });
  }
  //  Les avatars et les bannières de vote sont hébergés ailleurs : un
  //  carré de 80 px suffit, ce ne sont pas eux qu'on mesure.
  if (/\.(png|jpg|jpeg|gif)/.test(url)) {
    return route.fulfill({
      contentType: "image/svg+xml",
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80">' +
        '<rect width="80" height="80" fill="#c9a88e"/></svg>',
    });
  }
  return route.fulfill({ contentType: "text/html; charset=utf-8", body: page });
});
await p.goto("https://exemple.test/");
await p.evaluate(() => {
  const s = document.createElement("script");
  s.src = "https://exemple.test/js/wild-mystery.js";
  document.body.appendChild(s);
});
await p.waitForTimeout(900);

const vrai = await p.evaluate(() => {
  const hote = document.querySelector("#wm-accueil");
  const m = hote.querySelector(".wm-accueil__mascotte");
  const r = m === null ? null : m.getBoundingClientRect();
  const entrees = [...hote.querySelectorAll(".wm-news__entree")];
  return {
    pose: hote.classList.contains("wm-accueil--pose"),
    liens: hote.querySelectorAll(".wm-accueil__rapide").length,
    partenaires: hote.querySelectorAll(".wm-accueil__partenaire").length,
    actus: entrees.length,
    preliens: hote.querySelectorAll(".wm-accueil__prelien").length,
    mascotte: m === null ? "aucune" : `${Math.round(r.width)}x${Math.round(r.height)}`,
    plusHaute: Math.max(0, ...entrees.map((e) => Math.round(e.getBoundingClientRect().height))),
    debord: document.documentElement.scrollWidth > innerWidth,
    motVisible: /visibility/i.test(hote.textContent),
  };
});
dire(
  "AVEC LES VRAIES DONNÉES, LES SEPT BLOCS TIENNENT LA PAGE",
  vrai.pose && vrai.liens === 7 && vrai.partenaires === 7 && vrai.actus === 4 &&
    vrai.preliens === 6 && vrai.mascotte !== "aucune",
  JSON.stringify(vrai),
);
dire(
  "les actualités réelles tiennent en une rangée chacune",
  vrai.actus > 0 && vrai.plusHaute <= 48,
  JSON.stringify(vrai),
);
dire("et rien ne déborde, ni l'œil ne s'écrit", !vrai.debord && !vrai.motVisible);

// ── 7 · LES COTES DE LA MAQUETTE, AU PIXEL ──────────────────────────
//  Relevées sur le forum réel le 8 octobre, dans le navigateur, avec
//  la feuille de ce dépôt injectée par-dessus celle qui est servie.
//  Quatre d'entre elles étaient fausses, et aucune ne se voyait :
//
//    · le bandeau du staff commençait à 64 au lieu de 41 — on
//      descendait le bloc entier de 40 au lieu de 17 ;
//    · les membres à 64 au lieu de 72 ;
//    · la carte des actualités à 314 au lieu de 290 — la marge
//      négative se comptait depuis la bande, déjà décalée ;
//    · les partenaires à 383 au lieu de 391 — 24 entre les bandes au
//      lieu de 32.
//
//  Les mesures sont RELATIVES AU PANNEAU, comme dans Figma.
//
//  DEUX COTES SUR CINQ NE SONT PAS DES NOMBRES, MAIS DES ÉCARTS. La
//  bande du bas commence sous la plus haute des deux colonnes du
//  haut : avec le texte de contexte réel, à 1 340 px, c'est la colonne
//  de gauche, et la bande descend de 48 px. Figer 290 et 391 ferait
//  échouer le harnais sur un paragraphe en plus — ce n'est pas la
//  maquette qu'on vérifierait, c'est la longueur du contexte.
//
//  Ce qui doit tenir quoi qu'il arrive, c'est l'ÉCART : la carte des
//  actualités remonte de 69 sur le bas de la bande, la bande du bas
//  descend de 32 sous elle. Les deux donnent 290 et 391 quand le
//  contexte est court, comme dans le dessin.
const COTES = [
  [".wm-accueil__bandeau", 41, "le bandeau du staff"],
];
const cotes = await p.evaluate((liste) => {
  const r = (s) => document.querySelector(s).getBoundingClientRect();
  const panneau = r(".wm-accueil__panneau");
  const lu = {};
  for (const [sel, , nom] of liste) {
    const e = document.querySelector(sel);
    lu[nom] = e === null ? null : Math.round(e.getBoundingClientRect().top - panneau.top);
  }
  const bande = r(".wm-accueil__bande");
  const ecarts = {
    "la remontée des actualités": Math.round(bande.bottom - r(".wm-accueil__actus").top),
    "la descente de la bande du bas": Math.round(r(".wm-accueil__partenaires").top - bande.bottom),
    "la moitié dedans de la carte des votes": Math.round(r(".wm-accueil__votes").bottom - panneau.top),
    "la vignette de vote": Math.round(r(".wm-accueil__vote-image").height),
    "la bulle de pré-lien": Math.round(r(".wm-accueil__prelien-bouton").height),
  };

  //  ── LES TROIS BLOCS DU BAS FINISSENT ENSEMBLE ───────────────────
  //  Demandé le 8 octobre, et c'est `align-items: stretch` qui le
  //  tient — donc exactement le genre de chose qui se défait en
  //  silence le jour où quelqu'un remet un `min-height`.
  const bas = Object.fromEntries(
    [["partenaires", ".wm-accueil__partenaires"], ["préliens", ".wm-accueil__preliens"], [
      "actualités",
      ".wm-accueil__actus",
    ]].map(([nom, sel]) => [nom, {
      bas: Math.round(r(sel).bottom - panneau.top),
      h: Math.round(r(sel).height),
    }]),
  );

  //  ── LES MEMBRES SE TIENNENT AU MILIEU DU BANDEAU ────────────────
  //  « Centre bien les deux staffiens au milieu du bloc de staff,
  //  bien face au mot Staff ». On compare les deux milieux, pas une
  //  ordonnée : le nombre de membres change, le centre non.
  const membres = [...document.querySelectorAll(".wm-accueil__membre")]
    .map((e) => e.getBoundingClientRect());
  const bandeau = r(".wm-accueil__bandeau");
  const staff = {
    //  31 SOUS LE BANDEAU, la cote de la maquette. Ils ont été centrés
    //  une demi-journée ; centrés, le dernier touchait la carte des
    //  actualités. On mesure donc l'écart au bandeau, pas un milieu.
    sousLeBandeau: Math.round(membres[0].top - bandeau.top),
    //  Et le mot, lui, se centre sur ce QU'ON VOIT du bandeau — la
    //  carte des actualités en recouvre le bas.
    motAuMilieuDuVisible: (() => {
      const b = getComputedStyle(document.querySelector(".wm-accueil__bandeau"));
      return Math.round(parseFloat(b.paddingBottom));
    })(),
    //  Et la carte des actualités remonte jusqu'à eux, pas dedans.
    sousLesMembres: Math.round(r(".wm-accueil__actus").top - membres[membres.length - 1].bottom),
    retraitAvatar: parseFloat(getComputedStyle(document.querySelector(".wm-accueil__membre-avatar")).paddingTop),
    pseudo: parseFloat(getComputedStyle(document.querySelector(".wm-accueil__membre-pseudo")).fontSize),
    tags: [...document.querySelectorAll(".wm-accueil__tag")].map((a) => [
      a.textContent,
      a.getAttribute("href"),
    ]),
  };
  const m = r(".wm-accueil__mascotte");
  //  CE QUI SUIT LE BLOC DOIT COMMENCER SOUS ELLE. Elle déborde de
  //  93 px ; avec les 24 habituels sous le bloc, elle tombait sur le
  //  lien « Voir les messages sans réponses » et lui barrait la
  //  première ligne. Relevé sur le forum le 8 octobre.
  //
  //  On mesure l'écart, et pas `elementFromPoint` : la mascotte ne
  //  prend pas le clic, donc le point rendrait toujours le conteneur
  //  qui est dessous, qu'elle le recouvre ou non.
  const apres = Math.round(r(".forabg").top - m.bottom);
  //  LA MASCOTTE PASSE DEVANT LA CARTE DES PARTENAIRES, et pas
  //  derrière. Demandé le 8 octobre. On ne peut pas lire une
  //  superposition : on lit les deux `z-index` dans le même contexte
  //  d'empilement, et on vérifie qu'elles se chevauchent — un ordre
  //  juste sur deux boîtes disjointes ne veut rien dire.
  //  CE QU'ON VOIT DES ACTUALITÉS, c'est la carte blanche, pas la
  //  boîte qui la contient : le titre déborde par le haut, et la carte
  //  s'arrêtait 36 px avant les deux autres alors que les boîtes, elles,
  //  tombaient juste.
  bas["la carte des actualités"] = {
    bas: Math.round(r(".wm-accueil__actus > .wm-accueil__carte").bottom - panneau.top),
    h: Math.round(r(".wm-accueil__actus > .wm-accueil__carte").height),
  };
  //  ET LES SEPT VIGNETTES DE PARTENAIRE TIENNENT SUR UNE RANGÉE. La
  //  carte pouvait rétrécir à 264, et la septième passait à la ligne.
  const rangees = new Set(
    [...document.querySelectorAll(".wm-accueil__partenaire")]
      .map((e) => Math.round(e.getBoundingClientRect().top)),
  ).size;

  const carte = r(".wm-accueil__partenaires");
  const devant = {
    mascotte: Number(getComputedStyle(document.querySelector(".wm-accueil__mascotte")).zIndex),
    bande: Number(getComputedStyle(document.querySelector(".wm-accueil__bande--bas")).zIndex),
    chevauche: Math.round(Math.min(m.right, carte.right) - Math.max(m.left, carte.left)),
  };
  return {
    bas,
    rangeesDePartenaires: rangees,
    staff,
    devant,
    lu,
    ecarts,
    debordBas: Math.round(m.bottom - panneau.bottom),
    debordGauche: Math.round(panneau.left - m.left),
    apres,
  };
}, COTES);
for (const [, attendu, nom] of COTES) {
  dire(
    `${nom} est à y = ${attendu} dans le panneau`,
    cotes.lu[nom] === attendu,
    `relevé ${cotes.lu[nom]}`,
  );
}
for (const [nom, attendu] of Object.entries({
  "la remontée des actualités": 77,
  "la descente de la bande du bas": 32,
  "la moitié dedans de la carte des votes": 36,
  "la vignette de vote": 26,
  "la bulle de pré-lien": 75,
})) {
  dire(`${nom} vaut ${attendu}`, cotes.ecarts[nom] === attendu, `relevé ${cotes.ecarts[nom]}`);
}

const bas = Object.values(cotes.bas).map((b) => b.bas);
dire(
  "PARTENAIRES, PRÉ-LIENS ET ACTUALITÉS FINISSENT SUR LA MÊME LIGNE",
  new Set(bas).size === 1,
  JSON.stringify(cotes.bas),
);
dire(
  "les sept vignettes de partenaire tiennent sur une rangée",
  cotes.rangeesDePartenaires === 1,
  `${cotes.rangeesDePartenaires} rangée(s)`,
);
dire(
  "et les pré-liens font la hauteur des partenaires",
  cotes.bas["préliens"].h === cotes.bas.partenaires.h,
  JSON.stringify(cotes.bas),
);
//  Deux pixels de tolérance : le centrage tombe sur un demi-pixel dès
//  que la hauteur des membres est impaire, et l'arrondi du navigateur
//  le rend tantôt d'un côté tantôt de l'autre.
dire(
  "les membres du staff commencent 31 px sous le bandeau, comme la maquette",
  cotes.staff.sousLeBandeau === 31,
  `relevé ${cotes.staff.sousLeBandeau}`,
);
dire(
  "et le mot « Staff » se centre sur la partie que les actualités ne couvrent pas",
  cotes.staff.motAuMilieuDuVisible === 77,
  `rembourrage bas ${cotes.staff.motAuMilieuDuVisible}`,
);
dire(
  "et la carte des actualités remonte jusqu'à eux SANS les toucher",
  cotes.staff.sousLesMembres >= 0,
  `${cotes.staff.sousLesMembres} px sous le dernier membre`,
);
dire(
  "l'avatar du staff a le retrait des bulles de pré-lien, et le pseudo a grossi",
  cotes.staff.retraitAvatar === 5 && cotes.staff.pseudo >= 13,
  JSON.stringify(cotes.staff),
);
dire(
  "les personnages sont des comptes taggués, et ils mènent quelque part",
  cotes.staff.tags.length > 0 &&
    cotes.staff.tags.every(([t, h]) => t.startsWith("@") && h !== null && h !== ""),
  JSON.stringify(cotes.staff.tags),
);
dire(
  "la mascotte déborde de 93 en bas et de 60 à gauche",
  cotes.debordBas === 93 && cotes.debordGauche === 60,
  JSON.stringify(cotes),
);
dire(
  "et ce qui suit le bloc commence sous elle",
  cotes.apres >= 0,
  `${cotes.apres} px entre le bas de la mascotte et la liste des forums`,
);
dire(
  "la carte des partenaires passe DERRIÈRE la mascotte",
  cotes.devant.mascotte > cotes.devant.bande && cotes.devant.chevauche > 0,
  JSON.stringify(cotes.devant),
);

await nav.close();
console.log(soucis.length === 0 ? "\nTOUT PASSE." : `\n${soucis.length} DÉFAUT(S).`);
for (const s of soucis) console.log("  · " + s);
if (soucis.length > 0) Deno.exit(1);
