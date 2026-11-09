// ════════════════════════════════════════════════════════════════════
//  outils/profil.mjs — le profil d'un membre, monté dans un navigateur
//
//  Maquette `325:68`, note de code `325:273`.
//
//  ── LE BALISAGE EST RELEVÉ, PAS INVENTÉ ─────────────────────────────
//
//  Il vient de `/u1` le 8 novembre, déconnectée — la page est
//  publique. Seules les publicités et les scripts ont été retirés.
//
//  C'est le point entier de ce harnais : cette page n'a PAS de
//  gabarit. `#profile-advanced-layout`, `#tabs`, la colonne de droite
//  et ses modules sont posés par Forumactif en mode « profil avancé »,
//  sans variable ni bloc. Si je recopiais ce balisage de mémoire, je
//  mesurerais une page qui n'existe pas, et la feuille passerait les
//  contrôles en ratant la vraie.
//
//  Trois choses dans ce relevé sont des faits qu'on n'aurait pas
//  devinés, et chacune porte un contrôle :
//
//    · L'AVATAR ARRIVE EN `style="max-width: 200px; max-height:
//      320px"`. Le panneau sert déjà le portrait demandé. Si on
//      laissait ce style, l'image ne remplirait pas sa case.
//    · LES RÉCOMPENSES PORTENT LEUR IMAGE DANS `--award-image`, et
//      aucune feuille ne la peignait : quatre cases vides.
//    · L'ONGLET COURANT A `href="#"`. Un lien qui ne mène nulle part.
//
//      deno task profil
//      deno task profil --apercu    écrit `apercu-profil.html`
//      deno task profil --photo     écrit `profil-clair.png` et `-sombre`
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

//  ── LE RELEVÉ DU 8 NOVEMBRE, SUR `/u1` ────────────────────────────
//
//  L'avatar est remplacé par une image locale : le harnais n'a pas de
//  réseau, et on veut connaître la taille RÉELLE de l'image pour
//  savoir si elle remplit sa case ou si elle s'étire. Elle est large
//  et basse exprès — c'est le cas qui déforme.
const PHOTO = "data:image/svg+xml;base64," +
  btoa(
    '<svg xmlns="http://www.w3.org/2000/svg" width="640" height="280">' +
      '<rect width="640" height="280" fill="#8a6a4f"/></svg>',
  );
//  L'icone de genre fait une douzaine de pixels sur le vrai forum
//  (`icon_minigender_female.gif`, 10 x 12). Le harnais s'en servait
//  d'un rond de 64, et la ligne « Genre » sortait trois fois trop
//  haute : une mesure prise sur un faux gabarit.
const ICONE = "data:image/svg+xml;base64," +
  btoa(
    '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="12">' +
      '<rect width="10" height="12" fill="#6e5749"/></svg>',
  );

const BADGE = "data:image/svg+xml;base64," +
  btoa(
    '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64">' +
      '<circle cx="32" cy="32" r="30" fill="#b1402f"/></svg>',
  );

//  ── LA PAGE SE FABRIQUE : CINQ ONGLETS, LE MÊME CADRE ─────────────
//
//  Les cinq pages d'un profil partagent tout sauf le contenu de
//  `#cp-main`. Une fabrique plutôt que cinq copies : le cadre est
//  relevé une fois, et un contrôle de mise en page vaut pour les cinq.
const ONGLETS = [
  ["Profil", "#"],
  ["Groupes", "/u1groups"],
  ["Récompenses", "/u1awards"],
  ["Contact", "/u1contact"],
  ["Feuille de personnage", "/u1rpg"],
  //  SIXIÈME ONGLET, relevé le 9 novembre : il n'apparaît QU'UNE FOIS
  //  CONNECTÉE, ce qui est pourquoi le relevé du 8, fait déconnectée,
  //  ne le voyait pas. Le harnais le monte quand même : la feuille
  //  doit l'habiller, et personne ne se connecte pour le vérifier.
  ["Statistiques", "/u1stats"],
];

const gauche = (actif, corps) =>
  `<div id="profile-advanced-layout"><div id="profile-advanced-left">
<div id="new-message"><div id="tabs"><ul>${
    ONGLETS.map(([mot, vers], i) =>
      `<li${i === actif ? ' class="activetab"' : ""}><a href="${
        i === actif ? "#" : vers
      }"><span>${mot}</span></a></li>`
    ).join("")
  }</ul></div></div>
<div id="profile-advanced-details" class="panel row3"><div class="inner">
<span class="corners-top"><span></span></span>
<div id="cp-main" class="ucp-main">${corps}</div>
<span class="corners-bottom"><span></span></span></div></div></div></div>`;

//  ── LES CINQ CORPS, RELEVÉS LE 8 NOVEMBRE ─────────────────────────

const CORPS_PROFIL =
  `<h1>Tout à propos de <span class="group-2 usr_grp_clr" style="color:#808080"><strong>Arceus</strong></span></h1>
<div class="panel"><div class="inner"><span class="corners-top"><span></span></span>
<div class="middleline"><div id="profile-tab-field-profil">
<dl id="field_id-8"><dt>Faceclaim : </dt><dd><div class="field_uneditable">uc</div></dd></dl>
<div class="separator">&nbsp;</div>
<dl id="field_id-9"><dt>Autres comptes : </dt><dd><div class="field_uneditable">Tour Titanite.</div></dd></dl>
<div class="separator">&nbsp;</div>
<dl id="field_id-11"><dt>Pronoms : </dt><dd><div class="field_uneditable">uc</div></dd></dl>
<div class="separator">&nbsp;</div>
<dl id="field_id-4"><dt>Date d'inscription : </dt><dd><div class="field_uneditable">06/08/2020</div></dd></dl>
<div class="separator">&nbsp;</div>
<dl id="field_id-6"><dt>Messages postés : </dt><dd><div class="field_uneditable">291</div></dd></dl>
<div class="separator">&nbsp;</div>
<dl id="field_id-7"><dt>Genre : </dt><dd><div class="field_uneditable"><img src="${ICONE}" alt="Féminin" title="Féminin"></div></dd></dl>
<div class="separator">&nbsp;</div>
</div></div><span class="corners-bottom"><span></span></span></div></div>
`;

//  `/u1groups` — et le piège : `.clearfix` est un DIV VIDE au milieu
//  du bloc de message, pas la rangée. La rangée est le `<li>`.
const CORPS_GROUPES = `<h1>Groupes 1 à 7 sur 7</h1><div class="panel"><div class="inner">
<span class="corners-top"><span></span></span>
<div class="pagination top"> Page <strong>1</strong> sur <strong>1</strong></div>
<div class="clear"></div><ol>${
  [
    ["PNJ", "#808080", "g2", "Personnages non joués du forum."],
    [
      "Hardi",
      "#46849C",
      "g4",
      "Valheureux challengers, dresseurs, à la conquête des arènes et de la ligue de Rhode.",
    ],
    ["Sérieux", "#B56A45", "g6", "Champions de Rhode, ils font parti des arènes et colosseum."],
    ["Malin", "#A264BE", "g7", "Scientifiques, étudiants, ils sont fascinés par les Pokémons."],
    ["Doux", "#4C8A52", "g5", "Éleveurs, gérants de pensions, soigneurs."],
  ].map(([nom, couleur, id, quoi]) =>
    `<li><div class="avatar"><i class="ion-ios-people" style="color:${couleur}"></i></div>` +
    `<div id="group-${id}" class="message-block"><div class="message-header"><strong>${nom}</strong></div>` +
    `<div class="message-text"><div>${quoi}</div><b>Statut : </b><i>Groupe ouvert</i></div>` +
    `<div class="clearfix"></div><ul class="message-footer"><li><a href="/${id}-x">Voir plus</a></li></ul>` +
    `<div class="clear"></div></div></li>`
  ).join("")
}</ol><span class="corners-bottom"><span></span></span></div></div>`;

//  `/u1awards` — chaque badge porte son image dans `--award-image`.
const CORPS_RECOMPENSES = `<h1>Récompenses</h1><div class="panel"><div class="inner">
<span class="corners-top"><span></span></span><div id="profile_awards_full">
<div class="module owned"><div class="h3">Récompenses obtenues</div><div class="awards_block">${
  ["Feu", "Plante", "Eau", "Acier"].map((t) =>
    `<div class="award_row"><div class="award_img">` +
    `<div class="award " style="--award-image: url('${BADGE}');"> </div></div>` +
    `<div class="award_desc"><b>Badge - Arène ${t}</b><p></p>` +
    `<i>Récompense obtenue le Ven 30 Oct 2026 - 15:57 - 1 membres</i></div></div>`
  ).join("")
}</div></div></div><span class="corners-bottom"><span></span></span></div></div>`;

//  `/u1contact` — la valeur est une VRAIE image, pas une icône.
const CORPS_CONTACT =
  `<h1>Contacter <span class="group-2 usr_grp_clr" style="color:#808080"><strong>Arceus</strong></span></h1>
