-- ════════════════════════════════════════════════════════════════════
--  0029 · Une connexion, plusieurs personnages
--
--  « On va mettre en place le process de "lier mon compte" » · « la
--  personne n'a pas toujours la même adresse e-mail pour chacun de ses
--  personnages », 3 novembre.
--
--  ── CE QUE LA SECONDE PHRASE CHANGE ─────────────────────────────────
--
--  Elle dit « pas TOUJOURS la même ». Donc parfois la même : deux
--  personnages peuvent partager une adresse. Or une adresse ne fait
--  qu'un seul compte chez Supabase Auth — c'est sa clé.
--
--  `joueur.auth_id` était `unique` : un compte d'authentification ne
--  pouvait donc ouvrir qu'un seul personnage, et la deuxième liaison
--  aurait été refusée par la base, sans que le message dise pourquoi.
--  On retire l'unicité.
--
--  ── ET ÇA TOUCHE NEUF POLITIQUES, PAS UNE COLONNE ───────────────────
--
--  `joueur_courant()` rend UN identifiant. Avec deux personnages
--  derrière une connexion, elle en rendrait un des deux — et
--  PostgreSQL ne lève pas pour autant : une fonction SQL qui rend un
--  scalaire prend la première ligne et se tait. Les neuf politiques
--  écrites `joueur_id = joueur_courant()` auraient alors montré le
--  carnet d'un personnage et caché l'autre, au hasard de l'ordre des
--  lignes. C'est le genre de défaut qu'on ne voit qu'au deuxième
--  personnage de la première joueuse.
--
--  Elles passent donc toutes à `in (select mes_joueurs())`.
--
--  `mes_joueurs()` est `security definer` pour la même raison que
--  `joueur_courant()` l'est depuis `0007` : la politique de lecture de
--  `joueur` appelle la fonction, qui lit `joueur`, qui évalue la
--  politique… jusqu'à épuiser la pile. Et `search_path` est épinglé,
--  sans quoi un appelant qui pose un schéma devant `public` ferait
--  exécuter SA table `joueur` avec les droits du propriétaire.
--
--  ── `joueur_courant()` RESTE, ET DEVIENT HONNÊTE ────────────────────
--
--  Elle est appelée ailleurs — `0008` la compte parmi les fonctions
--  ouvertes à `anon`, et un contrat vérifie qu'elle rend `null` pour un
--  visiteur. On la garde donc, en la bornant à UNE ligne explicitement
--  (`limit 1`), pour que son résultat soit décidé et non laissé à
--  l'ordre physique des lignes. Le code qui veut tous les personnages
--  appelle `mes_joueurs()`.
-- ════════════════════════════════════════════════════════════════════

-- ── 1 · une connexion peut porter plusieurs personnages ────────────

alter table joueur drop constraint if exists joueur_auth_id_key;

comment on column joueur.auth_id is
  'Le compte Supabase Auth qui ouvre ce personnage. PAS unique depuis '
  '0029 : une même adresse peut porter plusieurs personnages, et une '
  'adresse ne fait qu''un compte chez Supabase Auth.';

-- ── 2 · tous mes personnages ───────────────────────────────────────

create or replace function mes_joueurs()
returns setof uuid as $$
  select j.id from joueur j where j.auth_id = auth_courant()
$$ language sql stable security definer set search_path = public, pg_temp;

comment on function mes_joueurs() is
  'Tous les personnages derrière le jeton courant. SECURITY DEFINER à '
  'dessein, comme joueur_courant() depuis 0007 : les politiques de '
  'lecture appellent cette fonction, qui lit « joueur » — sans cela '
  'elles récursent. Elle ne rend rien que l''appelant ne sache déjà.';

revoke all on function mes_joueurs() from public;
grant execute on function mes_joueurs() to anon, authenticated, service_role;

--  BORNÉE À UNE LIGNE, EXPLICITEMENT. Elle rendait déjà la première
--  venue ; maintenant c'est écrit, et son nom ne promet plus qu'il n'y
--  en a qu'une.
create or replace function joueur_courant() returns uuid as $$
  select j.id from joueur j where j.auth_id = auth_courant() limit 1
$$ language sql stable security definer set search_path = public, pg_temp;

comment on function joueur_courant() is
  'UN des personnages derrière le jeton courant, ou NULL. Depuis 0029 '
  'une connexion peut en porter plusieurs : ce qui veut les lire tous '
  'appelle mes_joueurs(). Gardée pour les appels qui n''ont besoin que '
  'de savoir SI quelqu''un est connecté.';

-- ── 3 · les neuf politiques, réécrites ─────────────────────────────

drop policy if exists "chacun lit sa fiche" on joueur;
create policy "chacun lit ses fiches" on joueur
  for select using (id in (select mes_joueurs()));

