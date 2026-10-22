# 75 · Les taux — apparition par zone, et butin par fouille

*15 octobre 2026. Les deux tables que Callista a demandées, avec ses arbitrages du même jour.*

## 1 · Faire apparaître un Pokémon

**Pondération 6 / 3 / 1** — choisie par Callista après avoir vu les trois options chiffrées.
Un « commun » apparaît six fois plus souvent qu'un « rare ». La rareté vient du rang dans
la liste de la planche 39 : les formes de base d'abord, les formes finales en bas.

| zone | palier | espèces | commun | peu commun | rare | niveaux |
|---|---|---|---|---|---|---|
| Forêt Marécageuse | 1 | 73 | **2.02 %** × 36 | **1.01 %** × 22 | **0.34 %** × 15 | 1–20 |
| Plage Grain de Sel | 1 | 69 | **2.14 %** × 34 | **1.07 %** × 21 | **0.36 %** × 14 | 1–20 |
| Montagnes Embrumées | 1 | 68 | **2.16 %** × 34 | **1.08 %** × 20 | **0.36 %** × 14 | 1–20 |
| Fleuve Paisible | 1 | 67 | **2.21 %** × 33 | **1.10 %** × 20 | **0.37 %** × 14 | 1–20 |
| Lande Broussailleuse | 1 | 67 | **2.21 %** × 33 | **1.10 %** × 20 | **0.37 %** × 14 | 1–20 |
| Steppes Arides | 1 | 67 | **2.21 %** × 33 | **1.10 %** × 20 | **0.37 %** × 14 | 1–20 |
| Canyon Lekro | 2 | 67 | **2.21 %** × 33 | **1.10 %** × 20 | **0.37 %** × 14 | 15–40 |
| Oasis Perdue | 2 | 64 | **2.29 %** × 32 | **1.15 %** × 19 | **0.38 %** × 13 | 15–40 |
| Usine Désaffectée | 2 | 64 | **2.29 %** × 32 | **1.15 %** × 19 | **0.38 %** × 13 | 15–40 |
| Volcan Nuageux | 2 | 64 | **2.29 %** × 32 | **1.15 %** × 19 | **0.38 %** × 13 | 15–40 |
| Manoir Barjok | 2 | 62 | **2.37 %** × 31 | **1.19 %** × 18 | **0.40 %** × 13 | 15–40 |
| Libra Échoué | 2 | 61 | **2.43 %** × 30 | **1.21 %** × 18 | **0.40 %** × 13 | 15–40 |
| Monts Enneigés | 3 | 30 | **4.88 %** × 15 | **2.44 %** × 9 | **0.81 %** × 6 | 35–55 |
| Relique Sacrée | 3 | 30 | **4.88 %** × 15 | **2.44 %** × 9 | **0.81 %** × 6 | 35–55 |
| Volcan Sombre | 3 | 29 | **5.13 %** × 14 | **2.56 %** × 9 | **0.85 %** × 6 | 35–55 |
| Océan Mystérieux | 3 | 27 | **5.56 %** × 13 | **2.78 %** × 8 | **0.93 %** × 6 | 35–55 |
| Planque Snatch | 3 | 24 | **6.12 %** × 12 | **3.06 %** × 7 | **1.02 %** × 5 | 35–55 |

Le taux dépend aussi du **nombre d'espèces** : une zone de 24 espèces fait apparaître
chacune trois fois plus souvent qu'une zone de 73. C'est mécanique et c'est assumé —
les zones ultimes sont petites, donc on y croise plus vite ce qu'on cherche.

Changer le rapport se fait en une ligne (`POIDS` dans `outils/faune-par-zone.py`) et une
regénération. Les deux autres options chiffrées, pour mémoire : 3/2/1 donnait
1,80 / 1,20 / 0,60 % en Forêt Marécageuse, 10/4/1 donnait 2,16 / 0,86 / 0,22 %.

## 2 · Fouiller la zone

Une fouille, un tirage, cinq issues qui s'excluent et font 100.

| issue | taux | d'où vient le chiffre |
|---|---|---|
| des pokédollars | **44.8 %** | le reste |
| un objet | **25.0 %** | posé par moi, gardé par Callista |
| bredouille | **20.0 %** | `fouille.ts` : « une fouille sur cinq ne donne rien » |
| un morceau de fossile | **10.0 %** | choisi par Callista le 15 octobre |
| un fossile entier | **0.2 %** | idem |

Les pokédollars suivent le palier : **20 à 60 ₽** au palier 1, **50 à 120 ₽** au palier 2,
**100 à 240 ₽** au palier 3, arrondis à la dizaine.

