# L'architecture du code — Wild Mystery

Trois exigences posées par Callista le 1er octobre : **des tests pour chaque chose, aucun
test qui contourne le code, une architecture propre et SOLID, un CI/CD propre.**

Ce document dit comment, et sert de contrat : une revue de code se fait contre lui.

---

## 1. La règle de dépendance

Trois couches, et **les flèches ne pointent que vers l'intérieur**.

```
        ┌──────────────────────────────────────────────┐
        │  adaptateurs   forumactif/  supabase/  http/ │   ← je parle au monde
        ├──────────────────────────────────────────────┤
        │  application   cas-usage/                    │   ← j'orchestre
        ├──────────────────────────────────────────────┤
        │  domaine       règles pures, zéro import     │   ← je décide
        └──────────────────────────────────────────────┘
```

**`domaine/` n'importe rien.** Ni Supabase, ni `fetch`, ni `Deno`, ni l'horloge. Des
fonctions pures : mêmes entrées, mêmes sorties, toujours. C'est là que vivent le barème
d'XP, les seuils de niveau, le rejeu du registre à la clôture, le tirage d'une rencontre.

**`application/` dépend du domaine et des ports, jamais d'un adaptateur.** Un cas d'usage
reçoit ses dépendances par son constructeur. Il ne sait pas s'il parle à Postgres ou à un
tableau en mémoire.

**`adaptateurs/` implémente les ports.** C'est la seule couche qui connaisse Forumactif,
Supabase, le réseau et le temps qui passe.

Le fichier `supabase/functions/releve/index.ts` est la **racine de composition** : le seul
endroit du projet où on écrit `new ForumactifAdapter(...)`. Il ne contient aucune règle.

---

## 2. SOLID, concrètement

| | Ce que ça donne ici |
|---|---|
| **S** · une responsabilité | `ClôturerUnSujet` clôture. Il ne lit pas le forum, ne poste pas, ne calcule pas l'XP : il appelle le domaine et les ports. |
| **O** · ouvert/fermé | Ajouter un type d'événement au registre, c'est ajouter un cas au domaine et un test. Aucun cas d'usage n'est modifié. |
| **L** · substitution | `RegistreEnMémoire` et `RegistreSupabase` passent **la même suite de tests de contrat**. L'un remplace l'autre partout, sans surprise. |
| **I** · interfaces fines | `LecteurDeForum` et `PosteurSurForum` sont deux ports séparés. La relève lit et poste ; un futur outil de vérification ne fera que lire, et n'aura pas à feindre de savoir poster. |
| **D** · inversion | `ClôturerUnSujet` dépend de l'interface `Registre`, pas de la classe Supabase. C'est la racine de composition qui choisit. |

---

## 3. Les tests

### Ce qu'on ne fait pas

**Aucun test ne contourne le code qu'il teste.** Trois interdits :

- pas de `--no-check`, pas de `as any`, pas de `@ts-ignore` dans les tests ;
- pas de test qui réimplémente la règle qu'il vérifie (si le test recalcule le barème d'XP
  pour le comparer au code, il ne teste rien) ;
- pas de bouchon qui court-circuite une règle métier. Un faux adaptateur remplace une
  **base de données**, jamais une **décision**.

Les deux premiers sont vérifiés mécaniquement par `outils/garde-fou.sh`, qui refuse aussi
ce que la règle de dépendance interdit. **Neuf contrôles**, et chacun a été testé en le
cassant exprès — un garde-fou qu'on n'a jamais vu refuser ne prouve rien.

| | Ce qu'il refuse |
|---|---|
| 1 | `as any` ou `@ts-ignore` dans un fichier de test |
| 2 | `--no-check` n'importe où dans la configuration |
| 3 | un fichier de `domaine/` ou d'`application/` sans son `.test.ts` à côté |
| 4 | un import extérieur, un `Deno.`, un `fetch`, une horloge dans `domaine/` ; un import d'adaptateur dans `application/` ; un `new …Supabase()` ailleurs qu'à la racine de composition |
| 5 | un `document.`, un `localStorage`, un `fetch(` dans `src/navigateur/` — c'est le domaine du navigateur, pas son adaptateur |
| 6 | un paquet de navigateur sans enveloppe. Sans `--format iife`, chaque variable de premier niveau devient une globale de page, et Forumactif en tient déjà une qui s'appelle `j` |
| 7 | une feuille qui **définit** un jeton `--wm-`, un `@import`, un `url(` ; et une feuille assemblée qui ne correspond pas à ses sources |
| 8 | un `js/wild-mystery.js` qui ne correspond pas à ses sources — il est servi depuis le dépôt, et il est minifié, donc le décalage est invisible |
| 9 | un `data/especes.json` qui ne suit plus les tables de faune, ou deux tables qui donnent deux noms au même identifiant |

