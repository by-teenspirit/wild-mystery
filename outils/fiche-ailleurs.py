#!/usr/bin/env python3
"""Le contexte et la chronologie, en une fiche à coller SUR UN AUTRE FORUM.

══════════════════════════════════════════════════════════════════════

POURQUOI CETTE FICHE N'EST PAS L'ANNEXE 02

Elle porte le même texte, et rien d'autre ne lui ressemble.

L'annexe vit sur Wild Mystery : sa feuille y est servie, ses jetons de
couleur y sont déclarés, et son thème sombre suit celui du forum. Rien
de tout ça n'existe ailleurs. Une fiche qui s'appuierait sur
`wild-mystery.css` sortirait en texte nu chez l'hôte — des `<div>` sans
style, les uns sous les autres.

D'OÙ CINQ RÈGLES, et chacune coûte quelque chose :

  1. AUCUNE CLASSE, QUE DU STYLE EN LIGNE. Une classe ne vaut que si
     une feuille la connaît. Et un `<style>` collé dans un message est
     retiré par beaucoup de forums — c'est la première chose qu'un
     filtre enlève. Le style en ligne, lui, survit presque partout.

     Le prix : la fiche est longue, et on ne peut pas la retoucher d'un
     endroit. C'est pour ça qu'elle est GÉNÉRÉE : une couleur se change
     ici, pas dans quarante attributs.

  2. AUCUNE POLICE À CHARGER. Fraunces et Nunito Sans ne sont pas chez
     l'hôte, et on ne peut pas les y faire venir sans un `<link>`, qui
     ne passerait pas davantage qu'un `<style>`. On prend donc des
     piles de polices présentes partout — Georgia pour les titres, la
     pile système pour le texte — et la fiche garde l'esprit sans
     prétendre au même dessin.

  3. AUCUNE LARGEUR FIXE. On ne sait pas combien l'hôte laisse de place
     à un message. Tout est en pourcentage, et le texte se replie.

  4. UN SEUL THÈME. L'hôte a le sien, clair ou sombre, et on ne peut
     pas le lire. La fiche porte donc SON fond à elle, clair, sur
     toute sa surface : posée sur un forum sombre, elle reste lisible
     parce qu'elle ne dépend pas de ce qu'il y a dessous.

  5. AUCUN SCRIPT. Pas d'infobulle, pas d'onglet, pas de passage
     masqué. Ce qui s'affiche est ce qui est écrit.

LE TEXTE NE BOUGE PAS. « Ne modifie pas notre texte » (6 novembre). Il
est lu dans `data/contexte.json`, au caractère près, deux coquilles
comprises — « Rhode.Si » et « forum.Que », qui sont dans la source et
s'affichent donc aussi sur l'annexe.

══════════════════════════════════════════════════════════════════════

LA CONSTRUCTION, DEMANDÉE LE 9 NOVEMBRE

  · la bannière du forum, en grand, en haut, aux coins arrondis ;
  · un cadre : titre, sous-titre ;
  · un cadre : titre du contexte, contenu À HAUTEUR FIXE qui défile ;
  · un cadre : titre de la chrono, contenu codé comme sur les annexes,
    à hauteur fixe qui défile ;
  · « À retenir » et « Bon à savoir » EN FACE À FACE, aux couleurs de
    l'annexe ;
  · un pokémon en fond, en transparence, en bas à droite.

CE QUE LES HAUTEURS FIXES COÛTENT, et ça vaut d'être écrit : un
visiteur qui ne voit pas la barre de défilement croit la page finie.
Les deux cadres gardent donc un bas DÉGRADÉ, du blanc vers rien, qui
dit qu'il reste du texte dessous — c'est tout ce qu'on peut faire sans
script.

    python3 outils/fiche-ailleurs.py
"""

import json
import os
import re

RACINE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SOURCE = os.path.join(RACINE, "data", "contexte.json")
SORTIE = os.path.join(RACINE, "templates", "contexte-ailleurs.a-coller.html")

