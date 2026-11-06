#!/usr/bin/env python3
# ════════════════════════════════════════════════════════════════════
#  outils/annexe-personnages.py — le corps de l'annexe 11
#
#  Les personnages du jeu, les célébrités de Rhode et les champions.
#
#  ── POURQUOI UN GÉNÉRATEUR, ET PAS DU HTML ÉCRIT À LA MAIN ──────────
#
#  Pour une seule raison, mais elle suffit : LES ONZE CHAMPIONS SONT
#  LES ONZE ARÈNES. Ils viennent de `data/arenes.json`, qui est déjà la
#  source du code à coller de la carte dresseur et du compteur de la
#  Ligue. Écrits une seconde fois à la main dans une page, ils auraient
#  dérivé au premier renommage — et la dérive serait muette, comme
#  toujours.
#
#  Le reste — les fiches, les textes — vit dans
#  `data/personnages.json`. On corrige là, jamais dans la page : une
#  correction faite dans le HTML repartirait à la génération suivante.
#
#  ── CE QU'IL N'INVENTE PAS ──────────────────────────────────────────
#
#  Aucun avatar. Les GIF sont ceux du sujet « Personnages jouables » du
#  forum, relevés le 4 novembre ; il n'y en a que pour les personnages
#  jouables ou joués, parce qu'un PNJ n'a pas d'avatar à proposer. Les
#  « FC » sont de vraies personnes et on ne va pas chercher leur photo :
#  le nom reste écrit comme ce qu'il est — une suggestion.
#
#  ── LES TROIS STATUTS ───────────────────────────────────────────────
#
#  `jouable`, `joue`, `pnj`. Le sujet d'origine en écrit six mots pour
#  ces trois états ; le ramassage est fait ICI, une fois, par
#  `CLE_DU_STATUT`. Un quatrième mot dans le fichier arrête la
#  génération : il ne serait filtré par aucun bouton, et la fiche
#  resterait visible sans jamais apparaître dans un compte.
# ════════════════════════════════════════════════════════════════════

import html
import json
import os
import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).parent))
from annexes import (  # noqa: E402
    DEBUT,
    FIN,
    entre_les_bornes,
    chemin_de_la_page,
    en_titre,
    numero_de,
    pied_de_page,
    remplacer_le_corps,
    renvoi_vers,
    sans_accent,
)

R = pathlib.Path(__file__).resolve().parent.parent
PAGE = chemin_de_la_page("celebrites-de-rhode")

#  DEUX COUTURES POUR LA MESURE, et deux seulement.
#
#  Le harnais doit pouvoir rendre une fiche REMPLIE : aujourd'hui le
#  fichier n'en porte aucune, et une mise en page qu'on ne voit jamais
#  remplie est une mise en page qu'on n'a pas vérifiée. Il écrit donc un
#  fichier de données d'essai, lance CE générateur dessus, et mesure la
#  page qui en sort.
#
#  C'est la vraie chaîne — même lecture, même rendu, même feuille — avec
#  d'autres données. Un gabarit HTML écrit à la main dans le harnais
#  mesurerait le gabarit, pas le générateur.
DONNEES = pathlib.Path(os.environ.get("WM_PERSONNAGES", R / "data/personnages.json"))
PAGES = "https://by-teenspirit.github.io/wild-mystery"
ARTWORK = (
    "https://raw.githubusercontent.com/PokeAPI/sprites/"
    "bfb75391935310368065096fa08c51e8970bc43e/sprites/pokemon/other/official-artwork"
)


#  LES MOTS DU LECTEUR, PAR CLÉ. Ils doivent dire la même chose que
#  `MOTS` dans `src/navigateur/personnages.ts` — ce sont les deux bouts
#  du même tri, et `outils/personnages.mjs` vérifie qu'ils collent.
MOT_DU_STATUT = {"jouable": "Jouable", "joue": "Joué", "pnj": "PNJ"}

