#!/usr/bin/env python3
"""Fabrique `data/pokedex-de-rhode.json` — les 933 espèces de la planche 39.

D'OÙ VIENT CETTE LISTE
──────────────────────
De la planche 39, « Le Pokédex de Rhode — version refaite », établie le
1er octobre 2026 à partir du sujet `t42-le-pokedex-de-rhode` du forum et
corrigée selon les décisions de Callista : 25 fautes de frappe reprises,
3 doublons retirés, 111 espèces ajoutées pour refermer les chaînes
d'évolution et la 9e génération, 16 formes de Hisui ajoutées. Les
fossiles n'y sont pas — ils ne s'obtiennent qu'au laboratoire — et les
légendaires, fabuleux, Ultra-Chimères et Paradoxes non plus.

**Les listes ci-dessous sont recopiées de la planche, pas réécrites.**
L'ordre est celui de la planche, et il compte : elle range par stade
d'évolution, les formes de base d'abord. C'est de cet ordre que
`faune-par-zone.py` tire les niveaux et les raretés.

CE QUI VÉRIFIE LA TRANSCRIPTION
───────────────────────────────
Deux contrôles, parce qu'une liste de 933 noms recopiée à la main est
une liste de 933 occasions de se tromper :

1. **Le compte par zone**, annoncé dans la planche à côté de chaque
   titre (« *67 espèces.* »), et les trois totaux de palier
   (411 / 382 / 140). Un nom perdu ou dédoublé tombe ici.
2. **Les noms eux-mêmes**, pour les sept zones dont les tables de faune
   ont déjà été écrites depuis cette même planche le 12 octobre : la
   transcription doit redonner exactement les mêmes noms, dans le même
   ordre. 341 des 933 noms sont donc vérifiés contre un fichier qui
   existait avant celui-ci.

Un nom mal orthographié qui passerait ces deux contrôles serait quand
même attrapé plus loin : `faune-par-zone.py` refuse tout nom qu'il ne
sait pas résoudre en identifiant d'espèce.

    python3 outils/pokedex-de-rhode.py            écrit le fichier
    python3 outils/pokedex-de-rhode.py --verifier ne l'écrit pas, rend 1 s'il diffère
"""

import json
import pathlib
import sys

RACINE = pathlib.Path(__file__).resolve().parent.parent
SORTIE = RACINE / "data" / "pokedex-de-rhode.json"
FAUNE = RACINE / "data" / "faune"
ZONES = RACINE / "data" / "zones.json"

#  Les trois paliers, avec les niveaux recommandés tels que la planche
#  les donne. « Recommandés, pas des barrières » : ce qui ouvre une zone,
#  c'est le palier du dresseur.
PALIERS = {
    1: ("Zones Accessibles", "niveaux recommandés 1 à 20", 411),
    2: ("Zones Expérimentées", "niveaux recommandés 15 à 40", 382),
    3: ("Zones Ultimes", "niveaux recommandés 35 et plus", 140),
}

