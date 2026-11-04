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
from annexes import DEBUT, FIN, entre_les_bornes, remplacer_le_corps  # noqa: E402

R = pathlib.Path(__file__).resolve().parent.parent
PAGE = R / "pages" / "annexe-06-la-region-et-ses-zones.html"

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
    butin = lire("data/butin.json")
    f = butin["fouille"]
    reste = round(
        100 - f["bredouille"] - f["fossileEntier"] - f["morceauDeFossile"] - f["objet"], 4
    )

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
    w('<div class="wm-annexe" style="--annexe-fond: url(\''
      f'{PAGES}/assets/zones/montagnes-embrumees.jpg\'); '
      f'--annexe-rendu: url(\'{ARTWORK}/249.png\')">')
    w("")
    w('  <nav class="wm-annexe__sommaire" data-wm-sommaire aria-label="Les annexes"></nav>')
    w("")
    w('  <div class="wm-annexe__corps">')
    w('    <div class="wm-annexe__colonne">')
    w("")
    w('      <p class="wm-annexe__surtitre">Annexe 06</p>')
    w('      <h1 class="wm-annexe__titre">La <em>région</em> et ses zones</h1>')
    w('      <p class="wm-annexe__chapo">')
    w(f"        Dix-sept zones sauvages, trois paliers, {total_especes(faunes)} lignes d'espèce.")
    w("        Clique une zone sur la carte : tu verras tout ce qui y vit, avec quelle")
    w("        chance, à quels niveaux, et ce que tu peux ramasser par terre. Les niveaux")
    w("        sont des recommandations — c'est ton palier qui ouvre une zone, pas le")
    w("        niveau de ton équipe.")
    w("      </p>")
    w("")
    w('      <div class="wm-annexe__blocs">')
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

    # ── comment le serveur tire ──────────────────────────────────────
    w('        <div class="wm-annexe__carte">')
    w('          <h2 class="wm-annexe__carte-titre">Comment le serveur tire</h2>')
    w('          <ul class="wm-tirets">')
    w("            <li><b>Tout part du numéro de ton message.</b> Le même message donne")
    w("              toujours le même résultat, aujourd'hui comme dans trois ans. C'est ce")
    w("              qui permet de refaire un tirage contesté au lieu d'en discuter.</li>")
    w("            <li><b>Deux tirages, dans cet ordre :</b> l'espèce d'abord, selon les")
    w("              pourcentages de la zone ; son niveau ensuite, dans la fourchette de")
    w("              cette espèce-là. Les inverser donnerait un autre résultat.</li>")
    w("            <li><b>Les pourcentages d'une zone font exactement cent.</b> Le serveur")
    w("              refuse de tirer dans une table qui ne tombe pas juste.</li>")
    w("            <li><b>Rien n'est acquis avant la clôture</b>, et tout l'est d'un coup")
    w("              à la clôture.</li>")
    w("          </ul>")
    w("        </div>")
    w("")

    # ── le jour, la nuit, le temps ───────────────────────────────────
    w('        <div class="wm-annexe__carte">')
    w('          <h2 class="wm-annexe__carte-titre">Le jour, la nuit, et le temps'
      " qu'il fait</h2>")
    w('          <div class="wm-paras">')
    w("            <p>Le temps de Rhode est tiré <b>une fois par jour, pour tout le")
    w("              monde</b> : calme, ou agité. Un jour sur quatre est agité. Même jour,")
    w("              même temps pour tous — personne n'a son propre ciel.</p>")
    w("            <p>La nuit va de <b>20 h à 6 h</b>, à <b>ton</b> heure : le fuseau que")
    w("              tu as réglé, pas celui du serveur.</p>")
    w("          </div>")
    w('          <div class="wm-encarts">')
    w('            <div class="wm-encart wm-encart--paisible">')
    w('              <span class="wm-encart__etiquette">Aujourd\'hui</span>')
    w("              <p>Les dix-sept zones montrent <b>la même faune le jour et la")
    w("                nuit, et par tous les temps</b>. Le ciel change ce que tu")
    w("                racontes, pas ce que tu croises.</p>")
    w("            </div>")
    w("          </div>")
    w("        </div>")
    w("")

    # ── ce qu'on trouve au sol ───────────────────────────────────────
    w('        <div class="wm-annexe__carte">')
    w('          <h2 class="wm-annexe__carte-titre">Ce qu\'on trouve au sol</h2>')
    w('          <div class="wm-paras">')
    w("            <p>Fouiller donne <b>une</b> chose, jamais deux. Les cinq parts font")
    w("              cent, et elles sont les mêmes dans les dix-sept zones — c'est la")
    w("              liste des objets qui change, pas les chances de tomber dessus.</p>")
    w("          </div>")
    w('          <div class="wm-table">')
    w('            <div class="wm-table__ligne wm-table__ligne--entete">')
    w('              <span class="wm-table__cellule wm-table__cellule--nom">Ce qu\'on'
      " trouve</span>")
    w('              <span class="wm-table__cellule">Ce que ça veut dire</span>')
    w('              <span class="wm-table__cellule wm-table__cellule--chiffre">Chance'
      "</span>")
    w("            </div>")
    for mot, dit, pct in [
        ("Des pokédollars", "Le cas le plus courant. La somme monte avec le palier de la"
         " zone.", reste),
        ("Un objet", "Lequel dépend de la zone : chacune a sa liste.", f["objet"]),
        ("Un morceau de fossile", "Trois morceaux font un fossile entier.",
         f["morceauDeFossile"]),
        ("Rien du tout", "Une fouille qui donne toujours quelque chose est un"
         " distributeur, pas une fouille.", f["bredouille"]),
        ("Un fossile entier", "Le plus rare de Rhode.", f["fossileEntier"]),
    ]:
        w('            <div class="wm-table__ligne">')
        w(f'              <span class="wm-table__cellule wm-table__cellule--nom">{e(mot)}'
          "</span>")
        w(f'              <span class="wm-table__cellule">{e(dit)}</span>')
        w('              <span class="wm-table__cellule wm-table__cellule--chiffre">'
          f'{e(f"{pct:.2f}".replace(".", ","))} %</span>')
        w("            </div>")
    w("          </div>")
    w("        </div>")
    w("")

    # ── le pied, celui du gabarit ────────────────────────────────────
    w('        <div class="wm-suivante">')
    w('          <a class="wm-suivante__bouton" href="/h7-arenes-colosseums-ligues">')
    w('            <span class="wm-suivante__etiquette">Annexe suivante</span>')
    w("            Arènes, colosseums et Ligue →")
    w("          </a>")
    w('          <span class="wm-lieu">')
    w("            Les Montagnes Embrumées")
    w("            <b>une question sans réponse ici ? écris au staff</b>")
    w("          </span>")
    w("        </div>")
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
