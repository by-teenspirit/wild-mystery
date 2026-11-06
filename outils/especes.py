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
**Les espèces qui apparaissent dans une zone sauvage.** Depuis le
15 octobre, ce sont les 933 du Pokédex de Rhode : les dix-sept tables
sont le Pokédex lui-même, réparti par zone. Avant ça elles étaient 734,
et le compte vient du fichier, pas d'ici. C'est exactement ce dont le module de bilan a
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
HORS_NATURE = RACINE / "data" / "hors-nature.json"
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
        #  « conditions » ET PAS « lieux » depuis le 15 octobre : une zone
        #  a une table par condition, et plus une table par lieu et par
        #  condition. Un ancien fichier lève ici plutôt que de rendre un
        #  index incomplet en silence.
        if "lieux" in zone:
            raise NomsEnDesaccord(
                f"{fichier.name} porte encore des « lieux » : c'est un fichier d'avant "
                "le 15 octobre (les anciens sont dans data/faune-v1/)"
            )
        for table in zone["conditions"].values():
            for entree in table:
                vus[entree["espece"]].add(entree["nom"])

    #  ── ET LES ESPÈCES QU'AUCUNE ZONE NE PORTE ──────────────────────
    #
    #  Elles ne sont dans AUCUNE table, et c'est voulu. Il y en a trois
    #  sortes, toutes dans `data/hors-nature.json` :
    #
    #    · les ONZE ESPÈCES FOSSILES et leurs dix évolutions — « les
    #      fossiles restent hors des zones sauvages, ils ne s'obtiennent
    #      qu'au laboratoire » (planche 39) ;
    #    · les CINQUANTE-CINQ FORMES RÉGIONALES, sorties des tables le
    #      6 novembre : elles passent par une brèche interdimensionnelle.
    #
    #  Il faut les garder ici : une ligne de registre « rendu » nomme
    #  l'espèce ressuscitée, et sans son nom le bilan afficherait un
    #  numéro. C'est exactement ce que le garde-fou n° 13 refuse — « un
    #  fossile qu'on ramasse et qu'on ne peut pas rendre » — et c'est lui
    #  qui a attrapé le trou le jour où les tables ont changé.
    #
    #  CE FICHIER LISAIT `fossiles.json` DIRECTEMENT jusqu'au 6
    #  novembre. Il n'en portait donc que les onze espèces de base : ni
    #  leurs évolutions, ni rien d'autre. C'est par là qu'Armaldo,
    #  Charkos et les huit autres manquaient au Pokédex.
    for espece in json.loads(HORS_NATURE.read_text(encoding="utf-8"))["especes"]:
        vus[espece["id"]].add(espece["nom"])

    desaccords = {i: sorted(n) for i, n in vus.items() if len(n) > 1}
    if desaccords:
        detail = " · ".join(f"{i} : {', '.join(n)}" for i, n in desaccords.items())
        raise NomsEnDesaccord(detail)

    return {i: next(iter(n)) for i, n in vus.items()}


def contenu(noms: dict[int, str]) -> str:
    """Le fichier, trié par identifiant et lisible par un humain."""
    index = {str(i): noms[i] for i in sorted(noms)}
    hors_nature = {
        e["id"] for e in json.loads(HORS_NATURE.read_text(encoding="utf-8"))["especes"]
    }
    corps = {
        "source": (
            "dérivé de data/faune/*.json et data/hors-nature.json par outils/especes.py"
        ),
        #  LE COMPTE SE COMPTE, il ne s'écrit pas : « 933 » est resté
        #  dans cette phrase après que les tables ont changé, et la
        #  note a menti de 22 espèces jusqu'au 6 novembre.
        "couverture": (
            f"les {sum(1 for i in noms if i not in hors_nature)} espèces des zones "
            f"sauvages et les {len(hors_nature)} qu'aucune zone ne porte — fossiles, "
            "leurs évolutions, et les formes régionales, qui passent par une brèche "
            "interdimensionnelle (data/hors-nature.json)"
        ),
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
