# Zéro tableau, que du flexbox

Règle posée par Callista le 1er octobre 2026 : **aucun tableau de mise en page dans Wild
Mystery, tout en flexbox.** Ce document dit où sont les tableaux dans ModernBB, ce qui les
remplace, et surtout où sont les mises en page qui ne sont pas des tableaux mais qui en
reproduisent le comportement.

---

## 1. Les deux problèmes, pas un seul

ModernBB ne pose pas un problème de `<table>`, il en pose deux.

**Le premier** : vingt templates contiennent encore un `<table>`. Ils sont listés au §2.

**Le second, plus gênant** : la mise en page du CSS de base tient sur des **flottants avec
largeurs en pourcentage**. 146 `float` contre 28 `flex`, et aucune grille. Une ligne de forum
n'est pas un tableau en HTML, mais c'en est un à l'écran :

```css
ul.topiclist dt, ul.topiclist dd.dterm { float:left; width:52%; padding:18px }
dd.posts, dd.topics, dd.views          { width:8%;  text-align:center }
dd.lastpost                            { width:32%; padding:18px !important }
.postprofile                           { float:right; width:211px }
.portal .column:first-child            { float:left }
.portal .column:last-child             { float:right }
```

Et par-dessus, la couche responsive `.modern-resp` ne réorganise rien : elle **masque** les
colonnes et repasse les deux survivantes à `width:100%`.

```css
.modern-resp .forabg .row dd.posts,
.modern-resp .forabg .row dd.topics  { display:none }
.modern-resp .forabg .row dd.dterm   { width:100%; float:left; padding-left:81px !important }
```

Remplacer les `<table>` sans toucher à ça ne donnerait rien : on aurait des div qui se
comportent comme des cellules. Les deux chantiers vont ensemble.

---

## 2. Les vingt templates qui contiennent un `<table>`

| Template | Ce que le tableau fait | Priorité | Remplacement |
|---|---|---|---|
| `viewtopic_body` | `table.postbody` du bloc **règles du forum** : image + texte, deux cellules | **haute** | une ligne flex : `.logo` en `flex:0 0 auto`, `.rules` en `flex:1` |
| `posting_body` | le même bloc règles, plus `table#list_dice` (lanceur de dés) | **haute** | idem ; le lanceur de dés devient une colonne flex |
| `portal_body` | quatre tableaux imbriqués pour les trois colonnes de widgets | **haute** | un `display:flex` sur le conteneur, une colonne par `div`, `gap` au lieu des `td height={SPACE_ROW}` |
| `memberlist_body` | `table#memberlist.table1`, la liste des membres | **haute** | données vraiment tabulaires : on garde la sémantique en `ul`/`li` + flex, une ligne par membre |
| `modcp_body` | panneau de modération | moyenne | liste flex |
| `viewonline_body` | qui est en ligne | moyenne | liste flex |
| `groupcp_info_body` | membres d'un groupe | moyenne | liste flex — page des groupes, maquette planche 09 |
| `groupcp_pending_info` | demandes en attente | basse | liste flex |
| `calendar_box` | la grille du calendrier | basse | un vrai calendrier : `flex-wrap` par semaines de sept, ou on laisse |
| `calendar_scheduler_body` | journée du calendrier, deux tableaux | basse | idem |
| `birthday_list_box` | anniversaires | basse | liste flex |
| `mod_most_active_topics` | widget, lignes de sujets | basse | liste flex |
| `mod_most_viewed_topics` | widget, lignes de sujets | basse | liste flex |
| `modcp_viewip` | trois tableaux d'adresses IP | basse | hors jeu, page de modération |
| `report_list_body` | rapports d'alerte | basse | hors jeu |
| `report_view_body` | détail d'un rapport | basse | hors jeu |
| `album_cat_top10` | statistiques de la galerie | nulle | galerie non utilisée |
| `album_modcp_body` | modération de la galerie | nulle | idem |
| `album_moderate_body` | modération générale, dont un tableau **écrit en JS** (`element.innerHTML`) | nulle | idem |
| `album_search_body` | résultats de recherche galerie | nulle | idem |

« Priorité nulle » veut dire : la galerie n'est pas utilisée par le forum, on ne touche pas
ces templates. S'ils réapparaissent, la règle s'appliquera.

---

## 3. Ce qui remplace les flottants

