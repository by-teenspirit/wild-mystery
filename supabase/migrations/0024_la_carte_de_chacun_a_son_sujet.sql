-- ════════════════════════════════════════════════════════════════════
--  0024 · La carte de chacun a son sujet
--
--  « Ce que je veux c'est que Arceus poste toutes les trainer card
--  dans une catégorie, pour chaque joueur », 2 novembre. Un sujet par
--  joueur dans le forum 45.
--
--  ── POURQUOI ÇA NE COÛTE QU'UN SEUL MESSAGE PAR JOUEUR ──────────────
--
--  La carte ne contient aucune donnée : elle porte un marqueur, et le
--  script la remplit à chaque affichage depuis `carte_dresseur()`.
--  Donc la relève poste UNE fois, à l'arrivée du joueur, et plus
--  jamais. Pas de mise à jour, pas de repassage, pas de message édité.
--
--  Si la carte avait porté ses chiffres en dur, cette tâche aurait dû
--  rééditer trente messages à chaque capture — et Forumactif n'aime
--  pas qu'on édite trente messages toutes les cinq minutes.
--
--  ── CE QUE LA COLONNE RETIENT ───────────────────────────────────────
--
--  `carte_sujet_id` : le sujet créé, ou `null` tant qu'il n'existe
--  pas. C'est ce qui empêche de reposter. Elle est nullable et sans
--  contrainte d'unicité : deux joueurs ne peuvent pas partager un
--  sujet, mais ce n'est pas la base qui doit l'empêcher — c'est la
--  tâche, et un index unique transformerait un bug de la relève en
--  panne de la relève.
-- ════════════════════════════════════════════════════════════════════

alter table joueur add column if not exists carte_sujet_id bigint;

comment on column joueur.carte_sujet_id is
  'Le sujet où la carte dresseur de ce joueur est publiée, dans le '
  'forum des cartes. `null` tant qu''elle ne l''est pas. La relève '
  'poste une seule fois : la carte se remplit toute seule ensuite.';

-- ── 1 · qui attend sa carte ────────────────────────────────────────

--  LES JOUEURS SANS SUJET, LES PLUS ANCIENS D'ABORD. Un nouveau venu
--  attend cinq minutes de plus que celui d'avant, et c'est l'ordre
--  qu'on attend d'une file.
--
--  `limite` existe parce que la relève a cinq minutes et qu'ouvrir le
--  forum trente fois d'affilée à la première exécution la ferait
--  dépasser. Dix par passage vide une file de cent en moins d'une
--  heure, sans que personne ne le remarque.
create or replace function cartes_a_publier(p jsonb default '{}'::jsonb)
returns jsonb as $$
  select coalesce(jsonb_agg(j order by j->>'creeLe'), '[]'::jsonb)
    from (
      select jsonb_build_object(
               'joueurId',    id,
               'forumUserId', forum_user_id,
               'pseudo',      pseudo,
               'creeLe',      cree_le
             ) as j
        from joueur
       where carte_sujet_id is null
       order by cree_le
       limit coalesce((p->>'limite')::integer, 10)
    ) t;
$$ language sql security definer set search_path = public;

revoke all on function cartes_a_publier(jsonb) from public;
revoke all on function cartes_a_publier(jsonb) from anon, authenticated;
grant execute on function cartes_a_publier(jsonb) to service_role;

-- ── 2 · noter le sujet créé ────────────────────────────────────────

create or replace function carte_publiee(p jsonb)
returns boolean as $$
declare v_id uuid;
begin
  --  ON N'ÉCRASE PAS UN SUJET DÉJÀ NOTÉ. Si deux passages de la relève
  --  se chevauchaient — le verrou l'interdit, mais le verrou est du
  --  code —, le second ne doit pas faire oublier le premier sujet, qui
  --  resterait sur le forum sans que rien ne le relie à personne.
  update joueur
     set carte_sujet_id = (p->>'sujetId')::bigint
   where id = (p->>'joueurId')::uuid
     and carte_sujet_id is null
   returning id into v_id;

  return v_id is not null;
end $$ language plpgsql security definer set search_path = public;

revoke all on function carte_publiee(jsonb) from public;
revoke all on function carte_publiee(jsonb) from anon, authenticated;
grant execute on function carte_publiee(jsonb) to service_role;
