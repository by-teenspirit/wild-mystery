-- ════════════════════════════════════════════════════════════════════
--  0066 · La colonne abandonnée, les colonnes qu'on montre, et les
--         gens qu'on ajoute à la main
--
--  Trois demandes du 23 novembre, et elles tiennent en trois colonnes
--  et une table.
--
--  ── « IL FAUDRAIT AUSSI UNE COLONNE ABANDONNÉ » ─────────────────────
--
--  Le sixième mot. La règle de la 0037 tient : ce sont les MOTS DE
--  L'ÉCRAN, pas un de plus, et la liste gagne juste un terme. « À toi »
--  et « à moi » n'y sont toujours pas — ils se calculent depuis
--  `dernier_auteur`, et deux sources pour une même vérité en font
--  toujours une fausse.
--
--  ABANDONNÉ N'EST PAS EN-PAUSE, et c'est pour ça qu'il faut un mot de
--  plus plutôt qu'un usage détourné : une pause est un RP qu'on
--  reprendra, un abandon est un RP qu'on ne reprendra pas. Le joueur
--  sait lequel est lequel ; le code, non, et il n'a pas à le deviner.
--
--  ── « LA PERSONNE PEUT AFFICHER LES COLONNES QU'ELLE SOUHAITE » ─────
--
--  `rp_colonne` existait déjà, depuis le 20 novembre, pour que chacun
--  NOMME ses colonnes. Elle apprend à en cacher : une colonne de plus
--  sur la même table, au lieu d'une seconde table qui dirait presque la
--  même chose sur les mêmes clés.
--
--  MONTRÉE PAR DÉFAUT, et ça compte : une ligne de `rp_colonne`
--  n'existe que si le joueur a renommé quelque chose. Si l'absence de
--  ligne voulait dire « cachée », un carnet neuf n'aurait aucune
--  colonne. Le défaut dit donc « montrée », et c'est le geste de
--  cacher qui écrit.
--
--  ── « SI LA PERSONNE N'A PAS ENCORE RÉPONDU, FAUDRAIT POUVOIR LES
--     RAJOUTER MANUELLEMENT » ────────────────────────────────────────
--
--  `rp_participant` est rempli par la relève avec qui a POSTÉ. C'est un
--  fait du forum, vrai pour tout le monde, et il n'a pas à bouger.
--
--  UNE SECONDE TABLE, DONC, ET PAS UN DRAPEAU SUR LA PREMIÈRE. Trois
--  raisons, et la première suffirait :
--
--  · CE N'EST PAS LA MÊME VÉRITÉ. « Erin a posté dans ce sujet » est un
--    fait ; « j'attends Erin dans ce RP » est une annotation, la mienne,
--    et elle peut être fausse — la personne peut ne jamais venir ;
--  · LA CLÉ N'EST PAS LA MÊME. `rp_participant` est indexée par
--    `forum_user_id`, qu'on n'a pas forcément pour quelqu'un qui n'a
--    rien posté. Un invité est un PSEUDO, celui que le joueur a tapé ;
--  · ELLE EST À MOI. Deux joueurs du même RP peuvent attendre deux
--    personnes différentes, et l'un ne doit pas écrire dans la liste de
--    l'autre.
--
--  Et quand la personne finit par poster, la relève l'écrit dans
--  `rp_participant` : le carnet affiche alors les deux listes fondues,
--  sans doublon. L'invité ne s'efface pas tout seul — c'est au joueur de
--  le retirer s'il veut, parce qu'effacer son annotation parce qu'un
--  fait l'a rejointe serait effacer ce qu'il avait écrit.
-- ════════════════════════════════════════════════════════════════════

-- ── 1 · LE SIXIÈME MOT ──────────────────────────────────────────────

alter table rp drop constraint if exists rp_etat_connu;
alter table rp add constraint rp_etat_connu
  check (etat in ('en-cours', 'prevu', 'en-pause', 'cloture', 'solo', 'abandonne'));

