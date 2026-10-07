import { assertEquals } from "@std/assert";
import { CLE_SPRITES, CLE_THEME, Preferences, type Stockage } from "./preferences.ts";

class StockageEnMemoire implements Stockage {
  readonly contenu = new Map<string, string>();
  refuseLaLecture = false;
  refuseLEcriture = false;

  lire(cle: string): string | null {
    if (this.refuseLaLecture) throw new Error("stockage inaccessible");
    return this.contenu.get(cle) ?? null;
  }

  ecrire(cle: string, valeur: string): void {
    if (this.refuseLEcriture) throw new Error("stockage en lecture seule");
    this.contenu.set(cle, valeur);
  }
}

function monter(): { stockage: StockageEnMemoire; prefs: Preferences } {
  const stockage = new StockageEnMemoire();
  return { stockage, prefs: new Preferences(stockage) };
}

Deno.test("sans rien d'enregistré, on tombe sur les défauts", () => {
  const { prefs } = monter();
  assertEquals(prefs.theme(), "systeme");
  assertEquals(prefs.styleDeSprite(), "forum");
});

Deno.test("ce qu'on pose se relit", () => {
  const { prefs } = monter();
  prefs.poserTheme("sombre");
  prefs.poserStyleDeSprite("gba-ds");
  assertEquals(prefs.theme(), "sombre");
  assertEquals(prefs.styleDeSprite(), "gba-ds");
});

Deno.test("les deux préférences ne se marchent pas dessus", () => {
  const { stockage, prefs } = monter();
  prefs.poserTheme("clair");
  prefs.poserStyleDeSprite("retro");
  assertEquals(stockage.contenu.get(CLE_THEME), "clair");
  assertEquals(stockage.contenu.get(CLE_SPRITES), "retro");
});

// ── ce qui sort du stockage n'est pas de confiance ───────────────────

Deno.test("une valeur trafiquée retombe sur le défaut au lieu de passer", () => {
  // localStorage s'écrit depuis la console du joueur. Ce qui en sort est
  // une entrée extérieure, au même titre qu'un paramètre d'URL.
  const { stockage, prefs } = monter();
  for (const ordure of ["", "dark", "SOMBRE", "{}", "forum ", "../../etc"]) {
    stockage.contenu.set(CLE_THEME, ordure);
    stockage.contenu.set(CLE_SPRITES, ordure);
    assertEquals(prefs.theme(), "systeme", ordure);
    assertEquals(prefs.styleDeSprite(), "forum", ordure);
  }
});

Deno.test("un stockage qui refuse la lecture ne casse pas la page", () => {
  const { stockage, prefs } = monter();
  stockage.refuseLaLecture = true;
  assertEquals(prefs.theme(), "systeme");
  assertEquals(prefs.styleDeSprite(), "forum");
});

Deno.test("un stockage qui refuse l'écriture ne casse pas la page non plus", () => {
  // Navigation privée : la préférence ne tiendra pas d'une page à
  // l'autre. C'est un désagrément, pas un bogue.
  const { stockage, prefs } = monter();
  stockage.refuseLEcriture = true;
  prefs.poserTheme("sombre");
  assertEquals(prefs.theme(), "systeme");
});
