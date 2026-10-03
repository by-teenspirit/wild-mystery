// ════════════════════════════════════════════════════════════════════
//  src/application/parcourir-les-zones.test.ts
//
//  Ce qu'on vérifie ici, c'est l'ORCHESTRATION — pas les règles, qui sont
//  testées dans le domaine, ni la base, qui est testée en pgTAP.
//
//  Les deux tests qui portent le fichier :
//    · « un sujet illisible n'empêche pas les autres de se clôturer » ;
//    · « après un incident, le curseur n'avance pas ».
//  Le second est contre-intuitif : ne pas avancer fait relire. Mais relire
//  est gratuit (la clôture est idempotente) tandis qu'avancer trop tôt perd
//  la demande d'un joueur pour toujours.
// ════════════════════════════════════════════════════════════════════

import { assert, assertEquals } from "@std/assert";
import {
  CatalogueEnMemoire,
  ClotureEnMemoire,
  EtatDuJeuEnMemoire,
  ForumEnMemoire,
  SignataireDeTest,
} from "../adaptateurs/en-memoire/jeu.ts";
import { RegistreEnMemoire } from "../adaptateurs/en-memoire/registre.ts";
import {
  FauneEnMemoire,
  HeuresEnMemoire,
  JournalEnMemoire,
  SuiviEnMemoire,
} from "../adaptateurs/en-memoire/releve.ts";
import type { DemandeDeClotureLue, LecteurDeDemandes, ZoneSauvage } from "./ports.ts";
import { CloturerUnSujet } from "./cloturer-un-sujet.ts";
import {
  LireLesNouveauxMessages,
  TACHE as TACHE_MESSAGES,
} from "./lire-les-nouveaux-messages.ts";
import { ParcourirLesZones, TACHE } from "./parcourir-les-zones.ts";

const ANNA = "11111111-1111-1111-1111-111111111111";
const COMPTE_ANNA = 3;
const BALL = 1;

const FORET: ZoneSauvage = {
  forumId: 9,
  nom: "Forêt Marécageuse",
  palier: 1,
  parentId: 96,
  aUneFaune: true,
};
const PLAGE: ZoneSauvage = {
  forumId: 32,
  nom: "Plage Grain de Sel",
  palier: 1,
  parentId: 96,
  aUneFaune: true,
};

type Chantier = {
  readonly tache: ParcourirLesZones;
  readonly forum: ForumEnMemoire;
  readonly registre: RegistreEnMemoire;
  readonly suivi: SuiviEnMemoire;
  readonly journal: JournalEnMemoire;
  readonly cloture: ClotureEnMemoire;
};

function monter(
  zones: readonly ZoneSauvage[] = [FORET],
  demandes?: LecteurDeDemandes,
  curseurs: ReadonlyMap<number, number> = new Map(),
): Chantier {
  const forum = new ForumEnMemoire();
  const registre = new RegistreEnMemoire();
  const jeu = new EtatDuJeuEnMemoire();
  const cloture = new ClotureEnMemoire();
  const suivi = new SuiviEnMemoire(curseurs);
  const journal = new JournalEnMemoire();

  jeu.lier(COMPTE_ANNA, ANNA);
  jeu.poser(ANNA, { sac: new Map([[BALL, 5]]), placesEnBoite: 30, pokedollars: 1000 });

  const cloturer = new CloturerUnSujet(
    registre,
    jeu,
    cloture,
    forum,
    new CatalogueEnMemoire().objet(BALL, "Poké Ball"),
    new SignataireDeTest(),
  );

  const faune = new FauneEnMemoire(zones);
  const lecture = new LireLesNouveauxMessages(
    faune,
    forum,
    jeu,
    new HeuresEnMemoire(),
    registre,
    { maintenant: () => new Date("2026-10-03T12:00:00Z") },
    new SignataireDeTest(),
  );

  const tache = new ParcourirLesZones(
    faune,
    forum,
    demandes ?? forum,
    suivi,
    jeu,
    cloturer,
    lecture,
    journal,
  );

  return { tache, forum, registre, suivi, journal, cloture };
}

