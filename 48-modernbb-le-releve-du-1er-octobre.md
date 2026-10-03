# ModernBB — le relevé du 1er octobre 2026

Le forum Wild Mystery est passé en **ModernBB**. Ce document remplace, pour ModernBB,
la liste des templates du `01-templates-reference.md` (§6) et complète le `04-dom-reel.md`.
Tout ce qui suit a été lu dans le panneau d'administration du forum réel et dans son CSS
servi, le 1er octobre 2026, en compte fondateur.

---

## 1. Ce qui est vérifié

| Point | Constat |
|---|---|
| Version active | `body#modernbb`. Le wrapper porte `div.conteneur_minwidth_IE.modern-resp` : le thème responsive de 11/2022 est actif. |
| Templates personnalisés | **aucun**. Les 126 templates sont tous en « Valeur par défaut ». On part d'une page blanche. |
| CSS servi | `/2-ltr.css`, 233 Ko (base ModernBB + CSS perso). |
| Polices d'icônes déjà chargées | **Material Icons**, **Material Symbols Outlined**, **Ionicons 2.0.1**, et Roboto. |
| Mise en page du CSS de base | 146 `float`, 102 `inline-block`, 28 `flex`, **0 `grid`**, **0 `display:table`**. |
| Forum en maintenance | oui, au moment du relevé : un visiteur non connecté ne voit que `message_body`. |

**Conséquence sur les icônes** : la maquette Figma du panneau latéral utilise Material Symbols
**Rounded**, le forum charge Material Symbols **Outlined**. Soit on ajoute la variante Rounded
dans `overall_header`, soit on passe la maquette en Outlined. À trancher avant d'écrire le panneau.

---

## 2. La liste réelle des templates

**126 templates** : 110 desktop + 16 mobile. La référence de 2019 en annonçait 103 + 14.

| Catégorie | Nombre | Clé d'URL |
|---|--:|---|
| Général | 31 | `mode=main` |
| Portail | 29 | `mode=portal` |
| Galerie | 13 | `mode=gallery` |
| Calendrier | 6 | `mode=calendar` |
| Groupes | 3 | `mode=group` |
| Poster & Messages privés | 10 | `mode=post` |
| Modération | 9 | `mode=moderation` |
| Profil | 9 | `mode=profil` |
| Version mobile | 16 | `mode=mobile` |

### 2.1 Les treize templates qui n'existaient pas en 2019

| Template | Catégorie | Rôle | Structure |
|---|---|---|---|
| `footer_widgets` | Général | widgets du bas de page | `#footer_widgets > div.column[style="width:…"] > div.widget` — déjà en flex dans le CSS de base |
| `images_list` | Général | page « Dernières Images » | `.forabg > .header > h3.table-title` + `.container-imgs-list#imageList` rempli par `{SCRIPT_IMGS_LIST}` — déjà en flex |
| `topics_grid_box` | Général | liste des sujets en mode Grid | `ul.topiclist.topics` pour l'en-tête puis `div.grid-section` ; vignettes `div.posts-icon` |
| `search_results_topics_grid` | Général | résultats de recherche en mode Grid | non relevé |
| `profile_advanced_body` | Profil | profil en mode avancé | `#profile-advanced-layout > #profile-advanced-left` + `#profile-advanced-details.panel.row3` |
| `mod_about` | Portail | à propos du forum | — |
| `mod_events` | Portail | évènements | — |
| `mod_last_donators` | Portail | derniers donateurs | — |
| `mod_last_images` | Portail | images partagées récemment | — |
| `mod_new_topics` | Portail | nouveaux sujets | — |
| `mod_publi` | Portail | publications | — |
| `mod_social_iframe` | Portail | widgets Facebook / X / Discord | — |
| `mod_top_liked_post_month` | Portail | messages les plus réagis | — |

Côté mobile, deux ajouts : **`index_body`** et **`topics_grid_box`**.

Nouvelle variable repérée au passage : `{topics_grid_box.row.TOPIC_READ_STATUS}`.

### 2.2 Les six templates qui ont disparu

`simple_footer`, `topics_blog_box`, `viewcomments_body`, `posting_smilies`,
`posting_smilies_frame`, `posting_smilies_wysiwyg`.

`viewcomments_body` et `topics_blog_box` servaient aux forums de type Blog. Si une annexe ou
une note les cite, elle est périmée. `simple_header` existe toujours, seul.

---

## 3. Éditer un template sans chercher

Le panneau d'administration donne une URL stable par template :

```
/admin/?part=themes&sub=templates&mode=edit_<cat>&t=<id>&l=<cat>&extended_admin=1&tid=<jeton>
```

`<cat>` = `main`, `portal`, `gallery`, `calendar`, `group`, `post`, `moderation`, `profil`, `mobile`.
Le `tid` change à chaque session : l'ouvrir une fois depuis le PA et le relever.

Les identifiants des templates de la catégorie Général qu'on va toucher :

