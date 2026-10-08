#!/usr/bin/env python3
# ════════════════════════════════════════════════════════════════════
#  outils/carte-affiche.py — l'affiche de la carte de Rhode.
#
#  Demandée le 8 octobre : « génère une image d'une carte pokémon, qui
#  coïncide avec la carte que tu as faite pour le forum […] des chemins
#  sinueux, une ancre à la Relique Sacrée pour le port vers l'Île
#  Ténèbra, les reliefs, et chaque zone avec son biome. Elle doit
#  impérativement rester compréhensible et lisible. »
#
#  ── POURQUOI ELLE EST DESSINÉE ET PAS GÉNÉRÉE ───────────────────────
#
#  « Qui coïncide avec la carte que tu as faite » est la contrainte qui
#  décide de tout. Un modèle d'image ne sait pas poser vingt-six lieux
#  nommés à leurs coordonnées exactes : il ferait une jolie carte d'un
#  autre monde, avec du faux texte. Ici, chaque contour, chaque ancre
#  et chaque étiquette SORT de `data/carte.json` — le même fichier que
#  le forum. Les deux ne peuvent pas diverger.
#
#  ── CE QUE CHAQUE COUCHE APPORTE ────────────────────────────────────
#
#  L'ordre est celui d'une carte peinte, et il n'est pas négociable :
#  la mer, la terre, les territoires, le relief semé dedans, les
#  chemins par-dessus, les villes, puis les étiquettes tout en haut.
#  Une étiquette sous un relief est illisible, et c'est la demande
#  explicite de Callista : « elle doit impérativement rester
#  compréhensible et lisible ».
#
#  ── LA LISIBILITÉ EST CALCULÉE, PAS ESPÉRÉE ─────────────────────────
#
#  Vingt-six étiquettes sur deux lignes — le nom, puis le biome — se
#  marchent dessus. Comme dans `carte-geographie.py`, on les écarte par
#  relaxation : des ressorts qui repoussent les boîtes qui se croisent
#  et rappellent chacune vers son lieu. Le script DIT combien il en
#  reste à la fin, et le garde-fou refuse qu'il en reste.
# ════════════════════════════════════════════════════════════════════

import json
import math
import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).parent))
from chemin_svg import dedans, points_du_chemin, semer  # noqa: E402

SORTIE = pathlib.Path("planches/carte-de-rhode.svg")

#  Le cadre déborde du repère : l'affiche a besoin d'eau autour pour
#  poser son titre et sa légende sans les coller au continent.
MARGE_G, MARGE_H = 86, 104
MARGE_D, MARGE_B = 86, 118


# ── la palette ──────────────────────────────────────────────────────
#
#  Plus colorée que celle du forum, et c'est voulu : une affiche se
#  regarde à un mètre, et « les territoires doivent être distincts
#  visuellement ». Les teintes restent dans le monde chaud de la
#  charte — terre, sable, mousse — avec l'eau en bleu-ardoise pour
#  trancher.

#  La rampe de mer : de l'eau profonde au bord du cadre jusqu'au
#  turquoise du rivage. Neuf crans, interpolés — « un vrai dégradé »
#  demandé le 8 octobre — et FLOUTÉS au rendu, ce qu'une affiche peut
#  se permettre et pas une page qu'on fait glisser.
EAU_LARGE = (0x1e, 0x4a, 0x60)
EAU_RIVE = (0x8e, 0xc4, 0xc9)
EAU = ["#2c5c73", "#35697f", "#44798d", "#58909f", "#79aab4"]


def eau(t):
    """La teinte de la mer à la profondeur `t`, de 0 au large à 1 au
    rivage."""
    return "#%02x%02x%02x" % tuple(
        round(EAU_LARGE[k] + (EAU_RIVE[k] - EAU_LARGE[k]) * t) for k in range(3))
SABLE_COTE = "#ecd9b8"
TERRE = "#e7e4c4"   # une plaine, pas un parchemin
TRAIT = "#5a4433"
ENCRE = "#33261d"
CREME = "#fdf6e8"

#  forumId : (biome écrit sous le nom, fond, ombre, glyphe)
BIOMES = {
    34: ("Montagne brumeuse", "#a8b3ab", "#8d9a92", "pic"),
    9: ("Marais boisé", "#5c7b55", "#48643f", "palétuvier"),
    38: ("Lande", "#9aa961", "#83924c", "buisson"),
    100: ("Prairie fluviale", "#8ebb77", "#75a35f", "roseau"),
    32: ("Plage", "#f2ddb0", "#dec393", "palmier"),
    36: ("Steppe aride", "#dcc478", "#c7ab5c", "touffe"),
    37: ("Canyon", "#cb7f4c", "#ad6538", "mesa"),
    39: ("Volcan", "#7d6a62", "#63534c", "cratère"),
    101: ("Désert et oasis", "#efdca8", "#dcc68a", "dune"),
    31: ("Manoir hanté", "#857397", "#6c5c7d", "arbre-mort"),
    35: ("Friche industrielle", "#96968c", "#7c7c72", "cheminée"),
    33: ("Côte d'épaves", "#9db2b8", "#83999f", "épave"),
    103: ("Haute montagne enneigée", "#eaf1f4", "#cdd9df", "pic-neige"),
    102: ("Repaire rocheux", "#7a6b5c", "#62543f", "rocher"),
    46: ("Ruines côtières", "#cdbf9d", "#b4a584", "colonne"),
    105: ("Volcan actif", "#55474a", "#3e3335", "cratère"),
    104: ("Haute mer", "#3d7f93", "#2f6b7e", "vague"),
}

