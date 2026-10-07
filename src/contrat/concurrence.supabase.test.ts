// ════════════════════════════════════════════════════════════════════
//  src/contrat/concurrence.supabase.test.ts
//
//  Deux appels en même temps sur le même message. Contre une VRAIE base,
//  avec **deux connexions**.
//
//  ── POURQUOI PAS EN pgTAP ───────────────────────────────────────────
//
//  pgTAP tourne dans UNE transaction, dans UNE session. La concurrence
//  ne s'y teste pas : c'est précisément deux sessions qui se croisent
//  qu'on veut voir. Les 133 assertions pgTAP du dépôt ne pouvaient pas
//  attraper ça, et ne le pourront jamais.
//
//  ── CE QUE CES TESTS PROTÈGENT ──────────────────────────────────────
//
//  **L'argent, d'abord.** Un débit, un seul, quoi qu'il arrive. C'est
//  l'invariant qui compte, et la contrainte `commande.message_id unique`
//  le tenait déjà avant `0015`.
//
//  **Et qu'une collision ne remonte pas en erreur.** Avant `0015`, le
//  second appel levait. Le verrou de la relève empêchait que ça arrive,
//  mais c'était le verrou qui tenait l'invariant, pas la fonction — un
//  appel à la main suffisait à le contourner. La relève aurait vu une
//  erreur sur un message pourtant servi, son curseur ne serait pas
//  avancé, et elle aurait réessayé en boucle.
//
//  ── COMMENT ON FORCE LE CROISEMENT ──────────────────────────────────
//
//  Deux `psql` lancés à 600 ms d'écart. Le premier garde sa transaction
//  ouverte deux secondes (`begin … pg_sleep(2) … commit`), le second
//  arrive dedans. Sans ça, deux appels successifs ne se croisent jamais
//  et le test passerait pour de mauvaises raisons.
//
//  Comme les autres contrats, il ne tourne que si on le lui demande :
//      CONTRAT_CIBLE=postgres CONTRAT_PGURL=postgres://…
//  Sans ça il s'annonce ignoré, à voix haute.
// ════════════════════════════════════════════════════════════════════

import { assert, assertEquals } from "@std/assert";

const CIBLE = Deno.env.get("CONTRAT_CIBLE");
const PGURL = Deno.env.get("CONTRAT_PGURL");

const ANNA = "cccc9999-0000-0000-0000-00000000c0cc";
const COMPTE = 99801;
const SUJET = 99810;
/** 300 ₽, en vente. */
const POTION = 9920;
/** Hors vente : ce qui fait refuser la commande. */
const FOSSILE = 9921;

type Sortie = { code: number; texte: string; erreur: string };

async function psql(url: string, sql: string): Promise<Sortie> {
  const { code, stdout, stderr } = await new Deno.Command("psql", {
    args: [url, "--no-psqlrc", "--quiet", "--no-align", "--tuples-only", "--command", sql],
    stdout: "piped",
    stderr: "piped",
  }).output();
  const d = new TextDecoder();
  return { code, texte: d.decode(stdout).trim(), erreur: d.decode(stderr).trim() };
}

/** Un `psql` qui doit réussir. */
async function sql(url: string, requete: string): Promise<string> {
  const r = await psql(url, requete);
  if (r.code !== 0) throw new Error(r.erreur);
  return r.texte;
}

/**
 * Lance deux appels qui SE CROISENT, et rend ce que le second a répondu.
 *
 * Le premier tient sa transaction ouverte ; le second arrive pendant.
 * On rend aussi le code de sortie du second — c'est lui qui dit si la
 * fonction a levé.
 */
async function croiser(url: string, appel: string): Promise<Sortie> {
  const premier = psql(url, `begin; ${appel}; select pg_sleep(2); commit;`);
  await new Promise((r) => setTimeout(r, 600));
  const second = await psql(url, appel);
  await premier;
  return second;
}

