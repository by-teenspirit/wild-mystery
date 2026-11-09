#!/usr/bin/env python3
"""Les douze messages « défier le champion », prêts à coller.

══════════════════════════════════════════════════════════════════════

POURQUOI UN GÉNÉRATEUR ET PAS DOUZE COLLAGES

Le forum porte un sujet par défi — « Défier le champion de Pyrite »,
« …du Colosseum de Targare », onze comme ça, plus la Ligue. Relevé le
9 novembre sur `t91` : même phrase partout, avec le lieu, le type et
l'équipe qui changent. Et les CHIFFRES y sont ceux d'avant la refonte
des niveaux : le champion fée y est encore niveau 36-38 alors que son
défi est passé à 40.

Douze messages écrits à la main, c'est douze endroits où le jour où un
niveau bouge, onze restent faux. Ils sont donc dérivés des mêmes
données que l'annexe 06 : `data/arenes.json` pour le défi,
`data/equipes-de-champions.json` pour l'équipe et le type conseillé.

── L'INFOBULLE EST ÉCRITE EN CLAIR, ICI ────────────────────────────

Et c'est le contraire de ce que fait l'annexe depuis le 9 novembre,
où la page ne porte que `data-wm-bulle` et où `module-equipe.ts`
construit la balise. La raison tient à ce qu'est un message : il est
collé une fois, il reste dans le sujet des années, et il doit tenir
même si un script ne se charge pas. C'est déjà l'arbitrage des cartes
de dresseur.

L'annexe, elle, avait un mur à 128 000 caractères ; un message n'en a
pas — un sujet Forumactif accepte largement les trente mille d'une
équipe de six.

── CE QUE LE TEXTE GARDE, ET CE QU'IL CORRIGE ──────────────────────

La phrase est celle de Callista, relevée sur `t91`, au mot près. Deux
choses seulement en sortent, parce qu'elles sont fausses là-bas :

  · LE LIEU. Le sujet du Colosseum de Rhode parle du « Collosseum
    Port-Amarée », et il a RAISON : ce colosseum est bien à
    Port-Amarée. Mais deux défis s'y tiennent — l'Arène Eau aussi —
    et deux autres partagent Suerebe. Le titre nomme donc le DÉFI,
    pas sa ville, et la ville reste dans la phrase.
  · LE TYPE CONSEILLÉ. Il vient de la moyenne d'efficacité calculée
    sur les six membres, la même que l'annexe affiche.

ET « LE CHAMPION » RESTE AU MASCULIN, comme dans les titres de ses
douze sujets. Les données ne portent pas le genre des champions ; en
inventer un par défi serait pire qu'un générique.

    python3 outils/defier.py
"""

import json
import os
import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).parent))
#  ON IMPORTE PLUTÔT QUE DE RECOPIER. `adresse_du_sprite` lit la carte
#  de couverture et sait que trois espèces n'existent pas dans le style
#  du forum ; un chemin écrit en dur ici rendrait trois images cassées.
#  Même raison pour `en_titre` et `sans_accent` : les noms de type
#  accentués ne se déduisent pas d'une majuscule.
from annexes import (  # noqa: E402
    adresse_du_sprite,
    en_titre,
)

RACINE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SORTIE = os.path.join(RACINE, "templates", "defier-le-champion.a-coller.html")
#  ── UN FICHIER DÉGRAISSÉ PAR SUJET ──────────────────────────────────
#
#  « Je veux bien le code en min de chaque sujet » (9 novembre). Le
#  fichier d'ensemble sert à relire ; celui-ci sert à coller — un
#  fichier par sujet, nommé par son adresse, sans un commentaire ni une
#  indentation à décoller du presse-papier.
DOSSIER = os.path.join(RACINE, "templates", "defier")

PALIERS = {1: "Palier 1", 2: "Palier 2", 3: "Palier 3"}
FORUM = "https://mysteryinrhode.forumactif.com"


