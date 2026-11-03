// ════════════════════════════════════════════════════════════════════
//  outils/carnet.mjs — le harnais du carnet de bord
//
//  Ce qu'il monte : la page `pages/carnet.html` SERVIE À SON ADRESSE
//  RÉELLE, `https://mysteryinrhode.forumactif.com/h15-mon-carnet`, avec
//  le vrai paquet `js/carnet.js`, les vraies feuilles et les vraies
//  données du dépôt. Seul l'appel à Supabase est joué par le décor —
//  c'est la seule chose qu'on ne peut pas servir depuis des fichiers.
//
//  POURQUOI L'ADRESSE RÉELLE. `contraste.mjs` l'a appris le 2 novembre
//  sur les annexes : servir la page sur `about:blank` cachait deux
//  vrais défauts de thème sombre, parce que les règles qui dépendent de
//  l'origine ne s'appliquaient pas. Une page servie ailleurs qu'où elle
//  vit ne teste qu'elle-même.
//
//  ── CE QUE CE HARNAIS GARDE, ET QUI NE SE VOIT PAS AUTREMENT ────────
//
//  1. **Un seul appel, et aucun en changeant d'onglet.** C'est LA
//     contrainte de la note 371:707, et elle est invisible à l'œil :
//     une page qui refait une requête par onglet marche très bien et
//     coûte six fois plus.
//  2. **Sans clé, aucune requête.** Une page qui appellerait quand
//     même enverrait une clé vide à chaque ouverture.
//  3. **Un refus parle français.** `CLE_INVALIDE` dans une page de jeu
//     ne veut rien dire pour la joueuse qui vient de coller sa clé.
//  4. **La clé n'est gardée qu'après avoir servi.** Sinon une clé
//     fausse s'installe et la page rouvre sur la même erreur.
//  5. **Rien ne se clique qui modifie les données.** Le carnet montre.
// ════════════════════════════════════════════════════════════════════

import { readFileSync } from "node:fs";
import { chromium } from "npm:playwright@1.56.0";

const R = new URL("..", import.meta.url).pathname;
const ADRESSE = "https://mysteryinrhode.forumactif.com/h15-mon-carnet";
const BASE = "https://by-teenspirit.github.io/wild-mystery/";

const CHEMINS = [
  "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
  "/opt/pw-browsers/chromium/chrome-linux64/chrome",
];
let CHROME;
for (const c of CHEMINS) {
  try {
    Deno.statSync(c);
    CHROME = c;
    break;
  } catch { /* suivant */ }
}
if (CHROME === undefined) {
  for (const base of ["/root/.cache/ms-playwright", "/opt/pw-browsers"]) {
    try {
      for (const e of Deno.readDirSync(base)) {
        if (!e.name.startsWith("chromium")) continue;
        for (const n of ["chrome-linux/chrome", "chrome-linux64/chrome"]) {
          const c = `${base}/${e.name}/${n}`;
          try {
            Deno.statSync(c);
            CHROME = c;
          } catch { /* suivant */ }
        }
      }
    } catch { /* suivant */ }
  }
}
if (CHROME === undefined) {
  console.error("Aucun Chromium trouvé. `deno task test:navigateur` en installe un.");
  Deno.exit(1);
}

/*  LA RÉPONSE DE `carnet()`, dans la forme exacte que la migration
    0019 rend. Les identifiants d'espèce sont réels — Onix, Pikachu,
    Carapuce — parce que la page va chercher leurs noms dans le vrai
    `especes.json` : avec des numéros inventés, la colonne des noms
    serait vide et le harnais ne le verrait pas.

    UN POKÉMON EN PENSION QUI GARDE SA PLACE, et un en boîte : les deux
    cas que `equipeAffichee` doit traiter différemment, et qui se
    ressemblent assez pour qu'une inversion passe inaperçue. */
const CARNET = {
  dresseur: {
    joueurId: "eeee0000-0000-0000-0000-000000000001",
    forumUserId: 4,
    pseudo: "Eliott Vanner",
    groupe: "hardi",
    palier: 2,
    pokedollars: 1240,
    lieLe: "2026-06-12T09:00:00Z",
  },
  pokemon: [
    {
      id: "p1", especeId: 95, surnom: null, niveau: 26, xp: 7440, sexe: "M",
      obscur: false, etoiles: null, emplacement: "equipe", boite: 0, place: 1,
      captureLe: "2026-06-14T10:00:00Z", captureDans: 34, enPension: false,
    },
    {
      id: "p2", especeId: 25, surnom: "Pika", niveau: 24, xp: 5000, sexe: "F",
      obscur: false, etoiles: null, emplacement: "equipe", boite: 0, place: 2,
      captureLe: "2026-07-01T10:00:00Z", captureDans: 36, enPension: true,
    },
    {
      id: "p3", especeId: 7, surnom: null, niveau: 21, xp: 3000, sexe: "M",
      obscur: true, etoiles: 2, emplacement: "equipe", boite: 0, place: 4,
      captureLe: "2026-08-02T10:00:00Z", captureDans: 32, enPension: false,
    },
    {
      id: "p4", especeId: 562, surnom: "EnBoite", niveau: 9, xp: 100, sexe: null,
      obscur: false, etoiles: null, emplacement: "boite", boite: 2, place: 5,
      captureLe: "2026-08-20T10:00:00Z", captureDans: 36, enPension: false,
    },
  ],
  pension: [{
    id: "s1", pokemonId: "p2", gerantId: null,
    deposeLe: "2026-10-12T10:00:00Z", niveauAuDepot: 22, tarif: 500,
  }],
  badges: [
    { arene: "Arène Feu", obtenuLe: "2026-08-12T10:00:00Z" },
    { arene: "Arène Plante", obtenuLe: "2026-09-03T10:00:00Z" },
    { arene: "Colosseum de Rhode", obtenuLe: "2026-09-20T10:00:00Z" },
  ],
  sac: [
    { objetId: 990001, quantite: 4 },
    { objetId: 990002, quantite: 5 },
    { objetId: 990020, quantite: 3 },
  ],
  pokedex: [
    { especeId: 562, croiseLe: "2026-06-14T10:00:00Z", attrapeLe: "2026-06-20T10:00:00Z", fois: 3 },
    { especeId: 557, croiseLe: "2026-07-01T10:00:00Z", attrapeLe: null, fois: 0 },
    { especeId: 95, croiseLe: "2026-06-14T10:00:00Z", attrapeLe: "2026-06-14T10:00:00Z", fois: 1 },
  ],
  dernierJet: {
    messageId: 15001, sujetId: 976, type: "rencontre",
    charge: { especeId: 562 }, code: "7F3A-9C21-B4E8-05D7",
    creeLe: "2026-09-30T21:14:00Z",
  },
};

const nav = await chromium.launch({ executablePath: CHROME });
const soucis = [];

function dire(nom, ok, detail = "") {
  console.log(`  ${ok ? "ok  " : "DÉFAUT"} ${nom}${detail === "" ? "" : " — " + detail}`);
  if (!ok) soucis.push(nom + (detail === "" ? "" : " — " + detail));
}

console.log("\n── le carnet de bord ──");

/*  LA PAGE EST SERVIE TELLE QU'ELLE SERA COLLÉE, avec ses adresses
    absolues vers GitHub Pages — on les détourne vers les fichiers du
    dépôt, on ne les réécrit pas. Une page dont on aurait corrigé les
    adresses pour le harnais ne serait plus la page qu'on colle. */

//  ── LA PAGE DE PROFIL EST SERVIE PAR LE DÉCOR ─────────────────────
//
//  C'est tout le mécanisme : `/h15-mon-carnet` n'a pas d'en-tête de
//  forum, donc pas de `_userdata`, et la page va chercher DEUX choses
//  sur la page d'édition de profil du membre — son numéro de compte et
//  sa clé de liaison, que le staff y a posée.
//
//  LE PROFIL NE SERT PLUS QU'À DIRE QUI REGARDE. La clé du champ a
//  vécu huit heures : depuis la 0029 la preuve vient de Supabase Auth,
//  parce qu'un champ réservé au staff n'apparaît pas sur la page de son
//  propriétaire — mesuré le 3 novembre en compte de test, seize champs
//  au lieu de vingt-et-un.
//
//  On garde la forme réelle du formulaire quand même : la page y lit
//  `_userdata`, et c'est ce que Forumactif sert.
function pageDeProfil({ compte }) {
  const tete = compte === "invite"
    ? '_userdata["session_logged_in"] = 0;_userdata["username"] = "Anonymous";' +
      '_userdata["user_id"] = -1;'
    : '_userdata["session_logged_in"] = 1;' +
      `_userdata["username"] = "${compte.pseudo}";` +
      `_userdata["user_id"] = ${compte.id};`;

  const champs = compte === "invite" ? "" : `
    <form method="post"><div class="panel"><div class="inner"><fieldset><dl>
      <dt>Pseudo :</dt>
      <dd><input class="inputbox" type="text" name="profile_field_13_8" value="Callista" /></dd>
      <dt>Discord * :</dt>
      <dd><input class="inputbox" type="text" name="profile_field_13_1" value="callidesign" /></dd>
    </dl></fieldset></div></div></form>`;

  return `<html><head><script>var _userdata = new Object();${tete}</script></head>` +
    `<body>${champs}</body></html>`;
}

