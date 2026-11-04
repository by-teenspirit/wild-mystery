#!/usr/bin/env python3
# ════════════════════════════════════════════════════════════════════
#  outils/annexes.py — écrire les quatorze pages d'annexe
#
#  USAGE :  python3 outils/annexes.py
#
#  POURQUOI UN GÉNÉRATEUR ET PAS QUATORZE FICHIERS. Les quatorze pages
#  sont le MÊME gabarit : même tête, mêmes sept briques, même pied. Ce
#  qui change d'une page à l'autre tient en quatre lignes — le numéro,
#  le titre, la photo du lieu et le pokémon. Écrire les quatorze à la
#  main, c'est s'engager à reporter chaque correction quatorze fois, et
#  c'est exactement ce qu'on refuse déjà pour le sommaire, les zones et
#  le catalogue.
#
#  « Tu gardes les mêmes textes partout, on va rédiger les annexes en
#  parallèle et on remplira plus tard. » Le texte de remplissage montre
#  donc LES SEPT BRIQUES, une fois chacune, avec des phrases neutres :
#  en ouvrant sa page, qui rédige voit le gabarit entier et remplace
#  bloc par bloc au lieu d'inventer une mise en page.
#
#  ── LA LISTE VIENT DE `data/annexes.json` ──────────────────────────
#
#  Le sommaire et les pages lisent le même fichier. Ajouter une annexe,
#  en renommer une, en changer l'ordre : c'est ce fichier, puis cette
#  commande. Les numéros ne sont jamais écrits ici.
#
#  ── LES IMAGES SONT ÉCRITES EN ENTIER ──────────────────────────────
#
#  Une page collée vit sur forumactif.com, la feuille sur Pages : une
#  adresse relative y chercherait l'image sur le forum. Les pages
#  portent donc l'adresse complète, comme `zones.json` pour ses
#  bandeaux. C'est aussi ce qui garde la feuille sans `url()`, que le
#  garde-fou n° 7 interdit.
#
#  Les photos sont celles des zones, déjà dans le dépôt et déjà servies
#  en bandeau : rien de nouveau à héberger. Les rendus sont l'artwork
#  officiel de PokeAPI, la même source que les sprites de la carte
#  dresseur et du pokédex.
# ════════════════════════════════════════════════════════════════════

import json
import re
import pathlib

#  LE SUJET DES QUESTIONS, écrit UNE fois. Il est repris dans le pied
#  des quatorze annexes et dans l'onglet de la région : une seconde
#  copie dériverait au premier renommage de sujet.
FAQ = "https://mysteryinrhode.forumactif.com/t997-faq-suggestions"

R = pathlib.Path(__file__).resolve().parent.parent

PAGES = "https://by-teenspirit.github.io/wild-mystery"
ARTWORK = (
    "https://raw.githubusercontent.com/PokeAPI/sprites"
    "/bfb75391935310368065096fa08c51e8970bc43e"
    "/sprites/pokemon/other/official-artwork"
)

#  ── CE QUI CHANGE D'UNE PAGE À L'AUTRE, ET RIEN D'AUTRE ────────────
#
#  slug → (photo de zone, numéro national du pokémon, nom du lieu).
#  Le lieu nommait la pastille du pied, retirée le 4 novembre ; il
#  reste pour nommer la photo, pour
#  qu'une image de décor ne soit pas qu'une image de décor.
DECORS = {
    "par-ou-commencer": ("plage-grain-de-sel", 150, "La plage du Grain de Sel"),
    "contexte": ("relique-sacree", 249, "La Relique Sacrée"),
    "reglement": ("monts-enneiges", 379, "Les Monts Enneigés"),
    "creer-son-personnage": ("fleuve-paisible", 132, "Le Fleuve Paisible"),
    "guide-du-dresseur": ("lande-broussailleuse", 448, "La Lande Broussailleuse"),
    "la-region-et-ses-zones": ("steppes-arides", 330, "Les Steppes Arides"),
    "arenes-colosseums-ligues": ("volcan-sombre", 6, "Le Volcan Sombre"),
    "groupes": ("montagnes-embrumees", 250, "Les Montagnes Embrumées"),
    "credits": ("oasis-perdue", 151, "L'Oasis Perdue"),
    "staff": ("canyon-lekro", 65, "Le Canyon Lékro"),
    "celebrites-de-rhode": ("manoir-barjok", 571, "Le Manoir Barjok"),
    "monnaie-et-missions": ("usine-desaffectee", 52, "L'Usine Désaffectée"),
    "combat-et-progression": ("volcan-nuageux", 68, "Le Volcan Nuageux"),
    "allegeance-et-team-ombre": ("ile-tenebra", 197, "L'Île Ténèbra"),
}


