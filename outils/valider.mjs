// ════════════════════════════════════════════════════════════════════
//  outils/valider.mjs — le message de t1003, mesuré
//
//  « Réutilise le code des fiches, et expliquer comment valider un
//  membre / lier son compte ici », 16 novembre. Le message est monté
//  avec les briques de `wm-annonce`, donc il n'apporte aucun CSS — ce
//  qu'il peut casser, c'est son propre contenu.
//
//  IL EST MONTÉ DANS UN VRAI CORPS DE MESSAGE ModernBB, à la largeur
//  réelle d'un message : 586 px, relevée le 10 novembre. Les deux
//  commandes SQL sont les lignes les plus longues de tout le dépôt
//  collées dans un message, et un débordement ne se voit qu'ici.
//
//  ── CE QUE CE HARNAIS GARDE, ET POURQUOI PAS UNE COPIE DU TEXTE ────
//
//  Un contrôle qui recopie ce que le message dit ne garde rien : il
//  passera au vert le jour où les deux seront faux ensemble. Les
//  contrôles d'ici lisent donc la MIGRATION 0041 et comparent :
//
//    · les six maisons annoncées sont les six que la fonction accepte ;
//    · les quatre champs de la commande sont les quatre qu'elle lit ;
//    · les trois clés de la réponse sont les trois qu'elle rend ;
//    · « trente-deux caractères » vient de `gen_random_bytes(16)`.
//
//  Le jour où une septième maison arrive, c'est le message qui devient
//  rouge, et pas le forum qui mentira pendant six mois.
//
//  Lancé par `deno task valider`.
// ════════════════════════════════════════════════════════════════════

import { chromium } from "npm:playwright@1.56.0";
import { readFileSync } from "node:fs";

const R = new URL("..", import.meta.url).pathname;
const lire = (f) => readFileSync(R + f, "utf8");

const lisible = lire("templates/valider-un-membre.a-coller.html");
const serre = lire("templates/valider-un-membre.a-coller.min.html");
const migration = lire("supabase/migrations/0041_valider_enregistre_l_adresse.sql");

//  ── LES RÈGLES DE MODERNBB, RELEVÉES SUR LE FORUM ─────────────────
//
//  Identiques à celles de `champions.mjs` : mesurées le 10 novembre
//  dans un vrai corps de message, posées au plus faible pour
//  reproduire l'ordre observé — elles habillent une balise nue et
//  cèdent à la première classe.
const MODERNBB = `
#modernbb ul, #modernbb ol { margin: 0 0 16px 48px; padding: 0; }
#modernbb li { margin: 0; padding: 0; }
#modernbb h2 { margin: -3px 0 9px; padding: 0 0 3px; }
#modernbb h3 { margin: 0 0 12px; padding: 0 0 3px; }
`;

const page = `<!doctype html><html lang="fr"><head><meta charset="utf-8">
<style>${lire("panneau-admin/jetons.css")}</style>
<style>${MODERNBB}</style>
<style>${lire("css/wild-mystery.css")}</style>
<style>
  html, body { margin: 0; }
  body { background: var(--wm-fond-page); padding: 24px; }
  /*  586 px : la largeur RÉELLE d'un message sur le forum. */
  .essai { width: 586px; margin: 0 auto 48px; }
</style></head>
<body id="modernbb"><div id="page-body"><div class="post"><div class="postbody">
<div class="content">
<div class="essai" data-m="serre">${serre}</div>
<div class="essai" data-m="lisible">${lisible}</div>
</div></div></div></div></body></html>`;

const nav = await chromium.launch();
const p = await nav.newPage({ viewport: { width: 1000, height: 1400 } });
const soucis = [];
p.on("pageerror", (e) => soucis.push("erreur JS : " + e.message));
await p.route(
  "**/*",
  (r) => r.fulfill({ contentType: "text/html; charset=utf-8", body: page }),
);
await p.goto("https://exemple.test/");

let fautes = 0;
const dire = (quoi, ok, detail = "") => {
  if (ok) console.log("  ok   " + quoi + (detail ? " — " + detail : ""));
  else {
    fautes += 1;
    console.log("   ✗ " + quoi + (detail ? " — " + detail : ""));
  }
};

