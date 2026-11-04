-- ════════════════════════════════════════════════════════════════════
--  0037 · L'état d'un RP, et la carte qu'on ajoute soi-même
--
--  ── CE QUE L'ÉCRAN DIT, ET QUE LA PLANCHE 33 NE DISAIT PAS ──────────
--
--  La planche 33 §3 : « le joueur n'y contrôle que la colonne “prévus”
--  et l'ordre à la main ». La `0036` l'a prise au mot : un booléen
--  `prevu`, et aucune insertion possible.
--
--  L'écran `383:622`, relevé aujourd'hui, en demande deux de plus :
--
--  1. « TU COLLES L'ADRESSE D'UN SUJET, IL SE RANGE TOUT SEUL », et un
--     bouton « créer une carte vide ». Donc le joueur AJOUTE des
--     cartes — pour un RP convenu dont le sujet existe mais où il n'a
--     pas encore écrit, et que la recherche ne rend donc pas.
--  2. La colonne « état » du tableau montre six mots, pas deux : à
--     faire, à toi, à moi, en pause, clôturé. Un booléen ne les tient
--     pas.
--
--  Les deux sont la même chose, vue de deux côtés : ce que le joueur
--  dit de son RP. Donc `prevu` devient `etat`, et l'insertion s'ouvre —
--  mais étroitement.
--
--  ── « À TOI » ET « À MOI » NE SONT PAS DANS CETTE COLONNE ───────────
--
--  Ils se CALCULENT : le dernier message est-il de moi ? La page les
--  déduit de `dernier_auteur`, que la relève écrit. Les ranger ici
--  ferait deux sources pour une même vérité, et celle du joueur serait
--  fausse dès qu'on lui répond.
--
--  ── ON N'AJOUTE QU'UN RP « PRÉVU », ET ON N'EFFACE QUE CELUI-LÀ ─────
--
--  La politique d'insertion exige `etat = 'prevu'`. C'est ce qui garde
--  le principe de la `0036` : on ne se déclare pas dans un RP où l'on
--  n'a pas écrit. Une carte prévue est une intention, pas une
--  affirmation — et le jour où la personne y écrit, la relève la
--  remplit avec le vrai titre et le vrai dernier message.
--
--  Et l'effacement suit la même borne : une carte relevée revient au
--  passage suivant de toute façon, l'effacer donnerait l'illusion de
--  pouvoir retirer un RP de son histoire.
-- ════════════════════════════════════════════════════════════════════

-- ── 1 · l'état remplace le booléen ─────────────────────────────────

alter table rp add column if not exists etat text not null default 'en-cours';

--  LES CINQ MOTS DE L'ÉCRAN, et pas un de plus. Une colonne de texte
--  libre finirait par porter « en pause ? », « EN PAUSE » et « pause »
--  pour la même chose, et aucun tri ne les rassemblerait.
alter table rp drop constraint if exists rp_etat_connu;
alter table rp add constraint rp_etat_connu
  check (etat in ('en-cours', 'prevu', 'en-pause', 'cloture'));

--  Ce que `prevu` disait passe dans la colonne, puis le booléen s'en va.
update rp set etat = 'prevu' where prevu;
alter table rp drop column if exists prevu;

comment on column rp.etat is
  'Ce que le JOUEUR dit de son RP : en-cours, prevu, en-pause, '
  'cloture. « À toi » et « à moi » n''y sont pas — ils se calculent '
  'depuis `dernier_auteur`, et deux sources pour une même vérité en '
  'font toujours une fausse (0037).';

-- ── 2 · la relève ne touche toujours pas ce qui est à lui ──────────

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
        extrait         = case when excluded.extrait = '' then rp.extrait
                               else excluded.extrait end,
        releve_le       = excluded.releve_le;
        --  `etat` ET `ordre` NE SONT PAS DANS CETTE LISTE, et c'est
        --  tout le contrat de la table. La relève décrit le forum ;
        --  « en pause » et « clôturé » sont ce que la personne en dit,
        --  et elle seule le sait.
  get diagnostics v_ecrits = row_count;

  --  CE QUI A DISPARU DU FORUM S'EN VA, SAUF CE QU'ELLE A ANNOTÉ. Une
  --  carte « prévue » décrit un RP où elle n'a pas encore écrit : la
  --  recherche ne la rendra jamais, et l'effacer à chaque passage
  --  reviendrait à interdire d'en créer.
  delete from rp
   where joueur_id = v_joueur
     and etat = 'en-cours'
     and not (sujet_id = any (v_vus));
  get diagnostics v_effaces = row_count;

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

-- ── 3 · le joueur ajoute une carte prévue, et rien d'autre ─────────

drop policy if exists rp_ecriture on rp;
create policy rp_ecriture on rp for insert to authenticated
  with check (joueur_id in (select mes_joueurs()) and etat = 'prevu');

drop policy if exists rp_effacement on rp;
create policy rp_effacement on rp for delete to authenticated
  using (joueur_id in (select mes_joueurs()) and etat = 'prevu');

--  LES COLONNES QU'IL PEUT ÉCRIRE, et `insert` ne passe pas par là :
--  une insertion a besoin de poser `joueur_id` et `sujet_id`, que la
--  politique encadre déjà. C'est la MISE À JOUR qu'il faut borner,
--  sinon un PATCH réécrirait le titre d'un sujet relevé.
revoke update on rp from authenticated;
grant update (etat, ordre) on rp to authenticated;
grant insert (joueur_id, sujet_id, titre, etat, ordre) on rp to authenticated;
grant delete on rp to authenticated;

comment on policy rp_ecriture on rp is
  'On n''ajoute qu''un RP « prévu » : une intention, pas une '
  'affirmation. Se déclarer dans un RP où l''on n''a pas écrit reste '
  'impossible (0037).';
