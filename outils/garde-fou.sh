#!/usr/bin/env bash
# ════════════════════════════════════════════════════════════════════
#  outils/garde-fou.sh
#
#  Ce que le CI refuse. Chaque règle correspond à une exigence écrite
#  dans ARCHITECTURE.md. Si une règle gêne, on change l'architecture
#  et ce fichier avec, pas l'inverse.
# ════════════════════════════════════════════════════════════════════
set -uo pipefail

fautes=0
gronde() {
  echo "::error::$1"
  fautes=$((fautes + 1))
}

# Refuse si le motif est trouvé. $1 = motif, $2 = reproche, $3.. = fichiers
refuse() {
  local motif="$1" reproche="$2"
  shift 2
  [ "$#" -eq 0 ] && return 0
  local trouve
  trouve=$(grep -HnE "$motif" "$@" 2>/dev/null) || return 0
  while IFS= read -r ligne; do
    [ -n "$ligne" ] && gronde "$ligne — $reproche"
  done <<< "$trouve"
}

#  Comme `refuse`, mais sans regarder les commentaires. Un garde-fou qui
#  gronde parce qu'un commentaire EXPLIQUE pourquoi on n'utilise pas
#  `localStorage` est un garde-fou qu'on finit par désactiver — et le
#  jour où on le désactive, il ne protège plus rien.
#
#  On écarte les lignes dont le premier caractère non blanc ouvre ou
#  continue un commentaire. Un commentaire en fin de ligne de code n'est
#  pas couvert : c'est volontaire, le cas est rare et le traiter
#  demanderait de savoir analyser du TypeScript, ce qu'un script shell ne
#  fera jamais correctement.
refuse_code() {
  local motif="$1" reproche="$2"
  shift 2
  [ "$#" -eq 0 ] && return 0
  local f ligne
  for f in "$@"; do
    [ -f "$f" ] || continue
    while IFS= read -r ligne; do
      [ -n "$ligne" ] && gronde "$f:$ligne — $reproche"
    done < <(grep -nE "$motif" "$f" 2>/dev/null |
      grep -vE '^[0-9]+:[[:space:]]*(//|/\*|\*)' || true)
  done
}

ts_de() { [ -d "$1" ] && find "$1" -name '*.ts' -type f | sort || true; }
mapfile -t TESTS  < <(ts_de src | grep '\.test\.ts$' || true)
mapfile -t SOURCE < <(ts_de src | grep -v '\.test\.ts$' || true)

echo "── 1. aucun test ne contourne le code ──────────────────────────"
refuse '\bas[[:space:]]+any\b' \
  "« as any » interdit dans un test : un test qui ment sur les types ne teste rien" \
  "${TESTS[@]}"
refuse '@ts-(ignore|expect-error|nocheck)' \
  "directive @ts-* interdite dans un test" \
  "${TESTS[@]}"

echo "── 2. pas de typage désactivé ──────────────────────────────────"
desactive=$(grep -rn --include='*.json' --include='*.yml' --include='*.yaml' \
  --include='*.sh' -e '--no-check' . 2>/dev/null | grep -v 'outils/garde-fou.sh' || true)
if [ -n "$desactive" ]; then
  while IFS= read -r l; do gronde "$l — « --no-check » : on ne désactive pas le typage"; done <<< "$desactive"
fi

