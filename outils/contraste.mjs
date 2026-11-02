// ════════════════════════════════════════════════════════════════════
//  outils/contraste.mjs — mesurer une page collée, dans les deux thèmes
//
//  USAGE :  deno task contraste pages/annexe-03-le-reglement.html
//
//  POURQUOI UN HARNAIS ET PAS UN COUP D'ŒIL. « Ce texte me paraît pâle »
//  n'est pas une mesure, et un jeton de texte doux sur un pavé teinté
//  peut tomber à 4,49 contre 4,5 exigés — un cheveu qu'aucun œil ne voit
//  et qu'un lecteur mal-voyant paie. Ce fichier monte la page avec les
//  jetons et la feuille assemblée, pose le VRAI sommaire par le module,
//  et mesure chaque texte sur son fond réel.
//
//  Il sort en code 1 s'il trouve un défaut : utilisable tel quel dans
//  une chaîne. Il demande Playwright et un Chromium ; sans eux il le dit
//  et s'arrête — il ne prétend pas avoir mesuré.
//
//  CE QU'IL NE REMPLACE PAS : le forum. Il mesure la page collée dans un
//  `#modernbb` monté ici, pas le DOM que ModernBB sert vraiment. Une
//  page vue en vrai reste la dernière vérification.
//
//  ── LES DEUX DÉFAUTS PAYÉS EN L'ÉCRIVANT ───────────────────────────
//
//  Ils valent d'être dits, parce qu'un harnais qui se trompe est pire
//  qu'un harnais absent : il fait corriger ce qui va bien.
//
//    · **Sans fond de page**, tout se mesure sur le blanc du navigateur,
//      et le thème sombre s'annonce illisible alors qu'il ne l'est pas.
//      Six faux défauts.
//    · **Chromium rend un `color-mix` en `color(srgb 0.24 0.47 0.32 /
//      .16)`**, pas en `rgba(…)`. Lire ces nombres comme des 0-255 donne
//      un fond presque noir, et trois faux défauts de plus.
//
//  Les deux fois, c'était le harnais qui avait tort. Les deux vrais
//  défauts qu'il a trouvés ensuite étaient à moi : un numéro de sommaire
//  à 0,68 d'opacité (3,66) et une étiquette en texte doux sur le pavé
//  vert (4,49).
// ════════════════════════════════════════════════════════════════════
//  `npm:playwright` plutôt qu'un `node_modules` : le dépôt est en Deno,
//  et un harnais ne mérite pas un gestionnaire de paquets de plus.
import { readFileSync } from "node:fs";
import { chromium } from "npm:playwright@1.49.1";

//  Le Chromium du bac à sable n'a pas toujours le numéro que Playwright
//  attend. On prend celui qui est là plutôt que d'en télécharger un.
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

//  La racine du dépôt : ce fichier est dans `outils/`.
const R = new URL("..", import.meta.url).pathname;
const cible = process.argv[2];
if (cible === undefined) {
  console.error("Usage : node outils/contraste.mjs pages/<une-page>.html");
  process.exit(2);
}
//  ── LA PAGE EST UN DOCUMENT ENTIER, ET ON LA SERT TELLE QUELLE ─────
//
//  Depuis le 1er novembre, une annexe est creee SANS l'en-tete du
//  forum : elle porte son propre `<!DOCTYPE>`, sa tete, sa barre, son
//  pied et son script. Ce harnais l'enveloppait dans un document a
//  lui — il mesurait donc une page qui n'existe plus.
//
//  Trois substitutions, et seulement trois :
//
//    · LES DEUX FEUILLES DISTANTES deviennent le contenu du disque.
//      Le conteneur n'atteint pas GitHub Pages, et surtout on veut
//      mesurer la feuille DU DEPOT, pas celle qui est deployee.
//    · LES IMAGES deviennent des `data:`. Une page montee par
//      `setContent` n'a pas d'origine : rien ne s'y charge. C'est
//      aussi la seule facon de connaitre la taille REELLE de la
//      photo, donc son agrandissement.
//    · LE SCRIPT S'EN VA. Le sommaire est pose plus bas par le
//      module lui-meme, depuis `data/annexes.json` du depot.
const enLocal = (f) => {
  const o = readFileSync(R + f);
  const type = f.endsWith(".jpg") ? "jpeg" : "png";
  return `data:image/${type};base64,${o.toString("base64")}`;
};

