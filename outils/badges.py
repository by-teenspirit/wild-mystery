#!/usr/bin/env python3
# ════════════════════════════════════════════════════════════════════
#  outils/badges.py — les onze badges de Rhode, en SVG
#
#  Lancement : `python3 outils/badges.py`
#  Sortie    : `img/badges/*.svg` et `img/badges/planche.html`
#
#  ── POURQUOI DES DESSINS À NOUS ────────────────────────────────────
#
#  Les badges des jeux Pokémon sont des créations protégées : on ne les
#  recopie pas, même retouchés. Ceux-ci sont construits ici, à partir de
#  formes géométriques et de la palette du forum.
#
#  ── DEUX FAMILLES, PARCE QUE CE SONT DEUX ÉPREUVES ─────────────────
#
#  « Visuellement, les arènes et les colosseums ne doivent pas être
#  pareils », 30 octobre.
#
#  · ARÈNE — un ÉCUSSON. Sept pour Rhode, à conquérir dans l'ordre :
#    la forme est celle d'un blason qu'on accroche, pointe en bas.
#  · COLOSSEUM — un DISQUE CRANTÉ. Quatre, et on y combat à deux contre
#    deux : la forme est celle de l'arène elle-même, vue du dessus, et
#    son anneau intérieur se referme sur le glyphe.
#
#  Les deux se distinguent à la silhouette, de loin et en petit — c'est
#  le test d'un badge, qui ne sera jamais vu plus grand que 48 px.
#
#  ── LES COULEURS ───────────────────────────────────────────────────
#
#  Une teinte par type, tirée vers le chaud pour tenir avec la charte du
#  forum, et un contour à l'encre : un badge posé sur `surface` en thème
#  clair ou sur `surface` en thème sombre doit se lire des deux côtés,
#  et c'est le contour qui le garantit.
# ════════════════════════════════════════════════════════════════════

from pathlib import Path

RACINE = Path(__file__).resolve().parent.parent
SORTIE = RACINE / "img" / "badges"

#  La charte, pour le contour et les reflets.
ENCRE = "#2e2018"
CLAIR = "#fffbf7"

#  ── LES GLYPHES ────────────────────────────────────────────────────
#
#  Chacun tient dans une boîte de 32 × 32 centrée en (0, 0), et se pose
#  au centre du badge. Formes pleines, aucun détail sous 2 px : à 48 px
#  de rendu, un trait fin disparaît.

GLYPHES = {
    #  FEU — une flamme, pointe en haut, avec sa langue à gauche.
    #  Deux versions ratées avant celle-ci : la première avait un trou
    #  au milieu et se lisait comme une goutte percée, la seconde
    #  partait en boucle. Un seul contour, et la langue est une
    #  encoche du même tracé.
    "feu": "M0-16C5-7 11-4 11 3 11 10 6 15 0 15-6 15-11 10-11 3"
           "-11-3-6-6-4-11-2-7-1-4 0-1 1-5 1-10 0-16Z",
    #  PLANTE — une feuille nervurée.
    "plante": "M-13 13C-13 0-7-12 13-13 12 7 1 15-13 13Z"
              "M-9 10C-3 2 2-3 9-7 3-1-2 5-9 10Z",
    #  EAU — une goutte.
    "eau": "M0-15C7-6 12-1 12 5 12 11 7 15 0 15-7 15-12 11-12 5-12-1-7-6 0-15Z",
    #  ACIER — un écrou hexagonal percé.
    "acier": "M0-15 13-7.5 13 7.5 0 15-13 7.5-13-7.5Z"
             "M0-7 6-3.5 6 3.5 0 7-6 3.5-6-3.5Z",
    #  ROCHE — un bloc anguleux, d'un seul tenant. La facette
    #  intérieure de la première version était un trou : à 48 px, le
    #  bloc avait l'air percé.
    "roche": "M-14 3-6-13H7L14 1 6 14H-8Z",
    #  VOL — une aile à trois plumes, pointée vers le haut. La
    #  première version était un simple arc : posée dans un écusson,
    #  elle se lisait comme un sourire.
    "vol": "M14-14C2-13-7-7-12 3L-7 2-10 9-4 7-6 13C2 8 9 0 14-14Z"
           "M-4 2 2-3M-1 7 6-1",
    #  TÉNÈBRES — un croissant, rentré dans la boîte : la première
    #  version faisait 29 de haut et touchait le bord de l'écusson.
    "tenebres": "M3-12C-3-12-9-6-9 0-9 6-3 12 3 12 5 12 8 11 9 10"
                "3 9-1 5-1 0-1-5 3-9 9-10 8-11 5-12 3-12Z",
    #  FÉE — une étoile à quatre branches.
    "fee": "M0-15C1-6 6-1 15 0 6 1 1 6 0 15-1 6-6 1-15 0-6-1-1-6 0-15Z",
    #  SPECTRE — une silhouette ondulée.
    "spectre": "M0-14C7-14 12-9 12-2V14L7 9 3 14-1 9-5 14-9 9-12 14V-2"
               "C-12-9-7-14 0-14Z"
               "M-5-5A2.5 2.5 0 1 0-5 0 2.5 2.5 0 1 0-5-5Z"
               "M5-5A2.5 2.5 0 1 0 5 0 2.5 2.5 0 1 0 5-5Z",
    #  ÉLECTRIK — un éclair.
    "electrik": "M4-15-12 3H-2L-4 15 12-4H2Z",
    #  DRAGON — trois griffes écartées et recourbées. La première
    #  version les tenait serrées et pointe en haut : ça faisait une
    #  couronne.
    "dragon": "M-15-9C-11-2-9 4-10 12-7 9-5 7-3 6-6 1-9-4-15-9Z"
              "M0-15C2-6 2 2 0 12-2 2-2-6 0-15Z"
              "M15-9C9-4 6 1 3 6 5 7 7 9 10 12 9 4 11-2 15-9Z",
}