const MEMBRE = { id: 42, pseudo: "Eliott Vanner" };

//  LES JETONS DU DÉCOR. Ce ne sont pas des JWT : la page ne les lit pas,
//  elle les recopie dans un en-tête. Ce qui est mesuré est le TRAJET.
const JETON = "jeton-de-decor";
const JETON_NEUF = "jeton-rafraichi";
const RAFRAICHIR = "rafraichir-de-decor";

/*  LE RETOUR DU MAIL, dans la forme du flot implicite de Supabase. */
const RETOUR_OK = `#access_token=${JETON}&expires_in=3600` +
  `&refresh_token=${RAFRAICHIR}&token_type=bearer&type=magiclink`;
const RETOUR_MORT = "#error=access_denied&error_code=otp_expired";

async function monter(
  {
    reponse = CARNET,
    compte = MEMBRE,
    laissez = "bon",
    fragment = "",
    forumMuet = false,
    refus = null,
    otp = "ok",
    rafraichissement = "ok",
    script = "neuf",
    valideeApres = false,
    brouillons = [],
    ecriture = "ok",
  } = {},
) {
  const q = await nav.newPage({ viewport: { width: 1440, height: 1000 } });
  const appels = [];
  let liaisonJouee = false;
  let brouillonsVus = brouillons.map((b) => ({ ...b }));
  const demandes = [];
  const jetonsVus = [];
  q.on("pageerror", (e) => soucis.push("erreur JS : " + e.message));

  await q.route("**/*", (route) => {
    const u = new URL(route.request().url());
    const entetes = route.request().headers();

    //  L'ENVOI DU LIEN.
    //
    //  CE DÉCOR IGNORE LES CHAMPS QU'IL NE CONNAÎT PAS, comme GoTrue :
    //  le `POST /otp` ne lit que `email` et `create_user`, et un champ
    //  de plus dans le corps part à la poubelle sans un mot. C'est
    //  exactement ce qui a caché la faute du 3 novembre, alors le décor
    //  NOTE la destination qu'il a vraiment reçue — en paramètre d'URL,
    //  là où le client officiel la pose — et la mesure vérifie les deux
    //  côtés : le paramètre présent, et le corps sans `options`.
    if (u.pathname === "/auth/v1/otp") {
      appels.push({
        ou: "otp",
        corps: JSON.parse(route.request().postData() ?? "{}"),
        retour: u.searchParams.get("redirect_to"),
      });
      if (otp === "trop-vite") return route.fulfill({ status: 429, body: "{}" });
      if (otp === "non-autorisee") {
        //  LE SERVICE DE MAIL PAR DÉFAUT DE SUPABASE ne livre qu'aux
        //  adresses de l'équipe du projet. Ce refus-là n'est pas une
        //  panne : c'est un réglage qui manque, et il se dit autrement.
        return route.fulfill({
          status: 403,
          contentType: "application/json",
          body: JSON.stringify({ error_code: "email_address_not_authorized" }),
        });
      }
      if (otp === "refus") {
        return route.fulfill({
          status: 400,
          contentType: "application/json",
          body: JSON.stringify({ error_code: "validation_failed" }),
        });
      }
      return route.fulfill({ contentType: "application/json", body: "{}" });
    }

    //  LE RAFRAÎCHISSEMENT.
    if (u.pathname === "/auth/v1/token") {
      appels.push({ ou: "token", corps: JSON.parse(route.request().postData() ?? "{}") });
      if (rafraichissement === "refus") return route.fulfill({ status: 400, body: "{}" });
      return route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          access_token: JETON_NEUF,
          refresh_token: RAFRAICHIR,
          expires_in: 3600,
        }),
      });
    }

    //  ── POSTGREST CHOISIT LA FONCTION PAR LE NOM DE SES ARGUMENTS ────
    //
    //  C'est le défaut du 3 novembre au soir : mon code envoyait
    //  `{"p":{}}` à une fonction sans argument, et PostgREST répondait
    //  `404 PGRST202` — il cherchait une fonction qui aurait un `p`. Le
    //  décor acceptait n'importe quel corps, donc la mesure ne voyait
    //  rien, et la page accusait le staff d'une faute de mon côté.
    //
    //  Le décor refuse maintenant comme PostgREST refuse, DANS LES DEUX
    //  SENS : un `p` de trop sur la liaison, un `p` manquant sur le
    //  carnet. Les deux erreurs sont symétriques et toutes deux muettes
    //  si on ne les reproduit pas.
    const pasLaBonneSignature = (attenduP) => {
      const corps = JSON.parse(route.request().postData() ?? "{}");
      const aP = Object.hasOwn(corps, "p");
      if (aP === attenduP) return null;
      return route.fulfill({
        status: 404,
        contentType: "application/json",
        body: JSON.stringify({
          code: "PGRST202",
          details: `Searched for the function with parameter ${aP ? "p" : "none"}`,
        }),
      });
    };

    if (u.pathname.endsWith("/rest/v1/rpc/lier_mon_personnage")) {
      appels.push({
        ou: "lier",
        jeton: (entetes.authorization ?? "").replace("Bearer ", ""),
        corps: JSON.parse(route.request().postData() ?? "{}"),
      });
      const mauvais = pasLaBonneSignature(false);
      if (mauvais) return mauvais;
      if (refus === "RIEN_A_LIER") return route.fulfill({ status: 400, body: "{}" });
      liaisonJouee = true;
      return route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({ lies: 1, personnages: [] }),
      });
    }

    //  ── LA TABLE DES BROUILLONS, PAR POSTGREST ───────────────────
    //
    //  Ce n'est plus une fonction : c'est la table, et c'est la RLS qui
    //  filtre. Le décor garde les lignes en mémoire pour que
    //  l'enregistrement différé se mesure vraiment — qu'on puisse dire
    //  « après deux secondes, la base a reçu ceci », et pas seulement
    //  « une requête est partie ».
    if (u.pathname.endsWith("/rest/v1/brouillon")) {
      const jeton = (entetes.authorization ?? "").replace("Bearer ", "");
      jetonsVus.push(jeton);
      if (route.request().method() === "POST") {
        const corps = JSON.parse(route.request().postData() ?? "{}");
        appels.push({ ou: "ecrire", jeton, corps });
        if (ecriture === "refus") return route.fulfill({ status: 500, body: "{}" });
        brouillonsVus = [
          ...brouillonsVus.filter((b) => b.place !== corps.place),
          corps,
        ].sort((a, b) => a.place - b.place);
        return route.fulfill({ status: 201, body: "" });
      }
      appels.push({ ou: "brouillons", jeton });
      if (ecriture === "muet") return route.fulfill({ status: 500, body: "{}" });
      return route.fulfill({
        contentType: "application/json",
        body: JSON.stringify(brouillonsVus),
      });
    }

    if (u.pathname.endsWith("/rest/v1/rpc/carnet_de_la_session")) {
      const jeton = (entetes.authorization ?? "").replace("Bearer ", "");
      jetonsVus.push(jeton);
      appels.push({
        ou: "carnet",
        jeton,
        corps: JSON.parse(route.request().postData() ?? "{}"),
      });
      const mauvais = pasLaBonneSignature(true);
      if (mauvais) return mauvais;
      if (refus === "panne") return route.fulfill({ status: 500, body: "{}" });
      //  LE STAFF A POSÉ L'ADRESSE APRÈS LA LIAISON. Tant que la liaison
      //  n'a pas été rejouée dans cette visite, la base ne connaît
      //  personne derrière cette connexion.
      if (valideeApres && !liaisonJouee) {
        return route.fulfill({ contentType: "application/json", body: "null" });
      }
      return route.fulfill({
        contentType: "application/json",
        body: JSON.stringify(reponse),
      });
    }

    if (u.href.startsWith(BASE)) {
      const dans = u.href.slice(BASE.length);
      //  LE PAQUET D'À CÔTÉ. `"vieux"` est le 3 novembre : un script
      //  d'avant le contrat, qui n'annonce aucun numéro. `"absent"` est
      //  la panne de réseau, et `"autre"` la page restée en arrière.
      if (dans === "js/carnet.js" && script !== "neuf") {
        if (script === "absent") return route.fulfill({ status: 404, body: "" });
        return route.fulfill({
          contentType: "text/javascript; charset=utf-8",
          body: script === "autre" ? "window.wmCarnetVersion = 99;" : "/* d'avant */",
        });
      }
      try {
        const octets = readFileSync(R + dans);
        const type = dans.endsWith(".css")
          ? "text/css; charset=utf-8"
          : dans.endsWith(".js")
          ? "text/javascript; charset=utf-8"
          : dans.endsWith(".json")
          ? "application/json"
          : "application/octet-stream";
        return route.fulfill({ contentType: type, body: octets });
      } catch {
        return route.fulfill({
          contentType: "image/svg+xml",
          body: '<svg xmlns="http://www.w3.org/2000/svg" width="4" height="4"></svg>',
        });
      }
    }

    if (u.hostname.endsWith("googleapis.com") || u.hostname.endsWith("gstatic.com")) {
      return route.fulfill({ contentType: "text/css", body: "" });
    }

    if (u.pathname === "/profile") {
      demandes.push(u.pathname + u.search);
      if (forumMuet) return route.fulfill({ status: 503, body: "" });
      return route.fulfill({
        contentType: "text/html; charset=utf-8",
        body: pageDeProfil({ compte }),
      });
    }

    if (u.href.split("#")[0] === ADRESSE) {
      return route.fulfill({
        contentType: "text/html; charset=utf-8",
        body: readFileSync(R + "pages/carnet.html", "utf8"),
      });
    }

    return route.fulfill({ status: 404, body: "" });
  });

  //  LE LAISSEZ-PASSER DÉJÀ RANGÉ, s'il y en a un. `"perime"` est le cas
  //  de la visite du lendemain : le jeton est mort, celui de
  //  rafraîchissement est bon, et la page doit le remplacer sans rien
  //  demander à la joueuse.
  if (laissez !== null) {
    const expireLe = laissez === "perime" ? Date.now() - 1000 : Date.now() + 3_600_000;
    await q.addInitScript(
      (v) => localStorage.setItem("wm.carnet.laissez", v),
      JSON.stringify({ jeton: JETON, rafraichir: RAFRAICHIR, expireLe }),
    );
  }

  await q.goto(ADRESSE + fragment, { waitUntil: "load" });
  await q.waitForTimeout(900);
  return { q, appels, demandes, jetonsVus, lesBrouillons: () => brouillonsVus };
}

