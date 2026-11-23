-- ════════════════════════════════════════════════════════════════════
--  0062 · La barre connaît le duel
--
--  Les deux lots précédents ont donné au duel sa charpente (0060) et sa
--  frappe qui alterne (0061). Il manquait la seule chose qui le rende
--  jouable : DES BOUTONS, et pas pour un joueur sur deux.
--
--  ── `mon_combat` NE VOYAIT QU'UN CÔTÉ ───────────────────────────────
--
--      where sujet_id = v_sujet and etat = 'ouvert' and joueur_id = v_moi
--
--  Cette ligne, écrite dans la `0051`, était juste tant qu'un combat
--  n'avait qu'un joueur. Depuis la `0060` il en a deux, et
--  `adverse_joueur_id` n'est pas `joueur_id` : l'adversaire d'un duel
--  obtenait `null`, donc aucun bouton, donc **le duel était injouable
--  pour celui qui l'avait accepté.**
--
--  C'est le genre de faute qui ne lève jamais. La fonction répond
--  poliment « pas de combat ici », la barre sert ses quatre boutons
--  habituels, et personne ne voit d'erreur — seulement un joueur qui
--  ne peut pas frapper et qui ne sait pas pourquoi.
--
--  ── UN SEUL REPÈRE EN BASE, DEUX LECTURES À LA SORTIE ───────────────
--
--  La `0061` a fixé la règle : dans la table, `pv_joueur` et
--  `pv_sauvage` veulent dire « le côté de `joueur_id` » et « celui d'en
--  face », jamais « qui frappe » et « qui encaisse ».
--
--  `mon_combat` NE CHANGE PAS CE REPÈRE, elle le TRADUIT. Elle répond à
--  un joueur qui regarde sa propre barre, et pour lui « mon Pokémon »
--  veut dire le sien. Elle retourne donc les deux côtés quand c'est
--  l'adversaire qui demande :
--
--    · le défieur   : `pokemon_id` est à lui, l'espèce « sauvage » est
--                     en face — rien ne bouge, c'est la `0051` ;
--    · l'adversaire : `adverse_pokemon_id` est à lui, et c'est le
--                     Pokémon de `pokemon_id` qui est en face.
--
--  LA CLÉ S'APPELLE TOUJOURS `sauvage`, et c'est voulu : elle veut dire
--  « en face » depuis la `0047`, la barre la lit ainsi, et la renommer
--  obligerait à réémettre la chaîne entière pour un mot.
--
--  ── ET ELLE DIT DE QUI ON ATTEND LE COUP ────────────────────────────
--
--  `aMoi`. Sans lui, la barre offrirait « Frapper » aux deux joueurs en
--  même temps, et la base refuserait le second avec `PAS_TON_TOUR` —
--  après qu'il a posté. **Un message dépensé pour apprendre une règle
--  qu'on pouvait lire avant de cliquer est un message perdu.**
--
--  `aMoi` PLUTÔT QUE `aQui` : le navigateur n'a pas besoin de
--  l'identifiant du joueur d'en face, il a besoin de savoir s'il peut
--  frapper. Un identifiant rendu au navigateur est un identifiant de
--  plus à promener, et `defi_du_sujet` avait tranché pareil dans la
--  `0060`.
--
--  ── LE GENRE PASSE AUSSI DANS LA LECTURE PUBLIQUE ───────────────────
--
--  `combat_du_sujet` est accordée à `anon` : c'est elle qui dit à la
--  barre qu'un combat tourne ici, même sans laissez-passer. Elle gagne
--  `genre`, pour une raison précise — **un duel entre deux AUTRES
--  joueurs ne doit pas servir de boutons de combat à qui passe.** Il
--  n'a rien à y faire, et « Fuir » lui proposerait de quitter un combat
--  qui n'est pas le sien.
--
--  Un combat sauvage garde son comportement : la barre y bascule même
--  sans lecture privée, parce que « Fuir » est la sortie d'un sujet
--  qu'on ne peut plus fermer autrement (18 novembre).
-- ════════════════════════════════════════════════════════════════════

