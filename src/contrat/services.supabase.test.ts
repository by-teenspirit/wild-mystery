// ════════════════════════════════════════════════════════════════════
//  src/contrat/services.supabase.test.ts
//
//  Les fonctions SQL de `0001` et `0002` qui n'avaient JAMAIS été
//  exécutées par un test.
//
//  ── POURQUOI CE FICHIER EXISTE ──────────────────────────────────────
//
//  Parce que trois fonctions de cette génération se sont révélées
//  cassées en trois jours, et toujours de la même façon : une réécriture
//  qui corrige un détail et perd le reste.
//
//    · `servir_commande` (0002) n'a jamais servi une commande — une
//      ambiguïté SQL à sa dernière ligne (réparée en `0011`) ;
//    · `ranger_pokedex` (0002 puis 0004) rangeait des sujets non clos et
//      n'enregistrait aucune capture (réparée en `0012`) ;
//    · `rendre_fossile` (0002) écrivait son refus puis levait, ce qui
//      annulait le refus (réparée en `0013`) ;
//    · `pensions_a_rendre` (0002 puis 0004) cherche une clé que personne
//      n'écrit — **pas réparée**, voir l'en-tête de `0013`.
//
//  Quatre sur quatre. Les cinq autres de la même génération n'avaient
//  aucun test, et personne ne savait si elles marchaient. Ce fichier le
//  dit, et les empêche de se casser en silence à la prochaine
//  réécriture.
//
//  ── ELLES SONT APPELÉES EN DIRECT, PAS PAR UN ADAPTATEUR ────────────
//
//  Ces fonctions sont antérieures à la convention `(p jsonb) returns
//  jsonb` posée en `0003` : elles prennent des arguments positionnels,
//  et aucun adaptateur du dépôt ne les appelle encore. Ce qu'on éprouve
//  ici est donc **le SQL lui-même**, par `psql`, et c'est exactement ce
//  qui manquait.
//
//  Comme les autres contrats, il ne tourne que si on le lui demande :
//      CONTRAT_CIBLE=postgres CONTRAT_PGURL=postgres://…
//  Sans ça il s'annonce ignoré, à voix haute.
// ════════════════════════════════════════════════════════════════════

import { assert, assertEquals, assertRejects } from "@std/assert";

const CIBLE = Deno.env.get("CONTRAT_CIBLE");
const PGURL = Deno.env.get("CONTRAT_PGURL");

const ANNA = "bbbb1111-0000-0000-0000-0000000000s1".replace("s", "a");
const BORIS = "bbbb1111-0000-0000-0000-0000000000b1";
const POKEMON = "cccc1111-0000-0000-0000-0000000000a1";
const PENSION = "dddd1111-0000-0000-0000-0000000000a1";
const COMPTE_ANNA = 95101;
const COMPTE_BORIS = 95102;
/** Amonita, parce que les fossiles en donnent. */
const AMONITA = 138;

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

/** Le décor : deux joueuses, un pokémon de niveau 1, rien d'autre.
 *
 *  `niveau_au_depot` et `tarif` sont NOT NULL sur `pension` — relevé en
 *  les oubliant, ce qui a fait échouer le premier jet de ce fichier. */
async function decor(url: string): Promise<void> {
  await psql(
    url,
    `delete from pension where joueur_id in ('${ANNA}', '${BORIS}');
     delete from badge where joueur_id in ('${ANNA}', '${BORIS}');
     delete from registre where joueur_id in ('${ANNA}', '${BORIS}');
     delete from pokedex where joueur_id in ('${ANNA}', '${BORIS}');
     delete from pokemon where joueur_id in ('${ANNA}', '${BORIS}');
     delete from sac where joueur_id in ('${ANNA}', '${BORIS}');
     delete from analyse_fossile where joueur_id in ('${ANNA}', '${BORIS}');
     --  cloture.clos_par n'a PAS de cascade, et c'est voulu : une
     --  clôture ne doit pas disparaître avec le joueur qui l'a demandée.
     --  Donc il faut l'effacer explicitement, sinon la suppression de la
     --  joueuse est refusée — ce qui a fait tomber trois tests de ce
     --  fichier au premier jet.
     delete from cloture where clos_par in ('${ANNA}', '${BORIS}');
     delete from joueur where id in ('${ANNA}', '${BORIS}')
        or forum_user_id in (${COMPTE_ANNA}, ${COMPTE_BORIS}, 95199);

     insert into espece (id, nom_fr, types, stade, pv_base)
       values (${AMONITA}, 'Amonita', array['roche','eau'], 1, 35)
       on conflict (id) do nothing;

     insert into joueur (id, forum_user_id, pseudo, pokedollars, jeton) values
       ('${ANNA}', ${COMPTE_ANNA}, 'Anna des services', 5000, 'JETON-DE-CONTRAT'),
       ('${BORIS}', ${COMPTE_BORIS}, 'Boris des services', 0, null);

     insert into pokemon (id, joueur_id, espece_id, niveau, xp, emplacement, position)
       values ('${POKEMON}', '${ANNA}', ${AMONITA}, 1, 0, 'equipe', 1);`,
  );
}

