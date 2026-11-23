-- ════════════════════════════════════════════════════════════════════
--  0060 · Le défi, et le combat qui porte deux joueurs
--
--  « Comment on lance un combat entre mon pokémon et le pokémon de
--  l'autre joueur dans un sujet ? » — 23 novembre. La réponse était
--  « on ne peut pas », et ce n'était pas un réglage qui manquait :
--  `combat` n'avait qu'un seul côté « en face », décrit comme une
--  espèce sauvage.
--
--  ── LE DÉFI NE NOMME PERSONNE ───────────────────────────────────────
--
--  Un `defier:<pseudo>` aurait demandé la liste des présents, un menu,
--  et un pseudo écrit par un joueur dans un bloc d'action — donc à
--  échapper, à vérifier, et à retrouver quand quelqu'un se renomme.
--
--  C'est L'ACCEPTATION QUI DÉSIGNE : le premier qui accepte devient
--  l'adversaire. Et c'est ce que l'annexe « Se battre contre un
--  dresseur » décrit déjà — l'accord se fait entre les joueurs, par MP
--  ou dans le sujet des recherches ; le sujet ne fait que
--  l'enregistrer.
--
--  ── LE DUEL VIT DANS `combat`, ET PAS DANS UNE TABLE À LUI ──────────
--
--  C'était la question de fond, et elle s'est tranchée sur une
--  propriété qu'on a déjà payée : `combat` porte DEUX index uniques —
--  un combat par message, un seul ouvert par sujet. Deux tables
--  auraient obligé à tenir ces deux règles À CHEVAL, et une unicité à
--  cheval sur deux tables ne s'écrit pas en SQL : elle s'écrit en
--  vérifications qu'une course entre deux messages contourne.
--
--  Un duel et une rencontre sauvage ne doivent pas pouvoir courir
--  ensemble dans le même fil. Même table, donc, et les deux index
--  protègent les deux genres pour rien de plus.
--
--  ── CE QUE LES COLONNES « SAUVAGE » DISENT MAINTENANT ───────────────
--
--  `espece_id`, `niveau_sauvage`, `pv_sauvage`, `pv_sauvage_max`
--  décrivent LE COMBATTANT D'EN FACE. Pour un sauvage c'est tout ce
--  qu'il est ; pour un duel, c'est le Pokémon de l'autre joueur, qui a
--  lui aussi une espèce, un niveau et des PV.
--
--  LE MOT « SAUVAGE » DANS TROIS NOMS DE COLONNES EST DONC FAUX
--  depuis cette migration, et il reste. Les renommer voudrait dire
--  réémettre la version courante de DIX fonctions qui les lisent — la
--  relève, les cartes, les tours, les PV, le sac, `mon_combat` — dans
--  la même migration qu'une fonctionnalité neuve. C'est comme ça qu'on
--  casse ce qui marche. Le renommage est une migration à part,
--  mécanique, à faire un jour où elle ne porte rien d'autre.
--
--  ── UN TOUR DE DUEL EST UNE SEULE FRAPPE ────────────────────────────
--
--  Dans un combat sauvage, un message fait l'aller ET le retour : le
--  joueur frappe, le sauvage riposte, parce que le sauvage n'a pas
--  d'auteur. Dans un duel, chacun écrit son coup. D'où `a_qui` : la
--  colonne qui dit de qui on attend le prochain message.
--
--  Elle est posée ici, avec le reste de la charpente ; la résolution
--  de la frappe est le lot suivant.
-- ════════════════════════════════════════════════════════════════════

-- ── 1 · LE COMBAT APPREND LE DUEL ───────────────────────────────────

alter table combat add column if not exists genre text not null default 'sauvage';
alter table combat drop constraint if exists combat_genre_connu;
alter table combat add constraint combat_genre_connu
  check (genre in ('sauvage', 'duel'));

--  L'ADVERSAIRE, QUAND C'EN EST UN. `on delete cascade` sur le joueur,
--  comme `joueur_id` : un compte effacé n'a pas de combat.
alter table combat add column if not exists adverse_joueur_id uuid
  references joueur(id) on delete cascade;

