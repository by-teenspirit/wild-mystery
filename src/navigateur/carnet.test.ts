// ════════════════════════════════════════════════════════════════════
//  src/navigateur/carnet.test.ts
//
//  Ce qui est éprouvé ici, ce ne sont pas des fonctions : ce sont des
//  décisions qui pourraient se renverser sans que rien ne crie. Un
//  Pokédex à quatre états, une barre pâle plus courte que la pleine,
//  huit cases de badges inventées, un objet du sac qui disparaît parce
//  qu'il n'est pas au catalogue — aucun de ces défauts ne lève
//  d'erreur, et tous se voient à l'écran.
// ════════════════════════════════════════════════════════════════════
import { assertEquals } from "@std/assert";
import {
  type Arene,
  badgesAffiches,
  chiffre,
  compteDeBadges,
  compteDuPokedex,
  equipeAffichee,
  type EspeceDeRhode,
  etatDeLaLigne,
  etatsParEspece,
  jauge,
  type LignePokedex,
  nomAffiche,
  type ObjetDuCatalogue,
  ONGLET_PAR_DEFAUT,
  ongletDeLAdresse,
  ouLaTrouver,
  pokedexAffiche,
  type PokemonDuCarnet,
  sacRange,
} from "./carnet.ts";

function pok(p: Partial<PokemonDuCarnet>): PokemonDuCarnet {
  return {
    id: "p",
    especeId: 25,
    surnom: null,
    niveau: 5,
    xp: 0,
    sexe: null,
    obscur: false,
    etoiles: null,
    emplacement: "equipe",
    boite: 0,
    place: null,
    captureLe: null,
    captureDans: null,
    enPension: false,
    ...p,
  };
}

Deno.test("l'adresse choisit l'onglet, et un fragment inconnu ne le vole pas", () => {
  assertEquals(ongletDeLAdresse("#mon-sac"), "mon-sac");
  assertEquals(ongletDeLAdresse("mon-sac"), "mon-sac");
  assertEquals(ongletDeLAdresse("#MON-SAC"), "mon-sac");
  //  LE FILTRE DU POKÉDEX PARTAGE LE DIÈSE : `#zone-05` n'est pas une
  //  faute, c'est un autre mécanisme. On rend le défaut, pas une erreur.
  assertEquals(ongletDeLAdresse("#zone-05"), ONGLET_PAR_DEFAUT);
  assertEquals(ongletDeLAdresse(""), ONGLET_PAR_DEFAUT);
});

Deno.test("l'équipe a toujours six places, trous compris", () => {
  const places = equipeAffichee([
    pok({ id: "a", place: 1 }),
    pok({ id: "b", place: 3 }),
    pok({ id: "z", emplacement: "boite", boite: 2, place: 1 }),
  ]);
  assertEquals(places.length, 6);
  assertEquals(places.map((c) => c.pokemon?.id ?? null), ["a", null, "b", null, null, null]);
});

Deno.test("un pokémon sans place comble une case libre au lieu de disparaître", () => {
  const places = equipeAffichee([
    pok({ id: "a", place: 1 }),
    pok({ id: "sansPlace", place: null }),
  ]);
  assertEquals(places[0].pokemon?.id, "a");
  assertEquals(places[1].pokemon?.id, "sansPlace");
});

const ARENES: Arene[] = [
  { nom: "Arène Feu", slug: "feu", type: "feu", ville: "Station Service", genre: "arene" },
  { nom: "Arène Plante", slug: "plante", type: "plante", ville: "Samaragd", genre: "arene" },
  {
    nom: "Colosseum de Rhode",
    slug: "fee",
    type: "fee",
    ville: "Port-Amarée",
    genre: "colosseum",
  },
];

Deno.test("sans la liste, on ne dessine que les badges obtenus", () => {
  const badges = [{ arene: "Arène Feu", obtenuLe: "2026-08-12" }];
  assertEquals(badgesAffiches(badges, []), [
    { arene: "Arène Feu", slug: null, type: null, obtenuLe: "2026-08-12" },
  ]);
  assertEquals(compteDeBadges(badges, []), "1");
});

