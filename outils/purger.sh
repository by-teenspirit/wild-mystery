#!/usr/bin/env bash
# ════════════════════════════════════════════════════════════════════
#  outils/purger.sh — vider le cache jsDelivr après un push
#
#  POURQUOI CE SCRIPT EXISTE. Les deux lignes du `overall_header`
#  pointent sur une BRANCHE et plus sur un commit : sans ça, il fallait
#  rouvrir le template à chaque push pour y recoller un hash de quarante
#  caractères. Une branche ne change jamais d'URL.
#
#  Le prix, c'est le cache : jsDelivr garde une URL de branche **douze
#  heures**. Un push ne se voit donc pas tout de suite sur le forum — sauf
#  si on le lui demande, et c'est ce que fait ce script.
#
#  CE N'EST PAS UN DÉPLOIEMENT. Rien n'est envoyé ici : le fichier est
#  déjà sur GitHub, on ne fait que dire au cache d'aller le relire. Si le
#  push n'est pas passé, purger ne sert à rien.
#
#  Usage :  bash outils/purger.sh [branche]
#           (la branche courante par défaut)
# ════════════════════════════════════════════════════════════════════

set -euo pipefail

DEPOT="by-teenspirit/wild-mystery"
FICHIERS=(
  "js/wild-mystery.js"
  "css/10-coin-outils.css"
)

BRANCHE="${1:-$(git rev-parse --abbrev-ref HEAD)}"

#  Le commit que GitHub porte, pas celui qu'on a en local : purger pour
#  un commit qui n'est pas poussé ne fait rien, et c'est l'erreur la plus
#  facile à commettre juste après un `git commit`.
distant=$(git ls-remote "https://github.com/$DEPOT" "refs/heads/$BRANCHE" | cut -f1)
if [ -z "$distant" ]; then
  echo "La branche « $BRANCHE » n'existe pas sur $DEPOT." >&2
  exit 1
fi
local_=$(git rev-parse HEAD)

echo "dépôt    : $DEPOT"
echo "branche  : $BRANCHE"
echo "distant  : ${distant:0:8}"
echo "local    : ${local_:0:8}"
if [ "$distant" != "$local_" ]; then
  echo
  echo "⚠  Le local et le distant diffèrent — il reste sans doute un"
  echo "   « git push » à faire. On purge quand même ce qui est en ligne."
fi
echo

for f in "${FICHIERS[@]}"; do
  url="https://purge.jsdelivr.net/gh/$DEPOT@$BRANCHE/$f"
  printf '%-26s ' "$f"
  if reponse=$(curl -fsS --max-time 20 "$url" 2>&1); then
    #  La réponse est un JSON ; on n'en veut qu'un mot.
    case "$reponse" in
      *'"success":true'*|*'"status":"finished"'*) echo "purgé" ;;
      *) echo "réponse inattendue : $reponse" ;;
    esac
  else
    echo "échec : $reponse"
  fi
done

echo
echo "Le forum sert le nouveau fichier au prochain chargement."
echo "Pense à vider le cache du navigateur si tu ne vois rien (Cmd+Maj+R)."
