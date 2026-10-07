# Pourquoi le forum sert du CSS vieux de trois jours

**Relevé le 6 octobre 2026**, en cherchant pourquoi `/h3-reglement` s'affichait sans gabarit.

## Ce qui se passe

`overall_header` pointe sur une **branche** :

```
https://cdn.jsdelivr.net/gh/by-teenspirit/wild-mystery@socle-v2/css/wild-mystery.css
```

Mesuré à l'instant : cette adresse servait **36 ko de CSS et 7,8 ko de JS**, alors que le
dépôt en contient **121 et 31**. Le même fichier, épinglé au commit, était juste :

| Adresse | CSS | JS |
|---|---|---|
| `@socle-v2` (branche) | 36 ko, pas de gabarit | 7,8 ko, pas de sommaire |
| `@cb34f4a…` (commit) | **121 ko, gabarit présent** | **31 ko, sommaire présent** |

**Et la purge n'y change rien.** Les trois formes ont été essayées, avec une vraie purge
(`"providers":{"CF":true,"FY":true}`, `"throttled":false`) :

- `purge.jsdelivr.net/gh/…@socle-v2/css/wild-mystery.css`
- `purge.jsdelivr.net/gh/…@socle-v2/`
- `purge.jsdelivr.net/gh/…@socle-v2`

Après chacune, l'adresse de branche servait toujours les 36 ko.

## Pourquoi

jsDelivr **résout une branche vers un commit, et garde cette résolution**. Purger un chemin
vide le fichier ; ça ne refait pas la résolution de la branche. Un chemin **nouveau** passe
(c'est pour ça que `data/annexes.json`, créé le jour même, arrivait bien) ; un chemin qui
existait déjà reste figé sur l'ancien commit.

**C'est la vraie explication des « deux jours d'attente » et du « compte jusqu'à dix ».** Ce
n'était pas un CDN froid, c'était un alias de branche qui ne bougeait pas.

## Ce qu'on a fait d'abord : un tag

**Ne plus servir une branche. Servir un tag.** jsDelivr traite un tag comme immuable : il le
sert tout de suite, et il n'y a plus jamais rien à purger.

Dans `overall_header`, remplacer les deux adresses :

```html
<!-- AVANT — une branche, donc un alias qui se fige -->
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/by-teenspirit/wild-mystery@socle-v2/css/wild-mystery.css">
<script src="https://cdn.jsdelivr.net/gh/by-teenspirit/wild-mystery@socle-v2/js/wild-mystery.js"></script>

<!-- APRÈS — un tag, servi immédiatement -->
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/by-teenspirit/wild-mystery@v2.1.0/css/wild-mystery.css">
<script src="https://cdn.jsdelivr.net/gh/by-teenspirit/wild-mystery@v2.1.0/js/wild-mystery.js"></script>
```

Et à chaque livraison :

```bash
git tag v2.1.0 && git push origin v2.1.0
```

puis changer le numéro aux deux lignes du template. **Trois gestes, et plus aucune purge.**

En prime, le template dit alors **ce qui est en ligne** : aujourd'hui, personne ne peut le
savoir en le lisant.

## Ce qu'on fait maintenant : GitHub Pages

**Relevé le 7 octobre**, après quatre tags en deux jours.

Le tag marche, mais il fait payer trois gestes **à chaque correction**, y compris à celles
d'une ligne. Ça ne tient pas : on finit par ne plus corriger.

GitHub Pages sert le même dépôt, à une adresse **qui ne change jamais** :

```html
<link rel="stylesheet" href="https://by-teenspirit.github.io/wild-mystery/css/wild-mystery.css">
<script src="https://by-teenspirit.github.io/wild-mystery/js/wild-mystery.js"></script>
```

Un `git push`, et c'est en ligne. Pas de tag, pas de purge, pas de numéro à reporter.

**Pourquoi ça ne refait pas le même piège.** jsDelivr fige la *résolution* d'une branche :
rien ne l'expire, d'où les trois jours. Pages met un `Cache-Control: max-age=600` — mesuré
le 7 octobre — donc **dix minutes au pire, et ça s'expire tout seul**. Un cache qui tourne
n'est pas un alias qui se fige.

Les deux points vérifiés avant de basculer :

- **CORS** : Pages répond `Access-Control-Allow-Origin: *`. Il le faut, parce que
  `js/wild-mystery.js` va chercher `data/*.json` depuis le domaine du forum. Vérifié par un
  `fetch` croisé depuis `mysteryinrhode.forumactif.com` : lisible, donc autorisé.
- **`racineDesDonnees`** ne change pas : elle déduit `…/data/` de `currentScript.src`, quelle
  que soit la machine qui sert.

**À activer une fois**, dans `Settings → Pages` du dépôt : source `Deploy from a branch`,
branche **`socle-v2`**, dossier **`/ (root)`**. Le `.nojekyll` à la racine est là pour que
Pages serve les fichiers tels quels au lieu de les passer par Jekyll.

### Ce qu'on perd, et c'est assumé

Un tag est un **verrou** : tant qu'on ne le bouge pas, les joueurs voient une version figée.
Avec Pages, **un `push` est en ligne** — une étourderie casse le forum tout de suite.

Ce qui tient lieu de garde-corps : la chaîne tourne à chaque poussée (600 tests, garde-fou,
contraste, le harnais de navigation), et la réparation est un `push`, pas une purge.

### Le tag garde un rôle

Il déclenche toujours le **déploiement Supabase** — migrations et fonctions Edge. Ça, ça
mérite un geste délibéré, et ça n'a rien à voir avec la vitesse d'affichage d'un CSS.

## Le dépannage immédiat

En attendant de reprendre `overall_header`, un commit épinglé marche tout de suite :

```
https://cdn.jsdelivr.net/gh/by-teenspirit/wild-mystery@cb34f4a3e9c54fa5c199978f4b5ec57a2b97932f/css/wild-mystery.css
```

C'est moche à lire, mais c'est servi à la seconde.

## Ce qu'il ne faut pas faire

- **Ajouter `?v=2` à l'adresse** : jsDelivr rend **503** sur un paramètre de requête.
- **Se fier à `"status":"finished"`** : une purge sans effet rend ça aussi. Ce qui compte est
  `"providers":{"CF":true,"FY":true}` — et même ça n'a pas suffi ici.
- **Attendre.** Trois jours ont déjà été attendus.
