-- ════════════════════════════════════════════════════════════════════
--  0010 · les familles d'objets, alignées sur le catalogue réel
--
--  `0001` fixait `famille in ('ball','soin','pierre','fossile','divers')`
--  AVANT qu'un catalogue existe. Le catalogue est arrivé le 5 octobre
--  (`data/objets.json`, 34 articles) et en utilise six, dont quatre que
--  la contrainte refuse : `statut`, `rappel`, `evolution`, `tenu`.
--
--  Le `insert` du seed échouait donc deux fois, et la première erreur
--  cachait la seconde.
--
--  ── POURQUOI ÉLARGIR PLUTÔT QUE REPLIER ─────────────────────────────
--
--  On aurait pu ranger les soins de statut et les rappels sous `soin`,
--  et les objets tenus sous `divers`. C'est ce que le schéma suggérait.
--  Mais la famille sert à GROUPER LE CATALOGUE DANS LE MESSAGE du sujet
--  de boutique — « Les soins », « Les soins de statut », « Les rappels »
--  — et replier ici obligerait à tenir un second groupement ailleurs.
--  Deux groupements du même catalogue finiraient par diverger, comme
--  tout le reste cette semaine.
--
--  ── `pierre` DEVIENT `evolution` ────────────────────────────────────
--
--  Même chose sous deux noms. Aucune ligne ne porte `pierre` — la table
--  n'en a qu'une, une Poké Ball d'essai — donc rien à migrer. On garde
--  `fossile` et `divers` : ils ne sont pas au catalogue parce que ces
--  objets NE SE VENDENT PAS, pas parce qu'ils n'existent pas.
--
--  ── LES IDENTIFIANTS DU CATALOGUE SONT UNE PLAGE RÉSERVÉE ───────────
--
--  `id` est `generated always as identity`, et le seed force 990001 et
--  suivants avec `overriding system value`. La séquence, elle, n'est
--  PAS déplacée : on veut qu'un objet créé plus tard par la base prenne
--  1, 2, 3… et pas 990104. La plage haute est au catalogue, la basse à
--  la base, et elles ne se croisent pas avant cent mille objets.
-- ════════════════════════════════════════════════════════════════════

alter table objet drop constraint if exists objet_famille_check;

alter table objet
  add constraint objet_famille_check
  check (famille in (
    'ball',       -- les balls de capture
    'soin',       -- rendre des PV
    'statut',     -- soigner un statut
    'rappel',     -- ranimer un pokémon K.O.
    'evolution',  -- pierres et objets d'évolution
    'tenu',       -- objets qu'un pokémon tient
    'fossile',    -- se trouvent, ne se vendent pas
    'divers'      -- le reste
  ));
