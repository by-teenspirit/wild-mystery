#!/usr/bin/env python3
# ════════════════════════════════════════════════════════════════════
#  outils/fossiles.py
#
#  `data/fossiles.json` est la SOURCE UNIQUE des fossiles. Trois choses
#  en sont dérivées, et aucune ne se tient à jour toute seule :
#
#    · les 22 lignes de `objet` — onze fossiles et leurs onze morceaux ;
#    · `fossile_espece`, que `rendre_fossile` relit pour savoir quelle
#      espèce ressusciter ;
#    · `fossile_morceau`, que le déclencheur d'assemblage relit pour
#      savoir combien de morceaux font quel fossile.
#
#  POURQUOI UN SEED ET PAS LA MIGRATION. Une migration se joue une
#  fois ; ce fichier se rejoue à chaque déploiement. Le jour où Callista
#  tranche la règle des quatre fossiles de la 8G, on ajoute quatre
#  lignes au JSON, on régénère, et c'est tout — sans écrire de migration
#  pour une donnée de jeu.
#
#  Même raison d'être que `outils/objets.py` et le garde-fou n° 11.
#
#  Usage :
#      python3 outils/fossiles.py --sql       > supabase/seeds/fossiles.sql
#      python3 outils/fossiles.py --verifier  (garde-fou)
# ════════════════════════════════════════════════════════════════════

import json
import pathlib
import re
import sys

RACINE = pathlib.Path(__file__).resolve().parent.parent
TABLE = RACINE / "data" / "fossiles.json"
CATALOGUE = RACINE / "data" / "objets.json"
MIGRATIONS = RACINE / "supabase" / "migrations"
SEED = RACINE / "supabase" / "seeds" / "fossiles.sql"
FAUNE = RACINE / "data" / "especes.json"

#  La famille de la table `objet`. `0010` la décrit : « se trouvent, ne
#  se vendent pas ».
FAMILLE = "fossile"


class TableIncoherente(Exception):
    """Levée plutôt que d'écrire un fichier dérivé qu'on sait faux."""


#  LA LECTURE DE LA CONTRAINTE N'EST PAS RECOPIÉE, ELLE EST IMPORTÉE.
#  `objets.py` sait déjà lire la dernière « famille in (…) » des
#  migrations, et cette lecture a déjà coûté une soirée le 5 octobre.
#  En refaire une deuxième version ici, c'est se donner deux chances de
#  diverger de la base.
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from objets import familles_du_schema  # noqa: E402


def identifiants_du_catalogue() -> set[int]:
    """Les identifiants que la boutique occupe déjà.

    DEUX SOURCES ÉCRIVENT DANS `objet` : le catalogue et ce fichier. Un
    identifiant partagé, c'est une Poké Ball qui devient un fossile au
    prochain déploiement — et un sac qui change de contenu sans que
    personne ait rien demandé. On refuse donc de générer le seed si les
    plages se touchent.
    """
    donnees = json.loads(CATALOGUE.read_text(encoding="utf-8"))
    return {o["id"] for o in donnees["objets"]}


def especes_de_la_faune() -> dict[int, str]:
    """La faune du forum, pour vérifier que l'espèce ressuscitée existe.

    Un fossile qui rend une espèce absente de `espece` lèverait une
    violation de clé étrangère au déploiement — APRÈS avoir inséré les
    objets, donc à moitié. On le dit ici, avant d'écrire quoi que ce
    soit.

    `data/especes.json` est un index `{ "1": "Bulbizarre", … }` : les
    clés sont des chaînes, c'est du JSON.
    """
    if not FAUNE.exists():
        return {}
    index = json.loads(FAUNE.read_text(encoding="utf-8")).get("especes", {})
    return {int(k): v for k, v in index.items() if str(k).lstrip("-").isdigit()}


def charger() -> dict:
    donnees = json.loads(TABLE.read_text(encoding="utf-8"))
    fossiles = donnees["fossiles"]

    du_schema = familles_du_schema()
    if FAMILLE not in du_schema:
        raise TableIncoherente(
            f"la base refuse la famille « {FAMILLE} » — elle accepte "
            + ", ".join(sorted(du_schema))
        )

    pris = identifiants_du_catalogue()
    faune = especes_de_la_faune()

    vus_id: dict[int, str] = {}
    vus_slug: dict[str, int] = {}
    vus_clef: set[str] = set()
    vus_espece: dict[int, str] = {}
    for f in fossiles:
        nom = f["objet"]
        if f["clef"] in vus_clef:
            raise TableIncoherente(f"clef « {f['clef']} » en double")
        vus_clef.add(f["clef"])
        #  Les deux identifiants d'une même ligne, et ceux de toutes les
        #  autres, et ceux du catalogue.
        for champ in ("id", "morceauId"):
            i = f[champ]
            if not isinstance(i, int) or i <= 0:
                raise TableIncoherente(f"{nom} : {champ} absurde ({i})")
            if i in vus_id:
                raise TableIncoherente(f"id {i} en double ({vus_id[i]} et {nom})")
            if i in pris:
                raise TableIncoherente(
                    f"{nom} : l'id {i} est déjà celui d'un objet du catalogue "
                    "(data/objets.json) — les plages ne doivent pas se croiser"
                )
            vus_id[i] = nom
        if f["slug"] in vus_slug:
            raise TableIncoherente(f"slug « {f['slug']} » en double")
        vus_slug[f["slug"]] = f["id"]
        #  UNE ESPÈCE, UN FOSSILE : c'est la règle du 7 octobre. Deux
        #  fossiles pour une espèce rendraient le tirage ambigu, et le
        #  Pokédex mentirait sur comment on l'a obtenue.
        if f["especeId"] in vus_espece:
            raise TableIncoherente(
                f"l'espèce {f['espece']} est rendue par deux fossiles "
                f"({vus_espece[f['especeId']]} et {nom})"
            )
        vus_espece[f["especeId"]] = nom
        if faune and f["especeId"] not in faune:
            raise TableIncoherente(
                f"{nom} : l'espèce {f['especeId']} ({f['espece']}) n'est pas dans la faune"
            )

    par = donnees["morceauxParFossile"]
    if not isinstance(par, int) or par < 2:
        raise TableIncoherente(
            f"morceauxParFossile vaut {par} : en dessous de deux, il n'y a pas de morceaux"
        )
    return donnees


