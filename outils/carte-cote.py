#!/usr/bin/env python3
# ════════════════════════════════════════════════════════════════════
#  outils/carte-cote.py — recalcule la CÔTE de Rhode.
#
#  ── LE DÉFAUT QU'IL CORRIGE ─────────────────────────────────────────
#
#  Le continent était une tache dessinée indépendamment des zones :
#  `tache(420, 300, 400, 258)`, et les vingt-six lieux posés dessus en
#  espérant que ça tombe bien. Ça ne tombait pas bien. Sur la carte du
#  forum, abstraite, on ne le voyait pas. Sur une carte dessinée, les
#  Monts Enneigés, l'Oasis Perdue, le Volcan Sombre, la Planque Snatch,
#  Libra Échoué et la Plage Grain de Sel flottaient À MOITIÉ SUR L'EAU.
#  Une montagne enneigée posée sur la mer, ce n'est pas un parti pris,
#  c'est une erreur.
#
#  ── LA CÔTE SUIT LES TERRITOIRES, PAS L'INVERSE ─────────────────────
#
#  On prend l'UNION du socle et de toutes les zones continentales, on
#  la referme, on la dilate d'une quinzaine d'unités — l'épaisseur du
#  littoral —, et le contour de ce qu'on obtient EST la côte. Elle
#  épouse donc les zones par construction : aucune ne peut déborder,
#  et ajouter un lieu à `data/carte.json` redessine le rivage autour de
#  lui.
#
#  LA FERMETURE AVANT LA DILATATION compte : sans elle, deux zones
#  voisines mais disjointes laissent un détroit d'une unité entre
#  elles, qui devient une crique absurde au milieu des terres.
#
#  ── CE QUI RESTE AU LARGE, ET C'EST VOULU ───────────────────────────
#
#  L'Océan Mystérieux est une zone de haute mer : l'absorber dans le
#  continent en ferait une plaine. L'Île Ténèbra est une île : elle
#  reçoit son propre bout de terre, séparé du reste — c'est ce qui
#  justifie le port de la Relique Sacrée et la route de mer.
#
#  ── L'ORDRE DES TROIS OUTILS ────────────────────────────────────────
#
#      carte-geographie.py    les lieux, les noyaux, les étiquettes
#      carte-cote.py          la côte, déduite des noyaux   ← ici
#      carte-territoires.py   les zones étendues jusqu'à se toucher
#      carte-mer.py           la mer, déduite de la côte
#
#  Chacun lit et réécrit `data/carte.json`, et chacun est rejouable
#  autant de fois qu'on veut : c'est à ça que sert `noyau`.
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

MARGE = 140
LITTORAL = 16        # de combien la côte déborde des territoires
FERMETURE = 26       # comble les détroits entre deux zones voisines
PAS = 18             # un sommet tous les 18 px sur le contour relissé

#  Ce qui ne rejoint PAS le continent, et pourquoi.
AU_LARGE = {
    104: "l'Océan Mystérieux est une zone de haute mer",
    17: "l'Île Ténèbra est une île — elle a sa propre terre",
}
ILES = {17: 46}      # forumId de l'île → rayon de son bout de terre


def lisser(contour, marge, pas=PAS):
    pts = [(c - marge, r - marge) for r, c in contour]
    gardes = [pts[i] for i in range(0, len(pts), pas)]
    if len(gardes) > 2 and math.dist(gardes[0], gardes[-1]) < pas / 2:
        gardes.pop()
    gardes = [(round(x), round(y)) for x, y in gardes]
    n = len(gardes)
    d = f"M {gardes[0][0]} {gardes[0][1]}"
    for i in range(n):
        p0, p1 = gardes[(i - 1) % n], gardes[i]
        p2, p3 = gardes[(i + 1) % n], gardes[(i + 2) % n]
        c1 = (round(p1[0] + (p2[0] - p0[0]) / 6),
              round(p1[1] + (p2[1] - p0[1]) / 6))
        c2 = (round(p2[0] - (p3[0] - p1[0]) / 6),
              round(p2[1] - (p3[1] - p1[1]) / 6))
        d += f" C {c1[0]} {c1[1]} {c2[0]} {c2[1]} {p2[0]} {p2[1]}"
    return d + " Z"


