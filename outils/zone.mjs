// ════════════════════════════════════════════════════════════════════
//  outils/zone.mjs — la page d'une zone, dans un vrai navigateur, et À
//  PARTIR DES GABARITS EUX-MÊMES.
//
//  Couvre `src/adaptateurs/navigateur/module-zone.ts` et la section 8-10
//  de `css/04-forum.css`. Maquettes `301:13` et `301:26`, relevé dans
//  `forumactif/77-la-page-d-une-zone-le-releve.md`.
//
//  ── LA RÈGLE GÉNÉRALE QU'IL MESURE ──────────────────────────────────
//
//  **Tout ce que le script ajoute doit pouvoir manquer.** C'est la
//  règle que ce module doit tenir, et c'est celle qui se perd le plus
//  vite : il suffit d'un titre masqué en CSS « parce que le bandeau le
//  réécrit » pour qu'une page sans JavaScript perde son titre.
//
//  Le harnais sert donc CHAQUE page deux fois — avec et sans le script
//  — et exige qu'elle reste lisible dans les deux cas : un titre, un
//  fil d'Ariane, des sujets cliquables dont le texte n'a pas été
//  amputé.
//
//  ── ET LA DEUXIÈME, QUI A COÛTÉ UN DÉFAUT AILLEURS ──────────────────
//
//  **Une pastille est une couleur sur une surface, donc un contraste.**
//  Figma écrit les quatre pastilles en encre sombre ; sur le vert
//  paisible ça tombe à 3,3 pour du 10 px. On mesure ici, dans le
//  navigateur, les quatre tons contre leur fond réel.
// ════════════════════════════════════════════════════════════════════

import { readFileSync } from "node:fs";
import { chromium } from "npm:playwright@1.49.1";

const CHROME = [
  "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
  "/opt/pw-browsers/chromium/chrome-linux64/chrome",
].find((c) => {
  try {
    readFileSync(c);
    return true;
  } catch {
    return false;
  }
});

const R = new URL("..", import.meta.url).pathname;
const PIXEL =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAD0lEQVR4nGP4z8DAxIAEAB0GAwMBHe4bAAAAAElFTkSuQmCC";

// ── résoudre les gabarits ───────────────────────────────────────────

/** Retire un bloc Forumactif AVEC son contenu. */
function sansBloc(s, nom) {
  const re = new RegExp(`<!--\\s*BEGIN ${nom}\\s*-->[\\s\\S]*?<!--\\s*END ${nom}\\s*-->`, "g");
  return s.replace(re, "");
}

/** Garde le contenu d'un bloc et retire ses marqueurs. */
function gardeBloc(s, nom) {
  const re = new RegExp(
    `<!--\\s*BEGIN ${nom}\\s*-->([\\s\\S]*?)<!--\\s*END ${nom}\\s*-->`,
    "g",
  );
  return s.replace(re, "$1");
}

/** Le contenu d'un bloc, seul. */
function fragment(s, nom) {
  const re = new RegExp(`<!--\\s*BEGIN ${nom}\\s*-->([\\s\\S]*?)<!--\\s*END ${nom}\\s*-->`);
  const m = re.exec(s);
  if (m === null) throw new Error(`bloc introuvable : ${nom}`);
  return m[1];
}

/** Retire les commentaires de documentation du gabarit — ceux qui ne
 *  portent aucun marqueur de bloc.
 *
 *  ── LE DÉFAUT QUE ÇA A COÛTÉ, ET IL EST CLASSIQUE ───────────────────
 *
 *  L'en-tête de `viewforum_body.nouveau.html` CITE `{TOPICS_LIST_BOX}`
 *  en expliquant pourquoi on le garde. La première occurrence de la
 *  variable dans le fichier est donc dans un commentaire, et c'est elle
 *  que le remplacement attrapait : la liste des sujets était montée…
 *  à l'intérieur d'un commentaire HTML. Le harnais annonçait « zéro
 *  ligne » sans que rien ne soit faux dans le code mesuré.
 *
 *  Le même piège est écrit dans l'en-tête de `outils/barre.mjs`, pour
 *  une chaîne citée dans un commentaire de CSS. Deux fois le même, à
 *  deux semaines d'écart. */
function sansCommentaires(s) {
  return s.replace(
    /<!--([\s\S]*?)-->/g,
    (tout, dedans) => /\b(BEGIN|END) \w/.test(dedans) ? tout : "",
  );
}

/** Remplace les variables ; ce qui reste rend le vide, comme Forumactif. */
const vars = (s, table) => s.replace(/\{([\w.]+)\}/g, (_, n) => table[n] ?? "");

//  ── LES CINQ SUJETS DE LA MAQUETTE ─────────────────────────────────
//
//  Repris tels quels de `301:13`, étiquettes comprises : c'est le jeu
//  de données qui dit si la découpe des titres marche sur les cas que
//  Callista a dessinés, et pas sur des cas que j'aurais choisis.
const SUJETS = [
  {
    titre: "[LIBRE] La descente par le versant nord",
    auteur: "Calliste Vanne",
    reponses: "12",
    vues: "148",
    dernier: "par Nael",
    quand: "aujourd'hui · 14h20",
    icone: "folder_new.png",
    attendu: { etat: "neuf", pastilles: ["LIBRE"], titre: "La descente par le versant nord" },
  },
  {
    titre: "[PV] Ce qu'on a laissé à la borne douze",
    auteur: "Iseult",
    reponses: "4",
    vues: "61",
    dernier: "par Iseult",
    quand: "aujourd'hui · 09h05",
    icone: "folder_new.png",
    attendu: { etat: "neuf", pastilles: ["PV"], titre: "Ce qu'on a laissé à la borne douze" },
  },
  {
    titre: "[LIBRE] Le feu ne prend pas ici",
    auteur: "Orion",
    reponses: "23",
    vues: "390",
    dernier: "par Maëlis",
    quand: "hier · 22h48",
    icone: "folder.png",
    attendu: { etat: "lu", pastilles: ["LIBRE"], titre: "Le feu ne prend pas ici" },
  },
  {
    titre: "[-16] Première montée, première peur",
    auteur: "Sido",
    reponses: "7",
    vues: "102",
    dernier: "par Tancrède",
    quand: "hier · 18h12",
    icone: "folder.png",
    attendu: { etat: "lu", pastilles: ["-16"], titre: "Première montée, première peur" },
  },
  {
    titre: "[TERMINÉ] La nuit où la crête a fondu",
    auteur: "Ombeline",
    reponses: "41",
    vues: "806",
    dernier: "par Orion",
    quand: "27 sept · 20h30",
    icone: "folder_locked.png",
    attendu: {
      etat: "verrouille",
      pastilles: ["TERMINÉ"],
      titre: "La nuit où la crête a fondu",
    },
  },
];

/** La liste des sujets, montée depuis `templates/topics_list_box.html`.
 *
 *  On n'emploie pas le résolveur générique : le bloc `row` du gabarit
 *  contient à la fois l'en-tête, les lignes et le pied, et Forumactif
 *  le parcourt en servant un bloc intérieur différent à chaque tour.
 *  Le répéter cinq fois donnerait cinq en-têtes. On prend donc les
 *  trois morceaux et on assemble comme le moteur le ferait. */
function listeDesSujets() {
  const brut = sansCommentaires(readFileSync(R + "templates/topics_list_box.html", "utf8"));

  let entete = fragment(brut, "header_table");
  entete = sansBloc(entete, "multi_selection");
  entete = vars(entete, {
    "topics_list_box.row.L_TITLE": "SUJET",
    "topics_list_box.row.L_REPLIES": "RÉPONSES",
    "topics_list_box.row.L_VIEWS": "VUES",
    "topics_list_box.row.L_LASTPOST": "DERNIER MESSAGE",
  });

  let modele = fragment(brut, "topic");
  modele = sansBloc(modele, "table_sticky");
  modele = sansBloc(modele, "multi_selection");
  modele = sansBloc(modele, "single_selection");
  modele = sansBloc(modele, "switch_description");
  modele = sansBloc(modele, "nav_tree");
  modele = sansBloc(modele, "line_sticky");
  modele = gardeBloc(modele, "avatar");

  const lignes = SUJETS.map((s, i) =>
    vars(modele, {
      "topics_list_box.row.ROW_ALT_CLASS": i % 2 === 0 ? "row1" : "row2",
      "topics_list_box.row.TOPIC_FOLDER_IMG": `https://illiweb.com/fa/empty/${s.icone}`,
      "topics_list_box.row.L_TOPIC_FOLDER_ALT": "Pas de nouveaux messages",
      "topics_list_box.row.U_VIEW_TOPIC": `/t${900 + i}-un-sujet`,
      //  LE PRÉFIXE DES SUJETS ÉPINGLÉS. ModernBB le sert dans
      //  `{TOPIC_TYPE}`, en `<strong>` nu AVANT le `<h2>` du titre, et
      //  c'est lui qui mettait le titre à la ligne — relevé sur `/f2`
      //  le 27 octobre. Un seul sujet du décor le porte : s'ils en
      //  avaient tous un, on ne verrait pas le désalignement entre
      //  une ligne préfixée et ses voisines.
      "topics_list_box.row.TOPIC_TYPE": i === 1 ? "<strong>Note:</strong> " : "",
      "topics_list_box.row.TOPIC_TITLE": s.titre,
      "topics_list_box.row.L_BY": "par",
      "topics_list_box.row.TOPIC_AUTHOR": s.auteur,
      "topics_list_box.row.REPLIES": s.reponses,
      "topics_list_box.row.VIEWS": s.vues,
      "topics_list_box.row.topic.avatar.LAST_POST_AVATAR": `<img src="${PIXEL}" alt="" />`,
      //  LE PSEUDO EST UN LIEN, comme sur le forum — et c'est lui, en
      //  `display: block`, qui poussait la flèche à la ligne suivante.
      //  Servi en texte nu, le décor ne pouvait pas le montrer.
      "topics_list_box.row.LAST_POST_AUTHOR":
        `<a href="/u3" class="gensmall"><span class="group-2"><strong>${s.dernier}</strong></span></a>`,
      //  L'ICÔNE « VOIR LE DERNIER MESSAGE ». Forumactif la sert dans
      //  `{LAST_POST_IMG}`, enveloppée d'un lien — et c'est ce lien
      //  qui passait en `display: block` et poussait la flèche sous
      //  le pseudo. Le décor l'ignorait, donc le harnais aussi.
      "topics_list_box.row.LAST_POST_IMG":
        `<a href="/t900-un-sujet#1"><img src="${PIXEL}" alt="Voir le dernier message" /></a>`,
      "topics_list_box.row.LAST_POST_TIME": s.quand,
      L_REPLIES: "Réponses",
      L_VIEWS: "Vues",
      L_LASTPOST: "Dernier message",
    })
  ).join("\n");

  return entete + lignes + fragment(brut, "bottom");
}