#  ── LES COULEURS, ÉCRITES EN DUR ET UNE SEULE FOIS ──────────────────
#
#  Ce sont les valeurs du thème clair de la charte, relevées dans
#  `panneau-admin/jetons.css`. Elles sont recopiées plutôt que lues :
#  la fiche doit rester juste si elle est collée dans six mois, et un
#  jeton qui bouge ne doit pas changer une fiche déjà publiée ailleurs.
PAGE = "#f3e1d2"  # le sable du fond
SURFACE = "#fffbf7"  # la surface d'une carte
HAUTE = "#fcf4ec"  # la surface d'un bloc dans la carte
TERRE = "#f8eae1"  # le fond d'un encart « terre »
#  `--wm-danger-paisible` à 16 % sur `fond-surface`, calculé une fois
#  ici : `color-mix` n'a rien à faire dans un attribut `style` qu'un
#  vieux navigateur de forum pourrait ne pas comprendre.
PAISIBLE = "#e7e6dd"
BORD = "#eadacd"
NET = "#d9c3b1"  # le filet et les points de la chronologie
ENCRE = "#2e2018"  # les titres
CORPS = "#4e3b30"  # le texte
DOUX = "#6e5749"  # les mentions
ACCENT = "#8b4725"  # le sur-titre, les dates, le dernier point
#  ── DEUX ACCENTS DE PLUS, PARCE QUE « ÇA MANQUE UN PEU DE COULEURS »
#
#  Ce sont ceux de la charte, et ceux que l'annexe emploie déjà : le
#  bleu fort titre les sections, le bleu primaire marque les repères.
#  MESURÉS SUR LES TROIS FONDS DE LA FICHE — 7,97 sur la surface, 6,97
#  sur le terre, 6,55 sur le paisible pour le bleu fort.
#
#  LE VERT `danger-paisible` A ÉTÉ ESSAYÉ ET REFUSÉ : 3,95 sur le fond
#  paisible, sous les 4,5. Il aurait fallu l'assombrir, donc inventer
#  une couleur qui n'est pas dans la charte.
BLEU = "#1f5470"  # accent-fort : les titres de cadre, l'étiquette verte
REPERE = "#275e7a"  # accent-primaire : les points de la chronologie

TITRE = "Georgia, 'Times New Roman', Times, serif"
TEXTE = "'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif"

#  ── LA BANNIÈRE ─────────────────────────────────────────────────────
#
#  C'est celle du forum, 1280 × 620, prise CHEZ SON HÉBERGEUR et non
#  derrière `2img.net` : ce dernier est le relais d'images de
#  Forumactif, et une fiche collée ailleurs n'a aucune raison de
#  passer par lui. Les deux adresses rendent le même fichier
#  aujourd'hui — mesuré, 985 740 octets des deux côtés — mais l'une
#  dépend de Forumactif et l'autre pas.
#
#  ELLE REMPLACE LES DEUX IMAGES CÔTE À CÔTE du premier jet : « en
#  fait en haut, on va mettre une grande image (la bannière) »
#  (9 novembre).
BANNIERE = "https://i.postimg.cc/9fcYn6Wj/banniere-wm.png"

#  LE POKÉMON DU FOND est celui de l'annexe 02 — Lugia, rendu officiel,
#  au commit épinglé de PokéAPI comme partout ailleurs dans le dépôt.
POKEMON = (
    "https://raw.githubusercontent.com/PokeAPI/sprites/"
    "bfb75391935310368065096fa08c51e8970bc43e/sprites/pokemon/other/"
    "official-artwork/249.png"
)

#  LE TITRE ET LE SOUS-TITRE NE SONT PAS DANS `contexte.json` : ce
#  fichier-là porte le texte de l'annexe, qui n'a pas à nommer le
#  forum. Ils sont donc ici, et nulle part ailleurs.
NOM = "Wild Mystery"
SOUS_TITRE = "Le contexte et la chronologie de la région de Rhode"

