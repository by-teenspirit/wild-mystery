// ════════════════════════════════════════════════════════════════════
//  src/domaine/combat.test.ts
//
//  Ce que ces tests protègent.
//
//  **Que les trois chiffres soient les MÊMES que ceux de la page.** La
//  formule vit trois fois — ici, en SQL (0045) et en Python (l'outil
//  des champions) — parce que trois endroits en ont besoin sans
//  pouvoir s'appeler. Les tests d'ici tapent sur les chiffres AFFICHÉS
//  dans l'annexe 06 : Drattak niveau 70, 213 PV, 194 d'attaque. Si la
//  formule bouge d'un côté, c'est la page qui le dit.
//
//  **Qu'une immunité reste un vrai zéro.** Le plancher à un point est
//  là pour qu'un combat avance ; appliqué à une immunité, il ferait un
//  Spectre qui prend des coups de Charge, et le joueur n'aurait aucune
//  raison de changer de Pokémon.
//
//  **Que rejouer un tour redonne le même tour.** Un combat se joue en
//  public ; une contestation se tranche en recalculant. Les quatre
//  tirages sont consommés dans le même ordre MÊME QUAND UNE FRAPPE
//  RATE — c'est la seule façon que le rejeu tombe juste.
//
//  **Que le sauvage ne riposte pas une fois tombé.** Ça va de soi, et
//  ça ne va de soi que si on l'écrit.
// ════════════════════════════════════════════════════════════════════

import { assert, assertEquals, assertThrows } from "@std/assert";
import {
  type Capacite,
  CombatInvalide,
  type Combattant,
  degatsAuSauvage,
  degatsDe,
  degatsPortes,
  efficacite,
  pvAuNiveau,
  resoudreUneFrappe,
  resoudreUneRiposte,
  resoudreUnTour,
  statAuNiveau,
  type TableDesTypes,
  TOURS_MAX,
  TOURS_MAX_DUEL,
} from "./combat.ts";

//  UN EXTRAIT DE LA VRAIE TABLE, pas une table inventée : les lignes
//  sont recopiées de `data/types.json`. Un test sur une table fausse
//  prouverait seulement que le code sait multiplier.
const TABLE: TableDesTypes = {
  feu: {
    plante: 2,
    eau: 0.5,
    feu: 0.5,
    roche: 0.5,
    acier: 2,
    glace: 2,
    insecte: 2,
    dragon: 0.5,
  },
  eau: { feu: 2, roche: 2, sol: 2, eau: 0.5, plante: 0.5, dragon: 0.5 },
  normal: { roche: 0.5, acier: 0.5, spectre: 0 },
  plante: { eau: 2, roche: 2, sol: 2, feu: 0.5, plante: 0.5, poison: 0.5, vol: 0.5 },
};

const CHARGE: Capacite = {
  id: 33,
  nom: "Charge",
  type: "normal",
  puissance: 40,
  precision: 100,
};

const FLAMMECHE: Capacite = {
  id: 52,
  nom: "Flammèche",
  type: "feu",
  puissance: 40,
  precision: 100,
};

function combattant(p: Partial<Combattant> = {}): Combattant {
  return {
    nom: "Essai",
    niveau: 10,
    types: ["normal"],
    pv: 30,
    pvMax: 30,
    attaque: 15,
    defense: 15,
    ...p,
  };
}

Deno.test("les trois chiffres sont ceux de la page des champions", () => {
  //  Drattak, défi dragon, niveau 70, base 95 / 135 : l'annexe 06
  //  affiche 213 PV et 194 d'attaque. Les mêmes des deux côtés, ou la
  //  base et la page ne disent plus la même chose au même joueur.
  assertEquals(pvAuNiveau(95, 70), 213);
  assertEquals(statAuNiveau(135, 70), 194);
  //  Dracolosse, même équipe : 207 / 192 / 138.
  assertEquals(pvAuNiveau(91, 70), 207);
  assertEquals(statAuNiveau(134, 70), 192);
  assertEquals(statAuNiveau(95, 70), 138);
});

Deno.test("un starter au niveau 5 n'arrive pas avec un PV", () => {
  //  Bulbizarre, base 45 : 19 PV au niveau 5. Le plancher de la
  //  formule — +niveau +10 — est ce qui empêche un combat de finir
  //  avant d'avoir commencé.
  assertEquals(pvAuNiveau(45, 5), 19);
  assertEquals(pvAuNiveau(0, 1), 11);
});

