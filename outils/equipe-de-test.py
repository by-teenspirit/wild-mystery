#!/usr/bin/env python3
# ════════════════════════════════════════════════════════════════════
#  outils/equipe-de-test.py — une équipe au hasard pour le compte de test
#
#  Lancement :  python3 outils/equipe-de-test.py
#               python3 outils/equipe-de-test.py --graine 7
#               python3 outils/equipe-de-test.py --zone 100
#
#  ── POURQUOI CET OUTIL EXISTE ──────────────────────────────────────
#
#  « Pour tester ça, donne des pokémons aléatoires au compte de test »,
#  30 octobre. L'infobulle ne se juge pas sur une case vide : il faut
#  des noms de longueurs différentes, des mono-types et des doubles, un
#  obscur parmi les purs, et des niveaux qui ne se ressemblent pas.
#
#  Les tirer à la main donnerait toujours les mêmes, et surtout des
#  espèces qui n'existent peut-être pas dans Rhode. On tire donc dans
#  les VRAIES tables de rencontre — `data/faune/*.json` —, avec les
#  niveaux que la zone donne réellement.
#
#  ── CE QU'IL N'INVENTE PAS ─────────────────────────────────────────
#
#  Les attaques. Il n'y a aucune table de capacités dans le dépôt, et
#  en fabriquer une ici mettrait des noms faux dans une carte que
#  Callista va coller sur le forum. L'infobulle sort donc sans son bloc
#  « ATTAQUES », ce que le composant prévoit : tout y est facultatif.
#
#  Le bonheur et la purification sont tirés eux aussi — ce sont des
#  valeurs de jeu, pas des faits du dépôt, et la carte produite est une
#  carte de TEST. Le fichier le dit en en-tête, en toutes lettres.
# ════════════════════════════════════════════════════════════════════

import argparse
import json
import pathlib
import random
import unicodedata

R = pathlib.Path(__file__).resolve().parent.parent

#  La même adresse que `outils/sprites.py` et `data/sprites-couverture.json`,
#  lue et pas recopiée : un commit épinglé à deux endroits est un commit
#  qui finira par différer.
COUVERTURE = json.loads((R / "data/sprites-couverture.json").read_text())
STYLE_DU_FORUM = "versions/generation-vii/ultra-sun-ultra-moon"

FICHES = json.loads((R / "data/especes-fiches.json").read_text())["fiches"]


def sans_accent(s: str) -> str:
    """La clé CSS d'un type : minuscules, sans accent. `wm-type--tenebres`."""
    return "".join(
        c for c in unicodedata.normalize("NFD", s.lower())
        if unicodedata.category(c) != "Mn"
    )


def en_titre(cle: str) -> str:
    """Le nom affiché d'un type, à partir de sa clé de fiche."""
    NOMS = {
        "normal": "Normal", "combat": "Combat", "vol": "Vol", "poison": "Poison",
        "sol": "Sol", "roche": "Roche", "insecte": "Insecte", "spectre": "Spectre",
        "acier": "Acier", "feu": "Feu", "eau": "Eau", "plante": "Plante",
        "electrik": "Électrik", "psy": "Psy", "glace": "Glace", "dragon": "Dragon",
        "tenebres": "Ténèbres", "fee": "Fée",
    }
    return NOMS.get(sans_accent(cle), cle.capitalize())


def rencontres(zone: int | None, de: random.Random) -> tuple[str, list[dict]]:
    """Les espèces rencontrables d'une zone, avec leurs niveaux réels."""
    tables = sorted((R / "data/faune").glob("*.json"))
    if zone is not None:
        choisie = R / f"data/faune/{zone}.json"
        if not choisie.exists():
            raise SystemExit(f"Pas de table pour la zone {zone}.")
    else:
        choisie = de.choice(tables)
    d = json.loads(choisie.read_text())
    lignes = d["conditions"]["jour"]
    return d["zone"], lignes


