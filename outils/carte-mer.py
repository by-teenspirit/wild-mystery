#!/usr/bin/env python3
# ════════════════════════════════════════════════════════════════════
#  outils/carte-mer.py — ajoute la MER à `data/carte.json`.
#
#  Demandé le 8 octobre : « est-ce que tu peux me générer une image qui
#  va coller avec la map, dans le fond, en se basant sur les map
#  pokémon pour le style ? », puis « je pense que tu peux mieux faire,
#  génère toi-même les images ».
#
#  ── POURQUOI CE N'EST PAS UNE IMAGE ─────────────────────────────────
#
#  Une image de fond posée sur le cadre a trois défauts, et ils sont
#  tous les trois rédhibitoires :
#
#  1. ELLE NE SUIT PAS LA CARTE. On traîne le continent, on zoome
#     dedans — et la mer reste collée au cadre. Les rides restent en
#     place pendant que la côte passe devant : on voit le papier
#     glisser sous le dessin.
#  2. ELLE NE SE CALE PAS. Le SVG se met à l'échelle en `meet`, le
#     fond CSS en `cover` : les deux ne coïncident qu'à un seul rapport
#     de côtés. Partout ailleurs, la mer peinte et la côte dessinée
#     sont décalées.
#  3. IL FAUT L'HÉBERGER. Donc une adresse de plus qui peut tomber, et
#     une requête réseau que le garde-fou n° 10 nous interdit depuis
#     nos feuilles.
#
#  Dessinée DANS le SVG, derrière le continent, elle n'a aucun des
#  trois : elle se déplace et se zoome avec lui, elle est calée sur la
#  côte par construction, elle est nette à tous les niveaux de zoom, et
#  elle prend ses couleurs des jetons — donc elle a un thème sombre.
#
#  ── COMMENT LES BANDES SONT CALCULÉES ───────────────────────────────
#
#  C'est le vocabulaire des cartes de région : l'eau se creuse par
#  PALIERS depuis la côte, pas en dégradé continu. On veut donc des
#  contours parallèles au rivage, à distance croissante.
#
#  On ne sait pas « décaler une courbe de Bézier » proprement — c'est
#  un problème mal posé, les décalages se recoupent dans les concavités
#  et on obtient des nœuds. On passe donc par le raster, où la question
#  devient facile :
#
#    1. on rastérise le continent dans une toile plus grande que lui ;
#    2. `distance_transform_edt` donne, pour chaque pixel d'eau, sa
#       distance à la côte — c'est exactement la profondeur ;
#    3. `find_contours` à quatre niveaux donne les quatre rivages
#       parallèles, déjà démêlés ;
#    4. on les relisse en Catmull-Rom, comme le reste du fichier.
#
#  LA TOILE EST PLUS GRANDE QUE LE REPÈRE (220 de marge), sinon le
#  contour le plus large se heurterait au bord et `find_contours`
#  rendrait une ligne ouverte, qui se remplit n'importe comment. Ce qui
#  dépasse est rogné par le SVG, qui coupe à son `viewBox`.
#
#  ── CE QUI EST REPRODUCTIBLE ────────────────────────────────────────
#
#  Tout. Aucun hasard : les rides sont posées par une suite de Halton,
#  les rayons par la même fonction de hachage que `carte-geographie.py`.
#  Deux constructions donnent le même fichier, et le garde-fou le
#  vérifie.
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

#  Les quatre profondeurs, en unités du repère. Pas régulières : près
#  de la côte on veut des bandes serrées — c'est là que l'œil lit la
#  forme du rivage — et au large on peut s'étaler.
NIVEAUX = [16, 40, 72, 116]

MARGE = 220          # la toile déborde du repère, voir plus haut
PAS = 20             # un sommet tous les ~20 px sur un contour relissé


# ── relisser un contour ─────────────────────────────────────────────

def chemin_lisse(pts):
    """Une polyligne fermée en chemin Catmull-Rom, comme `tache`.

    LE RELISSAGE N'EST PAS COSMÉTIQUE : un contour sorti du raster est
    en escalier d'un pixel. Tracé tel quel il scintille dès qu'on
    zoome, et un rivage en dents de scie se voit tout de suite."""
    n = len(pts)
    d = f"M {pts[0][0]} {pts[0][1]}"
    for i in range(n):
        p0, p1 = pts[(i - 1) % n], pts[i]
        p2, p3 = pts[(i + 1) % n], pts[(i + 2) % n]
        c1 = (round(p1[0] + (p2[0] - p0[0]) / 6),
              round(p1[1] + (p2[1] - p0[1]) / 6))
        c2 = (round(p2[0] - (p3[0] - p1[0]) / 6),
              round(p2[1] - (p3[1] - p1[1]) / 6))
        d += f" C {c1[0]} {c1[1]} {c2[0]} {c2[1]} {p2[0]} {p2[1]}"
    return d + " Z"