Deno.test("un niveau hors bornes est refusé, pas arrondi", () => {
  assertThrows(() => pvAuNiveau(45, 0), CombatInvalide);
  assertThrows(() => pvAuNiveau(45, 101), CombatInvalide);
  assertThrows(() => statAuNiveau(-1, 10), CombatInvalide);
});

Deno.test("deux types multiplient", () => {
  //  Eau contre roche/sol : quatre fois. C'est le cas qui justifie le
  //  produit plutôt qu'un maximum.
  assertEquals(efficacite("eau", ["roche", "sol"], TABLE), 4);
  assertEquals(efficacite("feu", ["plante", "poison"], TABLE), 2);
  //  Et deux résistances se cumulent aussi.
  assertEquals(efficacite("feu", ["eau", "roche"], TABLE), 0.25);
});

Deno.test("un seul zéro annule tout", () => {
  assertEquals(efficacite("normal", ["spectre", "acier"], TABLE), 0);
});

Deno.test("une paire absente vaut un", () => {
  //  `data/types.json` ne range que les 120 paires non neutres : le
  //  neutre est l'absence, et le code doit le lire comme tel.
  assertEquals(efficacite("normal", ["eau"], TABLE), 1);
});

Deno.test("un type que la table ne connaît pas est une faute, pas un neutre", () => {
  //  Le traiter comme neutre ferait un combat qui marche à peu près,
  //  et personne ne verrait que la moitié des résistances est muette.
  assertThrows(
    () => efficacite("ombre", ["normal"], TABLE),
    CombatInvalide,
    "type d'attaque inconnu",
  );
});

Deno.test("une immunité reste un vrai zéro", () => {
  const degats = degatsDe(
    combattant(),
    combattant({ types: ["spectre"] }),
    CHARGE,
    TABLE,
    0.5,
  );
  assertEquals(degats.points, 0);
  assertEquals(degats.efficacite, 0);
});

Deno.test("hors immunité, on entame toujours d'au moins un point", () => {
  //  Un niveau 1 minuscule contre une forteresse : le calcul tomberait
  //  sous un point. Un combat où personne n'entame personne tourne
  //  cinq tours pour rien.
  const degats = degatsDe(
    combattant({ niveau: 1, attaque: 5 }),
    combattant({ defense: 300, types: ["roche"] }),
    CHARGE,
    TABLE,
    0,
  );
  assertEquals(degats.points, 1);
});

Deno.test("le bonus de même type s'applique, et se dit", () => {
  const sansBonus = degatsDe(
    combattant({ types: ["eau"] }),
    combattant({ types: ["plante"] }),
    CHARGE,
    TABLE,
    0.99,
  );
  const avecBonus = degatsDe(
    combattant({ types: ["normal"] }),
    combattant({ types: ["plante"] }),
    CHARGE,
    TABLE,
    0.99,
  );
  assert(avecBonus.points > sansBonus.points);
  assertEquals(avecBonus.memeType, true);
  assertEquals(sansBonus.memeType, false);
});

Deno.test("le dé reste dans sa fourchette, et il est rendu", () => {
  for (const tirage of [0, 0.25, 0.5, 0.75, 0.999999]) {
    const d = degatsDe(combattant(), combattant(), CHARGE, TABLE, tirage);
    assert(d.de >= 85 && d.de <= 100, `dé ${d.de}`);
  }
});

Deno.test("une capacité sans puissance ne passe pas", () => {
  assertThrows(
    () => degatsDe(combattant(), combattant(), { ...CHARGE, puissance: 0 }, TABLE, 0.5),
    CombatInvalide,
  );
});

Deno.test("un tour se rejoue à l'identique", () => {
  const joueur = combattant({ nom: "Salamèche", types: ["feu"] });
  const sauvage = combattant({ nom: "Ponyta", types: ["feu"], pv: 30 });
  const un = resoudreUnTour(1, joueur, sauvage, FLAMMECHE, CHARGE, TABLE, "15601");
  const deux = resoudreUnTour(1, joueur, sauvage, FLAMMECHE, CHARGE, TABLE, "15601");
  assertEquals(un, deux);
});

Deno.test("deux tours du même combat ne donnent pas le même résultat", () => {
  //  Le numéro du tour entre dans la graine : sans lui, les cinq tours
  //  d'un combat seraient cinq copies du premier.
  const joueur = combattant({ types: ["feu"] });
  const sauvage = combattant({ types: ["plante"], pv: 200, pvMax: 200 });
  const un = resoudreUnTour(1, joueur, sauvage, FLAMMECHE, CHARGE, TABLE, "15601");
  const deux = resoudreUnTour(2, joueur, sauvage, FLAMMECHE, CHARGE, TABLE, "15601");
  assert(un.frappes[0].degats?.de !== deux.frappes[0].degats?.de);
});

