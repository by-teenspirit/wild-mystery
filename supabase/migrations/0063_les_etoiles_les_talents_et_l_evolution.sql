-- ════════════════════════════════════════════════════════════════════
--  0063 · Les étoiles, les talents, et l'évolution
--
--  « Et comment on gère les évolutions ? » — 23 novembre. La donnée est
--  arrivée au commit précédent (`data/evolutions.json`,
--  `data/talents.json`) ; voici ce qui la rend vivante.
--
--  ── TROIS COLONNES, ET UNE SEULE EST UNE SURPRISE ───────────────────
--
--  `talent_id` et `obscur` se devinent. `etoiles`, non : une seule
--  colonne porte DEUX jauges qui ne vont pas dans le même sens.
--
--    · un Pokémon ORDINAIRE : les étoiles sont son BONHEUR. Une par RP
--      clôturé où il était dans l'équipe, cinq en tout, puis un niveau
--      de plus pour évoluer ;
--    · un Pokémon OBSCUR : les mêmes étoiles sont sa CONSCIENCE. Elles
--      montent au combat, descendent si c'est le Groupe Ombre qui le
--      fait combattre, et cinq le rendent purifiable.
--
--  POURQUOI PAS DEUX COLONNES : un Pokémon est obscur ou il ne l'est
--  pas, jamais les deux, donc la seconde colonne serait toujours nulle.
--  Et l'infobulle n'affiche qu'une jauge de cinq étoiles — deux
--  colonnes pour un seul affichage, c'est deux endroits où se tromper
--  sur celle qu'on montre.
--
--  ET LA PURIFICATION REMET À ZÉRO. « Au moment de la purification, on
--  retombe à 0 » — Callista, 23 novembre. C'est la réponse à la seule
--  vraie question de ce dessin : cinq étoiles de conscience ne
--  deviennent PAS cinq étoiles de bonheur, sinon un Pokémon purifié
--  pourrait évoluer dans la seconde, et le joueur n'aurait rien fait
--  pour ça.
--
--  ── L'ÉTOILE TOMBE TOUTE SEULE, ET C'EST UN CHOIX ───────────────────
--
--  L'annexe V1 dit : « l'étoile peut ne pas vous être accordé si le rp
--  n'est pas convaincant ». C'est un jugement humain, et aucun code ne
--  le rend.
--
--  Callista a tranché dans l'autre sens : « l'étoile tombe
--  automatiquement à la clôture, on verra si jamais on estime que c'est
--  pas assez convaincant, on enlèvera ». Le défaut est donc GÉNÉREUX, et
--  le retrait est une correction du staff — pas l'inverse. C'est le bon
--  sens : attendre une validation humaine pour chaque étoile de chaque
--  Pokémon de chaque clôture aurait fait une file que personne ne tient.
--
--  UN DÉCLENCHEUR SUR `cloture`, PAS UNE LIGNE DANS
--  `appliquer_cloture`. C'est la leçon de `soigner_a_la_cloture`
--  (0049), écrite dans son propre commentaire : « une fonction réécrite
--  en entier ramène tout ce qu'on n'a pas relu ». Et ça marche quelle
--  que soit la porte par laquelle la clôture arrive.
--
--  ── CE QUI DÉCIDE N'EST PAS ICI ─────────────────────────────────────
--
--  `evoluer_un_pokemon` reçoit l'espèce VISÉE et l'applique. Elle ne
--  relit pas `data/evolutions.json` — la base n'a pas ce fichier, et le
--  lui recopier en table ferait une seconde vérité à tenir d'accord
--  avec le dépôt.
--
--  C'est le même partage que pour la faune et le butin : **les tables de
--  possibilités vivent dans `data/`, la relève décide, la base
--  enregistre.** Ce que la base refuse, en revanche, c'est ce qu'elle
--  seule sait : ce Pokémon n'est pas à toi, il se bat en ce moment, ce
--  message a déjà été joué.
--
--  ── ET DEUX COLONNES MORTES S'EN VONT ───────────────────────────────
--
--  `espece.evolue_vers` et `espece.niveau_evolution` existent depuis la
--  0001 et n'ont jamais été remplies — `outils/especes-sql.py` le dit
--  lui-même. Les laisser, c'est laisser deux colonnes qui ont l'air de
--  répondre à la question à laquelle `data/evolutions.json` répond
--  vraiment. **Une colonne morte est un piège qui attend quelqu'un.**
-- ════════════════════════════════════════════════════════════════════

