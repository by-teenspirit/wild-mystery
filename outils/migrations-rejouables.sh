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
#  LA BASE PEUT ÊTRE VIERGE OU DÉJÀ MONTÉE, pourvu que pgTAP y soit.
#  Les quatre exemptées sont tolérées AUX DEUX PASSAGES, et c'est
#  voulu : sur une base déjà montée — le cas du CI, qui monte les
#  migrations à l'étape d'avant — le premier passage est déjà un rejeu.
#  Ce script ne mesure que le REJEU ; le premier montage, lui, est gardé
#  par l'étape « Monter les migrations », qui n'exempte personne.
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
    if [[ " $EXEMPTEES " == *" $n "* ]]; then
      echo "   (passe $passe) $n exemptée, comme prévu"
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

#  ── `pg_prove` N'EST PAS `psql` ────────────────────────────────────
#
#  Trouvé le 17 novembre, en montant la 0043 : `psql --dbname` accepte
#  une URI de connexion, `pg_prove -d` NON — il la prend pour un nom de
#  base et retombe sur la socket par défaut. Le script disait donc « la
#  suite pgTAP ne passe plus » quelle que soit la suite, et il le disait
#  DEPUIS LE JOUR OÙ IL A ÉTÉ ÉCRIT.
#
#  Un contrôle qui ne peut pas passer est un contrôle que personne ne
#  lit : au deuxième « rouge » sans cause, on arrête de regarder. Celui
#  d'à côté — le rejeu des migrations — marche, et c'est lui qu'on
#  serait venu à ignorer avec.
#
#  On traduit donc l'URI en variables libpq, que `pg_prove` hérite
#  comme n'importe quel client.
eval "$(python3 - "$PGURL" <<'FIN'
import sys, urllib.parse as u
p = u.urlsplit(sys.argv[1])
q = dict(u.parse_qsl(p.query))
print(f"export PGHOST={q.get('host') or p.hostname or '/var/run/postgresql'}")
print(f"export PGPORT={q.get('port') or p.port or 5432}")
if p.username:
    print(f"export PGUSER={p.username}")
if p.password:
    print(f"export PGPASSWORD={p.password}")
print(f"export PGDATABASE={p.path.lstrip('/') or 'postgres'}")
FIN
)"

echo "══ et la suite tient toujours"
if ! pg_prove --ext .sql supabase/tests/ >/tmp/prove.log 2>&1; then
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