Deno.test("une frappe qui rate consomme quand même son dé", () => {
  //  C'EST LA GARANTIE DU REJEU. Si le dé n'était tiré qu'en cas de
  //  touche, la suite se décalerait selon ce qui s'est passé, et
  //  rejouer un combat contesté ne redonnerait pas le même résultat.
  const joueur = combattant();
  const sauvage = combattant({ pv: 200, pvMax: 200 });
  const rate: Capacite = { ...CHARGE, precision: 0 };

  const avecRate = resoudreUnTour(1, joueur, sauvage, rate, CHARGE, TABLE, "g");
  const avecTouche = resoudreUnTour(1, joueur, sauvage, CHARGE, CHARGE, TABLE, "g");

  assertEquals(avecRate.frappes[0].touche, false);
  assertEquals(avecRate.frappes[0].degats, null);
  //  La riposte du sauvage est la même dans les deux cas : elle lit le
  //  troisième et le quatrième tirage, pas le premier libre.
  assertEquals(
    avecRate.frappes[1].degats?.de,
    avecTouche.frappes[1].degats?.de,
  );
});

Deno.test("le sauvage ne riposte pas une fois tombé", () => {
  const joueur = combattant({ niveau: 50, attaque: 200 });
  const sauvage = combattant({ pv: 1, pvMax: 30 });
  const tour = resoudreUnTour(1, joueur, sauvage, CHARGE, CHARGE, TABLE, "g");
  assertEquals(tour.frappes.length, 1);
  assertEquals(tour.pvSauvage, 0);
  assertEquals(tour.pvJoueur, joueur.pv);
  assertEquals(tour.fin, "victoire");
});

Deno.test("la victoire l'emporte quand les deux tombent", () => {
  //  Le sauvage est tombé AVANT de riposter : il ne peut pas emporter
  //  le joueur avec lui.
  const joueur = combattant({ niveau: 50, attaque: 200, pv: 1 });
  const sauvage = combattant({ pv: 1, pvMax: 30, attaque: 200, niveau: 50 });
  const tour = resoudreUnTour(1, joueur, sauvage, CHARGE, CHARGE, TABLE, "g");
  assertEquals(tour.fin, "victoire");
  assertEquals(tour.pvJoueur, 1);
});

Deno.test("le joueur peut tomber", () => {
  const joueur = combattant({ pv: 1 });
  const sauvage = combattant({ niveau: 50, attaque: 200, pv: 300, pvMax: 300 });
  const tour = resoudreUnTour(1, joueur, sauvage, CHARGE, CHARGE, TABLE, "g");
  assertEquals(tour.pvJoueur, 0);
  assertEquals(tour.fin, "defaite");
});

Deno.test("au cinquième tour, le sauvage s'en va", () => {
  const joueur = combattant();
  const sauvage = combattant({ pv: 500, pvMax: 500 });
  const quatre = resoudreUnTour(4, joueur, sauvage, CHARGE, CHARGE, TABLE, "g");
  assertEquals(quatre.fin, null);
  const cinq = resoudreUnTour(TOURS_MAX, joueur, sauvage, CHARGE, CHARGE, TABLE, "g");
  assertEquals(cinq.fin, "fuite");
});

Deno.test("un sixième tour n'existe pas", () => {
  assertThrows(
    () =>
      resoudreUnTour(
        TOURS_MAX + 1,
        combattant(),
        combattant(),
        CHARGE,
        CHARGE,
        TABLE,
        "g",
      ),
    CombatInvalide,
  );
});

Deno.test("on ne résout pas un tour avec un pokémon déjà à terre", () => {
  assertThrows(
    () => resoudreUnTour(1, combattant({ pv: 0 }), combattant(), CHARGE, CHARGE, TABLE, "g"),
    CombatInvalide,
  );
  assertThrows(
    () => resoudreUnTour(1, combattant(), combattant({ pv: 0 }), CHARGE, CHARGE, TABLE, "g"),
    CombatInvalide,
  );
});

