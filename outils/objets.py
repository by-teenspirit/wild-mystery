#!/usr/bin/env python3
# ════════════════════════════════════════════════════════════════════
#  outils/objets.py
#
#  `data/objets.json` est la SOURCE UNIQUE du catalogue. Deux choses en
#  sont dérivées, et aucune des deux ne se tient à jour toute seule :
#
#    · le seed SQL de la table `objet`, que la boutique relit pour
#      facturer — c'est lui qui fait foi au moment de débiter ;
#    · le message du sujet de boutique, que les joueurs lisent.
#
#  LES DEUX DOIVENT DIRE LE MÊME PRIX. Sinon un joueur commande en
#  voyant 200 et se fait débiter 600, et on perd une soirée à chercher
#  qui a menti. Les dériver du même fichier rend la question impossible.
#
#  Même raison d'être que `outils/especes.py` et le garde-fou n° 9.
#
#  Usage :
#      python3 outils/objets.py --sql        > supabase/seeds/objets.sql
#      python3 outils/objets.py --forum      le message à coller
#      python3 outils/objets.py --verifier   (garde-fou)
# ════════════════════════════════════════════════════════════════════

import json
import pathlib
import re
import sys

RACINE = pathlib.Path(__file__).resolve().parent.parent
CATALOGUE = RACINE / "data" / "objets.json"
MIGRATIONS = RACINE / "supabase" / "migrations"
SEED = RACINE / "supabase" / "seeds" / "objets.sql"

ORDRE_DES_FAMILLES = ["ball", "soin", "statut", "rappel", "evolution", "tenu"]

TITRES = {
    "ball": "Les Balls",
    "soin": "Les soins",
    "statut": "Les soins de statut",
    "rappel": "Les rappels",
    "evolution": "Les pierres d'évolution",
    "tenu": "Les objets à tenir",
}


class CatalogueIncoherent(Exception):
    """Levée plutôt que d'écrire un fichier dérivé qu'on sait faux."""


def familles_du_schema() -> set[str]:
    """Les familles que la base ACCEPTE, lues dans les migrations.

    LA LEÇON DU 5 OCTOBRE. `0001` fixait cinq familles avant qu'un
    catalogue existe ; le catalogue en a inventé six, dont quatre que la
    contrainte refusait. Le seed était cohérent avec `objets.json`, le
    garde-fou disait « à jour », et l'insertion échouait quand même —
    parce que personne ne comparait les deux listes.

    On lit donc la DERNIÈRE contrainte écrite, pas une liste recopiée
    ici : recopier, c'est créer la troisième source qui divergera.
    """
    derniere: set[str] | None = None
    for chemin in sorted(MIGRATIONS.glob("*.sql")):
        texte = chemin.read_text(encoding="utf-8")
        #  On retire les commentaires : une migration explique souvent
        #  l'ancienne contrainte avant de poser la nouvelle.
        nu = re.sub(r"--[^\n]*", "", texte)
        for trouve in re.finditer(r"famille\s+in\s*\(([^)]*)\)", nu, re.S):
            derniere = set(re.findall(r"'([^']+)'", trouve.group(1)))
    if derniere is None:
        raise CatalogueIncoherent(
            "aucune contrainte « famille in (…) » dans supabase/migrations/"
        )
    return derniere


def charger() -> list[dict]:
    donnees = json.loads(CATALOGUE.read_text(encoding="utf-8"))
    objets = donnees["objets"]
    familles = set(donnees["familles"])

    #  Déclarées dans le catalogue ET acceptées par la base. Les deux,
    #  jamais l'une sans l'autre.
    du_schema = familles_du_schema()
    inconnues = familles - du_schema
    if inconnues:
        raise CatalogueIncoherent(
            "famille(s) que la base refuse : "
            + ", ".join(f"« {f} »" for f in sorted(inconnues))
            + " — la contrainte accepte "
            + ", ".join(sorted(du_schema))
        )

    vus_id: dict[int, str] = {}
    vus_slug: dict[str, int] = {}
    for o in objets:
        #  Un id en double, c'est une ligne de sac écrasée par une autre.
        #  Un slug en double, c'est deux objets qui partagent une image.
        if o["id"] in vus_id:
            raise CatalogueIncoherent(f"id {o['id']} en double ({vus_id[o['id']]} et {o['nom']})")
        if o["slug"] in vus_slug:
            raise CatalogueIncoherent(f"slug « {o['slug']} » en double")
        if o["famille"] not in familles:
            raise CatalogueIncoherent(f"{o['nom']} : famille « {o['famille']} » non déclarée")
        #  `prix` entre dans `quantite::int * prix` côté PostgreSQL, un
        #  entier 32 bits. Un prix absurde déborde avant d'être refusé.
        if not isinstance(o["prix"], int) or not (0 < o["prix"] <= 1_000_000):
            raise CatalogueIncoherent(f"{o['nom']} : prix hors bornes ({o['prix']})")
        vus_id[o["id"]] = o["nom"]
        vus_slug[o["slug"]] = o["id"]
    return objets


def guillemets(texte: str) -> str:
    return "'" + texte.replace("'", "''") + "'"