const doc = readFileSync(R + cible, "utf8")
  .replace(
    /<link rel="stylesheet" href="https:\/\/by-teenspirit\.github\.io\/wild-mystery\/([^"]+)"\s*\/?>/g,
    (tout, f) => {
      try {
        return `<style>${readFileSync(R + f, "utf8")}</style>`;
      } catch {
        return tout;
      }
    },
  )
  .replace(
    /url\('https:\/\/by-teenspirit\.github\.io\/wild-mystery\/([^']+)'\)/g,
    (tout, f) => {
      try {
        return `url('${enLocal(f)}')`;
      } catch {
        return tout;
      }
    },
  )
  .replace(
    /<script src="https:\/\/by-teenspirit\.github\.io\/wild-mystery\/[^"]+"><\/script>/g,
    "",
  );

const navigateur = await chromium.launch(
  CHROME === undefined ? {} : { executablePath: CHROME },
);
const p = await navigateur.newPage({ viewport: { width: 1280, height: 1400 } });
//  ── LA PAGE EST SERVIE A SON ADRESSE, PAS SUR `about:blank` ───────
//
//  `setContent` monte la page sans origine. Trois choses en
//  dependaient et tombaient en silence :
//
//    · `location.pathname` etait vide, donc le module ne savait pas
//      QUELLE annexe il habillait : aucune entree active, aucun bouton
//      « suivante » a recalculer ;
//    · `localStorage` jette sur une origine opaque, donc le bouton de
//      theme ne pouvait pas retenir un choix ;
//    · les adresses relatives de la barre ne menaient nulle part.
//
//  On intercepte tout le reseau et on sert ce document a l'adresse que
//  la page aura vraiment. Le numero `hN` est inconnu ici et ne compte
//  pas : Forumactif sert la page par son numero et le sommaire la
//  reconnait par son slug (releve le 2 novembre, `/h1-nimportequoi`
//  rend bien la premiere annexe).
const slugDeLaCible = /annexe-\d+-([a-z0-9-]+)\.html$/.exec(cible)?.[1] ?? "x";
const ADRESSE = `https://mysteryinrhode.forumactif.com/h1-${slugDeLaCible}`;
await p.route("**/*", (route) =>
  route.request().url() === ADRESSE
    ? route.fulfill({ contentType: "text/html; charset=utf-8", body: doc })
    : route.fulfill({ status: 204, body: "" }));
await p.goto(ADRESSE);

// Le sommaire, pose par le vrai module : on ne mesure pas un balisage
// qu'on aurait recopie a la main dans le harnais.
await p.addScriptTag({ path: R + "js/harnais-sommaire.js" });
//  LE BOUTON DE THEME EN PREMIER : il n'attend aucun fichier, et c'est
//  dans cet ordre qu'il arrive sur la vraie page.
await p.evaluate(() => globalThis.wmPoserLeTheme());
await p.evaluate(
  (d) => globalThis.wmPoserLeSommaire(d),
  JSON.parse(readFileSync(R + "data/annexes.json", "utf8")),
);

