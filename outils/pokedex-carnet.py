#!/usr/bin/env python3
"""Range le Pokédex de Rhode en UN fichier que l'onglet du carnet lit.

CE QU'IL ÉCRIT : `data/pokedex-carnet.json` — les 933 espèces de Rhode
dans leur ordre régional, chacune avec son identifiant, ses types, sa
zone, sa fourchette de niveaux et le moment où on la croise.

POURQUOI UN FICHIER DE PLUS, ALORS QUE TOUT EST DÉJÀ DANS LE DÉPÔT
──────────────────────────────────────────────────────────────────
Parce que c'est dans QUATRE fichiers, et que la page en ferait vingt
requêtes :

    data/pokedex-de-rhode.json   l'ordre régional et la zone
    data/pokedex-ids.json        nom → identifiant d'espèce
    data/especes-fiches.json     les types
    data/faune/<forumId>.json    les niveaux et le moment  (17 fichiers)

La note du carnet (Figma 371:688) est formelle : « un seul appel au
chargement », « changer d'onglet ne déclenche aucune requête ». Vingt
`fetch` pour peindre une grille, c'est l'inverse. On les fusionne ici,
une fois, et le CI vérifie que la fusion n'a pas dérivé.

CE QUE LA MESURE A DIT, ET QUI SIMPLIFIE BEAUCOUP
─────────────────────────────────────────────────
Relevé le 2 novembre sur les fichiers eux-mêmes, et pas supposé :

  · **Chaque espèce est dans UNE SEULE zone.** 933 occurrences pour 933
    espèces distinctes, aucune à cheval sur deux paliers. Donc « où »
    est une zone, au singulier, et le numéro de Rhode se lit sans
    ambiguïté : c'est le rang dans l'enchaînement des zones, telles
    qu'elles sont rangées dans la planche 39.
  · **`jour` et `nuit` sont identiques dans les dix-sept tables.**
    `faune-par-zone.py` le dit en en-tête, et les dix-sept le
    confirment. La ligne « QUAND » de la maquette vaut donc partout
    « de jour comme de nuit » — mais on la DÉRIVE quand même au lieu de
    l'écrire en dur, pour que la page dise la vérité le jour où une
    table distinguera les deux.

RIEN N'EST DEVINÉ
─────────────────
Un nom sans identifiant, une espèce sans fiche de types, une zone sans
table de faune : le script s'arrête et le dit. Les trois ont été
mesurés à zéro le 2 novembre ; c'est une garantie à tenir, pas une
constatation à oublier.

    python3 outils/pokedex-carnet.py             écrit le fichier
    python3 outils/pokedex-carnet.py --verifier  rend 1 si le fichier a dérivé
"""

import json
import sys
from pathlib import Path

RACINE = Path(__file__).resolve().parent.parent
SORTIE = RACINE / "data" / "pokedex-carnet.json"


def lire(nom: str):
    return json.loads((RACINE / "data" / nom).read_text(encoding="utf-8"))


def construire() -> dict:
    rhode = lire("pokedex-de-rhode.json")
    ids = lire("pokedex-ids.json")["ids"]
    fiches = lire("especes-fiches.json")["fiches"]

    zones = []
    especes = []
    refus = []

    for z in rhode["zones"]:
        forum = z["forumId"]
        zones.append({"forumId": forum, "nom": z["zone"], "palier": z["palier"]})

        table_fichier = RACINE / "data" / "faune" / f"{forum}.json"
        if not table_fichier.exists():
            refus.append(f"la zone {forum} ({z['zone']}) n'a pas de table de faune")
            continue
        table = json.loads(table_fichier.read_text(encoding="utf-8"))

        #  LES NIVEAUX ET LE MOMENT, LUS DANS LA TABLE DE LA ZONE. Une
        #  espèce peut figurer dans `jour`, dans `nuit`, ou dans les
        #  deux ; on garde la fourchette la plus large des lignes qui
        #  la citent, parce que c'est ce qu'un joueur peut rencontrer.
        par_espece: dict[int, dict] = {}
        for moment in ("jour", "nuit"):
            for ligne in table["conditions"][moment]:
                e = par_espece.setdefault(
                    ligne["espece"],
                    {"min": ligne["min"], "max": ligne["max"], "moments": set()},
                )
                e["min"] = min(e["min"], ligne["min"])
                e["max"] = max(e["max"], ligne["max"])
                e["moments"].add(moment)

        for nom in z["especes"]:
            identifiant = ids.get(nom)
            if identifiant is None:
                refus.append(f"« {nom} » n'a pas d'identifiant dans pokedex-ids.json")
                continue
            fiche = fiches.get(str(identifiant))
            if fiche is None:
                refus.append(f"« {nom} » ({identifiant}) n'a pas de fiche de types")
                continue
            rencontre = par_espece.get(identifiant)
            if rencontre is None:
                refus.append(
                    f"« {nom} » est au Pokédex de la zone {forum} "
                    f"mais pas dans sa table de faune"
                )
                continue

            moments = rencontre["moments"]
            especes.append({
                "no": len(especes) + 1,
                "id": identifiant,
                "nom": nom,
                "types": fiche["types"],
                "zone": forum,
                "min": rencontre["min"],
                "max": rencontre["max"],
                "quand": "les deux" if len(moments) == 2 else next(iter(moments)),
            })

    if refus:
        print(f"REFUS : {len(refus)} problème(s) :", file=sys.stderr)
        for r in refus[:20]:
            print(f"   {r}", file=sys.stderr)
        if len(refus) > 20:
            print(f"   … et {len(refus) - 20} autre(s)", file=sys.stderr)
        raise SystemExit(1)

    return {
        "_": (
            "Les 933 espèces du Pokédex de Rhode, dans leur ordre régional, "
            "avec leur zone, leurs types, leur fourchette de niveaux et le "
            "moment de la rencontre. DÉRIVÉ par outils/pokedex-carnet.py de "
            "pokedex-de-rhode.json, pokedex-ids.json, especes-fiches.json et "
            "des dix-sept tables de data/faune/. Ne pas modifier à la main : "
            "le garde-fou le relit."
        ),
        "_numero": (
            "`no` est le numéro de Rhode : le rang dans l'enchaînement des "
            "zones de la planche 39. Chaque espèce n'étant que dans une "
            "zone, il est sans ambiguïté — mesuré le 2 novembre."
        ),
        "zones": zones,
        "especes": especes,
    }


def main() -> int:
    attendu = json.dumps(construire(), ensure_ascii=False, indent=1) + "\n"

    if "--verifier" in sys.argv:
        if not SORTIE.exists():
            print(f"{SORTIE.name} : absent.", file=sys.stderr)
            return 1
        if SORTIE.read_text(encoding="utf-8") != attendu:
            print(
                f"{SORTIE.name} : ne correspond plus à ses sources — "
                f"relance « python3 outils/pokedex-carnet.py » et commite.",
                file=sys.stderr,
            )
            return 1
        d = json.loads(attendu)
        print(f"{SORTIE.name} : {len(d['especes'])} espèces, {len(d['zones'])} zones, à jour.")
        return 0

    SORTIE.write_text(attendu, encoding="utf-8")
    d = json.loads(attendu)
    print(f"{SORTIE.name} : {len(d['especes'])} espèces sur {len(d['zones'])} zones.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