#  LA BANNIÈRE EST UNE BANDE, PAS UNE IMAGE ENTIÈRE. « Réduit la
#  hauteur de la bannière » : à 1280 × 620 elle faisait 374 px de haut
#  dans une colonne de 772, soit un quart de la fiche avant le premier
#  mot. Et « réduit son height encore » dans la foulée : cent
#  soixante-dix. L'image est recadrée en `cover` — on garde sa bande
#  centrale à toutes les largeurs plutôt que de l'écraser.
HAUTEUR_BANNIERE = "170px"

#  OÙ VIT LE TITRE. « Met le header du forum dedans » et « mets le
#  titre au dessus pour voir ? » : `dedans` le pose SUR la bannière,
#  calé en haut ; `dessus` le remet au-dessus d'elle, sur le sable,
#  comme ce matin. La variable sert à comparer les deux sans réécrire
#  le générateur — `FICHE_TITRE=dessus python3 outils/fiche-ailleurs.py`
#  écrit la variante à côté, sans toucher la fiche.
OU_LE_TITRE = os.environ.get("FICHE_TITRE", "dedans")
#  La variante s'écrit AILLEURS, et c'est voulu : `templates/` ne
#  garde que ce qui se colle. Un second fichier y traînerait, le
#  dégraisseur en ferait un `.min` de plus, et personne ne saurait
#  lequel des deux est la fiche.
#      FICHE_TITRE=dessus FICHE_SORTIE=/tmp/essai.html \
#          python3 outils/fiche-ailleurs.py
SORTIE = os.environ.get("FICHE_SORTIE") or SORTIE

#  Les hauteurs des fenêtres qui défilent.
HAUTEUR_CONTEXTE = "320px"
HAUTEUR_CHRONO = "360px"
#  LES DEUX ENCARTS SONT PLUS PETITS, et à hauteur fixe comme les
#  autres : « rajoute une taille fixe dans "à retenir" & "bon à
#  savoir" et fais les plus petit ». Leur texte faisait neuf lignes
#  dans une colonne étroite et ils pesaient autant que la
#  chronologie.
HAUTEUR_ENCART = "132px"

#  La chronologie, reprise de la brique du forum.
DATE = "112px"  # la colonne de gauche
RAIL = "14px"  # la largeur du point
SAUT = 28  # l'écart entre deux moments, en pixels
POINT = 14  # le diamètre d'un instant
DUREE = 34  # la hauteur d'une période

#  Un moment qui S'ÉTEND, reconnu au tiret dans sa date — même règle
#  que l'annexe, et les trois tirets Unicode comptent.
TIRETS = re.compile(r"[-‐-―]")


def une_duree(quand: str) -> bool:
    return TIRETS.search(quand) is not None


def st(*regles: str) -> str:
    """Un attribut `style` propre, à partir de morceaux.

    ON N'ÉCHAPPE PAS L'APOSTROPHE. `html.escape(quote=True)` la
    transforme en `&#x27;`, et nos piles de polices en contiennent —
    `'Segoe UI'`. Le navigateur la redécode et la règle marche, mais
    l'attribut devient illisible, et un filtre de forum qui réécrit
    les entités peut le casser. L'attribut est délimité par des
    guillemets doubles : seuls `&` et `"` ont besoin d'être échappés,
    et aucune de nos valeurs n'en contient.
    """
    valeur = ";".join(r for r in regles if r)
    return valeur.replace("&", "&amp;").replace('"', "&quot;")


#  `box-sizing` sur CHAQUE bloc qui a un rembourrage : l'hôte peut ne
#  pas le poser globalement, et un bloc en `content-box` ajoute son
#  rembourrage à sa largeur — il déborde alors de la colonne du
#  message. C'est le défaut qu'on ne voit que chez l'autre.
BOITE = "box-sizing:border-box"


def cadre(fond: str = SURFACE, marge: str = "margin:0 0 16px",
          fenetre_dedans: bool = False) -> str:
    """L'ouverture d'un cadre : fond clair, coins arrondis, rembourrage.

    `fenetre_dedans` ajoute le repère dont le dégradé du bas a besoin.
    """
    return (
        f'<div style="{st(BOITE, f"background:{fond}", "border-radius:12px",
                          "padding:22px", marge, "max-width:100%",
                          "position:relative" if fenetre_dedans else "")}">'
    )