<div class="panel"><div class="inner"><span class="corners-top"><span></span></span>
<div class="middleline"><div id="profile-tab-field-profil">
<dl id="field_id5"><dt>TRAINER CARD : </dt><dd><div class="field_uneditable">
<a href="/t8-trainer-card" target="_blank" rel="nofollow"><img src="${PHOTO}" alt="carte"></a>
</div></dd></dl><div class="separator">&nbsp;</div>
</div></div><span class="corners-bottom"><span></span></span></div></div>`;

//  `/u1rpg` — le bloc `switch_rpg` du gabarit, avec son `<p>` vide,
//  son `<hr>` et son `fieldset` vide.
const CORPS_RPG = `<h1>Feuille de personnage</h1><div class="panel"><div class="inner">
<span class="corners-top"><span></span></span><p style="text-align: center;"></p><hr>${
  [
    ["Âge", "pseudo sur la toile."],
    ["Alignement", "double comptes."],
    ["Lieu de vie", "la célébrité de ton personnage."],
    ["Métier", "créateurs de ton kit."],
    ["Origines", "tes pronoms personnels."],
    ["Statut marital", "thèmes ou sujets qui peuvent te mettre mal à l'aise."],
    ["Orientation sexuelle", "triggers réguliers que peuvent contenir tes rps."],
  ].map(([mot, quoi]) =>
    `<div class="column2"><dl class="details"><dt><span class="gen">${mot}</span> :</dt>` +
    `<dd><span class="gen">${quoi}</span></dd></dl></div>`
  ).join("")
}<div class="clear"></div><fieldset class="submit-buttons"></fieldset>
<span class="corners-bottom"><span></span></span></div></div>`;

//  `/u1stats` — LE PIÈGE EST DANS LE `<li>` : la valeur n'est pas
//  dans un élément, c'est un nœud de texte posé après le `</label>`.
//  Et la dernière ligne de chaque bloc n'a QUE son libellé.
const CORPS_STATS = `<h1>Statistiques</h1><div class="panel"><div class="inner">
<span class="corners-top"><span></span></span>${
  [
    ["Sujets", [
      [
        '<a rel="nofollow" href="/st/u1">Nombre de sujets ouverts dans le forum</a> :',
        "44 (45.36% du total)",
      ],
      ["Sujets par jour :", "0.02"],
      ["Dernier sujet :", "Mer 4 Nov 2026 - 12:15"],
      [
        '<a rel="nofollow" href="/sta/u1">Trouver tous les sujets où Arceus a participé</a>',
        null,
      ],
    ]],
    ["Messages", [
      ["Messages postés :", "291 (100.00% du total)"],
      ["Messages par jour :", "0.13"],
      ["Dernier message :", "Dim 8 Nov 2026 - 20:23"],
      [
        '<a rel="nofollow" href="/spa/u1">Trouver tous les messages postés par Arceus</a>',
        null,
      ],
    ]],
    ["Informations", [
      ["Nombre d'amis :", "0"],
      ["Messages privés :", "17"],
      ["Inscrit le :", "06/08/2020"],
      ["Dernière visite :", "Aujourd'hui à 9:34"],
    ]],
  ].map(([legende, lignes]) =>
    `<fieldset class="stats-field genmed"><legend>${legende}</legend><ul>${
      lignes.map(([mot, valeur]) =>
        `<li><label>${mot}</label>${valeur === null ? "" : " " + valeur}</li>`
      ).join("")
    }</ul></fieldset>`
  ).join("")
}<span class="corners-bottom"><span></span></span></div></div>`;

const CORPS = [
  CORPS_PROFIL,
  CORPS_GROUPES,
  CORPS_RECOMPENSES,
  CORPS_CONTACT,
  CORPS_RPG,
  CORPS_STATS,
];

const DROITE = `<div id="profile-advanced-right">
<div class="module"><div class="h3"><span class="group-2 usr_grp_clr" style="color:#808080"><strong>Arceus</strong></span> </div>
<div class="mod-login-avatar"><img src="${PHOTO}" alt="Arceus" style="max-width: 200px; max-height: 320px"></div>
<div class="mod-login-rank"><br>Rang: <ed>en découverte</ed></div></div>
<div class="module awards_module" style="margin-bottom:4px;"><div class="h3">Récompenses obtenues</div>
<div class="awards_block" style="text-align:center;">
<div class="award " style="--award-image: url('${BADGE}');" tabindex="0"> <span class="award_tooltiptext" data-award-class=""> <div class="award_tooltiptext_title">Badge - Arène Feu</div> </span> </div>
<div class="award " style="--award-image: url('${BADGE}');" tabindex="0"> <span class="award_tooltiptext" data-award-class=""> <div class="award_tooltiptext_title">Badge - Arène Plante</div> </span> </div>
<div class="award " style="--award-image: url('${BADGE}');" tabindex="0"> <span class="award_tooltiptext" data-award-class=""> <div class="award_tooltiptext_title">Badge - Arène Eau</div> </span> </div>
<div class="award " style="--award-image: url('${BADGE}');" tabindex="0"> <span class="award_tooltiptext" data-award-class=""> <div class="award_tooltiptext_title">Badge - Arène Acier</div> </span> </div>
</div></div>
<div class="module"><div class="inner"><span class="corners-top"><span></span></span>
<div class="h3">Amis de <span class="group-2 usr_grp_clr" style="color:#808080"><strong>Arceus</strong></span></div>
<div style="text-align:center;"><div class="clear">&nbsp;</div>Arceus n'a pas encore d'amis</div>
<span class="corners-bottom"><span></span></span></div></div></div>`;

const FEUILLES = `<style>${readFileSync(R + "panneau-admin/jetons.css", "utf8")}</style>
<style>${readFileSync(R + "css/wild-mystery.css", "utf8")}</style>
<style>html,body{margin:0}body{background:var(--wm-fond-page)}
  /*  LE CADRE DU FORUM, PAS UN CADRE A MOI. Releve sur le vrai
      forum le 9 novembre : le conteneur #wrap porte un max-width
      (notre regle), une largeur de 98 % et un rembourrage de 24 px
      sur 36 (ModernBB, sa feuille 16-ltr). Mon apercu posait le
      contenu dans 1 000 px fixes — plus etroit que le forum, donc
      des photos qui ne ressemblaient pas a la page. */
  #wrap{box-sizing:border-box;margin:0 auto;width:98%;padding:24px 36px}</style>`;

