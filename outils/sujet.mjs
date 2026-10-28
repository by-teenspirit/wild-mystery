// ════════════════════════════════════════════════════════════════════
//  outils/sujet.mjs — la page d'un sujet, montée dans un navigateur
//
//  Lancement : `deno task sujet`
//
//  ── POURQUOI CE HARNAIS EXISTE ─────────────────────────────────────
//
//  Les 27 et 28 octobre, trois choses ont été corrigées sur la page
//  d'un sujet : le corps du message qui passait SOUS le profil, les
//  211 px de vide à sa droite, et le trait bleu de ModernBB. Les trois
//  reposaient sur des mesures prises à la main dans le navigateur de
//  Callista — rien ne les retenait.
//
//  C'est ce que ce fichier répare. Il monte le VRAI `viewtopic_body`
//  de ModernBB, avec deux messages, et mesure ce qui avait été corrigé
//  à l'œil. La maquette `305:24` n'est pas encore codée : quand elle le
//  sera, ses vérifications viendront ici.
//
//  ── CE QU'IL NE FAIT PAS ───────────────────────────────────────────
//
//  Il ne monte pas le JavaScript : la page d'un sujet n'a pas encore de
//  module à elle. Le jour où `mod-sujet` existera — l'encart de
//  rencontre, le récapitulatif de clôture —, il faudra le servir ici
//  comme `zone.mjs` sert `wild-mystery.js`.
// ════════════════════════════════════════════════════════════════════

import { readFileSync } from "node:fs";
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

/** Répète le contenu d'un bloc autant de fois qu'on a de données. */
function repeteBloc(s, nom, combien) {
  const re = new RegExp(`<!--\\s*BEGIN ${nom}\\s*-->([\\s\\S]*?)<!--\\s*END ${nom}\\s*-->`);
  const m = s.match(re);
  if (m === null) return s;
  return s.replace(re, Array.from({ length: combien }, () => m[1]).join("\n"));
}

/*  LES COMMENTAIRES DE DOCUMENTATION PARTENT AVANT TOUT REMPLACEMENT.
    Le piège est connu et il a coûté deux jours : Forumactif remplace
    ses variables JUSQUE DANS LES COMMENTAIRES — relevé sur `/f2` le 28
    octobre, où un commentaire du gabarit citait `{BOARD_INDEX}` et le
    moteur l'a rendu, refermant le commentaire et déversant le texte
    dans la page. Ici, un gabarit qui se documente ferait pareil. On ne
    garde que les commentaires qui portent un marqueur BEGIN/END. */
function sansCommentaires(s) {
  return s.replace(
    /<!--([\s\S]*?)-->/g,
    (tout, dedans) => /\b(BEGIN|END) \w/.test(dedans) ? tout : "",
  );
}

const vars = (s, table) => s.replace(/\{([\w.]+)\}/g, (_, n) => table[n] ?? "");

//  ── DEUX MESSAGES, ET POURQUOI DEUX ────────────────────────────────
//
//  Un seul ne montre pas le filet qui les sépare, ni qu'un corps court
//  et un corps long se comportent pareil. Le second est volontairement
//  bref : c'est le cas qui faisait passer le texte sous le profil, le
//  profil étant plus haut que le message.
const MESSAGES = [
  {
    auteur: "Maître du Jeu",
    date: "Jeu 12 Aoû 2021 - 10:59",
    corps: "<p>Un premier message assez long pour que son corps dépasse la hauteur " +
      "du profil, et qu'on voie la colonne de gauche s'arrêter avant lui.</p>" +
      "<p>Un second paragraphe, pour la même raison.</p>",
    signature: "— une signature",
  },
  {
    auteur: "Compte de test",
    date: "Dim 5 Sep 2021 - 9:56",
    //  COURT EXPRÈS. C'est ce cas-là qui cassait : le profil fait
    //  211 px de large et plusieurs centaines de haut ; un message de
    //  deux lignes passait dessous au lieu de se mettre à côté.
    corps: "<p>Deux lignes, pas plus.</p>",
    signature: "",
  },
];

/*  ── LE FIL D'ARIANE DÉCIDE DU BANDEAU ─────────────────────────────

    « Le bandeau : actif que dans les zones sauvages, pas actif sur les
    autres », 28 octobre. Sur une page de sujet, le module ne connaît
    le forum que par le fil d'Ariane : son dernier maillon en `/fN-`.
    Le harnais sert donc deux fils — un qui mène à une zone de
    `zones.json`, un qui mène ailleurs — et vérifie que le bandeau
    suit. */
