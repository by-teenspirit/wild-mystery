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
select plan(399);

-- ── le décor ────────────────────────────────────────────────────────
--  LES DEUX MAISONS SONT DES NATURES, pas des légendaires. La
--  migration 0022 a remplacé les six groupes le 2 novembre et
--  `joueur_groupe_check` refuse désormais « deoxys » : ce décor
--  faisait tomber les 158 contrôles d'un coup, sans en lancer un
--  seul, et personne ne l'a vu parce que cette suite ne tourne qu'au
--  tag. C'est la liste de la contrainte, et c'est la seule qui passe.
insert into joueur (id, forum_user_id, pseudo, groupe, palier, pokedollars)
values ('11111111-1111-1111-1111-111111111111', 101, 'Callista', 'hardi', 1, 500),
       ('22222222-2222-2222-2222-222222222222', 102, 'Plumtys',  'doux',  1, 0);

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

-- ── LES SIX MAISONS, ET RIEN D'AUTRE ────────────────────────────────
--
--  Ces trois contrôles existent parce que le décor de cette suite a
--  gardé « deoxys » et « mew » pendant tout le temps où les groupes
--  changeaient. La contrainte avait raison, le décor avait tort, et
--  rien ne le disait : la suite tombait d'un bloc, en annonçant un
--  plan de 158 contrôles et en n'en lançant aucun.
--
--  Nommer la liste ICI veut dire qu'un septième groupe, ou un groupe
--  renommé, se verra dans un échec qui le dit — et pas dans un décor
--  qui refuse de se monter.
select lives_ok($$
  insert into joueur (id, forum_user_id, pseudo, groupe)
  values ('99999999-0000-0000-0000-000000000006', 906, 'Les six', 'jovial')
$$, 'une nature de la liste est acceptée');
select throws_ok($$
  insert into joueur (id, forum_user_id, pseudo, groupe)
  values ('99999999-0000-0000-0000-000000000007', 907, 'Le septième', 'deoxys')
$$, '23514', null, 'un légendaire est refusé par la contrainte');
select lives_ok($$
  insert into joueur (id, forum_user_id, pseudo, groupe)
  values ('99999999-0000-0000-0000-000000000008', 908, 'Sans maison', null)
$$, 'ET L''ABSENCE DE MAISON EST PERMISE : c''est l''état de qui attend sa validation');

-- ── UNE CONNEXION, PLUSIEURS PERSONNAGES ────────────────────────────
--
--  « La personne n'a pas toujours la même adresse e-mail pour chacun de
--  ses personnages », 3 novembre. Donc parfois la même, et une adresse
--  ne fait qu'un compte chez Supabase Auth.
--
--  CE QUI EST TENU ICI, et qui est tombé en silence avant la 0029 :
--  neuf politiques comparaient `joueur_id = joueur_courant()`, qui rend
--  UN identifiant. Avec deux personnages derrière une connexion, elles
--  en montraient un et cachaient l'autre, au hasard de l'ordre des
--  lignes — et PostgreSQL ne lève pas pour ça.
insert into joueur (id, forum_user_id, pseudo, groupe, courriel) values
  ('aaaa0029-0000-0000-0000-000000000001', 990291, 'Deux-un', 'hardi', 'Deux@Exemple.FR'),
  ('aaaa0029-0000-0000-0000-000000000002', 990292, 'Deux-deux', 'doux', 'deux@exemple.fr'),
  ('aaaa0029-0000-0000-0000-000000000003', 990293, 'Pas-a-moi', 'brave', 'autre@exemple.fr');

set local request.jwt.claims =
  '{"sub":"aaaa0029-9999-0000-0000-000000000009","email":" DEUX@exemple.fr "}';

select is((select count(*)::int from mes_joueurs()), 0,
  'avant liaison, la session ne porte aucun personnage');

select is(
  (lier_mon_personnage()->>'lies')::int, 2,
  'LA LIAISON PREND LES DEUX PERSONNAGES DE L''ADRESSE DU JETON, casse comprise');

select is((select count(*)::int from mes_joueurs()), 2,
  'et la session les porte tous les deux');

select is(
  (lier_mon_personnage()->>'lies')::int, 2,
  'REJOUER NE CASSE RIEN : un lien cliqué deux fois rend ce qui est déjà vrai');

select is(
  carnet_de_la_session('{"forumUserId":990291}'::jsonb) -> 'dresseur' ->> 'pseudo',
  'Deux-un', 'le carnet d''un de mes personnages s''ouvre par la session');

select is(
  carnet_de_la_session('{"forumUserId":990293}'::jsonb), null,
  'ET CELUI D''UN AUTRE NE S''OUVRE PAS : c''est ce qui la distingue de carnet_du_compte');

-- ── LE « +1 » EST LA MÊME BOÎTE ─────────────────────────────────────
--
--  « On ne peut pas créer un compte sur Forumactif avec la même adresse
--  e-mail, sauf en rajoutant +1 », 3 novembre. Trois adresses pour une
--  boîte, donc : sans la réduction de la 0030, cette personne aurait eu
--  à se connecter trois fois.
select is(boite_du_courriel('Callie+2@EXEMPLE.fr'), 'callie@exemple.fr',
  'l''étiquette et la casse tombent, la boîte reste');
select is(boite_du_courriel('  callie@exemple.fr  '), 'callie@exemple.fr',
  'et les espaces du copier-coller aussi');
select is(boite_du_courriel('nimportequoi'), null,
  'une chaîne sans arobase n''est pas une boîte');

insert into joueur (id, forum_user_id, pseudo, groupe, courriel) values
  ('aaaa0030-0000-0000-0000-000000000001', 990301, 'Plus-un', 'hardi', 'troi@exemple.fr'),
  ('aaaa0030-0000-0000-0000-000000000002', 990302, 'Plus-deux', 'doux', 'troi+1@exemple.fr'),
  ('aaaa0030-0000-0000-0000-000000000003', 990303, 'Plus-trois', 'brave', 'TROI+2@Exemple.FR');

set local request.jwt.claims =
  '{"sub":"aaaa0030-9999-0000-0000-000000000009","email":"troi+1@exemple.fr"}';

select is(
  (lier_mon_personnage()->>'lies')::int, 3,
  'UNE SEULE CONNEXION PREND LES TROIS PERSONNAGES DE LA BOÎTE');

select is((select count(*)::int from mes_joueurs()), 3,
  'et la session les porte tous les trois');

-- ── L'ADRESSE VIENT DU JETON, PAS DE L'APPELANT ─────────────────────
--
--  LE DÉFAUT DE LA 0029, trouvé une heure après l'avoir écrite :
--  l'adresse était un argument, donc n'importe qui de connecté pouvait
--  réclamer les personnages d'une autre boîte. Se connecter est ouvert
--  à tous — c'est le principe d'un lien par mail — donc l'argument
--  était une porte grande ouverte.
select is(courriel_courant(), 'troi+1@exemple.fr',
  'l''adresse du jeton se lit');

select hasnt_function('lier_mon_personnage', array['jsonb'],
  'LA VERSION QUI PRENAIT L''ADRESSE EN ARGUMENT N''EXISTE PLUS');

--  ET SANS ADRESSE DANS LE JETON, ELLE LÈVE au lieu de lier n'importe
--  quoi : un compte créé autrement qu'avec un mail n'a aucun
--  personnage à réclamer.
set local request.jwt.claims = '{"sub":"aaaa0031-0000-0000-0000-000000000001"}';
select throws_ok('select lier_mon_personnage()', 'P0001', 'JETON_SANS_ADRESSE',
  'un jeton sans adresse ne lie rien');

-- ════════════════════════════════════════════════════════════════════
--  LES BROUILLONS (0032) — LA PREMIÈRE TABLE OÙ LE JOUEUR ÉCRIT
--
--  « RLS : chacun ne voit que les siens, et personne d'autre — pas même
--  le staff. » C'est la promesse la plus forte du carnet : quelqu'un
--  écrit un texte en croyant qu'il n'est qu'à lui. Elle se mesure, elle
--  ne se commente pas.
-- ════════════════════════════════════════════════════════════════════

select has_table('brouillon', 'la table des brouillons existe');

select is(
  (select relforcerowsecurity from pg_class where relname = 'brouillon'),
  true,
  'FORCE ROW LEVEL SECURITY : même le propriétaire de la table passe par les politiques');

--  Deux auteurs, deux connexions distinctes.
insert into joueur (id, forum_user_id, pseudo, auth_id, courriel) values
  ('bbbb0032-0000-0000-0000-00000000000a', 32001, 'Plume',
   'aaaa0032-0000-0000-0000-00000000000a', 'plume@exemple.fr'),
  ('bbbb0032-0000-0000-0000-00000000000b', 32002, 'Encre',
   'aaaa0032-0000-0000-0000-00000000000b', 'encre@exemple.fr');

insert into brouillon (joueur_id, place, sujet_id, titre, corps, mots) values
  ('bbbb0032-0000-0000-0000-00000000000a', 1, 1002, '', 'le texte de Plume', 4),
  ('bbbb0032-0000-0000-0000-00000000000b', 1, 1002, '', 'le secret d''Encre', 4);

--  ── LES TROIS PLACES SONT TENUES PAR LA BASE ──────────────────────
--
--  Pas par un comptage avant insertion : deux onglets ouverts au même
--  instant passeraient tous les deux un comptage, et on aurait quatre
--  brouillons.
select throws_ok(
  $$insert into brouillon (joueur_id, place) values
      ('bbbb0032-0000-0000-0000-00000000000a', 4)$$,
  '23514',
  null,
  'UNE QUATRIÈME PLACE EST REFUSÉE PAR LA CONTRAINTE, pas par un comptage');

select throws_ok(
  $$insert into brouillon (joueur_id, place) values
      ('bbbb0032-0000-0000-0000-00000000000a', 1)$$,
  '23505',
  null,
  'et une place déjà prise est refusée par la clé primaire');

--  ── UN BROUILLON DE TRENTE-DEUX JOURS N'EST PLUS LÀ ───────────────
insert into brouillon (joueur_id, place, corps, modifie_le) values
  ('bbbb0032-0000-0000-0000-00000000000a', 3, 'oublié depuis longtemps',
   now() - interval '32 days');

create temporary table brouillon_vu (quoi text primary key, valeur text);
grant insert on brouillon_vu to authenticated;

do $$
begin
  set local role authenticated;
  perform set_config('request.jwt.claims',
    '{"sub":"aaaa0032-0000-0000-0000-00000000000a","email":"plume@exemple.fr"}', true);

  insert into brouillon_vu values
    ('lignes',   (select count(*)::text from brouillon)),
    ('corps',    (select coalesce(string_agg(corps, ' | ' order by place), '(rien)')
                    from brouillon)),
    ('secret',   (select count(*)::text from brouillon
                   where corps like '%secret%'));

  --  On tente de réécrire le brouillon de l'autre : la politique ne le
  --  rend pas visible, donc l'UPDATE ne touche aucune ligne — et il ne
  --  lève pas, ce qui est exactement pourquoi il faut le compter.
  update brouillon set corps = 'volé'
   where joueur_id = 'bbbb0032-0000-0000-0000-00000000000b';
  insert into brouillon_vu values ('voles', (select count(*)::text from brouillon
    where corps = 'volé'));

  update brouillon set corps = 'relu' where place = 1;
  insert into brouillon_vu values ('relus', (select count(*)::text from brouillon
    where corps = 'relu'));

  reset role;
end $$;

select is((select valeur from brouillon_vu where quoi = 'lignes'), '1',
  'PLUME NE VOIT QU''UN BROUILLON : le sien, et pas celui de trente-deux jours');

select is((select valeur from brouillon_vu where quoi = 'secret'), '0',
  'LE TEXTE D''ENCRE N''EXISTE PAS POUR PLUME');

select ok(
  (select valeur from brouillon_vu where quoi = 'corps') not like '%secret%',
  'et il n''apparaît pas davantage en lisant la colonne entière');

select is((select valeur from brouillon_vu where quoi = 'voles'), '0',
  'RÉÉCRIRE LE BROUILLON D''UN AUTRE NE TOUCHE AUCUNE LIGNE — et ne lève pas');

select is((select valeur from brouillon_vu where quoi = 'relus'), '1',
  'mais son propre brouillon, il le réécrit');

--  ── NI L'INVITÉ NI LE STAFF N'ONT DE PORTE ────────────────────────
select ok(not has_table_privilege('anon', 'brouillon', 'select'),
  'UN VISITEUR NON CONNECTÉ N''A AUCUN DROIT DE LECTURE SUR LA TABLE');