--  ET SON POKÉMON, en `set null` comme celui de ce côté-ci (0046) :
--  relâché ou mis en pension pendant le combat, la carte reste
--  lisible et le combat se clôt proprement.
alter table combat add column if not exists adverse_pokemon_id uuid
  references pokemon(id) on delete set null;

--  DE QUI ON ATTEND LE PROCHAIN MESSAGE.
--
--  Sans elle, les deux joueurs pourraient frapper deux fois de suite,
--  et le plus prompt à poster gagnerait. Un combat sauvage n'en a pas
--  besoin — le sauvage ne poste pas —, d'où le `null` de ce côté.
alter table combat add column if not exists a_qui uuid references joueur(id);

alter table combat drop constraint if exists combat_duel_complet;
alter table combat add constraint combat_duel_complet check (
  (genre = 'sauvage' and adverse_joueur_id is null and a_qui is null)
  or (genre = 'duel' and adverse_joueur_id is not null and a_qui is not null)
);

--  ON NE SE DÉFIE PAS SOI-MÊME. Deux comptes du même joueur, c'est un
--  joueur qui se bat tout seul pour monter deux Pokémon : la base le
--  refuse, parce que c'est une règle du jeu et pas un détail
--  d'affichage.
alter table combat drop constraint if exists combat_pas_contre_soi;
alter table combat add constraint combat_pas_contre_soi
  check (adverse_joueur_id is null or adverse_joueur_id <> joueur_id);

--  ET `a_qui` EST L'UN DES DEUX, jamais un tiers.
alter table combat drop constraint if exists combat_a_qui_joue;
alter table combat add constraint combat_a_qui_joue
  check (a_qui is null or a_qui = joueur_id or a_qui = adverse_joueur_id);

--  ── LE PLAFOND DES TOURS N'EST PLUS LE MÊME DES DEUX CÔTÉS ─────────
--
--  Cinq, c'est la planche 99 §5.2 : « puis le Pokémon s'enfuit ». Un
--  sauvage s'en va ; un dresseur reste. Et comme un tour de duel est
--  une SEULE frappe, cinq tours ne feraient que deux coups et demi
--  chacun — moins qu'un échange de combat sauvage.
--
--  Trente, donc, pour le duel : quinze coups par joueur. C'est un
--  plafond contre le fil qui ne finit jamais, pas une règle de jeu, et
--  c'est pour ça qu'il est large.
alter table combat drop constraint if exists combat_tour_check;
alter table combat drop constraint if exists combat_tour_borne;
alter table combat add constraint combat_tour_borne check (
  (genre = 'sauvage' and tour between 0 and 5)
  or (genre = 'duel' and tour between 0 and 30)
);

comment on column combat.genre is
  'sauvage : une rencontre, le serveur joue l''autre côté. duel : deux '
  'joueurs, chacun écrit son coup (0060).';
comment on column combat.espece_id is
  'L''espèce du combattant D''EN FACE : le sauvage, ou le Pokémon de '
  'l''adversaire. Les noms « sauvage » des colonnes voisines datent de '
  'la 0046 et sont faux depuis la 0060 — le renommage est une '
  'migration à part.';
comment on column combat.a_qui is
  'De qui on attend le prochain message. Nul pour un combat sauvage : '
  'le sauvage ne poste pas (0060).';

create index if not exists combat_de_l_adversaire
  on combat (adverse_joueur_id, ouvert_le desc)
  where adverse_joueur_id is not null;

-- ── 2 · LA TABLE DES DÉFIS ──────────────────────────────────────────
--
--  POURQUOI UNE TABLE, et pas un `combat` en attente : un défi n'a pas
--  encore d'adversaire, donc pas de second Pokémon, donc pas de PV à
--  poser. Un combat dont la moitié des colonnes attend serait un
--  combat qu'aucune lecture ne peut afficher — et `combat_duel_complet`
--  juste au-dessus dit l'inverse.
--
--  Et surtout : un défi que personne n'accepte doit pouvoir mourir
--  sans jamais avoir été un combat.

