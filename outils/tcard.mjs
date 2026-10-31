// ════════════════════════════════════════════════════════════════════
//  outils/tcard.mjs — la carte dresseur, montée dans un navigateur
//
//  Lancement : `deno task tcard`
//              `deno task tcard --apercu`   → apercu-tcard.html
//
//  ── POURQUOI CE HARNAIS EXISTE ─────────────────────────────────────
//
//  La carte dresseur n'est dans AUCUNE planche. « Mon jeu » dessine
//  une page — carte d'identité, équipe et badges dans trois blocs
//  séparés, avec la colonne du carnet autour. Ici c'est la même
//  matière dans un seul bloc, collé dans un message.
//
//  Rien ne la retient donc, et c'est exactement le cas où un décor
//  incomplet ne teste que lui-même. Six fois cette erreur a été payée
//  depuis le 28 octobre : `dfn{display:none}` manquant, `box-sizing`
//  manquant, `#wrap` manquant, Ionicons absente, deux options de
//  liste là où le forum en sert huit, un groupe là où il en rend
//  trois. Le décor d'ici sert donc la carte À SA PLACE RÉELLE : dans
//  `.postbody`, qui fait 714 px sur la page d'un sujet, sous les
//  36 px de rembourrage de `#wrap`.
//
//  ── CE QU'IL NE FAIT PAS ───────────────────────────────────────────
//
//  Il ne monte pas `mod-tcard` : le script qui remplira le palier,
//  l'argent, les badges et l'équipe n'existe pas encore. Ce qui est
//  mesuré ici est la carte TELLE QU'ELLE EST COLLÉE — valeurs
//  d'attente, six places libres, sept badges à gagner. C'est l'état
//  qu'un joueur voit avant que le script tourne, et celui qu'il verra
//  toujours si le script tombe.
// ════════════════════════════════════════════════════════════════════

import { readFileSync, writeFileSync } from "node:fs";
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
const PIXEL =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAD0lEQVR4nGP4z8DAxIAEAB0GAwMBHe4bAAAAAElFTkSuQmCC";

/*  DEUX SPRITES DE PROPORTIONS TRÈS DIFFÉRENTES — 48 × 48 et 56 × 14
    — et c'est tout l'enjeu de l'alignement.

    LES PREMIERS FAISAIENT 8 × 8 ET 16 × 5, et c'était trop peu : une
    fois centrés dans une case de 56, leurs bas tombaient à 32 et 31
    px, soit un pixel d'écart — juste sous la tolérance du contrôle,
    qui passait donc même sans `object-position: bottom`. Une règle
    qu'on croyait tenue ne l'était pas. Avec 48 et 14 de haut, l'écart
    centré est de dix-sept pixels : la règle a de quoi se prouver. Les sprites de PokéAPI ne sont pas carrés : un
    Lokhlass est large et bas, un Nostenfer haut et étroit. Un décor
    qui n'en sert qu'un seul, carré, ne peut pas voir qu'ils flottent
    à des hauteurs différentes dans leur case. */
const SPRITE_CARRE =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADAAAAAwCAYAAABXAvmHAAAARklEQVR42u3PAQ0AIAgAMCScIUxie2jBxvY3+PnvViyWsZyAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDAnAaMVAJ3bk41lgAAAABJRU5ErkJggg==";
const SPRITE_LARGE =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADgAAAAOCAYAAAB6pd+uAAAALUlEQVR42u3PAQ0AIAgAMCScIUxie4jBxv4GP//disUylhMUFBQUFBQUFBSc0msgAjPOwJRTAAAAAElFTkSuQmCC";

/*  ── LA CARTE VIENT DU FICHIER, PAS D'ICI ─────────────────────────

    `templates/carte-dresseur.a-coller.html` est ce que les joueurs
    copieront. Si le harnais en gardait sa propre copie, il mesurerait
    une carte que personne ne colle — et les deux dériveraient au
    premier ajustement. On lit donc le fichier et on en extrait le
    bloc entre les deux marqueurs, qui est exactement ce qui part. */
/*  LA CARTE DU COMPTE DE TEST, telle que `equipe-de-test.py` la
    produit. C'est elle qui porte les infobulles : six Pokémon réels
    de Rhode, un obscur parmi eux, des mono-types et des doubles. Le
    harnais ne s'en fabrique pas une version à lui — celle-là est
    celle que Callista colle sur le forum. */
function carteDuCompteDeTest() {
  const brut = readFileSync(
    R + "templates/carte-dresseur.compte-de-test.html",
    "utf8",
  );
  return brut
    .replace(/<!--[\s\S]*?-->/g, "")
    //  Les sprites de PokéAPI ne sont pas joignables depuis le
    //  harnais, et ne sont pas ce qu'on mesure.
    .replace(/src="https:\/\/[^"]*"/g, `src="${PIXEL}"`)
    .replace(/<div class="wm-tcard"/, '<div id="test" class="wm-tcard"');
}

function carteACoprier() {
  const brut = readFileSync(R + "templates/carte-dresseur.a-coller.html", "utf8");
  const m = brut.match(
    /<!-- ▼▼▼ DÉBUT DU CODE À COPIER ▼▼▼ -->([\s\S]*?)<!-- ▲▲▲ FIN DU CODE À COPIER ▲▲▲ -->/,
  );
  if (m === null) {
    console.error("Les marqueurs du bloc à copier sont introuvables.");
    Deno.exit(1);
  }
  return m[1].replace(/ADRESSE DE TON AVATAR/g, PIXEL);
}

/*  ── UNE CARTE REMPLIE, pour mesurer ce que le script produira ────

    Les six places libres et les sept badges à gagner sont l'état de
    départ. Mais une rangée de cases vides ne dit rien de ce qui se
    passe quand elles portent un sprite, un nom long et une pastille
    de type — or c'est là que les hauteurs se décalent. Le harnais
    monte donc les DEUX états sur la même page. */
function carteRemplie() {
  const equipe = [
    ["Grolem", 26, "roche", "Roche"],
    ["Nostenfer", 24, "vol", "Vol"],
    //  UN NOM LONG EXPRÈS. C'est lui qui pousse une case plus large
    //  que ses voisines si l'ellipse manque.
    ["Ronflex-de-la-Combe-aux-Loups", 22, "normal", "Normal"],
    ["Flagadoss", 21, "eau", "Eau"],
  ];
  const cases = equipe
    .map(([nom, niv, cle, type], i) =>
      `<li class="wm-tcard__pkmn">
        <img class="wm-tcard__sprite" src="${
        i % 2 === 0 ? SPRITE_CARRE : SPRITE_LARGE
      }" alt="" />
        <p class="wm-tcard__nom">${nom}</p>
        <p class="wm-tcard__niveau">niv. ${niv}</p>
        <span class="wm-type wm-type--${cle}">${type}</span>
      </li>`
    )
    .join("");
  const libres = Array.from(
    { length: 2 },
    () =>
      `<li class="wm-tcard__pkmn wm-tcard__pkmn--libre">
      <span class="wm-tcard__sprite"></span>
      <p class="wm-tcard__libre">Place libre</p>
    </li>`,
  ).join("");

  //  SEPT ARÈNES, DANS L'ORDRE IMPOSÉ, et quatre colosseums.
  //
  //  Troisième état de cette liste. Les deux premiers étaient faux, et
  //  la vérité était déjà écrite dans `forumactif/36` et `/82` :
  //  l'ordre des arènes est celui dans lequel on doit les affronter —
  //  on ne peut pas les faire dans le désordre — et les quatre
  //  colosseums sont Fée, Spectre, Électrik et Dragon, confirmés par
  //  la description de `f22-colosseum-de-titanite` sur le forum.
  //
  //  Le harnais sert donc cet ordre-là, et un contrôle plus bas le
  //  vérifie : si quelqu'un réarrange la liste du code collé, il
  //  tombe.
  const BADGES = [
    ["feu", "Feu", true],
    ["plante", "Plante", true],
    ["eau", "Eau", false],
    ["acier", "Acier", false],
    ["roche", "Roche", false],
    ["vol", "Vol", false],
    ["tenebres", "Ténèbres", false],
  ];
  const COLOSSEUMS = [
    ["fee", "Fée", "Rhode", true],
    ["spectre", "Spectre", "Phenacit", false],
    ["electrik", "Électrik", "Targare", false],
    ["dragon", "Dragon", "Titanite", false],
  ];
  const colosseums = COLOSSEUMS
    .map(([cle, _type, lieu, obtenu]) =>
      `<li class="wm-tcard__badge${obtenu ? "" : " wm-tcard__badge--agagner"}"
          data-wm-badge="${cle}" tabindex="0">
        <span class="wm-tcard__bulle">
          <span class="wm-tcard__bulle-nom">Badge - Colosseum de ${lieu}</span>
          <span class="wm-tcard__bulle-etat">${obtenu ? "Obtenu" : "Non obtenu"}</span>
        </span>
      </li>`
    )
    .join("");

  const badges = BADGES
    .map(([cle, nom, obtenu]) =>
      //  AUCUNE `<img>` : le dessin vient de `20-icones.css`, par
      //  `data-wm-badge`. Le harnais sert donc exactement ce que le
      //  code collé contient.
      `<li class="wm-tcard__badge${obtenu ? "" : " wm-tcard__badge--agagner"}"
          data-wm-badge="${cle}" title="${nom}"></li>`
    )
    .join("");

  return `<div class="wm-tcard" data-wm-tcard data-wm-nature="brave" id="remplie">
  <div class="wm-dresseur">
    <!-- UN AVATAR QUI N'EST PAS CARRE, et c'est tout l'objet : sur le
         forum celui du compte de test fait 72 x 115, parce que
         l'image est plus haute que large et que ModernBB impose
         height: auto. Avec un pixel carre, la regle qui le rend
         carre ne retiendrait rien. -->
    <img class="wm-dresseur__avatar" src="${SPRITE_LARGE}" alt="" />
    <div class="wm-dresseur__infos">
      <p class="wm-dresseur__identite">
        <span class="wm-dresseur__nom">Eliott Vanner</span>
        <span class="wm-dresseur__numero">Dresseur nº 0042</span>
      </p>
    </div>
    <ul class="wm-tcard__compteurs">
      <li class="wm-tcard__compteur">
        <span class="wm-tcard__chiffre" data-wm-tcard-palier>2</span>
        <span class="wm-tcard__libelle">palier</span>
      </li>
      <li class="wm-tcard__compteur">
        <span class="wm-tcard__chiffre" data-wm-tcard-argent>1 240</span>
        <span class="wm-tcard__libelle">pokédollars</span>
      </li>
      <li class="wm-tcard__compteur">
        <span class="wm-tcard__chiffre" data-wm-tcard-compte>3 / 11</span>
        <span class="wm-tcard__libelle">badges</span>
      </li>
    </ul>
  </div>
  <div class="wm-tcard__corps">
    <section class="wm-tcard__bloc">
      <h4 class="wm-tcard__titre">Mon équipe</h4>
      <ul class="wm-tcard__equipe" data-wm-tcard-equipe>${cases}${libres}</ul>
    </section>
    <section class="wm-tcard__bloc">
      <h4 class="wm-tcard__titre">Mes badges</h4>
      <div class="wm-tcard__familles">
        <div class="wm-tcard__famille">
          <span class="wm-tcard__soustitre">Arènes</span>
          <ul class="wm-tcard__badges" data-wm-tcard-badges>${badges}</ul>
        </div>
        <div class="wm-tcard__famille">
          <span class="wm-tcard__soustitre">Colosseums</span>
          <ul class="wm-tcard__badges">${colosseums}</ul>
        </div>
      </div>
    </section>
  </div>
</div>`;
}

