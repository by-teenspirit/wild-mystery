-- ════════════════════════════════════════════════════════════════════
--  0049 · Les PV dans le sujet
--
--  Décision de Callista, 18 novembre : « ils se soignent à la
--  clôture ». Les PV comptent pendant tout le sujet — changer de
--  Pokémon ne soigne pas, revenir ne soigne pas — puis tout le monde
--  repart entier quand le sujet se clôt.
--
--  ── POURQUOI CETTE DÉCISION ÉTAIT BLOQUANTE ─────────────────────────
--
--  « Changer de Pokémon » demande où sont les PV de celui qui sort. Il
--  y avait trois réponses possibles, et elles ne coûtent pas le même
--  jeu :
--
--  · les PV ne durent que le combat → les Potions du catalogue ne
--    servent qu'à tenir cinq tours ;
--  · les PV restent entamés pour toujours → il faut un moyen de
--    soigner, donc un Centre Pokémon, donc une décision de plus ;
--  · les PV durent le sujet → les Potions servent dans un sujet long,
--    et il n'y a rien à gérer entre deux RP.
--
--  C'est la troisième. On ne devinait pas : revenir dessus aurait voulu
--  dire une migration, un moyen de soigner, et des joueurs déjà
--  habitués au contraire.
--
--  ── UNE SEULE VÉRITÉ, ET UNE COPIE QUI NE PEUT PAS DIVERGER ─────────
--
--  `combat.pv_pokemon` existe depuis la 0046 et sert à la carte et au
--  message de tour. Cette table-ci porte les PV de TOUS les Pokémon du
--  joueur dans ce sujet, celui qui se bat compris.
--
--  C'est une copie, et une copie se met à mentir — sauf si une seule
--  fonction écrit les deux, dans la même transaction. C'est le cas :
--  `jouer_un_tour` et `ouvrir_un_combat` sont les seuls à toucher aux
--  PV, et une assertion pgTAP vérifie qu'ils s'accordent après un tour.
--
--  ── POURQUOI UN DÉCLENCHEUR SUR LA CLÔTURE ──────────────────────────
--
--  Le soin doit partir quand le sujet se clôt, et la clôture est UNE
--  transaction : `appliquer_cloture`. La tentation était de rouvrir
--  cette fonction pour y ajouter un `delete`.
--
--  ON NE LA ROUVRE PAS. Elle a déjà été réécrite deux fois cette
--  semaine, et les deux fois quelque chose est revenu en arrière — les
--  six maisons aux anciens noms, le `lower()` sur l'adresse. Une
--  fonction réécrite en entier ramène tout ce qu'on n'a pas relu.
--
--  Un déclencheur sur `cloture` dit la même chose sans toucher à une
--  ligne de ce qui marche : le sujet se clôt, les PV de ce sujet
--  disparaissent. C'est la même mécanique qu'un `on delete cascade`,
--  et pour la même raison — une règle de durée de vie se tient par la
--  base, pas par la mémoire de l'appelant.
-- ════════════════════════════════════════════════════════════════════

create table if not exists pv_du_sujet (
  sujet_id   integer not null check (sujet_id > 0),
  pokemon_id uuid    not null references pokemon(id) on delete cascade,
  pv         smallint not null check (pv >= 0),
  --  Pour savoir qui a été blessé en dernier, quand on regarde une
  --  ligne et qu'on se demande d'où elle vient.
  touche_le  timestamptz not null default now(),
  primary key (sujet_id, pokemon_id)
);

comment on table pv_du_sujet is
  'Les PV d''un Pokémon pour la durée d''un sujet. Écrite par '
  'jouer_un_tour, lue à l''ouverture d''un combat, effacée par le '
  'déclencheur de clôture — « ils se soignent à la clôture », '
  '18 novembre 2026.';

comment on column pv_du_sujet.pv is
  'Les PV restants. Zéro veut dire à terre, et à terre ne se soigne '
  'pas tout seul : il faut un objet, ou la clôture du sujet.';

-- ── LE SOIN, QUAND LE SUJET SE CLÔT ──────────────────────────────────

create or replace function soigner_a_la_cloture()
returns trigger as $$
begin
  delete from pv_du_sujet where sujet_id = new.sujet_id;
  return new;
end $$ language plpgsql security definer set search_path = public, extensions;

drop trigger if exists cloture_soigne_le_sujet on cloture;
create trigger cloture_soigne_le_sujet
  after insert on cloture
  for each row execute function soigner_a_la_cloture();

--  ET PERSONNE NE L'APPELLE À LA MAIN. Un déclencheur se déclenche
--  avec les droits du propriétaire de la table : il n'a aucun besoin
--  d'un `execute` pour PUBLIC, et l'assertion n° 118 de la suite le dit
--  depuis des semaines — « aucune fonction security definer n'est
--  exécutable par PUBLIC ». Elle m'a attrapé à la première montée.
revoke all on function soigner_a_la_cloture() from public, anon, authenticated;