const page = (actif) =>
  `<!doctype html><html lang="fr"><head><meta charset="utf-8">${FEUILLES}</head>
<body id="modernbb"><div id="wrap"><div id="page-body"><div id="main-content">
${gauche(actif, CORPS[actif])}
${DROITE}
</div></div></div></body></html>`;

const nav = await chromium.launch(CHROME === undefined ? {} : { executablePath: CHROME });
const p = await nav.newPage({ viewport: { width: 1280, height: 1200 } });
const soucis = [];
p.on("pageerror", (e) => soucis.push("erreur JS : " + e.message));
//  L'ADRESSE COMPTE : le module y lit l'identifiant du membre, et
//  construit les trois boutons avec. Servie sur `about:blank`, la
//  page n'aurait pas de `pathname` et la carte sortirait sans actions.
const RACINE = "https://mysteryinrhode.forumactif.com";
const ADRESSES = ["/u1", "/u1groups", "/u1awards", "/u1contact", "/u1rpg", "/u1stats"];
//  ── CE QUE LE HARNAIS SERT À LA PLACE DE SUPABASE ─────────────────
//
//  La réponse de `carte_dresseur` telle que la fonction la rend : un
//  palier, des pokédollars, des badges, et une équipe de cinq — avec
//  une place libre et un pokémon en pension, parce que ce sont les
//  deux cas qu'on oublie en réécrivant un rendu d'équipe.
const CARTE = {
  forumUserId: 1,
  pseudo: "Arceus",
  palier: 2,
  pokedollars: 3240,
  badges: [
    { arene: "Arène Feu", obtenuLe: "2026-10-30" },
    { arene: "Arène Eau", obtenuLe: "2026-10-30" },
  ],
  equipe: [
    { especeId: 37, surnom: "Rouquine", niveau: 24, obscur: false, place: 1, enPension: false },
    { especeId: 25, surnom: null, niveau: 18, obscur: false, place: 2, enPension: false },
    { especeId: 133, surnom: null, niveau: 31, obscur: true, place: 3, enPension: false },
    { especeId: 7, surnom: null, niveau: 12, obscur: false, place: 4, enPension: true },
    { especeId: 1, surnom: null, niveau: 9, obscur: false, place: 5, enPension: false },
  ],
};
const ESPECES = {
  especes: {
    "37": "Goupix",
    "25": "Pikachu",
    "133": "Évoli",
    "7": "Carapuce",
    "1": "Bulbizarre",
  },
};
const FICHES = { fiches: { "37": { types: ["feu"] }, "25": { types: ["electrik"] } } };

await p.route("**/*", (r) => {
  let chemin = "";
  try {
    chemin = new URL(r.request().url()).pathname;
  } catch {
    chemin = "";
  }
  const json = (o) => r.fulfill({ contentType: "application/json", body: JSON.stringify(o) });
  if (chemin.endsWith("/rpc/carte_dresseur")) return json(CARTE);
  if (chemin === "/data/especes.json") return json(ESPECES);
  if (chemin === "/data/especes-fiches.json") return json(FICHES);
  const i = ADRESSES.indexOf(chemin);
  return i === -1
    ? r.fulfill({ status: 204, body: "" })
    : r.fulfill({ contentType: "text/html; charset=utf-8", body: page(i) });
});
await p.goto(RACINE + ADRESSES[0]);
await p.addScriptTag({ path: R + "js/harnais-sommaire.js" });
const pose = await p.evaluate(() => globalThis.wmPoserLeProfil());

let fautes = 0;
const ok = (quoi, vrai, preuve) => {
  if (vrai) {
    console.log("  ok   " + quoi);
    return;
  }
  fautes += 1;
  console.log("  DÉFAUT " + quoi + " — " + JSON.stringify(preuve));
};

ok("le module reconnaît la page et la remonte", pose === true, { pose });

// ── 1 · LA CARTE D'IDENTITÉ ───────────────────────────────────────
const carte = await p.evaluate(() => {
  const c = document.querySelector(".wm-profil-page__carte");
  if (c === null) return null;
  const av = c.querySelector(".wm-profil-page__avatar");
  const r = av === null ? null : av.getBoundingClientRect();
  return {
    //  LE STYLE INLINE DE FORUMACTIF EST PARTI. Laissé en place,
    //  `max-width: 200px; max-height: 320px` empêche l'image de
    //  remplir la case : une photo large sortirait en bande.
    styleInline: av === null ? null : av.getAttribute("style"),
    avatar: r === null ? null : [Math.round(r.width), Math.round(r.height)],
    //  La largeur utile de la carte : sa boîte moins son rembourrage.
    carteUtile: (() => {
      const st = getComputedStyle(c);
      return Math.round(
        c.getBoundingClientRect().width - parseFloat(st.paddingLeft) -
          parseFloat(st.paddingRight),
      );
    })(),
    recadre: av === null ? null : getComputedStyle(av).objectFit,
    source: av === null ? null : [av.naturalWidth, av.naturalHeight],
    //  Le pseudo garde le `style="color:…"` que le panneau pose.
    nom: c.querySelector(".wm-profil-page__nom")?.textContent.trim() ?? null,
    couleur: c.querySelector(".wm-profil-page__nom .usr_grp_clr")
      ?.getAttribute("style") ?? null,
    rang: c.querySelector(".wm-profil-page__rang")?.textContent.trim() ?? null,
    ...(() => {
      const n = c.querySelector(".wm-profil-page__nom")?.getBoundingClientRect();
      const r = c.querySelector(".wm-profil-page__rang")?.getBoundingClientRect();
      if (n === undefined || r === undefined) return { rangSousLeNom: null };
      return {
        rangSousLeNom: r.top >= n.bottom - 1,
        boiteNom: [Math.round(n.top), Math.round(n.bottom)],
        boiteRang: [Math.round(r.top), Math.round(r.bottom)],
      };
    })(),
    chiffres: [...c.querySelectorAll(".wm-profil-page__chiffre")].map((l) => ({
      nombre: l.querySelector(".wm-profil-page__nombre").textContent.trim(),
      mot: l.querySelector(".wm-profil-page__mot").textContent.trim(),
    })),
    actions: [...c.querySelectorAll(".wm-profil-page__bouton")].map((a) => ({
      mot: a.textContent.trim(),
      vers: a.getAttribute("href"),
    })),
    badges: c.querySelectorAll(".wm-profil-page__badges .award").length,
  };
});
ok("la carte d'identité existe", carte !== null, carte);
if (carte !== null) {
  ok("le style inline de l'avatar est retiré", carte.styleInline === null, carte.styleInline);
  //  IL REMPLIT LA CARTE ET GARDE SON PORTRAIT : plus de mesure en
  //  dur, c'est le rapport qui tient — la carte peut changer de
  //  largeur sans qu'on y revienne.
  ok(
    "l'avatar remplit la largeur de sa carte",
    carte.avatar !== null && carte.carteUtile !== null &&
      Math.abs(carte.avatar[0] - carte.carteUtile) <= 1,
    { avatar: carte.avatar, utile: carte.carteUtile },
  );
  ok(
    "et il garde son portrait",
    carte.avatar !== null && carte.avatar[1] > carte.avatar[0] &&
      Math.abs(carte.avatar[1] / carte.avatar[0] - 320 / 200) < 0.02,
    carte.avatar,
  );
  ok("l'avatar est recadré, pas déformé", carte.recadre === "cover", carte.recadre);
  ok("le nom est celui du membre", carte.nom === "Arceus", carte.nom);
  ok(
    "le pseudo garde la couleur de son groupe",
    (carte.couleur ?? "").includes("#808080"),
    carte.couleur,
  );
  //  « Rang: en découverte » devient « en découverte ».
  ok("le rang est sans son libellé", carte.rang === "en découverte", carte.rang);
  ok(
    "et il est SOUS le nom, pas à côté",
    carte.rangSousLeNom === true,
    { nom: carte.boiteNom, rang: carte.boiteRang },
  );
  ok(
    "les trois chiffres sont là, avec leur mot",
    carte.chiffres.length === 3 &&
      carte.chiffres[0].nombre === "291" &&
      carte.chiffres[2].nombre === "4",
    carte.chiffres,
  );
  //  AUCUNE ADRESSE INVENTÉE : les trois sont des routes de
  //  Forumactif, et le gabarit par défaut écrit lui-même `/spa/` et
  //  `/sta/` sous le compteur de messages.
  ok(
    "les trois actions mènent à des routes du forum",
    carte.actions.length === 3 &&
      carte.actions[0].vers === "/privmsg?mode=post&u=1" &&
      carte.actions[1].vers === "/spa/Arceus" &&
      carte.actions[2].vers === "/sta/Arceus",
    carte.actions,
  );
  ok("les quatre récompenses sont dans la carte", carte.badges === 4, carte.badges);
}