// ── 1 · la liaison, une fois ────────────────────────────────────────

{
  //  ── LE FILET DE DÉSACCORD ─────────────────────────────────────────
  //
  //  Le 3 novembre : page neuve collée sur le forum, script de la
  //  veille servi par Pages. Le script ne savait pas ouvrir le bloc que
  //  la page avait — écran vide, pas une phrase, et une demi-heure à
  //  chercher une panne qui n'existait pas. Ces trois mesures sont
  //  là pour que ça ne se reproduise plus en silence.
  //
  //  CELLE-CI D'ABORD : LE FILET NE DOIT PAS SE DÉCLENCHER À TORT. Un
  //  filet qui parle quand tout va bien est pire que pas de filet.
  const { q } = await monter();
  const vu = await q.evaluate(() => ({
    etat: document.querySelector(".wm-carnet")?.getAttribute("data-wm-etat") ?? null,
    souci: document.querySelector("[data-wm-carnet-souci]")?.textContent?.trim() ?? "",
  }));
  dire(
    "QUAND LES DEUX SONT D'ACCORD, LE FILET SE TAIT",
    vu.etat === "pret" && vu.souci === "",
    JSON.stringify(vu),
  );
  await q.close();
}

for (const [cas, attendu] of [["vieux", /ne s'est pas charg/i], [
  "absent",
  /ne s'est pas charg/i,
], ["autre", /pas de la m[êe]me version/i]]) {
  //  ET QUAND ILS NE LE SONT PAS, LA PAGE LE DIT. Trois façons de ne
  //  pas l'être : le script d'avant le contrat, le script qui ne
  //  descend pas du tout, et celui d'une version qu'on ne connaît pas.
  //  Les deux premières se disent pareil — pour la personne qui lit,
  //  c'est le même geste : recharger, puis prévenir le staff.
  const { q } = await monter({ script: cas });
  const vu = await q.evaluate(() => ({
    etat: document.querySelector(".wm-carnet")?.getAttribute("data-wm-etat") ?? null,
    souci: document.querySelector("[data-wm-carnet-souci]")?.textContent?.trim() ?? "",
  }));
  dire(
    `UN SCRIPT « ${cas.toUpperCase()} » NE LAISSE PAS UN ÉCRAN VIDE`,
    vu.etat === "dehors" && attendu.test(vu.souci),
    JSON.stringify({ cas, ...vu }),
  );
  await q.close();
}

{
  //  LA PREMIÈRE VISITE. « C'est la première chose à faire quand on
  //  arrive dans le carnet de bord. » Rien n'est demandé au jeu : sans
  //  laissez-passer il n'y a rien à demander.
  const { q, appels } = await monter({ laissez: null });
  const vu = await q.evaluate(() => ({
    etat: document.querySelector(".wm-carnet")?.getAttribute("data-wm-etat") ?? null,
    lierOuvert: document.querySelector("[data-wm-carnet-lier]")?.hidden === false,
    champ: document.querySelector("[data-wm-carnet-liaison] input") !== null,
  }));
  dire(
    "SANS LIAISON, LA PAGE PROPOSE DE LIER ET NE DEMANDE RIEN AU JEU",
    vu.etat === "dehors" && vu.lierOuvert && vu.champ && appels.length === 0,
    JSON.stringify({ ...vu, appels: appels.length }),
  );
  await q.close();
}

{
  //  LE FORMULAIRE ENVOIE LE LIEN, et l'adresse de retour est celle de
  //  la page — Supabase exige qu'elle soit déclarée dans la
  //  configuration du projet, donc une adresse inventée ferait refuser
  //  l'envoi sans qu'on sache pourquoi.
  const { q, appels } = await monter({ laissez: null });
  await q.fill("[data-wm-carnet-liaison] input", "callie+1@exemple.fr");
  await q.click("[data-wm-carnet-liaison] button");
  await q.waitForTimeout(300);
  const dit = await q.evaluate(() =>
    document.querySelector("[data-wm-carnet-lier-dit]")?.textContent?.trim() ?? ""
  );
  const envoi = appels.find((a) => a.ou === "otp");
  dire(
    "LE FORMULAIRE ENVOIE LE LIEN, AVEC L'ADRESSE DE RETOUR EN PARAMÈTRE D'URL",
    envoi !== undefined && envoi.corps.email === "callie+1@exemple.fr" &&
      envoi.corps.create_user === true &&
      envoi.retour === ADRESSE &&
      /bo[îi]te/i.test(dit),
    JSON.stringify({ envoi, dit }),
  );
  dire(
    "et le corps ne porte QUE ce que l'API lit — un champ de plus serait jeté en silence",
    envoi !== undefined && Object.keys(envoi.corps).sort().join() === "create_user,email",
    JSON.stringify(Object.keys(envoi?.corps ?? {})),
  );
  await q.close();
}

{
  //  UNE ADRESSE QUE LE SERVICE DE MAIL REFUSE N'EST PAS UNE PANNE DU
  //  JEU. Le service par défaut de Supabase ne livre qu'aux adresses de
  //  l'équipe du projet : tant qu'un SMTP n'est pas branché, une
  //  joueuse recevrait « réessaie dans un moment » pour un réglage qui
  //  ne se réparera jamais tout seul.
  const { q } = await monter({ laissez: null, otp: "non-autorisee" });
  await q.fill("[data-wm-carnet-liaison] input", "joueuse@exemple.fr");
  await q.click("[data-wm-carnet-liaison] button");
  await q.waitForTimeout(300);
  const dit = await q.evaluate(() =>
    document.querySelector("[data-wm-carnet-lier-dit]")?.textContent?.trim() ?? ""
  );
  dire(
    "UNE ADRESSE REFUSÉE PAR LE SERVICE DE MAIL ENVOIE VERS LE STAFF",
    /staff/i.test(dit) && !/r[ée]essaie/i.test(dit),
    JSON.stringify({ dit }),
  );
  await q.close();
}

{
  //  ET UN AUTRE REFUS PORTE SON CODE DANS LA PAGE. Celle qui tient le
  //  forum n'ouvre pas la console avant de dire « ça ne marche pas » :
  //  sans le code, la réponse est un aller-retour de plus. C'est la
  //  leçon de ce matin, écrite en mesure.
  const { q } = await monter({ laissez: null, otp: "refus" });
  await q.fill("[data-wm-carnet-liaison] input", "joueuse@exemple.fr");
  await q.click("[data-wm-carnet-liaison] button");
  await q.waitForTimeout(300);
  const dit = await q.evaluate(() =>
    document.querySelector("[data-wm-carnet-lier-dit]")?.textContent?.trim() ?? ""
  );
  dire(
    "UN REFUS INATTENDU DIT SON CODE, PAS SEULEMENT « RÉESSAIE »",
    /400/.test(dit) && /validation_failed/.test(dit),
    JSON.stringify({ dit }),
  );
  await q.close();
}

