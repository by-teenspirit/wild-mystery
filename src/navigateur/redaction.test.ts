import { assertEquals } from "@std/assert";
import { actionDuBrouillon, avecAction, basculer, sansAction } from "./redaction.ts";
import { actionDe } from "../domaine/action.ts";

const FOUILLER = { type: "fouiller" } as const;
const CHERCHER = { type: "chercher", lieu: "berge-est" } as const;
const AILLEURS = { type: "chercher", lieu: "meandres" } as const;

Deno.test("le bloc se pose en fin de message, après une ligne vide", () => {
  assertEquals(
    avecAction("Elle écarte les roseaux.", FOUILLER),
    "Elle écarte les roseaux.\n\n[[WM-ACTION:fouiller]]",
  );
});

Deno.test("sur un message vide, le bloc est seul", () => {
  assertEquals(avecAction("", FOUILLER), "[[WM-ACTION:fouiller]]");
  assertEquals(avecAction("   \n\n ", FOUILLER), "[[WM-ACTION:fouiller]]");
});

Deno.test("poser deux fois ne double pas le bloc", () => {
  // Le pendant, côté interface, de la règle « une seule action par
  // message ». Mieux vaut que les deux soient d'accord plutôt que l'une
  // rattrape l'autre.
  const une = avecAction("Texte.", FOUILLER);
  assertEquals(avecAction(une, FOUILLER), une);
});

Deno.test("poser une autre action remplace, sans demander", () => {
  const texte = avecAction("Texte.", CHERCHER);
  assertEquals(avecAction(texte, FOUILLER), "Texte.\n\n[[WM-ACTION:fouiller]]");
  assertEquals(actionDe(avecAction(texte, FOUILLER)), FOUILLER);
});

// ── la bascule ──────────────────────────────────────────────────────

Deno.test("recliquer le même bouton annule", () => {
  // Cliquer « Fouiller » deux fois ne fouille pas deux fois.
  const pose = basculer("Elle écarte les roseaux.", FOUILLER);
  assertEquals(actionDe(pose), FOUILLER);
  assertEquals(basculer(pose, FOUILLER), "Elle écarte les roseaux.");
});

Deno.test("cliquer un autre bouton bascule vers lui", () => {
  const pose = basculer("Texte.", CHERCHER);
  const autre = basculer(pose, FOUILLER);
  assertEquals(actionDe(autre), FOUILLER);
});

Deno.test("deux lieux différents sont deux actions différentes", () => {
  // Recliquer « Berge Est » annule ; cliquer « Méandres » déplace.
  const berge = basculer("Texte.", CHERCHER);
  assertEquals(actionDe(basculer(berge, AILLEURS)), AILLEURS);
  assertEquals(basculer(berge, CHERCHER), "Texte.");
});

// ── le texte du joueur ──────────────────────────────────────────────

Deno.test("retirer le bloc ne touche pas au message", () => {
  const texte = "Elle écarte les roseaux.\nL'eau est tiède.";
  assertEquals(sansAction(avecAction(texte, FOUILLER)), texte);
});

Deno.test("un message sans action traverse sans être abîmé", () => {
  const texte = "Elle écarte les roseaux.";
  assertEquals(sansAction(texte), texte);
  assertEquals(actionDuBrouillon(texte), null);
});

Deno.test("poser puis retirer rend exactement le texte de départ", () => {
  // La boucle complète, parce que c'est elle que le joueur fait sans y
  // penser : il clique, il relit, il déclique.
  for (const texte of ["", "Un mot.", "Deux\nlignes.", "Ponctuation !?"]) {
    assertEquals(sansAction(avecAction(texte, FOUILLER)), texte.replace(/\s+$/, ""), texte);
  }
});
