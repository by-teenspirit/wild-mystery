# Wild Mystery

Feuilles de style, scripts et automatisation du forum **Wild Mystery** — un forum RPG Pokémon
en région originale (Rhode), sur Forumactif ModernBB, avec un back-end Supabase.

Ce dépôt existe pour une raison précise : **un template Forumactif est plafonné à 65 535
caractères.** L'accueil en fait déjà 112 ko et la carte 105 ko. Tout ce qui est volumineux —
le CSS du thème, le SVG de la carte, les scripts de jeu — vit donc ici et est appelé depuis
le forum, au lieu d'être collé dans les templates.

---

## Ce qu'il y a dedans

| Dossier | Contenu |
|---|---|
| `css/` | la feuille de style du thème, découpée par écran |
| `js/` | les scripts appelés par le forum (combat, capture, Pokédex, carte…) |
| `assets/` | images servies au forum : bannière, carte, illustrations de zones |
| `fiche/` | la fiche de présentation du projet, en page autonome |

---

## Appeler un fichier depuis le forum

**Ne pas utiliser `raw.githubusercontent.com`** : les fichiers y sont servis en `text/plain`,
et le navigateur refuse alors d'appliquer une feuille de style. Passer par jsDelivr, qui sert
le bon type MIME, avec un cache et un CDN.

```html
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/by-teenspirit/wild-mystery@main/css/theme.css">
<script src="https://cdn.jsdelivr.net/gh/by-teenspirit/wild-mystery@main/js/combat.js"></script>
```

Où les coller, côté Forumactif :

- la feuille de style → *Affichage → Images et Couleurs → CSS principal* ;
- les scripts → *Modules → HTML & Javascript → Gestion des codes Javascript*.

### Le piège du cache

`@main` est mis en cache par jsDelivr pendant **12 heures**. Une correction poussée ici
n'apparaît donc pas tout de suite sur le forum. Trois façons de s'en sortir :

1. **Pendant le développement** — ajouter un paramètre qui change :
   `…/css/theme.css?v=17`. Le cache voit une nouvelle adresse.
2. **Purger** une fois la correction poussée :
   `https://purge.jsdelivr.net/gh/by-teenspirit/wild-mystery@main/css/theme.css`
3. **En production** — poser un tag (`git tag v1.2 && git push --tags`) et appeler
   `@v1.2` plutôt que `@main`. Un tag est mis en cache définitivement, donc rien ne
   casse sous les pieds des joueurs pendant qu'on travaille.

---

## La charte

Les couleurs viennent du fichier Figma *Wild Mystery — Design System*, collection `Couleur`,
mode **Aube**. Le mode **Ténèbra** est le thème sombre ; toute couleur écrite en dur ici ne
basculera pas, donc on passe par les variables CSS.

| Rôle | Jeton | Aube |
|---|---|---|
| Fond de page | `fond/page` | `#EECFB5` |
| Surface | `fond/surface` | `#FFFBF7` |
| Surface douce | `fond/douce` | `#F3E1D2` |
| Fond nuit | `fond/nuit` | `#3A2A22` |
| Encre | `texte/encre` | `#2E2018` |
| Corps | `texte/corps` | `#4E3B30` |
| Doux | `texte/doux` | `#6E5749` |
| Pâle | `texte/pale` | `#756054` |
| Accent primaire | `accent/primaire` | `#2E6E8E` |
| Accent fort | `accent/fort` | `#1F5470` |
| Accent terre | `accent/terre` | `#A8582F` |
| Filet fin | `bord/fin` | `#EADACD` |
| Filet net | `bord/net` | `#D9C3B1` |

Règle de partage : **le bleu pour ce qui se clique, le terre pour ce qui se lit.** Les liens,
les onglets actifs et les états interactifs sont en `accent/primaire` ou `accent/fort` ; les
compteurs, les chiffres et les mises en avant de contenu sont en `accent/terre`.

Trois rayons seulement — 6, 10, 999. Deux ombres — cartes `0 1px 3px rgba(20,48,58,.05)`,
panneaux `0 2px 10px rgba(20,48,58,.06)`.

Polices : **Fraunces** pour les titres et les chiffres, **Nunito Sans** pour le texte.

---

## La fiche de projet

`fiche/index.html` est la fiche de présentation destinée aux annuaires et aux forums de
publicité. Elle est autonome : styles en ligne, aucune police chargée, aucun script.

Le bloc `<style>` en tête ne sert qu'aux onglets, en boutons radio masqués avec `:checked`.
Si le forum de destination retire les balises `<style>`, la fiche reste lisible mais les
panneaux s'affichent les uns sous les autres au lieu de basculer. À vérifier en
prévisualisation avant de publier.

---

## Crédits

Design, maquettes et code : **CalliDesign** — callidesign.contact@gmail.com

Wild Mystery est la V2 d'un forum construit à l'origine avec **Foxblida / Plumtys**.

Pokémon appartient à Nintendo, Game Freak et The Pokémon Company. Ce projet est un forum de
jeu de rôle amateur, sans but lucratif.
