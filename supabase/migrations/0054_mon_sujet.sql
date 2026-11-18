-- ════════════════════════════════════════════════════════════════════
--  0054 · Mon sujet
--
--  « Ce serait cool d'avoir le bilan du sujet qui nous suit, en petit
--  récap à droite ou à gauche, en vertical, pour savoir où on en est,
--  en tout temps » — et, précisé le 18 novembre : « à chaque fois
--  qu'une action est faite, en plus d'avoir les pokémons, il faudrait
--  une récap de son équipe et le combat en cours ».
--
--  ── POURQUOI PAS `mon_combat` ───────────────────────────────────────
--
--  `mon_combat` rend `null` QUAND IL N'Y A PAS DE COMBAT, et c'est
--  exactement ce qu'il faut à la barre d'actions : pas de combat, pas
--  de boutons de combat.
--
--  Le récapitulatif, lui, montre l'équipe dans TOUS les cas — un sujet
--  sans combat est le cas ordinaire, et c'est même là qu'on regarde
--  son équipe avant de faire apparaître quelque chose. Élargir
--  `mon_combat` aurait voulu dire changer la signification de son
--  `null` pour son seul appelant existant, et la barre se serait mise
--  à servir cinq boutons de combat sur un sujet qui n'en a pas.
--
--  Deux fonctions, deux questions : « ai-je un combat ouvert ici ? »
--  et « où en suis-je dans ce sujet ? ».
--
--  ── CE QU'ELLE NE REND PAS ──────────────────────────────────────────
--
--  LE BILAN DU SUJET. Il est déjà lu par le navigateur — le module
--  au-dessus du premier message le calcule depuis le registre, et
--  `src/navigateur/bilan.ts` le partage avec le serveur. Le refaire
--  ici donnerait deux additions du même registre, et elles
--  divergeraient le jour où l'une des deux change.
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

  return jsonb_build_object('equipe', v_equipe, 'combat', v_combat);
end $$ language plpgsql stable security definer set search_path = public, extensions;

revoke all on function mon_sujet(jsonb) from public;
grant execute on function mon_sujet(jsonb) to anon, authenticated, service_role;

comment on function mon_sujet(jsonb) is
  'Où en est le joueur connecté dans ce sujet : son équipe avec les '
  'PV du sujet, et le combat ouvert s''il y en a un. Sert au '
  'récapitulatif latéral. Rend NULL sans laissez-passer. Le bilan '
  'n''y est pas : le navigateur le calcule déjà depuis le registre, '
  'et deux additions du même registre finiraient par diverger.';
