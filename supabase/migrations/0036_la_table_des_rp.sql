-- ════════════════════════════════════════════════════════════════════
--  0036 · La table des RP — tâche 9 de la relève
--
--  Note de code `383:1049`, via la planche 72 :
--
--      « /search?search_author=<pseudo>&show_results=topics renvoie
--        tous les sujets où le joueur a écrit ; l'Edge Function la lit
--        à la relève et garde le résultat dans une table rp. »
--
--  « Mes RP n'est PAS un onglet d'écriture : c'est une table que la
--  relève remplit, et le joueur n'y contrôle que la colonne “prévus”
--  et l'ordre à la main » (planche 33 §3).
--
--  ── LA LIGNE EST ÉCRITE PAR LE SERVEUR, SAUF DEUX COLONNES ──────────
--
--  Tout ce qui décrit le sujet — titre, forum, dernier message, date —
--  vient de la relève et ne se discute pas : c'est l'état du forum, pas
--  une opinion. Deux colonnes appartiennent au joueur : `prevu`, qui
--  dit « celui-là, on l'a prévu mais il n'a pas commencé », et `ordre`,
--  pour ranger son tableau comme il l'entend.
--
--  LA RLS NE SAIT PAS LIMITER UNE MISE À JOUR À DEUX COLONNES. Elle
--  autorise ou refuse une ligne, pas un champ. Alors c'est le droit
--  PostgreSQL qui le fait — `grant update (prevu, ordre)` et rien
--  d'autre — exactement comme la `0008` n'accorde que `emplacement`
--  sur `pokemon`. Un appel PostgREST qui tenterait de réécrire le titre
--  se fait refuser par la base, pas par la page.
--
--  ── CE QUE CETTE TABLE DÉBLOQUE AILLEURS ────────────────────────────
--
--  Deux trous laissés ouverts dans « Mes liens » se referment avec
--  elle : les RP COMMUNS (« un sujet où le joueur et la cible ont tous
--  les deux posté ») et les PROPOSITIONS (les réponses au sujet de la
--  fiche). Les deux ont besoin de savoir QUI A ÉCRIT où — d'où la table
--  `rp_participant`, qui est la moitié utile de la relève.
-- ════════════════════════════════════════════════════════════════════

-- ── 1 · le sujet, tel que la relève le voit ────────────────────────

create table if not exists rp (
  joueur_id        uuid    not null references joueur(id) on delete cascade,
  sujet_id         integer not null check (sujet_id > 0),
  titre            text    not null default '',
  forum_id         integer not null default 0,
  forum_nom        text    not null default '',
  reponses         integer not null default 0 check (reponses >= 0),
  dernier_le       timestamptz,
  dernier_auteur   text    not null default '',
  dernier_message  integer,
  --  L'EXTRAIT ÉVITE D'ALLER CHERCHER LE MESSAGE au chargement de la
  --  page : « les 140 premiers caractères du dernier message, balises
  --  retirées, coupés au mot » (planche 72).
  extrait          text    not null default '' check (length(extrait) <= 200),
  --  ── CE QUI APPARTIENT AU JOUEUR ────────────────────────────────
  prevu            boolean not null default false,
  ordre            smallint not null default 0,
  --  ── CE QUI APPARTIENT À LA RELÈVE ──────────────────────────────
  releve_le        timestamptz not null default now(),
  primary key (joueur_id, sujet_id)
);

create index if not exists rp_du_joueur on rp (joueur_id, dernier_le desc);

comment on table rp is
  'Les sujets où un personnage a écrit, relevés depuis la recherche '
  'native du forum (tâche 9). Le joueur n''y contrôle que `prevu` et '
  '`ordre` — le reste est l''état du forum (0036).';

comment on column rp.prevu is
  'Posé par le joueur : un RP prévu, pas encore commencé. C''est la '
  'seule chose que la relève ne sait pas et qu''elle ne doit pas '
  'écraser.';

-- ── 2 · qui a écrit où ─────────────────────────────────────────────

--  LA MOITIÉ UTILE DE LA RELÈVE. Sans elle, « un sujet où le joueur et
--  la cible ont tous les deux posté » n'est pas calculable, et les RP
--  communs de la fiche de liens resteraient un bloc vide.
--
--  C'est une table du SERVEUR, pas du joueur : aucun droit d'écriture
--  n'est accordé, et la lecture passe par les sujets qu'il a lui-même.
create table if not exists rp_participant (
  sujet_id      integer not null check (sujet_id > 0),
  forum_user_id integer not null check (forum_user_id > 0),
  pseudo        text    not null default '',
  vu_le         timestamptz not null default now(),
  primary key (sujet_id, forum_user_id)
);

