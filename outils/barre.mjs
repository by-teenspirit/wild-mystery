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

import { chromium } from "npm:playwright@1.56.0";
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
//
//  `enveloppe` DONNE TROIS BALISAGES, parce que Forumactif sert la
//  réponse rapide toute faite et qu'il n'y en a pas qu'un :
//
//    · `false`  — les deux boutons nus dans le formulaire ;
//    · `"pur"`  — déjà dans un `.submit-buttons` qui ne tient qu'eux ;
//    · `"mixte"`— dans un `.submit-buttons` qui tient AUSSI autre chose,
//                 le cas de la page de rédaction complète amont.
//
//  Monter un seul des trois, c'est parier sur celui qu'on a sous la
//  main. Le deuxième a déjà rendu un défaut que le premier ne montrait
//  pas : `06-ecrire.css` réserve 108 px à droite de `.submit-buttons`
//  pour le coin d'outils, et ces 108 px décentraient les boutons de 54.
const formulaire = (quick, enveloppe = false) =>
  quick
    ? `
<a name="quickreply"></a>
<form action="/post" method="post" name="post" id="quick_reply">
  <div id="textarea_content">
    <textarea id="text_editor_textarea" name="message" rows="6" cols="80"></textarea>
  </div>
  ${
      enveloppe === false
        ? `<input type="submit" name="post" value="Envoyer" />
  <input type="hidden" name="tid" value="x" />
  <input type="submit" name="preview" value="Prévisualisation" />`
        : `<div class="submit-buttons">
    ${enveloppe === "mixte" ? '<span class="wm-essai-voisin">Aperçu</span>' : ""}
    <input type="hidden" name="tid" value="x" />
    <input type="submit" name="post" value="Envoyer" />
    <input type="submit" name="preview" value="Prévisualisation" />
  </div>`
    }
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
//  `fil` DIT SI LE FIL D'ARIANE EST DANS LA PAGE. Il y est dans un
//  sujet et dans une liste de sujets ; il N'Y EST PAS sur le
//  formulaire de création, parce que `posting_body` ne le porte pas.
//  C'est ce qui faisait que la barre ne s'y posait pas du tout.
const page = (
  quick,
  texte = "",
  forum = "f9-foret-marecageuse",
  enveloppe = false,
  fil = true,
) =>
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
${fil ? chemin(forum) : ""}
<div id="page-body">
  <div class="post post--15552"><div class="postbody"><div class="content">Un message de RP.</div></div></div>
  ${formulaire(quick, enveloppe).replace("></textarea>", `>${texte}</textarea>`)}
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
//  ── CE QUE `mon_combat` REND, QUAND ON MONTE UN COMBAT ─────────────
//
//  Un Ponyta niveau 10 contre un Salamèche de départ, l'affiche du
//  17 novembre sur `t996`. L'équipe en porte TROIS : celui qui se bat,
//  un valide, et un à terre — les trois états que le menu doit
//  distinguer, et les deux derniers sont ceux qu'on ne peut pas
//  envoyer.
const COMBAT = {
  combatId: "11111111-1111-1111-1111-111111111111",
  tour: 1,
  sauvage: { nom: "Ponyta", niveau: 10, types: ["feu"], pv: 18, pvMax: 30 },
  pvPokemon: 11,
  pvPokemonMax: 18,
  capacites: [
    { id: 52, nom: "Flammèche", type: "feu", puissance: 40 },
    { id: 33, nom: "Charge", type: "normal", puissance: 40 },
  ],
  equipe: [
    { position: 1, nom: "Salamèche", surnom: null, niveau: 5, pv: 11, pvMax: 18, combat: true },
    {
      position: 2,
      nom: "Carapuce",
      surnom: "Biscotte",
      niveau: 6,
      pv: 20,
      pvMax: 20,
      combat: false,
    },
    { position: 3, nom: "Chenipan", surnom: null, niveau: 4, pv: 0, pvMax: 15, combat: false },
  ],
  sac: [
    { objetId: 990001, nom: "Poké Ball", famille: "ball", quantite: 5 },
    { objetId: 990020, nom: "Potion", famille: "soin", quantite: 5 },
  ],
};

async function monter(
  {
    quick = true,
    texte = "",
    largeur = 1440,
    forum,
    enveloppe = false,
    combat = null,
    //  CE QUE REND LA LECTURE PUBLIQUE, séparément du privé. Les deux
    //  se règlent à la main ici parce que le cas qui nous intéresse est
    //  justement celui où elles ne disent pas la même chose : un combat
    //  ouvert (public) dont on ne sait pas lire l'équipe (privé).
    ouvert = null,
    //  L'ADRESSE COMPTE : `wild-mystery.ts` y lit le sujet, et, quand
    //  il n'y en a pas, le forum dans `f=`. Un harnais qui monterait
    //  toujours `/t996-test` ne pourrait pas voir le formulaire de
    //  création.
    adresse = "/t996-test",
    fil = true,
  } = {},
) {
  const p = await nav.newPage({ viewport: { width: largeur, height: 900 } });
  p.on("pageerror", (e) => soucis.push("erreur JS : " + e.message));
  await p.route("**/*", (r) => {
    const u = new URL(r.request().url()).pathname;
    //  L'APPEL À `mon_combat` EST INTERCEPTÉ ICI, et pas remplacé par un
    //  faux module : c'est le vrai paquet livré qui l'émet, avec son
    //  vrai en-tête `Authorization`. Un faux à la place de
    //  l'adaptateur ne dirait rien du chemin réel.
    if (u.endsWith("/rpc/mon_combat")) {
      return r.fulfill({
        contentType: "application/json",
        body: JSON.stringify(combat),
      });
    }
    //  LA LECTURE PUBLIQUE A SA PROPRE ROUTE. Quand `ouvert` n'est pas
    //  réglé, elle suit le privé — sinon chaque cas déjà écrit devrait
    //  régler les deux, alors qu'un combat lisible est aussi un combat
    //  ouvert.
    if (u.endsWith("/rpc/combat_du_sujet")) {
      const dit = ouvert ?? (combat === null ? null : { combatId: combat.combatId });
      return r.fulfill({
        contentType: "application/json",
        body: JSON.stringify(dit),
      });
    }
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
      body: page(quick, texte, forum, enveloppe, fil),
    });
  });
  await p.goto("http://wild-mystery.test" + adresse);
  //  LE LAISSEZ-PASSER, POSÉ AVANT LE SCRIPT. Sans lui `monCombat` sort
  //  avant tout réseau — c'est voulu, et c'est aussi ce qui fait qu'un
  //  harnais qui l'oublierait mesurerait une barre hors combat en
  //  croyant mesurer un combat.
  if (combat !== null) {
    await p.evaluate(() =>
      localStorage.setItem(
        "wm.carnet.laissez",
        JSON.stringify({
          jeton: "jeton-d-essai",
          rafraichir: "rafraichir-d-essai",
          expireLe: Date.now() + 3600_000,
        }),
      )
    );
  }
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

const RIEN = "Ne rien faire";
const APPARAITRE = "Faire apparaître un Pokémon";
const FOUILLER = "Fouiller la zone";
const CLOTURER = "Clôturer le sujet";

/** Les quatre boutons, dans l'ordre du DOM, avec leur état coché. */
const etats = (p) =>
  p.evaluate(() =>
    [...document.querySelectorAll(".wm-barre__bouton")].map((b) =>
      b.getAttribute("aria-checked")
    )
  );

// ── 1 · la barre est là, où il faut, et elle n'a que ce qu'il faut ──
console.log("\n── LA BARRE SE POSE DANS UNE ZONE ─────────────────────");
let p = await monter();
const pose = await p.evaluate(() => {
  const barre = document.querySelector(".wm-barre");
  if (barre === null) return null;
  const formulaire = document.querySelector("#quick_reply");
  const champ = document.querySelector("#text_editor_textarea");
  const envois = [...formulaire.querySelectorAll('[type="submit"]')];
  //  LA PLACE SE MESURE DANS L'ORDRE DU DOCUMENT, pas sur un voisin :
  //  « en dessous, prévisualiser ou envoyer ». Le champ avant, les
  //  boutons d'envoi après, et le tout DANS le formulaire.
  const rang = (e) => [...formulaire.querySelectorAll("*")].indexOf(e);
  return {
    entete: barre.querySelector(".wm-barre__entete")?.textContent.trim(),
    boutons: [...barre.querySelectorAll("button")].map((b) => b.textContent.trim()),
    //  TOUT contrôle, pas seulement les boutons : c'est ce que le menu
    //  « Où » était.
    //
    //  SAUF CE QUI EST CACHÉ, depuis le 18 novembre. Le bloc d'erreur
    //  du carnet non relié naît caché et porte un lien ; compté ici,
    //  il faisait un cinquième contrôle sur une barre qui n'en montre
    //  que quatre. Ce n'est pas un contrôle de plus à l'écran — c'en
    //  est un qui n'est pas à l'écran, et la règle de 15 octobre parle
    //  de ce qu'on VOIT.
    controles: [...barre.querySelectorAll("button, select, input, textarea, a")]
      .filter((e) => e.offsetParent !== null || e.getClientRects().length > 0).length,
    dansLeFormulaire: formulaire.contains(barre),
    apresLeChamp: rang(barre) > rang(champ),
    avantLesEnvois: envois.every((e) => rang(barre) < rang(e)),
    groupe: barre.querySelector(".wm-barre__choix")?.getAttribute("role"),
    note: barre.querySelector(".wm-barre__note")?.textContent.trim(),
  };
});
dire("elle existe", pose !== null);
dire("son en-tête dit « Ton tour »", pose?.entete === "Ton tour", pose?.entete);
dire(
  "QUATRE BOUTONS, dans les mots de Callista et dans son ordre",
  JSON.stringify(pose?.boutons) === JSON.stringify([RIEN, APPARAITRE, FOUILLER, CLOTURER]),
  JSON.stringify(pose?.boutons),
);
dire(
  "et AUCUN autre contrôle — plus de menu, plus d'étiquette",
  pose?.controles === 4,
  `${pose?.controles} contrôles`,
);
dire(
  "LE BLOC EST DANS LE FORMULAIRE, SOUS LE CHAMP ET AU-DESSUS DES ENVOIS",
  pose?.dansLeFormulaire === true && pose?.apresLeChamp === true &&
    pose?.avantLesEnvois === true,
  JSON.stringify({
    dedans: pose?.dansLeFormulaire,
    apresLeChamp: pose?.apresLeChamp,
    avantLesEnvois: pose?.avantLesEnvois,
  }),
);
dire(
  "les quatre choix s'annoncent comme un groupe de radios",
  pose?.groupe === "radiogroup",
  pose?.groupe,
);
dire(
  "AU DÉPART, « NE RIEN FAIRE » EST COCHÉ, et ça se lit",
  JSON.stringify(await etats(p)) === JSON.stringify(["true", "false", "false", "false"]),
  JSON.stringify(await etats(p)),
);
dire(
  "et la phrase dit que rien ne partira",
  pose?.note?.startsWith("Ton message part comme un message normal"),
  pose?.note,
);

// ── 1 bis · UNE ICÔNE PAR ACTION, ET QUATRE DIFFÉRENTES ────────────
//
//  « Ce serait bien d'avoir une icône pour chaque action. »
//
//  DEUX CHOSES, PAS UNE : qu'il y en ait une par bouton, et qu'elles
//  ne soient pas la même. Un seul dessin recopié quatre fois passerait
//  le premier contrôle et ne servirait à rien — c'est exactement la
//  forme de défaut que ce harnais existe pour attraper.
//
//  ET LE MOT RESTE ÉCRIT : une icône `aria-hidden` à côté d'un libellé
//  aide à repérer ; une icône seule demande de l'avoir apprise.
const icones = await p.evaluate(() =>
  [...document.querySelectorAll(".wm-barre__bouton")].map((b) => ({
    nombre: b.querySelectorAll("svg").length,
    trace: [...b.querySelectorAll("svg path")].map((c) => c.getAttribute("d")).join("|"),
    cachee: b.querySelector("svg")?.getAttribute("aria-hidden"),
    mot: b.querySelector(".wm-barre__mot")?.textContent.trim(),
    taille: (() => {
      const r = b.querySelector("svg")?.getBoundingClientRect();
      return r === undefined ? null : [Math.round(r.width), Math.round(r.height)];
    })(),
  }))
);
dire(
  "CHAQUE BOUTON PORTE UNE ICÔNE, UNE SEULE, et elle est dessinée",
  icones.length === 4 && icones.every((i) => i.nombre === 1 && i.trace.length > 20),
  JSON.stringify(icones.map((i) => i.nombre)),
);
dire(
  "LES QUATRE SONT DIFFÉRENTES — un même dessin recopié ne dirait rien",
  new Set(icones.map((i) => i.trace)).size === 4,
  `${new Set(icones.map((i) => i.trace)).size} dessins distincts`,
);
dire(
  "elles ont une taille à l'écran, et elles ne sont pas annoncées",
  icones.every((i) => i.cachee === "true" && i.taille[0] >= 14 && i.taille[1] >= 14),
  JSON.stringify(icones.map((i) => i.taille)),
);
dire(
  "et le libellé reste écrit à côté",
  JSON.stringify(icones.map((i) => i.mot)) ===
    JSON.stringify([RIEN, APPARAITRE, FOUILLER, CLOTURER]),
  JSON.stringify(icones.map((i) => i.mot)),
);

// ── 2 · LA RÈGLE GÉNÉRALE : chaque contrôle change quelque chose ────
//
//  C'est ce contrôle-là qui aurait attrapé le menu « Où ». Il ne nomme
//  aucun contrôle en particulier : il les énumère, les actionne un par
//  un, et exige qu'il se passe quelque chose de visible — dans le
//  texte, ou dans l'état de la barre.
console.log("\n── CHAQUE CONTRÔLE DE LA BARRE FAIT QUELQUE CHOSE ─────");
//
//  LES QUATRE S'EXCLUENT DEPUIS LE 17 NOVEMBRE, et ça change comment on
//  les actionne : recliquer celui qui est déjà coché ne doit RIEN
//  changer — c'est le propre d'un groupe de radios. On part donc d'un
//  autre choix avant chaque essai, sinon le contrôle accuserait le
//  bouton coché d'être muet alors qu'il fait ce qu'il doit.
const muets = await p.evaluate(() => {
  const barre = document.querySelector(".wm-barre");
  const champ = document.querySelector("#text_editor_textarea");
  const boutons = [...barre.querySelectorAll("button")];
  const empreinte = () =>
    champ.value + "|" +
    boutons.map((b) => b.getAttribute("aria-checked")).join(",") +
    "|" + barre.querySelector(".wm-barre__note").textContent;

  const sansEffet = [];
  for (const c of barre.querySelectorAll("button, select, input, a")) {
    //  UN LIEN QUI MÈNE AILLEURS N'EST PAS MUET, il est SORTANT. Le
    //  contrôle du 15 octobre cherche des contrôles qui ne changent
    //  rien DANS la barre ; un `<a href>` n'a aucune raison d'y
    //  changer quoi que ce soit — son effet est de quitter la page, et
    //  le harnais empêche justement toute navigation. Le cliquer ici
    //  ne mesurerait rien et, sur une page réelle, l'emporterait.
    //
    //  SON ADRESSE EST VÉRIFIÉE AILLEURS — dans l'essai du bloc
    //  d'erreur, qui exige `/h17-mon-carnet`. Un lien vide ou en « # »
    //  n'y passerait pas.
    if (c.tagName === "A" && (c.getAttribute("href") ?? "") !== "") continue;
    //  ON PART D'AILLEURS : le premier bouton qui n'est pas celui-ci.
    const ailleurs = boutons.find((b) => b !== c);
    if (ailleurs !== undefined) ailleurs.click();
    const avant = empreinte();
    if (c.tagName === "SELECT" && c.options.length > 1) {
      c.selectedIndex = c.selectedIndex === 0 ? 1 : 0;
      c.dispatchEvent(new Event("change", { bubbles: true }));
    } else {
      c.click();
    }
    if (empreinte() === avant) sansEffet.push(c.textContent.trim() || c.id || c.tagName);
  }
  boutons[0].click();
  return sansEffet;
});
dire(
  "AUCUN CONTRÔLE MUET — c'était le défaut du 15 octobre",
  muets.length === 0,
  muets.join(", "),
);

// ── 3 · les quatre choix, et la balise qui n'apparaît plus ──────────
console.log("\n── QUATRE CHOIX, SANS BALISE DANS LE TEXTE ────────────");
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
dire(
  "mais le bouton se voit coché, et lui seul",
  JSON.stringify(await etats(p)) === JSON.stringify(["false", "true", "false", "false"]),
  JSON.stringify(await etats(p)),
);
const note = () =>
  p.evaluate(() => document.querySelector(".wm-barre__note").textContent.trim());
dire(
  "et la phrase dit ce qui va partir, en français",
  (await note()) === "Quand tu enverras ce message, tu fais apparaître un Pokémon.",
  await note(),
);

await clic(p, FOUILLER);
dire(
  "ILS S'EXCLUENT : fouiller remplace, il n'ajoute pas",
  JSON.stringify(await etats(p)) === JSON.stringify(["false", "false", "true", "false"]),
  JSON.stringify(await etats(p)),
);

//  UN GROUPE DE RADIOS NE SE DÉCOCHE PAS : recliquer le choix en cours
//  ne le défait pas, on repasse par « Ne rien faire ». C'était une
//  bascule avant, et c'est exactement ce que la phrase « ne rien faire,
//  faire apparaître, fouiller ou cloturer » a changé.
await clic(p, FOUILLER);
dire(
  "recliquer le même choix ne le décoche pas",
  JSON.stringify(await etats(p)) === JSON.stringify(["false", "false", "true", "false"]),
  JSON.stringify(await etats(p)),
);
await clic(p, RIEN);
dire(
  "« NE RIEN FAIRE » EST UN CHOIX, PAS UNE ABSENCE",
  JSON.stringify(await etats(p)) === JSON.stringify(["true", "false", "false", "false"]),
  JSON.stringify(await etats(p)),
);
dire(
  "et la phrase revient à son état de départ",
  (await note()).startsWith("Ton message part comme un message normal"),
  await note(),
);

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
  const formulaire = document.querySelector("form[name=post]");
  const rang = (e) => [...formulaire.querySelectorAll("*")].indexOf(e);
  return barre === null ? null : {
    coche: [...barre.querySelectorAll("button")].map((b) => b.getAttribute("aria-checked")),
    note: barre.querySelector(".wm-barre__note").textContent.trim(),
    //  LA MÊME PLACE QUE DANS LA RÉPONSE RAPIDE, et le balisage n'est
    //  pas le même : le champ y est dans un `#message-box`. C'est la
    //  règle « on remonte depuis le bouton d'envoi » qui est mesurée.
    apresLeChamp: rang(barre) > rang(document.querySelector("#text_editor_textarea")),
    avantLesEnvois: [...formulaire.querySelectorAll('[type="submit"]')].every((e) =>
      rang(barre) < rang(e)
    ),
  };
});
dire("LA BARRE EST LÀ SUR LA PAGE DE RÉPONSE COMPLÈTE", rendue !== null);
dire(
  "et elle s'ouvre sur l'état du texte : le bouton est déjà coché",
  JSON.stringify(rendue?.coche) === JSON.stringify(["false", "true", "false", "false"]),
  JSON.stringify(rendue?.coche),
);
dire(
  "et elle y est AUSSI sous le champ et au-dessus des envois",
  rendue?.apresLeChamp === true && rendue?.avantLesEnvois === true,
  JSON.stringify({ apres: rendue?.apresLeChamp, avant: rendue?.avantLesEnvois }),
);
dire(
  "la phrase aussi",
  rendue?.note.startsWith("Quand tu enverras ce message, tu fais apparaître"),
  rendue?.note,
);
await retour.close();

