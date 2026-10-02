-- ════════════════════════════════════════════════════════════════════
--  supabase/tests/garanties.sql
--
--  Les règles qui vivent dans la base sont testées dans la base.
--  Lancé par pg_prove, dans une transaction annulée à la fin : rien
--  n'est écrit pour de vrai.
--
--    pg_prove -d wild_mystery supabase/tests/*.sql
-- ════════════════════════════════════════════════════════════════════

begin;
select plan(55);

-- ── le décor ────────────────────────────────────────────────────────
insert into joueur (id, forum_user_id, pseudo, groupe, palier, pokedollars)
values ('11111111-1111-1111-1111-111111111111', 101, 'Callista', 'deoxys', 1, 500),
       ('22222222-2222-2222-2222-222222222222', 102, 'Plumtys',  'mew',    1, 0);

insert into espece (id, nom_fr, types, stade, pv_base)
values (37, 'Goupix', array['feu'], 1, 38)
  on conflict (id) do nothing;

insert into zone (id, nom, palier, niveau_min, niveau_max, ordre)
values (900, 'Forêt de test', 1, 5, 15, 99)
  on conflict (id) do nothing;

-- ── 1 · la structure est bien là ────────────────────────────────────
select has_table('joueur');
select has_table('registre');
select has_table('cloture');
select has_table('pension');
select has_column('joueur', 'groupe');
select hasnt_column('joueur', 'clan');   -- ce sont des groupes, pas des clans

-- ── 2 · un message ne produit pas deux fois le même événement ───────
select has_index('registre', 'registre_une_fois');

insert into registre (sujet_id, zone_id, joueur_id, message_id, type, charge, code)
values (7000, 900, '11111111-1111-1111-1111-111111111111', 8001, 'croise',
        '{"espece":37}', 'WM-AAA1');

select lives_ok($$
  insert into registre (sujet_id, zone_id, joueur_id, message_id, type, charge, code)
  values (7000, 900, '11111111-1111-1111-1111-111111111111', 8001, 'capture',
          '{"espece":37,"niveau":12}', 'WM-AAA2')
$$, 'deux événements de types différents sur le même message : accepté');

select throws_ok($$
  insert into registre (sujet_id, zone_id, joueur_id, message_id, type, charge, code)
  values (7000, 900, '11111111-1111-1111-1111-111111111111', 8001, 'croise',
          '{"espece":37}', 'WM-AAA3')
$$, '23505', NULL, 'le même événement deux fois sur le même message : refusé');

-- ── 3 · un sujet clos a son registre figé ───────────────────────────
select has_function('registre_sujet_ouvert');
select has_trigger('registre', 'registre_sujet_ouvert');

insert into cloture (sujet_id, clos_par, resultat, code)
values (7000, '11111111-1111-1111-1111-111111111111', '{}', 'WM-CLOS');

select throws_like($$
  insert into registre (sujet_id, zone_id, joueur_id, message_id, type, charge, code)
  values (7000, 900, '11111111-1111-1111-1111-111111111111', 8002, 'croise',
          '{"espece":37}', 'WM-AAA4')
$$, '%clôturé%', 'écrire dans un sujet clos : refusé');

select lives_ok($$
  insert into registre (sujet_id, zone_id, joueur_id, message_id, type, charge, code)
  values (7001, 900, '11111111-1111-1111-1111-111111111111', 8003, 'croise',
          '{"espece":37}', 'WM-AAA5')
$$, 'un autre sujet, lui, reste ouvert');

-- ── 4 · six pokémon en équipe, pas sept ─────────────────────────────
select has_index('pokemon', 'pokemon_equipe_unique');

insert into pokemon (id, joueur_id, espece_id, niveau, emplacement, position)
select ('33333333-3333-3333-3333-00000000000' || n)::uuid,
       '11111111-1111-1111-1111-111111111111', 37, 10, 'equipe', n
from generate_series(1, 6) as n;

select throws_ok($$
  insert into pokemon (joueur_id, espece_id, niveau, emplacement, position)
  values ('11111111-1111-1111-1111-111111111111', 37, 10, 'equipe', 3)
$$, '23505', NULL, 'deux pokémon sur la même position d''équipe : refusé');

select throws_ok($$
  insert into pokemon (joueur_id, espece_id, niveau, emplacement, position)
  values ('11111111-1111-1111-1111-111111111111', 37, 10, 'equipe', 7)
$$, '23514', NULL, 'une septième place d''équipe : refusée');

select lives_ok($$
  insert into pokemon (joueur_id, espece_id, niveau, emplacement, position)
  values ('11111111-1111-1111-1111-111111111111', 37, 10, 'boite', null)
$$, 'la boîte, elle, n''a pas de limite de position');

-- ── 5 · deux dépôts en pension au maximum ───────────────────────────
select has_function('pension_deux_max');
select has_trigger('pension', 'pension_deux_max');

insert into pension (joueur_id, pokemon_id, niveau_au_depot, tarif)
values ('11111111-1111-1111-1111-111111111111',
        '33333333-3333-3333-3333-000000000001', 10, 300),
       ('11111111-1111-1111-1111-111111111111',
        '33333333-3333-3333-3333-000000000002', 10, 300);

select throws_like($$
  insert into pension (joueur_id, pokemon_id, niveau_au_depot, tarif)
  values ('11111111-1111-1111-1111-111111111111',
          '33333333-3333-3333-3333-000000000003', 10, 300)
$$, '%PENSION_PLEINE%', 'un troisième dépôt en pension : refusé');

select lives_ok($$
  insert into pension (joueur_id, pokemon_id, niveau_au_depot, tarif)
  values ('22222222-2222-2222-2222-222222222222',
          '33333333-3333-3333-3333-000000000004', 10, 300)
$$, 'la limite est par joueur, pas globale');

-- ── 6 · un solde ne descend jamais sous zéro ────────────────────────
select throws_ok($$
  update joueur set pokedollars = -1
  where id = '11111111-1111-1111-1111-111111111111'
$$, '23514', NULL, 'un solde négatif : refusé par la base');

-- ── 7 · décider et appliquer sont séparés ───────────────────────────
--  `cloturer()` recalculait le verdict que le domaine calcule déjà. Elle a
--  disparu le 2 octobre, et cette assertion empêche qu'elle revienne.
select hasnt_function('cloturer');
select has_function('appliquer_cloture', array['jsonb']);
select has_function('cloture_deja', array['jsonb']);

-- ── 8 · les quatre fonctions du registre ────────────────────────────
--  Elles sont la seule porte de l'adaptateur vers la base. Leur signature
--  est un contrat : un seul argument jsonb, pour que PostgREST et psql les
--  appellent de la même façon (voir la tête de supabase/registre.sql).
select has_function('registre_inscrire', array['jsonb']);
select has_function('registre_lignes', array['jsonb']);
select has_function('registre_joueurs', array['jsonb']);
select has_function('registre_oublier', array['jsonb']);

select is(
  registre_inscrire('{"sujetId":7700,"joueurId":"11111111-1111-1111-1111-111111111111",
                      "messageId":8801,"type":"croise","charge":{"especeId":37},
                      "code":"WM-ACDE-FGH"}'::jsonb),
  1, 'registre_inscrire écrit la ligne et rend 1');

select is(
  registre_inscrire('{"sujetId":7700,"joueurId":"11111111-1111-1111-1111-111111111111",
                      "messageId":8801,"type":"croise","charge":{"especeId":99},
                      "code":"WM-ACDE-FGJ"}'::jsonb),
  0, 'le même (message, type) une seconde fois ne réécrit rien et rend 0');

select is(
  registre_lignes('{"sujetId":7700,"joueurId":"11111111-1111-1111-1111-111111111111"}'::jsonb),
  '[{"type": "croise", "charge": {"especeId": 37}, "messageId": 8801}]'::jsonb,
  'registre_lignes rend la charge d''origine, pas celle du doublon');

select is(
  registre_lignes('{"sujetId":7700,"joueurId":"22222222-2222-2222-2222-222222222222"}'::jsonb),
  '[]'::jsonb, 'un joueur sans ligne reçoit un tableau vide, jamais null');

select is(
  registre_joueurs('{"sujetId":7700}'::jsonb),
  '["11111111-1111-1111-1111-111111111111"]'::jsonb,
  'registre_joueurs nomme chaque joueur une seule fois');

--  Un sujet clos ne s'oublie pas : son registre est l'archive de ce qui a
--  été versé. C'est la base qui le garantit, pas l'appelant.
insert into cloture (sujet_id, clos_par, resultat, code)
values (7700, '11111111-1111-1111-1111-111111111111', '{}'::jsonb, 'WM-ACDE-FGK');

select is(registre_oublier('{"sujetId":7700}'::jsonb), 0,
  'un sujet clos ne s''oublie pas');

-- ── 9 · l'identité du joueur ────────────────────────────────────────
--  Décision « a » du 2 octobre : c'est Supabase Auth qui fabrique le
--  laissez-passer, et `joueur.auth_id` dit à qui il appartient.
select has_column('joueur', 'auth_id');
select has_function('auth_courant');
select has_function('joueur_courant');

update joueur set auth_id = 'aaaaaaaa-0000-0000-0000-000000000001'
 where id = '11111111-1111-1111-1111-111111111111';

set request.jwt.claims = '{"sub":"aaaaaaaa-0000-0000-0000-000000000001"}';
select is(joueur_courant(), '11111111-1111-1111-1111-111111111111'::uuid,
  'un jeton connu désigne son joueur');

set request.jwt.claims = '{"sub":"aaaaaaaa-0000-0000-0000-00000000ffff"}';
select is(joueur_courant(), NULL,
  'un jeton inconnu ne désigne personne, et ne lève pas');

--  Sans jeton du tout, `current_setting` rend la chaîne vide, et un
--  `''::jsonb` lèverait. Une politique RLS tomberait alors sur un visiteur
--  anonyme au lieu de ne rien lui rendre.
reset request.jwt.claims;
select lives_ok($$ select joueur_courant() $$,
  'sans jeton, joueur_courant ne lève pas');
select is(joueur_courant(), NULL, 'sans jeton, personne');

-- ── 10 · appliquer_cloture verse, et ne vérifie plus ────────────────
--  Identifiants posés à la main : la charge JSON reste alors lisible, au
--  lieu d'être un empilement de jsonb_build_object imbriqués.
insert into objet (id, slug, nom, famille, prix) overriding system value values
  (9001, 'ball-de-test', 'Ball de test', 'ball', 200),
  (9002, 'potion-de-test', 'Potion de test', 'soin', 300);

insert into sac (joueur_id, objet_id, quantite)
values ('11111111-1111-1111-1111-111111111111', 9001, 3);

select lives_ok($$
  select appliquer_cloture('{
    "sujetId": 7900, "code": "WM-ACDE-FGH",
    "versements": [{
      "joueurId": "11111111-1111-1111-1111-111111111111",
      "effets": {
        "objetsConsommes": [{"objetId": 9001, "quantite": 2}],
        "objetsAjoutes":   [{"objetId": 9002, "quantite": 1}],
        "captures":        [{"especeId": 37, "niveau": 9}],
        "especesCroisees": [37],
        "pokedollars": 150
      }
    }]
  }'::jsonb)
$$, 'une clôture complète passe');

select is(
  (select quantite from sac
    where joueur_id = '11111111-1111-1111-1111-111111111111' and objet_id = 9001),
  1, 'les objets consommés sortent du sac');

select is(
  (select quantite from sac
    where joueur_id = '11111111-1111-1111-1111-111111111111' and objet_id = 9002),
  1, 'les objets trouvés entrent dans le sac');

select is(
  (select count(*)::int from pokemon
    where joueur_id = '11111111-1111-1111-1111-111111111111'
      and capture_dans = 7900 and emplacement = 'boite'),
  1, 'une capture arrive en boîte, jamais en équipe');

select is(cloture_deja('{"sujetId":7900}'::jsonb), true, 'le sujet est marqué clos');
select is(cloture_deja('{"sujetId":7901}'::jsonb), false, 'un autre sujet ne l''est pas');

select throws_like($$
  select appliquer_cloture('{"sujetId":7900,"code":"WM-ACDE-FGJ",
    "versements":[{"joueurId":"11111111-1111-1111-1111-111111111111",
                   "effets":{"pokedollars":1}}]}'::jsonb)
$$, '%déjà clôturé%', 'un sujet déjà clos ne se reclôture pas');

select throws_like($$
  select appliquer_cloture('{"sujetId":7902,"code":"WM-ACDE-FGK","versements":[]}'::jsonb)
$$, '%aucun versement%', 'une clôture sans versement est refusée');

select throws_like($$
  select appliquer_cloture('{"sujetId":7903,"versements":[{"joueurId":
    "11111111-1111-1111-1111-111111111111","effets":{"pokedollars":1}}]}'::jsonb)
$$, '%code manquant%', 'une clôture sans code est refusée');

--  Le filet : la base refuse l'absurde, et toute la transaction tombe.
select throws_ok($$
  select appliquer_cloture('{"sujetId":7904,"code":"WM-ACDE-FGL",
    "versements":[{"joueurId":"11111111-1111-1111-1111-111111111111",
                   "effets":{"pokedollars":-999999}}]}'::jsonb)
$$, '23514', NULL, 'un versement qui viderait le solde sous zéro : refusé par le filet');

select is(cloture_deja('{"sujetId":7904}'::jsonb), false,
  'et la clôture refusée n''a rien laissé derrière elle');

-- ── 11 · le serpent ne revient pas ──────────────────────────────────
--  Les fonctions de 0002 lisaient `charge->>'espece_id'`, l'adaptateur
--  écrit `especeId`. `->>` sur une clé absente rend NULL sans rien dire :
--  le bogue aurait été muet. Ces deux assertions tiennent la porte.
select isnt_empty($$
  select 1 from pg_proc where proname = 'ranger_pokedex'
    and prosrc like '%especeId%'
$$, 'ranger_pokedex lit la charge en chameau');

select is_empty($$
  select 1 from pg_proc
   where proname in ('ranger_pokedex', 'pensions_a_rendre')
     and (prosrc like '%espece_id''%' or prosrc like '%pension_id''%')
$$, 'plus une seule clé de charge en serpent');

select * from finish();
rollback;