select ok(not has_function_privilege('authenticated', 'purger_les_brouillons()', 'execute'),
  'et la purge n''est pas à la portée d''un joueur');

--  ── LA PURGE REND LA PLACE ────────────────────────────────────────
select is(purger_les_brouillons(), 1,
  'la purge enlève le brouillon de trente-deux jours, et lui seul');

select is((select count(*)::int from brouillon), 2,
  'les deux autres sont intacts');


-- ════════════════════════════════════════════════════════════════════
--  LA FICHE DU PERSONNAGE (0033)
--
--  « Chaque champ a son interrupteur, et rien ne fuit par défaut. »
--  Trois règles que la base tient elle-même, donc trois règles qui se
--  mesurent ici plutôt que de se répéter dans l'interface.
-- ════════════════════════════════════════════════════════════════════

insert into joueur (id, forum_user_id, pseudo, auth_id, courriel) values
  ('bbbb0033-0000-0000-0000-00000000000a', 33001, 'Sylve',
   'aaaa0033-0000-0000-0000-00000000000a', 'sylve@exemple.fr');

--  ── 1 · UN CHAMP NEUF NAÎT MASQUÉ ─────────────────────────────────
--
--  « On montre sur décision, jamais par oubli. » Ce n'est pas une
--  consigne d'interface : c'est la valeur par défaut, et elle tient
--  même quand la ligne entre par un autre chemin que la page.
insert into fiche_champ (joueur_id, champ, valeur)
  values ('bbbb0033-0000-0000-0000-00000000000a', 'Âge', '19 ans');
insert into fiche_description (joueur_id, texte)
  values ('bbbb0033-0000-0000-0000-00000000000a', 'Elle parle peu.');
insert into fiche_moment (joueur_id, quand, titre)
  values ('bbbb0033-0000-0000-0000-00000000000a', '2026-03-01', 'Arrivée à Rhode');

select is(
  (select bool_or(affiche) from fiche_champ
    where joueur_id = 'bbbb0033-0000-0000-0000-00000000000a'),
  false,
  'UN CHAMP NEUF NAÎT MASQUÉ, sans qu''on ait rien demandé');

select is(
  (select affiche from fiche_description
    where joueur_id = 'bbbb0033-0000-0000-0000-00000000000a'),
  false,
  'la description aussi');

select is(
  (select carte_affiche from fiche_description
    where joueur_id = 'bbbb0033-0000-0000-0000-00000000000a'),
  false,
  'et la trainer card, dont l''interrupteur vaut pour tout le bloc');

--  ── 2 · UN MOMENT DU SERVEUR SE MASQUE, IL NE SE RÉÉCRIT PAS ──────
insert into fiche_moment (joueur_id, quand, titre, texte, auto, affiche) values
  ('bbbb0033-0000-0000-0000-00000000000a', '2026-04-02',
   'Premier badge', 'Remporté à Aubelune', true, true);

update fiche_moment
   set titre = 'Je me suis donné dix badges',
       texte = 'et la Ligue avec',
       quand = '2020-01-01',
       affiche = false
 where auto;

select results_eq(
  $$select titre, texte, quand, affiche from fiche_moment where auto$$,
  $$values ('Premier badge', 'Remporté à Aubelune', '2026-04-02'::date, false)$$,
  'UN MOMENT DU SERVEUR : SEUL L''INTERRUPTEUR BOUGE — le titre, le texte et la date reviennent');

--  ── 3 · ON NE S'ÉCRIT PAS UN MOMENT DU SERVEUR ────────────────────
--
--  Sans cette politique, n'importe qui se fabriquerait un « a remporté
--  le badge de Rhode » que le jeu n'a jamais écrit.
create temporary table fiche_vu (quoi text primary key, valeur text);
grant insert on fiche_vu to authenticated;

do $$
declare v_refus text := 'passé';
begin
  set local role authenticated;
  perform set_config('request.jwt.claims',
    '{"sub":"aaaa0033-0000-0000-0000-00000000000a","email":"sylve@exemple.fr"}', true);

  begin
    insert into fiche_moment (joueur_id, quand, titre, auto) values
      ('bbbb0033-0000-0000-0000-00000000000a', '2026-05-05', 'Champion de Rhode', true);
  exception when insufficient_privilege or check_violation then
    v_refus := 'refusé';
  end;
  insert into fiche_vu values ('auto_insere', v_refus);

  --  Et effacer un moment du serveur ne marche pas non plus : la note
  --  dit « masquer », pas « supprimer ».
  delete from fiche_moment where auto;
  insert into fiche_vu values ('auto_restants',
    (select count(*)::text from fiche_moment where auto));

  --  Le joueur voit bien TOUTES ses lignes, masquées comprises : il lui
  --  faut ses propres interrupteurs. C'est la FABRIQUE de la fiche qui
  --  filtrera sur `affiche`, pas cette lecture-ci.
  insert into fiche_vu values ('champs_vus',
    (select count(*)::text from fiche_champ));

  reset role;
end $$;

select is((select valeur from fiche_vu where quoi = 'auto_insere'), 'refusé',
  'S''ÉCRIRE UN MOMENT DU SERVEUR EST REFUSÉ');

select is((select valeur from fiche_vu where quoi = 'auto_restants'), '1',
  'et l''effacer ne marche pas davantage : on masque, on ne supprime pas');

select is((select valeur from fiche_vu where quoi = 'champs_vus'), '1',
  'LE JOUEUR VOIT SES LIGNES MASQUÉES : ce sont ses interrupteurs');

--  ── 4 · CE QUI NE RENTRE PAS DANS LA BASE ─────────────────────────
select throws_ok(
  $$insert into fiche_description (joueur_id, image_lien)
      values ('bbbb0033-0000-0000-0000-00000000000a', 'javascript:alert(1)')$$,
  '23514',
  null,
  'UNE ADRESSE D''IMAGE QUI N''EST PAS `https` EST REFUSÉE À L''ENTRÉE');

select lives_ok(
  $$update fiche_description set image_lien = 'https://exemple.test/a.gif'
     where joueur_id = 'bbbb0033-0000-0000-0000-00000000000a'$$,
  'et une adresse https passe');

select throws_ok(
  $$insert into fiche_champ (joueur_id, champ)
      values ('bbbb0033-0000-0000-0000-00000000000a', '<b>Âge')$$,
  '23514',
  null,
  'un intitulé qui ressemble à une balise est refusé');

--  ── 5 · LE VOLUME EST BORNÉ ───────────────────────────────────────
--
--  Pas de la méfiance : une touche restée enfoncée dans un script, et
--  la table porte dix mille lignes qu'on ira nettoyer à la main.
do $$
begin
  for i in 1..12 loop
    insert into fiche_trait (joueur_id, mot) values
      ('bbbb0033-0000-0000-0000-00000000000a', 'mot' || i);
  end loop;
end $$;

select throws_ok(
  $$insert into fiche_trait (joueur_id, mot) values
      ('bbbb0033-0000-0000-0000-00000000000a', 'le treizième')$$,
  'TROP_DE_LIGNES',
  'LES TRAITS SONT BORNÉS À DOUZE');

select ok(not has_table_privilege('anon', 'fiche_champ', 'select'),
  'et un visiteur non connecté ne lit aucune fiche');

-- ════════════════════════════════════════════════════════════════════
--  LA FICHE PUBLIÉE (0034)
--
--  « Le carnet écrit la fiche, le joueur la publie. » La fabrique vit
--  dans la base exprès : si c'était la page qui triait sur `affiche`,
--  un défaut d'une ligne publierait ce que quelqu'un avait éteint.
-- ════════════════════════════════════════════════════════════════════

insert into joueur (id, forum_user_id, pseudo, auth_id, courriel) values
  ('bbbb0034-0000-0000-0000-00000000000a', 34001, 'Ombre',
   'aaaa0034-0000-0000-0000-00000000000a', 'ombre@exemple.fr');

insert into fiche_champ (joueur_id, champ, valeur, affiche) values
  ('bbbb0034-0000-0000-0000-00000000000a', 'Âge', '24 ans', true),
  ('bbbb0034-0000-0000-0000-00000000000a', 'Orientation', 'lesbienne', false);

insert into fiche_description (joueur_id, texte, affiche) values
  ('bbbb0034-0000-0000-0000-00000000000a',
   'Elle a écrit [color=red]rouge[/color] sans fermer [b', true);

insert into fiche_moment (joueur_id, quand, titre, texte, auto, affiche) values
  ('bbbb0034-0000-0000-0000-00000000000a', '2026-06-12', 'Arrivée',
   'Descendue du bateau.', true, true),
  ('bbbb0034-0000-0000-0000-00000000000a', '2026-07-01', 'Ce qu''elle tait',
   'Rien de public.', false, false);

insert into lien (joueur_id, cible_forum_id, cible_pseudo, court, ordre) values
  ('bbbb0034-0000-0000-0000-00000000000a', 77, 'Pyrite', 'la dette', 0);

--  ── 1 · CE QUI EST ÉTEINT NE PART PAS ─────────────────────────────
--
--  C'est la promesse entière de l'onglet « Mon histoire ». Elle se
--  mesure ici, sur le texte qui partirait vraiment.
select ok(
  fiche_en_bbcode('bbbb0034-0000-0000-0000-00000000000a') like '%24 ans%',
  'LA FICHE PORTE CE QUI EST ALLUMÉ');

select ok(
  fiche_en_bbcode('bbbb0034-0000-0000-0000-00000000000a') not like '%lesbienne%',
  'ET PAS CE QUI EST ÉTEINT — un champ masqué ne sort pas de la base');

select ok(
  fiche_en_bbcode('bbbb0034-0000-0000-0000-00000000000a') not like '%Rien de public%',
  'le moment masqué non plus, même écrit par le serveur');

select ok(
  fiche_en_bbcode('bbbb0034-0000-0000-0000-00000000000a') like '%Pyrite%',
  'et les liens y sont, dans leur ordre');

--  ── 2 · UNE BALISE DU JOUEUR NE S'OUVRE PAS ───────────────────────
--
--  « Une balise mal fermée dans une description casserait tout le
--  message publié, et il faudrait le réparer à la main. »
select ok(
  fiche_en_bbcode('bbbb0034-0000-0000-0000-00000000000a') not like '%[color=red]%',
  'UNE BALISE ÉCRITE PAR LE JOUEUR NE S''OUVRE PAS DANS LA FICHE');

select ok(
  fiche_en_bbcode('bbbb0034-0000-0000-0000-00000000000a') like '%&#91;color=red&#93;%',
  'elle se lit telle qu''elle a été écrite, en entités');

select ok(
  fiche_en_bbcode('bbbb0034-0000-0000-0000-00000000000a') like '%[center]%',
  'mais les balises de la fabrique, elles, sont bien des balises');

--  ── 3 · L'EMPREINTE DIT QUE ÇA A CHANGÉ ───────────────────────────
create temporary table publication_vu (quoi text primary key, valeur text);
grant insert on publication_vu to authenticated;

do $$
declare v_a jsonb; v_b jsonb;
begin
  set local role authenticated;
  perform set_config('request.jwt.claims',
    '{"sub":"aaaa0034-0000-0000-0000-00000000000a","email":"ombre@exemple.fr"}', true);

  v_a := fiche_a_publier('{"forumUserId": 34001}');
  insert into publication_vu values
    ('publie_avant', coalesce((v_a ->> 'publieLe'), '(jamais)')),
    ('a_change_avant', (v_a ->> 'aChange'));

  perform fiche_est_publiee('{"forumUserId": 34001, "sujetId": 1500, "messageId": 9001}');
  v_b := fiche_a_publier('{"forumUserId": 34001}');
  insert into publication_vu values
    ('a_change_apres', (v_b ->> 'aChange')),
    ('sujet', (v_b ->> 'sujetId'));

  reset role;
end $$;

--  Le texte change : on allume ce qui était éteint.
update fiche_champ set affiche = true
 where joueur_id = 'bbbb0034-0000-0000-0000-00000000000a' and champ = 'Orientation';

do $$
declare v jsonb;
begin
  set local role authenticated;
  perform set_config('request.jwt.claims',
    '{"sub":"aaaa0034-0000-0000-0000-00000000000a","email":"ombre@exemple.fr"}', true);
  v := fiche_a_publier('{"forumUserId": 34001}');
  insert into publication_vu values ('a_change_apres_retouche', (v ->> 'aChange'));
  reset role;
