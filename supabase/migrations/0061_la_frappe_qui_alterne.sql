-- ════════════════════════════════════════════════════════════════════
--  0061 · La frappe qui alterne
--
--  Lot 2 du duel. Le lot 1 a posé la charpente — le défi, son
--  acceptation, `a_qui`. Celui-ci fait jouer les coups.
--
--  ── CE QUE LA BASE DOIT TENIR, ET QUE LE NAVIGATEUR NE PEUT PAS ─────
--
--  **L'ORDRE DES COUPS.** Sans lui, le plus prompt à poster frappe
--  deux fois. Et ce n'est pas une garde à mettre dans la relève : elle
--  lit plusieurs messages dans un même passage, donc deux messages du
--  même joueur arriveraient tous les deux avec `a_qui` encore à son
--  nom si la bascule n'était pas DANS LA MÊME TRANSACTION que le tour.
--
--  C'est exactement la raison pour laquelle `jouer_un_tour` existe en
--  base plutôt qu'en TypeScript, et la raison vaut une deuxième fois.
--
--  ── UN SEUL `jouer_un_tour`, ET PAS UN SECOND POUR LE DUEL ──────────
--
--  Tout ce qu'elle fait reste à faire : écrire le tour, refuser un
--  numéro qui n'est pas le suivant, refuser un combat clos, poser les
--  PV du sujet, fermer sur une fin. Un second chemin aurait dupliqué
--  les six, et le jour où l'un change, l'autre ne change pas.
--
--  Ce qui s'ajoute, quand le combat est un duel :
--
--    1 · elle exige de savoir QUI joue, et refuse si ce n'est pas son
--        tour ;
--    2 · elle fait passer la main ;
--    3 · elle pose aussi les PV du Pokémon d'en face — qui est un vrai
--        Pokémon d'un vrai joueur, et dont les PV doivent tenir
--        jusqu'à la clôture comme les autres ;
--    4 · elle accepte `nul` comme fin.
--
--  ── `joueurId` EST FACULTATIF, ET SEULEMENT POUR LE SAUVAGE ─────────
--
--  Un combat sauvage n'a personne d'autre à qui passer la main, et la
--  relève l'appelle depuis des semaines sans ce champ. L'exiger
--  partout aurait cassé le combat qui marche pour une règle qui ne le
--  concerne pas. Dans un duel, en revanche, son absence est une
--  erreur : jouer sans savoir qui joue, c'est ne pas tenir l'ordre.
-- ════════════════════════════════════════════════════════════════════

-- ── 1 · `nul` REJOINT LES FINS CONNUES ──────────────────────────────
--
--  Trente tours sans que personne ne tombe. Un sauvage, lui, s'en va
--  au cinquième — c'est `fuite`, et ça a un sens : il n'avait aucune
--  raison de rester. Deux dresseurs qui n'arrivent pas à se blesser
--  n'ont rien gagné, et inventer un vainqueur au compte des PV serait
--  une règle que personne n'a écrite.

alter table combat drop constraint if exists combat_etat_check;
alter table combat drop constraint if exists combat_etat_connu;
alter table combat add constraint combat_etat_connu check (
  etat in ('ouvert', 'capture', 'fuite', 'victoire', 'defaite', 'expire', 'nul')
);

--  ET `nul` N'A PAS DE SENS POUR UN SAUVAGE : il s'enfuit, il ne fait
--  pas match nul. La contrainte le dit, parce qu'une fin impossible
--  écrite une fois reste dans la table pour toujours.
alter table combat drop constraint if exists combat_nul_du_duel;
alter table combat add constraint combat_nul_du_duel
  check (etat <> 'nul' or genre = 'duel');

comment on column combat.etat is
  'ouvert, capture, fuite, victoire, defaite, expire — et `nul` pour '
  'un duel de trente tours sans vainqueur (0061). `victoire` et '
  '`defaite` se lisent TOUJOURS du côté de joueur_id.';

-- ── 2 · LE TOUR D'UN DUEL ───────────────────────────────────────────

