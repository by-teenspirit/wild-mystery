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
select plan(158);

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

-- ── 12 · ce dont la relève a besoin ─────────────────────────────────
select has_table('verrou');
select has_function('releve_prendre_le_verrou', array['jsonb']);
select has_function('releve_rendre_le_verrou', array['jsonb']);
select has_function('releve_noter', array['jsonb']);
select has_function('etat_du_joueur', array['jsonb']);
select has_function('joueur_du_compte', array['jsonb']);

--  Le verrou est pris par UN SEUL ordre SQL (`insert … on conflict … where`).
--  Un `select` puis un `insert` laisserait une fenêtre où deux passages se
--  croisent, et deux passages qui se croisent clôturent deux fois.
select is(releve_prendre_le_verrou('{"nom":"tap","secondes":240}'::jsonb), true,
  'le premier passage prend le verrou');
select is(releve_prendre_le_verrou('{"nom":"tap","secondes":240}'::jsonb), false,
  'le second ne l''a pas');
select is(releve_rendre_le_verrou('{"nom":"tap"}'::jsonb), true, 'il se rend');
select is(releve_prendre_le_verrou('{"nom":"tap","secondes":240}'::jsonb), true,
  'et se reprend après');

--  Un passage mort ne doit pas bloquer la relève pour toujours : le verrou
--  expire tout seul.
select is(releve_prendre_le_verrou('{"nom":"mort","secondes":-1}'::jsonb), true,
  'un verrou déjà expiré est posé');
select is(releve_prendre_le_verrou('{"nom":"mort","secondes":240}'::jsonb), true,
  'et il se reprend aussitôt, sans intervention');

--  Le curseur de lecture ne recule jamais : un passage en retard qui le
--  ferait reculer relirait et réécrirait le registre.
select is(releve_avancer('{"forumId":9,"dernierMessage":8100}'::jsonb), 8100::bigint,
  'le curseur avance');
select is(releve_avancer('{"forumId":9,"dernierMessage":8000}'::jsonb), 8100::bigint,
  'et ne recule pas');

-- ── 13 · la file des bilans en attente (0006) ───────────────────────
--  LE DÉFAUT DU 2 OCTOBRE. Appliquer une clôture et publier son bilan ne
--  sont pas atomiques : ce jour-là, un mot de passe expiré a laissé un
--  sujet marqué clos sans aucun bilan publié, et comme il était clos,
--  plus rien ne réessayait. Ce qui suit vérifie qu'un bilan survit
--  désormais à un forum injoignable.
select has_column('cloture', 'bilan');
select has_column('cloture', 'mentionne');
select has_column('cloture', 'bilan_poste_le');
select has_column('cloture', 'bilan_essais');
select has_function('clotures_sans_bilan', array['jsonb']);
select has_function('cloture_bilan_poste', array['jsonb']);
select has_function('cloture_bilan_echoue', array['jsonb']);
select has_function('pseudo_du_joueur', array['jsonb']);

--  Le bilan entre en base DANS la même transaction que la clôture. C'est
--  toute la correction : il n'existe pas d'instant où un sujet est clos
--  sans qu'un bilan soit prêt à partir.
select lives_ok($$
  select appliquer_cloture('{
    "sujetId": 7910, "code": "WM-ACDE-FGM",
    "bilan": "Sujet clôturé. CAPTURÉ Goupix Nv.9",
    "mentionne": "Callista",
    "versements": [{
      "joueurId": "11111111-1111-1111-1111-111111111111",
      "effets": {"pokedollars": 10}
    }]
  }'::jsonb)
$$, 'une clôture avec bilan passe');

select is((select bilan from cloture where sujet_id = 7910),
  'Sujet clôturé. CAPTURÉ Goupix Nv.9', 'le texte du bilan est gardé');
select is((select mentionne from cloture where sujet_id = 7910),
  'Callista', 'et le joueur à mentionner avec lui');
select is((select bilan_poste_le from cloture where sujet_id = 7910),
  null::timestamptz, 'rien n''est publié pour l''instant');

select is(
  jsonb_array_length(clotures_sans_bilan('{}'::jsonb)),
  1, 'la clôture entre dans la file d''attente');
