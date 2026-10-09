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
#  2. ON RELÈVE LE RÉSEAU DE PISTES, et c'est la pièce ajoutée le
#     9 octobre : voir plus bas, c'est elle qui change tout ;
#  3. on pose une graine par zone, à la main : c'est le SEUL endroit
#     où un humain doit regarder l'image, et c'est irréductible —
#     aucun algorithme ne sait que la tache violette est le Manoir
#     Barjok ;
#  4. chaque graine s'étend aux pixels de couleur voisine, en Lab,
#     bornée par un rayon ET PAR LES PISTES ;
#  5. ce qui reste de terre va au territoire le plus proche. C'est la
#     même règle que `carte-territoires.py`, et elle garantit ce que
#     Callista a demandé le 8 : les zones se touchent, il n'y a pas de
#     vide. Les pistes elles-mêmes sont reprises par ce partage, donc
#     elles ne laissent aucune rainure entre deux zones.
#
#  ── LES PISTES SONT LA FRONTIÈRE, ET C'EST LA PEINTURE QUI LE DIT ───
#
#  « J'aimerais que tu suives davantage les bords de la map plutôt que
#  mes rectangles incertains », 9 octobre. Les bords y sont, mais pas
#  tous de la même nature, et la première version de ce script n'en
#  voyait qu'une :
#
#    · sur la MOITIÉ DROITE, les zones se séparent PAR LA COULEUR —
#      sable, canyon rouge, manoir violet, volcan noir. La croissance
#      en Lab suffit ;
#    · sur la MOITIÉ VERTE, elles se séparent PAR LES CHEMINS DE
#      TERRE. Lande, Fleuve, Marécage et Plage sont du même vert à
#      deux ou trois unités près : une croissance de couleur les
#      fusionne en un seul territoire, et le rayon qui l'en empêche
#      découpe des disques, pas des régions.
#
#  Le peintre a tracé ces pistes, et elles sont exactement la carte
#  des frontières qu'on cherchait à deviner. On les relève donc, et on
#  interdit à une graine de les franchir.
#
#  COMMENT ON LES DISTINGUE DU SABLE, qui est du même beige : par leur
#  ÉPAISSEUR. Une piste fait une trentaine de pixels de large, donc
#  aucun de ses pixels n'est à plus de dix-huit d'un bord ; le désert
#  en fait huit cents. Un seuil sur la transformée de distance tranche
#  net là où aucun seuil de teinte ne le peut — c'est le même
#  raisonnement que pour les toits des villages et la roche du canyon,
#  plus bas, et c'est la deuxième fois qu'il sert.
#
#  Une OUVERTURE MORPHOLOGIQUE aurait semblé plus naturelle : essayée,
#  elle hache le réseau en fragments — elle mange le cœur des
#  carrefours, qui sont larges, et garde les bavures des bords. Un
#  réseau en morceaux n'arrête plus rien.
#
#  LA PLAGE CÔTIÈRE EST ÉCARTÉE du relevé : elle est du même beige et
#  fait le tour du continent, donc elle enfermerait chaque zone dans
#  un anneau. On ne garde que ce qui est à plus de trente pixels de la
#  mer.
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
from skimage import color, filters, graph, measure

sys.path.insert(0, str(pathlib.Path(__file__).parent))

SOURCE = pathlib.Path("planches/peinte/source.png")
COTE = 1000          # le repère de sortie, carré comme la peinture
PAS = 26             # un sommet tous les 26 px de l'image sur un contour

