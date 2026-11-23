-- ════════════════════════════════════════════════════════════════════
--  0070 · Les chromatiques
--
--  « Comment sont gérés les chromatiques ? » — 23 novembre.
--
--  Réponse mesurée ce jour-là : **ils ne l'étaient pas.** Une phrase
--  d'affichage dans le fil de vie — « a capturé X chromatique » — que
--  personne n'écrivait jamais, et une médaille validée à la main. Pas
--  de colonne, pas de tirage, pas de sprite.
--
--  « On peut faire un peu plus généreux pour le forum ? Ce serait bien
--  qu'il se tire à chaque rencontre aussi. »
--
--  ── LE TIRAGE EST DANS LE DOMAINE, PAS ICI ──────────────────────────
--
--  `CHANCE_CHROMATIQUE = 1/512` vit dans `src/domaine/rencontre.ts`,
--  avec le reste du tirage, et il est TROISIÈME dans la suite
--  pseudo-aléatoire — après l'espèce et le niveau. Mis en tête, il
--  aurait déplacé toutes les rencontres déjà jouées, et un tirage
--  contesté ne se rejouerait plus à l'identique.
--
--  La base ne tire rien. Elle enregistre ce que le tirage a décidé,
--  comme pour l'espèce et le niveau. C'est le même partage que les
--  évolutions (0063) : **la règle décide, la base constate.**
--
--  ── DEUX COLONNES, ET LA SECONDE VIENT DE LA PREMIÈRE ───────────────
--
--  `combat.chromatique` : décidé à la rencontre, donc écrit à
--  l'ouverture du combat et plus jamais touché.
--
--  `pokemon.chromatique` : recopié à la capture. Il ne se recalcule
--  pas — un Pokémon capturé est un individu, et son éclat ne dépend
--  plus du tirage qui l'a fait apparaître.
--
--  **ET C'EST POURQUOI ON NE PEUT PAS LE DÉDUIRE.** On aurait pu ne
--  rien stocker sur `pokemon` et remonter au combat d'origine par
--  `capture_dans`. Mais `capture_dans` est le SUJET, pas le combat ;
--  un sujet de chasse en contient plusieurs, et deux captures de la
--  même espèce dans le même sujet seraient indiscernables. Une
--  colonne qui se déduit mal est une colonne qu'on finit par lire de
--  travers.
--
--  ── CE QUI SE VOIT TOUT DE SUITE, SANS RIEN D'AUTRE ─────────────────
--
--  La relève écrit déjà `croise` et `capture` dans le registre, et
--  `vie.ts` sait déjà dire « a capturé Vivaldaim chromatique » — cette
--  phrase attendait depuis le début qu'on lui écrive `chromatique:
--  true` dans sa charge. Elle va enfin servir.
-- ════════════════════════════════════════════════════════════════════

alter table combat
  add column if not exists chromatique boolean not null default false;

alter table pokemon
  add column if not exists chromatique boolean not null default false;

comment on column combat.chromatique is
  'Décidé au tirage de la rencontre (CHANCE_CHROMATIQUE dans '
  'src/domaine/rencontre.ts), écrit à l''ouverture, jamais retouché. '
  'La base ne tire rien : elle constate ce que la règle a décidé '
  '(0070).';
comment on column pokemon.chromatique is
  'Recopié du combat à la capture. Il ne se déduit PAS de '
  '`capture_dans`, qui est le sujet et non le combat : un sujet de '
  'chasse en contient plusieurs, et deux captures de la même espèce y '
  'seraient indiscernables (0070).';

--  ── L'INDEX SERT À UNE SEULE QUESTION, ET ELLE SERA POSÉE ───────────
--
--  « Qui a des chromatiques ? » — pour le bottin, pour une médaille,
--  pour une annonce. Partiel, parce que la réponse « non » concerne
--  99,8 % des lignes et n'a aucun intérêt à être indexée.
create index if not exists pokemon_chromatiques
  on pokemon (joueur_id) where chromatique;

--  ── OUVRIR UN COMBAT, AVEC L'ÉCLAT ──────────────────────────────────
--
--  RÉ-ÉMISE DEPUIS SA VERSION DE LA 0049, mot pour mot, avec trois
--  ajouts et rien d'autre : la variable, la colonne dans l'insertion,
--  la clé dans le retour.
--
--  J'en avais d'abord écrit une de mémoire. Elle perdait
--  `pv_dans_le_sujet` — donc les PV repartaient à plein à chaque
--  rencontre d'un même sujet, et les Potions ne servaient plus à rien
--  —, elle levait là où l'originale rendait une raison, et elle
--  changeait la forme du retour. **Une fonction qu'on réécrit de tête
--  est une fonction qu'on casse en silence.**
create or replace function ouvrir_un_combat(p jsonb)
returns jsonb as $$
declare
  v_sujet    integer  := (p->>'sujetId')::integer;
  v_message  integer  := (p->>'messageId')::integer;
  v_joueur   uuid     := (p->>'joueurId')::uuid;
  v_espece   integer  := (p->>'especeId')::integer;
  v_niveau   smallint := (p->>'niveau')::smallint;
  --  ── UN DÉFAUT, ET CE N'EST PAS DE LA COMPLAISANCE ───────────────
  --
  --  La relève et la base ne se déploient pas à la même seconde.
  --  Entre le `supabase db push` et le déploiement de la fonction,
  --  l'une des deux appelle l'autre avec l'ancienne forme — et sans
  --  ce `coalesce`, TOUTE rencontre lèverait pendant ce laps de
  --  temps. Un `false` de trop est une rencontre ordinaire ; une
  --  exception, c'est la chasse arrêtée pour tout le monde.
  v_chroma   boolean  := coalesce((p->>'chromatique')::boolean, false);
  v_deja     combat%rowtype;
  v_ouvert   uuid;
  v_pok      record;
  v_pvs      integer;
  v_pvp      integer := 0;
  v_pvpmax   integer := 0;
  v_pokemon  uuid;
  v_id       uuid;
begin
  if v_sujet is null or v_message is null or v_joueur is null then
    raise exception 'COMBAT_PARAMETRES_MANQUANTS';
  end if;
  if v_niveau is null or v_niveau < 1 or v_niveau > 100 then
    raise exception 'NIVEAU_HORS_BORNES';
  end if;

  --  Déjà ouvert sur ce message : on rend celui-là. Pas une erreur,
  --  pas une remise à zéro — une relecture.
  select * into v_deja from combat where message_id = v_message;
  if found then
    return jsonb_build_object(
      'combatId', v_deja.id, 'ouvert', false, 'etat', v_deja.etat,
      'tour', v_deja.tour, 'raison', 'DEJA_LU'
    );
  end if;

  --  Un autre combat court dans ce sujet. On ne lève pas : le joueur
  --  n'a rien fait de mal, il a cliqué pendant qu'un combat tournait.
  select id into v_ouvert from combat where sujet_id = v_sujet and etat = 'ouvert';
  if v_ouvert is not null then
    return jsonb_build_object(
      'combatId', v_ouvert, 'ouvert', false, 'raison', 'COMBAT_EN_COURS'
    );
  end if;

  --  Les PV du sauvage, par la formule du forum (0045). Un sauvage
  --  arrive toujours entier : c'est une rencontre, pas une reprise.
  select pv_au_niveau(e.pv_base, v_niveau) into v_pvs
    from espece e where e.id = v_espece;
  if v_pvs is null then
    raise exception 'ESPECE_INCONNUE';
  end if;

  --  Le combattant : le PREMIER de l'équipe, position la plus basse.
  --  `position` est un mot réservé de PostgreSQL, d'où le préfixe.
  select pk.id, pk.niveau, e.pv_base
    into v_pok
    from pokemon pk
    join espece e on e.id = pk.espece_id
   where pk.joueur_id = v_joueur and pk.emplacement = 'equipe'
   order by pk.position asc nulls last, pk.capture_le asc
   limit 1;

  if found then
    v_pokemon := v_pok.id;
    v_pvpmax  := pv_au_niveau(v_pok.pv_base, v_pok.niveau);
    --  ── LA LIGNE DE LA 0049 ─────────────────────────────────────────
    --
    --  Il arrive COMME IL EST. Deux rencontres dans le même sujet, et
    --  la seconde se joue avec le Pokémon qu'on a — pas avec un
    --  Pokémon neuf. C'est ce que « ils se soignent à la clôture » veut
    --  dire, et c'est ce qui rend les Potions utiles.
    v_pvp := pv_dans_le_sujet(v_sujet, v_pokemon, v_pvpmax);
  end if;

  insert into combat (
    sujet_id, message_id, joueur_id, espece_id, niveau_sauvage,
    pv_sauvage, pv_sauvage_max, pokemon_id, pv_pokemon, pv_pokemon_max,
    chromatique
  ) values (
    v_sujet, v_message, v_joueur, v_espece, v_niveau,
    v_pvs, v_pvs, v_pokemon, v_pvp, v_pvpmax,
    v_chroma
  ) returning id into v_id;

  return jsonb_build_object(
    'combatId',   v_id,
    'ouvert',     true,
    'combattant', v_pokemon,
    'pvSauvage',  v_pvs,
    'pvPokemon',  v_pvp,
    'pvPokemonMax', v_pvpmax,
    --  LE RENDRE PLUTÔT QUE DE LE FAIRE RELIRE : l'appelant vient de
    --  le décider, mais c'est la base qui dit ce qu'elle a écrit.
    'chromatique', v_chroma
  );
end $$ language plpgsql security definer set search_path = public, extensions;

revoke all on function ouvrir_un_combat(jsonb) from public;
grant execute on function ouvrir_un_combat(jsonb) to service_role;


--  ── ET L'ÉTAT DU COMBAT LE PORTE ────────────────────────────────────
--
--  RÉ-ÉMISE DEPUIS SA VERSION DE LA 0061, mot pour mot, avec UNE ligne
--  de plus. C'est `jouer_un_tour` qui écrit la ligne `capture` du
--  registre, et il la construit depuis cet état : sans l'éclat ici,
--  un chromatique capturé entrerait dans la boîte comme un Pokémon
--  ordinaire, et plus rien ne pourrait le retrouver.

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

  --  ── LES CAPACITÉS D'EN FACE (0061) ─────────────────────────────
  --
  --  DANS UN DUEL, CE SONT CELLES QU'IL A CHOISIES — on lit la table
  --  de liaison, pas la fonction de dotation. C'est toute la
  --  différence avec un sauvage : un sauvage n'a jamais choisi.
  if v_c.genre = 'duel' then
    select coalesce(jsonb_agg(jsonb_build_object(
             'id', c.id, 'nom', c.nom, 'type', c.type,
             'puissance', c.puissance, 'precision', c."precision"
           ) order by pc.position), '[]'::jsonb)
      into v_leurs
      from pokemon_capacite pc join capacite c on c.id = pc.capacite_id
     where pc.pokemon_id = v_c.adverse_pokemon_id;
  else
    --  Les capacités du sauvage, tirées à son niveau : il joue avec les
    --  mêmes règles que les autres.
    select coalesce(jsonb_agg(jsonb_build_object(
             'id', c.id, 'nom', c.nom, 'type', c.type,
             'puissance', c.puissance, 'precision', c."precision"
           ) order by c.id), '[]'::jsonb)
      into v_leurs
      from capacite c
     where c.id = any (capacites_de_depart(v_c.espece_id, v_c.niveau_sauvage));
  end if;

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
       --  L'ÉQUIPE DE CELUI DONT C'EST LE TOUR (0061). Hors duel,
       --  `a_qui` est nul et c'est celle du joueur du combat — ce qui
       --  était le seul cas. Dans un duel, servir toujours celle du
       --  défieur donnerait à l'autre une liste de Pokémon qui ne sont
       --  pas les siens au moment de changer.
       where pk.joueur_id = coalesce(v_c.a_qui, v_c.joueur_id)
         and pk.emplacement = 'equipe'
    ) m;

  return jsonb_build_object(
    'combatId', v_c.id,
    'sujetId',  v_c.sujet_id,
    'joueurId', v_c.joueur_id,
    'tour',     v_c.tour,
    --  ── CE QUE LE DUEL AJOUTE (0061) ─────────────────────────────
    --
    --  `genre` d'abord, parce que tout le reste en dépend. Puis les
    --  deux identifiants d'en face — pour écrire l'expérience et les
    --  PV du bon Pokémon — et `aQui`, qui dit de qui on attend le
    --  prochain message.
    'genre',    v_c.genre,
    'adverseJoueurId',  v_c.adverse_joueur_id,
    'adversePokemonId', v_c.adverse_pokemon_id,
    'aQui',     v_c.a_qui,
    'sauvage', jsonb_build_object(
      'especeId',  v_c.espece_id,
      --  ── L'ÉCLAT, POUR QUE LA CAPTURE PUISSE LE RECOPIER ─────────
      --
      --  Il est décidé au tirage de la rencontre et écrit sur la
      --  ligne du combat (0070). Il remonte ici parce que c'est
      --  `jouer_un_tour` qui écrit la ligne `capture` du registre, et
      --  qu'un chromatique capturé doit rester chromatique dans la
      --  boîte. Sans ce chemin, l'éclat mourait avec le combat.
      'chromatique', v_c.chromatique,
      --  LE SURNOM D'EN FACE, quand c'est le Pokémon d'un joueur : il
      --  l'a nommé, et le message doit l'appeler par son nom.
      'surnom',    case when v_c.genre = 'duel'
                        then (select pk.surnom from pokemon pk
                               where pk.id = v_c.adverse_pokemon_id)
                        else null end,
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
       --  LE SAC DE CELUI DONT C'EST LE TOUR, même raison que
       --  l'équipe. Un duel n'autorise pas encore les objets, mais
       --  servir le sac du défieur à l'autre serait un piège posé pour
       --  le jour où il les autorisera.
       where s.joueur_id = coalesce(v_c.a_qui, v_c.joueur_id) and s.quantite > 0
    ), '[]'::jsonb)
  );
end $$ language plpgsql stable security definer set search_path = public, extensions;


--  ── ET LA CLÔTURE LE RANGE DANS LA BOÎTE ────────────────────────────
--
--  `appliquer_cloture`, RÉ-ÉMISE DEPUIS SA VERSION DE LA 0012, mot
--  pour mot, avec la colonne de plus dans une seule insertion.
--
--  C'est le dernier maillon : le tirage décide, le combat porte,
--  `jouer_un_tour` écrit la ligne du registre, et la clôture range le
--  Pokémon. Si celui-ci manquait, un chromatique capturé deviendrait
--  ordinaire au moment précis où le joueur croit l'avoir gagné.

create or replace function appliquer_cloture(p jsonb) returns jsonb as $$
declare
  v_sujet    bigint := (p->>'sujetId')::bigint;
  v_code     text   := p->>'code';
  versement  jsonb;
  effets     jsonb;
  v_joueur   uuid;
  v_premier  uuid := null;
  v_pokemon  uuid;
  n_joueurs  integer := 0;
begin
  if v_sujet is null then
    raise exception 'appliquer_cloture : sujetId manquant dans %', p::text;
  end if;
  if v_code is null or v_code = '' then
    raise exception 'appliquer_cloture : code manquant pour le sujet %', v_sujet;
  end if;
  if exists (select 1 from cloture c where c.sujet_id = v_sujet) then
    raise exception 'Le sujet % est déjà clôturé.', v_sujet;
  end if;
  if p->'versements' is null or jsonb_typeof(p->'versements') <> 'array' then
    raise exception 'appliquer_cloture : « versements » doit être un tableau';
  end if;

  for versement in select * from jsonb_array_elements(p->'versements') loop
    v_joueur := (versement->>'joueurId')::uuid;
    effets   := versement->'effets';
    if v_joueur is null then
      raise exception 'appliquer_cloture : un versement sans joueurId';
    end if;
    if effets is null or jsonb_typeof(effets) <> 'object' then
      raise exception 'appliquer_cloture : effets manquants pour le joueur %', v_joueur;
    end if;
    v_premier := coalesce(v_premier, v_joueur);
    n_joueurs := n_joueurs + 1;

    update sac s
       set quantite = s.quantite - d.quantite
      from (
        select (e->>'objetId')::int as objet_id, (e->>'quantite')::int as quantite
          from jsonb_array_elements(coalesce(effets->'objetsConsommes', '[]'::jsonb)) e
      ) d
     where s.joueur_id = v_joueur and s.objet_id = d.objet_id;

    insert into sac (joueur_id, objet_id, quantite)
    select v_joueur, (e->>'objetId')::int, (e->>'quantite')::int
      from jsonb_array_elements(coalesce(effets->'objetsAjoutes', '[]'::jsonb)) e
        on conflict (joueur_id, objet_id)
        do update set quantite = sac.quantite + excluded.quantite;

    --  ── L'ÉCLAT ENTRE DANS LA BOÎTE AVEC LE POKÉMON ──────────────
    --
    --  `coalesce(…, false)` : la clé n'est écrite que quand elle est
    --  vraie — une capture ordinaire ne la porte pas, et c'est
    --  l'immense majorité d'entre elles. Sans le `coalesce`, chacune
    --  insérerait un `null` dans une colonne `not null`.
    insert into pokemon (
      joueur_id, espece_id, niveau, emplacement, capture_dans, chromatique
    )
    select v_joueur, (e->>'especeId')::int, (e->>'niveau')::smallint, 'boite', v_sujet,
           coalesce((e->>'chromatique')::boolean, false)
      from jsonb_array_elements(coalesce(effets->'captures', '[]'::jsonb)) e;

    for v_pokemon in
      select (e->>'pokemonId')::uuid
        from jsonb_array_elements(coalesce(effets->'xpParPokemon', '[]'::jsonb)) e
    loop
      update pokemon q
         set xp = q.xp + d.gain
        from (
          select (e->>'gain')::int as gain
            from jsonb_array_elements(coalesce(effets->'xpParPokemon', '[]'::jsonb)) e
           where (e->>'pokemonId')::uuid = v_pokemon
        ) d
       where q.id = v_pokemon and q.joueur_id = v_joueur;
      perform monter_niveaux(v_pokemon);
    end loop;

    update joueur j
       set pokedollars = j.pokedollars + coalesce((effets->>'pokedollars')::int, 0)
     where j.id = v_joueur;

    insert into pokedex (joueur_id, espece_id, croise_le)
    select v_joueur, e::text::int,
           --  LA DATE DU REGISTRE, pas celle de la clôture : voir l'en-tête
           --  de cette section. `ranger_pokedex` lit la même source, et les
           --  deux fonctions disent donc la même date.
           coalesce(
             pokedex_date_du_registre(v_sujet, v_joueur, e::text::int),
             now())
      from jsonb_array_elements(coalesce(effets->'especesCroisees', '[]'::jsonb)) e
        on conflict (joueur_id, espece_id)
        do update set croise_le = least(pokedex.croise_le, excluded.croise_le);

    insert into pokedex (joueur_id, espece_id, croise_le, attrape_le)
    select v_joueur, (e->>'especeId')::int,
           coalesce(
             pokedex_date_du_registre(v_sujet, v_joueur, (e->>'especeId')::int),
             now()),
           coalesce(
             pokedex_date_du_registre(
               v_sujet, v_joueur, (e->>'especeId')::int, 'capture'),
             now())
      from jsonb_array_elements(coalesce(effets->'captures', '[]'::jsonb)) e
        on conflict (joueur_id, espece_id)
        do update set croise_le  = least(pokedex.croise_le, excluded.croise_le),
                      attrape_le = coalesce(pokedex.attrape_le, excluded.attrape_le);
  end loop;

  if n_joueurs = 0 then
    raise exception 'appliquer_cloture : aucun versement pour le sujet %', v_sujet;
  end if;

  --  Le bilan entre en base AVEC la clôture, dans la même transaction.
  --  C'est ce qui garantit qu'un bilan existe toujours pour toute clôture
  --  appliquée, même si le forum est injoignable à cet instant.
  insert into cloture (sujet_id, clos_par, resultat, code, bilan, mentionne)
  values (v_sujet, v_premier, p->'versements', v_code, p->>'bilan', p->>'mentionne');

  return jsonb_build_object('sujetId', v_sujet, 'joueurs', n_joueurs, 'code', v_code);
end $$ language plpgsql security definer;
