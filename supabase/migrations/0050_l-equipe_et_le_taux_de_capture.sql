-- ════════════════════════════════════════════════════════════════════
--  0050 · L'équipe en combat, et le taux de capture
--
--  Deux manques, trouvés en écrivant « changer de Pokémon » et
--  « lancer une Poké Ball ».
--
--  ── LE TAUX DE CAPTURE ──────────────────────────────────────────────
--
--  C'est la seule chose qui distingue un Ratentif d'un Mewtwo quand on
--  lance une Poké Ball. Sans lui, une formule de capture traiterait les
--  955 espèces pareil, et un légendaire s'attraperait comme un
--  Chenipan.
--
--  De 3 à 255 — plus c'est haut, plus c'est facile. Il vient de
--  `pokemon_species.csv`, par le même passage que les stats de base
--  (0045) : une seule source, un seul outil.
--
--  `default 45`, comme les autres : c'est celui d'un starter, donc ni
--  trop facile ni impossible. Mais c'est le seed qui fait foi.
--
--  ── L'ÉQUIPE DANS LE COMBAT ─────────────────────────────────────────
--
--  « Changer de Pokémon » a besoin de savoir qui est sur le banc, à
--  quelle case, avec combien de PV DANS CE SUJET (0049) et quelles
--  capacités. Rien de tout ça n'était dans `combat_pour_jouer`, qui ne
--  rendait que le combattant.
--
--  ON LE REND EN UNE SEULE LECTURE, et pas en un appel par Pokémon :
--  six appels pour afficher une liste de six, c'est six fois le même
--  aller-retour pour une réponse qu'on pouvait avoir d'un coup.
-- ════════════════════════════════════════════════════════════════════

alter table espece add column if not exists capture_base smallint not null default 45;

comment on column espece.capture_base is
  'Le taux de capture de PokéAPI, de 3 (un légendaire) à 255 (un '
  'Chenipan). Plus c''est haut, plus c''est facile. Semé par '
  'supabase/seeds/especes.sql.';

-- ════════════════════════════════════════════════════════════════════
--  COMBAT_POUR_JOUER, AVEC L'ÉQUIPE
--
--  Réécrite en entier parce que PostgreSQL ne sait pas faire autrement.
--  Relu avant : les capacités du sauvage TIRÉES à son niveau, celles du
--  combattant RANGÉES dans la table de liaison, les trois chiffres par
--  `stat_au_niveau`, et `null` quand aucun combat n'est ouvert. Tout
--  est là, plus l'équipe.
-- ════════════════════════════════════════════════════════════════════

create or replace function combat_pour_jouer(p jsonb)
returns jsonb as $$
declare
  v_sujet integer := (p->>'sujetId')::integer;
  v_c     combat%rowtype;
  v_pok   record;
  v_esp   record;
  v_siens jsonb;
  v_leurs jsonb;
  v_equipe jsonb;