/** Le décor : une joueuse riche, un article en vente, un hors vente. */
async function decor(url: string): Promise<void> {
  await sql(
    url,
    `delete from journal;
     delete from registre where sujet_id = ${SUJET};
     delete from commande where message_id between 99800 and 99899;
     delete from sac where joueur_id = '${ANNA}';
     delete from cloture where sujet_id = ${SUJET};
     delete from joueur where id = '${ANNA}' or forum_user_id = ${COMPTE};

     --  « on conflict (id) » ne couvrait PAS le slug, unique lui aussi :
     --  un essai antérieur au même slug sous un autre identifiant
     --  faisait échouer tout le décor. On efface donc les deux clés
     --  avant d'insérer, plutôt que d'espérer.
     --  (Et pas d'accent grave ici : on est dans un gabarit de chaîne.)
     delete from sac where objet_id in (${POTION}, ${FOSSILE});
     delete from objet where id in (${POTION}, ${FOSSILE}) or slug like '%-concurrence';
     insert into objet (id, slug, nom, famille, prix, en_vente)
       overriding system value values
       (${POTION}, 'potion-concurrence', 'Potion de concurrence', 'soin', 300, true),
       (${FOSSILE}, 'fossile-concurrence', 'Fossile de concurrence', 'fossile', null, false);

     insert into joueur (id, forum_user_id, pseudo, pokedollars)
       values ('${ANNA}', ${COMPTE}, 'Anna concurrente', 20000);`,
  );
}

/**
 * Efface tout ce que cette suite a écrit.
 *
 * **Appelé APRÈS chaque cas, et pas seulement avant.** Le décor d'entrée
 * ne suffit pas : la dernière clôture de cette suite restait en base, et
 * `ranger_pokedex` — qui travaille sur TOUS les sujets clos — la trouvait
 * depuis la suite du pokédex, qui tourne après. Elle y lisait 1 là où
 * elle attendait 0.
 *
 * C'est la leçon du 6 octobre, retrouvée par le même chemin : **les
 * suites de contrat se lancent ENSEMBLE**, et un fixture qui ne range pas
 * derrière lui casse une suite qu'il n'a jamais vue.
 *
 * L'ordre suit les clés étrangères : `cloture.clos_par` n'a pas de
 * cascade (c'est voulu), donc la clôture part avant le joueur.
 */
async function menage(url: string): Promise<void> {
  await sql(
    url,
    `delete from pokedex where joueur_id = '${ANNA}';
     delete from cloture where sujet_id = ${SUJET} or clos_par = '${ANNA}';
     delete from registre where sujet_id = ${SUJET} or joueur_id = '${ANNA}';
     delete from journal;
     delete from sac where joueur_id = '${ANNA}';
     delete from commande where joueur_id = '${ANNA}';
     delete from joueur where id = '${ANNA}' or forum_user_id = ${COMPTE};
     delete from objet where id in (${POTION}, ${FOSSILE});`,
  );
}

function panier(message: number, objet: number): string {
  return `select boutique_servir(jsonb_build_object(
    'messageId', ${message}, 'forumUserId', ${COMPTE}, 'code', 'WM-CC',
    'lignes', jsonb_build_array(
      jsonb_build_object('objetId', ${objet}, 'quantite', 2))))::text`;
}

function essai(nom: string, corps: (url: string) => Promise<void>): void {
  if (CIBLE !== "postgres" || PGURL === undefined) {
    Deno.test({
      name: `concurrence · ${nom} — IGNORÉ faute de base`,
      ignore: true,
      fn: () => {},
    });
    return;
  }
  const url = PGURL;
  Deno.test(`concurrence · ${nom}`, async () => {
    await decor(url);
    try {
      await corps(url);
    } finally {
      //  Dans un `finally` : un cas qui échoue doit ranger aussi, sinon
      //  le premier échec en entraîne cinq autres dans les suites
      //  suivantes et on cherche le défaut au mauvais endroit.
      await menage(url);
    }
  });
}

// ── la boutique, servie ─────────────────────────────────────────────

essai("deux commandes simultanées : UN SEUL DÉBIT", async (url) => {
  //  L'INVARIANT QUI COMPTE. Tout le reste est du confort à côté.
  await croiser(url, panier(99820, POTION));

  assertEquals(await sql(url, `select count(*) from commande where message_id = 99820`), "1");
  assertEquals(
    await sql(url, `select pokedollars from joueur where id = '${ANNA}'`),
    "19400",
    "20000 − 600 : débité une fois, pas deux",
  );
  assertEquals(
    await sql(url, `select coalesce(sum(quantite), 0) from sac where joueur_id = '${ANNA}'`),
    "2",
    "deux potions, pas quatre",
  );
  assertEquals(
    await sql(url, `select count(*) from journal`),
    "1",
    "une ligne de « La vie de Rhode », pas deux",
  );
});

