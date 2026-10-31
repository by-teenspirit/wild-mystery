// ════════════════════════════════════════════════════════════════════
//  outils/barre.mjs
//
//  POURQUOI CE HARNAIS EXISTE, ET CE QU'IL A COÛTÉ DE NE PAS L'AVOIR.
//
//  Le 15 octobre, Callista a essayé la barre sur `t996` : « j'ai testé
//  l'option "chercher", mais ça fait rien. » Elle avait raison, et
//  AUCUN test ne le voyait. La raison est simple et elle est générale :
//  `barre-d-actions.ts` était le seul module d'interface du dépôt que
//  ni un test unitaire ni un harnais ne montait. Ce qu'il écrit au
//  texte était testé (`navigateur/redaction.ts`, sans navigateur) ;
//  ce que les contrôles FONT quand on clique dessus, non.
//
//  LA RÈGLE QU'IL MESURE, et pas le défaut qu'il a laissé passer :
//  **chaque contrôle que la barre pose doit changer quelque chose.** Le
//  menu « Où » n'en changeait aucun — il avait l'air d'agir, et le
//  commentaire au-dessus expliquait pourquoi c'était normal. Un harnais
//  qui aurait cherché « un menu nommé wm-lieu » n'aurait attrapé que
//  celui-là ; celui-ci énumère les contrôles et exige que chacun ait un
//  effet.
//
//  CE QU'IL MONTE : une page de sujet d'une zone sauvage (`f9`), le
//  vrai paquet livré (`js/wild-mystery.js`), les jetons, notre feuille
//  et celle de FAM dans l'ordre réel. Pas de faux module : c'est le
//  script du forum qui pose la barre, comme chez elle.
//
//  LE BALISAGE DU FORMULAIRE vient de `templates/posting_body.html` et
//  de ce qui a été relevé sur la réponse rapide du sujet 976 le
//  2 octobre (voir l'en-tête de `editeur.ts`) : `#text_editor_textarea`
//  visible, SANS instance sceditor. On ne monte pas sceditor ici — le
//  repli est le cas courant, et c'est celui que les joueurs ont.
//
//  Lancé par `deno task barre`.
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

const BLOC = "[[WM-ACTION";

//  LE CHEMIN DE NAVIGATION : c'est LUI qui dit dans quel forum on est
//  (`forumDeLaPage` lit le dernier `/f<n>-` du fil d'Ariane). Sans lui,
//  la barre ne se pose pas du tout — et un harnais qui l'oublierait
//  mesurerait une page vide en croyant mesurer une barre.
const chemin = (forum) => `
<div class="sub-header">
  <div class="sub-header-info">
    <h1 class="page-title"><a href="/t996-test">Test</a></h1>
    <div class="sub-header-path">
      <a class="nav" href="/forum"><span>Wild Mystery</span></a>
      <strong>&raquo;</strong> <a class="nav" href="/f96-zones-palier-1">Zones Palier 1</a>
      <strong>&raquo;</strong> <a class="nav" href="/${forum}">Ici</a>
    </div>
  </div>
</div>`;

/** Le formulaire de réponse. `quick` sert la réponse RAPIDE du bas de
 *  sujet (`#quick_reply`), l'autre la page de réponse complète
 *  (`form[name=post]`) — celle par laquelle passe la prévisualisation.
 *  Les deux existent sur le forum, et `wild-mystery.ts` accepte les
 *  deux ; le harnais doit donc les voir toutes les deux. */
const formulaire = (quick) =>
  quick
    ? `
<a name="quickreply"></a>
<form action="/post" method="post" name="post" id="quick_reply">
  <div id="textarea_content">
    <textarea id="text_editor_textarea" name="message" rows="6" cols="80"></textarea>
  </div>
  <input type="submit" name="post" value="Envoyer" />
  <input type="submit" name="preview" value="Prévisualisation" />
</form>`
    : `
<form action="/post" method="post" name="post" enctype="multipart/form-data">
  <div id="message-box">
    <div id="textarea_content">
      <textarea id="text_editor_textarea" name="message" rows="12" cols="80"></textarea>
    </div>
  </div>
  <input type="submit" name="preview" value="Prévisualisation" />
  <input type="submit" name="post" value="Envoyer" />
</form>`;

