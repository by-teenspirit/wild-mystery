#!/usr/bin/env python3
# ════════════════════════════════════════════════════════════════════
#  outils/annexe-arenes.py — le corps de l'annexe 06, les onze défis
#
#  ── CE QU'ELLE PORTE ────────────────────────────────────────────────
#
#  Demandé le 6 novembre 2026 : « on va avoir trois onglets : un onglet
#  de présentation de l'annexe, un onglet arènes, un onglet colosseums
#  et un onglet ligue ». Quatre, donc. Et dans les deux du milieu :
#  « faire un onglet par arène colosseum […] avec le type de l'arène,
#  type conseillé pour le battre, un lien vers le pré-lien, et les
#  pokémons de l'arène », chacun montrant « le badge à gagner ».
#
#  ── POURQUOI UN GÉNÉRATEUR ──────────────────────────────────────────
#
#  Soixante-six pokémon, chacun avec un niveau et trois chiffres qui se
#  CALCULENT depuis le niveau du défi. Changer un seul niveau d'arène,
#  c'est dix-huit chiffres à refaire à la main — et une page ne casse
#  pas quand elle mente. Plus onze badges, onze types, onze types
#  conseillés, onze adresses de forum et onze ancres de pré-lien.
#
#  Rien de tout ça n'est écrit ici : `data/arenes.json` tient les défis
#  et les textes, `data/equipes-de-champions.json` tient les équipes et
#  les types conseillés, et `data/personnages.json` dit si un poste a
#  son pré-lien.
#
#  ── PAS DE NOM DE CHAMPION SUR CETTE PAGE ───────────────────────────
#
#  « Aucune des informations affichées n'est bonne concernant le
#  champion en lui-même, il n'y a que son équipe » (6 novembre). Le
#  sujet des pré-liens propose onze personnages — Lars, Hana, Carmen… —
#  et ils ne font pas foi. La page renvoie donc vers le pré-lien et dit
#  « poste vacant » tant qu'aucune fiche n'existe dans
#  `data/personnages.json`. Le jour où une fiche est écrite, son nom
#  apparaît tout seul, et le renvoi pointe sur elle.
#
#  ── ET PAS DE JAVASCRIPT POUR LES SPRITES ───────────────────────────
#
#  Contrairement aux cartes d'une zone ou d'une brèche, les soixante-six
#  sprites sont écrits DANS la page. C'est possible ici et pas là-bas :
#  une équipe de champion est FIXE — six espèces décidées —, alors
#  qu'une zone en porte jusqu'à soixante-dix dont le joueur filtre
#  l'affichage. Six adresses écrites coûtent moins qu'un module, et la
#  page marche sans script.
#
#  Le style est celui du forum, comme sur la carte dresseur collée. Il
#  passe par `data/sprites-couverture.json` et PAS par un chemin écrit
#  en dur : le style du forum n'a pas de sprite pour tout le monde, et
#  la carte de couverture dit, espèce par espèce, où est le bon.
#
#  ── IL ÉCRIT ENTRE LES BORNES, COMME LA RÉDACTION ───────────────────
#
#  `outils/annexes.py` refait l'enveloppe de chaque page et conserve ce
#  qui est entre `▼▼▼ DÉBUT DU CORPS` et `▲▲▲ FIN DU CORPS`. Cet
#  outil-ci écrit ce corps-là.
# ════════════════════════════════════════════════════════════════════

import html
import json
import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).parent))
from annexes import (  # noqa: E402
    ARTWORK,
    STYLE,
    adresse_du_sprite,
    DEBUT,
    DECORS,
    FIN,
    PAGES,
    chemin_de_la_page,
    en_titre,
    entre_les_bornes,
    numero_de,
    pied_de_page,
    remplacer_le_corps,
    renvoi_vers,
    sans_accent,
    slug,
)

R = pathlib.Path(__file__).resolve().parent.parent
SLUG = "arenes-colosseums-ligues"