Les règles 7, 8 et 9 ont la même raison d'être : **trois fichiers sont livrés depuis le
dépôt alors qu'ils sont dérivés d'autres fichiers du dépôt.** Un dérivé périmé ne casse
rien — il sert simplement une version que personne n'a relue.

Le troisième interdit, lui, ne se vérifie pas par `grep` : il se vérifie en relecture, et
c'est à ça que sert ce document.

### Les quatre étages

**Tests de domaine** — aucune dépendance, aucun bouchon. Ils énoncent le barème en dur, à la
main, à partir de l'annexe, et vérifient que le code tombe dessus. C'est l'annexe 08 qui est
la source de vérité, pas le code.

**Tests de cas d'usage** — avec des adaptateurs en mémoire. Ils vérifient l'orchestration :
qu'une clôture incomplète ne verse rien, qu'un message déjà lu ne produit pas de doublon.

**Tests de contrat** — le même fichier de tests tourne contre `RegistreEnMémoire` **et**
contre `RegistreSupabase` branché sur un Postgres de CI. C'est ce qui empêche le faux de
mentir : s'ils divergent, le CI casse. Sans ça, les tests de cas d'usage ne prouveraient
rien du vrai système.

**Tests SQL (pgTAP)** — les garanties qui vivent dans la base sont testées dans la base :
l'unicité `(message_id, type)`, le refus d'écrire dans un sujet clos, les six pokémon
maximum en équipe, les deux dépôts en pension. Ces règles ne sont pas en TypeScript, donc
elles ne sont pas testées en TypeScript.

### Ce qu'on exige

- **Couverture du `domaine/` : 100 %, lignes, fonctions et branches.** C'est faisable,
  puisqu'il est pur, et c'est là que sont toutes les décisions. `outils/couverture.sh` lit
  le `lcov` plutôt que le tableau de `deno coverage`, qui arrondit, et nomme chaque trou.
  Conséquence directe : une branche morte fait échouer le CI, donc on ne garde pas de
  `throw` « inatteignable » pour rassurer. Si un cas ne peut pas arriver, on écrit le code
  pour qu'il ne puisse pas s'écrire.
- Le reste suit, sans seuil chiffré : un seuil global pousse à écrire des tests inutiles.
- Chaque correction de bogue commence par un test qui échoue.

---

## 4. L'arborescence