// ── 1 · LA CARTE EST MONTÉE AVEC LES BRIQUES EXISTANTES ─────────────
//
//  Un nom de classe inventé ne se voit pas : il ne casse rien, il ne
//  fait rien. On compare donc les classes employées à celles que la
//  feuille déclare vraiment.
const feuille = lire("css/wild-mystery.css");
const classesEmployees = [
  ...new Set(
    [...serre.matchAll(/class="([^"]+)"/g)].flatMap((m) => m[1].split(/\s+/)),
  ),
].filter((c) => c.startsWith("wm-"));
const inconnues = classesEmployees.filter((c) => !feuille.includes("." + c));
dire(
  "toutes les classes du message existent dans la feuille",
  inconnues.length === 0,
  inconnues.length === 0 ? `${classesEmployees.length} briques` : JSON.stringify(inconnues),
);

// ── 2 · AUCUNE BALISE HORS DE LA LISTE BLANCHE ──────────────────────
//
//  Le HTML des messages passe par une liste blanche (doc 03, § 9.6).
//  `pre` et `code` n'y sont pas — c'est pour ça que les deux commandes
//  SQL sont du texte. La règle est écrite ici pour qu'une balise de
//  plus devienne rouge, et pas pour qu'on la retrouve sur le forum.
const BLANCHE = new Set([
  "a",
  "abbr",
  "b",
  "blockquote",
  "br",
  "div",
  "em",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "i",
  "img",
  "li",
  "ol",
  "p",
  "span",
  "strong",
  "table",
  "u",
  "ul",
]);
const balises = [
  ...new Set(
    [...serre.matchAll(/<\/?([a-z][a-z0-9]*)/gi)].map((m) => m[1].toLowerCase()),
  ),
];
const horsListe = balises.filter((b) => !BLANCHE.has(b));
dire(
  "aucune balise hors de la liste blanche des messages",
  horsListe.length === 0,
  horsListe.length === 0 ? balises.join(" ") : JSON.stringify(horsListe),
);

// ── 3 · NI STYLE EN LIGNE, NI COULEUR EN DUR ────────────────────────
dire(
  "ni <style>, ni style=, ni couleur écrite en dur",
  !/<style|\sstyle=|#[0-9a-f]{3,8}\b|rgb\(/i.test(serre),
);

// ── 4 · AUCUNE CLÉ DE CARNET DANS LE MESSAGE ────────────────────────
//
//  La clé fait trente-deux caractères hexadécimaux et elle ouvre le
//  carnet de son propriétaire. La règle n'est pas « cette clé-là n'y
//  est pas » mais « aucune suite de trente-deux hexadécimaux n'y est ».
const suspects = [...serre.matchAll(/\b[0-9a-f]{32}\b/gi)].map((m) => m[0]);
dire(
  "AUCUNE CLÉ DE CARNET N'EST ÉCRITE DANS LE MESSAGE",
  suspects.length === 0,
  suspects.length === 0 ? "" : `${suspects.length} suite(s) de 32 hexadécimaux`,
);

// ── 5 · LES SIX MAISONS SONT CELLES DE LA FONCTION ──────────────────
//
//  Lues dans la 0041, pas recopiées : `v_groupe not in ('hardi', …)`.
const acceptees = (migration.match(/not in \(([^)]*)\)/) ?? [, ""])[1]
  .match(/'([a-z]+)'/g)?.map((x) => x.slice(1, -1)) ?? [];
const annoncees = await p.evaluate(() => {
  const bloc = [...document.querySelectorAll('[data-m="serre"] .wm-annonce__bloc')]
    .find((b) => b.querySelector(".wm-annonce__bloc-titre")?.textContent.includes("maison"));
  return [...bloc.querySelectorAll("strong")].map((s) => s.textContent.trim());
});
dire(
  "LES MAISONS ANNONCÉES SONT CELLES QUE LA FONCTION ACCEPTE",
  acceptees.length === 6 &&
    acceptees.length === annoncees.length &&
    acceptees.every((g) => annoncees.includes(g)),
  JSON.stringify({ migration: acceptees, message: annoncees }),
);

