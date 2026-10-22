#!/usr/bin/env python3
"""Écrit `data/butin.json` — ce qu'une fouille donne, zone par zone.

POURQUOI CE FICHIER N'EXISTAIT PAS
──────────────────────────────────
`src/domaine/fouille.ts` le dit en en-tête depuis le 2 octobre : « il
n'existe aujourd'hui aucun catalogue d'objets dans le dépôt, et aucune
annexe ne dit ce qu'on ramasse où. Écrire une table de butin ici, ce
serait inventer dix listes d'objets, une courbe de rareté et une couleur
locale pour chaque zone — des règles de jeu décidées depuis le code. »
Fouiller rendait donc des Pokédollars, et c'est tout.

Deux choses ont changé : `data/objets.json` existe (34 objets, avec
leurs prix), et Callista a demandé la table le 15 octobre.

LES QUATRE RÈGLES, ET D'OÙ CHACUNE VIENT
────────────────────────────────────────
1. **LE PRIX EST LA RARETÉ.** Le poids d'un objet est `1 / prix`,
   normalisé sur la zone. Ce n'est pas une hiérarchie inventée : les
   prix sont déjà dans `data/objets.json`, Callista les a relus, et ils
   disent déjà ce qui est précieux. Conséquence qu'il faut assumer :
   l'Antidote (100 ₽) se trouve deux fois plus souvent que la Poké Ball
   (200 ₽), et le Rappel Max (4 000 ₽) vingt fois moins.

2. **LE PALIER OUVRE LA LISTE.** Un palier 1 trouve le bas de gamme ; un
   palier 2 trouve ça PLUS le milieu ; un palier 3 tout. Le palier est
   le seul axe de difficulté que la donnée définisse déjà
   (`data/zones.json`, et les bornes de Pokédollars de `fouille.ts`).

3. **LA BALL SPÉCIALE SUIT LE TYPE DOMINANT DE LA ZONE**, et ce type est
   MESURÉ, pas supposé : on compte les types des espèces que la zone
   porte dans `data/pokedex-de-rhode.json`. La Plage Grain de Sel sort à
   « eau 54 » sur 69 espèces, le Volcan Nuageux à « feu 25 », les
   Montagnes Embrumées à « electrik 25, acier 16, glace 15 ». La
   correspondance ball → type, elle, est de moi : elle vient de ce que
   la ball fait dans les jeux (Scuba Ball sous l'eau, Filet Ball sur les
   insectes et les Pokémon d'eau, Sombre Ball la nuit).

4. **LES DIX PIERRES D'ÉVOLUTION Y SONT**, depuis le 15 octobre :
   Callista, en lisant la table : « on peut tomber sur une pierre
   d'évolution ». Elles n'y étaient pas, et le motif se tenait —
   `data/objets.json` dit que « l'annexe combat les place à la boutique
   SPÉCIALE de la Station Service » — mais ce n'était pas à moi d'en
   déduire qu'on ne les trouve pas : la boutique garde sa raison d'être,
   qui est qu'on y en ACHÈTE une à coup sûr. En fouille, c'est de la
   chance : 3 000 ₽ au catalogue, donc la règle 1 les met à deux dixièmes
   de pour cent.

   **Six pierres portent leur type dans leur nom** — Feu, Eau, Foudre
   (electrik), Plante, Glace, Nuit (ténèbres et spectre) — et vont donc
   dans les zones de ce type, par la même règle que les balls. Les quatre
   autres — Lune, Soleil, Éclat, Aube — n'en portent aucun : leur donner
   un type serait l'inventer. Elles apparaissent **à partir du palier 2**,
   là où se font les évolutions qu'elles servent.

   LES QUATRE OBJETS TENUS (Peau Métal, Bel'Écaille, Fleur Sucrée, Roche
   Royale) RESTENT DEHORS, eux, et faute d'avoir demandé : ils servent
   des évolutions par ÉCHANGE, un système dont le forum n'a pas décidé.

LES TAUX DE LA FOUILLE ELLE-MÊME
────────────────────────────────
Une fouille, un tirage, cinq issues qui s'excluent et font 100 :

    bredouille           20 %    `fouille.ts`, « une fouille sur cinq ne
                                  donne rien » — déjà en place
    fossile entier      0,8 %    `data/fossiles.json`, posé le 7 octobre
    morceau de fossile    6 %    idem — les deux y sont marqués
                                  « arbitraires, à relire »
    un objet             25 %    NOUVEAU, et c'est le seul taux que ce
                                  fichier invente
    des pokédollars    48,2 %    le reste

CE QUE ÇA CHANGE POUR LE CODE, et il faut le dire : aujourd'hui le
fossile est tiré à PART des Pokédollars (graine fille `:fossile`), donc
une fouille peut donner les deux. Avec une seule table, elle donne UNE
chose. Les taux absolus du fossile ne bougent pas.

    python3 outils/butin.py            écrit data/butin.json
    python3 outils/butin.py --verifier ne l'écrit pas, rend 1 s'il diffère
    python3 outils/butin.py --table    l'imprime en markdown
"""

