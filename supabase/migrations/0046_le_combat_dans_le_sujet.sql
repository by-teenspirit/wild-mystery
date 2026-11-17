-- ════════════════════════════════════════════════════════════════════
--  0046 · Le combat dans le sujet
--
--  « Quand je fais apparaître un pokémon, il faut qu'il s'affiche en
--  dessous de mon message, via un message du Maître du Jeu, et qu'on
--  ait ses stats, que ça engage un combat entre le premier pokémon de
--  mon équipe et le ponyta. » — 17 novembre 2026.
--
--  La planche 99 tient le raisonnement complet. Ce qui est en base,
--  c'est ce que le navigateur ne doit PAS avoir le droit de décider.
--
--  ── UN SEUL COMBAT OUVERT PAR SUJET, ET LA BASE LE TIENT ────────────
--
--  Deux combats dans un fil, c'est deux joueurs qui attaquent le même
--  Ponyta sans se voir, et un Maître du Jeu qui poste deux résultats
--  contradictoires sous le même message. Un index unique partiel le
--  rend impossible — pas une garde dans le navigateur, qu'un double
--  clic contourne.
--
--  ── ET UN SEUL PAR MESSAGE, CE QUI EST UNE AUTRE RÈGLE ──────────────
--
--  La relève RELIT. Elle relit chaque fois qu'un incident l'empêche
--  d'avancer le curseur, et c'est voulu (`parcourir-les-zones.ts`).
--  Sans contrainte, chaque relecture d'un « fais apparaître » rouvrirait
--  un combat : le joueur verrait son Ponyta revenir à pleine vie.
--
--  `unique (message_id)` ferme ça, exactement comme `(message_id, type)`
--  le ferme pour le registre. C'est la même idée payée une deuxième
--  fois : CE QUI EST DÉRIVÉ D'UN MESSAGE PORTE LE NUMÉRO DU MESSAGE.
--
--  ── LES ÉTATS : SIX, LÀ OÙ LA PLANCHE EN ANNONÇAIT CINQ ─────────────
--
--  La planche écrivait `ko`. On le coupe en deux — `victoire` et
--  `defaite` — parce que les deux ne produisent pas le même message du
--  Maître du Jeu, et surtout parce que l'expérience ne se verse que
--  dans un sens. Un seul mot aurait obligé à redemander « mais qui est
--  tombé ? » à chaque lecture, et à le recalculer depuis les PV : une
--  information qu'on possède au moment où elle est vraie ne se
--  recalcule pas plus tard.
--
--    ouvert    le combat court
--    capture   la Poké Ball a pris
--    fuite     l'un des deux est parti — le joueur, ou le sauvage au
--              cinquième tour (planche 99 §5.2)
--    victoire  le sauvage est tombé
--    defaite   le pokémon du joueur est tombé
--    expire    le sujet s'est clos avec un combat encore ouvert
--
--  ── LES PV SONT STOCKÉS, LE RESTE SE RECALCULE ──────────────────────
--
--  `pv_sauvage` et `pv_pokemon` changent à chaque tour : ils vivent
--  ici. L'attaque et la défense NON — elles se retrouvent toujours de
--  l'espèce et du niveau par `stat_au_niveau` (0045). Les ranger ici
--  les figerait le jour où une base de PokéAPI est corrigée, et deux
--  joueurs liraient des chiffres différents pour le même Pokémon.
--
--  Le MAXIMUM, lui, est rangé : il est affiché à chaque tour (« 14/19 »)
--  et le recalculer à chaque lecture coûterait une jointure pour une
--  valeur qui ne bouge pas de tout le combat.
-- ════════════════════════════════════════════════════════════════════