//  LE FORUM EST UN PARAMÈTRE, et pas un `replace` sur la page montée.
//  Première version : `page(true).replace("/f9-foret-marecageuse", "/f106-gestion")`.
//  Elle ne changeait rien, et le cas « ailleurs qu'une zone » passait
//  pour un défaut de la barre : **notre propre feuille cite ce lien dans
//  un commentaire**, plus haut dans le document, et c'est lui que le
//  remplacement attrapait. Remplacer une chaîne dans un document entier
//  touche la première occurrence, pas celle qu'on visait.
const page = (quick, texte = "", forum = "f9-foret-marecageuse") =>
  `<!doctype html><html lang="fr"><head><meta charset="utf-8">
<style>html,body{margin:0;min-height:100%}</style>
<style>${readFileSync(R + "panneau-admin/jetons.css", "utf8")}</style>
<style>${readFileSync(R + "css/wild-mystery.css", "utf8")}</style>
<!-- FAM injecte sa feuille au démarrage, donc APRÈS la nôtre : c'est
     l'ordre réel, et c'est la leçon du harnais du messenger. -->
<style>${readFileSync(R + "data/fam-base.css", "utf8")}</style>
</head>
<body id="modernbb">
<div class="conteneur_minwidth_IE modern-resp">
${chemin(forum)}
<div id="page-body">
  <div class="post post--15552"><div class="postbody"><div class="content">Un message de RP.</div></div></div>
  ${formulaire(quick).replace("></textarea>", `>${texte}</textarea>`)}
</div>
</div>
</body></html>`;

const nav = await chromium.launch(CHROME === undefined ? {} : { executablePath: CHROME });
const soucis = [];

function dire(nom, ok, detail = "") {
  console.log(`  ${ok ? "ok  " : "DÉFAUT"} ${nom}${detail === "" ? "" : " — " + detail}`);
  if (!ok) soucis.push(nom + (detail === "" ? "" : " — " + detail));
}

/** Une page montée, script compris, prête à cliquer. */
async function monter({ quick = true, texte = "", largeur = 1440, forum } = {}) {
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
      body: page(quick, texte, forum),
    });
  });
  await p.goto("http://wild-mystery.test/t996-test");
  await p.addScriptTag({ url: "http://wild-mystery.test/js/wild-mystery.js" });
  //  LE FORMULAIRE N'ENVOIE RIEN. On laisse notre écouteur tourner — il
  //  est en capture, donc il passe avant —, puis on arrête la
  //  navigation : c'est la seule façon de LIRE ce qui serait parti.
  await p.evaluate(() => {
    globalThis.addEventListener("submit", (e) => e.preventDefault(), { capture: false });
  });
  await p.waitForTimeout(400);
  return p;
}

const lire = (p) => p.evaluate(() => document.querySelector("#text_editor_textarea").value);
const clic = (p, libelle) =>
  p.evaluate((l) => {
    const b = [...document.querySelectorAll(".wm-barre__bouton")].find((x) =>
      x.textContent.trim() === l
    );
    if (b === null || b === undefined) throw new Error("pas de bouton « " + l + " »");
    b.click();
  }, libelle);
const envoyer = (p, nom = "post") =>
  p.evaluate((n) => document.querySelector(`input[name="${n}"]`).click(), nom);

const APPARAITRE = "Faire apparaître un Pokémon";
const FOUILLER = "Fouiller la zone";
const CLOTURER = "Clôturer le sujet";

