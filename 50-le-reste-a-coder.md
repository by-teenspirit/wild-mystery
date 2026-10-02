# Tout ce qu'il reste à coder

Dressé le 1er octobre 2026. Contrat d'architecture : `47-l-architecture-du-code.md`.
Règle de mise en page : `49-zero-tableau-que-du-flexbox.md`. Partage dépôt / panneau
d'administration : `48-…` §8.

Légende : **✓** fait et vérifié · **◐** commencé · **·** à faire · **?** décision à prendre
avant d'écrire.

---

## 0. Ce qui est déjà debout

| | Quoi |
|---|---|
| ✓ | `src/domaine/experience.ts` — barème, seuils, montées de niveau · 15 tests |
| ✓ | `src/domaine/cloture.ts` — rejeu du registre, ce qui manque · 13 tests |
| ✓ | Couverture du domaine à 100 % (lignes, fonctions, branches), vérifiée par `outils/couverture.sh` |
| ✓ | `supabase/schema.sql` et `supabase/fonctions.sql` — montent sur un PostgreSQL 16 vierge sans une erreur |
| ✓ | `supabase/tests/garanties.sql` — 24 assertions pgTAP, toutes vertes |
| ✓ | `.github/workflows/ci.yml` — six travaux, déploiement sur tag `v*` |
| ✓ | `outils/garde-fou.sh` — quatre refus, testés en les cassant exprès |
| ✓ | `src/domaine/alea.ts`, `rencontre.ts`, `code.ts` — graine reproductible, tirage, code de vérification |
| ✓ | `src/application/ports.ts` — les onze interfaces |
| ✓ | `src/adaptateurs/en-memoire/` — registre, état du jeu, clôture, catalogue, forum, horloge, signataire de test |
| ✓ | `src/contrat/registre.contrat.ts` — 12 essais partagés, passés par le faux |
| ✓ | `src/application/cloturer-un-sujet.ts` — le premier cas d'usage, 11 tests |
| ✓ | **84 tests, 0 échec. Domaine : 274 lignes, 22 fonctions, 84 branches, 100 %.** |
| ✓ | `css/01-deflottement.css` — écrit, pas encore posé sur le forum |
| ✓ | `overall_header` — Material Symbols Rounded ajoutée et publiée |

---

## 1. Les décisions à prendre avant d'écrire

Quatre questions bloquent du code. Aucune ne demande de recherche, juste un choix.

| | Question | Les options |
|---|---|---|
| ? | **L'identité du joueur côté navigateur.** Le schéma lit une revendication `joueur_id` dans le JWT ; la décision du 30 septembre (`33-le-carnet-de-bord.md` §2) dit « le staff associe, le joueur se connecte par lien magique », donc Supabase Auth, donc `sub` et pas `joueur_id`. Les deux ne collent pas. | **(a)** ajouter `joueur.auth_id uuid unique references auth.users(id)` et réécrire `joueur_courant()` en `select id from joueur where auth_id = auth.uid()` — simple, c'est Supabase qui gère les sessions ; **(b)** émettre nos propres JWT depuis une fonction Edge — plus de code, plus de surface. **Je recommande (a).** |
### Le champ de profil comme boîte aux lettres — vérifié le 1er octobre

Testé sur le forum réel, champ `clé de liaison` (id 2), type *Champ texte*, **Affichage : ni
Profil ni Messages**, **statut minimum : Invités**, **modifiable par le membre : Non**.

| Qui, où | Voit la valeur ? |
|---|---|
| Admin, panneau d'administration > Gestion des utilisateurs > éditer un membre | **oui**, c'est là qu'on l'écrit |
| Le propriétaire, `/profile?mode=editprofile` | **oui** — valeur écrite depuis le PA, relue telle quelle |
| Un invité, `/uN` (profil public) | non |
| Un invité, `/memberlist` | non |
| Un invité, dans un sujet | non |
| Un invité, `/profile?mode=editprofile` | non (ni le champ, ni son libellé) |