#  LA CARTE DE DRESSEUR DE MICHAEL. Elle porte son équipe, et elle est
#  PUBLIQUE — `t100`, le sujet de présentation de la Ligue, demande une
#  connexion. C'est la seule source qu'on puisse lire et citer.
PAGE = chemin_de_la_page(SLUG)
FORUM = "https://mysteryinrhode.forumactif.com"
#  LE SUJET DES PRÉ-LIENS. Une seule adresse, et les onze ancres sont
#  les numéros de message relevés dedans — voir `message` dans
#  `data/equipes-de-champions.json`.
PRELIENS = f"{FORUM}/t1002-les-champions"

PALIERS = {1: "Palier 1", 2: "Palier 2", 3: "Palier 3"}


def e(t):
    """Échappe, et c'est NON NÉGOCIABLE sur cette page.

    L'éditeur de pages HTML de Forumactif DÉCODE les entités au
    collage : un `<` laissé nu dans un nom finit en balise. C'est ce qui
    a mis la moitié de l'annexe 01 dans un `<table>` le 1er novembre.
    """
    return html.escape(str(t), quote=True)


def lire(chemin):
    return json.loads((R / chemin).read_text(encoding="utf-8"))


def renvoi(quoi, mot, adresse):
    """Un renvoi, avec sa surtitre et son nom.

    LE COMPOSANT S'EMPLOIE ENTIER. `a.wm-renvoi` ne déclare aucune
    couleur de texte — ce sont `__quoi` et `__mot` qui la portent. Du
    texte nu dedans prend la couleur du lien ordinaire sur le fond
    d'une carte : 1,81 de contraste en thème sombre, invisible en thème
    clair. Même balisage que `outils/annexe-personnages.py`, et c'est
    la raison : deux façons d'écrire le même composant divergent.

    LA FLÈCHE EST DÉCORATIVE : c'est le nom qui porte le lien.
    """
    return (
        f'<a class="wm-renvoi" href="{e(adresse)}">'
        f'<span class="wm-renvoi__quoi">{e(quoi)}</span>'
        f'<span class="wm-renvoi__mot">{e(mot)}</span>'
        '<span class="wm-renvoi__fleche" aria-hidden="true">→</span></a>'
    )


def pastille(cle, classe="wm-type"):
    """Une pastille de type. La CLÉ est sans accent — ce sont les classes
    de `css/13-composants.css` — et le NOM affiché la retrouve.

    PAS DE MODIFICATEUR SUR L'INFOBULLE, et c'est écrit dans la feuille :
    « ce ne sont pas les pastilles `.wm-type` […] sur le vert ou le
    violet de l'infobulle, aucune de ces paires n'a été mesurée ». Les
    types y sont translucides, et un `wm-infobulle__type--feu` serait
    une classe qui ne peint rien — donc une classe qu'on croirait
    utile. Seul `data-wm-type` reste, parce que lui porte le glyphe.
    """
    c = sans_accent(cle)
    modificateur = f" {classe}--{e(c)}" if classe == "wm-type" else ""
    return (f'<span class="{classe}{modificateur}" data-wm-type="{e(c)}">'
            f'{e(en_titre(c))}</span>')


