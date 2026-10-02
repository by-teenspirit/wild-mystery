# Les jetons, et d'où ils viennent

Relevé du 2 octobre dans Figma, fichier `R5Fz0KRaAwrpIGhMJK74ED`, page
« Fondations ». Deux collections de variables, quinze styles de texte, zéro
style d'effet, zéro style de peinture, zéro style de grille.

Ce document dit quel nom Figma porte et quel nom le CSS porte. Il ne redit pas
les valeurs : elles sont dans `jetons.css`.

---

## 1. Les couleurs — collection « Couleur », modes Aube et Ténèbra

Soixante-dix variables, toutes à deux valeurs. Aube est le mode par défaut, donc
Aube est dans `:root` et Ténèbra dans `body#modernbb.wm-tenebra`.

| Figma | CSS |
|---|---|
| `fond/page` · `fond/surface` · `fond/surface-haute` | `--wm-fond-page` · `--wm-fond-surface` · `--wm-fond-surface-haute` |
| `fond/douce` · `fond/nuit` · `fond/terre` | `--wm-fond-douce` · `--wm-fond-nuit` · `--wm-fond-terre` |
| `texte/encre` | **`--wm-encre`** — seul nom raccourci, il sert partout |
| `texte/corps` · `texte/doux` · `texte/pale` | `--wm-texte-corps` · `--wm-texte-doux` · `--wm-texte-pale` |
| `texte/inverse` · `texte/sur-nuit` | `--wm-texte-inverse` · `--wm-texte-sur-nuit` |
| `accent/primaire` · `accent/fort` · `accent/terre` | `--wm-accent-primaire` · `--wm-accent-fort` · `--wm-accent-terre` |
| `bord/fin` · `bord/net` | `--wm-bord-fin` · `--wm-bord-net` |
| `danger/paisible` · `danger/dangereuse` · `danger/interdite` | `--wm-danger-paisible` · `--wm-danger-dangereuse` · `--wm-danger-interdite` |
| `type/<Nom>/fond` · `type/<Nom>/texte` (18 × 2) | `--wm-type-<nom>-fond` · `--wm-type-<nom>-texte` |
| `pokémon/pur` · `pokémon/obscur` | `--wm-pokemon-pur` · `--wm-pokemon-obscur` |
| `groupe/<nom>/fond` · `groupe/<nom>/texte` (6 × 2) | `--wm-groupe-<nom>-fond` · `--wm-groupe-<nom>-texte` |

Les accents tombent en chemin : `Électrik` → `electrik`, `Ténèbres` → `tenebres`,
`Fée` → `fee`, `pokémon` → `pokemon`. Les accents sont légaux dans un nom de
variable CSS, mais ils traversent un template Forumactif, un éditeur de panneau
d'administration et jsDelivr avant d'arriver au navigateur. On ne tente pas.

## 2. Les mesures — collection « Mesure », un seul mode

Vingt-quatre variables, une seule valeur chacune : rien à redéfinir en Ténèbra.

| Figma | CSS |
|---|---|
| `espace/02` … `espace/48` (14 pas) | `--wm-espace-2` … `--wm-espace-48` — le zéro de tête tombe |
| `rayon/xs` `sm` `md` `lg` | `--wm-rayon-xs` `-sm` `-md` `-lg` |
| `taille/avatar/largeur` · `/hauteur` | `--wm-avatar-largeur` · `--wm-avatar-hauteur` |
| `taille/vignette-zone/largeur` · `/hauteur` | `--wm-vignette-zone-largeur` · `--wm-vignette-zone-hauteur` |
| `taille/sprite` · `taille/cible-tactile` | `--wm-sprite` · `--wm-cible-tactile` |

## 3. La typographie — quinze styles de texte, zéro variable

Figma ne porte aucune variable de typographie : tout est dans des styles. Les
jetons en sont donc une lecture, pas une copie, et un style se recompose avec
quatre d'entre eux.

