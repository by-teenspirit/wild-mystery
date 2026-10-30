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
#  LA SILHOUETTE EST LE SYMBOLE — « je préfèrerais que le badge ait la
#  forme du type », 30 octobre. Pas de cadre : la flamme est la flamme,
#  la feuille est la feuille. La première série posait le symbole dans
#  un écusson ou un disque, et donnait onze badges de même silhouette
#  qui ne se distinguaient qu'à la couleur.
#
#  · ARÈNE — liseré simple, à l'or.
#  · COLOSSEUM — second liseré par-dessous, à l'argent : on y combat à
#    deux contre deux, et le badge le dit sans déformer le symbole.
#
#  Les deux se distinguent à 48 px — l'un a un trait, l'autre en a
#  deux. C'est le seul test qui compte : un badge ne sera jamais vu
#  plus grand.
#
#  ── LES COULEURS ───────────────────────────────────────────────────
#
#  Une teinte par type, tirée vers le chaud pour tenir avec la charte du
#  forum, et un contour à l'encre : un badge posé sur `surface` en thème
#  clair ou sur `surface` en thème sombre doit se lire des deux côtés,
#  et c'est le contour qui le garantit.
# ════════════════════════════════════════════════════════════════════

import re
from pathlib import Path

RACINE = Path(__file__).resolve().parent.parent
SORTIE = RACINE / "img" / "badges"

#  La charte, pour le contour et les reflets.
ENCRE = "#2e2018"
CLAIR = "#fffbf7"

#  LES DEUX MÉTAUX, qui disent l'épreuve. L'or des arènes et l'argent
#  des colosseums : c'est tout ce qui les sépare maintenant que la
#  silhouette appartient au type.
#  DEUX TONS PAR MÉTAL, et c'est eux qui font le prestige. Un badge
#  d'insigne n'est pas brillant : il est CISELÉ. Le biseau se dessine
#  avec deux copies du liseré, l'une décalée vers le haut à gauche dans
#  le ton clair, l'autre vers le bas à droite dans le ton sombre — en
#  aplats, sans un seul dégradé. C'est ce qui manquait aux premières
#  versions, et qu'aucune photo de bijou n'aurait donné.
OR = "#c9a24a"
OR_CLAIR = "#f0d89a"
OR_SOMBRE = "#8a6520"

ARGENT = "#aab4bd"
ARGENT_CLAIR = "#e4eaef"
ARGENT_SOMBRE = "#6d7880"

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
    #  ROCHE — un bloc IRRÉGULIER. Le précédent était un hexagone
    #  presque régulier : posé à côté de l'écrou de l'acier, on ne
    #  distinguait plus les deux badges.
    "roche": "M-15 1-9-12 1-15 11-9 15 3 7 15-6 14Z",
    #  VOL — une aile à trois plumes, pointée vers le haut. La
    #  première version était un simple arc : posée dans un écusson,
    #  elle se lisait comme un sourire.
    "vol": "M14-14C2-13-7-7-12 3L-7 2-10 9-4 7-6 13C2 8 9 0 14-14Z"
           "M-4 2 2-3M-1 7 6-1",
    #  TÉNÈBRES — un croissant d'UN SEUL contour fermé. Trois
    #  tentatives avant celle-ci, et la leçon vaut pour toute la
    #  série : un trou intérieur reçoit lui aussi le liseré, donc un
    #  disque percé devient un anneau, et un trou qui déborde devient
    #  une virgule. Le creux doit faire partie du tracé, pas être un
    #  second sous-chemin.
    "tenebres": "M0-15C-8.3-15-15-8.3-15 0-15 8.3-8.3 15 0 15"
                " 3 15 6 14 8 13 1 11-4 6-4 0-4-6 1-11 8-13"
                " 6-14 3-15 0-15Z",
    #  FÉE — une étoile à quatre branches.
    "fee": "M0-15C1-6 6-1 15 0 6 1 1 6 0 15-1 6-6 1-15 0-6-1-1-6 0-15Z",
    #  SPECTRE — une silhouette ondulée.
    "spectre": "M0-14C7-14 12-9 12-2V14L7 9 3 14-1 9-5 14-9 9-12 14V-2"
               "C-12-9-7-14 0-14Z"
               "M-5-6C-3.6-6-2.5-4.7-2.5-3-2.5-1.3-3.6 0-5 0"
               "-6.4 0-7.5-1.3-7.5-3-7.5-4.7-6.4-6-5-6Z"
               "M5-6C6.4-6 7.5-4.7 7.5-3 7.5-1.3 6.4 0 5 0"
               " 3.6 0 2.5-1.3 2.5-3 2.5-4.7 3.6-6 5-6Z",
    #  ÉLECTRIK — un éclair.
    "electrik": "M4-15-12 3H-2L-4 15 12-4H2Z",
    #  DRAGON — deux chevrons, les écailles dorsales. La griffe à
    #  trois pointes faisait une couronne, celle à deux une aile — et
    #  l'aile appartient au type Vol. Le chevron double ne ressemble à
    #  aucun des dix autres, c'est ce qu'on lui demande.
    "dragon": "M-15 0 0-15 15 0 7 0 0-7-7 0Z"
              "M-15 15 0 0 15 15 7 15 0 8-7 15Z",
}

