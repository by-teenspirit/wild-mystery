#!/usr/bin/env python3
"""Fabrique `data/especes-fiches.json` puis `supabase/seeds/especes.sql`.

POURQUOI CET OUTIL EXISTE
──────────────────────────
Relevé le 9 octobre 2026 contre la vraie base : **la table `espece` ne
contenait qu'UNE ligne**, Goupix. Et tout le jeu pointe vers elle —
`pokemon`, `pokedex`, `fossile_espece` et `zone_espece` ont chacune une
clé étrangère vers `espece(id)`. Conséquence : aucune capture ne pouvait
s'écrire, donc **aucune clôture ne pouvait aboutir**, et le seed des
fossiles échouait à sa première ligne.

Il n'existait aucun seed d'espèces dans le dépôt. `data/especes.json`
n'en est pas un : c'est un index pour le navigateur, il ne porte que
`id → nom_fr`. La table, elle, veut aussi `types` — qui n'a PAS de
valeur par défaut —, `stade` et `pv_base`.

CE QUI FAIT FOI, ET CE QUI NE FAIT QUE COMPLÉTER
─────────────────────────────────────────────────
**Les NOMS viennent du dépôt, pas de PokéAPI.** `data/especes.json` est
dérivé des tables de faune et le garde-fou n° 9 le vérifie : c'est lui
qui dit quelles espèces existent dans Rhode et comment elles
s'appellent. PokéAPI ne sert qu'aux trois colonnes qui manquent.

L'inverse aurait été une régression silencieuse : les tables de faune
portent des noms écrits par Callista, et une forme régionale y est
nommée « Miaouss d'Alola » là où PokéAPI ne connaît que l'espèce
« Miaouss ».

ET L'IDENTIFIANT EST CELUI DU POKÉMON, PAS DE L'ESPÈCE
───────────────────────────────────────────────────────
Décision du 5 octobre : « les formes régionales sont des espèces à
part ». Elles portent donc leur identifiant PokéAPI propre — Électrode
de Hisui est 10232, pas 101 —, et c'est la table `pokemon` de PokéAPI
qui les a, pas `pokemon_species`. Vérifié sur les deux cas :

    10107  meowth-alola      species_id 52
    10232  electrode-hisui   species_id 101

C'est aussi ce qui donne les BONS types : une forme de Hisui n'a pas
les types de sa forme de Kanto, et `pokemon_types` est keyée par
`pokemon_id`.

POURQUOI DEUX ÉTAPES ET UN FICHIER INTERMÉDIAIRE
─────────────────────────────────────────────────
`pokeapi.co` est injoignable depuis le bac à sable ET depuis le Mac
(mesuré : 000 des deux côtés). Les CSV du dépôt PokéAPI, eux, passent
par `raw.githubusercontent.com`, que le Mac joint. Mais ils pèsent
690 Ko, dont 400 pour les noms dans vingt langues : les mettre dans le
dépôt, c'est 690 Ko de données étrangères pour en garder 40.

On en tire donc `data/especes-fiches.json` — les 734 fiches, et rien
d'autre —, qui EST dans le dépôt. Le seed s'en déduit hors ligne, de
façon déterministe, et le garde-fou peut le vérifier comme il vérifie
ceux du catalogue et des fossiles.

    python3 outils/especes-sql.py --fiches ~/Downloads/pokeapi-csv
                                        écrit data/especes-fiches.json
    python3 outils/especes-sql.py --sql > supabase/seeds/especes.sql
    python3 outils/especes-sql.py --verifier      (garde-fou)

CE QUI RESTE NUL, ET C'EST ASSUMÉ
──────────────────────────────────
`forme` est renseignée quand l'identifiant le dit (`-alola`, `-galar`,
`-hisui`). `evolue_vers`, `niveau_evolution` et `est_fossile` restent
nulles ou à leur défaut : **aucun code du dépôt ne les lit** — vérifié
par `grep` sur `src/` et `supabase/` — et les remplir demanderait de
décider ce qu'un niveau d'évolution veut dire dans un jeu où le serveur
ne fait pas évoluer les pokémon. Les écrire « pour avoir la colonne
pleine » serait inventer de la donnée.
"""

import csv
import json
import pathlib
import sys
import unicodedata

RACINE = pathlib.Path(__file__).resolve().parent.parent
INDEX = RACINE / "data" / "especes.json"
FICHES = RACINE / "data" / "especes-fiches.json"
SEED = RACINE / "supabase" / "seeds" / "especes.sql"