begin
  select * into v_c from combat where sujet_id = v_sujet and etat = 'ouvert';
  if not found then
    return null;
  end if;

  select e.nom_fr, e.types, e.pv_base, e.att_base, e.def_base, e.capture_base
    into v_esp from espece e where e.id = v_c.espece_id;

  --  Les capacités du sauvage, tirées à son niveau : il joue avec les
  --  mêmes règles que les autres.
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', c.id, 'nom', c.nom, 'type', c.type,
           'puissance', c.puissance, 'precision', c."precision"
         ) order by c.id), '[]'::jsonb)
    into v_leurs
    from capacite c
   where c.id = any (capacites_de_depart(v_c.espece_id, v_c.niveau_sauvage));

  --  Et celles du combattant, RANGÉES et non tirées : il les a
  --  choisies, ou la dotation les lui a posées.
  if v_c.pokemon_id is not null then
    select pk.id, pk.surnom, pk.niveau, ep.nom_fr, ep.types,
           ep.pv_base, ep.att_base, ep.def_base
      into v_pok
      from pokemon pk join espece ep on ep.id = pk.espece_id
     where pk.id = v_c.pokemon_id;

    select coalesce(jsonb_agg(jsonb_build_object(
             'id', c.id, 'nom', c.nom, 'type', c.type,
             'puissance', c.puissance, 'precision', c."precision"
           ) order by pc.position), '[]'::jsonb)
      into v_siens
      from pokemon_capacite pc join capacite c on c.id = pc.capacite_id
     where pc.pokemon_id = v_c.pokemon_id;
  end if;

  --  ── L'ÉQUIPE, BANC COMPRIS ─────────────────────────────────────
  --
  --  Tout le monde, y compris celui qui se bat : « changer » doit
  --  pouvoir refuser « celui-là se bat déjà » en le NOMMANT, et pour le
  --  nommer il faut l'avoir.
  --
  --  LES PV SONT CEUX DU SUJET (0049), pas le maximum. Un Pokémon
  --  blessé plus tôt dans le sujet revient blessé, et c'est toute la
  --  décision du 18 novembre.
  select coalesce(jsonb_agg(jsonb_build_object(
           'position',  m.position,
           'pokemonId', m.id,
           'nom',       m.nom_fr,
           'surnom',    m.surnom,
           'niveau',    m.niveau,
           'types',     to_jsonb(m.types),
           'pv',        pv_dans_le_sujet(v_sujet, m.id, m.pvmax),
           'pvMax',     m.pvmax,
           'attaque',   stat_au_niveau(m.att_base, m.niveau),
           'defense',   stat_au_niveau(m.def_base, m.niveau),
           'capacites', m.capacites
         ) order by m.position asc nulls last, m.capture_le asc), '[]'::jsonb)
    into v_equipe
    from (
      select pk.id, pk.position, pk.surnom, pk.niveau, pk.capture_le,
             e.nom_fr, e.types, e.att_base, e.def_base,
             pv_au_niveau(e.pv_base, pk.niveau) as pvmax,
             coalesce((
               select jsonb_agg(jsonb_build_object(
                        'id', c.id, 'nom', c.nom, 'type', c.type,
                        'puissance', c.puissance, 'precision', c."precision"
                      ) order by pc.position)
                 from pokemon_capacite pc join capacite c on c.id = pc.capacite_id
                where pc.pokemon_id = pk.id
             ), '[]'::jsonb) as capacites
        from pokemon pk join espece e on e.id = pk.espece_id
       where pk.joueur_id = v_c.joueur_id and pk.emplacement = 'equipe'
    ) m;

  return jsonb_build_object(
    'combatId', v_c.id,
    'sujetId',  v_c.sujet_id,
    'joueurId', v_c.joueur_id,
    'tour',     v_c.tour,
    'sauvage', jsonb_build_object(
      'especeId',  v_c.espece_id,
      'nom',       v_esp.nom_fr,
      'niveau',    v_c.niveau_sauvage,
      'types',     to_jsonb(v_esp.types),
      'pv',        v_c.pv_sauvage,
      'pvMax',     v_c.pv_sauvage_max,
      'attaque',   stat_au_niveau(v_esp.att_base, v_c.niveau_sauvage),
      'defense',   stat_au_niveau(v_esp.def_base, v_c.niveau_sauvage),
      --  POUR LA POKÉ BALL. Il est ici et pas ailleurs parce que c'est
      --  la même lecture : un appel de plus pour un chiffre qu'on avait
      --  déjà sous la main serait un aller-retour pour rien.
      'capture',   v_esp.capture_base,
      'capacites', v_leurs
    ),
    'combattant', case when v_pok.id is null then null else jsonb_build_object(
      'pokemonId', v_pok.id,
      'nom',       v_pok.nom_fr,
      'surnom',    v_pok.surnom,
      'niveau',    v_pok.niveau,
      'types',     to_jsonb(v_pok.types),
      'pv',        v_c.pv_pokemon,
      'pvMax',     v_c.pv_pokemon_max,
      'attaque',   stat_au_niveau(v_pok.att_base, v_pok.niveau),
      'defense',   stat_au_niveau(v_pok.def_base, v_pok.niveau),
      'capacites', coalesce(v_siens, '[]'::jsonb)
    ) end,
    'equipe', v_equipe,
    --  LE SAC, parce que la Poké Ball et les objets en ont besoin et
    --  que c'est encore la même lecture.
    --
    --  AVEC LE SLUG ET LA FAMILLE, pas seulement la quantité : le
    --  domaine choisit le multiplicateur d'une ball et le soin d'une
    --  potion PAR SON SLUG — « quick-ball », « super-potion » — et
    --  aller les chercher par un second appel serait un aller-retour
    --  pour une ligne qu'on avait déjà jointe.
    --
    --  Les quantités sont celles de la BASE : ce que le registre du
    --  sujet a déjà consommé n'est pas déduit ici, il l'est à la
    --  clôture comme tout le reste.
    'sac', coalesce((
      select jsonb_agg(jsonb_build_object(
               'objetId',  s.objet_id,
               'quantite', s.quantite,
               'slug',     o.slug,
               'nom',      o.nom,
               'famille',  o.famille
             ) order by o.famille, o.id)
        from sac s join objet o on o.id = s.objet_id
       where s.joueur_id = v_c.joueur_id and s.quantite > 0
    ), '[]'::jsonb)
  );
end $$ language plpgsql stable security definer set search_path = public, extensions;

revoke all on function combat_pour_jouer(jsonb) from public, anon, authenticated;
grant execute on function combat_pour_jouer(jsonb) to service_role;

comment on function combat_pour_jouer(jsonb) is
  'Tout ce qu''il faut pour résoudre un tour : les deux combattants '
  'avec leurs capacités, l''équipe entière avec ses PV dans ce sujet, '
  'le taux de capture du sauvage et le sac. Une seule lecture — six '
  'appels pour afficher six Pokémon seraient six fois le même '
  'aller-retour.';