// ── 6 · la clôture : visible dans le texte, et dans le groupe ───────
//
//  CE QUE CE BLOC MESURAIT AVANT, ET QUI N'EST PLUS VRAI : « une
//  dernière fouille et une clôture tiennent dans le même message ».
//  Les quatre choix s'excluent depuis que Callista les a énumérés avec
//  un « ou » ; le cumul n'est plus possible, et c'est une perte
//  assumée. Le contrôle est retourné : il exige maintenant que poser
//  l'un défasse l'autre, dans LES DEUX SENS. S'il faut revenir en
//  arrière, c'est lui qui rougira en premier.
console.log("\n── LA CLÔTURE EST DANS LE GROUPE ──────────────────────");
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
dire(
  "et c'est elle qui est cochée",
  JSON.stringify(await etats(p)) === JSON.stringify(["false", "false", "false", "true"]),
  JSON.stringify(await etats(p)),
);

await clic(p, FOUILLER);
dire(
  "CHOISIR UNE ACTION RETIRE LE MOT DE CLÔTURE",
  !(await lire(p)).includes("[cloture]"),
  JSON.stringify(await lire(p)),
);
await envoyer(p);
const ensemble = await lire(p);
dire(
  "et ce qui part ne porte que l'action",
  ensemble.includes("[[WM-ACTION:fouiller]]") && !ensemble.includes("[cloture]"),
  JSON.stringify(ensemble),
);