comment on function soigner_a_la_cloture() is
  'Efface les PV du sujet qui vient de se clore : tout le monde repart '
  'entier. Un déclencheur plutôt qu''une ligne dans appliquer_cloture, '
  'qu''on ne rouvre pas — une fonction réécrite en entier ramène tout '
  'ce qu''on n''a pas relu.';

-- ════════════════════════════════════════════════════════════════════
--  LIRE ET ÉCRIRE LES PV D'UN SUJET
--
--  Deux fonctions minuscules, et elles existent pour que personne
--  n'écrive ce `insert … on conflict` une seconde fois ailleurs.
-- ════════════════════════════════════════════════════════════════════

create or replace function pv_dans_le_sujet(
  p_sujet integer, p_pokemon uuid, p_defaut integer
) returns integer as $$
  --  LE DÉFAUT EST DONNÉ PAR L'APPELANT, et c'est volontaire : les PV
  --  au maximum dépendent de l'espèce et du niveau, que cette fonction
  --  n'a pas à rechercher. Un Pokémon sans ligne n'a pas été blessé
  --  dans ce sujet : il entre entier.
  select coalesce(
    (select pv from pv_du_sujet where sujet_id = p_sujet and pokemon_id = p_pokemon),
    p_defaut
  );
$$ language sql stable security definer set search_path = public, extensions;

create or replace function poser_les_pv(
  p_sujet integer, p_pokemon uuid, p_pv integer
) returns void as $$
  insert into pv_du_sujet (sujet_id, pokemon_id, pv)
  values (p_sujet, p_pokemon, p_pv)
  on conflict (sujet_id, pokemon_id)
    do update set pv = excluded.pv, touche_le = now();
$$ language sql security definer set search_path = public, extensions;

-- ════════════════════════════════════════════════════════════════════
--  OUVRIR UN COMBAT : LE COMBATTANT ARRIVE COMME IL EST
--
--  C'est le seul changement de `ouvrir_un_combat`, et il tient en une
--  ligne : ses PV ne sont plus forcément son maximum. Un joueur qui
--  enchaîne deux rencontres dans le même sujet se bat avec le Pokémon
--  qu'il a, pas avec un Pokémon neuf.
--
--  LA FONCTION EST RÉÉCRITE EN ENTIER, parce que PostgreSQL ne sait
--  pas faire autrement. Alors on relit, et on dit ce qu'on a relu :
--  les deux gardes (`DEJA_LU`, `COMBAT_EN_COURS`), les PV du sauvage
--  par la formule, le combattant choisi par `position asc nulls last`
--  puis `capture_le`, le `position` préfixé parce que c'est un mot
--  réservé. Tout est là.
-- ════════════════════════════════════════════════════════════════════

create or replace function ouvrir_un_combat(p jsonb)
returns jsonb as $$
declare
  v_sujet    integer  := (p->>'sujetId')::integer;
  v_message  integer  := (p->>'messageId')::integer;
  v_joueur   uuid     := (p->>'joueurId')::uuid;
  v_espece   integer  := (p->>'especeId')::integer;
  v_niveau   smallint := (p->>'niveau')::smallint;
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
    pv_sauvage, pv_sauvage_max, pokemon_id, pv_pokemon, pv_pokemon_max
  ) values (
    v_sujet, v_message, v_joueur, v_espece, v_niveau,
    v_pvs, v_pvs, v_pokemon, v_pvp, v_pvpmax
  ) returning id into v_id;

  return jsonb_build_object(
    'combatId',   v_id,
    'ouvert',     true,
    'combattant', v_pokemon,
    'pvSauvage',  v_pvs,
    'pvPokemon',  v_pvp,
    'pvPokemonMax', v_pvpmax
  );
end $$ language plpgsql security definer set search_path = public, extensions;

revoke all on function ouvrir_un_combat(jsonb) from public, anon, authenticated;
grant execute on function ouvrir_un_combat(jsonb) to service_role;

-- ════════════════════════════════════════════════════════════════════
--  JOUER UN TOUR : LES DEUX ÉCRITURES DANS LA MÊME TRANSACTION
--
--  Réécrite pour une seule raison : les PV du combattant vont
--  maintenant à DEUX endroits, et une copie qui s'écrit ailleurs est
--  une copie qui se met à mentir. Ici elles partent ensemble ou pas du
--  tout.
--
--  Relu avant de réécrire, et voici ce qui est là : les trois refus
--  (`DEJA_JOUE`, `COMBAT_CLOS`, `TOUR_DEPASSE`), les deux levées
--  (`TOUR_SANS_RECIT`, `FIN_INCONNUE`), le `for update` qui empêche
--  deux messages du même passage de lire le même numéro, et la date de
--  fin posée seulement quand il y a une fin.
-- ════════════════════════════════════════════════════════════════════