#  CE QUE CHAQUE STATUT VEUT DIRE, en une ligne, sous la barre. Sans
#  ça, « PNJ » et « Joué » se confondent : dans les deux cas on ne peut
#  pas le prendre, mais pas pour la même raison.
DIT_DU_STATUT = {
    "jouable": "le poste est libre, tu peux le demander",
    "joue": "quelqu'un le joue déjà sur le forum",
    "pnj": "le staff le tient — on ne le joue pas",
}



def renvoi(adresse, quoi, mot):
    """Un bouton de renvoi : ce que c'est, où ça mène, et une flèche.

    DEUX LIGNES PLUTÔT QU'UNE. « Le sujet des champions → » disait où
    on allait sans dire QUOI on allait trouver : un sujet du forum, une
    annexe, une page extérieure ? La surtitre le dit, et le nom reste
    lisible seul.

    LA FLÈCHE EST DÉCORATIVE : c'est le nom qui porte le lien, et un
    lecteur d'écran qui annonce « flèche vers la droite » après chaque
    renvoi fatigue pour rien.
    """
    return (
        f'              <a class="wm-renvoi" href="{e(adresse)}">'
        f'<span class="wm-renvoi__quoi">{e(quoi)}</span>'
        f'<span class="wm-renvoi__mot">{e(mot)}</span>'
        '<span class="wm-renvoi__fleche" aria-hidden="true">→</span></a>'
    )


def e(t):
    """Échappe. Non négociable : l'éditeur de pages HTML de Forumactif
    DÉCODE les entités au collage, et un `<` resté dans un texte de
    personnage emporterait la moitié de la page — vu sur l'annexe 01 le
    1er novembre."""
    return html.escape(str(t), quote=True)


def lire(chemin):
    return json.loads((R / chemin).read_text(encoding="utf-8"))


def fiche(w, f, indent):
    """Une carte de personnage. Deux par rangée, la feuille s'en charge."""
    i = " " * indent
    statut = f["statut"]
    if statut not in MOT_DU_STATUT:
        raise SystemExit(
            f"{f['nom']} : statut « {statut} » inconnu — attendu "
            f"{', '.join(MOT_DU_STATUT)} (voir `_statuts` dans data/personnages.json)"
        )

    #  LE STATUT EST SUR LE `<li>`, pas seulement dans l'étiquette : la
    #  barre de filtres lit cet attribut, et le lire sur un texte
    #  affiché se casserait au premier changement de formulation.
    w(f'{i}<li class="wm-perso" data-wm-statut-fiche="{e(statut)}">')

    #  L'AVATAR OU SA PLACE. Une carte sans image ne doit pas être plus
    #  courte que sa voisine : la silhouette tient la grille droite.
    #  Pas de `width`/`height` : ces GIF font de 268 à 500 pixels de
    #  large et c'est la feuille qui les cadre.
    if f.get("avatar"):
        w(f'{i}  <img class="wm-perso__avatar" src="{e(f["avatar"])}" alt=""'
          ' loading="lazy" />')
    else:
        w(f'{i}  <span class="wm-perso__avatar wm-perso__avatar--vide"'
          ' aria-hidden="true"></span>')

    w(f'{i}  <div class="wm-perso__corps">')
    w(f'{i}    <h3 class="wm-perso__nom">{e(f["nom"])}</h3>')

    #  LE STATUT D'ABORD, en couleur : c'est la seule information qu'on
    #  vient chercher en diagonale. Le rôle et l'origine suivent, en
    #  gris — ils situent, ils ne décident rien.
    w(f'{i}    <p class="wm-perso__etiquettes">')
    w(f'{i}      <span class="wm-perso__statut" data-wm-statut="{e(statut)}">'
      f'<strong>{e(MOT_DU_STATUT[statut])}</strong></span>')
    w(f"{i}    </p>")

    #  OÙ ON LE SITUE : en texte gris, pas en pastille. En pastille,
    #  « Protagoniste de Pokémon Colosseum » prenait deux lignes de
    #  capitales et pesait plus lourd que le nom du personnage.
    situe = [x for x in (f.get("role"), f.get("origine")) if x]
    if situe:
        w(f'{i}    <p class="wm-perso__situe">{e(" · ".join(situe))}</p>')

    w(f'{i}    <p class="wm-perso__texte">{e(f["texte"])}</p>')

    if f.get("traits"):
        w(f'{i}    <p class="wm-perso__traits">')
        for t in f["traits"]:
            w(f'{i}      <span class="wm-perso__trait">{e(t)}</span>')
        w(f"{i}    </p>")

    if f.get("fc"):
        w(f'{i}    <p class="wm-perso__fc">Suggestion d\'avatar :'
          f" <b>{e(f['fc'])}</b></p>")

    w(f"{i}  </div>")
    w(f"{i}</li>")


