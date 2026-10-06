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
import { readFileSync } from 'node:fs';
import { chromium } from 'npm:playwright@1.49.1';

//  Le Chromium du bac à sable n'a pas toujours le numéro que Playwright
//  attend. On prend celui qui est là plutôt que d'en télécharger un.
const CHROME = [
  '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  '/opt/pw-browsers/chromium/chrome-linux64/chrome',
].find((c) => { try { readFileSync(c); return true; } catch { return false; } });

//  La racine du dépôt : ce fichier est dans `outils/`.
const R = new URL('..', import.meta.url).pathname;
const cible = process.argv[2];
if (cible === undefined) {
  console.error('Usage : node outils/contraste.mjs pages/<une-page>.html');
  process.exit(2);
}
const doc = `<!doctype html><html lang="fr"><head><meta charset="utf-8">
<style>${readFileSync(R + 'panneau-admin/jetons.css', 'utf8')}</style>
<style>${readFileSync(R + 'css/wild-mystery.css', 'utf8')}</style>
<style>body{font-size:10px;margin:0;background:var(--wm-fond-page,#f2e4d8)}
#modernbb{padding:24px}</style></head>
<body><div id="modernbb"><div id="page-body">${readFileSync(R + cible, 'utf8')}</div></div></body></html>`;

const navigateur = await chromium.launch(
  CHROME === undefined ? {} : { executablePath: CHROME },
);
const p = await navigateur.newPage({ viewport: { width: 1280, height: 1400 } });
await p.setContent(doc);

// Le sommaire, pose par le vrai module : on ne mesure pas un balisage
// qu'on aurait recopie a la main dans le harnais.
await p.addScriptTag({ path: R + 'js/harnais-sommaire.js' });
await p.evaluate((d) => globalThis.wmPoserLeSommaire(d), JSON.parse(readFileSync(R + 'data/annexes.json', 'utf8')));

const mesurer = async (theme) => {
  await p.evaluate((t) => document.body.classList.toggle('wm-sombre', t === 'sombre'), theme);
  return await p.evaluate(() => {
    const canal = (s) => {
      // rgb()/rgba() rend des 0-255 ; color(srgb ...) rend des 0-1.
      const n = s.match(/-?\d*\.?\d+(?:e-?\d+)?/g)?.map(Number) ?? [];
      if (n.length < 3) return null;
      const srgb = /^color\(/.test(s);
      const alpha = s.includes('/') ? (n[3] ?? 1) : (n.length > 3 ? n[3] : 1);
      return { rgb: srgb ? n.slice(0, 3).map((v) => v * 255) : n.slice(0, 3), alpha };
    };
    const lum = (c) =>
      0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]);
    function f(v) { const s = v / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; }
    const sur = (dessus, dessous, a) => dessus.map((v, i) => v * a + dessous[i] * (1 - a));

    // Le fond REEL : on empile les fonds translucides au lieu de les
    // sauter, du plus profond au plus proche.
    const fond = (el) => {
      const pile = [];
      for (let n = el; n && n !== document.documentElement; n = n.parentElement) {
        const c = canal(getComputedStyle(n).backgroundColor);
        if (c && c.alpha > 0) pile.push(c);
      }
      let base = [255, 255, 255];
      for (const c of pile.reverse()) base = sur(c.rgb, base, c.alpha);
      return base;
    };

    const res = [];
    for (const el of document.querySelectorAll('#modernbb *')) {
      if (![...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim() !== '')) continue;
      const st = getComputedStyle(el);
      if (st.display === 'none' || st.visibility === 'hidden') continue;
      const t = canal(st.color);
      if (t === null) continue;
      let o = 1;
      for (let n = el; n && n !== document.documentElement; n = n.parentElement) {
        o *= Number(getComputedStyle(n).opacity);
      }
      if (o === 0) continue;
      const fo = fond(el);
      const texte = sur(t.rgb, fo, t.alpha * o);
      const a = lum(texte), b = lum(fo);
      const ratio = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
      const px = parseFloat(st.fontSize), gras = Number(st.fontWeight) >= 700;
      const seuil = (px >= 24 || (px >= 18.66 && gras)) ? 3 : 4.5;
      res.push({
        classe: el.className || el.tagName, px, ratio: Math.round(ratio * 100) / 100, seuil,
        ok: ratio >= seuil, mot: el.textContent.replace(/\s+/g, ' ').trim().slice(0, 44),
      });
    }
    return res;
  });
};

let fautes = 0;
for (const theme of ['clair', 'sombre']) {
  const r = await mesurer(theme);
  const rates = r.filter((x) => !x.ok);
  fautes += rates.length;
  console.log(`${theme} : ${r.length} textes mesures, ${rates.length} defaut(s) de contraste`);
  for (const x of rates) {
    console.log(`   ${x.ratio} < ${x.seuil}  ${x.px}px  .${x.classe}  « ${x.mot} »`);
  }
}
console.log('entrees de sommaire posees :', await p.evaluate(() => document.querySelectorAll('.wm-annexe__entree').length));
console.log('dont sans lien (a venir) :', await p.evaluate(() => document.querySelectorAll('.wm-annexe__entree--a-venir').length));
console.log('dont des liens :', await p.evaluate(() => document.querySelectorAll('a.wm-annexe__lien').length));
for (const l of [1280, 900, 520, 390]) {
  await p.setViewportSize({ width: l, height: 900 });
  const trop = await p.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  console.log(`${l}px : debordement horizontal ${trop ? 'OUI — defaut' : 'non'}`);
  if (trop) fautes++;
}
await navigateur.close();
process.exit(fautes === 0 ? 0 : 1);
