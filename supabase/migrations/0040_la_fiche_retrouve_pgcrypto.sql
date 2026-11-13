-- ════════════════════════════════════════════════════════════════════
--  0040 · La fiche retrouve pgcrypto, comme la clé du carnet avant elle
--
--  ── LE MÊME DÉFAUT QUE LA 0021, PRIS PAR L'AUTRE BOUT ───────────────
--
--  La 0021 raconte comment `carnet_nouvelle_cle` ne trouvait pas
--  `gen_random_bytes` : sur Supabase, pgcrypto vit dans le schéma
--  `extensions`, et une fonction épinglée sur `search_path = public`
--  ne l'y cherche pas. Elle a tranché la règle, et elle a dit pourquoi
--  l'autre solution était mauvaise :
--
--      « Pas `extensions.gen_random_bytes(16)` en dur : le schéma
--        `extensions` est une convention de Supabase et n'existe pas
--        sur un PostgreSQL ordinaire. La fonction cesserait de marcher
--        dans les tests de contrat et chez quiconque remonte la base
--        ailleurs. »
--
--  La 0034 a écrit `extensions.digest(...)` en dur, trois fois. C'est
--  exactement ce que la 0021 avait écarté, et pour exactement la
--  conséquence annoncée :
--
--      ERROR:  schema "extensions" does not exist
--
--  Le travail « Garanties SQL » du CI monte les migrations sur une
--  image `postgres:16` ordinaire, où ce schéma n'existe pas. Il
--  tombait donc à la première fonction de la 0034, et la suite pgTAP
--  s'arrêtait à 207 tests sur 257 — 50 garanties qui ne mesuraient
--  plus rien, sans que personne lise la cause.
--
--  Et comme le déploiement attend que TOUT le CI soit vert, la relève
--  ne pouvait pas partir. Un schéma écrit en dur dans une migration
--  empêchait un bouton de faire apparaître un Pokémon.
--
--  ── LA CORRECTION EST CELLE QUE LA 0021 AVAIT DÉJÀ ÉCRITE ───────────
--
--  `digest(...)` sans schéma, et `extensions` ajouté au `search_path`
--  APRÈS `public`. Un schéma absent du `search_path` est ignoré sans
--  bruit : la même fonction marche des deux côtés.
--
--  `public` RESTE EN PREMIER, pour la raison de la 0021 : une fonction
--  `security definer` qui chercherait d'abord ailleurs se ferait
--  détourner par un schéma posé devant elle.
--
--  Rien d'autre ne change : même corps, mêmes droits, même empreinte
--  SHA-256. On repose les deux fonctions à l'identique, au schéma près.
-- ════════════════════════════════════════════════════════════════════

/*  CE QUE LA PAGE APPELLE : le texte, son empreinte, et l'état de la
    publication. Sans argument — le personnage vient de la session,
    comme `lier_mon_personnage` depuis la 0031.  */
create or replace function fiche_a_publier(p jsonb) returns jsonb as $$
declare
  v_joueur uuid;
  v_texte  text;
  v_f      fiche%rowtype;
begin
  select j.id into v_joueur
    from joueur j
   where j.forum_user_id = (p ->> 'forumUserId')::integer
     and j.id in (select mes_joueurs());
  if v_joueur is null then
    return null;
  end if;

  v_texte := fiche_en_bbcode(v_joueur);
  select * into v_f from fiche where joueur_id = v_joueur;

  return jsonb_build_object(
    'texte',     v_texte,
    'empreinte', encode(digest(v_texte, 'sha256'), 'hex'),
    'sujetId',   v_f.sujet_id,
    'messageId', v_f.message_id,
    'publieLe',  v_f.publie_le,
    --  `aChange` EST LA VRAIE QUESTION : « 3 changements depuis »
    --  demanderait une date de modification par ligne, sur quatre
    --  tables. Savoir que ça a changé suffit à ne pas proposer une
    --  republication identique.
    'aChange',   v_f.publie_le is not null and
                 v_f.empreinte <> encode(digest(v_texte, 'sha256'), 'hex')
  );
end $$ language plpgsql stable security definer
  set search_path = public, extensions, pg_temp;

revoke all on function fiche_a_publier(jsonb) from public;
revoke all on function fiche_a_publier(jsonb) from anon;
grant execute on function fiche_a_publier(jsonb) to authenticated, service_role;

/*  ET CE QUE LE JOUEUR ENREGISTRE APRÈS AVOIR PUBLIÉ LUI-MÊME. Le
    carnet ne poste pas : il ouvre le formulaire, la personne envoie, et
    revient dire où c'est parti. L'empreinte est recalculée ICI, jamais
    reçue de la page — sinon n'importe qui déclarerait « à jour » une
    fiche qui ne l'est pas, et le carnet cesserait de proposer la mise
    à jour.  */
create or replace function fiche_est_publiee(p jsonb) returns jsonb as $$
declare
  v_joueur uuid;
  v_texte  text;
begin
  select j.id into v_joueur
    from joueur j
   where j.forum_user_id = (p ->> 'forumUserId')::integer
     and j.id in (select mes_joueurs());
  if v_joueur is null then
    raise exception 'PAS_TON_PERSONNAGE';
  end if;

  v_texte := fiche_en_bbcode(v_joueur);

  insert into fiche (joueur_id, sujet_id, message_id, publie_le, empreinte)
  values (v_joueur,
          nullif((p ->> 'sujetId')::integer, 0),
          nullif((p ->> 'messageId')::integer, 0),
          now(),
          encode(digest(v_texte, 'sha256'), 'hex'))
  on conflict (joueur_id) do update
    set sujet_id   = coalesce(excluded.sujet_id, fiche.sujet_id),
        message_id = coalesce(excluded.message_id, fiche.message_id),
        publie_le  = excluded.publie_le,
        empreinte  = excluded.empreinte;

  return jsonb_build_object('ok', true);
end $$ language plpgsql security definer
  set search_path = public, extensions, pg_temp;

revoke all on function fiche_est_publiee(jsonb) from public;
revoke all on function fiche_est_publiee(jsonb) from anon;
grant execute on function fiche_est_publiee(jsonb) to authenticated, service_role;