def lire_le_sommaire():
    d = json.loads((R / "data/annexes.json").read_text(encoding="utf-8"))
    return [e for s in d["sections"] for e in s["entrees"]]


#  ── LE GABARIT ──────────────────────────────────────────────────────
#
#  Les sept briques de la planche 61, une fois chacune, dans l'ordre où
#  une annexe les emploie : carte + tirets, paire, paras, table, encarts,
#  suivante. Une huitième se discute avant de s'écrire.
#  ── CE QUE LA PAGE CHARGE ELLE-MÊME ────────────────────────────────
#
#  Sans l'en-tête du forum, elle ne reçoit RIEN : ni les polices, ni
#  `jetons.css` (qui vit dans le panneau d'administration mais que
#  Pages sert aussi, depuis le dépôt), ni la feuille, ni aucun script.
#  Elle les demande donc en clair.
TETE = """  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Annexe {numero} · {titre} — Wild Mystery</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link
    rel="stylesheet"
    href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400..700&amp;family=Nunito+Sans:opsz,wght@6..12,300..800&amp;family=Cormorant+Garamond:wght@400;600&amp;display=swap"
  />
  <link rel="stylesheet" href="{pages}/panneau-admin/jetons.css" />
  <link rel="stylesheet" href="{pages}/css/wild-mystery.css" />"""

#  ── LA BARRE DU HAUT ───────────────────────────────────────────────
#
#  « Juste une barre de navigation en haut pour retourner au forum. »
#  Le nom du forum EST le retour : c'est le geste que tout le monde
#  connaît, et ça évite une entrée « Accueil » juste à côté qui mènerait
#  au même endroit. Les trois autres liens sont ceux de la vraie barre,
#  pour qu'on ne se croie pas ailleurs.
BARRE = """    <nav class="wm-retour" aria-label="Retour au forum">
      <a class="wm-retour__nom" href="/">Wild Mystery</a>
      <a class="wm-retour__lien" href="/search">Rechercher</a>
      <a class="wm-retour__lien" href="/memberlist">Personnages</a>
      <a class="wm-retour__lien" href="/privmsg?folder=inbox">Messagerie</a>
    </nav>"""

#  ── LE PIED ────────────────────────────────────────────────────────
#
#  Le lien vers Forumactif est OBLIGATOIRE sur une page sans en-tête,
#  et on ne le retire jamais. C'est la contrepartie de l'hébergement.
PIED = """    <footer class="wm-pied-annexe">
      Wild Mystery — forum créé avec
      <a href="https://www.forumactif.com/">Forumactif</a>
    </footer>"""

