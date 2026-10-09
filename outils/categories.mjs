// ════════════════════════════════════════════════════════════════════
//  outils/categories.mjs — les lignes de catégorie, dans un vrai
//  navigateur, et À PARTIR DES GABARITS EUX-MÊMES.
//
//  ── POURQUOI CE HARNAIS N'EXISTAIT PAS, ET AURAIT DÛ ────────────────
//
//  Quatre tournées de CSS sur les catégories entre le 8 et le 9
//  octobre, et chacune vérifiée à l'œil sur des captures. D'où quatre
//  allers-retours : le rang, la typo de l'en-tête, le bouton de repli,
//  l'écart des compteurs, l'avatar du dernier posteur, les trois
//  étages de la colonne d'identité. Rien de tout ça n'était gardé.
//
//  ── CE QUI LE REND DIFFÉRENT DES AUTRES ─────────────────────────────
//
//  Les autres harnais servent un décor écrit à la main, relevé sur le
//  forum. Celui-ci RÉSOUT LE GABARIT : il lit
//  `templates/index_box.html` et `templates/index_box.nouveau.html`,
//  remplace les variables de Forumactif par des valeurs, et sert les
//  deux pages. Un gabarit modifié change donc ce qui est testé, ce qui
//  est tout l'intérêt — on ne teste pas une copie du gabarit, on teste
//  le gabarit.
//
//  ── LA QUESTION À LAQUELLE IL RÉPOND ────────────────────────────────
//
//  « Pourquoi on a pas du tout touché à l'index box ? » Parce qu'on
//  stylait autour. Ce harnais mesure les deux rendus et demande qu'ils
//  soient les MÊMES : le gabarit neuf doit donner, sans le script, ce
//  que l'ancien ne donnait qu'avec.
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

// ── le résolveur de gabarit ─────────────────────────────────────────

/** Un carré de 2 px, pour que les images aient une taille sans réseau. */
const PIXEL =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAD0lEQVR4nGP4z8DAxIAEAB0GAwMBHe4bAAAAAElFTkSuQmCC";

/** Les variables, par leur nom COMPLET tel que le gabarit l'écrit.
 *
 *  `L_FORUM` porte son `<h2>` : c'est le point qui m'a fait mesurer
 *  faux le 9 octobre. J'avais relevé `div.table-title` — en Nunito,
 *  correctement — alors que le texte visible est le `<h2>` DEDANS, que
 *  `#modernbb .table-title h2` habille directement. Le `<h2>` ne vient
 *  pas du gabarit, il vient de la variable : on ne peut le voir qu'en
 *  la résolvant. */
const VARS = {
  "catrow.tablehead.L_FORUM": '<h2><a href="/f1-avant-de-partir">AVANT DE PARTIR</a></h2>',
  "catrow.forumrow.FORUM_FOLDER_IMG": PIXEL,
  "catrow.forumrow.INC_LEVEL": "10px",
  "catrow.forumrow.INC_LEVEL_LEFT": "0px",
  "catrow.forumrow.INC_LEVEL_RIGHT": "0px",
  "catrow.forumrow.LEVEL": "3",
  "catrow.forumrow.U_VIEWFORUM": "/f9-les-fiches",
  "catrow.forumrow.FORUM_NAME": "Les fiches de présentation",
  //  Une description LONGUE, pour que la barre de défilement ait une
  //  raison d'apparaître : c'est ce qui se mesure.
  "catrow.forumrow.FORUM_DESC":
    "On y dépose sa fiche avant de jouer, et on attend qu'un MJ la valide. " +
    "Les modèles sont épinglés en haut du forum, et le règlement vaut aussi " +
    "ici : pas de pokémon légendaire, pas de niveau de départ au-dessus de " +
    "quinze, et une image par fiche au maximum.",
  "catrow.forumrow.L_LINKS": "",
  "catrow.forumrow.LINKS":
    '<a class="gensmall" href="/f10-en-cours">En cours de validation</a>, ' +
    '<a class="gensmall" href="/f11-validees">Validées</a>, ' +
    '<a class="gensmall" href="/f12-modeles">Modèles de fiche</a>',
  "catrow.forumrow.TOPICS": "12",
  "catrow.forumrow.POSTS": "436",
  "catrow.forumrow.avatar.LAST_POST_AVATAR": `<img src="${PIXEL}" alt="" />`,
  "catrow.forumrow.U_LATEST_TOPIC": "/t99-ramener-un-fossile-a-la-vie",
  "catrow.forumrow.LATEST_TOPIC_TITLE": "Ramener un fossile à la vie",
  "catrow.forumrow.LATEST_TOPIC_NAME": "Ramener un fossile à la vie",
  //  LA DATE ET L'AUTEUR SONT DANS UNE SEULE VARIABLE, séparés par un
  //  `<br>` que Forumactif écrit lui-même. C'est la raison pour
  //  laquelle `recomposerLesDerniersMessages` ne peut pas être remplacé
  //  par du gabarit : un gabarit ne découpe pas le contenu d'une
  //  variable.
  "catrow.forumrow.USER_LAST_POST":
    'Mar 2 Avr 2024 - 18:42<br />Invité&nbsp;<a href="/t99p" class="last-post-icon">' +
    '<i class="ion-ios-arrow-right"></i></a>',
  L_TOPICS: "Sujets",
  L_POSTS: "Messages",
  L_LASTPOST: "Dernier message",
};

