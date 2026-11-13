#!/usr/bin/env python3
# ════════════════════════════════════════════════════════════════════
#  carte-decoupage.py — les dix-sept zones, DÉRIVÉES DU DESSIN
#
#  Ce que l'outil écrit : `forme` et `ancre` des dix-sept zones, les
#  neuf ancres de lieux, `terre` et `iles`, dans data/carte.json.
#  Ce qu'il ne touche PAS : `mer` (c'est outils/carte-mer.py), `fond`,
#  et tout le reste des entrées de `lieux`.
#
#  ── POURQUOI UN OUTIL, ET PAS DES TRACÉS À LA MAIN ────────────────
#
#  La carte peinte change — elle a changé trois fois en une journée.
#  Dix-sept polygones retouchés à la souris ne suivent pas ; un
#  découpage qui se relance, si. Et il suit LE DESSIN : les frontières
#  tombent sur la lisière de la forêt, le pied du canyon, le bord de
#  l'oasis, parce qu'elles sont calculées à partir des couleurs du
#  dessin et pas posées par-dessus.
#
#  Ne pas retoucher un `forme` à la main dans data/carte.json. Déplacer
#  une graine ici, et relancer.
#
#  ── LA CHAÎNE ─────────────────────────────────────────────────────
#
#  1. CLASSER   chaque pixel du dessin en sept terrains, par couleur.
#  2. PARTAGER  le continent entre les graines, chacune ne prenant que
#               les terrains de sa famille.
#  3. LISSER    la partition, parce que la classification est grenue.
#  4. TRACER    les contours en chemins SVG, trous compris.
#  5. ÉCRIRE    dans data/carte.json.
#
#  Usage :  python3 outils/carte-decoupage.py [--rendu]
#  --rendu écrit aussi planches/decoupage.png, le calque de contrôle
#  à regarder avant de valider.
# ════════════════════════════════════════════════════════════════════
import json
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFont
from scipy import ndimage
from skimage import measure

SOURCE = "planches/peinte/source.png"
CARTE = "data/carte.json"
RENDU = "planches/decoupage.png"
REPERE = 1000  # la grille de data/carte.json

#  ── 1. LES SEPT TERRAINS ──────────────────────────────────────────
#
#  Des seuils sur la couleur, réglés à l'œil sur CE dessin. Ils ne
#  survivront pas à un dessin au style très différent : c'est le
#  rendu de contrôle qui le dira, pas une exception.
MER, NEIGE, SABLE, CANYON, FORET, SOMBRE, ROCHE = range(1, 8)


def classer(a):
    r, g, b = a[:, :, 0], a[:, :, 1], a[:, :, 2]
    mx, mn = a.max(2), a.min(2)
    mer = (b > r + 35) & (b > 80)
    neige = mn > 185
    sable = (r > 195) & (g > 140) & (b < 165) & (r - b > 60) & ~neige
    canyon = (r > 150) & (r - g > 45) & (g - b > 15) & ~sable
    foret = (g >= r) & (g > b + 15) & (g > 55)
    sombre = mx < 85
    roche = ~(mer | neige | sable | canyon | foret | sombre)
    cl = np.zeros(r.shape, dtype=np.uint8)
    for i, m in enumerate([mer, neige, sable, canyon, foret, sombre, roche], start=1):
        cl[(cl == 0) & m] = i
    return cl


#  ── 2. LES GRAINES ────────────────────────────────────────────────
#
#  `famille` : les terrains que la zone a le DROIT de prendre. Sans
#  cette contrainte la forêt mange le sable, et la frontière ne suit
#  plus la lisière qu'on voit sur le dessin.
FAM_SABLE, FAM_ROCHE, FAM_FORET = {SABLE}, {NEIGE, ROCHE}, {FORET}
ZONES = [
    ("Monts Enneigés", (300, 140), FAM_ROCHE),
    ("Relique Sacrée", (335, 180), FAM_ROCHE),
    ("Montagnes Embrumées", (235, 245), FAM_ROCHE),
    ("Volcan Nuageux", (620, 110), FAM_ROCHE),
    ("Forêt Marécageuse", (250, 520), FAM_FORET),
    ("Manoir Barjok", (232, 430), FAM_FORET),
    ("Lande Broussailleuse", (470, 330), FAM_FORET | FAM_ROCHE),
    ("Plage Grain de Sel", (115, 560), FAM_SABLE),
    ("Steppes Arides", (690, 230), FAM_SABLE),
    ("Canyon Lekro", (845, 330), {CANYON} | FAM_SABLE),
    ("Oasis Perdue", (650, 455), FAM_SABLE),
    ("Libra Échoué", (790, 548), FAM_SABLE),
    ("Planque Snatch", (890, 440), FAM_SABLE),
    ("Usine Désaffectée", (790, 680), FAM_SABLE),
    ("Fleuve Paisible", (405, 450), {MER, ROCHE}),
]
ILE = ("Volcan Sombre", (850, 880))
OCEAN = ("Océan Mystérieux", (150, 880))