create or replace function jouer_un_tour(p jsonb)
returns jsonb as $$
declare
  v_combat  uuid     := (p->>'combatId')::uuid;
  v_message integer  := (p->>'messageId')::integer;
  v_numero  smallint := (p->>'numero')::smallint;
  v_demande text     := p->>'demande';
  v_pvj     smallint := (p->>'pvJoueur')::smallint;
  v_pvs     smallint := (p->>'pvSauvage')::smallint;
  v_fin     text     := nullif(p->>'fin', '');
  --  QUEL POKÉMON PORTE CES PV. Nul veut dire « celui qui se bat
  --  déjà » ; un changement de Pokémon le nomme, parce que les PV
  --  écrits sont alors ceux de l'ARRIVANT.
  v_porteur uuid     := nullif(p->>'pokemonId', '')::uuid;
  --  QUI JOUE. Facultatif pour un sauvage, exigé pour un duel.
  v_joueur  uuid     := nullif(p->>'joueurId', '')::uuid;
  v_deja    combat_tour%rowtype;
  v_c       combat%rowtype;
  v_id      uuid;
  v_suivant uuid;
begin
  if v_combat is null or v_message is null or v_numero is null then
    raise exception 'TOUR_PARAMETRES_MANQUANTS';
  end if;
  if p->'recit' is null or p->'recit' = 'null'::jsonb then
    raise exception 'TOUR_SANS_RECIT';
  end if;
  --  `nul` S'AJOUTE AUX QUATRE (0061).
  if v_fin is not null
     and v_fin not in ('victoire', 'defaite', 'fuite', 'capture', 'nul') then
    raise exception 'FIN_INCONNUE';
  end if;

  select * into v_deja from combat_tour where message_id = v_message;
  if found then
    return jsonb_build_object(
      'tourId', v_deja.id, 'joue', false, 'numero', v_deja.numero,
      'raison', 'DEJA_JOUE'
    );
  end if;

  select * into v_c from combat where id = v_combat for update;
  if not found then
    raise exception 'COMBAT_INCONNU';
  end if;
  if v_c.etat <> 'ouvert' then
    return jsonb_build_object('joue', false, 'raison', 'COMBAT_CLOS');
  end if;
  if v_numero <> v_c.tour + 1 then
    return jsonb_build_object(
      'joue', false, 'raison', 'TOUR_DEPASSE', 'tour', v_c.tour
    );
  end if;

  --  ── L'ORDRE DES COUPS, ET IL EST TENU ICI ────────────────────────
  --
  --  `for update` deux lignes plus haut sérialise les deux messages
  --  qui arriveraient ensemble : le second lit `a_qui` DÉJÀ basculé et
  --  se fait refuser. Une garde dans la relève ne le ferait pas — elle
  --  lit plusieurs messages dans un même passage.
  if v_c.genre = 'duel' then
    if v_joueur is null then
      raise exception 'DUEL_SANS_JOUEUR';
    end if;
    if v_joueur <> v_c.a_qui then
      return jsonb_build_object(
        'joue', false, 'raison', 'PAS_TON_TOUR', 'aQui', v_c.a_qui
      );
    end if;
    --  ET `nul` NE PEUT PAS TOMBER AVANT LE PLAFOND. Une fin inventée
    --  plus tôt arrêterait un duel que personne n'a perdu.
    if v_fin = 'nul' and v_numero < 30 then
      raise exception 'NUL_TROP_TOT';
    end if;
  elsif v_fin = 'nul' then
    --  Un sauvage s'enfuit, il ne fait pas match nul.
    raise exception 'NUL_HORS_DUEL';
  end if;

  insert into combat_tour (
    combat_id, message_id, numero, demande, detail, recit,
    pv_joueur, pv_sauvage, fin
  ) values (
    v_combat, v_message, v_numero, v_demande, p->'detail', p->'recit',
    v_pvj, v_pvs, v_fin
  ) returning id into v_id;

  --  LA MAIN PASSE À L'AUTRE, et seulement si le combat continue : sur
  --  une fin, `a_qui` garde sa dernière valeur. Ça se lit — « c'était
  --  à lui quand ça s'est terminé » — et une colonne qui bascule une
  --  fois de trop raconterait un tour qui n'a pas eu lieu.
  if v_c.genre = 'duel' and v_fin is null then
    v_suivant := case
      when v_c.a_qui = v_c.joueur_id then v_c.adverse_joueur_id
      else v_c.joueur_id
    end;
  else
    v_suivant := v_c.a_qui;
  end if;

  update combat
     set pv_pokemon     = v_pvj,
         pv_sauvage     = v_pvs,
         tour           = v_numero,
         --  UN CHANGEMENT DE POKÉMON CHANGE LE COMBATTANT, et son
         --  maximum avec. `coalesce` garde l'ancien quand le tour ne
         --  nomme personne.
         --
         --  ET DANS UN DUEL, LE CHANGEMENT PEUT ÊTRE DE L'AUTRE CÔTÉ :
         --  `pokemonAdverse` nomme alors l'arrivant d'en face. Les deux
         --  ne sont jamais posés ensemble — un tour est d'un joueur.
         pokemon_id     = coalesce(v_porteur, pokemon_id),
         pv_pokemon_max = coalesce(
           (p->>'pvPokemonMax')::smallint, pv_pokemon_max
         ),
         adverse_pokemon_id = coalesce(
           nullif(p->>'pokemonAdverse', '')::uuid, adverse_pokemon_id
         ),
         pv_sauvage_max = coalesce(
           (p->>'pvAdverseMax')::smallint, pv_sauvage_max
         ),
         a_qui          = v_suivant,
         etat           = coalesce(v_fin, etat),
         clos_le        = case when v_fin is null then clos_le else now() end
   where id = v_combat;

  --  ── LES PV DU SUJET, DANS LA MÊME TRANSACTION ──────────────────
  --
  --  Celui qui ENCAISSE le coup est celui qui part sur le terrain ce
  --  tour-ci : le porteur quand le tour en nomme un, sinon celui qui
  --  s'y battait déjà.
  if coalesce(v_porteur, v_c.pokemon_id) is not null then
    perform poser_les_pv(v_c.sujet_id, coalesce(v_porteur, v_c.pokemon_id), v_pvj);
  end if;

  --  ET CELUI QUI SORT GARDE LES SIENS. C'est toute la décision du
  --  18 novembre : changer ne soigne pas, et revenir ne soigne pas.
  if v_porteur is not null and v_c.pokemon_id is not null
     and v_porteur <> v_c.pokemon_id then
    perform poser_les_pv(v_c.sujet_id, v_c.pokemon_id, v_c.pv_pokemon);
  end if;

  --  ── ET LE CÔTÉ D'EN FACE, QUAND C'EN EST UN VRAI (0061) ──────────
  --
  --  Un sauvage disparaît avec son combat : ses PV n'ont aucune raison
  --  de survivre au sujet. Le Pokémon d'un joueur, lui, continue — et
  --  « ils se soignent à la clôture » (18 novembre) doit valoir pour
  --  les deux dresseurs, pas seulement pour celui qui a défié.
  if v_c.genre = 'duel' then
    if coalesce(nullif(p->>'pokemonAdverse', '')::uuid, v_c.adverse_pokemon_id)
       is not null then
      perform poser_les_pv(
        v_c.sujet_id,
        coalesce(nullif(p->>'pokemonAdverse', '')::uuid, v_c.adverse_pokemon_id),
        v_pvs
      );
    end if;
    if nullif(p->>'pokemonAdverse', '')::uuid is not null
       and v_c.adverse_pokemon_id is not null
       and nullif(p->>'pokemonAdverse', '')::uuid <> v_c.adverse_pokemon_id then
      perform poser_les_pv(v_c.sujet_id, v_c.adverse_pokemon_id, v_c.pv_sauvage);
    end if;
  end if;

  return jsonb_build_object(
    'tourId', v_id, 'joue', true, 'numero', v_numero, 'fin', v_fin,
    --  À QUI MAINTENANT. La relève n'en a pas besoin pour jouer, mais
    --  le message du Maître du Jeu le dit — « à toi, Erin » — et le
    --  recalculer là-bas voudrait relire la ligne.
    'aQui', v_suivant
  );
