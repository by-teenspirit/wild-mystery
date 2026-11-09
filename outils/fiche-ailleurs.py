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
est lu dans `data/contexte.json`, au caractère près, trois coquilles
comprises. Changer le texte là-bas regénère la fiche ici.

    python3 outils/fiche-ailleurs.py
"""

import html
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
TERRE = "#f8eae1"  # le fond d'une pastille
BORD = "#eadacd"
ENCRE = "#2e2018"  # les titres
CORPS = "#4e3b30"  # le texte
DOUX = "#6e5749"  # les mentions
ACCENT = "#8b4725"  # le sur-titre et les dates

TITRE = "Georgia, 'Times New Roman', Times, serif"
TEXTE = "'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif"

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

    #  ── LA CARTE ────────────────────────────────────────────────────
    #
    #  `box-sizing` sur CHAQUE bloc qui a un rembourrage : l'hôte peut
    #  ne pas le poser globalement, et un bloc en `content-box` ajoute
    #  son rembourrage à sa largeur — il déborde alors de la colonne du
    #  message. C'est le défaut qu'on ne voit que chez l'autre.
    boite = "box-sizing:border-box"
    e(
        f'<div style="{st(boite, f"background:{PAGE}", "border-radius:14px",
                          "padding:26px", f"color:{CORPS}",
                          f"font-family:{TEXTE}", "font-size:14px",
                          "line-height:1.6", "max-width:100%")}">',
    )

    #  Le chapô, dans sa carte claire.
    e(
        f'<div style="{st(boite, f"background:{SURFACE}", "border-radius:10px",
                          "padding:22px", "margin:0 0 18px")}">',
    )
    e(
        f'<p style="{st("margin:0 0 10px", f"color:{ACCENT}", "font-size:11px",
                        "font-weight:700", "letter-spacing:0.08em",
                        "text-transform:uppercase")}">Le contexte</p>',
    )
    e(
        f'<p style="{st("margin:0", f"color:{CORPS}", "font-size:15px",
                        "line-height:1.7", "text-align:justify")}">'
        f"{d['chapo']}</p>",
    )
    e("</div>")

    #  ── LE RÉCIT ────────────────────────────────────────────────────
    e(
        f'<div style="{st(boite, f"background:{SURFACE}", "border-radius:10px",
                          "padding:22px", "margin:0 0 18px")}">',
    )
    e(
        f'<h2 style="{st("margin:0 0 14px", f"color:{ENCRE}",
                         f"font-family:{TITRE}", "font-size:26px",
                         "font-weight:600", "line-height:1.2")}">'
        f"{d['recit']['titre']}</h2>",
    )
    for i, p in enumerate(d["recit"]["paragraphes"]):
        marge = "margin:0" if i == 0 else "margin:14px 0 0"
        e(
            f'<p style="{st(marge, f"color:{CORPS}", "font-size:14px",
                            "line-height:1.7", "text-align:justify")}">{p}</p>',
        )
    e("</div>")

    #  ── LA CHRONOLOGIE ──────────────────────────────────────────────
    #
    #  PAS DE TABLEAU, et pas de flexbox non plus ici : une rangée
    #  « date / récit » en flex se replie mal dans une colonne de
    #  message étroite, et on ne sait pas laquelle l'hôte donne. La
    #  date passe donc AU-DESSUS de son texte, ce qui tient à toutes
    #  les largeurs sans une seule règle de repli.
    e(
        f'<div style="{st(boite, f"background:{SURFACE}", "border-radius:10px",
                          "padding:22px", "margin:0 0 18px")}">',
    )
    e(
        f'<h2 style="{st("margin:0 0 16px", f"color:{ENCRE}",
                         f"font-family:{TITRE}", "font-size:22px",
                         "font-weight:600", "line-height:1.2")}">'
        f"{d['chronologie']['titre']}</h2>",
    )
    for i, m in enumerate(d["chronologie"]["moments"]):
        marge = "margin:0" if i == 0 else "margin:14px 0 0"
        #  Une période porte une capsule, un instant un rond — la même
        #  distinction que la brique du forum, faite ici avec un fond
        #  et un rayon, les seuls outils qu'on ait.
        rayon = "999px" if une_duree(m["quand"]) else "6px"
        e(
            f'<div style="{st(boite, marge, f"background:{HAUTE}",
                              "border-radius:8px", "padding:14px 16px")}">',
        )
        e(
            f'<span style="{st("display:inline-block", "margin:0 0 6px",
                               f"background:{TERRE}", f"border-radius:{rayon}",
                               "padding:4px 10px", f"color:{ACCENT}",
                               "font-size:11px", "font-weight:700",
                               "letter-spacing:0.04em")}">'
            f"{m['quand']}</span>",
        )
        e(
            f'<p style="{st("margin:0", f"color:{CORPS}", "font-size:13.5px",
                            "line-height:1.65", "text-align:justify")}">'
            f"{m['quoi']}</p>",
        )
        e("</div>")
    e("</div>")

    #  ── LES DEUX ENCARTS ────────────────────────────────────────────
    for j, enc in enumerate(d["encarts"]):
        dernier = j == len(d["encarts"]) - 1
        e(
            f'<div style="{st(boite, f"background:{HAUTE}",
                              f"border:1px solid {BORD}", "border-radius:10px",
                              "padding:18px 20px",
                              "margin:0" if dernier else "margin:0 0 14px")}">',
        )
        e(
            f'<p style="{st("margin:0 0 8px", f"color:{ACCENT}",
                            "font-size:11px", "font-weight:700",
                            "letter-spacing:0.08em",
                            "text-transform:uppercase")}">'
            f"{enc['etiquette']}</p>",
        )
        e(
            f'<p style="{st("margin:0", f"color:{CORPS}", "font-size:13.5px",
                            "line-height:1.65", "text-align:justify")}">'
            f"{enc['texte']}</p>",
        )
        e("</div>")

    #  LE CRÉDIT. Il dit d'où vient la fiche, sur un forum où personne
    #  ne le devine.
    e(
        f'<p style="{st("margin:18px 0 0", f"color:{DOUX}", "font-size:11px",
                        "text-align:center")}">'
        "Wild Mystery — forum RPG Pokémon</p>",
    )
    e("</div>")

    texte = "\n".join(out) + "\n"
    with open(SORTIE, "w", encoding="utf-8") as f:
        f.write(texte)
    print(f"   {os.path.relpath(SORTIE, RACINE)} : {len(texte)} caractères")


if __name__ == "__main__":
    main()
