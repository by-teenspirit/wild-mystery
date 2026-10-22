# 76 · Le panier, et la dette de couverture à zéro

*16 octobre 2026. « pareil pour le panier » — la demande du 15, appliquée.*

## Un « + » ne touche plus au message

> « je n'aime pas le fait que ça ajoute une balise dans mon texte, je veux que ce soit
> automatique quand je clique […] pareil pour le panier. »

Le panier s'écrivait dans le brouillon **à chaque clic**, et le commentaire au-dessus de la
fonction défendait ça : « le joueur voit son bloc se construire pendant qu'il remplit ».
L'intention était bonne et le résultat mauvais — on remplit un panier en vingt clics, et
pendant ces vingt clics un bloc de syntaxe grossit au milieu de ce qu'on écrit.

Le panier vit maintenant **dans la page** : le compteur par ligne, la ligne surlignée quand
elle est prise, le sous-total en infobulle à partir de deux, et le total sur le bouton
(« Commander — 5 articles, 1 200 ₽ »). Le bloc s'écrit à **deux moments** :

- au clic sur **Commander**, qui amène aussi au formulaire de réponse ;
- **à l'envoi du formulaire**, et celui-là rattrape le cas qui coûterait une commande :
  remplir le panier, écrire un mot, et envoyer sans avoir cliqué Commander.

Écrire deux fois ne commande pas deux fois : `poserLePanier` remplace le bloc au lieu de
l'empiler, et le harnais le vérifie en cliquant trois fois.

## La dernière dette de couverture est fermée

`module-boutique.ts` était, depuis le 15 octobre, **le dernier module d'interface du dépôt
que ni test ni harnais ne montait** — la dette que le garde-fou n° 22 comptait. C'était la
position de la barre d'actions la veille, et ça avait coûté un bouton muet sur le forum.

`outils/boutique.mjs` monte le **vrai catalogue** — produit par
`python3 outils/objets.py --forum`, exactement celui qui est collé dans le sujet : 34 lignes,
68 boutons — avec une réponse rapide, les jetons, notre feuille et celle de FAM dans l'ordre
réel. Il vérifie 30 choses, dont :

- cinq clics sur des « + » laissent le texte intact ;
- le panier se voit dans la page (compteurs, lignes prises, total) ;
- Commander écrit une fois, trois clics ne font pas trois blocs ;
- panier vidé → bouton éteint, visible, et qui n'écrit rien ;
- envoi sans Commander → le panier part quand même ; panier vide → rien n'est écrit ;
- visiteur déconnecté → aucun bouton, et le catalogue entier reste lisible ;
- les contrastes des cinq textes, dans les deux thèmes.

Vérifié en le cassant : en remettant l'écriture au clic, il sort **2 défauts**, dont
« CINQ CLICS, ET LE TEXTE EST INTACT ».

**`DETTE_ATTENDUE` passe de 1 à 0.** Le chiffre ne peut que descendre : si une dette
réapparaît, la règle gronde.

## Deux petits mensonges corrigés en passant

**Le mode d'emploi du catalogue parlait d'un bouton qui n'existe pas.** `outils/objets.py`
écrivait « cliquez sur les + pour remplir votre panier, puis sur **Valider** » — le bouton
porte « Commander ». Un libellé faux dans un mode d'emploi, c'est un joueur qui cherche un
bouton qu'il ne trouvera pas. Le message dit maintenant Commander, et ajoute que les « + »
ne touchent pas au texte.

**Le commentaire de la feuille annonçait 44 px là où elle en donne 32.** « c'est la taille de
cible tactile qu'on tient partout ailleurs », écrit juste au-dessus de `width: 32px`. Le
harnais mesure 32 : c'est le commentaire qui mentait, pas la cote. 32 est un arbitrage qui se
défend — il y a 68 de ces boutons sur la page, et 44 ferait du catalogue une colonne de
boutons. Le bouton Commander, lui, garde ses 44.

## Et une assertion de moi qui mesurait le tiroir de quelqu'un d'autre

Premier jet du harnais : « à 360, la page ne déborde pas ». Elle gueulait à 620 px. En
servant la même page **sans** `data/fam-base.css`, la largeur retombe à 360 pile : le minimum
vient du greffon FAM, pas de notre feuille ni de la boutique. Et « on touche à rien pour la
version mobile ». L'assertion mesure donc le bloc, pas la page.

## L'état mesuré

fmt · lint · check · **garde-fou 23 règles, dette 0** · domaine 139 + couverture 100 % ·
usage 129 · adaptateurs 296 · navigateur 220 · **neuf harnais verts**.
