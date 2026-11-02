-- ════════════════════════════════════════════════════════════════════
--  0023 · Ouvrir son carnet en postant
--
--  ── CE QUE ÇA REMPLACE ──────────────────────────────────────────────
--
--  `0019` donne une clé que le staff transmet à la main, joueur par
--  joueur. « Ce serait possible d'avoir un truc moins compliqué où
--  j'ai pas besoin de lui envoyer ? », 2 novembre.
--
--  Ici, le joueur poste un bloc dans un sujet, la relève le lit, et la
--  page récupère la clé toute seule. Le staff ne fait rien. La voie
--  manuelle de `0019` reste en place : c'est elle qui dépanne si la
--  relève tombe, et c'est aussi elle qui révoque.
--
--  ── POURQUOI UNE EMPREINTE, ET PAS LA CLÉ ───────────────────────────
--
--  Un sujet se lit par tout le monde. Le joueur poste donc l'empreinte
--  SHA-256 d'un secret que seule sa page connaît, et il échange
--  ensuite ce secret contre la clé. Qui recopie l'empreinte ne peut
--  rien en faire : il faudrait inverser SHA-256.
--
--  C'est le seul montage qui tienne dans un fil public. La voir
--  autrement — poster la clé, poster son identifiant, faire confiance
--  à `_userdata` — revient chaque fois à laisser un passant ouvrir le
--  carnet de quelqu'un d'autre.
--
--  ── LA PREMIÈRE RÉCLAMATION GAGNE ───────────────────────────────────
--
--  `on conflict do nothing` : si deux messages portent la même
--  empreinte, c'est celui qui est arrivé le premier qui lie. Le
--  deuxième est un copieur, et un copieur n'obtient rien.
--
--  Ce que ça ne répare pas, et qui est traité à l'affichage : si le
--  copieur postait AVANT l'original, l'original recevrait une clé liée
--  au compte du copieur. En base les deux messages sont identiques,
--  donc rien ne les distingue ici. La page nomme le dresseur reconnu
--  et demande confirmation avant de garder la clé.
--
--  ── UNE RÉCLAMATION EXPIRE ──────────────────────────────────────────
--
--  Trente minutes. Au-delà, le secret qui traîne dans un navigateur
--  oublié ne vaut plus rien. C'est court parce que le geste est court :
--  on ouvre la page, on poste, on recharge.
--
--  ── `digest()` VIENT DE pgcrypto ────────────────────────────────────
--
--  Donc `search_path = public, extensions`, comme `0021` l'a appris à
--  ses dépens : Supabase installe les extensions dans `extensions`, et
--  une fonction épinglée sur le seul `public` ne les trouve pas.
-- ════════════════════════════════════════════════════════════════════

create table if not exists carnet_reclamation (
  empreinte     text        primary key check (empreinte ~ '^[0-9a-f]{48}$'),
  forum_user_id integer     not null,
  pseudo        text        not null,
  message_id    bigint      not null,
  vue_le        timestamptz not null default now()
);

comment on table carnet_reclamation is
  'Une empreinte postée dans le sujet d''ouverture, liée au compte de '
  'forum qui l''a postée. Écrite par la relève, lue et effacée par '
  '`carnet_reclamer`. Ne contient aucun secret : l''empreinte est '
  'publique, elle est dans le message.';

alter table carnet_reclamation enable row level security;
--  AUCUNE POLITIQUE, DONC AUCUN ACCÈS DIRECT. On n'y entre que par les
--  deux fonctions ci-dessous, qui sont `security definer`. Lire la
--  table en vrac dirait qui est en train d'ouvrir son carnet.

-- ── 1 · la relève enregistre ce qu'elle a lu ───────────────────────

create or replace function carnet_enregistrer_reclamation(p jsonb)
returns boolean as $$
declare v_neuve boolean;
begin
  insert into carnet_reclamation (empreinte, forum_user_id, pseudo, message_id)
  values (
    lower(p->>'empreinte'),
    (p->>'forumUserId')::integer,
    p->>'pseudo',
    (p->>'messageId')::bigint
  )
  on conflict (empreinte) do nothing;

  get diagnostics v_neuve = row_count;
  return v_neuve;
