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


#  ── CE QU'UNE FICHE DIT, ET DANS QUEL ORDRE ─────────────────────────
#
#  Demandé le 18 novembre : « un avatar, le nom de la personne / son
#  pseudo, une description que chacun fera, les personnages que la
#  personne joue, et sa présence ».
#
#  LA DESCRIPTION ET LA PRÉSENCE SONT À ELLES, pas à moi : je ne les
#  invente pas. Un champ vide écrit donc une ligne qui le dit, à la
#  place du texte — et la fiche reste lisible en attendant.
def carte(w, fiche):
    w('              <li class="wm-perso wm-perso--staff">')
    if fiche.get("avatar"):
        #  L'AVATAR EST CELUI DU COMPTE, et le compte EST le personnage :
        #  sur ce forum on joue sous le nom de son personnage. Mettre le
        #  visage du personnage à côté du pseudo de la joueuse, c'est
        #  exactement ce qui relie les deux.
        w(f'                <img class="wm-perso__avatar" src="{e(fiche["avatar"])}"'
          ' alt="" loading="lazy" />')
    else:
        w('                <span class="wm-perso__avatar wm-perso__avatar--vide"'
          ' aria-hidden="true"></span>')
    #  ── UNE TÊTE FIXE, UN CORPS QUI DÉFILE ──────────────────────
    #
    #  « La description sera longue et risque de nécessiter un scroll.
    #  Dans ce cas, j'ai besoin que les infos de présence soient
    #  visuelles, comme les personnages joués, et lisibles sans
    #  scroll. Un peu comme sur la PA en fait. » — 18 novembre.
    #
    #  CE QUI SERT À REPÉRER QUELQU'UN NE DOIT PAS DÉPENDRE DE CE
    #  QU'ELLE A ÉCRIT : pseudo, rôle, présence et personnage sont
    #  dans une tête qui ne bouge pas. La présentation, elle, a toute
    #  la place qu'elle veut — elle défile.
    w('                <div class="wm-perso__corps">')
    w('                  <div class="wm-perso__tete">')
    w(f'                    <h3 class="wm-perso__nom">{e(fiche["pseudo"])}</h3>')
    if fiche.get("role"):
        w(f'                    <p class="wm-perso__situe">{e(fiche["role"])}</p>')

    #  LA PRÉSENCE EST UNE PASTILLE, pas une phrase. Un état se lit
    #  d'un coup d'œil ; une phrase se lit en entier. Et c'est ce que
    #  fait le panneau d'administration de Forumactif, qu'elle cite.
    presence = fiche.get("presence")
    if presence:
        w('                    <p class="wm-perso__etats">')
        w('                      <span class="wm-perso__presence">'
          f'<span class="wm-perso__point" aria-hidden="true"></span>{e(presence)}</span>')

    #  LE PERSONNAGE EST DANS LA MÊME RANGÉE QUE LA PRÉSENCE : les
    #  deux répondent à la même question — qui est cette personne dans
    #  le jeu, et est-ce qu'on peut lui écrire.
    perso = fiche.get("personnage")
    persos = fiche.get("personnages") or ([perso] if perso else [])
    for x in persos:
        nom = e(x["nom"])
        compte = x.get("compte")
        dedans = (f'<a class="wm-perso__lien" href="{e(compte)}">{nom}</a>'
                  if compte else nom)
        w(f'                      <span class="wm-perso__joue">{dedans}</span>')
    if presence or persos:
        w("                    </p>")
    w("                  </div>")

    w('                  <div class="wm-perso__dit">')
    if fiche.get("texte"):
        w(f'                    <p class="wm-perso__texte">{e(fiche["texte"])}</p>')
    else:
        w('                    <p class="wm-perso__texte wm-perso__texte--vide">'
          "Sa présentation reste à écrire.</p>")
    w("                  </div>")

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
