// ════════════════════════════════════════════════════════════════════
//  Ce qui se teste sans navigateur dans l'éditeur de la fiche : la
//  lecture du catalogue des espèces, et la comparaison qui décide si
//  quelqu'un a retouché le message à la main.
//
//  LE RESTE DEMANDE UN VRAI NAVIGATEUR, et pas par paresse : l'éditeur
//  est la fiche rendue, dont chaque valeur devient une zone
//  modifiable. Ce qu'on y lit vient d'`innerText`, qui demande une
//  mise en page ; et le piège qu'on y a trouvé — le `<b>` du joueur
//  analysé puis perdu — ne se voit que là. C'est `outils/poster.mjs`
//  qui le monte, sur le vrai gabarit de la page de réponse.
// ════════════════════════════════════════════════════════════════════

import { assertEquals } from "@std/assert";
import { adresseDeLien, lireLesStarters, memeFiche } from "./module-fiche.ts";
import { type Fiche, ficheVide } from "../../navigateur/fiche.ts";

// ── le catalogue des espèces ────────────────────────────────────────

const BRUT = {
  especes: [
    {
      id: 172,
      nom: "Pichu",
      types: ["electrik"],
      talents: [{ nom: "Statik" }, { nom: "Paratonnerre", cache: true }],
    },
    { id: 133, nom: "Évoli", types: ["normal"], talents: [{ nom: "Échauffement" }] },
  ],
};

Deno.test("le catalogue se lit, talent caché compris", () => {
  assertEquals(lireLesStarters(BRUT).especes, [
    {
      id: 172,
      nom: "Pichu",
      types: ["electrik"],
      talents: [{ nom: "Statik" }, { nom: "Paratonnerre", cache: true }],
    },
    { id: 133, nom: "Évoli", types: ["normal"], talents: [{ nom: "Échauffement" }] },
  ]);
});

Deno.test("LA BASE DES SPRITES SE LIT, ET SEULEMENT SI C'EN EST UNE", () => {
  //  Elle est sortie du tableau pour ne pas peser 64 Ko de répétition.
  //  Une base absente laisse les espèces sans image, pas avec une
  //  adresse inventée.
  assertEquals(
    lireLesStarters({ spriteBase: "https://exemple.test/s/", especes: [] }).base,
    "https://exemple.test/s",
  );
  assertEquals(lireLesStarters({ especes: [] }).base, "");
  assertEquals(lireLesStarters({ spriteBase: "pas-une-adresse", especes: [] }).base, "");
});

Deno.test("UN CHEMIN DE SPRITE QUI N'EN EST PAS UN EST ÉCARTÉ", () => {
  //  Il se recolle derrière NOTRE base : un chemin absolu ou remontant
  //  l'en ferait sortir, et irait chercher ailleurs.
  const lu = lireLesStarters({
    spriteBase: "https://exemple.test/s",
    especes: [
      { id: 1, nom: "Bon", sprite: "versions/x/1.gif", talents: [] },
      { id: 2, nom: "Absolu", sprite: "/ailleurs/2.gif", talents: [] },
      { id: 3, nom: "Remontant", sprite: "../../3.gif", talents: [] },
      { id: 4, nom: "Externe", sprite: "https://ailleurs.test/4.gif", talents: [] },
      { id: 5, nom: "Pas une image", sprite: "versions/x/5.js", talents: [] },
    ],
  });
  assertEquals(lu.especes.map((e) => e.sprite ?? null), [
    "versions/x/1.gif",
    null,
    null,
    null,
    null,
  ]);
});

Deno.test("UNE RÉPONSE QUI N'EN EST PAS UNE NE PEUPLE PAS LE MENU", () => {
  //  Le fichier est dérivé et tenu par le garde-fou 40, mais il arrive
  //  par le réseau : une page d'erreur déguisée en JSON, une réponse
  //  tronquée, et le menu se remplirait de « undefined » — qu'un
  //  joueur choisirait, et qui partirait dans sa fiche publiée.
  assertEquals(lireLesStarters(null).especes, []);
  assertEquals(lireLesStarters({}).especes, []);
  assertEquals(lireLesStarters({ especes: "bientôt" }).especes, []);
  assertEquals(lireLesStarters("<html>404</html>").especes, []);
});

Deno.test("une espèce sans nom ou sans numéro est écartée, pas affichée", () => {
  //  Une option sans libellé est une ligne vide dans le menu ; une
  //  option sans numéro ne se relie à rien.
  const sortie = lireLesStarters({
    especes: [
      { id: 172, nom: "Pichu", talents: [] },
      { id: 0, nom: "Zéro" },
      { nom: "Sans numéro" },
      { id: 9, nom: "" },
      { id: 1.5, nom: "Moitié" },
      "pas un objet",
      null,
    ],
  });
  assertEquals(sortie.especes.map((e) => e.nom), ["Pichu"]);
});