const ARIANE_ZONE = '<a class="nav" href="/c2-zones-sauvages"><span>Zones Sauvages</span></a>' +
  ' :: <a class="nav" href="/f96-zones-palier-1"><span>Zones Palier 1</span></a>' +
  ' :: <a class="nav" href="/f34-montagnes-embrumees"><span>Montagnes Embrumées</span></a>';

const ARIANE_HORS_ZONE = '<a class="nav" href="/c1-le-forum"><span>Le forum</span></a>' +
  ' :: <a class="nav" href="/f2-notice-d-utilisation"><span>Notice d\'utilisation</span></a>';

function pageDeSujet({ ariane = ARIANE_ZONE } = {}) {
  //  ON MONTE LE GABARIT QU'ON VA PUBLIER, pas celui qui tourne.
  //  `viewtopic_body.html` est le code actuel du forum : il sert de
  //  témoin, mais un harnais qui le monte ne teste jamais ce qu'on
  //  s'apprête à mettre en ligne. C'est `.nouveau.html` qui porte la
  //  fiche du dresseur de la maquette `305:24` — les champs enveloppés,
  //  la grille de l'équipe — et c'est lui qui part sur le forum.
  let t = sansCommentaires(
    readFileSync(R + "templates/viewtopic_body.nouveau.html", "utf8"),
  );

  //  Ce qu'on garde : la boucle des messages, la signature, la
  //  pagination, la surveillance du sujet, l'état connecté.
  t = repeteBloc(t, "postrow", MESSAGES.length);
  t = gardeBloc(t, "displayed");
  t = gardeBloc(t, "switch_signature");
  t = gardeBloc(t, "switch_user_logged_in");
  t = gardeBloc(t, "switch_user_authreply");
  t = gardeBloc(t, "topicpagination");
  t = gardeBloc(t, "watchtopic");
  t = gardeBloc(t, "first_post_br");

  //  Ce qu'on retire : tout ce que le forum n'emploie pas, et qui
  //  n'apporterait que du bruit à la mesure.
  for (
    const b of [
      "hidden",
      "switch_vote",
      "switch_vote_active",
      "switch_vote_plus",
      "switch_vote_minus",
      "switch_likes_active",
      "switch_like_list",
      "switch_dislike_button",
      "switch_dislike_list",
      "switch_no_comment",
      "switch_attachments",
      "switch_post_attachments",
      "switch_dl_att",
      "switch_no_dl_att",
      "switch_forum_rules",
      "switch_forum_rule_image",
      "switch_image_resize",
      "switch_isconnect",
      "switch_plus_menu",
      "switch_push_direct_send",
      "switch_bar",
      "switch_no_bar",
      "promot_trafic",
      "link",
      "contact_field",
      "show_permissions",
      "viewtopic_bottom",
      "switch_user_authnoreply",
      "switch_user_authpost",
    ]
  ) t = sansBloc(t, b);

  //  ── LES CHAMPS DE PROFIL, TROIS PAR MESSAGE ──────────────────────
  //
  //  La maquette `305:24` en montre trois, reliés par un ressort
  //  pointillé — et « les champs viennent de forumactif », 28 octobre :
  //  c'est le panneau qui décide lesquels. Le décor en sert donc trois,
  //  de longueurs très différentes : un ressort qui ne s'étire pas se
  //  verrait seulement sur une valeur courte à côté d'une longue.
  //
  //  Forumactif sert l'étiquette AVEC ses deux-points et parfois un
  //  `<span class="label">` autour — on reproduit les deux formes.
  const CHAMPS = [
    { cle: `<span class="label">Niveau :</span>`, valeur: "24" },
    { cle: "Badges :", valeur: "3" },
    { cle: `<span class="label">Argent :</span>`, valeur: "12 480 ₽" },
  ];
  //  La boucle des messages est déjà dépliée : le bloc des champs
  //  existe donc une fois PAR MESSAGE, et `repeteBloc` n'en traite
  //  qu'une. On le rappelle tant qu'il en reste.
  while (/<!--\s*BEGIN profile_field\s*-->/.test(t)) {
    t = repeteBloc(t, "profile_field", CHAMPS.length);
  }
  let c = 0;
  t = t.replace(
    /\{postrow\.displayed\.profile_field\.(LABEL|CONTENT|SEPARATOR)\}/g,
    (_, nom) => {
      const champ = CHAMPS[c % CHAMPS.length];
      if (nom === "LABEL") return champ.cle;
      if (nom === "SEPARATOR") return "<br />";
      c++;
      return champ.valeur;
    },
  );

  //  Les deux messages, un par passage de la boucle.
  let i = 0;
  t = t.replace(/\{postrow\.displayed\.([\w]+)\}/g, (_, nom) => {
    const m = MESSAGES[Math.min(i, MESSAGES.length - 1)];
    if (nom === "POSTER_NAME") return m.auteur;
    if (nom === "POST_DATE_NEW") return m.date;
    if (nom === "MESSAGE") {
      const html = m.corps;
      //  La dernière variable du message ferme le tour de boucle.
      i++;
      return html;
    }
    if (nom === "SIGNATURE_NEW") return m.signature;
    if (nom === "POSTER_AVATAR") {
      //  `{POSTER_AVATAR}` ARRIVE EN `<img>` TOUT FAIT — note de code
      //  de la maquette `305:315`. Le décor le sert donc ainsi, avec
      //  les dimensions que Forumactif y met.
      return `<img src="${PIXEL}" alt="avatar" style="max-width:200px;max-height:320px" />`;
    }
    if (nom === "U_POST_ID") return String(15500 + i);
    if (nom === "POSTER_ID") return "3";
    if (nom === "POST_URL") return "/t10-un-sujet#15500";
    if (nom === "POSTER_RPG") return "";
    return "";
  });

  //  ── LES SCRIPTS DE FORUMACTIF NE TOURNENT PAS ICI ──────────────
  //
  //  Le gabarit en porte plusieurs, écrits en jQuery 1.7.2 — celui que
  //  Forumactif charge sur ses pages. Ici il n'y en a pas, et chacun
  //  lève « $ is not defined » : du bruit qui noierait une vraie
  //  erreur de page. On mesure une mise en page, pas les scripts de
  //  Forumactif, qui ont leur propre place dans `barre.mjs`.
  t = t.replace(/<script[\s\S]*?<\/script>/g, "");

  return vars(t, {
    NAV_CAT_DESC: ariane,
    TOPIC_ID: "10",
    TOPIC_TITLE: "Règlement et disclaimer",
    PAGINATION: "<span>Page <strong>1</strong> sur 1</span>",
    L_POST_REPLY_TOPIC: "Répondre",
    U_POST_REPLY_TOPIC: "/post?t=10&mode=reply",
    L_VIEW_PREVIOUS_TOPIC: "Sujet précédent",
    L_VIEW_NEXT_TOPIC: "Sujet suivant",
    U_VIEW_OLDER_TOPIC: "/t9-x",
    U_VIEW_NEWER_TOPIC: "/t11-x",
    L_GO: "Ok",
  });
}

