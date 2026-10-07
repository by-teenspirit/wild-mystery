// ════════════════════════════════════════════════════════════════════
//  outils/navigation.mjs — la barre, le panneau et le menu du compte,
//  vérifiés dans un vrai navigateur, avec le VRAI switcheroo.
//
//  USAGE :  deno task navigation
//
//  POURQUOI CE HARNAIS EXISTE. Tout ce que fait `module-navigation` est
//  du DOM posé sur une page qui n'est pas à nous : une barre qu'on
//  remplace, une barre tierce qu'on habille, un script tiers qu'on
//  relaie. Rien de tout ça ne se teste en pur, et « ça a l'air bon » a
//  déjà coûté une barre qui ne prenait pas la largeur, un panneau qui
//  passait sous la barre, et un switcheroo qu'on ne pouvait pas remplir.
//
//  Il monte un squelette ModernBB — `body#modernbb`, la barre d'origine
//  dans son `.wrap`, la barre Forumactif avec son lien de compte et sa
//  déconnexion à jeton — puis charge NOTRE paquet et laisse notre module
//  aller chercher le switcheroo tout seul, comme sur le forum.
//
//  ── IL VA CHERCHER LE SWITCHEROO SUR LE RÉSEAU ──────────────────────
//
//  À son commit épinglé, celui que `module-switcheroo.ts` sert. Le dépôt
//  ne le recopie pas (il n'a aucune licence), et un harnais qui se
//  contenterait d'un faux switcheroo ne prouverait rien : c'est
//  justement son comportement — démarrer VIDE — qui était le défaut.
//
//  **S'il ne peut pas l'atteindre, il échoue.** Il ne saute pas, il ne
//  se rabat pas sur un bouchon : un harnais qui contourne le code qu'il
//  doit vérifier vaut moins que pas de harnais du tout.
//
//  CE QU'IL NE REMPLACE PAS : le forum. ModernBB sert un DOM plus riche
//  que ce squelette, et la barre Forumactif arrive par un script tiers.
//  Une page vue en vrai reste la dernière vérification.
// ════════════════════════════════════════════════════════════════════
import { readFileSync } from "node:fs";
import { chromium } from "npm:playwright@1.49.1";

//  La racine du dépôt : ce fichier est dans `outils/`.
const R = new URL("..", import.meta.url).pathname;

//  Le commit épinglé du switcheroo, le MÊME que `module-switcheroo.ts`.
//  S'ils divergent, le harnais ne vérifie plus ce qui est servi.
const SHA = readFileSync(R + "src/adaptateurs/navigateur/module-switcheroo.ts", "utf8")
  .match(/const SHA = "([0-9a-f]{40})"/)?.[1];
if (SHA === undefined) {
  console.error("outils/navigation.mjs : le commit épinglé du switcheroo est introuvable.");
  process.exit(2);
}
//  Deux sources pour le MÊME contenu : à un commit figé, GitHub et
//  jsDelivr servent octet pour octet la même chose — jsDelivr se sert
//  chez GitHub. On essaie les deux parce que le bac à sable atteint l'un
//  et pas l'autre, et qu'une vérification ne doit pas dépendre de quel
//  réseau on a sous la main.
const SOURCES = [
  `https://raw.githubusercontent.com/Lostmindy/switcheroo-fork/${SHA}`,
  `https://cdn.jsdelivr.net/gh/Lostmindy/switcheroo-fork@${SHA}`,
];
const switcheroo = {};
for (const f of ["monomer.js", "switcheroo.js"]) {
  for (const base of SOURCES) {
    try {
      const r = await fetch(`${base}/${f}`);
      if (r.ok) {
        switcheroo[f] = await r.text();
        break;
      }
    } catch { /* source suivante */ }
  }
  if (switcheroo[f] === undefined) {
    console.error(`outils/navigation.mjs : ${f} injoignable à ${SHA}.`);
    console.error(
      "Le harnais ne se rabat PAS sur un bouchon : c'est le vrai switcheroo qu'il vérifie.",
    );
    process.exit(2);
  }
}
//  Le Chromium du bac à sable n'a pas le numéro que Playwright attend :
//  on prend celui qui est là plutôt que d'en télécharger un. Sur un
//  coureur GitHub, aucun de ces chemins n'existe et Playwright résout le
//  sien — d'où l'étape qui l'installe dans la chaîne.
const CHROME = [
  "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
  "/opt/pw-browsers/chromium/chrome-linux64/chrome",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium-browser",
].find((c) => {
  try {
    readFileSync(c);
    return true;
  } catch {
    return false;
  }
});

