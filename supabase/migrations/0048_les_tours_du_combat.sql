-- ════════════════════════════════════════════════════════════════════
--  0048 · Les tours du combat
--
--  « Je peux attaquer le pokémon, lancer une pokeball, utiliser quelque
--  chose de mon sac ou fuir, ou changer de pokémon. »
--  — 17 novembre 2026.
--
--  ── UN TOUR EST UNE LIGNE, ET SON IDENTITÉ EST LE MESSAGE ───────────
--
--  La relève relit. C'est la troisième fois que cette phrase décide
--  d'un schéma — le registre, le combat, et maintenant les tours — et
--  c'est la même garde qui répond : `unique (message_id)`. Sans elle,
--  une relecture rejouerait le tour, les dégâts tomberaient deux fois,
--  et un Pokémon mourrait d'un message qu'il avait déjà encaissé.
--
--  ── POURQUOI ON GARDE LE RÉCIT, DÉS COMPRIS ─────────────────────────
--
--  Le domaine rend un tour complet : qui a frappé, avec quoi, le
--  multiplicateur de types, et LE DÉ. On le range tel quel en `jsonb`.
--
--  Ce n'est pas de la redondance. Un combat se joue EN PUBLIC, dans un
--  sujet, et une contestation se tranche en montrant le tirage. Le
--  recalculer depuis la graine marcherait aujourd'hui ; dans un an, une
--  base de PokéAPI corrigée ou une formule ajustée donneraient un autre
--  chiffre, et on ne saurait plus lequel des deux le joueur a lu.
--
--  LE RÉCIT EST LA TRACE, PAS LA SOURCE. Les PV qui comptent sont ceux
--  de `combat` ; ceux d'ici disent où on en était après ce tour-là.
--
--  ── CE QUE CETTE TABLE NE CALCULE PAS ───────────────────────────────
--
--  Rien. Le calcul est dans `src/domaine/combat.ts`, testé sans
--  navigateur et sans base. La base VÉRIFIE et ENREGISTRE : elle refuse
--  un tour hors bornes, un tour sur un combat clos, un second tour du
--  même message. Mettre la formule ici en ferait une deuxième, et deux
--  formules finissent par ne plus dire la même chose.
-- ════════════════════════════════════════════════════════════════════

create table if not exists combat_tour (
  id         uuid primary key default gen_random_uuid(),
  combat_id  uuid not null references combat(id) on delete cascade,
  --  LE MESSAGE DU JOUEUR QUI A JOUÉ CE TOUR. Son identité.
  message_id integer not null,
  numero     smallint not null check (numero between 1 and 5),
  --  CE QU'IL A DEMANDÉ, dans les mots du bloc d'action
  --  (`domaine/action.ts`). Pas le résultat : la demande.
  demande    text not null
    check (demande in ('attaquer', 'ball', 'objet', 'changer', 'fuir')),
  --  L'ARGUMENT, tel que le bloc le portait : la capacité, l'objet, la
  --  case d'équipe. En `jsonb` parce que les cinq demandes n'ont pas le
  --  même argument, et qu'une colonne par verbe laisserait quatre NULL
  --  sur cinq lignes.
  detail     jsonb,
  recit      jsonb not null,
  pv_joueur  smallint not null check (pv_joueur >= 0),
  pv_sauvage smallint not null check (pv_sauvage >= 0),
  --  `null` quand le combat continue. Les mêmes mots que `combat.etat`,
  --  moins `ouvert` et `expire` : un tour ne fait pas expirer un combat,
  --  c'est la clôture du sujet qui le fait.
  fin        text check (fin in ('victoire', 'defaite', 'fuite', 'capture')),
  joue_le    timestamptz not null default now(),

  --  ── LA FILE DE PUBLICATION, MÊME MOTIF QUE LA 0047 ───────────────
  carte_poste_le        timestamptz,
  carte_message_id      bigint,
  carte_essais          integer not null default 0,
  carte_derniere_erreur text
);

create unique index if not exists combat_tour_un_par_message
  on combat_tour (message_id);

--  DEUX TOURS NUMÉRO 3 DANS UN COMBAT : impossible. C'est la garde qui
--  protège contre un tour joué depuis deux messages différents postés
--  dans le même passage — la première l'emporte, et la seconde ne
--  s'écrit pas.
create unique index if not exists combat_tour_un_par_numero
  on combat_tour (combat_id, numero);

create index if not exists combat_tour_a_poster
  on combat_tour (joue_le) where carte_poste_le is null;

comment on table combat_tour is
  'Un tour de combat, identifié par le message du joueur qui l''a joué. '
  'Le récit porte le tirage pour qu''une contestation se tranche en le '
  'montrant, pas en le recalculant des années plus tard.';

