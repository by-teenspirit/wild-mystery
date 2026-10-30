// ════════════════════════════════════════════════════════════════════
//  outils/membres.mjs — la liste des membres, montée dans un navigateur
//
//  Maquette `307:295`, note de code `307:503`.
//
//  CE QU'IL MESURE, ET POURQUOI C'EST CELUI-LÀ : une liste en colonnes
//  tient ou ne tient pas à UNE chose — qu'une valeur tombe sous son
//  titre. Le reste est de la décoration. L'en-tête et les lignes sont
//  deux rangées de flex distinctes ; rien dans le CSS ne les force à
//  s'accorder, c'est la même grammaire de parts qui le fait. Un test
//  qui ne vérifie que la présence des colonnes ne vérifie rien.
//
//      deno task membres
//      deno task membres --apercu     écrit `apercu-membres.html`
// ════════════════════════════════════════════════════════════════════

import { readFileSync, writeFileSync } from "node:fs";
import { chromium } from "npm:playwright@1.49.1";

//  LE MÊME CHROMIUM QUE LES AUTRES HARNAIS, et la même façon de le
//  trouver : le garde-fou n° 20 vérifie qu'il n'y en a qu'un.
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

// ── résoudre le gabarit ─────────────────────────────────────────────

/** Retire un bloc Forumactif AVEC son contenu. */
function sansBloc(s, nom) {
  const re = new RegExp(
    `<!--\\s*BEGIN ${nom}\\s*-->[\\s\\S]*?<!--\\s*END ${nom}\\s*-->`,
    "g",
  );
  return s.replace(re, "");
}

/** Garde le contenu d'un bloc et retire ses deux marqueurs. */
function gardeBloc(s, nom) {
  return s.replace(
    new RegExp(`<!--\\s*(BEGIN|END) ${nom}\\s*-->`, "g"),
    "",
  );
}

/** Déplie un bloc `combien` fois. */
function repeteBloc(s, nom, combien) {
  const re = new RegExp(
    `<!--\\s*BEGIN ${nom}\\s*-->([\\s\\S]*?)<!--\\s*END ${nom}\\s*-->`,
  );
  const m = s.match(re);
  if (m === null) return s;
  return s.replace(re, m[1].repeat(combien));
}

//  ── LES MEMBRES DU DÉCOR ───────────────────────────────────────────
//
//  Sept, comme la maquette. Les longueurs comptent plus que les noms :
//  un pseudo court à côté d'un pseudo long, un rang d'un mot à côté
//  d'un rang de trois, un compteur à trois chiffres à côté d'un à
//  quatre. Une colonne qui tient pour « Nael » et casse pour
//  « Elijah Smithson » n'aurait pas été vue avec sept « Nael ».
const MEMBRES = [
  {
    nom: "Calliste Vanne",
    rang: "Dresseuse",
    messages: "148",
    inscrit: "Jeu 12 Mar 2026 - 14:03",
    vu: "Aujourd'hui à 9:41",
  },
  {
    nom: "Nael",
    rang: "Dresseur",
    messages: "390",
    inscrit: "Dim 4 Jan 2026 - 21:55",
    vu: "Aujourd'hui à 11:08",
  },
  {
    nom: "Ines Kervadec",
    rang: "Personnel",
    messages: "1 204",
    inscrit: "Ven 2 Jan 2026 - 8:12",
    vu: "Hier à 23:47",
  },
  {
    nom: "Iseult",
    rang: "Dresseuse",
    messages: "61",
    inscrit: "Ven 28 Aoû 2026 - 17:30",
    vu: "Hier à 18:02",
  },
  {
    nom: "Orion",
    rang: "Champion d'arène",
    messages: "806",
    inscrit: "Dim 15 Fév 2026 - 12:00",
    vu: "Dim 27 Sep 2026 - 10:21",
  },
  {
    nom: "Maëlis",
    rang: "Dresseuse",
    messages: "102",
    inscrit: "Jeu 3 Sep 2026 - 6:45",
    vu: "Sam 26 Sep 2026 - 19:13",
  },
  {
    nom: "Elijah Smithson",
    rang: "Personnel",
    messages: "2 118",
    inscrit: "Ven 2 Jan 2026 - 9:00",
    vu: "Aujourd'hui à 7:55",
  },
];

/**
 * Monte `memberlist_body` avec les données du décor.
 *
 * `colonnes` dit quelles colonnes facultatives le panneau sert. C'est
 * tout l'intérêt du harnais : la maquette en montre cinq, le gabarit
 * peut en servir huit ou trois, et la grammaire doit tenir dans les
 * trois cas.
 */