// ── 2 · LES BADGES SE VOIENT ──────────────────────────────────────
//
//  Le défaut d'origine : le panneau pose l'image dans `--award-image`
//  et rien ne la peint. Ce contrôle-là est le seul qui l'aurait vu —
//  compter les récompenses ne suffisait pas, elles étaient quatre.
const vus = await p.evaluate(() =>
  [...document.querySelectorAll(".wm-profil-page .award")].map((a) => {
    const s = getComputedStyle(a);
    const r = a.getBoundingClientRect();
    return {
      image: s.backgroundImage,
      taille: [Math.round(r.width), Math.round(r.height)],
      rond: parseFloat(s.borderRadius) >= r.width / 2,
      bulle: getComputedStyle(a.querySelector(".award_tooltiptext")).opacity,
    };
  })
);
ok(
  "chaque badge peint son image",
  vus.length === 4 && vus.every((v) => v.image !== "none" && v.image.includes("url(")),
  vus.map((v) => v.image.slice(0, 40)),
);
ok(
  "les badges sont ronds et de même taille",
  vus.every((v) => v.taille[0] === v.taille[1] && v.rond),
  vus.map((v) => v.taille),
);
ok(
  "l'infobulle d'un badge est cachée au repos",
  vus.every((v) => v.bulle === "0"),
  vus.map((v) => v.bulle),
);

//  AUCUN CONTOUR AU REPOS : ni bordure, ni ombre, ni anneau du
//  navigateur. « Enlève le contour bleu autour des badges »
//  (9 novembre) — et il ne doit pas revenir par une autre feuille.
{
  const nus = await p.evaluate(() =>
    [...document.querySelectorAll(".wm-profil-page__badges .award")].map((a) => {
      const st = getComputedStyle(a);
      return [st.borderTopWidth, st.boxShadow, st.outlineStyle];
    })
  );
  ok(
    "aucun contour autour d'un badge au repos",
    nus.every((x) =>
      parseFloat(x[0]) === 0 && x[1] === "none" &&
      (x[2] === "none" || parseFloat(x[2]) === 0)
    ),
    nus[0],
  );
}

//  ── L'INFOBULLE TIENT SUR UNE LIGNE, SOUS SON BADGE ───────────────
//
//  Les deux défauts du 9 novembre : elle s'affichait « en deux fois »
//  — son texte passait sur deux lignes parce que sa boîte était trop
//  large — et « complètement décalée du badge », parce qu'elle était
//  accrochée à la rangée. On mesure donc les deux : une seule ligne,
//  et un chevauchement horizontal avec SON badge.
{
  const bulles = await p.evaluate(() =>
    [...document.querySelectorAll(".wm-profil-page__badges .award")].map((a) => {
      const b = a.querySelector(".award_tooltiptext");
      const rb = b.getBoundingClientRect();
      const ra = a.getBoundingClientRect();
      const ligne = parseFloat(getComputedStyle(b).lineHeight) || 14;
      const st = getComputedStyle(b);
      const haut = rb.height - parseFloat(st.paddingTop) -
        parseFloat(st.paddingBottom);
      return {
        //  Une seule ligne : la hauteur du texte ne dépasse pas une
        //  interligne et demie.
        uneLigne: haut <= ligne * 1.5,
        //  Elle chevauche son badge en horizontal — donc elle le
        //  désigne, au lieu de flotter ailleurs dans la rangée.
        surSonBadge: rb.left < ra.right && rb.right > ra.left,
        sousSonBadge: Math.round(rb.top) >= Math.round(ra.bottom),
      };
    })
  );
  ok("chaque infobulle tient sur une ligne", bulles.every((b) => b.uneLigne), bulles);
  ok(
    "chaque infobulle désigne SON badge",
    bulles.every((b) => b.surSonBadge && b.sousSonBadge),
    bulles,
  );
}

const auSurvol = await p.evaluate(async () => {
  const a = document.querySelector(".wm-profil-page .award");
  a.dispatchEvent(new MouseEvent("mouseover", { bubbles: true }));
  //  `:hover` ne se déclenche pas par un évènement : on le demande au
  //  navigateur. Playwright le fait avec `hover()`, mais il faut la
  //  poignée côté Deno — on passe donc par le focus, qui est l'autre
  //  moitié de la règle et celle qui compte pour le clavier.
  a.focus();
  await new Promise((r) => setTimeout(r, 50));
  return getComputedStyle(document.querySelector(".wm-profil-page .award_tooltiptext"))
    .opacity;
});
ok("elle s'ouvre au focus clavier, pas seulement au survol", auSurvol === "1", auSurvol);