{
  //  LE DÉBIT BRIDÉ A SON PROPRE MOT. Le service de mail par défaut de
  //  Supabase ne passe que quelques messages par heure : dire « lien
  //  envoyé » ferait attendre un mail qui ne viendra pas.
  const { q } = await monter({ laissez: null, otp: "trop-vite" });
  await q.fill("[data-wm-carnet-liaison] input", "callie@exemple.fr");
  await q.click("[data-wm-carnet-liaison] button");
  await q.waitForTimeout(300);
  const dit = await q.evaluate(() =>
    document.querySelector("[data-wm-carnet-lier-dit]")?.textContent?.trim() ?? ""
  );
  dire(
    "TROP DE DEMANDES SE DIT AUTREMENT QU'UN LIEN ENVOYÉ",
    /attends/i.test(dit) && !/bo[îi]te/i.test(dit),
    JSON.stringify({ dit }),
  );
  await q.close();
}

{
  //  LE RETOUR DU MAIL. On lie, puis on ouvre, et le fragment DISPARAÎT
  //  de l'adresse : il ne part jamais au serveur, mais il reste dans la
  //  barre, dans l'historique et dans le lien qu'on copie pour demander
  //  de l'aide — et celui-là ouvre le carnet.
  const { q, appels } = await monter({ laissez: null, fragment: RETOUR_OK });
  const vu = await q.evaluate(() => ({
    etat: document.querySelector(".wm-carnet")?.getAttribute("data-wm-etat") ?? null,
    nom: document.querySelector("[data-wm-carnet-nom]")?.textContent?.trim() ?? "",
    adresse: location.href,
    garde: JSON.parse(localStorage.getItem("wm.carnet.laissez") ?? "null")?.jeton ?? null,
  }));
  const lie = appels.find((a) => a.ou === "lier");
  const carnet = appels.find((a) => a.ou === "carnet");
  dire(
    "AU RETOUR DU MAIL, ON LIE PUIS ON OUVRE, ET LE JETON QUITTE L'ADRESSE",
    vu.etat === "pret" && vu.nom === "Eliott Vanner" &&
      !vu.adresse.includes("access_token") && vu.garde === JETON &&
      lie?.jeton === JETON && carnet?.jeton === JETON,
    JSON.stringify({ ...vu, lie, carnet }),
  );
  await q.close();
}

{
  //  UN LIEN MORT SE DIT, et ce n'est pas une panne : cliquer celui du
  //  mail précédent arrive tout le temps.
  const { q, appels } = await monter({ laissez: null, fragment: RETOUR_MORT });
  const vu = await q.evaluate(() => ({
    lierOuvert: document.querySelector("[data-wm-carnet-lier]")?.hidden === false,
    dit: document.querySelector("[data-wm-carnet-lier-dit]")?.textContent?.trim() ?? "",
    adresse: location.href,
  }));
  dire(
    "UN LIEN MORT LE DIT, ET LA PAGE REPROPOSE LA LIAISON",
    vu.lierOuvert && /plus valable/i.test(vu.dit) && !vu.adresse.includes("error") &&
      appels.length === 0,
    JSON.stringify({ ...vu, appels: appels.length }),
  );
  await q.close();
}

{
  //  ── LA LIAISON S'APPELLE SANS ARGUMENT ────────────────────────────
  //
  //  PostgREST choisit la fonction par le nom de ses arguments : un
  //  `{"p":{}}` envoyé à `lier_mon_personnage()` ne l'appelle pas, il
  //  fait chercher une fonction qui aurait un `p`. Le 3 novembre au
  //  soir, cet appel-là n'a jamais atteint la base, et la page a
  //  pourtant annoncé « aucun personnage rattaché à cette adresse » —
  //  un verdict qu'elle n'avait aucun moyen de rendre.
  const { q, appels } = await monter({ laissez: null, fragment: RETOUR_OK });
  const lie = appels.find((a) => a.ou === "lier");
  const carnet = appels.find((a) => a.ou === "carnet");
  const etat = await q.evaluate(() =>
    document.querySelector(".wm-carnet")?.getAttribute("data-wm-etat") ?? null
  );
  dire(
    "LA LIAISON N'ENVOIE AUCUN ARGUMENT, LE CARNET EN ENVOIE UN",
    lie !== undefined && Object.keys(lie.corps).length === 0 &&
      carnet !== undefined && carnet.corps.p?.forumUserId === 42 && etat === "pret",
    JSON.stringify({ lier: lie?.corps, carnet: carnet?.corps, etat }),
  );
  await q.close();
}

{
  //  ── LE STAFF VALIDE APRÈS LA LIAISON, ET UN RECHARGEMENT SUFFIT ───
  //
  //  C'est l'ordre naturel : on se lie en arrivant, on est validée
  //  ensuite. La liaison ne tournait qu'au retour du mail, donc cette
  //  personne restait sur « pas encore validée » à chaque visite, pour
  //  toujours, sans savoir qu'il fallait redemander un lien.
  //
  //  Ici : session valable, PAS de retour de mail, et la base ne
  //  connaît personne tant que la liaison n'a pas été rejouée.
  const { q, appels } = await monter({ valideeApres: true });
  const vu = await q.evaluate(() => ({
    etat: document.querySelector(".wm-carnet")?.getAttribute("data-wm-etat") ?? null,
    nom: document.querySelector("[data-wm-carnet-nom]")?.textContent?.trim() ?? "",
  }));
  dire(
    "VALIDÉE APRÈS S'ÊTRE LIÉE, LE CARNET S'OUVRE QUAND MÊME",
    vu.etat === "pret" && vu.nom === "Eliott Vanner" &&
      appels.filter((a) => a.ou === "lier").length === 1 &&
      appels.filter((a) => a.ou === "carnet").length === 2,
    JSON.stringify({ ...vu, appels: appels.map((a) => a.ou) }),
  );
  await q.close();
}

{
  //  ── UN RATTRAPAGE QUI ÉCHOUE NE SE TAIT PAS ───────────────────────
  //
  //  Le trou qui a coûté la soirée du 3 novembre : le rattrapage
  //  s'écrivait `if (r.ok) { … }` sans rien dans l'autre cas. Une
  //  liaison qui lève — jeton sans adresse, fonction absente parce
  //  qu'une migration manque — tombait dans le silence, et la page
  //  affichait « ce personnage n'est pas rattaché à cette connexion ».
  //  Un verdict sur la base, par-dessus une panne que j'avais cachée.
  const { q } = await monter({ valideeApres: true, refus: "RIEN_A_LIER" });
  const vu = await q.evaluate(() => ({
    etat: document.querySelector(".wm-carnet")?.getAttribute("data-wm-etat") ?? null,
    souci: document.querySelector("[data-wm-carnet-souci]")?.textContent?.trim() ?? "",
  }));
  dire(
    "UN RATTRAPAGE QUI ÉCHOUE DIT LA PANNE, PAS « PAS RATTACHÉ »",
    vu.etat === "dehors" && /400/.test(vu.souci) && !/pas rattaché/i.test(vu.souci),
    JSON.stringify(vu),
  );
  await q.close();
}

{
  //  ET ON NE REJOUE PAS LA LIAISON POUR RIEN. Une visite ordinaire qui
  //  trouve son carnet ne fait qu'un appel : la seconde chance est un
  //  rattrapage, pas une habitude.
  const { q, appels } = await monter();
  dire(
    "un carnet trouvé du premier coup ne rejoue pas la liaison",
    appels.filter((a) => a.ou === "lier").length === 0 &&
      appels.filter((a) => a.ou === "carnet").length === 1,
    JSON.stringify(appels.map((a) => a.ou)),
  );
  await q.close();
}


// ── 3 · Écrire ──────────────────────────────────────────────────────

const TROIS = [
  { place: 1, sujet_id: 1002, titre: "La brume ne lève pas", corps: "[b]Elle[/b] sortit la main",
    mots: 4, modifie_le: new Date(Date.now() - 4 * 60_000).toISOString() },
  { place: 2, sujet_id: null, titre: "", corps: "deux mots", mots: 2,
    modifie_le: new Date(Date.now() - 86_400_000).toISOString() },
];

