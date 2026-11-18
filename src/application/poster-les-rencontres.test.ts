// ════════════════════════════════════════════════════════════════════
//  src/application/poster-les-rencontres.test.ts
//
//  Les tests qui portent ce fichier.
//
//  **Une carte qui ne part pas reste en file.** Même défaut que celui
//  constaté en vrai le 2 octobre sur les bilans : sans file, un combat
//  s'ouvrirait et le joueur n'aurait jamais rien à lire — et rien ne
//  réessaierait.
//
//  **Le code dérive du message du joueur, pas de l'instant.** C'est ce
//  qui rend un reposté reconnaissable par le marqueur de l'adaptateur.
//  Un code qui changerait à chaque essai ferait deux cartes sous le même
//  message.
//
//  **Une carte qui échoue n'empêche pas les suivantes.** Le forum peut
//  refuser un sujet verrouillé et accepter le suivant.
// ════════════════════════════════════════════════════════════════════

import { assert, assertEquals } from "@std/assert";
import type {
  CartesDeRencontreEnAttente,
  PosteurSurForum,
  RencontreEnAttente,
  Signataire,
} from "./ports.ts";
import { JournalEnMemoire } from "../adaptateurs/en-memoire/releve.ts";
import { ESSAIS_AVANT_DE_CRIER, PosterLesRencontres, TACHE } from "./poster-les-rencontres.ts";

class FileEnMemoire implements CartesDeRencontreEnAttente {
  readonly restantes: RencontreEnAttente[] = [];
  readonly postees: { combatId: string; messageId: number }[] = [];
  readonly echecs: { combatId: string; erreur: string }[] = [];

  ajouter(r: Partial<RencontreEnAttente> & { combatId: string }): this {
    this.restantes.push({
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
      combattant: {
        especeId: 4,
        nom: "Salamèche",
        surnom: null,
        niveau: 5,
        types: ["feu"],
        pv: 18,
        pvMax: 18,
        attaque: 10,
        defense: 9,
      },
      ...r,
    });
    return this;
  }

  aPoster(combien: number): Promise<readonly RencontreEnAttente[]> {
    return Promise.resolve(this.restantes.slice(0, combien));
  }

  postee(combatId: string, messageId: number): Promise<void> {
    this.postees.push({ combatId, messageId });
    const ou = this.restantes.findIndex((r) => r.combatId === combatId);
    if (ou >= 0) this.restantes.splice(ou, 1);
    return Promise.resolve();
  }

  echouee(combatId: string, erreur: string): Promise<number> {
    this.echecs.push({ combatId, erreur });
    const r = this.restantes.find((x) => x.combatId === combatId);
    const essais = (r?.essais ?? 0) + 1;
    if (r) this.restantes[this.restantes.indexOf(r)] = { ...r, essais };
    return Promise.resolve(essais);
  }
}

function posteur(
  comportement: (sujetId: number) => number | Error,
): PosteurSurForum & {
  vus: { sujetId: number; mentionne: string; corps: string; code: string }[];
} {
  const vus: {
    sujetId: number;
    mentionne: string;
    corps: string;
    code: string;
  }[] = [];
  return {
    vus,
    repondre(
      sujetId: number,
      mentionne: string,
      corps: string,
      code: string,
    ): Promise<number> {
      vus.push({ sujetId, mentionne, corps, code });
      const quoi = comportement(sujetId);
      return quoi instanceof Error ? Promise.reject(quoi) : Promise.resolve(quoi);
    },
  };
}

/** Une empreinte déterministe, et QUI DIFFUSE.
 *
 *  Premier jet : `octets[i % 16] += message.charCodeAt(i)`. Chaque
 *  caractère ne touchait qu'un seul octet, et le test « deux messages,
 *  deux codes » est tombé — parce que `codeDepuisEmpreinte` ne lit que
 *  les SEPT PREMIERS octets, et que mes deux messages ne différaient
 *  qu'à partir du douzième.
 *
 *  Le code n'avait rien de faux : c'est le faux qui ne ressemblait pas
 *  à ce qu'il remplace. UNE EMPREINTE DIGNE DE CE NOM PROPAGE CHAQUE
 *  CARACTÈRE SUR TOUS SES OCTETS, et le vrai signataire — un HMAC — le
 *  fait. Un faux sans diffusion ne prouve rien sur un code qui n'en lit
 *  qu'un bout. */
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

function tache(
  file: FileEnMemoire,
  forum: PosteurSurForum,
): { journal: JournalEnMemoire; poster: PosterLesRencontres } {
  const journal = new JournalEnMemoire();
  return {
    journal,
    poster: new PosterLesRencontres(file, forum, signataire, journal, RACINE),
  };
}

const RACINE = "https://exemple.test/wm/";

Deno.test("une carte part, et sort de la file", async () => {
  const file = new FileEnMemoire().ajouter({ combatId: "c1" });
  const forum = posteur(() => 90001);
  const { poster } = tache(file, forum);

  const passage = await poster.executer();

  assertEquals(passage.publiees, [{
    combatId: "c1",
    sujetId: 996,
    messageId: 90001,
  }]);
  assertEquals(passage.erreurs, []);
  assertEquals(file.restantes.length, 0);
  //  Le message posté est bien la carte, mentionnée au bon joueur.
  assertEquals(forum.vus[0].mentionne, "Jake Dalziel");
  assert(
    forum.vus[0].corps.startsWith('<div class="wm-combat wm-combat--rencontre">'),
    forum.vus[0].corps,
  );
  assert(forum.vus[0].corps.includes("Un Ponyta sauvage apparaît."));
});

