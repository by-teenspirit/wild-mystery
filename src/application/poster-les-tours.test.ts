// ════════════════════════════════════════════════════════════════════
//  src/application/poster-les-tours.test.ts
//
//  Les deux tests qui portent ce fichier.
//
//  **Un tour qui ne part pas reste en file.** Un tour sans message
//  laisse le joueur devant un combat dont il ne connaît pas l'état, et
//  il jouera le suivant à l'aveugle.
//
//  **LE CODE D'UN TOUR N'EST PAS CELUI DE SA CARTE.** Les deux
//  naissent parfois du même message — une rencontre qui s'ouvre et un
//  tour qui se joue dans le même parcours — et deux marqueurs
//  identiques feraient que l'adaptateur prend l'un pour l'autre : il
//  relirait le sujet, y trouverait la carte, et croirait le tour déjà
//  posté.
// ════════════════════════════════════════════════════════════════════

import { assert, assertEquals } from "@std/assert";
import type { PosteurSurForum, Signataire, TourEnAttente, ToursEnAttente } from "./ports.ts";
import { JournalEnMemoire } from "../adaptateurs/en-memoire/releve.ts";
import { ESSAIS_AVANT_DE_CRIER, PosterLesTours, TACHE } from "./poster-les-tours.ts";
import { PosterLesRencontres } from "./poster-les-rencontres.ts";
import type { RencontreEnAttente } from "./ports.ts";

class FileEnMemoire implements ToursEnAttente {
  readonly restants: TourEnAttente[] = [];
  readonly postes: { tourId: string; messageId: number }[] = [];
  readonly echecs: { tourId: string; erreur: string }[] = [];

  ajouter(t: Partial<TourEnAttente> & { tourId: string }): this {
    this.restants.push({
      combatId: "c-1",
      sujetId: 996,
      messageId: 15601,
      numero: 1,
      demande: "attaquer",
      detail: { nom: "Flammèche" },
      recit: {
        frappes: [{
          qui: "joueur",
          capacite: { nom: "Flammèche" },
          touche: true,
          degats: { points: 12, efficacite: 1, de: 93 },
        }],
      },
      fin: null,
      essais: 0,
      mentionne: "Jake Dalziel",
      sauvage: { especeId: 77, nom: "Ponyta", pv: 18, pvMax: 30 },
      combattant: { especeId: 4, nom: "Salamèche", surnom: null, pv: 11, pvMax: 18 },
      ...t,
    });
    return this;
  }

  aPoster(combien: number): Promise<readonly TourEnAttente[]> {
    return Promise.resolve(this.restants.slice(0, combien));
  }

  poste(tourId: string, messageId: number): Promise<void> {
    this.postes.push({ tourId, messageId });
    const ou = this.restants.findIndex((t) => t.tourId === tourId);
    if (ou >= 0) this.restants.splice(ou, 1);
    return Promise.resolve();
  }

  echoue(tourId: string, erreur: string): Promise<number> {
    this.echecs.push({ tourId, erreur });
    const t = this.restants.find((x) => x.tourId === tourId);
    const essais = (t?.essais ?? 0) + 1;
    if (t) this.restants[this.restants.indexOf(t)] = { ...t, essais };
    return Promise.resolve(essais);
  }
}

function posteur(
  comportement: (sujetId: number) => number | Error,
): PosteurSurForum & { vus: { corps: string; code: string }[] } {
  const vus: { corps: string; code: string }[] = [];
  return {
    vus,
    repondre(
      sujetId: number,
      _mentionne: string,
      corps: string,
      code: string,
    ): Promise<number> {
      vus.push({ corps, code });
      const quoi = comportement(sujetId);
      return quoi instanceof Error ? Promise.reject(quoi) : Promise.resolve(quoi);
    },
  };
}

/** Une empreinte qui DIFFUSE : chaque caractère touche tous les
 *  octets, comme un HMAC. Un faux sans diffusion ne prouverait rien
 *  sur un code qui ne lit que les sept premiers. */
const signataire: Signataire = {
  empreinte(message: string): Promise<Uint8Array> {
    const octets = new Uint8Array(16);
    let melange = 0x811c9dc5;
    for (let i = 0; i < message.length; i++) {
      melange = (melange ^ message.charCodeAt(i)) * 0x01000193 >>> 0;
    }
    for (let i = 0; i < 16; i++) {
      melange = (melange ^ (i + 1)) * 0x01000193 >>> 0;
      octets[i] = (melange >>> 24) & 0xff;
    }
    return Promise.resolve(octets);
  },
};

const RACINE = "https://exemple.test/wm/";

