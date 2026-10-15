// ════════════════════════════════════════════════════════════════════
//  src/contrat/carnet.supabase.test.ts
//
//  La clé du carnet et l'appel unique de chargement (`0019`), éprouvés
//  contre un vrai PostgreSQL.
//
//  ── POURQUOI CE FICHIER COMPTE PLUS QUE LES AUTRES ──────────────────
//
//  `carnet()` est la SEULE fonction du dépôt appelable par `anon`.
//  Toutes les autres sont réservées à `service_role` et la planche 56
//  (« fermer la surface ») en a fait une règle. Celle-ci est l'exception
//  assumée, parce que le navigateur d'un joueur n'a que la clé publiable
//  et aucune session : ce qui protège, c'est le secret passé en
//  argument.
//
//  Une exception à une règle de fermeture doit être éprouvée plus que
//  la règle. D'où les quatre cas qui ne testent pas une
//  fonctionnalité mais une PROPRIÉTÉ :
//
//    · la clé ne sort jamais dans une réponse ;
//    · les trois mauvais usages donnent le MÊME refus — sinon la
//      fonction devient un oracle qui dit si une clé existe ;
//    · `anon` ne peut appeler qu'elle, pas les deux autres ;
//    · renouveler une clé invalide l'ancienne — sans quoi une clé
//      fuitée le reste pour toujours.
//
//  ── ET DEUX CAS QUI VÉRIFIENT UNE DÉCISION, PAS DU CODE ─────────────
//
//  Un pokémon en pension garde sa place dans l'équipe, et une case de
//  boîte ne se partage pas. Les deux viennent des notes de code de la
//  maquette (387:1075), et les deux auraient pu être écrites autrement
//  sans que rien ne crie.
//
//  Comme les autres contrats, il ne tourne que si on le lui demande :
//      CONTRAT_CIBLE=postgres CONTRAT_PGURL=postgres://…
//  Sans ça il s'annonce ignoré, à voix haute.
// ════════════════════════════════════════════════════════════════════

import { assert, assertEquals, assertMatch } from "@std/assert";

const CIBLE = Deno.env.get("CONTRAT_CIBLE");
const PGURL = Deno.env.get("CONTRAT_PGURL");

const CALLIE = "eeee1111-0000-0000-0000-0000000000c1";
const COMPTE_CALLIE = 95301;
/** Pikachu, parce qu'il faut une espèce et que celle-là se reconnaît. */
const PIKACHU = 25;
const EN_PENSION = "eeee2222-0000-0000-0000-000000000001";

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

/** Le décor : une joueuse, une espèce, et rien d'autre. Chaque cas pose
 *  ce dont il a besoin — un décor qui porte déjà un pokémon en pension
 *  rendrait le cas de la pension vrai sans qu'il l'ait fait. */
async function decor(url: string): Promise<void> {
  await psql(
    url,
    `delete from pension where joueur_id = '${CALLIE}';
     delete from registre where joueur_id = '${CALLIE}';
     delete from pokedex where joueur_id = '${CALLIE}';
     delete from pokemon where joueur_id = '${CALLIE}';
     delete from sac where joueur_id = '${CALLIE}';
     delete from badge where joueur_id = '${CALLIE}';
     delete from cloture where clos_par = '${CALLIE}';
     delete from joueur where id = '${CALLIE}' or forum_user_id = ${COMPTE_CALLIE};

     insert into espece (id, nom_fr, types, stade, pv_base)
       values (${PIKACHU}, 'Pikachu', array['electrik'], 2, 35)
       on conflict (id) do nothing;

     --  registre.zone_id a une cle etrangere vers zone, et aucune
     --  migration ne pose de zone : elles viennent d'un seed. Le releve
     --  a coute un passage de ce fichier.
     insert into zone (id, nom, palier, niveau_min, niveau_max, ordre)
       values (9, 'Zone de contrat', 1, 1, 20, 99)
       on conflict (id) do nothing;

     --  objet.id est GENERE : on ne le choisit pas. D'ou le slug comme
     --  cle de reprise, et la lecture de l'id par sous-requete.
     insert into objet (slug, nom, famille, prix, en_vente)
       values ('objet-de-contrat', 'Objet de contrat', 'soin', 100, true)
       on conflict (slug) do nothing;

     insert into joueur (id, forum_user_id, pseudo, palier, pokedollars)
       values ('${CALLIE}', ${COMPTE_CALLIE}, 'Callie du carnet', 2, 1500);`,
  );
}