def membre(w, m, couverture):
    """Une case d'équipe, avec son infobulle — SUR UNE SEULE LIGNE.

    L'INFOBULLE EST CELLE DU DÉPÔT — `wm-infobulle`, déjà stylée et déjà
    posée sur la carte dresseur. « Les pokémons de l'arène avec une
    infobulle pour afficher leur niveau » (6 novembre) : le niveau y est
    déjà, et les trois chiffres du combat avec.

    ── POURQUOI UNE SEULE LIGNE, ICI ET PAS AILLEURS ────────────────
    Soixante-six cases écrites comme le reste de la page faisaient
    143 109 caractères — MESURÉ — contre 128 000 que l'éditeur de pages
    de Forumactif accepte. Et il refuse EN SILENCE : la page se
    recharge, le contenu revient à l'état d'avant, aucun message.
    L'indentation à elle seule pesait 33 Ko sur 140.

    On ne gagne rien à aérer un bloc que personne ne lit : la source,
    c'est ce fichier-ci. Le reste de la page garde son indentation,
    parce que le reste de la page tient.
    """
    adresse = adresse_du_sprite(couverture, m["id"])
    if adresse is None:
        #  PAS D'IMAGE CASSÉE. La boîte vide est prévue par la feuille,
        #  et le nom reste écrit en dessous : on sait quelle bête
        #  manque, ce qu'une image en 404 ne dit pas.
        image = '<span class="wm-equipe__sprite wm-equipe__sprite--vide"></span>'
    else:
        image = (f'<img class="wm-equipe__sprite" src="{e(adresse)}" alt=""'
                 ' loading="lazy" />')
    #  ── LA CASE PORTE TOUS SES TYPES ───────────────────────────────
    #
    #  « Y'a des pokémons qui ont 2 types et tu les affiches pas »
    #  (9 novembre). Elle n'en portait qu'un, et j'avais écrit ici
    #  qu'« un double type y passerait sur deux lignes ». C'était vrai,
    #  et ça ne justifiait rien : un Roigada annoncé « Eau » quand il
    #  est Eau/Psy, c'est une information FAUSSE pour qui prépare un
    #  combat. L'infobulle les montrait tous les deux — mais il fallait
    #  la survoler pour le savoir, donc savoir qu'il fallait vérifier.
    #
    #  CE QUE ÇA COÛTE À LA PAGE : une pastille pèse environ 85
    #  caractères, et trente-huit cases de cette annexe ont deux types.
    #  Mesuré après coup, le garde-fou n° 33 le redit à chaque passage.
    #
    #  ── LA BULLE N'EST PLUS ÉCRITE ICI ─────────────────────────────
    #
    #  La case ne porte que ce qu'elle seule sait : ses types avec
    #  leur libellé, et les trois chiffres du combat.
    #  `module-equipe.ts` reconstruit la balise à l'affichage, à
    #  l'identique — nom et niveau compris, qui sont déjà écrits en
    #  clair juste au-dessus.
    #
    #  POURQUOI : mesuré le 9 novembre, une case avec sa bulle pèse
    #  1 021 caractères, sans elle 413. Soixante-douze cases, et la
    #  page à 120 622 sur les 128 000 que Forumactif accepte — avant
    #  les vingt-quatre pokémon du Conseil 4, qui en demandaient
    #  dix-neuf mille. Il n'y avait pas d'autre place à prendre.
    #
    #  CE QU'ON PERD : sans JavaScript, plus d'infobulle. Sur cette
    #  page-ci, ça ne retire rien : les équipes vivent dans des
    #  sous-onglets que le script ouvre, donc sans lui on ne les
    #  atteignait déjà pas.
    donnees = (
        ";".join(f'{sans_accent(ty)}:{en_titre(sans_accent(ty))}'
                 for ty in m["types"])
        + "|"
        + ",".join(str(m[cle]) for cle in ("pv", "att", "def"))
    )
    #  L'OBSCUR SE LIT SANS SURVOLER (10 nov.) : la case prend la
    #  teinte violette ET le mot. La bulle, elle, est montée par
    #  `module-equipe.ts`, qui lit la classe de la case — rien à
    #  passer dans `data-wm-bulle`.
    obscur = bool(m.get("obscur"))
    w(
        '<li class="wm-equipe__pkmn'
        + (" wm-equipe__pkmn--obscur" if obscur else "")
        + f'" tabindex="0" data-wm-bulle="{e(donnees)}">'
        + image
        + f'<p class="wm-equipe__nom">{e(m["nom"])}</p>'
        + ('<p class="wm-equipe__obscur">Obscur</p>' if obscur else "")
        + f'<p class="wm-equipe__niveau">niv. {m["niveau"]}</p>'
        + '<p class="wm-equipe__types">'
        + "".join(pastille(ty) for ty in m["types"])
        + "</p></li>"
    )


