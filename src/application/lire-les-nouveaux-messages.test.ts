import { assert, assertEquals } from "@std/assert";
import {
  type HeuresDesJoueurs,
  jourDe,
  LireLesNouveauxMessages,
} from "./lire-les-nouveaux-messages.ts";
import type {
  ActionLue,
  EtatDuJeu,
  EtatDuJoueur,
  Faune,
  Horloge,
  LecteurDActions,
  Registre,
  Signataire,
  TableDeButin,
  TableDesFossiles,
  ZoneSauvage,
} from "./ports.ts";
import { REGLES_PAR_DEFAUT } from "../domaine/fossile.ts";
import type { Evenement, LigneRegistre } from "../domaine/cloture.ts";
import type { EntreeDeTable } from "../domaine/rencontre.ts";
import { codeValide } from "../domaine/code.ts";
import { actionDe } from "../domaine/action.ts";

// ── le décor ────────────────────────────────────────────────────────

const ZONE: ZoneSauvage = {
  forumId: 42,
  nom: "Les Méandres",
  palier: 1,
  parentId: 7,
  aUneFaune: true,
};

const TABLE: readonly EntreeDeTable[] = [
  { especeId: 129, pourcentage: 70, niveauMin: 2, niveauMax: 5, rarete: "commun" },
  { especeId: 54, pourcentage: 30, niveauMin: 3, niveauMax: 6, rarete: "peu commun" },
];

class FauneFixe implements Faune {
  constructor(
    private readonly conditions: readonly string[] = ["jour", "nuit"],
    private readonly table: readonly EntreeDeTable[] = TABLE,
  ) {}
  zonesSauvages(): Promise<readonly ZoneSauvage[]> {
    return Promise.resolve([ZONE]);
  }
  conditionsDe(): Promise<readonly string[]> {
    return Promise.resolve(this.conditions);
  }
  tableDe(_forumId: number, _condition: string): Promise<readonly EntreeDeTable[]> {
    return Promise.resolve(this.table);
  }
}

class ActionsFixes implements LecteurDActions {
  constructor(private readonly lues: readonly ActionLue[]) {}
  actionsDuSujet(_s: number, depuis: number): Promise<readonly ActionLue[]> {
    return Promise.resolve(this.lues.filter((l) => l.messageId > depuis));
  }
}

const JOUEUR = "11111111-1111-1111-1111-111111111111";

class JeuFixe implements EtatDuJeu {
  constructor(private readonly liens: ReadonlyMap<number, string> = new Map([[3, JOUEUR]])) {}
  etatDe(): Promise<EtatDuJoueur> {
    return Promise.resolve({ sac: new Map(), placesEnBoite: 30, pokedollars: 0 });
  }
  pseudoDe(): Promise<string> {
    return Promise.resolve("Anna");
  }
  joueurDuCompte(compte: number): Promise<string | null> {
    return Promise.resolve(this.liens.get(compte) ?? null);
  }
  estClos(): Promise<boolean> {
    return Promise.resolve(false);
  }
}

class HeuresFixes implements HeuresDesJoueurs {
  constructor(private readonly heure = 14) {}
  heureLocaleDe(): Promise<number> {
    return Promise.resolve(this.heure);
  }
}

class RegistreEspion implements Registre {
  readonly ecrites: {
    sujetId: number;
    joueurId: string;
    messageId: number;
    evenement: Evenement;
    code: string;
  }[] = [];
  lignesDuSujet(): Promise<readonly LigneRegistre[]> {
    return Promise.resolve([]);
  }
  inscrire(
    sujetId: number,
    joueurId: string,
    messageId: number,
    evenement: Evenement,
    code: string,
  ): Promise<void> {
    this.ecrites.push({ sujetId, joueurId, messageId, evenement, code });
    return Promise.resolve();
  }
  joueursDuSujet(): Promise<readonly string[]> {
    return Promise.resolve([]);
  }
  oublier(): Promise<number> {
    return Promise.resolve(0);
  }
}

const HORLOGE: Horloge = { maintenant: () => new Date("2026-10-03T12:00:00Z") };

