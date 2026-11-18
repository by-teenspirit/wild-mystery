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
    w('                <div class="wm-perso__corps">')

    w(f'                  <h3 class="wm-perso__nom">{e(fiche["pseudo"])}</h3>')
    if fiche.get("role"):
        w(f'                  <p class="wm-perso__situe">{e(fiche["role"])}</p>')

    if fiche.get("texte"):
        w(f'                  <p class="wm-perso__texte">{e(fiche["texte"])}</p>')
    else:
        w('                  <p class="wm-perso__texte wm-perso__texte--vide">'
          "Sa présentation reste à écrire.</p>")

    #  LE PERSONNAGE, AVEC LE LIEN VERS SON COMPTE. « Pour le moment,
    #  chacun possède un personnage » — le pluriel est quand même prévu
    #  dans la donnée : le jour où quelqu'un en prend un deuxième, on
    #  ajoute une entrée, on ne retouche pas le générateur.
    perso = fiche.get("personnage")
    persos = fiche.get("personnages") or ([perso] if perso else [])
    if persos:
        liens = []
        for x in persos:
            nom = e(x["nom"])
            compte = x.get("compte")
            liens.append(
                f'<a class="wm-perso__lien" href="{e(compte)}">{nom}</a>'
                if compte else nom
            )
        mot = "Son personnage" if len(liens) == 1 else "Ses personnages"
        w(f'                  <p class="wm-perso__texte"><b>{mot} :</b> '
          + ", ".join(liens) + "</p>")

    presence = fiche.get("presence")
    if presence:
        w('                  <p class="wm-perso__texte"><b>Présence :</b> '
          + e(presence) + "</p>")
    else:
        w('                  <p class="wm-perso__texte wm-perso__texte--vide">'
          "<b>Présence :</b> à préciser.</p>")

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
