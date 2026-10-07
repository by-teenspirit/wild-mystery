-- ════════════════════════════════════════════════════════════════════
--  0011 · la boutique, pour de bon
--
--  `servir_commande` (0002) N'A JAMAIS SERVI UNE SEULE COMMANDE. Relevé
--  le 5 octobre 2026 sur un PostgreSQL 16 monté exprès, les dix
--  migrations rejouées depuis zéro :
--
--      ERROR:  column reference "total" is ambiguous
--              update commande set etat = 'servie', total = total …
--
--  `total` est à la fois une variable plpgsql et une colonne de
--  `commande`. Sans `plpgsql.variable_conflict`, PostgreSQL refuse — et
--  c'est la DERNIÈRE instruction de la fonction, donc toute la
--  transaction est annulée après avoir débité, rempli le sac et tout le
--  reste. La boutique ne débitait personne et ne servait rien.
--
--  Le seul chemin qui avait l'air de marcher était le refus pour argent
--  insuffisant : il lève AVANT d'arriver là.
--
--  ── ET QUATRE AUTRES TROUS, UNE FOIS L'AMBIGUÏTÉ LEVÉE ───────────────
--
--  Rejouée réparée à la main sur la même base, la fonction a donné :
--
--    A. `[{990080,1},{1,99}]` → facturé 3 000, et **99 Fossiles Hélix
--       dans le sac**. `coalesce((select prix … and en_vente), 0)` met à
--       zéro tout objet hors vente, et le garde-fou ne regarde que le
--       TOTAL. Donc tout ce qui se trouve sans s'acheter — les fossiles,
--       les objets d'évent — était gratuit pour qui écrivait son
--       identifiant dans le bloc. C'est une faille, pas une maladresse.
--
--    B. Deux lignes pour le même objet → « ON CONFLICT DO UPDATE command
--       cannot affect row a second time ». Le domaine fusionne déjà les
--       doublons (`src/domaine/panier.ts`), mais la base ne doit pas en
--       dépendre : un bloc écrit à la main n'est pas passé par le
--       domaine.
--
--    C. Une quantité négative → violation de `sac_quantite_check`.
--    D. Un identifiant inconnu → violation de clé étrangère.
--
--  C et D tombaient sans rien casser. Mais avec un message PostgreSQL
--  que personne ne peut lire, et surtout : la commande RESTAIT
--  `en_attente`. Un `raise` annule tout, y compris le `etat='refusee'`
--  qu'on voudrait garder. Un refus qui s'efface est un refus qu'on
--  repasse à chaque relève, pour l'éternité.
--
--  ── UN REFUS SE RETOURNE, IL NE SE LÈVE PAS ─────────────────────────
--
--  D'où la forme : les refus MÉTIER sont une valeur de retour, écrite en
--  base dans la même transaction que le `etat='refusee'`. Seul
--  l'impossible lève — commande introuvable, joueur inconnu.
--
--  C'est la leçon du 2 octobre reprise d'un cran plus bas : la clôture
--  avait appris que « appliquer » et « publier » ne sont pas atomiques.
--  Ici, « refuser » et « se souvenir d'avoir refusé » doivent l'être.
--
--  ── L'IDEMPOTENCE EST PORTÉE PAR `message_id` ───────────────────────
--
--  `commande.message_id` est `unique`, et c'est l'identifiant du message
--  où le joueur a validé son panier. Il ne recule jamais et ne change
--  pas si le joueur édite son texte (planche 45, règle 2). Donc une
--  relève qui repasse sur le même message retrouve la commande déjà
--  servie et rend le même verdict, avec `deja: true`. Rien n'est débité
--  deux fois, et la relève n'a aucun état à tenir pour le savoir.
--
--  ── LA CONVENTION ───────────────────────────────────────────────────
--
--  `(p jsonb) returns jsonb`, comme tout ce qui est écrit depuis 0003.
--  `servir_commande(uuid)` disparaît : garder une fonction dont on vient
--  de prouver qu'elle n'a jamais marché, c'est laisser un piège.
-- ════════════════════════════════════════════════════════════════════

drop function if exists servir_commande(uuid);