#  LES NEUF LIEUX sont des POINTS, pas des zones : une ville, une
#  arène, une station n'ont pas de surface de chasse. Placés d'après
#  le brief du 13 novembre.
LIEUX = {
    "Samaragd": (270, 200),
    "Mont Bataille": (620, 110),
    "Tour Titanite": (735, 300),
    "Phenacit": (650, 455),
    "Station Service": (800, 430),
    "Pyrite": (800, 545),
    "Suerebe": (800, 600),
    "Port-Amarée": (405, 800),
    "Île Ténèbra": (850, 905),
}

#  ── LE BRUIT QUI PLIE LES FRONTIÈRES ──────────────────────────────
#
#  « Essaye de ne pas trop faire des formes triangulaires mais plus
#  organiques », 13 novembre. Une partition par plus-proche-graine
#  donne des frontières DROITES qui se rejoignent en pointes : des
#  parts de tarte, surtout dans le désert où aucun terrain ne vient
#  les plier.
#
#  On ajoute donc à la distance un bruit lisse : la frontière suit
#  toujours le milieu entre deux graines, mais elle ondule autour.
#  DEUX ÉCHELLES — une seule donne une ondulation régulière, qui se
#  lit encore comme une courbe au compas. La grande dessine le
#  mouvement d'ensemble, la petite ébrèche le trait.
#
#  POURQUOI 35. Mesure de la surface qui tombe hors du morceau
#  principal de sa zone, le tracé ne gardant que le principal :
#      amplitude  0 → 8,23 %   (le témoin : c'est la contrainte de
#      amplitude 20 → 8,02 %    biome qui morcelle, pas le bruit)
#      amplitude 35 → 8,09 %
#      amplitude 55 → 9,25 %
#  35 ondule visiblement sans rien coûter. Au-delà, on paie.
#
#  LE TIRAGE EST FIXE : un dépôt qui redessine sa carte à chaque
#  exécution n'a pas de carte.
GRAINE_ALEA = 1311
AMPLITUDE = 35.0


def bruit(rng, h, w):
    def octave(sigma):
        b = ndimage.gaussian_filter(rng.standard_normal((h, w)).astype(np.float32), sigma)
        return b / (b.std() + 1e-9)

    b = 0.75 * octave(60) + 0.25 * octave(22)
    return b / (b.std() + 1e-9)


def partager(cl):
    h, w = cl.shape
    rng = np.random.default_rng(GRAINE_ALEA)
    ys, xs = np.mgrid[0:h, 0:w]

    #  Les composantes de terre : le continent, l'île, les îlots.
    lab, n = ndimage.label(cl != MER)
    tailles = ndimage.sum(cl != MER, lab, range(1, n + 1))
    ordre = np.argsort(tailles)[::-1] + 1
    continent, ile = ordre[0], ordre[1]

    zone = np.full(cl.shape, -1, dtype=int)
    masque = lab == continent
    dist = np.full(cl.shape, 1e18)
    for i, (_, (gx, gy), fam) in enumerate(ZONES):
        #  La RACINE de la distance, pour que le bruit pèse en pixels
        #  et pas en pixels carrés — sinon il ne se voit qu'au loin.
        d = np.sqrt((xs - gx) ** 2 + (ys - gy) ** 2) + AMPLITUDE * bruit(rng, h, w)
        ok = masque & np.isin(cl, list(fam)) & (d < dist)
        zone[ok] = i
        dist[ok] = d[ok]

    #  Ce que personne n'a pris — un terrain qu'aucune graine n'admet
    #  à cet endroit — va au plus proche, toutes familles confondues.
    reste = masque & (zone < 0)
    if reste.any():
        d2 = np.full(cl.shape, 1e18)
        for i, (_, (gx, gy), _f) in enumerate(ZONES):
            d = np.sqrt((xs - gx) ** 2 + (ys - gy) ** 2) + AMPLITUDE * bruit(rng, h, w)
            ok = reste & (d < d2)
            zone[ok] = i
            d2[ok] = d[ok]

    #  ── 3. ON LISSE LA PARTITION, pas seulement le contour ────────
    #
    #  La classification par couleur est GRENUE : un caillou gris au
    #  milieu du sable, une touffe verte dans la roche. Chaque grain
    #  part vers une graine différente de son voisinage, et la zone
    #  se retrouve en morceaux — que le tracé jette sans rien dire,
    #  puisqu'il ne garde que le plus gros.
    #
    #  Un filtre majoritaire donne à chaque pixel la zone dominante
    #  de son voisinage. Le grain disparaît, l'ondulation reste.
    terre = zone >= 0
    for _ in range(2):
        pile = np.stack(
            [ndimage.uniform_filter((zone == i).astype(np.float32), 21) for i in range(len(ZONES))]
        )
        zone = np.where(terre, pile.argmax(0), -1)

    zone[lab == ile] = len(ZONES)
    #  L'OCÉAN MYSTÉRIEUX EST UNE ZONE, pas un fond : toute l'eau, et
    #  les îlots avec — ils ne sont pas des terrains de chasse à eux
    #  seuls.
    zone[zone < 0] = len(ZONES) + 1
    return zone


