#!/usr/bin/env python3
# ════════════════════════════════════════════════════════════════════
#  outils/carte-geographie.py — fabrique `data/carte.json`.
#
#  LA GÉOGRAPHIE EST INVENTÉE. Demande de Callista du 8 octobre :
#  « Pour le moment, tu inventes la carte, je t'en ferai une plus
#  tard. » Les NOMS, les identifiants de forum, les paliers et les
#  niveaux recommandés, eux, viennent du forum
#  (`44-arborescence-reelle-du-forum.md` et `40-arbitrages` § 4).
#
#  ── POURQUOI UN SCRIPT PLUTÔT QU'UN FICHIER ÉCRIT À LA MAIN ─────────
#
#  Parce que le fichier contient vingt-six contours en courbes de
#  Bézier et vingt-six positions d'étiquette écartées les unes des
#  autres. Écrit à la main, il serait illisible et impossible à
#  reprendre ; écrit ici, il se relit en vingt lignes de table.
#
#  Et parce que le placement des noms est un CALCUL : vingt-six
#  étiquettes sur 1000 × 640 se marchent dessus, et les écarter à l'œil
#  est un travail qu'on recommence à chaque lieu ajouté.
#
#  Rien de tout ça ne tourne dans le navigateur : la carte doit être
#  la même à chaque chargement, et mesurer du texte à chaque redessin
#  coûterait cher pour rien.
# ════════════════════════════════════════════════════════════════════

import json
import math
import pathlib

REPERE = {"largeur": 1000, "hauteur": 640}


def tache(cx, cy, rx, ry, graine, n=11):
    """Une tache organique : une ellipse dont chaque sommet est tiré
    vers l'intérieur ou l'extérieur de façon REPRODUCTIBLE. Pas de
    hasard à l'exécution — deux constructions donnent le même fichier,
    et le garde-fou le vérifie."""
    pts = []
    for i in range(n):
        a = 2 * math.pi * i / n
        d = 0.86 + 0.26 * ((math.sin(graine * 12.9898 + i * 78.233) + 1) / 2)
        pts.append((round(cx + rx * d * math.cos(a), 1),
                    round(cy + ry * d * math.sin(a), 1)))
    #  Catmull-Rom converti en Bézier cubique : des bords ronds, pas
    #  un polygone.
    d = f"M {pts[0][0]} {pts[0][1]}"
    for i in range(n):
        p0, p1, p2, p3 = pts[(i - 1) % n], pts[i], pts[(i + 1) % n], pts[(i + 2) % n]
        c1 = (round(p1[0] + (p2[0] - p0[0]) / 6, 1), round(p1[1] + (p2[1] - p0[1]) / 6, 1))
        c2 = (round(p2[0] - (p3[0] - p1[0]) / 6, 1), round(p2[1] - (p3[1] - p1[1]) / 6, 1))
        d += f" C {c1[0]} {c1[1]} {c2[0]} {c2[1]} {p2[0]} {p2[1]}"
    return d + " Z"


