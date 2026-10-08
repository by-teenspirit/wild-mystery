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
//  L'ORDRE DES FEUILLES EST CELUI DU FORUM, et il n'est pas décoratif :
//  ModernBB est servi AVANT nous. Mettre le squelette en dernier
//  inverserait la cascade et un départage à spécificité égale —
//  `html#min-width { height: … }` est exactement de ce genre — se
//  jouerait à l'envers du vrai forum.
const page = `<!doctype html><html lang="fr" id="min-width"><head><meta charset="utf-8">
<style>
/*  LE SQUELETTE REPRODUIT CE QUE MODERNBB IMPOSE, pas une page idéale.
    Deux reglages y ont coute une soiree le 7 octobre :

      · "html#min-width { height: 100% }" — il fige la hauteur du corps,
        donc la plage de collage de notre barre s'arretait a un ecran.
        L'id vient de ModernBB lui-meme : son balise html le porte, et
        nos regles le visent, donc le squelette le porte aussi ;
      · "body { display: flex; flex-direction: column }".

    Sans eux, le harnais disait « collee en haut » pendant que le forum
    la perdait au premier defilement.  */
html#min-width{height:100%}
body{font-size:10px;margin:0;height:100%;display:flex;flex-direction:column;background:var(--wm-fond-page)}
.wrap{max-width:1400px;width:98%;margin:0 auto}
/*  La vraie toolbar, telle qu'elle est servie : FIXÉE, 42 px de haut,
    z-index 20002, et un margin-top de 42 sur le corps pour lui faire
    place. C'est elle qui recouvrait notre barre collée. */
#fa_toolbar{position:fixed;top:0;left:0;right:0;height:42px;z-index:20002;background:#222;color:#fff}
/*  LES TROIS MESURES QUI FONT LA HAUTEUR, relevees mot pour mot sur le
    forum le 7 octobre, apres deux passages ou on avait cru avoir fini.

    Le harnais ne les servait pas, donc la cloche y etait deja a la
    bonne hauteur, et ses deux assertions passaient sur un code faux.
    C'est le meme trou que pour le CSS de ModernBB dans le harnais de
    l'accueil : un test ne vaut que ce que son decor reproduit.

      · "padding: 3px 18px" sur la toolbar : c'est LUI les 43 px — on
        lui avait efface sa hauteur, pas sa marge interieure ;
      · "margin-top: 3px" sur ".rightHeaderLink", qui posait la cloche
        deux pixels sous « Accueil » et le bouton du compte ;
      · "font-size: 1.3rem" sur #fa_right, soit 13 px — contre les 13,5
        de la rangee. Heriter n'y pouvait rien : la barre elle-meme est
        a 10 px, et ce sont les liens qui declarent leurs 13,5.  */
#fa_toolbar{padding:3px 18px;font-family:Roboto,sans-serif;font-size:1.3rem}
#fa_right{float:right;position:relative;font-size:1.3rem}
#fa_right a.rightHeaderLink{margin-left:18px;margin-top:3px;vertical-align:top;line-height:30px;border-radius:3px;padding:0 9px}
.fa_tbMainElement,.fa_tbMainElement a{display:inline-block !important;vertical-align:middle}
/*  LES VRAIES REGLES DE FORUMACTIF, relevees mot pour mot dans
    "8-ltr.css" le 7 octobre. Elles sont recopiees ici parce qu'elles
    portent LE MECANISME, et pas seulement une apparence :

      · la liste n'est montree que par ".notification" sur #fa_right,
        et le selecteur exige la chaine "#fa_toolbar #fa_right ..." —
        c'est ce qui rendait impossible de l'ouvrir quand on avait
        sorti la liste de cette chaine ;
      · la pastille est masquee hors de ".unread" ;
      · le texte d'une notification est fixe a 27em, ce qui debordait
        de notre liste ;
      · et la couleur des liens est forcee en !important.

    Un harnais qui ne reproduirait pas ces quatre regles dirait que
    tout va bien.  */
#fa_toolbar #fa_right #notif_list{display:none;position:absolute;top:42px;right:0;left:41px;z-index:10000;font-size:1.3rem}
#fa_toolbar #fa_right.notification #notif_list{display:block}
#fa_toolbar #fa_right #notif_list li .contentText{float:left;width:27em;overflow:hidden}
#fa_toolbar #fa_right #notif_list li .contentText a{color:rgb(0,86,156) !important;text-decoration:none !important}
#fa_toolbar #fa_right #fa_notifications{line-height:30px;padding:0 5px;color:#fff}
#fa_toolbar #fa_right #fa_notifications #notif_unread{display:none;margin-left:.5em}
#fa_toolbar #fa_right #fa_notifications.unread #notif_unread{display:inline}
#fa_toolbar > #fa_right.notification > #fa_notifications{color:#333;background-color:#fff}
#live_notif{position:absolute;right:47px;visibility:hidden}
/*  DEUX PIEGES DE PLUS, releves le 7 octobre sur le forum connecte, et
    qui ont tous les deux mordu :

      · "fa_fix" est l'option « barre fixee en haut » du profil. Sa
        regle porte un !important, donc elle gagne contre n'importe
        quelle specificite : la barre etait bien demenagee chez nous et
        se peignait quand meme en haut de l'ecran, notifications
        comprises ;
      · les classes de taille posent jusqu'a 980 px de largeur
        minimale, ce qui fait exploser notre barre sur petit ecran.  */
.fa_fix{top:0;right:0;position:fixed !important}
.fa_toolbar_XL_Sized{min-width:980px;width:100%}
.fa_toolbar_M_Sized{min-width:519px}
/*  Et son escamotage de telephone, qui ferait disparaitre les
    notifications une fois la barre chez nous.  */
@media (max-width:800px){#modernbb #fa_toolbar{visibility:hidden;height:0;padding:0}}
body{margin-top:42px}
/*  La barre collante de ModernBB : son script lui ajoute ".is-sticky"
    au defilement. Vide chez nous, elle se reduit a une bande bleue de
    12 px posee PAR-DESSUS tout, a 10000.  */
#headerbar-top.is-sticky{position:fixed;top:0;left:0;right:0;height:12px;z-index:10000;background:rgb(55,147,255)}
/*  LA BANNIERE TELLE QUE MODERNBB LA SERT, releve le 7 octobre sur le
    forum connecte : div.headerbar > div#headerbar-top > div.wrap >
    a#logo > img. La hauteur de 350 px avec overflow cache rognait une
    image de 620, et le .wrap a 98 % la decalait de 49 px.  */
.headerbar{height:350px;overflow:hidden;background-image:url("data:image/gif;base64,R0lGODlhAQABAAAAACw=")}
#headerbar-top > .wrap{padding:0 36px}
a#logo{display:block}
a#logo img{max-width:100%}</style>
<style>${readFileSync(R + "panneau-admin/jetons.css", "utf8")}</style>
<style>${readFileSync(R + "css/wild-mystery.css", "utf8")}</style></head>
<body id="modernbb">
<div id="fa_toolbar" class="fa_fix fa_toolbar_XL_Sized"><div id="fa_right" class="fa_tbMainElement">
  <!--  Le balisage REEL de la barre, releve le 7 octobre sur un compte
        connecte. La cloche n'a PAS de href : c'est leur script qui
        l'ouvre, d'ou le demenagement de la BARRE ENTIERE au lieu de la
        copie de la cloche.  -->
  <div id="fa_menu"><span id="fa_welcome">Bienvenue Compte de test</span><ul><li>un menu</li></ul></div>
  <a id="fa_notifications" class="rightHeaderLink unread">Notifications<span id="notif_unread">2</span></a>
  <ul id="notif_list">
    <li><span class="contentText"><a href="/t1-un-sujet">Quelqu'un a repondu dans un sujet au titre tres long</a></span></li>
    <li class="see_all"><a href="/profile?mode=editprofile&amp;page_profil=notifications">Voir toutes les notifications</a></li>
  </ul>
  <div id="live_notif"></div>
  <a href="/u4">Compte de test</a>
  <a href="/privmsg?folder=inbox">Messagerie 3</a>
  <a href="/login?logout=1&amp;tid=JETON">Déconnexion</a>
  <a id="fa_hide" class="rightHeaderLink"></a>
</div><div id="fa_search"><form><input name="search_keywords"></form></div>
<span id="fa_left"><a id="fa_service" href="https://www.forumactif.com">Forumactif</a></span></div>
<div id="page-header"><div class="headerbar">
<div id="headerbar-top" class="responsive-headerbar w-toolbar"><div class="wrap">
  <!--  L'image a les MESURES DE LA VRAIE banniere, 1280 x 620, parce
        que c'est d'elles que depend le rognage qu'on mesure.  -->
  <a id="logo"><img src="data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20width='1280'%20height='620'%3E%3C/svg%3E" alt="WILD MYSTERY"></a>
  <ul id="modernbb-nav-menu"><li><a href="/">Accueil</a></li></ul>
  <span id="menu-btn"></span>
</div></div>
<p id="site-desc">Forum RPG Pokémon</p>
</div></div>
<div id="page-body"><div class="forabg" style="height:4000px">des forums</div></div>
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
    //  Depuis le 8 octobre, un seul nœud la précède : le lien
    //  d'évitement, qui DOIT être avant elle — c'est la barre qu'il
    //  sert à sauter.
    secondApresLEvitement: document.body.firstElementChild?.id === "wm-evitement" &&
      b === document.body.children[1],
    evitement: (() => {
      const l = document.getElementById("wm-evitement");
      if (l === null) return null;
      const cible = document.querySelector(l.getAttribute("href"));
      const avant = l.getBoundingClientRect();
      l.focus();
      const apres = l.getBoundingClientRect();
      const r = cible === null ? null : cible.getBoundingClientRect();
      l.click();
      return {
        cible: cible === null ? null : cible.id,
        focalisable: cible !== null && cible.getAttribute("tabindex") === "-1",
        horsEcranAuRepos: avant.bottom <= 0,
        visibleAuFocus: apres.top >= 0 && apres.bottom <= innerHeight,
        //  Et le focus arrive VRAIMENT dessus, pas seulement le défilement.
        focusSurLaCible: document.activeElement === cible,
        sousLaBarre: r !== null && r.top >= 0,
      };
    })(),
    ancienne: getComputedStyle(document.querySelector("#modernbb-nav-menu")).display,
  };
});
dire("la barre existe", barre !== null);
if (barre !== null) {
  dire("pleine largeur", barre.x === 0 && barre.l === 1280, `x=${barre.x} l=${barre.l}`);
  dire("collée en haut", barre.pos === "sticky", barre.pos);
  dire(
    "le lien d'évitement passe avant elle, et elle vient juste après",
    barre.secondApresLEvitement,
  );
  dire(
    "LE LIEN D'ÉVITEMENT MÈNE AU CONTENU, et le focus y va vraiment",
    barre.evitement !== null && barre.evitement.cible !== null &&
      barre.evitement.focalisable && barre.evitement.focusSurLaCible,
    JSON.stringify(barre.evitement),
  );
  dire(
    "il est hors de l'écran au repos et dedans au focus",
    barre.evitement !== null && barre.evitement.horsEcranAuRepos &&
      barre.evitement.visibleAuFocus,
    JSON.stringify(barre.evitement),
  );
  dire("celle de ModernBB est masquée", barre.ancienne === "none", barre.ancienne);
}

//  1 bis · LA BARRE FORUMACTIF EST RANGÉE, PAS CONTOURNÉE
//
//  Elle était fixée en haut avec un z-index de 20002, et notre barre
//  collée passait dessous au premier défilement. On a d'abord mesuré sa
//  hauteur pour se caler en dessous ; depuis le 7 octobre on lui prend
//  ses adresses et on la masque — la maquette ne montre qu'une barre.
//
//  Ce qu'on vérifie ici : qu'elle est bien masquée, que sa marge de
//  42 px écrite EN STYLE INLINE sur `body` est annulée, et que la barre
//  colle donc au bord.
await p.evaluate(() => scrollTo(0, 600));
await p.waitForTimeout(250);
const colle = await p.evaluate(() => {
  const n = document.querySelector("nav.wm-nav").getBoundingClientRect();
  const tb = document.querySelector("#fa_toolbar");
  return {
    barre: n.y,
    //  ELLE N'EST PLUS MASQUÉE, ELLE EST CHEZ NOUS. Depuis le 7
    //  octobre la barre entière passe dans la nôtre pour ses
    //  notifications : ce qu'on vérifie, c'est qu'elle a perdu tout ce
    //  qui en faisait une barre — sa position fixe et son fond.
    toolbarRangee: tb.closest(".wm-nav__droite") !== null &&
      getComputedStyle(tb).position === "static" &&
      getComputedStyle(tb).backgroundColor === "rgba(0, 0, 0, 0)",
    margeDuCorps: getComputedStyle(document.body).marginTop,
    jeton: getComputedStyle(document.documentElement).getPropertyValue("--wm-haut-toolbar")
      .trim(),
    panneau: document.querySelector("#wm-panneau").getBoundingClientRect().y,
  };
});
dire(
  "la toolbar Forumactif est rangée dans la nôtre",
  colle.toolbarRangee,
  JSON.stringify(colle),
);

//  SON ÉPINGLE EST RETIRÉE. `.fa_fix` porte un `!important` : la barre
//  se peignait en haut de l'écran tout en étant déménagée chez nous, et
//  les notifications partaient avec elle. C'est le défaut signalé le
//  7 octobre, et il ne se voyait pas sans cette classe dans le décor.
const epingle = await p.evaluate(() => {
  const t = document.querySelector("#fa_toolbar");
  const c = getComputedStyle(t);
  const r = t.getBoundingClientRect();
  const nav = document.querySelector("nav.wm-nav").getBoundingClientRect();
  return {
    classes: t.className,
    position: c.position,
    largeurMini: c.minWidth,
    //  Elle doit être DANS notre barre, pas posée par-dessus la page.
    dedans: r.top >= nav.top - 1 && r.bottom <= nav.bottom + 1,
  };
});
dire(
  "ELLE N'EST PLUS ÉPINGLÉE EN HAUT DE L'ÉCRAN",
  epingle.position === "static" && !epingle.classes.includes("fa_fix"),
  JSON.stringify(epingle),
);
dire("elle tient dans notre barre, et pas par-dessus", epingle.dedans, JSON.stringify(epingle));
dire(
  "et elle n'impose plus ses 980 px de largeur minimale",
  epingle.largeurMini === "0px",
  epingle.largeurMini,
);

//  ELLE COLLE VRAIMENT, ET LOIN. `position: sticky` ne colle que dans
//  son bloc conteneur : avec le `html { height: 100% }` de ModernBB, la
//  plage s'arrêtait à un écran et la barre partait au-delà. Mesuré sur
//  le forum à 1 400 px — `navY: -556` alors que `position` valait bien
//  « sticky ». On défile donc LOIN, pas d'un cran.
const loin = await p.evaluate(async () => {
  const out = {};
  const haut = document.querySelector("#headerbar-top");
  for (const y of [700, 1400, 3000]) {
    scrollTo(0, y);
    //  CE QUE FAIT LE SCRIPT DE MODERNBB au défilement, et qu'aucun
    //  script ne fait ici : il épingle sa propre barre. Sans cette
    //  ligne, la bande bleue n'existe jamais dans le harnais et la
    //  règle qui la dépingle n'est pas éprouvée du tout.
    haut.classList.add("is-sticky");
    await new Promise((r) => setTimeout(r, 120));
    const n = document.querySelector("nav.wm-nav").getBoundingClientRect();
    //  Ce qui est au sommet doit être NOTRE barre, pas la bande bleue
    //  de ModernBB, qui est posée à 10000.
    const dessus = document.elementsFromPoint(300, 20)[0];
    out[y] = {
      y: Math.round(n.y),
      dessus: dessus?.closest("nav.wm-nav") !== null,
      bleue: getComputedStyle(haut).position,
    };
  }
  scrollTo(0, 0);
  haut.classList.remove("is-sticky");
  return out;
});
dire(
  "elle colle encore à 3 000 px de défilement",
  Object.values(loin).every((m) => m.y === 0),
  JSON.stringify(loin),
);
dire(
  "et rien ne passe par-dessus",
  Object.values(loin).every((m) => m.dessus),
  JSON.stringify(loin),
);
dire(
  "LA BANDE BLEUE DE MODERNBB EST DÉPINGLÉE",
  Object.values(loin).every((m) => m.bleue === "static"),
  JSON.stringify(loin),
);
//  ── LA BANNIÈRE ─────────────────────────────────────────────────────
//
//  Elle n'est pas du code : c'est une image déjà posée dans le forum,
//  dans `#headerbar-top > .wrap > a#logo`. Ce qu'on vérifie, c'est
//  qu'aucun réglage de ModernBB ne la rogne ni ne la décale :
//
//    · son `.wrap` est tenu à `max-width: 1400px` + 36 px de marge
//      intérieure + `width: 98%` — l'image mesurait 1 254 au lieu de
//      1 280 et commençait à x = 49 ;
//    · `.headerbar` est forcée à 350 px avec `overflow: hidden`, donc
//      une image de 620 était coupée à mi-hauteur.
const banniere = await p.evaluate(() => {
  const img = document.querySelector("#headerbar-top a#logo img");
  const r = img.getBoundingClientRect();
  //  C'est `.headerbar` — le PARENT de `#headerbar-top` — qui porte les
  //  350 px et l'`overflow: hidden`. Mesurer la mauvaise des deux
  //  rendait un test qui ne pouvait pas échouer.
  const cadre = document.querySelector(".headerbar");
  return {
    x: Math.round(r.x),
    l: Math.round(r.width),
    //  L'image fait 1280 × 620 : si le cadre est plus court qu'elle,
    //  c'est qu'il la rogne.
    hauteurDeLImage: Math.round(r.height),
    hauteurDuCadre: Math.round(cadre.getBoundingClientRect().height),
    rognee: Math.round(cadre.getBoundingClientRect().height) < Math.round(r.height),
    debord: document.documentElement.scrollWidth > innerWidth,
  };
});
dire(
  "la bannière part du bord et prend toute la largeur",
  banniere.x === 0 && banniere.l === 1280,
  JSON.stringify(banniere),
);
dire("et elle n'est plus rognée à 350 px", !banniere.rognee, JSON.stringify(banniere));
dire("sans rien faire déborder à droite", !banniere.debord, JSON.stringify(banniere));