function pageDesMembres({ groupe = true, point = false, mp = true } = {}) {
  let t = readFileSync(
    R +
      (Deno.args.includes("--publiable")
        ? "templates/memberlist_body.a-publier.html"
        : "templates/memberlist_body.nouveau.html"),
    "utf8",
  );

  for (
    const [nom, servi] of [
      ["switch_td_group", groupe],
      ["switch_th_group", groupe],
      ["switch_td_point", point],
      ["switch_th_point", point],
      ["switch_td_pm", mp],
      ["switch_th_pm", mp],
      ["switch_pagination", true],
    ]
  ) t = servi ? gardeBloc(t, nom) : sansBloc(t, nom);

  t = sansBloc(t, "switch_no_user");
  t = repeteBloc(t, "memberrow", MEMBRES.length);

  let i = 0;
  t = t.replace(/\{memberrow\.(\w+)\}/g, (_, nom) => {
    const m = MEMBRES[Math.min(i, MEMBRES.length - 1)];
    if (nom === "ROW_NUMBER") return String(i + 1);
    if (nom === "ROW_CLASS") return i % 2 === 0 ? "row1" : "row2";
    if (nom === "USERNAME") {
      //  Forumactif sert le pseudo DÉJÀ COLORÉ, en style inline, dans
      //  un `span.usr_grp_clr`. On reproduit la forme : une règle qui
      //  marcherait sur du texte nu et pas sur ce span ne marcherait
      //  pas sur le forum.
      return `<span class="usr_grp_clr" style="color:#B56A45">${m.nom}</span>`;
    }
    if (nom === "U_VIEWPROFILE") return `/u${i + 3}`;
    if (nom === "AVATAR_IMG") {
      return `<img src="${PIXEL}" alt="" width="34" height="34" />`;
    }
    if (nom === "GROUPS") {
      //  Le rang arrive LUI AUSSI colorié par le groupe, et c'est un
      //  lien vers la page du groupe.
      return `<a href="/g${i + 1}" style="color:#46849C">${m.rang}</a>`;
    }
    if (nom === "POSTS") return m.messages;
    if (nom === "POINTS") return "250";
    if (nom === "JOINED") return m.inscrit;
    if (nom === "LASTVISIT") {
      i++;
      return m.vu;
    }
    //  LE FACECLAIM arrive par le champ « Intérêts » — le seul champ
    //  de profil libre que Forumactif expose sur cette page. Le décor
    //  en sert un long et un vide : la ligne doit tenir dans les deux
    //  cas, et surtout garder sa hauteur quand il n'y en a pas.
    if (nom === "INTERESTS") {
      return i % 3 === 2
        ? ""
        : ["Florence Pugh", "Dev Patel", "Anya Taylor-Joy", "Idris Elba", "Jodie Comer"][i % 5];
    }
    if (nom === "PM_IMG") return `<img src="${PIXEL}" alt="MP" />`;
    if (nom === "WWW_IMG") return `<img src="${PIXEL}" alt="Site" />`;
    return "";
  });

  //  Les scripts de Forumactif ne tournent pas ici : chacun lève
  //  « $ is not defined » et noierait une vraie erreur de page.
  t = t.replace(/<script[\s\S]*?<\/script>/g, "");

  const globales = {
    PAGE_TITLE: "Membres",
    S_MODE_ACTION: "/memberlist",
    L_USER_SELECT: "Chercher un membre",
    L_USER_SELECT_VALUE: "",
    //  La vraie phrase de Forumactif, pas le mot que j'avais inventé.
    L_ORDER_OR_SELECT: "Rechercher un utilisateur ou modifier l'ordre d'affichage",
    L_SELECT_SORT_METHOD: "Méthode de tri",
    L_ORDER: "Ordre",
    L_SUBMIT: "OK",
    S_HIDDEN_SID: "",
    //  ── LES VRAIES OPTIONS, RELEVÉES SUR LA PAGE LE 30 OCTOBRE ────
    //
    //  `{S_MODE_SELECT}` n'est pas une liste de deux mots : il
    //  énumère TOUS les champs de profil du forum, renommés compris.
    //  Mon décor en servait deux, courts. Résultat : la rangée tenait
    //  au harnais et débordait sur la vraie page.
    //
    //  Une liste déroulante est large de sa plus longue option. C'est
    //  « Messages postés » et « OKÉDOLLARS » qui décident de sa
    //  largeur, pas « Ordre ».
    S_MODE_SELECT: '<select name="mode">' +
      [
        "Dernière visite",
        "Date d'inscription",
        "Nom d'utilisateur",
        "Faceclaim",
        "Messages postés",
        "PRÉSENTATION",
        "Groupes",
        "\u20BDOKÉDOLLARS",
      ]
        .map((o) => "<option>" + o + "</option>").join("") +
      "</select>",
    S_ORDER_SELECT: '<select name="order"><option>Croissant</option>' +
      "<option>Décroissant</option></select>",
    L_USERNAME: "Dresseur",
    L_GROUPS: "Rang",
    L_POINT: "Points",
    L_POSTS: "Messages",
    L_JOINED: "Inscrit le",
    L_VISITED: "Dernière visite",
    L_PM: "MP",
    L_WEBSITE: "Site",
    PAGINATION: "<span>Page <strong>1</strong> sur 8</span>",
  };
  return t.replace(/\{([\w.]+)\}/g, (_, n) => globales[n] ?? "");
}

