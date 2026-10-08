#!/usr/bin/env python3
# ════════════════════════════════════════════════════════════════════
#  outils/carte-peinte.py — recale `data/carte.json` sur la carte
#  PEINTE.
#
#  Callista a fait peindre la carte par un générateur d'images, avec le
#  prompt de `planches/prompt-carte-de-rhode.md`, et en a choisi une.
#  Elle devient la carte de Rhode. Reste à ce que le forum tombe
#  dessus : il faut que chaque zone cliquable épouse la région peinte
#  qu'elle désigne.
#
#  ── POURQUOI ON NE TRACE PAS À LA MAIN ──────────────────────────────
#
#  Dix-sept contours relevés à l'œil sur une image de 512 pixels, c'est
#  une demi-journée, et c'est faux de dix pixels partout. La peinture,
#  elle, SAIT où sont ses frontières : chaque biome y est un aplat de
#  couleur. On la lui demande.
#
#  ── COMMENT ─────────────────────────────────────────────────────────
#
#  1. on sépare la terre de l'eau — le bleu est franc, la frontière
#     est nette ;
#  2. on pose une graine par zone, à la main : c'est le SEUL endroit
#     où un humain doit regarder l'image, et c'est irréductible —
#     aucun algorithme ne sait que la tache violette est le Manoir
#     Barjok ;
#  3. chaque graine s'étend aux pixels de couleur voisine, en Lab,
#     bornée par un rayon — sans borne, deux prairies voisines
#     fusionnent ;
#  4. ce qui reste de terre va au territoire le plus proche. C'est la
#     même règle que `carte-territoires.py`, et elle garantit ce que
#     Callista a demandé hier : les zones se touchent, il n'y a pas de
#     vide.
#
#  LES VILLAGES SONT DÉTECTÉS, PAS PLACÉS. Le peintre a mis des toits
#  rouges ; on les cherche par leur teinte, on les regroupe, et on
#  rattache chaque grappe au nom le plus proche. Poser les villes à la
#  main sur une image qu'on ne voit qu'au pixel près, c'est se tromper
#  de vingt pixels et le découvrir sur le forum.
#
#  ── CE QUE ÇA CASSE, ET QUI EST ASSUMÉ ──────────────────────────────
#
#  La géographie ne se déduit plus de `carte-geographie.py` : elle
#  vient d'une image. `carte-cote.py`, `carte-territoires.py` et
#  `carte-mer.py` n'ont plus à tourner — la côte et la mer sont dans
#  la peinture. Ce script les remplace tous les trois, et c'est le
#  prix du choix : une carte peinte ne se recalcule pas.
# ════════════════════════════════════════════════════════════════════

import json
import math
import pathlib
import sys

import numpy as np
from PIL import Image
from scipy import ndimage
from skimage import color, measure

sys.path.insert(0, str(pathlib.Path(__file__).parent))

SOURCE = pathlib.Path("planches/peinte/source.png")
COTE = 1000          # le repère de sortie, carré comme la peinture
PAS = 26             # un sommet tous les 26 px de l'image sur un contour

#  ── LES GRAINES ─────────────────────────────────────────────────────
#
#  En coordonnées de l'image source (512 × 512), relevées à l'œil sur
#  la peinture. `tolerance` est l'écart de couleur admis en Lab,
#  `rayon` la distance maximale à la graine, en pixels.
#
#  Un biome franc (neige, lave, sable) s'étend loin avec une tolérance
#  serrée. Les prairies, qui se ressemblent toutes, sont tenues court
#  et c'est le partage final qui leur donne leur part.
GRAINES = [
    #  forumId, nom,                   x,    y,  tol, rayon
    (34, "Montagnes Embrumées",       429,  257,  17, 430),
    (103, "Monts Enneigés",           986,  214,  18, 300),
    (39, "Volcan Nuageux",           1280,  230,  20, 380),
    (36, "Steppes Arides",           1643,  329,  17, 420),
    (101, "Oasis Perdue",            1814,  557,  17, 380),
    (9, "Forêt Marécageuse",          345,  730,  21, 460),
    (38, "Lande Broussailleuse",      850,  560,   8, 300),
    (100, "Fleuve Paisible",          865,  885,   8, 340),
    (31, "Manoir Barjok",            1286,  586,  13, 200),
    (37, "Canyon Lekro",             1443,  800,  19, 300),
    (105, "Volcan Sombre",           1843,  886,  19, 260),
    (35, "Usine Désaffectée",        1429, 1186,  17, 260),
    (102, "Planque Snatch",          1757, 1171,  18, 280),
    (46, "Relique Sacrée",           1120, 1450,  18, 320),
    (32, "Plage Grain de Sel",        686, 1314,  15, 380),
]