// ── le cas qui marche ───────────────────────────────────────────────

// ── le premier passage ──────────────────────────────────────────────

Deno.test("au PREMIER passage, la relève ne lit rien et pose son curseur", async () => {
  // Sans ce cas, elle irait lire chaque sujet jamais écrit dans les
  // dix-sept zones, dépasserait la durée maximale d'une fonction Edge, et
  // clôturerait des sujets clos à la main il y a des mois.
  const c = monter();
  c.forum.forumDuSujet.set(7000, 9);
  c.forum.ajouter({
    id: 8001,
    sujetId: 7000,
    auteurId: COMPTE_ANNA,
    auteurPseudo: "Anna",
    corps: "[cloture]",
  });

  const bilan = await c.tache.executer();

  assertEquals(bilan.issues, [], "rien n'est traité au premier passage");
  assertEquals(bilan.erreurs, []);
  assertEquals(c.suivi.curseurs.get(9), 8001, "mais le curseur est posé");
});

Deno.test("une zone vide au premier passage ne pose pas de curseur", async () => {
  const c = monter();
  await c.tache.executer();
  assertEquals(c.suivi.avances, []);
});

Deno.test("au passage SUIVANT, elle traite ce qui est arrivé depuis", async () => {
  const c = monter();
  c.forum.forumDuSujet.set(7000, 9);
  c.forum.ajouter({ id: 8001, sujetId: 7000, auteurId: COMPTE_ANNA, auteurPseudo: "Anna" });
  await c.tache.executer(); // premier passage : pose le curseur à 8001

  await c.registre.inscrire(7000, ANNA, 8002, {
    type: "croise",
    especeId: 37,
  }, "WM-ACDE-FGH");
  c.forum.ajouter({
    id: 8002,
    sujetId: 7000,
    auteurId: COMPTE_ANNA,
    auteurPseudo: "Anna",
    corps: "[cloture]",
  });

  const second = await c.tache.executer();
  assertEquals(second.issues, [{ sujetId: 7000, issue: "close" }]);
});

// ── le cas qui marche ───────────────────────────────────────────────

Deno.test("une demande de clôture dans une zone sauvage est traitée", async () => {
  const c = monter([FORET], undefined, new Map([[9, 8000]]));
  c.forum.forumDuSujet.set(7000, 9);
  c.forum.ajouter({ id: 8001, sujetId: 7000, auteurId: COMPTE_ANNA, auteurPseudo: "Anna" });
  await c.registre.inscrire(7000, ANNA, 8001, {
    type: "objet_trouve",
    objetId: BALL,
    quantite: 1,
  }, "WM-ACDE-FGH");
  c.forum.ajouter({
    id: 8002,
    sujetId: 7000,
    auteurId: COMPTE_ANNA,
    auteurPseudo: "Anna",
    corps: "Voilà, on s'arrête là. [cloture]",
  });

  const bilan = await c.tache.executer();

  assertEquals(bilan.erreurs, []);
  assertEquals(bilan.issues, [{ sujetId: 7000, issue: "close" }]);
  //  Deux lignes de journal, une par tâche : le parcours fait les deux.
  assertEquals(c.journal.lignes, [
    { tache: TACHE_MESSAGES, traites: 0, erreurs: [] },
    { tache: TACHE, traites: 1, erreurs: [] },
  ]);
  assertEquals(c.suivi.curseurs.get(9), 8002, "le curseur avance jusqu'au dernier message");
  //  Le parcours ne poste plus : il applique, et laisse le bilan en file.
  //  C'est `PosterLesBilans` qui publie, dans le même passage de la relève
  //  mais dans une seule et même tâche — un publicateur, pas deux.
  assertEquals(c.forum.postes.length, 0, "le parcours ne publie pas lui-même");
  assert((c.cloture.bilan(7000) ?? "").length > 0, "mais le bilan est bien en file");
});

