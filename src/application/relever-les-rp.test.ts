import { assert, assertEquals } from "@std/assert";
import { MINUTES_ENTRE_DEUX_PASSAGES, ReleverLesRp, TACHE } from "./relever-les-rp.ts";
import type {
  JoueurARelever,
  JournalDeReleve,
  LecteurDesPseudos,
  LecteurDesSujetsDUnMembre,
  RegistreDesPseudos,
  RegistreDesRp,
  Renommage,
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

/** L'annuaire du forum : qui s'appelle comment aujourd'hui. */
class AnnuaireFeint implements LecteurDesPseudos {
  appels = 0;
  constructor(
    private readonly noms: Record<number, string> = {},
    private readonly tombe = false,
  ) {}
  pseudosDuForum(): Promise<ReadonlyMap<number, string>> {
    this.appels += 1;
    if (this.tombe) return Promise.reject(new Error("HTTP 503"));
    return Promise.resolve(
      new Map(Object.entries(this.noms).map(([id, nom]) => [Number(id), nom])),
    );
  }
}

class PseudosFeints implements RegistreDesPseudos {
  recu: Renommage[][] = [];
  constructor(private readonly tombe = false) {}
  renommer(changements: readonly Renommage[]): Promise<number> {
    this.recu.push([...changements]);
    if (this.tombe) return Promise.reject(new Error("base muette"));
    return Promise.resolve(changements.length);
  }
}

const SCRIBE: JoueurARelever = { joueurId: "j1", forumUserId: 4, pseudo: "Scribe" };
const OMBRE: JoueurARelever = { joueurId: "j2", forumUserId: 7, pseudo: "Ombre" };

const quand = { maintenant: () => MAINTENANT };

Deno.test("elle relève chaque personnage et compte ses sujets", async () => {
  const forum = new ForumFeint({ Scribe: [sujet(996), sujet(977)], Ombre: [sujet(1200)] });
  const registre = new RegistreFeint([SCRIBE, OMBRE]);
  const journal = new JournalFeint(null);

  const passage = await new ReleverLesRp(
    forum,
    registre,
    journal,
    quand,
    new AnnuaireFeint({ 4: "Scribe", 7: "Ombre" }),
    new PseudosFeints(),
  ).executer();

  assertEquals(passage.tourne, true);
  assertEquals(passage.joueurs, 2);
  assertEquals(passage.sujets, 3);
  assertEquals(passage.renommes, 0);
  assertEquals(passage.erreurs, []);
  assertEquals(forum.demandes, ["Scribe", "Ombre"]);
});

Deno.test("LE PERSONNAGE EST PARTICIPANT DE CHACUN DE SES SUJETS", async () => {
  //  C'est la prémisse même de la recherche : elle rend les sujets où
  //  IL A ÉCRIT. Sans cette ligne, les RP communs de la fiche de liens
  //  seraient vides pour tout le monde — on saurait qui a ouvert et
  //  qui a répondu en dernier, jamais que la personne y était.
  const forum = new ForumFeint({ Scribe: [sujet(996, { participants: [] })] });
  const registre = new RegistreFeint([SCRIBE]);
  await new ReleverLesRp(
    forum,
    registre,
    new JournalFeint(null),
    quand,
    new AnnuaireFeint(),
    new PseudosFeints(),
  ).executer();
  assertEquals(registre.recu[0].sujets[0].participants, [{ id: 4, pseudo: "Scribe" }]);
});

Deno.test("et il n'y figure pas deux fois quand la page le nomme déjà", async () => {
  const forum = new ForumFeint({
    Scribe: [
      sujet(996, { participants: [{ id: 4, pseudo: "Scribe" }, { id: 1, pseudo: "Arceus" }] }),
    ],
  });
  const registre = new RegistreFeint([SCRIBE]);
  await new ReleverLesRp(
    forum,
    registre,
    new JournalFeint(null),
    quand,
    new AnnuaireFeint(),
    new PseudosFeints(),
  ).executer();
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
  const passage = await new ReleverLesRp(
    forum,
    registre,
    new JournalFeint(null),
    quand,
    new AnnuaireFeint(),
    new PseudosFeints(),
  ).executer();

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
  const annuaire = new AnnuaireFeint({ 4: "Plume" });
  const passage = await new ReleverLesRp(
    forum,
    registre,
    new JournalFeint(ilYAUneDemiHeure),
    quand,
    annuaire,
    new PseudosFeints(),
  ).executer();

  assertEquals(passage.tourne, false);
  assertEquals(forum.demandes, [], "aucune page n'a été demandée");
  //  ET L'ANNUAIRE NON PLUS. Il est gratuit par rapport à la recherche,
  //  pas gratuit tout court : une page toutes les cinq minutes pour un
  //  passage qu'on saute, c'est 288 pages par jour pour rien.
  assertEquals(annuaire.appels, 0, "l'annuaire n'est pas demandé pour rien");
});

Deno.test("mais elle tourne passé l'heure", async () => {
  const forum = new ForumFeint({ Scribe: [sujet(996)] });
  const vieux = new Date(MAINTENANT.getTime() - (MINUTES_ENTRE_DEUX_PASSAGES + 1) * 60_000);
  const passage = await new ReleverLesRp(
    forum,
    new RegistreFeint([SCRIBE]),
    new JournalFeint(vieux),
    quand,
    new AnnuaireFeint(),
    new PseudosFeints(),
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
    quand,
    new AnnuaireFeint(),
    new PseudosFeints(),
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
  await new ReleverLesRp(
    forum,
    new RegistreFeint([SCRIBE]),
    journal,
    quand,
    new AnnuaireFeint(),
    new PseudosFeints(),
  ).executer();

  assertEquals(journal.notes.length, 1);
  assertEquals(journal.notes[0].tache, TACHE);
  assertEquals(journal.notes[0].traites, 0);
  assertEquals(journal.notes[0].erreurs.length, 1);
});

// ── L'ANNUAIRE DES PSEUDOS ─────────────────────────────────────────

Deno.test("UN PSEUDO CHANGÉ EST CORRIGÉ, ET LA RECHERCHE PART AVEC LE NEUF", async () => {
  //  Le défaut du 13 novembre, en une ligne : u4 s'appelait « Compte de
  //  test », il s'appelle « Jake Dalziel ». Chercher avec l'ancien nom
  //  rend zéro sujet, et le carnet annonce que personne n'a écrit.
  //
  //  CORRIGER EN BASE NE SUFFIT PAS : si la recherche part quand même
  //  avec l'ancien nom, le défaut est le même, déplacé d'une ligne.
  const forum = new ForumFeint({ "Jake Dalziel": [sujet(996)] });
  const registre = new RegistreFeint([{ ...SCRIBE, pseudo: "Compte de test" }]);
  const pseudos = new PseudosFeints();
  const passage = await new ReleverLesRp(
    forum,
    registre,
    new JournalFeint(null),
    quand,
    new AnnuaireFeint({ 4: "Jake Dalziel" }),
    pseudos,
  ).executer();

  assertEquals(pseudos.recu, [[{ forumUserId: 4, pseudo: "Jake Dalziel" }]]);
  assertEquals(passage.renommes, 1);
  assertEquals(forum.demandes, ["Jake Dalziel"]);
  assertEquals(passage.sujets, 1);
  //  ET LE PARTICIPANT PORTE LE NOM FRAIS, pas celui de la base.
  assertEquals(registre.recu[0].sujets[0].participants[0], {
    id: 4,
    pseudo: "Jake Dalziel",
  });
});

Deno.test("un nom qui n'a pas changé n'est pas envoyé", async () => {
  //  La base ne compterait rien, mais le journal annoncerait trente
  //  renommages par heure — et un journal qui crie tout le temps ne dit
  //  plus rien.
  const pseudos = new PseudosFeints();
  const passage = await new ReleverLesRp(
    new ForumFeint({ Scribe: [] }),
    new RegistreFeint([SCRIBE]),
    new JournalFeint(null),
    quand,
    new AnnuaireFeint({ 4: "Scribe" }),
    pseudos,
  ).executer();
  assertEquals(pseudos.recu, [], "aucun appel de renommage");
  assertEquals(passage.renommes, 0);
});

Deno.test("UN MEMBRE ABSENT DE L'ANNUAIRE GARDE LE NOM QU'ON A", async () => {
  //  La liste peut être partielle — une page de pagination qui tombe,
  //  un gabarit en travaux, un `<a>` sans texte que le lecteur écarte.
  //  Mieux vaut un nom vieux d'une heure qu'un personnage renommé
  //  « rien », et surtout : on ne le renomme pas du tout.
  const forum = new ForumFeint({ Scribe: [sujet(996)], Ombre: [] });
  const pseudos = new PseudosFeints();
  const passage = await new ReleverLesRp(
    forum,
    new RegistreFeint([SCRIBE, OMBRE]),
    new JournalFeint(null),
    quand,
    new AnnuaireFeint({ 4: "Scribe" }),
    pseudos,
  ).executer();
  assertEquals(pseudos.recu, []);
  assertEquals(forum.demandes, ["Scribe", "Ombre"]);
  assertEquals(passage.erreurs, [], "une liste partielle n'est pas une erreur");
});

Deno.test("UN ANNUAIRE ILLISIBLE NE FAIT PAS SAUTER LE PASSAGE", async () => {
  //  L'annuaire est une amélioration de la relève, pas sa condition :
  //  on relève avec les noms qu'on a, et l'erreur est dans le journal.
  const forum = new ForumFeint({ Scribe: [sujet(996)] });
  const journal = new JournalFeint(null);
  const passage = await new ReleverLesRp(
    forum,
    new RegistreFeint([SCRIBE]),
    journal,
    quand,
    new AnnuaireFeint({}, true),
    new PseudosFeints(),
  ).executer();

  assertEquals(passage.tourne, true);
  assertEquals(passage.sujets, 1, "la relève a eu lieu");
  assertEquals(forum.demandes, ["Scribe"]);
  assertEquals(passage.renommes, 0);
  assertEquals(passage.erreurs.length, 1);
  assert(
    passage.erreurs[0].includes("annuaire"),
    "l'erreur nomme l'annuaire, pas la recherche",
  );
  assertEquals(journal.notes[0].erreurs.length, 1, "et elle est notée");
});

Deno.test("UN RENOMMAGE REFUSÉ FAIT CHERCHER AVEC LES ANCIENS NOMS", async () => {
  //  Ce sont ceux que la base a encore, et c'est sous eux que le
  //  résultat sera rangé. Chercher avec le nom frais rangerait les
  //  sujets d'aujourd'hui sous un personnage qui s'appelle encore
  //  autrement — un tableau faux, là où on avait un tableau vieux.
  const forum = new ForumFeint({ "Compte de test": [sujet(996)], "Jake Dalziel": [sujet(42)] });
  const passage = await new ReleverLesRp(
    forum,
    new RegistreFeint([{ ...SCRIBE, pseudo: "Compte de test" }]),
    new JournalFeint(null),
    quand,
    new AnnuaireFeint({ 4: "Jake Dalziel" }),
    new PseudosFeints(true),
  ).executer();

  assertEquals(forum.demandes, ["Compte de test"]);
  assertEquals(passage.renommes, 0);
  assertEquals(passage.erreurs.length, 1);
  assert(passage.erreurs[0].includes("renommage"), "l'erreur dit ce qui a été refusé");
});
