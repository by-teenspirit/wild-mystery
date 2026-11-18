// ════════════════════════════════════════════════════════════════════
//  src/application/fiche-de-combat.test.ts
//
//  Trois choses à garder, et elles tiennent toutes à la même cause :
//  **ce balisage part sur le forum, posté par NOTRE compte.**
//
//  **Pas de retour à la ligne.** Forumactif en fait un `<br>`. Le
//  défaut est connu — « un `<br>` de l'éditeur traînait entre chaque
//  poste », 10 novembre.
//
//  **Le surnom s'échappe.** C'est la seule donnée de ces messages
//  qu'un joueur écrit lui-même, et rien ne la filtre entre son carnet
//  et le message : la base ne filtre pas, et le forum fait confiance
//  au compte qui poste.
//
//  **Une fiche incomplète tient debout.** Une espèce hors Pokédex n'a
//  pas de sprite, un tour ne connaît ni niveau ni types. La fiche doit
//  rendre ce qu'elle a, sans écrire « undefined » ni laisser une
//  balise vide.
// ════════════════════════════════════════════════════════════════════

import { assert, assertEquals, assertStringIncludes } from "@std/assert";
import {
  duel,
  echapper,
  enveloppe,
  fiche,
  joindre,
  nomAffiche,
  pastillesDeType,
} from "./fiche-de-combat.ts";

const RACINE = "https://exemple.test/wm/";

Deno.test("les quatre caractères qui comptent", () => {
  //  `&` D'ABORD, sinon on échappe ses propres échappements : `&lt;`
  //  deviendrait `&amp;lt;`.
  assertEquals(echapper("a & b"), "a &amp; b");
  assertEquals(echapper("<b>"), "&lt;b&gt;");
  assertEquals(echapper('dit "oui"'), "dit &quot;oui&quot;");
  assertEquals(echapper("&<>"), "&amp;&lt;&gt;");
});

Deno.test("L'APOSTROPHE RESTE UNE APOSTROPHE", () => {
  //  Elle n'est utile que pour sortir d'un attribut écrit entre
  //  apostrophes, et ce fichier n'en écrit aucun. L'échapper rendait la
  //  source illisible — « Ça n&#39;a aucun effet. » — et il y a une
  //  apostrophe par phrase en français.
  assertEquals(echapper("Ça n'a aucun effet."), "Ça n'a aucun effet.");
});