dire("sa marge inline de 42 px est annulée", colle.margeDuCorps === "0px", colle.margeDuCorps);
dire("le jeton repasse à zéro", colle.jeton === "0px", colle.jeton);
dire("la barre colle au bord après défilement", colle.barre === 0, String(colle.barre));
dire("et le panneau part juste dessous", colle.panneau === 56, String(colle.panneau));
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

//  3 bis · LE « + » EST CENTRÉ, ET LA CARTE SE LIT SUR LE PANNEAU SOMBRE
//
//  Les deux défauts du 7 octobre. Le « + » se posait en haut à gauche :
//  le bloc d'ajout était écrit AVANT `.wm-panneau__vignette`, et à
//  spécificité égale le `display: block` de celle-ci gagnait. Et la
//  carte héritait de l'encre foncée des cartes de personnage, qui elles
//  sont sur fond clair — du brun sur du brun.
await p.evaluate(() => {
  globalThis.__mesureLAjout = () => {
    const voie = (s) => {
      const n = s.match(/-?\d*\.?\d+(?:e-?\d+)?/g)?.map(Number) ?? [];
      if (n.length < 3) return null;
      const srgb = /^color\(/.test(s);
      const a = s.includes("/") ? (n[3] ?? 1) : (n.length > 3 ? n[3] : 1);
      return { rgb: srgb ? n.slice(0, 3).map((v) => v * 255) : n.slice(0, 3), alpha: a };
    };
    const f = (v) => {
      const c = v / 255;
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    };
    const lum = (c) => 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]);
    const sur = (d, b, a) => d.map((v, i) => v * a + b[i] * (1 - a));
    //  Le fond RÉEL : on empile les fonds translucides, du plus profond au
    //  plus proche. La carte en pose un, le panneau en pose un autre.
    const fond = (el) => {
      const pile = [];
      for (let n = el; n && n !== document.documentElement; n = n.parentElement) {
        const c = voie(getComputedStyle(n).backgroundColor);
        if (c && c.alpha > 0) pile.push(c);
      }
      let base = [255, 255, 255];
      for (const c of pile.reverse()) base = sur(c.rgb, base, c.alpha);
      return base;
    };
    const contraste = (el) => {
      const t = voie(getComputedStyle(el).color);
      const b = fond(el);
      const d = sur(t.rgb, b, t.alpha);
      const [x, y] = [lum(d), lum(b)].sort((m, n) => n - m);
      return Math.round(((x + 0.05) / (y + 0.05)) * 100) / 100;
    };

    const vignette = document.querySelector(".wm-panneau__vignette--plus");
    const nom = document.querySelector(".wm-panneau__carte--ajout .wm-panneau__nom");
    const vide = document.querySelector(".wm-panneau__vide");
    const r = vignette.getBoundingClientRect();
    //  Le glyphe vit dans un nœud de texte : on l'encadre pour le mesurer.
    const p2 = document.createRange();
    p2.selectNodeContents(vignette);
    const g = p2.getBoundingClientRect();
    return {
      affichage: getComputedStyle(vignette).display,
      ecartX: Math.round(((g.left + g.right) / 2 - (r.left + r.right) / 2) * 10) / 10,
      ecartY: Math.round(((g.top + g.bottom) / 2 - (r.top + r.bottom) / 2) * 10) / 10,
      contrasteDuNom: contraste(nom),
      contrasteDuPlus: contraste(vignette),
      contrasteDuVide: contraste(vide),
    };
  };
});
const lisible = await p.evaluate(() => globalThis.__mesureLAjout());
dire(
  "le « + » est centré dans son rectangle",
  lisible.affichage === "flex" && Math.abs(lisible.ecartX) <= 1 &&
    Math.abs(lisible.ecartY) <= 1.5,
  JSON.stringify(lisible),
);
dire(
  "« Associer un personnage » se lit sur le panneau",
  lisible.contrasteDuNom >= 4.5,
  String(lisible.contrasteDuNom),
);
dire("le « + » aussi", lisible.contrasteDuPlus >= 4.5, String(lisible.contrasteDuPlus));
dire(
  "et la phrase qui dit pourquoi la liste est vide",
  lisible.contrasteDuVide >= 4.5,
  String(lisible.contrasteDuVide),
);

