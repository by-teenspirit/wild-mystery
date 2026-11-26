#!/usr/bin/env python3
# ════════════════════════════════════════════════════════════════════
#  outils/arbre.py — écrire la page de l'arbre des paliers
#
#  USAGE :  python3 outils/arbre.py
#
#  ── POURQUOI LA PREMIÈRE VERSION N'ÉTAIT PAS UN ARBRE ──────────────
#
#  « Je trouve que ça ne ressemble pas à un arbre de compétences. On
#  n'est pas sur des succès, on est vraiment sur des choses à faire
#  pour atteindre le palier 2 puis le palier 3. » — 26 novembre, avec
#  huit captures de jeux à l'appui.
#
#  Elle rangeait soixante-seize médailles en cartes alignées. Deux
#  choses manquaient, et les captures les montrent toutes les deux :
#
#   · UN ARBRE A DES ARÊTES DESSINÉES. Des cartes côte à côte, même
#     reliées par un filet de deux pixels, se lisent comme un tableau.
#     Ce qui fait l'arbre est le TRAIT entre deux nœuds ;
#   · UN ARBRE PART D'UN POINT. Les huit captures ont un moyeu — le
#     personnage — d'où les branches rayonnent.
#
#  D'où le SVG : un moyeu au centre, six branches à soixante degrés,
#  les étapes en perles le long de chaque rayon, et les deux portes de
#  palier en plus gros sur le chemin.
#
#  ── LE SVG EST DANS LA PAGE, PAS CALCULÉ PAR UN SCRIPT ─────────────
#
#  Les positions sont trigonométriques et tiennent en vingt lignes de
#  Python. Les faire calculer par du JavaScript au chargement donnerait
#  une page blanche sans script, pour la même géométrie.
#
#  ── ET LA LISTE SOUS LE DESSIN N'EST PAS UN DOUBLON ────────────────
#
#  Un rayon de six perles ne porte pas six phrases : il porte six
#  numéros. Le texte des étapes vit dans la liste dessous, numérotée
#  pareil. C'est aussi la seule version lisible à 390 px et au lecteur
#  d'écran — le SVG y est marqué décoratif.
# ════════════════════════════════════════════════════════════════════

import html
import json
import math
import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from annexes import BARRE, FEUILLES, METAS, PAGES, PIED  # noqa: E402

R = pathlib.Path(__file__).resolve().parent.parent
SORTIE = R / "pages/arbre-des-paliers.html"

#  ── LA GÉOMÉTRIE ───────────────────────────────────────────────────
#
#  Six branches à soixante degrés, la première vers le haut. Le rayon
#  de la première étape laisse la place au moyeu ; le pas entre deux
#  étapes laisse la place aux deux perles et à leur trait.
#  LE CADRE TIENT LE RAYON LE PLUS LONG, ÉTIQUETTE COMPRISE. Réglé à
#  1000 au premier jet, il coupait la porte du palier 3 et les six noms
#  de maison : 150 + 6 × 72 font 582, plus l'étiquette 634, contre 500
#  de demi-cadre. Vu au rendu, deux fois — la seconde parce qu'un nom
#  de maison déborde aussi de sa DEMI-LARGEUR de texte, que le rayon
#  ne dit pas.
CADRE = 1500
CENTRE = CADRE / 2
RAYON_MOYEU = 74
RAYON_1 = 140
PAS = 66
PERLE = 21
PORTE = 29


#  ── DEUX ÉTAGES, SEPT RAYONS CHACUN ───────────────────────────────
#
#  « On voulait entre 8 et 10 objectifs par paliers. » — 26 novembre.
#  Neuf par palier, en trois couches : six communs, deux de maison, une
#  mission. C'est la structure qui dicte le dessin, et pas l'inverse.
#
#  Un étage est une LENTILLE : tous les rayons partent du même point et
#  se rejoignent au même point, la porte du palier. Le rayon du milieu
#  porte les six communs ; les six autres portent les trois objectifs
#  d'une maison. On voit d'un regard ce que tout le monde fait et ce
#  qui n'appartient qu'à soi — c'est exactement ce que la structure
#  dit, et aucune liste ne le montre aussi vite.
#
#  Deux étages empilés : le palier 2 en bas, le 3 au-dessus, et la
#  porte du 2 sert de base au 3.

CADRE_L, CADRE_H = 1240, 1180
CX = CADRE_L / 2
Y_PIED = 1090
Y_PORTE_2 = 660
Y_PORTE_3 = 230
RAYON_MOYEU = 60
PERLE = 20
PORTE = 30
#  L'ÉCARTEMENT DES SIX RAYONS DE MAISON, de part et d'autre du rayon
#  commun. Trois à gauche, trois à droite : un éventail d'un seul côté
#  laisserait la moitié du cadre vide.
#  LES ÉCARTS SONT CEUX DU POINT DE CONTRÔLE, PAS DU VENTRE DE LA
#  COURBE. Une Bézier quadratique ne passe qu'à la MOITIÉ de son point
#  de contrôle : réglés à 430 au premier jet, les rayons s'écartaient
#  de 215 et le dessin occupait la moitié de son cadre. Mesuré au
#  rendu — la bonne boîte faisait 571 de large dans un cadre de 1240.
ECARTS = (-860, -570, -290, 290, 570, 860)