end $$;

select is((select valeur from publication_vu where quoi = 'publie_avant'), '(jamais)',
  'une fiche jamais publiée n''a pas de date');

select is((select valeur from publication_vu where quoi = 'a_change_avant'), 'false',
  'et elle ne se dit pas « modifiée »');

select is((select valeur from publication_vu where quoi = 'a_change_apres'), 'false',
  'JUSTE APRÈS LA PUBLICATION, RIEN N''A CHANGÉ');

select is((select valeur from publication_vu where quoi = 'sujet'), '1500',
  'et le sujet où elle est partie est retenu');

select is((select valeur from publication_vu where quoi = 'a_change_apres_retouche'), 'true',
  'ALLUMER UN CHAMP REND LA FICHE DIFFÉRENTE DE CELLE QUI EST PUBLIÉE');

--  ── 4 · ON NE DÉCLARE PAS « À JOUR » CE QUI NE L'EST PAS ──────────
--
--  L'empreinte est recalculée dans `fiche_est_publiee`, jamais reçue de
--  la page : sinon n'importe qui figerait une fiche périmée, et le
--  carnet cesserait de proposer la mise à jour.
select ok(
  (select count(*)::int from pg_policies
    where tablename = 'fiche' and cmd in ('INSERT', 'UPDATE')) = 0,
  'AUCUNE POLITIQUE N''OUVRE LA TABLE `fiche` À L''ÉCRITURE DIRECTE');

select ok(not has_table_privilege('anon', 'lien', 'select'),
  'et un visiteur non connecté ne lit pas les liens');

--  ── 5 · LA FABRIQUE N'EST PAS UNE PORTE ───────────────────────────
select ok(not has_function_privilege('anon', 'fiche_en_bbcode(uuid)', 'execute'),
  'LA FABRIQUE N''EST PAS OUVERTE À `anon` : elle prend un joueur en argument');

-- ════════════════════════════════════════════════════════════════════
--  RANGER (0035)
--
--  « Le navigateur grise ce qu'il peut, mais c'est la fonction
--  ranger() qui refuse — un appel bricolé ne passe pas. » Donc c'est
--  ici que ça se mesure, pas dans le harnais de la page.
-- ════════════════════════════════════════════════════════════════════

insert into joueur (id, forum_user_id, pseudo, auth_id, courriel) values
  ('bbbb0035-0000-0000-0000-00000000000a', 35001, 'Rangeuse',
   'aaaa0035-0000-0000-0000-00000000000a', 'rangeuse@exemple.fr'),
  ('bbbb0035-0000-0000-0000-00000000000b', 35002, 'Voisine',
   'aaaa0035-0000-0000-0000-00000000000b', 'voisine@exemple.fr');

insert into pokemon (id, joueur_id, espece_id, emplacement, position, boite_no) values
  ('cccc0035-0000-0000-0000-000000000001', 'bbbb0035-0000-0000-0000-00000000000a',
   37, 'equipe', 1, 1),
  ('cccc0035-0000-0000-0000-000000000002', 'bbbb0035-0000-0000-0000-00000000000a',
   37, 'equipe', 2, 1),
  ('cccc0035-0000-0000-0000-000000000003', 'bbbb0035-0000-0000-0000-00000000000a',
   37, 'boite', 5, 2),
  ('cccc0035-0000-0000-0000-000000000004', 'bbbb0035-0000-0000-0000-00000000000b',
   37, 'equipe', 1, 1);

--  Le troisième part en pension, à sa place dans l'équipe.
insert into pokemon (id, joueur_id, espece_id, emplacement, position, boite_no) values
  ('cccc0035-0000-0000-0000-000000000005', 'bbbb0035-0000-0000-0000-00000000000a',
   37, 'equipe', 3, 1);
insert into pension (joueur_id, pokemon_id, niveau_au_depot, tarif) values
  ('bbbb0035-0000-0000-0000-00000000000a',
   'cccc0035-0000-0000-0000-000000000005', 5, 100);

create temporary table range_vu (quoi text primary key, valeur text);
grant insert on range_vu to authenticated;

do $$
declare v text;
begin
  set local role authenticated;
  perform set_config('request.jwt.claims',
    '{"sub":"aaaa0035-0000-0000-0000-00000000000a","email":"rangeuse@exemple.fr"}', true);

  --  ── UN DÉPLACEMENT ORDINAIRE ──────────────────────────────────
  perform ranger('{"pokemonId":"cccc0035-0000-0000-0000-000000000003",
                   "emplacement":"equipe","position":4}'::jsonb);
  insert into range_vu values ('monte_en_equipe',
    (select emplacement || ':' || position from pokemon
      where id = 'cccc0035-0000-0000-0000-000000000003'));

  --  ── UNE CASE PRISE : ON ÉCHANGE ───────────────────────────────
  perform ranger('{"pokemonId":"cccc0035-0000-0000-0000-000000000001",
                   "emplacement":"equipe","position":2}'::jsonb);
  insert into range_vu values ('echange',
    (select string_agg(id::text || '=' || position::text, ',' order by position)
       from pokemon where id in ('cccc0035-0000-0000-0000-000000000001',
                                 'cccc0035-0000-0000-0000-000000000002')));

  --  ── CELUI EN PENSION NE BOUGE PAS ─────────────────────────────
  v := 'passé';
  begin
    perform ranger('{"pokemonId":"cccc0035-0000-0000-0000-000000000005",
                     "emplacement":"boite","boiteNo":1,"position":1}'::jsonb);
  exception when others then v := SQLERRM;
  end;
  insert into range_vu values ('pension_deplace', v);

  --  ── ET ON NE LE BOUSCULE PAS NON PLUS ─────────────────────────
  v := 'passé';
  begin
    perform ranger('{"pokemonId":"cccc0035-0000-0000-0000-000000000003",
                     "emplacement":"equipe","position":3}'::jsonb);
  exception when others then v := SQLERRM;
  end;
  insert into range_vu values ('pension_bousculee', v);

  --  ── LE POKÉMON DE QUELQU'UN D'AUTRE ───────────────────────────
  v := 'passé';
  begin
    perform ranger('{"pokemonId":"cccc0035-0000-0000-0000-000000000004",
                     "emplacement":"boite","boiteNo":1,"position":1}'::jsonb);
  exception when others then v := SQLERRM;
  end;
  insert into range_vu values ('pas_le_sien', v);

  --  ── DES DESTINATIONS QUI N'EXISTENT PAS ───────────────────────
  v := 'passé';
  begin
    perform ranger('{"pokemonId":"cccc0035-0000-0000-0000-000000000003",
                     "emplacement":"equipe","position":7}'::jsonb);
  exception when others then v := SQLERRM;
  end;
  insert into range_vu values ('septieme_place', v);

  v := 'passé';
  begin
    perform ranger('{"pokemonId":"cccc0035-0000-0000-0000-000000000003",
                     "emplacement":"boite","boiteNo":9,"position":1}'::jsonb);
  exception when others then v := SQLERRM;
  end;
  insert into range_vu values ('neuvieme_boite', v);

  v := 'passé';
  begin
    perform ranger('{"pokemonId":"cccc0035-0000-0000-0000-000000000003",
                     "emplacement":"pension","position":1}'::jsonb);
  exception when others then v := SQLERRM;
  end;
  insert into range_vu values ('pension_a_la_main', v);

  reset role;
end $$;

select is((select valeur from range_vu where quoi = 'monte_en_equipe'), 'equipe:4',
  'UN POKÉMON DE BOÎTE MONTE DANS L''ÉQUIPE');

select is((select valeur from range_vu where quoi = 'echange'),
  'cccc0035-0000-0000-0000-000000000002=1,cccc0035-0000-0000-0000-000000000001=2',
  'UNE CASE PRISE N''EST PAS UN REFUS : LES DEUX S''ÉCHANGENT');

select matches((select valeur from range_vu where quoi = 'pension_deplace'), 'EN_PENSION',
  'UN POKÉMON EN PENSION NE BOUGE PAS');

select matches((select valeur from range_vu where quoi = 'pension_bousculee'), 'CASE_EN_PENSION',
  'ET ON NE LE SORT PAS NON PLUS EN POSANT UN AUTRE SUR SA CASE');

select matches((select valeur from range_vu where quoi = 'pas_le_sien'), 'PAS_TON_POKEMON',
  'le Pokémon de quelqu''un d''autre ne se range pas');

select matches((select valeur from range_vu where quoi = 'septieme_place'), 'PLACE_HORS_EQUIPE',
  'il n''y a pas de septième place dans l''équipe');

select matches((select valeur from range_vu where quoi = 'neuvieme_boite'), 'BOITE_INCONNUE',
  'ni de neuvième boîte');

select matches((select valeur from range_vu where quoi = 'pension_a_la_main'), 'DESTINATION_INCONNUE',
  'ET ON NE SE MET PAS EN PENSION TOUT SEUL : ça se paie chez le gérant');

--  ── LE NAVIGATEUR N'A TOUJOURS PAS LES COLONNES ───────────────────
--
--  C'est ce qui rend `ranger()` incontournable : sans ces deux refus,
--  un appel PostgREST suffirait à se poser où l'on veut.
select ok(not has_column_privilege('authenticated', 'pokemon', 'position', 'update'),
  'LE NAVIGATEUR NE PEUT PAS ÉCRIRE `position` DIRECTEMENT');

select ok(not has_column_privilege('authenticated', 'pokemon', 'boite_no', 'update'),
  'ni `boite_no` — `ranger()` est le seul chemin');

select ok(not has_function_privilege('anon', 'ranger(jsonb)', 'execute'),
  'et un visiteur non connecté ne range rien');

-- ════════════════════════════════════════════════════════════════════
--  LA TABLE DES RP (0036)
--
--  « Mes RP n'est pas un onglet d'écriture : le joueur n'y contrôle que
--  la colonne “prévus” et l'ordre. » Ce qui décrit le sujet est l'état
--  du forum, pas une opinion — et ça se tient par le DROIT, pas par la
--  politesse de la page.
-- ════════════════════════════════════════════════════════════════════

insert into joueur (id, forum_user_id, pseudo, auth_id, courriel) values
  ('bbbb0036-0000-0000-0000-00000000000a', 36001, 'Scribe',
   'aaaa0036-0000-0000-0000-00000000000a', 'scribe@exemple.fr');

insert into rp (joueur_id, sujet_id, titre, forum_id, forum_nom, reponses,
                dernier_le, dernier_auteur, dernier_message, extrait) values
  ('bbbb0036-0000-0000-0000-00000000000a', 996, 'test', 36, 'Steppes Arides',
   3, '2026-10-28T13:34:00Z', 'Arceus', 15582, 'Le vent se lève sur les steppes.'),
  ('bbbb0036-0000-0000-0000-00000000000a', 977, 'Boutique de Rhode', 12,
   'Les commerces', 1204, '2026-11-04T09:05:00Z', 'Scribe', 15573, '');

insert into rp_participant (sujet_id, forum_user_id, pseudo) values
  (996, 36001, 'Scribe'),
  (996, 1, 'Arceus'),
  (977, 36001, 'Scribe');

create temporary table rp_vu (quoi text primary key, valeur text);
grant insert on rp_vu to authenticated;