end $$ language plpgsql security definer set search_path = public, extensions;

comment on function jouer_un_tour(jsonb) is
  'Écrit un tour DÉJÀ CALCULÉ par le domaine, pose les PV et ferme sur '
  'une fin. Pour un duel, elle tient en plus l''ORDRE DES COUPS : elle '
  'exige `joueurId`, refuse qui n''a pas la main, et la fait passer '
  'dans la même transaction (0061).';

revoke all on function jouer_un_tour(jsonb) from public, anon, authenticated;
grant execute on function jouer_un_tour(jsonb) to service_role;

-- ── 3 · CE QU'IL FAUT POUR JOUER UN TOUR DE DUEL ────────────────────
--
--  Réémise depuis la version EN FORCE (0050), pas depuis la 0048 : la
--  0050 y a ajouté l'équipe, le sac et le taux de capture. Repartir de
--  la 0048 les aurait fait disparaître sans que rien ne le dise — et
--  c'est le genre de perte qu'on ne voit qu'au premier joueur qui
--  n'arrive plus à changer de Pokémon.
--
--  QUATRE AJOUTS, et aucun ne touche au chemin du sauvage :
--
--    · les capacités d'en face sont CELLES QU'IL A CHOISIES ;
--    · l'équipe et le sac sont ceux de CELUI DONT C'EST LE TOUR ;
--    · le genre, les deux identifiants d'en face et `aQui` partent ;
--    · le surnom d'en face part aussi, parce qu'un joueur l'a nommé.