/*  LA FEUILLE DE MODERNBB, RÉDUITE À CE QUI PIÈGE.
    `margin-right: 211px` sur `.postbody` est la règle qui réservait la
    place d'un profil à DROITE — une mise en page que ModernBB propose
    et que le forum n'utilise pas. Sans elle ici, le harnais ne peut pas
    voir le vide que Callista a signalé le 27 octobre. Le trait bleu
    sous les `.h3` est au même titre : c'est celui de ModernBB. */
const BASE_MODERNBB = `
/*  box-sizing: border-box partout, comme ModernBB. Sans lui, le
    profil mesurait 239 px au lieu de 211 — sa largeur plus ses deux
    rembourrages — et le harnais accusait notre regle au lieu de son
    propre decor. */
*, *::before, *::after { box-sizing: border-box; }
.postbody { margin-right: 211px; padding: 12px 18px 18px; }
.h3 { border-bottom: 1px solid #3793ff; }
h1.page-title { border-bottom: 1px solid #3793ff; }
.post { display: flex; flex-wrap: wrap; }
.post-head { order: -1; }
`;

const page = (corps) =>
  `<!doctype html><html lang="fr"><head><meta charset="utf-8">
<style>${BASE_MODERNBB}</style>
<style>${readFileSync(R + "panneau-admin/jetons.css", "utf8")}</style>
<style>${readFileSync(R + "css/wild-mystery.css", "utf8")}</style>
<style>html,body{margin:0}body{background:var(--wm-fond-page)}</style>
</head><body id="modernbb">
<div class="conteneur_minwidth_IE modern-resp">
<div id="page-body"><div class="wrap">${corps}</div></div>
</div>
</body></html>`;

