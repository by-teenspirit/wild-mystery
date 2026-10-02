-- ════════════════════════════════════════════════════════════════════════
--  WILD MYSTERY · le schéma Supabase
--  Première brique du code. Rien ici ne dépend du codage du forum.
--
--  Trois principes, tirés de 45-la-releve-et-le-bilan-d-un-sujet.md :
--   1. le registre est un JOURNAL, pas un solde — rien n'y est appliqué ;
--   2. tout est versé à la clôture, dans UNE transaction, ou rien ;
--   3. chaque événement est figé au moment du message, jamais recalculé.
--
--  À jouer dans l'éditeur SQL de Supabase, dans cet ordre.
-- ════════════════════════════════════════════════════════════════════════

create extension if not exists "pgcrypto";

-- ───────────────────────────────────────────────────────────────────────
--  1 · LES JOUEURS
--  Un compte Forumactif lié une fois pour toutes par « Lier mon compte ».
-- ───────────────────────────────────────────────────────────────────────
create table joueur (
  id              uuid primary key default gen_random_uuid(),
  forum_user_id   integer not null unique,          -- le N de /uN
  pseudo          text    not null,                 -- 28 caractères maximum, règlement
  groupe          text    check (groupe in ('ho-oh','reshiram','deoxys','xerneas','zamazenta','mew')),
  palier          smallint not null default 1 check (palier between 1 and 3),
  pokedollars     integer  not null default 0 check (pokedollars >= 0),
  pokeballs_lancees integer not null default 0,
  jeton           text    unique,                   -- le secret de liaison, usage unique
  lie_le          timestamptz,
  cree_le         timestamptz not null default now()
);
comment on column joueur.palier is 'Ouvre les zones. 1 = validé, 2, 3 = tous les badges.';

-- ───────────────────────────────────────────────────────────────────────
--  2 · LES DONNÉES DE RÉFÉRENCE
--  Le navigateur lit data/zones.json et data/faune.json depuis le dépôt ;
--  le serveur a besoin des mêmes données en table pour tirer et vérifier.
--  Une tâche de la relève resynchronise les deux.
-- ───────────────────────────────────────────────────────────────────────
create table espece (
  id            integer primary key,                -- l'id PokeAPI
  nom_fr        text not null,
  forme         text,                               -- 'alola', 'galar', 'hisui', null
  types         text[] not null,
  stade         smallint not null default 1,        -- 1 base, 2 intermédiaire, 3 final
  evolue_vers   integer references espece(id),
  niveau_evolution smallint,
  est_fossile   boolean not null default false,     -- ne sort jamais en zone sauvage
  pv_base       smallint not null default 45
);

create table zone (
  id          integer primary key,                  -- l'id du forum Forumactif
  nom         text not null,
  palier      smallint not null check (palier between 1 and 3),
  niveau_min  smallint not null,
  niveau_max  smallint not null,
  ordre       smallint not null
);

create table zone_espece (
  zone_id     integer not null references zone(id) on delete cascade,
  espece_id   integer not null references espece(id),
  niveau_min  smallint not null,
  niveau_max  smallint not null,
  rarete      smallint not null default 3 check (rarete between 1 and 5),
  condition   text,                                 -- 'jour','nuit','brume','pluie','orage', null
  primary key (zone_id, espece_id)
);

create table objet (
  id      integer generated always as identity primary key,
  slug    text not null unique,
  nom     text not null,
  famille text not null check (famille in ('ball','soin','pierre','fossile','divers')),
  prix    integer,                                  -- null = ne se vend pas
  en_vente boolean not null default true
);

-- ───────────────────────────────────────────────────────────────────────
--  3 · CE QUE POSSÈDE UN JOUEUR
-- ───────────────────────────────────────────────────────────────────────
create table pokemon (
  id            uuid primary key default gen_random_uuid(),
  joueur_id     uuid not null references joueur(id) on delete cascade,
  espece_id     integer not null references espece(id),
  surnom        text,
  niveau        smallint not null default 5 check (niveau between 1 and 100),
  xp            integer not null default 0,
  sexe          text check (sexe in ('m','f','inconnu')),
  obscur        boolean not null default false,
  etoiles       smallint not null default 0 check (etoiles between 0 and 5),
  emplacement   text not null default 'boite' check (emplacement in ('equipe','boite','pension')),
  position      smallint,
  capture_le    timestamptz not null default now(),
  capture_dans  bigint                              -- l'id du sujet, pour la traçabilité
);
create index on pokemon (joueur_id, emplacement);

