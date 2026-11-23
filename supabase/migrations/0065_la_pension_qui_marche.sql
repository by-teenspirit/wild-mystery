-- ════════════════════════════════════════════════════════════════════
--  0065 · La pension qui marche
--
--  « Y'a la pension publique et n'importe quel joueur peut ouvrir la
--  sienne » — Callista, 23 novembre. C'étaient les deux règles qui
--  manquaient, et la 0013 avait écrit noir sur blanc pourquoi elle
--  laissait la pension cassée :
--
--      « Choisir la clé déclencheuse maintenant, c'est choisir
--      *comment on dépose un pokémon en pension* — et ça, c'est à
--      Callista. »
--
--  Elle a choisi. Voici la pension.
--
--  ── CE QUI EXISTAIT, ET POURQUOI ÇA NE SERVAIT À RIEN ───────────────
--
--  La table `pension` est là depuis la 0001, et `rendre_pension` depuis
--  la 0002 : un niveau tous les dix jours, dix au plafond, calculé au
--  retrait. Éprouvée, testée, saine — et **inatteignable**. Rien ne
--  déposait : pas de verbe, pas de bouton, pas de tâche.
--
--  `pensions_a_rendre()` cherchait une ligne de registre portant un
--  `pensionId` que PERSONNE n'écrit nulle part. Elle rendait donc
--  toujours zéro, et zéro ressemble exactement à « aucune pension à
--  rendre ». Elle s'en va ici : une fonction morte qui a l'air de
--  marcher est pire qu'une fonction absente.
--
--  ── LA PUBLIQUE EST UNE LIGNE AVEC UN TROU ──────────────────────────
--
--  C'est le cœur du dessin, et ça évite tout un code en double :
--  **la pension publique d'Aulne est une gérance dont `gerant_id` est
--  nul.** Un seul chemin pour déposer, un seul pour reprendre, et la
--  différence entre les deux pensions tient dans deux `case when` :
--
--    · LE RYTHME. Dix jours par niveau chez Aulne, sept chez un joueur.
--      La publique est le filet : toujours ouverte, personne à attendre,
--      et plus lente. Celle d'un joueur est le meilleur marché, mais
--      elle demande quelqu'un en face ;
--    · L'ARGENT. Le tarif d'une pension de joueur va au gérant ; celui
--      d'Aulne disparaît, parce qu'Aulne n'a pas de porte-monnaie.
--
--  Et elle n'est pas ouverte par un message : c'est une LIGNE DE
--  CONFIGURATION, posée une fois sur le sujet que Callista désigne. D'où
--  `message_id` nullable — un fait qui n'a pas de message n'en invente
--  pas un.
--
--  ── LE DÉPÔT N'EST EFFECTIF QU'À L'ACCEPTATION ──────────────────────
--
--  « Le dépôt n'est effectif qu'une fois que le gérant l'a accepté. »
--  Donc l'horloge part de `accepte_le`, pas de `depose_le` : un Pokémon
--  qui attend trois jours que le gérant revienne ne gagne rien pendant
--  ces trois jours. C'est juste — il n'est pas encore en pension, il est
--  à la porte.
--
--  Chez Aulne, `accepte_le = depose_le` : il n'y a personne à attendre.
--
--  ── TROIS VERBES PLUTÔT QUE RÉUTILISER « accepter » ─────────────────
--
--  `confier`, `prendre`, `reprendre`. On aurait pu faire accepter un
--  dépôt par le verbe `accepter` du défi : il n'y a qu'une chose
--  ouverte par sujet, donc « j'accepte ce qui est ouvert ici » aurait
--  suffi.
--
--  C'EST EXACTEMENT CE QU'IL NE FAUT PAS FAIRE. Le sens d'un message
--  posté dépendrait alors de ce qu'il y avait dans la base à la seconde
--  où la relève l'a lu. Un `accepter` écrit pour un dépôt vaudrait
--  acceptation d'un défi si un défi s'était ouvert entre-temps. La règle
--  de `domaine/action.ts` est écrite depuis le 15 octobre : **un message
--  posté ne change pas de sens parce qu'on a changé la donnée.**
-- ════════════════════════════════════════════════════════════════════

