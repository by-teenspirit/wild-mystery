// ════════════════════════════════════════════════════════════════════
//  outils/enligne.mjs — « Qui est en ligne ? » dans un vrai navigateur.
//
//  CE QUE CE HARNAIS REGARDE :
//
//    · les trois chiffres sont lus par POSITION et pas par phrase —
//      on sert donc la même page en anglais, et elle doit donner les
//      mêmes nombres ;
//    · les milliers à la française se lisent (« 3 214 », avec une
//      espace insécable, et pas 3) ;
//    · les deux listes de connectés se remplissent quand Forumactif
//      les sert, et disent « personne » quand il ne les sert pas —
//      c'est le cas de Wild Mystery aujourd'hui, l'option n'est pas
//      cochée ;
//    · la carte du clan prend la couleur de SON clan, et un clan
//      encore vide ne donne pas de carte creuse ;
//    · rien ne déborde, à 1 440 comme à 390.
//
//  LE DÉCOR REPRODUIT `.statistics` TEL QUE MODERNBB LE SERT, relevé
//  sur le forum le 8 octobre, balisage et libellés compris.
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

/** `.statistics`, mot pour mot. Les nombres passent en paramètre pour
 *  qu'on puisse servir « 3 214 » avec son espace insécable. */
const statistiques = (messages, membres, dernier) => `
<div class="statistics"><div class="wrap">
  <div class="statistics-item">Nos membres ont posté un total de <strong>${messages}</strong> messages</div>
  <div class="statistics-item">Nous avons <strong>${membres}</strong> membres enregistrés</div>
  <div class="statistics-item">L'utilisateur enregistré le plus récent est <strong><a href="/u4"><span class="group-4 usr_grp_clr" style="color:#B56A45"><strong>${dernier}</strong></span></a></strong></div>
</div></div>`;

/** Le bloc que Forumactif sert QUAND l'option est cochée. Il ne l'est
 *  pas sur Wild Mystery : ce balisage est celui d'un forum ModernBB
 *  ordinaire, et c'est pour ça que le module cherche large. */
const enLigne = `
<div id="onlinelist">
  <p>Il y a en tout <strong>3</strong> utilisateurs en ligne</p>
  <a href="/u3" class="group-2 usr_grp_clr">Maître du Jeu</a>,
  <a href="/u1">Arceus</a>,
  <a href="/u4">Compte de test</a>
</div>
<div id="onlinelist_24h">
  <a href="/u3">Maître du Jeu</a>, <a href="/u7">Lyra</a>
</div>`;

/** Le bloc de `templates/index_body.nouveau.html`, tel que Forumactif
 *  le sert une fois les balises nommées posées. C'est LA SOURCE : le
 *  panneau doit se mettre à sa place, et le retirer. */
const source = `
<div class="block wm-qeel" id="wm-qeel">
  <div class="h3"><a href="/viewonline" rel="nofollow">Qui est en ligne ?</a></div>
  <div id="wm-qeel-maintenant">
    <a href="/u3" class="group-2 usr_grp_clr">Maître du Jeu</a>,
    <a href="/u1">Arceus</a>,
    <a href="/u4">Compte de test</a>
  </div>
  <div id="wm-qeel-24h">
    <a href="/u3">Maître du Jeu</a>, <a href="/u7">Lyra</a>
  </div>
</div>
`;

/** Une catégorie, telle que `index_box` la sert. Sortie de `page` pour
 *  qu'on puisse servir un index qui n'en a aucune. */
const categorie = `
<div class="forabg"><ul class="topiclist"><li class="header"><dl class="icon">
  <dd class="dterm"><div class="table-title"><h2>Une catégorie</h2></div></dd>
</dl></li></ul></div>`;

const page = (stats, liste, cats = categorie) => `<!doctype html><html lang="fr"><head><meta charset="utf-8">
<style>${readFileSync(R + "panneau-admin/jetons.css", "utf8")}</style>
<style>${readFileSync(R + "css/wild-mystery.css", "utf8")}</style>
<style>body{margin:0;font-size:10px;background:var(--wm-fond-page)}#page-body{padding:24px}</style>
</head><body id="modernbb"><div id="page-body">
${cats}
${liste}
${stats}
</div></body></html>`;