Donc le montage tient : **l'admin dépose, le propriétaire seul relit, personne d'autre ne voit
rien.** Le script peut aller chercher `/profile?mode=editprofile` en même origine et y prendre le
jeton sans que le joueur ne fasse quoi que ce soit.

Une réserve : la vérification a été faite depuis le compte fondateur, donc depuis un
administrateur. Reste à confirmer qu'un membre ordinaire voit bien le champ sur sa propre page
d'édition alors qu'il n'a pas le droit de le modifier. Le réglage « statut minimum : Invités »
plaide pour, mais le plus sûr est de **cocher « L'utilisateur lui même »** : le champ apparaît
alors à coup sûr dans son formulaire. C'est sans risque — un joueur ne peut pas lire le jeton
d'un autre, donc il n'a rien à y coller d'utile, et au pire il efface le sien et on le réémet.

Il faut aussi, dans ce cas, **nommer le champ sans ambiguïté** et mettre une description du genre
« ne touchez pas à ce champ », sinon quelqu'un le videra par curiosité.

| | **Au passage : un champ de profil ne peut jamais contenir un secret.** Forumactif filtre la visibilité d'un champ selon le **statut de celui qui regarde**, pas selon le propriétaire de la fiche. Un champ que le joueur voit sur sa propre page est donc vu par tous ceux qui ont le même statut, sur la page de tout le monde. Il n'existe pas de « visible seulement par son propriétaire ». Un champ de profil peut porter une **preuve jetable** — un code de liaison à usage unique — jamais une clé permanente. Le tableau ci-dessus montre la seule configuration où la valeur reste privée : affichage coupé, et lecture par le propriétaire sur sa page d'édition. |
| ? | **Comment on fabrique le fichier du navigateur.** Le domaine est en TypeScript et sert aux deux côtés ; le navigateur veut un seul fichier. | `deno bundle`, ou esbuild appelé depuis le CI. À trancher en écrivant l'étape de construction. |
| ? | **Comment on teste le JS du navigateur.** La règle est « un test pour chaque chose ». | un DOM en mémoire (`deno-dom`, `linkedom`) pour les modules d'affichage ; le vrai navigateur seulement pour les parcours. |
| ✓ | **Les zones de jeu sont lisibles par les invités.** Tranché le 1er octobre. | La relève lit le forum comme un simple visiteur. Le compte de publication ne sert plus qu'à **écrire** : plus de cookie de session à maintenir, la pièce la plus fragile du montage disparaît. Deux suites : vérifier que les **profils** (`/uN`) sont eux aussi ouverts aux invités, sinon la vérification du code de liaison casse ; et les RP deviennent indexables, ce qui donne du poids au *trigger warning* de la planche 39. |

---

## 2. Le domaine — les règles pures

Zéro import, zéro horloge, zéro réseau. 100 % de couverture exigés.

| | Fichier | Ce qu'il décide |
|---|---|---|
| ✓ | `experience.ts` | multiplicateur par palier, seuils, montées de niveau |
| ✓ | `cloture.ts` | rejeu du registre dans l'ordre des messages, ce qui manque, ce qui est versé |
| ✓ | `alea.ts` | la graine et la suite reproductibles, sur lesquelles repose tout l'arbitrage |
| ✓ | `rencontre.ts` | le tirage d'une espèce : zone, palier, rareté, graine déterministe. Même graine, même rencontre — c'est ce qui rend le tirage rejouable par le staff en cas de litige |
| ✓ | `code.ts` | le code de vérification publié dans le module (`WM-7K2P-9QX`) : fabrication depuis la graine, forme, validation |
| · | `mots.ts` | le comptage de mots d'un message, une fois le BBCode et les balises retirés. Le serveur relit le message, il ne croit pas le compteur du navigateur |
| · | `pension.ts` | `floor(jours / 10)` niveaux, plafonné à 10 ; les deux dépôts maximum |
| · | `badges.ts` | palier 2 à trois badges, palier 3 à sept ; ce que ça ouvre |

