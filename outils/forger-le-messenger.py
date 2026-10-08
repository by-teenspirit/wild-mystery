#!/usr/bin/env python3
# ════════════════════════════════════════════════════════════════════
#  outils/forger-le-messenger.py
#
#  Rejoue les TROIS modifications du fork de Forumactif Messenger sur
#  un `fam.js` d'origine, et refuse d'écrire s'il n'a pas pu toutes les
#  faire.
#
#  ── POURQUOI UN SCRIPT ET PAS UN FICHIER GARDÉ QUELQUE PART ─────────
#
#  Parce que le fichier modifié se périme à chaque version de FAM, et
#  qu'on l'a déjà perdu une fois. Ce qui dure, ce n'est pas le résultat
#  — ce sont les trois changements. La note 63-… les décrit en
#  français ; ce fichier-ci les exécute, et les deux doivent rester
#  d'accord.
#
#  Et parce qu'un `fam.js` fait 158 ko : le modifier à la main dans un
#  éditeur de navigateur, c'est une faute de frappe qui casse le tchat
#  sans rien dire.
#
#  ── CE QU'IL CHANGE, ET RIEN D'AUTRE ────────────────────────────────
#
#  1. LA CONFIG : la page du tchat, la permission, et la traduction
#     française posée d'office. FAM lit sa langue DANS `config.lang` ;
#     tant qu'on ne la remplace pas, chaque membre doit l'importer à la
#     main depuis le panneau. Recopiée ici, le tchat est en français
#     dès la première seconde, pour tout le monde.
#
#  2. LES CINQ ADRESSES D'EXÉCUTION, repointées vers le fork. C'est le
#     point qu'on rate : **un fork n'épingle que son propre fichier**.
#     FAM va chercher ses pages d'aide, ses thèmes, ses fichiers de
#     langue et sa mise à jour chez l'auteur, à l'exécution. Sans ce
#     changement, la moitié de ce qui s'exécute continue de venir
#     d'ailleurs et peut changer sans qu'on le sache.
#
#     Les liens de DOCUMENTATION — le wiki, la page des versions — ne
#     bougent pas : ils ouvrent un onglet pour un humain, ils
#     n'exécutent rien, et ils doivent mener chez l'auteur.
#
#  3. L'EN-TÊTE DE MODIFICATION, que la GPL-3.0 exige dès qu'on
#     redistribue une version modifiée.
#
#  ── POURQUOI IL REFUSE PLUTÔT QUE D'ÉCRIRE À MOITIÉ ─────────────────
#
#  Chaque remplacement est compté. Un `fam.js` d'une version future
#  pourra avoir renommé une clé ou déplacé une adresse : le script
#  s'arrête en disant laquelle, au lieu de produire un fichier qui a
#  l'air juste et dont le tchat parle anglais ou va chercher sa mise à
#  jour ailleurs.
#
#  Usage :
#      python3 outils/forger-le-messenger.py AMONT/fam.js AMONT/fr.js SORTIE/fam.js
# ════════════════════════════════════════════════════════════════════

import pathlib
import re
import sys

#  Le dépôt vers lequel les cinq adresses sont repointées.
FORK = "by-teenspirit/forumactif-messenger"
AMONT = "SethClydesdale/forumactif-messenger"

#  Les deux réglages de Callista, arbitrés le 7 octobre.
PAGE_DU_TCHAT = "/f1-messenger"
PERMISSION = "member"

ENTETE = f"""/*  ────────────────────────────────────────────────────────────────
    VERSION MODIFIÉE de Forumactif Messenger, de SethClydesdale.
    Original : https://github.com/{AMONT}
    Ce fork  : https://github.com/{FORK}

    Sous GPL-3.0, comme l'original. La licence oblige à dire ce qui a
    été changé ; trois choses, et rien d'autre :

      1. `config` — la page du tchat ({PAGE_DU_TCHAT}), la permission
         ({PERMISSION}), et la traduction française de DDril posée
         d'office dans `config.lang`, pour que le tchat soit en
         français sans que chacun l'importe ;
      2. les cinq adresses que le script appelle À L'EXÉCUTION — pages
         d'aide, thèmes, fichiers de langue, mise à jour — repointées
         vers ce fork. Les liens de documentation, eux, mènent toujours
         chez l'auteur ;
      3. cet en-tête.

    Refait par `outils/forger-le-messenger.py` du dépôt wild-mystery :
    ne pas modifier ce fichier à la main, le script serait à refaire.
    ──────────────────────────────────────────────────────────────── */
"""


class ForgeIncoherente(Exception):
    """Levée plutôt que d'écrire un fichier qu'on sait à moitié modifié."""


def remplacer_une_fois(texte: str, avant: str, apres: str, quoi: str) -> str:
    n = texte.count(avant)
    if n != 1:
        raise ForgeIncoherente(f"{quoi} : {n} occurrence(s) de {avant!r}, il en faut une")
    return texte.replace(avant, apres)