def courbe(t, x0, y0, cxc, cyc, x1, y1):
    """Un point d'une Bézier quadratique. Les rayons sont courbes et
    pas droits : sept droites partant du même point feraient une
    étoile, où l'on ne suit aucun chemin des yeux."""
    u = 1 - t
    return (u * u * x0 + 2 * u * t * cxc + t * t * x1,
            u * u * y0 + 2 * u * t * cyc + t * t * y1)


def rayon(ecart, y0, y1, combien, bord0, bord1):
    """Le tracé d'un rayon et la position de ses perles.

    LE RAYON PART DU BORD DU MOYEU, PAS DE SON CENTRE. Tracé depuis le
    centre, il passait sous le disque — ce qui ne se voit pas — mais sa
    PREMIÈRE PERLE tombait dessus à moitié, et celle-là se voyait.
    `bord0` et `bord1` sont les rayons des deux disques qu'il relie.
    """
    ya, yb = y0 - bord0, y1 + bord1
    cxc, cyc = CX + ecart, (ya + yb) / 2
    d = f"M {CX:.1f} {ya:.1f} Q {cxc:.1f} {cyc:.1f} {CX:.1f} {yb:.1f}"
    perles = [courbe((k + 1) / (combien + 1), CX, ya, cxc, cyc, CX, yb)
              for k in range(combien)]
    return d, perles, courbe(0.5, CX, ya, cxc, cyc, CX, yb)


def e(t):
    return html.escape(str(t or ""), quote=True)


def perle(x, y, texte, genre, clef, grosse=False):
    return (
        f'      <g class="wm-paliers__perle" data-wm-genre="{e(genre)}"'
        f' data-wm-etape="{e(clef)}">\n'
        f'        <circle cx="{x:.1f}" cy="{y:.1f}" r="{PORTE if grosse else PERLE}" />\n'
        f'        <text x="{x:.1f}" y="{y:.1f}">{e(texte)}</text>\n'
        "      </g>\n"
    )


def etage(d, palier, y0, y1, bord0):
    """Un étage : le rayon des communs, les six rayons de maison, et la
    porte au sommet."""
    traits, perles, noms = [], [], []
    communs = d["communs"][palier]
    trace, points, _ = rayon(0, y0, y1, len(communs), bord0, PORTE)
    traits.append(
        f'      <path class="wm-paliers__trait wm-paliers__trait--commun"'
        f' d="{trace}" />\n'
    )
    for (x, y), o in zip(points, communs):
        perles.append(perle(x, y, "", "commun", o["clef"]))

    for b, ecart in zip(d["branches"], ECARTS):
        siens = b["paliers"][palier]
        trace, points, (mx, my) = rayon(ecart, y0, y1, len(siens), bord0, PORTE)
        traits.append(
            f'      <path class="wm-paliers__trait" data-wm-maison="{e(b["clef"])}"'
            f' d="{trace}" />\n'
        )
        for (x, y), o in zip(points, siens):
            perles.append(perle(x, y, "", o["genre"], o["clef"]))
        #  LE NOM DE LA MAISON EST AU VENTRE DE SON RAYON, décalé vers
        #  l'extérieur : posé dessus, il recouvrirait une perle.
        noms.append(
            f'      <text class="wm-paliers__maison" data-wm-maison="{e(b["clef"])}"'
            f' x="{mx + (58 if ecart > 0 else -58):.1f}" y="{my:.1f}"'
            f' text-anchor="{"start" if ecart > 0 else "end"}">{e(b["nom"])}</text>\n'
        )

    porte = perle(CX, y1, palier, "palier", f"porte-{palier}", grosse=True)
    return "".join(traits), "".join(perles) + porte, "".join(noms)


def dessin(d):
    bas = etage(d, "2", Y_PIED, Y_PORTE_2, RAYON_MOYEU)
    haut = etage(d, "3", Y_PORTE_2, Y_PORTE_3, PORTE)
    #  LE MOYEU PASSE APRÈS LES ARÊTES. Dessiné avant, les sept rayons
    #  qui partent du pied le barraient d'une étoile.
    moyeu = (
        f'      <circle class="wm-paliers__moyeu" cx="{CX}" cy="{Y_PIED}"'
        f' r="{RAYON_MOYEU}" />\n'
        f'      <text class="wm-paliers__moyeu-texte" x="{CX}" y="{Y_PIED - 16}">'
        "Palier</text>\n"
        f'      <text class="wm-paliers__moyeu-chiffre" x="{CX}" y="{Y_PIED + 16}">'
        "1</text>\n"
    )
    return bas[0] + haut[0] + moyeu + bas[1] + haut[1] + bas[2] + haut[2]


