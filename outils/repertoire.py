#!/usr/bin/env python3
# ════════════════════════════════════════════════════════════════════
#  outils/repertoire.py — écrire la page du répertoire des personnages
#
#  USAGE :  python3 outils/repertoire.py
#
#  « Il faudrait faire une page sur laquelle on a tous les personnages
#  validés avec quelques infos : leur avatar (en image) & leur avatar
#  (le faceclaim), leur nom, leur métier, leur groupe, leur caractère
#  en quelques mots, leur lieu de vie, leur âge, leur région d'origine,
#  le lien vers la fiche de liens et vers la présentation (ce serait
#  des cards, on en affiche 3 ou 4 par colonne). On pourrait filtrer
#  cette page. » — 10 novembre 2026.
#
#  ── LES CARTES SONT DANS LA PAGE, PAS CONSTRUITES PAR UN SCRIPT ────
#
#  C'est la différence avec le bloc d'accueil, et elle est décisive :
#  l'accueil REMPLACE un repli déjà lisible, alors qu'ici le contenu
#  de la page EST la liste. Sans JavaScript, une page qui dessine ses
#  cartes en script est une page blanche. Elles sont donc écrites ici,
#  une fois, et le script n'ajoute QUE la barre de filtres.
#
#  C'est aussi la règle de l'annexe 11 : un bouton n'a le droit de
#  cacher que ce qu'il peut remontrer. Une barre écrite dans la page
#  masquerait des personnages que rien ne pourrait plus rouvrir.
#
#  ── LA PAGE EMPRUNTE L'ENVELOPPE DES ANNEXES ──────────────────────
#
#  Même tête, même barre de retour, même fond de zone, même pied :
#  `annexes.py` les expose, et les recopier ici ferait un second
#  endroit à corriger. Elle n'emprunte PAS le sommaire — elle n'est
#  pas une annexe, et une barre latérale « Les annexes » y désignerait
#  quatorze pages dont celle-ci ne fait pas partie.
# ════════════════════════════════════════════════════════════════════

import html
import json
import pathlib
import sys
import unicodedata

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from annexes import BARRE, FEUILLES, METAS, PAGES, PIED, ARTWORK  # noqa: E402

R = pathlib.Path(__file__).resolve().parent.parent

#  LE DÉCOR. Une photo de zone et un pokémon, comme les annexes. La
#  plage du Grain de Sel est celle de « Par où commencer » : c'est la
#  zone où tout le monde arrive, et un répertoire d'habitants y est
#  chez lui. Évoli (133) pour le rendu — autant de formes que de
#  caractères, et aucune annexe ne l'utilise.
PHOTO = "plage-grain-de-sel"
RENDU = 133

#  L'adresse de la page, à reporter une fois créée sur le forum. Elle
#  sert au lien « Répertoire des personnages » des liens rapides et de
#  la barre latérale, qui sont aujourd'hui SANS adresse — une entrée
#  grise, qu'on voit arriver et sur laquelle on ne clique pas.
SORTIE = R / "pages/repertoire-des-personnages.html"

#  ── LES TROIS FAITS DE LA CARTE ────────────────────────────────────
#
#  Clé du fichier → intitulé affiché, dans l'ordre de la carte.
#
#  LE MÉTIER EST DESCENDU ICI le 12 novembre : il était le surtitre, en
#  capitales au-dessus du nom, et c'est le FACECLAIM qui y monte. Un
#  surtitre est l'étiquette la plus lue d'une carte après son titre, et
#  dans un répertoire de RPG la question qui vient avant toutes les
#  autres est « avec quel avatar ? ». Le métier reste un fait parmi les
#  cinq, à sa place : on le lit quand on lit la fiche.
FAITS = [("metier", "Métier"), ("age", "Âge"), ("statut", "Statut"),
         ("lieu", "Vit à"), ("origine", "De")]