Chaque fichier arrive avec son `.test.ts` à côté, sinon le garde-fou refuse la *pull request*.

---

## 3. L'application — ports et cas d'usage

Dépend du domaine et des ports, jamais d'un adaptateur. Injection par constructeur.

| | Fichier | Contenu |
|---|---|---|
| ✓ | `ports.ts` | `LecteurDeForum`, `PosteurSurForum`, `Registre`, `EtatDuJeu`, `Horloge`, `Alea`. Des interfaces fines et séparées : la relève lit et poste, un futur outil de vérification ne fera que lire |
| · | `lire-les-nouveaux-messages.ts` | tâche 1 : les messages parus depuis le dernier passage, les blocs générés, les lignes du registre |
| ✓ | `cloturer-un-sujet.ts` | tâche 2 : vérifier, appliquer en une transaction, poster le bilan ou le refus |
| · | `servir-une-commande.ts` | tâche 3 : la boutique, prix relu en base, `ARGENT_INSUFFISANT` |
| · | `rendre-les-pensions.ts` | tâche 4 |
| · | `rendre-les-fossiles.ts` | tâche 5 |
| · | `synchroniser-le-palier.ts` | tâche 6 : le rang Forumactif suit le palier. Le seul endroit où le mur de `_userdata` est contourné, parce que le serveur lit `/uN` |
| · | `ranger-le-pokedex.ts` | tâche 7 |
| · | `oublier-les-abandons.ts` | tâche 8 : le ménage hebdomadaire |

Chacun avec son test de cas d'usage, contre des adaptateurs en mémoire.

---

## 4. Les adaptateurs

| | Dossier | Contenu |
|---|---|---|
| ✓ | `adaptateurs/en-memoire/` | les faux : `RegistreEnMémoire`, `ForumEnMémoire`, `HorlogeFigée`, `AleaÀGraine` |
| · | `adaptateurs/supabase/` | `RegistreSupabase` et le reste, sur le client Supabase |
| · | `adaptateurs/forumactif/lecture.ts` | lire un sujet, extraire les messages, l'auteur, l'id, la date, les blocs générés. C'est de l'analyse de HTML : à isoler et à tester sur des pages enregistrées en `fixtures/` |
| · | `adaptateurs/forumactif/publication.ts` | poster une réponse avec le compte de publication, mention `@pseudo` en tête |
| ◐ | `contrat/registre.contrat.ts` | **la suite partagée** : elle tourne contre l'adaptateur en mémoire, puis contre le vrai, sur un PostgreSQL de CI. C'est elle qui empêche le faux de mentir |

---

## 5. La base

| | Quoi |
|---|---|
| · | Aligner l'identité sur la décision prise au §1 : colonne `auth_id`, `joueur_courant()` réécrite, politiques RLS revues |
| · | **Remplacer `cloturer()` par `appliquer_cloture(p_sujet, p_versements jsonb, p_code)`** : elle ne vérifie plus, elle verse. Le verdict est calculé une seule fois, dans le domaine, et sert aussi au navigateur. Décision du 2 octobre, `47-…` §7 |
| · | `journal` — la table « La vie de Rhode » (`acteur`, `verbe`, `objet`, `lieu`, `date`), écrite par les fonctions Edge seulement, lue publiquement |
| · | `sujets_mj` — le drapeau « je veux un MJ » posé à la création d'un sujet |
| · | `releve` / `releve_journal` — vérifier qu'elles tiennent ce dont la fonction Edge a besoin (dernier passage, verrou, erreurs) |
| · | Étendre pgTAP : le versement complet d'une clôture, les politiques RLS vues depuis un joueur et depuis un autre, l'idempotence `(message_id, type)` sous concurrence |
| · | Les migrations : passer de `schema.sql` monolithique à `supabase/migrations/` numérotées, sinon `supabase db push` n'a rien à pousser |

---

## 6. La fonction Edge

