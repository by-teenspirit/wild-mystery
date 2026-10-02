-- ═══════════════════════════════════════════════════════════════════════
--  0004_identite_et_cloture.sql
--
--  Deux décisions prises les 1er et 2 octobre, appliquées ici.
--
--  1 · L'IDENTITÉ (décision « a » du 2 octobre)
--      C'est Supabase Auth qui fabrique le laissez-passer du joueur. La
--      table `joueur` note à quel compte d'authentification elle
--      correspond, et `joueur_courant()` lit ce compte dans le jeton.
--      Avant, elle lisait une revendication `joueur_id` que personne
--      n'aurait jamais posée : les politiques RLS étaient donc toutes
--      fausses, et silencieusement — `joueur_courant()` rendait NULL, et
--      une comparaison à NULL ne lève pas, elle ne rend rien.
--
--  2 · QUI DÉCIDE, QUI APPLIQUE (décision du 2 octobre, contrat §7)
--      `cloturer()` recalculait le verdict d'une clôture que le domaine
--      calcule déjà. La même règle écrite deux fois dans deux langages,
--      c'est la garantie qu'un jour les deux ne diront plus la même
--      chose. Elle disparaît, remplacée par `appliquer_cloture`, qui ne
--      vérifie plus rien : elle verse ce que le domaine a décidé.
--
--  3 · AU PASSAGE, UN BOGUE QUI AURAIT TOUT CASSÉ
--      Les fonctions de 0002 lisaient `charge->>'espece_id'` et
--      `charge->>'pension_id'` — en serpent. L'adaptateur TypeScript
--      écrit `especeId` et `pensionId` — en chameau. Aucune des deux
--      n'aurait levé : `->>` sur une clé absente rend NULL. Le pokédex se
--      serait rempli de lignes vides et les pensions ne seraient jamais
--      revenues. Corrigé ici, et une assertion pgTAP tient la porte.
-- ═══════════════════════════════════════════════════════════════════════

-- ───────────────────────────────────────────────────────────────────────
--  1 · L'identité
-- ───────────────────────────────────────────────────────────────────────

--  Pas de clé étrangère vers `auth.users`, délibérément : elle attacherait
--  le schéma à une table interne de Supabase, qui n'existe pas sur un
--  PostgreSQL nu — donc ni dans le CI, ni sur un poste de travail. Et
--  supprimer un compte d'authentification ne doit surtout pas emporter en
--  cascade les pokémon de quelqu'un.
alter table joueur add column if not exists auth_id uuid unique;
comment on column joueur.auth_id is
  'Le compte Supabase Auth de ce joueur. Posé une seule fois, par la '
  'fonction de liaison, après vérification de la clé déposée dans le profil.';

--  Le `sub` du jeton, c'est-à-dire exactement ce que rend `auth.uid()` sur
--  Supabase. On le lit nous-mêmes plutôt que d'appeler `auth.uid()` pour
--  que la fonction se comporte à l'identique sur un PostgreSQL nu : les
--  politiques RLS deviennent testables hors Supabase, en posant
--  simplement `set request.jwt.claims`.
--  Les deux `nullif` ne sont pas une coquetterie. Sans jeton du tout,
--  `current_setting(…, true)` rend la chaîne VIDE, et `''::jsonb` lève
--  « invalid input syntax for type json ». Une politique RLS qui appelle
--  cette fonction ferait alors tomber la requête d'un visiteur anonyme au
--  lieu de ne rien lui rendre. Le bogue était déjà là avant cette
--  migration ; il est corrigé en passant.
create or replace function auth_courant() returns uuid as $$
  select nullif(
           nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub',
           ''
         )::uuid
$$ language sql stable;

comment on function auth_courant() is
  'Le compte d''authentification qui parle, ou NULL. Équivalent de auth.uid().';

create or replace function joueur_courant() returns uuid as $$
  select j.id from joueur j where j.auth_id = auth_courant()
$$ language sql stable;

-- ───────────────────────────────────────────────────────────────────────
--  2 · La clôture : appliquer, sans vérifier
-- ───────────────────────────────────────────────────────────────────────

