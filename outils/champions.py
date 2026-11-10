#!/usr/bin/env python3
# ════════════════════════════════════════════════════════════════════
#  outils/champions.py — les deux messages de t1002 « Les Champions »
#
#  USAGE :  python3 outils/champions.py
#
#  ── POURQUOI CE GÉNÉRATEUR ──────────────────────────────────────────
#
#  Les deux messages étaient écrits à la main dans l'éditeur du forum.
#  Ça se voyait : entre chaque `<li>` traînait un `<br>` laissé par
#  l'éditeur, et sur l'Arène Acier l'état s'était collé au palier —
#  « PALIER 2POSTE VACANT » — faute d'un retour qui avait sauté. Ce
#  genre de faute ne se corrige pas, il se régénère.
#
#  ── CE QUE CHAQUE MESSAGE PORTE ─────────────────────────────────────
#
#  1. Les onze postes, avec leur ville, leur type, leur niveau et leur
#     palier, et ce qu'on demande à qui les prend.
#  2. Le lexique : pour chaque poste, un caractère à interpréter.
#
#  ── LA JOINTURE ─────────────────────────────────────────────────────
#
#  `data/champions.json` ne porte QUE ce qui lui est propre : les
#  textes, les images, l'état du poste, l'âge, les traits, les
#  affinités, les rivalités. Le nom de type, la ville, le niveau, le
#  palier et l'adresse du défi viennent de `data/arenes.json` par le
#  `slug`. Deux fichiers qui porteraient le niveau d'une arène
#  finiraient par ne plus être d'accord, et c'est le genre de
#  désaccord qu'un joueur découvre en perdant un combat.
#
#  ── LA HIÉRARCHIE DU LEXIQUE ────────────────────────────────────────
#
#  « Mets les champions sur 2 colonnes et améliore la hiérarchie des
#  informations » (10 novembre).
#
#  Les quatre champs étaient quatre phrases, avec leur étiquette EN
#  PROSE : « Tranche d'âge : Entre 20 et 30 ans. » L'étiquette et la
#  valeur avaient le même poids, la même couleur, la même ligne — donc
#  aucune hiérarchie, et il fallait lire pour trouver.
#
#  Ils se rangent maintenant en deux groupes, parce qu'ils ne sont pas
#  de même nature :
#
#    CE QU'IL EST       l'âge et les traits, en clé/valeur ;
#    CE QU'IL EST AUX   les affinités et les rivalités, dans les deux
#    AUTRES             cadres face à face de la fiche de défi.
#
#  Les deux cadres, c'est exprès : c'est la forme qu'on a déjà donnée
#  à « super efficace / peu efficace », et une paire oppose mieux
#  qu'une liste.
#
#  ── ET LE LEXIQUE DIT MAINTENANT DE QUELLE ARÈNE IL PARLE ───────────
#
#  Une même arène porte DEUX NOMS sur ce sujet : « Arène Eau » dans le
#  premier message, « Arène de Port-Amarée » dans le second. Les deux
#  sont de Callista et les deux restent — mais la fiche du lexique
#  porte désormais la pastille de type et le niveau, pour qu'on voie
#  sans compter que les deux désignent la même arène.
# ════════════════════════════════════════════════════════════════════

import json
import os
import pathlib
import sys

RACINE = pathlib.Path(__file__).resolve().parent.parent
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from annexes import en_titre  # noqa: E402

SORTIE = RACINE / "templates"


def e(t):
    """Échapper pour du texte ou un attribut à guillemets doubles."""
    return (str(t).replace("&", "&amp;").replace("<", "&lt;")
            .replace(">", "&gt;").replace('"', "&quot;"))


def pastille(cle):
    """Une pastille de type, nom écrit — la même que partout ailleurs."""
    return (f'<span class="wm-type wm-type--{e(cle)}" data-wm-type="{e(cle)}">'
            f"{e(en_titre(cle))}</span>")


