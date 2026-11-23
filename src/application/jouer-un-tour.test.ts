// ════════════════════════════════════════════════════════════════════
//  src/application/jouer-un-tour.test.ts
//
//  Ce que ces tests protègent.
//
//  **Qu'écrire le bloc à la main ne donne aucun avantage.** C'est la
//  promesse de l'en-tête de `domaine/action.ts`, et elle se tient ici :
//  le bloc est du texte dans un message, donc n'importe qui peut
//  écrire `[[WM-ACTION:attaquer:999]]`. Une capacité qui n'est pas une
//  des quatre est refusée, et le refus est DIT.
//
//  **Que le combat appartienne à celui qui l'a ouvert.** Planche 99
//  §5.4. Sans ça, dans un sujet à deux, le second joueur joue les tours
//  du premier.
//
//  **Que l'expérience ne compte que les coups donnés.** « Jamais aux
//  mots », 1er octobre — et prendre des coups n'en donne pas.
//
//  **Qu'un refus ne soit jamais avalé.** Un joueur dont l'action n'a
//  pas été jouée doit pouvoir l'apprendre autrement qu'en ne voyant
//  rien se passer.
// ════════════════════════════════════════════════════════════════════

import { assert, assertEquals } from "@std/assert";
import type { Action } from "../domaine/action.ts";
import { type Tour, TOURS_MAX } from "../domaine/combat.ts";
import type { ActionLue, CombatEnCours, TableDesTypesEnJeu } from "./ports.ts";
import { CombatsEnMemoire } from "../adaptateurs/en-memoire/combat.ts";
import { JouerUnTour, riposteDe } from "./jouer-un-tour.ts";

//  Un extrait de la vraie table : les lignes sont recopiées de
//  `data/types.json`.
const TYPES: TableDesTypesEnJeu = {
  efficacite: () =>
    Promise.resolve({
      feu: { plante: 2, eau: 0.5, feu: 0.5 },
      normal: { roche: 0.5, spectre: 0 },
    }),
};

const FLAMMECHE = {
  id: 52,
  nom: "Flammèche",
  type: "feu",
  puissance: 40,
  precision: 100,
};
const CHARGE = {
  id: 33,
  nom: "Charge",
  type: "normal",
  puissance: 40,
  precision: 100,
};

const JOUEUR = "j-1";

/** Midi : il fait jour, donc la Sombre Ball ne double pas. Les tests
 *  qui veulent la nuit montent leur propre heure. */
const HEURES = { heureLocaleDe: () => Promise.resolve(12) };

function etat(p: Partial<CombatEnCours> = {}): CombatEnCours {
  return {
    combatId: "c-1",
    sujetId: 996,
    joueurId: JOUEUR,
    tour: 0,
    sauvage: {
      especeId: 77,
      nom: "Ponyta",
      niveau: 10,
      types: ["feu"],
      pv: 30,
      pvMax: 30,
      attaque: 22,
      defense: 16,
      capture: 190,
      capacites: [FLAMMECHE],
    },
    combattant: {
      pokemonId: "p-1",
      nom: "Salamèche",
      surnom: null,
      niveau: 5,
      types: ["feu"],
      pv: 18,
      pvMax: 18,
      attaque: 10,
      defense: 9,
      capacites: [FLAMMECHE, CHARGE],
    },
    equipe: [],
    sac: [],
    ...p,
  };
}

/** LE DOUBLE EST CELUI DU DÉPÔT, pas un deuxième écrit ici.
 *
 *  `CombatsEnMemoire` tient déjà les deux règles de la base — un combat
 *  par message, un ouvert par sujet — et c'est lui que les tests de
 *  lecture utilisent. Deux doubles pour un même port est exactement ce
 *  que la matrice « contrat » du dépôt existe pour empêcher : ils
 *  divergent, et l'un des deux tests se met à dire le contraire de la
 *  production. */
function faux(courant: CombatEnCours | null): CombatsEnMemoire {
  return new CombatsEnMemoire().poserLEtat(courant);
}

function lue(messageId: number): ActionLue {
  return {
    sujetId: 996,
    messageId,
    auteurId: 4,
    auteurPseudo: "Jake Dalziel",
    action: { type: "fuir" },
  };
}

const ATTAQUER: Action = { type: "attaquer", capacite: 52 };

Deno.test("une attaque se joue, et le tour part en base", async () => {
  const combats = faux(etat());
  const erreurs: string[] = [];
  const r = await new JouerUnTour(combats, TYPES, HEURES).executer(
    lue(15601),
    ATTAQUER,
    JOUEUR,
    erreurs,
  );

  assertEquals(erreurs, []);
  assert(r.tour !== null);
  assertEquals(combats.joues.length, 1);
  assertEquals(combats.joues[0].numero, 1);
  assertEquals(combats.joues[0].demande, "attaquer");
  assertEquals(combats.joues[0].detail, { capacite: 52, nom: "Flammèche" });
  //  LES PV ÉCRITS SONT CEUX DU DOMAINE, pas un calcul refait ici.
  assertEquals(combats.joues[0].pvSauvage, r.tour.pvSauvage);
  assertEquals(combats.joues[0].pvJoueur, r.tour.pvJoueur);
});

Deno.test("LE RÉCIT PART AVEC LE TOUR, dés compris", async () => {
  //  C'est ce qui permet de trancher une contestation en montrant le
  //  tirage plutôt qu'en le recalculant dans un an.
  const combats = faux(etat());
  await new JouerUnTour(combats, TYPES, HEURES).executer(lue(15601), ATTAQUER, JOUEUR, []);

  const recit = combats.joues[0].recit as { frappes: { degats: { de: number } }[] };
  assert(recit.frappes[0].degats.de >= 85, "le dé est dans le récit");
});

