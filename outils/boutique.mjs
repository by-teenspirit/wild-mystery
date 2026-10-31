// ════════════════════════════════════════════════════════════════════
//  outils/boutique.mjs
//
//  POURQUOI CE HARNAIS EXISTE. `module-boutique.ts` était, le
//  15 octobre, le DERNIER module d'interface du dépôt que ni test ni
//  harnais ne montait — la dette que le garde-fou n° 22 comptait. La
//  barre d'actions était dans le même cas la veille, et ça avait coûté
//  un bouton muet sur le forum : Callista a cliqué, rien ne s'est passé,
//  et aucun test ne le voyait.
//
//  LE CATALOGUE N'EST PAS INVENTÉ. Il est produit par
//  `python3 outils/objets.py --forum`, exactement comme celui que
//  Callista a collé dans son sujet : trente-quatre objets, leurs prix,
//  et `data-wm-objet` sur chaque ligne. Un balisage inventé testerait un
//  module contre une idée du balisage.
//
//  CE QU'IL MESURE, et c'est la demande du 15 octobre : « je n'aime pas
//  le fait que ça ajoute une balise dans mon texte […] pareil pour le
//  panier. » Donc **un clic sur « + » ne doit rien écrire**, et le bloc
//  doit partir au bon moment, une seule fois.
//
//  Lancé par `deno task boutique`.
// ════════════════════════════════════════════════════════════════════

import { chromium } from "npm:playwright@1.49.1";
import { readFileSync } from "node:fs";

const R = new URL("..", import.meta.url).pathname;
const CHROME = [
  "/opt/pw-browsers/chromium",
  "/opt/pw-browsers/chromium-1140/chrome-linux/chrome",
].find((c) => {
  try {
    readFileSync(c);
    return true;
  } catch {
    return false;
  }
});

//  LE VRAI CATALOGUE, par le vrai générateur. S'il ne tourne pas, le
//  harnais s'arrête : servir un catalogue de repli reviendrait à mesurer
//  autre chose que ce qui est en ligne.
const sorti = new Deno.Command("python3", {
  args: [R + "outils/objets.py", "--forum"],
  stdout: "piped",
  stderr: "piped",
}).outputSync();
if (!sorti.success) {
  console.log("outils/objets.py --forum a échoué :");
  console.log(new TextDecoder().decode(sorti.stderr));
  Deno.exit(1);
}
const CATALOGUE = new TextDecoder().decode(sorti.stdout);

//  LE FORMULAIRE DE RÉPONSE RAPIDE, relevé sur le sujet 976 le
//  2 octobre (voir l'en-tête de `adaptateurs/navigateur/editeur.ts`) :
//  `#text_editor_textarea` visible, SANS instance sceditor — le repli
//  est le cas courant, et c'est celui que les joueurs ont.
const page = (avecFormulaire = true) =>
  `<!doctype html><html lang="fr"><head><meta charset="utf-8">
<style>html,body{margin:0;min-height:100%}</style>
<style>${readFileSync(R + "panneau-admin/jetons.css", "utf8")}</style>
<style>${readFileSync(R + "css/wild-mystery.css", "utf8")}</style>
<style>${readFileSync(R + "data/fam-base.css", "utf8")}</style>
</head>
<body id="modernbb">
<div class="conteneur_minwidth_IE modern-resp">
<div class="sub-header"><div class="sub-header-info">
  <h1 class="page-title"><a href="/t977-la-boutique">La Boutique</a></h1>
  <div class="sub-header-path">
    <a class="nav" href="/forum"><span>Wild Mystery</span></a>
    <strong>&raquo;</strong> <a class="nav" href="/f106-gestion">Gestion</a>
  </div>
</div></div>
<div id="page-body">
  <div class="post post--16001"><div class="postbody"><div class="content">
${CATALOGUE}
  </div></div></div>
${
    avecFormulaire
      ? `<a name="quickreply"></a>
<form action="/post" method="post" name="post" id="quick_reply">
  <div id="textarea_content">
    <textarea id="text_editor_textarea" name="message" rows="6" cols="80"></textarea>
  </div>
  <input type="submit" name="post" value="Envoyer" />
  <input type="submit" name="preview" value="Prévisualisation" />
</form>`
      : "<!-- visiteur déconnecté : pas de formulaire -->"
  }
</div>
</div>
</body></html>`;

const nav = await chromium.launch(CHROME === undefined ? {} : { executablePath: CHROME });
const soucis = [];