await clic(p, CLOTURER);
await envoyer(p);
const close = await lire(p);
//  L'ÉGALITÉ EXACTE, ET PAS DEUX `includes` : mon premier jet retirait
//  le bloc et laissait les deux lignes vides qui l'encadraient — quatre
//  retours avant `[cloture]`, dans le message du joueur. Les deux
//  `includes` passaient au vert dessus.
dire(
  "DANS L'AUTRE SENS AUSSI : clôturer retire le bloc d'action à l'envoi, sans trou",
  close === "Elle s'en va.\n\n[cloture]",
  JSON.stringify(close),
);

await clic(p, RIEN);
dire(
  "« ne rien faire » retire le mot lui aussi",
  !(await lire(p)).includes("[cloture]"),
  JSON.stringify(await lire(p)),
);

dire(
  "le bouton suit le texte quand le joueur écrit le mot à la main",
  await p.evaluate(() => {
    const c = document.querySelector("#text_editor_textarea");
    c.value = "Elle part. [cloture]";
    c.dispatchEvent(new Event("input", { bubbles: true }));
    const b = [...document.querySelectorAll(".wm-barre__bouton")].at(-1);
    return b.getAttribute("aria-checked") === "true";
  }),
);
dire(
  "et il se décoche quand le joueur l'efface à la main",
  await p.evaluate(() => {
    const c = document.querySelector("#text_editor_textarea");
    c.value = "Elle part.";
    c.dispatchEvent(new Event("input", { bubbles: true }));
    const b = [...document.querySelectorAll(".wm-barre__bouton")];
    return b.at(-1).getAttribute("aria-checked") === "false" &&
      b[0].getAttribute("aria-checked") === "true";
  }),
);

