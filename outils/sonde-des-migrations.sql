select etape, repere,
       case when ok then '✓ appliquée' else '— absente' end as etat
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
  union all select '0019 · la colonne boite_no', 'pokemon.boite_no',
         exists (select 1 from information_schema.columns
                  where table_name='pokemon' and column_name='boite_no'), 19
  union all select '0019 · la colonne cle_de_carnet', 'joueur.cle_de_carnet',
         exists (select 1 from information_schema.columns
                  where table_name='joueur' and column_name='cle_de_carnet'), 19
  union all select '0020 · la carte dresseur', 'carte_dresseur',
         to_regprocedure('public.carte_dresseur(jsonb)') is not null, 20
) t order by n, repere;