Deno.test("un sujet sans demande ne déclenche rien, mais fait avancer le curseur", async () => {
  const c = monter([FORET], undefined, new Map([[9, 8000]]));
  c.forum.forumDuSujet.set(7000, 9);
  c.forum.ajouter({
    id: 8001,
    sujetId: 7000,
    auteurId: COMPTE_ANNA,
    auteurPseudo: "Anna",
    corps: "Elle avance dans les hautes herbes.",
  });

  const bilan = await c.tache.executer();
  assertEquals(bilan.issues, []);
  assertEquals(bilan.erreurs, []);
  assertEquals(c.suivi.curseurs.get(9), 8001);
});

Deno.test("un message déjà lu au passage précédent n'est pas relu", async () => {
  const c = monter([FORET], undefined, new Map([[9, 8002]]));
  c.forum.forumDuSujet.set(7000, 9);
  c.forum.ajouter({
    id: 8002,
    sujetId: 7000,
    auteurId: COMPTE_ANNA,
    auteurPseudo: "Anna",
    corps: "[cloture]",
  });

  const bilan = await c.tache.executer();
  assertEquals(bilan.issues, [], "rien de neuf depuis le dernier passage");
  assertEquals(c.suivi.avances, [], "et donc rien à avancer");
});

Deno.test("seuls les sujets des zones sauvages sont parcourus", async () => {
  // Une demande postée en ville ne doit rien déclencher : le jeu ne s'y
  // joue pas, et `data/zones.json` est la seule source de cette liste.
  const c = monter([FORET], undefined, new Map([[9, 8000]]));
  c.forum.forumDuSujet.set(7000, 12); // f12 = Pyrite, une ville
  c.forum.ajouter({
    id: 8001,
    sujetId: 7000,
    auteurId: COMPTE_ANNA,
    auteurPseudo: "Anna",
    corps: "[cloture]",
  });

  const bilan = await c.tache.executer();
  assertEquals(bilan.issues, []);
});

// ── les deux tests qui portent le fichier ───────────────────────────

Deno.test("un sujet illisible n'empêche pas les autres de se clôturer", async () => {
  const forumQuiCasse: LecteurDeDemandes = {
    demandesDeCloture(sujetId: number): Promise<readonly DemandeDeClotureLue[]> {
      if (sujetId === 7000) return Promise.reject(new Error("page illisible"));
      return Promise.resolve([{
        sujetId,
        messageId: 8102,
        auteurId: COMPTE_ANNA,
        auteurPseudo: "Anna",
      }]);
    },
  };

  const c = monter([FORET], forumQuiCasse, new Map([[9, 8000]]));
  c.forum.forumDuSujet.set(7000, 9);
  c.forum.forumDuSujet.set(7001, 9);
  c.forum.ajouter({ id: 8001, sujetId: 7000, auteurId: COMPTE_ANNA, auteurPseudo: "Anna" });
  c.forum.ajouter({ id: 8102, sujetId: 7001, auteurId: COMPTE_ANNA, auteurPseudo: "Anna" });
  await c.registre.inscrire(7001, ANNA, 8102, { type: "croise", especeId: 37 }, "WM-ACDE-FGJ");

  const bilan = await c.tache.executer();

  assertEquals(bilan.issues, [{ sujetId: 7001, issue: "close" }], "le sain passe");
  assertEquals(bilan.erreurs.length, 1, "le malade est signalé");
  assert(bilan.erreurs[0].includes("7000"), bilan.erreurs[0]);
  assert(bilan.erreurs[0].includes("Forêt Marécageuse"), bilan.erreurs[0]);
});

