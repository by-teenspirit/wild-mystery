-- ════════════════════════════════════════════════════════════════════
--  0033 · La fiche du personnage — « Mon histoire »
--
--  Note de code `399:1365`, dont le titre est la règle entière :
--  « Chaque champ a son interrupteur, et rien ne fuit par défaut ».
--
--  ── LES NOMS NE SONT PAS CEUX DE LA NOTE, ET C'EST VOULU ────────────
--
--  La note écrit `personnage(joueur, champ, valeur, affiche, ordre)`.
--  Dans cette base, un `joueur` EST un personnage — une ligne par compte
--  du forum, pseudo compris. Une table `personnage` à côté de `joueur`
--  ferait buter tout le monde, moi le premier, à chaque relecture.
--
--  Donc `fiche_champ`, `fiche_description`, `fiche_trait`,
--  `fiche_moment` : le préfixe dit à quoi elles servent, et rien ne se
--  confond. La planche 72 enregistre déjà ce genre d'écart (`inventaire`
--  de la note est le `sac` de la base), et c'est le même ici.
--
--  ── LES TROIS RÈGLES QUE LA BASE TIENT ELLE-MÊME ────────────────────
--
--  1. UN CHAMP NEUF NAÎT MASQUÉ. `affiche boolean not null default
--     false`. « On montre sur décision, jamais par oubli » n'est pas une
--     consigne d'interface : c'est une valeur par défaut, et elle tient
--     même si quelqu'un insère une ligne par un autre chemin.
--
--  2. UN MOMENT DU SERVEUR NE SE RÉÉCRIT PAS. La note : « Il peut
--     masquer un moment automatique, pas le réécrire. » Une politique
--     RLS ne sait pas comparer l'ancienne ligne à la nouvelle colonne
--     par colonne, alors c'est un déclencheur qui remet la date, le
--     titre et le texte d'origine. Seul `affiche` passe.
--
--  3. ET ON NE S'ÉCRIT PAS UN MOMENT DU SERVEUR. La politique
--     d'insertion exige `not auto` : sans elle, n'importe qui se
--     fabriquerait un « a remporté le badge de Rhode » que le jeu n'a
--     jamais écrit.
--
--  ── CE QUE CETTE MIGRATION NE FAIT PAS ──────────────────────────────
--
--  « Un champ masqué ne sort pas de la base » vise la FABRIQUE DE LA
--  FICHE, qui appartient au lot « Mes liens » : c'est elle qui ne lira
--  que `affiche = true`. Ici, le joueur lit TOUTES ses lignes, masquées
--  comprises — il lui faut bien voir ses propres interrupteurs. Les deux
--  lectures sont différentes et il ne faut pas les confondre.
-- ════════════════════════════════════════════════════════════════════

-- ── 1 · le garde-fou de volume, partagé ────────────────────────────

--  UNE TABLE OÙ LE JOUEUR INSÈRE LIBREMENT EST UNE TABLE SANS FOND.
--  Pas de la méfiance : un script maladroit dans la page, une touche
--  restée enfoncée, et la table porte dix mille lignes qu'on ira
--  nettoyer à la main. La borne est large — personne ne l'atteindra en
--  écrivant une fiche.
--
--  La course ne compte pas ici, contrairement aux trois places des
--  brouillons : vingt-et-un champs au lieu de vingt n'abîme rien, alors
--  qu'un quatrième brouillon aurait cassé l'écran.
create or replace function fiche_pas_trop_de_lignes() returns trigger as $$
declare
  v_max integer := TG_ARGV[0]::integer;
  v_n   integer;
begin
  execute format('select count(*) from %I where joueur_id = $1', TG_TABLE_NAME)
     into v_n using new.joueur_id;
  if v_n >= v_max then
    raise exception 'TROP_DE_LIGNES'
      using detail = TG_TABLE_NAME || ' : ' || v_max || ' au maximum';
  end if;
  return new;
end $$ language plpgsql set search_path = public, pg_temp;

revoke all on function fiche_pas_trop_de_lignes() from public;