-- Six au maximum dans l'équipe : la base le garantit, pas le navigateur.
create unique index pokemon_equipe_unique
  on pokemon (joueur_id, position) where emplacement = 'equipe';
alter table pokemon add constraint pokemon_equipe_six
  check (emplacement <> 'equipe' or position between 1 and 6);

create table sac (
  joueur_id uuid not null references joueur(id) on delete cascade,
  objet_id  integer not null references objet(id),
  quantite  integer not null default 0 check (quantite >= 0),
  primary key (joueur_id, objet_id)
);

create table pokedex (
  joueur_id  uuid not null references joueur(id) on delete cascade,
  espece_id  integer not null references espece(id),
  croise_le  timestamptz,
  attrape_le timestamptz,
  primary key (joueur_id, espece_id)
);

-- ───────────────────────────────────────────────────────────────────────
--  4 · LE REGISTRE — le cœur du système
--  Un journal. Rien n'y est appliqué. Une ligne n'est jamais modifiée.
-- ───────────────────────────────────────────────────────────────────────
create type evenement as enum
  ('croise','capture','xp','objet_utilise','objet_trouve','pokedollars');

create table registre (
  id          bigint generated always as identity primary key,
  sujet_id    bigint not null,
  zone_id     integer references zone(id),
  joueur_id   uuid not null references joueur(id) on delete cascade,
  message_id  bigint not null,
  type        evenement not null,
  charge      jsonb not null,                       -- l'espèce, le niveau, l'objet, le montant
  code        text not null,                        -- le code de vérification publié
  cree_le     timestamptz not null default now()
);

-- Un même message ne peut pas produire deux fois le même événement.
-- C'est la base qui le garantit, pas une vérification du navigateur.
create unique index registre_une_fois on registre (message_id, type);
create index on registre (sujet_id, joueur_id);

create table cloture (
  sujet_id   bigint primary key,
  clos_le    timestamptz not null default now(),
  clos_par   uuid not null references joueur(id),
  resultat   jsonb not null,                        -- ce qui a été versé, pour l'archive
  code       text not null
);

-- Un sujet clos ne reçoit plus de lignes de registre.
create or replace function registre_sujet_ouvert() returns trigger as $$
begin
  if exists (select 1 from cloture where sujet_id = new.sujet_id) then
    raise exception 'Le sujet % est clôturé, son registre est figé.', new.sujet_id;
  end if;
  return new;
end $$ language plpgsql;

create trigger registre_sujet_ouvert
  before insert on registre
  for each row execute function registre_sujet_ouvert();

-- ───────────────────────────────────────────────────────────────────────
--  5 · LES SERVICES
-- ───────────────────────────────────────────────────────────────────────
create table pension (
  id              uuid primary key default gen_random_uuid(),
  joueur_id       uuid not null references joueur(id) on delete cascade,
  gerant_id       uuid references joueur(id),       -- null = la pension publique, tenue par Aulne
  pokemon_id      uuid not null references pokemon(id) on delete cascade,
  depose_le       timestamptz not null default now(),
  recupere_le     timestamptz,
  niveau_au_depot smallint not null,
  tarif           integer not null
);
-- Deux pokémon en pension au maximum par joueur.
create index on pension (joueur_id) where recupere_le is null;

create table commande (
  id          uuid primary key default gen_random_uuid(),
  joueur_id   uuid not null references joueur(id) on delete cascade,
  message_id  bigint not null unique,               -- le message qui a validé le panier
  lignes      jsonb not null,                       -- [{objet_id, quantite, prix}]
  total       integer not null,
  etat        text not null default 'en_attente'
                check (etat in ('en_attente','servie','refusee')),
  motif       text,
  code        text not null,
  cree_le     timestamptz not null default now()
);