def guillemets(texte: str) -> str:
    return "'" + texte.replace("'", "''") + "'"


def en_sql(donnees: dict) -> str:
    fossiles = donnees["fossiles"]
    par = donnees["morceauxParFossile"]
    lignes = [
        "--  DÉRIVÉ DE data/fossiles.json — NE PAS MODIFIER À LA MAIN.",
        "--  Régénérer avec : python3 outils/fossiles.py --sql > supabase/seeds/fossiles.sql",
        "--",
        "--  Trois tables d'un seul fichier : les objets, l'espèce que",
        "--  chaque fossile rend, et le nombre de morceaux qui en font un.",
        "--",
        "--  `overriding system value` : `objet.id` est",
        "--  `generated always as identity`. Même raison que le seed du",
        "--  catalogue — ces identifiants sont écrits dans des lignes de",
        "--  registre et dans des sacs, c'est la base qui s'adapte.",
        "--",
        "--  Les fossiles ne se vendent pas : `prix` est nul et",
        "--  `en_vente` faux. La boutique les ignore donc d'elle-même,",
        "--  sans qu'on ait à lui apprendre ce qu'est un fossile.",
        "",
        "insert into objet (id, slug, nom, famille, prix, en_vente)",
        "overriding system value values",
    ]
    corps = []
    for f in fossiles:
        corps.append(
            "  ({}, {}, {}, {}, null, false)".format(
                f["id"], guillemets(f["slug"]), guillemets(f["objet"]), guillemets(FAMILLE)
            )
        )
    for f in fossiles:
        corps.append(
            "  ({}, {}, {}, {}, null, false)".format(
                f["morceauId"],
                guillemets("morceau-" + f["slug"]),
                #  « Morceau de » + le nom tel quel, majuscules comprises :
                #  ce sont des noms propres d'objets dans les jeux, et
                #  « morceau de nautile » se lirait comme un coquillage
                #  ramassé sur la plage.
                guillemets("Morceau de " + f["objet"]),
                guillemets(FAMILLE),
            )
        )
    lignes.append(",\n".join(corps))
    lignes += [
        "on conflict (id) do update set",
        "  slug = excluded.slug,",
        "  nom = excluded.nom,",
        "  famille = excluded.famille,",
        "  prix = excluded.prix,",
        "  en_vente = excluded.en_vente;",
        "",
        "--  UNE ESPÈCE, UN FOSSILE (règle du 7 octobre). La table reste",
        "--  (objet, espèce) et non (objet, espèce, probabilité) : le jour",
        "--  où un fossile rendra deux espèces, c'est ici que la",
        "--  probabilité s'ajoutera, et `rendre_fossile` avec.",
        "insert into fossile_espece (objet_id, espece_id) values",
    ]
    #  LA VIRGULE AVANT LE COMMENTAIRE, jamais après : `-- …,` met la
    #  virgule DANS le commentaire, et le SQL ne compile plus. Mesuré en
    #  l'écrivant dans le mauvais sens.
    valeurs = ["  ({}, {})".format(f["id"], f["especeId"]) for f in fossiles]
    lignes.append(
        "\n".join(
            v + ("," if i + 1 < len(valeurs) else "")
            + "  -- {} → {}".format(fossiles[i]["objet"], fossiles[i]["espece"])
            for i, v in enumerate(valeurs)
        )
    )
    lignes += [
        "on conflict (objet_id, espece_id) do nothing;",
        "",
        "--  CE QU'UN MORCEAU DEVIENT, et combien il en faut. Le",
        "--  déclencheur de la migration 0016 ne lit que ça : changer le",
        "--  nombre ici le change partout.",
        "insert into fossile_morceau (morceau_id, fossile_id, morceaux_requis) values",
    ]
    lignes.append(
        ",\n".join(
            "  ({}, {}, {})".format(f["morceauId"], f["id"], par) for f in fossiles
        )
    )
    lignes += [
        "on conflict (morceau_id) do update set",
        "  fossile_id = excluded.fossile_id,",
        "  morceaux_requis = excluded.morceaux_requis;",
    ]
    return "\n".join(lignes) + "\n"


def main() -> int:
    try:
        donnees = charger()
    except TableIncoherente as e:
        print(f"data/fossiles.json : {e}", file=sys.stderr)
        return 1

    if "--sql" in sys.argv:
        print(en_sql(donnees), end="")
    elif "--verifier" in sys.argv:
        if not SEED.exists():
            print(
                f"{SEED} manque — lance « python3 outils/fossiles.py --sql > {SEED} »",
                file=sys.stderr,
            )
            return 1
        if SEED.read_text(encoding="utf-8") != en_sql(donnees):
            print(
                "supabase/seeds/fossiles.sql ne correspond pas à data/fossiles.json — "
                "régénère-le",
                file=sys.stderr,
            )
            return 1
        n = len(donnees["fossiles"])
        print(f"   fossiles : {n} fossiles et {n} morceaux, seed à jour")
    else:
        print("voir l'en-tête du fichier", file=sys.stderr)
        return 2
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
