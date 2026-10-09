-- ════════════════════════════════════════════════════════════════════
--  0017 · une analyse se demande, et son verdict s'annonce
--
--  `0016` a donné aux fossiles leur espèce et leurs morceaux. Il reste
--  deux trous, et ce sont les deux bouts de la tâche 5 :
--
--    · RIEN N'INSÈRE JAMAIS dans `analyse_fossile`. La table existe
--      depuis `0001`, `rendre_fossile` sait la lire depuis `0002`, et
--      aucune ligne n'y est jamais entrée autrement que par un test.
--      Un joueur n'a aucun moyen de DEMANDER une réanimation.
--    · `rendre_fossile` écrit `etat = 'rendue'` et insère le Pokémon,
--      PUIS la relève poste le message. Deux gestes non atomiques, et
--      l'analyse a quitté `en_attente` entre les deux : si le forum est
--      injoignable à cet instant, le joueur a son Pokémon et n'apprend
--      jamais lequel. **C'est mot pour mot le défaut du 2 octobre**,
--      celui de `0006`, sur une autre table.
--
--  ── LA RÉPONSE EST CELLE DE 0006, PAS UNE AUTRE ─────────────────────
--
--  On ne touche pas à l'ordre : rendre reste le point de non-retour, et
--  l'annonce devient une tâche qu'on repasse. Ce qui rend le repassage
--  possible, c'est que `rendre_fossile` GARDE SON VERDICT dans la ligne
--  et le rende tel quel au second appel. La fonction devient donc
--  idempotente, exactement comme `boutique_servir` l'est par
--  `commande.message_id`.
--
--  Garder le verdict plutôt que de le recalculer n'est pas de la
--  prudence : un refus FOSSILE_ABSENT recalculé le lendemain pourrait
--  tomber sur un sac entre-temps regarni, et la relève annoncerait une
--  réanimation là où elle avait refusé — ou l'inverse. Le verdict est
--  rendu une fois ; le message qui le porte peut mettre trois passages à
--  partir.
--
--  ── L'ANALYSE PORTE SON SUJET ───────────────────────────────────────
--
--  `sujet_id` est nouveau, et il évite une configuration entière : la
--  réponse part là où la demande a été faite, et la tâche d'annonce n'a
--  donc RIEN à savoir du laboratoire. C'est `PosterLesBilans` et pas
--  `ServirUneCommande` : aucun `data/laboratoires.json` à tenir, aucun
--  curseur à partager, et un second laboratoire ne demande aucun code.
--
--  ── CE QUI RESTE À CALLISTA ─────────────────────────────────────────
--
--  `demander_une_analyse` ne coûte RIEN et est instantanée. Les deux
--  sont des décisions de jeu, pas des décisions de code :
--
--    · un prix se pose en trois lignes ici, au même endroit que le
--      `update sac` ;
--    · un délai se pose en comparant `cree_le` dans la file.
--
--  Je ne les invente pas. En l'état, une demande acceptée est rendue au
--  passage suivant, et c'est le comportement le plus simple qui soit
--  juste.
-- ════════════════════════════════════════════════════════════════════

-- ── ce que la ligne garde en plus ───────────────────────────────────
alter table analyse_fossile add column if not exists sujet_id        bigint;
alter table analyse_fossile add column if not exists verdict         jsonb;
alter table analyse_fossile add column if not exists annonce_le      timestamptz;
alter table analyse_fossile add column if not exists annonce_message_id bigint;
alter table analyse_fossile add column if not exists annonce_essais  integer not null default 0;
alter table analyse_fossile add column if not exists annonce_derniere_erreur text;

comment on column analyse_fossile.sujet_id is
  'Le sujet où la demande a été postée. La réponse y part : la tâche '
  'd''annonce n''a donc aucune configuration de laboratoire à lire.';
comment on column analyse_fossile.verdict is
  'Le verdict rendu, tel que rendre_fossile l''a construit. Gardé pour '
  'être REJOUÉ à l''identique : l''annonce n''est pas atomique avec la '
  'réanimation, et recalculer donnerait un autre verdict un jour plus tard.';
comment on column analyse_fossile.annonce_le is
  'Null tant que le joueur n''a pas été prévenu. C''est la file d''attente.';

--  La file : les analyses à traiter, qu'elles soient encore à rendre ou
--  seulement à annoncer. Les deux cas se lisent au même endroit, parce
--  que c'est la même question — « qui attend une réponse ? ».
create index if not exists analyse_fossile_a_annoncer
    on analyse_fossile (cree_le) where annonce_le is null;

-- ── demander une analyse ────────────────────────────────────────────
--  Le pendant de `boutique_servir` : un message du forum entre, une
--  ligne en sort. Mêmes refus nommés, même idempotence par
--  `message_id`, qui est `unique` depuis `0001`.
create or replace function demander_une_analyse(p jsonb) returns jsonb as $$
declare
  v_message bigint := (p->>'messageId')::bigint;
  v_sujet   bigint := (p->>'sujetId')::bigint;
  v_objet   integer := (p->>'objetId')::int;
  v_code    text   := p->>'code';
  v_joueur  uuid;
  v_id      uuid;
  v_nom     text;
  v_famille text;
  v_reste   integer;
  v_deja    record;
