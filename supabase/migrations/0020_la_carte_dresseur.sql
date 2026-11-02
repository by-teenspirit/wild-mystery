-- ════════════════════════════════════════════════════════════════════
--  0020 · La carte dresseur, lisible par tout le monde
--
--  ── LE PROBLÈME QU'ELLE RÉSOUT ──────────────────────────────────────
--
--  « Si on change son équipe, la trainer card doit être actualisée, ou
--  alors ça génère un code à coller dans la trainer card, ou ça envoie
--  une demande au staff — le mieux ce serait que ce soit automatique »,
--  2 novembre. Automatique a été choisi.
--
--  Une carte collée en BBCode est juste le jour où on la colle. Le
--  lendemain, l'équipe a changé et la carte ment, dans tous les
--  messages où elle a été collée. Recoller à chaque capture n'arrive
--  pas, et une demande au staff fait du travail humain pour une donnée
--  que la base connaît déjà.
--
--  Donc : le joueur ne colle pas une carte, il colle un MARQUEUR. Le
--  script du forum le remplit à chaque affichage, et la carte est
--  juste partout, tout le temps, sans que personne y revienne.
--
--  ── POURQUOI CETTE FONCTION EST PUBLIQUE, ET CE QUE ÇA COÛTE ────────
--
--  `carnet()` ne convient pas : il demande la clé personnelle, et la
--  carte est lue par les AUTRES. Un joueur qui ouvre un sujet doit voir
--  la carte de l'auteur, et il n'a pas sa clé — heureusement.
--
--  C'est donc une seconde exception à la planche 56 (« fermer la
--  surface »), et elle est plus faible que celle de `0019` : il n'y a
--  pas de secret, seulement un `forum_user_id`, qui s'énumère (u1, u2,
--  u3…). Ce qui la rend acceptable, c'est que **tout ce qu'elle rend
--  est déjà affiché dans le message où la carte est collée**. Elle ne
--  donne pas un accès, elle évite un copier-coller.
--
--  Quatre précautions, et chacune retire quelque chose :
--
--  1. **Elle ne rend que ce que la carte montre.** Pas le sac, pas le
--     Pokédex, pas la pension, pas le dernier jet, pas les boîtes —
--     même si le joueur les a. Une fonction publique qui rend tout
--     l'état d'un joueur serait `carnet()` sans la clé.
--  2. **Ni `cle_de_carnet`, ni `jeton`, ni `id`.** Le `uuid` interne ne
--     sort pas : il est l'argument de tout ce qui écrit ailleurs, et
--     une carte affichée sur un écran partagé n'a pas à le montrer.
--  3. **Les pokémon des boîtes ne sortent pas.** La carte montre
--     l'équipe. Ce qu'un joueur garde en boîte est à lui.
--  4. **Un joueur inconnu rend `null`, pas une erreur.** Un marqueur
--     collé par quelqu'un qui n'a pas encore de compte de jeu doit
--     s'effacer proprement, pas peindre une erreur dans un message.
--
--  `search_path` est figé, comme partout : une fonction `security
--  definer` sans `search_path` fixe se fait détourner par un schéma
--  posé devant.
-- ════════════════════════════════════════════════════════════════════

create or replace function carte_dresseur(p jsonb)
returns jsonb as $$
declare
  v_forum  integer := (p->>'forumUserId')::integer;
  v_joueur uuid;
begin
  if v_forum is null then
    raise exception 'FORUM_USER_ID_MANQUANT';
  end if;

  select id into v_joueur from joueur where forum_user_id = v_forum;

  --  PAS D'ERREUR POUR UN INCONNU : voir l'en-tête, précaution 4.
  if v_joueur is null then
    return null;
  end if;

  return jsonb_build_object(
    'forumUserId', v_forum,
    'pseudo',      (select pseudo      from joueur where id = v_joueur),
    'groupe',      (select groupe      from joueur where id = v_joueur),
    'palier',      (select palier      from joueur where id = v_joueur),
    'pokedollars', (select pokedollars from joueur where id = v_joueur),

    --  LES BADGES OBTENUS, et seulement eux. La carte dessine les huit
    --  arènes ; celles qui manquent se déduisent de celles qui sont là,
    --  et la liste des arènes est une donnée du dépôt, pas de la base.
    'badges', coalesce((
      select jsonb_agg(jsonb_build_object('arene', b.arene, 'obtenuLe', b.obtenu_le)
             order by b.obtenu_le)
      from badge b where b.joueur_id = v_joueur
    ), '[]'::jsonb),

    --  L'ÉQUIPE SEULE. `emplacement = 'equipe'` : les boîtes restent
    --  privées (précaution 3). `enPension` se lit dans `pension`, comme
    --  dans `carnet()` — un pokémon déposé garde sa place et la carte
    --  doit pouvoir le dire plutôt que de laisser un trou.
    'equipe', coalesce((
      select jsonb_agg(jsonb_build_object(
        'especeId',  k.espece_id,
        'surnom',    k.surnom,
        'niveau',    k.niveau,
        'sexe',      k.sexe,
        'obscur',    k.obscur,
        'place',     k.position,
        'enPension', exists (
          select 1 from pension s
           where s.pokemon_id = k.id and s.recupere_le is null
        )
      ) order by k.position nulls last)
      from pokemon k
       where k.joueur_id = v_joueur and k.emplacement = 'equipe'
    ), '[]'::jsonb)
  );
end $$ language plpgsql security definer set search_path = public;

--  `public` est révoqué d'abord parce que PostgreSQL accorde `execute
--  to public` par défaut, et que `0012` a déjà payé cet oubli une fois.
revoke all on function carte_dresseur(jsonb) from public;
grant execute on function carte_dresseur(jsonb) to anon, authenticated, service_role;

comment on function carte_dresseur(jsonb) is
  'Lecture PUBLIQUE et étroite pour la carte dresseur collée dans un '
  'message : identité, palier, pokédollars, badges obtenus, équipe. '
  'Rien d''autre, et jamais l''uuid interne ni une clé. Voir l''en-tête '
  'de la migration 0020 pour ce que cette ouverture coûte.';
