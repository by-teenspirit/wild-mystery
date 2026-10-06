-- ════════════════════════════════════════════════════════════════════
--  0015 · Deux appels simultanés sur le même message ne lèvent plus
--
--  ── CE QUI A ÉTÉ MESURÉ ─────────────────────────────────────────────
--
--  Le 6 octobre, contre un vrai PostgreSQL, deux sessions `psql` en
--  parallèle sur le même `messageId` :
--
--    · **l'argent était juste** — une seule commande, un seul débit, un
--      seul sac, une seule ligne de « La vie de Rhode ». La contrainte
--      `commande.message_id unique` a fait son travail ;
--    · **mais le second appel levait** `duplicate key value violates
--      unique constraint "commande_message_id_key"` au lieu de rendre le
--      verdict « déjà servie » que la fonction sait déjà rendre.
--
--  ── POURQUOI CE N'ÉTAIT PAS VISIBLE ─────────────────────────────────
--
--  `boutique_servir` lit (`select … where message_id = …; if found`) puis
--  écrit. Entre les deux, une autre transaction peut passer. Aujourd'hui
--  le **verrou de la relève** empêche deux passages de se croiser, donc
--  l'erreur ne pouvait pas arriver en production.
--
--  **Mais c'était le verrou qui tenait l'invariant, pas la fonction.** Un
--  appel à la main, une reprise après panne, un second ouvrier un jour :
--  la relève aurait vu une erreur sur un message pourtant servi, son
--  curseur ne serait pas avancé, et elle aurait réessayé en boucle.
--
--  ── CE QUE `0015` CHANGE ────────────────────────────────────────────
--
--  Rien au comportement normal. Les deux fonctions de la boutique
--  attrapent `unique_violation` et rendent le verdict déjà écrit, avec
--  `deja: true` — exactement ce que rend le chemin séquentiel.
--
--  Les deux fonctions sont **reprises par script** depuis `0014` et
--  `0011`, avec des assertions sur ce qu'elles contiennent. Recopier une
--  fonction à la main est la façon dont `ranger_pokedex` avait perdu deux
--  gardes (planche 50 §3 quinquies).
--
--  ── CE QUI N'EST PAS CHANGÉ, ET POURQUOI ────────────────────────────
--
--  `appliquer_cloture` lève aussi sur un doublon — « Le sujet % est déjà
--  clôturé. » Sous concurrence, la seconde transaction heurte la clé
--  primaire de `cloture` et lève également. **C'est le même résultat que
--  le refus voulu**, donc il n'y a rien à corriger : un sujet ne se clôt
--  qu'une fois, et l'appelant doit s'arrêter.
--
--  `registre_inscrire` porte déjà `on conflict … do nothing` : rien à
--  faire là non plus.
-- ════════════════════════════════════════════════════════════════════

create or replace function boutique_refuser(
  p_joueur uuid, p_message bigint, p_code text,
  p_total integer, p_motif text, p_detail text, p_coupables jsonb
) returns jsonb as $$
declare
  v_commande uuid;
  v_solde    integer;
begin
  --  Même protection qu'à `boutique_servir`, et pour la même raison : un
  --  refus qui lève est pire qu'un refus, puisque le joueur n'apprend
  --  jamais pourquoi sa commande n'est pas passée.
  begin
    insert into commande (joueur_id, message_id, lignes, total, etat, motif, detail, code)
    values (p_joueur, p_message, coalesce(p_coupables, '[]'::jsonb), p_total,
            'refusee', p_motif, p_detail, p_code)
    returning id into v_commande;
  exception when unique_violation then
    select id, motif, detail, total
      into v_commande, p_motif, p_detail, p_total
      from commande where message_id = p_message;
    select pokedollars into v_solde from joueur where id = p_joueur;
    return jsonb_build_object(
      'etat', 'refusee', 'commandeId', v_commande, 'motif', p_motif,
      'detail', p_detail, 'total', p_total, 'solde', v_solde,
      'coupables', coalesce(p_coupables, '[]'::jsonb), 'deja', true);
  end;

  select pokedollars into v_solde from joueur where id = p_joueur;

  return jsonb_build_object(
    'etat', 'refusee', 'commandeId', v_commande, 'motif', p_motif,
    'detail', p_detail, 'total', p_total, 'solde', v_solde,
    'coupables', coalesce(p_coupables, '[]'::jsonb), 'deja', false);