def degraisser(lignes):
    """Les lignes d'un bloc, sans commentaire ni indentation.

    ON NE TOUCHE PAS AU TEXTE. Les retours à la ligne sautent entre les
    BALISES, jamais à l'intérieur d'un paragraphe : un `join` nu
    recollerait « type Eau,et que si » faute de l'espace que portait le
    saut de ligne. Chaque ligne du générateur est déjà un élément
    complet, donc il suffit de retirer son indentation.
    """
    out = []
    dedans = False
    for l in lignes:
        nu = l.strip()
        if dedans:
            if "-->" in nu:
                dedans = False
            continue
        if nu.startswith("<!--"):
            #  UN COMMENTAIRE PEUT TENIR SUR PLUSIEURS LIGNES — celui
            #  qui dit où va le bloc en fait trois. Ne regarder que la
            #  première laissait « À COLLER DANS … --> » dans le code
            #  collé.
            if "-->" not in nu:
                dedans = True
            continue
        if nu == "":
            continue
        out.append(nu)
    return "".join(out) + "\n"


def lire(chemin):
    with open(os.path.join(RACINE, chemin), encoding="utf-8") as f:
        return json.load(f)


def e(t):
    """Échapper pour du texte ou un attribut à guillemets doubles."""
    return (str(t).replace("&", "&amp;").replace("<", "&lt;")
            .replace(">", "&gt;").replace('"', "&quot;"))


def cadres_de_types(w, table, retrait="  "):
    """Les deux petits cadres, en face à face.

    « Un petit cadre pour afficher le type super efficace contre le
    feu, et un autre petit cadre en face pour les types qui ne sont
    pas efficaces » (9 novembre).

    ILS PORTENT SUR UN TYPE, pas sur une équipe — c'est la table des
    types, nue, telle qu'un joueur la connaît. Le « type conseillé »
    d'un défi, lui, est une moyenne sur six membres qui peuvent être
    doubles : les deux ne disent pas la même chose, et les confondre
    donnerait un conseil faux.

    LES TYPES SONT DES PASTILLES, donc écrits en toutes lettres :
    dix-huit teintes dont plusieurs se ressemblent, et qui ne
    distingue pas le violet du psy de celui du poison doit pouvoir
    lire la réponse.
    """
    if not table:
        return
    w(f'{retrait}<div class="wm-annonce__blocs">')
    for titre, cle in (
        ("Super efficace contre lui", "superEfficaces"),
        ("Peu efficace contre lui", "peuEfficaces"),
    ):
        w(f'{retrait}  <div class="wm-annonce__bloc">')
        w(f'{retrait}    <p class="wm-annonce__bloc-titre">{e(titre)}</p>')
        #  LES PASTILLES SONT DANS UN RANG, et pas posées à la suite :
        #  collées les unes aux autres, elles formaient une barre de
        #  couleurs où l'on ne voyait plus où finissait un type. Le
        #  rang leur donne leur écart, et c'est lui qui les replie
        #  quand il y en a six.
        w(f'{retrait}    <p class="wm-annonce__types">'
          + "".join(pastille(ty) for ty in table[cle]) + '</p>')
        w(f'{retrait}  </div>')
    w(f'{retrait}</div>')


def pastille(cle):
    """Une pastille de type, nom écrit — la même que sur une case."""
    return (f'<span class="wm-type wm-type--{e(cle)}" data-wm-type="{e(cle)}">'
            f'{e(en_titre(cle))}</span>')


