// ════════════════════════════════════════════════════════════════════
//  src/contrat/carte-dresseur.supabase.test.ts
//
//  La lecture publique de la carte dresseur (`0020`), éprouvée contre
//  un vrai PostgreSQL.
//
//  ── POURQUOI CE FICHIER EXISTE ──────────────────────────────────────
//
//  `carte_dresseur()` est la SECONDE fonction du dépôt appelable par
//  `anon`, et la plus faible des deux : `carnet()` demande un secret de
//  128 bits, celle-ci ne demande qu'un `forum_user_id`, qui s'énumère
//  (u1, u2, u3…). C'est une exception assumée à la planche 56
//  (« fermer la surface »), et ce qui la rend acceptable est une
//  PROPRIÉTÉ, pas une intention : tout ce qu'elle rend est déjà affiché
//  dans le message où la carte est collée.
//
//  Une propriété, ça se vérifie. Les cas d'ici ne testent donc pas
//  surtout ce que la fonction rend — ils testent ce qu'elle NE rend
//  PAS, et ils sont écrits pour tomber le jour où quelqu'un ajoutera
//  « juste le sac, ça peut servir » :
//
//    · ni uuid interne, ni clé de carnet, ni jeton ;
//    · ni sac, ni Pokédex, ni pension, ni dernier jet ;
//    · les pokémon des BOÎTES ne sortent pas — l'équipe seule.
//
//  Plus deux comportements dont dépend l'affichage : un joueur inconnu
//  rend `null` et pas une erreur (sinon un marqueur collé par quelqu'un
//  sans compte de jeu peindrait une erreur dans un message), et un
//  pokémon en pension garde sa place dans l'équipe.
//
//  Comme les autres contrats, il ne tourne que si on le lui demande :
//      CONTRAT_CIBLE=postgres CONTRAT_PGURL=postgres://…
//  Sans ça il s'annonce ignoré, à voix haute.
// ════════════════════════════════════════════════════════════════════

import { assert, assertEquals, assertMatch } from "@std/assert";

const CIBLE = Deno.env.get("CONTRAT_CIBLE");
const PGURL = Deno.env.get("CONTRAT_PGURL");

const ELIOTT = "eeee3333-0000-0000-0000-0000000000d1";
const COMPTE_ELIOTT = 95401;
const INCONNU = 909091;
/** Pikachu, parce qu'il faut une espèce et que celle-là se reconnaît. */
const PIKACHU = 25;
const EN_PENSION = "eeee4444-0000-0000-0000-000000000001";

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

/** Un dresseur, son équipe, et de quoi vérifier ce qui ne doit PAS
 *  sortir : un pokémon en boîte, du sac, du Pokédex, un jet. */
async function decor(url: string): Promise<void> {
  await psql(
    url,
    `delete from pension where joueur_id = '${ELIOTT}';
     delete from registre where joueur_id = '${ELIOTT}';
     delete from pokedex where joueur_id = '${ELIOTT}';
     delete from pokemon where joueur_id = '${ELIOTT}';
     delete from sac where joueur_id = '${ELIOTT}';
     delete from badge where joueur_id = '${ELIOTT}';
     delete from cloture where clos_par = '${ELIOTT}';
     delete from joueur where id = '${ELIOTT}' or forum_user_id = ${COMPTE_ELIOTT};
     delete from joueur where forum_user_id = ${INCONNU};

     insert into espece (id, nom_fr, types, stade, pv_base)
       values (${PIKACHU}, 'Pikachu', array['electrik'], 2, 35)
       on conflict (id) do nothing;

     insert into zone (id, nom, palier, niveau_min, niveau_max, ordre)
       values (9, 'Zone de contrat', 1, 1, 20, 99)
       on conflict (id) do nothing;

     insert into objet (slug, nom, famille, prix, en_vente)
       values ('objet-de-carte', 'Objet de carte', 'soin', 100, true)
       on conflict (slug) do nothing;

     --  'hardi' est l'une des six NATURES : \`joueur_groupe_check\`
     --  n'accepte qu'elles depuis la migration 0022. 'Dresseur' s'y
     --  était cassé le nez au premier essai, et 'mew' s'y casserait
     --  maintenant — les légendaires étaient les groupes d'avant.
     insert into joueur (id, forum_user_id, pseudo, groupe, palier, pokedollars)
       values ('${ELIOTT}', ${COMPTE_ELIOTT}, 'Eliott Vanner', 'hardi', 2, 1240);`,
  );
}