Deno.test("l'expérience ne compte que les coups donnés", async () => {
  const combats = faux(etat());
  const r = await new JouerUnTour(combats, TYPES, HEURES).executer(
    lue(15601),
    ATTAQUER,
    JOUEUR,
    [],
  );

  assertEquals(r.evenements.length, 1);
  const e = r.evenements[0];
  assert(e.type === "xp");
  assertEquals(e.pokemonId, "p-1");
  assert(e.gain > 0, "des dégâts donnent de l'expérience");
});

Deno.test("UNE CAPACITÉ QUI N'EST PAS DES QUATRE EST REFUSÉE, nommément", async () => {
  //  La promesse de `action.ts` : taper le bloc à la main ne donne
  //  aucun avantage. Sans ce refus, n'importe qui frapperait avec
  //  Draco-Météore.
  const combats = faux(etat());
  const erreurs: string[] = [];
  const r = await new JouerUnTour(combats, TYPES, HEURES).executer(
    lue(15601),
    { type: "attaquer", capacite: 999 },
    JOUEUR,
    erreurs,
  );

  assertEquals(r.tour, null);
  assertEquals(combats.joues.length, 0);
  assertEquals(erreurs.length, 1);
  assert(erreurs[0].includes("999"), erreurs[0]);
  assert(erreurs[0].includes("Salamèche"), erreurs[0]);
});

Deno.test("LE COMBAT N'EST PAS CELUI DU VOISIN", async () => {
  //  Planche 99 §5.4 : il appartient à celui qui a fait apparaître le
  //  Pokémon. Dans un sujet à deux, l'autre voit la carte et ne peut
  //  pas agir.
  const combats = faux(etat());
  const erreurs: string[] = [];
  const r = await new JouerUnTour(combats, TYPES, HEURES).executer(
    lue(15601),
    ATTAQUER,
    "quelqu-un-dautre",
    erreurs,
  );

  assertEquals(r.tour, null);
  assertEquals(combats.joues.length, 0);
  assert(erreurs[0].includes("n'est pas le tien"), erreurs[0]);
});

Deno.test("sans combat ouvert, il n'y a rien à jouer, et on le dit", async () => {
  const combats = faux(null);
  const erreurs: string[] = [];
  await new JouerUnTour(combats, TYPES, HEURES).executer(lue(15601), ATTAQUER, JOUEUR, erreurs);

  assertEquals(combats.joues.length, 0);
  assert(erreurs[0].includes("aucun combat ouvert"), erreurs[0]);
});

Deno.test("sans Pokémon, on n'attaque pas", async () => {
  const combats = faux(etat({ combattant: null }));
  const erreurs: string[] = [];
  await new JouerUnTour(combats, TYPES, HEURES).executer(lue(15601), ATTAQUER, JOUEUR, erreurs);

  assertEquals(combats.joues.length, 0);
  assert(erreurs[0].includes("aucun Pokémon"), erreurs[0]);
});

Deno.test("un sauvage sans capacité est une donnée cassée, pas un pacifiste", async () => {
  //  La 0044 en donne toujours au moins une — « un Pokémon qui ne peut
  //  pas attaquer ne peut pas jouer ». Arriver ici veut dire que la
  //  donnée est cassée.
  const combats = faux(
    etat({ sauvage: { ...etat().sauvage, capacites: [] } }),
  );
  const erreurs: string[] = [];
  await new JouerUnTour(combats, TYPES, HEURES).executer(lue(15601), ATTAQUER, JOUEUR, erreurs);

  assertEquals(combats.joues.length, 0);
  assert(erreurs[0].includes("aucune capacité"), erreurs[0]);
});

Deno.test("fuir ferme le combat sans retirer de PV", async () => {
  //  On s'en va, on ne se fait pas frapper en partant : c'est la règle
  //  des jeux, et c'est la seule qui rende la fuite utile.
  const combats = faux(etat());
  const r = await new JouerUnTour(combats, TYPES, HEURES).executer(
    lue(15601),
    { type: "fuir" },
    JOUEUR,
    [],
  );

  assertEquals(r.evenements, []);
  assertEquals(combats.joues.length, 1);
  assertEquals(combats.joues[0].demande, "fuir");
  assertEquals(combats.joues[0].fin, "fuite");
  assertEquals(combats.joues[0].pvJoueur, 18);
  assertEquals(combats.joues[0].pvSauvage, 30);
});

Deno.test("au-delà du cinquième tour, plus rien ne se joue", async () => {
  const combats = faux(etat({ tour: TOURS_MAX }));
  const erreurs: string[] = [];
  await new JouerUnTour(combats, TYPES, HEURES).executer(lue(15601), ATTAQUER, JOUEUR, erreurs);

  assertEquals(combats.joues.length, 0);
  assert(erreurs[0].includes(`${TOURS_MAX} tours`), erreurs[0]);
});

