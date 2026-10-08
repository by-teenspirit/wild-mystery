#!/usr/bin/env python3
# ════════════════════════════════════════════════════════════════════
#  outils/carte-territoires.py — fait se TOUCHER les zones de Rhode.
#
#  Demandé le 8 octobre : « il faudrait faire en sorte que chaque zone
#  se touche, pas qu'il y ait de vide sur la carte ».
#
#  ── CE QUE ÇA CHANGE ────────────────────────────────────────────────
#
#  Avant : dix-sept taches posées sur un grand aplat, et entre elles,
#  de la terre qui n'appartient à personne. Sur une carte de région,
#  ce vide n'existe pas — on est toujours QUELQUE PART. Le Minecraft
#  biome map que Callista a donné en référence est exactement ça : une
#  partition, pas un semis.
#
#  Après : chaque point du continent appartient au territoire dont il
#  est le plus proche. Les frontières sont donc partagées — le bord
#  d'une zone EST le bord de sa voisine —, et il n'y a plus de trou.
#
#  ── COMMENT ─────────────────────────────────────────────────────────
#
#  Un diagramme de Voronoï, mais sur les FORMES et pas sur les points :
#  la distance se mesure au noyau de la zone, pas à son ancre. Avec les
#  ancres, une zone longue et une zone ronde se partageraient l'espace
#  comme deux points, et la zone longue perdrait ses extrémités.
#
#  `distance_transform_edt(..., return_indices=True)` donne, pour
#  chaque pixel, les coordonnées du pixel de noyau le plus proche. On
#  lit l'étiquette qui s'y trouve, et c'est fini : pas de boucle sur
#  dix-sept zones par pixel.
#
#  ── LE LITTORAL RESTE À PERSONNE ────────────────────────────────────
#
#  On érode la terre d'une vingtaine d'unités avant de partager. Cette
#  bande-là reste du sable : sans elle, les territoires arrivent
#  jusqu'à l'eau et la plage disparaît — or c'est la plage qui fait
#  qu'une côte se lit comme une côte.
#
#  ── POURQUOI `noyau` EXISTE ─────────────────────────────────────────
#
#  LE PIÈGE QU'IL DÉSAMORCE : `carte-cote.py` calcule la côte en
#  dilatant l'union des zones. Si on le relançait après ce script, il
#  dilaterait les zones DÉJÀ étendues, et le continent grossirait d'un
#  littoral à chaque passage — une carte qui enfle à chaque
#  construction.
#
#  Alors ce script range la forme d'origine dans `noyau` et n'y touche
#  plus jamais. `carte-cote.py` lit `noyau` en priorité. Les trois
#  outils deviennent rejouables dans n'importe quel ordre, autant de
#  fois qu'on veut, et donnent toujours le même fichier.
# ════════════════════════════════════════════════════════════════════

import json
import math
import pathlib
import sys

import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage
from skimage import measure

sys.path.insert(0, str(pathlib.Path(__file__).parent))
from chemin_svg import points_du_chemin  # noqa: E402

MARGE = 60
PLAGE = 21        # la bande de sable qu'on ne partage pas
PAS = 13          # un sommet tous les 13 px sur une frontière relissée
AU_LARGE = {104}  # l'Océan Mystérieux n'est pas un territoire terrestre


def lisser(contour, pas=PAS):
    pts = [(c - MARGE, r - MARGE) for r, c in contour]
    gardes = [pts[i] for i in range(0, len(pts), pas)]
    if len(gardes) > 2 and math.dist(gardes[0], gardes[-1]) < pas / 2:
        gardes.pop()
    if len(gardes) < 5:
        return None
    gardes = [(round(x), round(y)) for x, y in gardes]
    n = len(gardes)
    d = f"M {gardes[0][0]} {gardes[0][1]}"
    for i in range(n):
        p0, p1 = gardes[(i - 1) % n], gardes[i]
        p2, p3 = gardes[(i + 1) % n], gardes[(i + 2) % n]
        #  Un lissage plus SERRÉ que pour la côte : une frontière
        #  partagée doit suivre sa voisine au pixel près, et un
        #  Catmull-Rom trop lâche les décolle l'une de l'autre — on
        #  verrait un liseré de fond entre deux territoires censés se
        #  toucher.
        c1 = (round(p1[0] + (p2[0] - p0[0]) / 7),
              round(p1[1] + (p2[1] - p0[1]) / 7))
        c2 = (round(p2[0] - (p3[0] - p1[0]) / 7),
              round(p2[1] - (p3[1] - p1[1]) / 7))
        d += f" C {c1[0]} {c1[1]} {c2[0]} {c2[1]} {p2[0]} {p2[1]}"
    return d + " Z"


