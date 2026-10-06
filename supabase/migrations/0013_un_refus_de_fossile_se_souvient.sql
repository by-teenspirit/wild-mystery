-- ════════════════════════════════════════════════════════════════════
--  0013 · un refus de fossile se souvient d'avoir refusé
--
--  Relevé le 6 octobre, en exerçant pour la première fois les huit
--  fonctions de `0001` et `0002` qu'aucun test n'avait jamais appelées.
--  Six étaient justes. Deux ne l'étaient pas, et celle-ci porte le
--  **même défaut que `servir_commande`** — la troisième fois que le
--  motif apparaît dans ce dépôt :
--
--      update analyse_fossile set etat = 'refusee' where id = p_analyse;
--      raise exception 'FOSSILE_ABSENT';
--
--  **Le `raise` annule le `update`.** L'intention est claire et juste —
--  marquer l'analyse refusée — mais PL/pgSQL annule toute la
--  transaction, le marquage avec. Mesuré : l'analyse reste
--  `en_attente`, donc la relève la repasserait **à chaque passage, pour
--  toujours**, et le joueur recevrait le même refus toutes les cinq
--  minutes.
--
--  C'est exactement ce que `0011` a réglé pour la boutique, et la règle
--  qui en sort vaut pour tout le dépôt :
--
--  > **UN REFUS MÉTIER EST UNE VALEUR DE RETOUR, PAS UNE EXCEPTION.**
--  > Seul l'impossible lève : une analyse introuvable, un joueur
--  > inconnu. Tout ce qui est « non, et voilà pourquoi » doit pouvoir
--  > s'écrire en base, donc revenir par le retour.
--
--  ── ON A CHERCHÉ LE MOTIF PARTOUT, IL N'Y EN A QU'UN ────────────────
--
--  Un script a relu les treize migrations à la recherche d'un `update`
--  ou `insert` suivi d'un `raise` sans `return` entre les deux. Une
--  seule occurrence : celle-ci. La chasse est close.
--
--  ── CE QUI RESTE OUVERT, ET QUE JE NE TRANCHE PAS ───────────────────
--
--  **`refusee` est-il définitif ?** Le code de `0002` dit `refusee`, et
--  on le respecte. Mais un joueur peut racheter le fossile la semaine
--  suivante : faudrait-il laisser l'analyse en attente plutôt que la
--  refuser ? Personne n'a jamais vu ce cas se produire, puisque le
--  marquage n'a jamais survécu. **C'est une décision de jeu**, et elle
--  se changera en une ligne ici le jour où Callista tranchera.
--
--  **Le tirage de l'espèce se fait en `order by random()`.** C'est le
--  seul tirage du jeu qui ne se rejoue pas : tous les autres partent de
--  l'identifiant du message, ce qui permet de trancher une contestation
--  en recalculant. On ne le change pas maintenant, parce que la forme
--  de `fossile_espece` n'est pas décidée — la table est **vide**, et
--  c'est à Callista d'écrire quel fossile donne quelle espèce, avec ou
--  sans probabilités. Le tirage suivra cette forme.
-- ════════════════════════════════════════════════════════════════════

create or replace function rendre_fossile(p jsonb) returns jsonb as $$
declare
  v_analyse uuid := (p->>'analyseId')::uuid;
  a         record;
  esp       record;
  reste     integer;