Deno.test("« DEJA_JOUE » NE FAIT PAS DE BRUIT, les autres refus si", async () => {
  //  La relève relit : un tour déjà joué est le cas normal, pas une
  //  anomalie. Un sujet clos entre-temps, lui, mérite une ligne.
  const combats = faux(etat());
  combats.reponseDeJouer = { tourId: "t-1", joue: false, raison: "DEJA_JOUE" };
  const muet: string[] = [];
  await new JouerUnTour(combats, TYPES, HEURES).executer(lue(15601), ATTAQUER, JOUEUR, muet);
  assertEquals(muet, []);

  combats.reponseDeJouer = { tourId: null, joue: false, raison: "COMBAT_CLOS" };
  const bruyant: string[] = [];
  await new JouerUnTour(combats, TYPES, HEURES).executer(lue(15602), ATTAQUER, JOUEUR, bruyant);
  assertEquals(bruyant.length, 1);
  assert(bruyant[0].includes("COMBAT_CLOS"), bruyant[0]);
});

Deno.test("un refus ne verse aucune expérience", async () => {
  //  Le piège évident : calculer le tour, l'écrire en base, échouer, et
  //  rendre quand même la ligne `xp`. Le joueur gagnerait de
  //  l'expérience pour un tour qui n'a pas eu lieu.
  const combats = faux(etat());
  combats.reponseDeJouer = { tourId: null, joue: false, raison: "TOUR_DEPASSE" };
  const r = await new JouerUnTour(combats, TYPES, HEURES).executer(
    lue(15601),
    ATTAQUER,
    JOUEUR,
    [],
  );
  assertEquals(r.evenements, []);
});

//  ── LE DÉCOR DE L'ÉQUIPE ET DU SAC ──────────────────────────────

const BISCOTTE = {
  pokemonId: "p-2",
  position: 2,
  nom: "Carapuce",
  surnom: "Biscotte",
  niveau: 6,
  types: ["eau"],
  pv: 20,
  pvMax: 20,
  attaque: 11,
  defense: 13,
  capacites: [CHARGE],
};

const EN_EQUIPE = [
  {
    pokemonId: "p-1",
    position: 1,
    nom: "Salamèche",
    surnom: null,
    niveau: 5,
    types: ["feu"],
    pv: 18,
    pvMax: 18,
    attaque: 10,
    defense: 9,
    capacites: [FLAMMECHE, CHARGE],
  },
  BISCOTTE,
];

const POKE_BALL = {
  objetId: 990001,
  quantite: 5,
  slug: "poke-ball",
  nom: "Poké Ball",
  famille: "ball",
};
const POTION = {
  objetId: 990020,
  quantite: 5,
  slug: "potion",
  nom: "Potion",
  famille: "soin",
};

// ── CHANGER DE POKÉMON ──────────────────────────────────────────────

Deno.test("changer de Pokémon coûte le tour", async () => {
  //  C'est la règle des jeux, et elle n'est pas décorative : sans elle,
  //  la bonne stratégie serait de faire défiler l'équipe entière pour
  //  trouver la meilleure affiche.
  const combats = faux(etat({ equipe: EN_EQUIPE }));
  const r = await new JouerUnTour(combats, TYPES, HEURES).executer(
    lue(15601),
    { type: "changer", position: 2 },
    JOUEUR,
    [],
  );

  assertEquals(combats.joues.length, 1);
  assertEquals(combats.joues[0].demande, "changer");
  //  LE TOUR NOMME L'ARRIVANT : sans ça, la base écrirait ses PV sur la
  //  ligne de celui qui sort.
  assertEquals(combats.joues[0].pokemonId, "p-2");
  assertEquals(combats.joues[0].pvPokemonMax, 20);
  //  Le sauvage n'a rien perdu — personne ne l'a touché — et l'arrivant
  //  a encaissé.
  assertEquals(combats.joues[0].pvSauvage, 30);
  assert(r.tour !== null && r.tour.pvJoueur < 20, "l'arrivant encaisse");
  assertEquals(r.evenements, [], "personne n'a frappé, donc aucune expérience");
});

Deno.test("CELUI QUI SE BAT DÉJÀ EST REFUSÉ, et nommé", async () => {
  //  « Rien ne s'est passé » serait pris pour une panne ; « Salamèche se
  //  bat déjà » se lit.
  const combats = faux(etat({ equipe: EN_EQUIPE }));
  const erreurs: string[] = [];
  await new JouerUnTour(combats, TYPES, HEURES).executer(
    lue(15601),
    { type: "changer", position: 1 },
    JOUEUR,
    erreurs,
  );
  assertEquals(combats.joues.length, 0);
  assert(erreurs[0].includes("Salamèche se bat déjà"), erreurs[0]);
});

Deno.test("un Pokémon à terre ne revient pas", async () => {
  const combats = faux(
    etat({ equipe: [EN_EQUIPE[0], { ...BISCOTTE, pv: 0 }] }),
  );
  const erreurs: string[] = [];
  await new JouerUnTour(combats, TYPES, HEURES).executer(
    lue(15601),
    { type: "changer", position: 2 },
    JOUEUR,
    erreurs,
  );
  assertEquals(combats.joues.length, 0);
  assert(erreurs[0].includes("à terre"), erreurs[0]);
});

Deno.test("une case vide est refusée", async () => {
  const combats = faux(etat({ equipe: EN_EQUIPE }));
  const erreurs: string[] = [];
  await new JouerUnTour(combats, TYPES, HEURES).executer(
    lue(15601),
    { type: "changer", position: 5 },
    JOUEUR,
    erreurs,
  );
  assertEquals(combats.joues.length, 0);
  assert(erreurs[0].includes("case 5"), erreurs[0]);
});

// ── LA POKÉ BALL ────────────────────────────────────────────────────