Deno.test("avec la liste, chaque arène a sa case, gagnée ou non", () => {
  const cases = badgesAffiches([{ arene: "Arène Plante", obtenuLe: "2026-09-03" }], ARENES);
  assertEquals(cases.map((c) => [c.arene, c.obtenuLe]), [
    ["Arène Feu", null],
    ["Arène Plante", "2026-09-03"],
  ]);
});

Deno.test("les colosseums ont leurs propres cases et ne comptent pas pour la Ligue", () => {
  const badges = [
    { arene: "Arène Feu", obtenuLe: "2026-08-12" },
    { arene: "Colosseum de Rhode", obtenuLe: "2026-09-20" },
  ];
  //  LE COMPTEUR DIT 1 / 2, PAS 2 / 2 : le colosseum est obtenu, il
  //  n'ouvre pas la Ligue. C'est le seuil de `paliers_a_revoir()`.
  assertEquals(compteDeBadges(badges, ARENES), "1 / 2");
  const colos = badgesAffiches(badges, ARENES, "colosseum");
  assertEquals(colos.map((c) => [c.arene, c.obtenuLe]), [["Colosseum de Rhode", "2026-09-20"]]);
});

Deno.test("un badge que la liste ne connaît pas ne disparaît pas de l'écran", () => {
  //  Une arène ajoutée en base avant d'être ajoutée au fichier : elle
  //  sort dans les cases du genre vide plutôt que de n'être nulle part.
  const cases = badgesAffiches(
    [{ arene: "Arène Fantôme", obtenuLe: "2026-10-01" }],
    [],
    "arene",
  );
  assertEquals(cases.map((c) => c.arene), ["Arène Fantôme"]);
});

const CATALOGUE: ObjetDuCatalogue[] = [
  { id: 990001, slug: "poke-ball", nom: "Poké Ball", famille: "ball" },
  { id: 990002, slug: "super-ball", nom: "Super Ball", famille: "ball" },
  { id: 990010, slug: "potion", nom: "Potion", famille: "soin" },
];

Deno.test("le sac se range par famille, et une famille vide ne sort pas", () => {
  const sections = sacRange(
    [{ objetId: 990010, quantite: 3 }, { objetId: 990001, quantite: 4 }],
    CATALOGUE,
  );
  assertEquals(sections.map((s) => s.titre), ["Pour attraper", "Pour soigner"]);
  assertEquals(sections[0].lignes.map((l) => l.objet.nom), ["Poké Ball"]);
});

Deno.test("un objet hors catalogue reste visible sous son identifiant", () => {
  const sections = sacRange([{ objetId: 777777, quantite: 2 }], CATALOGUE);
  assertEquals(sections.length, 1);
  assertEquals(sections[0].titre, "Pas encore au catalogue");
  assertEquals(sections[0].lignes[0].objet.nom, "Objet n° 777777");
  assertEquals(sections[0].lignes[0].quantite, 2);
});

const ESPECES: EspeceDeRhode[] = [
  { no: 1, id: 10, nom: "Un", types: ["feu"], zone: 36, min: 1, max: 5, quand: "les deux" },
  { no: 2, id: 20, nom: "Deux", types: ["eau"], zone: 36, min: 2, max: 6, quand: "les deux" },
  { no: 3, id: 30, nom: "Trois", types: ["sol"], zone: 32, min: 3, max: 7, quand: "les deux" },
];

Deno.test("le Pokédex n'a que trois états, et attrapé l'emporte sur croisé", () => {
  const lignes: LignePokedex[] = [
    { especeId: 10, croiseLe: "2026-06-14", attrapeLe: "2026-06-20", fois: 3 },
    { especeId: 20, croiseLe: "2026-07-01", attrapeLe: null, fois: 0 },
  ];
  const cases = pokedexAffiche(ESPECES, lignes);
  assertEquals(cases.map((c) => c.etat), ["attrape", "croise", "inconnu"]);
  assertEquals(cases[0].fois, 3);
});

Deno.test("une ligne vide de dates compte comme inconnue, pas comme croisée", () => {
  const cases = pokedexAffiche(ESPECES, [
    { especeId: 10, croiseLe: null, attrapeLe: null, fois: 0 },
  ]);
  assertEquals(cases[0].etat, "inconnu");
});