| | Quoi |
|---|---|
| · | `supabase/functions/releve/index.ts` — **racine de composition** : le seul endroit où on écrit `new …Supabase()`. Zéro règle |
| · | Le verrou : deux passages ne doivent pas se marcher dessus (la tâche tourne toutes les cinq minutes) |
| · | La reprise sur erreur : une tâche qui échoue ne doit pas bloquer les sept autres |
| · | Redécouper `forum.ts` et `releve.ts`, écrits avant le contrat. Ils lisent `Deno.env` au chargement et appellent `fetch` directement, donc ils sont intestables tels quels (`47-…` §6) |

---

## 7. Le navigateur

Un seul fichier servi par jsDelivr. Il partage `src/domaine/` avec le serveur : **le barème
d'XP et le rejeu de clôture sont écrits une fois et compilés deux fois.** C'est ce qui garantit
que le bilan affiché et le bilan appliqué disent la même chose.

| | Module | Ce qu'il fait |
|---|---|---|
| · | `js/wild-mystery.ts` | le point d'entrée : routeur d'URL, lecture de `_userdata`, session Supabase, chargement des modules selon la page |
| · | `js/bilan.ts` | le module au-dessus du premier message, **zones sauvages seulement** (comparaison avec les dix-sept ids de `data/zones.json`), une colonne par joueur, le bouton Clôturer |
| · | `js/poster.ts` | le pré-remplissage du formulaire natif (`/post?t=…&mode=reply`) : bloc `[cloture]`, demandes de service. **Rien ne part tout seul**, le joueur clique sur Envoyer |
| · | `js/carnet.ts` | la page `/h14-mon-carnet` et ses huit onglets (`33-le-carnet-de-bord.md`) |
| · | `js/services.ts` | boutique, pension, laboratoire fossile, arènes — tous passent par un sujet posté |
| · | `js/pokedex.ts` | la page des 472 espèces, alimentée par `especes-rhode.json` |
| · | `js/carte.ts` | la carte de Rhode et ses dix-sept points |
| · | `js/journal.ts` | « La vie de Rhode » sur l'index, huit lignes, lues depuis `journal` |
| · | `js/switcheroo.ts` | **restylage seulement.** Le changeur de personnage existe, on ne le réinvente pas |
| · | `js/infobulle.ts` | l'infobulle Pokémon et le *trigger warning* (planche 39) |

Sans JavaScript, le forum reste lisible : le module ne s'affiche pas, le bilan de clôture est
un vrai message, et un lien « voir le bilan » renvoie au carnet.

---

## 8. Le CSS

Dans le dépôt, sauf les jetons (`48-…` §8).

| | Fichier | Contenu |
|---|---|---|
| ✓ | `css/01-deflottement.css` | flexbox à la place des flottants et des pourcentages |
| · | `css/02-socle.css` | typographie, titres, liens, boutons, champs, états de focus |
| · | `css/03-index.css` | catégories, lignes de forum, carte « La vie de Rhode » |
| · | `css/04-forum.css` | en-tête de forum, liste des sujets, pagination |
| · | `css/05-sujet.css` | message, fiche de personnage, boutons, module de bilan, infobulle |
| · | `css/06-ecrire.css` | la page de rédaction, les options, le lanceur de dés |
| · | `css/07-carnet.css` | les huit onglets du carnet |
| · | `css/08-annexes.css` | le gabarit d'annexe, sommaire sombre à 252 px |
| · | `css/09-mobile.css` | les points de rupture 1200 / 900 / 800 / 740 / 700 / 400 / 320 |
| · | **le bloc `:root` à coller dans le panneau d'administration** | les jetons de la charte, les douze de groupes, les deux modes. Il faut encore relever `texte/doux`, `texte/pale` et `texte/sur-nuit` dans Figma |

---

## 9. Les templates Forumactif

Sept à reprendre, chacun téléchargé avant modification, enregistré puis publié.

