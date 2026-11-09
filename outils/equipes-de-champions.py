#!/usr/bin/env python3
"""Les onze équipes d'arène et de colosseum, niveaux et chiffres refaits.

CE QUI SE PASSAIT AVANT
───────────────────────
Le sujet des pré-liens donne onze équipes de six pokémon avec, pour
chacun, un niveau et trois chiffres. Callista, le 6 novembre 2026 :
« aucune des informations affichées n'est bonne concernant le champion
en lui-même, il n'y a que son équipe (il faut revoir le niveau de son
équipe par contre et les stats associées) ».

Donc : on garde les ESPÈCES et leur ORDRE, on jette tout le reste, et
on recalcule.

CE QU'ON NE RECOPIE PAS
───────────────────────
LES NIVEAUX. Ils viennent de `data/arenes.json`, qui tient les onze
niveaux tranchés le 6 novembre. L'équipe se répartit 2-2-2 sous le
niveau du défi : N-2, N-2, N-1, N-1, N, N. Cette forme n'a pas été
choisie — elle a été relevée : dix des onze équipes du sujet l'ont déjà
au chiffre près.

LES TROIS CHIFFRES. Formule de la 3e génération, IV 0, EV 0, nature
neutre, VÉRIFIÉE contre le sujet avant d'être employée : 60 des 65
pokémon nommés reproduisent exactement leurs chiffres affichés. Les
cinq écarts sont listés dans `_ecarts` de `data/equipes-de-champions.json` ;
ce sont des erreurs du sujet, pas de la formule.

    PV    = ⌊2 × base × niveau / 100⌋ + niveau + 10
    AUTRE = ⌊2 × base × niveau / 100⌋ + 5

LE TYPE CONSEILLÉ. Il se déduit de l'ÉQUIPE RÉELLE, pas du type du
défi. Pour chacun des dix-huit types d'attaque on multiplie l'efficacité
contre les types de chaque membre, on moyenne sur les six, on garde les
meilleurs. L'arène Vol aligne un Aéroptéryx Roche/Vol et un Altaria
Dragon/Vol : « Électrik, super efficace contre Vol » serait un conseil
qui se trompe sur un tiers de l'équipe.

LA SOURCE EST UN DOSSIER DE CSV, PAS LE RÉSEAU
───────────────────────────────────────────────
Même contrainte que `outils/especes-sql.py` et `outils/hors-nature.py` :
`pokeapi.co` est injoignable depuis le bac à sable et depuis le Mac, et
les CSV du dépôt PokéAPI pèsent 690 Ko qu'on ne verse pas. On les lit
où ils sont posés, on en tire les statistiques de base et la table
d'efficacité, et c'est le JSON qui est versé — avec `base` dedans, pour
que `--verifier` refasse l'arithmétique hors ligne.

    python3 outils/equipes-de-champions.py --depuis ~/Downloads/pokeapi-csv
                                   réécrit `equipes` dans le JSON
    python3 outils/equipes-de-champions.py --verifier
                                   relit le fichier sans réseau (garde-fou)

LA MESURE QUI A VALIDÉ LA FORMULE NE SE REFAIT PAS D'ICI, et on ne la
déguise pas en commande : les niveaux et les chiffres du sujet ne sont
pas dans ce dépôt — ils sont périmés, les verser serait les offrir à
qui les recopierait. Elle se refait en relisant t1002, et les cinq
écarts qu'elle a trouvés sont notés au chiffre près dans `_ecarts` de
`data/equipes-de-champions.json`.
"""

import json
import csv
import pathlib
import sys
import unicodedata

RACINE = pathlib.Path(__file__).resolve().parent.parent
FICHIER = RACINE / "data" / "equipes-de-champions.json"
ARENES = RACINE / "data" / "arenes.json"
#  LES NOMS FONT FOI ICI AUSSI. `data/especes.json` est dérivé des
#  tables de faune et le garde-fou n° 9 le vérifie : c'est lui qui dit
#  quelles espèces existent dans Rhode et comment elles s'écrivent — y
#  compris « Feunard d'Alola », que PokéAPI ne connaît pas sous ce nom.
INDEX = RACINE / "data" / "especes.json"
FICHES = RACINE / "data" / "especes-fiches.json"

