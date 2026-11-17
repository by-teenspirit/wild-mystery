#!/usr/bin/env python3
"""Fabrique `data/capacites.json` et `data/capacites-par-espece.json`.

POURQUOI CET OUTIL EXISTE
──────────────────────────
17 novembre 2026, Callista tranche la question qui commandait tout le
combat : « Les attaques : oui, les quatre capacités du pokémon. »

Un combat où l'on attaque a besoin de savoir AVEC QUOI. Le dépôt ne le
savait pas : `data/especes-fiches.json` ne porte que les types, le
stade et les PV de base. Il n'y avait nulle part la moindre capacité.

CE QUE CE FICHIER PREND, ET OÙ
───────────────────────────────
Les CSV de PokéAPI, comme `especes-sql.py` : `moves`, `move_names`,
`pokemon_moves`, `types`. Rien n'est inventé de ce qui s'y trouve.

**LE GROUPE DE VERSION EST CHOISI PAR ESPÈCE**, et c'est le seul choix
de méthode qui compte ici. Aucun groupe ne couvre les 955 espèces :
le plus large en couvre 959 au total mais pas les nôtres toutes. On
prend donc, pour CHAQUE espèce, le groupe le plus récent qui lui
connaît des capacités — « la dernière génération qui l'a vue jouer ».
Mesuré : les 955 sont couvertes, médiane de 14 capacités chacune.

CE QU'IL INVENTE, ET QUI EST ÉCRIT ICI PARCE QUE ÇA NE SE DEVINE PAS
─────────────────────────────────────────────────────────────────────
1. **Seules les capacités OFFENSIVES sont retenues.** Le combat de
   Rhode résout des dégâts ; une capacité de statut y serait un bouton
   qui a l'air d'agir et qui n'agit pas — le défaut exact que le
   harnais de la barre d'actions existe pour attraper. Elles
   reviendront le jour où le moteur saura en faire quelque chose.

2. **CHARGE EST LE PLANCHER.** Sept espèces n'ont AUCUNE capacité
   offensive dans leur liste de montée en niveau, et seize n'en ont
   aucune au niveau 5. Un Pokémon qui ne peut pas attaquer ne peut pas
   jouer : celles-là reçoivent Charge, et le fichier le dit espèce par
   espèce (`plancher: true`) plutôt que de le cacher.

3. **La catégorie est GARDÉE mais pas encore lue.** Le combat n'a que
   PV, Attaque et Défense — pas d'attaque spéciale. Physique et
   spéciale frappent donc pareil pour l'instant. On garde l'étiquette :
   la jeter maintenant obligerait à refaire ce fichier le jour où les
   statistiques spéciales arriveront.

CE QU'IL NE FAIT PAS
─────────────────────
Il ne décide PAS les quatre capacités d'un Pokémon : il donne ce qu'une
espèce PEUT apprendre, et à quel niveau. Les quatre d'un Pokémon donné
sont une donnée de jeu, elles vivent en base.

    python3 outils/capacites.py          # depuis /tmp/pa-*.csv
    python3 outils/capacites.py --tirer  # télécharge d'abord
"""

import csv
import json
import sys
import urllib.request
from pathlib import Path

RACINE = Path(__file__).resolve().parent.parent
SOURCE = "https://raw.githubusercontent.com/PokeAPI/pokeapi/master/data/v2/csv"
CSV = Path("/tmp")
TABLES = ("moves", "move_names", "pokemon_moves", "types")

#  Le français est la langue 5 chez PokéAPI.
FRANCAIS = "5"
#  La méthode 1 est « level-up ». Les autres — œuf, tuteur, CT — sont
#  d'autres façons d'apprendre, et aucune n'est encore un geste du jeu.
MONTEE_EN_NIVEAU = "1"
#  Charge, le plancher. 33 chez PokéAPI.
CHARGE = 33

#  PokéAPI nomme les types en anglais ; le dépôt les nomme en français,
#  et c'est `especes-fiches.json` qui fait foi — mêmes dix-huit mots.
TYPES = {
    "normal": "normal", "fighting": "combat", "flying": "vol", "poison": "poison",
    "ground": "sol", "rock": "roche", "bug": "insecte", "ghost": "spectre",
    "steel": "acier", "fire": "feu", "water": "eau", "grass": "plante",
    "electric": "electrik", "psychic": "psy", "ice": "glace", "dragon": "dragon",
    "dark": "tenebres", "fairy": "fee",
}

CATEGORIES = {"1": "statut", "2": "physique", "3": "speciale"}


def tirer() -> None:
    for t in TABLES:
        cible = CSV / f"pa-{t}.csv"
        urllib.request.urlretrieve(f"{SOURCE}/{t}.csv", cible)
        print(f"  {t}.csv : {cible.stat().st_size} octets")


def lire(nom: str) -> list[dict]:
    chemin = CSV / f"pa-{nom}.csv"
    if not chemin.exists():
        sys.exit(f"REFUS : {chemin} manque — relance avec --tirer")
    with chemin.open(encoding="utf-8") as f:
        return list(csv.DictReader(f))