/** Pose une clé et la rend. */
function poserUneCle(url: string): Promise<string> {
  return psql(
    url,
    `select carnet_nouvelle_cle('{"forumUserId":${COMPTE_CALLIE}}'::jsonb)->>'cle';`,
  );
}

/** Appelle `carnet()` et rend son JSON brut, en texte. */
function lireLeCarnet(url: string, cle: string): Promise<string> {
  return psql(url, `select carnet(jsonb_build_object('cle', '${cle}'))::text;`);
}

/** Le message d'erreur d'un ordre SQL, ou la chaîne vide s'il a passé.
 *
 *  ON LAISSE L'ERREUR REMONTER, on ne l'attrape pas en SQL. Premier jet
 *  de ce fichier : un bloc `do $$ … exception when others then raise
 *  notice '%', sqlerrm; end $$`. **Il ne mesurait rien.** Un `notice` ne
 *  fait pas échouer `psql` : le code de sortie restait 0, la fonction
 *  rendait la chaîne vide, et les quatre cas qui attendaient un refus
 *  passaient au vert sans qu'aucun refus n'ait eu lieu.
 *
 *  C'est exactement le genre de test qui contourne le code qu'on refuse
 *  ici. Avec `ON_ERROR_STOP=1`, l'erreur sort en code 1 et son texte
 *  arrive dans le message — donc on mesure le vrai refus de PostgreSQL. */
function erreurDe(url: string, sql: string): Promise<string> {
  return psql(url, sql).then(() => "").catch((e: Error) => e.message);
}

/** Le refus que `carnet()` oppose à une charge donnée. */
function refusDe(url: string, charge: string): Promise<string> {
  return erreurDe(url, `select carnet('${charge}'::jsonb);`);
}

function essai(nom: string, corps: (url: string) => Promise<void>): void {
  if (CIBLE !== "postgres" || PGURL === undefined) {
    Deno.test({
      name: `carnet réel · ${nom} — IGNORÉ faute de base`,
      ignore: true,
      fn: () => {},
    });
    return;
  }
  const url = PGURL;
  Deno.test(`carnet réel · ${nom}`, async () => {
    await decor(url);
    await corps(url);
  });
}

// ── la clé ──────────────────────────────────────────────────────────

essai("la clé fait 128 bits, en hexadécimal", async (url) => {
  //  Ce n'est pas de la coquetterie : `anon` peut appeler `carnet()`
  //  autant qu'il veut. C'est la LONGUEUR de la clé qui rend ce choix
  //  tenable, pas un garde-fou de débit qu'on n'a pas.
  const cle = await poserUneCle(url);
  assertEquals(cle.length, 32);
  assertMatch(cle, /^[0-9a-f]{32}$/);
});

essai("RENOUVELER UNE CLÉ INVALIDE L'ANCIENNE", async (url) => {
  //  Sans ça, une clé fuitée le reste pour toujours et le staff n'a
  //  aucun moyen de la reprendre. C'est la seule façon de révoquer.
  const premiere = await poserUneCle(url);
  assert((await lireLeCarnet(url, premiere)).includes("Callie du carnet"));

  const seconde = await poserUneCle(url);
  assert(seconde !== premiere, "la seconde clé doit différer");
  assert((await lireLeCarnet(url, seconde)).includes("Callie du carnet"));
  assertMatch(await refusDe(url, `{"cle":"${premiere}"}`), /CLE_INVALIDE/);
});

essai("un joueur introuvable ne reçoit pas de clé", async (url) => {
  const erreur = await erreurDe(
    url,
    `select carnet_nouvelle_cle('{"forumUserId":909090}'::jsonb);`,
  );
  assertMatch(erreur, /JOUEUR_INTROUVABLE/);
});