// ── 3 · LES ONGLETS ───────────────────────────────────────────────
const onglets = await p.evaluate(() =>
  [...document.querySelectorAll(".wm-profil-page__onglets .wm-onglet")].map((a) => ({
    mot: a.textContent.trim(),
    vers: a.getAttribute("href"),
    courant: a.getAttribute("aria-current"),
    fond: getComputedStyle(a).backgroundColor,
  }))
);
ok("les six onglets sont là", onglets.length === 6, onglets.map((o) => o.mot));
ok(
  "aucun onglet ne mène à « # »",
  onglets.every((o) => o.vers !== "#"),
  onglets.map((o) => o.vers),
);
ok(
  "l'onglet courant est marqué pour un lecteur d'écran",
  onglets.filter((o) => o.courant === "page").length === 1 &&
    onglets[0].courant === "page",
  onglets.map((o) => o.courant),
);
ok(
  "et il ne se distingue pas que par la couleur",
  onglets[0].fond !== onglets[1].fond,
  [onglets[0].fond, onglets[1].fond],
);

// ── 4 · LES CHAMPS ────────────────────────────────────────────────
const champs = await p.evaluate(() => {
  const l = document.querySelector(".wm-profil-page__champs");
  if (l === null) return null;
  const lignes = [...l.querySelectorAll("dl")].map((d) => {
    const dt = d.querySelector("dt").getBoundingClientRect();
    const dd = d.querySelector("dd").getBoundingClientRect();
    return {
      mot: d.querySelector("dt").textContent.trim(),
      gauche: Math.round(dt.left),
      droite: Math.round(dd.right),
      haut: Math.round(dt.top),
      //  Le libellé et la valeur sont sur la MÊME ligne : c'est tout
      //  l'intérêt du passage de `<dl>` empilés à des lignes.
      memeLigne: Math.abs(dt.top - dd.top) < 6,
    };
  });
  return { colonnes: new Set(lignes.map((x) => x.gauche)).size, lignes };
});
ok("les six champs sont montés", champs?.lignes.length === 6, champs?.lignes.length);
ok(
  "chaque libellé est sur la ligne de sa valeur",
  champs.lignes.every((l) => l.memeLigne),
  champs.lignes.filter((l) => !l.memeLigne),
);
ok("ils tiennent sur deux colonnes", champs.colonnes === 2, champs.colonnes);
//  LES VALEURS D'UNE MÊME COLONNE FINISSENT AU MÊME ENDROIT, sans
//  quoi l'alignement à droite ne sert à rien.
{
  const parColonne = new Map();
  for (const l of champs.lignes) {
    const c = parColonne.get(l.gauche) ?? [];
    c.push(l.droite);
    parColonne.set(l.gauche, c);
  }
  ok(
    "dans une colonne, les valeurs finissent au même endroit",
    [...parColonne.values()].every((d) => new Set(d).size === 1),
    [...parColonne.entries()],
  );
}

// ── 5 · RIEN NE DÉPASSE, ET L'ÉTROIT TIENT ────────────────────────
for (const largeur of [1280, 1000, 390]) {
  await p.setViewportSize({ width: largeur, height: 1400 });
  const etat = await p.evaluate((l) => {
    const av = document.querySelector(".wm-profil-page__avatar").getBoundingClientRect();
    return {
      trop: [...document.querySelectorAll(".wm-profil-page, .wm-profil-page *")]
        .map((e) => ({
          c: e.className || e.tagName,
          d: Math.round(e.getBoundingClientRect().right - (l - 24)),
        }))
        .filter((x) => x.d > 1),
      avatar: [Math.round(av.width), Math.round(av.height)],
      //  LE NOMBRE DE COLONNES SE COMPTE, IL NE SE LIT PAS :
      //  `columnCount` rend la valeur DECLAREE (« 2 »), pas celle que
      //  le navigateur a retenue. On regarde donc ou les champs
      //  commencent vraiment.
      colonnes: new Set(
        [...document.querySelectorAll(".wm-profil-page__champs > dl")]
          .map((d) => Math.round(d.getBoundingClientRect().left)),
      ).size,
    };
  }, largeur);
  ok(`${largeur} px : rien ne dépasse`, etat.trop.length === 0, etat.trop.slice(0, 3));
  //  L'AVATAR NE S'ÉCRASE JAMAIS. Dans un flex, une image rétrécit
  //  sous sa largeur déclarée dès que le texte à côté pousse : c'est
  //  le défaut qui ne se voit qu'à 1000 px.
  //  À TOUTES LES LARGEURS, il reste un portrait et il ne devient pas
  //  une tour : c'est `max-height` qui tient le second cas, et on ne
  //  le voit qu'en fenêtre étroite, là où la carte prend toute la
  //  page.
  ok(
    `${largeur} px : l'avatar reste un portrait, sans devenir une tour`,
    etat.avatar[1] > etat.avatar[0] && etat.avatar[1] <= 420,
    etat.avatar,
  );
  if (largeur === 390) {
    ok("390 px : les champs passent sur une colonne", etat.colonnes === 1, etat.colonnes);
  }
}
await p.setViewportSize({ width: 1280, height: 1400 });

// ── 6 · LA COLONNE D'ORIGINE NE REVIENT PAS DOUBLER LA PAGE ───────
const reste = await p.evaluate(() => ({
  droite: getComputedStyle(document.querySelector("#profile-advanced-right")).display,
  //  Le nom ne doit paraître qu'une fois : il était dans le titre ET
  //  dans la colonne de droite.
  noms: document.querySelectorAll(".wm-profil-page .usr_grp_clr").length,
  avatars: document.querySelectorAll("img.wm-profil-page__avatar").length,
}));
ok("la colonne de droite d'origine est masquée", reste.droite === "none", reste);
ok("un seul avatar dans la page", reste.avatars === 1, reste.avatars);