Deno.test("l'expérience ne compte que les coups donnés", () => {
  //  « Jamais aux mots » (1er octobre) : prendre des coups ne rapporte
  //  rien, donc la riposte du sauvage ne doit pas entrer dans le
  //  compte.
  const joueur = combattant();
  const sauvage = combattant({ pv: 200, pvMax: 200, attaque: 200, niveau: 50 });
  const tour = resoudreUnTour(1, joueur, sauvage, CHARGE, CHARGE, TABLE, "g");
  assertEquals(
    degatsAuSauvage(tour),
    tour.frappes[0].degats?.points ?? 0,
  );
  assert(tour.frappes.length === 2);
});

Deno.test("un combat de cinq tours tient dans ses bornes", () => {
  //  LE TEST QUI DIT SI LES CHIFFRES SONT JOUABLES. Un Salamèche de
  //  départ contre un Ponyta de zone : cinq tours doivent pouvoir
  //  suffire à l'entamer sérieusement, sans jamais le descendre en un
  //  coup — sinon la Poké Ball n'a aucun intérêt.
  const joueur = combattant({
    nom: "Salamèche",
    types: ["feu"],
    niveau: 10,
    pv: pvAuNiveau(39, 10),
    pvMax: pvAuNiveau(39, 10),
    attaque: statAuNiveau(52, 10),
    defense: statAuNiveau(43, 10),
  });
  let pv = pvAuNiveau(50, 10);
  const sauvage = () =>
    combattant({
      nom: "Ponyta",
      types: ["feu"],
      niveau: 10,
      pv,
      pvMax: pvAuNiveau(50, 10),
      attaque: statAuNiveau(85, 10),
      defense: statAuNiveau(55, 10),
    });

  const premier = resoudreUnTour(1, joueur, sauvage(), FLAMMECHE, CHARGE, TABLE, "15601");
  assert(
    (premier.frappes[0].degats?.points ?? 0) < pv,
    "un seul coup ne doit pas suffire",
  );

  for (let n = 1; n <= TOURS_MAX && pv > 0; n++) {
    const tour = resoudreUnTour(n, joueur, sauvage(), FLAMMECHE, CHARGE, TABLE, "15601");
    pv = tour.pvSauvage;
  }
  assert(pv < pvAuNiveau(50, 10) / 2, `cinq tours laissent ${pv} PV, c'est trop`);
});

Deno.test("une riposte ne frappe que d'un côté", () => {
  //  Le joueur a changé de Pokémon, lancé une ball qui a raté, ou
  //  utilisé un objet. Le sauvage frappe, lui.
  const joueur = combattant({ pv: 30, pvMax: 30 });
  const sauvage = combattant({ niveau: 20, attaque: 40, pv: 50, pvMax: 50 });
  const tour = resoudreUneRiposte(1, joueur, sauvage, CHARGE, TABLE, "g", "changer");

  assertEquals(tour.frappes.length, 1);
  assertEquals(tour.frappes[0].qui, "sauvage");
  assertEquals(tour.aLaPlace, "changer");
  //  LE SAUVAGE NE PERD RIEN : personne ne l'a touché.
  assertEquals(tour.pvSauvage, 50);
  assert(tour.pvJoueur < 30, "la cible encaisse");
});

Deno.test("une riposte ne peut pas être une victoire", () => {
  //  Le joueur n'a pas frappé : il ne peut pas gagner ce tour-ci.
  //  Seule la défaite, ou le cinquième tour.
  const faible = combattant({ pv: 1 });
  const fort = combattant({ niveau: 50, attaque: 200, pv: 300, pvMax: 300 });
  assertEquals(
    resoudreUneRiposte(1, faible, fort, CHARGE, TABLE, "g", "objet").fin,
    "defaite",
  );
  const solide = combattant({ pv: 500, pvMax: 500 });
  assertEquals(
    resoudreUneRiposte(TOURS_MAX, solide, combattant(), CHARGE, TABLE, "g", "ball").fin,
    "fuite",
  );
});

Deno.test("LA RIPOSTE LIT LES MÊMES TIRAGES QU'UN TOUR D'ATTAQUE", () => {
  //  C'est la garantie du rejeu, et elle vaut pour les deux formes de
  //  tour : la suite doit avancer pareil quoi que le joueur ait fait,
  //  sinon rejouer un combat contesté dépend de ce qu'on a choisi au
  //  tour deux.
  const joueur = combattant({ pv: 100, pvMax: 100 });
  const sauvage = combattant({ pv: 100, pvMax: 100 });
  const attaque = resoudreUnTour(1, joueur, sauvage, CHARGE, CHARGE, TABLE, "g");
  const riposte = resoudreUneRiposte(1, joueur, sauvage, CHARGE, TABLE, "g", "changer");

  const dAttaque = attaque.frappes.find((f) => f.qui === "sauvage")?.degats?.de;
  assertEquals(riposte.frappes[0].degats?.de, dAttaque);
});