// ── les quatre propriétés ───────────────────────────────────────────

essai("LES TROIS MAUVAIS USAGES DONNENT LE MÊME REFUS", async (url) => {
  //  LE CAS QUI COMPTE LE PLUS. Si une clé inconnue et une clé mal
  //  formée se distinguaient, `carnet()` deviendrait un oracle : on
  //  saurait, pour une clé donnée, si elle existe. Le refus doit être
  //  le même mot, exactement.
  await poserUneCle(url);
  const refus = await Promise.all([
    refusDe(url, `{"cle":"00000000000000000000000000000000"}`), // bien formée, fausse
    refusDe(url, `{"cle":"abc"}`), // mal formée
    refusDe(url, `{}`), // absente
  ]);
  for (const r of refus) assertMatch(r, /CLE_INVALIDE/);
  //  Et ils sont identiques entre eux, pas seulement conformes.
  const nus = refus.map((r) => r.replace(/[\s\S]*?(CLE_INVALIDE)[\s\S]*/, "$1"));
  assertEquals(new Set(nus).size, 1, `trois refus distincts : ${JSON.stringify(refus)}`);
});

essai("LA RÉPONSE NE PORTE JAMAIS LA CLÉ", async (url) => {
  //  Un carnet ouvert sur un écran partagé ne doit pas laisser recopier
  //  de quoi y revenir. Ni la clé, ni le `jeton` de liaison.
  const cle = await poserUneCle(url);
  const brut = await lireLeCarnet(url, cle);
  assertEquals(brut.includes(cle), false, "la clé est dans la réponse");
  assertEquals(brut.includes("jeton"), false, "le jeton est dans la réponse");
  assertEquals(brut.includes("cle_de_carnet"), false);
});

essai("`anon` ne peut appeler QUE `carnet`", async (url) => {
  //  La surface qu'on ouvre fait une fonction, pas trois. `carnet_joueur`
  //  résout une clé et `carnet_nouvelle_cle` en fabrique une : les deux
  //  entre les mains d'un visiteur seraient exactement le défaut qu'on
  //  cherche à éviter.
  const vu = await psql(
    url,
    `select p.proname || '=' ||
            has_function_privilege('anon', p.oid, 'execute')::text
       from pg_proc p
      where p.proname in ('carnet','carnet_joueur','carnet_nouvelle_cle')
      order by p.proname;`,
  );
  assertEquals(vu.split("\n").map((l) => l.trim()).sort(), [
    "carnet=true",
    "carnet_joueur=false",
    "carnet_nouvelle_cle=false",
  ]);
});

// ── les deux décisions de la maquette ───────────────────────────────

essai("UN POKÉMON EN PENSION GARDE SA PLACE DANS L'ÉQUIPE", async (url) => {
  //  La note des boîtes : « il reste visible à sa place dans l'équipe,
  //  en transparence, avec la mention en pension. Il occupe la place
  //  tant qu'il n'est pas récupéré. »
  //
  //  Ce qui le rend vrai, c'est que `enPension` se lit dans la table
  //  `pension` et JAMAIS dans `pokemon.emplacement` — dont la valeur
  //  `'pension'` est morte et n'est écrite par personne. Si quelqu'un se
  //  met à l'écrire un jour, ce cas tombe, et c'est son travail.
  const cle = await poserUneCle(url);
  await psql(
    url,
    `insert into pokemon (id, joueur_id, espece_id, niveau, emplacement, position)
       values ('${EN_PENSION}', '${CALLIE}', ${PIKACHU}, 30, 'equipe', 2);
     insert into pension (joueur_id, pokemon_id, niveau_au_depot, tarif)
       values ('${CALLIE}', '${EN_PENSION}', 30, 500);`,
  );

  const lu = JSON.parse(await lireLeCarnet(url, cle));
  assertEquals(lu.pokemon.length, 1);
  const k = lu.pokemon[0];
  assertEquals(k.enPension, true);
  assertEquals(k.emplacement, "equipe", "il ne quitte pas l'équipe");
  assertEquals(k.place, 2, "et il garde sa place");
  assertEquals(k.boite, 0, "l'équipe est la boîte 0");
  //  Et le dépôt lui-même se lit, avec son tarif.
  assertEquals(lu.pension.length, 1);
  assertEquals(lu.pension[0].tarif, 500);
});