//  Le thème sombre retourne toute la palette, `--wm-fond-nuit` compris :
//  une couleur lisible en clair ne l'est pas forcément là.
await p.evaluate(() => document.body.classList.add("wm-sombre"));
await p.waitForTimeout(150);
const nuit = await p.evaluate(() => {
  const m = globalThis.__mesureLAjout();
  return { nom: m.contrasteDuNom, plus: m.contrasteDuPlus, vide: m.contrasteDuVide };
});
dire("en thème sombre aussi", Math.min(...Object.values(nuit)) >= 4.5, JSON.stringify(nuit));
await p.evaluate(() => document.body.classList.remove("wm-sombre"));
await p.waitForTimeout(150);

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

// ── DIX PERSONNAGES DOIVENT TENIR ───────────────────────────────────
//
//  « Il arrive qu'on associe jusqu'à 10 personnages sur un forum. »
//  Dix cartes à 75 px plus leurs écarts faisaient 850 px de
//  personnages SEULS, avant les liens et les titres : sur un portable
//  de 768 px de haut on en voyait sept.
//
//  On en pose donc dix pour de vrai — dans le stock du switcheroo, par
//  son propre format — et on mesure. Un chiffre écrit dans la feuille
//  ne prouve rien ; une hauteur mesurée, si.
await p.click(".wm-nav__compte");
await p.waitForTimeout(200);
const menu = await p.evaluate(() => {
  const m = document.querySelector("#wm-compte-menu");
  if (m === null) return null;
  const r = m.getBoundingClientRect();
  const lien = document.querySelector(".wm-nav__compte").getBoundingClientRect();
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

  //  LES ICÔNES DU MENU prennent la couleur de leur pastille, pas
  //  l'accent de la barre. Mesuré en sombre sur le forum le 7 octobre :
  //  un orange (224, 144, 106) sur une pastille bleu clair. Et le
  //  carnet s'affiche comme les autres entrées.
  const icones = await p.evaluate(() => {
    const entrees = [...document.querySelectorAll(".wm-compte__entree")];
    const lire = (li) => {
      const past = li.querySelector(".wm-compte__pastille");
      const ico = li.querySelector(".wm-nav__icone");
      const rp = past.getBoundingClientRect(), ri = ico.getBoundingClientRect();
      return {
        fond: getComputedStyle(past).backgroundColor,
        pastille: getComputedStyle(past).color,
        icone: getComputedStyle(ico).color,
        //  Centrée ET à sa taille : le glyphe mesurait 22 px dans un
        //  rond de 20, donc il mordait des deux côtés.
        ecart: Math.round(Math.abs((ri.x + ri.width / 2) - (rp.x + rp.width / 2)) * 10) / 10,
        tient: ri.width <= rp.width && ri.height <= rp.height,
      };
    };
    return {
      carnet: lire(entrees.find((e) => /carnet/i.test(e.textContent))),
      autre: lire(entrees.find((e) => /Voir mon profil/i.test(e.textContent))),
    };
  });
  dire(
    "L'ICÔNE PREND LA COULEUR DE SA PASTILLE",
    icones.autre.icone === icones.autre.pastille,
    JSON.stringify(icones.autre),
  );
  dire(
    "elle est centrée et tient dans son rond",
    icones.autre.ecart === 0 && icones.autre.tient,
    JSON.stringify(icones.autre),
  );
  dire(
    "ET LE CARNET S'AFFICHE COMME LES AUTRES",
    icones.carnet.fond === icones.autre.fond && icones.carnet.icone === icones.autre.icone,
    JSON.stringify(icones),
  );
}

//  6 bis · LE GROUPE DE DROITE EST DANS NOTRE BARRE
//
//  C'est la demande du 7 octobre : la maquette ne montre qu'une barre.
const adroite = await p.evaluate(() => {
  const g = document.querySelector(".wm-nav__droite");
  const msg = [...document.querySelectorAll(".wm-nav__lien")]
    .find((a) => a.getAttribute("href") === "/privmsg");
  return {
    dansLaBarre: g?.closest("nav.wm-nav") !== null,
    avatar: g?.querySelector(".wm-nav__avatar img")?.getAttribute("src") ?? null,
    pseudo: g?.querySelector(".wm-nav__pseudo")?.textContent ?? null,
    compteur: msg?.querySelector(".wm-nav__compteur")?.textContent ?? null,
    messagerie: msg?.getAttribute("aria-label") ?? null,
  };
});
dire("le compte est dans NOTRE barre", adroite.dansLaBarre, JSON.stringify(adroite));
dire(
  "avec son avatar",
  adroite.avatar === "https://i.servimg.com/u/f12/avatar.jpg",
  String(adroite.avatar),
);
dire(
  "et son pseudo, lu dans _userdata",
  adroite.pseudo === "Compte de test",
  String(adroite.pseudo),
);
dire(
  "« Messagerie 3 » : le compteur est dans le lien",
  adroite.compteur === "3",
  String(adroite.compteur),
);
dire(
  "et il est dit en toutes lettres",
  /3 messages non lus/.test(adroite.messagerie ?? ""),
  String(adroite.messagerie),
);

//  6 ter · LA CLOCHE DE FORUMACTIF EST DÉMÉNAGÉE, PAS CLONÉE
//
//  Elle n'a pas de href : c'est leur script qui l'ouvre. Un clone serait
//  mort. On vérifie que c'est bien LE MÊME nœud, qu'il a gardé son
//  identifiant — leur script le retrouve par là — et que sa liste est
//  recalée sur notre conteneur au lieu de l'ancienne barre.
//  LEUR ÉCOUTEUR, REPRODUIT. Il est délégué sur `document` et branche
//  sur `e.target.id` : c'est le code de `FAToolbar.js`, lu le 7
//  octobre, réduit à ce qui compte.
//
//      case NOTIFICATIONS:
//        $('#'+RIGHT).toggleClass('notification')…
//      default:  // hors de #notif_list
//        $('#'+RIGHT).removeClass('notification')
//
//  Sans lui, le harnais ne peut PAS voir le défaut que Callista a
//  signalé : la liste ne s'ouvrait jamais, et le seul lien visible
//  menait à la page des notifs.
await p.evaluate(() => {
  document.addEventListener("click", (e) => {
    const droite = document.querySelector("#fa_right");
    const liste = document.querySelector("#notif_list");
    if (e.target.id === "fa_notifications") {
      droite.classList.toggle("notification");
      e.stopPropagation();
      return;
    }
    if (!liste.contains(e.target)) droite.classList.remove("notification");
  });
});

const cloche = await p.evaluate(() => {
  const c = document.querySelector("#fa_notifications");
  const l = document.querySelector("#notif_list");
  const barre = document.querySelector("#fa_toolbar");
  const st = c === null ? null : getComputedStyle(c);
  const autre = document.querySelector(".wm-nav__lien");
  return {
    dansNotreBarre: c?.closest(".wm-nav__droite") !== null,
    uneSeule: document.querySelectorAll("#fa_notifications").length,
    aria: c?.getAttribute("aria-label") ?? null,
    //  ELLE DIT « Notifications », en clair : c'est la demande du 7
    //  octobre, et l'ancienne version la rendait muette (`font-size: 0`
    //  et une icône en `::before`).
    mot: c.textContent.replace(/\s+/g, " ").trim(),
    taille: st.fontSize,
    tailleDesAutres: autre === null ? null : getComputedStyle(autre).fontSize,
    //  PAS UN GROS BOUTON : ni fond, ni cadre, ni rondeur.
    fond: st.backgroundColor,
    cadre: st.borderTopWidth,
    rondeur: st.borderTopLeftRadius,
    rondeurDesAutres: autre === null ? null : getComputedStyle(autre).borderTopLeftRadius,
    //  PAS DE TRAIT SOUS LE TEXTE : c'est le soulignement par défaut
    //  d'un `<a>`, et il revient dès qu'on cesse de le poser.
    souligne: st.textDecorationLine,
    //  Et elle s'aligne sur la rangée : même hauteur que les liens.
    hauteur: Math.round(c.getBoundingClientRect().height),
    hauteurDesAutres: autre === null ? null : Math.round(autre.getBoundingClientRect().height),
    largeur: Math.round(c.getBoundingClientRect().width),
    //  ── ET ELLE EST SUR LA MÊME LIGNE, AU PIXEL ─────────────────────
    //
    //  « Les notifs sont encore trop hautes », 7 octobre, APRÈS deux
    //  passages où la hauteur était déjà la bonne. Elle l'était : 40,
    //  comme les autres. Ce qui n'allait pas, c'était le reste de la
    //  rangée — la cloche posée deux pixels plus bas par le
    //  `margin-top: 3px` de `.rightHeaderLink`, et son enveloppe à
    //  43 px à cause du `padding: 3px 18px` de la toolbar.
    //
    //  **Mesurer une hauteur ne dit pas si c'est aligné.** D'où ces
    //  trois-là, qui regardent les BORDS et l'enveloppe.
    hautDeLaCloche: Math.round(c.getBoundingClientRect().top),
    hautDuCompte: (() => {
      const e = document.querySelector(".wm-nav__compte");
      return e === null ? null : Math.round(e.getBoundingClientRect().top);
    })(),
    hautDesAutres: autre === null ? null : Math.round(autre.getBoundingClientRect().top),
    hauteurDeLEnveloppe: barre === null
      ? null
      : Math.round(barre.getBoundingClientRect().height),
    //  La barre entière est venue, et c'est ce qui fait marcher leur
    //  mécanique : la liste est restée dans la chaîne
    //  `#fa_toolbar #fa_right …`.
    barreChezNous: barre?.closest(".wm-nav__droite") !== null,
    listeDansLaChaine: l.closest("#fa_toolbar #fa_right") !== null,
    //  On ne touche JAMAIS à leur display : c'est leur interrupteur.
    listeFermee: getComputedStyle(l).display === "none",
    //  La pastille est pleine ici (« 2 ») : leur classe `.unread` est
    //  posée, donc elle doit se voir.
    pastille: getComputedStyle(document.querySelector("#notif_unread")).display,
    //  …et ne JAMAIS attraper le clic : il doit arriver sur la cloche.
    pastilleTransparenteAuClic:
      getComputedStyle(document.querySelector("#notif_unread")).pointerEvents === "none",
    //  Ce qu'on remplace nous-mêmes est masqué.
    menuMasque: getComputedStyle(document.querySelector("#fa_menu")).display === "none",
    rechercheMasquee: getComputedStyle(document.querySelector("#fa_search")).display === "none",
    logoFaMasque: getComputedStyle(document.querySelector("#fa_left")).display === "none",
    flottantAbsent: document.querySelector(".wm-notifs") === null,
  };
});
dire("la cloche est passée dans notre barre", cloche.dansNotreBarre, JSON.stringify(cloche));
dire("et c'est LE MÊME nœud, pas un clone", cloche.uneSeule === 1, String(cloche.uneSeule));
dire("son libellé est dit à voix haute", cloche.aria === "Notifications", String(cloche.aria));
dire(
  "ELLE AFFICHE SIMPLEMENT « Notifications »",
  cloche.mot.startsWith("Notifications") && cloche.taille !== "0px",
  `${cloche.mot} / ${cloche.taille}`,
);
dire(
  "à la taille des autres liens de la barre",
  cloche.taille === cloche.tailleDesAutres,
  `${cloche.taille} contre ${cloche.tailleDesAutres}`,
);
dire(
  "ET CE N'EST PAS UN GROS BOUTON : ni fond, ni cadre, et l'arrondi des liens",
  cloche.fond === "rgba(0, 0, 0, 0)" && cloche.cadre === "0px" &&
    cloche.rondeur === cloche.rondeurDesAutres,
  JSON.stringify(cloche),
);
dire(
  "PAS DE TRAIT SOUS LE TEXTE",
  cloche.souligne === "none",
  cloche.souligne,
);
dire(
  "et elle s'aligne sur la rangée, comme « Accueil »",
  cloche.hauteur === cloche.hauteurDesAutres,
  `${cloche.hauteur} px contre ${cloche.hauteurDesAutres}`,
);
//  LA HAUTEUR N'EST PAS L'ALIGNEMENT. Les deux assertions ci-dessus
//  passaient pendant que la cloche était posée deux pixels trop bas et
//  que son enveloppe dépassait de trois : elles mesuraient la bonne
//  chose au mauvais endroit.
dire(
  "ELLE EST SUR LA MÊME LIGNE QUE SES DEUX VOISINS, AU PIXEL",
  cloche.hautDeLaCloche === cloche.hautDuCompte &&
    cloche.hautDeLaCloche === cloche.hautDesAutres,
  `cloche ${cloche.hautDeLaCloche} · compte ${cloche.hautDuCompte} · liens ${cloche.hautDesAutres}`,
);
dire(
  "et son enveloppe ne dépasse pas de la rangée",
  cloche.hauteurDeLEnveloppe === cloche.hauteurDesAutres,
  `${cloche.hauteurDeLEnveloppe} px contre ${cloche.hauteurDesAutres}`,
);
//  À DROITE DU COMPTE, et pas à sa gauche : l'ordre du DOM fait
//  l'ordre à l'écran, et c'est la demande du 7 octobre.
dire(
  "LES NOTIFICATIONS SONT À DROITE DU COMPTE",
  await p.evaluate(() => {
    const d = document.querySelector(".wm-nav__droite");
    const compte = d.querySelector(".wm-nav__compte");
    const barre = d.querySelector("#fa_toolbar");
    if (compte === null || barre === null) return false;
    return compte.compareDocumentPosition(barre) & Node.DOCUMENT_POSITION_FOLLOWING;
  }),
);

dire(
  "LA BARRE ENTIÈRE EST VENUE, et la liste est restée dans leur chaîne",
  cloche.barreChezNous && cloche.listeDansLaChaine,
  JSON.stringify(cloche),
);
dire("et on n'a pas touché à son interrupteur", cloche.listeFermee);
dire("une pastille pleine s'affiche", cloche.pastille !== "none", cloche.pastille);
dire("et elle n'attrape pas le clic", cloche.pastilleTransparenteAuClic);
//  « JE NE VEUX RIEN VOIR » de la barre Forumactif, 7 octobre. On
//  vérifie donc l'INVERSE de d'habitude : non pas que les quelques
//  nœuds qu'on connaît sont masqués, mais qu'il ne reste QUE les
//  notifications de visible — y compris les nœuds qu'on n'a pas
//  nommés, comme `#fa_hide`, qui résistait à la feuille.
const resteVisible = await p.evaluate(() => {
  const tb = document.querySelector("#fa_toolbar");
  const garde = new Set(["fa_right", "fa_notifications", "notif_list", "live_notif"]);
  return [...tb.querySelectorAll("*")]
    .filter((e) => {
      if (garde.has(e.id)) return false;
      if (e.closest("#notif_list") || e.closest("#live_notif")) return false;
      if (e.closest("#fa_notifications")) return false;
      return getComputedStyle(e).display !== "none";
    })
    .map((e) => e.id || e.tagName + "." + String(e.className).trim().split(/\s+/)[0]);
});
dire(
  "IL NE RESTE QUE LES NOTIFICATIONS de la barre Forumactif",
  resteVisible.length === 0,
  resteVisible.join(", "),
);
dire(
  "et le groupe de droite se réduit à son contenu",
  await p.evaluate(() => {
    const tb = document.querySelector("#fa_toolbar");
    return tb.getBoundingClientRect().width < 260;
  }),
  await p.evaluate(() =>
    Math.round(document.querySelector("#fa_toolbar").getBoundingClientRect().width) + " px"
  ),
);

dire(
  "ce qu'on remplace nous-mêmes est masqué",
  cloche.menuMasque && cloche.rechercheMasquee && cloche.logoFaMasque,
  JSON.stringify(cloche),
);
dire("le bloc flottant s'efface devant la vraie cloche", cloche.flottantAbsent);

// ── LE CLIC OUVRE LA LISTE, ET C'EST TOUT L'OBJET DE LA CORRECTION ──
await p.evaluate(() => document.querySelector("#fa_notifications").click());
await p.waitForTimeout(120);
const ouverte = await p.evaluate(() => {
  const l = document.querySelector("#notif_list");
  const r = l.getBoundingClientRect();
  return {
    affichee: getComputedStyle(l).display,
    classe: document.querySelector("#fa_right").className,
    l: Math.round(r.width),
    h: Math.round(r.height),
    dansLecran: r.left >= 0 && r.right <= innerWidth,
    //  Le texte d'une notification se lit : leur feuille le fixait à
    //  27em, ce qui débordait de notre liste.
    texteBorne: (() => {
      const t = l.querySelector(".contentText");
      return t === null || t.getBoundingClientRect().right <= r.right + 1;
    })(),
    debord: document.documentElement.scrollWidth > innerWidth,
  };
});
dire(
  "LE CLIC SUR LA CLOCHE OUVRE LA LISTE DES NOTIFICATIONS",
  ouverte.affichee === "block" && ouverte.h > 0,
  JSON.stringify(ouverte),
);
dire("elle tient dans l'écran", ouverte.dansLecran && !ouverte.debord, JSON.stringify(ouverte));
dire(
  "et le texte d'une notification ne déborde pas",
  ouverte.texteBorne,
  JSON.stringify(ouverte),
);

//  UN CLIC SUR LA PASTILLE OUVRE AUSSI. C'est le second piège de leur
//  `switch (e.target.id)` : un clic sur un enfant de la cloche tombe
//  dans le `default`, qui REFERME. `pointer-events: none` le rend
//  impossible.
await p.evaluate(() => document.querySelector("#page-body").click());
await p.waitForTimeout(80);
await p.evaluate(() => {
  const pastille = document.querySelector("#notif_unread");
  const r = pastille.getBoundingClientRect();
  //  On clique aux COORDONNÉES de la pastille, pas sur le nœud : c'est
  //  la seule façon de voir qui attrape vraiment le clic.
  document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2).click();
});
await p.waitForTimeout(120);
dire(
  "un clic sur la pastille ouvre la liste, il ne la referme pas",
  await p.evaluate(() => getComputedStyle(document.querySelector("#notif_list")).display) ===
    "block",
);

