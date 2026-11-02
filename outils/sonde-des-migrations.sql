--  Où en est la base ? Elle ne modifie rien : elle lit le catalogue.
--  À coller dans l'éditeur SQL de Supabase, sans rien sélectionner.
select etape, repere,
       case when ok then '✓ appliquée' else '— ABSENTE' end as etat
from (
  select '0011 · la boutique' as etape, 'boutique_refuser' as repere,
         to_regprocedure('public.boutique_refuser(uuid,bigint,text,integer,text,text,jsonb)') is not null as ok, 11 as n
  union all select '0012 · le pokédex', 'pokedex_ranger',
         to_regprocedure('public.pokedex_ranger(jsonb)') is not null, 12
  union all select '0013/0016 · les fossiles', 'rendre_fossile',
         to_regprocedure('public.rendre_fossile(jsonb)') is not null, 13
  union all select '0014 · la vie de Rhode', 'journal_ecrire',
         to_regprocedure('public.journal_ecrire(jsonb)') is not null, 14
  union all select '0016 · les morceaux', 'sac_assembler_les_morceaux',
         to_regprocedure('public.sac_assembler_les_morceaux()') is not null, 16
  union all select '0017 · une analyse s''annonce', 'analyses_a_annoncer',
         to_regprocedure('public.analyses_a_annoncer(jsonb)') is not null, 17
  union all select '0018 · le palier', 'palier_pour',
         to_regprocedure('public.palier_pour(bigint)') is not null, 18
  union all select '0019 · la clé du carnet', 'carnet',
         to_regprocedure('public.carnet(jsonb)') is not null, 19
  union all select '0019 · la colonne cle_de_carnet', 'joueur.cle_de_carnet',
         exists (select 1 from information_schema.columns
                  where table_name='joueur' and column_name='cle_de_carnet'), 19
  union all select '0019 · la colonne boite_no', 'pokemon.boite_no',
         exists (select 1 from information_schema.columns
                  where table_name='pokemon' and column_name='boite_no'), 19
  union all select '0020 · la carte dresseur', 'carte_dresseur',
         to_regprocedure('public.carte_dresseur(jsonb)') is not null, 20
  union all select '0021 · la clé trouve pgcrypto', 'carnet_nouvelle_cle sait tirer',
         (select p.proconfig::text like '%extensions%' from pg_proc p
           join pg_namespace n on n.oid = p.pronamespace
          where n.nspname='public' and p.proname='carnet_nouvelle_cle'), 21
  union all select '0022 · les six natures', 'joueur_groupe_check',
         (select pg_get_constraintdef(oid) like '%hardi%' from pg_constraint
           where conname = 'joueur_groupe_check'), 22
  union all select '0023 · ouvrir en postant', 'carnet_reclamer',
         to_regprocedure('public.carnet_reclamer(jsonb)') is not null, 23
  union all select '0023 · la table des réclamations', 'carnet_reclamation',
         exists (select 1 from information_schema.tables
                  where table_name='carnet_reclamation'), 23
  union all select '0024 · un sujet par carte', 'cartes_a_publier',
         to_regprocedure('public.cartes_a_publier(jsonb)') is not null, 24
  union all select '0024 · la colonne carte_sujet_id', 'joueur.carte_sujet_id',
         exists (select 1 from information_schema.columns
                  where table_name='joueur' and column_name='carte_sujet_id'), 24
  union all select '0025 · la carte attend la validation', 'valider_le_personnage',
         to_regprocedure('public.valider_le_personnage(jsonb)') is not null, 25
) t order by n, repere;