def cadre_de_liens(w, i, variante, etiquette, dit, liens):
    """Un cadre de relations : les affinités, ou les rivalités.

    DEUX CADRES CÔTE À CÔTE, et la couleur ne porte rien. Le vert et le
    rouge disent vite lequel est lequel, mais un joueur sur douze ne
    distingue pas les deux : l'étiquette le dit en mots, en capitales,
    et c'est elle qui fait foi. C'est la même règle que les trois
    teintes d'encart — « un sens porté par la seule couleur ne se lit
    pas ».

    UN CADRE VIDE NE S'AFFICHE PAS. Un « Rivalités : néant » encadré
    occupe la place d'une information sans en être une ; et quand les
    deux manquent, la rangée disparaît avec eux.
    """
    if not liens:
        return
    w(f'{i}<div class="wm-relation wm-relation--{e(variante)}">')
    w(f'{i}  <span class="wm-relation__etiquette">{e(etiquette)}</span>')
    w(f'{i}  <ul class="wm-relation__liste">')
    for qui, quoi in liens:
        w(f'{i}    <li class="wm-relation__ligne">'
          f'<b class="wm-relation__qui">{e(qui)}</b> '
          f'<span class="wm-relation__quoi">{e(quoi)}</span></li>')
    w(f"{i}  </ul>")
    #  LE MOT SOUS LA LISTE, pas au-dessus : c'est une note de lecture,
    #  elle ne doit pas se lire avant ce qu'elle annote.
    if dit:
        w(f'{i}  <p class="wm-relation__dit">{e(dit)}</p>')
    w(f"{i}</div>")


