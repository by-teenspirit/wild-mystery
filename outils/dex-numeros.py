#!/usr/bin/env python3
# ════════════════════════════════════════════════════════════════════
#  outils/dex-numeros.py — l'identifiant national → le rang de Rhode
#
#  « Affiche le numéro du pokémon » (5 novembre), sur l'annexe des
#  zones.
#
#  ── LE PROBLÈME EST PETIT ET IL AVAIT TROIS MAUVAISES SOLUTIONS ─────
#
#  Les tables de faune portent l'identifiant national : 757 pour
#  Tritox, 10115 pour Ossatueur d'Alola. Ce n'est pas un numéro de
#  Pokédex — c'est une clé de PokéAPI, et elle met les formes
#  régionales à dix mille. Le numéro que le joueur voit dans SON
#  carnet, lui, est le rang dans le dex de Rhode : 1 à 933.
#
#  Trois façons de donner ce rang à l'annexe, et deux sont mauvaises :
#
#    · lire `data/pokedex-carnet.json`, qui le porte déjà — 151 Ko
#      téléchargés pour en garder dix ;
#    · écrire le rang dans les dix-sept `data/faune/<id>.json` — « dix-
#      sept endroits de plus à tenir d'accord avec un dix-huitième »,
#      c'est le commentaire de `annexe-carte.py` et il a raison ;
#    · un fichier à lui, dérivé du premier, vérifiable. Dix kilo-
#      octets, une requête, et une règle de garde-fou qui crie si les
#      deux divergent.
#
#  ── IL NE DÉCIDE RIEN ───────────────────────────────────────────────
#
#  L'ordre du dex de Rhode est décidé par `outils/pokedex-carnet.py`,
#  qui range par le couple (espèce de base, identifiant) et numérote
#  1..933. Cet outil-ci RECOPIE ce rang, il ne le recalcule pas : deux
#  tris écrits séparément finissent par ne plus donner le même ordre,
#  et le jour où ça arrive le joueur voit deux numéros pour un même
#  pokémon.
# ════════════════════════════════════════════════════════════════════

import json
import pathlib
import sys

R = pathlib.Path(__file__).resolve().parent.parent
SOURCE = R / "data/pokedex-carnet.json"
CIBLE = R / "data/dex-numeros.json"


def construire():
    dex = json.loads(SOURCE.read_text(encoding="utf-8"))
    especes = dex["especes"]

    numeros = {}
    for e in especes:
        id_national = e["id"]
        rang = e["no"]
        #  DEUX ESPÈCES SUR LE MÊME IDENTIFIANT SERAIT UNE SOURCE
        #  ABÎMÉE, et on préfère s'arrêter que publier un numéro au
        #  hasard entre les deux.
        if id_national in numeros:
            raise SystemExit(
                f"dex-numeros : l'identifiant {id_national} apparaît deux fois "
                f"dans {SOURCE.name} (rangs {numeros[id_national]} et {rang})"
            )
        numeros[id_national] = rang

    rangs = sorted(numeros.values())
    if rangs != list(range(1, len(especes) + 1)):
        raise SystemExit(
            "dex-numeros : les rangs de "
            f"{SOURCE.name} ne vont pas de 1 à {len(especes)} sans trou — "
            "relance « python3 outils/pokedex-carnet.py »"
        )

    return {
        "_": (
            "Identifiant national → rang dans le Pokédex de Rhode (1 à "
            f"{len(especes)}). Écrit par outils/dex-numeros.py depuis "
            "data/pokedex-carnet.json, qui décide de l'ordre. Ne pas "
            "modifier à la main."
        ),
        "_pourquoi": (
            "Les tables data/faune/<forumId>.json portent l'identifiant "
            "national, qui n'est pas un numéro de dex : les formes "
            "régionales y sont à 10 000. L'annexe des zones affiche le rang "
            "de Rhode, le même que celui du carnet du joueur."
        ),
        #  LES CLÉS SONT DES CHAÎNES : c'est du JSON, et un objet JSON
        #  n'a pas de clé numérique. Le lecteur TypeScript les
        #  reconvertit, et il écarte ce qui n'est pas un entier.
        "numeros": {str(k): v for k, v in sorted(numeros.items())},
    }


def main():
    verifier = "--verifier" in sys.argv
    if not SOURCE.exists():
        raise SystemExit(f"{SOURCE} n'existe pas")

    neuf = json.dumps(construire(), ensure_ascii=False, indent=2) + "\n"

    if verifier:
        if not CIBLE.exists():
            raise SystemExit(f"{CIBLE.name} n'existe pas — lance « deno task dex-numeros »")
        if CIBLE.read_text(encoding="utf-8") != neuf:
            raise SystemExit(
                f"{CIBLE.name} ne correspond plus à {SOURCE.name} — "
                "lance « deno task dex-numeros »"
            )
        combien = len(json.loads(neuf)["numeros"])
        print(f"dex-numeros : à jour ({combien} espèces).")
        return

    CIBLE.write_text(neuf, encoding="utf-8")
    combien = len(json.loads(neuf)["numeros"])
    print(f"{CIBLE.name} écrit : {combien} espèces, {len(neuf) / 1024:.1f} Ko.")


if __name__ == "__main__":
    main()
