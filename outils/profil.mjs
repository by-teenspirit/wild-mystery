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
const BADGE = "data:image/svg+xml;base64," +
  btoa(
    '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64">' +
      '<circle cx="32" cy="32" r="30" fill="#b1402f"/></svg>',
  );

const GAUCHE = `<div id="profile-advanced-layout"><div id="profile-advanced-left">
<div id="new-message"><div id="tabs"><ul>
<li class="activetab"><a href="#"><span>Profil</span></a></li>
<li><a href="/u1groups"><span>Groupes</span></a></li>
<li><a href="/u1awards"><span>Récompenses</span></a></li>
<li><a href="/u1contact"><span>Contact</span></a></li>
<li><a href="/u1rpg"><span>Feuille de personnage</span></a></li>
</ul></div></div>
<div id="profile-advanced-details" class="panel row3"><div class="inner">
<span class="corners-top"><span></span></span>
<div id="cp-main" class="ucp-main">
<h1>Tout à propos de <span class="group-2 usr_grp_clr" style="color:#808080"><strong>Arceus</strong></span></h1>
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
<dl id="field_id-7"><dt>Genre : </dt><dd><div class="field_uneditable"><img src="${BADGE}" alt="Féminin" title="Féminin"></div></dd></dl>
<div class="separator">&nbsp;</div>
</div></div><span class="corners-bottom"><span></span></span></div></div>
</div><span class="corners-bottom"><span></span></span></div></div></div></div>`;

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

const page = `<!doctype html><html lang="fr"><head><meta charset="utf-8">
<style>${readFileSync(R + "panneau-admin/jetons.css", "utf8")}</style>
<style>${readFileSync(R + "css/wild-mystery.css", "utf8")}</style>
<style>html,body{margin:0}body{background:var(--wm-fond-page);padding:24px}
  #main-content{margin:0 auto;max-width:1000px}</style></head>
<body id="modernbb"><div id="page-body"><div id="main-content">
${GAUCHE}
${DROITE}
</div></div></body></html>`;

const nav = await chromium.launch(CHROME === undefined ? {} : { executablePath: CHROME });
const p = await nav.newPage({ viewport: { width: 1280, height: 1200 } });
const soucis = [];
p.on("pageerror", (e) => soucis.push("erreur JS : " + e.message));
//  L'ADRESSE COMPTE : le module y lit l'identifiant du membre, et
//  construit les trois boutons avec. Servie sur `about:blank`, la
//  page n'aurait pas de `pathname` et la carte sortirait sans actions.
const ADRESSE = "https://mysteryinrhode.forumactif.com/u1";
await p.route(
  "**/*",
  (r) =>
    r.request().url() === ADRESSE
      ? r.fulfill({ contentType: "text/html; charset=utf-8", body: page })
      : r.fulfill({ status: 204, body: "" }),
);
await p.goto(ADRESSE);
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
    recadre: av === null ? null : getComputedStyle(av).objectFit,
    source: av === null ? null : [av.naturalWidth, av.naturalHeight],
    //  Le pseudo garde le `style="color:…"` que le panneau pose.
    nom: c.querySelector(".wm-profil-page__nom")?.textContent.trim() ?? null,
    couleur: c.querySelector(".wm-profil-page__nom .usr_grp_clr")
      ?.getAttribute("style") ?? null,
    rang: c.querySelector(".wm-profil-page__rang")?.textContent.trim() ?? null,
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
  ok(
    "l'avatar fait 200 × 320",
    carte.avatar?.[0] === 200 && carte.avatar?.[1] === 320,
    { boite: carte.avatar, source: carte.source },
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
ok("les cinq onglets sont là", onglets.length === 5, onglets.map((o) => o.mot));
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
  return { colonnes: getComputedStyle(l).columnCount, lignes };
});
ok("les six champs sont montés", champs?.lignes.length === 6, champs?.lignes.length);
ok(
  "chaque libellé est sur la ligne de sa valeur",
  champs.lignes.every((l) => l.memeLigne),
  champs.lignes.filter((l) => !l.memeLigne),
);
ok("ils tiennent sur deux colonnes", champs.colonnes === "2", champs.colonnes);
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
      colonnes: getComputedStyle(document.querySelector(".wm-profil-page__champs"))
        .columnCount,
    };
  }, largeur);
  ok(`${largeur} px : rien ne dépasse`, etat.trop.length === 0, etat.trop.slice(0, 3));
  //  L'AVATAR NE S'ÉCRASE JAMAIS. Dans un flex, une image rétrécit
  //  sous sa largeur déclarée dès que le texte à côté pousse : c'est
  //  le défaut qui ne se voit qu'à 1000 px.
  ok(
    `${largeur} px : l'avatar fait toujours 200 × 320`,
    etat.avatar[0] === 200 && etat.avatar[1] === 320,
    etat.avatar,
  );
  if (largeur === 390) {
    ok("390 px : les champs passent sur une colonne", etat.colonnes === "1", etat.colonnes);
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

for (const s of soucis) ok(s, false, s);

if (Deno.args.includes("--apercu")) {
  const html = await p.content();
  Deno.writeTextFileSync(R + "apercu-profil.html", html);
  console.log("aperçu : apercu-profil.html");
}
if (Deno.args.includes("--photo")) {
  //  ON REND LE FOCUS AVANT DE PHOTOGRAPHIER : le contrôle du clavier
  //  a laissé une infobulle de badge ouverte, et elle se retrouvait
  //  sur l'image comme si elle y était tout le temps.
  await p.evaluate(() => document.activeElement?.blur());
  for (const theme of ["clair", "sombre"]) {
    await p.evaluate(
      (t) => document.body.classList.toggle("wm-sombre", t === "sombre"),
      theme,
    );
    await p.screenshot({ path: `${R}profil-${theme}.png`, fullPage: true });
    console.log(`photo : ${R}profil-${theme}.png`);
  }
}

await nav.close();
console.log(fautes === 0 ? "\n  TOUT PASSE." : `\n  ${fautes} défaut(s).`);
Deno.exit(fautes === 0 ? 0 : 1);
