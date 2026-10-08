"""Lire un chemin SVG, et savoir ce qui est dedans.

Partagé par `carte-mer.py` et `carte-affiche.py`, qui ont tous les deux
besoin de transformer les contours de `data/carte.json` en polygones :
le premier pour mesurer la distance à la côte, le second pour semer du
relief à l'intérieur d'une zone.

LE NOM A UN TIRET BAS, pas un tiret : c'est le seul fichier de `outils/`
qu'on importe au lieu de l'exécuter, et un tiret interdirait l'import.
"""

import math


def points_du_chemin(d, pas=22):
    """Aplatit un chemin SVG fermé en liste de points.

    On ne gère que `M`, `L`, `C` et `Z` : c'est ce que produit
    `carte-geographie.py`, et c'est ce que produit un export Figma d'un
    tracé fermé. Une commande inconnue lève — mieux vaut un script qui
    s'arrête qu'une côte fausse qu'on ne remarquera que sur l'écran."""
    jetons = d.replace(",", " ").split()
    pts, i, courant = [], 0, (0.0, 0.0)
    while i < len(jetons):
        c = jetons[i]
        if c in ("M", "L"):
            courant = (float(jetons[i + 1]), float(jetons[i + 2]))
            pts.append(courant)
            i += 3
        elif c == "C":
            p0 = courant
            p1 = (float(jetons[i + 1]), float(jetons[i + 2]))
            p2 = (float(jetons[i + 3]), float(jetons[i + 4]))
            p3 = (float(jetons[i + 5]), float(jetons[i + 6]))
            for k in range(1, pas + 1):
                t = k / pas
                u = 1 - t
                pts.append((
                    u**3 * p0[0] + 3 * u * u * t * p1[0]
                    + 3 * u * t * t * p2[0] + t**3 * p3[0],
                    u**3 * p0[1] + 3 * u * u * t * p1[1]
                    + 3 * u * t * t * p2[1] + t**3 * p3[1],
                ))
            courant = p3
            i += 7
        elif c in ("Z", "z"):
            i += 1
        else:
            raise ValueError(f"commande SVG non gérée : {c!r}")
    return pts


def dedans(point, polygone):
    """Point dans polygone, par lancer de rayon.

    La version qui compte les croisements d'une demi-droite horizontale.
    Elle se trompe sur un point EXACTEMENT sur un sommet — on ne lui en
    donne jamais, puisqu'on sème sur une grille décalée."""
    x, y = point
    n = len(polygone)
    dedans_ = False
    j = n - 1
    for i in range(n):
        xi, yi = polygone[i]
        xj, yj = polygone[j]
        if (yi > y) != (yj > y):
            coupe = xi + (y - yi) * (xj - xi) / (yj - yi)
            if x < coupe:
                dedans_ = not dedans_
        j = i
    return dedans_


def boite(polygone):
    xs = [p[0] for p in polygone]
    ys = [p[1] for p in polygone]
    return min(xs), min(ys), max(xs), max(ys)


def semer(polygone, pas, marge=0, decalage=0.5, bord=0, desordre=0.42,
          graine=1):
    """Sème des points à l'intérieur d'un polygone.

    Une grille en quinconce plutôt qu'un tirage : elle couvre sans faire
    de paquets, et elle est reproductible sans graine. `bord` écarte du
    contour — un arbre à cheval sur la frontière d'une zone appartient
    visuellement aux deux, et on ne sait plus où l'une finit.

    LE DÉSORDRE N'EST PAS UN DÉTAIL. Une grille nue donne une forêt en
    rangées d'oignons et une montagne en papier peint : l'œil voit le
    treillis avant de voir les arbres, et la carte a l'air fabriquée.
    On décale donc chaque point d'une fraction du pas, par une fonction
    de hachage — donc reproductible, contrairement à un tirage."""
    x0, y0, x1, y1 = boite(polygone)
    pts = []
    ligne = 0
    n = 0
    y = y0 + marge
    while y <= y1 - marge:
        x = x0 + marge + (pas * decalage if ligne % 2 else 0)
        while x <= x1 - marge:
            n += 1
            dx = (_hache(n * 3 + graine) - 0.5) * 2 * pas * desordre
            dy = (_hache(n * 7 + graine * 5) - 0.5) * 2 * pas * desordre
            q = (x + dx, y + dy)
            if dedans(q, polygone) and (
                bord == 0 or distance_au_bord(q, polygone) >= bord
            ):
                pts.append(q)
            x += pas
        y += pas * 0.86
        ligne += 1
    return pts


def _hache(i):
    return (math.sin(i * 12.9898 + 78.233) + 1) / 2


def distance_au_bord(point, polygone):
    """La plus courte distance d'un point à l'un des segments du
    contour. Sert à écarter le relief du bord des zones."""
    x, y = point
    mini = float("inf")
    n = len(polygone)
    for i in range(n):
        ax, ay = polygone[i]
        bx, by = polygone[(i + 1) % n]
        dx, dy = bx - ax, by - ay
        carre = dx * dx + dy * dy
        t = 0.0 if carre == 0 else max(
            0.0, min(1.0, ((x - ax) * dx + (y - ay) * dy) / carre))
        mini = min(mini, math.dist((x, y), (ax + t * dx, ay + t * dy)))
    return mini