drop policy if exists "chacun lit ses pokémon" on pokemon;
create policy "chacun lit ses pokémon" on pokemon
  for select using (joueur_id in (select mes_joueurs()));

drop policy if exists "chacun lit son sac" on sac;
create policy "chacun lit son sac" on sac
  for select using (joueur_id in (select mes_joueurs()));

drop policy if exists "chacun lit son pokédex" on pokedex;
create policy "chacun lit son pokédex" on pokedex
  for select using (joueur_id in (select mes_joueurs()));

drop policy if exists "chacun lit ses pensions" on pension;
create policy "chacun lit ses pensions" on pension
  for select using (
    joueur_id in (select mes_joueurs()) or gerant_id in (select mes_joueurs())
  );

drop policy if exists "chacun lit ses commandes" on commande;
create policy "chacun lit ses commandes" on commande
  for select using (joueur_id in (select mes_joueurs()));

drop policy if exists "chacun lit ses analyses" on analyse_fossile;
create policy "chacun lit ses analyses" on analyse_fossile
  for select using (joueur_id in (select mes_joueurs()));

--  LE RANGEMENT. La seule politique d'ÉCRITURE du joueur, et elle garde
--  sa condition sur l'emplacement : ranger ne doit pas pouvoir sortir
--  un pokémon du jeu.
drop policy if exists "chacun range ses pokémon" on pokemon;
create policy "chacun range ses pokémon" on pokemon
  for update using (joueur_id in (select mes_joueurs()))
  with check (
    joueur_id in (select mes_joueurs()) and emplacement in ('equipe', 'boite')
  );

-- ── 4 · l'adresse du joueur, et la liaison ─────────────────────────

--  CE QUE LE STAFF CERTIFIE. Il n'y a pas de preuve côté forum — le
--  champ de profil que le joueur pourrait déposer a été écarté le
--  3 novembre : « le joueur ne doit pas en avoir conscience ». C'est
--  donc Callista qui atteste, en validant, que ce personnage appartient
--  à cette adresse. C'est son rôle, puisque c'est elle qui valide.
alter table joueur add column if not exists courriel text;

comment on column joueur.courriel is
  'L''adresse que le staff certifie à la validation. C''est la seule '
  'chose qui autorise une liaison : le joueur ne prouve rien côté '
  'forum, il prouve qu''il relève cette boîte.';

create index if not exists joueur_courriel_idx on joueur (lower(courriel));

--  LA LIAISON, EN UN APPEL ET UNE SEULE FOIS.
--
--  `lie_le` est posé au premier passage et la fonction refuse ensuite :
--  « la personne ne doit le faire qu'une seule fois ». Rejouer n'est
--  pas une erreur de la joueuse — un lien cliqué deux fois, un
--  rafraîchissement — donc on ne lève pas, on rend ce qui est déjà vrai.
create or replace function lier_mon_personnage(p jsonb)
returns jsonb as $$
declare
  v_auth    uuid := auth_courant();
  v_courriel text := lower(trim(p->>'courriel'));
  v_lies    integer := 0;
begin
  if v_auth is null then
    raise exception 'PAS_DE_SESSION';
  end if;
  if v_courriel is null or v_courriel = '' then
    raise exception 'COURRIEL_MANQUANT';
  end if;

  --  TOUS LES PERSONNAGES DE CETTE ADRESSE, d'un coup. Une personne qui
  --  a trois personnages sous la même adresse ne doit pas cliquer trois
  --  fois.
  update joueur
     set auth_id = v_auth,
         lie_le  = coalesce(lie_le, now())
   where lower(courriel) = v_courriel
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
  'Attache tous les personnages portant cette adresse au compte connecté. '
  'Réservée à « authenticated » : sans session, il n''y a rien à lier. '
  'Rejouable sans dommage — elle rend ce qui est déjà vrai.';

-- ── 5 · le carnet, par la session ──────────────────────────────────

--  LA TROISIÈME PORTE, ET CELLE QUI PROUVE QUELQUE CHOSE. La page dit
--  quel personnage elle regarde — c'est le compte forum courant — et la
--  fonction vérifie qu'il est bien derrière la session. Un numéro
--  inventé ne rend rien.
create or replace function carnet_de_la_session(p jsonb)
returns jsonb as $$
  select carnet_interieur(j.id)
    from joueur j
   where j.forum_user_id = (p->>'forumUserId')::integer
     and j.id in (select mes_joueurs());
$$ language sql security definer set search_path = public, pg_temp;

revoke all on function carnet_de_la_session(jsonb) from public;
revoke all on function carnet_de_la_session(jsonb) from anon;
grant execute on function carnet_de_la_session(jsonb) to authenticated, service_role;

comment on function carnet_de_la_session(jsonb) is
  'Le carnet d''un de MES personnages, par son numéro de compte forum. '
  'Rend null si ce personnage n''est pas derrière la session courante : '
  'c''est ce qui la distingue de carnet_du_compte.';
