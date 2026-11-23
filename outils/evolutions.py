#!/usr/bin/env python3
"""Fabrique `data/evolutions.json` : qui évolue vers qui, et à quelle
condition.

POURQUOI UNE SOURCE EXTÉRIEURE, ET LAQUELLE
────────────────────────────────────────────
Les deux colonnes `espece.evolue_vers` et `espece.niveau_evolution`
existent depuis la première migration et n'ont JAMAIS été remplies :
`outils/especes-sql.py` le dit lui-même, elles « restent » vides. Rien
dans le dépôt ne sait qui évolue vers qui, parce que les tables de faune
ne portent que des identifiants et des noms.

Il n'y avait donc pas de donnée à dériver : il fallait l'aller chercher.
Elle vient des tables de PokéAPI, servies depuis GitHub — le seul hôte
que le conteneur sache joindre en dehors des registres de paquets. Ce
sont les mêmes chiffres que Poképédia, auquel l'annexe V1 renvoie déjà
les joueurs.

LES IDENTIFIANTS DE CALLISTA SONT CEUX DE POKÉAPI, et c'est ce qui rend
la jointure possible : 1 à 1025 sont les numéros du Pokédex national, et
les formes régionales portent l'identifiant de `pokemon.csv` (Raichu
d'Alola = 10100). On ne traduit rien.

CE QUE L'ANNEXE CHANGE PAR RAPPORT AUX JEUX
────────────────────────────────────────────
L'annexe « Faire évoluer son pokémon » ne suit pas les jeux partout, et
ces écarts sont appliqués ICI plutôt que dans le code qui lira le
fichier — un écart appliqué à la lecture serait un écart à réappliquer
dans chaque lecteur :

· **L'ÉCHANGE DEVIENT LE NIVEAU 40.** « Le système d'échange de Wild
  Mystery ne nous permet pas de suivre les jeux sur ce terrain. Aussi,
  il vous suffira d'emmener votre pokémon au lvl 40. » Et quand
  l'échange demandait un objet tenu, « seul l'objet est nécessaire » —
  donc l'objet, et pas le niveau 40.
· **LE BONHEUR EST UNE JAUGE DE CINQ ÉTOILES**, pas les 220 points des
  jeux : une étoile par RP clôturé avec le Pokémon en équipe, cinq en
  tout, puis un niveau de plus. Le seuil chiffré de PokéAPI ne sert donc
  qu'à RECONNAÎTRE une évolution par bonheur ; il n'est pas recopié.
· **PLUSIEURS ÉVOLUTIONS POSSIBLES = LE CHOIX DU JOUEUR.** « Si le
  pokémon a plusieurs formes d'évolution possible selon certaines
  statistiques, elles sont laissées à votre choix sur WM (Chenipotte :
  Blindalys ou Armulys, Débugant : Kiclee, Tygnon ou Kapoera). » On rend
  donc une LISTE par espèce, et les conditions de départage des jeux
  — les statistiques, la beauté, l'affection — tombent.
· **LES FORMES RÉGIONALES SONT AU CHOIX AUSSI.** « Pikachu : vous pouvez
  choisir de le faire évoluer en Raichu ou Raichu d'Alola avec une pierre
  foudre. » La forme régionale est donc ajoutée comme cible
  SUPPLÉMENTAIRE de l'évolution de base, à la même condition, dès
  qu'elle est dans `especes.json`. On n'a pas besoin de la logique de
  région de PokéAPI, qui est tordue.
· **LA MÉTÉO, NON.** « La météo, on fait pas » — 23 novembre. Une
  évolution qui demandait la pluie ou un lieu tombe donc en `special` :
  elle existe, elle est nommée, et c'est le staff qui tranche.
· **LE JOUR ET LA NUIT, SI.** Ils se calculent avec une horloge, sans
  rien demander à personne, et Mentali et Noctali en dépendent.

ET LES DIX EXCEPTIONS DE L'ANNEXE PASSENT EN DERNIER, parce qu'elles
sont écrites pour remplacer ce que les jeux disent.

CE QUI N'EST PAS AUTOMATISABLE RESTE VISIBLE
─────────────────────────────────────────────
Une évolution qu'on ne sait pas vérifier n'est pas effacée : elle sort
avec `par: "special"` et la raison en clair. Un fichier qui tairait
Carapuce-de-l'espace serait un fichier dans lequel on ne peut pas voir
ce qui manque. Le code refusera ces demandes en disant quoi, et le staff
les appliquera à la main.

    python3 outils/evolutions.py            écrit data/evolutions.json
    python3 outils/evolutions.py --verifier ne l'écrit pas, rend 1 s'il diffère
"""