begin
  if v_message is null then
    raise exception 'demander_une_analyse : messageId manquant dans %', p::text;
  end if;
  if v_code is null or v_code = '' then
    raise exception 'demander_une_analyse : code manquant pour le message %', v_message;
  end if;

  --  ── DÉJÀ DEMANDÉE ? ──────────────────────────────────────────────
  --  Le même message relu au passage suivant ne crée pas une seconde
  --  analyse : il rend celle qui existe. Sans ça, un joueur dont
  --  l'accusé de réception n'est pas parti verrait son fossile analysé
  --  deux fois.
  select * into v_deja from analyse_fossile where message_id = v_message;
  if found then
    return jsonb_build_object(
      'etat', 'acceptee', 'analyseId', v_deja.id,
      'objetId', v_deja.objet_id,
      'fossile', (select nom from objet where id = v_deja.objet_id),
      'deja', true);
  end if;

  select id into v_joueur from joueur
   where forum_user_id = (p->>'forumUserId')::int;
  if v_joueur is null then
    --  Même décision que `boutique_servir` : ce n'est pas un refus,
    --  c'est un compte à lier. Il n'y a pas d'analyse où l'écrire.
    raise exception 'COMPTE_NON_LIE %', coalesce(p->>'forumUserId', 'null');
  end if;

  select nom, famille into v_nom, v_famille from objet where id = v_objet;
  if v_nom is null then
    return jsonb_build_object(
      'etat', 'refusee', 'motif', 'OBJET_INCONNU',
      'detail', 'Cet objet n''existe pas au catalogue.');
  end if;
  if v_famille <> 'fossile' then
    return jsonb_build_object(
      'etat', 'refusee', 'motif', 'PAS_UN_FOSSILE',
      'detail', format('%s n''est pas un fossile.', v_nom));
  end if;

  --  ON NE CONSOMME RIEN ICI. Le fossile est retiré du sac par
  --  `rendre_fossile`, et c'est le seul endroit qui le fait : deux
  --  endroits qui débitent le même objet finiraient par le débiter
  --  deux fois. On vérifie seulement qu'il est là, pour pouvoir
  --  refuser tout de suite plutôt que dans cinq minutes.
  select quantite into v_reste from sac
   where joueur_id = v_joueur and objet_id = v_objet;
  if coalesce(v_reste, 0) < 1 then
    return jsonb_build_object(
      'etat', 'refusee', 'motif', 'FOSSILE_ABSENT',
      'detail', format('%s n''est pas dans ton sac.', v_nom));
  end if;

  insert into analyse_fossile (joueur_id, objet_id, message_id, sujet_id, code)
  values (v_joueur, v_objet, v_message, v_sujet, v_code)
  returning id into v_id;

  return jsonb_build_object(
    'etat', 'acceptee', 'analyseId', v_id,
    'objetId', v_objet, 'fossile', v_nom, 'deja', false);
end $$ language plpgsql security definer;

revoke all on function demander_une_analyse(jsonb) from public, anon, authenticated;
grant execute on function demander_une_analyse(jsonb) to service_role;

-- ── rendre, une seule fois, et le redire autant qu'il faut ──────────
create or replace function rendre_fossile(p jsonb) returns jsonb as $$
declare
  v_analyse uuid := (p->>'analyseId')::uuid;
  a         record;
  esp       record;
  reste     integer;
  v         jsonb;
begin
  if v_analyse is null then
    raise exception 'rendre_fossile : analyseId manquant dans %', p::text;
  end if;

  --  ── LE VERDICT DÉJÀ RENDU EST RENDU À L'IDENTIQUE ────────────────
  --  C'est ce qui rend l'annonce repassable sans danger. Voir l'en-tête.
  select verdict into v from analyse_fossile where id = v_analyse;
  if v is not null then
    return v || jsonb_build_object('deja', true);
  end if;

  select * into a from analyse_fossile
   where id = v_analyse and etat = 'en_attente' for update;
  if not found then
    --  L'IMPOSSIBLE LÈVE (règle de 0013). Une analyse introuvable n'est
    --  pas un refus qu'on écrit : il n'y a pas de ligne où l'écrire.
    --  Une analyse déjà rendue AVANT cette migration — donc sans
    --  verdict gardé — tombe ici aussi, et c'est juste : la table n'en
    --  contient aucune, et en inventer un serait mentir.
    raise exception 'ANALYSE_INTROUVABLE %', v_analyse;
  end if;

  select quantite into reste from sac
   where joueur_id = a.joueur_id and objet_id = a.objet_id for update;
  if coalesce(reste, 0) < 1 then
    --  LE REFUS EST ÉCRIT, ET IL SURVIT : on rend, on ne lève pas.
    v := jsonb_build_object(
      'etat', 'refusee',
      'analyseId', v_analyse,
      'motif', 'FOSSILE_ABSENT',
      'detail', 'Ce fossile n''est plus dans ton sac.');
    update analyse_fossile set etat = 'refusee', verdict = v where id = v_analyse;
    return v || jsonb_build_object('deja', false);
  end if;

  select e.* into esp from fossile_espece fe
    join espece e on e.id = fe.espece_id
   where fe.objet_id = a.objet_id
   order by fe.espece_id limit 1;
  if not found then
    --  PAS LA FAUTE DU JOUEUR : c'est une donnée qui manque de notre
    --  côté. On ne marque donc pas l'analyse refusée — et ON NE GARDE
    --  PAS DE VERDICT : elle se rejouera le jour où la ligne existera,
    --  et rien n'a été consommé.
    return jsonb_build_object(
      'etat', 'impossible',
      'analyseId', v_analyse,
      'motif', 'FOSSILE_SANS_ESPECE',
      'detail', 'Aucune espèce n''est encore rattachée à ce fossile.');
  end if;

  update sac set quantite = quantite - 1
   where joueur_id = a.joueur_id and objet_id = a.objet_id;

  insert into pokemon (joueur_id, espece_id, niveau, xp, emplacement)
  values (a.joueur_id, esp.id, 15, seuil(15::smallint), 'boite');

  insert into pokedex (joueur_id, espece_id, croise_le, attrape_le)
  values (a.joueur_id, esp.id, now(), now())
      on conflict (joueur_id, espece_id) do update
         set attrape_le = coalesce(pokedex.attrape_le, excluded.attrape_le);

  v := jsonb_build_object(
    'etat', 'rendue',
    'analyseId', v_analyse,
    'especeId', esp.id,
    'espece', esp.nom_fr);

  update analyse_fossile
     set etat = 'rendue', espece_obtenue = esp.id, verdict = v
   where id = v_analyse;

  return v || jsonb_build_object('deja', false);