#  Le français, dans les tables de PokéAPI.
FRANCAIS = 5
#  `stat_id = 1` est « hp ». Les autres statistiques ne nous servent à
#  rien : le combat n'est pas simulé.
STAT_PV = 1

FORMES_CONNUES = ("alola", "galar", "hisui", "paldea")

SOURCE = "https://github.com/PokeAPI/pokeapi/tree/master/data/v2/csv"


class Manquant(Exception):
    """Une espèce de Rhode qu'aucune table de PokéAPI ne connaît.

    ON LÈVE PLUTÔT QUE DE METTRE UN DÉFAUT. Une espèce sans types
    passerait la contrainte `not null` avec `array['normal']`, et
    personne ne s'apercevrait jamais qu'un Pokémon du forum a de faux
    types. Une erreur à la génération coûte une minute ; une donnée
    fausse en base coûte le jour où on la découvre."""


def clef(nom: str) -> str:
    """« Électrik » → « electrik ». La convention est celle des tests
    déjà écrits dans le dépôt — `array['electrik']`, `array['roche']` —
    donc en bas de casse et sans accent. Même geste que `lieu.ts` : les
    ligatures d'abord, NFD ensuite."""
    nom = nom.replace("œ", "oe").replace("Œ", "OE")
    nom = nom.replace("æ", "ae").replace("Æ", "AE")
    plat = unicodedata.normalize("NFD", nom)
    return "".join(c for c in plat if unicodedata.category(c) != "Mn").lower()


def lire(dossier: pathlib.Path, nom: str) -> list[dict[str, str]]:
    chemin = dossier / nom
    if not chemin.exists():
        raise SystemExit(f"{chemin} manque — télécharge les CSV de {SOURCE}")
    with chemin.open(encoding="utf-8", newline="") as f:
        return list(csv.DictReader(f))


def fabriquer_les_fiches(dossier: pathlib.Path) -> dict[str, object]:
    index = json.loads(INDEX.read_text())["especes"]

    types_fr = {
        l["type_id"]: l["name"]
        for l in lire(dossier, "type_names.csv")
        if l["local_language_id"] == str(FRANCAIS)
    }

    #  Les types, par pokémon et DANS L'ORDRE DES EMPLACEMENTS. Un
    #  Pokémon « eau/vol » n'est pas la même chose qu'un « vol/eau »
    #  pour qui le lit, même si le jeu n'en tire rien.
    par_pokemon: dict[str, list[tuple[int, str]]] = {}
    for l in lire(dossier, "pokemon_types.csv"):
        par_pokemon.setdefault(l["pokemon_id"], []).append(
            (int(l["slot"]), types_fr[l["type_id"]])
        )

    pv = {
        l["pokemon_id"]: int(l["base_stat"])
        for l in lire(dossier, "pokemon_stats.csv")
        if l["stat_id"] == str(STAT_PV)
    }

    pokemon = {l["id"]: l for l in lire(dossier, "pokemon.csv")}

    #  Le stade : la profondeur dans la chaîne d'évolution. Pas un
    #  numéro de génération, pas un rang de Pokédex — le nombre de fois
    #  qu'il faut remonter `evolves_from_species_id` pour arriver à la
    #  racine. Zéro remontée = stade 1.
    parent = {
        l["id"]: l["evolves_from_species_id"] or None
        for l in lire(dossier, "pokemon_species.csv")
    }

    def stade(espece_id: str) -> int:
        profondeur, vu = 1, {espece_id}
        courant = parent.get(espece_id)
        while courant is not None and courant not in vu:
            vu.add(courant)
            profondeur += 1
            courant = parent.get(courant)
        #  Trois est le maximum du schéma (`1 base, 2 intermédiaire,
        #  3 final`). Les rares chaînes plus longues de PokéAPI — des
        #  bébés devant une chaîne de trois — s'y arrêtent.
        return min(profondeur, 3)

    fiches: dict[str, dict[str, object]] = {}
    for brut in sorted(index, key=int):
        p = pokemon.get(brut)
        if p is None:
            raise Manquant(f"l'espèce {brut} ({index[brut]}) n'est pas dans pokemon.csv")
        if brut not in par_pokemon:
            raise Manquant(f"l'espèce {brut} ({index[brut]}) n'a aucun type")
        if brut not in pv:
            raise Manquant(f"l'espèce {brut} ({index[brut]}) n'a pas de PV")

        suffixe = p["identifier"].rsplit("-", 1)[-1]
        fiches[brut] = {
            "types": [clef(t) for _, t in sorted(par_pokemon[brut])],
            "stade": stade(p["species_id"]),
            "pv": pv[brut],
            "forme": suffixe if suffixe in FORMES_CONNUES else None,
        }

    return {
        "_": "Dérivé des CSV de PokéAPI par outils/especes-sql.py. "
             "Les NOMS ne sont pas ici : ils vivent dans data/especes.json, "
             "qui est dérivé des tables de faune et fait foi.",
        "_identifiant": "La clé est l'identifiant POKÉMON de PokéAPI, pas "
                        "celui de l'espèce : les formes régionales sont des "
                        "espèces à part (décision du 5 octobre), donc "
                        "Électrode de Hisui est 10232 et pas 101.",
        "source": SOURCE,
        "fiches": fiches,
    }