```
deno.json                       une seule version de @std, dans imports
.gitignore                      .env et .env.local, avant le premier commit
ARCHITECTURE.md                 ce document
outils/
├─ garde-fou.sh                 les neuf refus du §3
└─ couverture.sh                100 % du domaine, lu dans le lcov
src/
├─ domaine/                     aucun import extérieur
│   ├─ experience.ts            barème, seuils, montées de niveau        ✓ écrit
│   ├─ experience.test.ts                                               ✓ 15 tests
│   ├─ cloture.ts               le rejeu du registre, ce qui manque      ✓ écrit
│   ├─ cloture.test.ts                                                  ✓ 13 tests
│   ├─ rencontre.ts             le tirage, déterministe à graine         · à faire
│   └─ rencontre.test.ts                                                · à faire
├─ application/
│   ├─ ports.ts                 les interfaces, et rien d'autre          ✓
│   ├─ cloturer-un-sujet.ts
│   ├─ cloturer-un-sujet.test.ts
│   └─ servir-une-commande.ts
├─ adaptateurs/
│   ├─ forumactif/              lecture réelle du forum, marqueurs       ✓ écrit
│   ├─ faune/                   les tables, lues dans data/              ✓ 28 tests
│   ├─ supabase/                registre, clôture, état, journal, verrou ✓ 57 tests
│   ├─ systeme/                 horloge et signature HMAC                ✓ 10 tests
│   └─ en-memoire/              les faux, soumis aux tests de contrat    ✓ écrit
└─ contrat/
    ├─ registre.contrat.ts      la suite partagée par les deux implémentations
    ├─ registre.en-memoire.test.ts                                      ✓ 12 essais
    ├─ registre.supabase.test.ts  les mêmes, sur un vrai Postgres        ✓ 12 essais
    ├─ cloture.supabase.test.ts   le trajet complet, sur un vrai Postgres ✓ 5 essais
    └─ appel-psql.ts            le harnais, sans dépendance (§10)

vendoreur/                      @std/assert recopié — voir §8 et son LISEZ-MOI

supabase/
├─ migrations/                  numérotées, appliquées dans l'ordre
│   ├─ 0001_socle.sql           tables, types, index, déclencheurs       ✓
│   ├─ 0002_services.sql        boutique, pension, fossiles, pokédex     ✓
│   ├─ 0003_registre.sql        les quatre opérations du port Registre   ✓
│   └─ 0004_identite_et_cloture.sql  auth_id, appliquer_cloture          ✓
├─ tests/garanties.sql          ✓ 69 assertions pgTAP, toutes vertes
└─ functions/releve/index.ts    racine de composition, zéro règle        ✓ écrit

.github/workflows/ci.yml        les six travaux du §5
```

### Les commandes

```
deno task verif        fmt, lint, check, garde-fou
deno task test         les tests du domaine
deno task couverture   les mêmes, avec l'exigence de 100 %
deno task test:tout    toute la suite

# le contrat contre une vraie base : sans ces deux variables il s'ignore,
# et le dit à voix haute
CONTRAT_CIBLE=postgres CONTRAT_PGURL="postgres://…" deno task test:contrat

pg_prove --ext .sql -d "$PGURL" supabase/tests/
```

---

## 5. Le CI/CD

Une seule chaîne, dans `.github/workflows/ci.yml`, et **rien ne se déploie sans elle**.
Six travaux, les cinq premiers en parallèle.

| Travail | Ce qu'il refuse |
|---|---|
| **forme** | du code mal formaté, un piège de `deno lint`, un type qui ne tient pas, une faute du garde-fou |
| **domaine** | une règle cassée, ou un bout de domaine que personne ne teste |
| **usage** | une orchestration cassée |
| **contrat** (matrice ×2) | un faux adaptateur qui a divergé du vrai : la même suite tourne contre `en-memoire/`, puis contre `supabase/` branché sur un Postgres 16 de service |
| **base** | une garantie de base qui a sauté — pgTAP, dans la base, sur le vrai schéma |
| **deploiement** | de partir sans que les cinq autres soient verts |

Les deux étapes `usage` et `contrat` posent un avertissement visible tant que leurs dossiers
sont vides, au lieu de passer en silence : le CI dit lui-même ce qui n'est pas encore écrit.

Le déploiement ne part **que sur un tag `v*`**, et dans cet ordre :

1. `supabase db push` — les migrations SQL d'abord, les fonctions Edge en dépendent ;
2. `supabase functions deploy releve` ;
3. le résumé du *run* affiche les deux lignes à coller dans `overall_header`, avec le tag
   dedans. jsDelivr sert un tag, donc l'URL est immuable et il n'y a rien à purger — mais
   les templates Forumactif sont réservés au fondateur et n'ont aucune API, donc cette
   dernière marche se fait à la main. Le CI prépare le copier-coller, il ne le pose pas.

Si une étape échoue, les suivantes ne partent pas.

Les secrets ne vivent que dans les *secrets* du dépôt GitHub (`SUPABASE_ACCESS_TOKEN`,
`SUPABASE_DB_PASSWORD`, `SUPABASE_PROJECT_REF`) et dans Supabase. Les trois secrets du
compte de publication — `FORUM_URL`, `FORUM_COMPTE`, `FORUM_MOTDEPASSE` — ne passent
jamais par GitHub : ils sont posés à la main dans Supabase › Edge Functions › Secrets.
Aucune étape du CI ne les lit ni ne les écrit dans un journal.