create table analyse_fossile (
  id             uuid primary key default gen_random_uuid(),
  joueur_id      uuid not null references joueur(id) on delete cascade,
  objet_id       integer not null references objet(id),
  message_id     bigint not null unique,
  espece_obtenue integer references espece(id),
  etat           text not null default 'en_attente'
                   check (etat in ('en_attente','rendue','refusee')),
  code           text not null,
  cree_le        timestamptz not null default now()
);

-- ───────────────────────────────────────────────────────────────────────
--  6 · LA RELÈVE
--  Une ligne par forum suivi : jusqu'où la dernière passe a lu.
-- ───────────────────────────────────────────────────────────────────────
create table releve (
  forum_id        integer primary key,
  dernier_message bigint not null default 0,
  passe_le        timestamptz not null default now()
);

create table releve_journal (
  id        bigint generated always as identity primary key,
  passe_le  timestamptz not null default now(),
  tache     text not null,
  traites   integer not null default 0,
  erreurs   jsonb
);

-- ───────────────────────────────────────────────────────────────────────
--  7 · LES PERMISSIONS
--  Le carnet lit avec la clé anonyme. Un joueur ne voit que ses lignes.
--  La relève écrit avec la clé de service, qui contourne ces règles.
-- ───────────────────────────────────────────────────────────────────────
alter table joueur            enable row level security;
alter table pokemon           enable row level security;
alter table sac               enable row level security;
alter table pokedex           enable row level security;
alter table registre          enable row level security;
alter table pension           enable row level security;
alter table commande          enable row level security;
alter table analyse_fossile   enable row level security;

-- L'identité vient du jeton de liaison, posé dans le JWT par la fonction
-- de connexion du carnet. Jamais d'un identifiant passé par le navigateur.
create or replace function joueur_courant() returns uuid as $$
  select nullif(current_setting('request.jwt.claims', true)::jsonb ->> 'joueur_id','')::uuid
$$ language sql stable;

create policy "chacun lit sa fiche"       on joueur          for select using (id = joueur_courant());
create policy "chacun lit ses pokémon"    on pokemon         for select using (joueur_id = joueur_courant());
create policy "chacun lit son sac"        on sac             for select using (joueur_id = joueur_courant());
create policy "chacun lit son pokédex"    on pokedex         for select using (joueur_id = joueur_courant());
create policy "chacun lit ses pensions"   on pension         for select using (joueur_id = joueur_courant() or gerant_id = joueur_courant());
create policy "chacun lit ses commandes"  on commande        for select using (joueur_id = joueur_courant());
create policy "chacun lit ses analyses"   on analyse_fossile for select using (joueur_id = joueur_courant());

-- Le registre est l'exception : il est PUBLIC en lecture, parce que le
-- module du bilan s'affiche pour tout le monde au-dessus du premier
-- message. Il ne contient rien de privé, et il est en lecture seule.
create policy "le registre est public" on registre for select using (true);

-- Mes boîtes est le seul onglet du carnet qui écrit : on y range ses
-- pokémon entre l'équipe et les boîtes, rien d'autre.
create policy "chacun range ses pokémon" on pokemon for update
  using (joueur_id = joueur_courant())
  with check (joueur_id = joueur_courant() and emplacement in ('equipe','boite'));

-- ───────────────────────────────────────────────────────────────────────
--  8 · LA CLÔTURE — tout ou rien
--  Appelée par la relève, avec la clé de service.
--  Vérifie, applique, et renvoie ce qui a été versé. En cas de manque,
--  elle lève une exception : la transaction n'est pas ouverte, et le
--  registre reste intact.
-- ───────────────────────────────────────────────────────────────────────
create or replace function cloturer(p_sujet bigint, p_joueur uuid, p_code text)
returns jsonb as $$
declare
  manque   jsonb := '[]'::jsonb;
  ligne    record;
  resultat jsonb := '{}'::jsonb;
