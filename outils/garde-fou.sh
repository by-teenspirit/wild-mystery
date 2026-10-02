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

# `src/navigateur/` est au navigateur ce que `src/domaine/` est au
# serveur : des règles pures. Le DOM, le stockage et le réseau vivent
# dans `src/adaptateurs/navigateur/`, et la racine de composition est
# `js/wild-mystery.ts`. Sans cette règle, une ligne de `document.` finit
# par s'y glisser et plus rien ne se teste sans navigateur.
mapfile -t NAV < <(printf '%s\n' "${SOURCE[@]}" | grep '^src/navigateur/' || true)
refuse_code '(document\.|window\.|localStorage|sessionStorage|fetch\(|navigator\.)' \
  "src/navigateur/ ne touche ni au DOM, ni au stockage, ni au réseau — ça, c'est un adaptateur" \
  "${NAV[@]}"

echo "────────────────────────────────────────────────────────────────"
if [ "$fautes" -gt 0 ]; then
  echo "garde-fou : $fautes faute(s)."
  exit 1
fi
echo "garde-fou : rien à signaler."