---

## 6. Ce que ça change pour ce qui est déjà écrit

`forum.ts` et `releve.ts`, écrits avant cette décision, **ne respectent pas ce contrat** :
ils lisent `Deno.env` au chargement, appellent `fetch` directement et mélangent les règles
et l'orchestration. Ils sont donc intestables tels quels.

Ils seront redécoupés : la lecture du forum devient `adaptateurs/forumactif/`, les huit
tâches deviennent huit cas d'usage, et les décisions qu'ils contiennent remontent dans
`domaine/`. Le schéma SQL et les fonctions, eux, restent valables : ils étaient déjà à
leur place.

Une correction au passage : la colonne `joueur.clan` est devenue `joueur.groupe`. Ce sont
des groupes, et une assertion pgTAP le vérifie (`hasnt_column('joueur','clan')`) pour que
le mot ne revienne pas par la fenêtre.

---

## 7. Qui décide, qui applique — décision du 2 octobre

En écrivant `cloturer-un-sujet.ts`, une duplication est apparue : le domaine calcule déjà le
verdict d'une clôture (`evaluerCloture`), et la fonction SQL `cloturer()` le recalculait pour
pouvoir refuser. La même règle à deux endroits, dans deux langages, c'est la garantie qu'un jour
les deux ne diront plus la même chose.

**Le partage retenu :**

| | Qui |
|---|---|
| Décider si une clôture passe, et ce qu'elle verse | le **domaine**, une seule fois, et le navigateur s'en sert aussi pour afficher le bilan en cours |
| Appliquer, en une transaction | la **base** |
| Empêcher l'absurde malgré tout | les **contraintes** de la base : stock positif, six en équipe, solde positif |

Les contraintes sont un **filet**, pas la règle. Si l'une d'elles se déclenche, c'est que le
domaine et la base ont divergé : la transaction tombe, rien n'est versé, rien n'est posté, et la
relève repassera. Le cas est testé (`si la base refuse, on ne poste rien`).

**Conséquence à appliquer dans `supabase/fonctions.sql`** : `cloturer(p_sujet, p_joueur, p_code)`
devient `appliquer_cloture(p_sujet, p_versements jsonb, p_code)`. Elle ne vérifie plus, elle
verse. Le `CLOTURE_INCOMPLETE` disparaît, puisque le refus est décidé avant et posté par le cas
d'usage. C'est la prochaine modification du schéma, avec la colonne `auth_id`.

---

## 8. Zéro dépendance au réseau — décision du 2 octobre

Les tests importaient `jsr:@std/assert`. Ce jour-là, `jsr.io` est devenu injoignable depuis
l'environnement de travail : plus de registre, plus de dépendance, plus un seul test
exécutable. Le code n'avait pas changé d'une ligne.

`@std/assert` et sa dépendance `@std/internal` sont donc recopiés dans `vendoreur/`, à leur
version publiée, commit noté. `deno.json` les résout par chemin relatif. Le détail est dans
`vendoreur/LISEZ-MOI.md`.

**La règle qui en sort : rien, dans ce dépôt, ne dépend du réseau pour se construire ou se
tester.** Elle vaut pour la suite — une nouvelle dépendance se recopie ou ne rentre pas. Ce
n'est pas une précaution de confort : une suite de tests qui s'arrête quand un registre
tombe ne protège de rien, et c'est précisément le jour où tout casse qu'on a besoin d'elle.

Le CI y gagne aussi : aucune étape ne télécharge quoi que ce soit. `vendoreur/` est exclu de
`fmt`, de `lint` et de `test` — ce n'est pas notre code.

---

## 9. Ce que les données réelles ont corrigé — 2 octobre

Le port `Faune` disait `tableDe(forumId, condition)`. Les fichiers relevés sur le forum disent
autre chose : une zone n'a pas *une* table par condition, elle a une quinzaine de **lieux**, et
chaque lieu a ses tables par condition. Dix-sept zones, cent quarante-cinq lieux, deux cent
quatre-vingt-dix-huit tables.

Le port a donc changé, et pas les données. C'est le sens de la marche : l'interface se déduit de
ce qui existe, jamais l'inverse.

