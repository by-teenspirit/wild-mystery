-- ════════════════════════════════════════════════════════════════════
--  0053 · Les Pokémon du bilan
--
--  « Ce serait bien d'habiller plus proprement le bilan du sujet avec
--  un sprite » — 18 novembre. Et en allant le faire, une faute s'est
--  montrée.
--
--  ── LE BILAN AFFICHAIT DES UUID ─────────────────────────────────────
--
--  `Effets.xpParPokemon` est une table dont la CLÉ EST L'IDENTIFIANT
--  du Pokémon — `cloture.ts` ligne 16 : `{ type: "xp", pokemonId,
--  gain }`. `cloturer-un-sujet.ts` la recopiait telle quelle dans la
--  ligne de bilan, sous un champ nommé `pokemon`, et `redigerLeBilan`
--  l'écrivait :
--
--      EXPÉRIENCE : 3f2a7c1e-… +48
--
--  LE TEST NE POUVAIT PAS LE DIRE : son décor écrivait
--  `{ pokemon: "Lumi", gain: 48 }`, un NOM, là où l'appelant passe un
--  identifiant. Un faux doit ressembler à ce qu'il remplace — c'est la
--  troisième fois cette semaine, et la troisième forme différente.
--
--  Aucun joueur ne l'a vu : aucune clôture n'a encore versé
--  d'expérience sur le forum. Mais le premier bilan complet l'aurait
--  montré, et le commentaire d'`EtatDuJeu.pseudoDe` disait déjà la
--  règle à deux lignes de là : « un bilan doit nommer les gens, pas
--  afficher leur identifiant : personne ne se reconnaît dans un UUID ».
--
--  ── CE QUE CETTE FONCTION REND ──────────────────────────────────────
--
--  De quoi NOMMER et DESSINER un Pokémon dont on n'a que l'identifiant :
--  son espèce, son surnom, et le numéro d'espèce pour le sprite.
--
--  EN UN SEUL APPEL POUR TOUTE LA LISTE, et c'est le point : un bilan
--  de clôture à quatre joueurs qui ont chacun fait combattre trois
--  Pokémon ferait douze allers-retours, dans une fonction Edge qui
--  tourne toutes les cinq minutes.
--
--  ── ELLE NE DEMANDE PAS QUI EST LE JOUEUR ───────────────────────────
--
--  Volontairement. Elle est accordée à `service_role` SEUL — la relève
--  — et jamais à `anon` ni à `authenticated` : ce qu'elle rend
--  (surnoms) appartient à son propriétaire, et une fonction qui rend
--  les surnoms de n'importe qui n'a rien à faire à portée d'un
--  navigateur.
-- ════════════════════════════════════════════════════════════════════

create or replace function pokemon_nommes(p jsonb)
returns jsonb as $$
  select coalesce(
    jsonb_agg(jsonb_build_object(
      'pokemonId', pk.id,
      'especeId',  e.id,
      'nom',       e.nom_fr,
      'surnom',    pk.surnom
    ) order by pk.capture_le),
    '[]'::jsonb
  )
  from pokemon pk
  join espece e on e.id = pk.espece_id
  --  `jsonb_array_elements_text` PLUTÔT QU'UN `text[]` : tout passe par
  --  un seul corps JSON (voir le garde-fou n° 38), donc la liste arrive
  --  en tableau JSON et pas en tableau PostgreSQL.
  where pk.id::text in (
    select jsonb_array_elements_text(coalesce(p->'pokemonIds', '[]'::jsonb))
  );
$$ language sql stable security definer set search_path = public, extensions;

revoke all on function pokemon_nommes(jsonb) from public;
grant execute on function pokemon_nommes(jsonb) to service_role;

comment on function pokemon_nommes(jsonb) is
  'De quoi nommer et dessiner des Pokémon dont on n''a que '
  'l''identifiant : espèce, surnom, numéro d''espèce pour le sprite. '
  'Sert au bilan de clôture, qui écrivait l''UUID. Un seul appel pour '
  'toute la liste. Accordée à la relève seule : elle rend des surnoms, '
  'et ceux-ci appartiennent à leur propriétaire.';