/** La page d'une zone, montée depuis `viewforum_body.nouveau.html`.
 *
 *  `forumId` est ce que le gabarit écrit dans `data-wm-forum`. Le fil
 *  d'Ariane, lui, ne nomme QUE le palier : c'est ainsi qu'on vérifie
 *  que le script lit l'attribut et ne devine pas. */
/** Le préambule que Forumactif pose AVANT notre gabarit sur un forum
 *  qui a des sous-forums. Relevé sur `/f18-station-service` le 27
 *  octobre : `div.forabg` (les sous-forums), `ul.linklist.top`, puis un
 *  `div.forumbg` qui répète la liste des sujets.
 *
 *  C'est du HTML de Forumactif, pas du nôtre : pas de classe `wm-`
 *  là-dedans, nos modules n'ont pas encore tourné quand il arrive. */
const PREAMBULE = () =>
  `<div class="forabg">
  <ul class="topiclist"><li class="header"><dl class="icon"><dt>Station Service</dt></dl></li></ul>
  <ul class="topiclist forums">
    <li class="row"><dl class="icon"><dt><h2 class="hierarchy"><a class="forumtitle" href="/f19-arene-feu">Arène Feu</a></h2></dt></dl></li>
    <li class="row"><dl class="icon"><dt><h2 class="hierarchy"><a class="forumtitle" href="/f3-le-marche">Le Marché de Rhode</a></h2></dt></dl></li>
  </ul>
</div>
<ul class="linklist top"><li><a href="/post?f=18&mode=newtopic">Nouveau sujet</a></li></ul>
<!--  UNE LIGNE DE SOUS-FORUM NUE, hors de toute liste. Forumactif en
      pose dans son préambule — relevé sur /f2 le 28 octobre — et c'est
      ce qui restait du « doublon en haut des catégories » une fois les
      blocs rangés. Sans elle ici, le harnais ne peut pas le voir. -->
<dl class="icon"><dd class="dterm"><h2 class="hierarchy"><a class="forumtitle" href="/f48-fonctionnement">Fonctionnement du jeu</a></h2></dd></dl>
${listeDesSujets()}`;

function pageDeZone({ forumId = 34, prefixe = false, sansListe = false } = {}) {
  let t = sansCommentaires(readFileSync(R + "templates/viewforum_body.nouveau.html", "utf8"));
  t = gardeBloc(t, "switch_user_authpost");
  t = gardeBloc(t, "show_plus_menu");
  t = t.replace(/\{TOPICS_LIST_BOX\}/, () => (sansListe ? "" : listeDesSujets()));
  t = vars(t, {
    //  `{BOARD_INDEX}` NE REND RIEN SUR UNE PAGE DE FORUM, et ce n'est
    //  pas une hypothèse : on l'a retiré du gabarit le 27 octobre, on a
    //  publié, et `/f2` doublait exactement pareil. Ce qui double est le
    //  préambule que Forumactif pose AVANT le gabarit — `PREAMBULE()`
    //  ci-dessus le reproduit, et c'est lui qu'il faut ranger.
    BOARD_INDEX: "",
    FORUM_ID: String(forumId),
    U_VIEW_FORUM: `/f${forumId}-une-zone`,
    FORUM_NAME: "Montagnes Embrumées",
    U_INDEX: "/",
    L_INDEX: "Wild Mystery",
    //  ── CE DÉCOR SERVAIT DÉJÀ UN CHEVRON, DONC IL NE TESTAIT RIEN ──
    //
    //  Le forum écrit « WILD MYSTERY :: Zones Sauvages :: Zones Palier
    //  1 :: Steppes Arides » — relevé sur `/f36` le 27 octobre. Les
    //  « :: » sont des NŒUDS DE TEXTE entre les liens, et c'est tout le
    //  problème : aucun sélecteur ne les atteint.
    //
    //  Tant que ce décor posait un `<span>›</span>` tout fait, le test
    //  du fil d'Ariane vérifiait le décor et pas le code. Il sert
    //  maintenant les trois maillons et leurs « :: », comme Forumactif.
    //
    //  SON DERNIER MAILLON NOMME UNE AUTRE ZONE QUE LE GABARIT. Le fil
    //  dit « Steppes Arides », `data-wm-forum` dit 34 — les Montagnes
    //  Embrumées. Un bandeau qui devine dans l'adresse se trahit donc
    //  tout seul : il écrirait le mauvais nom.
    NAV_CAT_DESC:
      ' :: <a class="nav" href="/f95-zones-sauvages"><span>Zones Sauvages</span></a>' +
      ' :: <a class="nav" href="/f96-zones-palier-1"><span>Zones Palier 1</span></a>' +
      ' :: <a class="nav" href="/f36-steppes-arides"><span>Steppes Arides</span></a>',
    U_POST_NEW_TOPIC: "/post?f=34&mode=newtopic",
    L_POST_NEW_TOPIC: "Nouveau sujet",
    PAGINATION: '<span>Page <strong>1</strong> sur 6</span> <a href="/f34p25-">2</a>',
    S_WATCH_FORUM: "",
    U_MARK_READ: "/f34-une-zone?mark=forums",
    L_MARK_TOPICS_READ: "Marquer comme lus",
    LOGGED_IN_USER_LIST: "7 dresseurs et 2 invités : Nael, Iseult, Orion",
    L_MODERATOR: "Modérateurs",
    MODERATORS: "Ines Kervadec, Elijah Smithson",
    L_TABS_PERMISSIONS: "Ce que tu peux faire ici",
    S_AUTH_LIST: "Vous pouvez poster de nouveaux sujets dans ce forum",
    FOLDER_NEW_IMG: PIXEL,
    L_FOLDER_NEW_IMG: "Nouveaux messages",
    FOLDER_IMG: PIXEL,
    L_FOLDER_IMG: "Pas de nouveaux messages",
    FOLDER_LOCKED_IMG: PIXEL,
    L_FOLDER_LOCKED_IMG: "Sujet verrouillé",
    S_JUMPBOX_ACTION: "/",
    L_JUMP_TO: "Aller à",
    S_JUMPBOX_SELECT: '<select name="f"><option value="-1">—</option></select>',
    L_GO: "Ok",
  });
  return prefixe ? PREAMBULE() + "\n" + t : t;
}

//  La bannière du site, celle que le bandeau de zone doit remplacer.
//
//  ── CE DÉCOR ÉTAIT FAUX, ET IL A LAISSÉ PASSER UN BANDEAU INVISIBLE ─
//
//  Il imbriquait `#headerbar-top > .wrap > .headerbar`. Le forum réel
//  fait l'inverse : `.headerbar > #headerbar-top` + `.wrap` — relevé
//  sur `/f36-steppes-arides` le 27 octobre. Avec l'imbrication à
//  l'envers, « insérer après `#headerbar-top` » tombait à côté de la
//  bannière ici, et DEDANS sur le forum, où `wm-zone-posee` la masque.
//  Le bandeau y mesurait 0 × 0 pendant que ce harnais lisait 300.
//
//  Un décor qui ne ressemble pas à la page ne teste que lui-même.
const BANNIERE = `<div class="headerbar">
  <div id="headerbar-top" class="responsive-headerbar w-toolbar"></div>
  <div class="wrap"><a id="logo" href="/"><img src="${PIXEL}" alt="Wild Mystery" /></a></div>
</div>
<!--  LA PUBLICITÉ DE FORUMACTIF, 90 px, mesurée sur /f36 le 27 octobre.
      Elle n'est pas décorative dans ce décor : c'est elle qui sépare le
      bandeau du fil d'Ariane, et sans elle le test « le fil est près du
      bandeau » passerait pour de mauvaises raisons. -->
<div class="fa-pub" style="height:90px"></div>`;