#  ── 4. LES CONTOURS ───────────────────────────────────────────────


def contours(masque, boucher=True):
    """Tous les contours de la plus grosse composante : l'extérieur ET
    LES TROUS.

    L'Océan Mystérieux est le cas qui l'impose : son seul contour
    extérieur est le bord de l'image, et la forme obtenue recouvrait
    le continent entier. Rendus en sous-chemins avec `evenodd`, les
    trous se creusent.
    """
    lab, n = ndimage.label(masque)
    if n == 0:
        return None
    tailles = ndimage.sum(masque, lab, range(1, n + 1))
    gros = lab == (int(np.argmax(tailles)) + 1)
    #  LES PETITS TROUS SE BOUCHENT, sauf pour l'océan : une mare
    #  classée à part laisse un trou dans la zone, donc un point qui
    #  ne se clique pas. L'océan, lui, DOIT garder les siens — ce
    #  sont le continent et l'île.
    if boucher:
        gros = ndimage.binary_fill_holes(gros)
    #  On lisse avant de tracer : la classification laisse des dents
    #  d'un pixel, et un contour qui les suit fait trente mille points.
    gros = ndimage.binary_closing(gros, np.ones((9, 9)))
    gros = ndimage.binary_opening(gros, np.ones((7, 7)))
    cs = measure.find_contours(ndimage.gaussian_filter(gros.astype(float), 3), 0.5)
    sortie = []
    for c in cs:
        if len(c) < 12:
            continue
        #  Douglas-Peucker : on garde la forme, pas le bruit. 2 px de
        #  tolérance sur une grille de 1000.
        c = measure.approximate_polygon(c, tolerance=2.0)
        if len(c) < 4:
            continue
        #  L'aire par la formule du lacet : sous 300 px, c'est un
        #  caillou de classification, pas une île.
        y, x = c[:, 0], c[:, 1]
        aire = abs(np.dot(x, np.roll(y, 1)) - np.dot(y, np.roll(x, 1))) / 2
        if aire < 300:
            continue
        sortie.append([(round(float(a), 1), round(float(b), 1)) for b, a in c])
    return sortie or None


def chemin(listes):
    if not listes:
        return None
    bouts = []
    for pts in listes:
        if len(pts) < 3:
            continue
        d = f"M {pts[0][0]} {pts[0][1]}"
        for x, y in pts[1:]:
            d += f" L {x} {y}"
        bouts.append(d + " Z")
    return " ".join(bouts) or None


def tracer_cote(masque):
    """Le contour du continent ou de l'île, d'un seul tenant."""
    m = ndimage.binary_fill_holes(masque)
    m = ndimage.binary_closing(m, np.ones((9, 9)))
    cs = measure.find_contours(ndimage.gaussian_filter(m.astype(float), 3), 0.5)
    c = measure.approximate_polygon(max(cs, key=len), tolerance=2.0)
    return "M " + " L ".join(f"{round(float(x), 1)} {round(float(y), 1)}" for y, x in c) + " Z"


#  ── LE RENDU DE CONTRÔLE ──────────────────────────────────────────
PALETTE = [
    (39, 94, 122), (177, 64, 47), (120, 120, 160), (160, 80, 40), (63, 125, 82),
    (120, 70, 30), (150, 140, 60), (220, 180, 120), (200, 150, 60), (190, 80, 50),
    (40, 150, 160), (150, 100, 40), (90, 60, 100), (100, 100, 110), (40, 110, 160),
    (60, 50, 60),
]