// ── 6 · LES CHAMPS DE LA COMMANDE SONT CEUX QU'ELLE LIT ─────────────
//
//  `p->>'forumUserId'`, `p->>'pseudo'`… dans la migration. Un champ de
//  plus dans le message serait ignoré en silence par la fonction ; un
//  champ de moins laisserait le staff sans l'adresse, qui est tout le
//  défaut qu'on vient de réparer.
const lus = [
  ...new Set(
    [...migration.matchAll(/p->>'([A-Za-z]+)'/g)].map((m) => m[1]),
  ),
].sort();
const commande = await p.evaluate(() => {
  const bloc = [...document.querySelectorAll('[data-m="serre"] .wm-annonce__bloc')]
    .find((b) => b.textContent.includes("valider_le_personnage"));
  return bloc.querySelector(".wm-annonce__texte").textContent;
});
const ecrits = [
  ...new Set(
    [...commande.matchAll(/"([A-Za-z]+)":/g)].map((m) => m[1]),
  ),
].sort();
dire(
  "LA COMMANDE PORTE LES QUATRE CHAMPS QUE LA FONCTION LIT",
  lus.length === 4 && JSON.stringify(lus) === JSON.stringify(ecrits),
  JSON.stringify({ migration: lus, message: ecrits }),
);

// ── 7 · LES CLÉS DE RÉPONSE SONT CELLES QU'ELLE REND ────────────────
const rendues = [
  ...new Set(
    [...(migration.match(/jsonb_build_object\(([\s\S]*?)\n  \);/) ?? [, ""])[1]
      .matchAll(/'([A-Za-z]+)',/g)].map((m) => m[1]),
  ),
];
const expliquees = await p.evaluate(() =>
  [...document.querySelectorAll('[data-m="serre"] .wm-annonce__bloc-titre')]
    .map((t) => t.textContent.trim())
);
//  AUCUNE EXEMPTION. Le premier jet écartait `joueurId`, « dont le
//  staff n'a rien à faire » — et un contrôle qui s'autorise une
//  exception s'en autorisera une deuxième. Il est expliqué, en une
//  ligne qui dit justement qu'il ne sert à rien.
const manquantes = rendues.filter((c) => !expliquees.includes(c));
dire(
  "TOUTES les clés de la réponse sont expliquées une par une",
  rendues.length === 5 && manquantes.length === 0,
  JSON.stringify({ rendues, manquantes }),
);

// ── 8 · « TRENTE-DEUX CARACTÈRES » VIENT DE LA FONCTION ─────────────
//
//  `encode(gen_random_bytes(16), 'hex')` : seize octets, deux
//  caractères chacun. Le nombre est écrit en lettres dans le message ;
//  il est calculé ici.
const octets = Number((migration.match(/gen_random_bytes\((\d+)\)/) ?? [, 0])[1]);
const MOTS = { 32: "trente-deux", 64: "soixante-quatre" };
const texteSerre = await p.evaluate(() =>
  document.querySelector('[data-m="serre"]').textContent
);
dire(
  "la longueur annoncée de la clé est celle que la fonction tire",
  octets === 16 && texteSerre.includes(MOTS[octets * 2] + " caractères"),
  `${octets} octets → ${octets * 2} caractères`,
);

// ── 9 · LES COLONNES DU DIAGNOSTIC SONT DANS LE SELECT ──────────────
//
//  Les quatre pannes se nomment par une colonne. Chacune doit être
//  demandée par la commande juste au-dessus d'elles, sinon on envoie
//  lire une colonne qu'on n'affiche pas.
const diagnostic = await p.evaluate(() => {
  const blocs = [...document.querySelectorAll('[data-m="serre"] .wm-annonce__bloc')];
  const select = blocs.find((b) => b.textContent.includes("from joueur where"));
  const i = blocs.indexOf(select);
  return {
    select: select.querySelector(".wm-annonce__texte").textContent,
    pannes: blocs.slice(i + 1, i + 5).map((b) =>
      b.querySelector(".wm-annonce__bloc-titre").textContent.trim()
    ),
  };
});
const colonnes = diagnostic.pannes
  .flatMap((t) => t.match(/\b[a-z_]{5,}\b/g) ?? [])
  .filter((m) => !["aucune", "ligne", "vide", "different"].includes(m));