/*  LA FEUILLE DE MODERNBB, RÉDUITE À CE QUI PIÈGE — la même qu'en
    `sujet.mjs`, et pour la même raison : une carte mesurée hors de
    `.postbody` serait mesurée dans 1328 px au lieu de 714, et toutes
    les rangées tiendraient. */
const BASE_MODERNBB = `
/*  LA REGLE RESPONSIVE DE MODERNBB SUR LES IMAGES D'UN MESSAGE.
    Relevee le 31 octobre en la combattant sur le forum : une
    declaration de hauteur sans !important ne passe pas, avec
    !important oui. C'est elle qui rendait nos sprites inegaux.
    (Pas de guillemet oblique ici : on est dans un gabarit de chaine.) */
.post img, .postbody img { height: auto !important; }

*, *::before, *::after { box-sizing: border-box; }
.postbody { margin-right: 211px; padding: 12px 18px 18px; }
.post { display: flex; flex-wrap: wrap; }
#wrap { max-width: 1400px; margin: 0 auto; padding: 36px; }`;

const page = (corps) =>
  `<!doctype html><html lang="fr"><head><meta charset="utf-8">
<style>${BASE_MODERNBB}</style>
<style>${readFileSync(R + "panneau-admin/jetons.css", "utf8")}</style>
<style>${
  //  LES ADRESSES D'IMAGES SONT RELATIVES À LA FEUILLE, pas à la
  //  page. Sur le forum la feuille est servie depuis `/css/`, donc
  //  `../img/…` tombe juste. Ici elle est recopiée DANS une page
  //  montée par `setContent`, dont l'origine est `about:blank` :
  //  aucune adresse relative ni `file://` n'y charge quoi que ce
  //  soit. On lit donc le fichier sur le disque et on le met en
  //  `data:` — s'il n'existe pas, `readFileSync` jette ici, et si
  //  l'adresse est fausse, le `naturalWidth` plus bas tombe. Relire
  //  l'adresse déclarée n'aurait rien prouvé.
  readFileSync(R + "css/wild-mystery.css", "utf8").replaceAll(
    /url\("\.\.\/img\/([^"]+)"\)/g,
    (_, f) =>
      `url("data:image/png;base64,${readFileSync(R + "img/" + f).toString("base64")}")`,
  )
}</style>
<style>html,body{margin:0}body{background:var(--wm-fond-page)}</style>
</head><body id="modernbb">
<div class="conteneur_minwidth_IE modern-resp">
<div id="wrap"><div id="page-body">${corps}</div></div>
</div>
</body></html>`;

/*  ── LE MESSAGE AUTOUR, AVEC SA COLONNE DE PROFIL ────────────────

    Premier jet : `.post` et `.postbody`, rien d'autre. Le corps
    mesurait 1092 px et les six cases d'équipe tenaient largement —
    sauf que sur le forum elles n'ont pas 1092 px, elles en ont 714.
    La colonne de profil, 236 px en `flex: 0 0`, est ce qui fait la
    différence, et un décor qui ne la sert pas ne teste que lui-même.
    Septième fois depuis le 28 octobre.

    `.postbody` garde en plus son `margin-right: 211px` : c'est la
    place d'un profil à DROITE que ModernBB réserve et que le forum
    n'utilise pas. On ne l'enlève pas pour arranger la mesure — c'est
    ce que la feuille sert. */
const dansUnMessage = (cartes) =>
  `<div class="post">
    <div class="postprofile">
      <dl><dd class="postprofile-info">la colonne de gauche</dd></dl>
    </div>
    <div class="wm-post-corps"><div class="postbody">${cartes}</div></div>
  </div>`;

// ════════════════════════════════════════════════════════════════════

if (CHROME === undefined) {
  console.error("Aucun Chromium trouvé. `deno task test:navigateur` en installe un.");
  Deno.exit(1);
}

const nav = await chromium.launch({ executablePath: CHROME });
const soucis = [];

function dire(nom, ok, detail = "") {
  console.log(`  ${ok ? "ok  " : "DÉFAUT"} ${nom}${detail === "" ? "" : " — " + detail}`);
  if (!ok) soucis.push(nom + (detail === "" ? "" : " — " + detail));
}

console.log("\n── la carte dresseur ──");

const p = await nav.newPage({ viewport: { width: 1440, height: 1400 } });
await p.setContent(
  page(dansUnMessage(carteACoprier() + carteRemplie())),
  { waitUntil: "load" },
);

//  Les deux cartes sont dans la page : la vide telle qu'on la colle,
//  la remplie telle que le script la laissera.
const CARTES = ["[data-wm-tcard]:not(#remplie)", "#remplie"];
const NOMS = ["collée telle quelle", "remplie"];

// ── 1 · elle tient dans le corps d'un message ───────────────────────

for (let i = 0; i < CARTES.length; i++) {
  const m = await p.evaluate((sel) => {
    const carte = document.querySelector(sel);
    const corps = document.querySelector(".postbody");
    if (carte === null || corps === null) return null;
    const r = (e) => e.getBoundingClientRect();
    //  `clientWidth` moins les rembourrages, pas `getBoundingClientRect` :
    //  celui-ci compte les bordures, et 1158 contre 1160 avait déjà fait
    //  échouer une mesure juste le 30 octobre.
    const st = getComputedStyle(corps);
    const utile = corps.clientWidth - parseFloat(st.paddingLeft) -
      parseFloat(st.paddingRight);
    return {
      utile: Math.round(utile),
      largeur: Math.round(r(carte).width),
      //  Rien ne sort de la carte, ni en largeur ni par la droite.
      deborde: Math.round(
        Math.max(
          0,
          ...[...carte.querySelectorAll("*")].map((e) => r(e).right - r(carte).right),
        ),
      ),
      //  Pas de barre horizontale dans la page.
      barre: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    };
  }, CARTES[i]);

  dire(
    `elle remplit le corps d'un message sans en sortir (${NOMS[i]})`,
    m !== null && m.largeur === m.utile && m.deborde <= 1 && m.barre <= 0,
    JSON.stringify(m),
  );
}

// ── 2 · le bandeau est à fond perdu ─────────────────────────────────

//  `.wm-dresseur` fait `width: 100%` parce qu'en haut du carnet il est
//  seul sur sa ligne. Dans une carte bordée, 100 % plus la bordure lui
//  faisait dépasser d'un pixel à droite — un liseré clair le long du
//  dégradé. La règle `width: auto` de la feuille 18 répare ça ; ce
//  contrôle est ce qui la retient.
const bandeau = await p.evaluate(() => {
  const carte = document.querySelector("#remplie");
  const b = carte?.querySelector(".wm-dresseur");
  if (carte == null || b == null) return null;
  const rc = carte.getBoundingClientRect(), rb = b.getBoundingClientRect();
  const bord = parseFloat(getComputedStyle(carte).borderLeftWidth);
  return {
    gauche: Math.round(rb.left - rc.left - bord),
    droite: Math.round(rc.right - bord - rb.right),
    haut: Math.round(rb.top - rc.top - parseFloat(getComputedStyle(carte).borderTopWidth)),
  };
});

dire(
  "le bandeau d'identité est à fond perdu contre les trois bords",
  bandeau !== null && Math.abs(bandeau.gauche) <= 1 &&
    Math.abs(bandeau.droite) <= 1 && Math.abs(bandeau.haut) <= 1,
  JSON.stringify(bandeau),
);

// ── 3 · les trois compteurs ─────────────────────────────────────────