FRANCAIS = 5
STATS = {"1": "pv", "2": "att", "3": "def"}
#  Six membres par équipe, et la forme de l'étagement sous le niveau du
#  défi : deux au niveau N-2, deux à N-1, deux à N. Relevée, pas choisie.
ETAGEMENT = (-2, -2, -1, -1, 0, 0)


class Manquant(Exception):
    """Une espèce d'équipe qu'aucune table ne connaît.

    ON LÈVE PLUTÔT QUE DE METTRE UN DÉFAUT. Un pokémon de champion sans
    statistiques de base afficherait des chiffres faux sur la page, et
    personne ne s'en apercevrait — c'est exactement la panne qu'on a
    déjà payée sur la table `espece`."""


def clef(nom: str) -> str:
    """« Électrik » → « electrik ». Même geste que `especes-sql.py`."""
    nom = nom.replace("œ", "oe").replace("Œ", "OE")
    nom = nom.replace("æ", "ae").replace("Æ", "AE")
    plat = unicodedata.normalize("NFD", nom)
    return "".join(c for c in plat if unicodedata.category(c) != "Mn").lower()


def clef_de_nom(nom: str) -> str:
    """La clé de comparaison d'un NOM D'ESPÈCE : sans accent, sans
    espace, sans apostrophe. « Feunard d'Alola » et « feunard dalola »
    doivent se retrouver, parce que la casse et la ponctuation d'un nom
    recopié à la main ne sont pas une donnée."""
    return "".join(c for c in clef(nom) if c.isalnum())


def lire_csv(dossier: pathlib.Path, nom: str) -> list[dict[str, str]]:
    chemin = dossier / nom
    if not chemin.exists():
        raise SystemExit(
            f"{chemin} manque — télécharge les CSV de PokéAPI "
            "(https://github.com/PokeAPI/pokeapi/tree/master/data/v2/csv)"
        )
    with chemin.open(encoding="utf-8", newline="") as f:
        return list(csv.DictReader(f))


def pv_a(base: int, niveau: int) -> int:
    return (2 * base * niveau) // 100 + niveau + 10


def autre_a(base: int, niveau: int) -> int:
    return (2 * base * niveau) // 100 + 5


def chiffres(base: dict[str, int], niveau: int) -> dict[str, int]:
    return {
        "pv": pv_a(base["pv"], niveau),
        "att": autre_a(base["att"], niveau),
        "def": autre_a(base["def"], niveau),
    }


def niveaux_de(niveau_du_defi: int) -> list[int]:
    """Les six niveaux d'une équipe, sous le niveau du défi.

    LE PLUS FORT PORTE LE NIVEAU DU DÉFI — « niveau de l'arène = celui
    du pokémon le plus fort : oui », Callista, le 6 novembre."""
    return [niveau_du_defi + d for d in ETAGEMENT]


# ════════════════════════════════════════════════════════════════════
#  LE TYPE CONSEILLÉ
# ════════════════════════════════════════════════════════════════════


def conseil_contre(
    equipe: list[dict], efficacite: dict[tuple[str, str], float]
) -> dict[str, object]:
    """Les types d'attaque qui marchent le mieux sur CETTE équipe.

    La moyenne, et pas le maximum : un type qui écrase un membre et ne
    fait rien aux cinq autres n'est pas un conseil. On garde tous les
    types à égalité en tête — l'arène Acier en a plusieurs, et n'en
    montrer qu'un serait un choix arbitraire que personne ne pourrait
    refaire."""
    scores: dict[str, float] = {}
    for attaque in sorted({a for a, _ in efficacite}):
        total = 0.0
        for membre in equipe:
            facteur = 1.0
            for t in membre["types"]:
                facteur *= efficacite[(attaque, t)]
            total += facteur
        scores[attaque] = total / len(equipe)
    meilleur = max(scores.values())
    #  L'égalité à un centième près : les facteurs sont des puissances
    #  de deux divisées par six, donc exacts en binaire, mais on ne
    #  compare pas des flottants au bit près par principe.
    tetes = sorted(t for t, s in scores.items() if abs(s - meilleur) < 0.005)
    return {"types": tetes, "facteur": round(meilleur, 3)}