def cadre(titre, texte):
    return ('    <div class="wm-annonce__bloc">'
            f'<p class="wm-annonce__bloc-titre">{e(titre)}</p>'
            f'<p class="wm-annonce__texte">{e(texte)}</p></div>')


def degraisser(lignes):
    """Une seule ligne, sans commentaire ni blanc — prêt à coller.

    L'éditeur de Forumactif supprime les retours à la ligne sans les
    remplacer par une espace ; un bloc déjà sur une ligne ne lui laisse
    donc rien à abîmer.
    """
    out, dedans = [], False
    for ligne in lignes:
        nu = ligne.strip()
        if dedans:
            if "-->" in nu:
                dedans = False
            continue
        if nu.startswith("<!--"):
            if "-->" not in nu:
                dedans = True
            continue
        if nu == "":
            continue
        out.append(nu)
    return "".join(out) + "\n"


def message_des_postes(d, arenes):
    out = []
    w = out.append
    w('<div class="wm-annonce wm-annonce--sable wm-annonce--sans-filet">')
    w(f'  <p class="wm-annonce__soustitre">Onze postes de champion</p>')
    w('  <h2 class="wm-annonce__titre">Interpréter un champion '
      "d'arène</h2>")
    w(f'  <p class="wm-annonce__texte">{e(d["intro"])}</p>')

    w('  <p class="wm-annonce__soustitre">Ce qu\'on demande</p>')
    w('  <div class="wm-annonce__blocs">')
    for c in d["conditions"]:
        w(cadre(c["titre"].rstrip("."), c["texte"]))
    w("  </div>")

    #  LES DEUX GROUPES VIENNENT DU GENRE DÉCLARÉ dans `arenes.json`, et
    #  les titres comptent eux-mêmes : « Sept arènes » et « Quatre
    #  colosseums » étaient écrits en toutes lettres dans le message, et
    #  deviendraient faux le jour où une douzième arrive.
    for genre, mot in (("arene", "arène"), ("colosseum", "colosseum")):
        lot = [a for a in arenes if a["genre"] == genre]
        w(f'  <p class="wm-annonce__soustitre">{EN_LETTRES[len(lot)]} '
          f"{mot}{'s' if len(lot) > 1 else ''}</p>")
        w('  <ul class="wm-postes">')
        for a in lot:
            ch = d["champions"].get(a["slug"], {})
            pris = ch.get("statut") == "joue"
            #  CHAQUE POSTE MÈNE À SON FORUM D'ARÈNE, et pas au sujet
            #  de défi : on lit cette liste pour savoir où le rôle se
            #  joue, pas pour aller le combattre. L'adresse vient de
            #  `arenes.json`, comme tout le reste de la ligne.
            w(f'    <li><a class="wm-poste" href="{e(a["forum"])}">'
              '<span class="wm-poste__vignette">'
              f'<img class="wm-poste__type" src="{e(TYPE_IMG.format(a["type"]))}" '
              'alt="" loading="lazy" width="28" height="28"></span>'
              '<span class="wm-poste__mots">'
              f'<b class="wm-poste__nom">{e(a["nom"])}</b>'
              f'<span class="wm-poste__ville">{e(a["ville"])} · niveau '
              f'{a["niveau"]} · palier {a["palier"]}</span></span>'
              f'<span class="wm-poste__etat">poste '
              f'{"pris" if pris else "vacant"}</span>'
              '<span class="wm-poste__fleche" aria-hidden="true">→</span>'
              "</a></li>")
        w("  </ul>")

    w('  <div class="wm-encarts wm-encarts--detachee">')
    w('    <div class="wm-encart wm-encart--paisible">'
      f'<span class="wm-encart__etiquette">{e(d["encart"]["etiquette"])}</span>'
      f'<p>{e(d["encart"]["texte"])}</p></div>')
    w("  </div>")
    w("</div>")
    return out


EN_LETTRES = {
    1: "Une", 2: "Deux", 3: "Trois", 4: "Quatre", 5: "Cinq", 6: "Six",
    7: "Sept", 8: "Huit", 9: "Neuf", 10: "Dix", 11: "Onze", 12: "Douze",
}

