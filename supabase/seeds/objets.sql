--  DÉRIVÉ DE data/objets.json — NE PAS MODIFIER À LA MAIN.
--  Régénérer avec : python3 outils/objets.py --sql > supabase/seeds/objets.sql
--
--  `on conflict do update` et pas `insert` seul : ce fichier se
--  rejoue à chaque déploiement, et un prix qui change doit
--  s'appliquer sans vider la table — les sacs des joueurs
--  référencent ces lignes.
--
--  `overriding system value` : `objet.id` est
--  `generated always as identity`, et PostgreSQL refuse un id
--  explicite sans ça — « cannot insert a non-DEFAULT value into
--  column id ». Or les identifiants du catalogue ne sont pas
--  négociables : ils sont écrits dans le message du sujet de
--  boutique (`data-wm-objet`) et dans les lignes de registre
--  déjà posées. C'est la base qui s'adapte, pas eux.
--
--  La séquence n'est PAS déplacée : voir la migration 0010.

insert into objet (id, slug, nom, famille, prix, en_vente)
overriding system value values
  (990001, 'poke-ball', 'Poké Ball', 'ball', 200, true),
  (990002, 'great-ball', 'Super Ball', 'ball', 600, true),
  (990003, 'ultra-ball', 'Hyper Ball', 'ball', 1200, true),
  (990004, 'net-ball', 'Filet Ball', 'ball', 1000, true),
  (990005, 'dive-ball', 'Scuba Ball', 'ball', 1000, true),
  (990006, 'nest-ball', 'Faiblo Ball', 'ball', 1000, true),
  (990007, 'dusk-ball', 'Sombre Ball', 'ball', 1000, true),
  (990008, 'quick-ball', 'Rapide Ball', 'ball', 1000, true),
  (990020, 'potion', 'Potion', 'soin', 300, true),
  (990021, 'super-potion', 'Super Potion', 'soin', 700, true),
  (990022, 'hyper-potion', 'Hyper Potion', 'soin', 1200, true),
  (990023, 'max-potion', 'Potion Max', 'soin', 2500, true),
  (990040, 'antidote', 'Antidote', 'statut', 100, true),
  (990041, 'burn-heal', 'Anti-Brûle', 'statut', 250, true),
  (990042, 'ice-heal', 'Antigel', 'statut', 250, true),
  (990043, 'awakening', 'Réveil', 'statut', 250, true),
  (990044, 'paralyze-heal', 'Anti-Para', 'statut', 200, true),
  (990045, 'full-heal', 'Total Soin', 'statut', 600, true),
  (990060, 'revive', 'Rappel', 'rappel', 1500, true),
  (990061, 'max-revive', 'Rappel Max', 'rappel', 4000, true),
  (990080, 'fire-stone', 'Pierre Feu', 'evolution', 3000, true),
  (990081, 'water-stone', 'Pierre Eau', 'evolution', 3000, true),
  (990082, 'thunder-stone', 'Pierre Foudre', 'evolution', 3000, true),
  (990083, 'leaf-stone', 'Pierre Plante', 'evolution', 3000, true),
  (990084, 'ice-stone', 'Pierre Glace', 'evolution', 3000, true),
  (990085, 'moon-stone', 'Pierre Lune', 'evolution', 3000, true),
  (990086, 'sun-stone', 'Pierre Soleil', 'evolution', 3000, true),
  (990087, 'shiny-stone', 'Pierre Éclat', 'evolution', 3000, true),
  (990088, 'dusk-stone', 'Pierre Nuit', 'evolution', 3000, true),
  (990089, 'dawn-stone', 'Pierre Aube', 'evolution', 3000, true),
  (990100, 'metal-coat', 'Peau Métal', 'tenu', 3000, true),
  (990101, 'prism-scale', 'Bel''Écaille', 'tenu', 3000, true),
  (990102, 'sweet-apple', 'Fleur Sucrée', 'tenu', 3000, true),
  (990103, 'kings-rock', 'Roche Royale', 'tenu', 3000, true)
on conflict (id) do update set
  slug = excluded.slug,
  nom = excluded.nom,
  famille = excluded.famille,
  prix = excluded.prix,
  en_vente = excluded.en_vente;
