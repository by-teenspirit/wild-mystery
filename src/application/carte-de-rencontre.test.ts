// ════════════════════════════════════════════════════════════════════
//  src/application/carte-de-rencontre.test.ts
//
//  Ce que ces tests protègent.
//
//  **Que les chiffres de la carte soient ceux de la base.** La carte
//  ne recalcule rien : elle recopie. Un test qui vérifie une
//  multiplication ici serait un test qui autorise la carte à faire ce
//  calcul — et le jour où la base change de formule, le sujet
//  annoncerait un combat qui n'est pas celui qui se joue.
//
//  **Que l'équipe vide se dise.** Planche 99 §5.3 : la rencontre reste
//  une rencontre. Un message qui s'arrêterait aux stats du sauvage
//  laisserait le joueur attendre un tour qui ne viendra jamais.
//
//  **Que le code NE SE VOIE PAS.** « N'affiche pas le code, le joueur
//  ne doit pas le voir » — 18 novembre. L'ancien test exigeait
//  l'inverse ; il est retourné, pas supprimé, parce que c'est la
//  règle qui a changé et qu'un retour en arrière doit se voir.
//
//  **Que la fiche tienne sur une ligne.** Forumactif transforme chaque
//  retour en `<br>`. Un seul `\n` dans le balisage et le message
//  s'ouvre sur un trou.
// ════════════════════════════════════════════════════════════════════

import { assert, assertEquals, assertStringIncludes } from "@std/assert";
import {
  APPEL,
  nomDuCombattant,
  redigerLaCarte,
  type RencontreAAnnoncer,
  SANS_COMBATTANT,
  typesLisibles,
} from "./carte-de-rencontre.ts";

const RACINE = "https://exemple.test/wm/";

const PONYTA: RencontreAAnnoncer = {
  combatId: "11111111-1111-1111-1111-111111111111",
  sujetId: 996,
  messageId: 15601,
  essais: 0,
  rappel: false,
  mentionne: "Jake Dalziel",
  sauvage: {
    especeId: 77,
    nom: "Ponyta",
    niveau: 10,
    types: ["feu"],
    pv: 30,
    pvMax: null,
    attaque: 22,
    defense: 16,
  },
  combattant: {
    especeId: 4,
    nom: "Salamèche",
    surnom: null,
    niveau: 5,
    types: ["feu"],
    pv: 18,
    pvMax: 18,
    attaque: 10,
    defense: 9,
  },
};

Deno.test("la carte annonce le sauvage avant tout le reste", () => {
  const html = redigerLaCarte(PONYTA, RACINE);
  assertStringIncludes(html, "Un Ponyta sauvage apparaît.");
  //  Le sauvage est l'information neuve : elle vient avant le
  //  combattant, qu'on connaît déjà.
  assert(
    html.indexOf("Ponyta") < html.indexOf("Salamèche"),
    "le sauvage doit passer avant le combattant",
  );
});

Deno.test("TOUT SUR UNE LIGNE — Forumactif fait un <br> de chaque retour", () => {
  //  Le défaut est connu : « un <br> de l'éditeur traînait entre chaque
  //  poste », suivi des collages du 10 novembre.
  const html = redigerLaCarte(PONYTA, RACINE);
  assert(!html.includes("\n"), "la fiche porte un retour à la ligne");
});

Deno.test("les chiffres sont recopiés, pas recalculés", () => {
  //  On donne des PV qui ne correspondent à AUCUNE formule — 30 pour
  //  un Ponyta niveau 10 en vaut 30, mais 777 ne vaut rien. La carte
  //  doit écrire 777.
  const html = redigerLaCarte(
    { ...PONYTA, sauvage: { ...PONYTA.sauvage, pv: 777 } },
    RACINE,
  );
  assertStringIncludes(html, ">777 PV<");
});

Deno.test("les PV du joueur se lisent sur leur maximum", () => {
  //  Son Pokémon peut sortir d'un combat précédent, et ça change ce
  //  qu'on décide au premier tour.
  const html = redigerLaCarte(
    { ...PONYTA, combattant: { ...PONYTA.combattant!, pv: 7, pvMax: 18 } },
    RACINE,
  );
  assertStringIncludes(html, ">7/18 PV<");
  //  Le sauvage, lui, arrive entier : pas de fraction de son côté.
  //  L'écrire ferait croire qu'il a déjà pris des coups.
  assertStringIncludes(html, ">30 PV<");
  assert(!html.includes(">30/30 PV<"), "le sauvage ne porte pas de fraction");
});

Deno.test("LE SPRITE PORTE LE NUMÉRO D'ESPÈCE, pas le nom", () => {
  //  C'est ce qui permet au navigateur de le réécrire selon le style
  //  choisi par le lecteur — `Sprites.especeDe()` lit ce numéro.
  const html = redigerLaCarte(PONYTA, RACINE);
  assertStringIncludes(html, "https://exemple.test/wm/assets/sprites-figes/forum/77.png");
  assertStringIncludes(html, "https://exemple.test/wm/assets/sprites-figes/forum/4.png");
});

