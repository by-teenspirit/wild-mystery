-- ════════════════════════════════════════════════════════════════════════
--  WILD MYSTERY · les fonctions que la relève appelle
--  À jouer après schema.sql.
--
--  Règle commune à toutes : elles vérifient, elles appliquent, et elles
--  lèvent une exception si quelque chose manque. Jamais de demi-mesure.
--  La relève attrape l'exception et la transforme en message au joueur.
-- ════════════════════════════════════════════════════════════════════════

-- La demande de clôture est un événement comme un autre : le bloc [cloture]
-- posé par le joueur en produit une ligne, et la relève la ramasse.
alter type evenement add value if not exists 'cloture_demandee';

-- ───────────────────────────────────────────────────────────────────────
--  LES NIVEAUX
--  Seuil cumulé pour atteindre le niveau n : 100 × n × (n+1) ÷ 2.
--  Un pokémon peut franchir plusieurs niveaux d'un coup à la clôture.
-- ───────────────────────────────────────────────────────────────────────
create or replace function seuil(n smallint) returns integer as $$
  select (100 * n * (n + 1) / 2)::integer
$$ language sql immutable;

create or replace function monter_niveaux(p_pokemon uuid) returns smallint as $$
declare
  p       record;
  gagnes  smallint := 0;
begin
  select * into p from pokemon where id = p_pokemon for update;
  while p.niveau < 100 and p.xp >= seuil((p.niveau + 1)::smallint) loop
    p.niveau := p.niveau + 1;
    gagnes := gagnes + 1;
  end loop;
  if gagnes > 0 then
    update pokemon set niveau = p.niveau where id = p_pokemon;
  end if;
  return gagnes;
end $$ language plpgsql;

-- ───────────────────────────────────────────────────────────────────────
--  LA BOUTIQUE
--  Débite, remplit le sac, et refuse si l'argent manque. Le prix est
--  relu dans la table, jamais celui qu'un panier a envoyé.
-- ───────────────────────────────────────────────────────────────────────
create or replace function servir_commande(p_commande uuid) returns integer as $$
declare
  c       record;
  ligne   jsonb;
  total   integer := 0;
  solde   integer;
begin
  select * into c from commande where id = p_commande and etat = 'en_attente' for update;
  if not found then raise exception 'Commande % introuvable ou déjà traitée.', p_commande; end if;

  for ligne in select * from jsonb_array_elements(c.lignes) loop
    total := total + (ligne->>'quantite')::int *
             coalesce((select prix from objet
                       where id = (ligne->>'objet_id')::int and en_vente), 0);
  end loop;
  if total = 0 then raise exception 'Aucun article en vente dans cette commande.'; end if;

  select pokedollars into solde from joueur where id = c.joueur_id for update;
  if solde < total then
    raise exception 'ARGENT_INSUFFISANT % %', total, solde;
  end if;

  update joueur set pokedollars = pokedollars - total where id = c.joueur_id;

  insert into sac (joueur_id, objet_id, quantite)
    select c.joueur_id, (l->>'objet_id')::int, (l->>'quantite')::int
    from jsonb_array_elements(c.lignes) l
    on conflict (joueur_id, objet_id) do update set quantite = sac.quantite + excluded.quantite;

  update commande set etat = 'servie', total = total where id = p_commande;
  return total;
end $$ language plpgsql security definer;

-- ───────────────────────────────────────────────────────────────────────
--  LA PENSION
--  Un niveau tous les dix jours, calculé une seule fois, au retour.
--  Rien ne tourne en fond, et le plafond est de dix niveaux par séjour.
-- ───────────────────────────────────────────────────────────────────────
create or replace function pensions_a_rendre()
returns table (id uuid, sujet_id bigint, pseudo text) as $$
  select p.id, 0::bigint, j.pseudo
  from pension p
  join joueur j on j.id = p.joueur_id
  where p.recupere_le is null
    and exists (select 1 from registre r
                where r.joueur_id = p.joueur_id
                  and r.type = 'cloture_demandee'
                  and r.charge->>'pension_id' = p.id::text)
$$ language sql stable;

create or replace function rendre_pension(p_pension uuid) returns smallint as $$
declare
  p       record;
  jours   integer;
  gagnes  smallint;
begin
  select * into p from pension where id = p_pension and recupere_le is null for update;
  if not found then raise exception 'Dépôt % introuvable ou déjà rendu.', p_pension; end if;

  jours := greatest(0, (now()::date - p.depose_le::date));
  gagnes := least(10, (jours / 10))::smallint;       -- dix niveaux au maximum

  update pokemon
     set niveau = least(100, niveau + gagnes),
         xp = greatest(xp, seuil(least(100, niveau + gagnes)::smallint)),
         emplacement = 'boite',
         position = null
   where id = p.pokemon_id;

  update pension set recupere_le = now() where id = p_pension;
  return gagnes;
end $$ language plpgsql security definer;

-- Deux dépôts ouverts au maximum : la base le refuse, pas le navigateur.
create or replace function pension_deux_max() returns trigger as $$
begin
  if (select count(*) from pension
      where joueur_id = new.joueur_id and recupere_le is null) >= 2 then
    raise exception 'PENSION_PLEINE';
  end if;
  return new;
end $$ language plpgsql;

create trigger pension_deux_max before insert on pension
  for each row execute function pension_deux_max();

