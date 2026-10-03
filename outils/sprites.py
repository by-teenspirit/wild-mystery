#!/usr/bin/env python3
# ════════════════════════════════════════════════════════════════════
#  outils/sprites.py
#
#  Deux choses, et une seule raison.
#
#  LA RAISON. Le style du forum est Ultra-Soleil / Ultra-Lune, et ce sont
#  des gifs animés. Décidé le 2 octobre : animés en zone, figés au Pokédex.
#  Or on ne met pas un gif en pause — ni en CSS, ni en HTML. Il faut une
#  image fixe, et la seule qui raccorde exactement avec le sprite animé,
#  c'est sa PREMIÈRE IMAGE.
#
#  Mesuré le même jour : une page de Pokédex à 150 vignettes pèse 578 Ko
#  en images figées contre 14 Mo en gifs animés. C'est vingt-cinq fois
#  moins, et ça décide tout seul.
#
#  CE QU'IL PRODUIT
#    assets/sprites-figes/<style>/<id>.png   la première image, découpée
#    data/sprites-couverture.json            qui a quoi, dans quel style
#
#  POURQUOI UNE CARTE PLUTÔT QU'UN onerror. Aucun jeu de sprites ne couvre
#  les 444 espèces de Rhode : Ultra-Soleil en a 370, Noir/Blanc animé 393,
#  la génération III 201. Un repli côté navigateur coûterait une requête
#  ratée par image manquante et un clignotement à l'affichage, chez chaque
#  visiteur, à chaque page. Calculé une fois, il ne rate jamais — et c'est
#  ce qui permet d'écrire « 370 d'origine, 74 complétés » dans l'interface
#  sans l'estimer.
#
#  CE SCRIPT A BESOIN DU RÉSEAU, donc il ne tourne pas à chaque livraison.
#  On le relance quand on remonte le commit épinglé, et c'est tout.
#
#      python3 outils/sprites.py             les deux styles animés
#      python3 outils/sprites.py --style forum
# ════════════════════════════════════════════════════════════════════

import argparse
import concurrent.futures as cf
import glob
import http.client
import io
import json
import os
import sys
import time
import urllib.error
import urllib.request

try:
    from PIL import Image
except ImportError:
    sys.exit("Il manque Pillow :  pip install Pillow")

#  Épinglé, jamais `@master`. La leçon est déjà payée sur ADWAD et elle
#  vaut autant pour un dépôt qu'on ne contrôle pas : jsDelivr sert une
#  branche avec sept jours de cache navigateur. Relevé le 2 octobre 2026.
COMMIT = "bfb75391935310368065096fa08c51e8970bc43e"
BASE = f"https://raw.githubusercontent.com/PokeAPI/sprites/{COMMIT}/sprites/pokemon"

RACINE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def _carte_existante():
    """La carte du passage précédent, pour pouvoir reprendre sans refaire."""
    chemin = os.path.join(RACINE, "data", "sprites-couverture.json")
    try:
        with open(chemin, encoding="utf-8") as f:
            return {
                style: contenu.get("especes", {})
                for style, contenu in json.load(f).get("styles", {}).items()
            }
    except (OSError, ValueError):
        return {}


DEJA_CONNUES = _carte_existante()

#  L'ordre compte : on prend le premier qui existe. Les noms de dossiers
#  sont relevés dans le dépôt, pas devinés — c'est `firered-leafgreen` et
#  `ultra-sun-ultra-moon`, et les sprites d'Ultra-Soleil sont des .gif.
STYLES = {
    "forum": {
        "titre": "Ultra-Soleil / Ultra-Lune",
        "anime": True,
        "sources": [
            ("versions/generation-vii/ultra-sun-ultra-moon", "gif"),
            ("other/showdown", "gif"),
        ],
    },
    "retro": {
        "titre": "Rétro animé",
        "anime": True,
        "sources": [
            ("versions/generation-v/black-white/animated", "gif"),
            ("other/showdown", "gif"),
        ],
    },
    "gba-ds": {
        "titre": "Époque GBA/DS",
        "anime": False,
        "sources": [
            ("versions/generation-iii/emerald", "png"),
            ("versions/generation-iii/firered-leafgreen", "png"),
            ("versions/generation-iii/ruby-sapphire", "png"),
            ("versions/generation-iv/platinum", "png"),
            ("versions/generation-iv/heartgold-soulsilver", "png"),
            ("versions/generation-iv/diamond-pearl", "png"),
            ("versions/generation-v/black-white/animated", "gif"),
            ("other/showdown", "gif"),
        ],
    },
}


def especes_de_rhode():
    """Les espèces citées par les tables de faune. C'est la seule liste qui
    fasse foi : inutile de figer mille Pokémon dont aucun n'apparaît."""
    vues = set()

    def parcourir(objet):
        if isinstance(objet, dict):
            for cle, valeur in objet.items():
                if cle == "espece" and isinstance(valeur, int):
                    vues.add(valeur)
                parcourir(valeur)
        elif isinstance(objet, list):
            for valeur in objet:
                parcourir(valeur)

    fichiers = sorted(glob.glob(os.path.join(RACINE, "data", "faune", "*.json")))
    if not fichiers:
        sys.exit("Aucun fichier dans data/faune/ — lancé depuis le bon dépôt ?")
    for chemin in fichiers:
        with open(chemin, encoding="utf-8") as f:
            parcourir(json.load(f))
    return sorted(vues)


