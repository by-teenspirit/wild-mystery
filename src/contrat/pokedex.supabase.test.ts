// ════════════════════════════════════════════════════════════════════
//  src/contrat/pokedex.supabase.test.ts
//
//  Le trajet complet du rangement du pokédex, contre une VRAIE base :
//
//      registre + cloture → SQL → table pokedex
//
//  ── POURQUOI CE FICHIER EXISTE ──────────────────────────────────────
//
//  Parce que `ranger_pokedex` a été écrite deux fois et cassée deux
//  fois, chacune à sa façon, et que la seconde version a été écrite en
//  regardant la première :
//
//    · `0002` lisait `charge->>'espece_id'` en serpent, alors que le
//      registre porte `especeId`. Elle ne rangeait donc RIEN ;
//    · `0004` a corrigé la clé, et perdu le `join cloture` **et**
//      `attrape_le`. Elle rangeait donc des sujets jamais clôturés, et
//      n'enregistrait **aucune capture**.
//
//  Relevé le 6 octobre contre un PostgreSQL 16. Aucun autre test du
//  dépôt ne pouvait le voir : le domaine ne connaît pas le pokédex, et
//  l'adaptateur appelle une fonction doublée qui rend le nombre qu'on
//  lui demande de rendre.
//
//  Comme les autres contrats, il ne tourne que si on le lui demande :
//      CONTRAT_CIBLE=postgres CONTRAT_PGURL=postgres://…
//  Sans ça il s'annonce ignoré, à voix haute.
// ════════════════════════════════════════════════════════════════════

import { assertEquals } from "@std/assert";
import { PokedexSupabase } from "../adaptateurs/supabase/releve.ts";
import { appelPsql } from "./appel-psql.ts";

const CIBLE = Deno.env.get("CONTRAT_CIBLE");
const PGURL = Deno.env.get("CONTRAT_PGURL");

const ANNA = "aaaa1111-0000-0000-0000-0000000000d1";
const COMPTE = 90601;
const PIKACHU = 25;
const EVOLI = 133;
/** Deux sujets : un qu'on clôture, un qu'on laisse ouvert. */
const CLOS = 8001;
const OUVERT = 8002;

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

/** Le décor : une joueuse, deux espèces, deux lignes de registre — un
 *  Pikachu croisé dans le sujet OUVERT, un Évoli capturé dans le sujet
 *  qu'on clôturera. Rien n'est clos au départ. */
async function decor(url: string): Promise<void> {
  await psql(
    url,
    `delete from pokedex where joueur_id = '${ANNA}';
     delete from registre where sujet_id in (${CLOS}, ${OUVERT});
     delete from cloture where sujet_id in (${CLOS}, ${OUVERT});
     delete from joueur where id = '${ANNA}' or forum_user_id = ${COMPTE};

     insert into espece (id, nom_fr, types, stade, pv_base) values
       (${PIKACHU}, 'Pikachu', array['electrik'], 2, 35),
       (${EVOLI}, 'Évoli', array['normal'], 1, 55)
       on conflict (id) do nothing;

     insert into joueur (id, forum_user_id, pseudo)
       values ('${ANNA}', ${COMPTE}, 'Anna du pokédex');

     insert into registre (sujet_id, joueur_id, message_id, type, charge, code) values
       (${OUVERT}, '${ANNA}', 80001, 'croise',
        '{"especeId":${PIKACHU}}'::jsonb, 'WM-O'),
       (${CLOS}, '${ANNA}', 80002, 'capture',
        '{"especeId":${EVOLI},"niveau":12}'::jsonb, 'WM-C');`,
  );
}

function clore(url: string): Promise<string> {
  return psql(
    url,
    `insert into cloture (sujet_id, clos_par, resultat, code, bilan, mentionne)
     values (${CLOS}, '${ANNA}', '[]'::jsonb, 'WM-C', 'bilan', 'Anna')
     on conflict (sujet_id) do nothing;`,
  );
}

/** Ce que le pokédex contient pour Anna : `<espèce>:<croisé>:<attrapé>`. */
async function pokedexDAnna(url: string): Promise<string[]> {
  const texte = await psql(
    url,
    `select espece_id || ':' ||
            (croise_le is not null) || ':' || (attrape_le is not null)
       from pokedex where joueur_id = '${ANNA}' order by espece_id`,
  );
  return texte === "" ? [] : texte.split("\n").map((l) => l.trim());
}

