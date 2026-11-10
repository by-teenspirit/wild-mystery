#!/usr/bin/env python3
# ════════════════════════════════════════════════════════════════════
#  outils/accueil.py
#
#  Le bloc de repli de la page d'accueil — celui que Callista colle dans
#  le message d'accueil du forum.
#
#  ── IL A LONGTEMPS DIT « COLLE UNE FOIS ET NE RECOLLE PLUS » ────────
#
#  C'était faux, et ça a coûté. Le bloc porte le contexte ET les liens
#  rapides ; les liens changent — quatre sont arrivés le 9 novembre,
#  un cinquième le 10. Chaque fois, le bloc du forum prend un tour de
#  retard, et rien ne le dit.
#
#  Le 10 novembre, la page d'accueil du forum portait encore les SEPT
#  ANCIENS liens, pas de bloc des annexes, et la puce en ligature
#  Material Symbols — « visibilityContexte » en clair quand la police
#  ne charge pas, le défaut même que la constante PUCE plus bas a
#  corrigé il y a des semaines.
#
#  La promesse est donc retirée, et remplacée par un registre :
#  `data/a-recoller.json` et `outils/recoller.py` disent quand un
#  collage est dû. Garde-fou n° 34.
#
#  ── POURQUOI IL EXISTE ──────────────────────────────────────────────
#
#  Le module remplace ce bloc par la version complète, lue dans
#  `data/accueil.json`. Mais il faut du JavaScript pour ça, et il y a
#  trois moments où il n'y en a pas :
#
#    · le visiteur l'a coupé ;
#    · le paquet est injoignable — Pages en panne, réseau coupé ;
#    · la page s'affiche avant que le module ait fini.
#
#  Dans les trois cas, ce qui reste à l'écran est ce bloc : le texte du
#  contexte et les liens rapides. C'est la même règle que le sujet de
#  boutique, et c'est pour ça que `--forum` existe là-bas aussi.
#
#  ── POURQUOI IL EST GÉNÉRÉ, ET PAS ÉCRIT À LA MAIN ──────────────────
#
#  Parce qu'il DIT LA MÊME CHOSE que le fichier de données, et que deux
#  textes qui disent la même chose finissent toujours par diverger. Le
#  garde-fou n° 14 compare le FICHIER aux DONNÉES ; le n° 34 dit si le
#  FORUM, lui, est encore à jour.
#
#  Il ne contient que le contexte et les liens rapides. Les actualités,
#  le staff, les partenaires n'y sont pas : ils changent toutes les
#  semaines, et un bloc qui les porterait serait à recoller sans arrêt.
#
#  Usage :
#      python3 outils/accueil.py --forum      le bloc à coller
#      python3 outils/accueil.py --verifier   (garde-fou)
# ════════════════════════════════════════════════════════════════════

import html
import json
import pathlib
import sys

RACINE = pathlib.Path(__file__).resolve().parent.parent
DONNEES = RACINE / "data" / "accueil.json"
REPLI = RACINE / "pages" / "accueil-repli.html"

#  LA PUCE EST UN TRACÉ, PAS UNE LIGATURE. Elle a été
#  `<span class="material-symbols-outlined">visibility</span>`, et le
#  premier rendu de l'accueil affichait le mot en clair sur les sept
#  lignes — la police n'avait pas chargé. Le même dessin est posé par
#  `module-accueil.ts` ; les deux doivent rester d'accord, et le
#  garde-fou n° 14 compare le bloc dérivé à sa source.
PUCE = (
    '<svg class="wm-accueil__oeil" viewBox="0 0 24 24" aria-hidden="true" focusable="false">'
    '<path d="M4 12h14M12.5 6.2 18.6 12l-6.1 5.8" fill="none" stroke="currentColor" '
    'stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"></path>'
    "</svg>"
)


class AccueilIncoherent(Exception):
    """Levée plutôt que d'écrire un bloc dérivé qu'on sait faux."""


def charger() -> dict:
    d = json.loads(DONNEES.read_text(encoding="utf-8"))
    contexte = d.get("contexte")
    if not isinstance(contexte, dict):
        raise AccueilIncoherent("pas de « contexte »")
    if not str(contexte.get("chapo", "")).strip() and not contexte.get("paragraphes"):
        raise AccueilIncoherent("le contexte n'a ni chapô ni paragraphe")
    liens = d.get("liens")
    if not isinstance(liens, list) or len(liens) == 0:
        raise AccueilIncoherent("pas de liens rapides")
    for lien in liens:
        if not isinstance(lien, dict) or not str(lien.get("texte", "")).strip():
            raise AccueilIncoherent(f"un lien rapide sans texte : {lien!r}")
    #  UN BLOC QUI POUSSE À CLIQUER DOIT MENER QUELQUE PART. Sans
    #  adresse, il reste un pavé mort en tête de page — et c'est le
    #  premier bloc qu'on voit.
    dec = d.get("decouvrir")
    if isinstance(dec, dict):
        if not str(dec.get("titre", "")).strip():
            raise AccueilIncoherent("le bloc « découvrir » n'a pas de titre")
        lien = dec.get("lien")
        if not isinstance(lien, dict) or not str(lien.get("url", "")).strip():
            raise AccueilIncoherent(
                "le bloc « découvrir » ne mène nulle part — donne-lui une "
                "adresse dans data/accueil.json"
            )
    return d


def echappe(texte: object) -> str:
    return html.escape(str(texte), quote=True)


