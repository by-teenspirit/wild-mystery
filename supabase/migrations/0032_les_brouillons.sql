-- ════════════════════════════════════════════════════════════════════
--  0032 · Les brouillons — et la première écriture du projet
--
--  Note de code `385:1005`, section LA TABLE :
--
--      « brouillons(joueur, sujet_id, corps, mots, modifie_le). Trois
--        lignes par joueur au maximum, supprimées après trente jours
--        sans modification. RLS : chacun ne voit que les siens, et
--        personne d'autre — pas même le staff. »
--
--  ── CE QUI CHANGE DE TOUT CE QUI PRÉCÈDE ────────────────────────────
--
--  Jusqu'ici le carnet ne faisait que LIRE, et toujours par une seule
--  fonction `security definer`. Ici le joueur écrit, depuis son
--  navigateur, avec son jeton. Donc ce n'est plus une fonction qui
--  décide ce qu'il peut toucher : c'est la RLS, directement sur la
--  table. C'est pour ça que cette table est la première des sept — les
--  trois onglets qui suivent héritent de la forme posée ici.
--
--  ── LES TROIS PLACES SONT UNE CONTRAINTE, PAS UNE VÉRIFICATION ──────
--
--  « Trois lignes par joueur au maximum. » On pourrait compter avant
--  d'insérer, dans un déclencheur ; deux onglets ouverts au même
--  instant passeraient tous les deux le comptage et on en aurait quatre.
--
--  Alors le brouillon porte sa PLACE — 1, 2 ou 3 — et `unique (joueur_id,
--  place)` fait le reste. PostgreSQL ne peut pas se tromper, il n'y a
--  pas de course à perdre, et l'interface a trois cases à dessiner
--  plutôt qu'une liste qui grandit. C'est la même forme que les six
--  places d'équipe de `pokemon`, qui tient depuis la `0001`.
--
--  ── « PAS MÊME LE STAFF », ET CE QUE ÇA VEUT DIRE EXACTEMENT ────────
--
--  Aucune politique, aucune fonction et aucune vue de ce dépôt ne rend
--  un brouillon à quelqu'un d'autre que son auteur. La relève ne lit
--  pas cette table ; les fonctions d'administration ne la citent pas.
--
--  CE QUE JE NE PEUX PAS PROMETTRE : la clé secrète de Supabase passe
--  outre la RLS, par construction. Qui la détient lit tout, cette table
--  comprise. La garantie porte donc sur le code, pas sur la base : rien
--  ici n'ouvre une porte, et c'est vérifié par la mesure
--  `supabase/tests/garanties.sql`. Le dire autrement serait mentir à
--  quelqu'un qui écrit un texte qu'il croit à lui seul.
--
--  ── TRENTE JOURS, COMPTÉS DEUX FOIS ─────────────────────────────────
--
--  La lecture les filtre, et la purge les enlève. Ce n'est pas une
--  redondance : si la purge n'a pas tourné depuis une semaine, un
--  brouillon de trente-deux jours ne doit pas réapparaître dans le
--  carnet comme s'il avait été gardé. La règle que le joueur voit est
--  celle de la lecture ; la purge ne fait que rendre la place.
-- ════════════════════════════════════════════════════════════════════

-- ── 1 · la table ───────────────────────────────────────────────────

create table if not exists brouillon (
  joueur_id  uuid     not null references joueur(id) on delete cascade,
  place      smallint not null check (place between 1 and 3),
  --  `sujet_id` NUL EST UN CAS NORMAL : un brouillon de nouveau sujet
  --  n'a pas encore de sujet où aller. Le titre ne sert qu'à celui-là.
  sujet_id   integer,
  titre      text     not null default '',
  corps      text     not null default '',
  --  LE COMPTE DE MOTS EST UNE ESTIMATION, et l'interface le dit. Il est
  --  rangé ici pour que la liste des trois places s'affiche sans
  --  recompter trois textes entiers à chaque ouverture du carnet.
  mots       integer  not null default 0 check (mots >= 0),
  modifie_le timestamptz not null default now(),
  cree_le    timestamptz not null default now(),
  primary key (joueur_id, place)
);

