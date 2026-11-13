// ════════════════════════════════════════════════════════════════════
//  outils/qui-est-en-ligne.mjs — `/viewonline`, dans un vrai
//  navigateur.
//
//  COUVRE : css/31-qui-est-en-ligne.css
//
//      deno run -A outils/qui-est-en-ligne.mjs
//      deno run -A outils/qui-est-en-ligne.mjs --photo
//
//  ── DEUX TABLEAUX, PARCE QUE LA PORTÉE EST LA MOITIÉ DU TRAVAIL ───
//
//  La page monte le tableau de `/viewonline` ET un `table.table1`
//  ordinaire sans `th.active`. Toute la feuille passe par
//  `:has(th.active)` ; si un sélecteur débordait, le second tableau le
//  dirait.
//
//  LE BLANC SUR BLANC EST REPOSÉ ICI. Il vient de la feuille de
//  ModernBB, que ce fac-similé ne charge pas : sans lui, le défaut
//  principal de la page n'existerait pas sur la page montée, et la
//  règle qui le corrige serait gardée par un contrôle vert d'avance.
//  Troisième fois de la journée qu'il faut reposer ce que ModernBB
//  fait — après le calque des onglets et le `float` de la pagination.
//
//  Le balisage vient d'un relevé fait le 13 novembre dans le
//  navigateur de Callista : la page est derrière la connexion, et on
//  ne s'y connecte pas d'ici.
// ════════════════════════════════════════════════════════════════════

import { readFileSync } from "node:fs";
import { chromium } from "npm:playwright@1.56.0";

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
const lire = (c) => readFileSync(R + c, "utf8");

/*  CE QUE MODERNBB POSE, et que ce fac-similé ne charge pas. Relevé
    le 13 novembre sur la vraie page : le blanc des intitulés, les
    trois pixels de rembourrage des cellules, et le gris 68 du texte. */
const MODERNBB = `
  #modernbb table.table1 { width: 100%; }
  #modernbb table.table1 thead th { color: #fff; background: transparent;
    padding: 9px 18px; font-size: 13px; text-align: left; }
  #modernbb table.table1 tbody td { color: #444; padding: 3px 18px; font-size: 13px; }
`;

const ligne = (n, qui, quand, ou) => `
  <tr class="row${n % 2 === 0 ? 2 : 1}">
    <td><span class="nom">${qui}</span></td>
    <td>${quand}</td>
    <td><a href="/viewonline">${ou}</a></td>
  </tr>`;

const tableau = (classeEnTete) => `
  <div class="forumbg">
    <div class="inner">
      <span class="corners-top"><span></span></span>
      <table class="table1">
        <thead>
          <tr>
            <th class="name">Nom d'utilisateur</th>
            <th class="${classeEnTete}">Dernière mise à jour</th>
            <th class="info">Localisation sur le Forum</th>
          </tr>
        </thead>
        <tbody>
          ${ligne(1, "Arceus", "Ven 13 Nov 2026 - 11:54", "Regarde qui est en ligne")}
          ${ligne(2, "Invité", "Ven 13 Nov 2026 - 11:52", "Est sur l'index du forum")}
          ${ligne(3, "Fenja Ringen", "Ven 13 Nov 2026 - 11:40", "Le Col de Braise")}
        </tbody>
      </table>
      <span class="corners-bottom"><span></span></span>
    </div>
  </div>`;

const PAGE = `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8">
<title>Qui est en ligne ?</title>
<link rel="stylesheet" href="/jetons.css"><link rel="stylesheet" href="/wild-mystery.css">
<style>${MODERNBB}</style>
</head><body><div id="modernbb"><div class="wrap"><div id="main-content">

<h1 class="page-title">Il y a 1 utilisateur enregistré et 0 utilisateur invisible en ligne</h1>
<p>Il y a 1 invité en ligne</p>

<!-- LA PAGE QUI EST EN LIGNE : son en-tête porte \`th.active\` -->
<div id="enligne">${tableau("active")}</div>

<!-- UN AUTRE \`table.table1\`, SANS \`th.active\` : rien ne doit l'atteindre -->
<div id="temoin">${tableau("autre")}</div>

<p>Ces données sont basées sur les utilisateurs actifs des cinq dernières minutes</p>

</div></div></div></body></html>`;

