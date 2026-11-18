#!/usr/bin/env python3
# ════════════════════════════════════════════════════════════════════
#  outils/annexe-groupes.py — le corps de l'annexe 07, les six natures
#
#  Demandé le 8 novembre 2026 : « pour les groupes, j'aimerai que tu me
#  fasses 6 cards. Tu mets le nom du groupe, tu mets le pokémon du
#  groupe en fond en transparence en bas à droite. Le fond doit être la
#  couleur du groupe. La description en lorem ipsum. Tous les blocs font
#  la même taille, 3 colonnes, 2 lignes. Avec un overflow auto. Et un
#  encadré pour l'avantage d'être dans ce groupe. »
#
#  ── LES COULEURS NE SONT PAS ÉCRITES ICI ────────────────────────────
#
#  Chaque groupe a déjà sa paire de jetons dans le panneau
#  d'administration — `--wm-groupe-<clé>-fond` et `-texte` — et les deux
#  thèmes les redéfinissent. La carte ne fait que les NOMMER par sa
#  classe ; une couleur écrite dans la page serait une septième charte,
#  et elle resterait claire en thème sombre.
#
#  ── LE FILIGRANE EST L'ILLUSTRATION OFFICIELLE ──────────────────────
#
#  Et pas un sprite : `data/sprites-couverture.json` ne connaît aucun
#  légendaire, puisque le Pokédex de Rhode n'en porte pas. L'adresse se
#  bâtit sur le numéro national, relevé dans les CSV de PokéAPI et
#  rangé dans `data/groupes.json`. L'illustration officielle est
#  détournée, en haute définition, et elle supporte d'être agrandie au
#  coin d'une carte — ce qu'un sprite de 68 px ne supporte pas.
# ════════════════════════════════════════════════════════════════════

import html
import json
import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).parent))
from annexes import (  # noqa: E402
    ARTWORK,
    DEBUT,
    DECORS,
    FIN,
    PAGES,
    chemin_de_la_page,
    entre_les_bornes,
    numero_de,
    pied_de_page,
    remplacer_le_corps,
)

R = pathlib.Path(__file__).resolve().parent.parent
SLUG = "groupes"
PAGE = chemin_de_la_page(SLUG)


def e(t):
    return html.escape(str(t), quote=True)


def questionnaire(d):
    #  LES HUIT QUESTIONS SONT ÉCRITES DANS LA PAGE, pas chargées : le
    #  questionnaire marche à la seconde où la page s'affiche, et même
    #  sans JavaScript on peut répondre — il ne manque que le compte.
    #  Les poids voyagent en attributs sur chaque bouton, une seule
    #  source, celle de `data/groupes.json`.
    out = []
    w = out.append
    w('        <div class="wm-annexe__carte" data-wm-questionnaire>')
    w('          <h2 class="wm-annexe__carte-titre">Vers quel groupe penches-tu ?</h2>')
    w('          <p>')
    w("            Neuf situations, quatre réponses. Aucune n'est la bonne : chacune")
    w("            pèse sur deux natures. Tu peux être un peu de chaque — les jauges")
    w("            le disent en pourcentage, et le questionnaire ne décide de rien.")
    w("          </p>")
    w("")
    w('          <form class="wm-sondage">')
    for n, q in enumerate(d["questionnaire"], start=1):
        w(f'            <fieldset class="wm-sondage__question">')
        w(f'              <legend class="wm-sondage__situation">'
          f'<span class="wm-sondage__numero">{n}</span> {e(q["situation"])}</legend>')
        for i, r in enumerate(q["reponses"], start=1):
            idr = f"wm-q{n}-{i}"
            w(f'              <label class="wm-sondage__reponse" for="{idr}">')
            w(f'                <input type="radio" id="{idr}" name="wm-q{n}"'
              f' value="{i}" data-wm-premier="{e(r["premier"])}"'
              f' data-wm-second="{e(r["second"])}" />')
            w(f'                <span>{e(r["dit"])}</span>')
            w("              </label>")
        w("            </fieldset>")
    w("          </form>")
    w("")
    #  LES JAUGES PORTENT LE NOM DU GROUPE EN ATTRIBUT : la phrase du
    #  résultat le lit là, au lieu d'une seconde liste de noms dans le
    #  script qui vieillirait de son côté.
    w('          <div class="wm-sondage__resultat">')
    w('            <p class="wm-sondage__verdict" data-wm-resultat'
      ' role="status">Encore 9 questions.</p>')
    w('            <ul class="wm-sondage__jauges">')
    for g in d["groupes"]:
        cle = e(g["cle"])
        w(f'              <li class="wm-sonde wm-groupe--{cle}" data-wm-jauge="{cle}"'
          f' data-wm-nom="{e(g["nom"])}">')
        w(f'                <span class="wm-sonde__nom">{e(g["nom"])}</span>')
        w('                <span class="wm-sonde__piste">'
          '<span class="wm-sonde__barre" style="width: 0%"></span></span>')
        w('                <span class="wm-sonde__part">0 %</span>')
        w("              </li>")
    w("            </ul>")
    w('            <button type="button" class="wm-sondage__bouton"'
      " data-wm-recommencer>Tout effacer et recommencer</button>")
    w("          </div>")
    w("        </div>")
    return "\n".join(out)


