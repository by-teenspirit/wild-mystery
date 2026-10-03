-- ═══════════════════════════════════════════════════════════════════════
--  0007_rls_sans_recursion.sql
--
--  LE DÉFAUT, trouvé le 2 octobre 2026 en écrivant les premiers tests de
--  RLS. Il était fatal et parfaitement invisible.
--
--    select count(*) from joueur;
--    ERROR:  stack depth limit exceeded
--
--  POURQUOI. La politique de lecture de `joueur` est
--  `using (id = joueur_courant())`, et `joueur_courant()` est une
--  fonction SQL ordinaire qui fait `select j.id from joueur j where …`.
--  Pour décider si une ligne de `joueur` est visible, PostgreSQL évalue
--  la politique, donc appelle `joueur_courant()`, qui lit `joueur`, donc
--  évalue la politique, qui appelle `joueur_courant()`… jusqu'à épuiser
--  la pile.
--
--  POURQUOI PERSONNE NE L'AVAIT VU. **Un superutilisateur contourne
--  toujours la RLS.** Les tests pgTAP tournent en `postgres`, la relève
--  passe par la clé de service, et toutes les fonctions de versement sont
--  `security definer`. Aucun chemin emprunté jusqu'ici ne faisait
--  appliquer une seule politique. Le premier à l'aurait découvert aurait
--  été un joueur, en ouvrant son carnet.
--
--  LA CORRECTION. `joueur_courant()` devient `security definer` : sa
--  lecture de `joueur` se fait avec les droits du propriétaire de la
--  fonction, donc sans politique, donc sans récursion. C'est le remède
--  habituel, et il est sans danger ici parce que la fonction **ne rend
--  qu'un identifiant déduit du jeton de l'appelant** : elle ne divulgue
--  rien que l'appelant ne sache déjà sur lui-même.
--
--  `search_path` est épinglé, comme pour toute fonction `security
--  definer` : sans ça, un appelant qui place un schéma devant `public`
--  peut faire exécuter sa propre table `joueur` avec les droits du
--  propriétaire.
-- ═══════════════════════════════════════════════════════════════════════

create or replace function joueur_courant() returns uuid as $$
  select j.id from joueur j where j.auth_id = auth_courant()
$$ language sql stable security definer set search_path = public, pg_temp;

comment on function joueur_courant() is
  'Le joueur derrière le jeton courant, ou NULL. SECURITY DEFINER à dessein : '
  'la politique de lecture de « joueur » appelle cette fonction, qui lit '
  '« joueur » — sans cela, la politique récurse jusqu''à épuiser la pile. '
  'Voir 0007_rls_sans_recursion.sql.';

--  `auth_courant()` ne lit aucune table : elle ne récurse pas, et elle
--  n'a donc aucune raison de devenir « security definer ». On la laisse
--  en invoker, parce qu'un privilège qu'on ne donne pas est un privilège
--  qu'on n'a pas à surveiller.
