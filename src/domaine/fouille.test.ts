import { assert, assertEquals, assertFalse, assertThrows } from "@std/assert";
import { estUnPalier, fouiller, type Palier, PalierInvalide } from "./fouille.ts";

const PALIERS: readonly Palier[] = [1, 2, 3];

Deno.test("même message, même trouvaille — pour toujours", () => {
  // C'est ce qui permet de trancher une contestation au lieu d'en
  // débattre : on refait le calcul avec le numéro du message.
  for (const graine of [15546, 1, 999999]) {
    assertEquals(fouiller(graine, 1), fouiller(graine, 1), String(graine));
  }
});

Deno.test("deux messages voisins ne donnent pas la même chose", () => {
  // Sinon fouiller deux fois de suite rapporterait mécaniquement le
  // double du même montant, et ça se verrait.
  const montants = new Set(
    Array.from({ length: 50 }, (_, i) => fouiller(15000 + i, 2).pokedollars),
  );
  assert(montants.size > 5, `trop peu de résultats distincts : ${montants.size}`);
});

Deno.test("on rentre parfois bredouille, et c'est un résultat, pas une panne", () => {
  // Une fouille qui donne toujours quelque chose est un distributeur.
  const bredouilles = Array.from({ length: 400 }, (_, i) => fouiller(i, 1))
    .filter((t) => t.pokedollars === 0).length;
  assert(bredouilles > 400 * 0.10, `trop peu de bredouilles : ${bredouilles}`);
  assert(bredouilles < 400 * 0.32, `trop de bredouilles : ${bredouilles}`);
});

Deno.test("le montant reste dans les bornes du palier", () => {
  const bornes: Record<Palier, [number, number]> = {
    1: [20, 60],
    2: [50, 120],
    3: [100, 240],
  };
  for (const palier of PALIERS) {
    const [bas, haut] = bornes[palier];
    for (let graine = 1; graine <= 300; graine++) {
      const { pokedollars } = fouiller(graine, palier);
      if (pokedollars === 0) continue;
      // L'arrondi à la dizaine peut déborder d'au plus 5 de chaque côté.
      assert(
        pokedollars >= bas - 5 && pokedollars <= haut + 5,
        `palier ${palier}, graine ${graine} : ${pokedollars}`,
      );
    }
  }
});

Deno.test("un palier plus haut rapporte plus, en moyenne", () => {
  // La règle lisible du barème : fouiller là où personne d'autre ne peut
  // aller doit se voir.
  const moyenne = (palier: Palier) =>
    Array.from({ length: 400 }, (_, i) => fouiller(i, palier).pokedollars)
      .reduce((s, n) => s + n, 0) / 400;
  assert(moyenne(1) < moyenne(2), "palier 2 doit battre palier 1");
  assert(moyenne(2) < moyenne(3), "palier 3 doit battre palier 2");
});

Deno.test("les montants sont ronds", () => {
  // « 47 Pokédollars » sonne comme une sortie de tableur.
  for (let graine = 1; graine <= 200; graine++) {
    assertEquals(fouiller(graine, 3).pokedollars % 10, 0, `graine ${graine}`);
  }
});

Deno.test("un palier impossible lève au lieu de verser n'importe quoi", () => {
  for (const mauvais of [0, 4, -1, 1.5, Number.NaN]) {
    assertThrows(() => fouiller(1, mauvais), PalierInvalide, undefined, String(mauvais));
  }
});

Deno.test("estUnPalier reconnaît les trois paliers et rien d'autre", () => {
  for (const bon of [1, 2, 3]) assert(estUnPalier(bon));
  for (const mauvais of [0, 4, -1, 2.5]) assertFalse(estUnPalier(mauvais), String(mauvais));
});