//  CE QUE MODERNBB POSE ET QU'ON SUBIT. Le décor ne charge pas sa
//  feuille entière — on y met ce qui a déjà piégé une mise en page.
//
//  · `dl.icon` et sa taille de fond en `!important` ;
//  · LE CLEARFIX DE `.topic-actions`. Un `::after { content: "" }`,
//    inoffensif tant que la rangée flottait. En flex c'est un enfant :
//    largeur nulle, mais le `gap` s'applique avant lui, et les barres
//    de liens s'arrêtaient douze pixels avant le bord — mesuré sur
//    `/f2` le 28 octobre. Sans cette ligne, le harnais ne peut pas
//    voir le défaut.
//  · `dfn { display: none }`. ModernBB cache ces étiquettes —
//    « Dernier message », « Réponses », « Vues » — et les garde dans le
//    gabarit pour les lecteurs d'écran. Le décor les laissait visibles :
//    le `<dfn>` de la cellule du dernier message prenait 91 px, et le
//    harnais voyait la flèche repoussée à la ligne quelle que soit la
//    feuille. Il accusait notre CSS d'un défaut qui n'était que le sien
//    — mesuré sur `/f2` le 28 octobre, où ce `dfn` vaut bien `none`.
const BASE_MODERNBB = `
/*  BORDER-BOX PARTOUT, comme ModernBB : sa feuille le pose sur
    l'universel, verifie sur le forum le 30 octobre. Sans cette ligne
    le decor mesure en content-box, et toute cote qui additionne une
    largeur et un rembourrage est fausse. */
*, ::before, ::after { box-sizing: border-box; }
dl.icon { background-size: 33px 33px !important; }
.topic-actions::after { content: ""; display: block; clear: both; }
dfn { display: none; }`;

const page = (corps, styleEnPlus = "") =>
  `<!doctype html><html lang="fr"><head><meta charset="utf-8">
<style>${BASE_MODERNBB}</style>
<style>${readFileSync(R + "panneau-admin/jetons.css", "utf8")}</style>
<style>${readFileSync(R + "css/wild-mystery.css", "utf8")}</style>
<style>html,body{margin:0}body{background:var(--wm-fond-page)}</style>
<style>${styleEnPlus}</style>
</head><body id="modernbb">
<div class="conteneur_minwidth_IE modern-resp">
${BANNIERE}
<div id="page-body">${corps}</div>
</div>
</body></html>`;

// ── le navigateur ───────────────────────────────────────────────────

const nav = await chromium.launch(CHROME === undefined ? {} : { executablePath: CHROME });
const soucis = [];

function dire(nom, ok, detail = "") {
  console.log(`  ${ok ? "ok  " : "DÉFAUT"} ${nom}${detail === "" ? "" : " — " + detail}`);
  if (!ok) soucis.push(nom + (detail === "" ? "" : " — " + detail));
}

/** Une page montée. `script: false` sert la même page sans notre
 *  JavaScript — c'est la moitié du harnais. */
async function monter({ corps, script = true, largeur = 1440, styleEnPlus = "" } = {}) {
  const p = await nav.newPage({ viewport: { width: largeur, height: 1000 } });
  p.on("pageerror", (e) => {
    soucis.push("erreur JS : " + e.message);
    console.log("  ERREUR JS :", e.message);
  });
  await p.route("**/*", (r) => {
    const u = new URL(r.request().url());
    const chemin = u.pathname;
    //  LE SWITCHEROO EST SERVI VIDE. Depuis le 31 octobre il se charge
    //  aussi pour une visiteuse déconnectée, donc ces deux scripts
    //  partent sur toutes les pages. Sans route, le serveur du harnais
    //  rendait la page HTML en réponse et le navigateur essayait de
    //  l'exécuter : « Unexpected token < ». Seul `navigation.mjs`
    //  charge le vrai switcheroo, depuis sa source.
    if (/(monomer|switcheroo)\.js$/.test(chemin)) {
      return r.fulfill({ contentType: "text/javascript", body: "" });
    }
    if (chemin === "/js/wild-mystery.js") {
      return r.fulfill({
        contentType: "text/javascript",
        body: readFileSync(R + "js/wild-mystery.js", "utf8"),
      });
    }
    if (chemin.startsWith("/data/")) {
      try {
        return r.fulfill({
          contentType: "application/json",
          body: readFileSync(R + chemin.slice(1), "utf8"),
        });
      } catch {
        return r.fulfill({ status: 404, body: "" });
      }
    }
    //  Les photos de zone sont servies depuis GitHub Pages : on rend un
    //  pixel plutôt que d'aller sur le réseau.
    if (/\.(jpg|png)$/.test(chemin)) {
      return r.fulfill({
        contentType: "image/png",
        body: Buffer.from(PIXEL.split(",")[1], "base64"),
      });
    }
    return r.fulfill({
      contentType: "text/html; charset=utf-8",
      body: page(corps, styleEnPlus),
    });
  });
  await p.goto("http://wild-mystery.test/f34-montagnes-embrumees");
  if (script) {
    await p.addScriptTag({ url: "http://wild-mystery.test/js/wild-mystery.js" });
    await p.waitForTimeout(500);
  }
  return p;
}

/** Le contraste d'un élément contre son propre fond. Même méthode que
 *  `outils/contraste.mjs` : on lit les couleurs calculées. */
const CONTRASTE = (sel) =>
  `(() => {
  const e = document.querySelector(${JSON.stringify(sel)});
  if (e === null) return null;
  const lire = (c) => {
    const n = c.match(/[\\d.]+/g).map(Number);
    const v = n.slice(0, 3).map((x) => {
      const s = x / 255;
      return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2];
  };
  const s = getComputedStyle(e);
  const a = lire(s.color), b = lire(s.backgroundColor);
  const [h, l] = a > b ? [a, b] : [b, a];
  return Math.round(((h + 0.05) / (l + 0.05)) * 100) / 100;
})()`;

// ════════════════════════════════════════════════════════════════════
//  1 · LE BANDEAU
// ════════════════════════════════════════════════════════════════════

console.log("\n── le bandeau de la zone ──");

const zones = JSON.parse(readFileSync(R + "data/zones.json", "utf8")).zones;
const LA_ZONE = zones.find((z) => z.forumId === 34);

const p1 = await monter({ corps: pageDeZone() });

//  LE DÉCOR D'ABORD. Un harnais qui dit « le bandeau manque » sans dire
//  si la page avait seulement une liste de sujets fait chercher au
//  mauvais endroit.
const decor = await p1.evaluate(() => ({
  lignes: document.querySelectorAll("ul.topics li.row").length,
  forum: document.querySelector("[data-wm-forum]")?.getAttribute("data-wm-forum") ?? null,
  script: typeof globalThis.WM_CHARGE,
}));
dire("le décor porte les cinq lignes", decor.lignes === 5, JSON.stringify(decor));
dire("et le gabarit dit son forum", decor.forum === "34", JSON.stringify(decor));

const bandeau = await p1.evaluate(() => {
  const b = document.querySelector(".wm-zone");
  if (b === null) return null;
  const r = b.getBoundingClientRect();
  const titre = b.querySelector(".wm-zone__titre");
  const st = getComputedStyle(titre);
  return {
    hauteur: Math.round(r.height),
    largeur: Math.round(r.width),
    forum: b.dataset.wmZone,
    photo: b.querySelector(".wm-zone__photo")?.getAttribute("src") ?? null,
    surtitre: b.querySelector(".wm-zone__surtitre")?.textContent ?? null,
    titre: titre?.textContent ?? null,
    titreTaille: st.fontSize,
    titrePolice: st.fontFamily,
    phrase: b.querySelector(".wm-zone__phrase")?.textContent ?? null,
    voile: b.querySelector(".wm-zone__voile") !== null,
    fondu: b.querySelector(".wm-zone__fondu") !== null,
    classe: document.querySelector("#modernbb").classList.contains("wm-zone-posee"),
    banniere: getComputedStyle(document.querySelector(".headerbar")).display,
    titrePage: getComputedStyle(document.querySelector("h1.page-title")).display,
    ariane: document.querySelector(".sub-header-path")?.textContent?.trim() ?? "",
    //  LA MESURE QUI MANQUAIT. Une hauteur de 300 se lit même sur un
    //  élément dont un ancêtre est en `display: none` — c'est le style
    //  calculé, pas ce qu'on voit. `offsetParent` rend `null` dans ce
    //  cas-là, et `closest` dit si on s'est enterré dans la bannière
    //  qu'on vient justement de masquer.
    affiche: b.offsetParent !== null,
    dansLaBanniere: b.closest(".headerbar") !== null,
    boite: Math.round(b.getBoundingClientRect().height),
  };
});

