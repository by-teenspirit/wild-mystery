import { assert, assertEquals, assertFalse, assertThrows } from "@std/assert";
import { conditionDuLieu, estLaNuit, JourInvalide, tempsDuJour } from "./meteo.ts";

// ── le temps du jour ────────────────────────────────────────────────

Deno.test("le même jour donne le même temps, pour tout le monde et pour toujours", () => {
  // C'est ce qui permet à un joueur de contester : il refait le calcul.
  for (const jour of ["2026-10-02", "2027-01-01", "2026-02-29"]) {
    assertEquals(tempsDuJour(jour), tempsDuJour(jour), jour);
  }
});

Deno.test("deux jours voisins ne donnent pas forcément le même temps", () => {
  // Sans ça, « une fois par jour » serait « une fois pour toutes ».
  const trente = Array.from(
    { length: 30 },
    (_, i) => tempsDuJour(`2026-11-${String(i + 1).padStart(2, "0")}`),
  );
  assert(new Set(trente).size === 2, "les deux temps doivent apparaître sur un mois");
});

Deno.test("les jours agités restent une minorité", () => {
  // Un jour sur quatre environ : assez pour qu'on le remarque, assez rare
  // pour que ça reste un évènement.
  let agites = 0;
  for (let j = 0; j < 365; j++) {
    const d = new Date(Date.UTC(2026, 0, 1 + j)).toISOString().slice(0, 10);
    if (tempsDuJour(d) === "agité") agites++;
  }
  assert(agites > 365 * 0.15, `trop peu de jours agités : ${agites}`);
  assert(agites < 365 * 0.40, `trop de jours agités : ${agites}`);
});

Deno.test("une date mal formée lève au lieu de rendre un temps au hasard", () => {
  for (const mauvais of ["2026-10-2", "02/10/2026", "", "demain", "2026-10-02T12:00"]) {
    assertThrows(() => tempsDuJour(mauvais), JourInvalide, undefined, mauvais);
  }
});

// ── le jour et la nuit ──────────────────────────────────────────────

Deno.test("il fait nuit de 20 h à 6 h", () => {
  for (const h of [20, 21, 23, 0, 3, 5]) assert(estLaNuit(h), `${h} h`);
  for (const h of [6, 7, 12, 19]) assertFalse(estLaNuit(h), `${h} h`);
});

Deno.test("une heure impossible lève", () => {
  for (const h of [-1, 24, 12.5, Number.NaN]) {
    assertThrows(() => estLaNuit(h), JourInvalide, undefined, String(h));
  }
});

// ── la condition d'un lieu ──────────────────────────────────────────

const JOUR_NUIT = ["jour", "nuit"];
const AVEC_PLUIE = ["jour", "nuit", "pluie"];

Deno.test("par temps calme, c'est jour ou nuit, même là où il peut pleuvoir", () => {
  assertEquals(conditionDuLieu("calme", false, AVEC_PLUIE), "jour");
  assertEquals(conditionDuLieu("calme", true, AVEC_PLUIE), "nuit");
});

Deno.test("par temps agité, la météo prime — mais seulement là où le lieu la connaît", () => {
  // C'est la règle qui sort des données : un lieu sur quinze a une table
  // de pluie. Inventer une table pour les quatorze autres serait écrire
  // une règle de jeu depuis le code.
  assertEquals(conditionDuLieu("agité", false, AVEC_PLUIE), "pluie");
  assertEquals(conditionDuLieu("agité", false, JOUR_NUIT), "jour");
  assertEquals(conditionDuLieu("agité", true, JOUR_NUIT), "nuit");
});

Deno.test("un lieu à deux météos en choisit une de façon stable", () => {
  // Les Steppes Arides portent « tempête de sable » et « soleil écrasant ».
  const steppes = ["jour", "nuit", "tempête de sable", "soleil écrasant"];
  assertEquals(conditionDuLieu("agité", false, steppes), "tempête de sable");
  assertEquals(conditionDuLieu("agité", true, steppes), "soleil écrasant");
  // Stable : deux appels identiques donnent le même résultat.
  assertEquals(
    conditionDuLieu("agité", false, steppes),
    conditionDuLieu("agité", false, steppes),
  );
});

Deno.test("un lieu sans table de nuit se joue de jour plutôt que de rendre une page vide", () => {
  assertEquals(conditionDuLieu("calme", true, ["jour"]), "jour");
});

Deno.test("un lieu aux conditions inattendues rend quand même quelque chose", () => {
  // La donnée est validée au chargement, mais un lieu qui n'aurait que
  // « pluie » ne doit pas faire tomber la relève pour autant.
  assertEquals(conditionDuLieu("calme", false, ["pluie"]), "pluie");
  assertEquals(conditionDuLieu("calme", false, []), "jour");
});