//  Un squelette ModernBB : `body#modernbb`, la barre d'origine dans son
//  `.wrap`, et la barre Forumactif avec son lien de compte et sa
//  déconnexion à jeton.
const page = `<!doctype html><html lang="fr"><head><meta charset="utf-8">
<style>${readFileSync(R + "panneau-admin/jetons.css", "utf8")}</style>
<style>${readFileSync(R + "css/wild-mystery.css", "utf8")}</style>
<style>body{font-size:10px;margin:0;background:var(--wm-fond-page)}
.wrap{max-width:1400px;margin:0 auto}
/*  La vraie toolbar, telle qu'elle est servie : FIXÉE, 42 px de haut,
    z-index 20002, et un margin-top de 42 sur le corps pour lui faire
    place. C'est elle qui recouvrait notre barre collée. */
#fa_toolbar{position:fixed;top:0;left:0;right:0;height:42px;z-index:20002;background:#222;color:#fff}
#fa_right{float:right}
body{margin-top:42px}</style></head>
<body id="modernbb">
<div id="fa_toolbar"><div id="fa_right">
  <a href="/u4">Compte de test</a>
  <a href="/privmsg?folder=inbox">Messagerie 3</a>
  <a href="/login?logout=1&amp;tid=JETON">Déconnexion</a>
</div></div>
<div class="wrap"><ul id="modernbb-nav-menu"><li><a href="/">Accueil</a></li></ul></div>
<div id="page-body"><div class="forabg">des forums</div></div>
</body></html>`;

const nav = await chromium.launch(CHROME === undefined ? {} : { executablePath: CHROME });
const p = await nav.newPage({ viewport: { width: 1280, height: 900 } });
const soucis = [];
p.on("pageerror", (e) => soucis.push("erreur JS : " + e.message));

//  Une vraie origine : `setContent` laisse le document sur une origine
//  opaque, où `localStorage` lève — et le switcheroo comme nos
//  préférences s'en servent. On sert donc la page sur une adresse, sans
//  réseau.
await p.route("**/*", (r) => {
  const u = r.request().url();
  if (u.endsWith("/data/navigation.json")) {
    return r.fulfill({
      contentType: "application/json",
      body: readFileSync(R + "data/navigation.json", "utf8"),
    });
  }
  if (u.endsWith("/js/wild-mystery.js")) {
    return r.fulfill({
      contentType: "text/javascript",
      body: readFileSync(R + "js/wild-mystery.js", "utf8"),
    });
  }
  //  Le switcheroo, servi depuis sa source épinglée. On INTERCEPTE
  //  plutôt que de laisser sortir : la vérification ne doit pas dépendre
  //  de la santé d'un CDN une fois le fichier en main.
  for (const f of ["monomer.js", "switcheroo.js"]) {
    if (u.endsWith("/" + f)) {
      return r.fulfill({ contentType: "text/javascript", body: switcheroo[f] });
    }
  }
  return r.fulfill({ contentType: "text/html; charset=utf-8", body: page });
});
await p.goto("http://wild-mystery.test/");
//  Ce que Forumactif pose sur chaque page, y compris l'avatar en HTML.
await p.evaluate(() => {
  globalThis._userdata = {
    session_logged_in: 1,
    user_id: 4,
    username: "Compte de test",
    avatar: '<img src="https://i.servimg.com/u/f12/avatar.jpg" alt="" />',
  };
});
//  Le switcheroo, à son commit épinglé — les fichiers tels que jsDelivr
//  les sert.
//  Le switcheroo n'est PAS préchargé : c'est notre module qui va le
//  chercher, comme sur le forum. La route sert les fichiers téléchargés
//  à son commit épinglé — le bac à sable n'atteint pas jsDelivr.
//  Notre paquet, celui du dépôt, servi à SON adresse : la racine des
//  données se déduit de `currentScript.src`.
await p.addScriptTag({ url: "http://wild-mystery.test/js/wild-mystery.js" });
//  `navigation.json` est servi par jsDelivr : le bac à sable ne l'atteint
//  pas, on sert le fichier du dépôt à sa place.
await p.waitForTimeout(600);

const dire = (nom, ok, detail = "") => {
  console.log(`${ok ? "  ok  " : "DÉFAUT"} ${nom}${detail ? " — " + detail : ""}`);
  if (!ok) soucis.push(nom + (detail ? " — " + detail : ""));
};

//  1 · la barre est posée, pleine largeur, collée en haut
const barre = await p.evaluate(() => {
  const b = document.querySelector("nav.wm-nav");
  if (b === null) return null;
  const r = b.getBoundingClientRect();
  const s = getComputedStyle(b);
  return {
    x: r.x,
    l: r.width,
    y: r.y,
    pos: s.position,
    parent: b.parentElement.tagName,
    premier: b === document.body.firstElementChild,
    ancienne: getComputedStyle(document.querySelector("#modernbb-nav-menu")).display,
  };
});
dire("la barre existe", barre !== null);
if (barre !== null) {
  dire("pleine largeur", barre.x === 0 && barre.l === 1280, `x=${barre.x} l=${barre.l}`);
  dire("collée en haut", barre.pos === "sticky", barre.pos);
  dire("premier enfant du corps", barre.premier);
  dire("celle de ModernBB est masquée", barre.ancienne === "none", barre.ancienne);
}

