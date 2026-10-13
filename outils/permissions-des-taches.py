#!/usr/bin/env python3
# ════════════════════════════════════════════════════════════════════
#  Règle 19 du garde-fou.
#
#  CE QUI L'A FAIT ÉCRIRE, le 13 octobre. Deux tests de
#  `src/navigateur/accueil.test.ts` lisent le vrai `data/accueil.json`
#  du dépôt. La tâche `test:navigateur` ne donnait que `--allow-env`.
#
#  Ils n'ont jamais échoué en local : on lançait `test:tout`, qui donne
#  `--allow-read --allow-net --allow-run`. Le CI, lui, lance la tâche
#  ÉTROITE — et il est tombé en huit secondes, sur un travail qui
#  n'avait rien à voir avec le code poussé.
#
#  Autrement dit : `test:tout` cachait le défaut au lieu de le trouver.
#  Un fourre-tout qui donne tous les droits ne prouve plus qu'un module
#  est pur ; il prouve seulement qu'il marche quand on ne lui refuse
#  rien.
#
#  CE QUE CETTE RÈGLE VÉRIFIE. Pour chaque dossier de premier niveau
#  sous `src/` :
#    1. il a une tâche à lui, et ce n'est pas `test:tout` ;
#    2. les permissions de CETTE tâche couvrent ce que ses tests
#       touchent vraiment.
#
#  Elle ne devine pas : elle relit les tâches de `deno.json` et les
#  appels Deno écrits dans les fichiers. Si un test se met à lire un
#  fichier, la règle le dit avant le CI.
# ════════════════════════════════════════════════════════════════════

import json
import re
import sys
from pathlib import Path

RACINE = Path(__file__).resolve().parent.parent

#  Le fourre-tout est exclu exprès : c'est lui qui masquait le défaut.
FOURRE_TOUT = "test:tout"

#  Ce qu'un appel réclame. La clé est la permission Deno, la valeur la
#  liste des écritures qui la déclenchent. On cherche des appels, pas
#  des mots : `Deno.readTextFile(` et pas `readTextFile`, pour ne pas
#  gronder sur un commentaire qui en parle.
BESOINS = {
    "read": [
        "Deno.readTextFile(",
        "Deno.readFile(",
        "Deno.stat(",
        "Deno.lstat(",
        "Deno.readDir(",
        "Deno.open(",
    ],
    "env": ["Deno.env."],
    "net": ["fetch("],
    "run": ["Deno.Command("],
    "write": ["Deno.writeTextFile(", "Deno.writeFile(", "Deno.mkdir(", "Deno.remove("],
}


def taches() -> dict[str, str]:
    return json.loads((RACINE / "deno.json").read_text(encoding="utf-8"))["tasks"]


def permissions(ligne: str) -> set[str]:
    """Les permissions qu'une ligne de tâche accorde.

    `--allow-read=a,b` compte comme `read` : cette règle vérifie QUE la
    permission est donnée, pas sur quels chemins. Les chemins, c'est au
    test de les justifier, et ils sont commentés là où ils servent."""
    return {m.group(1) for m in re.finditer(r"--allow-([a-z]+)", ligne)}


def cible(ligne: str) -> str | None:
    """Le chemin que la tâche fait tester, s'il y en a un."""
    if "deno test" not in ligne:
        return None
    for mot in ligne.split():
        if mot.startswith("src/"):
            return mot.rstrip("/")
    return None


def besoins_du_fichier(texte: str) -> set[str]:
    return {p for p, appels in BESOINS.items() if any(a in texte for a in appels)}


def main() -> int:
    fautes: list[str] = []
    toutes = taches()

    #  Les tâches étroites : celles qui visent un chemin sous `src/` et
    #  qui ne sont pas le fourre-tout.
    etroites: list[tuple[str, str, set[str]]] = []
    for nom, ligne in toutes.items():
        if nom == FOURRE_TOUT:
            continue
        chemin = cible(ligne)
        if chemin is not None:
            etroites.append((nom, chemin, permissions(ligne)))

    dossiers = sorted(d for d in (RACINE / "src").iterdir() if d.is_dir())
    for dossier in dossiers:
        rel = f"src/{dossier.name}"
        couvrantes = [t for t in etroites if rel == t[1] or rel.startswith(t[1] + "/")]
        if not couvrantes:
            fautes.append(
                f"{rel} n'a aucune tâche à lui dans deno.json — "
                f"seul « {FOURRE_TOUT} » le couvre, et il donne tous les droits"
            )
            continue

        #  Ce que les tests de ce dossier touchent vraiment.
        reclames: dict[str, list[str]] = {}
        for f in sorted(dossier.rglob("*.test.ts")):
            for besoin in besoins_du_fichier(f.read_text(encoding="utf-8")):
                reclames.setdefault(besoin, []).append(str(f.relative_to(RACINE)))

        for nom, _, accordees in couvrantes:
            for besoin, fichiers in sorted(reclames.items()):
                if besoin not in accordees:
                    fautes.append(
                        f"la tâche « {nom} » ne donne pas --allow-{besoin}, "
                        f"mais {fichiers[0]} en a besoin"
                        + (f" (et {len(fichiers) - 1} autre(s))" if len(fichiers) > 1 else "")
                    )

    for faute in fautes:
        print(f"   {faute}")
    if fautes:
        return 1

    #  UNE RÈGLE MUETTE EST UN DÉCOR. Les dix-huit autres disent ce
    #  qu'elles ont compté ; celle-ci aussi, sinon rien ne distingue
    #  « tout va bien » de « je n'ai rien regardé ».
    print(
        f"   permissions : {len(dossiers)} dossiers de src/, "
        f"{len(etroites)} tâches étroites, chacune donne ce que ses tests réclament"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
