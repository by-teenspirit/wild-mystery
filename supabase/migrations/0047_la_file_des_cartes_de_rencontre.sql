-- ════════════════════════════════════════════════════════════════════
--  0047 · La file des cartes de rencontre
--
--  « Il faut qu'il s'affiche en dessous de mon message, via un message
--  du Maître du Jeu, et qu'on ait ses stats. » — 17 novembre 2026.
--
--  ── LA LEÇON DU 2 OCTOBRE, PAYÉE UNE SEULE FOIS ─────────────────────
--
--  Ouvrir un combat et poster sa carte ne sont pas atomiques : entre
--  les deux il y a un forum, un réseau, et un compte dont le mot de
--  passe peut avoir expiré. C'est exactement ce qui est arrivé aux
--  bilans le 2 octobre — un sujet clos sans bilan, et plus rien pour
--  réessayer (planche 0006).
--
--  On applique la même réponse, et seulement elle : LE COMBAT EST LE
--  POINT DE NON-RETOUR, la carte est une tâche qu'on repasse jusqu'à
--  ce qu'elle passe. Reposter est sans danger — l'adaptateur pose un
--  marqueur et relit le sujet avant de renvoyer.
--
--  ── CE QU'ON NE STOCKE PAS, ET C'EST LA DIFFÉRENCE AVEC LE BILAN ────
--
--  La clôture garde SON TEXTE en colonne, parce qu'appliquer la
--  clôture consomme le registre : le bilan ne pourrait plus se
--  recomposer après coup.
--
--  Une carte de rencontre, non. La ligne `combat` porte encore tout ce
--  que la carte dit — l'espèce, le niveau, les PV, le combattant. La
--  ranger en texte serait ranger une chose qui se déduit, et deux
--  copies d'un même chiffre finissent par se contredire : on
--  corrigerait les PV dans `combat` et le sujet annoncerait les
--  anciens.
--
--  Donc la file ne porte QUE l'état d'envoi. Le texte se recompose à
--  l'instant où on poste, dans `carte-de-rencontre.ts`.
-- ════════════════════════════════════════════════════════════════════

-- ════════════════════════════════════════════════════════════════════
--  D'ABORD, UNE CORRECTION DE LA 0046
--
--  TOUTES LES FONCTIONS APPELÉES PAR LE CODE PRENNENT UN SEUL ARGUMENT
--  `jsonb` NOMMÉ `p`. Ce n'est pas une coquetterie : `AppelSql` poste un
--  seul corps JSON à PostgREST, et c'est ce qui permet au MÊME
--  adaptateur de tourner contre PostgREST en production et contre psql
--  dans le CI (en-tête de `appel.ts`).
--
--  `fermer_un_combat(uuid, text)` et `combat_du_sujet(integer)` ont été
--  écrites avec des arguments typés. Elles compilent, la suite pgTAP les
--  passe — et AUCUN CODE N'AURAIT PU LES APPELER. Une fonction qu'aucun
--  appelant ne peut atteindre est une fonction qui n'existe pas.
--
--  On les remplace ici plutôt que de retoucher la 0046 : elle est déjà
--  appliquée, et une migration appliquée ne se réécrit pas. `drop …
--  if exists` sur l'ancienne signature est sans effet si elle n'a jamais
--  existé — donc cette migration donne le même résultat que la 0046 ait
--  été montée ou non.
--
--  ET SURTOUT : `create or replace` sur une signature DIFFÉRENTE ne
--  remplace rien, il AJOUTE une surcharge. Les deux auraient vécu côte à
--  côte, et le jour où l'une est corrigée l'autre serait restée en
--  place. D'où le `drop`.
-- ════════════════════════════════════════════════════════════════════

drop function if exists fermer_un_combat(uuid, text);
drop function if exists combat_du_sujet(integer);

create or replace function fermer_un_combat(p jsonb)
returns boolean as $$
declare
  v_id   uuid := (p->>'combatId')::uuid;
  v_etat text := p->>'etat';
  v_fait integer;
begin
  if v_etat = 'ouvert' or v_etat is null then
    raise exception 'ETAT_DE_FERMETURE_INVALIDE';
  end if;
  --  `where etat = 'ouvert'` : refermer un combat clos ne doit pas
  --  changer sa fin ni sa date. La première fin l'emporte.
  update combat set etat = v_etat, clos_le = now()
   where id = v_id and etat = 'ouvert';
  get diagnostics v_fait = row_count;
  return v_fait = 1;
end $$ language plpgsql security definer set search_path = public, extensions;

