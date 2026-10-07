#!/usr/bin/env python3
# ════════════════════════════════════════════════════════════════════
#  outils/zones-neuves.py
#
#  Génère les tables de rencontre des SEPT ZONES NEUVES, celles que la
#  V1 n'avait pas et qui n'ont donc aucune table sur le forum.
#
#  ── CE QUE CE SCRIPT INVENTE, ET CE QU'IL N'INVENTE PAS ──────────────
#
#  Il N'INVENTE PAS la répartition des espèces : elle vient de la
#  planche 39, où Callista l'a arrêtée. Il ne fait que la mettre en
#  forme.
#
#  Il INVENTE trois choses, et il faut les savoir :
#
#  1. **UN SEUL LIEU PAR ZONE.** Les dix zones de la V1 ont 13 à 16
#     lieux chacune. Les sept neuves n'en ont aucun, et en écrire une
#     centaine serait écrire du décor à la place de l'autrice. Chaque
#     zone reçoit donc UN lieu, qui porte son propre nom. Découper plus
#     tard n'abîmera rien : on remplace un lieu par quinze.
#
#  2. **DES POURCENTAGES ÉGAUX.** Les tables de la V1 ont été écrites à
#     la main, et n'obéissent à aucune règle qu'on puisse recopier :
#     9 à 12 entrées, des pourcentages à 5, 8, 9, 10 et 12. Il n'y a
#     donc rien à imiter. Le poids égal est le seul choix qui n'invente
#     pas de hiérarchie entre les espèces — et il se défend : la
#     planche 39 répartit DÉJÀ par stade d'évolution, donc une zone ne
#     mélange pas un Pokémon de base et une forme finale.
#
#  3. **JOUR ET NUIT IDENTIQUES.** Les deux conditions existent parce
#     que le code en attend une, pas parce qu'on sait ce qui change la
#     nuit dans un manoir hanté. Les écrire différentes serait inventer
#     une règle ; les écrire pareilles dit honnêtement « pas encore
#     décidé ».
#
#  ── LES NIVEAUX VIENNENT DES PALIERS ─────────────────────────────────
#
#  Planche 39 : palier 2 « niveaux recommandés 15 à 40 », palier 3
#  « 35 et plus ». C'est une donnée, pas une invention. La fourchette
#  d'une espèce est une tranche de cette bande, assise sur son rang dans
#  la liste — les premières citées sont les plus faciles, c'est l'ordre
#  qu'a suivi la planche.
# ════════════════════════════════════════════════════════════════════

import json
import pathlib
import sys

RACINE = pathlib.Path(__file__).resolve().parent.parent
ZONES = RACINE / "data" / "zones.json"
FAUNE = RACINE / "data" / "faune"

#  Les bandes de niveau, par palier. Planche 39.
BANDES = {2: (15, 40), 3: (35, 55)}

#  Les trois raretés des fichiers de la V1, et la part de la bande de
#  niveau qu'elles couvrent. Une espèce « rare » est une espèce de haut
#  de bande : c'est ce que font les tables existantes.
SEUILS = ((0.50, "commun"), (0.80, "peu commun"), (1.01, "rare"))


def rarete(rang: int, total: int) -> str:
    part = (rang + 1) / total
    for seuil, nom in SEUILS:
        if part <= seuil:
            return nom
    return "rare"


def niveaux(rang: int, total: int, bande: tuple[int, int]) -> tuple[int, int]:
    """Une tranche de la bande, selon le rang dans la liste.

    L'amplitude est de 5 niveaux, comme dans les tables de la V1, et le
    bas de la tranche monte avec le rang. La dernière espèce ne dépasse
    jamais le haut de la bande.
    """
    bas, haut = bande
    etendue = max(haut - bande[0] - 5, 1)
    mini = bas + round(etendue * rang / max(total - 1, 1))
    return mini, min(mini + 5, haut)


def pourcentages(n: int) -> list[float]:
    """n parts égales dont la somme fait EXACTEMENT 100.

    `verifieTable` tolère 0,001 d'écart. Avec 62 espèces, 100/62 arrondi
    à deux décimales dérive de 0,04 — assez pour faire tomber la table.
    On arrondit donc tout sauf la dernière, qui absorbe le reste.
    """
    part = round(100 / n, 4)
    parts = [part] * (n - 1)
    parts.append(round(100 - sum(parts), 4))
    return parts


def table(especes: list[list], bande: tuple[int, int]) -> list[dict]:
    n = len(especes)
    pcts = pourcentages(n)
    sortie = []
    for rang, ((espece, nom), pct) in enumerate(zip(especes, pcts)):
        mini, maxi = niveaux(rang, n, bande)
        sortie.append({
            "espece": espece,
            "nom": nom,
            "pct": pct,
            "min": mini,
            "max": maxi,
            "rarete": rarete(rang, n),
        })
    return sortie


def main() -> int:
    resolu = json.loads(pathlib.Path(sys.argv[1]).read_text(encoding="utf-8"))
    zones = json.loads(ZONES.read_text(encoding="utf-8"))["zones"]
    par_nom = {z["nom"]: z for z in zones}

    ecrits = []
    for nom, especes in resolu.items():
        zone = par_nom.get(nom)
        if zone is None:
            print(f"REFUS : « {nom} » n'est pas dans data/zones.json", file=sys.stderr)
            return 1
        if zone["lieux"] != 0:
            print(f"REFUS : « {nom} » a déjà {zone['lieux']} lieux — on n'écrase pas", file=sys.stderr)
            return 1
        bande = BANDES.get(zone["palier"])
        if bande is None:
            print(f"REFUS : palier {zone['palier']} sans bande de niveau", file=sys.stderr)
            return 1

        t = table(especes, bande)
        fichier = {
            "forumId": zone["forumId"],
            "zone": nom,
            "palier": zone["palier"],
            "_": (
                "Zone NEUVE : la V1 ne l'avait pas, elle n'a donc aucune table d'origine. "
                "Un seul lieu, pourcentages égaux, jour et nuit identiques — "
                "voir l'en-tête de outils/zones-neuves.py. À découper en lieux quand "
                "l'annexe de la zone sera écrite."
            ),
            #  Le lieu porte le nom de la zone : le bouton de la barre
            #  d'actions affiche « Chercher à <lieu> », et « Chercher à
            #  Manoir Barjok » se lit mieux que « Chercher à Toute la zone ».
            "lieux": {nom: {"jour": t, "nuit": t}},
        }
        chemin = FAUNE / f"{zone['forumId']}.json"
        chemin.write_text(
            json.dumps(fichier, ensure_ascii=False, indent=1) + "\n", encoding="utf-8"
        )
        ecrits.append((chemin.name, nom, len(t)))

    for f, nom, n in ecrits:
        print(f"  {f:10} {nom:22} {n:3} espèces")
    print(f"{len(ecrits)} fichiers écrits.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
