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


def position(branche, rang):
    angle = math.radians(-90 + branche * 60)
    r = RAYON_1 + rang * PAS
    return CENTRE + r * math.cos(angle), CENTRE + r * math.sin(angle)


def e(t):
    return html.escape(str(t or ""), quote=True)


def dessin(d):
    """Le graphe. Les traits d'abord, les perles ensuite : en SVG,
    l'ordre du document EST l'ordre d'empilement, et un trait tracé
    après passerait par-dessus les perles qu'il relie."""
    traits, perles = [], []
    for i, b in enumerate(d["branches"]):
        c = b["clef"]
        x0, y0 = CENTRE, CENTRE
        #  LES PORTES NE PRENNENT PAS DE NUMÉRO D'ÉTAPE. Comptées dans
        #  la suite, elles faisaient sauter un cran après chacune : la
        #  quatrième étape s'annonçait cinquième, et la liste dessous
        #  disait autre chose que le dessin.
        numero = 0
        for rang, etape in enumerate(b["etapes"]):
            x, y = position(i, rang)
            traits.append(
                f'      <line class="wm-paliers__trait" data-wm-maison="{e(c)}"'
                f' x1="{x0:.1f}" y1="{y0:.1f}" x2="{x:.1f}" y2="{y:.1f}" />\n'
            )
            x0, y0 = x, y
            porte = etape["genre"] == "palier"
            if not porte:
                numero += 1
            perles.append(
                f'      <g class="wm-paliers__perle" data-wm-maison="{e(c)}"'
                f' data-wm-genre="{e(etape["genre"])}" data-wm-etape="{e(etape["clef"])}">\n'
                f'        <circle cx="{x:.1f}" cy="{y:.1f}"'
                f' r="{PORTE if porte else PERLE}" />\n'
                f'        <text x="{x:.1f}" y="{y:.1f}">'
                f'{e(etape["palier"] if porte else numero)}</text>\n'
                "      </g>\n"
            )
    #  LE NOM DE LA MAISON EST AU BOUT DE SON RAYON, posé juste au-delà
    #  de la dernière perle — un nom au milieu des perles les
    #  traverserait.
    noms = []
    for i, b in enumerate(d["branches"]):
        x, y = position(i, len(b["etapes"]) - 1 + 1.15)
        noms.append(
            f'      <text class="wm-paliers__maison" data-wm-maison="{e(b["clef"])}"'
            f' x="{x:.1f}" y="{y:.1f}">{e(b["nom"])}</text>\n'
        )
    #  LE MOYEU PASSE APRÈS LES ARÊTES. Dessiné avant, les six rayons
    #  qui partent du centre exact lui passaient DESSUS et le barraient
    #  d'une étoile. L'ordre du document est l'ordre d'empilement.
    moyeu = (
        f'      <circle class="wm-paliers__moyeu" cx="{CENTRE}" cy="{CENTRE}"'
        f' r="{RAYON_MOYEU}" />\n'
        f'      <text class="wm-paliers__moyeu-texte" x="{CENTRE}" y="{CENTRE - 20}">'
        "Palier</text>\n"
        f'      <text class="wm-paliers__moyeu-chiffre" x="{CENTRE}" y="{CENTRE + 20}">'
        "1</text>\n"
    )
    return "".join(traits) + moyeu + "".join(perles) + "".join(noms)


def liste(b):
    lignes, numero = [], 0
    for etape in b["etapes"]:
        if etape["genre"] != "palier":
            numero += 1
        if etape["genre"] == "palier":
            lignes.append(
                f'          <li class="wm-paliers__etape" data-wm-genre="palier">\n'
                f'            <span class="wm-paliers__rang">{e(etape["palier"])}</span>\n'
                f'            <span class="wm-paliers__quoi"><strong>{e(etape["titre"])}'
                f"</strong> — {e(etape['texte'])}</span>\n          </li>\n"
            )
        elif etape["genre"] == "a-ecrire":
            lignes.append(
                f'          <li class="wm-paliers__etape" data-wm-genre="a-ecrire">\n'
                f'            <span class="wm-paliers__rang">{numero}</span>\n'
                '            <span class="wm-paliers__quoi">à écrire</span>\n'
                "          </li>\n"
            )
        else:
            lignes.append(
                f'          <li class="wm-paliers__etape" data-wm-genre="{e(etape["genre"])}">\n'
                f'            <span class="wm-paliers__rang">{numero}</span>\n'
                f'            <span class="wm-paliers__quoi">{e(etape["titre"])}</span>\n'
                "          </li>\n"
            )
    return (
        f'      <section class="wm-paliers__branche" data-wm-maison="{e(b["clef"])}">\n'
        f'        <h2 class="wm-paliers__titre">{e(b["nom"])} '
        f'<span class="wm-paliers__embleme">{e(b["embleme"])}</span></h2>\n'
        f'        <ol class="wm-paliers__etapes">\n' + "".join(lignes)
        + "        </ol>\n      </section>\n"
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
        <svg class="wm-paliers__dessin" viewBox="0 0 {cadre} {cadre}"
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
    "Chaque maison a sa branche, et sa branche est un chemin : on fait les étapes "
    "dans l'ordre. {a2} étapes ouvrent le palier 2 et ses zones, {a3} de plus "
    "ouvrent le palier 3. Ce ne sont pas des récompenses à collectionner — "
    "c'est ce qu'il y a à faire."
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
        cadre=CADRE,
        chapo=e(CHAPO.format(a2=d["avantLaPorte"]["2"], a3=d["avantLaPorte"]["3"])),
        dessin=dessin(d),
        listes="".join(liste(b) for b in d["branches"]),
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
    etapes = sum(len(b["etapes"]) for b in d["branches"])
    a_ecrire = sum(
        1 for b in d["branches"] for x in b["etapes"] if x["genre"] == "a-ecrire"
    )
    print(f"  {pathlib.Path(sortie).name} — {etapes} étape(s), {len(page)} caractères")
    if a_ecrire:
        print(f"  ⚠ {a_ecrire} étape(s) restent à écrire")


if __name__ == "__main__":
    ecrire()