def en_sql(objets: list[dict]) -> str:
    lignes = [
        "--  DÉRIVÉ DE data/objets.json — NE PAS MODIFIER À LA MAIN.",
        "--  Régénérer avec : python3 outils/objets.py --sql > supabase/seeds/objets.sql",
        "--",
        "--  `on conflict do update` et pas `insert` seul : ce fichier se",
        "--  rejoue à chaque déploiement, et un prix qui change doit",
        "--  s'appliquer sans vider la table — les sacs des joueurs",
        "--  référencent ces lignes.",
        "--",
        "--  `overriding system value` : `objet.id` est",
        "--  `generated always as identity`, et PostgreSQL refuse un id",
        "--  explicite sans ça — « cannot insert a non-DEFAULT value into",
        "--  column id ». Or les identifiants du catalogue ne sont pas",
        "--  négociables : ils sont écrits dans le message du sujet de",
        "--  boutique (`data-wm-objet`) et dans les lignes de registre",
        "--  déjà posées. C'est la base qui s'adapte, pas eux.",
        "--",
        "--  La séquence n'est PAS déplacée : voir la migration 0010.",
        "",
        "insert into objet (id, slug, nom, famille, prix, en_vente)",
        "overriding system value values",
    ]
    corps = [
        "  ({}, {}, {}, {}, {}, {})".format(
            o["id"],
            guillemets(o["slug"]),
            guillemets(o["nom"]),
            guillemets(o["famille"]),
            o["prix"],
            "true" if o["enVente"] else "false",
        )
        for o in objets
    ]
    lignes.append(",\n".join(corps))
    lignes.append("on conflict (id) do update set")
    lignes.append("  slug = excluded.slug,")
    lignes.append("  nom = excluded.nom,")
    lignes.append("  famille = excluded.famille,")
    lignes.append("  prix = excluded.prix,")
    lignes.append("  en_vente = excluded.en_vente;")
    return "\n".join(lignes) + "\n"


def en_forum(objets: list[dict]) -> str:
    """Le premier message du sujet de boutique, en BBCode.

    LE CATALOGUE EST ÉCRIT EN DUR DEDANS, et c'est la planche 30 :
    « sans JavaScript, le message reste lisible et on commande à la
    main ». Le script ne fait qu'ajouter les compteurs et le panier
    par-dessus une liste qui existe déjà.

    Chaque ligne porte son identifiant dans un attribut que le script
    lit — pas dans le texte visible, qui doit rester un catalogue
    lisible par un humain.
    """
    #  EN HTML, ET PAS EN BBCODE INVENTÉ. Une balise `[wm-objet=…]` que
    #  Forumactif ne connaît pas s'afficherait telle quelle au milieu du
    #  catalogue. Le HTML passe dans les messages de ce forum — les
    #  sujets de service de la V1 en contiennent déjà (`<center><div
    #  class="bk1">` dans le marchand du refuge).
    #
    #  L'IDENTIFIANT EST DANS UN ATTRIBUT, PAS DANS LE TEXTE. Le texte
    #  doit rester un catalogue lisible par un humain qui n'a pas de
    #  JavaScript ; `data-wm-objet` est ce que le script lit.
    out = [
        '<div class="wm-boutique">',
        "<h2>La Boutique Générale de Rhode</h2>",
        "<p>Tout ce qui s'achète à Rhode est ici. Les prix sont en Pokédollars.</p>",
        "<p><b>Pour commander :</b> cliquez sur les <b>+</b> pour remplir votre panier, "
        "puis sur <b>Valider</b>. Le bouton remplit la réponse rapide — "
        "<b>rien ne part sans vous</b>, vous pouvez ajouter un mot avant d'envoyer.</p>",
        "<p>Sans JavaScript, la liste reste lisible : recopiez ce que vous voulez "
        "dans votre réponse, le staff s'en occupera.</p>",
    ]
    for famille in ORDRE_DES_FAMILLES:
        dedans = [o for o in objets if o["famille"] == famille and o["enVente"]]
        if not dedans:
            continue
        out.append(f'<h3 class="wm-boutique__famille">{TITRES[famille]}</h3>')
        out.append('<ul class="wm-boutique__liste">')
        for o in dedans:
            out.append(
                f'<li data-wm-objet="{o["id"]}">'
                f'<span class="wm-boutique__nom">{o["nom"]}</span> '
                f'<span class="wm-boutique__prix">{o["prix"]} ₽</span></li>'
            )
        out.append("</ul>")
    out.append(
        "<p><i>Les prix sont relus par le serveur au moment de facturer : "
        "ce qui est écrit ici est indicatif, c'est la base qui fait foi.</i></p>",
    )
    out.append("</div>")
    return "\n".join(out) + "\n"


def main() -> int:
    try:
        objets = charger()
    except CatalogueIncoherent as e:
        print(f"data/objets.json : {e}", file=sys.stderr)
        return 1

    if "--sql" in sys.argv:
        print(en_sql(objets), end="")
    elif "--forum" in sys.argv:
        print(en_forum(objets), end="")
    elif "--verifier" in sys.argv:
        if not SEED.exists():
            print(f"{SEED} manque — lance « python3 outils/objets.py --sql > {SEED} »", file=sys.stderr)
            return 1
        if SEED.read_text(encoding="utf-8") != en_sql(objets):
            print(
                "supabase/seeds/objets.sql ne correspond pas à data/objets.json — "
                "régénère-le",
                file=sys.stderr,
            )
            return 1
        print(f"   objets : {len(objets)} au catalogue, seed à jour")
    else:
        print(__doc__ or "voir l'en-tête du fichier", file=sys.stderr)
        return 2
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
