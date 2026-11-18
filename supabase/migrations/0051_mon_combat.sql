-- ════════════════════════════════════════════════════════════════════
--  0051 · Mon combat
--
--  Ce qu'il faut à la BARRE D'ACTIONS pour servir ses cinq boutons de
--  combat : les quatre capacités du Pokémon qui se bat, l'équipe pour
--  « changer », et les balls et potions du sac.
--
--  ── POURQUOI PAS DANS `combat_du_sujet` ─────────────────────────────
--
--  `combat_du_sujet` est lisible par N'IMPORTE QUI — elle est accordée
--  à `anon`, et c'est voulu : elle ne rend que ce qui est déjà affiché
--  dans le sujet, l'espèce, son niveau, ses PV. Un visiteur qui lit le
--  sujet voit la même chose.
--
--  Y AJOUTER L'ÉQUIPE ET LE SAC AURAIT PUBLIÉ LE SAC D'UN JOUEUR À
--  TOUT LE MONDE. Deux fonctions, donc, et la frontière est la même
--  que celle du carnet : ce qui est dans le sujet est public, ce qui
--  est dans le sac demande la clé.
--
--  ── QUI APPELLE : `joueur_courant()`, COMME LES NEUF POLITIQUES ─────
--
--  PREMIER JET FAUX, ET C'EST LE DÉPÔT QUI L'A DIT. J'avais écrit une
--  fonction qui lisait la clé de carnet dans l'en-tête
--  `x-wm-carnet` — en me félicitant d'extraire ce que quatre
--  politiques RLS répètent mot pour mot.
--
--  Sauf que CE N'EST PAS LE CHEMIN DU NAVIGATEUR. La barre tourne sur
--  une page de sujet, où le joueur porte son LAISSEZ-PASSER —
--  `appelerAvecLeJeton` met son jeton dans `Authorization`, PostgreSQL
--  voit `authenticated`, et `joueur_courant()` rend son identifiant.
--  C'est ce que les neuf politiques de lecture utilisent depuis la
--  `0001`, et c'est ce que le carnet utilise.
--
--  L'en-tête `x-wm-carnet`, lui, sert aux politiques de tables lues
--  par la relève. Ajouter un deuxième chemin d'identification pour une
--  seule fonction aurait fait deux façons de dire « qui es-tu » — et
--  deux façons de se tromper.

-- ════════════════════════════════════════════════════════════════════
--  MON COMBAT
--
--  La barre appelle ceci et sert ses boutons avec. Elle n'obtient rien
--  si le combat n'est pas le sien — planche 99 §5.4, dans un sujet à
--  deux l'autre voit la carte et ne peut pas agir. Le refus est donc
--  dans la BASE et pas seulement dans l'affichage : un bouton caché se
--  retrouve avec les outils du navigateur.
-- ════════════════════════════════════════════════════════════════════

create or replace function mon_combat(p jsonb)
returns jsonb as $$
declare
  v_sujet  integer := (p->>'sujetId')::integer;
  v_moi    uuid    := joueur_courant();
  v_c      combat%rowtype;
  v_esp    record;
  v_siens  jsonb;
  v_equipe jsonb;
  v_sac    jsonb;
begin
  --  SANS LAISSEZ-PASSER, RIEN. Un visiteur déconnecté voit la carte
  --  dans le sujet (`combat_du_sujet`) et c'est tout.
  if v_moi is null then
    return null;
  end if;

  --  `joueur_id = v_moi` DANS LA REQUÊTE, pas après : une lecture qui
  --  trouve puis vérifie laisse passer le jour où quelqu'un oublie le
  --  `if`.
  select * into v_c
    from combat
   where sujet_id = v_sujet and etat = 'ouvert' and joueur_id = v_moi;
  if not found then
    return null;
  end if;

  select e.nom_fr, e.types into v_esp from espece e where e.id = v_c.espece_id;

  --  LES QUATRE CAPACITÉS, DANS L'ORDRE DE LEURS CASES. C'est l'ordre
  --  que la barre affichera, et c'est celui de la table de liaison —
  --  donc le même que sur la carte de dresseur.
  if v_c.pokemon_id is not null then
    select coalesce(jsonb_agg(jsonb_build_object(
             'id', c.id, 'nom', c.nom, 'type', c.type,
             'puissance', c.puissance
           ) order by pc.position), '[]'::jsonb)
      into v_siens
      from pokemon_capacite pc join capacite c on c.id = pc.capacite_id
     where pc.pokemon_id = v_c.pokemon_id;
  end if;

  --  L'ÉQUIPE POUR « CHANGER ». Avec les PV du sujet (0049), parce que
  --  la barre doit pouvoir griser — non, DIRE — qu'un Pokémon est à
  --  terre avant que le joueur ne clique.
  select coalesce(jsonb_agg(jsonb_build_object(
           'position', m.position,
           'nom',      m.nom_fr,
           'surnom',   m.surnom,
           'niveau',   m.niveau,
           'pv',       pv_dans_le_sujet(v_sujet, m.id, m.pvmax),
           'pvMax',    m.pvmax,
           'combat',   m.id = v_c.pokemon_id
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
    'tour',         v_c.tour,
    'sauvage',      jsonb_build_object(
      'nom',    v_esp.nom_fr,
      'niveau', v_c.niveau_sauvage,
      'types',  to_jsonb(v_esp.types),
      'pv',     v_c.pv_sauvage,
      'pvMax',  v_c.pv_sauvage_max
    ),
    'pvPokemon',    v_c.pv_pokemon,
    'pvPokemonMax', v_c.pv_pokemon_max,
    'capacites',    coalesce(v_siens, '[]'::jsonb),
    'equipe',       v_equipe,
    'sac',          v_sac
  );
end $$ language plpgsql stable security definer set search_path = public, extensions;

revoke all on function mon_combat(jsonb) from public;
grant execute on function mon_combat(jsonb) to anon, authenticated, service_role;

comment on function mon_combat(jsonb) is
  'Ce qu''il faut à la barre d''actions pour servir ses boutons de '
  'combat : les quatre capacités, l''équipe avec ses PV dans ce sujet, '
  'et les balls et potions du sac. Rend NULL si le combat n''est pas '
  'celui du joueur connecté — le refus est dans la base, parce '
  'qu''un bouton caché se retrouve avec les outils du navigateur.';
