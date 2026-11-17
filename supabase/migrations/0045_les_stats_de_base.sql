-- ════════════════════════════════════════════════════════════════════
--  0045 · L'attaque et la défense de base
--
--  « Il faut qu'il s'affiche en dessous de mon message, via un message
--  du Maître du Jeu, et qu'on ait ses stats, que ça engage un combat
--  entre le premier pokémon de mon équipe et le ponyta. »
--  — 17 novembre 2026.
--
--  ── CE QUI MANQUAIT, ET QUI BLOQUAIT TOUT LE RESTE ──────────────────
--
--  `espece` ne portait que `pv_base`. Un combat se résout avec
--  l'attaque de l'un contre la défense de l'autre : sans ces deux
--  colonnes, la table `combat` et la résolution d'un tour n'ont rien
--  à lire, et la carte de rencontre n'a rien à afficher.
--
--  Les champions, eux, avaient déjà leurs chiffres — mais calculés
--  dans `outils/equipes-de-champions.py`, pour une page, jamais versés
--  en base. Le serveur ne pouvait pas les voir.
--
--  ── TROIS CHIFFRES, PARCE QUE LE FORUM EN MONTRE TROIS ──────────────
--
--  PokéAPI en porte six. On en prend trois — PV, ATT, DÉF — parce que
--  c'est ce que la carte des champions et la carte de dresseur
--  affichent depuis toujours, et ce que la formule du 6 novembre
--  calcule :
--
--      PV    = ⌊2 × base × niveau / 100⌋ + niveau + 10
--      ATT   = ⌊2 × base × niveau / 100⌋ + 5
--      DÉF   = ⌊2 × base × niveau / 100⌋ + 5
--
--  Vérifiée contre le sujet t1002 : 60 des 65 pokémon nommés la
--  reproduisent au chiffre près. On ne la réinvente pas ici.
--
--  CONSÉQUENCE ASSUMÉE : une capacité « spéciale » frappera avec
--  l'attaque, pas avec une attaque spéciale. `data/capacites.json`
--  garde la catégorie, donc la séparation reste possible plus tard —
--  mais tant que le forum n'affiche pas le chiffre, le combat ne doit
--  pas s'en servir : un joueur qui perd ne doit pas avoir à croire sur
--  parole un nombre qu'il ne peut pas lire.
--
--  ── LA VALEUR PAR DÉFAUT, ET POURQUOI ELLE EST BASSE ────────────────
--
--  `default 45`, comme `pv_base`, pour que la colonne s'ajoute sans
--  casser les lignes déjà là. Mais c'est le seed qui fait foi : il
--  repasse sur les 955 espèces en `on conflict do update`. Une espèce
--  restée à 45 des deux côtés est une espèce que le seed n'a pas vue,
--  et le garde-fou n° 9 le dit.
-- ════════════════════════════════════════════════════════════════════

alter table espece add column if not exists att_base smallint not null default 45;
alter table espece add column if not exists def_base smallint not null default 45;

comment on column espece.att_base is
  'L''attaque de base de PokéAPI (stat_id 2). Sert au combat via '
  '⌊2 × base × niveau / 100⌋ + 5. Semée par supabase/seeds/especes.sql.';

comment on column espece.def_base is
  'La défense de base de PokéAPI (stat_id 3). Même formule que '
  'l''attaque. Semée par supabase/seeds/especes.sql.';

-- ── LA FORMULE, EN BASE ───────────────────────────────────────────────
--
--  ELLE VIT ICI PARCE QUE LE SERVEUR EN A BESOIN. Le domaine la
--  refera en TypeScript pour la résolution d'un tour ; la base en a
--  besoin pour poser les PV d'un combat qui s'ouvre, et une formule
--  recopiée est une formule qui divergera. Les deux sont tenues
--  d'accord par la suite pgTAP, qui vérifie les chiffres de t1002.
--
--  `immutable` : même entrée, même sortie, toujours. Postgres peut
--  l'appeler dans un index ou une contrainte si le besoin vient.
create or replace function pv_au_niveau(p_base smallint, p_niveau smallint)
returns integer as $$
  select (2 * p_base * p_niveau) / 100 + p_niveau + 10;
$$ language sql immutable;

create or replace function stat_au_niveau(p_base smallint, p_niveau smallint)
returns integer as $$
  select (2 * p_base * p_niveau) / 100 + 5;
$$ language sql immutable;

comment on function pv_au_niveau(smallint, smallint) is
  'Les PV d''un Pokémon à un niveau : ⌊2 × base × niveau / 100⌋ + '
  'niveau + 10. Formule de la 3e génération, IV 0, EV 0, nature '
  'neutre — celle que le forum affiche depuis t1002.';

comment on function stat_au_niveau(smallint, smallint) is
  'L''attaque ou la défense à un niveau : ⌊2 × base × niveau / 100⌋ '
  '+ 5. Même provenance que pv_au_niveau.';

grant execute on function pv_au_niveau(smallint, smallint) to anon, authenticated, service_role;
grant execute on function stat_au_niveau(smallint, smallint) to anon, authenticated, service_role;