// ── 1 · la barre est là, et elle n'a que ce qu'il faut ──────────────
console.log("\n── LA BARRE SE POSE DANS UNE ZONE ─────────────────────");
let p = await monter();
const pose = await p.evaluate(() => {
  const barre = document.querySelector(".wm-barre");
  if (barre === null) return null;
  return {
    entete: barre.querySelector(".wm-barre__entete")?.textContent.trim(),
    boutons: [...barre.querySelectorAll("button")].map((b) => b.textContent.trim()),
    //  TOUT contrôle, pas seulement les boutons : c'est ce que le menu
    //  « Où » était.
    controles: barre.querySelectorAll("button, select, input, textarea, a").length,
    apresLeFormulaire: barre.previousElementSibling?.id === "quick_reply",
    note: barre.querySelector(".wm-barre__note")?.textContent.trim(),
  };
});
dire("elle existe", pose !== null);
dire("son en-tête dit « Ton tour »", pose?.entete === "Ton tour", pose?.entete);
dire(
  "TROIS BOUTONS, dans les mots de Callista",
  JSON.stringify(pose?.boutons) === JSON.stringify([APPARAITRE, FOUILLER, CLOTURER]),
  JSON.stringify(pose?.boutons),
);
dire(
  "et AUCUN autre contrôle — plus de menu, plus d'étiquette",
  pose?.controles === 3,
  `${pose?.controles} contrôles`,
);
dire("elle se pose après le formulaire", pose?.apresLeFormulaire === true);
dire(
  "au départ, la phrase dit que rien ne partira",
  pose?.note?.startsWith("Si tu ne cliques sur rien"),
  pose?.note,
);

// ── 2 · LA RÈGLE GÉNÉRALE : chaque contrôle change quelque chose ────
//
//  C'est ce contrôle-là qui aurait attrapé le menu « Où ». Il ne nomme
//  aucun contrôle en particulier : il les énumère, les actionne un par
//  un, et exige qu'il se passe quelque chose de visible — dans le
//  texte, ou dans l'état de la barre.
console.log("\n── CHAQUE CONTRÔLE DE LA BARRE FAIT QUELQUE CHOSE ─────");
const muets = await p.evaluate(() => {
  const barre = document.querySelector(".wm-barre");
  const champ = document.querySelector("#text_editor_textarea");
  const empreinte = () =>
    champ.value + "|" +
    [...barre.querySelectorAll("button")].map((b) => b.getAttribute("aria-pressed")).join(",") +
    "|" + barre.querySelector(".wm-barre__note").textContent;

  const sansEffet = [];
  for (const c of barre.querySelectorAll("button, select, input, a")) {
    const avant = empreinte();
    if (c.tagName === "SELECT" && c.options.length > 1) {
      c.selectedIndex = c.selectedIndex === 0 ? 1 : 0;
      c.dispatchEvent(new Event("change", { bubbles: true }));
    } else {
      c.click();
    }
    if (empreinte() === avant) sansEffet.push(c.textContent.trim() || c.id || c.tagName);
    //  On remet l'état comme avant : ces contrôles basculent.
    if (c.tagName === "BUTTON") c.click();
  }
  return sansEffet;
});
dire(
  "AUCUN CONTRÔLE MUET — c'était le défaut du 15 octobre",
  muets.length === 0,
  muets.join(", "),
);

