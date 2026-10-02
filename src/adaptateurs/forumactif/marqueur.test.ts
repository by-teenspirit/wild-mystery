// ════════════════════════════════════════════════════════════════════
//  src/adaptateurs/forumactif/marqueur.test.ts
// ════════════════════════════════════════════════════════════════════

import { assertEquals } from "@std/assert";
import { ecrireUnMarqueur, marqueursDe, sansMarqueurs } from "./marqueur.ts";

Deno.test("relit un marqueur qu'on vient d'écrire", () => {
  const m = ecrireUnMarqueur("eyJ0IjoieHAifQ", "WM-ACDE-FGH");
  assertEquals(marqueursDe(`du texte ${m} et la suite`), [
    { charge: "eyJ0IjoieHAifQ", code: "WM-ACDE-FGH" },
  ]);
});

Deno.test("plusieurs marqueurs dans un même message", () => {
  const texte = `${ecrireUnMarqueur("AAA", "WM-ACDE-FGH")} bla ${
    ecrireUnMarqueur("BBB", "WM-RTUV-WXY")
  }`;
  assertEquals(marqueursDe(texte).map((m) => m.charge), ["AAA", "BBB"]);
});

Deno.test("un message sans marqueur n'en invente pas", () => {
  assertEquals(marqueursDe("Galopa charge et met un coup de sabot."), []);
  assertEquals(marqueursDe(""), []);
});

Deno.test("ce qui ressemble à un marqueur sans en être un est ignoré", () => {
  assertEquals(marqueursDe("[[WM:]]"), []);
  assertEquals(marqueursDe("[[WM:charge]]"), []);
  assertEquals(marqueursDe("[[WM:charge:pas-un-code]]"), []);
  assertEquals(marqueursDe("[[WM:charge:WM-ACDE-FG]]"), []);
  // un code bien formé mais avec un symbole hors alphabet
  assertEquals(marqueursDe("[[WM:charge:WM-ACD0-FGH]]"), []);
});

Deno.test("un joueur qui écrit des crochets dans son RP ne déclenche rien", () => {
  assertEquals(marqueursDe("Il hurle [[AAAAH]] puis s'enfuit."), []);
});

Deno.test("sansMarqueurs nettoie le texte sans manger le reste", () => {
  const texte = `Il lance la Ball. ${ecrireUnMarqueur("AAA", "WM-ACDE-FGH")} Elle tremble.`;
  assertEquals(sansMarqueurs(texte), "Il lance la Ball. Elle tremble.");
});
