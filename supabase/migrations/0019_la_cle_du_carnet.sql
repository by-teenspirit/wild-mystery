-- ════════════════════════════════════════════════════════════════════
--  0019 · La clé du carnet, et l'appel unique de chargement
--
--  ── POURQUOI UNE CLÉ, ET PAS `_userdata.user_id` ────────────────────
--
--  La note de code du carnet (Figma 371:688) dit : « une fonction
--  Supabase carnet(user_id) ». La note d'Écrire (385:1005) dit, sur la
--  même page : « RLS : chacun ne voit que les siens, et personne
--  d'autre — pas même le staff. »
--
--  LES DEUX NE PEUVENT PAS ÊTRE VRAIES ENSEMBLE. Si la fonction reçoit
--  l'identifiant en argument depuis le navigateur, n'importe qui peut
--  passer n'importe quel identifiant : il n'y a plus de RLS, puisque
--  c'est la fonction qui donne l'accès. En changeant un nombre dans la
--  console on lirait les brouillons, le sac, le solde et les boîtes de
--  n'importe quel joueur — et on pourrait réécrire sa fiche.
--  `_userdata` est du code client ; il se forge.
--
--  La planche 33 §2 avait tranché pour un lien de connexion par mail.
--  Décidé le 15 octobre : **une clé personnelle durable**, qui ne
--  demande ni envoi de mail ni configuration d'authentification. Le
--  staff la donne, le joueur la colle une fois, son navigateur la garde.
--  La page existe déjà dans la maquette — « Lier mon compte », 391:1133.
--
--  ── CE QUE CETTE CLÉ N'EST PAS ──────────────────────────────────────
--
--  Ce n'est pas `joueur.jeton`. Celui-là est à USAGE UNIQUE :
--  `lier_compte()` le met à `null` en liant le compte, donc il ne peut
--  pas servir une seconde fois. Les deux cohabitent et ne se
--  remplacent pas : `jeton` lie un compte une fois, `cle_de_carnet`
--  prouve l'identité à chaque appel.
--
--  ── LA SURFACE QU'ON OUVRE, ET POURQUOI ELLE EST SÛRE ───────────────
--
--  `carnet()` est appelable par `anon`. C'est une exception à la
--  planche 56 (« fermer la surface »), et elle est assumée : le
--  navigateur d'un joueur n'a que la clé publiable, il n'a pas de
--  session. Ce qui protège la lecture, c'est **le secret passé en
--  argument**, pas le rôle de l'appelant.
--
--  Trois précautions, et elles comptent :
--
--  1. **128 bits** — `gen_random_bytes(16)` en hexadécimal, 32
--     caractères. `anon` peut appeler autant qu'il veut ; ça ne se
--     devine pas. Une clé plus courte aurait transformé ce choix en
--     défaut.
--  2. **Un refus uniforme.** Une clé inconnue et une clé mal formée
--     lèvent le même `CLE_INVALIDE`, sans dire laquelle des deux :
--     sinon la fonction devient un oracle qui dit si une clé existe.
--  3. **La réponse ne porte jamais la clé**, ni `jeton`. Un carnet
--     affiché sur un écran partagé ne doit pas laisser recopier de quoi
--     y revenir.
--
--  `search_path` est figé sur la fonction : une fonction `security
--  definer` sans `search_path` fixe se fait détourner par un schéma
--  posé devant.
--
--  ── CE QUE LA MIGRATION AJOUTE, ET CE QU'ELLE NE TOUCHE PAS ─────────
--
--  Trois ajouts, tous additifs — aucune donnée existante n'est
--  déplacée :
--
--    · `joueur.cle_de_carnet`      la clé, unique, nullable
--    · `pokemon.boite_no`          1 à 3, la note en veut trois
--    · `pokedex.fois`              le compteur de captures
--
--  **LA PENSION N'A RIEN À MIGRER, et c'était ma crainte.** La note des
--  boîtes veut qu'un pokémon en pension « reste visible à sa place dans
--  l'équipe, en transparence ». Relevé le 15 octobre : la valeur
--  `'pension'` de `pokemon.emplacement` **n'est jamais écrite par
--  personne** — c'est une valeur morte de la contrainte, et la
--  politique de `0001` l'interdit déjà au joueur. L'état « en pension »
--  se lit dans la table `pension`, où `recupere_le is null`. Le pokémon
--  garde donc son `emplacement` et sa `position` pendant tout le dépôt,
--  sans qu'on change une ligne.
-- ════════════════════════════════════════════════════════════════════

-- ── 1 · la clé personnelle ──────────────────────────────────────────

alter table joueur add column if not exists cle_de_carnet text unique;

comment on column joueur.cle_de_carnet is
  'Secret durable de 32 caractères hexadécimaux (128 bits). Prouve '
  'l''identité du joueur à chaque appel du carnet. À ne pas confondre '
  'avec `jeton`, qui lie un compte UNE SEULE FOIS et s''efface ensuite. '
  'Ne sort jamais dans une réponse de fonction.';