dire("le bandeau est posé", bandeau !== null);
if (bandeau !== null) {
  dire(
    "IL EST VRAIMENT À L'ÉCRAN, pas seulement dans le document",
    bandeau.affiche && bandeau.boite === 460,
    `offsetParent ${bandeau.affiche ? "existe" : "est null"} · boîte ${bandeau.boite} px`,
  );
  dire(
    "et il n'est pas enterré dans la bannière qu'on masque",
    !bandeau.dansLaBanniere,
    bandeau.dansLaBanniere ? "il est DANS .headerbar" : "il est à côté de .headerbar",
  );
  //  460 depuis le 27 octobre, en deux fois : le fondu est passé à 170 px
  //  et mangeait plus de la moitié d un bandeau de 300.
  dire("il fait 460 px de haut", bandeau.hauteur === 460, `${bandeau.hauteur} px`);
  dire("il prend toute la largeur", bandeau.largeur === 1440, `${bandeau.largeur} px`);
  dire(
    "IL A LU data-wm-forum, PAS LE FIL D'ARIANE",
    bandeau.forum === "34" && bandeau.titre === LA_ZONE.nom &&
      bandeau.ariane.includes("Steppes"),
    `zone ${bandeau.forum} · ariane « ${bandeau.ariane} »`,
  );
  dire("la photo est celle de la zone", bandeau.photo === LA_ZONE.image, `${bandeau.photo}`);
  dire(
    "le surtitre dit le palier et les niveaux",
    bandeau.surtitre === "PALIER 1 · NIVEAUX 1 À 20",
    `« ${bandeau.surtitre} »`,
  );
  dire("le titre est le nom de la zone", bandeau.titre === LA_ZONE.nom, `« ${bandeau.titre} »`);
  dire(
    "il est en Fraunces 40",
    bandeau.titreTaille === "40px" &&
      bandeau.titrePolice.includes("Fraunces"),
    `${bandeau.titreTaille} ${bandeau.titrePolice}`,
  );
  dire(
    "la phrase est celle de la carte",
    bandeau.phrase === LA_ZONE.description,
    `« ${bandeau.phrase} »`,
  );
  dire("le voile et le fondu sont là", bandeau.voile && bandeau.fondu);
  dire(
    "LA BANNIÈRE DU SITE A LAISSÉ LA PLACE",
    bandeau.banniere === "none",
    `.headerbar : ${bandeau.banniere}`,
  );
  dire(
    "et le titre n'est pas écrit deux fois",
    bandeau.titrePage === "none",
    `h1.page-title : ${bandeau.titrePage}`,
  );
  dire(
    "le fil d'Ariane reste visible",
    bandeau.ariane.includes("Wild Mystery"),
    bandeau.ariane,
  );
  dire("la classe de page est posée", bandeau.classe === true);
}

const lisible = await p1.evaluate(() => {
  const t = document.querySelector(".wm-zone__titre");
  if (t === null) return { dans: false, gauche: -1 };
  const r = t.getBoundingClientRect();
  const b = document.querySelector(".wm-zone").getBoundingClientRect();
  return { dans: r.top >= b.top && r.bottom <= b.bottom, gauche: Math.round(r.left) };
});
dire("le titre tient dans le bandeau", lisible.dans, JSON.stringify(lisible));
dire(
  "il est à 92 px du bord, comme la maquette",
  lisible.gauche === 92,
  `${lisible.gauche} px`,
);

// ════════════════════════════════════════════════════════════════════
//  2 · LES LIGNES DE SUJET
// ════════════════════════════════════════════════════════════════════

console.log("\n── les lignes de sujet ──");

const lignes = await p1.evaluate(() =>
  Array.from(document.querySelectorAll("ul.topics li.row")).map((li) => {
    const a = li.querySelector("a.topictitle");
    const icone = li.querySelector("dl.icon");
    const avant = getComputedStyle(icone, "::before");
    return {
      etat: li.dataset.wmEtat ?? null,
      titre: a?.textContent?.trim() ?? "",
      href: a?.getAttribute("href") ?? "",
      pastilles: Array.from(li.querySelectorAll(".wm-sujet")).map((p) => ({
        texte: p.textContent,
        classe: p.className,
      })),
      fond: getComputedStyle(icone).backgroundImage,
      rond: {
        contenu: avant.content,
        largeur: avant.width,
        rayon: avant.borderRadius,
      },
    };
  })
);

dire("les cinq lignes sont traitées", lignes.length === 5, `${lignes.length}`);
for (const [i, attendu] of SUJETS.map((s) => s.attendu).entries()) {
  const l = lignes[i];
  if (l === undefined) continue;
  dire(`ligne ${i + 1} · l'état est « ${attendu.etat} »`, l.etat === attendu.etat, `${l.etat}`);
  dire(
    `ligne ${i + 1} · le titre est débarrassé de son étiquette`,
    l.titre === attendu.titre,
    `« ${l.titre} »`,
  );
  dire(
    `ligne ${i + 1} · la pastille dit « ${attendu.pastilles[0]} »`,
    l.pastilles.length === attendu.pastilles.length &&
      l.pastilles.every((p, k) => p.texte === attendu.pastilles[k]),
    JSON.stringify(l.pastilles.map((p) => p.texte)),
  );
  dire(
    `ligne ${i + 1} · le lien du sujet n'a pas bougé`,
    l.href === `/t${900 + i}-un-sujet`,
    l.href,
  );
}

dire(
  "L'ICÔNE DE DOSSIER A LAISSÉ LA PLACE AU ROND",
  lignes.every((l) => l.fond === "none"),
  lignes.map((l) => l.fond).join(" · "),
);
dire(
  "les ronds font 34 px et sont ronds",
  lignes.every((l) => l.rond.largeur === "34px" && l.rond.rayon === "999px"),
  JSON.stringify(lignes[0]?.rond),
);
dire(
  "les trois glyphes sont ceux de la légende",
  lignes[0].rond.contenu.includes("●") && lignes[2].rond.contenu.includes("○") &&
    lignes[4].rond.contenu.includes("✕"),
  lignes.map((l) => l.rond.contenu).join(" "),
);

const tons = await p1.evaluate(() =>
  Array.from(document.querySelectorAll(".wm-sujet")).map((p) => p.className)
);
dire(
  "CHAQUE ÉTIQUETTE PREND LE COMPOSANT DE LA CHARTE",
  JSON.stringify(tons) === JSON.stringify([
    "wm-sujet",
    "wm-sujet wm-sujet--pv",
    "wm-sujet",
    "wm-sujet wm-sujet--16",
    "wm-sujet wm-sujet--termine",
  ]),
  tons.join(" · "),
);

// ── le contraste des quatre pastilles ───────────────────────────────

for (const ton of ["", "--pv", "--16", "--termine"]) {
  const r = await p1.evaluate(CONTRASTE(`.wm-sujet${ton}`));
  dire(`la pastille « .wm-sujet${ton} » se lit (≥ 4,5)`, r !== null && r >= 4.5, `${r}`);
}

// ── l'idempotence ───────────────────────────────────────────────────

const deuxFois = await p1.evaluate(() => {
  const avant = document.querySelectorAll(".wm-sujet").length;
  //  On rappelle le module comme le ferait un second chargement.
  document.dispatchEvent(new Event("DOMContentLoaded"));
  return { avant, apres: document.querySelectorAll(".wm-sujet").length };
});
dire(
  "rappelé, le module ne double pas les pastilles",
  deuxFois.avant === deuxFois.apres,
  JSON.stringify(deuxFois),
);

// ════════════════════════════════════════════════════════════════════
//  3 · CE QUE LE GABARIT DOIT PORTER
// ════════════════════════════════════════════════════════════════════

console.log("\n── le gabarit ──");

const gabarit = await p1.evaluate(() => ({
  raccourcis: Array.from(document.querySelectorAll(".wm-forum__raccourcis a")).map((a) => ({
    texte: a.textContent.trim(),
    href: a.getAttribute("href"),
  })),
  nouveau: document.querySelector(".wm-forum__nouveau")?.textContent?.trim() ?? null,
  section: document.querySelector(".wm-forum__bande-titre")?.textContent ?? null,
  rang: document.querySelector(".wm-forum__rang")?.textContent ?? null,
  filets: document.querySelectorAll(".wm-forum__filet").length,
  legende: document.querySelectorAll("#picture_legend").length,
  blocs: Array.from(document.querySelectorAll("#info_open .block .h3")).map((b) =>
    b.textContent.trim()
  ),
  pagination: document.querySelector(".pagination")?.textContent?.trim() ?? "",
}));

