#!/usr/bin/env python3
"""Reporte le bandeau d'une zone — niveau, description, image — de
`data/carte.json` vers `data/zones.json`.

POURQUOI UNE RECOPIE PLUTÔT QU'UNE LECTURE DIRECTE
──────────────────────────────────────────────────
La page d'une zone a besoin de trois chaînes : la tranche de niveaux,
la phrase d'ambiance et la photo du bandeau. Les trois existent déjà,
et depuis longtemps — dans `data/carte.json`, où la carte interactive
les lit pour ses infobulles.

Mais `carte.json` pèse 93 Ko, dont 44 de contours SVG. Aller le
chercher sur une page de zone pour trois chaînes, c'est payer la carte
entière sans la dessiner. `zones.json` pèse 3 Ko, et le navigateur le
demande DÉJÀ sur cette page : la barre d'actions s'en sert pour savoir
si elle a le droit de se poser.

On recopie donc, et le garde-fou n° 23 relit la recopie hors ligne.
C'est la règle du dépôt depuis le 15 octobre : une donnée dérivée qui
n'est pas vérifiée est une donnée qui finit par mentir.

LA SOURCE RESTE LA CARTE
────────────────────────
`carte.json` est le fichier que Callista modifie — les paliers, les
niveaux et les descriptions y survivent au recalage de
`outils/carte-peinte.py`. Corriger une phrase se fait là-bas, puis
`python3 outils/zones.py` ici. Jamais l'inverse : ce script ÉCRASE les
trois champs dans `zones.json`.

CE QU'ON VÉRIFIE, ET POURQUOI CHAQUE CONTRÔLE EXISTE
────────────────────────────────────────────────────
· les dix-sept zones de `zones.json` sont dans `carte.json`, et du type
  « zone » — sinon le bandeau d'une zone irait chercher le niveau d'une
  ville ;
· aucun des trois champs n'est vide — une phrase manquante se verrait à
  l'écran, un niveau manquant se verrait moins ;
· la photo existe VRAIMENT dans `assets/zones/` — l'adresse est absolue
  et pointe sur GitHub Pages, donc une faute de frappe ne se verrait
  qu'en ligne, sur la page d'une zone, et seulement par quelqu'un qui
  la regarde. Ici, elle casse le CI.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path
from urllib.parse import urlparse

RACINE = Path(__file__).resolve().parent.parent
CARTE = RACINE / "data" / "carte.json"
SORTIE = RACINE / "data" / "zones.json"
IMAGES = RACINE / "assets" / "zones"

#  Les trois champs repris, dans l'ordre où ils apparaissent dans le
#  bandeau : la légende, puis le titre (qui est déjà là), puis la
#  phrase. L'image est à part : c'est la seule qu'on vérifie sur disque.
CHAMPS = ("niveau", "description", "image")


def lire(chemin: Path) -> dict:
    return json.loads(chemin.read_text(encoding="utf-8"))


def construire() -> tuple[dict, list[str]]:
    """Rend `zones.json` enrichi, et la liste des défauts trouvés.

    On ne lève pas sur un défaut : on les rend tous. Corriger une faute,
    relancer, en découvrir une deuxième, c'est trois allers-retours là
    où il en faut un.
    """
    carte = lire(CARTE)
    sortie = lire(SORTIE)
    defauts: list[str] = []

    par_forum = {}
    for lieu in carte.get("lieux", []):
        if isinstance(lieu, dict) and isinstance(lieu.get("forumId"), int):
            par_forum[lieu["forumId"]] = lieu

    for zone in sortie.get("zones", []):
        fid = zone["forumId"]
        nom = zone["nom"]
        source = par_forum.get(fid)

        if source is None:
            defauts.append(f"f{fid} {nom} : absente de carte.json")
            continue
        if source.get("type") != "zone":
            defauts.append(f"f{fid} {nom} : carte.json la dit « {source.get('type')} »")
            continue
        if source.get("nom") != nom:
            defauts.append(f"f{fid} : « {nom} » ici, « {source.get('nom')} » dans carte.json")

        for champ in CHAMPS:
            valeur = source.get(champ)
            if not isinstance(valeur, str) or valeur.strip() == "":
                defauts.append(f"f{fid} {nom} : « {champ} » vide dans carte.json")
                continue
            zone[champ] = valeur.strip()

        image = zone.get("image")
        if isinstance(image, str):
            fichier = IMAGES / Path(urlparse(image).path).name
            if not fichier.exists():
                defauts.append(f"f{fid} {nom} : {fichier.name} n'est pas dans assets/zones/")

    return sortie, defauts


def main() -> int:
    sortie, defauts = construire()
    for d in defauts:
        print(f"  ✗ {d}", file=sys.stderr)
    if defauts:
        print(f"{len(defauts)} défaut(s) : rien n'est écrit.", file=sys.stderr)
        return 1

    texte = json.dumps(sortie, ensure_ascii=False, indent=1) + "\n"

    if "--verifier" in sys.argv:
        if SORTIE.read_text(encoding="utf-8") != texte:
            print(
                f"{SORTIE.name} ne correspond pas à carte.json "
                f"(relancer : python3 outils/zones.py).",
                file=sys.stderr,
            )
            return 1
        print(f"{SORTIE.name} : {len(sortie['zones'])} zones, bandeaux à jour.")
        return 0

    SORTIE.write_text(texte, encoding="utf-8")
    for z in sortie["zones"]:
        print(f"  f{z['forumId']:<4} P{z['palier']} {z['nom']:<22} {z['niveau']}")
    print(f"{SORTIE.name} : {len(sortie['zones'])} bandeaux repris de {CARTE.name}.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
