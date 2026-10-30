#!/usr/bin/env bash
#  ── OÙ EN EST CE QUE JE VIENS D'ÉCRIRE ? ────────────────────────────
#
#  « Tu pourrais me donner un truc qui permet de savoir quand mon push
#  est fait et commité, et actif sur le forum ? », 30 octobre.
#
#  Entre une ligne de CSS et un joueur qui la voit, il y a quatre
#  étapes, et chacune peut être celle qui coince :
#
#    1 · le fichier est écrit    → `git status`
#    2 · il est commité          → le commit local
#    3 · il est poussé           → le commit sur GitHub
#    4 · il est SERVI            → GitHub Pages, qui met jusqu'à dix
#                                   minutes (`max-age=600`, relevé le
#                                   7 octobre — voir templates/
#                                   OU-POINTER-LE-CDN.md)
#
#  Ce script dit où on en est, et ce qu'il reste à faire. Il ne pousse
#  rien et ne commite rien : il regarde.
#
#      bash outils/etat.sh          une photo
#      bash outils/etat.sh --suivre reste là et redemande toutes les 20 s
#                                   jusqu'à ce que le forum soit à jour

set -u

RACINE="https://by-teenspirit.github.io/wild-mystery"
BRANCHE="socle-v2"
FICHIERS=("css/wild-mystery.css" "js/wild-mystery.js")
#  La page du forum qu'on interroge pour savoir OÙ il va chercher sa
#  feuille. N'importe laquelle ferait l'affaire : l'adresse est dans
#  overall_header, donc sur toutes.
FORUM="https://mysteryinrhode.forumactif.com/"

cd "$(dirname "$0")/.." || exit 1

vert()  { printf '\033[32m%s\033[0m' "$1"; }
rouge() { printf '\033[31m%s\033[0m' "$1"; }
jaune() { printf '\033[33m%s\033[0m' "$1"; }
gris()  { printf '\033[90m%s\033[0m' "$1"; }

#  L'empreinte d'un fichier, ici et là-bas. On compare des octets, pas
#  des dates : une date dit quand le serveur a répondu, pas ce qu'il a
#  dans le ventre.
empreinte_locale() { shasum -a 256 "$1" 2>/dev/null | cut -c1-12; }
#  LE VIDE A UNE EMPREINTE, LUI AUSSI — `e3b0c442…`, celle de la
#  chaîne vide. Première version du script : un serveur qui ne
#  répondait pas rendait cette empreinte-là, et le script annonçait
#  tranquillement « pas encore servi ». Un outil qui sert à savoir où
#  ça coince ne doit pas confondre « pas à jour » et « muet ».
#
#  On garde donc le corps et le code HTTP séparément, et on refuse de
#  mesurer un corps vide.
empreinte_servie() {
  local tmp code
  tmp=$(mktemp)
  code=$(curl -sS --max-time 20 -o "$tmp" -w '%{http_code}' "$RACINE/$1" 2>/dev/null)
  if [ "$code" != "200" ] || [ ! -s "$tmp" ]; then
    rm -f "$tmp"
    printf 'HTTP %s' "${code:-aucune réponse}"
    return 1
  fi
  shasum -a 256 "$tmp" | cut -c1-12
  rm -f "$tmp"
}