// ── 7 · LE CONTRASTE, DANS LES DEUX THÈMES ────────────────────────
//
//  Le pseudo coloré est le point délicat : les dix tons de groupe
//  donnent 3,78 sur une surface et 2,78 sur le fond de page (relevé
//  du 30 octobre). La carte doit donc être une SURFACE. Le seuil de
//  3 s'applique à lui parce qu'il est gras et grand.
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
    const sur = (d, b, a) => d.map((v, i) => v * a + b[i] * (1 - a));
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
    for (const el of document.querySelectorAll(".wm-profil-page, .wm-profil-page *")) {
      if (![...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim() !== "")) {
        continue;
      }
      if (el.getClientRects().length === 0) continue;
      const st = getComputedStyle(el);
      if (Number(st.opacity) === 0) continue;
      const t = canal(st.color);
      if (t === null) continue;
      const fo = fond(el);
      const texte = sur(t.rgb, fo, t.alpha);
      const a = lum(texte), b = lum(fo);
      const ratio = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
      const px = parseFloat(st.fontSize), gras = Number(st.fontWeight) >= 700;
      const seuil = (px >= 24 || (px >= 18.66 && gras)) ? 3 : 4.5;
      res.push({
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
  ok(
    `${theme} : ${r.length} textes mesurés, aucun défaut de contraste`,
    rates.length === 0,
    rates,
  );
}
await p.evaluate(() => document.body.classList.remove("wm-sombre"));

// ── 7 bis · « SON JEU » ───────────────────────────────────────────
//
//  La section que `module-profil` laisse vide. Elle n'existe que si
//  Supabase répond — et c'est le point : un joueur sans compte de jeu
//  ne doit pas voir une section vide qui laisse croire qu'on n'a pas
//  su lire la sienne.
{
  const avant = await p.evaluate(() => {
    const s = document.querySelector(".wm-profil-page__jeu");
    return { existe: s !== null, cachee: s?.hidden ?? null, vide: s?.children.length ?? null };
  });
  ok(
    "la place de « son jeu » est posée, et cachée",
    avant.existe && avant.cachee === true && avant.vide === 0,
    avant,
  );

  const rempli = await p.evaluate(() =>
    globalThis.wmPoserSonJeu("https://exemple.supabase.co", "cle-publiable")
  );
  ok("elle se remplit quand Supabase répond", rempli === true, rempli);

  const jeu = await p.evaluate(() => {
    const s = document.querySelector(".wm-profil-page__jeu");
    const cases = [...s.querySelectorAll(".wm-tcard__pkmn")];
    return {
      cachee: s.hidden,
      titre: s.querySelector(".wm-profil-page__titre")?.textContent.trim() ?? null,
      chiffres: [...s.querySelectorAll(".wm-profil-page__chiffre")].map((l) => [
        l.querySelector(".wm-profil-page__nombre").textContent.trim(),
        l.querySelector(".wm-profil-page__mot").textContent.trim(),
      ]),
      //  SIX CASES TOUJOURS, cinq pokémon et une place libre : c'est
      //  la règle de la carte dresseur, et la réutiliser telle quelle
      //  est tout l'intérêt de ne pas avoir réécrit ce rendu.
      cases: cases.length,
      libres: cases.filter((c) => c.className.includes("--libre")).length,
      obscurs: cases.filter((c) => c.className.includes("--obscur")).length,
      sprites: s.querySelectorAll("img.wm-tcard__sprite").length,
      noms: [...s.querySelectorAll(".wm-tcard__nom")].map((n) => n.textContent.trim()),
    };
  });
  ok("elle n'est plus cachée", jeu.cachee === false, jeu.cachee);
  ok("elle porte son titre", jeu.titre === "Son jeu", jeu.titre);
  ok(
    "trois chiffres : palier, pokédollars, badges",
    jeu.chiffres.length === 3 && jeu.chiffres[0][0] === "2" &&
      jeu.chiffres[2][0] === "2",
    jeu.chiffres,
  );
  ok("six cases d'équipe", jeu.cases === 6, jeu.cases);
  ok("dont une place libre", jeu.libres === 1, jeu.libres);
  ok("et le pokémon obscur est marqué", jeu.obscurs === 1, jeu.obscurs);
  ok("cinq sprites", jeu.sprites === 5, jeu.sprites);
  //  LE SURNOM PASSE DEVANT L'ESPÈCE quand il y en a un : c'est le
  //  rendu de la carte, et c'est bien celui-là qu'on réutilise.
  ok(
    "le surnom passe devant l'espèce",
    jeu.noms[0] === "Rouquine" && jeu.noms[1] === "Pikachu",
    jeu.noms,
  );

  for (const theme of ["clair", "sombre"]) {
    const m = await mesurer(theme);
    const rates = m.filter((x) => !x.ok);
    ok(
      `son jeu, ${theme} : ${m.length} textes mesurés, aucun défaut`,
      rates.length === 0,
      rates,
    );
  }
  await p.evaluate(() => document.body.classList.remove("wm-sombre"));

  for (const largeur of [1280, 390]) {
    await p.setViewportSize({ width: largeur, height: 1600 });
    const trop = await p.evaluate(
      (l) =>
        [...document.querySelectorAll(".wm-profil-page__jeu, .wm-profil-page__jeu *")]
          .map((e) => ({
            c: e.className || e.tagName,
            d: Math.round(e.getBoundingClientRect().right - (l - 24)),
          }))
          .filter((x) => x.d > 1),
      largeur,
    );
    ok(`son jeu, ${largeur} px : rien ne dépasse`, trop.length === 0, trop.slice(0, 3));
  }
  await p.setViewportSize({ width: 1280, height: 1400 });
}

// ── 8 · LES QUATRE AUTRES ONGLETS ─────────────────────────────────
//
//  Ils n'ont pas le même balisage que le Profil, et la feuille les
//  habille PAR LEURS CLASSES. Une feuille écrite sans les monter est
//  une feuille écrite sur parole : mon premier jet prenait `.clearfix`
//  pour la rangée des groupes, alors que c'est un div vide de
//  dégagement au milieu du bloc de message.
for (let i = 1; i < ADRESSES.length; i += 1) {
  const nom = ONGLETS[i][0];
  await p.goto(RACINE + ADRESSES[i]);
  await p.addScriptTag({ path: R + "js/harnais-sommaire.js" });
  const monte = await p.evaluate(() => globalThis.wmPoserLeProfil());
  ok(`${nom} : le module remonte la page`, monte === true, { nom, monte });

  const etat = await p.evaluate(() => {
    const page = document.querySelector(".wm-profil-page");
    const panneau = page?.querySelector(".wm-profil-page__panneau") ?? null;
    return {
      onglets: page?.querySelectorAll(".wm-onglet").length ?? 0,
      courant: page?.querySelector('[aria-current="page"]')?.textContent.trim() ?? null,
      carte: page?.querySelector(".wm-profil-page__carte") !== null,
      //  Rien ne doit rester en dehors du panneau : un bloc oublié
      //  retombe sur le fond de page, sans carte sous lui.
      horsPanneau: panneau === null
        ? null
        : [...page.children].filter((e) =>
          !e.classList.contains("wm-profil-page__carte") &&
          !e.classList.contains("wm-profil-page__panneau") &&
          !e.classList.contains("wm-profil-page__jeu") &&
          !e.classList.contains("wm-profil-page__principal") &&
          e.tagName !== "NAV"
        ).map((e) => e.className || e.tagName),
      //  Les trois trous du gabarit RPG : un `<p>` vide, un `<hr>`,
      //  un `fieldset` vide.
      trous: panneau === null ? null : [...panneau.querySelectorAll("p, hr, fieldset")]
        .filter((e) => e.textContent.trim() === "" && e.querySelector("img") === null)
        .filter((e) => getComputedStyle(e).display !== "none")
        .map((e) => e.tagName),
      //  « Du contenu » n'est pas forcément du TEXTE : l'onglet
      //  Contact n'a qu'un libellé et une image.
      vide: panneau === null ? null : panneau.textContent.trim().length,
      images: panneau === null ? 0 : panneau.querySelectorAll("img").length,
    };
  });
  ok(`${nom} : les six onglets suivent`, etat.onglets === 6, etat.onglets);
  ok(`${nom} : l'onglet courant est celui-ci`, etat.courant === nom, etat.courant);
  ok(`${nom} : la carte d'identité reste en tête`, etat.carte === true, etat.carte);
  ok(
    `${nom} : rien ne reste hors du panneau`,
    etat.horsPanneau?.length === 0,
    etat.horsPanneau,
  );
  ok(`${nom} : aucun bloc vide du gabarit n'est affiché`, etat.trous?.length === 0, etat.trous);
  ok(
    `${nom} : le panneau a du contenu`,
    (etat.vide ?? 0) > 20 || etat.images > 0,
    { texte: etat.vide, images: etat.images },
  );

  //  LA MISE EN PAGE PROPRE À CHAQUE ONGLET.
  if (i === 1) {
    const g = await p.evaluate(() =>
      [...document.querySelectorAll(".wm-profil-page__panneau ol > li")].map((l) => {
        const pastille = l.querySelector(".avatar i");
        const r = pastille.getBoundingClientRect();
        const nom = l.querySelector(".message-header").getBoundingClientRect();
        return {
          //  La pastille reprend la couleur inline du groupe par
          //  `currentcolor` : rien à connaître, rien à tenir.
          fond: getComputedStyle(pastille).backgroundColor,
          couleur: pastille.getAttribute("style"),
          ronde: Math.round(r.width) === Math.round(r.height) &&
            parseFloat(getComputedStyle(pastille).borderRadius) >= r.width / 2,
          //  La pastille est À CÔTÉ du nom, pas au-dessus : c'est ce
          //  qui dit que la rangée est bien le `<li>` et pas un div
          //  de dégagement.
          aCote: r.right <= nom.left + 1,
          //  CENTRÉE SUR LA PREMIÈRE LIGNE DU NOM, à deux pixels près :
          //  c'est ce qu'un nombre de marge écrit à la main ne tient
          //  pas quand la police change.
          centree: Math.abs((r.top + r.bottom) / 2 - (nom.top + nom.height / 2)) <= 2,
          //  ET SANS LE DÉCOR DE MODERNBB : disque blanc de 34 px,
          //  bordure blanche, ombre portée.
          decor: [
            getComputedStyle(pastille.parentElement).backgroundColor,
            getComputedStyle(pastille.parentElement).borderTopWidth,
            getComputedStyle(pastille.parentElement).boxShadow,
          ],
        };
      })
    );
    ok("Groupes : cinq rangées", g.length === 5, g.length);
    ok("Groupes : chaque pastille est ronde", g.every((x) => x.ronde), g.map((x) => x.ronde));
    ok(
      "Groupes : chaque pastille porte la couleur de son groupe",
      g.every((x) => x.fond !== "rgba(0, 0, 0, 0)") &&
        new Set(g.map((x) => x.fond)).size === 5,
      g.map((x) => x.fond),
    );
    ok(
      "Groupes : la pastille est à côté du nom",
      g.every((x) => x.aCote),
      g.map((x) => x.aCote),
    );
    ok(
      "Groupes : et centrée sur la première ligne du nom",
      g.every((x) => x.centree),
      g.map((x) => x.centree),
    );
    ok(
      "Groupes : le décor de `.avatar` de ModernBB est défait",
      g.every((x) =>
        x.decor[0] === "rgba(0, 0, 0, 0)" && parseFloat(x.decor[1]) === 0 &&
        x.decor[2] === "none"
      ),
      g[0]?.decor,
    );

    const pieds = await p.evaluate(() =>
      [...document.querySelectorAll(".wm-profil-page__panneau .message-footer")]
        .map((u) => {
          const r = u.getBoundingClientRect();
          const carte = u.closest("li").getBoundingClientRect();
          const bloc = u.closest(".message-block").getBoundingClientRect();
          return {
            //  Au bout du bloc, pas au début : c'est tout ce que
            //  « place le texte à droite » demande, et ce qu'un
            //  `justify-content` n'aurait pas fait — la liste est plus
            //  étroite que la carte.
            aDroite: Math.round(bloc.right - r.right) <= 1,
            dansLaCarte: Math.round(carte.right - r.right) >= 0,
          };
        })
    );
    ok("Groupes : cinq pieds de carte", pieds.length === 5, pieds.length);
    ok(
      "Groupes : « Voir plus » est au bout de sa carte",
      pieds.every((x) => x.aDroite && x.dansLaCarte),
      pieds,
    );
  }
  if (i === 2) {
    const a = await p.evaluate(() =>
      [...document.querySelectorAll(".wm-profil-page__panneau .award_row")].map((r) => {
        const b = r.querySelector(".award");
        const bb = b.getBoundingClientRect();
        const d = r.querySelector(".award_desc").getBoundingClientRect();
        return {
          image: getComputedStyle(b).backgroundImage !== "none",
          rond: Math.round(bb.width) === Math.round(bb.height),
          large: Math.round(bb.width),
          //  Les descriptions tombent toutes au même endroit.
          gauche: Math.round(d.left),
          //  DANS CET ONGLET, LE VRAI FORUM NE POSE PAS D'INFOBULLE :
          //  le nom est écrit juste à côté. J'en cherchais une, et
          //  `getComputedStyle(null)` jette.
          bulle: r.querySelector(".award_tooltiptext") === null
            ? "none"
            : getComputedStyle(r.querySelector(".award_tooltiptext")).display,
        };
      })
    );
    ok("Récompenses : quatre rangées", a.length === 4, a.length);
    ok("Récompenses : chaque badge peint son image", a.every((x) => x.image), a);
    ok(
      "Récompenses : aucun badge écrasé en ovale",
      a.every((x) => x.rond && x.large > 30),
      a.map((x) => [x.large, x.rond]),
    );
    ok(
      "Récompenses : les descriptions commencent au même endroit",
      new Set(a.map((x) => x.gauche)).size === 1,
      a.map((x) => x.gauche),
    );
    ok(
      "Récompenses : pas d'infobulle, le nom est écrit à côté",
      a.every((x) => x.bulle === "none"),
      a.map((x) => x.bulle),
    );
  }
  if (i === 3) {
    const c = await p.evaluate(() => {
      const img = document.querySelector(".wm-profil-page__champs dd img");
      const r = img.getBoundingClientRect();
      const dl = img.closest("dl");
      const dt = dl.querySelector("dt").getBoundingClientRect();
      return {
        haute: Math.round(r.height),
        large: Math.round(r.width),
        //  L'image est grande ; le libellé doit rester AU-DESSUS, ou
        //  au niveau du haut de l'image — jamais collé à son bas, ce
        //  qui est ce que donne un alignement sur la ligne de base.
        enHaut: dt.top <= r.top + 8,
        aligne: getComputedStyle(dl).alignItems,
      };
    });
    //  LE PIÈGE DU 8 NOVEMBRE : j'avais plafonné toutes les images de
    //  champ à 1,4 em pour l'icône de genre. La carte de dresseur
    //  serait sortie en timbre-poste.
    ok("Contact : la carte de dresseur est une vraie image", c.haute > 60, c);
    ok("Contact : elle ne déborde pas de sa colonne", c.large <= 500, c.large);
    ok("Contact : le libellé reste en haut de la ligne", c.enHaut, c);
  }
  if (i === 4) {
    const r = await p.evaluate(() =>
      [...document.querySelectorAll(".wm-profil-page__panneau .column2")].map((c) => {
        const dt = c.querySelector("dt").getBoundingClientRect();
        const dd = c.querySelector("dd").getBoundingClientRect();
        return {
          mot: c.querySelector("dt").textContent.trim(),
          memeLigne: Math.abs(dt.top - dd.top) < 8,
          droite: Math.round(dd.right),
        };
      })
    );
    ok("Feuille : sept champs", r.length === 7, r.length);
    ok(
      "Feuille : chaque libellé est sur la ligne de sa valeur",
      r.every((x) => x.memeLigne),
      r.filter((x) => !x.memeLigne),
    );
    ok(
      "Feuille : les valeurs finissent au même endroit",
      new Set(r.map((x) => x.droite)).size === 1,
      r.map((x) => x.droite),
    );
  }

  if (i === 5) {
    const st = await p.evaluate(() => {
      const blocs = [...document.querySelectorAll(".wm-profil-page__panneau .stats-field")];
      return blocs.map((b) => {
        const leg = b.querySelector("legend").getBoundingClientRect();
        const prem = b.querySelector("li").getBoundingClientRect();
        const lignes = [...b.querySelectorAll("li")].map((l) => {
          const lab = l.querySelector("label").getBoundingClientRect();
          const r = l.getBoundingClientRect();
          return {
            seul: l.querySelector("label").children.length === l.childNodes.length - 0 &&
              l.textContent.trim() === l.querySelector("label").textContent.trim(),
            //  LE LIBELLÉ À GAUCHE, LA VALEUR À DROITE : c'est tout
            //  l'objet de cette passe, et la valeur n'étant pas dans
            //  un élément, on la mesure par ce qui reste de la ligne.
            aGauche: Math.round(lab.left - r.left) <= 1,
            finit: Math.round(r.right - lab.right),
            puce: getComputedStyle(l).listStyleType,
            casse: getComputedStyle(l.querySelector("label")).textTransform,
            retrait: getComputedStyle(l.parentElement).paddingLeft,
          };
        });
        const boite = b.getBoundingClientRect();
        return {
          legende: b.querySelector("legend").textContent.trim(),
          gauche: Math.round(boite.left),
          haut: Math.round(boite.top),
          //  LA LÉGENDE EST AU-DESSUS DE LA PREMIÈRE LIGNE, pas à
          //  cheval sur le bord : c'est le placement que le navigateur
          //  donne à `<legend>` et qu'il faut défaire.
          auDessus: leg.bottom <= prem.top + 1,
          lignes,
        };
      });
    });
    ok("Statistiques : trois blocs", st.length === 3, st.map((b) => b.legende));
    //  L'UN SOUS L'AUTRE, chacun sur toute la largeur : en colonnes,
    //  le troisième commençait au milieu du second et laissait un
    //  trou sous le premier.
    ok(
      "Statistiques : les trois sont empilés, pas en colonnes",
      st.every((b, i) => i === 0 || b.gauche === st[0].gauche) &&
        st.every((b, i) => i === 0 || b.haut > st[i - 1].haut),
      st.map((b) => [b.legende, b.gauche, b.haut]),
    );
    ok(
      "Statistiques : chaque légende est au-dessus de sa liste",
      st.every((b) => b.auDessus),
      st.map((b) => [b.legende, b.auDessus]),
    );
    const toutes = st.flatMap((b) => b.lignes);
    ok("Statistiques : douze lignes", toutes.length === 12, toutes.length);
    ok(
      "Statistiques : aucun retrait de 40 px hérité de ModernBB",
      toutes.every((l) => parseFloat(l.retrait) === 0),
      [...new Set(toutes.map((l) => l.retrait))],
    );
    ok(
      "Statistiques : aucune puce",
      toutes.every((l) => l.puce === "none"),
      [...new Set(toutes.map((l) => l.puce))],
    );
    ok(
      "Statistiques : chaque libellé commence à gauche de sa ligne",
      toutes.every((l) => l.aGauche),
      toutes.filter((l) => !l.aGauche).length,
    );
    //  LES DEUX LIGNES QUI N'ONT QU'UN LIEN existent, et elles ne
    //  sont pas distinguables en CSS : la valeur d'une ligne
    //  ordinaire est un nœud de texte, pas un élément, donc
    //  `:only-child` les attrape toutes. On vérifie ici qu'aucune
    //  règle ne prétend le contraire — les quatre libellés d'un bloc
    //  se lisent de la même façon.
    const seules = toutes.filter((l) => l.seul);
    ok("Statistiques : deux lignes sans valeur", seules.length === 2, seules.length);
    ok(
      "Statistiques : les libellés se lisent tous pareil",
      new Set(toutes.map((l) => l.casse)).size === 1,
      [...new Set(toutes.map((l) => l.casse))],
    );
  }

  //  ET LE CONTRASTE, ONGLET PAR ONGLET.
  for (const theme of ["clair", "sombre"]) {
    const m = await mesurer(theme);
    const rates = m.filter((x) => !x.ok);
    ok(
      `${nom}, ${theme} : ${m.length} textes mesurés, aucun défaut`,
      rates.length === 0,
      rates,
    );
  }
  await p.evaluate(() => document.body.classList.remove("wm-sombre"));

  //  RIEN NE DÉPASSE, LARGE ET ÉTROIT.
  for (const largeur of [1280, 390]) {
    await p.setViewportSize({ width: largeur, height: 1400 });
    const trop = await p.evaluate(
      (l) =>
        [...document.querySelectorAll(".wm-profil-page, .wm-profil-page *")]
          .map((e) => ({
            c: e.className || e.tagName,
            d: Math.round(e.getBoundingClientRect().right - (l - 24)),
          }))
          .filter((x) => x.d > 1),
      largeur,
    );
    ok(`${nom}, ${largeur} px : rien ne dépasse`, trop.length === 0, trop.slice(0, 3));
  }
  await p.setViewportSize({ width: 1280, height: 1400 });
}

for (const s of soucis) ok(s, false, s);

if (Deno.args.includes("--apercu")) {
  const html = await p.content();
  Deno.writeTextFileSync(R + "apercu-profil.html", html);
  console.log("aperçu : apercu-profil.html");
}
if (Deno.args.includes("--photo")) {
  //  UNE PHOTO PAR ONGLET : la boucle a laissé la page sur le
  //  dernier, et une seule image ne montrerait qu'un cinquième du
  //  travail.
  for (let i = 0; i < ADRESSES.length; i += 1) {
    await p.goto(RACINE + ADRESSES[i]);
    await p.addScriptTag({ path: R + "js/harnais-sommaire.js" });
    await p.evaluate(() => globalThis.wmPoserLeProfil());
    //  « SON JEU » SUR LA PHOTO DU PREMIER ONGLET : il ne se remplit
    //  qu'une fois Supabase répondu, et une image sans lui montrerait
    //  une page qu'on ne verra jamais.
    if (i === 0) {
      await p.evaluate(() =>
        globalThis.wmPoserSonJeu("https://exemple.supabase.co", "cle-publiable")
      );
    }
    await p.evaluate(() => document.activeElement?.blur());
    for (const theme of ["clair", "sombre"]) {
      await p.evaluate(
        (t) => document.body.classList.toggle("wm-sombre", t === "sombre"),
        theme,
      );
      const nom = ONGLETS[i][0].toLowerCase().split(" ")[0]
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      await p.screenshot({ path: `${R}profil-${nom}-${theme}.png`, fullPage: true });
    }
  }
  console.log("photos : profil-<onglet>-<theme>.png");
}

await nav.close();
console.log(fautes === 0 ? "\n  TOUT PASSE." : `\n  ${fautes} défaut(s).`);
Deno.exit(fautes === 0 ? 0 : 1);
