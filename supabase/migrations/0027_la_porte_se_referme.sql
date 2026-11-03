-- ════════════════════════════════════════════════════════════════════
--  0027 · La porte se referme
--
--  « La clé n'est pas censée être visible, l'admin la met au tout
--  début, et une fois mise, quand le joueur est validé, ça
--  fonctionne », 3 novembre.
--
--  ── CE QU'ON REND ───────────────────────────────────────────────────
--
--  La migration 0026, huit heures plus tôt, a ouvert `carnet_du_compte`
--  à `anon` et l'a payé d'un prix écrit en entier dans son en-tête :
--  qui appelle avec un numéro de compte obtient le carnet qui va avec,
--  et ce numéro est public. C'était la seule façon d'ouvrir le carnet
--  sans que la joueuse ait un geste à faire.
--
--  Il y en avait une meilleure, et c'est Callista qui l'a nommée : la
--  clé vit dans un champ de profil que le staff remplit, et la page va
--  la chercher. Le champ n'est affiché nulle part, et la page où il se
--  lit — `/profile?mode=editprofile` — ne se charge qu'avec la session
--  de son propriétaire : il n'y a aucun paramètre pour demander le
--  profil d'un autre. La clé redevient donc une preuve, sans un geste
--  de plus pour personne.
--
--  `carnet_du_compte` perd alors sa raison d'être ouverte. On la
--  révoque. Elle reste là, appelable par la relève, parce qu'elle sert
--  à lire le carnet d'un joueur par son numéro quand c'est le serveur
--  qui demande — et c'est à ça qu'elle aurait dû servir dès le début.
--
--  ── POURQUOI ON NE LA SUPPRIME PAS ──────────────────────────────────
--
--  Parce que `carnet(cle)` et elle ne sont pas interchangeables : l'une
--  prend un secret, l'autre un numéro. La relève n'a pas les clés des
--  joueurs et n'a pas à les avoir ; quand elle devra lire un carnet,
--  c'est par le numéro. La supprimer obligerait à la réécrire.
--
--  ── CE QUI RESTE À SURVEILLER ───────────────────────────────────────
--
--  Le compteur de surface du contrat redescend à quatre fonctions
--  `security definer` ouvertes à `anon`. Il a sauté deux fois en deux
--  jours — en ouvrant celle-ci, puis en la refermant. C'est exactement
--  ce qu'on lui demande.
-- ════════════════════════════════════════════════════════════════════

revoke execute on function carnet_du_compte(jsonb) from anon, authenticated;
grant execute on function carnet_du_compte(jsonb) to service_role;

comment on function carnet_du_compte(jsonb) is
  'Le carnet d''un membre, par son numéro de compte forum. Pour le '
  'SERVEUR : elle ne vérifie rien, et `anon` ne peut plus l''appeler '
  'depuis 0027. Une page de joueur passe par carnet(cle).';
