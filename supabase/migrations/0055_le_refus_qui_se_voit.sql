-- ════════════════════════════════════════════════════════════════════
--  0055 · Le refus qui se voit
--
--  « Ça ne fonctionne plus » — 18 novembre, deux fois dans la journée.
--  Ça fonctionnait : un combat tournait déjà dans le sujet, la relève
--  refusait d'en ouvrir un second, et le motif partait dans les
--  journaux. Le joueur, lui, ne voyait rien. Il a recliqué, puis
--  recliqué encore.
--
--  ── LE REFUS DEVIENT UN MESSAGE, SANS NOUVELLE FILE ─────────────────
--
--  La tentation était d'ajouter une troisième file de messages à côté
--  des cartes et des tours. On n'en a pas besoin : la carte du combat
--  en cours dit DÉJÀ exactement ce qu'il faut dire — qui se bat, à
--  combien de PV, et ce qu'on peut faire. Il suffit de la redemander.
--
--  `rappeler_la_carte` remet donc `carte_poste_le` à null sur le
--  combat ouvert du sujet, et la file existante s'en occupe au passage
--  suivant. Rien de neuf à poster, à réessayer, à surveiller.
--
--  ── ET LA CARTE SAIT QU'ELLE EST UN RAPPEL ──────────────────────────
--
--  « Un Debugant sauvage apparaît » est faux la seconde fois.
--  `carte_message_id` porte le message du premier envoi et ne s'efface
--  jamais : la file rend donc `rappel`, et la composition change sa
--  première phrase. Aucune colonne de plus.
--
--  LES ESSAIS REPARTENT À ZÉRO avec le rappel. Ce n'est pas la même
--  tentative : une carte qui avait échoué dix fois hier ne doit pas
--  refuser de repartir aujourd'hui parce qu'on a redemandé la même
--  ligne.
-- ════════════════════════════════════════════════════════════════════

create or replace function cartes_a_poster(p jsonb)
returns jsonb as $$
  select coalesce(jsonb_agg(c order by c.ouvert_le), '[]'::jsonb)
    from (
      select jsonb_build_object(
        'combatId',  cb.id,
        'sujetId',   cb.sujet_id,
        'messageId', cb.message_id,
        'essais',    cb.carte_essais,
        --  UNE CARTE DÉJÀ POSTÉE UNE FOIS EST UN RAPPEL, et elle ne
        --  s'écrit pas pareil : « un Debugant sauvage apparaît » est
        --  faux la seconde fois. `carte_message_id` porte le message
        --  du premier envoi et ne s'efface jamais — c'est lui qui
        --  distingue les deux, sans colonne de plus.
        'rappel',    cb.carte_message_id is not null,
        'mentionne', j.pseudo,
        'sauvage', jsonb_build_object(
          'especeId', es.id,
          'nom',     es.nom_fr,
          'niveau',  cb.niveau_sauvage,
          'types',   to_jsonb(es.types),
          --  LES PV RESTANTS, pas le maximum : si la carte repart
          --  après un tour déjà joué — ce qui n'arrive qu'en cas
          --  d'incident —, elle doit dire l'état réel, pas celui de
          --  l'ouverture.
          'pv',      cb.pv_sauvage,
          --  LE MAXIMUM NE PART QUE POUR UN RAPPEL. À l'apparition, le
          --  sauvage est entier et « 30/30 PV » ferait croire qu'il a
          --  déjà pris des coups ; au rappel, il peut être entamé et
          --  « 18 PV » tout court ne dit plus rien.
          'pvMax',   case when cb.carte_message_id is null
                          then null else cb.pv_sauvage_max end,
          'attaque', stat_au_niveau(es.att_base, cb.niveau_sauvage),
          'defense', stat_au_niveau(es.def_base, cb.niveau_sauvage)
        ),
        'combattant', case when pk.id is null then null else jsonb_build_object(
          'especeId', ep.id,
          'nom',     ep.nom_fr,
          'surnom',  pk.surnom,
          'niveau',  pk.niveau,
          'types',   to_jsonb(ep.types),
          'pv',      cb.pv_pokemon,
          'pvMax',   cb.pv_pokemon_max,
          'attaque', stat_au_niveau(ep.att_base, pk.niveau),
          'defense', stat_au_niveau(ep.def_base, pk.niveau)
        ) end
      ) as c, cb.ouvert_le
      from combat cb
      join joueur j  on j.id = cb.joueur_id
      join espece es on es.id = cb.espece_id
      left join pokemon pk on pk.id = cb.pokemon_id
      left join espece  ep on ep.id = pk.espece_id
      --  ON NE POSTE QUE LES COMBATS OUVERTS. Un combat clos avant que
      --  sa carte ne parte — le sujet clôturé entre-temps — n'a plus
      --  de carte à poster : annoncer « à toi de jouer » dans un sujet
      --  fermé serait pire que le silence.
      where cb.carte_poste_le is null and cb.etat = 'ouvert'
      order by cb.ouvert_le
      limit greatest(1, least(coalesce((p->>'combien')::integer, 10), 50))
    ) c;
$$ language sql stable security definer set search_path = public, extensions;

revoke all on function cartes_a_poster(jsonb) from public;
grant execute on function cartes_a_poster(jsonb) to service_role;

-- ════════════════════════════════════════════════════════════════════
--  REDEMANDER LA CARTE DU COMBAT EN COURS
-- ════════════════════════════════════════════════════════════════════

create or replace function rappeler_la_carte(p jsonb)
returns jsonb as $$
declare
  v_sujet bigint := (p->>'sujetId')::bigint;
  v_id    uuid;
begin
  if v_sujet is null then
    raise exception 'rappeler_la_carte : sujetId manquant';
  end if;

  --  SEULEMENT UN COMBAT OUVERT, et seulement s'il a DÉJÀ été annoncé.
  --  Une carte qui n'est pas encore partie est dans la file : la
  --  redemander ne ferait que remettre à zéro ses essais, et on
  --  masquerait un envoi qui échoue.
  update combat
     set carte_poste_le = null,
         carte_essais   = 0
   where sujet_id = v_sujet
     and etat = 'ouvert'
     and carte_poste_le is not null
     and carte_message_id is not null
   returning id into v_id;

  return jsonb_build_object('rappelee', v_id is not null);
end $$ language plpgsql security definer set search_path = public, extensions;

comment on function rappeler_la_carte(jsonb) is
  'Remet la carte du combat ouvert d''un sujet dans la file, pour '
  'répondre à un joueur qui a demandé une rencontre alors qu''un '
  'combat tournait déjà. Rend `rappelee: false` quand il n''y a rien '
  'à rappeler — ce n''est pas une erreur.';

revoke all on function rappeler_la_carte(jsonb) from public;
revoke all on function rappeler_la_carte(jsonb) from anon, authenticated;
grant execute on function rappeler_la_carte(jsonb) to service_role;
