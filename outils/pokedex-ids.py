#!/usr/bin/env python3
"""Résout les 933 noms du Pokédex de Rhode en identifiants d'espèce.

CE QU'IL ÉCRIT : `data/pokedex-ids.json`, un dictionnaire nom → identifiant.

POURQUOI UN FICHIER, ET PAS UNE RÉSOLUTION À CHAQUE FOIS
────────────────────────────────────────────────────────
La résolution demande les tables de PokéAPI, donc le réseau. Le CI n'a
pas le droit d'en dépendre (ARCHITECTURE §8) : on résout UNE fois, à la
main, et on commite le résultat. Le garde-fou vérifie ensuite, hors
réseau, que chaque nom du Pokédex a un identifiant et qu'aucun
identifiant n'est porté par deux noms.

LA CONVENTION D'IDENTIFIANT, RELEVÉE SUR LES TABLES EXISTANTES
──────────────────────────────────────────────────────────────
    · une espèce ordinaire → son `pokemon_species.id` (1 à 1025) ;
    · une forme régionale  → son `pokemon.id` (au-dessus de 10000).

Exemple mesuré : « Ossatueur d'Alola » vaut 10115, et `pokemon.csv` donne
`marowak-alola` pour 10115. Ce n'est pas un choix fait ici : c'est celui
des tables écrites les 2 et 12 octobre, et le changer invaliderait toutes
les lignes de registre déjà écrites.

TROIS SOURCES, DANS CET ORDRE, ET L'ORDRE COMPTE
────────────────────────────────────────────────
1. **Les tables de faune déjà écrites.** Elles portent nom ET
   identifiant, et des lignes de registre les citent déjà. Elles font
   donc foi : si une table dit que « Lianaja » vaut 496, on ne va pas
   chercher ailleurs.
2. **Les noms français des espèces** (`pokemon_species_names.csv`,
   langue 5).
3. **Les noms français des formes** (`pokemon_form_names.csv`, langue 5),
   en passant par `pokemon_forms.csv` pour retomber sur le `pokemon.id`.

Tout nom qui ne sort d'aucune des trois est **signalé, jamais devine**.
Un nom mal recopié dans la planche s'arrête ici, et c'est le troisième
contrôle de la transcription.

    python3 outils/pokedex-ids.py <dossier-des-csv>   écrit le fichier
    python3 outils/pokedex-ids.py --verifier          hors réseau, rend 1 s'il manque un nom
"""

import csv
import glob
import json
import pathlib
import sys
import unicodedata

RACINE = pathlib.Path(__file__).resolve().parent.parent
POKEDEX = RACINE / "data" / "pokedex-de-rhode.json"
SORTIE = RACINE / "data" / "pokedex-ids.json"
FAUNE = RACINE / "data" / "faune"

#  Les quatre régions, telles que la planche les écrit. PokéAPI écrit
#  « de Hisui » dans ses noms de forme, mais pas toujours de la même
#  façon — d'où la comparaison sur forme réduite plus bas.
CSV_ATTENDUS = (
    "pokemon_species_names.csv",
    "pokemon_form_names.csv",
    "pokemon_forms.csv",
    "pokemon.csv",
)

#  LES MOTS QUE POKÉAPI AJOUTE ET QUE LA PLANCHE N'ÉCRIT PAS.
#  « Plumeline Style Flamenco » chez PokéAPI, « Plumeline Flamenco » dans
#  la planche. On retire le mot de liaison plutôt que d'écrire quatre cas
#  particuliers.
LIAISONS = (" style ", " forme ", " form ")

#  ── LA SEULE CORRECTION ÉCRITE À LA MAIN, ET POURQUOI ───────────────
#
#  La table de Planque Snatch, écrite le 12 octobre, donne 745 à
#  « Lougaroc Crépusculaire ». 745 est « Lougaroc Diurne », et les deux
#  noms sont dans le Pokédex : le même identifiant pour deux espèces,
#  donc une des deux invisible dans le Pokédex d'un joueur. PokéAPI dit
#  10152 (`lycanroc-dusk`), et c'est lui qui a raison.
#
#  La règle « les tables font foi » reste bonne — des lignes de registre
#  les citent — mais elle ne peut pas couvrir une table fausse. Cette
#  correction passe donc AVANT les trois sources, et le contrôle
#  d'unicité plus bas garantit qu'il n'y en a pas d'autre à écrire.
CORRECTIONS = {
    "Lougaroc Crépusculaire": 10152,
}


def reduire(nom: str) -> str:
    """Un nom réduit : sans accent, sans casse, sans ponctuation, sans
    les mots de liaison de PokéAPI.

    On compare là-dessus et jamais sur le nom brut : « Mime Jr. » et
    « Mime Jr », « Nidoran♂ » et « Nidoran M », « Plumeline Style Hula »
    et « Plumeline Hula » doivent se rencontrer.
    """
    plat = unicodedata.normalize("NFD", nom.lower())
    plat = "".join(c for c in plat if unicodedata.category(c) != "Mn")
    plat = plat.replace("♂", " m").replace("♀", " f")
    plat = "".join(c if c.isalnum() else " " for c in plat)
    plat = f" {' '.join(plat.split())} "
    for liaison in LIAISONS:
        plat = plat.replace(liaison, " ")
    return " ".join(plat.split())


