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
from annexes import (  # noqa: E402
    DEBUT,
    FIN,
    entre_les_bornes,
    chemin_de_la_page,
    numero_de,
    pied_de_page,
    remplacer_le_corps,
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
    #  ── NI PHOTO DE FOND, NI RENDU, ET TOUTE LA LARGEUR ───────────
    #
    #  « Enlève finalement le fond des annexes et hésite pas à prendre
    #  la largeur dispo. En tout cas, sur cette annexe. » (4 novembre)
    #
    #  Les treize autres gardent leur photo : c'est celle-ci qui porte
    #  une carte, et une carte dans 880 pixels avec un lavis par-dessus
    #  se regarde mal. `--large` est une classe qui existait déjà.
    w('<div class="wm-annexe wm-annexe--sans-fond">')
    w("")
    w('  <nav class="wm-annexe__sommaire" data-wm-sommaire aria-label="Les annexes"></nav>')
    w("")
    w('  <div class="wm-annexe__corps">')
    w('    <div class="wm-annexe__colonne wm-annexe__colonne--large">')
    w("")
    #  L'EN-TÊTE PREND LA MESURE DES AUTRES PAGES, lui aussi. La
    #  colonne est en `--large` pour la carte, mais un titre et un
    #  chapô de 1500 pixels de large sont exactement ce que « que ça
    #  ressemble aux autres maquettes » demande d'éviter. Seule la
    #  carte déborde.
    w('      <div class="wm-annexe__onglet--mesure">')
    w('      <p class="wm-annexe__surtitre">Annexe '
      f'{numero_de("la-region-et-ses-zones")}</p>')
    w('      <h1 class="wm-annexe__titre">La <em>région</em> et ses zones</h1>')
    w('      <p class="wm-annexe__chapo">')
    w(f"        Dix-sept zones sauvages, trois paliers, {total_especes(faunes)} lignes d'espèce.")
    w("        Clique une zone sur la carte : tout ce qui y vit s'affiche dessous,")
    w("        dans l'ordre du Pokédex, avec quelle chance et à quels niveaux — et ce")
    w("        que tu peux ramasser par terre. Les niveaux sont des recommandations :")
    w("        c'est ton palier qui ouvre une zone, pas le niveau de ton équipe.")
    w("      </p>")
    w("      </div>")
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

    #  ── LA RÉGION SE RESSERRE, LA CARTE GARDE LA LARGEUR ──────────
    #
    #  « Pour la région de Rhode, j'aimerai que ce soit moins large, que
    #  ça ressemble aux autres maquettes. » (5 novembre)
    #
    #  La colonne de cette annexe est en `--large`, donc sans borne :
    #  c'est ce qui laisse respirer la carte et ses soixante cartes
    #  d'espèce. Mais la région est du TEXTE, et une ligne de mille
    #  pixels ne se lit pas d'un trait — les treize autres annexes sont
    #  à 880 pour cette raison exactement.
    #
    #  On borne donc l'onglet, pas la colonne : `--mesure` rend à ce
    #  texte-là la largeur de lecture des autres pages, centrée, et la
    #  carte garde la sienne juste à côté.
    r = region
    w('          <section data-wm-sous-onglet="la-region"'
      ' class="wm-annexe__onglet--mesure">')
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

    for bloc in ev["blocs"]:
        w('            <div class="wm-region__bloc">')
        w(f'              <h4 class="wm-region__nom">{e(bloc["nom"])}</h4>')
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

    note = r["note"]
    w('            <div class="wm-encarts wm-encarts--detachee">')
    w('              <div class="wm-encart wm-encart--paisible">')
    w('                <span class="wm-encart__etiquette">'
      f'{e(note["etiquette"])}</span>')
    w(f'                <p>{e(note["texte"])}</p>')
    w("              </div>")
    w("            </div>")
    w('            <p class="wm-perso__liens">')
    w(f'              <a class="wm-perso__lien" href="{e(note["lien"])}">'
      f'{e(note["mot"])}</a>')
    w("            </p>")
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
    #  ── 1 · les tirages ───────────────────────────────────────────
    w('          <section class="wm-faune__notice">')
    w('            <h3 class="wm-region__section">Comment le serveur tire</h3>')
    w('            <ul class="wm-tirets">')
    w("              <li><b>Tout part du numéro de ton message.</b> Il sert de graine : le")
    w("                même message donne toujours le même résultat, aujourd'hui comme dans")
    w("                trois ans. C'est ce qui permet de refaire un tirage contesté au lieu")
    w("                d'en discuter.</li>")
    w("              <li><b>Deux tirages, dans cet ordre :</b> l'espèce d'abord, selon les")
    w("                pourcentages de la zone ; son niveau ensuite, dans la fourchette de")
    w("                cette espèce-là. Les inverser donnerait un autre résultat pour la")
    w("                même graine, donc l'ordre ne bouge pas.</li>")
    w("              <li><b>Les pourcentages d'une zone font exactement cent.</b> Le serveur")
    w("                refuse de tirer dans une table qui ne tombe pas juste — mieux vaut")
    w("                pas de rencontre qu'une rencontre faussée.</li>")
    w("              <li><b>Rien n'est acquis avant la clôture</b>, et tout l'est d'un coup")
    w("                à la clôture.</li>")
    w("            </ul>")
    w("          </section>")
    w("")

    #  ── 2 · la météo, expliquée pour de vrai ──────────────────────
    w('          <section class="wm-faune__notice">')
    w('            <h2 class="wm-annexe__carte-titre">Le ciel, l\'heure, et ce qu\'ils'
      " changent</h2>")
    w('            <div class="wm-paras">')
    w("              <p><b>Le temps de Rhode se calcule, il ne se décide pas.</b> Chaque")
    w("                jour a sa graine — la date, et rien d'autre — et un seul tirage en")
    w("                sort le temps du jour. Il n'y a donc rien à générer le matin, rien à")
    w("                stocker, et rien qui puisse rater : ton navigateur trouve le même")
    w("                temps que le serveur sans rien lui demander.</p>")
    w("              <p><b>Deux états, un sur quatre.</b> Le jour est <b>calme</b> ou")
    w("                <b>agité</b>, et il l'est pour tout le monde en même temps : il n'y a")
    w("                pas un ciel par joueur ni un ciel par zone. Environ un jour sur")
    w("                quatre est agité.</p>")
    w("              <p><b>Un état global, une expression locale.</b> Un jour agité, chaque")
    w("                zone montre le temps que SA donnée connaît — la pluie dans le marais,")
    w("                le blizzard dans les monts, les cendres sur le volcan — et les zones")
    w("                qui n'en ont pas restent au calme.</p>")
    w("              <p><b>La nuit va de 20 h à 6 h, à ton heure.</b> C'est le fuseau que tu")
    w("                as réglé qui décide, pas celui du serveur : quelqu'un qui joue depuis")
    w("                l'autre bout du monde ne doit pas chasser de nuit à midi.</p>")
    w("            </div>")
    w('            <div class="wm-encarts">')
    w('              <div class="wm-encart wm-encart--paisible">')
    w('                <span class="wm-encart__etiquette">Et aujourd\'hui, concrètement</span>')
    w("                <p>Les dix-sept zones montrent <b>la même faune le jour et la nuit,")
    w("                  et par tous les temps</b>. Le ciel change ce que tu racontes, pas")
    w("                  ce que tu croises. Le jour où une zone aura sa propre table de")
    w("                  météo, elle s'appliquera toute seule et cette page le dira.</p>")
    w("              </div>")
    w('              <div class="wm-encart wm-encart--terre">')
    w('                <span class="wm-encart__etiquette">À retenir</span>')
    w("                <p>Le temps et l'heure ne changent <b>jamais les niveaux</b>, et")
    w("                  jamais tes gains. Au mieux, ils changent qui sort.</p>")
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


PAGES = "https://by-teenspirit.github.io/wild-mystery"
ARTWORK = (
    "https://raw.githubusercontent.com/PokeAPI/sprites/"
    "bfb75391935310368065096fa08c51e8970bc43e/sprites/pokemon/other/official-artwork"
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
                "annexe-06 : le corps ne correspond plus aux données — "
                "lance « python3 outils/annexe-carte.py »"
            )
        print(f"annexe-06 : à jour ({len(ancien)} caractères).")
        return

    PAGE.write_text(neuf, encoding="utf-8")
    print(f"annexe-06 écrite : {len(neuf)} caractères (limite Forumactif : 128 000).")


if __name__ == "__main__":
    main()