# ════════════════════════════════════════════════════════════════════
#  DÉRIVER
# ════════════════════════════════════════════════════════════════════


def deriver(dossier: pathlib.Path) -> dict[str, object]:
    fichier = json.loads(FICHIER.read_text("utf-8"))
    releve = fichier["releve"]
    arenes = {a["slug"]: a for a in json.loads(ARENES.read_text("utf-8"))["arenes"]}
    index = json.loads(INDEX.read_text("utf-8"))["especes"]
    fiches = json.loads(FICHES.read_text("utf-8"))["fiches"]

    par_nom: dict[str, int] = {}
    for i, nom in index.items():
        par_nom.setdefault(clef_de_nom(nom), int(i))

    bases: dict[int, dict[str, int]] = {}
    for l in lire_csv(dossier, "pokemon_stats.csv"):
        if l["stat_id"] in STATS:
            bases.setdefault(int(l["pokemon_id"]), {})[STATS[l["stat_id"]]] = int(
                l["base_stat"]
            )

    types_fr = {
        l["type_id"]: l["name"]
        for l in lire_csv(dossier, "type_names.csv")
        if l["local_language_id"] == str(FRANCAIS)
    }
    #  Les dix-huit types du jeu, et rien d'autre : `types.csv` porte
    #  aussi « stellaire » et « ??? », qui n'existent pas pour nous.
    joues = {
        l["id"]
        for l in lire_csv(dossier, "types.csv")
        if l["identifier"] not in ("stellar", "unknown") and int(l["id"]) < 10000
    }
    efficacite: dict[tuple[str, str], float] = {}
    for a in joues:
        for d in joues:
            efficacite[(clef(types_fr[a]), clef(types_fr[d]))] = 1.0
    for l in lire_csv(dossier, "type_efficacy.csv"):
        a, d = l["damage_type_id"], l["target_type_id"]
        if a in joues and d in joues:
            efficacite[(clef(types_fr[a]), clef(types_fr[d]))] = (
                int(l["damage_factor"]) / 100
            )

    #  ── LA LIGUE EST UN DÉFI, MAIS PAS UNE ARÈNE ───────────────────
    #
    #  Elle vit dans `arenes.json` sous sa propre clé : pas de badge,
    #  pas de type, pas de case dans la grille de la carte dresseur.
    #  Elle a en revanche un niveau et une équipe, donc elle passe
    #  par ce dérivateur comme les onze autres.
    ligue = json.loads(ARENES.read_text("utf-8")).get("ligue")

    equipes: dict[str, object] = {}
    for slug, bloc in releve.items():
        if slug == "ligue" and ligue is not None:
            defi = ligue
        elif slug in arenes:
            defi = arenes[slug]
        else:
            raise Manquant(
                f"« {slug} » n'est pas un slug de data/arenes.json "
                f"({', '.join(sorted(arenes))})"
            )
        #  ── DES NIVEAUX ÉCRITS, QUAND L'ÉQUIPE A SA FORME ──────────
        #
        #  Les onze arènes suivent l'étagement, qui se déduit du seul
        #  niveau du défi. L'équipe de Michael, elle, est publiée avec
        #  ses propres écarts — 75, 75, 70, 72, 72, 71 — et les aplatir
        #  serait inventer une équipe qu'on a sous les yeux.
        #
        #  Le contrôle qui reste : le plus fort doit être AU niveau du
        #  défi, comme sur les onze autres. Sans lui, une liste écrite
        #  à la main pourrait dire 80 et aligner des pokémon de 60.
        niveaux = bloc.get("niveaux")
        if niveaux is None:
            niveaux = niveaux_de(defi["niveau"])
        elif max(niveaux) != defi["niveau"]:
            raise Manquant(
                f"« {slug} » : le plus fort de l'équipe est au niveau "
                f"{max(niveaux)}, mais le défi est au niveau "
                f"{defi['niveau']} — sur les onze arènes, les deux sont "
                "le même nombre"
            )
        if len(bloc["especes"]) != len(niveaux):
            raise Manquant(
                f"« {slug} » : {len(bloc['especes'])} espèces pour "
                f"{len(niveaux)} niveaux — une équipe fait six pokémon"
            )
        #  UN SEUL ENDROIT QUI MONTE UN POKÉMON. L'équipe du défi et
        #  celles du Conseil 4 passent par ici : deux écritures du même
        #  calcul finiraient par diverger, et c'est un chiffre de
        #  combat qu'on lirait faux.
        def monter(nom: str, niveau: int, ou: str) -> dict[str, object]:
            identifiant = par_nom.get(clef_de_nom(nom))
            if identifiant is None:
                raise Manquant(
                    f"« {nom} » ({ou}) n'est pas dans data/especes.json — "
                    "une espèce d'équipe doit être une espèce de Rhode"
                )
            base = bases.get(identifiant)
            if base is None or len(base) != 3:
                raise Manquant(
                    f"« {nom} » (#{identifiant}) n'a pas ses trois "
                    "statistiques de base dans pokemon_stats.csv"
                )
            fiche = fiches.get(str(identifiant))
            if fiche is None:
                raise Manquant(
                    f"« {nom} » (#{identifiant}) n'a pas de fiche dans "
                    "data/especes-fiches.json — relance outils/especes-sql.py"
                )
            return {
                "id": identifiant,
                "nom": index[str(identifiant)],
                "types": fiche["types"],
                "niveau": niveau,
                "base": base,
                **chiffres(base, niveau),
            }

        membres = [
            monter(nom, niveau, slug)
            for nom, niveau in zip(bloc["especes"], niveaux)
        ]
        #  ── LE CONSEIL 4, QUATRE ÉQUIPES DE PLUS SOUS LA LIGUE ─────
        #
        #  Relevé le 9 novembre sur le deuxième message de t100. Ce
        #  sont quatre dresseurs d'un type chacun, six pokémon chacun,
        #  qu'on affronte AVANT Michael — donc quatre équipes à
        #  dériver exactement comme les douze autres, mais qui
        #  n'appartiennent pas à un défi : elles vivent sous celui de
        #  la Ligue.
        #
        #  ILS N'ONT PAS DE NOM. Le sujet les annonce « Conseil 4 »
        #  avec leur icône de type, et rien d'autre. On n'en invente
        #  pas : le type EST leur nom ici.
        conseil4 = []
        for membre4 in bloc.get("conseil4", []):
            if len(membre4["especes"]) != len(membre4["niveaux"]):
                raise Manquant(
                    f"conseil4 {membre4['type']} : "
                    f"{len(membre4['especes'])} espèces pour "
                    f"{len(membre4['niveaux'])} niveaux"
                )
            #  LE CONSEIL RESTE SOUS LE CHAMPION. Un membre du Conseil
            #  au niveau du défi, ou au-dessus, voudrait dire qu'on
            #  peut perdre contre lui ce qu'on vient gagner contre
            #  Michael — l'échelle de la Ligue se lit de bas en haut.
            if max(membre4["niveaux"]) >= defi["niveau"]:
                raise Manquant(
                    f"conseil4 {membre4['type']} : son plus fort est au "
                    f"niveau {max(membre4['niveaux'])}, au niveau du défi "
                    f"({defi['niveau']}) ou au-dessus — le Conseil 4 passe "
                    "avant le champion"
                )
            conseil4.append({
                "type": membre4["type"],
                "membres": [
                    monter(nom, niveau, f"conseil4 {membre4['type']}")
                    for nom, niveau in zip(membre4["especes"], membre4["niveaux"])
                ],
            })

        #  ── LES DEUX LISTES DE LA TABLE DES TYPES ──────────────────
        #
        #  Demandées le 9 novembre : « un petit cadre pour afficher le
        #  type super efficace contre le feu, et un autre petit cadre
        #  en face pour les types qui ne sont pas efficaces ».
        #
        #  ELLES PORTENT SUR LE TYPE DU DÉFI, pas sur son équipe. Le
        #  « type conseillé » juste au-dessus est une moyenne sur les
        #  six membres, qui peuvent être doubles ; ces deux-ci sont la
        #  table des types, nue, telle qu'un joueur la connaît.
        #
        #  SEUIL À 2 ET À 0,5 : ce sont les deux seules valeurs que la
        #  table produit en simple type, avec 1 et 0. Les immunités
        #  tombent donc dans « peu efficaces », ce qui est vrai et plus
        #  court à dire que « inefficaces ou immunisés ».
        contre = defi.get("type")
        table = {}
        if contre is not None:
            fort = sorted(a for a in {x for x, _ in efficacite}
                          if efficacite.get((a, contre), 1.0) >= 2)
            faible = sorted(a for a in {x for x, _ in efficacite}
                            if efficacite.get((a, contre), 1.0) <= 0.5)
            table = {"superEfficaces": fort, "peuEfficaces": faible}

        equipes[slug] = {
            "message": bloc["message"],
            "niveau": defi["niveau"],
            "conseil": conseil_contre(membres, efficacite),
            **({"table": table} if table else {}),
            **({"conseil4": conseil4} if conseil4 else {}),
            "membres": membres,
        }
    fichier["equipes"] = equipes
    return fichier


