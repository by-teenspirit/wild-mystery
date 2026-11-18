-- ════════════════════════════════════════════════════════════════════
--  0052 · Les sprites des cartes
--
--  « Ce serait bien d'avoir une petite card, l'image des pokémons,
--  avec les infos » — 18 novembre, en regardant la carte du Debugant
--  sur t1000.
--
--  ── POURQUOI UNE MIGRATION POUR UNE IMAGE ───────────────────────────
--
--  Parce que le serveur ne peut pas deviner l'adresse du sprite : elle
--  se construit sur le NUMÉRO D'ESPÈCE, et les deux files ne le
--  rendaient pas. Elles rendaient le nom — « Ponyta » — et un nom ne
--  désigne pas un fichier.
--
--  Les deux jointures l'avaient déjà sous la main (`es.id`, `ep.id`) :
--  il n'y a donc rien de nouveau à lire, juste une clé de plus dans
--  l'objet. Aucune colonne, aucun index, aucune politique.
--
--  ── ET POURQUOI PAS L'ADRESSE ELLE-MÊME ─────────────────────────────
--
--  Une base qui rendrait « https://…/37.png » saurait où le dépôt est
--  servi. Elle ne le sait pas, elle ne doit pas le savoir, et le jour
--  où la racine change il faudrait une migration pour déplacer des
--  images. Le numéro est la donnée ; l'adresse est une mise en forme,
--  et la mise en forme vit dans `src/application/sprite.ts`.
-- ════════════════════════════════════════════════════════════════════

-- ════════════════════════════════════════════════════════════════════
--  LA FILE DES CARTES — la même, avec `especeId` des deux côtés
-- ════════════════════════════════════════════════════════════════════

create or replace function cartes_a_poster(p jsonb)
returns jsonb as $$
  select coalesce(jsonb_agg(c order by c.ouvert_le), '[]'::jsonb)
    from (
      select jsonb_build_object(
        'combatId',  cb.id,
        'sujetId',   cb.sujet_id,
        'messageId', cb.message_id,
        'essais',    cb.carte_essais,
        'mentionne', j.pseudo,
        'sauvage', jsonb_build_object(
          'especeId', es.id,
          'nom',     es.nom_fr,
          'niveau',  cb.niveau_sauvage,
          'types',   to_jsonb(es.types),
          --  LES PV RESTANTS, pas le maximum : si la carte repart
          --  après un tour déjà joué — ce qui n'arrive qu'en cas
          --  d'incident —, elle doit dire l'état réel, pas celui de
          --  l'ouverture.
          'pv',      cb.pv_sauvage,
          'attaque', stat_au_niveau(es.att_base, cb.niveau_sauvage),
          'defense', stat_au_niveau(es.def_base, cb.niveau_sauvage)
        ),
        'combattant', case when pk.id is null then null else jsonb_build_object(
          'especeId', ep.id,
          'nom',     ep.nom_fr,
          'surnom',  pk.surnom,
          'niveau',  pk.niveau,
          'types',   to_jsonb(ep.types),
          'pv',      cb.pv_pokemon,
          'pvMax',   cb.pv_pokemon_max,
          'attaque', stat_au_niveau(ep.att_base, pk.niveau),
          'defense', stat_au_niveau(ep.def_base, pk.niveau)
        ) end
      ) as c, cb.ouvert_le
      from combat cb
      join joueur j  on j.id = cb.joueur_id
      join espece es on es.id = cb.espece_id
      left join pokemon pk on pk.id = cb.pokemon_id
      left join espece  ep on ep.id = pk.espece_id
      --  ON NE POSTE QUE LES COMBATS OUVERTS. Un combat clos avant que
      --  sa carte ne parte — le sujet clôturé entre-temps — n'a plus
      --  de carte à poster : annoncer « à toi de jouer » dans un sujet
      --  fermé serait pire que le silence.
      where cb.carte_poste_le is null and cb.etat = 'ouvert'
      order by cb.ouvert_le
      limit greatest(1, least(coalesce((p->>'combien')::integer, 10), 50))
    ) c;
$$ language sql stable security definer set search_path = public, extensions;

revoke all on function cartes_a_poster(jsonb) from public;
grant execute on function cartes_a_poster(jsonb) to service_role;

-- ════════════════════════════════════════════════════════════════════
--  LA FILE DES TOURS — la même, avec `especeId` des deux côtés
--
--  LE TOUR EN A BESOIN AUTANT QUE LA CARTE : c'est le message qu'on lit
--  cinq fois de suite dans un combat, et c'est celui où l'on veut voir
--  d'un coup d'œil qui tient debout.
-- ════════════════════════════════════════════════════════════════════

create or replace function tours_a_poster(p jsonb)
returns jsonb as $$
  select coalesce(jsonb_agg(x order by x->>'joueLe'), '[]'::jsonb)
    from (
      select jsonb_build_object(
        'tourId',    t.id,
        'combatId',  t.combat_id,
        'sujetId',   cb.sujet_id,
        'messageId', t.message_id,
        'numero',    t.numero,
        'demande',   t.demande,
        'detail',    t.detail,
        'recit',     t.recit,
        'fin',       t.fin,
        'essais',    t.carte_essais,
        'mentionne', j.pseudo,
        'joueLe',    t.joue_le,
        'sauvage',   jsonb_build_object(
          'especeId', es.id,
          'nom',   es.nom_fr,
          'pv',    t.pv_sauvage,
          'pvMax', cb.pv_sauvage_max
        ),
        'combattant', case when pk.id is null then null else jsonb_build_object(
          'especeId', ep.id,
          'nom',    ep.nom_fr,
          'surnom', pk.surnom,
          'pv',     t.pv_joueur,
          'pvMax',  cb.pv_pokemon_max
        ) end
      ) as x, t.joue_le
      from combat_tour t
      join combat cb on cb.id = t.combat_id
      join joueur  j on j.id = cb.joueur_id
      join espece es on es.id = cb.espece_id
      left join pokemon pk on pk.id = cb.pokemon_id
      left join espece  ep on ep.id = pk.espece_id
      --  ON POSTE MÊME LE TOUR QUI A FINI LE COMBAT, contrairement aux
      --  cartes de rencontre : c'est lui qui annonce la victoire. Un
      --  combat gagné sans message serait un combat qui s'arrête sans
      --  qu'on sache pourquoi.
      where t.carte_poste_le is null
      order by t.joue_le
      limit greatest(1, least(coalesce((p->>'combien')::integer, 10), 50))
    ) y;
$$ language sql stable security definer set search_path = public, extensions;

revoke all on function tours_a_poster(jsonb) from public;
grant execute on function tours_a_poster(jsonb) to service_role;

comment on function cartes_a_poster(jsonb) is
  'Les cartes de rencontre qui attendent d''être postées, avec le '
  'numéro d''espèce des deux combattants — c''est lui qui donne '
  'l''adresse du sprite. La carte se recompose à chaque passage : '
  'son texte n''est pas stocké.';
comment on function tours_a_poster(jsonb) is
  'Les tours joués qui attendent leur message, avec le numéro '
  'd''espèce des deux combattants.';
