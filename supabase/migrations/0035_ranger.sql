-- ════════════════════════════════════════════════════════════════════
--  0035 · `ranger()` — le seul geste d'écriture du carnet sur le jeu
--
--  Note de code `387:1075`, section CE QUI EST VÉRIFIÉ CÔTÉ SERVEUR :
--
--      « Six places d'équipe au maximum, une case occupée à la fois, et
--        un Pokémon en pension ne bouge pas. Le navigateur grise ce
--        qu'il peut, mais c'est la fonction ranger() qui refuse — un
--        appel bricolé ne passe pas. »
--
--  ── POURQUOI UNE FONCTION, ALORS QUE LA RLS EXISTE ──────────────────
--
--  La `0008` n'accorde au navigateur qu'une seule colonne :
--  `grant update (emplacement) on pokemon to authenticated`. Pas
--  `position`, pas `boite_no`. Un rangement par PostgREST est donc
--  impossible — et c'était délibéré : déplacer un Pokémon, ce n'est pas
--  écrire une colonne, c'est en écrire deux ou quatre d'un coup, et
--  parfois sur DEUX lignes quand on échange deux cases.
--
--  Une telle chose se fait dans une transaction, du côté qui sait
--  compter. D'où `ranger()`.
--
--  ── TROIS RÈGLES, ET LA TROISIÈME N'EXISTAIT NULLE PART ─────────────
--
--  1. SIX PLACES D'ÉQUIPE : déjà tenue par `pokemon_equipe_six` et
--     l'index unique de la `0001`. La fonction se contente de ne pas
--     la contourner.
--  2. UNE CASE OCCUPÉE À LA FOIS : index unique de la `0001` pour
--     l'équipe, `pokemon_case_de_boite` de la `0019` pour les boîtes.
--     La fonction ÉCHANGE au lieu de refuser, parce que c'est ce qu'on
--     attend en déposant un Pokémon sur un autre.
--  3. UN POKÉMON EN PENSION NE BOUGE PAS. Celle-là n'était écrite nulle
--     part — ni contrainte, ni politique, ni fonction. Un appel
--     bricolé aurait sorti de l'équipe un Pokémon déposé chez le
--     gérant, et `rendre_pension` l'aurait remis à une place désormais
--     prise. Elle vit ici, et elle vaut dans les deux sens : ni le
--     déplacé ni celui qu'on bouscule.
-- ════════════════════════════════════════════════════════════════════

--  LA TAILLE D'UNE BOÎTE, écrite une fois. Trente cases : dix colonnes
--  sur trois rangs, cinq colonnes sous 760 px comme le dit la note.
create or replace function cases_par_boite() returns smallint as $$
  select 30::smallint;
$$ language sql immutable;

create or replace function ranger(p jsonb) returns jsonb as $$
declare
  v_pokemon  pokemon%rowtype;
  v_occupant pokemon%rowtype;
  v_ou       text     := p ->> 'emplacement';
  v_boite    smallint := coalesce((p ->> 'boiteNo')::smallint, 1);
  v_place    smallint := (p ->> 'position')::smallint;
begin
  select * into v_pokemon
    from pokemon
   where id = (p ->> 'pokemonId')::uuid
     and joueur_id in (select mes_joueurs())
     for update;
  if not found then
    raise exception 'PAS_TON_POKEMON';
  end if;

  --  ── LA DESTINATION DOIT AVOIR UN SENS ───────────────────────────
  if v_ou not in ('equipe', 'boite') then
    raise exception 'DESTINATION_INCONNUE';
  end if;
  if v_ou = 'equipe' and (v_place is null or v_place not between 1 and 6) then
    raise exception 'PLACE_HORS_EQUIPE';
  end if;
  if v_ou = 'boite' then
    if v_boite not between 1 and 3 then
      raise exception 'BOITE_INCONNUE';
    end if;
    if v_place is null or v_place not between 1 and cases_par_boite() then
      raise exception 'PLACE_HORS_BOITE';
    end if;
  end if;

  --  ── UN POKÉMON EN PENSION NE BOUGE PAS ──────────────────────────
  --
  --  Il reste visible à sa place, en transparence : « il occupe la
  --  place tant qu'il n'est pas récupéré, c'est plus clair que de le
  --  faire disparaître ». Le laisser déplacer ferait pire que
  --  l'inverse — `rendre_pension` le remettrait à une place prise.
  if exists (
    select 1 from pension
     where pokemon_id = v_pokemon.id and recupere_le is null
  ) then
    raise exception 'EN_PENSION';
  end if;

  --  Rien à faire : on ne touche pas la base pour un déplacement nul.
  if v_pokemon.emplacement = v_ou and coalesce(v_pokemon.position, 0) = coalesce(v_place, 0)
     and (v_ou <> 'boite' or v_pokemon.boite_no = v_boite) then
    return jsonb_build_object('range', false, 'echange', false);
  end if;

  --  ── LA CASE VISÉE EST-ELLE PRISE ? ──────────────────────────────
  select * into v_occupant
    from pokemon
   where joueur_id = v_pokemon.joueur_id
     and emplacement = v_ou
     and position = v_place
     and (v_ou <> 'boite' or boite_no = v_boite)
     and id <> v_pokemon.id
     for update;

  if found then
    --  CELUI QU'ON BOUSCULE EST SOUMIS À LA MÊME RÈGLE. Sans ce
    --  contrôle, on sortirait de l'équipe un Pokémon en pension en
    --  posant simplement un autre sur sa case.
    if exists (
      select 1 from pension
       where pokemon_id = v_occupant.id and recupere_le is null
    ) then
      raise exception 'CASE_EN_PENSION';
    end if;

    --  L'ÉCHANGE PASSE PAR UNE PLACE NULLE. Les index uniques
    --  refuseraient les deux écritures faites dans l'ordre naïf :
    --  pendant un instant les deux Pokémon occuperaient la même case.
    --  `position` est nullable exprès depuis la `0001`.
    update pokemon set position = null where id = v_occupant.id;
    update pokemon
       set emplacement = v_ou,
           boite_no    = case when v_ou = 'boite' then v_boite else boite_no end,
           position    = v_place
     where id = v_pokemon.id;
    update pokemon
       set emplacement = v_pokemon.emplacement,
           boite_no    = v_pokemon.boite_no,
           position    = v_pokemon.position
     where id = v_occupant.id;
    return jsonb_build_object('range', true, 'echange', true);
  end if;

  update pokemon
     set emplacement = v_ou,
         boite_no    = case when v_ou = 'boite' then v_boite else boite_no end,
         position    = v_place
   where id = v_pokemon.id;

  return jsonb_build_object('range', true, 'echange', false);
end $$ language plpgsql security definer set search_path = public, pg_temp;

revoke all on function ranger(jsonb) from public;
revoke all on function ranger(jsonb) from anon;
grant execute on function ranger(jsonb) to authenticated, service_role;

comment on function ranger(jsonb) is
  'Déplace un Pokémon du joueur connecté vers une place d''équipe (1-6) '
  'ou une case de boîte (boîte 1-3, case 1-30). Échange si la case est '
  'prise ; refuse si l''un des deux est en pension (0035). Le '
  'navigateur n''a pas les droits d''écriture sur `position` ni '
  '`boite_no` : c''est le seul chemin.';
