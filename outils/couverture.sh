#!/usr/bin/env bash
# ════════════════════════════════════════════════════════════════════
#  outils/couverture.sh
#  Le domaine est exigé à 100 % : lignes, fonctions et branches.
#  Pas de seuil chiffré ailleurs — un seuil global pousse à écrire
#  des tests qui ne servent à rien.
# ════════════════════════════════════════════════════════════════════
set -euo pipefail
export NO_COLOR=1

CIBLE='src/domaine/[^.]+\.ts$'

rm -rf .couverture
deno test --coverage=.couverture src/domaine/ > /dev/null
deno coverage .couverture --include="$CIBLE"

# Le tableau de `deno coverage` arrondit. On lit le lcov, qui ne ment pas.
python3 - <<'PY'
import re, sys
fichier, manques = None, []
tot = {"lignes": [0, 0], "fonctions": [0, 0], "branches": [0, 0]}
for ligne in open(".couverture/lcov.info", encoding="utf-8"):
    ligne = ligne.strip()
    if ligne.startswith("SF:"):
        fichier = ligne[3:]
    if not fichier or "/src/domaine/" not in fichier:
        continue
    court = fichier.rsplit("/", 1)[-1]
    if ligne.startswith("DA:"):
        n, hits = ligne[3:].split(",")[:2]
        tot["lignes"][1] += 1
        if int(hits) > 0:
            tot["lignes"][0] += 1
        else:
            manques.append(f"{court}:{n} ligne jamais exécutée")
    elif ligne.startswith("FNDA:"):
        hits, nom = ligne[5:].split(",", 1)
        tot["fonctions"][1] += 1
        if int(hits) > 0:
            tot["fonctions"][0] += 1
        else:
            manques.append(f"{court} fonction « {nom} » jamais appelée")
    elif ligne.startswith("BRDA:"):
        n, _bloc, br, pris = ligne[5:].split(",")
        tot["branches"][1] += 1
        if pris not in ("-", "0"):
            tot["branches"][0] += 1
        else:
            manques.append(f"{court}:{n} branche {br} jamais prise")

for quoi, (ok, sur) in tot.items():
    print(f"  {quoi:<10} {ok}/{sur}")

if manques:
    for m in manques:
        print(f"::error::couverture du domaine : {m}")
    print(f"couverture du domaine incomplète : {len(manques)} trou(s). 100 % exigés.")
    sys.exit(1)
print("couverture du domaine : 100 %.")
PY