-- ── 1 · LES TROIS COLONNES ──────────────────────────────────────────

--  LA JAUGE. Zéro à cinq, et la borne est dans la base parce qu'elle ne
--  dépend de rien d'autre : cinq étoiles, c'est cinq étoiles.
alter table pokemon add column if not exists etoiles smallint not null default 0;
alter table pokemon drop constraint if exists pokemon_etoiles_bornees;
alter table pokemon add constraint pokemon_etoiles_bornees
  check (etoiles between 0 and 5);

alter table pokemon add column if not exists obscur boolean not null default false;

--  LE TALENT. Un entier nu, SANS table ni clé étrangère, et c'est
--  délibéré : les 260 talents vivent dans `data/talents.json`, comme les
--  tables de faune et de butin. Les recopier en base ferait une seconde
--  vérité, et c'est exactement ce que `espece.evolue_vers` était.
--
--  La relève est le seul écrivain : elle lit le fichier, tire le talent
--  avec la graine du message, et pose l'identifiant. Le navigateur lit
--  le même fichier pour afficher le nom.
alter table pokemon add column if not exists talent_id integer;

comment on column pokemon.etoiles is
  'La jauge de cinq étoiles. Pour un Pokémon ordinaire c''est son '
  'BONHEUR (une par RP clôturé en équipe) ; pour un Pokémon obscur '
  'c''est sa CONSCIENCE (au combat). Une seule colonne parce qu''un '
  'Pokémon est obscur ou il ne l''est pas, et que l''infobulle '
  'n''affiche qu''une jauge. La purification la remet à zéro (0063).';
comment on column pokemon.obscur is
  'Dit comment lire `etoiles` : conscience si vrai, bonheur sinon.';
comment on column pokemon.talent_id is
  'Le talent porté, parmi ceux que data/talents.json donne à l''espèce. '
  'Pas de clé étrangère : les talents sont une donnée du dépôt, pas une '
  'table — même partage que la faune et le butin (0063).';

-- ── 2 · LES DEUX COLONNES MORTES S'EN VONT ──────────────────────────

alter table espece drop column if exists evolue_vers;
alter table espece drop column if exists niveau_evolution;

-- ── 3 · LE JOURNAL APPREND DEUX MOTS ────────────────────────────────
--
--  `add value if not exists` est rejouable, et c'est ce qu'il faut : les
--  migrations montent deux fois dans le CI.
--
--  ET AUCUNE FONCTION DE CETTE MIGRATION N'UTILISE CES VALEURS : PostgreSQL
--  refuse une valeur d'énumération ajoutée et employée dans la MÊME
--  transaction. `journal_ecrire` fait le `::evenement_de_rhode` à
--  l'APPEL, pas au montage, donc le jour où la relève écrit
--  « evolution », la valeur existe depuis longtemps.
alter type evenement_de_rhode add value if not exists 'evolution';
alter type evenement_de_rhode add value if not exists 'purification';

-- ── 4 · L'ÉTOILE DE LA CLÔTURE ──────────────────────────────────────

create or replace function etoiler_a_la_cloture()
returns trigger as $$
begin
  --  ── QUI A CLÔTURÉ, LU DANS `resultat` ─────────────────────────────
  --
  --  `cloture.resultat` porte les versements, un par joueur, avec son
  --  `joueurId`. C'est la seule trace par joueur qu'une clôture laisse :
  --  `clos_par` ne nomme que le premier, et un RP à plusieurs en a
  --  autant que de participants.
  --
  --  TOUS CEUX QUI ONT ÉCRIT, DONC, et pas seulement celui qui a tapé
  --  le mot. Un RP à deux fait monter les deux équipes : c'est le lien
  --  avec le Pokémon qu'on compte, et les deux joueurs l'ont noué.
  update pokemon p
     set etoiles = least(5, p.etoiles + 1)
   where p.emplacement = 'equipe'
     --  LES OBSCURS SONT HORS DE CE COMPTE. Leur jauge est une
     --  conscience, elle monte au COMBAT et pas au RP, et la faire
     --  monter ici donnerait deux horloges à la même colonne.
     and p.obscur = false
     and p.etoiles < 5
     and p.joueur_id in (
       select (v->>'joueurId')::uuid
         from jsonb_array_elements(coalesce(new.resultat, '[]'::jsonb)) v
        where (v->>'joueurId') is not null
     );
  return new;
