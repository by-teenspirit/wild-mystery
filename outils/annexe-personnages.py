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
    w('            <p class="wm-perso__liens">')
    w('              <a class="wm-perso__lien" href="'
      f'{e(p["champions"]["lienJouables"])}">Le sujet des personnages'
      " jouables →</a>")
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

    #  ── LES ONZE POSTES, TIRÉS DE `data/arenes.json` ──────────────
    #
    #  Sept arènes et quatre colosseums, dans l'ordre du fichier, qui
    #  est l'ordre imposé des badges. Les recopier ici serait une
    #  seconde liste, et la planche 24 du garde-fou existe précisément
    #  parce que deux listes finissent par diverger.
    for genre, titre, dit in [
        ("arene", "Les sept arènes",
         "Chaque arène a son type, sa ville et son badge. L'ordre est imposé."),
        ("colosseum", "Les quatre colosseums",
         "On y combat en 2 contre 2."),
    ]:
        dedans = [a for a in arenes if a.get("genre") == genre]
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
              f'{e(a["ville"])} · type {e(a["type"])}</span>')
            w("                  </span>")
            #  « POSTE VACANT » TANT QUE PERSONNE N'EST ÉCRIT. Le
            #  fichier ne porte aucun nom de champion aujourd'hui ;
            #  inventer un titulaire serait inventer un personnage.
            w('                  <span class="wm-poste__etat">poste vacant</span>')
            w('                  <span class="wm-poste__fleche" aria-hidden="true">→</span>')
            w("                </a>")
            w("              </li>")
        w("            </ul>")

    #  DE L'AIR AVANT L'ENCART : collé aux colosseums, il avait l'air
    #  d'être la onzième ligne de la liste.
    w('            <div class="wm-encarts wm-encarts--detachee">')
    w('              <div class="wm-encart wm-encart--paisible">')
    w('                <span class="wm-encart__etiquette">Un poste t\'intéresse ?</span>')
    w(f"                <p>{e(ch['contact'])}</p>")
    w("              </div>")
    w("            </div>")
    w('            <p class="wm-perso__liens">')
    w(f'              <a class="wm-perso__lien" href="{e(ch["lien"])}">Le sujet des'
      " champions →</a>")
    w('              <a class="wm-perso__lien" href="/h7-arenes-colosseums-ligues">'
      "L'annexe des arènes, colosseums et Ligue →</a>")
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
