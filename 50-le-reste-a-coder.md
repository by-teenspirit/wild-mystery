# Tout ce qu'il reste à coder

Dressé le 1er octobre 2026. **Dernière relève : 6 octobre au soir, 544 tests plus 61 de
contrat contre un PostgreSQL réel, couverture du domaine à 100 %.** Branche de travail :
`socle-v2`.

**Trois planches se lisent ensemble, et dans cet ordre :**

| Planche | Pour quoi |
|---|---|
| `61-les-systemes-en-place.md` | **comprendre ce qui existe** en deux minutes — la carte |
| `60-a-tester-a-la-main.md` | **ce que Callista doit vérifier** et que je ne peux pas d'ici |
| celle-ci | le détail, les décisions, les pièges payés, et ce qui reste |

Contrat d'architecture : `47-l-architecture-du-code.md`. Règle de mise en page :
`49-zero-tableau-que-du-flexbox.md`. Partage dépôt / panneau d'administration : `48-…` §8.
Les pièges payés sur la charte : `59-les-pieges-de-la-charte-sur-modernbb.md`.

Légende : **✓** fait et vérifié · **◐** commencé · **·** à faire · **?** décision à prendre
avant d'écrire · **⊘** bloqué par autre chose que du code.

> **CETTE PLANCHE SE PÉRIME PLUS VITE QU'ON NE LA RELIT.** Le 5 octobre, cinq points marqués
> « à faire » étaient déjà faits dans le dépôt : le verrou de la relève, les deux travaux de
> CI, et les deux templates sans tableau. On a failli les refaire. **Avant d'attaquer un
> point d'ici, le vérifier contre le code** — un `grep` coûte dix secondes, refaire une
> journée.

> **ET IL EN EXISTE UNE COPIE PÉRIMÉE DANS LE DÉPÔT.** `50-le-reste-a-coder.md` à la racine
> est resté au commit `32aa460` : 268 lignes contre 400 ici. **Celle-ci fait foi**, et
> l'autre mérite d'être supprimée — deux copies du même document finissent toujours par
> diverger, c'est la leçon de la journée appliquée au document qui la raconte.

---

## 0. Ce qui est debout, au 6 octobre

| | Quoi |
|---|---|
| ✓ | **544 tests, 0 échec**, et **61 tests de contrat contre un PostgreSQL 16 réel**. `fmt --check`, `lint`, `check` et le garde-fou propres |
| ✓ | **Couverture du domaine à 100 %** — dix fichiers, 42 fonctions, 172 branches |
| ✓ | `outils/garde-fou.sh` — **douze refus**, chacun testé en le cassant exprès |
| ✓ | **Le dépôt est poussé**, et le CI tourne sur l'état réel |
| ✓ | **Le navigateur tourne sur le forum réel** : thème persistant, masquage des marqueurs, barre d'actions, **le module de bilan et son bouton de clôture**, **le panier de la boutique** |
| ✓ | **Neuf feuilles de style**, 109 630 octets assemblés, **mesurées au harnais sur l'index, un forum, un sujet, la rédaction, la liste des membres et la boutique**, dans les deux thèmes |
| ✓ | **Trois templates réécrits sans un seul `<table>`**, publiés et vérifiés |
| ✓ | **LES DIX-SEPT ZONES ONT UNE FAUNE** — 152 lieux, 312 tables, 734 espèces, et un sprite pour chacune dans les trois styles |
| ✓ | **LA BOUTIQUE MARCHE DE BOUT EN BOUT** : panier dans le navigateur, lecture du bloc, facturation par la base, reçu posté. `0011` appliquée le 5 octobre. Voir §3 ter |
| ✓ | **Les 34 articles sont en base**, vérifiés ligne par ligne — somme 60 850 ₽, identique au dépôt et au message du forum |
| ✓ | Treize migrations SQL, `0001_socle` à `0013_un_refus_de_fossile_se_souvient`, rejouées depuis zéro contre un PostgreSQL 16 : elles passent toutes. **`0012` et `0013` restent à appliquer** |
| ✓ | **Les huit fonctions SQL de `0001` et `0002` ont enfin été exécutées.** Six justes, deux cassées — voir §3 sexies |
| ✓ | La chaîne de relève écrite de bout en bout, **verrou compris**, **quatre tâches branchées** — écrite et testée, pas déployée |

### Ce qui bloque, et qui n'est pas du code

| | Quoi |
|---|---|
| ⊘ | **Le `git push` se fait à la main.** Le bac à sable n'a pas d'identifiants GitHub ; les commits sont écrits sur le Mac et poussés par Callista |
| ⊘ | **Supabase est injoignable depuis le bac à sable ET depuis le shell du Mac** — 403 au CONNECT des deux côtés. Le DDL passe par l'éditeur SQL dans le navigateur ; pour LIRE la base, le navigateur suffit avec la clé publiable |
| ✓ | **Mais le bac à sable a son propre PostgreSQL 16**, et c'est lui qui a révélé que `servir_commande` n'avait jamais marché, puis les trois défauts du pokédex. Voir §11 bis |
| ⊘ | **Le pont vers le Mac tombe.** Quand il est coupé, ni commit ni transfert ; le travail reste dans le bac à sable et part au retour du pont |
| ⊘ | **Le source des templates n'est pas lisible depuis le panneau d'administration** : ses URL portent un jeton de session, la lecture est refusée côté outil. Contourné en les versant dans `templates/` (§9) |
| ⊘ | **La relève n'est pas déployée.** Le CI ne déploie que sur un tag `v*`. Ne pas la mettre sur une horloge avant de l'avoir vue tourner une fois à la main |
| ⊘ | **Rien ne peut être posté sur le forum depuis ici** : le navigateur n'y est pas connecté, et on ne tape pas le mot de passe de Callista. Les contenus se préparent et elle les colle |

---

## 1. Les décisions prises depuis le 1er octobre

| | Question | Ce qui a été tranché |
|---|---|---|
| ✓ | **Comment on fabrique le fichier du navigateur** | `deno bundle --platform browser --format iife --minify`. **Le `--format iife` n'est pas cosmétique** : sans lui chaque `var` de premier niveau devient une globale de page. Forumactif en tient une, `j`, qui vaut `14` — elle a écrasé notre tableau. Garde-fou n° 6 (`58-la-fuite-des-variables.md`) |
| ✓ | **Comment on assemble le CSS** | `outils/css.sh` concatène `css/[0-9][0-9]-*.css` dans l'ordre numérique. Pas de minification — une feuille se lit. Garde-fou n° 7 |
| ✓ | **L'adresse des données côté navigateur** | déduite de `document.currentScript`, jamais écrite en dur : la branche et le commit suivent tout seuls |
| ✓ | **Les zones de jeu sont lisibles par les invités** | la relève lit le forum comme un visiteur ; le compte **Maître du Jeu (u3)** ne sert plus qu'à écrire |
| ✓ | **La liaison joueur ↔ compte** | les admins associent, via le champ de profil `clé de liaison` (id 2) |
| ✓ | **L'identité du joueur côté navigateur** | **tranchée et appliquée le 2 octobre**, migration `0004_identite_et_cloture.sql` : `joueur.auth_id uuid unique`, `auth_courant()` qui lit `request.jwt.claims`, `joueur_courant()` qui en déduit le joueur. C'était le blocage le plus coûteux du projet ; il est levé |
| ✓ | **Où vit le bouton de clôture** | **dans les deux endroits**, et c'est un arbitrage, pas un oubli. Voir §7 ter |
| ✓ | **Ce que porte un bloc de panier** | **quoi et combien, jamais à quel prix.** Voir §3 bis |
| ✓ | **Les formes régionales sont des espèces à part** | Alola, Galar, Hisui gardent leur identifiant PokeAPI propre (10091 à 10244). Décidé par Callista le 5 octobre. Voir §10 bis |
| ✓ | **Comment la relève sait où est une boutique** | `data/comptoirs.json`, pas une constante. Même propriété que le module côté navigateur, qui se reconnaît à `.wm-boutique` et jamais à `t977` : **aucun identifiant de sujet n'est écrit en dur, nulle part** |
| ✓ | **Comment un refus de commande se souvient d'avoir refusé** | c'est une **valeur de retour**, pas une exception. Un `raise` annule la transaction, donc le `etat='refusee'` avec elle. Voir §3 ter |
| ✓ | **Quelle date porte une entrée du pokédex** | **celle du registre**, pas celle de la clôture. Un RP se clôt des semaines après avoir été écrit. Voir §3 quinquies |
| ✓ | **Les dés disparaissent** | tranché le 1er octobre, planche 40 §1 : « l'automatisation remplace les dés. Pas de dés, pas de calculatrice. » Le serveur tire. **Il n'y a aucun pont à concevoir entre un dé Forumactif et un tirage serveur** — cette planche a longtemps dit le contraire, à tort |
| ✓ | **Le reçu de boutique est POSTÉ** | amendement du 6 octobre à la planche 18, règle 1. Elle disait « ni achat » ; un sujet de comptoir n'a pas de scène à protéger, et un refus doit atteindre le joueur sans qu'il revienne. Les sujets de RP gardent la règle entière : surcouche, jamais de message |