const mesurer = async (theme) => {
  await p.evaluate((t) => document.body.classList.toggle("wm-sombre", t === "sombre"), theme);
  return await p.evaluate(() => {
    const canal = (s) => {
      // rgb()/rgba() rend des 0-255 ; color(srgb ...) rend des 0-1.
      const n = s.match(/-?\d*\.?\d+(?:e-?\d+)?/g)?.map(Number) ?? [];
      if (n.length < 3) return null;
      const srgb = /^color\(/.test(s);
      const alpha = s.includes("/") ? (n[3] ?? 1) : (n.length > 3 ? n[3] : 1);
      return { rgb: srgb ? n.slice(0, 3).map((v) => v * 255) : n.slice(0, 3), alpha };
    };
    const lum = (c) => 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]);
    function f(v) {
      const s = v / 255;
      return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    }
    const sur = (dessus, dessous, a) => dessus.map((v, i) => v * a + dessous[i] * (1 - a));

    // Le fond REEL : on empile les fonds translucides au lieu de les
    // sauter, du plus profond au plus proche.
    const fond = (el) => {
      //  ── TOUS LES FONDS POSSIBLES, DU PLUS PROFOND AU PLUS PROCHE ──
      //
      //  On rend une LISTE, pas une couleur : un degre a plusieurs
      //  arrets, et un texte doit se lire sur chacun.
      //
      //  Trois regles, et la troisieme est celle qui manquait :
      //    · un fond OPAQUE efface tout ce qui est en dessous — un
      //      degrade d'ancetre ne compte plus des qu'une surface pleine
      //      le recouvre. Sans ca, une pastille blanche posee sur le
      //      degrade d'annexe se mesurait sur le degrade.
      //    · un fond TRANSLUCIDE se compose sur chaque candidat.
      //    · un DEGRADE multiplie les candidats : un par arret.
      const couches = [];
      for (let n = el; n && n !== document.documentElement; n = n.parentElement) {
        const st = getComputedStyle(n);
        const c = canal(st.backgroundColor);
        if (c && c.alpha > 0) couches.push({ type: "plat", c });
        const img = st.backgroundImage;
        //  ── UN FILET N'EST PAS UN FOND ────────────────────────────
        //
        //  Quatrieme regle, et elle a coute deux faux defauts le
        //  8 octobre. La bande de categorie peint ses deux traits
        //  verticaux avec des degrades de 1 x 18 en `no-repeat` : un
        //  separateur est une forme, et une forme dessinee en fond
        //  reste une forme. Le harnais les lisait comme la couleur du
        //  bloc entier et annoncait « creme sur creme » pour un titre
        //  qui est en creme sur brun nuit — mesure a 11,9 dans le
        //  navigateur.
        //
        //  On ecarte donc les COUCHES dont la taille est une lamelle
        //  et qui ne se repetent pas. Le critere est etroit a dessein :
        //  un fond qui couvre vraiment la surface n'a ni `no-repeat` ni
        //  une taille de quelques pixels, et un vrai defaut de
        //  contraste sur un aplat continue d'etre vu.
        const lamelles = st.backgroundSize.split(",").map((t) => t.trim());
        const repets = st.backgroundRepeat.split(",").map((t) => t.trim());
        const couvre = lamelles.some((taille, i) => {
          const mesures = taille.match(/-?\d+(\.\d+)?px/g);
          const mince = mesures !== null && mesures.some((m) => parseFloat(m) <= 4);
          return !(mince && (repets[i] ?? repets[0] ?? "").includes("no-repeat"));
        });
        if (img && img !== "none" && /gradient\(/.test(img) && couvre) {
          const bruts = img.match(/(rgba?\([^)]*\)|color\([^)]*\))/g) ?? [];
          const arrets = bruts.map(canal).filter((a) => a !== null && a.alpha > 0);
          if (arrets.length > 0) couches.push({ type: "degrade", arrets });
        }
      }

      let fonds = [[255, 255, 255]];
      for (const couche of couches.reverse()) {
        if (couche.type === "plat") {
          const { rgb, alpha } = couche.c;
          fonds = alpha >= 1 ? [rgb] : fonds.map((f) => sur(rgb, f, alpha));
          continue;
        }
        fonds = fonds.flatMap((f) => couche.arrets.map((a) => sur(a.rgb, f, a.alpha)));
      }
      return fonds;
    };

    const res = [];
    for (const el of document.querySelectorAll("#modernbb *")) {
      if (![...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim() !== "")) {
        continue;
      }
      const st = getComputedStyle(el);
      if (st.display === "none" || st.visibility === "hidden") continue;
      //  ── ET SES ANCETRES COMPTENT AUSSI ────────────────────────────
      //
      //  `display: none` ne s'herite pas, il EFFACE : un `<span>` bien
      //  visible dans un `<dd>` masque n'est dessine nulle part, et son
      //  contraste ne veut rien dire. Le harnais ne regardait que
      //  l'element lui-meme et criait au defaut sur le « Dernier
      //  message » de la bande de categorie, que la feuille masque
      //  depuis le 8 octobre.
      //
      //  `getClientRects()` tranche sans remonter la chaine a la main :
      //  pas de boite, pas de pixel, rien a mesurer.
      if (el.getClientRects().length === 0) continue;
      const t = canal(st.color);
      if (t === null) continue;
      let o = 1;
      for (let n = el; n && n !== document.documentElement; n = n.parentElement) {
        o *= Number(getComputedStyle(n).opacity);
      }
      if (o === 0) continue;
      //  `fond` rend plusieurs candidats quand le fond est un degrade :
      //  on garde LE PIRE. Un texte doit se lire sur toute la bande.
      let ratio = Infinity;
      for (const fo of fond(el)) {
        const texte = sur(t.rgb, fo, t.alpha * o);
        const a = lum(texte), b = lum(fo);
        ratio = Math.min(ratio, (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05));
      }
      const px = parseFloat(st.fontSize), gras = Number(st.fontWeight) >= 700;
      const seuil = (px >= 24 || (px >= 18.66 && gras)) ? 3 : 4.5;
      res.push({
        classe: el.className || el.tagName,
        px,
        ratio: Math.round(ratio * 100) / 100,
        seuil,
        ok: ratio >= seuil,
        mot: el.textContent.replace(/\s+/g, " ").trim().slice(0, 44),
      });
    }
    return res;
  });
};

