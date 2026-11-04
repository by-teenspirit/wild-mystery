import { assert, assertEquals } from "@std/assert";
import { MINUTES_ENTRE_DEUX_PASSAGES, ReleverLesRp, TACHE } from "./relever-les-rp.ts";
import type {
  JoueurARelever,
  JournalDeReleve,
  LecteurDesSujetsDUnMembre,
  RegistreDesRp,
  SujetDUnJoueur,
} from "./ports.ts";

const MAINTENANT = new Date("2026-11-04T18:00:00Z");

function sujet(sujetId: number, dessus: Partial<SujetDUnJoueur> = {}): SujetDUnJoueur {
  return {
    sujetId,
    titre: `sujet ${sujetId}`,
    forumId: 36,
    forumNom: "Steppes Arides",
    reponses: 3,
    dernierLe: "2026-10-28T13:34:00Z",
    dernierAuteur: "Arceus",
    dernierMessage: 15582,
    participants: [],
    ...dessus,
  };
}

class JournalFeint implements JournalDeReleve {
  notes: { tache: string; traites: number; erreurs: readonly string[] }[] = [];
  constructor(private readonly le: Date | null, private readonly leve = false) {}
  dernierPassage(): Promise<Date | null> {
    if (this.leve) return Promise.reject(new Error("base muette"));
    return Promise.resolve(this.le);
  }
  noter(tache: string, traites: number, erreurs: readonly string[]): Promise<void> {
    this.notes.push({ tache, traites, erreurs });
    return Promise.resolve();
  }
}

class ForumFeint implements LecteurDesSujetsDUnMembre {
  demandes: string[] = [];
  constructor(
    private readonly par: Record<string, SujetDUnJoueur[]>,
    private readonly tombe: string[] = [],
  ) {}
  sujetsEcritsPar(pseudo: string): Promise<readonly SujetDUnJoueur[]> {
    this.demandes.push(pseudo);
    if (this.tombe.includes(pseudo)) return Promise.reject(new Error("HTTP 500"));
    return Promise.resolve(this.par[pseudo] ?? []);
  }
}

class RegistreFeint implements RegistreDesRp {
  recu: { joueurId: string; sujets: readonly SujetDUnJoueur[] }[] = [];
  constructor(private readonly joueurs: JoueurARelever[]) {}
  joueursARelever(): Promise<readonly JoueurARelever[]> {
    return Promise.resolve(this.joueurs);
  }
  relever(
    joueurId: string,
    sujets: readonly SujetDUnJoueur[],
  ): Promise<{ ecrits: number; effaces: number }> {
    this.recu.push({ joueurId, sujets });
    return Promise.resolve({ ecrits: sujets.length, effaces: 0 });
  }
}

const SCRIBE: JoueurARelever = { joueurId: "j1", forumUserId: 4, pseudo: "Scribe" };
const OMBRE: JoueurARelever = { joueurId: "j2", forumUserId: 7, pseudo: "Ombre" };

Deno.test("elle relève chaque personnage et compte ses sujets", async () => {
  const forum = new ForumFeint({ Scribe: [sujet(996), sujet(977)], Ombre: [sujet(1200)] });
  const registre = new RegistreFeint([SCRIBE, OMBRE]);
  const journal = new JournalFeint(null);

  const passage = await new ReleverLesRp(forum, registre, journal, {
    maintenant: () => MAINTENANT,
  }).executer();

  assertEquals(passage.tourne, true);
  assertEquals(passage.joueurs, 2);
  assertEquals(passage.sujets, 3);
  assertEquals(passage.erreurs, []);
  assertEquals(forum.demandes, ["Scribe", "Ombre"]);
});

Deno.test("LE PERSONNAGE EST PARTICIPANT DE CHACUN DE SES SUJETS", () => {
  //  C'est la prémisse même de la recherche : elle rend les sujets où
  //  IL A ÉCRIT. Sans cette ligne, les RP communs de la fiche de liens
  //  seraient vides pour tout le monde — on saurait qui a ouvert et
  //  qui a répondu en dernier, jamais que la personne y était.
  const forum = new ForumFeint({ Scribe: [sujet(996, { participants: [] })] });
  const registre = new RegistreFeint([SCRIBE]);
  return new ReleverLesRp(forum, registre, new JournalFeint(null), {
    maintenant: () => MAINTENANT,
  }).executer().then(() => {
    assertEquals(registre.recu[0].sujets[0].participants, [{ id: 4, pseudo: "Scribe" }]);
  });
});