comment on function fiche_pas_trop_de_lignes() is
  'Borne le nombre de lignes par joueur. Le nom de table vient de '
  'TG_TABLE_NAME, pas de l''appelant : le format %I n''expose rien. '
  'PAS `security definer` : le comptage doit voir ce que voit '
  'l''appelant — ses propres lignes — et la garantie de surface '
  'refuse toute fonction `definer` ouverte à PUBLIC.';

-- ── 2 · les champs d'identité ──────────────────────────────────────

create table if not exists fiche_champ (
  joueur_id uuid     not null references joueur(id) on delete cascade,
  --  LES CHAMPS LIBRES SONT LA RÈGLE, pas l'exception : « c'est ce que
  --  les gens font déjà à la main dans leurs fiches ». L'intitulé est
  --  donc du texte, borné, et sans chevrons — il finira dans un message
  --  BBCode, et la fabrique l'échappera, mais un intitulé qui ressemble
  --  à une balise n'a aucune raison d'exister.
  champ     text     not null check (
              length(champ) between 1 and 40 and champ !~ '[<>]'),
  valeur    text     not null default '' check (length(valeur) <= 300),
  affiche   boolean  not null default false,
  ordre     smallint not null default 0,
  primary key (joueur_id, champ)
);

create trigger fiche_champ_pas_trop before insert on fiche_champ
  for each row execute function fiche_pas_trop_de_lignes(24);

comment on table fiche_champ is
  'Une ligne par champ d''identité, intitulés libres compris. `affiche` '
  'est faux par défaut : un champ neuf naît masqué (0033).';

-- ── 3 · la description, l'image et la carte ────────────────────────

--  TROIS CHOSES DANS UNE TABLE, et je préfère le dire que l'habiller :
--  la description a sa ligne unique par joueur, et l'image comme
--  l'interrupteur de la trainer card n'ont pas d'autre endroit où
--  vivre. Deux tables d'une seule ligne chacune auraient été une
--  élégance de façade.
create table if not exists fiche_description (
  joueur_id   uuid    primary key references joueur(id) on delete cascade,
  texte       text    not null default '' check (length(texte) <= 6000),
  affiche     boolean not null default false,
  --  L'IMAGE : l'avatar du profil, relu à chaque relève, ou un lien
  --  fourni. « On ne réhéberge rien, c'est un lien comme dans n'importe
  --  quel message. »
  image_mode  text    not null default 'avatar'
                check (image_mode in ('avatar', 'lien')),
  --  `https` SEULEMENT, ET C'EST UNE PROTECTION, PAS UNE PRÉFÉRENCE :
  --  sans ce filtre, un `javascript:` collé ici arriverait un jour dans
  --  un attribut de la page. La forme est vérifiée là où la valeur
  --  entre, pas là où elle sort — il n'y a qu'une entrée, il y aura
  --  beaucoup de sorties.
  image_lien  text    not null default '' check (
                image_lien = '' or
                (image_lien ~ '^https://' and length(image_lien) <= 400)),
  --  « Le joueur n'a qu'un interrupteur, pour tout le bloc. »
  carte_affiche boolean not null default false
);

comment on table fiche_description is
  'La description libre, le choix d''image et l''interrupteur de la '
  'trainer card : une ligne par joueur. Le contenu de la carte vient '
  'des tables du jeu, jamais d''ici (0033).';

-- ── 4 · les traits ─────────────────────────────────────────────────

create table if not exists fiche_trait (
  joueur_id uuid not null references joueur(id) on delete cascade,
  mot       text not null check (length(mot) between 1 and 24 and mot !~ '[<>]'),
  ordre     smallint not null default 0,
  primary key (joueur_id, mot)
);

create trigger fiche_trait_pas_trop before insert on fiche_trait
  for each row execute function fiche_pas_trop_de_lignes(12);

-- ── 5 · la chronologie ─────────────────────────────────────────────

create table if not exists fiche_moment (
  id        uuid primary key default gen_random_uuid(),
  joueur_id uuid not null references joueur(id) on delete cascade,
  quand     date not null,
  titre     text not null check (length(titre) between 1 and 80 and titre !~ '[<>]'),
  texte     text not null default '' check (length(texte) <= 1200),
  --  DEUX SOURCES DANS UNE TABLE : les moments que le serveur écrit —
  --  arrivée, premier Pokémon, badges, Ligue — et ceux du joueur.
  auto      boolean not null default false,
  affiche   boolean not null default false
);

