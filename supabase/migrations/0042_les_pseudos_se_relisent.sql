-- ════════════════════════════════════════════════════════════════════
--  0042 · Les pseudos se relisent
--
--  ── LE CARNET DISAIT VRAI SUR UNE DONNÉE FAUSSE ────────────────────
--
--  « J'ai découvert "personne n'a écrit" alors qu'Arceus a posté après
--  moi », 13 novembre. Le défaut n'était pas dans le carnet :
--  `joueur.pseudo` est écrit UNE SEULE FOIS, à la liaison, et plus
--  jamais relu. La relève cherche les RP par
--  `/search?search_author=<pseudo>` ; après un changement de nom sur le
--  forum, cette recherche ne trouve plus personne, `dernier_auteur`
--  reste vide, et le tableau annonce que le sujet n'a pas bougé.
--
--  Le correctif du carnet (`avecLePseudoDuForum`) répare les écrans, et
--  il ne pouvait pas réparer celui-ci : la relève tourne côté serveur,
--  sans navigateur et sans session. Elle lit maintenant `/memberlist` à
--  chaque passage des RP, et c'est cette fonction qui range le résultat.
--
--  ── POURQUOI UN SEUL APPEL, ET PAS UN PAR MEMBRE ───────────────────
--
--  Un appel par renommage, c'est autant d'allers-retours que de membres
--  renommés — et une panne de réseau au milieu laisse la moitié des
--  noms d'hier et la moitié de ceux d'aujourd'hui, sans que personne ne
--  sache laquelle. Ici tout passe dans une seule instruction : elle
--  aboutit ou elle ne change rien.
--
--  ── CE QU'ELLE REFUSE DE FAIRE ─────────────────────────────────────
--
--  ELLE NE CRÉE PERSONNE. `update … where forum_user_id = …` et rien
--  d'autre : un numéro inconnu ne donne pas une ligne de plus. Créer un
--  joueur ici reviendrait à inscrire sur le jeu tous les membres du
--  forum au premier passage, et `valider_le_personnage` est le seul
--  endroit d'où un personnage sort.
--
--  ELLE N'ÉCRIT PAS UN NOM VIDE. Un `<a>` sans texte arrive quand le
--  gabarit pose une image à la place du nom ; le lecteur l'écarte déjà,
--  et la base le refuse aussi — une garde en double sur une donnée qui
--  vient d'une page qu'on ne contrôle pas, c'est une garde bien placée.
--
--  ELLE NE COMPTE QUE CE QU'ELLE A CHANGÉ. `and pseudo is distinct from`
--  : sans cette clause, un passage où rien ne bouge annoncerait trente
--  renommages par heure, et un journal qui crie tout le temps ne dit
--  plus rien.
-- ════════════════════════════════════════════════════════════════════

create or replace function renommer_les_joueurs(p jsonb)
returns integer as $$
declare
  v_faits integer;
begin
  --  UNE LISTE ABSENTE N'EST PAS UNE ERREUR : la relève peut passer
  --  sans aucun renommage, et c'est même le cas normal.
  if p is null or p->'changements' is null
     or jsonb_typeof(p->'changements') <> 'array' then
    return 0;
  end if;

  --  `with ordinality` DONNE LE RANG, et il sert deux lignes plus bas.
  with demande as (
    select (c->>'forumUserId')::integer as forum_user_id,
           btrim(c->>'pseudo')          as pseudo,
           rang
      from jsonb_array_elements(p->'changements')
           with ordinality as t(c, rang)
  ),
  --  LE DERNIER NOMMÉ GAGNE, comme dans le lecteur : « la même page
  --  peut nommer un membre deux fois — le dernier vu gagne ».
  --
  --  LE RANG EST NÉCESSAIRE, et mon premier jet s'en passait. Un
  --  `distinct on (forum_user_id)` sans rien dans le `order by` que la
  --  colonne elle-même choisit une ligne ARBITRAIRE parmi les
  --  doublons — et `update … from` avec deux lignes correspondantes ne
  --  lève pas d'erreur, il en applique une au hasard. Les deux
  --  écritures passent les tests une fois sur deux, et le commentaire
  --  d'à côté annonçait fièrement « le dernier gagne » sans que rien
  --  ne le garantisse. Un contrôle l'a montré : retirer le `distinct
  --  on` ne faisait rien échouer.
  propre as (
    select distinct on (forum_user_id) forum_user_id, pseudo
      from demande
     where forum_user_id is not null
       and pseudo is not null
       and pseudo <> ''
     order by forum_user_id, rang desc
  ),
  fait as (
    update joueur j
       set pseudo = d.pseudo
      from propre d
     where j.forum_user_id = d.forum_user_id
       --  CE QUI N'A PAS CHANGÉ N'EST PAS COMPTÉ.
       and j.pseudo is distinct from d.pseudo
    returning j.id
  )
  select count(*) into v_faits from fait;

  return v_faits;
end $$ language plpgsql security definer set search_path = public, pg_temp;

revoke all on function renommer_les_joueurs(jsonb) from public;
revoke all on function renommer_les_joueurs(jsonb) from anon, authenticated;
grant execute on function renommer_les_joueurs(jsonb) to service_role;

comment on function renommer_les_joueurs(jsonb) is
  'Met à jour les pseudos des personnages d''après l''annuaire du forum, '
  'en une seule instruction. Ne crée personne, n''écrit jamais un nom '
  'vide, et ne compte que les noms réellement changés. Réservée à la '
  'relève (service_role).';