end $$ language plpgsql security definer set search_path = public, extensions;

drop trigger if exists cloture_etoile_les_equipes on cloture;
create trigger cloture_etoile_les_equipes
  after insert on cloture
  for each row execute function etoiler_a_la_cloture();

--  PERSONNE NE L'APPELLE À LA MAIN : un déclencheur tourne avec les
--  droits du propriétaire de la table. L'assertion n° 118 de la suite
--  refuse toute fonction `security definer` exécutable par PUBLIC, et
--  elle a déjà attrapé `soigner_a_la_cloture` à sa première montée.
revoke all on function etoiler_a_la_cloture() from public, anon, authenticated;

comment on function etoiler_a_la_cloture() is
  'Une étoile de bonheur à chaque Pokémon d''équipe des joueurs qui '
  'viennent de clôturer, plafonnée à cinq. Les obscurs sont exclus : '
  'leur jauge est une conscience, qui monte au combat. Un déclencheur '
  'plutôt qu''une ligne dans appliquer_cloture, qu''on ne rouvre pas '
  '(leçon de soigner_a_la_cloture, 0049).';

-- ── 5 · LE REGISTRE DES ÉVOLUTIONS ──────────────────────────────────
--
--  UNE TABLE, ET PAS SEULEMENT UN `update pokemon`. Trois raisons, et la
--  première suffirait :
--
--  · UN MESSAGE NE JOUE QU'UNE FOIS. `message_id` unique, et la relève
--    lit plusieurs fois le même message quand un passage échoue à
--    mi-chemin. Sans cette table, un Pokémon évoluerait deux fois ;
--  · L'HISTOIRE D'UN POKÉMON SE LIT. Un joueur veut savoir d'où vient
--    son Florizarre, et une évolution est un fait définitif ;
--  · LE STAFF PEUT DÉFAIRE. Une forme choisie par erreur se corrige si
--    l'on sait ce qu'elle était avant.

create table if not exists evolution_faite (
  id          uuid primary key default gen_random_uuid(),
  pokemon_id  uuid not null references pokemon(id) on delete cascade,
  joueur_id   uuid not null references joueur(id) on delete cascade,
  message_id  bigint not null unique,
  sujet_id    integer,
  de_espece   integer not null references espece(id),
  vers_espece integer not null references espece(id),
  --  CE QUI A ÉTÉ CONSOMMÉ, s'il y a eu un objet. La relève le dit ;
  --  la base l'archive.
  objet_id    integer,
  faite_le    timestamptz not null default now()
);

alter table evolution_faite enable row level security;
--  `drop` D'ABORD, parce que `create policy` n'a pas de `if not
--  exists` : la migration doit se rejouer, et le contrôle de rejeu m'a
--  attrapé ici à la première montée. C'est exactement le défaut que
--  `outils/migrations-rejouables.sh` existe pour trouver — six fichiers
--  étaient dans ce cas le 17 novembre.
drop policy if exists "chacun lit ses évolutions" on evolution_faite;
create policy "chacun lit ses évolutions" on evolution_faite
  for select using (joueur_id = joueur_courant());

create index if not exists evolution_faite_du_pokemon
  on evolution_faite (pokemon_id, faite_le desc);

-- ── 6 · FAIRE ÉVOLUER ───────────────────────────────────────────────
--
--  LES REFUS SONT DES VALEURS DE RETOUR, pas des `raise`. C'est la
--  forme de `boutique_servir` (0011), et sa raison tient ici mot pour
--  mot : un `raise` annule la transaction, donc annule aussi la trace
--  du refus — et « refuser » et « se souvenir d'avoir refusé » doivent
--  tous les deux tenir. Seule une faute de programmation lève.