dire(
  "les quatre raccourcis sont des liens natifs",
  gabarit.raccourcis.length === 4 &&
    gabarit.raccourcis.every((r) => /^\/search\?search_id=\w+$/.test(r.href)),
  gabarit.raccourcis.map((r) => r.href).join(" · "),
);
dire("« Nouveau sujet » est là", gabarit.nouveau === "Nouveau sujet", `${gabarit.nouveau}`);
dire(
  "LA BANDE PORTE SON TITRE, ET PLUS DE RANG NI DE FILETS",
  //  « Enlève le 01, et fais en sorte que "les sujets" s'affiche de la
  //  même manière que "notice d'utilisation" », 27 octobre. Les trois
  //  nœuds sont partis du gabarit, pas masqués en CSS.
  gabarit.section === "LES SUJETS" && gabarit.rang === null &&
    gabarit.filets === 0,
  `titre « ${gabarit.section} » · rang ${gabarit.rang} · ${gabarit.filets} filet(s)`,
);
dire(
  "LA LÉGENDE N'EST PLUS SERVIE DU TOUT",
  //  « On l'enlève, je veux pas l'afficher », 27 octobre. Elle part du
  //  GABARIT, pas d'un `display: none` : on ne cache pas ce qu'on peut
  //  ne pas écrire, et un bloc masqué finit toujours par revenir.
  gabarit.legende === 0,
  `${gabarit.legende} bloc(s) de légende`,
);
dire("les trois blocs du bas sont là", gabarit.blocs.length === 3, gabarit.blocs.join(" · "));
dire("la pagination est servie", gabarit.pagination.includes("Page"), gabarit.pagination);

// ════════════════════════════════════════════════════════════════════
//  3 bis · LES SEPT REMARQUES DU 27 OCTOBRE
// ════════════════════════════════════════════════════════════════════

console.log("\n── le relevé du 27 octobre ──");

const releve = await p1.evaluate(() => {
  const r = (s) => {
    const e = document.querySelector(s);
    if (e === null) return null;
    const b = e.getBoundingClientRect();
    return {
      x: Math.round(b.x),
      y: Math.round(b.y),
      l: Math.round(b.width),
      h: Math.round(b.height),
    };
  };
  const vues = document.querySelector("ul.topics li.row dd.views");
  const reponses = document.querySelector("ul.topics li.row dd.posts");
  const titre = document.querySelector("ul.topics li.row dd.dterm");
  const bas = document.querySelector(".wm-forum__bas");
  const blocs = [...document.querySelectorAll(".wm-forum__bas .block")];
  const fil = document.querySelector(".sub-header-path");
  return {
    fondu: r(".wm-zone__fondu"),
    //  Le fondu part de la couleur de la page à zéro d'opacité, jamais
    //  de `transparent` : la bande sale au milieu venait de là.
    fonduDepart: getComputedStyle(document.querySelector(".wm-zone__fondu")).backgroundImage
      .slice(0, 160),
    entete: document.querySelector(".wm-forum ul.topics li.header") === null
      ? "absente"
      : getComputedStyle(document.querySelector(".wm-forum ul.topics li.header")).display,
    vues: vues === null ? null : r("ul.topics li.row dd.views"),
    reponses: reponses === null ? null : r("ul.topics li.row dd.posts"),
    titre: titre === null ? null : r("ul.topics li.row dd.dterm"),
    filTexte: fil?.textContent.replace(/\s+/g, " ").trim() ?? "",
    filSeparateurs: document.querySelectorAll(".wm-ariane__separateur").length,
    filMaillons: document.querySelectorAll(".sub-header-path a.nav").length,
    filY: r(".sub-header")?.y ?? null,
    bandeauBas: (() => {
      const b = document.querySelector(".wm-zone");
      return b === null ? null : Math.round(b.getBoundingClientRect().bottom);
    })(),
    raccourcisFond: getComputedStyle(document.querySelector(".wm-forum__raccourcis"))
      .backgroundColor,
    basAffichage: bas === null ? null : getComputedStyle(bas).display,
    blocsY: blocs.map((b) => Math.round(b.getBoundingClientRect().y)),
    bordureTitre: blocs.length === 0
      ? null
      : getComputedStyle(blocs[0].querySelector(".h3")).borderBottomWidth,
    legende: document.querySelectorAll("#picture_legend").length,
  };
});

dire(
  "LE FONDU EST PLUS LONG ET NE PART PAS DE `transparent`",
  releve.fondu?.h === 170 && !releve.fonduDepart.includes("rgba(0, 0, 0, 0)"),
  `${releve.fondu?.h} px · ${releve.fonduDepart.slice(0, 60)}…`,
);
dire(
  "L'EN-TÊTE DE COLONNES EN DOUBLE NE S'AFFICHE PLUS",
  releve.entete === "none" || releve.entete === "absente",
  `li.header : ${releve.entete}`,
);
dire(
  "LES VUES SONT AU-DESSUS DES RÉPONSES, DANS LA MÊME COLONNE",
  releve.vues !== null && releve.reponses !== null &&
    releve.vues.x === releve.reponses.x && releve.vues.y < releve.reponses.y,
  `vues (${releve.vues?.x}, ${releve.vues?.y}) · réponses (${releve.reponses?.x}, ${releve.reponses?.y})`,
);
dire(
  "et elles sont à DROITE du titre, plus à sa gauche",
  releve.vues !== null && releve.titre !== null && releve.vues.x > releve.titre.x,
  `titre à ${releve.titre?.x}, vues à ${releve.vues?.x}`,
);
dire(
  "LE FIL D'ARIANE N'A PLUS DE « :: »",
  !releve.filTexte.includes("::") && releve.filSeparateurs === releve.filMaillons - 1,
  `« ${releve.filTexte} » · ${releve.filSeparateurs} séparateur(s) pour ${releve.filMaillons} maillons`,
);
//  Le rapprochement du fil est vérifié plus bas, au second relevé : il
//  n'est plus « sous » le bandeau, il est DEDANS.
dire(
  "LES RACCOURCIS ONT UNE BARRE, ILS NE FLOTTENT PLUS",
  releve.raccourcisFond !== "rgba(0, 0, 0, 0)",
  releve.raccourcisFond,
);
dire(
  "LES TROIS BLOCS DU BAS SONT CÔTE À CÔTE",
  releve.basAffichage === "flex" && releve.blocsY.length === 3 &&
    new Set(releve.blocsY).size === 1,
  `${releve.basAffichage} · y = ${releve.blocsY.join(" / ")}`,
);
dire(
  "et le gros trait bleu de ModernBB est parti",
  releve.bordureTitre === "0px",
  `bordure du titre : ${releve.bordureTitre}`,
);
dire("LA LÉGENDE N'EST PLUS DANS LA PAGE", releve.legende === 0, `${releve.legende} bloc(s)`);

console.log("\n── le second relevé du 27 octobre ──");