def une_bete(ligne: dict, de: random.Random) -> dict:
    """Une rencontre tirée, complétée par sa fiche d'espèce."""
    ident = str(ligne["espece"])
    fiche = FICHES.get(ident, {})
    niveau = de.randint(ligne["min"], ligne["max"])
    pv_base = fiche.get("pv", 45)
    #  Une formule de PV de jeu, écrite ici et nulle part ailleurs : la
    #  carte produite est une carte de test, pas une source de vérité.
    pv_max = pv_base * 2 * niveau // 100 + niveau + 10
    return {
        "id": ident,
        "nom": ligne["nom"],
        "niveau": niveau,
        "types": [sans_accent(t) for t in fiche.get("types", ["normal"])],
        "pv_max": pv_max,
        #  Entamé une fois sur trois : une jauge toujours pleine ne
        #  montrerait jamais que la jauge fonctionne.
        "pv": pv_max if de.random() > 0.34 else de.randint(pv_max // 4, pv_max - 1),
        "rang": de.randint(1, 5),
    }


def case(b: dict, obscur: bool) -> str:
    """Une case d'équipe, avec son infobulle."""
    sprite = f'{COUVERTURE["base"]}/{STYLE_DU_FORUM}/{b["id"]}.gif'
    types_pastille = "".join(
        f'<li class="wm-infobulle__type" data-wm-type="{t}">{en_titre(t)}</li>'
        for t in b["types"]
    )
    #  La pastille de la case ne porte QUE le premier type : la case
    #  fait moins de cent pixels, et un double type y tiendrait sur
    #  deux lignes. L'infobulle, elle, les montre tous les deux.
    premier = b["types"][0]
    part = round(100 * b["pv"] / b["pv_max"])
    etoiles = "★" * b["rang"] + "☆" * (5 - b["rang"])
    echelle = "Purification" if obscur else "Bonheur"
    return f"""        <li class="wm-tcard__pkmn{" wm-tcard__pkmn--obscur" if obscur else ""}" tabindex="0">
          <img class="wm-tcard__sprite" src="{sprite}" alt="" />
          <p class="wm-tcard__nom">{b["nom"]}</p>
          <p class="wm-tcard__niveau">niv. {b["niveau"]}</p>
          <span class="wm-type wm-type--{premier}" data-wm-type="{premier}">{en_titre(premier)}</span>
          <div class="wm-infobulle{" wm-infobulle--obscur" if obscur else ""}" role="tooltip">
            <div class="wm-infobulle__tete">
              <p class="wm-infobulle__nom">{b["nom"]}</p>
              <span class="wm-infobulle__niveau">Niv. {b["niveau"]}</span>
            </div>
            <ul class="wm-infobulle__types">{types_pastille}</ul>
            <div class="wm-infobulle__pv">
              <span class="wm-infobulle__jauge"><span style="width:{part}%"></span></span>
              <span class="wm-infobulle__chiffre">{b["pv"]} / {b["pv_max"]} PV</span>
            </div>
            <div class="wm-infobulle__rang">
              <span class="wm-infobulle__etoiles">{etoiles}</span>
              <span class="wm-infobulle__echelle">{echelle}</span>
            </div>
          </div>
        </li>"""


def badges(de: random.Random) -> str:
    LES_SEPT = [
        ("arene-station-service", "Station Service"),
        ("arene-samaragd", "Samaragd"),
        ("arene-port-amaree", "Port-Amarée"),
        ("arene-suerebe", "Suerebe"),
        ("arene-pyrite", "Pyrite"),
        ("arene-tour-titanite", "Tour Titanite"),
        ("arene-ile-tenebra", "Île Ténèbra"),
    ]
    combien = de.randint(2, 4)
    lignes = []
    for i, (cle, nom) in enumerate(LES_SEPT):
        obtenu = i < combien
        a_gagner = "" if obtenu else " wm-tcard__badge--agagner"
        #  LA DATE EST TIRÉE, comme le reste des valeurs de test. Rien
        #  dans le dépôt ne sait quand un badge a été gagné : c'est une
        #  récompense Forumactif, et sa date vit dans le panneau.
        date = (
            f'<span class="wm-tcard__bulle-date">Obtenu le '
            f'{de.randint(1, 28)}/{de.randint(1, 10):02}/2026</span>'
            if obtenu else ""
        )
        etat = "Obtenu" if obtenu else "Non obtenu"
        lignes.append(
            f'        <li class="wm-tcard__badge{a_gagner}" '
            f'data-wm-badge="{cle}" tabindex="0">\n'
            f'          <span class="wm-tcard__bulle">\n'
            f'            <span class="wm-tcard__bulle-nom">Badge de l\'Arène {nom}</span>\n'
            f'            <span class="wm-tcard__bulle-etat">{etat}</span>\n'
            f'            {date}\n'
            f'          </span>\n'
            f"        </li>"
        )
    return "\n".join(lignes), combien


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--graine", type=int, default=4, help="pour retirer la même équipe")
    ap.add_argument("--zone", type=int, default=None, help="l'identifiant d'une zone")
    ap.add_argument("--combien", type=int, default=6, help="de 1 à 6")
    #  L'AVATAR N'EST PAS DEVINABLE. Le forum est injoignable depuis
    #  ici — le proxy le bloque —, et une adresse inventée donnerait
    #  une image cassée qui a l'air d'un bug du code. Sans l'option,
    #  on ne met aucun `src` : la case garde le dégradé que
    #  `.wm-dresseur__avatar` lui donne, ce qui a l'air voulu.
    ap.add_argument("--avatar", default=None, help="l'adresse de l'avatar")
    args = ap.parse_args()

    de = random.Random(args.graine)
    nom_zone, lignes = rencontres(args.zone, de)
    tires = de.sample(lignes, min(args.combien, len(lignes)))
    equipe = [une_bete(l, de) for l in tires]

    #  UN OBSCUR PARMI EUX, toujours : c'est la moitié du composant, et
    #  un jeu de test qui ne montre que des purs ne la verrait jamais.
    lequel = de.randrange(len(equipe))
    cases = "\n".join(case(b, obscur=(i == lequel)) for i, b in enumerate(equipe))

    libres = "\n".join(
        """        <li class="wm-tcard__pkmn wm-tcard__pkmn--libre">
          <span class="wm-tcard__sprite"></span>
          <p class="wm-tcard__libre">Place libre</p>
        </li>"""
        for _ in range(6 - len(equipe))
    )

    liste_badges, combien_badges = badges(de)
    argent = de.randrange(120, 4000, 5)
    #  L'espace fine insécable des milliers est posée SUR LE NOMBRE, pas
    #  sur le document : un `.replace(",", …)` appliqué à la sortie
    #  entière avait mangé toutes les virgules des commentaires.
    argent_ecrit = f"{argent:,}".replace(",", "\u202f")
    palier = 1 if combien_badges < 4 else 2

    #  SANS ADRESSE, ON ÉCRIT LES INITIALES plutôt que de laisser un
    #  carré vide. Un carré vide a l'air d'une image cassée — c'est
    #  d'ailleurs ce qui avait été signalé — alors que deux lettres
    #  dans un carré ont l'air voulues, et disent de qui c'est la
    #  carte même quand personne n'a encore fourni d'avatar.
    avatar = (
        f'<img class="wm-dresseur__avatar" src="{args.avatar}" alt="" />'
        if args.avatar
        else '<span class="wm-dresseur__avatar wm-dresseur__avatar--vide">CT</span>'
    )

    sortie = f"""<!-- ══════════════════════════════════════════════════════════════════
     LA CARTE DRESSEUR DU COMPTE DE TEST — tirée au sort

     NE PAS MODIFIER À LA MAIN. Produit par
     `python3 outils/equipe-de-test.py --graine {args.graine}`.
     Pour une autre équipe, relancer avec une autre graine.

     CE SONT DES VALEURS DE TEST. L'équipe vient des vraies tables de
     rencontre — zone « {nom_zone} », niveaux réels de la zone — et les
     types viennent de `data/especes-fiches.json`. Mais les PV, le rang
     de bonheur, l'argent et les badges sont TIRÉS AU SORT : rien dans
     le dépôt ne les connaît encore.

     Les attaques sont absentes, et c'est voulu : il n'existe aucune
     table de capacités ici, et en inventer mettrait des noms faux dans
     une carte collée sur le forum.

     À coller dans un message du Compte de test pour voir l'infobulle
     au survol d'un Pokémon.
     ══════════════════════════════════════════════════════════════════ -->

<div class="wm-tcard" data-wm-tcard>

  <div class="wm-dresseur">
    {avatar}
    <div class="wm-dresseur__infos">
      <p class="wm-dresseur__identite">
        <span class="wm-dresseur__nom">Compte de test</span>
        <span class="wm-dresseur__numero">Dresseur nº 0004</span>
      </p>
    </div>
    <ul class="wm-tcard__compteurs">
      <li class="wm-tcard__compteur">
        <span class="wm-tcard__chiffre" data-wm-tcard-palier>{palier}</span>
        <span class="wm-tcard__libelle">palier</span>
      </li>
      <li class="wm-tcard__compteur">
        <span class="wm-tcard__chiffre" data-wm-tcard-argent>{argent_ecrit}</span>
        <span class="wm-tcard__libelle">pokédollars</span>
      </li>
      <li class="wm-tcard__compteur">
        <span class="wm-tcard__chiffre" data-wm-tcard-compte>{combien_badges} / 7</span>
        <span class="wm-tcard__libelle">badges</span>
      </li>
    </ul>
  </div>

  <div class="wm-tcard__corps">

    <section class="wm-tcard__bloc">
      <h4 class="wm-tcard__titre">Mon équipe</h4>
      <ul class="wm-tcard__equipe" data-wm-tcard-equipe>
{cases}
{libres}
      </ul>
    </section>

    <section class="wm-tcard__bloc">
      <h4 class="wm-tcard__titre">Mes badges</h4>
      <ul class="wm-tcard__badges" data-wm-tcard-badges>
{liste_badges}
      </ul>
    </section>

  </div>
</div>
"""

    chemin = R / "templates/carte-dresseur.compte-de-test.html"
    chemin.write_text(sortie)
    print(f"   {chemin.relative_to(R)} — {len(sortie)} octets")
    print(f"   zone « {nom_zone} », graine {args.graine}")
    for i, b in enumerate(equipe):
        marque = "  (obscur)" if i == lequel else ""
        print(
            f"   · {b['nom']:<16} niv. {b['niveau']:<3} "
            f"{'/'.join(en_titre(t) for t in b['types']):<18} "
            f"{b['pv']}/{b['pv_max']} PV{marque}"
        )
    print(f"   {combien_badges} badges sur 7, palier {palier}, {argent} ₽")


if __name__ == "__main__":
    main()
