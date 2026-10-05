// ════════════════════════════════════════════════════════════════════
//  src/application/servir-une-commande.test.ts
//
//  Le test qui porte ce fichier : « un reçu qui ne part pas laisse le
//  curseur en arrière, et le passage suivant ne débite pas deux fois ».
//
//  C'est la même peur que `poster-les-bilans.test.ts`, un cran plus bas :
//  là-bas une clôture appliquée pouvait rester sans bilan, ici une
//  commande servie pourrait rester sans reçu. La différence est qu'il n'y
//  a pas de file — le curseur en tient lieu — donc c'est lui qu'il faut
//  éprouver.
// ════════════════════════════════════════════════════════════════════

import { assert, assertEquals, assertStringIncludes } from "@std/assert";
import { pokedollars } from "./bilan.ts";
import type { LignePanier } from "../domaine/panier.ts";
import {
  type Boutique,
  type CommandeLue,
  type LecteurDeCommandes,
  type PosteurSurForum,
  type Signataire,
  type SuiviDesForums,
  type VerdictDeCommande,
} from "./ports.ts";
import { JournalEnMemoire } from "../adaptateurs/en-memoire/releve.ts";
import { CompteNonLie, ServirUneCommande, TACHE } from "./servir-une-commande.ts";

const COMPTOIR = { sujetId: 977, forumId: 42 } as const;

// ── les doublures ───────────────────────────────────────────────────

class LecteurEnMemoire implements LecteurDeCommandes {
  readonly vus: { sujetId: number; depuis: number }[] = [];
  constructor(private readonly commandes: readonly CommandeLue[]) {}

  commandesDuSujet(sujetId: number, depuis: number): Promise<readonly CommandeLue[]> {
    this.vus.push({ sujetId, depuis });
    return Promise.resolve(
      this.commandes.filter((c) => c.sujetId === sujetId && c.messageId > depuis),
    );
  }
}

/** Une boutique qui compte ses appels, parce que c'est ça qu'on vérifie :
 *  **un message ne doit être débité qu'une fois**, même relu. */
class BoutiqueEnMemoire implements Boutique {
  readonly appels: { messageId: number; lignes: readonly LignePanier[] }[] = [];
  /** Les messages déjà servis, pour rendre `deja: true` au second
   *  passage — c'est ce que fait `commande.message_id unique`. */
  private readonly servis = new Set<number>();

  constructor(
    private readonly reponse: (messageId: number) => VerdictDeCommande | Error = () => ({
      etat: "servie",
      commandeId: "c-1",
      total: 6000,
      solde: 4000,
      deja: false,
      lignes: [{
        objetId: 990080,
        nom: "Pierre Feu",
        quantite: 2,
        prix: 3000,
        sousTotal: 6000,
      }],
    }),
  ) {}

  servir(d: {
    messageId: number;
    forumUserId: number;
    lignes: readonly LignePanier[];
    code: string;
  }): Promise<VerdictDeCommande> {
    this.appels.push({ messageId: d.messageId, lignes: d.lignes });
    const r = this.reponse(d.messageId);
    if (r instanceof Error) return Promise.reject(r);
    const deja = this.servis.has(d.messageId);
    this.servis.add(d.messageId);
    return Promise.resolve({ ...r, deja });
  }
}

function posteur(
  comportement: (messageId: number, corps: string) => number | Error = () => 1,
): PosteurSurForum & { vus: { corps: string; code: string; mentionne: string }[] } {
  const vus: { corps: string; code: string; mentionne: string }[] = [];
  let n = 0;
  return {
    vus,
    repondre(
      _sujetId: number,
      mentionne: string,
      corps: string,
      code: string,
    ): Promise<number> {
      vus.push({ corps, code, mentionne });
      const r = comportement(++n, corps);
      return r instanceof Error ? Promise.reject(r) : Promise.resolve(r);
    },
  };
}

class SuiviEnMemoire implements SuiviDesForums {
  readonly curseurs = new Map<number, number>();
  constructor(depart = 0) {
    this.curseurs.set(COMPTOIR.forumId, depart);
  }
  dernierMessageLu(forumId: number): Promise<number> {
    return Promise.resolve(this.curseurs.get(forumId) ?? 0);
  }
  avancer(forumId: number, messageId: number): Promise<void> {
    this.curseurs.set(forumId, messageId);
    return Promise.resolve();
  }
}

