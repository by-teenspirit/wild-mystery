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

/*  ── LA CARTE VIENT DU FICHIER, PAS D'ICI ─────────────────────────

    `templates/carte-dresseur.a-coller.html` est ce que les joueurs
    copieront. Si le harnais en gardait sa propre copie, il mesurerait
    une carte que personne ne colle — et les deux dériveraient au
    premier ajustement. On lit donc le fichier et on en extrait le
    bloc entre les deux marqueurs, qui est exactement ce qui part. */
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
    .map(([nom, niv, cle, type]) =>
      `<li class="wm-tcard__pkmn">
        <img class="wm-tcard__sprite" src="${PIXEL}" alt="" />
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

  //  TROIS OBTENUS SUR SEPT, comme la maquette montre trois sur huit :
  //  c'est le mélange qui compte, pas le nombre.
  const BADGES = [
    ["arene-station-service", "Station Service", true],
    ["arene-samaragd", "Samaragd", true],
    ["arene-port-amaree", "Port-Amarée", true],
    ["arene-suerebe", "Suerebe", false],
    ["arene-pyrite", "Pyrite", false],
    ["arene-tour-titanite", "Tour Titanite", false],
    ["arene-ile-tenebra", "Île Ténèbra", false],
  ];
  const badges = BADGES
    .map(([cle, nom, obtenu]) =>
      `<li class="wm-tcard__badge${obtenu ? "" : " wm-tcard__badge--agagner"}"
          data-wm-badge="${cle}" title="${nom}"><img src="${PIXEL}" alt="" /></li>`
    )
    .join("");

  return `<div class="wm-tcard" data-wm-tcard id="remplie">
  <div class="wm-dresseur">
    <img class="wm-dresseur__avatar" src="${PIXEL}" alt="" />
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
        <span class="wm-tcard__chiffre" data-wm-tcard-compte>3 / 7</span>
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
      <ul class="wm-tcard__badges" data-wm-tcard-badges>${badges}</ul>
    </section>
  </div>
</div>`;
}

/*  LA FEUILLE DE MODERNBB, RÉDUITE À CE QUI PIÈGE — la même qu'en
    `sujet.mjs`, et pour la même raison : une carte mesurée hors de
    `.postbody` serait mesurée dans 1328 px au lieu de 714, et toutes
    les rangées tiendraient. */
const BASE_MODERNBB = `
*, *::before, *::after { box-sizing: border-box; }
.postbody { margin-right: 211px; padding: 12px 18px 18px; }
.post { display: flex; flex-wrap: wrap; }
#wrap { max-width: 1400px; margin: 0 auto; padding: 36px; }`;

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

const badges = await p.evaluate(() => {
  const tous = [...document.querySelectorAll("#remplie .wm-tcard__badge")];
  if (tous.length === 0) return null;
  const r = (e) => e.getBoundingClientRect();
  const agagner = tous.filter((e) => e.classList.contains("wm-tcard__badge--agagner"));
  const obtenu = tous.filter((e) => !e.classList.contains("wm-tcard__badge--agagner"));
  return {
    combien: tous.length,
    rangees: new Set(tous.map((e) => Math.round(r(e).top))).size,
    //  UN BADGE À GAGNER SE RECONNAÎT À SON CADRE, pas à sa teinte :
    //  deux crèmes voisines ne se distinguent pas, et c'est la règle
    //  qui tient déjà les trois états du Pokédex.
    cadreDifferent: agagner.every((e) => getComputedStyle(e).borderLeftStyle === "dashed") &&
      obtenu.every((e) => getComputedStyle(e).borderLeftStyle === "solid"),
    //  Ronds, pas carrés.
    ronds: tous.every((e) => parseFloat(getComputedStyle(e).borderRadius) >= r(e).width / 2),
  };
});

dire(
  "sept badges sur une rangée, les manquants reconnaissables à leur cadre",
  badges !== null && badges.combien === 7 && badges.rangees === 1 &&
    badges.cadreDifferent && badges.ronds,
  JSON.stringify(badges),
);

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

// ── l'aperçu ────────────────────────────────────────────────────────

if (Deno.args.includes("--apercu")) {
  const NOTE = `<div class="wm-apercu-note">
<strong>La carte dresseur.</strong> À gauche telle qu'un joueur la colle —
valeurs d'attente, six places libres, sept badges à gagner. À droite telle
que <code>mod-tcard</code> la laissera. Les images sont des pixels gris :
ce qui est jugé ici est la mise en page, pas les dessins.
</div>
<style>.wm-apercu-note{max-width:1200px;margin:0 auto 18px;padding:14px 18px;
border:1px solid var(--wm-bord-fin,#eadacd);border-radius:10px;
background:var(--wm-fond-surface,#fffbf7);color:var(--wm-texte-doux,#6e5749);
font:400 13px/1.5 "Nunito Sans",system-ui,sans-serif}
.wm-apercu-note strong{color:var(--wm-texte-corps,#4e3b30)}</style>`;

  const html = page(NOTE + dansUnMessage(carteACoprier() + carteRemplie()));
  writeFileSync(R + "apercu-tcard.html", html);
  console.log(`\n  apercu-tcard.html — ${html.length} octets`);
}

await p.close();
await nav.close();

if (soucis.length > 0) console.log("\n-- ce qui reste --\n" + soucis.join("\n"));
console.log(soucis.length === 0 ? "\nTOUT PASSE." : `\n${soucis.length} DÉFAUT(S).`);
if (soucis.length > 0) Deno.exit(1);