comment on column rp.etat is
  'Ce que le JOUEUR dit de son RP : en-cours, prevu, en-pause, '
  'cloture, solo, abandonne. « À toi » et « à moi » n''y sont pas — ils '
  'se calculent depuis `dernier_auteur`, et deux sources pour une même '
  'vérité en font toujours une fausse (0037). « abandonne » n''est pas '
  '« en-pause » : une pause se reprend, un abandon non, et seul le '
  'joueur sait lequel est lequel (0066).';

--  ET `rp_colonne` SUIT, puisqu'on peut renommer la nouvelle comme les
--  cinq autres. Sa contrainte est la même liste, et c'est volontaire :
--  un nom pour une colonne qui n'existe pas ne s'afficherait nulle part
--  et resterait à traîner.
alter table rp_colonne drop constraint if exists rp_colonne_etat_check;
alter table rp_colonne drop constraint if exists rp_colonne_etat_connu;
alter table rp_colonne add constraint rp_colonne_etat_connu
  check (etat in ('en-cours', 'prevu', 'en-pause', 'cloture', 'solo', 'abandonne'));

-- ── 2 · LES COLONNES QU'ON MONTRE ───────────────────────────────────

alter table rp_colonne add column if not exists montree boolean not null default true;

comment on column rp_colonne.montree is
  'Vrai par défaut, et c''est nécessaire : une ligne de cette table '
  'n''existe que si le joueur a touché à la colonne. Si l''absence de '
  'ligne voulait dire « cachée », un carnet neuf serait vide (0066).';