create or replace function combat_pour_jouer(p jsonb)
returns jsonb as $$
declare
  v_sujet integer := (p->>'sujetId')::integer;
  v_c     combat%rowtype;
  v_pok   record;
  v_esp   record;
  v_siens jsonb;
  v_leurs jsonb;
  v_equipe jsonb;
begin
  select * into v_c from combat where sujet_id = v_sujet and etat = 'ouvert';
  if not found then
    return null;
  end if;

  select e.nom_fr, e.types, e.pv_base, e.att_base, e.def_base, e.capture_base
    into v_esp from espece e where e.id = v_c.espece_id;

  --  ── LES CAPACITÉS D'EN FACE (0061) ─────────────────────────────
  --
  --  DANS UN DUEL, CE SONT CELLES QU'IL A CHOISIES — on lit la table
  --  de liaison, pas la fonction de dotation. C'est toute la
  --  différence avec un sauvage : un sauvage n'a jamais choisi.
  if v_c.genre = 'duel' then
    select coalesce(jsonb_agg(jsonb_build_object(
             'id', c.id, 'nom', c.nom, 'type', c.type,
             'puissance', c.puissance, 'precision', c."precision"
           ) order by pc.position), '[]'::jsonb)
      into v_leurs
      from pokemon_capacite pc join capacite c on c.id = pc.capacite_id
     where pc.pokemon_id = v_c.adverse_pokemon_id;
  else
    --  Les capacités du sauvage, tirées à son niveau : il joue avec les
    --  mêmes règles que les autres.
    select coalesce(jsonb_agg(jsonb_build_object(
             'id', c.id, 'nom', c.nom, 'type', c.type,
             'puissance', c.puissance, 'precision', c."precision"
           ) order by c.id), '[]'::jsonb)
      into v_leurs
      from capacite c
     where c.id = any (capacites_de_depart(v_c.espece_id, v_c.niveau_sauvage));
  end if;

  --  Et celles du combattant, RANGÉES et non tirées : il les a
  --  choisies, ou la dotation les lui a posées.
  if v_c.pokemon_id is not null then
    select pk.id, pk.surnom, pk.niveau, ep.nom_fr, ep.types,
           ep.pv_base, ep.att_base, ep.def_base
      into v_pok
      from pokemon pk join espece ep on ep.id = pk.espece_id
     where pk.id = v_c.pokemon_id;

    select coalesce(jsonb_agg(jsonb_build_object(
             'id', c.id, 'nom', c.nom, 'type', c.type,
             'puissance', c.puissance, 'precision', c."precision"
           ) order by pc.position), '[]'::jsonb)
      into v_siens
      from pokemon_capacite pc join capacite c on c.id = pc.capacite_id
     where pc.pokemon_id = v_c.pokemon_id;
  end if;

  --  ── L'ÉQUIPE, BANC COMPRIS ─────────────────────────────────────
  --
  --  Tout le monde, y compris celui qui se bat : « changer » doit
  --  pouvoir refuser « celui-là se bat déjà » en le NOMMANT, et pour le
  --  nommer il faut l'avoir.
  --
  --  LES PV SONT CEUX DU SUJET (0049), pas le maximum. Un Pokémon
  --  blessé plus tôt dans le sujet revient blessé, et c'est toute la
  --  décision du 18 novembre.
  select coalesce(jsonb_agg(jsonb_build_object(
           'position',  m.position,
           'pokemonId', m.id,
           'nom',       m.nom_fr,
           'surnom',    m.surnom,
           'niveau',    m.niveau,
           'types',     to_jsonb(m.types),
           'pv',        pv_dans_le_sujet(v_sujet, m.id, m.pvmax),
           'pvMax',     m.pvmax,
           'attaque',   stat_au_niveau(m.att_base, m.niveau),
           'defense',   stat_au_niveau(m.def_base, m.niveau),
           'capacites', m.capacites
         ) order by m.position asc nulls last, m.capture_le asc), '[]'::jsonb)
    into v_equipe
    from (
      select pk.id, pk.position, pk.surnom, pk.niveau, pk.capture_le,
             e.nom_fr, e.types, e.att_base, e.def_base,
             pv_au_niveau(e.pv_base, pk.niveau) as pvmax,
             coalesce((
               select jsonb_agg(jsonb_build_object(
                        'id', c.id, 'nom', c.nom, 'type', c.type,
                        'puissance', c.puissance, 'precision', c."precision"
                      ) order by pc.position)
                 from pokemon_capacite pc join capacite c on c.id = pc.capacite_id
                where pc.pokemon_id = pk.id
             ), '[]'::jsonb) as capacites
        from pokemon pk join espece e on e.id = pk.espece_id
       --  L'ÉQUIPE DE CELUI DONT C'EST LE TOUR (0061). Hors duel,
       --  `a_qui` est nul et c'est celle du joueur du combat — ce qui
       --  était le seul cas. Dans un duel, servir toujours celle du
       --  défieur donnerait à l'autre une liste de Pokémon qui ne sont
       --  pas les siens au moment de changer.
       where pk.joueur_id = coalesce(v_c.a_qui, v_c.joueur_id)
         and pk.emplacement = 'equipe'
    ) m;

  return jsonb_build_object(
    'combatId', v_c.id,
    'sujetId',  v_c.sujet_id,
    'joueurId', v_c.joueur_id,
    'tour',     v_c.tour,
    --  ── CE QUE LE DUEL AJOUTE (0061) ─────────────────────────────
    --
    --  `genre` d'abord, parce que tout le reste en dépend. Puis les
    --  deux identifiants d'en face — pour écrire l'expérience et les
    --  PV du bon Pokémon — et `aQui`, qui dit de qui on attend le
    --  prochain message.
    'genre',    v_c.genre,
    'adverseJoueurId',  v_c.adverse_joueur_id,
    'adversePokemonId', v_c.adverse_pokemon_id,
    'aQui',     v_c.a_qui,
    'sauvage', jsonb_build_object(
      'especeId',  v_c.espece_id,
      --  LE SURNOM D'EN FACE, quand c'est le Pokémon d'un joueur : il
      --  l'a nommé, et le message doit l'appeler par son nom.
      'surnom',    case when v_c.genre = 'duel'
                        then (select pk.surnom from pokemon pk
                               where pk.id = v_c.adverse_pokemon_id)
                        else null end,
      'nom',       v_esp.nom_fr,
      'niveau',    v_c.niveau_sauvage,
      'types',     to_jsonb(v_esp.types),
      'pv',        v_c.pv_sauvage,
      'pvMax',     v_c.pv_sauvage_max,
      'attaque',   stat_au_niveau(v_esp.att_base, v_c.niveau_sauvage),
      'defense',   stat_au_niveau(v_esp.def_base, v_c.niveau_sauvage),
      --  POUR LA POKÉ BALL. Il est ici et pas ailleurs parce que c'est
      --  la même lecture : un appel de plus pour un chiffre qu'on avait
      --  déjà sous la main serait un aller-retour pour rien.
      'capture',   v_esp.capture_base,
      'capacites', v_leurs
    ),
    'combattant', case when v_pok.id is null then null else jsonb_build_object(
      'pokemonId', v_pok.id,
      'nom',       v_pok.nom_fr,
      'surnom',    v_pok.surnom,
      'niveau',    v_pok.niveau,
      'types',     to_jsonb(v_pok.types),
      'pv',        v_c.pv_pokemon,
      'pvMax',     v_c.pv_pokemon_max,
      'attaque',   stat_au_niveau(v_pok.att_base, v_pok.niveau),
      'defense',   stat_au_niveau(v_pok.def_base, v_pok.niveau),
      'capacites', coalesce(v_siens, '[]'::jsonb)
    ) end,
    'equipe', v_equipe,
    --  LE SAC, parce que la Poké Ball et les objets en ont besoin et
    --  que c'est encore la même lecture.
    --
    --  AVEC LE SLUG ET LA FAMILLE, pas seulement la quantité : le
    --  domaine choisit le multiplicateur d'une ball et le soin d'une
    --  potion PAR SON SLUG — « quick-ball », « super-potion » — et
    --  aller les chercher par un second appel serait un aller-retour
    --  pour une ligne qu'on avait déjà jointe.
    --
    --  Les quantités sont celles de la BASE : ce que le registre du
    --  sujet a déjà consommé n'est pas déduit ici, il l'est à la
    --  clôture comme tout le reste.
    'sac', coalesce((
      select jsonb_agg(jsonb_build_object(
               'objetId',  s.objet_id,
               'quantite', s.quantite,
               'slug',     o.slug,
               'nom',      o.nom,
               'famille',  o.famille
             ) order by o.famille, o.id)
        from sac s join objet o on o.id = s.objet_id
       --  LE SAC DE CELUI DONT C'EST LE TOUR, même raison que
       --  l'équipe. Un duel n'autorise pas encore les objets, mais
       --  servir le sac du défieur à l'autre serait un piège posé pour
       --  le jour où il les autorisera.
       where s.joueur_id = coalesce(v_c.a_qui, v_c.joueur_id) and s.quantite > 0
    ), '[]'::jsonb)
  );