def main():
    chemin = pathlib.Path("data/carte.json")
    carte = json.loads(chemin.read_text())
    repere = carte["repere"]
    L = repere["largeur"] + 2 * MARGE
    H = repere["hauteur"] + 2 * MARGE

    #  LA TERRE À PARTAGER : le continent, moins la plage. Les îles
    #  n'en sont pas — l'Île Ténèbra est une ville, pas un territoire,
    #  et son bout de terre reste du sable.
    toile = Image.new("L", (L, H), 0)
    ImageDraw.Draw(toile).polygon(
        [(x + MARGE, y + MARGE) for x, y in points_du_chemin(carte["terre"])],
        fill=255)
    terre = np.array(toile) > 127
    partageable = ndimage.binary_erosion(terre, iterations=PLAGE)

    #  LES NOYAUX, étiquetés. On garde la forme d'origine : c'est elle
    #  qui porte le dessin voulu de la zone, et c'est elle que
    #  `carte-cote.py` doit continuer à lire.
    etiquettes = np.zeros((H, L), dtype=np.int32)
    zones = []
    for l in carte["lieux"]:
        if "forme" not in l or l["forumId"] in AU_LARGE:
            continue
        noyau = l.get("noyau", l["forme"])
        l["noyau"] = noyau
        zones.append(l)
        masque = Image.new("L", (L, H), 0)
        ImageDraw.Draw(masque).polygon(
            [(x + MARGE, y + MARGE) for x, y in points_du_chemin(noyau)],
            fill=255)
        etiquettes[np.array(masque) > 127] = len(zones)

    #  LE PARTAGE. Un seul appel : pour chaque pixel, l'indice du pixel
    #  de noyau le plus proche ; on y lit son étiquette.
    _, idx = ndimage.distance_transform_edt(etiquettes == 0, return_indices=True)
    propriete = etiquettes[idx[0], idx[1]]
    propriete[~partageable] = 0

    pleines = 0
    for n, l in enumerate(zones, start=1):
        region = (propriete == n)
        if not region.any():
            print(f"   · {l['nom']} n'a reçu aucun territoire")
            continue
        #  On referme avant de tracer : le partage laisse parfois des
        #  dentelures d'un pixel là où trois zones se rencontrent, et
        #  elles deviendraient des pointes sur la frontière.
        region = ndimage.binary_closing(region, iterations=3)
        morceaux = []
        for contour in measure.find_contours(region.astype(float), 0.5):
            if len(contour) < 40:
                continue
            d = lisser(contour)
            if d is not None:
                morceaux.append(d)
        if morceaux:
            l["forme"] = " ".join(morceaux)
            pleines += 1

    carte["_territoires"] = (
        "ÉCRIT PAR `outils/carte-territoires.py`. `forme` est le "
        "territoire ÉTENDU, qui touche ses voisins ; `noyau` est la "
        "forme d'origine, celle dont `carte-cote.py` déduit la côte. "
        "Ne jamais déduire la côte de `forme` : elle enflerait à chaque "
        "construction."
    )
    chemin.write_text(json.dumps(carte, ensure_ascii=False, indent=2) + "\n")
    print(f"territoires : {pleines} zones étendues jusqu'à se toucher, "
          f"plage de {PLAGE}")


if __name__ == "__main__":
    main()