--  ── UNE COLONNE DE PLUS, ET POURQUOI ────────────────────────────────
--
--  `commande.motif` existait déjà, mais seule. Un refus a DEUX parties :
--  un code qu'on compte (`HORS_VENTE`, `ARGENT_INSUFFISANT`) et une
--  phrase qu'on recopie au joueur. Les mettre dans la même colonne
--  obligeait à les recoller pour écrire et à les redécouper pour relire —
--  et le découpage casserait le jour où une phrase contient le
--  séparateur. Deux colonnes, deux usages.
alter table commande add column if not exists detail text;

--  LES MÊMES BORNES QUE LE DOMAINE. `src/domaine/panier.ts` porte
--  `QUANTITE_MAX = 99` et `LIGNES_MAX = 20` ; elles sont recopiées ici
--  parce qu'on ne peut pas importer du TypeScript dans du SQL — et le
--  garde-fou n° 12 relit CES lignes-ci pour vérifier qu'elles n'ont pas
--  divergé. Une liste recopiée sans vérification est la troisième source
--  de vérité qui finira par mentir ; celle-ci est relue.
create or replace function boutique_quantite_max() returns integer as $$
  select 99
$$ language sql immutable;

create or replace function boutique_lignes_max() returns integer as $$
  select 20
$$ language sql immutable;

-- ─────────────────────────────────────────────────────────────────────
--  Servir un panier : insérer la commande et l'honorer, d'un seul coup.
--
--  Entrée :
--    { "messageId": 15551,
--      "forumUserId": 3,          -- ou "joueurId": "uuid"
--      "lignes": [{"objetId": 990080, "quantite": 2}, …],
--      "code": "WM-…" }
--
--  Sortie servie :
--    { "etat": "servie", "commandeId": "…", "total": 6000, "solde": 4000,
--      "deja": false,
--      "lignes": [{"objetId":990080,"nom":"Pierre Feu","quantite":2,
--                  "prix":3000,"sousTotal":6000}] }
--
--  Sortie refusée :
--    { "etat": "refusee", "commandeId": "…", "motif": "HORS_VENTE",
--      "detail": "…", "total": 3000, "solde": 10000,
--      "coupables": [1] }
--
--  `detail` est écrit pour être recopié tel quel dans le message de
--  refus : un joueur doit comprendre sans aller chercher un identifiant.
-- ─────────────────────────────────────────────────────────────────────
create or replace function boutique_servir(p jsonb) returns jsonb as $$
declare
  v_message    bigint := (p->>'messageId')::bigint;
  --  Pas de `sujetId` : `commande` n'en garde pas. Le sujet est connu de
  --  la relève, qui est celle qui répond — l'écrire ici serait une
  --  colonne de plus à tenir pour personne.
  v_code       text   := p->>'code';
  v_joueur     uuid   := (p->>'joueurId')::uuid;
  v_commande   uuid;
  v_etat       text;
  v_total      integer := 0;
  v_solde      integer;
  v_lignes     jsonb;
  v_detail     text;
  v_coupables  jsonb;
  v_nb         integer;
  v_motif      text;
