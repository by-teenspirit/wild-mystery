// ════════════════════════════════════════════════════════════════════
//  src/application/resurrection.test.ts
//
//  Ce que ces tests gardent : un message posté ne se retire pas. Une
//  phrase qui annonce une espèce vide, un niveau faux, ou qui laisse
//  croire qu'un fossile est perdu alors qu'il ne l'est pas, reste dans
//  le sujet pour toujours.
//
//  ILS NE VÉRIFIENT PAS LA MISE EN FORME, et c'est volontaire : exiger
//  une virgule à sa place rendrait ce fichier insupportable à faire
//  vivre. Ils vérifient ce qui coûterait une soirée à Callista si ça
//  manquait.
// ════════════════════════════════════════════════════════════════════

import { assert, assertEquals } from "@std/assert";
import { marqueursDe } from "../adaptateurs/forumactif/marqueur.ts";
import {
  NIVEAU_A_LA_NAISSANCE,
  redigerLaResurrection,
  redigerLeRefusDeFossile,
} from "./resurrection.ts";

const CODE = "WM-J44T-EEE";

Deno.test("la résurrection nomme le fossile, l'espèce et le niveau", () => {
  const texte = redigerLaResurrection(
    { pseudo: "Anna", fossile: "Fossile Nautile", espece: "Amonistar" },
    CODE,
  );
  assert(texte.includes("Fossile Nautile"), texte);
  assert(texte.includes("Amonistar"), texte);
  assert(texte.includes(`niveau ${NIVEAU_A_LA_NAISSANCE}`), texte);
  assert(texte.includes("ANNA"), texte);
  assert(texte.includes(`CODE : ${CODE}`), texte);
});

Deno.test("le refus recopie le détail de la base et rassure sur le fossile", () => {
  const texte = redigerLeRefusDeFossile(
    "Anna",
    "Fossile Nautile",
    "Ce fossile n'est plus dans ton sac.",
    CODE,
  );
  assert(texte.includes("Fossile Nautile"), texte);
  assert(texte.includes("Ce fossile n'est plus dans ton sac."), texte);
  //  LA PREMIÈRE QUESTION DU JOUEUR : est-ce que je l'ai perdu ?
  assert(texte.includes("Rien n'a été consommé"), texte);
  assert(texte.includes(`CODE : ${CODE}`), texte);
});

Deno.test("aucun des deux ne pose de marqueur technique", () => {
  //  C'est l'adaptateur Forumactif qui le pose, et lui seul. Un second
  //  marqueur dans le même message casserait sa façon de retrouver son
  //  propre message après une coupure.
  for (
    const texte of [
      redigerLaResurrection(
        { pseudo: "Anna", fossile: "Fossile Nautile", espece: "Amonistar" },
        CODE,
      ),
      redigerLeRefusDeFossile("Anna", "Fossile Nautile", "Absent.", CODE),
    ]
  ) {
    assertEquals(marqueursDe(texte), []);
    assertEquals(texte.includes("[["), false, texte);
  }
});
