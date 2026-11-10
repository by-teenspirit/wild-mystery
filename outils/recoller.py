#!/usr/bin/env python3
# ════════════════════════════════════════════════════════════════════
#  outils/recoller.py
#
#  CE QUI EST COLLÉ À LA MAIN SUR LE FORUM, et ce qui ne l'est plus.
#
#  ── POURQUOI CET OUTIL EXISTE ───────────────────────────────────────
#
#  Le 10 novembre, en ouvrant la page d'accueil du forum pour vérifier
#  un lien, j'ai trouvé un bloc de repli de DEUX GÉNÉRATIONS DE RETARD :
#  les sept anciens liens rapides, pas de bloc des annexes, et la puce
#  encore écrite en ligature Material Symbols — donc « visibilityContexte »
#  en clair quand la police ne charge pas. Ce défaut-là était corrigé
#  dans le générateur depuis des semaines.
#
#  Il n'était pas arrivé sur le forum, et RIEN NE POUVAIT LE DIRE. Le
#  garde-fou n° 14 compare `pages/accueil-repli.html` à
#  `data/accueil.json` : il sait si le FICHIER est à jour, jamais si le
#  FORUM l'est. Entre les deux il y a un copier-coller, et un
#  copier-coller ne laisse aucune trace dans le dépôt.
#
#  Tant que personne ne tenait ce registre, c'est moi qui devais m'en
#  souvenir — et je m'en souvenais à la demande, pas à la semaine. D'où
#  ce fichier : la chaîne porte maintenant ce qu'elle sait, au lieu de
#  compter sur ma mémoire.
#
#  ── CE QU'IL SAIT, ET CE QU'IL NE SAIT PAS ──────────────────────────
#
#  Il ne lit pas le forum : il n'a pas de session, et ce n'est pas son
#  travail. Il compare l'empreinte du fichier d'aujourd'hui à celle
#  qu'on a NOTÉE le jour du collage. Trois états, et le troisième est
#  le plus honnête des trois :
#
#    à jour          le fichier n'a pas bougé depuis le collage noté
#    À RECOLLER      il a changé depuis
#    jamais confirmé personne n'a noté de collage — on ne sait pas
#
#  « Jamais confirmé » n'est pas « à recoller » : c'est l'aveu qu'on
#  ignore l'état du forum. Au démarrage, presque tout est là-dedans, et
#  c'est exact — on l'ignorait vraiment.
#
#  ── IL NE FAIT PAS ÉCHOUER LA CI ────────────────────────────────────
#
#  Un forum en retard n'est pas un défaut du code. Le rouge est réservé
#  à ce qu'un développeur peut corriger en poussant ; ici il n'y a qu'un
#  collage à faire, par une personne, dans une interface. `--strict`
#  existe pour qui veut quand même le durcir.
#
#  Usage :
#      python3 outils/recoller.py              l'état de tout
#      python3 outils/recoller.py --pose accueil      après un collage
#      python3 outils/recoller.py --pose tout         après une tournée
#      python3 outils/recoller.py --strict     sort en 1 s'il en reste
# ════════════════════════════════════════════════════════════════════

import datetime
import hashlib
import json
import pathlib
import sys

RACINE = pathlib.Path(__file__).resolve().parent.parent
REGISTRE = RACINE / "data" / "a-recoller.json"


def empreinte(chemin: pathlib.Path) -> str:
    """Les seize premiers hexas du SHA-256 du fichier.

    Seize, et pas soixante-quatre : le registre se lit à l'œil quand on
    compare deux lignes, et seize hexas sont déjà soixante-quatre bits.
    On se protège d'une distraction, pas d'un adversaire.
    """
    return hashlib.sha256(chemin.read_bytes()).hexdigest()[:16]


def charger() -> dict:
    if not REGISTRE.exists():
        raise SystemExit(f"{REGISTRE} manque")
    return json.loads(REGISTRE.read_text(encoding="utf-8"))


def enregistrer(d: dict) -> None:
    REGISTRE.write_text(
        json.dumps(d, ensure_ascii=False, indent=1) + "\n", encoding="utf-8"
    )


def etat(colle: dict) -> tuple[str, str]:
    """Rend (état, détail) pour une entrée du registre."""
    f = RACINE / colle["fichier"]
    if not f.exists():
        return "absent", f"{colle['fichier']} n'existe pas — régénère-le"
    maintenant = empreinte(f)
    pose = colle.get("empreinte")
    if pose is None:
        return "inconnu", "jamais confirmé"
    if pose != maintenant:
        return "a_recoller", f"changé depuis le collage du {colle.get('le', '?')}"
    return "a_jour", f"collé le {colle.get('le', '?')}"


