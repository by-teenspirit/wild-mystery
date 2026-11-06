#!/usr/bin/env python3
# ════════════════════════════════════════════════════════════════════
#  outils/annexe-carte.py — le corps de l'annexe 06
#
#  ── POURQUOI UN GÉNÉRATEUR POUR UNE SEULE PAGE ──────────────────────
#
#  Elle porte dix-sept zones, leurs niveaux, leur description et leur
#  compte d'espèces — et le repli sans JavaScript porte en plus les
#  neuf cent trente-trois noms. Tenus à la main, ces nombres seraient
#  faux la première fois qu'une table de faune bouge, et personne ne
#  s'en apercevrait : une page ne casse pas quand elle ment.
#
#  ── CE QU'IL N'ÉCRIT PAS, ET POURQUOI ───────────────────────────────
#
#  Les pourcentages, les niveaux par espèce et les sprites restent
#  dehors : avec eux la page ferait 250 Ko, et l'éditeur de pages HTML
#  de Forumactif s'arrête à 128 000 caractères. `js/carte.js` va les
#  chercher au clic, un fichier par zone.
#
#  Les NOMS, eux, tiennent — seize kilo-octets — et ils font la
#  différence entre un repli qui dit « il y a soixante-huit espèces
#  ici » et un repli qui dit lesquelles.
#
#  ── IL ÉCRIT ENTRE LES BORNES, COMME LA RÉDACTION ───────────────────
#
#  `outils/annexes.py` refait l'enveloppe de chaque page et conserve ce
#  qui est entre `▼▼▼ DÉBUT DU CORPS` et `▲▲▲ FIN DU CORPS`. Cet
#  outil-ci écrit ce corps-là. L'ordre est donc : celui-ci, puis
#  `annexes.py` — et dans l'autre sens le résultat est le même, puisque
#  l'un ne touche que le corps et l'autre que l'enveloppe.
# ════════════════════════════════════════════════════════════════════

import html
import json
import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).parent))
from dessins import icone  # noqa: E402
from annexes import (  # noqa: E402
    DEBUT,
    FIN,
    entre_les_bornes,
    chemin_de_la_page,
    en_titre,
    numero_de,
    pied_de_page,
    remplacer_le_corps,
    slug,
    #  ── LE DÉCOR VIENT DU MÊME ENDROIT QUE CELUI DES AUTRES ──────
    #
    #  « Y'a plus de pokémons et plus de fond d'une zone à droite ? »
    #  (5 novembre) — non, et c'était ma faute.
    #
    #  Chaque annexe porte sa photo de zone et son rendu pokémon en
    #  variables sur son `<div class="wm-annexe">`. `annexes.py` les
    #  tire de sa table `DECORS`, qui a TOUJOURS eu sa ligne pour cette
    #  page : les Steppes Arides, et le pokémon 330. En réécrivant
    #  l'en-tête pour retirer `--sans-fond`, j'ai écrit un `<div>` nu
    #  et oublié les deux variables — donc un fond vide et pas de rendu.
    #
    #  On lit la table plutôt que de recopier les deux adresses : deux
    #  endroits qui décident du décor d'une même page finiraient par
    #  n'être plus d'accord, et personne ne regarde un fond.
    ARTWORK,
    DECORS,
    PAGES,
)

R = pathlib.Path(__file__).resolve().parent.parent
PAGE = chemin_de_la_page("la-region-et-ses-zones")

PALIERS = {
    1: ("Palier 1", "Zones accessibles"),
    2: ("Palier 2", "Zones expérimentées"),
    3: ("Palier 3", "Zones ultimes"),
}




def e(t):
    """Échappe, et c'est NON NÉGOCIABLE sur cette page.

    Les noms et les descriptions viennent de fichiers JSON que des gens
    écrivent. Une apostrophe typographique passe ; un `<` passerait
    aussi, et l'éditeur de pages HTML de Forumactif DÉCODE les entités
    au collage — c'est ce qui a mis la moitié de l'annexe 01 dans un
    `<table>` le 1er novembre.
    """
    return html.escape(str(t), quote=True)


def lire(chemin):
    return json.loads((R / chemin).read_text(encoding="utf-8"))