end $$ language plpgsql security definer;

revoke all on function rendre_fossile(jsonb) from public, anon, authenticated;
grant execute on function rendre_fossile(jsonb) to service_role;

-- ── la file des analyses qui attendent une réponse ──────────────────
--  Les plus anciennes d'abord, comme `clotures_sans_bilan` : un joueur
--  qui attend depuis hier passe avant celui qui attend depuis une
--  minute.
--
--  LA FILE NE REGARDE PAS `etat`, et c'est voulu : une analyse encore
--  en attente et une analyse rendue dont le message n'est pas parti
--  demandent le même geste — un appel à `rendre_fossile`, qui tranche
--  ou rejoue, puis un message. Un seul chemin dans le cas d'usage.
create or replace function analyses_a_annoncer(p jsonb) returns jsonb as $$
  select coalesce(jsonb_agg(x order by x->>'creeLe'), '[]'::jsonb)
  from (
    select jsonb_build_object(
             'analyseId', a.id,
             'sujetId', a.sujet_id,
             'messageId', a.message_id,
             'pseudo', j.pseudo,
             'fossile', o.nom,
             'code', a.code,
             'essais', a.annonce_essais,
             'creeLe', to_char(a.cree_le, 'YYYY-MM-DD"T"HH24:MI:SSOF')
           ) as x
      from analyse_fossile a
      join joueur j on j.id = a.joueur_id
      join objet  o on o.id = a.objet_id
     where a.annonce_le is null
       --  Une analyse sans sujet ne peut pas recevoir de réponse : il
       --  n'y a nulle part où la poster. La file ne la rend donc pas,
       --  plutôt que de la faire échouer en boucle. Elles ne peuvent
       --  venir que d'avant cette migration, où aucune n'existe.
       and a.sujet_id is not null
     order by a.cree_le
     limit coalesce((p->>'combien')::int, 20)
  ) s;
$$ language sql stable security definer;

create or replace function analyse_annoncee(p jsonb) returns boolean as $$
declare n integer;
begin
  update analyse_fossile
     set annonce_le = now(),
         annonce_message_id = (p->>'messageId')::bigint,
         annonce_derniere_erreur = null
   where id = (p->>'analyseId')::uuid
     and annonce_le is null;
  get diagnostics n = row_count;
  return n > 0;
end $$ language plpgsql security definer;

--  On garde la dernière erreur et on compte les essais. Même raison que
--  `cloture_bilan_echoue` : une annonce qui ne passera jamais — sujet
--  verrouillé, compte de publication bloqué — tournerait en silence.
create or replace function analyse_annonce_echouee(p jsonb) returns integer as $$
declare n integer;
begin
  update analyse_fossile
     set annonce_essais = annonce_essais + 1,
         annonce_derniere_erreur = left(coalesce(p->>'erreur', 'sans détail'), 500)
   where id = (p->>'analyseId')::uuid
     and annonce_le is null
  returning annonce_essais into n;
  return coalesce(n, 0);
end $$ language plpgsql security definer;

revoke all on function analyses_a_annoncer(jsonb)     from public, anon, authenticated;
revoke all on function analyse_annoncee(jsonb)        from public, anon, authenticated;
revoke all on function analyse_annonce_echouee(jsonb) from public, anon, authenticated;
grant execute on function analyses_a_annoncer(jsonb)     to service_role;
grant execute on function analyse_annoncee(jsonb)        to service_role;
grant execute on function analyse_annonce_echouee(jsonb) to service_role;