import csv
import json
import pathlib
import sys
import urllib.request

R = pathlib.Path(__file__).resolve().parent.parent
BASE = "https://raw.githubusercontent.com/PokeAPI/pokeapi/master/data/v2/csv"
CACHE = pathlib.Path("/tmp/pokeapi")

#  Le français est la langue 5 chez PokéAPI. On ne lit que celle-là :
#  tous les noms de ce dépôt sont français, et un objet nommé en anglais
#  dans un fichier de données finirait par s'afficher à un joueur.
FR = "5"

TABLES = [
    "pokemon_evolution",
    "pokemon_species",
    "evolution_triggers",
    "item_names",
    "move_names",
    "type_names",
    "ability_names",
    "pokemon_abilities",
    "pokemon",
]


def lire(nom):
    """La table, depuis le cache si elle y est, sinon depuis GitHub."""
    CACHE.mkdir(parents=True, exist_ok=True)
    f = CACHE / (nom + ".csv")
    if not f.exists():
        with urllib.request.urlopen(f"{BASE}/{nom}.csv", timeout=60) as r:
            f.write_bytes(r.read())
    with f.open(encoding="utf-8") as h:
        return list(csv.DictReader(h))


def noms_fr(table, clef):
    return {
        l[clef]: l["name"] for l in lire(table) if l.get("local_language_id") == FR
    }


#  ── LES ÉCARTS DE L'ANNEXE, ÉCRITS UNE FOIS ────────────────────────
#
#  Elles passent APRÈS tout le reste et REMPLACENT ce que les jeux
#  disent. Chacune est recopiée de l'annexe, sans rien y ajouter.
EXCEPTIONS = {
    #  « Sépiatop : Évolution au niveau 30. »
    686: [(687, "niveau", {"niveau": 30})],
    #  « Tarinor : Évolution au niveau 40. »
    622: [(623, "niveau", {"niveau": 40})],
    #  « Tutafeh de Galar : Évolution au niveau 34. »  (forme de Galar)
    10188: [(563, "niveau", {"niveau": 34})],
    #  « Barpau : Évolution au niveau 40 avec l'objet Bel'Écaille. »
    366: [(367, "objet", {"objet": "Bel'Écaille", "niveau": 40})],
    #  « Escargaume et Carabing : Évolution au niveau 25. »
    616: [(617, "niveau", {"niveau": 25})],
    588: [(589, "niveau", {"niveau": 25})],
    #  « Magnéton : Évolution avec une Pierre Foudre. »
    82: [(462, "objet", {"objet": "Pierre Foudre"})],
    #  « Chrysapile : Évolution avec une Pierre Foudre »
    602: [(603, "objet", {"objet": "Pierre Foudre"})],
    #  « Crabominable : Évolution avec une Pierre Glace »  (Crabagarre →)
    739: [(740, "objet", {"objet": "Pierre Glace"})],
    #  « Crémy : Évolution avec une Fleur Sucrée »
    868: [(869, "objet", {"objet": "Fleur Sucrée"})],
    #  « Évoli : Évolution avec une Pierre Plante pour Phyllali et une
    #    Pierre Glace pour Givrali. »  Les six autres voies d'Évoli
    #    restent celles des jeux ; seules ces deux-là sont réécrites, et
    #    c'est pour ça qu'elles s'ajoutent au lieu de remplacer.
}
#  Celles d'Évoli s'AJOUTENT : l'annexe ne parle que de deux de ses huit
#  formes, et effacer les six autres serait lui faire dire ce qu'elle ne
#  dit pas.
AJOUTS = {
    133: [
        (470, "objet", {"objet": "Pierre Plante"}),
        (471, "objet", {"objet": "Pierre Glace"}),
    ],
}