let fautes = 0;
for (const theme of ["clair", "sombre"]) {
  const r = await mesurer(theme);
  const rates = r.filter((x) => !x.ok);
  fautes += rates.length;
  console.log(`${theme} : ${r.length} textes mesures, ${rates.length} defaut(s) de contraste`);
  for (const x of rates) {
    console.log(`   ${x.ratio} < ${x.seuil}  ${x.px}px  .${x.classe}  « ${x.mot} »`);
  }
}
console.log(
  "entrees de sommaire posees :",
  await p.evaluate(() => document.querySelectorAll(".wm-annexe__entree").length),
);
console.log(
  "dont sans lien (a venir) :",
  await p.evaluate(() => document.querySelectorAll(".wm-annexe__entree--a-venir").length),
);
console.log(
  "dont des liens :",
  await p.evaluate(() => document.querySelectorAll("a.wm-annexe__lien").length),
);
//  ── LE TEXTE NE TOUCHE JAMAIS LA PHOTO DE FOND ────────────────────
//
//  CE HARNAIS NE VOIT PAS LES IMAGES. Il mesure chaque texte sur sa
//  COULEUR de fond ; une photo posee derriere lui est invisible pour
//  le calcul, et un « zero defaut » ne dirait rien d'un paragraphe
//  ecrit sur la mer. La promesse tient donc par la geometrie : le
//  voile de `08-annexes.css` est opaque jusqu'au bord droit de la
//  colonne de lecture, et aucun texte ne depasse ce bord.
//
//  On le mesure au lieu de le croire, et seulement quand la page
//  porte vraiment une photo — une page sans `--annexe-fond` n'a rien
//  a prouver.
const voile = await p.evaluate(() => {
  const a = document.querySelector(".wm-annexe");
  const corps = document.querySelector(".wm-annexe__corps");
  if (a === null || corps === null) return null;
  if (getComputedStyle(a).getPropertyValue("--annexe-fond").trim() === "") {
    return { photo: false };
  }
  //  L'arret opaque du voile, lu dans la regle plutot que recopie :
  //  changer 824 dans la feuille doit changer la mesure, pas la casser.
  //  La couche « to right » est decoupee en comptant les parentheses :
  //  elle contient des `rgb(...)` et des `color-mix(...)`, donc une
  //  expression qui s'arrete a la premiere parenthese fermante lit le
  //  `0px` du premier arret au lieu du dernier.
  //  LE VOILE VIT SUR `::after` depuis que la photo est passee sur
  //  `::before` pour pouvoir etre floutee : un `filter` s'applique a
  //  l'element entier, et pose dans le fond du corps il aurait
  //  emporte le texte.
  const degrade = getComputedStyle(corps, "::after").backgroundImage;
  const depart = degrade.indexOf("linear-gradient(to right");
  let couche = null;
  if (depart !== -1) {
    let n = 0;
    for (let i = degrade.indexOf("(", depart); i < degrade.length; i++) {
      if (degrade[i] === "(") n++;
      else if (degrade[i] === ")" && --n === 0) {
        couche = degrade.slice(depart, i + 1);
        break;
      }
    }
  }
  //  LE PLUS PETIT ARRET EN PIXELS, pas le plus grand : c'est la fin
  //  de la partie OPAQUE du voile. Les arrets suivants decrivent le
  //  lavis, qui laisse passer la photo — un texte pose dessus serait
  //  sur la photo. Avec le maximum, le controle laissait passer
  //  trois cent soixante-seize pixels de fondu.
  const pixels = ((couche ?? "").match(/(\d+(?:\.\d+)?)px/g) ?? [])
    .map(parseFloat).filter((v) => v > 0);
  if (pixels.length === 0) return { photo: true, arret: null };
  const arret = Math.min(...pixels);
  const limite = corps.getBoundingClientRect().left + arret;
  let pire = null;
  for (const el of corps.querySelectorAll("*")) {
    if (el.children.length > 0) continue;
    const t = (el.textContent ?? "").trim();
    if (t === "") continue;
    const b = el.getBoundingClientRect();
    if (b.width === 0) continue;
    if (pire === null || b.right > pire.droite) {
      pire = { droite: Math.round(b.right), mot: t.slice(0, 32) };
    }
  }
  return {
    photo: true,
    arret,
    limite: Math.round(limite),
    pire,
    dedans: pire === null || pire.droite <= Math.round(limite),
    //  ET L'ARRET COLLE A LA COLONNE. Les deux nombres doivent bouger
    //  ensemble : un voile qui s'arrete loin derriere la colonne
    //  cache de la photo pour rien, et la bande de droite maigrit
    //  sans qu'on l'ait demande. Deux fois deja j'ai elargi l'un en
    //  oubliant l'autre.
    jeu: pire === null ? null : Math.round(limite) - pire.droite,
  };
});
if (voile === null || voile.photo === false) {
  console.log("photo de fond : aucune — rien a verifier de ce cote");
} else if (
  voile.arret === null || voile.dedans !== true ||
  voile.jeu === null || voile.jeu > 16
) {
  console.log(
    `TEXTE SUR LA PHOTO — defaut : ${JSON.stringify(voile)}`,
  );
  fautes++;
} else {
  console.log(
    `photo de fond : le voile tient jusqu'a ${voile.limite}, la colonne ` +
      `s'arrete a ${voile.pire.droite} — ${voile.jeu}px de jeu`,
  );
}

