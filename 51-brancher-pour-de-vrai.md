# Arrêter de faire du faux : brancher la première tranche

Écrit le 2 octobre 2026, en réponse à une bonne question : *comment on fait pour ne pas
faire de « fausses » choses mais réellement tout mettre en place ?*

---

## 1. L'inventaire honnête

| | État |
|---|---|
| Le domaine (barème, clôture, tirage, codes) | **vrai**, 102 tests, 100 % de couverture. Il ne dépend de rien, donc il est déjà fini. |
| Le schéma SQL | **vrai**, il monte sur un PostgreSQL 16 vierge sans une erreur, et 24 assertions pgTAP passent. Mais il n'a jamais été poussé sur un vrai projet Supabase. |
| Les adaptateurs en mémoire | **faux par construction**, et c'est leur raison d'être : ils tiennent la place du vrai pendant qu'on écrit le reste. |
| L'adaptateur de lecture Forumactif | **vrai**, et testé sur une page relevée sur ton forum le 2 octobre. |
| L'adaptateur Supabase | n'existe pas |
| L'adaptateur d'écriture Forumactif | n'existe pas |
| La fonction Edge | n'existe pas |
| Le dépôt GitHub | rien n'a jamais été poussé, aucun CI n'a jamais tourné |
| Les secrets, le compte de publication | n'existent pas |

Autrement dit : **les pièces sont vraies, le circuit n'existe pas.** Rien de ce qui est
écrit n'a jamais touché une vraie base, une vraie fonction, ni ton vrai forum.

## 2. Pourquoi c'est un risque, et pas juste « il reste du travail »

Construire couche par couche jusqu'au bout avant de brancher, c'est découvrir à la fin que
la forme était fausse depuis le début. On en a eu deux exemples **aujourd'hui**, et les deux
venaient d'avoir regardé le vrai forum plutôt que de l'imaginer :

- Forumactif **glisse des blocs de publicité au milieu des sujets**, avec la même classe
  `post` que les messages. Un parseur écrit sans les avoir vus aurait inscrit des lignes de
  registre pour une régie publicitaire.
- Les dates affichées sont **« Lun 6 Sep - 10:21 », sans année**. Toute la relève était
  prévue « depuis la dernière date » : impossible. Elle marche maintenant par identifiants
  de message, qui ne reculent jamais. C'est plus simple et plus solide, mais il a fallu
  aller voir.

Il y en aura d'autres. La seule façon de les trouver tôt est de traverser tout le circuit
une fois, le plus petit possible.

## 3. La tranche verticale minimale

Pas une couche de plus : **une seule chose, qui va d'un bout à l'autre.**

> Un message est posté dans une zone sauvage. Cinq minutes plus tard, une ligne existe dans
> la vraie base. Le module l'affiche au-dessus du premier message du sujet.

Rien d'autre. Pas de clôture, pas de boutique, pas de pension, pas de combat. Ce que ça
prouve, et qu'aucun test ne peut prouver à sa place :

1. la fonction Edge arrive à lire ton forum en visiteur ;
2. le parseur tient sur de vraies pages, pas sur une page choisie ;
3. la base accepte l'écriture, et les règles d'accès laissent passer la bonne personne ;
4. le navigateur lit ce que le serveur a écrit ;
5. la chaîne de livraison marche : un tag, une version de fichier, deux lignes dans
   `overall_header`.

Si ces cinq-là tiennent, tout le reste du jeu n'est que de la logique métier posée dessus.
Si l'une lâche, mieux vaut le savoir maintenant que dans trois semaines.

C'est exactement ce que disait déjà `27-securite-de-l-automatisation.md` §6. On ne l'a pas
suivi, et c'est ce qui nous a menés ici.

## 4. Ce qu'il me faut de toi — quatre choses, aucune n'est longue

| | Quoi | Pourquoi |
|---|---|---|
| 1 | **Un projet Supabase**, et son URL + la clé publique | sans ça, le schéma reste un fichier. Si tu en as déjà un, il me faut juste de quoi m'y connecter |
| 2 | **Un compte Forumactif dédié à la publication** — ni le fondateur, ni un personnage joué | pour que son mot de passe puisse tourner sans toucher à tes accès ni à tes RP |
| 3 | **Le dépôt `by-teenspirit/wild-mystery` ouvert en écriture**, ou bien tu pousses toi-même ce que je te livre | aujourd'hui je te donne un zip, et un zip ne déclenche aucun CI |
| 4 | **Les identifiants des dix-sept forums de zones sauvages** | `data/zones.json` en dépend, et c'est lui qui décide où le module s'affiche. Je peux les relever moi-même sur le forum si tu préfères |

Les secrets, tu les poseras toi-même dans Supabase : je ne dois jamais les voir.

## 5. Ce que je fais sans attendre

- L'adaptateur d'écriture Forumactif : la connexion du compte de publication et l'envoi
  d'une réponse. C'est la pièce la plus incertaine, autant la regarder tôt.
- `data/zones.json`, relevé sur le forum.
- Le passage de `cloturer()` à `appliquer_cloture()`, et la colonne `auth_id`.
- L'adaptateur Supabase, qui devra passer la **même suite de contrat** que le faux.

---

## 6. Ce que la vraie page nous a appris

Relevé le 2 octobre sur `/t813-petites-annonces`, en visiteur non connecté.

| Ce qu'on cherchait | Où c'est, pour de vrai |
|---|---|
| L'identifiant d'un message | `<div id="p12485" class="post … post--12485">` |
| L'auteur | `.postprofile-avatar[data-id="3"]` — un attribut, pas un lien |
| Le pseudo | `.postprofile-name strong` |
| **Le groupe du membre** | `post-group-2` sur le message, et `span.group-2` sur le pseudo |
| La publicité déguisée en message | `id="p0"` et `data-id="-2"`, pseudo « Contenu sponsorisé » |
| La date | « Lun 6 Sep - 10:21 », **sans année : inutilisable** |
| Le dernier message d'un sujet | `href="/t813-…#15263"` sur la page du forum et sur l'index |

**Le groupe est lisible par le serveur.** C'est le mur de `_userdata` qui tombe à moitié :
le navigateur ne connaît pas les groupes du visiteur, mais le serveur les lit sur chaque
message qu'il relit. La synchronisation du palier (tâche 6 de la relève) n'a donc plus
besoin d'aller chercher `/uN` : l'information est déjà dans la page du sujet.

**Le marqueur ne sera pas du HTML.** Un message traverse l'éditeur, le BBCode, le nettoyage
des balises et la version mobile. Une balise `<span data-…>` peut ne pas survivre à tout
ça. Du texte, si. D'où la forme retenue :

```
[[WM:<charge en base64url>:<CODE>]]
```

Le serveur ne lit jamais la prose du joueur, seulement ses propres marqueurs. Et si le
JavaScript est coupé, le joueur voit le marqueur : ce n'est pas un défaut, c'est la pièce
justificative de ce qui lui a été accordé.