-- ── 1 · LA GÉRANCE ──────────────────────────────────────────────────

create table if not exists pension_gerance (
  id          uuid primary key default gen_random_uuid(),
  --  NUL = LA PENSION PUBLIQUE D'AULNE. Voir l'en-tête : c'est ce trou
  --  qui évite un second chemin pour tout.
  gerant_id   uuid references joueur(id) on delete cascade,
  sujet_id    integer not null,
  --  NUL POUR LA PUBLIQUE : elle est posée en configuration, pas par un
  --  message. Unique sinon — un message n'ouvre qu'une pension.
  message_id  bigint unique,
  tarif       integer not null check (tarif >= 0),
  ouverte_le  timestamptz not null default now(),
  fermee_le   timestamptz
);

--  UNE SEULE PENSION OUVERTE PAR SUJET, et c'est la base qui le tient :
--  le sujet EST la façon de désigner la pension, donc deux pensions sur
--  un sujet, c'est un dépôt dont on ne sait pas chez qui il va.
create unique index if not exists pension_gerance_un_sujet
  on pension_gerance (sujet_id) where fermee_le is null;

--  ET UNE SEULE PAR GÉRANT. Personne n'a demandé deux pensions pour un
--  joueur, et la base qui le refuse ne coûte rien. Si Callista veut en
--  autoriser plusieurs un jour, c'est cet index qui s'en va — et rien
--  d'autre.
create unique index if not exists pension_gerance_un_gerant
  on pension_gerance (gerant_id)
  where fermee_le is null and gerant_id is not null;

alter table pension_gerance enable row level security;
--  `drop` D'ABORD : `create policy` n'a pas de `if not exists`, et cette
--  migration doit se rejouer. Le contrôle de rejeu m'a attrapé sur
--  exactement ça à la 0063.
drop policy if exists "les pensions sont publiques" on pension_gerance;
--  PUBLIQUE EN LECTURE, et c'est voulu : une pension est une boutique.
--  Son tarif et son sujet sont faits pour être vus par qui cherche où
--  déposer, exactement comme le défi (0060).
create policy "les pensions sont publiques" on pension_gerance for select using (true);

comment on table pension_gerance is
  'Une pension ouverte sur un sujet. `gerant_id` nul = la pension '
  'publique d''Aulne, posée en configuration : un rythme plus lent, '
  'personne à attendre, et l''argent qui disparaît (0065).';

-- ── 2 · CE QUE LE DÉPÔT APPREND ─────────────────────────────────────

alter table pension add column if not exists sujet_id    integer;
alter table pension add column if not exists message_id  bigint;
--  UN DÉPÔT PAR MESSAGE : la relève relit le même message quand un
--  passage échoue à mi-chemin, et sans ça le Pokémon partirait deux
--  fois. Même garde que `commande` et que `evolution_faite`.
create unique index if not exists pension_un_message
  on pension (message_id) where message_id is not null;

--  L'HORLOGE PART D'ICI, PAS DE `depose_le`. Voir l'en-tête.
alter table pension add column if not exists accepte_le  timestamptz;
--  CE QUI A ÉTÉ GAGNÉ ET PAYÉ, pour l'archive : un joueur doit pouvoir
--  relire ce que son séjour lui a coûté et rapporté.
alter table pension add column if not exists niveaux_gagnes smallint;
alter table pension add column if not exists paye        integer;
--  ── DEUX MESSAGES, DEUX COLONNES ──────────────────────────────────
--
--  TROUVÉ EN RELISANT MA PROPRE GARDE DE REJEU. J'avais d'abord mis les
--  deux dans `rendu_par` : la prise y écrivait le message du gérant, et
--  le retrait l'ÉCRASAIT avec celui du joueur. Un message de prise
--  rejoué après un retrait ne se reconnaissait donc plus, et prenait un
--  AUTRE dépôt — celui qui attendait derrière, à l'insu de son
--  propriétaire.
--
--  Une colonne par geste. Elles ne parlent pas du même joueur, elles ne
--  datent pas du même moment, et une colonne qui sert à deux choses est
--  une colonne qui en perd une.
alter table pension add column if not exists pris_par    bigint;
alter table pension add column if not exists rendu_par   bigint;
create unique index if not exists pension_une_prise
  on pension (pris_par) where pris_par is not null;