select is(
  clotures_sans_bilan('{}'::jsonb)->0->>'sujetId', '7910',
  'et c''est bien celle-là');
select is(
  clotures_sans_bilan('{}'::jsonb)->0->>'code', 'WM-ACDE-FGM',
  'la file porte le code : c''est lui qui pose le marqueur');
select is(
  clotures_sans_bilan('{}'::jsonb)->0->>'mentionne', 'Callista',
  'et le joueur à mentionner');

--  Le sujet 7900, clôturé plus haut sans bilan, n'a rien à publier et ne
--  doit pas encombrer la file.
select isnt(
  clotures_sans_bilan('{}'::jsonb)->0->>'sujetId', '7900',
  'une clôture sans bilan n''entre pas dans la file');

--  Un échec compte, et garde sa raison. Sans ça, un bilan qui ne passera
--  jamais — sujet verrouillé, compte bloqué — tournerait en silence.
select is(cloture_bilan_echoue(
  '{"sujetId":7910,"erreur":"ConnexionRefusee : mot de passe expiré"}'::jsonb),
  1, 'un premier échec est compté');
select alike((select bilan_derniere_erreur from cloture where sujet_id = 7910),
  '%mot de passe expiré%', 'et sa raison est gardée');
select is(cloture_bilan_echoue('{"sujetId":7910,"erreur":"encore"}'::jsonb),
  2, 'le second aussi');
select is(
  jsonb_array_length(clotures_sans_bilan('{}'::jsonb)),
  1, 'un bilan qui a échoué RESTE en file');

--  La publication réussit. Elle ne doit réussir qu'une fois : reposter un
--  bilan déjà publié doublerait le message dans le sujet.
select is(cloture_bilan_poste('{"sujetId":7910,"messageId":15545}'::jsonb),
  true, 'la publication est enregistrée');
select is((select bilan_message_id from cloture where sujet_id = 7910),
  15545::bigint, 'avec le numéro du message publié');
select is((select bilan_derniere_erreur from cloture where sujet_id = 7910),
  null::text, 'et l''erreur précédente est effacée');
select is(
  jsonb_array_length(clotures_sans_bilan('{}'::jsonb)),
  0, 'il sort de la file');
select is(cloture_bilan_poste('{"sujetId":7910,"messageId":15999}'::jsonb),
  false, 'un second enregistrement ne passe pas : la publication est idempotente');
select is((select bilan_message_id from cloture where sujet_id = 7910),
  15545::bigint, 'et n''écrase pas le premier numéro');

--  Une fonction Edge a une durée maximale : mieux vaut poster dix bilans
--  par passage que d'en rater cent.
select lives_ok($$
  select appliquer_cloture('{"sujetId":7911,"code":"WM-ACDE-FGN",
    "bilan":"b1","mentionne":"Callista","versements":[{"joueurId":
    "11111111-1111-1111-1111-111111111111","effets":{}}]}'::jsonb);
  select appliquer_cloture('{"sujetId":7912,"code":"WM-ACDE-FGP",
    "bilan":"b2","mentionne":"Plumtys","versements":[{"joueurId":
    "22222222-2222-2222-2222-222222222222","effets":{}}]}'::jsonb);
$$, 'deux autres clôtures entrent en file');
select is(jsonb_array_length(clotures_sans_bilan('{}'::jsonb)), 2,
  'la file en compte deux');
select is(jsonb_array_length(clotures_sans_bilan('{"combien":1}'::jsonb)), 1,
  'et « combien » la borne');

--  Un bilan doit nommer les gens. Personne ne se reconnaît dans un UUID.
select is(
  pseudo_du_joueur('{"joueurId":"11111111-1111-1111-1111-111111111111"}'::jsonb)
    ->>'pseudo',
  'Callista', 'le pseudo se lit par son identifiant');
select is(
  pseudo_du_joueur('{"joueurId":"33333333-3333-3333-3333-333333333333"}'::jsonb)
    ->>'pseudo',
  null::text, 'et un joueur inconnu ne rend rien plutôt que de lever');