/** Les blocs qu'on garde, et combien de fois. Les autres sont retirés
 *  avec leur contenu — c'est ce que fait Forumactif quand la condition
 *  n'est pas remplie. */
const BLOCS = {
  catrow: 1,
  tablehead: 1,
  forumrow: 3,
  tablefoot: 1,
  avatar: 1,
  switch_topic_title: 1,
  ads: 0,
  switch_moderators_links: 0,
  switch_forum_images: 0,
  switch_user_logged_in: 0,
  switch_on_index: 0,
  switch_delete_cookies: 0,
};

/** Résout un gabarit Forumactif : les blocs d'abord, les variables
 *  ensuite.
 *
 *  Le moteur de Forumactif rend le VIDE pour une variable qu'il ne sait
 *  pas résoudre. On fait pareil, et c'est important : c'est comme ça
 *  qu'on voit qu'une variable mal préfixée ne sert à rien. */
function resoudre(gabarit) {
  let s = gabarit;

  //  Les blocs, du plus intérieur au plus extérieur : on résout en
  //  boucle jusqu'à ce qu'il n'en reste plus.
  for (let garde = 0; garde < 50; garde += 1) {
    //  Un bloc SANS autre bloc dedans : c'est celui qu'on peut résoudre
    //  sans risque.
    const m = s.match(
      /<!--\s*BEGIN (\w+)\s*-->((?:(?!<!--\s*(?:BEGIN|END)\s)[\s\S])*?)<!--\s*END \1\s*-->/,
    );
    if (m === null) break;
    const [tout, nom, dedans] = m;
    const n = BLOCS[nom];
    if (n === undefined) throw new Error(`bloc inconnu dans le gabarit : ${nom}`);
    s = s.replace(tout, dedans.repeat(n));
  }
  if (/<!--\s*BEGIN /.test(s)) throw new Error("des blocs n'ont pas été résolus");

  //  LE jQUERY DU GABARIT S'EN VA. Il n'y a pas de jQuery sur une page
  //  de harnais, et le charger pour trois lignes de code ferait
  //  dépendre le test d'un CDN. Son effet — le bouton de repli ajouté
  //  au `.header` — est reproduit par `poserLeBouton`, qui cite le
  //  code d'origine.
  s = s.replace(/<script[\s\S]*?<\/script>/g, "");

  //  Les variables. Tout ce qui reste en `{…}` rend le vide, comme
  //  Forumactif.
  return s.replace(/\{([\w.]+)\}/g, (_, nom) => VARS[nom] ?? "");
}

/** Ce que fait le jQuery du gabarit, lignes 164-167 :
 *
 *      $(btn_collapse).clone().attr('id', 'forabg' + i)
 *                     .appendTo($(this).find('.header'));
 *
 *  On le reproduit plutôt que de charger jQuery : le bouton de repli
 *  doit être ALIGNÉ avec le titre de l'en-tête, et c'est ça qu'on
 *  mesure. Le `.header` d'un `.forabg`, c'est le `li.header`. */
const BOUTON = `<div class="btn-collapse" id="forabg0">
  <i class="ion-android-add-circle hidden"></i><i class="ion-android-remove-circle"></i>
</div>`;

function poserLeBouton(html) {
  return html.replace("</dl>\n\t\t\t\t\t</li>", `</dl>${BOUTON}</li>`)
    .replace(/(<li class="header">[\s\S]*?<\/dl>)/, `$1${BOUTON}`);
}