Deno.test("un tour part, et sort de la file", async () => {
  const file = new FileEnMemoire().ajouter({ tourId: "t1" });
  const forum = posteur(() => 90001);
  const passage = await new PosterLesTours(
    file,
    forum,
    signataire,
    new JournalEnMemoire(),
    RACINE,
  ).executer();

  assertEquals(passage.publies, [{
    tourId: "t1",
    sujetId: 996,
    messageId: 90001,
  }]);
  assertEquals(file.restants.length, 0);
  assert(
    forum.vus[0].corps.startsWith('<div class="wm-combat wm-combat--tour">'),
    forum.vus[0].corps,
  );
});

Deno.test("LE CODE D'UN TOUR N'EST PAS CELUI DE SA CARTE", async () => {
  //  Les deux naissent du même message. Deux marqueurs identiques, et
  //  l'adaptateur relirait le sujet, y trouverait la carte, et croirait
  //  le tour déjà posté.
  const forumTour = posteur(() => 90001);
  await new PosterLesTours(
    new FileEnMemoire().ajouter({ tourId: "t1", messageId: 15601 }),
    forumTour,
    signataire,
    new JournalEnMemoire(),
    RACINE,
  ).executer();

  const carte: RencontreEnAttente = {
    combatId: "c-1",
    sujetId: 996,
    messageId: 15601,
    mentionne: "Jake Dalziel",
    essais: 0,
    rappel: false,
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
    combattant: null,
  };
  const forumCarte = posteur(() => 90002);
  await new PosterLesRencontres(
    {
      aPoster: () => Promise.resolve([carte]),
      postee: () => Promise.resolve(),
      echouee: () => Promise.resolve(1),
    },
    forumCarte,
    signataire,
    new JournalEnMemoire(),
    RACINE,
  ).executer();

  assert(
    forumTour.vus[0].code !== forumCarte.vus[0].code,
    `le tour et la carte portent le même code : ${forumTour.vus[0].code}`,
  );
});

Deno.test("deux tours du même combat portent deux codes", async () => {
  //  Sinon le second serait pris pour le premier, déjà posté.
  const forum = posteur(() => 90001);
  await new PosterLesTours(
    new FileEnMemoire()
      .ajouter({ tourId: "t1", messageId: 15601, numero: 1 })
      .ajouter({ tourId: "t2", messageId: 15602, numero: 2 }),
    forum,
    signataire,
    new JournalEnMemoire(),
    RACINE,
  ).executer();

  assert(forum.vus[0].code !== forum.vus[1].code);
});

Deno.test("un tour qui ne part pas reste en file", async () => {
  const file = new FileEnMemoire().ajouter({ tourId: "t1" });
  const journal = new JournalEnMemoire();
  const passage = await new PosterLesTours(
    file,
    posteur(() => new Error("sujet verrouillé")),
    signataire,
    journal,
    RACINE,
  ).executer();

  assertEquals(passage.publies, []);
  assertEquals(passage.erreurs.length, 1);
  assert(passage.erreurs[0].includes("tour 1 du sujet 996"), passage.erreurs[0]);
  assertEquals(file.restants.length, 1);
  assertEquals(file.restants[0].essais, 1);
  assertEquals(journal.lignes[0].tache, TACHE);
});

Deno.test("un tour qui échoue n'empêche pas les suivants", async () => {
  const file = new FileEnMemoire()
    .ajouter({ tourId: "t1", sujetId: 100 })
    .ajouter({ tourId: "t2", sujetId: 200 });
  const passage = await new PosterLesTours(
    file,
    posteur((sujetId) => sujetId === 100 ? new Error("verrouillé") : 90002),
    signataire,
    new JournalEnMemoire(),
    RACINE,
  ).executer();

  assertEquals(passage.publies.length, 1);
  assertEquals(passage.publies[0].sujetId, 200);
  assertEquals(passage.erreurs.length, 1);
});

Deno.test("au-delà de dix essais, la tâche le dit", async () => {
  const file = new FileEnMemoire().ajouter({
    tourId: "t1",
    essais: ESSAIS_AVANT_DE_CRIER - 1,
  });
  const passage = await new PosterLesTours(
    file,
    posteur(() => new Error("toujours non")),
    signataire,
    new JournalEnMemoire(),
    RACINE,
  ).executer();

  assert(passage.erreurs[0].includes("ça ne passera pas tout seul"));
  assertEquals(file.restants.length, 1);
});

Deno.test("une file vide se note quand même", async () => {
  //  C'est ce qui distingue « rien à poster » de « la tâche n'a pas
  //  tourné ».
  const journal = new JournalEnMemoire();
  const passage = await new PosterLesTours(
    new FileEnMemoire(),
    posteur(() => 90001),
    signataire,
    journal,
    RACINE,
  ).executer();

  assertEquals(passage.publies, []);
  assertEquals(journal.lignes.length, 1);
  assertEquals(journal.lignes[0].traites, 0);
});
