-- ════════════════════════════════════════════════════════════════════
--  0058 · La colonne « solo », et les compagnons qu'on ne pouvait pas
--         lire
--
--  Deux manques relevés par Callista le 20 novembre, sur la page
--  « Mes RP ».
--
--  ── 1 · UN RP SOLO N'ATTEND PERSONNE ────────────────────────────────
--
--  « Dans le carnet de bord de Jake, j'ai mis le rp "test". Apparemment,
--  y'a 0 réponses dedans alors que c'est un rp solo. »
--
--  L'étiquette d'un RP se calcule depuis `dernier_auteur` : si le
--  dernier message est d'un autre, c'est « à l'autre » ; si personne
--  n'a écrit, c'est « personne n'a écrit ». Les deux sont faux pour un
--  solo, où l'on est seul à tenir la plume et où attendre une réponse
--  n'a pas de sens.
--
--  CE N'EST PAS UNE DÉTECTION, C'EST UNE DÉCLARATION. On aurait pu
--  deviner le solo en comptant les participants — sauf que le jeu
--  lui-même poste dans les sujets de zone sauvage : le sujet « test »
--  a onze messages, dont un d'Arceus. Compter les participants aurait
--  rangé tous les sujets de fouille hors du solo. C'est donc la
--  personne qui pose la carte dans cette colonne, comme elle le fait
--  déjà pour « en pause ».
--
--  ── 2 · AVEC QUI J'ÉCRIS ────────────────────────────────────────────
--
--  « On doit pouvoir voir les personnes avec qui on fait le rp. »
--
--  La table existe depuis la `0036` et la relève la remplit à chaque
--  passage. Mais elle a `enable row level security` et AUCUNE politique
--  de lecture : sous RLS, pas de politique veut dire pas une ligne.
--  Elle était donc écrite par la relève et lisible par personne.
--
--  LA PORTÉE EST CELLE DE SES PROPRES RP, et rien de plus : on lit les
--  participants d'un sujet qui est dans SON tableau. Pas de liste des
--  compagnons des autres, et pas de moyen de sonder un sujet où l'on
--  n'écrit pas.
-- ════════════════════════════════════════════════════════════════════

-- ── 1 · le cinquième mot ───────────────────────────────────────────

--  LES MOTS DE L'ÉCRAN, ET PAS UN DE PLUS — la règle de la 0037 tient,
--  la liste gagne juste un terme.
alter table rp drop constraint if exists rp_etat_connu;
alter table rp add constraint rp_etat_connu
  check (etat in ('en-cours', 'prevu', 'en-pause', 'cloture', 'solo'));

comment on column rp.etat is
  'Ce que le JOUEUR dit de son RP : en-cours, prevu, en-pause, '
  'cloture, solo. « À toi » et « à moi » n''y sont pas — ils se '
  'calculent depuis `dernier_auteur`, et deux sources pour une même '
  'vérité en font toujours une fausse (0037). « solo » se déclare et '
  'ne se devine pas : le jeu poste lui-même dans les sujets de zone '
  'sauvage, donc compter les participants dirait faux (0058).';

-- ── 2 · lire les participants de ses propres RP ────────────────────

drop policy if exists rp_participant_lecture on rp_participant;
create policy rp_participant_lecture on rp_participant for select to authenticated
  using (
    exists (
      select 1 from rp
       where rp.sujet_id = rp_participant.sujet_id
         and rp.joueur_id in (select mes_joueurs())
    )
  );

grant select on rp_participant to authenticated;

comment on policy rp_participant_lecture on rp_participant is
  'On voit les compagnons d''un sujet qui est dans SON tableau. La '
  'table était remplie par la relève depuis la 0036 et lisible par '
  'personne : RLS active sans politique de lecture ne rend aucune '
  'ligne (0058).';