-- ── 1 · LA LECTURE PUBLIQUE DIT LE GENRE ────────────────────────────
--
--  Réémise depuis la version EN FORCE, celle de la `0047` : la `0046`
--  en avait une à `p_sujet integer`, remplacée par la forme `p jsonb`
--  que tout le dépôt utilise. On repart de la bonne.

create or replace function combat_du_sujet(p jsonb)
returns jsonb as $$
  select jsonb_build_object(
    'combatId',     c.id,
    'joueurId',     c.joueur_id,
    'genre',        c.genre,
    'especeId',     c.espece_id,
    'nom',          e.nom_fr,
    'niveau',       c.niveau_sauvage,
    'types',        to_jsonb(e.types),
    'pvSauvage',    c.pv_sauvage,
    'pvSauvageMax', c.pv_sauvage_max,
    'pokemonId',    c.pokemon_id,
    'pvPokemon',    c.pv_pokemon,
    'pvPokemonMax', c.pv_pokemon_max,
    'tour',         c.tour
  )
  from combat c join espece e on e.id = c.espece_id
  where c.sujet_id = (p->>'sujetId')::integer and c.etat = 'ouvert';
$$ language sql stable security definer set search_path = public, extensions;

comment on function combat_du_sujet(jsonb) is
  'Le combat ouvert d''un sujet, ou rien. Sert à la barre d''actions '
  'pour choisir ses boutons ; ne rend que ce qui est déjà affiché '
  'dans le sujet. Depuis la 0062, rend aussi le genre : un duel entre '
  'deux autres joueurs ne doit pas servir de boutons à qui passe.';

revoke all on function combat_du_sujet(jsonb) from public;
grant execute on function combat_du_sujet(jsonb) to anon, authenticated, service_role;

-- ── 2 · MON COMBAT, DES DEUX CÔTÉS ──────────────────────────────────
--
--  Réémise depuis la version en force (`0051`), la seule qui ait jamais
--  existé. Ce qui change y est marqué ; le reste est mot pour mot.

create or replace function mon_combat(p jsonb)
returns jsonb as $$
declare
  v_sujet   integer := (p->>'sujetId')::integer;
  v_moi     uuid    := joueur_courant();
  v_c       combat%rowtype;
  v_esp     record;
  v_siens   jsonb;
  v_equipe  jsonb;
  v_sac     jsonb;
  --  ── CE QUI EST NEUF ───────────────────────────────────────────────
  --  `v_mien` : le combat est-il vu depuis le côté de `joueur_id` ?
  --  Tout le reste en découle, et c'est la seule bascule du fichier.
  v_mien    boolean;
  v_a_moi   uuid;      -- mon Pokémon, de mon point de vue
  v_en_face uuid;      -- le sien, quand c'est un duel
  v_pv      integer;   -- mes PV
  v_pv_max  integer;
  v_f_pv    integer;   -- ceux d'en face
  v_f_pvmax integer;
  v_f_niv   smallint;
  v_f_nom   text;
  v_f_types text[];
  v_f_surnom text;
  v_adverse text;