def corps():
    d = json.loads((R / "data/groupes.json").read_text(encoding="utf-8"))
    out = []
    w = out.append

    w(f"{DEBUT} — écrit par `outils/annexe-groupes.py` ▼▼▼ -->")
    photo, espece, _lieu = DECORS[SLUG]
    w(f"""<div class="wm-annexe" style="--annexe-fond: """
      f"""url('{PAGES}/assets/zones/{photo}.jpg'); """
      f"""--annexe-rendu: url('{ARTWORK}/{espece}.png')">""")
    w("")
    w('  <nav class="wm-annexe__sommaire" data-wm-sommaire aria-label="Les annexes"></nav>')
    w("")
    w('  <div class="wm-annexe__corps">')
    w('    <div class="wm-annexe__colonne">')
    w("")
    w(f'      <p class="wm-annexe__surtitre">Annexe {numero_de(SLUG)}</p>')
    w('      <h1 class="wm-annexe__titre">Les <em>groupes</em></h1>')
    w('      <p class="wm-annexe__chapo">')
    w("        Six natures, six façons de jouer. Celle que tu choisis ne dit")
    w("        ni ton métier ni ton camp : elle dit ce que tu fais quand il")
    w("        faut choisir.")
    w("      </p>")
    w("")
    w('      <div class="wm-annexe__blocs">')
    w("")
    w('        <div class="wm-annexe__carte">')
    #  TROIS COLONNES, DEUX LIGNES, et les six cases de la même taille.
    #  C'est une grille et pas du flexbox : six cartes en flex ne font
    #  pas deux lignes de trois, elles font ce que leur contenu décide.
    #  La consigne « zéro tableau, que du flexbox » (planche 49) vise
    #  les `<table>` de mise en page de ModernBB, pas `display: grid`.
    w('          <ul class="wm-groupes">')
    for g in d["groupes"]:
        cle = e(g["cle"])
        w(f'            <li class="wm-groupe wm-groupe--{cle}">')
        #  LE FILIGRANE EST POSÉ EN `img`, PAS EN FOND CSS. Une image de
        #  décor reste une image : en fond, elle ne se charge pas en
        #  différé, et une carte qui ne la charge jamais la télécharge
        #  quand même.
        w(f'              <img class="wm-groupe__embleme" alt="" loading="lazy"'
          f' src="{ARTWORK}/{g["emblemeId"]}.png" />')
        w('              <div class="wm-groupe__texte">')
        w(f'                <h3 class="wm-groupe__nom">{e(g["nom"])}</h3>')
        #  LE NOM ANGLAIS N'EST ÉCRIT QUE S'IL DIFFÈRE : un seul des six
        #  change (Créhelf · Uxie), et « Keldeo · Keldeo » ferait douter
        #  du reste de la page. Vérifié sur les CSV de PokéAPI.
        if g.get("especeEn"):
            w(f'                <p class="wm-groupe__espece">{e(g["espece"])} '
              f'· <span lang="en">{e(g["especeEn"])}</span></p>')
        else:
            w(f'                <p class="wm-groupe__espece">{e(g["espece"])}</p>')
        w(f'                <p class="wm-groupe__dit">{e(g["description"])}</p>')
        w(f'                <p class="wm-groupe__question">{e(g["question"])}</p>')
        #  La description dit la légende, ces quatre lignes disent le
        #  caractère. Un `dl` en flexbox : des couples étiquette-valeur,
        #  pas un tableau de mise en page.
        w('                <dl class="wm-groupe__traits">')
        for mot, clef in (
            ("Ses qualités", "qualites"),
            ("Ses défauts", "defauts"),
            ("Ce qu'il fait d'abord", "dAbord"),
            ("Ce qu'il ne supporte pas", "insupportable"),
        ):
            w(f'                  <dt class="wm-groupe__mot">{e(mot)}</dt>')
            w(f'                  <dd>{e(g[clef])}</dd>')
        w('                </dl>')
        w('              </div>')
        #  L'AVANTAGE EST ENCADRÉ ET COLLÉ EN BAS. C'est la seule chose
        #  de la carte qui change quelque chose au jeu ; il ne doit pas
        #  flotter au milieu d'une description qui, elle, n'est que du
        #  décor.
        w('              <div class="wm-groupe__avantage">')
        w('                <span class="wm-groupe__mot">Son avantage</span>')
        w(f'                <p>{e(g["avantage"])}</p>')
        w('              </div>')
        w('            </li>')
    w('          </ul>')
    w('        </div>')
    w("")
    w(questionnaire(d))
    w("")
    w(pied_de_page(SLUG))
    w("")
    w("      </div>")
    w("    </div>")
    w("  </div>")
    w("</div>")
    w(FIN)
    return "\n".join(out)


def main():
    if not PAGE.exists():
        raise SystemExit(f"{PAGE} n'existe pas — lance d'abord « deno task annexes »")
    ancien = PAGE.read_text(encoding="utf-8")
    if entre_les_bornes(ancien) is None:
        raise SystemExit(f"{PAGE.name} n'a pas ses bornes de corps")
    neuf = remplacer_le_corps(ancien, corps())
    if "--verifier" in sys.argv:
        if neuf != ancien:
            raise SystemExit(
                "annexe-07 : le corps ne correspond plus à data/groupes.json — "
                "lance « python3 outils/annexe-groupes.py »"
            )
        print(f"annexe-07 : à jour ({len(ancien)} caractères).")
        return 0
    PAGE.write_text(neuf, encoding="utf-8")
    print(f"annexe-07 écrite : {len(neuf)} caractères "
          "(limite Forumactif : 128 000).")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