GABARIT = """<!-- ═══════════════════════════════════════════════════════════════════
     Annexe {numero} · {titre} — à coller dans une page HTML.

     ÉCRITE PAR `outils/annexes.py`. Ne pas corriger ce fichier à la
     main : la correction serait perdue à la prochaine génération, et
     elle ne toucherait qu'une des quatorze pages. Le gabarit est dans
     l'outil, la liste dans `data/annexes.json`.

     ── CRÉER LA PAGE SUR LE FORUM ─────────────────────────────────

     Modules > HTML & JAVASCRIPT > Gestion des pages HTML > Créer, en
     MODE AVANCÉ, et surtout :

       · « Utiliser le header et footer du forum » = **NON**. La page
         est un document complet : elle charge elle-même les polices,
         `jetons.css`, la feuille et `js/annexes.js`. Avec la case à
         OUI, on aurait deux en-têtes et deux pieds l'un dans l'autre.
       · L'adresse doit finir par **{slug}** — c'est ce bout que le
         sommaire reconnaît pour se surligner, et pas le numéro `hN`,
         qui dépend de l'ordre de création chez Forumactif.
       · Reporter l'adresse obtenue dans `data/annexes.json`, champ
         `adresse` : le lien apparaît alors dans les quatorze
         sommaires d'un coup.

     ── LE TEXTE EST UN REMPLISSAGE ────────────────────────────────

     Les sept briques sont montrées une fois chacune, avec des phrases
     neutres. Remplacer bloc par bloc ; supprimer les briques dont la
     page n'a pas besoin. Ce qui ne doit PAS changer : les classes, et
     le `<nav data-wm-sommaire>` qui reçoit le sommaire.
     ═══════════════════════════════════════════════════════════════════ -->

<!DOCTYPE html>
<html lang="fr">
<head>
{tete}
</head>
<body>
<div id="modernbb">
{barre}

<!-- ▼▼▼ DÉBUT DU CORPS — c'est la seule partie qu'on rédige ▼▼▼ -->
<div class="wm-annexe" style="--annexe-fond: url('{fond}'); --annexe-rendu: url('{rendu}')">

  <nav class="wm-annexe__sommaire" data-wm-sommaire aria-label="Les annexes"></nav>

  <div class="wm-annexe__corps">
    <div class="wm-annexe__colonne">

      <p class="wm-annexe__surtitre">Annexe {numero}</p>
      <h1 class="wm-annexe__titre">{titre_h1}</h1>
      <p class="wm-annexe__chapo">
        Une phrase ou deux pour dire à quoi sert cette page, et ce qu'on y trouvera.
        Elle se lit avant tout le reste : autant qu'elle serve à décider si on continue.
      </p>

      <div class="wm-annexe__blocs">

        <div class="wm-annexe__carte">
          <h2 class="wm-annexe__carte-titre">Le premier bloc</h2>
          <ul class="wm-tirets">
            <li><b>Une liste à tirets</b> pour ce qui s'énumère : des étapes, des
              conditions, des cas. Le tiret est posé par la feuille — ne pas le
              réécrire ici.</li>
            <li><b>Le mot en gras ouvre la ligne</b>, et la suite l'explique. C'est ce qui
              rend la liste lisible en diagonale.</li>
            <li>Une ligne peut aussi n'être qu'une phrase, sans mot en tête.</li>
          </ul>
        </div>

        <div class="wm-paire">
          <div class="wm-annexe__carte">
            <h2 class="wm-annexe__carte-titre">Deux cartes côte à côte</h2>
            <div class="wm-paras">
              <p>La brique <b>paire</b> pose deux cartes de même largeur. Elle sert quand
                deux choses se répondent — avant et après, ce qu'on gagne et ce qu'on
                risque.</p>
              <p>Sous 900 pixels, elles s'empilent toutes seules.</p>
            </div>
          </div>
          <div class="wm-annexe__carte">
            <h2 class="wm-annexe__carte-titre">Et du texte suivi</h2>
            <div class="wm-paras">
              <p>La brique <b>paras</b> est le texte courant : des paragraphes, sans puce
                ni numéro. C'est elle qu'on emploie quand une idée ne se découpe pas.</p>
            </div>
          </div>
        </div>

        <div class="wm-annexe__carte">
          <h2 class="wm-annexe__carte-titre">Un tableau</h2>
          <div class="wm-table">
            <div class="wm-table__ligne wm-table__ligne--entete">
              <span class="wm-table__cellule wm-table__cellule--nom">Ce qu'on nomme</span>
              <span class="wm-table__cellule">Ce que c'est</span>
              <span class="wm-table__cellule wm-table__cellule--chiffre">Combien</span>
            </div>
            <div class="wm-table__ligne">
              <span class="wm-table__cellule wm-table__cellule--nom">Première ligne</span>
              <span class="wm-table__cellule">La colonne du milieu porte l'explication.</span>
              <span class="wm-table__cellule wm-table__cellule--chiffre">0</span>
            </div>
            <div class="wm-table__ligne">
              <span class="wm-table__cellule wm-table__cellule--nom">Deuxième ligne</span>
              <span class="wm-table__cellule">Le tableau est en flexbox, pas une
                vraie table : sur téléphone chaque ligne s'empile et l'en-tête
                disparaît.</span>
              <span class="wm-table__cellule wm-table__cellule--chiffre">0</span>
            </div>
          </div>
        </div>

        <div class="wm-encarts">
          <div class="wm-encart wm-encart--terre">
            <span class="wm-encart__etiquette">À retenir</span>
            <p>L'encart terre souligne ce qu'il ne faut pas manquer. Deux ou trois lignes,
              pas plus : un encart long n'est plus un encart.</p>
          </div>
          <div class="wm-encart wm-encart--paisible">
            <span class="wm-encart__etiquette">Bon à savoir</span>
            <p>L'encart vert dit ce qui rassure, ou ce qui se fait tout seul. Les deux vont
              par paire et se répondent.</p>
          </div>
        </div>

{pied_de_page}

      </div>
    </div>
  </div>
</div>
<!-- ▲▲▲ FIN DU CORPS ▲▲▲ -->

{pied}
</div>
<script src="{pages}/js/annexes.js"></script>{scripts}
</body>
</html>
"""


