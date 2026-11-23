-- ════════════════════════════════════════════════════════════════════
--  0069 · Le sujet se souvient
--
--  « "Où j'en suis" n'a pas été mis à jour suite à ma capture : il
--  devrait dire si je suis en pleine rencontre, en plein combat, qui je
--  viens de capturer. C'est un suivi et un rappel du bilan du sujet. »
--  — 23 novembre.
--
--  ── CE QUI MANQUAIT, ET POURQUOI ÇA DISPARAISSAIT ───────────────────
--
--  `mon_sujet` ne lisait QUE le combat ouvert :
--
--      where sujet_id = v_sujet and etat = 'ouvert' and joueur_id = v_moi
--
--  Une capture ferme le combat (`etat = 'capture'`). Donc à la seconde
--  où elle réussit, la ligne cesse d'être lue, le bloc s'efface, et le
--  panneau ne dit plus rien de ce qui vient de se passer. **Le moment
--  le plus intéressant du sujet est exactement celui où le panneau se
--  tait.**
--
--  ── ET LE BILAN, LUI, N'EST PAS DE CE FICHIER ───────────────────────
--
--  « C'est un suivi et un rappel du bilan du sujet. » Le panneau a déjà
--  ce bloc-là — « Ce que ce sujet t'a rapporté » — et il le construit
--  sur les mêmes lignes de registre. S'il ne s'affichait pas, c'était
--  pour une tout autre raison, mesurée sur le sujet 1014 : le thème
--  écrit « @Jake Dalziel » dans `.postprofile-name`, le compte s'appelle
--  « Jake Dalziel », et la comparaison qui cherche SA colonne ne pouvait
--  jamais réussir. **Le bloc ne s'affichait pour personne.**
--
--  Cette faute-là se répare dans `module-bilan.ts`, pas ici. Ajouter un
--  second bilan en SQL aurait doublé l'information à l'écran et laissé
--  la vraie panne intacte.
--
--  ── LA RENCONTRE ÉTAIT DÉJÀ LÀ, PERSONNE NE LA LISAIT ───────────────
--
--  `combat.tour = 0` est déjà, mot pour mot, la carte de rencontre :
--  « elle est postée, personne n'a encore agi » (0046). Distinguer
--  « en pleine rencontre » de « en plein combat » ne demande donc
--  aucune colonne neuve — seulement de regarder celle qui existe.
--  C'est le navigateur qui tranche sur `tour`, parce que c'est une
--  question de formulation, pas de donnée.
--
--  ── UNE CLÉ DE PLUS, ET LE COMBAT OUVERT NE BOUGE PAS ──────────────
--
--  `fini` : le DERNIER combat clos de ce sujet pour moi, et seulement
--  quand il n'y en a pas d'ouvert. C'est lui qui répond à « qui je
--  viens de capturer » dans l'intervalle — la relève n'a pas encore
--  écrit la ligne de registre, mais le combat, lui, est déjà clos.
--
--  `v_c` N'EST PAS TOUCHÉ. Il reste le combat ouvert, et lui seul :
--  c'est lui qui marque lequel des six se bat. L'élargir ferait porter
--  à un membre de l'équipe la marque « en combat » après la fin du
--  combat. Le combat clos a donc sa propre variable.
--
--  ── CE QUI RESTE FAUX ICI, ET QUI N'EST PAS DE CE LOT ───────────────
--
--  `joueur_courant()` NE REND QU'UN PERSONNAGE sur un compte qui en a
--  plusieurs — mesuré en base : avec Jake et Erin sur le même `auth_id`,
--  il choisit « Jake », en silence. Dans le sujet d'Erin, le panneau
--  montre donc l'équipe de Jake. La réparation demande une décision
--  (quel personnage joue DANS CE SUJET ?) et pas un correctif : elle est
--  signalée, pas bricolée.
-- ════════════════════════════════════════════════════════════════════

create or replace function mon_sujet(p jsonb)
returns jsonb as $$
declare
  v_sujet  integer := (p->>'sujetId')::integer;
  v_moi    uuid    := joueur_courant();
  v_c      combat%rowtype;
  v_f      combat%rowtype;
  v_esp    record;
  v_equipe jsonb;
  v_combat jsonb := null;
  v_fini   jsonb := null;
  v_sac    jsonb;