create index if not exists rp_participant_du_membre
  on rp_participant (forum_user_id);

-- ── 3 · les RP communs, calculés et jamais saisis ──────────────────

/*  « Calculés, jamais saisis : un RP commun est un sujet où le joueur
    et la cible ont tous les deux posté. »

    LA FONCTION NE REND QUE LES SUJETS DU JOUEUR CONNECTÉ : le `in
    (select mes_joueurs())` est dedans, donc demander les RP communs de
    quelqu'un d'autre rend une liste vide plutôt qu'un refus — on ne
    renseigne pas sur l'existence d'un personnage.  */
create or replace function rp_communs(p jsonb) returns jsonb as $$
declare
  v_joueur uuid;
begin
  select j.id into v_joueur
    from joueur j
   where j.forum_user_id = (p ->> 'forumUserId')::integer
     and j.id in (select mes_joueurs());
  if v_joueur is null then
    return '[]'::jsonb;
  end if;

  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'sujetId',   r.sujet_id,
             'titre',     r.titre,
             'dernierLe', r.dernier_le
           ) order by r.dernier_le desc nulls last)
      from rp r
      join rp_participant a
        on a.sujet_id = r.sujet_id
       and a.forum_user_id = (p ->> 'cibleForumId')::integer
     where r.joueur_id = v_joueur
  ), '[]'::jsonb);
end $$ language plpgsql stable security definer set search_path = public, pg_temp;

revoke all on function rp_communs(jsonb) from public;
revoke all on function rp_communs(jsonb) from anon;
grant execute on function rp_communs(jsonb) to authenticated, service_role;

-- ── 4 · la RLS, et le droit qui la complète ────────────────────────

alter table rp enable row level security;
alter table rp force row level security;
alter table rp_participant enable row level security;

drop policy if exists rp_lecture on rp;
create policy rp_lecture on rp for select to authenticated
  using (joueur_id in (select mes_joueurs()));

drop policy if exists rp_reecriture on rp;
create policy rp_reecriture on rp for update to authenticated
  using (joueur_id in (select mes_joueurs()))
  with check (joueur_id in (select mes_joueurs()));

--  NI INSERTION NI EFFACEMENT POUR LE JOUEUR : la liste de ses sujets
--  n'est pas une chose qu'on se déclare. S'en ajouter un serait se
--  mettre dans un RP où l'on n'a pas écrit.
grant select on rp to authenticated;
grant update (prevu, ordre) on rp to authenticated;
revoke all on rp from anon;
revoke all on rp_participant from anon;
revoke all on rp_participant from authenticated;

comment on table rp_participant is
  'Qui a écrit dans quel sujet. Table du serveur : le joueur n''y a '
  'aucun droit, et n''y accède que par rp_communs() (0036).';

-- ── 5 · ce que la relève appelle ───────────────────────────────────

/*  LA TRANSACTION VIT DANS LA BASE, pas dans la fonction Edge. Relever
    les RP d'un joueur, c'est écrire des sujets, en effacer d'autres et
    noter des participants : trois gestes qui doivent tenir ou tomber
    ensemble. Une Edge Function qui enchaînerait trois appels PostgREST
    laisserait, à la première panne de réseau, une liste à moitié
    remplacée — et on ne saurait pas laquelle.  */
create or replace function joueurs_a_relever() returns jsonb as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'joueurId',    id,
           'forumUserId', forum_user_id,
           'pseudo',      pseudo
         ) order by pseudo), '[]'::jsonb)
    from joueur
   --  TOUS LES PERSONNAGES, sans filtre de validation : il n'y a pas de
   --  colonne qui dise « validé », et un personnage qui écrit a des RP
   --  à relever même si le staff n'a pas encore fini sa fiche.
   where pseudo <> '';
$$ language sql stable security definer set search_path = public, pg_temp;

revoke all on function joueurs_a_relever() from public;
revoke all on function joueurs_a_relever() from anon;
revoke all on function joueurs_a_relever() from authenticated;
grant execute on function joueurs_a_relever() to service_role;

