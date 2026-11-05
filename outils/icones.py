#!/usr/bin/env python3
# ════════════════════════════════════════════════════════════════════
#  outils/icones.py — les petits dessins des onglets
#
#  « Rajouter des icônes pour chacune » (5 novembre), sur les quatre
#  évènements de Rhode.
#
#  ── POURQUOI DESSINÉS ICI, ET PAS PRIS AILLEURS ─────────────────────
#
#  Un jeu d'icônes tout fait voudrait dire une police de plus à charger
#  sur une page qui en charge déjà trois, ou un fichier de sprites à
#  héberger. Quatre dessins de vingt lignes tiennent dans le HTML, ne
#  coûtent aucune requête, et prennent la couleur du texte — donc ils
#  suivent le thème clair et le thème sombre sans qu'on s'en occupe.
#
#  Et ils sont de nous : pas de licence à lire, rien qui ressemble à
#  une marque.
#
#  ── LA FORME EST CELLE DE `outils/accueil.py` ───────────────────────
#
#  `viewBox="0 0 24 24"`, `aria-hidden="true"`, `focusable="false"`,
#  le trait en `currentColor`. C'était déjà la convention de l'œil de
#  l'accueil ; on ne va pas en inventer une seconde.
#
#  ── ELLES VIVENT DANS LE TITRE, PAS DANS LE BOUTON ──────────────────
#
#  Le générateur les pose dans le `<h4>` de l'évènement, et
#  `module-annexes.ts` en copie une dans l'onglet qu'il construit. Sans
#  JavaScript il n'y a pas d'onglet, mais il y a toujours le titre, et
#  l'icône est dessus. L'inverse — dessiner dans le module — ferait
#  disparaître les icônes pour qui n'a pas de script.
# ════════════════════════════════════════════════════════════════════

#  LE TRAIT EST ARRONDI PARTOUT : `stroke-linecap` et `stroke-linejoin`
#  à `round`. C'est ce qui fait que quatre dessins de mains différentes
#  ont l'air d'une même famille — plus que le sujet, plus que la taille.
_ENVELOPPE = (
    '<svg class="wm-onglet__icone" viewBox="0 0 24 24" aria-hidden="true" '
    'focusable="false" fill="none" stroke="currentColor" stroke-width="1.6" '
    'stroke-linecap="round" stroke-linejoin="round">{dedans}</svg>'
)

DESSINS = {
    #  ── LE DRAPEAU À DAMIER DES COURSES ──────────────────────────
    #
    #  Une hampe, un drapeau qui flotte, et quatre carreaux pleins qui
    #  suggèrent le damier sans le dessiner : seize carrés de 1,5 px
    #  dans 24 px feraient une tache grise à la taille d'un onglet.
    "drapeau": (
        '<path d="M5 3v18" />'
        '<path d="M5 4.5c3.5-2 6.5 2 10 0v8c-3.5 2-6.5-2-10 0z" />'
        '<path d="M5 4.5c1.7-1 3.3-.4 5 .4v4c-1.7-.8-3.3-1.4-5-.4z" '
        'fill="currentColor" stroke="none" />'
        '<path d="M10 8.9c1.7.8 3.3 1.4 5-.4v4c-1.7 1.8-3.3 1.2-5 .4z" '
        'fill="currentColor" stroke="none" />'
    ),
    #  ── LE SOLEIL DU FESTIVAL ────────────────────────────────────
    #
    #  Huit rayons et pas douze : à 16 px de haut, douze rayons se
    #  touchent et le disque a l'air entouré d'un halo sale.
    "soleil": (
        '<circle cx="12" cy="12" r="4.2" />'
        '<path d="M12 2.4v2.4M12 19.2v2.4M4.2 12H1.8M22.2 12h-2.4" />'
        '<path d="M6.5 6.5 4.8 4.8M19.2 19.2l-1.7-1.7M17.5 6.5l1.7-1.7'
        'M4.8 19.2l1.7-1.7" />'
    ),
    #  ── LA LUNE DU CLAN DE LA NUIT ───────────────────────────────
    #
    #  Un croissant et DEUX étoiles, parce qu'un croissant seul se
    #  confond avec le bouton de thème sombre de la barre du haut.
    "lune": (
        '<path d="M20 14.2A8.2 8.2 0 1 1 10.6 4a6.6 6.6 0 0 0 9.4 10.2z" />'
        '<path d="M17.4 3.2v2.6M18.7 4.5h-2.6" />'
        '<path d="M21 8.4v1.8M21.9 9.3h-1.8" />'
    ),
    #  ── LA MAIN LEVÉE DU PARTI DE SOUTIEN ────────────────────────
    #
    #  Pas un poing — c'est un mouvement pacifiste, et le poing dit
    #  l'inverse. Une main ouverte, paume vers l'avant.
    "main": (
        '<path d="M9 11.5V5.2a1.4 1.4 0 0 1 2.8 0v5.6" />'
        '<path d="M11.8 10.4V4.3a1.4 1.4 0 0 1 2.8 0v6.4" />'
        '<path d="M14.6 10.9V6.1a1.4 1.4 0 0 1 2.8 0v7.6" />'
        '<path d="M9 11.5V9.1a1.4 1.4 0 0 0-2.8 0v5.4c0 3.3 2.4 5.8 5.6 5.8'
        'h1.2c3 0 4.4-2.1 4.4-5.1v-1.5" />'
    ),
}


def icone(nom):
    """Le SVG d'une icône, ou une chaîne vide si le nom est inconnu.

    VIDE PLUTÔT QUE LEVER : une icône manquante ne doit pas empêcher
    une page de s'écrire. Le garde-fou, lui, refuse qu'un évènement
    nomme un dessin qui n'existe pas — c'est là que ça se voit, pas à
    l'exécution.
    """
    dedans = DESSINS.get(nom)
    if dedans is None:
        return ""
    return _ENVELOPPE.format(dedans=dedans)


def noms():
    """Les noms de dessin connus, pour le garde-fou."""
    return sorted(DESSINS)


if __name__ == "__main__":
    for n in noms():
        print(f"{n:<10} {len(icone(n)):>4} caractères")