#  Le réseau de chemins. Écrit à la main parce que c'est de la
#  GÉOGRAPHIE, pas du calcul : deux lieux proches ne sont pas forcément
#  reliés, et la Ligue ne se rejoint pas par quatre côtés.
CHEMINS = [
    (12, 34), (12, 9), (12, 16), (12, 5),
    (16, 38), (16, 65), (16, 39), (39, 103),
    (65, 15), (15, 38), (15, 36), (15, 18), (15, 31),
    (36, 37), (37, 101), (37, 105), (18, 37), (18, 35),
    (35, 102), (35, 46), (14, 35), (14, 100), (14, 46), (14, 31),
    (100, 5), (100, 38), (5, 9), (5, 13), (13, 32), (13, 33),
    (31, 38),
]

#  Les routes de mer, en pointillé. L'ancre est à la Relique Sacrée :
#  c'est de là qu'on embarque pour l'Île Ténèbra.
ROUTES_DE_MER = [(46, 17), (17, 104)]

#  Les zones qui sont dans l'eau, et qu'on rogne à l'eau.
MARINES = {104}
PORT = 46

#  Les fleuves. Écrits à la main, comme les chemins, et pour la même
#  raison : l'eau descend, elle ne relie pas deux points au hasard.
#  Le dernier point n'est pas l'embouchure — elle est CALCULÉE, en
#  prolongeant la course jusqu'à sortir des terres. Une rivière qui
#  s'arrête au milieu d'un champ est la faute qu'on remarque en
#  premier sur une carte dessinée.
FLEUVES = [
    [(256, 148), (276, 222), (300, 282), (296, 338), (314, 386), (294, 428),
     (254, 458), (228, 494)],
    #  Celui-ci descend des Steppes, creuse le Canyon et sort à l'est.
    #  Ses points sont décalés en quinconce : alignés, le lissage en
    #  faisait une règle, et une rivière droite n'existe pas.
    [(594, 182), (636, 206), (654, 248), (698, 266), (716, 306), (758, 320),
     (776, 352), (818, 358)],
]

#  Les étendues d'eau : un point, un rayon. Deux suffisent — une carte
#  piquée de lacs ne dit plus où est l'eau qui compte. Aucune ne doit
#  tomber sous un fleuve, sinon on ne voit qu'un élargissement.
LACS = [(842, 150, 15), (356, 404, 12)]


# ── petits outils de dessin ─────────────────────────────────────────

def hache(i):
    """Une valeur dans [0, 1[, reproductible, sans `random` — dont la
    suite change entre deux versions de Python, ce qui ferait une
    affiche différente à chaque machine."""
    return (math.sin(i * 12.9898 + 78.233) + 1) / 2


def catmull(pts, ferme=False):
    """Une polyligne en courbe douce. Le même procédé que partout
    ailleurs dans ce projet."""
    n = len(pts)
    d = f"M {rond(pts[0][0])} {rond(pts[0][1])}"
    fin = n if ferme else n - 1
    for i in range(fin):
        p0 = pts[(i - 1) % n] if ferme else pts[max(i - 1, 0)]
        p1 = pts[i % n]
        p2 = pts[(i + 1) % n]
        p3 = pts[(i + 2) % n] if ferme else pts[min(i + 2, n - 1)]
        c1 = (p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6)
        c2 = (p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6)
        d += (f" C {rond(c1[0])} {rond(c1[1])} {rond(c2[0])} {rond(c2[1])}"
              f" {rond(p2[0])} {rond(p2[1])}")
    return d + (" Z" if ferme else "")


def rond(v):
    return round(v, 1)


def echappe(t):
    return t.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


# ── le relief ───────────────────────────────────────────────────────
#
#  Un glyphe par biome. Ils sont minuscules — six à douze unités — et
#  c'est leur RÉPÉTITION qui fait la texture, pas leur détail : à
#  cette taille, un dessin fin devient une tache.

