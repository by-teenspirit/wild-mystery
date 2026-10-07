-- ════════════════════════════════════════════════════════════════════
--  0016 · les fossiles existent enfin, et leurs morceaux s'assemblent
--
--  `0002` a créé `fossile_espece` et `rendre_fossile`. `0013` a réparé
--  le refus qui ne survivait pas. Mais la table est restée **vide**
--  depuis le premier jour, et `0013` le dit explicitement : « c'est à
--  Callista d'écrire quel fossile donne quelle espèce ». Elle l'a
--  écrit le 7 octobre :
--
--  > On fouille, et on trouve un fossile ENTIER ou un MORCEAU,
--  > n'importe où et n'importe quand. Trois morceaux d'une même espèce
--  > font un fossile entier. Pas de dé Fossile, pas de morceaux
--  > génériques.
--
--  La donnée est donc arrivée : `data/fossiles.json`, onze fossiles
--  relevés sur PokéAPI, une espèce chacun. Le seed `fossiles.sql` en
--  est dérivé et insère les 22 objets, `fossile_espece` et la table que
--  cette migration crée.
--
--  ── UN MORCEAU EST UN OBJET, ET C'EST UN ARBITRAGE QUE J'AI PRIS ────
--
--  Callista n'était pas là pour trancher la forme. J'ai pris la plus
--  petite : **un morceau est un objet du sac**, un par espèce, qui ne
--  se vend pas. Le sac compte déjà des quantités, l'événement
--  `objet_trouve` dit déjà tout ce qu'il faut, et un joueur voit ses
--  morceaux là où il voit ses Potions.
--
--  Si elle préfère une table dédiée, c'est le seed qu'on change.
--
--  ── L'ASSEMBLAGE EST UN DÉCLENCHEUR, PAS UNE FONCTION ──────────────
--
--  « Trois morceaux font un fossile » doit valoir **quelle que soit la
--  porte par laquelle les morceaux entrent** : la relève aujourd'hui, un
--  échange entre joueurs ou un cadeau du staff demain. Une fonction
--  qu'il faut penser à appeler est une règle qu'on oubliera une fois.
--
--  Le déclencheur est donc sur `sac`, et il lit `fossile_morceau` : le
--  nombre n'est écrit nulle part dans ce fichier, il vient de la
--  donnée.
--
--  CONSÉQUENCE MESURABLE : on ne détient jamais trois morceaux d'une
--  même espèce. À trois, ils deviennent le fossile. « Jusqu'à 3
--  morceaux de chaque espèce » se lit donc bien, et se vérifie — c'est
--  le test `trois morceaux deviennent un fossile` de
--  `supabase/tests/`.
-- ════════════════════════════════════════════════════════════════════

-- ── ce qu'un morceau devient ────────────────────────────────────────
create table if not exists fossile_morceau (
  morceau_id      integer primary key references objet(id),
  fossile_id      integer not null references objet(id),
  morceaux_requis smallint not null check (morceaux_requis >= 2),
  --  Un morceau qui donnerait le morceau lui-même bouclerait : le
  --  déclencheur retirerait trois morceaux pour en ajouter un, et
  --  repartirait. La base refuse de l'écrire.
  constraint fossile_morceau_pas_soi check (morceau_id <> fossile_id)
);

comment on table fossile_morceau is
  'Dérivée de data/fossiles.json par outils/fossiles.py. Le déclencheur '
  'sac_assembler_les_morceaux ne lit que cette table : changer le '
  'nombre de morceaux se fait dans le JSON, pas dans du SQL.';

-- ── trois morceaux font un fossile ──────────────────────────────────
create or replace function sac_assembler_les_morceaux() returns trigger as $$
declare
  m    record;
  lots integer;
begin
  select * into m from fossile_morceau where morceau_id = new.objet_id;
  --  L'écrasante majorité des lignes de sac ne sont pas des morceaux :
  --  on sort tout de suite, sans rien verrouiller.
  if not found then return new; end if;
  if new.quantite < m.morceaux_requis then return new; end if;

  --  COMBIEN DE FOSSILES, pas « un ». Dix morceaux d'un coup — un
  --  cadeau du staff, une correction — en donnent trois, et il en
  --  reste un. En ajouter un seul en mangerait six.
  lots := new.quantite / m.morceaux_requis;

  --  ON RETIRE SUR LA LIGNE EN COURS, pas par un `update` : le
  --  déclencheur est `before`, donc modifier `new` suffit et ne le
  --  relance pas. Un `update sac` ici bouclerait.
  --
  --  Le reste est gardé : un joueur qui a quatre morceaux en garde un.
  --  C'est la même règle que `assembler()` dans le domaine, et elle
  --  n'est pas une politesse — jeter le reste volerait une fouille.
  new.quantite := new.quantite - lots * m.morceaux_requis;

  insert into sac (joueur_id, objet_id, quantite)
  values (new.joueur_id, m.fossile_id, lots)
      on conflict (joueur_id, objet_id)
      do update set quantite = sac.quantite + lots;

  return new;
end $$ language plpgsql;

--  `before`, et sur les deux : un morceau peut arriver par une
--  première ligne (insert) comme par un incrément (update).
drop trigger if exists sac_assembler_les_morceaux on sac;
create trigger sac_assembler_les_morceaux
  before insert or update of quantite on sac
  for each row execute function sac_assembler_les_morceaux();