DEBUT = "<!-- ▼▼▼ DÉBUT DU CORPS"
FIN = "<!-- ▲▲▲ FIN DU CORPS ▲▲▲ -->"


#  ── LE PIED, ÉCRIT UNE FOIS POUR LES QUATORZE ───────────────────────
#
#  Il porte deux choses : où aller ensuite, et à qui écrire. Les deux
#  sont les mêmes sur toutes les pages, et aucune des deux n'est du
#  contenu rédigé — d'où une fonction, appelée aussi par les trois
#  générateurs de corps, et un remplacement du pied dans les pages déjà
#  écrites. Sans ce remplacement, le pied restait gelé à la première
#  génération : changer le staff aurait demandé quatorze corrections à
#  la main, donc n'aurait jamais été fait.
PIED_DE_PAGE = """        <div class="wm-suivante">
          <a class="wm-suivante__bouton" href="{lien}">
            <span class="wm-suivante__etiquette">Annexe suivante</span>
            {titre} →
          </a>
          <div class="wm-question">
            <span class="wm-question__mot">Une question ?</span>
            <a class="wm-question__bouton" href="/privmsg?mode=post">Écrire au staff</a>
            <a class="wm-question__bouton" href="{faq}">Questions &amp; suggestions</a>
          </div>
        </div>"""


def numero_de(slug):
    """Le numéro d'une annexe dans le sommaire, « 01 » à « 13 »."""
    e = next((x for x in lire_le_sommaire() if x["slug"] == slug), None)
    if e is None:
        raise SystemExit(f"{slug} n'est pas dans data/annexes.json")
    return e["numero"]


def remplacer_le_surtitre(corps, numero):
    """Le corps, son « Annexe NN » remis au numéro du sommaire.

    LE SURTITRE EST DANS LE CORPS, et il n'y a rien de rédigé dedans :
    c'est un rang, et il change dès qu'on retire une annexe. Le 4
    novembre, « créer son personnage » s'est repliée dans « par où
    commencer » et douze pages ont reculé d'un cran ; les deux dont le
    corps était protégé ont gardé leur ancien numéro, et personne
    n'aurait vu la différence avant de lire « Annexe 13 » sur la
    douzième. Même traitement que le pied : ce qui se calcule se refait.
    """
    return re.sub(
        r'(<p class="wm-annexe__surtitre">Annexe )\d+(</p>)',
        lambda m: f"{m.group(1)}{numero}{m.group(2)}",
        corps,
        count=1,
    )


def chemin_de_la_page(slug):
    """Le fichier d'une annexe, désignée par son SLUG.

    PAS PAR SON NUMÉRO. Le numéro est un rang dans le sommaire : il
    change dès qu'on retire une annexe ou qu'on en insère une — c'est
    arrivé le 4 novembre, quand « créer son personnage » s'est repliée
    dans « par où commencer » et que les douze suivantes ont reculé
    d'un cran. Trois générateurs et deux harnais portaient le numéro
    dans un chemin écrit à la main ; ils demandent maintenant.
    """
    entrees = lire_le_sommaire()
    e = next((x for x in entrees if x["slug"] == slug), None)
    if e is None:
        raise SystemExit(f"{slug} n'est pas dans data/annexes.json")
    return R / "pages" / f"annexe-{e['numero']}-{slug}.html"


def pied_de_page(slug):
    """Le bloc du pied pour une annexe, désignée par son slug.

    La page suivante est celle d'après dans `data/annexes.json`, et la
    dernière renvoie à la première : un bouton « suivante » qui ne mène
    nulle part est un bouton mort.
    """
    entrees = lire_le_sommaire()
    i = next((n for n, e in enumerate(entrees) if e["slug"] == slug), None)
    if i is None:
        raise SystemExit(f"{slug} n'est pas dans data/annexes.json")
    suite = entrees[(i + 1) % len(entrees)]
    return PIED_DE_PAGE.format(
        lien=suite["adresse"] or "#", titre=suite["titre"], faq=FAQ
    )