def main():
    chemin = pathlib.Path("data/carte.json")
    carte = json.loads(chemin.read_text())
    repere = carte["repere"]
    L = repere["largeur"] + 2 * MARGE
    H = repere["hauteur"] + 2 * MARGE

    #  LE SOCLE EST GARDÉ. Il donne au continent sa silhouette
    #  d'ensemble ; sans lui, la côte ne serait qu'un chapelet de
    #  zones collées, et on verrait les coutures.
    socle = carte.get("socle", carte["terre"])
    toile = Image.new("L", (L, H), 0)
    pinceau = ImageDraw.Draw(toile)
    pinceau.polygon([(x + MARGE, y + MARGE)
                     for x, y in points_du_chemin(socle)], fill=255)

    dehors = []
    for l in carte["lieux"]:
        if "forme" not in l:
            continue
        if l["forumId"] in AU_LARGE:
            dehors.append(l["nom"])
            continue
        #  LE NOYAU, PAS LA FORME. Une fois `carte-territoires.py`
        #  passé, `forme` est le territoire étendu jusqu'à ses
        #  voisins : le dilater ferait grossir le continent d'un
        #  littoral à chaque construction. `noyau` est la forme
        #  d'origine, et elle ne bouge jamais.
        pinceau.polygon([(x + MARGE, y + MARGE) for x, y in
                         points_du_chemin(l.get("noyau", l["forme"]))], fill=255)

    masque = np.array(toile) > 127
    masque = ndimage.binary_closing(masque, ndimage.generate_binary_structure(2, 1),
                                    iterations=FERMETURE)
    masque = ndimage.binary_dilation(masque, iterations=LITTORAL)
    #  Un trou dans le continent serait un lac qu'on n'a pas demandé.
    masque = ndimage.binary_fill_holes(masque)

    contours = measure.find_contours(masque.astype(float), 0.5)
    if not contours:
        raise SystemExit("aucune côte trouvée — le socle est-il lisible ?")
    carte["terre"] = lisser(max(contours, key=len), MARGE)
    #  On garde le socle d'origine : la côte est DÉRIVÉE, elle doit
    #  pouvoir se recalculer sans avoir été écrasée par elle-même.
    carte.setdefault("socle", socle)

    iles = []
    for forum, rayon in ILES.items():
        lieu = next(l for l in carte["lieux"] if l["forumId"] == forum)
        cx, cy = lieu["ancre"]["x"], lieu["ancre"]["y"]
        pts = []
        for i in range(13):
            a = 2 * math.pi * i / 13
            d = 0.82 + 0.3 * ((math.sin(forum * 12.9 + i * 78.2) + 1) / 2)
            pts.append((round(cx + rayon * d * math.cos(a)),
                        round(cy + rayon * 0.74 * d * math.sin(a))))
        d = f"M {pts[0][0]} {pts[0][1]}"
        for i in range(13):
            p0, p1 = pts[(i - 1) % 13], pts[i]
            p2, p3 = pts[(i + 1) % 13], pts[(i + 2) % 13]
            c1 = (round(p1[0] + (p2[0] - p0[0]) / 6),
                  round(p1[1] + (p2[1] - p0[1]) / 6))
            c2 = (round(p2[0] - (p3[0] - p1[0]) / 6),
                  round(p2[1] - (p3[1] - p1[1]) / 6))
            d += f" C {c1[0]} {c1[1]} {c2[0]} {c2[1]} {p2[0]} {p2[1]}"
        iles.append(d + " Z")
    carte["iles"] = iles

    carte["_terre"] = (
        "ÉCRIT PAR `outils/carte-cote.py`. La côte est l'union du socle "
        "et des zones continentales, dilatée du littoral : elle épouse "
        "les territoires, aucun ne peut déborder dans l'eau. `socle` "
        "est la silhouette de départ, qui n'est pas dessinée."
    )
    chemin.write_text(json.dumps(carte, ensure_ascii=False, indent=2) + "\n")
    print(f"côte : littoral {LITTORAL}, {len(iles)} île(s), "
          f"au large : {', '.join(dehors)}")


if __name__ == "__main__":
    main()