#  forumId, nom, palier, cx, cy, rx, ry, graine, description
ZONES = [
    (34, "Montagnes Embrumées", 1, 250, 118, 104, 60, 3,
     "Des crêtes qui disparaissent dans le brouillard dès la mi-journée. On y monte au son, plus qu'à la vue."),
    (9, "Forêt Marécageuse", 1, 142, 286, 92, 62, 7,
     "Des racines dans l'eau noire et des passerelles qui tiennent mal. On ne quitte pas le sentier."),
    (38, "Lande Broussailleuse", 1, 372, 246, 86, 50, 11,
     "Des buissons jusqu'à la taille sur des kilomètres. Le vent y porte les cris de très loin."),
    (100, "Fleuve Paisible", 1, 318, 390, 100, 42, 13,
     "Large, lent, et bien plus profond qu'il n'en a l'air. Les barques s'y louent à la journée."),
    (32, "Plage Grain de Sel", 1, 150, 460, 88, 46, 17,
     "Du sable clair sur des kilomètres, et des coquillages que personne ne ramasse plus."),
    (36, "Steppes Arides", 1, 582, 160, 92, 54, 19,
     "De l'herbe sèche à perte de vue. Rien pour se cacher, ni pour les dresseurs ni pour les pokémons."),
    (37, "Canyon Lekro", 2, 712, 280, 80, 58, 23,
     "Des parois de grès rouge et un fond qu'on n'atteint pas en une journée. L'écho y est trompeur."),
    (39, "Volcan Nuageux", 2, 452, 110, 64, 46, 29,
     "Un cône toujours coiffé de vapeur. La roche reste tiède sous les semelles, même la nuit."),
    (101, "Oasis Perdue", 2, 838, 148, 54, 38, 31,
     "Quelques palmiers et une eau trop bleue, au milieu de rien. On la trouve rarement deux fois au même endroit."),
    (31, "Manoir Barjok", 2, 470, 330, 50, 38, 37,
     "Une bâtisse que personne ne revendique, et dont les portes ne grincent jamais dans le même sens."),
    (35, "Usine Désaffectée", 2, 604, 404, 58, 42, 41,
     "Des chaînes de montage arrêtées en plein travail. Le courant passe encore, on ne sait pas d'où."),
    (33, "Libra Échoué", 2, 258, 548, 66, 38, 43,
     "La carcasse d'un cargo couchée sur le flanc, mangée par le sel. On y entre par la cheminée."),
    (103, "Monts Enneigés", 3, 436, 38, 98, 34, 47,
     "Au-dessus de la limite des arbres. Le froid y est le vrai adversaire, bien avant les pokémons."),
    (102, "Planque Snatch", 3, 770, 430, 52, 38, 53,
     "Une entrée dans la falaise, et rien d'écrit nulle part. Ceux qui savent n'en parlent pas."),
    (46, "Relique Sacrée", 3, 576, 522, 58, 40, 59,
     "Des pierres levées plus vieilles que Rhode. Les appareils photo y rendent des images vides."),
    (105, "Volcan Sombre", 3, 886, 318, 60, 48, 61,
     "Noir de la base au cratère. Rien n'y pousse, et le sol sonne creux."),
    #  AU LARGE, et c'est voulu : l'océan est hors du continent, sinon
    #  il se lit comme une plaine. Même chose pour l'Île Ténèbra.
    (104, "Océan Mystérieux", 3, 790, 586, 150, 52, 67,
     "Le large, au sud-est. Les cartes s'y arrêtent et les boussoles y tournent."),
]

#  forumId, nom, x, y, description. Une ville est une ÉPINGLE : un
#  point où l'on va, pas une étendue où l'on erre.
VILLES = [
    (12, "Pyrite", 228, 194, "La ville de pierre, adossée aux Montagnes Embrumées. Arène Roche et garage mécanique."),
    (16, "Tour Titanite", 358, 150, "Une tour unique qui sert de ville. Arène Vol tout en haut, Colosseum à son pied."),
    (5, "Phenacit", 214, 376, "Le centre administratif de Rhode. Colosseum et complexe de protection des pokémons."),
    (15, "Suerebe", 500, 220, "Ville d'acier posée sur la lande. Arène Acier et Colosseum de Targare."),
    (13, "Port-Amarée", 236, 500, "Le grand port du sud-ouest. Arène Eau, Colosseum de Rhode et l'aquarium."),
    (17, "Île Ténèbra", 630, 614, "Une île au large, et son Arène Ténèbres. On n'y accède que par bateau."),
    (14, "Samaragd", 430, 448, "La ville verte, au bord du fleuve. Laboratoire et Arène Plante."),
    (18, "Station Service", 624, 300, "Le carrefour routier de Rhode, et son marché. Arène Feu."),
]

NIVEAUX = {1: "Niveaux 1 à 20", 2: "Niveaux 15 à 40", 3: "Niveaux 35 et plus"}

lieux = []
for fid, nom, pal, cx, cy, rx, ry, g, desc in ZONES:
    lieux.append({"forumId": fid, "nom": nom, "type": "zone", "palier": pal,
                  "niveau": NIVEAUX[pal], "description": desc,
                  "forme": tache(cx, cy, rx, ry, g), "ancre": {"x": cx, "y": cy}})
for fid, nom, x, y, desc in VILLES:
    lieux.append({"forumId": fid, "nom": nom, "type": "ville",
                  "niveau": "Pas de rencontre sauvage", "description": desc,
                  "ancre": {"x": x, "y": y}})