Deno.test("une espèce hors Pokédex n'a pas d'image, et la fiche tient", () => {
  //  L'espèce de test `Debugant` est dans ce cas, et c'est elle qu'on
  //  a vue sur t1000. Une image cassée se voit plus qu'une absente.
  const html = redigerLaCarte(
    { ...PONYTA, sauvage: { ...PONYTA.sauvage, especeId: 0, nom: "Debugant" } },
    RACINE,
  );
  assert(!html.includes("/0.png"), "une adresse de sprite a été écrite quand même");
  assertStringIncludes(html, "Debugant");
  assertStringIncludes(html, ">30 PV<");
});

Deno.test("les types deviennent des pastilles", () => {
  const html = redigerLaCarte(PONYTA, RACINE);
  assertStringIncludes(html, 'class="wm-type wm-type--feu" data-wm-type="feu"');
  assertStringIncludes(html, ">Feu<");
});

Deno.test("les types reprennent leur majuscule", () => {
  //  La base les range à plat et sans accent pour que les jointures
  //  tiennent. Le joueur n'a pas à lire notre convention de clé.
  assertEquals(typesLisibles(["feu"]), "Feu");
  assertEquals(typesLisibles(["eau", "plante"]), "Eau · Plante");
  assertEquals(typesLisibles(["electrik"]), "Electrik");
});

Deno.test("le surnom ne fait pas disparaître l'espèce", () => {
  //  Le joueur doit pouvoir lire l'affiche des types, et « Biscotte »
  //  ne dit pas de quel type elle est.
  assertEquals(nomDuCombattant("Salamèche", "Biscotte"), "Biscotte (Salamèche)");
  assertEquals(nomDuCombattant("Salamèche", null), "Salamèche");
  //  Un surnom qui n'est que des espaces n'est pas un surnom.
  assertEquals(nomDuCombattant("Salamèche", "   "), "Salamèche");
});

Deno.test("UN SURNOM DE JOUEUR NE PEUT PAS SORTIR DU TEXTE", () => {
  //  C'est la seule donnée de ce message qu'un joueur écrit lui-même,
  //  et le compte qui poste est le nôtre : le forum lui fait
  //  confiance, la base ne filtre rien.
  const html = redigerLaCarte(
    {
      ...PONYTA,
      combattant: {
        ...PONYTA.combattant!,
        surnom: '<img src=x onerror="alert(1)">',
      },
    },
    RACINE,
  );
  assert(!html.includes("<img src=x"), html);
  assertStringIncludes(html, "&lt;img src=x onerror=&quot;alert(1)&quot;&gt;");
});

Deno.test("une équipe vide est dite, pas tue", () => {
  const html = redigerLaCarte({ ...PONYTA, combattant: null }, RACINE);
  assertStringIncludes(html, SANS_COMBATTANT);
  //  Et on ne propose pas d'attaquer avec un Pokémon qu'on n'a pas.
  assert(!html.includes("À toi de jouer"), "aucun tour à jouer sans Pokémon");
  //  Ni de mot « contre » devant une fiche absente.
  assert(!html.includes("wm-combat__contre"), "pas de duel à un seul camp");
});

Deno.test("les cinq choix du combat sont nommés", () => {
  //  La planche 99 §4 les liste, la barre les sert. Les écrire dans la
  //  carte, c'est ce qui rend le premier combat jouable sans avoir lu
  //  l'annexe.
  const html = redigerLaCarte(PONYTA, RACINE);
  for (const choix of ["attaquer", "Poké Ball", "objet", "changer", "fuir"]) {
    assertStringIncludes(html, choix);
  }
  assertStringIncludes(html, APPEL);
});

Deno.test("LE CODE NE S'AFFICHE PAS", () => {
  //  Règle retournée le 18 novembre. Il reste dans le marqueur que
  //  l'adaptateur pose — donc dans la source de la page — mais il ne
  //  se lit plus. Aucun code n'est même passé à cette fonction.
  const html = redigerLaCarte(PONYTA, RACINE);
  assert(!html.includes("CODE"), html);
  assert(!/WM-[A-Z0-9]{4}-[A-Z0-9]{3}/.test(html), html);
});

