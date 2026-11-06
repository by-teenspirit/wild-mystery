#!/usr/bin/env python3
"""Les espèces du Pokédex de Rhode qu'on ne croise dans AUCUNE zone.

LE TROU QUE CE FICHIER REFERME
──────────────────────────────
Le Pokédex de Rhode a été bâti sur les dix-sept tables de faune : une
espèce y entrait parce qu'une zone la portait. Conséquence, mesurée le
6 novembre 2026 : **vingt-deux espèces n'y sont jamais entrées, non
parce qu'on n'en veut pas, mais parce qu'on ne les trouve pas dans la
nature.**

    · les ONZE LIGNÉES FOSSILES, vingt-et-une espèces. Un fossile se
      ramasse et se rend au laboratoire ; aucune de ces bêtes ne se
      promène dans une zone. `data/pokedex-de-rhode.json` le dit en
      toutes lettres — « fossiles […] volontairement absents » — et
      c'était vrai pour les TABLES, pas pour le Pokédex.

    · FEUNARD D'ALOLA. Goupix d'Alola est au Pokédex, son évolution
      non : on l'obtient avec une Pierre Glace, pas en marchant dans
      les hautes herbes. Même trou, autre cause.

Arbitrage de Callista, le 6 novembre : « les fossiles s'affichent dans
le pokedex mais ne se trouvent pas dans la nature. Ils doivent
cependant s'afficher dans l'annexe des fossiles. »

POURQUOI UNE LISTE DÉRIVÉE ET PAS ÉCRITE À LA MAIN
───────────────────────────────────────────────────
Parce qu'on sait déjà tout ce qu'il faut. `data/fossiles.json` nomme
les onze espèces de base ; les chaînes d'évolution de PokéAPI donnent
leurs évolutions ; et le Pokédex lui-même dit quelles formes régionales
il porte, donc lesquelles ont une évolution qui manque.

Une liste recopiée serait une liste à retenir de tenir à jour. Celle-ci
se refait, et le garde-fou la relit.

LA SOURCE EST UN DOSSIER DE CSV, PAS LE RÉSEAU
───────────────────────────────────────────────
Même contrainte que `outils/especes-sql.py` : `pokeapi.co` est
injoignable depuis le bac à sable et depuis le Mac, et les CSV du dépôt
PokéAPI pèsent 690 Ko qu'on ne met pas dans le dépôt. On les lit où ils
sont posés, on en tire 22 lignes, et c'est ce fichier-là qui est versé.

    python3 outils/hors-nature.py --depuis ~/Downloads/pokeapi-csv
                                         écrit data/hors-nature.json
    python3 outils/hors-nature.py --verifier
                                         relit le fichier sans réseau
"""

import json
import csv
import pathlib
import sys

RACINE = pathlib.Path(__file__).resolve().parent.parent
FOSSILES = RACINE / "data" / "fossiles.json"
POKEDEX = RACINE / "data" / "pokedex-carnet.json"
SORTIE = RACINE / "data" / "hors-nature.json"

#  Le français, dans les tables de PokéAPI.
FRANCAIS = 5
#  Les suffixes d'identifiant qui marquent une forme régionale. Repris
#  tels quels de `outils/especes-sql.py`, qui s'en sert pour la même
#  raison : une forme régionale est une espèce à part (5 octobre).
FORMES = ("alola", "galar", "hisui", "paldea")


class SourceIncomplete(Exception):
    """Un CSV manque, ou une espèce attendue n'y est pas."""


def _csv(dossier: pathlib.Path, nom: str) -> list[dict]:
    chemin = dossier / nom
    if not chemin.exists():
        raise SourceIncomplete(f"{nom} manque dans {dossier}")
    with chemin.open(encoding="utf-8") as f:
        return list(csv.DictReader(f))


