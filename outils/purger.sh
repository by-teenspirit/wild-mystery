#!/usr/bin/env bash
# ════════════════════════════════════════════════════════════════════
#  outils/purger.sh — vider le cache jsDelivr après un push
#
#  POURQUOI CE SCRIPT EXISTE. Les deux lignes du `overall_header`
#  pointent sur une BRANCHE et plus sur un commit : sans ça, il fallait
#  rouvrir le template à chaque push pour y recoller un hash de quarante
#  caractères. Une branche ne change jamais d'URL.
#
#  LE PRIX, MESURÉ ET PAS SUPPOSÉ. On a longtemps écrit « douze heures »
#  en reprenant la documentation. Le 5 octobre, QUARANTE-HUIT HEURES
#  après un push, le forum recevait encore la feuille d'avant : 40 Ko au
#  lieu de 80, sans `04`, `05` ni `06`. Le cache de branche ne se vide
#  donc pas tout seul dans un délai sur lequel on puisse compter.
#
#  **Un push n'est pas une livraison. La purge en fait partie.**
#
#  CE N'EST PAS UN DÉPLOIEMENT. Rien n'est envoyé ici : le fichier est
#  déjà sur GitHub, on ne fait que dire au cache d'aller le relire. Si le
#  push n'est pas passé, purger ne sert à rien — d'où la comparaison
#  ci-dessous.
#
#  ── ET SI LE SHELL N'A PAS DE RÉSEAU ─────────────────────────────────
#
#  Ni le bac à sable, ni le shell du Mac ne joignent
#  `purge.jsdelivr.net`. Le script le détecte, et au lieu d'échouer il
#  imprime les adresses à ouvrir dans le navigateur — où elles marchent.
#  Une purge est un simple GET public : l'ouvrir dans un onglet fait
#  exactement ce que ferait `curl`.
#
#  Usage :  bash outils/purger.sh [branche]
#           (la branche courante par défaut)
# ════════════════════════════════════════════════════════════════════

set -uo pipefail

DEPOT="by-teenspirit/wild-mystery"

#  CE QUI EST SERVI, PAS CE QUI EST ÉCRIT. Le forum ne charge que la
#  feuille assemblée et le paquet : purger `css/10-coin-outils.css`
#  purgeait un fichier que personne ne demande. L'erreur a vécu trois
#  jours.
#
#  `data/` n'est pas listé : ces fichiers sont ajoutés bien plus souvent
#  qu'ils ne sont modifiés, et une adresse jamais servie n'a rien en
#  cache. Si une table de faune change, ajouter sa ligne ici.
FICHIERS=(
  "css/wild-mystery.css"
  "js/wild-mystery.js"
)

BRANCHE="${1:-$(git rev-parse --abbrev-ref HEAD)}"

#  Le commit que GitHub porte, pas celui qu'on a en local : purger pour
#  un commit qui n'est pas poussé ne fait rien, et c'est l'erreur la plus
#  facile à commettre juste après un `git commit`.
distant=$(git ls-remote "https://github.com/$DEPOT" "refs/heads/$BRANCHE" 2>/dev/null | cut -f1)
local_=$(git rev-parse HEAD)

echo "dépôt    : $DEPOT"
echo "branche  : $BRANCHE"
if [ -z "$distant" ]; then
  echo "distant  : injoignable d'ici"
else
  echo "distant  : ${distant:0:8}"
  echo "local    : ${local_:0:8}"
  if [ "$distant" != "$local_" ]; then
    echo
    echo "⚠  Le local et le distant diffèrent — il reste un « git push » à"
    echo "   faire. Purger maintenant remettrait en cache l'ANCIEN fichier,"
    echo "   ce qui est pire que de ne rien faire."
    echo
    echo "   Pousse d'abord, relance ensuite."
    exit 1
  fi
fi
echo

aFaireAlaMain=0
for f in "${FICHIERS[@]}"; do
  url="https://purge.jsdelivr.net/gh/$DEPOT@$BRANCHE/$f"
  printf '%-26s ' "$f"
  if reponse=$(curl -fsS --max-time 20 "$url" 2>&1); then
    case "$reponse" in
      *'"success":true'* | *'"status":"finished"'*) echo "purgé" ;;
      *) echo "réponse inattendue : $reponse" ;;
    esac
  else
    echo "pas de réseau d'ici"
    aFaireAlaMain=1
  fi
done

if [ "$aFaireAlaMain" -eq 1 ]; then
  echo
  echo "Ce shell ne joint pas jsDelivr. Ouvre ces adresses dans le"
  echo "navigateur — un onglet suffit, elles répondent un JSON :"
  echo
  for f in "${FICHIERS[@]}"; do
    echo "   https://purge.jsdelivr.net/gh/$DEPOT@$BRANCHE/$f"
  done
  echo
  echo "Attends « \"status\": \"finished\" » avant de recharger le forum."
fi

echo
echo "Le forum sert le nouveau fichier au prochain chargement."
echo "Et vide le cache du navigateur par-dessus : Cmd+Maj+R."
echo
echo "POUR VÉRIFIER, ET NE PAS CROIRE. Il y a DEUX caches, et ils mentent"
echo "chacun à leur tour : celui de jsDelivr, et celui du navigateur."
echo
echo "   console.table(performance.getEntriesByType('resource')"
echo "     .filter(r => r.name.includes('wild-mystery'))"
echo "     .map(r => ({ f: r.name.split('/').pop(),"
echo "                  octets: r.encodedBodySize,"
echo "                  transfert: r.transferSize })))"
echo
echo "   transfert = 0       la page sert une copie du CACHE NAVIGATEUR."
echo "                       Cmd+Maj+R, et recommence."
echo "   octets trop petits  c'est jsDelivr qui est en retard. Purge."
echo
echo "NE PAS vérifier avec un fetch({cache:'reload'}) : il contourne le"
echo "cache du navigateur, donc il rend la BONNE taille pendant que la"
echo "page, elle, continue d'utiliser l'ancienne. L'erreur a été faite le"
echo "5 octobre, dans l'heure qui a suivi l'écriture de ce fichier."
