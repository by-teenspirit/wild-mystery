#!/usr/bin/env python3
# ════════════════════════════════════════════════════════════════════
#  outils/arbre.py — écrire la page de l'arbre de compétences
#
#  USAGE :  python3 outils/arbre.py
#
#  « Est-ce que tu peux proposer un espèce d'arbre de compétences avec
#  les missions et le coder ? » — 25 novembre 2026.
#
#  ── LES NŒUDS SONT DE CALLISTA, LA STRUCTURE EST D'ICI ─────────────
#
#  Les soixante-seize cases viennent des sujets t1012 (les médailles)
#  et t855 (les thèmes de missions), recopiées mot pour mot dans
#  `data/arbre.json`. Cette page n'écrit pas une ligne de texte de jeu :
#  elle range, elle relie, elle dit ce qui ouvre quoi.
#
#  ── TOUT EST DANS LA PAGE, LE SCRIPT N'AJOUTE QUE L'ÉTAT ───────────
#
#  Même règle que le répertoire, et elle compte autant : le CONTENU de
#  la page EST l'arbre. Sans JavaScript on lit les soixante-seize
#  cases, leurs conditions et leurs récompenses ; avec, celles d'une
#  joueuse connectée s'allument. Une page qui dessinerait ses cases en
#  script serait blanche.
#
#  ── LES COLONNES DISENT LA PROFONDEUR ──────────────────────────────
#
#  Une case qui en attend une autre est posée PLUS LOIN, dans la
#  colonne suivante, avec un filet qui remonte. C'est ce qui fait un
#  arbre plutôt qu'une liste : « posséder 50 pokémon » n'a de sens
#  qu'après « 20 », et on le voit sans lire.
#
#  La profondeur se CALCULE depuis les prérequis — elle n'est pas
#  écrite dans les données. Un `apres` ajouté déplace la case tout
#  seul, et deux endroits à tenir d'accord, c'est un de trop.
# ════════════════════════════════════════════════════════════════════

import html
import json
import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from annexes import BARRE, FEUILLES, METAS, PAGES, PIED  # noqa: E402

R = pathlib.Path(__file__).resolve().parent.parent
SORTIE = R / "pages/arbre-des-competences.html"

#  ── CE QUE CHAQUE GENRE ANNONCE ────────────────────────────────────
#
#  La page le DIT en mots, pas seulement par une couleur : « hors-jeu »
#  sur fond pâle se confond avec « verrouillé », et une joueuse qui
#  croit pouvoir allumer une case que rien ne sait allumer attend pour
#  rien.
GENRES = {
    "mesure": ("compté", "La partie compte toute seule."),
    "mission": ("mission", "Une mission à jouer, validée par le staff."),
    "staff": ("à la main", "Constaté par le staff — rien ne le compte."),
    "forum": ("pas encore", "La réponse est côté forum, et rien ne la lit encore."),
}


def e(t):
    return html.escape(str(t or ""), quote=True)


def profondeur(noeuds):
    """La colonne de chaque case, calculée depuis ses prérequis.

    Une case sans prérequis est en colonne 0 ; une case qui en attend
    une autre est une colonne plus loin que la plus profonde de celles
    qu'elle attend. Les données sont garanties sans cycle par
    `plaintes()`, côté TypeScript — ici on se protège quand même d'une
    boucle, parce qu'un générateur qui tourne sans fin ne dit pas
    pourquoi.
    """
    par = {n["clef"]: n for n in noeuds}
    vu = {}

    def de(clef, pile):
        if clef in vu:
            return vu[clef]
        if clef in pile or clef not in par:
            return 0
        avant = par[clef].get("apres") or []
        d = 0 if not avant else 1 + max(de(c, pile | {clef}) for c in avant)
        vu[clef] = d
        return d

    return {n["clef"]: de(n["clef"], frozenset()) for n in noeuds}


def case(n, colonne):
    genre = n.get("genre", "mesure")
    mot, pourquoi = GENRES.get(genre, GENRES["mesure"])
    recompense = (
        f'<p class="wm-arbre__gain">{e(n["recompense"])}</p>'
        if n.get("recompense") else ""
    )
    #  LA CONDITION EST RÉPÉTÉE EN TITRE QUAND ELLE EST LE TITRE. Les
    #  missions de t855 n'ont pas de nom : leur énoncé en tient lieu,
    #  et l'écrire deux fois ferait un doublon visible.
    condition = (
        "" if n["condition"] == n["titre"]
        else f'<p class="wm-arbre__quoi">{e(n["condition"])}</p>'
    )
    return (
        f'        <li class="wm-arbre__case" data-wm-case="{e(n["clef"])}"'
        f' data-wm-genre="{e(genre)}" data-wm-colonne="{colonne}"'
        + (f' data-wm-apres="{e(" ".join(n["apres"]))}"' if n.get("apres") else "")
        + (f' data-wm-mesure="{e(n["mesure"])}" data-wm-seuil="{e(n["seuil"])}"'
           if n.get("mesure") else "")
        + ">\n"
        f'          <p class="wm-arbre__genre" title="{e(pourquoi)}">{e(mot)}</p>\n'
        f'          <h3 class="wm-arbre__nom">{e(n["titre"])}</h3>\n'
        f"{condition}{recompense}"
        "        </li>\n"
    )