/** Le `.statistics` de l'index : le module « qui est en ligne » le lit,
 *  et sans lui il se tait. Ici il n'intéresse personne, mais sa
 *  présence évite un décor à moitié réel. */
const STATS = `
<div class="statistics"><div class="wrap">
  <div class="statistics-item">Nos membres ont posté un total de <strong>436</strong> messages</div>
  <div class="statistics-item">Nous avons <strong>3</strong> membres enregistrés</div>
  <div class="statistics-item">L'utilisateur enregistré le plus récent est <strong><a href="/u4">Compte de test</a></strong></div>
</div></div>`;

/*  ── CE QUE MODERNBB IMPOSE, ET QU'ON NE SERVAIT PAS ───────────────
 *
 *  « Je vois l'image mais elle est toute petite », 9 octobre : la
 *  photo du bandeau était dessinée en 33 × 33 au milieu d'une bande de
 *  1326. La cause est dans `11-ltr.css`, le CSS de base de Forumactif,
 *  qu'on ne possède pas :
 *
 *      dl.icon { background-size: 33px 33px !important }
 *
 *  Un `!important` d'une feuille qu'on ne possède pas bat tout — même
 *  un style en ligne, vérifié dans le navigateur.
 *
 *  AUCUN HARNAIS NE POUVAIT L'ATTRAPER : ils servent notre feuille
 *  seule. On sert donc ici les déclarations de la base dont on sait
 *  qu'elles se battent avec les nôtres, AVANT la nôtre et avec leur
 *  `!important`. La liste est courte et elle grandira à mesure qu'on
 *  en trouve.
 *
 *  Le vrai remède : verser `11-ltr.css` dans le dépôt et le servir en
 *  entier. 233 Ko, à exporter depuis le panneau d'administration. */
const BASE_MODERNBB = `
dl.icon { background-size: 33px 33px !important; }
`;

const page = (corps) =>
  `<!doctype html><html lang="fr"><head><meta charset="utf-8">
<style>${BASE_MODERNBB}</style>
<style>${readFileSync(R + "panneau-admin/jetons.css", "utf8")}</style>
<style>${readFileSync(R + "css/wild-mystery.css", "utf8")}</style>
<style>body{margin:0;background:var(--wm-fond-page)}#page-body{padding:24px}</style>
</head><body id="modernbb"><div id="page-body">
${corps}
${STATS}
</div></body></html>`;

const ANCIEN = poserLeBouton(resoudre(readFileSync(R + "templates/index_box.html", "utf8")));
const NOUVEAU = poserLeBouton(
  resoudre(readFileSync(R + "templates/index_box.nouveau.html", "utf8")),
);

// ── le harnais ──────────────────────────────────────────────────────

const nav = await chromium.launch(CHROME === undefined ? {} : { executablePath: CHROME });
const soucis = [];
const dire = (nom, ok, detail = "") => {
  console.log(`${ok ? "  ok  " : "DÉFAUT"} ${nom}${detail ? " — " + detail : ""}`);
  if (!ok) soucis.push(nom + (detail ? " — " + detail : ""));
};

/** Ouvre un décor, avec ou sans le paquet. */
async function ouvrir(corps, { avecScript = true } = {}) {
  const p = await nav.newPage({ viewport: { width: 1440, height: 1200 } });
  p.on("pageerror", (e) => soucis.push("erreur JS : " + e.message));
  await p.route("**/*", (r) => {
    const u = r.request().url();
    if (u.endsWith("/js/wild-mystery.js")) {
      return r.fulfill({
        contentType: "text/javascript",
        body: readFileSync(R + "js/wild-mystery.js", "utf8"),
      });
    }
    if (/\/data\/\w|\.json$/.test(u)) return r.fulfill({ status: 404, body: "" });
    return r.fulfill({ contentType: "text/html; charset=utf-8", body: page(corps) });
  });
  await p.goto("http://wild-mystery.test/");
  if (avecScript) await p.addScriptTag({ url: "http://wild-mystery.test/js/wild-mystery.js" });
  await p.waitForTimeout(400);
  return p;
}