function lireLaCarte(url: string, forum: number): Promise<string> {
  return psql(
    url,
    `select coalesce(carte_dresseur(jsonb_build_object('forumUserId', ${forum}))::text, 'null');`,
  );
}

function erreurDe(url: string, sql: string): Promise<string> {
  return psql(url, sql).then(() => "").catch((e: Error) => e.message);
}

function essai(nom: string, corps: (url: string) => Promise<void>): void {
  if (CIBLE !== "postgres" || PGURL === undefined) {
    Deno.test({
      name: `carte dresseur réelle · ${nom} — IGNORÉ faute de base`,
      ignore: true,
      fn: () => {},
    });
    return;
  }
  const url = PGURL;
  Deno.test(`carte dresseur réelle · ${nom}`, async () => {
    await decor(url);
    await corps(url);
  });
}

// ── ce qu'elle rend ─────────────────────────────────────────────────

essai("elle rend l'identité, le palier, l'argent et l'équipe", async (url) => {
  await psql(
    url,
    `insert into pokemon (joueur_id, espece_id, surnom, niveau, emplacement, position)
       values ('${ELIOTT}', ${PIKACHU}, 'Pika', 24, 'equipe', 2);
     insert into badge (joueur_id, arene) values ('${ELIOTT}', 'Arène Feu');`,
  );
  const lu = JSON.parse(await lireLaCarte(url, COMPTE_ELIOTT));
  assertEquals(lu.forumUserId, COMPTE_ELIOTT);
  assertEquals(lu.pseudo, "Eliott Vanner");
  assertEquals(lu.palier, 2);
  assertEquals(lu.pokedollars, 1240);
  assertEquals(lu.equipe.length, 1);
  assertEquals(lu.equipe[0].surnom, "Pika");
  assertEquals(lu.equipe[0].niveau, 24);
  assertEquals(lu.equipe[0].place, 2);
  assertEquals(lu.badges.length, 1);
  assertEquals(lu.badges[0].arene, "Arène Feu");
});

essai("une carte toute neuve est vide mais bien formée", async (url) => {
  //  Des listes vides, pas des `null` : sinon chaque case du script
  //  devrait se méfier, et la première qui oublierait planterait la
  //  carte d'un joueur qui vient d'arriver.
  const lu = JSON.parse(await lireLaCarte(url, COMPTE_ELIOTT));
  assertEquals(lu.equipe, []);
  assertEquals(lu.badges, []);
});

// ── ce qu'elle NE rend PAS, et c'est le cœur du fichier ─────────────

essai("ELLE NE LAISSE SORTIR NI UUID, NI CLÉ, NI JETON", async (url) => {
  //  L'uuid est l'argument de tout ce qui écrit ailleurs ; la clé
  //  ouvre le carnet entier. Une carte s'affiche sur l'écran de
  //  n'importe qui, parfois partagé.
  await psql(
    url,
    `select carnet_nouvelle_cle('{"forumUserId":${COMPTE_ELIOTT}}'::jsonb);`,
  );
  const brut = await lireLaCarte(url, COMPTE_ELIOTT);
  assert(!brut.includes(ELIOTT), "l'uuid du joueur est dans la réponse");
  assert(!brut.includes("cle"), `une clé est dans la réponse : ${brut}`);
  assert(!brut.includes("jeton"), "un jeton est dans la réponse");
});

