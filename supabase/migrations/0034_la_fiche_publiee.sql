-- ════════════════════════════════════════════════════════════════════
--  0034 · La fiche publiée — « Mes liens »
--
--  Note de code `397:1564` : « Le carnet écrit la fiche, le joueur la
--  publie ».
--
--  ── LA FABRIQUE EST ICI, ET PAS DANS LE NAVIGATEUR ──────────────────
--
--  La note de « Mon histoire » demande « une seule fonction, un seul
--  BBCode ». Elle aurait pu vivre dans la page : les données y sont
--  déjà. Trois raisons l'en écartent.
--
--  1. LE FILTRE `affiche` NE DOIT PAS DÉPENDRE D'UN BOUT DE JAVASCRIPT.
--     « Un champ masqué ne sort pas de la base » : si c'est la page qui
--     trie, un défaut d'une ligne publie une orientation sexuelle que
--     quelqu'un avait éteinte. Ici, la fonction ne LIT que les lignes
--     vraies — il n'y a rien à oublier de filtrer.
--  2. L'EMPREINTE SE CALCULE OÙ LE TEXTE SE FABRIQUE. Deux endroits qui
--     fabriquent la même chaîne finissent par en fabriquer deux.
--  3. Et ça se mesure en pgTAP, sur la vraie base, plutôt que sur un
--     décor que j'aurais écrit pour me donner raison — c'est la faute
--     qui m'a coûté deux soirées cette semaine.
--
--  ── CE QUE CETTE MIGRATION NE PEUT PAS FAIRE ────────────────────────
--
--  La note veut des RP communs dans la fiche : « un sujet où le joueur
--  et la cible ont tous les deux posté », croisés depuis la table `rp`.
--  ELLE N'EXISTE PAS : c'est la tâche 9 de la relève, qui n'a pas
--  tourné. La fabrique laisse donc la place vide et le dit — plutôt
--  qu'un bloc « RP communs » toujours désert, que personne ne saurait
--  interpréter.
--
--  Et « 3 changements depuis » n'est pas tenable tel quel : une
--  empreinte dit SI le texte a changé, jamais COMBIEN de fois. Compter
--  demanderait une date de modification par ligne, sur quatre tables.
--  La fiche dit donc « différente de celle que tu as publiée », ce qui
--  est l'information utile — et le compte reste à faire si tu le veux.
-- ════════════════════════════════════════════════════════════════════

-- ── 1 · les liens ──────────────────────────────────────────────────

create table if not exists lien (
  joueur_id      uuid     not null references joueur(id) on delete cascade,
  --  LA CIBLE EST UN IDENTIFIANT DE FORUM, pas un `joueur_id` : on lie
  --  des personnages qui n'ont pas forcément de carnet, et le lien ne
  --  doit pas disparaître parce que l'autre n'a jamais été validé.
  cible_forum_id integer  not null check (cible_forum_id > 0),
  cible_pseudo   text     not null default '' check (length(cible_pseudo) <= 60),
  court          text     not null default '' check (length(court) <= 60),
  long           text     not null default '' check (length(long) <= 900),
  image          text     not null default '' check (
                   image = '' or (image ~ '^https://' and length(image) <= 400)),
  ordre          smallint not null default 0,
  primary key (joueur_id, cible_forum_id)
);

create trigger lien_pas_trop before insert on lien
  for each row execute function fiche_pas_trop_de_lignes(60);

comment on table lien is
  'Les liens d''un personnage vers d''autres, dans l''ordre de la fiche '
  'publiée (0034). La cible est un identifiant de forum : on lie aussi '
  'des personnages sans carnet.';

-- ── 2 · la fiche publiée ───────────────────────────────────────────

create table if not exists fiche (
  joueur_id  uuid primary key references joueur(id) on delete cascade,
  sujet_id   integer check (sujet_id is null or sujet_id > 0),
  message_id integer check (message_id is null or message_id > 0),
  publie_le  timestamptz,
  --  L'EMPREINTE DU TEXTE PUBLIÉ. Elle ne dit pas ce qui a changé, elle
  --  dit que ça a changé — et c'est ce qui permet à la page de ne pas
  --  proposer une republication identique.
  empreinte  text not null default ''
);

comment on table fiche is
  'Où vit la fiche publiée d''un personnage, et l''empreinte du texte '
  'qui y a été posté (0034). Le carnet ne poste pas : il ouvre le '
  'formulaire natif, et le joueur enregistre ici ce qu''il a publié.';

-- ── 3 · ce qui protège le message publié ───────────────────────────