def main() -> None:
    if "--tirer" in sys.argv:
        tirer()

    types = {r["id"]: TYPES.get(r["identifier"]) for r in lire("types")}
    noms = {
        r["move_id"]: r["name"]
        for r in lire("move_names")
        if r["local_language_id"] == FRANCAIS
    }

    #  LES CAPACITÉS OFFENSIVES, et elles seules : voir l'en-tête.
    capacites: dict[int, dict] = {}
    for r in lire("moves"):
        #  « 0 » N'EST PAS VIDE, et c'est le garde-fou qui l'a dit le
        #  premier jour : huit capacités de STATUT portent une
        #  puissance écrite `0` au lieu de vide — Danse Victoire,
        #  Piège de Fil, Habanerage… Un test sur la chaîne les
        #  laissait passer, et elles seraient arrivées en combat comme
        #  des attaques qui ne font rien.
        if not r["power"] or int(r["power"]) <= 0:
            continue
        t = types.get(r["type_id"])
        if t is None:  # le type « stellaire » n'existe pas à Rhode
            continue
        i = int(r["id"])
        capacites[i] = {
            "nom": noms.get(r["id"], r["identifier"]),
            "type": t,
            "puissance": int(r["power"]),
            "pp": int(r["pp"]) if r["pp"] else 0,
            "precision": int(r["accuracy"]) if r["accuracy"] else 100,
            "categorie": CATEGORIES.get(r["damage_class_id"], "physique"),
        }

    fiches = json.loads((RACINE / "data/especes-fiches.json").read_text())["fiches"]
    nos = {int(k) for k in fiches}

    #  Une espèce → toutes ses lignes, tous groupes confondus. On trie
    #  ensuite : le groupe le plus récent gagne, voir l'en-tête.
    brut: dict[int, list[tuple[int, int, int]]] = {}
    for r in lire("pokemon_moves"):
        if r["pokemon_move_method_id"] != MONTEE_EN_NIVEAU:
            continue
        p = int(r["pokemon_id"])
        if p not in nos:
            continue
        brut.setdefault(p, []).append(
            (int(r["version_group_id"]), int(r["move_id"]), int(r["level"]))
        )

    especes: dict[str, dict] = {}
    planchers = 0
    for p in sorted(nos):
        lignes = brut.get(p, [])
        appris: list[dict] = []
        if lignes:
            recent = max(v for v, _, _ in lignes)
            vus = {
                (m, n) for v, m, n in lignes if v == recent and m in capacites
            }
            #  Le niveau 0 chez PokéAPI veut dire « connue d'emblée ».
            appris = [
                {"id": m, "niveau": max(1, n)}
                for m, n in sorted(vus, key=lambda x: (x[1], x[0]))
            ]
        plancher = not appris
        if plancher:
            planchers += 1
            appris = [{"id": CHARGE, "niveau": 1}]
        especes[str(p)] = {"apprend": appris, "plancher": plancher}

    #  LE PLANCHER SERT AUSSI PLUS TARD : une espèce qui n'apprend rien
    #  AVANT son niveau n'a pas de capacité à ce moment-là. La règle
    #  vit avec les données, pas dans le moteur.
    gardees = {str(i) for e in especes.values() for d in e["apprend"] for i in [d["id"]]}
    capacites = {str(i): c for i, c in capacites.items() if str(i) in gardees}

    (RACINE / "data/capacites.json").write_text(
        json.dumps(
            {
                "_": "Les capacités offensives, dérivées des CSV de PokéAPI par "
                "outils/capacites.py. Les capacités de STATUT n'y sont pas : le "
                "combat de Rhode résout des dégâts, et un bouton qui n'agit pas "
                "est un défaut. La catégorie est gardée mais pas encore lue — le "
                "combat n'a que PV, Attaque et Défense.",
                "_cle": "L'identifiant de la capacité chez PokéAPI.",
                "capacites": dict(sorted(capacites.items(), key=lambda x: int(x[0]))),
            },
            ensure_ascii=False,
            indent=1,
        ) + "\n",
        encoding="utf-8",
    )

    (RACINE / "data/capacites-par-espece.json").write_text(
        json.dumps(
            {
                "_": "Ce que chaque espèce APPREND en montant de niveau, et à quel "
                "niveau. Ce n'est pas ce qu'un Pokémon connaît : ses quatre "
                "capacités sont une donnée de jeu et vivent en base.",
                "_groupe": "Le groupe de version est choisi PAR ESPÈCE : le plus "
                "récent qui lui connaît des capacités. Aucun groupe ne les couvre "
                "toutes.",
                "_plancher": "true = l'espèce n'a AUCUNE capacité offensive en "
                "montée de niveau et reçoit Charge. Un Pokémon qui ne peut pas "
                "attaquer ne peut pas jouer.",
                "especes": especes,
            },
            ensure_ascii=False,
            indent=1,
        ) + "\n",
        encoding="utf-8",
    )

    total = sum(len(e["apprend"]) for e in especes.values())
    print(f"capacités : {len(capacites)} offensives retenues")
    print(f"espèces   : {len(especes)}, {total} apprentissages, {planchers} au plancher")


if __name__ == "__main__":
    main()