const nav = await chromium.launch(CHROME === undefined ? {} : { executablePath: CHROME });
const soucis = [];
const dire = (nom, ok, detail = "") => {
  console.log(`${ok ? "  ok  " : "DÉFAUT"} ${nom}${detail ? " — " + detail : ""}`);
  if (!ok) soucis.push(nom + (detail ? " — " + detail : ""));
};

/** Ouvre une page avec le décor voulu et le paquet dessus. */
async function ouvrir(corps, clans) {
  const p = await nav.newPage({ viewport: { width: 1440, height: 900 } });
  p.on("pageerror", (e) => soucis.push("erreur JS : " + e.message));
  await p.route("**/*", (r) => {
    const u = r.request().url();
    if (u.endsWith("/data/clans.json")) {
      return clans === null
        ? r.fulfill({ status: 503, body: "" })
        : r.fulfill({ contentType: "application/json", body: JSON.stringify(clans) });
    }
    if (u.endsWith("/js/wild-mystery.js")) {
      return r.fulfill({
        contentType: "text/javascript",
        body: readFileSync(R + "js/wild-mystery.js", "utf8"),
      });
    }
    if (u.endsWith("/data/carte.json") || u.endsWith("/data/navigation.json")) {
      return r.fulfill({ status: 404, body: "" });
    }
    return r.fulfill({ contentType: "text/html; charset=utf-8", body: corps });
  });
  await p.goto("http://wild-mystery.test/");
  await p.addScriptTag({ url: "http://wild-mystery.test/js/wild-mystery.js" });
  await p.waitForTimeout(500);
  return p;
}

const CLANS = JSON.parse(readFileSync(R + "data/clans.json", "utf8"));

// ── 1 · le cas du forum réel : l'option n'est pas cochée ────────────
const p = await ouvrir(page(statistiques("436", "3", "Compte de test"), ""), CLANS);

const pose = await p.evaluate(() => {
  const b = document.querySelector(".wm-enligne");
  if (b === null) return null;
  return {
    titre: b.querySelector(".wm-enligne__titre")?.textContent.trim(),
    colonnes: b.querySelectorAll(".wm-enligne__colonne").length,
    compteurs: [...b.querySelectorAll(".wm-enligne__compteur")].map((c) => ({
      n: c.querySelector(".wm-enligne__compteur-n").textContent.trim(),
      mot: c.querySelector(".wm-enligne__compteur-mot").textContent.trim(),
    })),
    arrive: b.querySelector(".wm-enligne__arrive-nom")?.textContent.trim(),
    arriveUrl: b.querySelector(".wm-enligne__arrive-nom")?.getAttribute("href"),
    personne: [...b.querySelectorAll(".wm-enligne__personne")].length,
    //  Il se range APRÈS la dernière catégorie.
    apresLesForums: b.previousElementSibling?.classList.contains("forabg") === true ||
      [...document.querySelectorAll(".forabg")].every((f) =>
        f.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING
      ),
  };
});
dire("LE BLOC EST POSÉ", pose !== null, JSON.stringify(pose));
dire("il a son titre et ses trois colonnes", pose?.titre === "Qui est en ligne ?" && pose?.colonnes === 3);
dire("et il se range après les forums", pose?.apresLesForums === true);
dire(
  "LES DEUX COMPTEURS SONT LUS DANS LA PAGE",
  pose?.compteurs[0]?.n === "436" && pose?.compteurs[0]?.mot === "messages" &&
    pose?.compteurs[1]?.n === "3" && pose?.compteurs[1]?.mot === "membres",
  JSON.stringify(pose?.compteurs),
);
dire(
  "le dernier arrivé aussi, avec l'adresse de son profil",
  pose?.arrive === "Compte de test" && pose?.arriveUrl === "/u4",
  JSON.stringify({ n: pose?.arrive, u: pose?.arriveUrl }),
);
dire(
  "SANS L'OPTION DE FORUMACTIF, LES DEUX CARTES DISENT « PERSONNE »",
  pose?.personne === 2,
  `${pose?.personne} carte(s) sur 2`,
);