const deux = await p1.evaluate(() => {
  const r = (s) => {
    const e = document.querySelector(s);
    if (e === null) return null;
    const b = e.getBoundingClientRect();
    return { x: Math.round(b.x), y: Math.round(b.y), h: Math.round(b.height) };
  };
  const lignes = [...document.querySelectorAll(".wm-forum ul.topics li.row")];
  const derniere = lignes.at(-1);
  //  LA PASTILLE DE LA PREMIÈRE LIGNE, prise DANS cette ligne : un
  //  `querySelector` sur le document entier attrape la première du
  //  document, qui n'est pas forcément dans la ligne qu'on mesure.
  const premiere = lignes[0];
  const pastille = premiere?.querySelector(".wm-pastille") ?? null;
  const titre = premiere?.querySelector(".topic-title") ?? null;
  const raccourci = document.querySelector(".wm-forum__raccourcis a");
  const basBoutons = document.querySelector(".topic-actions.bottom .topic-actions-buttons");
  return {
    filDansLeBandeau: document.querySelector(".wm-zone__legende .sub-header-path") !== null,
    filY: r(".sub-header-path")?.y ?? null,
    surtitreY: r(".wm-zone__surtitre")?.y ?? null,
    titreY: r(".wm-zone__titre")?.y ?? null,
    pub: r(".fa-pub")?.h ?? null,
    coquilleVide: r(".sub-header")?.h ?? null,
    raccourciH: raccourci === null
      ? null
      : Math.round(raccourci.getBoundingClientRect().height),
    barreH: r(".wm-forum__raccourcis")?.h ?? null,
    basEnBarre: basBoutons === null ? null : getComputedStyle(basBoutons).backgroundColor,
    basBoutonH: basBoutons === null
      ? null
      : Math.round(basBoutons.querySelector("a").getBoundingClientRect().height),
    anglesLignes: lignes.map((l) => getComputedStyle(l).borderRadius),
    angleDerniere: derniere === undefined ? null : getComputedStyle(derniere).borderRadius,
    blocDecoupe: (() => {
      const b = document.querySelector(".wm-forum__section .forumbg");
      if (b === null) return false;
      const c = getComputedStyle(b);
      return c.overflow === "hidden" && c.borderRadius !== "0px";
    })(),
    pastilleY: pastille === null ? null : Math.round(pastille.getBoundingClientRect().y),
    titreSujetY: titre === null ? null : Math.round(titre.getBoundingClientRect().y),
    ligneY: lignes.length === 0 ? null : Math.round(lignes[0].getBoundingClientRect().y),
    ligneH: lignes.length === 0 ? null : Math.round(lignes[0].getBoundingClientRect().height),
    //  LE ROND D'ÉTAT EST UN `::before` EN ABSOLU, pas la pastille :
    //  celle-ci est masquée dès qu'une ligne porte son état (§ 7 de
    //  cette feuille). On ne peut pas mesurer un pseudo-élément, alors
    //  on calcule son centre depuis `top` et `height`.
    rond: (() => {
      const dl = premiere?.querySelector("dl.icon");
      if (dl === undefined || dl === null) return null;
      //  `top: 50%` + `translateY(-50%)` : le centre du rond est à la
      //  moitié de la hauteur de la cellule, quel que soit son contenu.
      const b = dl.getBoundingClientRect();
      return {
        centre: Math.round(b.y + b.height / 2),
        top: getComputedStyle(dl, "::before").top,
      };
    })(),
    hauteurs: (() => {
      const l = document.querySelector(".wm-forum ul.topics li.row");
      if (l === null) return null;
      const h = (s) => {
        const e = l.querySelector(s);
        return e === null ? null : Math.round(e.getBoundingClientRect().height);
      };
      return {
        ligne: Math.round(l.getBoundingClientRect().height),
        dl: h("dl.icon"),
        dterm: h("dd.dterm"),
        lastpost: h("dd.lastpost"),
        avatar: h(".lastpost-avatar"),
        infos: h(".lastpost-infos"),
        rangees: getComputedStyle(l.querySelector("dl.icon")).gridTemplateRows,
        padDl: getComputedStyle(l.querySelector("dl.icon")).padding,
        padDterm: getComputedStyle(l.querySelector("dd.dterm")).padding,
        dtermEnfants: [...l.querySelector("dd.dterm").children].map((c) =>
          c.tagName + ":" + Math.round(c.getBoundingClientRect().height)
        ),
        lastpostDisplay: getComputedStyle(l.querySelector("dd.lastpost")).display,
      };
    })(),
    note: (() => {
      const fort = document.querySelector(
        ".wm-forum ul.topics li.row .topic-title-container > strong",
      );
      if (fort === null) return null;
      const titre = fort.parentElement.querySelector(".topic-title");
      const a = fort.getBoundingClientRect();
      const b = titre.getBoundingClientRect();
      return {
        texte: fort.textContent.trim(),
        prefixeX: Math.round(a.x),
        prefixeY: Math.round(a.y),
        titreX: Math.round(b.x),
        titreY: Math.round(b.y),
      };
    })(),
    pseudoEtFleche: (() => {
      const l = document.querySelector(".wm-forum ul.topics li.row");
      const infos = l?.querySelector(".lastpost-infos");
      const nom = infos?.querySelector("a.gensmall") ?? null;
      const fleche = infos?.querySelector("a[href] img")?.closest("a") ?? null;
      if (infos === undefined || infos === null || nom === null || fleche === null) return null;
      return {
        nomY: Math.round(nom.getBoundingClientRect().y),
        nomLargeur: Math.round(nom.getBoundingClientRect().width),
        flecheY: Math.round(fleche.getBoundingClientRect().y),
        celluleLargeur: Math.round(infos.getBoundingClientRect().width),
        nomFin: Math.round(nom.getBoundingClientRect().right),
        nomBas: Math.round(nom.getBoundingClientRect().bottom),
        flecheX: Math.round(fleche.getBoundingClientRect().x),
        enfants: [...infos.childNodes].map((n) =>
          n.nodeType === 3
            ? "texte:" + JSON.stringify(n.textContent.slice(0, 12))
            : n.tagName + "." + getComputedStyle(n).display + " y=" +
              Math.round(n.getBoundingClientRect().y) + " l=" +
              Math.round(n.getBoundingClientRect().width)
        ),
      };
    })(),
    flecheDernier: (() => {
      const l = document.querySelector(".wm-forum ul.topics li.row");
      const infos = l?.querySelector(".lastpost-infos");
      const a = infos?.querySelector("a[href] img")?.closest("a") ?? null;
      if (a === null) return null;
      const r = a.getBoundingClientRect();
      return {
        display: getComputedStyle(a).display,
        largeur: Math.round(r.width),
        largeurInfos: Math.round(infos.getBoundingClientRect().width),
      };
    })(),
    ecarts: (() => {
      const l = document.querySelector(".wm-forum ul.topics li.row");
      const dl = l?.querySelector("dl.icon");
      const t = l?.querySelector(".topic-title");
      if (dl === undefined || dl === null || t === undefined || t === null) return null;
      const c = getComputedStyle(dl, "::before");
      const g = Math.round(dl.getBoundingClientRect().x);
      const gauche = parseFloat(c.left);
      const large = parseFloat(c.width);
      return {
        bord: Math.round(gauche),
        contenu: Math.round(
          l.querySelector("dd.dterm").getBoundingClientRect().x - g - gauche - large,
        ),
        colonnes: getComputedStyle(dl).gridTemplateColumns,
        pad: getComputedStyle(dl).paddingLeft,
        dlX: g,
        dtermX: Math.round(l.querySelector("dd.dterm").getBoundingClientRect().x),
        contX: Math.round(l.querySelector(".topic-title-container").getBoundingClientRect().x),
        titreX: Math.round(t.getBoundingClientRect().x),
        contenuDuConteneur: [...l.querySelector(".topic-title-container").childNodes].map((n) =>
          n.nodeType === 3
            ? "texte:" + JSON.stringify(n.textContent.slice(0, 12))
            : n.tagName + "." + String(n.className) + ":" +
              Math.round(n.getBoundingClientRect().width)
        ),
        dtermStyle: (() => {
          const c = getComputedStyle(l.querySelector("dd.dterm"));
          return c.marginLeft + "/" + c.paddingLeft + "/" + c.gridColumnStart;
        })(),
      };
    })(),
    //  LES TROIS BORDS DROITS. « Les liens nouveaux messages en haut et
    //  surveiller les sujets en bas ne sont pas bien alignés à droite
    //  avec les catégories », 28 octobre. On mesure le bord droit de
    //  chacun : ils doivent tomber sur le même pixel.
    bordsDroits: (() => {
      const d = (s) => {
        const e = document.querySelector(s);
        return e === null ? null : Math.round(e.getBoundingClientRect().right);
      };
      return {
        raccourcis: d(".wm-forum__raccourcis"),
        bloc: d(".wm-forum__section .forumbg"),
        bas: d(".topic-actions.bottom .topic-actions-buttons"),
        bande: d(".wm-forum__bande"),
      };
    })(),
    titresX: [...document.querySelectorAll(".wm-forum ul.topics li.row .topic-title")]
      .map((t) => Math.round(t.getBoundingClientRect().x)),
    boutonH: (() => {
      const a = document.querySelector(".wm-forum__nouveau");
      return a === null ? null : Math.round(a.getBoundingClientRect().height);
    })(),
    retour: (() => {
      const a = document.querySelector(".wm-zone__retour");
      if (a === null) return null;
      const b = a.getBoundingClientRect();
      return {
        x: Math.round(b.x),
        y: Math.round(b.y),
        href: a.getAttribute("href"),
        label: a.getAttribute("aria-label"),
        dansLeBandeau: document.querySelector(".wm-zone")?.contains(a) === true,
      };
    })(),
    legendeX: (() => {
      const l = document.querySelector(".wm-zone__legende");
      return l === null ? null : Math.round(l.getBoundingClientRect().x);
    })(),
    nouveau: (() => {
      const a = document.querySelector(".wm-forum__nouveau");
      if (a === null) return null;
      return {
        fond: getComputedStyle(a).backgroundColor,
        icone: getComputedStyle(a, "::before").content,
      };
    })(),
    blocAngles: (() => {
      const b = document.querySelector(".wm-forum__section .forumbg");
      return b === null ? null : getComputedStyle(b).borderRadius;
    })(),
    //  LE CENTRE DE L'IDENTITÉ, pas celui du titre : depuis que les
    //  étiquettes sont passées au-dessus, le titre n'est plus au milieu
    //  de sa cellule, et c'est la cellule que le rond doit regarder.
    centreTitre: (() => {
      const d = document.querySelector(".wm-forum ul.topics li.row dd.dterm");
      if (d === null) return null;
      const b = d.getBoundingClientRect();
      return Math.round(b.y + b.height / 2);
    })(),
  };
});