create table if not exists defi (
  id         uuid primary key default gen_random_uuid(),
  sujet_id   integer not null check (sujet_id > 0),
  --  LE MESSAGE QUI L'A LANCÉ, et l'identité du défi vis-à-vis de la
  --  relève : elle relit, et ce qui est dérivé d'un message porte le
  --  numéro du message. Même règle que `combat` et que le registre.
  message_id integer not null,
  joueur_id  uuid not null references joueur(id) on delete cascade,
  etat       text not null default 'ouvert'
    check (etat in ('ouvert', 'accepte', 'retire', 'expire')),
  ouvert_le  timestamptz not null default now(),
  clos_le    timestamptz,
  constraint defi_clos_date check (
    (etat = 'ouvert' and clos_le is null) or (etat <> 'ouvert' and clos_le is not null)
  )
);

create unique index if not exists defi_un_par_message on defi (message_id);

--  UN SEUL DÉFI OUVERT PAR SUJET. Deux défis dans un fil, c'est deux
--  joueurs qui acceptent sans se voir, et deux duels qui s'ouvrent
--  pour un seul sujet — ce que l'index de `combat` refuserait ensuite,
--  mais trop tard, après que le Maître du Jeu a posté.
create unique index if not exists defi_un_seul_ouvert_par_sujet
  on defi (sujet_id) where etat = 'ouvert';

comment on table defi is
  'Un défi lancé dans un sujet, en attente de quelqu''un. Il ne nomme '
  'personne : c''est l''acceptation qui désigne l''adversaire (0060).';

alter table defi enable row level security;

--  LECTURE OUVERTE AUX CONNECTÉS : un défi est public par nature — il
--  est lancé dans un sujet que tout le monde lit, et il faut pouvoir
--  l'accepter sans en être l'auteur. Rien d'écrivable ici : les deux
--  fonctions ci-dessous sont `security definer`.
drop policy if exists defi_lecture on defi;
create policy defi_lecture on defi for select to authenticated using (true);

grant select on defi to authenticated;

-- ════════════════════════════════════════════════════════════════════
--  OUVRIR UN DÉFI
--
--  Appelée par la relève quand un message porte `[[WM-ACTION:defier]]`.
--  Idempotente par le numéro du message, comme `ouvrir_un_combat` :
--  la relève relit un sujet sans relancer le défi.
-- ════════════════════════════════════════════════════════════════════

create or replace function ouvrir_un_defi(p jsonb)
returns jsonb as $$
declare
  v_sujet   integer := (p->>'sujetId')::integer;
  v_message integer := (p->>'messageId')::integer;
  v_joueur  uuid    := (p->>'joueurId')::uuid;
  v_deja    defi%rowtype;
  v_autre   uuid;
  v_id      uuid;
  v_pok     uuid;
begin
  if v_sujet is null or v_message is null or v_joueur is null then
    raise exception 'DEFI_PARAMETRES_MANQUANTS';
  end if;

  --  DÉJÀ LU : on rend celui-là. Pas une erreur — une relecture.
  select * into v_deja from defi where message_id = v_message;
  if found then
    return jsonb_build_object(
      'defiId', v_deja.id, 'ouvert', false, 'etat', v_deja.etat, 'raison', 'DEJA_LU'
    );
  end if;

  --  UN COMBAT COURT DÉJÀ DANS CE SUJET. On ne lève pas : le joueur a
  --  cliqué pendant qu'un combat tournait. La relève le note, le
  --  Maître du Jeu ne poste rien.
  select id into v_autre from combat where sujet_id = v_sujet and etat = 'ouvert';
  if v_autre is not null then
    return jsonb_build_object('ouvert', false, 'raison', 'COMBAT_EN_COURS');
  end if;

  select id into v_autre from defi where sujet_id = v_sujet and etat = 'ouvert';
  if v_autre is not null then
    return jsonb_build_object(
      'defiId', v_autre, 'ouvert', false, 'raison', 'DEFI_EN_COURS'
    );
  end if;

  --  ON NE DÉFIE PAS SANS POKÉMON, et ce refus est ici plutôt qu'à
  --  l'acceptation : un défi qu'on ne peut pas honorer ne doit pas
  --  attendre dans le sujet qu'un autre joueur s'y engage pour rien.
  select pk.id into v_pok
    from pokemon pk
   where pk.joueur_id = v_joueur and pk.emplacement = 'equipe'
   order by pk.position asc nulls last, pk.capture_le asc
   limit 1;
  if v_pok is null then
    return jsonb_build_object('ouvert', false, 'raison', 'EQUIPE_VIDE');
  end if;

  insert into defi (sujet_id, message_id, joueur_id)
  values (v_sujet, v_message, v_joueur)
  returning id into v_id;

  return jsonb_build_object('defiId', v_id, 'ouvert', true);