/** Un signataire figé : le code dépend du message, pas du hasard. On
 *  s'en sert pour vérifier qu'un reçu reposté porte LE MÊME code — sans
 *  ça, le marqueur de l'adaptateur ne reconnaîtrait pas son message et on
 *  en publierait deux. */
const signataire: Signataire = {
  empreinte(message: string): Promise<Uint8Array> {
    const octets = new Uint8Array(8);
    for (let i = 0; i < message.length; i++) {
      octets[i % 8] = (octets[i % 8] + message.charCodeAt(i)) % 256;
    }
    return Promise.resolve(octets);
  },
};

function commande(
  messageId: number,
  panier: CommandeLue["panier"],
  auteurPseudo = "Anna",
): CommandeLue {
  return {
    sujetId: COMPTOIR.sujetId,
    messageId,
    auteurId: 7,
    auteurPseudo,
    panier,
  };
}

const PANIER: CommandeLue["panier"] = {
  type: "panier",
  lignes: [{ objetId: 990080, quantite: 2 }],
};

type Montage = {
  readonly tache: ServirUneCommande;
  readonly boutique: BoutiqueEnMemoire;
  readonly poste: ReturnType<typeof posteur>;
  readonly suivi: SuiviEnMemoire;
  readonly journal: JournalEnMemoire;
};

function monter(
  commandes: readonly CommandeLue[],
  options: {
    boutique?: BoutiqueEnMemoire;
    poste?: ReturnType<typeof posteur>;
    suivi?: SuiviEnMemoire;
  } = {},
): Montage {
  const boutique = options.boutique ?? new BoutiqueEnMemoire();
  const poste = options.poste ?? posteur();
  const suivi = options.suivi ?? new SuiviEnMemoire();
  const journal = new JournalEnMemoire();
  const tache = new ServirUneCommande(
    new LecteurEnMemoire(commandes),
    boutique,
    poste,
    suivi,
    journal,
    signataire,
  );
  return { tache, boutique, poste, suivi, journal };
}

// ── le cas courant ──────────────────────────────────────────────────

Deno.test("une commande servie : un reçu, et le curseur avance", async () => {
  const { tache, poste, suivi } = monter([commande(15551, PANIER)]);

  const passage = await tache.executer(COMPTOIR);

  assertEquals(passage.servies.length, 1);
  assertEquals(passage.refusees, []);
  assertEquals(passage.erreurs, []);
  assertEquals(passage.servies[0].total, 6000);
  assert(!passage.servies[0].deja);
  assertEquals(suivi.curseurs.get(COMPTOIR.forumId), 15551);

  //  Le reçu dit ce qui a été débité, au prix de la BASE.
  assertEquals(poste.vus.length, 1);
  assertStringIncludes(poste.vus[0].corps, "Pierre Feu ×2");
  assertStringIncludes(poste.vus[0].corps, `${pokedollars(6000)} ₽`);
  assertStringIncludes(poste.vus[0].corps, `SOLDE : ${pokedollars(4000)} ₽`);
  assertEquals(poste.vus[0].mentionne, "Anna");
});

Deno.test("rien à servir : aucun reçu, aucune erreur, curseur immobile", async () => {
  const { tache, poste, suivi, journal } = monter([]);

  const passage = await tache.executer(COMPTOIR);

  assertEquals(passage, { servies: [], refusees: [], erreurs: [] });
  assertEquals(poste.vus, []);
  assertEquals(suivi.curseurs.get(COMPTOIR.forumId), 0);
  //  Le journal note le passage même vide : c'est à ça qu'on voit que la
  //  tâche tourne, plutôt qu'à son silence.
  assertEquals(journal.lignes.filter((p) => p.tache === TACHE).length, 1);
});

Deno.test("on ne relit que ce qui est après le curseur", async () => {
  const suivi = new SuiviEnMemoire(15551);
  const lecteur = new LecteurEnMemoire([
    commande(15551, PANIER),
    commande(15552, PANIER),
  ]);
  const boutique = new BoutiqueEnMemoire();
  const tache = new ServirUneCommande(
    lecteur,
    boutique,
    posteur(),
    suivi,
    new JournalEnMemoire(),
    signataire,
  );

  await tache.executer(COMPTOIR);

  assertEquals(lecteur.vus, [{ sujetId: 977, depuis: 15551 }]);
  assertEquals(boutique.appels.map((a) => a.messageId), [15552]);
});

// ── LE TEST QUI PORTE LE FICHIER ────────────────────────────────────

