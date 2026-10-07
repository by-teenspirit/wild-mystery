-- ═══════════════════════════════════════════════════════════════════════
--  0006_bilans_en_attente.sql
--
--  LE DÉFAUT QU'ON CORRIGE, constaté en vrai le 2 octobre 2026.
--
--  `CloturerUnSujet` applique la clôture, PUIS poste le bilan. Ces deux
--  gestes ne sont pas atomiques : entre les deux il y a un forum, un
--  réseau, et un compte dont le mot de passe peut avoir expiré. Quand le
--  second a échoué ce jour-là, le sujet s'est retrouvé marqué clos sans
--  qu'aucun bilan ne soit publié — et comme il était clos, la relève a
--  répondu « déjà close » à tous les passages suivants. **Le joueur aurait
--  reçu ses objets sans jamais voir son bilan, et plus rien n'aurait
--  réessayé.**
--
--  Inverser l'ordre ne règle rien : poster d'abord puis échouer à
--  appliquer annoncerait un bilan qui n'a pas eu lieu, ce qui est pire.
--
--  La bonne réponse est de **garder le bilan avec la clôture** et de le
--  reposter jusqu'à ce qu'il passe. La clôture reste donc le point de
--  non-retour unique ; la publication devient une tâche à repasser, sans
--  danger puisque le marqueur permet de reconnaître un bilan déjà posté.
-- ═══════════════════════════════════════════════════════════════════════

alter table cloture add column if not exists bilan           text;
alter table cloture add column if not exists mentionne       text;
alter table cloture add column if not exists bilan_poste_le  timestamptz;
alter table cloture add column if not exists bilan_message_id bigint;
alter table cloture add column if not exists bilan_essais    integer not null default 0;
alter table cloture add column if not exists bilan_derniere_erreur text;

comment on column cloture.bilan is
  'Le texte à publier dans le sujet. Gardé ici pour pouvoir le reposter : '
  'la clôture est appliquée en une transaction, la publication ne l''est pas.';
comment on column cloture.bilan_poste_le is
  'Null tant que le bilan n''est pas publié. C''est la file d''attente.';

create index if not exists cloture_bilan_en_attente
    on cloture (clos_le) where bilan_poste_le is null and bilan is not null;

-- ── appliquer, en gardant le bilan à publier ──────────────────────────
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

    insert into pokemon (joueur_id, espece_id, niveau, emplacement, capture_dans)
    select v_joueur, (e->>'especeId')::int, (e->>'niveau')::smallint, 'boite', v_sujet
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
    select v_joueur, e::text::int, now()
      from jsonb_array_elements(coalesce(effets->'especesCroisees', '[]'::jsonb)) e
        on conflict (joueur_id, espece_id)
        do update set croise_le = least(pokedex.croise_le, excluded.croise_le);

    insert into pokedex (joueur_id, espece_id, croise_le, attrape_le)
    select v_joueur, (e->>'especeId')::int, now(), now()
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

-- ── la file d'attente ─────────────────────────────────────────────────
--  Les plus anciennes d'abord : un joueur qui attend depuis hier passe
--  avant celui qui attend depuis une minute.
create or replace function clotures_sans_bilan(p jsonb) returns jsonb as $$
  select coalesce(
    jsonb_agg(x order by x->>'closLe'),
    '[]'::jsonb
  )
  from (
    select jsonb_build_object(
             'sujetId', c.sujet_id,
             'code', c.code,
             'bilan', c.bilan,
             'mentionne', coalesce(c.mentionne, ''),
             'essais', c.bilan_essais,
             'closLe', to_char(c.clos_le, 'YYYY-MM-DD"T"HH24:MI:SSOF')
           ) as x
      from cloture c
     where c.bilan_poste_le is null
       and c.bilan is not null
     order by c.clos_le
     limit coalesce((p->>'combien')::int, 20)
  ) s;
$$ language sql stable security definer;

create or replace function cloture_bilan_poste(p jsonb) returns boolean as $$
declare n integer;
begin
  update cloture
     set bilan_poste_le = now(),
         bilan_message_id = (p->>'messageId')::bigint,
         bilan_derniere_erreur = null
   where sujet_id = (p->>'sujetId')::bigint
     and bilan_poste_le is null;
  get diagnostics n = row_count;
  return n > 0;
end $$ language plpgsql security definer;

--  On garde la dernière erreur et on compte les essais. Sans ça, un bilan
--  qui ne passera jamais — un sujet verrouillé, par exemple — tournerait
--  en silence à chaque passage sans que personne ne l'apprenne.
create or replace function cloture_bilan_echoue(p jsonb) returns integer as $$
declare n integer;
begin
  update cloture
     set bilan_essais = bilan_essais + 1,
         bilan_derniere_erreur = left(coalesce(p->>'erreur', 'sans détail'), 500)
   where sujet_id = (p->>'sujetId')::bigint
     and bilan_poste_le is null
  returning bilan_essais into n;
  return coalesce(n, 0);
end $$ language plpgsql security definer;

-- ── le pseudo d'un joueur ─────────────────────────────────────────────
--  Un bilan doit nommer les gens. Personne ne se reconnaît dans un UUID.
create or replace function pseudo_du_joueur(p jsonb) returns jsonb as $$
  select jsonb_build_object(
    'pseudo',
    (select j.pseudo from joueur j where j.id = (p->>'joueurId')::uuid)
  )
$$ language sql stable security definer;
