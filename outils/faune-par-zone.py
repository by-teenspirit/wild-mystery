#!/usr/bin/env python3
"""Écrit les dix-sept tables de rencontre, **une par zone, sans lieu**.

CE QUI A CHANGÉ LE 15 OCTOBRE
─────────────────────────────
Callista : « enlève tous les petits lieux. On a 3 paliers, 17 zones
sauvages, et tu répartis le pokédex comme ça. »

Le niveau « lieu » disparaît donc du jeu. Une zone sauvage EST le lieu,
et sa table de rencontre est la liste du Pokédex de Rhode pour cette
zone — `data/pokedex-de-rhode.json`, recopié de la planche 39.

Les 145 lieux et 298 tables de la V1, écrits de sa main, sont dans
`data/faune-v1/` avec une note. Ils ne sont pas fusionnés ici : leurs
pourcentages ne décrivent une chance que *dans un lieu*, et les
additionner aurait réécrit la rareté qu'ils dessinaient.

CE QUE CE SCRIPT INVENTE, ET CE QU'IL N'INVENTE PAS
───────────────────────────────────────────────────
Il N'INVENTE PAS **quelle espèce vit dans quelle zone** : ça vient de la
planche 39, où Callista l'a arrêtée, par type dominant de la zone et par
stade d'évolution. Il ne fait que la mettre en forme.

Il invente trois choses, les mêmes que `zones-neuves.py` inventait pour
les sept zones neuves depuis le 12 octobre — on ne change pas les règles
en élargissant leur portée :

1. **LE POIDS SUIT LA RARETÉ : 6 / 3 / 1.** Choisi par Callista le
   15 octobre, après avoir vu les chiffres des trois pondérations
   possibles (planche 75). Un « commun » apparaît six fois plus souvent
   qu'un « rare », et la rareté vient du rang dans la liste de la
   planche 39 — les formes de base d'abord.

   **CE QUE CE FICHIER FAISAIT AVANT, ET POURQUOI C'ÉTAIT UN DÉFAUT :**
   des parts égales, « le seul choix qui n'invente pas de hiérarchie ».
   Le raisonnement tenait, mais il laissait dans chaque fichier une
   colonne `rarete` qui ne changeait RIEN : une espèce marquée « rare »
   apparaissait aussi souvent qu'une « commune ». Une donnée qui
   n'agit pas est une donnée qui ment.

2. **JOUR ET NUIT IDENTIQUES.** Les deux conditions existent parce que
   le code en attend une, pas parce qu'on sait ce qui change la nuit. Les
   écrire différentes serait inventer une règle ; les écrire pareilles
   dit honnêtement « pas encore décidé ».

3. **LES NIVEAUX, tirés de la bande du palier** et du rang de l'espèce
   dans la liste. La bande est une donnée (planche 39 : palier 1 « 1 à
   20 », palier 2 « 15 à 40 », palier 3 « 35 et plus ») ; l'étalement sur
   la bande selon le rang est de moi, et il suit l'ordre de la planche,
   qui va des formes de base aux formes finales.

PLUS DE TABLE DE MÉTÉO, POUR L'INSTANT
──────────────────────────────────────
Sept zones de la V1 avaient une table de météo — pluie, brouillard,
blizzard, tempête de sable, soleil écrasant, pluie de cendres, orage —
mais **pour un seul de leurs lieux**. Sans lieu, il n'y a plus rien à
quoi l'accrocher, et donner à la météo la même liste que « jour »
serait écrire une condition qui ne change rien. On écrit donc `jour` et
`nuit` seulement ; `domaine/meteo.ts` retombe déjà sur l'une des deux
quand une condition manque. Les anciennes tables de météo sont dans
`data/faune-v1/` si elles doivent revenir.

    python3 outils/faune-par-zone.py            écrit data/faune/*.json
    python3 outils/faune-par-zone.py --verifier ne l'écrit pas, rend 1 s'il diffère
"""

import json
import pathlib
import sys

RACINE = pathlib.Path(__file__).resolve().parent.parent
POKEDEX = RACINE / "data" / "pokedex-de-rhode.json"
IDS = RACINE / "data" / "pokedex-ids.json"
ZONES = RACINE / "data" / "zones.json"
FAUNE = RACINE / "data" / "faune"

#  Les bandes de niveau, par palier. Planche 39, « niveaux recommandés ».
#  Le haut du palier 3 est à 55 : la planche dit « 35 et plus », et il
#  faut bien un haut pour tirer un niveau.
BANDES = {1: (1, 20), 2: (15, 40), 3: (35, 55)}

#  Les trois raretés des fichiers de la V1, et la part de la liste
#  qu'elles couvrent. Une espèce « rare » est une espèce de haut de
#  bande : c'est ce que faisaient les tables existantes.
SEUILS = ((0.50, "commun"), (0.80, "peu commun"), (1.01, "rare"))

#  Le poids d'une rareté dans le tirage. Rapport choisi par Callista :
#  « 6 / 3 / 1 ». Changer ces trois nombres et relancer le script suffit
#  à refaire les dix-sept tables.
POIDS = {"commun": 6, "peu commun": 3, "rare": 1}