// ── 3 · les trois états, et la balise qui n'apparaît plus ───────────
console.log("\n── TROIS ÉTATS, SANS BALISE DANS LE TEXTE ─────────────");
await p.evaluate(() => {
  document.querySelector("#text_editor_textarea").value = "Elle avance prudemment.";
  document.querySelector("#text_editor_textarea").dispatchEvent(
    new Event("input", { bubbles: true }),
  );
});
await clic(p, APPARAITRE);
const apresClic = await lire(p);
dire(
  "UN CLIC N'ÉCRIT RIEN DANS LE MESSAGE — c'est ce qu'elle a demandé",
  apresClic === "Elle avance prudemment.",
  JSON.stringify(apresClic),
);
const etat = await p.evaluate(() => ({
  presse: [...document.querySelectorAll(".wm-barre__bouton")].map((b) =>
    b.getAttribute("aria-pressed")
  ),
  note: document.querySelector(".wm-barre__note").textContent.trim(),
}));
dire(
  "mais le bouton se voit enfoncé, et lui seul",
  JSON.stringify(etat.presse) === JSON.stringify(["true", "false", "false"]),
  JSON.stringify(etat.presse),
);
dire(
  "et la phrase dit ce qui va partir, en français",
  etat.note ===
    "Quand tu enverras ce message, tu fais apparaître un Pokémon. Reclique pour annuler.",
  etat.note,
);

await clic(p, FOUILLER);
const deux = await p.evaluate(() =>
  [...document.querySelectorAll(".wm-barre__bouton")].map((b) => b.getAttribute("aria-pressed"))
);
dire(
  "LES DEUX S'EXCLUENT : fouiller remplace, il n'ajoute pas",
  JSON.stringify(deux) === JSON.stringify(["false", "true", "false"]),
  JSON.stringify(deux),
);

await clic(p, FOUILLER);
const zero = await p.evaluate(() => ({
  presse: [...document.querySelectorAll(".wm-barre__bouton")].map((b) =>
    b.getAttribute("aria-pressed")
  ),
  note: document.querySelector(".wm-barre__note").textContent.trim(),
}));
dire(
  "LE MÊME BOUTON DEUX FOIS REVIENT À « JE NE FAIS RIEN »",
  JSON.stringify(zero.presse) === JSON.stringify(["false", "false", "false"]),
  JSON.stringify(zero.presse),
);
dire("et la phrase revient à son état de départ", zero.note.startsWith("Si tu ne cliques"));

