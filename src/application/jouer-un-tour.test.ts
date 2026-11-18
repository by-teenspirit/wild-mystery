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
import { TOURS_MAX } from "../domaine/combat.ts";
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
