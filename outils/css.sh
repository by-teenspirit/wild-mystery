#!/usr/bin/env bash
# ════════════════════════════════════════════════════════════════════
#  outils/css.sh — assembler les feuilles en un seul fichier servi
#
#  POURQUOI. Les feuilles sont découpées par sujet (01 dé-flottement,
#  02 socle, 03 index…) parce que c'est comme ça qu'on les écrit et
#  qu'on les relit. Mais chacune servie séparément voudrait dire une
#  ligne de plus dans `overall_header` à chaque feuille écrite, et une
#  requête de plus pour chaque joueur à chaque page.
#
#  On en sert donc UNE, assemblée ici. `overall_header` ne bouge plus.
#
#  L'ORDRE EST CELUI DES NUMÉROS, et il porte du sens : la cascade fait
#  gagner la dernière règle à spécificité égale. 01 pose la structure,
#  02 la charte, 03 à 09 les pages, 10 ce qu'on ajoute nous-mêmes. Une
#  feuille 05 doit pouvoir corriger une règle de 02 sans surenchérir en
#  sélecteurs, et c'est le tri qui le permet.
#
#  AUCUNE MINIFICATION. Le fichier est servi par jsDelivr, qui le
#  compresse en gzip de toute façon ; et un CSS lisible en production
#  est un CSS qu'on peut déboguer depuis le navigateur d'un joueur.
#
#  Usage :  bash outils/css.sh [sortie]
#           (css/wild-mystery.css par défaut ; le garde-fou lui passe un
#           fichier temporaire, parce qu'un vérificateur n'a pas à
#           modifier ce qu'il vérifie)
# ════════════════════════════════════════════════════════════════════

set -euo pipefail

#  ── `mapfile` N'EXISTE PAS DANS LE BASH DE macOS ────────────────────
#
#  macOS livre bash 3.2 — la dernière version sous GPLv2 — et
#  `mapfile` est arrivé dans la 4. Lancé par le bash du système, ce
#  script s'arrêtait sur « mapfile: command not found » puis sur
#  « TESTS[@]: unbound variable », et ne relevait donc plus rien :
#  un garde-fou que seule la CI sait lancer ne garde qu'à moitié.
#
#  On le rend plutôt que de réécrire les appels. `printf %q` existe
#  depuis la 2, et l'affectation passe par `eval` parce que bash 3.2
#  n'a pas d'autre moyen de remplir un tableau dont le nom est dans
#  une variable. Une entrée vide donne `NOM=()`, donc un tableau vide
#  et pas une erreur de `set -u`.
if ! type mapfile >/dev/null 2>&1; then
  mapfile() {
    [ "${1-}" = "-t" ] && shift
    local nom="$1" ligne liste=""
    while IFS= read -r ligne; do
      liste="$liste $(printf '%q' "$ligne")"
    done
    eval "$nom=($liste)"
  }
fi

SORTIE="${1:-css/wild-mystery.css}"

#  Le tri est lexicographique, donc numérique tant que les préfixes font
#  deux chiffres. `css/wild-mystery.css` est exclu : il est la sortie, il
#  ne peut pas être sa propre source.
mapfile -t FEUILLES < <(find css -maxdepth 1 -name '[0-9][0-9]-*.css' | sort)

if [ ${#FEUILLES[@]} -eq 0 ]; then
  echo "Aucune feuille à assembler dans css/." >&2
  exit 1
fi

{
  echo "/* ════════════════════════════════════════════════════════════════════"
  echo "   Wild Mystery — feuille assemblée. NE PAS MODIFIER À LA MAIN."
  echo ""
  echo "   Produit par outils/css.sh à partir des feuilles numérotées de"
  echo "   css/. Pour changer une règle, change la feuille qui la porte et"
  echo "   relance le script — une correction faite ici serait écrasée au"
  echo "   prochain assemblage, et la CI la refuserait avant ça."
  echo ""
  for f in "${FEUILLES[@]}"; do
    echo "     · $f"
  done
  echo "   ════════════════════════════════════════════════════════════════════ */"
  echo ""

  for f in "${FEUILLES[@]}"; do
    cat "$f"
    echo ""
  done
} > "$SORTIE"

octets=$(wc -c < "$SORTIE" | tr -d ' ')
echo "$SORTIE — ${#FEUILLES[@]} feuille(s), $octets octets"
for f in "${FEUILLES[@]}"; do
  echo "   · $f"
done