create or replace function relever_les_rp(p jsonb) returns jsonb as $$
declare
  v_joueur  uuid := (p ->> 'joueurId')::uuid;
  v_sujets  jsonb := coalesce(p -> 'sujets', '[]'::jsonb);
  v_vus     integer[];
  v_ecrits  integer := 0;
  v_effaces integer := 0;
begin
  if v_joueur is null then
    raise exception 'JOUEUR_MANQUANT';
  end if;

  select coalesce(array_agg((s ->> 'sujetId')::integer), array[]::integer[])
    into v_vus
    from jsonb_array_elements(v_sujets) as s;

  --  LES COLONNES DU JOUEUR NE SONT PAS DANS LA LISTE : `prevu` et
  --  `ordre` ne sont pas touchés par la relève. C'est tout le contrat
  --  de cette table — le serveur décrit, le joueur annote.
  insert into rp (joueur_id, sujet_id, titre, forum_id, forum_nom, reponses,
                  dernier_le, dernier_auteur, dernier_message, extrait, releve_le)
  select v_joueur,
         (s ->> 'sujetId')::integer,
         coalesce(s ->> 'titre', ''),
         coalesce((s ->> 'forumId')::integer, 0),
         coalesce(s ->> 'forumNom', ''),
         coalesce((s ->> 'reponses')::integer, 0),
         nullif(s ->> 'dernierLe', '')::timestamptz,
         coalesce(s ->> 'dernierAuteur', ''),
         nullif(s ->> 'dernierMessage', '')::integer,
         left(coalesce(s ->> 'extrait', ''), 200),
         now()
    from jsonb_array_elements(v_sujets) as s
  on conflict (joueur_id, sujet_id) do update
    set titre           = excluded.titre,
        forum_id        = excluded.forum_id,
        forum_nom       = excluded.forum_nom,
        reponses        = excluded.reponses,
        dernier_le      = excluded.dernier_le,
        dernier_auteur  = excluded.dernier_auteur,
        dernier_message = excluded.dernier_message,
        --  L'EXTRAIT NE S'EFFACE PAS AVEC UNE RELÈVE QUI NE L'A PAS LU :
        --  il vient d'une autre lecture, plus chère, qui ne tourne pas
        --  à chaque passage.
        extrait         = case when excluded.extrait = '' then rp.extrait
                               else excluded.extrait end,
        releve_le       = excluded.releve_le;
  get diagnostics v_ecrits = row_count;

  --  ── CE QUI A DISPARU DU FORUM S'EN VA, SAUF CE QU'IL A MARQUÉ ───
  --
  --  Un sujet effacé ou déplacé hors de sa portée ne doit pas rester
  --  dans son tableau pour toujours. Mais `prevu` est une note de SA
  --  main : la relève ne la connaît pas, donc elle ne la jette pas.
  delete from rp
   where joueur_id = v_joueur
     and not prevu
     and not (sujet_id = any (v_vus));
  get diagnostics v_effaces = row_count;

  --  ── QUI A ÉCRIT OÙ ──────────────────────────────────────────────
  insert into rp_participant (sujet_id, forum_user_id, pseudo, vu_le)
  select (s ->> 'sujetId')::integer,
         (m ->> 'id')::integer,
         coalesce(m ->> 'pseudo', ''),
         now()
    from jsonb_array_elements(v_sujets) as s,
         jsonb_array_elements(coalesce(s -> 'participants', '[]'::jsonb)) as m
   where (m ->> 'id') ~ '^\d+$'
  on conflict (sujet_id, forum_user_id) do update
    set pseudo = case when excluded.pseudo = '' then rp_participant.pseudo
                      else excluded.pseudo end,
        vu_le  = excluded.vu_le;

  return jsonb_build_object('ecrits', v_ecrits, 'effaces', v_effaces);
end $$ language plpgsql security definer set search_path = public, pg_temp;

revoke all on function relever_les_rp(jsonb) from public;
revoke all on function relever_les_rp(jsonb) from anon;
revoke all on function relever_les_rp(jsonb) from authenticated;
grant execute on function relever_les_rp(jsonb) to service_role;

comment on function relever_les_rp(jsonb) is
  'Remplace les RP d''un joueur par ce que la recherche du forum a '
  'donné, en une transaction. NE TOUCHE NI `prevu` NI `ordre` — ce '
  'sont les deux colonnes du joueur — et n''efface pas une ligne qu''il '
  'a marquée « prévu » (0036).';