-- ── 14 · la RLS, vue depuis un vrai joueur (0007) ───────────────────
--  LE DÉFAUT QU'ON VERROUILLE, trouvé le 2 octobre.
--
--  `joueur_courant()` était une fonction SQL ordinaire qui lit `joueur`,
--  et la politique de lecture de `joueur` l'appelle. Résultat :
--  « stack depth limit exceeded » à la première requête d'un joueur.
--
--  Personne ne l'avait vu parce que **tout ce qui tourne ici tourne en
--  superutilisateur, et un superutilisateur contourne toujours la RLS**.
--  Les assertions qui suivent prennent donc un rôle ordinaire : c'est la
--  seule façon de faire appliquer une politique, et donc la seule façon
--  de prouver qu'elle protège quelque chose.
--  On prend `authenticated`, le rôle RÉEL d'un joueur connecté, créé et
--  doté par 0008. Un rôle inventé pour le test prouverait ce que le test
--  a lui-même accordé ; celui-ci prouve ce que la production fait.
create temp table rls_vu (quoi text primary key, valeur text);
grant insert on rls_vu to authenticated;

--  Callista et Plumtys reçoivent un compte d'authentification, et chacun
--  de quoi être confondu avec l'autre : même objet, même espèce.
update joueur set auth_id = 'aaaaaaaa-0000-0000-0000-0000000000a1'
 where id = '11111111-1111-1111-1111-111111111111';
update joueur set auth_id = 'bbbbbbbb-0000-0000-0000-0000000000b2'
 where id = '22222222-2222-2222-2222-222222222222';

insert into sac (joueur_id, objet_id, quantite)
values ('22222222-2222-2222-2222-222222222222', 9001, 99)
    on conflict (joueur_id, objet_id) do update set quantite = 99;

insert into pokemon (joueur_id, espece_id, niveau, emplacement)
values ('22222222-2222-2222-2222-222222222222', 37, 50, 'boite');

--  On lit SOUS le rôle ordinaire et on range le résultat ; les
--  assertions, elles, se font ensuite en superutilisateur — pgTAP écrit
--  dans ses propres tables et n'a pas à les partager.
do $$
begin
  set local role authenticated;
  perform set_config('request.jwt.claims',
    '{"sub":"aaaaaaaa-0000-0000-0000-0000000000a1"}', true);

  insert into rls_vu values
    ('joueur_courant',  coalesce(joueur_courant()::text, '(null)')),
    ('fiches',          (select count(*)::text from joueur)),
    ('pseudo',          (select coalesce(max(pseudo), '(rien)') from joueur)),
    ('lignes_de_sac',   (select count(*)::text from sac)),
    ('plus_grosse_pile', (select coalesce(max(quantite)::text, '(rien)') from sac)),
    ('pokemon_des_autres',
      (select count(*)::text from pokemon where joueur_id <> joueur_courant())),
    ('registre',        (select count(*)::text from registre));
  reset role;
end $$;

select is((select valeur from rls_vu where quoi = 'joueur_courant'),
  '11111111-1111-1111-1111-111111111111',
  'le jeton se résout en joueur — et SANS récursion, ce qui est tout l''objet de 0007');

select is((select valeur from rls_vu where quoi = 'fiches'), '1',
  'un joueur ne voit qu''une fiche : la sienne');
select is((select valeur from rls_vu where quoi = 'pseudo'), 'Callista',
  'et c''est bien la sienne, pas la première venue');

--  Plumtys a 99 exemplaires du même objet. Si Callista voyait 99, la
--  politique du sac ne filtrerait rien.
select is((select valeur from rls_vu where quoi = 'lignes_de_sac'), '2',
  'elle voit ses deux lignes de sac');
select is((select valeur from rls_vu where quoi = 'plus_grosse_pile'), '1',
  'et pas la pile de 99 du voisin');

select is((select valeur from rls_vu where quoi = 'pokemon_des_autres'), '0',
  'aucun Pokémon visible qui ne soit le sien — y compris celui de Plumtys');

--  Le registre est public à dessein : c'est ce qui permet à n'importe qui
--  de rejouer une clôture et de vérifier un code.
select isnt((select valeur from rls_vu where quoi = 'registre'), '0',
  'le registre reste lisible par tous : un arbitrage doit pouvoir se refaire');

