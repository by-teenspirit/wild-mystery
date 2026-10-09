-- ════════════════════════════════════════════════════════════════════
--  supabase/ou-en-est-la-base.sql
--
--  À coller dans l'éditeur SQL de Supabase quand on ne sait plus quelles
--  migrations sont appliquées. Il ne modifie RIEN : que des `select`.
--
--  ── POURQUOI CE FICHIER EXISTE ──────────────────────────────────────
--
--  Parce que la planche `50-le-reste-a-coder.md` a dit pendant trois
--  jours « appliquer 0014 » alors que `0014` était appliquée, et
--  « `fossile_espece` est vide » alors que le seed existait. Un document
--  qui décrit l'état d'une base se périme le jour où on touche la base.
--  **Celui-ci interroge la base elle-même.**
--
--  ── COMMENT IL S'Y PREND ────────────────────────────────────────────
--
--  Il n'existe pas de table « migrations appliquées » dans ce projet :
--  le DDL est collé à la main dans l'éditeur SQL, parce que Supabase est
--  injoignable depuis le shell. On ne peut donc pas lire un numéro —
--  **on cherche l'objet que chaque migration crée** :
--
--    · une table pour `0014` et `0016`, qui en créent une ;
--    · une colonne pour `0017`, qui en ajoute une ;
--    · une fonction pour `0012` ;
--    · pour `0013`, la SIGNATURE de `rendre_fossile` : `0002` la prenait
--      en `uuid`, `0013` l'a réécrite en `(p jsonb)`. La fonction existe
--      dans les deux cas, donc tester son nom ne dirait rien ;
--    · pour `0015`, un MOT dans le corps de `boutique_servir` :
--      `unique_violation`. Elle est redéfinie par `0014` ET par `0015`,
--      et seule celle de `0015` attrape cette exception.
--
--  Un test sur le seul nom aurait donc répondu « appliquée » pour deux
--  des six.
-- ════════════════════════════════════════════════════════════════════

select m.n as migration, m.quoi,
       case when m.present then '✓ appliquée' else '· À APPLIQUER' end as etat
  from (values
    ('0012', 'le pokédex dit la vérité',
     exists (select 1 from pg_proc where proname = 'pokedex_date_du_registre')),
    ('0013', 'un refus de fossile se souvient',
     exists (select 1 from pg_proc p join pg_type t on t.oid = p.proargtypes[0]
              where p.proname = 'rendre_fossile' and t.typname = 'jsonb')),
    ('0014', 'la vie de Rhode',
     exists (select 1 from pg_class where relname = 'journal' and relkind = 'r')),
    ('0015', 'deux appels ne lèvent plus',
     exists (select 1 from pg_proc where proname = 'boutique_servir'
              and prosrc like '%unique_violation%')),
    ('0016', 'les fossiles et leurs morceaux',
     exists (select 1 from pg_class where relname = 'fossile_morceau' and relkind = 'r')),
    ('0017', 'une analyse s''annonce',
     exists (select 1 from pg_attribute a join pg_class c on c.oid = a.attrelid
              where c.relname = 'analyse_fossile' and a.attname = 'verdict'))
  ) as m(n, quoi, present)

union all

--  ── LES SEEDS ─────────────────────────────────────────────────────
--  `espece` est la plus importante des trois, et de loin : `pokemon`,
--  `pokedex` et `fossile_espece` ont toutes une clé étrangère vers
--  elle. Tant qu'elle est vide, une capture ne peut pas s'écrire — donc
--  AUCUNE clôture ne peut aboutir.
select 'seed', 'especes.sql — ' || (select count(*)::text from espece) || ' espèce(s)',
       case when (select count(*) from espece) > 700 then '✓ appliqué' else '· À APPLIQUER' end
union all
select 'seed',
       'objets.sql — ' ||
       (select count(*)::text from objet where id between 990000 and 990999) || ' articles',
       case when (select count(*) from objet where id between 990000 and 990999) = 34
            then '✓ appliqué' else '· À APPLIQUER' end
union all
select 'seed',
       'fossiles.sql — ' ||
       (select count(*)::text from objet where id between 991000 and 991999) || ' objets',
       case when (select count(*) from objet where id between 991000 and 991999) = 22
            then '✓ appliqué' else '· À APPLIQUER' end

order by 1, 2;
