-- ════════════════════════════════════════════════════════════════════
--  0018 · le palier se recalcule, et le registre se nettoie
--
--  Les deux dernières tâches de la relève qui n'attendaient aucune
--  décision : le palier (tâche 6) et le ménage (tâche 8). Leurs
--  fonctions d'origine existent depuis `0002` et ont été passées au banc
--  le 6 octobre — les deux sont JUSTES. Elles ne manquaient que de deux
--  choses : la convention d'appel, et de quoi journaliser.
--
--  ── POURQUOI ON NE LES APPELLE PAS TELLES QUELLES ───────────────────
--
--  `paliers_a_revoir()` rend une TABLE, `oublier_les_abandons(integer)`
--  prend un argument nommé. Les deux sont antérieures à la convention de
--  `0003` — `(p jsonb) returns jsonb` —, et `src/adaptateurs/supabase/
--  appel.ts` ne sait passer qu'un seul argument JSON. Ce n'est pas un
--  caprice de forme : c'est ce qui permet au MÊME adaptateur de tourner
--  contre PostgREST en production et contre `psql` dans le CI.
--
--  Les anciennes RESTENT. `paliers_a_revoir` est une lecture utile depuis
--  l'éditeur SQL — « qui devrait changer de palier ? » — et la nouvelle
--  s'en sert. Rien n'est réécrit en double : c'est la leçon du 6 octobre,
--  « une fonction réécrite perd des choses ».
--
--  ── LE PALIER : UN SEUL ORDRE, PAS UNE LECTURE PUIS UNE ÉCRITURE ────
--
--  La tentation était de lister avec `paliers_a_revoir()`, puis de
--  mettre à jour ligne par ligne. Deux passages de la relève qui se
--  croisent écriraient alors deux fois — et si un badge tombe entre la
--  lecture et l'écriture, on écrit un palier déjà périmé.
--
--  C'est le même raisonnement qu'au verrou de `0005` : « prendre le
--  verrou est UN SEUL ordre SQL ». Ici l'`update` calcule et écrit dans
--  le même ordre, et son `returning` dit ce qui a bougé.
--
--  ── ET LE RANG FORUMACTIF ? IL N'EST PAS ICI, ET C'EST ASSUMÉ ───────
--
--  La planche 50 appelle la tâche 6 « le rang Forumactif suit le
--  palier ». Changer un rang se fait dans le panneau d'administration,
--  dont les adresses portent un jeton de session : la relève n'y a pas
--  accès, et personne ne lui donnera le mot de passe d'un administrateur.
--
--  Ce qui compte, en revanche, est ICI : **le palier de la base est ce
--  qui ouvre les zones**. `data/zones.json` donne un palier minimum par
--  zone, et c'est `joueur.palier` qui est comparé. Un joueur qui gagne
--  son troisième badge sans que le palier soit recalculé reste enfermé
--  hors des zones de palier 2 — et rien, nulle part, ne le dirait.
--
--  Le rang affiché sur le forum est de l'affichage. Le palier de la base
--  est la règle. Cette migration tient la règle ; l'affichage reste une
--  action de staff, et la tâche rend la liste pour qu'elle soit faisable
--  sans chercher qui a changé.
-- ════════════════════════════════════════════════════════════════════

-- ═══ 1 · le palier ═══════════════════════════════════════════════════

--  LE BARÈME EST ÉCRIT UNE FOIS, DANS UNE FONCTION.
--
--  Il l'était trois fois dans `paliers_a_revoir` — au `select`, au
--  `having`, et c'est la même expression recopiée. Trois copies d'un
--  seuil, c'est trois endroits à changer le jour où « sept badges »
--  devient « huit ». La planche 39 donne les deux seuils : palier 2 à
--  trois badges, palier 3 à sept.
create or replace function palier_pour(p_badges bigint) returns smallint as $$
  select case
    when p_badges >= 7 then 3
    when p_badges >= 3 then 2
    else 1
  end::smallint
$$ language sql immutable;

comment on function palier_pour(bigint) is
  'Le barème des paliers, planche 39 : 3 badges pour le palier 2, 7 pour le 3.';

--  ── CE QUE LA FONCTION REND, ET POURQUOI ELLE REND LE PSEUDO ────────
--
--  `{ nombre, changements: [{ joueurId, pseudo, avant, apres }] }`.
--
--  Le pseudo est dans le `returning` parce que c'est le seul moment où
--  on l'a sous la main sans une seconde requête — et parce que la ligne
--  de journal « palier : 2 » ne sert à personne, alors que « Dresseuse
--  passe au palier 2 » se lit. La table `joueur` n'est lisible que par
--  son propriétaire (politique de `0008`) : la relève, qui tourne avec
--  la clé de service, est le seul endroit d'où ce rapprochement est
--  possible.
--
--  `security definer` comme ses voisines : la fonction écrit dans
--  `joueur`, que personne d'autre que son propriétaire ne peut toucher.
create or replace function paliers_appliquer(p jsonb default '{}'::jsonb)
returns jsonb as $$
declare changements jsonb;
begin
  with compte as (
    select j.id, j.pseudo, j.palier as avant,
           palier_pour(count(b.arene)) as apres
      from joueur j
      left join badge b on b.joueur_id = j.id
     group by j.id, j.pseudo, j.palier
  ),
  --  UN SEUL ORDRE : il calcule, il filtre, il écrit, il rend.
  ecrit as (
    update joueur j
       set palier = c.apres
      from compte c
     where c.id = j.id
       and c.avant <> c.apres
    returning j.id, c.pseudo, c.avant, c.apres
  )
  select coalesce(
    jsonb_agg(jsonb_build_object(
      'joueurId', id, 'pseudo', pseudo, 'avant', avant, 'apres', apres
    ) order by pseudo),
    '[]'::jsonb
  ) into changements from ecrit;

  return jsonb_build_object(
    'nombre', jsonb_array_length(changements),
    'changements', changements
  );
