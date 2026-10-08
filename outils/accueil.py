#!/usr/bin/env python3
# ════════════════════════════════════════════════════════════════════
#  outils/accueil.py
#
#  Le bloc de repli de la page d'accueil — celui que Callista colle UNE
#  FOIS dans le message d'accueil du forum, et qu'elle ne recolle plus.
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
#  contexte et les sept liens. C'est la même règle que le sujet de
#  boutique, et c'est pour ça que `--forum` existe là-bas aussi.
#
#  ── POURQUOI IL EST GÉNÉRÉ, ET PAS ÉCRIT À LA MAIN ──────────────────
#
#  Parce qu'il DIT LA MÊME CHOSE que le fichier de données, et que deux
#  textes qui disent la même chose finissent toujours par diverger. Le
#  garde-fou n° 14 vérifie que le bloc collé correspond encore.
#
#  Il ne contient QUE ce qui ne change jamais — le contexte et les sept
#  liens. Les actualités, le staff, les partenaires n'y sont pas : ils
#  changent, et c'est justement ce qu'on ne veut pas recoller.
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