dire(
  "LA PUB DE FORUMACTIF EST BIEN DANS LE DÉCOR, 90 px",
  deux.pub === 90,
  `${deux.pub} px — sans elle, le test du fil ne prouverait rien`,
);
dire(
  "LE FIL D'ARIANE EST MONTÉ DANS LE BANDEAU",
  deux.filDansLeBandeau === true,
);
dire(
  "et il est la première ligne de la légende, juste au-dessus du palier",
  deux.filY !== null && deux.surtitreY !== null && deux.titreY !== null &&
    deux.filY < deux.surtitreY && deux.surtitreY < deux.titreY &&
    deux.surtitreY - deux.filY <= 40,
  `fil ${deux.filY} · palier ${deux.surtitreY} · titre ${deux.titreY}`,
);
dire(
  "la coquille qu'il laisse ne garde pas de place",
  deux.coquilleVide === 0,
  `.sub-header : ${deux.coquilleVide} px`,
);
dire(
  "LES LIGNES DE SUJET SONT PLUS BASSES",
  deux.ligneH !== null && deux.ligneH <= 100,
  JSON.stringify(deux.hauteurs),
);
dire(
  "LE PRÉFIXE « NOTE: » EST SUR LA LIGNE DU TITRE",
  //  « Note doit être aligné avec le titre du sujet comme avant »,
  //  28 octobre : même ligne, le préfixe à gauche.
  deux.note !== null && Math.abs(deux.note.prefixeY - deux.note.titreY) <= 6 &&
    deux.note.prefixeX < deux.note.titreX,
  JSON.stringify(deux.note),
);
dire(
  "LA FLÈCHE DE RETOUR EST DANS LE BANDEAU, ALIGNÉE AU TEXTE",
  deux.retour !== null && deux.retour.dansLeBandeau &&
    deux.retour.x === deux.legendeX,
  `flèche à x=${deux.retour?.x}, légende à x=${deux.legendeX}`,
);
dire(
  "et elle remonte d'un cran, pas à l'accueil ni dans l'historique",
  deux.retour?.href?.endsWith("/f96-zones-palier-1") === true,
  `${deux.retour?.href} · « ${deux.retour?.label} »`,
);
dire(
  "LE BOUTON « NOUVEAU SUJET » EST EN COULEUR D'ACCENT, AVEC SON SIGNE",
  deux.nouveau !== null && deux.nouveau.fond !== "rgba(0, 0, 0, 0)" &&
    deux.nouveau.icone === '"✚"',
  `${deux.nouveau?.fond} · ${deux.nouveau?.icone}`,
);
dire(
  "LE BLOC DES SUJETS NE S'ARRONDIT QU'EN BAS, IL COLLE À LA BANDE",
  deux.blocAngles === "0px 0px 10px 10px",
  deux.blocAngles,
);
dire(
  "LE PSEUDO ET LA FLÈCHE SONT SUR LA MÊME LIGNE",
  //  Le lien du pseudo était en `display: block` et prenait les 162 px
  //  de la cellule : la flèche tombait vingt pixels plus bas, quelle
  //  que soit sa propre mise en forme. Mesuré sur `/f2` le 28 octobre.
  deux.pseudoEtFleche !== null &&
    //  À DROITE DU PSEUDO, et sur la même ligne que lui. On ne compare
    //  pas les ordonnées : une icône de deux pixels alignée au milieu de
    //  la ligne n'a pas le même haut qu'un texte de quatorze. Le bon
    //  critère est que les deux boîtes se recouvrent verticalement.
    deux.pseudoEtFleche.flecheX >= deux.pseudoEtFleche.nomFin &&
    deux.pseudoEtFleche.flecheY < deux.pseudoEtFleche.nomBas &&
    deux.pseudoEtFleche.nomLargeur < deux.pseudoEtFleche.celluleLargeur,
  JSON.stringify(deux.pseudoEtFleche),
);
dire(
  "LA FLÈCHE DU DERNIER MESSAGE RESTE À CÔTÉ DU NOM",
  //  UN LIEN EN BLOC PREND TOUTE LA LARGEUR, et c'est ce qui poussait
  //  la flèche sous le pseudo : 394 px pour une icône de 12, mesuré
  //  sur le forum le 27 octobre. En ligne, il ne fait que son image.
  deux.flecheDernier !== null &&
    deux.flecheDernier.display.startsWith("inline") &&
    deux.flecheDernier.largeur < deux.flecheDernier.largeurInfos / 2,
  JSON.stringify(deux.flecheDernier),
);
dire(
  "LE ROND EST ENTRE LE BORD ET LE TITRE, SANS COLLER NI L'UN NI L'AUTRE",
  //  Jusqu'au DÉBUT DU CONTENU, pas jusqu'au titre : entre les deux
  //  il y a l'étiquette « LIBRE », qui est voulue par la maquette.
  deux.ecarts !== null && deux.ecarts.bord >= 12 && deux.ecarts.contenu <= 30,
  `${deux.ecarts?.bord} px du bord, ${deux.ecarts?.contenu} px du contenu`,
);
dire(
  "LES TROIS BARRES TOMBENT SUR LE MÊME BORD DROIT QUE LA LISTE",
  (() => {
    const b = deux.bordsDroits;
    return b.bloc !== null && b.raccourcis !== null && b.bas !== null &&
      Math.abs(b.raccourcis - b.bloc) <= 1 && Math.abs(b.bas - b.bloc) <= 1 &&
      Math.abs(b.bande - b.bloc) <= 1;
  })(),
  JSON.stringify(deux.bordsDroits),
);
dire(
  "LE BOUTON ET LA BARRE DES RACCOURCIS FONT LA MÊME HAUTEUR",
  //  « Les nouveaux messages etc. doivent avoir la même hauteur que
  //  poster un nouveau sujet », 27 octobre. Deux pixels d'écart se
  //  voient quand les deux objets sont sur la même ligne.
  deux.boutonH !== null && deux.barreH !== null &&
    Math.abs(deux.boutonH - deux.barreH) <= 1,
  `bouton ${deux.boutonH} px · barre ${deux.barreH} px`,
);
dire(
  "LES RACCOURCIS REMPLISSENT LEUR BARRE",
  deux.raccourciH !== null && deux.barreH !== null && deux.raccourciH >= 38 &&
    Math.abs(deux.raccourciH - deux.barreH) <= 2,
  `lien ${deux.raccourciH} px dans une barre de ${deux.barreH}`,
);
dire(
  "LES DEUX ACTIONS DU BAS ONT LA MÊME BARRE",
  deux.basEnBarre !== null && deux.basEnBarre !== "rgba(0, 0, 0, 0)" && deux.basBoutonH >= 38,
  `${deux.basEnBarre} · ${deux.basBoutonH} px`,
);
dire(
  "AUCUNE LIGNE DE SUJET N'EST ARRONDIE — LE BLOC DÉCOUPE",
  //  Y COMPRIS LA DERNIÈRE. Le conteneur porte le rayon et
  //  `overflow: hidden` ; un second angle posé par-dessus le sien se
  //  voit, surtout sur la ligne « Aucun message » d'un forum vide, qui
  //  est première et dernière à la fois.
  deux.anglesLignes.every((a) => a === "0px") && deux.blocDecoupe,
  `${deux.anglesLignes.join(" | ")} · bloc : ${deux.blocDecoupe}`,
);
dire(
  "LE ROND D'ÉTAT EST EN FACE DE L'IDENTITÉ DU SUJET",
  //  Le rond est un `::before` en absolu : on ne peut pas prendre son
  //  rectangle, on calcule son centre depuis `top` et `height`. Six
  //  pixels de tolérance, c'est ce qu'on ne voit pas.
  deux.rond !== null && deux.centreTitre !== null &&
    Math.abs(deux.rond.centre - deux.centreTitre) <= 6,
  `rond à ${deux.rond?.centre} (top ${deux.rond?.top}), titre à ${deux.centreTitre}`,
);

// ════════════════════════════════════════════════════════════════════
//  4 · SANS JAVASCRIPT, LA PAGE RESTE ENTIÈRE
// ════════════════════════════════════════════════════════════════════

console.log("\n── sans le script ──");

const p2 = await monter({ corps: pageDeZone(), script: false });
const nu = await p2.evaluate(() => ({
  bandeau: document.querySelector(".wm-zone") !== null,
  banniere: getComputedStyle(document.querySelector(".headerbar")).display,
  titre: document.querySelector("h1.page-title")?.textContent?.trim() ?? "",
  titreVu: getComputedStyle(document.querySelector("h1.page-title")).display,
  sujets: Array.from(document.querySelectorAll("a.topictitle")).map((a) =>
    a.textContent.trim()
  ),
  ariane: document.querySelector(".sub-header-path")?.textContent?.trim() ?? "",
}));

dire("pas de bandeau, et c'est normal", nu.bandeau === false);
dire("LA BANNIÈRE DU SITE EST RESTÉE", nu.banniere !== "none", `.headerbar : ${nu.banniere}`);
dire(
  "LE TITRE DU FORUM EST LÀ, ET VISIBLE",
  nu.titre === "Montagnes Embrumées" && nu.titreVu !== "none",
  `« ${nu.titre} » (${nu.titreVu})`,
);
dire("le fil d'Ariane est là", nu.ariane.includes("Wild Mystery"), nu.ariane);
dire(
  "LES CINQ TITRES SONT ENTIERS, ÉTIQUETTE COMPRISE",
  nu.sujets.length === 5 && nu.sujets.every((t, i) => t === SUJETS[i].titre),
  nu.sujets.join(" | "),
);
await p2.close();

// ════════════════════════════════════════════════════════════════════
//  5 · AILLEURS QUE DANS UNE ZONE
// ════════════════════════════════════════════════════════════════════

console.log("\n── un forum qui n'est pas une zone ──");