#  (zone, palier, compte annoncé par la planche, liste)
SOURCE = [
    ("Steppes Arides", 1, 67, """
Tutafeh, Crabicoque, Piafabec, Canarticho, Minisange, Racaillou, Onix, Rhinocorne, Manzaï,
Tarinor, Nodulithe, Rocabot, Charbi, Dolman, Limonde, Séléroc, Solaroc, Cacnea, Sabelette,
Taupiqueur, Osselait, Phanpy, Hippopotas, Rototaupe, Tiboudet, Dunaja, Chamallot, Balbuto,
Grillepattes, Hélionceau, Goupix, Caninos, Ponyta, Magby, Limagma, Chartor, Flamajou,
Darumarond, Aflamanoir, Bacabouh, Sancoki, Rongourmand, Zarbi, Lewsor, Charpenti, Debugant,
Baggiguane, Mascaïman, Malosse, Embrylex, Kraknoix, Griknot, Solochi, Salamèche, Héricendre,
Poussifeu, Ouisticram, Gruikui, Feunnec, Flamiaou, Flambino, Chochodile, Selutin, Charbambin,
Terracool, Germéclat, Caninos de Hisui
"""),
    ("Plage Grain de Sel", 1, 69, """
Loupio, Babimanta, Carvanha, Sovkipou, Tentacool, Qwilfish, Venalgue, Vorastérie, Psykokwak,
Ptitard, Barloche, Otaria, Kokiyas, Krabby, Hypotrempe, Poissirène, Stari, Magicarpe,
Rémoraid, Écrapince, Coquiperl, Lovdisc, Mustébouée, Embrochet, Écayon, Concombaffe, Roucool,
Opermine, Corayon, Relicanth, Goélise, Obalie, Bekaglaçon, Froussardine, Flingouste, Mamanbo,
Flotajou, Picassaut, Couaneton, Nigosier, Viskuse, Tritonde, Kungfouine, Plumeline Buyō,
Plumeline Pom-Pom, Plumeline Flamenco, Plumeline Hula, Azurill, Poulpaf, Crabagarre,
Vostourno, Carapuce, Kaiminus, Gobou, Tiplouf, Moustillon, Grenousse, Otaquin, Larméléon,
Wailmer, Barpau, Lokhlass, Khélocrok, Coiffeton, Pâtachiot, Grondogue, Flotillon, Taupikeau,
Dofin
"""),
    ("Forêt Marécageuse", 1, 73, """
Tritox, Granivol, Saquedeneu, Tournegrin, Polichombr, Balignon, Scorplane, Ceribou, Vortente,
Feuillajou, Chlorobule, Maracachi, Cabriolaine, Mimantis, Croquine, Feuforêve, Vivaldaim,
Verpom, Nosferapti, Chétiflor, Rozbouton, Trompignon, Aspicot, Mimitoss, Mimigal, Rapion,
Abo, Nidoran♂, Nidoran♀, Tadmorv, Smogo, Gloupti, Séviper, Miamiasme, Baudrive, Brocélôme,
Pitrouille, Fantominus, Funécire, Ténéfix, Spiritomb, Motisma, Skelénox, Théffroi, Natu,
Abra, Quartermac, Nucléos, Goupilou, Soporifik, Miaouss d'Alola, Bulbizarre, Germignon,
Arcko, Tortipouss, Lianaja, Marisson, Brindibou, Ouistempo, Mimiqui, Tropius, Wimessir,
Venipatte, Sucroquin, Scalpion, Mystherbe, Vipélierre, Poussacha, Virovent, Pimito, Toutombe,
Mordudor, Poltchageist
"""),
    ("Montagnes Embrumées", 1, 68, """
Blizzi, Frissonille, Marcacrin, Darumarond de Galar, Sabelette d'Alola, M. Mime de Galar,
Archéomire, Stalgamin, Sorbébé, Polarhume, Hexagel, Grelaçon, Cadoizo, Farfuret, Gringolem,
Monorpale, Statitik, Chrysapile, Galvaran, Racaillou d'Alola, Magnéti, Togedemaru, Pichu,
Voltorbe, Élekid, Galekid, Dynavolt, Posipi, Négapi, Lixy, Pachirisu, Zébibron, Anchwatt,
Voltoutou, Wattapik, Dedenne, Morpeko, Airmure, Fermite, Grindur, Taupiqueur d'Alola,
Scrutella, Miaouss de Galar, Tic, Charibari, Terhal, Medhyèna, Sepiatop, Munna, Drakkarmin,
Sonistrelle, Draïeul, Bébécaille, Boumata, Fantyrm, Mucuscule, Draby, Coupenotte,
Goupix d'Alola, Tutafeh de Galar, Toxizap, Duralugon, Pohm, Têtampoule, Zapétrel, Vrombi,
Frigodo, Voltorbe de Hisui
"""),
    ("Lande Broussailleuse", 1, 67, """
Doduo, Hoothoot, Nirondelle, Tylton, Étourmi, Poichigeon, Furaiglon, Passerouge, Lippouti,
Emolga, Wattouat, Moumouton, Rattata, Miaouss, Ptiravi, Excelangue, Kangourex, Goinfrex,
Fouinette, Capumain, Teddiursa, Cerfrousse, Queulorior, Écrémeuh, Zigzaton, Parecool,
Chuchmur, Skitty, Spinda, Keunotor, Laporeille, Chaglam, Ratentif, Ponchiot, Nanméouïe,
Chinchidou, Frison, Sapereau, Couafarel, Manglouton, Dodoala, Chovsourir, Cryptéro, Noeunoeuf,
Chacripan, Korillon, Cornèbre, Tauros, Pyronille, Évoli, Métamorph, Porygon, Morphéo, Riolu,
Ponyta de Galar, Mangriff, Kecleon, Bibichut, Pandespiègle, Psystigri, Gourmelet, Compagnol,
Olivini, Gribouraigne, Piétacé, Farfuret de Hisui, Zorua de Hisui
"""),
    ("Fleuve Paisible", 1, 67, """
Arakdo, Nénupiot, Araqua, Axoloto, Tarsal, Mime Jr., Mélo, Togepi, Snubbull, Flabébé,
Fluvetin, Grainipiot, Tournicoton, Caratroc, Insolourdo, Denticrisse, Okéoké, Coxy, Yanma,
Apitrini, Paras, Larveyette, Chenipan, Pomdepik, Chenipotte, Muciole, Lumivole, Crikzik,
Cheniti, Lépidonille, Larvadar, Pijako, Ningale, Doudouvet, Spododo, Bombydou, Toudoudou,
Guérilande, Trousselin, Cradopaud, Nounourson, Férosinge, Machoc, Méditikka, Makuhita,
Ramoloss, Moufouette, Spoink, Zigzaton de Galar, Corayon de Galar, Strassie, Minidraco,
Brutalibré, Grimalin, Crèmy, Insécateur, Scarabrute, Mysdibule, Scarhino, Carabing,
Escargaume, Larvibule, Tissenboule, Lilliterelle, Léboulérou, Forgerette, Qwilfish de Hisui
"""),
    ("Canyon Lekro", 2, 67, """
Crabaraque, Golgopathe, Gravalanch, Rhinoféros, Volcaropod, Donphan, Simularbre, Géolithe,
Gravalanch d'Alola, Scorvol, Excavarenne, Sablaireau, Triopikeur, Ossatueur, Hippodocus,
Dunaconda, Camérupt, Kaorine, Roucoups, Rapasdepic, Dodrio, Noarfang, Hélédelle, Étourvol,
Colombeau, Gueriaigle, Piclairon, Bekipan, Capidextre, Lockpin, Coudlangue, Miradar, Ponchien,
Pashmilla, Rongrigou, Castorno, Escroco, Linéon de Galar, Grahyèna, Granbull, Judokrak,
Karaclée, Argouste, Cacturne, Torgamord, Météno, Ymphect, Wagomine, Lougaroc Diurne,
Lougaroc Nocturne, Bourrinos, Bleuseille, Absol, Ronflex, Canarticho de Galar, Rondoudou,
Cerbyllin, Fragroin, Famignol, Tapatoès, Amassel, Craparoi, Motorizard, Terraiste, Farigiraf,
Zoroark de Hisui, Séracrawl de Hisui
"""),
    ("Libra Échoué", 2, 61, """
Sinistrail, Munja, Spectrum, Golemastoc, Tutétékri, Ossatueur d'Alola, Mélancolux, Téraclope,
Branette, Magirêve, Tutankafer, Polthégeist, Corayôme, Momartik, Kravarech, Coxyclaque,
Maskadra, Ninjask, Papilord, Apireine, Yanmega, Parasect, Cheniselle, Couverdure, Chrysacier,
Armulys, Blindalys, Mélokrik, Limaspeed, Pérégrain, Corboss, Vaututrice, Pifeuil, Moufflair,
Drascore, Fourbelin, Grodoudou, Noadkoko d'Alola, Coléodôme, Altaria, Bruyverne, Pomdrapi,
Vibraninf, Carmache, Dispareptil, Diamat, Drackhaus, Écaïd, Colimucus, Zorua, Zoroark,
Incisache, Filentrappe, Gambex, Fulgulairo, Lestombaile, Ferdeter, Tomberro, Cryodo,
Théffroyable, Colimucus de Hisui
"""),
    ("Manoir Barjok", 2, 62, """
Floravol, Héliatronc, Ceriflor, Bouldeneu, Feuiloutan, Fragilady, Chevroum, Floramantis,
Candine, Blancoton, Haydaim, Nosferalto, Ortide, Boustiflor, Rosélia, Gaulet, Coconfort,
Aéromite, Migalos, Arbok, Nidorino, Nidorina, Grotadmorv, Smogogo, Avaltout, Miasmax,
Grodrive, Desséliande, Moumouflon, Rattatac, Persian, Leveinard, Fouinar, Linéon, Vigoroth,
Ramboum, Delcatty, Charmilly, Mélofée, Hexadron, Ursaring, Herbizarre, Macronium, Massko,
Boskara, Boguérisse, Efflèche, Badabouin, Porygon2, Scobolide, Chaffreux, Banshitrouye,
Qwilpik, Matourgeon, Olivado, Tag-Tag, Virevorreur, Terracruel, Floréclat, Deusolourdo,
Pomdramour, Électrode de Hisui
"""),
    ("Usine Désaffectée", 2, 64, """
Cochignon, Lippoutou, Oniglali, Sorboul, Séracrawl, Dimoret, Mygavolt, Lucanon, Iguolta,
Magnéton, Électrode, Élektek, Lainergie, Élecsprint, Luxio, Zéblitz, Lampéroie, Fulgudog,
Noacier, Foretress, Cizayox, Lançargot, Triopikeur d'Alola, Minotaupe, Clic, Archéodong,
Galegon, Tarinorme, Dimoclès, Scalproie, Xatu, Rhinolove, Kadabra, Hypnomade, Groret, Éoko,
Mushana, Rubombelle, Floette, Rattata d'Alola, Girafarig, Métang, M. Glaquette,
Sablaireau d'Alola, Salarsen, Pikachu, Steelix, Noadkoko, Flagadoss de Galar, Berserkatt,
Pachyradjah, Polagriffe, Darumacho de Galar, Voltali, Galvagon, Galvagla, Briochien,
Ampibidou, Bérasca, Forgella, Vrombotor, Balbalèze, Gromago, Gueriaigle de Hisui
"""),
    ("Volcan Nuageux", 2, 64, """
Scolocendre, Malamandre, Némélios, Feunard, Arcanin, Galopa, Magmar, Flamoutan, Darumacho,
Braisillon, Démolosse, Chapignon, Coatox, Chelours, Colossinge, Machopeur, Kicklee, Tygnon,
Kapoera, Hariyama, Ouvrifier, Shaofouine, Krakos, Palarticho, Charmina, Mesmérella, Méios,
Neitram, Mistigrix, Chapotus, Sepiatroce, Rattatac d'Alola, Persian d'Alola, Léopardus,
Roublenard, Baggaïd, Pandarbare, Smogogo de Galar, Cocotine, Cupcanaille, Tadmorv d'Alola,
Limonde de Galar, Reptincel, Feurisson, Galifeu, Chimpenfeu, Roussil, Matoufeu, Lapyro,
Pyrax, Lucario, Grotadmorv d'Alola, Grotichon, Hachécateur, Farfurex, Crocogril, Pohmotte,
Carmadura, Malvalame, Scovilain, Flamenroule, Pondralugon, Arcanin de Hisui,
Fragilady de Hisui
"""),
    ("Oasis Perdue", 2, 64, """
M. Mime, Démanta, Sharpedo, Lanturn, Colhomard, Sarmuraï, Tentacruel, Lombre, Tarenbulle,
Prédastérie, Akwakwak, Têtarte, Maraiste, Barbicha, Tritosor, Batracné, Krabboss, Poissoroy,
Staross, Octillery, Mustéflott, Luminéon, Hastacuda, Flotoutan, Bargantua, Gamblast,
Lamantine, Crustabri, Lakmécygne, Phogleur, Crabominable, Moyade, Trépassable, Flagadoss,
Qulbutoké, Togetic, Farfaduvet, Lampignon, Marill, Kirlia, Ramoloss de Galar, Gouroutan,
Carabaffe, Crocrodil, Flobio, Prinplouf, Mateloutre, Croâporal, Otarlette, Arrozard, Draco,
Hypocéan, Serpang, Hydragon, Hydragla, Paragruel, Canarbello, Dogrino, Cléopsytra,
Triopikeau, Superdofin, Délestin, Oyacata, Nigirigon
"""),
    ("Planque Snatch", 3, 24, """
Grolem, Tyranocif, Raichu, Raichu d'Alola, Lougaroc Crépusculaire, Grolem d'Alola, Nidoking,
Nidoqueen, Ectoplasma, Libégon, Mackogneur, Blindépique, Bétochef, Brouhabam, Monaflèmit,
Mastouffe, Torterra, Brutapode, Magnézone, Gigalithe, Porygon-Z, Rhinastoc, Ursaking,
Gigansel
"""),
    ("Océan Mystérieux", 3, 27, """
Tortank, Laggron, Aligatueur, Tarpaud, Wailord, Milobellus, Rosabyss, Clamiral, Aquali,
Ludicolo, Kaimorse, Hyporoi, Roigada, Amphinobi, Azumarill, Tartard, Ohmassacre, Lanssorien,
Togekiss, Léviator, Corvaillus, Crapustule, Sorcilence, Oratoria, Lézargus, Palmaval,
Clamiral de Hisui
"""),
    ("Relique Sacrée", 3, 30, """
Cotovol, Florges, Méganium, Joliflor, Jungko, Phyllali, Majaspic, Sucreine, Gorythmic,
Florizarre, Rafflesia, Empiflor, Roserade, Dardargnan, Papinox, Gardevoir, Leuphorie,
Mélodelfe, Nymphali, Galopa de Galar, Tengalice, Charmillon, Prismillon, Manternel,
Papilusion, Astronelle, Miascarade, Arboliva, Pomdorochi, Archéduc de Hisui
"""),
    ("Monts Enneigés", 3, 30, """
Roucarnage, Déflaisan, Bazoucan, Nostenfer, Étouraptor, Blizzaroi, Beldeneige, Mammochon,
Sorbouboul, Luxray, Givrali, Cliticlic, Métalosse, Galeking, Exagide, Pingoléon,
Roigada de Galar, Dratatin, Sidérella, Symbios, Muplodocus, Mentali, Gallame, Noctunoir,
Élekable, Pharamp, Pohmarmotte, Forgelina, Glaivodo, Muplodocus de Hisui
"""),
    ("Volcan Sombre", 3, 29, """
Dracaufeu, Maganon, Typhlosion, Goupelin, Pyrobut, Pyroli, Ixon, Crocorible, Félinferno,
Noctali, Braségali, Carchacrok, Trioxhydre, Flambusard, Angoliath, Tranchodon, Alakazam,
Drattak, Dracolosse, Ékaïser, Archéduc, Lugulabre, Monthracite, Simiabraz, Roitiflam,
Flâmigator, Courrousinge, Scalpereur, Typhlosion de Hisui
"""),
]