def defi(w, a, equipe, textes, couverture, fiche_du_poste, renvoi_personnages):
    """Un sous-onglet : un défi, son badge, ses types, ses liens, son équipe."""
    i = "              "
    w(f'{i}<section class="wm-defi" data-wm-sous-onglet="{e(slug(a["nom"]))}">')
    # ── LA TÊTE : LE BADGE ET LE NOM, PUIS LA VILLE ─────────────────
    #
    #  LE BADGE EST DANS LE TITRE, et c'est ce qui le met sur l'onglet.
    #  « Dans chaque onglet, tu affiches le badge » (6 novembre) :
    #  `poserLesSousOnglets` recopie sur le bouton l'icône qui est dans
    #  la tête de section — un SVG jusqu'ici, une image depuis
    #  aujourd'hui. Écrit là, il se voit sans JavaScript ; écrit dans le
    #  module, il disparaîtrait pour qui n'en a pas.
    #
    #  `img/badges/<slug>.png` : les mêmes images que la grille de la
    #  carte dresseur et que la liste des postes de l'annexe 10. Une
    #  seconde série finirait par ne plus ressembler à la première.
    #
    #  ET LE TITRE NE DIT QUE LE NOM. `textContent` ne ramasse pas
    #  l'image, donc l'onglet s'appelle « Arène Eau » ; la ville et le
    #  mot « badge » sont dans la ligne d'après, sinon ils entreraient
    #  dans le nom du bouton.
    w(f'{i}  <div class="wm-defi__tete">')
    w(f'{i}    <h3 class="wm-defi__titre">')
    w(f'{i}      <img class="wm-defi__badge" src="{PAGES}/img/badges/'
      f'{e(a["slug"])}.png" alt="" loading="lazy" />')
    w(f'{i}      <span class="wm-defi__nom">{e(a["nom"])}</span>')
    w(f'{i}    </h3>')
    w(f'{i}    <p class="wm-defi__lieu">{e(a["ville"])}'
      f' · badge {e(en_titre(sans_accent(a["type"])))} à gagner</p>')
    w(f'{i}  </div>')
    w("")

    # ── LA DESCRIPTION DE L'ARÈNE ───────────────────────────────────
    #
    #  « Ajoute de quoi faire une description pour chaque arène et
    #  chaque colosseum » (10 novembre). Elle se lit AVANT les trois
    #  faits : c'est le texte qui dit où l'on est et ce qu'on y
    #  trouve, et les chiffres n'ont de sens qu'après.
    #
    #  VIDE, RIEN NE S'AFFICHE. Onze arènes n'auront pas leur texte le
    #  même jour ; un paragraphe de remplissage en attendant serait
    #  pire que rien, parce qu'il finirait collé sur le forum.
    for paragraphe in a.get("description", []) or []:
        w(f'{i}  <p class="wm-defi__description">{e(paragraphe)}</p>')
    if a.get("description"):
        w("")

    # ── LES TROIS FAITS, EN CARTES ──────────────────────────────────
    #
    #  C'ÉTAIT UNE LISTE DE DÉFINITIONS À DEUX COLONNES, et ça ne
    #  marchait pas : « pas joli, manque de hiérarchie » (6 novembre).
    #  Une étiquette de 140 px en face d'une valeur, trois fois, fait un
    #  formulaire — tout y pèse pareil, et l'œil ne sait pas par où
    #  entrer.
    #
    #  Trois cartes, étiquette au-dessus et valeur en dessous : la
    #  valeur est ce qu'on lit, l'étiquette ce qui l'explique. Le `<dl>`
    #  reste — la relation terme/valeur est dans le balisage, pas
    #  seulement dans la mise en page.
    conseil = equipe["conseil"]
    w(f'{i}  <dl class="wm-defi__faits">')
    w(f'{i}    <div class="wm-defi__fait">')
    w(f'{i}      <dt class="wm-defi__mot">Type de l\'arène</dt>')
    w(f'{i}      <dd class="wm-defi__valeur">{pastille(a["type"])}</dd>')
    w(f'{i}    </div>')
    #  ── LE TYPE CONSEILLÉ VIENT DE L'ÉQUIPE, PAS DU TYPE DU DÉFI ──
    #
    #  Calculé par `outils/equipes-de-champions.py` sur les six membres
    #  réels. L'arène Vol aligne un Aéroptéryx Roche/Vol et un Altaria
    #  Dragon/Vol : « Électrik, super efficace contre Vol » se tromperait
    #  sur un tiers de l'équipe. Le chiffre est affiché avec, parce qu'un
    #  conseil sans son ampleur ne se compare pas d'un défi à l'autre.
    w(f'{i}    <div class="wm-defi__fait">')
    w(f'{i}      <dt class="wm-defi__mot">Type conseillé</dt>')
    w(f'{i}      <dd class="wm-defi__valeur">'
      + " ".join(pastille(t) for t in conseil["types"])
      + f'<span class="wm-defi__facteur">×{conseil["facteur"]:g} '
      'en moyenne</span></dd>')
    w(f'{i}    </div>')
    w(f'{i}    <div class="wm-defi__fait">')
    w(f'{i}      <dt class="wm-defi__mot">Niveau de l\'équipe</dt>')
    w(f'{i}      <dd class="wm-defi__valeur">'
      f'<b class="wm-defi__chiffre">{a["niveau"]}</b>'
      f'<span class="wm-defi__palier">{e(PALIERS[a["palier"]])}</span>'
      "</dd>")
    w(f'{i}    </div>')
    w(f'{i}  </dl>')
    w("")

    # ── les deux renvois ────────────────────────────────────────────
    #
    #  LE COMPOSANT S'EMPLOIE ENTIER, et il a fallu une mesure pour s'en
    #  souvenir. `a.wm-renvoi` ne déclare AUCUNE couleur de texte : ce
    #  sont ses deux enfants, `__quoi` et `__mot`, qui la portent. Avec
    #  du texte nu dedans, la couleur venait du lien ordinaire, posée
    #  sur le fond d'une carte — 1,81 de contraste en thème sombre,
    #  trente-trois fois sur la page. Mesuré par `outils/contraste.mjs`,
    #  invisible en thème clair.
    w(f'{i}  <p class="wm-defi__liens">')
    w(f'{i}    {renvoi("Défier le champion", a["nom"], FORUM + a["forum"])}')
    #  L'ANCRE EST LE NUMÉRO DU MESSAGE, relevé dans le sujet. Elle
    #  ouvre le pré-lien du bon champion plutôt que le haut d'un sujet
    #  de douze messages.
    ancre = f'{PRELIENS}#{equipe["message"]}'
    w(f'{i}    {renvoi("Le pré-lien", "Le champion proposé", ancre)}')
    adresse, numero, titre = renvoi_personnages
    if fiche_du_poste is None:
        w(f'{i}    {renvoi("Poste vacant", f"Annexe {numero} · {titre}", FORUM + adresse)}')
    else:
        w(f'{i}    {renvoi("Tenue par", fiche_du_poste["nom"], FORUM + adresse + "#les-champions")}')
    w(f'{i}  </p>')
    w("")

    # ── l'équipe ────────────────────────────────────────────────────
    eq = textes["equipe"]
    w(f'{i}  <h4 class="wm-defi__sous-titre">{e(eq["titre"])}</h4>')
    w(f'{i}  <ul class="wm-equipe">')
    for m in equipe["membres"]:
        membre(w, m, couverture)
    w(f'{i}  </ul>')
    #  RIEN SOUS L'ÉQUIPE. Deux paragraphes s'y trouvaient — l'équipe
    #  appartient à l'arène, et d'où viennent les chiffres. « Y'a une
    #  description sous l'équipe du défi : enlève-la » (10 nov.) : la
    #  section se termine sur les six cases, et ce qu'il y a à dire
    #  d'une arène se dit en haut, dans sa description.
    w(f'{i}</section>')
    w("")