def e(s):
    """Le texte, échappé.

    `quote=True` PARCE QUE LA MÊME FONCTION SERT DANS LES ATTRIBUTS :
    un guillemet dans un nom de personnage fermerait `data-wm-cherche`
    et le reste de la carte deviendrait des attributs inventés.
    """
    return html.escape(str(s or ""), quote=True)


def sans_accent(s):
    """Pour le texte cherchable : « lumirande » doit trouver
    « Lumirandé », et personne ne tape les accents dans un champ.

    JUMEAU DE `sansAccent()` dans `src/navigateur/repertoire.ts`. Les
    deux doivent s'accorder : le module compare la saisie à CE qu'on
    écrit ici. Le harnais les met face à face sur les vrais noms.
    """
    return "".join(
        c for c in unicodedata.normalize("NFD", s.lower())
        if unicodedata.category(c) != "Mn"
    )


def adresse(u):
    """Une adresse, ou rien.

    MÊME RÈGLE QUE `adresse()` CÔTÉ NAVIGATEUR, et pour la même
    raison : cette page est collée sur le forum, et un `javascript:`
    dans un fichier de données serait du code exécuté au clic.
    """
    u = (u or "").strip()
    if u.startswith(("/", "./", "#")) or u.lower().startswith(("http://", "https://")):
        return u
    return ""


def lire_les_groupes():
    """Les six clés de groupe et leurs noms, depuis leur seule source.

    PAS UNE TABLE ÉCRITE ICI : les six noms sont déjà dans
    `data/groupes.json`, avec leurs accents, et une seconde liste
    finirait par ne plus dire « Sérieux » de la même façon.
    """
    d = json.loads((R / "data/groupes.json").read_text(encoding="utf-8"))
    return {g["cle"]: g["nom"] for g in d["groupes"]}