create or replace function evoluer_un_pokemon(p jsonb)
returns jsonb as $$
declare
  v_pokemon uuid    := nullif(p->>'pokemonId', '')::uuid;
  v_joueur  uuid    := nullif(p->>'joueurId', '')::uuid;
  v_message bigint  := (p->>'messageId')::bigint;
  v_sujet   integer := (p->>'sujetId')::integer;
  v_vers    integer := (p->>'versEspeceId')::integer;
  v_objet   integer := (p->>'objetId')::integer;
  v_pk      pokemon%rowtype;
  v_deja    evolution_faite%rowtype;
  v_nom     text;
begin
  if v_pokemon is null or v_joueur is null or v_message is null or v_vers is null then
    raise exception 'evoluer_un_pokemon : paramètres manquants dans %', p::text;
  end if;

  --  DÉJÀ LU : on rend le verdict d'alors au lieu d'évoluer une seconde
  --  fois. Et on le rend COMPLET, parce que la relève repostera le
  --  message du Maître du Jeu dans ce cas-là.
  select * into v_deja from evolution_faite where message_id = v_message;
  if found then
    return jsonb_build_object(
      'evolue', false, 'raison', 'DEJA_LU',
      'pokemonId', v_deja.pokemon_id,
      'deEspece', v_deja.de_espece, 'versEspece', v_deja.vers_espece
    );
  end if;

  --  `joueur_id` DANS LA REQUÊTE, pas après. Une lecture qui trouve
  --  puis vérifie laisse passer le jour où quelqu'un oublie le `if`.
  select * into v_pk from pokemon
   where id = v_pokemon and joueur_id = v_joueur for update;
  if not found then
    return jsonb_build_object('evolue', false, 'raison', 'PAS_LE_TIEN');
  end if;

  if v_pk.espece_id = v_vers then
    return jsonb_build_object('evolue', false, 'raison', 'MEME_ESPECE');
  end if;

  select nom_fr into v_nom from espece where id = v_vers;
  if v_nom is null then
    return jsonb_build_object('evolue', false, 'raison', 'ESPECE_INCONNUE');
  end if;

  --  ── IL NE PEUT PAS ÉVOLUER AU MILIEU D'UN COMBAT ──────────────────
  --
  --  Ses PV, ses PV au maximum et son espèce sont lus par `jouer_un_tour`
  --  à chaque frappe. Changer d'espèce pendant qu'un combat tourne
  --  changerait le `pv_max` d'un combattant entre deux tours, et le tour
  --  déjà posté deviendrait irrejouable — c'est le contrat de
  --  reproductibilité de la 0048.
  if exists (
    select 1 from combat
     where etat = 'ouvert'
       and (pokemon_id = v_pokemon or adverse_pokemon_id = v_pokemon)
  ) then
    return jsonb_build_object('evolue', false, 'raison', 'EN_COMBAT');
  end if;

  --  ── ET PAS DEPUIS UNE PENSION ─────────────────────────────────────
  --
  --  Un Pokémon en pension est aux mains du gérant. Le faire évoluer de
  --  loin changerait ce que le gérant est en train de rendre.
  if exists (
    select 1 from pension where pokemon_id = v_pokemon and recupere_le is null
  ) then
    return jsonb_build_object('evolue', false, 'raison', 'EN_PENSION');
  end if;

  insert into evolution_faite (
    pokemon_id, joueur_id, message_id, sujet_id, de_espece, vers_espece, objet_id
  ) values (
    v_pokemon, v_joueur, v_message, v_sujet, v_pk.espece_id, v_vers, v_objet
  );

  --  L'ESPÈCE CHANGE, ET RIEN D'AUTRE. Le niveau, l'XP, le surnom, les
  --  quatre capacités, la position et les étoiles restent — c'est le
  --  même Pokémon. Ses PV au maximum suivent tout seuls :
  --  `pv_au_niveau(espece.pv_base, niveau)` est calculé à la lecture,
  --  jamais stocké.
  --
  --  LE TALENT RESTE AUSSI, et c'est discutable : une forme évoluée
  --  n'a pas forcément le même. Mais le changer d'office retirerait au
  --  joueur un talent qu'il a peut-être choisi son Pokémon pour avoir,
  --  et rien dans l'annexe ne le demande. Le staff peut le corriger.
  update pokemon set espece_id = v_vers where id = v_pokemon;

  --  LE POKÉDEX ENREGISTRE LA NOUVELLE ESPÈCE, croisée ET attrapée :
  --  on ne l'a pas croisée, on l'a obtenue.
  insert into pokedex (joueur_id, espece_id, croise_le, attrape_le)
  values (v_joueur, v_vers, now(), now())
     on conflict (joueur_id, espece_id)
     do update set croise_le  = least(pokedex.croise_le, excluded.croise_le),
                   attrape_le = coalesce(pokedex.attrape_le, excluded.attrape_le);

  return jsonb_build_object(
    'evolue', true, 'pokemonId', v_pokemon,
    'deEspece', v_pk.espece_id, 'versEspece', v_vers, 'nom', v_nom,
    'surnom', v_pk.surnom, 'niveau', v_pk.niveau
  );