def telecharger(url, essais=4):
    """Rend les octets, ou None si l'image n'existe pas.

    Un 404 est un résultat ATTENDU — c'est précisément ce qu'on cherche à
    cartographier — donc il ne lève pas et ne se réessaie pas.

    Le reste se réessaie. Près de neuf cents requêtes d'affilée, et il
    suffit d'une connexion coupée au six centième pour perdre tout le
    passage. C'est arrivé au premier essai du 2 octobre."""
    attente = 1.0
    for essai in range(essais):
        try:
            with urllib.request.urlopen(url, timeout=40) as reponse:
                return reponse.read()
        except urllib.error.HTTPError as erreur:
            if erreur.code == 404:
                return None
            if erreur.code < 500 or essai == essais - 1:
                raise
        except (urllib.error.URLError, http.client.HTTPException, OSError):
            if essai == essais - 1:
                raise
        time.sleep(attente)
        attente *= 2
    return None


def resoudre(espece, style):
    """La première source qui a cette espèce, avec ses octets."""
    for dossier, extension in STYLES[style]["sources"]:
        chemin = f"{dossier}/{espece}.{extension}"
        octets = telecharger(f"{BASE}/{chemin}")
        if octets is not None:
            return chemin, extension, octets
    return None, None, None


def figer(octets, destination):
    """La première image du gif, en png. `seek(0)` est explicite : Pillow
    ouvre déjà sur la première, mais l'écrire dit que c'est un choix."""
    image = Image.open(io.BytesIO(octets))
    image.seek(0)
    image.convert("RGBA").save(destination, "PNG", optimize=True)
    return os.path.getsize(destination)


def traiter(espece, style, reprendre=True):
    #  Reprise : un passage interrompu ne doit pas tout recommencer. Si
    #  l'image figée est déjà là ET que la carte sait d'où elle vient, on
    #  passe. Supprimer assets/sprites-figes/<style>/ force un passage neuf.
    deja = os.path.join(RACINE, "assets", "sprites-figes", style, f"{espece}.png")
    if reprendre and os.path.exists(deja):
        connue = DEJA_CONNUES.get(style, {}).get(str(espece))
        if connue:
            return espece, dict(connue)

    chemin, extension, octets = resoudre(espece, style)
    if octets is None:
        return espece, {"manquant": True}

    fiche = {"source": chemin}
    if extension == "gif":
        dossier = os.path.join(RACINE, "assets", "sprites-figes", style)
        os.makedirs(dossier, exist_ok=True)
        poids = figer(octets, os.path.join(dossier, f"{espece}.png"))
        fiche["fige"] = f"assets/sprites-figes/{style}/{espece}.png"
        fiche["poids_fige"] = poids
    else:
        #  Déjà fixe : rien à figer, le Pokédex sert la même image.
        fiche["fige"] = chemin
    return espece, fiche


def main():
    arguments = argparse.ArgumentParser(description=__doc__)
    arguments.add_argument("--style", choices=list(STYLES), action="append")
    options = arguments.parse_args()
    styles = options.style or ["forum", "retro"]

    especes = especes_de_rhode()
    print(f"{len(especes)} espèces dans les tables de faune de Rhode\n")

    carte = {"commit": COMMIT, "base": BASE, "styles": {}}
    #  Relancer un seul style ne doit pas effacer la carte des autres.
    try:
        with open(os.path.join(RACINE, "data", "sprites-couverture.json"), encoding="utf-8") as f:
            ancienne = json.load(f)
        if ancienne.get("commit") == COMMIT:
            carte["styles"] = ancienne.get("styles", {})
    except (OSError, ValueError):
        pass

    for style in styles:
        print(f"── {STYLES[style]['titre']} ─────────────────────────")
        with cf.ThreadPoolExecutor(16) as groupe:
            resultats = dict(groupe.map(lambda e: traiter(e, style), especes))

        manquants = [e for e, f in resultats.items() if f.get("manquant")]
        figes = [f for f in resultats.values() if "poids_fige" in f]
        origine = sum(
            1
            for f in resultats.values()
            if not f.get("manquant") and f["source"].startswith(STYLES[style]["sources"][0][0])
        )

        carte["styles"][style] = {
            "titre": STYLES[style]["titre"],
            "anime": STYLES[style]["anime"],
            "especes": {str(e): f for e, f in resultats.items() if not f.get("manquant")},
            "manquants": manquants,
        }

        print(f"   d'origine        {origine}/{len(especes)}")
        print(f"   complétés        {len(especes) - origine - len(manquants)}")
        print(f"   introuvables     {len(manquants)}")
        if figes:
            total = sum(f["poids_fige"] for f in figes)
            print(f"   figés            {len(figes)} png · {total // 1024} Ko")
        print()

    destination = os.path.join(RACINE, "data", "sprites-couverture.json")
    with open(destination, "w", encoding="utf-8") as f:
        json.dump(carte, f, ensure_ascii=False, indent=1, sort_keys=True)
        f.write("\n")
    print(f"carte écrite : {os.path.relpath(destination, RACINE)}")


if __name__ == "__main__":
    main()