//  Une empreinte déterministe : le vrai signataire est testé ailleurs, et
//  ce qu'on veut vérifier ici c'est QUE le code est posé, pas comment il
//  est calculé.
const SIGNATAIRE: Signataire = {
  empreinte: (message: string) =>
    Promise.resolve(
      Uint8Array.from({ length: 20 }, (_, i) =>
        (message.charCodeAt(i % message.length) + i) % 256),
    ),
};

function action(messageId: number, a: ActionLue["action"], auteurId = 3): ActionLue {
  return { sujetId: 976, messageId, auteurId, auteurPseudo: "Anna", action: a };
}

type Decor = {
  faune?: Faune;
  jeu?: EtatDuJeu;
  heures?: HeuresDesJoueurs;
  zone?: ZoneSauvage;
  fossiles?: TableDesFossiles;
  butin?: TableDeButin;
};

/** AUCUN FOSSILE, par défaut — et c'est le décor HONNÊTE : la table
 *  rend `null` dans plus de quatre-vingt-dix pour cent des fouilles, et
 *  les suites qui parlent de Pokédollars n'ont pas à composer avec une
 *  deuxième ligne. Les tests du fossile montent leur propre table. */
const SANS_FOSSILES: TableDesFossiles = {
  fossiles: () => Promise.resolve([]),
  regles: () => Promise.resolve(REGLES_PAR_DEFAUT),
};

/** Une table d'un seul fossile. Le GENRE ne se règle plus ici : depuis
 *  le 15 octobre, c'est la table de butin qui dit s'il y a un fossile et
 *  s'il est entier — voir `butinCertain`. */
const UN_SEUL_FOSSILE: TableDesFossiles = {
  fossiles: () =>
    Promise.resolve([{
      clef: "racine",
      objet: "Fossile Racine",
      id: 991001,
      morceauId: 991101,
      especeId: 345,
      espece: "Lilia",
    }]),
  regles: () => Promise.resolve(REGLES_PAR_DEFAUT),
};

const UN_OBJET = 990040;

/** La table de butin du décor : les parts du dépôt au 15 octobre. */
const BUTIN_ORDINAIRE: TableDeButin = {
  taux: () =>
    Promise.resolve({ bredouille: 20, fossileEntier: 0.2, morceauDeFossile: 10, objet: 25 }),
  butinDe: () =>
    Promise.resolve([{ objetId: UN_OBJET, pourcentage: 16 }, {
      objetId: 990001,
      pourcentage: 9,
    }]),
};

/** Une table de butin qui force UNE issue, pour voir ce que la tâche en
 *  fait sans chercher une graine chanceuse.
 *
 *  On pousse la part à 100 au lieu de « presque 1 » : le domaine accepte
 *  une somme de 100 pile — c'est une table dont une issue est certaine,
 *  ce qui est absurde en jeu mais parfaitement lisible, et aucun test
 *  n'a alors à dépendre d'un tirage. */
function butinCertain(genre: "bredouille" | "entier" | "morceau" | "objet"): TableDeButin {
  const zero = { bredouille: 0, fossileEntier: 0, morceauDeFossile: 0, objet: 0 };
  const taux = {
    bredouille: { ...zero, bredouille: 100 },
    entier: { ...zero, fossileEntier: 100 },
    morceau: { ...zero, morceauDeFossile: 100 },
    objet: { ...zero, objet: 100 },
  }[genre];
  return {
    taux: () => Promise.resolve(taux),
    butinDe: () =>
      Promise.resolve(genre === "objet" ? [{ objetId: UN_OBJET, pourcentage: 100 }] : []),
  };
}

type Montage = {
  readonly tache: LireLesNouveauxMessages;
  readonly registre: RegistreEspion;
  readonly zone: ZoneSauvage;
};

function monter(lues: readonly ActionLue[], d: Decor = {}): Montage {
  const registre = new RegistreEspion();
  const tache = new LireLesNouveauxMessages(
    d.faune ?? new FauneFixe(),
    new ActionsFixes(lues),
    d.jeu ?? new JeuFixe(),
    d.heures ?? new HeuresFixes(),
    registre,
    HORLOGE,
    SIGNATAIRE,
    d.fossiles ?? SANS_FOSSILES,
    d.butin ?? BUTIN_ORDINAIRE,
  );
  return { tache, registre, zone: d.zone ?? ZONE };
}

