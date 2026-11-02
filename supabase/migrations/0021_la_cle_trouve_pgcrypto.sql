-- ════════════════════════════════════════════════════════════════════
--  0021 · La clé du carnet retrouve pgcrypto
--
--  ── LE DÉFAUT, ET CE QU'IL APPRENDOIT ───────────────────────────────
--
--  `carnet_nouvelle_cle()` tire sa clé avec `gen_random_bytes(16)`, qui
--  vient de l'extension `pgcrypto`. Sur Supabase, les extensions sont
--  installées dans le schéma **`extensions`**, pas dans `public`. La
--  fonction, elle, est épinglée sur `search_path = public` — ce qui est
--  la bonne pratique pour une fonction `security definer` — donc elle
--  ne trouve pas `gen_random_bytes` et lève :
--
--      ERROR: 42883: function gen_random_bytes(integer) does not exist
--
--  Relevé le 2 novembre, au premier appel réel. Le test de contrat ne
--  l'avait pas vu parce que la base d'essai avait `pgcrypto` dans
--  `public` : c'est la même faute que pour un décor de harnais qui ne
--  sert pas ce que le vrai hôte sert. La base d'essai met désormais
--  l'extension dans `extensions`, comme Supabase.
--
--  ── LA CORRECTION, ET POURQUOI PAS UNE AUTRE ────────────────────────
--
--  On ajoute `extensions` au `search_path`, APRÈS `public`.
--
--  · **Pas `extensions.gen_random_bytes(16)` en dur** : le schéma
--    `extensions` est une convention de Supabase et n'existe pas sur un
--    PostgreSQL ordinaire. La fonction cesserait de marcher dans les
--    tests de contrat et chez quiconque remonte la base ailleurs.
--    Un schéma absent du `search_path` est ignoré sans bruit, donc la
--    forme ci-dessous marche des deux côtés.
--  · **Pas `gen_random_uuid()`** à la place, qui est dans le cœur de
--    PostgreSQL depuis la 13 et n'aurait demandé aucune extension :
--    un UUID v4 fige six bits sur cent vingt-huit. La clé tomberait à
--    122 bits, et l'en-tête de `0019` promet 128. Changer la promesse
--    pour s'épargner un mot de `search_path` serait un mauvais marché.
--  · `public` RESTE EN PREMIER. C'est lui qui protège : une fonction
--    `security definer` qui chercherait d'abord ailleurs se ferait
--    détourner par un schéma posé devant.
--
--  Rien d'autre ne change : même corps, mêmes droits, même clé de 128
--  bits. `carnet()` et `carte_dresseur()` ne touchent pas à pgcrypto et
--  gardent leur `search_path` tel quel.
-- ════════════════════════════════════════════════════════════════════

create or replace function carnet_nouvelle_cle(p jsonb)
returns jsonb as $$
declare
  v_forum integer := (p->>'forumUserId')::integer;
  v_cle   text    := encode(gen_random_bytes(16), 'hex');
  v_id    uuid;
begin
  if v_forum is null then
    raise exception 'FORUM_USER_ID_MANQUANT';
  end if;

  update joueur set cle_de_carnet = v_cle
   where forum_user_id = v_forum
   returning id into v_id;

  if v_id is null then
    raise exception 'JOUEUR_INTROUVABLE';
  end if;

  --  C'est le SEUL endroit où une clé sort de la base. Le staff la
  --  transmet au joueur, et elle n'est plus jamais lisible ensuite :
  --  renouveler est la seule façon d'en retrouver une.
  return jsonb_build_object('joueurId', v_id, 'cle', v_cle);
end $$ language plpgsql security definer set search_path = public, extensions;

revoke all on function carnet_nouvelle_cle(jsonb) from public;
revoke all on function carnet_nouvelle_cle(jsonb) from anon, authenticated;
grant execute on function carnet_nouvelle_cle(jsonb) to service_role;