create unique index if not exists pension_un_retrait
  on pension (rendu_par) where rendu_par is not null;

comment on column pension.accepte_le is
  'Quand le gérant a pris le Pokémon. L''horloge des niveaux part de '
  'là : un Pokémon qui attend à la porte ne gagne rien. Posé à '
  '`depose_le` chez Aulne, qui n''a personne à attendre (0065).';

-- ── 3 · LE RYTHME, EN UN SEUL ENDROIT ───────────────────────────────
--
--  UNE FONCTION PLUTÔT QUE DEUX NOMBRES RECOPIÉS. `rendre_pension` en a
--  besoin pour calculer, et `pension_du_sujet` pour l'annoncer au
--  joueur avant qu'il dépose. Deux copies finiraient par dire deux
--  choses, et c'est le genre d'écart qu'un joueur découvre en se
--  faisant avoir.

create or replace function pension_jours_par_niveau(p_gerant uuid)
returns integer as $$
  --  DIX CHEZ AULNE, SEPT CHEZ UN JOUEUR. La publique est le filet :
  --  immédiate et sans contrepartie, donc plus lente. Celle d'un joueur
  --  est le meilleur marché, et elle demande quelqu'un en face.
  select case when p_gerant is null then 10 else 7 end;
$$ language sql immutable;

--  LE PLAFOND NE CHANGE PAS : dix niveaux par séjour, la règle de la
--  0002, et l'annexe V1 disait la même chose — « limités à 10 par
--  sujet ».
create or replace function pension_plafond() returns integer as $$
  select 10;
$$ language sql immutable;

comment on function pension_jours_par_niveau(uuid) is
  'Dix jours par niveau chez Aulne, sept chez un joueur. Une fonction '
  'et pas deux nombres recopiés : `rendre_pension` calcule avec, '
  '`pension_du_sujet` l''annonce avec (0065).';

-- ── 4 · OUVRIR ET FERMER UNE PENSION ────────────────────────────────

create or replace function ouvrir_une_pension(p jsonb)
returns jsonb as $$
declare
  v_sujet   integer := (p->>'sujetId')::integer;
  v_message bigint  := (p->>'messageId')::bigint;
  v_joueur  uuid    := nullif(p->>'joueurId', '')::uuid;
  v_tarif   integer := (p->>'tarif')::integer;
  v_deja    pension_gerance%rowtype;
  v_id      uuid;
begin
  if v_sujet is null or v_message is null or v_joueur is null or v_tarif is null then
    raise exception 'ouvrir_une_pension : paramètres manquants dans %', p::text;
  end if;
  if v_tarif < 0 then
    return jsonb_build_object('ouverte', false, 'raison', 'TARIF_INVALIDE');
  end if;

  --  DÉJÀ LU : on rend ce qui existe au lieu d'ouvrir une seconde fois.
  select * into v_deja from pension_gerance where message_id = v_message;
  if found then
    return jsonb_build_object(
      'ouverte', false, 'raison', 'DEJA_LU',
      'geranceId', v_deja.id, 'tarif', v_deja.tarif
    );
  end if;

  --  UNE PENSION SUR CE SUJET : la sienne ou celle d'un autre, on
  --  refuse pareil, et on dit laquelle. Un joueur qui ouvre deux fois
  --  sur son propre sujet doit lire « elle est déjà ouverte », pas une
  --  erreur d'unicité.
  select * into v_deja from pension_gerance
   where sujet_id = v_sujet and fermee_le is null;
  if found then
    return jsonb_build_object(
      'ouverte', false,
      'raison', case when v_deja.gerant_id = v_joueur then 'DEJA_LA_TIENNE'
                     else 'PENSION_ICI' end,
      'geranceId', v_deja.id
    );
  end if;

  if exists (
    select 1 from pension_gerance where gerant_id = v_joueur and fermee_le is null
  ) then
    return jsonb_build_object('ouverte', false, 'raison', 'DEJA_GERANT');
  end if;

  insert into pension_gerance (gerant_id, sujet_id, message_id, tarif)
  values (v_joueur, v_sujet, v_message, v_tarif)
  returning id into v_id;

  return jsonb_build_object(
    'ouverte', true, 'geranceId', v_id, 'tarif', v_tarif,
    'joursParNiveau', pension_jours_par_niveau(v_joueur)
  );