// ── la fouille ──────────────────────────────────────────────────────

Deno.test("une fouille devient une ligne de pokédollars", async () => {
  //  Le message 15600 n'est pas bredouille au palier 1 : vérifié par le
  //  domaine, repris ici pour que le test parle d'un cas réel.
  const c = monter([action(15600, { type: "fouiller" })]);
  const bilan = await c.tache.executerSur(c.zone, 976, 0);

  assertEquals(bilan.traitees, 1);
  assertEquals(bilan.erreurs, []);
  assertEquals(c.registre.ecrites.length, 1);
  assertEquals(c.registre.ecrites[0].evenement.type, "pokedollars");
  assertEquals(c.registre.ecrites[0].joueurId, JOUEUR);
  assertEquals(c.registre.ecrites[0].messageId, 15600);
});

Deno.test("le même message donne toujours le même montant", async () => {
  // La garantie qui permet de trancher une contestation en recalculant.
  const montants = [];
  for (let i = 0; i < 3; i++) {
    const c = monter([action(15600, { type: "fouiller" })]);
    await c.tache.executerSur(c.zone, 976, 0);
    montants.push(c.registre.ecrites[0].evenement);
  }
  assertEquals(montants[0], montants[1]);
  assertEquals(montants[1], montants[2]);
});

Deno.test("une fouille bredouille n'écrit aucune ligne, et ce n'est pas une erreur", async () => {
  //  Une ligne à zéro ne dirait rien au joueur et encombrerait le module.
  //  On cherche un message bredouille plutôt que d'en inventer un.
  let bredouille = -1;
  for (let id = 1; id < 500 && bredouille < 0; id++) {
    const c = monter([action(id, { type: "fouiller" })]);
    await c.tache.executerSur(c.zone, 976, 0);
    if (c.registre.ecrites.length === 0) bredouille = id;
  }
  assert(bredouille > 0, "aucun message bredouille trouvé sur 500 — le tirage est suspect");

  const c = monter([action(bredouille, { type: "fouiller" })]);
  const bilan = await c.tache.executerSur(c.zone, 976, 0);
  assertEquals(bilan.traitees, 0);
  assertEquals(bilan.erreurs, []);
});

Deno.test("UNE FOUILLE NE DONNE QU'UNE LIGNE", async () => {
  //  CE TEST DISAIT L'INVERSE JUSQU'AU 15 OCTOBRE : « UNE FOUILLE PEUT
  //  DONNER DEUX LIGNES : des pokédollars ET un fossile ». Les deux
  //  tirages étaient indépendants, donc une fouille chanceuse donnait
  //  les deux. La table de butin porte maintenant les cinq parts et
  //  elles font 100 : une fouille rend UNE chose.
  const c = monter([action(15600, { type: "fouiller" })], {
    fossiles: UN_SEUL_FOSSILE,
    butin: butinCertain("entier"),
  });
  const bilan = await c.tache.executerSur(c.zone, 976, 0);

  assertEquals(bilan.traitees, 1);
  assertEquals(bilan.erreurs, []);
  assertEquals(c.registre.ecrites.map((e) => e.evenement.type), ["objet_trouve"]);
  assertEquals(c.registre.ecrites[0].evenement, {
    type: "objet_trouve",
    objetId: 991001,
    quantite: 1,
  }, "un fossile entier met LE FOSSILE dans le sac");
});

Deno.test("un morceau met le MORCEAU dans le sac, pas le fossile", async () => {
  const c = monter([action(15600, { type: "fouiller" })], {
    fossiles: UN_SEUL_FOSSILE,
    butin: butinCertain("morceau"),
  });
  await c.tache.executerSur(c.zone, 976, 0);

  assertEquals(c.registre.ecrites[0].evenement, {
    type: "objet_trouve",
    objetId: 991101,
    quantite: 1,
  });
});

