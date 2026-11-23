#!/usr/bin/env python3
"""Fabrique `data/talents.json` : quels talents chaque espèce peut avoir.

POURQUOI CE FICHIER EXISTE
───────────────────────────
« Ce serait cool de rajouter les talents » — 23 novembre. Il n'y en avait
aucune trace dans le dépôt : ni colonne, ni donnée, ni mot. La première
chose qui manquait était la DONNÉE, et elle n'était pas dérivable — les
tables de faune ne portent que des identifiants et des noms d'espèce.

Même source que les évolutions : les tables de PokéAPI, servies depuis
GitHub, qui sont les chiffres auxquels l'annexe V1 renvoie déjà les
joueurs par Poképédia.

UN TALENT, PAS DEUX
───────────────────
Dans les jeux, une espèce a une à trois possibilités et le Pokémon en
porte UNE. Ce fichier rend donc la LISTE des possibilités par espèce ; le
choix de celui que porte un Pokémon donné est une colonne sur `pokemon`,
pas une donnée d'espèce.

LE TALENT CACHÉ EST MARQUÉ, PAS ÉCARTÉ. Dans les jeux il demande un
Pokémon trouvé d'une certaine façon ; ici rien ne l'impose encore, et
Callista n'a rien tranché là-dessus. Il sort donc avec `cache: true`, de
sorte que la règle puisse s'écrire plus tard sans refabriquer le fichier
— et qu'en attendant on voie lesquels sont dans ce cas.

LES FORMES RÉGIONALES SONT COUVERTES SANS EFFORT, parce que
`pokemon_abilities.csv` est indexé par `pokemon.id` et que ce sont
exactement les identifiants que Callista utilise pour elles (Raichu
d'Alola = 10100). Rien à traduire.

À QUOI ÇA SERVIRA
─────────────────
Deux choses, et la seconde est la raison pour laquelle ce fichier arrive
maintenant : l'infobulle d'un Pokémon le nommera, et l'annexe
« Faire évoluer son pokémon » en a besoin — « si vous souhaitez obtenir
la forme Crépusculaire de Rocabot, il aura besoin d'avoir le talent
Tempo Perso ». Sans cette donnée, cette évolution-là est inécrivable.

    python3 outils/talents.py            écrit data/talents.json
    python3 outils/talents.py --verifier ne l'écrit pas, rend 1 s'il diffère
"""

import json
import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from evolutions import R, lire, noms_fr  # noqa: E402


def construire():
    especes_wm = json.loads((R / "data/especes.json").read_text())["especes"]
    connues = {int(k) for k in especes_wm}

    noms = noms_fr("ability_names", "ability_id")

    #  ── QUEL `pokemon.id` PORTE QUELLE ESPÈCE ─────────────────────────
    #
    #  Pour une espèce ordinaire, c'est la forme par défaut. Pour une
    #  forme régionale, Callista utilise DÉJÀ l'identifiant de
    #  `pokemon.csv`, donc la ligne se trouve directement.
    defaut = {}
    for l in lire("pokemon"):
        if l["is_default"] == "1":
            defaut[int(l["species_id"])] = int(l["id"])

    par_pokemon = {}
    for l in lire("pokemon_abilities"):
        par_pokemon.setdefault(int(l["pokemon_id"]), []).append(l)

    sortie = {}
    sans = []
    for espece in sorted(connues):
        #  UNE FORME RÉGIONALE EST SON PROPRE `pokemon.id` ; une espèce
        #  ordinaire passe par sa forme par défaut.
        pid = espece if espece > 10000 else defaut.get(espece, espece)
        lignes = sorted(par_pokemon.get(pid, []), key=lambda l: int(l["slot"]))
        liste = []
        for l in lignes:
            nom = noms.get(l["ability_id"])
            if nom is None:
                continue
            ligne = {"id": int(l["ability_id"]), "nom": nom}
            if l["is_hidden"] == "1":
                ligne["cache"] = True
            liste.append(ligne)
        if not liste:
            #  ON LE DIT PLUTÔT QUE DE L'OUBLIER : une espèce sans talent
            #  est soit une donnée manquante, soit une forme que PokéAPI
            #  ne décrit pas. Dans les deux cas, un fichier qui la tairait
            #  serait un fichier dans lequel on ne peut pas voir le trou.
            sans.append(espece)
            continue
        sortie[espece] = liste

    return {
        "lisezMoi": (
            "Les talents possibles de chaque espèce. DÉRIVÉ des tables de "
            "PokéAPI par outils/talents.py. Une espèce a une à trois "
            "possibilités ; un Pokémon en porte UNE, et ce choix est une "
            "colonne sur `pokemon`, pas une donnée d'espèce. "
            "NE PAS MODIFIER À LA MAIN."
        ),
        "source": "https://github.com/PokeAPI/pokeapi — data/v2/csv",
        "comment": "python3 outils/talents.py",
        "cache": (
            "cache: true marque le talent caché des jeux. Rien ne l'impose "
            "encore ici : la règle reste à écrire, et le marquage est là pour "
            "qu'elle puisse l'être sans refabriquer le fichier."
        ),
        "especesSansTalent": sans,
        "compte": {
            "especes": len(sortie),
            "talents": len({t["id"] for v in sortie.values() for t in v}),
            "sansTalent": len(sans),
        },
        "talents": {str(k): v for k, v in sorted(sortie.items())},
    }


def main():
    fichier = R / "data/talents.json"
    texte = json.dumps(construire(), ensure_ascii=False, indent=1) + "\n"
    if "--verifier" in sys.argv:
        if not fichier.exists() or fichier.read_text() != texte:
            print("data/talents.json ne correspond plus à la source", file=sys.stderr)
            return 1
        print("data/talents.json : à jour.")
        return 0
    fichier.write_text(texte)
    print(f"data/talents.json écrit — {json.loads(texte)['compte']}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