do $$
declare v text;
begin
  set local role authenticated;
  perform set_config('request.jwt.claims',
    '{"sub":"aaaa0036-0000-0000-0000-00000000000a","email":"scribe@exemple.fr"}', true);

  insert into rp_vu values ('lus', (select count(*)::text from rp));

  --  ── CE QUI LUI APPARTIENT ─────────────────────────────────────
  update rp set etat = 'en-pause', ordre = 5 where sujet_id = 996;
  insert into rp_vu values ('prevu',
    (select etat || '/' || ordre::text from rp where sujet_id = 996));

  --  ── ET CE QUI NE LUI APPARTIENT PAS ───────────────────────────
  v := 'passé';
  begin
    update rp set titre = 'Je me réécris l''histoire' where sujet_id = 996;
  exception when insufficient_privilege then v := 'refusé';
  end;
  insert into rp_vu values ('titre', v);

  v := 'passé';
  begin
    update rp set dernier_le = now() where sujet_id = 996;
  exception when insufficient_privilege then v := 'refusé';
  end;
  insert into rp_vu values ('date', v);

  --  ── ON NE S'AJOUTE PAS UN RP ──────────────────────────────────
  --  ── ON AJOUTE UNE CARTE « PRÉVUE », ET RIEN D'AUTRE ───────────
  v := 'passé';
  begin
    insert into rp (joueur_id, sujet_id, titre, etat)
      values ('bbbb0036-0000-0000-0000-00000000000a', 1, 'Un RP que je n''ai pas joué',
              'en-cours');
  exception when insufficient_privilege or check_violation then v := 'refusé';
  end;
  insert into rp_vu values ('ajout', v);

  v := 'refusé';
  begin
    insert into rp (joueur_id, sujet_id, titre, etat)
      values ('bbbb0036-0000-0000-0000-00000000000a', 2, 'Un RP convenu', 'prevu');
    v := 'passé';
  exception when insufficient_privilege or check_violation then v := 'refusé';
  end;
  insert into rp_vu values ('ajout_prevu', v);

  --  ── LES PARTICIPANTS SONT AU SERVEUR ──────────────────────────
  v := 'passé';
  begin
    perform count(*) from rp_participant;
  exception when insufficient_privilege then v := 'refusé';
  end;
  insert into rp_vu values ('participants', v);

  --  ── MAIS LES RP COMMUNS SE CALCULENT ──────────────────────────
  insert into rp_vu values ('communs',
    (rp_communs('{"forumUserId": 36001, "cibleForumId": 1}'))::text);
  insert into rp_vu values ('communs_inconnu',
    (rp_communs('{"forumUserId": 36001, "cibleForumId": 999}'))::text);
  insert into rp_vu values ('communs_pas_le_sien',
    (rp_communs('{"forumUserId": 1, "cibleForumId": 36001}'))::text);

  reset role;
end $$;

select is((select valeur from rp_vu where quoi = 'lus'), '2',
  'le joueur lit ses deux RP');

select is((select valeur from rp_vu where quoi = 'prevu'), 'en-pause/5',
  'L''ÉTAT ET L''ORDRE LUI APPARTIENNENT : il les écrit');

select is((select valeur from rp_vu where quoi = 'titre'), 'refusé',
  'MAIS PAS LE TITRE — c''est l''état du forum, pas une opinion');

select is((select valeur from rp_vu where quoi = 'date'), 'refusé',
  'ni la date du dernier message');

select is((select valeur from rp_vu where quoi = 'ajout'), 'refusé',
  'ON NE S''AJOUTE PAS UN RP « EN COURS » qu''on n''a pas joué');

select is((select valeur from rp_vu where quoi = 'ajout_prevu'), 'passé',
  'MAIS ON AJOUTE UNE CARTE « PRÉVUE » : une intention, pas une affirmation');

select is((select valeur from rp_vu where quoi = 'participants'), 'refusé',
  'la table des participants est au serveur, pas au joueur');

select ok(
  (select valeur from rp_vu where quoi = 'communs') like '%996%',
  'LES RP COMMUNS SE CALCULENT : le sujet où les deux ont écrit');

select ok(
  (select valeur from rp_vu where quoi = 'communs') not like '%977%',
  'et celui où la cible n''a pas écrit n''en est pas');

select is((select valeur from rp_vu where quoi = 'communs_inconnu'), '[]',
  'une cible inconnue rend une liste vide');

select is((select valeur from rp_vu where quoi = 'communs_pas_le_sien'), '[]',
  'ET DEMANDER LES RP DE QUELQU''UN D''AUTRE REND VIDE, pas un refus : on ne renseigne pas sur l''existence d''un personnage');

select ok(not has_table_privilege('anon', 'rp', 'select'),
  'un visiteur non connecté ne lit pas les RP');

--  ── CE QUE LA RELÈVE ÉCRIT, ET CE QU'ELLE NE TOUCHE PAS ───────────
--
--  Tout le contrat de la table tient là : le serveur décrit, le joueur
--  annote. Une relève qui écrase « prévu » efface une note que
--  personne ne sait reconstituer.

update rp set etat = 'en-pause', ordre = 9 where sujet_id = 996;

select is(
  (relever_les_rp(jsonb_build_object(
    'joueurId', 'bbbb0036-0000-0000-0000-00000000000a',
    'sujets', jsonb_build_array(
      jsonb_build_object('sujetId', 996, 'titre', 'test (renommé)',
                         'reponses', 7, 'dernierLe', '2026-11-04T12:00:00Z',
                         'dernierAuteur', 'Scribe', 'dernierMessage', 15999,
                         'participants', jsonb_build_array(
                           jsonb_build_object('id', 36001, 'pseudo', 'Scribe'),
                           jsonb_build_object('id', 42, 'pseudo', 'Quelqu''un'))),
      jsonb_build_object('sujetId', 1200, 'titre', 'Un sujet tout neuf')
    )
  )) ->> 'ecrits')::integer,
  2,
  'la relève écrit les deux sujets qu''elle a vus');

select results_eq(
  $$select titre, reponses, etat, ordre from rp where sujet_id = 996$$,
  $$values ('test (renommé)', 7, 'en-pause', 9::smallint)$$,
  'ELLE MET À JOUR CE QUI EST À ELLE, ET LAISSE L''ÉTAT ET L''ORDRE');

select is(
  (select count(*)::int from rp where joueur_id = 'bbbb0036-0000-0000-0000-00000000000a'),
  3,
  'LE SUJET QUI N''EST PLUS DANS LA RECHERCHE S''EN VA — restent les deux vus et la carte prévue');

select is(
  (select count(*)::int from rp_participant where sujet_id = 996),
  3,
  'et les participants s''ajoutent sans écraser ceux d''avant');

--  Un sujet marqué « prévu » ne part pas, même absent de la recherche.
update rp set etat = 'prevu' where sujet_id = 1200;
select lives_ok(
  $$select relever_les_rp(jsonb_build_object(
      'joueurId', 'bbbb0036-0000-0000-0000-00000000000a',
      'sujets', '[]'::jsonb))$$,
  'une relève qui ne trouve rien ne lève pas');

select is(
  (select count(*)::int from rp where joueur_id = 'bbbb0036-0000-0000-0000-00000000000a'),
  3,
  'UN SUJET MARQUÉ « PRÉVU » SURVIT À UNE RELÈVE QUI NE LE VOIT PAS');

select is((select count(*)::int from rp where joueur_id = 'bbbb0036-0000-0000-0000-00000000000a' and etat = 'en-pause'),
  1,
  'et celui qu''elle a mis en pause aussi : la relève ne connaît pas ces mots-là');

select ok(not has_function_privilege('authenticated', 'relever_les_rp(jsonb)', 'execute'),
  'et un joueur ne relève pas ses propres RP : c''est le travail du serveur');

-- ════════════════════════════════════════════════════════════════════
--  LES LIENS À PROPOSER (0038)
--
--  Le bloc « On te propose des liens » de l'onglet « Mes liens » n'a
--  jamais rien montré, et la page disait pourquoi : « ça demande la
--  relève des sujets ». Elle est là. Ce qui manquait était la question
--  d'avant `rp_communs` — non pas « quels sujets avec cette personne »
--  mais « avec qui ai-je joué ».
-- ════════════════════════════════════════════════════════════════════

--  SA PROPRE FIGURATION, ET C'EST UNE LEÇON PAYÉE ICI : le bloc de
--  `0036` juste au-dessus fait tourner `relever_les_rp` avec une liste
--  vide, qui EFFACE les sujets « en-cours ». Hériter de sa figuration
--  faisait compter deux sujets partagés là où on en avait inséré trois,
--  et le test accusait la fonction. Un jeu de données qu'un autre test
--  remanie n'est pas une figuration, c'est un piège.
insert into joueur (id, forum_user_id, pseudo, auth_id, courriel) values
  ('bbbb0038-0000-0000-0000-00000000000a', 38001, 'Copiste',
   'aaaa0038-0000-0000-0000-00000000000a', 'copiste@exemple.fr');

--  ET UN SECOND JOUEUR QUI A, LUI AUSSI, UN CARNET ET DES RP.
--
--  Sans lui, « demander les partenaires de quelqu'un d'autre rend une
--  liste vide » passait pour la MAUVAISE RAISON : le membre visé n'avait
--  pas de ligne dans `joueur`, donc la fonction rendait `[]` même sans
--  son filtre de session. Retirer le `mes_joueurs()` ne cassait aucun
--  test — mesuré en le retirant exprès. Il faut un joueur dont il y
--  aurait réellement quelque chose à voler.
insert into joueur (id, forum_user_id, pseudo, auth_id, courriel) values
  ('bbbb0038-0000-0000-0000-00000000000b', 38002, 'Enlumineur',
   'aaaa0038-0000-0000-0000-00000000000b', 'enlumineur@exemple.fr');

insert into rp (joueur_id, sujet_id, titre, forum_id, forum_nom, reponses,
                dernier_le, dernier_auteur, dernier_message, extrait) values
  ('bbbb0038-0000-0000-0000-00000000000a', 1996, 'La brume ne lève pas', 34,
   'Montagnes Embrumées', 6, '2026-10-28T13:34:00Z', 'Arceus', 15600, ''),
  ('bbbb0038-0000-0000-0000-00000000000a', 1997, 'Un café, deux silences', 36,
   'Steppes Arides', 2, '2026-11-01T08:00:00Z', 'Copiste', 15601, ''),
  ('bbbb0038-0000-0000-0000-00000000000a', 1998, 'Le vent se lève', 34,
   'Montagnes Embrumées', 9, '2026-11-04T09:05:00Z', 'Lysandra', 15602, ''),
  --  Le sujet de l'Enlumineur, avec un partenaire que le Copiste n'a
  --  jamais croisé : c'est ce que le filtre de session doit refuser de
  --  montrer au Copiste.
  ('bbbb0038-0000-0000-0000-00000000000b', 1999, 'Les ors et les encres', 36,
   'Steppes Arides', 4, '2026-11-02T10:00:00Z', 'Vélin', 15603, '');

--  Arceus sur trois sujets, Lysandra sur deux, Murphy sur un.
insert into rp_participant (sujet_id, forum_user_id, pseudo, vu_le) values
  (1996, 38001, 'Copiste',  '2026-10-28T13:34:00Z'),
  (1997, 38001, 'Copiste',  '2026-11-01T08:00:00Z'),
  (1998, 38001, 'Copiste',  '2026-11-04T09:05:00Z'),
  (1996, 1,     'Arceus',   '2026-10-28T13:34:00Z'),
  (1997, 1,     'Arceus',   '2026-11-01T08:00:00Z'),
  (1998, 1,     'Arceus',   '2026-11-04T09:05:00Z'),
  (1996, 42,    'Murphy',   '2026-10-28T13:34:00Z'),
  --  LE MÊME MEMBRE SOUS DEUX PSEUDOS : la relève a vu « Lysandre »
  --  avant, « Lysandra » après. C'est le second qui doit sortir, et
  --  `max(pseudo)` rendrait le premier — « L » vient avant « s ».
  (1997, 77,    'Lysandre', '2026-10-01T08:00:00Z'),
  (1998, 77,    'Lysandra', '2026-11-04T09:05:00Z'),
  (1999, 38002, 'Enlumineur', '2026-11-02T10:00:00Z'),
  (1999, 55,    'Vélin',      '2026-11-02T10:00:00Z');

--  ET UNE CARTE DÉJÀ ÉCRITE : Murphy est lié, donc il n'est plus une
--  proposition.
insert into lien (joueur_id, cible_forum_id, cible_pseudo, court) values
  ('bbbb0038-0000-0000-0000-00000000000a', 42, 'Murphy', 'On s''est croisés');

create temporary table propose_vu (quoi text primary key, valeur text);
grant insert on propose_vu to authenticated;

do $$
begin
  set local role authenticated;
  perform set_config('request.jwt.claims',
    '{"sub":"aaaa0038-0000-0000-0000-00000000000a","email":"copiste@exemple.fr"}', true);

  insert into propose_vu values ('liste',
    (liens_a_proposer('{"forumUserId": 38001}'))::text);
  --  L'ENLUMINEUR A UN CARNET, DES RP ET UN PARTENAIRE. Demander SES
  --  partenaires depuis la session du Copiste doit rendre une liste
  --  vide — pas parce qu'il n'y a rien à voir, mais parce que la
  --  fonction refuse.
  insert into propose_vu values ('pas_le_sien',
    (liens_a_proposer('{"forumUserId": 38002}'))::text);
  insert into propose_vu values ('inconnu',
    (liens_a_proposer('{"forumUserId": 999999}'))::text);

  reset role;

  --  ET LA MÊME QUESTION DEPUIS LA SESSION DE L'ENLUMINEUR, qui doit,
  --  elle, rendre son partenaire. C'est ce qui prouve que le refus
  --  ci-dessus est un refus, et pas un vide.
  set local role authenticated;
  perform set_config('request.jwt.claims',
    '{"sub":"aaaa0038-0000-0000-0000-00000000000b","email":"enlumineur@exemple.fr"}', true);
  insert into propose_vu values ('chez_lui',
    (liens_a_proposer('{"forumUserId": 38002}'))::text);
  reset role;