-- ════════════════════════════════════════════════════════════════════
--  CE QU'IL FAUT POUR RÉSOUDRE UN TOUR
--
--  Un seul appel, et il rend TOUT : le combat, les deux combattants
--  avec leurs trois chiffres au niveau, et les quatre capacités de
--  chacun.
--
--  LE SAUVAGE A DES CAPACITÉS, LUI AUSSI, et c'est le détail qu'on
--  oublie en écrivant « le joueur attaque ». Sans elles il ne riposte
--  pas, et un combat où le sauvage ne frappe jamais n'est pas un combat.
--  Elles se tirent de `espece_capacite` à son niveau, par la même
--  fonction que celles d'un Pokémon capturé (`capacites_de_depart`,
--  0044) : le sauvage joue avec les mêmes règles que les autres.
-- ════════════════════════════════════════════════════════════════════

create or replace function combat_pour_jouer(p jsonb)
returns jsonb as $$
declare
  v_sujet integer := (p->>'sujetId')::integer;
  v_c     combat%rowtype;
  v_pok   record;
  v_esp   record;
  v_siens jsonb;
  v_leurs jsonb;
begin
  select * into v_c from combat where sujet_id = v_sujet and etat = 'ouvert';
  if not found then
    return null;
  end if;

  select e.nom_fr, e.types, e.pv_base, e.att_base, e.def_base
    into v_esp from espece e where e.id = v_c.espece_id;

  --  LES CAPACITÉS DU SAUVAGE, tirées à son niveau.
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', c.id, 'nom', c.nom, 'type', c.type,
           'puissance', c.puissance, 'precision', c."precision"
         ) order by c.id), '[]'::jsonb)
    into v_leurs
    from capacite c
   where c.id = any (capacites_de_depart(v_c.espece_id, v_c.niveau_sauvage));

  --  ET CELLES DU COMBATTANT, qui sont RANGÉES et non tirées : il les a
  --  choisies, ou la dotation les lui a posées. On lit la table de
  --  liaison, pas la fonction.
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

  return jsonb_build_object(
    'combatId', v_c.id,
    'sujetId',  v_c.sujet_id,
    'joueurId', v_c.joueur_id,
    'tour',     v_c.tour,
    'sauvage', jsonb_build_object(
      'especeId',  v_c.espece_id,
      'nom',       v_esp.nom_fr,
      'niveau',    v_c.niveau_sauvage,
      'types',     to_jsonb(v_esp.types),
      'pv',        v_c.pv_sauvage,
      'pvMax',     v_c.pv_sauvage_max,
      'attaque',   stat_au_niveau(v_esp.att_base, v_c.niveau_sauvage),
      'defense',   stat_au_niveau(v_esp.def_base, v_c.niveau_sauvage),
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
    ) end
  );
end $$ language plpgsql stable security definer set search_path = public, extensions;

comment on function combat_pour_jouer(jsonb) is
  'Tout ce qu''il faut pour résoudre un tour du combat ouvert d''un '
  'sujet : les deux combattants, leurs chiffres au niveau et leurs '
  'quatre capacités. Le sauvage a les siennes — sans elles il ne '
  'riposte pas.';

-- ════════════════════════════════════════════════════════════════════
--  ENREGISTRER UN TOUR
--
--  Le calcul est fait, la base le range et en tire les conséquences sur
--  `combat`. Elle refuse quatre choses, et chacune a sa raison :
--
--  · un tour dont le message est déjà joué → on rend le tour existant.
--    C'est l'idempotence, et c'est pour la relève qui relit.
--  · un combat qui n'est plus ouvert → le sujet s'est clos entre-temps,
--    ou le combat s'est fini. On ne frappe pas un combat terminé.
--  · un numéro qui n'est pas le suivant → deux messages du même passage
--    voudraient jouer le tour 3. Le premier l'emporte.
--  · une fin inconnue → mieux vaut lever que ranger un mot que
--    personne ne saura relire.
-- ════════════════════════════════════════════════════════════════════

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
  v_deja    combat_tour%rowtype;
  v_c       combat%rowtype;
  v_id      uuid;