const compteurs = await p.evaluate(() => {
  const liste = document.querySelector("#remplie .wm-tcard__compteurs");
  const items = [...document.querySelectorAll("#remplie .wm-tcard__compteur")];
  const infos = document.querySelector("#remplie .wm-dresseur__infos");
  if (liste === null || items.length !== 3 || infos === null) return null;
  const r = (e) => e.getBoundingClientRect();
  return {
    combien: items.length,
    //  Sur une ligne : trois hauts identiques.
    surUneLigne: new Set(items.map((e) => Math.round(r(e).top))).size === 1,
    //  Un filet entre eux, et pas au début : deux séparateurs pour trois.
    filets: items.filter((e) => parseFloat(getComputedStyle(e).borderLeftWidth) > 0).length,
    //  Ils sont À DROITE du nom, poussés par le ressort du bandeau.
    aDroite: Math.round(r(liste).left) >= Math.round(r(infos).right),
    //  Et ils ne sortent pas du bandeau.
    deborde: Math.round(r(liste).right - r(liste.parentElement).right),
  };
});

dire(
  "les trois compteurs sont alignés à droite, séparés par deux filets",
  compteurs !== null && compteurs.surUneLigne && compteurs.filets === 2 &&
    compteurs.aDroite && compteurs.deborde <= 0,
  JSON.stringify(compteurs),
);

// ── 4 · l'équipe : six cases, une rangée, même largeur ──────────────

for (let i = 0; i < CARTES.length; i++) {
  const eq = await p.evaluate((sel) => {
    const cases = [...document.querySelectorAll(`${sel} .wm-tcard__pkmn`)];
    if (cases.length === 0) return null;
    const r = (e) => e.getBoundingClientRect();
    const larg = cases.map((e) => Math.round(r(e).width));
    const haut = cases.map((e) => Math.round(r(e).height));
    return {
      combien: cases.length,
      rangees: new Set(cases.map((e) => Math.round(r(e).top))).size,
      //  `flex: 1 1 0` doit donner six parts égales. Une largeur qui
      //  suit le contenu ferait une case plus large pour le nom long.
      ecartLargeur: Math.max(...larg) - Math.min(...larg),
      //  UNE CASE LIBRE AUSSI HAUTE QU'UNE PLEINE. Sans ça, une équipe
      //  de quatre donne une rangée en dents de scie.
      ecartHauteur: Math.max(...haut) - Math.min(...haut),
    };
  }, CARTES[i]);

  dire(
    `six cases d'équipe, une seule rangée, toutes de même taille (${NOMS[i]})`,
    eq !== null && eq.combien === 6 && eq.rangees === 1 &&
      eq.ecartLargeur <= 1 && eq.ecartHauteur <= 1,
    JSON.stringify(eq),
  );
}

// ── 5 · le nom long est coupé, il ne pousse pas sa case ─────────────

const nomLong = await p.evaluate(() => {
  const noms = [...document.querySelectorAll("#remplie .wm-tcard__nom")];
  const long = noms.find((e) => e.textContent.includes("Loups"));
  if (long === undefined) return null;
  return {
    //  Le texte dépasse sa boîte — donc l'ellipse a bien à travailler.
    coupe: long.scrollWidth > long.clientWidth,
    //  Et la boîte reste dans sa case.
    deborde: Math.round(
      long.getBoundingClientRect().width -
        long.closest(".wm-tcard__pkmn").clientWidth,
    ),
  };
});

dire(
  "un nom trop long est coupé au lieu d'élargir sa case",
  nomLong !== null && nomLong.coupe && nomLong.deborde <= 0,
  JSON.stringify(nomLong),
);

// ── 6 · les badges ──────────────────────────────────────────────────

const ordre = await p.evaluate(() => {
  //  LA PREMIÈRE CARTE SEULEMENT : la page du harnais en pose deux,
  //  la lisible et la dégraissée, et sans cette racine les deux listes
  //  reviennent collées bout à bout.
  const carte = document.querySelector(".wm-tcard");
  const lire = (s) =>
    [...carte.querySelectorAll(s + " .wm-tcard__badge")].map((e) => e.dataset.wmBadge);
  return {
    arenes: lire("[data-wm-tcard-badges]"),
    //  LE SECOND `ul` est celui des colosseums : il n'a pas d'attribut
    //  de données, parce que le script ne le remplit pas depuis les
    //  récompenses d'arène.
    colosseums: lire(".wm-tcard__badges:not([data-wm-tcard-badges])"),
  };
});

//  L'ORDRE DES ARÈNES EST IMPOSÉ PAR LE JEU, pas par le dessin : on
//  ne peut pas affronter les arènes dans le désordre
//  (`forumactif/36`). Un contrôle le retient, sinon le prochain qui
//  trouve plus joli de les ranger par couleur casse la règle sans le
//  savoir.
const ORDRE_ATTENDU = ["feu", "plante", "eau", "acier", "roche", "vol", "tenebres"];
const COLOSSEUMS_ATTENDUS = ["fee", "spectre", "electrik", "dragon"];

dire(
  "les sept arènes sont dans l'ordre imposé, les quatre colosseums à part",
  ordre.arenes.join(",") === ORDRE_ATTENDU.join(",") &&
    ordre.colosseums.join(",") === COLOSSEUMS_ATTENDUS.join(","),
  JSON.stringify(ordre),
);

