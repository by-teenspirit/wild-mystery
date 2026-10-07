-- ═══════════════════════════════════════════════════════════════════════
--  0009_fuseau_du_joueur.sql
--
--  Jour ou nuit se décide à l'heure du joueur — décision du 2 octobre.
--
--  LE PIÈGE QU'ON ÉVITE. Si c'est le navigateur qui annonce l'heure, le
--  joueur choisit sa table de rencontres en changeant l'horloge de sa
--  machine. Deux clics pour passer en nocturne, et les espèces de nuit
--  deviennent accessibles à midi.
--
--  LA CORRECTION ne change rien à l'intention : **le fuseau est une
--  propriété enregistrée du joueur, pas une valeur envoyée à chaque
--  action.** Le serveur garde son horloge UTC et en déduit l'heure locale.
--  Le joueur reste chez lui, à son heure ; il ne la décide simplement plus
--  coup par coup.
--
--  QUI L'ÉCRIT. Le staff, à la validation de la fiche, en même temps que
--  le groupe et la liaison de compte (33-le-carnet-de-bord §2). Pas de
--  fonction en libre-service : un fuseau qu'on change soi-même à volonté
--  ramènerait exactement le problème qu'on vient de fermer. Un
--  déménagement se signale, ça n'arrive pas deux fois par semaine.
--
--  POURQUOI `text` ET PAS UN DÉCALAGE EN HEURES. Un décalage ne connaît
--  pas l'heure d'été : un joueur parisien serait à la bonne heure six mois
--  par an. Un nom de fuseau IANA, lui, est juste toute l'année, et
--  PostgreSQL sait le lire.
-- ═══════════════════════════════════════════════════════════════════════

alter table joueur
  add column if not exists fuseau text not null default 'Europe/Paris';

comment on column joueur.fuseau is
  'Nom de fuseau IANA, par exemple « Europe/Paris ». Sert à décider jour ou '
  'nuit pour ce joueur. Écrit par le staff, jamais envoyé par le navigateur : '
  'sinon le joueur choisirait sa table de rencontres en changeant son horloge.';

--  Un nom de fuseau que PostgreSQL ne connaît pas ferait tomber le calcul
--  au moment de la rencontre, c'est-à-dire devant le joueur. Mieux vaut le
--  refuser à l'écriture. Un déclencheur, et pas une contrainte CHECK :
--  `pg_timezone_names` n'est pas immuable, une contrainte ne peut pas s'en
--  servir.
create or replace function joueur_fuseau_valide() returns trigger as $$
begin
  if not exists (select 1 from pg_timezone_names where name = new.fuseau) then
    raise exception 'Fuseau inconnu : « % ». Attendu un nom IANA, par exemple Europe/Paris.',
      new.fuseau;
  end if;
  return new;
end $$ language plpgsql;

drop trigger if exists joueur_fuseau_valide on joueur;
create trigger joueur_fuseau_valide
  before insert or update of fuseau on joueur
  for each row execute function joueur_fuseau_valide();

--  L'heure locale d'un joueur, pour le serveur. `security definer` parce
--  qu'elle lit `joueur`, qui est sous RLS — même raison que
--  `joueur_courant()` dans 0007, et mêmes précautions : search_path
--  épinglé, et elle ne rend qu'un entier de 0 à 23.
create or replace function heure_locale_du_joueur(p jsonb) returns integer as $$
  select extract(hour from (now() at time zone j.fuseau))::integer
    from joueur j
   where j.id = (p->>'joueurId')::uuid
$$ language sql stable security definer set search_path = public, pg_temp;

--  Elle n'est appelée que par la relève, avec la clé de service. 0008 a
--  fermé l'exécution à PUBLIC ; on redit ici qui a le droit, parce que la
--  fonction est créée APRÈS ce `revoke` et n'en hérite pas.
revoke execute on function heure_locale_du_joueur(jsonb) from public;
revoke execute on function joueur_fuseau_valide() from public;
grant execute on function heure_locale_du_joueur(jsonb) to service_role;
