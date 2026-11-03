-- ════════════════════════════════════════════════════════════════════
--  0031 · L'adresse vient du jeton, pas de l'appelant
--
--  ── LE DÉFAUT, TROUVÉ EN BRANCHANT LA PAGE ──────────────────────────
--
--  `lier_mon_personnage(p)` prenait l'adresse dans son argument. Donc
--  n'importe qui de connecté — et se connecter est ouvert à tous,
--  c'est le principe d'un lien par mail — pouvait appeler :
--
--      lier_mon_personnage('{"courriel":"callista@exemple.fr"}')
--
--  et s'attacher les personnages de quelqu'un d'autre. La session
--  prouvait qu'on relevait UNE boîte ; l'argument disait librement
--  LAQUELLE. Les deux ne se parlaient pas.
--
--  Écrit il y a une heure dans la `0029`, et l'erreur est d'avoir
--  recopié la forme des autres fonctions — qui, elles, tournent en
--  `service_role` et n'ont donc personne à qui mentir.
--
--  ── LA CORRECTION ───────────────────────────────────────────────────
--
--  L'adresse se lit dans le jeton, où Supabase Auth l'a mise après
--  avoir vérifié que la personne relève cette boîte. Elle n'est plus un
--  argument : la fonction n'en prend aucun.
--
--  C'est le même principe que `auth_courant()` depuis la `0004` : on ne
--  croit du jeton que ce que le jeton porte, et on ne croit de
--  l'appelant rien du tout.
-- ════════════════════════════════════════════════════════════════════

-- ── 1 · l'adresse du jeton courant ─────────────────────────────────

create or replace function courriel_courant() returns text as $$
  select nullif(
           nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'email',
           ''
         );
$$ language sql stable;

comment on function courriel_courant() is
  'L''adresse du jeton courant, telle que Supabase Auth l''y a mise '
  'après avoir vérifié que la personne relève cette boîte. Les deux '
  '`nullif` évitent la même chose que dans auth_courant() : sans jeton, '
  '`current_setting` rend la chaîne vide, et `''''::jsonb` lève.';

-- ── 2 · la liaison ne prend plus d'argument ────────────────────────

drop function if exists lier_mon_personnage(jsonb);

create or replace function lier_mon_personnage()
returns jsonb as $$
declare
  v_auth  uuid := auth_courant();
  v_boite text := boite_du_courriel(courriel_courant());
  v_lies  integer := 0;
begin
  if v_auth is null then
    raise exception 'PAS_DE_SESSION';
  end if;
  --  UN JETON SANS ADRESSE N'EST PAS UNE ERREUR DE L'APPELANT : c'est
  --  un compte créé autrement qu'avec un mail. Il n'a simplement aucun
  --  personnage à réclamer.
  if v_boite is null or v_boite = '' then
    raise exception 'JETON_SANS_ADRESSE';
  end if;

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

revoke all on function lier_mon_personnage() from public;
revoke all on function lier_mon_personnage() from anon;
grant execute on function lier_mon_personnage() to authenticated, service_role;

comment on function lier_mon_personnage() is
  'Attache au compte connecté tous les personnages dont l''adresse '
  'relève de la MÊME BOÎTE que celle du jeton — étiquettes « +1 » '
  'comprises (0030). Aucun argument : l''adresse vient du jeton, pas '
  'de l''appelant (0031). Rejouable sans dommage.';