const badges = await p.evaluate(() => {
  const tous = [...document.querySelectorAll("#remplie .wm-tcard__badge")];
  if (tous.length === 0) return null;
  const r = (e) => e.getBoundingClientRect();
  const agagner = tous.filter((e) => e.classList.contains("wm-tcard__badge--agagner"));
  const obtenu = tous.filter((e) => !e.classList.contains("wm-tcard__badge--agagner"));
  return {
    combien: tous.length,
    //  DEUX LISTES, deux surtitres : « il faut séparer les badges
    //  d'arènes des badges de colosseums », 31 octobre.
    groupes: document.querySelectorAll("#remplie .wm-tcard__badges").length,
    soustitres: document.querySelectorAll("#remplie .wm-tcard__soustitre").length,
    //  TROIS PAR RANG, ET LA DERNIÈRE RANGÉE CENTRÉE SOUS LES AUTRES.
    parRang: (() => {
      const premiere = document.querySelector("#remplie .wm-tcard__badges");
      const lignes = {};
      for (const e of premiere.children) {
        const y = Math.round(r(e).top);
        lignes[y] = (lignes[y] ?? 0) + 1;
      }
      return Object.values(lignes);
    })(),
    centre: (() => {
      const liste = document.querySelector("#remplie .wm-tcard__badges");
      const enfants = [...liste.children];
      const rl = r(liste);
      const derniere = enfants.filter((e) =>
        Math.round(r(e).top) === Math.round(r(enfants.at(-1)).top)
      );
      const g = Math.round(r(derniere[0]).left - rl.left);
      const d = Math.round(rl.right - r(derniere.at(-1)).right);
      return Math.abs(g - d) <= 2;
    })(),
    rangees: new Set(tous.map((e) => Math.round(r(e).top))).size,
    //  LES DEUX FAMILLES CÔTE À CÔTE, et sur la MÊME ligne :
    //  « une colonne pour les arènes et une colonne pour les
    //  colosseums, et tu me mets tout sur une ligne », 31 octobre.
    deuxColonnes: (() => {
      const [a, b] = document.querySelectorAll("#remplie .wm-tcard__famille");
      if (b === undefined) return false;
      return Math.abs(Math.round(r(a).top) - Math.round(r(b).top)) <= 1 &&
        Math.round(r(a).right) <= Math.round(r(b).left);
    })(),
    //  ET CE SONT DE VRAIS ENCADRÉS : un filet, un fond, un arrondi.
    //  Sans ça « deux encadrés » ne voudrait dire que « deux
    //  colonnes », et la règle qui les dessine ne retiendrait rien.
    encadre: (() => {
      const b = document.querySelector("#remplie .wm-tcard__famille");
      const st = getComputedStyle(b);
      return {
        filet: Math.round(parseFloat(st.borderTopWidth)),
        arrondi: Math.round(parseFloat(st.borderTopLeftRadius)),
        air: Math.round(parseFloat(st.paddingTop)),
        fond: st.backgroundColor,
      };
    })(),
    //  CHAQUE FAMILLE TIENT SUR UNE LIGNE. C'est la demande, et c'est
    //  elle qui décide de la largeur des boîtes : elles ne sont donc
    //  PAS égales — celle des sept arènes est plus large que celle
    //  des quatre colosseums, et c'est voulu. Une version
    //  précédente les voulait égales, et les arènes passaient à deux
    //  rangées pendant que les colosseums laissaient du vide.
    //  ET ON LE MESURE SUR UNE CARTE SERRÉE, à 760. Sur une carte
    //  large, deux boîtes qui se partagent la place à égalité ont
    //  chacune assez pour sept badges, et le contrôle passerait sans
    //  rien prouver. À 760, la moitié fait 352 et les arènes en
    //  demandent 404 : c'est `nowrap` qui réserve la place, et sans
    //  lui elles repassent à deux rangées.
    badgesSurUneLigneSerre: (() => {
      const c = document.querySelector("#remplie");
      const avant = c.style.width;
      c.style.width = "760px";
      void c.offsetWidth;
      const ok = [...c.querySelectorAll(".wm-tcard__badges")].every((u) =>
        new Set([...u.children].map((x) => Math.round(r(x).top))).size === 1
      );
      c.style.width = avant;
      return ok;
    })(),
    badgesSurUneLigne: [
      ...document.querySelectorAll("#remplie .wm-tcard__badges"),
    ].every((u) => new Set([...u.children].map((c) => Math.round(r(c).top))).size === 1),
    encadresPrennentTout: (() => {
      const f = document.querySelector("#remplie .wm-tcard__familles");
      const [a, b] = f.querySelectorAll(".wm-tcard__famille");
      if (b === undefined) return false;
      //  ET LA RANGÉE ELLE-MÊME PREND TOUTE LA SECTION. Sans cette
      //  seconde mesure, deux boîtes bien étalées dans un conteneur
      //  étroit passeraient le contrôle : c'est exactement ce qui
      //  arrivait quand la section était encore une grille centrée.
      const section = f.closest(".wm-tcard__bloc");
      const st = getComputedStyle(section);
      const utile = Math.round(r(section).width) -
        Math.round(parseFloat(st.paddingLeft)) -
        Math.round(parseFloat(st.paddingRight));
      return Math.round(r(a).left) === Math.round(r(f).left) &&
        Math.round(r(b).right) === Math.round(r(f).right) &&
        Math.abs(Math.round(r(f).width) - utile) <= 1;
    })(),
    //  TOUT À GAUCHE DANS L'ENCADRÉ : le sous-titre et les badges
    //  partent du même bord, celui du rembourrage de la boîte.
    touteLaGauche: (() => {
      const boite = document.querySelector("#remplie .wm-tcard__famille");
      const st = boite.querySelector(".wm-tcard__soustitre");
      const premier = boite.querySelector(".wm-tcard__badge");
      const bord = Math.round(r(boite).left) +
        Math.round(parseFloat(getComputedStyle(boite).paddingLeft));
      return getComputedStyle(st).textAlign === "left" &&
        Math.abs(Math.round(r(premier).left) - bord) <= 1;
    })(),
    //  ET ELLES S'EMPILENT QUAND LA CARTE EST ÉTROITE. La carte est
    //  collée dans un message, dont la largeur n'est pas celle de
    //  l'écran : c'est elle qu'on rétrécit, pas la fenêtre, et c'est
    //  tout l'objet du `@container`. Sans lui, la grille débordait
    //  de 139 px dans une colonne de 320 — mesuré.
    empileSiEtroit: (() => {
      const carte = document.querySelector("#remplie");
      const avant = carte.style.width;
      carte.style.width = "360px";
      void carte.offsetWidth;
      const [a, b] = document.querySelectorAll("#remplie .wm-tcard__famille");
      const empile = Math.round(r(b).top) > Math.round(r(a).top);
      const parRang = (() => {
        const lignes = {};
        for (const e of a.children) {
          const y = Math.round(r(e).top);
          lignes[y] = (lignes[y] ?? 0) + 1;
        }
        return Object.values(lignes);
      })();
      carte.style.width = avant;
      return { empile, parRang };
    })(),
    //  UN BADGE À GAGNER SE RECONNAÎT À SON CADRE, pas à sa teinte :
    //  deux crèmes voisines ne se distinguent pas, et c'est la règle
    //  qui tient déjà les trois états du Pokédex.
    cadreDifferent: agagner.every((e) => getComputedStyle(e).borderLeftStyle === "dashed") &&
      obtenu.every((e) => getComputedStyle(e).borderLeftStyle === "solid"),
    //  DES CARRÉS ARRONDIS, PAS DES RONDS — et le même rayon que les
    //  cases de pokémon : « le même que pour les pokémons », 31
    //  octobre au soir. C'était un disque, et c'est la forme qui les
    //  séparait des cases, pas la couleur.
    memeFormeQueLesCases: (() => {
      const casePkmn = document.querySelector("#remplie .wm-tcard__pkmn");
      if (casePkmn === null) return false;
      const a = getComputedStyle(casePkmn);
      const b = getComputedStyle(tous[0]);
      //  LA FORME, PAS LA TEINTE. « Le même que pour les pokémons »
      //  visait le cadre ; la teinte, elle, a dû s'en écarter pour
      //  que les deux états d'un badge se lisent sur le fond de
      //  l'encadré — trois crèmes voisines ne se distinguent pas.
      return a.borderTopLeftRadius === b.borderTopLeftRadius &&
        a.borderTopColor === b.borderTopColor;
    })(),
    //  TROIS SURFACES DISTINCTES : l'encadré, la vignette obtenue,
    //  la vignette à gagner. C'est ce qui rend les deux états
    //  lisibles, et ça ne tient que si les trois diffèrent.
    troisSurfaces: (() => {
      const boite = document.querySelector("#remplie .wm-tcard__famille");
      const eu = document.querySelector(
        "#remplie .wm-tcard__badge:not(.wm-tcard__badge--agagner)",
      );
      const aEu = document.querySelector("#remplie .wm-tcard__badge--agagner");
      if (boite === null || eu === null || aEu === null) return null;
      const f = (e) => getComputedStyle(e).backgroundColor;
      return {
        encadre: f(boite),
        obtenu: f(eu),
        aGagner: f(aEu),
        distinctes: new Set([f(boite), f(eu), f(aEu)]).size === 3,
        //  ET L'ENCADRÉ PORTE LA SURFACE D'UNE CASE DE POKÉMON —
        //  « le fond ici doit être le même que ici ».
        memeFondQueLeCas: (() => {
          const cas = document.querySelector("#remplie .wm-tcard__pkmn");
          return cas !== null && f(cas) === f(boite);
        })(),
        //  ET LE DESSIN D'UN BADGE À GAGNER EST GRIS ET EFFACÉ —
        //  par un FONDU et pas par un `filter`, pour que
        //  l'infobulle, qui vit dans la vignette, reste lisible au
        //  moment précis où on la consulte.
        gris: getComputedStyle(aEu).backgroundBlendMode === "luminosity",
        efface: (() => {
          const m = getComputedStyle(aEu).backgroundColor.match(
            /([\d.]+)\s*\)$/,
          );
          //  Le fondu se mesure à l'opacité de la teinte qu'on pose
          //  par-dessus : plus elle est opaque, plus le dessin
          //  s'efface. En dessous de 0,85 il se voyait encore.
          return m !== null && Number(m[1]) >= 0.85;
        })(),
      };
    })(),
    //  ET LE DESSIN NE TOUCHE PAS SON FOND.
    airDansLaVignette: Math.round(parseFloat(getComputedStyle(tous[0]).paddingTop)),
  };
});

const secondePasse = await p.evaluate(() => {
  const g = (e) => getComputedStyle(e);
  const r = (e) => e.getBoundingClientRect();
  const carte = document.querySelector("#remplie");
  const av = carte.querySelector(".wm-dresseur__avatar");
  const cases = [...carte.querySelectorAll(".wm-tcard__pkmn")]
    .filter((e) => e.querySelector(".wm-tcard__nom") !== null);
  const bas = (sel) =>
    cases.map((c) => {
      const e = c.querySelector(sel);
      return e === null ? null : Math.round(r(e).bottom - r(c).bottom);
    });
  const st = [...carte.querySelectorAll(".wm-tcard__soustitre")];
  return {
    //  L'AVATAR DE LA CARTE EST CARRÉ : le bandeau d'identité est
    //  partagé avec la page d'un sujet, où il dessine un portrait.
    avatar: Math.round(r(av).width) + "x" + Math.round(r(av).height),
    //  NOM, NIVEAU ET TYPE SONT CHACUN À LA MÊME HAUTEUR D'UNE CASE À
    //  L'AUTRE. On mesure depuis le BAS de la case : c'est là qu'ils
    //  sont ancrés, et c'est ce que « alignés comme les types » veut
    //  dire. Un sprite plus grand ne doit plus les pousser.
    nomsAlignes: new Set(bas(".wm-tcard__nom")).size,
    niveauxAlignes: new Set(bas(".wm-tcard__niveau")).size,
    typesAlignes: new Set(bas(".wm-type")).size,
    //  ET TOUTES LES CASES DE SPRITE FONT 56, quelles que soient les
    //  proportions de l'image. C'est la vraie correction : ModernBB
    //  force `height: auto !important` sur les images d'un message,
    //  nos cases suivaient donc l'image — 83, 44, 60, 50 sur le
    //  forum — et c'est ça qui décalait les noms.
    //
    //  Le décor sert la règle de ModernBB et deux images de
    //  proportions différentes : sans elles, ce contrôle passerait
    //  sans rien prouver.
    hauteursDeSprite: [
      ...new Set(
        cases.map((c) => Math.round(r(c.querySelector(".wm-tcard__sprite")).height)),
      ),
    ],
    proportionsDesImages: new Set(
      cases.map((c) => {
        const i = c.querySelector(".wm-tcard__sprite");
        return i.naturalWidth + "x" + i.naturalHeight;
      }),
    ).size,
    //  LES DEUX SOUS-TITRES PARTENT DE LA MÊME LIGNE, et celui des
    //  colosseums n'a plus le filet qui sépare deux familles
    //  EMPILÉES — c'est lui qu'on voyait traîner à sa gauche.
    soustitresSurUneLigne: st.length === 2 &&
      Math.abs(Math.round(r(st[0]).top) - Math.round(r(st[1]).top)) <= 1,
    filetDuSecond: st.length === 2 ? g(st[1]).borderTopWidth : null,
    memeHauteur: st.length === 2 &&
      Math.round(r(st[0]).height) === Math.round(r(st[1]).height),
  };
});

dire(
  "l'avatar est carré, les trois lignes d'une case sont alignées, les deux colonnes aussi",
  secondePasse.avatar.split("x")[0] === secondePasse.avatar.split("x")[1] &&
    secondePasse.nomsAlignes === 1 && secondePasse.niveauxAlignes === 1 &&
    secondePasse.typesAlignes === 1 &&
    secondePasse.hauteursDeSprite.length === 1 &&
    secondePasse.hauteursDeSprite[0] === 56 &&
    secondePasse.proportionsDesImages > 1 &&
    secondePasse.soustitresSurUneLigne &&
    secondePasse.filetDuSecond === "0px" && secondePasse.memeHauteur,
  JSON.stringify(secondePasse),
);

