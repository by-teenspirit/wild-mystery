-- ════════════════════════════════════════════════════════════════════
--  0028 · Valider rend la clé à coller
--
--  « L'admin la met au tout début, et une fois mise, quand le joueur
--  est validé, ça fonctionne », 3 novembre.
--
--  ── POURQUOI ────────────────────────────────────────────────────────
--
--  Le geste du staff était en deux temps, et dans un ordre qui ne se
--  devine pas : `valider_le_personnage` crée la ligne du joueur, et
--  `carnet_nouvelle_cle` ne sait poser une clé que sur une ligne qui
--  existe déjà. Appelées à l'envers, la seconde lève
--  `JOUEUR_INTROUVABLE` — ce qui est arrivé en essayant, et ce n'est
--  pas une erreur qu'on doit apprendre par cœur.
--
--  Un seul appel, donc, et il rend tout ce qu'il faut coller.
--
--  ── LA CLÉ N'EST REFAITE QUE SI ELLE MANQUE ─────────────────────────
--
--  Et c'est la décision importante de cette migration. Valider deux
--  fois arrive — on corrige un pseudo, on change une maison — et une
--  clé neuve à chaque fois casserait le carnet d'un joueur qui jouait
--  très bien : celle de son profil ne vaudrait plus rien, sans que
--  personne ait rien remarqué.
--
--  Donc on pose une clé quand il n'y en a pas, et on rend celle qui
--  existe sinon. Pour en changer vraiment — un joueur qui l'a laissée
--  traîner quelque part — c'est `carnet_nouvelle_cle` qu'on appelle,
--  et son nom dit ce qu'elle fait.
-- ════════════════════════════════════════════════════════════════════

create or replace function valider_le_personnage(p jsonb)
returns jsonb as $$
declare
  v_forum  integer := (p->>'forumUserId')::integer;
  v_pseudo text    := p->>'pseudo';
  v_groupe text    := lower(p->>'groupe');
  v_id     uuid;
  v_neuf   boolean := false;
  v_cle    text;
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

  --  LA CLÉ, POSÉE SEULEMENT SI ELLE MANQUE. `coalesce` ne suffirait
  --  pas : il faut ÉCRIRE celle qu'on vient de tirer, et ne rien
  --  écrire quand il y en a déjà une.
  select cle_de_carnet into v_cle from joueur where id = v_id;
  if v_cle is null then
    v_cle := encode(gen_random_bytes(16), 'hex');
    update joueur set cle_de_carnet = v_cle where id = v_id;
  end if;

  return jsonb_build_object(
    'joueurId', v_id,
    'creee',    v_neuf,
    'groupe',   v_groupe,
    --  CE QU'IL FAUT COLLER dans « clé de liaison », côté profil du
    --  membre. C'est le seul endroit d'où elle sort.
    'cle',      v_cle
  );
end $$ language plpgsql security definer set search_path = public, extensions;

revoke all on function valider_le_personnage(jsonb) from public;
revoke all on function valider_le_personnage(jsonb) from anon, authenticated;
grant execute on function valider_le_personnage(jsonb) to service_role;

comment on function valider_le_personnage(jsonb) is
  'Le geste de validation du staff, en un appel : pose la maison, crée '
  'la ligne au besoin, et rend la clé de liaison à coller dans le champ '
  'du profil. La clé n''est refaite que si elle manque.';