---

## 2. Le domaine — les règles pures

Zéro import, zéro horloge, zéro réseau. 100 % de couverture exigés, et tenus.

| | Fichier | Ce qu'il décide |
|---|---|---|
| ✓ | `experience.ts` | barème, seuils, montées de niveau |
| ✓ | `cloture.ts` | rejeu du registre, ce qui manque, ce qui est versé. **Deux lectures du même rejeu** : `evaluerCloture` dit si c'est possible, `cumuler` dit ce qu'il y a, sans verdict — c'est elle que le module appelle |
| ✓ | `alea.ts` | la graine et la suite reproductibles |
| ✓ | `rencontre.ts` | le tirage d'une espèce ; expose `verifieTable` |
| ✓ | `code.ts` | le code de vérification publié dans le module |
| ✓ | `action.ts` | `chercher` et `fouiller`, leurs marqueurs, leur lecture |
| ✓ | `panier.ts` | **ce qu'un joueur commande dans un message** : `[[WM-PANIER:990001x3;990002x1]]`, sa lecture, ses bornes. Voir §3 bis |
| ✓ | `fouille.ts` | ce qu'on trouve en fouillant, et combien |
| ✓ | `meteo.ts` | la condition du tirage : temps du jour, nuit locale du joueur |
| ✓ | `lieu.ts` | la clé d'un lieu. **Les ligatures d'abord, NFD ensuite** : `œ` et `æ` ne se décomposent pas, « Cœur de la Forêt » sortait en `c-ur-de-la-foret` |

### Les trois modules qui restaient au plan n'ont plus lieu d'être — ou pas encore

Relu le 3 octobre contre les annexes. **Deux des trois reposaient sur des règles qui
n'existent pas**, et les écrire aurait été inventer du jeu.

| Module prévu | Verdict |
|---|---|
| `mots.ts` | **Supprimé du plan.** L'arbitrage du `40-…` §3 est net : *« Le compteur de mots reste — c'est un repère utile pendant qu'on écrit — mais il ne sert à aucun calcul, il n'est ni envoyé ni vérifié. »* L'XP se compte en dégâts. Et ModernBB affiche déjà « Caractères · Mots » sous l'éditeur |
| `pension.ts` | **Spécification fausse.** Le plan disait `floor(jours / 10)` niveaux ; l'annexe élevage (`38-…`) dit autre chose : le pokémon reste **une semaine entière**, le gérant **déclare** le nombre de niveaux, **plafonné à 10 par sujet**, et il doit écrire un RP d'une page. Ce n'est pas une formule, c'est une déclaration bornée |
| `badges.ts` | **Sous-spécifié.** « Palier 2 à trois badges, palier 3 à sept » est la condition d'accès, et elle est déjà portée par `data/zones.json` et le palier du joueur. Ce qu'un badge ouvre d'autre n'est écrit nulle part |

---

## 3. L'application — ports et cas d'usage

| | Fichier | Contenu |
|---|---|---|
| ✓ | `ports.ts` | les interfaces, **et rien d'autre** : le garde-fou n° 3 le vérifie. `CompteNonLie` y a vécu une heure avant d'aller dans le cas d'usage qui décide quoi en faire |
| ✓ | `lire-les-nouveaux-messages.ts` | tâche 1 : les actions parues depuis le dernier passage · 16 tests |
| ✓ | `cloturer-un-sujet.ts` | tâche 2 : vérifier, appliquer en une transaction, poster le bilan ou le refus |
| ✓ | `parcourir-les-zones.ts` | l'orchestration : tâche 1 puis tâche 2 par sujet, deux lignes de journal par passage |
| ✓ | `bilan.ts`, `poster-les-bilans.ts` | **`rubriques()` rend des paires `{ étiquette, valeur }`, exportées.** Le message posté les recolle, le module les affiche : les deux disent la même chose **par construction**, pas par relecture |
| ✓ | `servir-une-commande.ts` | **tâche 3 : la boutique.** Lit les paniers, soumet, poste le reçu ou le refus, avance son curseur · 11 tests. Voir §3 ter |
| ✓ | `recu.ts` | le reçu et les deux refus, en texte pur · 5 tests. Même règle que `bilan.ts` : lisible dans dix ans, sans CSS ni JavaScript |
| ✓ | `ranger-le-pokedex.ts` | **tâche 7 : le pokédex.** Un contrôle, pas un travail — **zéro est la réponse attendue** · 4 tests. Voir §3 quinquies |
| · | `rendre-les-pensions.ts` | tâche 4 — **attend la décision du §2**, et sa fonction SQL déclencheuse est morte (§3 sexies) |
| · | `rendre-les-fossiles.ts` | tâche 5 — **attend la table `fossile_espece`**, qui est vide. Le SQL, lui, est réparé (`0013`) |
| · | `synchroniser-le-palier.ts` | tâche 6 : le rang Forumactif suit le palier |
| · | `oublier-les-abandons.ts` | tâche 8 : le ménage hebdomadaire |

### 3 bis. Le panier — trois règles

**LE BLOC NE PORTE AUCUN PRIX.** La planche 30 : « la vérité est côté serveur, c'est
`boutique_servir` qui relit les prix dans sa propre table ». Le bloc dit QUOI et COMBIEN,
jamais À QUEL PRIX. Un bloc trafiqué à la main ne fait donc pas gagner d'argent — au mieux
il commande autre chose, ce que n'importe qui peut faire en cliquant, et le solde est
vérifié de toute façon. **Rien à signer ici**, contrairement au bilan de clôture.

**LES BORNES NE PROTÈGENT PAS D'UN TRICHEUR** — le solde s'en charge. Elles protègent d'un
**débordement** : `quantite::int * prix` est un entier 32 bits côté PostgreSQL. 99 par
article, 20 articles, et **la borne est revérifiée après la fusion** — `7x60;7x60` fait 120,
donc une borne posée trop tôt se contournerait en dédoublant la ligne. **Les deux côtés
portent les mêmes chiffres, et le garde-fou n° 12 les relit** au lieu de les croire.

**UN PANIER ILLISIBLE N'EST PAS UN MESSAGE SANS PANIER.** Rater une fouille coûte un tour ;
rater une commande, c'est un joueur qui attend des objets qui n'arriveront jamais. Les trois
cas sont distincts et chaque refus nomme ce qu'il refuse.

### 3 ter. La boutique — cinq défauts, dont une faille, et ce qui les a trouvés

**`servir_commande` N'A JAMAIS SERVI UNE SEULE COMMANDE.** Elle était en place depuis
`0002_services.sql`, relue plusieurs fois, et sa dernière instruction était :

```sql
update commande set etat = 'servie', total = total where id = p_commande;
```

`total` est à la fois une variable plpgsql et une colonne de `commande`. PostgreSQL refuse —
*column reference "total" is ambiguous* — et comme c'était la **dernière** ligne, la
transaction entière était annulée **après** avoir débité et rempli le sac. Zéro commande
servie, zéro trace, et le seul chemin qui avait l'air de marcher était le refus pour argent
insuffisant : il lève avant d'y arriver.

**Quatre autres défauts, relevés une fois l'ambiguïté levée à la main :**

| | Panier | Facturé | Dans le sac |
|---|---|---|---|
| **A** | Pierre Feu ×1 + fossile ×99 | 3 000 ₽ | Pierre Feu ×1 **+ 99 fossiles** |
| **B** | Potion ×2 + Potion ×3 | — | `ON CONFLICT DO UPDATE … a second time` |
| **C** | quantité −10 | — | violation de `sac_quantite_check` |
| **D** | objet 424242 | — | violation de clé étrangère |

