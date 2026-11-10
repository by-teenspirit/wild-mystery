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
    chemin_de_la_page,
    numero_de,
    pied_de_page,
    remplacer_le_corps,
)

R = pathlib.Path(__file__).resolve().parent.parent
PAGE = chemin_de_la_page("credits")
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
    w('      <p class="wm-annexe__surtitre">Annexe '
      f'{numero_de("credits")}</p>')
    w('      <h1 class="wm-annexe__titre">Les <em>crédits</em></h1>')
    w(f'      <p class="wm-annexe__chapo">{riche(c["chapo"])}</p>')
    w("")
    w('      <div class="wm-annexe__blocs">')
    w("")

    #  ── DEUX ONGLETS DEPUIS LE 10 NOVEMBRE ────────────────────────
    #
    #  « J'aimerais aussi afficher les différentes versions du forum
    #  depuis qu'on l'a ouvert […] je pense qu'on fera ça dans un 2e
    #  onglet dans cette annexe. »
    #
    #  LE MÉCANISME EST CELUI DE L'ANNEXE 06, à l'identique : un
    #  conteneur `[data-wm-sous-onglets]`, une `<section
    #  data-wm-sous-onglet>` par onglet, et `module-annexes.ts` fait
    #  la barre à partir du PREMIER titre de chaque section. Rien de
    #  nouveau à écrire côté script.
    #
    #  LES DEUX BLOCS DE CRÉDITS PASSENT DONC SOUS UN SEUL `<h2>`, et
    #  leurs titres descendent en `<h3>`. Laissés en `<h2>`, c'est le
    #  premier — « Le code » — qui aurait nommé l'onglet.
    #
    #  SANS JAVASCRIPT, LES DEUX SECTIONS SE SUIVENT l'une sous
    #  l'autre et tout se lit. C'est pour ça que la barre d'onglets
    #  n'est pas écrite dans la page : une rangée de boutons morts
    #  serait pire qu'une page longue.
    w('        <div class="wm-annexe__carte wm-sous-onglets" data-wm-sous-onglets>')
    w("")
    w('          <section data-wm-sous-onglet="les-credits">')
    w('            <h2 class="wm-annexe__carte-titre">Les crédits</h2>')
    w("")

    for bloc in c["blocs"]:
        w('        <div class="wm-credits-bloc">')
        w(f'          <h3 class="wm-defi__sous-titre">{e(bloc["titre"])}</h3>')
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

    w("          </section>")
    w("")

    #  ── LA FRISE DES VERSIONS ─────────────────────────────────────
    #
    #  « On a un sujet avec toutes les bannières, l'auteur des
    #  bannières, à quelle période on l'a fait. Parfois, pour certains
    #  designs, y'a une bannière. Des fois, y'en a plusieurs. »
    #
    #  C'EST LA PÉRIODE QUI ORDONNE, pas le nombre d'images. Une
    #  version à six bannières et une version à une seule sont deux
    #  entrées de même rang : la grille des bannières vit DANS la
    #  carte de sa version, et ne la fait pas compter double.
    #
    #  DE LA PLUS RÉCENTE À LA PLUS ANCIENNE, comme on relit un
    #  journal. L'ordre est celui de la donnée, pas un tri calculé —
    #  « août 2021 » et « décembre 2020 » ne se comparent pas sans
    #  écrire un analyseur de dates en français pour sept lignes.
    v = c["versions"]
    w('          <section data-wm-sous-onglet="les-versions">')
    w(f'            <h2 class="wm-annexe__carte-titre">{e(v["titre"])}</h2>')
    if v.get("dit"):
        w('            <div class="wm-paras">')
        w(f'              <p>{riche(v["dit"])}</p>')
        w("            </div>")
    w('            <ol class="wm-versions">')
    for ver in v["liste"]:
        bannieres = ver["bannieres"]
        #  `--plusieurs` et pas un calcul dans la feuille : une seule
        #  bannière prend toute la largeur, plusieurs se rangent en
        #  grille. Le CSS seul ne sait pas compter ses enfants.
        plus = " wm-versions__images--plusieurs" if len(bannieres) > 1 else ""
        w('              <li class="wm-version">')
        w('                <div class="wm-version__tete">')
        w(f'                  <h3 class="wm-version__nom">{e(ver["nom"])}</h3>')
        w('                  <p class="wm-version__quand">'
          f'{e(ver["quand"])}</p>')
        w("                </div>")
        w('                <p class="wm-version__par">'
          + " et ".join(f'<span class="wm-version__qui">{e(q)}</span>'
                        for q in ver["par"])
          + "</p>")
        w(f'                <div class="wm-versions__images{plus}">')
        for i, src in enumerate(bannieres, 1):
            #  L'ALTERNATIVE DIT CE QU'ON NE VOIT PAS. Une bannière
            #  n'est pas décorative ici : c'est l'objet même de la
            #  page. Son texte nomme donc le design et son rang.
            alt = (f'{ver["nom"]}, bannière {i} sur {len(bannieres)}'
                   if len(bannieres) > 1 else f'{ver["nom"]}, la bannière')
            w('                  <img class="wm-version__banniere" '
              f'src="{e(src)}" alt="{e(alt)}" loading="lazy" />')
        w("                </div>")
        w("              </li>")
    w("            </ol>")
    w("          </section>")
    w("")
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