essai("ELLE NE REND NI LE SAC, NI LE POKÉDEX, NI LE DERNIER JET", async (url) => {
  await psql(
    url,
    `insert into sac (joueur_id, objet_id, quantite)
       select '${ELIOTT}', id, 4 from objet where slug = 'objet-de-carte';
     insert into pokedex (joueur_id, espece_id, croise_le, attrape_le, fois)
       values ('${ELIOTT}', ${PIKACHU}, now(), now(), 3);
     insert into registre (sujet_id, zone_id, joueur_id, message_id, type, charge, code)
       values (977, 9, '${ELIOTT}', 15101, 'objet_trouve',
               '{"quantite":1}'::jsonb, 'WM-CODE-DE-CARTE');`,
  );
  const lu = JSON.parse(await lireLaCarte(url, COMPTE_ELIOTT));
  assertEquals(Object.keys(lu).sort(), [
    "badges",
    "equipe",
    "forumUserId",
    "groupe",
    "palier",
    "pokedollars",
    "pseudo",
  ]);
  const brut = await lireLaCarte(url, COMPTE_ELIOTT);
  assert(!brut.includes("WM-CODE-DE-CARTE"), "le code du dernier jet est sorti");
});

essai("LES POKÉMON DES BOÎTES RESTENT PRIVÉS", async (url) => {
  //  La carte montre l'équipe. Ce qu'un joueur garde en boîte ne
  //  regarde que lui, et `carnet()` est là pour ça — avec sa clé.
  await psql(
    url,
    `insert into pokemon (joueur_id, espece_id, surnom, niveau, emplacement, position)
       values ('${ELIOTT}', ${PIKACHU}, 'DansLEquipe', 24, 'equipe', 1);
     insert into pokemon (joueur_id, espece_id, surnom, niveau, emplacement, boite_no, position)
       values ('${ELIOTT}', ${PIKACHU}, 'DansLaBoite', 9, 'boite', 2, 5);`,
  );
  const brut = await lireLaCarte(url, COMPTE_ELIOTT);
  assert(brut.includes("DansLEquipe"), "l'équipe doit sortir");
  assert(!brut.includes("DansLaBoite"), "un pokémon de boîte est sorti sur la carte");
});

// ── les deux comportements dont l'affichage dépend ──────────────────

essai("UN JOUEUR INCONNU REND NULL, PAS UNE ERREUR", async (url) => {
  //  Un marqueur collé par quelqu'un qui n'a pas encore de compte de
  //  jeu doit s'effacer proprement. Une exception ici peindrait une
  //  erreur au milieu d'un message de RP.
  assertEquals(await lireLaCarte(url, INCONNU), "null");
});

essai("un appel sans forumUserId est refusé, et le dit", async (url) => {
  assertMatch(
    await erreurDe(url, `select carte_dresseur('{}'::jsonb);`),
    /FORUM_USER_ID_MANQUANT/,
  );
});

essai("UN POKÉMON EN PENSION GARDE SA PLACE SUR LA CARTE", async (url) => {
  //  Même décision que dans `carnet()` : l'état « en pension » se lit
  //  dans la table `pension`, jamais dans `pokemon.emplacement`. Sinon
  //  le pokémon quitterait l'équipe pendant le dépôt et la carte
  //  montrerait un trou que personne ne saurait expliquer.
  await psql(
    url,
    `insert into pokemon (id, joueur_id, espece_id, niveau, emplacement, position)
       values ('${EN_PENSION}', '${ELIOTT}', ${PIKACHU}, 30, 'equipe', 3);
     insert into pension (joueur_id, pokemon_id, niveau_au_depot, tarif)
       values ('${ELIOTT}', '${EN_PENSION}', 30, 500);`,
  );
  const lu = JSON.parse(await lireLaCarte(url, COMPTE_ELIOTT));
  assertEquals(lu.equipe.length, 1);
  assertEquals(lu.equipe[0].place, 3);
  assertEquals(lu.equipe[0].enPension, true);
});