end $$ language plpgsql security definer set search_path = public, extensions;

comment on function ouvrir_un_defi(jsonb) is
  'Ouvre un défi sur un sujet, ou rend celui qui est déjà là. '
  'Idempotente par le numéro du message (0060).';

-- ════════════════════════════════════════════════════════════════════
--  ACCEPTER UN DÉFI
--
--  C'est elle qui désigne l'adversaire, et c'est elle qui fabrique le
--  combat : à cet instant seulement, les deux Pokémon sont connus.
--
--  ELLE FAIT TOUT D'UN COUP, dans une seule transaction : le défi
--  passe à `accepte` et le combat naît. Deux appels séparés
--  laisseraient un défi accepté sans combat, le temps d'une panne de
--  réseau — et personne ne saurait quoi faire de cet état-là.
-- ════════════════════════════════════════════════════════════════════

create or replace function accepter_un_defi(p jsonb)
returns jsonb as $$
declare
  v_sujet   integer := (p->>'sujetId')::integer;
  v_message integer := (p->>'messageId')::integer;
  v_joueur  uuid    := (p->>'joueurId')::uuid;
  v_defi    defi%rowtype;
  v_deja    combat%rowtype;
  v_autre   uuid;
  v_mien    record;
  v_sien    record;
  v_id      uuid;