function dire(nom, ok, detail = "") {
  console.log(`  ${ok ? "ok  " : "DÉFAUT"} ${nom}${detail === "" ? "" : " — " + detail}`);
  if (!ok) soucis.push(nom + (detail === "" ? "" : " — " + detail));
}

async function monter({ avecFormulaire = true, largeur = 1440 } = {}) {
  const p = await nav.newPage({ viewport: { width: largeur, height: 900 } });
  p.on("pageerror", (e) => soucis.push("erreur JS : " + e.message));
  await p.route("**/*", (r) => {
    const u = new URL(r.request().url()).pathname;
    //  LE SWITCHEROO EST SERVI VIDE. Depuis le 31 octobre il se charge
    //  aussi pour une visiteuse déconnectée, donc ces deux scripts
    //  partent sur toutes les pages. Sans route, le serveur du harnais
    //  rendait la page HTML en réponse et le navigateur essayait de
    //  l'exécuter : « Unexpected token < ». Seul `navigation.mjs`
    //  charge le vrai switcheroo, depuis sa source.
    if (/(monomer|switcheroo)\.js/.test(u)) {
      return r.fulfill({ contentType: "text/javascript", body: "" });
    }
    if (u === "/js/wild-mystery.js") {
      return r.fulfill({
        contentType: "text/javascript",
        body: readFileSync(R + "js/wild-mystery.js", "utf8"),
      });
    }
    if (u.startsWith("/data/")) {
      try {
        return r.fulfill({
          contentType: "application/json",
          body: readFileSync(R + u.slice(1), "utf8"),
        });
      } catch {
        return r.fulfill({ status: 404, body: "" });
      }
    }
    return r.fulfill({
      contentType: "text/html; charset=utf-8",
      body: page(avecFormulaire),
    });
  });
  await p.goto("http://wild-mystery.test/t977-la-boutique");
  await p.addScriptTag({ url: "http://wild-mystery.test/js/wild-mystery.js" });
  //  On laisse notre écouteur d'envoi tourner — il est en capture, donc
  //  il passe avant — puis on arrête la navigation : c'est la seule
  //  façon de LIRE ce qui serait parti.
  await p.evaluate(() => {
    globalThis.addEventListener("submit", (e) => e.preventDefault(), { capture: false });
  });
  await p.waitForTimeout(400);
  return p;
}

const lire = (p) => p.evaluate(() => document.querySelector("#text_editor_textarea").value);
/** Clique `n` fois sur le « + » (ou le « − ») de l'objet donné. */
const pas = (p, objetId, signe, n = 1) =>
  p.evaluate(([id, s, combien]) => {
    const li = document.querySelector(`li[data-wm-objet="${id}"]`);
    if (li === null) throw new Error("pas de ligne " + id);
    const b = [...li.querySelectorAll(".wm-boutique__pas")].find((x) =>
      x.textContent.trim() === s
    );
    if (b === undefined) throw new Error("pas de bouton " + s);
    for (let i = 0; i < combien; i++) b.click();
  }, [objetId, signe, n]);
const commander = (p) =>
  p.evaluate(() => document.querySelector(".wm-boutique__valider").click());
const envoyer = (p, nom = "post") =>
  p.evaluate((n) => document.querySelector(`input[name="${n}"]`).click(), nom);
const bouton = (p) =>
  p.evaluate(() => {
    const b = document.querySelector(".wm-boutique__valider");
    return { libelle: b.textContent.trim(), eteint: b.disabled };
  });

const BALL = 990001; // Poké Ball, 200 ₽
const POTION = 990020; // Potion, 300 ₽

// ── 1 · le catalogue est reconnu et équipé ──────────────────────────
console.log("\n── LA BOUTIQUE SE RECONNAÎT À SON BALISAGE ────────────");
let p = await monter();
const pose = await p.evaluate(() => {
  const bloc = document.querySelector(".wm-boutique");
  if (bloc === null) return null;
  return {
    lignes: document.querySelectorAll(".wm-boutique li[data-wm-objet]").length,
    paires: document.querySelectorAll(".wm-boutique__pas").length,
    comptes: document.querySelectorAll(".wm-boutique__compte").length,
    barre: bloc.querySelector(".wm-boutique__barre") !== null,
    //  La barre est la DERNIÈRE chose du bloc : après le catalogue, pas
    //  au milieu.
    barreALaFin: bloc.lastElementChild?.className === "wm-boutique__barre",
    note: bloc.querySelector(".wm-boutique__note")?.textContent.trim() ?? "",
  };
});
dire("le bloc est équipé", pose !== null);
dire(
  "TRENTE-QUATRE LIGNES, SOIXANTE-HUIT BOUTONS",
  pose?.lignes === 34 && pose?.paires === 68,
  JSON.stringify({ lignes: pose?.lignes, boutons: pose?.paires }),
);
dire("un compteur par ligne", pose?.comptes === 34, `${pose?.comptes}`);
dire("la barre de validation est à la fin du bloc", pose?.barreALaFin === true);
dire(
  "et la note dit que rien ne part sans le joueur",
  pose?.note.includes("Rien ne part sans toi"),
  pose?.note,
);

