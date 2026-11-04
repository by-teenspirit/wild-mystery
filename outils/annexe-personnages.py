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
#  Aucun avatar. Les « FC » proposés sont de vraies personnes, et on ne
#  va pas chercher leur photo : la carte montre une silhouette tant que
#  `avatar` est vide, et le nom du FC reste écrit comme ce qu'il est —
#  une suggestion.
# ════════════════════════════════════════════════════════════════════

import html
import json
import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).parent))
from annexes import DEBUT, FIN, entre_les_bornes, remplacer_le_corps  # noqa: E402

R = pathlib.Path(__file__).resolve().parent.parent
PAGE = R / "pages" / "annexe-11-celebrites-de-rhode.html"
PAGES = "https://by-teenspirit.github.io/wild-mystery"
ARTWORK = (
    "https://raw.githubusercontent.com/PokeAPI/sprites/"
    "bfb75391935310368065096fa08c51e8970bc43e/sprites/pokemon/other/official-artwork"
)


def e(t):
    """Échappe. Non négociable : l'éditeur de pages HTML de Forumactif
    DÉCODE les entités au collage, et un `<` resté dans un texte de
    personnage emporterait la moitié de la page — vu sur l'annexe 01 le
    1er novembre."""
    return html.escape(str(t), quote=True)


def lire(chemin):
    return json.loads((R / chemin).read_text(encoding="utf-8"))


def fiche(w, f, indent, avec_traits):
    """Une carte de personnage. Deux par rangée, la feuille s'en charge."""
    i = " " * indent
    w(f'{i}<li class="wm-perso">')

    #  L'AVATAR OU SA PLACE. Une carte sans image ne doit pas être plus
    #  courte que sa voisine : la silhouette tient la grille droite.
    if f.get("avatar"):
        w(f'{i}  <img class="wm-perso__avatar" src="{e(f["avatar"])}" alt=""'
          ' loading="lazy" width="96" height="96" />')
    else:
        w(f'{i}  <span class="wm-perso__avatar wm-perso__avatar--vide"'
          ' aria-hidden="true"></span>')

    w(f'{i}  <div class="wm-perso__corps">')
    w(f'{i}    <h3 class="wm-perso__nom">{e(f["nom"])}</h3>')

    etiquettes = [x for x in (f.get("role"), f.get("origine")) if x]
    if f.get("statut"):
        etiquettes.append(f["statut"])
    if etiquettes:
        w(f'{i}    <p class="wm-perso__etiquettes">')
        for x in etiquettes:
            #  LE STATUT PORTE UNE COULEUR, le reste non : « jouable »
            #  et « non jouable » sont la seule information qu'on vient
            #  chercher en diagonale.
            classe = "wm-perso__statut" if x == f.get("statut") else "wm-perso__role"
            cle = x.lower().replace(" ", "-").replace("é", "e")
            w(f'{i}      <span class="{classe}" data-wm-statut="{e(cle)}">{e(x)}</span>')
        w(f"{i}    </p>")

    w(f'{i}    <p class="wm-perso__texte">{e(f["texte"])}</p>')

    if avec_traits and f.get("traits"):
        w(f'{i}    <p class="wm-perso__traits">')
        for t in f["traits"]:
            w(f'{i}      <span class="wm-perso__trait">{e(t)}</span>')
        w(f"{i}    </p>")

    if f.get("fc"):
        w(f'{i}    <p class="wm-perso__fc">Suggestion d\'avatar :'
          f" <b>{e(f['fc'])}</b></p>")

    w(f"{i}  </div>")
    w(f"{i}</li>")


