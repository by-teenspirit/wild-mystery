-- ═══════════════════════════════════════════════════════════════════════
--  supabase/registre.sql
--
--  Les quatre opérations du port `Registre`, en fonctions nommées.
--
--  POURQUOI UN SEUL ARGUMENT jsonb PAR FONCTION
--
--  L'adaptateur TypeScript doit pouvoir appeler ces fonctions par deux
--  chemins différents :
--    · en production, par PostgREST — POST /rest/v1/rpc/<nom> avec un
--      corps JSON ;
--    · dans le CI, par psql sur un PostgreSQL de service, parce qu'on ne
--      fait pas tourner une pile Supabase complète pour une suite de
--      tests, et parce qu'aucune dépendance n'entre dans ce dépôt.
--
--  Avec des arguments scalaires, chaque chemin devrait connaître la
--  signature et les types de chaque fonction — donc recopier les
--  signatures, donc les laisser dériver. Avec un seul `jsonb`, les deux
--  chemins passent la charge sans la comprendre, et **le seul endroit du
--  projet qui connaisse les types est ce fichier.** Les transtypages sont
--  tous ici, visibles, au lieu d'être éparpillés dans deux harnais.
--
--  Les clés sont celles du domaine, en camelCase : sujetId, joueurId,
--  messageId, type, charge, code. Pas de traduction de nommage en route :
--  une clé mal orthographiée doit casser, pas se taire.
-- ═══════════════════════════════════════════════════════════════════════

-- ── écrire une ligne ──────────────────────────────────────────────────
--  Idempotent par (message_id, type) : réinscrire le même événement du
--  même message n'a aucun effet et ne lève pas. C'est ce que le port
--  promet, et c'est l'index unique `registre_une_fois` qui le tient.
--
--  Rend 1 si la ligne est entrée, 0 si elle existait déjà. Le port ignore
--  cette valeur ; elle est là pour que toute fonction de ce fichier ait
--  quelque chose à rendre, et que le harnais de test n'ait pas de cas
--  particulier pour `void`.
create or replace function registre_inscrire(p jsonb) returns integer as $$
declare n integer;
begin
  insert into registre (sujet_id, joueur_id, message_id, type, charge, code)
  values (
    (p->>'sujetId')::bigint,
    (p->>'joueurId')::uuid,
    (p->>'messageId')::bigint,
    (p->>'type')::evenement,
    p->'charge',
    p->>'code'
  )
  on conflict (message_id, type) do nothing;
  get diagnostics n = row_count;
  return n;
end $$ language plpgsql security definer;

-- ── relire les lignes d'un joueur dans un sujet ───────────────────────
--  Aucun ordre promis : c'est le domaine qui trie, et le contrat le dit.
--  On rend quand même par message_id croissant, parce qu'un journal
--  lisible vaut mieux qu'un journal mélangé.
create or replace function registre_lignes(p jsonb) returns jsonb as $$
  select coalesce(
    jsonb_agg(
      jsonb_build_object('messageId', r.message_id, 'type', r.type, 'charge', r.charge)
      order by r.message_id, r.id
    ),
    '[]'::jsonb
  )
  from registre r
  where r.sujet_id = (p->>'sujetId')::bigint
    and r.joueur_id = (p->>'joueurId')::uuid;
$$ language sql stable security definer;

-- ── qui a joué dans ce sujet ──────────────────────────────────────────
create or replace function registre_joueurs(p jsonb) returns jsonb as $$
  select coalesce(jsonb_agg(distinct r.joueur_id::text), '[]'::jsonb)
  from registre r
  where r.sujet_id = (p->>'sujetId')::bigint;
$$ language sql stable security definer;

-- ── le ménage d'un sujet abandonné ────────────────────────────────────
--  Rend le nombre de lignes effacées. Un sujet déjà clos ne s'oublie pas :
--  son registre est l'archive de ce qui a été versé.
create or replace function registre_oublier(p jsonb) returns integer as $$
declare n integer;
begin
  delete from registre
   where sujet_id = (p->>'sujetId')::bigint
     and not exists (select 1 from cloture c where c.sujet_id = (p->>'sujetId')::bigint);
  get diagnostics n = row_count;
  return n;
end $$ language plpgsql security definer;
