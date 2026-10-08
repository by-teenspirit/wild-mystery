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
  # LA SEULE DÉROGATION : les polices embarquées dans `assets/polices`.
  # Elle tient à une propriété du navigateur, pas à une promesse : une
  # police n'est téléchargée que lorsqu'un élément RENDU s'en sert.
  # Décochée, la case « Police pour la dyslexie » ne coûte pas une
  # requête, et le harnais de confort les compte dans les deux états.
  # Tout autre `url(` reste une faute, y compris dans ce fichier-là.
  sans_police=$(perl -0pe 's{url\(\s*"\.\./assets/polices/[^"]+"\s*\)}{}g' <<< "$nu")
  if grep -qE '@import|url\(' <<< "$sans_police"; then
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

echo "────────────────────────────────────────────────────────────────"
if [ "$fautes" -gt 0 ]; then
  echo "garde-fou : $fautes faute(s)."
  exit 1
fi
echo "garde-fou : rien à signaler."
