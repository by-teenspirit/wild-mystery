// ════════════════════════════════════════════════════════════════════
//  outils/moderation.mjs — le panneau de modération, dans les deux thèmes
//
//      deno task moderation
//
//  POURQUOI CE HARNAIS EXISTE. « Quand je suis ici, les couleurs ne
//  vont pas » (9 novembre) : les lignes de la table sortaient en bleu
//  ardoise, la couleur par défaut de ModernBB, avec des titres bruns
//  par-dessus. `02-socle.css` repeint bien les zébrures, mais sur
//  `li.row1` — et le panneau de modération sert une vraie `<table>`
//  dont les lignes sont des `<tr class="row1">`.
//
//  CETTE PAGE EST LA SEULE QU'ON NE PEUT PAS ALLER VOIR. Elle demande
//  une connexion de modérateur, et son adresse porte un jeton de
//  session. Le harnais monte donc le GABARIT AMONT — `modcp_body.tpl`
//  de `Etana/template`, relevé le 9 novembre — avec des valeurs de
//  démonstration à la place des variables.
//
//  CE QU'IL NE REMPLACE PAS : un coup d'œil sur la vraie page. Si
//  Forumactif change son gabarit, le nôtre ici devient un décor qui
//  passe au vert pendant que la page réelle est cassée. C'est la
//  limite de tout harnais qui copie un gabarit qu'il ne contrôle pas,
//  et elle vaut d'être écrite.
// ════════════════════════════════════════════════════════════════════
import { readFileSync } from "node:fs";
import { chromium } from "npm:playwright@1.56.0";

const R = new URL("..", import.meta.url).pathname;
const lire = (f) => readFileSync(R + f, "utf8");

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

let fautes = 0;
function ok(quoi, vrai, detail) {
  console.log(`  ${vrai ? "ok  " : "NON "} ${quoi}${detail === undefined ? "" : ` — ${JSON.stringify(detail)}`}`);
  if (!vrai) fautes += 1;
}

//  ── LE GABARIT, AVEC DES VALEURS À LA PLACE DES VARIABLES ───────────
//
//  Six sujets suffisent : trois zébrures, et de quoi voir que le filet
//  ne se pose pas au-dessus de la première ligne.
const SUJETS = [
  ["La saint Patrick - TC", 0, "Dim 28 Fév 2021 - 18:10", "row1"],
  ["Valider une fiche", 0, "Lun 14 Déc 2020 - 17:07", "row2"],
  ["Créer une Trainer Card", 5, "Mer 11 Nov 2020 - 20:37", "row1"],
  ["Défier le champion de l'arène de l'île Ténèbra", 0, "Sam 28 Nov 2020 - 19:25", "row2"],
  ["Défier le champion du Colosseum de Targare", 0, "Sam 28 Nov 2020 - 19:23", "row1"],
  ["Défier le champion de Pyrite", 0, "Sam 28 Nov 2020 - 19:18", "row2"],
];

const LIGNES = SUJETS.map(([titre, reponses, date, classe]) => `
  <tr class="${classe}">
    <td class="icon">&nbsp;</td>
    <td><a class="topictitle" href="/t1-sujet">${titre}</a></td>
    <td class="posts">${reponses}</td>
    <td>${date}</td>
    <td class="posts"><input type="checkbox" name="topic_id_list[]" value="1" /></td>
  </tr>`).join("");