def degrade_du_bas(fond: str = SURFACE, rgb: str = "255,251,247") -> str:
    """Le bas d'un cadre qui défile, fondu vers son fond.

    POURQUOI IL EXISTE : une fenêtre à hauteur fixe coupe une ligne de
    texte en deux, et une demi-ligne ressemble à un défaut d'affichage
    plutôt qu'à « il y a la suite ». Sans script, le fondu est le seul
    moyen de le dire.

    IL EST POSÉ SUR LE CADRE, PAS DANS LA FENÊTRE : dedans, il
    défilerait avec le texte et ne couvrirait le bas qu'au départ.

    LES DEUX BOUTS DU DÉGRADÉ PORTENT LA MÊME COULEUR, l'un à zéro
    d'opacité. `transparent` vaut `rgba(0,0,0,0)` et certains moteurs
    traversent alors le gris en interpolant — un voile sale au milieu
    du fondu.
    """
    return (
        f'<span style="{st("position:absolute", "left:2px", "right:2px",
                           "bottom:2px", "height:34px",
                           "border-radius:0 0 12px 12px",
                           "background:linear-gradient(to bottom, "
                           f"rgba({rgb},0), " + fond + ")",
                           "pointer-events:none", "display:block")}"></span>'
    )


def titre_de_cadre(mot: str, taille: str = "22px") -> str:
    return (
        f'<h2 style="{st("margin:0 0 14px", f"color:{BLEU}",
                         f"font-family:{TITRE}", f"font-size:{taille}",
                         "font-weight:600", "line-height:1.2")}">{mot}</h2>'
    )


def fenetre(hauteur: str) -> str:
    """Un contenu à hauteur fixe qui défile.

    `overflow:auto` ET PAS `scroll` : `scroll` dessine une barre vide
    quand le contenu tient, et deux barres mortes dans une fiche font
    plus de mal qu'elles n'en épargnent.
    """
    return (
        f'<div style="{st(BOITE, f"height:{hauteur}", "overflow:auto",
                          "padding-right:10px")}">'
    )


def paragraphe(mot: str, premier: bool, taille: str = "14px") -> str:
    marge = "margin:0" if premier else "margin:13px 0 0"
    return (
        f'<p style="{st(marge, f"color:{CORPS}", f"font-size:{taille}",
                        "line-height:1.7", "text-align:justify")}">{mot}</p>'
    )


def moment(m: dict, dernier: bool) -> list[str]:
    """Une rangée de la chronologie : date, repère, texte.

    LE REPÈRE EST UN VRAI ÉLÉMENT, pas un `::before`. On ne peut pas
    écrire de pseudo-élément dans un attribut `style`, et un filet à
    gauche du texte est exclu — « ne mets pas un border à gauche, ne
    mets ça nulle part ». Le point et le trait sont donc deux `<span>`
    posés en absolu dans une colonne étroite, comme la feuille du
    forum les dessine.
    """
    duree = une_duree(m["quand"])
    haut = DUREE if duree else POINT
    out = [
        f'<div style="{st(BOITE, "display:flex", "align-items:stretch",
                          "gap:18px",
                          "margin:0" if dernier else f"padding-bottom:{SAUT}px")}">',
        #  La date, calée à droite contre son repère.
        f'<span style="{st(f"flex:0 0 {DATE}", f"color:{ENCRE}",
                           "font-size:13px", "font-weight:700",
                           "letter-spacing:0.02em", "line-height:1.5",
                           "text-align:right", "text-transform:uppercase")}">'
        f"{m['quand']}</span>",
        #  La colonne du repère.
        f'<span style="{st("position:relative", f"flex:0 0 {RAIL}",
                           "display:block")}">',
        f'<span style="{st("position:absolute", "top:3px", "left:0",
                           f"width:{POINT}px", f"height:{haut}px",
                           "border-radius:999px",
                           f"background:{ACCENT if dernier else REPERE}",
                           "display:block")}"></span>',
    ]
    if not dernier:
        #  LE TRAIT DESCEND JUSQU'AU POINT SUIVANT. Il part sous le
        #  repère et plonge de `SAUT` sous la rangée — c'est
        #  exactement l'écart qui les sépare.
        out.append(
            f'<span style="{st("position:absolute", f"top:{3 + haut}px",
                               "left:6px", "width:1px", f"bottom:-{SAUT + 3}px",
                               f"background:{NET}", "display:block")}"></span>',
        )
    out += [
        "</span>",
        f'<span style="{st("flex:1 1 auto", "min-width:0", f"color:{CORPS}",
                           "font-size:13.5px", "line-height:1.6",
                           "display:block")}">{m["quoi"]}</span>',
        "</div>",
    ]
    return out


