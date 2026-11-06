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
  #  LA SECONDE DÉROGATION, posée le 9 octobre : un `var(--jeton,
  #  url(…))`. Elle est étroite et elle se défend.
  #
  #  « Bah tu as le lien du bandeau non ? » — le bandeau de catégorie
  #  est une image de charte, donc un jeton, donc dans le panneau
  #  d'administration. Tant que le panneau sert un `jetons.css`
  #  antérieur, le jeton est VIDE et la bande reste grise : la règle
  #  « zéro requête » transformait un retard de copier-coller en
  #  défaut d'affichage.
  #
  #  Le repli porte donc la même adresse que le jeton. Ce n'est pas
  #  une requête de plus — c'est la même, et seulement le jour où le
  #  jeton manque. **Et le garde-fou n° 15 relit les deux** : un repli
  #  qui divergerait du jeton est déjà une faute, donc l'adresse ne
  #  peut pas vieillir en silence ici.
  #
  #  Un `url(` HORS d'un `var()` reste une faute, et c'est ce que la
  #  seconde passe vérifie encore.
  nu=$(perl -0pe 's{/\*.*?\*/}{}gs;
       1 while s{var\(\s*--[\w-]+\s*(?:,\s*(?:[^()]|url\([^()"]*"[^"]*"[^()]*\))*)?\)}{}g;
       1 while s{var\([^()]*\)}{}g' "$f")
  if grep -q -- '--wm-' <<< "$nu"; then
    gronde "$f définit un jeton — le dépôt s'en sert, il ne les déclare pas (48-… §8)"
  fi
  # LA SEULE DÉROGATION : les polices embarquées dans `assets/polices`.
  # Elle tient à une propriété du navigateur, pas à une promesse : une
  # police n'est téléchargée que lorsqu'un élément RENDU s'en sert.
  # Décochée, la case « Police pour la dyslexie » ne coûte pas une
  # requête, et le harnais de confort les compte dans les deux états.
  # Tout autre `url(` reste une faute, y compris dans ce fichier-là.
  sans_police=$(perl -0pe 's{url\(\s*"\.\./assets/polices/[^"]+"\s*\)}{}g' <<< "$nu")
  # LA SECONDE DÉROGATION : `url("data:…")`. Un `data:` N'EST PAS UNE
  # REQUÊTE — la donnée est dans la feuille, le navigateur ne sort pas
  # du fichier pour la lire. Le contrôle attrapait un chevron de liste
  # déroulante dessiné en SVG inline, le 30 octobre, et il avait tort :
  # ce qu'il protège est le fait d'aller chercher quelque chose
  # AILLEURS, pas le fait d'avoir une image.
  #
  # Seuls `data:image/svg+xml` et `data:image/png` passent, et en
  # guillemets : une forme libre laisserait rentrer `data:text/html`,
  # qui n'a rien à faire dans une feuille.
  sans_donnee=$(perl -0pe 's{url\(\s*"data:image/(?:svg\+xml|png)[,;][^"]*"\s*\)}{}g' <<< "$sans_police")
  # LA TROISIÈME DÉROGATION, posée le 31 octobre : les six légendaires
  # de `img/natures`. Elle repose sur les deux mêmes appuis que les
  # polices.
  #
  # D'ABORD, CE N'EST PAS « AILLEURS ». Ce que la règle protège, elle
  # le dit plus haut : aller chercher quelque chose hors du dépôt. Ces
  # six fichiers sont DANS le dépôt, servis par la même Pages que la
  # feuille, et l'adresse est relative — elle suit le dépôt sans
  # nommer d'hébergeur. Rien à révoquer, rien à voir expirer.
  #
  # ENSUITE, ELLES NE COÛTENT RIEN TANT QU'ON NE LES AFFICHE PAS. Une
  # image de fond n'est demandée que si une règle s'applique à un
  # élément rendu, et celles-ci tiennent à `[data-wm-nature]`. Une
  # page sans carte dresseur n'en charge aucune ; une page avec une
  # carte en charge UNE.
  #
  # ENFIN, LES METTRE EN `data:` SERAIT PIRE. Les onze badges y sont
  # parce qu'ils pèsent deux kilos pièce. Ces six-là en pèsent
  # quatre-vingts : un demi-mégaoctet ajouté à la feuille, téléchargé
  # par tout le monde sur toutes les pages, pour en montrer une.
  #
  # Le chemin est écrit en entier : `../img/natures/<nom>.png`. Tout
  # autre dossier, toute autre extension, reste une faute.
  sans_nature=$(perl -0pe 's{url\(\s*"\.\./img/natures/[\w-]+\.png"\s*\)}{}g' <<< "$sans_donnee")
  if grep -qE '@import|url\(' <<< "$sans_nature"; then
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
# IL Y EN A QUATRE. Les pages autonomes — annexes, carnet, annexe de la
# carte — sont créées sans l'en-tête du forum : elles ne reçoivent aucun
# script et chargent le leur. `js/annexes.js` ne pose que le sommaire,
# et surtout il NE CHARGE PAS le switcheroo ni la réécriture de barre
# que porte `wild-mystery.js`. Tous se vérifient pareil.
#
# ET IL EN MANQUAIT DEUX, dont le carnet — le paquet dont une version
# périmée a servi un écran vide pendant une journée entière le 3
# novembre. La règle existait, elle ne regardait simplement pas ce
# fichier-là. Une garde qui ne couvre pas le cas qui est déjà arrivé
# n'est pas une garde.
for src in js/wild-mystery.ts js/annexes.ts js/carnet.ts js/carte.ts; do
  [ -f "$src" ] || continue
  livre="${src%.ts}.js"
  if ! command -v deno > /dev/null 2>&1; then
    echo "   $livre : non vérifié, deno n'est pas sur ce poste"
  elif [ ! -f "$livre" ]; then
    gronde "$livre manque — lance « deno task construire »"
  else
    paquet=$(mktemp -d)
    if deno bundle --platform browser --format iife --minify \
      -o "$paquet/w.js" "$src" > /dev/null 2>&1; then
      if ! cmp -s "$livre" "$paquet/w.js"; then
        gronde "$livre ne correspond pas aux sources — relance « deno task construire » et commite"
      else
        echo "   $livre : à jour"
      fi
    else
      gronde "la construction de $livre a échoué"
    fi
    rm -rf "$paquet"
  fi
done

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

echo "── 10. aucune clé de service dans le dépôt ─────────────────────"

# `data/supabase.json` porte la clé PUBLIABLE, et c'est voulu : elle est
# faite pour être servie aux navigateurs, et ce sont les politiques RLS
# qui bornent ce qu'elle lit. Le jour où quelqu'un y colle la clé de
# service « juste pour essayer », tout le schéma est lisible et
# modifiable par le premier visiteur venu — et le dépôt est public.
#
# Ce que ça refuse :
#   · la clé de service nouvelle forme, préfixée ;
#   · un JWT COMPLET — `en-tête.charge.signature`, les deux premiers
#     segments commençant par `eyJ`, c'est-à-dire `{"` en base64.
#
# DEUX FAUSSES ALERTES PAYÉES EN L'ÉCRIVANT, et elles valent la peine
# d'être dites :
#
#   · chercher `eyJ` suivi de trente caractères attrapait NOS PROPRES
#     marqueurs. `[[WM:eyJ0IjoieHAi…:WM-ACDE-FGH]]` est du base64 lui
#     aussi. D'où la structure complète exigée : un JWT a des points,
#     un marqueur n'en a pas ;
#   · et ce fichier contient forcément les motifs qu'il cherche. Il
#     s'exclut, sinon il gronde sur lui-même à chaque passage — et un
#     garde-fou qui crie toujours ne protège plus rien.
#
# `service_role` tout court n'est PAS refusé : il apparaît légitimement
# dans les `grant … to service_role` des migrations.
# `--others --exclude-standard` en plus de `--cached` : un fichier
# fraîchement créé et pas encore ajouté est EXACTEMENT celui qu'on veut
# examiner. Sans ces deux drapeaux la règle ne regardait que le passé,
# et elle a laissé passer les deux essais faits pour la casser.
mapfile -t SUIVIS < <(
  {
    git ls-files --cached --others --exclude-standard 2>/dev/null ||
      find . -type f -not -path './.git/*'
  } | grep -v '^outils/garde-fou.sh$'
)
if [ ${#SUIVIS[@]} -gt 0 ]; then
  refuse 'sb''_secret_' \
    "clé de service Supabase — elle ne sort jamais de Supabase" \
    "${SUIVIS[@]}"
  refuse 'eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.' \
    "jeton JWT complet en dur — si c'est la clé de service, le dépôt est public" \
    "${SUIVIS[@]}"
fi

# Et la clé publiable doit en être une : un copier-coller malheureux se
# voit ici plutôt qu'en production.
if [ -f data/supabase.json ]; then
  if grep -q '"clePubliable": *"sb_publishable_' data/supabase.json; then
    echo "   data/supabase.json : clé publiable, bornée par RLS"
  else
    gronde "data/supabase.json ne porte pas une clé « sb_publishable_ »"
  fi
fi

echo "── 11. le catalogue de la boutique ─────────────────────────────"
# `data/objets.json` est la source unique du catalogue. Le seed SQL en
# est dérivé, et c'est LUI que `boutique_servir` relit pour facturer.
#
# LES DEUX DOIVENT DIRE LE MÊME PRIX. Sinon un joueur commande en voyant
# 200 et se fait débiter 600 — et on cherche une soirée qui a menti.
#
# Même forme que la règle 9 : l'outil sait vérifier, le garde-fou ne fait
# que l'appeler. Et il passe son chemin quand `python3` manque, comme la
# règle 8 le fait pour `deno`.
if [ ! -f data/objets.json ]; then
  echo "   pas de catalogue à vérifier"
elif ! command -v python3 >/dev/null 2>&1; then
  echo "   python3 absent du PATH — vérification sautée"
elif ! python3 outils/objets.py --verifier; then
  gronde "le catalogue et son seed ne correspondent pas"
fi

echo "── 12. les bornes du panier ────────────────────────────────────"
# Les bornes du panier sont écrites DEUX FOIS, et il n'y a pas moyen de
# faire autrement : `src/domaine/panier.ts` les applique au navigateur,
# la migration 0011 les applique en base, et on n'importe pas du
# TypeScript dans du SQL.
#
# DONC ON LES RELIT, on ne les recopie pas en espérant. Une liste
# recopiée sans vérification est la troisième source de vérité qui finira
# par mentir — c'est la leçon du 5 octobre, où le catalogue utilisait
# quatre familles que la contrainte de la base refusait, pendant que le
# garde-fou n° 11 confirmait que tout était à jour.
#
# Ce qui arriverait sans ça : la base accepte 99 et le navigateur borne à
# 50. Le joueur ne peut pas cliquer plus de 50, donc personne ne le voit
# — jusqu'au jour où quelqu'un écrit son bloc à la main et obtient un
# refus que le catalogue ne laissait pas prévoir.
if ! command -v python3 >/dev/null 2>&1; then
  echo "   python3 absent du PATH — vérification sautée"
else
  python3 - <<'PYTHON' || gronde "les bornes du panier divergent entre le domaine et la base"
import pathlib, re, sys

def un(chemin, motif, quoi):
    texte = pathlib.Path(chemin).read_text(encoding="utf-8")
    trouves = re.findall(motif, texte)
    if len(trouves) != 1:
        print(f"   {chemin} : {len(trouves)} definition(s) de {quoi}, il en faut une",
              file=sys.stderr)
        sys.exit(1)
    return int(trouves[0])

DOMAINE = "src/domaine/panier.ts"
SQL = "supabase/migrations/0011_la_boutique_qui_marche.sql"

paires = [
    ("quantité max",
     un(DOMAINE, r"QUANTITE_MAX\s*=\s*(\d+)", "QUANTITE_MAX"),
     un(SQL, r"function boutique_quantite_max\(\)[^$]*\$\$\s*select\s+(\d+)",
        "boutique_quantite_max")),
    ("lignes max",
     un(DOMAINE, r"LIGNES_MAX\s*=\s*(\d+)", "LIGNES_MAX"),
     un(SQL, r"function boutique_lignes_max\(\)[^$]*\$\$\s*select\s+(\d+)",
        "boutique_lignes_max")),
]

faute = False
for quoi, domaine, sql in paires:
    if domaine != sql:
        print(f"   {quoi} : {domaine} dans le domaine, {sql} en base", file=sys.stderr)
        faute = True
    else:
        print(f"   {quoi} : {domaine} des deux côtés")
sys.exit(1 if faute else 0)
PYTHON
fi

echo "── 13. la table des fossiles ───────────────────────────────────"
# Elle est relevée sur PokéAPI, et c'est précisément pour ça qu'elle se
# relit : une correspondance recopiée à la main entre un objet et une
# espèce est une faute qu'on ne voit qu'en jouant, des mois plus tard,
# quand un joueur ressuscite autre chose que ce qu'il croyait.
#
# Le contrôle n'est PAS dans `src/domaine/fossile.test.ts` : le domaine
# ne lit aucun fichier, et un test qui demanderait `--allow-read` y
# casserait la règle que la couverture fait respecter.
if ! python3 - <<'PYTHON'
import json, sys

d = json.load(open("data/fossiles.json", encoding="utf-8"))
f = d.get("fossiles", [])
especes = json.load(open("data/especes.json", encoding="utf-8"))["especes"]
connues = {int(i) for i in especes}

fautes = []
if len(f) == 0:
    fautes.append("la table est vide")

for champ, n in (("clef", str), ("objet", str), ("espece", str), ("slug", str),
                 ("id", int), ("morceauId", int), ("pokeapiId", int), ("especeId", int)):
    manquants = [x.get("clef", "?") for x in f if not isinstance(x.get(champ), n)]
    if manquants:
        fautes.append(f"{champ} absent ou du mauvais type : {manquants}")

for quoi in ("clef", "slug", "id", "morceauId", "pokeapiId", "especeId"):
    vus = [x.get(quoi) for x in f]
    doubles = {v for v in vus if vus.count(v) > 1}
    if doubles:
        fautes.append(f"{quoi} en double : {sorted(str(x) for x in doubles)}")

# UNE ESPÈCE QUI N'EST PAS DANS LA FAUNE est un fossile qu'on ramasse et
# qu'on ne peut pas rendre.
inconnues = [f"{x['espece']} ({x['especeId']})" for x in f
             if x.get("especeId") not in connues]
if inconnues:
    fautes.append(f"espèces absentes de data/especes.json : {inconnues}")

morceaux = d.get("morceauxParFossile")
if not isinstance(morceaux, int) or morceaux < 2:
    fautes.append(f"morceauxParFossile vaut {morceaux}, attendu un entier >= 2")

for quoi in ("chanceDeMorceau", "chanceDEntier"):
    v = d.get(quoi)
    if not isinstance(v, (int, float)) or not (0 < v < 1):
        fautes.append(f"{quoi} vaut {v}, attendu strictement entre 0 et 1")

# L'ENTIER DOIT RESTER PLUS RARE QUE LE MORCEAU, sinon la rareté est à
# l'envers et personne ne le verra avant des mois de jeu.
if isinstance(d.get("chanceDEntier"), (int, float)) and \
   isinstance(d.get("chanceDeMorceau"), (int, float)) and \
   d["chanceDEntier"] >= d["chanceDeMorceau"]:
    fautes.append("chanceDEntier >= chanceDeMorceau : la rareté est à l'envers")

# UN IDENTIFIANT D'OBJET PARTAGÉ ENTRE UN FOSSILE ET UN MORCEAU, c'est
# un sac dont le contenu change au prochain déploiement.
tous = [x.get("id") for x in f] + [x.get("morceauId") for x in f]
doubles = {v for v in tous if tous.count(v) > 1}
if doubles:
    fautes.append(f"un id sert deux fois (fossile et morceau) : {sorted(map(str, doubles))}")

for x in fautes:
    print(f"   {x}", file=sys.stderr)
if fautes:
    sys.exit(1)
print(f"   {len(f)} fossiles, une espèce chacun, toutes dans la faune")
print(f"   {morceaux} morceaux pour un entier · "
      f"morceau {d['chanceDeMorceau']:.1%} · entier {d['chanceDEntier']:.1%}")
PYTHON
then
  echo "::error::data/fossiles.json ne tient pas"
  fautes=$((fautes + 1))
fi

# Et le seed qui en est dérivé. Même forme que la règle 11 : l'outil sait
# vérifier, le garde-fou ne fait que l'appeler — et il passe son chemin
# quand `python3` manque.
#
# CE QU'IL ATTRAPE QUE LE BLOC AU-DESSUS N'ATTRAPE PAS : un identifiant
# qui empiète sur le catalogue de la boutique, une famille que la
# contrainte de la base refuse, et un seed qu'on a oublié de régénérer
# après avoir changé le JSON.
if ! command -v python3 >/dev/null 2>&1; then
  echo "   python3 absent du PATH — seed des fossiles non vérifié"
elif ! python3 outils/fossiles.py --verifier; then
  gronde "la table des fossiles et son seed ne correspondent pas"
fi

echo "── 14. le bloc d'accueil et son repli ──────────────────────────"
# `data/accueil.json` est la source ; `pages/accueil-repli.html` en est
# dérivé, et c'est LUI qui est collé dans le message d'accueil du forum.
#
# LES DEUX DOIVENT DIRE LE MÊME CONTEXTE. Sinon un visiteur sans
# JavaScript lit une version du texte, et les autres en lisent une
# autre — et personne ne s'en aperçoit, puisque les deux s'affichent
# très bien.
#
# Le bloc ne contient QUE ce qui ne change jamais : le contexte et les
# sept liens. Les actualités n'y sont pas, justement pour n'avoir rien
# à recoller.
if [ ! -f data/accueil.json ]; then
  echo "   pas de bloc d'accueil à vérifier"
elif ! command -v python3 >/dev/null 2>&1; then
  echo "   python3 absent du PATH — vérification sautée"
elif ! python3 outils/accueil.py --verifier; then
  gronde "le bloc d'accueil et son repli ne correspondent pas"
fi

echo "── 15. les replis disent la vérité ─────────────────────────────"
# Chaque `var(--wm-x, repli)` de `css/` doit porter la valeur que
# `panneau-admin/jetons.css` déclare vraiment pour `--wm-x`.
#
# CE QUI L'A FAIT ÉCRIRE. La page d'accueil affichait tous ses titres
# manuscrits en Fraunces, et la règle fautive se lisait très bien :
#
#     font-family: var(--wm-police-titre, "Kaushan Script", cursive);
#
# Le repli dit Kaushan Script, donc on relit « manuscrit ». Mais
# `--wm-police-titre` VAUT Fraunces : c'est `--wm-police-accent` qui est
# la manuscrite. Le repli ne s'affiche jamais quand la charte est
# servie — il ne faisait que mentir au relecteur, et il l'a fait trois
# fois de suite. Callista l'a vu à l'écran ; moi, non.
#
# Les jetons vivent dans le panneau d'administration (48-… §8), donc le
# repli est la SEULE valeur lisible dans le dépôt : c'est lui qu'on lit
# pour savoir de quelle couleur ou de quelle police on parle. Il ne peut
# pas mentir.
#
# Vérifié en le cassant dans les trois sens : un repli périmé, le jeton
# du jour (accent remplacé par titre), un jeton inventé.
if ! command -v python3 >/dev/null 2>&1; then
  echo "   python3 absent du PATH — replis non vérifiés"
elif ! python3 outils/jetons.py --verifier; then
  gronde "des replis de var() ne correspondent plus à jetons.css"
fi

echo "── 16. chaque règle est sous #modernbb ─────────────────────────"
# Un sélecteur sans racine perd contre ModernBB dès que le sien est plus
# précis — et ça ne se voit qu'à l'écran, sur le forum réel.
#
# CE QUI L'A FAIT ÉCRIRE. « La page d'accueil ne ressemble pas du tout à
# la maquette. » La feuille était juste, elle était servie, ses règles
# étaient là. Elles PERDAIENT : le bloc vit dans le message d'accueil,
# donc dans `.content`, et `10-ltr.css` y pose
# `.content h2 { font-family: Roboto }` — 0-1-1 contre nos 0-1-0.
#
# Mesuré sur le forum en injectant la feuille préfixée et en comparant
# les styles calculés : 260 propriétés changeaient. Les titres, les
# tailles de corps, la couleur des liens, les 40 px de retrait des `ul`,
# et 200 px de hauteur en trop.
#
# L'ERREUR DE RAISONNEMENT : « c'est notre balisage, rien ne peut entrer
# en collision ». Faux dès qu'il atterrit dans une zone que le thème
# habille — et où il atterrit, on ne le sait qu'à l'exécution. Donc tout
# est préfixé, sans exception à juger au cas par cas.
#
# Vérifié en le cassant dans les deux sens : une règle de premier
# niveau, une règle dans un `@media`.
if ! command -v python3 >/dev/null 2>&1; then
  echo "   python3 absent du PATH — spécificité non vérifiée"
elif ! python3 outils/specificite.py --verifier; then
  gronde "des sélecteurs ne sont pas sous #modernbb"
fi

echo "── 17. le seed des espèces suit l'index ────────────────────────"
# `supabase/seeds/especes.sql` est dérivé de `data/especes.json` (les
# noms, qui viennent des tables de faune) et de
# `data/especes-fiches.json` (les types, le stade, les PV, relevés sur
# PokéAPI). Le même contrôle que pour le catalogue et les fossiles :
# relire le dérivé contre ses sources, au lieu de le croire.
#
# CE QUI L'A FAIT ÉCRIRE, et c'est le plus gros défaut trouvé le
# 9 octobre : **la table `espece` de la vraie base ne contenait qu'UNE
# ligne**, Goupix. `pokemon`, `pokedex`, `fossile_espece` et
# `zone_espece` ont toutes une clé étrangère vers elle — donc aucune
# capture ne pouvait s'écrire, donc **aucune clôture ne pouvait
# aboutir**, et le seed des fossiles échouait à sa première ligne.
#
# Personne ne l'avait vu parce qu'il n'y avait RIEN à relire : aucun
# seed d'espèces n'existait dans le dépôt, et un fichier absent ne
# contredit aucune source.
#
# Ce garde-fou ne vérifie pas la BASE — il ne la joint pas — mais il
# garantit que le fichier à y coller existe et dit la vérité. Pour
# savoir où en est la base, `supabase/ou-en-est-la-base.sql`.
if ! command -v python3 >/dev/null 2>&1; then
  echo "   python3 absent du PATH — seed des espèces non vérifié"
elif ! python3 outils/especes-sql.py --verifier; then
  gronde "le seed des espèces ne correspond plus à data/especes.json"
fi

echo "── 18. le messenger suit les noms du greffon ───────────────────"
# Deux contrôles sur `css/15-messenger.css`, et les deux viennent de
# défauts trouvés le 11 octobre.
#
# UN : chaque nom en `FAM-…` qu'on habille doit exister dans le
# greffon. Trois n'existaient pas — `.FAM-notification`,
# `.FAM-active-tab`, `.FAM-container-content`. Du CSS mort ne prévient
# jamais : il ne lève pas d'erreur, il ne casse rien, et il fait croire
# que le cas est traité.
#
# DEUX : aucun sélecteur deux fois. Cinq choses étaient décrites deux
# fois avec des valeurs différentes, et à spécificité égale la dernière
# gagne en silence. Le pire : le fond du bouton plein venait d'une
# règle, sa couleur de texte de l'autre — `accent/fort` sur
# `accent/fort`, **rapport 1,0**, le mot « Envoyer » disparaissait au
# survol.
if ! command -v python3 >/dev/null 2>&1; then
  echo "   python3 absent du PATH — feuille du messenger non vérifiée"
elif ! python3 outils/messenger-noms.py; then
  gronde "la feuille du messenger habille un nom inexistant, ou se répète"
fi

echo "── 19. chaque tâche donne ce que ses tests réclament ───────────"
# Le défaut du 13 octobre, et il a coûté un passage de CI entier.
#
# Deux tests de `src/navigateur/accueil.test.ts` lisent le vrai
# `data/accueil.json` du dépôt. La tâche `test:navigateur` ne donnait
# que `--allow-env`. Le travail « Navigateur » est tombé en huit
# secondes — sur un tag dont le code n'avait rien à voir.
#
# POURQUOI PERSONNE NE L'AVAIT VU : en local on lançait `test:tout`,
# qui donne `--allow-read --allow-net --allow-run`. Un fourre-tout qui
# ne refuse rien ne prouve plus qu'un module est pur ; il cachait le
# défaut au lieu de le trouver. C'est l'inverse de ce qu'un test doit
# faire, et c'est pour ça que la règle exclut cette tâche-là.
#
# Vérifié en le cassant : avec l'ancienne ligne de `deno.json`, l'outil
# nomme la tâche, la permission manquante et le fichier qui la réclame.
if ! command -v python3 >/dev/null 2>&1; then
  echo "   python3 absent du PATH — permissions des tâches non vérifiées"
elif ! python3 outils/permissions-des-taches.py; then
  gronde "une tâche de test ne donne pas une permission que ses tests réclament"
fi

echo "── 20. un seul Chromium, une seule façon de l'installer ────────"
# Le défaut du 13 octobre, et il a coûté un deuxième passage.
#
# Deux travaux du CI installent Chromium. Ils ne le faisaient pas
# pareil : « Contraste des pages » par `npx`, « Navigateur » par
# `deno run -A npm:playwright install`. La seconde a tourné SIX HEURES
# PILE — 14:03:31 → 20:03:56, tuée par la limite de GitHub, sans une
# ligne d'erreur. Sous Deno, l'installateur de Playwright délègue le
# téléchargement à un processus fils qui peut rester pendu sans que le
# parent s'en aperçoive.
#
# Le défaut n'est pas « Deno est mauvais ». C'est DEUX FAÇONS DE FAIRE
# LA MÊME CHOSE, dont une seule avait déjà tourné — et c'est celle
# qu'on n'avait jamais vue marcher qui a cassé.
#
# La règle vérifie aussi que la version de Playwright du CI est celle
# que les huit harnais importent : un navigateur installé par 1.50 pour
# un harnais qui importe 1.49.1 cherche un numéro de build absent, et
# se plaint d'un navigateur « manquant » alors qu'il est sur le disque.
#
# Vérifié dans les deux sens : remise à l'ancienne commande, elle
# nomme les deux formes.
if ! command -v python3 >/dev/null 2>&1; then
  echo "   python3 absent du PATH — installation de Chromium non vérifiée"
elif ! python3 outils/chromium-du-ci.py; then
  gronde "le CI installe Chromium de deux façons, ou pas à la version des harnais"
fi

echo "── 21. aucune mesure jetée dans les harnais ────────────────────"
# `deno lint` ne regarde que `src/`, `js/` et les fonctions Edge —
# `outils/` en est dehors, et à raison : la règle
# `explicit-function-return-type` qu'on a activée est du TypeScript, et
# les harnais sont du JavaScript pur. Dix des onze plaintes de `deno
# lint outils/` sont ce faux positif-là.
#
# La onzième ne l'était pas, et c'est pour elle que cette règle existe :
# une variable relevée dans un `evaluate` et JAMAIS UTILISÉE. Deux
# trouvées le 14 octobre — `notifs` dans `navigation.mjs`, `col` dans
# `enligne.mjs`. Les deux étaient des restes, mais on ne pouvait pas le
# savoir sans aller lire : une mesure prise et jetée, dans un harnais,
# c'est AUSSI SOUVENT une assertion qu'on a oublié d'écrire.
#
# C'est exactement ce qui venait de se passer deux fois ce jour-là : le
# harnais des catégories relevait `hauteurLigne` sans jamais la
# comparer à une cote, et il est resté vert pendant que la ligne de
# forum était fausse en ligne.
#
# D'où une seule règle, ciblée, sur tout `outils/`.
#
# Vérifié en le cassant : une variable inutilisée ajoutée à
# `confort.mjs` la fait nommer, fichier et ligne.
#  `deno` ABSENT SE DIT, il ne se confond pas avec une plainte du lint.
#  Lancé depuis un shell sans deno — le pont vers le Mac, par exemple —
#  cette règle grondait « un harnais relève une mesure qu'il n'utilise
#  pas » alors qu'elle n'avait rien pu regarder. Un garde-fou qui accuse
#  à faux est un garde-fou qu'on cesse de croire. Les règles 20 et 23
#  font pareil avec python3.
if ! command -v deno >/dev/null 2>&1; then
  echo "   deno absent du PATH — harnais non vérifiés"
elif ! deno lint --rules-tags= --rules-include=no-unused-vars outils/ >/tmp/wm-lint-outils 2>&1; then
  sed 's/^/   /' /tmp/wm-lint-outils
  gronde "un harnais relève une mesure qu'il n'utilise pas — assertion oubliée ou code mort"
else
  echo "   harnais : $(ls outils/*.mjs | wc -l | tr -d ' ') fichiers, aucune mesure jetée"
fi
rm -f /tmp/wm-lint-outils

echo "── 22. un module d'interface dit qui le monte ──────────────────"
# LA RÈGLE 3 NE REGARDAIT QUE `src/domaine/`, `src/application/` et
# `src/navigateur/`. `src/adaptateurs/` en était dehors, et c'est comme
# ça que `barre-d-actions.ts` a vécu treize jours sans qu'aucun test ni
# aucun harnais ne le monte. Callista l'a trouvé à la main, sur son
# forum : « j'ai testé l'option "chercher", mais ça fait rien. »
#
# Un module d'interface n'a souvent pas de test unitaire, et c'est
# légitime : son travail est de poser du DOM, et un faux DOM prouve peu.
# Mais alors un harnais doit le monter, et ce harnais doit TOURNER —
# d'où les trois vérifications d'un coup : le fichier existe, c'est une
# tâche de `deno.json`, et le CI l'appelle.
#
# Trois façons d'être couvert, dans cet ordre :
#   1. son propre `.test.ts` ;
#   2. un test, n'importe où sous `src/`, qui l'importe (les doubles en
#      mémoire et les clients Supabase sont dans ce cas) ;
#   3. une ligne « COUVERT PAR : outils/<x>.mjs » dans son en-tête.
#
# Et une quatrième, qui n'est pas une couverture : « COUVERT PAR :
# PERSONNE ». C'est une dette déclarée, elle est comptée, et le nombre
# attendu ci-dessous ne peut que descendre.
#  TOMBÉE À ZÉRO LE 16 OCTOBRE, avec `outils/boutique.mjs` : plus un seul
#  module d'interface sans couverture. Le chiffre ne peut que descendre —
#  si une dette réapparaît, la règle gronde.
DETTE_ATTENDUE=0
dette=0
for f in "${SOURCE[@]}"; do
  case "$f" in src/adaptateurs/*) ;; *) continue;; esac
  [ -f "${f%.ts}.test.ts" ] && continue
  if sans_execution "$f"; then
    echo "   $f : types seuls, pas de test attendu"
    continue
  fi
  base=$(basename "$f" .ts)
  if grep -qlE "from \"[^\"]*${base}\.ts\"" "${TESTS[@]}" 2>/dev/null; then
    continue
  fi
  if grep -q "COUVERT PAR : PERSONNE" "$f"; then
    dette=$((dette + 1))
    echo "   $f : DETTE DÉCLARÉE — aucun test, aucun harnais"
    continue
  fi
  harnais=$(sed -n 's|^//  COUVERT PAR : \(outils/[a-z0-9-]*\.mjs\).*|\1|p' "$f" | head -1)
  if [ -z "$harnais" ]; then
    gronde "$f : ni test unitaire, ni test qui l'importe, ni « COUVERT PAR : outils/<x>.mjs »"
    continue
  fi
  tache=$(basename "$harnais" .mjs)
  [ -f "$harnais" ] || gronde "$f dit être couvert par $harnais, qui n'existe pas"
  grep -q "\"$tache\": \"deno run -A $harnais\"" deno.json ||
    gronde "$harnais n'est pas la tâche « $tache » de deno.json — rien ne le lance"
  grep -q "deno task $tache" .github/workflows/ci.yml ||
    gronde "le CI ne lance jamais « deno task $tache » — un harnais qui ne tourne pas ne garde rien"
done
if [ "$dette" -gt "$DETTE_ATTENDUE" ]; then
  gronde "$dette module(s) d'interface sans aucune couverture, $DETTE_ATTENDUE attendu(s) — la dette grandit"
elif [ "$dette" -lt "$DETTE_ATTENDUE" ]; then
  gronde "la dette est tombée à $dette : descends DETTE_ATTENDUE à $dette dans ce fichier"
else
  echo "   dette inchangée : $dette module d'interface sans couverture"
fi

echo "── 23. les fichiers dérivés se dérivent, ils ne s'écrivent pas ─"
# LE 15 OCTOBRE, LES DIX-SEPT TABLES ONT ÉTÉ REFAITES : Callista a retiré
# le niveau de lieu — « enlève tous les petits lieux. On a 3 paliers, 17
# zones sauvages, et tu répartis le pokédex comme ça. »
#
# Il y a donc maintenant une chaîne de trois fichiers dérivés, et chacun
# peut se désaccorder du précédent par une modification à la main :
#
#   planche 39  →  data/pokedex-de-rhode.json   (933 noms, par zone)
#               →  data/pokedex-ids.json        (nom → identifiant)
#               →  data/faune/<forumId>.json    (les 34 tables)
#
# Et depuis le 2 novembre, la fusion que lit l'onglet Pokédex du carnet,
# qui dépend des trois ci-dessus PLUS les types des fiches d'espèces :
#
#   les quatre →  data/pokedex-carnet.json      (933 espèces, un fetch)
#
# Et la table de butin, qui se dérive de trois fichiers à la fois :
#
#   objets.json + fossiles.json + les types mesurés des espèces
#               →  data/butin.json              (ce qu'une fouille donne)
#
# Et le bandeau d'une zone, recopié de la carte depuis le 22 octobre :
#
#   data/carte.json  →  data/zones.json   (niveau, description, image)
#
# `zones.py --verifier` relit la recopie ET vérifie que chaque photo
# existe vraiment dans `assets/zones/` : l'adresse est absolue et pointe
# sur GitHub Pages, donc une faute de frappe ne se verrait qu'en ligne.
#
# Les trois scripts savent se vérifier sans réseau. C'est le même
# principe que la règle 9 pour l'index des espèces : une donnée dérivée
# qu'on ne vérifie pas est une donnée qui finit par mentir.
#
# `pokedex-ids.py --verifier` est le plus utile des trois : il refuse un
# nom sans identifiant ET deux noms sur le même identifiant. C'est ce
# second contrôle qui a trouvé « Lougaroc Crépusculaire » à 745, qui est
# Lougaroc Diurne — deux espèces du Pokédex sur une seule ligne.
if ! command -v python3 >/dev/null 2>&1; then
  echo "   python3 absent du PATH — chaîne du Pokédex non vérifiée"
else
  # ET DEPUIS LE 4 NOVEMBRE, UNE PAGE DÉRIVÉE, pas seulement un JSON :
  #
  #   carte.json + les 17 faune/*.json + butin.json
  #               →  pages/annexe-06-la-region-et-ses-zones.html
  #   personnages.json + arenes.json
  #               →  pages/annexe-11-celebrites-de-rhode.html
  #   credits.json →  pages/annexe-09-credits.html
  #
  # Les crédits portent des NOMS DE PERSONNES, et un nom mal écrit se
  # corrige à un seul endroit ou jamais.
  #
  # Pour l'annexe 11, la raison tient en une ligne : LES ONZE CHAMPIONS
  # SONT LES ONZE ARÈNES. Écrits une seconde fois à la main dans une
  # page, ils auraient dérivé au premier renommage — c'est exactement ce
  # que la règle 24 empêche pour les badges.
  #
  # Elle porte les dix-sept zones, leurs niveaux, leur compte d'espèces
  # et, dans son repli sans JavaScript, les 933 noms. Une table de faune
  # qui bouge sans que la page suive, et la page ment — sans casser.
  # C'est exactement le cas que la règle 9 décrit pour l'index des
  # espèces, appliqué à du HTML.
  for outil in pokedex-de-rhode pokedex-ids faune-par-zone butin zones pokedex-carnet \
               minifier-le-code annexe-contexte annexe-carte annexe-arenes annexe-personnages \
               annexe-credits \
               equipes-de-champions hors-nature; do
    if ! python3 "outils/$outil.py" --verifier; then
      gronde "outils/$outil.py --verifier refuse : un fichier dérivé a été modifié à la main"
    fi
  done

  # ET LES COPIES À COLLER, qui sont dérivées elles aussi.
  #
  # TROUVÉ LE 4 NOVEMBRE, en ajoutant la région de Rhode au carnet :
  # `pages/carnet.html` modifié, `pages/carnet.a-publier.html` resté
  # tel quel, et rien ne l'a dit. C'est la copie qu'on colle dans le
  # panneau — donc celle qui part en ligne.
  #
  # SEULEMENT LES COPIES SUIVIES PAR GIT. Celles des gabarits
  # (`templates/*.a-publier.html`) sont ignorées par `.gitignore` : ce
  # sont des fichiers de travail, elles n'existent pas chez tout le
  # monde, et crier dessus rendrait le garde-fou rouge en permanence —
  # un rouge permanent est un rouge qu'on cesse de lire (règle 8).
  if command -v deno >/dev/null 2>&1; then
    for gabarit in pages/carnet.html; do
      if [ -f "${gabarit%.html}.a-publier.html" ]; then
        if ! deno run -A outils/a-publier.mjs "$gabarit" --verifier; then
          gronde "la copie à coller de $gabarit ne suit plus sa source"
        fi
      fi
    done
  else
    echo "   deno absent du PATH — les copies à coller non vérifiées"
  fi
fi

echo "── 24. le code à coller et data/arenes.json disent les mêmes badges ─"
# LES DEUX LISTES EXISTENT, ET C'EST VOULU. Le code collé dans un
# message doit être lisible AVANT que notre script tourne : il porte
# donc ses onze cases en dur, dans l'ordre imposé. `data/arenes.json`
# est la liste que le script lit pour savoir laquelle est gagnée.
#
# Deux listes, donc deux occasions de dériver — et la dérive serait
# silencieuse : un badge obtenu ne retrouverait pas sa case, et la
# carte dirait « non obtenu » sur une arène gagnée. Ici on vérifie
# qu'elles portent les mêmes slugs, dans le même ordre.
if ! command -v python3 >/dev/null 2>&1; then
  echo "   python3 absent du PATH — les deux listes de badges non comparées"
else
  if ! python3 - <<'PY'
import json, re, sys
from pathlib import Path
gabarit = Path("templates/carte-dresseur.a-coller.html").read_text(encoding="utf-8")
colles = re.findall(r'data-wm-badge="([a-z]+)"', gabarit)
fichier = [a["slug"] for a in json.loads(
    Path("data/arenes.json").read_text(encoding="utf-8"))["arenes"]]
if colles != fichier:
    print(f"   collé  : {colles}")
    print(f"   fichier: {fichier}")
    sys.exit(1)
print(f"   badges : {len(colles)} slugs, mêmes noms et même ordre des deux côtés")
PY
  then
    gronde "le code à coller et data/arenes.json ne listent pas les mêmes badges"
  fi
fi

echo "── 25. chaque espèce du Pokédex a un sprite ────────────────────"
# TROUVÉ EN BRANCHANT L'ANNEXE DE LA CARTE, le 4 novembre.
#
# `data/sprites-couverture.json` a été écrit quand les dix-sept tables
# portaient 734 espèces. Elles en portent 933 depuis que le Pokédex de
# Rhode a été réparti par zone, et `outils/sprites.py` n'a pas été
# rejoué : DEUX CENT DIX espèces n'ont donc aucune image, dans aucun
# des trois styles.
#
# Ça ne casse rien — la page laisse une case vide plutôt qu'une image
# morte — et c'est exactement pour ça que personne ne l'avait vu.
#
# LA DETTE EST CHIFFRÉE ICI, ET ELLE NE DOIT PAS GROSSIR. Faire échouer
# le garde-fou pour un manque qui se répare avec le réseau et Pillow —
# donc sur le Mac, pas ici — rendrait le rouge permanent, et un rouge
# permanent est un rouge qu'on cesse de lire (voir la règle 8). On
# compte, on compare, et on refuse que ça empire.
#
# SOLDÉE LE 4 NOVEMBRE : `python3 outils/sprites.py` puis
# `--style gba-ds` ont ramené les trois styles à 933 sur 933, et le
# chiffre est passé à zéro. Il ne doit plus remonter : une espèce
# ajoutée à une table sans repasser l'outil fera crier cette règle.
#
# La même passe cartographie les vignettes d'objet, qui sont déjà des
# png fixes chez PokeAPI : on ne les recopie pas, on note lesquelles
# existent. `sweet-apple` n'en a pas au commit épinglé.
DETTE_SPRITES=0
if ! command -v python3 >/dev/null 2>&1; then
  echo "   python3 absent du PATH — couverture des sprites non vérifiée"
else
  if ! python3 - "$DETTE_SPRITES" <<'PY'
import glob, json, sys
from pathlib import Path
dette = int(sys.argv[1])
couverture = json.loads(Path("data/sprites-couverture.json").read_text(encoding="utf-8"))
styles = couverture["styles"]
especes = set()
for f in glob.glob("data/faune/*.json"):
    d = json.loads(Path(f).read_text(encoding="utf-8"))
    for table in d["conditions"].values():
        for e in table:
            especes.add(str(e["espece"]))
#  ── ET CELLES QU'AUCUNE ZONE NE PORTE ──────────────────────────────
#
#  CETTE RÈGLE A RATÉ LE 6 NOVEMBRE, et pour la raison qu'elle était
#  censée attraper. Elle ne comptait que les tables de faune, comme
#  `outils/sprites.py` lui-même : les onze lignées fossiles et les
#  cinquante formes régionales n'entrent dans aucune zone, donc ni
#  l'outil ni la règle ne les voyaient. Six des soixante-six pokémon
#  des équipes de champion rendaient une boîte vide — Rexillius,
#  Aéroptéryx, Charkos, Dragmara, Armaldo, Feunard d'Alola —, l'onglet
#  des brèches et l'annexe des fossiles avaient le même trou, et la
#  dette affichait zéro.
#
#  Une règle qui dérive sa liste de la même source que l'outil qu'elle
#  surveille ne surveille rien. Elle lit donc maintenant le Pokédex :
#  les tables PLUS `data/hors-nature.json`, ce que la règle 32 vérifie
#  par ailleurs.
for e in json.loads(Path("data/hors-nature.json").read_text(encoding="utf-8"))["especes"]:
    especes.add(str(e["id"]))
#  LES TROIS STYLES, pas seulement celui par défaut : un joueur qui a
#  choisi « retro » doit voir les mêmes espèces que les autres.
manques = {s: sorted(especes - set(v["especes"]), key=int) for s, v in styles.items()}
pire = max(len(m) for m in manques.values())
if pire > dette:
    for s, m in manques.items():
        print(f"   {s:8} {len(m)} espèce(s) sans sprite — ex. {m[:6]}")
    print(f"   la dette était de {dette}, elle est de {pire}")
    sys.exit(1)
objets = couverture.get("objets", {})
absents = objets.get("manquants", [])
mot_objets = (
    f"les {len(objets.get('slugs', []))} objets ont leur vignette"
    if not absents
    else f"{len(absents)} objet(s) sans vignette : {absents}"
)

if pire == 0:
    print(f"   sprites : les {len(especes)} espèces ont une image dans les "
          f"{len(styles)} styles · {mot_objets}")
elif pire < dette:
    print(f"   sprites : {pire} sans image, la dette baisse (elle était de {dette}) — "
          f"mets DETTE_SPRITES à {pire} dans outils/garde-fou.sh")
else:
    print(f"   sprites : {len(especes)} espèces dans les tables, {pire} sans image "
          f"— dette inchangée, à solder avec « python3 outils/sprites.py »")
PY
  then
    gronde "des espèces de plus n'ont pas de sprite — relance « python3 outils/sprites.py »"
  fi
fi

echo "── 26. la région de Rhode se dit pareil des deux côtés ─────────"
# LE TEXTE DE RHODE EXISTE À DEUX ENDROITS, et c'est voulu.
#
# L'annexe 06 le porte en entier, généré depuis `data/region.json`.
# Le carnet, lui, n'est PAS généré — c'est une page écrite à la main —
# et son onglet « Mon Pokédex » en reprend deux paragraphes : le
# climat, et le naufrage du S.S Libra d'où viennent les pokémon
# sauvages de Rhode.
#
# Deux copies, donc une occasion de dériver, et la dérive serait
# muette : on lirait deux versions de la même histoire sans que rien
# ne proteste. Ici on vérifie que les paragraphes désignés par
# `pourLePokedex` sont bien dans la page du carnet, mot pour mot — au
# pliage près, puisque la page va à la ligne où elle veut.
if ! command -v python3 >/dev/null 2>&1; then
  echo "   python3 absent du PATH — le texte de Rhode non comparé"
else
  if ! python3 - <<'PY'
import html, json, re, sys
from pathlib import Path

region = json.loads(Path("data/region.json").read_text(encoding="utf-8"))
page = re.sub(r"\s+", " ", html.unescape(
    Path("pages/carnet.html").read_text(encoding="utf-8")))

manquants = []
for i in region["pourLePokedex"]:
    texte = re.sub(r"\s+", " ", region["presentation"][i]).strip()
    if texte not in page:
        manquants.append((i, texte))

if manquants:
    for i, texte in manquants:
        print(f"   paragraphe {i} de data/region.json absent de pages/carnet.html :")
        print(f"      « {texte[:88]}… »")
    sys.exit(1)

print(f"   région : {len(region['pourLePokedex'])} paragraphe(s) du texte de Rhode "
      "repris dans le carnet, mot pour mot")
PY
  then
    gronde "le texte de Rhode du carnet ne dit plus ce que data/region.json dit"
  fi
fi

echo "── 27. aucune adresse de page écrite à côté du sommaire ───────"
# TROUVÉ LE 4 NOVEMBRE, ET C'EST LA PANNE LA PLUS SILENCIEUSE DU LOT.
#
# Forumactif ne route QUE sur le numéro : `/h5-guide-du-dresseur` sert
# la page de la RÉGION, parce que le slug est décoratif. Une adresse
# dont le numéro a glissé ne tombe donc pas en 404 — elle mène
# simplement ailleurs, et seul quelqu'un qui clique s'en aperçoit.
#
# Ce jour-là, « créer son personnage » s'est repliée dans « par où
# commencer », les douze pages suivantes ont reculé d'un cran sur le
# forum, et QUATRE adresses écrites hors du sommaire pointaient
# ailleurs : la carte du menu de navigation, le renvoi des célébrités
# vers les arènes, celui du carnet vers la région, et le lien « où »
# d'une fiche d'espèce — qui visait `/h9-la-carte-de-rhode`, une page
# de la V1 disparue depuis des semaines.
#
# `data/annexes.json` est le sommaire, donc la source. Toute autre
# mention d'un `/hN-slug` doit dire la même chose que lui, ou être une
# page qui n'est pas une annexe — le carnet, en `h15`.
if ! command -v python3 >/dev/null 2>&1; then
  echo "   python3 absent du PATH — les adresses de page non comparées"
else
  if ! python3 - <<'PY'
import json, re, sys
from pathlib import Path

sommaire = json.loads(Path("data/annexes.json").read_text(encoding="utf-8"))
par_numero = {}
for s in sommaire["sections"]:
    for e in s["entrees"]:
        if e["adresse"]:
            m = re.fullmatch(r"/h(\d+)-([a-z0-9-]*)", e["adresse"])
            if m is None:
                print(f"   adresse mal formée dans data/annexes.json : {e['adresse']}")
                sys.exit(1)
            par_numero[m.group(1)] = m.group(2)

#  LES PAGES QUI NE SONT PAS DES ANNEXES. Elles vivent sur le même
#  forum et portent le même genre d'adresse ; les lister ici est plus
#  honnête que d'exempter un fichier entier.
AUTRES = {"15": "mon-carnet"}
connues = {**par_numero, **AUTRES}

#  Les fichiers où un `/hN-` est un EXEMPLE et pas une adresse : les
#  tests du lecteur de sommaire, et les harnais qui servent une page
#  sous une adresse fabriquée.
EXEMPTS = {
    #  Le module qui LIT ces adresses, et ses tests : leurs commentaires
    #  et leurs cas sont pleins de `/h20-le-reglement` et de `/h20-x`,
    #  qui sont des exemples de forme, pas des liens.
    "src/navigateur/annexes.ts",
    "src/navigateur/annexes.test.ts",
    #  Le harnais de contraste sert chaque page sous une adresse
    #  fabriquée, pour éprouver justement la lecture du slug.
    "outils/contraste.mjs",
    "outils/garde-fou.sh",
}

fautes = []
racines = ["src", "js", "outils", "data", "pages", "templates", "panneau-admin"]
for racine in racines:
    for f in sorted(Path(racine).rglob("*")):
        if not f.is_file() or f.suffix not in {
            ".ts", ".js", ".mjs", ".py", ".json", ".html", ".css", ".sh", ".md"
        }:
            continue
        if str(f) in EXEMPTS or "__pycache__" in str(f):
            continue
        texte = f.read_text(encoding="utf-8", errors="ignore")
        for m in re.finditer(r"/h(\d+)-([a-z0-9-]+)", texte):
            numero, slug = m.group(1), m.group(2)
            attendu = connues.get(numero)
            if attendu is None:
                fautes.append(f"{f}: /h{numero}-{slug} — aucune page de ce numéro")
            elif attendu != slug:
                fautes.append(
                    f"{f}: /h{numero}-{slug} — h{numero} est « {attendu} »"
                )

if fautes:
    for faute in sorted(set(fautes))[:12]:
        print(f"   {faute}")
    sys.exit(1)

print(f"   adresses : {len(par_numero)} annexes au sommaire, toutes les mentions "
      "du dépôt d'accord avec lui")
PY
  then
    gronde "une adresse de page ne dit pas la même chose que data/annexes.json"
  fi
fi

echo "── 28. les numéros du dex disent la même chose que le Pokédex ─"
# POSÉE LE 5 NOVEMBRE, avec `data/dex-numeros.json`.
#
# « Affiche le numéro du pokémon » : celui de Rhode, de 1 à 933, le même
# que sur les cases du carnet. Les tables de faune ne portent que
# l'identifiant national — 757 pour Tritox, 10115 pour Ossatueur
# d'Alola, qui n'est pas un numéro de dex.
#
# `data/pokedex-carnet.json` DÉCIDE de l'ordre et des rangs ;
# `data/dex-numeros.json` les recopie, en quinze kilo-octets au lieu de
# cent cinquante. Deux fichiers pour la même numérotation : si l'un
# bouge sans l'autre, le joueur voit deux numéros pour un même pokémon
# — celui de l'annexe et celui de son carnet — et rien ne crie.
#
# `--verifier` RECONSTRUIT LE FICHIER EN MÉMOIRE et le compare. Il ne
# relit pas sa propre sortie : c'est la source qui tranche.
if ! command -v python3 >/dev/null 2>&1; then
  echo "   python3 absent du PATH — les numéros du dex non comparés"
else
  if ! python3 -I outils/dex-numeros.py --verifier >/dev/null 2>&1; then
    gronde "data/dex-numeros.json ne correspond plus à data/pokedex-carnet.json"
  else
    echo "   numéros : les 933 rangs d'accord avec data/pokedex-carnet.json"
  fi
fi

echo "── 29. les clés d'onglet et les icônes ────────────────────────"
# DEUX FONCTIONS `slug()` POUR LA MÊME CLÉ, dans deux langages.
#
# `outils/annexe-carte.py` écrit `data-wm-sous-onglet="les-courses-gpr1"`
# dans la page ; `src/navigateur/sous-onglets.ts` compare cette clé à ce
# que porte l'adresse, et c'est lui qui décide quel onglet s'ouvre. Si
# les deux ne s'accordent pas, un lien « #les-courses-gpr1 » n'ouvre
# rien — et rien ne crie, l'onglet se rabat simplement sur le premier.
#
# On ne compare pas les deux CODES, on les fait tourner sur les vrais
# noms d'évènements : c'est la seule comparaison qui vaille.
#
# ET LES ICÔNES. Chaque évènement nomme un dessin de `outils/dessins.py`.
# Un nom inconnu rend une chaîne vide — la page s'écrit quand même, et
# l'onglet sort sans icône. C'est ici que ça doit se voir.
if ! command -v python3 >/dev/null 2>&1 || ! command -v deno >/dev/null 2>&1; then
  echo "   python3 ou deno absent du PATH — clés et icônes non comparées"
else
  attendues=$(python3 -I - <<'PY'
import json, pathlib, sys
sys.path.insert(0, "outils")
from annexes import slug          # noqa: E402
region = json.loads(pathlib.Path("data/region.json").read_text(encoding="utf-8"))
for b in region["evenements"]["blocs"]:
    print(f'{b["nom"]}\t{slug(b["nom"])}\t{b.get("icone", "")}')
PY
) || attendues=""

  if [ -z "$attendues" ]; then
    gronde "les clés d'onglet n'ont pas pu être calculées côté Python"
  else
    #  LE MÊME CALCUL, CÔTÉ TYPESCRIPT, sur les mêmes noms.
    vues=$(printf '%s\n' "$attendues" | cut -f1 | deno eval --ext=ts '
      import { slug } from "./src/navigateur/sous-onglets.ts";
      const dedans = new TextDecoder().decode(
        await new Response(Deno.stdin.readable).arrayBuffer(),
      );
      for (const n of dedans.split("\n")) {
        if (n.trim() !== "") console.log(slug(n));
      }
    ' 2>/dev/null) || vues=""

    if [ "$(printf '%s\n' "$attendues" | cut -f2)" != "$vues" ]; then
      gronde "slug() ne dit pas la même chose en Python et en TypeScript"
      printf '%s\n' "$attendues" | cut -f2 | head -4 | sed 's/^/   python : /'
      printf '%s\n' "$vues" | head -4 | sed 's/^/   deno   : /'
    else
      n=$(printf '%s\n' "$attendues" | wc -l | tr -d " ")
      echo "   clés : les $n évènements ont la même clé des deux côtés"
    fi

    #  LES ICÔNES, ET QU'ELLES ARRIVENT DANS LA PAGE.
    if ! python3 -I - <<'TS'
import json, pathlib, sys
sys.path.insert(0, "outils")
from dessins import noms
region = json.loads(pathlib.Path("data/region.json").read_text(encoding="utf-8"))
page = pathlib.Path("pages/annexe-05-la-region-et-ses-zones.html").read_text(encoding="utf-8")
connus = set(noms())
fautes = []
for b in region["evenements"]["blocs"]:
    i = b.get("icone", "")
    if i not in connus:
        fautes.append(f"{b['nom']} : icône « {i} » inconnue de outils/dessins.py")
#  ET DANS LA PAGE : un `<svg class="wm-onglet__icone">` par évènement.
combien = page.count('class="wm-onglet__icone"')
if combien != len(region["evenements"]["blocs"]):
    fautes.append(
        f"{combien} icône(s) dans la page pour "
        f"{len(region['evenements']['blocs'])} évènement(s)"
    )
if fautes:
    for f in fautes:
        print(f"   {f}")
    sys.exit(1)
print(f"   icônes : {len(connus)} dessins, les "
      f"{len(region['evenements']['blocs'])} évènements en portent un, et la page aussi")
TS
    then
      gronde "une icône d'évènement manque ou n'existe pas"
    fi
  fi
fi

echo "── 30. les niveaux, les paliers et les adresses des onze défis ─"
# TROIS CHAMPS ARRIVÉS LE 6 NOVEMBRE, et aucun n'était gardé.
#
# `niveau` décide désormais l'ORDRE DES ONZE DÉFIS : deux arènes au
# même niveau, et l'ordre devient celui du hasard du tri. `palier` dit
# à quel palier le défi s'ouvre, et il vient de la planche 36 — pas
# des niveaux, voir plus bas.
#
# `forum` est l'adresse du forum du défi, relevée sur l'index. Et
# FORUMACTIF NE ROUTE QUE SUR LE NUMÉRO : une adresse dont le numéro a
# glissé ne tombe pas en 404, elle mène ailleurs en silence. C'est ce
# qui est arrivé le 5 novembre à `/h7-arenes-colosseums-ligues`, qui
# sert « Annexe 08 · Les groupes ». On ne peut pas vérifier le numéro
# sans réseau, mais on peut vérifier que la FIN de l'adresse est bien
# le nom de l'arène : c'est ce qui attrape la ligne recopiée de travers.
if ! command -v python3 >/dev/null 2>&1; then
  echo "   python3 absent du PATH — les onze défis non vérifiés"
else
  if ! python3 - <<'PY'
import json, re, sys
from pathlib import Path
sys.path.insert(0, "outils")
from annexes import slug

d = json.loads(Path("data/arenes.json").read_text(encoding="utf-8"))
arenes, ligue = d["arenes"], d["ligue"]
fautes = []

#  Les onze niveaux sont distincts — sinon il n'y a plus d'ordre.
niveaux = [a["niveau"] for a in arenes]
for n in sorted(set(niveaux)):
    if niveaux.count(n) > 1:
        qui = ", ".join(a["nom"] for a in arenes if a["niveau"] == n)
        fautes.append(f"niveau {n} porté par deux défis : {qui}")

#  ── LES PALIERS : CINQ ET SIX, ET AUCUN AU TROISIÈME ─────────────
#
#  CETTE RÈGLE A DIT UNE CHOSE FAUSSE PENDANT UN JOUR. Elle vérifiait
#  qu'un palier ne redescend jamais quand le niveau monte — ce qui
#  n'était pas une règle du jeu mais MA déduction du 6 novembre, tirée
#  des trois groupes de niveaux que Callista avait séparés.
#
#  La planche 36, elle, NOMME les défis de chaque palier, et elle dit
#  autre chose : le Colosseum de Rhode (niveau 40) s'ouvre au palier 1
#  à côté de l'Arène Eau (niveau 10), et le Colosseum de Targare
#  (niveau 18) attend le palier 2. La planche est de Callista ; ma
#  déduction ne l'était pas. Elle a donc perdu, et avec elle la
#  monotonie — voir `_palier_contradiction` dans `data/arenes.json`,
#  qui garde l'arbitrage en attente.
#
#  CE QUI RESTE VÉRIFIABLE est le COMPTE : la planche met cinq défis
#  au palier 1, six au palier 2, et AUCUN au palier 3, où il n'y a que
#  la Ligue. Un palier recopié de travers déplace un défi d'une liste à
#  l'autre, donc change les deux comptes — ce que la monotonie, elle,
#  ne voyait pas toujours.
compte = {1: 0, 2: 0, 3: 0}
for a in arenes:
    if a["palier"] not in compte:
        fautes.append(f"{a['nom']} : palier {a['palier']} — attendu 1, 2 ou 3")
    else:
        compte[a["palier"]] += 1
if compte != {1: 5, 2: 6, 3: 0}:
    fautes.append(
        f"les paliers comptent {compte[1]}/{compte[2]}/{compte[3]} défis "
        "là où la planche 36 en met 5 au palier 1, 6 au palier 2 et aucun "
        "au palier 3 — un défi a changé de liste"
    )

#  LA LIGUE EST AU-DESSUS DES ONZE. Elle est le dernier défi : un
#  niveau sous une arène ferait une Ligue qu'on bat avant son arène.
if ligue["niveau"] <= max(niveaux):
    fautes.append(
        f"la Ligue est à {ligue['niveau']}, sous ou à égalité avec "
        f"{max(niveaux)} — elle est le dernier défi"
    )

#  L'adresse : `/f<numéro>-<nom de l'arène>`, numéros distincts.
vus = {}
for a in arenes:
    m = re.fullmatch(r"/f(\d+)-([a-z0-9-]+)", a["forum"])
    if m is None:
        fautes.append(f"{a['nom']} : adresse « {a['forum']} » hors de la forme /fN-nom")
        continue
    numero, fin = m.group(1), m.group(2)
    attendu = slug(a["nom"])
    if fin != attendu:
        fautes.append(
            f"{a['nom']} : l'adresse finit par « {fin} » là où le nom donne "
            f"« {attendu} » — adresse recopiée sur la mauvaise ligne ?"
        )
    if numero in vus:
        fautes.append(f"le forum f{numero} est écrit deux fois : {vus[numero]} et {a['nom']}")
    vus[numero] = a["nom"]

if fautes:
    for f in fautes:
        print(f"   {f}")
    sys.exit(1)
print(f"   défis : {len(arenes)} niveaux distincts, "
      f"paliers {compte[1]}/{compte[2]}/{compte[3]} comme la planche 36, "
      f"Ligue à {ligue['niveau']}, {len(vus)} adresses de forum bien formées")
PY
  then
    gronde "les niveaux, les paliers ou les adresses des onze défis ne tiennent pas"
  fi
fi

echo "── 32. les espèces hors nature ────────────────────────────────"
# LE TROU DU 6 NOVEMBRE, ET CE QUI L'AVAIT CACHÉ.
#
# Le Pokédex a été bâti sur les dix-sept tables de rencontre : une
# espèce y entrait parce qu'une zone la portait. Vingt-deux n'y sont
# donc jamais entrées — les onze lignées fossiles et Feunard d'Alola —
# et RIEN NE LE DISAIT, parce que rien ne comparait le Pokédex à ce
# qu'on peut obtenir ailleurs. Les champions d'arène jouaient Armaldo,
# Charkos et Rexillius, qui n'existaient nulle part dans le dépôt.
#
# Depuis, les formes régionales sont sorties des zones elles aussi :
# elles passent par une brèche interdimensionnelle. Elles sont donc au
# Pokédex SANS zone, comme les fossiles.
#
# On vérifie les trois accords qui se défont en silence.
if ! command -v python3 >/dev/null 2>&1; then
  echo "   python3 absent du PATH — espèces hors nature non vérifiées"
else
  if ! python3 - <<'PY'
import json, sys
from pathlib import Path

lire = lambda n: json.loads(Path("data", n).read_text(encoding="utf-8"))
hors = {e["id"]: e for e in lire("hors-nature.json")["especes"]}
dex = lire("pokedex-carnet.json")["especes"]
fossiles = lire("fossiles.json")["fossiles"]
fautes = []

#  1 · TOUT CE QUI EST HORS NATURE EST AU POKÉDEX, et sans zone.
au_dex = {e["id"]: e for e in dex}
for i, e in hors.items():
    d = au_dex.get(i)
    if d is None:
        fautes.append(f"{e['nom']} est hors nature mais pas au Pokédex")
    elif d["zone"] is not None:
        fautes.append(f"{e['nom']} est hors nature et porte pourtant la zone {d['zone']}")

#  2 · TOUTE ESPÈCE SANS ZONE DIT D'OÙ ELLE VIENT. Sans ça, la fiche
#      du carnet affiche « on ne sait pas encore ».
for e in dex:
    if e["zone"] is None and not e.get("origine"):
        fautes.append(f"{e['nom']} n'a ni zone ni origine")
    if e["zone"] is not None and e.get("origine"):
        fautes.append(f"{e['nom']} a une zone ET une origine — l'une des deux ment")

#  3 · AUCUNE ESPÈCE DE FOSSILE N'EST OUBLIÉE, et sa lignée est
#      entière : c'est le trou d'origine, celui qui laissait Armaldo
#      dehors pendant qu'Anorith était dedans.
bases = {f["especeId"] for f in fossiles}
portees = {e["id"] for e in hors.values() if e["origine"] == "fossile"}
if portees != bases:
    fautes.append(f"fossiles.json et hors-nature.json ne portent pas les mêmes espèces : "
                  f"{sorted(bases ^ portees)}")
for e in hors.values():
    if e["origine"] == "evolution" and e.get("de") not in hors:
        fautes.append(f"{e['nom']} évolue d'une espèce qui n'est pas hors nature")

#  4 · ET RIEN DE CE QUI PASSE PAR UNE BRÈCHE NE TRAÎNE DANS UNE TABLE.
#
#      ON COMPARE AUX BRÈCHES, PAS À « identifiant > 10000 ». Ce
#      raccourci prenait Plumeline Pom-Pom et Lougaroc Nocturne, qui
#      sont des formes ALTERNATIVES et non régionales — on les obtient
#      à Alola même — et il ratait Darumacho de Galar, dont
#      l'identifiant PokéAPI ne finit pas par « -galar ».
par_breche = {e["id"] for e in hors.values() if e["origine"] == "breche"}
restes = []
for f in sorted(Path("data/faune").glob("*.json")):
    z = json.loads(f.read_text(encoding="utf-8"))
    for table in z["conditions"].values():
        for ligne in table:
            if ligne["espece"] in par_breche:
                restes.append(f"{ligne['nom']} dans {z['zone']}")
if restes:
    fautes.append(f"{len(restes)} espèce(s) de brèche encore dans une table : {restes[:3]}")

if fautes:
    for f in fautes[:12]:
        print(f"   {f}")
    sys.exit(1)
sauvages = sum(1 for e in dex if e["zone"] is not None)
print(f"   hors nature : {len(dex)} espèces au Pokédex — {sauvages} dans les zones, "
      f"{len(hors)} ailleurs, toutes rattachées")
PY
  then
    gronde "les espèces hors nature et le Pokédex ne disent plus la même chose"
  fi
fi

echo "── 31. les outils s'importent encore les uns les autres ───────"
# CETTE RÈGLE EXISTE PARCE QUE J'AI DÉTRUIT UN FICHIER.
#
# Le 5 novembre, le commit 8bca5e5 a écrasé `outils/icones.py` — 332
# lignes qui fabriquaient les pastilles de type et les onze badges,
# et qui portaient `LES_SEPT_ARENES` et `LES_QUATRE_COLOSSEUMS` — par
# quatre dessins SVG d'évènement, sous le même nom.
#
# PERSONNE N'A CRIÉ PENDANT DEUX JOURS. `outils/equipe-de-test.py`
# importait deux noms disparus, mais aucune tâche ne le lance, le
# garde-fou ne l'ouvrait pas, et `deno check` ne regarde pas le
# Python. Il a fallu vouloir s'en servir pour le découvrir.
#
# Alors on vérifie ce qui est vérifiable sans rien exécuter : chaque
# `from <voisin> import <noms>` d'un outil doit nommer des choses que
# le voisin définit vraiment. On lit les arbres, on ne lance rien —
# un outil qui télécharge ou qui écrit ne doit pas tourner ici.
if ! command -v python3 >/dev/null 2>&1; then
  echo "   python3 absent du PATH — imports des outils non vérifiés"
else
  if ! python3 - <<'PY'
import ast, pathlib, sys

outils = pathlib.Path("outils")
fichiers = sorted(p for p in outils.glob("*.py") if p.name != "__init__.py")

#  Ce que chaque module définit au premier niveau.
offre = {}
for p in fichiers:
    try:
        arbre = ast.parse(p.read_text(encoding="utf-8"), filename=str(p))
    except SyntaxError as e:
        print(f"   {p} ne se lit pas : ligne {e.lineno}, {e.msg}")
        sys.exit(1)
    noms = set()
    for n in arbre.body:
        if isinstance(n, (ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef)):
            noms.add(n.name)
        elif isinstance(n, ast.Assign):
            for c in n.targets:
                if isinstance(c, ast.Name):
                    noms.add(c.id)
        elif isinstance(n, ast.AnnAssign) and isinstance(n.target, ast.Name):
            noms.add(n.target.id)
        elif isinstance(n, (ast.Import, ast.ImportFrom)):
            for a in n.names:
                noms.add(a.asname or a.name.split(".")[0])
    offre[p.stem] = noms

fautes, liens = [], 0
for p in fichiers:
    arbre = ast.parse(p.read_text(encoding="utf-8"), filename=str(p))
    for n in ast.walk(arbre):
        if not isinstance(n, ast.ImportFrom) or n.level or n.module is None:
            continue
        #  On ne juge que les voisins : le reste, c'est la bibliothèque.
        if n.module not in offre:
            continue
        liens += 1
        for a in n.names:
            if a.name != "*" and a.name not in offre[n.module]:
                fautes.append(
                    f"{p.name} importe « {a.name} » de {n.module}.py, "
                    f"qui ne le définit pas"
                )

if fautes:
    for f in fautes:
        print(f"   {f}")
    sys.exit(1)
print(f"   outils : {len(fichiers)} fichiers, {liens} imports entre voisins, "
      "tous les noms existent")
PY
  then
    gronde "un outil importe un nom qu'un autre ne définit plus"
  fi
fi

echo "── 33. aucune page ne dépasse ce que Forumactif accepte ───────"
# L'ÉDITEUR DE PAGES HTML S'ARRÊTE À 128 000 CARACTÈRES, ET IL REFUSE
# EN SILENCE : la page se recharge, le contenu revient à l'état
# d'avant, aucun message. On ne découvre rien en collant — on découvre
# en relisant la page en ligne trois jours plus tard.
#
# MESURÉ LE 6 NOVEMBRE : l'annexe 06, écrite avec l'indentation du
# reste du gabarit, faisait 143 109 caractères. Soixante-six cases de
# pokémon, dont 33 Ko d'espaces. Elle aurait été collée, refusée, et la
# page en ligne serait restée l'ancienne.
#
# Les générateurs impriment déjà leur taille ; personne ne lit un
# chiffre qui va bien. Ici on la compare, et on garde une MARGE : à
# 120 000, la prochaine zone ou le prochain défi ferait sauter la
# limite sans qu'on l'ait vu venir.
if ! command -v python3 >/dev/null 2>&1; then
  echo "   python3 absent du PATH — la taille des pages non vérifiée"
else
  if ! python3 - <<'PY_TAILLE'
import sys
from pathlib import Path

LIMITE = 128000
#  L'ALERTE EST À 94 % de la limite. Plus haut, on n'a plus le temps
#  d'arbitrer : il faut couper dans la page le jour où on la colle.
ALERTE = 120000

pages = sorted(Path("pages").glob("*.html"))
if not pages:
    print("   aucune page dans pages/ — rien à mesurer")
    sys.exit(0)

trop, limite = [], []
for p in pages:
    n = len(p.read_text(encoding="utf-8"))
    if n > LIMITE:
        trop.append((p.name, n))
    elif n > ALERTE:
        limite.append((p.name, n))

for nom, n in trop:
    print(f"   {nom} : {n} caractères — Forumactif en accepte {LIMITE}, "
          "et il refuse sans le dire")
for nom, n in limite:
    print(f"   {nom} : {n} caractères — sous la limite, mais à moins de "
          f"{LIMITE - ALERTE} du mur")
if trop:
    sys.exit(1)

grosse = max(pages, key=lambda p: len(p.read_text(encoding="utf-8")))
print(f"   pages : {len(pages)} pages, la plus grosse est {grosse.name} "
      f"({len(grosse.read_text(encoding='utf-8'))} caractères sur {LIMITE})")
PY_TAILLE
  then
    gronde "une page dépasse les 128 000 caractères de l'éditeur Forumactif"
  fi
fi

echo "────────────────────────────────────────────────────────────────"
if [ "$fautes" -gt 0 ]; then
  echo "garde-fou : $fautes faute(s)."
  exit 1
fi
echo "garde-fou : rien à signaler."