echo "── 3. un test pour chaque chose ────────────────────────────────"
# Un fichier qui n'exporte que des types et des interfaces ne contient
# rien à exécuter : il est dispensé de test, et `deno check` le couvre.
sans_execution() {
  ! grep -qE '^[[:space:]]*export[[:space:]]+(async[[:space:]]+)?(function|class|const|let|var|enum|default)\b' "$1"
}
for f in "${SOURCE[@]}"; do
  case "$f" in src/domaine/*|src/application/*|src/navigateur/*) ;; *) continue;; esac
  [ -f "${f%.ts}.test.ts" ] && continue
  if sans_execution "$f"; then
    echo "   $f : types seuls, pas de test attendu"
  else
    gronde "${f%.ts}.test.ts manquant — chaque règle a son test"
  fi
done

echo "── 4. la règle de dépendance ───────────────────────────────────"
mapfile -t DOM < <(printf '%s\n' "${SOURCE[@]}" | grep '^src/domaine/' || true)
refuse '^[[:space:]]*(import|export)[^"]*from[[:space:]]+"[^."]' \
  "le domaine n'importe rien d'extérieur" \
  "${DOM[@]}"
refuse_code '(Deno\.|fetch\(|Date\.now\(|new Date\(|crypto\.)' \
  "le domaine ne touche ni au monde, ni au réseau, ni à l'horloge" \
  "${DOM[@]}"

# Les tests de cas d'usage ont le droit de monter des faux : l'interdit
# ne porte que sur le code livré.
mapfile -t APP < <(printf '%s\n' "${SOURCE[@]}" | grep '^src/application/' || true)
refuse 'from[[:space:]]+"[^"]*adaptateurs/' \
  "l'application ne dépend que des ports, jamais d'un adaptateur" \
  "${APP[@]}"

mapfile -t HORS_ADAPT < <(printf '%s\n' "${SOURCE[@]}" | grep -v '^src/adaptateurs/' || true)
refuse 'new [A-Z][A-Za-z]*(Supabase|Forumactif|Http)\b' \
  "seule la racine de composition instancie un adaptateur" \
  "${HORS_ADAPT[@]}"

echo "── 5. le navigateur a son domaine, lui aussi ───────────────────"
# `src/navigateur/` est au navigateur ce que `src/domaine/` est au
# serveur : des règles pures. Le DOM, le stockage et le réseau vivent
# dans `src/adaptateurs/navigateur/`, et la racine de composition est
# `js/wild-mystery.ts`. Sans cette règle, une ligne de `document.` finit
# par s'y glisser et plus rien ne se teste sans navigateur.
mapfile -t NAV < <(printf '%s\n' "${SOURCE[@]}" | grep '^src/navigateur/' || true)
refuse_code '(document\.|window\.|localStorage|sessionStorage|fetch\(|navigator\.)' \
  "src/navigateur/ ne touche ni au DOM, ni au stockage, ni au réseau — ça, c'est un adaptateur" \
  "${NAV[@]}"

echo "── 6. le paquet du navigateur ne fuit pas ──────────────────────"
# CE QUI A COÛTÉ UNE SOIRÉE, le 2 octobre : le paquet était servi en
# script classique SANS enveloppe. Chacune de ses variables de premier
# niveau — minifiées en une lettre — devenait une globale de la page.
# Forumactif déclare un `j` de son côté ; le nôtre s'est fait écraser, et
# `j.includes is not a function` a cassé le bouton d'action en silence.
#
# `--format iife` enveloppe tout. Cette règle vérifie que l'enveloppe est
# bien là, parce qu'une option de construction s'oublie et que la panne,
# elle, ne se voit qu'en production.
PAQUET="js/wild-mystery.js"
if [ -f "$PAQUET" ]; then
  if head -c 16 "$PAQUET" | grep -qE '^\((\(\)=>|function)'; then
    echo "   $PAQUET : enveloppé, rien ne fuit dans la page"
  else
    gronde "$PAQUET n'est pas enveloppé — ses variables fuient dans la page (construire avec --format iife)"
  fi
  if ! grep -q -- '--format iife' deno.json; then
    gronde "deno.json : la tâche « construire » doit passer --format iife"
  fi
fi

echo "── 7. les feuilles de style ────────────────────────────────────"
# LE PARTAGE DE 48-… §8 : le dépôt ne DÉFINIT jamais un jeton, il s'en
# sert. Les jetons vivent dans le panneau d'administration, servi avant
# nous ; si une feuille d'ici redéclarait `--wm-…`, elle gagnerait, et
# changer une couleur de la charte redeviendrait un commit.
#
# Et : zéro requête réseau partie d'une de nos feuilles.
mapfile -t CSS < <(find css -maxdepth 1 -name '[0-9][0-9]-*.css' | sort)
for f in "${CSS[@]}"; do
  # on retire les commentaires avant de chercher : le fichier parle de
  # ses propres interdits, et il a le droit de les nommer
  # on retire d'abord les commentaires, puis les `var(…)` : un `--wm-`
  # qui survit aux deux est une DÉFINITION, pas un usage. L'ancrage en
  # début de ligne ne suffirait pas — `:root { --wm-x: red }` tient sur
  # une ligne, et c'est exactement la faute qu'on cherche.
  nu=$(perl -0pe 's{/\*.*?\*/}{}gs; 1 while s{var\([^()]*\)}{}g' "$f")
  if grep -q -- '--wm-' <<< "$nu"; then
    gronde "$f définit un jeton — le dépôt s'en sert, il ne les déclare pas (48-… §8)"
  fi
  if grep -qE '@import|url\(' <<< "$nu"; then
    gronde "$f fait une requête réseau — aucune feuille du dépôt n'a le droit"
  fi