end $$ language plpgsql security definer set search_path = public, extensions;

create or replace function fermer_une_pension(p jsonb)
returns jsonb as $$
declare
  v_gerance uuid := nullif(p->>'geranceId', '')::uuid;
  v_joueur  uuid := nullif(p->>'joueurId', '')::uuid;
  v_g       pension_gerance%rowtype;
  v_restes  integer;
begin
  if v_gerance is null then
    raise exception 'fermer_une_pension : geranceId manquant dans %', p::text;
  end if;
  select * into v_g from pension_gerance
   where id = v_gerance and fermee_le is null for update;
  if not found then
    return jsonb_build_object('fermee', false, 'raison', 'AUCUNE_PENSION');
  end if;
  --  `v_joueur` NUL = LE STAFF. Passé, il doit être le gérant : un
  --  joueur ne ferme pas la pension d'un autre.
  if v_joueur is not null and v_g.gerant_id is distinct from v_joueur then
    return jsonb_build_object('fermee', false, 'raison', 'PAS_TA_PENSION');
  end if;

  --  ── ON NE FERME PAS SUR DES POKÉMON ────────────────────────────────
  --
  --  Un gérant qui ferme boutique avec trois Pokémon dedans les laisse
  --  nulle part : plus de sujet pour les reprendre, et un `gerant_id`
  --  qui pointe une gérance close. Le refus nomme combien il en reste.
  select count(*) into v_restes from pension
   where gerant_id = v_g.gerant_id and recupere_le is null;
  if v_restes > 0 then
    return jsonb_build_object(
      'fermee', false, 'raison', 'DEPOTS_EN_COURS', 'restants', v_restes
    );
  end if;

  update pension_gerance set fermee_le = now() where id = v_gerance;
  return jsonb_build_object('fermee', true, 'geranceId', v_gerance);
end $$ language plpgsql security definer set search_path = public, extensions;

-- ── 5 · CE QUE LA BARRE DOIT SAVOIR ─────────────────────────────────

create or replace function pension_du_sujet(p jsonb)
returns jsonb as $$
declare
  v_sujet integer := (p->>'sujetId')::integer;
  v_moi   uuid    := joueur_courant();
  v_g     pension_gerance%rowtype;
begin
  if v_sujet is null then
    return null;
  end if;
  select * into v_g from pension_gerance
   where sujet_id = v_sujet and fermee_le is null;
  if not found then
    return null;
  end if;
  return jsonb_build_object(
    'geranceId', v_g.id,
    'tarif', v_g.tarif,
    --  LE RYTHME EST ANNONCÉ AVANT LE DÉPÔT, et c'est tout l'intérêt
    --  de cette lecture : un joueur choisit entre dix jours gratuits
    --  d'attente et sept jours payants en sachant les deux.
    'joursParNiveau', pension_jours_par_niveau(v_g.gerant_id),
    'plafond', pension_plafond(),
    'publique', v_g.gerant_id is null,
    'gerant', (select pseudo from joueur where id = v_g.gerant_id),
    --  « EST-ELLE DE MOI » PLUTÔT QUE « DE QUI » : même choix que
    --  `defi_du_sujet` (0060). On ne dépose pas chez soi, et la barre
    --  n'a pas besoin d'un identifiant de plus à promener.
    --  `coalesce` : SANS IDENTITÉ, `x = null` REND NULL, PAS FAUX. Un
    --  visiteur aurait lu `aMoi: null`, et le navigateur aurait eu à
    --  deviner. On répond faux — ce n'est pas sa pension, puisqu'il
    --  n'est personne.
    'aMoi', coalesce(v_g.gerant_id is not null and v_g.gerant_id = v_moi, false),
    --  COMBIEN ATTENDENT D'ÊTRE PRIS : le gérant a besoin de le savoir
    --  pour poster « je prends », et personne d'autre n'en souffre.
    'enAttente', (
      select count(*) from pension
       where gerant_id is not distinct from v_g.gerant_id
         and recupere_le is null and accepte_le is null
    ),
    --  ET CE QUE MOI J'Y AI. Zéro pour un visiteur.
    'aMoiDedans', (
      select count(*) from pension
       where joueur_id = v_moi and recupere_le is null
    )
  );