{
  //  LES TROIS PLACES SONT TOUJOURS DESSINÉES, PLEINES OU VIDES. La
  //  base tient la limite à trois (`unique (joueur_id, place)`, 0032) ;
  //  l'écran la montre telle quelle, plutôt qu'une liste qui grandit et
  //  un message quand elle déborde.
  const { q } = await monter({ brouillons: TROIS });
  await q.click('[data-wm-carnet-onglet="ecrire"]');
  await q.waitForTimeout(200);
  const vu = await q.evaluate(() => ({
    places: [...document.querySelectorAll(".wm-ecrire__place-nom")].map((e) =>
      e.textContent.trim()
    ),
    outils: document.querySelectorAll(".wm-ecrire__outil").length,
    corps: document.querySelector("[data-wm-ecrire-corps]")?.value ?? "",
    mots: document.querySelector("[data-wm-ecrire-mots]")?.textContent ?? "",
  }));
  dire(
    "TROIS PLACES DESSINÉES, LA PREMIÈRE OUVERTE, SEPT OUTILS",
    vu.places.length === 3 && vu.places[2] === "Place libre" &&
      vu.places[0] === "La brume ne lève pas" && vu.outils === 7 &&
      vu.corps === "[b]Elle[/b] sortit la main" && vu.mots === "4",
    JSON.stringify(vu),
  );
  await q.close();
}

{
  //  ── UN SEUL APPEL AU CHARGEMENT, ET UN SEUL POUR LES BROUILLONS ──
  //
  //  La note dit « un seul appel au chargement » et « changer d'onglet
  //  ne déclenche aucune requête ». Les brouillons tiennent la
  //  première et s'écartent de la seconde : une requête la PREMIÈRE
  //  fois qu'on ouvre Écrire, et plus jamais. Les prendre dans l'appel
  //  du carnet ferait descendre trois textes de RP à quelqu'un qui
  //  vient regarder son équipe.
  const { q, appels } = await monter({ brouillons: TROIS });
  const auChargement = appels.length;
  await q.click('[data-wm-carnet-onglet="ecrire"]');
  await q.waitForTimeout(250);
  const apresEcrire = appels.length;
  await q.click('[data-wm-carnet-onglet="mon-sac"]');
  await q.click('[data-wm-carnet-onglet="ecrire"]');
  await q.click('[data-wm-carnet-onglet="mon-pokedex"]');
  await q.click('[data-wm-carnet-onglet="ecrire"]');
  await q.waitForTimeout(250);
  dire(
    "UN SEUL APPEL AU CHARGEMENT, UN SEUL POUR LES BROUILLONS, ET PLUS RIEN",
    auChargement === 1 && apresEcrire === 2 && appels.length === 2,
    JSON.stringify({ auChargement, apresEcrire, total: appels.length }),
  );
  await q.close();
}

{
  //  LE COMPTEUR NE COMPTE NI LES BALISES NI LES CITATIONS, et il le
  //  fait DANS LA PAGE — la fonction pure est mesurée ailleurs, ici on
  //  vérifie qu'elle est bien celle qui est branchée.
  const { q } = await monter({ brouillons: TROIS });
  await q.click('[data-wm-carnet-onglet="ecrire"]');
  await q.fill("[data-wm-ecrire-corps]", "[quote]tout ce qu'elle avait dit avant[/quote][b]trois petits mots[/b]");
  await q.waitForTimeout(100);
  const mots = await q.evaluate(() =>
    document.querySelector("[data-wm-ecrire-mots]")?.textContent ?? ""
  );
  dire(
    "LE COMPTEUR IGNORE LES CITATIONS ET LES BALISES",
    mots === "3",
    JSON.stringify({ mots }),
  );
  await q.close();
}

{
  //  L'ENREGISTREMENT EST DIFFÉRÉ DE DEUX SECONDES, et le filet local
  //  est immédiat. Les confondre ferait une requête par lettre ; ne
  //  garder que le différé perdrait le texte si le réseau lâche entre
  //  deux frappes.
  const { q, appels } = await monter({ brouillons: TROIS });
  await q.click('[data-wm-carnet-onglet="ecrire"]');
  await q.fill("[data-wm-ecrire-corps]", "un texte tout neuf");
  await q.waitForTimeout(400);
  const tot = {
    ecrits: appels.filter((a) => a.ou === "ecrire").length,
    local: await q.evaluate(() =>
      JSON.parse(localStorage.getItem("wm.carnet.brouillon") ?? "null")?.corps ?? null
    ),
  };
  await q.waitForTimeout(2200);
  const apres = appels.filter((a) => a.ou === "ecrire");
  dire(
    "LE FILET LOCAL EST IMMÉDIAT, L'ENREGISTREMENT ATTEND DEUX SECONDES",
    tot.ecrits === 0 && tot.local === "un texte tout neuf" &&
      apres.length === 1 && apres[0].corps.corps === "un texte tout neuf" &&
      apres[0].corps.mots === 4 && apres[0].corps.place === 1,
    JSON.stringify({ ...tot, apres: apres.length, corps: apres[0]?.corps }),
  );
  await q.close();
}

{
  //  ET IL PART AVEC LE JETON DU JOUEUR, pas avec la clé publiable. La
  //  RLS ne protège rien si la requête n'est pas authentifiée.
  const { q, appels, jetonsVus } = await monter({ brouillons: TROIS });
  await q.click('[data-wm-carnet-onglet="ecrire"]');
  await q.fill("[data-wm-ecrire-corps]", "x");
  await q.waitForTimeout(2300);
  const ecrit = appels.find((a) => a.ou === "ecrire");
  dire(
    "l'écriture porte le jeton du joueur, et le joueur_id est le sien",
    ecrit?.jeton === JETON &&
      ecrit?.corps.joueur_id === "eeee0000-0000-0000-0000-000000000001" &&
      jetonsVus.every((j) => j !== "" && !j.startsWith("sb_")),
    JSON.stringify({ jeton: ecrit?.jeton, joueur: ecrit?.corps.joueur_id }),
  );
  await q.close();
}

{
  //  UN ENREGISTREMENT REFUSÉ NE DIT PAS « ENREGISTRÉ ». C'est la
  //  faute de la soirée du 3 novembre, en plus petit : annoncer un
  //  succès qu'on n'a pas constaté. Et la phrase dit que le texte est
  //  gardé, parce que c'est vrai et que c'est ce qui rassure.
  const { q } = await monter({ brouillons: TROIS, ecriture: "refus" });
  await q.click('[data-wm-carnet-onglet="ecrire"]');
  await q.fill("[data-wm-ecrire-corps]", "du texte qui ne passera pas");
  await q.waitForTimeout(2300);
  const etat = await q.evaluate(() =>
    document.querySelector("[data-wm-ecrire-etat]")?.textContent?.trim() ?? ""
  );
  dire(
    "UN ENREGISTREMENT REFUSÉ LE DIT, ET RASSURE SUR LE TEXTE",
    /pas enregistr/i.test(etat) && /gard/i.test(etat),
    JSON.stringify({ etat }),
  );
  await q.close();
}

{
  //  UN OUTIL ENTOURE LA SÉLECTION ET LA GARDE CHOISIE : sans ça,
  //  enchaîner gras puis italique demande de re-sélectionner.
  const { q } = await monter({ brouillons: TROIS });
  await q.click('[data-wm-carnet-onglet="ecrire"]');
  await q.waitForTimeout(250);
  await q.evaluate(() => {
    const c = document.querySelector("[data-wm-ecrire-corps]");
    c.value = "le mot juste";
    c.setSelectionRange(3, 6);
    c.focus();
  });
  await q.click('.wm-ecrire__outil[aria-label="gras"]');
  await q.waitForTimeout(100);
  const vu = await q.evaluate(() => {
    const c = document.querySelector("[data-wm-ecrire-corps]");
    return { texte: c.value, choisi: c.value.slice(c.selectionStart, c.selectionEnd) };
  });
  dire(
    "UN OUTIL ÉCRIT DU BBCODE AUTOUR DE LA SÉLECTION, ET LA GARDE",
    vu.texte === "le [b]mot[/b] juste" && vu.choisi === "mot",
    JSON.stringify(vu),
  );
  await q.close();
}

{
  //  LE FOCUS N'EST PAS UNE PAGE : l'adresse ne change pas, le texte ne
  //  bouge pas, et ce qui n'est pas le texte disparaît.
  const { q } = await monter({ brouillons: TROIS });
  await q.click('[data-wm-carnet-onglet="ecrire"]');
  await q.fill("[data-wm-ecrire-corps]", "le texte de la session");
  const avant = await q.evaluate(() => location.href);
  await q.click("[data-wm-ecrire-focus]");
  await q.waitForTimeout(200);
  const vu = await q.evaluate(() => ({
    pose: document.querySelector('[data-wm-carnet-page="ecrire"]')
      ?.hasAttribute("data-wm-focus") ?? false,
    blocsVisibles: [...document.querySelectorAll('[data-wm-carnet-page="ecrire"] .wm-carnet__bloc')]
      .filter((e) => e.getBoundingClientRect().height > 0).length,
    texte: document.querySelector("[data-wm-ecrire-corps]")?.value ?? "",
    adresse: location.href,
  }));
  dire(
    "LE MODE FOCUS CACHE TOUT SAUF LE TEXTE, SANS CHANGER L'ADRESSE",
    vu.pose && vu.blocsVisibles === 0 && vu.texte === "le texte de la session" &&
      vu.adresse === avant,
    JSON.stringify(vu),
  );
  await q.close();
}