Deno.test("une ball se consomme, prise ou pas", async () => {
  //  Une ball lancée est une ball perdue. C'est ce qui rend le choix de
  //  la ball intéressant.
  const combats = faux(etat({ sac: [POKE_BALL] }));
  const r = await new JouerUnTour(combats, TYPES, HEURES).executer(
    lue(15601),
    { type: "ball", objetId: 990001 },
    JOUEUR,
    [],
  );

  assertEquals(combats.joues.length, 1);
  assertEquals(combats.joues[0].demande, "ball");
  const consommee = r.evenements.find((e) => e.type === "objet_utilise");
  assert(consommee !== undefined, "la ball est consommée");
  assertEquals(consommee.type === "objet_utilise" && consommee.objetId, 990001);
});

Deno.test("LA CHANCE ET LE DÉ SONT GARDÉS avec le tour", async () => {
  //  « Un joueur qui rate trois fois doit pouvoir lire qu'il avait
  //  12 % » — sinon il croit que le serveur triche.
  const combats = faux(etat({ sac: [POKE_BALL] }));
  await new JouerUnTour(combats, TYPES, HEURES).executer(
    lue(15601),
    { type: "ball", objetId: 990001 },
    JOUEUR,
    [],
  );
  const detail = combats.joues[0].detail as { chance: number; de: number };
  assert(detail.chance > 0 && detail.chance <= 1, `chance ${detail.chance}`);
  assert(detail.de >= 0 && detail.de <= 1, `dé ${detail.de}`);
});

Deno.test("une prise écrit une capture au registre, pas un Pokémon en boîte", async () => {
  //  `evaluerCloture` vérifie qu'il y a la place en boîte. Un Pokémon
  //  versé en plein sujet sauterait ce contrôle.
  //
  //  Un Chenipan presque à terre avec une Hyper Ball : prise certaine,
  //  donc le test ne dépend d'aucun tirage.
  const combats = faux(etat({
    sauvage: {
      ...etat().sauvage,
      especeId: 10,
      nom: "Chenipan",
      pv: 2,
      pvMax: 20,
      capture: 255,
    },
    sac: [{ ...POKE_BALL, objetId: 990003, slug: "ultra-ball", nom: "Hyper Ball" }],
  }));
  const r = await new JouerUnTour(combats, TYPES, HEURES).executer(
    lue(15601),
    { type: "ball", objetId: 990003 },
    JOUEUR,
    [],
  );

  assertEquals(combats.joues[0].fin, "capture");
  const prise = r.evenements.find((e) => e.type === "capture");
  assert(prise !== undefined, "une ligne de capture part au registre");
  assertEquals(prise.type === "capture" && prise.especeId, 10);
  assertEquals(prise.type === "capture" && prise.niveau, 10);
});

Deno.test("une ball qu'on n'a pas est refusée, et rien n'est consommé", async () => {
  const combats = faux(etat({ sac: [] }));
  const erreurs: string[] = [];
  const r = await new JouerUnTour(combats, TYPES, HEURES).executer(
    lue(15601),
    { type: "ball", objetId: 990001 },
    JOUEUR,
    erreurs,
  );
  assertEquals(combats.joues.length, 0);
  assertEquals(r.evenements, []);
  assert(erreurs[0].includes("sac"), erreurs[0]);
});

Deno.test("une Potion n'est pas une Poké Ball", async () => {
  const combats = faux(etat({ sac: [POTION] }));
  const erreurs: string[] = [];
  await new JouerUnTour(combats, TYPES, HEURES).executer(
    lue(15601),
    { type: "ball", objetId: 990020 },
    JOUEUR,
    erreurs,
  );
  assertEquals(combats.joues.length, 0);
  assert(erreurs[0].includes("n'est pas une Poké Ball"), erreurs[0]);
});

Deno.test("LE TIRAGE DE LA BALL EST UNE SUITE À PART", async () => {
  //  Mélangée aux quatre tirages du tour, elle les décalerait selon
  //  qu'on a lancé ou frappé — et rejouer un combat contesté dépendrait
  //  de ce qu'on a choisi au tour deux.
  const avecBall = faux(etat({ sac: [POKE_BALL] }));
  await new JouerUnTour(avecBall, TYPES, HEURES).executer(
    lue(15601),
    { type: "ball", objetId: 990001 },
    JOUEUR,
    [],
  );
  const riposteApresBall =
    (avecBall.joues[0].recit as { frappes: { degats: { de: number } | null }[] })
      .frappes[0]?.degats?.de;

  const avecAttaque = faux(etat());
  await new JouerUnTour(avecAttaque, TYPES, HEURES).executer(
    lue(15601),
    ATTAQUER,
    JOUEUR,
    [],
  );
  const riposteApresAttaque =
    (avecAttaque.joues[0].recit as { frappes: { qui: string; degats: { de: number } }[] })
      .frappes.find((f) => f.qui === "sauvage")?.degats.de;

  assertEquals(riposteApresBall, riposteApresAttaque);
});

// ── LES OBJETS ──────────────────────────────────────────────────────

Deno.test("une Potion soigne, et le sauvage frappe quand même", async () => {
  //  On soigne D'ABORD, le sauvage frappe ensuite : une Potion sur un
  //  Pokémon à 2 PV le sauve, et l'inverse le laisserait tomber avant
  //  d'avoir bu.
  const combats = faux(etat({
    combattant: { ...etat().combattant!, pv: 2 },
    sac: [POTION],
  }));
  const r = await new JouerUnTour(combats, TYPES, HEURES).executer(
    lue(15601),
    { type: "objet", objetId: 990020 },
    JOUEUR,
    [],
  );

  assertEquals(combats.joues[0].demande, "objet");
  assertEquals((combats.joues[0].detail as { rendus: number }).rendus, 16);
  //  Soigné à 18 puis frappé : il reste debout, ce qui n'aurait pas été
  //  le cas sans la Potion.
  assert(r.tour !== null && r.tour.pvJoueur > 0, "la Potion l'a sauvé");
  assertEquals(r.evenements, [{ type: "objet_utilise", objetId: 990020, quantite: 1 }]);
});