// ── le navigateur ───────────────────────────────────────────────────

const nav = await chromium.launch(CHROME === undefined ? {} : { executablePath: CHROME });
const soucis = [];

function dire(nom, ok, detail = "") {
  console.log(`  ${ok ? "ok  " : "DÉFAUT"} ${nom}${detail === "" ? "" : " — " + detail}`);
  if (!ok) soucis.push(nom + (detail === "" ? "" : " — " + detail));
}

const p = await nav.newPage({ viewport: { width: 1440, height: 900 } });
p.on("pageerror", (e) => soucis.push("erreur JS : " + e.message));
await p.setContent(page(pageDeSujet()), { waitUntil: "load" });

console.log("\n── la page d'un sujet ──");

const releve = await p.evaluate(() => {
  const posts = [...document.querySelectorAll(".post")];
  const lire = (post) => {
    const profil = post.querySelector(".postprofile");
    const corps = post.querySelector(".postbody");
    if (profil === null || corps === null) return null;
    const a = profil.getBoundingClientRect();
    const b = corps.getBoundingClientRect();
    return {
      profilX: Math.round(a.x),
      profilLargeur: Math.round(a.width),
      corpsX: Math.round(b.x),
      corpsLargeur: Math.round(b.width),
      //  MÊME BANDE HORIZONTALE : si le corps est passé sous le profil,
      //  son haut tombe sous le bas du profil.
      cote: Math.round(b.y) < Math.round(a.y + a.height),
      margeDroite: getComputedStyle(corps).marginRight,
      posteX: Math.round(post.getBoundingClientRect().x),
      //  LA LARGEUR UTILE, pas la largeur totale : le message a ses
      //  propres rembourrages, et les deux colonnes se partagent ce
      //  qui reste. Comparer à la largeur totale accuserait les
      //  colonnes du rembourrage du parent.
      posteLargeur: Math.round(
        post.getBoundingClientRect().width -
          parseFloat(getComputedStyle(post).paddingLeft) -
          parseFloat(getComputedStyle(post).paddingRight),
      ),
    };
  };
  return {
    combien: posts.length,
    messages: posts.map(lire),
    //  Le trait bleu de ModernBB, sur les deux porteurs connus.
    traits: [...document.querySelectorAll(".h3, h1.page-title")]
      .map((e) => getComputedStyle(e).borderBottomWidth),
  };
});

dire("LES DEUX MESSAGES SONT MONTÉS", releve.combien === 2, `${releve.combien} message(s)`);

for (const [i, m] of releve.messages.entries()) {
  const court = i === 1 ? " (le message court)" : "";
  dire(
    `LE CORPS DU MESSAGE ${i + 1} EST À DROITE DU PROFIL, PAS DESSOUS${court}`,
    m !== null && m.cote && m.corpsX > m.profilX,
    m === null ? "profil ou corps absent" : `profil à ${m.profilX}, corps à ${m.corpsX}`,
  );
  dire(
    `et il n'a plus les 211 px de vide à sa droite`,
    m !== null && m.margeDroite === "0px",
    `margin-right : ${m?.margeDroite}`,
  );
  dire(
    `le profil garde sa colonne et le corps prend largement le reste`,
    //  PAS UNE ADDITION EXACTE. Entre les deux colonnes, ModernBB
    //  intercale des nœuds qu'on ne maîtrise pas — c'est vrai dans ce
    //  décor comme sur le forum, où 250 px de la ligne appartenaient
    //  déjà à autre chose. On vérifie donc ce qui compte vraiment : le
    //  profil tient sa colonne fixe, et le corps est large, pas une
    //  seconde colonne étroite.
    //  PAS « TROIS FOIS LE PROFIL » : ce rapport valait pour une
    //  colonne de 211, il est devenu faux à 236 sans que la mise en
    //  page change — un seuil qui dépend de la chose qu'il mesure ne
    //  prouve rien. La maquette donne 236 et 762 dans 998, soit 76 % de
    //  la largeur utile pour le corps. On exige les deux tiers.
    m !== null && m.profilLargeur === 236 &&
      m.corpsLargeur >= m.posteLargeur * 0.65,
    `profil ${m?.profilLargeur} · corps ${m?.corpsLargeur} · ${m?.posteLargeur} utiles`,
  );
}

dire(
  "AUCUN TRAIT BLEU DE MODERNBB NE SURVIT",
  releve.traits.every((t) => t === "0px"),
  `${releve.traits.length} titre(s) : ${[...new Set(releve.traits)].join(" · ")}`,
);