{
  //  LA SESSION VIT DANS LE NAVIGATEUR, ET N'EN SORT PAS. « Une session
  //  n'est pas une donnée de jeu et ne rapporte rien. »
  const { q, appels } = await monter({ brouillons: TROIS });
  await q.click('[data-wm-carnet-onglet="ecrire"]');
  const avant = appels.length;
  await q.click('.wm-ecrire__duree[data-minutes="25"]');
  await q.waitForTimeout(200);
  const vu = await q.evaluate(() => ({
    dit: document.querySelector("[data-wm-ecrire-en-cours]")?.textContent?.trim() ?? "",
    choisie: document.querySelector('.wm-ecrire__duree[data-minutes="25"]')
      ?.getAttribute("aria-pressed"),
    durees: document.querySelectorAll(".wm-ecrire__duree").length,
  }));
  dire(
    "LANCER UNE SESSION N'ENVOIE RIEN AU SERVEUR",
    appels.length === avant && /24:|25:/.test(vu.dit) && vu.choisie === "true" &&
      vu.durees === 5,
    JSON.stringify({ ...vu, appelsEnPlus: appels.length - avant }),
  );
  await q.close();
}

// ── 2 · la session ouvre le carnet ──────────────────────────────────

{
  //  LA VISITE SUIVANTE : le laissez-passer est rangé, la page s'ouvre
  //  sans rien demander. C'est le « une seule fois » tenu.
  const { q, appels, jetonsVus } = await monter();
  const vu = await q.evaluate(() => ({
    etat: document.querySelector(".wm-carnet")?.getAttribute("data-wm-etat") ?? null,
    nom: document.querySelector("[data-wm-carnet-nom]")?.textContent?.trim() ?? "",
    lierCache: document.querySelector("[data-wm-carnet-lier]")?.hidden === true,
  }));
  const carnet = appels.find((a) => a.ou === "carnet");
  dire(
    "AVEC UNE SESSION, LE CARNET S'OUVRE SANS RIEN DEMANDER",
    vu.etat === "pret" && vu.nom === "Eliott Vanner" && vu.lierCache &&
      appels.filter((a) => a.ou === "lier").length === 0 &&
      carnet?.corps?.p?.forumUserId === MEMBRE.id,
    JSON.stringify({ ...vu, carnet }),
  );
  //  LE JETON PART DANS L'EN-TÊTE, et c'est lui qui fait voir
  //  `authenticated` à PostgreSQL : sans ça la base nous prendrait pour
  //  un visiteur et `auth_courant()` rendrait null.
  dire(
    "et c'est le jeton du joueur qui part, pas la clé publiable",
    jetonsVus.length === 1 && jetonsVus[0] === JETON,
    JSON.stringify(jetonsVus),
  );
  await q.close();
}

{
  //  LE JETON PÉRIMÉ SE REMPLACE TOUT SEUL. C'est la visite du
  //  lendemain : un jeton vaut une heure, et la personne ne doit pas se
  //  relier pour autant.
  const { q, appels } = await monter({ laissez: "perime" });
  const vu = await q.evaluate(() => ({
    etat: document.querySelector(".wm-carnet")?.getAttribute("data-wm-etat") ?? null,
    garde: JSON.parse(localStorage.getItem("wm.carnet.laissez") ?? "null")?.jeton ?? null,
  }));
  const carnet = appels.find((a) => a.ou === "carnet");
  dire(
    "UN JETON PÉRIMÉ SE RAFRAÎCHIT SANS RIEN DEMANDER",
    vu.etat === "pret" && vu.garde === JETON_NEUF &&
      appels.some((a) => a.ou === "token") && carnet?.jeton === JETON_NEUF,
    JSON.stringify({ ...vu, carnet }),
  );
  await q.close();
}

{
  //  ET UN RAFRAÎCHISSEMENT REFUSÉ RENVOIE À LA LIAISON, en effaçant le
  //  laissez-passer mort : le garder ferait réessayer en boucle.
  const { q } = await monter({ laissez: "perime", rafraichissement: "refus" });
  const vu = await q.evaluate(() => ({
    lierOuvert: document.querySelector("[data-wm-carnet-lier]")?.hidden === false,
    garde: localStorage.getItem("wm.carnet.laissez"),
  }));
  dire(
    "un rafraîchissement refusé efface le laissez-passer et repropose la liaison",
    vu.lierOuvert && vu.garde === null,
    JSON.stringify(vu),
  );
  await q.close();
}

{
  //  UN PERSONNAGE QUI N'EST PAS DERRIÈRE CETTE CONNEXION. Le cas de
  //  quelqu'un qui a deux adresses — `carnet_de_la_session` rend `null`
  //  — et celui d'un personnage pas encore validé. Le geste qui répare
  //  est le même : se relier avec la bonne adresse.
  const { q } = await monter({ reponse: null });
  const vu = await q.evaluate(() => ({
    lierOuvert: document.querySelector("[data-wm-carnet-lier]")?.hidden === false,
    dit: document.querySelector("[data-wm-carnet-lier-dit]")?.textContent?.trim() ?? "",
  }));
  dire(
    "UN PERSONNAGE HORS DE CETTE CONNEXION LE DIT, ET NOMME LE COMPTE",
    vu.lierOuvert && vu.dit.includes("Eliott Vanner") && /autre adresse/i.test(vu.dit),
    JSON.stringify(vu),
  );
  await q.close();
}

{
  //  UN INVITÉ DU FORUM N'EST PAS UN PROBLÈME DE LIAISON. Il n'a rien à
  //  lier : il a à se connecter au forum, et c'est tout autre chose.
  const { q, appels } = await monter({ compte: "invite" });
  const vu = await q.evaluate(() => ({
    souci: document.querySelector("[data-wm-carnet-souci]")?.textContent?.trim() ?? "",
    lierCache: document.querySelector("[data-wm-carnet-lier]")?.hidden === true,
  }));
  dire(
    "UN INVITÉ S'ENTEND DIRE DE SE CONNECTER AU FORUM, PAS DE SE LIER",
    /connecte-toi/i.test(vu.souci) && vu.lierCache && appels.length === 0,
    JSON.stringify({ ...vu, appels: appels.length }),
  );
  await q.close();
}

{
  //  LE FORUM MUET NE DOIT PAS DIRE « CONNECTE-TOI » : envoyer se
  //  connecter quelqu'un qui l'est déjà, c'est lui faire chercher une
  //  faute qui n'est pas la sienne.
  const { q, appels } = await monter({ forumMuet: true });
  const vu = await q.evaluate(() =>
    document.querySelector("[data-wm-carnet-souci]")?.textContent?.trim() ?? ""
  );
  dire(
    "le forum muet se dit autrement qu'un invité",
    vu.length > 20 && !/connecte-toi/i.test(vu) && appels.length === 0,
    JSON.stringify({ souci: vu }),
  );
  await q.close();
}

// ── 3 · le carnet ouvert ────────────────────────────────────────────

const { q: p, appels } = await monter();

{
  const vu = await p.evaluate(() => ({
    etat: document.querySelector(".wm-carnet")?.getAttribute("data-wm-etat") ?? null,
    nom: document.querySelector("[data-wm-carnet-nom]")?.textContent?.trim() ?? "",
    barre: document.querySelector("[data-wm-carnet-etat]")?.textContent?.trim() ?? "",
    actif: document.querySelector("[aria-current='page']")?.textContent?.trim() ?? null,
  }));
  const vuEmbleme = await p.evaluate(() => {
    const e = document.querySelector("[data-wm-carnet-embleme]");
    return {
      visible: e !== null && e.hidden === false,
      image: e?.querySelector("img")?.getAttribute("src") ?? null,
      mot: e?.querySelector("span")?.textContent?.trim() ?? null,
    };
  });
  dire(
    "la barre porte l'emblème de la nature du joueur, nommé",
    vuEmbleme.visible && /\/assets\/groupes\/hardi\.png$/.test(vuEmbleme.image ?? "") &&
      vuEmbleme.mot === "Hardi",
    JSON.stringify(vuEmbleme),
  );

  dire(
    "le carnet s'ouvre d'un seul appel, sur « Mon jeu »",
    vu.etat === "pret" && vu.nom === "Eliott Vanner" && vu.actif === "Mon jeu" &&
      vu.barre.includes("1 240") && appels.length === 1 &&
      appels[0]?.corps?.p?.forumUserId === MEMBRE.id,
    JSON.stringify({ ...vu, appels: appels.length }),
  );
}