photo () {
  local souci=0

  # ── 1 · écrit ────────────────────────────────────────────────────
  local sales
  sales=$(git status --porcelain 2>/dev/null | wc -l | tr -d ' ')
  printf '  '
  if [ "$sales" = "0" ]; then
    vert "✓"; printf ' rien à commiter\n'
  else
    jaune "•"; printf ' %s fichier(s) modifié(s), pas encore commité(s)\n' "$sales"
    git status --porcelain | sed 's/^/        /' | head -8
    souci=1
  fi

  # ── 2 et 3 · commité, poussé ─────────────────────────────────────
  local ici la_bas
  ici=$(git rev-parse HEAD 2>/dev/null)
  la_bas=$(git ls-remote origin "refs/heads/$BRANCHE" 2>/dev/null | cut -f1)

  printf '  '
  if [ -z "$la_bas" ]; then
    rouge "✗"; printf ' GitHub injoignable : pas de réseau, ou le dépôt est fermé\n'
    return 1
  elif [ "$ici" = "$la_bas" ]; then
    vert "✓"; printf ' poussé — GitHub est sur %s\n' "$(gris "${ici:0:7}")"
  else
    local avance
    avance=$(git rev-list --count "$la_bas..HEAD" 2>/dev/null || echo "?")
    jaune "•"; printf ' %s commit(s) à pousser  ' "$avance"
    gris "(git push origin $BRANCHE)"; printf '\n'
    git log --oneline "$la_bas..HEAD" 2>/dev/null | sed 's/^/        /'
    souci=1
  fi

  # ── 4 · servi ────────────────────────────────────────────────────
  #
  #  On compare le fichier LOCAL à celui que Pages sert. Si les deux
  #  empreintes sont égales, ce que le joueur charge est ce qu'on a
  #  sous les yeux — quel que soit l'état du dépôt entre les deux.
  local f locale servie muet
  for f in "${FICHIERS[@]}"; do
    locale=$(empreinte_locale "$f")
    if servie=$(empreinte_servie "$f"); then muet=0; else muet=1; fi
    printf '  '
    if [ "$muet" = "1" ]; then
      rouge "✗"; printf ' %s : le serveur ne le rend pas  ' "$f"
      gris "$servie"; printf '\n'
      souci=1
    elif [ "$locale" = "$servie" ]; then
      vert "✓"; printf ' %s est en ligne  ' "$f"; gris "$servie"; printf '\n'
    else
      jaune "•"; printf ' %s pas encore servi  ' "$f"
      gris "ici $locale · servi $servie"; printf '\n'
      souci=1
    fi
  done

  # ── 5 · le forum va-t-il le chercher au bon endroit ? ────────────
  #
  #  LE TROU QUE CE SCRIPT AVAIT. Il vérifiait que Pages sert le bon
  #  fichier, jamais que le FORUM le demande. Le 30 octobre, il a
  #  annoncé « tout est en ligne » pendant que rien ne changeait sur
  #  le forum — et c'est exactement ce qu'il ne savait pas voir.
  #
  #  Le piège a un nom : jsDelivr fige la résolution d'une branche
  #  (voir templates/OU-POINTER-LE-CDN.md). Tant qu'overall_header
  #  pointe sur `@socle-v2`, Pages peut être parfait, le forum sert du
  #  vieux.
  local page adresses
  page=$(curl -sS --max-time 25 "$FORUM" 2>/dev/null)
  printf '  '
  if [ -z "$page" ]; then
    gris "· le forum ne répond pas d'ici, on ne peut pas savoir où il pointe"
    printf '\n'
    return $souci
  fi

  #  On ne lit que les adresses qui portent notre nom de dépôt.
  adresses=$(grep -oE '(https?:)?//[^"'"'"' ]*wild-mystery[^"'"'"' ]*\.(css|js)' <<< "$page" | sort -u)
  if [ -z "$adresses" ]; then
    rouge "✗"; printf ' le forum ne charge NI la feuille NI le script\n'
    return 1
  fi

  local a
  for a in $adresses; do
    printf '  '
    case "$a" in
      *by-teenspirit.github.io*)
        vert "✓"; printf ' le forum lit Pages  '; gris "$a"; printf '\n' ;;
      *jsdelivr*@"$BRANCHE"*)
        rouge "✗"; printf ' le forum lit jsDelivr SUR UNE BRANCHE — '
        printf 'cette adresse se fige et aucune purge ne la refait\n'
        gris "        $a"; printf '\n'
        gris "        à remplacer dans overall_header par $RACINE/…"; printf '\n'
        souci=1 ;;
      *)
        jaune "•"; printf ' adresse inattendue  '; gris "$a"; printf '\n'
        souci=1 ;;
    esac
  done

  return $souci
}

echo
printf '  \033[1moù en est le forum\033[0m  '
gris "$(date '+%H:%M:%S')"
echo
echo

if [ "${1:-}" = "--suivre" ]; then
  while true; do
    if photo; then
      echo
      vert "  tout est en ligne."; echo; echo
      exit 0
    fi
    echo
    gris "  je redemande dans 20 s — Ctrl+C pour arrêter"; echo
    sleep 20
    echo
    printf '  \033[1moù en est le forum\033[0m  '; gris "$(date '+%H:%M:%S')"; echo; echo
  done
fi

photo
code=$?
echo
if [ $code -eq 0 ]; then
  vert "  tout est en ligne."
else
  gris "  Pages met jusqu'à dix minutes (max-age=600). « --suivre » attend pour toi."
fi
echo
echo
exit $code