//  ── LA TÊTE DU SUJET, MAQUETTE 305:24 ─────────────────────────────

const tete = await p.evaluate(() => {
  const r = (s) => {
    const e = document.querySelector(s);
    if (e === null) return null;
    const b = e.getBoundingClientRect();
    return { y: Math.round(b.y), h: Math.round(b.height), l: Math.round(b.width) };
  };
  const avatar = document.querySelector(".post .postprofile-avatar img");
  const rang = document.querySelector(".post .postprofile-rank");
  return {
    ariane: r(".sub-header-path"),
    diag: (() => {
      const info = document.querySelector(".sub-header-info");
      const sh = document.querySelector(".sub-header");
      return {
        display: info === null ? null : getComputedStyle(info).display,
        ordreFil: getComputedStyle(document.querySelector(".sub-header-path")).order,
        ordreTitre: getComputedStyle(document.querySelector("h1.page-title")).order,
        freres: sh === null
          ? null
          : [...sh.parentElement.children].map((e) => e.className.split(/\s+/)[0]).slice(0, 6),
      };
    })(),
    titre: r("h1.page-title"),
    avatar: avatar === null ? null : {
      l: Math.round(avatar.getBoundingClientRect().width),
      h: Math.round(avatar.getBoundingClientRect().height),
    },
    rang: rang === null ? null : {
      display: getComputedStyle(rang).display,
      rayon: getComputedStyle(rang).borderTopLeftRadius,
      h: Math.round(rang.getBoundingClientRect().height),
    },
  };
});

dire(
  "LE FIL D'ARIANE EST AU-DESSUS DU TITRE, COMME LA MAQUETTE",
  //  Le gabarit sert le titre d'abord et le fil ensuite ; la maquette
  //  met le fil à y = 24 et la tête à y = 60. C'est `order` qui
  //  corrige, sans déplacer un seul nœud — une page sans JavaScript a
  //  donc la même tête.
  tete.ariane !== null && tete.titre !== null &&
    tete.ariane.y < tete.titre.y,
  JSON.stringify({ ariane: tete.ariane, titre: tete.titre, diag: tete.diag }),
);

dire(
  "L'AVATAR EST UN PORTRAIT DE 200 × 320",
  //  Maquette `305:115`, un rectangle arrondi. Sans hauteur imposée,
  //  une image carrée donnerait un avatar carré et la colonne
  //  sauterait d'un message à l'autre.
  tete.avatar !== null && tete.avatar.l === 200 && tete.avatar.h === 320,
  JSON.stringify(tete.avatar),
);

dire(
  "LE RANG EST UNE PASTILLE ARRONDIE DE 21 px",
  //  Maquette `305:119` : 77 × 21, arrondie, sous le pseudo. On fait
  //  du rang de ModernBB cette pastille au lieu d'en ajouter une.
  tete.rang !== null && tete.rang.display === "inline-flex" &&
    tete.rang.rayon === "999px" && tete.rang.h >= 21,
  JSON.stringify(tete.rang),
);

//  ── LA FICHE DU DRESSEUR, D'APRÈS LA MAQUETTE 305:24 ───────────────

const fiche = await p.evaluate(() => {
  //  LE PREMIER MESSAGE SEULEMENT. Le décor en monte deux, et compter
  //  sur toute la page mélangerait les deux fiches.
  const un = document.querySelector(".post");
  const champs = [...un.querySelectorAll(".wm-profil__champ")];
  const lireChamp = (ch) => {
    const cle = ch.querySelector(".wm-profil__cle");
    const val = ch.querySelector(".wm-profil__valeur");
    if (cle === null || val === null) return null;
    const a = cle.getBoundingClientRect();
    const b = val.getBoundingClientRect();
    const st = getComputedStyle(ch, "::before");
    return {
      //  LE RESSORT. Il doit exister, être pointillé, et OCCUPER l'écart
      //  entre les deux — c'est tout l'intérêt : sans lui, la valeur
      //  collerait à l'étiquette ou flotterait sans lien avec elle.
      style: st.borderBottomStyle,
      ecart: Math.round(b.x - a.right),
      //  Les deux sur la même ligne, et la valeur à droite.
      memeLigne: Math.abs(Math.round(a.y) - Math.round(b.y)) <= 4,
      valeurADroite: Math.round(b.x) > Math.round(a.right),
      //  Et la valeur touche le bord droit de la colonne, sinon le
      //  ressort n'a rien tendu.
      colleADroite: Math.round(
        ch.getBoundingClientRect().right - b.right,
      ) <= 1,
    };
  };

  const cases = [...un.querySelectorAll(".wm-profil__case")];
  const boites = cases.map((c) => {
    const r = c.getBoundingClientRect();
    return { l: Math.round(r.width), h: Math.round(r.height), y: Math.round(r.y) };
  });
  //  TROIS PAR RANG : on compte les ordonnées distinctes.
  const rangs = [...new Set(boites.map((b) => b.y))];

  return {
    combien: champs.length,
    champs: champs.map(lireChamp),
    cases: boites.length,
    casesVues: boites.filter((b) => b.l === 56 && b.h === 56).length,
    rangs: rangs.length,
    parRang: rangs.map((y) => boites.filter((b) => b.y === y).length),
    colonne: Math.round(un.querySelector(".postprofile").getBoundingClientRect().width),
  };
});

