-- ════════════════════════════════════════════════════════════════════
--  0057 · Le sac dans le sujet
--
--  « Il faudrait aussi afficher le sac de la personne pour savoir ce
--  qu'elle a, à l'instant T » — 18 novembre, à propos du
--  récapitulatif latéral.
--
--  ── POURQUOI `mon_sujet` ET PAS UNE FONCTION DE PLUS ────────────────
--
--  Le récapitulatif fait déjà UN appel par page. Une seconde fonction
--  en ferait deux pour la même question — « où en suis-je dans ce
--  sujet ? » —, et les deux réponses pourraient arriver dans des
--  ordres différents, donc se contredire à l'écran pendant un
--  battement.
--
--  ── ET POURQUOI PAS CELUI DE `mon_combat` ───────────────────────────
--
--  `mon_combat` ne rend que les balls et les potions : chacune de ses
--  lignes est un BOUTON, donc un tour dépensé, et une pierre
--  d'évolution dans cette liste proposerait un geste qui n'existe pas.
--
--  Ici personne ne propose rien : on montre ce qu'on a. Une pierre, un
--  fossile ou un objet tenu comptent autant pour décider quoi écrire.
--  Le sac entier, donc.
--
--  ── LA FRONTIÈRE NE BOUGE PAS ───────────────────────────────────────
--
--  `joueur_courant()`, comme avant : sans laissez-passer, la fonction
--  rend `null`. Le sac reste privé — c'est `combat_du_sujet` qui est
--  publique, et elle ne rend que ce que le sujet montre déjà.
-- ════════════════════════════════════════════════════════════════════

create or replace function mon_sujet(p jsonb)
returns jsonb as $$
declare
  v_sujet  integer := (p->>'sujetId')::integer;
  v_moi    uuid    := joueur_courant();
  v_c      combat%rowtype;
  v_esp    record;
  v_equipe jsonb;
  v_combat jsonb := null;
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

  return jsonb_build_object('equipe', v_equipe, 'combat', v_combat, 'sac', v_sac);
end $$ language plpgsql stable security definer set search_path = public, extensions;

revoke all on function mon_sujet(jsonb) from public;
grant execute on function mon_sujet(jsonb) to anon, authenticated, service_role;

comment on function mon_sujet(jsonb) is
  'Où en est le joueur connecté dans ce sujet : son équipe avec les '
  'PV du sujet, le combat ouvert s''il y en a un, et son sac entier. '
  'Sert au '
  'récapitulatif latéral. Rend NULL sans laissez-passer. Le bilan '
  'n''y est pas : le navigateur le calcule déjà depuis le registre, '
  'et deux additions du même registre finiraient par diverger.';