end $$ language plpgsql stable security definer set search_path = public, extensions;

revoke all on function pension_du_sujet(jsonb) from public;
grant execute on function pension_du_sujet(jsonb) to anon, authenticated, service_role;

comment on function pension_du_sujet(jsonb) is
  'La pension ouverte d''un sujet : son tarif, son rythme, son '
  'plafond, et ce que celui qui regarde y a déjà. Sert à la barre '
  'pour choisir ses boutons (0065).';

-- ── 6 · CONFIER ─────────────────────────────────────────────────────

create or replace function confier_un_pokemon(p jsonb)
returns jsonb as $$
declare
  v_sujet   integer := (p->>'sujetId')::integer;
  v_message bigint  := (p->>'messageId')::bigint;
  v_joueur  uuid    := nullif(p->>'joueurId', '')::uuid;
  v_pokemon uuid    := nullif(p->>'pokemonId', '')::uuid;
  v_g       pension_gerance%rowtype;
  v_pk      pokemon%rowtype;
  v_deja    pension%rowtype;
  v_id      uuid;
  v_nb      integer;
begin
  if v_sujet is null or v_message is null or v_joueur is null or v_pokemon is null then
    raise exception 'confier_un_pokemon : paramètres manquants dans %', p::text;
  end if;

  select * into v_deja from pension where message_id = v_message;
  if found then
    return jsonb_build_object(
      'confie', false, 'raison', 'DEJA_LU', 'pensionId', v_deja.id
    );
  end if;

  select * into v_g from pension_gerance
   where sujet_id = v_sujet and fermee_le is null;
  if not found then
    return jsonb_build_object('confie', false, 'raison', 'PAS_DE_PENSION_ICI');
  end if;

  --  ON NE DÉPOSE PAS CHEZ SOI. Un gérant qui se confie ses propres
  --  Pokémon se paierait lui-même et gagnerait des niveaux gratuits : la
  --  base le refuse, parce que c'est une règle du jeu et pas un détail
  --  d'affichage. Chez Aulne la question ne se pose pas — personne n'est
  --  Aulne.
  if v_g.gerant_id is not null and v_g.gerant_id = v_joueur then
    return jsonb_build_object('confie', false, 'raison', 'C_EST_LA_TIENNE');
  end if;

  select * into v_pk from pokemon
   where id = v_pokemon and joueur_id = v_joueur for update;
  if not found then
    return jsonb_build_object('confie', false, 'raison', 'PAS_LE_TIEN');
  end if;
  --  L'ÉQUIPE, PAS LA BOÎTE : on confie un Pokémon qu'on a avec soi, et
  --  c'est une case d'équipe que le bloc d'action désigne.
  if v_pk.emplacement <> 'equipe' then
    return jsonb_build_object('confie', false, 'raison', 'PAS_EN_EQUIPE');
  end if;

  --  ── NI AU COMBAT, NI DÉJÀ EN PENSION ─────────────────────────────
  --
  --  Au combat : ses PV et son espèce sont relus à chaque frappe, et le
  --  sortir du jeu en pleine partie laisserait un combat sans
  --  combattant. Même refus que pour l'évolution (0063).
  if exists (
    select 1 from combat
     where etat = 'ouvert'
       and (pokemon_id = v_pokemon or adverse_pokemon_id = v_pokemon)
  ) then
    return jsonb_build_object('confie', false, 'raison', 'EN_COMBAT');
  end if;
  if exists (
    select 1 from pension where pokemon_id = v_pokemon and recupere_le is null
  ) then
    return jsonb_build_object('confie', false, 'raison', 'DEJA_EN_PENSION');
  end if;

  --  DEUX AU MAXIMUM, TOUTES PENSIONS CONFONDUES — publique et privées.
  --  Le déclencheur de la 0002 le tient déjà ; on le dit ici pour que le
  --  joueur lise « tu en as déjà deux » au lieu d'une exception.
  select count(*) into v_nb from pension
   where joueur_id = v_joueur and recupere_le is null;
  if v_nb >= 2 then
    return jsonb_build_object('confie', false, 'raison', 'PENSION_PLEINE', 'combien', v_nb);
  end if;

  insert into pension (
    joueur_id, gerant_id, pokemon_id, niveau_au_depot, tarif,
    sujet_id, message_id,
    --  ── CHEZ AULNE, ACCEPTÉ TOUT DE SUITE ──────────────────────────
    --
    --  « On dépose, on repart, personne à attendre. » L'horloge part
    --  donc immédiatement, et il n'y a pas de `prendre` à écrire.
    accepte_le
  ) values (
    v_joueur, v_g.gerant_id, v_pokemon, v_pk.niveau, v_g.tarif,
    v_sujet, v_message,
    case when v_g.gerant_id is null then now() else null end
  ) returning id into v_id;

  --  IL SORT DU JEU PENDANT LE SÉJOUR. `emplacement = 'pension'` est
  --  une valeur permise depuis la 0001 et que personne n'écrivait
  --  jamais ; la voici écrite. Sa position se libère — l'équipe a six
  --  cases, et en garder une pour un absent serait la perdre.
  update pokemon set emplacement = 'pension', position = null
   where id = v_pokemon;

  return jsonb_build_object(
    'confie', true, 'pensionId', v_id,
    'tarif', v_g.tarif,
    'publique', v_g.gerant_id is null,
    'accepte', v_g.gerant_id is null,
    'joursParNiveau', pension_jours_par_niveau(v_g.gerant_id),
    'surnom', v_pk.surnom, 'especeId', v_pk.espece_id, 'niveau', v_pk.niveau
  );