import collections
import json
import pathlib
import sys

RACINE = pathlib.Path(__file__).resolve().parent.parent
OBJETS = RACINE / "data" / "objets.json"
FOSSILES = RACINE / "data" / "fossiles.json"
ZONES = RACINE / "data" / "zones.json"
FICHES = RACINE / "data" / "especes-fiches.json"
FAUNE = RACINE / "data" / "faune"
SORTIE = RACINE / "data" / "butin.json"

#  Les issues d'une fouille. `objet` est la seule valeur neuve ;
#  `bredouille` vient de fouille.ts, les deux fossiles de fossiles.json,
#  et `pokedollars` est ce qui reste.
PART_BREDOUILLE = 20.0
PART_OBJET = 25.0

#  Règle 2 : ce que chaque palier ouvre, par slug du catalogue. Un palier
#  hérite des précédents.
PAR_PALIER = {
    1: ["poke-ball", "potion", "antidote", "paralyze-heal", "awakening"],
    2: ["great-ball", "super-potion", "burn-heal", "ice-heal", "full-heal"],
    3: ["ultra-ball", "hyper-potion", "revive", "max-potion", "max-revive"],
}

#  Règle 3 : la ball spéciale et le type qui l'appelle. Une zone prend
#  toutes celles dont un type est dans ses trois types dominants.
BALLS_DE_TYPE = {
    "dive-ball": ("eau",),
    "net-ball": ("insecte",),
    "dusk-ball": ("tenebres", "spectre"),
}
#  LA RAPIDE BALL N'A PAS DE TYPE, et j'ai failli lui en inventer un.
#  Premier jet : « fast-ball → vol ». Deux fautes d'un coup — le
#  catalogue l'appelle `quick-ball`, pas `fast-ball`, et dans les jeux
#  elle agit au PREMIER TOUR d'un combat, ce qui n'a rien à voir avec le
#  vol. Elle n'a donc aucune affinité de zone : elle est dans toutes les
#  listes, et son prix (1 000 ₽) la rend rare partout.
BALL_PARTOUT = "quick-ball"
#  La Faiblo Ball n'a pas de type : elle sert à attraper les Pokémon
#  faibles, donc elle va dans les zones de palier 1. C'est la seule
#  entrée de ce fichier qui parle de niveau et pas de type.
BALL_DE_PALIER_1 = "nest-ball"

#  Règle 4 : les pierres d'évolution. Six portent leur type dans leur
#  nom, et suivent donc la zone comme les balls.
PIERRES_DE_TYPE = {
    "fire-stone": ("feu",),
    "water-stone": ("eau",),
    "thunder-stone": ("electrik",),
    "leaf-stone": ("plante",),
    "ice-stone": ("glace",),
    "dusk-stone": ("tenebres", "spectre"),
}
#  Les quatre autres n'ont pas de type dans leur nom. Elles arrivent au
#  palier 2 — c'est le palier des évolutions qu'elles servent — et sont
#  partout à partir de là.
PIERRES_SANS_TYPE = ("moon-stone", "sun-stone", "shiny-stone", "dawn-stone")

#  Combien de types dominants comptent pour la règle 3.
TYPES_DOMINANTS = 3


def catalogue() -> dict[str, dict]:
    objets = json.loads(OBJETS.read_text(encoding="utf-8"))["objets"]
    return {o["slug"]: o for o in objets}


def types_dominants(forumId: int, fiches: dict) -> list[tuple[str, int]]:
    """Les types de la zone, comptés sur ses espèces. Mesuré, pas supposé."""
    table = json.loads((FAUNE / f"{forumId}.json").read_text(encoding="utf-8"))
    compte: collections.Counter = collections.Counter()
    for entree in table["conditions"]["jour"]:
        for t in fiches[str(entree["espece"])]["types"]:
            compte[t] += 1
    return compte.most_common()


def liste_de_la_zone(palier: int, dominants: list[tuple[str, int]]) -> list[str]:
    slugs: list[str] = []
    for p in range(1, palier + 1):
        slugs.extend(PAR_PALIER[p])
    if palier == 1:
        slugs.append(BALL_DE_PALIER_1)
    slugs.append(BALL_PARTOUT)
    hauts = {t for t, _ in dominants[:TYPES_DOMINANTS]}
    for ball, types in BALLS_DE_TYPE.items():
        if hauts.intersection(types):
            slugs.append(ball)
    for pierre, types in PIERRES_DE_TYPE.items():
        if hauts.intersection(types):
            slugs.append(pierre)
    if palier >= 2:
        slugs.extend(PIERRES_SANS_TYPE)
    return slugs