begin
  if v_message is null then
    raise exception 'boutique_servir : messageId manquant dans %', p::text;
  end if;
  if v_code is null or v_code = '' then
    raise exception 'boutique_servir : code manquant pour le message %', v_message;
  end if;

  -- ── le joueur ─────────────────────────────────────────────────────
  if v_joueur is null then
    select id into v_joueur from joueur
     where forum_user_id = (p->>'forumUserId')::int;
    if v_joueur is null then
      --  PAS UN REFUS : un compte non lié n'a pas de commande à refuser,
      --  et lui en écrire une créerait une ligne orpheline. La relève
      --  sait quoi répondre — « lie ton compte d'abord ».
      raise exception 'COMPTE_NON_LIE %', coalesce(p->>'forumUserId', 'null');
    end if;
  end if;

  -- ── déjà passée ? ─────────────────────────────────────────────────
  --  `message_id` est unique : si la relève repasse, on rend le verdict
  --  d'alors au lieu de débiter une seconde fois.
  --
  --  LE VERDICT RENDU EST COMPLET, lignes comprises. Ce n'est pas du
  --  confort : la relève reposte le reçu dans ce cas-là, et c'est même
  --  tout l'intérêt du chemin. Un verdict amputé donnerait un reçu sans
  --  aucune ligne, et le joueur ne saurait pas ce qu'il a acheté.
  --
  --  `solde` est celui d'AUJOURD'HUI, pas celui d'après l'achat. C'est le
  --  bon choix : le reçu part maintenant, et un solde d'hier serait faux
  --  au moment où il se lit.
  select id, etat, total, motif, detail, lignes
    into v_commande, v_etat, v_total, v_motif, v_detail, v_lignes
    from commande where message_id = v_message;
  if found then
    select pokedollars into v_solde from joueur where id = v_joueur;
    return jsonb_build_object(
      'etat', v_etat, 'commandeId', v_commande, 'total', v_total,
      'solde', v_solde, 'deja', true, 'motif', v_motif,
      'detail', v_detail, 'lignes', v_lignes);
  end if;

  -- ── le panier, relu et chiffré PAR LA BASE ────────────────────────
  --  Le prix du panier n'est jamais regardé : seul `objet.prix` compte.
  --  Les doublons sont additionnés ici (défaut B), donc deux lignes pour
  --  le même objet n'atteignent jamais le `on conflict`.
  with brut as (
    select (l->>'objetId')::int    as objet_id,
           (l->>'quantite')::int   as quantite
      from jsonb_array_elements(coalesce(p->'lignes', '[]'::jsonb)) l
  ), fusion as (
    select objet_id, sum(quantite)::int as quantite
      from brut group by objet_id
  )
  select jsonb_agg(jsonb_build_object(
           'objetId',  f.objet_id,
           'nom',      o.nom,
           'quantite', f.quantite,
           'prix',     o.prix,
           'sousTotal', f.quantite * o.prix)
         order by f.objet_id),
         coalesce(sum(f.quantite * o.prix), 0)::int,
         count(*)::int
    into v_lignes, v_total, v_nb
    from fusion f left join objet o on o.id = f.objet_id;

  -- ── ce qui fait refuser, dans l'ordre où ça se voit ───────────────

  if coalesce(v_nb, 0) = 0 then
    return boutique_refuser(v_joueur, v_message, v_code, 0,
      'PANIER_VIDE', 'Le panier ne contient aucun article.', '[]'::jsonb);
  end if;

  if v_nb > boutique_lignes_max() then
    return boutique_refuser(v_joueur, v_message, v_code, 0, 'TROP_DE_LIGNES',
      format('Le panier contient %s articles différents, le maximum est %s.',
             v_nb, boutique_lignes_max()), '[]'::jsonb);
  end if;

  --  Quantités : hors bornes ou nulles. Mesuré (défaut C) : une quantité
  --  négative violait `sac_quantite_check` et la commande restait en
  --  attente pour toujours.
  select jsonb_agg(l->'objetId'),
         string_agg(format('%s ×%s', l->>'nom', l->>'quantite'), ', ')
    into v_coupables, v_detail
    from jsonb_array_elements(v_lignes) l
   where (l->>'quantite')::int < 1
      or (l->>'quantite')::int > boutique_quantite_max();
  if v_coupables is not null then
    return boutique_refuser(v_joueur, v_message, v_code, 0, 'QUANTITE',
      format('Une quantité est hors bornes (%s) : il faut entre 1 et %s par article.',
             v_detail, boutique_quantite_max()), v_coupables);
  end if;

  --  Objets inconnus (défaut D) : `o.nom` est null après la jointure.
  select jsonb_agg(l->'objetId') into v_coupables
    from jsonb_array_elements(v_lignes) l where l->>'nom' is null;
  if v_coupables is not null then
    return boutique_refuser(v_joueur, v_message, v_code, 0, 'OBJET_INCONNU',
      format('Le panier nomme un objet qui n''existe pas : %s.', v_coupables::text),
      v_coupables);
  end if;

  --  LA FAILLE (défaut A) : un objet hors vente ou sans prix était
  --  facturé zéro et servi quand même. On refuse LA COMMANDE ENTIÈRE —
  --  un panier qui demande ce qui ne se vend pas n'est pas une commande
  --  qu'on sert à moitié.
  select jsonb_agg(l->'objetId'), string_agg(o.nom, ', ')
    into v_coupables, v_detail
    from jsonb_array_elements(v_lignes) l
    join objet o on o.id = (l->>'objetId')::int
   where not o.en_vente or o.prix is null;
  if v_coupables is not null then
    return boutique_refuser(v_joueur, v_message, v_code, 0, 'HORS_VENTE',
      format('Ces objets ne sont pas en vente : %s. Ils se trouvent, ils ne s''achètent pas.',
             v_detail), v_coupables);
  end if;

  -- ── l'argent ──────────────────────────────────────────────────────
  select pokedollars into v_solde from joueur where id = v_joueur for update;
  if v_solde < v_total then
    return boutique_refuser(v_joueur, v_message, v_code, v_total,
      'ARGENT_INSUFFISANT',
      format('Le panier coûte %s ₽ et il reste %s ₽.', v_total, v_solde),
      '[]'::jsonb);
  end if;

  -- ── on sert ───────────────────────────────────────────────────────
  insert into commande (joueur_id, message_id, lignes, total, etat, code)
  values (v_joueur, v_message, v_lignes, v_total, 'servie', v_code)
  returning id into v_commande;

  update joueur set pokedollars = pokedollars - v_total where id = v_joueur;

  insert into sac (joueur_id, objet_id, quantite)
  select v_joueur, (l->>'objetId')::int, (l->>'quantite')::int
    from jsonb_array_elements(v_lignes) l
      on conflict (joueur_id, objet_id)
      do update set quantite = sac.quantite + excluded.quantite;

  return jsonb_build_object(
    'etat', 'servie', 'commandeId', v_commande, 'total', v_total,
    'solde', v_solde - v_total, 'deja', false, 'lignes', v_lignes);
