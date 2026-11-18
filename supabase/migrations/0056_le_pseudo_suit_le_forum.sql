-- ════════════════════════════════════════════════════════════════════
--  0056 · Le pseudo suit le forum
--
--  « Pourquoi le Maître du Jeu tague encore le "compte de test" alors
--  que j'ai changé de nom ? » — 18 novembre.
--
--  ── PARCE QU'IL ÉTAIT ÉCRIT UNE FOIS, ET JAMAIS RELU ────────────────
--
--  `joueur.pseudo` est posé à la liaison du carnet (`carnet_reclamer`,
--  migration 0023) et plus rien ne le touche. Les messages du Maître
--  du Jeu mentionnent `j.pseudo` : ils citent donc le nom qu'on portait
--  le jour où on a lié son compte, pour toujours.
--
--  ── IL SE MET À JOUR QUAND LE JOUEUR POSTE ──────────────────────────
--
--  La relève lit déjà le pseudo de l'auteur dans chaque message
--  (`ActionLue.auteurPseudo`) : il est là, à jour, à chaque action.
--  Comparer et corriger ne coûte rien, et le nom se répare tout seul
--  au premier message d'après le changement.
--
--  PAS DE TÂCHE DE SYNCHRONISATION, donc, et pas de parcours des
--  membres : ce serait une seconde mécanique pour une donnée qui
--  passe déjà sous nos yeux.
--
--  ── ON NE RÉÉCRIT PAS LE PASSÉ ──────────────────────────────────────
--
--  Les lignes de journal et de registre gardent le nom d'alors
--  (migration 0014, « un journal est une archive — elle dit ce qui
--  s'est passé, avec le nom qu'on portait »). Cette fonction ne touche
--  QUE la fiche du joueur, celle qui dit qui il est aujourd'hui.
--
--  ── UN PSEUDO VIDE NE REMPLACE RIEN ─────────────────────────────────
--
--  Un gabarit mal lu rendrait une chaîne vide, et le Maître du Jeu
--  mentionnerait « @ ». Mieux vaut un nom périmé qu'un nom absent.
-- ════════════════════════════════════════════════════════════════════

create or replace function joueur_renommer(p jsonb)
returns jsonb as $$
declare
  v_id     uuid := (p->>'joueurId')::uuid;
  v_pseudo text := nullif(btrim(p->>'pseudo'), '');
  v_avant  text;
begin
  if v_id is null then
    raise exception 'joueur_renommer : joueurId manquant';
  end if;
  if v_pseudo is null then
    --  PAS UNE ERREUR : la relève appelle à chaque action, et un
    --  message dont on n'a pas su lire l'auteur ne doit pas faire
    --  échouer la zone entière.
    return jsonb_build_object('renomme', false, 'motif', 'PSEUDO_VIDE');
  end if;

  select pseudo into v_avant from joueur where id = v_id;
  if v_avant is null then
    return jsonb_build_object('renomme', false, 'motif', 'JOUEUR_INCONNU');
  end if;
  if v_avant = v_pseudo then
    return jsonb_build_object('renomme', false, 'motif', 'DEJA_A_JOUR');
  end if;

  update joueur set pseudo = v_pseudo where id = v_id;
  return jsonb_build_object('renomme', true, 'avant', v_avant, 'apres', v_pseudo);
end $$ language plpgsql security definer set search_path = public, extensions;

comment on function joueur_renommer(jsonb) is
  'Met le pseudo d''un joueur d''accord avec celui que le forum sert, '
  'appelée par la relève à chaque action lue. Ne touche jamais les '
  'lignes de journal ni de registre : elles gardent le nom d''alors.';

revoke all on function joueur_renommer(jsonb) from public;
revoke all on function joueur_renommer(jsonb) from anon, authenticated;
grant execute on function joueur_renommer(jsonb) to service_role;