Deno.test("on ne riposte pas contre une cible déjà à terre", () => {
  assertThrows(
    () => resoudreUneRiposte(1, combattant({ pv: 0 }), combattant(), CHARGE, TABLE, "g", "x"),
    CombatInvalide,
  );
});

// ── LE DUEL : UNE FRAPPE, ET ON PASSE LA MAIN ───────────────────────

Deno.test("UNE FRAPPE DE DUEL NE RIPOSTE PAS", () => {
  //  C'est toute la différence avec un tour sauvage, et elle n'est pas
  //  un détail : l'adversaire choisira SA capacité dans SON message.
  //  Lui en choisir une ici, ce serait jouer à sa place.
  const tour = resoudreUneFrappe(
    1,
    combattant({ types: ["feu"], attaque: 20 }),
    combattant({ types: ["plante"], defense: 10 }),
    FLAMMECHE,
    TABLE,
    "15601",
    "joueur",
  );
  assertEquals(tour.frappes.length, 1);
  assertEquals(tour.frappes[0].qui, "joueur");
});

Deno.test("LES PV RESTENT DANS LE REPÈRE DE `joueur_id`, QUI QUE CE SOIT QUI FRAPPE", () => {
  //  `pvJoueur` et `pvSauvage` disent « le côté de joueur_id » et
  //  « celui d'en face » — PAS « celui qui frappe » et « celui qui
  //  encaisse », qui changent à chaque tour. Deux repères dans la même
  //  table, c'est une table qu'on ne sait plus lire.
  const mien = combattant({ types: ["feu"], pv: 25, attaque: 20 });
  const sien = combattant({ types: ["plante"], pv: 25, defense: 10 });

  const aMoi = resoudreUneFrappe(1, mien, sien, FLAMMECHE, TABLE, "15601", "joueur");
  //  J'ai frappé : mes PV sont intacts, les siens ont baissé.
  assertEquals(aMoi.pvJoueur, 25);
  assert(aMoi.pvSauvage < 25, "le défenseur doit avoir encaissé");

  const aLui = resoudreUneFrappe(1, sien, mien, CHARGE, TABLE, "15601", "adverse");
  //  Il a frappé : c'est l'inverse, dans le MÊME repère.
  assertEquals(aLui.pvSauvage, 25);
  assert(aLui.pvJoueur < 25, "c'est moi qui encaisse");
});

Deno.test("LA VICTOIRE SE DIT AUSSI DANS CE REPÈRE, PAS DU POINT DE VUE DU FRAPPEUR", () => {
  //  « Victoire » veut dire que le côté de `joueur_id` a gagné. Sans
  //  ça, le même mot voudrait dire deux choses selon le tour, et les
  //  deux joueurs liraient le résultat à l'envers une fois sur deux.
  const fort = combattant({ types: ["feu"], attaque: 200, niveau: 60 });
  const mourant = combattant({ types: ["plante"], pv: 1, defense: 1 });

  const jeGagne = resoudreUneFrappe(1, fort, mourant, FLAMMECHE, TABLE, "1", "joueur");
  assertEquals(jeGagne.pvSauvage, 0);
  assertEquals(jeGagne.fin, "victoire");

  const jePerds = resoudreUneFrappe(1, fort, mourant, FLAMMECHE, TABLE, "1", "adverse");
  assertEquals(jePerds.pvJoueur, 0);
  assertEquals(jePerds.fin, "defaite");
});

Deno.test("TRENTE TOURS SANS VAINQUEUR FONT UN NUL, PAS UNE FUITE", () => {
  //  Un sauvage s'en va au cinquième tour — c'est SA fuite, et elle a
  //  un sens : il n'avait aucune raison de rester. Deux dresseurs qui
  //  n'arrivent pas à se blesser en trente tours n'ont rien gagné, et
  //  inventer un vainqueur au compte des PV serait une règle que
  //  personne n'a écrite.
  const mou = combattant({ types: ["normal"], attaque: 1, pv: 500, pvMax: 500 });
  const dur = combattant({ types: ["normal"], defense: 500, pv: 500, pvMax: 500 });
  const dernier = resoudreUneFrappe(
    TOURS_MAX_DUEL,
    mou,
    dur,
    CHARGE,
    TABLE,
    "15601",
    "joueur",
  );
  assert(dernier.pvSauvage > 0, "personne ne doit être tombé");
  assertEquals(dernier.fin, "nul");
  //  Et le tour d'avant ne finit rien.
  const avant = resoudreUneFrappe(
    TOURS_MAX_DUEL - 1,
    mou,
    dur,
    CHARGE,
    TABLE,
    "15601",
    "joueur",
  );
  assertEquals(avant.fin, null);
});

