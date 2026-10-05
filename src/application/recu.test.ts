// ════════════════════════════════════════════════════════════════════
//  src/application/recu.test.ts
//
//  Du texte, testé caractère par caractère. Même raison que
//  `bilan.test.ts` : ces messages restent dans l'archive du forum pour
//  toujours, et personne ne les relira pour corriger une tournure.
// ════════════════════════════════════════════════════════════════════

import { assertEquals, assertStringIncludes } from "@std/assert";
import { pokedollars } from "./bilan.ts";
import { redigerLePanierIllisible, redigerLeRecu, redigerLeRefusDeCommande } from "./recu.ts";

const CODE = "WM-7K4P-9QX";

Deno.test("le reçu détaille chaque ligne au prix de la base", () => {
  const texte = redigerLeRecu({
    pseudo: "Anna",
    lignes: [
      { objetId: 990080, nom: "Pierre Feu", quantite: 2, prix: 3000, sousTotal: 6000 },
      { objetId: 990020, nom: "Potion", quantite: 3, prix: 300, sousTotal: 900 },
    ],
    total: 6900,
    solde: 3100,
  }, CODE);

  assertEquals(
    texte,
    [
      "ANNA, la commande est servie.",
      "",
      `— Pierre Feu ×2 · ${pokedollars(3000)} ₽ · ${pokedollars(6000)} ₽`,
      `— Potion ×3 · 300 ₽ · 900 ₽`,
      "",
      `TOTAL : ${pokedollars(6900)} ₽`,
      `SOLDE : ${pokedollars(3100)} ₽`,
      "",
      "Les objets sont dans ton sac.",
      "",
      `CODE : ${CODE}`,
    ].join("\n"),
  );
});

Deno.test("le prix unitaire est écrit même pour une seule unité", () => {
  //  On ne l'économise pas : c'est LUI qui permet de comparer au
  //  catalogue affiché, et le sous-total seul ne dit pas d'où il vient.
  const texte = redigerLeRecu({
    pseudo: "Bo",
    lignes: [{ objetId: 990023, nom: "Potion Max", quantite: 1, prix: 2500, sousTotal: 2500 }],
    total: 2500,
    solde: 0,
  }, CODE);

  assertStringIncludes(
    texte,
    `Potion Max ×1 · ${pokedollars(2500)} ₽ · ${pokedollars(2500)} ₽`,
  );
  //  Un solde à zéro s'écrit, il ne disparaît pas : un joueur ruiné doit
  //  le lire plutôt que de le deviner au prochain refus.
  assertStringIncludes(texte, "SOLDE : 0 ₽");
});

Deno.test("le refus recopie le détail de la base sans le reformuler", () => {
  const detail = "Ces objets ne sont pas en vente : Fossile Hélix.";
  const texte = redigerLeRefusDeCommande("Anna", detail, CODE);

  assertStringIncludes(texte, detail);
  assertStringIncludes(texte, "Rien n'a été débité");
  assertStringIncludes(texte, `CODE : ${CODE}`);
  //  Ni total ni solde : la base n'a rien facturé, et afficher « 0 ₽ »
  //  laisserait croire à un achat gratuit.
  assertEquals(texte.includes("TOTAL"), false);
});

Deno.test("le panier illisible dit quoi faire, pas seulement ce qui a raté", () => {
  const texte = redigerLePanierIllisible(
    "Anna",
    "Quantité illisible : « 990080xdeux ».",
    CODE,
  );

  assertStringIncludes(texte, "illisible");
  assertStringIncludes(texte, "990080xdeux");
  assertStringIncludes(texte, "reclique dans le catalogue");
  assertStringIncludes(texte, "sans retoucher le bloc à la main");
});

Deno.test("le pseudo est en capitales, comme dans le bilan", () => {
  //  Les deux messages se suivent dans le même fil : une casse
  //  différente se verrait comme un bogue.
  for (
    const texte of [
      redigerLeRecu({
        pseudo: "Anna-Lou",
        lignes: [{ objetId: 1, nom: "Potion", quantite: 1, prix: 300, sousTotal: 300 }],
        total: 300,
        solde: 0,
      }, CODE),
      redigerLeRefusDeCommande("Anna-Lou", "…", CODE),
      redigerLePanierIllisible("Anna-Lou", "…", CODE),
    ]
  ) {
    assertStringIncludes(texte, "ANNA-LOU");
  }
});