// ── 2 · LA DEMANDE DU 15 OCTOBRE ───────────────────────────────────
console.log("\n── UN « + » NE TOUCHE PAS AU MESSAGE ──────────────────");
await p.evaluate(() => {
  const c = document.querySelector("#text_editor_textarea");
  c.value = "Bonjour, je voudrais ceci.";
  c.dispatchEvent(new Event("input", { bubbles: true }));
});
await pas(p, BALL, "+", 3);
await pas(p, POTION, "+", 2);
const apresClics = await lire(p);
dire(
  "CINQ CLICS, ET LE TEXTE EST INTACT — c'est ce qu'elle a demandé",
  apresClics === "Bonjour, je voudrais ceci.",
  JSON.stringify(apresClics),
);
const vu = await p.evaluate(() => {
  const compte = (id) =>
    document.querySelector(`li[data-wm-objet="${id}"] .wm-boutique__compte`).textContent.trim();
  const pris = (id) =>
    document.querySelector(`li[data-wm-objet="${id}"]`).classList.contains(
      "wm-boutique__article--pris",
    );
  return {
    ball: compte(990001),
    potion: compte(990020),
    ballPrise: pris(990001),
    hyperPrise: pris(990003),
    titre: document.querySelector('li[data-wm-objet="990001"] .wm-boutique__compte').title,
  };
});
dire(
  "mais le panier se voit DANS LA PAGE : compteurs et lignes prises",
  vu.ball === "3" && vu.potion === "2" && vu.ballPrise && !vu.hyperPrise,
  JSON.stringify(vu),
);
dire(
  "le sous-total est en infobulle à partir de deux",
  vu.titre === "600 ₽",
  JSON.stringify(vu.titre),
);
const b1 = await bouton(p);
dire(
  "et le bouton annonce le total",
  b1.libelle === "Commander — 5 articles, 1 200 ₽" && !b1.eteint,
  JSON.stringify(b1),
);

// ── 3 · « Commander » écrit, une fois ──────────────────────────────
console.log("\n── « COMMANDER » ÉCRIT LE BLOC, UNE SEULE FOIS ────────");
await commander(p);
const apresCommande = await lire(p);
dire(
  "le bloc arrive après le texte du joueur",
  apresCommande.startsWith("Bonjour, je voudrais ceci.") && apresCommande.includes("WM-PANIER"),
  JSON.stringify(apresCommande),
);
await commander(p);
await commander(p);
const troisFois = await lire(p);
dire(
  "trois clics ne font pas trois blocs",
  (troisFois.match(/WM-PANIER/g) ?? []).length === 1,
  JSON.stringify(troisFois),
);

// ── 4 · le panier vidé ─────────────────────────────────────────────
console.log("\n── VIDER LE PANIER ────────────────────────────────────");
p = await monter();
await pas(p, BALL, "+", 2);
await pas(p, BALL, "−", 2);
const vide = await bouton(p);
dire(
  "à zéro, le bouton s'éteint et le dit",
  vide.eteint === true && vide.libelle === "Panier vide",
  JSON.stringify(vide),
);
dire(
  "et il reste VISIBLE, pas caché",
  await p.evaluate(() => {
    const b = document.querySelector(".wm-boutique__valider");
    return b.getClientRects().length > 0 && getComputedStyle(b).display !== "none";
  }),
);
await commander(p);
dire(
  "cliquer un bouton éteint n'écrit rien",
  (await lire(p)) === "",
  JSON.stringify(await lire(p)),
);

// ── 5 · LE CAS QUI COÛTERAIT UNE COMMANDE ──────────────────────────
console.log("\n── ENVOYER SANS AVOIR CLIQUÉ « COMMANDER » ────────────");
p = await monter();
await p.evaluate(() => {
  const c = document.querySelector("#text_editor_textarea");
  c.value = "Je prends ça.";
  c.dispatchEvent(new Event("input", { bubbles: true }));
});
await pas(p, POTION, "+", 1);
dire("avant l'envoi, le texte est celui du joueur", !(await lire(p)).includes("WM-PANIER"));
await envoyer(p);
const parti = await lire(p);
dire(
  "À L'ENVOI, LE PANIER PART QUAND MÊME — sinon la commande est perdue",
  parti.startsWith("Je prends ça.") && parti.includes("WM-PANIER"),
  JSON.stringify(parti),
);
dire(
  "et une seule fois",
  (parti.match(/WM-PANIER/g) ?? []).length === 1,
  JSON.stringify(parti),
);

