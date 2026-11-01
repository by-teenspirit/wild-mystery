#!/usr/bin/env python3
# ════════════════════════════════════════════════════════════════════
#  outils/annexes.py — écrire les quatorze pages d'annexe
#
#  USAGE :  python3 outils/annexes.py
#
#  POURQUOI UN GÉNÉRATEUR ET PAS QUATORZE FICHIERS. Les quatorze pages
#  sont le MÊME gabarit : même tête, mêmes sept briques, même pied. Ce
#  qui change d'une page à l'autre tient en quatre lignes — le numéro,
#  le titre, la photo du lieu et le pokémon. Écrire les quatorze à la
#  main, c'est s'engager à reporter chaque correction quatorze fois, et
#  c'est exactement ce qu'on refuse déjà pour le sommaire, les zones et
#  le catalogue.
#
#  « Tu gardes les mêmes textes partout, on va rédiger les annexes en
#  parallèle et on remplira plus tard. » Le texte de remplissage montre
#  donc LES SEPT BRIQUES, une fois chacune, avec des phrases neutres :
#  en ouvrant sa page, qui rédige voit le gabarit entier et remplace
#  bloc par bloc au lieu d'inventer une mise en page.
#
#  ── LA LISTE VIENT DE `data/annexes.json` ──────────────────────────
#
#  Le sommaire et les pages lisent le même fichier. Ajouter une annexe,
#  en renommer une, en changer l'ordre : c'est ce fichier, puis cette
#  commande. Les numéros ne sont jamais écrits ici.
#
#  ── LES IMAGES SONT ÉCRITES EN ENTIER ──────────────────────────────
#
#  Une page collée vit sur forumactif.com, la feuille sur Pages : une
#  adresse relative y chercherait l'image sur le forum. Les pages
#  portent donc l'adresse complète, comme `zones.json` pour ses
#  bandeaux. C'est aussi ce qui garde la feuille sans `url()`, que le
#  garde-fou n° 7 interdit.
#
#  Les photos sont celles des zones, déjà dans le dépôt et déjà servies
#  en bandeau : rien de nouveau à héberger. Les rendus sont l'artwork
#  officiel de PokeAPI, la même source que les sprites de la carte
#  dresseur et du pokédex.
# ════════════════════════════════════════════════════════════════════

import json
import pathlib

R = pathlib.Path(__file__).resolve().parent.parent

PAGES = "https://by-teenspirit.github.io/wild-mystery"
#  LA LIGNE QUI DIT QU'UNE PAGE EST ÉCRITE PAR CET OUTIL. C'est elle
#  qui autorise à l'écraser ; une page qui ne la porte pas a été rédigée
#  à la main et n'est jamais touchée.
MARQUEUR = "ÉCRITE PAR `outils/annexes.py`"

ARTWORK = (
    "https://raw.githubusercontent.com/PokeAPI/sprites"
    "/bfb75391935310368065096fa08c51e8970bc43e"
    "/sprites/pokemon/other/official-artwork"
)

#  ── CE QUI CHANGE D'UNE PAGE À L'AUTRE, ET RIEN D'AUTRE ────────────
#
#  slug → (photo de zone, numéro national du pokémon, nom du lieu).
#  Le lieu est le mot de la pastille du pied ; il nomme la photo, pour
#  qu'une image de décor ne soit pas qu'une image de décor.
DECORS = {
    "par-ou-commencer": ("plage-grain-de-sel", 150, "La plage du Grain de Sel"),
    "le-contexte": ("relique-sacree", 249, "La Relique Sacrée"),
    "reglement": ("monts-enneiges", 379, "Les Monts Enneigés"),
    "creer-son-personnage": ("fleuve-paisible", 132, "Le Fleuve Paisible"),
    "le-guide-du-dresseur": ("lande-broussailleuse", 448, "La Lande Broussailleuse"),
    "la-region-et-ses-zones": ("steppes-arides", 330, "Les Steppes Arides"),
    "arenes-et-ligue": ("volcan-sombre", 6, "Le Volcan Sombre"),
    "les-groupes": ("montagnes-embrumees", 250, "Les Montagnes Embrumées"),
    "credits": ("oasis-perdue", 151, "L'Oasis Perdue"),
    "le-staff": ("canyon-lekro", 65, "Le Canyon Lékro"),
    "celebrites-de-rhode": ("manoir-barjok", 571, "Le Manoir Barjok"),
    "monnaie-et-missions": ("usine-desaffectee", 52, "L'Usine Désaffectée"),
    "combat-et-progression": ("volcan-nuageux", 68, "Le Volcan Nuageux"),
    "allegeances": ("ile-tenebra", 197, "L'Île Ténèbra"),
}


def lire_le_sommaire():
    d = json.loads((R / "data/annexes.json").read_text(encoding="utf-8"))
    return [e for s in d["sections"] for e in s["entrees"]]