end $$ language plpgsql security definer set search_path = public, extensions;

revoke all on function confier_un_pokemon(jsonb) from public, anon, authenticated;
grant execute on function confier_un_pokemon(jsonb) to service_role;

-- ── 7 · PRENDRE, CHEZ UN GÉRANT ─────────────────────────────────────

create or replace function prendre_en_pension(p jsonb)
returns jsonb as $$
declare
  v_sujet   integer := (p->>'sujetId')::integer;
  v_message bigint  := (p->>'messageId')::bigint;
  v_joueur  uuid    := nullif(p->>'joueurId', '')::uuid;
  v_g       pension_gerance%rowtype;
  v_d       pension%rowtype;
begin
  if v_sujet is null or v_message is null or v_joueur is null then
    raise exception 'prendre_en_pension : paramètres manquants dans %', p::text;
  end if;

  --  DÉJÀ LU : le message de la prise vit dans sa propre colonne, et
  --  rien ne l'écrase. Voir le commentaire de `pris_par`.
  select * into v_d from pension where pris_par = v_message;
  if found then
    return jsonb_build_object('prend', false, 'raison', 'DEJA_LU', 'pensionId', v_d.id);
  end if;

  select * into v_g from pension_gerance
   where sujet_id = v_sujet and fermee_le is null and gerant_id = v_joueur;
  if not found then
    return jsonb_build_object('prend', false, 'raison', 'PAS_TA_PENSION');
  end if;

  --  ── LE PLUS ANCIEN QUI ATTEND, ET UN SEUL ─────────────────────────
  --
  --  Nommer lequel aurait demandé une liste au joueur, et une liste qui
  --  change entre l'affichage et l'envoi. Le plus ancien est la seule
  --  règle qui ne demande rien à personne — et c'est aussi la plus juste
  --  pour celui qui attend depuis le plus longtemps.
  --
  --  `for update skip locked` : deux messages du gérant dans le même
  --  passage ne doivent pas prendre le même dépôt.
  select * into v_d from pension
   where gerant_id = v_joueur and recupere_le is null and accepte_le is null
   order by depose_le asc
   limit 1
   for update skip locked;
  if not found then
    return jsonb_build_object('prend', false, 'raison', 'RIEN_A_PRENDRE');
  end if;

  update pension set accepte_le = now(), pris_par = v_message where id = v_d.id;

  return jsonb_build_object(
    'prend', true, 'pensionId', v_d.id,
    'joueurId', v_d.joueur_id,
    'pseudo', (select pseudo from joueur where id = v_d.joueur_id),
    'surnom', (select surnom from pokemon where id = v_d.pokemon_id),
    'especeId', (select espece_id from pokemon where id = v_d.pokemon_id),
    'tarif', v_d.tarif,
    'joursParNiveau', pension_jours_par_niveau(v_joueur)
  );
