#!/usr/bin/env python3
"""Vérifie que la feuille du messenger n'habille que des noms qui existent.

════════════════════════════════════════════════════════════════════════
 POURQUOI CET OUTIL EXISTE

 Le 11 octobre, trois sélecteurs de `css/15-messenger.css` visaient des
 noms que Forumactif Messenger n'écrit nulle part :

   · `.FAM-notification`      — une pastille de messages non lus. Le
                                greffon pose `#FAM-new-msg-notif`, une
                                barre DANS le tiroir, et aucun compteur
                                sur le bouton ;
   · `.FAM-tab.FAM-active-tab` — l'onglet actif est `FAM-tab-active` ;
   · `.FAM-container-content`  — les vrais noms sont `FAM-content` et
                                `FAM-content-block`.

 DU CSS MORT NE PRÉVIENT JAMAIS. Il ne lève pas d'erreur, il ne casse
 rien, et il fait croire que le cas est traité. Les trois ont tenu
 trois jours, et deux d'entre eux ressemblaient à une seconde
 définition d'une règle existante — ce qui est encore plus trompeur.

 L'inventaire des 186 noms est relevé DANS le `fam.js` du fork, pas de
 mémoire, et vit dans `data/fam-noms.json` avec son empreinte.

 ── ET LES DOUBLONS ──────────────────────────────────────────────────

 Le même jour, cinq choses étaient décrites DEUX FOIS dans la feuille,
 avec des valeurs différentes : la bande d'onglets, le titre, le champ
 de saisie, la date d'un message et le bouton plein. À spécificité
 égale la dernière gagne, en silence, et le commentaire de la première
 décrit alors quelque chose qui n'arrive jamais.

 Le pire était le bouton : son fond venait de la seconde règle, sa
 couleur de texte de la première. Au survol, `accent/fort` sur
 `accent/fort` — **rapport 1,0**, le mot disparaissait. Sur « Envoyer »
 de l'édition d'un message.

 D'où le second contrôle : aucun sélecteur ne doit être écrit deux fois
 dans cette feuille.

 Usage :
     python3 outils/messenger-noms.py              # vérifie
     python3 outils/messenger-noms.py --relever F  # refait l'inventaire
                                                   # depuis un fam.js
════════════════════════════════════════════════════════════════════════
"""

import hashlib
import json
import pathlib
import re
import sys

RACINE = pathlib.Path(__file__).resolve().parent.parent
FEUILLE = RACINE / "css" / "15-messenger.css"
INVENTAIRE = RACINE / "data" / "fam-noms.json"

#  Les noms en `FAM-…` tels qu'ils s'écrivent : une classe, un
#  identifiant, ou un morceau de sélecteur composé.
NOM = re.compile(r"FAM-[A-Za-z0-9_]+(?:-[A-Za-z0-9_]+)*")

#  Ce que NOUS ajoutons et qui n'a donc pas à être dans le greffon.
#  Une seule entrée, et elle est à nous : la classe que le module pose
#  sur le bouton. Toute autre exception doit être justifiée ici.
A_NOUS = {"wm-messenger-bulle"}


def sans_commentaires(css: str) -> str:
    return re.sub(r"/\*.*?\*/", " ", css, flags=re.S)


def noms_de_la_feuille(css: str) -> set[str]:
    return set(NOM.findall(sans_commentaires(css)))


def selecteurs(css: str) -> list[tuple[str, str]]:
    """Les groupes de sélecteurs, un par règle, avec LEUR CONTEXTE.

    ── POURQUOI LE CONTEXTE, ET PAS LE SÉLECTEUR SEUL ─────────────────

    La première version comptait les sélecteurs à plat. Elle a aussitôt
    grondé sur `#modernbb #FAM`, écrit deux fois : une fois en règle
    pleine, une fois dans `@media (max-width: 760px)` pour la version
    étroite. **C'est une surcharge, pas un doublon** — et c'est même la
    façon dont ce dossier range ses media queries, dans la feuille
    qu'elles corrigent plutôt que dans un fichier à part.

    On suit donc les accolades pour savoir dans quel bloc on est. Deux
    règles ne sont le même doublon que si elles portent le même
    sélecteur DANS le même contexte.
    """
    texte = sans_commentaires(css)
    pile: list[str | None] = []
    trouves: list[tuple[str, str]] = []
    tampon = ""
    for c in texte:
        if c == "{":
            tete = " ".join(tampon.split())
            tampon = ""
            if tete.startswith("@"):
                #  Un bloc à règle — `@media`, `@supports`. Il ouvre un
                #  contexte, il ne porte pas de sélecteur.
                pile.append(tete)
            else:
                contexte = " > ".join(x for x in pile if x is not None)
                #  Un groupe `a,\n b` et `a, b` sont le même groupe.
                groupe = ", ".join(p.strip() for p in tete.split(",") if p.strip())
                if groupe != "":
                    trouves.append((contexte, groupe))
                #  Le bloc de déclarations qui suit n'est pas un
                #  contexte : on l'empile quand même pour que son `}` ne
                #  dépile pas le `@media` qui l'entoure.
                pile.append(None)
        elif c == "}":
            if pile:
                pile.pop()
            tampon = ""
        else:
            tampon += c
    return trouves


def verifier() -> int:
    inventaire = json.loads(INVENTAIRE.read_text(encoding="utf8"))
    connus = set(inventaire["noms"])
    css = FEUILLE.read_text(encoding="utf8")

    fautes = 0

    inconnus = sorted(n for n in noms_de_la_feuille(css) if n not in connus)
    if inconnus:
        fautes += 1
        print(f"   ✗ {len(inconnus)} nom(s) habillé(s) qui n'existent pas dans le greffon :")
        for n in inconnus:
            print(f"       {n}")
        print(f"     (inventaire : {len(connus)} noms, relevé le {inventaire['releve_le']})")

    vus: dict[tuple[str, str], int] = {}
    for s in selecteurs(css):
        vus[s] = vus.get(s, 0) + 1
    doubles = sorted(s for s, n in vus.items() if n > 1)
    if doubles:
        fautes += 1
        print(f"   ✗ {len(doubles)} sélecteur(s) écrit(s) deux fois — le second gagne en silence :")
        for contexte, groupe in doubles:
            print(f"       {groupe}" + (f"   [dans {contexte}]" if contexte else ""))

    if fautes == 0:
        print(
            f"   messenger : {len(noms_de_la_feuille(css))} noms habillés, "
            f"tous dans le greffon ({len(connus)} relevés) · aucun doublon"
        )
    return fautes


def relever(chemin: str) -> int:
    """Refait l'inventaire depuis un `fam.js`. À lancer après une mise à
    jour du fork — la liste n'est vraie que pour une version."""
    src = pathlib.Path(chemin).read_bytes()
    noms = sorted(set(NOM.findall(src.decode("utf8", "replace"))))
    doc = json.loads(INVENTAIRE.read_text(encoding="utf8"))
    doc["octets"] = len(src)
    doc["sha256"] = hashlib.sha256(src).hexdigest()
    doc["noms"] = noms
    INVENTAIRE.write_text(
        json.dumps(doc, ensure_ascii=False, indent=2) + "\n", encoding="utf8"
    )
    print(f"   {len(noms)} noms relevés depuis {chemin}")
    print("   PENSER À METTRE À JOUR `version` ET `releve_le` dans data/fam-noms.json")
    return 0


if __name__ == "__main__":
    if len(sys.argv) > 2 and sys.argv[1] == "--relever":
        sys.exit(relever(sys.argv[2]))
    sys.exit(1 if verifier() > 0 else 0)
