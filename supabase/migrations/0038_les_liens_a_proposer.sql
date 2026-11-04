-- ════════════════════════════════════════════════════════════════════
--  0038 · Les liens à proposer
--
--  ── POURQUOI CETTE MIGRATION EXISTE ─────────────────────────────────
--
--  `0036` a écrit `rp_communs`, et le bloc « On te propose des liens »
--  de l'onglet « Mes liens » dit encore, en clair, dans la page :
--  « Ça demande la relève des sujets, qui n'est pas encore en place. »
--  Elle l'est depuis `0037`. La phrase était vraie, elle ne l'est plus,
--  et le bloc n'a jamais rien montré.
--
--  Il manquait une fonction : `rp_communs` répond « quels sujets ai-je
--  joués AVEC CETTE PERSONNE », c'est-à-dire qu'elle demande déjà de
--  savoir qui. Le bloc, lui, propose des gens qu'on n'a pas encore
--  liés — donc il faut la question d'avant : avec qui ai-je joué ?
--
--  ── ELLE NE PROPOSE QUE CE QUI MANQUE ───────────────────────────────
--
--  Un partenaire déjà présent dans `lien` n'est pas une proposition :
--  c'est une carte que le joueur a déjà écrite. Le `not exists` est donc
--  la fonction, pas un filtre d'affichage — le faire côté navigateur
--  reviendrait à envoyer la liste complète des gens avec qui le joueur a
--  joué pour en cacher la moitié à l'écran.
--
--  ── ET ELLE NE SORT PAS DES SUJETS DU JOUEUR ────────────────────────
--
--  Le `in (select mes_joueurs())` est DANS la fonction, comme pour
--  `rp_communs` : passer un `forumUserId` qui n'est pas le sien rend une
--  liste vide, pas les partenaires de quelqu'un d'autre. C'est ce qui
--  permet de la laisser `security definer` sans ouvrir `rp_participant`,
--  qui est une table du serveur et n'a aucun droit de lecture directe.
-- ════════════════════════════════════════════════════════════════════

-- ── 1 · combien on en propose, et pourquoi c'est borné ──────────────

/*  UN JOUEUR DE DEUX ANS A QUARANTE PARTENAIRES, et un bloc de quarante
    cartes n'est plus une proposition, c'est un annuaire — le bottin
    existe déjà et c'est son travail. On garde les douze plus nourris,
    parce que c'est le nombre de RP partagés qui dit qu'un lien vaut
    d'être écrit, pas la date. */
create or replace function liens_proposes_au_plus() returns integer as $$
  select 12;
$$ language sql immutable;

revoke all on function liens_proposes_au_plus() from public;
grant execute on function liens_proposes_au_plus() to authenticated, service_role;

comment on function liens_proposes_au_plus() is
  'Combien de partenaires le bloc « On te propose des liens » montre au '
  'plus (0038). En base plutôt qu''en dur dans le navigateur : la '
  'fonction coupe la liste, donc c''est elle qui doit porter le nombre.';

-- ── 2 · avec qui le joueur a joué, et qu'il n'a pas encore lié ──────

create or replace function liens_a_proposer(p jsonb) returns jsonb as $$
declare
  v_joueur uuid;
  v_moi    integer := (p ->> 'forumUserId')::integer;
begin
  select j.id into v_joueur
    from joueur j
   where j.forum_user_id = v_moi
     and j.id in (select mes_joueurs());
  if v_joueur is null then
    return '[]'::jsonb;
  end if;

  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'forumUserId', x.membre,
             'pseudo',      x.pseudo,
             'ensemble',    x.ensemble,
             'dernierLe',   x.dernier_le
           --  L'ORDRE EST ÉCRIT DEUX FOIS, ET IL LE FAUT. Celui de la
           --  sous-requête choisit QUI entre dans les douze ; celui-ci
           --  choisit dans quel ordre ils sortent. `jsonb_agg` ne
           --  promet pas de suivre l'ordre de ce qu'on lui donne, et un
           --  jour où il ne le suivra pas, la proposition la mieux
           --  nourrie ne serait plus la première de la liste.
           ) order by x.ensemble desc, x.dernier_le desc nulls last, x.membre)
      from (
        select a.forum_user_id   as membre,
               --  LE PSEUDO EST CELUI QUE LA RELÈVE A VU EN DERNIER :
               --  `max(vu_le)` et non `max(pseudo)`, qui rendrait le
               --  plus grand par ordre alphabétique. Un joueur qui
               --  change de pseudo doit apparaître sous le nouveau.
               (array_agg(a.pseudo order by a.vu_le desc))[1] as pseudo,
               count(*)::integer as ensemble,
               max(r.dernier_le) as dernier_le
          from rp r
          join rp_participant a
            on a.sujet_id = r.sujet_id
         where r.joueur_id = v_joueur
           --  On ne se propose pas à soi-même.
           and a.forum_user_id <> v_moi
           --  NI CE QUI EST DÉJÀ ÉCRIT : une carte de lien existante
           --  n'est pas une proposition.
           and not exists (
                 select 1 from lien l
                  where l.joueur_id = v_joueur
                    and l.cible_forum_id = a.forum_user_id)
         group by a.forum_user_id
         order by count(*) desc, max(r.dernier_le) desc nulls last,
                  a.forum_user_id
         limit liens_proposes_au_plus()
      ) x
  ), '[]'::jsonb);
end $$ language plpgsql stable security definer set search_path = public, pg_temp;

revoke all on function liens_a_proposer(jsonb) from public;
revoke all on function liens_a_proposer(jsonb) from anon;
grant execute on function liens_a_proposer(jsonb) to authenticated, service_role;

comment on function liens_a_proposer(jsonb) is
  'Les membres avec qui le joueur a joué et qu''il n''a pas encore liés, '
  'les plus nourris d''abord (0038). Calculée, jamais saisie : elle sort '
  'de `rp` et `rp_participant`, que la relève remplit. Elle ne rend que '
  'les sujets du joueur connecté — un `forumUserId` qui n''est pas le '
  'sien rend une liste vide.';
