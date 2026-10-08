#!/usr/bin/env python3
# ════════════════════════════════════════════════════════════════════
#  outils/jetons.py
#
#  Le repli d'un `var()` doit dire la VÉRITÉ sur ce qu'il remplace.
#
#  ── CE QUE ÇA A COÛTÉ, LE 7 OCTOBRE ─────────────────────────────────
#
#  La page d'accueil affichait tous ses titres manuscrits en Fraunces.
#  La règle disait :
#
#      font-family: var(--wm-police-titre, "Kaushan Script", cursive);
#
#  Le repli dit Kaushan Script, donc la relecture dit « manuscrit ». Mais
#  `--wm-police-titre` VAUT Fraunces — c'est `--wm-police-accent` qui est
#  la Kaushan. Le repli ne sert que si `jetons.css` n'est pas servi, donc
#  il ne s'affichait jamais : il ne faisait que mentir au relecteur.
#  Callista l'a vu à l'écran ; moi, trois fois, non.
#
#  Même erreur dans `15-messenger.css`. Et en passant le peigne, 185
#  autres replis qui ne correspondaient plus à leur jeton — surtout les
#  cinq couleurs reprises après les mesures de contraste.
#
#  ── POURQUOI UN REPLI PÉRIMÉ COMPTE, ALORS QU'IL NE S'AFFICHE PAS ───
#
#  Deux raisons, et la seconde est la vraie.
#
#  1. Il s'affiche quand même, une fois : si Callista recolle une
#     ancienne version de `jetons.css`, ou si le panneau d'administration
#     perd la feuille, c'est le repli qui sort. Il doit être juste.
#
#  2. **Il se lit tout le temps.** Un repli est la seule valeur VISIBLE
#     dans le dépôt — les jetons, eux, vivent dans le panneau
#     d'administration (48-… §8). C'est donc lui qu'on lit pour savoir
#     de quelle couleur ou de quelle police on parle, et un repli faux
#     fait relire une règle juste comme si elle était fausse, ou
#     l'inverse. C'est exactement ce qui s'est passé.
#
#  ── CE QUE LA RÈGLE NE FAIT PAS ─────────────────────────────────────
#
#  Elle ne dit pas qu'on a choisi le BON jeton — `--wm-police-titre` est
#  un jeton parfaitement valide pour un titre manuscrit, du point de vue
#  d'un script. Elle dit seulement que le repli et le jeton racontent la
#  même chose, et c'est ce qui rend l'erreur visible à la relecture.
#
#  Deux jetons sont posés à l'exécution par le navigateur et non par la
#  charte : ils sont nommés, et ignorés.
#
#  Usage :
#      python3 outils/jetons.py --verifier   (garde-fou)
#      python3 outils/jetons.py --aligner    réécrit les replis
# ════════════════════════════════════════════════════════════════════

import pathlib
import re
import sys

RACINE = pathlib.Path(__file__).resolve().parent.parent
JETONS = RACINE / "panneau-admin" / "jetons.css"
FEUILLES = "[0-9][0-9]-*.css"

#  Posés par `module-navigation.ts` et `module-accueil.ts` au moment où
#  ils mesurent la page. Ils n'ont pas de valeur de charte, et leur repli
#  est ce qui s'applique avant la mesure — il est donc juste par
#  construction.
HORS_CHARTE = {
    "--wm-haut-toolbar",
    "--wm-accueil-fond",
    "--wm-bec",
    #  La largeur de la composition de l'accueil et le facteur qui la
    #  fait tenir : la première est une cote de la feuille 14 et pas une
    #  valeur de charte, le second est MESURÉ à chaque redimensionnement
    #  par `module-accueil.ts`. Aucun des deux n'a sa place dans le
    #  panneau d'administration — on ne règle pas une échelle à la main.
    "--wm-accueil-largeur",
    "--wm-accueil-echelle",
    #  La hauteur du bloc de la carte : c'est la hauteur du repère de
    #  `data/carte.json`, pas une valeur de charte. La régler à la main
    #  dans le panneau désaccorderait le cadre et le dessin qu'il tient.
    "--wm-carte-hauteur",
    #  Le taux de mélange d'une bande de mer : POSÉ PAR LE MODULE sur
    #  chaque bande, parce que lui seul sait combien il y en a. Une
    #  valeur de charte ne saurait pas le dire.
    "--wm-mer-melange",
    #  La couleur des bandes de part et d'autre de la carte peinte :
    #  elle est RELEVÉE SUR L'IMAGE, pas choisie. Changer l'image
    #  change cette valeur, et aucune charte ne peut le prévoir.
    "--wm-carte-marge-peinte",
    #  L'image d'en-tête du panneau de la carte, posée EN LIGNE par
    #  `module-carte.ts` depuis `data/carte.json`. Elle n'existe nulle
    #  part en feuille : son repli est le bandeau des catégories.
    "--wm-carte-image",
}

