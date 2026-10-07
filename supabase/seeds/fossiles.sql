--  DÉRIVÉ DE data/fossiles.json — NE PAS MODIFIER À LA MAIN.
--  Régénérer avec : python3 outils/fossiles.py --sql > supabase/seeds/fossiles.sql
--
--  Trois tables d'un seul fichier : les objets, l'espèce que
--  chaque fossile rend, et le nombre de morceaux qui en font un.
--
--  `overriding system value` : `objet.id` est
--  `generated always as identity`. Même raison que le seed du
--  catalogue — ces identifiants sont écrits dans des lignes de
--  registre et dans des sacs, c'est la base qui s'adapte.
--
--  Les fossiles ne se vendent pas : `prix` est nul et
--  `en_vente` faux. La boutique les ignore donc d'elle-même,
--  sans qu'on ait à lui apprendre ce qu'est un fossile.

insert into objet (id, slug, nom, famille, prix, en_vente)
overriding system value values
  (991001, 'root-fossil', 'Fossile Racine', 'fossile', null, false),
  (991002, 'claw-fossil', 'Fossile Griffe', 'fossile', null, false),
  (991003, 'helix-fossil', 'Nautile', 'fossile', null, false),
  (991004, 'dome-fossil', 'Fossile Dôme', 'fossile', null, false),
  (991005, 'old-amber', 'Vieil Ambre', 'fossile', null, false),
  (991006, 'armor-fossil', 'Fossile Armure', 'fossile', null, false),
  (991007, 'skull-fossil', 'Fossile Crâne', 'fossile', null, false),
  (991008, 'cover-fossil', 'Fossile Plaque', 'fossile', null, false),
  (991009, 'plume-fossil', 'Fossile Plume', 'fossile', null, false),
  (991010, 'jaw-fossil', 'Fossile Mâchoire', 'fossile', null, false),
  (991011, 'sail-fossil', 'Fossile Nageoire', 'fossile', null, false),
  (991101, 'morceau-root-fossil', 'Morceau de Fossile Racine', 'fossile', null, false),
  (991102, 'morceau-claw-fossil', 'Morceau de Fossile Griffe', 'fossile', null, false),
  (991103, 'morceau-helix-fossil', 'Morceau de Nautile', 'fossile', null, false),
  (991104, 'morceau-dome-fossil', 'Morceau de Fossile Dôme', 'fossile', null, false),
  (991105, 'morceau-old-amber', 'Morceau de Vieil Ambre', 'fossile', null, false),
  (991106, 'morceau-armor-fossil', 'Morceau de Fossile Armure', 'fossile', null, false),
  (991107, 'morceau-skull-fossil', 'Morceau de Fossile Crâne', 'fossile', null, false),
  (991108, 'morceau-cover-fossil', 'Morceau de Fossile Plaque', 'fossile', null, false),
  (991109, 'morceau-plume-fossil', 'Morceau de Fossile Plume', 'fossile', null, false),
  (991110, 'morceau-jaw-fossil', 'Morceau de Fossile Mâchoire', 'fossile', null, false),
  (991111, 'morceau-sail-fossil', 'Morceau de Fossile Nageoire', 'fossile', null, false)
on conflict (id) do update set
  slug = excluded.slug,
  nom = excluded.nom,
  famille = excluded.famille,
  prix = excluded.prix,
  en_vente = excluded.en_vente;

--  UNE ESPÈCE, UN FOSSILE (règle du 7 octobre). La table reste
--  (objet, espèce) et non (objet, espèce, probabilité) : le jour
--  où un fossile rendra deux espèces, c'est ici que la
--  probabilité s'ajoutera, et `rendre_fossile` avec.
insert into fossile_espece (objet_id, espece_id) values
  (991001, 345),  -- Fossile Racine → Lilia
  (991002, 347),  -- Fossile Griffe → Anorith
  (991003, 138),  -- Nautile → Amonita
  (991004, 140),  -- Fossile Dôme → Kabuto
  (991005, 142),  -- Vieil Ambre → Ptéra
  (991006, 410),  -- Fossile Armure → Dinoclier
  (991007, 408),  -- Fossile Crâne → Kranidos
  (991008, 564),  -- Fossile Plaque → Carapagos
  (991009, 566),  -- Fossile Plume → Arkéapti
  (991010, 696),  -- Fossile Mâchoire → Ptyranidur
  (991011, 698)  -- Fossile Nageoire → Amagara
on conflict (objet_id, espece_id) do nothing;

--  CE QU'UN MORCEAU DEVIENT, et combien il en faut. Le
--  déclencheur de la migration 0016 ne lit que ça : changer le
--  nombre ici le change partout.
insert into fossile_morceau (morceau_id, fossile_id, morceaux_requis) values
  (991101, 991001, 3),
  (991102, 991002, 3),
  (991103, 991003, 3),
  (991104, 991004, 3),
  (991105, 991005, 3),
  (991106, 991006, 3),
  (991107, 991007, 3),
  (991108, 991008, 3),
  (991109, 991009, 3),
  (991110, 991010, 3),
  (991111, 991011, 3)
on conflict (morceau_id) do update set
  fossile_id = excluded.fossile_id,
  morceaux_requis = excluded.morceaux_requis;