//  ── LE BANDEAU DU CORPS ────────────────────────────────────────────

const bandeau = await p.evaluate(() => {
  const un = document.querySelector(".post");
  const corps = un.querySelector(".wm-post-corps");
  const tete = un.querySelector(".post-head");
  const date = un.querySelector(".topic-date");
  const actions = un.querySelector(".menu-wrap");
  const titre = un.querySelector(".topic-title");
  if ([corps, tete, date, actions, titre].some((e) => e === null)) return null;
  const r = (e) => e.getBoundingClientRect();
  return {
    //  LE CORPS EST UNE COLONNE, et la tête est dedans — c'est ce que
    //  le gabarit republié change, et ce qui se déferait en silence le
    //  jour où quelqu'un remet la tête en frère du profil.
    teteDansLeCorps: corps.contains(tete),
    //  ON LIT `display` AUTANT QUE `flex-direction` : la seconde garde
    //  sa valeur même sur une boîte qui n'est plus en flex. Testée
    //  seule, elle disait « column » sur un `display: block` — un test
    //  qui ne pouvait pas échouer.
    affichage: getComputedStyle(corps).display,
    sens: getComputedStyle(corps).flexDirection,
    //  LA DATE À GAUCHE, LES ACTIONS COLLÉES À DROITE, sur une ligne.
    //  ON COMPARE LES MILIEUX, PAS LES HAUTS : `align-items: center`
    //  aligne deux boîtes de hauteurs différentes sur leur centre, donc
    //  leurs bords hauts ne coïncident jamais. Comparer les `y` ferait
    //  échouer le test sur un alignement correct.
    memeLigne: Math.abs(
      Math.round(r(date).y + r(date).height / 2) -
        Math.round(r(actions).y + r(actions).height / 2),
    ) <= 6,
    milieux: [
      Math.round(r(date).y + r(date).height / 2),
      Math.round(r(actions).y + r(actions).height / 2),
    ],
    actionsADroite: Math.round(r(actions).right) >= Math.round(r(tete).right) - 1,
    dateAGauche: Math.round(r(date).x) <= Math.round(r(tete).x) + 1,
    //  ET LE TITRE EN DESSOUS, pas coincé entre les deux.
    titreDessous: Math.round(r(titre).y) >= Math.round(r(date).bottom),
    filet: getComputedStyle(tete).borderBottomWidth,
  };
});

dire(
  "LE CORPS DU MESSAGE EST UNE COLONNE, ET LE BANDEAU EST DEDANS",
  bandeau !== null && bandeau.teteDansLeCorps &&
    bandeau.affichage === "flex" && bandeau.sens === "column",
  JSON.stringify(bandeau),
);
dire(
  "LA DATE EST À GAUCHE, LES ACTIONS À DROITE, SUR LA MÊME LIGNE",
  bandeau !== null && bandeau.memeLigne && bandeau.dateAGauche &&
    bandeau.actionsADroite && bandeau.titreDessous,
  JSON.stringify(bandeau),
);

dire(
  "LES TROIS CHAMPS DU PROFIL SONT MONTÉS",
  fiche.combien === 3,
  `${fiche.combien} champ(s)`,
);

for (const [i, ch] of fiche.champs.entries()) {
  dire(
    `LE CHAMP ${i + 1} A SON RESSORT POINTILLÉ, TENDU D'UN BORD À L'AUTRE`,
    ch !== null && ch.style === "dotted" && ch.memeLigne &&
      ch.valeurADroite && ch.colleADroite && ch.ecart >= 10,
    JSON.stringify(ch),
  );
}