**A est une faille.** `coalesce((select prix … and en_vente), 0)` chiffrait à zéro tout objet
hors vente, et le garde-fou ne regardait que le TOTAL. Donc **tout ce qui se trouve sans
s'acheter — les fossiles, les objets d'évent — était gratuit** pour qui écrivait son
identifiant dans le bloc.

**B, C et D tombaient sans rien casser**, mais avec une erreur PostgreSQL que personne ne
peut lire, et surtout : la commande restait `en_attente`. Un `raise` annule le
`etat='refusee'` avec le reste, donc **le refus s'effaçait**, et la relève l'aurait repassé
à chaque passage pour l'éternité.

**D'OÙ LA FORME DE `0011` : un refus métier est une valeur de retour, écrite en base dans la
même transaction. Seul l'impossible lève** — commande introuvable, compte non lié. C'est la
leçon du 2 octobre prise un cran plus bas : la clôture avait appris que « appliquer » et
« publier » ne sont pas atomiques ; ici, « refuser » et « se souvenir d'avoir refusé »
doivent l'être.

**CE QUI LES A TROUVÉS : un PostgreSQL monté dans le bac à sable** (§11 bis). Aucun test du
dépôt ne pouvait les attraper — le domaine ne sait rien de la base, l'adaptateur appelle une
fonction doublée, pgTAP ne connaît pas l'adaptateur. **Il fallait exécuter le vrai SQL.**
C'est maintenant ce que fait `src/contrat/boutique.supabase.test.ts`, onze cas, et le CI
exige de les voir tourner.

**Vérifié en cassant la base exprès, dans les deux sens** : l'ambiguïté réintroduite fait
crier dix des onze cas avec le message d'origine — le onzième est celui qui levait avant d'y
arriver ; le garde-fou « hors vente » retiré fait crier celui de la faille, et lui seul.

### 3 quater. Pas de file de reçus — le curseur en tient lieu

Débiter et poster le reçu ne sont pas atomiques. La clôture s'en est sortie avec une table
(`bilans_en_attente`) ; la boutique n'en crée pas, et ce n'est pas de la paresse :

1. le curseur de lecture **n'avance qu'après un reçu posté** ;
2. un reçu qui ne part pas laisse donc le curseur en arrière, et la relève **relit le même
   message** cinq minutes plus tard ;
3. `boutique_servir` voit `message_id` déjà pris et rend `deja: true` **sans rien débiter** ;
4. l'adaptateur de publication reconnaît son marqueur si le message était en fait passé.

Trois garanties déjà payées ailleurs, remises bout à bout. Une table de plus aurait été une
quatrième chose à tenir à jour.

**Conséquence : le verdict rendu sur le chemin `deja` doit être COMPLET**, lignes comprises —
sinon le reçu reposté serait vide. Défaut écrit puis corrigé le 5 octobre, et le contrat le
vérifie.

**On s'arrête au PREMIER reçu qui ne part pas**, contrairement à `PosterLesBilans` qui passe
au bilan suivant. La différence est que les commandes sont ordonnées par le curseur : avancer
par-dessus un trou perdrait définitivement le reçu du trou.

### 3 quinquies. Le pokédex — trois défauts et un désaccord de dates

`ranger_pokedex` a été écrite en `0002`, puis **réécrite en `0004` en regardant la
première**. Résultat : chacune était cassée à sa façon.

| | Version | Ce qui n'allait pas |
|---|---|---|
| `0002` | lisait `charge->>'espece_id'` en serpent | le registre porte `especeId` en chameau. **Elle ne rangeait rien** |
| `0004` | a corrigé la clé | et perdu le `join cloture` **et** `attrape_le` |

**Ce que `0004` faisait, mesuré le 6 octobre contre un PostgreSQL 16 :**

| | Ce qui se passait |
|---|---|
| **1** | une espèce croisée dans un sujet **ouvert** entrait au pokédex pour toujours. Et après `oublier_sujet`, elle y restait **sans plus aucune trace au registre** — impossible à auditer |
| **2** | **aucune capture** n'était jamais marquée : la fonction ne posait que `croise_le` |
| **3** | le compte rendu comptait les lignes **touchées**, pas **changées** — donc toujours le nombre de paires (joueur, espèce) du registre, un chiffre qui ne voulait rien dire |

Le 1 est le plus grave : **le pokédex est un objectif de complétion**, et y créditer une
rencontre d'un RP abandonné, c'est offrir l'objectif.

**ET LES DEUX ÉCRIVAINS DU POKÉDEX NE DISAIENT PAS LA MÊME DATE.** Trouvé en faisant tourner
les deux suites de contrat **ensemble** — séparément, chacune passait.

- `appliquer_cloture` écrivait `now()` : **la date de la clôture** ;
- `ranger_pokedex` lit `min(registre.cree_le)` : **la date où le joueur a posté**.

Donc « zéro est la réponse attendue » aurait été faux en production : chaque passage suivant
une clôture aurait annoncé des corrections, et le chiffre serait redevenu du bruit qu'on
apprend à ignorer.

**C'est la date du registre qui est juste.** Un RP se clôt des jours, parfois des semaines
après avoir été écrit ; le joueur a vu ce Pokémon le jour où il a posté. Et c'est la date
**reproductible** : elle se recalcule depuis le registre, alors que `now()` dépend du moment
où la relève est passée. Même raison que la graine du tirage.

**`0012` répare les trois défauts et met les deux fonctions sur la même source**
(`pokedex_date_du_registre`). Le domaine n'est pas touché : les `Effets` ne portent pas de
dates, et la clôture a déjà le registre sous la main.

> **DEUX FONCTIONS QUI ÉCRIVENT LA MÊME TABLE NE SE CONTREDISENT JAMAIS DANS LE TEST DE
> L'UNE D'ELLES.** Il faut faire tourner les suites ensemble. C'est maintenant le cas, et un
> test verrouille l'accord : *« après une clôture, il n'y a RIEN à ranger »*.

### 3 sexies. Les huit fonctions que personne n'avait jamais appelées

Passées au banc le 6 octobre contre un PostgreSQL 16. Aucune n'avait de test : elles sont
antérieures à la convention `(p jsonb) returns jsonb`, et aucun adaptateur du dépôt ne les
appelle encore. **Six sont justes et ont maintenant treize cas de contrat.**

| Fonction | Verdict |
|---|---|
| `seuil` | ✓ 100 · 1 500 · 127 500 · 505 000 — pas de débordement au niveau 100 |
| `monter_niveaux` | ✓ monte de plusieurs crans d'un coup, s'arrête à 100 |
| `rendre_pension` | ✓ **corps sain** : 3 niveaux pour 35 jours, XP relevée au seuil, retour en boîte, position libérée, rejeu refusé. **La règle, elle, est fausse** — §2 |
| `paliers_a_revoir` | ✓ trois badges → 2, sept → 3, et elle cesse de lister quand c'est à jour |
| `lier_compte` | ✓ lie, consomme le jeton, refuse le rejeu |
| `oublier_les_abandons` | ✓ efface le vieux non clos, garde le clôturé **et** le récent |
| `rendre_fossile` | ⚠ **le défaut de `servir_commande`, une troisième fois** |
| `pensions_a_rendre` | ⚠ **requête morte** |

**`rendre_fossile` écrivait son refus puis levait :**

```sql
update analyse_fossile set etat = 'refusee' where id = p_analyse;
raise exception 'FOSSILE_ABSENT';
```

Le `raise` annule le `update`. L'analyse restait `en_attente`, donc la relève l'aurait
repassée toutes les cinq minutes, pour toujours. **Un script a relu les treize migrations à
la recherche du motif — un `update` ou `insert` suivi d'un `raise` sans `return` entre les
deux : c'est la seule occurrence.** La chasse est close.

`0013` la réécrit selon la règle de `0011`, et elle **distingue deux refus que l'ancienne
confondait** :

- le **fossile absent du sac** est la faute du joueur → `refusee`, écrit et conservé ;
- un **fossile sans espèce rattachée** est une donnée qui manque de NOTRE côté → l'analyse
  **reste en attente** et repartira toute seule le jour où `fossile_espece` sera écrite. Son
  fossile n'est pas consommé.

**`pensions_a_rendre` cherche `charge->>'pensionId'`** dans les lignes `objet_utilise`.
Mesuré : avec cette clé elle rend la pension ; avec la charge que le domaine écrit vraiment —
`{objetId, quantite}` — elle rend **zéro**. Personne, nulle part, n'écrit `pensionId`. Et
zéro ressemble exactement à « aucune pension à rendre ».