Deno.test("les croisées comptent les attrapées : la barre pâle part de zéro", () => {
  const cases = pokedexAffiche(ESPECES, [
    { especeId: 10, croiseLe: "2026-06-14", attrapeLe: "2026-06-20", fois: 1 },
    { especeId: 20, croiseLe: "2026-07-01", attrapeLe: null, fois: 0 },
  ]);
  assertEquals(compteDuPokedex(cases), { attrapees: 1, croisees: 2, enTout: 3 });
});

Deno.test("le nom affiché est le surnom, sinon l'espèce, sinon le numéro", () => {
  const especes = new Map([[25, "Pikachu"]]);
  assertEquals(nomAffiche({ surnom: "Pika", especeId: 25 }, especes), "Pika");
  assertEquals(nomAffiche({ surnom: "   ", especeId: 25 }, especes), "Pikachu");
  assertEquals(nomAffiche({ surnom: null, especeId: 999 }, especes), "N° 999");
});

Deno.test("les milliers se séparent par une fine insécable, la même partout", () => {
  //  PAS CELLE D'ICU : `toLocaleString("fr-FR")` rend tantôt une
  //  insécable, tantôt une fine selon le moteur, et le harnais mesure
  //  dans un Chromium pendant que le CI mesure dans Deno.
  assertEquals(chiffre(7440), "7 440");
  assertEquals(chiffre(120), "120");
  assertEquals(chiffre(1234567), "1 234 567");
  assertEquals(chiffre(0), "0");
  assertEquals(chiffre(-2500), "-2 500");
});

Deno.test("une jauge sort toujours avec son texte, et ne déborde jamais", () => {
  assertEquals(jauge(7440, 12000).texte, "7 440 / 12 000");
  assertEquals(jauge(7440, 12000).part, 0.62);
  //  DÉBORDEMENT ET DIVISION PAR ZÉRO : une barre à 140 % de large
  //  sortirait de sa boîte, et un total nul donnerait `NaN` dans un
  //  style, ce qui fait disparaître la barre sans rien dire.
  assertEquals(jauge(30, 10).part, 1);
  assertEquals(jauge(-5, 10).part, 0);
  assertEquals(jauge(5, 0).part, 0);
  assertEquals(jauge(5, 0).texte, "5 / 0");
});

// ════════════════════════════════════════════════════════════════════
//  L'ÉTAT D'UNE ESPÈCE, LU PAR DEUX PAGES
//
//  La règle servait au seul Pokédex du carnet. Depuis le 5 novembre,
//  l'annexe des zones la demande aussi — « affiche une icône si on l'a
//  déjà vu ou si on l'a dans notre pokedex ». Deux pages qui décident
//  séparément du même état finissent par en décider deux.
// ════════════════════════════════════════════════════════════════════

Deno.test("l'état d'une ligne : attrapé l'emporte sur croisé", () => {
  //  ON N'ATTRAPE PAS SANS CROISER, donc une ligne qui porte les deux
  //  dates est « attrapé » — afficher les deux ferait une quatrième
  //  case que la maquette interdit.
  assertEquals(etatDeLaLigne({ croiseLe: "2026-01-01", attrapeLe: "2026-02-01" }), "attrape");
  assertEquals(etatDeLaLigne({ croiseLe: null, attrapeLe: "2026-02-01" }), "attrape");
  assertEquals(etatDeLaLigne({ croiseLe: "2026-01-01", attrapeLe: null }), "croise");
});

Deno.test("UNE LIGNE SANS DATE NE DIT RIEN, et ne vaut pas « jamais vu »", () => {
  //  La base peut porter une ligne vide ; la traiter comme « croisé »
  //  donnerait une marque à une espèce jamais rencontrée.
  assertEquals(etatDeLaLigne({ croiseLe: null, attrapeLe: null }), "inconnu");
  assertEquals(etatDeLaLigne(undefined), "inconnu");
});