#  ── LES SILHOUETTES ───────────────────────────────────────────────
#
#  Les glyphes sont dessinés dans une boîte de 32 ; le badge en fait
#  100. On les agrandit d'un facteur unique plutôt que de les redessiner
#  — c'est la même forme, et une seule constante à changer si le cadrage
#  doit respirer davantage.
#
#  Aucun chemin n'utilise d'arc (`A`) : ses deux derniers drapeaux
#  valent 0 ou 1 et ne doivent PAS être mis à l'échelle. Les yeux du
#  spectre, qui en avaient, ont été repassés en courbes pour cette
#  raison.
ECHELLE = 2.55

_NOMBRE = re.compile(r"-?\d*\.?\d+")


def _agrandir(chemin: str) -> str:
    return _NOMBRE.sub(lambda m: f"{float(m.group()) * ECHELLE:.1f}", chemin)


SILHOUETTES = {nom: _agrandir(d) for nom, d in GLYPHES.items()}


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


def reflet(forme: str, cle: str) -> str:
    """Le reflet, découpé dans la silhouette.

    Une bande claire en haut à gauche, limitée à la forme par un
    `clipPath` : sans découpe elle déborderait du symbole et le badge
    aurait l'air posé derrière une vitre."""
    return (
        f'<clipPath id="{cle}"><path d="{forme}"/></clipPath>'
        f'<path d="M-50-50H10L-50 20Z" fill="{CLAIR}" opacity=".22"'
        f' clip-path="url(#{cle})"/>'
    )