| Style Figma | famille | taille | graisse | interligne |
|---|---|---|---|---|
| `Titre/Display` | `--wm-police-titre` | `--wm-taille-display` | `--wm-graisse-gras` | `--wm-interligne-affiche` |
| `Titre/Accent` | `--wm-police-accent` | `--wm-taille-accent` | `--wm-graisse-normale` | `--wm-interligne-affiche` |
| `Titre/Page` | `--wm-police-titre` | `--wm-taille-titre-page` | `--wm-graisse-gras` | `--wm-interligne-titre` |
| `Titre/Section` | `--wm-police-titre` | `--wm-taille-titre-section` | `--wm-graisse-demi` | `--wm-interligne-section` |
| `Titre/Carte` | `--wm-police-titre` | `--wm-taille-titre-carte` | `--wm-graisse-demi` | `--wm-interligne-carte` |
| `Chiffre/Grand` | `--wm-police-titre` | `--wm-taille-chiffre` | `--wm-graisse-gras` | `--wm-interligne-chiffre` |
| `Chapô` | `--wm-police-chapo` | `--wm-taille-chapo` | `--wm-graisse-normale` | `--wm-interligne-courant` |
| `Corps/Message` | `--wm-police-corps` | `--wm-taille-message` | `--wm-graisse-normale` | `--wm-interligne-message` |
| `Corps/Normal` | `--wm-police-corps` | `--wm-taille-normal` | `--wm-graisse-normale` | `--wm-interligne-normal` |
| `Corps/Fort` | `--wm-police-corps` | `--wm-taille-normal` | `--wm-graisse-gras` | `--wm-interligne-courant` |
| `Corps/Petit` | `--wm-police-corps` | `--wm-taille-petit` | `--wm-graisse-normale` | `--wm-interligne-courant` |
| `Corps/Petit fort` | `--wm-police-corps` | `--wm-taille-petit` | `--wm-graisse-gras` | `--wm-interligne-surtitre` |
| `Surtitre` | `--wm-police-corps` | `--wm-taille-surtitre` | `--wm-graisse-gras` | `--wm-interligne-surtitre` |
| `Étiquette` | `--wm-police-corps` | `--wm-taille-etiquette` | `--wm-graisse-gras` | `--wm-interligne-etiquette` |
| `Légende` | `--wm-police-corps` | `--wm-taille-legende` | `--wm-graisse-normale` | `--wm-interligne-legende` |

`Surtitre` et `Étiquette` sont en capitales (`text-transform: uppercase`) et sont
les deux seuls styles à porter un interlettrage : `--wm-interlettre-surtitre` et
`--wm-interlettre-etiquette`. Les treize autres sont à 0, donc il n'y a pas de
jeton pour 0.

`Chapô` est en italique dans Figma (`Cormorant Garamond Italic`) : c'est un
`font-style`, pas un jeton.

### Les quatre polices sont des Google Fonts, et rien ne les charge

**Fraunces**, **Kaushan Script**, **Cormorant Garamond**, **Nunito Sans** —
toutes les quatre chez Google Fonts. Conformément à la contrainte du projet, ce
dépôt n'en importe aucune : pas d'`@import`, pas de `<link>`, aucune requête
réseau partie d'une de nos feuilles. Les jetons `--wm-police-*` nomment la
famille et enchaînent sur des familles génériques, donc le forum reste lisible
sans elles — mais **il ne ressemble pas à la maquette**.

Le chargement est une décision à prendre ailleurs : le `<link>` d'`overall_header`
est le seul endroit qui le permette, et il y en a déjà un pour les trois familles
Material du thème (48-… §7). Deux des quatre sont des polices variables, et
leurs axes ne sont pas optionnels pour retrouver le rendu de la maquette :

- Fraunces — `--wm-police-titre-axes` : `"SOFT" 0, "WONK" 1`
- Nunito Sans — `--wm-police-corps-axes` : `"wdth" 100, "YTLC" 500`

---

## 4. Ce qui manque dans Figma