Deno.test("UNE POTION SUR UN POKÉMON ENTIER N'EST PAS CONSOMMÉE", async () => {
  //  Sans ce refus, le joueur dépense 300 PD pour rien et ne comprend
  //  pas pourquoi.
  const combats = faux(etat({ sac: [POTION] }));
  const erreurs: string[] = [];
  const r = await new JouerUnTour(combats, TYPES, HEURES).executer(
    lue(15601),
    { type: "objet", objetId: 990020 },
    JOUEUR,
    erreurs,
  );
  assertEquals(combats.joues.length, 0);
  assertEquals(r.evenements, []);
  assert(erreurs[0].includes("déjà au maximum"), erreurs[0]);
});

Deno.test("un objet qui ne s'utilise pas en combat est refusé nommément", async () => {
  //  Les familles « statut », « rappel », « évolution », « tenu » du
  //  catalogue. Les accepter en silence consommerait l'objet sans rien
  //  faire.
  const combats = faux(etat({
    sac: [{
      objetId: 990060,
      quantite: 1,
      slug: "fire-stone",
      nom: "Pierre Feu",
      famille: "evolution",
    }],
  }));
  const erreurs: string[] = [];
  await new JouerUnTour(combats, TYPES, HEURES).executer(
    lue(15601),
    { type: "objet", objetId: 990060 },
    JOUEUR,
    erreurs,
  );
  assertEquals(combats.joues.length, 0);
  assert(erreurs[0].includes("ne s'utilise pas en combat"), erreurs[0]);
});

Deno.test("la riposte du sauvage est sa capacité la plus forte", () => {
  //  Pas un tirage : un dé de plus que le joueur ne voit pas et sur
  //  lequel il ne peut rien. La plus forte est lisible — il sait à quoi
  //  s'attendre au tour suivant.
  assertEquals(
    riposteDe([
      { id: 33, nom: "Charge", type: "normal", puissance: 40, precision: 100 },
      { id: 52, nom: "Flammèche", type: "feu", puissance: 90, precision: 100 },
    ])?.id,
    52,
  );
  //  À puissance égale, le plus petit identifiant : reproductible.
  assertEquals(
    riposteDe([
      { id: 90, nom: "B", type: "normal", puissance: 40, precision: 100 },
      { id: 33, nom: "A", type: "normal", puissance: 40, precision: 100 },
    ])?.id,
    33,
  );
  assertEquals(riposteDe([]), null);
});

// ── LE DUEL, 23 novembre ────────────────────────────────────────────

const ADVERSE = "22222222-2222-2222-2222-222222222222";

/** Un duel ouvert. Le défieur est `JOUEUR`, et c'est à lui.
 *
 *  LE CÔTÉ D'EN FACE EST UN VRAI POKÉMON : il a un surnom, un dresseur
 *  et ses propres capacités — celles que SON dresseur a choisies, pas
 *  celles de son espèce à son niveau. C'est toute la différence avec
 *  un sauvage, et un décor qui l'oublierait ne mesurerait rien. */
function duel(p: Partial<CombatEnCours> = {}): CombatEnCours {
  return etat({
    genre: "duel",
    adverseJoueurId: ADVERSE,
    adversePokemonId: "p-2",
    aQui: JOUEUR,
    sauvage: {
      especeId: 7,
      nom: "Carapuce",
      surnom: "Bulle",
      niveau: 6,
      types: ["eau"],
      pv: 21,
      pvMax: 21,
      attaque: 10,
      defense: 12,
      capture: 45,
      capacites: [CHARGE],
    },
    ...p,
  });
}

Deno.test("UNE FRAPPE DE DUEL NE JOUE QU'UN COUP", async () => {
  //  C'est la vraie différence avec un tour sauvage : l'adversaire
  //  choisira SA capacité dans SON message.
  const combats = faux(duel());
  const erreurs: string[] = [];
  const r = await new JouerUnTour(combats, TYPES, HEURES).executer(
    lue(15701),
    ATTAQUER,
    JOUEUR,
    erreurs,
  );
  assertEquals(erreurs, []);
  assert(r.tour !== null);
  assertEquals(r.tour.frappes.length, 1);
  assertEquals(r.tour.frappes[0].qui, "joueur");
  //  ET LA BASE SAIT QUI A JOUÉ : c'est elle qui tient l'ordre.
  assertEquals(combats.joues[0].joueurId, JOUEUR);
});

Deno.test("L'AUTRE DRESSEUR JOUE AUSSI, ET SES PV VONT DU BON CÔTÉ", async () => {
  //  `pvJoueur` et `pvSauvage` disent « le côté de joueur_id » et
  //  « celui d'en face ». Quand c'est l'adversaire qui frappe, c'est
  //  donc `pvJoueur` qui baisse — et se tromper ici ferait soigner
  //  celui qui vient de prendre le coup.
  const combats = faux(duel({ aQui: ADVERSE }));
  const erreurs: string[] = [];
  const r = await new JouerUnTour(combats, TYPES, HEURES).executer(
    lue(15702),
    //  SA capacité à lui, pas celle du défieur.
    { type: "attaquer", capacite: 33 },
    ADVERSE,
    erreurs,
  );
  assertEquals(erreurs, []);
  assert(r.tour !== null);
  assertEquals(r.tour.frappes[0].qui, "adverse");
  assertEquals(r.tour.pvSauvage, 21, "celui qui frappe ne perd rien");
  assert(r.tour.pvJoueur < 18, "c'est le défieur qui encaisse");
});

