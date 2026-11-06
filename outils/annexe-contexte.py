#!/usr/bin/env python3
# ════════════════════════════════════════════════════════════════════
#  outils/annexe-contexte.py — le corps de l'annexe 02
#
#  ── POURQUOI UN GÉNÉRATEUR POUR UNE PAGE DE TEXTE ───────────────────
#
#  Pas pour écrire le texte : il est de Callista, et il ne bouge pas.
#  Pour qu'il SURVIVE. Elle l'avait collé directement dans la page du
#  forum ; il n'existait nulle part dans le dépôt, et la page d'ici
#  portait encore le texte de remplissage du gabarit. La prochaine
#  passe de `annexes.py` aurait recollé le gabarit par-dessus son
#  travail — c'est exactement ce qui est arrivé au chapô de l'annexe 05
#  le 5 novembre, et la correction avait été la même : remonter le
#  texte à la source.
#
#  ── ON NE TOUCHE PAS AU TEXTE ───────────────────────────────────────
#
#  « Ne modifie pas notre texte » (6 novembre). Il a été relevé sur
#  `/h2-contexte` et recopié au caractère près — vérifié par empreinte
#  SHA-256, les onze blocs, avant et après : identiques. Ses trois
#  coquilles sont dedans, et elles y restent.
#
#  CE QUI A CHANGÉ EST LA MISE EN PAGE, pas les mots :
#
#    · « Rhode, 2026 » était un SEUL élément d'une liste à tirets, de
#      3 900 caractères — le premier bloc du gabarit, rempli tel quel.
#      Un tiret devant quatre écrans de récit. Il passe en paragraphes,
#      coupés là où elle avait posé ses `<br><br>`.
#
#    · La chronologie était un tableau. Elle passe dans la brique
#      `wm-chrono`, celle demandée le 6 novembre — « à gauche la date,
#      entre les deux un point et un trait qui relie tous les points,
#      et à droite les infos ».
#
#  ── LA DURÉE SE RECONNAÎT, ELLE NE S'ÉCRIT PAS ──────────────────────
#
#  Un moment qui s'étend — « 2011–2020 », « 2022 - 2026 » — prend une
#  capsule au lieu d'un rond. On le voit au tiret dans la date, et on
#  accepte les trois tirets qu'un clavier produit : le court, le demi-
#  cadratin et le cadratin. Écrire la classe à la main dans les données
#  demanderait de la tenir à jour à chaque date ajoutée.
# ════════════════════════════════════════════════════════════════════

import html
import json
import pathlib
import re
import sys

sys.path.insert(0, str(pathlib.Path(__file__).parent))
from annexes import (  # noqa: E402
    ARTWORK,
    DEBUT,
    DECORS,
    FIN,
    PAGES,
    chemin_de_la_page,
    entre_les_bornes,
    numero_de,
    pied_de_page,
    remplacer_le_corps,
)

R = pathlib.Path(__file__).resolve().parent.parent
SLUG = "contexte"
PAGE = chemin_de_la_page(SLUG)

#  Les trois tirets qu'un clavier produit. « 2011–2020 » est écrit au
#  demi-cadratin, « 2022 - 2026 » au tiret court entouré d'espaces : les
#  deux sont des durées, et aucun des deux ne doit dépendre de la façon
#  dont la date a été tapée.
TIRETS = re.compile(r"[-‐-―]")


def e(t):
    """Échappe. L'éditeur de pages de Forumactif DÉCODE les entités au
    collage : un `<` laissé nu finit en balise."""
    return html.escape(str(t), quote=True)


def une_duree(quand):
    """Une date qui porte un tiret couvre une période, pas un instant."""
    return TIRETS.search(quand) is not None