Deno.test("et il n'y figure pas deux fois quand la page le nomme déjà", async () => {
  const forum = new ForumFeint({
    Scribe: [
      sujet(996, { participants: [{ id: 4, pseudo: "Scribe" }, { id: 1, pseudo: "Arceus" }] }),
    ],
  });
  const registre = new RegistreFeint([SCRIBE]);
  await new ReleverLesRp(forum, registre, new JournalFeint(null), {
    maintenant: () => MAINTENANT,
  }).executer();
  assertEquals(registre.recu[0].sujets[0].participants, [
    { id: 4, pseudo: "Scribe" },
    { id: 1, pseudo: "Arceus" },
  ]);
});

Deno.test("UN PERSONNAGE QUI ÉCHOUE N'EMPORTE PAS LES AUTRES", async () => {
  //  Une page qui ne répond pas, c'est l'affaire d'un personnage. Les
  //  autres doivent être relevés quand même.
  const forum = new ForumFeint({ Ombre: [sujet(1200)] }, ["Scribe"]);
  const registre = new RegistreFeint([SCRIBE, OMBRE]);
  const passage = await new ReleverLesRp(forum, registre, new JournalFeint(null), {
    maintenant: () => MAINTENANT,
  }).executer();

  assertEquals(passage.joueurs, 1);
  assertEquals(passage.sujets, 1);
  assertEquals(passage.erreurs.length, 1);
  assert(
    passage.erreurs[0].includes("Scribe"),
    "le nom de celui qui a manqué est dans l'erreur",
  );
});

Deno.test("ELLE NE TOURNE PAS SI LE DERNIER PASSAGE EST RÉCENT", async () => {
  //  Une page de recherche par personnage, 288 fois par jour, c'est
  //  plus de huit mille pages demandées au forum pour apprendre qu'un
  //  sujet a bougé. Le forum est un hébergement partagé.
  const forum = new ForumFeint({ Scribe: [sujet(996)] });
  const registre = new RegistreFeint([SCRIBE]);
  const ilYAUneDemiHeure = new Date(MAINTENANT.getTime() - 30 * 60_000);
  const passage = await new ReleverLesRp(forum, registre, new JournalFeint(ilYAUneDemiHeure), {
    maintenant: () => MAINTENANT,
  }).executer();

  assertEquals(passage.tourne, false);
  assertEquals(forum.demandes, [], "aucune page n'a été demandée");
});

Deno.test("mais elle tourne passé l'heure", async () => {
  const forum = new ForumFeint({ Scribe: [sujet(996)] });
  const vieux = new Date(MAINTENANT.getTime() - (MINUTES_ENTRE_DEUX_PASSAGES + 1) * 60_000);
  const passage = await new ReleverLesRp(
    forum,
    new RegistreFeint([SCRIBE]),
    new JournalFeint(vieux),
    { maintenant: () => MAINTENANT },
  ).executer();
  assertEquals(passage.tourne, true);
});

Deno.test("UN JOURNAL ILLISIBLE FAIT SAUTER LE PASSAGE, il ne le déclenche pas", async () => {
  //  Prendre la panne pour un « jamais fait » ferait tourner la tâche
  //  à chaque passage tant que le journal est en panne — c'est-à-dire
  //  exactement quand on ne pourra pas s'en apercevoir.
  const forum = new ForumFeint({ Scribe: [sujet(996)] });
  const passage = await new ReleverLesRp(
    forum,
    new RegistreFeint([SCRIBE]),
    new JournalFeint(null, true),
    { maintenant: () => MAINTENANT },
  ).executer();

  assertEquals(passage.tourne, false);
  assertEquals(forum.demandes, []);
  assertEquals(passage.erreurs.length, 1);
});

Deno.test("ON NOTE LE JOURNAL MÊME QUAND TOUT A ÉCHOUÉ", async () => {
  //  Sans ça, une tâche en panne serait retentée toutes les cinq
  //  minutes et écrirait la même erreur 288 fois par jour.
  const forum = new ForumFeint({}, ["Scribe"]);
  const journal = new JournalFeint(null);
  await new ReleverLesRp(forum, new RegistreFeint([SCRIBE]), journal, {
    maintenant: () => MAINTENANT,
  }).executer();

  assertEquals(journal.notes.length, 1);
  assertEquals(journal.notes[0].tache, TACHE);
  assertEquals(journal.notes[0].traites, 0);
  assertEquals(journal.notes[0].erreurs.length, 1);
});