Deux choix de l'adaptateur `FauneEnFichiers` méritent d'être écrits ici :

- **Il ne lit pas les fichiers lui-même**, il reçoit une fonction de lecture. Le même adaptateur
  sert donc `Deno.readTextFile` côté relève et `fetch` sur jsDelivr côté navigateur, sans une
  ligne de différence — et les tests s'en passent complètement.
- **Une table fausse casse au chargement, pas au premier tirage.** C'est le domaine qui juge
  (`verifieTable`, exporté pour ça) : la règle n'existe qu'à un endroit. Un fichier qui annonce
  un autre forum, une rareté inventée, des pourcentages qui ne font pas 100, deux lieux dont les
  noms se confondent : refusés, en nommant le fichier et le lieu.

Sept des dix-sept zones n'ont encore aucune table. L'adaptateur le dit (`aUneFaune: false`)
plutôt que de le laisser découvrir à un joueur.

---

## 10. Le contrat tourne enfin contre une vraie base — 2 octobre

Jusqu'ici, `registre.contrat.ts` ne tournait que contre l'adaptateur en mémoire : une suite de
tests qui ne se confrontait à rien. Elle tourne maintenant **deux fois**, et la seconde contre un
PostgreSQL 16 réel. C'est le moment où le faux cesse de pouvoir mentir.

Deux décisions ont rendu ça possible sans ajouter une seule dépendance.

### Un seul argument `jsonb` par fonction SQL

L'adaptateur appelle les quatre opérations du registre comme des **fonctions SQL nommées**, et
chacune prend un unique argument `jsonb`. La raison est écrite en tête de `supabase/registre.sql` :
il y a deux chemins d'appel, et aucun ne doit connaître les signatures.

| | Qui appelle | Comment |
|---|---|---|
| Production | `appelPostgrest` | `POST /rest/v1/rpc/<nom>`, corps `{"p": {…}}` |
| CI et poste de travail | `appelPsql` | `psql`, l'argument passé par une variable |

Avec des arguments scalaires, chaque chemin devrait recopier les types de chaque fonction — donc
les laisser dériver. Avec un seul `jsonb`, **le seul endroit du projet qui connaisse les
transtypages est le fichier SQL.**

Conséquence heureuse : **il n'y a aucune dépendance à `supabase-js`.** PostgREST est une API HTTP,
et `fetch` suffit — une vingtaine de lignes au lieu d'une bibliothèque entière à recopier dans
`vendoreur/`. La requête qui part est visible dans le code.

### Le CI appelle le SQL par `psql`

Faire tourner une pile Supabase complète dans le CI pour une suite de tests serait lourd ; recopier
un pilote Postgres dans `vendoreur/` serait des milliers de lignes qui ne servent qu'aux tests.
`psql` est déjà là, dans l'image de CI comme sur un poste, et il exécute le vrai SQL sur la vraie
base.

