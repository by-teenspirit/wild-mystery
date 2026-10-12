// ════════════════════════════════════════════════════════════════════
//  Tâche 8. Ce qui se teste sans base, et c'est l'essentiel de cette
//  tâche : LE RYTHME. L'effacement lui-même est un `delete` en SQL,
//  éprouvé contre un vrai PostgreSQL dans
//  `src/contrat/services.supabase.test.ts`.
//
//  Le rythme, en revanche, est une décision de cette couche, et elle a
//  trois pièges : sauter sans noter, noter sans travailler, et prendre
//  une panne de journal pour un « jamais fait ». Les trois sont ici.
// ════════════════════════════════════════════════════════════════════

import { assertEquals } from "@std/assert";
import {
  JOURS_ENTRE_DEUX_PASSAGES,
  OublierLesAbandons,
  TACHE,
} from "./oublier-les-abandons.ts";
import type { Horloge, JournalDeReleve, Menage, MenageFait } from "./ports.ts";

const MAINTENANT = new Date("2026-10-12T09:00:00Z");
const horloge: Horloge = { maintenant: () => MAINTENANT };

function ilYA(jours: number): Date {
  return new Date(MAINTENANT.getTime() - jours * 24 * 60 * 60 * 1000);
}

type LigneDeJournal = { tache: string; traites: number; erreurs: readonly string[] };

function journalDouble(dernier: Date | null): JournalDeReleve & {
  lignes: LigneDeJournal[];
  demandes: (string | undefined)[];
} {
  const lignes: LigneDeJournal[] = [];
  const demandes: (string | undefined)[] = [];
  return {
    lignes,
    demandes,
    dernierPassage: (tache) => {
      demandes.push(tache);
      return Promise.resolve(dernier);
    },
    noter: (tache, traites, erreurs) => {
      lignes.push({ tache, traites, erreurs });
      return Promise.resolve();
    },
  };
}

const FAIT: MenageFait = { sujets: 3, lignes: 11, jours: 60 };

function menageDouble(fait: MenageFait = FAIT): Menage & { appels: (number | undefined)[] } {
  const appels: (number | undefined)[] = [];
  return {
    appels,
    oublierLesAbandons: (jours) => {
      appels.push(jours);
      return Promise.resolve(fait);
    },
  };
}

Deno.test("JAMAIS FAIT : le ménage tourne", async () => {
  const journal = journalDouble(null);
  const menage = menageDouble();

  const passage = await new OublierLesAbandons(menage, journal, horloge).executer();

  assertEquals(passage.tourne, true);
  assertEquals(passage.fait, FAIT);
  assertEquals(menage.appels, [60]);
  assertEquals(journal.lignes, [{ tache: TACHE, traites: 3, erreurs: [] }]);
  //  Il interroge le journal SUR SA PROPRE TÂCHE, pas sur le dernier
  //  passage de la relève : les autres tâches passent toutes les cinq
  //  minutes, et s'y fier ferait sauter le ménage pour toujours.
  assertEquals(journal.demandes, [TACHE]);
});

Deno.test("FAIT HIER : il saute, ET IL NE NOTE RIEN", async () => {
  //  C'EST LE PIÈGE PRINCIPAL. Noter un passage sauté avancerait la date
  //  du dernier passage, donc repousserait le vrai ménage d'une semaine
  //  — à chaque passage, c'est-à-dire pour toujours. Le ménage
  //  n'aurait jamais lieu, et le journal dirait qu'il tourne.
  const journal = journalDouble(ilYA(1));
  const menage = menageDouble();

  const passage = await new OublierLesAbandons(menage, journal, horloge).executer();

  assertEquals(passage.tourne, false);
  assertEquals(passage.fait, null);
  assertEquals(passage.erreurs, []);
  assertEquals(menage.appels, [], "il n'a pas touché au registre");
  assertEquals(journal.lignes, [], "et il n'a RIEN noté");
});

Deno.test("la frontière est à sept jours, des deux côtés", async () => {
  //  Six jours et vingt-trois heures : on saute. Sept jours pile : on
  //  travaille. Une frontière qu'on ne teste que d'un côté laisse passer
  //  un `<` écrit `<=`.
  const avant = journalDouble(new Date(MAINTENANT.getTime() - (7 * 24 - 1) * 3600_000));
  assertEquals(
    (await new OublierLesAbandons(menageDouble(), avant, horloge).executer()).tourne,
    false,
  );

  const pile = journalDouble(ilYA(JOURS_ENTRE_DEUX_PASSAGES));
  assertEquals(
    (await new OublierLesAbandons(menageDouble(), pile, horloge).executer()).tourne,
    true,
  );
});

Deno.test("la fenêtre d'oubli est passée à la base, et c'est SA valeur qu'on garde", async () => {
  //  La base a le dernier mot sur ce qu'elle a compris. Journaliser la
  //  valeur demandée alors qu'une autre a été appliquée serait un
  //  journal qui mentirait sans jamais se contredire.
  const journal = journalDouble(null);
  const menage = menageDouble({ sujets: 1, lignes: 4, jours: 30 });

  const passage = await new OublierLesAbandons(menage, journal, horloge, 30).executer();

  assertEquals(menage.appels, [30]);
  assertEquals(passage.fait?.jours, 30);
});

Deno.test("une panne d'effacement est notée, pas réessayée dans cinq minutes", async () => {
  //  Sans la ligne de journal, l'échec serait repassé 288 fois par jour
  //  en écrivant 288 fois la même erreur. La semaine est le bon rythme
  //  de réessai pour un travail qui n'est jamais urgent.
  const journal = journalDouble(null);
  const menage: Menage = {
    oublierLesAbandons: () => Promise.reject(new Error("deadlock detected")),
  };

  const passage = await new OublierLesAbandons(menage, journal, horloge).executer();

  assertEquals(passage.tourne, true);
  assertEquals(passage.fait, null);
  assertEquals(passage.erreurs.length, 1);
  assertEquals(passage.erreurs[0].includes("deadlock detected"), true);
  assertEquals(journal.lignes, [{
    tache: TACHE,
    traites: 0,
    erreurs: passage.erreurs,
  }]);
});

Deno.test("UN JOURNAL ILLISIBLE FAIT SAUTER, PAS TOURNER", async () => {
  //  Le piège inverse, et le plus vicieux : traiter l'erreur de lecture
  //  comme un « jamais fait » ferait tourner le ménage à chaque passage
  //  tant que le journal est en panne — c'est-à-dire exactement quand
  //  rien ne pourra le signaler. On saute, et on le dit.
  const menage = menageDouble();
  const journal: JournalDeReleve = {
    dernierPassage: () => Promise.reject(new Error("releve_journal absente")),
    noter: () => Promise.resolve(),
  };

  const passage = await new OublierLesAbandons(menage, journal, horloge).executer();

  assertEquals(passage.tourne, false);
  assertEquals(menage.appels, [], "le registre n'a pas été touché");
  assertEquals(passage.erreurs.length, 1);
  assertEquals(passage.erreurs[0].includes("journal illisible"), true);
});

Deno.test("le nom de la tâche ne doit pas bouger", () => {
  //  Il sert de clé dans `releve_journal` : le changer rendrait tout
  //  l'historique orphelin, et le ménage repartirait comme « jamais
  //  fait » — une fois, sans conséquence, mais sans qu'on le sache.
  assertEquals(TACHE, "menage");
  assertEquals(JOURS_ENTRE_DEUX_PASSAGES, 7);
});
