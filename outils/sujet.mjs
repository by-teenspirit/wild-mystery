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

function pageDeSujet() {
  let t = sansCommentaires(readFileSync(R + "templates/viewtopic_body.html", "utf8"));

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
      "profile_field",
      "contact_field",
      "show_permissions",
      "viewtopic_bottom",
      "switch_user_authnoreply",
      "switch_user_authpost",
    ]
  ) t = sansBloc(t, b);

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
    m !== null && m.profilLargeur === 211 && m.corpsLargeur > m.profilLargeur * 3,
    `profil ${m?.profilLargeur} · corps ${m?.corpsLargeur} · ${m?.posteLargeur} utiles`,
  );
}

dire(
  "AUCUN TRAIT BLEU DE MODERNBB NE SURVIT",
  releve.traits.every((t) => t === "0px"),
  `${releve.traits.length} titre(s) : ${[...new Set(releve.traits)].join(" · ")}`,
);

await p.close();
await nav.close();

if (soucis.length > 0) console.log("\n-- ce qui reste --\n" + soucis.join("\n"));
console.log(
  soucis.length === 0 ? "\nTOUT PASSE." : `\n${soucis.length} DÉFAUT(S).`,
);
if (soucis.length > 0) Deno.exit(1);