Ce n'est pas un trou de sécurité : l'argument n'est **jamais** concaténé dans la requête. Il passe
par une variable `psql`, relue avec `:'arg'`, que `psql` échappe lui-même en littéral SQL. La
chaîne envoyée est toujours la même, mot pour mot. (Au passage : `psql --command` ne substitue pas
ses variables, il envoie la chaîne telle quelle ; la requête passe donc par l'entrée standard.)

### Le test ne doit pas pouvoir se sauter en silence

`registre.supabase.test.ts` ne tourne que si `CONTRAT_CIBLE=postgres` et `CONTRAT_PGURL` sont
posées. Sans elles, il s'annonce **ignoré, à voix haute**. Et dans le CI, une étape vérifie qu'il a
vraiment tourné :

```
grep -q "Supabase · " /tmp/contrat.txt
! grep -q "IGNORÉ faute de base" /tmp/contrat.txt
```

Un test qui se saute sans bruit est pire que pas de test : on croit avoir une couverture qu'on n'a
pas.

### La traduction événement ↔ colonnes

`src/adaptateurs/supabase/evenement.ts` traduit entre l'événement du domaine et les deux colonnes
`type` / `charge`. C'est le code le plus bête du projet et l'un des plus dangereux : une clé mal
orthographiée ne casse rien, elle fait disparaître une capture. D'où deux garde-fous :

- le trajet est vérifié **dans les deux sens, pour les six variantes**, et une fois de plus après un
  aller-retour par JSON ;
- une charge incomplète au retour **lève**. Le réflexe tentant serait de filtrer les lignes
  illisibles ; ce serait perdre une capture en silence.

---

## 11. L'identité et la clôture — décisions du 2 octobre appliquées

### L'identité : Supabase Auth fabrique le laissez-passer

Le schéma lisait une revendication `joueur_id` dans le jeton. Personne ne l'aurait jamais posée.
**Les politiques RLS étaient donc toutes fausses, et silencieusement** : `joueur_courant()` rendait
NULL, et une comparaison à NULL ne lève pas — elle ne rend rien. Un joueur n'aurait simplement rien
vu de son carnet, sans un message d'erreur.

Ce qui est en place depuis `0004` :

| | Quoi |
|---|---|
| `joueur.auth_id uuid unique` | le compte Supabase Auth de ce joueur, posé une seule fois par la liaison |
| `auth_courant()` | le `sub` du jeton, c'est-à-dire exactement ce que rend `auth.uid()` |
| `joueur_courant()` | le joueur dont l'`auth_id` correspond |

Deux choix à garder en tête :

- **Pas de clé étrangère vers `auth.users`.** Elle attacherait le schéma à une table interne de
  Supabase, qui n'existe pas sur un PostgreSQL nu — donc ni dans le CI, ni sur un poste. Et
  supprimer un compte d'authentification ne doit pas emporter en cascade les pokémon de quelqu'un.
- **On lit le `sub` nous-mêmes au lieu d'appeler `auth.uid()`.** La fonction se comporte alors à
  l'identique hors Supabase : les politiques RLS deviennent testables en posant simplement
  `set request.jwt.claims`. C'est ce qui permet les six assertions pgTAP sur l'identité.

Un bogue corrigé au passage, qui n'avait rien à voir avec la décision : sans jeton du tout,
`current_setting('request.jwt.claims', true)` rend la chaîne **vide**, et `''::jsonb` lève. Une
politique RLS faisait donc tomber la requête d'un visiteur anonyme au lieu de ne rien lui rendre.

### La clôture : `cloturer()` a disparu

`appliquer_cloture(p jsonb)` la remplace. Elle ne vérifie plus rien — le domaine a déjà décidé — et
elle verse, pour tous les joueurs du sujet, en une seule transaction. `cloture_deja(p jsonb)` dit si
un sujet est clos. Une assertion pgTAP (`hasnt_function('cloturer')`) empêche l'ancienne de revenir.

`cloture.clos_par` n'est plus obligatoire : un sujet se clôture à plusieurs, et c'est `resultat` qui
porte le détail par joueur.

### Le bogue que la jointure a révélé

Les fonctions de `0002` lisaient la charge du registre avec des clés **en serpent** —
`charge->>'espece_id'`, `charge->>'pension_id'`. L'adaptateur TypeScript écrit **en chameau** —
`especeId`, `pensionId`.

Aucune des deux n'aurait levé : `->>` sur une clé absente rend NULL. **Le pokédex se serait rempli
de lignes vides et les pensions ne seraient jamais revenues, sans un seul message d'erreur.**
Corrigé dans `0004`, et deux assertions pgTAP tiennent la porte (`prosrc` ne doit plus contenir de
clé en serpent).

C'est l'argument pour `src/contrat/cloture.supabase.test.ts`, qui fait le trajet entier :

```
registre → domaine (evaluerCloture) → adaptateur → SQL → tables
```

Ni les tests du domaine ni pgTAP ne peuvent attraper ce genre de chose : les premiers ne savent rien
de la base, le second ne sait rien du domaine. **Les bogues vivent à la jointure, et ils ne lèvent
pas — ils versent zéro, en silence.**

### Les `Map` qui s'évaporent

Les `Effets` du domaine portent des `Map`. `JSON.stringify(new Map([[1, 2]]))` rend `{}`. Un bilan
entier aurait disparu sans une seule erreur : la clôture aurait « réussi » et n'aurait rien versé.

D'où `versJson` et `chargeDeCloture`, deux fonctions pures et testées, plutôt qu'un
`JSON.stringify(effets)` posé au milieu d'un appel. Un des tests ne vérifie pas notre code mais
**documente le piège** : il affirme que les `Effets` bruts stringifiés donnent bien `{}`, pour que
quiconque voudrait « simplifier » un jour tombe dessus.

---

## 12. La relève tourne — 2 octobre

La fonction Edge existe. Elle est la **racine de composition** : le seul fichier où l'on écrive
`new …Supabase(…)` ou `new Forumactif…(…)`, et le garde-fou refuse qu'on le fasse ailleurs. Elle ne
contient aucune règle : elle lit des secrets, assemble, prend un verrou, lance une tâche, rend le
verrou, répond.

### La seule tâche branchée : les clôtures

Sur les huit tâches de la planche 45, une seule est branchée — la tâche 2, parce qu'elle est la
seule dont **tout** est décidé. `ParcourirLesZones` parcourt les dix-sept zones, repère les sujets
remués depuis le dernier passage, y cherche `[cloture]`, et confie chaque demande à
`CloturerUnSujet`.

**Ce qui bloque la tâche 1 n'est pas du code** : le format des blocs d'événement — « j'utilise une
ball », « je lance un dé » — n'est pas tranché. Il n'est donc pas deviné : `demandes.ts` ne reconnaît
que `[cloture]`, qui est décidé, et le dit en commentaire.

### Les deux règles de sûreté du parcours

Elles comptent plus que le reste, parce qu'elles décident ce qui se passe le jour où ça casse.

**Une tâche qui échoue n'en bloque pas les autres.** Chaque zone et chaque sujet sont isolés. Un
sujet dont la page est illisible n'empêche pas les quinze autres de se clôturer.

**Le curseur n'avance que si la zone s'est passée sans incident.** C'est contre-intuitif : ne pas
avancer fait relire au passage suivant. Mais relire est **gratuit** — `CloturerUnSujet` commence par
demander si le sujet est déjà clos et répond « déjà close » sans rien poster — tandis qu'avancer
après un échec perdrait la demande d'un joueur **pour toujours**. L'idempotence de la clôture est ce
qui rend cette prudence sans coût, et deux tests la tiennent.

### Le verrou

La relève tourne toutes les cinq minutes. Un passage plus lent que l'intervalle doublerait les
clôtures. `releve_prendre_le_verrou` est donc **un seul ordre SQL** — `insert … on conflict … where`
— parce qu'un `select` suivi d'un `insert` laisse une fenêtre où deux passages se croisent. Il
expire tout seul au bout de quatre minutes : un passage mort ne doit pas bloquer la relève
indéfiniment. Il est rendu dans un `finally`, pour la même raison.

### Ce qui ne sort jamais

| | Où ça vit |
|---|---|
| `FORUM_URL`, `FORUM_COMPTE`, `FORUM_MOTDEPASSE` | Supabase › Edge Functions › Secrets, et nulle part ailleurs |
| `WM_SECRET_SIGNATURE` | idem. Sans lui, un joueur fabriquerait un code de vérification |
| `WM_CLE_DE_RELEVE` | idem. Sans elle, n'importe qui déclencherait la relève en boucle |
| La clé de service Supabase | fournie par Supabase à la fonction ; elle ne part jamais vers le navigateur |

La configuration est lue d'un bloc au démarrage, et la fonction **refuse de tourner** s'il manque
une variable, en nommant lesquelles — jamais leur valeur. Démarrer à moitié configuré serait pire :
la relève noterait « 0 traité » toutes les cinq minutes sans que personne ne comprenne pourquoi.

La clé de relève est comparée en **temps constant**. Un `===` laisse fuir la longueur du préfixe
commun par le temps de réponse.

### Un défaut trouvé par un test, pas par un accident

`HorlogeFigee` gardait la `Date` qu'on lui passait, par référence. Modifier cette date après coup
décalait l'horloge de tout le monde. Elle garde maintenant un nombre, et rend une copie à chaque
appel. C'est exactement le genre de chose qu'un test de « ça marche » ne trouve jamais.
