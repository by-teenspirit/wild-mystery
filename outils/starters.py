#!/usr/bin/env python3
# ════════════════════════════════════════════════════════════════════
#  data/starters.json — les espèces qu'on peut choisir en premier
#  Pokémon, et leurs talents.
#
#  « Le joueur choisit dans la liste, il peut choisir le talent. […]
#  On peut prendre n'importe quel pokémon, peu importe la région
#  d'origine. Seulement, ce sont des pokémons de stade 1 (donc pas des
#  évolutions), et pas de légendaires. » — 23 novembre.
#
#  ── POURQUOI UN FICHIER DÉRIVÉ, ET PAS UN FILTRE AU CHARGEMENT ──────
#
#  Le formulaire vit sur la page de réponse du forum. Calculer la liste
#  là-bas demanderait `especes-fiches.json` (137 Ko), `especes.json`
#  (23 Ko), `talents.json` (146 Ko) et `hors-nature.json` — trois cents
#  kilo-octets pour un menu déroulant, à chaque ouverture du
#  formulaire.
#
#  Ici, un seul fichier, et il ne porte que ce que le menu affiche.
#
#  C'est la même discipline que `evolutions.py` et `talents.py` : **les
#  règles du jeu vivent dans `data/`**, le navigateur les lit, et
#  personne ne les ré-applique à la lecture.
#
#  ── CE QU'ON ÉCARTE, ET POURQUOI ────────────────────────────────────
#
#  LES ÉVOLUTIONS. `stade > 1`. C'est sa règle, et elle a une
#  conséquence que les joueurs vont relever : **Pikachu, Ronflex et
#  Lucario ne sont pas des starters** — ce sont des évolutions. Leurs
#  formes de base le sont : Pichu, Goinfrex, Riolu.
#
#  LES LÉGENDAIRES, qui n'ont rien à écarter : ils ne sont DÉJÀ PAS
#  dans `especes-fiches.json`. Ce fichier dérive du Pokédex de Rhode,
#  qui laisse volontairement dehors « 94 légendaires et fabuleux, 31
#  Ultra-Chimères et Pokémon Paradoxes » (`39-…`). Vérifié : Mewtwo,
#  Mew, Rayquaza, Arceus, Artikodin, Celebi en sont tous absents.
#
#  LES FOSSILES, et c'est un accroc qu'il a fallu trancher. Onze
#  passent le filtre du stade — Amonita, Kabuto, Ptéra, Ptyranidur… —
#  et ils « ne s'obtiennent QU'AU LABORATOIRE » (`39-…`). Un Pokémon
#  qu'on ressuscite depuis juin 2026 ne peut pas être le compagnon
#  d'enfance d'un personnage. On les écarte.
#
#  ── CE QU'ON GARDE, ET QUI SE DISCUTE ───────────────────────────────
#
#  LES FORMES RÉGIONALES d'Alola, Galar et Hisui. `hors-nature.json`
#  les marque « breche » parce qu'elles n'apparaissent dans aucune zone
#  sauvage de Rhode. Mais « peu importe la région d'origine » est écrit
#  noir sur blanc, et un personnage venu d'ailleurs a très bien pu
#  grandir avec un Goupix d'Alola. Elles restent.
#
#  Si c'est le mauvais choix, une ligne suffit à les retirer.
#
#      python3 outils/starters.py             # écrit data/starters.json
#      python3 outils/starters.py --verifier  # ne l'écrit pas, le compare
# ════════════════════════════════════════════════════════════════════

import json
import sys
from pathlib import Path

RACINE = Path(__file__).resolve().parent.parent
SORTIE = RACINE / "data" / "starters.json"

