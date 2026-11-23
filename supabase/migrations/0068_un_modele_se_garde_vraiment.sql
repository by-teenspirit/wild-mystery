-- ════════════════════════════════════════════════════════════════════
--  0068 · Un modèle se garde vraiment
--
--  « Je n'arrive pas à sauvegarder les modèles. » — 23 novembre.
--
--  ── DEUX INDEX PARTIELS, ET UN `ON CONFLICT` QUI NE PEUT PAS S'EN
--     SERVIR ────────────────────────────────────────────────────────
--
--  La 0067 posait deux index uniques partiels sur `rp_modele` :
--
--      create unique index rp_modele_un_nom
--        on rp_modele (joueur_id, nom) where joueur_id is not null;
--      create unique index rp_modele_un_nom_du_forum
--        on rp_modele (nom) where joueur_id is null;
--
--  Le raisonnement était juste : deux nuls ne sont pas égaux, donc un
--  index sur `(joueur_id, nom)` ne tient rien du côté du forum. D'où
--  deux index, chacun avec son `where`.
--
--  SAUF QU'UN INDEX PARTIEL NE SERT PAS À UN `ON CONFLICT`. PostgreSQL
--  refuse net :
--
--      ERROR: there is no unique or exclusion constraint matching the
--             ON CONFLICT specification
--
--  Et c'est exactement ce que le navigateur envoie : « garder ce texte »
--  fait un `POST` avec `Prefer: resolution=merge-duplicates`, parce que
--  garder deux fois sous le même nom doit REMPLACER — c'est ce qu'on
--  attend d'un modèle qu'on retouche. PostgREST le traduit en
--  `on conflict`, et la base le refusait. **Le bouton ne pouvait pas
--  marcher.**
--
--  Mesuré avant de corriger, sur un PostgreSQL 16 réel : l'`insert …
--  on conflict (joueur_id, nom)` lève, index partiels en place.
--
--  ── UNE SEULE CONTRAINTE, ET ELLE COUVRE LES DEUX CAS ───────────────
--
--  `unique nulls not distinct` : PostgreSQL 15 et au-delà, donc
--  Supabase. Elle dit « deux nuls SONT égaux », ce qui est exactement ce
--  qu'on veut ici — deux modèles du forum ne peuvent pas porter le même
--  nom, et la question du `where` disparaît.
--
--  Une contrainte, pas un index : `ON CONFLICT` l'accepte, PostgREST
--  peut la nommer, et il n'y a plus deux règles à tenir d'accord.
--
--  ── ET LE NAVIGATEUR NOMME LA CONTRAINTE ────────────────────────────
--
--  PostgREST ne devine pas sur quelle clé résoudre : sans
--  `?on_conflict=joueur_id,nom`, il prend la clé PRIMAIRE — ici `id`,
--  un `gen_random_uuid()` qui ne collisionne jamais. L'upsert se serait
--  comporté comme un insert, et le second enregistrement aurait levé
--  sur la contrainte d'unicité au lieu de remplacer.
--
--  C'est écrit dans `ecrire.ts`, avec la raison.
-- ════════════════════════════════════════════════════════════════════

--  ── LA CONTRAINTE D'ABORD, LES INDEX ENSUITE ────────────────────────
--
--  `if not exists` n'existe pas pour `add constraint`, donc on retire
--  avant d'ajouter — et cet ordre-ci n'est pas un détail de style.
--
--  AU SECOND MONTAGE, `rp_modele_un_nom` N'EST PLUS UN INDEX : c'est
--  l'index que porte la contrainte du même nom, et `drop index` le
--  refuse net —
--
--      ERROR: cannot drop index rp_modele_un_nom because constraint
--             rp_modele_un_nom on table rp_modele requires it
--
--  C'est le contrôle de rejeu qui l'a attrapé, comme à la 0063. En
--  retirant la contrainte d'abord, son index part avec elle, et les deux
--  `drop index` qui suivent ne trouvent plus que les index PARTIELS de
--  la 0067 — ceux qu'on venait vraiment remplacer.
alter table rp_modele drop constraint if exists rp_modele_un_nom;

drop index if exists rp_modele_un_nom;
drop index if exists rp_modele_un_nom_du_forum;

alter table rp_modele add constraint rp_modele_un_nom
  unique nulls not distinct (joueur_id, nom);

comment on constraint rp_modele_un_nom on rp_modele is
  'Un nom de modèle par joueur, et un par forum. `nulls not distinct` '
  'dit que deux nuls SONT égaux, ce qui est exactement ce qu''il faut '
  'ici — et une contrainte plutôt que deux index partiels, parce qu''un '
  'index partiel ne sert pas à un ON CONFLICT et que le bouton '
  '« garder » en a besoin (0068).';