Deno.test("un reçu qui ne part pas : le curseur reste, et on ne débite pas deux fois", async () => {
  const boutique = new BoutiqueEnMemoire();
  const suivi = new SuiviEnMemoire();
  const casse = posteur(() => new Error("Forumactif : 503"));

  const premier = await monter([commande(15551, PANIER)], {
    boutique,
    poste: casse,
    suivi,
  }).tache.executer(COMPTOIR);

  //  La commande EST servie en base — le joueur a ses objets. C'est le
  //  reçu qui manque, et c'est tout ce qu'on signale.
  assertEquals(premier.servies, []);
  assertEquals(premier.erreurs.length, 1);
  assertStringIncludes(premier.erreurs[0], "15551");
  assertStringIncludes(premier.erreurs[0], "Anna");
  assertEquals(suivi.curseurs.get(COMPTOIR.forumId), 0, "le curseur ne doit PAS avoir avancé");
  assertEquals(boutique.appels.length, 1);

  //  Deuxième passage, forum rétabli. MÊME boutique, MÊME curseur : c'est
  //  ce que fait la relève cinq minutes plus tard.
  const repare = posteur();
  const second = await monter([commande(15551, PANIER)], {
    boutique,
    poste: repare,
    suivi,
  }).tache.executer(COMPTOIR);

  assertEquals(second.erreurs, []);
  assertEquals(second.servies.length, 1);
  assert(second.servies[0].deja, "la base doit dire qu'elle avait déjà servi ce message");
  assertEquals(repare.vus.length, 1, "le reçu part cette fois");
  assertEquals(suivi.curseurs.get(COMPTOIR.forumId), 15551);

  //  LE POINT CRUCIAL : le reçu reposté porte le MÊME code. Sinon le
  //  marqueur de l'adaptateur de publication ne reconnaîtrait pas son
  //  propre message, et un envoi parti sans réponse serait republié.
  assertEquals(repare.vus[0].code, casse.vus[0].code);
});

Deno.test("on s'arrête au premier reçu qui ne part pas, sans sauter par-dessus", async () => {
  const boutique = new BoutiqueEnMemoire();
  const suivi = new SuiviEnMemoire();
  //  Le deuxième envoi échoue, le troisième réussirait.
  const poste = posteur((n) => (n === 2 ? new Error("503") : n));

  const passage = await monter(
    [commande(15551, PANIER), commande(15552, PANIER), commande(15553, PANIER)],
    { boutique, poste, suivi },
  ).tache.executer(COMPTOIR);

  assertEquals(passage.servies.length, 1);
  assertEquals(passage.erreurs.length, 1);
  assertStringIncludes(passage.erreurs[0], "15552");
  //  Le curseur s'arrête AVANT le message en échec : le 15 553 n'a pas
  //  été traité, et il sera relu. Avancer par-dessus le trou aurait perdu
  //  le reçu du 15 552 pour toujours.
  assertEquals(suivi.curseurs.get(COMPTOIR.forumId), 15551);
  assertEquals(boutique.appels.map((a) => a.messageId), [15551, 15552]);
});

Deno.test("les commandes sont traitées dans l'ordre des messages", async () => {
  const boutique = new BoutiqueEnMemoire();
  //  Données volontairement désordonnées : le lecteur pourrait les rendre
  //  ainsi, et l'ordre est contractuel ici.
  await monter(
    [commande(15553, PANIER), commande(15551, PANIER), commande(15552, PANIER)],
    { boutique },
  ).tache.executer(COMPTOIR);

  assertEquals(boutique.appels.map((a) => a.messageId), [15551, 15552, 15553]);
});

// ── les refus ───────────────────────────────────────────────────────

Deno.test("une commande refusée : on explique, et on avance quand même", async () => {
  const boutique = new BoutiqueEnMemoire(() => ({
    etat: "refusee",
    commandeId: "c-9",
    motif: "HORS_VENTE",
    detail: "Ces objets ne sont pas en vente : Fossile Hélix.",
    total: 0,
    solde: 4000,
    deja: false,
  }));
  const { tache, poste, suivi } = monter([commande(15551, PANIER)], { boutique });

  const passage = await tache.executer(COMPTOIR);

  assertEquals(passage.servies, []);
  assertEquals(passage.refusees, [{ messageId: 15551, pseudo: "Anna", motif: "HORS_VENTE" }]);
  //  LE DÉTAIL VIENT DE LA BASE, recopié tel quel : elle seule sait quel
  //  objet n'était pas en vente.
  assertStringIncludes(poste.vus[0].corps, "Fossile Hélix");
  assertStringIncludes(poste.vus[0].corps, "Rien n'a été débité");
  //  Un refus est un traitement abouti : le curseur avance, sinon on
  //  republierait le même refus à chaque passage.
  assertEquals(suivi.curseurs.get(COMPTOIR.forumId), 15551);
});

