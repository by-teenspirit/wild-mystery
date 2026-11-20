// ════════════════════════════════════════════════════════════════════
//  outils/carnet.mjs — le harnais du carnet de bord
//
//  Ce qu'il monte : la page `pages/carnet.html` SERVIE À SON ADRESSE
//  RÉELLE, `https://mysteryinrhode.forumactif.com/h17-mon-carnet`, avec
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

import { mkdirSync, readFileSync } from "node:fs";
import { chromium } from "npm:playwright@1.56.0";

const R = new URL("..", import.meta.url).pathname;

//  Le nombre d'espèces du Pokédex, LU et non écrit : il a changé deux
//  fois (734 → 933 → 955) et chaque fois il était en dur quelque part.
const AU_DEX = JSON.parse(
  Deno.readTextFileSync(new URL("../data/pokedex-carnet.json", import.meta.url)),
).especes.length;
//  L'ADRESSE DE L'ANNEXE DE LA RÉGION, LUE AU SOMMAIRE. Elle était
//  écrite en dur ici et dans le module : le 4 novembre les pages du
//  forum ont reculé d'un cran et `h9` est devenu « Le staff », sans
//  qu'aucun 404 ne le dise — Forumactif ne route que sur le numéro.
const ANNEXE_REGION = (() => {
  const sommaire = JSON.parse(readFileSync(R + "data/annexes.json", "utf8"));
  const e = sommaire.sections
    .flatMap((s) => s.entrees)
    .find((x) => x.slug === "la-region-et-ses-zones");
  if (e?.adresse == null) throw new Error("l'annexe de la région n'a pas d'adresse");
  return e.adresse;
})();