Deno.test("UN OBJET DE LA TABLE DE LA ZONE ENTRE DANS LE SAC", async () => {
  //  C'est la nouveauté du 15 octobre : fouiller peut rendre un objet du
  //  catalogue, et c'est la zone qui dit lesquels.
  const c = monter([action(15600, { type: "fouiller" })], {
    butin: butinCertain("objet"),
  });
  const bilan = await c.tache.executerSur(c.zone, 976, 0);

  assertEquals(bilan.erreurs, []);
  assertEquals(c.registre.ecrites[0].evenement, {
    type: "objet_trouve",
    objetId: UN_OBJET,
    quantite: 1,
  });
});

Deno.test("UNE BREDOUILLE N'ÉCRIT RIEN", async () => {
  //  Une ligne à zéro ne dirait rien au joueur et encombrerait le
  //  registre et le module de bilan.
  const c = monter([action(15600, { type: "fouiller" })], {
    butin: butinCertain("bredouille"),
  });
  const bilan = await c.tache.executerSur(c.zone, 976, 0);

  assertEquals(bilan.erreurs, []);
  assertEquals(c.registre.ecrites.length, 0);
  assertEquals(bilan.traitees, 0);
});

Deno.test("UNE LIGNE, UN CODE", async () => {
  //  Un code par ligne, pas par message : un code partagé vérifierait
  //  une ligne avec celui d'une autre, et un joueur qui conteste l'une
  //  remettrait l'autre en cause. Il y en avait deux à vérifier avant le
  //  15 octobre ; il n'y en a plus qu'une, et elle en a un.
  const c = monter([action(15600, { type: "fouiller" })], {
    butin: butinCertain("objet"),
  });
  await c.tache.executerSur(c.zone, 976, 0);

  const codes = c.registre.ecrites.map((e) => e.code);
  assertEquals(codes.length, 1);
  for (const code of codes) assert(codeValide(code), `code mal formé : ${code}`);
});

Deno.test("SANS TABLE DE FOSSILES, LA FOUILLE EST BREDOUILLE — ELLE NE SE REPLIE PAS", async () => {
  //  Le tirage a dit « fossile » et il n'y en a aucun à donner : le
  //  fichier est injoignable. On ne remplace PAS par des Pokédollars —
  //  ce serait inventer une issue que la table n'a pas tirée — et on ne
  //  lève pas : la relève continue. Le symptôme se voit tout seul,
  //  plus personne ne trouve de fossile.
  const c = monter([action(15600, { type: "fouiller" })], {
    butin: butinCertain("entier"),
    fossiles: SANS_FOSSILES,
  });
  const bilan = await c.tache.executerSur(c.zone, 976, 0);

  assertEquals(bilan.erreurs, []);
  assertEquals(c.registre.ecrites.length, 0);
});

Deno.test("UNE TABLE DE BUTIN INJOIGNABLE ARRÊTE LA ZONE, ELLE NE DEVINE PAS", async () => {
  //  L'inverse du cas précédent, et c'est voulu : sans la table on ne
  //  sait plus ce qu'une fouille rend. Verser des Pokédollars « au cas
  //  où » écrirait au registre une issue que personne n'a tirée, et le
  //  registre, ça reste. L'erreur est nommée, le curseur ne bouge pas,
  //  les messages seront relus.
  const c = monter([action(15600, { type: "fouiller" })], {
    butin: {
      taux: () => Promise.reject(new Error("HTTP 503")),
      butinDe: () => Promise.reject(new Error("HTTP 503")),
    },
  });
  const bilan = await c.tache.executerSur(c.zone, 976, 0);

  assertEquals(c.registre.ecrites.length, 0);
  assertEquals(bilan.erreurs.length, 1);
  assert(bilan.erreurs[0].includes("HTTP 503"), bilan.erreurs[0]);
});