begin
  if v_sujet is null or v_message is null or v_joueur is null then
    raise exception 'DEFI_PARAMETRES_MANQUANTS';
  end if;

  --  DÉJÀ LU : le combat de ce message existe. Une relecture.
  select * into v_deja from combat where message_id = v_message;
  if found then
    return jsonb_build_object(
      'combatId', v_deja.id, 'ouvert', false, 'etat', v_deja.etat, 'raison', 'DEJA_LU'
    );
  end if;

  select * into v_defi
    from defi where sujet_id = v_sujet and etat = 'ouvert'
   for update;
  if not found then
    return jsonb_build_object('ouvert', false, 'raison', 'AUCUN_DEFI');
  end if;

  --  ON N'ACCEPTE PAS LE SIEN. Le refus est ici et PAS seulement dans
  --  la contrainte de table : une contrainte lève, et une levée dans
  --  la relève arrête le passage sur tout le sujet. Ici on rend une
  --  raison, la relève la note, et elle continue.
  if v_defi.joueur_id = v_joueur then
    return jsonb_build_object('ouvert', false, 'raison', 'C_EST_LE_TIEN');
  end if;

  select id into v_autre from combat where sujet_id = v_sujet and etat = 'ouvert';
  if v_autre is not null then
    return jsonb_build_object(
      'combatId', v_autre, 'ouvert', false, 'raison', 'COMBAT_EN_COURS'
    );
  end if;

  --  LES DEUX PREMIERS DE CHAQUE ÉQUIPE. Même règle que le combat
  --  sauvage — « le premier pokémon de mon équipe » — et même tri, pour
  --  que les deux côtés soient choisis de la même façon.
  select pk.id, pk.espece_id, pk.niveau, pv_au_niveau(e.pv_base, pk.niveau) as pv
    into v_sien
    from pokemon pk join espece e on e.id = pk.espece_id
   where pk.joueur_id = v_defi.joueur_id and pk.emplacement = 'equipe'
   order by pk.position asc nulls last, pk.capture_le asc
   limit 1;
  if not found then
    return jsonb_build_object('ouvert', false, 'raison', 'EQUIPE_VIDE_CHEZ_LUI');
  end if;

  select pk.id, pk.espece_id, pk.niveau, pv_au_niveau(e.pv_base, pk.niveau) as pv
    into v_mien
    from pokemon pk join espece e on e.id = pk.espece_id
   where pk.joueur_id = v_joueur and pk.emplacement = 'equipe'
   order by pk.position asc nulls last, pk.capture_le asc
   limit 1;
  if not found then
    return jsonb_build_object('ouvert', false, 'raison', 'EQUIPE_VIDE');
  end if;

  --  QUI EST « joueur_id » ET QUI EST « adverse_joueur_id » ?
  --
  --  LE DÉFIEUR EST `joueur_id`, celui qui accepte est l'adversaire.
  --  Ce n'est pas arbitraire : tout ce qui existe déjà — `mon_combat`,
  --  les PV dans le sujet, le registre — lit `joueur_id` comme « le
  --  côté de ce joueur-ci » et `espece_id` comme « en face ». En
  --  mettant le défieur du côté qui existait, les deux genres se
  --  lisent pareil, et c'est le lot suivant qui enseigne aux lectures
  --  à regarder les deux.
  --
  --  ET C'EST LE DÉFIEUR QUI FRAPPE EN PREMIER. Le combat sauvage dit
  --  déjà « le joueur poste, donc le joueur agit » ; ici les deux
  --  postent, alors il faut un premier. Celui qui a lancé le défi a
  --  attendu — l'autre vient d'écrire son acceptation.
  insert into combat (
    sujet_id, message_id, genre,
    joueur_id, pokemon_id, pv_pokemon, pv_pokemon_max,
    adverse_joueur_id, adverse_pokemon_id,
    espece_id, niveau_sauvage, pv_sauvage, pv_sauvage_max,
    a_qui
  ) values (
    v_sujet, v_message, 'duel',
    v_defi.joueur_id, v_sien.id, v_sien.pv, v_sien.pv,
    v_joueur, v_mien.id,
    v_mien.espece_id, v_mien.niveau, v_mien.pv, v_mien.pv,
    v_defi.joueur_id
  ) returning id into v_id;

  update defi set etat = 'accepte', clos_le = now() where id = v_defi.id;

  return jsonb_build_object(
    'combatId',  v_id,
    'ouvert',    true,
    'defiId',    v_defi.id,
    'defieur',   v_defi.joueur_id,
    'adverse',   v_joueur,
    'aQui',      v_defi.joueur_id,
    'pvDefieur', v_sien.pv,
    'pvAdverse', v_mien.pv
  );
end $$ language plpgsql security definer set search_path = public, extensions;

comment on function accepter_un_defi(jsonb) is
  'Accepte le défi ouvert d''un sujet et ouvre le duel. C''est elle '
  'qui désigne l''adversaire : le défi ne nommait personne (0060).';

-- ════════════════════════════════════════════════════════════════════
--  RETIRER UN DÉFI
--
--  `fuir` sur un défi qu'on a lancé, et la clôture du sujet. Deux mots
--  différents pour deux histoires différentes : « retire » est un
--  joueur qui change d'avis, « expire » est un sujet qui se ferme avec
--  un défi que personne n'a pris.
-- ════════════════════════════════════════════════════════════════════

--  UN SEUL ARGUMENT `jsonb`, ET C'EST LE GARDE-FOU QUI L'A DIT.
--
--  Premier jet : `fermer_un_defi(p_id uuid, p_etat text)`, calqué sur
--  `fermer_un_combat` de la 0046. Mais celle-là n'est appelée QUE
--  depuis du SQL, alors que celle-ci est appelée depuis TypeScript —
--  et l'assertion du garde-fou l'a attrapée tout de suite :
--  « fermer_un_defi est appelée mais n'est déclarée qu'en (p_id uuid,
--  p_etat text) — aucun appelant ne peut l'atteindre ».
--
--  C'est la convention de tout ce que la relève appelle, et elle est
--  bonne : un seul argument nommé, donc un ajout de champ ne casse
--  aucun appelant.
create or replace function fermer_un_defi(p jsonb)
returns boolean as $$
declare
  v_id   uuid := (p->>'defiId')::uuid;
  v_etat text := p->>'etat';
  v_fait integer;