begin
  if v_analyse is null then
    raise exception 'rendre_fossile : analyseId manquant dans %', p::text;
  end if;

  select * into a from analyse_fossile
   where id = v_analyse and etat = 'en_attente' for update;
  if not found then
    --  L'IMPOSSIBLE LÈVE. Une analyse introuvable ou déjà rendue n'est
    --  pas un refus qu'on écrit : il n'y a pas de ligne où l'écrire.
    raise exception 'ANALYSE_INTROUVABLE %', v_analyse;
  end if;

  -- ── le joueur a-t-il encore le fossile ? ──────────────────────────
  select quantite into reste from sac
   where joueur_id = a.joueur_id and objet_id = a.objet_id for update;
  if coalesce(reste, 0) < 1 then
    --  LE REFUS EST ÉCRIT, ET IL SURVIT, parce qu'on rend au lieu de
    --  lever. C'est tout l'objet de cette migration.
    update analyse_fossile set etat = 'refusee' where id = v_analyse;
    return jsonb_build_object(
      'etat', 'refusee',
      'analyseId', v_analyse,
      'motif', 'FOSSILE_ABSENT',
      'detail', 'Ce fossile n''est plus dans ton sac.');
  end if;

  -- ── ce fossile donne-t-il quelque chose ? ─────────────────────────
  select e.* into esp from fossile_espece fe
    join espece e on e.id = fe.espece_id
   where fe.objet_id = a.objet_id
   order by random() limit 1;
  if not found then
    --  CELUI-LÀ N'EST PAS LA FAUTE DU JOUEUR : `fossile_espece` est
    --  vide, donc c'est une donnée qui manque de notre côté. On ne
    --  marque donc PAS l'analyse refusée — elle se rejouera toute seule
    --  le jour où la table sera écrite, et le joueur n'aura rien perdu.
    --  Son fossile est encore dans son sac : on n'a rien consommé.
    return jsonb_build_object(
      'etat', 'impossible',
      'analyseId', v_analyse,
      'motif', 'FOSSILE_SANS_ESPECE',
      'detail', 'Aucune espèce n''est encore rattachée à ce fossile.');
  end if;

  -- ── on réanime ────────────────────────────────────────────────────
  update sac set quantite = quantite - 1
   where joueur_id = a.joueur_id and objet_id = a.objet_id;

  insert into pokemon (joueur_id, espece_id, niveau, xp, emplacement)
  values (a.joueur_id, esp.id, 15, seuil(15::smallint), 'boite');

  insert into pokedex (joueur_id, espece_id, croise_le, attrape_le)
  values (a.joueur_id, esp.id, now(), now())
      on conflict (joueur_id, espece_id) do update
         set attrape_le = coalesce(pokedex.attrape_le, excluded.attrape_le);

  update analyse_fossile set etat = 'rendue', espece_obtenue = esp.id
   where id = v_analyse;

  return jsonb_build_object(
    'etat', 'rendue',
    'analyseId', v_analyse,
    'especeId', esp.id,
    'espece', esp.nom_fr);
end $$ language plpgsql security definer;

--  L'ancienne signature disparaît : elle ne marquait jamais son refus,
--  et la garder serait laisser le piège en place. Rien ne l'appelle —
--  la tâche 5 de la relève n'est pas écrite.
drop function if exists rendre_fossile(uuid);

revoke all on function rendre_fossile(jsonb) from public, anon, authenticated;
grant execute on function rendre_fossile(jsonb) to service_role;

-- ════════════════════════════════════════════════════════════════════
--  ET UNE SECONDE FONCTION QU'ON NE RÉPARE PAS, EXPRÈS
--
--  `pensions_a_rendre()` cherche les pensions dont un message porte
--  `charge->>'pensionId'` dans une ligne `objet_utilise`. Mesuré le
--  6 octobre : avec cette clé, elle rend bien la pension ; avec la
--  charge que le domaine écrit RÉELLEMENT — `{objetId, quantite}` — elle
--  rend **zéro**.
--
--  **Personne, nulle part dans le dépôt, n'écrit jamais `pensionId`.**
--  La fonction est donc une requête morte, et zéro ressemble exactement
--  à « aucune pension à rendre ». C'est la troisième fonction réécrite
--  en `0004` qui cherche quelque chose qui n'existe pas, après
--  `ranger_pokedex` et `pensions_a_rendre` elle-même.
--
--  ── POURQUOI ON LA LAISSE CASSÉE ────────────────────────────────────
--
--  Parce que la réparer demanderait d'inventer le jeu. La planche 50 §2
--  a déjà déclaré la règle de pension FAUSSE : le SQL applique
--  `floor(jours / 10)` niveaux, l'annexe élevage dit que le pokémon
--  reste **une semaine entière**, que le **gérant déclare** les niveaux,
--  et que c'est **plafonné à dix par sujet**. Ce n'est pas une formule,
--  c'est une déclaration bornée.
--
--  Choisir la clé déclencheuse maintenant, c'est choisir *comment on
--  dépose un pokémon en pension* — et ça, c'est à Callista.
--
--  `rendre_pension` est en revanche éprouvée et saine : son arithmétique,
--  le retour en boîte, la libération de la position et le refus du rejeu
--  marchent tous. Voir `src/contrat/services.supabase.test.ts`. Quand la
--  règle sera écrite, il n'y aura que la règle à changer.
-- ════════════════════════════════════════════════════════════════════

comment on function pensions_a_rendre() is
  'DÉFAUT CONNU (6 octobre) : cherche charge->>''pensionId'' dans les '
  'lignes objet_utilise, que personne n''écrit jamais. Rend donc '
  'toujours zéro. Non réparée : la règle de pension est à réécrire '
  'd''abord (planche 50 §2, annexe élevage). Voir migration 0013.';