### Les fossiles, et pourquoi ces deux nombres ont changé

Ils étaient à **0,8 % / 6 %**, marqués « arbitraires, posés pour que le code tourne » depuis
le 7 octobre. Mesuré en simulant 20 000 joueurs : avec ce réglage, le premier fossile
arrivait vers la 76ᵉ fouille et **70 % du temps c'était un fossile ENTIER, pas un
assemblage**. Le système des morceaux était donc plus lent que le coup de chance qu'il
devait remplacer : deux morceaux sur trois ne servaient à rien.

Callista a tranché **0,2 % / 10 %** : premier fossile vers la **87ᵉ fouille**, et **82 %**
des premiers fossiles viennent de l'assemblage. L'entier redevient ce que l'annexe du monde
décrit — « il faudrait être réellement chanceux ».

Le tirage est **uniforme parmi les onze**, donc pour un fossile précis :

- un morceau d'une espèce donnée : **0.909 %** par fouille ;
- un fossile entier d'une espèce donnée : **0.0182 %** par fouille ;
- ses trois morceaux : **330 fouilles** en moyenne.

Les onze : Lilia, Anorith, Amonita, Kabuto, Ptéra, Dinoclier, Kranidos, Carapagos, Arkéapti, Ptyranidur, Amagara.

### Les objets, zone par zone

Le taux est **absolu** — la chance par fouille, pas une part des 25 %.

Les sept objets communs ont le même taux dans toutes les zones d'un même palier, à ±0,3
point près (la normalisation dépend du nombre de balls spéciales de la zone) :

**Palier 1**

| objet | prix | taux par fouille |
|---|---|---|
| Antidote | 100 ₽ | 8.24 – 8.52 % |
| Anti-Para | 200 ₽ | 4.12 – 4.26 % |
| Poké Ball | 200 ₽ | 4.12 – 4.26 % |
| Réveil | 250 ₽ | 3.30 – 3.41 % |
| Potion | 300 ₽ | 2.75 – 2.84 % |
| Faiblo Ball | 1000 ₽ | 0.82 – 0.85 % |
| Rapide Ball | 1000 ₽ | 0.82 – 0.85 % |
| Filet Ball *(dans 1 zones)* | 1000 ₽ | 0.82 % |
| Scuba Ball *(dans 1 zones)* | 1000 ₽ | 0.82 % |
| Sombre Ball *(dans 1 zones)* | 1000 ₽ | 0.82 % |

**Palier 2**

| objet | prix | taux par fouille |
|---|---|---|
| Antidote | 100 ₽ | 5.80 – 6.08 % |
| Anti-Para | 200 ₽ | 2.90 – 3.04 % |
| Poké Ball | 200 ₽ | 2.90 – 3.04 % |
| Anti-Brûle | 250 ₽ | 2.32 – 2.43 % |
| Antigel | 250 ₽ | 2.32 – 2.43 % |
| Réveil | 250 ₽ | 2.32 – 2.43 % |
| Potion | 300 ₽ | 1.93 – 2.03 % |
| Super Ball | 600 ₽ | 0.97 – 1.01 % |
| Total Soin | 600 ₽ | 0.97 – 1.01 % |
| Super Potion | 700 ₽ | 0.83 – 0.87 % |
| Rapide Ball | 1000 ₽ | 0.58 – 0.61 % |
| Scuba Ball *(dans 1 zones)* | 1000 ₽ | 0.59 % |
| Sombre Ball *(dans 2 zones)* | 1000 ₽ | 0.58 – 0.59 % |
| Filet Ball *(dans 1 zones)* | 1000 ₽ | 0.58 % |

**Palier 3**

| objet | prix | taux par fouille |
|---|---|---|
| Antidote | 100 ₽ | 5.55 – 5.67 % |
| Anti-Para | 200 ₽ | 2.77 – 2.84 % |
| Poké Ball | 200 ₽ | 2.77 – 2.84 % |
| Anti-Brûle | 250 ₽ | 2.22 – 2.27 % |
| Antigel | 250 ₽ | 2.22 – 2.27 % |
| Réveil | 250 ₽ | 2.22 – 2.27 % |
| Potion | 300 ₽ | 1.85 – 1.89 % |
| Super Ball | 600 ₽ | 0.92 – 0.95 % |
| Total Soin | 600 ₽ | 0.92 – 0.95 % |
| Super Potion | 700 ₽ | 0.79 – 0.81 % |
| Rapide Ball | 1000 ₽ | 0.55 – 0.57 % |
| Filet Ball *(dans 1 zones)* | 1000 ₽ | 0.55 % |
| Scuba Ball *(dans 1 zones)* | 1000 ₽ | 0.55 % |
| Sombre Ball *(dans 1 zones)* | 1000 ₽ | 0.55 % |
| Hyper Ball | 1200 ₽ | 0.46 – 0.47 % |
| Hyper Potion | 1200 ₽ | 0.46 – 0.47 % |
| Rappel | 1500 ₽ | 0.37 – 0.38 % |
| Potion Max | 2500 ₽ | 0.22 – 0.23 % |
| Rappel Max | 4000 ₽ | 0.14 % |