done

# La feuille assemblée est servie par jsDelivr depuis le dépôt, pas
# depuis une étape de construction : si elle ne correspond pas aux
# feuilles, les joueurs reçoivent un CSS que personne n'a relu.
if [ ${#CSS[@]} -gt 0 ]; then
  if [ ! -f css/wild-mystery.css ]; then
    gronde "css/wild-mystery.css manque — lance « bash outils/css.sh »"
  else
    temoin=$(mktemp)
    bash outils/css.sh "$temoin" > /dev/null
    if ! cmp -s css/wild-mystery.css "$temoin"; then
      rm -f "$temoin"
      gronde "css/wild-mystery.css ne correspond pas aux feuilles — relance « bash outils/css.sh » et commite"
    else
      rm -f "$temoin"
      echo "   css/wild-mystery.css : à jour (${#CSS[@]} feuilles)"
    fi
  fi
fi

echo "── 8. le paquet livré est celui des sources ────────────────────"

# Même raison que pour la feuille assemblée : `js/wild-mystery.js` est
# servi par jsDelivr DEPUIS LE DÉPÔT, pas depuis une étape de
# construction. S'il ne correspond pas aux sources, les joueurs
# reçoivent un script que personne n'a relu — et c'est invisible, parce
# qu'il est minifié.
#
# `deno bundle` est reproductible à l'octet près pour une même entrée :
# vérifié le 3 octobre, deux constructions d'affilée donnent le même
# fichier. Si une version de Deno casse ça, cette règle le dira tout de
# suite plutôt que de laisser passer un décalage silencieux.
#
# ET SI `deno` N'EST PAS LÀ, ON LE DIT ET ON PASSE. Le shell du Mac ne
# l'a pas sur son PATH : une règle qui échoue faute d'outil est une
# règle qu'on finit par ignorer, et le jour où on l'ignore elle ne
# protège plus rien. Le CI, lui, a Deno — c'est là qu'elle mord. Si Deno
# venait à manquer AU CI, `deno task verif` serait tombé bien avant
# d'arriver ici.
if [ -f js/wild-mystery.ts ]; then
  if ! command -v deno > /dev/null 2>&1; then
    echo "   js/wild-mystery.js : non vérifié, deno n'est pas sur ce poste"
  elif [ ! -f js/wild-mystery.js ]; then
    gronde "js/wild-mystery.js manque — lance « deno task construire »"
  else
    paquet=$(mktemp -d)
    if deno bundle --platform browser --format iife --minify \
      -o "$paquet/w.js" js/wild-mystery.ts > /dev/null 2>&1; then
      if ! cmp -s js/wild-mystery.js "$paquet/w.js"; then
        gronde "js/wild-mystery.js ne correspond pas aux sources — relance « deno task construire » et commite"
      else
        echo "   js/wild-mystery.js : à jour"
      fi
    else
      gronde "la construction du paquet a échoué"
    fi
    rm -rf "$paquet"
  fi
fi

echo "── 9. l'index des espèces suit les tables ──────────────────────"

# `data/especes.json` est DÉRIVÉ de `data/faune/*.json` : il ne se tient
# pas à la main. Un nom corrigé dans une table et pas dans l'index, et
# le bilan d'un joueur affiche l'ancien — sans que rien ne casse.
#
# L'outil refuse aussi quand deux tables donnent deux noms au même
# identifiant : c'est une faute de saisie dans la faune, pas une faute
# de l'index.
if [ -d data/faune ]; then
  if ! python3 outils/especes.py --verifier; then
    gronde "l'index des espèces est en faute — la raison est à la ligne du dessus"
  fi
fi

echo "────────────────────────────────────────────────────────────────"
if [ "$fautes" -gt 0 ]; then
  echo "garde-fou : $fautes faute(s)."
  exit 1
fi
echo "garde-fou : rien à signaler."