Deno.test("un panier illisible n'atteint jamais la base", async () => {
  const boutique = new BoutiqueEnMemoire();
  const { tache, poste, suivi } = monter(
    [commande(15551, { type: "illisible", motif: "Quantité illisible : « 3x » ." })],
    { boutique },
  );

  const passage = await tache.executer(COMPTOIR);

  assertEquals(boutique.appels, [], "il n'y a rien à soumettre : on ne sait pas quoi");
  assertEquals(passage.refusees, [{ messageId: 15551, pseudo: "Anna", motif: "ILLISIBLE" }]);
  assertStringIncludes(poste.vus[0].corps, "illisible");
  assertStringIncludes(poste.vus[0].corps, "Quantité illisible");
  assertStringIncludes(poste.vus[0].corps, "reclique dans le catalogue");
  assertEquals(suivi.curseurs.get(COMPTOIR.forumId), 15551);
});

Deno.test("un compte non lié : on répond, on n'insiste pas", async () => {
  const boutique = new BoutiqueEnMemoire(() => new CompteNonLie(9001));
  const { tache, poste, suivi } = monter([commande(15551, PANIER)], { boutique });

  const passage = await tache.executer(COMPTOIR);

  assertEquals(
    passage.erreurs,
    [],
    "ce n'est pas une panne : on ne le signale pas comme telle",
  );
  assertEquals(passage.refusees, [{
    messageId: 15551,
    pseudo: "Anna",
    motif: "COMPTE_NON_LIE",
  }]);
  assertStringIncludes(poste.vus[0].corps, "aucune fiche de joueur");
  //  On avance : relancer à chaque passage ne lierait pas le compte
  //  davantage, et republierait le même message toutes les cinq minutes.
  assertEquals(suivi.curseurs.get(COMPTOIR.forumId), 15551);
});

Deno.test("une panne de la base arrête le passage et laisse le curseur", async () => {
  const boutique = new BoutiqueEnMemoire(() => new Error("PostgREST : 500"));
  const { tache, poste, suivi } = monter(
    [commande(15551, PANIER), commande(15552, PANIER)],
    { boutique },
  );

  const passage = await tache.executer(COMPTOIR);

  assertEquals(passage.servies, []);
  assertEquals(passage.refusees, []);
  assertEquals(passage.erreurs.length, 1);
  assertStringIncludes(passage.erreurs[0], "PostgREST : 500");
  assertEquals(poste.vus, [], "on ne répond rien : on ne sait pas ce qui s'est passé");
  assertEquals(suivi.curseurs.get(COMPTOIR.forumId), 0);
});

// ── le journal ──────────────────────────────────────────────────────

Deno.test("le journal compte les servies ET les refusées", async () => {
  const boutique = new BoutiqueEnMemoire((messageId) =>
    messageId === 15552
      ? {
        etat: "refusee",
        commandeId: "c-2",
        motif: "ARGENT_INSUFFISANT",
        detail: `Le panier coûte ${pokedollars(6000)} ₽ et il reste 10 ₽.`,
        total: 6000,
        solde: 10,
        deja: false,
      }
      : {
        etat: "servie",
        commandeId: "c-1",
        total: 6000,
        solde: 4000,
        deja: false,
        lignes: [{
          objetId: 990080,
          nom: "Pierre Feu",
          quantite: 2,
          prix: 3000,
          sousTotal: 6000,
        }],
      }
  );
  const { tache, journal } = monter(
    [commande(15551, PANIER), commande(15552, PANIER), commande(15553, PANIER)],
    { boutique },
  );

  const passage = await tache.executer(COMPTOIR);

  assertEquals(passage.servies.length, 2);
  assertEquals(passage.refusees.length, 1);
  const note = journal.lignes.find((p) => p.tache === TACHE);
  assert(note !== undefined);
  assertEquals(note.traites, 3, "trois commandes traitées, refus compris");
  assertEquals(note.erreurs, []);
});