function essai(
  nom: string,
  corps: (url: string) => Promise<void>,
): void {
  if (CIBLE !== "postgres" || PGURL === undefined) {
    Deno.test({
      name: `services réels · ${nom} — IGNORÉ faute de base`,
      ignore: true,
      fn: () => {},
    });
    return;
  }
  const url = PGURL;
  Deno.test(`services réels · ${nom}`, async () => {
    await decor(url);
    await corps(url);
  });
}

// ── le barème d'expérience ──────────────────────────────────────────

essai("`seuil` suit la formule de la planche", async (url) => {
  //  `100 * n * (n+1) / 2`. On vérifie les bornes autant que le milieu :
  //  c'est un entier 32 bits, et un barème qui déborde au niveau 100
  //  ne se verrait qu'au niveau 100.
  const r = await psql(
    url,
    `select seuil(1::smallint) || ' ' || seuil(5::smallint) || ' ' ||
            seuil(50::smallint) || ' ' || seuil(100::smallint)`,
  );
  assertEquals(r, "100 1500 127500 505000");
});

essai("`monter_niveaux` monte de plusieurs crans d'un coup", async (url) => {
  //  Un RP peut rapporter beaucoup d'un coup : la fonction doit vider
  //  l'XP accumulée jusqu'au bon palier, pas monter d'un seul niveau.
  await psql(url, `update pokemon set xp = 1500 where id = '${POKEMON}'`);
  assertEquals(await psql(url, `select monter_niveaux('${POKEMON}')`), "4");
  assertEquals(await psql(url, `select niveau from pokemon where id = '${POKEMON}'`), "5");

  //  Et elle ne remonte pas si rien n'a changé.
  assertEquals(await psql(url, `select monter_niveaux('${POKEMON}')`), "0");
});

essai("`monter_niveaux` s'arrête à 100", async (url) => {
  await psql(url, `update pokemon set niveau = 99, xp = 99999999 where id = '${POKEMON}'`);
  await psql(url, `select monter_niveaux('${POKEMON}')`);
  assertEquals(await psql(url, `select niveau from pokemon where id = '${POKEMON}'`), "100");
});

// ── la pension ──────────────────────────────────────────────────────

essai("`rendre_pension` : dix jours par niveau, dix niveaux au plafond", async (url) => {
  //  ATTENTION : cette fonction applique `floor(jours / 10)`, et la
  //  planche 50 §2 a déclaré cette règle FAUSSE — l'annexe élevage dit
  //  que le gérant DÉCLARE les niveaux, plafonnés à dix par sujet.
  //
  //  Ce test fixe donc le comportement du corps, pas la règle du jeu :
  //  il garantit que l'arithmétique, le déplacement en boîte et le refus
  //  du rejeu marchent, pour que la réécriture de la règle n'ait pas à
  //  tout revérifier.
  await psql(
    url,
    `insert into pension (id, joueur_id, pokemon_id, depose_le, niveau_au_depot, tarif)
     values ('${PENSION}', '${ANNA}', '${POKEMON}',
             now() - interval '35 days', 1, 500)`,
  );
  assertEquals(await psql(url, `select rendre_pension('${PENSION}')`), "3");

  const apres = await psql(
    url,
    `select niveau || ' ' || xp || ' ' || emplacement || ' ' ||
            coalesce(position::text, 'nulle')
       from pokemon where id = '${POKEMON}'`,
  );
  //  Niveau 4, et l'XP remontée au seuil du niveau atteint : sinon un
  //  pokémon sorti de pension redescendrait au premier gain d'XP.
  assertEquals(apres, "4 1000 boite nulle");

  //  Le pokémon QUITTE l'équipe. Une place se libère, et il ne peut pas
  //  être en pension et au combat.
  assert(apres.includes("boite"));
});

essai("`rendre_pension` refuse un second retrait", async (url) => {
  await psql(
    url,
    `insert into pension (id, joueur_id, pokemon_id, depose_le, niveau_au_depot, tarif)
     values ('${PENSION}', '${ANNA}', '${POKEMON}', now() - interval '12 days', 1, 500)`,
  );
  await psql(url, `select rendre_pension('${PENSION}')`);
  await assertRejects(
    () => psql(url, `select rendre_pension('${PENSION}')`),
    Error,
    "déjà rendu",
  );
});

