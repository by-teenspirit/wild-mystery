// ════════════════════════════════════════════════════════════════════
//  Le motif, seul. Le reste du fichier est du DOM.
//
//  Un motif qui ne reconnaît plus rien ne lève pas : il laisse la
//  plomberie en clair dans les messages des joueurs, et personne ne s'en
//  aperçoit avant de la voir au milieu d'un texte de RP. D'où ce test.
// ════════════════════════════════════════════════════════════════════

import { assert, assertEquals } from "@std/assert";
import { MARQUEUR } from "./marqueurs.ts";

function trouves(texte: string): readonly string[] {
  MARQUEUR.lastIndex = 0;
  return [...texte.matchAll(MARQUEUR)].map((m) => m[0]);
}

Deno.test("le marqueur de bilan est reconnu", () => {
  assertEquals(trouves("Bilan.\n[[WM:cloture:WM-ACDE-FGH]]"), ["[[WM:cloture:WM-ACDE-FGH]]"]);
});

Deno.test("les deux formes de bloc d'action sont reconnues", () => {
  //  Relevé en clair dans un message de t976 le 3 octobre. C'est ce qui
  //  a motivé l'élargissement du motif.
  assertEquals(trouves("Elle écarte les roseaux.\n\n[[WM-ACTION:fouiller]]"), [
    "[[WM-ACTION:fouiller]]",
  ]);
  assertEquals(trouves("[[WM-ACTION:chercher:etang-vaseux]]"), [
    "[[WM-ACTION:chercher:etang-vaseux]]",
  ]);
});

Deno.test("les deux blocs cohabitent dans un même message", () => {
  const texte = "Du texte [[WM-ACTION:fouiller]] et la suite [[WM:cloture:WM-ACDE-FGH]] fin";
  assertEquals(trouves(texte), ["[[WM-ACTION:fouiller]]", "[[WM:cloture:WM-ACDE-FGH]]"]);
});

Deno.test("le texte du joueur n'est pas touché", () => {
  //  Le pire défaut possible ici serait de masquer du RP. On vérifie
  //  quelques formes qui ressemblent sans en être.
  for (
    const innocent of [
      "Elle écarte les roseaux.",
      "[cloture]",
      "[[WM]]",
      "[[WM-ACTION]]",
      "[[WM-ACTION:Fouiller]]",
      "[WM-ACTION:fouiller]",
      "le double crochet [[ n'est pas un marqueur",
    ]
  ) {
    assertEquals(trouves(innocent), [], innocent);
  }
});

Deno.test("le motif ne garde pas d'état entre deux lectures", () => {
  //  Un `/g` au niveau du module avance `lastIndex` : relu sans remise à
  //  zéro, il saute le début du texte suivant et ne masque plus rien.
  //  C'est exactement la panne du 2 octobre, côté `j`, dans un autre
  //  costume.
  const texte = "[[WM-ACTION:fouiller]]";
  assert(trouves(texte).length === 1);
  assert(trouves(texte).length === 1, "la seconde lecture doit donner le même résultat");
});
