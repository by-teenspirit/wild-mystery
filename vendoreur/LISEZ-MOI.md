# vendoreur/

Du code qui n'est pas le nôtre, recopié tel quel dans le dépôt.

| Dossier | Paquet | Version | Source |
|---|---|---|---|
| `std-assert/` | `@std/assert` | 1.0.19 | [denoland/std](https://github.com/denoland/std), commit `f834d0223364361169314833e3c7a8f62ce11d58` (25 septembre 2026) |
| `std-internal/` | `@std/internal` | dépendance de `@std/assert` | idem |

## Pourquoi

Les tests importaient `jsr:@std/assert`. Le 2 octobre, `jsr.io` est devenu
injoignable depuis l'environnement où tourne le code : plus de registre, plus
de dépendance, plus un seul test exécutable. Un projet dont la suite de tests
cesse de tourner le jour où un registre tombe n'a pas vraiment de suite de tests.

Donc les deux paquets sont dans le dépôt. Conséquences, toutes voulues :

- `deno test` ne demande rien au réseau ;
- le CI non plus ;
- dans trois ans, le dépôt se construit encore, qu'un registre existe ou non.

## Ce qui a été changé dans les fichiers

Rien, sauf les chemins d'import. Les sources utilisent des specifiers nus
(`@std/internal/styles`) qu'aucun registre ne résout ici : ils ont été
réécrits en chemins relatifs (`../std-internal/styles.ts`). Les fichiers de
test des paquets eux-mêmes n'ont pas été recopiés : on teste notre code, pas
le leur.

`vendoreur/` est exclu de `deno fmt`, de `deno lint` et de `deno test` dans
`deno.json`. Ce n'est pas notre code : on ne le reformate pas, et une règle de
style à nous ne doit pas le faire échouer.

## Pour le remonter de version

Reprendre la version voulue depuis le dépôt `denoland/std`, recopier les
fichiers hors `*_test.ts`, réappliquer la réécriture des imports, mettre à jour
le tableau ci-dessus — et relancer toute la suite. Si elle passe, la montée est
bonne ; c'est tout l'intérêt d'avoir 130 tests.