| Ce qui manque | Ce qu'on sait |
|---|---|
| **Les ombres** | Zéro style d'effet, et zéro ombre posée en dur : les 228 nœuds de la page n'en portent aucune. Il n'y a donc rien à relever, et rien dans le fichier. Une carte sans ombre est un choix défendable ; il faut qu'il soit dit. |
| **La largeur de trait** | Aucune variable. En dur, une seule valeur, `1px`, sur les 19 nœuds qui ont un contour — elle est donc cohérente, mais ce n'est pas un jeton, donc elle n'est pas dans le fichier. À créer dans Figma plutôt qu'ici. |
| **Les points de rupture** | Rien dans Figma. Ils existent pourtant, relevés dans le CSS de base de ModernBB et réemployés par `01-deflottement.css` : 1200 · 900 · 800 · 740 · 700 · 400 · 320. Une maquette mobile existe (`15-le-mobile.md`) mais aucune largeur n'en est devenue une variable. |
| **Une couleur de texte pour `pokémon/pur` et `pokémon/obscur`** | Les types et les groupes viennent par paire fond + texte ; ces deux-là n'ont qu'un fond. Donc on ne sait pas ce qu'on écrit dessus, et aucun contraste n'a été validé. |
| **Les largeurs de colonne du forum** | `01-deflottement.css` code en dur 211px pour la fiche de profil, 220px pour la dernière réponse et 56px pour un compteur. Aucune des trois n'est dans Figma, alors que `taille/avatar/largeur` y vaut 200. |

## 5. Les incohérences trouvées

**Deux noms pour une même couleur, en Aube.** `fond/surface`, `texte/inverse` et
`texte/sur-nuit` valent tous `#fffbf7`. Les trois divergent bien en Ténèbra et
`texte/sur-nuit` porte une description qui explique pourquoi — mais en Aube, un
seul de ces trois jetons mal choisi ne se voit pas. Ça se verra à la bascule.

**En Ténèbra, `fond/douce` et `fond/nuit` valent tous deux `#201714`.** Or en
Aube `fond/nuit` est un brun foncé et `fond/douce` un rose pâle : ce sont deux
intentions opposées qui se confondent dans un mode. La barre de navigation et un
fond doux deviennent indiscernables.

**En Ténèbra, `bord/fin` vaut `#2e211c`, exactement `fond/surface-haute`.** Un
séparateur invisible sur une carte posée sur une carte, c'est-à-dire sur le cas
précis où il est le plus utile.

**`rayon/xs`, `rayon/sm` et `rayon/md` ne servent nulle part.** Les 37 nœuds
arrondis de la planche sont tous à 10, donc à `rayon/lg`. Soit les trois autres
sont pour des composants qui n'existent pas encore, soit ils sont à supprimer.

**Les noms mélangent deux langues.** Les groupes sont en français (`fond/`,
`texte/`, `espace/`) et les suffixes de rayon en anglais (`xs`, `sm`, `md`,
`lg`). C'est le seul endroit. Le CSS reprend les noms de Figma tels quels plutôt
que de traduire dans son coin.

**Les portées ne sont pas appliquées pareil.** `type/<Nom>/fond` est limité à
`FRAME_FILL` et `SHAPE_FILL`, mais `groupe/<nom>/fond` autorise aussi
`TEXT_FILL`. Deux familles qui jouent le même rôle, deux réglages.

**Six styles de texte sur quinze ne sont pas sur la planche.** `Titre/Carte`,
`Chiffre/Grand`, `Corps/Fort`, `Corps/Petit fort`, `Étiquette` et `Légende`
existent dans la liste des styles mais n'ont aucun échantillon dans le cadre
« Typographie ». Ils sont relevés depuis la liste, pas depuis un rendu : personne
ne les a vus.

**Rien ne porte la bascule de mode.** Les deux modes s'appellent Aube et Ténèbra
dans Figma, et aucun document du projet ne dit ce qui fait passer de l'un à
l'autre. Le sélecteur retenu dans `jetons.css` est une classe à nous, posée
sur `body#modernbb` ; le déclencheur reste à décider, et les trois pistes sont
listées dans le commentaire du fichier.

## 6. Aucun jeton n'est pensé pour un tableau

Vérifié, puisque la règle du projet est zéro `<table>`. Les mesures de Figma sont
des écarts (`espace/*`), des rayons et six dimensions d'image ou de cible
tactile. Aucune largeur de colonne, aucun gouttière de grille, aucun nombre de
colonnes : rien qui suppose une mise en page tabulaire. Les trois largeurs qui y
ressembleraient (211, 220, 56) sont dans `01-deflottement.css`, pas dans Figma,
et elles y sont déjà servies par du flexbox.