# ════════════════════════════════════════════════════════════════════
#  VÉRIFIER, SANS RÉSEAU
# ════════════════════════════════════════════════════════════════════


def verifier() -> list[str]:
    fichier = json.loads(FICHIER.read_text("utf-8"))
    releve, equipes = fichier["releve"], fichier["equipes"]
    arenes = {a["slug"]: a for a in json.loads(ARENES.read_text("utf-8"))["arenes"]}
    index = json.loads(INDEX.read_text("utf-8"))["especes"]
    fiches = json.loads(FICHES.read_text("utf-8"))["fiches"]
    maux: list[str] = []

    if set(releve) != set(equipes):
        maux.append(
            "`releve` et `equipes` ne couvrent pas les mêmes défis — "
            "relance outils/equipes-de-champions.py --depuis"
        )
        return maux
    #  ── LA LIGUE EST UN DOUZIÈME DÉFI, ET PAS UNE ARÈNE ────────────
    #
    #  Elle vit sous sa propre clé dans `arenes.json` — ni badge, ni
    #  type, ni case dans la grille de la carte dresseur — mais elle a
    #  un niveau et, depuis le 9 novembre, une équipe. Elle doit donc
    #  être couverte par le relevé comme les onze autres.
    attendus = set(arenes)
    if json.loads(ARENES.read_text("utf-8")).get("ligue") is not None:
        attendus.add("ligue")
    if set(releve) != attendus:
        manque = sorted(attendus - set(releve))
        trop = sorted(set(releve) - attendus)
        maux.append(
            "`releve` ne couvre pas les douze défis de data/arenes.json"
            + (f" — manque : {', '.join(manque)}" if manque else "")
            + (f" — en trop : {', '.join(trop)}" if trop else "")
        )

    messages: dict[int, str] = {}
    for slug, eq in sorted(equipes.items()):
        defi = arenes.get(slug)
        if defi is None:
            continue
        if eq["niveau"] != defi["niveau"]:
            maux.append(
                f"{slug} : niveau {eq['niveau']} dans les équipes, "
                f"{defi['niveau']} dans data/arenes.json"
            )
        #  UN MESSAGE PAR DÉFI, ET PAS DEUX DÉFIS SUR LE MÊME MESSAGE.
        #  Le numéro est l'ancre du pré-lien : deux défis qui pointent
        #  au même endroit, c'est une adresse recopiée de travers, et
        #  Forumactif ne tombe jamais en 404 sur une ancre fausse.
        jumeau = messages.get(eq["message"])
        if jumeau:
            maux.append(
                f"{slug} et {jumeau} pointent le même message "
                f"#{eq['message']} de t1002"
            )
        messages[eq["message"]] = slug
        if eq["message"] != releve[slug]["message"]:
            maux.append(f"{slug} : le message dérivé ne suit plus `releve`")

        attendus = niveaux_de(defi["niveau"])
        membres = eq["membres"]
        if len(membres) != len(attendus):
            maux.append(f"{slug} : {len(membres)} membres pour six niveaux")
            continue
        if [m["niveau"] for m in membres] != attendus:
            maux.append(
                f"{slug} : les niveaux {[m['niveau'] for m in membres]} ne "
                f"suivent pas l'étagement 2-2-2 sous {defi['niveau']} "
                f"({attendus})"
            )
        noms_releves = [clef_de_nom(n) for n in releve[slug]["especes"]]
        if [clef_de_nom(m["nom"]) for m in membres] != noms_releves:
            maux.append(f"{slug} : les membres ne suivent plus l'ordre de `releve`")

        for m in membres:
            cle = str(m["id"])
            if index.get(cle) != m["nom"]:
                maux.append(
                    f"{slug} / {m['nom']} : #{m['id']} s'appelle "
                    f"« {index.get(cle)} » dans data/especes.json"
                )
            fiche = fiches.get(cle)
            if fiche is None:
                maux.append(f"{slug} / {m['nom']} : pas de fiche #{m['id']}")
            elif fiche["types"] != m["types"]:
                maux.append(
                    f"{slug} / {m['nom']} : types {m['types']} ici, "
                    f"{fiche['types']} dans data/especes-fiches.json"
                )
            attendu = chiffres(m["base"], m["niveau"])
            rendu = {k: m[k] for k in ("pv", "att", "def")}
            if rendu != attendu:
                maux.append(
                    f"{slug} / {m['nom']} niv. {m['niveau']} : {rendu} "
                    f"écrit, {attendu} par la formule"
                )
        #  LE CONSEIL EST UN TYPE DU JEU, et il est dans les classes CSS.
        for t in eq["conseil"]["types"]:
            if t not in NOMS_DE_TYPE:
                maux.append(f"{slug} : « {t} » n'est pas un des dix-huit types")
    return maux