**Non réparée, exprès.** La règle de pension est déjà déclarée fausse (§2) ; choisir la clé
déclencheuse maintenant, c'est choisir *comment on dépose un pokémon en pension*, et c'est à
Callista. Le défaut est écrit dans un `comment on function` pour qu'il se lise depuis la base
elle-même.

> **QUATRE FONCTIONS SUR QUATRE EXAMINÉES ÉTAIENT CASSÉES.** `servir_commande`,
> `ranger_pokedex`, `rendre_fossile`, `pensions_a_rendre`. Trois d'entre elles avaient été
> réécrites une fois, et la réécriture avait corrigé un détail en perdant le reste. **La
> leçon n'est pas « relire mieux » — c'est « exécuter ».** Six autres fonctions étaient
> justes, et rien dans leur lecture ne les distinguait des quatre autres.

---

## 4. Les adaptateurs

| | Dossier | État |
|---|---|---|
| ✓ | `en-memoire/` | registre, état du jeu, relève |
| ✓ | `forumactif/lecture.ts` | testé sur une page réelle enregistrée verbatim, **exclue de `deno fmt`** |
| ✓ | `forumactif/marqueur.ts`, `demandes.ts`, `publication.ts` | le marqueur en texte brut, les demandes, **les paniers**, l'écriture sur le forum |
| ✓ | `faune/fichiers.ts` | **312 tables**, lecteur injecté : le même code sert `Deno.readTextFile` et `fetch` |
| ✓ | `faune/comptoirs.ts` | les sujets de boutique. **Refuse deux comptoirs dans le même forum** : ils partageraient leur curseur, et le second le ferait reculer à chaque passage |
| ✓ | `supabase/` | `appel`, `boutique`, `cloture`, `evenement`, `jeu`, `registre`, `releve` (le verrou, le journal, le suivi, **et le pokédex**) |
| ✓ | `systeme/horloge-et-signature.ts` | l'horloge et la signature réelles |
| ✓ | `navigateur/` | `barre-d-actions`, `catalogue` (dont `nomEspece`), `coin-outils`, `editeur`, `marqueurs`, `stockage`, `registre`, `module-bilan`, **`module-boutique`** |
| ✓ | `contrat/registre.contrat.ts` | la suite partagée, passée **par le faux ET par le vrai** sur un PostgreSQL de CI |

**`supabase/boutique.ts` ne fait qu'une chose : se méfier.** Un appel PostgREST rend du
`unknown`, et le tenter en verdict typé marcherait jusqu'au jour où la fonction SQL change
de forme — ce jour-là le cas d'usage écrirait un reçu vide à un joueur déjà débité. Chaque
champ est donc relu, et **le sous-total est vérifié** : la base facture et elle a raison,
mais si son produit ne tombe pas juste, le reçu mentirait. **Un reçu faux est pire qu'un
reçu absent.**

**Trois pièges payés sur `editeur.ts`**, qui valent pour tout ce qui touche à l'éditeur :

- **`window.$` n'est pas jQuery sur ce forum** — c'est un objet, le thème l'a écrasé.
  `window.jQuery` est la vraie fonction. On essaie les deux et on exige que ce soit appelable.
- **Sur la réponse rapide, il n'y a pas d'instance sceditor** : `#text_editor_textarea` est
  visible et c'est lui l'éditeur. Sur la page de rédaction complète, l'instance existe et le
  `textarea` natif est à 0 × 0. Le repli n'est donc pas un cas dégradé, c'est la moitié des cas.
- **L'événement `input` ne partait que dans UN des deux chemins** : le repli écrivait et
  prévenait, le chemin sceditor écrivait en silence. Ça suffisait tant qu'un seul bouton
  écrivait. Il part maintenant des deux — le compteur de mots du forum l'écoute, nos deux
  boutons de clôture aussi (§7 ter), et le panier qui écrit à chaque clic.

---

## 5. La base

| | Quoi |
|---|---|
| ✓ | Treize migrations numérotées, `0001` à `0013` |
| ✓ | `appliquer_cloture` : elle ne vérifie plus, elle verse — et depuis `0012` elle écrit au pokédex **la date du registre**, pas la sienne |
| ✓ | `boutique_servir` (`0011`) : relit les prix en base, **refuse ce qui n'est pas en vente**, fusionne les doublons, borne les quantités, vérifie le solde, débite, remplit le sac, **et écrit son refus dans la même transaction**. Remplace `servir_commande`, supprimée — voir §3 ter |
| ✓ | `ranger_pokedex` / `pokedex_ranger` (`0012`) : ne range que les sujets **clôturés**, pose `attrape_le`, et ne compte que ce qu'elle **change** — voir §3 quinquies |
| ✓ | `heure_locale_du_joueur` — le fuseau du joueur décide de la nuit |
| ✓ | Les politiques RLS réécrites sans récursion (`55-la-recursion-rls.md`), la surface fermée (`56-fermer-la-surface.md`) |
| ✓ | **Le registre est lisible par le navigateur**, et c'est une décision, pas un relâchement : `grant select on registre to anon, authenticated` plus une politique `using (true)` |
| ✓ | **Le registre d'un sujet clos est FIGÉ** — le déclencheur `registre_sujet_ouvert` refuse toute écriture. C'est la garde qui empêche de rejouer un sujet déjà versé, et elle a attrapé un de mes tests avant moi |
| ✓ | **`supabase/seeds/objets.sql` appliqué** : 34 lignes, aucune divergence avec `data/objets.json` |
| ✓ | **`0011_la_boutique_qui_marche.sql` appliquée** le 5 octobre : `servir_commande` supprimée, `boutique_servir` en place, colonne `detail` ajoutée |
| · | **Appliquer `0012_le_pokedex_dit_la_verite.sql`.** Sans elle, la tâche 7 polluerait le pokédex au lieu de le vérifier |
| · | **Appliquer `0013_un_refus_de_fossile_se_souvient.sql`** |
| · | **Appliquer `0014_la_vie_de_rhode.sql`** : la table `journal`, ses deux fonctions, et `boutique_servir` qui y écrit dans la même transaction que le débit |
| · | **`fossile_espece` est VIDE** — zéro ligne, vérifié le 6 octobre. C'est la table « quel fossile donne quelle espèce », et elle bloque la tâche 5 à elle seule |
| ✓ | **`journal` écrite en `0014`** — la table « La vie de Rhode », alimentée par les fonctions SQL seulement, lue par `anon`. **À ne pas confondre avec `releve_journal`**, qui existe depuis `0001` et qui est le journal TECHNIQUE des passages. Reste à **appliquer `0014_la_vie_de_rhode.sql`** |
| · | `sujets_mj` — le drapeau « je veux un MJ » |
| · | Étendre pgTAP : l'idempotence `(message_id, type)` **sous concurrence**, et les politiques vues depuis deux joueurs différents |

**La convention des fonctions SQL, posée en `0003` : `(p jsonb) returns jsonb`.** Les
fonctions de `0001` et `0002` lui sont antérieures et prennent des arguments nommés.
`servir_commande` en était ; `boutique_servir` suit la convention. **Les deux formes
cohabitent, et c'est un piège de relecture** : voir un `(p_commande uuid)` ne veut pas dire
que la fonction est juste, seulement qu'elle est vieille.

> **UNE FONCTION RÉÉCRITE PERD DES CHOSES. Deux fois en deux jours.** `servir_commande` ne
> servait rien ; `ranger_pokedex`, réécrite en regardant sa propre version précédente, a
> corrigé une clé et perdu deux garde-fous. **La version la plus récente n'est pas forcément
> la plus juste.** Quand `0012` reprend `appliquer_cloture`, elle l'extrait de `0006` **par
> script**, avec une assertion sur le nombre de `now()` — recopier à la main, c'est
> l'occasion de perdre une ligne.

---

## 6. La fonction Edge

