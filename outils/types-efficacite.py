#!/usr/bin/env python3
"""Fabrique `data/types.json` : la table d'efficacité des dix-huit types.

LE NOM DU FICHIER N'EST PAS DÉCORATIF. Il s'est appelé `types.py` une
minute, et Python a refusé de démarrer : `import csv` charge `re`, qui
charge `enum`, qui fait `from types import …` — et c'était CELUI-LÀ
qu'il trouvait. Un outil du dépôt ne porte pas le nom d'un module de
la bibliothèque standard.

POURQUOI CE FICHIER N'EXISTAIT PAS, ET POURQUOI IL EXISTE MAINTENANT
────────────────────────────────────────────────────────────────────
La table était déjà calculée — dans `outils/equipes-de-champions.py`,
pour choisir le type conseillé contre une équipe d'arène. Elle y vit
en mémoire, le temps d'un passage, et elle n'est versée nulle part.

Le combat en a besoin AILLEURS : dans le domaine TypeScript, qui
résout un tour sans réseau et sans CSV. Recalculer la même chose dans
un deuxième langage, c'est deux tables qui finiront par ne plus dire
la même chose — et le jour où ça arrivera, l'annexe 12 affichera une
maîtrise des types que le combat ne respecte pas.

Un seul fichier, dérivé une fois, lu par les deux.

CE QU'ON GARDE, ET CE QU'ON JETTE
──────────────────────────────────
On ne garde QUE les facteurs qui ne valent pas 1. Les dix-huit types
font 324 paires ; 258 d'entre elles sont neutres et ne disent rien.
Un fichier de 324 lignes dont 258 portent « 1 » est un fichier qu'on
ne relit jamais — et celui qui le relirait ne verrait pas la ligne qui
compte.

`efficacite["feu"]["plante"] = 2` se lit donc « le feu fait double
contre la plante », et une paire absente vaut 1.

LES TYPES SONT EN FRANÇAIS, ET À PLAT
──────────────────────────────────────
Même convention que partout ailleurs dans le dépôt — bas de casse,
sans accent, `clef()` de `especes-sql.py` : `data/especes-fiches.json`
range « electrik », et une table qui dirait « électrik » ne
joindrait sur rien.

ON LAISSE DEHORS `stellar` ET `unknown` : deux types techniques de
PokéAPI qu'aucun Pokémon de Rhode ne porte.
"""

import csv
import json
import pathlib
import sys
import unicodedata

RACINE = pathlib.Path(__file__).resolve().parent.parent
SORTIE = RACINE / "data" / "types.json"
FICHES = RACINE / "data" / "especes-fiches.json"

FRANCAIS = 5
SOURCE = "https://github.com/PokeAPI/pokeapi/tree/master/data/v2/csv"
HORS_JEU = ("stellar", "unknown")


def clef(nom: str) -> str:
    plat = unicodedata.normalize("NFD", nom)
    return "".join(c for c in plat if unicodedata.category(c) != "Mn").lower()


def lire(dossier: pathlib.Path, nom: str) -> list[dict[str, str]]:
    chemin = dossier / nom
    if not chemin.exists():
        raise SystemExit(f"{chemin} manque — télécharge les CSV de {SOURCE}")
    with chemin.open(encoding="utf-8", newline="") as f:
        return list(csv.DictReader(f))


def deriver(dossier: pathlib.Path) -> dict[str, object]:
    noms = {
        l["type_id"]: clef(l["name"])
        for l in lire(dossier, "type_names.csv")
        if l["local_language_id"] == str(FRANCAIS)
    }

    #  Les dix-huit, et eux seuls. Les identifiants au-dessus de 10000
    #  sont les types d'une génération passée (« ombre »).
    jouables = {
        l["id"]: noms[l["id"]]
        for l in lire(dossier, "types.csv")
        if l["identifier"] not in HORS_JEU and int(l["id"]) < 10000
    }

    table: dict[str, dict[str, float]] = {}
    for l in lire(dossier, "type_efficacy.csv"):
        a, d = l["damage_type_id"], l["target_type_id"]
        if a not in jouables or d not in jouables:
            continue
        facteur = int(l["damage_factor"]) / 100
        if facteur != 1.0:
            table.setdefault(jouables[a], {})[jouables[d]] = facteur

    manquants = sorted(set(jouables.values()) - set(table))
    if manquants:
        #  UN TYPE SANS UNE SEULE PAIRE NON NEUTRE N'EXISTE PAS dans ce
        #  jeu : les dix-huit ont tous au moins une faiblesse ou une
        #  résistance. Zéro paire veut dire qu'on a raté la jointure,
        #  pas que le type est équilibré.
        raise SystemExit(f"types sans aucune efficacité : {', '.join(manquants)}")

    #  LES TYPES DU JEU SONT CEUX DES ESPÈCES, pas ceux de PokéAPI. Si
    #  une fiche porte un type que la table ne connaît pas, le combat
    #  le traitera comme neutre en silence — et personne ne le verra
    #  avant qu'un joueur trouve son Dracaufeu inoffensif.
    portes: set[str] = set()
    for f in json.loads(FICHES.read_text())["fiches"].values():
        portes.update(f["types"])
    inconnus = sorted(portes - set(jouables.values()))
    if inconnus:
        raise SystemExit(
            f"types portés par une espèce et absents de la table : {', '.join(inconnus)}"
        )

    return {
        "_": "La table d'efficacité des dix-huit types, dérivée des CSV "
             "de PokéAPI par outils/types.py. NE PAS MODIFIER À LA MAIN.",
        "_lecture": "efficacite[attaque][defenseur] : le multiplicateur. "
                    "Une paire ABSENTE vaut 1 — on ne range que ce qui "
                    "n'est pas neutre, sinon 258 lignes sur 324 ne disent "
                    "rien et masquent les 66 qui comptent.",
        "_noms": "Bas de casse et sans accent, comme data/especes-fiches.json "
                 "(« electrik »). Une table accentuée ne joindrait sur rien.",
        "source": SOURCE,
        "types": sorted(jouables.values()),
        "efficacite": {a: dict(sorted(d.items())) for a, d in sorted(table.items())},
    }


def main() -> int:
    if "--deriver" in sys.argv:
        ou = sys.argv[sys.argv.index("--deriver") + 1]
        table = deriver(pathlib.Path(ou).expanduser())
        SORTIE.write_text(json.dumps(table, ensure_ascii=False, indent=1) + "\n")
        paires = sum(len(d) for d in table["efficacite"].values())  # type: ignore[union-attr]
        print(f"   {SORTIE.relative_to(RACINE)} : 18 types, {paires} paires non neutres")
        return 0

    print(__doc__)
    return 2


if __name__ == "__main__":
    raise SystemExit(main())