let passes = 0;
const soucis = [];
function ok(quoi, vrai, detail) {
  if (vrai) {
    passes += 1;
    console.log(`  ok   ${quoi}`);
  } else {
    soucis.push(quoi);
    console.log(
      `  NON  ${quoi}${detail === undefined ? "" : ` — ${JSON.stringify(detail)}`}`,
    );
  }
}

const nav = await chromium.launch(CHROME === undefined ? {} : { executablePath: CHROME });
const p = await nav.newPage({ viewport: { width: 1384, height: 1000 } });
await p.route("**/*", (r) => {
  const u = r.request().url();
  if (/\/viewonline$/.test(u)) {
    return r.fulfill({ contentType: "text/html; charset=utf-8", body: PAGE });
  }
  if (/jetons\.css$/.test(u)) {
    return r.fulfill({ contentType: "text/css", body: lire("panneau-admin/jetons.css") });
  }
  if (/wild-mystery\.css$/.test(u)) {
    return r.fulfill({ contentType: "text/css", body: lire("css/wild-mystery.css") });
  }
  return r.fulfill({ status: 404, body: "" });
});
await p.goto("https://exemple.test/viewonline", { waitUntil: "load" });
await p.waitForTimeout(150);

const vu = await p.evaluate(() => {
  const g = (s) => document.querySelector(s);
  //  Le rapport de contraste, calculé et pas affirmé : c'est la mesure
  //  du défaut principal.
  const lum = (couleur) => {
    const [r, v, b] = couleur.match(/\d+/g).slice(0, 3).map(Number);
    const f = (x) => (x / 255 <= 0.03928 ? x / 255 / 12.92 : ((x / 255 + 0.055) / 1.055) ** 2.4);
    return 0.2126 * f(r) + 0.7152 * f(v) + 0.0722 * f(b);
  };
  const ratio = (x, y) => {
    const [h, b] = [lum(x), lum(y)].sort((m, n) => n - m);
    return Math.round(((h + 0.05) / (b + 0.05)) * 100) / 100;
  };
  const mesurer = (ou) => {
    const th = g(`${ou} thead th`);
    //  PAS LE PREMIER `td` : c'est celui du pseudo, et on compare
    //  justement le pseudo au reste de la ligne. Mesuré sur le
    //  premier, le contrôle se comparait à lui-même et tombait rouge
    //  en annonçant deux valeurs correctes.
    const td = g(`${ou} tbody td:nth-child(3)`);
    const cth = getComputedStyle(th), ctd = getComputedStyle(td);
    //  L'intitulé se lit sur CE QU'IL Y A DERRIÈRE : son propre fond
    //  s'il en a un, sinon celui de la carte.
    const sien = cth.backgroundColor;
    const derriere = /, *0\)$/.test(sien)
      ? getComputedStyle(g(`${ou} .forumbg`)).backgroundColor
      : sien;
    return {
      enTete: {
        couleur: cth.color,
        fond: sien,
        contraste: ratio(cth.color, derriere),
        casse: cth.textTransform,
        rembourrage: cth.padding,
        //  Le bord gauche du TEXTE, pas de la cellule : c'est lui
        //  qu'on voit tomber en face, ou pas.
        gauche: Math.round(th.getBoundingClientRect().left) + parseFloat(cth.paddingLeft),
      },
      cellule: {
        couleur: ctd.color,
        rembourrage: ctd.padding,
        hauteurDeLigne: Math.round(g(`${ou} tbody tr`).getBoundingClientRect().height),
        filet: ctd.borderBottomWidth,
        gauche: Math.round(g(`${ou} tbody td`).getBoundingClientRect().left) +
          parseFloat(getComputedStyle(g(`${ou} tbody td`)).paddingLeft),
      },
      //  Le pseudo est le sujet de la ligne.
      pseudo: {
        couleur: getComputedStyle(g(`${ou} tbody td:first-child`)).color,
        graisse: getComputedStyle(g(`${ou} tbody td:first-child`)).fontWeight,
      },
    };
  };
  return {
    enligne: mesurer("#enligne"),
    temoin: mesurer("#temoin"),
    deborde: [...document.querySelectorAll("#modernbb *")]
      .filter((e) =>
        e.getBoundingClientRect().right > document.documentElement.clientWidth + 1
      ).length,
  };
});