def case(m):
    """Une case d'équipe AVEC son infobulle, sur une seule ligne.

    Les types de la bulle sont des `<li>` dans un `<ul>` — c'est ce que
    `module-equipe.ts` construit, et c'est du HTML valide. La case, elle,
    ne porte que le premier type : elle fait moins de cent pixels.
    """
    #  ── LA CASE PORTE TOUS SES TYPES ────────────────────────────────
    #
    #  « Y'a des pokémons qui ont 2 types et tu les affiches pas »
    #  (9 novembre). Elle n'en portait qu'un, et le commentaire d'alors
    #  disait pourquoi : « la case fait moins de cent pixels, un double
    #  type y passerait sur deux lignes ». C'était vrai, et ça ne
    #  justifiait rien — un Roigada annoncé « Eau » quand il est
    #  Eau/Psy, c'est une information FAUSSE pour qui prépare un
    #  combat. Deux lignes coûtent quatre pixels ; une erreur de type
    #  coûte le combat.
    #
    #  `wm-equipe__types` les empile et les centre. Les six cases d'une
    #  rangée gardent la même hauteur : elles s'étirent déjà sur la
    #  plus grande, et le vide va au bas de celles qui n'ont qu'un
    #  type.
    pastilles = "".join(pastille(t) for t in m["types"])
    types = "".join(
        f'<li class="wm-infobulle__type" data-wm-type="{e(t)}">{e(en_titre(t))}</li>'
        for t in m["types"]
    )
    stats = "".join(
        f'<li class="wm-infobulle__stat"><span>{mot}</span>'
        f'<span>{m[cle]}</span></li>'
        for mot, cle in (("PV", "pv"), ("Attaque", "att"), ("Défense", "def"))
    )
    return (
        '<li class="wm-equipe__pkmn" tabindex="0">'
        f'<img class="wm-equipe__sprite" src="{e(m["sprite"])}" alt="" loading="lazy" />'
        f'<p class="wm-equipe__nom">{e(m["nom"])}</p>'
        f'<p class="wm-equipe__niveau">niv. {m["niveau"]}</p>'
        f'<p class="wm-equipe__types">{pastilles}</p>'
        '<div class="wm-infobulle" role="tooltip">'
        '<div class="wm-infobulle__tete">'
        f'<p class="wm-infobulle__nom">{e(m["nom"])}</p>'
        f'<span class="wm-infobulle__niveau">Niv. {m["niveau"]}</span></div>'
        f'<ul class="wm-infobulle__types">{types}</ul>'
        '<p class="wm-infobulle__surtitre">Statistiques</p>'
        f'<ul class="wm-infobulle__stats">{stats}</ul>'
        '</div></li>'
    )


def equipe(w, membres, couverture, retrait="  "):
    w(f'{retrait}<ul class="wm-equipe">')
    for m in membres:
        w(retrait + "  "
          + case(dict(m, sprite=adresse_du_sprite(couverture, m["id"]))))
    w(f"{retrait}</ul>")


RANGS = ("Premier", "Deuxième", "Troisième", "Quatrième", "Cinquième")


def duel(w, rang, titre, membres, couverture, table=None, dernier=False,
         type_=None):
    """Un adversaire d'une suite de combats, dans sa propre carte.

    « Ça manque d'espace ici, entre les équipes. On voit pas que ce sont
    des équipes différentes, de personnages différents » (9 novembre).

    LE DÉFAUT N'ÉTAIT PAS QUE L'ESPACE. Les cinq sections de la Ligue
    étaient cinq fois la même chose : une étiquette de dix pixels, deux
    cadres, une rangée de sprites, et rien entre elles. L'œil y lisait
    une seule longue équipe de trente pokémon. Ajouter vingt pixels
    aurait donné cinq rangées un peu plus espacées — pas cinq
    personnes.

    IL FALLAIT UNE CARTE, ET UN RANG. La carte, parce qu'une bordure
    autour d'un groupe dit « ceci va ensemble » bien plus vite qu'un
    blanc. Le rang, parce que ces cinq-là se combattent DANS L'ORDRE,
    et que c'est l'information qui manquait le plus : rien, avant, ne
    disait qu'on affronte le Psy puis le Combat puis le Poison.

    LE CHIFFRE EST `aria-hidden` : le rang est déjà écrit en toutes
    lettres juste à côté, et un lecteur d'écran n'a pas à entendre
    « un Premier adversaire ».

    ET LES MEMBRES DU CONSEIL 4 N'ONT PAS DE NOM. Le sujet de Callista
    ne les désigne que par leur type ; leur en inventer un serait
    écrire son forum à sa place. La hiérarchie se fait donc sur ce qui
    existe : l'ordre, le type, les niveaux.

    LE TYPE EST UNE PASTILLE, PAS UN MOT. « Sinon on voit pas tout de
    suite quel type on doit combattre » (9 novembre). C'est exactement
    ce que ce titre doit dire, et un mot en serif noir au bout d'une
    phrase ne le dit pas — il se lit, il ne se repère pas. La pastille
    porte la couleur du type et son point, les mêmes que sur les cases
    d'équipe juste en dessous : l'œil fait le lien sans lire.

    MICHAEL N'EN A PAS, et c'est juste : son équipe mélange six types,
    aucune pastille ne le résumerait.
    """
    niveaux = [m["niveau"] for m in membres]
    mot = "Dernier" if dernier else RANGS[rang - 1]
    w('  <div class="wm-annonce__duel'
      + (" wm-annonce__duel--champion" if dernier else "") + '">')
    w('    <div class="wm-annonce__duel-tete">')
    w(f'      <span class="wm-annonce__duel-rang" aria-hidden="true">{rang}</span>')
    w('      <div class="wm-annonce__duel-mots">')
    w(f'        <p class="wm-annonce__duel-rappel">{e(mot)} adversaire</p>')
    w(f'        <h3 class="wm-annonce__duel-titre">{e(titre)}'
      + (" " + pastille(type_) if type_ else "") + '</h3>')
    w(f'        <p class="wm-annonce__duel-niveaux">{len(membres)} pokémon · '
      f'niveaux {min(niveaux)} à {max(niveaux)}</p>')
    w('      </div>')
    w('    </div>')
    if table:
        cadres_de_types(w, table, retrait="    ")
    else:
        #  MICHAEL N'A PAS DE TABLE, et c'est un fait de ses données :
        #  son équipe mélange les types, donc aucune colonne ne vaut
        #  contre lui. Sa carte porte à la place les types qu'il
        #  aligne — même emplacement, même forme, pas un trou.
        vus = []
        for m in membres:
            for t in m["types"]:
                if t not in vus:
                    vus.append(t)
        w('    <div class="wm-annonce__blocs">')
        w('      <div class="wm-annonce__bloc">')
        w('        <p class="wm-annonce__bloc-titre">Les types de son '
          'équipe</p>')
        w('        <p class="wm-annonce__types">'
          + "".join(pastille(t) for t in vus) + '</p>')
        w('      </div>')
        w('    </div>')
    w('    <p class="wm-annonce__soustitre">Son équipe</p>')
    equipe(w, membres, couverture, retrait="    ")
    w('  </div>')