class Desaccord(Exception):
    """La transcription ne dit pas ce que la planche annonce."""


#  LES NOMS QUI PORTENT UN POINT. Le point final de la phrase et le point
#  de « Mime Jr. » se ressemblent, et un `rstrip(".")` sur chaque nom
#  avait écrit « Mime Jr » dans le fichier — un nom que les joueurs
#  auraient lu dans leur Pokédex. Ils sont nommés ici parce qu'ils sont
#  trois, et qu'une liste de trois noms se relit.
POINT_DANS_LE_NOM = ("Mime Jr.", "M. Mime", "M. Mime de Galar", "M. Glaquette")


def noms(brut: str) -> list[str]:
    """Les noms d'une liste, dans l'ordre.

    On coupe sur la virgule et pas sur le retour à la ligne : la planche
    écrit des paragraphes, et un nom peut tomber à cheval sur deux
    lignes.
    """
    plat = " ".join(brut.split())
    sortie = []
    for brute in plat.split(","):
        nom = brute.strip()
        if nom == "":
            continue
        #  On ne retire le point que s'il n'appartient pas au nom.
        if nom.endswith(".") and nom not in POINT_DANS_LE_NOM:
            nom = nom[:-1].strip()
        sortie.append(nom)
    return sortie


def construire() -> dict:
    zones = {z["nom"]: z for z in json.loads(ZONES.read_text(encoding="utf-8"))["zones"]}
    sortie: dict = {
        "_": (
            "Les 933 espèces du Pokédex de Rhode, par zone — planche 39, recopiées par "
            "outils/pokedex-de-rhode.py. L'ORDRE COMPTE : la planche range par stade "
            "d'évolution, les formes de base d'abord. Fossiles, légendaires, fabuleux, "
            "Ultra-Chimères et Paradoxes en sont volontairement absents."
        ),
        "paliers": {
            str(p): {"nom": n, "niveaux": niv, "especes": total}
            for p, (n, niv, total) in PALIERS.items()
        },
        "zones": [],
    }

    par_palier: dict[int, int] = {1: 0, 2: 0, 3: 0}
    vus: dict[str, str] = {}
    for nom, palier, annonce, brut in SOURCE:
        liste = noms(brut)
        if len(liste) != annonce:
            raise Desaccord(f"{nom} : {len(liste)} noms transcrits, {annonce} annoncés")
        zone = zones.get(nom)
        if zone is None:
            raise Desaccord(f"« {nom} » n'est pas une zone de data/zones.json")
        if zone["palier"] != palier:
            raise Desaccord(f"{nom} : palier {palier} ici, {zone['palier']} dans zones.json")
        #  LES DOUBLONS ÉTAIENT LE DÉFAUT DU SUJET D'ORIGINE — trois, dont
        #  un dans la même zone. La planche les a retirés ; on vérifie que
        #  la transcription ne les a pas remis.
        for espece in liste:
            if espece in vus:
                raise Desaccord(f"« {espece} » est en {vus[espece]} ET en {nom}")
            vus[espece] = nom
        par_palier[palier] += len(liste)
        sortie["zones"].append({
            "forumId": zone["forumId"],
            "zone": nom,
            "palier": palier,
            "especes": liste,
        })

    for palier, (_, _, total) in PALIERS.items():
        if par_palier[palier] != total:
            raise Desaccord(
                f"palier {palier} : {par_palier[palier]} espèces, {total} annoncées"
            )
    if len(vus) != 933:
        raise Desaccord(f"{len(vus)} espèces en tout, 933 annoncées")
    return sortie