def depuis_les_tables() -> dict[str, int]:
    """Nom → identifiant, tel que les tables de faune le disent déjà."""
    connus: dict[str, int] = {}
    for chemin in sorted(glob.glob(str(FAUNE / "*.json"))):
        donnees = json.loads(pathlib.Path(chemin).read_text(encoding="utf-8"))
        for conditions in donnees.get("lieux", {}).values():
            for table in conditions.values():
                if not isinstance(table, list):
                    continue
                for entree in table:
                    nom, ident = entree["nom"], entree["espece"]
                    vu = connus.get(reduire(nom))
                    if vu is not None and vu != ident:
                        raise SystemExit(
                            f"REFUS : « {nom} » vaut {vu} dans une table et {ident} dans "
                            f"{pathlib.Path(chemin).name}. Deux tables se contredisent."
                        )
                    connus[reduire(nom)] = ident
    return connus


def depuis_pokeapi(dossier: pathlib.Path) -> dict[str, int]:
    manquants = [f for f in CSV_ATTENDUS if not (dossier / f).exists()]
    if manquants:
        raise SystemExit(f"REFUS : {', '.join(manquants)} absent(s) de {dossier}")

    def lire(nom: str) -> list[dict]:
        with (dossier / nom).open(encoding="utf-8") as f:
            return list(csv.DictReader(f))

    trouves: dict[str, int] = {}

    #  Les espèces, d'abord : c'est le cas courant.
    for ligne in lire("pokemon_species_names.csv"):
        if ligne["local_language_id"] != "5":
            continue
        trouves.setdefault(reduire(ligne["name"]), int(ligne["pokemon_species_id"]))

    #  Les formes ensuite. `pokemon_form_names.pokemon_name` porte le nom
    #  complet (« Plumeline Style Hula ») ; `pokemon_forms` ramène au
    #  `pokemon.id`, qui est l'identifiant qu'on écrit.
    vers_pokemon = {
        int(f["id"]): int(f["pokemon_id"]) for f in lire("pokemon_forms.csv")
    }
    for ligne in lire("pokemon_form_names.csv"):
        if ligne["local_language_id"] != "5" or not ligne["pokemon_name"]:
            continue
        pokemon = vers_pokemon.get(int(ligne["pokemon_form_id"]))
        if pokemon is None:
            continue
        #  `setdefault` : une forme ne doit jamais écraser une espèce.
        #  « Morphéo » est une espèce ET le nom d'une de ses formes.
        trouves.setdefault(reduire(ligne["pokemon_name"]), pokemon)

    return trouves


def main() -> int:
    pokedex = json.loads(POKEDEX.read_text(encoding="utf-8"))
    noms = [n for z in pokedex["zones"] for n in z["especes"]]

    if "--verifier" in sys.argv:
        if not SORTIE.exists():
            print(f"{SORTIE.name} manque — lance outils/pokedex-ids.py.", file=sys.stderr)
            return 1
        ids = json.loads(SORTIE.read_text(encoding="utf-8"))["ids"]
        absents = [n for n in noms if n not in ids]
        if absents:
            print(
                f"{len(absents)} nom(s) du Pokédex sans identifiant : "
                f"{', '.join(absents[:8])}…",
                file=sys.stderr,
            )
            return 1
        #  UN IDENTIFIANT PAR NOM, ET UN SEUL NOM PAR IDENTIFIANT. Deux
        #  noms sur le même identifiant, c'est la même espèce écrite de
        #  deux façons — et un Pokédex où elle compte deux fois.
        envers: dict[int, list[str]] = {}
        for nom in noms:
            envers.setdefault(ids[nom], []).append(nom)
        collisions = {i: ns for i, ns in envers.items() if len(ns) > 1}
        if collisions:
            for ident, ns in collisions.items():
                print(f"{ident} est porté par {' et '.join(ns)}.", file=sys.stderr)
            return 1
        print(f"{SORTIE.name} : {len(noms)} noms, {len(envers)} identifiants distincts.")
        return 0

    if len(sys.argv) < 2:
        print(__doc__.strip().splitlines()[-2], file=sys.stderr)
        return 1

    tables = depuis_les_tables()
    pokeapi = depuis_pokeapi(pathlib.Path(sys.argv[1]))

    ids: dict[str, int] = {}
    origine = {"corrige": 0, "table": 0, "espece": 0, "forme": 0}
    refuses: list[str] = []
    for nom in noms:
        cle = reduire(nom)
        if nom in CORRECTIONS:
            ids[nom] = CORRECTIONS[nom]
            origine["corrige"] += 1
        elif cle in tables:
            ids[nom] = tables[cle]
            origine["table"] += 1
        elif cle in pokeapi:
            ids[nom] = pokeapi[cle]
            origine["espece" if pokeapi[cle] < 10000 else "forme"] += 1
        else:
            refuses.append(nom)

    if refuses:
        print(f"REFUS : {len(refuses)} nom(s) introuvable(s) :", file=sys.stderr)
        for nom in refuses:
            print(f"   {nom}   (réduit : « {reduire(nom)} »)", file=sys.stderr)
        return 1

    SORTIE.write_text(
        json.dumps(
            {
                "_": (
                    "Nom → identifiant pour les 933 espèces de data/pokedex-de-rhode.json. "
                    "Écrit par outils/pokedex-ids.py depuis les tables de faune existantes "
                    "et les tables de PokéAPI. Une espèce ordinaire porte son "
                    "pokemon_species.id, une forme régionale son pokemon.id (> 10000)."
                ),
                "ids": ids,
            },
            ensure_ascii=False,
            indent=1,
            sort_keys=False,
        ) + "\n",
        encoding="utf-8",
    )
    print(
        f"{SORTIE.name} : {len(ids)} noms résolus "
        f"({origine['table']} par les tables, {origine['espece']} espèces, "
        f"{origine['forme']} formes, {origine['corrige']} corrigé(s) à la main)."
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