def bloc_du_titre(sur_le_sable: bool) -> list[str]:
    """Le nom du forum et son sous-titre, sans cadre.

    « Le grand titre et le sous titre, mets pas de fond » et « centre
    le texte » (9 novembre). Deux habillages, un seul bloc : sur le
    sable il prend l'encre de la charte, sur la bannière il passe en
    crème avec une ombre portée — une photo n'a pas de couleur qu'on
    puisse mesurer, et l'ombre détache les lettres de ce qu'il y a
    dessous même là où le voile est le plus clair.
    """
    encre = ENCRE if sur_le_sable else "#fffbf7"
    doux = DOUX if sur_le_sable else "#f0e4da"
    ombre = "" if sur_le_sable else "text-shadow:0 1px 4px rgba(18,12,10,0.55)"
    out = []
    if sur_le_sable:
        out.append(
            f'<div style="{st(BOITE, "padding:18px 4px 22px",
                              "text-align:center")}">',
        )
    out.append(
        f'<p style="{st("margin:0", f"color:{encre}", f"font-family:{TITRE}",
                        "font-size:28px", "font-weight:600",
                        "line-height:1.15", ombre)}">{NOM}</p>',
    )
    out.append(
        f'<p style="{st("margin:8px 0 0", f"color:{doux}", "font-size:13px",
                        "line-height:1.5", ombre)}">{SOUS_TITRE}</p>',
    )
    if sur_le_sable:
        out.append("</div>")
    return out