// ── la surface ouverte, et pas une de plus ──────────────────────────

essai("AUCUNE AUTRE FONCTION `SECURITY DEFINER` N'EST OUVERTE À `anon`", async (url) => {
  //  La planche 56 dit « fermer la surface ». Ce cas-ci est le
  //  compteur : il tombe le jour où une troisième s'ouvre sans qu'on
  //  l'ait décidé.
  //
  //  IL NE COMPTE QUE LES `SECURITY DEFINER`, et c'est la bonne mesure.
  //  Relevé le 2 novembre sur une base montée des vingt migrations :
  //  huit fonctions sont appelables par `anon`, parce que PostgreSQL
  //  accorde `execute to public` par défaut et que toutes ne sont pas
  //  révoquées. Les cinq autres tournent avec les droits de l'appelant
  //  — donc sous RLS — et ne peuvent rien montrer qu'`anon` ne puisse
  //  déjà lire. Ce sont les `definer` qui franchissent la clôture, et
  //  elles seules qu'il faut tenir.
  //
  //  `joueur_courant` en fait partie depuis `0007`, qui l'a passée en
  //  `definer` pour casser une récursion de politique. Elle rend
  //  l'identifiant du joueur dont la session est ouverte — donc `null`
  //  pour `anon`, vérifié ci-dessous : elle ne montre rien de personne.
  //
  //  `carnet_reclamer` s'y est ajoutée le 2 novembre (`0023`), et ce
  //  cas a sauté en la voyant arriver — c'est précisément son travail.
  //  Elle est ouverte parce qu'une page qui ouvre un carnet n'a encore
  //  AUCUN secret : c'est le geste qui en donne un. Ce qui la protège
  //  est le secret de 128 bits passé en argument, dont l'empreinte a
  //  dû être postée par le compte de forum concerné, et qu'elle
  //  consomme en servant. Trois conditions, et la troisième interdit
  //  de rejouer.
  const vu = await psql(
    url,
    `select p.proname
       from pg_proc p
       join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public'
        and p.prosecdef
        and has_function_privilege('anon', p.oid, 'execute')
      order by p.proname;`,
  );
  //  `carnet_du_compte` EST PASSÉE PAR LÀ ET EN EST REPARTIE, le même
  //  jour. Ouverte par `0026` faute de mieux — « aucune clé, on fait
  //  confiance au forum » — puis refermée par `0027` quand Callista a
  //  nommé le vrai mécanisme : la clé vit dans un champ de profil que
  //  le staff remplit, et la page va la chercher sur une page qui ne
  //  se charge qu'avec la session de son propriétaire.
  //
  //  Ce compteur a donc sauté DEUX FOIS en huit heures, dans les deux
  //  sens. C'est exactement ce qu'on lui demande : il ne juge pas si
  //  l'ouverture est bonne, il oblige à l'écrire.
  //  `mes_joueurs` s'y ajoute le 3 novembre (`0029`), et pour la même
  //  raison que `joueur_courant` : les NEUF politiques de lecture
  //  l'appellent, et une politique s'évalue avec les droits du rôle qui
  //  interroge. Sans ce droit, `anon` ne pourrait rien lire du tout —
  //  pas même le catalogue public, dont les politiques la traversent.
  //
  //  Elle ne montre rien de personne : elle rend les personnages
  //  derrière le JETON de l'appelant, donc rien du tout pour `anon`,
  //  ce qui est vérifié juste en dessous.
  assertEquals(vu.split("\n").map((l) => l.trim()).filter((l) => l !== ""), [
    "carnet",
    "carnet_reclamer",
    "carte_dresseur",
    "joueur_courant",
    "mes_joueurs",
  ]);

  const pourAnon = await psql(
    url,
    `set role anon; select coalesce(joueur_courant()::text, 'null');`,
  );
  assertEquals(pourAnon.split("\n").pop()?.trim(), "null");

  //  ET `mes_joueurs` NE REND RIEN NON PLUS. C'est ce qui rend son
  //  ouverture à `anon` sans conséquence : sans jeton, aucun
  //  personnage. La compter sans vérifier ça serait prendre sa
  //  signature pour une garantie.
  const combienPourAnon = await psql(
    url,
    `set role anon; select count(*)::text from mes_joueurs();`,
  );
  assertEquals(combienPourAnon.split("\n").pop()?.trim(), "0");
});