create or replace function jouer_un_tour(p jsonb)
returns jsonb as $$
declare
  v_combat  uuid     := (p->>'combatId')::uuid;
  v_message integer  := (p->>'messageId')::integer;
  v_numero  smallint := (p->>'numero')::smallint;
  v_demande text     := p->>'demande';
  v_pvj     smallint := (p->>'pvJoueur')::smallint;
  v_pvs     smallint := (p->>'pvSauvage')::smallint;
  v_fin     text     := nullif(p->>'fin', '');
  --  QUEL POKÉMON PORTE CES PV. Nul veut dire « celui qui se bat
  --  déjà » ; un changement de Pokémon le nomme, parce que les PV
  --  écrits sont alors ceux de l'ARRIVANT.
  v_porteur uuid     := nullif(p->>'pokemonId', '')::uuid;
  v_deja    combat_tour%rowtype;
  v_c       combat%rowtype;
  v_id      uuid;
begin
  if v_combat is null or v_message is null or v_numero is null then
    raise exception 'TOUR_PARAMETRES_MANQUANTS';
  end if;
  if p->'recit' is null or p->'recit' = 'null'::jsonb then
    raise exception 'TOUR_SANS_RECIT';
  end if;
  if v_fin is not null and v_fin not in ('victoire', 'defaite', 'fuite', 'capture') then
    raise exception 'FIN_INCONNUE';
  end if;

  select * into v_deja from combat_tour where message_id = v_message;
  if found then
    return jsonb_build_object(
      'tourId', v_deja.id, 'joue', false, 'numero', v_deja.numero,
      'raison', 'DEJA_JOUE'
    );
  end if;

  select * into v_c from combat where id = v_combat for update;
  if not found then
    raise exception 'COMBAT_INCONNU';
  end if;
  if v_c.etat <> 'ouvert' then
    return jsonb_build_object('joue', false, 'raison', 'COMBAT_CLOS');
  end if;
  if v_numero <> v_c.tour + 1 then
    return jsonb_build_object(
      'joue', false, 'raison', 'TOUR_DEPASSE', 'tour', v_c.tour
    );
  end if;

  insert into combat_tour (
    combat_id, message_id, numero, demande, detail, recit,
    pv_joueur, pv_sauvage, fin
  ) values (
    v_combat, v_message, v_numero, v_demande, p->'detail', p->'recit',
    v_pvj, v_pvs, v_fin
  ) returning id into v_id;

  update combat
     set pv_pokemon     = v_pvj,
         pv_sauvage     = v_pvs,
         tour           = v_numero,
         --  UN CHANGEMENT DE POKÉMON CHANGE LE COMBATTANT, et son
         --  maximum avec. `coalesce` garde l'ancien quand le tour ne
         --  nomme personne.
         pokemon_id     = coalesce(v_porteur, pokemon_id),
         pv_pokemon_max = coalesce(
           (p->>'pvPokemonMax')::smallint, pv_pokemon_max
         ),
         etat           = coalesce(v_fin, etat),
         clos_le        = case when v_fin is null then clos_le else now() end
   where id = v_combat;

  --  ── LES PV DU SUJET, DANS LA MÊME TRANSACTION ──────────────────
  --
  --  Celui qui ENCAISSE le coup est celui qui part sur le terrain ce
  --  tour-ci : le porteur quand le tour en nomme un, sinon celui qui
  --  s'y battait déjà.
  if coalesce(v_porteur, v_c.pokemon_id) is not null then
    perform poser_les_pv(v_c.sujet_id, coalesce(v_porteur, v_c.pokemon_id), v_pvj);
  end if;

  --  ET CELUI QUI SORT GARDE LES SIENS. C'est toute la décision du
  --  18 novembre : changer ne soigne pas, et revenir ne soigne pas.
  if v_porteur is not null and v_c.pokemon_id is not null
     and v_porteur <> v_c.pokemon_id then
    perform poser_les_pv(v_c.sujet_id, v_c.pokemon_id, v_c.pv_pokemon);
  end if;

  return jsonb_build_object(
    'tourId', v_id, 'joue', true, 'numero', v_numero, 'fin', v_fin
  );
end $$ language plpgsql security definer set search_path = public, extensions;

revoke all on function jouer_un_tour(jsonb) from public, anon, authenticated;
grant execute on function jouer_un_tour(jsonb) to service_role;

-- ── LES PERMISSIONS ──────────────────────────────────────────────────
--
--  LES PV SONT LE SCORE. On les lit avec sa clé de carnet, on ne les
--  écrit jamais depuis le navigateur.

alter table pv_du_sujet enable row level security;

drop policy if exists "chacun lit ses pv" on pv_du_sujet;
create policy "chacun lit ses pv" on pv_du_sujet
  for select using (
    exists (
      select 1 from pokemon pk join joueur j on j.id = pk.joueur_id
       where pk.id = pv_du_sujet.pokemon_id
         and j.cle_de_carnet = current_setting('request.headers', true)::json ->> 'x-wm-carnet'
    )
  );

grant select on pv_du_sujet to anon, authenticated;

revoke all on function pv_dans_le_sujet(integer, uuid, integer) from public, anon, authenticated;
revoke all on function poser_les_pv(integer, uuid, integer) from public, anon, authenticated;