Deno.test("CE N'EST PAS TON TOUR : REFUSÉ, ET DIT", async () => {
  //  La base le tient dans sa transaction ; ce refus-ci est là pour
  //  l'expliquer. Un joueur dont le message n'a rien produit doit
  //  savoir pourquoi.
  const combats = faux(duel({ aQui: ADVERSE }));
  const erreurs: string[] = [];
  const r = await new JouerUnTour(combats, TYPES, HEURES).executer(
    lue(15703),
    ATTAQUER,
    JOUEUR,
    erreurs,
  );
  assertEquals(r.tour, null);
  assertEquals(combats.joues.length, 0);
  assertEquals(erreurs.length, 1);
  assert(erreurs[0].includes("pas ton tour"));
});

Deno.test("ET UN TIERS NE JOUE PAS LE DUEL DES AUTRES", async () => {
  //  Un sujet peut avoir trois participants. Le duel n'est qu'entre
  //  deux, et le troisième n'est ni l'un ni l'autre.
  const combats = faux(duel());
  const erreurs: string[] = [];
  await new JouerUnTour(combats, TYPES, HEURES).executer(
    lue(15704),
    ATTAQUER,
    "33333333-3333-3333-3333-333333333333",
    erreurs,
  );
  assertEquals(combats.joues.length, 0);
  assert(erreurs[0].includes("n'est pas le tien"));
});

Deno.test("L'EXPÉRIENCE VA AU POKÉMON QUI A FRAPPÉ", async () => {
  //  Se tromper ici ferait monter le Pokémon de l'adversaire chaque
  //  fois qu'il se fait frapper — et personne ne le remarquerait avant
  //  longtemps.
  const aMoi = faux(duel());
  const r1 = await new JouerUnTour(aMoi, TYPES, HEURES).executer(
    lue(15705),
    ATTAQUER,
    JOUEUR,
    [],
  );
  assertEquals(r1.evenements.length, 1);
  assertEquals((r1.evenements[0] as { pokemonId: string }).pokemonId, "p-1");

  const aLui = faux(duel({ aQui: ADVERSE }));
  const r2 = await new JouerUnTour(aLui, TYPES, HEURES).executer(
    lue(15706),
    { type: "attaquer", capacite: 33 },
    ADVERSE,
    [],
  );
  assertEquals(r2.evenements.length, 1);
  assertEquals((r2.evenements[0] as { pokemonId: string }).pokemonId, "p-2");
});

Deno.test("LA BALL RESTE LE SEUL REFUS D'UN DUEL", async () => {
  //  ── DEUX DES TROIS REFUS ONT REÇU LEUR RÈGLE ──────────────────────
  //
  //  Ce test en refusait trois le 23 novembre au matin : la ball,
  //  l'objet et le changement. Callista a tranché les deux derniers le
  //  même jour — « les objets sont autorisés en combat », « changer de
  //  pokémon, ça permet à l'autre d'attaquer, ça utilise un de tes
  //  tours » — et il n'en reste qu'un.
  //
  //  CELUI-LÀ NE RECEVRA PAS DE RÈGLE : on n'attrape pas le Pokémon de
  //  quelqu'un.
  const combats = faux(duel({ sac: [POKE_BALL] }));
  const erreurs: string[] = [];
  await new JouerUnTour(combats, TYPES, HEURES).executer(
    lue(15707),
    { type: "ball", objetId: 990001 },
    JOUEUR,
    erreurs,
  );
  assertEquals(combats.joues.length, 0);
  assert(erreurs[0].includes("on n'attrape pas"));
});

Deno.test("SOIGNER EN DUEL DÉPENSE LE TOUR ET NE FRAPPE PERSONNE", async () => {
  //  ── LE CHEMIN SAUVAGE N'AURAIT PAS PU SERVIR ──────────────────────
  //
  //  `#utiliserUnObjet` calcule une riposte DU SAUVAGE et la joue dans
  //  le même message. Ici le « sauvage » est le Pokémon d'un joueur :
  //  le faire riposter tout seul jouerait à sa place. C'est ce que ce
  //  test mesure — un tour, et AUCUNE frappe.
  const combats = faux(duel({
    sac: [POTION],
    combattant: { ...EN_EQUIPE[0], pv: 6, pvMax: 18 },
  }));
  const erreurs: string[] = [];
  const r = await new JouerUnTour(combats, TYPES, HEURES).executer(
    lue(15721),
    { type: "objet", objetId: 990020 },
    JOUEUR,
    erreurs,
  );
  assertEquals(erreurs, []);
  assertEquals(combats.joues.length, 1);
  assertEquals(combats.joues[0].demande, "objet");
  //  `recit` est du jsonb pour le port : on le relit en Tour pour
  //  mesurer qu'il n'y a AUCUNE frappe — c'est tout le sujet de ce
  //  chemin.
  assertEquals((combats.joues[0].recit as Tour).frappes, []);
  //  LA MAIN PASSE PARCE QUE LA BASE LA FAIT PASSER : elle exige de
  //  savoir qui joue, et tout tour de duel qui ne finit pas le combat
  //  bascule `a_qui` (0061). Sans `joueurId`, elle lèverait.
  assertEquals(combats.joues[0].joueurId, JOUEUR);
  assertEquals(combats.joues[0].fin, null);
  //  LES PV S'ÉCRIVENT DANS LE REPÈRE DE LA TABLE : le défieur soigne,
  //  donc c'est `pvJoueur` qui monte, et celui d'en face ne bouge pas.
  assertEquals(combats.joues[0].pvJoueur, 18);
  assertEquals(combats.joues[0].pvSauvage, 21);
  //  ET L'OBJET SE CONSOMME.
  assertEquals(r.evenements, [{ type: "objet_utilise", objetId: 990020, quantite: 1 }]);
});