const ADRESSE = "https://mysteryinrhode.forumactif.com/h17-mon-carnet";
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
    //  LE MÊME QUE `MEMBRE.id`. Il disait 4 pendant que le harnais
    //  demandait le carnet de l'utilisateur 42 : la réponse d'essai
    //  décrivait quelqu'un d'autre que celui qu'on allait chercher.
    //  Rien ne comparait les deux, alors rien ne criait — jusqu'au
    //  jour où un contrôle en a eu besoin.
    forumUserId: 42,
    pseudo: "Eliott Vanner",
    groupe: "hardi",
    palier: 2,
    pokedollars: 1240,
    lieLe: "2026-06-12T09:00:00Z",
  },
  pokemon: [
    {
      id: "p1",
      especeId: 95,
      surnom: null,
      niveau: 26,
      xp: 7440,
      sexe: "M",
      obscur: false,
      etoiles: null,
      emplacement: "equipe",
      boite: 0,
      place: 1,
      captureLe: "2026-06-14T10:00:00Z",
      captureDans: 34,
      enPension: false,
    },
    {
      id: "p2",
      especeId: 25,
      surnom: "Pika",
      niveau: 24,
      xp: 5000,
      sexe: "F",
      obscur: false,
      etoiles: null,
      emplacement: "equipe",
      boite: 0,
      place: 2,
      captureLe: "2026-07-01T10:00:00Z",
      captureDans: 36,
      enPension: true,
    },
    {
      id: "p3",
      especeId: 7,
      surnom: null,
      niveau: 21,
      xp: 3000,
      sexe: "M",
      obscur: true,
      etoiles: 2,
      emplacement: "equipe",
      boite: 0,
      place: 4,
      captureLe: "2026-08-02T10:00:00Z",
      captureDans: 32,
      enPension: false,
    },
    {
      id: "p4",
      especeId: 562,
      surnom: "EnBoite",
      niveau: 9,
      xp: 100,
      sexe: null,
      obscur: false,
      etoiles: null,
      emplacement: "boite",
      boite: 2,
      place: 5,
      captureLe: "2026-08-20T10:00:00Z",
      captureDans: 36,
      enPension: false,
    },
  ],
  pension: [{
    id: "s1",
    pokemonId: "p2",
    gerantId: null,
    deposeLe: "2026-10-12T10:00:00Z",
    niveauAuDepot: 22,
    tarif: 500,
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
    {
      especeId: 562,
      croiseLe: "2026-06-14T10:00:00Z",
      attrapeLe: "2026-06-20T10:00:00Z",
      fois: 3,
    },
    { especeId: 557, croiseLe: "2026-07-01T10:00:00Z", attrapeLe: null, fois: 0 },
    {
      especeId: 95,
      croiseLe: "2026-06-14T10:00:00Z",
      attrapeLe: "2026-06-14T10:00:00Z",
      fois: 1,
    },
  ],
  dernierJet: {
    messageId: 15001,
    sujetId: 976,
    type: "rencontre",
    charge: { especeId: 562 },
    code: "7F3A-9C21-B4E8-05D7",
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
//  C'est tout le mécanisme : `/h17-mon-carnet` n'a pas d'en-tête de
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
    fiche = {},
    lesLiens = [],
    lesRp = [],
    lesCompagnons = [],
    lesNomsDeColonnes = [],
    leRegistre = [],
    lesObjets = [],
    etatDeLaFiche = null,
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

    //  ── RANGER ───────────────────────────────────────────────────
    //
    //  Le décor REFUSE comme la base refuse : un Pokémon en pension ne
    //  bouge pas (0035). Sinon la mesure ne prouverait que ma politesse
    //  côté page — et c'est exactement le travers qui m'a coûté deux
    //  soirées cette semaine.
    if (u.pathname.endsWith("/rest/v1/rpc/ranger")) {
      const corps = JSON.parse(route.request().postData() ?? "{}");
      appels.push({ ou: "ranger", corps });
      const vise = (CARNET.pokemon ?? []).find((k) => k.id === corps.p?.pokemonId);
      if (vise?.enPension) {
        return route.fulfill({
          status: 400,
          contentType: "application/json",
          body: JSON.stringify({ code: "P0001", message: "EN_PENSION" }),
        });
      }
      return route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({ range: true, echange: false }),
      });
    }

    //  ── LES COMPAGNONS ───────────────────────────────────────────
    //
    //  La table existait depuis la 0036 et n'était lisible par
    //  personne : RLS active, aucune politique de lecture. Le décor la
    //  sert maintenant, parce que la 0058 l'ouvre.
    if (u.pathname.endsWith("/rest/v1/rp_participant")) {
      appels.push({ ou: "lire-compagnons" });
      return route.fulfill({
        contentType: "application/json",
        body: JSON.stringify(lesCompagnons),
      });
    }

    //  ── LE REGISTRE, ET LES NOMS D'OBJETS ────────────────────────
    //
    //  Le récap de butin lit le registre du sujet et ne garde que les
    //  lignes à son nom. Le décor en sert donc de DEUX joueurs : si le
    //  filtre tombait, le récap afficherait le butin de la table, et
    //  c'est exactement la faute qu'on veut voir.
    if (u.pathname.endsWith("/rest/v1/registre")) {
      appels.push({ ou: "lire-registre", ou_quoi: u.search });
      return route.fulfill({
        contentType: "application/json",
        body: JSON.stringify(leRegistre),
      });
    }

    if (u.pathname.endsWith("/rest/v1/objet")) {
      appels.push({ ou: "lire-objets", ou_quoi: u.search });
      return route.fulfill({
        contentType: "application/json",
        body: JSON.stringify(lesObjets),
      });
    }

    //  ── LES NOMS DE COLONNES ─────────────────────────────────────
    //
    //  `rp_colonne` de la 0059. L'upsert passe par un POST avec
    //  `Prefer: resolution=merge-duplicates`, et le retour au mot par
    //  défaut par un DELETE : le décor relève les deux tels quels.
    if (u.pathname.endsWith("/rest/v1/rp_colonne")) {
      const methode = route.request().method();
      if (methode === "GET") {
        appels.push({ ou: "lire-noms" });
        return route.fulfill({
          contentType: "application/json",
          body: JSON.stringify(lesNomsDeColonnes),
        });
      }
      appels.push({
        ou: `${methode}-nom`,
        corps: JSON.parse(route.request().postData() ?? "{}"),
        ou_quoi: u.search,
        prefere: route.request().headers()["prefer"] ?? "",
      });
      return route.fulfill({ status: 204, body: "" });
    }

    //  ── LE TABLEAU DES RP ────────────────────────────────────────
    //
    //  Le décor REFUSE comme la base refuse : on n'ajoute qu'une carte
    //  « prévue » (0037). Sinon la mesure ne prouverait que ma
    //  politesse côté page.
    if (u.pathname.endsWith("/rest/v1/rp")) {
      const methode = route.request().method();
      if (methode === "GET") {
        appels.push({ ou: "lire-rp" });
        return route.fulfill({
          contentType: "application/json",
          body: JSON.stringify(lesRp),
        });
      }
      const corps = JSON.parse(route.request().postData() ?? "{}");
      appels.push({ ou: `${methode}-rp`, corps, ou_quoi: u.search });
      if (methode === "POST" && corps.etat !== "prevu") {
        return route.fulfill({
          status: 403,
          contentType: "application/json",
          body: JSON.stringify({ code: "42501" }),
        });
      }
      return route.fulfill({ status: 204, body: "" });
    }

    //  ── LES LIENS ET L'ÉTAT DE LA FICHE ──────────────────────────
    if (u.pathname.endsWith("/rest/v1/lien")) {
      const methode = route.request().method();
      if (methode === "GET") {
        appels.push({ ou: "lire-lien" });
        return route.fulfill({
          contentType: "application/json",
          body: JSON.stringify(lesLiens),
        });
      }
      appels.push({
        ou: `${methode}-lien`,
        corps: JSON.parse(route.request().postData() ?? "{}"),
        ou_quoi: u.search,
      });
      return route.fulfill({ status: 204, body: "" });
    }

    if (u.pathname.endsWith("/rest/v1/rpc/fiche_a_publier")) {
      appels.push({ ou: "fiche-a-publier" });
      return route.fulfill({
        contentType: "application/json",
        body: JSON.stringify(etatDeLaFiche),
      });
    }

    if (u.pathname.endsWith("/rest/v1/rpc/fiche_est_publiee")) {
      appels.push({
        ou: "fiche-est-publiee",
        corps: JSON.parse(route.request().postData() ?? "{}"),
      });
      return route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({ ok: true }),
      });
    }

    //  ── LES QUATRE TABLES DE LA FICHE ────────────────────────────
    //
    //  PostgREST, pas une fonction : c'est la RLS qui filtre. Le décor
    //  garde les lignes pour que les interrupteurs se mesurent sur ce
    //  qui est VRAIMENT parti — « affiché » décide si un texte intime
    //  sort du carnet, et une bascule qui ne part pas est pire qu'une
    //  bascule absente.
    for (const t of ["fiche_champ", "fiche_description", "fiche_trait", "fiche_moment"]) {
      if (!u.pathname.endsWith(`/rest/v1/${t}`)) continue;
      const methode = route.request().method();
      if (methode === "GET") {
        appels.push({ ou: `lire-${t}` });
        return route.fulfill({
          contentType: "application/json",
          body: JSON.stringify(fiche[t] ?? []),
        });
      }
      const corps = JSON.parse(route.request().postData() ?? "{}");
      appels.push({ ou: `${methode}-${t}`, corps, ou_quoi: u.search });
      //  LA BASE REFUSE UN MOMENT `auto` INSÉRÉ PAR UN JOUEUR (0033) :
      //  le décor refuse pareil, sinon la mesure ne prouverait que ma
      //  politesse.
      if (t === "fiche_moment" && methode === "POST" && corps.auto === true) {
        return route.fulfill({
          status: 403,
          contentType: "application/json",
          body: JSON.stringify({
            code: "42501",
            message: "new row violates row-level security policy",
          }),
        });
      }
      return route.fulfill({ status: 204, body: "" });
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

for (
  const [cas, attendu] of [["vieux", /ne s'est pas charg/i], [
    "absent",
    /ne s'est pas charg/i,
  ], ["autre", /pas de la m[êe]me version/i]]
) {
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

  //  ── L'ONBOARDING DIT À QUOI SERT LE CARNET, AVANT DE DEMANDER ────
  //
  //  « Il faut vraiment que l'onboarding serve à expliquer à quoi il
  //  sert, comment on lie son compte » — 18 novembre. La page
  //  demandait une adresse e-mail sans s'être présentée : un titre,
  //  un champ, et c'est tout.
  //
  //  ── L'ORDRE A CHANGÉ LE 18 NOVEMBRE, ET DANS L'AUTRE SENS ──────
  //
  //  « L'action de lier son compte à gauche, et à droite comprendre à
  //  quoi ça sert. Comme quand on arrive sur la connexion d'un
  //  nouveau site. »
  //
  //  La présentation était AVANT le formulaire, et ce harnais
  //  l'exigeait. Deux colonnes maintenant : le formulaire en premier
  //  dans le balisage — c'est ce qu'on vient faire —, la présentation
  //  à sa droite. Au téléphone les colonnes s'empilent et l'ordre du
  //  balisage devient l'ordre à l'écran, d'où le sens choisi.
  //
  //  ON MESURE LES DEUX CHOSES : l'ordre du document, et la position
  //  RÉELLE à l'écran. La première sans la seconde laisserait passer
  //  une grille qui remet la présentation à gauche.
  const onb = await q.evaluate(() => {
    const pres = document.querySelector("[data-wm-carnet-presentation]");
    const form = document.querySelector("[data-wm-carnet-liaison]");
    const spam = document.querySelector("[data-wm-carnet-lier-spam]");
    const tout = document.querySelector(".wm-carnet__dehors")?.textContent ?? "";
    if (pres === null || form === null) return null;
    return {
      presentationVisible: pres.hidden === false &&
        pres.getBoundingClientRect().height > 0,
      atouts: pres.querySelectorAll(".wm-carnet__atout").length,
      //  APRÈS LE FORMULAIRE, dans l'ordre du document.
      apresLeChamp: (pres.compareDocumentPosition(form) &
        Node.DOCUMENT_POSITION_PRECEDING) !== 0,
      //  ET À SA DROITE À L'ÉCRAN, sur la même ligne : deux blocs
      //  l'un sous l'autre ne sont pas deux colonnes.
      aDroite: Math.round(pres.getBoundingClientRect().left) >
        Math.round(form.getBoundingClientRect().right),
      surLaMemeLigne: Math.abs(
        Math.round(pres.getBoundingClientRect().top) -
          Math.round(
            document.querySelector("[data-wm-carnet-lier]").getBoundingClientRect().top,
          ),
      ) <= 8,
      spamVisible: spam !== null && spam.getBoundingClientRect().height > 0,
      //  ── LES DEUX COLONNES FINISSENT SUR LA MÊME LIGNE ────────
      //
      //  « Fais en sorte que la colonne de gauche fasse la même
      //  hauteur que la colonne de droite », 19 novembre. C'est la
      //  rangée des deux encadrés qui absorbe ce qui reste sous la
      //  carte ; sans elle la page se terminait en escalier.
      //
      //  ON MESURE LES BAS, pas les hauteurs : deux colonnes de même
      //  hauteur qui ne partiraient pas du même haut finiraient
      //  quand même décalées.
      memeBas: (() => {
        const g = document.querySelector(".wm-carnet__geste");
        if (g === null) return null;
        return Math.abs(
          Math.round(g.getBoundingClientRect().bottom) -
            Math.round(pres.getBoundingClientRect().bottom),
        );
      })(),
      //  ── LE CHAMP ET SON BOUTON SUR UNE LIGNE ─────────────────
      //
      //  Ils étaient empilés. Le bouton est à droite du champ, et les
      //  deux se recouvrent verticalement — un bouton passé à la
      //  ligne les laisserait « à droite » au sens du document et
      //  l'un sous l'autre à l'écran.
      champEtBouton: (() => {
        const i = document.querySelector("[data-wm-carnet-liaison] input");
        const b = document.querySelector("[data-wm-carnet-liaison] button");
        if (i === null || b === null) return null;
        const ri = i.getBoundingClientRect();
        const rb = b.getBoundingClientRect();
        return {
          aDroite: Math.round(rb.left) >= Math.round(ri.right),
          seRecouvrent: rb.top < ri.bottom && ri.top < rb.bottom,
        };
      })(),
      //  LES QUATRE CHOSES QU'ELLE A DICTÉES, cherchées dans le texte
      //  rendu — pas dans la source : c'est ce que la joueuse lit.
      //  « VALIDATION » AUTANT QUE « VALIDÉ » : la condition était une
      //  phrase — « il faut que ton personnage soit validé » — et elle
      //  est devenue le titre de la première étape, « Attends ta
      //  validation ». C'est la même chose dite, et c'est elle qu'on
      //  cherche, pas une forme du verbe.
      ditLaValidation: /valid(é|ation)/i.test(tout),
      ditLesSpams: /spams?/i.test(tout),
      ditLeStaff: /staff/i.test(tout),
      ditLaBase: /base de données/i.test(tout),
    };
  });
  dire(
    "LA PRÉSENTATION EST LÀ, ET APRÈS LE FORMULAIRE DANS LE BALISAGE",
    onb !== null && onb.presentationVisible && onb.apresLeChamp && onb.atouts >= 6,
    JSON.stringify(
      onb && {
        visible: onb.presentationVisible,
        atouts: onb.atouts,
        apres: onb.apresLeChamp,
      },
    ),
  );
  dire(
    "ET ELLE EST BIEN À DROITE, SUR LA MÊME LIGNE — deux colonnes, pas deux étages",
    onb?.aDroite === true && onb?.surLaMemeLigne === true,
    JSON.stringify(onb && { aDroite: onb.aDroite, memeLigne: onb.surLaMemeLigne }),
  );
  dire(
    "ELLE DIT LA VALIDATION, LES SPAMS, LE STAFF, ET D'OÙ VIENNENT LES DONNÉES",
    onb !== null && onb.ditLaValidation && onb.ditLesSpams && onb.ditLeStaff &&
      onb.ditLaBase,
    JSON.stringify(
      onb && {
        validation: onb.ditLaValidation,
        spams: onb.ditLesSpams,
        staff: onb.ditLeStaff,
        base: onb.ditLaBase,
      },
    ),
  );
  dire(
    "et l'encart des spams se voit sans avoir à chercher",
    onb?.spamVisible === true,
    String(onb?.spamVisible),
  );
  dire(
    "LES DEUX COLONNES FINISSENT SUR LA MÊME LIGNE",
    onb !== null && onb.memeBas !== null && onb.memeBas <= 2,
    `${onb?.memeBas} px d'écart entre les deux bas`,
  );
  dire(
    "ET LE CHAMP ET SON BOUTON TIENNENT SUR UNE LIGNE",
    onb?.champEtBouton?.aDroite === true &&
      onb?.champEtBouton?.seRecouvrent === true,
    JSON.stringify(onb?.champEtBouton),
  );
  //  UNE PHOTO DE L'ONBOARDING. C'est une page qu'on lit : sa
  //  hiérarchie et sa longueur se regardent, elles ne se comptent pas.
  if (Deno.args.includes("--photo")) {
    const bloc = await q.$(".wm-carnet__dehors");
    if (bloc !== null) await bloc.screenshot({ path: `${R}carnet-onboarding.png` });
    console.log("photo : carnet-onboarding.png");
  }
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
  //  ── L'ENCADRÉ D'INFORMATION ───────────────────────────────────
  //
  //  « Précise au début quand les personnes viennent lier leur compte »,
  //  16 novembre, après qu'une joueuse est restée bloquée trois jours.
  //  Il répond aux trois questions qu'on se pose AVANT de taper quoi
  //  que ce soit : pourquoi une adresse, et si j'en change, et si j'ai
  //  plusieurs personnages.
  const encadre = await q.evaluate(() => {
    const e = document.querySelector("[data-wm-carnet-lier-info]");
    if (e === null) return null;
    //  LA CARTE NE SE TROUVE PLUS PAR `closest` : l'encadré en est
    //  SORTI le 19 novembre, il est posé dessous. On la cherche donc
    //  dans la colonne du geste, qui les tient tous les deux.
    //  LA CARTE DE LA LIAISON, PAS CELLE DE LA CONNEXION : la colonne
    //  du geste en tient deux, et un `querySelector` sur la classe
    //  rendait la première — celle qui est cachée, donc large de zéro.
    const forme = document.querySelector("[data-wm-carnet-lier] .wm-carnet__lier-forme");
    const spam = document.querySelector("[data-wm-carnet-lier-spam]");
    if (forme === null || spam === null) return null;
    const c = getComputedStyle(e);
    //  LES COULEURS SE RÉSOLVENT, elles ne se comparent pas à un nom
    //  de jeton : `var(--wm-fond-terre)` et `rgb(…)` ne correspondent
    //  jamais.
    const sonde = document.createElement("span");
    sonde.style.color = "var(--wm-fond-terre)";
    e.appendChild(sonde);
    const terre = getComputedStyle(sonde).color;
    sonde.style.color = "var(--wm-accent-primaire)";
    const accent = getComputedStyle(sonde).color;
    sonde.remove();
    return {
      fond: c.backgroundColor,
      terre,
      titre: getComputedStyle(e.querySelector(".wm-info__titre")).color,
      accent,
      icone: e.querySelector(".wm-info__icone") !== null,
      //  ── SOUS LA CARTE, ET CÔTE À CÔTE ───────────────────────
      //
      //  Il était à la droite du formulaire, puis dessous et à sa
      //  largeur. Depuis le 19 novembre les deux encadrés sont
      //  SORTIS de la carte et se partagent la ligne sous elle.
      //
      //  L'ORDRE DE LECTURE NE CHANGE PAS pour autant : on lit le
      //  formulaire, puis pourquoi il demande une adresse.
      sousLaCarte: Math.round(e.getBoundingClientRect().top) >=
        Math.round(forme.getBoundingClientRect().bottom) - 2,
      //  ET LES DEUX SE PARTAGENT LA LIGNE : même haut, le second à
      //  droite du premier, et chacun la moitié de la carte au gap
      //  près. Trois mesures, parce qu'un seul `top` égal laisserait
      //  passer deux encadrés superposés.
      cotACote: Math.abs(
            Math.round(e.getBoundingClientRect().top) -
              Math.round(spam.getBoundingClientRect().top),
          ) <= 2 &&
        Math.round(spam.getBoundingClientRect().left) >=
          Math.round(e.getBoundingClientRect().right),
      largeurs: [
        Math.round(e.getBoundingClientRect().width),
        Math.round(spam.getBoundingClientRect().width),
        Math.round(forme.getBoundingClientRect().width),
      ],
      demiLargeur: Math.abs(
        e.getBoundingClientRect().width +
          spam.getBoundingClientRect().width -
          forme.getBoundingClientRect().width,
      ) <= 24,
      dit: e.textContent.replace(/\s+/g, " ").trim(),
    };
  });
  dire(
    "LES DEUX ENCADRÉS SONT SOUS LA CARTE, ET CÔTE À CÔTE",
    encadre !== null && encadre.sousLaCarte && encadre.cotACote &&
      encadre.demiLargeur && encadre.icone,
    JSON.stringify({ ...encadre, dit: (encadre?.dit ?? "").slice(0, 40) }),
  );
  dire(
    "il prend le marron de la charte, et garde le bleu sur son titre",
    //  Le fond bleu a été mesuré puis abandonné : fondu dans une
    //  surface chaude, il tombait à 1 % de saturation en thème
    //  sombre — du gris, pas du bleu.
    encadre !== null && encadre.fond === encadre.terre &&
      encadre.titre === encadre.accent,
    JSON.stringify({
      fond: encadre?.fond,
      terre: encadre?.terre,
      titre: encadre?.titre,
      accent: encadre?.accent,
    }),
  );
  dire(
    "et il répond aux trois questions qu'on se pose avant de taper",
    encadre !== null && /cl[ée] de liaison/i.test(encadre.dit) &&
      /pr[ée]viens-nous/i.test(encadre.dit) &&
      /tous d'un coup/i.test(encadre.dit) && /mail\+perso/i.test(encadre.dit),
    (encadre?.dit ?? "").slice(0, 200),
  );
  dire(
    "ET IL DIT DE REGARDER DANS LES SPAMS — c'est là qu'il tombe",
    //  « Il vient de tomber dans les spams sur l'autre mail »,
    //  16 novembre. Un lien qui ne vaut qu'un quart d'heure et qu'on
    //  cherche dans la mauvaise boîte est un lien perdu. La phrase le
    //  dit maintenant, et ce contrôle fait qu'elle le dira encore.
    /spam/i.test(dit),
    dit,
  );
  //  ── ET IL FAUT REGARDER OÙ LA RÉPONSE TOMBE ────────────────────
  //
  //  « Quand les personnes viennent connecter leur compte au carnet, le
  //  texte d'erreur chevauche le bouton », 13 novembre.
  //
  //  Ce harnais lisait déjà cette phrase — mot pour mot, dans trois cas
  //  — et n'a rien vu : il vérifiait CE QU'ELLE DIT, jamais OÙ ELLE
  //  TOMBE. Une phrase juste, posée sur le bouton qu'elle commente.
  const place = await q.evaluate(() => {
    const b = document.querySelector("[data-wm-carnet-liaison] button");
    const d = document.querySelector("[data-wm-carnet-lier-dit]");
    const rb = b.getBoundingClientRect(), rd = d.getBoundingClientRect();
    return {
      basDuBouton: Math.round(rb.bottom),
      hautDuTexte: Math.round(rd.top),
      ecart: Math.round(rd.top - rb.bottom),
      margeHaute: getComputedStyle(d).marginTop,
    };
  });
  dire(
    "LA RÉPONSE SE POSE SOUS LE BOUTON, PAS DESSUS",
    place.ecart >= 0,
    JSON.stringify(place),
  );
  dire(
    "et elle respire un peu",
    place.ecart >= 8,
    JSON.stringify(place),
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
    //  LA TOURNURE A CHANGÉ LE 16 NOVEMBRE — « aucun personnage n'est
    //  rattaché à cette adresse » — et ce contrôle la suit. Laissé sur
    //  l'ancienne, il serait passé au vert sans plus rien garder : le
    //  pire état d'un contrôle, parce qu'on le croit encore utile.
    vu.etat === "dehors" && /400/.test(vu.souci) &&
      !/rattaché à cette adresse/i.test(vu.souci),
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
  {
    place: 1,
    sujet_id: 1002,
    titre: "La brume ne lève pas",
    corps: "[b]Elle[/b] sortit la main",
    mots: 4,
    modifie_le: new Date(Date.now() - 4 * 60_000).toISOString(),
  },
  {
    place: 2,
    sujet_id: null,
    titre: "",
    corps: "deux mots",
    mots: 2,
    modifie_le: new Date(Date.now() - 86_400_000).toISOString(),
  },
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
  await q.fill(
    "[data-wm-ecrire-corps]",
    "[quote]tout ce qu'elle avait dit avant[/quote][b]trois petits mots[/b]",
  );
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
  //  ── ON ATTEND QUE LE BROUILLON SOIT ARRIVÉ AVANT DE TAPER ────────
  //
  //  Le 18 novembre, une requête de plus au chargement (l'aide des
  //  pages) a décalé l'arrivée du brouillon d'une poignée de
  //  millisecondes : le harnais tapait AVANT, le brouillon se posait
  //  APRÈS, et le champ contenait les deux bouts collés. L'essai a
  //  échoué sur une mesure qu'il ne surveillait pas.
  //
  //  IL AVAIT RAISON DE TOMBER. La même course existe pour une
  //  joueuse qui ouvre « Écrire » et commence à taper tout de suite :
  //  le carnet écraserait ce qu'elle vient d'écrire. Ce n'est pas
  //  corrigé ici — le harnais ne corrige rien — mais c'est noté, et
  //  cette attente dit où regarder.
  await q.waitForFunction(
    () => (document.querySelector("[data-wm-ecrire-corps]")?.value ?? "") !== "",
    null,
    { timeout: 5000 },
  ).catch(() => soucis.push("le brouillon n'arrive pas dans le champ"));
  await q.fill("[data-wm-ecrire-corps]", "le texte de la session");
  const avant = await q.evaluate(() => location.href);
  await q.click("[data-wm-ecrire-focus]");
  await q.waitForTimeout(200);
  const vu = await q.evaluate(() => ({
    pose: document.querySelector('[data-wm-carnet-page="ecrire"]')
      ?.hasAttribute("data-wm-focus") ?? false,
    blocsVisibles:
      [...document.querySelectorAll('[data-wm-carnet-page="ecrire"] .wm-carnet__bloc')]
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
  //  ON ATTEND QUE L'ONGLET AIT FINI DE CHARGER AVANT DE COMPTER :
  //  sans ça, la requête des brouillons atterrit parfois pendant la
  //  mesure et la fait échouer une fois sur dix. Un test qui tombe au
  //  hasard est un test qu'on apprend à relancer sans le lire.
  await q.waitForTimeout(300);
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
    JSON.stringify({ ...vu, enPlus: appels.slice(avant).map((a) => a.ou) }),
  );
  await q.close();
}

// ── 4 · Mon histoire ────────────────────────────────────────────────

const FICHE = {
  fiche_champ: [
    { champ: "Âge", valeur: "24 ans", affiche: true, ordre: 0 },
    { champ: "Statut marital", valeur: "séparée", affiche: false, ordre: 1 },
  ],
  fiche_description: [{
    texte: "Elle est arrivée à Rhode avec un sac trop lourd.",
    affiche: true,
    image_mode: "avatar",
    image_lien: "",
    carte_affiche: false,
  }],
  fiche_trait: [{ mot: "patiente", ordre: 0 }, { mot: "rancunière", ordre: 1 }],
  fiche_moment: [
    {
      id: "11111111-0000-0000-0000-000000000001",
      quand: "2026-06-12",
      titre: "Arrivée à Portevent",
      texte: "Descendue du bateau.",
      auto: true,
      affiche: true,
    },
    {
      id: "11111111-0000-0000-0000-000000000002",
      quand: "2026-08-16",
      titre: "La nuit sans lune",
      texte: "La scène qui a tout changé.",
      auto: false,
      affiche: true,
    },
  ],
};

{
  //  LE JOUEUR VOIT TOUT, MASQUÉ COMPRIS. Ce sont ses interrupteurs : un
  //  écran qui cacherait les lignes masquées serait un écran où l'on ne
  //  peut plus rien rallumer. C'est la FABRIQUE de la fiche qui filtrera
  //  sur `affiche`, et c'est un autre lot.
  const { q } = await monter({ fiche: FICHE });
  await q.click('[data-wm-carnet-onglet="mon-histoire"]');
  await q.waitForTimeout(300);
  const vu = await q.evaluate(() => ({
    champs: [...document.querySelectorAll(".wm-histoire__champ-nom")]
      .map((e) => e.textContent.trim()),
    mots: [...document.querySelectorAll(".wm-histoire__champ .wm-histoire__bascule")]
      .map((e) => e.textContent.trim()),
    traits: [...document.querySelectorAll(".wm-histoire__trait")].length,
    depuis: document.querySelector("[data-wm-histoire-depuis]")?.textContent?.trim(),
  }));
  dire(
    "L'ÉCRAN MONTRE AUSSI CE QUI EST MASQUÉ, ET LE DIT EN TOUTES LETTRES",
    vu.champs.length === 2 && vu.mots[0] === "affiché" && vu.mots[1] === "masqué" &&
      vu.traits === 2 && vu.depuis === "Depuis le 12 juin",
    JSON.stringify(vu),
  );
  await q.close();
}

{
  //  UNE BASCULE ÉCRIT DANS LA BASE. « Un champ masqué n'est pas caché
  //  en CSS : il ne sort pas de la base. » Si la bascule ne part pas,
  //  l'interrupteur est un décor — et quelqu'un croira avoir éteint.
  const { q, appels } = await monter({ fiche: FICHE });
  await q.click('[data-wm-carnet-onglet="mon-histoire"]');
  await q.waitForTimeout(300);
  await q.click(".wm-histoire__champ:nth-child(2) .wm-histoire__bascule");
  await q.waitForTimeout(250);
  const ecrit = appels.find((a) => a.ou === "PATCH-fiche_champ");
  const mot = await q.evaluate(() =>
    document.querySelector(".wm-histoire__champ:nth-child(2) .wm-histoire__bascule")
      ?.textContent?.trim()
  );
  dire(
    "L'INTERRUPTEUR ÉCRIT `affiche` DANS LA BASE, IL NE CACHE PAS EN CSS",
    ecrit !== undefined && ecrit.corps.affiche === true &&
      /Statut/i.test(decodeURIComponent(ecrit.ou_quoi ?? "")) && mot === "affiché",
    JSON.stringify({ corps: ecrit?.corps, ou: ecrit?.ou_quoi, mot }),
  );
  await q.close();
}

{
  //  UN CHAMP NEUF NAÎT MASQUÉ, et l'écran ne demande même pas : c'est
  //  le défaut de la colonne depuis la 0033. Ce qu'on mesure, c'est
  //  qu'il n'envoie PAS `affiche: true` en douce.
  const { q, appels } = await monter({ fiche: FICHE });
  await q.evaluate(() => {
    globalThis.prompt = () => "Métier";
  });
  await q.click('[data-wm-carnet-onglet="mon-histoire"]');
  await q.waitForTimeout(300);
  await q.click("[data-wm-histoire-ajouter-champ]");
  await q.waitForTimeout(250);
  const pose = appels.find((a) => a.ou === "POST-fiche_champ");
  const mots = await q.evaluate(() =>
    [...document.querySelectorAll(".wm-histoire__champ .wm-histoire__bascule")]
      .map((e) => e.textContent.trim())
  );
  dire(
    "UN CHAMP NEUF NAÎT MASQUÉ, ET LA PAGE NE DEMANDE PAS LE CONTRAIRE",
    pose !== undefined && pose.corps.champ === "Métier" &&
      pose.corps.affiche === undefined && mots[2] === "masqué",
    JSON.stringify({ corps: pose?.corps, mots }),
  );
  await q.close();
}

{
  //  UN MOMENT ÉCRIT PAR LE JOUEUR NE SE DÉCLARE PAS `auto`. La base le
  //  refuserait (politique `not auto`, 0033) ; la page ne doit même pas
  //  essayer, sinon on découvre le refus en production.
  const { q, appels } = await monter({ fiche: FICHE });
  await q.evaluate(() => {
    let n = 0;
    globalThis.prompt = () => (++n === 1 ? "Le départ" : "2026-09-30");
  });
  await q.click('[data-wm-carnet-onglet="mon-histoire"]');
  await q.waitForTimeout(300);
  await q.click("[data-wm-histoire-ajouter-moment]");
  await q.waitForTimeout(250);
  const pose = appels.find((a) => a.ou === "POST-fiche_moment");
  dire(
    "UN MOMENT AJOUTÉ PAR LE JOUEUR NE SE DÉCLARE PAS DU JEU",
    pose !== undefined && pose.corps.titre === "Le départ" &&
      pose.corps.quand === "2026-09-30" && pose.corps.auto === undefined,
    JSON.stringify({ corps: pose?.corps }),
  );
  await q.close();
}

{
  //  ET LE POINT PLEIN DIT D'OÙ VIENT LE MOMENT. La légende l'explique
  //  en mots, parce qu'une forme sans phrase ne s'apprend pas.
  const { q } = await monter({ fiche: FICHE });
  await q.click('[data-wm-carnet-onglet="mon-histoire"]');
  await q.waitForTimeout(300);
  const vu = await q.evaluate(() =>
    [...document.querySelectorAll(".wm-histoire__moment")].map((e) => ({
      mien: e.classList.contains("wm-histoire__moment--mien"),
      quand: e.querySelector(".wm-histoire__moment-quand")?.textContent?.trim(),
    }))
  );
  dire(
    "le moment du jeu et celui du joueur ne se ressemblent pas",
    vu.length === 2 && vu[0].mien === false && vu[1].mien === true &&
      /écrit par toi/.test(vu[1].quand ?? ""),
    JSON.stringify(vu),
  );
  await q.close();
}

{
  //  UNE ADRESSE D'IMAGE QUI N'EST PAS `https` NE PART MÊME PAS. La base
  //  la refuserait (0033) ; la refuser ici évite une requête qui
  //  reviendrait en erreur sans un mot pour la personne.
  const { q, appels } = await monter({ fiche: FICHE });
  await q.click('[data-wm-carnet-onglet="mon-histoire"]');
  await q.waitForTimeout(300);
  await q.click('[data-wm-histoire-mode="lien"]');
  await q.waitForTimeout(250);
  const avant = appels.filter((a) => a.ou === "POST-fiche_description").length;
  await q.fill("[data-wm-histoire-lien]", "javascript:alert(1)");
  await q.evaluate(() =>
    document.querySelector("[data-wm-histoire-lien]")
      .dispatchEvent(new Event("change", { bubbles: true }))
  );
  await q.waitForTimeout(250);
  dire(
    "UNE ADRESSE D'IMAGE QUI N'EST PAS `https` NE PART PAS",
    appels.filter((a) => a.ou === "POST-fiche_description").length === avant,
    JSON.stringify({
      avant,
      apres: appels.filter((a) => a.ou === "POST-fiche_description").length,
    }),
  );
  await q.close();
}

// ── 5 · Mes liens ───────────────────────────────────────────────────

const LIENS = [
  {
    cible_forum_id: 77,
    cible_pseudo: "Murphy",
    court: "sœur adoptive",
    long: "Elles ont grandi sous le même toit.",
    image: "",
    ordre: 0,
  },
  {
    cible_forum_id: 88,
    cible_pseudo: "Salomé",
    court: "celle qui sait",
    long: "",
    image: "",
    ordre: 1,
  },
];

const PAS_PUBLIEE = {
  texte: "[center][b]Eliott Vanner[/b][/center]",
  empreinte: "aaa",
  sujetId: null,
  messageId: null,
  publieLe: null,
  aChange: false,
};

const PUBLIEE_ET_CHANGEE = {
  texte: "[center][b]Eliott Vanner[/b][/center]",
  empreinte: "bbb",
  sujetId: 1500,
  messageId: 9001,
  publieLe: "2026-09-24T10:00:00Z",
  aChange: true,
};

{
  //  LE BANDEAU DIT L'ÉTAT RÉEL, et le bouton change de mot avec lui :
  //  « Publier » n'est pas « Mettre à jour », et proposer de publier
  //  une fiche déjà publiée ferait un second sujet.
  const { q } = await monter({ lesLiens: LIENS, etatDeLaFiche: PAS_PUBLIEE });
  await q.click('[data-wm-carnet-onglet="mes-liens"]');
  await q.waitForTimeout(300);
  const avant = await q.evaluate(() => ({
    etat: document.querySelector("[data-wm-liens-etat]")?.textContent?.trim(),
    bouton: document.querySelector("[data-wm-liens-publier]")?.textContent?.trim(),
    voir: document.querySelector("[data-wm-liens-voir]")?.hidden,
    cartes: document.querySelectorAll(".wm-liens__carte").length,
    compte: document.querySelector("[data-wm-liens-compte]")?.textContent?.trim(),
  }));
  dire(
    "UNE FICHE JAMAIS PUBLIÉE PROPOSE DE LA PUBLIER, ET NE MONTRE PAS DE SUJET",
    /pas encore publiée/.test(avant.etat ?? "") && avant.bouton === "Publier ma fiche" &&
      avant.voir === true && avant.cartes === 2 && avant.compte === "2 liens",
    JSON.stringify(avant),
  );
  await q.close();
}

{
  const { q } = await monter({ lesLiens: LIENS, etatDeLaFiche: PUBLIEE_ET_CHANGEE });
  await q.click('[data-wm-carnet-onglet="mes-liens"]');
  await q.waitForTimeout(300);
  const vu = await q.evaluate(() => ({
    etat: document.querySelector("[data-wm-liens-etat]")?.textContent?.trim(),
    bouton: document.querySelector("[data-wm-liens-publier]")?.textContent?.trim(),
    lien: document.querySelector("[data-wm-liens-voir]")?.getAttribute("href"),
  }));
  dire(
    "UNE FICHE MODIFIÉE DEPUIS LE DIT, ET PROPOSE LA MISE À JOUR",
    /a changé depuis/.test(vu.etat ?? "") && vu.bouton === "Mettre à jour ma fiche" &&
      vu.lien === "/t1500-",
    JSON.stringify(vu),
  );
  await q.close();
}

{
  //  LE BOUTON NE POSTE PAS. Il copie, ouvre le formulaire natif, et la
  //  personne revient dire où c'est parti. « Il pourrait poster, il a
  //  les identifiants. Mais la fiche serait signée d'un robot. »
  const { q, appels } = await monter({ lesLiens: LIENS, etatDeLaFiche: PUBLIEE_ET_CHANGEE });
  await q.evaluate(() => {
    globalThis.ouvertures = [];
    globalThis.open = (a) => {
      globalThis.ouvertures.push(a);
      return null;
    };
    let n = 0;
    globalThis.prompt = () => (++n === 1 ? "1500" : "9001");
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: (t) => {
          globalThis.colle = t;
          return Promise.resolve();
        },
      },
    });
  });
  await q.click('[data-wm-carnet-onglet="mes-liens"]');
  await q.waitForTimeout(300);
  await q.click("[data-wm-liens-publier]");
  await q.waitForTimeout(400);
  const vu = await q.evaluate(() => ({
    ouvertures: globalThis.ouvertures,
    colle: globalThis.colle,
  }));
  const dit = appels.find((a) => a.ou === "fiche-est-publiee");
  dire(
    "PUBLIER OUVRE L'ÉDITION DU MESSAGE EXISTANT, COPIE LE TEXTE, ET NE POSTE RIEN",
    vu.ouvertures?.length === 1 && vu.ouvertures[0] === "/post?p=9001&mode=editpost" &&
      vu.colle === PUBLIEE_ET_CHANGEE.texte &&
      dit?.corps?.p?.sujetId === 1500 && dit?.corps?.p?.messageId === 9001,
    JSON.stringify({ ...vu, dit: dit?.corps }),
  );
  await q.close();
}

{
  //  ET LA PREMIÈRE FOIS, C'EST UN NOUVEAU SUJET — pas une réponse,
  //  sinon la fiche se retrouve en morceaux au fil des mises à jour.
  const { q } = await monter({ lesLiens: LIENS, etatDeLaFiche: PAS_PUBLIEE });
  await q.evaluate(() => {
    globalThis.ouvertures = [];
    globalThis.open = (a) => {
      globalThis.ouvertures.push(a);
      return null;
    };
    globalThis.prompt = () => null;
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: () => Promise.resolve() },
    });
  });
  await q.click('[data-wm-carnet-onglet="mes-liens"]');
  await q.waitForTimeout(300);
  await q.click("[data-wm-liens-publier]");
  await q.waitForTimeout(300);
  const ouvertures = await q.evaluate(() => globalThis.ouvertures);
  dire(
    "la première publication ouvre un NOUVEAU SUJET",
    ouvertures?.length === 1 && /mode=newtopic/.test(ouvertures[0]),
    JSON.stringify({ ouvertures }),
  );
  await q.close();
}