Deno.test("les états se rangent par espèce, et les muets n'entrent pas", () => {
  const table = etatsParEspece([
    { especeId: 25, croiseLe: "2026-01-01", attrapeLe: "2026-01-02", fois: 3 },
    { especeId: 1, croiseLe: "2026-01-01", attrapeLe: null, fois: 1 },
    //  CELLE-LÀ NE DOIT PAS ENTRER : une table où 900 espèces disent
    //  « inconnu » est la même information en vingt fois plus gros, et
    //  l'appelant lit déjà `undefined` comme « jamais rencontrée ».
    { especeId: 4, croiseLe: null, attrapeLe: null, fois: 0 },
  ]);
  assertEquals(table.get(25), "attrape");
  assertEquals(table.get(1), "croise");
  assertEquals(table.get(4), undefined);
  assertEquals(table.size, 2);
});

Deno.test("UNE ESPÈCE EN DOUBLE : LA PLUS AVANCÉE GAGNE", () => {
  //  La base a une clé unique dessus, donc ça ne doit pas arriver — mais
  //  si ça arrive, perdre une capture est le pire des deux résultats
  //  possibles. Les deux ordres donnent « attrapé ».
  const avant = etatsParEspece([
    { especeId: 7, croiseLe: "2026-01-01", attrapeLe: "2026-01-02", fois: 1 },
    { especeId: 7, croiseLe: "2026-01-01", attrapeLe: null, fois: 1 },
  ]);
  const apres = etatsParEspece([
    { especeId: 7, croiseLe: "2026-01-01", attrapeLe: null, fois: 1 },
    { especeId: 7, croiseLe: "2026-01-01", attrapeLe: "2026-01-02", fois: 1 },
  ]);
  assertEquals(avant.get(7), "attrape");
  assertEquals(apres.get(7), "attrape");
});

Deno.test("un relevé vide donne une table vide, pas une exception", () => {
  assertEquals(etatsParEspece([]).size, 0);
});

Deno.test("OÙ TROUVER UNE ESPÈCE QU'AUCUNE ZONE NE PORTE", () => {
  //  Soixante-seize espèces sont au Pokédex sans vivre nulle part
  //  (6 novembre). La fiche doit dire par où on les obtient, et jamais
  //  « zone null » ni « Niveaux 0 à 0 ».
  const base = {
    no: 1,
    id: 1,
    nom: "X",
    types: ["roche"],
    zone: null,
    min: null,
    max: null,
    quand: null,
  };
  assertEquals(
    ouLaTrouver({ ...base, origine: "fossile", fossile: "griffe" }),
    "au laboratoire, par un fossile",
  );
  assertEquals(
    ouLaTrouver({ ...base, origine: "breche" }),
    "par une brèche interdimensionnelle",
  );
  assertEquals(
    ouLaTrouver({ ...base, origine: "evolution", de: 347 }),
    "en la faisant évoluer",
  );
  //  SANS ORIGINE, ON NE DEVINE PAS. Une espèce sans zone et sans
  //  origine est une donnée incomplète : la page le dit plutôt que
  //  d'inventer un endroit.
  assertEquals(ouLaTrouver(base), "on ne sait pas encore");
});

Deno.test("LES VRAIES ESPÈCES HORS NATURE DU POKÉDEX SONT TOUTES RATTACHÉES", async () => {
  //  Mesuré sur le fichier livré, pas sur un gabarit : une espèce sans
  //  zone et sans origine passerait les trois cas ci-dessus et
  //  afficherait « on ne sait pas encore » sur le forum.
  const dex = JSON.parse(
    await Deno.readTextFile(new URL("../../data/pokedex-carnet.json", import.meta.url)),
  ).especes as EspeceDeRhode[];
  //  ON NE COMPTE PAS, ON RATTACHE. « 76 » était écrit ici et il a
  //  vécu une heure : six formes alternatives étaient parties aux
  //  brèches par erreur, elles sont revenues, et le nombre a bougé.
  //  Ce qui doit être vrai, c'est que CHAQUE espèce sans zone dit d'où
  //  elle vient — pas qu'il y en ait un nombre précis.
  const sansZone = dex.filter((e) => e.zone === null);
  assertEquals(sansZone.length > 0, true);
  assertEquals(sansZone.filter((e) => e.origine === undefined).length, 0);
  assertEquals(dex.filter((e) => e.zone !== null && e.origine !== undefined).length, 0);
});