Deno.test("après un incident, le curseur n'avance PAS", async () => {
  // Contre-intuitif mais voulu : ne pas avancer fait relire au prochain
  // passage, et relire est gratuit puisque la clôture est idempotente.
  // Avancer après un échec perdrait la demande pour toujours.
  const quiCasse: LecteurDeDemandes = {
    demandesDeCloture(): Promise<readonly DemandeDeClotureLue[]> {
      return Promise.reject(new Error("page illisible"));
    },
  };
  const c = monter([FORET], quiCasse, new Map([[9, 8000]]));
  c.forum.forumDuSujet.set(7000, 9);
  c.forum.ajouter({ id: 8001, sujetId: 7000, auteurId: COMPTE_ANNA, auteurPseudo: "Anna" });

  await c.tache.executer();
  assertEquals(c.suivi.avances, [], "aucun avancement demandé");
  assertEquals(c.suivi.curseurs.get(9), 8000, "le curseur est resté où il était");
});

Deno.test("relire un sujet déjà clos ne poste rien une seconde fois", async () => {
  // C'est ce qui rend la prudence du test précédent gratuite.
  const c = monter([FORET], undefined, new Map([[9, 8000]]));
  c.forum.forumDuSujet.set(7000, 9);
  c.forum.ajouter({ id: 8001, sujetId: 7000, auteurId: COMPTE_ANNA, auteurPseudo: "Anna" });
  await c.registre.inscrire(7000, ANNA, 8001, { type: "croise", especeId: 37 }, "WM-ACDE-FGH");
  c.forum.ajouter({
    id: 8002,
    sujetId: 7000,
    auteurId: COMPTE_ANNA,
    auteurPseudo: "Anna",
    corps: "[cloture]",
  });

  await c.tache.executer();
  const postesApresLePremier = c.forum.postes.length;

  // Second passage, curseur remis en arrière comme si l'on relisait. Pas
  // à zéro : zéro voudrait dire « premier passage », et la relève ne
  // remonte pas le temps.
  c.suivi.curseurs.set(9, 8000);
  const second = await c.tache.executer();

  assertEquals(second.issues, [{ sujetId: 7000, issue: "deja close" }]);
  assertEquals(c.forum.postes.length, postesApresLePremier, "aucun second bilan posté");
});

// ── les cas limites ─────────────────────────────────────────────────

Deno.test("une zone injoignable n'emporte pas les autres", async () => {
  const c = monter([FORET, PLAGE], undefined, new Map([[9, 8000], [32, 8000]]));
  // La Forêt casse à la lecture des sujets remués, pas à celle d'un sujet.
  const vraiSujetsRemues = c.forum.sujetsRemues.bind(c.forum);
  c.forum.sujetsRemues = (forums) => {
    if (forums.includes(9)) return Promise.reject(new Error("forum injoignable"));
    return vraiSujetsRemues(forums);
  };
  c.forum.forumDuSujet.set(7001, 32);
  c.forum.ajouter({ id: 8101, sujetId: 7001, auteurId: COMPTE_ANNA, auteurPseudo: "Anna" });
  await c.registre.inscrire(7001, ANNA, 8101, { type: "croise", especeId: 37 }, "WM-ACDE-FGJ");
  c.forum.ajouter({
    id: 8102,
    sujetId: 7001,
    auteurId: COMPTE_ANNA,
    auteurPseudo: "Anna",
    corps: "[cloture]",
  });

  const bilan = await c.tache.executer();
  assertEquals(bilan.issues, [{ sujetId: 7001, issue: "close" }]);
  assertEquals(bilan.erreurs.length, 1);
  assert(bilan.erreurs[0].includes("Forêt Marécageuse"), bilan.erreurs[0]);
});

Deno.test("une demande d'un compte non lié est signalée, pas exécutée", async () => {
  const c = monter([FORET], undefined, new Map([[9, 8000]]));
  c.forum.forumDuSujet.set(7000, 9);
  c.forum.ajouter({
    id: 8001,
    sujetId: 7000,
    auteurId: 99,
    auteurPseudo: "Inconnu",
    corps: "[cloture]",
  });

  const bilan = await c.tache.executer();
  assertEquals(bilan.issues, []);
  assertEquals(bilan.erreurs.length, 1);
  assert(bilan.erreurs[0].includes("Inconnu"), bilan.erreurs[0]);
  // Ce n'est pas une panne de la zone : le curseur avance quand même.
  assertEquals(c.suivi.curseurs.get(9), 8001);
});