def glyphe(sorte, x, y, t, i, ombre):
    g = []
    h = hache(i)
    if sorte in ("pic", "pic-neige"):
        haut = t * (1.1 + 0.5 * h)
        large = t * 0.82
        clair = "#ffffff" if sorte == "pic-neige" else "#e9eef0"
        g.append(f'<path d="M {rond(x - large)} {rond(y)} L {rond(x)} '
                 f'{rond(y - haut)} L {rond(x + large)} {rond(y)} Z" '
                 f'fill="{ombre}"/>')
        g.append(f'<path d="M {rond(x)} {rond(y - haut)} L {rond(x + large)} '
                 f'{rond(y)} L {rond(x + large * 0.2)} {rond(y)} Z" '
                 f'fill="{clair}" opacity="0.55"/>')
        if sorte == "pic-neige":
            g.append(f'<path d="M {rond(x - large * 0.42)} '
                     f'{rond(y - haut * 0.52)} L {rond(x)} {rond(y - haut)} '
                     f'L {rond(x + large * 0.42)} {rond(y - haut * 0.52)} '
                     f'Q {rond(x)} {rond(y - haut * 0.3)} '
                     f'{rond(x - large * 0.42)} {rond(y - haut * 0.52)} Z" '
                     f'fill="#ffffff"/>')
    elif sorte == "palétuvier":
        g.append(f'<ellipse cx="{rond(x)}" cy="{rond(y)}" rx="{rond(t * 0.9)}" '
                 f'ry="{rond(t * 0.68)}" fill="{ombre}"/>')
        g.append(f'<ellipse cx="{rond(x - t * 0.2)}" cy="{rond(y - t * 0.3)}" '
                 f'rx="{rond(t * 0.55)}" ry="{rond(t * 0.42)}" '
                 f'fill="#6f9165"/>')
    elif sorte == "buisson":
        g.append(f'<path d="M {rond(x - t * 0.8)} {rond(y)} '
                 f'q {rond(t * 0.4)} {rond(-t * 0.9)} {rond(t * 0.8)} 0 Z" '
                 f'fill="{ombre}"/>')
    elif sorte == "roseau":
        for k in range(3):
            dx = (k - 1) * t * 0.42
            g.append(f'<path d="M {rond(x + dx)} {rond(y)} q {rond(t * 0.22)} '
                     f'{rond(-t * 0.5)} {rond(t * 0.1)} {rond(-t * 1.0)}" '
                     f'stroke="{ombre}" stroke-width="0.8" fill="none"/>')
    elif sorte == "palmier":
        g.append(f'<path d="M {rond(x)} {rond(y)} q {rond(t * 0.18)} '
                 f'{rond(-t * 0.7)} 0 {rond(-t * 1.2)}" stroke="#9c7a4e" '
                 f'stroke-width="1" fill="none"/>')
        for a in (-1, -0.4, 0.4, 1):
            g.append(f'<path d="M {rond(x)} {rond(y - t * 1.2)} q '
                     f'{rond(a * t * 0.5)} {rond(-t * 0.28)} {rond(a * t * 0.9)} '
                     f'{rond(t * 0.1)}" stroke="#5f8a4e" stroke-width="1.1" '
                     f'fill="none" stroke-linecap="round"/>')
    elif sorte == "touffe":
        for a in (-0.6, 0, 0.6):
            g.append(f'<path d="M {rond(x + a * t * 0.4)} {rond(y)} l '
                     f'{rond(a * t * 0.3)} {rond(-t * 0.75)}" stroke="{ombre}" '
                     f'stroke-width="0.9" stroke-linecap="round"/>')
    elif sorte == "mesa":
        #  Un plateau à deux redans plutôt qu'un trapèze : c'est ce qui
        #  distingue une mesa d'une brique, et quatre mesas identiques
        #  côte à côte font un mur. La largeur, la hauteur et
        #  l'asymétrie du sommet varient toutes les trois.
        h2 = hache(i * 5 + 3)
        l = t * (0.75 + 0.85 * h)
        haut = t * (0.6 + 0.6 * h2)
        gauche = l * (0.6 + 0.2 * h2)
        droite = l * (0.55 + 0.3 * h)
        g.append(f'<path d="M {rond(x - l)} {rond(y)} L {rond(x - gauche)} '
                 f'{rond(y - haut * 0.55)} L {rond(x - gauche * 0.8)} '
                 f'{rond(y - haut)} L {rond(x + droite * 0.85)} '
                 f'{rond(y - haut)} L {rond(x + droite)} '
                 f'{rond(y - haut * 0.5)} L {rond(x + l)} {rond(y)} Z" '
                 f'fill="{ombre}"/>')
        g.append(f'<path d="M {rond(x + droite * 0.85)} {rond(y - haut)} L '
                 f'{rond(x + droite)} {rond(y - haut * 0.5)} L {rond(x + l)} '
                 f'{rond(y)} L {rond(x + l * 0.55)} {rond(y)} Z" '
                 f'fill="#000000" opacity="0.14"/>')
    elif sorte == "cratère":
        g.append(f'<path d="M {rond(x - t)} {rond(y)} L {rond(x - t * 0.3)} '
                 f'{rond(y - t * 1.1)} L {rond(x + t * 0.3)} '
                 f'{rond(y - t * 1.1)} L {rond(x + t)} {rond(y)} Z" '
                 f'fill="{ombre}"/>')
        g.append(f'<ellipse cx="{rond(x)}" cy="{rond(y - t * 1.1)}" '
                 f'rx="{rond(t * 0.3)}" ry="{rond(t * 0.12)}" fill="#e2762c"/>')
    elif sorte == "dune":
        g.append(f'<path d="M {rond(x - t)} {rond(y)} q {rond(t * 0.5)} '
                 f'{rond(-t * 0.6)} {rond(t * 1.1)} {rond(-t * 0.05)}" '
                 f'stroke="{ombre}" stroke-width="1" fill="none" '
                 f'stroke-linecap="round"/>')
    elif sorte == "arbre-mort":
        g.append(f'<path d="M {rond(x)} {rond(y)} L {rond(x)} '
                 f'{rond(y - t * 1.1)} M {rond(x)} {rond(y - t * 0.7)} l '
                 f'{rond(-t * 0.5)} {rond(-t * 0.35)} M {rond(x)} '
                 f'{rond(y - t * 0.85)} l {rond(t * 0.45)} {rond(-t * 0.3)}" '
                 f'stroke="{ombre}" stroke-width="0.9" fill="none" '
                 f'stroke-linecap="round"/>')
    elif sorte == "cheminée":
        g.append(f'<rect x="{rond(x - t * 0.3)}" y="{rond(y - t * 1.2)}" '
                 f'width="{rond(t * 0.6)}" height="{rond(t * 1.2)}" '
                 f'fill="{ombre}"/>')
        g.append(f'<ellipse cx="{rond(x)}" cy="{rond(y - t * 1.45)}" '
                 f'rx="{rond(t * 0.45)}" ry="{rond(t * 0.22)}" fill="#ffffff" '
                 f'opacity="0.45"/>')
    elif sorte == "épave":
        g.append(f'<path d="M {rond(x - t)} {rond(y)} q {rond(t)} '
                 f'{rond(t * 0.5)} {rond(t * 2)} 0 Z" fill="{ombre}"/>')
        g.append(f'<path d="M {rond(x + t * 0.2)} {rond(y)} L '
                 f'{rond(x + t * 0.5)} {rond(y - t * 1.1)}" stroke="{ombre}" '
                 f'stroke-width="0.9"/>')
    elif sorte == "rocher":
        g.append(f'<path d="M {rond(x - t * 0.8)} {rond(y)} L '
                 f'{rond(x - t * 0.4)} {rond(y - t * 0.7)} L {rond(x + t * 0.4)} '
                 f'{rond(y - t * 0.6)} L {rond(x + t * 0.85)} {rond(y)} Z" '
                 f'fill="{ombre}"/>')
    elif sorte == "colonne":
        g.append(f'<rect x="{rond(x - t * 0.22)}" y="{rond(y - t * 1.2)}" '
                 f'width="{rond(t * 0.44)}" height="{rond(t * 1.2)}" '
                 f'fill="{CREME}" opacity="0.8"/>')
        g.append(f'<rect x="{rond(x - t * 0.38)}" y="{rond(y - t * 1.35)}" '
                 f'width="{rond(t * 0.76)}" height="{rond(t * 0.18)}" '
                 f'fill="{ombre}"/>')
    elif sorte == "vague":
        g.append(f'<path d="M {rond(x - t)} {rond(y)} q {rond(t * 0.5)} '
                 f'{rond(-t * 0.5)} {rond(t)} 0 q {rond(t * 0.5)} '
                 f'{rond(t * 0.5)} {rond(t)} 0" stroke="#ffffff" '
                 f'opacity="0.33" stroke-width="1.2" fill="none"/>')
    return "".join(g)


