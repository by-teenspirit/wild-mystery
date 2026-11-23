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
import { lireLesStarters, memeFiche } from "./module-fiche.ts";
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
  assertEquals(lireLesStarters(BRUT), [
    {
      id: 172,
      nom: "Pichu",
      types: ["electrik"],
      talents: [{ nom: "Statik" }, { nom: "Paratonnerre", cache: true }],
    },
    { id: 133, nom: "Évoli", types: ["normal"], talents: [{ nom: "Échauffement" }] },
  ]);
});

Deno.test("UNE RÉPONSE QUI N'EN EST PAS UNE NE PEUPLE PAS LE MENU", () => {
  //  Le fichier est dérivé et tenu par le garde-fou 40, mais il arrive
  //  par le réseau : une page d'erreur déguisée en JSON, une réponse
  //  tronquée, et le menu se remplirait de « undefined » — qu'un
  //  joueur choisirait, et qui partirait dans sa fiche publiée.
  assertEquals(lireLesStarters(null), []);
  assertEquals(lireLesStarters({}), []);
  assertEquals(lireLesStarters({ especes: "bientôt" }), []);
  assertEquals(lireLesStarters("<html>404</html>"), []);
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
  assertEquals(sortie.map((e) => e.nom), ["Pichu"]);
});

Deno.test("un talent sans nom ne devient pas une option vide", () => {
  const sortie = lireLesStarters({
    especes: [{
      id: 1,
      nom: "Bulbizarre",
      talents: [{ nom: "Engrais" }, {}, { nom: "" }, null],
    }],
  });
  assertEquals(sortie[0].talents, [{ nom: "Engrais" }]);
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
    histoire: { mode: "chronologie", moments: [{ date: "2015", texte: "le départ" }] },
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