p = await monter();
await p.evaluate(() => {
  const c = document.querySelector("#text_editor_textarea");
  c.value = "Juste un mot, je n'achète rien.";
  c.dispatchEvent(new Event("input", { bubbles: true }));
});
await envoyer(p);
dire(
  "PANIER VIDE : on n'écrit RIEN à l'envoi",
  (await lire(p)) === "Juste un mot, je n'achète rien.",
  JSON.stringify(await lire(p)),
);

// ── 6 · sans formulaire, le catalogue reste lisible ────────────────
console.log("\n── VISITEUR DÉCONNECTÉ ────────────────────────────────");
const seul = await monter({ avecFormulaire: false });
const sans = await seul.evaluate(() => ({
  boutons: document.querySelectorAll(".wm-boutique__pas").length,
  barre: document.querySelector(".wm-boutique__barre") !== null,
  lignes: document.querySelectorAll(".wm-boutique li[data-wm-objet]").length,
  prix: document.querySelector(".wm-boutique__prix")?.textContent.trim(),
}));
dire(
  "PAS DE FORMULAIRE, PAS DE BOUTONS — et le catalogue est entier",
  sans.boutons === 0 && sans.barre === false && sans.lignes === 34 && sans.prix === "200 ₽",
  JSON.stringify(sans),
);
await seul.close();