NOTE = (
    "Une table par ZONE, sans niveau de lieu — décidé par Callista le 15 octobre : "
    "« on a 3 paliers, 17 zones sauvages, et tu répartis le pokédex comme ça ». "
    "Les espèces viennent de data/pokedex-de-rhode.json (planche 39) ; la "
    "pondération 6/3/1 par rareté est un choix de Callista du 15 octobre ; jour = nuit "
    "et l'étalement des niveaux sont de "
    "outils/faune-par-zone.py, qui dit en en-tête ce qu'il invente. Les 145 lieux de "
    "la V1 sont gardés dans data/faune-v1/."
)


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
    etendue = max(haut - bas - 5, 1)
    mini = bas + round(etendue * rang / max(total - 1, 1))
    return mini, min(mini + 5, haut)


def pourcentages(raretes: list[str]) -> list[float]:
    """Les parts, pondérées par rareté, dont la somme fait EXACTEMENT 100.

    `verifieTable` tolère 0,001 d'écart. Avec 73 espèces, un quotient
    arrondi à deux décimales dérive assez pour faire tomber la table. On
    arrondit donc tout sauf la dernière, qui absorbe le reste — et comme
    la liste finit par les « rares », c'est la part la plus petite qui
    porte l'arrondi, donc l'écart relatif y est le plus visible. C'est le
    bon endroit : une part qu'on ne voit pas bouger est une part dont on
    ne saura jamais si elle est juste.
    """
    poids = [POIDS[r] for r in raretes]
    total = sum(poids)
    parts = [round(100 * p / total, 4) for p in poids[:-1]]
    parts.append(round(100 - sum(parts), 4))
    return parts


def table(especes: list[str], ids: dict[str, int], bande: tuple[int, int]) -> list[dict]:
    n = len(especes)
    raretes = [rarete(rang, n) for rang in range(n)]
    parts = pourcentages(raretes)
    sortie = []
    for rang, (nom, pct) in enumerate(zip(especes, parts)):
        mini, maxi = niveaux(rang, n, bande)
        sortie.append({
            "espece": ids[nom],
            "nom": nom,
            "pct": pct,
            "min": mini,
            "max": maxi,
            "rarete": raretes[rang],
        })
    return sortie


def construire() -> dict[pathlib.Path, str]:
    pokedex = json.loads(POKEDEX.read_text(encoding="utf-8"))
    ids = json.loads(IDS.read_text(encoding="utf-8"))["ids"]
    zones = {z["forumId"]: z for z in json.loads(ZONES.read_text(encoding="utf-8"))["zones"]}

    fichiers: dict[pathlib.Path, str] = {}
    for entree in pokedex["zones"]:
        zone = zones.get(entree["forumId"])
        if zone is None:
            raise SystemExit(f"REFUS : f{entree['forumId']} n'est pas dans data/zones.json")
        bande = BANDES.get(zone["palier"])
        if bande is None:
            raise SystemExit(f"REFUS : palier {zone['palier']} sans bande de niveau")
        absents = [n for n in entree["especes"] if n not in ids]
        if absents:
            raise SystemExit(
                f"REFUS : {entree['zone']} — sans identifiant : {', '.join(absents)}"
            )

        t = table(entree["especes"], ids, bande)
        fichiers[FAUNE / f"{zone['forumId']}.json"] = json.dumps(
            {
                "forumId": zone["forumId"],
                "zone": entree["zone"],
                "palier": zone["palier"],
                "_": NOTE,
                #  JOUR ET NUIT PORTENT LA MÊME TABLE, pas deux copies
                #  divergentes : écrites par le même objet, elles ne
                #  peuvent pas se désaccorder au fil des regénérations.
                "conditions": {"jour": t, "nuit": t},
            },
            ensure_ascii=False,
            indent=1,
        ) + "\n"
    return fichiers


def main() -> int:
    fichiers = construire()

    if "--verifier" in sys.argv:
        faux = [
            c.name for c, texte in fichiers.items()
            if not c.exists() or c.read_text(encoding="utf-8") != texte
        ]
        #  UN FICHIER DE FAUNE EN TROP est un défaut, lui aussi : une
        #  zone retirée de zones.json laisserait sa table derrière elle,
        #  et plus rien ne la vérifierait.
        attendus = {c.name for c in fichiers}
        orphelins = [c.name for c in FAUNE.glob("*.json") if c.name not in attendus]
        if faux or orphelins:
            if faux:
                print(f"ne correspondent pas au Pokédex : {', '.join(faux)}", file=sys.stderr)
            if orphelins:
                print(f"tables sans zone : {', '.join(orphelins)}", file=sys.stderr)
            return 1
        print(f"data/faune : {len(fichiers)} tables, à jour.")
        return 0

    for chemin, texte in fichiers.items():
        chemin.write_text(texte, encoding="utf-8")
    for chemin, texte in sorted(fichiers.items(), key=lambda c: len(c[1])):
        donnees = json.loads(texte)
        n = len(donnees["conditions"]["jour"])
        print(f"  {chemin.name:10} palier {donnees['palier']}  {donnees['zone']:22} {n:3} espèces")
    print(f"{len(fichiers)} tables écrites.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