#  ── LES ZONES VIENNENT DE LA CARTE ANNOTÉE DE CALLISTA ─────────────
#
#  « Je t'avais pourtant fait un exemple détaillé. Recommence. »
#  9 octobre, et elle a raison : j'avais posé seize graines à l'œil et
#  laissé un algorithme deviner le reste, alors que le découpage
#  existait déjà — elle l'avait peint par-dessus la carte.
#
#  `planches/peinte/zones-callista.png` EST la même image que
#  `source.png`, avec un calque de blocs par-dessus. On les retrouve
#  donc par SOUSTRACTION, pixel à pixel : là où les deux images
#  diffèrent, elle a peint. Rien à relever à l'œil, rien à approcher.
#
#  ── ET LES COULEURS SONT LES PALIERS ────────────────────────────────
#
#  « Les couleurs indiquent les paliers. » Le vert est le palier 1, le
#  rouge les paliers 2 et 3. C'est une VÉRIFICATION offerte : le
#  décompte doit tomber sur celui de `data/carte.json` — six zones de
#  palier 1, onze de palier 2 et 3 — et il tombe. Six blocs verts,
#  dix rouges, plus le Canyon qu'elle n'a pas eu besoin de colorer
#  parce que la peinture le découpe déjà toute seule.
#
#  ── CE QUE LE SCRIPT AJOUTE, ET C'EST TOUT ──────────────────────────
#
#  Ses blocs sont des quadrilatères approximatifs — « mes rectangles
#  incertains », et elle demande de suivre les bords du dessin plutôt
#  qu'eux. On s'en sert donc comme AMORCES, pas comme contours : chaque
#  bloc est érodé pour n'en garder que le cœur, puis on laisse ce cœur
#  se propager jusqu'aux frontières peintes, par chemin de moindre
#  coût. Traverser une piste coûte cher, traverser une lisière de biome
#  aussi ; traverser un pré ne coûte rien.
#
#  Le résultat : l'ÉTENDUE est la sienne, la FRONTIÈRE est celle du
#  peintre. C'est exactement la demande.
#
#  Le point donné ici ne sert qu'à NOMMER le bloc qui le contient —
#  c'est le seul endroit où un humain doit encore regarder l'image,
#  et il est irréductible : rien ne sait que le bloc rouge du coin
#  est l'Océan Mystérieux. Il est pris au plus loin du bord du bloc
#  (maximum de la transformée de distance), donc il reste dedans même
#  pour une forme concave.
ANNOTATION = pathlib.Path("planches/peinte/zones-callista.png")

#  ── L'IMAGE DE FOND SORT DU DÉPÔT, ET C'EST UNE LEÇON ───────────────
#
#  « Tu as modifié les zones mais pas la carte de Rhode ? » Non : les
#  zones venaient d'ici, et l'image affichée d'un hébergeur d'images
#  mis à jour à la main. Deux sources pour un seul dessin, donc deux
#  sources qui dérivent — et elles avaient dérivé de deux peintures
#  d'écart.
#
#  Les deux sortent du même outil, dans la même passe : elles voyagent
#  donc ensemble, par le dépôt. GitHub Pages sert `planches/`, vérifié.
#  Changer d'hébergeur reste possible — il suffit d'écrire l'adresse
#  dans `fond`, elle survit à la régénération.
FOND = ("https://by-teenspirit.github.io/wild-mystery/"
        "planches/peinte/fond-forum.jpg")

ZONES = [
    #  forumId, nom,                    x,    y
    (103, "Monts Enneigés",            878,  171),
    (36, "Steppes Arides",            1595,  263),
    (34, "Montagnes Embrumées",        430,  291),
    (39, "Volcan Nuageux",            1243,  312),
    (33, "Libra Échoué",              1717,  433),
    (38, "Lande Broussailleuse",       870,  594),
    (31, "Manoir Barjok",             1309,  607),
    (9, "Forêt Marécageuse",           446,  698),
    (101, "Oasis Perdue",             1806,  758),
    (105, "Volcan Sombre",            1825, 1120),
    (35, "Usine Désaffectée",         1492, 1207),
    (100, "Fleuve Paisible",           709, 1219),
    (32, "Plage Grain de Sel",         237, 1305),
    (102, "Planque Snatch",           1370, 1437),
    (46, "Relique Sacrée",            1069, 1572),
]

#  LE CANYON N'A PAS DE BLOC, et ce n'est pas un oubli : sa roche
#  rouge-orange est le seul aplat de la peinture qu'aucun voisin
#  n'imite. Callista n'avait rien à montrer là. Il reçoit donc une
#  amorce prise dans la peinture, au même titre que les autres — un
#  disque, que la propagation étend.
CANYON = (37, "Canyon Lekro", 1430, 780)

#  LA SEULE ZONE QUI EST DANS L'EAU, et son bloc y est aussi : elle se
#  découpe donc directement, sans propagation — au large il n'y a
#  aucune frontière peinte à épouser.
#
#  EN BAS À GAUCHE, et c'est un changement : `data/carte.json` la
#  posait en bas à droite, près de Ténèbra. Callista l'a déplacée sur
#  sa carte annotée, et confirmé.
OCEAN = (104, "Océan Mystérieux", 227, 1762)

#  COMBIEN ON ÉRODE UN BLOC pour en faire une amorce. Assez pour que
#  ses bords approximatifs ne décident de rien — ils débordent sur le
#  voisin par endroits —, pas assez pour qu'un bloc étroit disparaisse.
#  Le plus petit fait 51 000 px, soit un carré de 225 de côté.
EROSION = 45

