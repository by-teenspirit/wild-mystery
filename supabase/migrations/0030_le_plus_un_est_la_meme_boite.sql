-- ════════════════════════════════════════════════════════════════════
--  0030 · Le « +1 » est la même boîte
--
--  « On ne peut pas créer un compte sur Forumactif avec la même adresse
--  e-mail, sauf en rajoutant +1 », 3 novembre.
--
--  ── CE QUE ÇA RÈGLE ─────────────────────────────────────────────────
--
--  Forumactif exige une adresse différente par compte. Une personne qui
--  a trois personnages s'inscrit donc avec `elle@exemple.fr`,
--  `elle+1@exemple.fr`, `elle+2@exemple.fr` — trois adresses pour UNE
--  boîte, c'est la convention de l'étiquette (le « plus addressing »).
--
--  Sans rien faire, la liaison de `0029` aurait donc demandé TROIS
--  connexions à cette personne, une par personnage, puisqu'elle
--  comparait les adresses caractère par caractère. Et chez Supabase
--  Auth, `elle+1@exemple.fr` est bien un compte distinct de
--  `elle@exemple.fr`.
--
--  On compare donc les adresses en retirant l'étiquette : ce qui compte
--  est la BOÎTE, et la boîte est ce que la personne relève. Elle se
--  connecte une fois, avec n'importe laquelle de ses adresses, et tous
--  ses personnages suivent.
--
--  ── CE QUE ÇA NE RÈGLE PAS, ET C'EST ASSUMÉ ─────────────────────────
--
--  Deux personnes DIFFÉRENTES qui partagent une boîte seraient
--  confondues. Mais partager une boîte, c'est déjà partager la
--  possibilité de se connecter à la place de l'autre : il n'y a rien à
--  protéger de plus que ce que la boîte protège déjà.
--
--  Et l'étiquette n'est retirée que pour la COMPARAISON. On garde
--  l'adresse telle que le staff l'a saisie, parce que c'est celle qui
--  est dans le profil Forumactif et que c'est à elle qu'on écrira.
-- ════════════════════════════════════════════════════════════════════

-- ── 1 · la boîte, derrière l'adresse ───────────────────────────────

create or replace function boite_du_courriel(p_courriel text)
returns text as $$
  select case
    when p_courriel is null or position('@' in p_courriel) = 0 then null
    else lower(
           split_part(split_part(trim(p_courriel), '@', 1), '+', 1)
           || '@' ||
           split_part(trim(p_courriel), '@', 2)
         )
  end;
$$ language sql immutable;

comment on function boite_du_courriel(text) is
  'L''adresse réduite à sa boîte : casse en bas, et tout ce qui suit un '
  '« + » dans la partie locale retiré. `Elle+2@Exemple.FR` et '
  '`elle@exemple.fr` rendent la même chose. Voir 0030.';

--  L'INDEX SUIT LA FONCTION, sinon la liaison balaie la table entière.
--  `immutable` est ce qui permet de l'indexer, et c'est vrai : la
--  fonction ne lit rien et ne dépend d'aucun réglage.
drop index if exists joueur_courriel_idx;
create index if not exists joueur_boite_idx on joueur (boite_du_courriel(courriel));

-- ── 2 · la liaison compare des boîtes ──────────────────────────────

create or replace function lier_mon_personnage(p jsonb)
returns jsonb as $$
declare
  v_auth  uuid := auth_courant();
  v_boite text := boite_du_courriel(p->>'courriel');
  v_lies  integer := 0;
begin
  if v_auth is null then
    raise exception 'PAS_DE_SESSION';
  end if;
  if v_boite is null or v_boite = '' then
    raise exception 'COURRIEL_MANQUANT';
  end if;

  --  TOUS LES PERSONNAGES DE CETTE BOÎTE, d'un coup — étiquettes
  --  comprises. Une personne qui a trois personnages ne clique pas
  --  trois fois.
  update joueur
     set auth_id = v_auth,
         lie_le  = coalesce(lie_le, now())
   where boite_du_courriel(courriel) = v_boite
     and (auth_id is null or auth_id = v_auth);
  get diagnostics v_lies = row_count;

  return jsonb_build_object(
    'lies',        v_lies,
    'personnages', coalesce((
      select jsonb_agg(jsonb_build_object(
               'forumUserId', j.forum_user_id,
               'pseudo',      j.pseudo
             ) order by j.pseudo)
        from joueur j where j.auth_id = v_auth
    ), '[]'::jsonb)
  );
end $$ language plpgsql security definer set search_path = public, pg_temp;

revoke all on function lier_mon_personnage(jsonb) from public;
revoke all on function lier_mon_personnage(jsonb) from anon;
grant execute on function lier_mon_personnage(jsonb) to authenticated, service_role;

comment on function lier_mon_personnage(jsonb) is
  'Attache tous les personnages dont l''adresse relève de la même boîte '
  'au compte connecté — étiquettes « +1 » comprises, voir 0030. '
  'Réservée à « authenticated » : sans session, rien à lier. Rejouable '
  'sans dommage.';