// ── 7 · ce que ça donne à l'œil ────────────────────────────────────
console.log("\n── CE QUE ÇA DONNE À L'ŒIL ────────────────────────────");
p = await monter();
await pas(p, BALL, "+", 1);
const oeil = await p.evaluate(() => {
  const r = (s) => {
    const e = document.querySelector(s);
    if (e === null) return null;
    const b = e.getBoundingClientRect();
    return {
      x: Math.round(b.left),
      d: Math.round(b.right),
      h: Math.round(b.height),
      l: Math.round(b.width),
    };
  };
  const voie = (t) => (t.match(/-?\d*\.?\d+/g) ?? []).map(Number);
  const lum = (c) => {
    const [r1, g, b] = voie(c).slice(0, 3).map((v) => {
      const x = v / 255;
      return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r1 + 0.7152 * g + 0.0722 * b;
  };
  const rapport = (a, b) => {
    const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m);
    return Math.round(((x + 0.05) / (y + 0.05)) * 100) / 100;
  };
  const fond = (e) => {
    for (let n = e; n !== null; n = n.parentElement) {
      const c = getComputedStyle(n).backgroundColor;
      if (c !== "rgba(0, 0, 0, 0)" && c !== "transparent") return c;
    }
    return "rgb(255, 255, 255)";
  };
  const li = document.querySelector('li[data-wm-objet="990001"]');
  const pasBouton = li.querySelector(".wm-boutique__pas");
  return {
    pas: r(".wm-boutique__pas"),
    valider: r(".wm-boutique__valider"),
    bloc: r(".wm-boutique"),
    //  LES COMMANDES SONT À GAUCHE DU NOM (`order: -1`) : on les cherche
    //  au même endroit sur les trente-quatre lignes.
    commandesAvantLeNom: pasBouton.getBoundingClientRect().left <
      li.querySelector(".wm-boutique__nom").getBoundingClientRect().left,
    contrastes: [
      ["pas", rapport(getComputedStyle(pasBouton).color, fond(pasBouton))],
      [
        "nom",
        rapport(
          getComputedStyle(li.querySelector(".wm-boutique__nom")).color,
          fond(li),
        ),
      ],
      [
        "prix",
        rapport(
          getComputedStyle(li.querySelector(".wm-boutique__prix")).color,
          fond(li),
        ),
      ],
      [
        "compte",
        rapport(
          getComputedStyle(li.querySelector(".wm-boutique__compte")).color,
          fond(li),
        ),
      ],
      [
        "note",
        rapport(
          getComputedStyle(document.querySelector(".wm-boutique__note")).color,
          fond(document.querySelector(".wm-boutique__note")),
        ),
      ],
    ],
  };
});
//  32 ET PAS 44, et c'est un arbitrage assumé : il y a soixante-huit de
//  ces boutons sur la page, et la cible tactile de 44 px tenue partout
//  ailleurs ferait du catalogue une colonne de boutons. Le commentaire
//  de `css/09-boutique.css` annonçait 44 alors que la feuille donne 32 —
//  il a été corrigé le 16 octobre, pas la cote.
dire(
  "LES PAS FONT 32 PX, l'arbitrage assumé de la feuille",
  oeil.pas.h === 32 && oeil.pas.l === 32,
  JSON.stringify(oeil.pas),
);
dire(
  "le bouton « Commander » garde ses 44",
  oeil.valider.h >= 44,
  JSON.stringify(oeil.valider),
);
dire("les commandes sont à gauche du nom", oeil.commandesAvantLeNom === true);
dire(
  "tout tient dans le bloc",
  oeil.valider.d <= oeil.bloc.d && oeil.pas.x >= oeil.bloc.x,
  JSON.stringify({
    valider: oeil.valider.d,
    pas: oeil.pas.x,
    bloc: [oeil.bloc.x, oeil.bloc.d],
  }),
);
for (const [quoi, r] of oeil.contrastes) {
  dire(`${quoi} : ${r} contre son fond`, r >= 4.5, `${r}`);
}

//  EN THÈME SOMBRE : `body.wm-sombre`, et pas `data-wm-theme` — cet
//  attribut n'est un sélecteur nulle part, et le harnais du messenger a
//  mesuré le thème clair pendant deux semaines en croyant l'inverse.
await p.evaluate(() => document.body.classList.add("wm-sombre"));
await p.waitForTimeout(120);
const sombre = await p.evaluate(() => {
  const voie = (t) => (t.match(/-?\d*\.?\d+/g) ?? []).map(Number);
  const lum = (c) => {
    const [r1, g, b] = voie(c).slice(0, 3).map((v) => {
      const x = v / 255;
      return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r1 + 0.7152 * g + 0.0722 * b;
  };
  const rapport = (a, b) => {
    const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m);
    return Math.round(((x + 0.05) / (y + 0.05)) * 100) / 100;
  };
  const fond = (e) => {
    for (let n = e; n !== null; n = n.parentElement) {
      const c = getComputedStyle(n).backgroundColor;
      if (c !== "rgba(0, 0, 0, 0)" && c !== "transparent") return c;
    }
    return "rgb(0, 0, 0)";
  };
  return [
    ".wm-boutique__pas",
    ".wm-boutique__nom",
    ".wm-boutique__prix",
    ".wm-boutique__valider",
    ".wm-boutique__note",
  ].map((s) => {
    const e = document.querySelector(s);
    return [s.replace(".wm-boutique__", ""), rapport(getComputedStyle(e).color, fond(e))];
  });
});
for (const [quoi, r] of sombre) {
  dire(`sombre · ${quoi} : ${r} contre son fond`, r >= 4.5, `${r}`);
}
await p.close();

//  ── À 360 DE LARGE ────────────────────────────────────────────────
const etroit = await monter({ largeur: 360 });
const serre = await etroit.evaluate(() => {
  const li = document.querySelector('li[data-wm-objet="990001"]');
  const r = (e) => {
    const b = e.getBoundingClientRect();
    return { x: Math.round(b.left), d: Math.round(b.right), h: Math.round(b.height) };
  };
  return {
    pas: r(li.querySelector(".wm-boutique__pas")),
    nom: r(li.querySelector(".wm-boutique__nom")),
    valider: r(document.querySelector(".wm-boutique__valider")),
    ligne: r(li),
    bloc: r(document.querySelector(".wm-boutique")),
  };
});
//  ON MESURE LE BLOC, PAS LA PAGE. Première version : « la page ne
//  déborde pas à 360 ». Elle gueulait à 620 — et le coupable n'est ni
//  notre feuille ni la boutique : en servant la même page SANS
//  `data/fam-base.css`, la largeur retombe à 360 pile. C'est le greffon
//  FAM qui impose un minimum, et « on touche à rien pour la version
//  mobile » (Callista, le 15 octobre). Une assertion sur la largeur de
//  la page mesurait donc le tiroir de quelqu'un d'autre.
dire(
  "À 360, LES PAS GARDENT LEUR TAILLE et la ligne tient dans le bloc",
  serre.pas.h === 32 && serre.ligne.d <= serre.bloc.d && serre.valider.d <= serre.bloc.d,
  JSON.stringify(serre),
);
await etroit.close();

await nav.close();
console.log(soucis.length === 0 ? "\nTOUT PASSE." : `\n${soucis.length} DÉFAUT(S).`);
for (const s of soucis) console.log("  · " + s);
if (soucis.length > 0) Deno.exit(1);