//  ── LE SOMMAIRE SE COLLE SOUS LA BARRE, PAS DERRIERE ──────────────
//
//  Les deux sont `sticky`. Un sommaire a `top: 0` se range au meme
//  endroit que la barre, qui porte un z-index de 70 : ses premieres
//  entrees passaient dessous. La barre est celle de la page depuis
//  que les annexes sont autonomes — avant, c'etait celle du forum,
//  et le decor devait la reproduire. On fait defiler pour de vrai et on
//  regarde ou il s'arrete.
//  UNE FENETRE PLUS HAUTE QUE LE SOMMAIRE, et plus basse que la page.
//  A 1400 la page tenait presque en entier et il n'y avait rien a
//  faire defiler ; a 620 le sommaire, haut de 855, ne tient pas dans
//  la fenetre et `sticky` le laisse partir — c'est le comportement
//  normal, pas un defaut. Entre les deux, il colle.
await p.setViewportSize({ width: 1280, height: 1000 });
await p.evaluate(() => globalThis.scrollTo(0, 400));
await p.waitForTimeout(250);
const sousLaBarre = await p.evaluate(() => {
  const s = document.querySelector(".wm-annexe__sommaire");
  const b = document.querySelector(".wm-retour");
  if (s === null || b === null) return null;
  return {
    defile: Math.round(globalThis.scrollY),
    sommaire: Math.round(s.getBoundingClientRect().top),
    //  LA BARRE RESTE, ELLE AUSSI. C'est le seul retour vers le forum
    //  sur une page sans en-tete : si elle part avec le defilement,
    //  il faut remonter une annexe entiere pour en sortir.
    hautDeLaBarre: Math.round(b.getBoundingClientRect().top),
    basDeLaBarre: Math.round(b.getBoundingClientRect().bottom),
  };
});
await p.evaluate(() => globalThis.scrollTo(0, 0));
await p.setViewportSize({ width: 1280, height: 1400 });
await p.waitForTimeout(150);
if (sousLaBarre !== null) {
  const bon = sousLaBarre.sommaire >= sousLaBarre.basDeLaBarre &&
    sousLaBarre.hautDeLaBarre === 0;
  console.log(
    `defile de ${sousLaBarre.defile} : barre a ${sousLaBarre.hautDeLaBarre}, ` +
      `sommaire a ${sousLaBarre.sommaire}, bas de la barre a ` +
      `${sousLaBarre.basDeLaBarre}` +
      (bon ? "" : " — DEFAUT, il passe dessous"),
  );
  if (!bon) fautes++;
}

//  ── UNE PHOTO TROP ETIREE DOIT ETRE FLOUTEE ───────────────────────
//
//  « Le fond est trop pixellise. » Les photos de zone sont des
//  bandeaux de 1280 x 300 ; etirees en `cover` sur une annexe, elles
//  montent a sept fois leur hauteur et les blocs de compression se
//  voient. On mesure l'agrandissement reel, et au-dela de deux fois on
//  exige un flou — pas un chiffre arbitraire : en dessous, un
//  agrandissement ne se voit pas, au-dessus il se voit toujours.
const etirement = await p.evaluate(async () => {
  const c = document.querySelector(".wm-annexe__corps");
  if (c === null) return null;
  const st = getComputedStyle(c, "::before");
  const adresse = st.backgroundImage.match(/url\("([^"]+)"\)/)?.[1];
  if (adresse === undefined) return { photo: false };
  const d = await new Promise((ok) => {
    const i = new Image();
    i.onload = () => ok([i.naturalWidth, i.naturalHeight]);
    i.onerror = () => ok(null);
    i.src = adresse;
  });
  if (d === null) return { photo: true, chargee: false };
  const b = c.getBoundingClientRect();
  //  `cover` : l'echelle est le plus grand des deux rapports.
  const echelle = Math.max(b.width / d[0], b.height / d[1]);
  return {
    photo: true,
    chargee: true,
    echelle: Math.round(echelle * 10) / 10,
    flou: /blur\(([\d.]+)px\)/.exec(st.filter)?.[1] ?? null,
  };
});
if (etirement !== null && etirement.photo && etirement.chargee) {
  const bon = etirement.echelle <= 2 || Number(etirement.flou) >= 4;
  console.log(
    `photo : agrandie ${etirement.echelle} fois, flou ${etirement.flou ?? "aucun"}` +
      (bon ? "" : " — DEFAUT, a cette echelle elle se pixellise"),
  );
  if (!bon) fautes++;
}