begin
  if v_id is null then
    raise exception 'DEFI_PARAMETRES_MANQUANTS';
  end if;
  if v_etat not in ('retire', 'expire') then
    raise exception 'ETAT_DE_FERMETURE_INVALIDE';
  end if;
  update defi set etat = v_etat, clos_le = now()
   where id = v_id and etat = 'ouvert';
  get diagnostics v_fait = row_count;
  return v_fait = 1;
end $$ language plpgsql security definer set search_path = public, extensions;

comment on function fermer_un_defi(jsonb) is
  'Ferme un défi ouvert et date la fin. Rend faux s''il était déjà '
  'clos : la première fin l''emporte (0060).';

-- ════════════════════════════════════════════════════════════════════
--  ET LA CLÔTURE DU SUJET EMPORTE LE DÉFI
--
--  `soigner_a_la_cloture()` fait déjà passer les combats ouverts à
--  `expire`. Un défi oublié dans un sujet clos resterait « ouvert »
--  pour toujours, et l'index partiel empêcherait d'en lancer un autre
--  dans ce sujet — pour un sujet que plus personne ne lit.
-- ════════════════════════════════════════════════════════════════════

--  UN DÉCLENCHEUR, ET PAS UNE FONCTION QU'ON APPELLE. C'est la leçon
--  de `soigner_a_la_cloture` (0049) : « un déclencheur plutôt qu'une
--  ligne dans appliquer_cloture, qu'on ne rouvre pas — une fonction
--  réécrite en entier ramène tout ce qu'on n'a pas relu ».
--
--  Et une fonction à appeler est une fonction qu'on oublie d'appeler :
--  celle-là ne se verrait pas manquer, puisque son effet est l'absence
--  d'une ligne dans une table que personne ne regarde.
create or replace function expirer_les_defis()
returns trigger as $$
begin
  update defi set etat = 'expire', clos_le = now()
   where sujet_id = new.sujet_id and etat = 'ouvert';
  return new;
end $$ language plpgsql security definer set search_path = public, extensions;

drop trigger if exists cloture_expire_les_defis on cloture;
create trigger cloture_expire_les_defis
  after insert on cloture
  for each row execute function expirer_les_defis();

--  PERSONNE NE L'APPELLE À LA MAIN : un déclencheur se déclenche avec
--  les droits du propriétaire de la table. L'assertion n° 118 de la
--  suite le vérifie — « aucune fonction security definer n'est
--  exécutable par PUBLIC ».
revoke all on function expirer_les_defis() from public, anon, authenticated;

comment on function expirer_les_defis() is
  'Fait expirer les défis encore ouverts du sujet qui vient de se '
  'clore. Déclencheur sur `cloture`, comme le soin (0060).';

-- ════════════════════════════════════════════════════════════════════
--  LES PERMISSIONS, AUSSI ÉTROITES QUE CELLES DU COMBAT
--
--  Les trois fonctions qui ÉCRIVENT ne sont appelables que par la
--  relève. Un joueur qui pourrait appeler `accepter_un_defi` depuis le
--  navigateur ouvrirait un duel sans message dans le sujet — donc sans
--  trace, et sans que personne ait rien écrit.
--
--  C'est la même règle que la 0046, et elle vaut d'être répétée :
--  CE QUI DÉRIVE D'UN MESSAGE NE S'OBTIENT QUE PAR UN MESSAGE.
-- ════════════════════════════════════════════════════════════════════

revoke all on function ouvrir_un_defi(jsonb) from public;
revoke all on function ouvrir_un_defi(jsonb) from anon, authenticated;
grant execute on function ouvrir_un_defi(jsonb) to service_role;