#  Les deux zones qui sont DANS l'eau. Elles ne participent pas au
#  partage des terres — sinon elles mangeraient la côte.
MARINES = [
    (33, "Libra Échoué", 260, 1333, 330),      # les épaves, au large
    (104, "Océan Mystérieux", 1875, 1730, 220),
]

#  Où CHERCHER chaque ville : le nom va à la grappe de toits la plus
#  proche de ce point. Les coordonnées sont celles des grappes
#  RELEVÉES dans la peinture — le rattachement est donc exact, et la
#  position finale reste celle du peintre, au pixel près.
VILLES = [
    (12, "Pyrite", "ville", 651, 525),
    (16, "Tour Titanite", "ville", 1289, 174),
    (15, "Suerebe", "ville", 1336, 764),
    (5, "Phenacit", "ville", 1229, 935),
    (14, "Samaragd", "ville", 949, 981),
    (18, "Station Service", "ville", 1535, 912),
    (13, "Port-Amarée", "ville", 628, 1153),
    (17, "Île Ténèbra", "ville", 1597, 1704),
    (65, "Mont Bataille", "ligue", 923, 446),
]

def lisser(contour, pas=PAS, echelle=1.0):
    pts = [(c * echelle, r * echelle) for r, c in contour]
    gardes = [pts[i] for i in range(0, len(pts), pas)]
    if len(gardes) > 2 and math.dist(gardes[0], gardes[-1]) < pas * echelle / 2:
        gardes.pop()
    if len(gardes) < 6:
        return None
    gardes = [(round(x), round(y)) for x, y in gardes]
    n = len(gardes)
    d = f"M {gardes[0][0]} {gardes[0][1]}"
    for i in range(n):
        p0, p1 = gardes[(i - 1) % n], gardes[i]
        p2, p3 = gardes[(i + 1) % n], gardes[(i + 2) % n]
        c1 = (round(p1[0] + (p2[0] - p0[0]) / 7),
              round(p1[1] + (p2[1] - p0[1]) / 7))
        c2 = (round(p2[0] - (p3[0] - p1[0]) / 7),
              round(p2[1] - (p3[1] - p1[1]) / 7))
        d += f" C {c1[0]} {c1[1]} {c2[0]} {c2[1]} {p2[0]} {p2[1]}"
    return d + " Z"


def contours_de(masque, echelle, mini=420):
    morceaux = []
    for c in measure.find_contours(masque.astype(float), 0.5):
        if len(c) < mini:
            continue
        d = lisser(c, echelle=echelle)
        if d is not None:
            morceaux.append(d)
    return morceaux