Deno.test("un sujet sans registre répond « rien a clore », sans erreur", async () => {
  const c = monter([FORET], undefined, new Map([[9, 8000]]));
  c.forum.forumDuSujet.set(7000, 9);
  c.forum.ajouter({
    id: 8001,
    sujetId: 7000,
    auteurId: COMPTE_ANNA,
    auteurPseudo: "Anna",
    corps: "[cloture]",
  });

  const bilan = await c.tache.executer();
  assertEquals(bilan.issues, [{ sujetId: 7000, issue: "rien a clore" }]);
  assertEquals(bilan.erreurs, []);
});

Deno.test("le journal est écrit même quand il n'y a rien eu à faire", async () => {
  // Sinon on ne saurait pas distinguer « la relève n'a rien trouvé » de
  // « la relève n'a pas tourné ».
  const c = monter();
  const bilan = await c.tache.executer();
  assertEquals(bilan.traitees, 0);
  assertEquals(c.journal.lignes, [
    { tache: TACHE_MESSAGES, traites: 0, erreurs: [] },
    { tache: TACHE, traites: 0, erreurs: [] },
  ]);
});

// ── les deux tâches, et leur ordre ──────────────────────────────────

Deno.test("une fouille du même passage est inscrite AVANT la clôture", async () => {
  //  LE TEST QUI PORTE LE BRANCHEMENT. Fouiller puis clôturer dans le
  //  même passage de relève est le cas normal en fin de RP. Si la clôture
  //  passait d'abord, elle verserait un registre auquel il manque la
  //  dernière action — et la clôture efface le registre, donc l'action
  //  serait perdue pour toujours.
  const c = monter([FORET], undefined, new Map([[9, 8000]]));
  c.forum.forumDuSujet.set(7000, 9);
  c.forum.ajouter({
    id: 8001,
    sujetId: 7000,
    auteurId: COMPTE_ANNA,
    auteurPseudo: "Anna",
    corps: "Elle écarte les roseaux.\n\n[[WM-ACTION:fouiller]]",
  });
  c.forum.ajouter({
    id: 8002,
    sujetId: 7000,
    auteurId: COMPTE_ANNA,
    auteurPseudo: "Anna",
    corps: "On s'arrête là. [cloture]",
  });

  const bilan = await c.tache.executer();

  assertEquals(bilan.erreurs, []);
  assertEquals(bilan.inscrites, 1, "la fouille a été inscrite");
  assertEquals(bilan.issues, [{ sujetId: 7000, issue: "close" }]);
  //  Et la preuve que l'ordre a tenu : le bilan versé parle des
  //  Pokédollars trouvés.
  const verse = c.cloture.bilan(7000) ?? "";
  assert(/okédollar/i.test(verse), `le bilan devrait mentionner la trouvaille : ${verse}`);
});

Deno.test("une action d'un joueur sans fiche va dans le journal des messages, pas des clôtures", async () => {
  //  Les deux tâches ont leur ligne : mélanger leurs erreurs ferait croire
  //  à une panne de clôture là où quelqu'un a seulement cliqué sans fiche.
  const c = monter([FORET], undefined, new Map([[9, 8000]]));
  c.forum.forumDuSujet.set(7000, 9);
  c.forum.ajouter({
    id: 8001,
    sujetId: 7000,
    auteurId: 999,
    auteurPseudo: "Inconnu",
    corps: "[[WM-ACTION:fouiller]]",
  });

  await c.tache.executer();

  const messages = c.journal.lignes.find((l) => l.tache === TACHE_MESSAGES);
  const clotures = c.journal.lignes.find((l) => l.tache === TACHE);
  assertEquals(messages?.erreurs.length, 1);
  assert(messages?.erreurs[0].includes("n'est lié à aucun joueur"));
  assertEquals(clotures?.erreurs, []);
});