create table if not exists combat (
  id             uuid primary key default gen_random_uuid(),
  sujet_id       integer not null check (sujet_id > 0),
  --  LE MESSAGE QUI L'A OUVERT. C'est l'identité du combat vis-à-vis
  --  de la relève, et la graine de tout ce qui s'y tire.
  message_id     integer not null check (message_id > 0),
  --  À QUI EST LE COMBAT. Planche 99 §5.4 : dans un sujet à deux, il
  --  appartient à celui qui a fait apparaître le Pokémon ; l'autre
  --  voit la carte et ne peut pas agir.
  joueur_id      uuid    not null references joueur(id) on delete cascade,

  --  ── EN FACE ──────────────────────────────────────────────────────
  espece_id      integer  not null references espece(id),
  niveau_sauvage smallint not null check (niveau_sauvage between 1 and 100),
  pv_sauvage     smallint not null check (pv_sauvage >= 0),
  pv_sauvage_max smallint not null check (pv_sauvage_max > 0),

  --  ── DE CE CÔTÉ-CI ────────────────────────────────────────────────
  --
  --  NULLABLE, ET C'EST LE CAS QU'ON NE VEUT PLUS MAIS QU'ON GARDE.
  --  Depuis la 0043 tout le monde reçoit un starter, donc personne
  --  n'arrive en combat les mains vides. Mais un Pokémon peut être
  --  relâché ou mis en pension pendant que le combat court, et
  --  `on delete set null` vaut mieux qu'une ligne qui disparaît sous
  --  le joueur : la carte reste lisible, le combat se clôt proprement.
  pokemon_id     uuid references pokemon(id) on delete set null,
  pv_pokemon     smallint not null default 0 check (pv_pokemon >= 0),
  pv_pokemon_max smallint not null default 0 check (pv_pokemon_max >= 0),

  --  ── LE FIL DU COMBAT ─────────────────────────────────────────────
  --
  --  Zéro, c'est la carte de rencontre : elle est postée, personne n'a
  --  encore agi. Cinq est le plafond de la planche 99 §5.2 — « puis le
  --  Pokémon s'enfuit » —, et c'est lui qui borne le bruit dans le
  --  sujet : dix tours feraient vingt messages.
  tour           smallint not null default 0 check (tour between 0 and 5),
  etat           text not null default 'ouvert'
    check (etat in ('ouvert', 'capture', 'fuite', 'victoire', 'defaite', 'expire')),
  ouvert_le      timestamptz not null default now(),
  clos_le        timestamptz,

  --  UN COMBAT CLOS A UNE DATE, UN COMBAT OUVERT N'EN A PAS. Sans
  --  cette contrainte, « clos » et « clos_le » divergeraient en
  --  silence, et le jour où on compte les combats finis on compterait
  --  faux.
  constraint combat_clos_date check (
    (etat = 'ouvert' and clos_le is null) or (etat <> 'ouvert' and clos_le is not null)
  )
);

create unique index if not exists combat_un_par_message on combat (message_id);

create unique index if not exists combat_un_seul_ouvert_par_sujet
  on combat (sujet_id) where etat = 'ouvert';

create index if not exists combat_du_joueur on combat (joueur_id, ouvert_le desc);

comment on table combat is
  'Un combat sauvage dans un sujet. Un seul ouvert par sujet, un seul '
  'par message. Les PV vivent ici ; l''attaque et la défense se '
  'retrouvent de l''espèce et du niveau (0045).';

-- ════════════════════════════════════════════════════════════════════
--  OUVRIR UN COMBAT
--
--  Appelée par la relève quand une recherche a donné une rencontre.
--  Elle fait trois choses que le navigateur ne doit pas faire : elle
--  choisit le combattant, elle calcule les PV, et elle refuse le
--  deuxième combat.
--
--  ELLE EST IDEMPOTENTE, et c'est sa qualité principale. Appelée deux
--  fois sur le même message — ce qui arrivera — elle rend le combat
--  déjà ouvert, sans rien remettre à zéro. La relève peut donc relire
--  un sujet sans soigner personne.
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
  v_pokemon  uuid;
  v_id       uuid;
