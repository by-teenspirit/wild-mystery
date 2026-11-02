-- ════════════════════════════════════════════════════════════════════
--  0025 · La carte attend la validation
--
--  « Il faut que ça se mette en place seulement quand une personne est
--  validée », 2 novembre.
--
--  ── CE QUI MARQUE UNE VALIDATION ────────────────────────────────────
--
--  **La maison.** `joueur.groupe` passe de `null` à l'une des six
--  natures, et c'est déjà un geste de la validation : « une action,
--  trois choses réglées : le groupe, le personnage, le compte de jeu »
--  (planche 33 § 2). Pas de second tampon à poser, pas de colonne de
--  plus : ce qui existe suffit, à condition d'être écrit quelque part.
--
--  Jusqu'ici, personne n'écrivait ce champ. `carnet_reclamer()` crée
--  la ligne dès qu'une personne ouvre son carnet — donc avant toute
--  validation — et la tâche des cartes aurait publié un sujet pour
--  n'importe qui ayant cliqué.
--
--  ── LA VALIDATION CRÉE LA LIGNE SI ELLE N'EXISTE PAS ────────────────
--
--  Et c'est important : sans ça, la carte d'un joueur validé
--  n'apparaîtrait qu'une fois qu'il aurait ouvert son carnet lui-même.
--  Or l'ordre normal est l'inverse — on valide, puis la personne
--  découvre son carnet. `valider_le_personnage()` crée donc la ligne
--  au besoin, et `carnet_reclamer()` la retrouvera telle quelle quand
--  la personne viendra.
--
--  ── L'EXISTANT ──────────────────────────────────────────────────────
--
--  « Considère seulement le compte de test, pas Arceus et le Maître du
--  Jeu. » Les joueurs déjà en base n'ont pas de maison, donc aucun ne
--  publie — sauf le compte de test, à qui on en pose une ici pour que
--  la chaîne soit visible dès le premier passage. Les comptes du staff
--  n'en reçoivent pas : ils n'ont pas de carte à montrer.
-- ════════════════════════════════════════════════════════════════════

-- ── 1 · la file n'appelle que les validés ──────────────────────────

create or replace function cartes_a_publier(p jsonb default '{}'::jsonb)
returns jsonb as $$
  select coalesce(jsonb_agg(j order by j->>'creeLe'), '[]'::jsonb)
    from (
      select jsonb_build_object(
               'joueurId',    id,
               'forumUserId', forum_user_id,
               'pseudo',      pseudo,
               'creeLe',      cree_le
             ) as j
        from joueur
       where carte_sujet_id is null
         --  LA VALIDATION, ET RIEN D'AUTRE. Un joueur qui a ouvert son
         --  carnet sans être validé a une ligne, une clé, et pas de
         --  maison : il attend ici.
         and groupe is not null
       order by cree_le
       limit coalesce((p->>'limite')::integer, 10)
    ) t;
$$ language sql security definer set search_path = public;

revoke all on function cartes_a_publier(jsonb) from public;
revoke all on function cartes_a_publier(jsonb) from anon, authenticated;
grant execute on function cartes_a_publier(jsonb) to service_role;

-- ── 2 · valider un personnage, en un appel ─────────────────────────

--  LE GESTE DU STAFF, et il est volontairement unique : poser la
--  maison EST la validation. Deux fonctions — l'une qui crée, l'autre
--  qui valide — auraient fini par être appelées dans le désordre.
create or replace function valider_le_personnage(p jsonb)
returns jsonb as $$
declare
  v_forum  integer := (p->>'forumUserId')::integer;
  v_pseudo text    := p->>'pseudo';
  v_groupe text    := lower(p->>'groupe');
  v_id     uuid;
  v_neuf   boolean := false;
begin
  if v_forum is null then
    raise exception 'FORUM_USER_ID_MANQUANT';
  end if;
  --  LA MAISON EST VÉRIFIÉE ICI AUSSI, et pas seulement par la
  --  contrainte : le message « GROUPE_INCONNU » dit quoi corriger,
  --  là où une violation de contrainte oblige à aller lire le schéma.
  if v_groupe is null or
     v_groupe not in ('hardi', 'serieux', 'malin', 'doux', 'brave', 'jovial') then
    raise exception 'GROUPE_INCONNU';
  end if;

  update joueur
     set groupe = v_groupe,
         pseudo = coalesce(nullif(v_pseudo, ''), pseudo)
   where forum_user_id = v_forum
   returning id into v_id;

  if v_id is null then
    if v_pseudo is null or v_pseudo = '' then
      raise exception 'PSEUDO_MANQUANT';
    end if;
    insert into joueur (forum_user_id, pseudo, groupe)
    values (v_forum, v_pseudo, v_groupe)
    returning id into v_id;
    v_neuf := true;
  end if;

  return jsonb_build_object('joueurId', v_id, 'creee', v_neuf, 'groupe', v_groupe);
end $$ language plpgsql security definer set search_path = public;

revoke all on function valider_le_personnage(jsonb) from public;
revoke all on function valider_le_personnage(jsonb) from anon, authenticated;
grant execute on function valider_le_personnage(jsonb) to service_role;

comment on function valider_le_personnage(jsonb) is
  'Le geste de validation du staff : pose la maison du personnage, et '
  'crée sa ligne si elle n''existe pas encore. C''est ce qui met sa '
  'carte dresseur dans la file de publication.';

-- ── 3 · le compte de test, et lui seul ─────────────────────────────

do $$
declare n integer;
begin
  update joueur set groupe = 'hardi'
   where forum_user_id = 4 and groupe is null;
  get diagnostics n = row_count;
  raise notice 'compte de test validé : % ligne(s). Les autres attendent.', n;
end $$;