//  1 bis · ELLE NE PASSE PAS SOUS LA TOOLBAR FORUMACTIF
//
//  `#fa_toolbar` est fixée en haut avec un z-index de 20002 : une barre
//  collée à `top: 0` disparaît dessous au premier défilement, et on perd
//  le logo qui ouvre le panneau. Mesuré sur le forum le 7 octobre.
await p.evaluate(() => scrollTo(0, 600));
await p.waitForTimeout(250);
const colle = await p.evaluate(() => {
  const n = document.querySelector("nav.wm-nav").getBoundingClientRect();
  const t = document.querySelector("#fa_toolbar").getBoundingClientRect();
  return {
    barre: n.y,
    toolbar: t.bottom,
    jeton: getComputedStyle(document.documentElement).getPropertyValue("--wm-haut-toolbar")
      .trim(),
    panneau: document.querySelector("#wm-panneau").getBoundingClientRect().y,
  };
});
dire(
  "la barre colle SOUS la toolbar, pas derrière elle",
  colle.barre >= colle.toolbar,
  JSON.stringify(colle),
);
dire("le jeton porte la hauteur mesurée", colle.jeton === "42px", colle.jeton);
dire(
  "et le panneau descend d'autant",
  colle.panneau === colle.toolbar + 56,
  String(colle.panneau),
);
await p.evaluate(() => scrollTo(0, 0));
await p.waitForTimeout(250);

//  2 · le switcheroo démarre VIDE : c'est le cœur du défaut signalé
const avant = await p.evaluate(() => ({
  pastilles:
    document.querySelectorAll('#switcheroo [data-action="switcheroo"][data-id]').length,
  ajout: document.querySelectorAll('#switcheroo [data-action="open-login"]').length,
  stock: localStorage.getItem("switcheroo"),
}));
dire("le switcheroo est bien là", avant.ajout === 1, JSON.stringify(avant));
dire("et il démarre sans aucun personnage", avant.pastilles === 0 && avant.stock === "[]");

//  3 · le panneau s'ouvre et porte « Associer un personnage »
await p.click(".wm-nav__logo");
await p.waitForTimeout(400);
const panneau = await p.evaluate(() => {
  const d = document.querySelector("#wm-panneau");
  const r = d.getBoundingClientRect();
  const nav = document.querySelector("nav.wm-nav").getBoundingClientRect();
  return {
    ouvert: d.classList.contains("wm-panneau--ouvert"),
    x: r.x,
    y: r.y,
    sousLaBarre: r.y >= nav.bottom - 1,
    titre: d.querySelector(".wm-panneau__personnages .wm-panneau__titre-section")?.textContent,
    vide: d.querySelector(".wm-panneau__vide")?.textContent ?? null,
    ajout: d.querySelector(".wm-panneau__carte--ajout")?.textContent ?? null,
  };
});
dire(
  "le panneau est ouvert et visible",
  panneau.ouvert && panneau.x === 0,
  JSON.stringify(panneau),
);
dire("il passe SOUS la barre, rien ne se perd", panneau.sousLaBarre, `y=${panneau.y}`);
dire(
  "« Mes personnages » s'affiche quand même",
  panneau.titre === "Mes personnages",
  String(panneau.titre),
);
dire("il dit pourquoi la liste est vide", panneau.vide !== null, String(panneau.vide));
dire(
  "et il porte le bouton d'association",
  /Associer un personnage/.test(panneau.ajout ?? ""),
  String(panneau.ajout),
);

//  4 · ce bouton ouvre VRAIMENT le formulaire du switcheroo, et il est lisible
await p.click(".wm-panneau__carte--ajout");
await p.waitForTimeout(400);
const modale = await p.evaluate(() => {
  const m = document.querySelector(".monomer-modal");
  if (m === null) return null;
  const r = m.getBoundingClientRect();
  const s = getComputedStyle(m);
  return {
    l: r.width,
    h: r.height,
    x: r.x,
    y: r.y,
    opacite: s.opacity,
    fond: s.backgroundColor,
    champs: m.querySelectorAll("input[name]").length,
    dansLeCache: document.querySelector(".wm-switcheroo-cache")?.contains(m) ?? false,
  };
});
dire("le formulaire s'ouvre", modale !== null);
if (modale !== null) {
  dire(
    "il est visible et dans l'écran",
    Number(modale.opacite) === 1 && modale.x >= 0 && modale.y >= 0 && modale.l > 200,
    JSON.stringify(modale),
  );
  dire("il n'est pas dans le conteneur caché", !modale.dansLeCache);
  dire("il a un fond, il n'est pas nu", modale.fond !== "rgba(0, 0, 0, 0)", modale.fond);
}