revoke all on function accepter_un_defi(jsonb) from public;
revoke all on function accepter_un_defi(jsonb) from anon, authenticated;
grant execute on function accepter_un_defi(jsonb) to service_role;

revoke all on function fermer_un_defi(jsonb) from public;
revoke all on function fermer_un_defi(jsonb) from anon, authenticated;
grant execute on function fermer_un_defi(jsonb) to service_role;

-- ════════════════════════════════════════════════════════════════════
--  LE DÉFI OUVERT D'UN SUJET, POUR LA BARRE
--
--  Elle a besoin de savoir trois choses, et pas une de plus : y a-t-il
--  un défi, est-il de moi, puis-je l'accepter. Le reste — le pseudo du
--  défieur, son Pokémon — vient du message du Maître du Jeu, qui est
--  déjà dans le sujet.
--
--  ELLE REND LE DÉFI DE TOUT LE MONDE, contrairement à `mon_combat`
--  (0051) qui rend `null` quand le combat n'est pas le vôtre. Et c'est
--  voulu : un défi est fait pour être vu par l'autre, sinon personne
--  ne l'accepte jamais. Ce qu'elle ne dit pas, c'est s'il est
--  acceptable — ça, c'est `accepter_un_defi` qui le tranche, en base.
-- ════════════════════════════════════════════════════════════════════

create or replace function defi_du_sujet(p jsonb)
returns jsonb as $$
declare
  v_sujet integer := (p->>'sujetId')::integer;
  v_moi   uuid    := joueur_courant();
  v_d     defi%rowtype;
begin
  if v_sujet is null then
    return null;
  end if;
  select * into v_d from defi where sujet_id = v_sujet and etat = 'ouvert';
  if not found then
    return null;
  end if;
  return jsonb_build_object(
    'defiId', v_d.id,
    'lance_le', v_d.ouvert_le,
    --  « EST-IL DE MOI » PLUTÔT QUE « DE QUI EST-IL » : le pseudo du
    --  défieur est déjà dans le sujet, et un identifiant de joueur
    --  rendu au navigateur est un identifiant de plus à promener.
    'aMoi', v_d.joueur_id = v_moi
  );
end $$ language plpgsql security definer set search_path = public, extensions;

comment on function defi_du_sujet(jsonb) is
  'Le défi ouvert d''un sujet, et s''il est de celui qui regarde. Rend '
  'le défi de tout le monde : un défi est fait pour être vu par '
  'l''autre (0060).';

revoke all on function defi_du_sujet(jsonb) from public;
grant execute on function defi_du_sujet(jsonb) to anon, authenticated, service_role;

-- ════════════════════════════════════════════════════════════════════
--  LA CARTE SAIT DIRE UN DUEL
--
--  Un duel entre dans la file des cartes TOUT SEUL : la file est
--  `combat.carte_poste_le is null`, pas une table à part (0047). C'est
--  gratuit, et c'est la bonne nouvelle.
--
--  La mauvaise : sans ce qui suit, la carte d'un duel s'écrirait avec
--  les mots d'une rencontre — « un Ponyta sauvage apparaît » à propos
--  du Pokémon d'un joueur. Un demi-mensonge posté dans le sujet, avec
--  les bons chiffres, ce qui est exactement ce qui se remarque le plus
--  tard.
--
--  DEUX CHAMPS DE PLUS, DONC, ET PAS UNE SECONDE FONCTION : `genre` et
--  le pseudo de l'adversaire. La clé `sauvage` garde son nom — elle
--  veut dire « en face » depuis la 0047, et toute la chaîne la lit
--  ainsi.
-- ════════════════════════════════════════════════════════════════════