/*  UNE BALISE MAL FERMÉE CASSE TOUT LE MESSAGE, et il faut le réparer
    à la main. Le texte du joueur est donc neutralisé avant d'entrer
    dans la fiche : les crochets deviennent des entités, que Forumactif
    réaffiche comme des crochets. La personne voit ce qu'elle a écrit,
    et aucune de ses balises ne s'ouvre.

    PAS DE LISTE DE BALISES AUTORISÉES : une liste se contourne, un
    échappement non. Qui veut de la mise en forme dans sa fiche la met
    à la main après publication — c'est son sujet.  */
create or replace function bbcode_sans_balise(p_texte text) returns text as $$
  select replace(replace(coalesce(p_texte, ''), '[', '&#91;'), ']', '&#93;');
$$ language sql immutable;

comment on function bbcode_sans_balise(text) is
  'Neutralise les crochets d''un texte de joueur avant qu''il entre '
  'dans un message BBCode (0034). Forumactif réaffiche les entités '
  'comme des crochets : la personne lit ce qu''elle a écrit.';

-- ── 4 · la fabrique ────────────────────────────────────────────────

/*  UNE SEULE FONCTION, UN SEUL BBCODE, et elle ne lit que ce qui est
    affiché. Elle rend le texte complet ; l'empreinte se calcule
    dessus, dans la même foulée, par `fiche_a_publier()`.  */
create or replace function fiche_en_bbcode(p_joueur uuid) returns text as $$
declare
  v_pseudo text;
  v_bout   text;
  v_tout   text := '';
begin
  select pseudo into v_pseudo from joueur where id = p_joueur;
  if v_pseudo is null then
    raise exception 'JOUEUR_INTROUVABLE';
  end if;

  v_tout := '[center][size=18][b]' || bbcode_sans_balise(v_pseudo) ||
            '[/b][/size][/center]' || E'\n\n';

  --  L'IDENTITÉ — seulement ce qui est allumé.
  select string_agg('[b]' || bbcode_sans_balise(champ) || '[/b] : ' ||
                    bbcode_sans_balise(valeur), E'\n' order by ordre, champ)
    into v_bout
    from fiche_champ where joueur_id = p_joueur and affiche;
  if v_bout is not null then v_tout := v_tout || v_bout || E'\n\n'; end if;

  select string_agg(bbcode_sans_balise(mot), ' · ' order by ordre, mot)
    into v_bout
    from fiche_trait where joueur_id = p_joueur;
  if v_bout is not null then
    v_tout := v_tout || '[i]' || v_bout || '[/i]' || E'\n\n';
  end if;

  --  LA DESCRIPTION, si elle est allumée.
  select bbcode_sans_balise(texte) into v_bout
    from fiche_description where joueur_id = p_joueur and affiche and texte <> '';
  if v_bout is not null then v_tout := v_tout || v_bout || E'\n\n'; end if;

  --  LES MOMENTS allumés, dans l'ordre du temps.
  select string_agg('[b]' || bbcode_sans_balise(titre) || '[/b] — ' ||
                    bbcode_sans_balise(texte), E'\n' order by quand)
    into v_bout
    from fiche_moment where joueur_id = p_joueur and affiche;
  if v_bout is not null then
    v_tout := v_tout || '[b]Quelques dates[/b]' || E'\n' || v_bout || E'\n\n';
  end if;

  --  LES LIENS, dans l'ordre que le joueur a choisi.
  select string_agg(
           '[b]' || bbcode_sans_balise(coalesce(nullif(cible_pseudo, ''),
                                       'Membre ' || cible_forum_id)) || '[/b]' ||
           case when court <> '' then ' — ' || bbcode_sans_balise(court) else '' end ||
           case when long <> '' then E'\n' || bbcode_sans_balise(long) else '' end,
           E'\n\n' order by ordre, cible_forum_id)
    into v_bout
    from lien where joueur_id = p_joueur;
  if v_bout is not null then
    v_tout := v_tout || '[b]Mes liens[/b]' || E'\n' || v_bout || E'\n\n';
  end if;

  --  LES RP COMMUNS VIENDRAIENT ICI. La table `rp` que la relève doit
  --  remplir n'existe pas encore (tâche 9) ; tant qu'elle manque, on
  --  n'écrit pas un titre suivi du vide.

  return rtrim(v_tout, E'\n');
end $$ language plpgsql stable security definer set search_path = public, pg_temp;

revoke all on function fiche_en_bbcode(uuid) from public;
revoke all on function fiche_en_bbcode(uuid) from anon;

comment on function fiche_en_bbcode(uuid) is
  'Le BBCode complet de la fiche d''un personnage. NE LIT QUE LES '
  'LIGNES AFFICHÉES : le filtre vit ici, pas dans la page, pour qu''un '
  'défaut du navigateur ne publie pas ce que quelqu''un avait éteint '
  '(0034). Les textes du joueur passent par bbcode_sans_balise.';

/*  CE QUE LA PAGE APPELLE : le texte, son empreinte, et l'état de la
    publication. Sans argument — le personnage vient de la session,
    comme `lier_mon_personnage` depuis la 0031.  */