def eclaircir(contour, pas=PAS):
    """Un sommet tous les `pas` pixels, en gardant la boucle fermée."""
    gardes = [contour[i] for i in range(0, len(contour), pas)]
    #  Si le dernier point retenu est collé au premier, il ferait un
    #  segment nul et une bosse dans la courbe.
    if len(gardes) > 2 and math.dist(gardes[0], gardes[-1]) < pas / 2:
        gardes.pop()
    return [(round(x), round(y)) for x, y in gardes]


# ── les rides ───────────────────────────────────────────────────────

def halton(i, base):
    f, r = 1.0, 0.0
    while i > 0:
        f /= base
        r += f * (i % base)
        i //= base
    return r


def hache(i):
    """La même fonction que `carte-geographie.py` : une valeur dans
    [0, 1[, reproductible, et sans module `random` — qui changerait de
    suite entre deux versions de Python."""
    return (math.sin(i * 12.9898 + 78.233) + 1) / 2


def rides(dist, repere, marge, n=220, ecart=66):
    """Des ronds dans l'eau, posés loin de la côte et loin les uns des
    autres.

    Une suite de Halton plutôt que des tirages : elle remplit l'espace
    régulièrement au lieu de faire des paquets et des trous, ce qui est
    exactement ce qu'on veut d'une décoration qui doit se répartir."""
    poses = []
    for i in range(1, n + 1):
        x = halton(i, 2) * repere["largeur"]
        y = halton(i, 3) * repere["hauteur"]
        d = dist[int(y + marge), int(x + marge)]
        #  Ni sur la côte — la ride mangerait le rivage —, ni au large
        #  du large, où elle sortirait du cadre.
        if not (30 <= d <= 190):
            continue
        if any(math.dist((x, y), (p["x"], p["y"])) < ecart for p in poses):
            continue
        poses.append({
            "x": round(x, 1),
            "y": round(y, 1),
            "r": round(9 + 13 * hache(i), 1),
        })
    return poses


# ── le tout ─────────────────────────────────────────────────────────

def main():
    chemin = pathlib.Path("data/carte.json")
    carte = json.loads(chemin.read_text())
    repere = carte["repere"]
    L = repere["largeur"] + 2 * MARGE
    H = repere["hauteur"] + 2 * MARGE

    pts = points_du_chemin(carte["terre"])
    toile = Image.new("L", (L, H), 0)
    ImageDraw.Draw(toile).polygon(
        [(x + MARGE, y + MARGE) for x, y in pts], fill=255)
    terre = np.array(toile) > 127

    #  La profondeur : pour chaque pixel d'eau, sa distance à la côte.
    dist = ndimage.distance_transform_edt(~terre)

    bandes = []
    for niveau in NIVEAUX:
        morceaux = []
        for contour in measure.find_contours(dist, niveau):
            #  Un contour de moins de trente sommets est un grain de
            #  poussière du raster, pas un rivage.
            if len(contour) < 30:
                continue
            allege = eclaircir([(c - MARGE, r - MARGE) for r, c in contour])
            if len(allege) >= 6:
                morceaux.append(chemin_lisse(allege))
        if morceaux:
            bandes.append(" ".join(morceaux))

    carte["_mer"] = (
        "ÉCRIT PAR `outils/carte-mer.py`. Les bandes vont de la PLUS "
        "PROCHE de la côte à la plus lointaine ; le module les peint "
        "dans l'ordre inverse, la plus lointaine d'abord, pour qu'elles "
        "s'emboîtent."
    )
    carte["mer"] = {"bandes": bandes, "rides": rides(dist, repere, MARGE)}

    chemin.write_text(json.dumps(carte, ensure_ascii=False, indent=2) + "\n")
    print(f"mer : {len(bandes)} bandes aux profondeurs {NIVEAUX}, "
          f"{len(carte['mer']['rides'])} rides")


if __name__ == "__main__":
    main()
