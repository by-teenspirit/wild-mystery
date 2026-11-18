// ════════════════════════════════════════════════════════════════════
//  src/application/sprite.test.ts
//
//  Deux choses à garder, et une seule compte vraiment : **le chemin
//  écrit ici doit être celui où les fichiers sont**. Une barre en trop
//  ou un dossier mal orthographié donne 955 images cassées dans les
//  messages du Maître du Jeu, et rien ne le dirait avant de regarder
//  un sujet.
//
//  C'est pour ça que le dernier test lit `data/sprites-couverture.json`
//  plutôt que de répéter le chemin : la couverture est produite par
//  `outils/sprites.py` depuis les fichiers réels du dépôt. Si les deux
//  se séparent, c'est ce test qui le dit.
// ════════════════════════════════════════════════════════════════════

import { assert, assertEquals } from "@std/assert";
import { adresseDuSpriteFige, STYLE_DU_FORUM } from "./sprite.ts";

Deno.test("l'adresse se construit sur le numéro d'espèce", () => {
  assertEquals(
    adresseDuSpriteFige("https://exemple.test/wm/", 37),
    "https://exemple.test/wm/assets/sprites-figes/forum/37.png",
  );
});

Deno.test("une racine sans barre finale en reçoit une", () => {
  //  `WM_RACINE_DONNEES` est saisie à la main dans les secrets de
  //  Supabase : les deux formes circulent, et deux barres de suite
  //  donnent un 404 chez GitHub Pages.
  assertEquals(
    adresseDuSpriteFige("https://exemple.test/wm", 37),
    "https://exemple.test/wm/assets/sprites-figes/forum/37.png",
  );
  assertEquals(
    adresseDuSpriteFige("https://exemple.test/wm/", 37),
    adresseDuSpriteFige("https://exemple.test/wm", 37),
  );
});

Deno.test("un numéro qui n'est pas un numéro d'espèce ne rend rien", () => {
  //  LE CAS ARRIVE : l'espèce de test `Debugant` vit hors du Pokédex,
  //  et une image cassée se voit plus qu'une image absente.
  for (const faux of [0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
    assertEquals(adresseDuSpriteFige("https://exemple.test/", faux), null, String(faux));
  }
});

Deno.test("une racine vide ne rend rien", () => {
  assertEquals(adresseDuSpriteFige("", 37), null);
  assertEquals(adresseDuSpriteFige("   ", 37), null);
});

Deno.test("LE CHEMIN EST CELUI DE LA COUVERTURE", async () => {
  //  Le test qui compte. `outils/sprites.py` écrit la couverture depuis
  //  les fichiers réels ; si notre chemin s'en écarte, les messages du
  //  Maître du Jeu pointent dans le vide.
  const brut = await Deno.readTextFile(
    new URL("../../data/sprites-couverture.json", import.meta.url),
  );
  const couverture = JSON.parse(brut) as {
    styles: Record<string, { especes: Record<string, { fige: string }> }>;
  };
  const style = couverture.styles[STYLE_DU_FORUM];
  assert(style !== undefined, `le style « ${STYLE_DU_FORUM} » a disparu de la couverture`);

  const numeros = Object.keys(style.especes);
  assert(numeros.length > 900, `${numeros.length} espèces seulement`);

  for (const numero of numeros) {
    const attendu = style.especes[numero].fige;
    const rendu = adresseDuSpriteFige("https://exemple.test/", Number(numero));
    assertEquals(rendu, `https://exemple.test/${attendu}`, `espèce ${numero}`);
  }
});