| | Quoi |
|---|---|
| ✓ | `supabase/functions/releve/index.ts` — racine de composition, adaptateurs construits une fois, zéro règle |
| ✓ | Le journal de passage : une ligne par tâche et par passage, listes d'erreurs séparées |
| ✓ | **Le verrou — fait depuis `0005_releve.sql`.** `releve_prendre_le_verrou` / `releve_rendre_le_verrou` en SQL, `VerrouSupabase` côté adaptateur, et la fonction Edge rend **409** quand un passage tourne déjà. **Prendre le verrou est UN SEUL ordre SQL** : un `select` suivi d'un `insert` laisserait une fenêtre où deux passages se croisent, et deux passages qui se croisent clôturent deux fois le même sujet |
| ✓ | **Quatre tâches branchées**, et l'ordre est raisonné : parcourir les zones → poster les bilans → **servir les commandes** → **ranger le pokédex**. La boutique est la seule qui débite, donc elle passe tard ; le pokédex réconcilie ce que les clôtures viennent d'écrire, donc il passe en dernier |
| ⊘ | **Pas déployée.** Le CI ne déploie que sur un tag `v*` |
| · | **Les huit secrets à poser.** Dans Supabase › Edge Functions › Secrets : `FORUM_URL` (sans barre finale), `FORUM_COMPTE`, `FORUM_MOTDEPASSE`, `WM_SECRET_SIGNATURE`, `WM_CLE_DE_RELEVE`, `WM_RACINE_DONNEES` (**avec** barre finale, pointant le tag). `SUPABASE_URL` et `SUPABASE_SERVICE_ROLE_KEY` sont posés par Supabase. **La fonction refuse de démarrer en nommant ce qui manque** — jamais la valeur |
| · | Dans GitHub : `SUPABASE_ACCESS_TOKEN`, `SUPABASE_PROJECT_REF`, `SUPABASE_DB_PASSWORD` |

**`WM_SECRET_SIGNATURE` ne change plus jamais** une fois des bilans postés : tous les codes
de vérification déjà publiés deviendraient faux.

**`VERSION` est à incrémenter à chaque envoi.** Cette fonction importe du code situé HORS de
son dossier (`src/`), et le CLI Supabase ne regarde que `supabase/functions/` pour décider
s'il y a quelque chose à redéployer : il répond « No change found » alors qu'un fichier
importé a changé, et c'est l'ancien code qui reste en ligne.

**`pokedex_corrige` dans la réponse est attendu à ZÉRO.** Un nombre non nul veut dire qu'une
ligne du pokédex était en retard sur le registre — à regarder, pas à ignorer.

---

## 7. Le navigateur

Un seul fichier servi par jsDelivr, qui partage `src/domaine/` avec le serveur.

| | Module | État |
|---|---|---|
| ✓ | `js/wild-mystery.ts` | le point d'entrée. Pose le thème, masque les marqueurs, pose la barre **et le module** seulement si la page est une des dix-sept zones sauvages, **et le panier seulement si la page porte `.wm-boutique`** |
| ✓ | `src/navigateur/theme.ts`, `preferences.ts`, `stockage.ts` | le thème clair/sombre/système, retenu dans `localStorage` |
| ✓ | `src/navigateur/zone.ts` | les zones et les lieux lus depuis `data/`, triés avec les accents, dédoublonnés |
| ✓ | `src/navigateur/redaction.ts` | **tout ce qu'un clic fait au texte** : les marqueurs d'action, la bascule `[cloture]`, **le bloc de panier** |
| ✓ | `src/navigateur/sprites.ts` | le choix du style de sprite (`54-le-style-des-sprites.md`) |
| ✓ | `src/navigateur/bilan.ts` + `adaptateurs/navigateur/module-bilan.ts` | **le module au-dessus du premier message, et son bouton de clôture. Vus à l'écran le 5 octobre** (§7 bis et ter) |
| ✓ | `src/navigateur/boutique.ts` + `adaptateurs/navigateur/module-boutique.ts` | **le panier.** Vérifié sur `t977` : 34 articles lus, somme du catalogue identique au dépôt, panier éprouvé sur cinq pas. **L'état est immuable**, et la borne vient du domaine plutôt que d'être réinventée |
| · | `js/carnet.ts` | la page `/h14-mon-carnet` et ses huit onglets |
| ✓ | `src/navigateur/vie.ts` + `adaptateurs/navigateur/{journal,module-vie}.ts` | **l'encart « La vie de Rhode » sur l'index.** Un appel, huit lignes, la formulation côté navigateur. **Aucun template touché** : le nœud s'insère après la dernière catégorie — la même erreur que pour le module de bilan avait fait croire qu'il fallait réécrire `index_box` |
| · | `pokedex.ts`, `carte.ts`, `switcheroo.ts`, `infobulle.ts` | |

**Le panier n'essaie PAS de se relire depuis le texte du joueur.** Le bloc ne porte que des
identifiants et des quantités ; en reconstruire un panier donnerait l'illusion d'un état
partagé qui n'existe pas. **Le panier vit dans la page, le temps de la page** — et le joueur
peut effacer le bloc à la main, c'est son texte.

### 7 bis. Le module de bilan — ce qu'on a appris en l'écrivant

**Il ne demandait aucun changement de template.** On a écrit le contraire pendant des jours
— « il lui faut un point d'ancrage dans `viewtopic_body` » — et c'était faux : le premier
message est trouvable par `post--<id>`, et un nœud s'insère devant. Ça l'a retardé pour rien.

**Le pseudo ne vient pas de la base.** Le registre ne connaît que des identifiants, et la
table `joueur` n'est lisible que par son propriétaire — c'est la bonne politique, on ne
l'ouvre pas pour afficher un nom. Or le nom est déjà sous les yeux du lecteur : chaque
message porte `post--<messageId>` **et** le pseudo de son auteur, et le registre porte le
même `messageId`. On relie les deux là où ils se rencontrent déjà.

**Vérifié à l'écran le 5 octobre**, sujet 976, dans les deux thèmes. **Cinq requêtes, pas
une de plus**. Zéro tableau. Contraste au plus bas 5,51 en sombre et 6,18 en clair.

**Il se pose tard sur un réseau lent, et c'est normal** : quatre allers-retours à la file.
Deux fois on l'a cru absent après avoir attendu quatre puis six secondes sur un commit tout
neuf — le CDN était froid. À dix secondes il était là les deux fois. **On attend, on ne
conclut pas.**

### 7 ter. Le bouton de clôture — pourquoi il y en a deux

La règle 6 de la planche 45 dit « le bouton vit dans le module ». Elle a été écrite le
1er octobre, **avant que la barre d'actions existe**. Il y en a donc deux, et c'est voulu :
la barre est là où on écrit, le module là où on lit.

**DEUX BOUTONS NE SONT ACCEPTABLES QUE S'ILS NE PEUVENT PAS SE CONTREDIRE** : la bascule
`[cloture]` était écrite deux fois, elle est remontée dans `navigateur/redaction.ts`, pure
et testée ; l'événement `input` ne partait que dans un des deux chemins de l'éditeur (§4) ;
et **un test vérifie que ce que le bouton pose est ce que la relève lit**, les deux
expressions vivant dans des fichiers qui ne partagent aucune dépendance.

**Vérifié à l'écran** : les quatre sens testés (clic module, 2e clic, clic barre, effacement
à la main), le texte et l'état restent d'accord à chaque pas.

- **Il ne paraît pas s'il n'y a pas de formulaire de réponse.** Vérifié en invité : module
  oui, bouton non.
- **Il n'est jamais grisé** (`45-…` §7). Le navigateur ne SAIT pas ce qui manque — c'est le
  serveur qui vérifie et qui poste un refus en nommant ce qui manque.
- **Il amène le joueur à sa réponse** après avoir écrit le mot.

**Une divergence assumée** : le bouton du module change de libellé, celui de la barre non.
**`aria-pressed` est `true` des deux côtés.** À revoir si ça gêne à l'usage.

---

## 8. Le CSS

Dans le dépôt, sauf les jetons (`48-…` §8). Assemblées par `outils/css.sh`.

| | Fichier | État |
|---|---|---|
| ✓ | `01-deflottement.css` | flexbox à la place des flottants |
| ✓ | `02-socle.css` | les surfaces, la typographie, les liens, les boutons, les champs, le focus, **et le pied de page de Forumactif** |
| ✓ | `03-index.css` | catégories, lignes de forum, compteurs, statistiques. **Mesurée sur l'index le 5 octobre** : 236 textes par thème |
| ✓ | `04-forum.css` | en-tête de forum, lignes de sujets, tri, légende. **Mesurée sur `/f9`** : 68 textes par thème. **La pagination n'est toujours pas vérifiée** |
| ✓ | `05-sujet.css` | la carte d'un message, la fiche de personnage, le corps du texte, **le module de bilan et son bouton** et **le bloc de règles** |
| ✓ | `06-ecrire.css` | la page de rédaction, l'éditeur, les smileys, le lanceur de dés, les boutons d'envoi |
| ✓ | `07-membres.css` | la liste des membres, après réécriture du template |
| ✓ | `09-boutique.css` | le catalogue et son panier. **Mesurée sur `t977`** : 154 textes par thème, zéro défaut de contraste |
| ✓ | `10-coin-outils.css` | le coin d'outils et la barre d'actions |
| · | `07-carnet.css` | les huit onglets. **Attend `js/carnet.ts`** |
| · | `08-annexes.css` | le gabarit d'annexe. **Attend les pages HTML** |
| ◐ | `panneau-admin/jetons.css` | 229 lignes, les deux modes, relevé dans Figma. **Collé à la main dans le CSS du panneau** |

