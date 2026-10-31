#!/usr/bin/env python3
# ════════════════════════════════════════════════════════════════════
#  outils/icones.py — les icônes portées par la feuille, en `data:`
#
#  Lancement :  python3 outils/icones.py
#
#  Écrit `img/types/<cle>.png` (18 fichiers découpés dans PokéAPI) et
#  `css/20-icones.css`, qui porte ces dix-huit ET les sept badges
#  d'arène de `img/badges/*.svg`.
#
#  ── POURQUOI ON DÉCOUPE AU LIEU DE SERVIR TEL QUEL ─────────────────
#
#  « Dans l'infobulle, affiche le sprite des types pris de l'api »,
#  30 octobre. Le dépôt PokeAPI/sprites a cinq jeux de types — x-y,
#  platinum, black-white, sun-moon, sword-shield, scarlet-violet — et
#  **les cinq gravent le nom du type EN ANGLAIS dans l'image**. Il n'y
#  a aucun jeu d'icônes seules.
#
#  Poser « WATER » dans une infobulle d'un forum français n'est pas
#  une option, et la planche 39 dessine une pastille avec le nom
#  écrit. On garde donc notre pastille et son nom français, et on ne
#  prend de l'image que le GLYPHE.
#
#  ── LA DÉCOUPE, ET COMMENT ELLE A ÉTÉ TROUVÉE ──────────────────────
#
#  Mesurée sur les dix-huit badges `generation-ix/scarlet-violet`
#  (200 × 40) : les pixels blancs du glyphe vont de x = 15 à x = 45 au
#  pire, et le texte ne commence jamais avant x = 52. Une fenêtre
#  x ∈ [10, 50] contient donc tout glyphe et aucune lettre, sur les
#  dix-huit, avec sept pixels de marge.
#
#  Le carré est ensuite masqué en rond : le badge d'origine est une
#  pastille arrondie à gauche et coupée net à droite, et la moitié
#  d'une pastille se reconnaît tout de suite. Un rond se pose partout.
#
#  ── POURQUOI EN `data:` ET PAS EN FICHIERS SERVIS ──────────────────
#
#  Une infobulle vit dans un message collé, et un message collé ne se
#  réécrit pas. Dix-huit adresses en dur voudraient dire réécrire les
#  messages de tous les joueurs le jour d'un changement d'hébergeur —
#  c'est le raisonnement déjà tenu pour les badges d'arène.
#
#  En `data:`, l'adresse n'existe pas : l'icône est dans la feuille,
#  qui se remplace en un endroit. Zéro requête réseau, ce qui est la
#  règle de `02-socle.css`, et l'icône s'affiche à l'instant où la
#  carte est collée, sans attendre le moindre script.
#
#  Les PNG sont quand même écrits dans `img/types/` : c'est la source
#  de la feuille, et une feuille produite dont on n'a pas la source
#  n'est pas relisable.
#
#  ── LES BADGES D'ARÈNE SUIVENT LE MÊME CHEMIN ──────────────────────
#
#  « Les badges ne s'affichent pas dans la trainer card », 30 octobre.
#  Ils ne s'affichaient pas parce que rien ne les affichait : le code
#  collé ne porte que `data-wm-badge="arene-pyrite"`, volontairement,
#  pour qu'aucune adresse ne soit figée dans un message. Mais j'avais
#  laissé l'image à un script qui n'existe pas encore, et une case
#  vide en attendant.
#
#  La même réponse qu'aux types règle les deux : la feuille porte
#  l'image. Les badges sont des SVG — nos propres dessins, pas ceux
#  des jeux — et un SVG de mille cinq cents octets passe en `data:`
#  sans peser, tout en restant net à n'importe quelle taille.
#
#  ── LA LICENCE ─────────────────────────────────────────────────────
#
#  Même posture que pour les sprites de Pokémon (planche 54) : le
#  dépôt PokeAPI est en CC0, et son fichier dit explicitement que les
#  images restent « Copyright The Pokémon Company ». Le CC0 couvre la
#  compilation, pas les images. Héberger un glyphe découpé n'est ni
#  plus ni moins exposé que de pointer le gif d'un Pokémon : c'est de
#  l'usage amateur, comme tout forum RPG Pokémon.
# ════════════════════════════════════════════════════════════════════