await p.evaluate(() => document.querySelector("#page-body").click());
await p.waitForTimeout(100);
dire(
  "et un clic à côté la referme",
  await p.evaluate(() => getComputedStyle(document.querySelector("#notif_list")).display) ===
    "none",
);

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
//  L'encart flottant n'est plus posé quand la cloche est là : c'est
//  vérifié plus haut, au 6 ter. Ce qui reste vrai, c'est que le compteur
//  est lu AVANT la réécriture de la barre — on le voit dans le lien
//  central, vérifié au 6 bis.

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

//  10 · DÉCONNECTÉE, ON NE PERD PAS « CONNEXION »
//
//  C'est le risque de ranger la barre Forumactif : ses deux seuls liens
//  utiles à un visiteur sont là-dedans. On recharge la page sans
//  `_userdata` connecté et on vérifie qu'ils sont passés dans la nôtre.
const p2 = await nav.newPage({ viewport: { width: 1280, height: 900 } });
p2.on("pageerror", (e) => soucis.push("erreur JS (déconnectée) : " + e.message));
await p2.route("**/*", (r) => {
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
  for (const f of ["monomer.js", "switcheroo.js"]) {
    if (u.endsWith("/" + f)) {
      return r.fulfill({ contentType: "text/javascript", body: switcheroo[f] });
    }
  }
  //  La même page, mais la barre Forumactif d'un visiteur : deux liens,
  //  relevés sur le forum le 7 octobre.
  return r.fulfill({
    contentType: "text/html; charset=utf-8",
    body: page
      .replace('<a href="/u4">Compte de test</a>', '<a href="/login">Connexion</a>')
      .replace(
        '<a href="/privmsg?folder=inbox">Messagerie 3</a>',
        '<a href="/register">S\'enregistrer</a>',
      )
      .replace('<a href="/login?logout=1&amp;tid=JETON">Déconnexion</a>', ""),
  });
});
await p2.goto("http://wild-mystery.test/");
await p2.evaluate(() => {
  globalThis._userdata = { session_logged_in: 0 };
});
await p2.addScriptTag({ url: "http://wild-mystery.test/js/wild-mystery.js" });
await p2.waitForTimeout(600);
const invite = await p2.evaluate(() => ({
  liens: [...document.querySelectorAll(".wm-nav__droite a")].map((a) => ({
    t: a.textContent.trim(),
    h: a.getAttribute("href"),
  })),
  compte: document.querySelector(".wm-nav__compte") !== null,
  switcheroo: document.querySelector("#switcheroo") !== null,
  toolbar: getComputedStyle(document.querySelector("#fa_toolbar")).display,
}));
dire(
  "déconnectée, « Connexion » et « S'enregistrer » sont repris",
  invite.liens.length === 2 && invite.liens[0].h === "/login" &&
    invite.liens[1].h === "/register",
  JSON.stringify(invite),
);
dire("et il n'y a pas de menu de compte", !invite.compte);
dire("ni de switcheroo : rien à gérer", !invite.switcheroo);
dire("la toolbar est rangée là aussi", invite.toolbar === "none", invite.toolbar);