function essai(
  nom: string,
  corps: (ctx: { pokedex: PokedexSupabase; url: string }) => Promise<void>,
): void {
  if (CIBLE !== "postgres" || PGURL === undefined) {
    Deno.test({
      name: `pokédex réel · ${nom} — IGNORÉ faute de base`,
      ignore: true,
      fn: () => {},
    });
    return;
  }
  const url = PGURL;
  Deno.test(`pokédex réel · ${nom}`, async () => {
    await decor(url);
    await corps({ pokedex: new PokedexSupabase(appelPsql({ url })), url });
  });
}

// ── LES DEUX TESTS QUI PORTENT LE FICHIER ───────────────────────────

essai("UN SUJET OUVERT NE RANGE RIEN", async ({ pokedex, url }) => {
  //  Le défaut de `0004`. Un sujet ouvert peut encore être abandonné, et
  //  un sujet abandonné n'a rien versé. Y créditer une rencontre, c'est
  //  offrir un objectif de complétion.
  assertEquals(await pokedex.ranger(), 0);
  assertEquals(await pokedexDAnna(url), [], "rien ne doit entrer avant la clôture");
});

essai("UNE CAPTURE POSE `attrape_le`", async ({ pokedex, url }) => {
  //  L'autre défaut de `0004` : elle ne posait que `croise_le`, donc
  //  aucune capture n'était jamais enregistrée.
  await clore(url);
  assertEquals(await pokedex.ranger(), 1);
  assertEquals(await pokedexDAnna(url), [`${EVOLI}:true:true`]);
});

// ── l'idempotence, qui est ce qui rend le compte utile ──────────────

essai("un second passage rend ZÉRO", async ({ pokedex, url }) => {
  //  C'EST CE QUI FAIT DU COMPTE UNE MESURE. Avant `0012`, le
  //  `do update` réécrivait la même valeur et la comptait quand même :
  //  la fonction rendait toujours le nombre de paires du registre, un
  //  chiffre qui ne voulait rien dire.
  await clore(url);
  assertEquals(await pokedex.ranger(), 1);
  assertEquals(await pokedex.ranger(), 0);
  assertEquals(await pokedex.ranger(), 0);
  assertEquals(await pokedexDAnna(url), [`${EVOLI}:true:true`]);
});

essai("une ligne en retard est corrigée, et elle seule", async ({ pokedex, url }) => {
  await clore(url);
  await pokedex.ranger();
  //  On abîme la ligne comme une vieille clôture l'aurait laissée : date
  //  trop tardive, capture non marquée.
  await psql(
    url,
    `update pokedex set croise_le = now() + interval '1 day', attrape_le = null
      where joueur_id = '${ANNA}'`,
  );
  assertEquals(await pokedex.ranger(), 1);
  assertEquals(await pokedexDAnna(url), [`${EVOLI}:true:true`]);
  const enRetard = await psql(
    url,
    `select croise_le < now() from pokedex where joueur_id = '${ANNA}'`,
  );
  assertEquals(enRetard, "t", "la date doit avoir été ramenée à celle du registre");
});

essai("la date retenue est la PREMIÈRE rencontre", async ({ pokedex, url }) => {
  //  Un joueur qui recroise une espèce ne doit pas voir sa date reculer
  //  — ni avancer. C'est `min(cree_le)`, et un `least` au conflit.
  //
  //  ON ÉCRIT AVANT DE CLÔTURER, et pas par commodité : le déclencheur
  //  `registre_sujet_ouvert` REFUSE toute écriture au registre d'un
  //  sujet clos — « son registre est figé ». C'est la garde qui empêche
  //  de rejouer un sujet déjà versé, et elle a attrapé ce test avant moi.
  await psql(
    url,
    `insert into registre (sujet_id, joueur_id, message_id, type, charge, code)
     values (${CLOS}, '${ANNA}', 80003, 'croise',
             '{"especeId":${EVOLI}}'::jsonb, 'WM-C2');
     update registre set cree_le = now() - interval '10 days' where message_id = 80003;`,
  );
  await clore(url);
  await pokedex.ranger();
  const vieille = await psql(
    url,
    `select croise_le < now() - interval '9 days'
       from pokedex where joueur_id = '${ANNA}' and espece_id = ${EVOLI}`,
  );
  assertEquals(vieille, "t");
});