end $$ language plpgsql security definer set search_path = public;

revoke all on function carnet_enregistrer_reclamation(jsonb) from public;
revoke all on function carnet_enregistrer_reclamation(jsonb) from anon, authenticated;
grant execute on function carnet_enregistrer_reclamation(jsonb) to service_role;

-- ── 2 · la page échange son secret contre la clé ───────────────────

create or replace function carnet_reclamer(p jsonb)
returns jsonb as $$
declare
  v_secret    text := lower(p->>'secret');
  v_empreinte text;
  v_r         carnet_reclamation%rowtype;
  v_joueur    uuid;
  v_cle       text;
begin
  --  LA FORME EST VÉRIFIÉE AVANT LA REQUÊTE, et le refus est le même
  --  que pour un secret bien formé mais inconnu : sinon la fonction
  --  devient un oracle qui dit si une réclamation existe.
  if v_secret is null or v_secret !~ '^[0-9a-f]{32}$' then
    raise exception 'RECLAMATION_INCONNUE';
  end if;

  v_empreinte := left(encode(digest(v_secret, 'sha256'), 'hex'), 48);

  delete from carnet_reclamation
   where empreinte = v_empreinte
     and vue_le > now() - interval '30 minutes'
   returning * into v_r;

  if v_r.empreinte is null then
    raise exception 'RECLAMATION_INCONNUE';
  end if;

  --  LE JOUEUR EST CRÉÉ S'IL N'EXISTE PAS. C'est ce qui enlève le
  --  dernier geste manuel : le staff n'a plus ni clé à donner ni
  --  ligne à créer. Le pseudo vient du forum, pas du navigateur.
  select id into v_joueur from joueur where forum_user_id = v_r.forum_user_id;
  if v_joueur is null then
    insert into joueur (forum_user_id, pseudo)
    values (v_r.forum_user_id, v_r.pseudo)
    returning id into v_joueur;
  end if;

  v_cle := encode(gen_random_bytes(16), 'hex');
  update joueur set cle_de_carnet = v_cle where id = v_joueur;

  --  LE PSEUDO SORT AVEC LA CLÉ, et ce n'est pas décoratif : la page
  --  le montre et demande « c'est bien toi ? » avant de garder la
  --  clé. C'est la seule parade au cas du copieur plus rapide.
  return jsonb_build_object('cle', v_cle, 'pseudo', v_r.pseudo,
                            'forumUserId', v_r.forum_user_id);
end $$ language plpgsql security definer set search_path = public, extensions;

revoke all on function carnet_reclamer(jsonb) from public;
grant execute on function carnet_reclamer(jsonb) to anon, authenticated, service_role;

comment on function carnet_reclamer(jsonb) is
  'Échange le secret d''une page contre la clé de carnet du compte de '
  'forum qui a posté l''empreinte correspondante. Troisième et '
  'dernière fonction ouverte à `anon` : ce qui protège est le secret '
  'passé en argument, jamais le rôle de l''appelant.';

-- ── 3 · le ménage des réclamations mortes ──────────────────────────

--  Une réclamation jamais échangée reste sinon pour toujours. Elle ne
--  contient rien de secret, mais une table qui ne se vide jamais
--  finit par être une table qu'on ne regarde plus.
create or replace function carnet_menage_reclamations(p jsonb default '{}'::jsonb)
returns integer as $$
declare n integer;
begin
  delete from carnet_reclamation where vue_le < now() - interval '1 day';
  get diagnostics n = row_count;
  return n;
end $$ language plpgsql security definer set search_path = public;

revoke all on function carnet_menage_reclamations(jsonb) from public;
revoke all on function carnet_menage_reclamations(jsonb) from anon, authenticated;
grant execute on function carnet_menage_reclamations(jsonb) to service_role;