#  ── CEUX QU'ON ÉCARTE PAR RÈGLE, ET PLUS PAR CHANCE ─────────────────
#
#  « Pas de pokémons fabuleux ou uniques non plus, pas de fossiles. »
#  — 23 novembre.
#
#  Mesuré le même jour : aucun d'eux n'est dans `especes-fiches.json`,
#  parce que ce fichier dérive du Pokédex de Rhode, qui les laisse
#  volontairement dehors. Zéro sur 125 identifiants vérifiés.
#
#  **MAIS ÊTRE ABSENT N'EST PAS ÊTRE INTERDIT.** Le jour où quelqu'un
#  refabrique `especes-fiches.json` depuis une source plus large — et
#  c'est le genre de chose qui arrive quand on ajoute une génération —
#  Mew deviendrait un starter sans que personne l'ait décidé, et sans
#  qu'aucun contrôle ne s'en aperçoive.
#
#  La liste est donc écrite ici, et elle exclut pour de bon. Si elle
#  est déjà vide de travail, tant mieux : c'est une ceinture, pas un
#  correctif.
FABULEUX = {
    151, 251, 385, 386, 489, 490, 491, 492, 493, 494, 647, 648, 649,
    719, 720, 721, 801, 802, 807, 808, 809, 893, 1025,
}
LEGENDAIRES = {
    144, 145, 146, 150, 243, 244, 245, 249, 250, 377, 378, 379, 380, 381,
    382, 383, 384, 480, 481, 482, 483, 484, 485, 486, 487, 488, 638, 639,
    640, 641, 642, 643, 644, 645, 646, 716, 717, 718, 772, 773, 785, 786,
    787, 788, 789, 790, 791, 792, 800, 888, 889, 890, 891, 892, 894, 895,
    896, 897, 898, 905, 1001, 1002, 1003, 1004, 1007, 1008, 1014, 1015,
    1016, 1017, 1024,
}
#  LES UNIQUES : Ultra-Chimères et Pokémon Paradoxes. Le Pokédex de
#  Rhode les nomme ainsi et les écarte pour la même raison — ce ne sont
#  pas des Pokémon qu'on rencontre, et encore moins qu'on élève depuis
#  l'enfance.
UNIQUES = set(range(793, 800)) | {803, 804, 805, 806} | set(range(984, 996)) | {
    1005, 1006, 1009, 1010, 1020, 1021, 1022, 1023,
}

HORS_STARTER = FABULEUX | LEGENDAIRES | UNIQUES


def plat(texte):
    """L'apostrophe courbe et la droite sont le même signe.

    Le piège du 23 novembre, déjà : PokéAPI écrit « Bel'Écaille » avec
    une apostrophe courbe, le catalogue avec une droite, et trois
    objets ont été déclarés absents alors qu'ils existaient.
    """
    return texte.replace("’", "'")


def charger(nom):
    with open(RACINE / "data" / nom, encoding="utf-8") as f:
        return json.load(f)


def noms_des_especes():
    """id → nom, depuis `especes.json`, qui fait foi pour les noms."""
    brut = charger("especes.json")["especes"]
    sortie = {}
    if isinstance(brut, dict):
        for clef, valeur in brut.items():
            sortie[int(clef)] = plat(
                valeur if isinstance(valeur, str) else valeur.get("nom") or valeur.get("nom_fr")
            )
    else:
        for e in brut:
            sortie[int(e["id"])] = plat(e.get("nom") or e.get("nom_fr"))
    return sortie


def sprites_animes():
    """id → l'adresse complète du sprite ANIMÉ, style du forum.

    ── POURQUOI L'ANIMÉ, ET POURQUOI ICI ──────────────────────────

    « Si tu les prends pas animé, évite de prendre l'animé et de le
    figer. » — 23 novembre.

    Mesuré le même jour : PokéAPI ne sert **que** le GIF pour
    Ultra-Soleil/Ultra-Lune (le `.png` du même dossier répond 404 sur
    les cinq espèces vérifiées). Il n'y a donc pas de version fixe à
    prendre : notre PNG figé était fabriqué par nous, faute de mieux.

    La fiche n'en porte qu'UN — là où une carte de combat en met dix
    dans un sujet — et le navigateur du lecteur le réécrivait déjà en
    animé au chargement. On pointe donc l'animé directement, et il n'y
    a plus rien à héberger pour ce sprite-là.

    ── ET POURQUOI DANS CE FICHIER ────────────────────────────────

    L'adresse dépend de la source qui a l'espèce — Ultra-Soleil
    d'abord, Showdown en repli — et seule la couverture le sait. La
    lire dans le navigateur coûterait CENT KILO-OCTETS pour un sprite,
    sur une page qui charge déjà ce fichier-ci. On la recopie donc
    ici, une fois, à la livraison.

    LE DÉPÔT DES SPRITES EST ÉPINGLÉ À UN COMMIT : l'adresse ne bouge
    pas tant que `sprites-couverture.json` ne bouge pas, et le
    garde-fou 40 refait ce fichier dès qu'elle bouge.

    ── LA BASE SORT DU TABLEAU ────────────────────────────────────

    Elle fait 151 caractères et elle est la même pour les 436 : écrite
    à chaque ligne, elle pesait 64 Ko sur un fichier de 199, chargés à
    chaque ouverture de la page de réponse. Elle est donc écrite UNE
    fois, et chaque espèce ne porte que son chemin.
    """
    couverture = charger("sprites-couverture.json")
    base = couverture["base"].rstrip("/")
    especes = couverture["styles"]["forum"]["especes"]
    sortie = {}
    for clef, entree in especes.items():
        chemin = entree.get("source") if isinstance(entree, dict) else None
        if not chemin:
            continue
        #  UN CHEMIN QUI COMMENCE PAR `assets/` EST CHEZ NOUS, et il
        #  n'a rien à faire ici : ce fichier ne sert que les sources
        #  distantes. Aucune n'est dans ce cas pour le style du forum,
        #  mais la règle est celle de `sprites.ts` et on la garde.
        if chemin.startswith("assets/"):
            continue
        sortie[int(clef)] = chemin
    return base, sortie