def contre_les_tables(donnees: dict) -> list[str]:
    """Le second contrôle : les sept zones déjà écrites depuis la planche.

    Leurs tables de faune ont été produites le 12 octobre à partir de la
    même source. Si la transcription d'aujourd'hui ne redonne pas les
    mêmes noms dans le même ordre, c'est que l'une des deux s'est trompée
    — et on veut le savoir avant d'écrire les dix-sept.
    """
    dits = []
    for zone in donnees["zones"]:
        chemin = FAUNE / f"{zone['forumId']}.json"
        if not chemin.exists():
            continue
        lieux = json.loads(chemin.read_text(encoding="utf-8")).get("lieux", {})
        #  Seules les tables de zone entière sont comparables : les dix
        #  zones de la V1 ont une table PAR LIEU, écrite à la main par
        #  Callista et sans rapport avec l'ordre de la planche.
        if len(lieux) != 1:
            continue
        table = next(iter(lieux.values())).get("jour", [])
        ecrits = [e["nom"] for e in table]

        #  LES NOMS SONT UNE ERREUR, L'ORDRE EST UN ÉCART. Un nom qui
        #  manque ou qui est en trop, c'est une transcription fausse :
        #  on s'arrête. Un ordre différent se signale et ne bloque pas,
        #  parce que la planche elle-même se lit de deux façons — sa
        #  liste principale, et sa section « ce qui a été ajouté », qui
        #  range les ajouts en fin de liste.
        manque = [n for n in zone["especes"] if n not in ecrits]
        trop = [n for n in ecrits if n not in zone["especes"]]
        if manque or trop:
            raise Desaccord(
                f"{zone['zone']} : la table du 12 octobre ne dit pas la même chose. "
                f"Absents de la table : {manque or '—'}. Absents de la planche : {trop or '—'}."
            )
        if ecrits != zone["especes"]:
            ecarts = [
                f"rang {i} : « {a} » ici, « {b} » dans {chemin.name}"
                for i, (a, b) in enumerate(zip(zone["especes"], ecrits))
                if a != b
            ]
            dits.append(
                f"  {zone['zone']:22} {len(ecrits):3} noms confirmés, "
                f"MAIS {len(ecrits) - sum(1 for a, b in zip(zone['especes'], ecrits) if a == b)}"
                f" dans un autre ordre :\n      " + "\n      ".join(ecarts[:3]) +
                ("\n      …" if len(ecarts) > 3 else "")
            )
            continue
        dits.append(f"  {zone['zone']:22} {len(ecrits):3} noms confirmés par {chemin.name}")
    return dits


def main() -> int:
    donnees = construire()
    confirmes = contre_les_tables(donnees)

    texte = json.dumps(donnees, ensure_ascii=False, indent=1) + "\n"
    if "--verifier" in sys.argv:
        if not SORTIE.exists() or SORTIE.read_text(encoding="utf-8") != texte:
            print(f"{SORTIE.name} ne correspond pas à la planche 39.", file=sys.stderr)
            return 1
        print(f"{SORTIE.name} : à jour.")
        return 0

    SORTIE.write_text(texte, encoding="utf-8")
    for ligne in confirmes:
        print(ligne)
    total = sum(len(z["especes"]) for z in donnees["zones"])
    print(f"{SORTIE.name} : {len(donnees['zones'])} zones, {total} espèces.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