essai("`rendre_pension` ne donne rien en dessous de dix jours", async (url) => {
  await psql(
    url,
    `insert into pension (id, joueur_id, pokemon_id, depose_le, niveau_au_depot, tarif)
     values ('${PENSION}', '${ANNA}', '${POKEMON}', now() - interval '9 days', 1, 500)`,
  );
  assertEquals(await psql(url, `select rendre_pension('${PENSION}')`), "0");
});

// ── le palier ───────────────────────────────────────────────────────

essai("`paliers_a_revoir` compte les badges, pas les RP", async (url) => {
  //  Rien à revoir au départ : tout le monde est au palier 1 sans badge.
  const avant = await psql(
    url,
    `select count(*) from paliers_a_revoir() where id = '${ANNA}'`,
  );
  assertEquals(avant, "0");

  //  Trois badges → palier 2 (planche 18 : « palier 2 à trois badges,
  //  palier 3 à sept »).
  await psql(
    url,
    `insert into badge (joueur_id, arene) values
       ('${ANNA}', 'Arène Roche'), ('${ANNA}', 'Arène Vol'), ('${ANNA}', 'Arène Feu')`,
  );
  assertEquals(
    await psql(url, `select palier_attendu from paliers_a_revoir() where id = '${ANNA}'`),
    "2",
  );

  //  Sept → palier 3.
  await psql(
    url,
    `insert into badge (joueur_id, arene) values
       ('${ANNA}', 'Arène Acier'), ('${ANNA}', 'Arène Eau'),
       ('${ANNA}', 'Arène Ténèbres'), ('${ANNA}', 'Arène Plante')`,
  );
  assertEquals(
    await psql(url, `select palier_attendu from paliers_a_revoir() where id = '${ANNA}'`),
    "3",
  );

  //  Et quand le palier du joueur est à jour, elle ne le liste plus :
  //  c'est ce qui en fait une file de travail et pas un rapport.
  await psql(url, `update joueur set palier = 3 where id = '${ANNA}'`);
  assertEquals(
    await psql(url, `select count(*) from paliers_a_revoir() where id = '${ANNA}'`),
    "0",
  );
});

// ── la liaison des comptes ──────────────────────────────────────────

essai("`lier_compte` lie une fois, et une seule", async (url) => {
  //  C'est la porte d'entrée de tout le jeu : sans liaison, un compte
  //  Forumactif n'a pas de fiche, et la boutique le refuse.
  const lie = await psql(url, `select lier_compte('JETON-DE-CONTRAT', 95199, 'Anna liée')`);
  assertEquals(lie, ANNA);

  const etat = await psql(
    url,
    `select forum_user_id || ' ' || pseudo || ' ' ||
            (jeton is null) || ' ' || (lie_le is not null)
       from joueur where id = '${ANNA}'`,
  );
  //  Le jeton est CONSOMMÉ, et la date de liaison posée : les deux
  //  ensemble sont ce qui empêche de rejouer.
  assertEquals(etat, "95199 Anna liée true true");

  await assertRejects(
    () => psql(url, `select lier_compte('JETON-DE-CONTRAT', 95199, 'Anna liée')`),
    Error,
    "JETON_INVALIDE",
  );
});

essai("`lier_compte` refuse un jeton inconnu", async (url) => {
  await assertRejects(
    () => psql(url, `select lier_compte('PAS-UN-JETON', 95199, 'Personne')`),
    Error,
    "JETON_INVALIDE",
  );
});

// ── le ménage ───────────────────────────────────────────────────────

essai("`oublier_les_abandons` n'efface que les vieux sujets NON CLOS", async (url) => {
  //  Trois sujets : un vieux abandonné, un vieux clôturé, un récent.
  //  Seul le premier doit partir — effacer le registre d'un sujet clos
  //  détruirait la trace de ce qui a été versé.
  await psql(
    url,
    `insert into registre (sujet_id, joueur_id, message_id, type, charge, code) values
       (9601, '${ANNA}', 96001, 'croise', '{"especeId":${AMONITA}}'::jsonb, 'V'),
       (9602, '${ANNA}', 96002, 'croise', '{"especeId":${AMONITA}}'::jsonb, 'C'),
       (9603, '${ANNA}', 96003, 'croise', '{"especeId":${AMONITA}}'::jsonb, 'R');
     update registre set cree_le = now() - interval '90 days'
      where sujet_id in (9601, 9602);
     insert into cloture (sujet_id, clos_par, resultat, code, bilan, mentionne)
       values (9602, '${ANNA}', '[]'::jsonb, 'C', 'bilan', 'Anna')
       on conflict (sujet_id) do nothing;`,
  );

  assertEquals(await psql(url, `select oublier_les_abandons(60)`), "1");

  const restants = await psql(
    url,
    `select string_agg(distinct sujet_id::text, ',' order by sujet_id::text)
       from registre where sujet_id between 9601 and 9603`,
  );
  assertEquals(restants, "9602,9603", "le clôturé et le récent doivent rester");
});