def remplacer_le_pied(corps, pied):
    """Le corps, son bloc « annexe suivante » échangé contre `pied`.

    LE CORPS EST SACRÉ, LE PIED NON. Tout ce qui est rédigé est gardé ;
    seul le bloc généré est refait. S'il n'y en a pas, le corps revient
    inchangé plutôt que d'en inventer un — une page sans pied est une
    page qu'on regarde, pas qu'on répare en silence.
    """
    i = corps.find('<div class="wm-suivante">')
    if i == -1:
        return corps
    i = corps.rfind("\n", 0, i) + 1
    j = corps.find("\n        </div>", i)
    if j == -1:
        return corps
    return corps[:i] + pied + corps[j + len("\n        </div>"):]


def entre_les_bornes(page):
    """Le corps d'une page, bornes comprises — ou None si elle n'en a pas."""
    i = page.find(DEBUT)
    j = page.find(FIN)
    if i == -1 or j == -1 or j < i:
        return None
    return page[i:j + len(FIN)]


def remplacer_le_corps(page, corps):
    i = page.find(DEBUT)
    j = page.find(FIN)
    return page[:i] + corps + page[j + len(FIN):]


def sans_le_pied(corps):
    """Le corps, moins le bloc « annexe suivante ».

    CE BLOC EST À L'OUTIL, PAS À LA RÉDACTION, et il tombe pourtant
    entre les bornes : il est dans la mise en page, à la fin de la
    colonne. Son lien change dès qu'une adresse est reportée dans
    `annexes.json`, donc une page intacte paraissait rédigée et son
    corps était gelé à la première génération — elle n'aurait plus
    jamais reçu une amélioration du gabarit.

    On le retire des deux côtés avant de comparer. Ce qui reste est le
    texte, et lui seul décide si quelqu'un a écrit.
    """
    i = corps.find('<div class="wm-suivante">')
    return corps if i == -1 else corps[:i]


def titre_en_h1(titre):
    """Le dernier mot passe en `em` : c'est l'accent bleu de la maquette."""
    mots = titre.split(" ")
    if len(mots) == 1:
        return f"<em>{titre}</em>"
    return " ".join(mots[:-1]) + f" <em>{mots[-1]}</em>"