dire(
  "L'ÉQUIPE MONTRE SIX CASES VIDES DE 56 px, TROIS PAR RANG",
  //  « Des cases vides quand il n'en a aucun », 28 octobre. Le décor ne
  //  sert aucun sprite — c'est exactement le cas qu'elle a décidé.
  fiche.cases === 6 && fiche.casesVues === 6 && fiche.rangs === 2 &&
    fiche.parRang.every((n) => n === 3),
  `${fiche.casesVues}/${fiche.cases} à 56 px · ${fiche.rangs} rang(s) de ${
    fiche.parRang.join("+")
  } · colonne ${fiche.colonne}`,
);

//  ── LES COTES DE LA FICHE, MAQUETTE 305:24 ─────────────────────────

const fiche2 = await p.evaluate(() => {
  const un = document.querySelector(".post");
  const r = (s) => {
    const e = un.querySelector(s);
    if (e === null) return null;
    const b = e.getBoundingClientRect();
    return { l: Math.round(b.width), h: Math.round(b.height) };
  };
  const cases = [...un.querySelectorAll(".wm-profil__case")].map((c) =>
    Math.round(c.getBoundingClientRect().x)
  );
  const rang = cases.filter((x) => x === cases[0] || x > cases[0]).slice(0, 3);
  return {
    avatar: r(".postprofile-avatar img"),
    rang: r(".postprofile-rank"),
    bande: document.querySelector(".wm-sujet__section .wm-forum__bande-titre")
      ?.textContent ?? null,
    //  L'ÉCART ENTRE DEUX CASES D'UN MÊME RANG : 56 de case, 8 d'écart.
    ecartCases: rang.length < 2 ? null : rang[1] - rang[0] - 56,
    libelleCentre: (() => {
      const l = un.querySelector(".postprofile-equipe .wm-profil__cle");
      return l === null ? null : getComputedStyle(l).textAlign;
    })(),
  };
});

dire(
  "L'AVATAR EST UN PORTRAIT DE 200 × 320",
  fiche2.avatar !== null && fiche2.avatar.l === 200 && fiche2.avatar.h === 320,
  JSON.stringify(fiche2.avatar),
);
dire(
  "LE RANG EST UNE PASTILLE DE 21 px",
  fiche2.rang !== null && fiche2.rang.h === 21,
  JSON.stringify(fiche2.rang),
);
dire(
  "LA SECTION PORTE SON BANDEAU « LES MESSAGES »",
  fiche2.bande === "LES MESSAGES",
  JSON.stringify(fiche2.bande),
);
dire(
  "et les cases de l'équipe sont espacées de 8, le libellé centré",
  fiche2.ecartCases === 8 && fiche2.libelleCentre === "center",
  JSON.stringify(fiche2),
);

//  ── LA BARRE D'ACTIONS ─────────────────────────────────────────────

const actions = await p.evaluate(() => {
  const barre = document.querySelector(".wm-sujet__actions");
  if (barre === null) return null;
  const boutons = barre.querySelector(".wm-sujet__boutons");
  const pages = barre.querySelector(".pagination");
  if (boutons === null || pages === null) return null;
  const r = (e) => e.getBoundingClientRect();
  return {
    //  LES BOUTONS À GAUCHE, LA PAGINATION COLLÉE À DROITE.
    boutonsAGauche: Math.round(r(boutons).x) <= Math.round(r(barre).x) + 1,
    pagesADroite: Math.round(r(pages).right) >= Math.round(r(barre).right) - 1,
    memeLigne: Math.abs(
      Math.round(r(boutons).y + r(boutons).height / 2) -
        Math.round(r(pages).y + r(pages).height / 2),
    ) <= 6,
    //  ET LES BOUTONS SONT BIEN DESCENDUS DE LA TÊTE DE PAGE.
    plusDansLaTete: document.querySelector(".sub-header-buttons") === null,
    combien: boutons.querySelectorAll("a").length,
  };
});

dire(
  "LES BOUTONS SONT DESCENDUS DANS LA BARRE D'ACTIONS",
  actions !== null && actions.plusDansLaTete && actions.combien >= 1,
  JSON.stringify(actions),
);
dire(
  "et la pagination est collée à droite, sur la même ligne",
  actions !== null && actions.boutonsAGauche && actions.pagesADroite &&
    actions.memeLigne,
  JSON.stringify(actions),
);