Deno.test("LE PLAFOND DU DUEL EST CELUI DU DUEL, ET IL SE REFUSE AU-DELÀ", () => {
  //  Trente, pas cinq : un tour de duel est une seule frappe, donc
  //  cinq tours ne feraient que deux coups et demi chacun.
  assertEquals(TOURS_MAX_DUEL, 30);
  assert(TOURS_MAX_DUEL > TOURS_MAX, "un duel dure plus qu'une rencontre");
  for (const hors of [0, -1, TOURS_MAX_DUEL + 1, 1.5]) {
    assertThrows(
      () => resoudreUneFrappe(hors, combattant(), combattant(), CHARGE, TABLE, "1", "joueur"),
      CombatInvalide,
    );
  }
});

Deno.test("ON NE FRAPPE PAS AVEC UN POKÉMON À TERRE, NI UN POKÉMON À TERRE", () => {
  //  Ça paraît aller de soi ; ça ne va de soi que si on l'écrit. Un
  //  duel où l'on frappe un Pokémon déjà tombé donnerait une seconde
  //  victoire sur le même combat.
  assertThrows(
    () =>
      resoudreUneFrappe(
        1,
        combattant({ pv: 0 }),
        combattant(),
        CHARGE,
        TABLE,
        "1",
        "joueur",
      ),
    CombatInvalide,
  );
  assertThrows(
    () =>
      resoudreUneFrappe(
        1,
        combattant(),
        combattant({ pv: 0 }),
        CHARGE,
        TABLE,
        "1",
        "joueur",
      ),
    CombatInvalide,
  );
});

Deno.test("MÊME GRAINE, MÊME FRAPPE — un duel se conteste en le rejouant", () => {
  //  La même promesse que le combat sauvage, et elle vaut davantage
  //  ici : un duel a deux joueurs, donc deux fois plus de raisons
  //  d'être contesté.
  const a = resoudreUneFrappe(
    3,
    combattant({ types: ["feu"], attaque: 30 }),
    combattant({ types: ["plante"] }),
    FLAMMECHE,
    TABLE,
    "15601",
    "joueur",
  );
  const b = resoudreUneFrappe(
    3,
    combattant({ types: ["feu"], attaque: 30 }),
    combattant({ types: ["plante"] }),
    FLAMMECHE,
    TABLE,
    "15601",
    "joueur",
  );
  assertEquals(a, b);
  //  Et un autre tour donne autre chose : la graine porte le numéro.
  const autre = resoudreUneFrappe(
    4,
    combattant({ types: ["feu"], attaque: 30 }),
    combattant({ types: ["plante"] }),
    FLAMMECHE,
    TABLE,
    "15601",
    "joueur",
  );
  assert(
    autre.frappes[0].degats?.points !== a.frappes[0].degats?.points ||
      autre.frappes[0].touche !== a.frappes[0].touche,
    "deux tours de la même graine ne doivent pas être identiques",
  );
});

Deno.test("L'EXPÉRIENCE D'UN DUEL SE COMPTE DES DEUX CÔTÉS", () => {
  //  `degatsAuSauvage` ne compte que les frappes du joueur, parce que
  //  la riposte d'un sauvage ne rapporte rien à personne. Dans un duel,
  //  les deux côtés gagnent en frappant — c'est la même règle du 1er
  //  octobre, lue dans les deux sens.
  const aLui = resoudreUneFrappe(
    1,
    combattant({ types: ["normal"], attaque: 40 }),
    combattant({ types: ["normal"], defense: 10 }),
    CHARGE,
    TABLE,
    "15601",
    "adverse",
  );
  const portes = degatsPortes(aLui);
  assert(portes > 0, "la frappe a fait des dégâts");
  //  Et l'ancienne fonction, elle, n'en voit aucun : cette frappe
  //  n'est pas celle du « joueur ».
  assertEquals(degatsAuSauvage(aLui), 0);
});
