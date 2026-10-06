// ════════════════════════════════════════════════════════════════════
//  src/contrat/journal.supabase.test.ts
//
//  « La vie de Rhode » — l'encart public de l'index, contre une VRAIE
//  base.
//
//  ── CE QUE CE FICHIER PROTÈGE ───────────────────────────────────────
//
//  Deux choses, et elles ne se ressemblent pas.
//
//  **Que la ligne soit écrite.** `boutique_servir` journalise dans la
//  MÊME transaction que le débit (migration `0014`), donc il n'existe
//  aucun état « débité mais pas annoncé ». C'est la leçon du 2 octobre
//  — appliquer et publier ne sont pas atomiques — appliquée là où elle
//  peut l'être gratuitement, puisque les deux écritures sont en base.
//
//  **Que la ligne n'en dise pas trop.** Le journal est PUBLIC : `anon`
//  le lit. Une ligne d'achat porte donc le nombre d'objets, et ni la
//  liste ni le prix. Le détail est l'affaire du joueur et de son reçu.
//  Un test qui vérifie une absence est le seul moyen qu'une exposition
//  ne se glisse pas plus tard « pour faire plus joli sur l'index ».
//
//  Comme les autres contrats, il ne tourne que si on le lui demande :
//      CONTRAT_CIBLE=postgres CONTRAT_PGURL=postgres://…
//  Sans ça il s'annonce ignoré, à voix haute.
// ════════════════════════════════════════════════════════════════════

import { assert, assertEquals } from "@std/assert";

const CIBLE = Deno.env.get("CONTRAT_CIBLE");
const PGURL = Deno.env.get("CONTRAT_PGURL");

const ANNA = "eeee1111-0000-0000-0000-00000000a001";
const COMPTE = 97601;
/** 300 ₽, en vente. */
const POTION = 9710;
/** Hors vente — ce qui fait refuser la commande. */
const FOSSILE = 9711;

function psql(url: string, sql: string): Promise<string> {
  return new Deno.Command("psql", {
    args: [
      url,
      "--no-psqlrc",
      "--quiet",
      "--no-align",
      "--tuples-only",
      "--set=ON_ERROR_STOP=1",
      "--command",
      sql,
    ],
    stdout: "piped",
    stderr: "piped",
  }).output().then(({ code, stdout, stderr }) => {
    if (code !== 0) throw new Error(new TextDecoder().decode(stderr).trim());
    return new TextDecoder().decode(stdout).trim();
  });
}

/** Le décor : une joueuse riche, un article en vente, un hors vente, et
 *  un journal vide. */
async function decor(url: string): Promise<void> {
  await psql(
    url,
    `delete from journal;
     delete from commande where message_id between 97600 and 97699;
     delete from sac where joueur_id = '${ANNA}';
     delete from joueur where id = '${ANNA}' or forum_user_id = ${COMPTE};

     insert into objet (id, slug, nom, famille, prix, en_vente)
       overriding system value values
       (${POTION}, 'potion-du-journal', 'Potion du journal', 'soin', 300, true),
       (${FOSSILE}, 'fossile-du-journal', 'Fossile du journal', 'fossile', null, false)
       on conflict (id) do nothing;

     insert into joueur (id, forum_user_id, pseudo, pokedollars)
       values ('${ANNA}', ${COMPTE}, 'Anna du journal', 20000);`,
  );
}

function servir(
  url: string,
  messageId: number,
  objetId: number,
  quantite: number,
): Promise<string> {
  return psql(
    url,
    `select boutique_servir(jsonb_build_object(
       'messageId', ${messageId}, 'forumUserId', ${COMPTE}, 'code', 'WM-J',
       'lignes', jsonb_build_array(
         jsonb_build_object('objetId', ${objetId}, 'quantite', ${quantite}))))::text`,
  );
}

function essai(nom: string, corps: (url: string) => Promise<void>): void {
  if (CIBLE !== "postgres" || PGURL === undefined) {
    Deno.test({
      name: `vie de Rhode · ${nom} — IGNORÉ faute de base`,
      ignore: true,
      fn: () => {},
    });
    return;
  }
  const url = PGURL;
  Deno.test(`vie de Rhode · ${nom}`, async () => {
    await decor(url);
    await corps(url);
  });
}

// ── la ligne est écrite avec le débit ───────────────────────────────

essai("une commande servie écrit sa ligne, dans la même transaction", async (url) => {
  const verdict = await servir(url, 97601, POTION, 3);
  assert(verdict.includes('"etat": "servie"'), verdict);

  const ligne = await psql(
    url,
    `select type || ' | ' || pseudo || ' | ' || detail::text || ' | ' ||
            (arrive_le is not null) from journal`,
  );
  assertEquals(ligne, 'achat | Anna du journal | {"articles": 3} | true');
});

essai("le pseudo est RECOPIÉ, pas joint", async (url) => {
  //  `joueur` n'est lisible que par son propriétaire : l'encart public
  //  ne peut pas faire la jointure. Le pseudo est donc dans la ligne.
  //
  //  Conséquence assumée, et vérifiée ici : un changement de pseudo ne
  //  réécrit pas le passé. Un journal est une archive — il dit ce qui
  //  s'est passé, avec le nom qu'on portait alors.
  await servir(url, 97602, POTION, 1);
  await psql(url, `update joueur set pseudo = 'Anna renommée' where id = '${ANNA}'`);
  assertEquals(await psql(url, `select pseudo from journal`), "Anna du journal");
});