def champion(w, f, par_slug, adresse_annexe, numero_annexe, titre_annexe, indent):
    """Une fiche de pré-lien de champion.

    CE QU'ELLE PORTE, dans cet ordre : l'arène à laquelle le pré-lien
    appartient, le nom, le portrait, la tranche d'âge, les traits en
    tags, ses affinités et ses rivalités face à face, et deux liens —
    son arène sur le forum, et l'annexe des arènes.

    L'ARÈNE EST LUE DANS `data/arenes.json`, jamais recopiée ici : le
    nom, la ville, le type, le niveau et l'adresse du forum viennent de
    la liste qui sert déjà au code à coller de la carte dresseur. Un
    slug inconnu arrête la génération — une fiche accrochée à une arène
    qui n'existe pas serait un lien mort, et un lien mort sur
    Forumactif ne tombe pas en 404 : il mène ailleurs en silence.

    PAS DE FICHE SANS NOM. Un poste vacant n'est pas un pré-lien : il
    est déjà dans la liste des onze postes au-dessus, qui dit « poste
    vacant » et mène à son ancre. Une fiche vide ici ferait une
    deuxième liste des mêmes onze postes, et deux listes finissent par
    diverger.
    """
    i = " " * indent
    nom = (f.get("nom") or "").strip()
    if not nom:
        raise SystemExit(
            "une fiche de champion sans `nom` — un poste vacant reste dans la "
            "liste des onze postes (voir `_fiches` dans data/personnages.json)"
        )
    slug = f.get("arene")
    if slug not in par_slug:
        raise SystemExit(
            f"{nom} : arène « {slug} » inconnue — attendu l'un des slugs de "
            f"data/arenes.json ({', '.join(par_slug)})"
        )
    a = par_slug[slug]

    w(f'{i}<li class="wm-champion" data-wm-arene="{e(slug)}">')

    #  ── LA TÊTE : le portrait, puis qui c'est ──────────────────────
    w(f'{i}  <div class="wm-champion__tete">')
    #  LE PORTRAIT EST CARRÉ, et sa place est tenue même sans image :
    #  une fiche sans portrait ne doit pas décaler le texte de sa
    #  voisine. Pas de `width`/`height` sur la balise — ces images font
    #  de 275 à 600 pixels de côté et c'est la feuille qui les cadre.
    if f.get("image"):
        w(f'{i}    <img class="wm-champion__portrait" src="{e(f["image"])}"'
          ' alt="" loading="lazy" />')
    else:
        w(f'{i}    <span class="wm-champion__portrait wm-champion__portrait--vide"'
          ' aria-hidden="true"></span>')

    w(f'{i}    <div class="wm-champion__identite">')
    #  L'ARÈNE AVANT LE NOM, et en petit : on arrive sur cette fiche
    #  parce qu'on cherche un poste, pas parce qu'on cherche quelqu'un.
    #  Le badge de l'arène tient la vignette ; son image est celle de la
    #  grille de la carte dresseur, img/badges/<slug>.png.
    w(f'{i}      <p class="wm-champion__arene">')
    w(f'{i}        <img class="wm-champion__badge" src="'
      f'{PAGES}/img/badges/{e(a["slug"])}.png" alt="" loading="lazy"'
      ' width="22" height="22" />')
    w(f'{i}        <span class="wm-champion__ou">{e(a["nom"])}'
      f' · {e(a["ville"])}</span>')
    w(f'{i}      </p>')
    w(f'{i}      <h4 class="wm-champion__nom">{e(nom)}</h4>')

    #  ── LES TAGS : l'âge d'abord, puis le caractère ────────────────
    #
    #  L'ÂGE EST UN TAG À PART, pas un trait. C'est une donnée de fiche
    #  — on la compare, on l'utilise pour choisir — là où un trait est
    #  une impression. Mélangés dans la même rangée de pastilles
    #  identiques, « 25 – 30 ans » se lisait comme un trait de
    #  caractère de plus.
    #  LE TYPE EN PREMIER, et c'est la pastille `wm-type` du reste du
    #  forum — dix-huit teintes dont chaque paire fond/texte est
    #  validée à 4,5 dans les deux thèmes. Elle gagne sa place surtout
    #  pour les QUATRE COLOSSEUMS, dont le nom ne dit pas le type :
    #  « Colosseum de Titanite » ne se lit pas Dragon.
    #
    #  Et c'est elle qui donne à chaque fiche sa couleur : sur onze
    #  fiches d'affilée, c'est le seul repère qui se voit de loin.
    cle = sans_accent(a["type"])
    w(f'{i}      <p class="wm-champion__tags">')
    w(f'{i}        <span class="wm-type wm-type--{e(cle)}"'
      f' data-wm-type="{e(cle)}">{e(en_titre(a["type"]))}</span>')
    w(f'{i}        <span class="wm-champion__niveau">niveau'
      f' {e(a["niveau"])}</span>')
    #  Puis ce qui appartient au personnage, pas à l'arène.
    if f.get("age"):
        w(f'{i}        <span class="wm-champion__age">{e(f["age"])}</span>')
    for t in f.get("traits") or []:
        w(f'{i}        <span class="wm-champion__trait">{e(t)}</span>')
    w(f'{i}      </p>')
    w(f"{i}    </div>")
    w(f"{i}  </div>")

    if f.get("texte"):
        w(f'{i}  <p class="wm-champion__texte">{e(f["texte"])}</p>')

    #  ── LES DEUX CADRES, FACE À FACE ───────────────────────────────
    affinites = [tuple(x) for x in (f.get("affinites") or [])]
    rivalites = [tuple(x) for x in (f.get("rivalites") or [])]
    if affinites or rivalites:
        w(f'{i}  <div class="wm-champion__relations">')
        cadre_de_liens(w, i + "    ", "affinite", "Affinités",
                       f.get("ditAffinites"), affinites)
        cadre_de_liens(w, i + "    ", "rivalite", "Rivalités",
                       f.get("ditRivalites"), rivalites)
        w(f"{i}  </div>")

    #  ── OÙ ÇA MÈNE : son arène, puis l'annexe des arènes ───────────
    #
    #  L'ADRESSE DU FORUM EST RELEVÉE, PAS DEVINÉE — elle vient de
    #  `data/arenes.json`, où elle a été recopiée des liens que le forum
    #  écrit lui-même. Celle de l'annexe vient du sommaire, numéro
    #  compris, par `renvoi_vers`.
    w(f'{i}  <p class="wm-renvois">')
    w(f"{i}    " + renvoi(a["forum"], "Forum du jeu", a["nom"]).strip())
    w(f"{i}    " + renvoi(adresse_annexe, f"Annexe {numero_annexe}",
                          titre_annexe).strip())
    w(f"{i}  </p>")
    w(f"{i}</li>")