def parts(slugs: list[str], cat: dict[str, dict]) -> list[tuple[str, float]]:
    """Règle 1 : le poids est `1 / prix`, normalisé sur la part objet.

    La dernière ligne absorbe l'arrondi, comme dans les tables de
    rencontre : la somme doit faire EXACTEMENT la part objet, sinon la
    table ne se relit pas.
    """
    poids = [(s, 1 / cat[s]["prix"]) for s in slugs]
    total = sum(p for _, p in poids)
    sortie = [(s, round(PART_OBJET * p / total, 4)) for s, p in poids[:-1]]
    dernier = poids[-1][0]
    sortie.append((dernier, round(PART_OBJET - sum(p for _, p in sortie), 4)))
    return sortie


def construire() -> dict:
    cat = catalogue()
    fiches = json.loads(FICHES.read_text(encoding="utf-8"))["fiches"]
    zones = json.loads(ZONES.read_text(encoding="utf-8"))["zones"]
    fossiles = json.loads(FOSSILES.read_text(encoding="utf-8"))

    entier = fossiles["chanceDEntier"] * 100
    morceau = fossiles["chanceDeMorceau"] * 100
    pokedollars = round(100 - PART_BREDOUILLE - PART_OBJET - entier - morceau, 4)
    if pokedollars <= 0:
        raise SystemExit("REFUS : les parts dépassent 100 — il ne reste rien aux Pokédollars")

    sortie: dict = {
        "_": (
            "Ce qu'une fouille donne, zone par zone. Écrit par outils/butin.py, qui dit "
            "en en-tête ses quatre règles et d'où chacune vient. Les objets et leurs prix "
            "sont ceux de data/objets.json ; les taux de fossile ceux de "
            "data/fossiles.json ; le type dominant de chaque zone est MESURÉ sur ses "
            "espèces. Seule la part « objet » (25 %) est un nombre neuf."
        ),
        "_aRelire": (
            "Trois nombres sont des règles de jeu : la part objet (25 %), et les deux "
            "chances de fossile, qui sont marquées « arbitraires » dans fossiles.json "
            "depuis le 7 octobre. Les changer ici se fait en une ligne."
        ),
        "fouille": {
            "bredouille": PART_BREDOUILLE,
            "fossileEntier": round(entier, 4),
            "morceauDeFossile": round(morceau, 4),
            "objet": PART_OBJET,
            "pokedollars": pokedollars,
        },
        #  Les Pokédollars ne dépendent pas de la zone mais du palier, et
        #  ces bornes sont celles de `fouille.ts` : on les recopie ici
        #  pour que la table se lise seule, et un garde-fou vérifie
        #  qu'elles ne divergent pas.
        "pokedollarsParPalier": {"1": [20, 60], "2": [50, 120], "3": [100, 240]},
        "zones": [],
    }

    for zone in zones:
        dominants = types_dominants(zone["forumId"], fiches)
        slugs = liste_de_la_zone(zone["palier"], dominants)
        lignes = []
        for slug, pct in parts(slugs, cat):
            o = cat[slug]
            lignes.append({
                "objet": o["id"],
                "nom": o["nom"],
                "famille": o["famille"],
                "prix": o["prix"],
                "pct": pct,
            })
        sortie["zones"].append({
            "forumId": zone["forumId"],
            "zone": zone["nom"],
            "palier": zone["palier"],
            "typesDominants": [t for t, _ in dominants[:TYPES_DOMINANTS]],
            "objets": lignes,
        })
    return sortie


def en_markdown(d: dict) -> str:
    lignes = ["| zone | palier | types dominants | objet | taux par fouille |", "|---|---|---|---|---|"]
    for z in d["zones"]:
        premier = True
        for o in sorted(z["objets"], key=lambda x: -x["pct"]):
            lignes.append(
                f"| {z['zone'] if premier else ''} | {z['palier'] if premier else ''} | "
                f"{', '.join(z['typesDominants']) if premier else ''} | "
                f"{o['nom']} | {o['pct']:.2f} % |"
            )
            premier = False
    return "\n".join(lignes)


def main() -> int:
    d = construire()
    texte = json.dumps(d, ensure_ascii=False, indent=1) + "\n"

    if "--table" in sys.argv:
        print(en_markdown(d))
        return 0

    if "--verifier" in sys.argv:
        if not SORTIE.exists() or SORTIE.read_text(encoding="utf-8") != texte:
            print(f"{SORTIE.name} ne correspond pas à ses sources.", file=sys.stderr)
            return 1
        print(f"{SORTIE.name} : {len(d['zones'])} zones, à jour.")
        return 0

    SORTIE.write_text(texte, encoding="utf-8")
    for z in d["zones"]:
        print(
            f"  f{z['forumId']:<4} P{z['palier']} {z['zone']:<22} "
            f"{len(z['objets']):>2} objets · {', '.join(z['typesDominants'])}"
        )
    f = d["fouille"]
    print(
        f"{SORTIE.name} : bredouille {f['bredouille']} % · objet {f['objet']} % · "
        f"fossile {f['fossileEntier']} % · morceau {f['morceauDeFossile']} % · "
        f"pokédollars {f['pokedollars']} %"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