// ── 6 bis · LES FLÈCHES DÉPLACENT LE CHOIX ─────────────────────────
//
//  On annonce `role="radio"` : un clavier a donc le droit d'attendre
//  les flèches. Annoncer le rôle sans le comportement, c'est le mentir
//  à qui s'y fie — et c'est la même faute que le menu « Où », à
//  l'envers.
console.log("\n── AU CLAVIER ─────────────────────────────────────────");
await clic(p, RIEN);
await p.evaluate(() => {
  const b = [...document.querySelectorAll(".wm-barre__bouton")][0];
  b.focus();
  b.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
});
dire(
  "FLÈCHE DROITE : le choix passe au suivant",
  JSON.stringify(await etats(p)) === JSON.stringify(["false", "true", "false", "false"]),
  JSON.stringify(await etats(p)),
);
dire(
  "et un seul des quatre est atteignable par tabulation",
  await p.evaluate(() =>
    [...document.querySelectorAll(".wm-barre__bouton")].filter((b) => b.tabIndex === 0).length
  ) === 1,
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
  const boutons = [...barre.querySelectorAll("button")].map((e) => ({
    ...r(e),
    y: Math.round(e.getBoundingClientRect().top),
  }));
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
  "LES QUATRE BOUTONS FONT AU MOINS 44 DE HAUT — c'est la cible tactile",
  vu.boutons.every((b) => b.h >= 44),
  JSON.stringify(vu.boutons.map((b) => b.h)),
);
dire(
  "les trois premiers sont sur UNE SEULE RANGÉE à 1440",
  new Set(vu.boutons.slice(0, 3).map((b) => b.x)).size === 3 &&
    new Set(vu.boutons.slice(0, 3).map((b) => b.y)).size === 1,
  JSON.stringify(vu.boutons.slice(0, 3).map((b) => [b.x, b.y])),
);
//  LA CLÔTURE, DEUXIÈME ESSAI : « je suis pas convaincue de comment
//  elle est ». Le pointillé est le dessin de ce qui est désactivé ; il
//  disait « pas disponible » au lieu de « pas pareil ». Elle est
//  maintenant séparée par un trait et rangée en terre.
const fin = await p.evaluate(() => {
  const tous = [...document.querySelectorAll(".wm-barre__bouton")];
  const b = tous.at(-1);
  const libre = tous[1]; //  un des trois, non coché : la référence
  const s = getComputedStyle(b);
  return {
    pointille: s.borderTopStyle,
    bord: s.borderTopColor,
    fond: s.backgroundColor,
    couleur: s.color,
    fondLibre: getComputedStyle(libre).backgroundColor,
    bordLibre: getComputedStyle(libre).borderTopColor,
    trait: getComputedStyle(b.closest(".wm-barre__rangee")).borderTopWidth,
    hauteur: Math.round(b.getBoundingClientRect().height),
  };
});
dire(
  "LA CLÔTURE N'EST PLUS EN POINTILLÉ — ce dessin-là veut dire « désactivé »",
  fin.pointille === "solid",
  fin.pointille,
);
dire(
  "un trait la sépare des trois autres",
  parseFloat(fin.trait) >= 1,
  fin.trait,
);
dire(
  "et elle est RANGÉE EN TERRE, pas affaiblie : fond et bord à elle",
  fin.fond !== fin.fondLibre && fin.bord !== fin.bordLibre && fin.bord === fin.couleur,
  JSON.stringify({
    elle: [fin.fond, fin.bord, fin.couleur],
    libre: [fin.fondLibre, fin.bordLibre],
  }),
);
dire(
  "et elle garde ses 44 px — secondaire ne veut pas dire plus dure à toucher",
  fin.hauteur >= 44,
  `${fin.hauteur} px`,
);
dire(
  "ET CLÔTURER EST EN DESSOUS, sans s'étirer — « un peu secondaire »",
  vu.boutons[3].y > vu.boutons[0].y &&
    vu.boutons[3].d - vu.boutons[3].x < vu.boutons[0].d - vu.boutons[0].x,
  JSON.stringify({
    y: [vu.boutons[0].y, vu.boutons[3].y],
    largeurs: [vu.boutons[0].d - vu.boutons[0].x, vu.boutons[3].d - vu.boutons[3].x],
  }),
);
dire(
  "la barre tient dans la largeur du formulaire",
  vu.barre.x >= vu.formulaire.x - 1 && vu.barre.d <= vu.formulaire.d + 1,
  JSON.stringify({ barre: [vu.barre.x, vu.barre.d], form: [vu.formulaire.x, vu.formulaire.d] }),
);
for (const [quoi, r] of vu.contrastes) {
  dire(`${quoi} : ${r} contre son fond`, r >= 4.5, `${r}`);
}

