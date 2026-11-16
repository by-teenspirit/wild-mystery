-- ════════════════════════════════════════════════════════════════════
--  0041 · Valider enregistre l'adresse
--
--  ── DEUX MIGRATIONS QUI NE SE SONT JAMAIS PARLÉ ────────────────────
--
--  La 0028 (3 novembre) a réuni les deux gestes du staff en un seul :
--  `valider_le_personnage` crée la ligne du joueur et rend la clé à
--  coller. Elle écrit `forum_user_id`, `pseudo`, `groupe`.
--
--  La 0029 (plus tard) a ajouté `joueur.courriel` et en a fait LA SEULE
--  CHOSE QUI AUTORISE UNE LIAISON — son propre commentaire le dit :
--  « le joueur ne prouve rien côté forum, il prouve qu'il relève cette
--  boîte ».
--
--  Personne n'est allé rebrancher la première sur la seconde. Valider
--  créait donc une ligne SANS adresse, et `lier_mon_personnage`
--  cherchait `where lower(courriel) = …` dans une colonne vide. Zéro
--  ligne, zéro rattachement, et la page annonçait au joueur qu'il
--  n'était pas validé — alors qu'il l'était.
--
--  Trouvé le 16 novembre par une joueuse qui a essayé deux adresses,
--  soupçonné ses alias `mail+perso@`, fouillé ses spams et conclu « il
--  doit me manquer une étape ». Elle n'en avait aucune ; c'est la
--  fonction qui en sautait une.
--
--  ── L'ADRESSE N'EST PAS OBLIGATOIRE, ET C'EST VOULU ────────────────
--
--  Valider sans adresse reste permis : on corrige un pseudo, on change
--  une maison, on revalide. Exiger l'adresse à chaque fois forcerait à
--  la retaper pour un geste qui n'a rien à voir, et on la retaperait
--  de travers.
--
--  Mais une adresse DONNÉE est écrite, et une adresse ABSENTE n'efface
--  jamais celle qui est là. `coalesce(nullif(…, ''), courriel)` : la
--  même prudence que `pseudo` deux lignes plus haut, pour la même
--  raison.
--
--  ── ET LA RÉPONSE DIT SI LA LIAISON POURRA SE FAIRE ────────────────
--
--  `peutSeLier` est rendu pour que le staff le voie au moment où il
--  valide, et pas trois jours plus tard dans un message de joueuse
--  bloquée. Valider en voyant « peutSeLier: false » est un choix ;
--  valider sans le savoir était un piège.
-- ════════════════════════════════════════════════════════════════════

create or replace function valider_le_personnage(p jsonb)
returns jsonb as $$
declare
  v_forum    integer := (p->>'forumUserId')::integer;
  v_pseudo   text    := p->>'pseudo';
  v_groupe   text    := lower(p->>'groupe');
  --  MINUSCULES ET SANS ESPACES, exactement comme le fait
  --  `lier_mon_personnage` sur l'adresse de la session. Deux
  --  normalisations différentes des deux côtés d'une comparaison, et
  --  la comparaison ne vaut rien.
  v_courriel text    := lower(trim(p->>'courriel'));
  v_id       uuid;
  v_neuf     boolean := false;
  v_cle      text;
  v_a_adresse boolean;
begin
  if v_forum is null then
    raise exception 'FORUM_USER_ID_MANQUANT';
  end if;
  --  LA MAISON EST VÉRIFIÉE ICI AUSSI, et pas seulement par la
  --  contrainte : le message « GROUPE_INCONNU » dit quoi corriger,
  --  là où une violation de contrainte oblige à aller lire le schéma.
  if v_groupe is null or
     v_groupe not in ('hardi', 'serieux', 'malin', 'doux', 'brave', 'jovial') then
    raise exception 'GROUPE_INCONNU';
  end if;

  update joueur
     set groupe   = v_groupe,
         pseudo   = coalesce(nullif(v_pseudo, ''), pseudo),
         courriel = coalesce(nullif(v_courriel, ''), courriel)
   where forum_user_id = v_forum
   returning id into v_id;

  if v_id is null then
    if v_pseudo is null or v_pseudo = '' then
      raise exception 'PSEUDO_MANQUANT';
    end if;
    insert into joueur (forum_user_id, pseudo, groupe, courriel)
    values (v_forum, v_pseudo, v_groupe, nullif(v_courriel, ''))
    returning id into v_id;
    v_neuf := true;
  end if;

  --  LA CLÉ, POSÉE SEULEMENT SI ELLE MANQUE. `coalesce` ne suffirait
  --  pas : il faut ÉCRIRE celle qu'on vient de tirer, et ne rien
  --  écrire quand il y en a déjà une.
  select cle_de_carnet, courriel is not null and courriel <> ''
    into v_cle, v_a_adresse
    from joueur where id = v_id;
  if v_cle is null then
    v_cle := encode(gen_random_bytes(16), 'hex');
    update joueur set cle_de_carnet = v_cle where id = v_id;
  end if;

  return jsonb_build_object(
    'joueurId', v_id,
    'creee',    v_neuf,
    'groupe',   v_groupe,
    --  CE QU'IL FAUT COLLER dans « clé de liaison », côté profil du
    --  membre. C'est le seul endroit d'où elle sort.
    'cle',      v_cle,
    --  ET CE QU'IL FAUT SAVOIR TOUT DE SUITE : sans adresse, ce
    --  personnage ne pourra pas ouvrir son carnet, quoi qu'il tente.
    'peutSeLier', v_a_adresse
  );
end $$ language plpgsql security definer set search_path = public, extensions;

revoke all on function valider_le_personnage(jsonb) from public;
revoke all on function valider_le_personnage(jsonb) from anon, authenticated;
grant execute on function valider_le_personnage(jsonb) to service_role;

comment on function valider_le_personnage(jsonb) is
  'Crée ou met à jour un personnage, enregistre l''adresse que le staff '
  'certifie, et rend la clé à coller dans son profil. Rejouable : la clé '
  'n''est refaite que si elle manque, et une adresse absente n''efface '
  'jamais celle qui est là. « peutSeLier » dit si la liaison pourra '
  'aboutir — sans adresse, elle ne le peut pas.';

-- ── LES PERSONNAGES DÉJÀ VALIDÉS SANS ADRESSE ──────────────────────
--
--  On ne peut pas les réparer ici : l'adresse n'est écrite nulle part
--  dans la base, c'est le staff qui la connaît. La vue les nomme, pour
--  qu'on sache qui est bloqué sans attendre qu'il écrive.

create or replace view joueur_sans_adresse as
  select forum_user_id, pseudo, groupe, cree_le
    from joueur
   where courriel is null or trim(courriel) = ''
   order by cree_le;

revoke all on joueur_sans_adresse from public;
revoke all on joueur_sans_adresse from anon, authenticated;
grant select on joueur_sans_adresse to service_role;

comment on view joueur_sans_adresse is
  'Les personnages qui ne pourront pas ouvrir leur carnet, faute '
  'd''adresse certifiée. Réservée au staff : elle nomme des joueurs.';