end $$ language plpgsql security definer;

-- ─────────────────────────────────────────────────────────────────────
--  Le refus, écrit en base ET rendu à l'appelant.
--
--  Fonction à part pour une raison : elle est appelée depuis sept
--  endroits de `boutique_servir`, et un refus qui s'écrirait à six
--  endroits sur sept serait exactement le genre de divergence qu'on
--  passe une soirée à chercher.
--
--  La commande est écrite avec `etat='refusee'` : la relève la retrouve
--  au passage suivant, voit qu'elle est traitée, et ne la repasse pas.
-- ─────────────────────────────────────────────────────────────────────
create or replace function boutique_refuser(
  p_joueur uuid, p_message bigint, p_code text,
  p_total integer, p_motif text, p_detail text, p_coupables jsonb
) returns jsonb as $$
declare
  v_commande uuid;
  v_solde    integer;
begin
  insert into commande (joueur_id, message_id, lignes, total, etat, motif, detail, code)
  values (p_joueur, p_message, coalesce(p_coupables, '[]'::jsonb), p_total,
          'refusee', p_motif, p_detail, p_code)
  returning id into v_commande;

  select pokedollars into v_solde from joueur where id = p_joueur;

  return jsonb_build_object(
    'etat', 'refusee', 'commandeId', v_commande, 'motif', p_motif,
    'detail', p_detail, 'total', p_total, 'solde', v_solde,
    'coupables', coalesce(p_coupables, '[]'::jsonb), 'deja', false);
end $$ language plpgsql security definer;

-- ─────────────────────────────────────────────────────────────────────
--  LA SURFACE RESTE FERMÉE (migration 0008). Ces fonctions sont
--  `security definer` et ne sont appelables que par la clé de service,
--  c'est-à-dire par la relève. Un joueur ne commande pas en appelant
--  PostgREST : il poste un message, et la relève le lit.
-- ─────────────────────────────────────────────────────────────────────
revoke all on function boutique_servir(jsonb) from public, anon, authenticated;
revoke all on function boutique_refuser(uuid, bigint, text, integer, text, text, jsonb)
  from public, anon, authenticated;
grant execute on function boutique_servir(jsonb) to service_role;