// ── 11 · DIX PERSONNAGES DOIVENT TENIR ──────────────────────────────
//
//  « Il arrive qu'on associe jusqu'à 10 personnages sur un forum. »
//  Dix cartes à 75 px plus leurs écarts faisaient 850 px DE
//  PERSONNAGES SEULS, avant les liens et les titres : sur un portable
//  de 768 px de haut, on en voyait sept et on cherchait les trois
//  autres.
//
//  Une troisième page, et pas un rechargement de la première : le
//  stock du switcheroo doit être écrit AVANT que le module parte, et
//  `addInitScript` est le seul endroit qui passe avant tout le reste.
//  Lui demander de se redessiner en cours de route voudrait que le
//  paquet expose son remplisseur — or il ne fuit rien dans la page, et
//  c'est la règle 6 du garde-fou.
const p3 = await nav.newPage({ viewport: { width: 1280, height: 900 } });
p3.on("pageerror", (e) => soucis.push("erreur JS (dix personnages) : " + e.message));
await p3.route("**/*", (r) => {
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
  for (const f of ["monomer.js", "switcheroo.js"]) {
    if (u.endsWith("/" + f)) {
      return r.fulfill({ contentType: "text/javascript", body: switcheroo[f] });
    }
  }
  return r.fulfill({ contentType: "text/html; charset=utf-8", body: page });
});
await p3.addInitScript(() => {
  globalThis._userdata = {
    session_logged_in: 1,
    user_id: 4,
    username: "Compte de test",
    avatar: '<img src="https://i.servimg.com/u/f12/avatar.jpg" alt="" />',
  };
  //  LA FORME EXACTE DU SWITCHEROO, relue dans son code à son commit
  //  épinglé : `id`, `username`, et `avatar` qui est du HTML — c'est
  //  ce que Forumactif met dans `_userdata.avatar`.
  //
  //  Un avatar vide ne marche PAS : il fait
  //  `avatar.querySelector('img').draggable = false`, donc il lève sur
  //  la première entrée et la boucle meurt. Mesuré en l'essayant : une
  //  seule pastille au lieu de dix.
  const faux = [];
  for (let i = 1; i <= 10; i++) {
    faux.push({
      id: 1000 + i,
      username: "Personnage numéro " + i,
      avatar: '<img src="https://i.servimg.com/u/f12/avatar.jpg" alt="" />',
    });
  }
  localStorage.setItem("switcheroo", JSON.stringify(faux));
});
await p3.goto("http://wild-mystery.test/");
await p3.addScriptTag({ url: "http://wild-mystery.test/js/wild-mystery.js" });
await p3.waitForTimeout(900);
await p3.evaluate(() => document.querySelector('[aria-controls="wm-panneau"]')?.click());
await p3.waitForTimeout(400);

