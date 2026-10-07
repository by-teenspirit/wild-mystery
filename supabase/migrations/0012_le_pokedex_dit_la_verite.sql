-- ════════════════════════════════════════════════════════════════════
--  0012 · le pokédex dit la vérité, et il le dit en silence
--
--  `ranger_pokedex` a été écrite en `0002`, puis réécrite en `0004`. La
--  réécriture a corrigé une chose et en a cassé deux — exactement la
--  forme du défaut de `servir_commande` (voir `0011`).
--
--  ── CE QUE `0002` FAISAIT BIEN, ET QUE `0004` A PERDU ───────────────
--
--  Relevé le 6 octobre contre un PostgreSQL 16, avec des lignes réelles :
--
--    1. **`join cloture` perdu.** `0002` ne recopiait que les sujets
--       CLÔTURÉS — son propre commentaire le disait. `0004` recopie TOUT
--       le registre. Mesuré : un Pikachu simplement croisé dans un sujet
--       ouvert entre au pokédex et y reste. Pire, `oublier_sujet` efface
--       ensuite le registre du sujet abandonné : il reste au pokédex une
--       espèce dont plus rien ne dit d'où elle vient.
--
--       Le pokédex est un objectif de complétion. Y créditer une
--       rencontre qui n'a jamais compté, c'est offrir l'objectif.
--
--    2. **`attrape_le` perdu.** `0004` ne pose que `croise_le`. Mesuré :
--       un Évoli capturé dans un sujet CLOS ressort `attrape_le` à null.
--       **Aucune capture n'était jamais enregistrée par cette fonction.**
--
--  ── CE QUE `0004` A CORRIGÉ, ET QU'ON GARDE ─────────────────────────
--
--  La clé. `0002` lisait `charge->>'espece_id'`, en serpent ; le registre
--  porte `especeId`, en chameau — c'est `src/adaptateurs/supabase/
--  evenement.ts` qui l'écrit, et une assertion pgTAP interdit le retour
--  du serpent. `0002` lisait donc null partout.
--
--  Autrement dit : les deux versions étaient cassées, chacune à sa
--  façon, et la seconde a été écrite en regardant la première.
--
--  ── ET ELLE DEVIENT UN DÉTECTEUR, PAS UN RÉPARATEUR ─────────────────
--
--  `appliquer_cloture` écrit déjà le pokédex, dans la transaction de la
--  clôture (migration `0006`). Donc en régime normal, cette fonction ne
--  devrait RIEN avoir à changer : **zéro est la bonne réponse**, et un
--  nombre non nul est le signe que quelque chose s'est passé — une
--  clôture d'avant ce comportement, une ligne de registre corrigée à la
--  main, un bogue.
--
--  Mais `0004` comptait les lignes TOUCHÉES, pas les lignes CHANGÉES :
--  son `do update set croise_le = least(…)` réécrit la même valeur et la
--  compte quand même. Elle rendait donc toujours le nombre de paires
--  (joueur, espèce) du registre, un chiffre qui ne veut rien dire.
--
--  D'où le `where` sur le `do update` : on ne touche une ligne que si
--  elle est réellement en retard. Le compte redevient une mesure, et la
--  relève peut le journaliser sans qu'il crie tous les cinq minutes.
-- ════════════════════════════════════════════════════════════════════

create or replace function ranger_pokedex() returns integer as $$
declare n integer;
begin
  insert into pokedex (joueur_id, espece_id, croise_le, attrape_le)
  select r.joueur_id,
         (r.charge->>'especeId')::int,
         --  La PREMIÈRE fois, pas la dernière : un joueur qui recroise une
         --  espèce ne doit pas voir sa date reculer.
         min(r.cree_le),
         min(r.cree_le) filter (where r.type = 'capture')
    from registre r
    --  LA JOINTURE QUI MANQUAIT. Seuls les sujets clôturés comptent : un
    --  sujet ouvert peut encore être abandonné, et un sujet abandonné
    --  n'a rien versé.
    join cloture c on c.sujet_id = r.sujet_id
   where r.type in ('croise', 'capture')
     and (r.charge->>'especeId') is not null
   group by 1, 2
      on conflict (joueur_id, espece_id) do update
         set croise_le  = least(pokedex.croise_le, excluded.croise_le),
             attrape_le = coalesce(pokedex.attrape_le, excluded.attrape_le)
         --  ON NE TOUCHE QUE CE QUI EST EN RETARD, pour que le compte
         --  rendu soit un nombre de corrections et pas un nombre de
         --  lignes vues.
         where pokedex.croise_le is null
            or pokedex.croise_le > excluded.croise_le
            or (pokedex.attrape_le is null and excluded.attrape_le is not null);
  get diagnostics n = row_count;
  return n;
end $$ language plpgsql security definer;

-- ─────────────────────────────────────────────────────────────────────
--  La version `(p jsonb) returns jsonb`, pour la relève.
--
--  La fonction sans argument reste : elle est appelable à la main dans
--  l'éditeur SQL, et c'est utile. Celle-ci suit la convention posée en
--  `0003` et c'est la seule que l'adaptateur appelle.
-- ─────────────────────────────────────────────────────────────────────
create or replace function pokedex_ranger(p jsonb) returns jsonb as $$
  select jsonb_build_object('corrigees', ranger_pokedex());
$$ language sql;

revoke all on function pokedex_ranger(jsonb) from public, anon, authenticated;
grant execute on function pokedex_ranger(jsonb) to service_role;

-- ════════════════════════════════════════════════════════════════════
--  ET LES DEUX ÉCRIVAINS DU POKÉDEX DOIVENT DIRE LA MÊME DATE
--
--  Trouvé en faisant tourner les deux suites de contrat ensemble, le
--  6 octobre. Pris séparément, les tests passaient ; ensemble, le
--  rangement trouvait une correction à faire après chaque clôture.
--
--  La cause : les deux fonctions n'étaient pas d'accord sur ce que
--  `croise_le` veut dire.
--
--    · `appliquer_cloture` écrivait `now()` — **la date de la clôture** ;
--    · `ranger_pokedex` écrit `min(registre.cree_le)` — **la date où le
--      joueur a posté**.
--
--  Donc « zéro est la réponse attendue » aurait été faux en production :
--  chaque passage suivant une clôture aurait annoncé des corrections, et
--  le chiffre serait redevenu du bruit qu'on apprend à ignorer.
--
--  ── C'EST LA DATE DU REGISTRE QUI EST JUSTE ─────────────────────────
--
--  Un RP se clôt des jours, parfois des semaines après avoir été écrit.
--  Le joueur a vu ce Pokémon le jour où il a posté, pas le jour où le
--  staff a validé. La clôture est un acte administratif ; la rencontre
--  est un fait de jeu, et il est daté.
--
--  Et c'est aussi la date REPRODUCTIBLE : elle se recalcule depuis le
--  registre, alors que `now()` dépend du moment où la relève est passée.
--  Même raison que la graine du tirage (planche 45, règle 2).
--
--  ── ON NE TOUCHE PAS AU DOMAINE POUR AUTANT ─────────────────────────
--
--  Les `Effets` du domaine ne portent pas de dates — ils disent QUOI
--  verser, pas QUAND ça s'est produit, et les y ajouter serait une
--  colonne de plus à tenir dans trois fichiers. Or la clôture a déjà le
--  registre sous la main : `v_sujet` et `v_joueur` suffisent à l'y
--  relire. Les deux fonctions lisent donc la même source.
--
--  `coalesce(…, now())` quand même : si une espèce apparaissait dans les
--  effets sans ligne de registre, une date nulle casserait la clôture
--  entière. Le cas ne devrait pas exister — `evaluerCloture` DÉRIVE les
--  effets du registre — mais une clôture qui échoue pour une date est
--  un prix trop élevé.
-- ════════════════════════════════════════════════════════════════════

create or replace function pokedex_date_du_registre(
  p_sujet bigint, p_joueur uuid, p_espece integer, p_type text default null
) returns timestamptz as $$
  select min(r.cree_le)
    from registre r
   where r.sujet_id = p_sujet
     and r.joueur_id = p_joueur
     and (r.charge->>'especeId')::int = p_espece
     and r.type in ('croise', 'capture')
     --  `registre.type` est l'enum `evenement`, pas du texte : on
     --  compare sur sa forme texte plutôt que d'exiger un cast chez
     --  chaque appelant.
     and (p_type is null or r.type::text = p_type)
$$ language sql stable;

-- ─────────────────────────────────────────────────────────────────────
--  `appliquer_cloture`, reprise de `0006` AVEC les dates du registre.
--
--  Le corps est celui de `0006`, extrait par script et modifié aux deux
--  seuls endroits qui écrivaient `now()` dans le pokédex — et il n'y en
--  avait que trois en tout, tous les trois là. Recopier la fonction à la
--  main aurait été l'occasion d'en perdre une ligne : c'est exactement ce
--  qui est arrivé à `ranger_pokedex` entre `0002` et `0004`, et c'est le
--  défaut que cette migration répare.
-- ─────────────────────────────────────────────────────────────────────

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

    update sac s
       set quantite = s.quantite - d.quantite
      from (
        select (e->>'objetId')::int as objet_id, (e->>'quantite')::int as quantite
          from jsonb_array_elements(coalesce(effets->'objetsConsommes', '[]'::jsonb)) e
      ) d
     where s.joueur_id = v_joueur and s.objet_id = d.objet_id;

    insert into sac (joueur_id, objet_id, quantite)
    select v_joueur, (e->>'objetId')::int, (e->>'quantite')::int
      from jsonb_array_elements(coalesce(effets->'objetsAjoutes', '[]'::jsonb)) e
        on conflict (joueur_id, objet_id)
        do update set quantite = sac.quantite + excluded.quantite;

    insert into pokemon (joueur_id, espece_id, niveau, emplacement, capture_dans)
    select v_joueur, (e->>'especeId')::int, (e->>'niveau')::smallint, 'boite', v_sujet
      from jsonb_array_elements(coalesce(effets->'captures', '[]'::jsonb)) e;

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

    update joueur j
       set pokedollars = j.pokedollars + coalesce((effets->>'pokedollars')::int, 0)
     where j.id = v_joueur;

    insert into pokedex (joueur_id, espece_id, croise_le)
    select v_joueur, e::text::int,
           --  LA DATE DU REGISTRE, pas celle de la clôture : voir l'en-tête
           --  de cette section. `ranger_pokedex` lit la même source, et les
           --  deux fonctions disent donc la même date.
           coalesce(
             pokedex_date_du_registre(v_sujet, v_joueur, e::text::int),
             now())
      from jsonb_array_elements(coalesce(effets->'especesCroisees', '[]'::jsonb)) e
        on conflict (joueur_id, espece_id)
        do update set croise_le = least(pokedex.croise_le, excluded.croise_le);

    insert into pokedex (joueur_id, espece_id, croise_le, attrape_le)
    select v_joueur, (e->>'especeId')::int,
           coalesce(
             pokedex_date_du_registre(v_sujet, v_joueur, (e->>'especeId')::int),
             now()),
           coalesce(
             pokedex_date_du_registre(
               v_sujet, v_joueur, (e->>'especeId')::int, 'capture'),
             now())
      from jsonb_array_elements(coalesce(effets->'captures', '[]'::jsonb)) e
        on conflict (joueur_id, espece_id)
        do update set croise_le  = least(pokedex.croise_le, excluded.croise_le),
                      attrape_le = coalesce(pokedex.attrape_le, excluded.attrape_le);
  end loop;

  if n_joueurs = 0 then
    raise exception 'appliquer_cloture : aucun versement pour le sujet %', v_sujet;
  end if;

  --  Le bilan entre en base AVEC la clôture, dans la même transaction.
  --  C'est ce qui garantit qu'un bilan existe toujours pour toute clôture
  --  appliquée, même si le forum est injoignable à cet instant.
  insert into cloture (sujet_id, clos_par, resultat, code, bilan, mentionne)
  values (v_sujet, v_premier, p->'versements', v_code, p->>'bilan', p->>'mentionne');

  return jsonb_build_object('sujetId', v_sujet, 'joueurs', n_joueurs, 'code', v_code);
end $$ language plpgsql security definer;
