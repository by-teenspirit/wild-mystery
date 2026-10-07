#!/usr/bin/env python3
# ════════════════════════════════════════════════════════════════════
#  outils/specificite.py
#
#  Chaque sélecteur de `css/` commence par `#modernbb`.
#
#  ── CE QUE ÇA A COÛTÉ, LE 7 OCTOBRE ─────────────────────────────────
#
#  La page d'accueil ne ressemblait pas à la maquette, et personne ne
#  voyait pourquoi : la feuille était juste, elle était servie, ses
#  règles étaient là. Elles PERDAIENT.
#
#  Le bloc d'accueil vit dans le message d'accueil, donc dans
#  `.content`, et `10-ltr.css` y pose :
#
#      .content h2, .panel h2 { font-family: Roboto, sans-serif }
#
#  0-1-1 contre `.wm-accueil__titre` à 0-1-0. Mesuré sur le forum réel
#  en injectant la feuille préfixée et en comparant les styles
#  calculés : 260 propriétés changeaient. Les titres, les tailles de
#  corps, la couleur des liens, les 40 px de retrait des `ul`, et 200 px
#  de hauteur en trop sur le bloc entier.
#
#  ── L'ERREUR DE RAISONNEMENT, QUI EST LA VRAIE LEÇON ────────────────
#
#  Les onze feuilles qui habillent le balisage de ModernBB portaient le
#  préfixe depuis le début : on savait qu'on lui disputait ses règles.
#  Les trois qui posent NOTRE balisage — 10, 12, 14 — ne l'avaient pas,
#  parce que « c'est à nous, rien ne peut entrer en collision ».
#
#  C'est faux dès que notre balisage est posé DANS une zone que le thème
#  habille. Le coin d'outils est hors de `.content`, donc ça tenait ;
#  l'accueil y est, donc ça cassait. La distinction qui comptait n'était
#  pas « à qui appartient la classe » mais « où le nœud atterrit » — et
#  ça, on ne le sait qu'à l'exécution.
#
#  Donc tout est préfixé, sans exception à juger au cas par cas.
#
#  ── CE QUE LA RÈGLE LAISSE PASSER, ET POURQUOI ──────────────────────
#
#  `html`, `body`, `:root` et les `@media`/`@keyframes` : un préfixe y
#  serait faux, `#modernbb` EST le `body`. Un sélecteur qui commence par
#  `body` ou `html` porte donc déjà sa propre racine.
#
#  Usage :
#      python3 outils/specificite.py --verifier   (garde-fou)
# ════════════════════════════════════════════════════════════════════

import pathlib
import re
import sys

RACINE = pathlib.Path(__file__).resolve().parent.parent
FEUILLES = "[0-9][0-9]-*.css"

#  `#modernbb` est le `body` : ces racines-là le portent déjà, ou n'ont
#  pas de nœud à cibler du tout.
RACINES = ("#modernbb", ":root", "html", "body")

COMMENTAIRE = re.compile(r"/\*.*?\*/", re.S)
#  Un bloc de règle : ce qui précède une `{`, sans accolade, sans `@` et
#  sans `;` (qui termine une déclaration ou un `@import`).
REGLE = re.compile(r"(?:^|\}|\{|;)([^{}@;]+)\{")


def sans_commentaires(texte: str) -> str:
    """Blanchit les commentaires en gardant les retours à la ligne, pour
    que les numéros de ligne restent justes."""
    return COMMENTAIRE.sub(lambda m: re.sub(r"[^\n]", " ", m.group(0)), texte)


def separer(liste: str) -> list[str]:
    """Coupe sur les virgules DE PREMIER NIVEAU.

    `str.split(",")` coupait au milieu de `:is(.forabg, .forumbg, …)` et
    rendait `.forumbg` comme un sélecteur à part entière : vingt fausses
    alertes sur `02-socle`, qui est pourtant préfixée de bout en bout.
    """
    morceaux, courant, profondeur = [], [], 0
    for c in liste:
        if c == "(":
            profondeur += 1
        elif c == ")":
            profondeur -= 1
        if c == "," and profondeur == 0:
            morceaux.append("".join(courant))
            courant = []
        else:
            courant.append(c)
    morceaux.append("".join(courant))
    return [m.strip() for m in morceaux]


def nus(feuille: pathlib.Path) -> list[str]:
    code = sans_commentaires(feuille.read_text(encoding="utf-8"))
    trouves = []
    for m in REGLE.finditer(code):
        brut = m.group(1)
        if brut.strip() == "":
            continue
        ligne = code.count("\n", 0, m.start(1)) + 1
        for s in separer(brut):
            #  Une étape de `@keyframes` : `from`, `to`, `50%`.
            if s == "" or s.endswith("%") or s in ("from", "to"):
                continue
            if not s.startswith(RACINES):
                trouves.append(f"{feuille.name}:{ligne}  {s[:70]}")
    return trouves


def main() -> int:
    if "--verifier" not in sys.argv:
        print("voir l'en-tête du fichier", file=sys.stderr)
        return 2
    mauvais, combien = [], 0
    for f in sorted((RACINE / "css").glob(FEUILLES)):
        mauvais += nus(f)
        combien += len(REGLE.findall(sans_commentaires(f.read_text(encoding="utf-8"))))
    if mauvais:
        print(
            f"{len(mauvais)} sélecteur(s) sans racine — ModernBB les bat dès que\n"
            "   son propre sélecteur est plus précis, et ça ne se voit qu'à l'écran",
            file=sys.stderr,
        )
        for e in mauvais[:20]:
            print("   " + e, file=sys.stderr)
        if len(mauvais) > 20:
            print(f"   … et {len(mauvais) - 20} autre(s)", file=sys.stderr)
        return 1
    print(f"   spécificité : {combien} règles, toutes sous #modernbb")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
