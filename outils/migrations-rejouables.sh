#!/usr/bin/env bash
# ════════════════════════════════════════════════════════════════════
#  outils/migrations-rejouables.sh
#
#  MONTE LES MIGRATIONS DEUX FOIS, puis relance la suite pgTAP.
#
#  ── POURQUOI CE CONTRÔLE EXISTE ────────────────────────────────────
#
#  17 novembre. `supabase db push` s'arrête net :
#
#      ERROR: policy "chacun lit ses fiches" for table "joueur"
#      already exists (SQLSTATE 42710) — At statement: 9
#
#  La table des migrations de la base distante s'arrêtait à la 0015,
#  alors que la base, elle, portait déjà la 0029. La CLI a donc rejoué
#  0016 à 0029, et la 0029 ne se rejoue pas : elle efface l'ANCIENNE
#  politique, celle de la 0001, et crée la nouvelle — au second passage
#  l'ancienne n'existe plus, le `drop` ne fait rien, et le `create`
#  tombe sur la nouvelle qui est déjà là.
#
#  UNE MIGRATION QUI NE SE REJOUE PAS BLOQUE EXACTEMENT QUAND ON EN A
#  BESOIN : quand la table des migrations est en retard sur la base, ce
#  qui est le seul moment où on la rejoue. Six fichiers étaient dans ce
#  cas, et aucun ne le disait.
#
#  ── ET LE REJEU RÉVÈLE AUTRE CHOSE ─────────────────────────────────
#
#  La 0008 révoque `execute on all functions in schema public from
#  anon, authenticated`. Au premier montage elle passe AVANT que les
#  fonctions des migrations suivantes existent — elles gardent donc
#  leur droit par défaut à `public`. Au second, elle les atteint.
#
#  C'est comme ça que `brouillon_encore_vivant` est tombée : sa
#  politique de lecture l'appelle, une politique est évaluée avec les
#  droits de celui qui lit, et son `grant` n'était écrit nulle part.
#  Elle marchait par accident d'ordre. Un droit qui dépend de l'ordre
#  des migrations n'est pas un droit, c'est une coïncidence — et c'est
#  ce rejeu qui l'a montré, pas une relecture.
#
#  ── LES QUATRE EXEMPTÉES, ET POURQUOI ──────────────────────────────
#
#  0001, 0002, 0008 et 0014 ne se rejouent pas : une table sans `if not
#  exists`, une fonction qui change de type de retour, une politique et
#  un type sans garde. Elles sont inscrites comme appliquées dans
#  toutes les bases qui existent, donc jamais rejouées — les réécrire
#  demanderait un `drop function` sur du code vivant pour un gain nul.
#  Elles sont nommées ici, et c'est la seule chose qui les autorise :
#  une cinquième qui tomberait ferait rougir ce script.
#
#  Usage :  PGURL=postgres://… bash outils/migrations-rejouables.sh
#
#  LA BASE DOIT ÊTRE VIERGE, pgTAP installé et rien d'autre. Relancé
#  sur une base déjà montée, le PREMIER passage se comporte comme un
#  rejeu et les quatre exemptées remontent en défaut — ce qui est juste,
#  mais ne mesure plus ce qu'on voulait.
# ════════════════════════════════════════════════════════════════════
set -uo pipefail

: "${PGURL:?PGURL manque — l'adresse de la base d'essai}"
cd "$(dirname "$0")/.."

EXEMPTEES="0001 0002 0008 0014"
fautes=0

monter() {
  local passe="$1"
  for m in supabase/migrations/*.sql; do
    local n
    n="$(basename "$m" | cut -c1-4)"
    if psql "$PGURL" -q -v ON_ERROR_STOP=1 -f "$m" >/tmp/migration.log 2>&1; then
      continue
    fi
    if [ "$passe" = "2" ] && [[ " $EXEMPTEES " == *" $n "* ]]; then
      echo "   (passe 2) $n exemptée, comme prévu"
      continue
    fi
    echo "::error::$(basename "$m") ne se rejoue pas — une migration qui ne se rejoue pas bloque le jour où la table des migrations est en retard sur la base"
    grep -m1 "ERROR" /tmp/migration.log || true
    fautes=$((fautes + 1))
  done
}

echo "══ premier montage"
monter 1
echo "══ second montage, sur une base déjà à jour"
monter 2

echo "══ et la suite tient toujours"
if ! pg_prove --ext .sql -d "$PGURL" supabase/tests/ >/tmp/prove.log 2>&1; then
  #  C'EST ICI QUE LE DROIT PERDU SE VOIT. Un rejeu peut monter sans
  #  une erreur et laisser la base dans un autre état : la suite est la
  #  seule chose qui le dise.
  echo "::error::la suite pgTAP ne passe plus après un second montage"
  tail -20 /tmp/prove.log
  fautes=$((fautes + 1))
fi

if [ "$fautes" -eq 0 ]; then
  echo "Les migrations se rejouent, et la base dit toujours la même chose."
else
  echo "$fautes défaut(s)."
fi
exit "$fautes"