end $$;

select is(
  (select jsonb_array_length((select valeur from propose_vu where quoi = 'liste')::jsonb)),
  2,
  'ON PROPOSE ARCEUS ET LYSANDRA, PAS MURPHY : il a déjà sa carte de lien');

select is(
  (select p ->> 'pseudo' from jsonb_array_elements(
     (select valeur from propose_vu where quoi = 'liste')::jsonb) p limit 1),
  'Arceus',
  'ET LE PLUS NOURRI PASSE DEVANT, PAS LE PLUS RÉCENT : trois sujets '
  'partagés contre deux, alors que Lysandra a la date la plus fraîche');

select is(
  (select p ->> 'ensemble' from jsonb_array_elements(
     (select valeur from propose_vu where quoi = 'liste')::jsonb) p
    where p ->> 'pseudo' = 'Arceus'),
  '3',
  'le nombre de RP partagés est celui des sujets, pas des messages');

select is(
  (select count(*)::int from jsonb_array_elements(
     (select valeur from propose_vu where quoi = 'liste')::jsonb) p
    where (p ->> 'forumUserId')::int = 38001),
  0,
  'on ne se propose pas à soi-même');

select is(
  (select count(*)::int from jsonb_array_elements(
     (select valeur from propose_vu where quoi = 'liste')::jsonb) p
    where p ->> 'pseudo' = 'Lysandra'),
  1,
  'LE PSEUDO EST LE DERNIER VU, pas le plus grand par ordre alphabétique : '
  '« Lysandra » a remplacé « Lysandre », et max(pseudo) aurait rendu l''ancien');

select is((select valeur from propose_vu where quoi = 'pas_le_sien'), '[]',
  'DEMANDER LES PARTENAIRES DE QUELQU''UN D''AUTRE REND UNE LISTE VIDE : '
  'le `mes_joueurs()` est dans la fonction, pas dans la page — et '
  'l''Enlumineur a bien un partenaire à voler, sinon ce test passerait '
  'sans rien garantir');

--  LA PREUVE QUE LE TEST CI-DESSUS MORD : il y a quelque chose à voir.
select is(
  (select (p ->> 'pseudo') from jsonb_array_elements(
     (select valeur from propose_vu where quoi = 'chez_lui')::jsonb) p),
  'Vélin',
  'l''Enlumineur, lui, se voit bien proposer Vélin — donc le vide rendu '
  'au Copiste est un REFUS, pas une absence');

select is((select valeur from propose_vu where quoi = 'inconnu'), '[]',
  'et un membre qui n''existe pas aussi');

select is((select liens_proposes_au_plus()), 12,
  'douze propositions au plus : au-delà ce n''est plus une proposition, '
  'c''est le bottin');

select ok(not has_function_privilege('anon', 'liens_a_proposer(jsonb)', 'execute'),
  'un visiteur non connecté ne voit avec qui personne a joué');

select ok(not has_table_privilege('authenticated', 'rp_participant', 'select'),
  'ET LA TABLE RESTE FERMÉE : c''est la fonction qui ouvre, et elle filtre');


-- ════════════════════════════════════════════════════════════════════
--  VALIDER ENREGISTRE L'ADRESSE (0041)
--
--  La 0028 créait le joueur ; la 0029 a fait de `courriel` la seule
--  chose qui autorise une liaison. Personne n'a rebranché la première
--  sur la seconde : valider écrivait une ligne sans adresse, et aucune
--  liaison ne pouvait aboutir. Trouvé par une joueuse bloquée le
--  16 novembre, pas par un test — d'où ceux-ci.
-- ════════════════════════════════════════════════════════════════════

select is(
  (valider_le_personnage(
    '{"forumUserId":9001,"pseudo":"Essai Un","groupe":"doux",
      "courriel":"  ESSAI@Exemple.FR "}'::jsonb) ->> 'peutSeLier'),
  'true',
  'VALIDER AVEC UNE ADRESSE DIT QUE LA LIAISON POURRA SE FAIRE'
);

select is(
  (select courriel from joueur where forum_user_id = 9001),
  'essai@exemple.fr',
  'et l''adresse est rangée en minuscules, sans espaces — comme la cherche lier_mon_personnage'
);

--  LA COMPARAISON DES DEUX CÔTÉS, qui est tout l'enjeu : une
--  normalisation ici et une autre là-bas, et le rapprochement ne vaut
--  rien.
select ok(
  exists(select 1 from joueur
          where lower(courriel) = lower(trim('  ESSAI@Exemple.FR '))
            and forum_user_id = 9001),
  'ET LE RAPPROCHEMENT TOMBE JUSTE : lower(trim(…)) des deux côtés'
);

select is(
  (valider_le_personnage(
    '{"forumUserId":9001,"pseudo":"Essai Deux","groupe":"brave"}'::jsonb)
     ->> 'peutSeLier'),
  'true',
  'revalider sans adresse ne la perd pas'
);

select is(
  (select courriel || ' / ' || pseudo from joueur where forum_user_id = 9001),
  'essai@exemple.fr / Essai Deux',
  'l''adresse reste, le pseudo change — on corrige un pseudo sans retaper une adresse'
);

select is(
  (valider_le_personnage(
    '{"forumUserId":9002,"pseudo":"Sans Adresse","groupe":"malin"}'::jsonb)
     ->> 'peutSeLier'),
  'false',
  'SANS ADRESSE, LA RÉPONSE LE DIT TOUT DE SUITE — et pas trois jours plus tard'
);

select ok(
  exists(select 1 from joueur_sans_adresse where forum_user_id = 9002)
    and not exists(select 1 from joueur_sans_adresse where forum_user_id = 9001),
  'et la vue nomme ceux qui sont bloqués, eux seuls'
);

-- ════════════════════════════════════════════════════════════════════
--  LES PSEUDOS SE RELISENT (0042)
--
--  « J'ai découvert "personne n'a écrit" alors qu'Arceus a posté après
--  moi », 13 novembre. `joueur.pseudo` était écrit une fois à la
--  liaison et plus jamais relu ; la recherche du forum, elle, ne
--  connaît que le pseudo d'aujourd'hui.
-- ════════════════════════════════════════════════════════════════════

insert into joueur (forum_user_id, pseudo, groupe, courriel)
values (9101, 'Compte de test', 'doux', 'ren1@exemple.fr'),
       (9102, 'Ombre', 'brave', 'ren2@exemple.fr');

select is(
  renommer_les_joueurs('{"changements":[
     {"forumUserId":9101,"pseudo":"Jake Dalziel"}]}'::jsonb),
  1,
  'un pseudo changé est renommé, et compté'
);

select is(
  (select pseudo from joueur where forum_user_id = 9101),
  'Jake Dalziel',
  'et c''est bien le nouveau nom qui est rangé'
);

select is(
  renommer_les_joueurs('{"changements":[
     {"forumUserId":9101,"pseudo":"Jake Dalziel"}]}'::jsonb),
  0,
  'CE QUI N''A PAS CHANGÉ N''EST PAS COMPTÉ — sinon le journal annoncerait trente renommages par heure'
);

select is(
  renommer_les_joueurs('{"changements":[
     {"forumUserId":9999,"pseudo":"Personne"}]}'::jsonb),
  0,
  'ELLE NE CRÉE PERSONNE : un numéro inconnu ne donne pas une ligne de plus'
);

select is(
  (select count(*)::integer from joueur where forum_user_id = 9999),
  0,
  'et la table ne porte toujours pas ce numéro'
);

select is(
  renommer_les_joueurs('{"changements":[
     {"forumUserId":9102,"pseudo":"   "}]}'::jsonb),
  0,
  'ELLE N''ÉCRIT PAS UN NOM VIDE — mieux vaut un nom vieux d''une heure'
);

select is(
  (select pseudo from joueur where forum_user_id = 9102),
  'Ombre',
  'et le nom d''avant est intact'
);

select is(
  renommer_les_joueurs('{"changements":[
     {"forumUserId":9102,"pseudo":"  Ombre Pâle  "}]}'::jsonb),
  1,
  'les espaces autour du nom sont rognés'
);

select is(
  (select pseudo from joueur where forum_user_id = 9102),
  'Ombre Pâle',
  'et le nom rangé est le nom rogné'
);

select is(
  renommer_les_joueurs('{"changements":[
     {"forumUserId":9101,"pseudo":"Premier"},
     {"forumUserId":9101,"pseudo":"Second"}]}'::jsonb),
  1,
  'deux lignes pour le même numéro ne comptent qu''un renommage'
);

select is(
  (select pseudo from joueur where forum_user_id = 9101),
  'Second',
  'ET C''EST LE DERNIER NOMMÉ QUI GAGNE, comme dans le lecteur — sans le rang, la ligne retenue est arbitraire'
);

select is(
  renommer_les_joueurs('{}'::jsonb),
  0,
  'une liste absente n''est pas une erreur : c''est le passage ordinaire'
);

select is(
  renommer_les_joueurs('{"changements":[]}'::jsonb),
  0,
  'et une liste vide non plus'
);

select is(
  renommer_les_joueurs('{"changements":"pas une liste"}'::jsonb),
  0,
  'ni une liste qui n''en est pas une'
);

select ok(
  not has_function_privilege('anon', 'renommer_les_joueurs(jsonb)', 'execute')
    and not has_function_privilege('authenticated', 'renommer_les_joueurs(jsonb)', 'execute')
    and has_function_privilege('service_role', 'renommer_les_joueurs(jsonb)', 'execute'),
  'RENOMMER EST RÉSERVÉ À LA RELÈVE : un joueur ne renomme pas les autres'
);

-- ════════════════════════════════════════════════════════════════════
--  0043 · LA DOTATION DE DÉPART
--
--  « Personne n'aura une équipe vide : à la validation, il reçoit son
--  premier pokémon », 17 novembre. Le combat se joue entre le PREMIER
--  POKÉMON DE L'ÉQUIPE et le sauvage : si la dotation ment, le moteur
--  de combat a besoin d'un cas « équipe vide » qui ne devrait pas
--  exister.
--
--  CE QUI EST GARDÉ ICI, c'est surtout qu'on ne dote QU'UNE FOIS.
--  `valider_le_personnage` se relance — c'est comme ça qu'on corrige
--  un groupe — et sans garde chaque relance rendrait cinq potions et
--  mille pokédollars de plus.
-- ════════════════════════════════════════════════════════════════════

--  Bulbizarre est 1, et il est de stade 1. Herbizarre est 2, stade 2.
select lives_ok(
  $$ select valider_le_personnage(
       '{"forumUserId": 9101, "pseudo": "Dotée", "groupe": "doux",
         "courriel": "d@exemple.fr", "starter": 1}'::jsonb) $$,
  'LA VALIDATION AVEC UN STARTER PASSE'
);

select is(
  (select count(*)::int from pokemon p join joueur j on j.id = p.joueur_id
    where j.forum_user_id = 9101 and p.emplacement = 'equipe' and p.position = 1),
  1,
  'LE STARTER EST EN PREMIÈRE PLACE DE L''ÉQUIPE — c''est lui qui combattra'
);

select is(
  (select p.espece_id from pokemon p join joueur j on j.id = p.joueur_id
    where j.forum_user_id = 9101),
  1,
  'et c''est bien l''espèce demandée'
);

select is(
  (select quantite from sac s join joueur j on j.id = s.joueur_id
    where j.forum_user_id = 9101 and s.objet_id = 990001),
  5,
  'cinq Poké Ball dans le sac'
);

select is(
  (select quantite from sac s join joueur j on j.id = s.joueur_id
    where j.forum_user_id = 9101 and s.objet_id = 990020),
  5,
  'et cinq Potions'
);

select is(
  (select pokedollars from joueur where forum_user_id = 9101),
  1000,
  'mille pokédollars'
);

select ok(
  (select attrape_le is not null from pokedex x join joueur j on j.id = x.joueur_id
    where j.forum_user_id = 9101 and x.espece_id = 1),
  'LE STARTER EST AU POKÉDEX, ATTRAPÉ : il est à lui, le cacher ferait mentir son premier chiffre'
);