# ── les villes ──────────────────────────────────────────────────────

def ville(x, y, grande=False):
    """Un petit groupe de toits. Reconnaissable à huit pixels, ce qui
    est la seule exigence : une ville doit se distinguer d'une zone du
    premier coup d'œil, pas se détailler."""
    e = 1.35 if grande else 1.0
    g = [f'<ellipse cx="{rond(x)}" cy="{rond(y + 3.4 * e)}" '
         f'rx="{rond(9 * e)}" ry="{rond(3.2 * e)}" fill="#000000" '
         f'opacity="0.13"/>']
    toits = [(-5.2, 0.6, 4.2), (0.3, -1.6, 5.4), (5.4, 0.9, 3.9)]
    for dx, dy, l in toits:
        bx, by = x + dx * e, y + dy * e
        l *= e
        g.append(f'<rect x="{rond(bx - l / 2)}" y="{rond(by)}" '
                 f'width="{rond(l)}" height="{rond(l * 0.78)}" '
                 f'fill="{CREME}" stroke="{TRAIT}" stroke-width="0.7"/>')
        g.append(f'<path d="M {rond(bx - l * 0.66)} {rond(by)} L {rond(bx)} '
                 f'{rond(by - l * 0.62)} L {rond(bx + l * 0.66)} {rond(by)} Z" '
                 f'fill="#b4543a" stroke="{TRAIT}" stroke-width="0.7" '
                 f'stroke-linejoin="round"/>')
    return "".join(g)


def ligue(x, y):
    """Le Mont Bataille : un édifice, pas un village. Il termine le
    parcours, il doit se voir comme une arrivée."""
    g = [f'<ellipse cx="{rond(x)}" cy="{rond(y + 5)}" rx="13" ry="4" '
         f'fill="#000000" opacity="0.15"/>']
    g.append(f'<path d="M {rond(x - 11)} {rond(y + 4)} L {rond(x - 8)} '
             f'{rond(y - 6)} L {rond(x + 8)} {rond(y - 6)} L {rond(x + 11)} '
             f'{rond(y + 4)} Z" fill="{CREME}" stroke="{TRAIT}" '
             f'stroke-width="0.9" stroke-linejoin="round"/>')
    g.append(f'<path d="M {rond(x - 10)} {rond(y - 6)} L {rond(x)} '
             f'{rond(y - 15)} L {rond(x + 10)} {rond(y - 6)} Z" '
             f'fill="#8b4725" stroke="{TRAIT}" stroke-width="0.9" '
             f'stroke-linejoin="round"/>')
    g.append(f'<path d="M {rond(x)} {rond(y - 15)} L {rond(x)} {rond(y - 24)} '
             f'L {rond(x + 9)} {rond(y - 21.5)} L {rond(x)} {rond(y - 19)}" '
             f'fill="#d8a13f" stroke="{TRAIT}" stroke-width="0.8" '
             f'stroke-linejoin="round"/>')
    return "".join(g)


def ancre(x, y):
    """L'ancre du port de la Relique Sacrée. Demandée nommément : c'est
    elle qui dit qu'on embarque ici pour l'Île Ténèbra."""
    t = 7.5
    g = [f'<circle cx="{rond(x)}" cy="{rond(y)}" r="{rond(t * 1.5)}" '
         f'fill="{CREME}" stroke="{TRAIT}" stroke-width="1.1"/>']
    g.append(f'<circle cx="{rond(x)}" cy="{rond(y - t * 0.74)}" r="1.8" '
             f'fill="none" stroke="{ENCRE}" stroke-width="1.4"/>')
    g.append(f'<path d="M {rond(x)} {rond(y - t * 0.46)} L {rond(x)} '
             f'{rond(y + t * 0.8)}" stroke="{ENCRE}" stroke-width="1.4" '
             f'stroke-linecap="round"/>')
    g.append(f'<path d="M {rond(x - t * 0.52)} {rond(y - t * 0.2)} L '
             f'{rond(x + t * 0.52)} {rond(y - t * 0.2)}" stroke="{ENCRE}" '
             f'stroke-width="1.3" stroke-linecap="round"/>')
    g.append(f'<path d="M {rond(x - t * 0.78)} {rond(y + t * 0.24)} q '
             f'{rond(t * 0.12)} {rond(t * 0.86)} {rond(t * 0.78)} '
             f'{rond(t * 0.86)} q {rond(t * 0.66)} 0 {rond(t * 0.78)} '
             f'{rond(-t * 0.86)}" fill="none" stroke="{ENCRE}" '
             f'stroke-width="1.4" stroke-linecap="round"/>')
    return "".join(g)