begin
  if v_combat is null or v_message is null or v_numero is null then
    raise exception 'TOUR_PARAMETRES_MANQUANTS';
  end if;
  if p->'recit' is null or p->'recit' = 'null'::jsonb then
    raise exception 'TOUR_SANS_RECIT';
  end if;
  if v_fin is not null and v_fin not in ('victoire', 'defaite', 'fuite', 'capture') then
    raise exception 'FIN_INCONNUE';
  end if;

  select * into v_deja from combat_tour where message_id = v_message;
  if found then
    return jsonb_build_object(
      'tourId', v_deja.id, 'joue', false, 'numero', v_deja.numero,
      'raison', 'DEJA_JOUE'
    );
  end if;

  --  `for update` : deux messages du même passage ne doivent pas lire
  --  le même numéro de tour et s'écrire par-dessus. L'index unique
  --  `(combat_id, numero)` attraperait le second, mais avec une erreur
  --  de contrainte plutôt qu'un refus lisible.
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

  insert into combat_tour (
    combat_id, message_id, numero, demande, detail, recit,
    pv_joueur, pv_sauvage, fin
  ) values (
    v_combat, v_message, v_numero, v_demande, p->'detail', p->'recit',
    v_pvj, v_pvs, v_fin
  ) returning id into v_id;

  --  LES PV QUI COMPTENT SONT CEUX DE `combat`. Ceux du tour disent où
  --  on en était ; ceux-ci disent où on en est.
  update combat
     set pv_pokemon = v_pvj,
         pv_sauvage = v_pvs,
         tour       = v_numero,
         etat       = coalesce(v_fin, etat),
         clos_le    = case when v_fin is null then clos_le else now() end
   where id = v_combat;

  return jsonb_build_object(
    'tourId', v_id, 'joue', true, 'numero', v_numero, 'fin', v_fin
  );
end $$ language plpgsql security definer set search_path = public, extensions;

comment on function jouer_un_tour(jsonb) is
  'Enregistre un tour déjà calculé par le domaine et en tire les '
  'conséquences sur le combat. Idempotente par le numéro du message ; '
  'refuse un combat clos et un tour qui n''est pas le suivant.';

-- ── LA FILE DES MESSAGES DE TOUR ─────────────────────────────────────
--
--  Même motif que les cartes de rencontre (0047), et le texte n'est pas
--  stocké pour la même raison : la ligne porte déjà tout ce que le
--  message dit.

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
        'joueLe',    t.joue_le,
        'sauvage',   jsonb_build_object(
          'nom',   es.nom_fr,
          'pv',    t.pv_sauvage,
          'pvMax', cb.pv_sauvage_max
        ),
        'combattant', case when pk.id is null then null else jsonb_build_object(
          'nom',    ep.nom_fr,
          'surnom', pk.surnom,
          'pv',     t.pv_joueur,
          'pvMax',  cb.pv_pokemon_max
        ) end
      ) as x, t.joue_le
      from combat_tour t
      join combat cb on cb.id = t.combat_id
      join joueur  j on j.id = cb.joueur_id
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

create or replace function tour_poste(p jsonb)
returns boolean as $$
declare
  v_fait integer;
begin
  update combat_tour
     set carte_poste_le = now(),
         carte_message_id = (p->>'message')::bigint,
         carte_derniere_erreur = null
   where id = (p->>'tour')::uuid and carte_poste_le is null;
  get diagnostics v_fait = row_count;
  return v_fait = 1;
end $$ language plpgsql security definer set search_path = public, extensions;

create or replace function tour_echoue(p jsonb)
returns integer as $$
declare
  v_essais integer;
begin
  update combat_tour
     set carte_essais = carte_essais + 1,
         carte_derniere_erreur = p->>'erreur'
   where id = (p->>'tour')::uuid and carte_poste_le is null
  returning carte_essais into v_essais;
  return coalesce(v_essais, 0);
end $$ language plpgsql security definer set search_path = public, extensions;

comment on function tours_a_poster(jsonb) is
  'Les tours qui attendent leur message, avec tout ce qu''il doit dire. '
  'Y compris celui qui a fini le combat : c''est lui qui annonce la '
  'victoire.';

-- ── LES PERMISSIONS ──────────────────────────────────────────────────
--
--  LES TOURS SONT AU SERVEUR. Un tour qu'on peut écrire soi-même est un
--  combat qu'on gagne en écrivant qu'on l'a gagné. La lecture passe par
--  la clé de carnet, comme le reste — un joueur peut relire ses propres
--  combats, et c'est tout.

alter table combat_tour enable row level security;

drop policy if exists "chacun lit ses tours" on combat_tour;
create policy "chacun lit ses tours" on combat_tour
  for select using (
    exists (
      select 1 from combat cb join joueur j on j.id = cb.joueur_id
       where cb.id = combat_tour.combat_id
         and j.cle_de_carnet = current_setting('request.headers', true)::json ->> 'x-wm-carnet'
    )
  );

grant select on combat_tour to anon, authenticated;

revoke all on function combat_pour_jouer(jsonb) from public, anon, authenticated;
grant execute on function combat_pour_jouer(jsonb) to service_role;

revoke all on function jouer_un_tour(jsonb) from public, anon, authenticated;
grant execute on function jouer_un_tour(jsonb) to service_role;

revoke all on function tours_a_poster(jsonb) from public, anon, authenticated;
grant execute on function tours_a_poster(jsonb) to service_role;

revoke all on function tour_poste(jsonb) from public, anon, authenticated;
grant execute on function tour_poste(jsonb) to service_role;

revoke all on function tour_echoue(jsonb) from public, anon, authenticated;
grant execute on function tour_echoue(jsonb) to service_role;