// ── la publication des cartes, migration 0024 ──────────────────────

essai("les joueurs sans carte sortent, les plus anciens d'abord", async (url) => {
  await psql(
    url,
    `insert into joueur (forum_user_id, pseudo, groupe, cree_le)
       values (777301, 'Plus ancienne', 'doux',  '2026-01-01'),
              (777302, 'Plus récente',  'brave', '2026-06-01');`,
  );
  const lu = JSON.parse(
    await psql(url, `select cartes_a_publier('{"limite":50}'::jsonb)::text;`),
  );
  const miens = lu.filter((j: { forumUserId: number }) =>
    j.forumUserId === 777301 || j.forumUserId === 777302
  );
  assertEquals(miens.map((j: { pseudo: string }) => j.pseudo), [
    "Plus ancienne",
    "Plus récente",
  ]);
  await psql(url, `delete from joueur where forum_user_id in (777301, 777302);`);
});

essai("UN SUJET DÉJÀ NOTÉ NE SE REMPLACE PAS", async (url) => {
  //  Si deux passages se chevauchaient — le verrou l'interdit, mais le
  //  verrou est du code —, le second ferait oublier le premier sujet,
  //  qui resterait sur le forum sans que rien ne le relie à personne.
  const j = await psql(url, `select id from joueur where forum_user_id = ${COMPTE_ELIOTT};`);
  assertEquals(
    await psql(
      url,
      `select carte_publiee(jsonb_build_object('joueurId','${j}','sujetId',4001));`,
    ),
    "t",
  );
  assertEquals(
    await psql(
      url,
      `select carte_publiee(jsonb_build_object('joueurId','${j}','sujetId',9999));`,
    ),
    "f",
  );
  assertEquals(
    await psql(url, `select carte_sujet_id from joueur where id = '${j}';`),
    "4001",
  );
});

essai("un joueur qui a sa carte ne ressort plus de la file", async (url) => {
  const j = await psql(url, `select id from joueur where forum_user_id = ${COMPTE_ELIOTT};`);
  await psql(
    url,
    `select carte_publiee(jsonb_build_object('joueurId','${j}','sujetId',4002));`,
  );
  const lu = JSON.parse(
    await psql(url, `select cartes_a_publier('{"limite":50}'::jsonb)::text;`),
  );
  assertEquals(
    lu.filter((x: { forumUserId: number }) => x.forumUserId === COMPTE_ELIOTT).length,
    0,
  );
});

// ── la validation ouvre la file, migration 0025 ────────────────────

essai("UN JOUEUR SANS MAISON N'EST PAS DANS LA FILE", async (url) => {
  //  « Il faut que ça se mette en place seulement quand une personne
  //  est validée. » `carnet_reclamer` crée la ligne dès qu'on ouvre
  //  son carnet, donc bien avant toute validation : sans ce garde, la
  //  relève publierait un sujet pour quiconque a cliqué.
  await psql(url, `insert into joueur (forum_user_id, pseudo) values (777501, 'En attente');`);
  const avant = JSON.parse(
    await psql(url, `select cartes_a_publier('{"limite":99}'::jsonb)::text;`),
  );
  assertEquals(
    avant.filter((j: { forumUserId: number }) => j.forumUserId === 777501).length,
    0,
  );

  await psql(
    url,
    `select valider_le_personnage('{"forumUserId":777501,"groupe":"doux"}'::jsonb);`,
  );
  const apres = JSON.parse(
    await psql(url, `select cartes_a_publier('{"limite":99}'::jsonb)::text;`),
  );
  assertEquals(
    apres.filter((j: { forumUserId: number }) => j.forumUserId === 777501).length,
    1,
  );
  await psql(url, `delete from joueur where forum_user_id = 777501;`);
});