//  ── L'ÉCART ENTRE COCHÉ ET PAS COCHÉ ─────────────────────────────
//
//  « Les boutons, on doit bien faire la différence qu'on l'a
//  sélectionné ou non. Aujourd'hui, c'est pas le cas. » L'ancien état
//  posé ajoutait une couleur de bord et une ombre intérieure d'un
//  pixel sur un bouton déjà bordé : mesuré ici, les deux fonds
//  donnaient 1,00 — le même. C'est exactement ce que ce contrôle
//  refuse désormais, et c'est la mesure de sa phrase.
//
//  DEUX SIGNAUX, PAS UN : le fond, qu'on voit de loin, et la pastille,
//  qu'on voit sans la couleur. Un bouton coché la remplit ; un bouton
//  libre la laisse vide.
const ecart = await p.evaluate(() => {
  const b = [...document.querySelectorAll(".wm-barre__bouton")];
  const lum = (c) => {
    const [r1, g, bl] = (c.match(/-?\d*\.?\d+/g) ?? []).slice(0, 3).map((v) => {
      const x = v / 255;
      return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r1 + 0.7152 * g + 0.0722 * bl;
  };
  const rapport = (x, y) => {
    const [hi, lo] = [lum(x), lum(y)].sort((m, n) => n - m);
    return Math.round(((hi + 0.05) / (lo + 0.05)) * 100) / 100;
  };
  const fond = (e) => getComputedStyle(e).backgroundColor;
  const pastille = (e) => getComputedStyle(e, "::before").backgroundColor;
  const vide = (c) => /rgba\(0, 0, 0, 0\)|transparent/.test(c);
  return {
    //  b[0] est coché au départ, b[1] ne l'est pas.
    fonds: rapport(fond(b[0]), fond(b[1])),
    couleurs: [fond(b[0]), fond(b[1])],
    pastilleCochee: pastille(b[0]),
    pastilleLibre: pastille(b[1]),
    pastillesDifferentes: !vide(pastille(b[0])) && vide(pastille(b[1])),
  };
});
dire(
  "LE BOUTON COCHÉ NE RESSEMBLE PAS AU BOUTON LIBRE — son fond les sépare",
  ecart.fonds >= 3,
  `${ecart.fonds} entre ${ecart.couleurs.join(" et ")}`,
);
dire(
  "et la pastille le dit AUSSI sans la couleur : pleine contre vide",
  ecart.pastillesDifferentes,
  `cochée ${ecart.pastilleCochee} · libre ${ecart.pastilleLibre}`,
);

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

// ── 9 · ENVOYER ET PRÉVISUALISER, CENTRÉS ──────────────────────────
//
//  « Envoyer et prévisualiser, centrer les deux boutons. »
//
//  LE CENTRAGE SE MESURE, il ne se déclare pas : on compare l'écart à
//  gauche et l'écart à droite dans le formulaire. Une règle
//  `justify-content: center` posée sur le mauvais élément passerait une
//  lecture de CSS et laisserait les boutons collés à gauche.
//
//  ET DANS LES DEUX BALISAGES. Forumactif sert la réponse rapide toute
//  faite : les boutons peuvent être nus dans le formulaire ou déjà dans
//  un conteneur. Monter un seul des deux, c'est parier sur celui qu'on
//  a sous la main — et c'est ce pari-là qui coûte une journée quand il
//  tombe du mauvais côté.
console.log("\n── LES BOUTONS D'ENVOI ────────────────────────────────");
for (
  const [quoi, enveloppe] of [
    ["boutons nus", false],
    ["conteneur à eux", "pur"],
    ["conteneur partagé", "mixte"],
  ]
) {
  const page = await monter({ enveloppe });
  const centre = await page.evaluate(() => {
    const formulaire = document.querySelector("#quick_reply");
    const boite = formulaire.querySelector(".wm-envois");
    if (boite === null) return null;
    const f = formulaire.getBoundingClientRect();
    const envois = [...boite.querySelectorAll('[type="submit"]')];
    const rects = envois.map((e) => e.getBoundingClientRect());
    const gauche = Math.min(...rects.map((r) => r.left)) - f.left;
    const droite = f.right - Math.max(...rects.map((r) => r.right));
    return {
      combien: envois.length,
      noms: envois.map((e) => e.name),
      //  AUCUN PERDU EN ROUTE : les deux sont toujours dans le
      //  formulaire, et le champ caché aussi.
      tousDansLeFormulaire: [...formulaire.querySelectorAll('[type="submit"]')].length === 2,
      cacheGarde: formulaire.querySelector('[name="tid"]') !== null,
      //  LE CHAMP CACHÉ NE POUSSE PAS : il est hors flux.
      cacheHorsFlux:
        formulaire.querySelector('[name="tid"]').getBoundingClientRect().width === 0,
      gauche: Math.round(gauche),
      droite: Math.round(droite),
      surUneLigne: new Set(rects.map((r) => Math.round(r.top))).size === 1,
      sousLaBarre: rects.every((r) =>
        r.top >= document.querySelector(".wm-barre").getBoundingClientRect().bottom - 1
      ),
    };
  });
  dire(
    `${quoi} : les deux boutons sont dans une boîte à eux`,
    centre?.combien === 2,
    JSON.stringify(centre?.noms),
  );
  dire(
    `${quoi} : ILS SONT CENTRÉS dans le formulaire`,
    centre !== null && Math.abs(centre.gauche - centre.droite) <= 2,
    `${centre?.gauche} à gauche, ${centre?.droite} à droite`,
  );
  dire(
    `${quoi} : côte à côte, et sous le bloc d'actions`,
    centre?.surUneLigne === true && centre?.sousLaBarre === true,
    JSON.stringify({ ligne: centre?.surUneLigne, sous: centre?.sousLaBarre }),
  );
  dire(
    `${quoi} : rien n'a été perdu en déplaçant — le champ caché est là, et il ne pousse pas`,
    centre?.tousDansLeFormulaire === true && centre?.cacheGarde === true &&
      centre?.cacheHorsFlux === true,
    JSON.stringify({
      envois: centre?.tousDansLeFormulaire,
      cache: centre?.cacheGarde,
      horsFlux: centre?.cacheHorsFlux,
    }),
  );
  await page.close();
}

// ── 10 · LA BARRE BASCULE EN COMBAT ────────────────────────────────
//
//  « Ensuite, on a les propositions qui changent : je peux attaquer le
//  pokémon, lancer une pokeball, utiliser quelque chose de mon sac ou
//  fuir, ou changer de pokémon. » — 17 novembre.
console.log("\n── EN COMBAT ──────────────────────────────────────────");
p = await monter({ combat: COMBAT });

const enCombat = await p.evaluate(() => ({
  mots: [...document.querySelectorAll(".wm-barre__bouton")].map((b) => b.textContent.trim()),
  menus: [...document.querySelectorAll(".wm-barre__menu")].length,
  visibles: [...document.querySelectorAll(".wm-barre__menu")]
    .filter((m) => !m.hidden).length,
  coche: [...document.querySelectorAll(".wm-barre__bouton")]
    .find((b) => b.getAttribute("aria-checked") === "true")?.textContent.trim(),
}));

dire(
  "LES CINQ CHOIX DU COMBAT SONT SERVIS",
  JSON.stringify(enCombat.mots) === JSON.stringify([
    "Attaquer",
    "Lancer une Poké Ball",
    "Utiliser un objet",
    "Changer de Pokémon",
    "Fuir",
  ]),
  JSON.stringify(enCombat.mots),
);
dire(
  "et « ne rien faire » n'en est pas : poster sans agir laisserait le tour au sauvage",
  !enCombat.mots.includes(RIEN),
  enCombat.mots.join(" · "),
);
dire(
  "ATTAQUER EST COCHÉ PAR DÉFAUT, et c'est le choix le plus courant",
  enCombat.coche === "Attaquer",
  String(enCombat.coche),
);
dire(
  "QUATRE MENUS POSÉS, UN SEUL VISIBLE — trois menus de plus parleraient d'actions qu'on n'a pas demandées",
  enCombat.menus === 4 && enCombat.visibles === 1,
  `${enCombat.menus} posés, ${enCombat.visibles} visible(s)`,
);

//  ── LE MENU DIT CE QU'IL FAUT POUR CHOISIR ───────────────────────
const menuAttaque = await p.evaluate(() =>
  [...document.querySelectorAll(".wm-barre__menu")]
      .find((m) => !m.hidden)
      ?.options.length === undefined
    ? null
    : [...[...document.querySelectorAll(".wm-barre__menu")].find((m) => !m.hidden).options]
      .map((o) => o.textContent)
);
dire(
  "LE TYPE ET LA PUISSANCE SONT DANS LE MOT : on choisit sans ouvrir l'annexe des types",
  menuAttaque !== null && menuAttaque[0].includes("feu") &&
    menuAttaque[0].includes("40"),
  JSON.stringify(menuAttaque),
);

//  ── ET LE BLOC QUI PART PORTE LA CAPACITÉ CHOISIE ────────────────
await envoyer(p);
let partant = await lire(p);
dire(
  "LE BLOC PORTE L'IDENTIFIANT DE LA CAPACITÉ, pas son rang",
  partant.includes("[[WM-ACTION:attaquer:52]]"),
  partant.trim(),
);

//  Deuxième capacité : le menu change, donc le bloc change. C'est la
//  règle du harnais — chaque contrôle que la barre pose change quelque
//  chose.
await p.evaluate(() => {
  const m = [...document.querySelectorAll(".wm-barre__menu")].find((x) => !x.hidden);
  m.value = "33";
  m.dispatchEvent(new Event("change"));
});
await envoyer(p);
partant = await lire(p);
dire(
  "CHANGER LE MENU CHANGE CE QUI PART — le menu « Où » était parti pour avoir manqué à cette règle",
  partant.includes("[[WM-ACTION:attaquer:33]]"),
  partant.trim(),
);

//  ── CHANGER DE POKÉMON : LES TROIS ÉTATS DE L'ÉQUIPE ─────────────
await clic(p, "Changer de Pokémon");
const equipe = await p.evaluate(() => {
  const m = [...document.querySelectorAll(".wm-barre__menu")].find((x) => !x.hidden);
  return [...m.options].map((o) => ({ mot: o.textContent, inerte: o.disabled }));
});
dire(
  "CELUI QUI SE BAT RESTE DANS LA LISTE, inerte — le retirer ferait croire qu'on l'a perdu",
  equipe.some((o) => o.mot.includes("se bat") && o.inerte),
  JSON.stringify(equipe.map((o) => o.mot)),
);
dire(
  "UN POKÉMON À TERRE EST DIT ET INERTE — le serveur le refuserait, autant ne pas dépenser un message pour l'apprendre",
  equipe.some((o) => o.mot.includes("K.O.") && o.inerte),
  JSON.stringify(equipe.filter((o) => o.inerte).map((o) => o.mot)),
);
dire(
  "et les PV DANS LE SUJET sont affichés : 20/20 pour celui qui n'a pas encore combattu",
  equipe.some((o) => o.mot.includes("20/20")),
  JSON.stringify(equipe.map((o) => o.mot)),
);

//  ── LA POKÉ BALL ET L'OBJET LISENT LE SAC ────────────────────────
await clic(p, "Lancer une Poké Ball");
const balls = await p.evaluate(() =>
  [...[...document.querySelectorAll(".wm-barre__menu")].find((x) => !x.hidden).options]
    .map((o) => o.textContent)
);
dire(
  "LE MENU DES BALLS DIT COMBIEN IL EN RESTE",
  balls.length === 1 && balls[0].includes("Poké Ball (5)"),
  JSON.stringify(balls),
);
await envoyer(p);
partant = await lire(p);
dire(
  "et le bloc porte l'objet",
  partant.includes("[[WM-ACTION:ball:990001]]"),
  partant.trim(),
);

await clic(p, "Utiliser un objet");
const objets = await p.evaluate(() =>
  [...[...document.querySelectorAll(".wm-barre__menu")].find((x) => !x.hidden).options]
    .map((o) => o.textContent)
);
dire(
  "LES BALLS NE SONT PAS DANS « UTILISER UN OBJET » : deux boutons pour la même chose seraient un piège",
  objets.length === 1 && objets[0].includes("Potion"),
  JSON.stringify(objets),
);

//  ── FUIR N'A PAS DE MENU ─────────────────────────────────────────
await clic(p, "Fuir");
const enFuite = await p.evaluate(() => ({
  visibles: [...document.querySelectorAll(".wm-barre__menu")].filter((m) => !m.hidden)
    .length,
}));
dire(
  "FUIR NE DEMANDE RIEN, donc aucun menu",
  enFuite.visibles === 0,
  `${enFuite.visibles} menu(s) visible(s)`,
);
await envoyer(p);
partant = await lire(p);
dire("et le bloc de fuite part seul", partant.includes("[[WM-ACTION:fuir]]"), partant.trim());

//  ── LES FLÈCHES PARCOURENT LE JEU DE COMBAT, PAS L'AUTRE ─────────
const auClavierEnCombat = await p.evaluate(() => {
  const b = [...document.querySelectorAll(".wm-barre__bouton")]
    .find((x) => x.getAttribute("aria-checked") === "true");
  b.focus();
  b.dispatchEvent(new KeyboardEvent("keydown", { key: "Home", bubbles: true }));
  return [...document.querySelectorAll(".wm-barre__bouton")]
    .find((x) => x.getAttribute("aria-checked") === "true")?.textContent.trim();
});
dire(
  "AU CLAVIER, « Home » revient au premier du JEU COURANT",
  auClavierEnCombat === "Attaquer",
  String(auClavierEnCombat),
);
await p.close();

// ── 10 bis · SANS COMBAT, LA BARRE NE CHANGE PAS ───────────────────
console.log("\n── SANS COMBAT OUVERT ─────────────────────────────────");
p = await monter({ combat: null });
const horsCombat = await p.evaluate(() => ({
  mots: [...document.querySelectorAll(".wm-barre__bouton")].map((b) => b.textContent.trim()),
  menus: [...document.querySelectorAll(".wm-barre__menu")].length,
}));
dire(
  "LES QUATRE CHOIX HABITUELS, ET AUCUN MENU — neuf sujets de zone sur dix n'ont pas de combat",
  JSON.stringify(horsCombat.mots) === JSON.stringify([RIEN, APPARAITRE, FOUILLER, CLOTURER]) &&
    horsCombat.menus === 0,
  `${JSON.stringify(horsCombat.mots)} · ${horsCombat.menus} menu(s)`,
);
await p.close();

// ── 10 ter · UN COMBAT OUVERT QU'ON NE SAIT PAS LIRE ───────────────
//
//  « Quand un combat est ouvert, je n'ai pas les boutons pour le
//  fermer. » — 18 novembre.
//
//  LE CAS EXACT : la lecture publique dit qu'un combat tourne, la
//  privée ne rend rien — carnet non relié, jeton périmé, base qui
//  refuse. On monte donc SANS laissez-passer (`combat: null` ne pose
//  rien dans `localStorage`) et avec `ouvert` réglé à la main.
//
//  CE QUI DOIT TENIR : les cinq boutons, « Fuir » dedans, des menus
//  vides qui le DISENT au lieu de prétendre que le sac l'est, et un
//  bloc `[[WM-ACTION:fuir]]` qui part pour de vrai. Sans ce dernier
//  point, le bouton serait un décor.
console.log("\n── COMBAT OUVERT, LECTURE PRIVÉE MUETTE ───────────────");
p = await monter({ ouvert: { combatId: "11111111-1111-1111-1111-111111111111" } });
const sourd = await p.evaluate(() => {
  const a = document.querySelector(".wm-barre__alerte");
  const r = a === null ? null : a.getBoundingClientRect();
  return {
    mots: [...document.querySelectorAll(".wm-barre__bouton")].map((b) => b.textContent.trim()),
    note: document.querySelector(".wm-barre__note")?.textContent ?? "",
    alerte: a === null ? null : {
      visible: !a.hidden && r.height > 0,
      titre: a.querySelector(".wm-barre__alerte-titre")?.textContent ?? "",
      texte: a.querySelector(".wm-barre__alerte-texte")?.textContent ?? "",
      lien: a.querySelector("a")?.getAttribute("href") ?? null,
      //  LA CIBLE TACTILE DU LIEN : une sortie qu'on ne peut pas viser
      //  au doigt n'est pas une sortie.
      hauteurDuLien: Math.round(
        a.querySelector("a")?.getBoundingClientRect().height ?? 0,
      ),
      //  IL SE DÉTACHE : un bloc d'erreur qui a le fond de la barre
      //  n'est pas mis en avant, c'est un paragraphe de plus.
      fond: getComputedStyle(a).backgroundColor,
      fondDeLaBarre: getComputedStyle(document.querySelector(".wm-barre")).backgroundColor,
      filet: getComputedStyle(a).borderTopWidth,
      filetGauche: getComputedStyle(a).borderLeftWidth,
      pastille: (() => {
        const b = a.querySelector(".wm-barre__alerte-pastille");
        const t = a.querySelector(".wm-barre__alerte-titre");
        if (b === null || t === null) return null;
        const rb = b.getBoundingClientRect();
        return {
          largeur: Math.round(rb.width),
          hauteur: Math.round(rb.height),
          avantLeTitre: rb.right <= t.getBoundingClientRect().left + 1,
        };
      })(),
      //  L'ESPACE AVEC « TON TOUR », demandé le 18 novembre.
      espaceEnHaut: (() => {
        const e = document.querySelector(".wm-barre__entete");
        return e === null ? 0 : Math.round(r.top - e.getBoundingClientRect().bottom);
      })(),
    },
  };
});
dire(
  "LES CINQ BOUTONS DU COMBAT, « FUIR » COMPRIS",
  sourd.mots.length === 5 && sourd.mots.includes("Fuir"),
  JSON.stringify(sourd.mots),
);
//  ── « UN BLOC D'ERREUR MIS EN AVANT », ET PAS UNE PHRASE GRISE ───
//
//  18 novembre : « quand le compte n'est pas lié, tu ne peux pas
//  afficher juste ce petit message ». La première version mettait la
//  phrase dans la note sous les boutons — là où l'œil ne lit que ce
//  qui change au clic. Un blocage qui demande une action ne vit pas
//  là.
dire(
  "LE BLOC D'ERREUR EST VISIBLE, AVEC SON TITRE",
  sourd.alerte !== null && sourd.alerte.visible &&
    sourd.alerte.titre.includes("carnet n'est pas relié"),
  JSON.stringify(sourd.alerte && {
    visible: sourd.alerte.visible,
    titre: sourd.alerte.titre,
  }),
);
//  LE FILET DU HAUT EST PARTI LE 18 NOVEMBRE — « enlève la border
//  top » — et une pastille le remplace. L'essai demandait sa
//  présence ; il demande maintenant son ABSENCE, et celle de la
//  bulle qui prend le relais. Ce qui ne change pas : le bloc doit se
//  détacher du fond de la barre, sinon ce n'est pas un bloc d'erreur,
//  c'est un paragraphe.
dire(
  "il se détache du fond de la barre, sans aucun filet",
  sourd.alerte !== null && sourd.alerte.fond !== sourd.alerte.fondDeLaBarre &&
    sourd.alerte.filet === "0px" && sourd.alerte.filetGauche === "0px",
  JSON.stringify(sourd.alerte && {
    fond: sourd.alerte.fond,
    barre: sourd.alerte.fondDeLaBarre,
    haut: sourd.alerte.filet,
    gauche: sourd.alerte.filetGauche,
  }),
);
dire(
  "LA PASTILLE EST RONDE, À GAUCHE DU TITRE, ET ELLE NE S'ÉCRASE PAS",
  sourd.alerte !== null && sourd.alerte.pastille !== null &&
    sourd.alerte.pastille.largeur === sourd.alerte.pastille.hauteur &&
    sourd.alerte.pastille.avantLeTitre,
  JSON.stringify(sourd.alerte?.pastille),
);
dire(
  "et l'alerte respire sous « Ton tour »",
  sourd.alerte !== null && sourd.alerte.espaceEnHaut >= 10,
  `${sourd.alerte?.espaceEnHaut} px sous l'en-tête`,
);
dire(
  "il dit quoi faire ET où, avec une cible qu'un doigt peut viser",
  sourd.alerte !== null && sourd.alerte.lien === "/h17-mon-carnet" &&
    sourd.alerte.hauteurDuLien >= 44,
  JSON.stringify(sourd.alerte && {
    lien: sourd.alerte.lien,
    hauteur: sourd.alerte.hauteurDuLien,
  }),
);
dire(
  "et le texte nomme les quatre choix hors de portée, sans mentir sur le sac",
  sourd.alerte !== null && sourd.alerte.texte.includes("ne peut pas lire") &&
    !sourd.alerte.texte.includes("aucune"),
  sourd.alerte?.texte,
);
//  UNE PHOTO DU BLOC D'ERREUR, QUAND ON LA DEMANDE. « Il faut que ce
//  soit plus clair, que ça apparaisse comme un bloc mis en avant » :
//  « mis en avant » se regarde, il ne se mesure pas.
if (Deno.args.includes("--photo")) {
  const barre = await p.$(".wm-barre");
  await barre.screenshot({ path: `${R}barre-carnet.png` });
  console.log("photo : barre-carnet.png");
}
await clic(p, "Fuir");
await envoyer(p);
const fuite = await lire(p);
dire(
  "FUIR ÉCRIT SON BLOC — le bouton agit, il n'est pas un décor",
  fuite.includes("[[WM-ACTION:fuir]]"),
  fuite.trim(),
);
await p.close();

// ── 11 · LE FORMULAIRE DE CRÉATION D'UN SUJET ──────────────────────
//
//  « Quand je crée un sujet, dans les zones sauvages, il faut pouvoir
//  déjà avoir les options » — 18 novembre.
//
//  DEUX CHOSES CHANGENT SUR CETTE PAGE, et il faut les deux pour que le
//  harnais dise la vérité :
//
//    · PAS DE FIL D'ARIANE. `posting_body` ne le porte pas, donc
//      `forumDeLaPage` rend `null` et la barre ne se posait pas du
//      tout. C'est le défaut même qu'on corrige : le monter avec le fil
//      aurait fait passer le test sans rien prouver.
//    · PAS DE SUJET DANS L'ADRESSE. `/post?f=9&mode=newtopic` — donc
//      pas de clôture, et aucun combat à demander.
console.log("\n── LE FORMULAIRE DE CRÉATION ──────────────────────────");
p = await monter({
  quick: false,
  fil: false,
  adresse: "/post?f=9&mode=newtopic",
});
const creation = await p.evaluate(() => ({
  barres: document.querySelectorAll(".wm-barre").length,
  mots: [...document.querySelectorAll(".wm-barre__bouton")].map((b) => b.textContent.trim()),
  attente: document.querySelector(".wm-barre__attente")?.hidden,
}));
dire(
  "LA BARRE SE POSE, SANS FIL D'ARIANE — le forum vient de `f=` dans l'adresse",
  creation.barres === 1,
  `${creation.barres} barre(s)`,
);
dire(
  "TROIS CHOIX, SANS LA CLÔTURE — on ne clôt pas un sujet qui n'existe pas",
  JSON.stringify(creation.mots) === JSON.stringify([RIEN, APPARAITRE, FOUILLER]),
  JSON.stringify(creation.mots),
);

//  ET L'ACTION S'ÉCRIT QUAND MÊME : une barre qui s'affiche sans
//  envoyer serait pire que pas de barre.
await p.evaluate(() => {
  const b = [...document.querySelectorAll(".wm-barre__bouton")]
    .find((x) => x.textContent.includes("apparaître"));
  b.click();
  document.querySelector("form[name=post]").dispatchEvent(new Event("submit"));
});
const ecritALaCreation = await p.evaluate(() =>
  document.querySelector("#text_editor_textarea").value
);
dire(
  "LE BLOC PART DEPUIS LA CRÉATION",
  ecritALaCreation.includes(BLOC),
  JSON.stringify(ecritALaCreation.slice(-60)),
);
await p.close();

// ── 12 · LA PHRASE D'ATTENTE ───────────────────────────────────────
//
//  « Il faut mettre un petit message aussi au joueur pour dire que
//  lorsqu'on effectue une action, attendre quelques minutes. »
//
//  ELLE NE DOIT PAS PARAÎTRE SUR « NE RIEN FAIRE » : annoncer un délai
//  pour un message normal ferait attendre une réponse qui ne vient pas.
console.log("\n── LA PHRASE D'ATTENTE ────────────────────────────────");
p = await monter({});
const attenteAuDepart = await p.evaluate(() => ({
  cache: document.querySelector(".wm-barre__attente").hidden,
  choisi: [...document.querySelectorAll(".wm-barre__bouton")]
    .find((x) => x.getAttribute("aria-checked") === "true")?.textContent.trim(),
}));
dire(
  "CACHÉE SUR « NE RIEN FAIRE »",
  attenteAuDepart.cache === true && attenteAuDepart.choisi === RIEN,
  `cachée : ${attenteAuDepart.cache}, choisi : ${attenteAuDepart.choisi}`,
);

const attenteSurAction = await p.evaluate(() => {
  [...document.querySelectorAll(".wm-barre__bouton")]
    .find((x) => x.textContent.includes("Fouiller")).click();
  const ph = document.querySelector(".wm-barre__attente");
  return { cache: ph.hidden, mots: ph.textContent.trim() };
});
dire(
  "VISIBLE DÈS QU'UNE ACTION EST ARMÉE",
  attenteSurAction.cache === false && /minutes/.test(attenteSurAction.mots),
  JSON.stringify(attenteSurAction.mots.slice(0, 70)),
);
await p.close();

await nav.close();

console.log(soucis.length === 0 ? "\nTOUT PASSE." : `\n${soucis.length} DÉFAUT(S).`);
for (const s of soucis) console.log("  · " + s);
if (soucis.length > 0) Deno.exit(1);