--  ── LA GARDE QUI COMPTE ──────────────────────────────────────────
select lives_ok(
  $$ select valider_le_personnage(
       '{"forumUserId": 9101, "pseudo": "Dotée", "groupe": "brave",
         "starter": 1}'::jsonb) $$,
  'on peut revalider — c''est comme ça qu''on corrige un groupe'
);

select is(
  (select count(*)::int from pokemon p join joueur j on j.id = p.joueur_id
    where j.forum_user_id = 9101),
  1,
  'ON NE DOTE QU''UNE FOIS : pas de second starter'
);

select is(
  (select quantite from sac s join joueur j on j.id = s.joueur_id
    where j.forum_user_id = 9101 and s.objet_id = 990020),
  5,
  'ni cinq potions de plus'
);

select is(
  (select pokedollars from joueur where forum_user_id = 9101),
  1000,
  'ni mille pokédollars de plus'
);

--  ── SANS STARTER, PAS DE DOTATION DU TOUT ────────────────────────
--
--  Sinon `dote_le` serait posée et le pokémon n'arriverait JAMAIS.
select is(
  (select valider_le_personnage(
     '{"forumUserId": 9102, "pseudo": "SansStarter", "groupe": "doux"}'::jsonb)
   ->>'dote'),
  'false',
  'SANS STARTER, LA DOTATION N''A PAS LIEU'
);

select is(
  (select pokedollars from joueur where forum_user_id = 9102),
  0,
  'et rien n''est donné — ni argent, ni sac'
);

select is(
  (select valider_le_personnage(
     '{"forumUserId": 9102, "starter": 1}'::jsonb)->>'dote'),
  'true',
  'ET ELLE PEUT AVOIR LIEU PLUS TARD : la date était restée nulle'
);

--  ── CE QUE LA BASE PEUT GARANTIR, ET ELLE SEULE ──────────────────
--
--  La LISTE des starters est éditoriale et bougera. Ce qui est gardé
--  ici est qu'un starter existe et qu'il est une forme de BASE : un
--  Herbizarre de départ est une faute de frappe, pas un choix.
select throws_ok(
  $$ select valider_le_personnage(
       '{"forumUserId": 9103, "pseudo": "Faute", "starter": 2}'::jsonb) $$,
  'P0001',
  'STARTER_PAS_UNE_FORME_DE_BASE',
  'UN STARTER QUI N''EST PAS UNE FORME DE BASE EST REFUSÉ'
);

select throws_ok(
  $$ select valider_le_personnage(
       '{"forumUserId": 9104, "pseudo": "Fantome", "starter": 999999}'::jsonb) $$,
  'P0001',
  'STARTER_INCONNU',
  'et une espèce qui n''existe pas aussi'
);

-- ════════════════════════════════════════════════════════════════════
--  0044 · LES QUATRE CAPACITÉS
--
--  « Les attaques : oui, les quatre capacités du pokémon. » Un starter
--  sans capacité est un starter qui ne peut pas se battre, et c'est
--  lui qui combat — le combat se joue avec le premier de l'équipe.
-- ════════════════════════════════════════════════════════════════════

select is(
  array_length(capacites_de_depart(1, 5::smallint), 1),
  2,
  'BULBIZARRE AU NIVEAU 5 CONNAÎT CE QU''IL A APPRIS, et rien de plus'
);

select is(
  array_length(capacites_de_depart(1, 60::smallint), 1),
  4,
  'QUATRE AU MAXIMUM, jamais cinq — c''est la règle du jeu'
);

--  Magicarpe n'apprend rien d'offensif avant le niveau 15.
select is(
  array_length(capacites_de_depart(129, 5::smallint), 1),
  1,
  'UNE ESPÈCE QUI N''A RIEN APPRIS À SON NIVEAU reçoit quand même de quoi attaquer'
);

select ok(
  (select bool_and(exists (select 1 from capacite c where c.id = x))
     from unnest(capacites_de_depart(1, 60::smallint)) as x),
  'et les quatre existent vraiment — un identifiant inventé se verrait en plein combat'
);

--  ── LA DOTATION LES POSE ─────────────────────────────────────────
select lives_ok(
  $$ select valider_le_personnage(
       '{"forumUserId": 9110, "pseudo": "Capacitée", "groupe": "brave",
         "starter": 4}'::jsonb) $$,
  'on dote un personnage avec Salamèche'
);