def groupe(w, titre_onglet, bloc, defis, equipes, textes, couverture, fiches,
           renvoi_personnages):
    """Un onglet du milieu : son texte de rappel, puis un sous-onglet par défi."""
    w('          <section data-wm-sous-onglet="'
      f'{e(slug(titre_onglet))}">')
    w(f'            <h2 class="wm-annexe__carte-titre">{e(bloc["titre"])}</h2>')
    w('            <div class="wm-paras">')
    for para in bloc["paragraphes"]:
        w(f"              <p>{e(para)}</p>")
    w("            </div>")
    w("")
    #  ── LES SOUS-ONGLETS S'IMBRIQUENT ────────────────────────────
    #
    #  `poserLesSousOnglets` ne ramasse que les sections dont le groupe
    #  le plus proche est le sien — corrigé le 5 novembre pour les quatre
    #  évènements de Rhode. Un groupe dans un groupe marche donc, et
    #  aucun des deux n'a besoin de savoir que l'autre existe.
    w('            <div class="wm-defis wm-sous-onglets" data-wm-sous-onglets>')
    w("")
    #  L'ORDRE EST CELUI DES NIVEAUX. `data/arenes.json` garde son
    #  tableau groupé pour la grille de badges de la carte dresseur ;
    #  ici on lit le jeu, donc on trie.
    for a in sorted(defis, key=lambda a: a["niveau"]):
        defi(w, a, equipes[a["slug"]], textes, couverture,
             fiches.get(a["slug"]), renvoi_personnages)
    w("            </div>")
    w("")
    w("          </section>")
    w("")