def main():
    entrees = lire_le_sommaire()
    manquants = [e["slug"] for e in entrees if e["slug"] not in DECORS]
    if manquants:
        raise SystemExit(
            "Ces entrées de data/annexes.json n'ont pas de décor dans ce "
            "fichier : " + ", ".join(manquants)
        )

    zones = {
        pathlib.Path(p).stem for p in (R / "assets/zones").glob("*.jpg")
    }
    for slug, (photo, _, _) in DECORS.items():
        if photo not in zones:
            raise SystemExit(f"assets/zones/{photo}.jpg n'existe pas ({slug})")

    dossier = R / "pages"
    ecrits, reprises = [], []
    for i, e in enumerate(entrees):
        photo, numero_national, _lieu = DECORS[e["slug"]]
        #  LA PAGE SUIVANTE EST CELLE D'APRÈS DANS LE SOMMAIRE, et la
        #  dernière renvoie à la première : un bouton « suivante » qui
        #  ne mène nulle part est un bouton mort.
        page = GABARIT.format(
            pied_de_page=pied_de_page(e["slug"]),
            tete=TETE.format(numero=e["numero"], titre=e["titre"], pages=PAGES),
            barre=BARRE,
            pied=PIED,
            pages=PAGES,
            numero=e["numero"],
            titre=e["titre"],
            titre_h1=titre_en_h1(e["titre"]),
            slug=e["slug"],
            fond=f"{PAGES}/assets/zones/{photo}.jpg",
            rendu=f"{ARTWORK}/{numero_national}.png",
            #  `#` tant que la page suivante n'existe pas : un lien vers
            #  une adresse inventée serait un lien mort, et le sommaire
            #  dit déjà « à venir » pour la même raison.
            #  ── UN SECOND SCRIPT, POUR LES PAGES QUI EN ONT BESOIN ──
            #
            #  L'annexe de la carte porte la carte de l'index, qui pèse
            #  un millier de lignes. Mise dans `annexes.js`, elle serait
            #  téléchargée par les QUATORZE pages pour servir sur UNE.
            #  Elle a donc son paquet, et c'est `data/annexes.json` qui
            #  dit quelle page le charge — pas une exception écrite ici,
            #  qui serait un second endroit à tenir d'accord avec le
            #  premier.
            scripts="".join(
                f'\n<script src="{PAGES}/{s}"></script>' for s in e.get("scripts", [])
            ),
        )
        chemin = dossier / f"annexe-{e['numero']}-{e['slug']}.html"

        #  ── LE CORPS DÉJÀ RÉDIGÉ EST REPRIS, L'ENVELOPPE REFAITE ──
        #
        #  Avant, une page rédigée était simplement laissée de côté :
        #  elle ne recevait donc aucune correction d'enveloppe, et le
        #  jour où les annexes sont passées en pages autonomes, les
        #  deux pages écrites sont restées des fragments sans tête.
        #
        #  La page porte donc deux bornes autour de son corps. Ce qui
        #  est entre elles est à la rédaction et n'est jamais touché ;
        #  tout le reste — la tête, la barre, le pied, le script —
        #  appartient à cet outil et se refait à chaque passage.
        if chemin.exists():
            ancien = chemin.read_text(encoding="utf-8")
            corps = entre_les_bornes(ancien)
            #  SANS CONDITION. La première version ne reprenait le
            #  corps que si la page ne portait pas la signature de cet
            #  outil — or il la pose lui-même, donc au second passage
            #  elle était là et le corps rédigé repartait. Un piège
            #  qui se serait déclenché la fois d'après, en silence.
            if corps is not None:
                #  On ne le SIGNALE que s'il a vraiment été rédigé :
                #  sinon les quatorze lignes disent la même chose et
                #  la seule qui compte se perd dedans.
                if sans_le_pied(corps) != sans_le_pied(entre_les_bornes(page)):
                    reprises.append(chemin.name)
                #  LE PIED SE REFAIT, LE RESTE SE GARDE.
                corps = remplacer_le_pied(corps, pied_de_page(e["slug"]))
                corps = remplacer_le_surtitre(corps, e["numero"])
                page = remplacer_le_corps(page, corps)

        #  ── AUCUN NOM DE BALISE ÉCHAPPÉ DANS LE TEXTE ─────────────
        #
        #  Relevé le 1er novembre sur `/h1-par-ou-commencer` : le
        #  `&lt;table&gt;` d'une phrase du gabarit est revenu de
        #  Forumactif en VRAIE balise `<table>`, posée au milieu
        #  d'une cellule — et tout ce qui suivait, les deux encarts,
        #  le bouton et jusqu'au pied de Forumactif, s'est retrouvé
        #  dedans. C'est la même famille de pièges que le `$` qui
        #  devient `&#36;` : l'éditeur de pages HTML décode les
        #  entités en enregistrant.
        #
        #  On ne contourne pas, on n'en écrit plus. Une page ne doit
        #  nommer aucune balise, même échappée.
        if "&lt;" in page or "&gt;" in page:
            raise SystemExit(
                f"{e['slug']} : le texte contient une entité `&lt;` ou `&gt;`. "
                "Forumactif la décode en vraie balise en enregistrant la page, "
                "et tout ce qui suit tombe dedans. Écrire le mot, pas la balise."
            )
        chemin.write_text(page, encoding="utf-8")
        ecrits.append((chemin.name, len(page)))

    #  LES ANCIENNES PAGES S'EN VONT : un fichier `pages/annexe-04-…`
    #  resté d'une liste précédente serait collé un jour par erreur.
    #  ON NE SUPPRIME PLUS RIEN. Toutes les pages portent maintenant la
    #  signature de cet outil, y compris celles dont le corps est
    #  rédigé : s'en servir pour décider d'un effacement reviendrait à
    #  effacer du texte. Une page qui quitte le sommaire est une
    #  décision, pas un nettoyage — on la signale et on la laisse.
    gardees = {f"annexe-{e['numero']}-{e['slug']}.html" for e in entrees}
    for f in sorted(dossier.glob("annexe-*.html")):
        if f.name not in gardees:
            print(f"  ⚠ {f.name} n'est plus au sommaire — laissée, à retirer à la main")

    for n in reprises:
        print(f"  reprise  {n} — corps rédigé conservé, enveloppe refaite")
    if not ecrits:
        print("  aucune page à écrire")
        return
    plus_gros = max(n for _, n in ecrits)
    print(f"  {len(ecrits)} annexes écrites dans pages/")
    print(f"  la plus grosse fait {plus_gros} caractères (limite Forumactif : 128 000)")
    if plus_gros > 128_000:
        raise SystemExit("une page dépasse la limite de Forumactif")


if __name__ == "__main__":
    main()