Deno.test("le palier de la zone change les bornes", async () => {
  //  Même message, deux paliers : le montant doit différer, sinon le
  //  palier ne sert à rien.
  const montant = async (palier: 1 | 2 | 3) => {
    const c = monter([action(15600, { type: "fouiller" })], {
      zone: { ...ZONE, palier },
    });
    await c.tache.executerSur(c.zone, 976, 0);
    const e = c.registre.ecrites[0]?.evenement;
    return e && e.type === "pokedollars" ? e.montant : 0;
  };
  const un = await montant(1);
  const trois = await montant(3);
  assert(trois > un, `palier 3 (${trois}) devrait rapporter plus que palier 1 (${un})`);
});

// ── la recherche ────────────────────────────────────────────────────

Deno.test("une recherche devient une ligne « croisé »", async () => {
  const c = monter([action(15601, { type: "chercher" })]);
  const bilan = await c.tache.executerSur(c.zone, 976, 0);

  assertEquals(bilan.erreurs, []);
  assertEquals(c.registre.ecrites.length, 1);
  const e = c.registre.ecrites[0].evenement;
  assertEquals(e.type, "croise");
  assert(e.type === "croise" && [129, 54].includes(e.especeId), "espèce hors table");
});

Deno.test("UN ANCIEN BLOC AVEC UN LIEU SE JOUE QUAND MÊME", async () => {
  //  CE TEST DISAIT L'INVERSE JUSQU'AU 15 OCTOBRE : un lieu d'une autre
  //  zone était refusé, parce qu'il aurait fait tirer dans la mauvaise
  //  table. Il n'y a plus de table par lieu — « enlève tous les petits
  //  lieux » — donc plus de mauvaise table, et refuser ces messages
  //  reviendrait à effacer ce que des joueurs ont demandé. Un bloc
  //  portant « passe-du-large » dans la Forêt est désormais lu comme un
  //  bloc sans lieu : il tire dans la table de SA zone.
  //
  //  On part du TEXTE du message et pas d'un objet `Action` : le type
  //  n'a plus de champ `lieu`, et c'est bien le point — c'est la lecture
  //  qui laisse tomber le lieu, pas l'écriture qui l'a oublié.
  const lue = actionDe("Elle longe la rivière.\n\n[[WM-ACTION:chercher:passe-du-large]]");
  assertEquals(lue, { type: "chercher" });
  const c = monter([action(15602, lue!)]);
  const bilan = await c.tache.executerSur(c.zone, 976, 0);

  assertEquals(bilan.erreurs, []);
  assertEquals(c.registre.ecrites.length, 1);
  assertEquals(c.registre.ecrites[0].evenement.type, "croise");
});

Deno.test("une zone sans faune le dit au lieu de tirer dans le vide", async () => {
  const c = monter([action(15603, { type: "chercher" })], {
    zone: { ...ZONE, aUneFaune: false },
  });
  const bilan = await c.tache.executerSur(c.zone, 976, 0);

  assertEquals(c.registre.ecrites.length, 0);
  assertEquals(bilan.erreurs.length, 1);
  assert(bilan.erreurs[0].includes("table de faune"));
});

Deno.test("une zone sans table pour la condition est signalée", async () => {
  const c = monter([action(15604, { type: "chercher" })], {
    faune: new FauneFixe(["jour"], []),
  });
  const bilan = await c.tache.executerSur(c.zone, 976, 0);

  assertEquals(c.registre.ecrites.length, 0);
  assertEquals(bilan.erreurs.length, 1);
  assert(bilan.erreurs[0].includes("n'a pas de table"));
});

Deno.test("l'heure du joueur décide du jour et de la nuit", async () => {
  //  La décision du 2 octobre : jour/nuit suit l'heure du JOUEUR. Deux
  //  joueurs du même sujet peuvent donc tirer dans deux tables.
  const faune = new FauneFixe(["jour", "nuit"], TABLE);
  const vues: string[] = [];
  class FauneMouchardee extends FauneFixe {
    override tableDe(_f: number, condition: string): Promise<readonly EntreeDeTable[]> {
      vues.push(condition);
      return faune.tableDe(_f, condition);
    }
  }

  for (const heure of [14, 23]) {
    const c = monter([action(15605, { type: "chercher" })], {
      faune: new FauneMouchardee(["jour", "nuit"], TABLE),
      heures: new HeuresFixes(heure),
    });
    await c.tache.executerSur(c.zone, 976, 0);
  }

  assertEquals(vues, ["jour", "nuit"]);
});