#  Où CHERCHER chaque ville : le nom va à la grappe de toits la plus
#  proche de ce point. Les coordonnées sont celles des grappes
#  RELEVÉES dans la peinture — le rattachement est donc exact, et la
#  position finale reste celle du peintre, au pixel près.
#
#  ELLES NE SONT PAS RELEVÉES À L'ŒIL. Callista a posé neuf pastilles
#  grises sur sa carte annotée, une par ville ; elles sont toutes des
#  disques de 49 px d'un gris uniforme, donc `outils/carte-pastilles.py`
#  les retrouve et donne leur centre au pixel. Ce sont ces centres-là.
VILLES = [
    (65, "Mont Bataille", "ligue", 970, 334),
    (16, "Tour Titanite", "ville", 1340, 353),
    (12, "Pyrite", "ville", 601, 469),
    (15, "Suerebe", "ville", 1613, 625),
    (5, "Phenacit", "ville", 1196, 752),
    (18, "Station Service", "ville", 1455, 956),
    (13, "Port-Amarée", "ville", 626, 968),
    (14, "Samaragd", "ville", 945, 1088),
    (17, "Île Ténèbra", "ville", 1719, 1718),
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

    #  ── LE RÉSEAU DE PISTES ───────────────────────────────────────
    #  Voir l'en-tête : c'est lui qui sépare les quatre verts, que la
    #  couleur ne sépare pas.
    beige = continent & (lab[:, :, 0] > 75) & (lab[:, :, 0] < 92) \
        & (np.abs(lab[:, :, 1]) < 9) \
        & (lab[:, :, 2] > 18) & (lab[:, :, 2] < 34)
    beige = ndimage.binary_closing(beige, iterations=4)
    #  L'ÉPAISSEUR, et pas la teinte : une piste n'a aucun pixel à plus
    #  de dix-huit d'un bord, le désert en a des milliers.
    assez_fin = ndimage.distance_transform_edt(beige) < 18
    #  La plage côtière est du même beige et ferait un anneau autour de
    #  chaque zone du bord.
    loin_de_la_mer = ndimage.distance_transform_edt(~eau) > 30
    pistes = ndimage.binary_closing(
        beige & assez_fin & loin_de_la_mer, iterations=4)
    print(f"   pistes : {pistes.sum()} px, "
          f"{100 * pistes.sum() / continent.sum():.1f} % de la terre")

    #  ── LES AMORCES : LES BLOCS DE CALLISTA, ÉRODÉS ──────────────
    #
    #  Par soustraction avec la peinture : là où les deux images
    #  diffèrent, elle a peint. Le vert est le palier 1, le rouge les
    #  paliers 2 et 3 — on ne s'en sert pas pour décider, seulement
    #  pour SÉPARER deux blocs voisins qui se touchent.
    ann = np.asarray(Image.open(ANNOTATION).convert("RGB")).astype(np.int16)
    brut = np.asarray(im).astype(np.int16)
    if ann.shape != brut.shape:
        raise SystemExit("la carte annotée et la peinture n'ont pas la même taille")
    ecart_ann = ann - brut
    peint = np.abs(ecart_ann).sum(axis=2) > 18
    familles = {
        "vert": (ecart_ann[:, :, 1] > ecart_ann[:, :, 0] + 20)
        & (ecart_ann[:, :, 1] > ecart_ann[:, :, 2] + 20) & peint,
        "rouge": (ecart_ann[:, :, 0] > ecart_ann[:, :, 1] + 20)
        & (ecart_ann[:, :, 0] > ecart_ann[:, :, 2] + 20) & peint,
    }
    blocs = []
    for sel in familles.values():
        #  L'ouverture enlève le liseré du tracé et les quelques
        #  pixels que l'anti-crénelage laisse entre deux blocs.
        s = ndimage.binary_opening(sel, iterations=3)
        etiq_s, k = ndimage.label(s)
        for j in range(1, k + 1):
            m_ = etiq_s == j
            if m_.sum() >= 25000:
                blocs.append(m_)
    print(f"   {len(blocs)} bloc(s) relevé(s) sur la carte annotée")

    def bloc_contenant(x, y):
        for m_ in blocs:
            if m_[y, x]:
                return m_
        return None

    #  ── LE RELIEF : CE QU'IL EN COÛTE DE TRAVERSER ───────────────
    #
    #  Un pas coûte 1 dans un pré, beaucoup sur une piste, beaucoup sur
    #  une lisière de biome. Le gradient est pris sur une image LISSÉE :
    #  sans ça, chaque arbre et chaque rocher est une falaise, et la
    #  propagation n'avance plus nulle part.
    doux = np.dstack([ndimage.gaussian_filter(lab[:, :, i], 12) for i in range(3)])
    pente = sum(filters.sobel(doux[:, :, i]) ** 2 for i in range(3)) ** 0.5
    pente = pente / (np.percentile(pente[continent], 99) or 1)
    cout = 1.0 + 35.0 * pistes + 45.0 * np.clip(pente, 0, 3)
    #  La mer est infranchissable : une zone ne passe pas d'une rive à
    #  l'autre d'une baie.
    cout[~continent] = np.inf

    #  ── CHAQUE AMORCE SE PROPAGE, ET LA MOINS CHÈRE L'EMPORTE ────
    liste = [(f, nom, x, y) for f, nom, x, y in ZONES]
    liste.append(CANYON)
    amorces = []
    for f, nom, gx, gy in liste:
        if (f, nom, gx, gy) == CANYON:
            #  Pas de bloc : un disque dans la roche rouge.
            m_ = ((xs - gx) ** 2 + (ys - gy) ** 2) <= 60 ** 2
        else:
            bloc = bloc_contenant(gx, gy)
            if bloc is None:
                raise SystemExit(f"aucun bloc ne contient le point de {nom}")
            #  ÉRODÉ : les bords de ses quadrilatères débordent sur le
            #  voisin par endroits, et ce sont précisément les bords
            #  qu'elle ne veut pas qu'on suive.
            m_ = ndimage.binary_erosion(bloc, iterations=EROSION)
            if not m_.any():
                m_ = bloc
        m_ = m_ & continent
        if not m_.any():
            raise SystemExit(f"l'amorce de {nom} ne touche pas la terre")
        amorces.append((f, nom, m_))

    piles = []
    for f, nom, m_ in amorces:
        mcp = graph.MCP_Geometric(cout)
        depart = [tuple(p) for p in np.argwhere(
            ndimage.binary_erosion(m_, iterations=2) if m_.sum() > 4000 else m_)]
        #  Un seul départ par amorce suffirait, mais une amorce est une
        #  SURFACE : partir de tous ses pixels, c'est propager depuis sa
        #  frontière, donc ne jamais traverser son propre intérieur.
        couts, _ = mcp.find_costs(depart[:: max(1, len(depart) // 4000)])
        piles.append(couts)
    pile = np.stack(piles)
    propriete = (np.argmin(pile, axis=0) + 1).astype(np.int32)
    propriete[~continent] = 0
    plein = propriete

    #  ON GARDE LA CARTE DES ZONES, en image : `outils/carte-fondu.py`
    #  en a besoin pour savoir où sont les coutures, et la recalculer
    #  chez lui voudrait dire tenir deux fois les mêmes amorces — donc
    #  les voir diverger un jour.
    Image.fromarray(plein.astype(np.uint8)).save("planches/peinte/zones.png")

    lieux = []
    for n_, (forum, nom, _) in enumerate(amorces, start=1):
        region = ndimage.binary_closing(plein == n_, iterations=2)
        if not region.any():
            print(f"   · {nom} n'a rien reçu")
            continue
        #  ── LA PLAGE PREND AUSSI SON EAU CÔTIÈRE ──────────────────
        #  « Plage Grain de Sel s'arrête au sable, ou tu veux qu'elle
        #  prenne aussi l'eau côtière ? » — « oui ». Son bloc déborde
        #  sur la mer et c'est voulu ; la propagation, elle, s'arrête
        #  à la côte. On lui rend donc la partie marine de son bloc.
        if forum == 32:
            bloc = bloc_contenant(237, 1305)
            if bloc is not None:
                region = region | (bloc & ~continent)
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

    #  ── L'OCÉAN MYSTÉRIEUX ────────────────────────────────────────
    #  Son bloc est dans l'eau : il se découpe tel quel, sans
    #  propagation — au large il n'y a aucune frontière peinte à
    #  épouser, et une tache d'eau suivrait les vaguelettes.
    forum_o, nom_o, ox, oy = OCEAN
    bloc_o = bloc_contenant(ox, oy)
    if bloc_o is None:
        raise SystemExit(f"aucun bloc ne contient le point de {nom_o}")
    region_o = ndimage.binary_closing(bloc_o & ~continent, iterations=4)
    morceaux_o = contours_de(region_o, echelle)
    if morceaux_o:
        cy, cx = ndimage.center_of_mass(region_o)
        lieux.append({
            "forumId": forum_o, "nom": nom_o, "marine": True,
            "ancre": {"x": round(cx * echelle), "y": round(cy * echelle)},
            "forme": " ".join(morceaux_o),
            "aire": int(region_o.sum()),
        })
    else:
        print(f"   · {nom_o} : contour trop petit")

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
                 "carte marche encore. ELLE POINTE SUR LE DÉPÔT, pas "
                 "sur un hébergeur d'images : l'image et les zones "
                 "sortent du même outil et doivent voyager ensemble.",
        "repere": {"largeur": COTE, "hauteur": COTE},
        "terre": " ".join(contours_de(continent, echelle, mini=1200)),
        "iles": contours_de(grandes, echelle, mini=420),
        "fond": ancien.get("fond", "") or FOND,
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