essai("valider crée la ligne quand elle n'existe pas encore", async (url) => {
  //  L'ordre normal est : on valide, PUIS la personne découvre son
  //  carnet. Sans création ici, sa carte n'arriverait qu'au jour où
  //  elle ouvre la page elle-même.
  await psql(url, `delete from joueur where forum_user_id = 777502;`);
  const r = JSON.parse(
    await psql(
      url,
      `select valider_le_personnage(
         '{"forumUserId":777502,"pseudo":"Toute neuve","groupe":"brave"}'::jsonb)::text;`,
    ),
  );
  assertEquals(r.creee, true);
  assertEquals(r.groupe, "brave");
  assertEquals(
    await psql(url, `select pseudo from joueur where forum_user_id = 777502;`),
    "Toute neuve",
  );
  await psql(url, `delete from joueur where forum_user_id = 777502;`);
});

essai("VALIDER REND LA CLÉ À COLLER, ET NE LA REFAIT PAS DEUX FOIS", async (url) => {
  //  Le geste du staff est en UN appel : la maison, la ligne au besoin,
  //  et la clé de liaison à coller dans le profil du membre.
  //
  //  ET SURTOUT elle ne change pas à la seconde validation. On corrige
  //  un pseudo, on change une maison — une clé neuve à chaque fois
  //  casserait le carnet d'un joueur qui jouait très bien, et celle de
  //  son profil ne vaudrait plus rien sans que personne le remarque.
  await psql(url, `delete from joueur where forum_user_id = 777903;`);
  const un = JSON.parse(
    await psql(
      url,
      `select valider_le_personnage('{"forumUserId":777903,"pseudo":"Clé neuve","groupe":"brave"}'::jsonb)::text;`,
    ),
  );
  assertEquals(un.creee, true);
  assertEquals(/^[0-9a-f]{32}$/.test(un.cle), true, `clé mal formée : ${un.cle}`);

  const deux = JSON.parse(
    await psql(
      url,
      `select valider_le_personnage('{"forumUserId":777903,"groupe":"jovial"}'::jsonb)::text;`,
    ),
  );
  assertEquals(deux.cle, un.cle);
  assertEquals(deux.groupe, "jovial");

  //  ET ELLE OUVRE VRAIMENT LE CARNET : une clé rendue qui ne servirait
  //  à rien serait pire que pas de clé du tout.
  const lu = await psql(
    url,
    `select carnet(jsonb_build_object('cle','${un.cle}')) -> 'dresseur' ->> 'pseudo';`,
  );
  assertEquals(lu, "Clé neuve");
});

essai("une maison inventée est refusée par son nom", async (url) => {
  //  Et pas par une violation de contrainte : le message doit dire
  //  quoi corriger sans qu'on aille lire le schéma.
  assertMatch(
    await erreurDe(
      url,
      `select valider_le_personnage('{"forumUserId":${COMPTE_ELIOTT},"groupe":"mew"}'::jsonb);`,
    ),
    /GROUPE_INCONNU/,
  );
  //  Et un inconnu sans pseudo ne se crée pas à moitié.
  assertMatch(
    await erreurDe(
      url,
      `select valider_le_personnage('{"forumUserId":777503,"groupe":"doux"}'::jsonb);`,
    ),
    /PSEUDO_MANQUANT/,
  );
});