def corps():
    arenes = lire("data/arenes.json")
    textes = arenes["textes"]
    equipes = lire("data/equipes-de-champions.json")["equipes"]
    couverture = lire("data/sprites-couverture.json")
    #  LES FICHES DE CHAMPION, PAR ARÈNE. La liste est vide aujourd'hui
    #  et c'est voulu — voir `_fiches` dans `data/personnages.json`.
    fiches = {
        f["arene"]: f
        for f in lire("data/personnages.json")["champions"]["fiches"]
    }
    renvoi_personnages = renvoi_vers("celebrites-de-rhode")

    manquants = [a["slug"] for a in arenes["arenes"] if a["slug"] not in equipes]
    if manquants:
        raise SystemExit(
            "pas d'équipe pour : " + ", ".join(manquants)
            + " — lance outils/equipes-de-champions.py --depuis"
        )

    out = []
    w = out.append

    #  LES BORNES FONT PARTIE DU CORPS : `entre_les_bornes` les rend avec
    #  lui et `remplacer_le_corps` les remplace avec lui. Les oublier
    #  produit une page sans corps, et la fois suivante l'outil ne sait
    #  plus où écrire.
    w(f"{DEBUT} — écrit par `outils/annexe-arenes.py` ▼▼▼ -->")
    photo, espece, _lieu = DECORS[SLUG]
    w(f"""<div class="wm-annexe wm-annexe--arenes" style="--annexe-fond: """
      f"""url('{PAGES}/assets/zones/{photo}.jpg'); """
      f"""--annexe-rendu: url('{ARTWORK}/{espece}.png')">""")
    w("")
    w('  <nav class="wm-annexe__sommaire" data-wm-sommaire aria-label="Les annexes"></nav>')
    w("")
    w('  <div class="wm-annexe__corps">')
    w('    <div class="wm-annexe__colonne">')
    w("")
    w(f'      <p class="wm-annexe__surtitre">Annexe {numero_de(SLUG)}</p>')
    w('      <h1 class="wm-annexe__titre">Arènes, <em>colosseums</em> et Ligue</h1>')
    w('      <p class="wm-annexe__chapo">')
    for ligne in textes["chapo"]:
        w(f"        {e(ligne)}")
    w("      </p>")
    w("")
    w('      <div class="wm-annexe__blocs">')
    w("")

    # ── QUATRE ONGLETS ──────────────────────────────────────────────
    w('        <div class="wm-annexe__carte wm-sous-onglets" data-wm-sous-onglets>')
    w("")

    # ── 1 · la présentation ─────────────────────────────────────────
    p = textes["presentation"]
    w('          <section data-wm-sous-onglet="comment-on-defie">')
    w(f'            <h2 class="wm-annexe__carte-titre">{e(p["titre"])}</h2>')
    w('            <div class="wm-paras">')
    for para in p["paragraphes"]:
        w(f"              <p>{e(para)}</p>")
    w("            </div>")
    w("")

    #  ── CE QUI S'OUVRE À QUEL PALIER, DÉRIVÉ ──────────────────────
    #
    #  La liste des défis d'un palier n'est pas écrite dans les textes :
    #  elle se lit dans `palier`. Recopiée, elle mentirait au premier
    #  arbitrage — et il y en a déjà un en attente, voir
    #  `_palier_contradiction` dans `data/arenes.json`.
    acces = p["acces"]
    w(f'            <h3 class="wm-defi__sous-titre">{e(acces["titre"])}</h3>')
    w('            <ul class="wm-paliers">')
    for n in (1, 2, 3):
        dedans = sorted(
            (a for a in arenes["arenes"] if a["palier"] == n),
            key=lambda a: a["niveau"],
        )
        w(f'              <li class="wm-palier wm-palier--{n}">')
        #  LA COULEUR DU PALIER EST DANS UNE PASTILLE, plus dans un
        #  filet à gauche : « ne mets pas un border à gauche, ne mets
        #  ça nulle part, ce n'est pas beau » (8 novembre). Le chiffre
        #  rempli porte la couleur bien mieux qu'un trait de 3 px, et
        #  il dit en même temps de quel palier il s'agit.
        w('                <div class="wm-palier__tete">')
        w(f'                  <span class="wm-palier__pastille">{n}</span>')
        w(f'                  <h4 class="wm-palier__titre">{e(PALIERS[n])}</h4>')
        w('                </div>')
        w(f'                <p class="wm-palier__condition">'
          f'{e(acces["conditions"][str(n)])}</p>')
        if dedans:
            w('                <ul class="wm-palier__defis">')
            for a in dedans:
                #  UN LIEN SIMPLE, PAS UN `wm-renvoi`. Le composant
                #  est une carte de 44 px de haut : onze d'affilée
                #  feraient trois colonnes de boutons là où on veut
                #  une liste. Et employé avec du texte nu, il perd sa
                #  couleur — mesuré à 1,81 en thème sombre.
                #  CHACUN PORTE SON BADGE : la même image que son
                #  onglet et que sa tête de section, donc on reconnaît
                #  le défi avant d'avoir lu son nom.
                w('                  <li class="wm-palier__defi">'
                  f'<img class="wm-palier__badge" src="{PAGES}/img/badges/'
                  f'{e(a["slug"])}.png" alt="" loading="lazy" />'
                  f'<a class="wm-palier__lien" href="{FORUM}'
                  f'{e(a["forum"])}">{e(a["nom"])}</a>'
                  f'<span class="wm-palier__niveau">niv. {a["niveau"]}</span>'
                  "</li>")
            w('                </ul>')
        else:
            #  LE PALIER 3 N'A AUCUN DÉFI, et ce n'est pas un oubli : la
            #  planche 36 n'y met que la Ligue. On l'écrit, plutôt que de
            #  laisser un trou qui ressemble à une donnée manquante.
            ligue = arenes["ligue"]
            w('                <p class="wm-palier__defis '
              'wm-palier__defis--vide">Aucune arène, aucun colosseum : '
              f'seulement {e(ligue["nom"])}, au niveau {ligue["niveau"]}.</p>')
        w('              </li>')
    w('            </ul>')
    w(f'            <p class="wm-defi__dit">{e(acces["note"])}</p>')
    w("")
    w("          </section>")
    w("")

    # ── 2 et 3 · les arènes, les colosseums ─────────────────────────
    for titre_onglet, cle, genre in (
        ("Les arènes", "arenes", "arene"),
        ("Les colosseums", "colosseums", "colosseum"),
    ):
        groupe(
            w,
            titre_onglet,
            textes[cle],
            [a for a in arenes["arenes"] if a["genre"] == genre],
            equipes,
            textes,
            couverture,
            fiches,
            renvoi_personnages,
        )

    # ── 4 · la Ligue ────────────────────────────────────────────────
    ligue, lt = arenes["ligue"], textes["ligue"]
    w('          <section data-wm-sous-onglet="la-ligue">')
    w(f'            <h2 class="wm-annexe__carte-titre">{e(lt["titre"])}</h2>')
    w('            <div class="wm-paras">')
    for para in lt["paragraphes"]:
        w(f"              <p>{e(para)}</p>")
    w("            </div>")
    w("")
    w('            <dl class="wm-defi__faits">')
    for mot, valeur in (
        ("Où", ligue["ville"]),
        ("Niveau de l'équipe", f'{ligue["niveau"]} · {PALIERS[3]}'),
        ("Tenue par", ligue["tenuePar"]),
    ):
        w('              <div class="wm-defi__fait">')
        w(f'                <dt class="wm-defi__mot">{e(mot)}</dt>')
        w(f'                <dd class="wm-defi__valeur">{e(valeur)}</dd>')
        w('              </div>')
    #  -- LE TYPE CONSEILLE, COMME POUR LES ONZE AUTRES -------------
    #
    #  Il n'existe que depuis que la Ligue a une equipe : il se calcule
    #  sur ses six membres, pas sur un type de defi -- la Ligue n'en a
    #  pas. C'est la meme moyenne d'efficacite que partout ailleurs.
    equipe_ligue = equipes.get("ligue")
    if equipe_ligue is not None:
        conseil = equipe_ligue["conseil"]
        w('              <div class="wm-defi__fait">')
        w('                <dt class="wm-defi__mot">Type conseillé</dt>')
        w('                <dd class="wm-defi__valeur">'
          + " ".join(pastille(t) for t in conseil["types"])
          + '<span class="wm-defi__facteur">×'
          + f'{conseil["facteur"]:g} en moyenne</span></dd>')
        w('              </div>')
    w('            </dl>')
    w("")
    w(f'            <p class="wm-defi__dit">{e(lt["note"])}</p>')
    w("")

    #  ── LE CONSEIL 4, PUIS LE CHAMPION ────────────────────────────
    #
    #  Cinq équipes dans cet onglet, et dans cet ordre : on monte les
    #  marches avant d'arriver en haut. Relevées le 9 novembre sur le
    #  deuxième message de t100.
    #
    #  LES MEMBRES DU CONSEIL N'ONT PAS DE NOM. Le sujet les annonce
    #  « Conseil 4 » avec leur icône de type, et rien d'autre. On n'en
    #  invente pas : le type EST leur nom ici, écrit en toutes lettres
    #  — une pastille de couleur seule ne dit rien à qui ne distingue
    #  pas le violet du psy du violet du poison.
    #
    #  PLUS DE RENVOI VERS LA CARTE DE DRESSEUR DE MICHAEL : « on
    #  affichera plus la carte de dresseur de Michael à l'avenir »
    #  (9 novembre). Son équipe est ici, et le sujet de la Ligue la
    #  porte aussi.
    if equipe_ligue is not None:
        for membre4 in equipe_ligue.get("conseil4", []):
            niveaux = [m["niveau"] for m in membre4["membres"]]
            titre = (f'Conseil 4 · {en_titre(sans_accent(membre4["type"]))}'
                     f' — niveaux {min(niveaux)} à {max(niveaux)}')
            w(f'            <h4 class="wm-defi__sous-titre">{e(titre)}</h4>')
            w('            <ul class="wm-equipe">')
            for m in membre4["membres"]:
                membre(w, m, couverture)
            w('            </ul>')
            w("")
        niveaux = [m["niveau"] for m in equipe_ligue["membres"]]
        #  « champion de Rhode » est le titre que le sujet lui donne,
        #  en capitales au-dessus de son équipe. On le reprend tel
        #  quel plutôt que de recomposer un intitulé avec le nom de la
        #  Ligue, qui donnait « Michael, la ligue ».
        titre = (f'{ligue["tenuePar"]}, champion de Rhode'
                 f' — niveaux {min(niveaux)} à {max(niveaux)}')
        w(f'            <h4 class="wm-defi__sous-titre">{e(titre)}</h4>')
        w('            <ul class="wm-equipe">')
        for m in equipe_ligue["membres"]:
            membre(w, m, couverture)
        w('            </ul>')
        w("")
    w("          </section>")
    w("")
    w("")

    w("        </div>")
    w("")

    #  LE PIED VIENT DE `annexes.py`, pas d'ici : il porte la page
    #  suivante et les deux boutons de contact, les mêmes sur les
    #  quatorze annexes. Deux versions du même bloc, c'est une de trop.
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
                "annexe-06 : le corps ne correspond plus aux données — "
                "lance « python3 outils/annexe-arenes.py »"
            )
        print(f"annexe-06 : à jour ({len(ancien)} caractères).")
        return 0

    PAGE.write_text(neuf, encoding="utf-8")
    #  LA LIMITE DE FORUMACTIF EST DE 128 000 CARACTÈRES par page HTML,
    #  et elle refuse EN SILENCE : la page se recharge sans rien dire et
    #  revient à l'état d'avant. On mesure donc à chaque écriture.
    print(f"annexe-06 écrite : {len(neuf)} caractères "
          "(limite Forumactif : 128 000).")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
