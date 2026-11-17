-- ════════════════════════════════════════════════════════════════════
--  0043 · La dotation de départ
--
--  « Personne n'aura une équipe vide : à la validation, il reçoit son
--  premier pokémon. Tout le monde commence aussi avec un sac qui a des
--  trucs de base : quelques potions, quelques pokeballs, un peu
--  d'argent. » — 17 novembre 2026. Puis : « pour le moment, 5 potions,
--  5 pokéballs, 1000 PD ».
--
--  ── POURQUOI ÇA NE POUVAIT PAS ATTENDRE LE COMBAT ───────────────────
--
--  Le combat se joue entre le PREMIER POKÉMON DE L'ÉQUIPE et le
--  sauvage. Aujourd'hui `valider_le_personnage` crée la ligne `joueur`
--  et rien d'autre : pas de pokémon, pas de sac, zéro pokédollar. Tout
--  le monde arrivait donc en combat sans rien, et la seule façon
--  honnête d'écrire le moteur était d'y poser un cas « équipe vide »
--  qui n'a plus lieu d'être. Mieux vaut que la règle soit vraie que
--  qu'elle soit contournée.
--
--  ── LA GARDE QUI COMPTE : ON NE DOTE QU'UNE FOIS ────────────────────
--
--  `valider_le_personnage` se relance. Elle se relance même souvent —
--  c'est comme ça qu'on corrige un groupe ou une adresse, et le doc
--  t1003 le dit aux admins. Sans garde, chaque relance rendrait cinq
--  potions de plus et mille pokédollars de plus.
--
--  `v_neuf` NE SUFFIT PAS, et c'est le piège qu'il fallait éviter :
--  les joueurs créés AVANT cette migration ne sont pas neufs et n'ont
--  rien reçu. Une garde sur « la ligne vient d'être créée » les
--  laisserait sans starter pour toujours.
--
--  D'où `joueur.dote_le` : la dotation a lieu quand elle est nulle, et
--  jamais ensuite. Elle se lit, elle se date, et on peut répondre à
--  « est-ce que ce joueur a reçu ses affaires » sans compter son sac.
--
--  ── SANS STARTER, PAS DE DOTATION DU TOUT ───────────────────────────
--
--  Le starter est CHOISI par le joueur (décision de Callista : « la
--  personne choisit son starter »), donc il arrive en paramètre. Quand
--  il manque, on ne donne NI le sac NI l'argent : sinon `dote_le`
--  serait posée, et le pokémon ne pourrait plus jamais arriver. La
--  réponse le dit, et l'admin relance avec le starter.
--
--  ── CE QUE LA DOTATION NE DÉCIDE PAS ────────────────────────────────
--
--  La LISTE des starters autorisés n'est pas ici. Elle est éditoriale
--  — « liste des starters » dans le guide de présentation — et elle
--  bougera. Ce qui est gardé ici est ce que la base peut garantir :
--  l'espèce existe, et elle est une forme de BASE. Un Dracaufeu de
--  départ est une faute de frappe, pas un choix.
-- ════════════════════════════════════════════════════════════════════

alter table joueur add column if not exists dote_le timestamptz;

comment on column joueur.dote_le is
  'Quand le joueur a reçu sa dotation de départ. Nulle = pas encore '
  'dotée. C''est la garde qui empêche une seconde validation de rendre '
  'un second starter.';

create or replace function valider_le_personnage(p jsonb)
returns jsonb as $$
declare
  v_forum    integer := (p->>'forumUserId')::integer;
  v_pseudo   text    := btrim(p->>'pseudo');
  v_groupe   text    := p->>'groupe';
  --  `lower(trim(…))`, ET PAS `btrim` SEUL. La 0041 range l'adresse en
  --  minuscules parce que `lier_mon_personnage` la cherche en
  --  minuscules ; mon premier jet n'avait gardé que le `trim`, et la
  --  suite pgTAP a rendu « ESSAI@Exemple.FR » là où elle attendait
  --  « essai@exemple.fr ».
  --
  --  DEUXIÈME FOIS DANS LA MÊME FONCTION, et c'est la leçon :
  --  RÉÉCRIRE UNE FONCTION EN ENTIER RAMÈNE TOUT CE QU'ON N'A PAS
  --  RELU. Les six maisons étaient reparties aux anciens noms pour
  --  exactement la même raison.
  v_courriel text    := lower(trim(p->>'courriel'));
  v_starter  integer := nullif(p->>'starter', '')::integer;
  v_id       uuid;
  v_neuf     boolean := false;
  v_cle      text;
  v_a_adresse boolean;
  v_dote     timestamptz;
  v_stade    smallint;
  v_dotee    boolean := false;
