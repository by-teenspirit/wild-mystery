-- ════════════════════════════════════════════════════════════════════
--  0044 · Les quatre capacités d'un Pokémon
--
--  « Les attaques : oui, les quatre capacités du pokémon. »
--  17 novembre 2026.
--
--  ── POURQUOI LES TABLES, ET PAS SEULEMENT LE JSON ───────────────────
--
--  `data/capacites.json` et `data/capacites-par-espece.json` sont
--  servis au navigateur. Mais les quatre capacités d'un Pokémon se
--  choisissent EN BASE : à la dotation, à la capture, à chaque niveau
--  gagné. Une fonction SQL ne lit pas un fichier du dépôt.
--
--  Les deux tables sont donc semées depuis ces fichiers
--  (`supabase/seeds/capacites.sql`, écrit par `outils/capacites.py`
--  dans la même passe que le JSON, pour qu'ils ne divergent pas).
--
--  ── POURQUOI UNE TABLE DE LIAISON, ET PAS UN TABLEAU ────────────────
--
--  `pokemon.capacites integer[]` aurait tenu en une colonne. Mais un
--  tableau ne porte pas de clé étrangère : rien n'aurait empêché d'y
--  écrire une capacité qui n'existe pas, et on l'aurait découvert en
--  plein combat. La base garantit ce qu'elle peut garantir — c'est la
--  même règle que pour les six de l'équipe.
--
--  La POSITION est dans la clé primaire : les quatre sont ordonnées,
--  et c'est l'ordre que le joueur verra dans sa barre.
--
--  ── CE QUE `capacites_de_depart` INVENTE, ET QUI EST ÉCRIT ICI ──────
--
--  Elle rend les QUATRE DERNIÈRES apprises au niveau du Pokémon. C'est
--  la règle des jeux, et elle se défend seule : les dernières apprises
--  sont les plus fortes.
--
--  SI ELLE N'EN CONNAÎT AUCUNE À SON NIVEAU — seize espèces dans ce
--  cas à 5 —, elle reçoit LA PREMIÈRE QU'ELLE APPRENDRA. Un Pokémon
--  qui ne peut pas attaquer ne peut pas jouer, et lui donner Charge
--  serait lui donner le move de quelqu'un d'autre : le sien, en
--  avance, dit mieux ce qu'il est.
-- ════════════════════════════════════════════════════════════════════

create table if not exists capacite (
  id        integer primary key,                   -- l'id PokéAPI
  nom       text     not null,
  type      text     not null,
  puissance smallint not null check (puissance > 0),
  pp        smallint not null default 0,
  precision smallint not null default 100,
  categorie text     not null
    check (categorie in ('physique', 'speciale', 'statut'))
);

comment on table capacite is
  'Les capacités OFFENSIVES, semées depuis data/capacites.json. Les '
  'capacités de statut n''y sont pas : le combat résout des dégâts, et '
  'un bouton qui n''agit pas est un défaut.';

create table if not exists espece_capacite (
  espece_id   integer  not null references espece(id) on delete cascade,
  capacite_id integer  not null references capacite(id) on delete cascade,
  niveau      smallint not null check (niveau between 1 and 100),
  primary key (espece_id, capacite_id)
);

create index if not exists espece_capacite_par_niveau
  on espece_capacite (espece_id, niveau desc);

create table if not exists pokemon_capacite (
  pokemon_id  uuid     not null references pokemon(id) on delete cascade,
  position    smallint not null check (position between 1 and 4),
  capacite_id integer  not null references capacite(id),
  primary key (pokemon_id, position)
);

--  UNE CAPACITÉ NE SE CONNAÎT PAS DEUX FOIS. La position dit l'ordre,
--  elle ne doit pas servir à doubler un move.
create unique index if not exists pokemon_capacite_une_fois
  on pokemon_capacite (pokemon_id, capacite_id);

-- ── LES QUATRE D'UNE ESPÈCE À UN NIVEAU ────────────────────────────

create or replace function capacites_de_depart(p_espece integer, p_niveau smallint)
returns integer[] as $$
declare
  v_ids integer[];
begin
  --  LES QUATRE DERNIÈRES APPRISES AU NIVEAU. `niveau desc` d'abord,
  --  puis l'identifiant pour que deux capacités du même niveau
  --  sortent toujours dans le même ordre — un tirage qui dépend de
  --  l'ordre de la table n'est pas un tirage, c'est une surprise.
  select array_agg(capacite_id order by niveau desc, capacite_id desc)
    into v_ids
    from (
      select capacite_id, niveau
        from espece_capacite
       where espece_id = p_espece and niveau <= p_niveau
       order by niveau desc, capacite_id desc
       limit 4
    ) d;

  --  RIEN À SON NIVEAU : la première qu'elle apprendra. Voir l'en-tête.
  if v_ids is null then
    select array[capacite_id]
      into v_ids
      from espece_capacite
     where espece_id = p_espece
     order by niveau asc, capacite_id asc
     limit 1;
  end if;

  return coalesce(v_ids, array[]::integer[]);
end $$ language plpgsql stable;

comment on function capacites_de_depart(integer, smallint) is
  'Les quatre dernières capacités apprises à ce niveau, ou la première '
  'qu''elle apprendra si elle n''en connaît aucune. Un Pokémon qui ne '
  'peut pas attaquer ne peut pas jouer.';

-- ── ET ON LES POSE SUR UN POKÉMON ──────────────────────────────────

create or replace function poser_les_capacites(p_pokemon uuid)
returns integer as $$
declare
  v_espece integer;
  v_niveau smallint;
  v_ids    integer[];
begin
  select espece_id, niveau into v_espece, v_niveau
    from pokemon where id = p_pokemon;
  if v_espece is null then
    raise exception 'POKEMON_INCONNU';
  end if;

  v_ids := capacites_de_depart(v_espece, v_niveau);

  --  ON REMPLACE, ON N'AJOUTE PAS. Appelée deux fois — et elle le
  --  sera, au niveau gagné — elle doit laisser QUATRE capacités, pas
  --  huit.
  delete from pokemon_capacite where pokemon_id = p_pokemon;
  insert into pokemon_capacite (pokemon_id, position, capacite_id)
  select p_pokemon, i, v_ids[i] from generate_subscripts(v_ids, 1) as i;

  return coalesce(array_length(v_ids, 1), 0);
end $$ language plpgsql security definer set search_path = public, extensions;

-- ── LA DOTATION LES POSE ───────────────────────────────────────────
--
--  Un starter sans capacité est un starter qui ne peut pas se battre,
--  et le combat se joue avec le premier Pokémon de l'équipe. La 0043
--  le donnait déjà ; elle le rend maintenant jouable.

create or replace function valider_le_personnage(p jsonb)
returns jsonb as $$
declare
  v_forum    integer := (p->>'forumUserId')::integer;
  v_pseudo   text    := btrim(p->>'pseudo');
  v_groupe   text    := p->>'groupe';
  --  `lower(trim(…))` : `lier_mon_personnage` cherche l'adresse en
  --  minuscules. Perdu une fois en réécrivant cette fonction, rattrapé
  --  par la suite pgTAP.
  v_courriel text    := lower(trim(p->>'courriel'));
  v_starter  integer := nullif(p->>'starter', '')::integer;
  v_id       uuid;
  v_neuf     boolean := false;
  v_cle      text;
  v_a_adresse boolean;
  v_dote     timestamptz;
  v_stade    smallint;
  v_dotee    boolean := false;
  v_pokemon  uuid;
  v_combien  integer := 0;
begin
  if v_forum is null or v_forum <= 0 then
    raise exception 'FORUM_USER_ID_MANQUANT';
  end if;
  --  LES SIX MAISONS, DANS LEURS NOMS D'AUJOURD'HUI — et pas ceux de
  --  la table `0001`, qui sont les légendaires d'origine.
  if v_groupe is not null and v_groupe not in
     ('hardi', 'serieux', 'malin', 'doux', 'brave', 'jovial') then
    raise exception 'GROUPE_INCONNU';
  end if;

  update joueur
     set groupe   = v_groupe,
         pseudo   = coalesce(nullif(v_pseudo, ''), pseudo),
         courriel = coalesce(nullif(v_courriel, ''), courriel)
   where forum_user_id = v_forum
   returning id into v_id;

  if v_id is null then
    if v_pseudo is null or v_pseudo = '' then
      raise exception 'PSEUDO_MANQUANT';
    end if;
    insert into joueur (forum_user_id, pseudo, groupe, courriel)
    values (v_forum, v_pseudo, v_groupe, nullif(v_courriel, ''))
    returning id into v_id;
    v_neuf := true;
  end if;

  select cle_de_carnet, courriel is not null and courriel <> '', dote_le
    into v_cle, v_a_adresse, v_dote
    from joueur where id = v_id;
  if v_cle is null then
    v_cle := encode(gen_random_bytes(16), 'hex');
    update joueur set cle_de_carnet = v_cle where id = v_id;
  end if;

  if v_dote is null and v_starter is not null then
    select stade into v_stade from espece where id = v_starter;
    if v_stade is null then
      raise exception 'STARTER_INCONNU';
    end if;
    if v_stade <> 1 then
      raise exception 'STARTER_PAS_UNE_FORME_DE_BASE';
    end if;

    insert into pokemon (joueur_id, espece_id, emplacement, position)
    values (v_id, v_starter, 'equipe', 1)
    returning id into v_pokemon;

    --  SES QUATRE CAPACITÉS, tout de suite : sans elles, il ne peut
    --  pas attaquer, et c'est lui qui combat.
    v_combien := poser_les_capacites(v_pokemon);

    insert into pokedex (joueur_id, espece_id, croise_le, attrape_le)
    values (v_id, v_starter, now(), now())
    on conflict (joueur_id, espece_id)
      do update set attrape_le = coalesce(pokedex.attrape_le, now());

    insert into sac (joueur_id, objet_id, quantite)
    values (v_id, 990001, 5), (v_id, 990020, 5)
    on conflict (joueur_id, objet_id)
      do update set quantite = sac.quantite + excluded.quantite;

    update joueur
       set pokedollars = pokedollars + 1000,
           dote_le     = now()
     where id = v_id;
    v_dotee := true;
  end if;

  return jsonb_build_object(
    'joueurId', v_id,
    'creee',    v_neuf,
    'groupe',   v_groupe,
    'cle',      v_cle,
    'peutSeLier', v_a_adresse,
    'dote',      v_dotee,
    'dejaDote',  v_dote is not null,
    --  COMBIEN DE CAPACITÉS LE STARTER CONNAÎT. Zéro voudrait dire
    --  qu'il ne peut pas se battre : autant que ça se voie dans la
    --  réponse plutôt qu'au premier combat.
    'capacites', v_combien
  );
end $$ language plpgsql security definer set search_path = public, extensions;

-- ── LES PERMISSIONS ────────────────────────────────────────────────
--
--  Les deux tables de référence se LISENT par tout le monde : le
--  carnet affiche les capacités d'un Pokémon, et il les lit avec la
--  clé publiable. Elles ne s'écrivent que par le seed.

alter table capacite         enable row level security;
alter table espece_capacite  enable row level security;
alter table pokemon_capacite enable row level security;

drop policy if exists "les capacités se lisent" on capacite;
create policy "les capacités se lisent" on capacite for select using (true);

drop policy if exists "ce qu'une espèce apprend se lit" on espece_capacite;
create policy "ce qu'une espèce apprend se lit" on espece_capacite
  for select using (true);

--  CELLES D'UN POKÉMON SONT À SON JOUEUR, comme le reste du carnet.
drop policy if exists "chacun lit les capacités de ses pokémon" on pokemon_capacite;
create policy "chacun lit les capacités de ses pokémon" on pokemon_capacite
  for select using (
    exists (
      select 1 from pokemon p join joueur j on j.id = p.joueur_id
       where p.id = pokemon_capacite.pokemon_id
         and j.cle_de_carnet = current_setting('request.headers', true)::json ->> 'x-wm-carnet'
    )
  );

grant select on capacite, espece_capacite to anon, authenticated;
grant select on pokemon_capacite to anon, authenticated;

revoke all on function capacites_de_depart(integer, smallint) from public;
revoke all on function poser_les_capacites(uuid) from public;
revoke all on function poser_les_capacites(uuid) from anon, authenticated;
grant execute on function capacites_de_depart(integer, smallint)
  to anon, authenticated, service_role;
grant execute on function poser_les_capacites(uuid) to service_role;