--  Le staff la pose et peut la renouveler. `service_role` seulement :
--  un joueur ne se donne pas sa propre clé, et surtout il ne s'en donne
--  pas une pour le compte d'un autre.
create or replace function carnet_nouvelle_cle(p jsonb)
returns jsonb as $$
declare
  v_forum integer := (p->>'forumUserId')::integer;
  v_cle   text    := encode(gen_random_bytes(16), 'hex');
  v_id    uuid;
begin
  if v_forum is null then
    raise exception 'FORUM_USER_ID_MANQUANT';
  end if;

  update joueur set cle_de_carnet = v_cle
   where forum_user_id = v_forum
   returning id into v_id;

  if v_id is null then
    raise exception 'JOUEUR_INTROUVABLE';
  end if;

  --  C'est le SEUL endroit où une clé sort de la base. Le staff la
  --  transmet au joueur, et elle n'est plus jamais lisible ensuite :
  --  renouveler est la seule façon d'en retrouver une.
  return jsonb_build_object('joueurId', v_id, 'cle', v_cle);
end $$ language plpgsql security definer set search_path = public;

revoke all on function carnet_nouvelle_cle(jsonb) from public;
revoke all on function carnet_nouvelle_cle(jsonb) from anon, authenticated;
grant execute on function carnet_nouvelle_cle(jsonb) to service_role;

-- ── 2 · résoudre une clé, une seule fois et au même endroit ─────────

--  Toutes les fonctions du carnet passeront par celle-ci. Écrire la
--  résolution dans chacune d'elles, c'est se donner huit occasions
--  d'oublier le refus uniforme.
create or replace function carnet_joueur(p_cle text)
returns uuid as $$
declare v_id uuid;
begin
  --  La longueur est vérifiée AVANT la requête : une clé de trois
  --  caractères ne mérite pas un aller-retour en base, et surtout le
  --  refus doit être le même que pour une clé bien formée mais fausse.
  if p_cle is null or p_cle !~ '^[0-9a-f]{32}$' then
    raise exception 'CLE_INVALIDE';
  end if;

  select id into v_id from joueur where cle_de_carnet = p_cle;

  if v_id is null then
    raise exception 'CLE_INVALIDE';
  end if;

  return v_id;
end $$ language plpgsql security definer set search_path = public;

revoke all on function carnet_joueur(text) from public;
revoke all on function carnet_joueur(text) from anon, authenticated;
grant execute on function carnet_joueur(text) to service_role;

-- ── 3 · les deux colonnes que la maquette réclame ───────────────────

--  TROIS BOÎTES, pas une. La note (387:1075) dit « boite vaut 0 pour
--  l'équipe, 1 à 3 pour les boîtes ». La base n'avait qu'un seul
--  `'boite'` : tout le monde partageait la même.
--
--  On garde `emplacement` — c'est lui que la politique de `0001`
--  vérifie — et on ajoute le numéro à côté. Les lignes existantes vont
--  en boîte 1, ce qui est exactement là où elles étaient.
alter table pokemon add column if not exists boite_no smallint not null default 1;

do $$ begin
  alter table pokemon add constraint pokemon_boite_no_check
    check (boite_no between 1 and 3);
exception when duplicate_object then null; end $$;

comment on column pokemon.boite_no is
  'La boîte, de 1 à 3. Ignoré quand `emplacement` vaut ''equipe'' : '
  'l''équipe a ses six places, portées par `position`.';

--  L'unicité d'une case de boîte. Celle de l'équipe existe déjà en
--  `0001` (`joueur_id, position` où `emplacement = 'equipe'`) ; il
--  manquait la même garantie dans les boîtes, numéro compris.
create unique index if not exists pokemon_case_de_boite
  on pokemon (joueur_id, boite_no, position)
  where emplacement = 'boite' and position is not null;

--  LE COMPTEUR DE CAPTURES. La note du Pokédex (389:1123) décrit
--  `pokedex(joueur, espece, vu_le, attrape_le, fois)`. `vu_le` est le
--  `croise_le` d'ici, sous un autre nom ; `fois` n'existait pas.
alter table pokedex add column if not exists fois integer not null default 0;

do $$ begin
  alter table pokedex add constraint pokedex_fois_check check (fois >= 0);
exception when duplicate_object then null; end $$;

comment on column pokedex.fois is
  'Combien de fois l''espèce a été attrapée. Incrémenté par la fonction '
  'qui tranche une capture, jamais saisi.';

-- ── 4 · l'appel unique de chargement ────────────────────────────────

--  UN SEUL APPEL, et c'est la contrainte principale de la maquette :
--  « changer d'onglet ne déclenche aucune requête » (371:688). Donc
--  tout part d'ici, en un objet.
--
--  Ce qui n'y est PAS, et c'est voulu : les brouillons, la fiche, les
--  liens et la chronologie. Ils arrivent avec les tables d'écriture, et
--  les mettre ici maintenant ferait grossir une fonction qu'il faudrait
--  réécrire la semaine suivante.
create or replace function carnet(p jsonb)
returns jsonb as $$
declare
  v_joueur uuid := carnet_joueur(p->>'cle');