//  ── LE BOUTON DE THEME EST LA, ET IL BASCULE ──────────────────────
//
//  « Est-ce que tu peux effectivement rajouter le dark mode. » Sur le
//  forum il vit dans le coin d'outils ; une annexe n'a pas ce coin, et
//  le bouton est donc pose dans la barre par le script. On clique pour
//  de vrai : verifier qu'il existe ne dirait pas qu'il fait quelque
//  chose, et son mot doit changer avec lui — il annonce sa
//  destination, pas l'etat courant.
const theme = await p.evaluate(async () => {
  const b = document.querySelector(".wm-retour__theme");
  if (b === null) return null;
  //  ON REPART DE ZERO. Les mesures de contraste viennent de passer la
  //  page en sombre a la main : sans ce nettoyage on testerait le
  //  bouton depuis un etat que personne n'a jamais.
  try {
    localStorage.removeItem("wm.theme");
  } catch { /* origine opaque : le bouton ne retiendra rien, c'est tout */ }
  document.body.classList.remove("wm-sombre");
  b.textContent = "Sombre";
  const etat = () => ({
    sombre: document.body.classList.contains("wm-sombre"),
    mot: b.textContent.trim(),
  });
  const avant = etat();
  b.click();
  await new Promise((r) => requestAnimationFrame(r));
  const apres = etat();
  b.click();
  await new Promise((r) => requestAnimationFrame(r));
  return { avant, apres, revenu: etat() };
});
if (theme === null) {
  console.log("bouton de theme : ABSENT — defaut");
  fautes++;
} else {
  const bascule = theme.avant.sombre !== theme.apres.sombre &&
    theme.avant.mot !== theme.apres.mot &&
    theme.revenu.sombre === theme.avant.sombre;
  console.log(
    `bouton de theme : « ${theme.avant.mot} » → « ${theme.apres.mot} », ` +
      `sombre ${theme.avant.sombre} → ${theme.apres.sombre}` +
      (bascule ? "" : " — DEFAUT, il ne bascule pas"),
  );
  if (!bascule) fautes++;
}

//  ── LE BOUTON « SUIVANTE » MENE QUELQUE PART ──────────────────────
//
//  Ecrit a la construction, il pointait sur `#` tant que la page
//  d'apres n'existait pas : treize boutons morts sur quatorze. Il est
//  refait a l'affichage et saute les pages absentes.
const suivante = await p.evaluate(() => {
  const b = document.querySelector("a.wm-suivante__bouton");
  //  Retire quand aucune autre page n'existe : c'est le bon cas, pas
  //  un defaut. Un bouton qu'on ne peut pas suivre ment sur l'etat du
  //  forum.
  if (b === null) return { absent: true };
  return { absent: false, vers: b.getAttribute("href"), mot: b.textContent.trim() };
});
if (suivante.absent) {
  console.log("bouton suivante : retire, aucune autre page n'est en ligne");
} else {
  const vivant = suivante.vers !== null && suivante.vers !== "#" &&
    suivante.vers.startsWith("/");
  console.log(
    `bouton suivante : ${suivante.vers}` +
      (vivant ? "" : " — DEFAUT, il ne mene nulle part"),
  );
  if (!vivant) fautes++;
}