def corps():
    p = lire(DONNEES)
    arenes = lire("data/arenes.json")["arenes"]

    out = []
    w = out.append

    w(f"{DEBUT} — écrit par `outils/annexe-personnages.py` ▼▼▼ -->")
    w('<div class="wm-annexe" style="--annexe-fond: url(\''
      f"{PAGES}/assets/zones/libra-echoue.jpg'); "
      f"--annexe-rendu: url('{ARTWORK}/249.png')\">")
    w("")
    w('  <nav class="wm-annexe__sommaire" data-wm-sommaire aria-label="Les annexes"></nav>')
    w("")
    w('  <div class="wm-annexe__corps">')
    w('    <div class="wm-annexe__colonne">')
    w("")
    w('      <p class="wm-annexe__surtitre">Annexe '
      f'{numero_de("celebrites-de-rhode")}</p>')
    w('      <h1 class="wm-annexe__titre">Personnages jouables, champions'
      " \u0026 <em>célébrités</em></h1>")
    w('      <p class="wm-annexe__chapo">')
    w("        Qui tout le monde connaît à Rhode, lesquels sont libres à jouer,")
    w("        et qui tient les onze arènes. Les trois boutons sous la liste")
    w("        trient les quatorze fiches : jouable, joué, PNJ.")
    w("      </p>")
    w("")
    w('      <div class="wm-annexe__blocs">')
    w('        <div class="wm-annexe__carte wm-sous-onglets" data-wm-sous-onglets>')
    w("")

    # ── 1 · les célébrités de Rhode ─────────────────────────────────
    #
    #  UNE SEULE LISTE, et trois boutons qui la trient. C'était deux
    #  sections avant le 4 novembre — « personnages du jeu » puis
    #  « célébrités » — et les mêmes personnages y figuraient deux fois,
    #  une fois en détail et une fois en groupe. Une fiche par
    #  personnage, son statut dessus, et le tri au lecteur.
    c = p["celebrites"]
    w('          <section data-wm-sous-onglet="celebrites">')
    w(f'            <h2 class="wm-annexe__carte-titre">{e(c["titre"])}</h2>')
    w('            <div class="wm-paras">')
    for para in c["intro"]:
        w(f"              <p>{e(para)}</p>")
    w("            </div>")
    w(f'            <h3 class="wm-perso__section">{e(c["colosseum"]["titre"])}</h3>')
    w('            <div class="wm-paras">')
    for para in c["colosseum"]["paragraphes"]:
        w(f"              <p>{e(para)}</p>")
    w("            </div>")

    #  LES DEUX PHRASES DE BANDE. Elles parlaient des admins en bloc,
    #  du temps où ils tenaient une seule fiche à cinq. Descendues dans
    #  les fiches, elles seraient recopiées cinq fois ; elles restent
    #  au-dessus, une fois chacune.
    w('            <div class="wm-encarts">')
    for n, (titre, texte) in enumerate(c["groupes"]):
        w('              <div class="wm-encart wm-encart--'
          f'{"terre" if n % 2 == 0 else "paisible"}">')
        w(f'                <span class="wm-encart__etiquette">{e(titre)}</span>')
        w(f"                <p>{e(texte)}</p>")
        w("              </div>")
    w("            </div>")

    #  LA LÉGENDE DES TROIS STATUTS, écrite dans la page. La barre de
    #  boutons, elle, est posée par `module-personnages.ts` : un bouton
    #  n'a le droit de cacher que ce qu'il peut remontrer. Sans
    #  JavaScript, il reste la légende et les quatorze fiches.
    w('            <ul class="wm-tirets wm-statuts-dits">')
    for cle, mot in MOT_DU_STATUT.items():
        w('              <li><span class="wm-perso__statut" data-wm-statut="'
          f'{e(cle)}"><strong>{e(mot)}</strong></span> {e(DIT_DU_STATUT[cle])}</li>')
    w("            </ul>")

    w('            <ul class="wm-persos" data-wm-filtres>')
    for f in c["fiches"]:
        fiche(w, f, 14)
    w("            </ul>")
    w('            <p class="wm-renvois">')
    w(renvoi(p["champions"]["lienJouables"], "Sujet du forum",
             "Les personnages jouables"))
    w("            </p>")
    w("          </section>")
    w("")

    # ── 3 · les champions ───────────────────────────────────────────
    ch = p["champions"]
    w('          <section data-wm-sous-onglet="les-champions">')
    w(f'            <h2 class="wm-annexe__carte-titre">{e(ch["titre"])}</h2>')
    w('            <div class="wm-paras">')
    for para in ch["intro"]:
        w(f"              <p>{e(para)}</p>")
    w("            </div>")
    w('            <ul class="wm-tirets">')
    for titre, texte in ch["regles"]:
        w(f"              <li><b>{e(titre)}.</b> {e(texte)}</li>")
    w("            </ul>")

    #  L'ARÈNE PAR SLUG, une fois : la liste des postes et les fiches
    #  de pré-lien y puisent toutes les deux.
    par_slug = {a["slug"]: a for a in arenes}
    fiches = ch.get("fiches") or []
    avec_fiche = {f.get("arene") for f in fiches}
    adresse, numero, titre_annexe = renvoi_vers("arenes-colosseums-ligues")

    #  ── LES ONZE POSTES, TIRÉS DE `data/arenes.json` ──────────────
    #
    #  Sept arènes et quatre colosseums. Les recopier ici serait une
    #  seconde liste, et la règle 24 du garde-fou existe précisément
    #  parce que deux listes finissent par diverger.
    #
    #  ── ET ELLES SONT TRIÉES PAR NIVEAU ───────────────────────────
    #
    #  C'est l'ordre des défis depuis le 6 novembre : l'Arène Eau à 10
    #  passe devant l'Arène Feu à 15, là où l'ordre « imposé » de la
    #  planche 36 la mettait troisième. Le tri est fait ICI, sur
    #  `niveau`, et pas en rangeant le fichier : la position dans
    #  `data/arenes.json` tient la grille de badges de la carte
    #  dresseur, dont les onze cases sont en dur dans le code à coller.
    for genre, titre, dit in [
        ("arene", "Les sept arènes",
         "Un type, une ville, un badge et un niveau chacune. "
         "On les fait dans l'ordre des niveaux."),
        ("colosseum", "Les quatre colosseums",
         "On y combat en 2 contre 2. Ils s'intercalent entre les arènes, "
         "au niveau qui est le leur."),
    ]:
        dedans = sorted(
            (a for a in arenes if a.get("genre") == genre),
            key=lambda a: a["niveau"],
        )
        w(f'            <h3 class="wm-perso__section">{e(titre)}</h3>')
        w(f'            <p class="wm-perso__dit">{e(dit)}</p>')
        w('            <ul class="wm-postes">')
        for a in dedans:
            #  ── CHAQUE POSTE MÈNE À SON ANCRE ─────────────────────
            #
            #  L'ancre est le slug de l'arène, celui de
            #  `data/arenes.json` : il sert déjà au code à coller de
            #  la carte dresseur et au compteur de la Ligue, donc il
            #  est stable et il ne s'invente pas ici.
            w('              <li>')
            w('                <a class="wm-poste" href="'
              f'{e(ch["lien"])}#{e(a["slug"])}">')
            w('                  <span class="wm-poste__vignette">')
            w('                    <img class="wm-poste__type" src="'
              f'{PAGES}/img/types/{e(a["type"])}.png" alt="" loading="lazy"'
              ' width="28" height="28" />')
            w("                  </span>")
            w('                  <span class="wm-poste__mots">')
            w(f'                    <b class="wm-poste__nom">{e(a["nom"])}</b>')
            w('                    <span class="wm-poste__ville">'
              f'{e(a["ville"])} · type {e(a["type"])} · niveau '
              f'{e(a["niveau"])} · palier {e(a["palier"])}</span>')
            w("                  </span>")
            #  « POSTE VACANT » TANT QUE PERSONNE N'EST ÉCRIT, et
            #  « pré-lien écrit » dès qu'une fiche porte ce slug. Le
            #  fichier ne porte aucun nom de champion aujourd'hui ;
            #  inventer un titulaire serait inventer un personnage.
            etat = "pré-lien écrit" if a["slug"] in avec_fiche else "poste vacant"
            w(f'                  <span class="wm-poste__etat">{e(etat)}</span>')
            w('                  <span class="wm-poste__fleche" aria-hidden="true">→</span>')
            w("                </a>")
            w("              </li>")
        w("            </ul>")

    #  ── LES PRÉ-LIENS DE CHAMPION ─────────────────────────────────
    #
    #  UNE FICHE PAR PRÉ-LIEN ÉCRIT, et rien quand il n'y en a aucun.
    #  La liste des onze postes au-dessus dit déjà quels postes
    #  existent et lesquels sont libres ; une fiche vide par poste
    #  vacant en ferait une seconde liste des mêmes onze lignes.
    #
    #  Aujourd'hui `champions.fiches` est vide : la section n'apparaît
    #  pas, et la page ne promet rien qu'elle n'a pas.
    if fiches:
        w('            <h3 class="wm-perso__section">Les pré-liens de champion</h3>')
        w('            <p class="wm-perso__dit">Des champions déjà écrits, '
          'avec leur caractère et leurs liens. Prendre le pré-lien, c\'est '
          'prendre le personnage tel qu\'il est.</p>')
        w('            <ul class="wm-champions">')
        for f in fiches:
            champion(w, f, par_slug, adresse, numero, titre_annexe, 14)
        w("            </ul>")

    #  DE L'AIR AVANT L'ENCART : collé aux colosseums, il avait l'air
    #  d'être la onzième ligne de la liste.
    w('            <div class="wm-encarts wm-encarts--detachee">')
    w('              <div class="wm-encart wm-encart--paisible">')
    w('                <span class="wm-encart__etiquette">Un poste t\'intéresse ?</span>')
    w(f"                <p>{e(ch['contact'])}</p>")
    w("              </div>")
    w("            </div>")
    #  ── DEUX RENVOIS, ET L'ADRESSE VIENT DU SOMMAIRE ───────────
    #
    #  « Est-ce que tu peux afficher de manière plus jolie ces
    #  boutons ? » (5 novembre) — deux liens soulignés en fin de
    #  section, qui ne ressemblaient à rien et ne disaient pas où ils
    #  menaient : un sujet du forum ou une autre annexe ?
    #
    #  Le second écrivait son adresse À LA MAIN, numéro compris. Ça
    #  marchait, et ça ne garantissait rien : Forumactif ne route que
    #  sur le numéro, et une adresse dont le numéro a glissé mène
    #  ailleurs sans tomber en 404. `renvoi_vers` la prend au sommaire,
    #  le numéro avec.
    #
    #  (Et le garde-fou a crié sur la première version de ce
    #  commentaire, où j'avais recopié l'adresse pour l'exemple, coupée
    #  en deux lignes. Il a eu raison deux fois : une adresse écrite
    #  hors du sommaire est une adresse de trop, même dans un
    #  commentaire.)
    #  (Les trois valeurs sont prises plus haut, une fois : les fiches
    #  de pré-lien renvoient vers la même annexe.)
    w('            <p class="wm-renvois">')
    w(renvoi(ch["lien"], "Sujet du forum", "Les champions"))
    w(renvoi(adresse, f"Annexe {numero}", titre_annexe))
    w("            </p>")
    w("          </section>")
    w("")
    w("        </div>")
    w("")

    # ── le pied du gabarit ──────────────────────────────────────────
    #  LE PIED VIENT DE `annexes.py`, pas d'ici. Il porte la page
    #  suivante et les deux boutons de contact : les mêmes sur les
    #  quatorze annexes, et `annexes.py` les refait de toute façon à la
    #  passe suivante. Deux versions du même bloc, c'est une version de
    #  trop — et `--verifier` crierait au premier écart.
    w(pied_de_page("celebrites-de-rhode"))
    w("")
    w("      </div>")
    w("    </div>")
    w("  </div>")
    w("</div>")
    w(FIN)
    return "\n".join(out)


