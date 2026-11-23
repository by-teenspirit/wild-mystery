-- ════════════════════════════════════════════════════════════════════
--  0067 · Les modèles de RP
--
--  « Quand on écrit, faudrait des modèles de rp. Et aussi, permettre
--  aux gens de sauvegarder leurs propres modèles de rp. » —
--  23 novembre.
--
--  ── UNE TABLE, ET LE MÊME TROU QUE LA PENSION ───────────────────────
--
--  `joueur_id` nul = un modèle DU FORUM, posé par le staff et offert à
--  tout le monde. C'est exactement le dessin de `pension_gerance`
--  (0065), et il évite la même chose : une seconde table qui dirait
--  presque la même chose sur les mêmes colonnes, avec sa propre
--  lecture, ses propres droits et son propre jour où les deux
--  divergent.
--
--  Un seul chemin pour lister, un seul pour insérer dans l'éditeur, et
--  la différence tient dans un `is null`.
--
--  ── CE QU'ON N'Y MET PAS, ET POURQUOI ───────────────────────────────
--
--  PAS DE PARTAGE ENTRE JOUEURS. « Permettre aux gens de sauvegarder
--  LEURS propres modèles » : les siens, et ceux du forum. Un modèle
--  qu'on offre à un autre joueur demanderait un destinataire, une
--  acceptation, un retrait — toute la mécanique d'un envoi, pour une
--  chose qu'un copier-coller fait déjà. Le jour où elle le demande, la
--  table est prête : il n'y a qu'un `partage` à ajouter.
--
--  PAS DE DOSSIERS NI D'ORDRE. Une liste de modèles qu'un joueur écrit
--  lui-même compte cinq lignes, pas cinquante. L'ordre alphabétique
--  suffit, et une colonne `ordre` serait un glisser-déposer à écrire
--  pour personne.
--
--  ── LE CORPS EST DU BBCODE, ET LA BASE NE LE REGARDE PAS ────────────
--
--  C'est ce que le joueur collera dans l'éditeur de Forumactif, donc
--  c'est son texte avec ses balises. La base le stocke et le rend ;
--  elle ne le valide pas, ne l'échappe pas et ne le nettoie pas.
--
--  **ET C'EST LE NAVIGATEUR QUI DOIT S'EN SOUVENIR.** Un modèle est du
--  texte écrit par un joueur, affiché à ce joueur : il entre dans
--  l'éditeur par `value`, jamais par `innerHTML`. La borne de 8 000
--  signes est là pour qu'un modèle reste un modèle — au-delà, c'est un
--  RP.
-- ════════════════════════════════════════════════════════════════════

create table if not exists rp_modele (
  id        uuid primary key default gen_random_uuid(),
  --  NUL = UN MODÈLE DU FORUM, offert à tout le monde. Voir l'en-tête.
  joueur_id uuid references joueur(id) on delete cascade,
  nom       text not null check (length(btrim(nom)) between 1 and 60),
  corps     text not null check (length(corps) between 1 and 8000),
  cree_le   timestamptz not null default now()
);

--  LE MÊME NOM DEUX FOIS CHEZ LE MÊME JOUEUR N'A PAS DE SENS : on
--  choisit un modèle par son nom dans un menu, et deux « Mon intro »
--  ne se distinguent pas.
create unique index if not exists rp_modele_un_nom
  on rp_modele (joueur_id, nom) where joueur_id is not null;
--  ET DU CÔTÉ DU FORUM AUSSI, où `joueur_id` est nul : un index partiel
--  sur `nom` seul, parce qu'un index sur `(joueur_id, nom)` ne tient
--  rien quand `joueur_id` est nul — deux nuls ne sont pas égaux.
create unique index if not exists rp_modele_un_nom_du_forum
  on rp_modele (nom) where joueur_id is null;

create index if not exists rp_modele_du_joueur on rp_modele (joueur_id, nom);

alter table rp_modele enable row level security;

--  `drop` D'ABORD : `create policy` n'a pas de `if not exists`, et la
--  migration doit se rejouer. C'est le défaut que le contrôle de rejeu
--  a attrapé à la 0063, et il ne se répétera pas.
drop policy if exists rp_modele_lecture on rp_modele;
create policy rp_modele_lecture on rp_modele for select to authenticated
  using (joueur_id is null or joueur_id in (select mes_joueurs()));

--  ── IL ÉCRIT LES SIENS, ET SEULEMENT LES SIENS ────────────────────
--
--  `joueur_id in (select mes_joueurs())` dans le `with check` : sans
--  lui, un joueur pourrait insérer une ligne à `joueur_id` nul et
--  offrir son modèle au forum entier. Les modèles du forum se posent
--  avec la clé de service, comme la ligne de la pension publique.
--
--  `mes_joueurs()` ET PAS `joueur_courant()` : ce forum autorise
--  plusieurs personnages par connexion depuis la 0029, et
--  `joueur_courant()` n'en rend qu'UN — silencieusement. Le second
--  personnage n'aurait vu aucun de ses modèles. Voir la 0066, où
--  j'avais écrit la même faute et où elle est racontée.
drop policy if exists rp_modele_ajout on rp_modele;
create policy rp_modele_ajout on rp_modele for insert to authenticated
  with check (joueur_id in (select mes_joueurs()));

drop policy if exists rp_modele_reecriture on rp_modele;
create policy rp_modele_reecriture on rp_modele for update to authenticated
  using (joueur_id in (select mes_joueurs()))
  with check (joueur_id in (select mes_joueurs()));

drop policy if exists rp_modele_retrait on rp_modele;
create policy rp_modele_retrait on rp_modele for delete to authenticated
  using (joueur_id in (select mes_joueurs()));

--  LES COLONNES QU'IL PEUT ÉCRIRE, et pas une de plus : `id` et
--  `cree_le` ont leur défaut, et laisser le navigateur poser `cree_le`
--  reviendrait à lui laisser écrire une date qu'il choisit.
revoke update on rp_modele from authenticated;
grant select on rp_modele to authenticated;
grant insert (joueur_id, nom, corps) on rp_modele to authenticated;
grant update (nom, corps) on rp_modele to authenticated;
grant delete on rp_modele to authenticated;

comment on table rp_modele is
  'Les modèles de RP : ceux du forum (`joueur_id` nul, posés avec la '
  'clé de service) et ceux que chacun se garde. Le corps est du BBCode '
  'que la base ne regarde pas — elle le stocke et le rend, et c''est le '
  'navigateur qui le met dans l''éditeur par `value` et jamais par '
  '`innerHTML` (0067).';
comment on column rp_modele.joueur_id is
  'Nul = un modèle du forum, offert à tout le monde. Même dessin que '
  '`pension_gerance.gerant_id` (0065) : un seul chemin de lecture, et '
  'la différence tient dans un `is null`.';