Deno.test("la carte entière, telle qu'un joueur la lit", () => {
  //  UN TEST QUI SE LIT COMME LE MESSAGE. Les assertions au-dessus
  //  vérifient chacune une règle ; celle-ci vérifie que l'ensemble
  //  tient debout — c'est la seule qui dirait si l'ordre des morceaux
  //  devenait absurde.
  assertEquals(
    redigerLaCarte(PONYTA, RACINE),
    '<div class="wm-combat wm-combat--rencontre">' +
      '<p class="wm-combat__surtitre">Rencontre</p>' +
      '<p class="wm-combat__titre">Un Ponyta sauvage apparaît.</p>' +
      '<div class="wm-combat__duel">' +
      '<div class="wm-combat__camp wm-combat__camp--sauvage" tabindex="0">' +
      '<img class="wm-combat__sprite" ' +
      'src="https://exemple.test/wm/assets/sprites-figes/forum/77.png" alt="" loading="lazy">' +
      '<p class="wm-combat__nom">Ponyta</p>' +
      '<p class="wm-combat__niveau">niv. 10</p>' +
      '<p class="wm-combat__types">' +
      '<span class="wm-type wm-type--feu" data-wm-type="feu">Feu</span></p>' +
      '<p class="wm-combat__pv">30 PV</p>' +
      '<span class="wm-infobulle" role="tooltip"><span class="wm-infobulle__tete"><span class="wm-infobulle__nom">Ponyta</span><span class="wm-infobulle__niveau">Niv. 10</span></span><span class="wm-infobulle__types"><span class="wm-infobulle__type" data-wm-type="feu">Feu</span></span><span class="wm-infobulle__surtitre">Statistiques</span><span class="wm-infobulle__stats"><span class="wm-infobulle__stat"><span>Attaque</span><span>22</span></span><span class="wm-infobulle__stat"><span>Défense</span><span>16</span></span></span></span>' +
      "</div>" +
      '<p class="wm-combat__contre">contre</p>' +
      '<div class="wm-combat__camp wm-combat__camp--mien" tabindex="0">' +
      '<img class="wm-combat__sprite" ' +
      'src="https://exemple.test/wm/assets/sprites-figes/forum/4.png" alt="" loading="lazy">' +
      '<p class="wm-combat__nom">Salamèche</p>' +
      '<p class="wm-combat__niveau">niv. 5</p>' +
      '<p class="wm-combat__types">' +
      '<span class="wm-type wm-type--feu" data-wm-type="feu">Feu</span></p>' +
      '<p class="wm-combat__pv">18/18 PV</p>' +
      '<span class="wm-infobulle" role="tooltip"><span class="wm-infobulle__tete"><span class="wm-infobulle__nom">Salamèche</span><span class="wm-infobulle__niveau">Niv. 5</span></span><span class="wm-infobulle__types"><span class="wm-infobulle__type" data-wm-type="feu">Feu</span></span><span class="wm-infobulle__pv"><span class="wm-infobulle__jauge"><span style="width:100%"></span></span><span class="wm-infobulle__chiffre">18/18 PV</span></span><span class="wm-infobulle__surtitre">Statistiques</span><span class="wm-infobulle__stats"><span class="wm-infobulle__stat"><span>Attaque</span><span>10</span></span><span class="wm-infobulle__stat"><span>Défense</span><span>9</span></span></span></span>' +
      "</div>" +
      "</div>" +
      `<p class="wm-combat__appel">${APPEL}</p>` +
      "</div>",
  );
});

// ── le rappel ───────────────────────────────────────────────────────

Deno.test("UN RAPPEL N'ANNONCE PAS UNE APPARITION", () => {
  //  « Un Ponyta sauvage apparaît » est faux la seconde fois : le
  //  joueur a demandé une rencontre alors que son combat tournait
  //  encore. Ce qu'il faut lui dire, c'est où il en est.
  const html = redigerLaCarte({ ...PONYTA, rappel: true }, RACINE);
  assert(
    !html.includes("sauvage apparaît"),
    "un rappel ne doit pas annoncer une apparition",
  );
  assertStringIncludes(html, "Ton combat contre Ponyta n'est pas fini.");
  assertStringIncludes(html, "Combat en cours");
});

Deno.test("et il montre les mêmes deux camps, avec les PV du moment", () => {
  //  LE RESTE EST IDENTIQUE À DESSEIN : deux mises en forme pour le
  //  même état finiraient par ne plus dire la même chose, et le joueur
  //  apprendrait à lire deux cartes au lieu d'une.
  const html = redigerLaCarte(
    {
      ...PONYTA,
      rappel: true,
      sauvage: { ...PONYTA.sauvage, pv: 18, pvMax: 30 },
      combattant: { ...PONYTA.combattant!, pv: 7 },
    },
    RACINE,
  );
  assertStringIncludes(html, "Ponyta");
  assertStringIncludes(html, "Salamèche");
  //  AU RAPPEL LE SAUVAGE PORTE SA FRACTION : il a encaissé des tours,
  //  et « 18 PV » tout court ne dirait plus rien.
  assertStringIncludes(html, "18/30");
  assertStringIncludes(html, "7/18");
});

Deno.test("À L'APPARITION, LE SAUVAGE N'A PAS DE FRACTION", () => {
  //  Il arrive entier : « 30/30 PV » ferait croire qu'il a déjà pris
  //  des coups.
  const html = redigerLaCarte(PONYTA, RACINE);
  assert(!html.includes("30/30"), "le sauvage ne doit pas porter de maximum");
  assertStringIncludes(html, "30");
});
