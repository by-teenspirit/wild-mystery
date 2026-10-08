#!/usr/bin/env python3
# ════════════════════════════════════════════════════════════════════
#  outils/carte-fondu.py — fond les BORDS de la peinture dans le bleu
#  du décor.
#
#  Demandé le 8 octobre : « tu pourrais éditer la photo pour que tout
#  se fonde bien dans le décor ? […] le fond de l'océan avec le fond
#  bleu que tu as mis toi. »
#
#  ── LE DÉFAUT ───────────────────────────────────────────────────────
#
#  La peinture est carrée, le cadre de la carte ne l'est pas : il
#  reste une bande de chaque côté, que la feuille remplit du bleu
#  relevé sur le bord de l'image. La couleur est la bonne — c'est la
#  même, #0f436b, prélevée dessus — et pourtant la jointure SE VOIT.
#
#  Parce qu'un aplat n'est pas une peinture. L'océan du générateur a
#  son grain, ses courants, son léger assombrissement vers l'extérieur.
#  Collé contre un aplat parfaitement lisse, il s'arrête net : on ne
#  voit pas une différence de teinte, on voit une différence de
#  MATIÈRE, et l'œil la lit comme un bord d'image.
#
#  ── LA CORRECTION ───────────────────────────────────────────────────
#
#  On éteint le grain avant le bord. Sur les cent cinquante derniers
#  pixels, la peinture glisse vers la couleur exacte du décor : à
#  l'endroit où elle s'arrête, elle EST le décor, et il n'y a plus
#  rien à voir.
#
#  LA COULEUR N'EST PAS CHOISIE, ELLE EST RELEVÉE sur le pourtour de
#  l'image — et c'est elle que la feuille 16 reprend dans
#  `--wm-carte-marge-peinte`. Le garde-fou n° 15 ne peut PAS la
#  vérifier — cette variable n'est pas un jeton de charte, elle est
#  dans `HORS_CHARTE` —, et c'est précisément pour ça que ce script
#  l'écrit lui-même dans la feuille : personne d'autre ne s'apercevrait
#  qu'elle ment.
#
#  ── POURQUOI PAS DE LA TRANSPARENCE ─────────────────────────────────
#
#  Un PNG dont les bords sont transparents se fondrait dans n'importe
#  quel fond, et c'est séduisant. Mais il pèse trois fois le JPEG, et
#  il est servi à chaque chargement de l'index. Le fond est fixe, des
#  deux côtés et dans les deux thèmes — il n'y a rien à gagner à le
#  décider au dernier moment.
# ════════════════════════════════════════════════════════════════════

import pathlib
import re

import numpy as np
from PIL import Image

SOURCE = pathlib.Path("planches/peinte/source.png")
SORTIE = pathlib.Path("planches/peinte/fondue.png")
POUR_LE_FORUM = pathlib.Path("planches/peinte/fond-forum.jpg")
FEUILLE = pathlib.Path("css/16-carte.css")

#  Sur combien de pixels la peinture s'éteint, et à partir d'où. Au
#  deux millième, 150 font sept pour cent : assez pour que l'extinction
#  soit insensible, assez peu pour ne pas manger la mer peinte — le
#  continent commence à plus de deux cents pixels du bord.
FONDU = 150

#  La largeur du ruban sur lequel on relève la couleur du décor. Deux
#  pixels suffiraient si le bord était pur ; huit lissent le bruit de
#  compression sans aller chercher les premières vaguelettes.
RUBAN = 8

LARGEUR_FORUM = 1400


def couleur_du_bord(rgb):
    """La couleur moyenne du pourtour. La MÉDIANE et pas la moyenne :
    un coin plus sombre, un reste de signature, un pixel aberrant
    tireraient la moyenne et on obtiendrait un décor qui ne colle à
    aucun des quatre côtés."""
    bandes = [rgb[:RUBAN, :, :].reshape(-1, 3),
              rgb[-RUBAN:, :, :].reshape(-1, 3),
              rgb[:, :RUBAN, :].reshape(-1, 3),
              rgb[:, -RUBAN:, :].reshape(-1, 3)]
    return np.median(np.concatenate(bandes), axis=0)


def main():
    im = Image.open(SOURCE).convert("RGB")
    rgb = np.asarray(im).astype(np.float32)
    h, w = rgb.shape[:2]

    fond = couleur_du_bord(rgb)
    hexa = "#%02x%02x%02x" % tuple(int(round(c)) for c in fond)
    print(f"   décor relevé sur l'image : {hexa}")

    #  La distance au bord le plus proche, en pixels. Pas une distance
    #  au centre : un fondu radial laisserait les quatre coins plus
    #  éteints que les milieux de côté, et on verrait le cercle.
    ys = np.minimum(np.arange(h), h - 1 - np.arange(h)).astype(np.float32)
    xs = np.minimum(np.arange(w), w - 1 - np.arange(w)).astype(np.float32)
    d = np.minimum(ys[:, None], xs[None, :])

    #  1 au cœur, 0 au bord, avec départ et arrivée à plat : une rampe
    #  linéaire laisse voir ses deux extrémités, qui sont deux lignes
    #  droites de plus.
    t = np.clip(d / FONDU, 0.0, 1.0)
    t = t * t * (3 - 2 * t)

    sortie = rgb * t[:, :, None] + fond[None, None, :] * (1 - t[:, :, None])
    Image.fromarray(np.clip(sortie, 0, 255).astype(np.uint8)).save(SORTIE)

    petite = Image.fromarray(np.clip(sortie, 0, 255).astype(np.uint8)) \
        .resize((LARGEUR_FORUM, LARGEUR_FORUM), Image.LANCZOS)
    petite.save(POUR_LE_FORUM, quality=84, optimize=True)

    #  ── LA FEUILLE SUIT L'IMAGE ───────────────────────────────────
    #  Écrire la couleur à la main dans la feuille, c'est la voir
    #  dériver à la première peinture suivante. On la pose ici.
    css = FEUILLE.read_text()
    neuf = re.sub(r"(--wm-carte-marge-peinte, )#[0-9a-f]{6}", rf"\1{hexa}", css)
    if neuf != css:
        FEUILLE.write_text(neuf)
        print(f"   css/16-carte.css : repli mis à {hexa}")

    poids = POUR_LE_FORUM.stat().st_size // 1024
    print(f"   fondu sur {FONDU} px · {SORTIE.name} · "
          f"{POUR_LE_FORUM.name} {poids} Ko")


if __name__ == "__main__":
    main()