# ── les chemins sinueux ─────────────────────────────────────────────

def sinueux(a, b, graine):
    """Un chemin qui serpente entre deux points.

    « De façon non droite mais sinueuse. » On découpe le segment, on
    pousse chaque point intermédiaire perpendiculairement d'une
    quantité qui change de signe, et on relisse. L'amplitude suit la
    LONGUEUR : un chemin court qui serpente autant qu'un long a l'air
    d'une erreur, pas d'un chemin."""
    d = math.dist(a, b)
    n = max(2, int(d / 42))
    ux, uy = (b[0] - a[0]) / d, (b[1] - a[1]) / d
    px, py = -uy, ux
    pts = [a]
    for k in range(1, n):
        t = k / n
        ampl = min(26, d * 0.17) * (0.45 + 0.75 * hache(graine * 7 + k))
        signe = 1 if (k + int(graine)) % 2 else -1
        #  Le ventre au milieu, pincé aux extrémités : sinon le chemin
        #  sort de la ville de travers.
        pincement = math.sin(math.pi * t)
        pts.append((a[0] + ux * d * t + px * ampl * signe * pincement,
                    a[1] + uy * d * t + py * ampl * signe * pincement))
    pts.append(b)
    return catmull(pts)


def jusqu_a_la_mer(pts, terre):
    """Prolonge une course d'eau jusqu'à sortir des terres.

    On avance dans la direction des deux derniers points jusqu'à ce que
    le polygone du continent ne nous contienne plus, puis on va encore
    un peu — l'embouchure doit mordre sur la mer, sinon elle s'arrête
    pile sur le trait de côte et on dirait qu'elle est coupée."""
    ax, ay = pts[-2]
    bx, by = pts[-1]
    d = math.dist((ax, ay), (bx, by)) or 1
    ux, uy = (bx - ax) / d, (by - ay) / d
    x, y = bx, by
    for _ in range(400):
        x, y = x + ux * 4, y + uy * 4
        if not dedans((x, y), terre):
            break
    return pts + [(x + ux * 14, y + uy * 14)]


def fleuve(d):
    """Trois passes : la berge de sable, l'eau, le reflet. C'est la
    berge qui fait la rivière — sans elle, c'est un trait bleu."""
    return (
        f'<path d="{d}" stroke="{SABLE_COTE}" stroke-width="10" fill="none" '
        f'stroke-linecap="round"/>'
        f'<path d="{d}" stroke="{EAU[3]}" stroke-width="6.4" fill="none" '
        f'stroke-linecap="round"/>'
        f'<path d="{d}" stroke="#ffffff" stroke-opacity="0.3" '
        f'stroke-width="1.8" fill="none" stroke-linecap="round"/>'
    )


# ── l'écartement des étiquettes ─────────────────────────────────────

CARACTERE = 5.6
HAUT_ZONE, HAUT_VILLE = 26, 17


def boite_etiquette(nom, x, y, zone):
    l = max(46, len(nom) * CARACTERE) + 10
    h = HAUT_ZONE if zone else HAUT_VILLE
    return (x - l / 2, y - h / 2, l, h)


def croise(a, b):
    return (a[0] < b[0] + b[2] and b[0] < a[0] + a[2]
            and a[1] < b[1] + b[3] and b[1] < a[1] + a[3])


def ecarter(lieux):
    """La même relaxation que `carte-geographie.py`, avec des boîtes
    plus hautes : ici le nom est suivi du biome, donc deux lignes."""
    noms = [l["nom"] for l in lieux]
    zone = [l["type"] == "zone" for l in lieux]
    ancres = [(l["ancre"]["x"], l["ancre"]["y"] + (0 if z else 19))
              for l, z in zip(lieux, zone)]
    pos = [list(a) for a in ancres]
    for tour in range(3000):
        boites = [boite_etiquette(noms[i], pos[i][0], pos[i][1], zone[i])
                  for i in range(len(pos))]
        bouge = False
        for i in range(len(pos)):
            for j in range(i + 1, len(pos)):
                a, b = boites[i], boites[j]
                if not croise(a, b):
                    continue
                bouge = True
                dx = min(a[0] + a[2], b[0] + b[2]) - max(a[0], b[0])
                dy = min(a[1] + a[3], b[1] + b[3]) - max(a[1], b[1])
                cx = (a[0] + a[2] / 2) - (b[0] + b[2] / 2)
                cy = (a[1] + a[3] / 2) - (b[1] + b[3] / 2)
                if dx < dy:
                    p = (dx / 2 + 0.7) * (1 if cx >= 0 else -1)
                    pos[i][0] += p
                    pos[j][0] -= p
                else:
                    p = (dy / 2 + 0.7) * (1 if cy >= 0 else -1)
                    pos[i][1] += p
                    pos[j][1] -= p
        for i in range(len(pos)):
            ax, ay = ancres[i]
            pos[i][0] += (ax - pos[i][0]) * 0.05
            pos[i][1] += (ay - pos[i][1]) * 0.05
            pos[i][0] = min(1000 + MARGE_D - 50, max(-MARGE_G + 50, pos[i][0]))
            pos[i][1] = min(640 + MARGE_B - 54, max(-MARGE_H + 58, pos[i][1]))
        if not bouge and tour > 40:
            break
    boites = [boite_etiquette(noms[i], pos[i][0], pos[i][1], zone[i])
              for i in range(len(pos))]
    restes = [(noms[i], noms[j]) for i in range(len(pos))
              for j in range(i + 1, len(pos)) if croise(boites[i], boites[j])]
    return pos, restes