essai("le second appel NE LÈVE PAS : il rend « déjà servie »", async (url) => {
  //  C'est la correction de `0015`. Avant elle, ce même croisement
  //  rendait `duplicate key value violates unique constraint
  //  "commande_message_id_key"` — l'argent restait juste, mais la relève
  //  voyait une erreur sur un message pourtant servi.
  const second = await croiser(url, panier(99821, POTION));

  assertEquals(second.code, 0, `psql a échoué : ${second.erreur}`);
  assert(second.texte.includes('"deja": true'), second.texte);
  assert(second.texte.includes('"etat": "servie"'), second.texte);
});

essai("et le verdict rendu est COMPLET, lignes comprises", async (url) => {
  //  Pas du confort : la relève reposte le reçu depuis ce verdict. Un
  //  verdict amputé donnerait un reçu sans aucune ligne, et le joueur ne
  //  saurait pas ce qu'il a acheté.
  const second = await croiser(url, panier(99822, POTION));

  assert(second.texte.includes('"objetId": 9920'), second.texte);
  assert(second.texte.includes('"quantite": 2'), second.texte);
  assert(second.texte.includes('"sousTotal": 600'), second.texte);
  assert(second.texte.includes('"total": 600'), second.texte);
});

// ── la boutique, refusée ────────────────────────────────────────────

essai("deux refus simultanés ne lèvent pas non plus", async (url) => {
  //  Un refus qui lève est pire qu'un refus : le joueur n'apprend jamais
  //  pourquoi sa commande n'est pas passée.
  const second = await croiser(url, panier(99823, FOSSILE));

  assertEquals(second.code, 0, `psql a échoué : ${second.erreur}`);
  assert(second.texte.includes('"etat": "refusee"'), second.texte);
  assert(second.texte.includes('"deja": true'), second.texte);
  //  Le motif du refus survit au croisement : c'est lui que le joueur
  //  lira dans le message du Maître du Jeu.
  assert(second.texte.includes("HORS_VENTE"), second.texte);
  assertEquals(await sql(url, `select count(*) from commande where message_id = 99823`), "1");
  assertEquals(
    await sql(url, `select pokedollars from joueur where id = '${ANNA}'`),
    "20000",
    "un refus ne débite rien, même croisé",
  );
});

// ── le registre ─────────────────────────────────────────────────────

essai("deux inscriptions simultanées de la même ligne : une seule entre", async (url) => {
  //  `registre_inscrire` porte `on conflict … do nothing` depuis `0003`.
  //  Ce test dit que ça tient AUSSI quand les deux arrivent ensemble —
  //  ce que les tests d'une seule session ne peuvent pas montrer.
  const inscrire = `select registre_inscrire(jsonb_build_object(
      'sujetId', ${SUJET}, 'joueurId', '${ANNA}', 'messageId', 99830,
      'type', 'croise', 'charge', jsonb_build_object('especeId', 25),
      'code', 'WM-CC-REG'))::text`;
  const second = await croiser(url, inscrire);

  assertEquals(second.code, 0, `psql a échoué : ${second.erreur}`);
  assertEquals(
    second.texte,
    "0",
    "la seconde inscription rend 0 : rien n'est entré, et rien n'a levé",
  );
  assertEquals(
    await sql(url, `select count(*) from registre where message_id = 99830`),
    "1",
  );
});

// ── ce qui DOIT continuer de lever ──────────────────────────────────

essai("une clôture concurrente lève, et c'est voulu", async (url) => {
  //  `appliquer_cloture` refuse un sujet déjà clos — un sujet ne se clôt
  //  qu'une fois, et l'appelant doit s'arrêter. Sous concurrence, la
  //  seconde transaction heurte la clé primaire de `cloture` et lève
  //  aussi : **même résultat que le refus voulu**, donc rien à corriger.
  //
  //  Ce test est là pour que personne n'« harmonise » un jour les trois
  //  fonctions en faisant taire celle-là.
  await sql(
    url,
    `insert into registre (sujet_id, joueur_id, message_id, type, charge, code)
     values (${SUJET}, '${ANNA}', 99840, 'croise',
             jsonb_build_object('especeId', 25), 'WM-CC-CL')
     on conflict do nothing`,
  );
  const clore = `select appliquer_cloture(jsonb_build_object(
      'sujetId', ${SUJET}, 'code', 'WM-CC-CLOS',
      'versements', jsonb_build_array(jsonb_build_object(
        'joueurId', '${ANNA}', 'effets', jsonb_build_object()))))::text`;
  const second = await croiser(url, clore);

  assert(second.code !== 0, "la seconde clôture doit échouer");
  assertEquals(
    await sql(url, `select count(*) from cloture where sujet_id = ${SUJET}`),
    "1",
    "et le sujet n'est clos qu'une fois",
  );
});