end $$ language plpgsql security definer;

comment on function paliers_appliquer(jsonb) is
  'Tâche 6 : recalcule joueur.palier depuis les badges et rend ce qui a changé. '
  'Le rang affiché sur Forumactif n''est PAS touché — il se change dans le panneau '
  'd''administration, où la relève ne va pas. Le palier de la base est ce qui ouvre '
  'les zones ; le rang est de l''affichage.';

-- ═══ 2 · le ménage ═══════════════════════════════════════════════════

--  ── POURQUOI COMPTER LES SUJETS ET PAS SEULEMENT LES LIGNES ─────────
--
--  `oublier_les_abandons` rend le nombre de LIGNES effacées. « 47 » ne
--  dit rien : c'est peut-être un sujet bavard ou quinze sujets morts.
--  Le chiffre qui se lit dans un journal est le nombre de SUJETS
--  oubliés, et celui-là demande de les compter avant de les effacer.
--
--  ── CE QUE CETTE FONCTION EFFACE, ET CE QU'ELLE NE PEUT PLUS CASSER ─
--
--  Elle efface le registre des sujets jamais clôturés dont la dernière
--  ligne a plus de `jours` jours. Un sujet clôturé n'est JAMAIS touché :
--  son registre est la pièce justificative de ce qui a été versé.
--
--  Il y avait là un piège, et il est refermé depuis `0012`. Avant elle,
--  `ranger_pokedex` créditait les rencontres des sujets OUVERTS : le
--  ménage effaçait ensuite le registre, et il restait au pokédex une
--  espèce dont plus rien ne disait d'où elle venait — impossible à
--  auditer, et un objectif de complétion offert. `0012` ne range que les
--  sujets clôturés, donc ce que cette fonction efface n'a jamais été
--  crédité nulle part. **Ce n'est pas une précaution de cette migration,
--  c'est une condition pour qu'elle soit sûre.**
--
--  ── 60 JOURS, ET POURQUOI C'EST UN ARGUMENT ─────────────────────────
--
--  La valeur de `0002`. Elle n'a jamais été discutée, donc elle est un
--  défaut et pas une règle : elle reste dans la charge pour qu'un
--  changement d'avis ne demande pas une migration.
create or replace function menage_oublier_les_abandons(p jsonb default '{}'::jsonb)
returns jsonb as $$
declare
  jours integer := coalesce((p->>'jours')::integer, 60);
  sujets bigint;
  lignes bigint;
begin
  if jours < 1 then
    raise exception 'JOURS_INVALIDE' using detail = 'jours doit valoir au moins 1';
  end if;

  --  ── UN SEUL ORDRE, ET PAS DE TABLE TEMPORAIRE ─────────────────────
  --
  --  Première version : une table temporaire pour retenir les sujets
  --  AVANT de les effacer — après, il n'y a plus rien à compter. Elle
  --  marchait, et elle était de l'ÉTAT DE SESSION dans une fonction.
  --  Deux appels dans la même transaction se seraient partagé la table,
  --  d'où un `delete from` au début pour la vider : une précaution qui
  --  signale qu'on s'est mis dans une situation à précautions.
  --
  --  Le `returning` d'un `delete` rend les lignes effacées. On compte
  --  donc dedans — `count(*)` pour les lignes, `count(distinct …)` pour
  --  les sujets —, dans le même ordre et le même instantané. Rien à
  --  vider, rien à partager, rien à nettoyer.
  with morts as (
    select r.sujet_id
      from registre r
     group by r.sujet_id
    having max(r.cree_le) < now() - make_interval(days => jours)
       and not exists (select 1 from cloture c where c.sujet_id = r.sujet_id)
  ),
  efface as (
    delete from registre
     where sujet_id in (select sujet_id from morts)
    returning sujet_id
  )
  select count(distinct sujet_id), count(*) into sujets, lignes from efface;

  return jsonb_build_object('sujets', sujets, 'lignes', lignes, 'jours', jours);
end $$ language plpgsql security definer;

comment on function menage_oublier_les_abandons(jsonb) is
  'Tâche 8 : efface le registre des sujets jamais clôturés et sans activité depuis '
  'N jours (60 par défaut). Sûre seulement parce que 0012 ne range au pokédex que '
  'les sujets clôturés : ce qui est effacé ici n''a jamais été crédité.';

-- ═══ 3 · la surface ══════════════════════════════════════════════════

--  Les trois sont des fonctions de relève. `palier_pour` est un barème
--  pur et pourrait être ouverte, mais rien ne la lit côté navigateur :
--  on n'ouvre pas une porte dont personne n'a besoin (`56-…`).
revoke all on function palier_pour(bigint)                   from public, anon, authenticated;
revoke all on function paliers_appliquer(jsonb)              from public, anon, authenticated;
revoke all on function menage_oublier_les_abandons(jsonb)    from public, anon, authenticated;
grant execute on function palier_pour(bigint)                to service_role;
grant execute on function paliers_appliquer(jsonb)           to service_role;
grant execute on function menage_oublier_les_abandons(jsonb) to service_role;