create or replace function combat_du_sujet(p jsonb)
returns jsonb as $$
  select jsonb_build_object(
    'combatId',     c.id,
    'joueurId',     c.joueur_id,
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

comment on function fermer_un_combat(jsonb) is
  'Ferme un combat ouvert et date la fin. Rend faux s''il était déjà '
  'clos : la première fin l''emporte.';
comment on function combat_du_sujet(jsonb) is
  'Le combat ouvert d''un sujet, ou rien. Sert à la barre d''actions '
  'pour choisir ses boutons ; ne rend que ce qui est déjà affiché '
  'dans le sujet.';

revoke all on function fermer_un_combat(jsonb) from public;
revoke all on function fermer_un_combat(jsonb) from anon, authenticated;
grant execute on function fermer_un_combat(jsonb) to service_role;

revoke all on function combat_du_sujet(jsonb) from public;
grant execute on function combat_du_sujet(jsonb) to anon, authenticated, service_role;

-- ── LA FILE ──────────────────────────────────────────────────────────

alter table combat add column if not exists carte_poste_le        timestamptz;
alter table combat add column if not exists carte_message_id      bigint;
alter table combat add column if not exists carte_essais          integer not null default 0;
alter table combat add column if not exists carte_derniere_erreur text;

comment on column combat.carte_poste_le is
  'Null tant que la carte de rencontre n''est pas publiée dans le '
  'sujet. C''est la file d''attente.';
comment on column combat.carte_essais is
  'Combien de fois on a essayé de poster la carte. Au-delà de dix, la '
  'tâche le signale à chaque passage plutôt que de réessayer en '
  'silence : un envoi qui a échoué dix fois ne passera pas à la '
  'onzième sans intervention.';

create index if not exists combat_carte_en_attente
  on combat (ouvert_le) where carte_poste_le is null;

-- ════════════════════════════════════════════════════════════════════
--  CE QUE LA CARTE DOIT DIRE, EN UNE LECTURE
--
--  Un seul appel rend tout : le sauvage avec ses trois chiffres au
--  niveau, le combattant avec les siens, et le pseudo à mentionner.
--  La tâche n'a donc rien à rechercher ensuite — et surtout, LES
--  CHIFFRES SONT CALCULÉS ICI, par les fonctions de la 0045, au même
--  endroit que ceux du combat lui-même.
--
--  Les faire calculer au navigateur ou à la tâche rouvrirait la porte
--  qu'on vient de fermer : deux formules, deux résultats, et un joueur
--  qui lit sur la carte autre chose que ce que le combat applique.
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
        'mentionne', j.pseudo,
        'sauvage', jsonb_build_object(
          'nom',     es.nom_fr,
          'niveau',  cb.niveau_sauvage,
          'types',   to_jsonb(es.types),
          --  LES PV RESTANTS, pas le maximum : si la carte repart
          --  après un tour déjà joué — ce qui n'arrive qu'en cas
          --  d'incident —, elle doit dire l'état réel, pas celui de
          --  l'ouverture.
          'pv',      cb.pv_sauvage,
          'attaque', stat_au_niveau(es.att_base, cb.niveau_sauvage),
          'defense', stat_au_niveau(es.def_base, cb.niveau_sauvage)
        ),
        'combattant', case when pk.id is null then null else jsonb_build_object(
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

comment on function cartes_a_poster(jsonb) is
  'Les cartes de rencontre qui attendent d''être publiées, avec tout '
  'ce qu''elles doivent dire. Les chiffres au niveau sont calculés ici '
  'par les fonctions de la 0045 : une seule formule, un seul résultat.';

-- ── LES DEUX ISSUES D'UN ENVOI ───────────────────────────────────────

create or replace function carte_postee(p jsonb)
returns boolean as $$
declare
  v_combat  uuid   := (p->>'combat')::uuid;
  v_message bigint := (p->>'message')::bigint;
  v_fait    integer;
begin
  --  `where carte_poste_le is null` : un second succès sur la même
  --  carte ne doit pas remplacer le numéro du message déjà noté. Le
  --  premier message posté est celui que les joueurs ont lu.
  update combat
     set carte_poste_le = now(), carte_message_id = v_message,
         carte_derniere_erreur = null
   where id = v_combat and carte_poste_le is null;
  get diagnostics v_fait = row_count;
  return v_fait = 1;
end $$ language plpgsql security definer set search_path = public, extensions;

create or replace function carte_echouee(p jsonb)
returns integer as $$
declare
  v_combat uuid := (p->>'combat')::uuid;
  v_essais integer;
begin
  update combat
     set carte_essais = carte_essais + 1,
         carte_derniere_erreur = p->>'erreur'
   where id = v_combat and carte_poste_le is null
  returning carte_essais into v_essais;
  --  Zéro, et pas null : la carte était déjà postée, donc cet échec
  --  n'en est pas un — c'est un envoi en double qui a été refusé, et
  --  la tâche ne doit pas le compter contre elle.
  return coalesce(v_essais, 0);
end $$ language plpgsql security definer set search_path = public, extensions;

comment on function carte_postee(jsonb) is
  'Note la carte comme publiée. Rend faux si elle l''était déjà : le '
  'premier message posté est celui que les joueurs ont lu.';
comment on function carte_echouee(jsonb) is
  'Compte un échec d''envoi et garde son motif. Rend le nombre '
  'd''essais, ou zéro si la carte était déjà postée.';

-- ── LES PERMISSIONS ──────────────────────────────────────────────────
--
--  LA FILE EST AU SERVEUR, ENTIÈREMENT. Personne ne lit depuis le
--  navigateur ce que le Maître du Jeu s'apprête à poster : la carte
--  arrive dans le sujet, pas avant.

revoke all on function cartes_a_poster(jsonb) from public;
revoke all on function cartes_a_poster(jsonb) from anon, authenticated;
grant execute on function cartes_a_poster(jsonb) to service_role;

revoke all on function carte_postee(jsonb) from public;
revoke all on function carte_postee(jsonb) from anon, authenticated;
grant execute on function carte_postee(jsonb) to service_role;

revoke all on function carte_echouee(jsonb) from public;
revoke all on function carte_echouee(jsonb) from anon, authenticated;
grant execute on function carte_echouee(jsonb) to service_role;