end $$ language plpgsql stable security definer set search_path = public, extensions;

comment on function combat_pour_jouer(jsonb) is
  'Tout ce qu''il faut pour résoudre un tour du combat ouvert d''un '
  'sujet. Pour un duel, les capacités d''en face sont celles que son '
  'dresseur a CHOISIES, l''équipe et le sac sont ceux de celui dont '
  'c''est le tour, et `aQui` dit à qui est la main (0061).';

revoke all on function combat_pour_jouer(jsonb) from public, anon, authenticated;
grant execute on function combat_pour_jouer(jsonb) to service_role;

-- ── 4 · LE TOUR À POSTER SAIT QU'IL EST UN DUEL ─────────────────────
--
--  Réémise depuis la version en force (0052), celle qui porte les
--  numéros d'espèce pour les sprites.
--
--  UN MESSAGE DE COMBAT SAUVAGE PARLE À LA DEUXIÈME PERSONNE — « tu
--  attaques », « ton Pokémon » — et c'est juste : il n'a qu'un
--  lecteur. Un tour de duel est lu par DEUX dresseurs, et « tu » n'y
--  désigne plus personne. Les deux pseudos partent donc avec le tour.

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
        --  ── CE QU'UN DUEL AJOUTE (0061) ───────────────────────────
        --
        --  LE GENRE, ET LES DEUX NOMS. Un message de combat sauvage
        --  parle à la deuxième personne — « tu attaques », « ton
        --  Pokémon » — et c'est juste : il n'a qu'un lecteur. Un tour
        --  de duel est lu par DEUX dresseurs, et « tu » n'y désigne
        --  plus personne.
        --
        --  Les deux pseudos partent donc avec le tour, et `aFrappe`
        --  dit lequel des deux vient de jouer.
        'genre',     cb.genre,
        'defieur',   j.pseudo,
        'adverse',   ja.pseudo,
        'joueLe',    t.joue_le,
        'sauvage',   jsonb_build_object(
          'especeId', es.id,
          --  LE SURNOM D'EN FACE, quand c'est le Pokémon d'un joueur.
          'surnom', case when cb.genre = 'duel'
                         then (select pa.surnom from pokemon pa
                                where pa.id = cb.adverse_pokemon_id)
                         else null end,
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
      left join joueur ja on ja.id = cb.adverse_joueur_id
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

comment on function tours_a_poster(jsonb) is
  'Les tours qui attendent leur message. Pour un duel, le genre et les '
  'deux pseudos partent aussi : « tu » ne désigne personne dans un '
  'message lu par deux dresseurs (0061).';

revoke all on function tours_a_poster(jsonb) from public;
grant execute on function tours_a_poster(jsonb) to service_role;
