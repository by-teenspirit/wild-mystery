-- ════════════════════════════════════════════════════════════════════
--  0059 · Ce que chacun écrit sur ses RP
--
--  Trois choses, et la première n'a rien à voir avec les deux autres :
--  elle répare un silence.
--
--  ── 1 · LA RELÈVE N'ÉCRASE PLUS UN COMPTE PAR UN ZÉRO INVENTÉ ───────
--
--  `nombre()` de `recherche.ts` rendait `0` quand il ne trouvait pas son
--  `<dd class="posts">`. Un zéro inventé est indiscernable d'un vrai
--  zéro : un sujet sans réponse en a vraiment zéro, un gabarit qui
--  change de classe en rendait zéro aussi — et la relève remplaçait
--  alors un compte juste par un faux, sans que rien ne le dise.
--
--  Le parseur rend maintenant `null`. Ici, `null` veut dire « garde ce
--  que tu avais » : une page illisible ne doit rien détruire.
--
--  ── 2 · CHACUN NOMME SES COLONNES ───────────────────────────────────
--
--  « L'idée était de changer le nom de la colonne, que chacun puisse la
--  personnaliser. C'est possible ? » — 20 novembre.
--
--  Oui, parce que c'est l'ÉTIQUETTE qui change et pas la clé. `etat`
--  garde ses cinq mots, la contrainte de la 0058 tient, et le tri ne
--  bouge pas. Ce qui change, c'est ce qui s'écrit en haut de la
--  colonne — et ça ne regarde que la personne qui l'a écrit.
--
--  UNE TABLE À PART, ET PAS UNE COLONNE SUR `joueur` : il y a cinq
--  noms, il y en aura six le jour où une colonne s'ajoute, et un objet
--  JSON dans une colonne se serait retrouvé à porter autre chose.
--
--  ── 3 · UNE DESCRIPTION SUR CHAQUE CARTE ────────────────────────────
--
--  « Dans chaque card, pouvoir l'afficher en grand et mettre une
--  description. »
--
--  Elle est à la personne, pas au forum : la relève ne la touche pas,
--  exactement comme `etat` et `ordre`. C'est la troisième colonne de
--  cette table dont le contrat dit « la relève décrit le forum, la
--  personne décrit ce qu'elle en pense ».
-- ════════════════════════════════════════════════════════════════════

-- ── 1 · le compte qui manque ne détruit rien ───────────────────────

create or replace function relever_les_rp(p jsonb) returns jsonb as $$
declare
  v_joueur  uuid := (p ->> 'joueurId')::uuid;
  v_sujets  jsonb := coalesce(p -> 'sujets', '[]'::jsonb);
  v_vus     integer[];
  v_ecrits  integer := 0;
  v_effaces integer := 0;
begin
  if v_joueur is null then
    raise exception 'JOUEUR_MANQUANT';
  end if;

  select coalesce(array_agg((s ->> 'sujetId')::integer), array[]::integer[])
    into v_vus
    from jsonb_array_elements(v_sujets) as s;

  insert into rp (joueur_id, sujet_id, titre, forum_id, forum_nom, reponses,
                  dernier_le, dernier_auteur, dernier_message, extrait, releve_le)
  select v_joueur,
         (s ->> 'sujetId')::integer,
         coalesce(s ->> 'titre', ''),
         coalesce((s ->> 'forumId')::integer, 0),
         coalesce(s ->> 'forumNom', ''),
         --  À L'INSERTION, UN COMPTE ABSENT VAUT ZÉRO : la ligne n'a
         --  rien à garder, elle n'existait pas.
         coalesce((s ->> 'reponses')::integer, 0),
         nullif(s ->> 'dernierLe', '')::timestamptz,
         coalesce(s ->> 'dernierAuteur', ''),
         nullif(s ->> 'dernierMessage', '')::integer,
         left(coalesce(s ->> 'extrait', ''), 200),
         now()
    from jsonb_array_elements(v_sujets) as s
  on conflict (joueur_id, sujet_id) do update
    set titre           = excluded.titre,
        forum_id        = excluded.forum_id,
        forum_nom       = excluded.forum_nom,
        --  ── `reponses` N'EST PLUS DANS CETTE LISTE ────────────────
        --
        --  PREMIER JET FAUX, ET IL FAUT LE DIRE : j'avais écrit
        --  `coalesce(excluded.reponses, rp.reponses)`. Ça ne pouvait
        --  pas marcher — `excluded` porte ce que l'INSERT a calculé,
        --  et l'insertion remplace déjà le `null` par zéro trois
        --  lignes plus haut. Le `coalesce` ne voyait donc jamais de
        --  `null` et gardait toujours le zéro.
        --
        --  Le compte se pose dans une seconde instruction, qui ne
        --  touche QUE les lignes dont la page a vraiment donné le
        --  nombre. Voir juste après le `get diagnostics`.
        dernier_le      = excluded.dernier_le,
        dernier_auteur  = excluded.dernier_auteur,
        dernier_message = excluded.dernier_message,
        extrait         = case when excluded.extrait = '' then rp.extrait
                               else excluded.extrait end,
        releve_le       = excluded.releve_le;
        --  `etat`, `ordre` ET `description` NE SONT PAS DANS CETTE
        --  LISTE, et c'est tout le contrat de la table. La relève
        --  décrit le forum ; « en pause », « clôturé » et ce qu'on
        --  écrit sur un RP sont ce que la personne en dit.
  get diagnostics v_ecrits = row_count;

  --  ── LE COMPTE, SEULEMENT QUAND LA PAGE L'A DONNÉ ────────────────
  --
  --  `s ->> 'reponses'` rend NULL quand la clé manque ou qu'elle porte
  --  `null`. Les deux veulent dire la même chose : la page de recherche
  --  n'a pas livré le nombre. La ligne garde alors ce qu'elle avait —
  --  un compte juste relevé hier vaut mieux qu'un zéro d'aujourd'hui.
  update rp r
     set reponses = (s ->> 'reponses')::integer
    from jsonb_array_elements(v_sujets) as s
   where r.joueur_id = v_joueur
     and r.sujet_id = (s ->> 'sujetId')::integer
     and (s ->> 'reponses') is not null;

  delete from rp
   where joueur_id = v_joueur
     and etat = 'en-cours'
     and not (sujet_id = any (v_vus));
  get diagnostics v_effaces = row_count;

  insert into rp_participant (sujet_id, forum_user_id, pseudo, vu_le)
  select (s ->> 'sujetId')::integer,
         (m ->> 'id')::integer,
         coalesce(m ->> 'pseudo', ''),
         now()
    from jsonb_array_elements(v_sujets) as s,
         jsonb_array_elements(coalesce(s -> 'participants', '[]'::jsonb)) as m
   where (m ->> 'id') ~ '^\d+$'
  on conflict (sujet_id, forum_user_id) do update
    set pseudo = case when excluded.pseudo = '' then rp_participant.pseudo
                      else excluded.pseudo end,
        vu_le  = excluded.vu_le;

  return jsonb_build_object('ecrits', v_ecrits, 'effaces', v_effaces);