end $$ language plpgsql security definer set search_path = public, extensions;

revoke all on function prendre_en_pension(jsonb) from public, anon, authenticated;
grant execute on function prendre_en_pension(jsonb) to service_role;

-- ── 8 · REPRENDRE, ET PAYER ─────────────────────────────────────────
--
--  ── LA SIGNATURE CHANGE, ET IL FAUT LE DIRE ─────────────────────────
--
--  `rendre_pension(p_pension uuid)` devient `rendre_pension(p jsonb)`.
--  C'est la convention de tout le dépôt — un seul argument `p jsonb` —,
--  et le garde-fou n° 38 refuse un appelant TypeScript qui ne peut pas
--  atteindre sa fonction. L'ancienne n'avait aucun appelant, donc rien
--  ne casse ; les trois essais de contrat la suivent.
--
--  SON ARITHMÉTIQUE EST CONSERVÉE MOT POUR MOT — la 0013 l'avait dite
--  « éprouvée et saine », et elle l'est. Ce qui s'y ajoute : le rythme
--  qui dépend de la pension, le paiement, et le refus quand l'argent
--  manque.

drop function if exists pensions_a_rendre();
drop function if exists rendre_pension(uuid);

create or replace function rendre_pension(p jsonb)
returns jsonb as $$
declare
  v_pension uuid   := nullif(p->>'pensionId', '')::uuid;
  v_joueur  uuid   := nullif(p->>'joueurId', '')::uuid;
  v_message bigint := (p->>'messageId')::bigint;
  v_d       pension%rowtype;
  v_jours   integer;
  v_pas     integer;
  v_gagnes  smallint;
  v_solde   integer;
  v_niveau  smallint;