-- ── le tirage de l'espèce ne tire plus ──────────────────────────────
--
--  `0002` tirait l'espèce en `order by random()`, et `0013` disait
--  pourquoi c'était un défaut connu : c'était le SEUL tirage du jeu qui
--  ne se rejoue pas, alors que tous les autres partent de l'identifiant
--  du message et permettent de recalculer une contestation des années
--  après.
--
--  La règle du 7 octobre rend le tirage inutile : **une espèce, un
--  fossile**. On ordonne donc par `espece_id`, ce qui est déterministe
--  et reste juste si un fossile finissait par en rendre deux — la
--  contestation se tranche alors en lisant la table, pas en priant.
--
--  `outils/fossiles.py` refuse de générer un seed où deux fossiles
--  rendraient la même espèce, et où un fossile en rendrait deux il
--  n'y aurait plus de tirage à faire : ce serait une probabilité à
--  écrire, donc une décision de jeu.
create or replace function rendre_fossile(p jsonb) returns jsonb as $$
declare
  v_analyse uuid := (p->>'analyseId')::uuid;
  a         record;
  esp       record;
  reste     integer;
begin
  if v_analyse is null then
    raise exception 'rendre_fossile : analyseId manquant dans %', p::text;
  end if;

  select * into a from analyse_fossile
   where id = v_analyse and etat = 'en_attente' for update;
  if not found then
    --  L'IMPOSSIBLE LÈVE (règle de 0013). Une analyse introuvable n'est
    --  pas un refus qu'on écrit : il n'y a pas de ligne où l'écrire.
    raise exception 'ANALYSE_INTROUVABLE %', v_analyse;
  end if;

  select quantite into reste from sac
   where joueur_id = a.joueur_id and objet_id = a.objet_id for update;
  if coalesce(reste, 0) < 1 then
    --  LE REFUS EST ÉCRIT, ET IL SURVIT : on rend, on ne lève pas.
    update analyse_fossile set etat = 'refusee' where id = v_analyse;
    return jsonb_build_object(
      'etat', 'refusee',
      'analyseId', v_analyse,
      'motif', 'FOSSILE_ABSENT',
      'detail', 'Ce fossile n''est plus dans ton sac.');
  end if;

  select e.* into esp from fossile_espece fe
    join espece e on e.id = fe.espece_id
   where fe.objet_id = a.objet_id
   order by fe.espece_id limit 1;
  if not found then
    --  PAS LA FAUTE DU JOUEUR : c'est une donnée qui manque de notre
    --  côté. On ne marque donc pas l'analyse refusée — elle se rejouera
    --  le jour où la ligne existera, et rien n'a été consommé.
    --
    --  Depuis le seed `fossiles.sql` ce cas ne devrait plus arriver
    --  pour les onze fossiles connus. Il reste atteignable pour les
    --  quatre fossiles de la 8G, qui se combinent par paires dans les
    --  jeux et dont la règle n'est pas écrite.
    return jsonb_build_object(
      'etat', 'impossible',
      'analyseId', v_analyse,
      'motif', 'FOSSILE_SANS_ESPECE',
      'detail', 'Aucune espèce n''est encore rattachée à ce fossile.');
  end if;

  update sac set quantite = quantite - 1
   where joueur_id = a.joueur_id and objet_id = a.objet_id;

  insert into pokemon (joueur_id, espece_id, niveau, xp, emplacement)
  values (a.joueur_id, esp.id, 15, seuil(15::smallint), 'boite');

  insert into pokedex (joueur_id, espece_id, croise_le, attrape_le)
  values (a.joueur_id, esp.id, now(), now())
      on conflict (joueur_id, espece_id) do update
         set attrape_le = coalesce(pokedex.attrape_le, excluded.attrape_le);

  update analyse_fossile set etat = 'rendue', espece_obtenue = esp.id
   where id = v_analyse;

  return jsonb_build_object(
    'etat', 'rendue',
    'analyseId', v_analyse,
    'especeId', esp.id,
    'espece', esp.nom_fr);
end $$ language plpgsql security definer;

revoke all on function rendre_fossile(jsonb) from public, anon, authenticated;
grant execute on function rendre_fossile(jsonb) to service_role;

-- ── la surface reste fermée (0008) ──────────────────────────────────
--  UNE TABLE NEUVE EST UNE SURFACE NEUVE. `0008` a révoqué d'un coup
--  tout ce qui existait alors ; ce qui est créé après n'est pas
--  couvert, et Supabase accorde par défaut à `anon` et `authenticated`.
--  On le dit donc ici, dans la même migration que la table.
--
--  Lecture publique, comme `objet` et `fossile_espece` : le navigateur
--  doit pouvoir dire « il te manque un morceau » sans passer par le
--  service. Aucune écriture — l'assemblage se fait en base, sur un
--  déclencheur, et le seed par la clé de service.
alter table fossile_morceau enable row level security;

drop policy if exists "le catalogue est public" on fossile_morceau;
create policy "le catalogue est public" on fossile_morceau for select using (true);

revoke all on table fossile_morceau from anon, authenticated;
grant select on table fossile_morceau to anon, authenticated;
