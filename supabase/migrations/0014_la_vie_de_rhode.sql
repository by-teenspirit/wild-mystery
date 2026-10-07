-- ════════════════════════════════════════════════════════════════════
--  0014 · « La vie de Rhode » — le journal public des événements de jeu
--
--  Exigé par la planche 18, règle 6 : *« Les dépôts en pension, les
--  achats, les fossiles réanimés, les éclosions apparaissent dans un
--  encart « La vie de Rhode » sur l'index — une ligne par événement,
--  huit au maximum, avec l'heure. »*
--
--  ── À NE PAS CONFONDRE AVEC `releve_journal` ────────────────────────
--
--  `releve_journal` existe depuis `0001` : c'est le journal TECHNIQUE
--  des passages de la relève, invisible aux joueurs, qui compte des
--  tâches et des erreurs. Celui-ci est un journal DE JEU, public, lu sur
--  l'index. Deux tables, deux publics, aucun rapport.
--
--  ── IL EST PUBLIC, ET C'EST UNE DÉCISION, PAS UN OUBLI ──────────────
--
--  « Le suivi public est un journal, pas des messages » (règle 6). Donc
--  `anon` le lit, comme le registre. Un joueur qui achète apparaît sur
--  l'accueil du forum, et c'est voulu : le but est que la région ait
--  l'air vivante.
--
--  **Mais il en dit le MINIMUM.** Une ligne d'achat porte le nombre
--  d'objets, pas la liste ni le prix. Le détail d'un achat est l'affaire
--  du joueur et du reçu qu'il reçoit dans le sujet ; « Anna a fait une
--  emplette de trois objets » suffit à faire vivre l'index. On n'étale
--  pas le contenu d'un sac sur la page d'accueil pour une ligne de
--  décor.
--
--  ── LE PSEUDO EST STOCKÉ, PAS JOINT ────────────────────────────────
--
--  La table `joueur` n'est lisible que par son propriétaire, et c'est la
--  bonne politique — on ne l'ouvre pas pour afficher un nom. C'est
--  exactement le problème qu'a rencontré le module de bilan, résolu là
--  en relisant le pseudo depuis la page. Ici il n'y a pas de page à
--  relire : on recopie donc le pseudo dans la ligne, au moment de
--  l'écrire.
--
--  Conséquence assumée : un joueur qui change de pseudo garde l'ancien
--  dans les lignes déjà écrites. Un journal est une archive — elle dit
--  ce qui s'est passé, avec le nom qu'on portait alors.
--
--  ── LE SERVEUR ÉCRIT, ET LUI SEUL ──────────────────────────────────
--
--  `security definer` plus un `revoke` : seul `service_role` écrit,
--  c'est-à-dire la relève. Rien n'est jamais modifié ni effacé — une
--  ligne de journal est définitive, comme au registre.
-- ════════════════════════════════════════════════════════════════════

create type evenement_de_rhode as enum (
  'achat',      -- une commande servie à la boutique
  'pension',    -- un pokémon déposé ou récupéré
  'fossile',    -- un fossile réanimé
  'eclosion',   -- un œuf éclos
  'capture',    -- une capture remarquable (chromatique, première espèce)
  'badge'       -- une arène vaincue
);

create table journal (
  id        bigint generated always as identity primary key,
  type      evenement_de_rhode not null,
  --  Recopié, pas joint : voir l'en-tête.
  pseudo    text not null,
  --  Ce qu'il faut pour composer la phrase, et rien de plus. La
  --  FORMULATION vit côté navigateur : la changer ne doit pas demander
  --  une migration, et une phrase figée en base vieillirait mal.
  detail    jsonb not null default '{}'::jsonb,
  arrive_le timestamptz not null default now()
);

--  L'index qui sert : les huit dernières, et seulement elles.
create index journal_recent on journal (arrive_le desc, id desc);

-- ─────────────────────────────────────────────────────────────────────
--  Écrire une ligne. Appelée par la relève, et depuis `boutique_servir`.
--
--  ELLE NE LÈVE JAMAIS POUR UNE RAISON MÉTIER. Un journal est du décor :
--  il ne doit pas pouvoir faire échouer une commande servie ni une
--  clôture appliquée. Si la ligne ne peut pas s'écrire, on préfère
--  perdre la ligne que la transaction.
-- ─────────────────────────────────────────────────────────────────────
create or replace function journal_ecrire(p jsonb) returns bigint as $$
declare
  v_id bigint;