#  Les dix-huit clés, celles de `css/13-composants.css`. Importées
#  plutôt que recopiées — la règle 31 du garde-fou relit cet import.
sys.path.insert(0, str(RACINE / "outils"))
from annexes import NOMS_DE_TYPE  # noqa: E402


def main() -> int:
    args = sys.argv[1:]
    if args[:1] == ["--verifier"]:
        maux = verifier()
        for m in maux:
            print(f"équipes de champions : {m}")
        if not maux:
            n = len(json.loads(FICHIER.read_text("utf-8"))["equipes"])
            print(f"équipes de champions : {n} défis, rien à signaler.")
        return 1 if maux else 0
    if args[:1] == ["--depuis"] and len(args) == 2:
        fichier = deriver(pathlib.Path(args[1]).expanduser())
        FICHIER.write_text(
            json.dumps(fichier, ensure_ascii=False, indent=2) + "\n", "utf-8"
        )
        eqs = fichier["equipes"]
        for slug, eq in sorted(eqs.items(), key=lambda kv: kv[1]["niveau"]):
            print(
                f"  {slug:<10} niv. {eq['niveau']:<3} "
                f"{'-'.join(str(m['niveau']) for m in eq['membres'])}  "
                f"conseil : {', '.join(eq['conseil']['types'])} "
                f"(×{eq['conseil']['facteur']})"
            )
        print(f"data/equipes-de-champions.json écrit : {len(eqs)} défis.")
        return 0
    print(__doc__)
    return 2


if __name__ == "__main__":
    raise SystemExit(main())