const clan = await p.evaluate(() => {
  const c = document.querySelector(".wm-enligne__clan");
  if (c === null) return null;
  const s = getComputedStyle(c);
  return {
    cle: c.dataset.wmClan,
    nom: c.querySelector(".wm-enligne__clan-nom")?.textContent.trim(),
    texte: (c.querySelector(".wm-enligne__clan-texte")?.textContent ?? "").length,
    avantage: c.querySelector(".wm-enligne__avantage-texte")?.textContent.trim(),
    fond: s.backgroundColor,
    //  La couleur doit venir du JETON du clan, pas d'une valeur écrite
    //  dans la feuille : on compare à ce que le panneau déclare.
    jeton: getComputedStyle(document.documentElement).getPropertyValue("--wm-groupe-ho-oh-fond")
      .trim(),
  };
});
dire("LA CARTE DU CLAN EST LÀ", clan !== null, JSON.stringify(clan));
dire("elle nomme le clan du moment", clan?.cle === "ho-oh" && clan?.nom === "Ho-Oh");
dire("elle porte sa description entière", (clan?.texte ?? 0) > 200, `${clan?.texte} caractères`);
dire(
  "et son avantage",
  (clan?.avantage ?? "").startsWith("+ 10 %"),
  clan?.avantage,
);
dire(
  "SA COULEUR VIENT DU JETON DE SON CLAN",
  //  `#f3d8c0` rendu en rgb : on compare les deux après conversion.
  (() => {
    const j = clan?.jeton ?? "";
    const m = j.match(/^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
    if (m === null) return false;
    const attendu = `rgb(${parseInt(m[1], 16)}, ${parseInt(m[2], 16)}, ${parseInt(m[3], 16)})`;
    return clan?.fond === attendu;
  })(),
  JSON.stringify({ fond: clan?.fond, jeton: clan?.jeton }),
);

// ── 2 · rien ne déborde ─────────────────────────────────────────────
for (const [l, h] of [[1440, 900], [900, 800], [390, 844]]) {
  await p.setViewportSize({ width: l, height: h });
  await p.waitForTimeout(120);
  const d = await p.evaluate(() => ({
    debord: document.documentElement.scrollWidth > document.documentElement.clientWidth,
    clan: Math.round(document.querySelector(".wm-enligne__clan").getBoundingClientRect().width),
  }));
  dire(`à ${l} px, rien ne déborde`, !d.debord, JSON.stringify(d));
  dire(`à ${l} px, la carte du clan a une largeur`, d.clan > 0, `${d.clan} px`);
}
await p.close();

// ── 3 · l'option cochée : les listes se remplissent ─────────────────
const p2 = await ouvrir(page(statistiques("3&nbsp;214", "27", "Ines Kervadec"), enLigne), CLANS);
const avecListes = await p2.evaluate(() => {
  const b = document.querySelector(".wm-enligne");
  const listes = [...b.querySelectorAll(".wm-enligne__gens")];
  return {
    personne: b.querySelectorAll(".wm-enligne__personne").length,
    gens: listes.map((l) => [...l.querySelectorAll("a")].map((a) => a.textContent.trim())),
    messages: b.querySelector(".wm-enligne__compteur-n").textContent.trim(),
    arrive: b.querySelector(".wm-enligne__arrive-nom")?.textContent.trim(),
  };
});
dire(
  "QUAND FORUMACTIF SERT LES LISTES, ELLES SE REMPLISSENT",
  avecListes.personne === 0 && avecListes.gens.length === 2,
  JSON.stringify(avecListes.gens),
);
dire(
  "les trois connectés sont là, sans doublon",
  avecListes.gens[0]?.length === 3 && avecListes.gens[0].includes("Arceus"),
  JSON.stringify(avecListes.gens[0]),
);
dire("et les deux des vingt-quatre heures", avecListes.gens[1]?.length === 2);
dire(
  "LES MILLIERS À LA FRANÇAISE SE LISENT",
  //  « 3 214 » avec une espace insécable. `parseInt` rendrait 3.
  avecListes.messages === "3 214" || avecListes.messages === "3 214" ||
    avecListes.messages === "3 214",
  JSON.stringify(avecListes.messages),
);
await p2.close();

// ── 4 · UN CLAN ENCORE VIDE NE DONNE PAS DE CARTE CREUSE ────────────
//
//  Cinq des six clans n'ont pas encore leur texte. Si `duMoment` en
//  désigne un, mieux vaut pas de carte qu'un cadre au nom d'un clan et
//  au corps vide : celui-là ferait croire à une panne, et on
//  chercherait le défaut dans le code.
const p3 = await ouvrir(
  page(statistiques("436", "3", "Compte de test"), ""),
  { duMoment: "mew", clans: CLANS.clans },
);
const vide = await p3.evaluate(() => ({
  bloc: document.querySelector(".wm-enligne") !== null,
  clan: document.querySelector(".wm-enligne__clan") !== null,
  compteurs: document.querySelectorAll(".wm-enligne__compteur").length,
}));
dire("un clan encore vide ne donne pas de carte", vide.clan === false, JSON.stringify(vide));
dire("mais le reste du bloc tient", vide.bloc && vide.compteurs === 2, JSON.stringify(vide));
await p3.close();

// ── 5 · SANS `clans.json`, LE BLOC TIENT QUAND MÊME ─────────────────
const p4 = await ouvrir(page(statistiques("436", "3", "Compte de test"), ""), null);
const sansFichier = await p4.evaluate(() => ({
  bloc: document.querySelector(".wm-enligne") !== null,
  clan: document.querySelector(".wm-enligne__clan") !== null,
  messages: document.querySelector(".wm-enligne__compteur-n")?.textContent.trim(),
}));
dire(
  "SANS LE FICHIER DES CLANS, ON PERD LA CARTE ET PAS LES CHIFFRES",
  sansFichier.bloc && !sansFichier.clan && sansFichier.messages === "436",
  JSON.stringify(sansFichier),
);
await p4.close();

// ── 6 · LES CHIFFRES SE LISENT PAR POSITION, PAS PAR PHRASE ─────────
//
//  C'est la raison d'être de ce bloc. La même page en anglais, avec
//  d'autres libellés : les nombres doivent être les mêmes. Une lecture
//  par expression régulière sur « Nos membres ont posté » rendrait
//  zéro ici, sans rien dire.
const anglais = `
<div class="statistics"><div class="wrap">
  <div class="statistics-item">Our users have posted a total of <strong>436</strong> messages</div>
  <div class="statistics-item">We have <strong>3</strong> registered users</div>
  <div class="statistics-item">The newest registered user is <strong><a href="/u4">Compte de test</a></strong></div>
</div></div>`;
const p5 = await ouvrir(page(anglais, ""), CLANS);
const enAnglais = await p5.evaluate(() => ({
  n: [...document.querySelectorAll(".wm-enligne__compteur-n")].map((e) => e.textContent.trim()),
  arrive: document.querySelector(".wm-enligne__arrive-nom")?.textContent.trim(),
}));
dire(
  "LE FORUM EN ANGLAIS DONNE LES MÊMES NOMBRES",
  enAnglais.n[0] === "436" && enAnglais.n[1] === "3" && enAnglais.arrive === "Compte de test",
  JSON.stringify(enAnglais),
);
await p5.close();

// ── 7 · LE GABARIT POSÉ : UN SEUL BLOC, ET À LA BONNE PLACE ─────────
//
//  « Pourquoi est-ce que j'en ai 2 qui s'affiche ? », 9 octobre. Le
//  gabarit imprimait son bloc, le script en ajoutait un second. Ce cas
//  est celui qui tombe en panne si la faute revient.
const p6 = await ouvrir(page(statistiques("436", "3", "Compte de test"), source), CLANS);
const unSeul = await p6.evaluate(() => {
  const b = document.querySelector(".wm-enligne");
  return {
    //  Combien de blocs « qui est en ligne » à l'écran, tous dessins
    //  confondus : le nôtre, et celui du gabarit s'il traîne encore.
    panneaux: document.querySelectorAll(".wm-enligne").length,
    source: document.getElementById("wm-qeel") !== null,
    //  ── COMBIEN DE BLOCS PARLENT DE QUI EST EN LIGNE ─────────────
    //
    //  « Le QEEL est toujours pas bon, il est en double. » Compter les
    //  `.wm-enligne` ne suffisait pas : le second bloc n'était pas un
    //  panneau à moi, c'était un `.block` de ModernBB que le gabarit
    //  gardait à côté. Vu de la page, c'est pourtant bien un second
    //  « qui est en ligne ».
    //
    //  On compte donc ce que le LECTEUR compte : tout bloc de premier
    //  rang dont le texte propre parle de connexion. Il doit y en
    //  avoir UN.
    parlentDEnLigne: [...document.querySelectorAll("#page-body > *, #page-body .block, #page-body .wm-enligne")]
      .filter((e) =>
        /qui est en ligne|utilisateurs? en ligne|connect[ée]s?|record de connexions/i.test(
          [...e.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join(" ") +
            " " +
            [...e.querySelectorAll(":scope > *")].filter((c) => c.children.length === 0)
              .map((c) => c.textContent).join(" "),
        )
      ).length,
    reste: document.querySelector(".wm-qeel-reste") !== null,
    gens: [...b.querySelectorAll(".wm-enligne__gens")].map((l) =>
      [...l.querySelectorAll("a")].map((a) => a.textContent.trim())
    ),
    personne: b.querySelectorAll(".wm-enligne__personne").length,
    //  Il prend la place du bloc du gabarit, donc il reste après les
    //  forums — c'est là que `{BOARD_INDEX}` le met.
    apresLesForums: [...document.querySelectorAll(".forabg")].every((f) =>
      f.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING
    ),
  };
});
dire("IL N'Y A QU'UN SEUL BLOC EN LIGNE", unSeul.panneaux === 1, JSON.stringify(unSeul));
dire("LA SOURCE DU GABARIT A ÉTÉ RETIRÉE", unSeul.source === false);
dire("et le panneau reste après les forums", unSeul.apresLesForums === true);
dire(
  "LES LISTES SE LISENT DANS LES BALISES DU GABARIT",
  unSeul.personne === 0 && unSeul.gens[0]?.length === 3 && unSeul.gens[1]?.length === 2,
  JSON.stringify(unSeul.gens),
);
dire(
  "UN SEUL BLOC PARLE DE QUI EST EN LIGNE, PANNEAUX ET `.block` CONFONDUS",
  unSeul.parlentDEnLigne === 1,
  `${unSeul.parlentDEnLigne} bloc(s)`,
);
dire(
  "le gabarit ne garde plus de pavé ModernBB à côté",
  unSeul.reste === false,
);
await p6.close();

// ── 8 · LA SOURCE SEULE SUFFIT, SANS AUCUNE CATÉGORIE ───────────────
//
//  Un index vide — un forum neuf, ou toutes les catégories masquées —
//  n'a pas de `.forabg` : l'ancienne version se taisait, faute d'avoir
//  où se poser. Avec le gabarit, elle a une place, et les noms ne
//  peuvent venir QUE de la source.
const p7 = await ouvrir(page(statistiques("436", "3", "Compte de test"), source, ""), CLANS);
const sansCategorie = await p7.evaluate(() => ({
  categories: document.querySelectorAll(".forabg").length,
  panneaux: document.querySelectorAll(".wm-enligne").length,
  noms: [...document.querySelectorAll(".wm-enligne__gens-lien")].map((a) => a.textContent.trim()),
  source: document.getElementById("wm-qeel") !== null,
}));
dire(
  "SANS AUCUNE CATÉGORIE, LA SOURCE DONNE QUAND MÊME SA PLACE",
  sansCategorie.categories === 0 && sansCategorie.panneaux === 1 &&
    sansCategorie.source === false,
  JSON.stringify(sansCategorie),
);
dire(
  "et les noms survivent au retrait de leur source",
  sansCategorie.noms.includes("Arceus") && sansCategorie.noms.includes("Lyra"),
  JSON.stringify(sansCategorie.noms),
);
await p7.close();

await nav.close();
if (soucis.length > 0) for (const s of soucis) console.log("  · " + s);
console.log(soucis.length === 0 ? "\nTOUT PASSE." : `\n${soucis.length} DÉFAUT(S).`);
Deno.exit(soucis.length === 0 ? 0 : 1);