def bloc(titre, note, noeuds, classe=""):
    """Une famille ou une branche : ses chaînes, puis ses cases libres.

    LA SÉPARATION N'EST PAS DÉCORATIVE. Une colonne par profondeur a
    du sens pour une chaîne — « posséder 50 » après « 20 » — et aucun
    pour dix-huit médailles de type qui ne s'attendent pas entre
    elles : toutes en profondeur zéro, elles faisaient dix-huit
    rangées d'une seule case et une colonne de vide à côté. Mesuré au
    premier rendu, et c'est ce qui a fait ajouter ce tri.

    Est d'une chaîne un nœud qui attend quelqu'un, ou que quelqu'un
    attend. Le reste flotte, et se range comme une liste.
    """
    cols = profondeur(noeuds)
    attendus = {c for n in noeuds for c in (n.get("apres") or [])}
    enchaine = [n for n in noeuds if n.get("apres") or n["clef"] in attendus]
    libres = [n for n in noeuds if n not in enchaine]

    morceaux = []
    if enchaine:
        large = max(cols[n["clef"]] for n in enchaine) + 1
        morceaux.append(
            f'      <ol class="wm-arbre__cases" style="--colonnes: {large}">\n'
            + "".join(case(n, cols[n["clef"]]) for n in enchaine)
            + "      </ol>\n"
        )
    if libres:
        morceaux.append(
            '      <ul class="wm-arbre__libres">\n'
            + "".join(case(n, 0) for n in libres)
            + "      </ul>\n"
        )

    note_html = f'      <p class="wm-arbre__note">{e(note)}</p>\n' if note else ""
    return (
        f'    <section class="wm-arbre__bloc{classe}">\n'
        f'      <h2 class="wm-arbre__titre">{e(titre)}</h2>\n'
        f"{note_html}"
        + "".join(morceaux)
        + "    </section>\n"
    )


GABARIT = """<!-- ═══════════════════════════════════════════════════════════════════
     Arbre de compétences — à coller dans une page HTML.

     ÉCRITE PAR `outils/arbre.py` depuis `data/arbre.json`. Ne pas
     corriger ce fichier à la main : la correction serait perdue à la
     prochaine génération.

     Les cases viennent des sujets t1012 (les médailles) et t855 (les
     thèmes de missions) : on les range, on ne les réécrit pas.

     Modules > HTML & JAVASCRIPT > Gestion des pages HTML > Créer, en
     MODE AVANCÉ, et « Utiliser le header et le footer du forum » = NON.
     ═══════════════════════════════════════════════════════════════════ -->

<!DOCTYPE html>
<html lang="fr">
<head>
{tete}
</head>
<body>
<div id="modernbb">
{barre}

<div class="wm-annexe">
  <div class="wm-annexe__corps">
    <div class="wm-annexe__colonne wm-annexe__colonne--large">

      <p class="wm-annexe__surtitre">La progression</p>
      <h1 class="wm-annexe__titre">Arbre de compétences</h1>
      <p class="wm-annexe__chapo">{chapo}</p>

      <div class="wm-arbre" data-wm-arbre>
{contenu}
      </div>

    </div>
  </div>
</div>

{pied}
</div>
<script src="{pages}/js/annexes.js"></script>
</body>
</html>
"""

CHAPO = (
    "Chaque case est une chose faite, cochée une fois pour toutes. Le tronc est "
    "ouvert à tout le monde ; la branche est celle de ta maison. Il faut "
    "{c2} cases dont {b2} de ta branche pour le palier 2, {c3} dont {b3} pour le 3."
)


def ecrire(source=None, sortie=None):
    source = source or (R / "data/arbre.json")
    sortie = sortie or SORTIE
    d = json.loads(pathlib.Path(source).read_text(encoding="utf-8"))

    blocs = [
        bloc(f["titre"], f.get("note"), f["noeuds"]) for f in d["familles"]
    ] + [
        bloc(
            f'{b["nom"]} · {b["embleme"]}',
            #  UNE BRANCHE VIDE LE DIT. Trois des six groupes de t855
            #  n'ont que « LES MISSIONS ICI » : montrer un cadre vide
            #  est honnête, inventer des missions à la place de
            #  Callista ne le serait pas.
            None if b["noeuds"] else "Aucune mission écrite pour cette maison.",
            b["noeuds"],
            " wm-arbre__bloc--branche",
        )
        for b in d["branches"]
    ]

    page = GABARIT.format(
        tete=(METAS + "\n  <title>Arbre de compétences — Wild Mystery</title>\n"
              + FEUILLES).format(pages=PAGES),
        barre=BARRE,
        pied=PIED,
        pages=PAGES,
        chapo=e(CHAPO.format(
            c2=d["palier"]["2"]["cases"], b2=d["palier"]["2"]["deSaBranche"],
            c3=d["palier"]["3"]["cases"], b3=d["palier"]["3"]["deSaBranche"],
        )),
        contenu="".join(blocs),
    )

    #  MÊME GARDE QUE LES ANNEXES : l'éditeur de pages HTML de
    #  Forumactif décode les entités en enregistrant, et un
    #  `&lt;table&gt;` écrit dans un texte revient en VRAIE balise.
    if "&lt;" in page or "&gt;" in page:
        raise SystemExit(
            "le texte contient une entité `&lt;` ou `&gt;`. Forumactif la "
            "décode en vraie balise en enregistrant."
        )

    pathlib.Path(sortie).write_text(page, encoding="utf-8")
    cases = sum(len(f["noeuds"]) for f in d["familles"]) + sum(
        len(b["noeuds"]) for b in d["branches"]
    )
    print(f"  {pathlib.Path(sortie).name} — {cases} case(s), {len(page)} caractères")
    vides = [b["nom"] for b in d["branches"] if not b["noeuds"]]
    for v in vides:
        print(f"  ⚠ la branche {v} n'a aucune mission")


if __name__ == "__main__":
    ecrire()