comment on table brouillon is
  'Les trois brouillons d''un personnage. Visibles de leur auteur et de '
  'personne d''autre (0032). Effacés après trente jours sans '
  'modification : la lecture les filtre, purger_les_brouillons() rend '
  'la place.';

comment on column brouillon.place is
  'La place, de 1 à 3. C''est la clé primaire avec joueur_id, donc la '
  'limite de trois est tenue par PostgreSQL et non par un comptage '
  'qu''un second onglet pourrait doubler.';

comment on column brouillon.mots is
  'Estimation, écrite par le navigateur. Ce n''est pas une donnée de '
  'jeu : l''expérience ne vient pas des mots depuis le 1er octobre.';

create index if not exists brouillon_modifie_le on brouillon (modifie_le);

-- ── 2 · trente jours, et la lecture qui les respecte ───────────────

create or replace function brouillon_encore_vivant(p_modifie_le timestamptz)
returns boolean as $$
  select p_modifie_le > now() - interval '30 days';
$$ language sql stable;

comment on function brouillon_encore_vivant(timestamptz) is
  'La règle des trente jours, écrite une seule fois : la politique de '
  'lecture et la purge l''appellent toutes les deux. Deux endroits qui '
  'calculent la même date sont deux endroits où elle peut diverger.';

-- ── 3 · la RLS ─────────────────────────────────────────────────────

alter table brouillon enable row level security;
alter table brouillon force row level security;

--  `force row level security` EST LÀ POUR UNE RAISON PRÉCISE : sans
--  elle, le propriétaire de la table — donc une fonction `security
--  definer` écrite plus tard par distraction — lirait tout sans
--  politique. Avec elle, même le propriétaire passe par les politiques.

drop policy if exists brouillon_lecture on brouillon;
create policy brouillon_lecture on brouillon
  for select to authenticated
  using (
    joueur_id in (select mes_joueurs())
    and brouillon_encore_vivant(modifie_le)
  );

drop policy if exists brouillon_ecriture on brouillon;
create policy brouillon_ecriture on brouillon
  for insert to authenticated
  with check (joueur_id in (select mes_joueurs()));

drop policy if exists brouillon_reecriture on brouillon;
create policy brouillon_reecriture on brouillon
  for update to authenticated
  using (joueur_id in (select mes_joueurs()))
  with check (joueur_id in (select mes_joueurs()));

drop policy if exists brouillon_effacement on brouillon;
create policy brouillon_effacement on brouillon
  for delete to authenticated
  using (joueur_id in (select mes_joueurs()));

--  AUCUNE POLITIQUE POUR `anon`, ET AUCUNE POUR LE STAFF. Un visiteur
--  non connecté ne voit rien ; un administrateur du forum n'est, pour
--  cette table, qu'un joueur comme un autre.

grant select, insert, update, delete on brouillon to authenticated;
revoke all on brouillon from anon;

-- ── 4 · la purge, qui rend la place ────────────────────────────────

create or replace function purger_les_brouillons()
returns integer as $$
declare
  v_enleves integer := 0;
begin
  delete from brouillon where not brouillon_encore_vivant(modifie_le);
  get diagnostics v_enleves = row_count;
  return v_enleves;
end $$ language plpgsql security definer set search_path = public, pg_temp;

comment on function purger_les_brouillons() is
  'Efface les brouillons de plus de trente jours et rend leur place. '
  'Appelée par la relève, en service_role. Rejouable sans dommage.';

revoke all on function purger_les_brouillons() from public;
revoke all on function purger_les_brouillons() from anon;
revoke all on function purger_les_brouillons() from authenticated;
grant execute on function purger_les_brouillons() to service_role;