/** Tout ce qu'on veut savoir d'une ligne de forum, mesuré. */
const MESURER = () => {
  const r = (s) => {
    const e = document.querySelector(s);
    if (e === null) return null;
    const b = e.getBoundingClientRect();
    return {
      x: Math.round(b.x),
      y: Math.round(b.y),
      w: Math.round(b.width),
      h: Math.round(b.height),
    };
  };
  const ligne = document.querySelector("li.row");
  const titre = document.querySelector("li.header .table-title h2");
  const desc = document.querySelector("li.row .wm-forum__description");
  const sujets = document.querySelector("li.row dd.topics");
  const messages = document.querySelector("li.row dd.posts");
  const s = (e) => (e === null ? null : getComputedStyle(e));
  return {
    pastille: r("li.row .wm-pastille"),
    pastilleImg: r("li.row .wm-pastille img"),
    //  LE FOND EN LIGNE NE DOIT PLUS ÊTRE LÀ : avec le gabarit neuf il
    //  n'y a jamais été, avec l'ancien le script l'efface.
    fondEnLigne: /url\(/.test(
      document.querySelector("li.row dl.icon")?.getAttribute("style") ?? "",
    ),
    avatar: r("li.row .lastpost-avatar"),
    //  La description défile, le titre et les sous-forums NON.
    descOverflow: s(desc)?.overflowY ?? null,
    descHauteur: desc === null ? null : Math.round(desc.getBoundingClientRect().height),
    titreOverflow: s(document.querySelector("li.row a.forumtitle"))?.overflowY ?? null,
    sousForumsOverflow: s(document.querySelector("li.row .wm-sous-forums"))?.overflowY ?? null,
    //  Les virgules entre sous-forums sont parties, et les liens sont
    //  regroupés.
    //  SUR LA PREMIÈRE LIGNE SEULEMENT : le décor en sert trois, et
    //  compter les trois répondrait « neuf sous-forums » à la question
    //  « combien par ligne ».
    sousForums: ligne === null
      ? 0
      : ligne.querySelectorAll(".wm-sous-forums a.wm-sous-forum").length,
    virgules: (ligne?.querySelector(".wm-sous-forums")?.textContent ?? "").includes(","),
    //  Le `<strong></strong>` vide que la variable mal préfixée laissait
    //  traîner en fin de ligne.
    strongVides: ligne === null ? 0 : [...ligne.querySelectorAll("dd.dterm strong")]
      .filter((e) => (e.textContent ?? "").trim() === "").length,
    //  L'écart entre le compteur de sujets et celui de messages.
    ecartCompteurs: sujets === null || messages === null ? null : Math.round(
      messages.getBoundingClientRect().top - sujets.getBoundingClientRect().bottom,
    ),
    //  Le bouton de repli, aligné avec le titre de l'en-tête.
    bouton: r(".btn-collapse"),
    titreEnTete: titre === null ? null : {
      ...r("li.header .table-title h2"),
      police: s(titre).fontFamily,
      taille: s(titre).fontSize,
    },
    //  Les trois lignes du dernier message, recomposées.
    dernier: {
      date: document.querySelector("li.row .wm-dernier__date")?.textContent.trim() ?? null,
      qui: document.querySelector("li.row .wm-dernier__qui")?.textContent.trim() ?? null,
      fleche: document.querySelector("li.row .wm-dernier__qui .last-post-icon") !== null,
    },
    //  ── LE VOILE NE DOIT PAS NOYER LA PHOTO ─────────────────────
    //
    //  « Où est le bandeau de fond de l'en-tête ? » Il y était, sous
    //  un voile de 48 à 72 %. La photo de Rhode a une luminance de
    //  0,111 ; sous 72 % de `fond-nuit` elle tombait à 0,048 et son
    //  relief passait de (0,191 · 0,055) à (0,071 · 0,033). Un
    //  rectangle brun.
    //
    //  On garde donc la MAIN sur la couche de devant : son opacité
    //  doit rester sous 20 %. Ce qui protège le texte, c'est l'ombre
    //  portée, pas le voile — et on vérifie qu'elle est là.
    bandeau: (() => {
      const e = document.querySelector("li.header dl.icon");
      if (e === null) return null;
      const s = getComputedStyle(e);
      const fond = s.backgroundImage;
      //  TOUT CE QUI EST AVANT `url(` EST DEVANT LA PHOTO. On ne
      //  découpe pas sur les virgules : un dégradé en contient, et
      //  découper là rendait « linear-gradient(100deg » comme
      //  première couche — sans alpha, donc sans rien à mesurer. Le
      //  harnais disait alors `null` et laissait passer n'importe quel
      //  voile, ce qui est la panne exacte qu'il doit attraper.
      const devant = fond.slice(0, fond.indexOf("url("));
      const alphas = [...devant.matchAll(/\/\s*([0-9.]+)\s*\)/g)].map((m) => Number(m[1]));
      const titre = document.querySelector("li.header .table-title h2");
      return {
        aLaPhoto: /url\(/.test(fond),
        couchesDevant: alphas.length,
        voileMax: alphas.length === 0 ? null : Math.max(...alphas),
        taille: s.backgroundSize.split(",")[0].trim(),
        ombreDuTitre: titre === null ? null : getComputedStyle(titre).textShadow,
        hauteur: Math.round(e.getBoundingClientRect().height),
      };
    })(),
    rang: document.querySelector("li.header dl.icon")?.dataset.wmRang ?? null,
    lignes: document.querySelectorAll("li.row").length,
    hauteurLigne: ligne === null ? null : Math.round(ligne.getBoundingClientRect().height),
    debord: document.documentElement.scrollWidth > document.documentElement.clientWidth,
  };
};

// ── 1 · l'ancien gabarit, avec le script : l'état d'aujourd'hui ─────
const p1 = await ouvrir(ANCIEN);
const avant = await p1.evaluate(MESURER);
dire(
  "L'ANCIEN GABARIT + LE SCRIPT DONNE TROIS LIGNES",
  avant.lignes === 3,
  JSON.stringify({
    lignes: avant.lignes,
    hauteur: avant.hauteurLigne,
  }),
);
dire(
  "la pastille fait 48, l'image 36",
  avant.pastille?.w === 48 && avant.pastilleImg?.w === 36,
  JSON.stringify({ pastille: avant.pastille, img: avant.pastilleImg }),
);
dire("le fond en ligne a été effacé par le script", avant.fondEnLigne === false);
dire(
  "l'avatar du dernier posteur fait 44 × 70",
  avant.avatar?.w === 44 && avant.avatar?.h === 70,
  JSON.stringify(avant.avatar),
);
dire(
  "SEULE LA DESCRIPTION DÉFILE",
  avant.descOverflow === "auto" && avant.titreOverflow !== "auto" &&
    avant.sousForumsOverflow !== "auto",
  JSON.stringify({
    desc: avant.descOverflow,
    titre: avant.titreOverflow,
    sous: avant.sousForumsOverflow,
  }),
);
dire(
  "les trois sous-forums sont en pastilles, sans virgule",
  avant.sousForums === 3 && avant.virgules === false,
  JSON.stringify({ n: avant.sousForums, virgules: avant.virgules }),
);
dire(
  "le titre de l'en-tête est en Nunito Sans",
  /Nunito/.test(avant.titreEnTete?.police ?? ""),
  avant.titreEnTete?.police,
);
dire(
  "le bouton de repli est aligné avec le titre de l'en-tête",
  avant.bouton !== null && avant.titreEnTete !== null &&
    Math.abs(
        (avant.bouton.y + avant.bouton.h / 2) - (avant.titreEnTete.y + avant.titreEnTete.h / 2),
      ) <= 4 &&
    avant.bouton.x > 0,
  JSON.stringify({ bouton: avant.bouton, titre: avant.titreEnTete }),
);
dire(
  "les deux compteurs se touchent presque",
  avant.ecartCompteurs !== null && avant.ecartCompteurs <= 6,
  `${avant.ecartCompteurs} px`,
);
dire(
  "LE DERNIER MESSAGE EST RECOMPOSÉ EN TROIS LIGNES",
  avant.dernier.date === "Mar 2 Avr 2024 - 18:42" && avant.dernier.qui === "Invité" &&
    avant.dernier.fleche === true,
  JSON.stringify(avant.dernier),
);
dire("la bande porte son rang sur deux chiffres", avant.rang === "01", avant.rang);
dire(
  "LE BANDEAU EST DANS LA BANDE, ET LE VOILE NE LE NOIE PAS",
  avant.bandeau?.aLaPhoto === true && avant.bandeau?.voileMax !== null &&
    avant.bandeau.voileMax <= 0.2,
  JSON.stringify(avant.bandeau),
);
dire(
  "ET LA PHOTO N'EST PAS RÉDUITE À 33 PX PAR LA BASE DE MODERNBB",
  avant.bandeau?.taille === "cover",
  avant.bandeau?.taille,
);
dire(
  "et le titre porte l'ombre qui remplace le voile",
  (avant.bandeau?.ombreDuTitre ?? "none") !== "none",
  avant.bandeau?.ombreDuTitre,
);
dire("rien ne déborde", avant.debord === false);
//  LE `<strong></strong>` VIDE EST LÀ, dans l'ancien : c'est la
//  variable mal préfixée. On le constate, pour pouvoir montrer qu'il
//  disparaît.
dire(
  "et l'ancien gabarit laisse bien un <strong> vide en fin de ligne",
  avant.strongVides >= 1,
  `${avant.strongVides}`,
);
await p1.close();

// ── 2 · LE GABARIT NEUF, SANS LE SCRIPT ─────────────────────────────
//
//  C'est la question : ce que le script fabriquait, le gabarit le
//  donne-t-il de naissance ? Pastille, description enveloppée, pas de
//  fond en ligne. Ce qui RESTE au script — le rang, les virgules, le
//  dernier message — doit manquer ici, et c'est normal.
const p2 = await ouvrir(NOUVEAU, { avecScript: false });
const nu = await p2.evaluate(MESURER);
dire(
  "LE GABARIT NEUF DONNE LA PASTILLE SANS LE SCRIPT",
  nu.pastille?.w === 48 && nu.pastilleImg?.w === 36,
  JSON.stringify({ pastille: nu.pastille, img: nu.pastilleImg }),
);
dire("et il n'a aucun fond en ligne à effacer", nu.fondEnLigne === false);
dire(
  "LA DESCRIPTION EST ENVELOPPÉE DE NAISSANCE, ET SEULE ELLE DÉFILE",
  nu.descOverflow === "auto" && nu.titreOverflow !== "auto",
  JSON.stringify({ desc: nu.descOverflow, titre: nu.titreOverflow }),
);
dire("LE <strong> VIDE A DISPARU", nu.strongVides === 0, `${nu.strongVides}`);
dire(
  "l'avatar du dernier posteur fait toujours 44 × 70",
  nu.avatar?.w === 44 && nu.avatar?.h === 70,
  JSON.stringify(nu.avatar),
);
dire("rien ne déborde", nu.debord === false);
await p2.close();

// ── 3 · LE GABARIT NEUF, AVEC LE SCRIPT : LE MÊME RENDU ─────────────
//
//  Le script doit se taire là où le gabarit a déjà fait le travail
//  (il est idempotent) et faire le reste. Le résultat doit être
//  IDENTIQUE à celui de l'ancien gabarit + script, mesure par mesure :
//  c'est ça qui autorise à poser le gabarit.
const p3 = await ouvrir(NOUVEAU);
const apres = await p3.evaluate(MESURER);

const COMPARER = [
  "pastille",
  "pastilleImg",
  "avatar",
  "descOverflow",
  "sousForums",
  "virgules",
  "ecartCompteurs",
  "rang",
  "lignes",
  "hauteurLigne",
  "dernier",
];
const ecarts = COMPARER.filter((c) => JSON.stringify(avant[c]) !== JSON.stringify(apres[c]))
  .map((c) => `${c} : ${JSON.stringify(avant[c])} → ${JSON.stringify(apres[c])}`);
dire(
  "LE GABARIT NEUF + LE SCRIPT REND EXACTEMENT COMME L'ANCIEN",
  ecarts.length === 0,
  ecarts.join(" · "),
);
dire(
  "une seule pastille par ligne, le script ne double pas",
  apres.pastille !== null && ecarts.length === 0,
);
dire("le <strong> vide reste parti", apres.strongVides === 0, `${apres.strongVides}`);
dire(
  "le dernier message est toujours recomposé",
  apres.dernier.date === "Mar 2 Avr 2024 - 18:42" && apres.dernier.fleche === true,
  JSON.stringify(apres.dernier),
);

// ── 4 · rien ne déborde, à toutes les largeurs ──────────────────────
for (const [l, h] of [[1440, 1200], [900, 900], [390, 844]]) {
  await p3.setViewportSize({ width: l, height: h });
  await p3.waitForTimeout(150);
  const d = await p3.evaluate(() => ({
    debord: document.documentElement.scrollWidth > document.documentElement.clientWidth,
    desc: Math.round(
      document.querySelector("li.row .wm-forum__description")?.getBoundingClientRect().width ??
        0,
    ),
  }));
  dire(`à ${l} px, rien ne déborde`, !d.debord, JSON.stringify(d));
  dire(`à ${l} px, la description a une largeur`, d.desc > 0, `${d.desc} px`);
}
await p3.close();

await nav.close();
if (soucis.length > 0) { for (const s of soucis) console.log("  · " + s); }
console.log(soucis.length === 0 ? "\nTOUT PASSE." : `\n${soucis.length} DÉFAUT(S).`);
Deno.exit(soucis.length === 0 ? 0 : 1);
