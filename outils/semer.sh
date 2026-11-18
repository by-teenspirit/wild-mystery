#!/usr/bin/env bash
# ════════════════════════════════════════════════════════════════════
#  outils/semer.sh
#
#  APPLIQUE LES QUATRE SEEDS, DANS L'ORDRE QU'ILS EXIGENT.
#
#  ── POURQUOI CE SCRIPT EXISTE ──────────────────────────────────────
#
#  17 novembre, après la 0045 :
#
#      psql "$DATABASE_URL" -f supabase/seeds/especes.sql
#      psql: error: connection to server on socket
#            "/tmp/.s.PGSQL.5432" failed: FATAL: database
#            "callistalore" does not exist
#
#  La variable était vide, donc `psql` est retombé sur la socket
#  locale et a cherché une base au nom de l'utilisateur. Le message ne
#  parle ni de Supabase ni de la variable : il parle d'une base locale
#  qu'on n'a jamais eue. C'est le genre d'erreur où on cherche du
#  mauvais côté pendant dix minutes.
#
#  Mais le vrai manque est derrière. QUATRE SEEDS, UN ORDRE, ET RIEN
#  QUI LES APPLIQUE. L'ordre est écrit — dans les commentaires de
#  chaque fichier, c'est-à-dire à quatre endroits, c'est-à-dire nulle
#  part. `espece_capacite` a une clé étrangère vers `espece`, et
#  `fossile_espece` aussi : les appliquer dans le désordre échoue à la
#  première ligne, et on ne sait pas pourquoi avant d'avoir lu les
#  quatre en-têtes.
#
#  ── CE QUE LE SCRIPT NE FAIT PAS ───────────────────────────────────
#
#  Il ne contient aucun mot de passe, il n'en lit aucun, il n'en écrit
#  aucun. L'adresse vient de l'environnement et n'est jamais affichée
#  en entier — un `-f` dans un historique de terminal est déjà de
#  trop.
#
#  Il ne monte pas les migrations non plus : c'est `supabase db push`,
#  et les colonnes doivent exister AVANT que le seed les remplisse.
#
#  Usage :
#      export DATABASE_URL='…'      # Dashboard → Connect → Session pooler
#      bash outils/semer.sh
#      bash outils/semer.sh especes capacites    # un sous-ensemble
# ════════════════════════════════════════════════════════════════════
set -uo pipefail
cd "$(dirname "$0")/.."

#  L'ORDRE, ET IL N'EST PAS ALPHABÉTIQUE.
#
#  1 · objets    — le catalogue ; `sac` et `fossile_espece` y pointent.
#  2 · especes   — les 955 ; `pokemon`, `pokedex`, `zone_espece`,
#                  `fossile_espece` et `espece_capacite` y pointent.
#                  Tant qu'elle est vide, aucune capture ne s'écrit,
#                  donc aucune clôture n'aboutit.
#  3 · fossiles  — besoin des deux premiers.
#  4 · capacites — besoin des espèces.
ORDRE=(objets especes fossiles capacites)

#  DEUX FAÇONS DE DIRE OÙ EST LA BASE, ET LA SECONDE EST LA BONNE.
#
#  L'URL d'un coup — `DATABASE_URL` — est ce que le Dashboard donne, et
#  c'est un piège qu'on a payé deux fois le 17 novembre :
#
#      psql: error: could not translate host name  to address
#
#  L'hôte est VIDE. Un seul `/` dans le mot de passe suffit : libpq lit
#  `postgresql://u:ab/cd@hote/postgres` comme une autorité `u:ab` suivie
#  d'un chemin, et l'hôte disparaît. Pareil pour `@`, `#`, `?`. Le
#  message ne parle ni du mot de passe ni d'encodage — il parle d'un nom
#  d'hôte qu'on croit avoir écrit.
#
#  Les variables séparées n'ont pas ce problème : `PGPASSWORD` est une
#  valeur, pas un morceau d'URL, et le mot de passe y passe TEL QUEL,
#  caractères spéciaux compris. Rien à encoder, rien à deviner.
#
#  Et il n'a pas à traîner dans l'historique du terminal : sans
#  `PGPASSWORD`, psql le demande lui-même, une fois par seed.
if [ -z "${DATABASE_URL:-}" ] && [ -z "${PGHOST:-}" ]; then
  cat >&2 <<'AIDE'
Il manque l'adresse de la base. Sans elle, psql cherche une base locale
qui n'existe pas — c'est le « database "…" does not exist » qui ne parle
de rien.

LE CHEMIN SANS PIÈGE — les paramètres séparés. Rien à encoder, même si
le mot de passe contient / @ # ? ou une espace :

    export PGHOST=aws-0-eu-west-1.pooler.supabase.com
    export PGPORT=5432
    export PGUSER=postgres.<ref>
    export PGDATABASE=postgres

Hôte, port et utilisateur viennent de Supabase → Connect → Direct →
Session pooler. Aucun des quatre ne contient de caractère spécial, donc
rien à encoder et rien à protéger.

LE MOT DE PASSE, LE SCRIPT LE DEMANDE LUI-MÊME. Tu n'as pas à le poser
dans ton terminal : il ne passe donc ni par l'historique, ni par une
URL, ni par un fichier.

