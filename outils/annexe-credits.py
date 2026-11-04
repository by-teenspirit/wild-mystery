#!/usr/bin/env python3
# ════════════════════════════════════════════════════════════════════
#  outils/annexe-credits.py — le corps de l'annexe 09
#
#  ── POURQUOI UN GÉNÉRATEUR POUR UNE PAGE DE REMERCIEMENTS ───────────
#
#  Parce qu'elle porte des NOMS DE PERSONNES, et qu'un nom mal écrit se
#  corrige à un seul endroit ou jamais. Le texte source écrit
#  « Plumyts » une fois et « Plumtys » une autre : la valeur vit dans
#  `data/credits.json`, une seule fois, et la page la reprend partout.
#
#  ── CE QUI NE SE RETIRE JAMAIS ──────────────────────────────────────
#
#  Le lien et le copyright Forumactif. Ils sont dans le pied du
#  gabarit, posé par `outils/annexes.py`, et cet outil-ci ne touche
#  qu'au corps — il ne peut donc pas les faire disparaître. C'est une
#  garantie de structure, pas une promesse.
# ════════════════════════════════════════════════════════════════════

import html
import json
import pathlib
import re
import sys

sys.path.insert(0, str(pathlib.Path(__file__).parent))
from annexes import (  # noqa: E402
    DEBUT,
    FIN,
    entre_les_bornes,
    pied_de_page,
    remplacer_le_corps,
)

R = pathlib.Path(__file__).resolve().parent.parent
PAGE = R / "pages" / "annexe-09-credits.html"
PAGES = "https://by-teenspirit.github.io/wild-mystery"
ARTWORK = (
    "https://raw.githubusercontent.com/PokeAPI/sprites/"
    "bfb75391935310368065096fa08c51e8970bc43e/sprites/pokemon/other/official-artwork"
)

#  LA SEULE BALISE AUTORISÉE DANS LA DONNÉE, et elle met en avant les
#  gens. Tout le reste est échappé : un `<` resté dans un nom
#  emporterait la moitié de la page, l'éditeur de Forumactif décodant
#  les entités au collage.
GRAS = re.compile(r"&lt;b&gt;(.+?)&lt;/b&gt;")


def riche(t, **valeurs):
    """Échappe, puis rend le gras — et lui seul."""
    return GRAS.sub(r"<b>\1</b>", html.escape(str(t).format(**valeurs), quote=True))


def e(t):
    return html.escape(str(t), quote=True)


def corps():
    c = json.loads((R / "data" / "credits.json").read_text(encoding="utf-8"))
    nom = c["fondatrice"]

    out = []
    w = out.append
    w(f"{DEBUT} — écrit par `outils/annexe-credits.py` ▼▼▼ -->")
    w('<div class="wm-annexe" style="--annexe-fond: url(\''
      f"{PAGES}/assets/zones/relique-sacree.jpg'); "
      f"--annexe-rendu: url('{ARTWORK}/251.png')\">")
    w("")
    w('  <nav class="wm-annexe__sommaire" data-wm-sommaire aria-label="Les annexes"></nav>')
    w("")
    w('  <div class="wm-annexe__corps">')
    w('    <div class="wm-annexe__colonne">')
    w("")
    w('      <p class="wm-annexe__surtitre">Annexe 09</p>')
    w('      <h1 class="wm-annexe__titre">Les <em>crédits</em></h1>')
    w(f'      <p class="wm-annexe__chapo">{riche(c["chapo"])}</p>')
    w("")
    w('      <div class="wm-annexe__blocs">')
    w("")

    for bloc in c["blocs"]:
        w('        <div class="wm-annexe__carte">')
        w(f'          <h2 class="wm-annexe__carte-titre">{e(bloc["titre"])}</h2>')
        if bloc.get("dit"):
            w('          <div class="wm-paras">')
            w(f"            <p>{riche(bloc['dit'], fondatrice=nom)}</p>")
            w("          </div>")
        #  ── LES PIÈCES EMPRUNTÉES, UNE PAR LIGNE ──────────────────
        #
        #  Un paragraphe les aurait noyées. En lignes, chaque auteur
        #  est à la même place et se trouve d'un coup d'œil — c'est
        #  tout ce qu'on demande à une page de crédits.
        if bloc.get("lignes"):
            w('          <ul class="wm-credits">')
            for quoi, qui in bloc["lignes"]:
                w('            <li class="wm-credit">')
                w(f'              <span class="wm-credit__quoi">{e(quoi)}</span>')
                w(f'              <span class="wm-credit__qui">{riche(qui)}</span>')
                w("            </li>")
            w("          </ul>")
        if bloc.get("paragraphes"):
            w('          <div class="wm-paras">')
            for para in bloc["paragraphes"]:
                w(f"            <p>{riche(para, fondatrice=nom)}</p>")
            w("          </div>")
        w("        </div>")
        w("")

    w('        <div class="wm-encarts">')
    w('          <div class="wm-encart wm-encart--terre">')
    w('            <span class="wm-encart__etiquette">Copyright</span>')
    w(f"            <p>{riche(c['copyright'])}</p>")
    w("          </div>")
    w("        </div>")
    w("")
    #  LE PIED VIENT DE `annexes.py`, pas d'ici. Il porte la page
    #  suivante et les deux boutons de contact : les mêmes sur les
    #  quatorze annexes, et `annexes.py` les refait de toute façon à la
    #  passe suivante. Deux versions du même bloc, c'est une version de
    #  trop — et `--verifier` crierait au premier écart.
    w(pied_de_page("credits"))
    w("")
    w("      </div>")
    w("    </div>")
    w("  </div>")
    w("</div>")
    w(FIN)
    return "\n".join(out)


def main():
    verifier = "--verifier" in sys.argv
    if not PAGE.exists():
        raise SystemExit(f"{PAGE} n'existe pas — lance d'abord « deno task annexes »")
    ancien = PAGE.read_text(encoding="utf-8")
    if entre_les_bornes(ancien) is None:
        raise SystemExit(f"{PAGE.name} n'a pas ses bornes de corps")
    neuf = remplacer_le_corps(ancien, corps())
    if verifier:
        if neuf != ancien:
            raise SystemExit(
                "annexe-09 : le corps ne correspond plus à data/credits.json — "
                "lance « python3 outils/annexe-credits.py »"
            )
        print(f"annexe-09 : à jour ({len(ancien)} caractères).")
        return
    PAGE.write_text(neuf, encoding="utf-8")
    print(f"annexe-09 écrite : {len(neuf)} caractères.")


if __name__ == "__main__":
    main()