def deriver(dossier: pathlib.Path) -> list[dict]:
    """Les espèces hors nature, dans l'ordre du dex national."""
    especes = _csv(dossier, "pokemon_species.csv")
    pokemons = _csv(dossier, "pokemon.csv")
    noms_esp = _csv(dossier, "pokemon_species_names.csv")
    noms_formes = _csv(dossier, "pokemon_form_names.csv")
    formes = _csv(dossier, "pokemon_forms.csv")

    vient_de = {
        int(r["id"]): int(r["evolves_from_species_id"]) if r["evolves_from_species_id"] else None
        for r in especes
    }
    enfants: dict[int, list[int]] = {}
    for i, parent in vient_de.items():
        if parent is not None:
            enfants.setdefault(parent, []).append(i)

    fr_espece = {
        int(r["pokemon_species_id"]): r["name"]
        for r in noms_esp
        if int(r["local_language_id"]) == FRANCAIS
    }
    #  Une forme a son propre nom français — « Feunard d'Alola » — et son
    #  propre identifiant de POKÉMON, qui est celui que le dépôt emploie.
    forme_vers_pokemon = {int(r["id"]): int(r["pokemon_id"]) for r in formes}
    fr_forme = {}
    for r in noms_formes:
        if int(r["local_language_id"]) == FRANCAIS and r["pokemon_name"]:
            fr_forme.setdefault(forme_vers_pokemon[int(r["pokemon_form_id"])], r["pokemon_name"])

    espece_de = {int(r["id"]): int(r["species_id"]) for r in pokemons}
    identifiant = {int(r["id"]): r["identifier"] for r in pokemons}
    defaut = {int(r["species_id"]): int(r["id"]) for r in pokemons if r["is_default"] == "1"}

    #  ── 1 · LES ONZE LIGNÉES FOSSILES ──────────────────────────────
    fossiles = json.loads(FOSSILES.read_text(encoding="utf-8"))["fossiles"]
    trouvees: dict[int, dict] = {}

    def descendre(espece: int, clef: str, parent: int | None) -> None:
        pokemon = defaut.get(espece)
        if pokemon is None:
            raise SourceIncomplete(f"l'espèce {espece} n'a pas de forme par défaut")
        nom = fr_espece.get(espece)
        if nom is None:
            raise SourceIncomplete(f"l'espèce {espece} n'a pas de nom français")
        trouvees[pokemon] = {
            "id": pokemon,
            "nom": nom,
            "origine": "fossile" if parent is None else "evolution",
            **({"fossile": clef} if parent is None else {"de": parent}),
        }
        for enfant in sorted(enfants.get(espece, [])):
            descendre(enfant, clef, pokemon)

    for fossile in fossiles:
        descendre(fossile["especeId"], fossile["clef"], None)

    #  ── 2 · LES FORMES RÉGIONALES, QUI PASSENT PAR LES BRÈCHES ─────
    #
    #  Arbitrage de Callista, le 6 novembre : « les formes Galar, Alola
    #  etc. doivent se trouver dans le pokédex mais ne doivent pas être
    #  trouvables pour le moment dans les zones. » Elles s'obtiennent
    #  par une BRÈCHE INTERDIMENSIONNELLE — une zone qui s'ouvre pour
    #  un temps et où l'on capture des pokémon d'une autre région, ou
    #  la forme qu'ils y prennent.
    #
    #  Elles quittent donc les dix-sept tables de rencontre (c'est
    #  `faune-par-zone.py` qui les y refuse) et entrent ici. Le jour où
    #  une brèche s'ouvre pour de bon, c'est ce fichier qui dira quoi.
    #
    #  LE NOM VIENT DU DÉPÔT, PAS DE POKÉAPI, pour les formes qu'il
    #  porte déjà : PokéAPI écrit « Rattata d’Alola » avec l'apostrophe
    #  typographique, le dépôt « Rattata d'Alola » avec la droite. Ces
    #  noms sont ceux de la planche 39 ; les réécrire ferait 54 faux
    #  désaccords dans `especes.py`, qui compare les noms table par
    #  table.
    dex = json.loads(POKEDEX.read_text(encoding="utf-8"))["especes"]
    au_dex = {e["id"] for e in dex}
    nom_au_dex = {e["id"]: e["nom"] for e in dex}
    par_espece_suffixe: dict[tuple[int, str], int] = {}
    for pokemon, ident in identifiant.items():
        for suffixe in FORMES:
            #  « -alola » et pas « alola » : `raticate-totem-alola` est
            #  une forme Totem, pas une forme régionale, et elle se
            #  glisserait ici sans ce test de fin exacte.
            if ident.endswith(f"-{suffixe}") and ident.count("-") == 1:
                par_espece_suffixe[(espece_de[pokemon], suffixe)] = pokemon

    def apostrophe_du_depot(s: str) -> str:
        return s.replace("’", "'")

    def poser_la_breche(pokemon: int, venant_de: int | None) -> None:
        nom = nom_au_dex.get(pokemon)
        if nom is None:
            brut = fr_forme.get(pokemon)
            if brut is None:
                raise SourceIncomplete(
                    f"le pokémon {pokemon} n'a pas de nom français de forme"
                )
            nom = apostrophe_du_depot(brut)
        trouvees[pokemon] = {
            "id": pokemon,
            "nom": nom,
            "origine": "breche",
            **({"de": venant_de} if venant_de is not None else {}),
        }

    #  Celles que le Pokédex porte déjà : elles sortent des zones.
    for pokemon in sorted(x for x in au_dex if x > 10000):
        poser_la_breche(pokemon, None)

    #  Et celles qui manquaient — une évolution régionale qu'aucune
    #  table ne pouvait porter, puisqu'on ne l'obtient qu'en faisant
    #  évoluer. Feunard d'Alola est la seule, mesuré le 6 novembre.
    for pokemon in sorted(x for x in au_dex if x > 10000):
        ident = identifiant.get(pokemon, "")
        suffixe = next((s for s in FORMES if ident.endswith(f"-{s}")), None)
        if suffixe is None:
            continue
        for enfant in sorted(enfants.get(espece_de[pokemon], [])):
            cible = par_espece_suffixe.get((enfant, suffixe))
            if cible is None or cible in au_dex or cible in trouvees:
                continue
            poser_la_breche(cible, pokemon)

    #  L'ordre est celui du dex : l'espèce de base, puis ce qui la
    #  décline. C'est la règle de `data/ordre-du-dex.json`.
    def rang(e: dict) -> tuple[int, int]:
        i = e["id"]
        return (espece_de.get(i, i), i)

    return sorted(trouvees.values(), key=rang)