def en_forum(d: dict) -> str:
    c = d["contexte"]
    out = [
        "<!--  BLOC DE REPLI DE LA PAGE D'ACCUEIL — DÉRIVÉ DE data/accueil.json.",
        "      Ne pas modifier à la main : régénérer avec",
        "      « python3 outils/accueil.py --forum » et recoller.",
        "",
        "      Le module le REMPLACE par la version complète. Ce qui est ici",
        "      est ce qui reste quand il n'y a pas de JavaScript, et c'est",
        "      la seule raison pour laquelle ce bloc existe.  -->",
        '<div id="wm-accueil" class="wm-accueil">',
    ]

    #  ── LE GROS BLOC, EN TÊTE ───────────────────────────────────────
    #
    #  Il est dans le repli AUSSI, et pas seulement dans le module :
    #  c'est le bloc qui doit faire cliquer, et un visiteur sans
    #  JavaScript est exactement celui qu'on ne veut pas perdre. Il
    #  coûte six lignes de HTML.
    dec = d.get("decouvrir")
    if isinstance(dec, dict) and str(dec.get("titre", "")).strip():
        out.append('  <section class="wm-accueil__decouvrir">')
        if str(dec.get("surtitre", "")).strip():
            out.append('    <p class="wm-accueil__decouvrir-surtitre">'
                       f'{echappe(dec["surtitre"])}</p>')
        out.append('    <h2 class="wm-accueil__decouvrir-titre">'
                   f'{echappe(dec["titre"])}</h2>')
        if str(dec.get("texte", "")).strip():
            out.append('    <p class="wm-accueil__decouvrir-texte">'
                       f'{echappe(dec["texte"])}</p>')
        bouton = dec.get("lien")
        if isinstance(bouton, dict) and str(bouton.get("texte", "")).strip():
            url = str(bouton.get("url", "")).strip()
            mot = echappe(bouton["texte"])
            out.append(
                f'    <a class="wm-accueil__decouvrir-bouton" href="{echappe(url)}">{mot}</a>'
                if url
                else '    <span class="wm-accueil__decouvrir-bouton '
                     f'wm-accueil__decouvrir-bouton--sans-adresse">{mot}</span>'
            )
        #  LE POKÉMON EST DÉCORATIF, et il arrive EN DERNIER : il est
        #  sorti du flux par le CSS, mais sans CSS il se glisserait
        #  sinon entre le texte et son bouton. `alt` vide ET
        #  `aria-hidden` : un lecteur d'écran n'a rien à en dire.
        image = str(dec.get("image", "")).strip()
        if image:
            out.append('    <img class="wm-accueil__decouvrir-image" '
                       f'src="{echappe(image)}" alt="" aria-hidden="true">')
        out.append("  </section>")

    out += [
        '  <section class="wm-accueil__contexte">',
        f'    <h2 class="wm-accueil__titre">{echappe(c.get("titre", "Contexte"))}</h2>',
    ]
    chapo = str(c.get("chapo", "")).strip()
    if chapo:
        out.append(f'    <p class="wm-accueil__chapo">{echappe(chapo)}</p>')
    for p in c.get("paragraphes", []):
        if str(p).strip():
            out.append(f'    <p class="wm-accueil__texte">{echappe(p)}</p>')

    lien = c.get("lien")
    if isinstance(lien, dict) and str(lien.get("texte", "")).strip():
        url = str(lien.get("url", "")).strip()
        texte = echappe(lien["texte"])
        #  SANS ADRESSE, PAS DE BALISE `a`. Un lien vide recharge la page
        #  sans rien dire — c'est la même règle que dans le module, et
        #  elle vaut aussi ici, où personne ne la corrigera au clic.
        dedans = (
            f'<a class="wm-accueil__lien" href="{echappe(url)}">{texte}</a>'
            if url
            else f'<span class="wm-accueil__lien wm-accueil__lien--sans-adresse">{texte}</span>'
        )
        out.append(f'    <p class="wm-accueil__pied">{dedans}</p>')
    out.append("  </section>")

    out += [
        '  <nav class="wm-accueil__liens" aria-label="Accès rapides">',
        '    <ul class="wm-accueil__liste-liens">',
    ]
    for lien in d["liens"]:
        url = str(lien.get("url", "")).strip()
        texte = echappe(lien["texte"])
        oeil = PUCE
        if url:
            dedans = f'<a class="wm-accueil__rapide" href="{echappe(url)}">{oeil}{texte}</a>'
        else:
            dedans = (
                '<span class="wm-accueil__rapide wm-accueil__rapide--sans-adresse" '
                f'title="Adresse à renseigner">{oeil}{texte}</span>'
            )
        out.append(f"      <li>{dedans}</li>")
    out += ["    </ul>", "  </nav>", "</div>"]
    return "\n".join(out) + "\n"


def main() -> int:
    try:
        d = charger()
    except AccueilIncoherent as e:
        print(f"data/accueil.json : {e}", file=sys.stderr)
        return 1

    if "--forum" in sys.argv:
        print(en_forum(d), end="")
    elif "--verifier" in sys.argv:
        if not REPLI.exists():
            print(
                f"{REPLI} manque — lance « python3 outils/accueil.py --forum > {REPLI} »",
                file=sys.stderr,
            )
            return 1
        if REPLI.read_text(encoding="utf-8") != en_forum(d):
            print(
                "pages/accueil-repli.html ne correspond pas à data/accueil.json — "
                "régénère-le, et recolle-le dans le message d'accueil",
                file=sys.stderr,
            )
            return 1
        print(f"   accueil : {len(d['liens'])} liens rapides, bloc de repli à jour")
    else:
        print("voir l'en-tête du fichier", file=sys.stderr)
        return 2
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