begin
  if v_pension is null then
    raise exception 'rendre_pension : pensionId manquant dans %', p::text;
  end if;

  select * into v_d from pension where id = v_pension and recupere_le is null for update;
  if not found then
    return jsonb_build_object('rendu', false, 'raison', 'DEJA_RENDU');
  end if;
  if v_joueur is not null and v_d.joueur_id <> v_joueur then
    return jsonb_build_object('rendu', false, 'raison', 'PAS_LE_TIEN');
  end if;
  --  PAS ENCORE PRIS : il attend à la porte du gérant. Le rendre
  --  maintenant serait le rendre sans séjour — et sans rien à payer,
  --  ce qui est juste, mais le joueur doit savoir pourquoi il ne gagne
  --  rien.
  if v_d.accepte_le is null then
    return jsonb_build_object('rendu', false, 'raison', 'PAS_ENCORE_PRIS');
  end if;

  --  ── L'ARITHMÉTIQUE DE LA 0002, AVEC LE RYTHME DE LA PENSION ───────
  v_pas   := pension_jours_par_niveau(v_d.gerant_id);
  v_jours := greatest(0, (now()::date - v_d.accepte_le::date));
  v_gagnes := least(pension_plafond(), (v_jours / v_pas))::smallint;

  --  ── ON PAIE CE QU'ON A OBTENU, ET SEULEMENT SI ON A OBTENU ────────
  --
  --  Zéro niveau, zéro pokédollar. Un séjour de trois jours chez un
  --  gérant à sept jours par niveau n'a rien donné : le faire payer
  --  serait faire payer l'attente, et l'annexe V1 dit l'inverse —
  --  « régler ainsi la somme demandée » vient APRÈS « lorsque les
  --  niveaux sont atteints ».
  if v_gagnes > 0 then
    select pokedollars into v_solde from joueur where id = v_d.joueur_id for update;
    if v_solde < v_d.tarif then
      --  UN REFUS, PAS UNE LEVÉE : le Pokémon reste en pension, et le
      --  joueur reviendra avec l'argent. Un `raise` annulerait la
      --  transaction et donc la trace du refus — la forme de
      --  `boutique_servir` (0011).
      return jsonb_build_object(
        'rendu', false, 'raison', 'ARGENT_INSUFFISANT',
        'tarif', v_d.tarif, 'solde', v_solde, 'niveaux', v_gagnes
      );
    end if;
    update joueur set pokedollars = pokedollars - v_d.tarif where id = v_d.joueur_id;
    --  LE GÉRANT TOUCHE. Chez Aulne, `gerant_id` est nul et l'argent
    --  disparaît : il n'a pas de porte-monnaie, et lui en inventer un
    --  ferait une ligne de joueur qui n'est pas un joueur.
    if v_d.gerant_id is not null then
      update joueur set pokedollars = pokedollars + v_d.tarif where id = v_d.gerant_id;
    end if;
  end if;

  --  ── LE POKÉMON REVIENT, EN BOÎTE ──────────────────────────────────
  --
  --  Jamais en équipe : c'est au joueur de l'y remettre depuis son
  --  carnet, comme pour une capture. Et sa position reste nulle — la
  --  0035 avait trouvé que `rendre_pension` remettait un Pokémon à une
  --  place désormais prise.
  update pokemon
     set niveau = least(100, niveau + v_gagnes),
         xp = greatest(xp, seuil(least(100, niveau + v_gagnes)::smallint)),
         emplacement = 'boite',
         position = null
   where id = v_d.pokemon_id
  returning niveau into v_niveau;

  update pension
     set recupere_le = now(),
         niveaux_gagnes = v_gagnes,
         paye = case when v_gagnes > 0 then v_d.tarif else 0 end,
         rendu_par = v_message
   where id = v_pension;

  return jsonb_build_object(
    'rendu', true, 'pensionId', v_pension,
    'niveaux', v_gagnes, 'jours', v_jours, 'joursParNiveau', v_pas,
    'paye', case when v_gagnes > 0 then v_d.tarif else 0 end,
    'niveau', v_niveau,
    'publique', v_d.gerant_id is null,
    'gerant', (select pseudo from joueur where id = v_d.gerant_id),
    'surnom', (select surnom from pokemon where id = v_d.pokemon_id),
    'especeId', (select espece_id from pokemon where id = v_d.pokemon_id)
  );
end $$ language plpgsql security definer set search_path = public, extensions;

revoke all on function rendre_pension(jsonb) from public, anon, authenticated;
grant execute on function rendre_pension(jsonb) to service_role;

comment on function rendre_pension(jsonb) is
  'Rend un Pokémon de pension : compte les niveaux au rythme de la '
  'pension, débite le tarif et le verse au gérant, et le remet en '
  'boîte. Zéro niveau, zéro pokédollar — on paie ce qu''on a obtenu. '
  'Refuse en valeur de retour si l''argent manque : le Pokémon reste, '
  'et le joueur revient (0065).';

--  ── CE QUI RESTE, ÉCRIT ICI POUR NE PAS L'OUBLIER ──────────────────
--
--  · LA LIGNE DE LA PENSION PUBLIQUE est à poser une fois, sur le sujet
--    que Callista désignera :
--
--      insert into pension_gerance (gerant_id, sujet_id, tarif)
--      values (null, <le sujet d'Aulne>, <son tarif>);
--
--    Elle n'est pas semée ici parce que ni le sujet ni le tarif ne sont
--    décidés, et qu'une ligne semée avec un sujet inventé serait une
--    pension ouverte sur un fil qui n'existe pas.
--  · LA RELÈVE : les quatre verbes sont dans le vocabulaire, les cinq
--    fonctions sont là, et rien ne les appelle encore.