{
  //  LE CŒUR DE LA NOTE 371:707. On visite les huit onglets et on
  //  recompte les appels.
  //
  //  UN DE PLUS DEPUIS L'ONGLET ÉCRIRE, et c'est le seul : la première
  //  ouverture va chercher les brouillons, parce que trois textes de RP
  //  n'ont rien à faire dans l'appel du carnet de quelqu'un qui vient
  //  regarder son équipe. Le second passage sur Écrire, lui, ne demande
  //  plus rien — c'est ce que la seconde visite mesure ici.
  const avant = appels.length;
  for (const clef of [
    "mon-sac", "mon-pokedex", "mes-rp", "ecrire", "mon-histoire", "mes-liens",
    "mes-boites", "mon-jeu",
  ]) {
    await p.click(`[data-wm-carnet-onglet='${clef}']`);
    await p.waitForTimeout(60);
  }
  const apresLePremierTour = appels.length;
  //  Second tour : plus rien ne doit partir, Écrire compris.
  for (const clef of ["ecrire", "mon-sac", "ecrire", "mon-jeu"]) {
    await p.click(`[data-wm-carnet-onglet='${clef}']`);
    await p.waitForTimeout(60);
  }
  const vu = await p.evaluate(() => ({
    visibles: [...document.querySelectorAll("[data-wm-carnet-page]")]
      .filter((s) => !s.hidden).map((s) => s.getAttribute("data-wm-carnet-page")),
    adresse: location.hash,
  }));
  dire(
    "changer d'onglet ne demande RIEN, sauf la première ouverture d'Écrire",
    apresLePremierTour === avant + 1 && appels.length === apresLePremierTour &&
      vu.visibles.length === 1 && vu.visibles[0] === "mon-jeu" &&
      vu.adresse === "#mon-jeu",
    JSON.stringify({ ...vu, appelsEnPlus: appels.length - avant }),
  );
}

{
  const vu = await p.evaluate(() => {
    const cases = [...document.querySelectorAll("[data-wm-carnet-equipe] .wm-carnet__pkmn")];
    return {
      places: cases.length,
      libres: cases.filter((c) => c.classList.contains("wm-carnet__pkmn--libre")).length,
      noms: cases.map((c) => c.querySelector(".wm-carnet__pkmn-nom")?.textContent?.trim() ?? ""),
      niveaux: cases.map((c) => c.querySelector(".wm-carnet__pkmn-niveau")?.textContent?.trim() ?? ""),
      pension: cases.filter((c) => c.classList.contains("wm-carnet__pkmn--pension")).length,
      compte: document.querySelector("[data-wm-carnet-equipe-compte]")?.textContent?.trim() ?? "",
    };
  });
  dire(
    "l'équipe a six places, le pokémon en boîte n'y est pas, celui en pension garde la sienne",
    vu.places === 6 && vu.libres === 3 && vu.noms[0] === "Onix" && vu.noms[1] === "Pika" &&
      vu.noms[3] === "Carapuce" && !vu.noms.includes("EnBoite") && vu.pension === 1 &&
      vu.niveaux[1] === "niv. 24 · en pension" && vu.compte === "3 / 6",
    JSON.stringify(vu),
  );
}

{
  const vu = await p.evaluate(() => ({
    arenes: document.querySelectorAll("[data-wm-carnet-badges='arene'] .wm-carnet__badge").length,
    colos: document.querySelectorAll("[data-wm-carnet-badges='colosseum'] .wm-carnet__badge").length,
    gagnes: document.querySelectorAll(
      "[data-wm-carnet-badges='arene'] .wm-carnet__badge:not(.wm-carnet__badge--agagner)",
    ).length,
    compte: document.querySelector("[data-wm-carnet-badges-compte]")?.textContent?.trim() ?? "",
  }));
  dire(
    "sept arènes, quatre colosseums, et le compteur de la Ligue ne compte que les arènes",
    vu.arenes === 7 && vu.colos === 4 && vu.gagnes === 2 && vu.compte === "2 / 7",
    JSON.stringify(vu),
  );
}

{
  const vu = await p.evaluate(() => {
    const dl = document.querySelector("[data-wm-carnet-jet]");
    return {
      visible: document.querySelector("[data-wm-carnet-jet-bloc]")?.hidden === false,
      code: dl?.querySelector(".wm-carnet__code")?.textContent?.trim() ?? "",
      chasseFixe: dl === null ? "" : getComputedStyle(dl.querySelector(".wm-carnet__code")).fontFamily,
    };
  });
  dire(
    "le dernier jet montre son code de vérification, en chasse fixe",
    vu.visible && vu.code === "7F3A-9C21-B4E8-05D7" && /mono|Menlo|SFMono/i.test(vu.chasseFixe),
    JSON.stringify(vu),
  );
}

{
  await p.click("[data-wm-carnet-onglet='mon-sac']");
  await p.waitForTimeout(80);
  const vu = await p.evaluate(() => ({
    familles: [...document.querySelectorAll("[data-wm-carnet-sac] .wm-carnet__famille")]
      .map((e) => e.textContent.trim()),
    objets: [...document.querySelectorAll("[data-wm-carnet-sac] .wm-carnet__objet")]
      .map((e) => e.querySelector(".wm-carnet__objet-nom")?.textContent?.trim() ?? ""),
    quantites: [...document.querySelectorAll("[data-wm-carnet-sac] .wm-carnet__quantite")]
      .map((e) => e.textContent.trim()),
  }));
  dire(
    "le sac est rangé par famille, et une famille vide ne sort pas",
    vu.familles.length === 2 && vu.familles[0] === "Pour attraper" &&
      vu.familles[1] === "Pour soigner" && vu.objets.length === 3 &&
      vu.objets.includes("Poké Ball") && vu.quantites.includes("× 4"),
    JSON.stringify(vu),
  );
}

{
  await p.click("[data-wm-carnet-onglet='mon-pokedex']");
  await p.waitForTimeout(250);
  const vu = await p.evaluate(() => ({
    cases: document.querySelectorAll("[data-wm-carnet-grille] .wm-carnet__case").length,
    attrapees: document.querySelectorAll(".wm-carnet__case--attrape").length,
    croisees: document.querySelectorAll(".wm-carnet__case--croise").length,
    compte: document.querySelector("[data-wm-carnet-dex-compte]")?.textContent?.trim() ?? "",
    total: document.querySelector("[data-wm-carnet-dex-total]")?.textContent?.trim() ?? "",
    //  LA SILHOUETTE EST LE MÊME SPRITE, ÉTEINT PAR UN FILTRE.
    filtre: (() => {
      const c = document.querySelector(".wm-carnet__case--croise img");
      return c === null ? null : getComputedStyle(c).filter;
    })(),
    //  UNE ESPÈCE INCONNUE NE MONTRE PAS SON SPRITE DU TOUT.
    inconnuSansImage: document.querySelector(".wm-carnet__case--inconnu img") === null,
    filtres: document.querySelectorAll("[data-wm-carnet-filtres] button").length,
  }));
  dire(
    "le Pokédex montre les 933 espèces, trois états, la silhouette étant le même sprite éteint",
    vu.cases === 933 && vu.attrapees === 2 && vu.croisees === 1 && vu.compte === "2 / 933" &&
      vu.total === "933" && /brightness\(0\)/.test(vu.filtre ?? "") && vu.inconnuSansImage &&
      vu.filtres === 20,
    JSON.stringify(vu),
  );
}

{
  //  LES FILTRES CACHENT ET MONTRENT, ILS NE RECHARGENT RIEN.
  const avant = appels.length;
  await p.click("[data-wm-filtre='attrape']");
  await p.waitForTimeout(120);
  const vu = await p.evaluate(() => ({
    visibles: [...document.querySelectorAll("[data-wm-carnet-grille] li")]
      .filter((li) => !li.hidden).length,
    toujoursLa: document.querySelectorAll("[data-wm-carnet-grille] li").length,
    adresse: location.hash,
  }));
  dire(
    "un filtre cache sans recharger, et s'écrit dans l'adresse",
    vu.visibles === 2 && vu.toujoursLa === 933 && vu.adresse === "#attrape" &&
      appels.length === avant,
    JSON.stringify({ ...vu, appelsEnPlus: appels.length - avant }),
  );
}

{
  //  ET LE FILTRE NE VOLE PAS L'ONGLET : `#attrape` n'est pas une clef
  //  d'onglet, donc la page reste sur Mon Pokédex.
  const vu = await p.evaluate(() => ({
    visibles: [...document.querySelectorAll("[data-wm-carnet-page]")]
      .filter((s) => !s.hidden).map((s) => s.getAttribute("data-wm-carnet-page")),
  }));
  dire(
    "un fragment de filtre ne renvoie pas sur un autre onglet",
    vu.visibles.length === 1 && vu.visibles[0] === "mon-pokedex",
    JSON.stringify(vu),
  );
}