--  Un sujet peut être clôturé à plusieurs. La colonne `clos_par` ne peut
--  donc plus être obligatoire : c'est `resultat` qui porte le détail, par
--  joueur. On la garde pour le cas d'un sujet solo, et pour l'archive.
alter table cloture alter column clos_par drop not null;

drop function if exists cloturer(bigint, uuid, text);

--  Un seul argument jsonb, comme les quatre fonctions du registre et pour
--  la même raison (voir la tête de 0003) : PostgREST et psql l'appellent
--  de la même façon, et le seul endroit qui connaisse les transtypages
--  est ce fichier.
--
--  La charge attendue, telle que l'adaptateur la fabrique depuis les
--  `Effets` du domaine :
--
--  {
--    "sujetId": 7000,
--    "code": "WM-ACDE-FGH",
--    "versements": [{
--      "joueurId": "…uuid…",
--      "effets": {
--        "objetsConsommes": [{"objetId": 1, "quantite": 2}],
--        "objetsAjoutes":   [{"objetId": 2, "quantite": 1}],
--        "captures":        [{"especeId": 215, "niveau": 19}],
--        "xpParPokemon":    [{"pokemonId": "…uuid…", "gain": 180}],
--        "especesCroisees": [215, 220],
--        "pokedollars": 150
--      }
--    }]
--  }
--
--  Les contraintes de la base — stock positif, six en équipe, solde
--  positif — sont un FILET, pas la règle. Si l'une se déclenche, c'est que
--  le domaine et la base ont divergé : la transaction tombe entière, rien
--  n'est versé, rien n'est posté, et la relève repassera.
create or replace function appliquer_cloture(p jsonb) returns jsonb as $$
declare
  v_sujet    bigint := (p->>'sujetId')::bigint;
  v_code     text   := p->>'code';
  versement  jsonb;
  effets     jsonb;
  v_joueur   uuid;
  v_premier  uuid := null;
  v_pokemon  uuid;
  n_joueurs  integer := 0;
begin
  if v_sujet is null then
    raise exception 'appliquer_cloture : sujetId manquant dans %', p::text;
  end if;
  if v_code is null or v_code = '' then
    raise exception 'appliquer_cloture : code manquant pour le sujet %', v_sujet;
  end if;
  if exists (select 1 from cloture c where c.sujet_id = v_sujet) then
    raise exception 'Le sujet % est déjà clôturé.', v_sujet;
  end if;
  if p->'versements' is null or jsonb_typeof(p->'versements') <> 'array' then
    raise exception 'appliquer_cloture : « versements » doit être un tableau';
  end if;

  for versement in select * from jsonb_array_elements(p->'versements') loop
    v_joueur := (versement->>'joueurId')::uuid;
    effets   := versement->'effets';
    if v_joueur is null then
      raise exception 'appliquer_cloture : un versement sans joueurId';
    end if;
    if effets is null or jsonb_typeof(effets) <> 'object' then
      raise exception 'appliquer_cloture : effets manquants pour le joueur %', v_joueur;
    end if;
    v_premier := coalesce(v_premier, v_joueur);
    n_joueurs := n_joueurs + 1;

    -- a) ce qui sort du sac. La contrainte `quantite >= 0` est le filet.
    update sac s
       set quantite = s.quantite - d.quantite
      from (
        select (e->>'objetId')::int as objet_id, (e->>'quantite')::int as quantite
          from jsonb_array_elements(coalesce(effets->'objetsConsommes', '[]'::jsonb)) e
      ) d
     where s.joueur_id = v_joueur and s.objet_id = d.objet_id;

    -- b) ce qui entre dans le sac
    insert into sac (joueur_id, objet_id, quantite)
    select v_joueur, (e->>'objetId')::int, (e->>'quantite')::int
      from jsonb_array_elements(coalesce(effets->'objetsAjoutes', '[]'::jsonb)) e
        on conflict (joueur_id, objet_id)
        do update set quantite = sac.quantite + excluded.quantite;

    -- c) les captures vont en boîte, jamais en équipe : c'est au joueur de
    --    les y mettre, depuis son carnet.
    insert into pokemon (joueur_id, espece_id, niveau, emplacement, capture_dans)
    select v_joueur, (e->>'especeId')::int, (e->>'niveau')::smallint, 'boite', v_sujet
      from jsonb_array_elements(coalesce(effets->'captures', '[]'::jsonb)) e;

    -- d) l'expérience, puis les montées de niveau qui en découlent
    for v_pokemon in
      select (e->>'pokemonId')::uuid
        from jsonb_array_elements(coalesce(effets->'xpParPokemon', '[]'::jsonb)) e
    loop
      update pokemon q
         set xp = q.xp + d.gain
        from (
          select (e->>'gain')::int as gain
            from jsonb_array_elements(coalesce(effets->'xpParPokemon', '[]'::jsonb)) e
           where (e->>'pokemonId')::uuid = v_pokemon
        ) d
       where q.id = v_pokemon and q.joueur_id = v_joueur;
      perform monter_niveaux(v_pokemon);
    end loop;

    -- e) l'argent. La contrainte `pokedollars >= 0` est le filet.
    update joueur j
       set pokedollars = j.pokedollars + coalesce((effets->>'pokedollars')::int, 0)
     where j.id = v_joueur;

    -- f) le pokédex : croisé une fois suffit, attrapé écrase.
    insert into pokedex (joueur_id, espece_id, croise_le)
    select v_joueur, e::text::int, now()
      from jsonb_array_elements(coalesce(effets->'especesCroisees', '[]'::jsonb)) e
        on conflict (joueur_id, espece_id)
        do update set croise_le = least(pokedex.croise_le, excluded.croise_le);

    insert into pokedex (joueur_id, espece_id, croise_le, attrape_le)
    select v_joueur, (e->>'especeId')::int, now(), now()
      from jsonb_array_elements(coalesce(effets->'captures', '[]'::jsonb)) e
        on conflict (joueur_id, espece_id)
        do update set croise_le  = least(pokedex.croise_le, excluded.croise_le),
                      attrape_le = coalesce(pokedex.attrape_le, excluded.attrape_le);
  end loop;

  if n_joueurs = 0 then
    raise exception 'appliquer_cloture : aucun versement pour le sujet %', v_sujet;
  end if;

  insert into cloture (sujet_id, clos_par, resultat, code)
  values (v_sujet, v_premier, p->'versements', v_code);

  return jsonb_build_object('sujetId', v_sujet, 'joueurs', n_joueurs, 'code', v_code);
