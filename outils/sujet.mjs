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
    //  ── QUEL FICHIER ON MONTE ────────────────────────────────────
    //
    //  Le commenté par défaut, celui du dépôt. Mais ce qu'on COLLE
    //  dans le panneau est sa version nettoyée (`deno task a-publier`),
    //  et un harnais qui ne mesure pas ce qu'on met en ligne ne
    //  mesure rien — c'est déjà pour ça qu'il était passé de
    //  `viewtopic_body.html` à `.nouveau.html` le 29 octobre.
    //
    //      deno task sujet --publiable
    //
    //  monte le fichier nettoyé. Les deux doivent passer : si le
    //  nettoyage casse quelque chose, c'est ici qu'on le voit, et pas
    //  sur le forum.
    readFileSync(
      R +
        (Deno.args.includes("--publiable")
          ? "templates/viewtopic_body.a-publier.html"
          : "templates/viewtopic_body.nouveau.html"),
      "utf8",
    ),
  );

  //  Ce qu'on garde : la boucle des messages, la signature, la
  //  pagination, la surveillance du sujet, l'état connecté.
  t = repeteBloc(t, "postrow", MESSAGES.length);
  t = gardeBloc(t, "displayed");
  t = gardeBloc(t, "switch_signature");
  t = gardeBloc(t, "switch_user_logged_in");
  t = gardeBloc(t, "switch_user_authreply");
  //  ET « NOUVEAU », depuis le 30 octobre au soir : « je veux juste
  //  Nouveau, Répondre ». Le décor n'en servait qu'un, donc un
  //  contrôle qui compte deux boutons n'aurait jamais pu passer.
  t = gardeBloc(t, "switch_user_authpost");
  t = gardeBloc(t, "topicpagination");
  //  LE BAS DU SUJET. On le gardait hors du décor, et le § 13 de la
  //  feuille n'était donc testé par rien — relevé le 30 octobre, en
  //  faisant le point sur la maquette : zéro bloc monté.
  t = gardeBloc(t, "show_permissions");
  //  LES « J'AIME ». Montés depuis le 30 octobre : ils sont dans le
  //  bandeau maintenant, et une règle qui les y place ne se vérifie pas
  //  sur un bloc absent. Le bouton « je n'aime pas » monte avec : deux
  //  pastilles côte à côte sont le cas qui serre le plus le bandeau.
  t = gardeBloc(t, "switch_likes_active");
  t = gardeBloc(t, "switch_dislike_button");
  //  LES LIENS DU BAS DU PROFIL, gardés depuis le 30 octobre.
  t = gardeBloc(t, "contact_field");
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
      "switch_like_list",
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
      "show_permissions",
      "viewtopic_bottom",
      "switch_user_authnoreply",
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

  //  LE CHAMP DE CONTACT : un seul, servi une fois par message. Il
  //  arrive en HTML tout fait, comme les trois autres liens.
  while (/<!--\s*BEGIN contact_field\s*-->/.test(t)) {
    t = repeteBloc(t, "contact_field", 1);
  }
  t = t.replace(
    /\{postrow\.displayed\.contact_field\.CONTENT\}/g,
    `<a href="https://exemple.test/site"><i class="ion-link" title="Site"></i></a>`,
  );

  //  ── LES « J'AIME » ────────────────────────────────────────────────
  //
  //  Leurs variables sont IMBRIQUÉES — `postrow.displayed.
  //  switch_likes_active.L_LIKE` — et la passe générale ne lit que les
  //  noms d'un seul segment. Elles ont donc leur tour, avant.
  //
  //  Le compteur suit les messages dans l'ordre du document : le bloc
  //  des « j'aime » est dans le bandeau, donc une fois par message et
  //  avant son texte. Le PREMIER message est voté, le second non : les
  //  deux états du bouton sont ainsi mesurés sur la même page.
  let j = -1;
  t = t.replace(
    /\{postrow\.displayed\.switch_likes_active\.(?:switch_dislike_button\.)?([\w]+)\}/g,
    (_, nom) => {
      //  `C_VOTE_LIKE` ouvre le bloc d'un message : c'est lui qui fait
      //  avancer le compteur.
      if (nom === "C_VOTE_LIKE") {
        j++;
        return j === 0 ? "voted" : "";
      }
      if (nom === "L_LIKE") return "J'aime";
      if (nom === "L_DISLIKE") return "Je n'aime pas";
      if (nom === "COUNT_VOTE_LIKE") return j === 0 ? "3" : "0";
      if (nom === "COUNT_VOTE_DISLIKE") return "0";
      if (nom === "C_VOTE_DISLIKE") return "";
      //  Les URL de vote : le harnais ne clique pas, mais un attribut
      //  vide se lit mal dans une capture.
      return "/post?p=1&mode=vote";
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
    //  EN LIGNE OU NON. Forumactif rend une CLASSE, collée à celles
    //  du message : ` online` quand le posteur est connecté, vide
    //  sinon. Le décor met le premier en ligne et laisse le second
    //  hors ligne — la pastille doit tenir dans les deux cas.
    if (nom === "ONLINE_IMG_NEW") return i === 0 ? " online" : "";
    if (nom === "U_POST_ID") return String(15500 + i);
    if (nom === "POSTER_ID") return "3";
    if (nom === "POST_URL") return "/t10-un-sujet#15500";
    //  ── LA FEUILLE DE PERSONNAGE ET LES RÉCOMPENSES ──────────────
    //
    //  CE QUI EST SÛR : les deux arrivent en UNE variable chacune,
    //  déjà mise en forme par Forumactif, et le gabarit les pose dans
    //  des conteneurs à nous (`.wm-profil__panneau`) et dans ceux de
    //  ModernBB (`.dd_award`, `.award_more`) — c'est le gabarit qui le
    //  dit, pas une supposition.
    //
    //  CE QUI NE L'EST PAS : le balisage DEDANS. Forumactif sert la
    //  feuille en paires étiquette/valeur à plat, et les récompenses
    //  en vignettes ; les classes intermédiaires n'ont pas été
    //  relevées sur le forum — Chrome ne répond plus depuis le 29.
    //  Le décor en sert donc une forme plausible, et la feuille ne
    //  vise QUE les conteneurs sûrs et `img`. À revérifier sur
    //  `/t976` quand le navigateur revient.
    if (nom === "POSTER_RPG") {
      return [
        `<span class="label">Palier :</span> 2<br />`,
        `<span class="label">Clan :</span> Deoxys<br />`,
        `<span class="label">Starter :</span> Ouisticram<br />`,
        `<span class="label">Métier :</span> paléontologue au musée de Pyrite<br />`,
        `<span class="label">Âge :</span> 24 ans<br />`,
        `<span class="label">Caractère :</span> têtue, patiente, mauvaise perdante<br />`,
      ].join("");
    }
    if (nom === "AWARDS") {
      //  Onze badges : les sept arènes et les quatre colosseums. Assez
      //  pour que le panneau déborde — c'est tout l'objet du test.
      return Array.from(
        { length: 11 },
        (_, n) => `<a href="#"><img src="${PIXEL}" alt="badge ${n + 1}" /></a>`,
      ).join("");
    }
    if (nom === "AWARDS_SHOW") return "";
    //  ── LES LIENS DU BAS DU PROFIL ────────────────────────────────
    //
    //  CE QU'ON NE SAIT PAS : sous quelle forme Forumactif les sert.
    //  ModernBB rend tantôt une icône de fonte (`<i class="ion-…">`),
    //  tantôt une petite image — ça dépend du réglage « icônes ou
    //  texte » du panneau, et le forum n'a pas pu être relevé depuis
    //  le 29, Chrome ne répondant plus.
    //
    //  Le décor sert donc LES DEUX FORMES dans la même colonne : la
    //  règle doit tenir pour l'une comme pour l'autre, sinon elle ne
    //  tient pour aucune des deux.
    if (nom === "PROFILE_IMG") {
      return `<a href="/u3" rel="nofollow"><img src="${PIXEL}" alt="Voir le profil" /></a>`;
    }
    if (nom === "PM_IMG") {
      return `<a href="/privmsg?mode=post&u=3"><i class="ion-email" title="Message privé"></i></a>`;
    }
    //  L'e-mail est souvent coupé au panneau : la colonne doit tenir
    //  avec un lien en moins.
    if (nom === "EMAIL_IMG") return "";
    if (nom === "PROFILE_POSITION") return "left";
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
    //  ── LA RÉPONSE RAPIDE ──────────────────────────────────────────
    //
    //  `{QUICK_REPLY_FORM}` arrive TOUT FAIT de Forumactif, barre
    //  d'outils comprise, et seulement si le panneau l'a activée. Le
    //  décor en sert la seule chose dont la mise en page dépend :
    //  l'enveloppe `#quick_reply`, que la feuille recolle au bandeau
    //  de section. Ce qu'il y a dedans ne change rien à la jointure.
    QUICK_REPLY_FORM: `<form id="quick_reply" method="post"><fieldset>` +
      `<textarea rows="8" cols="60"></textarea>` +
      `<input type="submit" value="Envoyer" /></fieldset></form>`,
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

/*  ── LES ICONES DE MODERNBB, EN DOUBLURE ─────────────────────────
    ModernBB charge Ionicons et dessine chaque action avec. Le harnais
    ne charge aucune fonte : les <i class="ion-..."> y faisaient zero
    pixel, et la pastille des « j'aime » se reduisait a son nombre. Un
    decor qui ne reproduit pas ce que ModernBB sert ne teste que
    lui-meme — c'est la troisieme fois.

    On pose donc un carre de 14 a la place du glyphe. Ce qui est
    mesure ici, c'est la PLACE que l'icone prend, pas sa forme : le
    harnais ne sait rien du dessin d'Ionicons et ne pretend pas le
    savoir. */
[class^="ion-"], [class*=" ion-"] {
  display: inline-block;
  width: 14px; height: 14px;
  background: currentColor;
  border-radius: 2px;
  opacity: .55;
}
.postbody { margin-right: 211px; padding: 12px 18px 18px; }
/*  L'ESPACEMENT DES ICONES D'ACTION, comme ModernBB le pose. Sans
    lui, un <li> vide — celui du signalement, servi vide quand le
    lecteur ne peut pas signaler — ne coutait rien ici, et la regle
    qui le masque ne retenait aucun controle. Neuvieme fois qu'un
    decor incomplet ne teste que lui-meme. */
.profile-icons { display: flex; list-style: none; }
.profile-icons li { margin-left: 8px; }
.h3 { border-bottom: 1px solid #3793ff; }
h1.page-title { border-bottom: 1px solid #3793ff; }
.post { display: flex; flex-wrap: wrap; }
.post-head { order: -1; }

/*  LES 36 PX DE REMBOURRAGE DE MODERNBB. C'est eux qui poussaient
    chaque page vers le bas sous la bannière, et le décor ne les
    servait pas : une règle qui les réduit n'aurait rien eu à réduire
    ici. Quatrième fois qu'un décor incomplet teste autre chose que
    la page. */
#wrap { max-width: 1400px; margin: 0 auto; padding: 36px; }
.wrap { max-width: 1400px; margin: 0 auto; padding: 36px; }`;

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

// ── l'aperçu, pour juger le rendu sans le forum ─────────────────────
//
//  « Montre-moi ici à quoi ressemble l'affichage d'un sujet pour qu'on
//  avance plus vite », 30 octobre.
//
//      deno task apercu
//
//  écrit `apercu-sujet.html`, une page autonome : le gabarit monté, la
//  feuille entière, les données du harnais. On l'ouvre et on juge.
//
//  ELLE VIT DANS CE FICHIER-CI, et pas à côté. Un second script aurait
//  recopié tout le décor — les deux auraient divergé dès la première
//  correction, et l'aperçu aurait fini par montrer autre chose que ce
//  que le harnais mesure. C'est exactement le défaut qu'on a déjà payé
//  trois fois cette semaine.

if (Deno.args.includes("--apercu")) {
  //  LES ICÔNES, EN GLYPHES. Le harnais leur pose un carré de 14 px —
  //  il mesure la place, pas la forme. Pour l'œil, un carré gris ne
  //  dit rien : on met un caractère à la place. Ce ne sont PAS les
  //  icônes du forum, qui viennent d'Ionicons.
  const GLYPHES = `
.ion-thumbsup::before { content: "\\2191"; }
.ion-thumbsdown::before { content: "\\2193"; }
.ion-heart::before { content: "\\2665"; }
.ion-quote::before { content: "\\275D"; }
.ion-ios-plus-empty::before { content: "+"; }
.ion-edit::before { content: "\\270E"; }
.ion-trash-a::before { content: "\\2421"; }
.ion-ios-information::before { content: "i"; }
.ion-email::before { content: "\\2709"; }
.ion-link::before { content: "\\26AD"; }
[class^="ion-"], [class*=" ion-"] {
  background: none; border-radius: 0; opacity: 1;
  font-style: normal; font-size: 13px; line-height: 14px; text-align: center;
}`;

  const POLICES = '<link rel="preconnect" href="https://fonts.googleapis.com">' +
    '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>' +
    '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?' +
    "family=Fraunces:opsz,wght@9..144,400..700&" +
    "family=Nunito+Sans:opsz,wght@6..12,300..800&" +
    'family=Cormorant+Garamond:wght@400;600&display=swap">';

  const NOTE = `<div class="wm-apercu-note">
  <strong>Aperçu du gabarit, pas le forum.</strong> Les données sont celles du
  harnais : deux messages inventés, un avatar en dégradé, trois champs de
  profil, onze badges, une équipe vide. <strong>Les icônes sont des
  doublures</strong> — le forum charge Ionicons, qu'une page autonome ne va pas
  chercher. Les onglets du profil et les boutons marchent : clique.
</div>
<style>.wm-apercu-note{max-width:1200px;margin:0 auto 18px;padding:14px 18px;
border:1px dashed var(--wm-bord-net,#d9c3b1);border-radius:10px;
background:var(--wm-fond-surface,#fffbf7);color:var(--wm-texte-doux,#6e5749);
font:13px/1.5 var(--wm-police-corps,"Nunito Sans",system-ui,sans-serif)}
.wm-apercu-note strong{color:var(--wm-texte-corps,#4e3b30)}</style>`;

  const brut = `<!doctype html><html lang="fr"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Un sujet — Wild Mystery</title>
${POLICES}
<style>${BASE_MODERNBB}${GLYPHES}</style>
<style>${readFileSync(R + "panneau-admin/jetons.css", "utf8")}</style>
<style>${readFileSync(R + "css/wild-mystery.css", "utf8")}</style>
<style>html,body{margin:0}
body{background:var(--wm-fond-page);padding:18px 16px 40px}</style>
</head><body id="modernbb">
${NOTE}
<div class="conteneur_minwidth_IE modern-resp">
<div id="wrap"><div id="page-body">${pageDeSujet()}</div></div>
</div>
</body></html>`;

  //  UNE PAGE AUTONOME NE VA RIEN CHERCHER DEHORS. Le gabarit de
  //  ModernBB tire une feuille de highlight.js depuis un CDN et laisse
  //  des images de Forumactif derrière ses variables : le navigateur du
  //  lecteur les refuse, et la page se dessine de travers. On les
  //  retire plutôt que de montrer un faux rendu. Les polices de Google
  //  restent — sans elles, le rendu serait faux aussi.
  const propre = brut
    .replace(
      /<link(?![^>]*fonts\.(?:googleapis|gstatic)\.com)[^>]*href=["']?(?:https?:)?\/\/[^>]*>/g,
      "",
    )
    .replace(/<img[^>]*src=["']?(?:https?:)?\/\/[^>]*>/g, "");

  writeFileSync(R + "apercu-sujet.html", propre);
  console.log(`  apercu-sujet.html — ${propre.length} octets`);
  Deno.exit(0);
}

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

//  ── RIEN NE SE PERD ENTRE LE PROFIL ET LE CORPS ───────────────────
//
//  Le 28 octobre j'avais écrit un test « profil + corps = largeur
//  utile » et je l'ai retiré : il manquait 39 px que je ne savais pas
//  expliquer, et garder un chiffre qu'on ne comprend pas, c'est garder
//  un test qui ment. Le 30, la mesure a donné la réponse — l'ancre de
//  permalien, un enfant de flex d'un pixel qui prenait en plus un
//  écart entier. Le § 14 de la feuille la sort du flux, et le compte
//  tombe juste. Le test revient donc, et cette fois il s'explique.

const compte = await p.evaluate(() => {
  const post = document.querySelector(".post");
  const prof = post.querySelector(".postprofile");
  const col = post.querySelector(".wm-post-corps");
  if (prof === null || col === null) return null;
  const st = getComputedStyle(post);
  const l = (e) => e.getBoundingClientRect().width;
  const interieur = l(post) - parseFloat(st.paddingLeft) - parseFloat(st.paddingRight);
  const ecart = parseFloat(st.columnGap);
  return {
    interieur: Math.round(interieur),
    profil: Math.round(l(prof)),
    corps: Math.round(l(col)),
    ecart: Math.round(ecart),
    reste: Math.round(interieur - l(prof) - ecart - l(col)),
    //  L'ancre doit être hors du flux, sinon elle reprend son écart.
    ancre: (() => {
      const a = post.querySelector('div[style*="width: 1px"]:not([class])');
      return a === null ? "absente" : getComputedStyle(a).position;
    })(),
  };
});

dire(
  "RIEN NE SE PERD ENTRE LE PROFIL ET LE CORPS",
  compte !== null && Math.abs(compte.reste) <= 2 && compte.ancre === "absolute",
  JSON.stringify(compte),
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
    //  LE FIL D'ARIANE EST EN BAS DEPUIS LE 30 OCTOBRE AU SOIR.
    //  « En bas, le fil d'Ariane » : il n'est plus sous le titre, et
    //  `.sub-header-path` n'existe plus du tout — le premier jet de
    //  ce contrôle le cherchait encore et faisait tomber tout le
    //  harnais sur un `getComputedStyle(null)`.
    ariane: r(".wm-sujet__ariane"),
    filADroite: (() => {
      const f = document.querySelector(".wm-sujet__actions .wm-sujet__ariane");
      const b = document.querySelector(".wm-sujet__boutons");
      if (f === null || b === null) return null;
      //  ON MESURE LE RESSORT, pas le bord droit.
      //
      //  Deuxième jet. Le premier demandait seulement « après les
      //  boutons » : sans `margin-left: auto` le fil se colle au
      //  dernier bouton, ce qui est AUSSI « après », et le ressort
      //  passait pour une règle morte. Le second exigeait qu'il
      //  touche le bord droit de la barre — faux dès qu'il y a une
      //  pagination, qui vient après lui.
      //
      //  Ce qui distingue vraiment les deux états, c'est le VIDE
      //  entre le dernier bouton et le fil. Collé : quelques pixels
      //  de `gap`. Poussé : tout ce qui reste de la rangée.
      return Math.round(
        f.getBoundingClientRect().left - b.getBoundingClientRect().right,
      ) > 100;
    })(),
    dernierMessage: (() => {
      const posts = [...document.querySelectorAll(".post")];
      if (posts.length === 0) return null;
      const b = posts[posts.length - 1].getBoundingClientRect();
      return { bas: Math.round(b.bottom) };
    })(),
    //  LA BARRE DU HAUT NE PORTE PLUS QUE DEUX BOUTONS.
    barre: (() => {
      const barre = document.querySelector(".wm-sujet__actions");
      if (barre === null) return null;
      return {
        boutons: barre.querySelectorAll(".wm-sujet__boutons a").length,
        partagez: barre.querySelector(".topic-actions-buttons") !== null,
        titre: document.querySelector(".wm-sujet__tete h1") !== null,
      };
    })(),
    //  ET LE BANDEAU DE SECTION PORTE LE TITRE DU SUJET.
    bandeau: (() => {
      const t = document.querySelector(".wm-sujet__section .wm-forum__bande-titre");
      return t === null ? null : t.textContent.trim();
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
  "le fil d'Ariane est à droite, dans la barre, après les boutons",
  //  « Tu dois placer le fil d'Ariane à droite ici », 31 octobre. Il
  //  avait été descendu en bas de page la veille ; il remonte dans la
  //  rangée des deux boutons, poussé par le ressort.
  tete.ariane !== null && tete.barre !== null &&
    tete.ariane.y < 200 && tete.filADroite === true,
  JSON.stringify({ ariane: tete.ariane, aDroite: tete.filADroite }),
);

dire(
  "la barre du haut ne porte que Nouveau et Répondre",
  //  « Je veux juste : Nouveau, Répondre. Pas de Partagez, pas de
  //  plus. » Et plus de titre là-haut : il est descendu sur le
  //  bandeau de section.
  tete.barre !== null && tete.barre.boutons === 2 &&
    tete.barre.partagez === false && tete.barre.titre === false,
  JSON.stringify(tete.barre),
);

dire(
  "le bandeau de section porte le titre du sujet, et plus « LES MESSAGES »",
  tete.bandeau !== null && tete.bandeau.length > 0 &&
    tete.bandeau.toUpperCase().includes("LES MESSAGES") === false,
  JSON.stringify({ bandeau: tete.bandeau }),
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
//
//  LES CHAMPS SONT DANS UN ONGLET depuis le 30 octobre, et l'onglet
//  ouvert au chargement est « Fiche ». Un élément dans un panneau en
//  `display: none` n'a aucune boîte : toutes les mesures qui suivent
//  rendraient zéro, et le ressort pointillé passerait pour cassé.
//
//  On clique donc « Infos » — un VRAI clic, par le navigateur. Poser
//  `checked` en JavaScript change bien l'état du bouton, mais Blink
//  ne recalcule pas le style des frères-descendants : l'étiquette de
//  l'onglet gardait son fond d'avant. Un test qui ment dans ce sens
//  est pire que pas de test.
const ONGLET = (n) => `.post .postprofile .wm-profil__onglets label:nth-child(${n})`;
//  « Infos » est le PREMIER onglet depuis le 30 octobre, et celui qui
//  s'ouvre au chargement. On clique quand même : ça garantit que le
//  panneau est déplié au moment où on mesure, quel que soit l'onglet
//  coché par défaut demain.
await p.click(ONGLET(1));

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
      //  PLUS DE RESSORT. « Pas de ..... », 30 octobre au soir.
      //
      //  ON LIT `content`, PAS LA BORDURE. Un pseudo-élément annulé
      //  par `content: none` n'a aucune boîte, mais `getComputedStyle`
      //  rend quand même sa bordure déclarée : le premier jet de ce
      //  contrôle lisait `borderBottomStyle`, voyait « dotted » et
      //  accusait une règle qui marchait.
      style: st.content === "none" ? "none" : st.borderBottomStyle,
      ecart: Math.round(b.x - a.right),
      //  Les deux sur la même ligne, et la valeur à droite.
      memeLigne: Math.abs(Math.round(a.y) - Math.round(b.y)) <= 4,
      valeurADroite: Math.round(b.x) > Math.round(a.right),
      //  ET ELLE N'EST PAS ALIGNÉE À DROITE. « Tu ne dois pas aligner
      //  le contenu des champs à droite », 31 octobre. Le § 24 lui
      //  avait donné `text-align: right` ; sans le contrôle, la règle
      //  du § 25 qui le défait ne retenait rien.
      aligne: getComputedStyle(val).textAlign,
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
    dateAGauche: Math.round(r(date).x) <= Math.round(r(tete).x) + 1,
    //  LA RANGÉE SE TERMINE AU BORD. Le dernier bloc du bandeau, quel
    //  qu'il soit, touche le bord droit : sinon la bande a un vide à
    //  droite et les icônes flottent au milieu.
    finitAuBord: (() => {
      const dedans = [...tete.children].filter((e) => e.getBoundingClientRect().width > 0);
      const bout = Math.max(
        ...dedans.map((e) => Math.round(e.getBoundingClientRect().right)),
      );
      return bout >= Math.round(r(tete).right) - 1;
    })(),
    //  ET LE TITRE RÉPÉTÉ N'EST PLUS LÀ — retiré le 30 octobre.
    titreRetire: titre === null ||
      getComputedStyle(titre).display === "none",
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
  "LA DATE EST À GAUCHE, LE RESTE À DROITE, SUR LA MÊME LIGNE",
  //  ── CE CONTRÔLE A CHANGÉ D'INTENTION LE 30 OCTOBRE ─────────────
  //
  //  Il demandait `actionsADroite` — les icônes collées au bord — et
  //  `titreDessous`. Les deux sont tombés le même jour, et pas parce
  //  que la feuille a cassé :
  //
  //    · les votes passent APRÈS les icônes (« le like est placé
  //      bizarrement »), donc ce sont eux qui touchent le bord ;
  //    · le titre répété sous chaque message est retiré, donc il n'y
  //      a plus rien à mettre en dessous.
  //
  //  On réécrit l'intention au lieu d'affaiblir le contrôle : ce qui
  //  compte est que la date soit seule à gauche et que la rangée se
  //  termine AU BORD — par quoi que ce soit.
  bandeau !== null && bandeau.memeLigne && bandeau.dateAGauche &&
    bandeau.finitAuBord && bandeau.titreRetire,
  JSON.stringify(bandeau),
);

//  ── UNE ÉQUIPE DE QUATRE, COMME LA MAQUETTE ───────────────────────
//
//  Le décor sert six cases vides : c'est le cas décidé le 28 octobre,
//  et il est déjà testé. Mais la maquette `305:142` dessine QUATRE
//  pokémon, et son quatrième est centré sous le deuxième — la dernière
//  rangée incomplète se centre. On pose donc quatre sprites à la main,
//  comme `mod-sujet` le fera, et on mesure ce que le dessin promet.

const equipe = await p.evaluate(() => {
  const cases = [...document.querySelectorAll(".post .wm-profil__case")].slice(0, 6);
  if (cases.length < 6) return null;
  //  Un pixel transparent suffit : on mesure des boîtes, pas des images.
  const pixel =
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";
  for (const c of cases.slice(0, 4)) {
    const img = document.createElement("img");
    img.src = pixel;
    img.alt = "";
    c.appendChild(img);
  }
  const boite = (e) => {
    const r = e.getBoundingClientRect();
    return { x: Math.round(r.x), y: Math.round(r.y), l: Math.round(r.width) };
  };
  //  SEULEMENT CE QUI SE VOIT. Les cases vides en trop passent en
  //  `display: none` dès qu'une case est occupée : les compter
  //  donnerait trois rangées là où l'œil en voit deux.
  const b = cases.map(boite).filter((e) => e.l > 0);
  const rangs = [...new Set(b.map((e) => e.y))];
  const parRang = rangs.map((y) => b.filter((e) => e.y === y));
  //  AUCUNE CASE VISIBLE : l'équipe est cachée quelque part, dans un
  //  onglet replié par exemple. On le dit au lieu de lever une erreur
  //  sur une rangée vide — un harnais qui plante ne dit pas lequel de
  //  ses contrôles tombe.
  if (parRang.length === 0) return { affichees: 0, cachee: true };
  const conteneur = document.querySelector(".post .wm-profil__cases").getBoundingClientRect();
  const dernier = parRang[parRang.length - 1];
  const milieuDuRang = (r) => (r[0].x + r[r.length - 1].x + r[r.length - 1].l) / 2;
  return {
    affichees: b.length,
    rangs: rangs.length,
    tailles: parRang.map((r) => r.length),
    //  CENTRÉ : le milieu de la dernière rangée tombe sur celui du bloc.
    ecartAuCentre: Math.round(
      Math.abs(milieuDuRang(dernier) - (conteneur.x + conteneur.width / 2)),
    ),
    occupee: (() => {
      const c = cases[0];
      const st = getComputedStyle(c);
      return { bordure: st.borderTopColor, fond: st.backgroundColor };
    })(),
    //  Pour la case vide, on regarde un message SANS équipe : dans
    //  celui-ci, les vides ont disparu, c'est tout l'objet de la règle.
    vide: (() => {
      const c = document.querySelectorAll(".post")[1]
        ?.querySelector(".wm-profil__case") ?? cases[5];
      const st = getComputedStyle(c);
      return { style: st.borderTopStyle, visible: st.borderTopColor !== "rgba(0, 0, 0, 0)" };
    })(),
  };
});

dire(
  "UNE ÉQUIPE DE QUATRE CENTRE SA DERNIÈRE RANGÉE",
  equipe !== null && equipe.affichees === 4 && equipe.rangs === 2 &&
    equipe.tailles[0] === 3 && equipe.tailles[1] === 1 &&
    equipe.ecartAuCentre <= 2,
  JSON.stringify(equipe),
);

dire(
  "UNE CASE OCCUPÉE N'A PLUS DE FILET, UNE CASE VIDE GARDE SON POINTILLÉ",
  equipe?.occupee?.bordure === "rgba(0, 0, 0, 0)" &&
    equipe?.vide?.style === "dashed" && equipe?.vide?.visible === true,
  JSON.stringify({ occupee: equipe?.occupee, vide: equipe?.vide }),
);

//  ── LE BAS DU SUJET ───────────────────────────────────────────────

const bas = await p.evaluate(() => {
  const b = document.querySelector("#info_open.wm-sujet__bas");
  if (b === null) return null;
  const carte = b.querySelector(".block");
  const titre = b.querySelector(".h3");
  if (carte === null || titre === null) return { blocs: 0 };
  const c = getComputedStyle(carte);
  return {
    blocs: b.querySelectorAll(".block").length,
    fond: c.backgroundColor,
    fondPage: getComputedStyle(document.body).backgroundColor,
    bordure: c.borderTopWidth,
    rayon: c.borderTopLeftRadius,
    titreCasse: getComputedStyle(titre).textTransform,
    titreFilet: getComputedStyle(titre).borderBottomWidth,
  };
});

dire(
  "LE BAS DU SUJET EST UNE CARTE, PAS UN BLOC NU",
  //  Maquette `305:303`. Elle en dessine trois ; `viewtopic_body` n'a
  //  de variable que pour les permissions, donc il n'y en a qu'un —
  //  c'est dit dans le gabarit. Ce qui se teste, c'est qu'il ait la
  //  surface des autres encarts et son titre en étiquette.
  bas !== null && bas.blocs === 1 && bas.fond !== bas.fondPage &&
    parseFloat(bas.bordure) >= 1 && parseFloat(bas.rayon) >= 8 &&
    bas.titreCasse === "uppercase" && bas.titreFilet === "0px",
  JSON.stringify(bas),
);

dire(
  "LES TROIS CHAMPS DU PROFIL SONT MONTÉS",
  fiche.combien === 3,
  `${fiche.combien} champ(s)`,
);

for (const [i, ch] of fiche.champs.entries()) {
  dire(
    //  LE CHAMP COULE, IL N'EST PLUS EN COLONNES. « Tu ne dois pas
    //  aligner le contenu des champs à droite ou faire des
    //  colonnes », 31 octobre : le forum sert une clé qui porte déjà
    //  ses deux points, et la mettre en colonne creusait un trou au
    //  milieu d'une phrase de quatre mots. Plus de ressort pointillé
    //  non plus — « pas de ..... », la veille.
    `LE CHAMP ${i + 1} : la clé puis la valeur, à la suite, sans pointillé`,
    ch !== null && ch.style === "none" && ch.memeLigne &&
      ch.valeurADroite && ch.colleADroite === false && ch.ecart <= 6 &&
      ch.aligne === "left",
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
  "LA SECTION PORTE LE TITRE DU SUJET",
  //  « À la place de "les messages", le titre du sujet », 30 octobre
  //  au soir. Le bandeau annonçait ce qu'on voit déjà ; le titre dit
  //  de quoi on parle.
  typeof fiche2.bande === "string" && fiche2.bande.length > 0 &&
    fiche2.bande !== "LES MESSAGES",
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

//  ── « EN LIGNE », UNE PASTILLE VERTICALE À GAUCHE ──────────────────

const enLigne = await p.evaluate(() => {
  const messages = [...document.querySelectorAll(".post")];
  const connecte = messages.find((m) => m.classList.contains("online"));
  const absent = messages.find((m) => m.classList.contains("online") === false);
  if (connecte === undefined || absent === undefined) return null;
  const fiche = (m) => m.querySelector(".postprofile");
  //  LE JETON EST SUR LE MESSAGE, PLUS SUR LA FICHE. « Le coller à
  //  l'extérieur, le coller au fond blanc à gauche », 30 octobre au
  //  soir : il sort de la colonne et se pose contre le bord du
  //  message. La gouttière de 20 px rendue à la fiche repasse à 14.
  const st = getComputedStyle(connecte, "::before");
  const sansPastille = getComputedStyle(absent, "::before");
  const r = fiche(connecte).getBoundingClientRect();
  return {
    //  LA PASTILLE EXISTE SUR LE MESSAGE EN LIGNE, et seulement là.
    mot: st.content,
    chezLAbsent: sansPastille.content,
    //  VERTICALE, et dans le bon sens.
    sens: st.writingMode,
    //  COLLÉ AU BORD GAUCHE DU MESSAGE, pas dans une gouttière.
    aGauche: parseFloat(st.left) === 0,
    //  VERT, et c'est demandé : « un jeton vert avec une petite
    //  pastille ».
    vert: (() => {
      const m = st.backgroundColor.match(/\d+/g);
      if (m === null) return false;
      const [r, v, b] = m.map(Number);
      return v > r && v > b;
    })(),
    //  ET SA PETITE PASTILLE, qui est le second pseudo-élément.
    pastille: getComputedStyle(connecte, "::after").content,
    pastilleRonde: getComputedStyle(connecte, "::after").borderTopLeftRadius,
    //  ET LA GOUTTIÈRE EST LA MÊME POUR LES DEUX : sinon la colonne
    //  saute d'un message à l'autre et on lit qui est connecté à la
    //  façon dont la page tremble.
    gouttiere: getComputedStyle(fiche(connecte)).paddingLeft,
    gouttiereAbsent: getComputedStyle(fiche(absent)).paddingLeft,
    memeLargeur: Math.round(r.width) ===
      Math.round(fiche(absent).getBoundingClientRect().width),
    //  L'AVATAR N'EST PAS RÉTRÉCI PAR LA GOUTTIÈRE.
    avatar: Math.round(
      connecte.querySelector(".postprofile-avatar img")
        .getBoundingClientRect().width,
    ),
  };
});

dire(
  "UN POSTEUR EN LIGNE PORTE SA PASTILLE, LES AUTRES NON",
  enLigne !== null && enLigne.mot.includes("EN LIGNE") &&
    enLigne.chezLAbsent === "none",
  JSON.stringify(enLigne),
);
dire(
  "c'est un jeton vert couché, lisible, collé au coin, avec sa pastille",
  //  « On arrive pas du tout à lire le "en ligne" », 31 octobre. Il
  //  était debout, écrit de bas en haut, dans deux pixels de large :
  //  personne n'incline la tête pour lire une étiquette de dix
  //  pixels. Il se couche.
  enLigne !== null && enLigne.sens === "horizontal-tb" &&
    enLigne.aGauche && enLigne.vert && enLigne.memeLargeur &&
    enLigne.pastille !== "none" && enLigne.pastilleRonde === "999px" &&
    enLigne.gouttiere === enLigne.gouttiereAbsent && enLigne.avatar === 200,
  JSON.stringify(enLigne),
);

//  ── LE CONTENU REMONTE SOUS LA BANNIÈRE ────────────────────────────
//
//  « Remonte tous les écrans plus près de la bannière », 30 octobre.
//  Le vide venait des 36 px de rembourrage que ModernBB met sur
//  `#wrap` — le même réglage qui décalait la bannière de 49 px vers
//  la droite. Le décor les sert maintenant, sinon la règle qui les
//  réduit n'aurait rien eu à réduire.

const hautDePage = await p.evaluate(() => {
  const wrap = document.querySelector("#wrap");
  const st = getComputedStyle(wrap);
  const premier = document.querySelector("#page-body > *");
  return {
    haut: st.paddingTop,
    //  LE BAS GARDE LES 36 DE MODERNBB : là, le vide sépare le
    //  dernier bloc du pied de page, et il a un travail.
    bas: st.paddingBottom,
    //  ET LE PREMIER BLOC EST BIEN REMONTÉ, pas seulement la règle.
    ecart: premier === null ? null : Math.round(
      premier.getBoundingClientRect().top - wrap.getBoundingClientRect().top,
    ),
  };
});

dire(
  "LE CONTENU COMMENCE À 16 DU HAUT, ET PLUS À 36",
  hautDePage.haut === "16px" && hautDePage.bas === "36px" &&
    hautDePage.ecart === 16,
  JSON.stringify(hautDePage),
);

//  ── LA TÊTE DU SUJET EST UNE CARTE ─────────────────────────────────
//
//  « J'aimerais bien que la partie du haut soit encadrée quand même
//  avec un fond, pas seulement dans le vide », 30 octobre. Écart
//  assumé avec la maquette, qui la pose à plat.

const carteDeTete = await p.evaluate(() => {
  const carte = document.querySelector(".wm-sujet__tete");
  if (carte === null) return null;
  const st = getComputedStyle(carte);
  const page = getComputedStyle(document.body).backgroundColor;
  const ariane = carte.querySelector(".sub-header-path");
  const titre = carte.querySelector("h1.page-title");
  const barre = carte.querySelector(".wm-sujet__actions");
  const bas = document.querySelector("#info_open.wm-sujet__bas > .block");
  const r = (e) => e.getBoundingClientRect();
  return {
    //  UNE CARTE : un fond À ELLE, un filet, un rayon.
    fond: st.backgroundColor,
    fondPage: page,
    seDetache: st.backgroundColor !== page,
    bordure: st.borderTopWidth,
    rayon: st.borderTopLeftRadius,
    //  LA MÊME RECETTE QUE LES AUTRES CARTES. Une carte qui se
    //  distingue des autres se lit comme une erreur.
    commeLeBas: bas === null ? null : (() => {
      const b = getComputedStyle(bas);
      return b.backgroundColor === st.backgroundColor &&
        b.borderTopWidth === st.borderTopWidth &&
        b.borderTopLeftRadius === st.borderTopLeftRadius;
    })(),
    //  LES TROIS BLOCS SONT DEDANS, et dans l'ordre de la maquette.
    contient: [ariane, titre, barre].every((e) => e !== null),
    ordre: ariane === null || titre === null || barre === null ? null : [
      Math.round(r(ariane).y),
      Math.round(r(titre).y),
      Math.round(r(barre).y),
    ],
    //  LA BARRE EST SÉPARÉE DU TITRE PAR UN FILET, et ne traîne pas
    //  une seconde marge à l'intérieur de la carte.
    filetBarre: barre === null ? null : getComputedStyle(barre).borderTopWidth,
    margeBarre: barre === null ? null : getComputedStyle(barre).marginBottom,
    //  ET LE RESSORT DU FIL S'ARRÊTE AU BORD DE LA CARTE, pas de la
    //  page : il doit rentrer dans le rembourrage.
    filDansLaCarte: ariane === null ? null : Math.round(r(ariane).right) <=
      Math.round(r(carte).right) - 1,
  };
});

dire(
  "LA TÊTE N'EST PLUS UNE CARTE : ni fond, ni bord, ni filet",
  //  « Enlève le fond blanc et les deux traits que tu as ajoutés »,
  //  31 octobre. La carte entourait le fil, le titre et la barre —
  //  trois blocs à tenir ensemble. Il n'en reste qu'un : un cadre
  //  autour d'une rangée de deux boutons est un cadre autour de rien.
  carteDeTete !== null &&
    carteDeTete.fond === "rgba(0, 0, 0, 0)" &&
    carteDeTete.bordure === "0px" &&
    carteDeTete.filetBarre === "0px",
  JSON.stringify(carteDeTete),
);

/*  LE FIL ET LE TITRE NE SONT PLUS DANS LA TÊTE, et le contrôle qui
    vérifiait qu'ils y étaient empilés dans l'ordre a été retiré, pas
    affaibli : il mesurait une mise en page qui n'existe plus. « Je
    veux juste : Nouveau, Répondre. Et en bas, le fil d'Ariane »,
    30 octobre au soir. Ce qui les remplace est plus haut — « la barre
    du haut ne porte que Nouveau et Répondre » et « le fil d'Ariane est
    en bas de page, sous le dernier message ». */

//  ── LES « J'AIME », EN HAUT À DROITE ───────────────────────────────
//
//  « Améliore le "j'aime" visuellement et mets-le en haut à droite
//  plutôt », 30 octobre — et c'est aussi ce que la maquette `305:24`
//  dessine : son bandeau de message porte un nombre juste avant les
//  trois actions.

const bande = await p.evaluate(() => {
  const tete = document.querySelector(".post .wm-post-corps > .post-head");
  const icones = tete?.querySelector(".menu-wrap") ?? null;
  const date = tete?.querySelector(".topic-date") ?? null;
  if (icones === null || date === null) return null;
  const r = (e) => e.getBoundingClientRect();
  //  COMBIEN DE LIGNES. On compare les MILIEUX, pas les ordonnées
  //  hautes : la bande est centrée verticalement, donc trois blocs de
  //  hauteurs différentes sur une même ligne ont trois `y` différents.
  //  Première version du contrôle, qui comptait les `y` : elle
  //  annonçait trois lignes là où il n'y en avait qu'une.
  //
  //  Le titre est mis à part — il a sa propre ligne, et c'est voulu.
  const milieux = [...tete.children]
    .filter((e) => e.classList.contains("topic-title") === false)
    .map((e) => Math.round(r(e).y + r(e).height / 2));
  return {
    milieux,
    lignes: new Set(milieux.map((y) => Math.round(y / 8))).size,
    //  ET LES ICÔNES SONT UNE RANGÉE, pas une colonne : le « + »
    //  au-dessus de la liste faisait 70 px de haut.
    hauteurIcones: Math.round(r(icones).height),
    affichage: getComputedStyle(icones).display,
  };
});

const jaime = await p.evaluate(() => {
  const tete = document.querySelector(".post .wm-post-corps > .post-head");
  const bloc = tete?.querySelector(".fa_like_div") ?? null;
  const icones = tete?.querySelector(".menu-wrap") ?? null;
  if (tete === null || bloc === null || icones === null) return null;
  const boutons = [...bloc.querySelectorAll(".rep-button")];
  const r = (e) => e.getBoundingClientRect();
  const st = getComputedStyle(boutons[0]);
  const mot = boutons[0].querySelector("span");
  const stMot = getComputedStyle(mot);
  //  LE SECOND MESSAGE N'A PAS VOTÉ : son bouton doit se distinguer de
  //  celui du premier, qui porte `voted`.
  const second = document.querySelectorAll(".post")[1]
    ?.querySelector(".post-head .rep-button") ?? null;
  return {
    //  DANS LE BANDEAU, ET DANS L'ORDRE DU DOCUMENT — pas remonté par
    //  `order` seul : au clavier on doit tomber dessus là où il est vu.
    dansLaTete: true,
    avantLeTitre: bloc.compareDocumentPosition(
      tete.querySelector(".topic-title"),
    ) === Node.DOCUMENT_POSITION_FOLLOWING,
    //  À DROITE, et collé devant les icônes d'action.
    aDroite: Math.round(r(bloc).x) > Math.round(r(tete).x + r(tete).width / 2),
    //  APRÈS LES ICÔNES, depuis le 30 octobre : « le like est placé
    //  bizarrement ». Coincé entre la date et les icônes, il se
    //  lisait comme une septième action ; c'est un compteur, et un
    //  compteur se met au bout.
    apresLesIcones: Math.round(r(bloc).x) >= Math.round(r(icones).right) - 1,
    auBord: Math.round(r(bloc).right) >= Math.round(r(tete).right) - 1,
    //  SUR LA MÊME LIGNE que la date : un bandeau, pas deux.
    memeLigne: Math.abs(
      Math.round(r(bloc).y + r(bloc).height / 2) -
        Math.round(
          r(tete.querySelector(".topic-date")).y +
            r(tete.querySelector(".topic-date")).height / 2,
        ),
    ) <= 8,
    boutons: boutons.length,
    //  UNE PASTILLE, pas un bouton gris de navigateur.
    rayon: st.borderRadius,
    hauteur: Math.round(r(boutons[0]).height),
    //  LE MOT EST CACHÉ À L'ŒIL MAIS PAS AU LECTEUR D'ÉCRAN : il garde
    //  une boîte, il n'est pas en `display: none`.
    motLu: mot.textContent.trim(),
    motCache: Math.round(r(mot).width) <= 1,
    motAffiche: stMot.display,
    //  ET LE COMPTE RESTE VISIBLE : c'est tout ce qu'on garde du texte.
    compte: boutons[0].textContent.replace(mot.textContent, "").trim(),
    //  LES DEUX ÉTATS SE DISTINGUENT.
    fondVote: st.backgroundColor,
    fondNonVote: second === null ? null : getComputedStyle(second).backgroundColor,
    //  ET LE BANDEAU TIENT TOUJOURS SUR UNE LIGNE : la date à gauche,
    //  les icônes au bord droit.
    iconesAuBord: Math.round(r(icones).right) >= Math.round(r(tete).right) - 1,
  };
});

dire(
  "LES « J'AIME » PRENNENT LA LIGNE SOUS LE BANDEAU",
  //  « Le like doit passer sur la ligne du dessous », 31 octobre —
  //  l'inverse exact de ce qui avait été demandé la veille, et c'est
  //  bien : au bout du bandeau, le bloc poussait les six icônes vers
  //  le milieu et le bandeau passait sur deux lignes.
  jaime !== null && jaime.dansLaTete && jaime.memeLigne === false &&
    jaime.iconesAuBord && jaime.boutons >= 1 &&
    jaime.rayon === "999px" && jaime.motCache,
  JSON.stringify(jaime),
);
dire(
  "et ils y sont dans l'ordre du document, pas remontés par `order`",
  //  Remonter un bloc par `order` seul laisse le clavier et le lecteur
  //  d'écran tomber dessus APRÈS le message qu'il note.
  jaime !== null && jaime.avantLeTitre,
  JSON.stringify({ avantLeTitre: jaime?.avantLeTitre }),
);
dire(
  "LE BOUTON EST UNE PASTILLE, LE MOT CACHÉ À L'ŒIL MAIS PAS AU LECTEUR",
  jaime !== null && jaime.boutons === 2 && jaime.rayon === "999px" &&
    jaime.hauteur === 26 && jaime.motLu === "J'aime" && jaime.motCache &&
    //  `display: none` le rendrait muet : « bouton, 3 ».
    jaime.motAffiche !== "none" && jaime.compte === "3",
  JSON.stringify(jaime),
);
dire(
  "LA PREMIÈRE LIGNE DU BANDEAU TIENT SUR UNE LIGNE",
  //  Deux rangées maintenant, et c'est voulu : la date et les icônes
  //  sur la première, les « j'aime » sur la seconde. Ce qui se
  //  vérifie, c'est que la PREMIÈRE n'en fasse pas deux à elle
  //  seule — le défaut du 30, où le « + » de ModernBB était seul
  //  au-dessus des sept icônes.
  bande !== null && bande.lignes <= 2 &&
    bande.hauteurIcones <= 40 && bande.affichage === "flex",
  JSON.stringify(bande),
);
dire(
  "UN VOTE DÉJÀ DONNÉ SE VOIT",
  jaime !== null && jaime.fondNonVote !== null &&
    jaime.fondVote !== jaime.fondNonVote,
  JSON.stringify({ vote: jaime?.fondVote, nonVote: jaime?.fondNonVote }),
);

//  ── LES DEUX RESSORTS, ET LA SECTION DE LA RÉPONSE RAPIDE ──────────
//
//  Maquette `305:24` : un filet d'un pixel au bout du fil d'Ariane
//  (`305:72`, de x = 497 à 1000) et un autre dans la barre d'actions
//  (`305:95`, de x = 238 à 806). Ils relient deux bouts de ligne que
//  du vide séparerait — même raison que le ressort des champs.

const ressorts = await p.evaluate(() => {
  const mesure = (sel, pseudo) => {
    const e = document.querySelector(sel);
    if (e === null) return null;
    const st = getComputedStyle(e, pseudo);
    //  LA LARGEUR D'UN PSEUDO NE SE LIT PAS AU `getBoundingClientRect`
    //  — il n'a pas de nœud. `width` calculée suffit : le conteneur est
    //  en flex, donc elle est déjà résolue en pixels.
    return {
      style: st.borderBottomStyle,
      largeur: Math.round(parseFloat(st.width) || 0),
      affichage: st.display,
      bloc: Math.round(e.getBoundingClientRect().width),
    };
  };
  return {
    //  LE FIL N'A PLUS DE RESSORT. Il est descendu en bas de page
    //  dans `.wm-sujet__fil`, qui est une carte à deux bouts —
    //  `justify-content: space-between` fait le même travail qu'un
    //  ressort, sans filet à dessiner. Le contrôle devient : le fil
    //  est là, et la veille du sujet est à l'autre bout.
    ariane: null,
    //  ET LA PAGINATION RESTE COLLÉE À DROITE : c'est le piège de la
    //  première tentative, où le ressort l'avait décollée du bord.
    barre: mesure(".wm-sujet__actions", "::after"),
    pagination: (() => {
      const b = document.querySelector(".wm-sujet__actions");
      const g = b?.querySelector(".pagination");
      if (b == null || g == null) return null;
      return Math.round(g.getBoundingClientRect().right) >=
        Math.round(b.getBoundingClientRect().right) - 1;
    })(),
  };
});

const filDuBas = await p.evaluate(() => {
  const carte = document.querySelector(".wm-sujet__fil");
  if (carte === null) return null;
  const fil = carte.querySelector(".wm-sujet__ariane");
  const veille = carte.querySelector(".wm-sujet__veille");
  const r = (e) => e.getBoundingClientRect();
  return {
    maillons: fil === null ? 0 : fil.querySelectorAll("a").length,
    //  LA CARTE EST LA MÊME QUE PARTOUT AILLEURS.
    fond: getComputedStyle(carte).backgroundColor,
    bordure: getComputedStyle(carte).borderTopWidth,
    rayon: getComputedStyle(carte).borderTopLeftRadius,
    //  LE FIL À GAUCHE, LA VEILLE À DROITE, et rien entre les deux
    //  qu'un ressort de flex.
    veilleADroite: veille === null ? null : Math.round(r(carte).right - r(veille).right) <= 20,
  };
});

dire(
  "le bas ne porte plus que « surveiller ce sujet », dans sa carte",
  //  Le fil est remonté dans la barre le 31 ; il ne reste en bas que
  //  la veille, qui n'existe nulle part ailleurs.
  filDuBas !== null && filDuBas.maillons === 0 &&
    filDuBas.bordure === "1px" && filDuBas.rayon === "10px",
  JSON.stringify(filDuBas),
);

dire(
  "LA BARRE D'ACTIONS N'A PLUS DE RESSORT DESSINÉ, ET LA PAGINATION RESTE AU BORD",
  //  « Enlève le fond blanc et les DEUX TRAITS que tu as ajoutés »,
  //  31 octobre : le second était ce ressort pointillé. Le fil
  //  d'Ariane occupe maintenant l'espace entre les boutons et la
  //  pagination, et un trait entre deux blocs de texte ne relie plus
  //  rien.
  ressorts.barre !== null && ressorts.barre.largeur === 0 &&
    ressorts.pagination === true,
  JSON.stringify(ressorts),
);

//  ── LA RÉPONSE RAPIDE N'A PLUS DE BANDEAU ─────────────────────────
//
//  « Enlever le texte "réponse rapide" qui traîne », et « ne pas
//  espacer le bloc de réponse rapide et le contenu d'édition, y'a un
//  grand vide entre les deux », 30 octobre au soir. Forumactif écrit
//  déjà son propre titre dans `{QUICK_REPLY_FORM}` ; le nôtre faisait
//  le second, et le vide était la marge qu'il laissait derrière lui.

const reponse = await p.evaluate(() => {
  const sec = document.querySelector(".wm-sujet__reponse");
  if (sec === null) return null;
  const form = sec.querySelector("#quick_reply");
  if (form === null) return null;
  return {
    //  PLUS DE BANDEAU DE SECTION DANS CE BLOC.
    bande: sec.querySelector(".wm-forum__bande") !== null,
    //  ET LE FORMULAIRE COMMENCE TOUT DE SUITE : pas plus que le
    //  rembourrage de la carte entre son bord et lui.
    ecart: Math.round(
      form.getBoundingClientRect().top - sec.getBoundingClientRect().top,
    ),
  };
});

dire(
  "la réponse rapide n'a plus de bandeau, et son éditeur commence tout de suite",
  reponse !== null && reponse.bande === false && reponse.ecart <= 24,
  JSON.stringify(reponse),
);

//  ── LE DOSSIER À ONGLETS DU PROFIL ─────────────────────────────────
//
//  « Fais des onglets pour que tout ne soit pas affiché d'un seul
//  coup, avec une hauteur spécifique, un overflow auto, mais on doit
//  tout le temps voir l'équipe », 30 octobre.
//
//  Quatre choses à prouver, et la dernière est la plus importante :
//  l'équipe doit être DEHORS, visible quel que soit l'onglet coché.

const dossier = await p.evaluate(() => {
  const profil = document.querySelector(".post .postprofile");
  const d = profil?.querySelector(".wm-profil__dossier") ?? null;
  const equipe = profil?.querySelector(".wm-profil__equipe") ?? null;
  if (d === null || equipe === null) return null;
  return {
    radios: d.querySelectorAll(".wm-profil__radio").length,
    etiquettes: [...d.querySelectorAll(".wm-profil__onglets label")]
      .map((e) => e.textContent.trim()),
    panneaux: d.querySelectorAll(".wm-profil__panneau").length,
    //  L'ÉQUIPE EST AU-DESSUS DU DOSSIER, et pas dedans — c'est ce qui
    //  la rend indépendante de l'onglet coché.
    equipeDehors: d.contains(equipe) === false,
    equipeAuDessus: Math.round(equipe.getBoundingClientRect().bottom) <=
      Math.round(d.getBoundingClientRect().top) + 1,
    //  Et la pastille de groupe ne porte plus les récompenses : elles
    //  ont leur onglet.
    rangSansBadge: profil.querySelector(".postprofile-rank .dd_award") === null,
  };
});

//  UN ONGLET APRÈS L'AUTRE, PAR UN VRAI CLIC. Chaque tour mesure ce
//  que le visiteur voit : un seul panneau, le bon, l'équipe toujours
//  là, l'étiquette active distincte des deux autres, et le panneau
//  borné en hauteur.
const parOnglet = [];
for (let n = 1; n <= 3; n++) {
  await p.click(ONGLET(n));
  //  ET ON RETIRE LA SOURIS. Playwright la laisse sur l'étiquette
  //  qu'elle vient de cliquer : `:hover` la colore, et le contrôle
  //  « l'étiquette ouverte se distingue » passait tout seul, même
  //  sans la règle de l'onglet coché. Un test que son décor fait
  //  réussir ne teste rien.
  await p.mouse.move(0, 0);
  //  LE FONDU DE L'ÉTIQUETTE FAIT 120 ms. Mesuré tout de suite après
  //  le clic, on attrape une couleur à mi-chemin : le test passait,
  //  mais sur une valeur qui n'existe que pendant un dixième de
  //  seconde. On laisse la transition finir.
  await p.waitForTimeout(220);
  parOnglet.push(
    await p.evaluate((n) => {
      const d = document.querySelector(".post .postprofile .wm-profil__dossier");
      const equipe = document.querySelector(
        ".post .postprofile .wm-profil__equipe",
      );
      const etiquettes = [...d.querySelectorAll(".wm-profil__onglets label")];
      const panneaux = [...d.querySelectorAll(".wm-profil__panneau")];
      const vu = (e) => e.offsetParent !== null && e.getBoundingClientRect().height > 0;
      const ouvert = panneaux[n - 1];
      const st = getComputedStyle(ouvert);
      return {
        onglet: etiquettes[n - 1].textContent.trim(),
        visibles: panneaux.filter(vu).length,
        leBon: vu(ouvert),
        equipe: vu(equipe),
        //  L'ÉTIQUETTE ACTIVE SE DISTINGUE. Sans ça, trois onglets
        //  identiques : on ne sait plus lequel on regarde.
        active: getComputedStyle(etiquettes[n - 1]).backgroundColor,
        autres: etiquettes.filter((_, i) => i !== n - 1)
          .map((e) => getComputedStyle(e).backgroundColor),
        //  LA HAUTEUR EST BORNÉE, LA MÊME POUR LES TROIS, ET LE PANNEAU
        //  DÉFILE. La même pour les trois parce qu'une colonne qui
        //  change de haut en changeant d'onglet ferait sauter le
        //  message entier : les deux sont les colonnes d'une rangée.
        hauteur: Math.round(ouvert.getBoundingClientRect().height),
        debordement: st.overflowY,
        contenu: Math.round(ouvert.scrollHeight),
      };
    }, n),
  );
}

//  On remet « Fiche », l'onglet du chargement.
await p.click(ONGLET(1));

//  LE CONTENU DES TROIS PANNEAUX. Il se lit sans ouvrir les onglets :
//  `display: none` cache la boîte, pas le texte ni les nœuds — et ici
//  c'est bien la présence qu'on vérifie, pas la mise en page.
const contenus = await p.evaluate(() => {
  const d = document.querySelector(".post .postprofile .wm-profil__dossier");
  if (d === null) return null;
  const pan = [...d.querySelectorAll(".wm-profil__panneau")];
  return {
    //  L'ORDRE DES PANNEAUX SUIT CELUI DES ONGLETS : infos, fiche,
    //  badges. Le numéro de classe suit la POSITION, pas le contenu —
    //  c'est lui que la feuille relie au bouton radio.
    champs: pan[0].querySelectorAll(".wm-profil__champ").length,
    fiche: pan[1].textContent.includes("paléontologue"),
    badges: pan[2].querySelectorAll("img").length,
  };
});

dire(
  "LE PROFIL A TROIS ONGLETS ET TROIS PANNEAUX",
  dossier !== null && dossier.radios === 3 && dossier.panneaux === 3 &&
    dossier.etiquettes.join("/") === "Infos/Fiche/Badges",
  JSON.stringify(dossier),
);
dire(
  "UN SEUL PANNEAU À LA FOIS, ET C'EST CELUI DE L'ONGLET CLIQUÉ",
  parOnglet.length === 3 &&
    parOnglet.every((o) => o.visibles === 1 && o.leBon),
  JSON.stringify(parOnglet.map((o) => [o.onglet, o.visibles, o.leBon])),
);
dire(
  "L'ÉTIQUETTE DE L'ONGLET OUVERT SE DISTINGUE DES DEUX AUTRES",
  parOnglet.length === 3 &&
    parOnglet.every((o) => o.autres.every((f) => f !== o.active)),
  JSON.stringify(parOnglet.map((o) => [o.onglet, o.active, ...o.autres])),
);
dire(
  "LES TROIS PANNEAUX ONT LA MÊME HAUTEUR BORNÉE, ET ILS DÉFILENT",
  parOnglet.length === 3 &&
    parOnglet.every((o) => o.hauteur === 170 && o.debordement === "auto") &&
    //  ET LE DÉBORDEMENT EXISTE POUR DE VRAI quelque part : onze badges
    //  de 48 px dans une colonne de 208 ne tiennent pas en 170 de haut.
    //  Sans ça, `overflow: auto` serait une règle que rien n'exerce.
    parOnglet.some((o) => o.contenu > o.hauteur),
  JSON.stringify(parOnglet.map((o) => [o.onglet, o.hauteur, o.contenu])),
);
dire(
  "L'ÉQUIPE RESTE VISIBLE SUR LES TROIS ONGLETS, HORS DU DOSSIER",
  dossier !== null && dossier.equipeDehors && dossier.equipeAuDessus &&
    parOnglet.length === 3 && parOnglet.every((o) => o.equipe),
  JSON.stringify({ dossier, equipes: parOnglet.map((o) => o.equipe) }),
);
dire(
  "RIEN NE S'EST PERDU : FICHE, CHAMPS ET BADGES SONT CHACUN DANS LE LEUR",
  contenus !== null && contenus.fiche && contenus.champs === 3 &&
    contenus.badges === 11 && dossier?.rangSansBadge === true,
  JSON.stringify(contenus),
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