def corps():
    d = json.loads((R / "data/contexte.json").read_text(encoding="utf-8"))
    out = []
    w = out.append

    w(f"{DEBUT} — écrit par `outils/annexe-contexte.py` ▼▼▼ -->")
    photo, espece, _lieu = DECORS[SLUG]
    w(f"""<div class="wm-annexe" style="--annexe-fond: """
      f"""url('{PAGES}/assets/zones/{photo}.jpg'); """
      f"""--annexe-rendu: url('{ARTWORK}/{espece}.png')">""")
    w("")
    w('  <nav class="wm-annexe__sommaire" data-wm-sommaire aria-label="Les annexes"></nav>')
    w("")
    w('  <div class="wm-annexe__corps">')
    w('    <div class="wm-annexe__colonne">')
    w("")
    w(f'      <p class="wm-annexe__surtitre">Annexe {numero_de(SLUG)}</p>')
    w('      <h1 class="wm-annexe__titre">Le <em>contexte</em></h1>')
    w('      <p class="wm-annexe__chapo">')
    w(f'        {e(d["chapo"])}')
    w("      </p>")
    w("")
    w('      <div class="wm-annexe__blocs">')
    w("")

    # ── le récit ────────────────────────────────────────────────────
    r = d["recit"]
    w('        <div class="wm-annexe__carte">')
    w(f'          <h2 class="wm-annexe__carte-titre">{e(r["titre"])}</h2>')
    w('          <div class="wm-paras">')
    for para in r["paragraphes"]:
        #  LE TEXTE N'EST PAS ÉCHAPPÉ ICI, et c'est voulu : il porte les
        #  `<strong>` qu'elle a posés elle-même. Les retirer, ce serait
        #  modifier son texte ; les échapper les afficherait en toutes
        #  lettres. `data/contexte.json` est un fichier du dépôt, pas
        #  une saisie — la règle d'échappement vaut pour ce qui vient
        #  du dehors.
        w(f"            <p>{para}</p>")
    w("          </div>")
    w("        </div>")
    w("")

    # ── la chronologie ──────────────────────────────────────────────
    c = d["chronologie"]
    w('        <div class="wm-annexe__carte">')
    w('          <h2 class="wm-annexe__carte-titre '
      f'wm-annexe__carte-titre--grand">{e(c["titre"])}</h2>')
    w('          <ol class="wm-chrono">')
    for m in c["moments"]:
        classe = "wm-chrono__moment"
        if une_duree(m["quand"]):
            classe += " wm-chrono__moment--duree"
        w(f'            <li class="{classe}">')
        w(f'              <span class="wm-chrono__quand">{e(m["quand"])}</span>')
        w('              <div class="wm-chrono__quoi">')
        w(f'                <p>{e(m["quoi"])}</p>')
        w("              </div>")
        w("            </li>")
    w("          </ol>")
    w("        </div>")
    w("")

    # ── les deux encarts ────────────────────────────────────────────
    w('        <div class="wm-encarts">')
    for enc in d["encarts"]:
        w(f'          <div class="wm-encart wm-encart--{e(enc["ton"])}">')
        w('            <span class="wm-encart__etiquette">'
          f'{e(enc["etiquette"])}</span>')
        w(f'            <p>{e(enc["texte"])}</p>')
        w("          </div>")
    w("        </div>")
    w("")

    w(pied_de_page(SLUG))
    w("")
    w("      </div>")
    w("    </div>")
    w("  </div>")
    w("</div>")
    w(FIN)
    return "\n".join(out)


def main():
    if not PAGE.exists():
        raise SystemExit(f"{PAGE} n'existe pas — lance d'abord « deno task annexes »")

    ancien = PAGE.read_text(encoding="utf-8")
    if entre_les_bornes(ancien) is None:
        raise SystemExit(f"{PAGE.name} n'a pas ses bornes de corps")

    neuf = remplacer_le_corps(ancien, corps())
    if "--verifier" in sys.argv:
        if neuf != ancien:
            raise SystemExit(
                "annexe-02 : le corps ne correspond plus à data/contexte.json — "
                "lance « python3 outils/annexe-contexte.py »"
            )
        print(f"annexe-02 : à jour ({len(ancien)} caractères).")
        return 0

    PAGE.write_text(neuf, encoding="utf-8")
    print(f"annexe-02 écrite : {len(neuf)} caractères "
          "(limite Forumactif : 128 000).")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