end $$ language plpgsql security definer;

create or replace function cloture_deja(p jsonb) returns boolean as $$
  select exists (select 1 from cloture c where c.sujet_id = (p->>'sujetId')::bigint)
$$ language sql stable security definer;

-- ───────────────────────────────────────────────────────────────────────
--  3 · Le serpent devenu chameau
--  Les deux fonctions de 0002 qui lisaient la charge du registre avec des
--  clés en serpent. L'adaptateur écrit en chameau, et `->>` sur une clé
--  absente rend NULL sans rien dire : le bogue aurait été muet.
-- ───────────────────────────────────────────────────────────────────────
--  `drop` d'abord : PostgreSQL refuse de remplacer une fonction dont les
--  colonnes de sortie changent de nom, et celles de 0002 n'étaient pas
--  nommées pareil.
drop function if exists pensions_a_rendre();
create function pensions_a_rendre()
returns table (pension_id uuid, joueur_id uuid, pokemon_id uuid, jours integer) as $$
  select p.id, p.joueur_id, p.pokemon_id,
         (extract(epoch from (now() - p.depose_le)) / 86400)::integer
    from pension p
   where p.recupere_le is null
     and exists (select 1 from registre r
                  where r.type = 'objet_utilise'
                    and r.charge->>'pensionId' = p.id::text)
$$ language sql stable security definer;

create or replace function ranger_pokedex() returns integer as $$
declare n integer;
begin
  insert into pokedex (joueur_id, espece_id, croise_le)
  select r.joueur_id, (r.charge->>'especeId')::int, min(r.cree_le)
    from registre r
   where r.type in ('croise', 'capture')
     and (r.charge->>'especeId') is not null
   group by 1, 2
      on conflict (joueur_id, espece_id)
      do update set croise_le = least(pokedex.croise_le, excluded.croise_le);
  get diagnostics n = row_count;
  return n;
end $$ language plpgsql security definer;