#  ── LES TEINTES ────────────────────────────────────────────────────
#
#  Deux tons par type : le champ et son ombre, qui donne au badge son
#  relief sans dégradé — un dégradé à 48 px se lit comme une tache.
TEINTES = {
    "feu": ("#d9601f", "#a8410f"),
    "plante": ("#4f8f3a", "#36682a"),
    "eau": ("#2f74b5", "#1f5584"),
    "acier": ("#7e8b9c", "#5b6775"),
    "roche": ("#a67c43", "#7c5a2c"),
    "vol": ("#7d9ccc", "#5a77a4"),
    "tenebres": ("#4a3f49", "#2f2830"),
    "fee": ("#c87a9e", "#9c5578"),
    "spectre": ("#6a5690", "#4a3a68"),
    "electrik": ("#d9b22f", "#a8871c"),
    "dragon": ("#4556b4", "#2f3c85"),
}

#  ── LES ONZE ÉPREUVES DE RHODE ─────────────────────────────────────
#
#  Les types viennent de `forumactif/36-annexes-source-progression.md`,
#  le texte d'origine du 30 septembre. L'ordre des arènes est celui dans
#  lequel on doit les affronter : il compte.
ARENES = [
    ("station-service", "Champion de la Station Service", "feu"),
    ("samaragd", "Champion de Samaragd", "plante"),
    ("port-amaree", "Champion de Port-Amarée", "eau"),
    ("suerebe", "Champion de Suerebe", "acier"),
    ("pyrite", "Champion de Pyrite", "roche"),
    ("tour-titanite", "Champion de la Tour Titanite", "vol"),
    ("ile-tenebra", "Champion de l'Île Ténèbra", "tenebres"),
]

COLOSSEUMS = [
    ("rhode", "Colosseum de Rhode", "fee"),
    ("phenacit", "Colosseum de Phenacit", "spectre"),
    ("targare", "Colosseum de Targare", "electrik"),
    ("titanite", "Colosseum de Titanite", "dragon"),
]


def ecusson(champ: str, ombre: str) -> str:
    """Le blason des arènes : épaules droites, pointe en bas.

    Le chanfrein des deux coins hauts évite l'angle vif, qui
    s'escalierait à 48 px."""
    return (
        f'<path d="M-34-38H34A4 4 0 0 1 38-34V2C38 22 20 34 0 40'
        f'-20 34-38 22-38 2V-34A4 4 0 0 1-34-38Z" fill="{champ}"/>'
        #  L'OMBRE SUIT LA FORME. Elle coupait l'écusson d'un trait
        #  horizontal à mi-hauteur : on ne lisait pas un relief, on
        #  lisait deux couleurs. Elle prend maintenant le flanc droit,
        #  comme si la lumière venait de la gauche, et épouse la
        #  pointe.
        #  `stroke="none"` : le groupe qui enveloppe la forme pose un
        #  contour à l'encre sur CHACUN de ses chemins. L'ombre en
        #  héritait et se retrouvait cernée d'un trait vertical au
        #  milieu du badge — on lisait une bande, pas un flanc.
        f'<path d="M4-38H34A4 4 0 0 1 38-34V2C38 22 20 34 0 40Z"'
        f' fill="{ombre}" opacity=".55" stroke="none"/>'
    )