def main():
    fiches = charger("especes-fiches.json")["fiches"]
    noms = noms_des_especes()
    talents = charger("talents.json")["talents"]
    base_sprites, animes = sprites_animes()
    fossiles = {
        e["id"] for e in charger("hors-nature.json")["especes"] if e["origine"] == "fossile"
    }

    especes = []
    sans_nom = []
    sans_talent = []
    sans_sprite = []
    for clef, fiche in fiches.items():
        ident = int(clef)
        if fiche["stade"] != 1:
            continue
        if ident in fossiles:
            continue
        if ident in HORS_STARTER:
            continue
        nom = noms.get(ident)
        if nom is None:
            #  ON NE DEVINE PAS UN NOM. Une espèce qu'on ne sait pas
            #  nommer ne peut pas entrer dans un menu déroulant, et la
            #  signaler vaut mieux que d'afficher son numéro.
            sans_nom.append(ident)
            continue
        siens = talents.get(clef, [])
        if not siens:
            sans_talent.append(nom)
        sprite = animes.get(ident)
        if sprite is None:
            sans_sprite.append(nom)
        especes.append(
            {
                "id": ident,
                "nom": nom,
                "types": fiche["types"],
                #  L'ADRESSE EST COMPLÈTE, et pas un chemin à recoller :
                #  le navigateur n'a alors rien à savoir d'où vit le
                #  dépôt des sprites.
                **({"sprite": sprite} if sprite else {}),
                #  LE TALENT CACHÉ EST MARQUÉ, pas retiré : « il peut
                #  choisir le talent », et le staff tranchera si un
                #  talent caché demande une justification.
                "talents": [
                    {"nom": plat(t["nom"]), **({"cache": True} if t.get("cache") else {})}
                    for t in siens
                ],
            }
        )

    especes.sort(key=lambda e: (e["nom"].casefold(), e["id"]))

    sortie = {
        "_": (
            "Les espèces qu'on peut choisir comme premier Pokémon, et leurs talents. "
            "DÉRIVÉ par outils/starters.py — ne pas modifier à la main."
        ),
        "_regle": (
            "Stade 1 uniquement (pas d'évolutions). Ni légendaires, ni fabuleux, ni "
            "uniques (Ultra-Chimères et Paradoxes) : ils sont déjà hors du Pokédex de "
            "Rhode, et la liste les exclut en plus par règle. Pas de fossiles non plus, "
            "qui ne sortent que du laboratoire. Les formes régionales sont gardées : "
            "« peu importe la région d'origine »."
        ),
        "_niveau": (
            "Aucun niveau ici, et c'est la règle : le staff l'attribue à la validation, "
            "selon l'âge, le métier et le passé du personnage."
        ),
        "spriteBase": base_sprites,
        "_sprite": (
            "Le sprite ANIMÉ du style du forum : `spriteBase` + le chemin de chaque "
            "espèce, sur le dépôt épinglé. "
            "PokéAPI ne sert que le GIF pour Ultra-Soleil/Ultra-Lune : il n'y a pas "
            "de version fixe à prendre, et la fiche n'en porte qu'un."
        ),
        "source": (
            "data/especes-fiches.json, data/especes.json, data/talents.json, "
            "data/sprites-couverture.json"
        ),
        "compte": {
            "especes": len(especes),
            "sansTalent": len(sans_talent),
            "sansSprite": len(sans_sprite),
            "ecartesParRegle": len(HORS_STARTER) + len(fossiles),
        },
        "especes": especes,
    }

    texte = json.dumps(sortie, ensure_ascii=False, indent=2) + "\n"

    if "--verifier" in sys.argv:
        actuel = SORTIE.read_text(encoding="utf-8") if SORTIE.exists() else ""
        if actuel != texte:
            print("data/starters.json n'est plus d'accord avec ses sources.")
            print("Relancer : python3 outils/starters.py")
            return 1
        print(f"starters.json : {len(especes)} espèces, d'accord avec ses sources.")
        return 0

    SORTIE.write_text(texte, encoding="utf-8")
    print(f"data/starters.json : {len(especes)} espèces jouables.")
    if sans_nom:
        print(f"  {len(sans_nom)} sans nom, écartées : {sans_nom[:8]}")
    if sans_talent:
        print(f"  {len(sans_talent)} sans aucun talent : {sans_talent[:8]}")
    if sans_sprite:
        print(f"  {len(sans_sprite)} sans sprite animé : {sans_sprite[:8]}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