| | Template | Pourquoi |
|---|---|---|
| ✓ | `overall_header` | la police d'icônes ; il reste à y ajouter les deux lignes jsDelivr |
| · | `viewtopic_body` | le point d'ancrage du module de bilan, la fiche de personnage, et le `<table>` du bloc de règles |
| · | `posting_body` | le même bloc de règles, le lanceur de dés, la case « je veux un MJ » |
| · | `index_box` | les lignes de catégorie et de forum |
| · | `topics_list_box` | les lignes de sujets |
| · | `portal_body` | quatre tableaux imbriqués à remplacer |
| · | `memberlist_body` | la liste des membres |
| · | `groupcp_info_body` | la page des groupes (planche 09) |

---

## 10. Les données du dépôt

| | Fichier | État |
|---|---|---|
| · | `data/zones.json` | les dix-sept zones sauvages, leurs ids de forum, leur palier. **C'est lui qui décide où le module de bilan s'affiche** |
| · | `data/especes.json` | 472 espèces — `especes-rhode.json` existe, à mettre au format du dépôt |
| · | `data/faune.json` | les tables de rencontre par zone |
| · | `data/objets.json` | le catalogue de la boutique |
| · | `data/arenes.json` | les sept arènes, les quatre colosseums, les badges |

---

## 11. La chaîne

| | Quoi |
|---|---|
| · | L'étape de construction du navigateur : `src/domaine/` + `js/` → un `js/wild-mystery.js` et un `css/wild-mystery.css` |
| · | Brancher cette étape dans le CI, et vérifier que le fichier livré est bien celui du commit |
| · | Les tests de navigateur dans le CI |
| · | **Épingler l'URL jsDelivr sur le SHA du commit, jamais sur `@main`** — leçon du projet ADWAD : `@main` est renvoyé avec un cache de sept jours côté navigateur, et la purge est limitée à un appel toutes les trente minutes. Une URL figée est immuable et servie tout de suite |
| · | Vérifier la feuille CSS avant de livrer (`css-tree`, nombre de règles et zéro erreur) |

---

## 12. L'exploitation

| | Quoi |
|---|---|
| · | Créer le **compte de publication dédié** — ni le compte fondateur, ni un personnage joué, pour que son mot de passe puisse tourner sans toucher aux accès ni aux RP |
| · | Poser `FORUM_URL`, `FORUM_COMPTE`, `FORUM_MOTDEPASSE` dans Supabase › Edge Functions › Secrets. **Jamais dans le dépôt, jamais dans un fichier servi par jsDelivr** |
| · | Poser `SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_PASSWORD`, `SUPABASE_PROJECT_REF` dans les secrets GitHub |
| · | Vérifier que la clé de service ne sort jamais de Supabase, et que le navigateur ne reçoit que la clé publique |
| · | Créer le champ de profil « code de liaison » si on garde la liaison en libre-service |
| · | Trier les 18 scripts JavaScript de la V1 avant d'ajouter le nôtre |
| · | Sortir le forum de maintenance le jour de la bascule |

---

## 13. L'ordre

Ce qui débloque le plus de choses en premier.

1. **Les quatre décisions du §1.** Une demi-heure, et trois blocs de code se débloquent.
2. **`ports.ts` + les adaptateurs en mémoire + `contrat/registre.contrat.ts`.** Tant que le
   contrat n'existe pas, les tests de cas d'usage ne prouvent rien.
3. **`rencontre.ts` et `code.ts`**, qui sont du domaine pur et dont tout le reste dépend.
4. **`cloturer-un-sujet.ts`**, le cas d'usage le plus riche : il exerce le contrat, le domaine
   et les deux adaptateurs d'un coup.
5. **La racine de composition et le redécoupage de `releve.ts`.** Là, la relève tourne.
6. **Le navigateur**, en commençant par `wild-mystery.ts` et `bilan.ts` : c'est l'écran que les
   joueurs verront en premier.
7. **Le CSS et les templates**, qui peuvent avancer en parallèle de tout le reste et ne
   dépendent que de la charte et des images.

Les images et le bloc `:root` peuvent arriver à n'importe quel moment : rien n'attend après eux
sauf le rendu final.