#  ── CEUX DONT LE REPLI NE PEUT PAS DIRE LA VÉRITÉ ───────────────────
#
#  Une catégorie à part, et une seule entrée pour l'instant.
#
#  `--wm-bandeau-categorie` vaut `url(…)`. Recopier cette valeur en
#  repli dans `css/03-index.css` ferait partir une requête réseau d'une
#  de nos feuilles — ce que le garde-fou n° 10 interdit, et pour une
#  bonne raison : une feuille qui va chercher une image ailleurs est
#  une feuille qui casse quand l'ailleurs tombe.
#
#  Les deux règles ne peuvent donc pas être satisfaites ensemble, et
#  c'est la dixième qui gagne : le repli est `none`, la bande garde son
#  dégradé, et le titre reste lisible. Ce n'est pas un repli qui ment —
#  c'est un repli qui dit « pas d'image », ce qui est exactement l'état
#  des lieux quand `jetons.css` n'est pas servi.
SANS_REPLI_POSSIBLE = {"--wm-bandeau-categorie"}

#  Un `var()` avec repli, le repli pouvant lui-même contenir une
#  parenthèse (`color-mix(…)`), mais pas deux niveaux.
APPEL = re.compile(r"var\(\s*(--wm-[a-z0-9-]+)\s*,([^()]*(?:\([^()]*\)[^()]*)*)\)")

#  LES COMMENTAIRES NE SONT PAS DU CODE, et ces feuilles en sont
#  pleines : la règle a d'abord grondé sur sa propre explication, qui
#  cite le `var()` qu'elle venait de faire supprimer. On les blanchit
#  en gardant les retours à la ligne, pour que les numéros tiennent.
COMMENTAIRE = re.compile(r"/\*.*?\*/", re.S)


def sans_commentaires(texte: str) -> str:
    return COMMENTAIRE.sub(lambda m: re.sub(r"[^\n]", " ", m.group(0)), texte)


def charte() -> dict[str, str]:
    """Les jetons du thème CLAIR, et eux seuls.

    Un repli sert quand `jetons.css` n'est pas servi du tout : il n'y a
    alors ni `:root` ni `body.wm-sombre`, donc c'est la valeur claire
    qu'il doit porter. Lire le fichier entier prendrait la valeur sombre
    pour chaque jeton redéclaré — soit la moitié d'entre eux.
    """
    texte = JETONS.read_text(encoding="utf-8").split("body.wm-sombre")[0]
    return {
        m.group(1): re.sub(r"\s+", " ", m.group(2).strip())
        for m in re.finditer(r"(--wm-[a-z0-9-]+)\s*:\s*([^;]+);", texte)
    }


def ecarts(aligner: bool) -> list[str]:
    connus = charte()
    trouves: list[str] = []
    for feuille in sorted((RACINE / "css").glob(FEUILLES)):
        texte = feuille.read_text(encoding="utf-8")
        #  On CHERCHE dans la version blanchie et on RÉÉCRIT l'originale.
        #  Blanchir remplace caractère pour caractère, donc les positions
        #  des deux textes coïncident — c'est ce qui rend l'échange sûr.
        code = sans_commentaires(texte)
        morceaux: list[tuple[int, int, str]] = []
        for m in APPEL.finditer(code):
            nom, repli = m.group(1), re.sub(r"\s+", " ", m.group(2).strip())
            if nom in HORS_CHARTE or nom in SANS_REPLI_POSSIBLE:
                continue
            ligne = code.count("\n", 0, m.start()) + 1
            if nom not in connus:
                trouves.append(
                    f"{feuille.name}:{ligne}  {nom} n'existe pas dans jetons.css — "
                    f"le repli « {repli} » est la seule valeur qui s'applique"
                )
                continue
            if repli == connus[nom]:
                continue
            trouves.append(
                f"{feuille.name}:{ligne}  {nom}\n"
                f"      repli   : {repli}\n"
                f"      déclaré : {connus[nom]}"
            )
            morceaux.append((m.start(), m.end(), f"var({nom}, {connus[nom]})"))

        if aligner and morceaux:
            for debut, fin, neuf in reversed(morceaux):
                texte = texte[:debut] + neuf + texte[fin:]
            feuille.write_text(texte, encoding="utf-8")
    return trouves


def main() -> int:
    if "--aligner" in sys.argv:
        avant = ecarts(aligner=True)
        print(f"   jetons : {len(avant)} repli(s) remis d'accord avec jetons.css")
        return 0
    if "--verifier" not in sys.argv:
        print("voir l'en-tête du fichier", file=sys.stderr)
        return 2
    mauvais = ecarts(aligner=False)
    if mauvais:
        print(
            f"{len(mauvais)} repli(s) ne disent pas la même chose que jetons.css —\n"
            "   « python3 outils/jetons.py --aligner » les remet d'accord",
            file=sys.stderr,
        )
        for e in mauvais[:20]:
            print("   " + e, file=sys.stderr)
        if len(mauvais) > 20:
            print(f"   … et {len(mauvais) - 20} autre(s)", file=sys.stderr)
        return 1
    combien = sum(
        len(APPEL.findall(sans_commentaires(f.read_text(encoding="utf-8"))))
        for f in (RACINE / "css").glob(FEUILLES)
    )
    print(f"   jetons : {combien} replis, tous d'accord avec jetons.css")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