def rendre(fond, zone):
    h, w = zone.shape
    arr = np.zeros((h, w, 4), dtype=np.uint8)
    for i in range(len(ZONES) + 1):
        arr[zone == i] = (*PALETTE[i % len(PALETTE)], 110)
    #  Les frontières en blanc : c'est ce qu'il faut regarder.
    bord = np.zeros((h, w), bool)
    bord[:-1] |= zone[:-1] != zone[1:]
    bord[:, :-1] |= zone[:, :-1] != zone[:, 1:]
    bord &= zone >= 0
    arr[bord] = (255, 255, 255, 235)
    out = Image.alpha_composite(fond.convert("RGBA"), Image.fromarray(arr)).convert("RGB")

    d = ImageDraw.Draw(out)
    try:
        police = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 15)
    except OSError:
        police = ImageFont.load_default()

    def etiquette(nom, gx, gy, fond_, texte, bord_):
        t = d.textbbox((0, 0), nom, font=police)
        tw, th = t[2] - t[0], t[3] - t[1]
        d.rounded_rectangle(
            (gx - tw // 2 - 7, gy - th // 2 - 6, gx + tw // 2 + 7, gy + th // 2 + 7),
            10, fill=fond_, outline=bord_, width=2)
        d.text((gx - tw // 2, gy - th // 2 - 1), nom, font=police, fill=texte)

    for nom, (gx, gy) in LIEUX.items():
        d.ellipse((gx - 9, gy - 9, gx + 9, gy + 9), fill=(39, 94, 122),
                  outline=(255, 251, 247), width=3)
    for nom, (gx, gy), _f in ZONES:
        etiquette(nom, gx, gy, (255, 251, 247), (46, 32, 24), (46, 32, 24))
    for nom, (gx, gy) in (ILE, OCEAN):
        etiquette(nom, gx, gy, (255, 251, 247), (46, 32, 24), (46, 32, 24))
    #  Les lieux par-dessus, en terre : on voit d'un coup ce qui est
    #  une zone et ce qui est un point.
    for nom, (gx, gy) in LIEUX.items():
        etiquette(nom, gx, gy + 16, (139, 71, 37), (255, 251, 247), (255, 251, 247))
    return out


def main():
    src = Image.open(SOURCE).convert("RGB").resize((REPERE, REPERE), Image.BICUBIC)
    cl = classer(np.asarray(src).astype(int))
    zone = partager(cl)

    noms = [n for n, _, _ in ZONES] + [ILE[0], OCEAN[0]]
    formes = {}
    for i, nom in enumerate(noms):
        m = zone == i
        if m.sum() < 80:
            print(f"  ! {nom} : {int(m.sum())} px, ignorée")
            continue
        p = chemin(contours(m, boucher=(nom != OCEAN[0])))
        if p is None:
            print(f"  ! {nom} : pas de contour")
            continue
        formes[nom] = p
        print(f"  {nom:22} {int(m.sum()):>7} px · {len(p)} caractères")

    #  ── 5. ÉCRIRE ─────────────────────────────────────────────────
    d = json.load(open(CARTE))
    connus = {l["nom"] for l in d["lieux"]}
    manquants = [n for n in list(formes) + list(LIEUX) if n not in connus]
    assert not manquants, f"inconnus dans {CARTE} : {manquants}"

    ancres = {n: g for n, g, _ in ZONES}
    ancres[ILE[0]], ancres[OCEAN[0]] = ILE[1], OCEAN[1]
    ancres.update(LIEUX)
    for l in d["lieux"]:
        if l["nom"] in formes:
            l["forme"] = formes[l["nom"]]
        if l["nom"] in ancres:
            x, y = ancres[l["nom"]]
            l["ancre"] = {"x": int(x), "y": int(y)}

    #  LA CÔTE SUIT LE MÊME DESSIN : le contour du continent est celui
    #  de l'océan en négatif, issu de la même classification.
    terre = (zone >= 0) & (zone != len(ZONES) + 1)
    lab, n = ndimage.label(terre)
    ordre = np.argsort(ndimage.sum(terre, lab, range(1, n + 1)))[::-1] + 1
    d["terre"] = tracer_cote(lab == ordre[0])
    d["iles"] = [tracer_cote(lab == ordre[1])]

    json.dump(d, open(CARTE, "w"), ensure_ascii=False, indent=1)
    print(f"{len(formes)} formes · terre {len(d['terre'])} · île {len(d['iles'][0])}")

    if "--rendu" in sys.argv:
        rendre(src, zone).resize((1400, 1400)).save(RENDU)
        print("écrit", RENDU)


if __name__ == "__main__":
    main()