def corps():
    p = lire("data/personnages.json")
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
    w('      <p class="wm-annexe__surtitre">Annexe 11</p>')
    w('      <h1 class="wm-annexe__titre">Célébrités de <em>Rhode</em></h1>')
    w('      <p class="wm-annexe__chapo">')
    w("        Qui on peut jouer, qui tout le monde connaît, et qui tient les")
    w("        onze arènes. Trois listes qui se répondent : une célébrité peut")
    w("        être jouable, un champion peut devenir une célébrité.")
    w("      </p>")
    w("")
    w('      <div class="wm-annexe__blocs">')
    w('        <div class="wm-annexe__carte wm-sous-onglets" data-wm-sous-onglets>')
    w("")

    # ── 1 · les personnages du jeu ──────────────────────────────────
    j = p["jouables"]
    w('          <section data-wm-sous-onglet="personnages-du-jeu">')
    w(f'            <h2 class="wm-annexe__carte-titre">{e(j["titre"])}</h2>')
    w('            <div class="wm-paras">')
    for para in j["intro"]:
        w(f"              <p>{e(para)}</p>")
    w("            </div>")
    w(f'            <h3 class="wm-perso__section">{e(j["colosseum"]["titre"])}</h3>')
    w('            <div class="wm-paras">')
    for para in j["colosseum"]["paragraphes"]:
        w(f"              <p>{e(para)}</p>")
    w("            </div>")
    w('            <ul class="wm-persos">')
    for f in j["fiches"]:
        fiche(w, f, 14, avec_traits=True)
    w("            </ul>")
    w('            <p class="wm-perso__lien">')
    w(f'              <a href="{e(p["champions"]["lienJouables"])}">Le sujet des'
      " personnages jouables →</a>")
    w("            </p>")
    w("          </section>")
    w("")

    # ── 2 · les célébrités ──────────────────────────────────────────
    c = p["celebrites"]
    w('          <section data-wm-sous-onglet="celebrites">')
    w(f'            <h2 class="wm-annexe__carte-titre">{e(c["titre"])}</h2>')
    w('            <div class="wm-paras">')
    for para in c["intro"]:
        w(f"              <p>{e(para)}</p>")
    w("            </div>")
    w('            <ul class="wm-persos">')
    for f in c["fiches"]:
        fiche(w, f, 14, avec_traits=False)
    w("            </ul>")
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

    #  ── LES ONZE POSTES, TIRÉS DE `data/arenes.json` ──────────────
    #
    #  Sept arènes et quatre colosseums, dans l'ordre du fichier, qui
    #  est l'ordre imposé des badges. Les recopier ici serait une
    #  seconde liste, et la planche 24 du garde-fou existe précisément
    #  parce que deux listes finissent par diverger.
    for genre, titre, dit in [
        ("arene", "Les sept arènes",
         "Chaque arène a son type, sa ville, et son badge."),
        ("colosseum", "Les quatre colosseums",
         "On y combat en 2 contre 2."),
    ]:
        dedans = [a for a in arenes if a.get("genre") == genre]
        w(f'            <h3 class="wm-perso__section">{e(titre)}</h3>')
        w(f'            <p class="wm-perso__dit">{e(dit)}</p>')
        w('            <ul class="wm-postes">')
        for a in dedans:
            w('              <li class="wm-poste">')
            w('                <img class="wm-poste__type" src="'
              f'{PAGES}/img/types/{e(a["type"])}.png" alt="" loading="lazy"'
              ' width="24" height="24" />')
            w('                <span class="wm-poste__mots">')
            w(f'                  <b class="wm-poste__nom">{e(a["nom"])}</b>')
            w(f'                  <span class="wm-poste__ville">{e(a["ville"])}</span>')
            w("                </span>")
            #  « POSTE VACANT » TANT QUE PERSONNE N'EST ÉCRIT. Le
            #  fichier ne porte aucun nom de champion aujourd'hui ;
            #  inventer un titulaire serait inventer un personnage.
            w('                <span class="wm-poste__etat">poste vacant</span>')
            w("              </li>")
        w("            </ul>")

    w('            <div class="wm-encarts">')
    w('              <div class="wm-encart wm-encart--paisible">')
    w('                <span class="wm-encart__etiquette">Un poste t\'intéresse ?</span>')
    w(f"                <p>{e(ch['contact'])}</p>")
    w("              </div>")
    w("            </div>")
    w('            <p class="wm-perso__lien">')
    w(f'              <a href="{e(ch["lien"])}">Le sujet des champions →</a>')
    w("            </p>")
    w("          </section>")
    w("")
    w("        </div>")
    w("")

    # ── le pied du gabarit ──────────────────────────────────────────
    w('        <div class="wm-suivante">')
    w('          <a class="wm-suivante__bouton" href="/h12-monnaie-et-missions">')
    w('            <span class="wm-suivante__etiquette">Annexe suivante</span>')
    w("            Monnaie, médailles et missions →")
    w("          </a>")
    w('          <span class="wm-lieu">')
    w("            Le Libra Échoué")
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
                "annexe-11 : le corps ne correspond plus à data/personnages.json "
                "ou à data/arenes.json — lance "
                "« python3 outils/annexe-personnages.py »"
            )
        print(f"annexe-11 : à jour ({len(ancien)} caractères).")
        return

    PAGE.write_text(neuf, encoding="utf-8")
    print(f"annexe-11 écrite : {len(neuf)} caractères (limite Forumactif : 128 000).")


if __name__ == "__main__":
    main()
