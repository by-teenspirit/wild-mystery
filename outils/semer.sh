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

if [ -z "${DATABASE_URL:-}" ]; then
  cat >&2 <<'AIDE'
DATABASE_URL n'est pas posée, et sans elle psql cherche une base locale
qui n'existe pas — c'est le « database "…" does not exist » qui ne parle
de rien.

Où la prendre : Supabase → le projet → Connect → Session pooler. Puis,
dans le terminal où tu lances ce script :

    export DATABASE_URL='postgresql://postgres.<ref>:<motdepasse>@…pooler.supabase.com:5432/postgres'

Elle ne vaut que pour ce terminal, et c'est voulu : un mot de passe
écrit dans un fichier du dépôt est un mot de passe publié.
AIDE
  exit 1
fi

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
  if sortie=$(psql "$DATABASE_URL" -q -v ON_ERROR_STOP=1 -f "$fichier" 2>&1); then
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
  · « password authentication failed » → le mot de passe, ou un
    caractère spécial à encoder dans l'adresse.
  · « Tenant or user not found »       → l'utilisateur doit être
    postgres.<ref>, pas postgres seul (c'est le pooler).
  · « relation … does not exist » ou « column … does not exist »
                                       → « supabase db push » d'abord.
OU
  exit 1
fi

echo "Les seeds sont passés."