Deno.test("SOIGNER DEPUIS L'AUTRE CÔTÉ SOIGNE L'AUTRE CÔTÉ", async () => {
  //  LE PIÈGE EXACT : `pvJoueur` est le côté de `joueur_id`, toujours.
  //  Écrire la guérison là quand c'est l'ADVERSAIRE qui soigne
  //  soignerait son adversaire — et le joueur aurait dépensé une Potion
  //  pour aider celui qu'il combat.
  const combats = faux(duel({
    aQui: ADVERSE,
    sac: [POTION],
    sauvage: {
      especeId: 7,
      nom: "Carapuce",
      surnom: "Bulle",
      niveau: 6,
      types: ["eau"],
      //  BLESSÉ DE PLUS QUE CE QU'UNE POTION REND, pour que le chiffre
      //  mesuré soit une vraie guérison et pas le plafond : 8 + 20
      //  dépasserait 21, et le test ne dirait plus rien de l'endroit
      //  où la guérison s'écrit.
      pv: 1,
      pvMax: 40,
      attaque: 10,
      defense: 12,
      capture: 45,
      capacites: [CHARGE],
    },
  }));
  await new JouerUnTour(combats, TYPES, HEURES).executer(
    lue(15722),
    { type: "objet", objetId: 990020 },
    ADVERSE,
    [],
  );
  assertEquals(combats.joues.length, 1);
  //  SON côté monte — une Potion rend 20 PV —, et celui du défieur ne
  //  bouge pas d'un point.
  assertEquals(combats.joues[0].pvSauvage, 21);
  assertEquals(combats.joues[0].pvJoueur, 18);
});

Deno.test("UNE POTION SUR UN POKÉMON AU MAXIMUM NE DÉPENSE PAS LE TOUR", async () => {
  //  Dans un duel, dépenser son tour pour rien laisse l'adversaire
  //  frapper derrière. Le refus vaut donc plus cher ici que contre un
  //  sauvage.
  const combats = faux(duel({ sac: [POTION] }));
  const erreurs: string[] = [];
  await new JouerUnTour(combats, TYPES, HEURES).executer(
    lue(15723),
    { type: "objet", objetId: 990020 },
    JOUEUR,
    erreurs,
  );
  assertEquals(combats.joues.length, 0);
  assert(erreurs[0].includes("déjà au maximum"));
});

Deno.test("RENONCER FAIT PERDRE CELUI QUI RENONCE", async () => {
  //  On fuit un sauvage sans conséquence — il ne poursuit pas, et
  //  c'est ce qui rend la fuite utile. On ne fuit pas un dresseur : on
  //  déclare forfait, et le forfait a un vainqueur. Sinon le verbe
  //  deviendrait le moyen d'annuler un duel qu'on est en train de
  //  perdre.
  const moi = faux(duel());
  await new JouerUnTour(moi, TYPES, HEURES).executer(
    lue(15708),
    { type: "fuir" },
    JOUEUR,
    [],
  );
  assertEquals(moi.joues[0].demande, "renoncer");
  assertEquals(moi.joues[0].fin, "defaite");

  const lui = faux(duel({ aQui: ADVERSE }));
  await new JouerUnTour(lui, TYPES, HEURES).executer(
    lue(15709),
    { type: "fuir" },
    ADVERSE,
    [],
  );
  assertEquals(lui.joues[0].fin, "victoire");
});

Deno.test("LE PLAFOND D'UN DUEL EST TRENTE, PAS CINQ", async () => {
  //  Un tour de duel est une seule frappe : cinq tours ne feraient que
  //  deux coups et demi chacun, moins qu'un échange sauvage.
  const encore = faux(duel({ tour: 10 }));
  const erreurs: string[] = [];
  await new JouerUnTour(encore, TYPES, HEURES).executer(
    lue(15710),
    ATTAQUER,
    JOUEUR,
    erreurs,
  );
  assertEquals(erreurs, [], "au dixième tour, un duel continue");
  assertEquals(encore.joues.length, 1);

  const fini = faux(duel({ tour: 30 }));
  const dit: string[] = [];
  await new JouerUnTour(fini, TYPES, HEURES).executer(lue(15711), ATTAQUER, JOUEUR, dit);
  assertEquals(fini.joues.length, 0);
  assert(dit[0].includes("30 tours"));
});

Deno.test("UNE CAPACITÉ QUI N'EST PAS DES SIENNES EST REFUSÉE, DES DEUX CÔTÉS", async () => {
  //  Les capacités d'en face sont celles que SON dresseur a choisies.
  //  Attaquer avec la Flammèche du défieur quand on joue l'adversaire
  //  serait se servir des attaques de l'autre.
  const combats = faux(duel({ aQui: ADVERSE }));
  const erreurs: string[] = [];
  await new JouerUnTour(combats, TYPES, HEURES).executer(
    lue(15712),
    ATTAQUER,
    ADVERSE,
    erreurs,
  );
  assertEquals(combats.joues.length, 0);
  assert(erreurs[0].includes("Carapuce"));
});