Deno.test("AUCUN ATTRIBUT ENTRE APOSTROPHES — c'est la règle qui remplace", () => {
  //  Si un attribut s'écrivait entre apostrophes ici, l'apostrophe non
  //  échappée en sortirait. C'est l'attribut qu'il faudrait corriger,
  //  et c'est ce test qui le dirait.
  const html = joindre([
    fiche({ especeId: 4, nom: "Salamèche", pv: 18, pvMax: 18 }, "mien", RACINE),
    duel("<div></div>", "<div></div>"),
    enveloppe("tour", ["<p>x</p>"]),
    pastillesDeType(["feu"]),
  ]);
  assert(!/=\s*'/.test(html), html);
});

Deno.test("joindre ne met rien entre les morceaux", () => {
  //  Un espace entre deux balises devient un `<br>` chez Forumactif.
  assertEquals(joindre(["<a>", "<b>"]), "<a><b>");
  assertEquals(joindre([]), "");
});

Deno.test("les pastilles portent la classe ET l'attribut", () => {
  //  La classe colore, l'attribut sert au `::before` : les deux sont
  //  dans `13-composants.css` depuis le 8 novembre.
  assertEquals(
    pastillesDeType(["feu"]),
    '<span class="wm-type wm-type--feu" data-wm-type="feu">Feu</span>',
  );
  assertStringIncludes(pastillesDeType(["eau", "plante"]), "wm-type--plante");
});

Deno.test("UN TYPE QUI N'EN A PAS LA FORME EST LAISSÉ DEHORS", () => {
  //  Un type inconnu dans un nom de classe ne donnerait aucun style,
  //  donc une pastille nue au milieu de pastilles colorées. Mieux vaut
  //  qu'elle n'y soit pas — et que le garde-fou n° 37 le dise.
  assertEquals(pastillesDeType(["Feu"]), "");
  assertEquals(pastillesDeType(['x" onmouseover="alert(1)']), "");
  assertEquals(pastillesDeType(["feu", "PAS-UN-TYPE"]), pastillesDeType(["feu"]));
});

Deno.test("une fiche complète, et rien de plus", () => {
  assertEquals(
    fiche(
      {
        especeId: 77,
        nom: "Ponyta",
        niveau: 10,
        types: ["feu"],
        pv: 30,
        pvMax: null,
        attaque: 22,
        defense: 16,
      },
      "sauvage",
      RACINE,
    ),
    '<div class="wm-combat__camp wm-combat__camp--sauvage">' +
      '<img class="wm-combat__sprite" ' +
      'src="https://exemple.test/wm/assets/sprites-figes/forum/77.png" alt="" loading="lazy">' +
      '<p class="wm-combat__nom">Ponyta</p>' +
      '<p class="wm-combat__niveau">niv. 10</p>' +
      '<p class="wm-combat__types">' +
      '<span class="wm-type wm-type--feu" data-wm-type="feu">Feu</span></p>' +
      '<p class="wm-combat__pv">30 PV</p>' +
      '<p class="wm-combat__stats">Att. 22 · Déf. 16</p>' +
      "</div>",
  );
});

Deno.test("une fiche de tour n'a ni niveau ni types, et tient", () => {
  //  `tours_a_poster` ne les rend pas : en combat, ce qui compte est
  //  l'état, pas l'affiche — elle a été lue au premier message.
  const html = fiche(
    { especeId: 4, nom: "Salamèche", pv: 11, pvMax: 18 },
    "mien",
    RACINE,
  );
  assert(!html.includes("undefined"), html);
  assert(!html.includes("wm-combat__niveau"), html);
  assert(!html.includes("wm-combat__types"), html);
  assert(!html.includes("wm-combat__stats"), html);
  assertStringIncludes(html, ">11/18 PV<");
});

Deno.test("sans sprite, pas de balise image", () => {
  //  L'espèce de test `Debugant` est dans ce cas. Une image cassée se
  //  voit plus qu'une image absente.
  const html = fiche({ especeId: 0, nom: "Debugant", pv: 30 }, "sauvage", RACINE);
  assert(!html.includes("<img"), html);
  assertStringIncludes(html, ">Debugant<");
});

Deno.test("LE SURNOM D'UN JOUEUR NE SORT PAS DU TEXTE", () => {
  const html = fiche(
    {
      especeId: 4,
      nom: "Salamèche",
      surnom: "</p><script>alert(1)</script><p>",
      pv: 18,
      pvMax: 18,
    },
    "mien",
    RACINE,
  );
  assert(!html.includes("<script>"), html);
  assert(!html.includes("</p><script"), html);
  assertStringIncludes(html, "&lt;/p&gt;&lt;script&gt;");
});

Deno.test("le surnom ne fait pas disparaître l'espèce", () => {
  assertEquals(nomAffiche("Salamèche", "Biscotte"), "Biscotte (Salamèche)");
  assertEquals(nomAffiche("Salamèche", null), "Salamèche");
  assertEquals(nomAffiche("Salamèche", undefined), "Salamèche");
  assertEquals(nomAffiche("Salamèche", "  "), "Salamèche");
});

Deno.test("un duel à un seul camp n'a pas de mot entre deux", () => {
  //  Équipe vide, planche 99 §5.3 : « contre » devant rien se lirait
  //  comme un bogue.
  const seul = duel("<div>a</div>", null);
  assertEquals(seul, '<div class="wm-combat__duel"><div>a</div></div>');
  assertStringIncludes(duel("<div>a</div>", "<div>b</div>"), "wm-combat__contre");
});

Deno.test("LE MOT « CONTRE » EST DANS LE BALISAGE", () => {
  //  Pas en `::before` : un lecteur d'écran doit l'entendre, et un
  //  contenu CSS ne s'entend pas partout.
  assertStringIncludes(duel("<div>a</div>", "<div>b</div>"), ">contre<");
});

Deno.test("l'enveloppe dit de quel message il s'agit", () => {
  //  Pour que la rencontre puisse se poser autrement que le tour sans
  //  qu'on touche à l'autre.
  assertEquals(
    enveloppe("rencontre", ["<p>x</p>"]),
    '<div class="wm-combat wm-combat--rencontre"><p>x</p></div>',
  );
  assertStringIncludes(enveloppe("tour", []), "wm-combat--tour");
});

Deno.test("RIEN DE TOUT ÇA NE PORTE DE RETOUR À LA LIGNE", () => {
  const tout = joindre([
    enveloppe("rencontre", [
      duel(
        fiche(
          {
            especeId: 77,
            nom: "Ponyta",
            niveau: 10,
            types: ["feu"],
            pv: 30,
            attaque: 22,
            defense: 16,
          },
          "sauvage",
          RACINE,
        ),
        fiche(
          { especeId: 4, nom: "Salamèche", pv: 11, pvMax: 18 },
          "mien",
          RACINE,
        ),
      ),
    ]),
  ]);
  assert(!tout.includes("\n"), tout);
});
