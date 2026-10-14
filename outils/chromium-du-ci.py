#!/usr/bin/env python3
# ════════════════════════════════════════════════════════════════════
#  Règle 20 du garde-fou.
#
#  CE QUI L'A FAIT ÉCRIRE, le 13 octobre. Deux travaux du CI installent
#  Chromium. Ils ne le faisaient pas pareil :
#
#    « Contraste des pages »   npx --yes playwright@1.49.1 install …
#    « Navigateur … »          deno run -A npm:playwright@1.49.1 install …
#
#  La seconde a tourné SIX HEURES PILE — 14:03:31 → 20:03:56, tuée par
#  la limite de GitHub, sans une ligne d'erreur. Sous Deno,
#  l'installateur de Playwright délègue le téléchargement à un processus
#  fils qui peut rester pendu sans que le parent s'en aperçoive.
#
#  Le défaut n'est pas « Deno est mauvais ». Le défaut est **deux façons
#  de faire la même chose**, dont une seule avait déjà tourné. Celle
#  qu'on n'avait jamais vue marcher est celle qui a cassé, et elle a
#  coûté deux passages.
#
#  CE QUE CETTE RÈGLE VÉRIFIE, dans `.github/workflows/ci.yml` :
#    1. toutes les installations de Chromium sont la MÊME commande ;
#    2. leur version de Playwright est celle que les harnais importent.
#
#  Le point 2 compte autant : un harnais qui importe `playwright@1.49.1`
#  avec un navigateur installé par `playwright@1.50` cherche un numéro
#  de build qui n'est pas là, et se plaint d'un navigateur « absent »
#  alors qu'il est sur le disque.
# ════════════════════════════════════════════════════════════════════

import re
import sys
from pathlib import Path

RACINE = Path(__file__).resolve().parent.parent
CI = RACINE / ".github/workflows/ci.yml"


def main() -> int:
    if not CI.exists():
        print(f"   {CI.relative_to(RACINE)} absent — rien à vérifier")
        return 0

    fautes: list[str] = []

    #  ON LIT LE YAML, PAS LES LIGNES. Première version de cette règle :
    #  un `grep` sur « playwright » et « install ». Elle a gueulé sur son
    #  propre commentaire d'explication, qui cite la commande fautive
    #  pour dire de ne pas s'en servir — et elle a compté deux formes là
    #  où il n'y en a qu'une. Un commentaire n'est pas une commande ;
    #  l'analyseur YAML les distingue, un `grep` jamais.
    try:
        import yaml
    except ModuleNotFoundError:
        print("   PyYAML absent — installation de Chromium non vérifiée")
        return 0

    plan = yaml.safe_load(CI.read_text(encoding="utf-8"))
    installations = [
        ligne.strip()
        for travail in plan.get("jobs", {}).values()
        for etape in travail.get("steps", [])
        for ligne in str(etape.get("run", "")).splitlines()
        if "playwright" in ligne and " install" in ligne
    ]
    commandes = set(installations)

    if not installations:
        fautes.append("aucune installation de Chromium trouvée dans le CI — le harnais n'en a plus besoin ?")
    elif len(commandes) > 1:
        fautes.append("deux façons d'installer le même Chromium :")
        for c in sorted(commandes):
            fautes.append(f"    {c}")
        fautes.append("    — celle qu'on n'a jamais vue tourner est celle qui casse")

    #  La version épinglée côté CI, et celle que les harnais importent.
    versions_ci = {m for c in commandes for m in re.findall(r"playwright@([\d.]+)", c)}
    versions_harnais: dict[str, set[str]] = {}
    for f in sorted((RACINE / "outils").glob("*.mjs")):
        for v in re.findall(r'npm:playwright@([\d.]+)"', f.read_text(encoding="utf-8")):
            versions_harnais.setdefault(v, set()).add(f.name)

    if versions_harnais and versions_ci and set(versions_harnais) != versions_ci:
        fautes.append(
            f"le CI installe playwright {sorted(versions_ci)} "
            f"mais les harnais importent {sorted(versions_harnais)} — "
            "le numéro de build du navigateur ne correspondra pas"
        )
    if len(versions_harnais) > 1:
        fautes.append(
            "les harnais n'importent pas tous la même version de playwright : "
            + ", ".join(f"{v} ({len(n)} fichier(s))" for v, n in sorted(versions_harnais.items()))
        )

    for faute in fautes:
        print(f"   {faute}")
    if fautes:
        return 1

    #  UNE RÈGLE MUETTE EST UN DÉCOR : elle dit ce qu'elle a compté.
    v = sorted(versions_ci)[0] if versions_ci else "?"
    combien = sum(len(n) for n in versions_harnais.values())
    print(
        f"   chromium : {len(installations)} installation(s), une seule forme, "
        f"playwright {v} — et les {combien} harnais importent la même"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