essai("une commande REFUSÉE n'écrit rien", async (url) => {
  //  Un refus ne fait pas vivre la région, et l'annoncer publiquement
  //  exposerait qu'un joueur a manqué d'argent.
  const verdict = await servir(url, 97603, FOSSILE, 1);
  assert(verdict.includes('"etat": "refusee"'), verdict);
  assertEquals(await psql(url, `select count(*) from journal`), "0");
});

essai("le chemin « déjà servie » ne rejournalise pas", async (url) => {
  //  La relève repasse sur le même message quand un reçu n'est pas
  //  parti. Deux lignes pour un seul achat feraient mentir l'index.
  await servir(url, 97604, POTION, 2);
  const second = await servir(url, 97604, POTION, 2);
  assert(second.includes('"deja": true'), second);
  assertEquals(await psql(url, `select count(*) from journal`), "1");
});

// ── CE QUE LA LIGNE NE DIT PAS ──────────────────────────────────────

essai("une ligne d'achat ne porte NI prix NI liste d'objets", async (url) => {
  //  LE TEST QUI VÉRIFIE UNE ABSENCE. Le journal est public ; étaler le
  //  contenu d'un sac et le prix payé sur la page d'accueil n'apporte
  //  rien au décor et expose le joueur. Si quelqu'un ajoute un champ
  //  « pour faire plus joli », ce test le dira.
  await servir(url, 97605, POTION, 3);
  const detail = await psql(url, `select detail::text from journal where type = 'achat'`);
  assertEquals(detail, '{"articles": 3}');

  const clefs = await psql(
    url,
    `select coalesce(string_agg(k, ',' order by k), '')
       from journal, jsonb_object_keys(detail) k where type = 'achat'`,
  );
  assertEquals(clefs, "articles", "une seule clé, et c'est un compte");
});

// ── la lecture de l'encart ──────────────────────────────────────────

essai("`journal_dernieres` rend huit lignes, les plus récentes d'abord", async (url) => {
  await psql(
    url,
    `insert into journal (type, pseudo, detail)
     select 'capture', 'Témoin ' || i, jsonb_build_object('rang', i)
       from generate_series(1, 25) i`,
  );

  const tailles = await psql(
    url,
    `select jsonb_array_length(journal_dernieres()) || ' ' ||
            jsonb_array_length(journal_dernieres('{"combien":3}'::jsonb)) || ' ' ||
            jsonb_array_length(journal_dernieres('{"combien":500}'::jsonb)) || ' ' ||
            jsonb_array_length(journal_dernieres('{"combien":0}'::jsonb))`,
  );
  //  Huit par défaut comme la planche 18 le demande · trois sur demande ·
  //  **vingt au plafond** même si on en demande cinq cents · une au
  //  plancher même si on en demande zéro.
  assertEquals(tailles, "8 3 20 1");

  //  La plus récente en tête : c'est ce que l'encart affiche en haut.
  assertEquals(
    await psql(url, `select journal_dernieres('{"combien":1}'::jsonb) -> 0 ->> 'pseudo'`),
    "Témoin 25",
  );
});

// ── les droits ──────────────────────────────────────────────────────

essai("`anon` lit l'encart et ne peut rien y écrire", async (url) => {
  await servir(url, 97606, POTION, 1);

  //  LIRE : c'est tout l'objet d'un encart public sur l'index.
  assertEquals(
    await psql(url, `set role anon; select count(*) from journal`),
    "1",
  );
  assertEquals(
    await psql(
      url,
      `set role anon; select jsonb_array_length(journal_dernieres())`,
    ),
    "1",
  );

  //  ÉCRIRE : non. Ni par la table, ni par la fonction.
  for (
    const tentative of [
      `insert into journal (type, pseudo) values ('achat', 'Intrus')`,
      `select journal_ecrire('{"type":"achat","pseudo":"Intrus"}'::jsonb)`,
    ]
  ) {
    let refuse = false;
    try {
      await psql(url, `set role anon; ${tentative}`);
    } catch (e) {
      refuse = /permission denied/i.test((e as Error).message);
    }
    assert(refuse, `anon ne doit pas pouvoir : ${tentative}`);
  }
});

// ── `journal_ecrire` ne doit JAMAIS faire échouer son appelant ───────

essai("`journal_ecrire` rend null au lieu de lever", async (url) => {
  //  C'est le seul endroit du dépôt où une erreur est avalée, et c'est
  //  assumé : une commande servie ne peut pas échouer à cause d'une
  //  ligne de décor. Si elle levait, un type d'événement mal écrit
  //  annulerait un débit.
  const r = await psql(
    url,
    `select coalesce(journal_ecrire('{}'::jsonb)::text, 'null') || ' ' ||
            coalesce(journal_ecrire('{"type":"achat"}'::jsonb)::text, 'null') || ' ' ||
            coalesce(journal_ecrire('{"pseudo":"Anna"}'::jsonb)::text, 'null') || ' ' ||
            coalesce(journal_ecrire('{"type":"pas-un-type","pseudo":"Anna"}'::jsonb)::text,
                     'null')`,
  );
  assertEquals(r, "null null null null");

  //  Et rien de tout ça n'a laissé de ligne.
  assertEquals(await psql(url, `select count(*) from journal`), "0");

  //  Une ligne valide, elle, passe.
  assert(
    Number(
      await psql(url, `select journal_ecrire('{"type":"badge","pseudo":"Anna"}'::jsonb)`),
    ) >
      0,
  );
});