def main() -> None:
    with open(SOURCE, encoding="utf-8") as f:
        d = json.load(f)

    out: list[str] = []
    e = out.append

    #  ── L'EN-TÊTE DU FICHIER ────────────────────────────────────────
    e("<!-- ══════════════════════════════════════════════════════════")
    e("     LE CONTEXTE ET LA CHRONOLOGIE DE WILD MYSTERY")
    e("     Une fiche à coller SUR UN AUTRE FORUM.")
    e("")
    e("     ELLE NE DÉPEND DE RIEN. Pas de feuille de style à installer,")
    e("     pas de police à charger, pas de script. Tout le style est")
    e("     dans la balise elle-même, donc la fiche se colle dans un")
    e("     message et s'affiche telle quelle.")
    e("")
    e("     COMMENT LA COLLER : dans l'éditeur du forum d'accueil,")
    e("     passer en mode HTML (le bouton est souvent écrit « HTML »,")
    e("     « <> » ou « Code source »), puis coller tout le bloc.")
    e("")
    e("     LA BANNIÈRE EST LA PREMIÈRE ADRESSE DU BLOC. Pour en mettre")
    e("     une autre, il suffit de la remplacer : la largeur, les")
    e("     proportions et les coins arrondis sont posés à côté et")
    e("     s'adaptent à n'importe quelle image.")
    e("")
    e("     SI LE FORUM N'ACCEPTE PAS LE HTML dans les messages, il n'y")
    e("     a rien à faire de ce côté : aucun style ne passera, et il")
    e("     faudra recopier le texte en BBCode. Les forums en")
    e("     Forumactif, phpBB et ModernBB l'acceptent par défaut.")
    e("")
    e("     CE QU'ON PEUT CHANGER SANS RIEN CASSER : le texte. Tout le")
    e("     reste est de la mise en forme répétée à la main — elle est")
    e("     générée par outils/fiche-ailleurs.py depuis")
    e("     data/contexte.json, et c'est là qu'il faut toucher.")
    e("     ══════════════════════════════════════════════════════════ -->")
    e("")

    #  ── LA FICHE ────────────────────────────────────────────────────
    #
    #  `position:relative` et `overflow:hidden` servent au pokémon du
    #  fond : l'un lui donne son repère, l'autre lui coupe ce qui
    #  dépasse du coin arrondi.
    e(
        f'<div style="{st(BOITE, f"background:{PAGE}", "border-radius:16px",
                          "padding:24px 24px 34px", f"color:{CORPS}",
                          f"font-family:{TEXTE}", "font-size:14px",
                          "line-height:1.6", "max-width:100%",
                          "position:relative", "overflow:hidden")}">',
    )

    #  LE POKÉMON DU FOND. Il est posé AVANT le contenu et sans
    #  `z-index` : dans le flux, un élément écrit plus tôt passe
    #  dessous, et le contenu qui suit porte `position:relative` pour
    #  se placer au-dessus sans qu'on ait à empiler des couches.
    e(
        f'<img src="{POKEMON}" alt="" style="{st("position:absolute",
            "right:-34px", "bottom:-26px", "width:300px", "max-width:60%",
            "height:auto", "opacity:0.14", "pointer-events:none")}">',
    )
    e(f'<div style="{st("position:relative")}">')

    #  ── LA BANNIÈRE, EN BANDE, AVEC LE TITRE DEDANS ────────────────
    #
    #  ELLE EST UN FOND, PLUS UNE `<img>`. Pour poser le titre dessus
    #  il faut un bloc qui la porte ; une image et un calque frère
    #  auraient fait deux éléments à garder alignés pour rien.
    #  `cover` recadre sans déformer : on voit sa bande centrale,
    #  quelle que soit la largeur que l'hôte donne au message.
    #
    #  LE VOILE N'EST PAS UNE DÉCORATION. Le texte est blanc sur une
    #  photo qu'on ne choisit pas : sans lui, un ciel clair le rendrait
    #  illisible, et aucune mesure de contraste n'est possible sur une
    #  image. Le dégradé sombre en haut garantit le fond du titre quoi
    #  qu'il y ait derrière, et s'efface avant le bas de la bande.
    titre_dedans = OU_LE_TITRE != "dessus"
    if not titre_dedans:
        out.extend(bloc_du_titre(sur_le_sable=True))
    e(
        f'<div style="{st(BOITE, "position:relative",
                          f"height:{HAUTEUR_BANNIERE}", "max-width:100%",
                          "border-radius:12px", "overflow:hidden",
                          f"background-image:url({BANNIERE})",
                          "background-size:cover",
                          "background-position:center",
                          f"background-color:{NET}",
                          "margin:0 0 16px")}">',
    )
    if titre_dedans:
        e(
            f'<div style="{st(BOITE, "position:absolute", "left:0", "right:0",
                              "top:0", "padding:16px 18px 38px",
                              "background:linear-gradient(to bottom, "
                              "rgba(18,12,10,0.66), rgba(18,12,10,0))",
                              "text-align:center")}">',
        )
        out.extend(bloc_du_titre(sur_le_sable=False))
        e("</div>")
    e("</div>")

    #  ── LE CONTEXTE, DANS SA FENÊTRE ────────────────────────────────
    e(cadre(fenetre_dedans=True))
    e(titre_de_cadre("Le contexte"))
    e(fenetre(HAUTEUR_CONTEXTE))
    #  LE CHAPÔ N'EST PAS REPRIS. « Le paragraphe en dessous du
    #  contexte, tu peux l'enlever » (9 novembre) : il dit « cette PAGE
    #  vous dévoile les événements », ce qui est vrai de l'annexe et
    #  faux d'un message posté ailleurs. Il reste dans
    #  `data/contexte.json` et sur l'annexe, où il est à sa place.
    e(
        f'<p style="{st("margin:0 0 10px", f"color:{ACCENT}",
                        "font-size:11px", "font-weight:700",
                        "letter-spacing:0.08em",
                        "text-transform:uppercase")}">'
        f"{d['recit']['titre']}</p>",
    )
    for i, p in enumerate(d["recit"]["paragraphes"]):
        e(paragraphe(p, i == 0))
    e("</div>")
    e(degrade_du_bas())
    e("</div>")

    #  ── LA CHRONOLOGIE, DANS LA SIENNE ──────────────────────────────
    e(cadre(fenetre_dedans=True))
    e(titre_de_cadre(d["chronologie"]["titre"]))
    e(fenetre(HAUTEUR_CHRONO))
    moments = d["chronologie"]["moments"]
    for i, m in enumerate(moments):
        out.extend(moment(m, i == len(moments) - 1))
    e("</div>")
    e(degrade_du_bas())
    e("</div>")

    #  ── LES DEUX ENCARTS, EN FACE À FACE ────────────────────────────
    #
    #  Les couleurs sont celles de l'annexe, et c'est la DONNÉE qui les
    #  choisit : chaque encart porte son `ton` dans `contexte.json`.
    #  Une couleur décidée ici se serait séparée de l'annexe le jour où
    #  l'un des deux tons change.
    tons = {"terre": TERRE, "paisible": PAISIBLE}
    e(f'<div style="{st("display:flex", "flex-wrap:wrap", "gap:14px",
                        "margin:0 0 4px")}">')
    #  LE DÉGRADÉ DU BAS DOIT ÊTRE DE LA COULEUR DE SON ENCART, sinon
    #  il pose un voile crème sur du terre. D'où les composantes rouge-
    #  vert-bleu à côté du ton : un dégradé a besoin de la MÊME couleur
    #  à zéro d'opacité à son autre bout, et `rgba()` est le seul moyen
    #  de l'écrire en ligne.
    rgb = {"terre": "248,234,225", "paisible": "231,230,221"}
    #  L'étiquette prend l'accent qui va avec son ton : terre sur
    #  terre, bleu fort sur le paisible. Le vert de la charte y tombe
    #  à 3,95 — mesuré, et refusé pour ça.
    encres = {"terre": ACCENT, "paisible": BLEU}
    for enc in d["encarts"]:
        ton = enc["ton"]
        e(
            f'<div style="{st(BOITE, "flex:1 1 240px", "min-width:0",
                              "position:relative",
                              f"background:{tons.get(ton, HAUTE)}",
                              f"border:1px solid {BORD}", "border-radius:12px",
                              "padding:14px 16px")}">',
        )
        e(
            f'<p style="{st("margin:0 0 8px", f"color:{encres.get(ton, ACCENT)}",
                            "font-size:10.5px", "font-weight:700",
                            "letter-spacing:0.08em",
                            "text-transform:uppercase")}">'
            f"{enc['etiquette']}</p>",
        )
        e(fenetre(HAUTEUR_ENCART))
        e(
            f'<p style="{st("margin:0", f"color:{CORPS}", "font-size:12.5px",
                            "line-height:1.6", "text-align:justify")}">'
            f"{enc['texte']}</p>",
        )
        e("</div>")
        e(degrade_du_bas(tons.get(ton, HAUTE), rgb.get(ton, "252,244,236")))
        e("</div>")
    e("</div>")

    #  LE CRÉDIT. Il dit d'où vient la fiche, sur un forum où personne
    #  ne le devine.
    e(
        f'<p style="{st("margin:16px 0 0", f"color:{DOUX}", "font-size:11px",
                        "text-align:center")}">'
        "Wild Mystery — forum RPG Pokémon</p>",
    )
    e("</div>")
    e("</div>")

    texte = "\n".join(out) + "\n"
    with open(SORTIE, "w", encoding="utf-8") as f:
        f.write(texte)
    print(f"   {os.path.relpath(SORTIE, RACINE)} : {len(texte)} caractères")


if __name__ == "__main__":
    main()