TYPE_IMG = "https://by-teenspirit.github.io/wild-mystery/img/types/{}.png"


def message_du_lexique(d, arenes):
    out = []
    w = out.append
    w('<div class="wm-annonce wm-annonce--sable wm-annonce--sans-filet">')
    w('  <p class="wm-annonce__soustitre">Onze caractères à interpréter</p>')
    w('  <h2 class="wm-annonce__titre">Lexique des champions</h2>')
    w('  <ul class="wm-lexique">')
    for a in arenes:
        ch = d["champions"].get(a["slug"])
        if ch is None:
            continue
        pris = ch["statut"] == "joue"
        w('    <li class="wm-lexique__fiche">')
        #  L'IMAGE EST DÉCORATIVE : `alt` vide. Elle montre le lieu, que
        #  le titre juste en dessous nomme déjà ; la décrire ferait lire
        #  deux fois la même chose à qui écoute la page.
        w(f'      <img class="wm-lexique__image" src="{e(ch["image"])}" '
          'alt="" loading="lazy">')
        w('      <div class="wm-lexique__corps">')
        w('        <p class="wm-lexique__etat wm-lexique__etat--'
          f'{"joue" if pris else "libre"}">'
          f'{"Joué" if pris else "Libre"}</p>')
        w(f'        <h3 class="wm-lexique__nom">{e(ch["nomDuPoste"])}</h3>')
        #  LE REPÈRE EST LE PONT ENTRE LES DEUX MESSAGES : la pastille
        #  dit le type, donc le nom que porte le premier message.
        w('        <p class="wm-lexique__repere">' + pastille(a["type"])
          + f'<span class="wm-lexique__niveau">Niveau {a["niveau"]} · '
          f'palier {a["palier"]}</span></p>')
        for cle, valeur in (("Tranche d'âge", ch["age"]),
                            ("Traits de caractère", ch["traits"])):
            w(f'        <p class="wm-lexique__cle">{e(cle)}</p>')
            w(f'        <p class="wm-lexique__valeur">{e(valeur)}</p>')
        w('        <div class="wm-annonce__blocs">')
        w("    " + cadre("Affinités", ch["affinites"]).strip())
        w("    " + cadre("Rivalités", ch["rivalites"]).strip())
        w("        </div>")
        w("      </div>")
        w("    </li>")
    w("  </ul>")
    w("</div>")
    return out


def main():
    d = json.loads((RACINE / "data" / "champions.json").read_text("utf-8"))
    arenes = json.loads(
        (RACINE / "data" / "arenes.json").read_text("utf-8")
    )["arenes"]

    #  L'ORDRE DU PREMIER MESSAGE EST CELUI DU NIVEAU, pas celui du
    #  fichier : c'est l'ordre dans lequel un joueur les affronte, et
    #  c'est celui que Callista avait posé à la main.
    arenes = sorted(arenes, key=lambda a: a["niveau"])

    manquants = [a["slug"] for a in arenes if a["slug"] not in d["champions"]]
    if manquants:
        print(f"pas de fiche de lexique pour : {', '.join(manquants)}",
              file=sys.stderr)
        return 1
    inconnus = [s for s in d["champions"] if s not in {a["slug"] for a in arenes}]
    if inconnus:
        print(f"fiche de lexique sans arène : {', '.join(inconnus)}",
              file=sys.stderr)
        return 1

    for nom, lignes in (
        ("champions-1-postes", message_des_postes(d, arenes)),
        ("champions-2-lexique", message_du_lexique(d, arenes)),
    ):
        (SORTIE / f"{nom}.a-coller.html").write_text(
            "\n".join(lignes) + "\n", encoding="utf-8")
        mini = degraisser(lignes)
        (SORTIE / f"{nom}.min.html").write_text(mini, encoding="utf-8")
        print(f"   {nom} : {len(mini)} caractères")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