const place = await p3.evaluate(() => {
  const panneau = document.querySelector("#wm-panneau");
  if (panneau === null) return { personnages: -1 };
  const toutes = [...panneau.querySelectorAll(".wm-panneau__carte")];
  //  La carte « Associer un personnage » n'est pas un personnage.
  const persos = toutes.filter((c) => !c.classList.contains("wm-panneau__carte--ajout"));
  const liens = [...panneau.querySelectorAll(".wm-panneau__lien")];
  const h = (e) => Math.round(e.getBoundingClientRect().height);
  return {
    personnages: persos.length,
    hauteurCarte: persos.length > 0 ? h(persos[0]) : 0,
    hauteurLien: liens.length > 0 ? h(liens[0]) : 0,
    //  LA MESURE QUI COMPTE : tout le contenu du panneau contre la
    //  place qu'il a. `scrollHeight` inclut ce qui dépasse.
    contenu: panneau.scrollHeight,
    place: Math.round(panneau.getBoundingClientRect().height),
    //  Et le dernier doit être ATTEIGNABLE : on y défile, et on
    //  vérifie qu'il entre dans la fenêtre du panneau.
    //  La liste des dix, SEULE : c'est la garantie stable. Le panneau
    //  entier dépend du nombre de liens, qui bougera ; la section des
    //  personnages, elle, doit toujours pouvoir se voir d'un coup.
    hauteurDesDix: (() => {
      if (persos.length === 0) return 0;
      const a = persos[0].getBoundingClientRect(), z = persos[persos.length - 1];
      return Math.round(z.getBoundingClientRect().bottom - a.top);
    })(),
    dernierAtteignable: (() => {
      if (persos.length === 0) return false;
      const dernier = persos[persos.length - 1];
      dernier.scrollIntoView({ block: "nearest" });
      const rd = dernier.getBoundingClientRect(), rp = panneau.getBoundingClientRect();
      return rd.top >= rp.top - 1 && rd.bottom <= rp.bottom + 1;
    })(),
  };
});
dire("les dix personnages sont posés", place.personnages === 10, JSON.stringify(place));
dire(
  "une carte de personnage a maigri : 46 px au lieu de 75",
  place.hauteurCarte > 0 && place.hauteurCarte <= 46,
  `${place.hauteurCarte} px`,
);
dire(
  "et une entrée de menu, 28 au lieu de 36",
  place.hauteurLien > 0 && place.hauteurLien <= 28,
  `${place.hauteurLien} px`,
);
//  LA GARANTIE STABLE : les dix cartes se voient d'un coup. Le nombre
//  de liens du menu bougera ; dix personnages, non.
dire(
  "LES DIX CARTES SE VOIENT D'UN COUP",
  place.hauteurDesDix > 0 && place.hauteurDesDix <= place.place,
  `${place.hauteurDesDix} px de cartes pour ${place.place} de panneau`,
);
//  ET C'EST UN BUDGET, pas une coïncidence : à 900 px de haut, le
//  panneau entier — liens compris — tient tout juste. Si cette
//  assertion tombe un jour, c'est qu'on a ajouté une entrée au menu ou
//  repris de la hauteur quelque part, et il faudra décider laquelle des
//  deux sections la rend.
dire(
  "et le panneau entier tient sur un écran de 900",
  place.contenu <= place.place,
  `${place.contenu} px de contenu pour ${place.place} de place`,
);
dire("et le dixième personnage s'atteint", place.dernierAtteignable, JSON.stringify(place));