#  Le niveau de remplacement d'un échange, et c'est l'annexe qui le fixe.
NIVEAU_ECHANGE = 40


def construire():
    especes_wm = json.loads((R / "data/especes.json").read_text())["especes"]
    connues = {int(k) for k in especes_wm}
    nom_de = {int(k): v for k, v in especes_wm.items()}

    catalogue = json.loads((R / "data/objets.json").read_text())["objets"]

    #  ── L'APOSTROPHE COURBE A FAILLI COÛTER TROIS OBJETS ──────────────
    #
    #  PokéAPI écrit « Bel’Écaille » avec l'apostrophe typographique ;
    #  le catalogue écrit « Bel'Écaille » avec la droite. La jointure
    #  ratait, et l'objet sortait « absent du catalogue » alors qu'il y
    #  est — ce qui aurait fait refuser une évolution que le jeu
    #  autorise, sans que rien ne le dise.
    #
    #  Deux fichiers écrits par deux mains ne s'accorderont jamais sur
    #  ce caractère-là. On compare donc sur une forme normalisée, et on
    #  garde le nom DU CATALOGUE à l'affichage : c'est celui que le
    #  joueur voit dans son sac.
    def plat(nom):
        return nom.replace("’", "'").replace("‘", "'").strip().casefold()

    objet_id = {plat(o["nom"]): o["id"] for o in catalogue}
    objet_nom = {plat(o["nom"]): o["nom"] for o in catalogue}

    especes = lire("pokemon_species")
    vient_de = {
        int(l["id"]): int(l["evolves_from_species_id"])
        for l in especes
        if l["evolves_from_species_id"]
    }
    declencheur = {l["id"]: l["identifier"] for l in lire("evolution_triggers")}
    objets = noms_fr("item_names", "item_id")
    attaques = noms_fr("move_names", "move_id")
    types = noms_fr("type_names", "type_id")
    talents = noms_fr("ability_names", "ability_id")

    #  ── LES FORMES RÉGIONALES QUE CALLISTA A ──────────────────────────
    #
    #  `pokemon.csv` donne, pour chaque forme, l'espèce dont elle relève.
    #  On ne garde que celles qui sont dans `especes.json` : une forme
    #  qu'aucune zone ne porte et qui n'est pas dans `hors-nature.json`
    #  n'existe pas sur ce forum.
    formes = {}
    for l in lire("pokemon"):
        i = int(l["id"])
        if i > 10000 and i in connues:
            formes.setdefault(int(l["species_id"]), []).append(i)

    sortie = {}
    vus = set()

    def poser(source, cible, par, extra=None):
        if source not in connues or cible not in connues:
            return
        ligne = {"vers": cible, "nom": nom_de[cible], "par": par}
        ligne.update(extra or {})
        clef = (source, cible, par, json.dumps(ligne, sort_keys=True))
        if clef in vus:
            return
        vus.add(clef)
        sortie.setdefault(source, []).append(ligne)

    for l in lire("pokemon_evolution"):
        cible = int(l["evolved_species_id"])
        source = vient_de.get(cible)
        if source is None:
            continue
        quoi = declencheur[l["evolution_trigger_id"]]
        niveau = int(l["minimum_level"]) if l["minimum_level"] else None
        tenu = int(l["held_item_id"]) if l["held_item_id"] else None
        objet = int(l["trigger_item_id"]) if l["trigger_item_id"] else None
        moment = l["time_of_day"] or None
        attaque = int(l["known_move_id"]) if l["known_move_id"] else None
        type_attaque = (
            int(l["known_move_type_id"]) if l["known_move_type_id"] else None
        )
        bonheur = bool(l["minimum_happiness"])

        #  CE QU'ON NE SAIT PAS VÉRIFIER, dans l'ordre où on le
        #  rencontre. La météo est en tête parce que Callista l'a
        #  refusée explicitement ; le reste demande des faits que la base
        #  n'a pas — un lieu, un sexe, une nature, un Pokémon dans
        #  l'équipe.
        empeche = None
        if l["needs_overworld_rain"] == "1":
            empeche = "il faut qu'il pleuve, et la météo n'existe pas ici"
        elif l["location_id"]:
            empeche = "il faut être à un endroit précis, que Rhode ne porte pas"
        elif l["gender_id"]:
            empeche = "il faut un sexe, et nos Pokémon n'en ont pas"
        elif l["party_species_id"] or l["party_type_id"]:
            empeche = "il faut un autre Pokémon dans l'équipe"
        elif l["nature_bitmask"] or l["minimum_beauty"] or l["minimum_affection"]:
            empeche = "il faut une nature, une beauté ou une affection qu'on ne tient pas"
        elif l["turn_upside_down"] == "1":
            empeche = "il faut retourner la console"
        elif l["needs_multiplayer"] == "1" or l["near_special_rock"] == "1":
            empeche = "il faut un autre joueur ou un rocher particulier"
        elif l["relative_physical_stats"]:
            empeche = "il faut comparer deux statistiques, que l'annexe laisse au choix"
        elif quoi not in ("level-up", "trade", "use-item"):
            empeche = f"la façon d'évoluer ({quoi}) n'a pas d'équivalent ici"

        if empeche is not None:
            poser(source, cible, "special", {"pourquoi": empeche})
            continue

        #  ── L'ÉCHANGE DEVIENT LE NIVEAU 40, OU L'OBJET SEUL ───────────
        if quoi == "trade":
            if tenu is not None:
                #  « seul l'objet est nécessaire » : pas de niveau.
                poser(source, cible, "objet", {"objet": objets.get(str(tenu), "?")})
            else:
                poser(source, cible, "niveau", {"niveau": NIVEAU_ECHANGE})
            continue

        if quoi == "use-item":
            poser(source, cible, "objet", {"objet": objets.get(str(objet), "?")})
            continue

        #  ── MONTÉE DE NIVEAU, ET SES TROIS VARIANTES ─────────────────
        extra = {}
        if moment is not None:
            extra["moment"] = "jour" if moment == "day" else "nuit"
        if attaque is not None:
            extra["attaque"] = attaques.get(str(attaque), "?")
        if type_attaque is not None:
            extra["attaqueDeType"] = types.get(str(type_attaque), "?")
        if bonheur:
            #  LE SEUIL DES JEUX NE PASSE PAS : c'est cinq étoiles, puis
            #  un niveau de plus.
            poser(source, cible, "bonheur", extra)
            continue
        if niveau is not None:
            poser(source, cible, "niveau", {"niveau": niveau, **extra})
            continue
        if extra.get("attaque") or extra.get("attaqueDeType"):
            #  « Si votre pokémon connaît l'attaque Roulade, il lui
            #  suffira de gagner un niveau pour évoluer. » Un niveau de
            #  plus, sans seuil.
            poser(source, cible, "attaque", extra)
            continue
        poser(source, cible, "special", {"pourquoi": "la condition des jeux ne se lit pas ici"})

    #  ── LES FORMES RÉGIONALES, AJOUTÉES AU CHOIX ──────────────────────
    #
    #  « Nous vous laissons choisir l'évolution qu'il vous plaît. » Même
    #  condition, cible de plus. On le fait après la boucle pour ne pas
    #  dupliquer pendant qu'on itère.
    for source, lignes in list(sortie.items()):
        for ligne in list(lignes):
            for forme in formes.get(ligne["vers"], []):
                poser(source, forme, ligne["par"], {
                    k: v for k, v in ligne.items() if k not in ("vers", "nom")
                })

    #  ── ET LES EXCEPTIONS DE L'ANNEXE, EN DERNIER ─────────────────────
    for source, lignes in EXCEPTIONS.items():
        if source in connues:
            sortie[source] = []
            vus_ici = {k for k in vus if k[0] == source}
            vus.difference_update(vus_ici)
        for cible, par, extra in lignes:
            poser(source, cible, par, extra)
    for source, lignes in AJOUTS.items():
        for cible, par, extra in lignes:
            poser(source, cible, par, extra)

    #  ── L'OBJET EST-IL AU CATALOGUE ? ─────────────────────────────────
    #
    #  `objetId: null` DIT « IL FAUT CET OBJET ET IL N'EXISTE PAS
    #  ENCORE ». On ne l'invente pas : ajouter un objet, c'est lui fixer
    #  un prix, et « on touche pas aux prix du catalogue ». Le code
    #  refusera la demande en nommant l'objet manquant, et Callista
    #  décidera.
    for lignes in sortie.values():
        for ligne in lignes:
            if ligne["par"] == "objet":
                clef = plat(ligne["objet"])
                ligne["objetId"] = objet_id.get(clef)
                #  LE NOM DU CATALOGUE L'EMPORTE quand il y est : c'est
                #  celui qui est écrit dans le sac du joueur.
                ligne["objet"] = objet_nom.get(clef, ligne["objet"])

    #  ── UNE VOIE QUI MARCHE EFFACE LA VOIE « SPECIAL » VERS LA MÊME
    #     CIBLE ──────────────────────────────────────────────────────────
    #
    #  TROUVÉ EN RELISANT LA SORTIE, et c'est le genre de doublon qui
    #  ment : Nymphali sortait DEUX fois depuis Évoli — une fois en
    #  `bonheur` avec une attaque de type Fée, qui est exactement ce que
    #  l'annexe décrit, et une fois en `special` parce que les jeux y
    #  ajoutent l'affection. Pareil pour Phyllali et Givrali, que
    #  l'annexe fait évoluer à la pierre et que les jeux font évoluer
    #  près d'un rocher.
    #
    #  Garder les deux aurait affiché au joueur « tu peux » et « le
    #  staff décide » pour la même évolution, dans la même liste. Dès
    #  qu'une voie est vérifiable, la voie à la main n'a plus de raison
    #  d'être.
    for source, lignes in sortie.items():
        vraies = {l["vers"] for l in lignes if l["par"] != "special"}
        sortie[source] = [
            l for l in lignes if l["par"] != "special" or l["vers"] not in vraies
        ]

    for lignes in sortie.values():
        lignes.sort(key=lambda l: (l["par"], l["vers"]))

    manquants = sorted({
        l["objet"] for ls in sortie.values() for l in ls
        if l["par"] == "objet" and l["objetId"] is None
    })
    speciales = sum(
        1 for ls in sortie.values() for l in ls if l["par"] == "special"
    )

    return {
        "lisezMoi": (
            "Qui évolue vers qui, et à quelle condition. DÉRIVÉ des tables de "
            "PokéAPI par outils/evolutions.py, avec les écarts de l'annexe "
            "« Faire évoluer son pokémon » appliqués ici — l'échange remplacé "
            "par le niveau 40, le bonheur réduit à cinq étoiles, les formes "
            "régionales ajoutées au choix du joueur. NE PAS MODIFIER À LA MAIN."
        ),
        "source": "https://github.com/PokeAPI/pokeapi — data/v2/csv",
        "comment": "python3 outils/evolutions.py",
        "par": {
            "niveau": "un niveau à atteindre",
            "bonheur": "cinq étoiles de bonheur, puis un niveau de plus",
            "objet": "un objet à utiliser ; objetId est null s'il n'est pas au catalogue",
            "attaque": "connaître une attaque, puis un niveau de plus",
            "special": "pas automatisable — « pourquoi » le dit, et le staff tranche",
        },
        "objetsAbsentsDuCatalogue": manquants,
        "compte": {
            "especes": len(sortie),
            "chemins": sum(len(v) for v in sortie.values()),
            "speciales": speciales,
            "objetsManquants": len(manquants),
        },
        "evolutions": {str(k): v for k, v in sorted(sortie.items())},
    }


def main():
    fichier = R / "data/evolutions.json"
    texte = json.dumps(construire(), ensure_ascii=False, indent=1) + "\n"
    if "--verifier" in sys.argv:
        if not fichier.exists() or fichier.read_text() != texte:
            print("data/evolutions.json ne correspond plus à la source", file=sys.stderr)
            return 1
        print("data/evolutions.json : à jour.")
        return 0
    fichier.write_text(texte)
    compte = json.loads(texte)["compte"]
    print(f"data/evolutions.json écrit — {compte}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