{
  //  L'ORDRE DE LA LISTE EST CELUI DE LA FICHE, et le changer écrit les
  //  deux rangs échangés — pas la liste entière.
  const { q, appels } = await monter({ lesLiens: LIENS, etatDeLaFiche: PAS_PUBLIEE });
  await q.click('[data-wm-carnet-onglet="mes-liens"]');
  await q.waitForTimeout(300);
  await q.click(".wm-liens__carte:nth-child(2) .wm-liens__carte-outils button:first-child");
  await q.waitForTimeout(300);
  const noms = await q.evaluate(() =>
    [...document.querySelectorAll(".wm-liens__carte-nom")].map((e) => e.textContent.trim())
  );
  const ecrits = appels.filter((a) => a.ou === "PATCH-lien");
  dire(
    "MONTER UN LIEN ÉCHANGE DEUX RANGS, ET DEUX SEULEMENT",
    noms[0] === "Salomé" && noms[1] === "Murphy" && ecrits.length === 2 &&
      ecrits.every((e) => typeof e.corps.ordre === "number"),
    JSON.stringify({ noms, ecrits: ecrits.map((e) => [e.ou_quoi, e.corps]) }),
  );
  await q.close();
}

{
  //  UN LIEN SANS NUMÉRO DE MEMBRE NE PART PAS : la clé primaire est
  //  (joueur, cible), et une cible à zéro collerait tous les liens
  //  les uns sur les autres.
  const { q, appels } = await monter({ lesLiens: [], etatDeLaFiche: PAS_PUBLIEE });
  await q.click('[data-wm-carnet-onglet="mes-liens"]');
  await q.waitForTimeout(300);
  await q.fill("[data-wm-liens-neuf-pseudo]", "Quelqu'un");
  await q.click("[data-wm-liens-ajouter]");
  await q.waitForTimeout(250);
  dire(
    "UN LIEN SANS NUMÉRO DE MEMBRE N'EST PAS ENVOYÉ",
    appels.filter((a) => a.ou === "POST-lien").length === 0,
    JSON.stringify({ envois: appels.filter((a) => a.ou === "POST-lien").length }),
  );
  await q.close();
}

// ── 6 · Mes boîtes ──────────────────────────────────────────────────

{
  //  L'ÉQUIPE A SIX PLACES, ET CELLE DU POKÉMON EN PENSION EN EST UNE.
  //  « Il occupe la place tant qu'il n'est pas récupéré : c'est plus
  //  clair que de le faire disparaître. »
  const { q } = await monter();
  await q.click('[data-wm-carnet-onglet="mes-boites"]');
  await q.waitForTimeout(200);
  const vu = await q.evaluate(() => ({
    compte: document.querySelector("[data-wm-boites-compte]")?.textContent?.trim(),
    dit: document.querySelector("[data-wm-boites-equipe-dit]")?.textContent?.trim(),
    places: [...document.querySelectorAll(".wm-boites__place")].map((e) => ({
      nom: e.querySelector(".wm-boites__nom")?.textContent?.trim(),
      sous: e.querySelector(".wm-boites__sous")?.textContent?.trim(),
      pension: e.classList.contains("wm-boites__place--pension"),
      mort: e.disabled,
    })),
    cases: document.querySelectorAll(".wm-boites__case").length,
  }));
  dire(
    "L'ÉQUIPE MONTRE SES SIX PLACES, ET CELUI EN PENSION GARDE LA SIENNE",
    vu.compte === "3 / 6" && vu.places.length === 6 &&
      vu.places[1].pension === true && vu.places[1].sous === "en pension" &&
      vu.places[1].mort === true && vu.places[2].nom === "libre" &&
      vu.cases === 30 && /en pension/.test(vu.dit ?? ""),
    JSON.stringify(vu),
  );
  await q.close();
}

{
  //  TRENTE CASES PAR BOÎTE, TROIS BOÎTES, et c'est la boîte 2 qui
  //  porte le Pokémon rangé — changer d'onglet le montre.
  const { q } = await monter();
  await q.click('[data-wm-carnet-onglet="mes-boites"]');
  await q.waitForTimeout(200);
  const avant = await q.evaluate(() =>
    document.querySelectorAll(".wm-boites__case:not(.wm-boites__case--vide)").length
  );
  await q.click('[data-wm-boites-onglet="2"]');
  await q.waitForTimeout(150);
  const apres = await q.evaluate(() => ({
    pleines: document.querySelectorAll(".wm-boites__case:not(.wm-boites__case--vide)").length,
    choisie: document.querySelector('[data-wm-boites-onglet="2"]')?.getAttribute(
      "aria-pressed",
    ),
    dit: document.querySelector("[data-wm-boites-dit]")?.textContent?.trim(),
  }));
  dire(
    "LA BOÎTE 1 EST VIDE, LA BOÎTE 2 PORTE LE POKÉMON RANGÉ",
    avant === 0 && apres.pleines === 1 && apres.choisie === "true" &&
      /1 Pokémon rangé sur 90 places/.test(apres.dit ?? ""),
    JSON.stringify({ avant, ...apres }),
  );
  await q.close();
}

{
  //  CHOISIR UN POKÉMON DE BOÎTE OUVRE SON DÉTAIL, et le bouton dit où
  //  il irait — pas « déplacer », qui ne dit rien de la destination.
  const { q } = await monter();
  await q.click('[data-wm-carnet-onglet="mes-boites"]');
  await q.click('[data-wm-boites-onglet="2"]');
  await q.waitForTimeout(150);
  await q.click(".wm-boites__case:not(.wm-boites__case--vide)");
  await q.waitForTimeout(150);
  const vu = await q.evaluate(() => ({
    nom: document.querySelector(".wm-boites__detail-nom")?.textContent?.trim(),
    bouton: document.querySelector("[data-wm-boites-bouger]")?.textContent?.trim(),
    dit: document.querySelector(".wm-boites__detail .wm-boites__dit")?.textContent?.trim(),
    scene: document.querySelector(".wm-boites__faits a")?.getAttribute("href"),
  }));
  dire(
    "LE DÉTAIL DIT LE NIVEAU, LA SCÈNE, ET CE QUE LE BOUTON VA FAIRE",
    vu.nom === "EnBoite" && vu.bouton === "Mettre dans l'équipe →" &&
      vu.scene === "/t36-" && /place est libre/.test(vu.dit ?? ""),
    JSON.stringify(vu),
  );
  await q.close();
}

{
  //  ET LE RANGEMENT PASSE PAR `ranger()`, avec la place libre trouvée
  //  côté page — jamais par une écriture directe sur la table.
  const { q, appels } = await monter();
  await q.click('[data-wm-carnet-onglet="mes-boites"]');
  await q.click('[data-wm-boites-onglet="2"]');
  await q.waitForTimeout(150);
  await q.click(".wm-boites__case:not(.wm-boites__case--vide)");
  await q.click("[data-wm-boites-bouger]");
  await q.waitForTimeout(300);
  const appel = appels.find((a) => a.ou === "ranger");
  const noms = await q.evaluate(() =>
    [...document.querySelectorAll(".wm-boites__place .wm-boites__nom")]
      .map((e) => e.textContent.trim())
  );
  dire(
    "RANGER APPELLE LA FONCTION, ET VISE LA PREMIÈRE PLACE LIBRE",
    appel?.corps?.p?.pokemonId === "p4" && appel?.corps?.p?.emplacement === "equipe" &&
      appel?.corps?.p?.position === 3 && noms[2] === "EnBoite",
    JSON.stringify({ corps: appel?.corps?.p, noms }),
  );
  await q.close();
}

{
  //  UN REFUS DU SERVEUR NE DÉPLACE RIEN À L'ÉCRAN. « On ne repeint
  //  qu'après la réponse » : montrer un rangement que la base vient de
  //  refuser apprend à ne plus croire l'écran.
  const { q } = await monter();
  await q.click('[data-wm-carnet-onglet="mes-boites"]');
  await q.waitForTimeout(200);
  //  Le Pokémon en pension est à la place 2 : on le choisit par son
  //  bouton, qui est désactivé — donc on appelle le rangement comme le
  //  ferait un appel bricolé, et le décor refuse comme la base.
  const refus = await q.evaluate(async () => {
    const r = await fetch(
      "https://ajhajteavsbygvkhipzt.supabase.co/rest/v1/rpc/ranger",
      {
        method: "POST",
        headers: { apikey: "x", "Content-Type": "application/json" },
        body: JSON.stringify({
          p: { pokemonId: "p2", emplacement: "boite", boiteNo: 1, position: 1 },
        }),
      },
    );
    return { statut: r.status, corps: await r.text() };
  });
  const places = await q.evaluate(() =>
    [...document.querySelectorAll(".wm-boites__place .wm-boites__sous")]
      .map((e) => e.textContent.trim())
  );
  dire(
    "UN POKÉMON EN PENSION EST REFUSÉ PAR LA BASE, ET RESTE À SA PLACE",
    refus.statut === 400 && /EN_PENSION/.test(refus.corps) && places[1] === "en pension",
    JSON.stringify({ refus, places }),
  );
  await q.close();
}

// ── 7 · Mes RP ──────────────────────────────────────────────────────

const RP = [
  {
    sujet_id: 996,
    titre: "La brume ne lève pas",
    forum_id: 34,
    forum_nom: "Montagnes Embrumées",
    reponses: 3,
    dernier_le: "2026-10-28T13:34:00Z",
    dernier_auteur: "Murphy",
    dernier_message: 15582,
    extrait: "Le vent se lève.",
    etat: "en-cours",
    ordre: 0,
  },
  {
    sujet_id: 977,
    titre: "Un café, deux silences",
    forum_id: 5,
    forum_nom: "Phenacit",
    reponses: 8,
    dernier_le: "2026-11-01T09:00:00Z",
    dernier_auteur: "Eliott Vanner",
    dernier_message: 15600,
    extrait: "",
    etat: "en-cours",
    ordre: 0,
  },
  {
    sujet_id: 1200,
    titre: "Ce qui vient après",
    forum_id: 0,
    forum_nom: "",
    reponses: 0,
    dernier_le: null,
    dernier_auteur: "",
    dernier_message: null,
    extrait: "",
    etat: "prevu",
    ordre: 0,
  },
];

//  ── LE PSEUDO DU CARNET SUIT CELUI DU FORUM ───────────────────────
//
//  « J'ai changé mon pseudo mais il a pas changé dans le carnet de
//  bord » · « "mes RP" en liste ne fonctionne pas » · « j'ai découvert
//  "personne n'a écrit" alors qu'Arceus a posté après moi »,
//  13 novembre. Un seul défaut, trois symptômes.
//
//  `joueur.pseudo` est écrit une seule fois par `lier_compte` et plus
//  jamais relu. On reproduit donc l'état exact d'une personne qui
//  vient de se renommer : le carnet porte L'ANCIEN nom, le forum en
//  annonce un NEUF, et les RP — relevés sur le forum — portent le
//  NEUF eux aussi.
//
//  SANS LE CORRECTIF, PLUS RIEN NE CORRESPOND : chaque RP dont elle
//  est la dernière autrice se lit « à moi d'écrire », et la vue liste
//  n'a plus rien à filtrer.
{
  const ancien = { ...CARNET, dresseur: { ...CARNET.dresseur, pseudo: "Ancien Pseudo" } };
  const rpRenommes = RP.map((r) =>
    r.dernier_auteur === "Eliott Vanner" ? { ...r, dernier_auteur: "Nouveau Pseudo" } : r
  );
  const { q } = await monter({
    reponse: ancien,
    compte: { id: 42, pseudo: "Nouveau Pseudo" },
    lesRp: rpRenommes,
  });
  await q.click('[data-wm-carnet-onglet="mes-rp"]');
  await q.waitForTimeout(300);
  const vu = await q.evaluate(() => ({
    nom: document.querySelector("[data-wm-carnet-nom]")?.textContent?.trim() ?? "",
    etats: [...document.querySelectorAll(".wm-rp__etat")].map((e) => e.textContent.trim()),
  }));
  dire(
    "LE CARNET PORTE LE PSEUDO D'AUJOURD'HUI, pas celui du jour de la liaison",
    vu.nom === "Nouveau Pseudo",
    JSON.stringify(vu),
  );
  dire(
    "et « à l'autre » redevient possible — sinon tout basculait vers elle",
    //  « À l'autre » ne peut apparaître QUE si le dernier auteur est
    //  reconnu comme elle. Avec le pseudo figé, aucun ne l'était :
    //  c'est le symptôme « mes RP ne fonctionne pas ». Un seul suffit
    //  à prouver que la comparaison retombe sur ses pieds.
    vu.etats.includes("à l'autre"),
    JSON.stringify(vu.etats),
  );
  await q.close();
}