{
  await p.click("[data-wm-filtre='toutes']");
  await p.waitForTimeout(120);
  await p.click(".wm-carnet__case--attrape");
  await p.waitForTimeout(120);
  const vu = await p.evaluate(() => {
    const f = document.querySelector("[data-wm-carnet-fiche]");
    return {
      ouverte: f?.hidden === false,
      nom: f?.querySelector(".wm-carnet__fiche-nom")?.textContent?.trim() ?? "",
      types: [...(f?.querySelectorAll(".wm-type") ?? [])].map((e) => e.textContent.trim()),
      lignes: [...(f?.querySelectorAll("dt") ?? [])].map((e) => e.textContent.trim()),
      lien: f?.querySelector("a")?.getAttribute("href") ?? null,
    };
  });
  dire(
    "cliquer une espèce attrapée ouvre sa fiche, avec son type nommé et le lien vers la carte",
    vu.ouverte && vu.nom !== "" && vu.types.length >= 1 && vu.types[0] !== "" &&
      vu.lignes.includes("Où") && vu.lignes.includes("Niveaux") &&
      /^\/h9-la-carte-de-rhode#zone-\d+$/.test(vu.lien ?? ""),
    JSON.stringify(vu),
  );
}

{
  //  UNE ESPÈCE INCONNUE NE DIT RIEN D'ELLE. Donner sa zone et ses
  //  niveaux avant de l'avoir croisée, c'est donner la réponse.
  await p.click("[data-wm-filtre='inconnu']");
  await p.waitForTimeout(150);
  await p.evaluate(() => {
    const c = [...document.querySelectorAll("[data-wm-carnet-grille] li")]
      .find((li) => !li.hidden)?.firstElementChild;
    c?.click();
  });
  await p.waitForTimeout(120);
  const vu = await p.evaluate(() => {
    const f = document.querySelector("[data-wm-carnet-fiche]");
    return {
      lignes: [...(f?.querySelectorAll("dt") ?? [])].map((e) => e.textContent.trim()),
      lien: f?.querySelector("a") !== null && f?.querySelector("a") !== undefined,
    };
  });
  dire(
    "une espèce pas encore croisée ne livre ni sa zone ni ses niveaux",
    !vu.lignes.includes("Où") && !vu.lignes.includes("Niveaux") && vu.lien === false,
    JSON.stringify(vu),
  );
}

//  UN JOUEUR QUI N'A PAS ENCORE CHOISI SA NATURE. `groupe` est
//  nullable en base, et c'est un état normal : lié avant d'avoir
//  choisi. Sans garde, la barre posait une image `groupes/.png` —
//  cassée, et visible.
{
  const sansNature = {
    ...CARNET,
    dresseur: { ...CARNET.dresseur, groupe: null },
  };
  const { q } = await monter({ reponse: sansNature });
  const vu = await q.evaluate(() => {
    const e = document.querySelector("[data-wm-carnet-embleme]");
    return {
      cache: e?.hidden ?? null,
      images: e?.querySelectorAll("img").length ?? null,
      nom: document.querySelector("[data-wm-carnet-nom]")?.textContent?.trim() ?? "",
    };
  });
  dire(
    "sans nature choisie, la barre ne pose pas d'emblème cassé",
    vu.cache === true && vu.images === 0 && vu.nom === "Eliott Vanner",
    JSON.stringify(vu),
  );
  await q.close();
}

// ── 4 · la mise en page ─────────────────────────────────────────────

{
  const vu = await p.evaluate(() => {
    const barre = document.querySelector(".wm-carnet__barre");
    const page = document.querySelector(".wm-carnet");
    const r = barre.getBoundingClientRect();
    const rp = page.getBoundingClientRect();
    return {
      largeur: Math.round(r.width),
      //  LA BARRE PREND TOUTE LA HAUTEUR : « la barre latérale doit
      //  prendre toute la hauteur », 2 novembre, la même remarque que
      //  pour les annexes.
      aussiHauteQueLaPage: Math.abs(r.height - rp.height) <= 1,
      colleAuBordGauche: Math.round(r.left) === 0,
      //  ET LA PAGE SORT DE LA BOÎTE DE 1200 px du forum.
      pleineLargeur: Math.round(rp.width) >= document.documentElement.clientWidth - 1,
    };
  });
  dire(
    "la barre latérale prend toute la hauteur et touche le bord gauche",
    vu.largeur === 236 && vu.aussiHauteQueLaPage && vu.colleAuBordGauche && vu.pleineLargeur,
    JSON.stringify(vu),
  );
}

{
  //  ZÉRO TABLEAU, QUE DU FLEXBOX (planche 49, et « je veux pas de
  //  tableau » du 2 octobre). Un `<table>` ne se replie pas sur
  //  téléphone, et cette page en a trois qui s'y prêteraient.
  const vu = await p.evaluate(() => ({
    tableaux: document.querySelectorAll("table").length,
    //  UN SEUL FORMULAIRE SUR LA PAGE, et c'est celui de la liaison —
    //  une fois dans la vie d'un personnage. Un second champ qui
    //  apparaîtrait ici serait le signe qu'un des chemins écartés est
    //  revenu : la clé à coller, ou le code à poster.
    formulaires: [...document.querySelectorAll("form")]
      .map((f) => f.hasAttribute("data-wm-carnet-liaison") ? "liaison" : "AUTRE"),
    //  ET IL EST CACHÉ quand le carnet est ouvert : la liaison ne se
    //  montre que si la page n'a pas de session.
    liaisonCachee: document.querySelector("[data-wm-carnet-lier]")?.hidden === true,
  }));
  dire(
    "AUCUN TABLEAU, ET LE SEUL FORMULAIRE EST CELUI DE LA LIAISON, CACHÉ",
    vu.tableaux === 0 && vu.formulaires.length === 1 &&
      vu.formulaires[0] === "liaison" && vu.liaisonCachee,
    JSON.stringify(vu),
  );
}

{
  //  LA PAGE AUTONOME : la marge de 8 px du navigateur, la police de
  //  base, la barre collante. Les trois défauts payés sur les annexes
  //  le 2 novembre, et le § 0 de `08-annexes.css` les règle pour les
  //  deux pages — encore faut-il que le carnet entre dans son `:has`.
  const vu = await p.evaluate(() => {
    const corps = getComputedStyle(document.body);
    const barre = document.querySelector(".wm-retour");
    return {
      marge: corps.margin,
      police: getComputedStyle(document.querySelector(".wm-carnet")).fontFamily,
      barreCollante: getComputedStyle(barre).position,
      hauteurBarre: Math.round(barre.getBoundingClientRect().height),
    };
  });
  dire(
    "la page autonome n'a ni marge de navigateur ni police par défaut",
    vu.marge === "0px" && /Nunito/.test(vu.police) && vu.barreCollante === "sticky" &&
      vu.hauteurBarre === 56,
    JSON.stringify(vu),
  );
}

{
  //  LE BOUTON DE THÈME EST LÀ, comme sur les annexes : la page n'a
  //  pas le coin d'outils du forum, donc sans lui il n'y a aucun moyen
  //  de passer en sombre.
  const vu = await p.evaluate(() => {
    const b = document.querySelector(".wm-retour__theme");
    if (b === null) return { bouton: false };
    const avant = document.body.classList.contains("wm-sombre");
    b.click();
    const apres = document.body.classList.contains("wm-sombre");
    b.click();
    return { bouton: true, bascule: avant !== apres, revient: document.body.classList.contains("wm-sombre") === avant };
  });
  dire(
    "le bouton de thème est posé et la bascule revient à son point de départ",
    vu.bouton && vu.bascule && vu.revient,
    JSON.stringify(vu),
  );
}

await p.close();

// ── 6 · sous 760 px ─────────────────────────────────────────────────

{
  const { q } = await monter();
  await q.setViewportSize({ width: 390, height: 844 });
  await q.waitForTimeout(200);
  const vu = await q.evaluate(() => {
    const page = document.querySelector(".wm-carnet");
    const onglets = document.querySelector(".wm-carnet__onglets");
    return {
      empile: getComputedStyle(page).flexDirection === "column",
      ongletsEnRangee: getComputedStyle(onglets).flexDirection === "row",
      //  PAS DE DÉBORDEMENT HORIZONTAL : c'est le défaut qu'on ne voit
      //  pas sur un grand écran et qui rend la page inutilisable au
      //  doigt.
      deborde: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    };
  });
  dire(
    "sous 760 px la barre devient une rangée, et rien ne déborde",
    vu.empile && vu.ongletsEnRangee && vu.deborde <= 0,
    JSON.stringify(vu),
  );
  await q.close();
}

await nav.close();

if (soucis.length > 0) console.log("\n-- ce qui reste --\n" + soucis.join("\n"));
console.log(soucis.length === 0 ? "\nTOUT PASSE." : `\n${soucis.length} DÉFAUT(S).`);
if (soucis.length > 0) Deno.exit(1);