def main():
    im = Image.open(SOURCE).convert("RGB")
    W, H = im.size
    rgb = np.asarray(im).astype(np.float64) / 255
    lab = color.rgb2lab(rgb)
    echelle = COTE / W

    #  ── LA TERRE ET L'EAU ─────────────────────────────────────────
    #
    #  Un seuil sur b* (jaune ↔ bleu) trouve l'eau... ET LES OMBRES DE
    #  LA NEIGE. Les crevasses des Monts Enneigés sont peintes dans un
    #  bleu plus franc que la mer côtière : au premier essai, la graine
    #  de la neige tombait sur un pixel classé « eau » et la zone
    #  n'existait pas du tout.
    #
    #  CE QUI SÉPARE VRAIMENT LA MER DU RESTE, c'est qu'elle TOUCHE LE
    #  BORD DE L'IMAGE. On prend donc le bleu, et on ne garde que la
    #  partie qui communique avec le cadre : un lac de montagne, une
    #  ombre, une mare de marais restent dans les terres, où ils sont.
    bleu = (lab[:, :, 2] < -14) & (lab[:, :, 1] < 12)
    etiq_b, nb = ndimage.label(bleu)
    bords = set(etiq_b[0, :]) | set(etiq_b[-1, :]) \
        | set(etiq_b[:, 0]) | set(etiq_b[:, -1])
    bords.discard(0)
    eau = np.isin(etiq_b, list(bords))
    terre = ~eau
    terre = ndimage.binary_opening(terre, iterations=2)
    terre = ndimage.binary_closing(terre, iterations=4)
    #  On ne garde que la masse principale : les récifs et les îlots
    #  ne sont pas le continent.
    etiq, n = ndimage.label(terre)
    if n == 0:
        raise SystemExit("aucune terre trouvée — le seuil d'eau est-il bon ?")
    tailles = ndimage.sum(terre, etiq, range(1, n + 1))
    principal = int(np.argmax(tailles)) + 1
    continent = etiq == principal
    iles = (etiq != principal) & terre
    #  Une île, ça fait au moins cinq cents pixels : en dessous, c'est
    #  un rocher dans l'eau, et le peintre en a semé partout.
    etiq_iles, m = ndimage.label(iles)
    grandes = np.zeros_like(iles)
    for k in range(1, m + 1):
        if (etiq_iles == k).sum() >= 6000:
            grandes |= etiq_iles == k

    ys, xs = np.mgrid[0:H, 0:W]

    #  ── LES ZONES, PAR CROISSANCE DE COULEUR ──────────────────────
    propriete = np.zeros((H, W), dtype=np.int32)
    for n_, (forum, nom, gx, gy, tol, rayon) in enumerate(GRAINES, start=1):
        cible = lab[gy, gx]
        ecart = np.sqrt(((lab - cible) ** 2).sum(axis=2))
        proche = (ecart < tol) & continent & (propriete == 0)
        dans_rayon = (xs - gx) ** 2 + (ys - gy) ** 2 <= rayon ** 2
        candidat = proche & dans_rayon
        #  LA CROISSANCE EST CONNEXE. Sans ça, une tache de la même
        #  couleur à l'autre bout du rayon rejoint la zone, et on
        #  obtient un territoire en deux morceaux qui ne se touchent
        #  pas.
        lab_c, k = ndimage.label(candidat)
        if lab_c[gy, gx] == 0:
            print(f"   · graine hors cible : {nom}")
            continue
        region = lab_c == lab_c[gy, gx]
        region = ndimage.binary_closing(region, iterations=3)
        propriete[region & continent & (propriete == 0)] = n_

    #  ── LE PARTAGE DU RESTE ───────────────────────────────────────
    #  Comme `carte-territoires.py` : chaque pixel de terre non réclamé
    #  va au territoire le plus proche. C'est ce qui fait que les zones
    #  se touchent sans trou.
    _, idx = ndimage.distance_transform_edt(propriete == 0, return_indices=True)
    plein = propriete[idx[0], idx[1]]
    plein[~continent] = 0

    #  ON GARDE LA CARTE DES ZONES, en image : `outils/carte-fondu.py`
    #  en a besoin pour savoir où sont les coutures, et la recalculer
    #  chez lui voudrait dire tenir deux fois les mêmes graines — donc
    #  les voir diverger un jour.
    Image.fromarray(plein.astype(np.uint8)).save("planches/peinte/zones.png")

    lieux = []
    for n_, (forum, nom, gx, gy, tol, rayon) in enumerate(GRAINES, start=1):
        region = ndimage.binary_closing(plein == n_, iterations=2)
        if not region.any():
            print(f"   · {nom} n'a rien reçu")
            continue
        morceaux = contours_de(region, echelle)
        if not morceaux:
            print(f"   · {nom} : contour trop petit")
            continue
        cy, cx = ndimage.center_of_mass(region)
        lieux.append({
            "forumId": forum, "nom": nom,
            "ancre": {"x": round(cx * echelle), "y": round(cy * echelle)},
            "forme": " ".join(morceaux),
            "aire": int(region.sum()),
        })

    #  ── LES ZONES MARINES ─────────────────────────────────────────
    for forum, nom, gx, gy, rayon in MARINES:
        cible = lab[gy, gx]
        ecart = np.sqrt(((lab - cible) ** 2).sum(axis=2))
        dans_rayon = (xs - gx) ** 2 + (ys - gy) ** 2 <= rayon ** 2
        #  Un disque, pas une tache : au large il n'y a pas de
        #  frontière à épouser, et une tache d'eau suivrait les
        #  vaguelettes du peintre.
        region = dans_rayon & ~continent
        region = ndimage.binary_closing(region, iterations=2)
        morceaux = contours_de(region, echelle)
        if morceaux:
            lieux.append({
                "forumId": forum, "nom": nom, "marine": True,
                "ancre": {"x": round(gx * echelle), "y": round(gy * echelle)},
                "forme": " ".join(morceaux),
                "aire": int(region.sum()),
            })

    #  ── LES VILLAGES, DÉTECTÉS PAR LEURS TOITS ────────────────────
    #  Le rouge des toits est le seul rouge saturé de la peinture : a*
    #  franchement positif, L* moyen. Les laves sont plus claires et
    #  bien plus jaunes.
    #  LA ROCHE DU CANYON EST ROUGE, ELLE AUSSI — et pas « un peu » :
    #  mesurée, elle est à L* 43, a* 28, b* 33, et un toit à L* 38,
    #  a* 30, b* 34. LA COULEUR NE LES SÉPARE PAS, et resserrer le
    #  seuil perd les toits avant de perdre la roche : essayé, treize
    #  « villages » détectés, tous dans le canyon.
    #
    #  CE QUI LES SÉPARE EST LA TAILLE. Un village peint fait deux à
    #  cinq cents pixels ; le canyon, refermé, fait un seul bloc de
    #  onze à quatorze mille. Une fenêtre de taille tranche net là où
    #  aucun seuil de teinte ne sait le faire.
    toits = (lab[:, :, 1] > 22) & (lab[:, :, 2] > 6) & (lab[:, :, 2] < 34) \
        & (lab[:, :, 0] > 24) & (lab[:, :, 0] < 62)
    toits = ndimage.binary_closing(toits, iterations=5)
    etiq_t, nt = ndimage.label(toits)
    grappes = []
    for k in range(1, nt + 1):
        m_ = etiq_t == k
        if not (150 <= m_.sum() <= 900):
            continue
        cy, cx = ndimage.center_of_mass(m_)
        grappes.append((cx, cy, int(m_.sum())))
    print(f"   {len(grappes)} grappe(s) de toits détectée(s)")

    pris = set()
    for forum, nom, sorte, vx, vy in VILLES:
        libres = [(i, g) for i, g in enumerate(grappes) if i not in pris]
        if not libres:
            print(f"   · pas de grappe libre pour {nom}")
            continue
        i, (cx, cy, aire) = min(
            libres, key=lambda t: math.dist((vx, vy), (t[1][0], t[1][1])))
        if math.dist((vx, vy), (cx, cy)) > 90:
            print(f"   · {nom} : grappe la plus proche à "
                  f"{round(math.dist((vx, vy), (cx, cy)))} px, on garde le repère")
            cx, cy = vx, vy
        else:
            pris.add(i)
        lieux.append({
            "forumId": forum, "nom": nom, "type": sorte,
            "ancre": {"x": round(cx * echelle), "y": round(cy * echelle)},
        })

    #  ── LA FUSION ─────────────────────────────────────────────────
    #
    #  La peinture donne la GÉOMÉTRIE : contours, ancres, côte, îles.
    #  Elle ne sait rien des niveaux recommandés, des paliers, des
    #  descriptions ni des identifiants de forum — tout ça vient du
    #  forum et ne doit pas se perdre. On fusionne donc par `forumId`,
    #  et un lieu que la peinture n'a pas gardé crie au lieu de
    #  disparaître en silence.
    ancien = json.loads(pathlib.Path("data/carte.json").read_text())
    par_id = {l["forumId"]: l for l in ancien["lieux"]}
    fusion = []
    for neuf in lieux:
        vieux = par_id.get(neuf["forumId"])
        if vieux is None:
            print(f"   · {neuf['nom']} n'existait pas dans data/carte.json")
            continue
        garde = {k: vieux[k] for k in
                 ("forumId", "nom", "type", "palier", "niveau", "description")
                 if k in vieux}
        garde["ancre"] = neuf["ancre"]
        if "forme" in neuf:
            garde["forme"] = neuf["forme"]
        fusion.append(garde)
    perdus = set(par_id) - {l["forumId"] for l in fusion}
    for f in perdus:
        print(f"   · PERDU : {par_id[f]['nom']} (f{f})")

    carte = {
        "_": "La carte de Rhode, RECALÉE SUR LA PEINTURE. Les contours, "
             "les ancres, la côte et les îles sont segmentés depuis "
             "`planches/peinte/source.png` par `outils/carte-peinte.py` : "
             "chaque zone épouse la région peinte qu'elle désigne. Les "
             "paliers, niveaux et descriptions viennent du forum et "
             "survivent à la fusion.",
        "_fond": "L'image peinte se pose DANS le SVG, derrière les "
                 "zones : `fond` porte son adresse, et le dessin "
                 "vectoriel reste dessous — si l'adresse tombe, la "
                 "carte marche encore.",
        "repere": {"largeur": COTE, "hauteur": COTE},
        "terre": " ".join(contours_de(continent, echelle, mini=1200)),
        "iles": contours_de(grandes, echelle, mini=420),
        "fond": ancien.get("fond", ""),
        "lieux": fusion,
    }
    pathlib.Path("data/carte.json").write_text(
        json.dumps(carte, ensure_ascii=False, indent=2) + "\n")
    print(f"peinte : {len(fusion)} lieux fusionnés, "
          f"{len(carte['iles'])} île(s), {len(perdus)} perdu(s)")
    #  LA MER VECTORIELLE A ÉTÉ EMPORTÉE, et c'est voulu : elle était
    #  calculée sur l'ancienne côte. Mais elle doit revenir — c'est
    #  elle qu'on voit si la peinture ne charge pas, et une carte sans
    #  mer est un continent qui flotte sur le fond du cadre.
    print("   ↳ enchaîner « python3 outils/carte-mer.py », "
          "la mer est le repli de la peinture")


if __name__ == "__main__":
    main()