begin
  if p->>'type' is null or p->>'pseudo' is null then
    --  Sans type ni pseudo, il n'y a pas de phrase à composer. On ne
    --  lève pas : on refuse la ligne et on rend null, parce que
    --  l'appelant est en train de faire quelque chose de plus important.
    return null;
  end if;
  insert into journal (type, pseudo, detail)
  values ((p->>'type')::evenement_de_rhode, p->>'pseudo',
          coalesce(p->'detail', '{}'::jsonb))
  returning id into v_id;
  return v_id;
exception
  --  Un type inconnu, un pseudo trop long : la ligne se perd, le reste
  --  continue. C'est le seul endroit du dépôt où l'on avale une erreur,
  --  et c'est parce que ce qu'elle protège vaut plus qu'elle.
  when others then return null;
end $$ language plpgsql security definer;

-- ─────────────────────────────────────────────────────────────────────
--  Les dernières lignes, pour l'encart.
--
--  `huit` par défaut, comme la planche le demande, et borné à vingt :
--  l'encart ne peut pas en montrer plus, et un appel qui en demanderait
--  mille servirait à autre chose qu'à l'afficher.
-- ─────────────────────────────────────────────────────────────────────
create or replace function journal_dernieres(p jsonb default '{}'::jsonb)
returns jsonb as $$
  select coalesce(jsonb_agg(l order by l.arrive_le desc, l.id desc), '[]'::jsonb)
    from (
      select j.type, j.pseudo, j.detail, j.arrive_le, j.id
        from journal j
       order by j.arrive_le desc, j.id desc
       limit least(greatest(coalesce((p->>'combien')::int, 8), 1), 20)
    ) l
$$ language sql stable;

-- ─────────────────────────────────────────────────────────────────────
--  LES DROITS
--
--  Lecture publique, écriture réservée. `journal_dernieres` est `stable`
--  et sans `security definer` : elle n'a pas besoin de contourner quoi
--  que ce soit, puisque la table est lisible.
-- ─────────────────────────────────────────────────────────────────────
alter table journal enable row level security;
create policy "la vie de Rhode se lit par tous" on journal for select using (true);

grant select on journal to anon, authenticated;
--  Personne n'écrit par PostgREST : les lignes viennent des fonctions.
revoke insert, update, delete on journal from anon, authenticated;

grant execute on function journal_dernieres(jsonb) to anon, authenticated, service_role;
revoke all on function journal_ecrire(jsonb) from public, anon, authenticated;
grant execute on function journal_ecrire(jsonb) to service_role;

-- ════════════════════════════════════════════════════════════════════
--  ET LA BOUTIQUE Y ÉCRIT, DANS LA MÊME TRANSACTION
--
--  `boutique_servir` est reprise de `0011` — extraite PAR SCRIPT, comme
--  `appliquer_cloture` l'a été en `0012` — avec une seule chose en plus :
--  un appel à `journal_ecrire` juste avant le retour du chemin « servie ».
--
--  **Dans la même transaction, et c'est le point.** Une commande servie
--  a donc TOUJOURS sa ligne de journal : il n'existe aucun état « débité
--  mais pas annoncé ». C'est la leçon du 2 octobre — appliquer et
--  publier ne sont pas atomiques — appliquée là où elle peut l'être
--  gratuitement, puisque les deux écritures sont en base.
--
--  Et `journal_ecrire` ne lève jamais : une commande ne peut pas échouer
--  à cause d'une ligne de décor.
--
--  ── CE QUE LA LIGNE DIT, ET CE QU'ELLE NE DIT PAS ──────────────────
--
--  `{"articles": 3}` — le nombre d'objets, point. Ni la liste, ni le
--  prix, ni le solde. Le joueur reçoit tout ça dans son reçu ; l'index
--  n'a besoin que de savoir que la boutique a servi quelqu'un.
-- ════════════════════════════════════════════════════════════════════

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
end $$ language plpgsql security definer;