import base64
import json
import pathlib
import subprocess

from PIL import Image, ImageDraw

R = pathlib.Path(__file__).resolve().parent.parent

#  Le même commit épinglé que les sprites, lu et pas recopié.
COUVERTURE = json.loads((R / "data/sprites-couverture.json").read_text())
COMMIT = COUVERTURE["commit"]
BASE = f"https://raw.githubusercontent.com/PokeAPI/sprites/{COMMIT}/sprites/types"
JEU = "generation-ix/scarlet-violet"

#  L'ORDRE EST CELUI DE POKÉAPI, et les clés sont les nôtres — celles
#  de `especes-fiches.json` et des jetons `--wm-type-<cle>-fond`.
TYPES = [
    (1, "normal"), (2, "combat"), (3, "vol"), (4, "poison"),
    (5, "sol"), (6, "roche"), (7, "insecte"), (8, "spectre"),
    (9, "acier"), (10, "feu"), (11, "eau"), (12, "plante"),
    (13, "electrik"), (14, "psy"), (15, "glace"), (16, "dragon"),
    (17, "tenebres"), (18, "fee"),
]

#  Relevé, pas choisi : voir l'en-tête.
FENETRE = (10, 0, 50, 40)
COTE = 40


def rond(im: Image.Image) -> Image.Image:
    """Masque le carré en rond, bords adoucis."""
    #  Le masque est tracé à 4× puis réduit : un cercle tracé
    #  directement à 40 px a un bord en escalier qui se voit sur un
    #  fond crème.
    m = Image.new("L", (COTE * 4, COTE * 4), 0)
    ImageDraw.Draw(m).ellipse((0, 0, COTE * 4 - 1, COTE * 4 - 1), fill=255)
    m = m.resize((COTE, COTE), Image.LANCZOS)
    sortie = Image.new("RGBA", (COTE, COTE), (0, 0, 0, 0))
    sortie.paste(im, (0, 0), m)
    return sortie


#  ── LES ONZE BADGES : SEPT ARÈNES ET QUATRE COLOSSEUMS ─────────────
#
#  TROISIÈME ÉTAT DE CETTE LISTE, et les deux premiers étaient faux.
#  La planche « Mon jeu » en dessinait huit avec des noms inventés ;
#  j'ai ensuite écrit onze arènes nommées par type, en croyant que
#  les onze images de Callista étaient onze arènes.
#
#  La vérité était déjà écrite dans `forumactif/36` et dans
#  `forumactif/82`, et l'arborescence du forum la confirme :
#  **sept arènes, quatre colosseums.** Les quatre colosseums sont
#  Fée, Spectre, Électrik et Dragon — Callista l'a dit, et la
#  description de `f22-colosseum-de-titanite` sur le forum le
#  confirme pour le dragon : « le champion de type dragon. Dernier de
#  la liste ».
#
#  Deux images portaient donc un nom faux : `combat.png` est le
#  double chevron bleu roi sur argent, c'est le DRAGON ; `sol.png`
#  est le rocher facetté ocre sur or, c'est la ROCHE. Renommées.
#
#  L'ORDRE COMPTE, et il est imposé : on ne peut pas faire les arènes
#  dans le désordre (`forumactif/36`). C'est l'ordre de cette liste,
#  et c'est aussi celui dans lequel la carte dresseur les affiche.
#
#  On distingue les deux familles à l'œil sans rien lire : or jaune
#  et liseré simple pour les arènes, argent patiné et double liseré
#  pour les colosseums, où l'on combat à deux contre deux.
#
#  LES CLÉS SONT DES TYPES, pas des lieux. Les onze types sont tous
#  distincts, donc aucun préfixe n'est nécessaire, et un colosseum
#  qui déménagerait de ville ne casserait rien.
LES_SEPT_ARENES = [
    ("feu", "Feu", "Station Service"),
    ("plante", "Plante", "Samaragd"),
    ("eau", "Eau", "Port-Amarée"),
    ("acier", "Acier", "Suerebe"),
    ("roche", "Roche", "Pyrite"),
    ("vol", "Vol", "Tour Titanite"),
    ("tenebres", "Ténèbres", "Île Ténèbra"),
]
LES_QUATRE_COLOSSEUMS = [
    ("fee", "Fée", "Rhode"),
    ("spectre", "Spectre", "Phenacit"),
    ("electrik", "Électrik", "Targare"),
    ("dragon", "Dragon", "Titanite"),
]