// ── 4 · le bloc est écrit À L'ENVOI, et une seule fois ──────────────
console.log("\n── LE BLOC PART AVEC LE MESSAGE, PAS AVANT ────────────");
p = await monter();
await p.evaluate(() => {
  const c = document.querySelector("#text_editor_textarea");
  c.value = "Elle écarte les roseaux.";
  c.dispatchEvent(new Event("input", { bubbles: true }));
});
await clic(p, FOUILLER);
dire("avant l'envoi, le texte est celui du joueur", (await lire(p)).indexOf(BLOC) < 0);
await envoyer(p);
const parti = await lire(p);
dire(
  "À L'ENVOI, le bloc est à la fin du message",
  parti === "Elle écarte les roseaux.\n\n[[WM-ACTION:fouiller]]",
  JSON.stringify(parti),
);
await envoyer(p);
const deuxEnvois = await lire(p);
dire(
  "deux envois ne font pas deux blocs",
  (deuxEnvois.match(/\[\[WM-ACTION/g) ?? []).length === 1,
  JSON.stringify(deuxEnvois),
);

p = await monter();
await p.evaluate(() => {
  const c = document.querySelector("#text_editor_textarea");
  c.value = "Elle regarde le fleuve.";
  c.dispatchEvent(new Event("input", { bubbles: true }));
});
await envoyer(p);
dire(
  "SANS CLIC, on ne touche pas au message",
  (await lire(p)) === "Elle regarde le fleuve.",
  JSON.stringify(await lire(p)),
);

// ── 5 · la prévisualisation ─────────────────────────────────────────
//
//  Callista : « les boutons doivent aussi s'afficher en prévisualisation
//  (ce qui est très probable d'arriver) ». La prévisualisation renvoie
//  la page de réponse COMPLÈTE, avec le texte dans le champ — donc le
//  bloc, puisqu'il a été écrit au clic sur « Prévisualisation ».
console.log("\n── EN PRÉVISUALISATION ────────────────────────────────");
p = await monter({ quick: true });
await p.evaluate(() => {
  const c = document.querySelector("#text_editor_textarea");
  c.value = "Elle hésite.";
  c.dispatchEvent(new Event("input", { bubbles: true }));
});
await clic(p, APPARAITRE);
await envoyer(p, "preview");
const versPreview = await lire(p);
dire(
  "le bouton « Prévisualisation » emporte le bloc lui aussi",
  versPreview === "Elle hésite.\n\n[[WM-ACTION:chercher]]",
  JSON.stringify(versPreview),
);

const retour = await monter({ quick: false, texte: versPreview });
const rendue = await retour.evaluate(() => {
  const barre = document.querySelector(".wm-barre");
  return barre === null ? null : {
    presse: [...barre.querySelectorAll("button")].map((b) => b.getAttribute("aria-pressed")),
    note: barre.querySelector(".wm-barre__note").textContent.trim(),
  };
});
dire("LA BARRE EST LÀ SUR LA PAGE DE RÉPONSE COMPLÈTE", rendue !== null);
dire(
  "et elle s'ouvre sur l'état du texte : le bouton est déjà enfoncé",
  JSON.stringify(rendue?.presse) === JSON.stringify(["true", "false", "false"]),
  JSON.stringify(rendue?.presse),
);
dire(
  "la phrase aussi",
  rendue?.note.startsWith("Quand tu enverras ce message, tu fais apparaître"),
  rendue?.note,
);
await retour.close();

// ── 6 · la clôture, qui reste visible, et qui cohabite ──────────────
console.log("\n── LA CLÔTURE EST À PART ──────────────────────────────");
p = await monter();
await p.evaluate(() => {
  const c = document.querySelector("#text_editor_textarea");
  c.value = "Elle s'en va.";
  c.dispatchEvent(new Event("input", { bubbles: true }));
});
await clic(p, CLOTURER);
dire(
  "elle écrit son mot DANS le texte — c'est celui des joueurs, pas le nôtre",
  (await lire(p)) === "Elle s'en va.\n\n[cloture]",
  JSON.stringify(await lire(p)),
);
await clic(p, FOUILLER);
await envoyer(p);
const ensemble = await lire(p);
dire(
  "UNE DERNIÈRE FOUILLE ET UNE CLÔTURE TIENNENT DANS LE MÊME MESSAGE",
  ensemble.includes("[cloture]") && ensemble.includes("[[WM-ACTION:fouiller]]"),
  JSON.stringify(ensemble),
);
await clic(p, CLOTURER);
dire(
  "et un second clic retire le mot",
  !(await lire(p)).includes("[cloture]"),
  JSON.stringify(await lire(p)),
);
dire(
  "le bouton suit le texte quand le joueur efface le mot à la main",
  await p.evaluate(() => {
    const c = document.querySelector("#text_editor_textarea");
    c.value = "Elle part. [cloture]";
    c.dispatchEvent(new Event("input", { bubbles: true }));
    const b = [...document.querySelectorAll(".wm-barre__bouton")].at(-1);
    return b.getAttribute("aria-pressed") === "true";
  }),
);

// ── 7 · la barre ne se pose pas là où la relève ne lit rien ─────────
console.log("\n── AILLEURS QUE DANS UNE ZONE ─────────────────────────");
//  `f106`, GESTION : un forum qui n'est pas une zone. Et `f65`, le Mont
//  Bataille, est NOMMÉ dans `zones.json` avec une note qui dit
//  l'inverse — il n'est pas dans le tableau `zones`, donc pas de barre
//  là non plus.
for (const forum of ["f106-gestion", "f65-mont-bataille"]) {
  const ailleurs = await monter({ forum });
  const ici = await ailleurs.evaluate(() => ({
    barre: document.querySelector(".wm-barre") !== null,
    chemin: [...document.querySelectorAll(".sub-header-path a[href]")].map((a) =>
      a.getAttribute("href")
    ),
  }));
  dire(`DANS ${forum}, QUI N'EST PAS UNE ZONE, PAS DE BARRE`, !ici.barre, JSON.stringify(ici));
  await ailleurs.close();
}

// ── 8 · ce qui se voit : la cible tactile, la rangée, le contraste ──
console.log("\n── CE QUE ÇA DONNE À L'ŒIL ────────────────────────────");
p = await monter();
const vu = await p.evaluate(() => {
  const barre = document.querySelector(".wm-barre");
  const r = (e) => {
    const b = e.getBoundingClientRect();
    return { x: Math.round(b.left), d: Math.round(b.right), h: Math.round(b.height) };
  };
  const boutons = [...barre.querySelectorAll("button")].map(r);
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
  return {
    boutons,
    barre: r(barre),
    formulaire: r(document.querySelector("#quick_reply")),
    contrastes: [...barre.querySelectorAll("button, .wm-barre__entete, .wm-barre__note")].map(
      (e) => [e.className.split(" ")[0], rapport(getComputedStyle(e).color, fond(e))],
    ),
  };
});
dire(
  "LES TROIS BOUTONS FONT AU MOINS 44 DE HAUT — c'est la cible tactile",
  vu.boutons.every((b) => b.h >= 44),
  JSON.stringify(vu.boutons.map((b) => b.h)),
);
dire(
  "ils sont sur UNE SEULE RANGÉE à 1440",
  new Set(vu.boutons.map((b) => b.x)).size === 3,
  JSON.stringify(vu.boutons.map((b) => b.x)),
);
dire(
  "la barre tient dans la largeur du formulaire",
  vu.barre.x >= vu.formulaire.x - 1 && vu.barre.d <= vu.formulaire.d + 1,
  JSON.stringify({ barre: [vu.barre.x, vu.barre.d], form: [vu.formulaire.x, vu.formulaire.d] }),
);
for (const [quoi, r] of vu.contrastes) {
  dire(`${quoi} : ${r} contre son fond`, r >= 4.5, `${r}`);
}

//  EN THÈME SOMBRE, les mêmes textes.
//  LE THÈME SOMBRE EST UNE CLASSE SUR LE CORPS, `body.wm-sombre`.
//  `data-wm-theme` n'est un sélecteur NULLE PART : `outils/messenger.mjs`
//  mesurait le thème clair en croyant mesurer le sombre, et sortait les
//  mêmes cinq chiffres deux fois sans que personne les compare.
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
  return [...document.querySelectorAll(
    ".wm-barre button, .wm-barre__entete, .wm-barre__note",
  )].map((e) => [e.className.split(" ")[0], rapport(getComputedStyle(e).color, fond(e))]);
});
for (const [quoi, r] of sombre) {
  dire(`sombre · ${quoi} : ${r} contre son fond`, r >= 4.5, `${r}`);
}
await p.close();

//  ── À 360 DE LARGE, ça s'empile au lieu de se serrer ──────────────
const etroit = await monter({ largeur: 360 });
const empile = await etroit.evaluate(() => {
  const b = [...document.querySelectorAll(".wm-barre__bouton")].map((e) => {
    const r = e.getBoundingClientRect();
    return { x: Math.round(r.left), l: Math.round(r.width), h: Math.round(r.height) };
  });
  return { b, lignes: new Set(b.map((x) => x.x)).size };
});
dire(
  "À 360, LES BOUTONS S'EMPILENT et gardent leur hauteur",
  empile.lignes === 1 && empile.b.every((x) => x.h >= 44),
  JSON.stringify(empile.b),
);
await etroit.close();

await nav.close();
console.log(soucis.length === 0 ? "\nTOUT PASSE." : `\n${soucis.length} DÉFAUT(S).`);
for (const s of soucis) console.log("  · " + s);
if (soucis.length > 0) Deno.exit(1);