Deno.test("le corps porte les chiffres de la file, pas d'autres", async () => {
  //  La tâche ne recalcule rien : si la file dit 777 PV, le sujet dit
  //  777 PV. C'est la base qui décide, et elle seule.
  const file = new FileEnMemoire().ajouter({
    combatId: "c1",
    sauvage: {
      especeId: 77,
      nom: "Ponyta",
      niveau: 10,
      types: ["feu"],
      pv: 777,
      pvMax: null,
      attaque: 22,
      defense: 16,
    },
  });
  const forum = posteur(() => 90001);
  await tache(file, forum).poster.executer();
  assert(forum.vus[0].corps.includes(">777 PV<"), forum.vus[0].corps);
});

Deno.test("le code suit le message du joueur, pas l'instant", async () => {
  const forum1 = posteur(() => 90001);
  const file1 = new FileEnMemoire().ajouter({ combatId: "c1", messageId: 15601 });
  await tache(file1, forum1).poster.executer();

  //  Même message, deuxième passage : même code, donc le marqueur de
  //  l'adaptateur reconnaîtra sa propre carte.
  const forum2 = posteur(() => 90002);
  const file2 = new FileEnMemoire().ajouter({ combatId: "c1", messageId: 15601 });
  await tache(file2, forum2).poster.executer();

  assertEquals(forum1.vus[0].code, forum2.vus[0].code);

  //  Autre message, autre code : sinon deux rencontres différentes
  //  porteraient le même marqueur et l'une passerait pour l'autre.
  const forum3 = posteur(() => 90003);
  const file3 = new FileEnMemoire().ajouter({ combatId: "c2", messageId: 15777 });
  await tache(file3, forum3).poster.executer();
  assert(forum3.vus[0].code !== forum1.vus[0].code);
});

Deno.test("LE CODE NE SE LIT PLUS DANS LE MESSAGE", async () => {
  //  Règle retournée le 18 novembre : « n'affiche pas le code, le
  //  joueur ne doit pas le voir ». L'ancien test exigeait l'inverse —
  //  il est retourné, pas supprimé, pour que le changement se voie.
  //
  //  LE CODE EST TOUJOURS PASSÉ AU FORUM, et c'est ce qui compte : il
  //  part dans le marqueur que l'adaptateur pose, donc la relève
  //  reconnaît son propre message si elle repasse.
  const file = new FileEnMemoire().ajouter({ combatId: "c1" });
  const forum = posteur(() => 90001);
  await tache(file, forum).poster.executer();
  assert(!forum.vus[0].corps.includes("CODE"), forum.vus[0].corps);
  assert(!forum.vus[0].corps.includes(forum.vus[0].code), forum.vus[0].corps);
  assert(forum.vus[0].code !== "", "aucun code n'a été donné au forum");
});

Deno.test("une carte qui ne part pas reste en file", async () => {
  const file = new FileEnMemoire().ajouter({ combatId: "c1" });
  const forum = posteur(() => new Error("sujet verrouillé"));
  const { poster, journal } = tache(file, forum);

  const passage = await poster.executer();

  assertEquals(passage.publiees, []);
  assertEquals(passage.erreurs.length, 1);
  assert(passage.erreurs[0].includes("sujet verrouillé"));
  //  ELLE RESTE. C'est tout le point : au passage suivant, elle repart.
  assertEquals(file.restantes.length, 1);
  assertEquals(file.restantes[0].essais, 1);
  assertEquals(journal.lignes.length, 1);
  assertEquals(journal.lignes[0].tache, TACHE);
});

Deno.test("une carte qui échoue n'empêche pas les suivantes", async () => {
  const file = new FileEnMemoire()
    .ajouter({ combatId: "c1", sujetId: 100 })
    .ajouter({ combatId: "c2", sujetId: 200 });
  const forum = posteur((sujetId) => sujetId === 100 ? new Error("verrouillé") : 90002);

  const passage = await tache(file, forum).poster.executer();

  assertEquals(passage.publiees.length, 1);
  assertEquals(passage.publiees[0].sujetId, 200);
  assertEquals(passage.erreurs.length, 1);
});

Deno.test("au-delà de dix essais, la tâche le dit", async () => {
  //  Une carte qui a échoué dix fois ne passera pas à la onzième sans
  //  qu'on regarde. Elle reste en file — on ne jette rien — mais elle
  //  cesse d'échouer en silence.
  const file = new FileEnMemoire().ajouter({
    combatId: "c1",
    essais: ESSAIS_AVANT_DE_CRIER - 1,
  });
  const forum = posteur(() => new Error("toujours non"));

  const passage = await tache(file, forum).poster.executer();

  assert(
    passage.erreurs[0].includes("ça ne passera pas tout seul"),
    passage.erreurs[0],
  );
  assertEquals(file.restantes.length, 1);
});

Deno.test("une équipe vide s'annonce quand même", async () => {
  //  Planche 99 §5.3 : la rencontre reste une rencontre. Le message
  //  part, et il dit que la Poké Ball se lance directement.
  const file = new FileEnMemoire().ajouter({ combatId: "c1", combattant: null });
  const forum = posteur(() => 90001);

  const passage = await tache(file, forum).poster.executer();

  assertEquals(passage.publiees.length, 1);
  assert(forum.vus[0].corps.includes("Aucun Pokémon dans ton équipe"));
});

Deno.test("une file vide ne poste rien, et se note quand même", async () => {
  //  Le journal doit porter le passage même sans rien à faire : c'est
  //  ce qui distingue « rien à poster » de « la tâche n'a pas tourné ».
  const file = new FileEnMemoire();
  const forum = posteur(() => 90001);
  const { poster, journal } = tache(file, forum);

  const passage = await poster.executer();

  assertEquals(passage.publiees, []);
  assertEquals(forum.vus.length, 0);
  assertEquals(journal.lignes.length, 1);
  assertEquals(journal.lignes[0].traites, 0);
});