### 3.1 Une ligne de forum ou de sujet

```css
/* on neutralise les flottants et les pourcentages du CSS de base */
ul.topiclist li.row dl.icon,
ul.topiclist li.header dl.icon {
  display: flex;
  align-items: center;
  gap: 18px;
}
ul.topiclist dt,
ul.topiclist dd.dterm   { float: none; width: auto; flex: 1 1 auto; min-width: 0; padding: 18px }
ul.topiclist dd         { float: none; padding: 0 }
dd.topics, dd.posts, dd.views { width: auto; flex: 0 0 56px; text-align: center }
dd.lastpost             { width: auto !important; flex: 0 0 220px; padding: 0 18px !important }
```

`min-width:0` sur la cellule qui s'étire : sans ça, un titre long déborde au lieu de se
tronquer. C'est le piège classique du flex.

### 3.2 Le responsive, par wrap et non par masquage

On remplace les `display:none` de `.modern-resp` par un vrai repli :

```css
@media (max-width: 740px) {
  ul.topiclist li.row dl.icon { flex-wrap: wrap }
  ul.topiclist dd.dterm       { flex: 1 1 100%; padding-left: 18px !important }
  dd.topics, dd.posts, dd.views { display: inline-flex; flex: 0 0 auto }
  dd.lastpost                 { flex: 1 1 100% }
}
```

Les chiffres restent lisibles sur mobile au lieu de disparaître. Les points de rupture du CSS
de base sont 1200, 900, 800, 740, 700, 400 et 320 px : on s'aligne dessus plutôt que d'en
inventer.

### 3.3 Un message

```css
div[class*="post--"] { display: flex; align-items: flex-start; gap: 18px }
.postprofile  { float: none; width: 211px; flex: 0 0 211px }
.postbody     { flex: 1 1 auto; min-width: 0 }
.post-head    { flex: 1 1 100% }   /* la tête passe au-dessus des deux colonnes */
```

Attention : dans le template, `.post-head` est entre `.postprofile` et `.postbody`. En flex
avec un `order`, on choisit librement la fiche à gauche ou à droite sans toucher au HTML.

### 3.4 Le portail et le pied de page

`#footer_widgets` et `.container-imgs-list` sont **déjà en flex** dans le CSS de base : rien à
faire. Seul `.portal .column` est encore en flottant, et son `width` arrive en style inline
(`{column.WIDTH}`), donc :

```css
.portal, #footer_widgets { display: flex; gap: 12px }
.portal .column { float: none !important; width: auto !important; flex: 1 1 0; padding: 0 }
```

---

## 4. Les règles qu'on se donne

1. **Aucun `<table>` écrit par nous**, ni dans un template, ni dans une annexe, ni dans un
   message posté. Les fiches HTML que les comptes principaux postent suivent la même règle.
2. **Aucun `float` écrit par nous**, et aucun `display:inline-block` utilisé pour faire une
   colonne.
3. **Pas de `display:table` ni `table-cell`** : c'est un tableau déguisé, c'est pire.
4. `grid` est autorisé là où c'est vraiment une grille à deux dimensions — la carte de Rhode,
   le Pokédex, les vignettes de zones. Pour une ligne ou une colonne, c'est `flex`.
5. Sur chaque élément flex qui s'étire et contient du texte : `min-width:0`.
6. Les espacements se font au `gap`, pas en marges ni en cellules vides. Les
   `<td height="{SPACE_ROW}">` du portail disparaissent avec le tableau.
7. Quand un template ModernBB impose un style inline, on l'écrase en CSS avec `!important` et
   on le note. On ne retire pas la variable : elle sert au JS Forumactif.

---

## 5. Où ça s'applique dans le code

| Fichier | Ce qu'il porte |
|---|---|
| `css/wild-mystery.css` | les écrasements de §3, groupés dans une section « dé-flottement » en tête de fichier |
| templates à reprendre | `viewtopic_body`, `posting_body`, `portal_body`, `memberlist_body`, `groupcp_info_body`, `topics_list_box`, `index_box` |
| à ne pas toucher | les quatre templates de galerie, les deux de rapports, `modcp_viewip` |

L'ordre : d'abord la section de dé-flottement dans le CSS, qui se vérifie à l'œil sur le forum
sans toucher à un seul template. Ensuite les sept templates, un par un, chacun téléchargé
avant modification.