-- ───────────────────────────────────────────────────────────────────────
--  LES FOSSILES
--  Un fossile contre une espèce. Le fossile est consommé, et l'espèce
--  tirée parmi celles que ce fossile peut donner.
-- ───────────────────────────────────────────────────────────────────────
create table if not exists fossile_espece (
  objet_id  integer not null references objet(id),
  espece_id integer not null references espece(id),
  primary key (objet_id, espece_id)
);

create or replace function rendre_fossile(p_analyse uuid) returns text as $$
declare
  a      record;
  esp    record;
  reste  integer;
begin
  select * into a from analyse_fossile where id = p_analyse and etat = 'en_attente' for update;
  if not found then raise exception 'Analyse % introuvable ou déjà rendue.', p_analyse; end if;

  select quantite into reste from sac
    where joueur_id = a.joueur_id and objet_id = a.objet_id for update;
  if coalesce(reste, 0) < 1 then
    update analyse_fossile set etat = 'refusee' where id = p_analyse;
    raise exception 'FOSSILE_ABSENT';
  end if;

  select e.* into esp from fossile_espece fe
    join espece e on e.id = fe.espece_id
    where fe.objet_id = a.objet_id
    order by random() limit 1;
  if not found then raise exception 'Aucune espèce rattachée à ce fossile.'; end if;

  update sac set quantite = quantite - 1
    where joueur_id = a.joueur_id and objet_id = a.objet_id;

  insert into pokemon (joueur_id, espece_id, niveau, xp, emplacement)
    values (a.joueur_id, esp.id, 15, seuil(15::smallint), 'boite');

  insert into pokedex (joueur_id, espece_id, croise_le, attrape_le)
    values (a.joueur_id, esp.id, now(), now())
    on conflict (joueur_id, espece_id) do update
      set attrape_le = coalesce(pokedex.attrape_le, excluded.attrape_le);

  update analyse_fossile set etat = 'rendue', espece_obtenue = esp.id where id = p_analyse;
  return esp.nom_fr;
end $$ language plpgsql security definer;

-- ───────────────────────────────────────────────────────────────────────
--  LES PALIERS
--  Le palier suit les badges, et c'est lui qui ouvre les zones.
--  2 à partir de trois badges, 3 quand les sept sont là.
-- ───────────────────────────────────────────────────────────────────────
create table if not exists badge (
  joueur_id uuid not null references joueur(id) on delete cascade,
  arene     text not null,
  obtenu_le timestamptz not null default now(),
  primary key (joueur_id, arene)
);

create or replace function paliers_a_revoir()
returns table (id uuid, palier_attendu smallint) as $$
  select j.id,
         case when count(b.arene) >= 7 then 3
              when count(b.arene) >= 3 then 2
              else 1 end::smallint
  from joueur j
  left join badge b on b.joueur_id = j.id
  group by j.id, j.palier
  having j.palier <> case when count(b.arene) >= 7 then 3
                          when count(b.arene) >= 3 then 2
                          else 1 end
$$ language sql stable;

-- ───────────────────────────────────────────────────────────────────────
--  LE POKÉDEX
--  Rien de nouveau à calculer : on recopie ce que le registre dit déjà,
--  pour les sujets clôturés seulement.
-- ───────────────────────────────────────────────────────────────────────
create or replace function ranger_pokedex() returns integer as $$
declare n integer;
begin
  insert into pokedex (joueur_id, espece_id, croise_le, attrape_le)
  select r.joueur_id,
         (r.charge->>'espece_id')::int,
         min(r.cree_le) filter (where r.type = 'croise'),
         min(r.cree_le) filter (where r.type = 'capture')
  from registre r
  join cloture c on c.sujet_id = r.sujet_id
  where r.type in ('croise','capture')
  group by 1, 2
  on conflict (joueur_id, espece_id) do update
    set croise_le  = least(pokedex.croise_le, excluded.croise_le),
        attrape_le = coalesce(pokedex.attrape_le, excluded.attrape_le);
  get diagnostics n = row_count;
  return n;
end $$ language plpgsql security definer;

-- ───────────────────────────────────────────────────────────────────────
--  LE MÉNAGE
--  Un sujet sans nouveau message depuis p_jours et jamais clôturé perd
--  son registre. Pas de capture fantôme, pas d'XP qui ressort un an après.
-- ───────────────────────────────────────────────────────────────────────
create or replace function oublier_les_abandons(p_jours integer default 60)
returns integer as $$
declare n integer;
begin
  with morts as (
    select sujet_id
    from registre
    group by sujet_id
    having max(cree_le) < now() - make_interval(days => p_jours)
       and not exists (select 1 from cloture c where c.sujet_id = registre.sujet_id)
  )
  delete from registre where sujet_id in (select sujet_id from morts);
  get diagnostics n = row_count;
  return n;
end $$ language plpgsql security definer;

-- ───────────────────────────────────────────────────────────────────────
--  LA LIAISON D'UN COMPTE
--  Le jeton est à usage unique : il est effacé au moment où il sert.
--  C'est ce qui empêche de lier deux fois le même compte.
-- ───────────────────────────────────────────────────────────────────────
create or replace function lier_compte(p_jeton text, p_forum_user_id integer, p_pseudo text)
returns uuid as $$
declare j uuid;
begin
  update joueur
     set forum_user_id = p_forum_user_id,
         pseudo = p_pseudo,
         lie_le = now(),
         jeton = null
   where jeton = p_jeton and lie_le is null
   returning id into j;
  if j is null then raise exception 'JETON_INVALIDE'; end if;
  return j;
end $$ language plpgsql security definer;