-- ── le même, depuis l'autre siège ───────────────────────────────────
--  Sans ça, « il voit une fiche » pourrait vouloir dire « il voit
--  toujours la première ligne de la table ».
do $$
begin
  set local role authenticated;
  perform set_config('request.jwt.claims',
    '{"sub":"bbbbbbbb-0000-0000-0000-0000000000b2"}', true);
  insert into rls_vu values
    ('pseudo_b',   (select coalesce(max(pseudo), '(rien)') from joueur)),
    ('plus_grosse_pile_b', (select coalesce(max(quantite)::text, '(rien)') from sac));
  reset role;
end $$;

select is((select valeur from rls_vu where quoi = 'pseudo_b'), 'Plumtys',
  'l''autre joueur voit la SIENNE : la politique filtre, elle ne trie pas');
select is((select valeur from rls_vu where quoi = 'plus_grosse_pile_b'), '99',
  'et c''est bien lui qui a la pile de 99');

-- ── sans jeton, rien ────────────────────────────────────────────────
do $$
begin
  set local role authenticated;
  perform set_config('request.jwt.claims', '', true);
  insert into rls_vu values
    ('sans_jeton_fiches', (select count(*)::text from joueur)),
    ('sans_jeton_sac',    (select count(*)::text from sac));
  reset role;
end $$;

select is((select valeur from rls_vu where quoi = 'sans_jeton_fiches'), '0',
  'sans jeton, aucune fiche — et surtout pas toutes');
select is((select valeur from rls_vu where quoi = 'sans_jeton_sac'), '0',
  'sans jeton, aucun sac');

-- ── écrire chez le voisin ───────────────────────────────────────────
--  Ranger ses Pokémon est le seul geste d'écriture ouvert au navigateur.
--  Il doit s'arrêter net à la frontière du joueur.
do $$
declare n integer;
begin
  set local role authenticated;
  perform set_config('request.jwt.claims',
    '{"sub":"aaaaaaaa-0000-0000-0000-0000000000a1"}', true);
  update pokemon set emplacement = 'equipe'
   where joueur_id = '22222222-2222-2222-2222-222222222222';
  get diagnostics n = row_count;
  insert into rls_vu values ('ecriture_chez_le_voisin', n::text);
  reset role;
end $$;

select is((select valeur from rls_vu where quoi = 'ecriture_chez_le_voisin'), '0',
  'on ne range pas les Pokémon du voisin : zéro ligne touchée, sans erreur');
select is(
  (select emplacement::text from pokemon
    where joueur_id = '22222222-2222-2222-2222-222222222222' limit 1),
  'boite', 'et le Pokémon du voisin n''a pas bougé');

-- ── la garantie structurelle ────────────────────────────────────────
--  Repasser `joueur_courant` en « security invoker » ramènerait la
--  récursion. L'assertion le dit avant que ça n'arrive.
select is(
  (select prosecdef from pg_proc where proname = 'joueur_courant'),
  true, 'joueur_courant reste SECURITY DEFINER, sinon la politique récurse');
select alike(
  (select array_to_string(proconfig, ',') from pg_proc where proname = 'joueur_courant'),
  '%search_path=%',
  'et son search_path reste épinglé, comme toute fonction security definer');

-- ── 15 · la surface fermée (0008) ───────────────────────────────────
--  Trois trous trouvés le 2 octobre, et invisibles pour la même raison
--  que la récursion de 0007 : tout tournait en superutilisateur.
--
--  Le pire était que les vingt-neuf fonctions `security definer` étaient
--  exécutables par PUBLIC, donc appelables en RPC avec la clé publiable
--  — laquelle est dans le code source de la page, par construction.

--  LA GARANTIE LA PLUS UTILE DU FICHIER : elle ne nomme aucune table, donc
--  elle couvre aussi celles qu'on ajoutera. Une table sans RLS est
--  entièrement exposée dès qu'un grant lui parvient, et un grant finit
--  toujours par arriver.
select is(
  (select coalesce(string_agg(c.relname, ', ' order by c.relname), '')
     from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity),
  '', 'aucune table de public sans RLS — y compris les futures');