def carte(p, groupes, plaintes):
    """Le HTML d'une carte. Rend `None` pour un personnage sans nom."""
    nom = (p.get("nom") or "").strip()
    if nom == "":
        #  SANS NOM, RIEN À MONTRER. Une carte muette dans une grille
        #  se lit comme une erreur de la page, pas comme une donnée
        #  qui manque.
        plaintes.append("un personnage sans nom — il ne sera pas affiché")
        return None

    cle = (p.get("groupe") or "").strip().lower()
    groupe = groupes.get(cle, "")
    if cle != "" and groupe == "":
        #  ON LE DIT ICI ET PAS DANS LA PAGE. Une pastille sans
        #  couleur se croirait cassée ; une plainte à la génération se
        #  voit tout de suite et se corrige d'une ligne.
        plaintes.append(f"{nom} : groupe « {cle} » inconnu — pas de pastille")

    #  LE TEXTE CHERCHABLE EST PRÉPARÉ UNE FOIS. Sur cent cartes, le
    #  recomposer à chaque frappe se sent ; et l'ordre des champs n'a
    #  aucune importance puisqu'on y cherche des mots.
    cherche = sans_accent(" ".join(
        str(p.get(k) or "") for k in
        ("nom", "metier", "caractere", "faceclaim", "lieu", "origine", "statut")
    ))

    faits = "".join(
        f'\n            <li class="wm-repertoire__fait">'
        f'<span class="wm-repertoire__cle">{e(mot)}</span>'
        f"<span>{e(p[k])}</span></li>"
        for k, mot in FAITS if (p.get(k) or "").strip() != ""
    )
    #  LE FILET APPARTIENT AU PIED, PAS AU FACECLAIM. Il séparait les
    #  faits du bas de carte en vivant sur la ligne « Avatar · … » —
    #  donc une carte sans faceclaim perdait le filet avec lui, et ses
    #  deux boutons se collaient aux trois faits. La classe se pose
    #  sur le PREMIER des deux blocs, quel qu'il soit.
    liens = "".join(
        f'\n            <li><a class="wm-repertoire__lien" href="{e(adresse(p[k]))}">'
        f"{mot}</a></li>"
        for k, mot in (("presentation", "Présentation"), ("liens", "Liens"))
        if adresse(p.get(k)) != ""
    )

    #  LE PORTRAIT MANQUANT LAISSE UN CADRE VIDE, pas une silhouette
    #  inventée : on voit ce qui manque. `loading="lazy"` parce qu'un
    #  répertoire de cent personnages, c'est cent images.
    image = (
        f'<img class="wm-repertoire__portrait" src="{e(adresse(p.get("avatar")))}"'
        f' alt="" loading="lazy" />'
        if adresse(p.get("avatar")) != ""
        else '<span class="wm-repertoire__portrait wm-repertoire__portrait--vide"'
             ' aria-hidden="true"></span>'
    )
    #  LA PASTILLE EST DANS LE CADRE, pas à côté : elle se pose en
    #  `absolute`, et son coin haut-droit est celui de l'IMAGE. Sœur du
    #  cadre, elle se serait accrochée au premier parent positionné —
    #  la colonne d'annexe — et serait partie en haut de la page.
    pastille = (
        f'<p class="wm-repertoire__groupe wm-groupe--{e(cle)}">{e(groupe)}</p>'
        if groupe != "" else ""
    )

    #  LE FACECLAIM EST MONTÉ EN SURTITRE, à la place du métier. Il
    #  n'est donc plus au pied de la carte, et le filet du pied revient
    #  aux boutons — seuls occupants de cette zone désormais.
    a_un_fc = (p.get("faceclaim") or "").strip() != ""

    #  LES QUATRE ATTRIBUTS QUE LE MODULE RELIT. `data-wm-cherche` est
    #  le dernier parce qu'il est le plus long : les trois autres
    #  restent lisibles à l'inspecteur.
    return f"""
        <li class="wm-repertoire__carte"
            data-wm-groupe="{e(groupe)}"
            data-wm-lieu="{e(p.get('lieu'))}"
            data-wm-origine="{e(p.get('origine'))}"
            data-wm-statut="{e(p.get('statut'))}"
            data-wm-cherche="{e(cherche)}">
          <div class="wm-repertoire__cadre">{image}{pastille}</div>
          <div class="wm-repertoire__dedans">
            {f'<p class="wm-repertoire__fc">{e(p["faceclaim"])}</p>' if a_un_fc else ''}
            <h2 class="wm-repertoire__nom">{e(nom)}</h2>
            {f'<p class="wm-repertoire__caractere">{e(p["caractere"])}</p>'
             if (p.get('caractere') or '').strip() != '' else ''}
            {f'<ul class="wm-repertoire__faits">{faits}</ul>' if faits else ''}
            {f'<ul class="wm-repertoire__liens wm-repertoire__pied">{liens}</ul>'
             if liens else ''}
          </div>
        </li>"""


GABARIT = """<!-- ═══════════════════════════════════════════════════════════════════
     Répertoire des personnages — à coller dans une page HTML.

     ÉCRITE PAR `outils/repertoire.py` depuis `data/repertoire.json`.
     Ne pas corriger ce fichier à la main : la correction serait perdue
     à la prochaine génération. Ajouter un personnage, c'est ajouter un
     objet dans le fichier de données, puis relancer l'outil.

     ── CRÉER LA PAGE SUR LE FORUM ─────────────────────────────────

     Modules > HTML & JAVASCRIPT > Gestion des pages HTML > Créer, en
     MODE AVANCÉ, et « Utiliser le header et le footer du forum » = NON :
     la page charge elle-même ses polices, sa feuille et son script,
     exactement comme les annexes.

     Créée le 12 novembre 2026 : /h14-repertoire-des-personnages. Son
     adresse est posée dans `data/navigation.json` (barre latérale) et
     `data/accueil.json` (liens rapides).

     LA BARRE DE FILTRES EST POSÉE PAR LE SCRIPT, et c'est voulu : sans
     JavaScript, tous les personnages restent affichés. Un bouton n'a le
     droit de cacher que ce qu'il peut remontrer. LES DEUX BOTTINS DE LA
     COLONNE DE GAUCHE, eux, sont écrits en dur : ce sont des listes à
     lire, pas des commandes.
     ═══════════════════════════════════════════════════════════════════ -->

<!DOCTYPE html>
<html lang="fr">
<head>
{tete}
</head>
<body>
<div id="modernbb">
{barre}

<div class="wm-annexe" style="--annexe-fond: url('{fond}'); --annexe-rendu: url('{rendu}')">

{bottins}

  <div class="wm-annexe__corps">
    <div class="wm-annexe__colonne wm-annexe__colonne--large">

      <p class="wm-annexe__surtitre">{surtitre}</p>
      <h1 class="wm-annexe__titre">{titre}</h1>
      <p class="wm-annexe__chapo">{intro}</p>

{contenu}

    </div>
  </div>
</div>

{pied}
</div>
<script src="{pages}/js/annexes.js"></script>
</body>
</html>
"""