| Template | `t=` |
|---|--:|
| `index_body` | 110 |
| `index_box` | 111 |
| `overall_footer_begin` | 115 |
| `overall_header` | 116 |
| `topics_list_box` | 124 |
| `viewforum_body` | 125 |
| `viewtopic_body` | 127 |
| `overall_footer_end` | 133 |
| `footer_widgets` | 135 |
| `topics_grid_box` | 136 |
| `images_list` | 137 |
| `profile_advanced_body` (cat. Profil) | 1139 |

Les identifiants élevés confirment l'ordre d'arrivée : les nouveaux templates ont été ajoutés après.

**L'éditeur du PA est un éditeur de code à défilement virtuel** : une lecture automatisée n'en
récupère que les ~42 lignes visibles. Pour obtenir une source complète, passer par le dépôt
(§4) ou utiliser « Télécharger ».

---

## 4. Récupérer le code par défaut

Les sources ModernBB de 2019 sont **toujours exactes** pour les 97 templates qui existaient
alors : comparaison faite ligne à ligne sur `index_box`, identique au code du PA.

```
https://raw.githubusercontent.com/Etana/template/master/src/modernbb/<nom>.tpl
```

Pour les treize nouveaux templates, il n'existe pas de source publique : il faut les lire
dans le PA.

---

## 5. Le squelette ModernBB qui nous concerne

### L'index — `index_box`

```
ul.linklist.top > li > a > i.ion-*
div.forabg
  ul.topiclist > li.header > dl.icon > dd.dterm > div.table-title
                                     > dd.topics|dd.posts|dd.lastpost > i.ion-*
  ul.topiclist.forums
    li.row > dl.icon[style="background:url(ICONE) no-repeat scroll {INC_LEVEL} 50%"]
       dd.dterm > div[style="margin:0 {INC_LEVEL_RIGHT} 0 {INC_LEVEL_LEFT}"]
                    > h{LEVEL}.hierarchy > a.forumtitle
       dd.topics · dd.posts · dd.lastpost
```

L'icône de statut et l'indentation sont en **style inline** généré : elles ne se retirent pas
du template, il faut les écraser en CSS avec `!important`.

### Un sujet — `viewtopic_body`

```
div#p{ID}.post.{ROW_COUNT}.post--{ID}
├─ div.postprofile#profile{ID} > dl
│     dt > div.postprofile-avatar · div.postprofile-name · div.postprofile-rank
│     dd.postprofile-info · dd.postprofile-contact
├─ div.post-head > div.menu-wrap > div.post-menu + ul.profile-icons > li.btn-* > a > i.ion-*
│                > h2.topic-title · div.topic-date
└─ div.postbody > div.content
```

`.postprofile` est en `float:right; width:211px`. C'est là que se branche la fiche de personnage.

### Un forum — `viewforum_body` + `topics_list_box`

`{TOPICS_LIST_BOX}` injecte `topics_list_box`, qui reprend `div.forumbg > ul.topiclist.topics > li.row > dl.icon`.
C'est au-dessus du premier message d'un sujet que vient le module de bilan, donc dans
`viewtopic_body`, pas ici.

---

## 6. Ce que ça change pour le plan de code

1. Les notes qui hésitent entre phpBB2, phpBB3 et ModernBB n'ont plus à hésiter : **on écrit
   pour ModernBB seul**. Les sélecteurs `.forumline`, `.bodyline`, `#page-header`,
   `#container > #content` (phpBB3) ne servent plus.
2. Aucun template n'est personnalisé : chaque modification part du code par défaut, se
   télécharge d'abord, puis se publie. Statut rouge = enregistré, vert = publié.
3. Les treize nouveaux templates sont autant de pages à styliser qui n'étaient pas au plan :
   la page « Dernières Images », le profil avancé, le mode Grid, les widgets de pied de page.
4. `viewcomments_body` ayant disparu, tout ce qui visait les forums Blog est à retirer du plan.

---

## 7. Fait le 1er octobre : les icônes dans `overall_header`

Une ligne ajoutée après `{CSS}` (ligne 23 du template), enregistrée et **publiée** :

```html
<link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Rounded:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&amp;display=block" rel="stylesheet"/>
```

Mêmes axes variables que la Outlined déjà chargée, plus `display=block` pour éviter que le
nom de la ligature (`menu_book`, `storefront`…) s'affiche en clair pendant le chargement.

Vérifié sur le forum : `document.fonts.check("400 24px 'Material Symbols Rounded'")` renvoie
`true` et la ligature `menu_book` fait bien 24 px de large, donc un glyphe et non neuf lettres.

`overall_header` est désormais le **seul** template personnalisé du forum. Pour revenir en
arrière : Affichage > Templates > Général > ligne `overall_header` > Supprimer.

### D'où viennent les deux autres polices Material