Deno.test("CHANGER EN DUEL DÉPENSE LE TOUR, SANS RIPOSTE", async () => {
  //  « Ça permet à l'autre d'attaquer, ça utilise un de tes tours. »
  //
  //  ET LES DEUX SONT LA MÊME PHRASE : personne ne riposte
  //  automatiquement, l'autre frappe parce que c'est son tour. Sans ce
  //  chemin, celui du combat sauvage aurait fait frapper « le
  //  sauvage » — qui est ici le Pokémon d'un joueur, à sa place.
  const combats = faux(duel({ equipe: [EN_EQUIPE[0], BISCOTTE] }));
  const erreurs: string[] = [];
  const r = await new JouerUnTour(combats, TYPES, HEURES).executer(
    lue(15713),
    { type: "changer", position: 2 },
    JOUEUR,
    erreurs,
  );
  assertEquals(erreurs, []);
  assertEquals(combats.joues.length, 1);
  assertEquals(combats.joues[0].demande, "changer");
  //  `recit` est du jsonb pour le port : on le relit en Tour pour
  //  mesurer qu'il n'y a AUCUNE frappe — c'est tout le sujet de ce
  //  chemin.
  assertEquals((combats.joues[0].recit as Tour).frappes, []);
  assertEquals(combats.joues[0].fin, null);
  //  LE DÉFIEUR CHANGE : c'est `pokemonId` que la base doit écrire, et
  //  les PV de l'arrivant qui deviennent `pvJoueur`.
  assertEquals(combats.joues[0].pokemonId, "p-2");
  assertEquals(combats.joues[0].pvPokemonMax, 20);
  assertEquals(combats.joues[0].pvJoueur, 20);
  assertEquals(combats.joues[0].pokemonAdverse, undefined);
  //  AUCUNE EXPÉRIENCE : personne n'a frappé.
  assertEquals(r.evenements, []);
});

Deno.test("CHANGER DEPUIS L'AUTRE CÔTÉ ÉCRIT LES CHAMPS DE L'AUTRE CÔTÉ", async () => {
  //  LE PIÈGE : la base écrit `pokemon_id`/`pv_pokemon_max` pour un
  //  camp et `adverse_pokemon_id`/`pv_sauvage_max` pour l'autre (0061).
  //  Les poser du mauvais côté remplacerait le Pokémon de l'adversaire
  //  par le nôtre, et sa jauge afficherait le nôtre.
  //  ── SON ÉQUIPE, PAS CELLE DU DÉFIEUR ────────────────────────────
  //
  //  `combat_pour_jouer` sert l'équipe de CELUI QUI A LA MAIN (0062).
  //  Reprendre `EN_EQUIPE` ici aurait donné à l'adversaire l'équipe du
  //  défieur — et `p-2`, qui EST son combattant du moment, se serait
  //  fait refuser avec « se bat déjà ». La fixture dit donc la vérité :
  //  son combattant en case 1, son remplaçant en case 2.
  const combats = faux(duel({
    aQui: ADVERSE,
    equipe: [
      { ...BISCOTTE, pokemonId: "p-2", position: 1 },
      { ...BISCOTTE, pokemonId: "p-9", position: 2, surnom: "Relève", pvMax: 24, pv: 24 },
    ],
  }));
  await new JouerUnTour(combats, TYPES, HEURES).executer(
    lue(15714),
    { type: "changer", position: 2 },
    ADVERSE,
    [],
  );
  assertEquals(combats.joues.length, 1);
  assertEquals(combats.joues[0].pokemonAdverse, "p-9");
  assertEquals(combats.joues[0].pvAdverseMax, 24);
  assertEquals(combats.joues[0].pvSauvage, 24);
  assertEquals(combats.joues[0].pokemonId, undefined);
});

Deno.test("ON NE REMPLACE PAS SON COMBATTANT PAR LUI-MÊME, DES DEUX CÔTÉS", async () => {
  //  LE COMPILATEUR A ATTRAPÉ LA MOITIÉ DE ÇA : d'en face,
  //  l'identifiant du Pokémon n'est pas dans `sauvage` — ce côté est
  //  décrit comme une ESPÈCE — mais dans `adversePokemonId`. La
  //  comparaison naïve n'aurait jamais refusé pour l'adversaire, et il
  //  aurait dépensé son tour à se remplacer par lui-même.
  const mien = faux(duel({ equipe: [EN_EQUIPE[0]] }));
  const e1: string[] = [];
  await new JouerUnTour(mien, TYPES, HEURES).executer(
    lue(15715),
    { type: "changer", position: 1 },
    JOUEUR,
    e1,
  );
  assertEquals(mien.joues.length, 0);
  assert(e1[0].includes("se bat déjà"));

  const sien = faux(duel({
    aQui: ADVERSE,
    equipe: [{ ...BISCOTTE, pokemonId: "p-2", position: 1 }],
  }));
  const e2: string[] = [];
  await new JouerUnTour(sien, TYPES, HEURES).executer(
    lue(15716),
    { type: "changer", position: 1 },
    ADVERSE,
    e2,
  );
  assertEquals(sien.joues.length, 0);
  assert(e2[0].includes("se bat déjà"));
});
