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
    '<div class="wm-combat__camp wm-combat__camp--sauvage" tabindex="0">' +
      '<img class="wm-combat__sprite" ' +
      'src="https://exemple.test/wm/assets/sprites-figes/forum/77.png" alt="Ponyta" loading="lazy">' +
      '<p class="wm-combat__nom">Ponyta</p>' +
      '<p class="wm-combat__niveau">niv. 10</p>' +
      '<p class="wm-combat__types">' +
      '<span class="wm-type wm-type--feu" data-wm-type="feu">Feu</span></p>' +
      '<p class="wm-combat__pv">30 PV</p>' +
      '<span class="wm-infobulle" role="tooltip"><span class="wm-infobulle__tete"><span class="wm-infobulle__nom">Ponyta</span><span class="wm-infobulle__niveau">Niv. 10</span></span><span class="wm-infobulle__types"><span class="wm-infobulle__type" data-wm-type="feu">Feu</span></span><span class="wm-infobulle__surtitre">Statistiques</span><span class="wm-infobulle__stats"><span class="wm-infobulle__stat"><span>Attaque</span><span>22</span></span><span class="wm-infobulle__stat"><span>Défense</span><span>16</span></span></span></span>' +
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
  //  ET PAS DE BULLE NON PLUS : elle ne dirait rien de plus que les PV
  //  déjà affichés, et une bulle qui s'ouvre pour rien est pire qu'une
  //  bulle absente.
  assert(!html.includes("wm-infobulle"), html);
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

// ── LA BULLE DES CHIFFRES ───────────────────────────────────────────

Deno.test("LA BULLE PORTE LES CHIFFRES, LA CASE PORTE L'ÉTAT", () => {
  //  « Tu peux du coup mettre les stats en infobulle. » Ce qui reste
  //  visible est ce qu'on lit à CHAQUE tour — nom, niveau, types, PV ;
  //  l'attaque et la défense ne bougent pas d'un tour à l'autre.
  const html = fiche(
    {
      especeId: 4,
      nom: "Salamèche",
      niveau: 5,
      types: ["feu"],
      pv: 9,
      pvMax: 18,
      attaque: 10,
      defense: 9,
    },
    "mien",
    RACINE,
  );
  const bulle = html.slice(html.indexOf("wm-infobulle"));
  const case_ = html.slice(0, html.indexOf("wm-infobulle"));

  assertStringIncludes(case_, ">9/18 PV<");
  assert(!case_.includes("Attaque"), case_);
  assertStringIncludes(bulle, "<span>Attaque</span><span>10</span>");
  assertStringIncludes(bulle, "<span>Défense</span><span>9</span>");
});

Deno.test("LA CASE EST FOCALISABLE — une bulle au survol n'existe pas au clavier", () => {
  const html = fiche(
    { especeId: 4, nom: "Salamèche", pv: 9, pvMax: 18, attaque: 10, defense: 9 },
    "mien",
    RACINE,
  );
  assertStringIncludes(html, 'tabindex="0"');
});

Deno.test("la jauge suit les PV, et s'arrête aux bornes", () => {
  const part = (pv: number, pvMax: number) => {
    const html = fiche(
      { especeId: 4, nom: "S", pv, pvMax, attaque: 1, defense: 1 },
      "mien",
      RACINE,
    );
    return /width:(\d+)%/.exec(html)?.[1] ?? null;
  };
  assertEquals(part(18, 18), "100");
  assertEquals(part(9, 18), "50");
  assertEquals(part(0, 18), "0");
  //  UN POKÉMON À PLUS QUE SON MAXIMUM NE DÉBORDE PAS DE SA JAUGE.
  //  Le cas ne devrait pas exister ; s'il arrive, une barre à 140 %
  //  sortirait de la bulle et on chercherait le défaut dans le CSS.
  assertEquals(part(25, 18), "100");
});

Deno.test("SANS MAXIMUM CONNU, PAS DE JAUGE", () => {
  //  Le sauvage arrive entier et n'en porte pas : une barre pleine à
  //  côté d'un « 30 PV » sans fraction ferait croire qu'on connaît son
  //  total alors qu'on affiche juste ce qu'il a.
  const html = fiche(
    { especeId: 77, nom: "Ponyta", pv: 30, pvMax: null, attaque: 22, defense: 16 },
    "sauvage",
    RACINE,
  );
  assert(!html.includes("wm-infobulle__jauge"), html);
  assertStringIncludes(html, "wm-infobulle__stats");
});

Deno.test("L'ALTERNATIVE PORTE LE NOM, PARCE QUE FORUMACTIF REMPLIT LES VIDES", () => {
  //  Relevé le 18 novembre sur /t1000 : une `alt=""` revenait en
  //  `alt="Sujet 2 21"` — le titre du sujet et le nom du fichier. Un
  //  sprite qui ne charge pas affichait donc un numéro de fichier au
  //  milieu de la carte.
  const html = fiche(
    { especeId: 37, nom: "Goupix", surnom: "Biscotte", niveau: 1, types: ["feu"], pv: 11, pvMax: 11 },
    "mien",
    RACINE,
  );
  //  LE NOM AFFICHÉ, SURNOM COMPRIS : c'est ce que le lecteur verrait
  //  à la place de l'image, et il doit lire la même chose que juste
  //  en dessous.
  assertStringIncludes(html, 'alt="Biscotte (Goupix)"');
  assert(!html.includes('alt=""'), "plus aucune alternative vide");
});