#  LA PHRASE DE CALLISTA, relevée le 9 novembre sur t91. Trois trous :
#  le lieu, le type du champion, le type conseillé.
PHRASE = (
    "Avant cela, permets-moi de te rappeler que le champion {lieu} utilise "
    "des pokémon de type {type}, et que si tu souhaites le vaincre, il te "
    "faudra privilégier les pokémon de type {conseil} — mais bien sûr, nous "
    "ne t'obligeons à rien. Le champion aura le droit, durant ce combat, "
    "d'utiliser une potion de son choix s'il juge cela nécessaire."
)
PHRASE_LIGUE = (
    "Avant cela, permets-moi de te rappeler que tu affronteras d'abord les "
    "quatre membres du Conseil 4, puis Michael. Si tu souhaites les vaincre, "
    "il te faudra privilégier les pokémon de type {conseil} — mais bien sûr, "
    "nous ne t'obligeons à rien. Chacun aura le droit, durant son combat, "
    "d'utiliser une potion de son choix s'il juge cela nécessaire."
)


def main():
    arenes = lire("data/arenes.json")
    equipes = lire("data/equipes-de-champions.json")["equipes"]
    #  LA CARTE DE COUVERTURE EST SON PROPRE FICHIER, et pas le champ
    #  `couverture` de `especes.json` — celui-là n'est qu'une phrase
    #  d'explication. Même source que l'annexe.
    couverture = lire("data/sprites-couverture.json")

    out = []
    w = out.append
    #  (nom du fichier, première ligne du bloc) — le bloc va jusqu'au
    #  début du suivant, ou jusqu'à la fin.
    blocs = []
    w("<!-- ══════════════════════════════════════════════════════════")
    w("     DÉFIER LE CHAMPION — les douze messages, prêts à coller.")
    w("")
    w("     ÉCRITS PAR `outils/defier.py` depuis data/arenes.json et")
    w("     data/equipes-de-champions.json. Ne pas corriger ce fichier")
    w("     à la main : la correction serait perdue au prochain")
    w("     passage, et elle ne toucherait qu'un des douze sujets.")
    w("")
    w("     COMMENT S'EN SERVIR : chaque bloc est délimité par une")
    w("     ligne ░░░. Copier le bloc voulu — sans sa ligne de titre —")
    w("     et le coller dans le message du sujet correspondant, en")
    w("     mode HTML.")
    w("")
    w("     LES CHIFFRES SONT CEUX DU DÉPÔT, pas ceux des messages")
    w("     actuels : les niveaux ont changé depuis, et les anciens")
    w("     messages montrent encore des équipes d'avant la refonte.")
    w("     ══════════════════════════════════════════════════════════ -->")
    w("")

    ordre = sorted(arenes["arenes"], key=lambda a: a["niveau"])
    for a in ordre:
        eq = equipes.get(a["slug"])
        if eq is None:
            continue
        #  ── LE NOM DU DÉFI, PAS SA VILLE ─────────────────────────
        #
        #  Deux défis partagent Port-Amarée — l'Arène Eau et le
        #  Colosseum de Rhode — et deux autres Suerebe. « Défier le
        #  champion de Port-Amarée » en désignerait donc deux.
        #
        #  ET CELA RÉHABILITE LE TEXTE D'ORIGINE : t91 parle du
        #  « Collosseum Port-Amarée », ce que j'avais pris pour un
        #  copier-coller d'un autre défi. C'en était un de ma part :
        #  le Colosseum de Rhode EST à Port-Amarée. Le sujet avait
        #  raison, la ville reste dans la phrase.
        lieu = ("de l'" if a["genre"] == "arene" else "du ") + a["nom"]
        #  ── OÙ VA CE BLOC ────────────────────────────────────────
        #
        #  Sans l'adresse écrite ici, il faut deviner quel bloc va dans
        #  quel sujet à partir du nom du lieu — et il y a onze sujets
        #  qui commencent tous par « Défier le champion ». Les quatre
        #  adresses connues viennent de `data/arenes.json` ; les sept
        #  autres sont dans les archives du staff, qu'un visiteur ne
        #  voit pas. Le bloc le dit plutôt que de faire comme si.
        numero = a["defier"].lstrip("/").split("-")[0] if a.get("defier") else "sans-sujet"
        blocs.append((f'{numero}-{a["slug"]}', len(out)))
        w(f'<!-- ░░░ {a["nom"].upper()} · {a["ville"].upper()} ░░░')
        if a.get("defier"):
            w(f'     À COLLER DANS {FORUM}{a["defier"]} -->')
        else:
            w('     SUJET INCONNU — ajoute son adresse dans `defier` de')
            w('     data/arenes.json et relance `deno task defier`. -->')
        w('<div class="wm-annonce wm-annonce--sable'
          ' wm-annonce--sans-filet">')
        w(f'  <p class="wm-annonce__soustitre">{e(PALIERS[a["palier"]])} · '
          f'niveau {a["niveau"]}</p>')
        w(f'  <h2 class="wm-annonce__titre">Défier le champion '
          f'{e(lieu)}</h2>')
        w('  <p class="wm-annonce__texte">' + e(PHRASE.format(
            lieu=f'{lieu}, à {a["ville"]},',
            type=en_titre(a["type"]),
            conseil=" ou ".join(en_titre(t) for t in eq["conseil"]["types"]),
        )) + "</p>")
        cadres_de_types(w, eq.get("table"))
        w('  <p class="wm-annonce__soustitre">L\'équipe du champion</p>')
        equipe(w, eq["membres"], couverture)
        w("</div>")
        w("")

    #  ── LA LIGUE : CINQ ÉQUIPES ────────────────────────────────────
    lig, eq = arenes["ligue"], equipes.get("ligue")
    if eq is not None:
        blocs.append(("t100-ligue-les-equipes", len(out)))
        w('<!-- ░░░ LA LIGUE · LE CONSEIL 4 ET LE CHAMPION ░░░')
        w(f'     À COLLER DANS {FORUM}/t100-presentation-de-la-ligue')
        w('     — le deuxième message, celui qui porte les équipes. -->')
        w('<div class="wm-annonce wm-annonce--sable'
          ' wm-annonce--sans-filet">')
        w(f'  <p class="wm-annonce__soustitre">{e(PALIERS[3])} · '
          f'niveau {lig["niveau"]}</p>')
        #  « au Mont Bataille » et pas « de Mont Bataille » : le nom
        #  du lieu porte son article, et le coller derrière « de »
        #  donnait « la Ligue de Mont Bataille ».
        w('  <h2 class="wm-annonce__titre">Défier la Ligue, '
          f'au {e(lig["ville"])}</h2>')
        w('  <p class="wm-annonce__texte">' + e(PHRASE_LIGUE.format(
            conseil=" ou ".join(en_titre(t) for t in eq["conseil"]["types"]),
        )) + "</p>")
        conseil4 = eq.get("conseil4", [])
        for rang, membre4 in enumerate(conseil4, start=1):
            duel(
                w, rang, "Conseil 4 · spécialiste",
                membre4["membres"], couverture, table=membre4.get("table"),
                type_=membre4["type"],
            )
        duel(
            w, len(conseil4) + 1,
            f'{lig["tenuePar"]}, champion de Rhode',
            eq["membres"], couverture, dernier=True,
        )
        w("</div>")
        w("")

    #  ── S'INSCRIRE À LA LIGUE FINALE ───────────────────────────────
    #
    #  Le texte est celui de Callista, relevé le 9 novembre sur le
    #  troisième message de t100, au mot près.
    #
    #  LE BLOC DE CODE N'EST PAS REPRIS. Il est dans une boîte « Code: »
    #  de Forumactif, qui est un composant du forum et pas de la
    #  charte ; le refaire ici demanderait une classe de plus, et
    #  celle de Forumactif fait déjà le travail. La carte se colle
    #  AU-DESSUS de la boîte existante, qui ne bouge pas.
    blocs.append(("t100-ligue-inscription", len(out)))
    w('<!-- ░░░ S\'INSCRIRE À LA LIGUE FINALE ░░░')
    w(f'     À COLLER DANS {FORUM}/t100-presentation-de-la-ligue')
    w('     — le troisième message, AU-DESSUS de sa boîte « Code: »,')
    w('     qui reste telle quelle. -->')
    w('<div class="wm-annonce wm-annonce--sable'
      ' wm-annonce--sans-filet">')
    w('  <p class="wm-annonce__soustitre">En avant pour le combat</p>')
    w('  <h2 class="wm-annonce__titre">S\'inscrire à la Ligue Finale</h2>')
    for para in (
        "Alors ça y est, tu te sens enfin d'attaque pour défier notre Ligue "
        "Finale ? Tu as obtenu tous les badges de la région et vaincu tous "
        "les Colosseums ? Nous voilà impressionné mon mignon ! Te voici donc "
        "au bon endroit !",
        "Avant de pouvoir lancer un rp de folie, il te faut passer par le "
        "remplissage du formulaire que tu trouveras un peu plus bas. Cela "
        "permettra aux membres du Staff d'être mis au courant que quelqu'un "
        "vient défier le grand Michael et son Conseil 4. Il te faudra "
        "simplement attendre que le PNJ Michael poste votre sujet.",
        "Évidemment, le challenger est le premier à lancer une attaque et ce "
        "sera ensuite le plus merveilleux et le plus dur de tous les combats "
        "auxquels tu auras pu participer ! Faites de votre mieux, ton équipe "
        "et toi.",
    ):
        w(f'  <p class="wm-annonce__texte">{e(para)}</p>')
    w('  <p class="wm-annonce__texte">Les pokémon de la Ligue sont listés '
      'dans le sujet de présentation. Et maintenant, c\'est à toi de jouer, '
      'jeune dresseur !</p>')
    w("</div>")
    w("")

    texte = "\n".join(out) + "\n"
    with open(SORTIE, "w", encoding="utf-8") as f:
        f.write(texte)
    print(f"   {os.path.relpath(SORTIE, RACINE)} : {len(texte)} caractères, "
          f"{len(blocs)} blocs")

    #  UN FICHIER PAR SUJET, DÉGRAISSÉ. Le dossier est refait à chaque
    #  passage : un sujet retiré de `arenes.json` ne doit pas laisser
    #  son fichier derrière lui, que quelqu'un collerait des mois plus
    #  tard sans savoir qu'il ne correspond plus à rien.
    os.makedirs(DOSSIER, exist_ok=True)
    for vieux in os.listdir(DOSSIER):
        if vieux.endswith(".min.html"):
            os.remove(os.path.join(DOSSIER, vieux))
    bornes = [i for _, i in blocs] + [len(out)]
    for (nom, _), debut, fin in zip(blocs, bornes, bornes[1:]):
        contenu = degraisser(out[debut:fin])
        chemin = os.path.join(DOSSIER, f"{nom}.min.html")
        with open(chemin, "w", encoding="utf-8") as f:
            f.write(contenu)
        print(f"   {os.path.relpath(chemin, RACINE)} : {len(contenu)} caractères")


if __name__ == "__main__":
    main()