def tableau_sql(types: list[str]) -> str:
    dedans = ",".join("'" + t.replace("'", "''") + "'" for t in types)
    return f"array[{dedans}]"


def seed() -> str:
    index = json.loads(INDEX.read_text())["especes"]
    fiches = json.loads(FICHES.read_text())["fiches"]

    absentes = [i for i in index if i not in fiches]
    if absentes:
        raise Manquant(
            f"{len(absentes)} espèce(s) sans fiche — relance "
            f"« --fiches » : {', '.join(absentes[:5])}…"
        )

    lignes = []
    for brut in sorted(index, key=int):
        f = fiches[brut]
        forme = "null" if f["forme"] is None else "'" + f["forme"] + "'"
        nom = index[brut].replace("'", "''")
        lignes.append(
            f"  ({brut}, '{nom}', {forme}, {tableau_sql(f['types'])}, "
            f"{f['stade']}, {f['pv']})"
        )

    return "\n".join([
        "--  DÉRIVÉ DE data/especes.json ET data/especes-fiches.json —",
        "--  NE PAS MODIFIER À LA MAIN.",
        "--  Régénérer avec : python3 outils/especes-sql.py --sql > supabase/seeds/especes.sql",
        "--",
        "--  CE SEED EST LE PREMIER À APPLIQUER, avant celui des fossiles et",
        "--  avant toute partie : `pokemon`, `pokedex`, `fossile_espece` et",
        "--  `zone_espece` ont toutes une clé étrangère vers `espece(id)`.",
        "--  Tant que cette table est vide, aucune capture ne peut s'écrire,",
        "--  donc aucune clôture ne peut aboutir.",
        "--",
        "--  `on conflict do update` ET PAS `do nothing` : si un nom ou un",
        "--  type change dans les tables de faune, rejouer ce seed remet la",
        "--  base d'accord avec le dépôt. Un `do nothing` laisserait l'ancienne",
        "--  ligne et ne dirait rien.",
        "--",
        f"--  {len(lignes)} espèces, celles qui apparaissent dans une zone de Rhode.",
        "",
        "insert into espece (id, nom_fr, forme, types, stade, pv_base) values",
        ",\n".join(lignes),
        "    on conflict (id) do update set",
        "       nom_fr  = excluded.nom_fr,",
        "       forme   = excluded.forme,",
        "       types   = excluded.types,",
        "       stade   = excluded.stade,",
        "       pv_base = excluded.pv_base;",
        "",
    ])


def main() -> int:
    if "--fiches" in sys.argv:
        ou = sys.argv[sys.argv.index("--fiches") + 1]
        fiches = fabriquer_les_fiches(pathlib.Path(ou).expanduser())
        FICHES.write_text(json.dumps(fiches, ensure_ascii=False, indent=1) + "\n")
        n = len(fiches["fiches"])  # type: ignore[index]
        print(f"   {FICHES.relative_to(RACINE)} : {n} fiches")
        return 0

    if "--sql" in sys.argv:
        sys.stdout.write(seed())
        return 0

    if "--verifier" in sys.argv:
        if not SEED.exists():
            print(
                f"{SEED.relative_to(RACINE)} manque — lance "
                f"« python3 outils/especes-sql.py --sql > {SEED.relative_to(RACINE)} »",
                file=sys.stderr,
            )
            return 1
        attendu = seed()
        if SEED.read_text() != attendu:
            print(
                f"{SEED.relative_to(RACINE)} ne correspond plus à "
                "data/especes.json — régénère-le",
                file=sys.stderr,
            )
            return 1
        combien = attendu.count("\n  (")
        print(f"   espèces : {combien} au seed, d'accord avec data/especes.json")
        return 0

    print(__doc__)
    return 2


if __name__ == "__main__":
    raise SystemExit(main())
