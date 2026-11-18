#!/usr/bin/env python3
# ════════════════════════════════════════════════════════════════════
#  outils/annexe-staff.py — le corps de l'annexe du staff
#
#  Demandé le 18 novembre : « préparer l'annexe de la présentation des
#  4 staffiens ».
#
#  ── UNE FICHE PAS ENCORE REMPLIE LE DIT ─────────────────────────────
#
#  `aConfirmer: true` écrit une marque VISIBLE sur la carte. Une page
#  qui se présente comme finie alors qu'elle ne l'est pas est pire
#  qu'une page visiblement en travaux : la première se colle et traîne
#  des mois, la seconde se finit.
#
#  Et une fiche VIDE devient un emplacement — « Cette place attend
#  quelqu'un » — plutôt qu'une carte sans nom : quatre cartes dont deux
#  blanches n'apprennent rien à un visiteur.
#
#  ── ON RÉEMPLOIE LES CARTES DE PERSONNAGES ──────────────────────────
#
#  `wm-perso` existe déjà pour l'annexe des célébrités : avatar à
#  gauche, nom, ligne grise qui situe, texte, étiquettes. C'est
#  exactement cette carte-là. Une seconde famille de classes pour le
#  même dessin voudrait dire deux feuilles à corriger le jour où elle
#  bouge. On laisse de côté le statut et la barre de filtres, qui ne
#  concernent que les personnages jouables.
# ════════════════════════════════════════════════════════════════════

import html
import json
import pathlib
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
SLUG = "staff"
PAGE = chemin_de_la_page(SLUG)


def e(t):
    return html.escape(str(t), quote=True)


def carte(w, fiche):
    vide = not fiche.get("pseudo")
    w('              <li class="wm-perso">')
    if fiche.get("avatar"):
        w(f'                <img class="wm-perso__avatar" src="{e(fiche["avatar"])}"'
          ' alt="" loading="lazy" />')
    else:
        w('                <span class="wm-perso__avatar wm-perso__avatar--vide"'
          ' aria-hidden="true"></span>')
    w('                <div class="wm-perso__corps">')

    if vide:
        w('                  <h3 class="wm-perso__nom">Cette place attend quelqu\'un</h3>')
        w('                  <p class="wm-perso__texte">Le staff recrute. Si tu as envie'
          " de donner un coup de main, écris-nous.</p>")
        w("                </div>")
        w("              </li>")
        return

    w(f'                  <h3 class="wm-perso__nom">{e(fiche["pseudo"])}</h3>')

    #  LA LIGNE QUI SITUE : le rôle, puis les autres pseudos. En gris et
    #  sur une ligne, comme sur les fiches de personnages — en pastilles,
    #  « Administratrice » pesait plus lourd que le nom.
    situe = []
    if fiche.get("role"):
        situe.append(fiche["role"])
    if fiche.get("aussi"):
        situe.append("aussi " + " · ".join(fiche["aussi"]))
    if situe:
        w(f'                  <p class="wm-perso__situe">{e(" · ".join(situe))}</p>')

    if fiche.get("texte"):
        w(f'                  <p class="wm-perso__texte">{e(fiche["texte"])}</p>')

    #  LES COMPTES DE JEU SONT DITS. Sur un forum, savoir que trois
    #  personnages sont la même personne change la façon de jouer avec
    #  eux — c'est l'information que la page du staff apporte vraiment.
    if fiche.get("comptes"):
        w('                  <p class="wm-perso__texte"><b>Ses personnages :</b> '
          + e(", ".join(fiche["comptes"])) + "</p>")

    if fiche.get("traits"):
        w('                  <p class="wm-perso__traits">')
        for t in fiche["traits"]:
            w(f'                    <span class="wm-perso__trait">{e(t)}</span>')
        w("                  </p>")

    if fiche.get("aConfirmer"):
        w('                  <p class="wm-perso__texte"><b>À confirmer</b> — cette'
          " fiche vient de la version précédente du forum et n'a pas encore été"
          " relue.</p>")

    w("                </div>")
    w("              </li>")


def corps():
    d = json.loads((R / "data/staff.json").read_text(encoding="utf-8"))
    out = []
    w = out.append

    w(f"{DEBUT} — écrit par `outils/annexe-staff.py` ▼▼▼ -->")
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
    w('      <h1 class="wm-annexe__titre">Le <em>staff</em></h1>')
    w(f'      <p class="wm-annexe__chapo">{e(d["chapo"])}</p>')
    w("")
    w('      <div class="wm-annexe__blocs">')
    w("")
    w('        <div class="wm-annexe__carte">')
    w('          <h2 class="wm-annexe__carte-titre">Qui tient la maison</h2>')
    w('          <ul class="wm-persos">')
    for fiche in d["staff"]:
        carte(w, fiche)
    w("          </ul>")
    w("        </div>")
    w("")
    #  À QUI S'ADRESSER : c'est la question qu'on se pose vraiment en
    #  arrivant sur cette page. Elle passe donc après les visages, mais
    #  avant tout le reste.
    w('        <div class="wm-annexe__carte">')
    w('          <h2 class="wm-annexe__carte-titre">À qui s\'adresser</h2>')
    w('          <ul class="wm-tirets">')
    for ligne in d["aQuiSAdresser"]:
        w(f'            <li><b>{e(ligne["quoi"])}</b> — {e(ligne["qui"])}</li>')
    w("          </ul>")
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
                "l'annexe du staff ne correspond plus à data/staff.json — "
                "lance « python3 outils/annexe-staff.py »"
            )
        print(f"annexe du staff : à jour ({len(ancien)} caractères).")
        return 0
    PAGE.write_text(neuf, encoding="utf-8")
    print(f"annexe du staff écrite : {len(neuf)} caractères "
          "(limite Forumactif : 128 000).")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