begin
  if v_sujet is null or v_message is null or v_joueur is null then
    raise exception 'COMBAT_PARAMETRES_MANQUANTS';
  end if;
  if v_niveau is null or v_niveau < 1 or v_niveau > 100 then
    raise exception 'NIVEAU_HORS_BORNES';
  end if;

  --  DÉJÀ OUVERT SUR CE MESSAGE : on rend celui-là. Pas une erreur,
  --  pas une remise à zéro — une relecture.
  select * into v_deja from combat where message_id = v_message;
  if found then
    return jsonb_build_object(
      'combatId', v_deja.id, 'ouvert', false, 'etat', v_deja.etat,
      'tour', v_deja.tour, 'raison', 'DEJA_LU'
    );
  end if;

  --  UN AUTRE COMBAT COURT DANS CE SUJET. On ne lève pas : le joueur
  --  n'a rien fait de mal, il a cliqué pendant qu'un combat tournait.
  --  La relève le note, le Maître du Jeu ne poste rien.
  select id into v_ouvert from combat where sujet_id = v_sujet and etat = 'ouvert';
  if v_ouvert is not null then
    return jsonb_build_object(
      'combatId', v_ouvert, 'ouvert', false, 'raison', 'COMBAT_EN_COURS'
    );
  end if;

  --  LES PV DU SAUVAGE, par la formule du forum (0045).
  select pv_au_niveau(e.pv_base, v_niveau) into v_pvs
    from espece e where e.id = v_espece;
  if v_pvs is null then
    raise exception 'ESPECE_INCONNUE';
  end if;

  --  LE COMBATTANT : le PREMIER de l'équipe, position la plus basse.
  --  C'est la règle que Callista a posée — « un combat entre le
  --  premier pokémon de mon équipe et le ponyta » — et `position` est
  --  un mot réservé de PostgreSQL, d'où le préfixe. (Trouvé par la
  --  suite pgTAP en montant la 0044 : `min(position)` ne compile pas.)
  select pk.id, pk.niveau, e.pv_base
    into v_pok
    from pokemon pk
    join espece e on e.id = pk.espece_id
   where pk.joueur_id = v_joueur and pk.emplacement = 'equipe'
   order by pk.position asc nulls last, pk.capture_le asc
   limit 1;

  if found then
    v_pokemon := v_pok.id;
    v_pvp := pv_au_niveau(v_pok.pv_base, v_pok.niveau);
  end if;

  insert into combat (
    sujet_id, message_id, joueur_id, espece_id, niveau_sauvage,
    pv_sauvage, pv_sauvage_max, pokemon_id, pv_pokemon, pv_pokemon_max
  ) values (
    v_sujet, v_message, v_joueur, v_espece, v_niveau,
    v_pvs, v_pvs, v_pokemon, v_pvp, v_pvp
  ) returning id into v_id;

  return jsonb_build_object(
    'combatId', v_id,
    'ouvert',   true,
    --  SANS POKÉMON, LA RENCONTRE RESTE UNE RENCONTRE (planche 99
    --  §5.3). La ligne existe quand même : la carte s'affiche, et la
    --  Poké Ball se lancera directement. Mais la réponse le dit, pour
    --  que le Maître du Jeu ne poste pas un combat qui n'aura pas lieu.
    'combattant', v_pokemon,
    'pvSauvage', v_pvs,
    'pvPokemon', v_pvp
  );
end $$ language plpgsql security definer set search_path = public, extensions;

comment on function ouvrir_un_combat(jsonb) is
  'Ouvre un combat sauvage sur un sujet, ou rend celui qui est déjà '
  'là. Idempotente par le numéro du message : la relève relit sans '
  'soigner personne.';

-- ════════════════════════════════════════════════════════════════════
--  FERMER UN COMBAT
--
--  Un seul chemin pour les cinq fins, parce qu'il y a une chose à ne
--  jamais oublier — la date — et qu'une contrainte la réclame.
-- ════════════════════════════════════════════════════════════════════