def corps():
    carte = lire("data/carte.json")
    region = lire("data/region.json")
    #  `data/butin.json` N'EST PLUS LU ICI, et c'est le but : les cinq
    #  parts d'une fouille ne sont écrites qu'à un endroit, le bloc de
    #  la zone, en JavaScript. Le tableau qui les recopiait dans cette
    #  page est parti le 5 novembre — voir plus bas.

    zones = [l for l in carte["lieux"] if l["type"] == "zone"]
    #  L'ORDRE EST CELUI DU PALIER, PUIS DU NOM. `carte.json` range ses
    #  lieux dans l'ordre du dessin — celui qui empêche une tache de
    #  recouvrir une étiquette — et ce n'est pas un ordre de lecture.
    zones.sort(key=lambda z: (z["palier"], z["nom"]))

    faunes = {}
    for z in zones:
        chemin = R / f"data/faune/{z['forumId']}.json"
        faunes[z["forumId"]] = (
            json.loads(chemin.read_text(encoding="utf-8")) if chemin.exists() else None
        )

    out = []
    w = out.append

    #  LES BORNES FONT PARTIE DU CORPS — `entre_les_bornes` les rend
    #  avec lui, et `remplacer_le_corps` les remplace avec lui. Les
    #  oublier produit une page qui n'a plus de corps du tout, et la
    #  fois suivante l'outil ne sait plus où écrire. Payé une fois.
    w(f"{DEBUT} — écrit par `outils/annexe-carte.py` \u25bc\u25bc\u25bc -->")
    #  ── COMME LES AUTRES ANNEXES, À PEINE PLUS LARGE ─────────────
    #
    #  Trois tours de vis en deux jours, et le troisième est le bon.
    #
    #  4 nov : « enlève le fond des annexes et prends la largeur dispo,
    #  en tout cas sur cette annexe » — photo et rendu retirés, colonne
    #  sans borne.
    #
    #  5 nov, matin : « que ce soit moins large, que ça ressemble aux
    #  autres maquettes » — on borne le TEXTE à 880 dans une colonne
    #  restée large.
    #
    #  5 nov, soir : « ça fait bizarre que ce soit centré à gauche avec
    #  un gros vide à droite ». Évidemment : borner le texte dans une
    #  colonne large, c'est fabriquer le vide. « On peut essayer de
    #  réduire la largeur de la map (y'a de la place autour) et
    #  d'enlever les grosses marges autour du bloc de map ? Du coup tu
    #  viendrais afficher comme les autres annexes, un fond et un
    #  pokémon, mais elle serait légèrement plus large à cause de la map
    #  et des lieux gardés à droite. »
    #
    #  C'est ce qui est écrit ici. La photo et le rendu reviennent,
    #  la colonne est BORNÉE — un cran au-dessus des 880 des autres,
    #  pas sans limite — et le texte la remplit. Plus de vide, parce
    #  qu'il n'y a plus rien à border.
    #
    #  Ce qui paie la facture est ailleurs : la carte rendait 106 px
    #  d'eau en haut et en bas (dessin carré, cadre de 656 × 762) et
    #  96 px de rembourrage doublé entre la colonne et elle. Voir
    #  `css/16-carte.css`.
    photo, espece, _lieu = DECORS["la-region-et-ses-zones"]
    w(f"""<div class="wm-annexe wm-annexe--carte" style="--annexe-fond: """
      f"""url('{PAGES}/assets/zones/{photo}.jpg'); """
      f"""--annexe-rendu: url('{ARTWORK}/{espece}.png')">""")
    w("")
    w('  <nav class="wm-annexe__sommaire" data-wm-sommaire aria-label="Les annexes"></nav>')
    w("")
    w('  <div class="wm-annexe__corps">')
    w('    <div class="wm-annexe__colonne">')
    w("")
    w('      <p class="wm-annexe__surtitre">Annexe '
      f'{numero_de("la-region-et-ses-zones")}</p>')
    w('      <h1 class="wm-annexe__titre">La <em>région</em> et ses zones</h1>')
    w('      <p class="wm-annexe__chapo">')
    #  LE CHAPÔ EST DANS `data/region.json` DEPUIS LE 5 NOVEMBRE.
    #  Callista l'a réécrit à la main dans la page ; une correction
    #  faite là est perdue à la génération suivante, donc elle remonte
    #  à la source. Le nombre d'espèces, lui, reste calculé : c'est le
    #  seul chiffre de la phrase qui bouge tout seul.
    for ligne in region["chapo"]:
        w(f"        {e(ligne).replace('933', str(total_especes(faunes)))}")
    w("      </p>")
    w("")
    w('      <div class="wm-annexe__blocs">')
    w("")

    # ── DEUX ONGLETS, ET DEUX SEULEMENT ─────────────────────────────
    #
    #  « Dans l'annexe on a : un onglet pour la région de Rhode et un
    #  onglet pour la carte, les pokémons etc. » (4 novembre)
    #
    #  Il y en avait quatre, et la carte flottait au-dessus d'eux, hors
    #  de tout onglet. On lisait donc la page dans un ordre que
    #  personne n'avait choisi : la carte, puis un onglet au hasard.
    w('        <div class="wm-annexe__carte wm-sous-onglets" data-wm-sous-onglets>')
    w("")

    r = region
    w('          <section data-wm-sous-onglet="la-region">')
    w(f'            <h2 class="wm-annexe__carte-titre">{e(r["titre"])}</h2>')
    w('            <div class="wm-paras">')
    for para in r["presentation"]:
        w(f"              <p>{e(para)}</p>")
    w("            </div>")

    ev = r["evenements"]
    w(f'            <h3 class="wm-region__section">{e(ev["titre"])}</h3>')
    w('            <div class="wm-paras">')
    for para in ev["intro"]:
        w(f"              <p>{e(para)}</p>")
    w("            </div>")

    #  ── LES QUATRE ÉVÈNEMENTS EN ONGLETS ─────────────────────────
    #
    #  « Tu peux rajouter des onglets plutôt pour les différents
    #  évènements et rajouter des icônes pour chacune ? » (5 novembre)
    #
    #  C'est un groupe de sous-onglets DANS le groupe de la page, et
    #  c'est ce que ça a coûté : `module-annexes.ts` ramassait toute sa
    #  descendance, donc le groupe du dessus se serait mis six boutons.
    #  Il ne garde plus que les sections dont il est le groupe le plus
    #  proche.
    #
    #  SANS JAVASCRIPT, RIEN N'EST PERDU : les quatre sections
    #  s'affichent à la suite avec leurs titres et leurs icônes, comme
    #  avant. La barre d'onglets est construite au chargement, jamais
    #  écrite ici — une barre en dur sans script serait une rangée de
    #  boutons morts.
    #
    #  Le titre passe de `h4` à `h3` parce que c'est ce que le module
    #  lit pour nommer un onglet, et l'icône est DANS le titre : le
    #  bouton n'en reçoit qu'une copie.
    w('            <div class="wm-region__evenements wm-sous-onglets"'
      " data-wm-sous-onglets>")
    for bloc in ev["blocs"]:
        w('            <div class="wm-region__bloc" data-wm-sous-onglet="'
          f'{slug(bloc["nom"])}">')
        w(f'              <h3 class="wm-region__nom">{icone(bloc.get("icone", ""))}'
          f'{e(bloc["nom"])}</h3>')
        w('              <div class="wm-paras">')
        for para in bloc["paragraphes"]:
            w(f"                <p>{e(para)}</p>")
        w("              </div>")

        #  LE LIEN DE L'IMAGE SUIT LE PARAGRAPHE QUI DIT « RELATIVEMENT
        #  FUTURISTES » : c'est là que Callista l'avait posé, sur le mot
        #  lui-même. Posé plus bas, entre la liste des circuits et les
        #  écuries, il flottait sans rien à quoi se rattacher.
        if bloc.get("image"):
            w('              <p class="wm-perso__liens">')
            w('                <a class="wm-perso__lien" href="'
              f'{e(bloc["image"]["lien"])}" rel="noopener noreferrer"'
              f' target="_blank">{e(bloc["image"]["mot"])}</a>')
            w("              </p>")

        #  L'ORDRE DES NEUF GRAND PRIX. Il était dans une phrase, et
        #  une phrase de neuf lieux ne se retient pas : on la lit deux
        #  fois pour savoir lequel vient avant lequel.
        if bloc.get("ordre"):
            w('              <ol class="wm-region__ordre">')
            for n, lieu in enumerate(bloc["ordre"], 1):
                w(f'                <li><span class="wm-region__rang">{n}</span>'
                  f"{e(lieu)}</li>")
            w("              </ol>")
            if bloc.get("ditDeLOrdre"):
                w(f'              <p class="wm-region__dit">{e(bloc["ditDeLOrdre"])}</p>')

        #  LES SIX BAUDRIERS, DONT CINQ LIBRES. « Place libre » porte la
        #  même pastille verte que « poste vacant » chez les champions :
        #  c'est la même information — tu peux la prendre.
        if bloc.get("ecuries"):
            w('              <ul class="wm-ecuries">')
            for ec in bloc["ecuries"]:
                w('                <li class="wm-ecurie">')
                w(f'                  <b class="wm-ecurie__nom">{e(ec["nom"])}</b>')
                w('                  <span class="wm-ecurie__pilotes">')
                for pil in ec["pilotes"]:
                    if pil.get("libre"):
                        w('                    <span class="wm-ecurie__libre">place'
                          " libre</span>")
                    elif pil.get("lien"):
                        w('                    <a class="wm-ecurie__pilote" href="'
                          f'{e(pil["lien"])}">{e(pil["nom"])}</a>')
                    else:
                        w('                    <span class="wm-ecurie__pilote">'
                          f'{e(pil["nom"])}</span>')
                w("                  </span>")
                w("                </li>")
            w("              </ul>")

        if bloc.get("dit"):
            w(f'              <p class="wm-region__dit">{e(bloc["dit"])}</p>')
        w("            </div>")
    w("            </div>")

    note = r["note"]
    w('            <div class="wm-encarts wm-encarts--detachee">')
    w('              <div class="wm-encart wm-encart--paisible">')
    w('                <span class="wm-encart__etiquette">'
      f'{e(note["etiquette"])}</span>')
    w(f'                <p>{e(note["texte"])}</p>')
    w("              </div>")
    w("            </div>")
    #  LE LIEN « FAQ & SUGGESTIONS → » QUI SUIVAIT EST PARTI. Retiré par
    #  Callista le 5 novembre, et elle a raison : le pied de page porte
    #  déjà un bouton « Questions & suggestions » vers le même sujet, à
    #  deux écrans de là. Deux liens vers le même endroit sur une page
    #  ne donnent pas deux fois plus envie d'y aller.
    w("          </section>")
    w("")

    #  ── 2 · la carte, la faune, et comment tout se tire ───────────
    w('          <section data-wm-sous-onglet="la-carte">')
    w('            <h2 class="wm-annexe__carte-titre">La carte et ses zones</h2>')
    w("")

    # ── la carte, et le panneau qu'elle remplit ──────────────────────
    w("        <!-- LA CARTE EST CELLE DE L'INDEX : même module, même fichier.")
    w("             Le trou se remplit par `js/carte.js`. -->")
    w('        <div class="wm-plateau" data-wm-carte></div>')
    w('        <section class="wm-faune" data-wm-faune hidden></section>')
    w("")

    # ── le repli ─────────────────────────────────────────────────────
    w("        <!-- LE REPLI SANS JAVASCRIPT. `module-faune.ts` lui pose une")
    w("             classe une fois la carte debout — en JavaScript, jamais")
    w("             dans la feuille : une règle CSS le ferait disparaître même")
    w("             quand le module tombe, et la page n'aurait alors ni carte")
    w("             ni liste. -->")
    w('        <div class="wm-faune-repli" data-wm-faune-repli>')
    for palier in (1, 2, 3):
        titre, sous = PALIERS[palier]
        dedans = [z for z in zones if z["palier"] == palier]
        if not dedans:
            continue
        w(f'          <h2 class="wm-faune-repli__palier">{e(titre)} · {e(sous)}</h2>')
        for z in dedans:
            faune = faunes[z["forumId"]]
            table = (faune or {}).get("conditions", {}).get("jour", [])
            w('          <section class="wm-faune-repli__zone">')
            w('            <h3 class="wm-faune-repli__nom">'
              f'<a href="/f{z["forumId"]}-">{e(z["nom"])}</a></h3>')
            w(f'            <p class="wm-faune-repli__chiffres">{e(z.get("niveau", ""))}'
              f" · {len(table)} espèces</p>")
            if z.get("description"):
                w(f'            <p class="wm-faune-repli__dit">{e(z["description"])}</p>')
            if table:
                #  LES NOMS SEULS. Les pourcentages, les niveaux et les
                #  sprites feraient 250 Ko ; les noms en font seize, et
                #  ils changent « il y a soixante-huit espèces ici » en
                #  « lesquelles ».
                noms = ", ".join(e(x["nom"]) for x in table)
                w(f'            <p class="wm-faune-repli__especes">{noms}</p>')
            w("          </section>")
    w("        </div>")
    w("")
    #  ── LES DEUX SECTIONS D'EXPLICATION SONT PARTIES ─────────────
    #
    #  Retirées par Callista le 5 novembre, et remplacées par deux
    #  encarts de trois lignes qu'elle a écrits elle-même.
    #
    #  Il y avait « Comment le serveur tire » — la graine, l'ordre des
    #  deux tirages, les cent pour cent — et « Le ciel, l'heure, et ce
    #  qu'ils changent », quatre paragraphes sur une météo qui
    #  aujourd'hui ne change rien : les dix-sept zones portent des
    #  tables `jour` et `nuit` IDENTIQUES, et aucune n'a de météo.
    #
    #  Les deux disaient vrai, et les deux expliquaient longuement une
    #  mécanique qu'un joueur ne voit pas. Ses deux encarts disent ce
    #  qu'il a besoin de savoir : que ça ne change rien pour l'instant,
    #  et qu'un pokémon n'est à lui qu'à la clôture.
    #
    #  CE QUI EST PERDU EST DANS LE CODE : `src/domaine/meteo.ts` et
    #  `src/domaine/rencontre.ts` portent les mêmes explications en
    #  commentaire d'en-tête, et elles y sont à leur place.
    w('          <section class="wm-faune__notice">')
    w('            <div class="wm-encarts">')
    for enc in r["encartsDeLaCarte"]:
        w(f'              <div class="wm-encart wm-encart--{e(enc["ton"])}">')
        w('                <span class="wm-encart__etiquette">'
          f'{e(enc["etiquette"])}</span>')
        w(f'                <p>{e(enc["texte"])}</p>')
        w("              </div>")
    w("            </div>")
    w("          </section>")
    w("")

    #  ── LA SECTION « CE QU'ON TROUVE AU SOL » EST PARTIE ──────────
    #
    #  « Tu peux enlever ça vu que tu le redis en haut » (5 novembre),
    #  et c'était vrai deux fois.
    #
    #  Elle portait un tableau des cinq parts d'une fouille — 44,80 %
    #  de pokédollars, 25 % d'un objet, 0,20 % d'un fossile entier. Les
    #  MÊMES cinq parts que `blocDuSol` écrit sous chaque zone, avec les
    #  mêmes chiffres, puisque les deux les lisent dans
    #  `data/butin.json`. Deux fois la même table sur une page, et la
    #  seconde arrivait après soixante cartes d'espèce.
    #
    #  Son dernier paragraphe promettait en plus « une pastille de
    #  couleur, du vert au rouge » sur la liste d'objets de chaque zone
    #  — ce que la carte d'objet fait d'elle-même, et qu'elle n'a pas
    #  besoin qu'on annonce trois écrans plus haut.
    #
    #  CE QUI EN RESTE EST DANS LE BLOC DE LA ZONE, et c'est le bon
    #  endroit : les cinq parts sont les mêmes partout, mais la liste
    #  d'objets, elle, change de zone en zone.
    w("")
    w("          </section>")
    w("")

    #  ── 3 · les brèches interdimensionnelles ──────────────────────
    #
    #  « Tu vas ajouter un onglet dans les zones, avec les brèches
    #  interdimensionnelles et tu vas mettre toutes les formes de
    #  pokémons différentes dans cet onglet » (6 novembre).
    #
    #  LA LISTE EST DÉRIVÉE DE `data/hors-nature.json`, où chaque forme
    #  régionale porte `origine: "breche"` — la même source qui les
    #  sort des dix-sept tables de rencontre. Recopiée ici, elle
    #  finirait par ne plus dire la même chose que les zones.
    #
    #  LA RÉGION SE LIT DANS LE NOM, en français : « Rattata d'Alola »,
    #  « Miaouss de Galar ». C'est ce que le lecteur voit, et ça évite
    #  de traîner les identifiants PokéAPI jusqu'ici.
    b = region["breches"]
    w('          <section data-wm-sous-onglet="les-breches">')
    w(f'            <h2 class="wm-annexe__carte-titre">{e(b["titre"])}</h2>')
    w('            <div class="wm-paras">')
    for para in b["presentation"]:
        w(f"              <p>{e(para)}</p>")
    w("            </div>")
    w("")

    numeros = {x["id"]: x["no"] for x in lire("data/pokedex-carnet.json")["especes"]}
    types = {x["id"]: x["types"] for x in lire("data/pokedex-carnet.json")["especes"]}
    formes = [
        x for x in lire("data/hors-nature.json")["especes"] if x["origine"] == "breche"
    ]
    REGIONS = (("Alola", "d'Alola"), ("Galar", "de Galar"),
               ("Hisui", "de Hisui"), ("Paldea", "de Paldea"))
    restantes = list(formes)
    w('            <div class="wm-breches">')
    for nom_region, marque in REGIONS:
        dedans = [x for x in restantes if x["nom"].endswith(marque)]
        if not dedans:
            continue
        restantes = [x for x in restantes if x not in dedans]
        dedans.sort(key=lambda x: numeros.get(x["id"], 0))
        w('              <section class="wm-breche">')
        w('                <h3 class="wm-breche__titre">')
        w(f'                  <span class="wm-breche__region">{e(nom_region)}</span>')
        w(f'                  <span class="wm-breche__compte">{len(dedans)} formes</span>')
        w("                </h3>")
        #  ── LE TROU QUE LE MODULE REMPLIT ─────────────────────────
        #
        #  « Affiche les pokémons comme dans les zones sauvages »
        #  (6 novembre). Les cartes sont donc construites par
        #  `module-faune.ts`, le MÊME constructeur que la liste d'une
        #  zone — et pas recopiées ici.
        #
        #  Elles ne peuvent pas l'être : l'adresse d'un sprite dépend
        #  du style choisi par le joueur (forum, rétro, GBA) et d'un
        #  fichier de couverture. C'est une décision du navigateur,
        #  pas de la génération.
        #
        #  LA MARQUE DE RÉGION EST LE SUFFIXE DU NOM, en français :
        #  le module filtre là-dessus, comme ici.
        w(f'                <div class="wm-breche__cartes" data-wm-breche-liste'
          f' data-wm-breche="{e(marque)}"></div>')
        #  ── ET LE REPLI, SANS JAVASCRIPT ──────────────────────────
        #
        #  Même règle que la liste d'une zone : si le module tombe, la
        #  page doit dire quelque chose. Une liste de noms vaut mieux
        #  qu'un trou, et le module la cache dès qu'il a posé ses
        #  cartes.
        w('                <ul class="wm-breche__liste" data-wm-breche-repli>')
        for x in dedans:
            w('                  <li class="wm-breche__forme">')
            w('                    <span class="wm-breche__no">N°'
              f' {numeros.get(x["id"], 0):03d}</span>')
            w(f'                    <span class="wm-breche__nom">{e(x["nom"])}</span>')
            w('                    <span class="wm-breche__types">')
            for ty in types.get(x["id"], []):
                w(f'                      <span class="wm-type wm-type--{e(ty)}"'
                  f' data-wm-type="{e(ty)}">{e(en_titre(ty))}</span>')
            w("                    </span>")
            w("                  </li>")
        w("                </ul>")
        w("              </section>")
    #  UNE FORME SANS RÉGION RECONNUE ARRÊTE LA PAGE. La taire
    #  l'effacerait de la liste sans que personne ne le voie.
    if restantes:
        raise SystemExit(
            "région non reconnue pour : "
            + ", ".join(x["nom"] for x in restantes[:5])
        )
    w("            </div>")
    w("")
    w(f'            <p class="wm-breche__dit">{e(b["note"])}</p>')
    w("")
    w("          </section>")
    w("")
    w("        </div>")
    w("")


    # ── le pied, celui du gabarit ────────────────────────────────────
    #  LE PIED VIENT DE `annexes.py`, pas d'ici. Il porte la page
    #  suivante et les deux boutons de contact : les mêmes sur les
    #  quatorze annexes, et `annexes.py` les refait de toute façon à la
    #  passe suivante. Deux versions du même bloc, c'est une version de
    #  trop — et `--verifier` crierait au premier écart.
    w(pied_de_page("la-region-et-ses-zones"))
    w("")
    w("      </div>")
    w("    </div>")
    w("  </div>")
    w("</div>")
    w(FIN)
    return "\n".join(out)


def total_especes(faunes):
    return sum(
        len((f or {}).get("conditions", {}).get("jour", [])) for f in faunes.values()
    )


def main():
    verifier = "--verifier" in sys.argv
    if not PAGE.exists():
        raise SystemExit(f"{PAGE} n'existe pas — lance d'abord « deno task annexes »")

    ancien = PAGE.read_text(encoding="utf-8")
    if entre_les_bornes(ancien) is None:
        raise SystemExit(f"{PAGE.name} n'a pas ses bornes de corps")

    neuf = remplacer_le_corps(ancien, corps())
    if verifier:
        if neuf != ancien:
            raise SystemExit(
                "annexe-05 : le corps ne correspond plus aux données — "
                "lance « python3 outils/annexe-carte.py »"
            )
        print(f"annexe-05 : à jour ({len(ancien)} caractères).")
        return

    PAGE.write_text(neuf, encoding="utf-8")
    print(f"annexe-05 écrite : {len(neuf)} caractères (limite Forumactif : 128 000).")


if __name__ == "__main__":
    main()