--  Même esprit : aucune fonction qui s'exécute avec les droits du
--  propriétaire ne doit être appelable par n'importe qui. Les deux
--  exceptions sont celles que les POLITIQUES appellent à chaque lecture.
select is(
  (select coalesce(string_agg(p.proname, ', ' order by p.proname), '')
     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prosecdef
      and p.proname not in ('joueur_courant', 'auth_courant')
      and has_function_privilege('public', p.oid, 'execute')),
  '', 'aucune fonction security definer n''est exécutable par PUBLIC');

select ok(has_function_privilege('authenticated', 'joueur_courant()', 'execute'),
  'joueur_courant reste exécutable par un joueur : une politique RLS exige ' ||
  'que l''APPELANT l''ait, sinon chaque lecture rend « permission denied »');

-- ── ce qu'un joueur connecté ne peut pas faire ──────────────────────
create temp table interdit (quoi text primary key, verdict text);
grant insert on interdit to authenticated;

do $$
declare
  essais text[][] := array[
    ['écrire le prix d''un objet',      'update objet set prix = 0'],
    ['lire le verrou de la relève',     'select count(*) from verrou'],
    ['lire le curseur de la relève',    'select count(*) from releve'],
    ['lire le journal de la relève',    'select count(*) from releve_journal'],
    ['se verser une clôture',
     'select appliquer_cloture(''{"sujetId":1,"code":"WM-ACDE-FGH","versements":[]}''::jsonb)'],
    ['écrire dans le registre',         'select registre_inscrire(''{}''::jsonb)'],
    ['prendre le verrou de la relève',
     'select releve_prendre_le_verrou(''{"nom":"x","secondes":1}''::jsonb)'],
    ['monter son Pokémon au niveau 100', 'update pokemon set niveau = 100'],
    ['effacer une table de rencontres', 'delete from zone_espece']
  ];
  i integer;
begin
  set local role authenticated;
  perform set_config('request.jwt.claims',
    '{"sub":"aaaaaaaa-0000-0000-0000-0000000000a1"}', true);
  for i in 1 .. array_length(essais, 1) loop
    begin
      execute essais[i][2];
      insert into interdit values (essais[i][1], 'AUTORISÉ');
    exception
      when insufficient_privilege then
        insert into interdit values (essais[i][1], 'refusé');
      when others then
        --  Une autre erreur n'est pas un refus de droits : on le dit,
        --  plutôt que de la compter comme une protection.
        insert into interdit values (essais[i][1], 'autre erreur : ' || sqlstate);
    end;
  end loop;
  reset role;
end $$;

select is((select verdict from interdit where quoi = 'écrire le prix d''un objet'),
  'refusé', 'un joueur ne réécrit pas le prix d''un objet');
select is((select verdict from interdit where quoi = 'lire le verrou de la relève'),
  'refusé', 'il ne voit pas le verrou de la relève');
select is((select verdict from interdit where quoi = 'lire le curseur de la relève'),
  'refusé', 'ni son curseur');
select is((select verdict from interdit where quoi = 'lire le journal de la relève'),
  'refusé', 'ni son journal');
select is((select verdict from interdit where quoi = 'se verser une clôture'),
  'refusé', 'il n''appelle PAS appliquer_cloture — c''était le trou le plus grave');
select is((select verdict from interdit where quoi = 'écrire dans le registre'),
  'refusé', 'il n''écrit pas de faux événements dans le registre');
select is((select verdict from interdit where quoi = 'prendre le verrou de la relève'),
  'refusé', 'il ne peut pas arrêter la relève');
select is((select verdict from interdit where quoi = 'monter son Pokémon au niveau 100'),
  'refusé', 'le grant ne porte que sur « emplacement » : ni le niveau, ni l''XP');
select is((select verdict from interdit where quoi = 'effacer une table de rencontres'),
  'refusé', 'il ne touche pas aux tables de rencontres');