begin
  --  SANS LAISSEZ-PASSER, RIEN. Un visiteur déconnecté voit la carte
  --  dans le sujet (`combat_du_sujet`) et c'est tout.
  if v_moi is null then
    return null;
  end if;

  --  ── LES DEUX CÔTÉS, DANS LA REQUÊTE ────────────────────────────────
  --
  --  LE `OR` EST LA CORRECTION DE CETTE MIGRATION. Il reste DANS la
  --  requête, comme le `joueur_id = v_moi` de la 0051 : une lecture qui
  --  trouve puis vérifie laisse passer le jour où quelqu'un oublie le
  --  `if`.
  --
  --  ET IL NE LÂCHE RIEN DE PLUS QU'AVANT pour un sauvage :
  --  `adverse_joueur_id` est `null` dans un combat sauvage, et
  --  `null = v_moi` n'est jamais vrai.
  select * into v_c
    from combat
   where sujet_id = v_sujet and etat = 'ouvert'
     and (joueur_id = v_moi or adverse_joueur_id = v_moi);
  if not found then
    return null;
  end if;

  v_mien := (v_c.joueur_id = v_moi);

  if v_mien then
    v_a_moi   := v_c.pokemon_id;
    v_en_face := v_c.adverse_pokemon_id;
    v_pv      := v_c.pv_pokemon;
    v_pv_max  := v_c.pv_pokemon_max;
    v_f_pv    := v_c.pv_sauvage;
    v_f_pvmax := v_c.pv_sauvage_max;
  else
    --  L'ADVERSAIRE D'UN DUEL : tout est retourné. Ses PV sont ceux que
    --  la table appelle « sauvage », et le « sauvage » qu'il voit est
    --  le Pokémon du défieur.
    v_a_moi   := v_c.adverse_pokemon_id;
    v_en_face := v_c.pokemon_id;
    v_pv      := v_c.pv_sauvage;
    v_pv_max  := v_c.pv_sauvage_max;
    v_f_pv    := v_c.pv_pokemon;
    v_f_pvmax := v_c.pv_pokemon_max;
  end if;

  --  ── QUI EST EN FACE, ET SOUS QUEL NOM ─────────────────────────────
  --
  --  Vu du défieur, c'est la colonne `espece_id` — vraie pour un
  --  sauvage comme pour un duel, c'est le sens qu'elle a depuis la
  --  0060. Vu de l'adversaire, il faut aller lire le Pokémon d'en face.
  if v_mien then
    select e.nom_fr, e.types into v_esp from espece e where e.id = v_c.espece_id;
    v_f_nom   := v_esp.nom_fr;
    v_f_types := v_esp.types;
    v_f_niv   := v_c.niveau_sauvage;
  else
    select e.nom_fr, e.types, pk.niveau, pk.surnom
      into v_f_nom, v_f_types, v_f_niv, v_f_surnom
      from pokemon pk join espece e on e.id = pk.espece_id
     where pk.id = v_en_face;
  end if;

  --  LE SURNOM DE CELUI D'EN FACE, QUAND C'EN EST UN DE JOUEUR. Un
  --  dresseur a nommé son Pokémon ; l'appeler par son espèce dans la
  --  barre de celui qui l'affronte serait lui retirer ce nom. Un
  --  sauvage n'en a pas, et `null` dit exactement ça.
  if v_mien and v_c.genre = 'duel' and v_en_face is not null then
    select pk.surnom into v_f_surnom from pokemon pk where pk.id = v_en_face;
  end if;

  --  LE PSEUDO DE L'AUTRE DRESSEUR, pour que la barre puisse écrire
  --  « à Erin de frapper » plutôt que « ce n'est pas ton tour ».
  if v_c.genre = 'duel' then
    select j.pseudo into v_adverse from joueur j
     where j.id = case when v_mien then v_c.adverse_joueur_id else v_c.joueur_id end;
  end if;

  --  LES QUATRE CAPACITÉS, DANS L'ORDRE DE LEURS CASES. C'est l'ordre
  --  que la barre affichera, et c'est celui de la table de liaison —
  --  donc le même que sur la carte de dresseur.
  --
  --  CELLES DE MON POKÉMON, PAS DE CELUI DE `joueur_id` : servir les
  --  capacités du défieur à son adversaire lui ferait choisir une
  --  attaque que son Pokémon ne connaît pas, et la relève la refuserait
  --  après coup (0061 valide la capacité contre la liste de
  --  l'ATTAQUANT).
  if v_a_moi is not null then
    select coalesce(jsonb_agg(jsonb_build_object(
             'id', c.id, 'nom', c.nom, 'type', c.type,
             'puissance', c.puissance
           ) order by pc.position), '[]'::jsonb)
      into v_siens
      from pokemon_capacite pc join capacite c on c.id = pc.capacite_id
     where pc.pokemon_id = v_a_moi;
  end if;

  --  L'ÉQUIPE POUR « CHANGER ». Avec les PV du sujet (0049), parce que
  --  la barre doit pouvoir griser — non, DIRE — qu'un Pokémon est à
  --  terre avant que le joueur ne clique.
  --
  --  `combat` SE LIT SUR MON POKÉMON À MOI. Vu de l'adversaire, c'est
  --  `adverse_pokemon_id` qui porte la mention « se bat » ; la 0051
  --  comparait à `v_c.pokemon_id`, et l'adversaire aurait vu son propre
  --  combattant libre.
  select coalesce(jsonb_agg(jsonb_build_object(
           'position', m.position,
           'nom',      m.nom_fr,
           'surnom',   m.surnom,
           'niveau',   m.niveau,
           'pv',       pv_dans_le_sujet(v_sujet, m.id, m.pvmax),
           'pvMax',    m.pvmax,
           'combat',   m.id = v_a_moi
         ) order by m.position asc nulls last, m.capture_le asc), '[]'::jsonb)
    into v_equipe
    from (
      select pk.id, pk.position, pk.surnom, pk.niveau, pk.capture_le,
             e.nom_fr, pv_au_niveau(e.pv_base, pk.niveau) as pvmax
        from pokemon pk join espece e on e.id = pk.espece_id
       where pk.joueur_id = v_moi and pk.emplacement = 'equipe'
    ) m;

  --  LE SAC, RÉDUIT À CE QUI SERT EN COMBAT. Les pierres d'évolution
  --  et les objets tenus n'ont rien à faire dans une liste où chaque
  --  ligne est un tour dépensé.
  --
  --  IL EST SERVI MÊME EN DUEL, où la 0061 refuse les objets. Deux
  --  raisons : la règle n'est pas tranchée (« cela compte comme un
  --  tour », et rien d'autre), et c'est la BARRE qui décide de ne pas
  --  l'offrir. Le jour où la règle existe, rien à rouvrir ici.
  select coalesce(jsonb_agg(jsonb_build_object(
           'objetId',  s.objet_id,
           'nom',      o.nom,
           'famille',  o.famille,
           'quantite', s.quantite
         ) order by o.famille, o.id), '[]'::jsonb)
    into v_sac
    from sac s join objet o on o.id = s.objet_id
   where s.joueur_id = v_moi and s.quantite > 0
     and o.famille in ('ball', 'soin');

  return jsonb_build_object(
    'combatId',     v_c.id,
    'genre',        v_c.genre,
    --  `a_qui` EST NULL DANS UN COMBAT SAUVAGE, et `null = v_moi` est
    --  faux : d'où le `coalesce`. Sans lui, un combat sauvage rendrait
    --  `aMoi: false` et la barre croirait que le joueur attend son
    --  tour — contre un sauvage qui ne postera jamais.
    'aMoi',         coalesce(v_c.a_qui = v_moi, true),
    'adverse',      v_adverse,
    'tour',         v_c.tour,
    'sauvage',      jsonb_build_object(
      'nom',    v_f_nom,
      'surnom', v_f_surnom,
      'niveau', v_f_niv,
      'types',  to_jsonb(v_f_types),
      'pv',     v_f_pv,
      'pvMax',  v_f_pvmax
    ),
    'pvPokemon',    v_pv,
    'pvPokemonMax', v_pv_max,
    'capacites',    coalesce(v_siens, '[]'::jsonb),
    'equipe',       v_equipe,
    'sac',          v_sac
  );
end $$ language plpgsql stable security definer set search_path = public, extensions;

revoke all on function mon_combat(jsonb) from public;
grant execute on function mon_combat(jsonb) to anon, authenticated, service_role;

comment on function mon_combat(jsonb) is
  'Ce qu''il faut à la barre d''actions pour servir ses boutons de '
  'combat : les capacités de MON Pokémon, l''équipe avec ses PV dans '
  'ce sujet, et les balls et potions du sac. Depuis la 0062, répond '
  'aux DEUX joueurs d''un duel, chacun de son côté, et dit par `aMoi` '
  'de qui on attend le coup. Rend NULL si le combat ne le concerne '
  'pas — le refus est dans la base, parce qu''un bouton caché se '
  'retrouve avec les outils du navigateur.';