def planche() -> str:
    """La planche de jugement : les onze à deux tailles, deux fonds.

    Elle existait, écrite par `outils/badges.py`, et elle est partie
    avec lui — elle nommait des fichiers qui n'existent plus. Elle
    revient ici parce que c'est le seul endroit qui connaît les onze
    clés : une planche écrite à la main dériverait de la liste au
    premier badge ajouté.

    Son objet n'a pas changé : « la lisibilité à 48 px. Réduire
    l'image à la taille d'un ongle — si le symbole devient une tache,
    l'émail est trop détaillé. C'est la seule taille à laquelle ces
    badges seront vus. »
    """
    def rangee(taille: int) -> str:
        return "".join(
            f'<figure><img src="../img/badges/{cle}.png" width="{taille}" '
            f'height="{taille}" alt="{nom}" /><figcaption>{nom}</figcaption>'
            f"</figure>"
            for cle, nom, _ in LES_SEPT_ARENES + LES_QUATRE_COLOSSEUMS
        )

    return (
        "<!doctype html>\n<html lang=\"fr\"><meta charset=\"utf-8\" />\n"
        "<title>Les onze badges de Rhode</title>\n"
        "<style>\n"
        "  body { margin: 0; font: 13px/1.5 system-ui, sans-serif; }\n"
        "  section { padding: 28px; }\n"
        "  .clair { background: #f6ece2; color: #4e3b30; }\n"
        "  .sombre { background: #1b1411; color: #f2e4d8; }\n"
        "  h2 { margin: 0 0 18px; font-size: 14px; letter-spacing: .08em;\n"
        "       text-transform: uppercase; opacity: .7; }\n"
        "  .rangee { display: flex; flex-wrap: wrap; gap: 20px;\n"
        "            align-items: flex-end; margin-bottom: 28px; }\n"
        "  figure { margin: 0; text-align: center; }\n"
        "  figcaption { margin-top: 6px; font-size: 11px; opacity: .65; }\n"
        "</style>\n"
        '<section class="clair"><h2>Sur fond clair — 48 px</h2>\n'
        f'<div class="rangee">{rangee(48)}</div>\n'
        "<h2>Sur fond clair — 96 px</h2>\n"
        f'<div class="rangee">{rangee(96)}</div></section>\n'
        '<section class="sombre"><h2>Sur fond sombre — 48 px</h2>\n'
        f'<div class="rangee">{rangee(48)}</div>\n'
        "<h2>Sur fond sombre — 96 px</h2>\n"
        f'<div class="rangee">{rangee(96)}</div></section>\n'
        "</html>\n"
    )


def badges() -> str:
    """Les onze badges, en PNG encodé.

    Les images sont celles du forum, envoyées par Callista. Elles
    sont rognées au dessin puis recentrées dans un carré : les onze
    n'ont pas les mêmes marges transparentes, et sans ce recadrage un
    badge paraîtrait plus petit que son voisin dans la même case.

    EN PNG ET PAS EN SVG, parce que ce sont des PNG : ce sont des
    dessins peints, pas des formes vectorielles, et les revectoriser
    serait les redessiner.

    LES VINGT-DEUX FICHIERS QUI TRAÎNAIENT SONT PARTIS le 31 octobre.
    `img/badges/` portait encore mes sept arènes nommées par ville et
    mes quatre colosseums, en PNG et en SVG, plus `outils/badges.py`
    qui les redessinait. Ils étaient décrits comme « le repli si une
    image venait à manquer » : ils ne pouvaient plus l'être, puisque
    pas un seul ne porte une des onze clés d'aujourd'hui. Un repli
    qui ne répond pas est un fichier qui ment.

    Et le dossier `arenes/` a disparu avec eux : il contenait quatre
    colosseums.
    """
    regles = ["""
/* ── LES BADGES : SEPT ARÈNES, QUATRE COLOSSEUMS ──────────────────── */"""]
    for cle, _, _lieu in LES_SEPT_ARENES + LES_QUATRE_COLOSSEUMS:
        octets = (R / f"img/badges/{cle}.png").read_bytes()
        b64 = base64.b64encode(octets).decode()
        regles.append(
            f'#modernbb [data-wm-badge="{cle}"] {{\n'
            f'  background-image: url("data:image/png;base64,{b64}");\n'
            f"}}"
        )
    return "\n\n".join(regles) + "\n"