begin
  --  SANS LAISSEZ-PASSER, RIEN. Un visiteur déconnecté n'a pas
  --  d'équipe, et le récapitulatif ne se pose pas pour lui.
  if v_moi is null then
    return null;
  end if;

  --  LE COMBAT D'ABORD, parce que l'équipe en a besoin : c'est lui qui
  --  dit lequel des six se bat. Même condition que `mon_combat` :
  --  `joueur_id = v_moi` DANS la requête, pas après — dans un sujet à
  --  deux, l'autre voit la carte et n'agit pas (planche 99 §5.4).
  select * into v_c
    from combat
   where sujet_id = v_sujet and etat = 'ouvert' and joueur_id = v_moi;

  --  L'ÉQUIPE, AVEC LES PV DU SUJET (0049) — c'est tout l'intérêt :
  --  les PV durent le sujet, et le joueur doit pouvoir lire où en est
  --  son équipe sans remonter les messages.
  --
  --  `combat` EST UN DRAPEAU, PAS UN IDENTIFIANT. `mon_combat` fait
  --  déjà exactement ça, et pour la même raison : un identifiant de
  --  Pokémon n'a rien à faire dans une page publique, et le
  --  navigateur n'a besoin que de savoir LEQUEL marquer.
  select coalesce(jsonb_agg(jsonb_build_object(
           'position', m.position,
           'especeId', m.espece_id,
           'nom',      m.nom_fr,
           'surnom',   m.surnom,
           'niveau',   m.niveau,
           'pv',       pv_dans_le_sujet(v_sujet, m.id, m.pvmax),
           'pvMax',    m.pvmax,
           'combat',   v_c.pokemon_id is not null and m.id = v_c.pokemon_id
         ) order by m.position asc nulls last, m.capture_le asc), '[]'::jsonb)
    into v_equipe
    from (
      select pk.id, pk.position, pk.surnom, pk.niveau, pk.capture_le,
             pk.espece_id, e.nom_fr, pv_au_niveau(e.pv_base, pk.niveau) as pvmax
        from pokemon pk join espece e on e.id = pk.espece_id
       where pk.joueur_id = v_moi and pk.emplacement = 'equipe'
    ) m;

  if v_c.id is not null then
    select e.nom_fr, e.types, e.id into v_esp from espece e where e.id = v_c.espece_id;
    v_combat := jsonb_build_object(
      'tour', v_c.tour,
      'sauvage', jsonb_build_object(
        'especeId', v_esp.id,
        'nom',      v_esp.nom_fr,
        'niveau',   v_c.niveau_sauvage,
        'types',    to_jsonb(v_esp.types),
        'pv',       v_c.pv_sauvage,
        'pvMax',    v_c.pv_sauvage_max
      ),
      'pvPokemon',    v_c.pv_pokemon,
      'pvPokemonMax', v_c.pv_pokemon_max
    );
  else
    --  ── CE QUI VIENT DE SE PASSER ─────────────────────────────────
    --
    --  SEULEMENT S'IL N'Y A PAS DE COMBAT OUVERT. Montrer les deux
    --  ferait dire au panneau « tu es en combat » et « tu viens de
    --  capturer » dans la même colonne, pour deux Pokémon différents.
    --
    --  `order by ouvert_le desc` : un sujet de chasse enchaîne les
    --  rencontres, et c'est la dernière qui intéresse.
    select * into v_f
      from combat
     where sujet_id = v_sujet and joueur_id = v_moi and etat <> 'ouvert'
     order by ouvert_le desc
     limit 1;

    if v_f.id is not null then
      select e.nom_fr, e.types, e.id into v_esp from espece e where e.id = v_f.espece_id;
      v_fini := jsonb_build_object(
        'etat',     v_f.etat,
        'especeId', v_esp.id,
        'nom',      v_esp.nom_fr,
        'niveau',   v_f.niveau_sauvage,
        'types',    to_jsonb(v_esp.types)
      );
    end if;
  end if;

  --  ── LE SAC ENTIER, PAS SEULEMENT CE QUI SERT EN COMBAT ──────────
  --
  --  « Il faudrait aussi afficher le sac de la personne pour savoir ce
  --  qu'elle a, à l'instant T » — 18 novembre.
  --
  --  `mon_combat` ne rend que les balls et les potions, et c'est juste
  --  pour lui : chacune de ses lignes est un bouton, donc un tour
  --  dépensé. Ici on ne propose rien, on montre — une pierre
  --  d'évolution ou un fossile comptent autant pour décider quoi
  --  écrire.
  --
  --  LE NOM ET LA FAMILLE VIENNENT D'ICI, comme dans `mon_combat` :
  --  sans eux le navigateur devrait aller chercher le catalogue sur
  --  une page de sujet, pour trois lignes.
  select coalesce(jsonb_agg(jsonb_build_object(
           'objetId',  s.objet_id,
           'nom',      o.nom,
           'famille',  o.famille,
           'quantite', s.quantite
         ) order by o.famille, o.nom), '[]'::jsonb)
    into v_sac
    from sac s join objet o on o.id = s.objet_id
   where s.joueur_id = v_moi and s.quantite > 0;

  return jsonb_build_object(
    'equipe', v_equipe,
    'combat', v_combat,
    'fini',   v_fini,
    'sac',    v_sac
  );
end $$ language plpgsql stable security definer set search_path = public, extensions;

revoke all on function mon_sujet(jsonb) from public;
grant execute on function mon_sujet(jsonb) to anon, authenticated, service_role;

comment on function mon_sujet(jsonb) is
  'Ce que je dois savoir dans ce sujet : mon équipe avec ses PV du '
  'sujet, le combat ouvert s''il y en a un, sinon le dernier combat '
  'clos — « qui je viens de capturer », que le panneau peut dire avant '
  'même que la relève ait écrit sa ligne de registre —, et mon sac '
  '(0069).';