console.log("\n── l'en-tête qu'on ne voyait pas ──");
//  LE DÉFAUT PRINCIPAL : blanc sur la carte blanche. Les trois
//  intitulés étaient invisibles.
ok(
  "LES INTITULÉS SE LISENT",
  vu.enligne.enTete.contraste >= 4.5,
  vu.enligne.enTete,
);
ok(
  "et ils portent la grammaire d'étiquette du forum",
  vu.enligne.enTete.casse === "uppercase",
  vu.enligne.enTete,
);
//  UN INTITULÉ QUI NE TOMBE PAS SUR SA COLONNE NE NOMME RIEN.
//  ModernBB donne 18 px à l'en-tête et 18 aux cellules ; nous en
//  donnons 16 aux cellules, et il fallait les donner aussi à
//  l'en-tête, sinon les deux se décalent de deux pixels.
ok(
  "et ils tombent sur leur colonne",
  vu.enligne.enTete.gauche === vu.enligne.cellule.gauche,
  { enTete: vu.enligne.enTete.gauche, cellule: vu.enligne.cellule.gauche },
);

console.log("\n── les lignes respirent ──");
//  `padding: 3px 18px` sur la vraie page : deux lignes se touchaient.
ok(
  "la cellule a du rembourrage",
  parseFloat(vu.enligne.cellule.rembourrage) >= 8,
  vu.enligne.cellule,
);
ok(
  "un filet les sépare",
  parseFloat(vu.enligne.cellule.filet) >= 1,
  vu.enligne.cellule,
);
ok(
  "le texte est à notre encre, plus au gris de ModernBB",
  vu.enligne.cellule.couleur !== "rgb(68, 68, 68)",
  vu.enligne.cellule.couleur,
);
ok(
  "et le pseudo se détache du reste de la ligne",
  vu.enligne.pseudo.couleur !== vu.enligne.cellule.couleur &&
    Number(vu.enligne.pseudo.graisse) >= 600,
  vu.enligne.pseudo,
);

console.log("\n── et un autre tableau ne bouge pas ──");
//  TOUTE LA FEUILLE PASSE PAR `:has(th.active)`. Le témoin est le même
//  tableau, à un nom de classe près.
ok(
  "son en-tête garde ce que ModernBB lui donne",
  vu.temoin.enTete.couleur === "rgb(255, 255, 255)" &&
    vu.temoin.enTete.casse === "none",
  vu.temoin.enTete,
);
ok(
  "et ses cellules gardent leurs trois pixels",
  vu.temoin.cellule.rembourrage.startsWith("3px"),
  vu.temoin.cellule,
);

console.log("\n── la page tient ──");
ok("rien ne déborde à 1384", vu.deborde === 0, vu.deborde);
for (const largeur of [1100, 760, 390]) {
  await p.setViewportSize({ width: largeur, height: 1000 });
  await p.waitForTimeout(80);
  const trop = await p.evaluate(() =>
    [...document.querySelectorAll("#modernbb *")]
      .filter((e) =>
        e.getBoundingClientRect().right > document.documentElement.clientWidth + 1
      ).map((e) => e.className).slice(0, 3)
  );
  ok(`rien ne déborde à ${largeur}`, trop.length === 0, trop);
}
await p.setViewportSize({ width: 1384, height: 1000 });

if (Deno.args.includes("--photo")) {
  for (const theme of ["clair", "sombre"]) {
    await p.evaluate(
      (t) => document.body.classList.toggle("wm-sombre", t === "sombre"),
      theme,
    );
    await p.waitForTimeout(80);
    await p.screenshot({ path: `${R}qui-est-en-ligne-${theme}.png` });
  }
  console.log("photos : qui-est-en-ligne-<thème>.png");
}

await p.close();
await nav.close();
console.log(soucis.length === 0 ? `\nTOUT PASSE (${passes}).` : `\n${soucis.length} DÉFAUT(S).`);
for (const s of soucis) console.log("  · " + s);
if (soucis.length > 0) Deno.exit(1);