//  ── CHAQUE BULLE SUIT SON BADGE ──────────────────────────────────
//
//  Elle était ancrée à la RANGÉE, avec `left: 0` : elle s'ouvrait
//  toujours au bord gauche, quel que soit le badge survolé. On
//  mesure donc que deux bulles de deux badges différents ne se
//  posent pas au même endroit, et que chacune est centrée sur le
//  sien.
const bulles = await p.evaluate(() => {
  const r = (e) => e.getBoundingClientRect();
  //  CELLES QUI PORTENT UNE BULLE : le décor sert les arènes en
  //  forme courte, sans infobulle, et les colosseums avec. C'est
  //  voulu — le code collé par une joueuse peut faire les deux.
  const vignettes = [...document.querySelectorAll("#remplie .wm-tcard__badge")]
    .filter((v) => v.querySelector(".wm-tcard__bulle") !== null);
  const lire = (v) => {
    const b = v.querySelector(".wm-tcard__bulle");
    if (b === null) return null;
    return {
      milieuBulle: Math.round(r(b).left + r(b).width / 2),
      milieuBadge: Math.round(r(v).left + r(v).width / 2),
      auDessus: Math.round(r(b).bottom) <= Math.round(r(v).top),
    };
  };
  const a = lire(vignettes[0]);
  const z = lire(vignettes.at(-1));
  return { a, z };
});

dire(
  "chaque bulle de badge est centrée sur SON badge, pas sur la rangée",
  bulles.a !== null && bulles.z !== null &&
    Math.abs(bulles.a.milieuBulle - bulles.a.milieuBadge) <= 1 &&
    Math.abs(bulles.z.milieuBulle - bulles.z.milieuBadge) <= 1 &&
    bulles.a.milieuBulle !== bulles.z.milieuBulle &&
    bulles.a.auDessus && bulles.z.auDessus,
  JSON.stringify(bulles),
);

//  ══════════════════════════════════════════════════════════════════
//  LE BANDEAU PORTE LA NATURE
//
//  « Tu peux mettre en image de fond le pokémon et la couleur du
//  groupe de la personne ? » Deux choses à prouver : avec l'attribut,
//  le légendaire est là ET la teinte est celle du groupe ; sans
//  l'attribut, le dégradé d'origine est intact. La seconde moitié
//  compte autant : une carte déjà collée ne doit pas changer de tête.
//  ══════════════════════════════════════════════════════════════════
//  LA TAILLE DU FICHIER SUR LE DISQUE, lue dans l'en-tête PNG :
//  c'est elle qui dit, dans la page, QUELLE mascotte est affichée —
//  l'adresse y est devenue un `data:` et ne porte plus de nom.
const taillePng = (chemin) => {
  const o = readFileSync(chemin);
  return [o.readUInt32BE(16), o.readUInt32BE(20)];
};
const CRESSELIA = taillePng(R + "img/natures/cresselia.png");

const nature = await p.evaluate(async (attendue) => {
  const carte = document.querySelector("#remplie");
  const bandeau = carte?.querySelector(".wm-dresseur");
  if (carte === null || bandeau == null) return null;
  const lire = () => getComputedStyle(bandeau).backgroundImage;
  const avec = lire();
  const adresse = avec.match(/url\("([^"]+)"\)/)?.[1] ?? "";
  const dessinee = adresse === "" ? null : await new Promise((ok) => {
    const i = new Image();
    i.onload = () => ok([i.naturalWidth, i.naturalHeight]);
    i.onerror = () => ok(null);
    i.src = adresse;
  });
  //  LA TEINTE DU GROUPE BRAVE, telle que `jetons.css` la donne —
  //  mesurée et pas recopiée, pour qu'un changement de jeton se voie.
  const teinte = getComputedStyle(carte).getPropertyValue("--tcard-teinte")
    .trim();
  carte.removeAttribute("data-wm-nature");
  const sans = lire();
  carte.setAttribute("data-wm-nature", "brave");
  return {
    //  L'IMAGE EXISTE ET SE CHARGE. Relire l'adresse déclarée ne
    //  prouvait rien : une adresse fausse se lit aussi bien qu'une
    //  bonne, et le bandeau restait nu.
    mascotte: dessinee !== null && dessinee[0] === attendue[0] &&
      dessinee[1] === attendue[1],
    dessinee,
    //  LA TEINTE ARRIVE BIEN AU DERNIER ARRÊT DU DÉGRADÉ. Le
    //  navigateur résout le jeton en `rgb()`, donc on compare à la
    //  forme résolue, déduite du jeton et pas recopiée : changer
    //  `--wm-groupe-brave-texte` dans jetons.css laisse passer, le
    //  débrancher du dégradé fait tomber.
    teinteDansLeDegrade: /^#[0-9a-f]{6}$/i.test(teinte) &&
      avec.includes(
        "rgb(" + [1, 3, 5].map((i) => parseInt(teinte.slice(i, i + 2), 16))
          .join(", ") + ")",
      ),
    teinte,
    //  ET LE LÉGENDAIRE EST UN FOND À FOND PERDU, PAS UNE MOSAÏQUE :
    //  sans `no-repeat` ni la taille, le bandeau se carrelait de
    //  petites Cresselia.
    cadree: getComputedStyle(bandeau).backgroundRepeat.startsWith("no-repeat") &&
      getComputedStyle(bandeau).backgroundSize.includes("auto 185%"),
    //  ET ELLE EST FONDUE, pas posée nette : sans ça elle passait
    //  par-dessus les trois compteurs.
    fondue: getComputedStyle(bandeau).backgroundBlendMode ===
      "normal, soft-light, normal",
    //  ET ELLE TIENT DANS LA MOITIÉ DROITE, DÉBORDANT PAR LE BAS.
    //  Calculé sur les mesures et pas relu dans la déclaration : on
    //  part de la hauteur réelle du bandeau et de la taille réelle
    //  du fichier. Sans cadrage, le légendaire se posait en haut à
    //  gauche, en plein sur le nom du dresseur.
    aDroiteEtDebordante: (() => {
      if (dessinee === null) return null;
      const st = getComputedStyle(bandeau);
      const boite = bandeau.getBoundingClientRect();
      const px = (v) => {
        const m = v.split(", ")[1].match(/calc\(100% \+ ([\d.]+)px\)/);
        return m === null ? null : Number(m[1]);
      };
      const deborde = px(st.backgroundPositionX);
      const dessous = px(st.backgroundPositionY);
      if (deborde === null || dessous === null) return null;
      const haut = boite.height * 1.85;
      const large = haut * (dessinee[0] / dessinee[1]);
      return {
        //  bord gauche du dessin, dans le repère du bandeau
        gauche: Math.round(boite.width + deborde - large),
        milieu: Math.round(boite.width / 2),
        dessous,
      };
    })(),
    sansAttribut: sans,
    //  SANS L'ATTRIBUT : un seul dégradé, aucune image, et la couleur
    //  de droite est celle d'origine.
    replieIntact: !sans.includes("url(") && sans.includes("117, 64, 66"),
  };
}, CRESSELIA);

dire(
  "le bandeau porte le légendaire de la nature et la couleur du groupe",
  nature !== null && nature.mascotte && nature.teinteDansLeDegrade &&
    nature.cadree && nature.fondue && nature.replieIntact &&
    nature.aDroiteEtDebordante !== null &&
    nature.aDroiteEtDebordante.gauche > nature.aDroiteEtDebordante.milieu &&
    nature.aDroiteEtDebordante.dessous > 0,
  JSON.stringify(nature),
);

dire(
  "deux encadrés côte à côte, chacun sur une ligne, tout collé à gauche",
  badges !== null && badges.combien === 11 && badges.groupes === 2 &&
    badges.cadreDifferent && badges.memeFormeQueLesCases &&
    badges.troisSurfaces !== null && badges.troisSurfaces.distinctes &&
    badges.troisSurfaces.memeFondQueLeCas &&
    badges.troisSurfaces.gris && badges.troisSurfaces.efface &&
    badges.airDansLaVignette >= 10 &&
    badges.soustitres === 2 &&
    //  LARGE : les deux encadrés côte à côte, de MÊME largeur — c'est
    //  `1fr 1fr` et pas `auto auto`, qui taillait chaque boîte sur
    //  ses badges : sept d'un côté, quatre de l'autre.
    badges.deuxColonnes && badges.badgesSurUneLigne &&
    badges.badgesSurUneLigneSerre &&
    badges.encadresPrennentTout &&
    badges.encadre.filet >= 1 && badges.encadre.arrondi >= 8 &&
    badges.encadre.air >= 12 &&
    badges.encadre.fond !== "rgba(0, 0, 0, 0)" &&
    //  ET TOUT EST COLLÉ À GAUCHE DEDANS : le sous-titre comme la
    //  première rangée de badges.
    badges.touteLaGauche &&
    //  ÉTROIT : les deux encadrés s'empilent. Sans ce second cas, le
    //  `@container` ne retiendrait rien.
    badges.empileSiEtroit.empile,
  JSON.stringify(badges),
);

// ── 6 bis · les sept badges portent leur dessin ─────────────────────

/*  « Les badges ne s'affichent pas dans la trainer card »,
    30 octobre. Ils ne s'affichaient pas parce que rien ne les
    affichait : le code collé ne porte que le NOM du badge, et
    j'avais laissé l'image à un script qui n'existe pas. La feuille
    produite `20-icones.css` les porte maintenant en `data:`. */