RIEN = """      <p class="wm-repertoire__rien">
        Le répertoire attend ses premières fiches. Les personnages validés
        s'écrivent dans <code>data/repertoire.json</code>, et cette page se
        refait d'une commande.
      </p>"""


def bottins(personnages):
    """La colonne de gauche : qui joue quel faceclaim, et qui tient
    quel métier, lieu par lieu.

    ── POURQUOI DEUX LISTES ET PAS UN FILTRE DE PLUS ─────────────────

    Demandées le 12 novembre. Elles ne répondent pas à la même question
    que la grille : la grille montre un personnage et dit tout de lui,
    les bottins montrent ce qui est PRIS. « Est-ce que cet avatar est
    déjà pris ? » et « il y a déjà qui à Lumirandé ? » sont les deux
    questions qu'on se pose AVANT d'écrire une fiche, et aucune ne se
    répond en faisant défiler des cartes.

    ÉCRITES EN DUR, comme les cartes : ce sont des listes à lire, pas
    des commandes, et elles doivent tenir sans JavaScript.

    ELLES SE DÉDUISENT DES PERSONNAGES et ne sont tenues nulle part :
    ajouter une fiche ajoute son faceclaim et son métier, et un
    faceclaim libéré disparaît tout seul. Une liste tenue à la main
    serait fausse au premier oubli — et le propre d'un bottin faux est
    qu'on ne s'en aperçoit qu'après avoir validé le doublon.
    """
    fcs = sorted(
        ((p["faceclaim"].strip(), p["nom"].strip()) for p in personnages
         if (p.get("faceclaim") or "").strip() != "" and (p.get("nom") or "").strip() != ""),
        key=lambda c: sans_accent(c[0]),
    )

    #  ── LES PRÉNOMS ET LES NOMS, SÉPARÉMENT ──────────────────────
    #
    #  Demandé le 12 novembre, et c'est encore une question d'avant la
    #  fiche : « est-ce qu'il y a déjà une Ana ? », « est-ce que ce nom
    #  de famille est pris ? ». Dans la grille, les deux sont collés en
    #  un seul titre et on ne peut pas les parcourir.
    #
    #  LE PREMIER MOT EST LE PRÉNOM, LE RESTE LE NOM. C'est faux pour
    #  qui en porte deux, et ça se corrige à la lecture — une règle plus
    #  savante se tromperait autrement, sans qu'on sache comment. Un
    #  personnage qui n'a qu'un mot n'a pas de nom de famille : Arceus
    #  n'entre que dans la première liste, il n'invente pas la seconde.
    prenoms, noms = [], []
    for p in personnages:
        nom = (p.get("nom") or "").strip()
        if nom == "":
            continue
        mots = nom.split()
        prenoms.append((mots[0], nom))
        if len(mots) > 1:
            noms.append((" ".join(mots[1:]), nom))
    prenoms.sort(key=lambda c: sans_accent(c[0]))
    noms.sort(key=lambda c: sans_accent(c[0]))
    #  PAR LIEU, et les lieux par ordre alphabétique. Les personnages
    #  sans lieu ne tombent pas dans un « Ailleurs » inventé : ils ne
    #  sont simplement pas dans ce bottin-là, qui parle de lieux.
    par_lieu = {}
    for p in personnages:
        lieu = (p.get("lieu") or "").strip()
        metier = (p.get("metier") or "").strip()
        if lieu == "" or metier == "":
            continue
        par_lieu.setdefault(lieu, []).append((metier, (p.get("nom") or "").strip()))

    if not fcs and not par_lieu and not prenoms:
        #  RIEN À LISTER, PAS DE COLONNE. Une barre latérale avec des
        #  titres et aucune ligne dessous ressemble à une panne.
        return ""

    def lignes(paires):
        return "".join(
            f'\n          <li class="wm-bottin__ligne">'
            f'<span class="wm-bottin__quoi">{e(a)}</span>'
            f'<span class="wm-bottin__qui">{e(b)}</span></li>'
            for a, b in paires
        )

    #  ── QUATRE ONGLETS, PAS QUATRE LISTES EMPILÉES ──────────────
    #
    #  « Faut que tu réfléchisses comme si les bottins allaient
    #  contenir peut-être 30 à 50 noms, donc je pense que ce sera des
    #  onglets dans le bandeau latéral plutôt. » 12 novembre.
    #
    #  Le compte le dit : à cinquante personnages, les quatre listes
    #  empilées font plus de deux mille pixels de colonne, et le
    #  bottin des métiers — le dernier — ne se voit plus jamais.
    #
    #  LA MÉCANIQUE EST CELLE DES SOUS-ONGLETS D'ANNEXE, telle quelle :
    #  `data-wm-sous-onglets` autour, une `section` par liste, et
    #  `module-annexes.ts` construit la barre depuis le premier titre.
    #  Rien de neuf à écrire, et on hérite du clavier, des `aria` et de
    #  la règle qui compte : sans JavaScript, les quatre listes
    #  s'affichent à la suite et rien n'est caché.
    #
    #  LE COMPTE N'EST PAS DANS LE TITRE. Le module prend le texte du
    #  titre comme libellé de bouton, et « Prénoms · 37 » sur quatre
    #  boutons dans 252 px ne tient pas. Il est sur la ligne en dessous,
    #  qui reste visible une fois l'onglet ouvert.
    parts = [
        '  <nav class="wm-annexe__sommaire wm-bottins" aria-label="Les bottins">',
        '    <div class="wm-annexe__entete">',
        '      <div class="wm-annexe__logo" aria-hidden="true"></div>',
        '      <p class="wm-annexe__enseigne">Les bottins</p>',
        "    </div>",
        '    <div class="wm-sous-onglets wm-bottins__onglets" data-wm-sous-onglets>',
    ]

    #  L'ORDRE SUIT CELUI DES QUESTIONS qu'on se pose en créant un
    #  personnage : son prénom, son nom, son avatar, puis sa place.
    for cle, mot, paires in (("prenoms", "Prénoms", prenoms),
                             ("noms", "Noms", noms),
                             ("faceclaims", "Avatars", fcs)):
        if not paires:
            continue
        parts += [
            f'      <section data-wm-sous-onglet="{cle}">',
            f"        <h2>{mot}</h2>",
            f'        <p class="wm-bottin__compte">{len(paires)} pris</p>',
            f'        <ul class="wm-bottin">{lignes(paires)}\n        </ul>',
            "      </section>",
        ]

    if par_lieu:
        parts += ['      <section data-wm-sous-onglet="metiers">',
                  "        <h2>Métiers</h2>",
                  f'        <p class="wm-bottin__compte">'
                  f'{sum(len(v) for v in par_lieu.values())} tenus, '
                  f'{len(par_lieu)} lieux</p>']
        for lieu in sorted(par_lieu, key=sans_accent):
            metiers = sorted(par_lieu[lieu], key=lambda c: sans_accent(c[0]))
            parts += [
                '        <div class="wm-bottin__lieu">',
                f'          <p class="wm-bottin__ou">{e(lieu)}</p>',
                f'          <ul class="wm-bottin">{lignes(metiers)}\n          </ul>',
                "        </div>",
            ]
        parts.append("      </section>")

    parts.append("    </div>")
    parts.append("  </nav>")
    return "\n".join(parts)