begin
  if exists (select 1 from cloture where sujet_id = p_sujet) then
    raise exception 'Le sujet % est déjà clôturé.', p_sujet;
  end if;

  -- a) les objets consommés sont-ils en sac ?
  for ligne in
    select (charge->>'objet_id')::int as objet_id, sum((charge->>'quantite')::int) as demande
    from registre
    where sujet_id = p_sujet and joueur_id = p_joueur and type = 'objet_utilise'
    group by 1
  loop
    if coalesce((select quantite from sac where joueur_id = p_joueur and objet_id = ligne.objet_id), 0) < ligne.demande then
      manque := manque || jsonb_build_object(
        'objet_id', ligne.objet_id,
        'demande', ligne.demande,
        'en_sac', coalesce((select quantite from sac where joueur_id = p_joueur and objet_id = ligne.objet_id), 0));
    end if;
  end loop;

  if jsonb_array_length(manque) > 0 then
    raise exception 'CLOTURE_INCOMPLETE %', manque::text;
  end if;

  -- b) tout est là : on verse, dans l'ordre du registre
  update sac s set quantite = s.quantite - d.demande
    from (select (charge->>'objet_id')::int objet_id, sum((charge->>'quantite')::int) demande
          from registre where sujet_id = p_sujet and joueur_id = p_joueur and type = 'objet_utilise'
          group by 1) d
    where s.joueur_id = p_joueur and s.objet_id = d.objet_id;

  insert into sac (joueur_id, objet_id, quantite)
    select p_joueur, (charge->>'objet_id')::int, (charge->>'quantite')::int
    from registre where sujet_id = p_sujet and joueur_id = p_joueur and type = 'objet_trouve'
    on conflict (joueur_id, objet_id) do update set quantite = sac.quantite + excluded.quantite;

  insert into pokemon (joueur_id, espece_id, niveau, sexe, obscur, emplacement, capture_dans)
    select p_joueur, (charge->>'espece_id')::int, (charge->>'niveau')::smallint,
           charge->>'sexe', coalesce((charge->>'obscur')::boolean, false), 'boite', p_sujet
    from registre where sujet_id = p_sujet and joueur_id = p_joueur and type = 'capture';

  update pokemon p set xp = p.xp + g.gain
    from (select (charge->>'pokemon_id')::uuid pid, sum((charge->>'gain')::int) gain
          from registre where sujet_id = p_sujet and joueur_id = p_joueur and type = 'xp'
          group by 1) g
    where p.id = g.pid;

  update joueur j set pokedollars = j.pokedollars + coalesce((
      select sum((charge->>'montant')::int) from registre
      where sujet_id = p_sujet and joueur_id = p_joueur and type = 'pokedollars'), 0)
    where j.id = p_joueur;

  insert into pokedex (joueur_id, espece_id, croise_le, attrape_le)
    select p_joueur, (charge->>'espece_id')::int,
           min(cree_le) filter (where type = 'croise'),
           min(cree_le) filter (where type = 'capture')
    from registre where sujet_id = p_sujet and joueur_id = p_joueur and type in ('croise','capture')
    group by 2
    on conflict (joueur_id, espece_id) do update
      set croise_le  = least(pokedex.croise_le,  excluded.croise_le),
          attrape_le = coalesce(pokedex.attrape_le, excluded.attrape_le);

  select jsonb_object_agg(type, n) into resultat
    from (select type::text, count(*) n from registre
          where sujet_id = p_sujet and joueur_id = p_joueur group by 1) x;

  insert into cloture (sujet_id, clos_par, resultat, code)
    values (p_sujet, p_joueur, resultat, p_code);

  return resultat;
end $$ language plpgsql security definer;

-- ───────────────────────────────────────────────────────────────────────
--  9 · LE MÉNAGE
--  Un sujet abandonné ne laisse rien : appelé au tri hebdomadaire.
-- ───────────────────────────────────────────────────────────────────────
create or replace function oublier_sujet(p_sujet bigint) returns integer as $$
declare n integer;
begin
  delete from registre where sujet_id = p_sujet and not exists
    (select 1 from cloture where sujet_id = p_sujet);
  get diagnostics n = row_count;
  return n;
end $$ language plpgsql security definer;