def main() -> None:
    dossier = R / "img/types"
    dossier.mkdir(parents=True, exist_ok=True)
    regles = []
    poids = 0

    for ident, cle in TYPES:
        brut = dossier / f"_{cle}.brut.png"
        subprocess.run(
            ["curl", "-sS", "--fail", "-o", str(brut), f"{BASE}/{JEU}/{ident}.png"],
            check=True,
        )
        im = Image.open(brut).convert("RGBA").crop(FENETRE)
        if im.size != (COTE, COTE):
            raise SystemExit(f"{cle} : découpe {im.size}, attendu {(COTE, COTE)}")
        icone = rond(im)
        fichier = dossier / f"{cle}.png"
        icone.save(fichier, optimize=True)
        brut.unlink()

        octets = fichier.read_bytes()
        poids += len(octets)
        b64 = base64.b64encode(octets).decode()
        regles.append(
            #  LE SÉLECTEUR NE NOMME PLUS L'INFOBULLE. Le glyphe sert
            #  aussi à la pastille d'une case d'équipe depuis le
            #  30 octobre au soir — « tu as bien affiché les types
            #  dans l'infobulle mais pas dans le perso ». Deux jeux de
            #  dix-huit règles pour les mêmes images seraient deux
            #  jeux à tenir d'accord. C'est l'attribut qui décide, et
            #  il est à nous.
            f'#modernbb [data-wm-type="{cle}"]::before {{\n'
            f'  background-image: url("data:image/png;base64,{b64}");\n'
            f"}}"
        )

    feuille = f"""/* ════════════════════════════════════════════════════════════════════
   20 · LES ICÔNES DE TYPE — PRODUIT PAR outils/types-sprites.py

   NE PAS MODIFIER À LA MAIN. Pour changer une icône, change l'outil
   et relance-le : une retouche faite ici serait écrasée au prochain
   passage.

   Les dix-huit glyphes sont découpés dans les badges
   `{JEU}` de PokeAPI/sprites, commit
   {COMMIT},
   fenêtre x ∈ [{FENETRE[0]}, {FENETRE[2]}] — la seule qui contienne
   tout glyphe et aucune lettre sur les dix-huit —, puis masqués en
   rond. Les sources sont dans `img/types/`.

   EN `data:` ET PAS EN ADRESSES. Une infobulle vit dans un message
   collé, et un message collé ne se réécrit pas : dix-huit adresses en
   dur voudraient dire réécrire les messages de tous les joueurs le
   jour d'un changement d'hébergeur. Ici l'adresse n'existe pas, et
   l'icône s'affiche sans la moindre requête.
   ════════════════════════════════════════════════════════════════════ */

/*  CE FICHIER NE PORTE QUE DES IMAGES. La forme des pastilles et des
    cases — taille, place, cadre — est écrite à la main dans
    `13-composants.css` § 17 et `18-carte-dresseur.css` § 5. Une
    feuille produite où se glisseraient des règles de mise en page
    serait une feuille qu'on aurait envie de retoucher, et toute
    retouche y est perdue au passage suivant. */

{chr(10).join(regles)}
"""

    feuille += badges()
    (R / "css/20-icones.css").write_text(feuille)
    planche_html = planche()
    (R / "outils/planche-des-badges.html").write_text(planche_html)
    print(f"   img/types/ — {len(TYPES)} icônes, {poids} octets au total")
    print(f"   css/20-icones.css — {len(feuille)} octets")
    print(
        f"   outils/planche-des-badges.html — "
        f"{len(LES_SEPT_ARENES) + len(LES_QUATRE_COLOSSEUMS)} badges, "
        f"deux tailles, deux fonds"
    )


if __name__ == "__main__":
    main()