L'AUTRE CHEMIN — l'URL d'un coup, si le mot de passe n'a aucun
caractère spécial :

    export DATABASE_URL='postgresql://postgres.<ref>:<motdepasse>@…pooler.supabase.com:5432/postgres'
AIDE
  exit 1
fi

#  LE MOT DE PASSE SE DEMANDE ICI, ET C'EST VOULU.
#
#  L'aide disait d'abord de le poser dans le terminal avec
#  `read -rs -p …`. Sur macOS le terminal est en ZSH, et zsh répond :
#
#      read: -p: no coprocess
#
#  `-p` veut dire « invite » en bash et « depuis un coprocessus » en
#  zsh. L'aide d'un script ne doit rien supposer du shell de celui qui
#  la lit — alors que LE SCRIPT, LUI, tourne sous bash puisqu'on
#  l'appelle par `bash outils/semer.sh`. L'invite appartient donc ici.
#
#  Et c'est mieux de toute façon : le mot de passe ne traverse ni
#  l'historique du terminal, ni une URL, ni un fichier. Il reste dans
#  l'environnement de ce seul processus, le temps des quatre seeds.
if [ -z "${DATABASE_URL:-}" ] && [ -z "${PGPASSWORD:-}" ]; then
  if [ -t 0 ]; then
    read -rsp "mot de passe de la base : " PGPASSWORD
    echo
    export PGPASSWORD
  fi
  #  Pas de terminal — un CI, un cron : on ne demande rien et on
  #  laisse psql échouer avec son propre message. Un script qui attend
  #  une saisie que personne ne fera est un script qui a l'air de
  #  tourner.
fi

#  L'URL si elle est là, sinon rien : psql lit alors les PG* tout seul.
#  Un tableau et pas une chaîne — `psql ""` chercherait une base dont le
#  nom est vide.
cible=()
[ -n "${DATABASE_URL:-}" ] && cible=("$DATABASE_URL")

demandes=("$@")
[ ${#demandes[@]} -eq 0 ] && demandes=("${ORDRE[@]}")

fautes=0
for nom in "${ORDRE[@]}"; do
  #  On parcourt TOUJOURS dans l'ordre, même quand on n'en demande que
  #  deux : « semer.sh capacites especes » doit semer les espèces
  #  d'abord, pas obéir à l'ordre des arguments.
  voulu=0
  for d in "${demandes[@]}"; do [ "$d" = "$nom" ] && voulu=1; done
  [ $voulu -eq 1 ] || continue

  fichier="supabase/seeds/$nom.sql"
  if [ ! -f "$fichier" ]; then
    echo "::error::$fichier manque"
    fautes=$((fautes + 1))
    continue
  fi

  printf '══ %s ' "$nom"
  #  ON MONTRE TOUT CE QUE PSQL A DIT, et c'est une correction du
  #  17 novembre au soir.
  #
  #  La première version filtrait sur `grep -i "error"` pour ne garder
  #  que la ligne utile. Elle a rendu « ══ objets REFUSÉ » et RIEN
  #  D'AUTRE : un psql en français écrit « psql : erreur : », pas
  #  « error ». Le filtre ratait la seule ligne qui disait quoi faire,
  #  et on s'est retrouvé à deviner.
  #
  #  `ON_ERROR_STOP` s'arrête à la première faute, donc la sortie est
  #  courte de toute façon. UN OUTIL QUI CACHE LE MESSAGE D'ERREUR
  #  COÛTE PLUS CHER QU'UN OUTIL QUI EN AFFICHE TROP.
  if sortie=$(psql "${cible[@]+${cible[@]}}" -q -v ON_ERROR_STOP=1 -f "$fichier" 2>&1); then
    echo "semé"
  else
    echo "REFUSÉ"
    #  Sans l'adresse : elle porte le mot de passe, et un terminal se
    #  recopie dans une conversation sans y penser.
    printf '%s\n' "$sortie" | sed -e 's#postgres\(ql\)*://[^[:space:]]*#[adresse masquée]#g' >&2
    fautes=$((fautes + 1))
  fi
done

if [ $fautes -ne 0 ]; then
  #  LE CONSEIL SUIT LE MESSAGE, il ne le remplace pas. La première
  #  version disait « les colonnes existent-elles ? » quoi qu'il
  #  arrive — y compris quand psql n'avait même pas réussi à se
  #  connecter. Un conseil qui désigne le mauvais coupable fait
  #  chercher plus longtemps que pas de conseil du tout.
  cat >&2 <<OU

$fautes seed(s) refusé(s). Lis la ligne au-dessus, puis :
  · « password authentication failed » → le mot de passe. S'il
    contient / @ # ? ou une espace, passe par PGHOST/PGPASSWORD
    plutôt que par DATABASE_URL (lance le script sans rien pour
    avoir les lignes à coller).
  · « could not translate host name  to address » (hôte VIDE)
                                       → même cause : un caractère
    spécial a coupé l'URL. Même remède.
  · « Tenant or user not found »       → l'utilisateur doit être
    postgres.<ref>, pas postgres seul (c'est le pooler).
  · « relation … does not exist » ou « column … does not exist »
                                       → « supabase db push » d'abord.
OU
  exit 1
fi

echo "Les seeds sont passés."