lieux.append({"forumId": 65, "nom": "Mont Bataille", "type": "ligue",
              "niveau": "Sur invitation du Conseil 4",
              "description": "La Ligue de Rhode. Pas une zone sauvage : on n'y fait pas de rencontre, on y est attendu.",
              "ancre": {"x": 412, "y": 196}})

# ── le placement des noms ───────────────────────────────────────────
#
#  Vingt-six noms sur 1000 × 640 se marchent dessus. On les écarte par
#  petits pas, comme des ressorts, en rappelant chacun vers son lieu —
#  un nom qui part au large ne désigne plus rien.
#
#  LA LARGEUR EST ESTIMÉE GÉNÉREUSEMENT (8,2 px par caractère pour du
#  Nunito Sans gras de 13, plus 10 de marge). Première passe à 7,1 :
#  le calcul disait « un seul chevauchement » et l'écran en montrait
#  trois. Mieux vaut écarter un peu trop que croire un chiffre faux.

CARACTERE = 8.2
MARGE = 10
HAUT = 19


def boite(nom, x, y, ville):
    l = max(44, len(nom) * CARACTERE) + MARGE
    dy = 26 if ville else 4          # une ville écrit SOUS son épingle
    return (x - l / 2, y + dy - 14, l, HAUT)


def croise(a, b):
    return (a[0] < b[0] + b[2] and b[0] < a[0] + a[2]
            and a[1] < b[1] + b[3] and b[1] < a[1] + a[3])


noms = [l["nom"] for l in lieux]
ville = [l["type"] != "zone" for l in lieux]
ancres = [(l["ancre"]["x"], l["ancre"]["y"]) for l in lieux]
pos = [list(a) for a in ancres]

for tour in range(2000):
    boites = [boite(noms[i], pos[i][0], pos[i][1], ville[i]) for i in range(len(pos))]
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
                p = (dx / 2 + 0.8) * (1 if cx >= 0 else -1)
                pos[i][0] += p
                pos[j][0] -= p
            else:
                p = (dy / 2 + 0.8) * (1 if cy >= 0 else -1)
                pos[i][1] += p
                pos[j][1] -= p
    for i in range(len(pos)):
        ax, ay = ancres[i]
        pos[i][0] += (ax - pos[i][0]) * 0.04
        pos[i][1] += (ay - pos[i][1]) * 0.04
        pos[i][0] = min(958, max(42, pos[i][0]))
        pos[i][1] = min(610, max(26, pos[i][1]))
    if not bouge and tour > 30:
        break

for i, l in enumerate(lieux):
    l["etiquette"] = {"x": round(pos[i][0], 1), "y": round(pos[i][1], 1)}

boites = [boite(noms[i], pos[i][0], pos[i][1], ville[i]) for i in range(len(pos))]
restes = [(noms[i], noms[j]) for i in range(len(pos)) for j in range(i + 1, len(pos))
          if croise(boites[i], boites[j])]

carte = {
    "_": "La carte de Rhode. LA GÉOGRAPHIE EST INVENTÉE — « pour le moment, tu inventes la carte, je t'en ferai une plus tard » (8 octobre). Les noms, les identifiants de forum, les paliers et les niveaux recommandés viennent du forum. Le jour où la vraie carte arrive, seuls `terre`, `forme` et `ancre` changent.",
    "_fabrique": "ÉCRIT PAR `outils/carte-geographie.py`, pas à la main. Les contours sont des courbes de Bézier et les positions de nom sont calculées par relaxation : à la main, ce fichier serait illisible.",
    "_repere": "Tout est dans un repère de 1000 × 640, sans unité. Le SVG le met à l'échelle ; aucune de ces valeurs n'est un pixel.",
    "repere": REPERE,
    #  Le continent s'arrête avant le sud-est : l'océan et l'île sont
    #  AU LARGE, sinon ils se lisent comme des plaines.
    "terre": tache(420, 300, 400, 258, 2, 15),
    "lieux": lieux,
}
pathlib.Path("data/carte.json").write_text(
    json.dumps(carte, ensure_ascii=False, indent=2) + "\n")
print(f"{len(lieux)} lieux, {tour + 1} tours de relaxation, "
      f"{len(restes)} chevauchement(s)")
for a, b in restes:
    print("   ·", a, "×", b)
