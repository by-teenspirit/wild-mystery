-- ═══════════════════════════════════════════════════════════════════════
--  0008_fermer_la_surface.sql
--
--  TROIS TROUS, trouvés le 2 octobre 2026 en remontant le fil de la
--  récursion RLS de `0007`. Aucun n'était visible depuis les tests, pour
--  la même raison que l'autre : tout tournait en superutilisateur.
--
--  ─ 1 · VINGT-NEUF FONCTIONS `security definer` EXÉCUTABLES PAR PUBLIC
--
--  C'est le plus grave. PostgreSQL accorde `EXECUTE` à PUBLIC sur toute
--  fonction par défaut, et PostgREST expose les fonctions de `public` en
--  RPC. **La clé publiable est dans le code source de la page du forum,
--  par construction.** N'importe qui pouvait donc, depuis une console de
--  navigateur, appeler :
--
--    appliquer_cloture      se verser ce qu'il veut : objets, Pokémon, argent
--    servir_commande        la boutique gratuite
--    registre_inscrire      écrire de faux événements dans le sujet d'autrui
--    lier_compte            rattacher son compte au personnage d'un autre
--    releve_avancer         faire reculer la relève, ou la faire tout relire
--    releve_prendre_le_verrou   arrêter la relève pour de bon
--    registre_oublier       effacer le registre d'un sujet
--
--  Ces fonctions sont `security definer` : elles s'exécutent avec les
--  droits du propriétaire. Les exposer, c'est donner ces droits à tout le
--  monde. **Elles n'appartiennent qu'à la relève**, qui parle avec la clé
--  de service.
--
--  ─ 2 · DIX TABLES SANS AUCUNE RLS
--
--  `badge`, `cloture`, `espece`, `fossile_espece`, `objet`, `releve`,
--  `releve_journal`, `verrou`, `zone`, `zone_espece`. Supabase accorde par
--  défaut tous les droits sur les tables de `public` aux rôles `anon` et
--  `authenticated` : sans RLS, un joueur connecté pouvait réécrire le prix
--  d'un objet, vider une table de rencontres, ou prendre le verrou de la
--  relève.
--
--  ─ 3 · AUCUN GRANT EXPLICITE
--
--  Aucune migration ne disait ce qu'un joueur a le droit d'atteindre. On
--  héritait donc des droits par défaut, qui sont larges. **Les politiques
--  décident quelles LIGNES ; les grants décident si la table est
--  atteignable du tout.** Il fallait les deux.
--
--  ─ LA PRÉCAUTION QUI A FAILLI MANQUER
--
--  Une politique RLS exige que **l'appelant** détienne `EXECUTE` sur les
--  fonctions qu'elle appelle. Révoquer `joueur_courant()` à PUBLIC sans la
--  réaccorder donne « permission denied for function joueur_courant » à
--  chaque joueur, sur chaque lecture — vérifié avant d'écrire ce fichier.
--  D'où le réaccord explicite, plus bas, et l'assertion pgTAP qui le tient.
-- ═══════════════════════════════════════════════════════════════════════

-- ── les rôles de Supabase, pour que ce fichier monte aussi ailleurs ──
--  Ils existent sur Supabase ; en CI et en local, on les crée pour que la
--  migration soit la même partout. Une migration qui ne s'applique que
--  sur la production n'est pas testable.
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin noinherit bypassrls;
  end if;
end $$;

-- ═══ 1 · les fonctions ═══════════════════════════════════════════════
--  On ferme tout, puis on rouvre le strict nécessaire. L'ordre compte :
--  révoquer à PUBLIC et s'arrêter là couperait aussi la relève.
revoke execute on all functions in schema public from public;
revoke execute on all functions in schema public from anon, authenticated;

--  La relève parle avec la clé de service. C'est elle, et elle seule, qui
--  a le droit d'appeler ce qui verse.
grant execute on all functions in schema public to service_role;
alter default privileges in schema public grant execute on functions to service_role;