Pas du template, pas des codes JavaScript (les 18 ont été lus), pas du CSS principal (il est
**vide**), pas des feuilles additionnelles (il n'y en a aucune). Elles viennent donc du thème
installé. Au passage, une mécanique à retenir :

> **Forumactif remonte les `@import url(...)` d'une feuille CSS en balises `<link>` dans le
> `<head>`.** La feuille servie `/2-ltr.css` ne contient aucun `@import`, et pourtant les
> polices apparaissent en `<link>`. Les deux méthodes reviennent donc au même ; le `<link>`
> dans `overall_header` est simplement découvert plus tôt par le parseur.

Trois familles Material chargées pour un seul besoin, c'est deux de trop. Quand on remplacera
le CSS du thème, on garde **Material Symbols Rounded** et on laisse tomber Material Icons
(l'ancienne police, à ligatures `snake_case` elle aussi mais figée) et Material Symbols
Outlined. Ionicons v2 reste tant que les templates ModernBB s'en servent (`i.ion-*`).

---

## 8. Contraintes du compte, relevées le même jour

| Point | Constat | Conséquence |
|---|---|---|
| Package | **Gratuit** | la **Gestion du CSS additionnel** est réservée aux packages Avancé et Premium : 0 feuille disponible |
| CSS principal | **vide**, et il le reste | notre CSS ne vit pas là : il vit dans le dépôt `by-teenspirit/wild-mystery` et il est servi par jsDelivr, appelé par un `<link>` dans `overall_header`. Le plafond de ~65 000 caractères de la feuille du PA ne nous concerne donc pas |
| Codes JavaScript | **18 enregistrés, 17 actifs**, tous datés de 2020 à 2024 | ce sont les scripts de la V1 : `switcheero`, `toolbar`, `notifs2`, `boutique`, `bannières aléatoires`, `onglets profil`, `compteur de mots`, `mention facile`… La V2 les remplacera pour la plupart ; à trier avant d'ajouter les nôtres, la limite est de 80 |
| Espace de stockage | 20 Mo | les images lourdes passent par un hébergeur externe, pas par le forum |

### Où vit le code, et le partage entre les deux

**Le compliqué dans le dépôt, le simple dans le CSS du panneau d'administration.**

| | Le dépôt, servi par jsDelivr | Le CSS principal du PA |
|---|---|---|
| Quoi | la structure : dé-flottement, composants, grilles, responsive, états, tout le JS | les **jetons** : couleurs, polices, rayons, ombres, échelle d'espacement |
| Forme | des fichiers relus, formatés, passés au CI, livrés sur un tag | un seul bloc `:root { --wm-… }` |
| Qui y touche | une modification, un commit, une version | Callista, directement, sans rien livrer |
| Taille | sans limite utile | quelques dizaines de lignes |

Ce que le panneau d'administration contient, en tout et pour tout — deux lignes dans
`overall_header`, **après** `{T_HEAD_STYLESHEET}` pour passer devant le CSS de base de ModernBB :

```html
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/by-teenspirit/wild-mystery@<version>/css/wild-mystery.css">
<script defer src="https://cdn.jsdelivr.net/gh/by-teenspirit/wild-mystery@<version>/js/wild-mystery.js"></script>
```

### La règle qui fait tenir le partage

**Le dépôt ne définit jamais un jeton, il ne fait que s'en servir.**

```css
/* dépôt : css/wild-mystery.css */
.wm-carte { background: var(--wm-surface, #FFFBF7); border: 1px solid var(--wm-bord, #EADACD) }

/* PA : CSS principal, la seule chose qui s'y trouve */
:root {
  --wm-page:    #F2E4D8;
  --wm-surface: #FFFBF7;
  --wm-bord:    #EADACD;
  --wm-accent:  #2E6E8E;
  --wm-encre:   #2E2018;
}
```

Sans ça, les deux feuilles se disputeraient : la feuille du PA est servie par
`{T_HEAD_STYLESHEET}`, donc **avant** la nôtre, et perdrait toutes ses batailles à spécificité
égale. En ne définissant les jetons que d'un côté, il n'y a plus de bataille du tout : une
variable est résolue au moment où elle est lue, pas au moment où elle est déclarée.

Chaque jeton garde une **valeur de repli** dans le dépôt (`var(--wm-surface, #FFFBF7)`), pour que
le forum reste lisible si la feuille du PA est vidée par erreur.

Conséquence pratique : changer une couleur de la charte, c'est trente secondes dans le panneau
d'administration. Changer la mise en page, c'est un commit, une relecture et un tag.

### Les versions

**Jamais `@main`.** La leçon est déjà payée sur le projet ADWAD (`06-…` §1) : jsDelivr renvoie
une branche avec `Cache-Control: max-age=604800`, donc le navigateur des visiteurs garde le
fichier **sept jours**, et la purge ne vide que le CDN — elle est limitée à un appel toutes les
trente minutes environ, au-delà elle est ignorée en silence. Pire, repartir d'un `@main` périmé
pour reconstruire un fichier a déjà écrasé un commit entier.

- **On épingle toujours l'URL**, sur le SHA du commit en développement, sur le tag `vX.Y.Z` en
  production. Une URL épinglée est immuable : servie tout de suite, sans purge, sans attente.
- **Chaque livraison demande de remplacer les deux lignes à la main** dans `overall_header` : les
  templates sont réservés au fondateur et n'ont aucune API. Le CI les écrit dans le résumé du
  *run*, avec le bon tag, prêtes à coller.

Le quota de 80 scripts JavaScript du PA ne nous concerne pas : notre JS est un seul fichier servi
par jsDelivr. Les 18 scripts enregistrés sont ceux de la V1, à trier.