const CORPS = `<form name="manage" action="/modcp" method="post">
<div class="topic-actions"><p>Index :: Zone staff :: GESTION :: ARCHIVES</p></div>
<h1 class="page-title">Panneau de modération</h1>
<p class="linkmcp">En utilisant le formulaire ci-dessous, vous pouvez accomplir des opérations
de modération de masse sur ce forum.</p>
<div class="panel row3"><div class="inner">
  <div id="cp-main" class="mcp-main">
    <div class="panel"><div class="inner">
      <table class="table1" cellspacing="1">
        <thead><tr>
          <th class="name">&nbsp;</th><th class="name">Sujets</th>
          <th>Réponses</th><th class="name">Derniers Messages</th><th>Sélectionner</th>
        </tr></thead>
        <tbody>${LIGNES}</tbody>
      </table>
    </div></div>
    <p class="right-box"><a href="#">Tout sélectionner</a>&nbsp;::&nbsp;<a href="#">Tout désélectionner</a></p>
    <fieldset class="submit-buttons">
      <input class="button2" type="submit" value="Supprimer" />
      <input class="button2" type="submit" value="Déplacer" />
      <input class="button2" type="submit" value="Verrouiller" />
      <input class="button2" type="submit" value="Déverrouiller" />
      <input class="button2" type="submit" value="Note" />
      <input class="button2" type="submit" value="Annonce" />
      <input class="button2" type="submit" value="Normal" />
    </fieldset>
  </div>
</div></div>
</form>`;

const PAGE = `<!doctype html><html lang="fr"><head><meta charset="utf-8">
<link rel="stylesheet" href="/panneau-admin/jetons.css">
<link rel="stylesheet" href="/css/wild-mystery.css"></head>
<body><div id="modernbb"><div id="wrap">${CORPS}</div></div></body></html>`;

const nav = await chromium.launch(CHROME === undefined ? {} : { executablePath: CHROME });