//  ── LE TEXTE COURANT PORTE LA POLICE DE LA CHARTE ─────────────────
//
//  « Il faut reimporter la typo. » Les polices etaient chargees, mais
//  rien ne les POSAIT : sur le forum, `body` recoit sa famille de
//  ModernBB, et une page autonome n'a que ce qu'on lui donne. Tout ce
//  qui ne declare pas la sienne tombait sur le Times du navigateur.
//  On compare la famille rendue au jeton, sur les blocs qui
//  N'ECRIVENT PAS la leur — ce sont eux qui tombent en premier.
const polices = await p.evaluate(() => {
  const attendu = getComputedStyle(document.documentElement)
    .getPropertyValue("--wm-police-corps").trim().split(",")[0].replace(/["']/g, "");
  const lire = (s) => {
    const e = document.querySelector(s);
    if (e === null) return null;
    return [s, getComputedStyle(e).fontFamily.split(",")[0].replace(/["']/g, "")];
  };
  const vus = [".wm-paras p", ".wm-tirets li", ".wm-annexe__lien", ".wm-table__cellule"]
    .map(lire).filter((v) => v !== null);
  return { attendu, vus, tous: vus.every(([, f]) => f === attendu) };
});
if (polices !== null && polices.attendu !== "") {
  console.log(
    `police courante : ${polices.attendu} attendu, ` +
      polices.vus.map(([s, f]) => `${s.slice(0, 18)}=${f}`).join(", ") +
      (polices.tous ? "" : " — DEFAUT, une police de secours est servie"),
  );
  if (!polices.tous) fautes++;
}

//  ── AUCUNE AUTRE FEUILLE NE GAGNE SUR UNE BRIQUE D'ANNEXE ─────────
//
//  Le titre d'une brique `carte` sortait a 25 px, encre et graisse
//  700, alors que cette feuille lui donne 19, accent et 600 : une
//  autre feuille du paquet stylait la meme classe pour une autre
//  chose, et passait apres. On compare donc la valeur RENDUE a celle
//  que le jeton annonce — un ecart signale que quelqu'un d'autre a
//  mis la main sur la brique.
const briques = await p.evaluate(() => {
  const t = document.querySelector(".wm-annexe__carte-titre");
  if (t === null) return null;
  const s = getComputedStyle(t);
  const attendu = s.getPropertyValue("--wm-taille-titre-section").trim();
  return {
    rendu: s.fontSize,
    attendu,
    graisse: s.fontWeight,
    accord: attendu !== "" && parseFloat(s.fontSize) === parseFloat(attendu),
  };
});
if (briques !== null) {
  console.log(
    `brique carte : titre rendu a ${briques.rendu}, jeton a ${briques.attendu}` +
      (briques.accord ? "" : " — DEFAUT, une autre feuille gagne"),
  );
  if (!briques.accord) fautes++;
}

//  ── UN `<b>` EN TETE DE TIRET RESTE DANS SA PHRASE ────────────────
//
//  La ligne a tirets etait en `flex` avec un ecart de dix pixels :
//  chaque enfant devenait une colonne, et un mot en gras se detachait
//  de la suite de sa propre phrase. On mesure l'ecart reel entre la
//  fin du gras et le premier mot qui suit — une espace fait trois
//  pixels, une colonne en fait dix.
const tiret = await p.evaluate(() => {
  for (const li of document.querySelectorAll(".wm-tirets > li")) {
    const b = li.querySelector("b, strong");
    if (b === null || b.nextSibling === null) continue;
    const t = b.nextSibling;
    if (t.nodeType !== 3 || t.textContent.trim() === "") continue;
    const r = document.createRange();
    //  On saute l'espace : c'est le premier caractere VISIBLE qu'on veut.
    const i = t.textContent.search(/\S/);
    r.setStart(t, i);
    r.setEnd(t, i + 1);
    return {
      ecart: Math.round(r.getBoundingClientRect().left - b.getBoundingClientRect().right),
      mot: b.textContent.slice(0, 24),
    };
  }
  return null;
});
if (tiret !== null) {
  const colle = tiret.ecart >= 0 && tiret.ecart <= 6;
  console.log(
    `tiret : le gras « ${tiret.mot} » est a ${tiret.ecart}px de sa phrase` +
      (colle ? "" : " — DEFAUT, c'est une colonne et pas une espace"),
  );
  if (!colle) fautes++;
}

//  ── L'ANNEXE SORT DE LA BOITE DU FORUM ────────────────────────────
//
//  Elle est la seule famille de pages a le faire. On mesure qu'elle
//  touche les deux bords de la fenetre, a tous les formats, et qu'on
//  ne paie pas ce debord par une barre de defilement horizontale.
for (const l of [1864, 1280]) {
  await p.setViewportSize({ width: l, height: 900 });
  const bord = await p.evaluate(() => {
    const a = document.querySelector(".wm-annexe");
    if (a === null) return null;
    const b = a.getBoundingClientRect();
    const r = document.documentElement;
    //  LA BARRE AUSSI. Elle est pleine largeur par nature, donc un
    //  decalage chez elle ne vient jamais d'elle : il vient de la
    //  marge de huit pixels que tout navigateur met sur `body` et
    //  qu'une page autonome doit retirer elle-meme. C'est ce que
    //  Callista voyait — « un petit decalage, comme un padding ».
    const n = document.querySelector(".wm-retour");
    const nb = n === null ? null : n.getBoundingClientRect();
    return {
      gauche: Math.round(b.left),
      droite: Math.round(r.clientWidth - b.right),
      barreGauche: nb === null ? 0 : Math.round(nb.left),
      barreHaut: nb === null ? 0 : Math.round(nb.top),
      barre: r.scrollWidth > r.clientWidth + 1,
    };
  });
  if (bord === null) continue;
  const plein = bord.gauche === 0 && bord.droite === 0 && !bord.barre &&
    bord.barreGauche === 0 && bord.barreHaut === 0;
  console.log(
    `${l}px : l'annexe touche les bords (${bord.gauche} / ${bord.droite}), ` +
      `barre a (${bord.barreGauche}, ${bord.barreHaut})` +
      (bord.barre ? ", MAIS une barre horizontale est apparue" : "") +
      (plein ? "" : " — DEFAUT"),
  );
  if (!plein) fautes++;
}

//  ET LE LAVIS NE S'ECLAIRCIT PLUS PASSE 1200 : sur un grand ecran, un
//  fondu qui irait jusqu'au bord donnerait une photo pleine page a
//  droite. On compare l'opacite du dernier arret a celle de
//  l'avant-dernier : elles doivent etre egales.
const lavis = await p.evaluate(() => {
  const c = document.querySelector(".wm-annexe__corps");
  if (c === null) return null;
  const img = getComputedStyle(c, "::after").backgroundImage;
  const d = img.indexOf("linear-gradient(to right");
  if (d === -1) return null;
  let n = 0, couche = "";
  for (let i = img.indexOf("(", d); i < img.length; i++) {
    if (img[i] === "(") n++;
    else if (img[i] === ")" && --n === 0) {
      couche = img.slice(d, i + 1);
      break;
    }
  }
  //  Chromium rend les couleurs translucides en `color(srgb … / a)`.
  const alphas = [...couche.matchAll(/\/\s*([\d.]+)\s*\)/g)].map((m) => Number(m[1]));
  return {
    arrets: alphas.length,
    deuxDerniersEgaux: alphas.length >= 2 &&
      alphas.at(-1) === alphas.at(-2),
  };
});
if (lavis !== null) {
  console.log(
    `lavis : ${lavis.arrets} arret(s) translucide(s), les deux derniers ` +
      (lavis.deuxDerniersEgaux ? "sont egaux" : "DIFFERENT — le fondu va jusqu'au bord"),
  );
  if (!lavis.deuxDerniersEgaux) fautes++;
}

for (const l of [1280, 900, 520, 390]) {
  await p.setViewportSize({ width: l, height: 900 });
  //  Et QUI deborde. « Il y a un debordement » envoie chercher a la main
  //  dans toute la page ; le coupable se nomme, et c'est deux minutes au
  //  lieu de vingt.
  const bilan = await p.evaluate(() => {
    const r = document.documentElement;
    const trop = r.scrollWidth > r.clientWidth + 1;
    if (!trop) return { trop };
    const bord = r.clientWidth;
    const coupables = [];
    for (const el of document.querySelectorAll("#modernbb *")) {
      const b = el.getBoundingClientRect();
      if (b.right <= bord + 1 || b.width === 0) continue;
      //  Le plus PROFOND qui deborde : un parent deborde parce qu'un
      //  enfant le pousse, et nommer le parent n'apprend rien.
      if (
        el.querySelector("*") !== null &&
        [...el.children].some((e) => e.getBoundingClientRect().right > bord + 1)
      ) continue;
      coupables.push(
        `${el.className || el.tagName} (${Math.round(b.width)}px, deborde de ${
          Math.round(b.right - bord)
        })`,
      );
    }
    return { trop, coupables: [...new Set(coupables)].slice(0, 6) };
  });
  console.log(`${l}px : debordement horizontal ${bilan.trop ? "OUI — defaut" : "non"}`);
  //  ET SOUS 900, AUCUNE IMAGE DE DECOR N'EST DEMANDEE. Le sommaire
  //  est passe au-dessus, la colonne prend toute la largeur : le
  //  voile couvrirait la photo entiere, et la faire telecharger sur
  //  un telephone serait soixante-dix kilos pour rien.
  if (l < 900) {
    const decor = await p.evaluate(() => {
      const c = document.querySelector(".wm-annexe__corps");
      if (c === null) return null;
      //  Les deux couches de decor sont des pseudo-elements depuis que
      //  la photo est floutee : c'est la qu'il faut regarder.
      return ["::before", "::after"].some((q) =>
        getComputedStyle(c, q).backgroundImage.includes("url(")
      );
    });
    if (decor === true) {
      console.log(`        ${l}px : le decor est encore charge — defaut`);
      fautes++;
    }
  }
  for (const c of bilan.coupables ?? []) console.log(`        ${c}`);
  if (bilan.trop) fautes++;
}
await navigateur.close();
process.exit(fautes === 0 ? 0 : 1);