//  5 · et il se referme — sans transition CSS il resterait collé pour toujours
await p.evaluate(() => document.querySelector(".monomer-overlay").click());
await p.waitForTimeout(600);
dire(
  "il se referme",
  await p.evaluate(() => document.querySelector(".monomer-modal") === null),
);

//  6 · le menu du compte, maquette 390:3636
//  Le panneau couvre l'écran : Échap le ferme, comme pour un joueur.
await p.keyboard.press("Escape");
await p.waitForTimeout(400);
dire(
  "Échap ferme le panneau",
  !(await p.evaluate(() =>
    document.querySelector("#wm-panneau").classList.contains("wm-panneau--ouvert")
  )),
);
await p.click('#fa_right a[href="/u4"]');
await p.waitForTimeout(200);
const menu = await p.evaluate(() => {
  const m = document.querySelector("#wm-compte-menu");
  if (m === null) return null;
  const r = m.getBoundingClientRect();
  const lien = document.querySelector('#fa_right a[href="/u4"]').getBoundingClientRect();
  const sortie = m.querySelector(".wm-compte__entree--sortie a");
  return {
    cache: m.hasAttribute("hidden"),
    x: r.x,
    y: r.y,
    l: r.width,
    h: r.height,
    sousLeLien: r.y >= lien.bottom,
    dansLecran: r.x >= 0 && r.right <= 1280,
    parent: m.parentElement.tagName,
    avatar: m.querySelector(".wm-compte__avatar img")?.getAttribute("src") ?? null,
    entrees: [...m.querySelectorAll(".wm-compte__lien")].map((a) => a.textContent.trim()),
    pastilles: m.querySelectorAll(".wm-compte__pastille").length,
    deconnexion: sortie?.getAttribute("href") ?? null,
  };
});
dire("le menu du compte existe", menu !== null);
if (menu !== null) {
  dire("il s'ouvre au clic", !menu.cache);
  dire("il est posé sur le corps, pas dans la barre", menu.parent === "BODY");
  dire(
    "il se place sous le lien du compte, dans l'écran",
    menu.sousLeLien && menu.dansLecran,
    JSON.stringify(menu),
  );
  dire(
    "l'avatar est là, et c'est la SOURCE, pas le HTML",
    menu.avatar === "https://i.servimg.com/u/f12/avatar.jpg",
    String(menu.avatar),
  );
  dire("les six entrées de la maquette", menu.entrees.length === 6, menu.entrees.join(" / "));
  dire("chacune a son rond d'icône", menu.pastilles === 6, String(menu.pastilles));
  dire(
    "LA DÉCONNEXION GARDE SON JETON",
    menu.deconnexion === "/login?logout=1&tid=JETON",
    String(menu.deconnexion),
  );
}

//  7 · il se ferme en cliquant à côté
await p.evaluate(() => document.querySelector("#page-body").click());
await p.waitForTimeout(150);
dire(
  "il se ferme au clic à côté",
  await p.evaluate(() => document.querySelector("#wm-compte-menu").hasAttribute("hidden")),
);

//  8 · les notifications : le compteur a été lu AVANT la réécriture
const notifs = await p.evaluate(() => {
  const n = document.querySelector(".wm-notifs");
  return n === null ? null : n.textContent.replace(/\s+/g, " ").trim();
});
dire(
  "l'encart de notifications lit le vrai compteur",
  /3 messages non lus/.test(notifs ?? ""),
  String(notifs),
);

//  9 · sur téléphone
await p.setViewportSize({ width: 390, height: 844 });
await p.waitForTimeout(150);
const petit = await p.evaluate(() => {
  const b = document.querySelector("nav.wm-nav");
  return {
    enroule: getComputedStyle(b).flexWrap,
    l: b.getBoundingClientRect().width,
    debord: document.documentElement.scrollWidth > document.documentElement.clientWidth,
  };
});
dire("la barre s'enroule sur petit écran", petit.enroule === "wrap", JSON.stringify(petit));
dire("et rien ne déborde", !petit.debord);

await nav.close();
if (soucis.length > 0) { for (const x of soucis) console.log("  · " + x); }
console.log(soucis.length === 0 ? "\nTOUT PASSE." : `\n${soucis.length} DÉFAUT(S).`);
process.exit(soucis.length === 0 ? 0 : 1);
