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


def badges() -> str:
    """Les onze badges d'arène, en PNG encodé.

    ── CE QU'ILS SONT VRAIMENT, RELEVÉ LE 31 OCTOBRE ────────────────

    Les sept premiers badges du dépôt portaient des noms de LIEU —
    `arene-station-service`, `arene-samaragd`, `arene-port-amaree` —
    pris des annexes de 2026. Le forum, lu dans le navigateur de
    Callista, dit autre chose : ses récompenses s'appellent
    « Badge - Arène Feu », « Badge - Arène Plante », « Badge - Arène
    Eau », « Badge - Arène Acier ». **Les arènes sont nommées par
    TYPE, pas par ville**, et il y en a onze, pas sept.

    Les images sont celles du forum, envoyées par Callista. Elles
    sont rognées au dessin puis recentrées dans un carré : les onze
    n'ont pas les mêmes marges transparentes, et sans ce recadrage un
    badge paraîtrait plus petit que son voisin dans la même case.

    EN PNG ET PAS EN SVG, parce que ce sont des PNG : ce sont des
    dessins peints, pas des formes vectorielles, et les revectoriser
    serait les redessiner.
    """
    LES_ONZE = [
        ("acier", "Acier"), ("combat", "Combat"), ("eau", "Eau"),
        ("electrik", "Électrik"), ("fee", "Fée"), ("feu", "Feu"),
        ("plante", "Plante"), ("sol", "Sol"), ("spectre", "Spectre"),
        ("tenebres", "Ténèbres"), ("vol", "Vol"),
    ]
    #  LES QUATRE COLOSSEUMS, en SVG — ce sont nos dessins, ceux du
    #  dépôt. Callista n'a envoyé que les onze arènes ; le jour où
    #  elle donne les siens, ils rejoignent `img/badges/arenes/`.
    LES_QUATRE = ["rhode", "phenacit", "targare", "titanite"]
    regles = ["""
/* ── LES BADGES : ONZE ARÈNES, QUATRE COLOSSEUMS ──────────────────── */"""]
    for cle, _ in LES_ONZE:
        octets = (R / f"img/badges/arenes/{cle}.png").read_bytes()
        b64 = base64.b64encode(octets).decode()
        regles.append(
            f'#modernbb [data-wm-badge="{cle}"] {{\n'
            f'  background-image: url("data:image/png;base64,{b64}");\n'
            f"}}"
        )
    for cle in LES_QUATRE:
        svg = " ".join((R / f"img/badges/colosseum-{cle}.svg").read_text().split())
        for avant, apres in (
            ("%", "%25"), ("#", "%23"), ('"', "'"), ("<", "%3C"), (">", "%3E"),
        ):
            svg = svg.replace(avant, apres)
        regles.append(
            f'#modernbb [data-wm-badge="colosseum-{cle}"] {{\n'
            f'  background-image: url("data:image/svg+xml,{svg}");\n'
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
    print(f"   img/types/ — {len(TYPES)} icônes, {poids} octets au total")
    print(f"   css/20-icones.css — {len(feuille)} octets")


if __name__ == "__main__":
    main()