### Le coin d'outils mord les soixante derniers pixels — et ça s'est vu en vrai

Il est `position: fixed` en bas à droite et occupe **108 px**. La colonne de contenu de
ModernBB est fluide avec 48 px de marge **tant que la fenêtre fait moins d'environ 1 030 px**.
Sous cette largeur, le coin recouvre donc **toujours** le bord droit du contenu, sur toutes
les pages. À 1 280 px il reste 189 px de dégagement — **c'est pour ça que ça ne s'était
jamais vu**.

Relevé le 5 octobre sur la boutique : **deux boutons « + » réellement incliquables**,
`elementFromPoint` ne les atteignait pas. Réparé en mettant les commandes à GAUCHE
(`order: -1`) plutôt qu'en réservant 108 px sur trente-quatre rangées — et ça se défend sans
le coin : à gauche, les boutons sont dans une colonne fixe au lieu de se déplacer avec la
longueur du nom. Sur une page où l'on clique soixante-huit fois, viser toujours au même
endroit compte.

### La règle des surfaces peintes en dur

ModernBB repeint des surfaces qui se ressemblent toutes et qui demandent chacune leur règle.
**Six relevées à ce jour** :

| Surface | Couleur imposée | Où |
|---|---|---|
| `li.row1` / `li.row2` | `#ffffff` / `#f8f8f8` | partout, la zébrure (`02`) |
| `div.post` | `#f8f8f8` | la carte d'un message (`05`) |
| `.panel` | `#f8f8f8` | rédaction, profil, recherche (`02`) |
| `#forum_rules` | `class="post row1"` | le bloc de règles (`05`) |
| **`.block-footer`** | **`#f0f0f0`** | **la légende de l'index (`02`)** |
| **`#imageList`** | **`#ffffff`** | **« Dernières images » (`02`)** |

Les deux dernières sont **à l'intérieur d'un `.block` déjà traité**, ce qui les rendait
invisibles à la relecture. La légende était à **1,41 de contraste**, et personne ne l'avait
vu parce qu'elle n'existe que sur l'index — la seule page où le harnais n'avait jamais
tourné. Elles prennent `transparent` : le bloc qui les contient porte déjà la bonne surface.

### La règle des jetons de texte pâle

**`texte-pale` ne va que sur `fond-page` et `fond-surface`. Sur `fond-surface-haute`, c'est
`texte-doux`.** Écrit après l'avoir payé trois fois dans la même journée : la note du bouton
de clôture (4,16), les étiquettes « RÉPONSES » et « VUES » (4,16, et seulement sur la ligne
PAIRE), et la note de la barre d'actions qui, elle, passe — **à 4,55**, de justesse.

**Reprendre une règle vérifiée ailleurs n'est pas une vérification.**

### « On ne possède pas cette surface, donc on laisse » est un raisonnement, pas une mesure

`#page-footer` est peint `#2c353b` par Forumactif, **sombre dans les deux modes**. Notre bleu
y donnait **2,23 en clair**. On en avait conclu « on laisse ». Mesuré en rendant la main à
Forumactif : **1,33.** Sa propre couleur est PIRE que la nôtre. Ne rien faire aurait aggravé
le défaut qu'on croyait éviter.

`texte-sur-nuit`, comme `.headerbar h1` : **12,14 en clair, 10,04 en sombre**. Le crédit
`.gensmall` est dans la même règle — il passe de 2,12 à 12,14, et rendre un crédit lisible
n'est pas y toucher. **`.mainmenu`, vérifiée au passage : 12,5 dans les deux modes.**
L'écarter était juste. Les deux cas se ressemblaient ; un seul était un défaut.

### Les media queries ne sont pas dans une feuille à part

Chaque feuille porte ses propres `@media`, juste après les règles qu'elles modifient. Un
point de rupture séparé de la règle qu'il corrige se désynchronise dès la deuxième
modification.

### La citation, le spoiler et le code ne sont pas écrits

Aucun message du forum n'en contient aujourd'hui.

### Les couleurs de groupe

Les pseudos sont colorés en **style inline** par Forumactif, sur `span.usr_grp_clr`. **Il
n'existe aucune couleur qui passe 4,5 sur les deux fonds** — le mieux atteignable est
**3,77 des deux côtés** : terre `#B56A45`, ocre `#A37341`, bleu `#46849C`, prune `#B06692`,
vert `#4C8A52`. Callista les a reprises le 5 octobre.

---

## 9. Les templates Forumactif

**Enregistrer ≠ Publier.** « Enregistrer » met le template en *En attente* et le forum
continue à servir l'ancienne version, sans rien dire. Une après-midi perdue le 2 octobre.

**Le `.bbtheme` ne sert à rien pour ça** : 4,4 Ko, chiffré. C'est un paquet de réglages, pas
les templates.

| | Template | t | Pourquoi |
|---|---|--:|---|
| ✓ | `overall_header` | 116 | les polices, la feuille et le script jsDelivr, pointés sur la **branche** |
| ✓ | `memberlist_body` | 113 | `table#memberlist.table1` → `ul`/`li` + flex. **Publié et vérifié** |
| ✓ | `viewtopic_body` | 127 | le `<table>` du bloc de règles |
| ✓ | `posting_body` | | le même bloc, le lanceur de dés. **Publié et vérifié** |
| ✓ | `index_box`, `topics_list_box` | | **rien à faire : ils n'ont AUCUN tableau** |
| · | `portal_body`, `groupcp_info_body` | | sources non versées |

**Le HTML passe dans les messages de ce forum.** Vérifié le 5 octobre : le catalogue de
`t977` est du HTML, et ses attributs `data-wm-objet` ont survécu à l'éditeur. Une balise
BBCode inventée, elle, se serait affichée telle quelle — **le premier brouillon du message
de boutique utilisait `[wm-objet=…]`**, rattrapé avant envoi.

**Le « + » du lanceur de dés se teste en deux temps** : c'est un lien `javascript:`, donc
*planifié* et pas exécuté dans la foulée. Le premier relevé donnait à croire que c'était
cassé. **S'arrêter au premier chiffre, c'était défaire un changement qui marchait.**

---

## 10. Les données du dépôt

| | Fichier | État |
|---|---|---|
| ✓ | `data/zones.json` | les dix-sept zones, **toutes avec une faune** |
| ✓ | `data/faune/<forumId>.json` | **17 fichiers, 152 lieux, 312 tables.** Les dix de la V1 ont 13 à 16 lieux ; les sept neuves en ont **un seul**, voir §10 bis |
| ✓ | `data/especes.json` | dérivé des tables par `outils/especes.py` — **734 espèces**, formes régionales comprises. Garde-fou n° 9 |
| ✓ | `data/sprites-couverture.json` | **734 espèces × 3 styles, zéro introuvable.** Commit du dépôt de sprites épinglé, jamais `@master` |
| ✓ | `data/objets.json` | **le catalogue de la boutique, source unique.** Le seed SQL et le message du sujet en sont dérivés par `outils/objets.py`. Garde-fou n° 11. **Les prix sont une proposition à relire** |
| ✓ | `data/comptoirs.json` | **les sujets où la relève lit les paniers.** Pas une constante du code : ouvrir une boutique d'évent, c'est ajouter une ligne et pousser |
| ✓ | `data/supabase.json` | l'URL du projet et **la clé publiable, et elle seule**. Garde-fou n° 10 |
| · | `data/arenes.json` | |

**`outils/objets.py` lit la contrainte de la base plutôt qu'une liste recopiée.** Le
5 octobre, le catalogue utilisait six familles dont quatre que `objet_famille_check`
refusait. Le seed était cohérent avec `data/objets.json`, le garde-fou n° 11 disait « à
jour », **et l'insertion échouait quand même** — parce que personne ne comparait les deux
listes. `familles_du_schema()` lit maintenant la DERNIÈRE contrainte écrite dans les
migrations.