ETIQUETTES = {
    "commun": "commun",
    "maison": "quête",
    "mission": "mission",
    "a-ecrire": "à écrire",
}


def ligne(o):
    titre = o["titre"] if o["titre"] else "à écrire"
    combien = (
        f' <span class="wm-paliers__seuil">{e(o["mesure"])}</span>'
        if o.get("mesure") else ""
    )
    return (
        f'            <li class="wm-paliers__etape" data-wm-genre="{e(o["genre"])}">\n'
        f'              <span class="wm-paliers__rang">{e(ETIQUETTES[o["genre"]])}</span>\n'
        f'              <span class="wm-paliers__quoi">{e(titre)}{combien}</span>\n'
        "            </li>\n"
    )


def liste(d, b):
    blocs = []
    for palier in ("2", "3"):
        objectifs = list(d["communs"][palier]) + list(b["paliers"][palier])
        blocs.append(
            f'        <h3 class="wm-paliers__porte">Vers le palier {palier}</h3>\n'
            f'        <ol class="wm-paliers__etapes">\n'
            + "".join(ligne(o) for o in objectifs)
            + "        </ol>\n"
        )
    return (
        f'      <section class="wm-paliers__branche" data-wm-maison="{e(b["clef"])}">\n'
        f'        <h2 class="wm-paliers__titre">{e(b["nom"])} '
        f'<span class="wm-paliers__embleme">{e(b["embleme"])}</span></h2>\n'
        + "".join(blocs) + "      </section>\n"
    )


GABARIT = """<!-- ═══════════════════════════════════════════════════════════════════
     Arbre des paliers — à coller dans une page HTML.

     ÉCRITE PAR `outils/arbre.py` depuis `data/arbre.json`. Ne pas
     corriger ce fichier à la main : la correction serait perdue à la
     prochaine génération.

     Modules > HTML & JAVASCRIPT > Gestion des pages HTML > Créer, en
     MODE AVANCÉ, et « Utiliser le header et le footer du forum » = NON.
     ═══════════════════════════════════════════════════════════════════ -->

<!DOCTYPE html>
<html lang="fr">
<head>
{tete}
</head>
<body>
<div id="modernbb">
{barre}

<div class="wm-annexe">
  <div class="wm-annexe__corps">
    <div class="wm-annexe__colonne wm-annexe__colonne--large">

      <p class="wm-annexe__surtitre">La progression</p>
      <h1 class="wm-annexe__titre">Les paliers</h1>
      <p class="wm-annexe__chapo">{chapo}</p>

      <div class="wm-paliers" data-wm-paliers>
        <svg class="wm-paliers__dessin" viewBox="0 0 {cadreL} {cadreH}"
             role="presentation" aria-hidden="true" focusable="false">
{dessin}        </svg>

{listes}      </div>

    </div>
  </div>
</div>

{pied}
</div>
<script src="{pages}/js/annexes.js"></script>
</body>
</html>
"""

CHAPO = (
    "{n} objectifs ouvrent le palier 2 et ses zones, {n} de plus ouvrent le "
    "palier 3. À chaque étage, quatre sont les mêmes pour tout le monde, quatre "
    "sont les quêtes de ta maison, et deux sont des missions à jouer. Ce ne sont "
    "pas des récompenses à collectionner — c'est ce qu'il y a à faire."
)


def ecrire(source=None, sortie=None):
    source = source or (R / "data/arbre.json")
    sortie = sortie or SORTIE
    d = json.loads(pathlib.Path(source).read_text(encoding="utf-8"))

    page = GABARIT.format(
        tete=(METAS + "\n  <title>Les paliers — Wild Mystery</title>\n"
              + FEUILLES).format(pages=PAGES),
        barre=BARRE,
        pied=PIED,
        pages=PAGES,
        cadreL=CADRE_L,
        cadreH=CADRE_H,
        chapo=e(CHAPO.format(n=d["parPalier"])),
        dessin=dessin(d),
        listes="".join(liste(d, b) for b in d["branches"]),
    )

    #  MÊME GARDE QUE LES ANNEXES : l'éditeur de pages HTML de
    #  Forumactif décode les entités en enregistrant, et un
    #  `&lt;table&gt;` écrit dans un texte revient en vraie balise.
    if "&lt;" in page or "&gt;" in page:
        raise SystemExit(
            "le texte contient une entité `&lt;` ou `&gt;`. Forumactif la "
            "décode en vraie balise en enregistrant."
        )

    pathlib.Path(sortie).write_text(page, encoding="utf-8")
    objectifs = sum(len(v) for v in d["communs"].values()) + sum(
        len(x) for b in d["branches"] for x in b["paliers"].values()
    )
    a_ecrire = sum(
        1 for b in d["branches"] for x in b["paliers"].values() for o in x
        if o["genre"] == "a-ecrire"
    )
    print(f"  {pathlib.Path(sortie).name} — {objectifs} objectif(s), {len(page)} caractères")
    if a_ecrire:
        print(f"  ⚠ {a_ecrire} mission(s) restent à écrire")


if __name__ == "__main__":
    ecrire()