const absentes = colonnes.filter((c) => !diagnostic.select.includes(c));
dire(
  "chaque panne nomme une colonne que le select demande",
  diagnostic.pannes.length === 4 && absentes.length === 0,
  JSON.stringify({ pannes: diagnostic.pannes, absentes }),
);

// ── 10 · LES SIX ÉTAPES SE SUIVENT ──────────────────────────────────
const etapes = await p.evaluate(() =>
  [...document.querySelectorAll('[data-m="serre"] .wm-annonce__bloc-titre')]
    .map((t) => t.textContent.trim())
    .filter((t) => /^\d+ ·/.test(t))
);
dire(
  "les six étapes sont numérotées et dans l'ordre",
  etapes.length === 6 &&
    etapes.every((t, i) => t.startsWith(`${i + 1} ·`)),
  JSON.stringify(etapes.map((t) => t.split(" ·")[0])),
);

// ── 11 · RIEN N'EST ROGNÉ PAR LA CARTE ──────────────────────────────
//
//  MON PREMIER CONTRÔLE ICI NE POUVAIT PAS ÉCHOUER, et je l'ai vu en
//  essayant de le casser : j'ai mis un mot de deux cents caractères
//  dans la commande SQL, et rien n'est devenu rouge. La raison est
//  dans `05-sujet.css` — le corps d'un message porte déjà
//  `overflow-wrap: break-word`, pour les URL que les joueurs collent.
//  Les deux commandes se coupent donc toutes seules : un texte NE PEUT
//  PAS élargir ce message. Le contrôle mesurait un risque inexistant.
//
//  Le vrai risque est l'autre : `.wm-annonce` porte `overflow: hidden`,
//  donc ce qui dépasse n'élargit pas la page — il est COUPÉ, en
//  silence. On mesure les rectangles, et pas `scrollWidth` : un bord
//  droit au-delà de celui de la carte est du contenu qu'on ne lit pas.
const debords = await p.evaluate(() => {
  const racine = document.querySelector('[data-m="serre"]');
  const carte = racine.querySelector(".wm-annonce");
  const r = carte.getBoundingClientRect();
  const dedans = [];
  for (const el of carte.querySelectorAll("*")) {
    const e = el.getBoundingClientRect();
    if (e.width === 0) continue;
    if (e.right > r.right + 1 || e.left < r.left - 1) {
      dedans.push(
        `${el.className || el.tagName} ${Math.round(e.left)}–${Math.round(e.right)} ` +
          `hors de ${Math.round(r.left)}–${Math.round(r.right)}`,
      );
    }
  }
  return {
    dedans,
    large: Math.round(r.width),
    page: document.documentElement.scrollWidth,
  };
});
dire("RIEN N'EST ROGNÉ PAR LA CARTE", debords.dedans.length === 0, debords.dedans.join(" · "));
dire(
  "la carte tient les 586 px du message, et la page ne défile pas",
  debords.large <= 586 && debords.page <= 1000,
  `${debords.large} px`,
);

// ── 12 · LES CADRES SE RANGENT DEUX PAR DEUX ────────────────────────
//
//  « Je veux pas de tableau, que du flexbox » : les quatre pannes et
//  les six étapes sont des cadres en flex. On compte les abscisses
//  d'une même ligne — deux, ou un seul quand il est en pleine largeur.
const rangees = await p.evaluate(() => {
  const sortie = [];
  for (const liste of document.querySelectorAll('[data-m="serre"] .wm-annonce__blocs')) {
    const lignes = new Map();
    for (const b of liste.querySelectorAll(":scope > .wm-annonce__bloc")) {
      const y = Math.round(b.getBoundingClientRect().top);
      lignes.set(y, (lignes.get(y) ?? 0) + 1);
    }
    sortie.push([...lignes.values()]);
  }
  return sortie;
});
dire(
  "les cadres se rangent par deux, jamais par trois",
  rangees.length === 4 && rangees.every((l) => l.every((n) => n <= 2)),
  JSON.stringify(rangees),
);