def ecrire(especes: list[dict]) -> str:
    fossiles = sum(1 for e in especes if e["origine"] == "fossile")
    return json.dumps(
        {
            "_": (
                f"Les {len(especes)} espèces du Pokédex de Rhode qu'on ne croise dans "
                "AUCUNE zone sauvage. DÉRIVÉ par outils/hors-nature.py de "
                "data/fossiles.json et des chaînes d'évolution de PokéAPI. Ne pas "
                "modifier à la main."
            ),
            "_origine": (
                "« fossile » : l'espèce sort du laboratoire, et `fossile` nomme la clé "
                "de data/fossiles.json qui la ressuscite. « evolution » : elle s'obtient "
                "en faisant évoluer l'espèce que `de` désigne. « breche » : c'est une "
                "forme régionale, qu'on ne croise dans aucune zone et qui s'obtient par "
                "une brèche interdimensionnelle (6 novembre) ; `de` est alors la forme "
                "dont elle évolue, quand elle ne s'obtient que comme ça. Dans les trois "
                "cas la ligne du Pokédex n'a ni zone, ni fourchette de niveaux, ni "
                "moment — il n'y a rien de vrai à y écrire."
            ),
            "_compte": (
                f"{fossiles} espèces de base ressuscitées par un fossile, "
                f"{sum(1 for e in especes if e['origine'] == 'evolution')} obtenues en "
                "les faisant évoluer, et "
                f"{sum(1 for e in especes if e['origine'] == 'breche')} formes "
                "régionales qui passent par une brèche."
            ),
            "source": "https://github.com/PokeAPI/pokeapi/tree/master/data/v2/csv",
            "especes": especes,
        },
        ensure_ascii=False,
        indent=2,
    ) + "\n"


def verifier() -> int:
    """Relit le fichier livré, sans réseau ni CSV.

    On ne peut pas le re-dériver ici — les CSV ne sont pas dans le
    dépôt. Ce qu'on vérifie, c'est ce qui est vérifiable hors ligne et
    qui casse en premier : que les onze espèces de `fossiles.json` y
    sont, qu'aucune n'est en double, et que chaque « evolution » désigne
    un parent qui est soit dans cette liste, soit au Pokédex.
    """
    if not SORTIE.exists():
        print(f"   {SORTIE.name} manque — « python3 outils/hors-nature.py --depuis … »")
        return 1
    d = json.loads(SORTIE.read_text(encoding="utf-8"))["especes"]
    ids = [e["id"] for e in d]
    fautes = []

    if len(ids) != len(set(ids)):
        fautes.append("deux lignes portent le même identifiant")

    au_dex = {e["id"] for e in json.loads(POKEDEX.read_text(encoding="utf-8"))["especes"]}
    connus = set(ids) | au_dex

    attendues = {f["especeId"] for f in json.loads(FOSSILES.read_text(encoding="utf-8"))["fossiles"]}
    portees = {e["id"] for e in d if e["origine"] == "fossile"}
    if portees != attendues:
        manque = sorted(attendues - portees)
        trop = sorted(portees - attendues)
        if manque:
            fautes.append(f"espèces de fossiles.json absentes : {manque}")
        if trop:
            fautes.append(f"espèces annoncées fossiles sans fossile : {trop}")

    for e in d:
        if e["origine"] == "fossile" and not e.get("fossile"):
            fautes.append(f"{e['nom']} : origine « fossile » sans clé de fossile")
        if e["origine"] == "evolution":
            parent = e.get("de")
            if parent not in connus:
                fautes.append(f"{e['nom']} : évolue de {parent}, qui n'est nulle part")

    if fautes:
        for f in fautes:
            print(f"   {f}")
        return 1
    print(f"   hors nature : {len(d)} espèces, {len(portees)} lignées fossiles, "
          "chaque évolution rattachée")
    return 0


def main() -> None:
    if "--verifier" in sys.argv:
        sys.exit(verifier())
    if "--depuis" not in sys.argv:
        sys.exit(
            "usage : hors-nature.py --depuis <dossier de CSV PokéAPI>\n"
            "        hors-nature.py --verifier"
        )
    dossier = pathlib.Path(sys.argv[sys.argv.index("--depuis") + 1]).expanduser()
    especes = deriver(dossier)
    SORTIE.write_text(ecrire(especes), encoding="utf-8")
    fossiles = sum(1 for e in especes if e["origine"] == "fossile")
    print(
        f"{SORTIE.name} : {len(especes)} espèces hors nature ("
        f"{fossiles} ressuscitées, "
        f"{sum(1 for e in especes if e['origine'] == 'evolution')} par évolution, "
        f"{sum(1 for e in especes if e['origine'] == 'breche')} par brèche)."
    )


if __name__ == "__main__":
    main()