def badge(nom: str, titre: str, type_: str, famille: str) -> str:
    """Un badge : la forme du type, et rien d'autre.

    ── LA SILHOUETTE EST LE SYMBOLE ────────────────────────────────

    « Je préfèrerais que le badge ait la forme du type », 30 octobre.
    La première série posait le symbole DANS un écusson ou un disque :
    onze badges de même silhouette, qui ne se distinguaient qu'à la
    couleur. Celle-ci n'a plus de cadre du tout — la flamme est la
    flamme, la feuille est la feuille.

    ── ALORS COMMENT DISTINGUER LES DEUX ÉPREUVES ? ────────────────

    Plus par la forme, puisqu'elle appartient au type. Par ce qui
    l'entoure :

    · ARÈNE — un liseré simple, à l'or.
    · COLOSSEUM — un second liseré par-dessous, à l'argent, qui double
      le contour à six pixels de distance. On y combat à deux contre
      deux, et le badge le dit sans déformer le symbole.

    Les deux se lisent à 48 px : l'un a un trait, l'autre en a deux.
    """
    champ, ombre = TEINTES[type_]
    forme = SILHOUETTES[type_]
    metal, clair, sombre = (
        (OR, OR_CLAIR, OR_SOMBRE)
        if famille == "arene"
        else (ARGENT, ARGENT_CLAIR, ARGENT_SOMBRE)
    )
    cle = f"r-{famille}-{nom}"

    #  LE DOUBLE LISERÉ DES COLOSSEUMS, dessiné en dessous : l'encre
    #  d'abord, le métal par-dessus. Dans l'autre sens, le trait
    #  d'encre — plus large — recouvrait entièrement le métal.
    aura = (
        f'<path d="{forme}" fill="none" stroke="{ENCRE}" stroke-width="30"'
        f' stroke-linejoin="round"/>'
        f'<path d="{forme}" fill="none" stroke="{sombre}" stroke-width="24"'
        f' stroke-linejoin="round"/>'
        f'<path d="{forme}" fill="none" stroke="{metal}" stroke-width="20"'
        f' stroke-linejoin="round"/>'
        if famille == "colosseum"
        else ""
    )

    #  LA CISELURE. Trois passes du même contour : le ton sombre décalé
    #  vers le bas à droite, le ton clair vers le haut à gauche, et le
    #  métal au milieu. Les décalages sont d'une unité et demie — assez
    #  pour que l'œil lise un biseau à 48 px, trop peu pour qu'on voie
    #  trois traits à 96.
    ciselure = (
        f'<g stroke-width="8" stroke-linejoin="round" fill="none">'
        f'<path d="{forme}" stroke="{sombre}" transform="translate(1.5 1.5)"/>'
        f'<path d="{forme}" stroke="{clair}" transform="translate(-1.5 -1.5)"/>'
        f'<path d="{forme}" stroke="{metal}"/>'
        f"</g>"
    )

    return f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="-50 -50 100 100"
     width="96" height="96" role="img" aria-label="{titre}">
  <title>{titre}</title>
  {aura}
  <path d="{forme}" fill="none" stroke="{ENCRE}" stroke-width="13"
        stroke-linejoin="round"/>
  {ciselure}
  <path d="{forme}" fill="{champ}" fill-rule="evenodd"/>
  {reflet(forme, cle)}
  <path d="{forme}" fill="none" stroke="{ombre}" stroke-width="2.5"
        stroke-linejoin="round" fill-rule="evenodd" opacity=".55"/>
</svg>
"""


def verifier() -> None:
    """Chaque courbe doit avoir un multiple de six nombres.

    ── DEUX CHEMINS CASSÉS PAR UN ESPACE MANQUANT ──────────────────

    Les chemins sont écrits sur plusieurs lignes et Python les colle
    bout à bout : une ligne qui finit par « 0 15 » suivie d'une qui
    commence par « 3 » donne « 0 153 ». Le croissant et le second œil
    du spectre y sont passés — le premier dessinait une forme deux
    fois trop grande, et on ne l'a vu qu'à l'image.

    Un contrôle d'arithmétique suffit à les attraper : une courbe de
    Bézier prend ses points par six, une ligne par deux.
    """
    fautes = []
    for nom, d in GLYPHES.items():
        for lettre, par in (("C", 6), ("L", 2)):
            for bloc in re.findall(rf"{lettre}([^A-Za-z]*)", d):
                n = len(re.findall(r"-?\d*\.?\d+", bloc))
                if n % par:
                    fautes.append(f"{nom} : un {lettre} de {n} nombres")
    if fautes:
        raise SystemExit("chemins mal formés —\n  " + "\n  ".join(fautes))


def main() -> None:
    verifier()
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
  <h2>Les sept arènes — or, liseré simple</h2>
  <div class="grille">{"".join(lignes[:7])}</div>
  <h2 style="margin-top:28px">Les quatre colosseums — argent, double liseré</h2>
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