#  ── LE GABARIT ──────────────────────────────────────────────────────
#
#  Les sept briques de la planche 61, une fois chacune, dans l'ordre où
#  une annexe les emploie : carte + tirets, paire, paras, table, encarts,
#  suivante. Une huitième se discute avant de s'écrire.
GABARIT = """<!-- ═══════════════════════════════════════════════════════════════════
     Annexe {numero} · {titre} — à coller dans une page HTML.

     ÉCRITE PAR `outils/annexes.py`. Ne pas corriger ce fichier à la
     main : la correction serait perdue à la prochaine génération, et
     elle ne toucherait qu'une des quatorze pages. Le gabarit est dans
     l'outil, la liste dans `data/annexes.json`.

     ── CRÉER LA PAGE SUR LE FORUM ─────────────────────────────────

     Modules > HTML & JAVASCRIPT > Gestion des pages HTML > Créer, en
     MODE AVANCÉ, et surtout :

       · « Utiliser le header et footer du forum » = **OUI**. Sans
         cette case, la page ne reçoit ni la feuille ni le script : le
         sommaire reste vide et rien n'est habillé.
       · L'adresse doit finir par **{slug}** — c'est ce bout que le
         sommaire reconnaît pour se surligner, et pas le numéro `hN`,
         qui dépend de l'ordre de création chez Forumactif.
       · Reporter l'adresse obtenue dans `data/annexes.json`, champ
         `adresse` : le lien apparaît alors dans les quatorze
         sommaires d'un coup.

     ── LE TEXTE EST UN REMPLISSAGE ────────────────────────────────

     Les sept briques sont montrées une fois chacune, avec des phrases
     neutres. Remplacer bloc par bloc ; supprimer les briques dont la
     page n'a pas besoin. Ce qui ne doit PAS changer : les classes, et
     le `<nav data-wm-sommaire>` qui reçoit le sommaire.
     ═══════════════════════════════════════════════════════════════════ -->

<div class="wm-annexe" style="--annexe-fond: url('{fond}'); --annexe-rendu: url('{rendu}')">

  <nav class="wm-annexe__sommaire" data-wm-sommaire aria-label="Les annexes"></nav>

  <div class="wm-annexe__corps">
    <div class="wm-annexe__colonne">

      <p class="wm-annexe__surtitre">Annexe {numero}</p>
      <h1 class="wm-annexe__titre">{titre_h1}</h1>
      <p class="wm-annexe__chapo">
        Une phrase ou deux pour dire à quoi sert cette page, et ce qu'on y trouvera.
        Elle se lit avant tout le reste : autant qu'elle serve à décider si on continue.
      </p>

      <div class="wm-annexe__blocs">

        <div class="wm-carte">
          <h2 class="wm-carte__titre">Le premier bloc</h2>
          <ul class="wm-tirets">
            <li><b>Une liste à tirets</b> pour ce qui s'énumère : des étapes, des
              conditions, des cas. Le tiret est posé par la feuille — ne pas le
              réécrire ici.</li>
            <li><b>Le mot en gras ouvre la ligne</b>, et la suite l'explique. C'est ce qui
              rend la liste lisible en diagonale.</li>
            <li>Une ligne peut aussi n'être qu'une phrase, sans mot en tête.</li>
          </ul>
        </div>

        <div class="wm-paire">
          <div class="wm-carte">
            <h2 class="wm-carte__titre">Deux cartes côte à côte</h2>
            <div class="wm-paras">
              <p>La brique <b>paire</b> pose deux cartes de même largeur. Elle sert quand
                deux choses se répondent — avant et après, ce qu'on gagne et ce qu'on
                risque.</p>
              <p>Sous 900 pixels, elles s'empilent toutes seules.</p>
            </div>
          </div>
          <div class="wm-carte">
            <h2 class="wm-carte__titre">Et du texte suivi</h2>
            <div class="wm-paras">
              <p>La brique <b>paras</b> est le texte courant : des paragraphes, sans puce
                ni numéro. C'est elle qu'on emploie quand une idée ne se découpe pas.</p>
            </div>
          </div>
        </div>

        <div class="wm-carte">
          <h2 class="wm-carte__titre">Un tableau</h2>
          <div class="wm-table">
            <div class="wm-table__ligne wm-table__ligne--entete">
              <span class="wm-table__cellule wm-table__cellule--nom">Ce qu'on nomme</span>
              <span class="wm-table__cellule">Ce que c'est</span>
              <span class="wm-table__cellule wm-table__cellule--chiffre">Combien</span>
            </div>
            <div class="wm-table__ligne">
              <span class="wm-table__cellule wm-table__cellule--nom">Première ligne</span>
              <span class="wm-table__cellule">La colonne du milieu porte l'explication.</span>
              <span class="wm-table__cellule wm-table__cellule--chiffre">0</span>
            </div>
            <div class="wm-table__ligne">
              <span class="wm-table__cellule wm-table__cellule--nom">Deuxième ligne</span>
              <span class="wm-table__cellule">Le tableau est en flexbox, pas en
                &lt;table&gt; : sur téléphone chaque ligne s'empile et l'en-tête
                disparaît.</span>
              <span class="wm-table__cellule wm-table__cellule--chiffre">0</span>
            </div>
          </div>
        </div>

        <div class="wm-encarts">
          <div class="wm-encart wm-encart--terre">
            <span class="wm-encart__etiquette">À retenir</span>
            <p>L'encart terre souligne ce qu'il ne faut pas manquer. Deux ou trois lignes,
              pas plus : un encart long n'est plus un encart.</p>
          </div>
          <div class="wm-encart wm-encart--paisible">
            <span class="wm-encart__etiquette">Bon à savoir</span>
            <p>L'encart vert dit ce qui rassure, ou ce qui se fait tout seul. Les deux vont
              par paire et se répondent.</p>
          </div>
        </div>

        <div class="wm-suivante">
          <a class="wm-suivante__bouton" href="{suivante_lien}">
            <span class="wm-suivante__etiquette">Annexe suivante</span>
            {suivante_titre} →
          </a>
          <span class="wm-lieu">
            {lieu}
            <b>une question sans réponse ici ? écris au staff</b>
          </span>
        </div>

      </div>
    </div>
  </div>
</div>
"""