const dessins = await p.evaluate(() => {
  const tous = [...document.querySelectorAll("#remplie .wm-tcard__badge")];
  const fond = (e) => getComputedStyle(e, null).backgroundImage;
  return {
    combien: tous.length,
    tousDessines: tous.every((e) => fond(e).startsWith("url(")),
    //  ET À LA BONNE TAILLE. `background-image` seule laisse le SVG
    //  à sa taille naturelle, qui déborde de la pastille de 44 : le
    //  premier jet ne mesurait que la présence de l'image, et
    //  retirer `background-size` ne faisait donc rien tomber.
    bonneTaille: tous.every((e) => getComputedStyle(e).backgroundSize === "32px 32px"),
    //  SEPT DESSINS DIFFÉRENTS, et pas sept fois le même : une seule
    //  règle mal nommée les mettrait tous d'accord sur une image.
    distincts: new Set(tous.map(fond)).size,
    //  AUCUNE `<img>`, parce que le code collé n'en porte pas.
    sansImg: tous.every((e) => e.querySelector("img") === null),
  };
});

dire(
  "les onze badges portent chacun son dessin, sans aucune image à charger",
  dessins.combien === 11 && dessins.tousDessines && dessins.distincts === 11 &&
    dessins.sansImg && dessins.bonneTaille,
  JSON.stringify(dessins),
);

// ── 6 ter · les six Pokémon reposent sur la même ligne ──────────────

/*  « Il faudrait aligner les pokémons », 30 octobre. Le harnais sert
    exprès deux proportions de sprite : sans ça, `object-position`
    n'aurait rien à corriger et le contrôle passerait tout seul. */
const alignement = await p.evaluate(() => {
  const imgs = [...document.querySelectorAll("#remplie .wm-tcard__pkmn img")];
  if (imgs.length < 2) return null;
  const bas = imgs.map((e) => {
    //  LE BAS DU DESSIN, pas celui de la boîte : `object-fit` laisse
    //  la boîte pleine et ne bouge que le contenu. On recalcule donc
    //  où le dessin tombe, à partir de ses proportions.
    const r = e.getBoundingClientRect();
    const ratio = e.naturalWidth / e.naturalHeight;
    //  `scale-down` ET PAS `contain` DEPUIS LE 30 OCTOBRE AU SOIR, et
    //  la formule devait suivre. `contain` remplit toujours la boîte
    //  dans un sens ; `scale-down` prend le PLUS PETIT entre la taille
    //  naturelle et ce que `contain` donnerait. Calculée à l'ancienne,
    //  la hauteur rendue d'un petit sprite était surestimée, et ce
    //  contrôle aurait déclaré alignés des sprites qui ne le sont pas.
    const commeContain = Math.min(r.height, r.width / ratio);
    const hauteurRendue = getComputedStyle(e).objectFit === "scale-down"
      ? Math.min(commeContain, e.naturalHeight)
      : commeContain;
    const marge = r.height - hauteurRendue;
    //  `object-position: bottom` se CALCULE en « 50% 100% » : le mot
    //  « bottom » n'est plus dans la valeur résolue, et chercher le
    //  mot faisait tomber la mesure sur le cas centré. On lit donc le
    //  pourcentage vertical, qui est la seconde valeur.
    const vertical = parseFloat(
      getComputedStyle(e).objectPosition.split(/\s+/)[1] ?? "50",
    );
    return Math.round(r.top + marge * (vertical / 100) + hauteurRendue);
  });
  return {
    formes: new Set(imgs.map((e) => e.naturalWidth / e.naturalHeight)).size,
    ecart: Math.max(...bas) - Math.min(...bas),
  };
});

dire(
  "les Pokémon de proportions différentes reposent sur la même ligne",
  alignement !== null && alignement.formes >= 2 && alignement.ecart <= 1,
  JSON.stringify(alignement),
);

// ── 7 · l'infobulle d'un Pokémon ────────────────────────────────────

//  « Ce qui serait pas mal, ce serait de créer l'infobulle quand on
//  passe la souris sur le pokémon », 30 octobre. Planche 39.
await p.setContent(page(dansUnMessage(carteDuCompteDeTest())), {
  waitUntil: "load",
});

/*  LA SOURIS D'ABORD RANGÉE. Playwright la laisse où elle a cliqué,
    et un `:hover` qui traîne a déjà fait passer un contrôle pour la
    mauvaise raison le 30 octobre. On la met hors de la carte avant
    de mesurer l'état de repos. */
await p.mouse.move(0, 0);

const auRepos = await p.evaluate(() => {
  const bulles = [...document.querySelectorAll("#test .wm-infobulle")];
  if (bulles.length === 0) return null;
  return {
    combien: bulles.length,
    toutesCachees: bulles.every((b) => {
      const st = getComputedStyle(b);
      return st.visibility === "hidden" && st.opacity === "0";
    }),
    //  ET AUCUNE NE PREND LE SURVOL. Sans ça, la bulle qui s'ouvre
    //  passe sous la souris, la case perd le survol, la bulle se
    //  ferme, la case le regagne — un clignotement sans fin.
    transparentesAuPointeur: bulles.every((b) => getComputedStyle(b).pointerEvents === "none"),
  };
});

dire(
  "au repos, les six infobulles sont fermées et ne prennent pas le survol",
  auRepos !== null && auRepos.combien === 6 && auRepos.toutesCachees &&
    auRepos.transparentesAuPointeur,
  JSON.stringify(auRepos),
);

// ── elle s'ouvre au survol, et elle ne sort pas de la carte ─────────

await p.hover("#test .wm-tcard__pkmn:nth-child(3)");

const auSurvol = await p.evaluate(() => {
  const cases = [...document.querySelectorAll("#test .wm-tcard__pkmn")];
  const carte = document.querySelector("#test");
  const ouvertes = cases.filter((c) => {
    const b = c.querySelector(".wm-infobulle");
    return b !== null && getComputedStyle(b).visibility === "visible";
  });
  if (ouvertes.length !== 1) return { ouvertes: ouvertes.length };
  const b = ouvertes[0].querySelector(".wm-infobulle");
  const rb = b.getBoundingClientRect(), rc = carte.getBoundingClientRect();
  return {
    ouvertes: 1,
    //  LA TROISIÈME, et pas une autre.
    laBonne: cases.indexOf(ouvertes[0]) === 2,
    //  Elle sort de la carte par le HAUT — c'est voulu, la carte n'a
    //  plus d'`overflow: hidden` pour ça — mais jamais par les côtés.
    debordeGauche: Math.round(rc.left - rb.left),
    debordeDroite: Math.round(rb.right - rc.right),
    //  Et elle est au-dessus de sa case, pas dessous.
    auDessus: Math.round(rb.bottom) <= Math.round(ouvertes[0].getBoundingClientRect().top),
  };
});

dire(
  "au survol, une seule s'ouvre, au-dessus de sa case et dans la carte",
  auSurvol.ouvertes === 1 && auSurvol.laBonne && auSurvol.auDessus &&
    auSurvol.debordeGauche <= 0 && auSurvol.debordeDroite <= 0,
  JSON.stringify(auSurvol),
);

// ── et au clavier, ce qui la rend aussi utilisable au doigt ─────────

//  « Le survol n'existe pas au doigt : l'infobulle s'ouvre et se
//  referme au clic », planche 39. `:focus-within` sur une case
//  focalisable fait les deux — le doigt ET le clavier.
await p.mouse.move(0, 0);
const focalisables = await p.evaluate(() =>
  [...document.querySelectorAll("#test .wm-tcard__pkmn")]
    .filter((c) => c.getAttribute("tabindex") === "0").length
);

const lire = () =>
  p.evaluate(() =>
    getComputedStyle(
      document.querySelector("#test .wm-tcard__pkmn:nth-child(1) .wm-infobulle"),
    ).visibility
  );

await p.focus("#test .wm-tcard__pkmn:nth-child(1)");
const ouverteAuFocus = await lire() === "visible";

/*  ON ATTEND AVANT DE RELIRE. La fermeture porte
    `transition: visibility 0s linear 120ms` — le retard est ce qui
    laisse la bulle disparaître en fondu au lieu de sauter. Lu tout de
    suite après le `blur`, `visibility` vaut encore « visible », et le
    premier jet de ce contrôle accusait la règle au lieu de son propre
    empressement. */
await p.evaluate(() => document.querySelector("#test .wm-tcard__pkmn").blur());
await p.waitForFunction(
  () =>
    getComputedStyle(
      document.querySelector("#test .wm-tcard__pkmn:nth-child(1) .wm-infobulle"),
    ).visibility === "hidden",
  null,
  { timeout: 1000 },
).catch(() => {});
const refermeeApres = await lire() === "hidden";

const auClavier = { focalisables, ouverteAuFocus, refermeeApres };

dire(
  "elle s'ouvre au clavier et se referme en partant",
  auClavier.focalisables === 6 && auClavier.ouverteAuFocus &&
    auClavier.refermeeApres,
  JSON.stringify(auClavier),
);

// ── le fond dit tout, mais jamais tout seul ─────────────────────────

const purEtObscur = await p.evaluate(() => {
  const bulles = [...document.querySelectorAll("#test .wm-infobulle")];
  const obscurs = bulles.filter((b) => b.classList.contains("wm-infobulle--obscur"));
  const purs = bulles.filter((b) => !b.classList.contains("wm-infobulle--obscur"));
  const fond = (b) => getComputedStyle(b).backgroundColor;
  const echelle = (b) => b.querySelector(".wm-infobulle__echelle")?.textContent.trim();
  return {
    obscurs: obscurs.length,
    purs: purs.length,
    //  Deux fonds différents — c'est la note de la planche.
    fondsDifferents: new Set(bulles.map(fond)).size === 2,
    //  MAIS LA COULEUR NE PORTE PAS SEULE. Le libellé des étoiles dit
    //  laquelle des deux échelles on lit : « c'est le même rang, pas
    //  la même chose ».
    echellesDifferentes: obscurs.every((b) => echelle(b) === "Purification") &&
      purs.every((b) => echelle(b) === "Bonheur"),
  };
});