end $$ language plpgsql security definer set search_path = public, pg_temp;

-- ── 2 · la description, à la personne ──────────────────────────────

alter table rp add column if not exists description text not null default '';

--  BORNÉE, comme l'extrait : un champ de texte sans borne finit par
--  porter un RP entier, et la carte ne sait pas l'afficher.
alter table rp drop constraint if exists rp_description_bornee;
alter table rp add constraint rp_description_bornee
  check (length(description) <= 600);

comment on column rp.description is
  'Ce que la PERSONNE écrit sur son RP — un pense-bête, où on en est, '
  'ce qui doit arriver. La relève n''y touche pas (0059).';

-- ── 3 · les noms de colonnes, à la personne aussi ──────────────────

create table if not exists rp_colonne (
  joueur_id uuid not null references joueur(id) on delete cascade,
  --  LA CLÉ DE L'ÉTAT, telle que `rp.etat` l'écrit. Même contrainte :
  --  un nom pour une colonne qui n'existe pas ne s'afficherait nulle
  --  part et resterait à traîner.
  etat      text not null check (etat in ('en-cours', 'prevu', 'en-pause', 'cloture', 'solo')),
  nom       text not null check (length(nom) between 1 and 24),
  primary key (joueur_id, etat)
);

comment on table rp_colonne is
  'Le nom que CHACUN donne à ses colonnes. L''étiquette change, la clé '
  'ne bouge pas : `etat` garde ses cinq mots, le tri et la contrainte '
  'de la 0058 tiennent. Une colonne sans ligne ici porte son nom par '
  'défaut (0059).';

alter table rp_colonne enable row level security;

drop policy if exists rp_colonne_lecture on rp_colonne;
create policy rp_colonne_lecture on rp_colonne for select to authenticated
  using (joueur_id in (select mes_joueurs()));

drop policy if exists rp_colonne_ecriture on rp_colonne;
create policy rp_colonne_ecriture on rp_colonne for insert to authenticated
  with check (joueur_id in (select mes_joueurs()));

drop policy if exists rp_colonne_maj on rp_colonne;
create policy rp_colonne_maj on rp_colonne for update to authenticated
  using (joueur_id in (select mes_joueurs()))
  with check (joueur_id in (select mes_joueurs()));

drop policy if exists rp_colonne_effacement on rp_colonne;
create policy rp_colonne_effacement on rp_colonne for delete to authenticated
  using (joueur_id in (select mes_joueurs()));

grant select, insert, update, delete on rp_colonne to authenticated;

--  ET LA DESCRIPTION S'AJOUTE AUX DEUX COLONNES QU'ON POUVAIT ÉCRIRE.
--  Le `grant` est RÉÉCRIT EN ENTIER et pas complété : un `grant` ne
--  retire rien, donc énumérer les trois est la seule façon de lire,
--  dans cette ligne, tout ce que le joueur peut écrire.
revoke update on rp from authenticated;
grant update (etat, ordre, description) on rp to authenticated;
grant insert (joueur_id, sujet_id, titre, etat, ordre, description) on rp to authenticated;