// ── 13 · LA VERSION D'UNE LIGNE DIT LA MÊME CHOSE ───────────────────
//
//  Le dégraissage réduit tout blanc à UNE espace. S'il en avalait une
//  entre deux éléments en ligne, deux mots se recolleraient — c'est la
//  faute que `minifier-le-code.py` a déjà payée une fois. On compare
//  les deux textes, normalisés sur les blancs.
const deuxTextes = await p.evaluate(() => {
  const net = (t) => t.replace(/\s+/g, " ").trim();
  return {
    serre: net(document.querySelector('[data-m="serre"]').textContent),
    lisible: net(document.querySelector('[data-m="lisible"]').textContent),
  };
});
dire(
  "la version d'une ligne rend exactement le même texte",
  deuxTextes.serre === deuxTextes.lisible,
  `${deuxTextes.serre.length} caractères`,
);

// ── 14 · LE CONTRASTE, DANS LES DEUX THÈMES ─────────────────────────
//
//  Un rapport ne se calcule pas sur la couleur d'un jeton : il se
//  mesure sur le fond CALCULÉ, en remontant jusqu'au premier ancêtre
//  opaque. C'est la mesure qui m'a déjà menti une fois sur le fil
//  d'Ariane, en ignorant une image de fond — ici il n'y en a aucune.
const mesurer = () =>
  p.evaluate(() => {
    const lin = (c) => (c /= 255, c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
    const comp = (t) => (t.match(/[\d.]+/g) || []).slice(0, 3).map(Number);
    const lum = (t) => {
      const [r, g, b] = comp(t);
      return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
    };
    const opaque = (el) => {
      for (let n = el; n; n = n.parentElement) {
        const f = getComputedStyle(n).backgroundColor;
        const a = (f.match(/[\d.]+/g) || [])[3];
        if (f !== "transparent" && a !== "0") return f;
      }
      return "rgb(255, 255, 255)";
    };
    const rap = (a, b) => {
      const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
      return Math.round(((hi + 0.05) / (lo + 0.05)) * 100) / 100;
    };
    const faibles = [];
    const clairs = [];
    let combien = 0;
    for (const el of document.querySelectorAll('[data-m="serre"] *')) {
      const direct = [...el.childNodes].some((n) =>
        n.nodeType === 3 && n.textContent.trim() !== ""
      );
      const s = getComputedStyle(el);
      if (!/rgba\(0, 0, 0, 0\)/.test(s.backgroundColor) && lum(s.backgroundColor) > 0.35) {
        clairs.push(el.className + " → " + s.backgroundColor);
      }
      if (!direct) continue;
      combien += 1;
      const r = rap(s.color, opaque(el));
      if (r < 4.5) faibles.push(`${el.className || el.tagName} ${r}`);
    }
    return { faibles, clairs: [...new Set(clairs)], combien };
  });

const clair = await mesurer();
dire(
  `les ${clair.combien} textes de la carte tiennent les 4,5 en clair`,
  clair.faibles.length === 0,
  clair.faibles.join(" · "),
);

await p.evaluate(() => document.body.classList.add("wm-sombre"));
await p.waitForTimeout(150);
const sombre = await mesurer();
dire(
  `les ${sombre.combien} textes de la carte tiennent les 4,5 en sombre`,
  sombre.faibles.length === 0,
  sombre.faibles.join(" · "),
);
dire("EN SOMBRE, AUCUNE PLAQUE CLAIRE", sombre.clairs.length === 0, sombre.clairs.join(" · "));

for (const s of soucis) {
  fautes += 1;
  console.log("   ✗ " + s);
}

console.log(
  "\n" + (fautes === 0 ? "TOUT PASSE." : `${fautes} défaut(s).`) +
    `  ${serre.length} caractères pour le message.`,
);
await nav.close();
Deno.exit(fautes === 0 ? 0 : 1);