dire(
  "un obscur a son fond ET son échelle à lui, la couleur ne porte pas seule",
  purEtObscur.obscurs === 1 && purEtObscur.purs === 5 &&
    purEtObscur.fondsDifferents && purEtObscur.echellesDifferentes,
  JSON.stringify(purEtObscur),
);

// ── les deux types d'un double sont écrits ──────────────────────────

const types = await p.evaluate(() => {
  const bulles = [...document.querySelectorAll("#test .wm-infobulle")];
  const comptes = bulles.map((b) => b.querySelectorAll(".wm-infobulle__type").length);
  return {
    comptes,
    //  Le jeu de test doit contenir au moins un double type, sinon
    //  ce contrôle ne mesure rien.
    unDoubleAuMoins: comptes.some((n) => n === 2),
    tousNommes: bulles.every((b) =>
      [...b.querySelectorAll(".wm-infobulle__type")]
        .every((t) => t.textContent.trim().length > 2)
    ),
    //  La case, elle, n'en porte qu'un : elle fait moins de cent
    //  pixels et deux pastilles y passeraient à la ligne.
    surLaCase: [...document.querySelectorAll("#test .wm-tcard__pkmn .wm-type")].length,
  };
});

// ── le glyphe de type vient de PokéAPI, et le nom reste écrit ───────

const glyphes = await p.evaluate(() => {
  const pastilles = [...document.querySelectorAll("#test .wm-infobulle__type")];
  if (pastilles.length === 0) return null;
  const avant = (e) => getComputedStyle(e, "::before").backgroundImage;
  return {
    combien: pastilles.length,
    //  `content` ET PAS SEULEMENT `background-image`. Sans `content`,
    //  le pseudo-élément n'existe pas et l'image ne se dessine nulle
    //  part — mais `getComputedStyle` rend quand même la valeur
    //  déclarée, si bien que le premier jet passait avec un glyphe
    //  invisible. C'est `content: none` qui le dit.
    toutesOntLeurGlyphe: pastilles.every((e) =>
      e.hasAttribute("data-wm-type") &&
      avant(e).startsWith("url(") &&
      getComputedStyle(e, "::before").content !== "none"
    ),
    //  DES GLYPHES DIFFÉRENTS pour des types différents.
    distincts: new Set(pastilles.map(avant)).size,
    typesDistincts: new Set(
      pastilles.map((e) => e.getAttribute("data-wm-type")),
    ).size,
    //  LE DESSIN VIENT EN PLUS DU NOM, JAMAIS À LA PLACE. C'est la
    //  règle des pastilles de type depuis le début, et un glyphe n'y
    //  change rien — d'autant que celui de PokéAPI, pris entier,
    //  aurait écrit « WATER » en anglais.
    tousNommes: pastilles.every((e) => e.textContent.trim().length > 2),
    //  Et aucune requête réseau : tout est en `data:`.
    toutesEnData: pastilles.every((e) => avant(e).includes("data:image")),
  };
});

dire(
  "chaque type porte son glyphe de PokéAPI, en plus de son nom et sans requête",
  glyphes !== null && glyphes.toutesOntLeurGlyphe && glyphes.tousNommes &&
    glyphes.toutesEnData && glyphes.distincts === glyphes.typesDistincts,
  JSON.stringify(glyphes),
);

const casesDuTest = await p.evaluate(() => {
  const cases = [...document.querySelectorAll("#test .wm-tcard__pkmn")];
  const obscurs = cases.filter((c) => c.classList.contains("wm-tcard__pkmn--obscur"));
  const r = (e) => e.getBoundingClientRect();
  const fond = (e) => getComputedStyle(e).backgroundColor;
  return {
    //  LE GLYPHE EST SUR LA CASE AUSSI, pas seulement dans la bulle.
    pastillesAvecGlyphe: cases.filter((c) => {
      const p = c.querySelector(".wm-type[data-wm-type]");
      return p !== null &&
        getComputedStyle(p, "::before").backgroundImage.startsWith("url(");
    }).length,
    //  UN OBSCUR SE VOIT SANS SURVOLER : fond différent ET un liseré,
    //  parce que la couleur ne porte jamais seule.
    obscurs: obscurs.length,
    fondDifferent: obscurs.length > 0 &&
      fond(obscurs[0]) !== fond(cases.find((c) => !obscurs.includes(c))),
    liseré: obscurs.length > 0 &&
      getComputedStyle(obscurs[0]).boxShadow.includes("inset"),
    //  ET LES SPRITES NE SONT PLUS AGRANDIS. « Pourquoi certains comme
    //  Couaneton sont plus gros ? » — `scale-down` ne grossit jamais.
    jamaisAgrandi: cases.every((c) => {
      const img = c.querySelector("img");
      if (img === null) return true;
      const b = r(img);
      return getComputedStyle(img).objectFit === "scale-down" &&
        b.width >= img.naturalWidth - 1;
    }),
  };
});

dire(
  "la case porte son glyphe de type, et un obscur se voit sans survoler",
  casesDuTest.pastillesAvecGlyphe === 6 && casesDuTest.obscurs === 1 &&
    casesDuTest.fondDifferent && casesDuTest.liseré &&
    casesDuTest.jamaisAgrandi,
  JSON.stringify(casesDuTest),
);

// ── l'infobulle se pose au-dessus de SA case ────────────────────────

/*  « Bien afficher l'infobulle au-dessus du pokémon. » Elle était
    centrée sur la liste : jamais dehors, jamais au-dessus de la bonne
    case non plus. On survole la troisième et on regarde si elle la
    recouvre. */
await p.hover("#test .wm-tcard__pkmn:nth-child(3)");

const auDessusDeLaCase = await p.evaluate(() => {
  const cases = [...document.querySelectorAll("#test .wm-tcard__pkmn")];
  const carte = document.querySelector("#test");
  const r = (e) => e.getBoundingClientRect();
  const bulle = r(cases[2].querySelector(".wm-infobulle"));
  const sien = r(cases[2]);
  return {
    //  LES CENTRES SE RÉPONDENT, à quelques pixels près.
    ecartDesCentres: Math.round(
      Math.abs((bulle.left + bulle.right) / 2 - (sien.left + sien.right) / 2),
    ),
    //  ET ELLE RESTE DANS LA CARTE.
    debordeGauche: Math.round(r(carte).left - bulle.left),
    debordeDroite: Math.round(bulle.right - r(carte).right),
  };
});

dire(
  "l'infobulle se pose au-dessus de la case survolée, sans sortir",
  auDessusDeLaCase.ecartDesCentres <= 4 &&
    auDessusDeLaCase.debordeGauche <= 0 &&
    auDessusDeLaCase.debordeDroite <= 0,
  JSON.stringify(auDessusDeLaCase),
);

// ── et celles des bords glissent au lieu de sortir ──────────────────

for (const rang of [1, 6]) {
  await p.hover(`#test .wm-tcard__pkmn:nth-child(${rang})`);
  const bord = await p.evaluate((n) => {
    const c = document.querySelector(`#test .wm-tcard__pkmn:nth-child(${n})`);
    const carte = document.querySelector("#test");
    const b = c.querySelector(".wm-infobulle").getBoundingClientRect();
    const rc = carte.getBoundingClientRect();
    return {
      debordeGauche: Math.round(rc.left - b.left),
      debordeDroite: Math.round(b.right - rc.right),
    };
  }, rang);
  dire(
    `la bulle de la case ${rang} glisse le long du bord au lieu d'en sortir`,
    bord.debordeGauche <= 0 && bord.debordeDroite <= 0,
    JSON.stringify(bord),
  );
}

await p.mouse.move(0, 0);

// ── chaque badge dit son nom, son état, et sa date ──────────────────

const bullesDeBadge = await p.evaluate(() => {
  const tous = [...document.querySelectorAll("#test .wm-tcard__badge")];
  const bulles = tous.map((b) => b.querySelector(".wm-tcard__bulle"));
  const obtenus = tous.filter((b) => !b.classList.contains("wm-tcard__badge--agagner"));
  return {
    combien: tous.length,
    toutesPresentes: bulles.every((b) => b !== null),
    toutesFermees: bulles.every((b) =>
      b !== null && getComputedStyle(b).visibility === "hidden"
    ),
    //  LE NOM Y EST ÉCRIT, pas seulement en `title`.
    nomsEcrits: bulles.every((b) =>
      b !== null &&
      /Arène|Colosseum/.test(b.querySelector(".wm-tcard__bulle-nom")?.textContent ?? "")
    ),
    //  ET L'ÉTAT N'EST PLUS MONTRÉ. « Je veux pas date d'obtention et
    //  le nom du badge, c'est tout », 31 octobre. Il reste dans le
    //  balisage pour qui écoute la page — le cadre en pointillé le
    //  dit déjà à l'œil.
    etatCache: tous.every((b) => {
      const e = b.querySelector(".wm-tcard__bulle-etat");
      return e === null || getComputedStyle(e).display === "none";
    }),
    //  AUCUN CONTOUR BLEU, ET ON LE MESURE SUR UN BADGE QUI A LE
    //  FOCUS. Le premier jet lisait `outlineStyle` sur des badges au
    //  repos : aucun n'en a, donc il passait même sans la règle.
    sansContour: (() => {
      tous[0].focus();
      const st = getComputedStyle(tous[0]).outlineColor;
      const m = (st.match(/\d+/g) || []).map(Number);
      tous[0].blur();
      //  Pas de bleu de navigateur : soit aucun contour, soit le
      //  nôtre, qui n'est jamais plus bleu que rouge+vert.
      return m.length < 3 || !(m[2] > m[0] + 40 && m[2] > m[1] + 40);
    })(),
    //  ET L'ÉTAT, EN TOUTES LETTRES.
    etats: new Set(
      bulles.map((b) => b?.querySelector(".wm-tcard__bulle-etat")?.textContent.trim()),
    ).size,
    //  LA DATE N'EST QUE SUR CEUX QUI SONT OBTENUS.
    datesSurObtenus: obtenus.every((b) => b.querySelector(".wm-tcard__bulle-date") !== null),
    datesAilleurs: tous.filter((b) =>
      b.classList.contains("wm-tcard__badge--agagner") &&
      b.querySelector(".wm-tcard__bulle-date") !== null
    ).length,
    //  ET UNE BULLE OUVERTE N'EST PAS GRISÉE AVEC SON BADGE : le
    //  `filter` d'un parent ne se défait pas sur un enfant, c'est
    //  pour ça que le grisage est passé en fond mélangé.
    bullesLisibles: tous.every((b) =>
      getComputedStyle(b).filter === "none" &&
      Number(getComputedStyle(b).opacity) === 1
    ),
  };
});