const p3 = await monter({ corps: pageDeZone({ forumId: 3 }) });
const ville = await p3.evaluate(() => ({
  bandeau: document.querySelector(".wm-zone") !== null,
  banniere: getComputedStyle(document.querySelector(".headerbar")).display,
  pastilles: document.querySelectorAll(".wm-sujet").length,
  etats: document.querySelectorAll("li.row[data-wm-etat]").length,
}));
dire("pas de bandeau hors des dix-sept zones", ville.bandeau === false);
dire("et la bannière du site reste", ville.banniere !== "none", `${ville.banniere}`);
dire(
  "mais les pastilles et les ronds sont posés partout",
  ville.pastilles === 5 && ville.etats === 5,
  `${ville.pastilles} pastilles · ${ville.etats} ronds`,
);
await p3.close();

// ════════════════════════════════════════════════════════════════════
//  6 · LA PAGE NE DÉBORDE PAS
// ════════════════════════════════════════════════════════════════════

console.log("\n── les largeurs ──");

for (const l of [1440, 1024, 760]) {
  const p = await monter({ corps: pageDeZone(), largeur: l });
  const d = await p.evaluate(() => ({
    deborde: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    large: document.documentElement.scrollWidth,
    cadre: document.documentElement.clientWidth,
    titre: Math.round(
      document.querySelector(".wm-zone__titre").getBoundingClientRect().width,
    ),
    bandeau: Math.round(document.querySelector(".wm-zone").getBoundingClientRect().height),
  }));
  dire(`à ${l} px, la page ne déborde pas`, d.deborde === false, `${d.large} / ${d.cadre}`);
  dire(`à ${l} px, le titre a une largeur`, d.titre > 0, `${d.titre} px`);
  dire(
    `à ${l} px, le bandeau garde une hauteur`,
    d.bandeau >= 200,
    `${d.bandeau} px`,
  );
  await p.close();
}

await p1.close();
// ════════════════════════════════════════════════════════════════════
//  7 · LE PRÉAMBULE D'UN FORUM QUI A DES SOUS-FORUMS
// ════════════════════════════════════════════════════════════════════
//
//  « Les catégories sont cassées et les sujets s'affichent en double »,
//  27 octobre, sur `/f2-notice-d-utilisation`. Mesuré sur le forum :
//  f2 et f18 ont des sous-forums et doublent ; f19, f36 et f56 n'en ont
//  pas et ne doublent pas.
//
//  Le préambule ne vient PAS de notre gabarit — retirer `{BOARD_INDEX}`
//  n'y a rien changé, vérifié après publication. C'est Forumactif qui
//  le pose. On le range donc au navigateur.

console.log("\n── un forum qui a des sous-forums ──");

const p7 = await monter({ corps: pageDeZone({ forumId: 18, prefixe: true }) });
const range = await p7.evaluate(() => {
  const forum = document.querySelector(".wm-forum");
  return {
    forumbg: document.querySelectorAll(".forumbg").length,
    forumbgDehors: [...document.querySelectorAll(".forumbg")].filter((b) => !forum.contains(b))
      .length,
    forabg: document.querySelectorAll(".forabg").length,
    forabgDedans: [...document.querySelectorAll(".forabg")].filter((b) =>
      forum.contains(b)
    ).length,
    linklist: document.querySelectorAll("ul.linklist").length,
    nues: [...document.querySelectorAll("li.row, dl.icon")]
      .filter((n) => !forum.contains(n) && n.closest("ul") === null).length,
    titres: [...document.querySelectorAll("a.topictitle")].map((a) => a.textContent.trim()),
    sousForums: [...document.querySelectorAll("a.forumtitle")].map((a) => a.textContent.trim()),
    classe: document.querySelector("#modernbb").classList.contains("wm-forum-range"),
  };
});

dire(
  "LES SUJETS NE SONT PLUS ÉCRITS QU'UNE FOIS",
  range.titres.length === 5,
  `${range.titres.length} titre(s) pour 5 sujets`,
);
dire(
  "et le bloc en double est parti, pas celui de la mise en page",
  range.forumbg === 1 && range.forumbgDehors === 0,
  `${range.forumbg} bloc(s), dont ${range.forumbgDehors} hors de .wm-forum`,
);
dire(
  "LES SOUS-FORUMS SONT GARDÉS, ET REMONTÉS DANS LA MISE EN PAGE",
  range.forabg === 1 && range.forabgDedans === 1 && range.sousForums.length === 2,
  `${range.forabgDedans}/${range.forabg} dans .wm-forum · ${range.sousForums.join(" · ")}`,
);
dire(
  "ET LA LIGNE DE SOUS-FORUM NUE AUSSI",
  //  Un `dl.icon` hors de toute liste : les sous-forums une seconde
  //  fois, sans leur `<ul>`. Il restait après que les blocs aient été
  //  rangés, et c'est lui que Callista voyait encore en haut de `/f2`.
  range.nues === 0,
  `${range.nues} ligne(s) nue(s) hors de .wm-forum`,
);
dire(
  "la barre de liens orpheline est partie",
  range.linklist === 0,
  `${range.linklist} liste(s)`,
);
dire("et la classe de corps le dit", range.classe === true);
await p7.close();

//  ── LA GARDE : ON NE JETTE PAS LA SEULE LISTE DE LA PAGE ───────────
//
//  Si le gabarit ne produit aucun bloc de sujets dans `.wm-forum` —
//  parce qu'il a changé, ou qu'on est sur une page qu'on n'a pas
//  prévue — le module ne doit RIEN retirer. Sans cette garde, il
//  ferait disparaître la seule liste de sujets de la page.

const p8 = await monter({
  corps: pageDeZone({ forumId: 18, prefixe: true, sansListe: true }),
});
const garde = await p8.evaluate(() => ({
  forumbg: document.querySelectorAll(".forumbg").length,
  titres: document.querySelectorAll("a.topictitle").length,
}));
dire(
  "SANS LISTE DANS LA MISE EN PAGE, ON NE RETIRE RIEN",
  garde.forumbg === 1 && garde.titres === 5,
  `${garde.forumbg} bloc(s) · ${garde.titres} sujet(s)`,
);
await p8.close();

//  ── ET UN FORUM SANS SOUS-FORUM N'EST PAS TOUCHÉ ───────────────────

const p9 = await monter({ corps: pageDeZone({ forumId: 56 }) });
const intact = await p9.evaluate(() => ({
  forumbg: document.querySelectorAll(".forumbg").length,
  forabg: document.querySelectorAll(".forabg").length,
  titres: document.querySelectorAll("a.topictitle").length,
  classe: document.querySelector("#modernbb").classList.contains("wm-forum-range"),
}));
dire(
  "un forum sans préambule garde sa page entière, et la classe n'est pas posée",
  intact.forumbg === 1 && intact.forabg === 0 && intact.titres === 5 && intact.classe === false,
  JSON.stringify(intact),
);
await p9.close();

//  ── LA LARGEUR DU FORUM, CONTRE LA LAISSE DE MODERNBB ──────────────
//
//  « Le forum ne fait pas 1000 px partout, y'a plein d'endroits où il
//  est bien trop large », 28 octobre.
//
//  Mesuré sur `/f2` : `15-ltr.css` — la feuille de ModernBB — écrit la
//  largeur réglée dans le panneau DEUX FOIS, sur `#wrap` et sur
//  `.wrap`. Notre règle ne visait que la classe, et un id bat une
//  classe quel que soit l'ordre des feuilles : le conteneur restait à
//  1 356 px. La règle était juste et ne servait à rien.
//
//  Le décor reproduit donc les deux déclarations de ModernBB, à sa
//  valeur d'origine. Sans elles, ce test ne prouverait rien.
//
//  Elles sont injectées APRÈS notre feuille, alors que sur le forum
//  elles viennent avant : c'est le cas le plus défavorable, et notre
//  sélecteur doit gagner même là. Il le peut parce qu'il porte deux
//  identifiants — `#modernbb #wrap` — contre un seul chez ModernBB.

const p10 = await monter({
  corps: `<div id="wrap"><div class="wm-sonde-largeur">du contenu</div></div>`,
  styleEnPlus: "#wrap { max-width: 1400px; } .wrap { max-width: 1400px; }",
});
const laisse = await p10.evaluate(() => ({
  wrap: getComputedStyle(document.getElementById("wrap")).maxWidth,
  corps: Math.round(document.querySelector(".wm-sonde-largeur").getBoundingClientRect().width),
}));
dire(
  "LE FORUM EST TENU À 1200 px, MÊME CONTRE L'ID DE MODERNBB",
  //  1 200 depuis le 30 octobre ; 1 000 les deux jours d'avant. Le
  //  chiffre bouge, pas ce que le test prouve : c'est NOTRE valeur qui
  //  s'applique, et pas les 1 400 que ModernBB écrit sur l'id.
  laisse.wrap === "1200px" && laisse.corps <= 1200,
  JSON.stringify(laisse),
);
await p10.close();

await nav.close();
if (soucis.length > 0) { for (const s of soucis) console.log("  · " + s); }
console.log(soucis.length === 0 ? "\nTOUT PASSE." : `\n${soucis.length} DÉFAUT(S).`);
Deno.exit(soucis.length === 0 ? 0 : 1);