essai("TROIS BOÎTES, ET UNE CASE NE SE PARTAGE PAS", async (url) => {
  //  La base n'avait qu'un seul `'boite'` : tous les pokémon rangés
  //  partageaient la même, et deux pouvaient occuper la case 7.
  const cle = await poserUneCle(url);
  await psql(
    url,
    `insert into pokemon (joueur_id, espece_id, niveau, emplacement, boite_no, position)
       values ('${CALLIE}', ${PIKACHU}, 12, 'boite', 3, 7);`,
  );

  const double = await erreurDe(
    url,
    `insert into pokemon (joueur_id, espece_id, niveau, emplacement, boite_no, position)
       values ('${CALLIE}', ${PIKACHU}, 9, 'boite', 3, 7);`,
  );
  assert(double !== "", "la case 3/7 s'est partagée");
  assertMatch(double, /pokemon_case_de_boite|duplicate key/);

  //  La même place dans une AUTRE boîte, elle, doit passer : sinon on
  //  aurait réparé le partage en interdisant les trois boîtes.
  await psql(
    url,
    `insert into pokemon (joueur_id, espece_id, niveau, emplacement, boite_no, position)
       values ('${CALLIE}', ${PIKACHU}, 9, 'boite', 2, 7);`,
  );
  const lu = JSON.parse(await lireLeCarnet(url, cle));
  assertEquals(lu.pokemon.map((k: { boite: number }) => k.boite).sort(), [2, 3]);
});

// ── ce que la réponse contient, et ce qu'elle laisse dehors ─────────

essai("le sac ne rend pas les lignes à zéro", async (url) => {
  //  Un objet entièrement dépensé n'est plus dans le sac. Le laisser à
  //  zéro afficherait une case vide que personne ne sait lire.
  const cle = await poserUneCle(url);
  await psql(
    url,
    `insert into sac (joueur_id, objet_id, quantite)
       select '${CALLIE}', id, 0 from objet where slug = 'objet-de-contrat';`,
  );
  const lu = JSON.parse(await lireLeCarnet(url, cle));
  assertEquals(lu.sac, []);
});

essai("LE DERNIER JET PORTE SON CODE DE VÉRIFICATION", async (url) => {
  //  Sans le code, le dernier jet est décoratif : la page n'a plus rien
  //  à donner à qui veut faire rejouer le calcul. Oublié au premier jet
  //  de `0019`, rattrapé en relisant la note.
  const cle = await poserUneCle(url);
  await psql(
    url,
    `insert into registre (sujet_id, zone_id, joueur_id, message_id, type, charge, code)
       values (976, 9, '${CALLIE}', 15001, 'objet_trouve',
               '{"objetId":990991,"quantite":1}'::jsonb, 'WM-CODE-DE-CONTRAT');`,
  );
  const lu = JSON.parse(await lireLeCarnet(url, cle));
  assertEquals(lu.dernierJet.code, "WM-CODE-DE-CONTRAT");
  assertEquals(lu.dernierJet.messageId, 15001);
  assertEquals(lu.dernierJet.type, "objet_trouve");
});

essai("le carnet d'un joueur tout neuf est vide, mais bien formé", async (url) => {
  //  Une réponse où `pokemon` vaudrait `null` au lieu de `[]` obligerait
  //  chaque onglet à se méfier. Les listes vides sont des listes.
  const cle = await poserUneCle(url);
  const lu = JSON.parse(await lireLeCarnet(url, cle));
  assertEquals(lu.pokemon, []);
  assertEquals(lu.pension, []);
  assertEquals(lu.badges, []);
  assertEquals(lu.sac, []);
  assertEquals(lu.pokedex, []);
  assertEquals(lu.dernierJet, null);
  assertEquals(lu.dresseur.pseudo, "Callie du carnet");
  assertEquals(lu.dresseur.palier, 2);
  assertEquals(lu.dresseur.pokedollars, 1500);
});
