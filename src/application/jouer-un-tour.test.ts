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
  const r = await new JouerUnTour(combats, TYPES).executer(
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
  await new JouerUnTour(combats, TYPES).executer(lue(15601), ATTAQUER, JOUEUR, []);

  const recit = combats.joues[0].recit as { frappes: { degats: { de: number } }[] };
  assert(recit.frappes[0].degats.de >= 85, "le dé est dans le récit");
});

Deno.test("l'expérience ne compte que les coups donnés", async () => {
  const combats = faux(etat());
  const r = await new JouerUnTour(combats, TYPES).executer(
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
  const r = await new JouerUnTour(combats, TYPES).executer(
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
  const r = await new JouerUnTour(combats, TYPES).executer(
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
  await new JouerUnTour(combats, TYPES).executer(lue(15601), ATTAQUER, JOUEUR, erreurs);

  assertEquals(combats.joues.length, 0);
  assert(erreurs[0].includes("aucun combat ouvert"), erreurs[0]);
});

Deno.test("sans Pokémon, on n'attaque pas", async () => {
  const combats = faux(etat({ combattant: null }));
  const erreurs: string[] = [];
  await new JouerUnTour(combats, TYPES).executer(lue(15601), ATTAQUER, JOUEUR, erreurs);

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
  await new JouerUnTour(combats, TYPES).executer(lue(15601), ATTAQUER, JOUEUR, erreurs);

  assertEquals(combats.joues.length, 0);
  assert(erreurs[0].includes("aucune capacité"), erreurs[0]);
});

Deno.test("fuir ferme le combat sans retirer de PV", async () => {
  //  On s'en va, on ne se fait pas frapper en partant : c'est la règle
  //  des jeux, et c'est la seule qui rende la fuite utile.
  const combats = faux(etat());
  const r = await new JouerUnTour(combats, TYPES).executer(
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
  await new JouerUnTour(combats, TYPES).executer(lue(15601), ATTAQUER, JOUEUR, erreurs);

  assertEquals(combats.joues.length, 0);
  assert(erreurs[0].includes(`${TOURS_MAX} tours`), erreurs[0]);
});

Deno.test("« DEJA_JOUE » NE FAIT PAS DE BRUIT, les autres refus si", async () => {
  //  La relève relit : un tour déjà joué est le cas normal, pas une
  //  anomalie. Un sujet clos entre-temps, lui, mérite une ligne.
  const combats = faux(etat());
  combats.reponseDeJouer = { tourId: "t-1", joue: false, raison: "DEJA_JOUE" };
  const muet: string[] = [];
  await new JouerUnTour(combats, TYPES).executer(lue(15601), ATTAQUER, JOUEUR, muet);
  assertEquals(muet, []);

  combats.reponseDeJouer = { tourId: null, joue: false, raison: "COMBAT_CLOS" };
  const bruyant: string[] = [];
  await new JouerUnTour(combats, TYPES).executer(lue(15602), ATTAQUER, JOUEUR, bruyant);
  assertEquals(bruyant.length, 1);
  assert(bruyant[0].includes("COMBAT_CLOS"), bruyant[0]);
});

Deno.test("un refus ne verse aucune expérience", async () => {
  //  Le piège évident : calculer le tour, l'écrire en base, échouer, et
  //  rendre quand même la ligne `xp`. Le joueur gagnerait de
  //  l'expérience pour un tour qui n'a pas eu lieu.
  const combats = faux(etat());
  combats.reponseDeJouer = { tourId: null, joue: false, raison: "TOUR_DEPASSE" };
  const r = await new JouerUnTour(combats, TYPES).executer(
    lue(15601),
    ATTAQUER,
    JOUEUR,
    [],
  );
  assertEquals(r.evenements, []);
});

Deno.test("la Poké Ball et les objets ne sont pas encore servis, et le disent", async () => {
  //  La barre ne propose pas ces boutons, donc un bloc qui les porte
  //  vient d'une main. On ne joue rien, on ne consomme rien.
  for (
    const action of [
      { type: "ball", objetId: 990001 } as const,
      { type: "objet", objetId: 990020 } as const,
      { type: "changer", position: 2 } as const,
    ]
  ) {
    const combats = faux(etat());
    const erreurs: string[] = [];
    await new JouerUnTour(combats, TYPES).executer(
      lue(15601),
      action,
      JOUEUR,
      erreurs,
    );
    assertEquals(combats.joues.length, 0, action.type);
    assert(erreurs[0].includes("pas encore"), erreurs[0]);
  }
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