end $$ language plpgsql security definer set search_path = public, extensions;

revoke all on function evoluer_un_pokemon(jsonb) from public, anon, authenticated;
grant execute on function evoluer_un_pokemon(jsonb) to service_role;

comment on function evoluer_un_pokemon(jsonb) is
  'Applique une évolution DÉCIDÉE par la relève : elle change l''espèce '
  'et rien d''autre. Ne relit pas data/evolutions.json — les tables de '
  'possibilités vivent dans le dépôt, la relève décide, la base '
  'enregistre. Refuse ce qu''elle seule sait : pas à toi, déjà joué, en '
  'combat, en pension (0063).';

-- ── 7 · PURIFIER ────────────────────────────────────────────────────

create or replace function purifier_un_pokemon(p jsonb)
returns jsonb as $$
declare
  v_pokemon uuid   := nullif(p->>'pokemonId', '')::uuid;
  v_joueur  uuid   := nullif(p->>'joueurId', '')::uuid;
  v_pk      pokemon%rowtype;
begin
  if v_pokemon is null or v_joueur is null then
    raise exception 'purifier_un_pokemon : paramètres manquants dans %', p::text;
  end if;

  select * into v_pk from pokemon
   where id = v_pokemon and joueur_id = v_joueur for update;
  if not found then
    return jsonb_build_object('purifie', false, 'raison', 'PAS_LE_TIEN');
  end if;
  if not v_pk.obscur then
    return jsonb_build_object('purifie', false, 'raison', 'PAS_OBSCUR');
  end if;
  if v_pk.etoiles < 5 then
    return jsonb_build_object(
      'purifie', false, 'raison', 'CONSCIENCE_INCOMPLETE', 'etoiles', v_pk.etoiles
    );
  end if;

  --  ── LA JAUGE RETOMBE À ZÉRO ───────────────────────────────────────
  --
  --  « Au moment de la purification, on retombe à 0 » — 23 novembre, et
  --  c'est la ligne qui compte dans cette fonction. Les cinq étoiles
  --  qu'on vient de remplir étaient une CONSCIENCE ; les garder en ferait
  --  un BONHEUR plein, et un Pokémon purifié pourrait évoluer dans la
  --  seconde sans que le joueur ait rien fait pour ça.
  update pokemon set obscur = false, etoiles = 0 where id = v_pokemon;

  return jsonb_build_object(
    'purifie', true, 'pokemonId', v_pokemon,
    'surnom', v_pk.surnom, 'especeId', v_pk.espece_id
  );
end $$ language plpgsql security definer set search_path = public, extensions;

revoke all on function purifier_un_pokemon(jsonb) from public, anon, authenticated;
grant execute on function purifier_un_pokemon(jsonb) to service_role;

comment on function purifier_un_pokemon(jsonb) is
  'Rouvre la conscience d''un Pokémon Obscur dont la jauge est pleine, '
  'et REMET LA JAUGE À ZÉRO : cinq étoiles de conscience ne sont pas '
  'cinq étoiles de bonheur (0063).';

-- ── 8 · CE QUI RESTE À FAIRE, ÉCRIT ICI POUR NE PAS L'OUBLIER ───────
--
--  · L'ÉTOILE DES OBSCURS, qui monte au combat et descend si c'est le
--    Groupe Ombre qui les fait combattre. Callista : « on fait un groupe
--    invisible pour les permissions sur le forum » — donc
--    l'appartenance est un fait du FORUM, que la base ne connaît pas
--    encore. Elle viendra avec la relève, qui lit les groupes.
--  · OBSCURCIR, qui demande le même fait.
--  · LE TALENT À LA CAPTURE : la relève le tirera depuis
--    `data/talents.json`.