def titre_en_h1(titre):
    """Le dernier mot passe en `em` : c'est l'accent bleu de la maquette."""
    mots = titre.split(" ")
    if len(mots) == 1:
        return f"<em>{titre}</em>"
    return " ".join(mots[:-1]) + f" <em>{mots[-1]}</em>"


def main():
    entrees = lire_le_sommaire()
    manquants = [e["slug"] for e in entrees if e["slug"] not in DECORS]
    if manquants:
        raise SystemExit(
            "Ces entrées de data/annexes.json n'ont pas de décor dans ce "
            "fichier : " + ", ".join(manquants)
        )

    zones = {
        pathlib.Path(p).stem for p in (R / "assets/zones").glob("*.jpg")
    }
    for slug, (photo, _, _) in DECORS.items():
        if photo not in zones:
            raise SystemExit(f"assets/zones/{photo}.jpg n'existe pas ({slug})")

    dossier = R / "pages"
    ecrits, laissees = [], []
    for i, e in enumerate(entrees):
        photo, numero_national, lieu = DECORS[e["slug"]]
        #  LA PAGE SUIVANTE EST CELLE D'APRÈS DANS LE SOMMAIRE, et la
        #  dernière renvoie à la première : un bouton « suivante » qui
        #  ne mène nulle part est un bouton mort.
        suite = entrees[(i + 1) % len(entrees)]
        page = GABARIT.format(
            numero=e["numero"],
            titre=e["titre"],
            titre_h1=titre_en_h1(e["titre"]),
            slug=e["slug"],
            fond=f"{PAGES}/assets/zones/{photo}.jpg",
            rendu=f"{ARTWORK}/{numero_national}.png",
            lieu=lieu,
            suivante_titre=suite["titre"],
            #  `#` tant que la page suivante n'existe pas : un lien vers
            #  une adresse inventée serait un lien mort, et le sommaire
            #  dit déjà « à venir » pour la même raison.
            suivante_lien=suite["adresse"] or "#",
        )
        chemin = dossier / f"annexe-{e['numero']}-{e['slug']}.html"
        #  UNE PAGE DÉJÀ RÉDIGÉE N'EST PAS ÉCRASÉE. Le marqueur est la
        #  ligne que ce fichier écrit lui-même en tête : une page qui ne
        #  la porte pas a été écrite à la main, et la régénérer
        #  détruirait du texte. C'est arrivé une fois, le 1er novembre,
        #  sur le règlement qui était en ligne.
        if chemin.exists() and MARQUEUR not in chemin.read_text(encoding="utf-8"):
            laissees.append(chemin.name)
            continue
        chemin.write_text(page, encoding="utf-8")
        ecrits.append((chemin.name, len(page)))

    #  LES ANCIENNES PAGES S'EN VONT : un fichier `pages/annexe-04-…`
    #  resté d'une liste précédente serait collé un jour par erreur.
    gardees = {f"annexe-{e['numero']}-{e['slug']}.html" for e in entrees}
    for f in dossier.glob("annexe-*.html"):
        if f.name in gardees:
            continue
        if MARQUEUR not in f.read_text(encoding="utf-8"):
            #  Même règle : on ne supprime pas du texte écrit à la main.
            #  Une page rédigée qui n'est plus au sommaire est une
            #  décision, pas un nettoyage.
            print(f"  ⚠ {f.name} est rédigée mais n'est plus au sommaire — laissée")
            continue
        f.unlink()
        print(f"  retiré   {f.name}")

    for n in laissees:
        print(f"  gardée   {n} — déjà rédigée, pas écrasée")
    if not ecrits:
        print("  aucune page à écrire")
        return
    plus_gros = max(n for _, n in ecrits)
    print(f"  {len(ecrits)} annexes écrites dans pages/")
    print(f"  la plus grosse fait {plus_gros} caractères (limite Forumactif : 128 000)")
    if plus_gros > 128_000:
        raise SystemExit("une page dépasse la limite de Forumactif")


if __name__ == "__main__":
    main()