end $$ language plpgsql security definer;

-- ─────────────────────────────────────────────────────────────────────
--  Et la commande servie, pour la même raison.
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
  --  TOUT CE QUI SUIT EST DANS UN BLOC QUI ATTRAPE `unique_violation`,
  --  et c'est la correction de `0015`.
  --
  --  MESURÉ le 6 octobre contre un vrai PostgreSQL, deux sessions en
  --  parallèle sur le même message : l'argent restait juste — une seule
  --  commande, un seul débit, un seul sac, une seule ligne de journal —
  --  mais le second appel LEVAIT au lieu de rendre « déjà servie ».
  --
  --  Le verrou de la relève empêche aujourd'hui deux passages de se
  --  croiser, donc ça ne pouvait pas arriver en production. **Mais
  --  c'était le verrou qui le tenait, pas la fonction** : un appel à la
  --  main, un second ouvrier un jour, et l'erreur remontait.
  --
  --  Le bloc pose un point de reprise implicite : si l'insertion échoue,
  --  rien de ce bloc n'a eu lieu. C'est exactement ce qu'on veut, l'autre
  --  transaction ayant déjà tout fait.
  begin
    insert into commande (joueur_id, message_id, lignes, total, etat, code)
    values (v_joueur, v_message, v_lignes, v_total, 'servie', v_code)
    returning id into v_commande;

    update joueur set pokedollars = pokedollars - v_total where id = v_joueur;

    insert into sac (joueur_id, objet_id, quantite)
    select v_joueur, (l->>'objetId')::int, (l->>'quantite')::int
      from jsonb_array_elements(v_lignes) l
        on conflict (joueur_id, objet_id)
        do update set quantite = sac.quantite + excluded.quantite;

    --  LA LIGNE DE « LA VIE DE RHODE », dans la même transaction que le
    --  débit : une commande servie a donc toujours sa ligne. Elle ne dit
    --  que le NOMBRE d'objets — ni la liste, ni le prix (voir 0014).
    --
    --  `journal_ecrire` ne lève jamais : une commande ne peut pas échouer
    --  à cause d'une ligne de décor.
    perform journal_ecrire(jsonb_build_object(
      'type', 'achat',
      'pseudo', (select j.pseudo from joueur j where j.id = v_joueur),
      'detail', jsonb_build_object(
        'articles', (select coalesce(sum((l->>'quantite')::int), 0)
                       from jsonb_array_elements(v_lignes) l))));

    return jsonb_build_object(
      'etat', 'servie', 'commandeId', v_commande, 'total', v_total,
      'solde', v_solde - v_total, 'deja', false, 'lignes', v_lignes);

  exception when unique_violation then
    --  Une autre passe a servi ce message pendant celle-ci. On rend SON
    --  verdict, complet, comme le chemin « déjà servie » plus haut : la
    --  relève a besoin des lignes pour reposter le reçu.
    select id, etat, total, motif, detail, lignes
      into v_commande, v_etat, v_total, v_motif, v_detail, v_lignes
      from commande where message_id = v_message;
    select pokedollars into v_solde from joueur where id = v_joueur;
    return jsonb_build_object(
      'etat', v_etat, 'commandeId', v_commande, 'total', v_total,
      'solde', v_solde, 'deja', true, 'motif', v_motif,
      'detail', v_detail, 'lignes', v_lignes);
  end;
end $$ language plpgsql security definer;
