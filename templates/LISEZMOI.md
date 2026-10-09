# Les templates Forumactif

Un fichier par template, le nom exact du template, extension `.html`.

## Pourquoi ils sont là

Deux raisons, et la seconde n'était pas prévue.

**La copie d'origine.** La règle du 1er octobre : aucun template n'est modifié sans avoir
été téléchargé d'abord. Quand une modification casse une page, on remet celui-ci.

**Parce que le panneau ne se lit pas depuis le bac à sable.** Le source d'un template
contient les URL de Forumactif, qui portent un jeton de session. La lecture par l'outil est
refusée. Tant qu'un template n'est pas exporté ici, il est hors d'atteinte : on ne peut ni
le lire, ni proposer sa version flexbox.

## Comment on exporte

Panneau d'administration → **Affichage** → **Templates** → **Général** → le template →
bouton **Télécharger**. Le fichier arrive dans `Téléchargements` ; le déplacer ici sous son
nom de template.

## Comment on repose

On ne colle jamais un template sans le relire en entier. Et surtout :

> **Enregistrer ≠ Publier.** « Enregistrer » met le template en *En attente*, et le forum
> continue à servir l'ancienne version sans rien dire. Il faut revenir à la liste et cliquer
> **Publier**.

## Ceux qui comptent

| Template | t | Ce qu'il faut y faire |
|---|--:|---|
| `overall_header` | 116 | déjà repris : les polices, la feuille et le script |
| `index_body` | | **fait** : le bloc « qui est en ligne » devient une source nommée, voir `.nouveau.html` |
| `memberlist_body` | 113 | `table#memberlist.table1` → `ul`/`li` + flex |
| `viewtopic_body` | | l'ancrage du module de bilan, et le `<table>` du bloc de règles |
| `posting_body` | | le même bloc, le lanceur de dés, la case « je veux un MJ » |
| `index_box` | | **fait** : la pastille, la description enveloppée, la variable morte retirée |
| `topics_list_box` | | les lignes de sujet |
| `portal_body` | | quatre tableaux imbriqués |
| `groupcp_info_body` | | la page des groupes |

Le détail du remplacement de chacun est dans `49-zero-tableau-que-du-flexbox.md` §2.