{
  //  « À MOI D'ÉCRIRE » SE CALCULE, il n'est rangé nulle part : le
  //  carnet regarde qui a écrit le dernier message. Et ce que la
  //  personne a posé — prévu, en pause — passe avant le calcul.
  const { q } = await monter({ lesRp: RP });
  await q.click('[data-wm-carnet-onglet="mes-rp"]');
  await q.waitForTimeout(300);
  const vu = await q.evaluate(() => ({
    //  LES ÉTIQUETTES DE LA LISTE, pas celles de toute la page : le
    //  tableau en pose aussi, et son ORDRE suit les colonnes — qui ont
    //  changé le 20 novembre. Une mesure qui prend les deux lots
    //  mélangés dépend d'un ordre qui n'est pas celui qu'elle teste.
    etats: [...document.querySelectorAll(".wm-rp__liste .wm-rp__etat")]
      .map((e) => e.textContent.trim()),
    compte: document.querySelector("[data-wm-rp-compte]")?.textContent?.trim(),
    liens: [...document.querySelectorAll(".wm-rp__titre")].map((a) => a.getAttribute("href")),
  }));
  dire(
    "« À MOI » SE CALCULE DEPUIS LE DERNIER AUTEUR, ET CE QU'ELLE A POSÉ PASSE AVANT",
    vu.etats[0] === "à l'autre" && vu.etats[1] === "à moi d'écrire" &&
      vu.etats[2] === "prévu" && /1 où c'est à toi/.test(vu.compte ?? "") &&
      vu.liens[1] === "/t996-#15582",
    JSON.stringify(vu),
  );
  await q.close();
}