essai("`oublier_les_abandons` ne touche à rien quand tout est récent", async (url) => {
  await psql(
    url,
    `insert into registre (sujet_id, joueur_id, message_id, type, charge, code)
     values (9604, '${ANNA}', 96004, 'croise', '{"especeId":${AMONITA}}'::jsonb, 'N')`,
  );
  assertEquals(await psql(url, `select oublier_les_abandons(60)`), "0");
});

// ── le fossile : la fonction marche, la DONNÉE manque ───────────────

essai("`rendre_fossile` : un fossile sans espèce n'est PAS la faute du joueur", async (url) => {
  //  `fossile_espece` est VIDE, relevé le 6 octobre. C'est la table que
  //  Callista doit écrire : quel fossile donne quelle espèce.
  //
  //  Ce test ne demande donc pas que la réanimation marche — elle ne
  //  peut pas. Il demande qu'elle **échoue en le disant**, parce qu'une
  //  table vide est exactement l'état où on se trouve, et qu'un message
  //  obscur à ce moment-là coûterait une soirée.
  await psql(
    url,
    `insert into objet (id, slug, nom, famille, prix, en_vente)
       overriding system value
       values (9510, 'fossile-de-services', 'Fossile de services', 'fossile', null, false)
       on conflict (id) do nothing;
     insert into sac (joueur_id, objet_id, quantite) values ('${ANNA}', 9510, 1)
       on conflict (joueur_id, objet_id) do update set quantite = 1;
     delete from analyse_fossile where message_id = 96100;
     insert into analyse_fossile (joueur_id, objet_id, message_id, code)
       values ('${ANNA}', 9510, 96100, 'WM-F');`,
  );
  const id = await psql(
    url,
    `select id from analyse_fossile where message_id = 96100`,
  );
  const verdict = await psql(
    url,
    `select rendre_fossile(jsonb_build_object('analyseId', '${id}')) ->> 'motif'`,
  );
  assertEquals(verdict, "FOSSILE_SANS_ESPECE");

  //  L'analyse RESTE EN ATTENTE, et c'est voulu : la donnée manque de
  //  NOTRE côté, pas du sien. Le jour où `fossile_espece` sera écrite,
  //  sa demande repartira toute seule.
  assertEquals(
    await psql(url, `select etat from analyse_fossile where id = '${id}'`),
    "en_attente",
  );
  //  Et le fossile reste dans le sac : on n'a rien consommé.
  assertEquals(
    await psql(url, `select quantite from sac where joueur_id = '${ANNA}' and objet_id = 9510`),
    "1",
  );
});

essai("`rendre_fossile` refuse si le joueur n'a pas le fossile", async (url) => {
  //  Et il MARQUE l'analyse refusée au lieu de la laisser en attente —
  //  sinon la relève la repasserait indéfiniment, comme la boutique le
  //  faisait avant `0011`.
  await psql(
    url,
    `insert into objet (id, slug, nom, famille, prix, en_vente)
       overriding system value
       values (9511, 'fossile-absent', 'Fossile absent', 'fossile', null, false)
       on conflict (id) do nothing;
     delete from analyse_fossile where message_id = 96101;
     insert into analyse_fossile (joueur_id, objet_id, message_id, code)
       values ('${ANNA}', 9511, 96101, 'WM-G');`,
  );
  const id = await psql(url, `select id from analyse_fossile where message_id = 96101`);
  const verdict = await psql(
    url,
    `select rendre_fossile(jsonb_build_object('analyseId', '${id}')) ->> 'motif'`,
  );
  assertEquals(verdict, "FOSSILE_ABSENT");

  //  LE TEST QUI A TROUVÉ LE DÉFAUT. Avant `0013`, la fonction écrivait
  //  `refusee` puis levait — et le `raise` annulait l'écriture. L'analyse
  //  restait `en_attente`, donc la relève l'aurait repassée toutes les
  //  cinq minutes, pour toujours.
  assertEquals(
    await psql(url, `select etat from analyse_fossile where id = '${id}'`),
    "refusee",
    "un refus doit SURVIVRE : voir l'en-tête de la migration 0013",
  );
});