// ── 12 · L'AVATAR NE CLIGNOTE PLUS ──────────────────────────────────
//
//  « Quand la page recharge, j'ai mon avatar qui s'affiche en haut puis
//  qui disparaît » — Callista, 8 octobre. Ce n'est pas le nôtre :
//  `.wm-nav__avatar` est là et le reste. C'est `#fa_avatar`, dans la
//  barre Forumactif, qui se peint en haut de l'écran pendant qu'on va
//  chercher `navigation.json`.
//
//  CE QUI SE TESTE ICI N'EST PAS L'ÉTAT FINAL — il est déjà couvert
//  plus haut. C'est L'ENTRE-DEUX, et il ne se voit qu'en retenant la
//  réponse : la route attend 700 ms avant de servir le fichier, et on
//  regarde la barre pendant ce temps-là.
const p4 = await nav.newPage({ viewport: { width: 1280, height: 900 } });
p4.on("pageerror", (e) => soucis.push("erreur JS (clignotement) : " + e.message));
await p4.route("**/*", async (r) => {
  const u = r.request().url();
  if (u.endsWith("/data/navigation.json")) {
    //  LE RETARD EST LE DÉCOR. Sans lui, le fichier arrive avant qu'on
    //  ait pu regarder, et l'assertion passerait sur du code faux.
    await new Promise((f) => setTimeout(f, 700));
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
  for (const f of ["monomer.js", "switcheroo.js"]) {
    if (u.endsWith("/" + f)) {
      return r.fulfill({ contentType: "text/javascript", body: switcheroo[f] });
    }
  }
  return r.fulfill({ contentType: "text/html; charset=utf-8", body: page });
});
await p4.goto("http://wild-mystery.test/");
await p4.evaluate(() => {
  globalThis._userdata = {
    session_logged_in: 1,
    user_id: 4,
    username: "Compte de test",
    avatar: '<img src="https://i.servimg.com/u/f12/avatar.jpg" alt="" />',
  };
});
//  On n'attend PAS le script : `addScriptTag` rend la main quand il est
//  exécuté, et c'est justement l'instant où la classe doit déjà être là.
await p4.addScriptTag({ url: "http://wild-mystery.test/js/wild-mystery.js" });
await p4.waitForTimeout(150);
const pendant = await p4.evaluate(() => {
  const tb = document.querySelector("#fa_toolbar");
  return {
    attendue: document.documentElement.classList.contains("wm-toolbar-attendue"),
    visibilite: getComputedStyle(tb).visibility,
    //  Elle est TOUJOURS DANS LA PAGE et toujours mesurable : c'est la
    //  raison du `visibility` plutôt que du `display`. Leur script lit
    //  cette hauteur pour écrire la marge du corps.
    hauteur: Math.round(tb.getBoundingClientRect().height),
    chezNous: tb.closest(".wm-nav__droite") !== null,
  };
});
dire(
  "PENDANT L'ATTENTE, la barre Forumactif est retenue",
  pendant.attendue && pendant.visibilite === "hidden" && !pendant.chezNous,
  JSON.stringify(pendant),
);
dire(
  "et elle garde sa hauteur : invisible, pas absente",
  pendant.hauteur > 0,
  `${pendant.hauteur} px`,
);
await p4.waitForTimeout(900);
const apres = await p4.evaluate(() => {
  const tb = document.querySelector("#fa_toolbar");
  return {
    attendue: document.documentElement.classList.contains("wm-toolbar-attendue"),
    visibilite: getComputedStyle(tb).visibility,
    chezNous: tb.closest(".wm-nav__droite") !== null,
    cloche: getComputedStyle(document.querySelector("#fa_notifications")).visibility,
  };
});
dire(
  "APRÈS, elle est chez nous et l'attente est levée",
  !apres.attendue && apres.chezNous && apres.visibilite === "visible",
  JSON.stringify(apres),
);
dire("et la cloche se voit", apres.cloche === "visible", apres.cloche);

//  LE REPLI, ET C'EST LUI QUI COMPTE LE PLUS. Si `navigation.json`
//  n'arrive jamais — panne de Pages, extension qui bloque —, la barre
//  Forumactif redevient la seule issue vers les notifications et la
//  déconnexion. Une classe d'attente qui survit à l'attente les perd
//  toutes les deux, et personne ne saurait pourquoi.
const p5 = await nav.newPage({ viewport: { width: 1280, height: 900 } });
p5.on("pageerror", (e) => soucis.push("erreur JS (repli) : " + e.message));
await p5.route("**/*", (r) => {
  const u = r.request().url();
  if (u.endsWith("/data/navigation.json")) return r.fulfill({ status: 503, body: "" });
  if (u.endsWith("/js/wild-mystery.js")) {
    return r.fulfill({
      contentType: "text/javascript",
      body: readFileSync(R + "js/wild-mystery.js", "utf8"),
    });
  }
  for (const f of ["monomer.js", "switcheroo.js"]) {
    if (u.endsWith("/" + f)) {
      return r.fulfill({ contentType: "text/javascript", body: switcheroo[f] });
    }
  }
  return r.fulfill({ contentType: "text/html; charset=utf-8", body: page });
});
await p5.goto("http://wild-mystery.test/");
await p5.evaluate(() => {
  globalThis._userdata = { session_logged_in: 1, user_id: 4, username: "Compte de test" };
});
await p5.addScriptTag({ url: "http://wild-mystery.test/js/wild-mystery.js" });
await p5.waitForTimeout(600);
const repli = await p5.evaluate(() => {
  const tb = document.querySelector("#fa_toolbar");
  const d = document.querySelector("#fa_notifications");
  return {
    attendue: document.documentElement.classList.contains("wm-toolbar-attendue"),
    visibilite: getComputedStyle(tb).visibility,
    deconnexion: [...tb.querySelectorAll("a[href]")].some((a) =>
      /logout/.test(a.getAttribute("href") ?? "")
    ),
    cloche: d === null ? "absente" : getComputedStyle(d).visibility,
  };
});
dire(
  "SANS `navigation.json`, LA BARRE FORUMACTIF EST RENDUE",
  !repli.attendue && repli.visibilite === "visible",
  JSON.stringify(repli),
);
dire(
  "et le joueur garde sa déconnexion et ses notifications",
  repli.deconnexion && repli.cloche === "visible",
  JSON.stringify(repli),
);

await nav.close();
if (soucis.length > 0) { for (const x of soucis) console.log("  · " + x); }
console.log(soucis.length === 0 ? "\nTOUT PASSE." : `\n${soucis.length} DÉFAUT(S).`);
process.exit(soucis.length === 0 ? 0 : 1);
