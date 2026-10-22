# Les tables de la V1 — mises de côté le 15 octobre 2026

Ce dossier n'est lu par personne. Il garde les tables de rencontre que Callista avait
écrites pour les dix zones de la V1 : **145 lieux, 298 tables**, avec des pourcentages
écrits à la main (5, 8, 9, 10, 12 %) et des tables de météo par lieu.

## Pourquoi elles ne servent plus

Callista, le 15 octobre : « enlève tous les petits lieux. On a 3 paliers, 17 zones
sauvages, et tu répartis le pokédex comme ça. »

Le niveau « lieu » a donc disparu du jeu : une zone sauvage EST le lieu, et sa table de
rencontre vient du Pokédex de Rhode (planche 39, `data/pokedex-de-rhode.json`).
Fusionner ces tables-ci par zone n'aurait rien gardé d'utile — leurs pourcentages ne
décrivent une chance que *dans un lieu*, et les additionner aurait réécrit la rareté
qu'elles dessinaient.

**Elles sont gardées parce qu'elles sont de sa main.** Si le découpage par lieu revient
un jour, c'est ici qu'il faut venir le chercher — et pas le réinventer.

## Ce qu'il y a dedans

| fichier | zone | lieux | entrées | conditions |
|---|---|---|---|---|
| `9.json` | Forêt Marécageuse | 15 | 327 | jour, nuit, pluie |
| `32.json` | Plage Grain de Sel | 14 | 300 | jour, nuit |
| `34.json` | Montagnes Embrumées | 16 | 332 | brouillard, jour, nuit |
| `36.json` | Steppes Arides | 16 | 344 | jour, nuit, soleil écrasant, tempête de sable |
| `37.json` | Canyon Lekro | 14 | 298 | jour, nuit, tempête de sable |
| `38.json` | Lande Broussailleuse | 16 | 344 | jour, nuit |
| `39.json` | Volcan Nuageux | 14 | 309 | jour, nuit, pluie de cendres |
| `100.json` | Fleuve Paisible | 14 | 290 | jour, nuit |
| `103.json` | Monts Enneigés | 13 | 292 | blizzard, jour, nuit |
| `104.json` | Océan Mystérieux | 13 | 290 | jour, nuit, orage |

Total : 145 lieux, 3126 entrées.