# ── l'affiche ───────────────────────────────────────────────────────

def main():
    carte = json.loads(pathlib.Path("data/carte.json").read_text())
    lieux = carte["lieux"]
    par_id = {l["forumId"]: l for l in lieux}
    out = []

    x0, y0 = -MARGE_G, -MARGE_H
    L = 1000 + MARGE_G + MARGE_D
    H = 640 + MARGE_H + MARGE_B

    out.append(
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{x0} {y0} {L} {H}" '
        f'width="{L * 2}" height="{H * 2}" font-family="DejaVu Sans, '
        f'Verdana, sans-serif">')

    #  ── 1 · la mer ────────────────────────────────────────────────
    #  Les mêmes bandes que le forum, calculées par `carte-mer.py`. Le
    #  fond couvre TOUT le cadre, marges comprises : au large du large,
    #  c'est encore la mer.
    #  LE FLOU EST CE QUI FAIT LE DÉGRADÉ. Neuf bandes emboîtées et un
    #  `feGaussianBlur` de 22 : les marches disparaissent, la
    #  profondeur reste, et elle suit la côte — ce qu'aucun dégradé
    #  linéaire ou radial ne sait faire sur un continent qui n'est ni
    #  une bande ni un disque.
    out.append('<defs><filter id="fondu" x="-12%" y="-12%" width="124%" '
               'height="124%"><feGaussianBlur stdDeviation="22"/>'
               '</filter></defs>')
    mer = carte.get("mer")
    out.append('<g filter="url(#fondu)">' if mer else '<g>')
    out.append(f'<rect x="{x0 - 60}" y="{y0 - 60}" width="{L + 120}" '
               f'height="{H + 120}" fill="{eau(0)}"/>')
    if mer:
        n = len(mer["bandes"])
        for i, d in enumerate(reversed(mer["bandes"])):
            out.append(f'<path d="{d}" fill="{eau((i + 1) / n)}"/>')
    out.append('</g>')
    if mer:
        for i, r in enumerate(mer["rides"]):
            for f in (1.0, 0.55):
                out.append(f'<circle cx="{r["x"]}" cy="{r["y"]}" '
                           f'r="{rond(r["r"] * f)}" fill="none" '
                           f'stroke="#ffffff" stroke-opacity="0.16" '
                           f'stroke-width="1.2"/>')

    #  ── 2 · la terre ──────────────────────────────────────────────
    #  Un liseré de sable AVANT le continent : c'est lui qui fait la
    #  plage, et c'est ce qui manque le plus quand on l'oublie.
    for d in [carte["terre"]] + carte.get("iles", []):
        out.append(f'<path d="{d}" fill="{SABLE_COTE}" stroke="{SABLE_COTE}" '
                   f'stroke-width="13" stroke-linejoin="round"/>')
        out.append(f'<path d="{d}" fill="{TERRE}" stroke="{TRAIT}" '
                   f'stroke-width="1.6" stroke-opacity="0.5"/>')

    #  ── 3 · les territoires, et leur relief ───────────────────────
    #
    #  UNE ZONE DE HAUTE MER EST ROGNÉE À L'EAU. L'Océan Mystérieux
    #  déborde sur le rivage : peint tel quel, il recouvrait la plage
    #  d'un aplat bleu et le trait de côte disparaissait dessous. Le
    #  masque est le cadre MOINS les terres — règle de remplissage
    #  `evenodd`, qui perce le rectangle de la forme du continent.
    hors = " ".join([carte["terre"]] + carte.get("iles", []))
    out.append(f'<defs><clipPath id="hors-terre" clip-rule="evenodd">'
               f'<path d="M {x0} {y0} h {L} v {H} h {-L} Z {hors}"/>'
               f'</clipPath></defs>')
    for l in lieux:
        if "forme" not in l:
            continue
        biome, fond, ombre, sorte = BIOMES[l["forumId"]]
        marine = l["forumId"] in MARINES
        out.append(f'<g clip-path="url(#hors-terre)">' if marine else '<g>')
        #  LE TRAIT EST FIN PARCE QUE LES FRONTIÈRES SONT PARTAGÉES :
        #  deux voisines tracent le même bord, donc chaque frontière
        #  est peinte deux fois. À 1,5 elles faisaient des bourrelets.
        out.append(f'<path d="{l["forme"]}" fill="{fond}" stroke="{TRAIT}" '
                   f'stroke-width="0.9" stroke-opacity="0.4" '
                   f'stroke-linejoin="round"/>')
        #  Le relief se sème dans le territoire entier : c'est lui
        #  qu'on voit, et un noyau texturé au milieu d'une zone unie
        #  dessinerait l'ancienne tache en creux.
        poly = points_du_chemin(l["forme"].split(" M ")[0])
        pas = 21 if sorte == "mesa" else (
            17 if sorte in ("pic", "pic-neige", "cratère") else 14)
        grains = semer(poly, pas, bord=7, graine=l["forumId"])
        out.append('<g opacity="0.92">')
        for k, (gx, gy) in enumerate(grains):
            h = hache(k * 3 + l["forumId"])
            out.append(glyphe(sorte, gx, gy + h * 2 - 1,
                              5.2 + 2.6 * h, k + l["forumId"], ombre))
        out.append('</g></g>')

    #  ── 3bis · la plaine ──────────────────────────────────────────
    #
    #  CE QUI RESTE DU CONTINENT N'EST PAS DU PAPIER. Sans ça, la moitié
    #  sud de Rhode est un aplat beige vide, et la carte a l'air d'un
    #  diagramme avec des taches dessus. Une herbe clairsemée et
    #  quelques bosquets suffisent : il ne s'agit pas de remplir, il
    #  s'agit que le sol existe.
    #
    #  On sème sur la terre et on rejette tout ce qui tombe dans une
    #  zone — c'est le seul endroit du script où la plaine a besoin de
    #  connaître les territoires, et c'est pour leur laisser la place.
    terre_poly = points_du_chemin(carte["terre"])
    zones_poly = [points_du_chemin(l["forme"]) for l in lieux if "forme" in l]
    #  Il ne reste que le LITTORAL à habiller : depuis que les
    #  territoires se touchent, la terre n'a plus de vide au milieu.
    #  Quelques touffes sur la plage, et c'est tout — c'est une plage,
    #  pas un pré.
    out.append('<g opacity="0.42">')
    for k, (gx, gy) in enumerate(semer(terre_poly, 26, bord=6, graine=7)):
        if any(dedans((gx, gy), z) for z in zones_poly):
            continue
        h = hache(k * 11 + 5)
        out.append(glyphe("touffe", gx, gy, 4.2 + 1.8 * h, k, "#c6b696"))
    out.append('</g>')

    #  ── 3ter · l'eau douce ────────────────────────────────────────
    #  Après les territoires, parce qu'un fleuve TRAVERSE une zone — il
    #  ne se range pas dedans. Avant les chemins, parce qu'un chemin
    #  passe sur un pont, donc par-dessus.
    for pts in FLEUVES:
        out.append(fleuve(catmull(jusqu_a_la_mer(pts, terre_poly))))
    for cx, cy, r in LACS:
        out.append(f'<ellipse cx="{cx}" cy="{cy}" rx="{rond(r * 1.25)}" '
                   f'ry="{r}" fill="{SABLE_COTE}"/>')
        out.append(f'<ellipse cx="{cx}" cy="{cy}" rx="{rond(r * 1.05)}" '
                   f'ry="{rond(r * 0.82)}" fill="{EAU[3]}"/>')
        out.append(f'<path d="M {rond(cx - r * 0.5)} {rond(cy - r * 0.3)} q '
                   f'{rond(r * 0.3)} {rond(-r * 0.2)} {rond(r * 0.6)} 0" '
                   f'stroke="#ffffff" stroke-opacity="0.35" stroke-width="1.4" '
                   f'fill="none"/>')

    #  ── 4 · les chemins ───────────────────────────────────────────
    #  Deux traits superposés : un large couleur sable qui fait la
    #  bordure, un fin couleur terre par-dessus. C'est ce qui donne
    #  l'aspect « route » plutôt que « trait ».
    out.append('<g fill="none" stroke-linecap="round">')
    for i, (a, b) in enumerate(CHEMINS):
        pa = (par_id[a]["ancre"]["x"], par_id[a]["ancre"]["y"])
        pb = (par_id[b]["ancre"]["x"], par_id[b]["ancre"]["y"])
        d = sinueux(pa, pb, i + 1)
        out.append(f'<path d="{d}" stroke="{CREME}" stroke-width="6.4" '
                   f'stroke-opacity="0.92"/>')
        out.append(f'<path d="{d}" stroke="#c89a62" stroke-width="3.4"/>')
    out.append('</g>')

    #  Les routes de mer : en pointillé, parce qu'on ne marche pas
    #  dessus.
    out.append('<g fill="none" stroke-linecap="round">')
    for i, (a, b) in enumerate(ROUTES_DE_MER):
        pa = (par_id[a]["ancre"]["x"], par_id[a]["ancre"]["y"])
        pb = (par_id[b]["ancre"]["x"], par_id[b]["ancre"]["y"])
        d = sinueux(pa, pb, 40 + i)
        out.append(f'<path d="{d}" stroke="{CREME}" stroke-width="2.6" '
                   f'stroke-opacity="0.75" stroke-dasharray="7 7"/>')
    out.append('</g>')

    #  ── 5 · les villes, la Ligue, l'ancre ─────────────────────────
    for l in lieux:
        if "forme" in l:
            continue
        x, y = l["ancre"]["x"], l["ancre"]["y"]
        out.append(ligue(x, y) if l["type"] == "ligue" else ville(x, y))
    p = par_id[PORT]["ancre"]
    out.append(ancre(p["x"] + 26, p["y"] - 20))

    #  ── 6 · les étiquettes, tout en haut ──────────────────────────
    pos, restes = ecarter(lieux)
    out.append('<g text-anchor="middle" paint-order="stroke" '
               f'stroke="{CREME}" stroke-width="3.4" '
               'stroke-linejoin="round">')
    for l, (ex, ey) in zip(lieux, pos):
        zone = l["type"] == "zone"
        #  Une amarre quand le nom a dû s'éloigner : sans elle, on ne
        #  sait plus quelle étiquette va avec quelle tache.
        ax, ay = l["ancre"]["x"], l["ancre"]["y"]
        if math.dist((ex, ey), (ax, ay)) > (34 if zone else 30):
            out.append(f'<path d="M {rond(ax)} {rond(ay)} L {rond(ex)} '
                       f'{rond(ey - 4)}" stroke="{CREME}" stroke-width="2.6" '
                       f'fill="none" stroke-opacity="0.85"/>')
            out.append(f'<path d="M {rond(ax)} {rond(ay)} L {rond(ex)} '
                       f'{rond(ey - 4)}" stroke="{TRAIT}" stroke-width="0.9" '
                       f'fill="none" stroke-opacity="0.5" '
                       f'stroke-dasharray="3 3"/>')
        out.append(f'<text x="{rond(ex)}" y="{rond(ey)}" fill="{ENCRE}" '
                   f'font-size="11.5" font-weight="bold">'
                   f'{echappe(l["nom"])}</text>')
        sous = BIOMES[l["forumId"]][0] if zone else (
            "Ligue de Rhode" if l["type"] == "ligue" else "Ville")
        out.append(f'<text x="{rond(ex)}" y="{rond(ey + 10)}" fill="#6a5544" '
                   f'font-size="8" font-style="italic">{echappe(sous)}</text>')
    out.append('</g>')

    #  ── 7 · le titre et la légende ────────────────────────────────
    out.append(cartouche_titre(x0, y0, L))
    out.append(legende(x0, y0, H))
    out.append(rose(1000 + MARGE_D - 56, y0 + 58))

    out.append('</svg>')
    SORTIE.parent.mkdir(exist_ok=True)
    SORTIE.write_text("\n".join(out) + "\n")

    print(f"affiche : {len(lieux)} lieux, {len(CHEMINS)} chemins, "
          f"{len(restes)} chevauchement(s) d'étiquette")
    for a, b in restes:
        print("   ·", a, "×", b)
    return 1 if restes else 0