begin
  return jsonb_build_object(
    --  LE DRESSEUR. Ni `cle_de_carnet` ni `jeton` : voir l'en-tête.
    'dresseur', (
      select jsonb_build_object(
        'joueurId',    j.id,
        'forumUserId', j.forum_user_id,
        'pseudo',      j.pseudo,
        'groupe',      j.groupe,
        'palier',      j.palier,
        'pokedollars', j.pokedollars,
        'lieLe',       j.lie_le
      ) from joueur j where j.id = v_joueur
    ),

    --  L'ÉQUIPE ET LES BOÎTES, dans la même liste. Les séparer en deux
    --  requêtes obligerait le navigateur à les recoller, et il les
    --  affiche déjà dans la même grille.
    --
    --  `enPension` se lit dans `pension`, PAS dans `emplacement` : le
    --  pokémon garde sa place pendant le dépôt (voir l'en-tête).
    'pokemon', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',          k.id,
        'especeId',    k.espece_id,
        'surnom',      k.surnom,
        'niveau',      k.niveau,
        'xp',          k.xp,
        'sexe',        k.sexe,
        'obscur',      k.obscur,
        'etoiles',     k.etoiles,
        'emplacement', k.emplacement,
        'boite',       case when k.emplacement = 'equipe' then 0 else k.boite_no end,
        'place',       k.position,
        'captureLe',   k.capture_le,
        'captureDans', k.capture_dans,
        'enPension',   exists (
          select 1 from pension s
           where s.pokemon_id = k.id and s.recupere_le is null
        )
      ) order by
        case k.emplacement when 'equipe' then 0 else 1 end,
        k.boite_no,
        k.position nulls last)
      from pokemon k where k.joueur_id = v_joueur
    ), '[]'::jsonb),

    --  LA PENSION. Ce que le dépôt doit dire, et rien de plus : quel
    --  pokémon, chez qui, depuis quand, pour combien.
    'pension', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',            s.id,
        'pokemonId',     s.pokemon_id,
        'gerantId',      s.gerant_id,
        'deposeLe',      s.depose_le,
        'niveauAuDepot', s.niveau_au_depot,
        'tarif',         s.tarif
      ) order by s.depose_le)
      from pension s
       where s.joueur_id = v_joueur and s.recupere_le is null
    ), '[]'::jsonb),

    'badges', coalesce((
      select jsonb_agg(jsonb_build_object('arene', b.arene, 'obtenuLe', b.obtenu_le)
             order by b.obtenu_le)
      from badge b where b.joueur_id = v_joueur
    ), '[]'::jsonb),

    --  LE SAC. La note l'appelle `inventaire` ; c'est la table `sac`,
    --  sous un autre nom. On n'a rien renommé : une table qui change de
    --  nom casse tout ce qui la lisait, pour un mot.
    --
    --  Les lignes à zéro ne sortent pas : un objet entièrement dépensé
    --  n'est plus dans le sac, et le laisser à 0 afficherait une case
    --  vide que personne ne sait lire.
    'sac', coalesce((
      select jsonb_agg(jsonb_build_object('objetId', a.objet_id, 'quantite', a.quantite)
             order by a.objet_id)
      from sac a where a.joueur_id = v_joueur and a.quantite > 0
    ), '[]'::jsonb),

    'pokedex', coalesce((
      select jsonb_agg(jsonb_build_object(
        'especeId',  d.espece_id,
        'croiseLe',  d.croise_le,
        'attrapeLe', d.attrape_le,
        'fois',      d.fois
      ) order by d.espece_id)
      from pokedex d where d.joueur_id = v_joueur
    ), '[]'::jsonb),

    --  LE DERNIER JET, avec son code de vérification. La page n'en
    --  vérifie rien : elle l'affiche, et le code se rejoue côté serveur.
    'dernierJet', (
      select jsonb_build_object(
        'messageId', r.message_id,
        'sujetId',   r.sujet_id,
        'type',      r.type,
        'charge',    r.charge,
        --  LE CODE DE VÉRIFICATION, et il est le cœur de l'affaire : la
        --  page ne vérifie RIEN elle-même, elle affiche le code et
        --  renvoie vers la fonction qui rejoue le calcul côté serveur.
        --  L'oublier ici rendrait le dernier jet décoratif.
        'code',      r.code,
        'creeLe',    r.cree_le
      )
      from registre r
       where r.joueur_id = v_joueur
       order by r.cree_le desc, r.message_id desc
       limit 1
    )
  );
end $$ language plpgsql security definer set search_path = public;

--  L'EXCEPTION ASSUMÉE : `anon` peut l'appeler. C'est le secret passé
--  en argument qui protège, pas le rôle — voir l'en-tête. `public` est
--  révoqué d'abord parce que PostgreSQL accorde `execute to public` par
--  défaut, et que `0012` a déjà payé cet oubli une fois.
revoke all on function carnet(jsonb) from public;
grant execute on function carnet(jsonb) to anon, authenticated, service_role;