{
  //  LE TIRET N'EST PAS DÉCORATIF, et ce contrôle existe parce que
  //  celui d'au-dessus affirmait « /t996#15582 » : il GRAVAIT le
  //  défaut. Mesuré sur le forum le 13 novembre, `/t996` rend « 404 -
  //  Page not found » et `/t996-` rend le sujet.
  //
  //  On ne vérifie donc pas une chaîne attendue, qu'on peut recopier
  //  de travers, mais LA RÈGLE : toute adresse de sujet porte son
  //  tiret, avec ou sans ancre.
  const { q } = await monter({ lesRp: RP });
  await q.click('[data-wm-carnet-onglet="mes-rp"]');
  await q.waitForTimeout(300);
  const adresses = await q.evaluate(() =>
    [...document.querySelectorAll(".wm-rp__titre")].map((a) => a.getAttribute("href"))
  );
  dire(
    "AUCUN LIEN DE SUJET NE PART SANS SON TIRET — sinon le forum rend 404",
    adresses.length > 0 && adresses.every((h) => /^\/t\d+-(#\d+)?$/.test(h ?? "")),
    JSON.stringify(adresses),
  );
  await q.close();
}

{
  //  LE LIEN VA AU DERNIER MESSAGE : relire quarante réponses pour
  //  retrouver où on en était est le geste qu'on vient éviter.
  const { q } = await monter({ lesRp: RP });
  await q.click('[data-wm-carnet-onglet="mes-rp"]');
  await q.waitForTimeout(300);
  //  ── ON PASSE EN LISTE D'ABORD, COMME UNE JOUEUSE ───────────────
  //
  //  Les filtres ne servent qu'à la vue en liste : `rp.ts` les cache
  //  au départ et ne les rouvre qu'en quittant le tableau. Ce clic-ci
  //  marchait quand même, parce que `display: flex` écrit dans la
  //  feuille battait le `[hidden]` du navigateur — la même fuite que
  //  sur le bloc de liaison, troisième endroit.
  //
  //  Le harnais cliquait donc un bouton qu'une joueuse ne peut pas
  //  atteindre, et le validait.
  await q.click('[data-wm-rp-vue="liste"]');
  await q.waitForTimeout(100);
  await q.click('[data-wm-rp-filtre="a-moi"]');
  await q.waitForTimeout(150);
  const titres = await q.evaluate(() =>
    [...document.querySelectorAll(".wm-rp__titre")].map((a) => a.textContent.trim())
  );
  dire(
    "LE FILTRE « À MOI » NE GARDE QUE CEUX QUI ATTENDENT",
    titres.length === 1 && titres[0] === "La brume ne lève pas",
    JSON.stringify({ titres }),
  );
  await q.close();
}

{
  //  POSER UN ÉTAT L'ÉCRIT DANS LA BASE, et seulement lui : un PATCH
  //  sur le titre serait refusé par le droit PostgreSQL (0037).
  const { q, appels } = await monter({ lesRp: RP });
  await q.click('[data-wm-carnet-onglet="mes-rp"]');
  await q.waitForTimeout(300);
  //  LA LIGNE EST CELLE DE LA VUE EN LISTE : le tableau n'en a pas.
  //  Ce test travaillait sur une vue cachée (19 novembre).
  await q.click('[data-wm-rp-vue="liste"]');
  await q.waitForTimeout(100);
  await q.selectOption(".wm-rp__ligne:first-child select", "en-pause");
  await q.waitForTimeout(250);
  const ecrit = appels.find((a) => a.ou === "PATCH-rp");
  const etat = await q.evaluate(() =>
    document.querySelector(".wm-rp__ligne:first-child .wm-rp__etat")?.textContent?.trim()
  );
  dire(
    "POSER UN ÉTAT N'ÉCRIT QUE L'ÉTAT",
    ecrit !== undefined && Object.keys(ecrit.corps).join() === "etat" &&
      ecrit.corps.etat === "en-pause" && etat === "en pause",
    JSON.stringify({ corps: ecrit?.corps, etat }),
  );
  await q.close();
}

{
  //  ON N'AJOUTE QU'UNE CARTE « PRÉVUE ». La base l'exige (0037) ; la
  //  page ne doit même pas essayer autre chose.
  const { q, appels } = await monter({ lesRp: RP });
  await q.click('[data-wm-carnet-onglet="mes-rp"]');
  await q.waitForTimeout(300);
  await q.fill(
    "[data-wm-rp-neuf-adresse]",
    "https://mysteryinrhode.forumactif.com/t1450-le-pont",
  );
  await q.fill("[data-wm-rp-neuf-titre]", "Le pont");
  await q.click("[data-wm-rp-ajouter]");
  await q.waitForTimeout(250);
  const pose = appels.find((a) => a.ou === "POST-rp");
  const dit = await q.evaluate(() =>
    document.querySelector("[data-wm-rp-dit]")?.textContent?.trim()
  );
  dire(
    "UNE CARTE AJOUTÉE EST « PRÉVUE », ET SON SUJET SORT DE L'ADRESSE COLLÉE",
    pose?.corps?.etat === "prevu" && pose?.corps?.sujet_id === 1450 &&
      pose?.corps?.titre === "Le pont" && /Ajouté/.test(dit ?? ""),
    JSON.stringify({ corps: pose?.corps, dit }),
  );
  await q.close();
}

{
  //  ET UNE ADRESSE QUI N'EN EST PAS UNE NE PART PAS : la clé est
  //  (joueur, sujet), un titre seul n'en fait pas une carte. On le dit
  //  plutôt que de laisser la base répondre par une erreur muette.
  const { q, appels } = await monter({ lesRp: RP });
  await q.click('[data-wm-carnet-onglet="mes-rp"]');
  await q.waitForTimeout(300);
  await q.fill("[data-wm-rp-neuf-titre]", "Juste un titre");
  await q.click("[data-wm-rp-ajouter]");
  await q.waitForTimeout(250);
  const dit = await q.evaluate(() =>
    document.querySelector("[data-wm-rp-dit]")?.textContent?.trim()
  );
  dire(
    "SANS ADRESSE DE SUJET, RIEN NE PART, ET LA PAGE DIT CE QU'IL MANQUE",
    appels.filter((a) => a.ou === "POST-rp").length === 0 &&
      /adresse du sujet/i.test(dit ?? ""),
    JSON.stringify({ dit }),
  );
  await q.close();
}

{
  //  ON NE PROPOSE PAS DE RETIRER CE QU'ON NE PEUT PAS RETIRER. La
  //  base n'efface qu'une carte prévue (0037) : offrir le bouton
  //  ailleurs apprendrait à se méfier de l'écran.
  const { q } = await monter({ lesRp: RP });
  await q.click('[data-wm-carnet-onglet="mes-rp"]');
  await q.waitForTimeout(300);
  await q.click('[data-wm-rp-vue="liste"]');
  await q.waitForTimeout(100);
  const boutons = await q.evaluate(() =>
    [...document.querySelectorAll(".wm-rp__ligne")].map((e) => ({
      etat: e.querySelector(".wm-rp__etat")?.textContent?.trim(),
      //  LE SÉLECTEUR NOMME LE BOUTON QU'ON MESURE : « un bouton dans
      //  les outils » est devenu faux le jour où « en grand » s'y est
      //  ajouté, et la mesure aurait dit vrai pour la mauvaise raison.
      retirable: e.querySelector("[data-wm-rp-retirer]") !== null,
    }))
  );
  dire(
    "SEULE UNE CARTE PRÉVUE SE RETIRE",
    boutons.filter((b) => b.retirable).length === 1 &&
      boutons.find((b) => b.retirable)?.etat === "prévu",
    JSON.stringify(boutons),
  );
  await q.close();
}

{
  //  LE TABLEAU EST LA VUE PAR DÉFAUT, et ses colonnes sont les
  //  CINQ ÉTATS QU'ON PEUT POSER — « solo » est arrivé le 20 novembre.
  //  Pas « à moi » et « à l'autre » :
  //  on ne décide pas de qui doit écrire, ça se calcule — et déposer
  //  une carte dans une colonne qui ne change rien serait un geste
  //  sans effet.
  const { q } = await monter({ lesRp: RP });
  await q.click('[data-wm-carnet-onglet="mes-rp"]');
  await q.waitForTimeout(300);
  const vu = await q.evaluate(() => ({
    //  LE NOM DE LA COLONNE EST UN BOUTON depuis la 0059 : il
    //  s'écrit. On le lit par son attribut et pas par sa place, pour
    //  ne pas remesurer l'ordre du balisage à chaque remaniement.
    colonnes: [...document.querySelectorAll("[data-wm-rp-renommer]")]
      .map((e) => e.textContent.trim()),
    comptes: [...document.querySelectorAll(".wm-rp__colonne-tete span:last-child")]
      .map((e) => e.textContent.trim()),
    listeCachee: document.querySelector("[data-wm-rp-liste]")?.hidden,
    filtresCaches: document.querySelector("[data-wm-rp-filtres]")?.hidden,
    cartes: document.querySelectorAll(".wm-rp__carte").length,
  }));
  dire(
    "LE TABLEAU A CINQ COLONNES, CELLES DES ÉTATS QU'ON PEUT POSER",
    vu.colonnes.join() === "prévu,en cours,solo,en pause,clôturé" &&
      vu.comptes.join() === "1,2,0,0,0" && vu.listeCachee === true &&
      vu.filtresCaches === true && vu.cartes === 3,
    JSON.stringify(vu),
  );
  await q.close();
}

{
  //  DÉPOSER UNE CARTE ÉCRIT L'ÉTAT DE LA COLONNE, par le même chemin
  //  que le menu de la liste : glisser est un raccourci, pas une
  //  seconde façon d'écrire.
  const { q, appels } = await monter({ lesRp: RP });
  await q.click('[data-wm-carnet-onglet="mes-rp"]');
  await q.waitForTimeout(300);
  await q.evaluate(() => {
    const carte = document.querySelector('[data-wm-rp-carte="996"]');
    const cible = document.querySelector('[data-wm-rp-colonne="en-pause"]');
    const dt = new DataTransfer();
    carte.dispatchEvent(new DragEvent("dragstart", { dataTransfer: dt, bubbles: true }));
    cible.dispatchEvent(new DragEvent("dragover", { dataTransfer: dt, bubbles: true }));
    cible.dispatchEvent(new DragEvent("drop", { dataTransfer: dt, bubbles: true }));
  });
  await q.waitForTimeout(300);
  const ecrit = appels.find((a) => a.ou === "PATCH-rp");
  const comptes = await q.evaluate(() =>
    [...document.querySelectorAll(".wm-rp__colonne-tete span:last-child")]
      .map((e) => e.textContent.trim())
  );
  dire(
    "DÉPOSER UNE CARTE DANS UNE COLONNE ÉCRIT SON ÉTAT",
    ecrit?.corps?.etat === "en-pause" &&
      decodeURIComponent(ecrit?.ou_quoi ?? "").includes("996") &&
      comptes.join() === "1,1,0,1,0",
    JSON.stringify({ corps: ecrit?.corps, comptes }),
  );
  await q.close();
}

{
  //  UN DÉPÔT DANS SA PROPRE COLONNE N'ÉCRIT RIEN. Sans ce test,
  //  lâcher une carte là où on l'a prise ferait une requête pour ne
  //  rien changer — et sur un tableau, ça arrive tout le temps.
  const { q, appels } = await monter({ lesRp: RP });
  await q.click('[data-wm-carnet-onglet="mes-rp"]');
  await q.waitForTimeout(300);
  await q.evaluate(() => {
    const carte = document.querySelector('[data-wm-rp-carte="996"]');
    const cible = document.querySelector('[data-wm-rp-colonne="en-cours"]');
    const dt = new DataTransfer();
    carte.dispatchEvent(new DragEvent("dragstart", { dataTransfer: dt, bubbles: true }));
    cible.dispatchEvent(new DragEvent("drop", { dataTransfer: dt, bubbles: true }));
  });
  await q.waitForTimeout(250);
  dire(
    "LÂCHER UNE CARTE OÙ ON L'A PRISE N'ÉCRIT RIEN",
    appels.filter((a) => a.ou === "PATCH-rp").length === 0,
    JSON.stringify({ patchs: appels.filter((a) => a.ou === "PATCH-rp").length }),
  );
  await q.close();
}

{
  //  ET LA LISTE RESTE LE CHEMIN SÛR : glisser-déposer ne marche ni au
  //  clavier ni au lecteur d'écran. Le menu d'état y est sur chaque
  //  ligne, et il écrit la même chose.
  const { q, appels } = await monter({ lesRp: RP });
  await q.click('[data-wm-carnet-onglet="mes-rp"]');
  await q.waitForTimeout(300);
  await q.click('[data-wm-rp-vue="liste"]');
  await q.waitForTimeout(200);
  const vu = await q.evaluate(() => ({
    tableauCache: document.querySelector("[data-wm-rp-tableau]")?.hidden,
    filtres: document.querySelector("[data-wm-rp-filtres]")?.hidden,
    menus: document.querySelectorAll(".wm-rp__outils select").length,
  }));
  await q.selectOption(".wm-rp__ligne:first-child select", "cloture");
  await q.waitForTimeout(250);
  const ecrit = appels.find((a) => a.ou === "PATCH-rp");
  dire(
    "LA VUE LISTE REVIENT, AVEC SES FILTRES ET SON MENU PAR LIGNE",
    vu.tableauCache === true && vu.filtres === false && vu.menus === 3 &&
      ecrit?.corps?.etat === "cloture",
    JSON.stringify({ ...vu, corps: ecrit?.corps }),
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
  //  UN PERSONNAGE QUI N'EST PAS DERRIÈRE CETTE CONNEXION.
  //
  //  ── LE GESTE QUI RÉPARE N'EST PAS CELUI QU'ON CROYAIT ───────────
  //
  //  Ce commentaire disait : « le geste qui répare est le même : se
  //  relier avec la bonne adresse ». C'était faux, et le message le
  //  répétait au joueur.
  //
  //  La liaison compare l'adresse de la session à `joueur.courriel`,
  //  que LE STAFF renseigne à la validation (0029). Et jusqu'à la 0041,
  //  `valider_le_personnage` ne l'écrivait pas du tout — la fonction
  //  datait d'avant la colonne. Aucune adresse que le joueur essaie ne
  //  pouvait donc aboutir.
  //
  //  Trouvé le 16 novembre par une joueuse qui a tenté deux adresses,
  //  soupçonné ses alias, fouillé ses spams et conclu « il doit me
  //  manquer une étape ». Elle n'en avait aucune.
  const { q } = await monter({ reponse: null });
  const vu = await q.evaluate(() => ({
    lierOuvert: document.querySelector("[data-wm-carnet-lier]")?.hidden === false,
    dit: document.querySelector("[data-wm-carnet-lier-dit]")?.textContent?.trim() ?? "",
  }));
  dire(
    "UN PERSONNAGE HORS DE CETTE CONNEXION LE DIT, NOMME LE COMPTE, ET RENVOIE AU STAFF",
    vu.lierOuvert && vu.dit.includes("Eliott Vanner") &&
      /staff/i.test(vu.dit) &&
      //  ET IL N'ENVOIE PLUS CHERCHER UNE AUTRE ADRESSE : c'est la
      //  piste qui a coûté trois jours à une joueuse.
      !/autre adresse/i.test(vu.dit),
    JSON.stringify(vu),
  );
  await q.close();
}

{
  //  UN INVITÉ DU FORUM N'EST PAS UN PROBLÈME DE LIAISON. Il n'a rien à
  //  lier : il a à se connecter au forum, et c'est tout autre chose.
  //
  //  LE MESSAGE A CHANGÉ DE PLACE le 19 novembre : il vivait sur la
  //  ligne de souci, en terre brûlée, qui est le canal des pannes.
  //  Il tient maintenant dans l'encadré, en titre et en phrase — et
  //  la ligne de souci se tait. Le test suit la phrase, pas le canal.
  const { q, appels } = await monter({ compte: "invite" });
  const vu = await q.evaluate(() => ({
    dit: document.querySelector("[data-wm-carnet-connexion]")?.textContent?.trim() ?? "",
    connexionOuverte: document.querySelector("[data-wm-carnet-connexion]")?.hidden === false,
    lierCache: document.querySelector("[data-wm-carnet-lier]")?.hidden === true,
  }));
  dire(
    "UN INVITÉ S'ENTEND DIRE DE SE CONNECTER AU FORUM, PAS DE SE LIER",
    /connecte-toi/i.test(vu.dit) && vu.connexionOuverte && vu.lierCache &&
      appels.length === 0,
    JSON.stringify({ ...vu, dit: vu.dit.slice(0, 40), appels: appels.length }),
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
  //  DEUX ONGLETS DEMANDENT QUELQUE CHOSE À LEUR PREMIÈRE OUVERTURE, et
  //  seulement à la première :
  //
  //  · Écrire, une requête — trois textes de RP n'ont rien à faire dans
  //    l'appel du carnet de quelqu'un qui vient regarder son équipe ;
  //  · Mon histoire, quatre — ses quatre tables, lancées ENSEMBLE, donc
  //    un seul aller-retour dans le temps de la personne ;
  //  · Mes liens, deux — la liste, et l'état de la fiche publiée ;
  //  · Mes RP, une — le tableau que la relève a rempli.
  //
  //  Le second passage ne demande plus rien, et c'est ce que la seconde
  //  visite mesure ici.
  const avant = appels.length;
  for (
    const clef of [
      "mon-sac",
      "mon-pokedex",
      "mes-rp",
      "ecrire",
      "mon-histoire",
      "mes-liens",
      "mes-boites",
      "mon-jeu",
    ]
  ) {
    await p.click(`[data-wm-carnet-onglet='${clef}']`);
    await p.waitForTimeout(60);
  }
  const apresLePremierTour = appels.length;
  //  Second tour : plus rien ne doit partir, Écrire compris.
  for (
    const clef of [
      "ecrire",
      "mon-histoire",
      "mes-liens",
      "mes-rp",
      "mon-sac",
      "ecrire",
      "mon-histoire",
      "mes-liens",
      "mes-rp",
      "mon-jeu",
    ]
  ) {
    await p.click(`[data-wm-carnet-onglet='${clef}']`);
    await p.waitForTimeout(60);
  }
  const vu = await p.evaluate(() => ({
    visibles: [...document.querySelectorAll("[data-wm-carnet-page]")]
      .filter((s) => !s.hidden).map((s) => s.getAttribute("data-wm-carnet-page")),
    adresse: location.hash,
  }));
  dire(
    "changer d'onglet ne demande RIEN, sauf la première ouverture des quatre onglets qui écrivent",
    //  DIX, ET PLUS HUIT DEPUIS LE 20 NOVEMBRE : « Mes RP » demande
    //  désormais aussi `rp_participant` — avec qui on écrit — et
    //  `rp_colonne` — le nom qu'on donne à ses colonnes. Deux requêtes
    //  de plus, UNE SEULE FOIS chacune : c'est exactement la garantie
    //  que ce test porte, et elle tient.
    apresLePremierTour === avant + 10 && appels.length === apresLePremierTour &&
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
      noms: cases.map((c) =>
        c.querySelector(".wm-carnet__pkmn-nom")?.textContent?.trim() ?? ""
      ),
      niveaux: cases.map((c) =>
        c.querySelector(".wm-carnet__pkmn-niveau")?.textContent?.trim() ?? ""
      ),
      pension: cases.filter((c) => c.classList.contains("wm-carnet__pkmn--pension")).length,
      compte: document.querySelector("[data-wm-carnet-equipe-compte]")?.textContent?.trim() ??
        "",
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
    arenes:
      document.querySelectorAll("[data-wm-carnet-badges='arene'] .wm-carnet__badge").length,
    colos:
      document.querySelectorAll("[data-wm-carnet-badges='colosseum'] .wm-carnet__badge").length,
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
      chasseFixe: dl === null
        ? ""
        : getComputedStyle(dl.querySelector(".wm-carnet__code")).fontFamily,
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
    //  LE COMPTE SE LIT DANS LE FICHIER, il ne s'écrit pas ici. « 933 »
    //  était vrai jusqu'au 6 novembre ; le Pokédex en porte 955 depuis
    //  que les lignées fossiles l'ont rejoint, et ce contrôle criait
    //  pour une bonne donnée.
    `le Pokédex montre les ${AU_DEX} espèces, trois états, la silhouette étant le même sprite éteint`,
    vu.cases === AU_DEX && vu.attrapees === 2 && vu.croisees === 1 &&
      vu.compte === `2 / ${AU_DEX}` &&
      vu.total === String(AU_DEX) && /brightness\(0\)/.test(vu.filtre ?? "") &&
      vu.inconnuSansImage &&
      vu.filtres === 20,
    JSON.stringify(vu),
  );
}

{
  //  ── OÙ POINTENT LES IMAGES ──────────────────────────────────────
  //
  //  TROUVÉ LE 4 NOVEMBRE, APRÈS L'ANNEXE DE LA CARTE. Le carnet
  //  écrivait `assets/pokemon/<id>.png`, `assets/badges/<slug>.png` et
  //  `assets/items/<slug>.png` à la main. AUCUN de ces trois dossiers
  //  n'existe dans le dépôt : neuf cent trente-trois sprites, onze
  //  badges et toutes les vignettes d'objet étaient en 404, sans que
  //  rien ne le dise — la page restait debout, avec des trous.
  //
  //  CE HARNAIS NE L'AVAIT PAS VU PARCE QU'IL SERVAIT UN CARRÉ VIDE à
  //  la place de tout fichier manquant. On ne peut pas vérifier que
  //  les fichiers existent — les 1 838 sprites vivent sur le Mac, pas
  //  dans ce bac à sable — mais on peut vérifier OÙ ON LES DEMANDE, et
  //  c'est ce qui aurait suffi.
  const vu = await p.evaluate(() => {
    const src = (s) =>
      [...document.querySelectorAll(s)].map((i) => i.getAttribute("src") ?? "");
    return {
      dex: src("[data-wm-carnet-grille] img").slice(0, 40),
      combien: document.querySelectorAll("[data-wm-carnet-grille] img").length,
    };
  });
  dire(
    "les sprites du Pokédex vont chercher `assets/sprites-figes/`, pas un dossier vide",
    vu.combien > 0 &&
      vu.dex.every((u) => /\/assets\/sprites-figes\/[^/]+\/\d+\.(png|gif)$/.test(u)),
    JSON.stringify({
      combien: vu.combien,
      premier: vu.dex[0],
      mauvais: vu.dex.filter((u) => !/sprites-figes/.test(u)).slice(0, 3),
    }),
  );
}

{
  await p.click("[data-wm-carnet-onglet='mon-jeu']");
  await p.waitForTimeout(200);
  const vu = await p.evaluate(() => ({
    badges: [...document.querySelectorAll("[data-wm-carnet-badges] img")]
      .map((i) => i.getAttribute("src") ?? ""),
    equipe: [...document.querySelectorAll("[data-wm-carnet-equipe] img")]
      .map((i) => i.getAttribute("src") ?? ""),
  }));
  dire(
    "les badges vont chercher `img/badges/`, pas `assets/badges/` qui n'existe pas",
    vu.badges.length > 0 && vu.badges.every((u) => /\/img\/badges\/[a-z]+\.png$/.test(u)),
    JSON.stringify(vu.badges.slice(0, 3)),
  );
  dire(
    "et les sprites de l'équipe aussi viennent de `assets/sprites-figes/`",
    vu.equipe.length > 0 && vu.equipe.every((u) => /sprites-figes/.test(u)),
    JSON.stringify(vu.equipe.slice(0, 3)),
  );
}

{
  await p.click("[data-wm-carnet-onglet='mon-sac']");
  await p.waitForTimeout(200);
  const vu = await p.evaluate(() => ({
    objets: [...document.querySelectorAll("[data-wm-carnet-sac] img, .wm-carnet__objet img")]
      .map((i) => i.getAttribute("src") ?? ""),
  }));
  //  LES VIGNETTES D'OBJET SONT CHEZ POKEAPI, à un commit épinglé :
  //  on ne les recopie pas dans le dépôt, la couverture dit lesquelles
  //  existent. Un objet sans vignette ne doit PAS poser d'image.
  dire(
    "les vignettes d'objet viennent de la couverture, jamais d'un `assets/items/` inexistant",
    vu.objets.every((u) => u !== "" && !/\/assets\/items\//.test(u)),
    JSON.stringify(vu.objets.slice(0, 3)),
  );
  await p.click("[data-wm-carnet-onglet='mon-pokedex']");
  await p.waitForTimeout(200);
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
    vu.visibles === 2 && vu.toujoursLa === AU_DEX && vu.adresse === "#attrape" &&
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
      new RegExp(`^${ANNEXE_REGION}#zone-\\d+$`).test(vu.lien ?? ""),
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
    return {
      bouton: true,
      bascule: avant !== apres,
      revient: document.body.classList.contains("wm-sombre") === avant,
    };
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

// ── L'AIDE DE CHAQUE PAGE ───────────────────────────────────────────
//
//  « Sur chaque page du carnet de bord, tu vas mettre une petite aide
//  accessible quelque part qui explique l'utilité de chaque page et
//  comment l'utiliser, avec des captures d'écran. » — 18 novembre.
{
  const { q } = await monter();
  await q.waitForTimeout(250);
  const aides = await q.evaluate(() => {
    const pages = [...document.querySelectorAll("[data-wm-carnet-page]")];
    return {
      pages: pages.length,
      //  LE BOUTON EST CELUI DU TUTO DEPUIS LE 20 NOVEMBRE : « j'ai vu
      //  qu'il y avait encore le "?" au début de la page. Du coup,
      //  celui-ci tu peux le retirer. » Les sept pages servies par
      //  `aide-carnet.json` et la page « Mes RP », qui porte le sien
      //  dans le HTML, ont maintenant la MÊME coquille.
      avecAide: pages.filter((p) => p.querySelector("[data-wm-tuto-ouvrir]") !== null).length,
      //  REPLIÉES AU DÉPART, TOUTES. Une aide dépliée d'office pousse
      //  le travail vers le bas à chaque visite.
      //
      //  ET LE PANNEAU SE CHERCHE PAR L'ID QUE SON BOUTON NOMME, pas
      //  dans la page : `brancherLeTuto` le DÉPLACE à la racine du
      //  document pour qu'il passe au-dessus de la barre de retour.
      //  Le chercher dans la section ne trouvait plus rien — et une
      //  mesure qui ne trouve rien ne mesure rien.
      ouvertes: pages.filter((p) => {
        const b = p.querySelector("[data-wm-tuto-ouvrir]");
        const id = b?.getAttribute("aria-controls") ?? "";
        const pan = id === "" ? null : document.getElementById(id);
        return pan !== null && pan.hidden === false;
      }).length,
      //  UNE SEULE PAR PAGE : le carnet redessine ses pages quand les
      //  données arrivent, et deux points d'interrogation côte à côte
      //  seraient le signe que quelque chose se repose en double. La
      //  page « Mes RP » est le cas à surveiller : elle a déjà son
      //  tuto écrit à la main, et `poserLesAides` doit la sauter.
      doubles: pages.filter((p) => p.querySelectorAll("[data-wm-tuto-ouvrir]").length > 1)
        .length,
      //  ET PLUS AUCUN « ? » DANS UN EN-TÊTE : c'est exactement ce
      //  qu'elle a vu, et ce qui ne doit pas revenir.
      dansLEntete: pages.filter((p) =>
        p.querySelector(".wm-carnet__entete [data-wm-tuto-ouvrir]") !== null
      ).length,
    };
  });
  dire(
    "CHAQUE PAGE A SON AIDE, ET AUCUNE N'EST POSÉE EN DOUBLE",
    aides.pages >= 8 && aides.avecAide === aides.pages && aides.doubles === 0,
    JSON.stringify(aides),
  );
  dire(
    "ET PLUS AUCUN « ? » AU DÉBUT D'UNE PAGE — ils sont tous en bas à droite",
    aides.dansLEntete === 0,
    JSON.stringify({ dansLEntete: aides.dansLEntete }),
  );
  dire(
    "elles sont repliées au départ",
    aides.ouvertes === 0,
    `${aides.ouvertes} ouverte(s)`,
  );

  //  ON CLIQUE POUR DE VRAI, sur la page visible. Un panneau qu'on
  //  déclare ouvert sans le regarder ne prouve rien.
  await q.click('[data-wm-carnet-onglet="mon-sac"]');
  await q.waitForTimeout(150);
  await q.click('[data-wm-carnet-page="mon-sac"] [data-wm-tuto-ouvrir]');
  await q.waitForTimeout(150);
  const ouvert = await q.evaluate(() => {
    const page = document.querySelector('[data-wm-carnet-page="mon-sac"]');
    const b = page.querySelector("[data-wm-tuto-ouvrir]");
    const pan = document.getElementById(b.getAttribute("aria-controls"));
    const r = b.getBoundingClientRect();
    return {
      visible: pan.getBoundingClientRect().height > 0,
      annonce: b.getAttribute("aria-expanded"),
      cible: Math.round(r.height),
      //  EN BAS À DROITE, mesuré : à moins de 80 px des deux bords.
      //  C'est la règle du 20 novembre, et elle vaut pour les huit
      //  pages, pas seulement pour « Mes RP ».
      duBasDroit: [
        Math.round(globalThis.innerWidth - r.right),
        Math.round(globalThis.innerHeight - r.bottom),
      ],
      //  ET LE TIROIR PASSE AU-DESSUS DE LA BARRE DE RETOUR : elle est
      //  collante en plan 70, le tiroir était en 41, donc sa croix
      //  tombait dessous et le clic allait à la barre. « J'arrive pas à
      //  le fermer et il passe en dessous de la barre de navigation. »
      auDessusDeLaBarre: (() => {
        const haut = pan.getBoundingClientRect().top + 8;
        const dessus = document.elementFromPoint(
          pan.getBoundingClientRect().right - 24,
          haut,
        );
        return dessus !== null && pan.contains(dessus);
      })(),
      gestes: pan.querySelectorAll(".wm-aide__gestes li").length,
      capture: pan.querySelector(".wm-aide__capture")?.getAttribute("src") ?? null,
      //  L'ALTERNATIVE N'EST PAS VIDE : Forumactif remplit les
      //  alternatives vides avec le titre de la page et le nom du
      //  fichier — relevé le 18 novembre sur un sprite de combat.
      alt: pan.querySelector(".wm-aide__capture")?.getAttribute("alt") ?? null,
      //  ELLE DIT CE QUE LA PAGE FAIT, pas ce qu'elle contient.
      dit: pan.textContent.slice(0, 60),
    };
  });
  dire(
    "ELLE S'OUVRE AU CLIC, ET LE BOUTON L'ANNONCE",
    ouvert.visible && ouvert.annonce === "true",
    JSON.stringify({ visible: ouvert.visible, annonce: ouvert.annonce }),
  );
  dire(
    "la cible fait 44 px, elle est en bas à droite, et l'aide donne des gestes",
    ouvert.cible >= 44 && ouvert.gestes >= 3 &&
      ouvert.duBasDroit.every((d) => d >= 0 && d < 80),
    `${ouvert.cible} px · ${ouvert.gestes} geste(s) · ${JSON.stringify(ouvert.duBasDroit)}`,
  );
  dire(
    "ET LE HAUT DU TIROIR EST CLIQUABLE : il passe AU-DESSUS de la barre de retour",
    ouvert.auDessusDeLaBarre === true,
    JSON.stringify({ auDessusDeLaBarre: ouvert.auDessusDeLaBarre }),
  );

  //  ── ET ON LE REFERME POUR DE VRAI ─────────────────────────────────
  //
  //  « Quand j'ouvre le "?" en bas à droite, j'arrive pas à le
  //  fermer. » La croix était là, mais sous la barre : le clic ne
  //  l'atteignait pas. On clique donc la croix, pas une fonction.
  const quelleAide = await q.evaluate(() =>
    document.querySelector('[data-wm-carnet-page="mon-sac"] [data-wm-tuto-ouvrir]')
      ?.getAttribute("aria-controls") ?? ""
  );
  await q.click(`#${quelleAide} [data-wm-tuto-fermer]`);
  await q.waitForTimeout(200);
  const referme = await q.evaluate((id) => {
    const page = document.querySelector('[data-wm-carnet-page="mon-sac"]');
    return {
      cache: document.getElementById(id)?.hidden === true,
      annonce: page.querySelector("[data-wm-tuto-ouvrir]")?.getAttribute("aria-expanded"),
    };
  }, quelleAide);
  dire(
    "LA CROIX LE REFERME, ET LE BOUTON LE DIT",
    referme.cache === true && referme.annonce === "false",
    JSON.stringify(referme),
  );

  //  ── ET IL N'A PAS ÉTÉ BRANCHÉ DEUX FOIS ───────────────────────────
  //
  //  Les aides arrivent après le premier passage de `brancherLeTuto`,
  //  donc on la rappelle. Sans marque, le bouton de « Mes RP » aurait
  //  reçu un second écouteur : les deux basculeraient au même clic, et
  //  le panneau s'ouvrirait puis se refermerait aussitôt. Un bouton
  //  mort, pour une raison invisible.
  await q.click('[data-wm-carnet-onglet="mes-rp"]');
  await q.waitForTimeout(200);
  await q.click('[data-wm-carnet-page="mes-rp"] [data-wm-tuto-ouvrir]');
  await q.waitForTimeout(200);
  const uneSeuleFois = await q.evaluate(() => {
    const b = document.querySelector('[data-wm-carnet-page="mes-rp"] [data-wm-tuto-ouvrir]');
    const id = b?.getAttribute("aria-controls") ?? "";
    return id !== "" && document.getElementById(id)?.hidden === false;
  });
  dire(
    "LE TUTO DE « MES RP » N'A PAS ÉTÉ BRANCHÉ DEUX FOIS — il s'ouvre et il reste ouvert",
    uneSeuleFois === true,
    JSON.stringify({ uneSeuleFois }),
  );
  dire(
    "et elle porte sa capture, avec une alternative qui dit quoi",
    ouvert.capture !== null && /img\/aide\/mon-sac\.png$/.test(ouvert.capture) &&
      (ouvert.alt ?? "").includes("Mon sac"),
    JSON.stringify({ capture: ouvert.capture, alt: ouvert.alt }),
  );

  //  ── LE MODULE D'ACCESSIBILITÉ, ICI AUSSI ──────────────────────────
  //
  //  « Tu rajouteras aussi le module d'accessibilité ici aussi. » Il
  //  n'y était pas : le carnet est une page autonome, sans coin
  //  d'outils, et le module cherchait un coin. Il sait s'accrocher à
  //  la barre de retour depuis le 8 novembre ; c'est l'appel qui
  //  manquait.
  const confort = await q.evaluate(() => {
    const b = document.querySelector(".wm-confort__bouton");
    if (b === null) return null;
    return {
      dansLaBarre: b.closest(".wm-retour") !== null,
      annonce: b.getAttribute("aria-expanded"),
      cible: Math.round(b.getBoundingClientRect().height),
    };
  });
  dire(
    "LE RÉGLAGE DE CONFORT EST DANS LA BARRE DU CARNET",
    confort !== null && confort.dansLaBarre && confort.annonce === "false",
    JSON.stringify(confort),
  );
  await q.close();
}

// ── LES CAPTURES DE L'AIDE ──────────────────────────────────────────
//
//  `deno task carnet --captures` refait les huit images que les
//  panneaux d'aide affichent.
//
//  ELLES SONT DÉRIVÉES, PAS DESSINÉES. Une capture prise à la main
//  vieillit sans prévenir : la page change, l'image reste, et l'aide
//  se met à montrer un écran qui n'existe plus. Ici elles sortent du
//  carnet MONTÉ AVEC SES DONNÉES D'ESSAI, par le même harnais qui le
//  mesure — donc d'un carnet dont on vient de vérifier qu'il est
//  juste.
//
//  LES DONNÉES SONT CELLES DU DÉCOR, et c'est volontaire : aucune
//  capture ne montre le carnet de quelqu'un.
if (Deno.args.includes("--captures")) {
  const PAGES = [
    "mes-rp",
    "ecrire",
    "mon-histoire",
    "mes-liens",
    "mon-jeu",
    "mes-boites",
    "mon-sac",
    "mon-pokedex",
  ];
  const { q } = await monter({ brouillons: TROIS });
  //  UNE FENÊTRE LARGE : la capture sert à reconnaître la page d'un
  //  coup d'œil dans un panneau d'aide, pas à lire son texte. En
  //  colonne étroite, les huit se ressembleraient toutes.
  await q.setViewportSize({ width: 1280, height: 900 });
  mkdirSync(R + "img/aide", { recursive: true });
  for (const nom of PAGES) {
    await q.click(`[data-wm-carnet-onglet="${nom}"]`);
    await q.waitForTimeout(250);
    const section = await q.$(`[data-wm-carnet-page="${nom}"]`);
    if (section === null) {
      soucis.push(`capture : pas de page « ${nom} »`);
      continue;
    }
    //  ── LES IMAGES ABSENTES DEVIENNENT DES CASES, PAS DES CROIX ───
    //
    //  Le harnais n'a pas de réseau : les vignettes d'objet et les
    //  sprites viennent de PokeAPI, et le navigateur peint à leur
    //  place son icône d'image cassée. Sur une capture qui part dans
    //  l'aide des joueuses, ça ferait croire que le carnet est en
    //  panne.
    //
    //  ON NE CACHE PAS CE QUI EXISTE : seules les images dont la
    //  largeur naturelle vaut zéro — donc celles qui n'ont pas chargé
    //  — passent en case sourde. Celles qui sont là restent telles
    //  quelles, et la capture montre la vraie page.
    await q.evaluate(() => {
      for (const i of document.querySelectorAll("img")) {
        if (i.naturalWidth > 0) continue;
        i.style.visibility = "hidden";
      }
    });
    //  LE PANNEAU D'AIDE NE SE PHOTOGRAPHIE PAS LUI-MÊME. Il est
    //  replié, donc invisible — mais son bouton, lui, est dans
    //  l'en-tête, et une capture qui le montre apprendrait au lecteur
    //  qu'il peut cliquer sur ce qu'il est déjà en train de lire.
    await section.screenshot({ path: `${R}img/aide/${nom}.png` });
  }
  await q.close();
  console.log(`captures : ${PAGES.length} images dans img/aide/`);
}

if (soucis.length > 0) console.log("\n-- ce qui reste --\n" + soucis.join("\n"));
// ══════════════════════════════════════════════════════════════════
//  LES QUATRE ÉTATS DE L'ACCUEIL
//
//  Relevé sur la page EN LIGNE le 19 novembre, à 1440 px :
//
//      lier         hidden=true  display=grid   ← s'affichait
//      présentation hidden=true  display=none   ← obéissait
//
//  Le script cachait les deux ; `display: grid` écrit dans la feuille
//  battait le `[hidden] { display: none }` du navigateur. Une
//  visiteuse non connectée voyait donc le formulaire d'adresse — qui
//  ne pouvait pas aboutir — SANS l'explication d'à côté.
//
//  Trois endroits du carnet avaient la même fuite : ce bloc, les
//  filtres de RP, et la vue en liste. Les deux derniers ont été
//  découverts par ce harnais, qui cliquait depuis des semaines des
//  boutons qu'une joueuse ne peut pas atteindre.
// ══════════════════════════════════════════════════════════════════
{
  console.log("\n── L'ACCUEIL, QUAND ON N'EST PAS CONNECTÉE ─────────────");
  const { q } = await monter({ compte: "invite" });
  await q.waitForTimeout(300);
  const vu = await q.evaluate(() => {
    const voit = (s) => {
      const e = document.querySelector(s);
      return e !== null && getComputedStyle(e).display !== "none" && e.offsetParent !== null;
    };
    const lien = document.querySelector("[data-wm-carnet-connexion-lien]");
    const foc = [...document.querySelectorAll("a[href],button,input,textarea,select")]
      .filter((e) => e.offsetParent !== null && !e.disabled);
    //  L'UNIQUE ACTION DE LA PAGE, MESURÉE. Une ancre à qui on donne
    //  une classe de bouton reste une ancre : en ligne, soulignée,
    //  haute comme son texte. Trois mesures, pas une classe lue.
    const sl = lien === null ? null : getComputedStyle(lien);
    const action = lien === null ? null : {
      hauteur: Math.round(lien.getBoundingClientRect().height),
      fond: sl.backgroundColor,
      souligne: sl.textDecorationLine,
    };
    return {
      action,
      presentation: voit("[data-wm-carnet-presentation]"),
      formulaire: voit("[data-wm-carnet-liaison]"),
      connexion: voit("[data-wm-carnet-connexion]"),
      retour: lien?.getAttribute("href") ?? null,
      onglets: voit('nav[aria-label="Les onglets du carnet"]'),
      //  CE QUI EST MARQUÉ CACHÉ EST CACHÉ — partout, pas seulement
      //  ici. C'est la règle qui tient les trois fuites d'un coup.
      cachesQuiSAffichent: [...document.querySelectorAll(".wm-carnet [hidden]")]
        .filter((e) => getComputedStyle(e).display !== "none").length,
      focusables: foc.length,
      //  LE CANAL DES PANNES DOIT ÊTRE MUET ICI : arriver déconnectée
      //  n'est pas une panne, et la ligne en terre brûlée disait la
      //  même chose que l'encadré, en plus alarmant.
      souci: (document.querySelector(".wm-carnet__souci")?.textContent ?? "").trim(),
    };
  });
  dire(
    "LA PRÉSENTATION EST LÀ — c'est l'état où elle sert le plus",
    vu.presentation === true,
    JSON.stringify(vu),
  );
  dire(
    "ET LE FORMULAIRE D'ADRESSE N'Y EST PAS — il ne pourrait pas aboutir",
    vu.formulaire === false,
    `formulaire visible : ${vu.formulaire}`,
  );
  dire(
    "on demande la connexion, et le lien ramène ici",
    vu.connexion === true && /^\/login\?redirect=/.test(vu.retour ?? ""),
    String(vu.retour),
  );
  dire(
    "ET ELLE RESSEMBLE À UNE ACTION, PAS À UNE NOTE DE BAS DE PAGE",
    vu.action !== null &&
      vu.action.hauteur >= 36 &&
      vu.action.souligne === "none" &&
      !/rgba\(0, 0, 0, 0\)|transparent/.test(vu.action.fond),
    JSON.stringify(vu.action),
  );
  dire(
    "LES ONGLETS NE SONT PAS DANS LE PARCOURS — ils ne mènent nulle part",
    vu.onglets === false,
    `onglets visibles : ${vu.onglets} · ${vu.focusables} éléments focalisables`,
  );
  dire(
    "ET RIEN DE MARQUÉ CACHÉ NE S'AFFICHE",
    vu.cachesQuiSAffichent === 0,
    `${vu.cachesQuiSAffichent} bloc(s) caché(s) mais visible(s)`,
  );
  dire(
    "ET LE CANAL DES PANNES RESTE MUET — ce n'est pas une panne",
    vu.souci === "",
    `souci : « ${vu.souci} »`,
  );
  if (Deno.args.includes("--photo")) {
    const bloc = await q.$(".wm-carnet__dehors");
    if (bloc !== null) await bloc.screenshot({ path: "carnet-decouverte.png" });
  }
  await q.close();
}

{
  //  ── L'ÉTAT 3 : LE LIEN EST PARTI ──────────────────────────────
  //
  //  Le formulaire restait en place sous le message de succès : même
  //  champ, même bouton. Le deuxième clic ne redemande pas un lien,
  //  il répond « trop de demandes d'un coup » — ce qui se lit comme
  //  une panne alors que le premier est déjà dans la boîte.
  console.log("\n── QUAND LE LIEN EST PARTI ────────────────────────────");
  const { q } = await monter({ laissez: null });
  await q.waitForTimeout(300);
  await q.fill("#wm-courriel", "eliott@exemple.test");
  await q.click('[data-wm-carnet-liaison] button[type="submit"]');
  await q.waitForTimeout(400);
  const apres = await q.evaluate(() => {
    const voit = (s) => {
      const e = document.querySelector(s);
      return e !== null && getComputedStyle(e).display !== "none" && e.offsetParent !== null;
    };
    return {
      formulaire: voit("[data-wm-carnet-liaison]"),
      parti: voit("[data-wm-carnet-parti]"),
      adresse: document.querySelector("[data-wm-carnet-parti-adresse]")?.textContent?.trim(),
      message: document.querySelector("[data-wm-carnet-lier-dit]")?.textContent?.trim()?.slice(
        0,
        40,
      ),
    };
  });
  dire(
    "LE FORMULAIRE S'EFFACE, ET L'ADRESSE S'AFFICHE",
    apres.formulaire === false && apres.parti === true &&
      (apres.adresse ?? "").includes("eliott@exemple.test"),
    JSON.stringify(apres),
  );
  dire(
    "et le message qui dit quoi faire est toujours là",
    /spams/.test(apres.message ?? ""),
    String(apres.message),
  );
  //  LE RENVOI EST UN SECOND CHOIX, mais il existe : une faute de
  //  frappe dans l'adresse est la première cause d'un lien perdu.
  await q.click("[data-wm-carnet-renvoyer]");
  await q.waitForTimeout(150);
  const revenu = await q.evaluate(() => ({
    formulaire: document.querySelector("[data-wm-carnet-liaison]")?.hidden === false,
    focus: document.activeElement?.id ?? null,
  }));
  dire(
    "ET LE RENVOI RAMÈNE LE CHAMP, CURSEUR DEDANS",
    revenu.formulaire === true && revenu.focus === "wm-courriel",
    JSON.stringify(revenu),
  );
  if (Deno.args.includes("--photo")) {
    //  On repart sur l'état 3 pour la photo : le renvoi vient de
    //  ramener le formulaire.
    await q.fill("#wm-courriel", "eliott@exemple.test");
    await q.click('[data-wm-carnet-liaison] button[type="submit"]');
    await q.waitForTimeout(400);
    const bloc = await q.$(".wm-carnet__dehors");
    if (bloc !== null) await bloc.screenshot({ path: "carnet-lien-parti.png" });
  }
  await q.close();
}

{
  //  ── CE QUI SE LIT AU CLAVIER ET AU LECTEUR D'ÉCRAN ────────────
  console.log("\n── LA STRUCTURE DE L'ACCUEIL ──────────────────────────");
  const { q } = await monter({ laissez: null });
  await q.waitForTimeout(300);
  const st = await q.evaluate(() => {
    const champ = document.querySelector("#wm-courriel");
    const foc = [...document.querySelectorAll("a[href],button,input,textarea,select")]
      .filter((e) => e.offsetParent !== null && !e.disabled);
    return {
      titres: [...document.querySelectorAll("h1,h2,h3")]
        .filter((e) => e.offsetParent !== null)
        .map((e) => e.tagName + " " + e.textContent.trim().replace(/\s+/g, " ").slice(0, 34)),
      rangDuChamp: foc.indexOf(champ) + 1,
      total: foc.length,
      //  L'AIDE EST UN TEXTE, PAS UN PLACEHOLDER : « celle de ton
      //  inscription » disparaissait au premier caractère tapé, et
      //  c'était le seul endroit qui disait QUELLE adresse.
      decritPar: champ?.getAttribute("aria-describedby"),
      aideTexte: document.getElementById(champ?.getAttribute("aria-describedby") ?? "")
        ?.textContent?.trim(),
      placeholder: champ?.getAttribute("placeholder"),
    };
  });
  dire(
    "LES DEUX ENCADRÉS ONT DE VRAIS TITRES — ils étaient en <p>",
    st.titres.filter((t) => t.startsWith("H3")).length === 2,
    JSON.stringify(st.titres),
  );
  dire(
    "L'AIDE DU CHAMP EST UN TEXTE LIÉ, PAS UN PLACEHOLDER",
    st.decritPar === "wm-courriel-aide" &&
      (st.aideTexte ?? "").includes("inscription") && st.placeholder === null,
    JSON.stringify({
      decritPar: st.decritPar,
      aide: st.aideTexte,
      placeholder: st.placeholder,
    }),
  );
  //  LE CHAMP ÉTAIT LA SEIZIÈME TABULATION SUR DIX-HUIT, pour la
  //  seule action possible de la page. Les huit onglets morts sont
  //  partis ; il doit être bien plus près.
  dire(
    "ET LE CHAMP SE TROUVE SANS TRAVERSER LA PAGE",
    st.rangDuChamp > 0 && st.rangDuChamp <= 9,
    `${st.rangDuChamp}ᵉ tabulation sur ${st.total}`,
  );
  //  ── LE LIEN D'ÉVITEMENT MANQUAIT TOUT À FAIT ──────────────────
  //
  //  `module-navigation.ts` en pose un sur les pages du forum, en
  //  cherchant `#main-content`, `#page-body` ou `#content-main`. La
  //  page du carnet n'est pas un gabarit ModernBB : elle n'en porte
  //  aucun, donc elle n'avait pas de lien du tout.
  //
  //  ET LA CIBLE DOIT PRENDRE LE FOCUS, pas seulement défiler : sans
  //  `tabindex="-1"` dessus, la tabulation suivante repart du haut de
  //  la page et le lien n'a rien évité.
  //  ── ET IL NE SE VOIT PAS TANT QU'ON NE TABULE PAS DESSUS ──────
  //
  //  Le premier jet ne mesurait que la présence et le focus, et le
  //  lien s'affichait en permanence en haut de la page : il était
  //  posé HORS de `#modernbb`, où aucune de nos règles ne le visait.
  //  Un harnais qui vérifie qu'une chose existe sans regarder où elle
  //  est ne vérifie pas grand-chose.
  const saut = await q.evaluate(() => {
    const lien = document.getElementById("wm-evitement");
    if (lien === null) return { lien: false };
    const repos = lien.getBoundingClientRect();
    lien.focus();
    const tenu = lien.getBoundingClientRect();
    lien.click();
    const cible = document.getElementById("wm-carnet-corps");
    return {
      lien: true,
      vise: lien.getAttribute("href"),
      cibleFocalisable: cible?.getAttribute("tabindex") === "-1",
      focusDansLeCorps: cible !== null && cible.contains(document.activeElement),
      //  DANS LE CADRE : sans ça, aucune de nos règles ne l'atteint.
      dansLeCadre: lien.closest("#modernbb") !== null,
      //  AU REPOS IL EST AU-DESSUS DE L'ÉCRAN, au focus il redescend.
      basAuRepos: Math.round(repos.bottom),
      hautAuFocus: Math.round(tenu.top),
    };
  });
  dire(
    "LA PAGE A UN LIEN D'ÉVITEMENT, ET IL DONNE VRAIMENT LE FOCUS",
    saut.lien === true && saut.vise === "#wm-carnet-corps" &&
      saut.cibleFocalisable === true && saut.focusDansLeCorps === true,
    JSON.stringify(saut),
  );
  dire(
    "ET IL NE SE VOIT QU'AU CLAVIER — hors de l'écran au repos",
    saut.dansLeCadre === true && saut.basAuRepos <= 0 && saut.hautAuFocus >= 0,
    JSON.stringify({
      dansLeCadre: saut.dansLeCadre,
      basAuRepos: saut.basAuRepos,
      hautAuFocus: saut.hautAuFocus,
    }),
  );
  await q.close();
}

// ── 7 bis · La page des RP reprise, 20 novembre ─────────────────────

const COMPAGNONS = [
  { sujet_id: 996, pseudo: "Murphy" },
  { sujet_id: 996, pseudo: "Eliott Vanner" },
  { sujet_id: 977, pseudo: "Linus Armstrong" },
];

{
  //  ── LA CARTE DIT OÙ, AVEC QUI, ET MÈNE AU SUJET ─────────────────
  //
  //  Trois demandes du 20 novembre, mesurées ensemble parce qu'elles
  //  vivent sur la même carte.
  const { q } = await monter({ lesRp: RP, lesCompagnons: COMPAGNONS });
  await q.click('[data-wm-carnet-onglet="mes-rp"]');
  await q.waitForTimeout(400);
  const vu = await q.evaluate(() => {
    const carte = document.querySelector('[data-wm-rp-carte="996"]');
    if (carte === null) return null;
    const lien = carte.querySelector("a.wm-rp__carte-titre");
    return {
      titreEstUnLien: lien !== null,
      mene: lien?.getAttribute("href") ?? "",
      tag: carte.querySelector(".wm-rp__tag")?.textContent ?? "",
      ou: carte.querySelector(".wm-rp__carte-ou")?.textContent ?? "",
      avec: carte.querySelector(".wm-rp__carte-avec")?.textContent ?? "",
    };
  });
  dire(
    "LE TITRE DE LA CARTE EST UN LIEN QUI MÈNE AU DERNIER MESSAGE",
    vu !== null && vu.titreEstUnLien && vu.mene === "/t996-#15582",
    JSON.stringify(vu),
  );
  dire(
    "ET LE TAG SE DÉDUIT DU FORUM, sans rien demander au joueur",
    //  34, c'est les Montagnes Embrumées : `carte.json` dit « zone ».
    vu?.tag === "zone sauvage" && vu?.ou === "Montagnes Embrumées",
    JSON.stringify({ tag: vu?.tag, ou: vu?.ou }),
  );
  dire(
    "ET LES COMPAGNONS S'AFFICHENT — SOI-MÊME EXCLU",
    //  La relève range TOUS les participants, celui qui lit compris.
    //  « avec Eliott Vanner » sur la carte d'Eliott serait un défaut.
    vu?.avec === "avec Murphy",
    JSON.stringify({ avec: vu?.avec }),
  );

  const ville = await q.evaluate(() =>
    document.querySelector('[data-wm-rp-carte="977"] .wm-rp__tag')?.textContent ?? ""
  );
  dire("UNE VILLE SE DIT VILLE", ville === "ville", `tag : « ${ville} »`);

  //  UN FORUM INCONNU N'A PAS DE TAG, et c'est voulu : un tag absent
  //  se remarque et se corrige, un tag faux se croit.
  const inconnu = await q.evaluate(() =>
    document.querySelector('[data-wm-rp-carte="1200"] .wm-rp__tag') === null
  );
  dire("ET UN FORUM INCONNU N'EN A PAS", inconnu === true, String(inconnu));
  await q.close();
}

{
  //  ── LES CINQ COLONNES, DANS L'ORDRE DEMANDÉ ─────────────────────
  //
  //  « Mes rps : la première colonne : prévu. et ensuite, en cours. »
  //  Et « rajoute la colonne des rps solo ».
  const { q } = await monter({ lesRp: RP, lesCompagnons: COMPAGNONS });
  await q.click('[data-wm-carnet-onglet="mes-rp"]');
  await q.waitForTimeout(400);
  const colonnes = await q.evaluate(() =>
    [...document.querySelectorAll("[data-wm-rp-colonne]")]
      .map((c) => c.getAttribute("data-wm-rp-colonne"))
  );
  dire(
    "LES COLONNES SONT DANS L'ORDRE, ET LE SOLO EST LÀ",
    JSON.stringify(colonnes) ===
      JSON.stringify(["prevu", "en-cours", "solo", "en-pause", "cloture"]),
    JSON.stringify(colonnes),
  );

  //  ── ELLES DÉFILENT AU LIEU DE SE SERRER ─────────────────────────
  //
  //  Avec `flex: 1 1`, cinq colonnes se partageaient la place et
  //  tombaient à deux mots par ligne. On mesure que la rangée déborde
  //  VRAIMENT, pas que la règle est écrite.
  const glisse = await q.evaluate(() => {
    const t = document.querySelector("[data-wm-rp-tableau]");
    if (t === null) return null;
    const c = getComputedStyle(t);
    return {
      deborde: t.scrollWidth > t.clientWidth,
      largeurColonne: Math.round(
        document.querySelector("[data-wm-rp-colonne]")?.getBoundingClientRect().width ?? 0,
      ),
      defile: c.overflowX,
    };
  });
  dire(
    "ET LA RANGÉE DÉFILE AU LIEU DE SERRER LES COLONNES",
    glisse !== null && glisse.deborde === true && glisse.defile === "auto" &&
      glisse.largeurColonne >= 200,
    JSON.stringify(glisse),
  );
  await q.close();
}

{
  //  ── LA COLONNE DES CLÔTURÉS SE REPLIE ───────────────────────────
  const { q } = await monter({ lesRp: RP, lesCompagnons: COMPAGNONS });
  await q.click('[data-wm-carnet-onglet="mes-rp"]');
  await q.waitForTimeout(400);
  const compter = () =>
    q.evaluate(() => document.querySelectorAll("[data-wm-rp-colonne]").length);
  const avant = await compter();
  await q.click("[data-wm-rp-clotures]");
  await q.waitForTimeout(200);
  const apres = await compter();
  const reste = await q.evaluate(() =>
    document.querySelector('[data-wm-rp-colonne="cloture"]') === null &&
    document.querySelector('[data-wm-rp-colonne="en-cours"]') !== null
  );
  dire(
    "ON REPLIE LES CLÔTURÉS, ET SEULEMENT EUX",
    avant === 5 && apres === 4 && reste === true,
    JSON.stringify({ avant, apres, reste }),
  );
  const ditLeBouton = await q.evaluate(() => {
    const b = document.querySelector("[data-wm-rp-clotures]");
    return { dit: b?.textContent?.trim() ?? "", presse: b?.getAttribute("aria-pressed") };
  });
  dire(
    "ET LE BOUTON DIT CE QU'IL EST, pas ce qu'il fera",
    ditLeBouton.dit === "Clôturés cachés" && ditLeBouton.presse === "false",
    JSON.stringify(ditLeBouton),
  );
  await q.close();
}

{
  //  ── L'AIDE SORT DU TEXTE ────────────────────────────────────────
  //
  //  « Tous les boutons, tu les mets en bas à droite. Pour pas que ça
  //  gêne la lecture. Et au clic, ça ouvre un panneau à droite. »
  const { q } = await monter({ lesRp: RP, lesCompagnons: COMPAGNONS });
  await q.click('[data-wm-carnet-onglet="mes-rp"]');
  await q.waitForTimeout(400);
  const bouton = await q.evaluate(() => {
    const b = document.querySelector('[data-wm-carnet-page="mes-rp"] [data-wm-tuto-ouvrir]');
    if (b === null) return null;
    const r = b.getBoundingClientRect();
    const c = getComputedStyle(b);
    return {
      fixe: c.position,
      //  EN BAS À DROITE, mesuré : à moins de 80 px des deux bords.
      duBasDroit: [
        Math.round(globalThis.innerWidth - r.right),
        Math.round(globalThis.innerHeight - r.bottom),
      ],
      ouvert: b.getAttribute("aria-expanded"),
      //  LE PANNEAU SE TROUVE PAR SON ID : il y en a huit à la racine
      //  du document depuis que `brancherLeTuto` les y déplace, et le
      //  premier venu n'est pas forcément celui de cette page.
      panneauCache: document.getElementById(b.getAttribute("aria-controls"))?.hidden === true,
    };
  });
  dire(
    "LE BOUTON D'AIDE EST FIXE, EN BAS À DROITE, ET LE PANNEAU EST FERMÉ",
    bouton !== null && bouton.fixe === "fixed" && bouton.ouvert === "false" &&
      bouton.panneauCache === true && bouton.duBasDroit.every((d) => d >= 0 && d < 80),
    JSON.stringify(bouton),
  );

  await q.click('[data-wm-carnet-page="mes-rp"] [data-wm-tuto-ouvrir]');
  await q.waitForTimeout(250);
  const ouvert = await q.evaluate(() => {
    const b = document.querySelector('[data-wm-carnet-page="mes-rp"] [data-wm-tuto-ouvrir]');
    const p = document.getElementById(b?.getAttribute("aria-controls") ?? "");
    if (p === null) return null;
    const r = p.getBoundingClientRect();
    return {
      visible: p.hidden === false,
      //  À DROITE : son bord droit touche celui de la fenêtre.
      colleADroite: Math.round(globalThis.innerWidth - r.right) <= 2,
      //  ET LE FOCUS EST DEDANS, sinon le clavier reste derrière.
      focusDedans: p.contains(document.activeElement),
      dit: p.getAttribute("aria-expanded"),
    };
  });
  dire(
    "AU CLIC, IL OUVRE UN PANNEAU À DROITE, ET LE FOCUS Y ENTRE",
    ouvert !== null && ouvert.visible && ouvert.colleADroite && ouvert.focusDedans,
    JSON.stringify(ouvert),
  );

  await q.keyboard.press("Escape");
  await q.waitForTimeout(250);
  const referme = await q.evaluate(() => ({
    cache: document.getElementById(
      document.querySelector('[data-wm-carnet-page="mes-rp"] [data-wm-tuto-ouvrir]')
        ?.getAttribute("aria-controls") ?? "",
    )?.hidden === true,
    //  ET LE FOCUS REVIENT SUR LE BOUTON : sans ça on referme et on se
    //  retrouve en haut du document, loin de ce qu'on lisait.
    focusSurLeBouton: document.activeElement?.hasAttribute("data-wm-tuto-ouvrir") === true,
  }));
  dire(
    "ÉCHAP LE REFERME, ET LE FOCUS REVIENT SUR LE BOUTON",
    referme.cache === true && referme.focusSurLeBouton === true,
    JSON.stringify(referme),
  );
  await q.close();
}

{
  //  ── CHACUN NOMME SES COLONNES ───────────────────────────────────
  //
  //  « L'idée était de changer le nom de la colonne, que chacun puisse
  //  la personnaliser. C'est possible ? » — 20 novembre.
  const { q, appels } = await monter({
    lesRp: RP,
    lesCompagnons: COMPAGNONS,
    lesNomsDeColonnes: [{ etat: "prevu", nom: "À lancer" }],
  });
  await q.click('[data-wm-carnet-onglet="mes-rp"]');
  await q.waitForTimeout(400);

  const lu = await q.evaluate(() => ({
    prevu: document.querySelector('[data-wm-rp-renommer="prevu"]')?.textContent ?? "",
    encours: document.querySelector('[data-wm-rp-renommer="en-cours"]')?.textContent ?? "",
  }));
  dire(
    "LE NOM GARDÉ S'AFFICHE, ET LES AUTRES GARDENT LE LEUR",
    lu.prevu === "À lancer" && lu.encours === "en cours",
    JSON.stringify(lu),
  );

  //  LA CLÉ NE BOUGE PAS AVEC L'ÉTIQUETTE : c'est tout le pari de la
  //  0059. Si l'attribut suivait le nom, un dépôt écrirait « À lancer »
  //  dans `etat` et la contrainte le refuserait.
  const clefTenue = await q.evaluate(() =>
    document.querySelector('[data-wm-rp-colonne="prevu"]') !== null
  );
  dire(
    "ET LA CLÉ DE LA COLONNE RESTE `prevu`, quoi qu'on ait écrit dessus",
    clefTenue === true,
    JSON.stringify({ clefTenue }),
  );

  //  ── ON RENOMME ──────────────────────────────────────────────────
  await q.click('[data-wm-rp-renommer="en-cours"]');
  await q.waitForTimeout(150);
  const enEdition = await q.evaluate(() => {
    const c = document.querySelector(".wm-rp__colonne-champ");
    return { la: c !== null, focus: c === document.activeElement, dit: c?.value ?? "" };
  });
  dire(
    "AU CLIC, LE NOM DEVIENT UN CHAMP QUI A LE FOCUS",
    enEdition.la && enEdition.focus && enEdition.dit === "en cours",
    JSON.stringify(enEdition),
  );

  await q.fill(".wm-rp__colonne-champ", "Ça tourne");
  await q.keyboard.press("Enter");
  await q.waitForTimeout(300);
  const ecrit = appels.filter((a) => a.ou === "POST-nom");
  dire(
    "ENTRÉE L'ENREGISTRE — UN UPSERT, PARCE QUE LA LIGNE PEUT NE PAS EXISTER",
    ecrit.length === 1 && ecrit[0].corps.etat === "en-cours" &&
      ecrit[0].corps.nom === "Ça tourne" &&
      ecrit[0].prefere.includes("merge-duplicates"),
    JSON.stringify(ecrit),
  );
  const repeint = await q.evaluate(() =>
    document.querySelector('[data-wm-rp-renommer="en-cours"]')?.textContent ?? ""
  );
  dire(
    "ET LA COLONNE PORTE LE NOUVEAU NOM SANS RECHARGER",
    repeint === "Ça tourne",
    JSON.stringify({ repeint }),
  );

  //  ── LE VIDE REMET LE MOT D'ORIGINE ──────────────────────────────
  //
  //  On EFFACE la ligne au lieu d'y écrire « en cours » : le jour où ce
  //  mot change dans ETATS, une colonne jamais renommée doit suivre.
  await q.click('[data-wm-rp-renommer="en-cours"]');
  await q.waitForTimeout(150);
  await q.fill(".wm-rp__colonne-champ", "   ");
  await q.keyboard.press("Enter");
  await q.waitForTimeout(300);
  const efface = appels.filter((a) => a.ou === "DELETE-nom");
  const revenu = await q.evaluate(() =>
    document.querySelector('[data-wm-rp-renommer="en-cours"]')?.textContent ?? ""
  );
  dire(
    "UN NOM VIDE EFFACE LA LIGNE ET REND SON MOT À LA COLONNE",
    efface.length === 1 && efface[0].ou_quoi.includes("etat=eq.en-cours") &&
      revenu === "en cours",
    JSON.stringify({ efface, revenu }),
  );

  //  ── ÉCHAP N'ÉCRIT RIEN ──────────────────────────────────────────
  const avant = appels.filter((a) => a.ou.endsWith("-nom")).length;
  await q.click('[data-wm-rp-renommer="prevu"]');
  await q.waitForTimeout(150);
  await q.fill(".wm-rp__colonne-champ", "Jamais écrit");
  await q.keyboard.press("Escape");
  await q.waitForTimeout(300);
  const apres = appels.filter((a) => a.ou.endsWith("-nom")).length;
  const intact = await q.evaluate(() =>
    document.querySelector('[data-wm-rp-renommer="prevu"]')?.textContent ?? ""
  );
  dire(
    "ÉCHAP ABANDONNE : RIEN N'EST ÉCRIT, ET LE NOM NE BOUGE PAS",
    apres === avant && intact === "À lancer",
    JSON.stringify({ avant, apres, intact }),
  );
  await q.close();
}

{
  //  ── UNE CARTE EN GRAND, ET SA DESCRIPTION ───────────────────────
  //
  //  « Dans chaque card, pouvoir l'afficher en grand et mettre une
  //  description. »
  const AVEC_MOT = RP.map((l) =>
    l.sujet_id === 996 ? { ...l, description: "Finir la descente avant la nuit." } : l
  );
  const { q, appels } = await monter({ lesRp: AVEC_MOT, lesCompagnons: COMPAGNONS });
  await q.click('[data-wm-carnet-onglet="mes-rp"]');
  await q.waitForTimeout(400);

  const ferme = await q.evaluate(() =>
    document.querySelector("[data-wm-rp-grand]")?.open === false
  );
  dire(
    "LE DIALOGUE EST FERMÉ TANT QU'ON NE L'OUVRE PAS",
    ferme === true,
    JSON.stringify({ ferme }),
  );

  await q.click('[data-wm-rp-ouvrir="996"]');
  await q.waitForTimeout(250);
  const ouvert = await q.evaluate(() => {
    const d = document.querySelector("[data-wm-rp-grand]");
    if (d === null) return null;
    return {
      ouvert: d.open,
      titre: d.querySelector("[data-wm-rp-grand-titre]")?.textContent ?? "",
      mene: d.querySelector("[data-wm-rp-grand-titre]")?.getAttribute("href") ?? "",
      tag: d.querySelector(".wm-rp__tag")?.textContent ?? "",
      ou: d.querySelector(".wm-rp__carte-ou")?.textContent ?? "",
      avec: d.querySelector("[data-wm-rp-grand-avec]")?.textContent ?? "",
      extrait: d.querySelector("[data-wm-rp-grand-extrait]")?.textContent ?? "",
      mot: d.querySelector("[data-wm-rp-grand-description]")?.value ?? "",
      //  LE DIALOGUE MODAL ENFERME LE FOCUS : c'est pour ça qu'on
      //  prend <dialog> et pas une couche à nous.
      focusDedans: d.contains(document.activeElement),
    };
  });
  dire(
    "IL S'OUVRE SUR LE BON RP, AVEC SON LIEU, SES COMPAGNONS ET SON EXTRAIT",
    ouvert !== null && ouvert.ouvert === true &&
      ouvert.titre === "La brume ne lève pas" && ouvert.mene === "/t996-#15582" &&
      ouvert.tag === "zone sauvage" && ouvert.ou === "Montagnes Embrumées" &&
      ouvert.avec === "avec Murphy" && ouvert.extrait === "Le vent se lève." &&
      ouvert.focusDedans === true,
    JSON.stringify(ouvert),
  );
  dire(
    "ET LA DESCRIPTION DÉJÀ ÉCRITE EST DANS LE CHAMP",
    ouvert?.mot === "Finir la descente avant la nuit.",
    JSON.stringify({ mot: ouvert?.mot }),
  );

  //  LE BOUTON DIT « ENREGISTRER » — « quand on ajoute la description :
  //  tu peux mettre "enregistrer" plutôt ? », 20 novembre. « Garder »
  //  dit qu'on ne jette pas ; « Enregistrer » dit qu'on écrit.
  const motDuBouton = await q.evaluate(() => ({
    bouton: document.querySelector("[data-wm-rp-grand-garder]")?.textContent?.trim() ?? "",
  }));
  dire(
    "LE BOUTON DE LA DESCRIPTION DIT « ENREGISTRER »",
    motDuBouton.bouton === "Enregistrer",
    JSON.stringify(motDuBouton),
  );

  await q.fill("[data-wm-rp-grand-description]", "On repart au matin.");
  await q.click("[data-wm-rp-grand-garder]");
  await q.waitForTimeout(300);
  const ditApres = await q.evaluate(() =>
    document.querySelector("[data-wm-rp-grand-dit]")?.textContent?.trim() ?? ""
  );
  dire(
    "ET IL LE CONFIRME DANS LE MÊME MOT",
    ditApres === "Enregistré.",
    JSON.stringify({ dit: ditApres }),
  );
  const garde = appels.filter((a) => a.ou === "PATCH-rp" && "description" in a.corps);
  dire(
    "ENREGISTRER N'ÉCRIT QUE LA DESCRIPTION, ET SUR LE BON SUJET",
    garde.length === 1 && garde[0].corps.description === "On repart au matin." &&
      Object.keys(garde[0].corps).length === 1 &&
      garde[0].ou_quoi.includes("sujet_id=eq.996"),
    JSON.stringify(garde),
  );

  //  ET ELLE RESTE APRÈS FERMETURE : la ligne en mémoire a été mise à
  //  jour, donc rouvrir ne doit pas rendre l'ancien texte.
  await q.keyboard.press("Escape");
  await q.waitForTimeout(200);
  await q.click('[data-wm-rp-ouvrir="996"]');
  await q.waitForTimeout(250);
  const rouvert = await q.evaluate(() =>
    document.querySelector("[data-wm-rp-grand-description]")?.value ?? ""
  );
  dire(
    "ET ROUVRIR REND CE QU'ON VIENT D'ÉCRIRE, pas ce qu'il y avait avant",
    rouvert === "On repart au matin.",
    JSON.stringify({ rouvert }),
  );
  await q.close();
}

// ── 7 ter · La barre latérale se replie, 20 novembre ────────────────

{
  //  « La barre latérale : on doit pouvoir la fermer. Ajoute aussi des
  //  icônes à côté de chaque onglet. Quand on ferme la barre latérale,
  //  on a que les icônes d'affichées. »
  const { q } = await monter();
  await q.waitForTimeout(300);

  const icones = await q.evaluate(() =>
    [...document.querySelectorAll("[data-wm-carnet-onglet]")].map((a) => ({
      clef: a.getAttribute("data-wm-carnet-onglet"),
      icone: a.querySelector("svg.wm-carnet__icone") !== null,
      mot: a.querySelector(".wm-carnet__onglet-mot")?.textContent?.trim() ?? "",
    }))
  );
  dire(
    "CHAQUE ONGLET PORTE UNE ICÔNE ET SON MOT",
    icones.length === 8 && icones.every((o) => o.icone && o.mot !== ""),
    JSON.stringify(icones),
  );

  //  L'ICÔNE NE RÉTRÉCIT PAS. Mesurée et pas déduite du CSS : une
  //  largeur de 60 px sur un enfant de flex sans `flex: 0 0 auto`
  //  l'écrase à deux pixels, et la barre repliée devient une colonne
  //  de traits. C'est la faute que cette mesure attrape.
  const dessine = await q.evaluate(() => {
    const i = document.querySelector("[data-wm-carnet-onglet] svg.wm-carnet__icone");
    const r = i?.getBoundingClientRect();
    return r === undefined ? null : { l: Math.round(r.width), h: Math.round(r.height) };
  });
  dire(
    "ET ELLE EST VRAIMENT DESSINÉE, pas écrasée à deux pixels",
    dessine !== null && dessine.l >= 14 && dessine.h >= 14,
    JSON.stringify(dessine),
  );

  const avant = await q.evaluate(() => ({
    large: Math.round(
      document.querySelector("[data-wm-carnet-barre]").getBoundingClientRect().width,
    ),
    ouverte: document.querySelector("[data-wm-carnet-replier]")
      ?.getAttribute("aria-expanded"),
    motVisible: document.querySelector(".wm-carnet__onglet-mot")?.offsetParent !== null,
  }));
  dire(
    "LA BARRE EST OUVERTE AU DÉPART — c'est l'état où l'on sait lire",
    avant.large > 200 && avant.ouverte === "true" && avant.motVisible === true,
    JSON.stringify(avant),
  );

  await q.click("[data-wm-carnet-replier]");
  await q.waitForTimeout(200);
  const apres = await q.evaluate(() => ({
    large: Math.round(
      document.querySelector("[data-wm-carnet-barre]").getBoundingClientRect().width,
    ),
    ouverte: document.querySelector("[data-wm-carnet-replier]")
      ?.getAttribute("aria-expanded"),
    motVisible: document.querySelector(".wm-carnet__onglet-mot")?.offsetParent !== null,
    //  LES ONGLETS RESTENT TOUS LÀ, ET CLIQUABLES : replier n'est pas
    //  cacher. Une barre vidée obligerait à la rouvrir pour changer
    //  d'onglet, un clic de plus à chaque fois.
    onglets: document.querySelectorAll("[data-wm-carnet-onglet]").length,
    icones: [...document.querySelectorAll("[data-wm-carnet-onglet] svg.wm-carnet__icone")]
      .filter((i) => i.getBoundingClientRect().width >= 14).length,
  }));
  dire(
    "REPLIÉE, IL NE RESTE QUE LES ICÔNES — ET ELLES Y SONT TOUTES LES HUIT",
    apres.large <= 80 && apres.ouverte === "false" && apres.motVisible === false &&
      apres.onglets === 8 && apres.icones === 8,
    JSON.stringify(apres),
  );

  //  ET ON PEUT ENCORE CHANGER D'ONGLET : c'est tout l'intérêt de
  //  replier au lieu de cacher.
  await q.click('[data-wm-carnet-onglet="mon-sac"]');
  await q.waitForTimeout(250);
  const navigue = await q.evaluate(() => ({
    page: [...document.querySelectorAll("[data-wm-carnet-page]")]
      .filter((p) => p.hidden === false)
      .map((p) => p.getAttribute("data-wm-carnet-page")),
    toujoursRepliee:
      document.querySelector("[data-wm-carnet-barre]")?.hasAttribute("data-wm-repliee") ===
        true,
  }));
  dire(
    "BARRE REPLIÉE, ON CHANGE QUAND MÊME D'ONGLET",
    navigue.page.length === 1 && navigue.page[0] === "mon-sac" &&
      navigue.toujoursRepliee === true,
    JSON.stringify(navigue),
  );

  await q.click("[data-wm-carnet-replier]");
  await q.waitForTimeout(200);
  const rouverte = await q.evaluate(() => ({
    large: Math.round(
      document.querySelector("[data-wm-carnet-barre]").getBoundingClientRect().width,
    ),
    garde: (() => {
      try {
        return globalThis.localStorage.getItem("wm-carnet-barre");
      } catch {
        return "inaccessible";
      }
    })(),
  }));
  dire(
    "UN SECOND APPUI LA ROUVRE, ET LE CHOIX EST GARDÉ EN LOCAL",
    rouverte.large > 200 && rouverte.garde === "ouverte",
    JSON.stringify(rouverte),
  );
  await q.close();
}

// ── 7 quater · Les SMS et le récap de butin, 20 novembre ────────────

{
  //  ── LES CONVERSATIONS DU MESSENGER QUITTENT LE TABLEAU ──────────
  //
  //  « Il faudrait aussi un endroit qui récapitule toutes les
  //  conversations sms de son personnage » · « les sms = le messenger.
  //  ça fonctionnera un peu comme les rps du coup. »
  const AVEC_SMS = [
    ...RP,
    {
      sujet_id: 400,
      titre: "Tu es où ?",
      //  1, C'EST LE MESSENGER — `data/forums.json`, famille « sms ».
      forum_id: 1,
      forum_nom: "Messenger",
      reponses: 12,
      dernier_le: "2026-11-19T21:10:00Z",
      dernier_auteur: "Murphy",
      dernier_message: 15700,
      extrait: "J'arrive.",
      etat: "en-cours",
      ordre: 0,
    },
  ];
  //  ET UN COMPAGNON SUR LA CONVERSATION : sans lui, la ligne dit
  //  « 12 messages » tout court, et la mesure du « avec qui » ne
  //  mesurait que mon oubli de décor.
  const { q } = await monter({
    lesRp: AVEC_SMS,
    lesCompagnons: [...COMPAGNONS, { sujet_id: 400, pseudo: "Murphy" }],
  });
  await q.click('[data-wm-carnet-onglet="mes-rp"]');
  await q.waitForTimeout(400);

  const tableau = await q.evaluate(() => ({
    cartes: [...document.querySelectorAll("[data-wm-rp-carte]")]
      .map((c) => Number(c.getAttribute("data-wm-rp-carte"))),
    compte: document.querySelector("[data-wm-rp-compte]")?.textContent?.trim() ?? "",
    smsCompte: document.querySelector("[data-wm-rp-sms-compte]")?.textContent?.trim() ?? "",
  }));
  dire(
    "LA CONVERSATION N'EST PAS UNE CARTE DU TABLEAU",
    !tableau.cartes.includes(400) && tableau.cartes.length === 3,
    JSON.stringify(tableau),
  );
  dire(
    "ET CHAQUE BLOC COMPTE LE SIEN : les RP d'un côté, les SMS de l'autre",
    //  Le compte des RP ne parle plus des conversations : les annoncer
    //  deux fois ferait chercher où est la différence.
    tableau.compte.includes("3 RP") && !tableau.compte.includes("conversation") &&
      tableau.smsCompte === "Une conversation au Messenger.",
    JSON.stringify({ compte: tableau.compte, smsCompte: tableau.smsCompte }),
  );

  //  ── LES SMS NE SONT PAS UNE VUE, ET ILS SONT LÀ DANS LES DEUX ───
  //
  //  « Tableau et liste c'est un style d'affichage des rps. Alors que
  //  les sms ça pourrait faire partie des deux onglets. » Mon premier
  //  jet en avait fait un troisième bouton : choisir SMS faisait
  //  disparaître les RP, alors que ce sont deux choses qu'on regarde
  //  ensemble.
  const pasUneVue = await q.evaluate(() => ({
    boutons: [...document.querySelectorAll("[data-wm-rp-vue]")]
      .map((b) => b.getAttribute("data-wm-rp-vue")),
    blocVisible: document.querySelector("[data-wm-rp-sms-bloc]")?.hidden === false,
    tableauVisible: document.querySelector("[data-wm-rp-tableau]")?.hidden === false,
  }));
  dire(
    "DEUX VUES SEULEMENT, ET LE BLOC DES SMS EST LÀ EN MÊME TEMPS QUE LE TABLEAU",
    pasUneVue.boutons.length === 2 && pasUneVue.boutons.join(",") === "tableau,liste" &&
      pasUneVue.blocVisible && pasUneVue.tableauVisible,
    JSON.stringify(pasUneVue),
  );

  //  ── ET LES CHOIX SONT SOUS LE TITRE ─────────────────────────────
  //
  //  « Tu peux mettre les options tableau et liste en dessous de
  //  "RPs". » Mesuré en pixels : un titre et des boutons sur la même
  //  ligne ont le même haut, l'un en dessous de l'autre non.
  const sousLeTitre = await q.evaluate(() => {
    const titre = document.querySelector(
      '[data-wm-carnet-page="mes-rp"] .wm-carnet__bloc-titre',
    );
    const vues = document.querySelector('[data-wm-rp-vue="tableau"]');
    if (titre === null || vues === null) return null;
    const t = titre.getBoundingClientRect();
    const v = vues.getBoundingClientRect();
    return { basDuTitre: Math.round(t.bottom), hautDesVues: Math.round(v.top) };
  });
  dire(
    "LES OPTIONS TABLEAU ET LISTE SONT SOUS LE TITRE, pas à côté",
    sousLeTitre !== null && sousLeTitre.hautDesVues >= sousLeTitre.basDuTitre - 2,
    JSON.stringify(sousLeTitre),
  );

  await q.click('[data-wm-rp-vue="liste"]');
  await q.waitForTimeout(250);
  const enListe = await q.evaluate(() => ({
    //  ET IL Y RESTE : c'est tout le sens de « ça fait partie des deux
    //  onglets ».
    blocVisible: document.querySelector("[data-wm-rp-sms-bloc]")?.hidden === false,
    listeVisible: document.querySelector("[data-wm-rp-liste]")?.hidden === false,
    //  LA CONVERSATION N'EST PAS DANS LA LISTE DES RP non plus.
    lignes: document.querySelectorAll("[data-wm-rp-liste] [data-wm-rp-sujet]").length,
  }));
  dire(
    "EN VUE LISTE AUSSI, LE BLOC DES SMS EST LÀ — ET LA CONVERSATION N'EST PAS DANS LA LISTE",
    enListe.blocVisible && enListe.listeVisible && enListe.lignes === 3,
    JSON.stringify(enListe),
  );

  //  ── ET ELLES S'AFFICHENT AUTREMENT ──────────────────────────────
  //
  //  « Mais faudrait les afficher autrement. » Des vignettes, pas des
  //  lignes et pas des colonnes : le nom de la personne en premier,
  //  parce qu'un fil s'appelle « Tu es où ? » et que ça ne dit pas à
  //  qui on parle.
  const vignette = await q.evaluate(() => {
    const li = document.querySelector("[data-wm-rp-sms-fil]");
    if (li === null) return null;
    return {
      qui: li.querySelector(".wm-rp__sms-qui")?.textContent ?? "",
      titre: li.querySelector(".wm-rp__sms-titre")?.textContent ?? "",
      mene: li.querySelector(".wm-rp__sms-titre")?.getAttribute("href") ?? "",
      pied: li.querySelector(".wm-rp__sms-pied")?.textContent ?? "",
      etat: li.querySelector(".wm-rp__etat")?.textContent ?? "",
      //  PAS DE MENU D'ÉTAT : on ne met pas un SMS « en pause ».
      menus: li.querySelectorAll("select").length,
      //  ET CE N'EST PAS UNE LIGNE DE LISTE : la forme diffère, et
      //  c'est ce qu'elle a demandé.
      commeUneLigne: li.classList.contains("wm-rp__ligne"),
    };
  });
  dire(
    "LA VIGNETTE MET LA PERSONNE EN PREMIER, et son titre mène au dernier message",
    vignette !== null && vignette.qui === "Murphy" && vignette.titre === "Tu es où ?" &&
      vignette.mene === "/t400-#15700",
    JSON.stringify(vignette),
  );
  dire(
    "ELLE DIT COMBIEN DE MESSAGES ET À QUI D'ÉCRIRE, SANS MENU D'ÉTAT NI FORME DE LISTE",
    //  LE MOT EST CELUI DE `MOTS` — « à moi d'écrire » : c'est le
    //  carnet qui parle à la première personne, et les vignettes ne
    //  doivent pas en inventer un second.
    (vignette?.pied ?? "").includes("12 messages") &&
      vignette?.etat === "à moi d'écrire" && vignette?.menus === 0 &&
      vignette?.commeUneLigne === false,
    JSON.stringify(vignette),
  );
  await q.close();
}

{
  //  ── SANS CONVERSATION, PAS DE BLOC ──────────────────────────────
  //
  //  Un encadré qui dit « rien » prend la place d'un encadré qui dirait
  //  quelque chose, et sur une page qui a déjà un tableau il se lit
  //  comme une panne. C'est le tuto qui dit où elles arriveront.
  const { q } = await monter({ lesRp: RP, lesCompagnons: COMPAGNONS });
  await q.click('[data-wm-carnet-onglet="mes-rp"]');
  await q.waitForTimeout(400);
  const sansSms = await q.evaluate(() => ({
    bloc: document.querySelector("[data-wm-rp-sms-bloc]")?.hidden,
    vignettes: document.querySelectorAll("[data-wm-rp-sms-fil]").length,
    //  ET LE TABLEAU, LUI, EST BIEN LÀ : pas de bloc SMS ne veut pas
    //  dire pas de page.
    cartes: document.querySelectorAll("[data-wm-rp-carte]").length,
  }));
  dire(
    "SANS CONVERSATION, LE BLOC DES SMS NE S'AFFICHE PAS DU TOUT",
    sansSms.bloc === true && sansSms.vignettes === 0 && sansSms.cartes === 3,
    JSON.stringify(sansSms),
  );
  await q.close();
}

{
  //  ── LE RÉCAP DE BUTIN, EN ZONE SAUVAGE ──────────────────────────
  //
  //  « Ce serait cool aussi d'avoir un récap pour les rps des zones
  //  sauvages de ce qu'on va récupérer si on clôture le sujet (rp solo
  //  et à plusieurs). »
  //
  //  LE REGISTRE DU DÉCOR PORTE DEUX JOUEURS, et l'ordre compte : la
  //  Poké Ball est TROUVÉE au message 15580 puis UTILISÉE au 15581.
  //  Un cumul qui ne rejouerait pas l'ordre la compterait deux fois en
  //  gain, ou refuserait la capture faute de ball.
  const MOI = "eeee0000-0000-0000-0000-000000000001";
  const AUTRE = "eeee0000-0000-0000-0000-000000000099";
  const REGISTRE = [
    { joueur_id: MOI, message_id: 15579, type: "croise", charge: { especeId: 25 } },
    {
      joueur_id: MOI,
      message_id: 15580,
      type: "objet_trouve",
      charge: { objetId: 4, quantite: 2 },
    },
    {
      joueur_id: MOI,
      message_id: 15581,
      type: "objet_utilise",
      charge: { objetId: 4, quantite: 1 },
    },
    {
      joueur_id: MOI,
      message_id: 15582,
      type: "capture",
      charge: { especeId: 25, niveau: 7 },
    },
    { joueur_id: MOI, message_id: 15583, type: "xp", charge: { pokemonId: "p2", gain: 48 } },
    { joueur_id: MOI, message_id: 15584, type: "pokedollars", charge: { montant: 350 } },
    //  LE BUTIN DE QUELQU'UN D'AUTRE, dans le même sujet. Il ne doit
    //  PAS entrer dans le récap : « rp solo et à plusieurs » veut dire
    //  ce que TU toucherais, pas ce que la table ramasse.
    {
      joueur_id: AUTRE,
      message_id: 15585,
      type: "pokedollars",
      charge: { montant: 9999 },
    },
    {
      joueur_id: AUTRE,
      message_id: 15586,
      type: "capture",
      charge: { especeId: 95, niveau: 30 },
    },
  ];
  const { q, appels } = await monter({
    lesRp: RP,
    lesCompagnons: COMPAGNONS,
    leRegistre: REGISTRE,
    lesObjets: [{ id: 4, nom: "Poké Ball" }],
  });
  await q.click('[data-wm-carnet-onglet="mes-rp"]');
  await q.waitForTimeout(400);
  await q.click('[data-wm-rp-ouvrir="996"]');
  await q.waitForTimeout(600);

  const vu = await q.evaluate(() => {
    const bloc = document.querySelector("[data-wm-rp-grand-butin]");
    return {
      visible: bloc?.hidden === false,
      titre: bloc?.querySelector(".wm-histoire__etiquette")?.textContent?.trim() ?? "",
      lignes: [...(bloc?.querySelectorAll("[data-wm-rp-grand-butin-liste] li") ?? [])]
        .map((li) => [
          li.querySelector(".wm-rp__butin-etiquette")?.textContent ?? "",
          li.querySelector(".wm-rp__butin-valeur")?.textContent ?? "",
        ]),
    };
  });
  const dit = Object.fromEntries(vu.lignes);
  dire(
    "LE RÉCAP S'AFFICHE, ET IL DIT « SI » — rien n'est acquis avant la clôture",
    vu.visible && vu.titre === "Si tu clôtures ce sujet",
    JSON.stringify({ visible: vu.visible, titre: vu.titre }),
  );
  dire(
    "IL NOMME L'ESPÈCE ET L'OBJET, au lieu d'écrire leurs numéros",
    //  25, c'est Pikachu dans le VRAI `especes.json` — le décor sert le
    //  fichier du dépôt, donc ce nom-là n'est pas inventé ici.
    (dit["CAPTURÉ"] ?? "").includes("Pikachu niv. 7") &&
      (dit["AJOUTÉ AU SAC"] ?? "").includes("Poké Ball") &&
      (dit["CONSOMMÉ"] ?? "").includes("1 Poké Ball"),
    JSON.stringify(dit),
  );
  dire(
    "ET LE POKÉMON PORTE SON SURNOM, pas son UUID",
    //  `p2` est Pika dans CARNET. Le module posé dans le sujet écrit
    //  « ton Pokémon » faute de pouvoir lire `joueur` ; ici, on est
    //  chez soi.
    (dit["EXPÉRIENCE"] ?? "").includes("Pika"),
    JSON.stringify({ experience: dit["EXPÉRIENCE"] }),
  );
  dire(
    "LE BUTIN DE L'AUTRE JOUEUR N'Y EST PAS",
    //  +350 est le mien, 9999 celui de l'autre. Et une seule capture :
    //  la sienne, pas celle du voisin.
    (dit["POKÉDOLLARS"] ?? "") === "+350" &&
      !(dit["CAPTURÉ"] ?? "").includes("niv. 30"),
    JSON.stringify({ pokedollars: dit["POKÉDOLLARS"], capture: dit["CAPTURÉ"] }),
  );

  //  ── ET AILLEURS QU'EN ZONE, ON NE DEMANDE RIEN ──────────────────
  //
  //  977 est à Phenacit — une ville. Le registre n'y a rien à verser,
  //  donc la requête serait posée pour rien.
  const avant = appels.filter((a) => a.ou === "lire-registre").length;
  await q.keyboard.press("Escape");
  await q.waitForTimeout(200);
  await q.click('[data-wm-rp-ouvrir="977"]');
  await q.waitForTimeout(500);
  const apres = appels.filter((a) => a.ou === "lire-registre").length;
  const cache = await q.evaluate(() =>
    document.querySelector("[data-wm-rp-grand-butin]")?.hidden === true
  );
  dire(
    "UN RP EN VILLE NE DEMANDE PAS LE REGISTRE, ET N'AFFICHE PAS DE RÉCAP",
    avant === 1 && apres === 1 && cache === true,
    JSON.stringify({ avant, apres, cache }),
  );
  await q.close();
}

await nav.close();
console.log(soucis.length === 0 ? "\nTOUT PASSE." : `\n${soucis.length} DÉFAUT(S).`);

if (soucis.length > 0) Deno.exit(1);