def disque(champ: str, ombre: str) -> str:
    """L'arène des colosseums, vue du dessus : un disque à douze crans.

    Les crans sont des trapèzes posés sur le cercle, et pas une étoile
    à pointes : une pointe fine disparaît en petit, un cran tient."""
    import math

    crans = []
    for i in range(12):
        a = math.radians(i * 30)
        #  Chaque cran : deux points sur le cercle, deux plus loin.
        p = []
        for da, r in ((-7, 34), (-5, 42), (5, 42), (7, 34)):
            t = a + math.radians(da)
            p.append(f"{math.cos(t) * r:.1f} {math.sin(t) * r:.1f}")
        crans.append("M" + "L".join(p) + "Z")
    return (
        f'<path d="{"".join(crans)}" fill="{ombre}"/>'
        f'<circle r="35" fill="{champ}"/>'
        #  Le même parti que l'écusson : le flanc droit dans l'ombre,
        #  et pas la moitié basse coupée net.
        f'<path d="M0-35A35 35 0 0 1 0 35Z" fill="{ombre}" opacity=".55"'
        f' stroke="none"/>'
        #  L'anneau intérieur, qui enferme le glyphe.
        f'<circle r="24" fill="none" stroke="{ENCRE}" stroke-width="3"'
        f' opacity=".45"/>'
    )


def badge(nom: str, titre: str, type_: str, famille: str) -> str:
    champ, ombre = TEINTES[type_]
    forme = ecusson(champ, ombre) if famille == "arene" else disque(champ, ombre)
    #  LE CONTOUR EST DESSINÉ DEUX FOIS : une fois en dessous, épais,
    #  pour cerner la silhouette entière ; une fois au-dessus du glyphe,
    #  pour que le clair du glyphe ne bave pas sur le champ.
    return f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="-50 -50 100 100"
     width="96" height="96" role="img" aria-label="{titre}">
  <title>{titre}</title>
  <g stroke="{ENCRE}" stroke-width="5" stroke-linejoin="round">
    {forme}
  </g>
  <g fill="{CLAIR}" stroke="{ENCRE}" stroke-width="2.5"
     stroke-linejoin="round" stroke-linecap="round" fill-rule="evenodd">
    <path d="{GLYPHES[type_]}"/>
  </g>
</svg>
"""


def main() -> None:
    SORTIE.mkdir(parents=True, exist_ok=True)
    faits = []
    for famille, liste in (("arene", ARENES), ("colosseum", COLOSSEUMS)):
        for nom, titre, type_ in liste:
            fichier = SORTIE / f"{famille}-{nom}.svg"
            fichier.write_text(badge(nom, titre, type_, famille), encoding="utf-8")
            faits.append((famille, fichier.name, titre, type_))

    #  Une planche pour les voir ensemble, aux deux thèmes et à la
    #  taille réelle : un badge se juge à 48 px, pas à l'écran entier.
    lignes = []
    for famille, fichier, titre, type_ in faits:
        lignes.append(
            f'<figure><img src="{fichier}" alt="{titre}" width="48" height="48">'
            f'<img src="{fichier}" alt="" width="96" height="96">'
            f"<figcaption>{titre}<small>{type_}</small></figcaption></figure>"
        )
    planche = f"""<!doctype html><html lang="fr"><head><meta charset="utf-8">
<title>Les onze badges de Rhode</title>
<style>
  body {{ margin: 0; font-family: system-ui, sans-serif; }}
  section {{ padding: 24px 32px; }}
  .clair {{ background: #fffbf7; color: #2e2018; }}
  .sombre {{ background: #241a16; color: #f2e4d8; }}
  h2 {{ font-size: 13px; letter-spacing: .08em; text-transform: uppercase;
       opacity: .7; margin: 0 0 16px; }}
  .grille {{ display: flex; flex-wrap: wrap; gap: 24px; }}
  figure {{ margin: 0; display: flex; align-items: center; gap: 12px; }}
  figcaption {{ font-size: 12px; line-height: 1.4; }}
  small {{ display: block; opacity: .6; }}
</style></head><body>
<section class="clair">
  <h2>Les sept arènes — écusson</h2>
  <div class="grille">{"".join(lignes[:7])}</div>
  <h2 style="margin-top:28px">Les quatre colosseums — disque</h2>
  <div class="grille">{"".join(lignes[7:])}</div>
</section>
<section class="sombre">
  <h2>Les mêmes, en thème sombre</h2>
  <div class="grille">{"".join(lignes)}</div>
</section>
</body></html>
"""
    (SORTIE / "planche.html").write_text(planche, encoding="utf-8")
    print(f"{len(faits)} badges écrits dans {SORTIE}")


if __name__ == "__main__":
    main()