create or replace function fiche_a_publier(p jsonb) returns jsonb as $$
declare
  v_joueur uuid;
  v_texte  text;
  v_f      fiche%rowtype;
begin
  select j.id into v_joueur
    from joueur j
   where j.forum_user_id = (p ->> 'forumUserId')::integer
     and j.id in (select mes_joueurs());
  if v_joueur is null then
    return null;
  end if;

  v_texte := fiche_en_bbcode(v_joueur);
  select * into v_f from fiche where joueur_id = v_joueur;

  return jsonb_build_object(
    'texte',     v_texte,
    'empreinte', encode(extensions.digest(v_texte, 'sha256'), 'hex'),
    'sujetId',   v_f.sujet_id,
    'messageId', v_f.message_id,
    'publieLe',  v_f.publie_le,
    --  `aChange` EST LA VRAIE QUESTION : « 3 changements depuis »
    --  demanderait une date de modification par ligne, sur quatre
    --  tables. Savoir que ça a changé suffit à ne pas proposer une
    --  republication identique.
    'aChange',   v_f.publie_le is not null and
                 v_f.empreinte <> encode(extensions.digest(v_texte, 'sha256'), 'hex')
  );
end $$ language plpgsql stable security definer set search_path = public, pg_temp;

revoke all on function fiche_a_publier(jsonb) from public;
revoke all on function fiche_a_publier(jsonb) from anon;
grant execute on function fiche_a_publier(jsonb) to authenticated, service_role;

/*  ET CE QUE LE JOUEUR ENREGISTRE APRÈS AVOIR PUBLIÉ LUI-MÊME. Le
    carnet ne poste pas : il ouvre le formulaire, la personne envoie, et
    revient dire où c'est parti. L'empreinte est recalculée ICI, jamais
    reçue de la page — sinon n'importe qui déclarerait « à jour » une
    fiche qui ne l'est pas, et le carnet cesserait de proposer la mise
    à jour.  */
create or replace function fiche_est_publiee(p jsonb) returns jsonb as $$
declare
  v_joueur uuid;
  v_texte  text;
begin
  select j.id into v_joueur
    from joueur j
   where j.forum_user_id = (p ->> 'forumUserId')::integer
     and j.id in (select mes_joueurs());
  if v_joueur is null then
    raise exception 'PAS_TON_PERSONNAGE';
  end if;

  v_texte := fiche_en_bbcode(v_joueur);

  insert into fiche (joueur_id, sujet_id, message_id, publie_le, empreinte)
  values (v_joueur,
          nullif((p ->> 'sujetId')::integer, 0),
          nullif((p ->> 'messageId')::integer, 0),
          now(),
          encode(extensions.digest(v_texte, 'sha256'), 'hex'))
  on conflict (joueur_id) do update
    set sujet_id   = coalesce(excluded.sujet_id, fiche.sujet_id),
        message_id = coalesce(excluded.message_id, fiche.message_id),
        publie_le  = excluded.publie_le,
        empreinte  = excluded.empreinte;

  return jsonb_build_object('ok', true);
end $$ language plpgsql security definer set search_path = public, pg_temp;

revoke all on function fiche_est_publiee(jsonb) from public;
revoke all on function fiche_est_publiee(jsonb) from anon;
grant execute on function fiche_est_publiee(jsonb) to authenticated, service_role;

-- ── 5 · la RLS ─────────────────────────────────────────────────────

alter table lien enable row level security;
alter table lien force row level security;
alter table fiche enable row level security;
alter table fiche force row level security;

drop policy if exists lien_lecture on lien;
create policy lien_lecture on lien for select to authenticated
  using (joueur_id in (select mes_joueurs()));
drop policy if exists lien_ecriture on lien;
create policy lien_ecriture on lien for insert to authenticated
  with check (joueur_id in (select mes_joueurs()));
drop policy if exists lien_reecriture on lien;
create policy lien_reecriture on lien for update to authenticated
  using (joueur_id in (select mes_joueurs()))
  with check (joueur_id in (select mes_joueurs()));
drop policy if exists lien_effacement on lien;
create policy lien_effacement on lien for delete to authenticated
  using (joueur_id in (select mes_joueurs()));

--  LA FICHE SE LIT MAIS NE S'ÉCRIT PAS À LA MAIN : seule
--  `fiche_est_publiee` y touche, et elle recalcule l'empreinte. Une
--  politique d'écriture ouverte permettrait de déclarer « à jour » une
--  fiche qui ne l'est pas.
drop policy if exists fiche_lecture on fiche;
create policy fiche_lecture on fiche for select to authenticated
  using (joueur_id in (select mes_joueurs()));

grant select, insert, update, delete on lien to authenticated;
grant select on fiche to authenticated;
revoke all on lien from anon;
revoke all on fiche from anon;
