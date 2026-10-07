-- ═══════════════════════════════════════════════════════════════════════
--  0005_releve.sql
--
--  Ce dont la fonction Edge a besoin pour tourner : un verrou, un journal,
--  la mémoire du dernier message lu par forum, et l'état d'un joueur.
--
--  Toutes les fonctions prennent un seul argument `jsonb`, pour la raison
--  écrite en tête de 0003 : PostgREST et psql les appellent de la même
--  façon, et le seul endroit du projet qui connaisse les transtypages est
--  le fichier SQL.
-- ═══════════════════════════════════════════════════════════════════════

-- ───────────────────────────────────────────────────────────────────────
--  1 · Le verrou
--  La relève tourne toutes les cinq minutes. Si un passage dure plus
--  longtemps que l'intervalle, deux passages se marchent dessus et le même
--  sujet est clôturé deux fois. Un verrou, donc — avec une expiration,
--  parce qu'un passage qui meurt sans rendre son verrou ne doit pas bloquer
--  la relève pour toujours.
-- ───────────────────────────────────────────────────────────────────────
create table if not exists verrou (
  nom       text primary key,
  pris_le   timestamptz not null default now(),
  expire_le timestamptz not null
);

comment on table verrou is
  'Verrous nommés, avec expiration. Un passage mort libère son verrou tout seul.';

--  Un SEUL ordre SQL, et c'est volontaire : `insert … on conflict … where`
--  est atomique. Deux passages simultanés ne peuvent pas le prendre tous
--  les deux, quelle que soit la façon dont ils s'entrelacent. Un `select`
--  suivi d'un `insert` laisserait, lui, une fenêtre.
create or replace function releve_prendre_le_verrou(p jsonb) returns boolean as $$
declare
  v_nom      text    := coalesce(p->>'nom', 'releve');
  v_secondes integer := coalesce((p->>'secondes')::integer, 240);
  v_pris     boolean;
begin
  insert into verrou (nom, pris_le, expire_le)
  values (v_nom, now(), now() + make_interval(secs => v_secondes))
      on conflict (nom) do update
         set pris_le = now(),
             expire_le = now() + make_interval(secs => v_secondes)
       where verrou.expire_le < now()
  returning true into v_pris;

  return coalesce(v_pris, false);
end $$ language plpgsql security definer;

create or replace function releve_rendre_le_verrou(p jsonb) returns boolean as $$
declare n integer;
begin
  delete from verrou where nom = coalesce(p->>'nom', 'releve');
  get diagnostics n = row_count;
  return n > 0;
end $$ language plpgsql security definer;

-- ───────────────────────────────────────────────────────────────────────
--  2 · Le journal des passages
--  Une ligne par tâche et par passage. C'est la seule trace de ce que la
--  relève a fait, et la première chose qu'on lira le jour où elle se
--  trompera.
-- ───────────────────────────────────────────────────────────────────────
create or replace function releve_noter(p jsonb) returns bigint as $$
declare v_id bigint;
begin
  insert into releve_journal (tache, traites, erreurs)
  values (
    p->>'tache',
    coalesce((p->>'traites')::integer, 0),
    case when p->'erreurs' is null or p->'erreurs' = 'null'::jsonb
         then null else p->'erreurs' end
  )
  returning id into v_id;
  return v_id;
end $$ language plpgsql security definer;

create or replace function releve_dernier_passage(p jsonb) returns jsonb as $$
  select coalesce(
    (select jsonb_build_object('passeLe', to_char(max(passe_le), 'YYYY-MM-DD"T"HH24:MI:SSOF'))
       from releve_journal
      where p->>'tache' is null or tache = p->>'tache'),
    jsonb_build_object('passeLe', null)
  )
$$ language sql stable security definer;

-- ───────────────────────────────────────────────────────────────────────
--  3 · La mémoire du dernier message lu, par forum
--  Les dates de Forumactif sont inutilisables — « Lun 6 Sep - 10:21 »,
--  sans année. Les identifiants de message, eux, ne reculent jamais :
--  c'est eux l'horloge de la relève.
-- ───────────────────────────────────────────────────────────────────────
create or replace function releve_suivi(p jsonb) returns jsonb as $$
  select coalesce(
    (select jsonb_build_object('forumId', forum_id, 'dernierMessage', dernier_message)
       from releve where forum_id = (p->>'forumId')::integer),
    jsonb_build_object('forumId', (p->>'forumId')::integer, 'dernierMessage', 0)
  )