> **Vérifier qu'un fichier dérivé correspond à sa source ne dit rien sur la justesse de la
> source.** C'est la leçon du garde-fou n° 11, et elle a servi deux fois : elle vaut aussi
> pour les bornes du panier, d'où la forme du n° 12 — relire les deux côtés, pas l'un.

### 10 bis. Les sept zones neuves — ce qui est donné et ce qui est inventé

Manoir Barjok, Usine Désaffectée, Libra Échoué, Oasis Perdue, Planque Snatch, Relique Sacrée
et Volcan Sombre **n'existaient pas en V1**. Leurs forums sont vides, elles n'ont jamais eu
d'annexe, donc aucune table d'origine.

**LA RÉPARTITION N'EST PAS INVENTÉE** : elle vient de la planche 39, 334 espèces pour ces
sept zones. `outils/zones-neuves.py` ne fait que la mettre en forme, et il dit en en-tête ce
qu'il invente :

1. **Un seul lieu par zone**, portant le nom de la zone. En écrire une centaine serait
   écrire du décor à la place de l'autrice. Un essai fige le « un seul » pour qu'un
   découpage futur se voie.
2. **Des pourcentages égaux.** On a cherché une règle à recopier dans les tables de la V1 :
   il n'y en a pas, elles ont été écrites à la main (9 à 12 entrées, pourcentages à 5, 8, 9,
   10 et 12). Le poids égal n'invente pas de hiérarchie — et il se défend, la planche 39
   répartissant déjà par stade d'évolution.
3. **Jour et nuit identiques.** Les écrire différentes serait inventer une règle ; les
   écrire pareilles dit honnêtement « pas encore décidé ».

**Les niveaux, eux, sont une donnée** : planche 39, palier 2 « 15 à 40 », palier 3 « 35 et
plus ».

**LES FORMES RÉGIONALES SONT DES ESPÈCES À PART**, décidé par Callista. Les dix fichiers de
la V1 les REPLIAIENT sur l'espèce de base — « Miaouss d'Alola » y est « Miaouss », numéro 52.
Les sept neufs leur donnent leur identifiant PokeAPI propre : « Électrode de Hisui » est
10232, pas 101. Seize formes. **Les dix anciens fichiers n'ont pas été repris** — ça
changerait 298 tables en service, c'est un autre geste, et il attend une décision.

> **Le piège de Darumacho de Galar.** PokeAPI le nomme `darmanitan-galar-standard` (10177)
> et `darmanitan-galar-zen` (10178), donc il échappe à un filtre sur le suffixe `-galar`. On
> prend le standard : le mode Zen est un état de combat, pas une espèce qu'on rencontre.

**Une précaution qui a servi** : les pourcentages font la somme EXACTE de 100.
`verifieTable` tolère 0,001 d'écart, et 100/62 arrondi à deux décimales dérive de 0,04 —
assez pour faire tomber la table. La dernière part absorbe le reste.

---

## 11. La chaîne

| | Quoi |
|---|---|
| ✓ | **Zéro dépendance au réseau** dans les tests : `@std/assert` recopié dans `vendoreur/` |
| ✓ | Garde-fou n° 7, 8, 9 et 11 : **les quatre fichiers dérivés correspondent à leurs sources** — la feuille assemblée, le paquet du navigateur, l'index des espèces, le seed du catalogue |
| ✓ | **Garde-fou n° 10 : aucune clé de service dans le dépôt** |
| ✓ | **Garde-fou n° 12 : les bornes du panier.** Elles sont écrites en TypeScript ET en SQL, parce qu'on n'importe pas l'un dans l'autre. Il les RELIT des deux côtés au lieu de les croire |
| ✓ | `outils/purger.sh` : **refuse de purger si le local est en avance**, et imprime les adresses à ouvrir quand le shell n'a pas de réseau |
| ✓ | **La construction CSS et JS est branchée au CI** — par le garde-fou, pas par une étape de construction. **Revérifié le 5 octobre en cassant les deux exprès** : les deux sortent en code 1 |
| ✓ | **Les tests de navigateur sont dans le CI** : `deno task test:navigateur` |
| ✓ | **Le CI exige de voir tourner les contrats de la boutique ET du pokédex** (`grep -q "boutique réelle · "`, `grep -q "pokédex réel · "`). Sans ça leurs dix-neuf cas pourraient se sauter en silence, et c'est le seul endroit où le SQL de facturation et de rangement s'exécute |

### 11 bis. Le bac à sable a un PostgreSQL — et c'est ce qui a trouvé la faille

**`psql` et PostgreSQL 16 sont installés dans le bac à sable.** On l'a découvert le
5 octobre, après trois jours à croire qu'on ne pouvait pas exécuter de SQL ici. Monter une
base vide et y rejouer les migrations prend vingt secondes :

```sh
initdb -D /var/tmp/wmpg/data -A trust -E UTF8 --locale=C
pg_ctl -D /var/tmp/wmpg/data -o "-k /var/tmp/wmpg -c listen_addresses=''" start
for m in supabase/migrations/*.sql; do psql "$URL" -v ON_ERROR_STOP=1 -f "$m"; done
```

**Deux prérequis.** Un **prélude** qui crée ce que Supabase fournit : les rôles `anon`,
`authenticated`, `service_role`, le schéma `auth` avec `auth.uid()` et `auth.role()`. Et un
chemin que l'utilisateur `postgres` peut traverser — `/var/tmp`, pas le dossier de travail,
dont les droits font échouer `pg_ctl` avec « Permission denied ».

**Ce que ça rend possible, et qui ne l'était pas :**

- **rejouer les douze migrations depuis zéro.** Elles passent — c'est la première fois que
  c'est vérifié ailleurs que dans le CI ;
- **faire tourner la suite de contrat ici**, 48 tests, dont les douze `Supabase · …` qui ne
  s'exécutaient jamais en local ;
- **trouver les cinq défauts de la boutique** (§3 ter) et les trois du pokédex
  (§3 quinquies). Aucun autre outil du dépôt ne pouvait les voir.

**Et vérifier qu'un test attrape vraiment ce qu'il prétend** : on réintroduit le défaut dans
la base, on regarde le test crier, on restaure. Fait les deux jours, dans les deux sens.
**C'est la seule façon de savoir qu'un test de régression en est un.**

> **ET IL FAUT FAIRE TOURNER LES SUITES ENSEMBLE.** Le désaccord de dates du pokédex ne se
> voyait QUE suite complète : chaque fichier passait seul. **Deux fonctions qui écrivent la
> même table ne se contredisent jamais dans le test de l'une d'elles.**

### Un push n'est pas une livraison

**QUARANTE-HUIT HEURES après un push, le forum recevait encore la feuille d'avant.** Le
cache de branche ne se vide pas tout seul dans un délai sur lequel on puisse compter.

1. **La purge fait partie de la livraison.**
2. **Ni le bac à sable ni le shell du Mac ne joignent `purge.jsdelivr.net`** — ça se fait en
   ouvrant l'adresse dans le navigateur.
3. **`"status": "finished"` NE VEUT PAS DIRE QUE LA PURGE A EU LIEU.** Deux pièges
   différents : **le bridage** — purger deux fois le même chemin dans la même demi-heure
   rend `"throttled": true` **et aucun bloc `providers`**, et c'est ce bloc le signal, pas
   le `"finished"` (18 min de réarmement pour le CSS, 36 pour le JS) ; et **le cache du
   navigateur**, qui ment par-dessus — la bonne mesure est
   `performance.getEntriesByType('resource')`, `transferSize: 0` voulant dire cache
   navigateur. **Ne pas vérifier avec `fetch({cache:'reload'})`** : il contourne le cache du
   navigateur, donc il rend la bonne taille pendant que la page utilise l'ancienne.
4. **Pour trancher, interroger l'URL épinglée au commit.** Le plus sûr : récupérer le texte
   de la feuille épinglée et l'injecter en `<style>`, après avoir mis `disabled = true` sur
   l'ancienne. Ni cache, ni timing, ni mélange des deux versions. jsDelivr **répond 503 si
   on ajoute un paramètre de requête**.
5. **`texte.length` compte des CARACTÈRES**, il faut `new TextEncoder().encode(t).length`.

### Le pont vers le Mac peut livrer du périmé en disant « écrit », et il peut aussi tomber

Arrivé **cinq fois** le 5 octobre, dont une avec `force`. Deux ont produit un commit
parasite. Et le 6 octobre il s'est simplement **coupé** au milieu du travail — ni commit, ni
transfert, jusqu'à son retour. Cinq règles :