create index if not exists fiche_moment_du_joueur on fiche_moment (joueur_id, quand);

create trigger fiche_moment_pas_trop before insert on fiche_moment
  for each row execute function fiche_pas_trop_de_lignes(80);

--  UN MOMENT DU SERVEUR SE MASQUE, IL NE SE RÉÉCRIT PAS. Une politique
--  RLS ne compare pas l'ancienne ligne à la nouvelle colonne par
--  colonne : `with check` ne voit que la nouvelle. Alors le déclencheur
--  remet ce qui ne se touche pas, et laisse passer `affiche` — le seul
--  interrupteur que la note accorde.
--
--  Il remet aussi `auto` dans les deux sens : on ne promeut pas son
--  propre moment en moment du serveur par une mise à jour.
create or replace function fiche_moment_auto_intouchable() returns trigger as $$
begin
  if old.auto then
    new.quand := old.quand;
    new.titre := old.titre;
    new.texte := old.texte;
  end if;
  new.auto := old.auto;
  new.joueur_id := old.joueur_id;
  return new;
end $$ language plpgsql set search_path = public, pg_temp;

revoke all on function fiche_moment_auto_intouchable() from public;

create trigger fiche_moment_auto before update on fiche_moment
  for each row execute function fiche_moment_auto_intouchable();

comment on function fiche_moment_auto_intouchable() is
  'Un moment écrit par le serveur se masque mais ne se réécrit pas '
  '(0033). Remet aussi `auto` et `joueur_id` : on ne se promeut pas un '
  'moment en moment du jeu, et on n''en donne pas un à quelqu''un '
  'd''autre.';

-- ── 6 · la RLS, la même forme que les brouillons ───────────────────

do $$
declare t text;
begin
  foreach t in array array['fiche_champ', 'fiche_description', 'fiche_trait', 'fiche_moment']
  loop
    execute format('alter table %I enable row level security', t);
    execute format('alter table %I force row level security', t);
    execute format('drop policy if exists %I on %I', t || '_lecture', t);
    execute format(
      'create policy %I on %I for select to authenticated '
      'using (joueur_id in (select mes_joueurs()))', t || '_lecture', t);
    execute format('drop policy if exists %I on %I', t || '_reecriture', t);
    execute format(
      'create policy %I on %I for update to authenticated '
      'using (joueur_id in (select mes_joueurs())) '
      'with check (joueur_id in (select mes_joueurs()))', t || '_reecriture', t);
    execute format('grant select, insert, update, delete on %I to authenticated', t);
    execute format('revoke all on %I from anon', t);
  end loop;
end $$;

--  L'INSERTION ET L'EFFACEMENT DES MOMENTS NE SUIVENT PAS LE MOULE, à
--  cause de `auto` : on ne s'écrit pas un moment du serveur, et on n'en
--  efface pas un. Les trois autres tables prennent la forme ordinaire.

do $$
declare t text;
begin
  foreach t in array array['fiche_champ', 'fiche_description', 'fiche_trait']
  loop
    execute format('drop policy if exists %I on %I', t || '_ecriture', t);
    execute format(
      'create policy %I on %I for insert to authenticated '
      'with check (joueur_id in (select mes_joueurs()))', t || '_ecriture', t);
    execute format('drop policy if exists %I on %I', t || '_effacement', t);
    execute format(
      'create policy %I on %I for delete to authenticated '
      'using (joueur_id in (select mes_joueurs()))', t || '_effacement', t);
  end loop;
end $$;

drop policy if exists fiche_moment_ecriture on fiche_moment;
create policy fiche_moment_ecriture on fiche_moment
  for insert to authenticated
  with check (joueur_id in (select mes_joueurs()) and not auto);

drop policy if exists fiche_moment_effacement on fiche_moment;
create policy fiche_moment_effacement on fiche_moment
  for delete to authenticated
  using (joueur_id in (select mes_joueurs()) and not auto);