create or replace function cartes_a_poster(p jsonb)
returns jsonb as $$
  select coalesce(jsonb_agg(c order by c.ouvert_le), '[]'::jsonb)
    from (
      select jsonb_build_object(
        'combatId',  cb.id,
        'sujetId',   cb.sujet_id,
        'messageId', cb.message_id,
        'essais',    cb.carte_essais,
        --  UNE CARTE DÉJÀ POSTÉE UNE FOIS EST UN RAPPEL, et elle ne
        --  s'écrit pas pareil : « un Debugant sauvage apparaît » est
        --  faux la seconde fois. `carte_message_id` porte le message
        --  du premier envoi et ne s'efface jamais — c'est lui qui
        --  distingue les deux, sans colonne de plus.
        'rappel',    cb.carte_message_id is not null,
        'mentionne', j.pseudo,
        --  ── LE GENRE, ET QUI EST EN FACE (0060) ───────────────────
        --
        --  `sauvage` garde son nom de clé : c'est « le combattant d'en
        --  face », et toute la chaîne TypeScript le lit ainsi depuis
        --  la 0047. Ce qui change, c'est qu'on dit maintenant S'IL
        --  EST SAUVAGE — sans quoi la carte d'un duel s'écrirait « un
        --  Ponyta sauvage apparaît » à propos du Pokémon d'un joueur.
        'genre',     cb.genre,
        --  LE PSEUDO DE L'ADVERSAIRE, nul pour un sauvage. C'est la
        --  seule chose de plus qu'une carte de duel doit dire, et elle
        --  vient d'ici plutôt que d'une seconde requête : la carte se
        --  poste à partir de cette ligne et de rien d'autre.
        'adverse',   ja.pseudo,
        'sauvage', jsonb_build_object(
          'especeId', es.id,
          'nom',     es.nom_fr,
          'niveau',  cb.niveau_sauvage,
          'types',   to_jsonb(es.types),
          --  LES PV RESTANTS, pas le maximum : si la carte repart
          --  après un tour déjà joué — ce qui n'arrive qu'en cas
          --  d'incident —, elle doit dire l'état réel, pas celui de
          --  l'ouverture.
          'pv',      cb.pv_sauvage,
          --  LE MAXIMUM NE PART QUE POUR UN RAPPEL. À l'apparition, le
          --  sauvage est entier et « 30/30 PV » ferait croire qu'il a
          --  déjà pris des coups ; au rappel, il peut être entamé et
          --  « 18 PV » tout court ne dit plus rien.
          'pvMax',   case when cb.carte_message_id is null
                          then null else cb.pv_sauvage_max end,
          'attaque', stat_au_niveau(es.att_base, cb.niveau_sauvage),
          'defense', stat_au_niveau(es.def_base, cb.niveau_sauvage)
        ),
        'combattant', case when pk.id is null then null else jsonb_build_object(
          'especeId', ep.id,
          'nom',     ep.nom_fr,
          'surnom',  pk.surnom,
          'niveau',  pk.niveau,
          'types',   to_jsonb(ep.types),
          'pv',      cb.pv_pokemon,
          'pvMax',   cb.pv_pokemon_max,
          'attaque', stat_au_niveau(ep.att_base, pk.niveau),
          'defense', stat_au_niveau(ep.def_base, pk.niveau)
        ) end
      ) as c, cb.ouvert_le
      from combat cb
      join joueur j  on j.id = cb.joueur_id
      left join joueur ja on ja.id = cb.adverse_joueur_id
      join espece es on es.id = cb.espece_id
      left join pokemon pk on pk.id = cb.pokemon_id
      left join espece  ep on ep.id = pk.espece_id
      --  ON NE POSTE QUE LES COMBATS OUVERTS. Un combat clos avant que
      --  sa carte ne parte — le sujet clôturé entre-temps — n'a plus
      --  de carte à poster : annoncer « à toi de jouer » dans un sujet
      --  fermé serait pire que le silence.
      where cb.carte_poste_le is null and cb.etat = 'ouvert'
      order by cb.ouvert_le
      limit greatest(1, least(coalesce((p->>'combien')::integer, 10), 50))
    ) c;
$$ language sql stable security definer set search_path = public, extensions;

comment on function cartes_a_poster(jsonb) is
  'Les cartes qui attendent d''être publiées, rencontres et duels. '
  '`genre` dit lequel, et `adverse` porte le pseudo de l''autre '
  'joueur quand c''en est un (0060).';

revoke all on function cartes_a_poster(jsonb) from public;
grant execute on function cartes_a_poster(jsonb) to service_role;
