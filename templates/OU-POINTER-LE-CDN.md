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

## Ce qu'il faut faire

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