Et les balls spéciales, zone par zone :

| zone | palier | types dominants mesurés | balls spéciales |
|---|---|---|---|
| Forêt Marécageuse | 1 | plante, poison, spectre | Faiblo Ball, Rapide Ball, Sombre Ball |
| Montagnes Embrumées | 1 | electrik, acier, glace | Faiblo Ball, Rapide Ball |
| Lande Broussailleuse | 1 | normal, vol, psy | Faiblo Ball, Rapide Ball |
| Fleuve Paisible | 1 | insecte, fee, combat | Faiblo Ball, Rapide Ball, Filet Ball |
| Plage Grain de Sel | 1 | eau, vol, poison | Faiblo Ball, Rapide Ball, Scuba Ball |
| Steppes Arides | 1 | feu, sol, roche | Faiblo Ball, Rapide Ball |
| Manoir Barjok | 2 | plante, poison, normal | Rapide Ball |
| Usine Désaffectée | 2 | acier, electrik, psy | Rapide Ball |
| Volcan Nuageux | 2 | feu, combat, tenebres | Rapide Ball, Sombre Ball |
| Libra Échoué | 2 | insecte, spectre, dragon | Rapide Ball, Filet Ball, Sombre Ball |
| Canyon Lekro | 2 | normal, roche, sol | Rapide Ball |
| Oasis Perdue | 2 | eau, psy, fee | Rapide Ball, Scuba Ball |
| Planque Snatch | 3 | roche, sol, normal | Rapide Ball |
| Monts Enneigés | 3 | acier, glace, psy | Rapide Ball |
| Relique Sacrée | 3 | plante, insecte, poison | Rapide Ball, Filet Ball |
| Océan Mystérieux | 3 | eau, fee, vol | Rapide Ball, Scuba Ball |
| Volcan Sombre | 3 | feu, tenebres, dragon | Rapide Ball, Sombre Ball |

Huit zones n'ont aucune ball **typée** : leurs types dominants — normal, roche, acier,
electrik, psy, feu — n'ont pas de ball dans le catalogue. Il n'y en a que trois de typées
(Scuba, Filet, Sombre), et c'est le catalogue qui en décide, pas la règle.

## 3 · Les quatre règles du butin, et d'où chacune vient

1. **Le prix est la rareté.** Le poids d'un objet est `1 / prix`, normalisé. Ce n'est pas
   une hiérarchie inventée : les prix sont dans `data/objets.json` et ils disent déjà ce qui
   est précieux. Conséquence assumée : l'Antidote (100 ₽) se trouve deux fois plus souvent
   que la Poké Ball (200 ₽), et le Rappel Max (4 000 ₽) quarante fois moins.
2. **Le palier ouvre la liste.** Palier 1 : le bas de gamme. Palier 2 : ça plus le milieu.
   Palier 3 : tout. Le palier est le seul axe de difficulté que la donnée définisse déjà.
3. **La ball spéciale suit le type dominant de la zone**, et ce type est **mesuré** sur les
   espèces que la zone porte : la Plage sort à « eau 54 sur 69 espèces », le Volcan Nuageux
   à « feu 25 », les Montagnes à « electrik 25, acier 16, glace 15 ». La correspondance
   ball → type est de moi, et elle vient de ce que la ball fait dans les jeux : Scuba Ball
   sous l'eau, Filet Ball sur les insectes, Sombre Ball sur les ténèbres et les spectres. La
   Faiblo Ball n'a pas de type — elle attrape les Pokémon faibles — donc elle est dans les
   zones de palier 1. La Rapide Ball non plus : elle agit au premier tour d'un combat, donc
   elle est partout, et son prix la rend rare partout.
