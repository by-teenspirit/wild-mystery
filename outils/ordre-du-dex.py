#!/usr/bin/env python3
"""L'ordre du Pokédex : national, formes régionales rangées derrière.

CE QU'IL ÉCRIT : `data/ordre-du-dex.json`, l'espèce de BASE de chacune
des formes régionales du Pokédex de Rhode.

── POURQUOI CE FICHIER ─────────────────────────────────────────────

Les 933 espèces avaient trois ordres selon l'endroit où on les
regardait :

  · l'ordre de la planche 39 — zone par zone, et dans chaque zone
    l'ordre où les noms ont été écrits — qui sert de numéro de Rhode ;
  · dans l'annexe de la carte, par rareté puis par probabilité ;
  · nulle part l'ordre national.

« Pourquoi l'ordre et l'id des pokémons n'est pas le même que dans le
dépôt que je t'ai donné ou comme dans l'ordre des vrais pokémons ? »
(4 novembre). Les IDENTIFIANTS, eux, étaient justes depuis le début —
Bulbizarre 1, Pikachu 25, et 10115 pour Ossatueur d'Alola, qui est la
convention de PokéAPI pour les formes. C'est l'ordre qui manquait.

Arbitrage du 4 novembre : **ordre national, et chaque forme régionale
juste après son espèce de base**. Ossatueur, puis Ossatueur d'Alola,
puis Hypotrempe. Trier bêtement par identifiant rejetterait les 54
formes à la fin, loin de l'espèce qu'elles déclinent.

── POURQUOI UN FICHIER, ET PAS UN CALCUL ───────────────────────────

Il faut `pokemon.csv` de PokéAPI pour savoir que 10115 décline 105, et
le CI n'a pas le droit de dépendre du réseau (ARCHITECTURE §8). On
résout UNE fois et on commite, comme `outils/pokedex-ids.py`.

Le fichier ne porte QUE les formes : les 879 espèces ordinaires sont
leur propre base, et l'écrire ferait 879 lignes qui ne disent rien.

    python3 outils/ordre-du-dex.py <pokemon.csv>   écrit le fichier
    python3 outils/ordre-du-dex.py --verifier      hors réseau
"""

import csv
import json
import pathlib
import sys

R = pathlib.Path(__file__).resolve().parent.parent
FICHIER = R / "data" / "ordre-du-dex.json"

SOURCE = (
    "https://raw.githubusercontent.com/PokeAPI/pokeapi/master/data/v2/csv/pokemon.csv"
)


def les_ids():
    """Les identifiants de toutes les espèces du Pokédex de Rhode.

    `data/especes.json` ET PAS `pokedex-ids.json` depuis le 6 novembre :
    le second ne porte que les espèces des zones, et les vingt-deux
    arrivées ce jour-là — les lignées fossiles et Feunard d'Alola — n'y
    sont pas. Feunard d'Alola, qui est une forme, se retrouvait donc
    sans base et tombait à la toute fin du Pokédex au lieu de suivre
    Goupix d'Alola.
    """
    d = json.loads((R / "data/especes.json").read_text(encoding="utf-8"))
    return sorted(int(i) for i in d["especes"])


def ecrire(chemin_csv):
    base = {}
    with open(chemin_csv, newline="", encoding="utf-8") as f:
        for ligne in csv.DictReader(f):
            base[int(ligne["id"])] = int(ligne["species_id"])

    formes = [i for i in les_ids() if i > 10000]
    manquants = [i for i in formes if i not in base]
    if manquants:
        raise SystemExit(
            "Ces formes n'ont pas d'espèce de base dans le CSV : "
            + ", ".join(str(i) for i in manquants)
        )

    #  UN CONTRÔLE QUI A L'AIR INUTILE ET NE L'EST PAS : si une espèce
    #  ordinaire n'était pas sa propre base, c'est que l'identifiant
    #  n'est pas celui qu'on croit, et tout l'ordre serait faux.
    ordinaires = [i for i in les_ids() if i <= 10000]
    faux = [i for i in ordinaires if base.get(i) != i]
    if faux:
        raise SystemExit(
            "Ces espèces ordinaires ne sont pas leur propre base : "
            + ", ".join(str(i) for i in faux[:10])
        )

    FICHIER.write_text(
        json.dumps(
            {
                "_": (
                    "L'espèce de BASE de chacune des formes régionales du Pokédex "
                    "de Rhode. DÉRIVÉ par outils/ordre-du-dex.py de "
                    f"pokedex-ids.json et de {SOURCE}. Ne pas modifier à la main. "
                    "Sert à ranger les espèces : ordre national, et chaque forme "
                    "juste après l'espèce qu'elle décline — Ossatueur, Ossatueur "
                    "d'Alola, puis Hypotrempe."
                ),
                "_absentes": (
                    "Les 879 espèces ordinaires ne sont PAS listées : elles sont "
                    "leur propre base, et l'écrire ferait 879 lignes muettes. "
                    "Un identifiant absent d'ici est sa propre base."
                ),
                "base": {str(i): base[i] for i in formes},
            },
            ensure_ascii=False,
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )
    print(f"ordre-du-dex : {len(formes)} formes régionales rangées.")


def verifier():
    if not FICHIER.exists():
        raise SystemExit(f"{FICHIER} n'existe pas — lance l'outil avec pokemon.csv")
    d = json.loads(FICHIER.read_text(encoding="utf-8"))["base"]
    formes = [i for i in les_ids() if i > 10000]
    manquants = [i for i in formes if str(i) not in d]
    if manquants:
        raise SystemExit(
            "Ces formes du Pokédex n'ont pas de base dans ordre-du-dex.json : "
            + ", ".join(str(i) for i in manquants)
        )
    #  La base d'une forme est une espèce ordinaire, jamais une autre
    #  forme : sinon le tri boucle.
    douteux = [k for k, v in d.items() if v > 10000]
    if douteux:
        raise SystemExit("Ces bases sont elles-mêmes des formes : " + ", ".join(douteux))
    en_trop = [k for k in d if int(k) not in formes]
    if en_trop:
        raise SystemExit(
            "Ces formes ne sont plus dans le Pokédex : " + ", ".join(en_trop)
        )
    print(f"ordre-du-dex : {len(d)} formes, toutes rattachées à une espèce de base.")


def main():
    if "--verifier" in sys.argv:
        verifier()
        return
    reste = [a for a in sys.argv[1:] if not a.startswith("--")]
    if not reste:
        raise SystemExit(
            "usage : python3 outils/ordre-du-dex.py <pokemon.csv>\n"
            f"        le CSV se prend sur {SOURCE}"
        )
    ecrire(reste[0])


if __name__ == "__main__":
    main()