def main() -> int:
    d = charger()
    colles = d["colles"]

    if "--pose" in sys.argv:
        i = sys.argv.index("--pose")
        if i + 1 >= len(sys.argv):
            print("--pose attend une clé, ou « tout »", file=sys.stderr)
            return 2
        cle = sys.argv[i + 1]
        cibles = list(colles) if cle == "tout" else [cle]
        inconnues = [c for c in cibles if c not in colles]
        if inconnues:
            print(
                f"clé inconnue : {', '.join(inconnues)}\n"
                f"connues : {', '.join(colles)}",
                file=sys.stderr,
            )
            return 2
        #  LA DATE DU JOUR, et pas celle du dernier changement du
        #  fichier : ce qu'on note est QUAND LE COLLAGE A EU LIEU, pas
        #  quand le contenu a été écrit. Les deux peuvent être très
        #  éloignés — c'est même tout le problème que cet outil mesure.
        aujourdhui = datetime.date.today().isoformat()
        for c in cibles:
            f = RACINE / colles[c]["fichier"]
            if not f.exists():
                print(f"   {c} : {colles[c]['fichier']} manque, non noté")
                continue
            colles[c]["empreinte"] = empreinte(f)
            colles[c]["le"] = aujourdhui
            #  UN CONSTAT MEURT AVEC LE COLLAGE QU'IL DÉCRIVAIT. Il dit
            #  ce que le forum portait un jour donné ; une fois recollé,
            #  il ne décrit plus rien, et le garder ferait mentir la
            #  ligne « ok » juste au-dessus.
            if colles[c].pop("constat", None) is not None:
                print(f"   noté : {c} collé le {aujourdhui} (constat levé)")
            else:
                print(f"   noté : {c} collé le {aujourdhui}")
        enregistrer(d)
        return 0

    #  `--bref` est la forme que lit le garde-fou. Sans lui, vingt-huit
    #  lignes « jamais confirmé » s'intercaleraient à chaque passage
    #  entre les contrôles qui, eux, ont quelque chose à dire — et un
    #  rapport qu'on apprend à survoler ne sert plus à rien. En bref,
    #  seul ce qui est DÛ s'affiche ; le reste tient dans un total.
    bref = "--bref" in sys.argv
    largeur = max(len(c) for c in colles)
    a_faire = []
    inconnus = []
    for cle, colle in colles.items():
        e, detail = etat(colle)
        marque = {
            "a_jour": "  ok  ",
            "a_recoller": "  ⟳   ",
            "inconnu": "  ?   ",
            "absent": "  ✗   ",
        }[e]
        if not bref or e in ("a_recoller", "absent"):
            print(f"{marque}{cle.ljust(largeur)}  {detail}")
        #  UN CONSTAT EST UNE MESURE PRISE À LA MAIN sur le forum, un
        #  jour donné. L'outil ne sait pas lire le forum ; quand
        #  quelqu'un l'a fait pour lui, ça se note, et ça s'affiche —
        #  sinon l'observation meurt dans une conversation.
        if colle.get("constat") and (not bref or e != "a_jour"):
            print(f"        ↳ {colle['constat']}")
        if e in ("a_recoller", "absent"):
            a_faire.append((cle, colle))
        elif e == "inconnu":
            inconnus.append((cle, colle))

    if bref:
        #  Une ligne, et elle porte les trois nombres : ce qui est dû,
        #  ce qu'on ignore, et le total suivi. Les trois ensemble, parce
        #  que « 0 à recoller » seul laisserait croire que tout va bien
        #  alors que vingt-huit collages n'ont jamais été confirmés.
        print(
            f"   collages : {len(colles)} suivis · {len(a_faire)} à recoller · "
            f"{len(inconnus)} jamais confirmé(s)"
        )
        return 1 if (a_faire and "--strict" in sys.argv) else 0

    print()
    if a_faire:
        print(f"{len(a_faire)} à recoller :")
        for cle, colle in a_faire:
            print(f"   · {colle['quoi']}")
            print(f"     {colle['fichier']}")
            print(f"     {colle['ou']}")
    if inconnus:
        print(
            f"{len(inconnus)} jamais confirmé(s) — on ignore ce que le forum porte."
        )
        print("   Après les avoir collés : python3 outils/recoller.py --pose tout")
    if not a_faire and not inconnus:
        print("tout ce qui se colle à la main est à jour.")

    return 1 if (a_faire and "--strict" in sys.argv) else 0


if __name__ == "__main__":
    #  `python3 outils/recoller.py | head` casse le tuyau au sixième
    #  ligne, et Python le remonte en BrokenPipeError bruyante. Vingt-
    #  huit entrées : on PIPERA vers `head`, c'est certain. On rend donc
    #  à SIGPIPE son comportement d'origine — le programme s'arrête
    #  proprement, comme n'importe quel outil Unix.
    import signal

    if hasattr(signal, "SIGPIPE"):
        signal.signal(signal.SIGPIPE, signal.SIG_DFL)
    raise SystemExit(main())