create or replace function fermer_un_combat(p_id uuid, p_etat text)
returns boolean as $$
declare
  v_fait integer;
begin
  if p_etat = 'ouvert' or p_etat is null then
    raise exception 'ETAT_DE_FERMETURE_INVALIDE';
  end if;

  --  `where etat = 'ouvert'` : refermer un combat clos ne doit pas
  --  changer sa fin ni sa date. Le premier mot l'emporte, comme la
  --  première demande de clôture l'emporte dans un sujet.
  update combat set etat = p_etat, clos_le = now()
   where id = p_id and etat = 'ouvert';
  get diagnostics v_fait = row_count;
  return v_fait = 1;
end $$ language plpgsql security definer set search_path = public, extensions;

comment on function fermer_un_combat(uuid, text) is
  'Ferme un combat ouvert et date la fin. Rend faux s''il était déjà '
  'clos : la première fin l''emporte.';

-- ════════════════════════════════════════════════════════════════════
--  LE COMBAT OUVERT D'UN SUJET
--
--  C'est ce que la barre d'actions demande pour savoir quels boutons
--  servir (planche 99 §4). Elle le demande AVEC LA CLÉ PUBLIABLE,
--  depuis le navigateur, donc la fonction ne rend que ce qui peut
--  s'afficher : rien qui ne soit déjà sur la carte postée dans le
--  sujet.
-- ════════════════════════════════════════════════════════════════════

create or replace function combat_du_sujet(p_sujet integer)
returns jsonb as $$
  select jsonb_build_object(
    'combatId',   c.id,
    'joueurId',   c.joueur_id,
    'especeId',   c.espece_id,
    'nom',        e.nom_fr,
    'niveau',     c.niveau_sauvage,
    'types',      to_jsonb(e.types),
    'pvSauvage',  c.pv_sauvage,
    'pvSauvageMax', c.pv_sauvage_max,
    'pokemonId',  c.pokemon_id,
    'pvPokemon',  c.pv_pokemon,
    'pvPokemonMax', c.pv_pokemon_max,
    'tour',       c.tour
  )
  from combat c join espece e on e.id = c.espece_id
  where c.sujet_id = p_sujet and c.etat = 'ouvert';
$$ language sql stable security definer set search_path = public, extensions;

comment on function combat_du_sujet(integer) is
  'Le combat ouvert d''un sujet, ou rien. Sert à la barre d''actions '
  'pour choisir ses boutons ; ne rend que ce qui est déjà affiché '
  'dans le sujet.';

-- ── LES PERMISSIONS ──────────────────────────────────────────────────
--
--  LA TABLE EST AU SERVEUR. Personne n'écrit un combat depuis le
--  navigateur : les PV sont le score, et un score qu'on peut poser
--  soi-même n'est pas un score.
--
--  La lecture passe par la clé de carnet, comme le reste — et par
--  `combat_du_sujet`, qui est la seule porte dont la barre a besoin.

alter table combat enable row level security;

drop policy if exists "chacun lit ses combats" on combat;
create policy "chacun lit ses combats" on combat
  for select using (
    exists (
      select 1 from joueur j
       where j.id = combat.joueur_id
         and j.cle_de_carnet = current_setting('request.headers', true)::json ->> 'x-wm-carnet'
    )
  );

grant select on combat to anon, authenticated;

revoke all on function ouvrir_un_combat(jsonb) from public;
revoke all on function ouvrir_un_combat(jsonb) from anon, authenticated;
grant execute on function ouvrir_un_combat(jsonb) to service_role;

revoke all on function fermer_un_combat(uuid, text) from public;
revoke all on function fermer_un_combat(uuid, text) from anon, authenticated;
grant execute on function fermer_un_combat(uuid, text) to service_role;

revoke all on function combat_du_sujet(integer) from public;
grant execute on function combat_du_sujet(integer) to anon, authenticated, service_role;
