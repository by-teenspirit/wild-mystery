// ════════════════════════════════════════════════════════════════════
//  src/adaptateurs/en-memoire/jeu.ts
//  L'état du jeu, la clôture, le catalogue et le forum, en mémoire.
//
//  Aucune règle de jeu ici non plus : ces objets rangent et rendent.
// ════════════════════════════════════════════════════════════════════

import type {
  ActionLue,
  Catalogue,
  Cloture,
  DemandeDeClotureLue,
  EtatDuJeu,
  EtatDuJoueur,
  Horloge,
  LecteurDActions,
  LecteurDeDemandes,
  LecteurDeForum,
  MessageDuForum,
  PosteurSurForum,
  Signataire,
  SujetRemue,
  Versement,
} from "../../application/ports.ts";
import { graineDepuis } from "../../domaine/alea.ts";
import { actionsDemandees, demandesDeCloture } from "../forumactif/demandes.ts";

export class EtatDuJeuEnMemoire implements EtatDuJeu {
  readonly #pseudos = new Map<string, string>();

  pseudo(joueurId: string, pseudo: string): this {
    this.#pseudos.set(joueurId, pseudo);
    return this;
  }

  pseudoDe(joueurId: string): Promise<string> {
    return Promise.resolve(this.#pseudos.get(joueurId) ?? joueurId);
  }

  readonly #joueurs = new Map<string, EtatDuJoueur>();
  readonly #comptes = new Map<number, string>();
  readonly #clos = new Set<number>();

  poser(joueurId: string, etat: EtatDuJoueur): this {
    this.#joueurs.set(joueurId, etat);
    return this;
  }

  lier(forumUserId: number, joueurId: string): this {
    this.#comptes.set(forumUserId, joueurId);
    return this;
  }

  clore(sujetId: number): this {
    this.#clos.add(sujetId);
    return this;
  }

  etatDe(joueurId: string): Promise<EtatDuJoueur> {
    const e = this.#joueurs.get(joueurId);
    if (!e) return Promise.reject(new Error(`Joueur inconnu : ${joueurId}`));
    return Promise.resolve(e);
  }

  joueurDuCompte(forumUserId: number): Promise<string | null> {
    return Promise.resolve(this.#comptes.get(forumUserId) ?? null);
  }

  estClos(sujetId: number): Promise<boolean> {
    return Promise.resolve(this.#clos.has(sujetId));
  }
}

export class ClotureEnMemoire implements Cloture {
  readonly #closes = new Map<
    number,
    { versements: readonly Versement[]; code: string; bilan: string; mentionne: string }
  >();
  /** Posé par un test pour simuler un refus de la base. */
  refuseLaProchaine: Error | null = null;

  deja(sujetId: number): Promise<boolean> {
    return Promise.resolve(this.#closes.has(sujetId));
  }

  appliquer(
    sujetId: number,
    versements: readonly Versement[],
    code: string,
    bilan: string,
    mentionne: string,
  ): Promise<void> {
    if (this.refuseLaProchaine) {
      const erreur = this.refuseLaProchaine;
      this.refuseLaProchaine = null;
      return Promise.reject(erreur);
    }
    this.#closes.set(sujetId, { versements, code, bilan, mentionne });
    return Promise.resolve();
  }

  /** Hors contrat : le bilan enregistré avec la clôture. C'est lui qui
   *  prouve qu'un bilan existe même quand la publication a échoué. */
  bilan(sujetId: number): string | undefined {
    return this.#closes.get(sujetId)?.bilan;
  }

  /** Hors contrat : le joueur à mentionner, enregistré avec la clôture. */
  mentionne(sujetId: number): string | undefined {
    return this.#closes.get(sujetId)?.mentionne;
  }

  /** Hors contrat : ce qui a été versé, pour les assertions. */
  verse(sujetId: number): readonly Versement[] | undefined {
    return this.#closes.get(sujetId)?.versements;
  }
}

export class CatalogueEnMemoire implements Catalogue {
  readonly #objets = new Map<number, string>();
  readonly #especes = new Map<number, string>();

  objet(id: number, nom: string): this {
    this.#objets.set(id, nom);
    return this;
  }

  espece(id: number, nom: string): this {
    this.#especes.set(id, nom);
    return this;
  }

  nomObjet(objetId: number): Promise<string> {
    return Promise.resolve(this.#objets.get(objetId) ?? `objet n°${objetId}`);
  }

  nomEspece(especeId: number): Promise<string> {
    return Promise.resolve(this.#especes.get(especeId) ?? `espèce n°${especeId}`);
  }
}

export class ForumEnMemoire
  implements LecteurDeForum, LecteurDeDemandes, LecteurDActions, PosteurSurForum {
  readonly #messages: MessageDuForum[] = [];
  /** Le texte des messages, pour que `demandesDeCloture` ait quelque chose
   *  à lire. Séparé parce que le port `LecteurDeForum` ne porte pas de corps. */
  readonly #corps = new Map<number, string>();
  readonly postes: { sujetId: number; mentionne: string; corps: string; code: string }[] = [];
  #prochainId = 1;

  ajouter(
    m: Omit<MessageDuForum, "id"> & { id?: number; corps?: string },
  ): MessageDuForum {
    const { corps, ...reste } = m;
    const complet = { ...reste, id: m.id ?? this.#prochainId++ };
    this.#messages.push(complet);
    this.#corps.set(complet.id, corps ?? "");
    this.#prochainId = Math.max(this.#prochainId, complet.id + 1);
    return complet;
  }

  /** La détection réutilise le VRAI détecteur, et pas une imitation : un
   *  faux qui reconnaîtrait `[cloture]` autrement que le vrai rendrait les
   *  tests de cas d'usage menteurs. */
  demandesDeCloture(
    sujetId: number,
    depuisMessageId: number,
  ): Promise<readonly DemandeDeClotureLue[]> {
    const nouveaux = this.#messages
      .filter((m) => m.sujetId === sujetId && m.id > depuisMessageId)
      .map((m) => ({
        id: m.id,
        auteurId: m.auteurId,
        auteurPseudo: m.auteurPseudo,
        corps: this.#corps.get(m.id) ?? "",
      }));
    return Promise.resolve(demandesDeCloture(nouveaux).map((d) => ({ sujetId, ...d })));
  }

  /** Comme ci-dessus : c'est le VRAI lecteur d'actions qui travaille. Un
   *  faux qui reconnaîtrait `[[WM-ACTION:…]]` autrement que le vrai
   *  laisserait passer des tests sur un format qui n'existe pas. */
  actionsDuSujet(
    sujetId: number,
    depuisMessageId: number,
  ): Promise<readonly ActionLue[]> {
    const nouveaux = this.#messages
      .filter((m) => m.sujetId === sujetId && m.id > depuisMessageId)
      .map((m) => ({
        id: m.id,
        auteurId: m.auteurId,
        auteurPseudo: m.auteurPseudo,
        corps: this.#corps.get(m.id) ?? "",
      }));
    return Promise.resolve(actionsDemandees(nouveaux).map((a) => ({ sujetId, ...a })));
  }

  messagesDuSujet(
    sujetId: number,
    depuisMessageId: number,
  ): Promise<readonly MessageDuForum[]> {
    return Promise.resolve(
      this.#messages
        .filter((m) => m.sujetId === sujetId && m.id > depuisMessageId)
        .sort((a, b) => a.id - b.id),
    );
  }

  /** Quels sujets vivent dans quel forum. Le vrai le sait par la page du
   *  forum ; le faux a besoin qu'on le lui dise. */
  readonly forumDuSujet = new Map<number, number>();

  sujetsRemues(forums: readonly number[]): Promise<readonly SujetRemue[]> {
    const dernier = new Map<number, number>();
    for (const m of this.#messages) {
      const forum = this.forumDuSujet.get(m.sujetId);
      if (forum !== undefined && !forums.includes(forum)) continue;
      dernier.set(m.sujetId, Math.max(dernier.get(m.sujetId) ?? 0, m.id));
    }
    return Promise.resolve(
      [...dernier].map(([sujetId, dernierMessageId]) => ({ sujetId, dernierMessageId })),
    );
  }

  /** Posé par un test pour simuler un forum injoignable. */
  refuseLaProchaineReponse: Error | null = null;

  repondre(sujetId: number, mentionne: string, corps: string, code: string): Promise<number> {
    if (this.refuseLaProchaineReponse) {
      const erreur = this.refuseLaProchaineReponse;
      this.refuseLaProchaineReponse = null;
      return Promise.reject(erreur);
    }
    this.postes.push({ sujetId, mentionne, corps, code });
    const m = this.ajouter({
      sujetId,
      auteurId: 0,
      auteurPseudo: "compte de publication",
    });
    return Promise.resolve(m.id);
  }
}

export class HorlogeFigee implements Horloge {
  #instant: Date;

  constructor(instant: Date) {
    this.#instant = new Date(instant.getTime());
  }

  maintenant(): Date {
    return new Date(this.#instant.getTime());
  }

  avanceDe(millisecondes: number): void {
    this.#instant = new Date(this.#instant.getTime() + millisecondes);
  }
}

/** Un signataire de test. **Il n'est pas sûr et ne doit jamais servir
 *  ailleurs que dans les tests** : il ne fait pas de HMAC, il hache.
 *  Le vrai vit dans adaptateurs/http/ et utilise Web Crypto. */
export class SignataireDeTest implements Signataire {
  constructor(private readonly secret: string = "secret-de-test") {}

  empreinte(message: string): Promise<Uint8Array> {
    const octets = new Uint8Array(32);
    let g = graineDepuis(`${this.secret}|${message}`);
    for (let i = 0; i < octets.length; i++) {
      g = (g * 1664525 + 1013904223) >>> 0;
      octets[i] = (g >>> 24) & 0xff;
    }
    return Promise.resolve(octets);
  }
}