dire(
  "chaque badge dit son nom, et RIEN D'AUTRE à l'œil",
  bullesDeBadge.combien === 11 && bullesDeBadge.toutesPresentes &&
    bullesDeBadge.toutesFermees && bullesDeBadge.nomsEcrits &&
    bullesDeBadge.etatCache && bullesDeBadge.sansContour &&
    bullesDeBadge.bullesLisibles,
  JSON.stringify(bullesDeBadge),
);

dire(
  "l'infobulle écrit les deux types d'un double, la case n'en montre qu'un",
  types.unDoubleAuMoins && types.tousNommes && types.surLaCase === 6,
  JSON.stringify(types),
);

// ── et elle tient aussi dans une colonne étroite ────────────────────

await p.setContent(
  page(dansUnMessage(`<div style="width:320px">${carteDuCompteDeTest()}</div>`)),
  { waitUntil: "load" },
);
await p.hover("#test .wm-tcard__pkmn:nth-child(2)");

const bulleEtroite = await p.evaluate(() => {
  const carte = document.querySelector("#test");
  const b = carte.querySelector(".wm-tcard__pkmn:nth-child(2) .wm-infobulle");
  const rb = b.getBoundingClientRect(), rc = carte.getBoundingClientRect();
  return {
    largeur: Math.round(rb.width),
    debordeGauche: Math.round(rc.left - rb.left),
    debordeDroite: Math.round(rb.right - rc.right),
    barre: document.documentElement.scrollWidth - document.documentElement.clientWidth,
  };
});

dire(
  "dans 320 px l'infobulle reste dans la carte",
  bulleEtroite.debordeGauche <= 0 && bulleEtroite.debordeDroite <= 0 &&
    bulleEtroite.barre <= 0,
  JSON.stringify(bulleEtroite),
);

await p.setContent(
  page(dansUnMessage(carteACoprier() + carteRemplie())),
  { waitUntil: "load" },
);
await p.mouse.move(0, 0);

// ── 7 · dans une colonne étroite ────────────────────────────────────

/*  La carte est aussi collable dans une signature, un message privé
    ou une annexe — des colonnes étroites sur un écran large.

    PREMIER JET : on rétrécissait la fenêtre à 420 px. C'était faux
    deux fois. D'abord parce que la colonne de profil garde ses 236 px
    dans ce décor, ce qui ne laissait au corps que 112 px — un cas qui
    n'existe pas, puisqu'un téléphone reçoit les gabarits mobiles de
    Forumactif, qui sont d'autres fichiers et auxquels on ne touche
    pas. Ensuite parce qu'une requête de média regarde la FENÊTRE : un
    essai qui la rétrécit ne dit rien d'une signature de 320 px au
    milieu d'un écran de 1440, qui est le vrai cas.

    On mesure donc ce vrai cas : la même carte dans un conteneur de
    320 px, fenêtre inchangée. C'est `flex-wrap` qui doit la tenir,
    pas un palier. */
await p.setContent(
  page(
    dansUnMessage(
      `<div id="etroit" style="width:320px">${carteRemplie()}</div>`,
    ),
  ),
  { waitUntil: "load" },
);

const etroit = await p.evaluate(() => {
  const carte = document.querySelector("#etroit .wm-tcard");
  const r = (e) => e.getBoundingClientRect();
  const compteurs = carte.querySelector(".wm-tcard__compteurs");
  const identite = carte.querySelector(".wm-dresseur__identite");
  return {
    largeur: Math.round(r(carte).width),
    deborde: Math.round(
      Math.max(
        0,
        ...[...carte.querySelectorAll("*")].map((e) => r(e).right - r(carte).right),
      ),
    ),
    barre: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    //  Les compteurs ont pris leur ligne sous le nom au lieu de se
    //  tasser contre lui — c'est ce que `flex-wrap` doit produire.
    compteursDessous: Math.round(r(compteurs).top) > Math.round(r(identite).bottom),
    //  Et l'équipe est passée sur plusieurs rangées, pas écrasée.
    rangeesEquipe: new Set(
      [...carte.querySelectorAll(".wm-tcard__pkmn")].map((e) => Math.round(r(e).top)),
    ).size,
  };
});

dire(
  "dans une colonne de 320 px elle se replie au lieu de déborder",
  etroit.largeur === 320 && etroit.deborde <= 1 && etroit.barre <= 0 &&
    etroit.compteursDessous && etroit.rangeesEquipe >= 2,
  JSON.stringify(etroit),
);

// ── 8 · le code dégraissé dit la même chose ─────────────────────────

/*  « Donne-moi le code sans commentaire et minimisé », 30 octobre.
    `outils/minifier-le-code.py` produit les `.min.html` à côté des
    fichiers lisibles. Un dégraissage qui change le rendu ne se voit
    pas en relisant une ligne de 7 000 caractères : c'est le
    navigateur qui doit le dire.

    On monte donc les deux versions et on compare ce qui compte — la
    suite des balises, la suite des classes, et le texte. Les blancs
    entre balises ne sont pas comparés : les retirer est précisément
    ce que l'outil fait. */
for (const nom of ["a-coller", "compte-de-test"]) {
  const lisible = readFileSync(R + `templates/carte-dresseur.${nom}.html`, "utf8");
  const serre = readFileSync(R + `templates/carte-dresseur.${nom}.min.html`, "utf8");

  const pareil = await p.evaluate(([a, b]) => {
    const lire = (html) => {
      const d = document.createElement("div");
      d.innerHTML = html;
      const els = [...d.querySelectorAll("*")];
      return {
        balises: els.map((e) => e.tagName).join(","),
        classes: els.map((e) => e.className).join("|"),
        //  Le texte, blancs de bordure retirés : « Place libre » doit
        //  rester « Place libre », pas devenir « Placelibre ».
        texte: (d.textContent ?? "").split(/\s+/).filter(Boolean).join(" "),
        attributs: els.map((e) =>
          [...e.attributes].map((at) => `${at.name}=${at.value}`).sort().join(";")
        ).join("|"),
      };
    };
    const x = lire(a), y = lire(b);
    return {
      memesBalises: x.balises === y.balises,
      memesClasses: x.classes === y.classes,
      memeTexte: x.texte === y.texte,
      memesAttributs: x.attributs === y.attributs,
      elements: x.balises.split(",").length,
    };
  }, [lisible, serre]);

  dire(
    `le code dégraissé dit la même chose que le lisible (${nom})`,
    pareil.memesBalises && pareil.memesClasses && pareil.memeTexte &&
      pareil.memesAttributs && pareil.elements > 20,
    JSON.stringify(pareil),
  );
}

// ── l'aperçu ────────────────────────────────────────────────────────

if (Deno.args.includes("--apercu")) {
  const NOTE = `<div class="wm-apercu-note">
<strong>La carte dresseur.</strong> En haut celle du compte de test, tirée
au sort dans les vraies tables de rencontre — <em>passe la souris sur un
Pokémon</em>, ou tabule jusqu'à lui. L'un des six est obscur : fond violet,
étoiles de purification. En dessous, à gauche la carte telle qu'un joueur la
colle, à droite telle que <code>mod-tcard</code> la laissera. Les sprites
sont des pixels gris : ce qui est jugé ici est la mise en page.
</div>
<style>.wm-apercu-note{max-width:1200px;margin:0 auto 18px;padding:14px 18px;
border:1px solid var(--wm-bord-fin,#eadacd);border-radius:10px;
background:var(--wm-fond-surface,#fffbf7);color:var(--wm-texte-doux,#6e5749);
font:400 13px/1.5 "Nunito Sans",system-ui,sans-serif}
.wm-apercu-note strong{color:var(--wm-texte-corps,#4e3b30)}</style>`;

  const html = page(
    NOTE +
      dansUnMessage(carteDuCompteDeTest()) +
      dansUnMessage(carteACoprier() + carteRemplie()),
  );
  writeFileSync(R + "apercu-tcard.html", html);
  console.log(`\n  apercu-tcard.html — ${html.length} octets`);
}

await p.close();
await nav.close();

if (soucis.length > 0) console.log("\n-- ce qui reste --\n" + soucis.join("\n"));
console.log(soucis.length === 0 ? "\nTOUT PASSE." : `\n${soucis.length} DÉFAUT(S).`);
if (soucis.length > 0) Deno.exit(1);