-- ── et ce qu'il peut toujours faire ─────────────────────────────────
--  Fermer trop est aussi un défaut : un carnet qui ne s'ouvre plus est
--  aussi cassé qu'un carnet qui laisse tout faire.
do $$
begin
  set local role authenticated;
  perform set_config('request.jwt.claims',
    '{"sub":"aaaaaaaa-0000-0000-0000-0000000000a1"}', true);
  insert into interdit values
    ('lire le catalogue', (select count(*)::text from objet)),
    ('lire sa fiche',     (select count(*)::text from joueur));
  update pokemon set emplacement = 'boite' where joueur_id = joueur_courant();
  insert into interdit values ('ranger ses Pokémon', 'permis');
  reset role;
end $$;

select isnt((select verdict from interdit where quoi = 'lire le catalogue'), '0',
  'le catalogue reste lisible : sinon il n''y a plus ni boutique ni Pokédex');
select is((select verdict from interdit where quoi = 'lire sa fiche'), '1',
  'il lit toujours sa fiche');
select is((select verdict from interdit where quoi = 'ranger ses Pokémon'), 'permis',
  'et il range toujours ses Pokémon : c''est le seul geste d''écriture ouvert');

-- ── la relève n'a rien perdu ────────────────────────────────────────
--  Révoquer à PUBLIC sans réaccorder au rôle de service couperait la
--  relève net. L'assertion le dit ici plutôt qu'en production.
select ok(has_function_privilege('service_role', 'appliquer_cloture(jsonb)', 'execute'),
  'la relève appelle toujours appliquer_cloture');
select ok(has_table_privilege('service_role', 'verrou', 'select'),
  'et elle lit toujours son verrou');

