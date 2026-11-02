#!/usr/bin/env python3
# ════════════════════════════════════════════════════════════════════
#  outils/minifier-le-code.py — un code de fiche, prêt à coller
#
#  Lancement :  python3 outils/minifier-le-code.py templates/carte-*.html
#               python3 outils/minifier-le-code.py --tout
#
#  ── POURQUOI ────────────────────────────────────────────────────────
#
#  Les fichiers `templates/carte-dresseur.*.html` sont écrits pour être
#  RELUS : commentaires, indentation, une balise par ligne. C'est ce
#  qu'il faut pour les tenir, et c'est exactement ce qu'il ne faut pas
#  coller dans un message.
#
#  Un joueur qui copie du HTML indenté dans l'éditeur Forumactif voit
#  l'éditeur transformer une partie des retours à la ligne en <br />,
#  et la carte sort trouée d'espaces. Une seule ligne ne lui laisse
#  rien à transformer.
#
#  ── CE QU'ON NE FAIT PAS ───────────────────────────────────────────
#
#  On ne touche ni aux noms de classes, ni aux attributs, ni à l'ordre.
#  Ce n'est pas un minifieur de HTML : c'est un dégraissage. Les seules
#  choses retirées sont les commentaires et les blancs ENTRE balises —
#  jamais un blanc à l'intérieur d'un texte, qui se verrait.
# ════════════════════════════════════════════════════════════════════

import argparse
import sys
import pathlib
import re

R = pathlib.Path(__file__).resolve().parent.parent


def degraisser(html: str) -> str:
    #  Les commentaires d'abord : ils contiennent des balises
    #  d'exemple, et les traiter après ferait sortir ces exemples.
    sans = re.sub(r"<!--[\s\S]*?-->", "", html)
    #  ── UNE ESPACE, PAS ZÉRO ────────────────────────────────────
    #
    #  Premier jet : tout blanc touchant une balise disparaissait.
    #  C'était plus court et c'était faux. Entre deux éléments EN
    #  LIGNE, l'espace qui les sépare est du rendu : « TON PERSONNAGE
    #  » et « Dresseur nº 0000 » se recollaient en un seul mot. Le
    #  harnais l'a vu en comparant les textes des deux versions.
    #
    #  Dans la carte dresseur, les conteneurs sont tous en flex, où
    #  un nœud de texte entièrement blanc est ignoré — ça n'aurait
    #  rien cassé. Mais cet outil servira au prochain code de fiche,
    #  qui ne sera pas forcément en flex, et une règle qui ne marche
    #  que sur le cas d'aujourd'hui est une règle qui cassera.
    #
    #  On réduit donc tout blanc à UNE espace. Le gros du poids était
    #  dans les commentaires de toute façon.
    return re.sub(r"\s+", " ", sans).strip()


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("fichiers", nargs="*", help="les gabarits à dégraisser")
    ap.add_argument("--tout", action="store_true", help="tous les codes de fiche")
    args = ap.parse_args()

    cibles = [pathlib.Path(f) for f in args.fichiers]
    if args.tout or not cibles:
        cibles = sorted(
            f for f in (R / "templates").glob("carte-dresseur.*.html")
            if ".min." not in f.name
        )

    for f in cibles:
        if not f.exists():
            f = R / f
        brut = f.read_text()
        serre = degraisser(brut)
        #  `.a-coller.html` → `.a-coller.min.html`. On coupe les cinq
        #  caractères de `.html` et rien d'autre : `with_suffix` aurait
        #  pris `.a-coller` pour une extension et collé les deux
        #  fichiers sur le même nom de sortie — ce qu'il a fait.
        sortie = f.with_name(f.name[:-len(".html")] + ".min.html")
        sortie.write_text(serre + "\n")
        gain = 100 - round(100 * len(serre) / len(brut))
        print(
            f"   {sortie.relative_to(R)} — {len(serre)} octets "
            f"({len(brut)} au départ, −{gain} %)"
        )

        #  LE CODE À COLLER EST AUSSI UNE DONNÉE, depuis le 2 novembre.
        #  La relève publie la carte de chaque joueur dans son sujet, et
        #  elle a donc besoin du même gabarit — servi par GitHub Pages,
        #  comme tout ce qu'elle lit. Une copie dans `data/`, dérivée,
        #  plutôt qu'un second gabarit écrit en TypeScript : deux
        #  markups à tenir d'accord, c'est un markup qui dérive.
        if f.name == "carte-dresseur.a-coller.html":
            copie = R / "data" / "carte-a-coller.html"
            copie.write_text(serre + "\n")
            print(f"   {copie.relative_to(R)} — la même, pour la relève")


def verifier() -> int:
    """Relit la copie de `data/` sans rien écrire. Rend 1 si elle a dérivé."""
    source = R / "templates" / "carte-dresseur.a-coller.html"
    copie = R / "data" / "carte-a-coller.html"
    if not copie.exists():
        print(f"{copie.name} : absent.", file=sys.stderr)
        return 1
    attendu = degraisser(source.read_text()) + "\n"
    if copie.read_text() != attendu:
        print(
            f"{copie.name} : ne correspond plus au gabarit — relance "
            f"« python3 outils/minifier-le-code.py --tout » et commite.",
            file=sys.stderr,
        )
        return 1
    print(f"{copie.name} : {len(attendu)} octets, d'accord avec le gabarit.")
    return 0


if __name__ == "__main__":
    if "--verifier" in sys.argv:
        raise SystemExit(verifier())
    main()