// ── ce qui ne doit pas casser la tâche ──────────────────────────────

Deno.test("un auteur sans fiche est signalé, les autres passent quand même", async () => {
  const c = monter([
    action(15610, { type: "fouiller" }, 99), // compte non lié
    action(15611, { type: "fouiller" }, 3), // compte lié
  ]);
  const bilan = await c.tache.executerSur(c.zone, 976, 0);

  assertEquals(bilan.erreurs.length, 1);
  assert(bilan.erreurs[0].includes("n'est lié à aucun joueur"));
  //  L'important : le second a bien été traité.
  assert(c.registre.ecrites.every((e) => e.messageId !== 15610));
});

Deno.test("une écriture qui lève n'emporte pas les actions suivantes", async () => {
  class RegistreCapricieux extends RegistreEspion {
    override inscrire(
      sujetId: number,
      joueurId: string,
      messageId: number,
      evenement: Evenement,
      code: string,
    ): Promise<void> {
      if (messageId === 15620) return Promise.reject(new Error("réseau coupé"));
      return super.inscrire(sujetId, joueurId, messageId, evenement, code);
    }
  }
  const registre = new RegistreCapricieux();
  const tache = new LireLesNouveauxMessages(
    new FauneFixe(),
    new ActionsFixes([
      action(15620, { type: "fouiller" }),
      action(15600, { type: "fouiller" }),
    ]),
    new JeuFixe(),
    new HeuresFixes(),
    registre,
    HORLOGE,
    SIGNATAIRE,
    SANS_FOSSILES,
    BUTIN_ORDINAIRE,
  );

  const bilan = await tache.executerSur(ZONE, 976, 0);
  assertEquals(bilan.erreurs.length, 1);
  assert(bilan.erreurs[0].includes("réseau coupé"));
  assertEquals(registre.ecrites.length, 1);
  assertEquals(registre.ecrites[0].messageId, 15600);
});

Deno.test("on ne relit pas ce qui est avant le curseur", async () => {
  const c = monter([
    action(15600, { type: "fouiller" }),
    action(15601, { type: "chercher" }),
  ]);
  await c.tache.executerSur(c.zone, 976, 15600);

  assertEquals(c.registre.ecrites.length, 1);
  assertEquals(c.registre.ecrites[0].messageId, 15601);
});

// ── le code et le journal ───────────────────────────────────────────

Deno.test("chaque ligne porte un code de vérification valide", async () => {
  const c = monter([action(15600, { type: "fouiller" })]);
  await c.tache.executerSur(c.zone, 976, 0);
  assert(codeValide(c.registre.ecrites[0].code), c.registre.ecrites[0].code);
});

Deno.test("deux messages différents n'ont pas le même code", async () => {
  const c = monter([
    action(15600, { type: "fouiller" }),
    action(15601, { type: "chercher" }),
  ]);
  await c.tache.executerSur(c.zone, 976, 0);
  assertEquals(c.registre.ecrites.length, 2);
  assert(c.registre.ecrites[0].code !== c.registre.ecrites[1].code);
});

Deno.test("un sujet sans aucune action rend un bilan vide, sans erreur", () => {
  //  Le cas le plus fréquent de la relève, et il doit être muet : la
  //  plupart des messages d'un RP ne demandent rien.
  return monter([]).tache.executerSur(ZONE, 976, 0).then((b) => {
    assertEquals(b, { traitees: 0, erreurs: [], lignes: [] });
  });
});

// ── le jour, pour la météo ──────────────────────────────────────────

Deno.test("le jour est en temps universel, pas dans le fuseau de qui demande", () => {
  //  La météo est tirée une fois par jour et affichée partout : elle doit
  //  être la même pour tout le monde.
  assertEquals(jourDe(new Date("2026-10-03T23:30:00Z")), "2026-10-03");
  assertEquals(jourDe(new Date("2026-10-04T00:30:00Z")), "2026-10-04");
});
