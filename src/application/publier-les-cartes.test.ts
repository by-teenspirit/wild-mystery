import { assert, assertEquals, assertStringIncludes } from "@std/assert";
import { corpsDeLaCarte, PublierLesCartes, titreDeLaCarte } from "./publier-les-cartes.ts";
import type { JoueurSansCarte } from "./ports.ts";

/*  LE GABARIT RÉDUIT À CE QUI SE REMPLACE. Les quatre morceaux que
    `corpsDeLaCarte` touche, dans la forme exacte de
    `templates/carte-dresseur.a-coller.html` — c'est le relevé du
    2 novembre, pas une approximation. */
const GABARIT = '<div class="wm-tcard" data-wm-tcard> ' +
  '<img class="wm-dresseur__avatar" src="ADRESSE DE TON AVATAR" alt="" /> ' +
  '<span class="wm-dresseur__nom">TON PERSONNAGE</span> ' +
  '<span class="wm-dresseur__numero">Dresseur nº 0042</span> ' +
  '<ul class="wm-tcard__equipe" data-wm-tcard-equipe></ul></div>';

type Montage = {
  readonly tache: PublierLesCartes;
  readonly crees: { forumId: number; titre: string; corps: string }[];
  readonly notes: { joueurId: string; sujetId: number }[];
  readonly journal: { traites: number; erreurs: readonly string[] }[];
};

function decor(
  attendent: JoueurSansCarte[],
  { echoue = new Set<string>() } = {},
): Montage {
  const crees: { forumId: number; titre: string; corps: string }[] = [];
  const notes: { joueurId: string; sujetId: number }[] = [];
  const journal: { traites: number; erreurs: readonly string[] }[] = [];
  let prochain = 4000;

  const tache = new PublierLesCartes(
    {
      aPublier: () => Promise.resolve(attendent),
      publiee: (joueurId, sujetId) => {
        notes.push({ joueurId, sujetId });
        return Promise.resolve(true);
      },
    },
    {
      creerUnSujet: (forumId, titre, corps) => {
        if (echoue.has(titre)) return Promise.reject(new Error("forum fâché"));
        crees.push({ forumId, titre, corps });
        prochain += 1;
        return Promise.resolve(prochain);
      },
    },
    {
      dernierPassage: () => Promise.resolve(null),
      noter: (_t, traites, erreurs) => {
        journal.push({ traites, erreurs });
        return Promise.resolve();
      },
    },
    () => Promise.resolve(GABARIT),
  );
  return { tache, crees, notes, journal };
}

const ELIOTT: JoueurSansCarte = { joueurId: "u-1", forumUserId: 42, pseudo: "Eliott Vanner" };
const NOA: JoueurSansCarte = { joueurId: "u-2", forumUserId: 43, pseudo: "Noa" };

Deno.test("LE NUMÉRO DU JOUEUR EST ÉCRIT DANS LA CARTE", () => {
  //  Sans lui, les trente cartes afficheraient l'équipe du compte qui
  //  a posté — le script remonte au message pour trouver à qui est la
  //  carte, et ici l'auteur du message n'est pas le joueur.
  const corps = corpsDeLaCarte(GABARIT, ELIOTT);
  assertStringIncludes(corps, 'data-wm-tcard="42"');
  assert(!corps.includes("data-wm-tcard>"), "le marqueur nu ne doit plus être là");
});

Deno.test("le pseudo et le numéro de dresseur remplacent les valeurs d'attente", () => {
  const corps = corpsDeLaCarte(GABARIT, ELIOTT);
  assertStringIncludes(corps, "Eliott Vanner");
  assertStringIncludes(corps, "Dresseur nº 42");
  assert(!corps.includes("TON PERSONNAGE"));
});

Deno.test("L'AVATAR DEVIENT UNE CASE VIDE, PAS UNE IMAGE CASSÉE", () => {
  //  La base ne connaît pas l'avatar d'un joueur, et personne ne peut
  //  éditer un message posté par quelqu'un d'autre. Laisser
  //  « ADRESSE DE TON AVATAR » dans un `src` donnerait une image
  //  brisée dans trente sujets.
  const corps = corpsDeLaCarte(GABARIT, ELIOTT);
  assert(!corps.includes("ADRESSE DE TON AVATAR"));
  assert(!corps.includes('<img class="wm-dresseur__avatar"'));
  assertStringIncludes(corps, "wm-dresseur__avatar--vide");
});

Deno.test("le titre est stable, parce qu'il sert de filet anti-doublon", () => {
  //  L'adaptateur cherche ce titre dans le forum avant de créer. S'il
  //  changeait de forme, chaque joueur aurait un second sujet.
  assertEquals(titreDeLaCarte("Eliott Vanner"), "Carte dresseur — Eliott Vanner");
});

Deno.test("chaque joueur reçoit son sujet, et il est noté tout de suite", async () => {
  const d = decor([ELIOTT, NOA]);
  const bilan = await d.tache.executer(45);
  assertEquals(bilan.publiees, 2);
  assertEquals(d.crees.map((c) => [c.forumId, c.titre]), [
    [45, "Carte dresseur — Eliott Vanner"],
    [45, "Carte dresseur — Noa"],
  ]);
  assertEquals(d.notes, [
    { joueurId: "u-1", sujetId: 4001 },
    { joueurId: "u-2", sujetId: 4002 },
  ]);
});

Deno.test("UNE CARTE QUI ÉCHOUE N'ARRÊTE PAS LES AUTRES", async () => {
  const d = decor([ELIOTT, NOA], { echoue: new Set(["Carte dresseur — Eliott Vanner"]) });
  const bilan = await d.tache.executer(45);
  assertEquals(bilan.publiees, 1);
  assertEquals(bilan.erreurs.length, 1);
  assertStringIncludes(bilan.erreurs[0], "Eliott Vanner");
  //  Noa a bien eu la sienne, et elle est notée.
  assertEquals(d.notes, [{ joueurId: "u-2", sujetId: 4001 }]);
});

Deno.test("sans forum configuré, la tâche ne poste rien et le note", async () => {
  const d = decor([ELIOTT]);
  const bilan = await d.tache.executer(null);
  assertEquals(bilan.publiees, 0);
  assertEquals(d.crees.length, 0);
  assertEquals(d.journal[0].erreurs.length, 1);
});

Deno.test("personne à publier : ni gabarit lu, ni journal écrit", async () => {
  //  La tâche tourne toutes les cinq minutes et, le reste du temps,
  //  il n'y a personne. Elle ne doit alors ni charger le gabarit ni
  //  laisser une ligne de journal à chaque passage.
  const d = decor([]);
  const bilan = await d.tache.executer(45);
  assertEquals(bilan, { publiees: 0, erreurs: [] });
  assertEquals(d.journal.length, 0);
});