def traduction(source: str) -> dict[str, str]:
    """Les couples clé/valeur de `lang/fr.js`.

    Le fichier pose un objet global `fam_lang_import`. On ne l'exécute
    pas — on le LIT, à la ligne, avec la même forme que celle qu'on va
    réécrire. Une clé sur deux lignes ou une valeur calculée serait
    ignorée, et le compte final le dirait.
    """
    couples: dict[str, str] = {}
    for ligne in source.splitlines():
        m = re.match(r"\s*([a-zA-Z0-9_]+)\s*:\s*(.+?),?\s*$", ligne)
        if m is None:
            continue
        cle, valeur = m.group(1), m.group(2).rstrip(",").strip()
        #  Seulement les chaînes : le fichier de langue n'est que ça, et
        #  tout le reste (accolades, commentaires) n'est pas une clé.
        if len(valeur) >= 2 and valeur[0] in "'\"" and valeur[-1] == valeur[0]:
            couples[cle] = valeur
    return couples


def forger(fam: str, fr: str) -> str:
    #  ── 1 · la config ────────────────────────────────────────────────
    fam = remplacer_une_fois(
        fam, "chat_page : ''", f"chat_page : '{PAGE_DU_TCHAT}'", "la page du tchat"
    )
    fam = remplacer_une_fois(
        fam, "chat_permission : 'all'", f"chat_permission : '{PERMISSION}'", "la permission"
    )

    #  ── 1 bis · la traduction, posée dans `config.lang` ──────────────
    debut = fam.find("      lang : {")
    fin = fam.find("      }\n    }, // config_end")
    if debut < 0 or fin < 0 or fin <= debut:
        raise ForgeIncoherente("le bloc « lang » de la config est introuvable")
    bloc = fam[debut:fin]
    attendues = re.findall(r"^\s{8}([a-zA-Z0-9_]+)\s*:", bloc, re.M)
    francaises = traduction(fr)

    manquantes = [c for c in attendues if c not in francaises]
    if manquantes:
        raise ForgeIncoherente(
            f"{len(manquantes)} clé(s) sans traduction française : {manquantes[:6]}"
        )

    #  On réécrit LIGNE À LIGNE plutôt que de régénérer le bloc : les
    #  commentaires et les regroupements de l'original restent en place,
    #  et la différence avec l'amont se lit en une colonne.
    def traduire(m: "re.Match[str]") -> str:
        cle = m.group(2)
        if cle not in francaises:
            return m.group(0)
        return f"{m.group(1)}{cle} : {francaises[cle]}{m.group(4)}"

    neuf, faits = re.subn(
        r"(^\s{8})([a-zA-Z0-9_]+)( *: *)(?:'(?:\\.|[^'\\])*'|\"(?:\\.|[^\"\\])*\")(,?)$",
        traduire,
        bloc,
        flags=re.M,
    )
    if faits != len(attendues):
        raise ForgeIncoherente(
            f"{faits} clé(s) réécrite(s) pour {len(attendues)} attendue(s)"
        )
    fam = fam[:debut] + neuf + fam[fin:]

    #  ── 2 · les cinq adresses d'exécution ────────────────────────────
    racine = f"https://raw.githubusercontent.com/{AMONT}/master/"
    n = fam.count(racine)
    if n != 5:
        raise ForgeIncoherente(f"{n} adresse(s) d'exécution au lieu de 5 — FAM a bougé")
    fam = fam.replace(racine, f"https://raw.githubusercontent.com/{FORK}/master/")

    #  Et les liens de documentation NE bougent pas : on vérifie qu'il
    #  en reste, sinon c'est qu'on a trop remplacé.
    if f"github.com/{AMONT}/wiki" not in fam:
        raise ForgeIncoherente("les liens de documentation ont disparu — ils doivent rester")

    #  ── 3 · l'en-tête ────────────────────────────────────────────────
    if fam.startswith("/*"):
        raise ForgeIncoherente("ce fichier porte déjà un en-tête — ce n'est pas l'original")
    return ENTETE + fam


def main() -> int:
    if len(sys.argv) != 4:
        print("voir l'en-tête du fichier", file=sys.stderr)
        return 2
    amont, langue, sortie = (pathlib.Path(a) for a in sys.argv[1:])
    try:
        resultat = forger(
            amont.read_text(encoding="utf-8"),
            langue.read_text(encoding="utf-8"),
        )
    except ForgeIncoherente as e:
        print(f"rien n'a été écrit — {e}", file=sys.stderr)
        return 1
    except OSError as e:
        print(f"rien n'a été écrit — {e}", file=sys.stderr)
        return 1
    sortie.write_text(resultat, encoding="utf-8")
    print(f"{sortie} : {len(resultat)} octets, les trois modifications faites")
    print("   · page du tchat et permission")
    print("   · traduction française dans config.lang")
    print("   · cinq adresses d'exécution vers le fork, documentation inchangée")
    print("   · en-tête de modification (GPL-3.0)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