//  ── LE BANDEAU, ET SEULEMENT DANS LES ZONES SAUVAGES ───────────────
//
//  « Actif que dans les zones sauvages, pas actif sur les autres », 28
//  octobre. Ces deux pages-là montent le VRAI paquet et les VRAIES
//  données : c'est `zones.json` qui décide, et une règle qu'on
//  vérifierait sur un décor inventé ne prouverait rien.

async function monterAvecScript(ariane) {
  const q = await nav.newPage({ viewport: { width: 1440, height: 900 } });
  q.on("pageerror", (e) => soucis.push("erreur JS : " + e.message));
  await q.route("**/*", (route) => {
    const chemin = new URL(route.request().url()).pathname;
    if (chemin === "/js/wild-mystery.js") {
      return route.fulfill({
        contentType: "text/javascript; charset=utf-8",
        body: readFileSync(R + "js/wild-mystery.js", "utf8"),
      });
    }
    if (chemin.startsWith("/data/")) {
      try {
        return route.fulfill({
          contentType: "application/json",
          body: readFileSync(R + chemin.slice(1), "utf8"),
        });
      } catch {
        return route.fulfill({ status: 404, body: "" });
      }
    }
    //  Les photos de zone vivent sur GitHub Pages : un pixel suffit, ce
    //  n'est pas l'image qu'on mesure.
    if (/\.(jpg|jpeg|png|gif|webp)$/.test(chemin)) {
      return route.fulfill({
        contentType: "image/svg+xml",
        body: '<svg xmlns="http://www.w3.org/2000/svg" width="4" height="4"></svg>',
      });
    }
    return route.fulfill({
      contentType: "text/html; charset=utf-8",
      body: page(pageDeSujet({ ariane })),
    });
  });
  await q.goto("https://exemple.test/t10-un-sujet");
  await q.evaluate(() => {
    const s = document.createElement("script");
    s.src = "https://exemple.test/js/wild-mystery.js";
    document.body.appendChild(s);
  });
  await q.waitForTimeout(900);
  return q;
}

const dansUneZone = await monterAvecScript(ARIANE_ZONE);
const leBandeau = await dansUneZone.evaluate(() => {
  const b = document.querySelector(".wm-zone");
  if (b === null) return null;
  const r = b.getBoundingClientRect();
  return {
    sujet: b.classList.contains("wm-zone--sujet"),
    zone: b.dataset.wmZone,
    h: Math.round(r.height),
    //  VISIBLE POUR DE VRAI : une hauteur calculée ne dit rien d'un
    //  élément dont un parent est en `display: none`.
    visible: b.offsetParent !== null && r.height > 0,
    titre: b.querySelector(".wm-zone__titre")?.textContent ?? null,
  };
});
dire(
  "DANS UNE ZONE SAUVAGE, LE SUJET A SON BANDEAU",
  leBandeau !== null && leBandeau.visible && leBandeau.zone === "34" &&
    leBandeau.titre === "Montagnes Embrumées",
  JSON.stringify(leBandeau),
);
dire(
  "et il est plus court que celui d'une zone : 300 et pas 460",
  leBandeau !== null && leBandeau.sujet && leBandeau.h === 300,
  JSON.stringify(leBandeau),
);
await dansUneZone.close();

const horsZone = await monterAvecScript(ARIANE_HORS_ZONE);
const rien = await horsZone.evaluate(() => ({
  bandeau: document.querySelector(".wm-zone") !== null,
  //  ET LA PAGE RESTE ENTIÈRE : pas de bandeau ne veut pas dire page
  //  abîmée. Le titre et les messages sont toujours là.
  titre: document.querySelector("h1.page-title")?.textContent?.trim() ?? null,
  messages: document.querySelectorAll(".post .postbody").length,
}));
dire(
  "HORS D'UNE ZONE SAUVAGE, AUCUN BANDEAU",
  //  `/f2-notice-d-utilisation` n'est pas dans `zones.json` : ni sa
  //  liste de sujets ni ses sujets n'ont de bandeau.
  rien.bandeau === false && rien.messages === 2,
  JSON.stringify(rien),
);
await horsZone.close();

await p.close();
await nav.close();

if (soucis.length > 0) console.log("\n-- ce qui reste --\n" + soucis.join("\n"));
console.log(
  soucis.length === 0 ? "\nTOUT PASSE." : `\n${soucis.length} DÉFAUT(S).`,
);
if (soucis.length > 0) Deno.exit(1);
