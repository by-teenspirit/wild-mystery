# Faire peindre la carte de Rhode par un générateur d'images

## D'abord, le problème que ce document contourne

Un générateur d'images **ne sait pas placer vingt-six lieux nommés à
des coordonnées précises**. Il comprend « une forêt marécageuse à
l'ouest », pas « une forêt marécageuse centrée en (142, 286) qui
touche la Plage Grain de Sel au sud ». Et il écrit du faux texte : les
étiquettes reviendront en « Forêl Maracogeuse ».

Deux conséquences, et elles décident de la méthode :

1. **Demande une image SANS AUCUN TEXTE.** Les noms se reposent
   par-dessus après coup — j'ai le calque, il est déjà calé.
2. **Donne-lui ma carte en image de référence** si ton générateur le
   permet (Midjourney `--sref` ou une image en entrée, Nano Banana,
   Flux Kontext, Firefly « référence de composition », ChatGPT/DALL·E
   en joignant l'image). C'est ce qui fait la différence entre « une
   jolie carte d'un autre monde » et « ma carte, peinte ». Sans
   référence, la géographie sera inventée et ne coïncidera plus avec
   le forum.

Le mieux marche en deux temps : **image de référence + prompt
ci-dessous + « sans texte »**, puis on recolle les étiquettes.

---

## Le prompt, version française

> Vue du dessus, à la verticale, d'une carte de région de jeu vidéo
> dans le style des cartes de région Pokémon et de la carte d'Hyrule :
> illustration peinte à la main, gouache numérique, couleurs franches
> mais douces, contours nets, aucun relief en 3D, aucune perspective,
> aucune ombre portée longue. Un seul continent arrondi, posé au
> centre, entouré d'un océan.
>
> **Absolument aucun texte, aucune lettre, aucun chiffre, aucune
> étiquette, aucune légende, aucune rose des vents, aucun cadre.**
>
> L'océan est un dégradé continu : bleu ardoise profond aux quatre
> bords de l'image, s'éclaircissant progressivement vers un turquoise
> pâle le long des côtes, avec quelques cercles d'ondulation très
> discrets. Une plage de sable clair fait le tour complet du
> continent, large et continue.
>
> L'intérieur du continent est entièrement découpé en territoires
> adjacents qui se touchent — aucune zone de terrain vide ou neutre
> entre eux, comme une carte des biomes. Chaque territoire a sa propre
> couleur et sa propre texture de végétation ou de roche, peinte en
> petits motifs répétés vus du dessus.
>
> Disposition des territoires, en partant du haut :
>
> - **tout en haut au centre** : des sommets enneigés, blanc et bleu
>   très pâle ;
> - **juste à leur droite** : un massif volcanique brun foncé avec des
>   cônes et des points de lave orange ;
> - **en haut à gauche** : une chaîne de montagnes gris-vert dans la
>   brume ;
> - **en haut à droite** : une steppe aride, ocre jaune, herbes sèches ;
> - **à l'extrême droite** : un petit désert de sable pâle avec une
>   oasis — un point d'eau turquoise entouré de palmiers ;
> - **à gauche, au milieu** : une grande forêt marécageuse vert foncé,
>   arbres ronds et flaques d'eau noire ;
> - **au centre** : une lande vert olive de broussailles basses, puis
>   plus bas une prairie vert clair traversée par une rivière ;
> - **au centre droit** : un petit territoire violet-gris de manoir
>   hanté, arbres morts ;
> - **à droite** : un canyon de roche rouge-orange, plateaux et mesas ;
> - **à l'extrême droite** : un volcan noir actif, coulées de lave ;
> - **en bas à droite** : une friche industrielle grise, puis un
>   repaire rocheux brun sombre ;
> - **en bas au centre** : des ruines côtières de pierre claire,
>   colonnes brisées, au bord de la mer ;
> - **en bas à gauche** : une longue plage de sable avec des palmiers,
>   et une côte gris-bleu jonchée d'épaves de bateaux.
>
> Deux rivières bleues serpentent depuis les montagnes jusqu'à la mer,
> avec des berges de sable clair, et un petit lac rond au centre.
>
> Un réseau de chemins de terre beige clair relie les territoires
> entre eux : des routes **sinueuses et courbes, jamais droites**,
> bordées d'un liseré crème, qui se croisent à des carrefours. Le long
> de ces chemins, **neuf petits villages** vus du dessus : des grappes
> de trois ou quatre maisons à toit rouge-brun, minuscules, posées à
> des carrefours. Un édifice plus grand à toit ocre et bannière dorée
> au centre-haut du continent.
>
> Une petite île ronde séparée du continent, au large en bas à droite,
> avec un village dessus. Une zone de haute mer plus foncée à côté
> d'elle.
>
> Palette d'ensemble : terre cuite, sable, vert mousse, ocre, et bleu
> ardoise pour l'eau. Chaleureuse, légèrement vieillie, comme une
> carte illustrée de livre pour enfants. Très lisible, sans
> encombrement, les territoires clairement distincts les uns des
> autres. Format paysage.

---

## Le prompt, version anglaise (recommandée)

> Top-down orthographic view of a video game region map, in the style
> of a Pokémon region map and the Hyrule overworld map: hand-painted
> digital gouache illustration, clean flat shapes, bold but soft
> colors, crisp edges, no 3D relief, no perspective, no long cast
> shadows. A single rounded continent centered in the frame,
> surrounded by ocean.
>
> **Absolutely no text, no letters, no numbers, no labels, no legend,
> no compass rose, no border, no watermark.**
>
> The ocean is one smooth continuous gradient: deep slate blue at all
> four edges of the image, fading gradually to pale turquoise along
> the shoreline, with a few very faint concentric ripple rings. A
> wide, continuous pale sand beach rings the entire continent.
>
> The inside of the continent is fully partitioned into adjacent
> touching territories — no empty or neutral ground anywhere between
> them, like a biome map. Each territory has its own color and its own
> top-down texture of vegetation or rock, painted as small repeated
> motifs.
>
> Territory layout, from the top:
>
> - **top center**: snow-capped peaks, white and very pale blue;
> - **right of those**: a dark brown volcanic massif with cones and
>   orange lava dots;
> - **top left**: a grey-green misty mountain range;
> - **top right**: an arid ochre-yellow steppe with dry grass tufts;
> - **far right**: a small pale sand desert with an oasis — a
>   turquoise pool ringed by palm trees;
> - **mid left**: a large dark green wooded swamp, round tree crowns
>   and black water pools;
> - **center**: an olive-green heath of low scrub, and below it a
>   light green meadow crossed by a river;
> - **center right**: a small purple-grey haunted manor territory with
>   dead trees;
> - **right**: a red-orange rock canyon with plateaus and mesas;
> - **far right**: an active black volcano with lava flows;
> - **bottom right**: a grey industrial wasteland, then a dark brown
>   rocky hideout;
> - **bottom center**: pale stone coastal ruins with broken columns,
>   at the water's edge;
> - **bottom left**: a long sandy beach with palm trees, and a
>   blue-grey shore littered with shipwrecks.
>
> Two blue rivers meander from the mountains down to the sea, with
> pale sand banks, and one small round lake at the center.
>
> A network of light beige dirt paths connects the territories:
> **winding, curving roads, never straight**, outlined in cream,
> meeting at junctions. Along these paths, **nine tiny top-down
> villages**: clusters of three or four small red-brown roofed houses
> at road junctions. One larger building with an ochre roof and a gold
> banner in the upper center of the continent.
>
> One small round island separate from the mainland, offshore at the
> bottom right, with a village on it. A darker deep-sea patch beside
> it.
>
> Overall palette: terracotta, sand, moss green, ochre, and slate blue
> water. Warm, slightly aged, like an illustrated children's book map.
> Highly legible, uncluttered, territories clearly distinct from one
> another. Landscape format.

---

## Le prompt négatif, si ton générateur en accepte un

> text, letters, words, labels, captions, legend, watermark, signature,
> compass rose, grid, border, frame, UI, icons, 3D render, isometric
> view, perspective, photorealistic, satellite photo, dark, gloomy,
> cluttered, blurry, distorted

---

## Et après

Rends-moi l'image. Je peux :

- **recoller les étiquettes dessus** — les vingt-six noms, leurs
  biomes, l'ancre de la Relique Sacrée et la légende, au bon endroit,
  depuis `data/carte.json`. Le calque existe déjà : c'est celui de
  l'affiche actuelle, il suffit de retirer le fond ;
- **découper les zones cliquables** pour la carte du forum, si la
  géographie peinte diffère de la nôtre — mais il faudra alors
  redessiner les contours, et les deux cartes cesseront de se déduire
  l'une de l'autre.
