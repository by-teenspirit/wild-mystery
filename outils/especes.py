#!/usr/bin/env python3
"""Fabrique `data/especes.json` à partir des tables de faune.

POURQUOI IL N'Y A PAS DE LISTE ÉCRITE À LA MAIN
────────────────────────────────────────────────
Les fichiers `data/faune/<forumId>.json` portent déjà, pour chaque entrée
de table, l'identifiant de l'espèce ET son nom français. Recopier cette
correspondance dans un second fichier tenu séparément, c'est se garantir
qu'un jour les deux ne diront plus la même chose.

On la DÉRIVE, donc, et le garde-fou vérifie que le fichier livré
correspond aux tables. Si une table change un nom, l'index suit ou le
garde-fou refuse — jamais entre les deux.

CE QU'IL COUVRE, ET CE QU'IL NE COUVRE PAS
───────────────────────────────────────────
**Les 444 espèces qui apparaissent dans une zone sauvage**, pas les 933
du Pokédex de Rhode. C'est exactement ce dont le module de bilan a
besoin : une ligne de registre écrite en zone ne peut nommer qu'une
espèce qui y vit. Les fossiles et ce qui s'obtient ailleurs viendront
avec leur propre source, pas d'ici.

    python3 outils/especes.py            écrit data/especes.json
    python3 outils/especes.py --verifier ne l'écrit pas, rend 1 s'il diffère
"""

import collections
import json
import pathlib
import sys

RACINE = pathlib.Path(__file__).resolve().parent.parent
FAUNE = RACINE / "data" / "faune"
SORTIE = RACINE / "data" / "especes.json"


class NomsEnDesaccord(Exception):
    """Le même identifiant porte deux noms différents selon la table."""


def releve() -> dict[int, str]:
    """La correspondance identifiant → nom, relevée dans toutes les tables.

    Lève si deux tables ne sont pas d'accord : c'est une faute de saisie
    dans la faune, et la taire ferait apparaître un nom au hasard dans un
    bilan.
    """
    vus: dict[int, set[str]] = collections.defaultdict(set)
    for fichier in sorted(FAUNE.glob("*.json")):
        zone = json.loads(fichier.read_text(encoding="utf-8"))
        for conditions in zone["lieux"].values():
            for table in conditions.values():
                for entree in table:
                    vus[entree["espece"]].add(entree["nom"])

    desaccords = {i: sorted(n) for i, n in vus.items() if len(n) > 1}
    if desaccords:
        detail = " · ".join(f"{i} : {', '.join(n)}" for i, n in desaccords.items())
        raise NomsEnDesaccord(detail)

    return {i: next(iter(n)) for i, n in vus.items()}


def contenu(noms: dict[int, str]) -> str:
    """Le fichier, trié par identifiant et lisible par un humain."""
    index = {str(i): noms[i] for i in sorted(noms)}
    corps = {
        "source": "dérivé de data/faune/*.json par outils/especes.py",
        "couverture": "les espèces présentes en zone sauvage, pas le Pokédex complet",
        "especes": index,
    }
    return json.dumps(corps, ensure_ascii=False, indent=2) + "\n"


def main() -> int:
    try:
        noms = releve()
    except NomsEnDesaccord as erreur:
        print(f"especes : noms en désaccord entre deux tables — {erreur}", file=sys.stderr)
        return 1

    attendu = contenu(noms)

    if "--verifier" in sys.argv:
        if not SORTIE.exists():
            print("especes : data/especes.json manque.", file=sys.stderr)
            return 1
        if SORTIE.read_text(encoding="utf-8") != attendu:
            print(
                "especes : data/especes.json ne correspond plus aux tables de faune.\n"
                "          relancer : python3 outils/especes.py",
                file=sys.stderr,
            )
            return 1
        print(f"   data/especes.json : à jour ({len(noms)} espèces)")
        return 0

    SORTIE.write_text(attendu, encoding="utf-8")
    print(f"data/especes.json — {len(noms)} espèces, dérivées de {len(list(FAUNE.glob('*.json')))} tables")
    return 0


if __name__ == "__main__":
    sys.exit(main())