Deno.test("un talent sans nom ne devient pas une option vide", () => {
  const sortie = lireLesStarters({
    especes: [{
      id: 1,
      nom: "Bulbizarre",
      talents: [{ nom: "Engrais" }, {}, { nom: "" }, null],
    }],
  });
  assertEquals(sortie.especes[0].talents, [{ nom: "Engrais" }]);
});

// ── a-t-on retouché le message à la main ? ──────────────────────────

const UNE: Fiche = { ...ficheVide(), nom: "Jak", tw: "violence" };

Deno.test("LA MÊME FICHE RESTE LA MÊME", () => {
  //  C'est le cas ordinaire, et c'est lui qui doit tenir : sans ça, le
  //  formulaire s'arrêterait tout seul dès la seconde frappe.
  assertEquals(memeFiche(UNE, { ...UNE }), true);
  assertEquals(memeFiche(ficheVide(), ficheVide()), true);
});

Deno.test("UNE VALEUR CHANGÉE SE VOIT", () => {
  assertEquals(memeFiche(UNE, { ...UNE, nom: "Fering" }), false);
  assertEquals(
    memeFiche(UNE, { ...UNE, identite: { ...UNE.identite, metier: "Ranger" } }),
    false,
  );
});

Deno.test("le starter qui apparaît ou disparaît se voit", () => {
  const avec: Fiche = {
    ...UNE,
    starter: { especeId: 172, espece: "Pichu", surnom: "", talent: "Statik", rencontre: "" },
  };
  assertEquals(memeFiche(UNE, avec), false);
  assertEquals(memeFiche(avec, avec), true);
});

Deno.test("UN MOMENT AJOUTÉ À LA CHRONOLOGIE SE VOIT", () => {
  const a: Fiche = { ...UNE, histoire: { mode: "chronologie", moments: [] } };
  const b: Fiche = {
    ...UNE,
    histoire: {
      mode: "chronologie",
      moments: [{ date: "2015", texte: "le départ", image: "", credit: "" }],
    },
  };
  assertEquals(memeFiche(a, b), false);
});

Deno.test("CHANGER DE FORME SE VOIT, même à contenu vide", () => {
  //  Pavé vide et chronologie vide publient presque le même corps ;
  //  si la comparaison ne les distinguait pas, basculer d'une forme à
  //  l'autre n'écrirait rien et le joueur verrait son choix sans
  //  effet.
  const pave: Fiche = { ...UNE, histoire: { mode: "pave", texte: "" } };
  const chrono: Fiche = { ...UNE, histoire: { mode: "chronologie", moments: [] } };
  assertEquals(memeFiche(pave, chrono), false);
});

// ── l'adresse d'un lien ─────────────────────────────────────────────

Deno.test("UNE ADRESSE SANS PROTOCOLE EN REÇOIT UN", () => {
  //  C'est ce qu'on colle neuf fois sur dix, et `href="exemple.test"`
  //  pointerait sur une page du forum qui n'existe pas.
  assertEquals(adresseDeLien("exemple.test/page"), "https://exemple.test/page");
  assertEquals(adresseDeLien("  exemple.test  "), "https://exemple.test");
});

Deno.test("CELLES QUI EN ONT UN LE GARDENT", () => {
  assertEquals(adresseDeLien("https://exemple.test"), "https://exemple.test");
  assertEquals(adresseDeLien("http://exemple.test"), "http://exemple.test");
  assertEquals(adresseDeLien("/t50-modele"), "/t50-modele");
  assertEquals(adresseDeLien("#ici"), "#ici");
  assertEquals(adresseDeLien("mailto:qui@exemple.test"), "mailto:qui@exemple.test");
});

Deno.test("LE GUILLEMET NE FERME PAS L'ATTRIBUT", () => {
  //  Pas une protection contre quelqu'un — le joueur écrit dans sa
  //  propre fiche. C'est une adresse collée qui, un jour, en
  //  contiendra un, et tout ce qui suit deviendrait du balisage.
  assertEquals(
    adresseDeLien(`https://exemple.test/a"b`),
    "https://exemple.test/a&quot;b",
  );
});

Deno.test("`javascript:` NE PART PAS DANS UNE FICHE", () => {
  //  Forumactif le filtrerait de toute façon. Mais une fiche porte le
  //  nom de son auteur, et on ne lui met pas ça dans la bouche.
  assertEquals(adresseDeLien("javascript:alert(1)"), "");
  assertEquals(adresseDeLien("  JavaScript:alert(1)"), "");
  assertEquals(adresseDeLien("data:text/html,<script>"), "");
  assertEquals(adresseDeLien("vbscript:msgbox"), "");
});

Deno.test("UNE ADRESSE VIDE NE POSE RIEN", () => {
  assertEquals(adresseDeLien(""), "");
  assertEquals(adresseDeLien("   "), "");
});
