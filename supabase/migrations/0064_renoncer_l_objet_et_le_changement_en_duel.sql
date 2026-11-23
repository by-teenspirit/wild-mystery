-- ════════════════════════════════════════════════════════════════════
--  0064 · Renoncer, l'objet et le changement en duel
--
--  ── D'ABORD UN DÉFAUT, ET IL ÉTAIT GRAVE ────────────────────────────
--
--  `combat_tour.demande` porte une contrainte depuis la 0048 :
--
--      check (demande in ('attaquer', 'ball', 'objet', 'changer', 'fuir'))
--
--  Le lot 2 du duel (0061) a ajouté un sixième geste — RENONCER — et ne
--  l'a pas ajouté là. Conséquence : **déclarer forfait levait une
--  violation de contrainte.** Personne n'aurait pu sortir d'un duel
--  autrement qu'en clôturant le sujet.
--
--  ET RIEN NE L'AVAIT VU : 1385 tests verts, le harnais vert, un
--  exercice en base réelle vert. L'exercice avait joué « attaquer », pas
--  « renoncer », et `CombatsEnMemoire` acceptait n'importe quelle
--  demande en répondant « joué ». **Un double qui accepte plus que la
--  base est un double qui ment**, et celui-là mentait depuis le 18
--  novembre. Il porte maintenant la même liste, et il lève.
--
--  ── ET DEUX RÈGLES DE JEU QUI VIENNENT D'ÊTRE TRANCHÉES ─────────────
--
--  Callista, le 23 novembre : « les objets sont autorisés en combat » et
--  « changer de pokémon, ça permet à l'autre d'attaquer, ça utilise un
--  de tes tours ».
--
--  C'ÉTAIT LE REFUS QUE LA 0061 AVAIT LAISSÉ OUVERT, et la réponse est
--  plus simple que les deux options que je lui avais présentées : « la
--  main passe » et « l'adversaire gagne un coup » sont la MÊME chose
--  dans un duel. Personne ne riposte automatiquement — l'autre frappe
--  parce que c'est son tour, et c'est tout.
--
--  LA BASE N'A DONC RIEN À APPRENDRE POUR ÇA : `objet` et `changer`
--  sont des demandes connues depuis la 0048, `jouer_un_tour` fait
--  passer la main à tout tour de duel qui ne finit pas le combat
--  (0061), et un tour sans frappe est un `recit` sans frappe — du jsonb,
--  que la base ne lit pas. Tout le travail est côté relève.
--
--  CETTE MIGRATION NE PORTE DONC QU'UNE LIGNE UTILE, et c'est bien :
--  une règle de jeu qui ne demande pas de migration est une règle que
--  le dessin avait prévue.
-- ════════════════════════════════════════════════════════════════════

--  `drop` PUIS `add` : une contrainte `check` ne se remplace pas, et
--  c'est rejouable dans cet ordre. Le nom est celui que PostgreSQL avait
--  donné tout seul en 0048 (`<table>_<colonne>_check`), et on le garde
--  pour ne pas laisser deux contraintes qui disent presque la même
--  chose.
alter table combat_tour drop constraint if exists combat_tour_demande_check;
alter table combat_tour drop constraint if exists combat_tour_demande_connue;
alter table combat_tour add constraint combat_tour_demande_connue
  check (demande in ('attaquer', 'ball', 'objet', 'changer', 'fuir', 'renoncer'));

comment on constraint combat_tour_demande_connue on combat_tour is
  'Les six gestes qu''un message peut demander. « renoncer » est arrivé '
  'avec le duel (0061) et manquait ici : déclarer forfait levait une '
  'violation de contrainte, et aucun test ne le voyait parce que le '
  'double en mémoire acceptait tout (0064).';