def main():
    verifier = "--verifier" in sys.argv
    #  `--sortie CHEMIN` écrit la page AILLEURS. Le gabarit lu reste
    #  celui du dépôt — mêmes bornes, même pied, même décor — seule la
    #  destination change. C'est ce qui permet au harnais de rendre une
    #  page de données d'essai sans écrire dans `pages/`.
    sortie = PAGE
    if "--sortie" in sys.argv:
        sortie = pathlib.Path(sys.argv[sys.argv.index("--sortie") + 1])
        if verifier:
            raise SystemExit("--sortie et --verifier ne vont pas ensemble")
    if not PAGE.exists():
        raise SystemExit(f"{PAGE} n'existe pas — lance d'abord « deno task annexes »")

    ancien = PAGE.read_text(encoding="utf-8")
    if entre_les_bornes(ancien) is None:
        raise SystemExit(f"{PAGE.name} n'a pas ses bornes de corps")

    neuf = remplacer_le_corps(ancien, corps())
    if verifier:
        if neuf != ancien:
            raise SystemExit(
                "annexe-11 : le corps ne correspond plus à data/personnages.json "
                "ou à data/arenes.json — lance "
                "« python3 outils/annexe-personnages.py »"
            )
        print(f"annexe-11 : à jour ({len(ancien)} caractères).")
        return

    sortie.write_text(neuf, encoding="utf-8")
    print(f"{sortie.name} écrite : {len(neuf)} caractères "
          "(limite Forumactif : 128 000).")


if __name__ == "__main__":
    main()