/*  LA FEUILLE DE MODERNBB, RÉDUITE À CE QUI PIÈGE.

    Quatre défauts de décor ont été payés cette semaine sur le harnais
    du sujet, et les quatre sont ici :

      · `box-sizing: border-box` partout — sans lui une colonne mesure
        sa largeur plus ses rembourrages, et le harnais accuse notre
        règle au lieu de son propre décor ;
      · `#wrap` ET `.wrap` — ModernBB écrit la laisse du forum DEUX
        fois, et un id bat une classe quel que soit l'ordre des
        feuilles ;
      · `dfn { display: none }` — ModernBB le cache, pas nous ;
      · les icônes de fonte font ZÉRO pixel sans Ionicons. On leur pose
        une doublure de 14 px : ce qui est mesuré est la PLACE qu'elles
        prennent, pas leur forme. */
const BASE_MODERNBB = `
*, *::before, *::after { box-sizing: border-box; }
dfn { display: none; }
[class^="ion-"], [class*=" ion-"] {
  display: inline-block; width: 14px; height: 14px;
  background: currentColor; border-radius: 2px; opacity: .55;
}
body { margin: 0; font-family: sans-serif; font-size: 13px; }
ul { margin: 0; padding: 0; list-style: none; }
h1.page-title { border-bottom: 1px solid #3793ff; }
#wrap { max-width: 1400px; margin: 0 auto; }
.wrap { max-width: 1400px; margin: 0 auto; }`;

const page = (corps) =>
  `<!doctype html><html lang="fr"><head><meta charset="utf-8">
<style>${BASE_MODERNBB}</style>
<style>${readFileSync(R + "panneau-admin/jetons.css", "utf8")}</style>
<style>${readFileSync(R + "css/wild-mystery.css", "utf8")}</style>
<style>html,body{margin:0}body{background:var(--wm-fond-page)}</style>
</head><body id="modernbb">
<div class="conteneur_minwidth_IE modern-resp">
<div id="wrap"><div id="page-body">${corps}</div></div>
</div>
</body></html>`;

// ── l'aperçu ────────────────────────────────────────────────────────