-- ── 16 · les fossiles et leurs morceaux (0016) ──────────────────────
--  La règle du 7 octobre : on trouve un fossile ENTIER ou un MORCEAU, et
--  trois morceaux d'une même espèce font un fossile. Les deux moitiés de
--  cette règle vivent en base — l'assemblage dans un déclencheur, la
--  résurrection dans `rendre_fossile` — donc elles se testent ici.
--
--  LA FIXTURE EST À ELLE : elle n'utilise PAS `supabase/seeds/fossiles.sql`.
--  La CI ne joue pas les seeds (ils référencent une faune que la base de
--  CI n'a pas), et un test qui dépend du seed ne dit plus si c'est la
--  règle ou la donnée qui a cassé.
select has_table('fossile_morceau');
select has_column('fossile_morceau', 'morceaux_requis');

insert into espece (id, nom_fr, types, stade, pv_base, est_fossile)
values (9801, 'Testacera', array['roche'], 1, 40, true),
       (9802, 'Testaptéryx', array['roche','vol'], 1, 40, true)
  on conflict (id) do nothing;

insert into objet (id, slug, nom, famille, prix, en_vente)
overriding system value values
  (998001, 'fossile-de-test',  'Fossile de test',            'fossile', null, false),
  (998002, 'morceau-de-test',  'Morceau de fossile de test',  'fossile', null, false),
  (998003, 'fossile-a-deux',   'Fossile de test à deux noms', 'fossile', null, false)
  on conflict (id) do nothing;

insert into fossile_espece (objet_id, espece_id) values
  (998001, 9801),
  --  CELUI-LÀ EN REND DEUX, exprès : c'est la forme que `0013` disait
  --  indécidable, et le tirage ne doit plus être un tirage.
  (998003, 9801), (998003, 9802)
  on conflict do nothing;

insert into fossile_morceau (morceau_id, fossile_id, morceaux_requis)
values (998002, 998001, 3) on conflict (morceau_id) do nothing;

-- ── la base refuse une table de morceaux absurde ────────────────────
select throws_ok(
  $$insert into fossile_morceau (morceau_id, fossile_id, morceaux_requis)
    values (998002, 998002, 3)$$,
  null, null, 'un morceau ne peut pas être son propre fossile : ce serait une boucle');
select throws_ok(
  $$insert into fossile_morceau (morceau_id, fossile_id, morceaux_requis)
    values (998003, 998001, 1)$$,
  null, null, 'un seul morceau par fossile voudrait dire qu''il n''y a pas de morceaux');

-- ── deux morceaux restent deux morceaux ─────────────────────────────
insert into sac (joueur_id, objet_id, quantite)
values ('11111111-1111-1111-1111-111111111111', 998002, 2);

select is((select quantite from sac
            where joueur_id = '11111111-1111-1111-1111-111111111111' and objet_id = 998002),
  2, 'deux morceaux ne font rien : il en faut trois');
select is((select count(*)::int from sac
            where joueur_id = '11111111-1111-1111-1111-111111111111' and objet_id = 998001),
  0, 'et aucun fossile n''est apparu');

-- ── LE TROISIÈME LES ASSEMBLE ───────────────────────────────────────
update sac set quantite = quantite + 1
 where joueur_id = '11111111-1111-1111-1111-111111111111' and objet_id = 998002;

select is((select quantite from sac
            where joueur_id = '11111111-1111-1111-1111-111111111111' and objet_id = 998001),
  1, 'TROIS MORCEAUX FONT UN FOSSILE');
select is((select quantite from sac
            where joueur_id = '11111111-1111-1111-1111-111111111111' and objet_id = 998002),
  0, 'et les trois morceaux sont partis');

-- ── le reste ne disparaît pas ───────────────────────────────────────
--  Sept morceaux d'un coup — un cadeau du staff, une correction — font
--  deux fossiles et il en reste un. En rendre un seul mangerait six
--  fouilles.
insert into sac (joueur_id, objet_id, quantite)
values ('22222222-2222-2222-2222-222222222222', 998002, 7);

select is((select quantite from sac
            where joueur_id = '22222222-2222-2222-2222-222222222222' and objet_id = 998001),
  2, 'sept morceaux font DEUX fossiles, pas un');
select is((select quantite from sac
            where joueur_id = '22222222-2222-2222-2222-222222222222' and objet_id = 998002),
  1, 'et le septième est gardé : le reste ne se jette pas');

-- ── rendre un fossile ressuscite, et consomme ───────────────────────
insert into analyse_fossile (id, joueur_id, objet_id, message_id, code)
values ('dddddddd-0000-0000-0000-00000000d001',
        '11111111-1111-1111-1111-111111111111', 998001, 980001, 'WM-FOS1');

select is(
  (select rendre_fossile('{"analyseId":"dddddddd-0000-0000-0000-00000000d001"}'::jsonb)->>'espece'),
  'Testacera', 'le fossile rend son espèce');
select is((select quantite from sac
            where joueur_id = '11111111-1111-1111-1111-111111111111' and objet_id = 998001),
  0, 'et il est consommé : on ne ressuscite pas deux fois le même');
select is((select count(*)::int from pokemon
            where joueur_id = '11111111-1111-1111-1111-111111111111' and espece_id = 9801),
  1, 'le Pokémon arrive');
select is((select count(*)::int from pokedex
            where joueur_id = '11111111-1111-1111-1111-111111111111'
              and espece_id = 9801 and attrape_le is not null),
  1, 'et le Pokédex le note attrapé');

-- ── LE TIRAGE NE TIRE PLUS ──────────────────────────────────────────
--  `0002` ordonnait par `random()`. C'était le seul hasard du jeu qui ne
--  se rejouait pas : impossible de trancher une contestation en
--  recalculant. Deux analyses du MÊME fossile à deux espèces doivent
--  donner la même.
--  QUATRE FOIS, ET EN QUATRE REQUÊTES SÉPARÉES. Les deux détails
--  comptent, et le second a failli me passer sous le nez :
--
--    · deux appels seulement tomberaient d'accord une fois sur deux
--      même avec `random()` — le test passerait la moitié du temps sur
--      le code cassé. Quatre le rattrapent quinze fois sur seize ;
--    · et surtout, MESURÉ le 7 octobre : quatre `order by random()`
--      dans UNE SEULE requête rendent tous la même ligne. PostgreSQL
--      n'évalue le sous-ensemble qu'une fois. Un test qui les groupait
--      dans un `string_agg` passait sur l'ancien code, qui tirait
--      vraiment au hasard. Le hasard ne se voit qu'entre requêtes.
--
--  Chacun doit rendre la PLUS PETITE des deux espèces : c'est ce que
--  `order by fe.espece_id` garantit, et qu'un hasard ne garantit pas.
insert into sac (joueur_id, objet_id, quantite)
values ('22222222-2222-2222-2222-222222222222', 998003, 4);
insert into analyse_fossile (id, joueur_id, objet_id, message_id, code)
select ('dddddddd-0000-0000-0000-00000000d00' || n)::uuid,
       '22222222-2222-2222-2222-222222222222', 998003, 980000 + n, 'WM-FOS' || n
  from generate_series(2, 5) as n;

select is(
  (select rendre_fossile('{"analyseId":"dddddddd-0000-0000-0000-00000000d002"}'::jsonb)->>'especeId'),
  '9801', 'un fossile à deux espèces rend la première, pas une au hasard');
select is(
  (select rendre_fossile('{"analyseId":"dddddddd-0000-0000-0000-00000000d003"}'::jsonb)->>'especeId'),
  '9801', 'la deuxième fois aussi');
select is(
  (select rendre_fossile('{"analyseId":"dddddddd-0000-0000-0000-00000000d004"}'::jsonb)->>'especeId'),
  '9801', 'la troisième');
select is(
  (select rendre_fossile('{"analyseId":"dddddddd-0000-0000-0000-00000000d005"}'::jsonb)->>'especeId'),
  '9801', 'LA QUATRIÈME : le tirage ne tire plus, il se recalcule');

-- ── le refus survit (la leçon de 0013) ──────────────────────────────
--  `0002` écrivait `update … set etat = 'refusee'` puis `raise`, et le
--  `raise` annulait l'`update` : la relève repassait l'analyse à chaque
--  passage, pour toujours. Aucun test ne l'avait jamais vu.
insert into analyse_fossile (id, joueur_id, objet_id, message_id, code)
values ('dddddddd-0000-0000-0000-00000000d006',
        '11111111-1111-1111-1111-111111111111', 998001, 980006, 'WM-FOS6');

select is(
  (select rendre_fossile('{"analyseId":"dddddddd-0000-0000-0000-00000000d006"}'::jsonb)->>'motif'),
  'FOSSILE_ABSENT', 'sans le fossile dans le sac, c''est un refus');
select is(
  (select etat from analyse_fossile where id = 'dddddddd-0000-0000-0000-00000000d006'),
  'refusee', 'ET LE REFUS EST ÉCRIT : sinon la relève le rejouerait sans fin');

-- ── une donnée qui manque n'est pas la faute du joueur ──────────────
insert into sac (joueur_id, objet_id, quantite)
values ('11111111-1111-1111-1111-111111111111', 998002, 0)
    on conflict (joueur_id, objet_id) do nothing;
insert into objet (id, slug, nom, famille, prix, en_vente)
overriding system value values
  (998004, 'fossile-sans-espece', 'Fossile sans espèce', 'fossile', null, false)
  on conflict (id) do nothing;
insert into sac (joueur_id, objet_id, quantite)
values ('11111111-1111-1111-1111-111111111111', 998004, 1);
insert into analyse_fossile (id, joueur_id, objet_id, message_id, code)
values ('dddddddd-0000-0000-0000-00000000d007',
        '11111111-1111-1111-1111-111111111111', 998004, 980007, 'WM-FOS7');

select is(
  (select rendre_fossile('{"analyseId":"dddddddd-0000-0000-0000-00000000d007"}'::jsonb)->>'motif'),
  'FOSSILE_SANS_ESPECE', 'un fossile sans espèce ne rend rien');
select is(
  (select etat from analyse_fossile where id = 'dddddddd-0000-0000-0000-00000000d007'),
  'en_attente', 'et l''analyse ATTEND : c''est notre donnée qui manque, pas son fossile');
select is((select quantite from sac
            where joueur_id = '11111111-1111-1111-1111-111111111111' and objet_id = 998004),
  1, 'son fossile est encore dans son sac : rien n''a été consommé');

-- ── et une analyse introuvable lève, elle ───────────────────────────
select throws_ok(
  $$select rendre_fossile('{"analyseId":"dddddddd-0000-0000-0000-0000000000ff"}'::jsonb)$$,
  null, null, 'l''impossible lève : il n''y a pas de ligne où écrire le refus');
select throws_ok(
  $$select rendre_fossile('{}'::jsonb)$$,
  null, null, 'et un appel sans analyseId aussi');

select * from finish();
rollback;