$$ language sql stable security definer;

--  `greatest` et pas une affectation : un passage en retard ne doit jamais
--  faire RECULER le curseur, sinon la relève relit et réécrit.
create or replace function releve_avancer(p jsonb) returns bigint as $$
declare v_apres bigint;
begin
  insert into releve (forum_id, dernier_message, passe_le)
  values ((p->>'forumId')::integer, (p->>'dernierMessage')::bigint, now())
      on conflict (forum_id) do update
         set dernier_message = greatest(releve.dernier_message, excluded.dernier_message),
             passe_le = now()
  returning dernier_message into v_apres;
  return v_apres;
end $$ language plpgsql security definer;

-- ───────────────────────────────────────────────────────────────────────
--  4 · Les places en boîte
--
--  « Trente places par boîte, partout et depuis toujours » — annexe 17.
--  Combien de boîtes par joueur, en revanche, n'est pas tranché : c'est une
--  décision de jeu (est-ce qu'on en gagne ? à quel palier ?). En attendant,
--  une boîte, et une colonne pour le jour où la réponse arrive.
-- ───────────────────────────────────────────────────────────────────────
alter table joueur add column if not exists boites smallint not null default 1
  check (boites between 1 and 32);
comment on column joueur.boites is
  'Nombre de boîtes. 30 places chacune (annexe 17). Combien on en gagne reste à trancher.';

create or replace function places_par_boite() returns integer as $$
  select 30
$$ language sql immutable;

--  L'état que le domaine attend, dans sa forme exacte : le sac en tableau,
--  les places LIBRES (pas la capacité), le solde.
create or replace function etat_du_joueur(p jsonb) returns jsonb as $$
declare
  v_joueur uuid := (p->>'joueurId')::uuid;
  v_etat   jsonb;
begin
  select jsonb_build_object(
    'sac', coalesce((
      select jsonb_agg(jsonb_build_object('objetId', s.objet_id, 'quantite', s.quantite)
                       order by s.objet_id)
        from sac s where s.joueur_id = v_joueur and s.quantite > 0
    ), '[]'::jsonb),
    'placesEnBoite', greatest(
      j.boites * places_par_boite()
        - (select count(*) from pokemon q
            where q.joueur_id = v_joueur and q.emplacement = 'boite'),
      0),
    'pokedollars', j.pokedollars
  )
    into v_etat
    from joueur j
   where j.id = v_joueur;

  if v_etat is null then
    raise exception 'Joueur % inconnu.', v_joueur;
  end if;
  return v_etat;
end $$ language plpgsql stable security definer;

-- ───────────────────────────────────────────────────────────────────────
--  5 · Le compte Forumactif → le joueur
--  Rend null si le compte n'est pas lié, et c'est un cas normal : un
--  visiteur peut poster dans une zone sauvage sans avoir de fiche validée.
-- ───────────────────────────────────────────────────────────────────────
create or replace function joueur_du_compte(p jsonb) returns jsonb as $$
  select jsonb_build_object(
    'joueurId',
    (select j.id::text from joueur j where j.forum_user_id = (p->>'forumUserId')::integer)
  )
$$ language sql stable security definer;

-- ───────────────────────────────────────────────────────────────────────
--  6 · Le catalogue
--  Pour écrire un refus qu'un joueur comprend : « il te manque 2 Poké Ball »
--  et non « il te manque 2 × objet 1 ».
-- ───────────────────────────────────────────────────────────────────────
create or replace function catalogue_nom_objet(p jsonb) returns jsonb as $$
  select jsonb_build_object(
    'nom',
    coalesce(
      (select o.nom from objet o where o.id = (p->>'objetId')::integer),
      'objet ' || (p->>'objetId')
    )
  )
$$ language sql stable security definer;

create or replace function catalogue_nom_espece(p jsonb) returns jsonb as $$
  select jsonb_build_object(
    'nom',
    coalesce(
      (select e.nom_fr from espece e where e.id = (p->>'especeId')::integer),
      'espèce ' || (p->>'especeId')
    )
  )
$$ language sql stable security definer;