if (Deno.args.includes("--apercu")) {
  const brut = page(pageDesMembres())
    .replace("<head>", "<head><title>Les membres — Wild Mystery</title>");
  writeFileSync(
    R + "apercu-membres.html",
    brut.replace(
      /<link(?![^>]*fonts\.(?:googleapis|gstatic)\.com)[^>]*href=["']?(?:https?:)?\/\/[^>]*>/g,
      "",
    ),
  );
  console.log("  apercu-membres.html écrit");
  Deno.exit(0);
}

// ── le navigateur ───────────────────────────────────────────────────

const nav = await chromium.launch(
  CHROME === undefined ? {} : { executablePath: CHROME },
);
const soucis = [];

function dire(nom, ok, detail = "") {
  console.log(`  ${ok ? "ok  " : "DÉFAUT"} ${nom}${detail === "" ? "" : " — " + detail}`);
  if (!ok) soucis.push(nom + (detail === "" ? "" : " — " + detail));
}

console.log("\n── la liste des membres ──");

const p = await nav.newPage({ viewport: { width: 1440, height: 1200 } });
await p.setContent(page(pageDesMembres()), { waitUntil: "load" });

// ── les colonnes tombent-elles en face ? ────────────────────────────

const colonnes = await p.evaluate(() => {
  const entete = document.querySelector(".wm-membres__entete");
  const lignes = [...document.querySelectorAll(".wm-membres__ligne")];
  if (entete === null || lignes.length === 0) return null;
  const x = (e) => Math.round(e.getBoundingClientRect().x);
  const l = (e) => Math.round(e.getBoundingClientRect().width);
  const cols = (r) => [...r.querySelectorAll(":scope > .wm-membres__col")];

  const titres = cols(entete);
  //  L'ÉCART MAXIMAL entre le bord gauche d'un titre et celui de la
  //  valeur qui doit tomber dessous, sur TOUTES les lignes. Une seule
  //  ligne décalée suffit à casser la lecture d'une liste.
  let pire = 0;
  for (const ligne of lignes) {
    const vals = cols(ligne);
    if (vals.length !== titres.length) return { desaccord: true };
    for (let n = 0; n < titres.length; n++) {
      pire = Math.max(pire, Math.abs(x(titres[n]) - x(vals[n])));
    }
  }
  return {
    combien: titres.length,
    mots: titres.map((t) => t.textContent.trim()),
    pire,
    largeurs: titres.map(l),
    interieur: l(entete),
  };
});

dire(
  "LES SEPT MEMBRES SONT MONTÉS, AVEC LEURS COLONNES",
  colonnes !== null && colonnes.desaccord !== true && colonnes.combien === 6,
  JSON.stringify(colonnes?.mots ?? colonnes),
);

dire(
  "CHAQUE VALEUR TOMBE SOUS SON TITRE",
  //  C'est LE contrôle de cette page. L'en-tête et les lignes sont
  //  deux rangées de flex distinctes : rien ne les force à s'accorder
  //  sinon la même grammaire de parts.
  colonnes !== null && colonnes.pire <= 1,
  `écart maximal : ${colonnes?.pire} px`,
);

dire(
  "ET LES LARGEURS SUIVENT LES PARTS DE LA MAQUETTE",
  //  376 · 170 · 100 · 144 · 166 sur 956 utiles. On compare des
  //  PROPORTIONS, pas des pixels : la maquette fait 1 000 de contenu,
  //  le forum 1 200 depuis le 30 octobre.
  (() => {
    if (colonnes === null || colonnes.largeurs === undefined) return false;
    const voulu = [376, 170, 100, 144, 166];
    //  La colonne des liens est en `flex: 0 0 auto` : elle ne suit
    //  aucune part, on la laisse de côté.
    const mesure = colonnes.largeurs.slice(0, 5);
    const total = mesure.reduce((a, b) => a + b, 0);
    const voulues = voulu.reduce((a, b) => a + b, 0);
    return voulu.every((v, n) => Math.abs(v / voulues - mesure[n] / total) < 0.02);
  })(),
  JSON.stringify(colonnes?.largeurs),
);

// ── la forme d'une ligne ────────────────────────────────────────────

const ligne = await p.evaluate(() => {
  const li = document.querySelector(".wm-membres__ligne");
  if (li === null) return null;
  const rond = li.querySelector(".wm-membres__avatar");
  const nom = li.querySelector(".wm-membres__nom");
  const rang = li.querySelector(".wm-membres__col--rang");
  const past = rang?.querySelector("a, span") ?? null;
  const r = (e) => e.getBoundingClientRect();
  return {
    hauteur: Math.round(r(li).height),
    avatar: {
      l: Math.round(r(rond).width),
      h: Math.round(r(rond).height),
      rayon: getComputedStyle(rond).borderTopLeftRadius,
      //  L'image remplit le rond sans déborder : `overflow: hidden`.
      coupe: getComputedStyle(rond).overflow,
    },
    //  LE PSEUDO GARDE LA COULEUR DE SON GROUPE. Forumactif la pose en
    //  style inline ; une règle de couleur à nous l'écraserait.
    couleurDuGroupe: getComputedStyle(nom.querySelector(".usr_grp_clr") ?? nom).color,
    //  LE RANG EST UNE PASTILLE, CENTRÉE DANS SA COLONNE.
    pastille: past === null ? null : {
      h: Math.round(r(past).height),
      rayon: getComputedStyle(past).borderTopLeftRadius,
      ecartAuCentre: Math.abs(
        Math.round(r(past).x + r(past).width / 2) -
          Math.round(r(rang).x + r(rang).width / 2),
      ),
    },
  };
});

dire(
  "UNE LIGNE FAIT 61 DE HAUT, SON AVATAR EST UN ROND DE 34",
  ligne !== null && ligne.hauteur === 61 && ligne.avatar.l === 34 &&
    ligne.avatar.h === 34 && ligne.avatar.rayon === "999px" &&
    ligne.avatar.coupe === "hidden",
  JSON.stringify(ligne),
);

dire(
  "LE RANG EST UNE PASTILLE DE 21, CENTRÉE DANS SA COLONNE",
  ligne?.pastille !== null && ligne.pastille.h >= 21 &&
    ligne.pastille.rayon === "999px" && ligne.pastille.ecartAuCentre <= 1,
  JSON.stringify(ligne?.pastille),
);

dire(
  "LE PSEUDO GARDE LA COULEUR DE SON GROUPE",
  //  `#B56A45`, celle que le décor pose en style inline.
  ligne !== null && ligne.couleurDuGroupe === "rgb(181, 106, 69)",
  ligne?.couleurDuGroupe,
);

// ── la rangée d'outils ──────────────────────────────────────────────

const outils = await p.evaluate(() => {
  const barre = document.querySelector(".wm-membres__outils");
  const champ = barre?.querySelector(".wm-membres__recherche input") ?? null;
  const modes = barre?.querySelector(".wm-membres__modes") ?? null;
  const tri = barre?.querySelector(".wm-membres__tri") ?? null;
  if (champ === null || modes === null || tri === null) return null;
  const r = (e) => e.getBoundingClientRect();
  const milieu = (e) => Math.round(r(e).y + r(e).height / 2);
  return {
    champ: { l: Math.round(r(champ).width), h: Math.round(r(champ).height) },
    liens: [...modes.querySelectorAll("a")].map((a) => a.textContent.trim()),
    adresses: [...modes.querySelectorAll("a")].map((a) => a.getAttribute("href")),
    modesADroite: Math.round(r(modes).right) >= Math.round(r(barre).right) - 1,
    //  Le bloc a un rembourrage depuis le 30 octobre : la recherche
    //  est à gauche DU CONTENU, pas du bord de la carte.
    champAGauche: Math.round(r(champ).x) <=
      Math.round(r(barre).x + parseFloat(getComputedStyle(barre).paddingLeft)) + 1,
    //  LA RECHERCHE ET LE TRI sur la même ligne, le tri à droite…
    memeLigne: Math.abs(milieu(champ) - milieu(tri)) <= 2,
    triADroite: Math.round(r(tri).right) <=
      Math.round(r(barre).right - parseFloat(getComputedStyle(barre).paddingRight)) + 1,
    //  …et les trois modes EN DESSOUS.
    modesDessous: Math.round(r(modes).top) >= Math.round(r(champ).bottom) - 1,
    //  LA RANGÉE EST UN BLOC : une surface à elle, un filet, un rayon.
    bloc: {
      fond: getComputedStyle(barre).backgroundColor,
      fondPage: getComputedStyle(document.body).backgroundColor,
      filet: getComputedStyle(barre).borderTopWidth,
      rayon: getComputedStyle(barre).borderTopLeftRadius,
    },
    //  ET LA FLÈCHE DES LISTES NE COLLE PLUS AU TEXTE.
    flecheRespire: [...tri.querySelectorAll("select")].every((e) =>
      parseFloat(getComputedStyle(e).paddingRight) >= 24
    ),
    //  RIEN NE SORT DE LA RANGÉE. Une liste large de sa plus longue
    //  option déborde sans faire grandir son parent : c'est le défaut
    //  du 30 octobre, invisible à toute mesure de hauteur.
    deborde: Math.max(
      0,
      ...[...barre.querySelectorAll("*")].map((e) =>
        Math.round(e.getBoundingClientRect().right) -
        Math.round(r(barre).right)
      ),
    ),
    //  LES ÉTIQUETTES DES DEUX LISTES SONT LÀ POUR QUI ÉCOUTE LA PAGE :
    //  hors de l'écran, pas hors de l'arbre.
    etiquettes: [...tri.querySelectorAll(".wm-membres__tri-nom")].map((e) => ({
      mot: e.textContent.trim(),
      affichage: getComputedStyle(e).display,
      large: Math.round(r(e).width),
    })),
  };
});

dire(
  "LA RECHERCHE ET LE TRI PARTAGENT LA PREMIÈRE LIGNE, LES MODES SONT DESSOUS",
  //  ── CE CONTRÔLE A CHANGÉ D'INTENTION DEUX FOIS LE 30 OCTOBRE ───
  //
  //  1 · les trois blocs sur une ligne — intenable, les listes de tri
  //      énumèrent les champs de profil du forum ;
  //  2 · recherche et onglets ensemble, tri dessous — mon choix ;
  //  3 · recherche et TRI ensemble, onglets dessous — celui de
  //      Callista, et il est meilleur : chercher et trier sont la même
  //      action au même moment, tandis que les trois modes sont trois
  //      PAGES. Collés à la recherche, ils avaient l'air de la filtrer.
  //
  //  À chaque fois l'intention est réécrite, jamais affaiblie.
  outils !== null && outils.champAGauche && outils.memeLigne &&
    outils.triADroite && outils.modesDessous && outils.champ.h === 40,
  JSON.stringify(outils),
);
dire(
  "LA RANGÉE D'OUTILS EST UN BLOC, PAS TROIS CONTRÔLES DANS LE VIDE",
  outils !== null && outils.bloc.fond !== outils.bloc.fondPage &&
    outils.bloc.filet === "1px" && outils.bloc.rayon === "10px",
  JSON.stringify(outils?.bloc),
);
dire(
  "ET LA FLÈCHE DES LISTES NE COLLE PLUS À LA DERNIÈRE LETTRE",
  outils !== null && outils.flecheRespire,
  "",
);
dire(
  "LES TROIS MODES POINTENT SUR LES TROIS ADRESSES DE LA NOTE DE CODE",
  outils !== null &&
    outils.adresses.join(" ") ===
      "/memberlist /memberlist?mode=overall_posters /memberlist?mode=today_posters",
  JSON.stringify(outils?.adresses),
);

dire(
  "LES DEUX LISTES DE TRI GARDENT UNE ÉTIQUETTE LISIBLE PAR UN LECTEUR",
  outils !== null && outils.etiquettes.length === 2 &&
    outils.etiquettes.every((e) => e.mot.length > 0 && e.affichage !== "none" && e.large <= 1),
  JSON.stringify(outils?.etiquettes),
);

// ── le bandeau de section ───────────────────────────────────────────

const bande = await p.evaluate(() => {
  const b = document.querySelector(".wm-membres__section .wm-forum__bande");
  const liste = document.querySelector(".wm-membres");
  if (b === null || liste === null) return null;
  const st = getComputedStyle(b);
  return {
    titre: b.querySelector(".wm-forum__bande-titre")?.textContent.trim() ?? null,
    hauteur: Math.round(b.getBoundingClientRect().height),
    //  LA BANDE ET LA LISTE NE FONT QU'UN BLOC : la bande arrondit le
    //  haut, la liste garde le bas, et il n'y a pas d'écart entre les
    //  deux.
    hautArrondi: st.borderTopLeftRadius,
    basDroit: st.borderBottomLeftRadius,
    ecart: Math.round(
      liste.getBoundingClientRect().top - b.getBoundingClientRect().bottom,
    ),
  };
});

dire(
  "LA SECTION PORTE SON BANDEAU, COLLÉ À LA LISTE",
  bande !== null && bande.titre === "LES MEMBRES" && bande.hauteur >= 74 &&
    bande.hautArrondi === "10px" && bande.basDroit === "0px" &&
    bande.ecart === 0,
  JSON.stringify(bande),
);

// ── une colonne coupée au panneau ───────────────────────────────────
//
//  C'est le cas que la maquette ne montre pas et que le forum peut
//  servir n'importe quand : `switch_td_group` et `switch_td_pm` ne
//  sortent que si le panneau les a activés. Des largeurs en dur
//  donneraient une ligne qui ne remplit plus sa carte, et un en-tête
//  qui ne tombe plus en face.

const sansGroupe = await nav.newPage({ viewport: { width: 1440, height: 1200 } });
await sansGroupe.setContent(
  page(pageDesMembres({ groupe: false, mp: false, point: true })),
  { waitUntil: "load" },
);
const coupe = await sansGroupe.evaluate(() => {
  const entete = document.querySelector(".wm-membres__entete");
  const lignes = [...document.querySelectorAll(".wm-membres__ligne")];
  const cols = (r) => [...r.querySelectorAll(":scope > .wm-membres__col")];
  const x = (e) => Math.round(e.getBoundingClientRect().x);
  const titres = cols(entete);
  let pire = 0;
  for (const ligne of lignes) {
    const vals = cols(ligne);
    if (vals.length !== titres.length) return { desaccord: true };
    for (let n = 0; n < titres.length; n++) {
      pire = Math.max(pire, Math.abs(x(titres[n]) - x(vals[n])));
    }
  }
  const der = titres[titres.length - 1].getBoundingClientRect();
  return {
    combien: titres.length,
    mots: titres.map((t) => t.textContent.trim()),
    pire,
    //  ET LA LIGNE REMPLIT TOUJOURS SA CARTE : la dernière colonne
    //  arrive au bord, à son rembourrage près.
    remplit: Math.round(entete.getBoundingClientRect().right - der.right) <= 21,
  };
});
await sansGroupe.close();

dire(
  "UNE COLONNE COUPÉE AU PANNEAU REFERME LA LIGNE SANS LA CASSER",
  coupe.desaccord !== true && coupe.combien === 5 && coupe.pire <= 1 &&
    coupe.remplit,
  JSON.stringify(coupe),
);

// ── SUR UN ÉCRAN ÉTROIT ────────────────────────────────────────────
//
//  La borne de largeur des listes ne servait à rien à 1 280 : la
//  seconde ligne leur laisse toute la place. Elle sert à 980 — un
//  portable, ou une fenêtre qu'on n'a pas mise en plein écran — et
//  c'est là qu'il faut la mesurer, sinon c'est une règle qu'on croit
//  utile sans jamais l'avoir vue agir.
//
//  Au-dessus de 740 : on reste dans la mise en page large, celle qui
//  a les deux lignes. Le repli du téléphone est une autre histoire.

const etroit = await nav.newPage({ viewport: { width: 980, height: 1000 } });
await etroit.setContent(page(pageDesMembres()), { waitUntil: "load" });
const serre = await etroit.evaluate(() => {
  const barre = document.querySelector(".wm-membres__outils");
  const bord = Math.round(barre.getBoundingClientRect().right);
  return {
    deborde: Math.max(
      0,
      ...[...barre.querySelectorAll("*")].map((e) =>
        Math.round(e.getBoundingClientRect().right) - bord
      ),
    ),
    listes: [...barre.querySelectorAll("select")].map((e) =>
      Math.round(e.getBoundingClientRect().width)
    ),
  };
});
await etroit.close();

dire(
  "À 980 DE LARGE, LES LISTES RESTENT BORNÉES ET RIEN NE DÉBORDE",
  serre.deborde <= 1 && serre.listes.every((l) => l <= 170),
  JSON.stringify(serre),
);

// ── LE DÉCOR HOSTILE ───────────────────────────────────────────────
//
//  « Ça passe souvent sur deux lignes », 30 octobre. Pas dans mon
//  décor — et c'est bien le problème : un décor poli ne trouve rien.
//
//  Celui-ci sert ce que le forum sert vraiment et que je n'avais pas
//  reproduit : un membre dans TROIS groupes — `{memberrow.GROUPS}`
//  rend un lien par groupe, séparés par des virgules — un pseudo très
//  long, un avatar aux dimensions de Forumactif (200 × 320, pas 34),
//  et une date complète. Tout ce qui peut faire grandir une cellule,
//  sur la même ligne.
//
//  LA PAGE EST MONTÉE À 1 200, la largeur du forum depuis le 30
//  octobre, et pas à la largeur de la fenêtre : c'est là que ça se
//  joue.

const dur = await nav.newPage({ viewport: { width: 1280, height: 1200 } });
await dur.setContent(
  page(pageDesMembres({ groupe: true, point: true, mp: true }))
    .replace(
      /<a href="\/g\d+" style="color:#46849C">[^<]*<\/a>/,
      '<a href="/g1" style="color:#46849C">Champion d\'arène</a>, ' +
        '<a href="/g2" style="color:#46849C">Conseil des Quatre</a>, ' +
        '<a href="/g3" style="color:#46849C">Modération</a>',
    )
    .replace(
      /<span class="usr_grp_clr" style="color:#B56A45">Calliste Vanne<\/span>/,
      '<span class="usr_grp_clr" style="color:#B56A45">' +
        "Calliste Vanne de la Roche-aux-Fées</span>",
    )
    //  L'AVATAR TEL QUE FORUMACTIF LE SERT : avec ses dimensions à
    //  lui, qui sont celles du profil et pas celles d'une liste.
    .replace(/width="34" height="34"/g, 'width="200" height="320"'),
  { waitUntil: "load" },
);

const resiste = await dur.evaluate(() => {
  const lignes = [...document.querySelectorAll(".wm-membres__ligne")];
  const entete = document.querySelector(".wm-membres__entete");
  const h = (e) => Math.round(e.getBoundingClientRect().height);
  const rond = lignes[0].querySelector(".wm-membres__avatar img");
  return {
    entete: h(entete),
    //  TOUTES les lignes, pas la première : c'est celle qui porte les
    //  trois groupes qui casserait.
    hauteurs: [...new Set(lignes.map(h))],
    avatar: [
      Math.round(rond.getBoundingClientRect().width),
      Math.round(rond.getBoundingClientRect().height),
    ],
    //  ET LES COLONNES TOMBENT TOUJOURS EN FACE.
    pire: (() => {
      const cols = (r) => [...r.querySelectorAll(":scope > .wm-membres__col")];
      const x = (e) => Math.round(e.getBoundingClientRect().x);
      const t = cols(entete);
      let pire = 0;
      for (const l of lignes) {
        const v = cols(l);
        for (let n = 0; n < t.length; n++) {
          pire = Math.max(pire, Math.abs(x(t[n]) - x(v[n])));
        }
      }
      return pire;
    })(),
  };
});
await dur.close();

dire(
  "TROIS GROUPES, UN PSEUDO LONG ET UN AVATAR DE PROFIL NE CASSENT RIEN",
  //  Une seule hauteur pour sept lignes : aucune n'a grandi.
  resiste.hauteurs.length === 1 && resiste.hauteurs[0] === 61 &&
    resiste.entete === 37 && resiste.pire <= 1 &&
    //  L'avatar garde son rond : Forumactif sert ses dimensions à lui.
    resiste.avatar[0] === 34 && resiste.avatar[1] === 34,
  JSON.stringify(resiste),
);

//  ── CE QUI EST VRAIMENT TESTABLE, ET CE QUI NE L'EST PAS ───────────
//
//  « Les valeurs ont toutes la même taille » a été écrit d'abord comme
//  un contrôle. Ça n'en était pas un : la règle qui les unifie porte
//  deux classes, celles des colonnes n'en portent qu'une, donc elle
//  gagne quoi qu'on remette. Retirer la règle testée ne faisait pas
//  tomber le contrôle — il passait par construction.
//
//  On garde la mesure, mais contre une VALEUR : 11,5, le jeton
//  `taille-petit`. Si quelqu'un unifie un jour sur une autre taille,
//  ou gagne en spécificité, le contrôle le dira.

const tailles = await p.evaluate(() => {
  const vals = [...document.querySelectorAll(
    ".wm-membres__ligne > .wm-membres__col--chiffre," +
      ".wm-membres__ligne > .wm-membres__col--date",
  )];
  return {
    combien: vals.length,
    distinctes: [...new Set(vals.map((e) => getComputedStyle(e).fontSize))],
  };
});

dire(
  "LES VALEURS ONT TOUTES LA MÊME TAILLE, CELLE DU JETON `taille-petit`",
  tailles.combien >= 10 && tailles.distinctes.length === 1 &&
    tailles.distinctes[0] === "11.5px",
  JSON.stringify(tailles),
);

//  ── RIEN NE DÉBORDE DE SA LIGNE ────────────────────────────────────
//
//  C'est LUI, le contrôle que « sans la coupe des cellules » devait
//  faire tomber. La hauteur ne bougeait pas — la colonne des rangs
//  est en flex, donc trois groupes débordent sur le côté au lieu de
//  passer à la ligne — mais ils SORTAIENT de la carte. Une hauteur
//  juste et du texte qui dépasse, c'est pire qu'une ligne haute :
//  on ne le voit pas en mesurant.

const deborde = await p.evaluate(() => {
  const lignes = [
    document.querySelector(".wm-membres__entete"),
    ...document.querySelectorAll(".wm-membres__ligne"),
  ];
  let pires = [];
  for (const l of lignes) {
    const bord = Math.round(l.getBoundingClientRect().right);
    for (const c of l.querySelectorAll(":scope > .wm-membres__col")) {
      //  Deux débordements possibles : la cellule sort de la ligne, ou
      //  son contenu sort de la cellule.
      const hors = Math.round(c.getBoundingClientRect().right) - bord;
      const dedans = c.scrollWidth - c.clientWidth;
      pires.push(Math.max(hors, dedans));
    }
  }
  return Math.max(...pires);
});

//  ── LE FACECLAIM SOUS LE PSEUDO ────────────────────────────────────
//
//  « On peut afficher aussi son faceclaim en dessous du pseudo ? »,
//  30 octobre. Oui, par `{memberrow.INTERESTS}` — le seul champ de
//  profil libre que Forumactif expose ici. Le décor en sert un sur
//  trois à vide : c'est le cas qui ferait onduler la liste.

const faceclaims = await p.evaluate(() => {
  const lignes = [...document.querySelectorAll(".wm-membres__ligne")];
  const h = (e) => Math.round(e.getBoundingClientRect().height);
  return {
    remplis: lignes.filter((l) =>
      (l.querySelector(".wm-membres__fc")?.textContent.trim() ?? "") !== ""
    ).length,
    vides: lignes.filter((l) =>
      (l.querySelector(".wm-membres__fc")?.textContent.trim() ?? "") === ""
    ).length,
    //  UNE SEULE HAUTEUR : avec ou sans faceclaim, la ligne fait 61.
    hauteurs: [...new Set(lignes.map(h))],
    //  ET IL SE COUPE au lieu de pousser la colonne.
    coupe: lignes.every((l) => {
      const e = l.querySelector(".wm-membres__sous");
      return e === null || getComputedStyle(e).textOverflow === "ellipsis";
    }),
  };
});

dire(
  "LE FACECLAIM S'AFFICHE SOUS LE PSEUDO, ET SON ABSENCE NE CREUSE RIEN",
  faceclaims.remplis >= 4 && faceclaims.vides >= 2 &&
    faceclaims.hauteurs.length === 1 && faceclaims.hauteurs[0] === 61 &&
    faceclaims.coupe,
  JSON.stringify(faceclaims),
);

dire(
  "AUCUNE CELLULE NE DÉBORDE DE SA LIGNE",
  deborde <= 1,
  `débordement maximal : ${deborde} px`,
);

await p.close();
await nav.close();

if (soucis.length > 0) console.log("\n-- ce qui reste --\n" + soucis.join("\n"));
console.log(
  soucis.length === 0 ? "\nTOUT PASSE." : `\n${soucis.length} DÉFAUT(S).`,
);
if (soucis.length > 0) Deno.exit(1);