1. **Comparer par EMPREINTE, pas par taille.** `md5` des deux côtés, avant `git commit`. La
   taille ne suffit pas : `l'œil` et `l'oeil` font le même nombre d'octets en UTF-8. Les
   tailles concordaient, les fichiers différaient.
   **Et comparer le CONTENU, pas la sortie de `md5sum`** : elle inclut le nom du fichier,
   donc deux arborescences identiques donnent des empreintes différentes si les chemins
   diffèrent d'un `./`. Payé une fois — `md5sum < fichier` règle la question.
2. **Quand ça recommence, modifier sur place** — un script Python lancé sur le Mac qui
   remplace un bloc exact **et refuse s'il n'y a pas exactement une correspondance**, puis
   l'outil de régénération. Ne jamais recopier un contenu lu dans une sortie d'outil, qui
   peut être tronquée. **Ce refus a servi deux fois** : appliqué à la copie de cette planche
   dans le dépôt, il a refusé les dix-huit remplacements d'un coup — et il avait raison, la
   copie était périmée de 130 lignes. **Mais une garde doit être PRÉCISE** : chercher
   `appliquer_cloture` dans un fichier qui la mentionne en commentaire refuse à tort.
3. **Un commit parasite se défait avec `git reset --mixed HEAD~1`**, pas `--hard`.
4. **POUR UN GROS LOT, NE PAS TRANSFÉRER — RÉGÉNÉRER.** Les 1 838 sprites font 9 Mo et
   auraient demandé trente-sept allers-retours. Le Mac joint
   `raw.githubusercontent.com` et a Pillow : `outils/sprites.py` y a été relancé, et la
   carte produite des deux côtés a la **même empreinte md5 et la même taille à l'octet**.
   C'est le déterminisme de l'outil qui rend ce raccourci sûr — et c'est vérifiable.
5. **Quand le pont tombe, on continue dans le bac à sable** et on transfère au retour. Le
   travail n'est pas perdu, il est juste en attente.

**`.github/workflows/ci.yml` n'est pas écrivable par le pont** — « protected file ». Il se
modifie sur place, par la méthode 2.

### Garde-fou n° 10 : deux fausses alertes qui valent d'être dites

- Chercher `eyJ` suivi de trente caractères attrapait **nos propres marqueurs** :
  `[[WM:eyJ0IjoieHAi…]]` est du base64 lui aussi. D'où la structure complète exigée.
- Et la règle **ne mordait pas**, parce que `git ls-files` ne liste que le suivi : les
  fichiers d'essai fraîchement créés passaient au travers. C'est exactement le fichier qu'on
  veut examiner. `--cached --others --exclude-standard` répare.

### Garde-fou n° 3 : « un test pour chaque chose » mord aussi sur les fichiers de types

Ajouter une classe d'erreur dans `ports.ts` l'a fait crier : le fichier devenait du code
exécutable, et il promettait de n'en contenir aucun. **La bonne réparation était de déplacer
la classe**, pas d'écrire un test pour une erreur d'une ligne. Un garde-fou qui gronde a
parfois raison sur l'architecture plutôt que sur la couverture.

---

## 12. L'exploitation

| | Quoi |
|---|---|
| ✓ | Le compte de publication dédié : **Maître du Jeu (u3)**. Compte de test : **u4** |
| ✓ | Le champ de profil `clé de liaison` créé et vérifié de bout en bout |
| ✓ | **Les couleurs de groupe** reprises par Callista |
| ✓ | **Des règles posées sur un forum**, pour pouvoir vérifier `#forum_rules` |
| ✓ | **Le sujet de boutique créé** : `t977`, dans « Le Marché de Rhode » (`f3`), sous « Station Service » (`f18`). 34 articles, HTML rendu, attributs intacts |
| ✓ | **Le catalogue appliqué en base** : 34 lignes, somme 60 850 ₽ |
| ✓ | **`0011` appliquée** — la boutique sert pour de vrai |
| · | **Appliquer `0012`** — le pokédex |
| · | **Relire les prix du catalogue.** Ils sont une proposition, ancrée sur la seule valeur qui existait (Poké Ball à 200 ₽) |
| · | **Faire le ménage dans les champs de profil** — quarante-six champs de la V1, dont une série dont le libellé est « . » |
| · | Poser les secrets (§6) |
| · | Trier les 18 scripts JavaScript de la V1 avant d'ajouter le nôtre |
| · | **⚠ `f106` GESTION est LISIBLE par un visiteur déconnecté**, sujets compris — mesuré le 6 octobre : HTTP 200, six titres listés, messages rendus. Ses voisins de la Zone staff, eux, sont fermés : la permission a été oubliée sur celui-là. Planche 44 |
| · | Le coin d'outils est `position: fixed` en bas à droite : **toute page qui pose une action à cet endroit doit lui rendre ses 108 px** — ou mettre l'action à gauche, voir §8 |
| · | Les 30 images de zones à fournir (`46-les-images-qui-manquent.md`) |
| · | **Voir le bouton de clôture et le panier depuis un vrai compte connecté** |
| · | **Supprimer la copie périmée de cette planche** à la racine du dépôt |

### Les trois services de la V1 ne sont pas ce que le plan croyait

Relevé le 5 octobre, et ça change ce qu'il y a à automatiser :

| Sujet | Ce que c'est vraiment |
|---|---|
| `t215` Le marchand du refuge | **vend des Pokémon**, huit par mois, avec des dés Niveau / Sexe / Chromatique. Pas une boutique d'objets. Et « en vacances » depuis mars |
| `t99` Ramener un fossile | trois morceaux (un seul avec un certain objet), **un dé Fossile** qui décide de l'espèce, un scientifique qui assiste, le **staff** qui ajoute à la carte. Le plan disait « toujours la même espèce, au niveau 15 » — c'est faux |
| `t98` Créer son élevage | **demander l'ouverture de son propre élevage**, réservé au groupe Xerneas, le staff ouvre un sous-forum. Pas « déposer un Pokémon en pension » |
| `t61` / `t72` « Boutique » | **toutes deux de la REVENTE**, à moitié prix, et chacune renvoie à l'autre pour « ce qui ne se vend pas là-bas ». Copier-coller circulaire de la V1 |

**ET CE QUI MANQUE N'EST PAS UN MÉCANISME.** Cette planche a longtemps dit « reste à décider
comment un dé Forumactif se relie à un tirage serveur ». **C'était faux** : la planche 40 §1
a tranché le 1er octobre que *« l'automatisation remplace les dés — pas de dés, pas de
calculatrice »*. Le serveur tire, avec la graine du message, comme pour les rencontres. Il
n'y a aucun pont à concevoir.

Ce qui manque, service par service, c'est de la **donnée** — et c'est à Callista :

| Service | Ce qu'il faut écrire |
|---|---|
| `t215` **le refuge** | quelles espèces, combien par mois, à quel prix. Le tirage niveau / sexe / chromatique, lui, est déjà le même mécanisme que les rencontres |
| `t99` **les fossiles** | **la table fossile → espèce.** Un dé décidait ; il faut maintenant dire quel fossile donne quoi, et avec quelle probabilité |
| `t98` **l'élevage** | rien à automatiser : c'est une demande d'ouverture de sous-forum, donc du travail de staff. À sortir de la liste des tâches de relève |

Une fois ces trois tables écrites, les tâches 4 et 5 sont du code ordinaire.

---

## 13. L'ordre

1. **Appliquer `0012`**, puis **taguer `v*` et déployer la relève**, les secrets posés
   d'abord (§6), puis la regarder tourner une fois à la main avant de la mettre sur une
   horloge. **Quatre tâches sont branchées** : les zones, les bilans, la boutique, le pokédex.
2. **Les trois services de la V1** : refuge, fossiles, élevage. Ce qui manque n'est **pas**
   un mécanisme — c'est de la **donnée**. Voir §12.
3. **Les deux tâches qui restent à la relève** : le palier, et les fossiles une fois leur
   table écrite.
4. **Le carnet**, puis les annexes : la page HTML et sa feuille écrites ensemble.
5. **`portal_body` et `groupcp_info_body`**, dont les sources ne sont pas versées.
6. **Les dix fichiers de faune de la V1**, qui replient encore les formes régionales sur
   l'espèce de base. 298 tables en service — c'est une décision, pas un refactor.
7. **Les champs de profil et les images** : des décisions, pas du code.