def cartouche_titre(x0, y0, L):
    cx = x0 + L / 2
    g = [f'<g text-anchor="middle">']
    g.append(f'<text x="{rond(cx)}" y="{rond(y0 + 46)}" fill="{CREME}" '
             f'font-size="40" font-weight="bold" letter-spacing="10">RHODE</text>')
    g.append(f'<text x="{rond(cx)}" y="{rond(y0 + 68)}" fill="{CREME}" '
             f'fill-opacity="0.78" font-size="11.5" letter-spacing="4.4">'
             f'CARTE DES TERRITOIRES</text>')
    g.append(f'<path d="M {rond(cx - 150)} {rond(y0 + 80)} L {rond(cx + 150)} '
             f'{rond(y0 + 80)}" stroke="{CREME}" stroke-opacity="0.4" '
             f'stroke-width="1"/>')
    g.append('</g>')
    return "".join(g)


def legende(x0, y0, H):
    """Quatre familles et l'ancre. Sans elle, le lecteur doit déduire
    le code couleur des étiquettes — ce qui marche, mais lentement."""
    bx, by = x0 + 18, y0 + H - 100
    g = [f'<g>']
    g.append(f'<rect x="{rond(bx)}" y="{rond(by)}" width="236" height="82" '
             f'rx="7" fill="{CREME}" fill-opacity="0.9" stroke="{TRAIT}" '
             f'stroke-opacity="0.35"/>')
    g.append(f'<text x="{rond(bx + 13)}" y="{rond(by + 20)}" fill="{ENCRE}" '
             f'font-size="9.5" font-weight="bold" letter-spacing="1.6">'
             f'COMMENT LIRE LA CARTE</text>')
    lignes = [
        ("ville", "Ville — point de départ et de repos"),
        ("zone", "Zone sauvage — son biome est écrit dessous"),
        ("chemin", "Chemin praticable à pied"),
        ("ancre", "Port : embarquement vers l'Île Ténèbra"),
    ]
    for i, (sorte, texte) in enumerate(lignes):
        y = by + 36 + i * 14
        if sorte == "ville":
            g.append(f'<path d="M {rond(bx + 11)} {rond(y)} L {rond(bx + 16)} '
                     f'{rond(y - 5)} L {rond(bx + 21)} {rond(y)} Z" '
                     f'fill="#b4543a" stroke="{TRAIT}" stroke-width="0.6"/>')
        elif sorte == "zone":
            g.append(f'<rect x="{rond(bx + 11)}" y="{rond(y - 6)}" width="10" '
                     f'height="8" rx="2" fill="#9aa961" stroke="{TRAIT}" '
                     f'stroke-width="0.6"/>')
        elif sorte == "chemin":
            g.append(f'<path d="M {rond(bx + 10)} {rond(y - 2)} q 5 -5 11 0" '
                     f'stroke="#c89a62" stroke-width="2.6" fill="none"/>')
        else:
            g.append(f'<g transform="translate({rond(bx + 16)} {rond(y - 3)}) '
                     f'scale(0.42)">{ancre(0, 0)}</g>')
        g.append(f'<text x="{rond(bx + 29)}" y="{rond(y)}" fill="#55422f" '
                 f'font-size="8.6">{echappe(texte)}</text>')
    g.append('</g>')
    return "".join(g)


def rose(x, y):
    """Une rose des vents. Décorative, et c'est assez : une carte sans
    nord se lit quand même, mais elle n'a pas l'air d'une carte."""
    g = [f'<g transform="translate({rond(x)} {rond(y)})" opacity="0.8">']
    g.append(f'<circle r="22" fill="{CREME}" fill-opacity="0.16" '
             f'stroke="{CREME}" stroke-opacity="0.45" stroke-width="1"/>')
    for a, l in ((0, 19), (90, 13), (180, 19), (270, 13)):
        r = math.radians(a - 90)
        g.append(f'<path d="M 0 0 L {rond(math.cos(r) * l)} '
                 f'{rond(math.sin(r) * l)}" stroke="{CREME}" '
                 f'stroke-width="2" stroke-linecap="round"/>')
    g.append(f'<text y="-25" text-anchor="middle" fill="{CREME}" '
             f'font-size="10" font-weight="bold">N</text>')
    g.append('</g>')
    return "".join(g)


if __name__ == "__main__":
    raise SystemExit(main())