def main(source=None, sortie=None):
    """Écrit la page.

    LES DEUX CHEMINS SONT DES ARGUMENTS pour que le harnais puisse
    monter la VRAIE page sur des données d'essai. Le fichier livré est
    vide tant que les personnages ne sont pas écrits, et un harnais
    qui n'éprouve qu'une page vide n'éprouve rien — mais réécrire le
    gabarit dans le harnais reviendrait à mesurer autre chose que ce
    qu'on colle.

        python3 outils/repertoire.py --donnees <json> --sortie <html>
    """
    source = source or (R / "data/repertoire.json")
    sortie = sortie or SORTIE
    d = json.loads(pathlib.Path(source).read_text(encoding="utf-8"))
    groupes = lire_les_groupes()
    plaintes = []

    cartes = [c for c in (carte(p, groupes, plaintes) for p in d["personnages"])
              if c is not None]

    #  LA GRILLE EST UNE LISTE, pas une suite de `div` : c'en est une,
    #  et un lecteur d'écran annonce alors « liste de douze éléments »
    #  avant de les parcourir.
    contenu = (
        f'      <ul class="wm-repertoire__grille" data-wm-repertoire>'
        f'{"".join(cartes)}\n      </ul>'
        if cartes else RIEN
    )

    page = GABARIT.format(
        tete=(METAS + f"\n  <title>{e(d['titre'])} — Wild Mystery</title>\n"
              + FEUILLES).format(pages=PAGES),
        barre=BARRE,
        pied=PIED,
        pages=PAGES,
        surtitre=e(d.get("surtitre") or "Les personnages"),
        titre=e(d["titre"]),
        intro=e(d.get("intro") or ""),
        bottins=bottins(d["personnages"]),
        fond=f"{PAGES}/assets/zones/{PHOTO}.jpg",
        rendu=f"{ARTWORK}/{RENDU}.png",
        contenu=contenu,
    )

    #  MÊME GARDE QUE LES ANNEXES : l'éditeur de pages HTML de
    #  Forumactif décode les entités en enregistrant, et un
    #  `&lt;table&gt;` écrit dans un texte revient en VRAIE balise, qui
    #  avale tout ce qui suit. On ne contourne pas, on n'en écrit plus.
    if "&lt;" in page or "&gt;" in page:
        raise SystemExit(
            "le texte contient une entité `&lt;` ou `&gt;`. Forumactif la "
            "décode en vraie balise en enregistrant, et tout ce qui suit "
            "tombe dedans. Écrire le mot, pas la balise."
        )

    pathlib.Path(sortie).write_text(page, encoding="utf-8")
    for p in plaintes:
        print(f"  ⚠ {p}")
    print(f"  {pathlib.Path(sortie).name} — {len(cartes)} personnage(s), {len(page)} caractères")
    if len(cartes) == 0:
        print("     (la liste est vide : la page le dit, plutôt qu'une grille blanche)")
    #  LE MUR DE FORUMACTIF. L'éditeur s'arrête à 128 000 caractères et
    #  refuse EN SILENCE : on alerte à 120 000, comme le garde-fou 33.
    if len(page) > 120_000:
        print("     ⚠ on approche des 128 000 caractères de l'éditeur Forumactif")
    if len(page) > 128_000:
        raise SystemExit("la page dépasse la limite de Forumactif")


def depuis_la_ligne_de_commande(args):
    """`--donnees X --sortie Y`, ou rien."""
    def apres(drapeau):
        return args[args.index(drapeau) + 1] if drapeau in args else None
    return apres("--donnees"), apres("--sortie")


if __name__ == "__main__":
    main(*depuis_la_ligne_de_commande(sys.argv[1:]))