select ok(
  ((select valider_le_personnage('{"forumUserId": 9111, "pseudo": "Deux",
      "groupe": "brave", "starter": 7}'::jsonb)->>'capacites')::int) > 0,
  'LA RÉPONSE DIT COMBIEN LE STARTER EN CONNAÎT — zéro voudrait dire qu''il ne peut pas se battre'
);

select ok(
  (select count(*) from pokemon_capacite pc
     join pokemon p on p.id = pc.pokemon_id
     join joueur j on j.id = p.joueur_id
    where j.forum_user_id = 9110) between 1 and 4,
  'LE STARTER A SES CAPACITÉS, une à quatre'
);

select is(
  (select min(pc.position)::int from pokemon_capacite pc
     join pokemon p on p.id = pc.pokemon_id
     join joueur j on j.id = p.joueur_id
    where j.forum_user_id = 9110),
  1,
  'et elles commencent à la première position'
);

--  ── ON REMPLACE, ON N'AJOUTE PAS ─────────────────────────────────
--
--  `poser_les_capacites` sera rappelée à chaque niveau gagné. Appelée
--  deux fois, elle doit laisser QUATRE capacités, pas huit.
select is(
  (select poser_les_capacites(p.id) from pokemon p
     join joueur j on j.id = p.joueur_id where j.forum_user_id = 9110),
  (select count(*)::int from pokemon_capacite pc
     join pokemon p on p.id = pc.pokemon_id
     join joueur j on j.id = p.joueur_id where j.forum_user_id = 9110),
  'LA POSE EST IDEMPOTENTE : rappelée, elle laisse le même nombre'
);

select throws_ok(
  $$ select poser_les_capacites('00000000-0000-0000-0000-000000000000'::uuid) $$,
  'P0001',
  'POKEMON_INCONNU',
  'et elle refuse un pokémon qui n''existe pas'
);

--  ── CE QUE LA BASE GARANTIT ──────────────────────────────────────
--  SUR UN POKÉMON NEUF, sans capacité : viser la position 1 d'un
--  starter déjà doté ferait tomber la clé primaire avant la clé
--  étrangère, et le test dirait vrai pour la mauvaise raison.
insert into pokemon (joueur_id, espece_id, emplacement)
select j.id, 7, 'boite' from joueur j where j.forum_user_id = 9111;

select throws_ok(
  $$ insert into pokemon_capacite (pokemon_id, position, capacite_id)
     select p.id, 1, 999999 from pokemon p
       join joueur j on j.id = p.joueur_id
      where j.forum_user_id = 9111 and p.emplacement = 'boite' $$,
  '23503',
  null,
  'UNE CAPACITÉ QUI N''EXISTE PAS EST REFUSÉE PAR LA BASE — pas par le navigateur'
);

select throws_ok(
  $$ insert into pokemon_capacite (pokemon_id, position, capacite_id)
     select p.id, 5, 33 from pokemon p
       join joueur j on j.id = p.joueur_id
      where j.forum_user_id = 9111 and p.emplacement = 'boite' $$,
  '23514',
  null,
  'et une cinquième position aussi'
);

select ok(
  has_table_privilege('anon', 'capacite', 'select')
    and has_table_privilege('anon', 'espece_capacite', 'select'),
  'LES DEUX TABLES DE RÉFÉRENCE SE LISENT : le carnet affiche les capacités'
);

-- ════════════════════════════════════════════════════════════════════
--  0045 · L'ATTAQUE ET LA DÉFENSE DE BASE
--
--  La formule n'est pas inventée ici : elle est relevée contre le
--  sujet t1002 des champions, le 6 novembre. Les chiffres testés plus
--  bas sont CEUX DU FORUM, pas ceux d'un calcul refait à côté — c'est
--  la seule façon qu'un jour où la formule bouge, le test rougisse.
-- ════════════════════════════════════════════════════════════════════

select has_column('espece', 'att_base', 'L''ESPÈCE PORTE SON ATTAQUE DE BASE — sans elle, aucun dégât ne se calcule');
select has_column('espece', 'def_base', 'et sa défense');

select is(
  pv_au_niveau(45::smallint, 5::smallint),
  19,
  'PV AU NIVEAU 5 D''UN BULBIZARRE : ⌊2 × 45 × 5 / 100⌋ + 5 + 10 = 19'
);

select is(
  stat_au_niveau(49::smallint, 5::smallint),
  9,
  'et son attaque : ⌊2 × 49 × 5 / 100⌋ + 5 = 9'
);

--  UN CHIFFRE DE LA PAGE DES CHAMPIONS, ET PAS UN AUTRE. Drattak du
--  défi dragon, niveau 70, base 95 : l'annexe 06 affiche 213 PV et
--  194 d'attaque, et les deux sortent de ces mêmes fonctions côté
--  Python. Si cette assertion tombe, ce n'est pas le test qui a
--  tort — c'est que la base et la page ne disent plus la même chose
--  au même joueur.
select is(
  pv_au_niveau(95::smallint, 70::smallint),
  213,
  'LA BASE ET LA PAGE S''ACCORDENT : Drattak niveau 70 a 213 PV des deux côtés'
);

select is(
  stat_au_niveau(135::smallint, 70::smallint),
  194,
  'et 194 d''attaque'
);

select is(
  pv_au_niveau(0::smallint, 1::smallint),
  11,
  'AU PLUS BAS, ON NE TOMBE PAS À ZÉRO : 11 PV, jamais un combat qui finit avant de commencer'
);

insert into espece (id, nom_fr, types, stade, pv_base, att_base, def_base)
values (999004, 'Essai des bases', array['normal'], 1, 50, 60, 70);

select is(
  (select att_base from espece where id = 999004)::integer,
  60,
  'LA COLONNE SE REMPLIT, elle n''a pas qu''un défaut'
);

select ok(
  (select count(*) from espece where att_base = 45 and def_base = 45 and id < 100000) < 20,
  'ET LE SEED EST PASSÉ : presque personne ne reste sur la valeur par défaut'
);

-- ════════════════════════════════════════════════════════════════════
--  0046 · LE COMBAT DANS LE SUJET
--
--  Le joueur 9110 a été doté d'un Salamèche plus haut ; c'est lui qui
--  se bat. On ne recrée pas de personnage : un test qui se fabrique
--  son propre monde ne prouve rien sur celui des autres.
-- ════════════════════════════════════════════════════════════════════

select has_table('combat', 'LE COMBAT A SA TABLE');

--  Ponyta (77) niveau 10, sur le sujet 996 — le sujet d'essai de
--  Callista, et la rencontre qu'elle a vue le 17 novembre.
select ok(
  (select (ouvrir_un_combat(jsonb_build_object(
      'sujetId', 996, 'messageId', 15601,
      'joueurId', j.id, 'especeId', 77, 'niveau', 10))->>'ouvert')::boolean
     from joueur j where j.forum_user_id = 9110),
  'UNE RENCONTRE OUVRE UN COMBAT'
);

select is(
  (select pv_sauvage from combat where message_id = 15601),
  pv_au_niveau(50::smallint, 10::smallint)::smallint,
  'et le sauvage arrive avec les PV de la formule, pas avec un chiffre posé à la main'
);

select ok(
  (select pokemon_id is not null and pv_pokemon > 0 from combat where message_id = 15601),
  'LE COMBATTANT EST LÀ : le premier de l''équipe, avec ses PV — personne n''entre les mains vides depuis la 0043'
);

--  ── LA RELECTURE NE SOIGNE PERSONNE ──────────────────────────────
--
--  La relève relit chaque fois qu'un incident l'empêche d'avancer le
--  curseur. Si rouvrir remettait les PV au maximum, un joueur verrait
--  son Ponyta ressusciter entre deux passages.
update combat set pv_sauvage = 3 where message_id = 15601;

select is(
  (select (ouvrir_un_combat(jsonb_build_object(
      'sujetId', 996, 'messageId', 15601,
      'joueurId', j.id, 'especeId', 77, 'niveau', 10))->>'raison')
     from joueur j where j.forum_user_id = 9110),
  'DEJA_LU',
  'RELIRE LE MESSAGE NE ROUVRE RIEN'
);

select is(
  (select pv_sauvage from combat where message_id = 15601),
  3::smallint,
  'et surtout, ça ne le soigne pas'
);

--  ── UN SEUL COMBAT OUVERT PAR SUJET ──────────────────────────────
select is(
  (select (ouvrir_un_combat(jsonb_build_object(
      'sujetId', 996, 'messageId', 15602,
      'joueurId', j.id, 'especeId', 25, 'niveau', 8))->>'raison')
     from joueur j where j.forum_user_id = 9110),
  'COMBAT_EN_COURS',
  'DEUX COMBATS DANS UN FIL : refusé, et sans lever — le joueur n''a rien fait de mal'
);

select is(
  (select count(*)::int from combat where sujet_id = 996),
  1,
  'et rien n''a été écrit'
);

--  ── LA BARRE SAIT QUOI SERVIR ────────────────────────────────────
select is(
  (combat_du_sujet(jsonb_build_object('sujetId', 996))->>'nom'),
  'Ponyta',
  'LA BARRE LIT LE COMBAT OUVERT DU SUJET — c''est ce qui lui fait changer ses boutons'
);

select ok(
  combat_du_sujet(jsonb_build_object('sujetId', 999996)) is null,
  'et un sujet sans combat ne rend rien'
);

--  ── LA FERMETURE, ET LA PREMIÈRE FIN QUI L'EMPORTE ───────────────
select ok(
  (select fermer_un_combat(jsonb_build_object('combatId', c.id, 'etat', 'capture')) from combat c where c.message_id = 15601),
  'ON FERME UN COMBAT'
);

select ok(
  (select clos_le is not null from combat where message_id = 15601),
  'et la fin est datée — la contrainte l''exige, parce qu''un état sans date se met à mentir'
);

select ok(
  (select not fermer_un_combat(jsonb_build_object('combatId', c.id, 'etat', 'defaite')) from combat c where c.message_id = 15601),
  'LA PREMIÈRE FIN L''EMPORTE : refermer ne change ni la fin ni la date'
);

select is(
  (select etat from combat where message_id = 15601),
  'capture',
  'le combat reste une capture'
);

select throws_ok(
  $$ select fermer_un_combat(jsonb_build_object('combatId', c.id, 'etat', 'ouvert')) from combat c where c.message_id = 15601 $$,
  'P0001',
  'ETAT_DE_FERMETURE_INVALIDE',
  'et « fermer en ouvert » n''est pas une fin'
);

--  ── LE SUJET SE ROUVRE UNE FOIS LE COMBAT CLOS ───────────────────
select ok(
  (select (ouvrir_un_combat(jsonb_build_object(
      'sujetId', 996, 'messageId', 15603,
      'joueurId', j.id, 'especeId', 25, 'niveau', 8))->>'ouvert')::boolean
     from joueur j where j.forum_user_id = 9110),
  'LE COMBAT CLOS LIBÈRE LE SUJET : on peut refaire apparaître un Pokémon'
);

select throws_ok(
  $$ select ouvrir_un_combat(jsonb_build_object(
       'sujetId', 997, 'messageId', 15604,
       'joueurId', '00000000-0000-0000-0000-000000000000'::uuid,
       'especeId', 999999, 'niveau', 8)) $$,
  'P0001',
  'ESPECE_INCONNUE',
  'UNE ESPÈCE QUI N''EXISTE PAS N''OUVRE RIEN'
);

select throws_ok(
  $$ select ouvrir_un_combat(jsonb_build_object(
       'sujetId', 998, 'messageId', 15605,
       'joueurId', '00000000-0000-0000-0000-000000000000'::uuid,
       'especeId', 25, 'niveau', 0)) $$,
  'P0001',
  'NIVEAU_HORS_BORNES',
  'et un niveau zéro non plus'
);

select ok(
  not has_table_privilege('anon', 'combat', 'insert')
    and not has_table_privilege('anon', 'combat', 'update'),
  'PERSONNE N''ÉCRIT UN COMBAT DEPUIS LE NAVIGATEUR : les PV sont le score'
);

-- ════════════════════════════════════════════════════════════════════
--  0047 · LA FILE DES CARTES DE RENCONTRE
--
--  Le combat du message 15603 est resté ouvert plus haut (celui du
--  Pikachu niveau 8, ouvert après la capture du Ponyta). C'est lui qui
--  sert ici : un test qui se fabrique son propre monde ne prouve rien
--  sur celui des autres.
-- ════════════════════════════════════════════════════════════════════

select has_column('combat', 'carte_poste_le', 'LA CARTE A SA FILE — ouvrir le combat et poster sa carte ne sont pas atomiques (leçon du 2 octobre)');

select is(
  jsonb_array_length(cartes_a_poster(jsonb_build_object('combien', 10))),
  1,
  'UN COMBAT OUVERT MET SA CARTE EN FILE'
);

select is(
  cartes_a_poster(jsonb_build_object('combien', 10))->0->'sauvage'->>'nom',
  'Pikachu',
  'et la carte sait quoi annoncer'
);

--  LES CHIFFRES VIENNENT DE LA 0045, PAS D'UN CALCUL REFAIT DANS LA
--  LECTURE. Pikachu, base 55 d'attaque, niveau 8 : ⌊2×55×8/100⌋+5 = 13.
--  Si cette assertion tombe, la carte et le combat ne diraient plus la
--  même chose au même joueur.
select is(
  (cartes_a_poster(jsonb_build_object('combien', 10))->0->'sauvage'->>'attaque')::integer,
  stat_au_niveau(55::smallint, 8::smallint),
  'LA CARTE ET LE COMBAT CALCULENT PAREIL, par la même fonction'
);

select ok(
  cartes_a_poster(jsonb_build_object('combien', 10))->0->'combattant' <> 'null'::jsonb,
  'LE COMBATTANT EST SUR LA CARTE : le joueur voit les deux côtés avant de choisir'
);

--  ── POSTER, ET NE PAS REPOSTER ───────────────────────────────────
select ok(
  (select carte_postee(jsonb_build_object('combat', c.id, 'message', 99001)) from combat c where c.message_id = 15603),
  'ON NOTE LA CARTE COMME POSTÉE'
);

select is(
  jsonb_array_length(cartes_a_poster(jsonb_build_object('combien', 10))),
  0,
  'et elle sort de la file'
);

select ok(
  (select not carte_postee(jsonb_build_object('combat', c.id, 'message', 99002)) from combat c where c.message_id = 15603),
  'LE PREMIER MESSAGE POSTÉ EST CELUI QUE LES JOUEURS ONT LU : un second succès ne remplace pas son numéro'
);

select is(
  (select carte_message_id from combat where message_id = 15603),
  99001::bigint,
  'le numéro noté reste le premier'
);

--  ── L'ÉCHEC SE COMPTE, SAUF QUAND IL N'EN EST PAS UN ─────────────
select is(
  (select carte_echouee(jsonb_build_object('combat', c.id, 'erreur', 'forum injoignable')) from combat c where c.message_id = 15603),
  0,
  'UN ÉCHEC SUR UNE CARTE DÉJÀ POSTÉE NE COMPTE PAS : c''est un envoi en double refusé, pas une panne'
);

select ok(
  not has_function_privilege('anon', 'cartes_a_poster(jsonb)', 'execute'),
  'PERSONNE NE LIT LA FILE DEPUIS LE NAVIGATEUR : la carte arrive dans le sujet, pas avant'
);

-- ════════════════════════════════════════════════════════════════════
--  0048 · LES TOURS DU COMBAT
--
--  Le combat du message 15603 a été fermé plus haut (carte). On en
--  ouvre un neuf sur un autre sujet : un tour ne se joue que dans un
--  combat ouvert, et c'est justement une des choses à vérifier.
-- ════════════════════════════════════════════════════════════════════

select has_table('combat_tour', 'LE TOUR A SA TABLE');

select ok(
  (select (ouvrir_un_combat(jsonb_build_object(
      'sujetId', 997, 'messageId', 15700,
      'joueurId', j.id, 'especeId', 77, 'niveau', 10))->>'ouvert')::boolean
     from joueur j where j.forum_user_id = 9110),
  'un combat neuf pour les tours'
);

--  ── CE QU'IL FAUT POUR JOUER ─────────────────────────────────────
select ok(
  jsonb_array_length(combat_pour_jouer(jsonb_build_object('sujetId', 997))
    ->'sauvage'->'capacites') > 0,
  'LE SAUVAGE A DES CAPACITÉS — sans elles il ne riposte pas, et un combat où le sauvage ne frappe jamais n''est pas un combat'
);

select ok(
  jsonb_array_length(combat_pour_jouer(jsonb_build_object('sujetId', 997))
    ->'combattant'->'capacites') > 0,
  'et le combattant a les siennes, celles que la dotation lui a posées'
);

select is(
  (combat_pour_jouer(jsonb_build_object('sujetId', 997))->'sauvage'->>'attaque')::integer,
  stat_au_niveau(85::smallint, 10::smallint),
  'LES CHIFFRES VIENNENT DE LA MÊME FONCTION QUE LA CARTE : une seule formule'
);

select ok(
  combat_pour_jouer(jsonb_build_object('sujetId', 999997)) is null,
  'et un sujet sans combat ouvert ne rend rien'
);

--  ── JOUER ────────────────────────────────────────────────────────
select ok(
  (select (jouer_un_tour(jsonb_build_object(
      'combatId', c.id, 'messageId', 15701, 'numero', 1,
      'demande', 'attaquer', 'detail', jsonb_build_object('capacite', 52),
      'recit', jsonb_build_object('de', 93), 'pvJoueur', 12, 'pvSauvage', 24
    ))->>'joue')::boolean
     from combat c where c.message_id = 15700),
  'UN TOUR SE JOUE'
);

select is(
  (select pv_sauvage from combat where message_id = 15700),
  24::smallint,
  'et LES PV QUI COMPTENT SONT CEUX DU COMBAT, mis à jour'
);

select is(
  (select tour from combat where message_id = 15700),
  1::smallint,
  'le combat sait où il en est'
);

select ok(
  (select recit->>'de' = '93' from combat_tour where message_id = 15701),
  'LE DÉ EST GARDÉ : une contestation se tranche en le montrant, pas en le recalculant dans un an'
);

--  ── REJOUER LE MÊME MESSAGE NE REJOUE PAS LE TOUR ────────────────
--
--  La relève relit. Sans cette garde, les dégâts tomberaient deux fois
--  et un Pokémon mourrait d'un message qu'il avait déjà encaissé.
select is(
  (select (jouer_un_tour(jsonb_build_object(
      'combatId', c.id, 'messageId', 15701, 'numero', 1,
      'demande', 'attaquer', 'recit', '{}'::jsonb,
      'pvJoueur', 1, 'pvSauvage', 1))->>'raison')
     from combat c where c.message_id = 15700),
  'DEJA_JOUE',
  'REJOUER LE MÊME MESSAGE NE REJOUE PAS LE TOUR'
);

select is(
  (select pv_joueur from combat_tour where message_id = 15701),
  12::smallint,
  'et surtout, ça ne retire pas de PV une seconde fois'
);

--  ── DEUX MESSAGES NE JOUENT PAS LE MÊME NUMÉRO ───────────────────
select is(
  (select (jouer_un_tour(jsonb_build_object(
      'combatId', c.id, 'messageId', 15702, 'numero', 1,
      'demande', 'attaquer', 'recit', '{}'::jsonb,
      'pvJoueur', 9, 'pvSauvage', 20))->>'raison')
     from combat c where c.message_id = 15700),
  'TOUR_DEPASSE',
  'DEUX MESSAGES NE JOUENT PAS LE TOUR 1 : le premier l''emporte'
);

--  ── UNE FIN FERME LE COMBAT ──────────────────────────────────────
select is(
  (select (jouer_un_tour(jsonb_build_object(
      'combatId', c.id, 'messageId', 15703, 'numero', 2,
      'demande', 'fuir', 'recit', '{}'::jsonb,
      'pvJoueur', 12, 'pvSauvage', 24, 'fin', 'fuite'))->>'fin')
     from combat c where c.message_id = 15700),
  'fuite',
  'UNE FIN SE JOUE'
);

select is(
  (select etat from combat where message_id = 15700),
  'fuite',
  'et elle ferme le combat'
);

select ok(
  (select clos_le is not null from combat where message_id = 15700),
  'en le datant — la contrainte de la 0046 l''exige'
);

select is(
  (select (jouer_un_tour(jsonb_build_object(
      'combatId', c.id, 'messageId', 15704, 'numero', 3,
      'demande', 'attaquer', 'recit', '{}'::jsonb,
      'pvJoueur', 1, 'pvSauvage', 1))->>'raison')
     from combat c where c.message_id = 15700),
  'COMBAT_CLOS',
  'ON NE FRAPPE PAS UN COMBAT TERMINÉ'
);

select throws_ok(
  $$ select jouer_un_tour(jsonb_build_object(
       'combatId', '00000000-0000-0000-0000-000000000000'::uuid,
       'messageId', 15705, 'numero', 1, 'demande', 'fuir',
       'pvJoueur', 1, 'pvSauvage', 1)) $$,
  'P0001',
  'TOUR_SANS_RECIT',
  'UN TOUR SANS RÉCIT N''EST PAS UN TOUR : il n''y aurait rien à montrer'
);

select throws_ok(
  $$ select jouer_un_tour(jsonb_build_object(
       'combatId', '00000000-0000-0000-0000-000000000000'::uuid,
       'messageId', 15706, 'numero', 1, 'demande', 'fuir',
       'recit', '{}'::jsonb, 'pvJoueur', 1, 'pvSauvage', 1, 'fin', 'gagne')) $$,
  'P0001',
  'FIN_INCONNUE',
  'et une fin qu''on ne saurait pas relire est refusée'
);

--  ── LA FILE DES MESSAGES DE TOUR ─────────────────────────────────
select is(
  jsonb_array_length(tours_a_poster('{}'::jsonb)),
  2,
  'LES DEUX TOURS ATTENDENT LEUR MESSAGE, y compris celui qui a fini le combat — c''est lui qui annonce la fin'
);

select ok(
  (select tour_poste(jsonb_build_object('message', 99100, 'tour', t.id))
     from combat_tour t where t.message_id = 15701),
  'on note le message d''un tour'
);

select is(
  jsonb_array_length(tours_a_poster('{}'::jsonb)),
  1,
  'et il sort de la file'
);

select ok(
  not has_table_privilege('anon', 'combat_tour', 'insert'),
  'PERSONNE N''ÉCRIT UN TOUR DEPUIS LE NAVIGATEUR : un tour qu''on écrit soi-même est un combat qu''on gagne en écrivant qu''on l''a gagné'
);

-- ════════════════════════════════════════════════════════════════════
--  0049 · LES PV DANS LE SUJET
--
--  « Ils se soignent à la clôture » — 18 novembre. Les PV comptent
--  pendant tout le sujet : changer ne soigne pas, revenir ne soigne
--  pas, une seconde rencontre dans le même sujet se joue avec le
--  Pokémon qu'on a.
-- ════════════════════════════════════════════════════════════════════

select has_table('pv_du_sujet', 'LES PV ONT LEUR TABLE');

select ok(
  (select (ouvrir_un_combat(jsonb_build_object(
      'sujetId', 998, 'messageId', 15800,
      'joueurId', j.id, 'especeId', 77, 'niveau', 10))->>'ouvert')::boolean
     from joueur j where j.forum_user_id = 9110),
  'un combat dans un sujet neuf'
);

select is(
  (select pv_pokemon from combat where message_id = 15800),
  (select pv_pokemon_max from combat where message_id = 15800),
  'UN POKÉMON JAMAIS BLESSÉ DANS CE SUJET ENTRE ENTIER'
);

--  ── UN TOUR ÉCRIT LES DEUX, DANS LA MÊME TRANSACTION ─────────────
select ok(
  (select (jouer_un_tour(jsonb_build_object(
      'combatId', c.id, 'messageId', 15801, 'numero', 1,
      'demande', 'attaquer', 'recit', '{}'::jsonb,
      'pvJoueur', 7, 'pvSauvage', 20))->>'joue')::boolean
     from combat c where c.message_id = 15800),
  'un tour qui blesse'
);

select is(
  (select pv from pv_du_sujet pvs
     join combat c on c.pokemon_id = pvs.pokemon_id
    where c.message_id = 15800 and pvs.sujet_id = 998),
  7::smallint,
  'LES PV DU SUJET SUIVENT LE TOUR'
);

select is(
  (select pv_pokemon from combat where message_id = 15800),
  (select pv from pv_du_sujet where sujet_id = 998),
  'ET LA COPIE S''ACCORDE AVEC LA VÉRITÉ : une seule fonction écrit les deux, dans la même transaction'
);

--  ── UNE SECONDE RENCONTRE DANS LE MÊME SUJET ─────────────────────
--
--  C'est le cœur de la décision du 18 novembre. Si cette assertion
--  tombe, les Potions ne servent plus à rien.
select ok(
  (select fermer_un_combat(jsonb_build_object('combatId', c.id, 'etat', 'fuite'))
     from combat c where c.message_id = 15800),
  'le premier combat se ferme'
);

select ok(
  (select (ouvrir_un_combat(jsonb_build_object(
      'sujetId', 998, 'messageId', 15810,
      'joueurId', j.id, 'especeId', 25, 'niveau', 8))->>'ouvert')::boolean
     from joueur j where j.forum_user_id = 9110),
  'et un second s''ouvre dans le même sujet'
);

select is(
  (select pv_pokemon from combat where message_id = 15810),
  7::smallint,
  'LE COMBATTANT ARRIVE COMME IL EST : blessé au combat d''avant, blessé à celui-ci'
);

select ok(
  (select pv_pokemon < pv_pokemon_max from combat where message_id = 15810),
  'et son maximum, lui, n''a pas bougé — c''est ce qui fait « 7/18 » sur la carte'
);

--  ── CHANGER DE POKÉMON : CELUI QUI SORT GARDE SES PV ─────────────
--
--  LE DÉCOR MANQUAIT, et le test l'a dit : le joueur n'avait que son
--  starter, donc « changer » ne changeait pour personne et la ligne
--  attendue n'arrivait pas. On lui donne un second Pokémon.
insert into pokemon (joueur_id, espece_id, emplacement, position, niveau)
select j.id, 25, 'equipe', 2, 6 from joueur j where j.forum_user_id = 9110;

select ok(
  (select (jouer_un_tour(jsonb_build_object(
      'combatId', c.id, 'messageId', 15811, 'numero', 1,
      'demande', 'changer', 'recit', '{}'::jsonb,
      'pokemonId', (select id from pokemon
                     where joueur_id = c.joueur_id and id <> c.pokemon_id limit 1),
      'pvPokemonMax', 20, 'pvJoueur', 20, 'pvSauvage', 25))->>'joue')::boolean
     from combat c where c.message_id = 15810),
  'un changement de Pokémon se joue'
);

select is(
  (select count(*)::int from pv_du_sujet where sujet_id = 998),
  2,
  'DEUX POKÉMON ONT MAINTENANT DES PV DANS CE SUJET : celui qui sort garde les siens'
);

--  ── ET LA CLÔTURE SOIGNE TOUT ────────────────────────────────────
--
--  Par un DÉCLENCHEUR, pas par une ligne ajoutée dans
--  `appliquer_cloture` : cette fonction a été réécrite deux fois cette
--  semaine et les deux fois quelque chose est revenu en arrière.
insert into cloture (sujet_id, code, resultat)
values (998, 'WM-SOIN-998', '{}'::jsonb);

select is(
  (select count(*)::int from pv_du_sujet where sujet_id = 998),
  0,
  'LA CLÔTURE SOIGNE TOUT LE MONDE — « ils se soignent à la clôture », 18 novembre'
);

select ok(
  not has_table_privilege('anon', 'pv_du_sujet', 'update'),
  'et personne n''écrit ses PV depuis le navigateur : les PV sont le score'
);

-- ════════════════════════════════════════════════════════════════════
--  0050 · L'ÉQUIPE EN COMBAT, ET LE TAUX DE CAPTURE
-- ════════════════════════════════════════════════════════════════════

select has_column('espece', 'capture_base', 'L''ESPÈCE PORTE SON TAUX DE CAPTURE — la seule chose qui sépare un Chenipan d''un légendaire');

select ok(
  (select capture_base from espece where id = 10)
    > (select capture_base from espece where id = 4),
  'et il est semé : un Chenipan s''attrape plus facilement qu''un Salamèche'
);

select ok(
  (select (ouvrir_un_combat(jsonb_build_object(
      'sujetId', 999, 'messageId', 15900,
      'joueurId', j.id, 'especeId', 77, 'niveau', 10))->>'ouvert')::boolean
     from joueur j where j.forum_user_id = 9110),
  'un combat pour lire l''équipe'
);

select ok(
  jsonb_array_length(combat_pour_jouer(jsonb_build_object('sujetId', 999))->'equipe') >= 2,
  'L''ÉQUIPE ENTIÈRE EST LÀ, banc compris : « changer » doit pouvoir refuser « celui-là se bat déjà » en le NOMMANT'
);

select ok(
  (combat_pour_jouer(jsonb_build_object('sujetId', 999))
     ->'equipe'->0->>'pokemonId') is not null,
  'et chaque membre porte son identifiant'
);

select is(
  (combat_pour_jouer(jsonb_build_object('sujetId', 999))->'sauvage'->>'capture')::integer,
  190,
  'LE TAUX DU SAUVAGE EST DANS LA MÊME LECTURE : un appel de plus pour un chiffre déjà joint serait un aller-retour pour rien'
);

select ok(
  (select count(*) from jsonb_array_elements(
     combat_pour_jouer(jsonb_build_object('sujetId', 999))->'sac') o
    where o->>'slug' is not null) > 0,
  'LE SAC PORTE LES SLUGS : le domaine choisit le multiplicateur d''une ball par son slug, pas par son identifiant'
);

-- ════════════════════════════════════════════════════════════════════
--  0051 · MON COMBAT
--
--  La frontière du privé. `combat_du_sujet` est lisible par n'importe
--  qui — elle ne rend que ce qui est déjà dans le sujet. `mon_combat`
--  rend le SAC et l'ÉQUIPE, donc elle demande le laissez-passer.
-- ════════════════════════════════════════════════════════════════════

select ok(
  mon_combat(jsonb_build_object('sujetId', 999)) is null,
  'SANS LAISSEZ-PASSER, AUCUN COMBAT — le refus est dans la base, pas seulement dans l''affichage : un bouton caché se retrouve avec les outils du navigateur'
);

--  On relie le joueur d'essai à une identité, puis on pose le jeton
--  comme PostgREST le fait.
update joueur set auth_id = 'bbbbbbbb-0000-0000-0000-000000000001'
 where forum_user_id = 9110;

select set_config(
  'request.jwt.claims',
  '{"sub":"bbbbbbbb-0000-0000-0000-000000000001"}',
  true
);

select is(
  joueur_courant(),
  (select id from joueur where forum_user_id = 9110),
  'AVEC LE LAISSEZ-PASSER, LE BON JOUEUR'
);

select ok(
  mon_combat(jsonb_build_object('sujetId', 999)) is not null,
  'et son combat se lit'
);

select ok(
  jsonb_array_length(mon_combat(jsonb_build_object('sujetId', 999))->'equipe') >= 2,
  'L''ÉQUIPE EST LÀ, pour que « changer » puisse proposer des cases'
);

select ok(
  (select count(*) from jsonb_array_elements(
     mon_combat(jsonb_build_object('sujetId', 999))->'equipe') m
    where (m->>'combat')::boolean) = 1,
  'et UN SEUL y est marqué comme se battant : la barre doit pouvoir le dire avant que le joueur ne clique'
);

select ok(
  (select bool_and(o->>'famille' in ('ball', 'soin'))
     from jsonb_array_elements(
       mon_combat(jsonb_build_object('sujetId', 999))->'sac') o),
  'LE SAC EST RÉDUIT À CE QUI SERT EN COMBAT : une pierre d''évolution dans une liste où chaque ligne coûte un tour serait un piège'
);

--  ── ET LE COMBAT DU VOISIN RESTE LE SIEN ─────────────────────────
select set_config(
  'request.jwt.claims',
  '{"sub":"bbbbbbbb-0000-0000-0000-00000000ffff"}',
  true
);

select ok(
  mon_combat(jsonb_build_object('sujetId', 999)) is null,
  'LE COMBAT N''EST PAS CELUI DU VOISIN : planche 99 §5.4, l''autre voit la carte et ne peut pas agir'
);

select ok(
  combat_du_sujet(jsonb_build_object('sujetId', 999)) is not null,
  'MAIS IL VOIT LA CARTE : ce qui est dans le sujet reste public'
);

select set_config('request.jwt.claims', '', true);

select * from finish();







rollback;
