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
    Port-Amarée » — un copier-coller d'un autre défi. Ici le lieu
    vient de `arenes.json`, donc il est juste par construction.
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

PALIERS = {1: "Palier 1", 2: "Palier 2", 3: "Palier 3"}


def lire(chemin):
    with open(os.path.join(RACINE, chemin), encoding="utf-8") as f:
        return json.load(f)


def e(t):
    """Échapper pour du texte ou un attribut à guillemets doubles."""
    return (str(t).replace("&", "&amp;").replace("<", "&lt;")
            .replace(">", "&gt;").replace('"', "&quot;"))


def case(m):
    """Une case d'équipe AVEC son infobulle, sur une seule ligne.

    Les types de la bulle sont des `<li>` dans un `<ul>` — c'est ce que
    `module-equipe.ts` construit, et c'est du HTML valide. La case, elle,
    ne porte que le premier type : elle fait moins de cent pixels.
    """
    premier = m["types"][0]
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
        f'<span class="wm-type wm-type--{e(premier)}" data-wm-type="{e(premier)}">'
        f'{e(en_titre(premier))}</span>'
        '<div class="wm-infobulle" role="tooltip">'
        '<div class="wm-infobulle__tete">'
        f'<p class="wm-infobulle__nom">{e(m["nom"])}</p>'
        f'<span class="wm-infobulle__niveau">Niv. {m["niveau"]}</span></div>'
        f'<ul class="wm-infobulle__types">{types}</ul>'
        '<p class="wm-infobulle__surtitre">Statistiques</p>'
        f'<ul class="wm-infobulle__stats">{stats}</ul>'
        '</div></li>'
    )


def equipe(w, membres, couverture):
    w('  <ul class="wm-equipe">')
    for m in membres:
        w("    " + case(dict(m, sprite=adresse_du_sprite(couverture, m["id"]))))
    w("  </ul>")


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
        lieu = ("de l'" if a["ville"][:1].lower() in "aeiouéèî" else "de ")
        w(f'<!-- ░░░ {a["nom"].upper()} · {a["ville"].upper()} ░░░ -->')
        w('<div class="wm-annonce wm-annonce--centre">')
        w(f'  <p class="wm-annonce__soustitre">{e(PALIERS[a["palier"]])} · '
          f'niveau {a["niveau"]}</p>')
        w(f'  <h2 class="wm-annonce__titre">Défier le champion '
          f'{e(lieu)}{e(a["ville"])}</h2>')
        w('  <p class="wm-annonce__texte">' + e(PHRASE.format(
            lieu=f'{lieu}{a["ville"]}',
            type=en_titre(a["type"]),
            conseil=" ou ".join(en_titre(t) for t in eq["conseil"]["types"]),
        )) + "</p>")
        w('  <div class="wm-annonce__separateur"></div>')
        w('  <p class="wm-annonce__soustitre">L\'équipe du champion</p>')
        equipe(w, eq["membres"], couverture)
        w("</div>")
        w("")

    #  ── LA LIGUE : CINQ ÉQUIPES ────────────────────────────────────
    lig, eq = arenes["ligue"], equipes.get("ligue")
    if eq is not None:
        w('<!-- ░░░ LA LIGUE · LE CONSEIL 4 ET LE CHAMPION ░░░ -->')
        w('<div class="wm-annonce wm-annonce--centre">')
        w(f'  <p class="wm-annonce__soustitre">{e(PALIERS[3])} · '
          f'niveau {lig["niveau"]}</p>')
        w(f'  <h2 class="wm-annonce__titre">Défier la Ligue '
          f'{e("de " + lig["ville"])}</h2>')
        w('  <p class="wm-annonce__texte">' + e(PHRASE_LIGUE.format(
            conseil=" ou ".join(en_titre(t) for t in eq["conseil"]["types"]),
        )) + "</p>")
        for membre4 in eq.get("conseil4", []):
            niveaux = [m["niveau"] for m in membre4["membres"]]
            w('  <div class="wm-annonce__separateur"></div>')
            w('  <p class="wm-annonce__soustitre">Conseil 4 · '
              f'{e(en_titre(membre4["type"]))} — niveaux '
              f'{min(niveaux)} à {max(niveaux)}</p>')
            equipe(w, membre4["membres"], couverture)
        niveaux = [m["niveau"] for m in eq["membres"]]
        w('  <div class="wm-annonce__separateur"></div>')
        w(f'  <p class="wm-annonce__soustitre">{e(lig["tenuePar"])}, champion de '
          f'Rhode — niveaux {min(niveaux)} à {max(niveaux)}</p>')
        equipe(w, eq["membres"], couverture)
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
    w('<!-- ░░░ S\'INSCRIRE À LA LIGUE FINALE ░░░ -->')
    w('<!--     À coller AU-DESSUS de la boîte « Code: » du message,')
    w('         qui reste telle quelle. -->')
    w('<div class="wm-annonce wm-annonce--centre wm-annonce--sable">')
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
    w('  <div class="wm-annonce__separateur"></div>')
    w('  <p class="wm-annonce__texte">Les pokémon de la Ligue sont listés '
      'dans le sujet de présentation. Et maintenant, c\'est à toi de jouer, '
      'jeune dresseur !</p>')
    w("</div>")
    w("")

    texte = "\n".join(out) + "\n"
    with open(SORTIE, "w", encoding="utf-8") as f:
        f.write(texte)
    print(f"   {os.path.relpath(SORTIE, RACINE)} : {len(texte)} caractères, "
          f"{len(ordre) + (1 if eq is not None else 0)} blocs")


if __name__ == "__main__":
    main()