4. **Les dix pierres d'évolution y sont**, depuis que tu l'as dit : « on peut tomber sur une
   pierre d'évolution ». Elles n'y étaient pas, et le motif se tenait — `data/objets.json`
   dit que « l'annexe combat les place à la boutique SPÉCIALE de la Station Service » — mais
   ce n'était pas à moi d'en déduire qu'on ne les trouve pas. La boutique garde sa raison
   d'être : on y en **achète** une à coup sûr. En fouille, c'est de la chance : 3 000 ₽ au
   catalogue, donc la règle 1 les met à **deux dixièmes de pour cent** chacune.

   Six pierres portent leur type dans leur nom — Feu, Eau, Foudre (electrik), Plante, Glace,
   Nuit (ténèbres et spectre) — et vont dans les zones de ce type, par la même règle que les
   balls. Les quatre autres — Lune, Soleil, Éclat, Aube — n'en portent aucun : leur en donner
   un serait l'inventer. Elles apparaissent **à partir du palier 2**, là où se font les
   évolutions qu'elles servent. Les dix sont donc trouvables, et aucune zone n'en a plus de
   sept.

   **Les quatre objets tenus** (Peau Métal, Bel'Écaille, Fleur Sucrée, Roche Royale) restent
   dehors, et faute d'avoir demandé : ils servent des évolutions par ÉCHANGE, un système dont
   le forum n'a pas décidé.

### Ce que ces règles ne règlent pas

Un joueur de palier 3 trouve surtout… des Antidotes. Le palier **ouvre** la liste mais ne
**déplace** pas la distribution : au Volcan Sombre, l'Antidote reste la trouvaille la plus
fréquente (5,55 %) et le Rappel Max tombe à 0,14 %. C'est cohérent avec la règle 1, et ça se
corrigerait par une règle de plus : réserver une part de la fouille au palier de la zone —
par exemple, au palier 3, 45 % de la part objet sur les objets de palier 3, 35 % sur ceux de
palier 2, 20 % sur ceux de palier 1. Trois nombres de plus à décider, donc je ne les ai pas
pris.

## Où ça vit

- `data/butin.json` — les dix-sept listes, dérivées. Écrit par `outils/butin.py`, qui dit
  ses règles en en-tête.
- `data/faune/<forumId>.json` — les taux d'apparition. Écrits par `outils/faune-par-zone.py`.
- `data/fossiles.json` — les deux chances de fossile, et c'est là qu'on les règle.
- **Garde-fou n° 23** vérifie les quatre fichiers dérivés : une donnée dérivée qu'on ne
  vérifie pas est une donnée qui finit par mentir.

## C'est branché

- **La fouille est un seul tirage à cinq issues.** `fouiller()` prend les taux et la table
  de la zone, et rend UNE chose. Avant, une fouille pouvait donner de l'argent ET un
  fossile ; deux tests disaient l'inverse de ce qu'ils disent maintenant, et ils portent
  tous les deux la raison du changement.
- **Les deux chances de fossile ont quitté `ReglesDeFossile`.** Elles vivaient là sans que
  rien ne les lise contre les autres parts. Elles sont dans la table de butin, dérivée de
  `fossiles.json` — où tu continues de les régler — et une part n'a qu'une source.
  `fossile.ts` ne répond plus qu'à une question : **lequel** des onze.
- **Un port `TableDeButin` et son adaptateur**, sur le modèle des fossiles, avec une
  différence assumée : **il refuse d'être illisible**. Les fossiles rendent une table vide
  quand le fichier manque, parce qu'une fouille sans fossile est le cas normal. Une table de
  butin cassée, elle, veut dire qu'on ne sait plus ce qu'une fouille rend : verser des
  Pokédollars « au cas où » écrirait au registre une issue que personne n'a tirée. La zone
  est notée en échec, le curseur ne bouge pas, les messages seront relus.
- **Rien à ajouter en base** : `objet_trouve` existait déjà et sait verser un objet dans un
  sac. Un objet de fouille n'est pas d'une autre nature qu'un morceau de fossile.

Et un détail qui valait une réécriture : le tirage de l'objet se faisait avec un repli
« au cas où l'arrondi dépasse », qu'aucun test ne pouvait atteindre. La couverture l'a
signalé, à raison — un chemin que personne ne traverse est un chemin dont personne ne sait
ce qu'il fait. Il est remplacé par une boucle qui s'arrête avant la dernière ligne, laquelle
est le défaut : une seule sortie, toujours atteinte.

## L'état mesuré

fmt · lint · check · **garde-fou 23 règles** · domaine **139** + couverture **100 %**
(673/673 lignes, 48/48 fonctions, 229/229 branches) · usage 129 · adaptateurs 296 ·
navigateur 220 · **contrat 109** sur une base rejouée depuis zéro · **pgTAP 158/158** ·
**huit harnais verts**.