// ── le ménage, et ce qu'il laisse derrière ──────────────────────────

essai("un sujet abandonné ne laisse rien au pokédex", async ({ pokedex, url }) => {
  //  La conséquence du défaut de `0004`, et la plus vicieuse : le
  //  pokédex gardait une espèce dont plus rien ne disait d'où elle
  //  venait, puisque `oublier_sujet` avait effacé le registre.
  await psql(url, `select oublier_sujet(${OUVERT})`);
  assertEquals(await pokedex.ranger(), 0);
  assertEquals(await pokedexDAnna(url), []);
});

essai(
  "sans ligne à corriger : zéro, même avec d'autres joueurs en base",
  async ({ pokedex, url }) => {
    //  La fonction est GLOBALE : elle voit tout le registre, y compris les
    //  lignes posées par les autres suites de contrat. Zéro ici veut donc
    //  dire « tout le pokédex de la base est d'accord avec son registre »,
    //  et un échec serait un vrai signal — pas un test instable.
    //
    //  C'est aussi le premier passage de la relève sur une base neuve.
    await psql(url, `delete from registre where sujet_id in (${CLOS}, ${OUVERT})`);
    assertEquals(await pokedex.ranger(), 0);
  },
);

// ── LE TEST QUI AURAIT ATTRAPÉ LE DÉSACCORD DES DATES ───────────────

essai("après une clôture, il n'y a RIEN à ranger", async ({ pokedex, url }) => {
  //  Trouvé le 6 octobre en faisant tourner les deux suites ensemble.
  //  `appliquer_cloture` écrivait `croise_le = now()` — la date de la
  //  CLÔTURE — pendant que `ranger_pokedex` lisait `min(registre.cree_le)`
  //  — la date où le joueur a POSTÉ. Les deux ne disaient pas la même
  //  chose, donc chaque passage suivant une clôture annonçait des
  //  corrections, et le chiffre redevenait du bruit.
  //
  //  C'est exactement le genre de défaut qu'aucune des deux suites ne
  //  voit seule : il faut qu'une clôture RÉELLE ait écrit le pokédex,
  //  puis que le rangement le relise.
  await psql(
    url,
    `insert into registre (sujet_id, joueur_id, message_id, type, charge, code)
     values (${OUVERT}, '${ANNA}', 80010, 'capture',
             '{"especeId":${PIKACHU},"niveau":9}'::jsonb, 'WM-D');
     --  Daté d'il y a dix jours : si la clôture écrivait son propre
     --  horodatage, l'écart serait de dix jours et impossible à rater.
     update registre set cree_le = now() - interval '10 days'
      where message_id = 80010;`,
  );

  //  La clôture par le VRAI chemin : la fonction SQL que la relève
  //  appelle, avec les effets que le domaine produirait.
  await psql(
    url,
    `select appliquer_cloture(jsonb_build_object(
       'sujetId', ${OUVERT},
       'code', 'WM-D',
       'bilan', 'bilan de contrat',
       'mentionne', 'Anna',
       'versements', jsonb_build_array(jsonb_build_object(
         'joueurId', '${ANNA}',
         'effets', jsonb_build_object(
           'especesCroisees', '[]'::jsonb,
           'captures', jsonb_build_array(
             jsonb_build_object('especeId', ${PIKACHU}, 'niveau', 9)),
           'objetsConsommes', '[]'::jsonb,
           'objetsAjoutes', '[]'::jsonb,
           'xpParPokemon', '[]'::jsonb,
           'pokedollars', 0)))))`,
  );

  //  LA CLÔTURE A ÉCRIT LA DATE DU REGISTRE, pas la sienne.
  const vieille = await psql(
    url,
    `select croise_le < now() - interval '9 days'
       from pokedex where joueur_id = '${ANNA}' and espece_id = ${PIKACHU}`,
  );
  assertEquals(vieille, "t", "la clôture doit écrire la date du registre");

  //  ET DONC LE RANGEMENT N'A RIEN À FAIRE. C'est ce qui rend « zéro est
  //  la réponse attendue » vrai en production, et pas seulement en test.
  assertEquals(await pokedex.ranger(), 0);
});