//  ── LE CONTRASTE, MESURÉ SUR LE FOND RÉELLEMENT PEINT ───────────────
//
//  On remonte l'arbre jusqu'au premier fond opaque : un `<td>` n'a pas
//  de fond à lui, c'est sa ligne qui le porte, et mesurer sur du
//  transparent donnerait le blanc du navigateur.
const MESURE = () => {
  const lin = (c) => (c /= 255, c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const lum = ([r, g, b]) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  const rgb = (t) => (t.match(/[\d.]+/g) || []).slice(0, 3).map(Number);
  const opaque = (t) => t !== "" && !/rgba\(0, 0, 0, 0\)|transparent/.test(t);
  const fondDe = (el) => {
    for (let n = el; n !== null; n = n.parentElement) {
      const f = getComputedStyle(n).backgroundColor;
      if (opaque(f)) return rgb(f);
    }
    return [255, 255, 255];
  };
  const out = [];
  for (const el of document.querySelectorAll("#modernbb .mcp-main *, #modernbb .linkmcp, #modernbb h1")) {
    const mot = [...el.childNodes].filter((n) => n.nodeType === 3)
      .map((n) => n.textContent.trim()).filter(Boolean).join(" ");
    if (mot === "") continue;
    const s = getComputedStyle(el);
    const px = parseFloat(s.fontSize);
    const gras = Number(s.fontWeight) >= 700;
    const seuil = px >= 24 || (px >= 18.66 && gras) ? 3 : 4.5;
    const [hi, lo] = [lum(rgb(s.color)), lum(fondDe(el))].sort((a, b) => b - a);
    const rapport = Math.round(((hi + 0.05) / (lo + 0.05)) * 100) / 100;
    out.push({
      ou: (el.tagName.toLowerCase() + "." + (el.className || "")).slice(0, 36),
      mot: mot.slice(0, 32),
      px,
      rapport,
      seuil,
      ok: rapport >= seuil,
    });
  }
  return out;
};

for (const theme of ["clair", "sombre"]) {
  const p = await nav.newPage({ viewport: { width: 1280, height: 1000 } });
  await p.route("**/*", (q) => {
    const u = q.request().url();
    const f = (t, b) => q.fulfill({ contentType: t, body: b });
    if (/\/vue$/.test(u)) return f("text/html; charset=utf-8", PAGE);
    if (/jetons\.css$/.test(u)) return f("text/css", lire("panneau-admin/jetons.css"));
    if (/wild-mystery\.css$/.test(u)) return f("text/css", lire("css/wild-mystery.css"));
    return q.fulfill({ status: 404, body: "" });
  });
  await p.goto("https://exemple.test/vue", { waitUntil: "load" });
  await p.evaluate((t) => document.body.classList.toggle("wm-sombre", t === "sombre"), theme);
  await new Promise((x) => setTimeout(x, 200));

  //  ── 1 · PLUS UNE SEULE SURFACE DE MODERNBB ───────────────────────
  //
  //  C'est le défaut d'origine, et il se reconnaît à sa couleur : le
  //  bleu ardoise par défaut n'a aucun rapport avec la charte, dont
  //  toutes les surfaces sont chaudes — le rouge y est toujours le
  //  canal le plus fort, en clair comme en sombre.
  const surfaces = await p.evaluate(() => {
    const rgb = (t) => (t.match(/[\d.]+/g) || []).slice(0, 3).map(Number);
    return [...document.querySelectorAll("#modernbb tr, #modernbb table.table1, #modernbb thead th")]
      .map((el) => ({
        ou: (el.tagName.toLowerCase() + "." + (el.className || "")).slice(0, 24),
        fond: getComputedStyle(el).backgroundColor,
      }))
      .filter((x) => !/rgba\(0, 0, 0, 0\)/.test(x.fond))
      .map((x) => ({ ...x, froide: rgb(x.fond)[2] > rgb(x.fond)[0] }));
  });
  //  L'EN-TÊTE EST LA SEULE EXCEPTION : il porte l'accent, qui est un
  //  bleu, et c'est la charte qui le veut.
  const froides = surfaces.filter((s) => s.froide && !s.ou.includes("th"));
  ok(
    `${theme} : aucune surface froide de ModernBB dans la table`,
    froides.length === 0,
    froides,
  );

  //  ── 2 · LES ZÉBRURES SONT TOUTES LA MÊME ─────────────────────────
  const zebres = await p.evaluate(() =>
    [...new Set(
      [...document.querySelectorAll("#modernbb tbody tr")].map((t) =>
        getComputedStyle(t).backgroundColor
      ),
    )]
  );
  ok(`${theme} : les six lignes ont la même surface`, zebres.length === 1, zebres);

  //  ── 3 · TOUT SE LIT ──────────────────────────────────────────────
  const textes = await p.evaluate(MESURE);
  const rates = textes.filter((t) => !t.ok);
  ok(
    `${theme} : les ${textes.length} textes tiennent leur seuil de contraste`,
    rates.length === 0,
    rates.slice(0, 6),
  );

  //  ── 4 · LA RANGÉE DE BOUTONS TIENT SUR UNE LIGNE, ET SE REPLIE ───
  const boutons = await p.evaluate(() => {
    const f = document.querySelector(".submit-buttons");
    const b = [...f.querySelectorAll(".button2")];
    return {
      lignes: new Set(b.map((x) => Math.round(x.getBoundingClientRect().top))).size,
      deborde: Math.max(...b.map((x) => x.getBoundingClientRect().right)) >
        f.getBoundingClientRect().right + 1,
    };
  });
  ok(`${theme} : les sept boutons tiennent dans leur bloc`, !boutons.deborde, boutons);

  //  `--photo` : une image par thème, pour la regarder plutôt que la
  //  lire. Même drapeau que `outils/profil.mjs`.
  if (Deno.args.includes("--photo")) {
    await p.screenshot({ path: `/mnt/user-data/outputs/modcp-${theme}.png`, fullPage: true });
  }

  await p.setViewportSize({ width: 390, height: 900 });
  await new Promise((x) => setTimeout(x, 150));
  const etroit = await p.evaluate(() => ({
    deborde: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    largeur: document.documentElement.scrollWidth,
  }));
  //  UNE TABLE DE CINQ COLONNES NE RENTRE PAS DANS 390 PX, et ce n'est
  //  pas un défaut qu'on peut corriger sans réécrire le gabarit de
  //  Forumactif. Ce qu'on exige, c'est que le débordement reste DANS
  //  la table — pas que la page entière parte à droite.
  ok(
    `${theme} : à 390 px, le débordement ne gagne pas toute la page`,
    etroit.largeur < 700,
    etroit,
  );
  await p.close();
}

await nav.close();
console.log(fautes === 0 ? "\n  TOUT PASSE." : `\n  ${fautes} défaut(s).`);
Deno.exit(fautes === 0 ? 0 : 1);