-- ── 3 · ON EFFACE N'IMPORTE QUELLE CARTE ────────────────────────────
--
--  « Si on veut supprimer une carte, tu mets un "X", peu importe si
--  c'est prévu ou dans une autre colonne. » — 23 novembre.
--
--  La 0037 n'autorisait que `prevu`, et sa raison était bonne : on
--  n'ajoute qu'une INTENTION, et effacer une carte relevée reviendrait
--  à nier un sujet où l'on a écrit.
--
--  SAUF QUE LA CARTE N'EST PAS LE SUJET. Effacer la ligne `rp` retire
--  le RP du carnet de CE joueur ; le sujet reste sur le forum, les
--  messages restent, le registre reste. Et la relève la remettra au
--  prochain passage si le sujet est toujours là — ce qui est exactement
--  le bon comportement : on ne peut pas se faire disparaître d'un RP en
--  cours, on peut juste ranger son carnet.
--
--  C'est pour ça que le geste demande une CONFIRMATION côté carnet
--  plutôt qu'un refus en base : ce n'est pas interdit, c'est juste
--  définitif pour les trois colonnes que le joueur tient lui-même
--  (`prevu`, et désormais `en-pause` et `abandonne` qu'aucun sujet ne
--  réalimente s'il est clos).
drop policy if exists rp_effacement on rp;
create policy rp_effacement on rp for delete to authenticated
  using (joueur_id in (select mes_joueurs()));

comment on policy rp_effacement on rp is
  'On efface n''importe laquelle de SES cartes. La carte n''est pas le '
  'sujet : le forum, les messages et le registre restent, et la relève '
  'remettra la carte au prochain passage si le sujet vit toujours. On '
  'ne disparaît pas d''un RP, on range son carnet (0066).';

-- ── 4 · LES GENS QU'ON ATTEND ───────────────────────────────────────

create table if not exists rp_invite (
  joueur_id uuid    not null references joueur(id) on delete cascade,
  sujet_id  integer not null check (sujet_id > 0),
  --  UN PSEUDO, PAS UN IDENTIFIANT. Quelqu'un qui n'a rien posté n'a
  --  pas forcément de `forum_user_id` connu de nous, et exiger qu'il en
  --  ait un reviendrait à n'autoriser que les membres qu'on a déjà
  --  croisés. Le joueur tape le nom qu'il attend.
  pseudo    text    not null check (length(btrim(pseudo)) between 1 and 40),
  ajoute_le timestamptz not null default now(),
  --  LE MÊME PSEUDO DEUX FOIS DANS LE MÊME SUJET N'A PAS DE SENS, et la
  --  clé le refuse. En minuscules pour que « Erin » et « erin » soient
  --  la même personne — c'est ce que le joueur croit en tapant.
  primary key (joueur_id, sujet_id, pseudo)
);

create index if not exists rp_invite_du_sujet on rp_invite (joueur_id, sujet_id);

alter table rp_invite enable row level security;

--  `drop` D'ABORD : `create policy` n'a pas de `if not exists`, et cette
--  migration doit se rejouer — c'est le défaut que le contrôle de rejeu
--  a attrapé à la 0063.
drop policy if exists rp_invite_lecture on rp_invite;
create policy rp_invite_lecture on rp_invite for select to authenticated
  using (joueur_id in (select mes_joueurs()));

--  ── IL ÉCRIT LUI-MÊME, DEPUIS SON CARNET ──────────────────────────
--
--  C'est le deuxième endroit du dépôt où un joueur écrit directement,
--  après `rp.etat`/`ordre`/`description` et `rp_colonne`. La politique
--  est la même : il écrit SA ligne, et `with check` le tient aussi à
--  l'insertion — sans quoi on pourrait insérer la ligne d'un autre.
--
--  ── `mes_joueurs()` ET PAS `joueur_courant()`, ET C'EST UN DÉFAUT
--     QUE J'AVAIS ÉCRIT ──────────────────────────────────────────────
--
--  Premier jet : `joueur_id = joueur_courant()`. Ça a l'air juste, et
--  ça l'est pour un compte à un personnage.
--
--  SAUF QUE CE FORUM EN AUTORISE PLUSIEURS depuis la 0029. Et
--  `joueur_courant()` est `select j.id from joueur where auth_id = …` :
--  avec deux personnages derrière le même jeton, elle en rend UN —
--  silencieusement, celui que PostgreSQL trouve en premier. Le second
--  personnage n'aurait vu aucun de ses invités, et aurait écrit sous le
--  nom du premier.
--
--  `rp`, `rp_colonne` et `brouillon` utilisent toutes
--  `in (select mes_joueurs())`. Celle-ci aussi. La 0029 a créé cette
--  fonction exactement pour ça, et son commentaire le dit : « tous les
--  personnages derrière le jeton courant ».
drop policy if exists rp_invite_ajout on rp_invite;
create policy rp_invite_ajout on rp_invite for insert to authenticated
  with check (joueur_id in (select mes_joueurs()));

drop policy if exists rp_invite_retrait on rp_invite;
create policy rp_invite_retrait on rp_invite for delete to authenticated
  using (joueur_id in (select mes_joueurs()));

--  ── ET LES DROITS DE COLONNE, QU'ON N'OUBLIE PAS ──────────────────
--
--  `grant select, insert, update, delete on rp_colonne` est déjà
--  accordé depuis la 0059 et couvre la table entière, donc `montree`
--  avec. Rien à ajouter là — mais il fallait le vérifier plutôt que le
--  supposer : un `grant` par colonne aurait laissé `montree` muette, et
--  le symptôme aurait été une case qui se décoche toute seule au
--  rechargement.
grant select, insert, delete on rp_invite to authenticated;

comment on table rp_invite is
  'Les gens qu''un joueur ATTEND dans un de ses RP, tapés à la main '
  'parce qu''ils n''ont pas encore posté. Pas `rp_participant` : '
  'celle-là dit qui a posté, un fait du forum vrai pour tout le monde. '
  'Ici c''est une annotation, la mienne, et elle peut être fausse — la '
  'personne peut ne jamais venir (0066).';