begin
  if v_forum is null or v_forum <= 0 then
    raise exception 'FORUM_USER_ID_MANQUANT';
  end if;
  --  LES SIX MAISONS, DANS LEURS NOMS D'AUJOURD'HUI. Mon premier jet
  --  recopiait la liste de la TABLE (`0001`) — les noms légendaires
  --  d'origine — au lieu de celle de la FONCTION. Une fonction
  --  réécrite en entier ramène tout ce qu'on n'a pas relu : la suite
  --  pgTAP l'a dit à la ligne suivante, « GROUPE_INCONNU » sur
  --  « doux ».
  if v_groupe is not null and v_groupe not in
     ('hardi', 'serieux', 'malin', 'doux', 'brave', 'jovial') then
    raise exception 'GROUPE_INCONNU';
  end if;

  update joueur
     set groupe   = v_groupe,
         pseudo   = coalesce(nullif(v_pseudo, ''), pseudo),
         courriel = coalesce(nullif(v_courriel, ''), courriel)
   where forum_user_id = v_forum
   returning id into v_id;

  if v_id is null then
    if v_pseudo is null or v_pseudo = '' then
      raise exception 'PSEUDO_MANQUANT';
    end if;
    insert into joueur (forum_user_id, pseudo, groupe, courriel)
    values (v_forum, v_pseudo, v_groupe, nullif(v_courriel, ''))
    returning id into v_id;
    v_neuf := true;
  end if;

  --  LA CLÉ, POSÉE SEULEMENT SI ELLE MANQUE. `coalesce` ne suffirait
  --  pas : il faut ÉCRIRE celle qu'on vient de tirer, et ne rien
  --  écrire quand il y en a déjà une.
  select cle_de_carnet, courriel is not null and courriel <> '', dote_le
    into v_cle, v_a_adresse, v_dote
    from joueur where id = v_id;
  if v_cle is null then
    v_cle := encode(gen_random_bytes(16), 'hex');
    update joueur set cle_de_carnet = v_cle where id = v_id;
  end if;

  -- ── LA DOTATION ─────────────────────────────────────────────────
  if v_dote is null and v_starter is not null then
    select stade into v_stade from espece where id = v_starter;
    if v_stade is null then
      raise exception 'STARTER_INCONNU';
    end if;
    if v_stade <> 1 then
      raise exception 'STARTER_PAS_UNE_FORME_DE_BASE';
    end if;

    --  LE STARTER VA DANS L'ÉQUIPE, EN PREMIÈRE POSITION : c'est lui
    --  qui combattra, et un starter rangé en boîte serait un starter
    --  qu'on ne trouve pas.
    insert into pokemon (joueur_id, espece_id, emplacement, position)
    values (v_id, v_starter, 'equipe', 1);

    --  ET AU POKÉDEX, attrapé. Il est à lui : le cacher du Pokédex
    --  ferait mentir le premier chiffre que le joueur verra.
    insert into pokedex (joueur_id, espece_id, croise_le, attrape_le)
    values (v_id, v_starter, now(), now())
    on conflict (joueur_id, espece_id)
      do update set attrape_le = coalesce(pokedex.attrape_le, now());

    --  LE SAC. 990001 = Poké Ball, 990020 = Potion, au catalogue.
    --  Les cinq et les cinq sont les chiffres de Callista du
    --  17 novembre — « pour le moment », donc ils bougeront.
    insert into sac (joueur_id, objet_id, quantite)
    values (v_id, 990001, 5), (v_id, 990020, 5)
    on conflict (joueur_id, objet_id)
      do update set quantite = sac.quantite + excluded.quantite;

    --  ON AJOUTE, ON N'ÉCRASE PAS. Un joueur créé avant cette
    --  migration peut avoir gagné des pokédollars en jouant ; les
    --  remettre à mille les lui retirerait.
    update joueur
       set pokedollars = pokedollars + 1000,
           dote_le     = now()
     where id = v_id;
    v_dotee := true;
  end if;

  return jsonb_build_object(
    'joueurId', v_id,
    'creee',    v_neuf,
    'groupe',   v_groupe,
    --  CE QU'IL FAUT COLLER dans « clé de liaison », côté profil du
    --  membre. C'est le seul endroit d'où elle sort.
    'cle',      v_cle,
    --  ET CE QU'IL FAUT SAVOIR TOUT DE SUITE : sans adresse, ce
    --  personnage ne pourra pas ouvrir son carnet, quoi qu'il tente.
    'peutSeLier', v_a_adresse,
    --  LA DOTATION, DITE EN CLAIR. `false` avec `dejaDote` à `false`
    --  veut dire « il manque le starter » : l'admin relance avec.
    'dote',      v_dotee,
    'dejaDote',  v_dote is not null
  );
end $$ language plpgsql security definer set search_path = public, extensions;

revoke all on function valider_le_personnage(jsonb) from public;
revoke all on function valider_le_personnage(jsonb) from anon, authenticated;
grant execute on function valider_le_personnage(jsonb) to service_role;

comment on function valider_le_personnage(jsonb) is
  'Valide un personnage : crée ou met à jour sa ligne, pose sa clé de '
  'carnet, et lui remet UNE SEULE FOIS sa dotation de départ — le '
  'starter choisi en première place de l''équipe, cinq Poké Ball, cinq '
  'Potions et mille pokédollars. Sans starter, aucune dotation : la '
  'date resterait nulle et le pokémon n''arriverait jamais.';