--  Les deux seules fonctions qu'un joueur doit pouvoir exécuter, et il ne
--  les appelle même pas lui-même : ce sont les POLITIQUES qui les
--  appellent, à chaque lecture.
grant execute on function joueur_courant() to anon, authenticated;
grant execute on function auth_courant() to anon, authenticated;

--  Et pour les fonctions à venir : fermées d'avance, plutôt qu'ouvertes
--  jusqu'à ce que quelqu'un y pense.
alter default privileges in schema public revoke execute on functions from public;

-- ═══ 2 · la RLS partout ══════════════════════════════════════════════
--  Y compris sur les tables de référence. Une table sans RLS est
--  entièrement exposée dès qu'un grant lui parvient — et un grant finit
--  toujours par arriver. Avec la RLS et une politique de LECTURE seule,
--  l'écriture reste refusée même si quelqu'un accorde `update` par erreur.
alter table badge          enable row level security;
alter table cloture        enable row level security;
alter table espece         enable row level security;
alter table fossile_espece enable row level security;
alter table objet          enable row level security;
alter table zone           enable row level security;
alter table zone_espece    enable row level security;

--  Le catalogue se lit par tout le monde, visiteurs compris : c'est ce
--  qui permet d'afficher un Pokédex, une boutique et une carte sans être
--  connecté. Il ne s'écrit que par la relève et par le staff.
create policy "le catalogue est public" on espece         for select using (true);
create policy "le catalogue est public" on objet          for select using (true);
create policy "le catalogue est public" on zone           for select using (true);
create policy "le catalogue est public" on zone_espece    for select using (true);
create policy "le catalogue est public" on badge          for select using (true);
create policy "le catalogue est public" on fossile_espece for select using (true);

--  Les clôtures sont publiques à dessein : c'est ce qui permet à
--  n'importe qui de reprendre un code de vérification et de refaire le
--  calcul. Un arbitrage qu'on ne peut pas refaire n'est pas un arbitrage.
create policy "les clôtures sont publiques" on cloture for select using (true);

--  La plomberie de la relève : RLS activée, AUCUNE politique. Personne ne
--  la voit, personne ne l'écrit, pas même en lecture. La relève passe par
--  la clé de service, qui contourne la RLS.
alter table releve         enable row level security;
alter table releve_journal enable row level security;
alter table verrou         enable row level security;

-- ═══ 3 · les grants, dits une bonne fois ═════════════════════════════
revoke all on all tables in schema public from anon, authenticated;
grant usage on schema public to anon, authenticated;

--  Lecture publique : le catalogue, et ce qui sert à vérifier.
grant select on espece, objet, zone, zone_espece, badge, fossile_espece,
                registre, cloture
   to anon, authenticated;

--  Lecture d'un joueur sur ses propres données. Les politiques de `0001`
--  décident lesquelles ; ce grant dit seulement que la table est
--  atteignable.
grant select on joueur, pokemon, sac, pokedex, pension, commande, analyse_fossile
   to authenticated;

--  LE SEUL GESTE D'ÉCRITURE OUVERT AU NAVIGATEUR : ranger ses Pokémon.
--  Et seulement cette colonne — pas le niveau, pas l'XP, pas l'espèce.
grant update (emplacement) on pokemon to authenticated;

--  `releve`, `releve_journal` et `verrou` ne sont dans aucun grant : elles
--  n'ont rien à faire dans un navigateur, et la RLS sans politique en est
--  la seconde serrure.

--  Les tables à venir : fermées d'avance.
alter default privileges in schema public revoke all on tables from anon, authenticated;

-- ── la relève, elle, a tout ──────────────────────────────────────────
--  Supabase accorde ces droits au rôle de service par défaut. On les
--  écrit quand même : une migration qui ne s'applique correctement que
--  sur la production n'est pas testable, et c'est précisément en ne
--  testant pas qu'on a laissé passer les trois trous ci-dessus.
grant usage on schema public to service_role;
grant all on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to service_role;
alter default privileges in schema public grant all on tables to service_role;
alter default privileges in schema public grant usage, select on sequences to service_role;
