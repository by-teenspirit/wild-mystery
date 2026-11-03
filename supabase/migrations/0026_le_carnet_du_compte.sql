-- ════════════════════════════════════════════════════════════════════
--  0026 · Le carnet s'ouvre tout seul
--
--  « En principe, ça devrait être automatique. Pas de sujet
--  d'ouverture ou quoi », 3 novembre.
--
--  ── CE QUI CHANGE, ET CE QUE ÇA COÛTE ───────────────────────────────
--
--  Jusqu'ici la page prouvait son identité avec un secret de 32
--  caractères : le joueur postait l'empreinte de sa clé dans un sujet,
--  la relève liait l'empreinte au compte qui l'avait postée, et la page
--  échangeait le secret contre la clé. Un menteur ne pouvait rien
--  réclamer, et c'était tout l'intérêt.
--
--  On enlève ce secret. La page lira l'identifiant du membre sur une
--  page du forum — `_userdata["user_id"]`, servi à qui porte la bonne
--  session, mesuré le 3 novembre depuis `/h15-mon-carnet` — et le
--  passera ici.
--
--  **LE PRIX EST RÉEL ET IL EST ASSUMÉ.** Cette fonction tourne pour
--  `anon` et ne vérifie aucun secret : qui appelle avec un numéro
--  obtient le carnet qui va avec. Donc l'équipe, les boîtes, le sac,
--  l'argent et le pokédex d'un joueur sont lisibles par qui connaît
--  son numéro de compte — et ce numéro est public, il est dans
--  l'adresse de son profil. C'est le choix du 3 novembre, pris en
--  connaissance de cause : « aucune clé, on fait confiance au forum ».
--
--  ── CE QUI NE PASSE PAS PAR LÀ, ET N'Y PASSERA PAS ──────────────────
--
--  **AUCUNE ÉCRITURE.** Ranger un pokémon, acheter, déposer en
--  pension : tout ça resterait à la portée du même menteur, et une
--  lecture indiscrète n'est pas du même ordre qu'un sac vidé. Les
--  fonctions d'écriture gardent la clé, ou un jeton, ou ne seront pas
--  ouvertes à `anon`. C'est à décider quand elles arriveront, pas
--  maintenant, et surtout pas par distraction.
--
--  Le reste de la machinerie de la clé — `carnet_joueur`,
--  `carnet(cle)`, `carnet_reclamer`, la table des réclamations — reste
--  en place et cesse simplement d'être employée par la page. Revenir
--  en arrière est alors une ligne de JavaScript, pas une migration.
--
--  ── POURQUOI UNE FONCTION INTERNE ───────────────────────────────────
--
--  Le corps de `carnet()` fait cent dix lignes et ne dépend que de
--  l'identifiant du joueur. Le recopier pour la seconde entrée aurait
--  donné deux carnets à tenir d'accord, et le second aurait dérivé au
--  premier onglet ajouté. On l'extrait donc une fois, et les deux
--  entrées sont minces.
-- ════════════════════════════════════════════════════════════════════

-- ── 1 · le carnet, à partir du joueur et de rien d'autre ───────────

create or replace function carnet_interieur(p_joueur uuid)
returns jsonb as $$
declare
  v_joueur uuid := p_joueur;
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

--  ELLE N'EST PAS OUVERTE : elle prend un identifiant de joueur sans
--  rien vérifier, parce que c'est son rôle. Ce sont les deux entrées
--  au-dessus qui décident qui a le droit.
revoke all on function carnet_interieur(uuid) from public;
revoke all on function carnet_interieur(uuid) from anon, authenticated;
grant execute on function carnet_interieur(uuid) to service_role;

-- ── 2 · par la clé, comme avant ────────────────────────────────────

create or replace function carnet(p jsonb)
returns jsonb as $$
  select carnet_interieur(carnet_joueur(p->>'cle'));
$$ language sql security definer set search_path = public;

revoke all on function carnet(jsonb) from public;
grant execute on function carnet(jsonb) to anon, authenticated, service_role;

-- ── 3 · par le compte du forum, ce que la page emploie ─────────────

--  `null` POUR UN COMPTE INCONNU, et pas une exception : un membre qui
--  n'a pas encore été validé n'a pas de ligne, et sa visite du carnet
--  n'est pas une erreur. La page lui dit d'attendre sa validation.
--  C'est la même décision que pour `carte_dresseur` en 0020.
create or replace function carnet_du_compte(p jsonb)
returns jsonb as $$
  select carnet_interieur(j.id)
    from joueur j
   where j.forum_user_id = (p->>'forumUserId')::integer;
$$ language sql security definer set search_path = public;

revoke all on function carnet_du_compte(jsonb) from public;
grant execute on function carnet_du_compte(jsonb) to anon, authenticated, service_role;

comment on function carnet_du_compte(jsonb) is
  'Le carnet d''un membre, par son numéro de compte forum. Aucune '
  'vérification : voir l''en-tête de la migration 0026. Lecture seule.';
